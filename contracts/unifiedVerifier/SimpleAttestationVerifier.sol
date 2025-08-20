// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IAttestationVerifier } from "./interfaces/IAttestationVerifier.sol";
import { ThresholdSigVerifierUtils } from "../lib/ThresholdSigVerifierUtils.sol";

/**
 * @title SimpleAttestationVerifier
 * @notice Verifies attestations from off-chain verification service with on-chain trust anchors
 * @dev Simplified single-operator model with one witness and one zkTLS attestor
 * 
 * The verification flow:
 * 1. Off-chain service verifies zkTLS proofs and generates attestations
 * 2. Witness signs the attestation including metadata about verification
 * 3. On-chain verification checks witness signature AND validates trust anchor
 */
contract SimpleAttestationVerifier is IAttestationVerifier, Ownable {
    
    using ECDSA for bytes32;
    
    /* ============ Events ============ */
    
    event WitnessUpdated(address indexed oldWitness, address indexed newWitness);
    event ZktlsAttestorUpdated(address indexed oldAttestor, address indexed newAttestor);
    event RequireZktlsValidationUpdated(bool required);

    /* ============ Constants ============ */

    uint256 public constant MIN_WITNESS_SIGNATURES = 1;
    
    /* ============ State Variables ============ */
    
    // Single witness that signs attestations
    address public witness;
    
    // Single zkTLS attestor that performed the zkTLS verification
    // Acts as a trust anchor to ensure only the registered attestor can verify zkTLS proofs
    address public zktlsAttestor;
    
    /* ============ Constructor ============ */
    
    /**
     * @notice Initializes the attestation verifier
     * @param _witness Initial witness address (can be zero to set later)
     * @param _zktlsAttestor Initial zkTLS attestor address (can be zero to set later)
     */
    constructor(address _witness, address _zktlsAttestor) Ownable() {
        witness = _witness;
        zktlsAttestor = _zktlsAttestor;
    }
    
    /* ============ External Functions ============ */
    
    /**
     * @notice Verifies attestations and trust anchor from off-chain verification service
     * @param _digest The message digest to verify (EIP-712 formatted)
     * @param _sigs Array with single signature from the witness
     * @param _data Verification metadata including zkTLS attestor address if required
     * @return isValid True if attestation and trust anchor are valid
     * 
     * @dev The data parameter contains the zkTLS attestor address that performed the verification
     */
    function verify(
        bytes32 _digest,
        bytes[] calldata _sigs,
        bytes calldata _data
    ) external view override returns (bool isValid) {
        isValid = _verifyAttestation(_digest, _sigs);

        if (isValid) {
            isValid = _verifyTrustAnchor(_data);
        }

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
    
    /**
     * @notice Updates the zkTLS attestor address
     * @param _newAttestor New zkTLS attestor address
     */
    function setZktlsAttestor(address _newAttestor) external onlyOwner {
        require(_newAttestor != address(0), "SimpleAttestationVerifier: Zero address");
        
        address oldAttestor = zktlsAttestor;
        zktlsAttestor = _newAttestor;
        
        emit ZktlsAttestorUpdated(oldAttestor, _newAttestor);
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Verifies the attestation
     * @param _digest The message digest to verify (EIP-712 formatted)
     * @param _sigs Array with single signature from the witness
     * @return isValid True if attestation is valid
     */
    function _verifyAttestation(bytes32 _digest, bytes[] calldata _sigs) internal view returns (bool isValid) {
        address[] memory witnesses = new address[](1);
        witnesses[0] = witness;
        
        // Verify signatures meet threshold
        isValid = ThresholdSigVerifierUtils.verifyWitnessSignatures(
            _digest,
            _sigs,
            witnesses,
            MIN_WITNESS_SIGNATURES
        );

        return isValid;
    }

    /**
     * @notice Verifies the zkTLS attestor address (trust anchor)
     * @param _data Encoded zkTLS attestor address
     * @return isValid True if attestor is valid
     */
    function _verifyTrustAnchor(bytes calldata _data) internal view returns (bool isValid) {
        // Decode zkTLS attestor address from data
        address attestor = abi.decode(_data, (address));
        
        // Verify attestor is the registered one
        if (attestor != zktlsAttestor) {
            return false;
        }

        return true;
    }
}