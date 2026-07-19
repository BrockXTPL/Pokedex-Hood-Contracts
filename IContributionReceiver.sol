// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IContributionReceiver
/// @notice Compatibility interface consumed by the Pokedex public application.
interface IContributionReceiver {
    /// @notice Emitted after a native-token contribution is accepted.
    /// @param contributor Address that supplied the native token.
    /// @param amount Amount received, denominated in wei.
    event ContributionReceived(address indexed contributor, uint256 amount);

    /// @notice Contributes native testnet funds to the configured Base Set pool.
    function contribute() external payable;
}
