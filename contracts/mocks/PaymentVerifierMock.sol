// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IPaymentVerifier } from "../interfaces/IPaymentVerifier.sol";

contract PaymentVerifierMock is IPaymentVerifier {

    struct PaymentDetails {
        uint256 amount;
        uint256 timestamp;
        bytes32 payeeDetails;
        bytes32 fiatCurrency;
        bytes32 intentHash;
    }

    uint256 internal constant PRECISE_UNIT = 1e18;

    bool public shouldVerifyPayment;
    bool public shouldReturnFalse;

    constructor(
        address,
        address,
        uint256,
        bytes32[] memory
    ) {}

    function setShouldVerifyPayment(bool _shouldVerifyPayment) external {
      shouldVerifyPayment = _shouldVerifyPayment;
    }

    function setShouldReturnFalse(bool _shouldReturnFalse) external {
      shouldReturnFalse = _shouldReturnFalse;
    }

    function extractIntentHash(bytes calldata _proof) external pure returns (bytes32) {
      (, , , bytes32 intentHash) = abi.decode(_proof, (uint256, uint256, bytes32, bytes32));
      return intentHash;
    }

    function verifyPayment(
        IPaymentVerifier.VerifyPaymentData calldata _verifyPaymentData
    )
        external
        view
        override
        returns (PaymentVerificationResult memory)
    {
        PaymentDetails memory paymentDetails = _extractPaymentDetails(_verifyPaymentData.paymentProof);

        uint256 intentAmount;
        uint256 conversionRate;
        uint256 intentTimestamp;
        bytes32 expectedPayeeDetails;

        if (_verifyPaymentData.data.length > 0) {
            (intentAmount, conversionRate, intentTimestamp, expectedPayeeDetails) = abi.decode(
                _verifyPaymentData.data,
                (uint256, uint256, uint256, bytes32)
            );
        }

        if (shouldVerifyPayment) {
            require(intentTimestamp == 0 || paymentDetails.timestamp >= intentTimestamp, "Payment timestamp is before intent timestamp");
            require(conversionRate > 0, "Conversion rate must be positive");
            require(
                expectedPayeeDetails == bytes32(0) || paymentDetails.payeeDetails == expectedPayeeDetails,
                "Payment payee mismatch"
            );
        }

        if (shouldReturnFalse) {
            return PaymentVerificationResult({ success: false, intentHash: bytes32(0), releaseAmount: 0 });
        }

        uint256 releaseAmount = paymentDetails.amount;
        if (conversionRate > 0) {
            releaseAmount = (paymentDetails.amount * PRECISE_UNIT) / conversionRate;
        }

        if (intentAmount > 0 && releaseAmount > intentAmount) {
            releaseAmount = intentAmount;
        }

        return PaymentVerificationResult({
            success: true,
            intentHash: paymentDetails.intentHash,
            releaseAmount: releaseAmount
        });
    }

    function _extractPaymentDetails(bytes calldata _proof) internal pure returns (PaymentDetails memory) {
        (uint256 amount, uint256 timestamp, bytes32 payeeDetails, bytes32 fiatCurrency, bytes32 intentHash) =
            abi.decode(_proof, (uint256, uint256, bytes32, bytes32, bytes32));

        return PaymentDetails(amount, timestamp, payeeDetails, fiatCurrency, intentHash);
    }
}
