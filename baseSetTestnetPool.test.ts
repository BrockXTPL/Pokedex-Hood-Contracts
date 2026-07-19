import { describe, expect, it } from "vitest";
import {
  BASE_SET_TESTNET_POOL_TEMPLATE_VERSION,
  baseSetTestnetPoolTemplate,
} from "./baseSetTestnetPool";

describe("Base Set testnet pool template", () => {
  it("exposes only the approved testnet contribution interface", () => {
    expect(baseSetTestnetPoolTemplate.version).toBe(BASE_SET_TESTNET_POOL_TEMPLATE_VERSION);
    expect(baseSetTestnetPoolTemplate.auditStatus).toBe("unaudited_testnet_only");
    expect(baseSetTestnetPoolTemplate.abi).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "function",
          name: "contribute",
          stateMutability: "payable",
        }),
        expect.objectContaining({
          type: "event",
          name: "ContributionReceived",
        }),
      ]),
    );
  });
});
