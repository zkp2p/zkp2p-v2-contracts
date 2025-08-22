//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface IPaymentVerifierRegistry {
    function isPaymentMethod(bytes32 _paymentMethod) external view returns (bool);
    function getPaymentMethods() external view returns (bytes32[] memory);
    function getVerifier(bytes32 _paymentMethod) external view returns (address);
    function isCurrency(bytes32 _paymentMethod, bytes32 _currencyCode) external view returns (bool);
    function getCurrencies(bytes32 _paymentMethod) external view returns (bytes32[] memory);
}
