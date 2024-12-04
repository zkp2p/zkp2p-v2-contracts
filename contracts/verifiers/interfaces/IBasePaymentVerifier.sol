// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface IBasePaymentVerifier {
    function getCurrencies() external view returns (string[] memory currencyCodes);
    function isCurrency(string calldata _currencyCode) external view returns (bool);
}
