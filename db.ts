import { and, asc, desc, eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  contractConfigs,
  contributions,
  indexComponents,
  indexSnapshots,
  InsertUser,
  marketAuditEvents,
  markets,
  priceObservations,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { baseSetTestnetPoolAbi } from "./contracts/baseSetTestnetPool";

const ROBINHOOD_TESTNET_RPC = "https://rpc.testnet.chain.robinhood.com";
const ROBINHOOD_TESTNET_CHAIN_ID = 46630;
const TESTNET_TARGET_WEI = "50000000000000000"; // 0.05 testnet ETH validation threshold, owner-configurable.
const HISTORICAL_ARCHIVE_STATUS = "historical_archive";

const BASE_SET_HOLO_COMPONENTS = [
  ["base1-1", "1", "Alakazam"],
  ["base1-2", "2", "Blastoise"],
  ["base1-3", "3", "Chansey"],
  ["base1-4", "4", "Charizard"],
  ["base1-5", "5", "Clefairy"],
  ["base1-6", "6", "Gyarados"],
  ["base1-7", "7", "Hitmonchan"],
  ["base1-8", "8", "Machamp"],
  ["base1-9", "9", "Magneton"],
  ["base1-10", "10", "Mewtwo"],
  ["base1-11", "11", "Nidoking"],
  ["base1-12", "12", "Ninetales"],
  ["base1-13", "13", "Poliwrath"],
  ["base1-14", "14", "Raichu"],
  ["base1-15", "15", "Venusaur"],
  ["base1-16", "16", "Zapdos"],
] as const;

let _db: ReturnType<typeof drizzle> | null = null;
let hasAttemptedMarketSeed = false;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach(field => {
    const value = user[field];
    if (value !== undefined) {
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

async function ensureDefaultMarkets() {
  const db = await getDb();
  if (!db || hasAttemptedMarketSeed) return;
  hasAttemptedMarketSeed = true;

  const defaults = [
    {
      slug: "base-set",
      displayName: "Original Base Set",
      setCode: "base1",
      network: "testnet" as const,
      lifecycle: "configuration_pending" as const,
      fundingTargetWei: TESTNET_TARGET_WEI,
      baseSetValidated: false,
      adminApproved: true,
      oracleIntervalMinutes: 60,
      maximumOracleAgeMinutes: 180,
    },
    {
      slug: "jungle",
      displayName: "Jungle",
      setCode: "base2",
      network: "mainnet" as const,
      lifecycle: "locked" as const,
      fundingTargetWei: "0",
      baseSetValidated: false,
      adminApproved: false,
      oracleIntervalMinutes: 60,
      maximumOracleAgeMinutes: 180,
    },
    {
      slug: "fossil",
      displayName: "Fossil",
      setCode: "base3",
      network: "mainnet" as const,
      lifecycle: "locked" as const,
      fundingTargetWei: "0",
      baseSetValidated: false,
      adminApproved: false,
      oracleIntervalMinutes: 60,
      maximumOracleAgeMinutes: 180,
    },
    {
      slug: "base-set-2",
      displayName: "Base Set 2",
      setCode: "base4",
      network: "mainnet" as const,
      lifecycle: "locked" as const,
      fundingTargetWei: "0",
      baseSetValidated: false,
      adminApproved: false,
      oracleIntervalMinutes: 60,
      maximumOracleAgeMinutes: 180,
    },
  ];

  for (const definition of defaults) {
    const existing = await db.select().from(markets).where(eq(markets.slug, definition.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(markets).values(definition);
    }
  }

  const baseMarket = await db.select().from(markets).where(eq(markets.slug, "base-set")).limit(1);
  const baseSet = baseMarket[0];
  if (!baseSet) return;

  const existingConfig = await db
    .select()
    .from(contractConfigs)
    .where(eq(contractConfigs.marketId, baseSet.id))
    .limit(1);
  if (existingConfig.length === 0) {
    await db.insert(contractConfigs).values({
      marketId: baseSet.id,
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      rpcUrl: ROBINHOOD_TESTNET_RPC,
      abiJson: JSON.stringify(baseSetTestnetPoolAbi),
      isConfigured: false,
    });
  }

  const existingComponents = await db
    .select({ id: indexComponents.id })
    .from(indexComponents)
    .where(eq(indexComponents.marketId, baseSet.id));
  if (existingComponents.length === 0) {
    const equalWeight = (1 / BASE_SET_HOLO_COMPONENTS.length).toFixed(10);
    await db.insert(indexComponents).values(
      BASE_SET_HOLO_COMPONENTS.map(([providerCardId, cardNumber, cardName]) => ({
        marketId: baseSet.id,
        providerCardId,
        cardNumber,
        cardName,
        approvedVariant: "holofoil",
        weight: equalWeight,
        isActive: true,
      }))
    );
  }
}

export const normalizeInteger = (value: string) => (value.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0");

export const addIntegerStrings = (left: string, right: string) => {
  const a = normalizeInteger(left);
  const b = normalizeInteger(right);
  let carry = 0;
  let result = "";
  let aIndex = a.length - 1;
  let bIndex = b.length - 1;

  while (aIndex >= 0 || bIndex >= 0 || carry > 0) {
    const digitA = aIndex >= 0 ? Number(a[aIndex--]) : 0;
    const digitB = bIndex >= 0 ? Number(b[bIndex--]) : 0;
    const sum = digitA + digitB + carry;
    result = String(sum % 10) + result;
    carry = Math.floor(sum / 10);
  }
  return normalizeInteger(result);
};

export const weiToDisplayEth = (wei: string) => {
  const normalized = normalizeInteger(wei);
  const padded = normalized.padStart(19, "0");
  const whole = normalizeInteger(padded.slice(0, -18));
  const fraction = padded.slice(-18, -12);
  return `${whole}.${fraction}`;
};

export type FundingContributionRow = {
  amountWei: string;
  status: "pending" | "confirmed" | "failed";
  walletAddress: string;
};

export function summarizeFundingContributions(rows: FundingContributionRow[]) {
  let confirmedWei = "0";
  let pendingWei = "0";
  const contributors = new Set<string>();
  let confirmedCount = 0;

  for (const row of rows) {
    if (row.status === "confirmed") {
      confirmedWei = addIntegerStrings(confirmedWei, row.amountWei);
      contributors.add(row.walletAddress.toLowerCase());
      confirmedCount += 1;
    } else if (row.status === "pending") {
      pendingWei = addIntegerStrings(pendingWei, row.amountWei);
    }
  }

  return { confirmedWei, pendingWei, contributorCount: contributors.size, confirmedCount };
}

export async function getMarkets() {
  await ensureDefaultMarkets();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(markets).orderBy(asc(markets.id));
}

export async function getMarketBySlug(slug: string) {
  await ensureDefaultMarkets();
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(markets).where(eq(markets.slug, slug)).limit(1);
  return result[0];
}

export async function getMarketById(marketId: number) {
  await ensureDefaultMarkets();
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(markets).where(eq(markets.id, marketId)).limit(1);
  return result[0];
}

export async function getMarketByCronTaskUid(taskUid: string) {
  await ensureDefaultMarkets();
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(markets)
    .where(eq(markets.scheduleCronTaskUid, taskUid))
    .limit(1);
  return result[0];
}

export async function setMarketScheduleTaskUid(marketId: number, taskUid: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db
    .update(markets)
    .set({ scheduleCronTaskUid: taskUid, updatedAt: new Date() })
    .where(eq(markets.id, marketId));
}

export async function updateOracleSettings(input: {
  marketId: number;
  oracleIntervalMinutes: number;
  maximumOracleAgeMinutes: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db
    .update(markets)
    .set({
      oracleIntervalMinutes: input.oracleIntervalMinutes,
      maximumOracleAgeMinutes: input.maximumOracleAgeMinutes,
      updatedAt: new Date(),
    })
    .where(eq(markets.id, input.marketId));
}

export async function getFundingSummary(marketId: number) {
  const db = await getDb();
  if (!db) {
    return { confirmedWei: "0", pendingWei: "0", contributorCount: 0, confirmedCount: 0 };
  }
  const rows = await db
    .select({ amountWei: contributions.amountWei, status: contributions.status, walletAddress: contributions.walletAddress })
    .from(contributions)
    .where(eq(contributions.marketId, marketId));

  return summarizeFundingContributions(rows);
}

export async function getLatestIndexSnapshot(marketId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(indexSnapshots)
    .where(and(eq(indexSnapshots.marketId, marketId), ne(indexSnapshots.oracleUpdateStatus, HISTORICAL_ARCHIVE_STATUS)))
    .orderBy(desc(indexSnapshots.observedAt))
    .limit(1);
  return result[0];
}

export async function getIndexHistory(marketId: number, limit = 180) {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select()
    .from(indexSnapshots)
    .where(and(eq(indexSnapshots.marketId, marketId), ne(indexSnapshots.oracleUpdateStatus, HISTORICAL_ARCHIVE_STATUS)))
    .orderBy(desc(indexSnapshots.observedAt))
    .limit(limit);
  return results.reverse();
}

/**
 * Historical archive snapshots intentionally share the audit table with live
 * oracle snapshots, but are queried separately so a chart cannot imply they
 * are one continuous source or card-condition series.
 */
export async function getHistoricalArchiveHistory(marketId: number, limit = 240) {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select()
    .from(indexSnapshots)
    .where(and(eq(indexSnapshots.marketId, marketId), eq(indexSnapshots.oracleUpdateStatus, HISTORICAL_ARCHIVE_STATUS)))
    .orderBy(desc(indexSnapshots.observedAt))
    .limit(limit);
  return results.reverse();
}

export async function getMarketComponents(marketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(indexComponents)
    .where(eq(indexComponents.marketId, marketId))
    .orderBy(asc(indexComponents.cardNumber));
}

export async function getContractConfig(marketId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(contractConfigs)
    .where(eq(contractConfigs.marketId, marketId))
    .limit(1);
  return result[0];
}

export async function getContributionHistory(marketId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contributions)
    .where(eq(contributions.marketId, marketId))
    .orderBy(desc(contributions.recordedAt))
    .limit(limit);
}

export async function getPendingContributions(marketId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contributions)
    .where(and(eq(contributions.marketId, marketId), eq(contributions.status, "pending")))
    .orderBy(asc(contributions.recordedAt))
    .limit(limit);
}

export async function recordContribution(input: {
  marketId: number;
  walletAddress: string;
  amountWei: string;
  amountEth: string;
  transactionHash: string;
  chainId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db
    .insert(contributions)
    .values({ ...input, status: "pending" })
    .onDuplicateKeyUpdate({
      set: {
        walletAddress: input.walletAddress,
        amountWei: input.amountWei,
        amountEth: input.amountEth,
        chainId: input.chainId,
        status: "pending",
        updatedAt: new Date(),
      },
    });
}

export async function updateContributionStatus(input: {
  transactionHash: string;
  status: "confirmed" | "failed" | "pending";
  blockNumber?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db
    .update(contributions)
    .set({
      status: input.status,
      blockNumber: input.blockNumber ?? null,
      confirmedAt: input.status === "confirmed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(contributions.transactionHash, input.transactionHash));
}

export async function insertPriceObservations(
  observations: Array<{
    marketId: number;
    componentId: number;
    cardName: string;
    cardSet: string;
    cardNumber: string;
    variant: string;
    marketPriceUsd: string;
    source: string;
    sourceTimestamp: Date | null;
    apiResponseIdentifier: string;
    rawPayload: string;
  }>
) {
  const db = await getDb();
  if (!db || observations.length === 0) return;
  await db.insert(priceObservations).values(observations);
}

export async function createIndexSnapshot(input: {
  marketId: number;
  indexIdentifier: string;
  indexValue: string;
  weightedMarketValueUsd: string;
  baselineMarketValueUsd: string;
  componentCount: number;
  componentData: string;
  dataProvider: string;
  calculationVersion: string;
  methodologyVersion: string;
  oracleUpdateStatus: string;
  providerUpdatedAt: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(indexSnapshots).values({
    ...input,
    oracleUpdatedAt: null,
    observedAt: new Date(),
  });
}

export async function setBaseSetValidated(input: { marketId: number; validated: boolean; actorOpenId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(markets).set({ baseSetValidated: input.validated }).where(eq(markets.id, input.marketId));
  await recordAuditEvent({
    marketId: input.marketId,
    actorOpenId: input.actorOpenId,
    action: input.validated ? "base_set_validation_approved" : "base_set_validation_revoked",
    detail: JSON.stringify({ validated: input.validated }),
  });
}

export async function setFutureMarketApproval(input: {
  marketId: number;
  approved: boolean;
  actorOpenId: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db
    .update(markets)
    .set({ adminApproved: input.approved, lifecycle: input.approved ? "configuration_pending" : "locked" })
    .where(eq(markets.id, input.marketId));
  await recordAuditEvent({
    marketId: input.marketId,
    actorOpenId: input.actorOpenId,
    action: input.approved ? "future_market_approved" : "future_market_locked",
    detail: JSON.stringify({ approved: input.approved }),
  });
}

export async function updateContractConfiguration(input: {
  marketId: number;
  liquidityPoolAddress?: string | null;
  marketAddress?: string | null;
  oracleAddress?: string | null;
  abiJson?: string;
  isConfigured?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db
    .update(contractConfigs)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(contractConfigs.marketId, input.marketId));
}

export async function recordAuditEvent(input: {
  marketId: number;
  actorOpenId: string;
  action: string;
  detail: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(marketAuditEvents).values(input);
}

export async function getAuditEvents(marketId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(marketAuditEvents)
    .where(eq(marketAuditEvents.marketId, marketId))
    .orderBy(desc(marketAuditEvents.createdAt))
    .limit(limit);
}

export async function markContributionSync(marketId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(markets).set({ lastContributionSyncAt: new Date() }).where(eq(markets.id, marketId));
}
