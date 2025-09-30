//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;


interface IPaymentVerifier {

    /* ============ Structs ============ */

    struct VerifyPaymentData {
        bytes32 intentHash;                     // The hash of the intent being fulfilled
        bytes paymentProof;                     // Payment proof
        bytes data;                             // Additional data provided by the taker
    }

    struct PaymentVerificationResult {
        bool success;                           // Whether the payment verification succeeded
        bytes32 intentHash;                     // The hash of the intent being fulfilled
        uint256 releaseAmount;                  // The amount of tokens to release
    }

    /* ============ External Functions ============ */

    function verifyPayment(
        VerifyPaymentData calldata _verifyPaymentData
    )   
        external
        returns(PaymentVerificationResult memory result);

}
