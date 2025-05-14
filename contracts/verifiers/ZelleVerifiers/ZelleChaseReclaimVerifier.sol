// SPDX-License-Identifier: MIT

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { DateParsing } from "../../lib/DateParsing.sol";
import { ClaimVerifier } from "../../lib/ClaimVerifier.sol";
import { StringConversionUtils } from "../../lib/StringConversionUtils.sol";
import { Bytes32ConversionUtils } from "../../lib/Bytes32ConversionUtils.sol";

import { INullifierRegistry } from "../nullifierRegistries/INullifierRegistry.sol";
import { IPaymentVerifier } from "../interfaces/IPaymentVerifier.sol";

import { BaseReclaimVerifier } from "../BaseVerifiers/BaseReclaimVerifier.sol";

pragma solidity ^0.8.18;

contract ZelleChaseReclaimVerifier is IPaymentVerifier, BaseReclaimVerifier {
    using StringConversionUtils for string;
    using Bytes32ConversionUtils for bytes32;

    struct PaymentDetails {
        string amountString;
        string transactionDate;
        string paymentId;
        string status;
        string recipientEmail;
        string intentHash;
    }

    uint8 internal constant MAX_EXTRACT_VALUES_LIST = 7;    // for list proof
    uint8 internal constant MAX_EXTRACT_VALUES_DETAIL = 5;  // for detail proof
    uint8 internal constant MIN_WITNESS_SIGNATURE_REQUIRED = 1;
    bytes32 public constant COMPLETED_STATUS = keccak256(abi.encodePacked("COMPLETED"));
    bytes32 public constant DELIVERED_STATUS = keccak256(abi.encodePacked("DELIVERED"));

    /* ============ State Variables ============ */

    address public baseVerifier;
    INullifierRegistry public nullifierRegistry;

    constructor(
        address _baseVerifier,
        INullifierRegistry _nullifierRegistry,
        string[] memory _providerHashes
    )
        BaseReclaimVerifier(
            _providerHashes
        )
    { 
        baseVerifier = _baseVerifier;
        nullifierRegistry = INullifierRegistry(_nullifierRegistry);
    }

    /**
     * Verifies two Reclaim proofs for a Chase Zelle payment.
     * @param _verifyPaymentData Payment proof and intent details required for verification
     */
    function verifyPayment(
        IPaymentVerifier.VerifyPaymentData calldata _verifyPaymentData
    )
        external
        override
        returns (bool, bytes32)
    {
        require(msg.sender == baseVerifier, "Only base verifier can call");

        (
            PaymentDetails memory paymentDetails
        ) = _verifyProofsAndExtractValues(_verifyPaymentData.paymentProof, _verifyPaymentData.data);

        _verifyPaymentDetails(
            paymentDetails,
            _verifyPaymentData
        );

        // Nullify the payment
        _validateAndAddNullifier(keccak256(abi.encodePacked(paymentDetails.paymentId)));

        return (true, bytes32(paymentDetails.intentHash.stringToUint(0)));
    }

    function _verifyProofsAndExtractValues(bytes calldata _proofs, bytes calldata _depositData)
        internal
        view
        returns (PaymentDetails memory paymentDetails)
    {
        // Expect _proofs to be abi.encode(proofList, proofDetail)
        (ReclaimProof memory proofList, ReclaimProof memory proofDetail) = abi.decode(_proofs, (ReclaimProof, ReclaimProof));
        address[] memory witnesses = _decodeDepositData(_depositData);

        verifyProofSignatures(proofList, witnesses, MIN_WITNESS_SIGNATURE_REQUIRED);
        verifyProofSignatures(proofDetail, witnesses, MIN_WITNESS_SIGNATURE_REQUIRED);

        // Extract values from both proofs using the correct max values
        string[] memory paymentContextList = ClaimVerifier.extractAllFromContext(
            proofList.claimInfo.context,
            MAX_EXTRACT_VALUES_LIST,
            true
        );
        string[] memory paymentContextDetail = ClaimVerifier.extractAllFromContext(
            proofDetail.claimInfo.context,
            MAX_EXTRACT_VALUES_DETAIL,
            true
        );

        // Extract fields from first proof (list)
        // paymentContextList[0] = contextAddress
        // paymentContextList[1] = intentHash
        // paymentContextList[2] = amount
        // paymentContextList[3] = date
        // paymentContextList[4] = id
        // paymentContextList[5] = status
        // paymentContextList[6] = providerHash
        string memory paymentIdList = paymentContextList[4];
        string memory providerHashList = paymentContextList[6];

        // Extract fields from second proof (detail)
        // paymentContextDetail[0] = contextAddress
        // paymentContextDetail[1] = intentHash
        // paymentContextDetail[2] = PAYMENT_ID
        // paymentContextDetail[3] = recipientEmail
        // paymentContextDetail[4] = providerHash
        string memory paymentIdDetail = paymentContextDetail[2];
        string memory providerHashDetail = paymentContextDetail[4];

        // Check provider hashes
        require(_validateProviderHash(providerHashList), "No valid providerHashList");
        require(_validateProviderHash(providerHashDetail), "No valid providerHashDetail");

        // Check payment ID linkage
        require(
            keccak256(abi.encodePacked(paymentIdList)) == keccak256(abi.encodePacked(paymentIdDetail)),
            "Payment IDs do not match"
        );

        // Compose PaymentDetails
        paymentDetails = PaymentDetails({
            amountString: paymentContextList[2],
            transactionDate: paymentContextList[3],
            paymentId: paymentIdList, // paymentId from first proof
            status: paymentContextList[5],
            recipientEmail: paymentContextDetail[3],
            intentHash: paymentContextList[1] // intentHash from first proof
        });
    }

    function _verifyPaymentDetails(
        PaymentDetails memory paymentDetails,
        VerifyPaymentData memory _verifyPaymentData
    ) internal view {
        uint256 expectedAmount = _verifyPaymentData.intentAmount * _verifyPaymentData.conversionRate / PRECISE_UNIT;
        uint8 decimals = IERC20Metadata(_verifyPaymentData.depositToken).decimals();

        // Validate amount
        uint256 paymentAmount = paymentDetails.amountString.stringToUint(decimals);
        require(paymentAmount >= expectedAmount, "Incorrect payment amount");

        // Validate recipient (recipientEmail is a hash, so compare as string)
        require(
            paymentDetails.recipientEmail.stringComparison(_verifyPaymentData.payeeDetails),
            "Incorrect payment recipient"
        );

        // Validate timestamp; convert chase date string from YYYYMMDD to YYYY-MM-DD
        string memory paymentDate = _addHyphensToDateString(paymentDetails.transactionDate);
        uint256 paymentTimestamp = DateParsing._dateStringToTimestamp(
            string.concat(paymentDate, "T23:59:59")
        );
        require(paymentTimestamp >= _verifyPaymentData.intentTimestamp, "Incorrect payment timestamp");

        // Validate status
        require(
            keccak256(abi.encodePacked(paymentDetails.status)) == COMPLETED_STATUS ||
            keccak256(abi.encodePacked(paymentDetails.status)) == DELIVERED_STATUS,
            "Payment not completed or delivered"
        );
    }

    function _decodeDepositData(bytes calldata _data) internal pure returns (address[] memory witnesses) {
        witnesses = abi.decode(_data, (address[]));
    }

    function _addHyphensToDateString(string memory yyyymmdd) internal pure returns (string memory yyyymmddWithHyphens) {
        bytes memory dateBytes = bytes(yyyymmdd);
        yyyymmddWithHyphens = string(abi.encodePacked(
            bytes1(dateBytes[0]),
            bytes1(dateBytes[1]),
            bytes1(dateBytes[2]),
            bytes1(dateBytes[3]),
            "-",
            bytes1(dateBytes[4]),
            bytes1(dateBytes[5]),
            "-",
            bytes1(dateBytes[6]),
            bytes1(dateBytes[7])
        ));
    }

    function _validateAndAddNullifier(bytes32 _nullifier) internal {
        require(!nullifierRegistry.isNullified(_nullifier), "Nullifier has already been used");
        nullifierRegistry.addNullifier(_nullifier);
    }
}
