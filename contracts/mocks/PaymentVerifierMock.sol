// SPDX-License-Identifier: MIT

import { IPaymentVerifier } from "../interfaces/IPaymentVerifier.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";
import { Bytes32ArrayUtils } from "../external/Bytes32ArrayUtils.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity ^0.8.18;

contract PaymentVerifierMock is IPaymentVerifier {

    struct PaymentDetails {
        uint256 amount;
        uint256 timestamp;
        bytes32 offRamperId;
        bytes32 fiatCurrency;
        bytes32 intentHash;
        uint256 releaseAmount;
    }

    uint256 internal constant PRECISE_UNIT = 1e18;

    /* ============ State Variables ============ */
    bool public shouldVerifyPayment;
    bool public shouldReturnFalse;

    /* ============ Constructor ============ */
    constructor(
        address _escrow,
        INullifierRegistry _nullifierRegistry,
        uint256 _timestampBuffer,
        bytes32[] memory _currencies
    )  {}

    /* ============ External Functions ============ */

    function setShouldVerifyPayment(bool _shouldVerifyPayment) external {
        shouldVerifyPayment = _shouldVerifyPayment;
    }

    function setShouldReturnFalse(bool _shouldReturnFalse) external {
        shouldReturnFalse = _shouldReturnFalse;
    }

    function extractIntentHash(bytes calldata _proof) external pure returns (bytes32) {
        (
            ,
            ,
            ,
            bytes32 intentHash
        ) = abi.decode(_proof, (uint256, uint256, bytes32, bytes32));

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

        if (shouldVerifyPayment) {
            require(paymentDetails.timestamp >= _verifyPaymentData.intentTimestamp, "Payment timestamp is before intent timestamp");
            require(paymentDetails.amount >= 0, "Payment amount cannot be zero");
            require(paymentDetails.offRamperId == _verifyPaymentData.payeeDetails, "Payment offramper does not match intent relayer");
        }
        
        if (shouldReturnFalse) {
            return PaymentVerificationResult({
                success: false,
                intentHash: bytes32(0),
                releaseAmount: 0
            });
        }

        // Calculate release amount based on payment amount and conversion rate
        uint256 releaseAmount = (paymentDetails.amount * PRECISE_UNIT) / _verifyPaymentData.conversionRate;
        
        // Cap release amount at intent amount
        if (releaseAmount > _verifyPaymentData.intentAmount) {
            releaseAmount = _verifyPaymentData.intentAmount;
        }

        return PaymentVerificationResult({
            success: true,
            intentHash: paymentDetails.intentHash,
            releaseAmount: releaseAmount
        });
    }

    function _extractPaymentDetails(bytes calldata _proof) internal pure returns (PaymentDetails memory) {
        (
            uint256 amount,
            uint256 timestamp,
            bytes32 offRamperId,
            bytes32 fiatCurrency,
            bytes32 intentHash
        ) = abi.decode(_proof, (uint256, uint256, bytes32, bytes32, bytes32));

        return PaymentDetails(amount, timestamp, offRamperId, fiatCurrency, intentHash, amount);
    }
}
