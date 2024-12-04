//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IBasePaymentVerifier } from "./IBasePaymentVerifier.sol";

interface IPaymentVerifier is IBasePaymentVerifier {

    function verifyPayment(
        bytes calldata _proof,
        address _depositToken,
        uint256 _intentAmount,
        uint256 _intentTimestamp,
        uint256 _conversionRate,
        bytes32 _payeeDetailsHash,
        bytes calldata _data
    )   
        external returns(bool success, bytes32 intentHash);

}
