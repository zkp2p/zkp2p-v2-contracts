//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IBasePaymentVerifier } from "./IBasePaymentVerifier.sol";

interface IPaymentVerifier is IBasePaymentVerifier {

    function verifyPayment(
        bytes calldata _proof,
        address _depositToken,
        uint256 _intentAmount,
        uint256 _intentTimestamp,
        bytes32 _payeeDetailsHash,
        bytes32 _fiatCurrency,
        uint256 _conversionRate,
        bytes calldata _data
    )   
        external returns(bool success, bytes32 intentHash);

}
