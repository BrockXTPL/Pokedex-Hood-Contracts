import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import {
  getAuditEvents,
  getContractConfig,
  getContributionHistory,
  getFundingSummary,
  getLatestIndexSnapshot,
  getMarketBySlug,
  getMarkets,
  recordAuditEvent,
  setBaseSetValidated,
  setFutureMarketApproval,
  setMarketScheduleTaskUid,
  updateContractConfiguration,
  updateOracleSettings,
  weiToDisplayEth,
} from "../db";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { ENV } from "../_core/env";
import { adminProcedure, router } from "../_core/trpc";
import { reconcileBaseSetContributions } from "../services/contributionReconciliation";
import { syncBaseSetIndex } from "../services/indexOracle";
import { deriveSyncHealth, isSupportedOracleIntervalMinutes, managedOracleCron } from "../services/oracleSchedule";
import { baseSetTestnetPoolTemplate } from "../contracts/baseSetTestnetPool";

const baseSetSlug = "base-set";
const futureSlugs = ["jungle", "fossil", "base-set-2"] as const;
const addressPattern = /^0x[a-fA-F0-9]{40}$/;

const sixFieldCron = z.string().refine(value => value.trim().split(/\s+/).length === 6, {
  message: "Use a six-field UTC cron expression: sec min hour dom mon dow.",
});

const secretSafeAddress = z.string().regex(addressPattern).nullable().optional();
const oracleSettingsInput = z
  .object({
    oracleIntervalMinutes: z
      .number()
      .int()
      .refine(isSupportedOracleIntervalMinutes, { message: "Choose 5, 10, 15, 20, 30, or 60 minutes." }),
    maximumOracleAgeMinutes: z.number().int().min(1).max(10_080),
  })
  .refine(value => value.maximumOracleAgeMinutes >= value.oracleIntervalMinutes, {
    message: "The freshness threshold must be at least the update interval.",
  });

