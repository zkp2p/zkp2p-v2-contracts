// SPDX-License-Identifier: MIT

import { BasePaymentVerifier } from "./BaseVerifiers/BasePaymentVerifier.sol";
import { INullifierRegistry } from "./nullifierRegistries/INullifierRegistry.sol";
import { IPaymentVerifier } from "./interfaces/IPaymentVerifier.sol";

pragma solidity ^0.8.18;

/**
 * @title OTPVerifier
 * @notice OTP verifier with deposit-specific hashing to prevent cross-deposit attacks
 * 
 * Flow:
 * 1. Depositor creates deposit with secret hash stored in DepositVerifierData.data
 * 2. Anyone can signal intent on this deposit (1:1 withdrawal only)
 * 3. To fulfill intent, user provides the OTP secret 
 * 4. Contract verifies secret with deposit-specific hashing and releases funds
 * 
 * Security:
 * - Uses deposit-specific hashing: hash(secret, payeeDetails) 
 * - Prevents cross-deposit attacks where same secret compromises multiple deposits
 * - No nullifiers needed - escrow prevents double spending via intent removal
 */
contract OTPVerifier is IPaymentVerifier, BasePaymentVerifier {

    /* ============ Events ============ */
    
    event SecretRevealed(
        bytes32 indexed secretHash,
        bytes32 indexed intentHash,
        address indexed fulfiller
    );

    /* ============ Constructor ============ */
    
    constructor(
        address _escrow,
        INullifierRegistry _nullifierRegistry,
        uint256 _timestampBuffer,
        bytes32[] memory _currencies
    ) BasePaymentVerifier(
        _escrow,
        _nullifierRegistry,
        _timestampBuffer,
        _currencies
    ) {}

    /* ============ External Functions ============ */

    /**
     * @notice Verifies OTP using deposit-specific hashing
     * @param _verifyPaymentData Contains the OTP secret and verification context
     * @return success Whether verification succeeded
     * @return intentHash Intent hash extracted from payment proof
     */
    function verifyPayment(
        IPaymentVerifier.VerifyPaymentData calldata _verifyPaymentData
    ) external override returns (bool success, bytes32 intentHash) {
        require(msg.sender == escrow, "Only escrow can call");

        // Extract the secret and intent hash from payment proof
        // Format: [providedSecret(32 bytes)][intentHash(32 bytes)]
        (bytes32 providedSecret, bytes32 providedIntentHash) = abi.decode(
            _verifyPaymentData.paymentProof, 
            (bytes32, bytes32)
        );
        
        // Extract stored secret hash from data field
        bytes32 storedSecretHash = abi.decode(_verifyPaymentData.data, (bytes32));
        
        // Compute deposit-specific hash: hash(secret, payeeDetails)
        // This prevents cross-deposit attacks where knowing one secret compromises others
        bytes32 computedHash = keccak256(abi.encodePacked(
            providedSecret, 
            _verifyPaymentData.payeeDetails
        ));
        
        require(computedHash == storedSecretHash, "Invalid OTP: secret does not match hash");

        // Verify timing constraint
        require(
            block.timestamp >= _verifyPaymentData.intentTimestamp,
            "Verification cannot happen before intent timestamp"
        );

        // Return the intent hash that was provided in the payment proof
        // This follows the same pattern as other verifiers which extract intent hash from proof data
        intentHash = providedIntentHash;

        emit SecretRevealed(storedSecretHash, intentHash, tx.origin);

        return (true, intentHash);
    }

    /* ============ Utility Functions ============ */

    /**
     * @notice Generate deposit-specific secret hash for deposit creation
     * @param _secret The OTP secret (6-12 word passphrase)
     * @param _payeeDetails Unique identifier for this deposit
     * @return Deposit-specific hash that prevents cross-deposit attacks
     */
    function generateSecretHash(bytes32 _secret, string memory _payeeDetails) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret, _payeeDetails));
    }

    /**
     * @notice Verify a secret against a deposit-specific hash
     * @param _secret The secret to verify
     * @param _payeeDetails The payee details used in original hashing
     * @param _hash The expected deposit-specific hash
     * @return Whether the secret matches the hash for this specific deposit
     */
    function verifySecret(bytes32 _secret, string memory _payeeDetails, bytes32 _hash) external pure returns (bool) {
        return keccak256(abi.encodePacked(_secret, _payeeDetails)) == _hash;
    }
}