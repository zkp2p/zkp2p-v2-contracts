// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IAttestationVerifier } from "./IAttestationVerifier.sol";
import { ThresholdSigVerifierUtils } from "../lib/ThresholdSigVerifierUtils.sol";

/**
 * @title WitnessAttestationVerifier
 * @notice Verifies attestations using threshold signatures from a set of witnesses
 * 
 * This contract verifies that a minimum threshold of witnesses have signed a digest,
 * supporting both EOA and ERC-1271 smart contract wallets through SignatureChecker.
 * The metadata contains the list of accepted witness addresses, and signatures must
 * meet the configured minimum threshold to be considered valid.
 */
contract WitnessAttestationVerifier is IAttestationVerifier, Ownable {
    
    /* ============ Events ============ */
    
    /**
     * @notice Emitted when the minimum witness signatures threshold is updated
     * @param oldMin The previous minimum threshold
     * @param newMin The new minimum threshold
     */
    event MinWitnessSignaturesUpdated(uint256 oldMin, uint256 newMin);
    
    /* ============ State Variables ============ */
    
    // Minimum number of witness signatures required for attestation
    uint256 public minWitnessSignatures;
    
    /* ============ Constructor ============ */
    
    /**
     * @notice Initializes the witness attestation verifier
     * @param _minWitnessSignatures Minimum number of witness signatures required
     */
    constructor(uint256 _minWitnessSignatures) Ownable() {
        require(_minWitnessSignatures > 0, "WitnessAttestationVerifier: Min signatures must be > 0");
        minWitnessSignatures = _minWitnessSignatures;
    }
    
    /* ============ External Functions ============ */
    
    /**
     * @notice Verifies witness signatures for a given digest
     * @param _digest The message digest to verify (EIP-712 or EIP-191 formatted)
     * @param _sigs Array of signatures from witnesses
     * @param _metadata Encoded witness addresses (abi.encode(address[]))
     * @return isValid Returns true if the signatures meet the threshold, false otherwise
     */
    function verify(
        bytes32 _digest,
        bytes[] calldata _sigs,
        bytes calldata _metadata
    ) external view override returns (bool isValid) {
        // Decode witnesses from metadata
        address[] memory witnesses = abi.decode(_metadata, (address[]));
        
        // Verify signatures meet threshold
        isValid = ThresholdSigVerifierUtils.verifyWitnessSignatures(
            _digest,
            _sigs,
            witnesses,
            minWitnessSignatures
        );
    }

    /* ============ Governance Functions ============ */
    
    /**
     * @notice Updates the minimum witness signatures required
     * @param _newMinWitnessSignatures The new minimum witness signatures threshold
     */
    function setMinWitnessSignatures(uint256 _newMinWitnessSignatures) external onlyOwner {
        require(_newMinWitnessSignatures > 0, "WitnessAttestationVerifier: Min signatures must be > 0");
        require(_newMinWitnessSignatures != minWitnessSignatures, "WitnessAttestationVerifier: Same value");
        
        uint256 oldMin = minWitnessSignatures;
        minWitnessSignatures = _newMinWitnessSignatures;
        emit MinWitnessSignaturesUpdated(oldMin, _newMinWitnessSignatures);
    }
}