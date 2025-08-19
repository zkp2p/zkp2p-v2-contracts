//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IAttestationVerifier {
    /**
     * @notice Verify signatures for `digest` and optional metadata.
     * @dev Return true on success, false on failure.
     */
    function verify(
        bytes32 _digest,
        bytes[] calldata _sigs,
        bytes calldata _metadata
    ) external view returns (bool isValid);
}