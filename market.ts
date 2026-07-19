import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getContractConfig,
  getContributionHistory,
  getFundingSummary,
  getHistoricalArchiveHistory,
  getIndexHistory,
  getLatestIndexSnapshot,
  getMarketBySlug,
  getMarketComponents,
  getMarkets,
  recordContribution,
  weiToDisplayEth,
} from "../db";
import { reconcileBaseSetContributions } from "../services/contributionReconciliation";
import { publicProcedure, router } from "../_core/trpc";
import { PRICE_PROVENANCE } from "../../shared/priceProvenance";

const baseSetSlug = "base-set";
const testnetChainId = 46630;
const addressPattern = /^0x[a-fA-F0-9]{40}$/;

/**
 * Future market records remain publicly locked until both independent rollout
 * gates have been satisfied: Base Set testnet validation and explicit owner
 * approval for the individual future market. This projection is used by every
 * public market read so raw persisted lifecycle state cannot bypass the gate.
 */
export function projectPublicMarket<T extends { slug: string; lifecycle: string; adminApproved: boolean }>(
  market: T,
  baseSetValidated: boolean
) {
  const isFutureMarket = market.slug !== baseSetSlug;
  const isRolloutAuthorized = !isFutureMarket || (baseSetValidated && market.adminApproved);
  return {
    ...market,
    lifecycle: isRolloutAuthorized ? market.lifecycle : "locked",
    isRolloutAuthorized,
  };
}
const hashPattern = /^0x[a-fA-F0-9]{64}$/;

const fundingView = (market: { fundingTargetWei: string }, funding: Awaited<ReturnType<typeof getFundingSummary>>) => {
  const targetEth = Number(weiToDisplayEth(market.fundingTargetWei));
  const confirmedEth = Number(weiToDisplayEth(funding.confirmedWei));
  return {
    targetWei: market.fundingTargetWei,
    confirmedWei: funding.confirmedWei,
    pendingWei: funding.pendingWei,
    targetEth: weiToDisplayEth(market.fundingTargetWei),
    confirmedEth: weiToDisplayEth(funding.confirmedWei),
    pendingEth: weiToDisplayEth(funding.pendingWei),
    progressPercent: targetEth > 0 ? Math.min((confirmedEth / targetEth) * 100, 100) : 0,
    contributorCount: funding.contributorCount,
    confirmedCount: funding.confirmedCount,
  };
};

const pricedSubtotalUsd = (snapshot: { weightedMarketValueUsd: string; componentCount: number }) => {
  const averageUsd = Number(snapshot.weightedMarketValueUsd);
  const pricedComponentCount = Number(snapshot.componentCount);
  if (!Number.isFinite(averageUsd) || !Number.isFinite(pricedComponentCount) || pricedComponentCount <= 0) return null;
  return (averageUsd * pricedComponentCount).toFixed(8);
};

const serializeSnapshot = (snapshot: Awaited<ReturnType<typeof getLatestIndexSnapshot>>) => {
  if (!snapshot) return null;
  return {
    id: String(snapshot.id),
    indexIdentifier: snapshot.indexIdentifier,
    indexValue: snapshot.indexValue,
    weightedMarketValueUsd: snapshot.weightedMarketValueUsd,
    pricedSubtotalUsd: pricedSubtotalUsd(snapshot),
    baselineMarketValueUsd: snapshot.baselineMarketValueUsd,
    componentCount: snapshot.componentCount,
    componentData: snapshot.componentData,
    dataProvider: snapshot.dataProvider,
    calculationVersion: snapshot.calculationVersion,
    methodologyVersion: snapshot.methodologyVersion,
    oracleUpdateStatus: snapshot.oracleUpdateStatus,
    providerUpdatedAt: snapshot.providerUpdatedAt,
    observedAt: snapshot.observedAt,
  };
};

