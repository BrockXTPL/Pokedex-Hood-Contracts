import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type UserRole = NonNullable<TrpcContext["user"]>["role"];

function createContext(role: UserRole | null): TrpcContext {
  return {
    user: role
      ? {
          id: 1,
          openId: `test-${role}`,
          email: `${role}@example.com`,
          name: `${role} tester`,
          loginMethod: "manus",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin market controls", () => {
  it("rejects an unauthenticated caller before any market data is read", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.admin.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a signed-in non-owner from the control room API", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.admin.setBaseSetValidation({ validated: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects a signed-in non-owner from contract-template and contract-configuration controls", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.admin.baseSetContractTemplate()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.admin.updateBaseSetContract({
        liquidityPoolAddress: "0x0000000000000000000000000000000000000001",
        marketAddress: null,
        oracleAddress: null,
        abi: [{ type: "function", name: "contribute", stateMutability: "payable", inputs: [], outputs: [] }],
        isConfigured: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a signed-in non-owner from oracle-setting controls", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(
      caller.admin.updateBaseSetOracleSettings({ oracleIntervalMinutes: 60, maximumOracleAgeMinutes: 180 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an invalid freshness threshold before an owner setting is persisted", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(
      caller.admin.updateBaseSetOracleSettings({ oracleIntervalMinutes: 60, maximumOracleAgeMinutes: 30 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
