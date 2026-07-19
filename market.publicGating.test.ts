import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getContractConfig: vi.fn(),
  getContributionHistory: vi.fn(),
  getFundingSummary: vi.fn(),
  getHistoricalArchiveHistory: vi.fn(),
  getIndexHistory: vi.fn(),
  getLatestIndexSnapshot: vi.fn(),
  getMarketBySlug: vi.fn(),
  getMarketComponents: vi.fn(),
  getMarkets: vi.fn(),
  recordContribution: vi.fn(),
  weiToDisplayEth: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./services/contributionReconciliation", () => ({
  reconcileBaseSetContributions: vi.fn(),
}));

import { marketRouter } from "./routers/market";

const baseSet = {
  id: 1,
  slug: "base-set",
  displayName: "Original Base Set",
  setCode: "base1",
  network: "testnet",
  lifecycle: "configuration_pending",
  fundingTargetWei: "1000000000000000000",
  baseSetValidated: false,
  adminApproved: true,
};

const jungle = {
  id: 2,
  slug: "jungle",
  displayName: "Jungle",
  setCode: "base2",
  network: "mainnet",
  lifecycle: "configuration_pending",
  fundingTargetWei: "0",
  baseSetValidated: false,
  adminApproved: false,
};

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("public future-market lifecycle gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getFundingSummary.mockResolvedValue({ confirmedWei: "0", pendingWei: "0", contributorCount: 0, confirmedCount: 0 });
    dbMocks.getLatestIndexSnapshot.mockResolvedValue(undefined);
    dbMocks.getHistoricalArchiveHistory.mockResolvedValue([]);
    dbMocks.getIndexHistory.mockResolvedValue([]);
    dbMocks.getMarketComponents.mockResolvedValue([]);
    dbMocks.getContractConfig.mockResolvedValue(undefined);
    dbMocks.getContributionHistory.mockResolvedValue([]);
    dbMocks.weiToDisplayEth.mockReturnValue("0.000000");
  });

  it("returns a future market as locked from the public overview when Base Set validation is absent, even after owner approval", async () => {
    dbMocks.getMarkets.mockResolvedValue([{ ...baseSet, baseSetValidated: false }, { ...jungle, adminApproved: true }]);

    const overview = await marketRouter.createCaller(createPublicContext()).overview();
    const publicJungle = overview.find(market => market.slug === "jungle");

    expect(publicJungle).toMatchObject({ lifecycle: "locked", isRolloutAuthorized: false });
  });

  it("returns a future market as locked from the public overview when owner approval is absent, even after Base Set validation", async () => {
    dbMocks.getMarkets.mockResolvedValue([{ ...baseSet, baseSetValidated: true }, { ...jungle, adminApproved: false }]);

    const overview = await marketRouter.createCaller(createPublicContext()).overview();
    const publicJungle = overview.find(market => market.slug === "jungle");

    expect(publicJungle).toMatchObject({ lifecycle: "locked", isRolloutAuthorized: false });
  });

  it("exposes a configured future market only when both rollout gates are true", async () => {
    const unlockedJungle = { ...jungle, adminApproved: true };
    dbMocks.getMarkets.mockResolvedValue([{ ...baseSet, baseSetValidated: true }, unlockedJungle]);

    const overview = await marketRouter.createCaller(createPublicContext()).overview();
    const publicJungle = overview.find(market => market.slug === "jungle");

    expect(publicJungle).toMatchObject({
      lifecycle: "configuration_pending",
      isRolloutAuthorized: true,
    });
  });

  it("returns archival and live USD basket series separately for a single source-aware chart", async () => {
    const archiveObservedAt = new Date("2023-07-31T00:00:00.000Z");
    const liveObservedAt = new Date("2026-07-18T10:00:00.000Z");
    dbMocks.getMarketBySlug.mockResolvedValue(baseSet);
    dbMocks.getLatestIndexSnapshot.mockResolvedValue({
      id: 99,
      indexIdentifier: "POKE-BASE-TESTNET",
      indexValue: "1000.00000000",
      weightedMarketValueUsd: "52.45000000",
      baselineMarketValueUsd: "52.45000000",
      componentCount: 16,
      componentData: "[]",
      dataProvider: "TCGdex / TCGplayer",
      calculationVersion: "1.0.0",
      methodologyVersion: "1.0.0",
      oracleUpdateStatus: "recorded_offchain",
      providerUpdatedAt: liveObservedAt,
      observedAt: liveObservedAt,
    });
    dbMocks.getHistoricalArchiveHistory.mockResolvedValue([{
      id: 7,
      weightedMarketValueUsd: "28.75000000",
      observedAt: archiveObservedAt,
      componentCount: 15,
      dataProvider: "TCGdex price-history",
      calculationVersion: "archive-monthly-v1",
      methodologyVersion: "archive-holo-good-15-card-v1",
    }]);
    dbMocks.getIndexHistory.mockResolvedValue([{
      id: 99,
      indexValue: "1000.00000000",
      weightedMarketValueUsd: "52.45000000",
      observedAt: liveObservedAt,
      componentCount: 16,
      dataProvider: "TCGdex / TCGplayer",
      providerUpdatedAt: liveObservedAt,
    }]);

    const detail = await marketRouter.createCaller(createPublicContext()).detail({ slug: "base-set" });

    expect(detail.archiveHistory).toEqual([expect.objectContaining({
      weightedMarketValueUsd: "28.75000000",
      pricedSubtotalUsd: "431.25000000",
      componentCount: 15,
      dataProvider: "TCGdex price-history",
      sourceKind: "archive",
    })]);
    expect(detail.history).toEqual([expect.objectContaining({
      weightedMarketValueUsd: "52.45000000",
      pricedSubtotalUsd: "839.20000000",
      componentCount: 16,
      dataProvider: "TCGdex / TCGplayer",
      sourceKind: "live",
    })]);
    expect(detail.priceProvenance).toEqual({
      live: {
        sourceKind: "live",
        source: "TCGdex / TCGplayer",
        provider: "TCGdex",
        marketplace: "TCGplayer",
        variant: "holofoil",
        priceField: "pricing.tcgplayer.holofoil.marketPrice",
        currency: "USD",
      },
      archive: {
        sourceKind: "archive",
        source: "TCGdex price-history",
        provider: "TCGdex price-history",
        variant: "holo-good",
        priceField: "monthly holo-good price proxy",
        currency: "USD",
        coverage: "15 approved Base Set components, November 2022–September 2024",
      },
    });
    expect(dbMocks.getHistoricalArchiveHistory).toHaveBeenCalledWith(baseSet.id);
    expect(dbMocks.getIndexHistory).toHaveBeenCalledWith(baseSet.id);
  });
});
