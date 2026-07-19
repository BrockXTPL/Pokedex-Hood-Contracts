import { createPublicClient, http, isAddress, type Address, type Hash } from "viem";
import {
  getContractConfig,
  getMarketBySlug,
  getPendingContributions,
  markContributionSync,
  updateContributionStatus,
} from "../db";

export type ContributionReconciliationResult = {
  ok: boolean;
  skipped?: string;
  checked: number;
  confirmed: number;
  failed: number;
  pending: number;
};

/**
 * Confirms only contributions that were first initiated and approved in a
 * visitor's wallet. It validates the final transaction receipt, destination,
 * and native-value amount before moving a local record to confirmed.
 */
export async function reconcileBaseSetContributions(): Promise<ContributionReconciliationResult> {
  const market = await getMarketBySlug("base-set");
  if (!market) return { ok: false, skipped: "base_set_market_not_found", checked: 0, confirmed: 0, failed: 0, pending: 0 };

  const config = await getContractConfig(market.id);
  if (!config?.isConfigured || !config.liquidityPoolAddress || !isAddress(config.liquidityPoolAddress)) {
    return {
      ok: true,
      skipped: "testnet_liquidity_contract_not_configured",
      checked: 0,
      confirmed: 0,
      failed: 0,
      pending: 0,
    };
  }

  const client = createPublicClient({ transport: http(config.rpcUrl) });
  const pendingContributions = await getPendingContributions(market.id, 100);
  let confirmed = 0;
  let failed = 0;
  let stillPending = 0;
  const expectedPool = config.liquidityPoolAddress.toLowerCase();

  for (const contribution of pendingContributions) {
    try {
      const hash = contribution.transactionHash as Hash;
      const receipt = await client.getTransactionReceipt({ hash });
      const transaction = await client.getTransaction({ hash });
      const destination = transaction.to?.toLowerCase();
      const amountMatches = transaction.value.toString() === contribution.amountWei;
      const destinationMatches = destination === expectedPool;
      const senderMatches = transaction.from.toLowerCase() === contribution.walletAddress.toLowerCase();

      if (receipt.status === "success" && destinationMatches && amountMatches && senderMatches) {
        await updateContributionStatus({
          transactionHash: contribution.transactionHash,
          status: "confirmed",
          blockNumber: receipt.blockNumber.toString(),
        });
        confirmed += 1;
      } else {
        await updateContributionStatus({
          transactionHash: contribution.transactionHash,
          status: "failed",
          blockNumber: receipt.blockNumber.toString(),
        });
        failed += 1;
      }
    } catch (error) {
      // A receipt missing from the public RPC is normal while the transaction is pending.
      console.info(`[Contribution reconciliation] ${contribution.transactionHash} is not final yet:`, String(error));
      stillPending += 1;
    }
  }

  await markContributionSync(market.id);
  return {
    ok: true,
    checked: pendingContributions.length,
    confirmed,
    failed,
    pending: stillPending,
  };
}
