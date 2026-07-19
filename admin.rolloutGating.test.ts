import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getAuditEvents: vi.fn(),
  getContractConfig: vi.fn(),
  getContributionHistory: vi.fn(),
  getFundingSummary: vi.fn(),
  getLatestIndexSnapshot: vi.fn(),
  getMarketBySlug: vi.fn(),
  getMarkets: vi.fn(),
  recordAuditEvent: vi.fn(),
  setBaseSetValidated: vi.fn(),
  setFutureMarketApproval: vi.fn(),
  setMarketScheduleTaskUid: vi.fn(),
  updateContractConfiguration: vi.fn(),
  weiToDisplayEth: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { adminRouter } from "./routers/admin";

function createOwnerContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-owner",
      email: "owner@example.com",
      name: "Owner tester",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("future-market approval gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks an owner from approving a future market before Base Set validation", async () => {
    dbMocks.getMarketBySlug.mockImplementation(async (slug: string) => {
      if (slug === "base-set") return { id: 1, baseSetValidated: false };
      if (slug === "jungle") return { id: 2 };
      return undefined;
    });

    const caller = adminRouter.createCaller(createOwnerContext());

    await expect(caller.setFutureMarketApproval({ slug: "jungle", approved: true })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(dbMocks.setFutureMarketApproval).not.toHaveBeenCalled();
  });

  it("records an owner-approved future market only after Base Set validation", async () => {
    dbMocks.getMarketBySlug.mockImplementation(async (slug: string) => {
      if (slug === "base-set") return { id: 1, baseSetValidated: true };
      if (slug === "jungle") return { id: 2 };
      return undefined;
    });
    dbMocks.setFutureMarketApproval.mockResolvedValue(undefined);

    const caller = adminRouter.createCaller(createOwnerContext());

    await expect(caller.setFutureMarketApproval({ slug: "jungle", approved: true })).resolves.toEqual({
      ok: true,
      slug: "jungle",
      approved: true,
    });
    expect(dbMocks.setFutureMarketApproval).toHaveBeenCalledWith({
      marketId: 2,
      approved: true,
      actorOpenId: "test-owner",
    });
  });
});
