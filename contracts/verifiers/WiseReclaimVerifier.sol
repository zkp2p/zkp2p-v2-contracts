// SPDX-License-Identifier: MIT

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { DateParsing } from "../lib/DateParsing.sol";
import { ClaimVerifier } from "../lib/ClaimVerifier.sol";
import { StringConversionUtils } from "../lib/StringConversionUtils.sol";
import { BaseReclaimPaymentVerifier } from "./BaseVerifiers/BaseReclaimPaymentVerifier.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";
import { IPaymentVerifier } from "./interfaces/IPaymentVerifier.sol";

import "hardhat/console.sol";

pragma solidity ^0.8.18;

contract WiseReclaimVerifier is IPaymentVerifier, BaseReclaimPaymentVerifier {

    using StringConversionUtils for string;
    
    /* ============ Structs ============ */

    // Struct to hold the payment details extracted from the proof
    struct PaymentDetails {
        string amountString;
        string timestampString;
        string currencyCode;
        string paymentId;
        string paymentStatus;
        string recipientId;
        string intentHash;
        string providerHash;
    }

    struct CurrencyResolutionData {
        bytes32 intentHash;              // Intent hash as nonce
        bytes32 paymentCurrency;         // The currency paid
        uint256 conversionRate;          // Conversion rate for the payment currency
        uint256 penaltyBps;              // Penalty in basis points (100 = 1%)
        bytes signature;                 // Signature from currency resolution service approving this dispute
    }

    /* ============ Constants ============ */
    
    uint8 internal constant MAX_EXTRACT_VALUES = 11; 
    uint8 internal constant MIN_WITNESS_SIGNATURE_REQUIRED = 1;
    bytes32 public constant COMPLETE_PAYMENT_STATUS = keccak256(abi.encodePacked("OUTGOING_PAYMENT_SENT"));
    
    uint256 internal constant MAX_PENALTY_BPS = 0.2e18; // 20% max penalty
    uint256 internal constant PRECISION_UNIT = 1e18; // 100% in basis points

    /* ============ Constructor ============ */
    constructor(
        address _escrow,
        INullifierRegistry _nullifierRegistry,
        uint256 _timestampBuffer,
        bytes32[] memory _currencies,
        string[] memory _providerHashes
    )   
        BaseReclaimPaymentVerifier(
            _escrow, 
            _nullifierRegistry, 
            _timestampBuffer, 
            _currencies,
            _providerHashes
        )
    { }

    /* ============ External Functions ============ */

    /**
     * ONLY ESCROW: Verifies a reclaim proof of an offchain Wise payment. Ensures the right amount
     * was paid to the correct recipient after the intent timestamp.
     * 
     * Handles currency mismatches: If payment is made in a different currency than intended,
     * the taker can provide CurrencyResolutionData in verificationData with:
     * - paymentCurrency: The currency that was actually paid
     * - conversionRate: The conversion rate for the actual currency
     * - penaltyBps: The penalty for sending the payment in a different currency in basis points (100 = 1%)
     * - signature: Signature from currency resolution service approving this dispute
     * Note: The depositor needs to provide a currency resolution service address in the deposit data.
     *
     * @param _verifyPaymentData Payment proof and intent details required for verification
     * @return result PaymentVerificationResult struct containing verification status and payment details
     */
    function verifyPayment(
        IPaymentVerifier.VerifyPaymentData calldata _verifyPaymentData
    )
        external 
        override
        returns (IPaymentVerifier.PaymentVerificationResult memory)
    {
        require(msg.sender == escrow, "Only escrow can call");

        // Decode witnesses from deposit data
        (
            address[] memory witnesses,
            address currencyResolutionService
        ) = abi.decode(_verifyPaymentData.depositData, (address[], address));


        PaymentDetails memory paymentDetails = _verifyProofAndExtractValues(
            _verifyPaymentData.paymentProof, 
            witnesses
        );
                
        uint256 paymentAmount = _verifyPaymentDetails(
            paymentDetails, 
            _verifyPaymentData
        );

        uint256 releaseAmount;
        
        bytes32 intentHash = bytes32(paymentDetails.intentHash.stringToUint(0));
        bytes32 paymentCurrency = keccak256(abi.encodePacked(paymentDetails.currencyCode));

        if (paymentCurrency != _verifyPaymentData.fiatCurrency) {
            // Handle currency mismatch
            require(currencyResolutionService != address(0), "Incorrect payment currency");
            
            bytes memory currencyResolutionData = _verifyPaymentData.data;
            require(currencyResolutionData.length > 0, "Currency mismatch without resolution data");
            
            releaseAmount = _handleCurrencyMismatch(
                paymentAmount,
                paymentCurrency,
                _verifyPaymentData.intentAmount,
                intentHash,
                currencyResolutionData,
                currencyResolutionService
            );
        } else {
            releaseAmount = _calculateReleaseAmount(
                paymentAmount, 
                _verifyPaymentData.conversionRate, 
                _verifyPaymentData.intentAmount
            );
        }

        // Nullify the payment
        bytes32 nullifier = keccak256(abi.encodePacked(paymentDetails.paymentId));
        _validateAndAddNullifier(nullifier);

        return IPaymentVerifier.PaymentVerificationResult({
            success: true,
            intentHash: intentHash,
            releaseAmount: releaseAmount,
            paymentCurrency: paymentCurrency,
            paymentId: paymentDetails.paymentId
        });
    }

    /* ============ Internal Functions ============ */

    /**
     * Verifies the proof and extracts the public values from the proof and _witnesses.
     *
     * @param _proof The proof to verify.
     * @param _witnesses The witnesses to verify the proof with.
     */
    function _verifyProofAndExtractValues(
        bytes calldata _proof, 
        address[] memory _witnesses
    ) 
        internal
        view
        returns (PaymentDetails memory paymentDetails) 
    {
        // Decode proof
        ReclaimProof memory proof = abi.decode(_proof, (ReclaimProof));

        // claim must have at least 1 signature from witnesses
        verifyProofSignatures(proof, _witnesses, MIN_WITNESS_SIGNATURE_REQUIRED);     
        
        // Extract public values
        paymentDetails = _extractValues(proof);

        // Check provider hash (Required for Reclaim proofs)
        require(_validateProviderHash(paymentDetails.providerHash), "No valid providerHash");
    }

    /**
     * Verifies the right _intentAmount * _conversionRate is paid to _payeeDetailsHash after 
     * _intentTimestamp + timestampBuffer on Venmo. Reverts if any of the conditions are not met.
     */
    function _verifyPaymentDetails(
        PaymentDetails memory paymentDetails,
        VerifyPaymentData memory _verifyPaymentData
    ) internal view returns (uint256 paymentAmount) {
        uint8 decimals = IERC20Metadata(_verifyPaymentData.depositToken).decimals();

        // Validate amount
        paymentAmount = paymentDetails.amountString.stringToUint(decimals);
        require(paymentAmount > 0, "Payment amount must be greater than zero");
        
        // Validate recipient
        require(
            paymentDetails.recipientId.stringComparison(_verifyPaymentData.payeeDetails), 
            "Incorrect payment recipient"
        );

        // Validate timestamp; add in buffer to build flexibility for L2 timestamps
        uint256 paymentTimestamp = paymentDetails.timestampString.stringToUint(0) / 1000 + timestampBuffer;
        require(paymentTimestamp >= _verifyPaymentData.intentTimestamp, "Incorrect payment timestamp");

        // Validate status
        require(
            keccak256(abi.encodePacked(paymentDetails.paymentStatus)) == COMPLETE_PAYMENT_STATUS,
            "Invalid payment status"
        );

        return paymentAmount;
    }

    /**
     * Extracts the verification data from the data. In case of a Reclaim/TLSN/ZK proof, data contains the witnesses' addresses.
     * In case of a zkEmail proof, data contains the DKIM key hash. Can also contain additional data like currency code, etc.
     *
     * @param _data The data to extract the verification data from.
     */
    function _decodeDepositData(bytes calldata _data) internal pure returns (address[] memory witnesses) {
        witnesses = abi.decode(_data, (address[]));
    }

    /**
     * Handles currency mismatch scenarios by validating resolution data and calculating adjusted release amount
     */
    function _handleCurrencyMismatch(
        uint256 _paymentAmount,
        bytes32 _paymentCurrency,
        uint256 _intentAmount,
        bytes32 _intentHash,
        bytes memory _currencyResolutionData,
        address _currencyResolutionService
    ) internal pure returns (uint256) {
        
        // Decode resolution data
        CurrencyResolutionData memory resolution = abi.decode(_currencyResolutionData, (CurrencyResolutionData));
        
        // Verify the resolution data matches the payment currency
        require(resolution.paymentCurrency == _paymentCurrency, "Resolution currency doesn't match payment");
        require(resolution.intentHash == _intentHash, "Resolution intent doesn't match intent");
        require(resolution.penaltyBps <= MAX_PENALTY_BPS, "Penalty exceeds max allowed");
        
        // Verify currency resolution service signature
        require(
            _verifySignature(
                keccak256(abi.encodePacked(
                    resolution.intentHash,
                    resolution.paymentCurrency,
                    resolution.conversionRate,
                    resolution.penaltyBps
                )), 
                resolution.signature, 
                _currencyResolutionService
            ),
            "Invalid currency resolution service signature"
        );

        // Calculate release amount with the new payment currency conversion rate
        uint256 baseReleaseAmount = _calculateReleaseAmount(
            _paymentAmount,
            resolution.conversionRate,
            _intentAmount
        );

        // Apply penalty
        uint256 penaltyAmount = (baseReleaseAmount * resolution.penaltyBps) / PRECISION_UNIT;
        uint256 finalReleaseAmount = baseReleaseAmount - penaltyAmount;
        
        return finalReleaseAmount;
    }

    /**
     * Extracts all values from the proof context.
     *
     * @param _proof The proof containing the context to extract values from.
     */
    function _extractValues(ReclaimProof memory _proof) internal pure returns (PaymentDetails memory paymentDetails) {
        string[] memory values = ClaimVerifier.extractAllFromContext(
            _proof.claimInfo.context, 
            MAX_EXTRACT_VALUES, 
            true
        );

        return PaymentDetails({
            // values[0] is ContextAddress
            intentHash: values[1],
            // values[2] is profileId,
            // values[3] is transactionId,
            paymentId: values[4],
            paymentStatus: values[5],
            amountString: values[6],
            currencyCode: values[7],
            recipientId: values[8],
            timestampString: values[9],
            providerHash: values[10]
        });
    }

    /**
     * Verifies signature for currency resolution
     */
    function _verifySignature(
        bytes32 _messageHash,
        bytes memory _signature,
        address _signer
    ) internal pure returns (bool) {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash)
        );
        
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, _signature);
        return recoveredSigner == _signer;
    }
}
