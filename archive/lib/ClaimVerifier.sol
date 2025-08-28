// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library ClaimVerifier {
    
    /* ============ Constants ============ */

    bytes constant CONTEXT_ADDRESS_BYTES      = bytes("{\"contextAddress\":\"");
    bytes constant CONTEXT_MESSAGE_BYTES      = bytes("\"contextMessage\":\"");
    bytes constant EXTRACTED_PARAMETERS_BYTES = bytes("\"extractedParameters\":{\"");
    bytes constant PROVIDER_HASH_PARAM_BYTES  = bytes("\"providerHash\":\"");

    /* ============ Internal Functions ============ */

    /**
     * Find the end index of target string in the data string. Returns the end index + 1 if
     * the target string in the data string if found. Returns type(uint256).max if:
     * - Target is longer than data
     * - Target is not found
     * Parts of the code are adapted from: https://basescan.org/address/0x7281630e4346dd4c0b7ae3b4689c1d0102741410#code
     */
    function findSubstringEndIndex(
        string memory data,
        string memory target
    ) internal pure returns (uint256) {
        bytes memory dataBytes = bytes(data);
        bytes memory targetBytes = bytes(target);

        if (dataBytes.length < targetBytes.length) {
            return type(uint256).max;
        }

        // Find start of target
        for (uint i = 0; i <= dataBytes.length - targetBytes.length; i++) {
            bool isMatch = true;
            for (uint j = 0; j < targetBytes.length && isMatch; j++) {
                if (dataBytes[i + j] != targetBytes[j]) {
                    isMatch = false;
                    break;
                }
            }
            if (isMatch) {
                return i + targetBytes.length; // Return end index + 1
            }
        }
        return type(uint256).max;
    }

    /**
     * Extracts given target field value from context in claims. Extracts only ONE value.
     * Pass prefix formatted with quotes, for example '"providerHash\":\"'
     * Parts of the code are adapted from: https://basescan.org/address/0x7281630e4346dd4c0b7ae3b4689c1d0102741410#code
     *
     * @param data      Context string from which target value needs to be extracted
     * @param prefix    Prefix of the target value that needs to be extracted            
     */
    function extractFieldFromContext(
        string memory data,
        string memory prefix
    ) internal pure returns (string memory) {
        // Find end index of prefix; which is the start index of the value
        uint256 start = findSubstringEndIndex(data, prefix);
        bytes memory dataBytes = bytes(data);
        if (start == dataBytes.length) {
            return ""; // Prefix not found. Malformed or missing message
        }

        // Find the end of the VALUE, assuming it ends with a quote not preceded by a backslash
        uint256 end = start;
        while (
            end < dataBytes.length &&
            !(dataBytes[end] == '"' && dataBytes[end - 1] != "\\")
        ) {
            end++;
        }
        if (end <= start) {
            return ""; // Malformed or missing message
        }
        bytes memory contextMessage = new bytes(end - start);
        for (uint i = start; i < end; i++) {
            contextMessage[i - start] = dataBytes[i];
        }
        return string(contextMessage);
    }

    /**
     * Extracts ALL values from context in a single pass. Context is stored as serialized JSON string with 
     * two keys: extractedParameters and providerHash. ExtractedParameters itself is a JSON string with 
     * key-value pairs. This function returns extracted individual values from extractedParameters along 
     * with providerHash (if extractProviderHash is true). Use maxValues to limit the number of expected values
     * to be extracted from extractedParameters. In most cases, one would need to extract all values from
     * extractedParameters and providerHash, hence use this function over calling extractFieldFromContext 
     * multiple times.
     * 
     * @param data                  Context string from which target value needs to be extracted
     * @param maxValues             Maximum number of values to be extracted from extractedParameters including intentHash and providerHash
     * @param extractIntentAndProviderHash Extracts and returns intentHash and providerHash if true
     */
    function extractAllFromContext(
        string memory data,
        uint8 maxValues,
        bool extractIntentAndProviderHash
    ) internal pure returns (string[] memory) {
        require(maxValues > 0, "Max values must be greater than 0");

        bytes memory dataBytes = bytes(data);
        
        // Reuse variables to avoid "stack too deep"
        uint index = 0;
        uint valuesFound = 0;
        uint startIndex;
        uint endIndex;
        bool isValue;

        uint[] memory valueIndices = new uint[](2 * maxValues);

        // Extract context address
        for (uint i = 0; i < CONTEXT_ADDRESS_BYTES.length; i++) {
            require(
                dataBytes[index + i] == CONTEXT_ADDRESS_BYTES[i],
                "Extraction failed. Malformed contextAddress"
            );
        }
        index += CONTEXT_ADDRESS_BYTES.length;

        // Extract context address value if it exists
        startIndex = index;
        while (
            index < dataBytes.length &&
            !(dataBytes[index] == '"' && dataBytes[index - 1] != "\\")
        ) {
            index++;
        }
        require(index < dataBytes.length, "Extraction failed. Malformed contextAddress");
        endIndex = index;
        if (endIndex == startIndex) {
            revert("Extraction failed. Empty contextAddress value");
        }
        valueIndices[2 * valuesFound] = startIndex;
        valueIndices[2 * valuesFound + 1] = endIndex;
        valuesFound++;
        index += 2; // move past the closing quote and comma

        // Extract context message
        for (uint i = 0; i < CONTEXT_MESSAGE_BYTES.length; i++) {
            require(
                dataBytes[index + i] == CONTEXT_MESSAGE_BYTES[i],
                "Extraction failed. Malformed contextMessage"
            );
        }
        index += CONTEXT_MESSAGE_BYTES.length;

        // Extract context message value if it exists
        startIndex = index;
        while (
            index < dataBytes.length &&
            !(dataBytes[index] == '"' && dataBytes[index - 1] != "\\")
        ) {
            index++;
        }
        require(index < dataBytes.length, "Extraction failed. Malformed contextMessage");
        endIndex = index;
        if (endIndex == startIndex) {
            revert("Extraction failed. Empty contextMessage value");
        }
        valueIndices[2 * valuesFound] = startIndex;
        valueIndices[2 * valuesFound + 1] = endIndex;
        valuesFound++;
        index += 2; // move past the closing quote and comma

        for (uint i = 0; i < EXTRACTED_PARAMETERS_BYTES.length; i++) {
            require(
                dataBytes[index + i] == EXTRACTED_PARAMETERS_BYTES[i],
                "Extraction failed. Malformed extractedParameters"
            );
        }
        index += EXTRACTED_PARAMETERS_BYTES.length;
        isValue = false; // starts with a key right after '{\"extractedParameters\":{\"'

        while (index < dataBytes.length) {
            // Keep incrementing until '"', escaped quotes are not considered
            if (!(dataBytes[index] == '"' && dataBytes[index - 1] != "\\")) {
                index++;
                continue;
            }
            if (!isValue) {
                // \":\" (3 chars)
                require(
                    dataBytes[index + 1] == ":" && dataBytes[index + 2] == '"',
                    "Extraction failed. Malformed data 1"
                );
                index += 3; // move it after \"
                isValue = true;
                // Mark start
                valueIndices[2 * valuesFound] = index; // start index
            } else {
                // \",\" (3 chars) or \"}, (3 chars)
                // \"}} is not supported, there should always be a providerHash
                bool commaThenQuote = (dataBytes[index + 1] == "," && dataBytes[index + 2] == '"');
                bool braceThenComma = (dataBytes[index + 1] == '}' && dataBytes[index + 2] == ",");
                require(
                    commaThenQuote || braceThenComma,
                    "Extraction failed. Malformed data 2"
                );
                valueIndices[2 * valuesFound + 1] = index; // end index
                valuesFound++;

                // Revert if valuesFound == maxValues and next char is a comma as there will be more values
                if (commaThenQuote) {
                    // Revert if valuesFound == maxValues and next char is a comma as there will be more values
                    require(valuesFound != maxValues, "Extraction failed. Exceeded max values");
                    index += 3;
                    isValue = false;
                } else { // index + 1 = "}"
                    index += 3;
                    break; // end of extractedParameters
                }
            }
        }

        if (extractIntentAndProviderHash) {
            for (uint i = 0; i < PROVIDER_HASH_PARAM_BYTES.length; i++) {
                require(
                    dataBytes[index + i] == PROVIDER_HASH_PARAM_BYTES[i],
                    "Extraction failed. Malformed providerHash"
                );
            }
            index += PROVIDER_HASH_PARAM_BYTES.length;

            // final indices tuple in valueIndices will be for star and end indices of provider hash
            valueIndices[2 * valuesFound] = index;
            // Keep incrementing until '"'
            while (index < dataBytes.length && dataBytes[index] != '"') {
                index++;
            }
            valueIndices[2 * valuesFound + 1] = index;
            valuesFound++;
        }

        string[] memory values = new string[](valuesFound);
        for (uint i = 0; i < valuesFound; i++) {
            startIndex = valueIndices[2 * i];
            endIndex = valueIndices[2 * i + 1];
            bytes memory contextValue = new bytes(endIndex - startIndex);
            for (uint j = startIndex; j < endIndex; j++) {
                contextValue[j - startIndex] = dataBytes[j];
            }
            values[i] = string(contextValue);
        }
        return values;
    }
}
