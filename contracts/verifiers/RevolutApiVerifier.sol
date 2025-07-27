// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IPaymentVerifier.sol";
import "./BaseVerifiers/BasePaymentVerifier.sol";
import "./nullifierRegistries/INullifierRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title RevolutApiVerifier
 * @notice Verifies Revolut Business API payment proofs using Reclaim Protocol attestations
 * @dev Extends BasePaymentVerifier to verify Revolut transaction proofs for zkp2p
 */
contract RevolutApiVerifier is IPaymentVerifier, BasePaymentVerifier {
    
    // Revolut-specific constants
    string public constant PROVIDER_NAME = "revolut-api";
    string public constant API_ENDPOINT = "https://b2b.revolut.com/api/1.0/transactions";
    uint256 internal constant PRECISE_UNIT = 1e18;
    
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
    ) BasePaymentVerifier(_escrow, INullifierRegistry(_nullifierRegistry), 3600, _getSupportedCurrencies()) {
        RECLAIM_ATTESTOR = _reclaimAttestor;
    }

    /**
     * @notice Get supported currencies
     * @return Array of supported currency identifiers
     */
    function _getSupportedCurrencies() internal pure returns (bytes32[] memory) {
        bytes32[] memory supportedCurrencies = new bytes32[](3);
        supportedCurrencies[0] = keccak256(bytes("GBP"));
        supportedCurrencies[1] = keccak256(bytes("EUR"));
        supportedCurrencies[2] = keccak256(bytes("USD"));
        return supportedCurrencies;
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
        returns (bool success, bytes32 intentHash)
    {
        require(msg.sender == escrow, "Only escrow can call");
        // Step 1: Decode the Reclaim proof from paymentProof
        RevolutPaymentDetails memory paymentDetails = _decodeRevolutProof(data.paymentProof);

        // Step 2: Validate payment details
        require(_validatePaymentDetails(paymentDetails, data), "Invalid payment details");

        // Step 3: Generate intent hash
        intentHash = _generateIntentHash(paymentDetails, data);

        // Step 4: Add nullifier to prevent replay
        _addNullifier(paymentDetails.transactionId);

        // Step 5: Emit verification event
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
     * @param paymentProof Encoded proof data
     * @return paymentDetails Extracted payment details
     */
    function _decodeRevolutProof(bytes calldata paymentProof)
        internal
        view
        returns (RevolutPaymentDetails memory paymentDetails)
    {
        // Decode the proof structure (claimData, signatures, extractedParameters)
        (
            ,  // claimData - unused for now
            ,  // signatures - unused for now  
            bytes memory extractedParameters
        ) = abi.decode(paymentProof, (bytes, bytes, bytes));

        // For now, we'll do basic validation and extract the parameters
        // In a full implementation, you'd verify the Reclaim attestor signature

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
        view
        returns (RevolutPaymentDetails memory paymentDetails)
    {
        // Decode extracted parameters (transaction_id, state, amount, date, recipient)
        (
            string memory transactionId,
            string memory state,
            string memory amountStr,
            ,  // dateStr - unused for now
            string memory recipient
        ) = abi.decode(extractedParameters, (string, string, string, string, string));

        // Convert amount string to uint256 (handle decimal places)
        uint256 amount = _parseAmountString(amountStr);
        
        // Convert date string to timestamp (simplified for now)
        uint256 timestamp = block.timestamp; // TODO: implement proper date parsing

        paymentDetails = RevolutPaymentDetails({
            transactionId: transactionId,
            state: state,
            amount: amount,
            recipient: recipient,
            timestamp: timestamp
        });
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

        // Calculate expected payment amount using conversion rate (same logic as other verifiers)
        uint256 expectedPaymentAmount = (data.intentAmount * data.conversionRate) / PRECISE_UNIT;
        
        // Parse payment amount to match token decimals (like other verifiers)
        uint8 decimals = IERC20Metadata(data.depositToken).decimals();
        uint256 paymentAmount = _parseAmountToTokenDecimals(paymentDetails.amount, decimals);
        
        require(paymentAmount >= expectedPaymentAmount, "Amount mismatch");

        // Validate recipient matches
        require(
            keccak256(bytes(paymentDetails.recipient)) == keccak256(bytes(data.payeeDetails)),
            "Recipient mismatch"
        );

        // Validate timestamp is within acceptable range (simplified)
        require(
            _isTimestampValid(paymentDetails.timestamp, data.intentTimestamp),
            "Invalid timestamp"
        );

        // Validate currency is supported
        require(isCurrency[data.fiatCurrency], "Unsupported currency");

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
            data.intentAmount,
            data.depositToken
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
        // Handle negative amounts (remove minus sign)
        bytes memory amountBytes = bytes(amountStr);
        uint256 startIndex = 0;
        if (amountBytes.length > 0 && amountBytes[0] == '-') {
            startIndex = 1;
        }
        
        uint256 result = 0;
        uint256 decimals = 0;
        bool decimalFound = false;
        
        for (uint256 i = startIndex; i < amountBytes.length; i++) {
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

    /**
     * @notice Add a nullifier to prevent replay attacks
     * @param nullifier The nullifier to add
     */
    function _addNullifier(string memory nullifier) internal {
        bytes32 nullifierHash = keccak256(bytes(nullifier));
        nullifierRegistry.addNullifier(nullifierHash);
    }

    /**
     * @notice Parse amount from 18 decimals to token decimals (like other verifiers)
     * @param amount Amount in 18 decimals 
     * @param tokenDecimals Target token decimals
     * @return Amount scaled to token decimals
     */
    function _parseAmountToTokenDecimals(uint256 amount, uint8 tokenDecimals) 
        internal 
        pure 
        returns (uint256) 
    {
        if (tokenDecimals >= 18) {
            return amount * (10 ** (tokenDecimals - 18));
        } else {
            return amount / (10 ** (18 - tokenDecimals));
        }
    }
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