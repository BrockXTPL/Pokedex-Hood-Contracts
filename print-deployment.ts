import { deployments, ethers, network } from "hardhat";

async function main() {
  const [pool, evidence, registry] = await Promise.all([
    deployments.getOrNull("BaseSetTestnetLiquidityPool"),
    deployments.getOrNull("BaseSetPriceEvidenceRegistry"),
    deployments.getOrNull("PokedexMarketRegistry"),
  ]);

  if (!pool || !evidence || !registry) {
    throw new Error("No complete Base Set deployment record was found for this network.");
  }

  const poolContract = await ethers.getContractAt("BaseSetTestnetLiquidityPool", pool.address);
  const evidenceContract = await ethers.getContractAt("BaseSetPriceEvidenceRegistry", evidence.address);
  const registryContract = await ethers.getContractAt("PokedexMarketRegistry", registry.address);

  const [poolStatus, expectedComponents, market] = await Promise.all([
    poolContract.contributionStatus(),
    evidenceContract.expectedComponentCount(),
    registryContract.baseSetMarket(),
  ]);

  const report = {
    network: network.name,
    chainId: network.config.chainId ?? null,
    pool: pool.address,
    evidenceRegistry: evidence.address,
    marketRegistry: registry.address,
    poolStatus: {
      marketKey: poolStatus.marketKey,
      version: poolStatus.version,
      treasury: poolStatus.currentTreasury,
      maxContributionWei: poolStatus.capWei.toString(),
      maxContributionNative: ethers.formatEther(poolStatus.capWei),
      totalContributedWei: poolStatus.receivedWei.toString(),
      contributionCount: poolStatus.receivedCount.toString(),
      paused: poolStatus.isPaused,
    },
    evidenceStatus: {
      expectedComponentCount: expectedComponents.toString(),
      livePriceFieldHash: await evidenceContract.livePriceFieldHash(),
      archivePriceFieldHash: await evidenceContract.archivePriceFieldHash(),
    },
    marketLifecycle: Number(market.lifecycle),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
