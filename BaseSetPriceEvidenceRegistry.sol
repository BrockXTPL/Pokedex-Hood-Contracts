// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title BaseSetPriceEvidenceRegistry
/// @notice Stores compact, hash-addressed attestations for off-chain Base Set price observations.
/// @dev Raw third-party payloads and card-level pricing should remain off-chain; this contract stores immutable evidence anchors.
contract BaseSetPriceEvidenceRegistry is AccessControl, Pausable {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    string public constant MARKET_KEY = "BASE_SET_HOLOFOIL_V1";
    string public constant VERSION = "1.0.0-testnet";

    uint16 public expectedComponentCount;
    bytes32 public livePriceFieldHash;
    bytes32 public archivePriceFieldHash;

    struct Snapshot {
        uint64 observedAt;
        uint64 providerUpdatedAt;
        uint64 liveSubtotalUsdCents;
        uint16 pricedComponentCount;
        uint16 configuredComponentCount;
        bytes32 componentDigest;
        bytes32 sourceDigest;
        bytes32 evidenceDigest;
    }

    mapping(bytes32 snapshotId => Snapshot snapshot) private _snapshots;
    mapping(bytes32 snapshotId => bool recorded) public snapshotExists;

    event SnapshotRecorded(
        bytes32 indexed snapshotId,
        uint64 indexed observedAt,
        uint64 liveSubtotalUsdCents,
        uint16 pricedComponentCount,
        uint16 configuredComponentCount,
        bytes32 componentDigest,
        bytes32 sourceDigest,
        bytes32 evidenceDigest,
        address indexed actor
    );
    event ExpectedComponentCountUpdated(uint16 previousCount, uint16 nextCount, address indexed actor);
    event PriceFieldHashesUpdated(bytes32 liveHash, bytes32 archiveHash, address indexed actor);
    event RegistryPaused(address indexed actor);
    event RegistryUnpaused(address indexed actor);

    error ZeroAddress();
    error InvalidComponentCounts(uint16 priced, uint16 configured, uint16 expected);
    error InvalidTimestamp();
    error DuplicateSnapshot(bytes32 snapshotId);

    /// @param admin Administrative account responsible for role rotation and configuration.
    /// @param initialOracle Operational account permitted to record evidence snapshots.
    /// @param initialExpectedComponentCount Expected live basket size, initially 16 holofoil cards.
    /// @param initialLivePriceFieldHash Hash of the accepted live price-field descriptor.
    /// @param initialArchivePriceFieldHash Hash of the separately-labelled archive price-field descriptor.
    constructor(
        address admin,
        address initialOracle,
        uint16 initialExpectedComponentCount,
        bytes32 initialLivePriceFieldHash,
        bytes32 initialArchivePriceFieldHash
    ) {
        if (admin == address(0) || initialOracle == address(0)) revert ZeroAddress();
        if (initialExpectedComponentCount == 0) {
            revert InvalidComponentCounts(0, 0, initialExpectedComponentCount);
        }

        expectedComponentCount = initialExpectedComponentCount;
        livePriceFieldHash = initialLivePriceFieldHash;
        archivePriceFieldHash = initialArchivePriceFieldHash;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, initialOracle);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Records one immutable, hash-addressed price observation.
    /// @dev `snapshotId` should be deterministic off-chain, for example keccak256 of market, timestamp, and evidence digest.
    function recordSnapshot(
        bytes32 snapshotId,
        uint64 observedAt,
        uint64 providerUpdatedAt,
        uint64 liveSubtotalUsdCents,
        uint16 pricedComponentCount,
        uint16 configuredComponentCount,
        bytes32 componentDigest,
        bytes32 sourceDigest,
        bytes32 evidenceDigest
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        if (snapshotExists[snapshotId]) revert DuplicateSnapshot(snapshotId);
        if (observedAt == 0 || providerUpdatedAt == 0) revert InvalidTimestamp();
        if (
            configuredComponentCount != expectedComponentCount || pricedComponentCount == 0
                || pricedComponentCount > configuredComponentCount
        ) {
            revert InvalidComponentCounts(pricedComponentCount, configuredComponentCount, expectedComponentCount);
        }

        _snapshots[snapshotId] = Snapshot({
            observedAt: observedAt,
            providerUpdatedAt: providerUpdatedAt,
            liveSubtotalUsdCents: liveSubtotalUsdCents,
            pricedComponentCount: pricedComponentCount,
            configuredComponentCount: configuredComponentCount,
            componentDigest: componentDigest,
            sourceDigest: sourceDigest,
            evidenceDigest: evidenceDigest
        });
        snapshotExists[snapshotId] = true;

        emit SnapshotRecorded(
            snapshotId,
            observedAt,
            liveSubtotalUsdCents,
            pricedComponentCount,
            configuredComponentCount,
            componentDigest,
            sourceDigest,
            evidenceDigest,
            msg.sender
        );
    }

    /// @notice Retrieves an evidence snapshot without exposing any mutable internal state.
    function getSnapshot(bytes32 snapshotId) external view returns (Snapshot memory) {
        return _snapshots[snapshotId];
    }

    /// @notice Updates the expected live-basket size after an explicit methodology revision.
    function setExpectedComponentCount(uint16 nextCount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (nextCount == 0) revert InvalidComponentCounts(0, 0, nextCount);
        uint16 previousCount = expectedComponentCount;
        expectedComponentCount = nextCount;
        emit ExpectedComponentCountUpdated(previousCount, nextCount, msg.sender);
    }

    /// @notice Updates hashes that describe accepted live and archival price-field semantics.
    function setPriceFieldHashes(bytes32 nextLiveHash, bytes32 nextArchiveHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        livePriceFieldHash = nextLiveHash;
        archivePriceFieldHash = nextArchiveHash;
        emit PriceFieldHashesUpdated(nextLiveHash, nextArchiveHash, msg.sender);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit RegistryPaused(msg.sender);
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit RegistryUnpaused(msg.sender);
    }
}
