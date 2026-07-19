export const BASE_SET_TESTNET_POOL_TEMPLATE_VERSION = "1.0.0";

/**
 * A minimal interface for the unaudited, testnet-only contribution receiver.
 * It is deliberately defined server-side and only released through approved
 * market configuration APIs; no client bundle imports this module directly.
 */
export const baseSetTestnetPoolAbi = [
  {
    type: "function",
    name: "contribute",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "event",
    name: "ContributionReceived",
    anonymous: false,
    inputs: [
      { indexed: true, name: "contributor", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;

export const baseSetTestnetPoolTemplate = {
  version: BASE_SET_TESTNET_POOL_TEMPLATE_VERSION,
  contractName: "BaseSetTestnetLiquidityPool",
  network: "Robinhood Chain testnet",
  intendedUse: "Testnet-only contribution receipt validation for the Base Set proof.",
  auditStatus: "unaudited_testnet_only",
  abi: baseSetTestnetPoolAbi,
} as const;
