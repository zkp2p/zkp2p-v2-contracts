// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface IBasePaymentVerifier {
    function getCurrencies() external view returns (bytes32[] memory currencyCodes);
    function isCurrency(bytes32 _currencyCode) external view returns (bool);
}