export const adminRouter = router({
  baseSetContractTemplate: adminProcedure.query(() => baseSetTestnetPoolTemplate),

  dashboard: adminProcedure.query(async () => {
    const allMarkets = await getMarkets();
    return Promise.all(
      allMarkets.map(async market => {
        const [contract, funding, latestSnapshot, contributions, auditEvents] = await Promise.all([
          getContractConfig(market.id),
          getFundingSummary(market.id),
          getLatestIndexSnapshot(market.id),
          getContributionHistory(market.id, 100),
          getAuditEvents(market.id, 100),
        ]);
        const indexSyncHealth = deriveSyncHealth(latestSnapshot?.observedAt, market.maximumOracleAgeMinutes);
        const contributionSyncHealth = deriveSyncHealth(market.lastContributionSyncAt, market.maximumOracleAgeMinutes);
        const managedCron = isSupportedOracleIntervalMinutes(market.oracleIntervalMinutes)
          ? managedOracleCron(market.oracleIntervalMinutes)
          : null;
        return {
          market,
          contract: contract
            ? {
                chainId: contract.chainId,
                liquidityPoolAddress: contract.liquidityPoolAddress,
                marketAddress: contract.marketAddress,
                oracleAddress: contract.oracleAddress,
                isConfigured: contract.isConfigured,
                lastIndexedBlock: contract.lastIndexedBlock,
              }
            : null,
          oracle: {
            scheduleConfigured: Boolean(market.scheduleCronTaskUid),
            oracleIntervalMinutes: market.oracleIntervalMinutes,
            maximumOracleAgeMinutes: market.maximumOracleAgeMinutes,
            managedCron,
            indexSyncHealth,
            contributionSyncHealth,
            lastContributionSyncAt: market.lastContributionSyncAt,
          },
          funding: {
            confirmedWei: funding.confirmedWei,
            confirmedEth: weiToDisplayEth(funding.confirmedWei),
            pendingWei: funding.pendingWei,
            pendingEth: weiToDisplayEth(funding.pendingWei),
            contributorCount: funding.contributorCount,
            confirmedCount: funding.confirmedCount,
          },
          latestSnapshot: latestSnapshot
            ? {
                indexValue: latestSnapshot.indexValue,
                componentCount: latestSnapshot.componentCount,
                observedAt: latestSnapshot.observedAt,
                oracleUpdateStatus: latestSnapshot.oracleUpdateStatus,
              }
            : null,
          contributions: contributions.map(contribution => ({
            id: String(contribution.id),
            walletAddress: contribution.walletAddress,
            amountEth: contribution.amountEth,
            transactionHash: contribution.transactionHash,
            status: contribution.status,
            recordedAt: contribution.recordedAt,
          })),
          auditEvents: auditEvents.map(event => ({
            id: String(event.id),
            action: event.action,
            detail: event.detail,
            createdAt: event.createdAt,
          })),
        };
      })
    );
  }),

  syncBaseSetNow: adminProcedure.mutation(async ({ ctx }) => {
    const [oracle, contributions] = await Promise.all([
      syncBaseSetIndex(),
      reconcileBaseSetContributions(),
    ]);
    const market = await getMarketBySlug(baseSetSlug);
    if (market) {
      await recordAuditEvent({
        marketId: market.id,
        actorOpenId: ctx.user.openId,
        action: "manual_testnet_sync",
        detail: JSON.stringify({ oracle, contributions }),
      });
    }
    return { oracle, contributions };
  }),

  setBaseSetValidation: adminProcedure
    .input(z.object({ validated: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const market = await getMarketBySlug(baseSetSlug);
      if (!market) throw new TRPCError({ code: "NOT_FOUND", message: "Base Set market not found." });
      await setBaseSetValidated({ marketId: market.id, validated: input.validated, actorOpenId: ctx.user.openId });
      return { ok: true, validated: input.validated };
    }),

  setFutureMarketApproval: adminProcedure
    .input(z.object({ slug: z.enum(futureSlugs), approved: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const baseSet = await getMarketBySlug(baseSetSlug);
      if (!baseSet?.baseSetValidated && input.approved) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Validate the Base Set testnet market before unlocking a future mainnet market.",
        });
      }
      const market = await getMarketBySlug(input.slug);
      if (!market) throw new TRPCError({ code: "NOT_FOUND", message: "Future market not found." });
      await setFutureMarketApproval({ marketId: market.id, approved: input.approved, actorOpenId: ctx.user.openId });
      return { ok: true, slug: input.slug, approved: input.approved };
    }),

  updateBaseSetContract: adminProcedure
    .input(
      z.object({
        liquidityPoolAddress: secretSafeAddress,
        marketAddress: secretSafeAddress,
        oracleAddress: secretSafeAddress,
        abi: z.array(z.record(z.string(), z.unknown())).min(1).max(100).optional(),
        isConfigured: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const market = await getMarketBySlug(baseSetSlug);
      if (!market) throw new TRPCError({ code: "NOT_FOUND", message: "Base Set market not found." });
      if (input.isConfigured && (!input.liquidityPoolAddress || !input.abi)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A configured testnet market needs a liquidity-pool address and ABI.",
        });
      }
      await updateContractConfiguration({
        marketId: market.id,
        liquidityPoolAddress: input.liquidityPoolAddress,
        marketAddress: input.marketAddress,
        oracleAddress: input.oracleAddress,
        abiJson: input.abi ? JSON.stringify(input.abi) : undefined,
        isConfigured: input.isConfigured,
      });
      await recordAuditEvent({
        marketId: market.id,
        actorOpenId: ctx.user.openId,
        action: "testnet_contract_configuration_updated",
        detail: JSON.stringify({
          liquidityPoolAddress: input.liquidityPoolAddress,
          marketAddress: input.marketAddress,
          oracleAddress: input.oracleAddress,
          isConfigured: input.isConfigured,
        }),
      });
      return { ok: true };
    }),

  updateBaseSetOracleSettings: adminProcedure
    .input(oracleSettingsInput)
    .mutation(async ({ input, ctx }) => {
      const market = await getMarketBySlug(baseSetSlug);
      if (!market) throw new TRPCError({ code: "NOT_FOUND", message: "Base Set market not found." });
      const cron = managedOracleCron(input.oracleIntervalMinutes);
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (market.scheduleCronTaskUid) {
        if (!sessionToken) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "A valid owner session is required to update an active schedule." });
        }
        await updateHeartbeatJob(
          market.scheduleCronTaskUid,
          {
            cron,
            path: "/api/scheduled/base-set-oracle",
            method: "POST",
            payload: { marketSlug: baseSetSlug },
            description: "Base Set testnet pricing, index, and contribution reconciliation",
            enable: true,
          },
          sessionToken
        );
      }
      await updateOracleSettings({ marketId: market.id, ...input });
      await recordAuditEvent({
        marketId: market.id,
        actorOpenId: ctx.user.openId,
        action: "base_set_oracle_settings_updated",
        detail: JSON.stringify({ ...input, cron, scheduleUpdated: Boolean(market.scheduleCronTaskUid) }),
      });
      return { ok: true, ...input, cron, scheduleUpdated: Boolean(market.scheduleCronTaskUid) };
    }),

  configureBaseSetSchedule: adminProcedure.mutation(async ({ ctx }) => {
    if (!ENV.isProduction) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Publish the site before activating the managed oracle schedule.",
      });
    }
    const market = await getMarketBySlug(baseSetSlug);
    if (!market) throw new TRPCError({ code: "NOT_FOUND", message: "Base Set market not found." });
    if (!isSupportedOracleIntervalMinutes(market.oracleIntervalMinutes)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Select a supported Base Set update interval before activation." });
    }
    const cron = managedOracleCron(market.oracleIntervalMinutes);
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    if (!sessionToken) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "A valid owner session is required to schedule updates." });
    }

    if (market.scheduleCronTaskUid) {
      await updateHeartbeatJob(
        market.scheduleCronTaskUid,
        {
          cron,
          path: "/api/scheduled/base-set-oracle",
          method: "POST",
          payload: { marketSlug: baseSetSlug },
          description: "Base Set testnet pricing, index, and contribution reconciliation",
          enable: true,
        },
        sessionToken
      );
    } else {
      const job = await createHeartbeatJob(
        {
          name: "pokedex-base-set-testnet-oracle",
          cron,
          path: "/api/scheduled/base-set-oracle",
          method: "POST",
          payload: { marketSlug: baseSetSlug },
          description: "Base Set testnet pricing, index, and contribution reconciliation",
        },
        sessionToken
      );
      await setMarketScheduleTaskUid(market.id, job.taskUid);
    }
    await recordAuditEvent({
      marketId: market.id,
      actorOpenId: ctx.user.openId,
      action: "base_set_oracle_schedule_configured",
      detail: JSON.stringify({ cron, oracleIntervalMinutes: market.oracleIntervalMinutes }),
    });
    return { ok: true, cron };
  }),
});