export const marketRouter = router({
  overview: publicProcedure.query(async () => {
    const allMarkets = await getMarkets();
    const baseSetValidated = allMarkets.find(market => market.slug === baseSetSlug)?.baseSetValidated ?? false;
    return Promise.all(
      allMarkets.map(async market => {
        const publicMarket = projectPublicMarket(market, baseSetValidated);
        return {
          ...publicMarket,
          funding: fundingView(market, await getFundingSummary(market.id)),
          latestSnapshot: serializeSnapshot(await getLatestIndexSnapshot(market.id)),
        };
      })
    );
  }),

  detail: publicProcedure.input(z.object({ slug: z.string().min(1).max(64) })).query(async ({ input }) => {
    const market = await getMarketBySlug(input.slug);
    if (!market) throw new TRPCError({ code: "NOT_FOUND", message: "Market not found." });
    const baseSet = market.slug === baseSetSlug ? market : await getMarketBySlug(baseSetSlug);
    const publicMarket = projectPublicMarket(market, baseSet?.baseSetValidated ?? false);
    const [funding, latestSnapshot, history, archiveHistory, components, contractConfig, contributionHistory] = await Promise.all([
      getFundingSummary(market.id),
      getLatestIndexSnapshot(market.id),
      getIndexHistory(market.id),
      getHistoricalArchiveHistory(market.id),
      getMarketComponents(market.id),
      getContractConfig(market.id),
      getContributionHistory(market.id, 100),
    ]);

    let abi: unknown[] = [];
    if (contractConfig?.isConfigured) {
      try {
        const parsed = JSON.parse(contractConfig.abiJson);
        abi = Array.isArray(parsed) ? parsed : [];
      } catch {
        abi = [];
      }
    }

    return {
      market: { ...publicMarket, funding: fundingView(market, funding) },
      contract: {
        isConfigured: contractConfig?.isConfigured ?? false,
        chainId: contractConfig?.chainId ?? testnetChainId,
        rpcUrl: contractConfig?.rpcUrl ?? null,
        liquidityPoolAddress: contractConfig?.isConfigured ? contractConfig.liquidityPoolAddress : null,
        abi,
      },
      latestSnapshot: serializeSnapshot(latestSnapshot),
      priceProvenance: PRICE_PROVENANCE,
      history: history.map(snapshot => ({
        id: String(snapshot.id),
        value: snapshot.indexValue,
        indexValue: snapshot.indexValue,
        weightedMarketValueUsd: snapshot.weightedMarketValueUsd,
        pricedSubtotalUsd: pricedSubtotalUsd(snapshot),
        observedAt: snapshot.observedAt,
        componentCount: snapshot.componentCount,
        dataProvider: snapshot.dataProvider,
        providerUpdatedAt: snapshot.providerUpdatedAt,
        sourceKind: "live" as const,
      })),
      archiveHistory: archiveHistory.map(snapshot => ({
        id: String(snapshot.id),
        weightedMarketValueUsd: snapshot.weightedMarketValueUsd,
        pricedSubtotalUsd: pricedSubtotalUsd(snapshot),
        observedAt: snapshot.observedAt,
        componentCount: snapshot.componentCount,
        dataProvider: snapshot.dataProvider,
        calculationVersion: snapshot.calculationVersion,
        methodologyVersion: snapshot.methodologyVersion,
        sourceKind: "archive" as const,
      })),
      components: components.map(component => ({
        id: component.id,
        cardName: component.cardName,
        cardNumber: component.cardNumber,
        providerCardId: component.providerCardId,
        approvedVariant: component.approvedVariant,
        weight: component.weight,
        isActive: component.isActive,
      })),
      contributions: contributionHistory.map(contribution => ({
        id: String(contribution.id),
        walletAddress: contribution.walletAddress,
        amountEth: contribution.amountEth,
        transactionHash: contribution.transactionHash,
        status: contribution.status,
        recordedAt: contribution.recordedAt,
        confirmedAt: contribution.confirmedAt,
      })),
    };
  }),

  funding: publicProcedure.input(z.object({ slug: z.string().min(1).max(64) })).query(async ({ input }) => {
    const market = await getMarketBySlug(input.slug);
    if (!market) throw new TRPCError({ code: "NOT_FOUND", message: "Market not found." });
    return fundingView(market, await getFundingSummary(market.id));
  }),

  recordTestnetContribution: publicProcedure
    .input(
      z.object({
        walletAddress: z.string().regex(addressPattern, "A valid wallet address is required."),
        amountWei: z.string().regex(/^\d+$/, "Amount must be in wei."),
        amountEth: z.string().regex(/^\d+(\.\d{1,18})?$/, "Amount must be in ETH."),
        transactionHash: z.string().regex(hashPattern, "A valid transaction hash is required."),
        chainId: z.literal(testnetChainId),
      })
    )
    .mutation(async ({ input }) => {
      const market = await getMarketBySlug(baseSetSlug);
      if (!market) throw new TRPCError({ code: "NOT_FOUND", message: "Base Set market not found." });
      const contract = await getContractConfig(market.id);
      if (!contract?.isConfigured || !contract.liquidityPoolAddress) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The Base Set testnet liquidity contract is not configured yet.",
        });
      }
      await recordContribution({ marketId: market.id, ...input });
      const reconciliation = await reconcileBaseSetContributions();
      const [contributions, funding] = await Promise.all([
        getContributionHistory(market.id, 100),
        getFundingSummary(market.id),
      ]);
      const recordedContribution = contributions.find(contribution => contribution.transactionHash.toLowerCase() === input.transactionHash.toLowerCase());
      const contributionStatus = recordedContribution?.status === "confirmed" || recordedContribution?.status === "failed"
        ? recordedContribution.status
        : "pending";

      return {
        accepted: true,
        reconciliation,
        contributionStatus,
        funding: fundingView(market, funding),
      };
    }),
});
