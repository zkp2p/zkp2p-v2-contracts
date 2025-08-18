//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;


interface IPaymentVerifier {

    /* ============ Structs ============ */

    struct VerifyPaymentData {
        bytes paymentProof;                     // Payment proof
        address depositToken;                   // Address of deposit token locked in escrow
        uint256 intentAmount;                   // Amount of deposit token that offchain payer wants to take
        uint256 intentTimestamp;                // Timestamp at which intent was created. Offchain payment must be made after this timestamp.
        string payeeDetails;                    // Payee details (hash of payee's payment platform ID OR just raw ID)
        bytes32 fiatCurrency;                   // Fiat currency the offchain payer paid in
        uint256 conversionRate;                 // Conversion rate of deposit token to fiat currency
        bytes depositData;                      // Additional data provided by the depositor (e.g. witness signatures)
        bytes data;                             // Additional data provided by the taker (e.g. currency price etc.)
    }

    struct PaymentVerificationResult {
        bool success;                           // Whether the payment verification succeeded
        bytes32 intentHash;                     // The hash of the intent being fulfilled
        uint256 releaseAmount;                  // The amount of tokens to release
        bytes32 paymentCurrency;                // The currency that was actually paid (for indexing)
        string paymentId;                       // The payment ID from the payment platform (for reconciliation)
    }

    /* ============ External Functions ============ */

    function verifyPayment(
        VerifyPaymentData calldata _verifyPaymentData
    )   
        external
        returns(PaymentVerificationResult memory result);

}
