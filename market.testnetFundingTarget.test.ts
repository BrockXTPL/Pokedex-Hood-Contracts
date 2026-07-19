import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getContractConfig: vi.fn(),
  getContributionHistory: vi.fn(),
  getFundingSummary: vi.fn(),
  getIndexHistory: vi.fn(),
  getLatestIndexSnapshot: vi.fn(),
  getMarketBySlug: vi.fn(),
  getMarketComponents: vi.fn(),
  getMarkets: vi.fn(),
  recordContribution: vi.fn(),
  weiToDisplayEth: vi.fn(),
}));

const reconciliationMocks = vi.hoisted(() => ({
  reconcileBaseSetContributions: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./services/contributionReconciliation", () => reconciliationMocks);

import { marketRouter } from "./routers/market";

const testnetTargetWei = "50000000000000000";
const baseSet = {
  id: 1,
  slug: "base-set",
  displayName: "Original Base Set",
  setCode: "base1",
  network: "testnet",
  lifecycle: "configuration_pending",
  fundingTargetWei: testnetTargetWei,
  baseSetValidated: false,
  adminApproved: true,
};

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Base Set testnet funding target", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getMarketBySlug.mockResolvedValue(baseSet);
    dbMocks.getFundingSummary.mockResolvedValue({
      confirmedWei: "0",
      pendingWei: "0",
      contributorCount: 0,
      confirmedCount: 0,
    });
    dbMocks.weiToDisplayEth.mockImplementation((wei: string) => {
      if (wei === testnetTargetWei) return "0.050000";
      return "0.000000";
    });
  });

  it("reports a 0.05 testnet ETH validation target rather than a 10 ETH launch target", async () => {
    const funding = await marketRouter.createCaller(createPublicContext()).funding({ slug: "base-set" });

    expect(funding).toMatchObject({
      targetWei: testnetTargetWei,
      targetEth: "0.050000",
      confirmedEth: "0.000000",
      progressPercent: 0,
    });
  });

  it("returns the reconciled receipt state and funding summary immediately after recording a contribution", async () => {
    const transactionHash = `0x${"a".repeat(64)}`;
    const walletAddress = `0x${"b".repeat(40)}`;
    dbMocks.getContractConfig.mockResolvedValue({
      isConfigured: true,
      liquidityPoolAddress: `0x${"c".repeat(40)}`,
    });
    dbMocks.getContributionHistory.mockResolvedValue([{ transactionHash, status: "confirmed" }]);
    dbMocks.getFundingSummary.mockResolvedValue({
      confirmedWei: testnetTargetWei,
      pendingWei: "0",
      contributorCount: 1,
      confirmedCount: 1,
    });
    dbMocks.weiToDisplayEth.mockImplementation((wei: string) => wei === testnetTargetWei ? "0.050000" : "0.000000");
    reconciliationMocks.reconcileBaseSetContributions.mockResolvedValue({ ok: true, checked: 1, confirmed: 1, failed: 0, pending: 0 });

    const result = await marketRouter.createCaller(createPublicContext()).recordTestnetContribution({
      walletAddress,
      amountWei: testnetTargetWei,
      amountEth: "0.05",
      transactionHash,
      chainId: 46630,
    });

    expect(dbMocks.recordContribution).toHaveBeenCalledWith(expect.objectContaining({ marketId: 1, transactionHash }));
    expect(result).toMatchObject({
      accepted: true,
      contributionStatus: "confirmed",
      funding: {
        targetEth: "0.050000",
        confirmedEth: "0.050000",
        progressPercent: 100,
        confirmedCount: 1,
      },
    });
  });

  it("returns a pending receipt state with pending funding so the client can keep refreshing without a page reload", async () => {
    const transactionHash = `0x${"d".repeat(64)}`;
    const walletAddress = `0x${"e".repeat(40)}`;
    dbMocks.getContractConfig.mockResolvedValue({
      isConfigured: true,
      liquidityPoolAddress: `0x${"f".repeat(40)}`,
    });
    dbMocks.getContributionHistory.mockResolvedValue([{ transactionHash, status: "pending" }]);
    dbMocks.getFundingSummary.mockResolvedValue({
      confirmedWei: "0",
      pendingWei: testnetTargetWei,
      contributorCount: 0,
      confirmedCount: 0,
    });
    dbMocks.weiToDisplayEth.mockImplementation((wei: string) => wei === testnetTargetWei ? "0.050000" : "0.000000");
    reconciliationMocks.reconcileBaseSetContributions.mockResolvedValue({ ok: true, checked: 1, confirmed: 0, failed: 0, pending: 1 });

    const result = await marketRouter.createCaller(createPublicContext()).recordTestnetContribution({
      walletAddress,
      amountWei: testnetTargetWei,
      amountEth: "0.05",
      transactionHash,
      chainId: 46630,
    });

    expect(result).toMatchObject({
      accepted: true,
      contributionStatus: "pending",
      funding: {
        confirmedEth: "0.000000",
        pendingEth: "0.050000",
        confirmedCount: 0,
      },
    });
  });
});
