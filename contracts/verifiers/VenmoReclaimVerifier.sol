// SPDX-License-Identifier: MIT

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { DateParsing } from "../lib/DateParsing.sol";
import { ClaimVerifier } from "../lib/ClaimVerifier.sol";
import { StringConversionUtils } from "../lib/StringConversionUtils.sol";
import { INullifierRegistry } from "./nullifierRegistries/INullifierRegistry.sol";

import { IPaymentVerifier } from "./interfaces/IPaymentVerifier.sol";
import { BaseReclaimPaymentVerifier } from "./BaseReclaimPaymentVerifier.sol";

pragma solidity ^0.8.18;

import "hardhat/console.sol";

// todo: add lots of comments

contract VenmoReclaimVerifier is IPaymentVerifier, BaseReclaimPaymentVerifier {

    using StringConversionUtils for string;

    /* ============ Events ============ */

    /* ============ Constants ============ */
    uint8 internal constant MAX_EXTRACT_VALUES = 6;
    uint256 internal constant PRECISE_UNIT = 1e18;    

    /* ============ Constructor ============ */
    constructor(
        address _ramp,
        INullifierRegistry _nullifierRegistry,
        string[] memory _providerHashes,
        uint256 _timestampBuffer
    )   
        BaseReclaimPaymentVerifier(
            _ramp, 
            _nullifierRegistry, 
            _timestampBuffer, 
            _providerHashes
        )
    { }

    /* ============ External Functions ============ */

    /**
     * ONLY RAMP: Verifies proof. Checks payment details.
     *
     * @param _proof            Proof to be verified
     * @param _depositToken     The deposit token
     * @param _intentAmount     The intent amount
     * @param _intentTimestamp  The intent timestamp
     * @param _conversionRate   The conversion rate
     * @param _payeeDetailsHash The payee details hash
     * @param _data             The data
     */
    function verifyPayment(
        bytes calldata _proof,
        address _depositToken,
        uint256 _intentAmount,
        uint256 _intentTimestamp,
        uint256 _conversionRate,
        bytes32 _payeeDetailsHash,
        bytes calldata _data
    )
        external 
        override
        returns (bool, bytes32)
    {
        require(msg.sender == ramp, "Only ramp can call");

        // Decode the proof and deposit data
        ReclaimProof memory proof = abi.decode(_proof, (ReclaimProof));
        address attester = _extractVerificationData(_data);

        // Verify proof
        address[] memory witnesses = new address[](1);
        witnesses[0] = attester;
        verifyProofSignatures(proof, witnesses);
        
        // Extract public values
        (
            string memory amountString,
            string memory dateString,
            string memory paymentId,
            string memory recipientId,
            string memory intentHash,
            string memory providerHash
        ) = _extractValues(proof);

        // Check provider hash (Required for Reclaim proofs)
        require(_validateProviderHash(providerHash), "No valid providerHash");


        uint256 expectedAmount = _intentAmount * PRECISE_UNIT / _conversionRate;
        
        // Payment details
        // todo: is this correct?
        uint8 decimals = IERC20Metadata(_depositToken).decimals();
        uint256 paymentAmount = amountString.stringToUint(decimals);
        uint256 paymentTimestamp = DateParsing._dateStringToTimestamp(dateString) + timestampBuffer;
        bytes32 paymentRecipient = hexStringToBytes32(recipientId);
    
        // Confirm payment details
        require(paymentTimestamp >= _intentTimestamp, "Incorrect payment timestamp");
        require(paymentAmount >= expectedAmount, "Incorrect payment amount");
        require(paymentRecipient == _payeeDetailsHash, "Incorrect payment recipient");
        
        // Nullify the payment
        _validateAndAddNullifier(keccak256(abi.encodePacked(paymentId)));

        return (true, hexStringToBytes32(intentHash));
    }

    /* ============ Internal Functions ============ */

    /**
     * Extracts the verification data from the data. This could also be used to extract 
     * other values from the deposit data if needed.
     *
     * @param _data The data to extract the verification data from.
     */
    function _extractVerificationData(bytes calldata _data) internal pure returns (address attester) {
        attester = abi.decode(_data, (address));
    }

    /**
     * Extracts all values from the proof context.
     *
     * @param _proof The proof containing the context to extract values from.
     */
    function _extractValues(ReclaimProof memory _proof) internal pure returns (
        string memory amountString,
        string memory dateString,
        string memory paymentId,
        string memory recipientVenmoId,
        string memory intentHash,
        string memory providerHash
    ) {
        string[] memory values = ClaimVerifier.extractAllFromContext(
            _proof.claimInfo.context, 
            MAX_EXTRACT_VALUES, 
            true
        );

        return (
            values[0], // amountString
            values[1], // dateString
            values[2], // paymentId
            values[3], // recipientVenmoId
            values[4], // intentHash
            values[5]  // providerHash
        );
    }

    function hexStringToBytes32(string memory s) public pure returns (bytes32) {
        bytes memory b = bytes(s);

        // Check if the string has the correct length (66 characters: '0x' + 64 hex digits)
        require(b.length == 66, "Invalid hex string length");

        uint256 result = 0;

        // Skip the '0x' prefix
        for (uint256 i = 2; i < 66; i += 2) {
            uint8 high = _fromHexChar(uint8(b[i]));
            uint8 low = _fromHexChar(uint8(b[i + 1]));
            uint8 byteValue = (high << 4) | low;
            result = (result << 8) | byteValue;
        }

        return bytes32(result);
    }

    function _fromHexChar(uint8 c) internal pure returns (uint8) {
        if (c >= uint8(bytes1('0')) && c <= uint8(bytes1('9'))) {
            return c - uint8(bytes1('0'));
        } else if (c >= uint8(bytes1('a')) && c <= uint8(bytes1('f'))) {
            return 10 + c - uint8(bytes1('a'));
        } else if (c >= uint8(bytes1('A')) && c <= uint8(bytes1('F'))) {
            return 10 + c - uint8(bytes1('A'));
        } else {
            revert("Invalid hex character");
        }
    }
}
