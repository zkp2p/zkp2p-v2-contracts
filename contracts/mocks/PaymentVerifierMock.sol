
// SPDX-License-Identifier: MIT

import { IPaymentVerifier } from "../verifiers/interfaces/IPaymentVerifier.sol";
import { INullifierRegistry } from "../verifiers/nullifierRegistries/INullifierRegistry.sol";

pragma solidity ^0.8.18;


contract PaymentVerifierMock is IPaymentVerifier {

    uint256 internal constant PRECISE_UNIT = 1e18;

    /* ============ State Variables ============ */
    bool public shouldVerifyPayment;
    bool public shouldReturnFalse;
    

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
        uint256 _conversionRate,
        bytes32 _payeeDetailsHash,
        bytes calldata /*_data*/
    )
        external
        view 
        override
        returns (bool, bytes32)
    {
        (
            uint256 amount,
            uint256 timestamp,
            bytes32 offRamperIdHash,
            bytes32 intentHash
        ) = abi.decode(_proof, (uint256, uint256, bytes32, bytes32));

        if (shouldVerifyPayment) {
            require(timestamp >= _intentTimestamp, "Payment timestamp is before intent timestamp");
            require(amount >= (_intentAmount * PRECISE_UNIT) / _conversionRate, "Payment amount is less than intent amount");
            require(offRamperIdHash == _payeeDetailsHash, "Payment offramper does not match intent relayer");
        }
        
        if (shouldReturnFalse) {
            return (false, bytes32(0));
        }

        return (true, intentHash);
    }
}
