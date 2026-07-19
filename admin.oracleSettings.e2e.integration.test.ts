import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { getMarketBySlug, updateOracleSettings } from "./db";
import { appRouter } from "./routers";

const runDatabaseIntegration = process.env.RUN_DB_INTEGRATION === "1";

function ownerContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "oracle-settings-integration-owner",
      email: "owner@example.com",
      name: "Integration Owner",
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

describe.runIf(runDatabaseIntegration)("owner oracle settings persistence to dashboard", () => {
  it("updates Base Set settings through the real owner router and returns them through the real dashboard", async () => {
    const before = await getMarketBySlug("base-set");
    expect(before).toBeDefined();
    if (!before) return;
    expect(before.scheduleCronTaskUid).toBeNull();

    const nextInterval = before.oracleIntervalMinutes === 30 ? 60 : 30;
    const nextMaximumAge = Math.max(before.maximumOracleAgeMinutes, nextInterval * 3);
    const caller = appRouter.createCaller(ownerContext());

    try {
      const update = await caller.admin.updateBaseSetOracleSettings({
        oracleIntervalMinutes: nextInterval,
        maximumOracleAgeMinutes: nextMaximumAge,
      });
      expect(update).toMatchObject({
        ok: true,
        oracleIntervalMinutes: nextInterval,
        maximumOracleAgeMinutes: nextMaximumAge,
        scheduleUpdated: false,
      });

      const dashboard = await caller.admin.dashboard();
      const base = dashboard.find(entry => entry.market.slug === "base-set");
      expect(base?.oracle).toMatchObject({
        oracleIntervalMinutes: nextInterval,
        maximumOracleAgeMinutes: nextMaximumAge,
        managedCron: nextInterval === 60 ? "0 0 * * * *" : "0 */30 * * * *",
      });
    } finally {
      await updateOracleSettings({
        marketId: before.id,
        oracleIntervalMinutes: before.oracleIntervalMinutes,
        maximumOracleAgeMinutes: before.maximumOracleAgeMinutes,
      });
    }
  });
});
