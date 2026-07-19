import type { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const DEFAULT_LIVE_FIELD = "tcgdex:v2|tcgplayer.holofoil.marketPrice|usd";
const DEFAULT_ARCHIVE_FIELD = "tcgdex:price-history|tcgplayer.holo-good|usd|archival-proxy";

function addressFromEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && ethers.isAddress(value) ? ethers.getAddress(value) : ethers.getAddress(fallback);
}

function digestFromEnv(name: string, fallbackText: string): string {
  const value = process.env[name]?.trim();
  if (value && /^0x[0-9a-fA-F]{64}$/.test(value)) return value;
  return ethers.keccak256(ethers.toUtf8Bytes(fallbackText));
}

const deployBaseSetTestnet: DeployFunction = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const named = await getNamedAccounts();

  const deployer = ethers.getAddress(named.deployer);
  const admin = addressFromEnv("ADMIN_ADDRESS", named.admin ?? deployer);
  const treasury = addressFromEnv("TREASURY_ADDRESS", named.treasury ?? deployer);
  const oracle = addressFromEnv("ORACLE_ADDRESS", deployer);
  const contributionCap = ethers.parseEther(process.env.BASE_SET_MAX_CONTRIBUTION_ETH ?? "0.05");
  const expectedComponents = Number(process.env.BASE_SET_EXPECTED_COMPONENTS ?? "16");

  if (!Number.isInteger(expectedComponents) || expectedComponents <= 0 || expectedComponents > 65_535) {
    throw new Error("BASE_SET_EXPECTED_COMPONENTS must be an integer between 1 and 65535.");
  }
  if (contributionCap <= 0n) throw new Error("BASE_SET_MAX_CONTRIBUTION_ETH must be greater than zero.");

  const liveFieldHash = digestFromEnv("BASE_SET_LIVE_FIELD_DIGEST", DEFAULT_LIVE_FIELD);
  const archiveFieldHash = digestFromEnv("BASE_SET_ARCHIVE_FIELD_DIGEST", DEFAULT_ARCHIVE_FIELD);
  const methodologyDigest = digestFromEnv("BASE_SET_METHODOLOGY_DIGEST", "pokedex-base-set-methodology-v1");
  const documentationDigest = digestFromEnv("BASE_SET_DOCUMENTATION_DIGEST", "pokedex-base-set-contracts-v1");

  const pool = await deploy("BaseSetTestnetLiquidityPool", {
    from: deployer,
    args: [admin, treasury, contributionCap],
    log: true,
    deterministicDeployment: false,
  });

  const evidence = await deploy("BaseSetPriceEvidenceRegistry", {
    from: deployer,
    args: [admin, oracle, expectedComponents, liveFieldHash, archiveFieldHash],
    log: true,
    deterministicDeployment: false,
  });

  const marketRegistry = await deploy("PokedexMarketRegistry", {
    from: deployer,
    args: [admin, admin],
    log: true,
    deterministicDeployment: false,
  });

  const registry = await ethers.getContractAt("PokedexMarketRegistry", marketRegistry.address);
  const market = await registry.baseSetMarket();
  const lifecycle = Number(market.lifecycle);

  if (lifecycle === 0 || lifecycle === 1) {
    if (lifecycle === 0) {
      const configureTx = await registry.configureBaseSetMarket(
        pool.address,
        evidence.address,
        methodologyDigest,
        documentationDigest,
      );
      await configureTx.wait();
      log(`Configured Base Set registry in tx ${configureTx.hash}`);
    }

    const activateTx = await registry.activateBaseSetMarket();
    await activateTx.wait();
    log(`Activated Base Set registry in tx ${activateTx.hash}`);
  } else {
    log(`Base Set registry already has lifecycle ${lifecycle}; no lifecycle mutation was attempted.`);
  }

  log("--- Pokedex Base Set testnet deployment ---");
  log(`Deployer: ${deployer}`);
  log(`Admin: ${admin}`);
  log(`Treasury: ${treasury}`);
  log(`Oracle: ${oracle}`);
  log(`Pool: ${pool.address}`);
  log(`Evidence registry: ${evidence.address}`);
  log(`Market registry: ${marketRegistry.address}`);
  log(`Contribution cap: ${ethers.formatEther(contributionCap)} native testnet token`);
};

deployBaseSetTestnet.tags = ["BaseSetTestnet", "Pokedex"];
export default deployBaseSetTestnet;
