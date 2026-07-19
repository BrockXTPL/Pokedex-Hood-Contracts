import {
  createIndexSnapshot,
  getLatestIndexSnapshot,
  getMarketBySlug,
  getMarketComponents,
  insertPriceObservations,
} from "../db";
import { LIVE_TCGDEX_PRICE_PROVENANCE } from "../../shared/priceProvenance";

const TCGDEX_BASE_URL = "https://api.tcgdex.net/v2/en/cards";
const BASE_SET_INDEX_IDENTIFIER = "POKE-BASE-TESTNET";
const INDEX_BASE_VALUE = 1000;
const MINIMUM_COVERAGE = 0.75;

export type TcgDexPricing = {
  tcgplayer?: {
    updated?: string;
    unit?: string;
    holofoil?: { marketPrice?: number | null };
    reverseHolofoil?: { marketPrice?: number | null };
    normal?: { marketPrice?: number | null };
  };
};

type TcgDexCard = {
  id: string;
  name: string;
  set?: { id?: string; name?: string };
  pricing?: TcgDexPricing;
};

type PricedComponent = {
  componentId: number;
  cardName: string;
  providerCardId: string;
  cardNumber: string;
  weight: number;
  priceUsd: number;
  sourceTimestamp: Date | null;
  rawPayload: string;
};

const parseProviderDate = (value: string | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
};

/**
 * Returns only the explicitly approved unlimited-holofoil USD market price.
 * Other available TCGplayer variants must not silently substitute for it.
 */
export function selectTcgplayerHolofoilMarketPrice(pricing: TcgDexPricing | undefined) {
  return pricing?.tcgplayer?.holofoil?.marketPrice;
}

