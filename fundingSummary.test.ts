import { describe, expect, it } from "vitest";
import { addIntegerStrings, summarizeFundingContributions, weiToDisplayEth } from "./db";

describe("funding summary arithmetic", () => {
  it("adds wei amounts exactly without JavaScript number rounding", () => {
    expect(addIntegerStrings("999999999999999999", "1")).toBe("1000000000000000000");
    expect(addIntegerStrings("000012", "000008")).toBe("20");
  });

  it("counts confirmed liquidity and unique contributor wallets while retaining pending funds separately", () => {
    const summary = summarizeFundingContributions([
      {
        amountWei: "1000000000000000000",
        status: "confirmed",
        walletAddress: "0xAbCd000000000000000000000000000000000001",
      },
      {
        amountWei: "500000000000000000",
        status: "confirmed",
        walletAddress: "0xabcd000000000000000000000000000000000001",
      },
      {
        amountWei: "2000000000000000000",
        status: "pending",
        walletAddress: "0x0000000000000000000000000000000000000002",
      },
      {
        amountWei: "9000000000000000000",
        status: "failed",
        walletAddress: "0x0000000000000000000000000000000000000003",
      },
    ]);

    expect(summary).toEqual({
      confirmedWei: "1500000000000000000",
      pendingWei: "2000000000000000000",
      contributorCount: 1,
      confirmedCount: 2,
    });
    expect(weiToDisplayEth(summary.confirmedWei)).toBe("1.500000");
  });
});
