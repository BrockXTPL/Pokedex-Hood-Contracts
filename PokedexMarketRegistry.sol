// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title PokedexMarketRegistry
/// @notice Minimal lifecycle registry that binds Pokedex Base Set testnet contracts under a stable market identifier.
/// @dev The registry is an operational catalogue, not a token factory or investment protocol.
contract PokedexMarketRegistry is AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    bytes32 public constant BASE_SET_MARKET_ID = keccak256("POKEDEX:BASE_SET_HOLOFOIL_V1");
    string public constant VERSION = "1.0.0-testnet";

    enum Lifecycle {
        Unconfigured,
        Configured,
        Activated,
        Paused
    }

    struct MarketConfiguration {
        address contributionPool;
        address priceEvidenceRegistry;
        bytes32 methodologyDigest;
        bytes32 documentationDigest;
        uint64 configuredAt;
        uint64 activatedAt;
        Lifecycle lifecycle;
    }

    mapping(bytes32 marketId => MarketConfiguration configuration) private _markets;

    event MarketConfigured(
        bytes32 indexed marketId,
        address indexed contributionPool,
        address indexed priceEvidenceRegistry,
        bytes32 methodologyDigest,
        bytes32 documentationDigest,
        address actor
    );
    event MarketActivated(bytes32 indexed marketId, address indexed actor, uint64 activatedAt);
    event MarketLifecycleUpdated(bytes32 indexed marketId, Lifecycle previousLifecycle, Lifecycle nextLifecycle, address indexed actor);

    error ZeroAddress();
    error MarketAlreadyActivated(bytes32 marketId);
    error MarketNotConfigured(bytes32 marketId);
    error InvalidLifecycleTransition(Lifecycle current, Lifecycle requested);

    constructor(address admin, address initialOperator) {
        if (admin == address(0) || initialOperator == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, initialOperator);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Sets or updates dependencies while the market is configured but not activated.
    function configureBaseSetMarket(
        address contributionPool,
        address priceEvidenceRegistry,
        bytes32 methodologyDigest,
        bytes32 documentationDigest
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (contributionPool == address(0) || priceEvidenceRegistry == address(0)) revert ZeroAddress();

        MarketConfiguration storage market = _markets[BASE_SET_MARKET_ID];
        if (market.lifecycle == Lifecycle.Activated) revert MarketAlreadyActivated(BASE_SET_MARKET_ID);

        Lifecycle previousLifecycle = market.lifecycle;
        market.contributionPool = contributionPool;
        market.priceEvidenceRegistry = priceEvidenceRegistry;
        market.methodologyDigest = methodologyDigest;
        market.documentationDigest = documentationDigest;
        market.configuredAt = uint64(block.timestamp);
        market.lifecycle = Lifecycle.Configured;

        emit MarketConfigured(
            BASE_SET_MARKET_ID,
            contributionPool,
            priceEvidenceRegistry,
            methodologyDigest,
            documentationDigest,
            msg.sender
        );
        emit MarketLifecycleUpdated(BASE_SET_MARKET_ID, previousLifecycle, Lifecycle.Configured, msg.sender);
    }

    /// @notice Finalizes the currently configured dependency addresses for the active testnet proof.
    function activateBaseSetMarket() external onlyRole(OPERATOR_ROLE) whenNotPaused {
        MarketConfiguration storage market = _markets[BASE_SET_MARKET_ID];
        if (market.lifecycle != Lifecycle.Configured) {
            revert InvalidLifecycleTransition(market.lifecycle, Lifecycle.Activated);
        }
        market.lifecycle = Lifecycle.Activated;
        market.activatedAt = uint64(block.timestamp);
        emit MarketActivated(BASE_SET_MARKET_ID, msg.sender, market.activatedAt);
        emit MarketLifecycleUpdated(BASE_SET_MARKET_ID, Lifecycle.Configured, Lifecycle.Activated, msg.sender);
    }

    /// @notice Reads the current Base Set deployment catalogue entry.
    function baseSetMarket() external view returns (MarketConfiguration memory) {
        return _markets[BASE_SET_MARKET_ID];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        MarketConfiguration storage market = _markets[BASE_SET_MARKET_ID];
        if (market.lifecycle == Lifecycle.Configured || market.lifecycle == Lifecycle.Activated) {
            Lifecycle previousLifecycle = market.lifecycle;
            market.lifecycle = Lifecycle.Paused;
            emit MarketLifecycleUpdated(BASE_SET_MARKET_ID, previousLifecycle, Lifecycle.Paused, msg.sender);
        }
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        MarketConfiguration storage market = _markets[BASE_SET_MARKET_ID];
        if (market.lifecycle == Lifecycle.Paused) {
            market.lifecycle = Lifecycle.Configured;
            emit MarketLifecycleUpdated(BASE_SET_MARKET_ID, Lifecycle.Paused, Lifecycle.Configured, msg.sender);
        }
    }
}
