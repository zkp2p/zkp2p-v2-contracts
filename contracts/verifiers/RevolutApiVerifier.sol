// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPaymentVerifier.sol";
import "./base/BasePaymentVerifier.sol";
import "./libraries/ReclaimVerifier.sol";

/**
 * @title RevolutVerifier
 * @notice Verifies Revolut payment proofs using Reclaim Protocol attestations
 * @dev Extends BasePaymentVerifier to verify Revolut transaction proofs for zkp2p
 */
contract RevolutVerifier is BasePaymentVerifier {
    using ReclaimVerifier for bytes;

    // Revolut-specific constants
    string public constant PROVIDER_NAME = "revolut";
    string public constant API_ENDPOINT = "https://b2b.revolut.com/api/1.0/transactions";
    
    // Reclaim Protocol attestor address
    address public immutable RECLAIM_ATTESTOR;
    
    // Events
    event RevolutPaymentVerified(
        bytes32 indexed intentHash,
        string transactionId,
        uint256 amount,
        string recipient,
        uint256 timestamp
    );

    /**
     * @notice Constructor
     * @param _escrow Address of the escrow contract
     * @param _nullifierRegistry Address of nullifier registry
     * @param _reclaimAttestor Address of Reclaim Protocol attestor
     */
    constructor(
        address _escrow,
        address _nullifierRegistry,
        address _reclaimAttestor
    ) BasePaymentVerifier(_escrow, _nullifierRegistry) {
        RECLAIM_ATTESTOR = _reclaimAttestor;
        
        // Add supported currencies
        _addCurrency("GBP"); // Revolut UK primary currency
        _addCurrency("EUR"); // Revolut EUR support
        _addCurrency("USD"); // Revolut USD support
    }

    /**
     * @notice Verifies a Revolut payment using Reclaim Protocol proof
     * @param data Payment verification data containing Reclaim proof
     * @return success Whether verification succeeded
     * @return intentHash Hash of the payment intent
     */
    function verifyPayment(VerifyPaymentData calldata data)
        external
        override
        onlyEscrow
        returns (bool success, bytes32 intentHash)
    {
        // Step 1: Decode the Reclaim proof from paymentData
        (
            ReclaimProof memory proof,
            RevolutPaymentDetails memory paymentDetails
        ) = _decodeRevolutProof(data.paymentData);

        // Step 2: Verify Reclaim Protocol attestation
        require(_verifyReclaimProof(proof), "Invalid Reclaim proof");

        // Step 3: Extract and validate payment details
        require(_validatePaymentDetails(paymentDetails, data), "Invalid payment details");

        // Step 4: Generate intent hash
        intentHash = _generateIntentHash(paymentDetails, data);

        // Step 5: Add nullifier to prevent replay
        _addNullifier(paymentDetails.transactionId);

        // Step 6: Emit verification event
        emit RevolutPaymentVerified(
            intentHash,
            paymentDetails.transactionId,
            paymentDetails.amount,
            paymentDetails.recipient,
            paymentDetails.timestamp
        );

        return (true, intentHash);
    }

    /**
     * @notice Decodes Revolut proof data from Reclaim attestation
     * @param paymentData Encoded proof data
     * @return proof Reclaim proof structure
     * @return paymentDetails Extracted payment details
     */
    function _decodeRevolutProof(bytes calldata paymentData)
        internal
        pure
        returns (
            ReclaimProof memory proof,
            RevolutPaymentDetails memory paymentDetails
        )
    {
        // Decode the proof structure
        (
            bytes memory claimData,
            bytes memory signatures,
            bytes memory extractedParameters
        ) = abi.decode(paymentData, (bytes, bytes, bytes));

        // Parse Reclaim proof
        proof = ReclaimProof({
            claimData: claimData,
            signatures: signatures
        });

        // Extract Revolut-specific payment details
        paymentDetails = _parseRevolutParameters(extractedParameters);
    }

    /**
     * @notice Parses extracted parameters into Revolut payment details
     * @param extractedParameters Raw extracted data from Reclaim
     * @return paymentDetails Structured payment information
     */
    function _parseRevolutParameters(bytes memory extractedParameters)
        internal
        pure
        returns (RevolutPaymentDetails memory paymentDetails)
    {
        // Decode extracted parameters (transaction_id, state, amount, date, recipient)
        (
            string memory transactionId,
            string memory state,
            string memory amountStr,
            string memory dateStr,
            string memory recipient
        ) = abi.decode(extractedParameters, (string, string, string, string, string));

        // Convert amount string to uint256 (handle decimal places)
        uint256 amount = _parseAmountString(amountStr);
        
        // Convert date string to timestamp
        uint256 timestamp = _parseDateString(dateStr);

        paymentDetails = RevolutPaymentDetails({
            transactionId: transactionId,
            state: state,
            amount: amount,
            recipient: recipient,
            timestamp: timestamp
        });
    }

    /**
     * @notice Verifies Reclaim Protocol proof authenticity
     * @param proof Reclaim proof structure
     * @return valid Whether the proof is valid
     */
    function _verifyReclaimProof(ReclaimProof memory proof)
        internal
        view
        returns (bool valid)
    {
        // Verify the Reclaim attestor signature
        return proof.claimData.verifyReclaimSignature(
            proof.signatures,
            RECLAIM_ATTESTOR
        );
    }

    /**
     * @notice Validates payment details against verification requirements
     * @param paymentDetails Extracted payment information
     * @param data Original verification request data
     * @return valid Whether payment details are valid
     */
    function _validatePaymentDetails(
        RevolutPaymentDetails memory paymentDetails,
        VerifyPaymentData calldata data
    ) internal view returns (bool valid) {
        // Check payment state is completed
        require(
            keccak256(bytes(paymentDetails.state)) == keccak256(bytes("completed")),
            "Payment not completed"
        );

        // Validate amount matches (with precision handling)
        require(paymentDetails.amount == data.amount, "Amount mismatch");

        // Validate recipient matches
        require(
            keccak256(bytes(paymentDetails.recipient)) == keccak256(bytes(data.recipient)),
            "Recipient mismatch"
        );

        // Validate timestamp is within acceptable range
        require(
            _isTimestampValid(paymentDetails.timestamp, data.timestamp),
            "Invalid timestamp"
        );

        // Validate currency is supported
        require(_isCurrencySupported(data.currencyId), "Unsupported currency");

        return true;
    }

    /**
     * @notice Generates intent hash for the payment
     * @param paymentDetails Payment information
     * @param data Verification request data
     * @return intentHash Unique hash for this payment intent
     */
    function _generateIntentHash(
        RevolutPaymentDetails memory paymentDetails,
        VerifyPaymentData calldata data
    ) internal pure returns (bytes32 intentHash) {
        return keccak256(abi.encodePacked(
            paymentDetails.transactionId,
            paymentDetails.amount,
            paymentDetails.recipient,
            paymentDetails.timestamp,
            data.intentHash
        ));
    }

    /**
     * @notice Parses amount string to uint256 with proper decimal handling
     * @param amountStr String representation of amount
     * @return amount Amount as uint256 (scaled to 18 decimals)
     */
    function _parseAmountString(string memory amountStr)
        internal
        pure
        returns (uint256 amount)
    {
        // Implementation for parsing decimal amount strings
        // This would convert "100.50" to 100500000000000000000 (18 decimals)
        // Simplified version - full implementation would handle various formats
        bytes memory amountBytes = bytes(amountStr);
        uint256 result = 0;
        uint256 decimals = 0;
        bool decimalFound = false;
        
        for (uint256 i = 0; i < amountBytes.length; i++) {
            if (amountBytes[i] == '.') {
                decimalFound = true;
                continue;
            }
            
            require(amountBytes[i] >= '0' && amountBytes[i] <= '9', "Invalid amount format");
            
            result = result * 10 + (uint8(amountBytes[i]) - 48);
            
            if (decimalFound) {
                decimals++;
            }
        }
        
        // Scale to 18 decimals
        require(decimals <= 18, "Too many decimal places");
        return result * (10 ** (18 - decimals));
    }

    /**
     * @notice Parses ISO date string to timestamp
     * @param dateStr ISO date string (e.g., "2025-07-27T15:49:18.000Z")
     * @return timestamp Unix timestamp
     */
    function _parseDateString(string memory dateStr)
        internal
        pure
        returns (uint256 timestamp)
    {
        // Simplified implementation - would need full ISO 8601 parser
        // For now, this is a placeholder that would need proper implementation
        // Real implementation would parse "2025-07-27T15:49:18.000Z" format
        return block.timestamp; // Placeholder
    }

    /**
     * @notice Checks if timestamp is within valid range
     * @param paymentTimestamp Timestamp from payment proof
     * @param intentTimestamp Timestamp from intent
     * @return valid Whether timestamp is acceptable
     */
    function _isTimestampValid(uint256 paymentTimestamp, uint256 intentTimestamp)
        internal
        pure
        returns (bool valid)
    {
        // Allow 1 hour buffer before and after intent timestamp
        uint256 buffer = 3600; // 1 hour in seconds
        return paymentTimestamp >= intentTimestamp - buffer &&
               paymentTimestamp <= intentTimestamp + buffer;
    }
}

/**
 * @notice Structure representing a Reclaim Protocol proof
 */
struct ReclaimProof {
    bytes claimData;
    bytes signatures;
}

/**
 * @notice Structure representing Revolut payment details
 */
struct RevolutPaymentDetails {
    string transactionId;
    string state;
    uint256 amount;
    string recipient;
    uint256 timestamp;
}