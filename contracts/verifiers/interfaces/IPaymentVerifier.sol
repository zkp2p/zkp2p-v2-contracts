//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IBasePaymentVerifier } from "./IBasePaymentVerifier.sol";

interface IPaymentVerifier is IBasePaymentVerifier {

    /* ============ Structs ============ */

    struct VerifyPaymentData {
        bytes paymentProof;                     // Payment proof
        address depositToken;                   // Address of deposit token locked in escrow
        uint256 intentAmount;                   // Amount of deposit token that offchain payer wants to take
        uint256 intentTimestamp;                // Timestamp at which intent was created. Offchain payment must be made after this timestamp.
        string payeeDetails;                    // Payee details (hash of payee's payment platform ID OR just raw ID)
        bytes32 fiatCurrency;                   // Fiat currency the offchain payer paid in
        uint256 conversionRate;                 // Conversion rate of deposit token to fiat currency
        bytes data;                             // Additional data required for verification (e.g. attester address)
    }

    /* ============ External Functions ============ */

    function verifyPayment(
        VerifyPaymentData calldata _verifyPaymentData
    )   
        external
        returns(bool success, bytes32 intentHash);

}
