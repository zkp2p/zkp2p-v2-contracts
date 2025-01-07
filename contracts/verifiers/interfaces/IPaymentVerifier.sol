//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IBasePaymentVerifier } from "./IBasePaymentVerifier.sol";

interface IPaymentVerifier is IBasePaymentVerifier {

    /* ============ Structs ============ */

    struct VerifyPaymentData {
        bytes paymentProof;                     // Payment proof
        address depositToken;                   // Address of deposit token
        uint256 amount;                         // Amount of deposit token
        uint256 timestamp;                      // Timestamp of payment
        string payeeDetails;                    // Payee details
        bytes32 fiatCurrency;                   // Fiat currency
        uint256 conversionRate;                 // Conversion rate of deposit token to fiat currency
        bytes data;                             // Additional data
    }

    /* ============ External Functions ============ */

    function verifyPayment(
        VerifyPaymentData calldata _verifyPaymentData
    )   
        external
        returns(bool success, bytes32 intentHash);

}
