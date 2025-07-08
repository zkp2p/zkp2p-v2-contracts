//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface IRelayerRegistry {
    function isWhitelistedRelayer(address _relayer) external view returns (bool);
    function getWhitelistedRelayers() external view returns (address[] memory);
}
