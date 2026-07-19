import type { Hash } from "viem";

/**
 * Claims a wallet receipt hash for submission exactly once during the current page session.
 * Returning false means the receipt has already been handed to the server.
 */
export function claimReceiptSubmission(submittedHashes: Set<Hash>, transactionHash: Hash): boolean {
  if (submittedHashes.has(transactionHash)) return false;
  submittedHashes.add(transactionHash);
  return true;
}
