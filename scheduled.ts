import type { Request, Response } from "express";
import { getMarketByCronTaskUid } from "./db";
import { sdk } from "./_core/sdk";
import { reconcileBaseSetContributions } from "./services/contributionReconciliation";
import { syncBaseSetIndex } from "./services/indexOracle";

const errorPayload = (error: unknown, req: Request, taskUid?: string) => ({
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  context: { url: req.originalUrl, taskUid: taskUid ?? null },
  timestamp: new Date().toISOString(),
});

/**
 * Cron-only callback. The trusted task UID comes from the platform-authenticated
 * cron identity rather than from the request body.
 */
export async function runBaseSetOracleSchedule(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const cronUser = await sdk.authenticateRequest(req);
    taskUid = cronUser.taskUid;
    if (!cronUser.isCron || !taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const market = await getMarketByCronTaskUid(taskUid);
    if (!market) {
      return res.json({ ok: true, skipped: "orphaned_schedule" });
    }
    if (market.slug !== "base-set" || market.network !== "testnet") {
      return res.status(400).json({ error: "unexpected_market_schedule" });
    }

    const [oracle, contributions] = await Promise.all([
      syncBaseSetIndex(),
      reconcileBaseSetContributions(),
    ]);
    return res.json({ ok: true, market: market.slug, oracle, contributions });
  } catch (error) {
    console.error("[Base Set schedule] failed", error);
    return res.status(500).json(errorPayload(error, req, taskUid));
  }
}
