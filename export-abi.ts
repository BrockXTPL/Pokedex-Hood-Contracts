import { artifacts } from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const artifact = await artifacts.readArtifact("BaseSetTestnetLiquidityPool");
  const appCompatibilityAbi = artifact.abi.filter((item) => {
    if (item.type === "function") return item.name === "contribute";
    if (item.type === "event") return item.name === "ContributionReceived";
    return false;
  });

  const outputDirectory = resolve(process.cwd(), "exports");
  await mkdir(outputDirectory, { recursive: true });

  await writeFile(
    resolve(outputDirectory, "base-set-testnet-pool.app-abi.json"),
    `${JSON.stringify(appCompatibilityAbi, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(outputDirectory, "base-set-testnet-pool.full-abi.json"),
    `${JSON.stringify(artifact.abi, null, 2)}\n`,
    "utf8",
  );

  console.log(`Exported ${appCompatibilityAbi.length} app-compatible ABI items and the full pool ABI to ${outputDirectory}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
