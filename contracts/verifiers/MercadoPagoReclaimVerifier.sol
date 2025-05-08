// SPDX-License-Identifier: MIT

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { ClaimVerifier } from "../lib/ClaimVerifier.sol";
import { DateParsing } from "../lib/DateParsing.sol";
import { StringConversionUtils } from "../lib/StringConversionUtils.sol";
import { Bytes32ConversionUtils } from "../lib/Bytes32ConversionUtils.sol";

import { BaseReclaimPaymentVerifier } from "./BaseReclaimPaymentVerifier.sol";
import { INullifierRegistry } from "./nullifierRegistries/INullifierRegistry.sol";
import { IPaymentVerifier } from "./interfaces/IPaymentVerifier.sol";

pragma solidity ^0.8.18;

contract MercadoPagoReclaimVerifier is IPaymentVerifier, BaseReclaimPaymentVerifier {

    using StringConversionUtils for string;
    using Bytes32ConversionUtils for bytes32;
    using { StringConversionUtils.substring } for string;

    /* ============ Structs ============ */

    // Struct to hold the payment details extracted from the proof
    struct PaymentDetails {
        string amountString;
        string amountCentsString;
        string dateString;
        string currencyCode;
        string paymentId;
        string paymentStatus;
        string paymentType;
        string recipientId;
        string intentHash;
        string providerHash;
    }

    /* ============ Constants ============ */
    
    uint8 internal constant MAX_EXTRACT_VALUES = 13;        // 11 + 2 url params + 1 context address
    uint8 internal constant MIN_WITNESS_SIGNATURE_REQUIRED = 1;
    
    bytes32 public constant COMPLETE_PAYMENT_STATUS = keccak256(abi.encodePacked("approved"));
    bytes32 public constant P2P_PAYMENT_TYPE = keccak256(abi.encodePacked("p2p_money_transfer"));
    bytes32 public constant ONLINE_TRANSFER_TYPE = keccak256(abi.encodePacked("transfer_online"));

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
     * ONLY RAMP: Verifies a reclaim proof of an offchain Mercado Pago payment. Ensures the right _intentAmount * _conversionRate
     * was paid to _payeeDetails after _intentTimestamp + timestampBuffer on Mercado Pago.
     * Additionaly, checks the right fiatCurrency was paid and the payment status is correct.
     *
     * @param _verifyPaymentData Payment proof and intent details required for verification
     */
    function verifyPayment(
        IPaymentVerifier.VerifyPaymentData calldata _verifyPaymentData
    )
        external 
        override
        returns (bool, bytes32)
    {
        require(msg.sender == escrow, "Only escrow can call");

        (
            PaymentDetails memory paymentDetails, 
            bool isAppclipProof
        ) = _verifyProofAndExtractValues(_verifyPaymentData.paymentProof, _verifyPaymentData.data);
        
        _verifyPaymentDetails(
            paymentDetails, 
            _verifyPaymentData,
            isAppclipProof
        );
        
        bytes32 nullifier = keccak256(abi.encodePacked(paymentDetails.paymentId));
        _validateAndAddNullifier(nullifier);

        bytes32 intentHashBytes = bytes32(paymentDetails.intentHash.stringToUint(0));
        return (true, intentHashBytes);
    }

    /* ============ Internal Functions ============ */

    /**
     * Verifies the proof and extracts the public values from the proof and _depositData.
     *
     * @param _proof The proof to verify.
     * @param _depositData The deposit data to extract the verification data from.
     */
    function _verifyProofAndExtractValues(bytes calldata _proof, bytes calldata _depositData) 
        internal
        view
        returns (PaymentDetails memory paymentDetails, bool isAppclipProof) 
    {
        // Decode proof
        ReclaimProof memory proof = abi.decode(_proof, (ReclaimProof));

        // Extract verification data
        address[] memory witnesses = _decodeDepositData(_depositData);

        verifyProofSignatures(proof, witnesses, MIN_WITNESS_SIGNATURE_REQUIRED);     // claim must have at least 1 signature from witnesses
        
        // Extract public values
        paymentDetails = _extractValues(proof);

        // Check provider hash (Required for Reclaim proofs)
        require(_validateProviderHash(paymentDetails.providerHash), "No valid providerHash");

        isAppclipProof = proof.isAppclipProof;
    }

    /**
     * Verifies the right _intentAmount * _conversionRate is paid to _payeeDetailsHash after 
     * _intentTimestamp + timestampBuffer on Mercado Pago. 
     * Additionaly, checks the right fiatCurrency was paid and the payment status is correct.
     * Reverts if any of the conditions are not met.
     */
    function _verifyPaymentDetails(
        PaymentDetails memory paymentDetails,
        VerifyPaymentData memory _verifyPaymentData,
        bool _isAppclipProof
    ) internal view {
        uint256 expectedAmount = _verifyPaymentData.intentAmount * _verifyPaymentData.conversionRate / PRECISE_UNIT;
        uint8 decimals = IERC20Metadata(_verifyPaymentData.depositToken).decimals();

        uint256 paymentAmount = _parseAmount(paymentDetails.amountString, paymentDetails.amountCentsString, paymentDetails.currencyCode, decimals);
        require(paymentAmount >= expectedAmount, "Incorrect payment amount");
        
        if (_isAppclipProof) {
            bytes32 hashedRecipientId = keccak256(abi.encodePacked(paymentDetails.recipientId));
            require(
                hashedRecipientId.toHexString().stringComparison(_verifyPaymentData.payeeDetails), 
                "Incorrect payment recipient"
            );
        } else {
            require(
                paymentDetails.recipientId.stringComparison(_verifyPaymentData.payeeDetails), 
                "Incorrect payment recipient"
            );
        }
        
        uint256 paymentTimestamp = DateParsing._dateStringToTimestamp(paymentDetails.dateString) + timestampBuffer;
        require(paymentTimestamp >= _verifyPaymentData.intentTimestamp, "Incorrect payment timestamp");

        bytes32 paymentCurrencyHash = keccak256(abi.encodePacked(paymentDetails.currencyCode));
        require(paymentCurrencyHash == _verifyPaymentData.fiatCurrency, "Incorrect payment currency");

        bytes32 paymentTypeHash = keccak256(abi.encodePacked(paymentDetails.paymentType));
        require(paymentTypeHash == P2P_PAYMENT_TYPE || paymentTypeHash == ONLINE_TRANSFER_TYPE, "Invalid payment type");

        bytes32 paymentStatusHash = keccak256(abi.encodePacked(paymentDetails.paymentStatus));
        require(paymentStatusHash == COMPLETE_PAYMENT_STATUS, "Invalid payment status");

        // todo: validate proof is by sender
    }

    /**
     * Extracts the verification data from the data. In case of a Reclaim/TLSN/ZK proof, data contains the attester's address.
     * In case of a zkEmail proof, data contains the DKIM key hash. Can also contain additional data like currency code, etc.
     *
     * @param _data The data to extract the verification data from.
     */
    function _decodeDepositData(bytes calldata _data) internal pure returns (address[] memory witnesses) {
        witnesses = abi.decode(_data, (address[]));
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
            // values[2] is url_params_1
            // values[3] is url_params_2
            amountString: values[4],
            amountCentsString: values[5],
            currencyCode: values[6],
            dateString: values[7],
            paymentId: values[8],
            paymentStatus: values[9],
            paymentType: values[10],
            recipientId: values[11],
            providerHash: values[12]
        });
    }

    /**
     * Parses the amount from the proof.
     *
     * @param _amount The amount to parse.
     * @param _amountCents The cents amount to parse.
     * @param _decimals The decimals of the token.
     */
    function _parseAmount(string memory _amount, string memory _amountCents, string memory _currencyCode, uint8 _decimals) internal pure returns(uint256) {
        // Check if the amount is negative (starts with '-')
        bytes memory amountBytes = bytes(_amount);
        bool isNegative = amountBytes.length > 0 && amountBytes[0] == 0x2D; // '-' character
        
        // Different currencies may represent outgoing payments differently
        // BRL uses negative values for outgoing payments
        // ARS uses positive values for outgoing payments
        bool isBRL = keccak256(abi.encodePacked(_currencyCode)) == keccak256(abi.encodePacked("BRL"));
        
        // If negative and it's BRL, remove the '-' sign for parsing
        // For other currencies, use the value as is
        string memory amountToProcess;
        if (isNegative && isBRL) {
            amountToProcess = substring(_amount, 1, amountBytes.length);
        } else {
            amountToProcess = _amount;
        }
            
        uint256 baseAmount = amountToProcess.stringToUint(
            0x2C,  // comma character, which is the decimal character for both ARS and BRL amounts
            _decimals
        );
        uint256 centsAmount = _amountCents.stringToUint(_decimals - 2);
        
        return baseAmount + centsAmount;
    }
}