// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IAttestationVerifier } from "../interfaces/IAttestationVerifier.sol";
import { ThresholdSigVerifierUtils } from "../lib/ThresholdSigVerifierUtils.sol";

/**
 * @title SimpleAttestationVerifier
 * @notice Verifies attestations from off-chain verification service with on-chain trust anchors
 * @dev Simplified model with one offchain attestation service
 * 
 * The verification flow:
 * 1. User runs the zkTLS protocol with the attestor to generate a zkTLS proof
 * 2. Off-chain service verifies zkTLS proofs and generates standardized attestation; Attestation is
 *    signed by the witness and includes metadata about verification
 * 3. On-chain verification checks witness signature AND validates trust anchors to ensure
 *    offchain verification integrity
 */
contract SimpleAttestationVerifier is IAttestationVerifier, Ownable {
    
    using ECDSA for bytes32;
    
    /* ============ Events ============ */
    
    event WitnessUpdated(address indexed oldWitness, address indexed newWitness);
    
    /* ============ Constants ============ */

    uint256 public constant MIN_WITNESS_SIGNATURES = 1;
    
    /* ============ State Variables ============ */
    
    // Single witness that signs standardized attestations for offchain attestation service
    address public witness;
    
    /* ============ Constructor ============ */
    
    /**
     * @notice Initializes the attestation verifier
     * @param _witness Initial witness address (can be zero to set later)
     */
    constructor(address _witness) Ownable() {
        witness = _witness;
    }
    
    /* ============ External Functions ============ */
    
    /**
     * @notice Verifies attestations and trust anchor from off-chain verification service
     * @param _digest The message digest to verify (EIP-712 formatted)
     * @param _sigs Array with single signature from the witness
     * @param _data Verification metadata that stores trust anchors that are verified on-chain
     * @return isValid True if attestation and trust anchor are valid
     */
    function verify(
        bytes32 _digest,
        bytes[] calldata _sigs,
        bytes calldata _data
    ) external view override returns (bool isValid) {
        address[] memory witnesses = new address[](1);
        witnesses[0] = witness;
        
        // Verify signatures meet threshold
        isValid = ThresholdSigVerifierUtils.verifyWitnessSignatures(
            _digest,
            _sigs,
            witnesses,
            MIN_WITNESS_SIGNATURES
        );

        // Only return isValid if it's true, otherwise library reverts
        return isValid;
    }
    
    /* ============ Governance Functions ============ */
    
    /**
     * @notice Updates the witness address
     * @param _newWitness New witness address
     */
    function setWitness(address _newWitness) external onlyOwner {
        require(_newWitness != address(0), "SimpleAttestationVerifier: Zero address");
        
        address oldWitness = witness;
        witness = _newWitness;
        
        emit WitnessUpdated(oldWitness, _newWitness);
    }
}