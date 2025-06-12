//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface IPaymentVerifierRegistry {
    function isWhitelistedVerifier(address _verifier) external view returns (bool);
    function isAcceptingAllVerifiers() external view returns (bool);
    function getWhitelistedVerifiers() external view returns (address[] memory);
}
