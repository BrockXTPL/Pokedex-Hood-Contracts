import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ethers } from "hardhat";

describe("PokedexMarketRegistry", function () {
  async function deployRegistry() {
    const [admin, operator, contributionPool, priceEvidenceRegistry, outsider] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PokedexMarketRegistry");
    const registry = await factory.deploy(admin.address, operator.address);
    return { registry, admin, operator, contributionPool, priceEvidenceRegistry, outsider };
  }

  function digests() {
    return {
      methodologyDigest: ethers.id("pokedex-base-set-methodology-v1"),
      documentationDigest: ethers.id("pokedex-base-set-contracts-v1"),
    };
  }

  it("binds contribution and evidence modules under the stable Base Set market identifier", async function () {
    const { registry, operator, contributionPool, priceEvidenceRegistry } = await deployRegistry();
    const { methodologyDigest, documentationDigest } = digests();
    const marketId = await registry.BASE_SET_MARKET_ID();

    await expect(
      registry
        .connect(operator)
        .configureBaseSetMarket(contributionPool.address, priceEvidenceRegistry.address, methodologyDigest, documentationDigest),
    )
      .to.emit(registry, "MarketConfigured")
      .withArgs(
        marketId,
        contributionPool.address,
        priceEvidenceRegistry.address,
        methodologyDigest,
        documentationDigest,
        operator.address,
      );

    const market = await registry.baseSetMarket();
    expect(market.contributionPool).to.equal(contributionPool.address);
    expect(market.priceEvidenceRegistry).to.equal(priceEvidenceRegistry.address);
    expect(market.methodologyDigest).to.equal(methodologyDigest);
    expect(market.documentationDigest).to.equal(documentationDigest);
    expect(market.configuredAt).to.be.greaterThan(0n);
    expect(market.activatedAt).to.equal(0n);
    expect(market.lifecycle).to.equal(1n);
  });

  it("requires the operator role to configure and activate the catalogue entry", async function () {
    const { registry, operator, contributionPool, priceEvidenceRegistry, outsider } = await deployRegistry();
    const { methodologyDigest, documentationDigest } = digests();
    const operatorRole = await registry.OPERATOR_ROLE();

    await expect(
      registry
        .connect(outsider)
        .configureBaseSetMarket(contributionPool.address, priceEvidenceRegistry.address, methodologyDigest, documentationDigest),
    )
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
      .withArgs(outsider.address, operatorRole);

    await expect(registry.connect(outsider).activateBaseSetMarket())
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
      .withArgs(outsider.address, operatorRole);

    await registry
      .connect(operator)
      .configureBaseSetMarket(contributionPool.address, priceEvidenceRegistry.address, methodologyDigest, documentationDigest);
    await expect(registry.connect(operator).activateBaseSetMarket()).to.emit(registry, "MarketActivated");
  });

  it("allows activation only after configuration and prevents dependency rewrites after activation", async function () {
    const { registry, operator, contributionPool, priceEvidenceRegistry, outsider } = await deployRegistry();
    const { methodologyDigest, documentationDigest } = digests();
    const marketId = await registry.BASE_SET_MARKET_ID();

    await expect(registry.connect(operator).activateBaseSetMarket())
      .to.be.revertedWithCustomError(registry, "InvalidLifecycleTransition")
      .withArgs(0, 2);

    await registry
      .connect(operator)
      .configureBaseSetMarket(contributionPool.address, priceEvidenceRegistry.address, methodologyDigest, documentationDigest);
    await expect(registry.connect(operator).activateBaseSetMarket())
      .to.emit(registry, "MarketActivated")
      .withArgs(marketId, operator.address, anyValue);

    await expect(
      registry.connect(operator).configureBaseSetMarket(outsider.address, priceEvidenceRegistry.address, methodologyDigest, documentationDigest),
    )
      .to.be.revertedWithCustomError(registry, "MarketAlreadyActivated")
      .withArgs(marketId);

    const market = await registry.baseSetMarket();
    expect(market.lifecycle).to.equal(2n);
    expect(market.activatedAt).to.be.greaterThan(0n);
  });

  it("rejects zero dependency addresses and supports the documented pause boundary", async function () {
    const { registry, admin, operator, contributionPool, priceEvidenceRegistry, outsider } = await deployRegistry();
    const { methodologyDigest, documentationDigest } = digests();

    await expect(
      registry
        .connect(operator)
        .configureBaseSetMarket(ethers.ZeroAddress, priceEvidenceRegistry.address, methodologyDigest, documentationDigest),
    ).to.be.revertedWithCustomError(registry, "ZeroAddress");

    await registry
      .connect(operator)
      .configureBaseSetMarket(contributionPool.address, priceEvidenceRegistry.address, methodologyDigest, documentationDigest);
    await registry.connect(operator).activateBaseSetMarket();
    await registry.connect(admin).pause();

    expect((await registry.baseSetMarket()).lifecycle).to.equal(3n);
    await expect(
      registry
        .connect(operator)
        .configureBaseSetMarket(outsider.address, priceEvidenceRegistry.address, methodologyDigest, documentationDigest),
    ).to.be.revertedWithCustomError(registry, "EnforcedPause");

    await registry.connect(admin).unpause();
    expect((await registry.baseSetMarket()).lifecycle).to.equal(1n);
  });
});
