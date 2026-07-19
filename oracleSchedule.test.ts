import { describe, expect, it } from "vitest";
import {
  deriveSyncHealth,
  isSupportedOracleIntervalMinutes,
  managedOracleCron,
} from "./oracleSchedule";

describe("managed Base Set oracle scheduling", () => {
  it("accepts only the supported owner-configurable update cadences", () => {
    expect(isSupportedOracleIntervalMinutes(5)).toBe(true);
    expect(isSupportedOracleIntervalMinutes(30)).toBe(true);
    expect(isSupportedOracleIntervalMinutes(60)).toBe(true);
    expect(isSupportedOracleIntervalMinutes(7)).toBe(false);
  });

  it("derives the managed cron expression directly from the saved cadence", () => {
    expect(managedOracleCron(15)).toBe("0 */15 * * * *");
    expect(managedOracleCron(60)).toBe("0 0 * * * *");
    expect(() => managedOracleCron(7)).toThrow("Unsupported Base Set update interval");
  });

  it("reports awaiting, healthy, and stale status for both oracle and receipt timestamps", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    expect(deriveSyncHealth(null, 60, now)).toEqual({ state: "awaiting", ageMinutes: null });
    expect(deriveSyncHealth("2026-07-18T11:30:00.000Z", 60, now)).toEqual({ state: "healthy", ageMinutes: 30 });
    expect(deriveSyncHealth("2026-07-18T10:30:00.000Z", 60, now)).toEqual({ state: "stale", ageMinutes: 90 });
  });
});
