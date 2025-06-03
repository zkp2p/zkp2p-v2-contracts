//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface IEscrowRegistry {
    function isWhitelistedEscrow(address _escrow) external view returns (bool);
    function isAcceptingAllEscrows() external view returns (bool);
    function getWhitelistedEscrows() external view returns (address[] memory);
}