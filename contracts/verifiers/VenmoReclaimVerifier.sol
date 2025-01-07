// SPDX-License-Identifier: MIT

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { DateParsing } from "../lib/DateParsing.sol";
import { ClaimVerifier } from "../lib/ClaimVerifier.sol";
import { StringConversionUtils } from "../lib/StringConversionUtils.sol";
import { Bytes32ConversionUtils } from "../lib/Bytes32ConversionUtils.sol";

import { BaseReclaimPaymentVerifier } from "./BaseReclaimPaymentVerifier.sol";
import { INullifierRegistry } from "./nullifierRegistries/INullifierRegistry.sol";
import { IPaymentVerifier } from "./interfaces/IPaymentVerifier.sol";

pragma solidity ^0.8.18;

contract VenmoReclaimVerifier is IPaymentVerifier, BaseReclaimPaymentVerifier {

    using StringConversionUtils for string;
    using Bytes32ConversionUtils for bytes32;
    
    /* ============ Structs ============ */

    // Struct to hold the payment details extracted from the proof
    struct PaymentDetails {
        string amountString;
        string dateString;
        string paymentId;
        string recipientId;
        string intentHash;
        string providerHash;
    }

    /* ============ Constants ============ */
    
    uint8 internal constant MAX_EXTRACT_VALUES = 7; 

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
     * @param _proof            Proof to be verified
     * @param _depositToken     The deposit token locked in escrow
     * @param _intentAmount     Amount of deposit.token that the offchain payer wants to unlock from escrow
     * @param _intentTimestamp  The timestamp at which intent was created. Offchain payment must be made after this time.
     * @param _payeeDetails     The payee details (hash of the payee's Venmo ID or just raw Venmo ID; compared to recipientId in proof)
     * @param _conversionRate   The conversion rate for the deposit token to offchain USD
     * @param _depositData      Additional data required for proof verification. In this case, the attester's address.
     */
    function verifyPayment(
        bytes calldata _proof,
        address _depositToken,
        uint256 _intentAmount,
        uint256 _intentTimestamp,
        string calldata _payeeDetails,
        bytes32 /*_fiatCurrency*/,
        uint256 _conversionRate,
        bytes calldata _depositData
    )
        external 
        override
        returns (bool, bytes32)
    {
        require(msg.sender == escrow, "Only escrow can call");

        (
            PaymentDetails memory paymentDetails, 
            bool isAppclipProof
        ) = _verifyProofAndExtractValues(_proof, _depositData);
                
        _verifyPaymentDetails(
            paymentDetails, 
            _depositToken, 
            _intentAmount, 
            _intentTimestamp, 
            _payeeDetails,
            _conversionRate,
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

        verifyProofSignatures(proof, witnesses, 1);     // claim must have at least 1 signature from witnesses
        
        // Extract public values
        paymentDetails = _extractValues(proof);

        // Check provider hash (Required for Reclaim proofs)
        require(_validateProviderHash(paymentDetails.providerHash), "No valid providerHash");

        isAppclipProof = proof.isAppclipProof;
    }

    /**
     * Verifies the right _intentAmount * _conversionRate is paid to _payeeDetailsHash after 
     * _intentTimestamp + timestampBuffer on Venmo. Reverts if any of the conditions are not met.
     */
    function _verifyPaymentDetails(
        PaymentDetails memory paymentDetails,
        address _depositToken,
        uint256 _intentAmount,
        uint256 _intentTimestamp,
        string calldata _payeeDetails,
        uint256 _conversionRate,
        bool isAppclipProof
    ) internal view {
        uint256 expectedAmount = _intentAmount * _conversionRate / PRECISE_UNIT;
        uint8 decimals = IERC20Metadata(_depositToken).decimals();

        // Validate amount
        uint256 paymentAmount = paymentDetails.amountString.stringToUint(decimals);
        require(paymentAmount >= expectedAmount, "Incorrect payment amount");
        
        // Validate recipient
        if (isAppclipProof) {
            bytes32 hashedRecipientId = keccak256(abi.encodePacked(paymentDetails.recipientId));
            string memory hashedRecipientIdString = hashedRecipientId.toHexString();
            require(hashedRecipientIdString.stringComparison(_payeeDetails), "Incorrect payment recipient");
        } else {
            require(paymentDetails.recipientId.stringComparison(_payeeDetails), "Incorrect payment recipient");
        }
        
        // Validate timestamp; add in buffer to build flexibility for L2 timestamps
        uint256 paymentTimestamp = DateParsing._dateStringToTimestamp(paymentDetails.dateString) + timestampBuffer;
        require(paymentTimestamp >= _intentTimestamp, "Incorrect payment timestamp");
    }

    /**
     * Extracts the verification data from the data. In case of a Reclaim/TLSN/ZK proof, data contains the witnesses' addresses.
     * In case of a zkEmail proof, data contains the DKIM key hash. Can also contain additional data like currency code, etc.
     *
     * @param _data The data to extract the verification data from.
     */
    function _decodeDepositData(bytes calldata _data) internal view returns (address[] memory witnesses) {
        witnesses = abi.decode(_data, (address[]));
    }

    /**
     * Extracts all values from the proof context.
     *
     * @param _proof The proof containing the context to extract values from.
     */
    function _extractValues(ReclaimProof memory _proof) internal view returns (PaymentDetails memory paymentDetails) {
        string[] memory values = ClaimVerifier.extractAllFromContext(
            _proof.claimInfo.context, 
            MAX_EXTRACT_VALUES, 
            true
        );

        return PaymentDetails({
            intentHash: values[0],
            // values[1] is SENDER_ID
            amountString: values[2],
            dateString: values[3],
            paymentId: values[4],
            recipientId: values[5],
            providerHash: values[6]
        });
    }
}
