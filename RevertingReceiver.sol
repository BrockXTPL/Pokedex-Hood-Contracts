// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Test fixture that rejects all native-token transfers.
contract RevertingReceiver {
    error NativeTokenRejected();

    receive() external payable {
        revert NativeTokenRejected();
    }
}
