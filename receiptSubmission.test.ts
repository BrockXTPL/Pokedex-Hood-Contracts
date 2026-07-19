import { describe, expect, it } from "vitest";
import type { Hash } from "viem";
import { claimReceiptSubmission } from "../client/src/lib/receiptSubmission";

const hash = `0x${"a".repeat(64)}` as Hash;
const anotherHash = `0x${"b".repeat(64)}` as Hash;

describe("receipt submission idempotency", () => {
  it("claims each receipt hash only once during a page session", () => {
    const submittedHashes = new Set<Hash>();

    expect(claimReceiptSubmission(submittedHashes, hash)).toBe(true);
    expect(claimReceiptSubmission(submittedHashes, hash)).toBe(false);
    expect(claimReceiptSubmission(submittedHashes, anotherHash)).toBe(true);
    expect(submittedHashes).toEqual(new Set([hash, anotherHash]));
  });
});
