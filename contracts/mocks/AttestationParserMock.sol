//SPDX-License-Identifier: MIT

import { AttestationParser } from "../lib/AttestationParser.sol";

pragma solidity ^0.8.18;

contract AttestationParserMock {
   
    function extractAllValues(string memory data, uint8 maxValues) public pure returns (string[] memory) {
        return AttestationParser.extractAllValues(data, maxValues);
    }
}