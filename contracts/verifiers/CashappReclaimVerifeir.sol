// SPDX-License-Identifier: MIT

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { ClaimVerifier } from "../lib/ClaimVerifier.sol";
import { DateParsing } from "../lib/DateParsing.sol";
import { StringConversionUtils } from "../lib/StringConversionUtils.sol";
import { Bytes32ConversionUtils } from "../lib/Bytes32ConversionUtils.sol";

import { BaseReclaimPaymentVerifier } from "./BaseVerifiers/BaseReclaimPaymentVerifier.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";
import { IPaymentVerifier } from "./interfaces/IPaymentVerifier.sol";

pragma solidity ^0.8.18;

contract CashappReclaimVerifier is IPaymentVerifier, BaseReclaimPaymentVerifier {

    using StringConversionUtils for string;
    using Bytes32ConversionUtils for bytes32;

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

    /* ============ Constants ============ */
    
    uint8 internal constant MAX_EXTRACT_VALUES = 10;
    uint8 internal constant MIN_WITNESS_SIGNATURE_REQUIRED = 1;
    bytes32 public constant COMPLETE_PAYMENT_STATUS = keccak256(abi.encodePacked("COMPLETE"));

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
     * ONLY RAMP: Verifies a reclaim proof of an offchain Revolut payment. Ensures the right _intentAmount * _conversionRate
     * USD was paid to _payeeDetails after _intentTimestamp + timestampBuffer on Revolut.
     * Additionaly, checks the right fiatCurrency was paid and the payment status is COMPLETE.
     *
     * @param _verifyPaymentData Payment proof and intent details required for verification
     * @return success Whether the payment verification succeeded
     * @return intentHash The hash of the intent being fulfilled
     * @return releaseAmount The amount of tokens to release based on actual payment and conversion rate
     */
    function verifyPayment(
        IPaymentVerifier.VerifyPaymentData calldata _verifyPaymentData
    )
        external 
        override
        returns (bool, bytes32, uint256)
    {
        require(msg.sender == escrow, "Only escrow can call");

        (
            PaymentDetails memory paymentDetails,
            bool isAppclipProof
        ) = _verifyProofAndExtractValues(_verifyPaymentData.paymentProof, _verifyPaymentData.data);
                
        uint256 paymentAmount = _verifyPaymentDetails(
            paymentDetails, 
            _verifyPaymentData,
            isAppclipProof
        );

        uint256 releaseAmount = _calculateReleaseAmount(
            paymentAmount, 
            _verifyPaymentData.conversionRate, 
            _verifyPaymentData.intentAmount
        );
        
        // Nullify the payment
        _validateAndAddNullifier(keccak256(abi.encodePacked(paymentDetails.paymentId)));

        bytes32 intentHash = bytes32(paymentDetails.intentHash.stringToUint(0));

        return (true, intentHash, releaseAmount);
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
     * Verifies that payment was made to _payeeDetailsHash after _intentTimestamp + timestampBuffer on Cashapp. 
     * Additionaly, checks the right fiatCurrency was paid and the payment status is COMPLETED. Reverts if any 
     * of the conditions are not met.
     * Returns the actual payment amount.
     */
    function _verifyPaymentDetails(
        PaymentDetails memory paymentDetails,
        VerifyPaymentData memory _verifyPaymentData,
        bool _isAppclipProof
    ) internal view returns (uint256) {
        uint8 decimals = IERC20Metadata(_verifyPaymentData.depositToken).decimals();

        // Validate amount - Allow partial payments but ensure payment amount > 0
        uint256 paymentAmount = _parseAmount(paymentDetails.amountString, decimals);
        require(paymentAmount > 0, "Payment amount must be greater than zero");
        
        // Validate recipient
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
        
        // Validate timestamp; Divide by 1000 to convert to seconds and add in buffer to build flexibility
        // for L2 timestamps
        uint256 paymentTimestamp = paymentDetails.timestampString.stringToUint(0) / 1000 + timestampBuffer;
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

        return paymentAmount;
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
            // values[2] is SENDER_ID
            amountString: values[3],
            currencyCode: values[4],
            timestampString: values[5],
            paymentId: values[6],
            recipientId: values[7],
            paymentStatus: values[8],
            providerHash: values[9]
        });
    }

    /**
     * Parses the amount from the proof.
     *
     * @param _amount The amount to parse.
     * @param _decimals The decimals of the token.
     */
    function _parseAmount(string memory _amount, uint8 _decimals) internal pure returns(uint256) {
        // Cashapp amount is scaled by 100 (e.g. $1 => 100)
        return _amount.stringToUint(_decimals - 2);
    }
}
