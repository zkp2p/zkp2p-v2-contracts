// SPDX-License-Identifier: MIT

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { DateParsing } from "../lib/DateParsing.sol";
import { ClaimVerifier } from "../lib/ClaimVerifier.sol";
import { StringConversionUtils } from "../lib/StringConversionUtils.sol";
import { Bytes32ConversionUtils } from "../lib/Bytes32ConversionUtils.sol";

import { BaseReclaimPaymentVerifier } from "./BaseVerifiers/BaseReclaimPaymentVerifier.sol";
import { INullifierRegistry } from "./nullifierRegistries/INullifierRegistry.sol";
import { IPaymentVerifier } from "./interfaces/IPaymentVerifier.sol";

pragma solidity ^0.8.18;

contract PaypalReclaimVerifier is IPaymentVerifier, BaseReclaimPaymentVerifier {

    using StringConversionUtils for string;
    using Bytes32ConversionUtils for bytes32;
    
    /* ============ Structs ============ */

    // Struct to hold the payment details extracted from the proof
    struct PaymentDetails {
        string amountString;
        string dateString;
        string currencyCode;
        string paymentId;
        string paymentStatus;
        string recipientId;
        string intentHash;
        string providerHash;
    }

    /* ============ Constants ============ */
    
    uint8 internal constant MAX_EXTRACT_VALUES = 11; 
    uint8 internal constant MIN_WITNESS_SIGNATURE_REQUIRED = 1;
    bytes32 public constant COMPLETE_PAYMENT_STATUS = keccak256(abi.encodePacked("COMPLETED"));

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
     * ONLY RAMP: Verifies a reclaim proof of an offchain Venmo payment. Ensures the right _intentAmount * _conversionRate
     * USD was paid to _payeeDetails after _intentTimestamp + timestampBuffer on Venmo.
     * Note: For Venmo fiat currency is always USD. For other verifiers which support multiple currencies,
     * _fiatCurrency needs to be checked against the fiat currency in the proof.
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

        // Nullify the payment
        bytes32 nullifier = keccak256(abi.encodePacked(paymentDetails.paymentId));
        _validateAndAddNullifier(nullifier);

        bytes32 intentHash = bytes32(paymentDetails.intentHash.stringToUint(0));
        
        return (true, intentHash);
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
     * _intentTimestamp + timestampBuffer on Paypal. Reverts if any of the conditions are not met.
     */
    function _verifyPaymentDetails(
        PaymentDetails memory paymentDetails,
        VerifyPaymentData memory _verifyPaymentData,
        bool /*_isAppclipProof*/
    ) internal view {
        uint256 expectedAmount = _verifyPaymentData.intentAmount * _verifyPaymentData.conversionRate / PRECISE_UNIT;
        uint8 decimals = IERC20Metadata(_verifyPaymentData.depositToken).decimals();

        // Validate amount
        uint256 paymentAmount = paymentDetails.amountString.stringToUint(decimals);
        require(paymentAmount >= expectedAmount, "Incorrect payment amount");
        
        // Validate recipient  
        require(
            paymentDetails.recipientId.stringComparison(_verifyPaymentData.payeeDetails), 
            "Incorrect payment recipient"
        );
    
        // Validate timestamp; add in buffer to build flexibility for L2 timestamps
        uint256 paymentTimestamp = DateParsing._dateStringToTimestamp(paymentDetails.dateString) + timestampBuffer;
        require(paymentTimestamp >= _verifyPaymentData.intentTimestamp, "Incorrect payment timestamp");

        // Validate currency
        require(
            keccak256(abi.encodePacked(paymentDetails.currencyCode)) == _verifyPaymentData.fiatCurrency,
            "Incorrect payment currency"
        );

        // Validate status
        require(
            keccak256(abi.encodePacked(paymentDetails.paymentStatus)) == COMPLETE_PAYMENT_STATUS,
            "Invalid payment status"
        );
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
            paymentId: values[2],
            currencyCode: values[3],
            recipientId: values[4],
            dateString: values[5],
            paymentStatus: values[6],
            amountString: values[7],
            providerHash: values[8]
        });
    }
}
