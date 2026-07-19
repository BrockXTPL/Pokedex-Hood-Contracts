import { expect } from "chai";
import { ethers } from "hardhat";

describe("BaseSetPriceEvidenceRegistry", function () {
  const expectedComponents = 16;
  const liveFieldHash = ethers.id("tcgdex:v2|tcgplayer.holofoil.marketPrice|usd");
  const archiveFieldHash = ethers.id("tcgdex:price-history|tcgplayer.holo-good|usd|archival-proxy");

  async function deployRegistry() {
    const [admin, oracle, outsider] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("BaseSetPriceEvidenceRegistry");
    const registry = await factory.deploy(admin.address, oracle.address, expectedComponents, liveFieldHash, archiveFieldHash);
    return { registry, admin, oracle, outsider };
  }

  function snapshotInput(label = "2026-07-18") {
    return {
      snapshotId: ethers.id(`BASE_SET_HOLOFOIL_V1:${label}`),
      observedAt: 1_784_390_400,
      providerUpdatedAt: 1_784_390_300,
      liveSubtotalUsdCents: 177_824,
      pricedComponentCount: 15,
      configuredComponentCount: expectedComponents,
      componentDigest: ethers.id(`components:${label}`),
      sourceDigest: ethers.id(`source:${label}`),
      evidenceDigest: ethers.id(`evidence:${label}`),
    };
  }

  it("records a complete snapshot through the oracle and exposes its immutable fields", async function () {
    const { registry, oracle } = await deployRegistry();
    const input = snapshotInput();

    await expect(
      registry
        .connect(oracle)
        .recordSnapshot(
          input.snapshotId,
          input.observedAt,
          input.providerUpdatedAt,
          input.liveSubtotalUsdCents,
          input.pricedComponentCount,
          input.configuredComponentCount,
          input.componentDigest,
          input.sourceDigest,
          input.evidenceDigest,
        ),
    )
      .to.emit(registry, "SnapshotRecorded")
      .withArgs(
        input.snapshotId,
        input.observedAt,
        input.liveSubtotalUsdCents,
        input.pricedComponentCount,
        input.configuredComponentCount,
        input.componentDigest,
        input.sourceDigest,
        input.evidenceDigest,
        oracle.address,
      );

    expect(await registry.snapshotExists(input.snapshotId)).to.equal(true);
    const stored = await registry.getSnapshot(input.snapshotId);
    expect(stored.observedAt).to.equal(input.observedAt);
    expect(stored.providerUpdatedAt).to.equal(input.providerUpdatedAt);
    expect(stored.liveSubtotalUsdCents).to.equal(input.liveSubtotalUsdCents);
    expect(stored.pricedComponentCount).to.equal(input.pricedComponentCount);
    expect(stored.configuredComponentCount).to.equal(input.configuredComponentCount);
    expect(stored.componentDigest).to.equal(input.componentDigest);
    expect(stored.sourceDigest).to.equal(input.sourceDigest);
    expect(stored.evidenceDigest).to.equal(input.evidenceDigest);
  });

  it("enforces the dedicated oracle role for evidence recording", async function () {
    const { registry, oracle, outsider } = await deployRegistry();
    const input = snapshotInput();
    const oracleRole = await registry.ORACLE_ROLE();

    await expect(
      registry
        .connect(outsider)
        .recordSnapshot(
          input.snapshotId,
          input.observedAt,
          input.providerUpdatedAt,
          input.liveSubtotalUsdCents,
          input.pricedComponentCount,
          input.configuredComponentCount,
          input.componentDigest,
          input.sourceDigest,
          input.evidenceDigest,
        ),
    )
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
      .withArgs(outsider.address, oracleRole);

    await registry.grantRole(oracleRole, outsider.address);
    await expect(
      registry
        .connect(outsider)
        .recordSnapshot(
          input.snapshotId,
          input.observedAt,
          input.providerUpdatedAt,
          input.liveSubtotalUsdCents,
          input.pricedComponentCount,
          input.configuredComponentCount,
          input.componentDigest,
          input.sourceDigest,
          input.evidenceDigest,
        ),
    ).to.emit(registry, "SnapshotRecorded");

    expect(await registry.hasRole(oracleRole, oracle.address)).to.equal(true);
  });

  it("rejects duplicate snapshot identifiers and preserves the original immutable snapshot", async function () {
    const { registry, oracle } = await deployRegistry();
    const input = snapshotInput();

    await registry
      .connect(oracle)
      .recordSnapshot(
        input.snapshotId,
        input.observedAt,
        input.providerUpdatedAt,
        input.liveSubtotalUsdCents,
        input.pricedComponentCount,
        input.configuredComponentCount,
        input.componentDigest,
        input.sourceDigest,
        input.evidenceDigest,
      );

    await expect(
      registry
        .connect(oracle)
        .recordSnapshot(
          input.snapshotId,
          input.observedAt + 1,
          input.providerUpdatedAt + 1,
          input.liveSubtotalUsdCents + 1,
          input.pricedComponentCount,
          input.configuredComponentCount,
          ethers.id("replacement-components"),
          ethers.id("replacement-source"),
          ethers.id("replacement-evidence"),
        ),
    )
      .to.be.revertedWithCustomError(registry, "DuplicateSnapshot")
      .withArgs(input.snapshotId);

    const stored = await registry.getSnapshot(input.snapshotId);
    expect(stored.observedAt).to.equal(input.observedAt);
    expect(stored.liveSubtotalUsdCents).to.equal(input.liveSubtotalUsdCents);
    expect(stored.evidenceDigest).to.equal(input.evidenceDigest);
  });

  it("validates timestamps and exact component-count semantics", async function () {
    const { registry, oracle } = await deployRegistry();
    const input = snapshotInput();

    await expect(
      registry
        .connect(oracle)
        .recordSnapshot(
          input.snapshotId,
          0,
          input.providerUpdatedAt,
          input.liveSubtotalUsdCents,
          input.pricedComponentCount,
          input.configuredComponentCount,
          input.componentDigest,
          input.sourceDigest,
          input.evidenceDigest,
        ),
    ).to.be.revertedWithCustomError(registry, "InvalidTimestamp");

    await expect(
      registry
        .connect(oracle)
        .recordSnapshot(
          input.snapshotId,
          input.observedAt,
          input.providerUpdatedAt,
          input.liveSubtotalUsdCents,
          0,
          input.configuredComponentCount,
          input.componentDigest,
          input.sourceDigest,
          input.evidenceDigest,
        ),
    )
      .to.be.revertedWithCustomError(registry, "InvalidComponentCounts")
      .withArgs(0, expectedComponents, expectedComponents);

    await expect(
      registry
        .connect(oracle)
        .recordSnapshot(
          input.snapshotId,
          input.observedAt,
          input.providerUpdatedAt,
          input.liveSubtotalUsdCents,
          16,
          15,
          input.componentDigest,
          input.sourceDigest,
          input.evidenceDigest,
        ),
    )
      .to.be.revertedWithCustomError(registry, "InvalidComponentCounts")
      .withArgs(16, 15, expectedComponents);
  });

  it("allows only the admin to revise future metadata and pauses new records without mutating stored evidence", async function () {
    const { registry, admin, oracle, outsider } = await deployRegistry();
    const input = snapshotInput();
    await registry
      .connect(oracle)
      .recordSnapshot(
        input.snapshotId,
        input.observedAt,
        input.providerUpdatedAt,
        input.liveSubtotalUsdCents,
        input.pricedComponentCount,
        input.configuredComponentCount,
        input.componentDigest,
        input.sourceDigest,
        input.evidenceDigest,
      );

    await expect(registry.connect(outsider).setExpectedComponentCount(15)).to.be.revertedWithCustomError(
      registry,
      "AccessControlUnauthorizedAccount",
    );
    await registry.connect(admin).setExpectedComponentCount(15);
    await registry.connect(admin).setPriceFieldHashes(ethers.id("next-live"), ethers.id("next-archive"));
    await registry.connect(admin).pause();

    expect((await registry.getSnapshot(input.snapshotId)).evidenceDigest).to.equal(input.evidenceDigest);
    expect(await registry.expectedComponentCount()).to.equal(15n);
    await expect(
      registry
        .connect(oracle)
        .recordSnapshot(
          ethers.id("paused-snapshot"),
          input.observedAt,
          input.providerUpdatedAt,
          input.liveSubtotalUsdCents,
          15,
          15,
          input.componentDigest,
          input.sourceDigest,
          input.evidenceDigest,
        ),
    ).to.be.revertedWithCustomError(registry, "EnforcedPause");
  });
});
