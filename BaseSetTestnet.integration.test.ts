import { expect } from "chai";
import { ethers } from "hardhat";

describe("Base Set testnet module integration", function () {
  it("deploys, configures, activates, receives a contribution, and anchors price evidence", async function () {
    const [admin, treasury, oracle, contributor] = await ethers.getSigners();
    const contributionCap = ethers.parseEther("0.05");
    const liveFieldHash = ethers.id("tcgdex:v2|tcgplayer.holofoil.marketPrice|usd");
    const archiveFieldHash = ethers.id("tcgdex:price-history|tcgplayer.holo-good|usd|archival-proxy");

    const pool = await (
      await ethers.getContractFactory("BaseSetTestnetLiquidityPool")
    ).deploy(admin.address, treasury.address, contributionCap);
    const evidence = await (
      await ethers.getContractFactory("BaseSetPriceEvidenceRegistry")
    ).deploy(admin.address, oracle.address, 16, liveFieldHash, archiveFieldHash);
    const marketRegistry = await (
      await ethers.getContractFactory("PokedexMarketRegistry")
    ).deploy(admin.address, admin.address);

    const methodologyDigest = ethers.id("pokedex-base-set-methodology-v1");
    const documentationDigest = ethers.id("pokedex-base-set-contracts-v1");
    await marketRegistry.configureBaseSetMarket(
      await pool.getAddress(),
      await evidence.getAddress(),
      methodologyDigest,
      documentationDigest,
    );
    await expect(marketRegistry.activateBaseSetMarket()).to.emit(marketRegistry, "MarketActivated");

    const contribution = ethers.parseEther("0.02");
    await expect(pool.connect(contributor).contribute({ value: contribution }))
      .to.emit(pool, "ContributionReceived")
      .withArgs(contributor.address, contribution);

    const snapshotId = ethers.id("BASE_SET_HOLOFOIL_V1:2026-07-18T00:00:00Z");
    const componentDigest = ethers.id("base-set-components:2026-07-18");
    const sourceDigest = ethers.id("tcgdex-response:2026-07-18");
    const evidenceDigest = ethers.id("pokedex-evidence-bundle:2026-07-18");
    await expect(
      evidence
        .connect(oracle)
        .recordSnapshot(
          snapshotId,
          1_784_390_400,
          1_784_390_300,
          177_824,
          15,
          16,
          componentDigest,
          sourceDigest,
          evidenceDigest,
        ),
    )
      .to.emit(evidence, "SnapshotRecorded")
      .withArgs(snapshotId, 1_784_390_400, 177_824, 15, 16, componentDigest, sourceDigest, evidenceDigest, oracle.address);

    const market = await marketRegistry.baseSetMarket();
    expect(market.contributionPool).to.equal(await pool.getAddress());
    expect(market.priceEvidenceRegistry).to.equal(await evidence.getAddress());
    expect(market.lifecycle).to.equal(2n);
    expect(await pool.totalContributed()).to.equal(contribution);
    expect(await evidence.snapshotExists(snapshotId)).to.equal(true);
    expect((await evidence.getSnapshot(snapshotId)).liveSubtotalUsdCents).to.equal(177_824n);
  });
});
