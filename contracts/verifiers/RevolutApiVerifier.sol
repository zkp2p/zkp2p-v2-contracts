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

/**
 * @title RevolutApiVerifier
 * @notice Verifies Revolut Business API payment proofs using Reclaim Protocol attestations
 * @dev Extends BaseReclaimPaymentVerifier to verify dual Revolut transaction proofs for zkp2p
 */
contract RevolutApiVerifier is IPaymentVerifier, BaseReclaimPaymentVerifier {
    
    using StringConversionUtils for string;
    using Bytes32ConversionUtils for bytes32;
    
    /* ============ Structs ============ */
    
    struct PaymentDetails {
        string transactionId;
        string amountString;
        string state;
        string counterpartyId;
        string revtag;
        string timestampString;
        string intentHash;
        string transactionProviderHash;
        string counterpartyProviderHash;
    }
    
    /* ============ Constants ============ */
    
    uint8 internal constant MAX_EXTRACT_VALUES_TRANSACTION = 8;
    uint8 internal constant MAX_EXTRACT_VALUES_COUNTERPARTY = 6;
    uint8 internal constant MIN_WITNESS_SIGNATURE_REQUIRED = 1;
    bytes32 public constant COMPLETED_STATE = keccak256(abi.encodePacked("completed"));
    
    /* ============ Events ============ */
    
    event RevolutPaymentVerified(
        bytes32 indexed intentHash,
        string transactionId,
        uint256 amount,
        string counterpartyId,
        string revtag,
        uint256 timestamp
    );

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
     * @notice ONLY ESCROW: Verifies dual Reclaim proofs for a Revolut Business API payment
     * @param _verifyPaymentData Payment proof and intent details required for verification
     * @return success Whether verification succeeded  
     * @return intentHash Hash of the payment intent
     */
    function verifyPayment(
        IPaymentVerifier.VerifyPaymentData calldata _verifyPaymentData
    )
        external
        override
        returns (bool, bytes32)
    {
        require(msg.sender == escrow, "Only escrow can call");
        
        PaymentDetails memory paymentDetails = _verifyProofsAndExtractValues(
            _verifyPaymentData.paymentProof,
            _verifyPaymentData.data
        );
        
        _verifyPaymentDetails(paymentDetails, _verifyPaymentData);
        
        // Nullify the payment using transaction ID
        bytes32 nullifier = keccak256(abi.encodePacked(paymentDetails.transactionId));
        _validateAndAddNullifier(nullifier);
        
        bytes32 intentHash = bytes32(paymentDetails.intentHash.stringToUint(0));
        
        // Emit verification event
        uint256 amount = paymentDetails.amountString.stringToUint(18);
        uint256 timestamp = DateParsing._dateStringToTimestamp(paymentDetails.timestampString);
        
        emit RevolutPaymentVerified(
            intentHash,
            paymentDetails.transactionId,
            amount,
            paymentDetails.counterpartyId,
            paymentDetails.revtag,
            timestamp
        );
        
        return (true, intentHash);
    }

    /* ============ Internal Functions ============ */
    
    /**
     * @notice Verifies dual Reclaim proofs and extracts payment values
     * @param _proofs Encoded dual proof data
     * @param _depositData Witness addresses for verification
     * @return paymentDetails Extracted and validated payment details
     */
    function _verifyProofsAndExtractValues(
        bytes calldata _proofs,
        bytes calldata _depositData
    )
        internal
        view
        returns (PaymentDetails memory paymentDetails)
    {
        // Decode dual proofs: (transactionProof, counterpartyProof)
        (ReclaimProof memory transactionProof, ReclaimProof memory counterpartyProof) = 
            abi.decode(_proofs, (ReclaimProof, ReclaimProof));
            
        address[] memory witnesses = _decodeDepositData(_depositData);
        
        // Verify both proof signatures
        verifyProofSignatures(transactionProof, witnesses, MIN_WITNESS_SIGNATURE_REQUIRED);
        verifyProofSignatures(counterpartyProof, witnesses, MIN_WITNESS_SIGNATURE_REQUIRED);
        
        // Extract values from both proofs
        string[] memory transactionValues = ClaimVerifier.extractAllFromContext(
            transactionProof.claimInfo.context,
            MAX_EXTRACT_VALUES_TRANSACTION,
            true
        );
        
        string[] memory counterpartyValues = ClaimVerifier.extractAllFromContext(
            counterpartyProof.claimInfo.context,
            MAX_EXTRACT_VALUES_COUNTERPARTY,
            true
        );
        
        // CRITICAL: Add bounds checking before array access to prevent out-of-bounds errors
        require(transactionValues.length >= MAX_EXTRACT_VALUES_TRANSACTION, "Insufficient transaction values");
        require(counterpartyValues.length >= MAX_EXTRACT_VALUES_COUNTERPARTY, "Insufficient counterparty values");
        
        // Validate provider hashes
        require(_validateProviderHash(transactionValues[7]), "Invalid transaction provider hash");
        require(_validateProviderHash(counterpartyValues[5]), "Invalid counterparty provider hash");
        
        // Validate counterparty ID linkage between proofs
        require(
            transactionValues[4].stringComparison(counterpartyValues[2]),
            "Counterparty IDs do not match between proofs"
        );
        
        paymentDetails = PaymentDetails({
            // Transaction proof values: [0]=contextAddress, [1]=intentHash, [2]=transactionId, 
            // [3]=amountString, [4]=counterpartyId, [5]=state, [6]=timestampString, [7]=providerHash
            transactionId: transactionValues[2],
            amountString: transactionValues[3],
            state: transactionValues[5],
            counterpartyId: transactionValues[4],
            timestampString: transactionValues[6],
            intentHash: transactionValues[1],
            transactionProviderHash: transactionValues[7],
            // Counterparty proof values: [0]=contextAddress, [1]=intentHash, [2]=counterpartyId,
            // [3]=revtag, [4]=..., [5]=providerHash  
            revtag: counterpartyValues[3],
            counterpartyProviderHash: counterpartyValues[5]
        });
    }

    /**
     * @notice Validates payment details against verification requirements
     * @param paymentDetails Extracted payment information
     * @param _verifyPaymentData Original verification request data
     */
    function _verifyPaymentDetails(
        PaymentDetails memory paymentDetails,
        VerifyPaymentData memory _verifyPaymentData
    ) internal view {
        uint256 expectedAmount = _verifyPaymentData.intentAmount * _verifyPaymentData.conversionRate / PRECISE_UNIT;
        uint8 decimals = IERC20Metadata(_verifyPaymentData.depositToken).decimals();
        
        // Validate payment state is completed
        require(
            keccak256(abi.encodePacked(paymentDetails.state)) == COMPLETED_STATE,
            "Payment not completed"
        );
        
        // Validate amount using standardized parsing
        uint256 paymentAmount = paymentDetails.amountString.stringToUint(decimals);
        require(paymentAmount >= expectedAmount, "Incorrect payment amount");
        
        // Validate revtag matches payeeDetails (critical security check)
        require(
            paymentDetails.revtag.stringComparison(_verifyPaymentData.payeeDetails),
            "RevTag mismatch - payment not to intended recipient"
        );
        
        // Validate timestamp using standardized parsing
        uint256 paymentTimestamp = DateParsing._dateStringToTimestamp(paymentDetails.timestampString) + timestampBuffer;
        require(paymentTimestamp >= _verifyPaymentData.intentTimestamp, "Incorrect payment timestamp");
        
        // Validate currency is supported
        require(isCurrency[_verifyPaymentData.fiatCurrency], "Unsupported currency");
    }

    /**
     * @notice Decodes witness addresses from deposit data
     * @param _data Encoded witness addresses
     * @return witnesses Array of witness addresses
     */
    function _decodeDepositData(bytes calldata _data) internal pure returns (address[] memory witnesses) {
        witnesses = abi.decode(_data, (address[]));
    }

}

