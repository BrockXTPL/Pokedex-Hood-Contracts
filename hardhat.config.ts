import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "solidity-coverage";
import * as dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 500 },
      viaIR: true,
      metadata: { bytecodeHash: "none" },
    },
  },
  namedAccounts: {
    deployer: { default: 0 },
    admin: { default: 0 },
    treasury: { default: 1 },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,
    },
    robinhoodTestnet: {
      url: process.env.ROBINHOOD_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com",
      chainId: 46630,
      accounts,
      timeout: 60_000,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
    deployments: "./deployments",
  },
  mocha: {
    timeout: 90_000,
  },
};

export default config;
