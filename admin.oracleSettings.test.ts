import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getMarkets: vi.fn(),
  getMarketBySlug: vi.fn(),
  getContractConfig: vi.fn(),
  getFundingSummary: vi.fn(),
  getLatestIndexSnapshot: vi.fn(),
  getContributionHistory: vi.fn(),
  getAuditEvents: vi.fn(),
  updateOracleSettings: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

const { appRouter } = await import("./routers");

const baseMarket = {
  id: 7,
  slug: "base-set",
  name: "Original Pokémon Base Set",
  ticker: "$Pokedex",
  environment: "testnet" as const,
  lifecycle: "validation" as const,
  fundingTargetWei: "1000000000000000000",
  baseSetValidated: false,
  ownerMainnetApproved: false,
  scheduleCronTaskUid: null,
  oracleIntervalMinutes: 60,
  maximumOracleAgeMinutes: 180,
  lastContributionSyncAt: new Date("2026-07-18T11:30:00.000Z"),
  createdAt: new Date("2026-07-18T00:00:00.000Z"),
  updatedAt: new Date("2026-07-18T00:00:00.000Z"),
};

function ownerContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "owner-test",
      email: "owner@example.com",
      name: "Owner",
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

describe("admin Base Set oracle settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getMarketBySlug.mockResolvedValue(baseMarket);
    dbMocks.getMarkets.mockResolvedValue([baseMarket]);
    dbMocks.getContractConfig.mockResolvedValue(null);
    dbMocks.getFundingSummary.mockResolvedValue({ confirmedWei: "0", pendingWei: "0", contributorCount: 0, confirmedCount: 0 });
    dbMocks.getLatestIndexSnapshot.mockResolvedValue({
      indexValue: "102.3",
      componentCount: 5,
      observedAt: new Date("2026-07-18T11:45:00.000Z"),
      oracleUpdateStatus: "healthy",
    });
    dbMocks.getContributionHistory.mockResolvedValue([]);
    dbMocks.getAuditEvents.mockResolvedValue([]);
    dbMocks.updateOracleSettings.mockResolvedValue(undefined);
    dbMocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it("persists the owner-selected values and derives the matching managed cadence", async () => {
    const caller = appRouter.createCaller(ownerContext());
    const result = await caller.admin.updateBaseSetOracleSettings({
      oracleIntervalMinutes: 30,
      maximumOracleAgeMinutes: 120,
    });

    expect(dbMocks.updateOracleSettings).toHaveBeenCalledWith({
      marketId: 7,
      oracleIntervalMinutes: 30,
      maximumOracleAgeMinutes: 120,
    });
    expect(result).toMatchObject({
      ok: true,
      oracleIntervalMinutes: 30,
      maximumOracleAgeMinutes: 120,
      cron: "0 */30 * * * *",
      scheduleUpdated: false,
    });
  });

  it("returns persisted cadence, freshness, and reconciliation status through the owner dashboard", async () => {
    const caller = appRouter.createCaller(ownerContext());
    const dashboard = await caller.admin.dashboard();

    expect(dashboard[0]?.oracle).toMatchObject({
      scheduleConfigured: false,
      oracleIntervalMinutes: 60,
      maximumOracleAgeMinutes: 180,
      managedCron: "0 0 * * * *",
      indexSyncHealth: { state: "healthy" },
      contributionSyncHealth: { state: "healthy" },
      lastContributionSyncAt: new Date("2026-07-18T11:30:00.000Z"),
    });
  });
});
