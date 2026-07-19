import { expect } from "chai";
import { ethers } from "hardhat";

describe("BaseSetTestnetLiquidityPool", function () {
  const contributionCap = ethers.parseEther("0.05");

  async function deployPool() {
    const [admin, treasury, contributor, other] = await ethers.getSigners();
    const poolFactory = await ethers.getContractFactory("BaseSetTestnetLiquidityPool");
    const pool = await poolFactory.deploy(admin.address, treasury.address, contributionCap);
    return { pool, admin, treasury, contributor, other };
  }

  it("records an app-compatible contribution receipt and per-contributor totals", async function () {
    const { pool, contributor } = await deployPool();
    const amount = ethers.parseEther("0.01");

    await expect(pool.connect(contributor).contribute({ value: amount }))
      .to.emit(pool, "ContributionReceived")
      .withArgs(contributor.address, amount);

    expect(await pool.totalContributed()).to.equal(amount);
    expect(await pool.contributionCount()).to.equal(1n);
    expect(await pool.contributionOf(contributor.address)).to.equal(amount);
    expect(await pool.contributionCountOf(contributor.address)).to.equal(1n);

    const status = await pool.contributionStatus();
    expect(status.marketKey).to.equal("BASE_SET_HOLOFOIL_V1");
    expect(status.version).to.equal("1.0.0-testnet");
    expect(status.capWei).to.equal(contributionCap);
    expect(status.receivedWei).to.equal(amount);
    expect(status.receivedCount).to.equal(1n);
    expect(status.isPaused).to.equal(false);
  });

  it("accepts a direct native-token transfer through receive() and emits the canonical receipt", async function () {
    const { pool, contributor } = await deployPool();
    const amount = ethers.parseEther("0.015");

    await expect(contributor.sendTransaction({ to: await pool.getAddress(), value: amount }))
      .to.emit(pool, "ContributionReceived")
      .withArgs(contributor.address, amount);

    expect(await pool.totalContributed()).to.equal(amount);
    expect(await pool.contributionOf(contributor.address)).to.equal(amount);
    expect(await pool.contributionCount()).to.equal(1n);
  });

  it("rejects zero and above-cap contributions without changing receipt state", async function () {
    const { pool, contributor } = await deployPool();

    await expect(pool.connect(contributor).contribute()).to.be.revertedWithCustomError(pool, "ZeroContribution");
    await expect(pool.connect(contributor).contribute({ value: contributionCap + 1n }))
      .to.be.revertedWithCustomError(pool, "ContributionTooLarge")
      .withArgs(contributionCap + 1n, contributionCap);

    expect(await pool.totalContributed()).to.equal(0n);
    expect(await pool.contributionCount()).to.equal(0n);
  });

  it("pauses and unpauses contributions through the dedicated pauser role", async function () {
    const { pool, admin, contributor, other } = await deployPool();
    const pauserRole = await pool.PAUSER_ROLE();

    await expect(pool.connect(other).pause())
      .to.be.revertedWithCustomError(pool, "AccessControlUnauthorizedAccount")
      .withArgs(other.address, pauserRole);

    await expect(pool.connect(admin).pause()).to.emit(pool, "PoolPaused").withArgs(admin.address);
    await expect(pool.connect(contributor).contribute({ value: 1n })).to.be.revertedWithCustomError(pool, "EnforcedPause");

    await expect(pool.connect(admin).unpause()).to.emit(pool, "PoolUnpaused").withArgs(admin.address);
    await expect(pool.connect(contributor).contribute({ value: 1n }))
      .to.emit(pool, "ContributionReceived")
      .withArgs(contributor.address, 1n);
  });

  it("requires the treasury role and an explicit pause before a withdrawal", async function () {
    const { pool, admin, treasury, contributor, other } = await deployPool();
    const amount = ethers.parseEther("0.02");
    const treasuryRole = await pool.TREASURY_ROLE();
    await pool.connect(contributor).contribute({ value: amount });

    await expect(pool.connect(other).withdrawToTreasury(amount))
      .to.be.revertedWithCustomError(pool, "AccessControlUnauthorizedAccount")
      .withArgs(other.address, treasuryRole);
    await expect(pool.connect(admin).withdrawToTreasury(amount)).to.be.revertedWithCustomError(pool, "ExpectedPause");

    await pool.connect(admin).pause();
    const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
    await expect(pool.connect(admin).withdrawToTreasury(amount))
      .to.emit(pool, "TreasuryWithdrawal")
      .withArgs(treasury.address, amount, admin.address);

    expect(await ethers.provider.getBalance(treasury.address)).to.equal(treasuryBalanceBefore + amount);
    expect(await ethers.provider.getBalance(await pool.getAddress())).to.equal(0n);
  });

  it("rejects a treasury withdrawal when the configured treasury rejects native tokens", async function () {
    const { pool, admin, contributor } = await deployPool();
    const revertingReceiverFactory = await ethers.getContractFactory("RevertingReceiver");
    const revertingReceiver = await revertingReceiverFactory.deploy();
    const amount = ethers.parseEther("0.01");

    await pool.connect(contributor).contribute({ value: amount });
    await pool.connect(admin).setTreasury(await revertingReceiver.getAddress());
    await pool.connect(admin).pause();

    await expect(pool.connect(admin).withdrawToTreasury(amount)).to.be.revertedWithCustomError(pool, "WithdrawalFailed");
    expect(await ethers.provider.getBalance(await pool.getAddress())).to.equal(amount);
  });

  it("keeps administrative, pausing, and treasury permissions explicit", async function () {
    const { pool, admin, treasury, other } = await deployPool();
    const adminRole = await pool.DEFAULT_ADMIN_ROLE();

    await expect(pool.connect(other).setTreasury(other.address))
      .to.be.revertedWithCustomError(pool, "AccessControlUnauthorizedAccount")
      .withArgs(other.address, adminRole);

    await expect(pool.connect(admin).setTreasury(other.address))
      .to.emit(pool, "TreasuryUpdated")
      .withArgs(treasury.address, other.address, admin.address);
    expect(await pool.treasury()).to.equal(other.address);
  });

  it("supports independently assigned treasury and pauser operators without granting administration", async function () {
    const { pool, admin, treasury, contributor, other } = await deployPool();
    const amount = ethers.parseEther("0.01");
    const treasuryRole = await pool.TREASURY_ROLE();
    const pauserRole = await pool.PAUSER_ROLE();
    const adminRole = await pool.DEFAULT_ADMIN_ROLE();

    await pool.connect(admin).grantRole(treasuryRole, treasury.address);
    await pool.connect(admin).grantRole(pauserRole, other.address);
    await pool.connect(contributor).contribute({ value: amount });

    await expect(pool.connect(other).pause()).to.emit(pool, "PoolPaused").withArgs(other.address);
    await expect(pool.connect(treasury).withdrawToTreasury(amount))
      .to.emit(pool, "TreasuryWithdrawal")
      .withArgs(treasury.address, amount, treasury.address);

    await expect(pool.connect(treasury).setTreasury(other.address))
      .to.be.revertedWithCustomError(pool, "AccessControlUnauthorizedAccount")
      .withArgs(treasury.address, adminRole);
    await expect(pool.connect(treasury).unpause())
      .to.be.revertedWithCustomError(pool, "AccessControlUnauthorizedAccount")
      .withArgs(treasury.address, pauserRole);
  });
});
