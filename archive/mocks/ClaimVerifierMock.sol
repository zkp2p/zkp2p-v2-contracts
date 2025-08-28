//SPDX-License-Identifier: MIT

import { ClaimVerifier } from "../lib/ClaimVerifier.sol";

pragma solidity ^0.8.18;

contract ClaimVerifierMock {
   
    function findSubstringEndIndex(string memory data, string memory target) public pure returns (uint256) {
        return ClaimVerifier.findSubstringEndIndex(data, target);
    }

    function extractFieldFromContext(string memory data, string memory prefix) public pure returns (string memory) {
        return ClaimVerifier.extractFieldFromContext(data, prefix);
    }

    function extractAllFromContext(string memory data, uint8 maxValues, bool extractIntentAndProviderHash) public pure returns (string[] memory) {
        return ClaimVerifier.extractAllFromContext(data, maxValues, extractIntentAndProviderHash);
    }
}