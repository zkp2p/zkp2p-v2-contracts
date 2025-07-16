// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library AttestationParser {
    
    /* ============ Internal Functions ============ */

    /**
     * Extracts ALL values from a JSON object in a single pass. Inspired by ClaimVerifier's
     * extractAllFromContext but adapted for simple flat JSON objects.
     * 
     * Example input: {"date":"1752481340000","recvId":"869365669","amt":"10.0"}
     * Example output: ["1752481340000", "869365669", "10.0"]
     * 
     * @param data          JSON string from which values need to be extracted
     * @param maxValues     Maximum number of values to extract
     * @return values       Array of extracted values in the order they appear
     */
    function extractAllValues(
        string memory data,
        uint8 maxValues
    ) internal pure returns (string[] memory) {
        require(maxValues > 0, "Max values must be greater than 0");
        
        bytes memory dataBytes = bytes(data);
        require(dataBytes.length > 0, "Empty data");
        
        // Reuse variables to avoid "stack too deep"
        uint index = 0;
        uint valuesFound = 0;
        uint startIndex;
        uint endIndex;
        bool isValue = false;
        
        // Pre-allocate array for storing start and end indices of values
        uint[] memory valueIndices = new uint[](2 * maxValues);
        
        // Find opening brace
        require(dataBytes[0] == 0x7b, "Data must start with {");
        index += 1;

        // Main parsing loop
        while (index < dataBytes.length) {
            // Keep incrementing until we find a quote that's not escaped
            if (!(dataBytes[index] == 0x22 && (index == 0 || dataBytes[index - 1] != 0x5c))) {
                index++;
                continue;
            }
            
            if (!isValue) {
                // We're at the opening quote of a key, skip to find the closing quote
                index++; // Move past opening quote
                while (index < dataBytes.length && !(dataBytes[index] == 0x22 && dataBytes[index - 1] != 0x5c)) {
                    index++;
                }
                require(index < dataBytes.length, "Extraction failed. Key not closed");
                
                // Now we're at the closing quote of the key, expect ":"
                require(
                    index + 2 < dataBytes.length && 
                    dataBytes[index + 1] == 0x3a && 
                    dataBytes[index + 2] == 0x22,
                    "Extraction failed. Expected :\" after key"
                );
                index += 3; // Move past :" to start of value
                isValue = true;
                // Mark start of value
                valueIndices[2 * valuesFound] = index;
            } else {
                // We're at the end of a value
                valueIndices[2 * valuesFound + 1] = index; // Mark end of value
                valuesFound++;
                
                // Check what comes after the value
                if (index + 1 < dataBytes.length) {
                    if (dataBytes[index + 1] == 0x2c) {
                        // More key-value pairs to come
                        require(valuesFound < maxValues, "Extraction failed. Exceeded max values");
                        // Check for quote after comma
                        require(
                            index + 2 < dataBytes.length && dataBytes[index + 2] == 0x22,
                            "Extraction failed. Expected \" after ,"
                        );
                        // Move past the comma
                        index += 2; // Move past ,"
                        isValue = false;
                    } else if (dataBytes[index + 1] == 0x7d) {
                        // End of JSON object
                        isValue = false; // Mark that we're done with values
                        index += 2; // Move past }
                        break;
                    } else {
                        revert("Extraction failed. Expected , or } after value");
                    }
                } else {
                    revert("Extraction failed. Unexpected end of data");
                }
            }
        }
        
        // Check if we ended while still expecting a value's closing quote
        require(!isValue, "Extraction failed. Unexpected end of data");
        
        // Build result array with actual values
        string[] memory values = new string[](valuesFound);
        for (uint i = 0; i < valuesFound; i++) {
            startIndex = valueIndices[2 * i];
            endIndex = valueIndices[2 * i + 1];
            bytes memory value = new bytes(endIndex - startIndex);
            for (uint j = startIndex; j < endIndex; j++) {
                value[j - startIndex] = dataBytes[j];
            }
            values[i] = string(value);
        }
        
        return values;
    }
}