async function fetchCardPrice(component: {
  id: number;
  providerCardId: string;
  cardName: string;
  cardNumber: string;
  weight: string;
}): Promise<PricedComponent | null> {
  const response = await fetch(`${TCGDEX_BASE_URL}/${encodeURIComponent(component.providerCardId)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`TCGdex returned ${response.status} for ${component.providerCardId}`);
  }

  const card = (await response.json()) as TcgDexCard;
  const price = selectTcgplayerHolofoilMarketPrice(card.pricing);
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    componentId: component.id,
    cardName: card.name || component.cardName,
    providerCardId: component.providerCardId,
    cardNumber: component.cardNumber,
    weight: Number(component.weight),
    priceUsd: price,
    sourceTimestamp: parseProviderDate(card.pricing?.tcgplayer?.updated),
    rawPayload: JSON.stringify(card),
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const value = values[cursor++];
      results.push(await mapper(value));
    }
  });
  await Promise.all(workers);
  return results;
}

export type OracleRunResult = {
  ok: boolean;
  skipped?: string;
  marketId?: number;
  componentsExpected?: number;
  componentsPriced?: number;
  coverage?: number;
  indexValue?: string;
  observedAt?: string;
};

export type IndexPriceInput = Pick<PricedComponent, "priceUsd" | "weight">;

export function calculateWeightedIndex(priced: IndexPriceInput[], priorBaseline?: number) {
  const coveredWeight = priced.reduce((sum, component) => sum + component.weight, 0);
  if (!Number.isFinite(coveredWeight) || coveredWeight <= 0) return null;

  const weightedMarketValue = priced.reduce(
    (sum, component) => sum + component.priceUsd * component.weight,
    0,
  ) / coveredWeight;
  if (!Number.isFinite(weightedMarketValue) || weightedMarketValue <= 0) return null;

  const baselineMarketValue = priorBaseline && priorBaseline > 0 ? priorBaseline : weightedMarketValue;
  return {
    weightedMarketValue,
    baselineMarketValue,
    indexValue: (weightedMarketValue / baselineMarketValue) * INDEX_BASE_VALUE,
  };
}

/**
 * Fetches the approved Base Set component prices, keeps raw source evidence,
 * and persists a reproducible calculation. The first valid run establishes the
 * 1,000-point baseline; later runs are normalized against that baseline.
 */
export async function syncBaseSetIndex(): Promise<OracleRunResult> {
  const market = await getMarketBySlug("base-set");
  if (!market) return { ok: false, skipped: "base_set_market_not_found" };

  const components = (await getMarketComponents(market.id)).filter(component => component.isActive);
  if (components.length === 0) return { ok: false, skipped: "no_active_components" };

  const settled = await mapWithConcurrency(components, 4, async component => {
    try {
      return await fetchCardPrice(component);
    } catch (error) {
      console.warn(`[Oracle] Unable to price ${component.providerCardId}:`, String(error));
      return null;
    }
  });
  const priced = settled.filter((item): item is PricedComponent => item !== null);
  const coverage = priced.length / components.length;

  if (priced.length > 0) {
    await insertPriceObservations(
      priced.map(component => ({
        marketId: market.id,
        componentId: component.componentId,
        cardName: component.cardName,
        cardSet: "Base Set",
        cardNumber: component.cardNumber,
        variant: LIVE_TCGDEX_PRICE_PROVENANCE.variant,
        marketPriceUsd: component.priceUsd.toFixed(8),
        source: LIVE_TCGDEX_PRICE_PROVENANCE.source,
        sourceTimestamp: component.sourceTimestamp,
        apiResponseIdentifier: component.providerCardId,
        rawPayload: component.rawPayload,
      }))
    );
  }

  if (coverage < MINIMUM_COVERAGE) {
    return {
      ok: false,
      skipped: "insufficient_price_coverage",
      marketId: market.id,
      componentsExpected: components.length,
      componentsPriced: priced.length,
      coverage,
    };
  }

  const previous = await getLatestIndexSnapshot(market.id);
  const calculation = calculateWeightedIndex(
    priced,
    previous ? Number(previous.baselineMarketValueUsd) : undefined,
  );
  if (!calculation) {
    return { ok: false, skipped: "invalid_component_weighting", marketId: market.id };
  }
  const { weightedMarketValue, baselineMarketValue: baseline, indexValue } = calculation;
  const providerUpdatedAt = priced.reduce<Date | null>((latest, component) => {
    if (!component.sourceTimestamp) return latest;
    if (!latest || component.sourceTimestamp > latest) return component.sourceTimestamp;
    return latest;
  }, null);
  const componentData = priced.map(component => ({
    cardName: component.cardName,
    providerCardId: component.providerCardId,
    cardNumber: component.cardNumber,
    approvedVariant: LIVE_TCGDEX_PRICE_PROVENANCE.variant,
    priceField: LIVE_TCGDEX_PRICE_PROVENANCE.priceField,
    weight: component.weight,
    marketPriceUsd: component.priceUsd,
    sourceTimestamp: component.sourceTimestamp?.toISOString() ?? null,
    source: LIVE_TCGDEX_PRICE_PROVENANCE.source,
  }));

  await createIndexSnapshot({
    marketId: market.id,
    indexIdentifier: BASE_SET_INDEX_IDENTIFIER,
    indexValue: indexValue.toFixed(8),
    weightedMarketValueUsd: weightedMarketValue.toFixed(8),
    baselineMarketValueUsd: baseline.toFixed(8),
    componentCount: priced.length,
    componentData: JSON.stringify(componentData),
    dataProvider: LIVE_TCGDEX_PRICE_PROVENANCE.source,
    calculationVersion: "1.0.0",
    methodologyVersion: "1.0.0",
    oracleUpdateStatus: "recorded_offchain",
    providerUpdatedAt,
  });

  return {
    ok: true,
    marketId: market.id,
    componentsExpected: components.length,
    componentsPriced: priced.length,
    coverage,
    indexValue: indexValue.toFixed(8),
    observedAt: new Date().toISOString(),
  };
}
