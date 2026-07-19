import { describe, expect, it } from "vitest";
import { getMarketBySlug, updateOracleSettings } from "./db";

const runDatabaseIntegration = process.env.RUN_DB_INTEGRATION === "1";

describe.runIf(runDatabaseIntegration)("oracle settings database persistence", () => {
  it("writes Base Set settings and retrieves the same values through the market read path", async () => {
    const before = await getMarketBySlug("base-set");
    expect(before).toBeDefined();
    if (!before) return;

    const nextInterval = before.oracleIntervalMinutes === 30 ? 60 : 30;
    const nextMaximumAge = Math.max(before.maximumOracleAgeMinutes, nextInterval * 3);

    try {
      await updateOracleSettings({
        marketId: before.id,
        oracleIntervalMinutes: nextInterval,
        maximumOracleAgeMinutes: nextMaximumAge,
      });
      const persisted = await getMarketBySlug("base-set");
      expect(persisted).toMatchObject({
        id: before.id,
        oracleIntervalMinutes: nextInterval,
        maximumOracleAgeMinutes: nextMaximumAge,
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
