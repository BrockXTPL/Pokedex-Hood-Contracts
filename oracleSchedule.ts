export const SUPPORTED_ORACLE_INTERVAL_MINUTES = [5, 10, 15, 20, 30, 60] as const;

export type SupportedOracleIntervalMinutes = (typeof SUPPORTED_ORACLE_INTERVAL_MINUTES)[number];

export function isSupportedOracleIntervalMinutes(value: number): value is SupportedOracleIntervalMinutes {
  return (SUPPORTED_ORACLE_INTERVAL_MINUTES as readonly number[]).includes(value);
}

export function managedOracleCron(intervalMinutes: number): string {
  if (!isSupportedOracleIntervalMinutes(intervalMinutes)) {
    throw new Error(`Unsupported Base Set update interval: ${intervalMinutes} minutes.`);
  }
  return intervalMinutes === 60 ? "0 0 * * * *" : `0 */${intervalMinutes} * * * *`;
}

export type SyncHealth = {
  state: "awaiting" | "healthy" | "stale";
  ageMinutes: number | null;
};

export function deriveSyncHealth(
  lastSyncAt: Date | string | null | undefined,
  maximumOracleAgeMinutes: number,
  now: Date = new Date()
): SyncHealth {
  if (!lastSyncAt) return { state: "awaiting", ageMinutes: null };
  const timestamp = new Date(lastSyncAt).getTime();
  if (Number.isNaN(timestamp)) return { state: "awaiting", ageMinutes: null };
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - timestamp) / 60_000));
  return {
    state: ageMinutes <= maximumOracleAgeMinutes ? "healthy" : "stale",
    ageMinutes,
  };
}
