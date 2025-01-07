//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

library Bytes32ConversionUtils {

    /// @notice Convert a bytes32 value into its hex string representation WITH '0x' prefix.
    /// @dev Resulting string is 66 characters long: 
    ///      - 2 chars for "0x" 
    ///      - 64 chars for the hex digits.
    function toHexString(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        // 66 = 2 (for "0x") + 64 (for 32 bytes * 2 hex chars each)
        bytes memory str = new bytes(66);

        // Add '0x' prefix
        str[0] = '0';
        str[1] = 'x';

        for (uint i = 0; i < 32; i++) {
            // Each byte splits into two hex characters.
            // High nibble (4 bits)
            str[2 + 2*i]   = alphabet[uint(uint8(data[i] >> 4))];
            // Low nibble (4 bits)
            str[3 + 2*i] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }
}
