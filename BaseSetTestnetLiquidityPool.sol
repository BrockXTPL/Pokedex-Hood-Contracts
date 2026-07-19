// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BaseSetTestnetLiquidityPool
 * @notice Unreviewed, testnet-only contribution receiver for the Pokemon Index Markets Base Set proof.
 * @dev This contract intentionally has no mainnet deployment configuration and no privileged withdrawal path.
 *      The public application records its ContributionReceived events only after a wallet-approved transaction
 *      is confirmed on Robinhood Chain testnet.
 */
contract BaseSetTestnetLiquidityPool {
    mapping(address => uint256) public contributedWei;
    uint256 public totalContributedWei;

    event ContributionReceived(address indexed contributor, uint256 amount);

    error ZeroContribution();

    function contribute() external payable {
        _recordContribution();
    }

    receive() external payable {
        _recordContribution();
    }

    function _recordContribution() internal {
        if (msg.value == 0) revert ZeroContribution();
        contributedWei[msg.sender] += msg.value;
        totalContributedWei += msg.value;
        emit ContributionReceived(msg.sender, msg.value);
    }
}
