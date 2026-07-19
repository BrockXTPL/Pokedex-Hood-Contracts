import { ethers } from "hardhat";

const requiredForTestnet = ["DEPLOYER_PRIVATE_KEY"] as const;
const optionalAddresses = ["ADMIN_ADDRESS", "TREASURY_ADDRESS", "ORACLE_ADDRESS"] as const;

function fail(message: string): never {
  console.error(`Environment validation failed: ${message}`);
  process.exit(1);
}

for (const key of requiredForTestnet) {
  const value = process.env[key]?.trim();
  if (!value) fail(`${key} is required for a public testnet deployment.`);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) fail(`${key} must be a 32-byte 0x-prefixed private key.`);
}

for (const key of optionalAddresses) {
  const value = process.env[key]?.trim();
  if (value && !ethers.isAddress(value)) fail(`${key} must be a valid EVM address when supplied.`);
}

const cap = process.env.BASE_SET_MAX_CONTRIBUTION_ETH ?? "0.05";
try {
  if (ethers.parseEther(cap) <= 0n) fail("BASE_SET_MAX_CONTRIBUTION_ETH must be greater than zero.");
} catch {
  fail("BASE_SET_MAX_CONTRIBUTION_ETH must be a decimal native-token value.");
}

const components = Number(process.env.BASE_SET_EXPECTED_COMPONENTS ?? "16");
if (!Number.isInteger(components) || components <= 0 || components > 65_535) {
  fail("BASE_SET_EXPECTED_COMPONENTS must be an integer from 1 to 65535.");
}

console.log("Environment validation passed.");
console.log(`Network target: ${process.env.ROBINHOOD_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com"}`);
console.log(`Contribution cap: ${cap}`);
console.log(`Expected components: ${components}`);
