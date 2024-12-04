
// SPDX-License-Identifier: MIT

import { IPaymentVerifier } from "../verifiers/interfaces/IPaymentVerifier.sol";
import { INullifierRegistry } from "../verifiers/nullifierRegistries/INullifierRegistry.sol";

import { BasePaymentVerifier } from "../verifiers/BasePaymentVerifier.sol";

pragma solidity ^0.8.18;


contract PaymentVerifierMock is IPaymentVerifier, BasePaymentVerifier {

    struct PaymentDetails {
        uint256 amount;
        uint256 timestamp;
        bytes32 offRamperIdHash;
        bytes32 fiatCurrency;
        bytes32 intentHash;
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
    ) BasePaymentVerifier(_escrow, _nullifierRegistry, _timestampBuffer, _currencies) {}

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
        bytes calldata _proof,
        address /*_depositToken*/,
        uint256 _intentAmount,
        uint256 _intentTimestamp,
        bytes32 _payeeDetailsHash,
        bytes32 _fiatCurrency,
        uint256 _conversionRate,
        bytes calldata /*_data*/
    )
        external
        view 
        override
        returns (bool, bytes32)
    {
        PaymentDetails memory paymentDetails = _extractPaymentDetails(_proof);

        if (shouldVerifyPayment) {
            require(paymentDetails.timestamp >= _intentTimestamp, "Payment timestamp is before intent timestamp");
            require(paymentDetails.amount >= (_intentAmount * PRECISE_UNIT) / _conversionRate, "Payment amount is less than intent amount");
            require(paymentDetails.offRamperIdHash == _payeeDetailsHash, "Payment offramper does not match intent relayer");
            require(paymentDetails.fiatCurrency == _fiatCurrency, "Payment fiat currency does not match intent fiat currency");
        }
        
        if (shouldReturnFalse) {
            return (false, bytes32(0));
        }

        return (true, paymentDetails.intentHash);
    }

    function _extractPaymentDetails(bytes calldata _proof) internal pure returns (PaymentDetails memory) {
        (
            uint256 amount,
            uint256 timestamp,
            bytes32 offRamperIdHash,
            bytes32 fiatCurrency,
            bytes32 intentHash
        ) = abi.decode(_proof, (uint256, uint256, bytes32, bytes32, bytes32));

        return PaymentDetails(amount, timestamp, offRamperIdHash, fiatCurrency, intentHash);
    }
}
