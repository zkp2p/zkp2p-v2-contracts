// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library ClaimVerifier {
    // Pull repeated string constants out of the function to reduce locals
    bytes constant CONTEXT_ADDRESS_BYTES      = bytes("{\"contextAddress\":\"");
    bytes constant CONTEXT_MESSAGE_BYTES      = bytes("\"contextMessage\":\"");
    bytes constant EXTRACTED_PARAMETERS_BYTES = bytes("\"extractedParameters\":{\"");
    bytes constant PROVIDER_HASH_PARAM_BYTES  = bytes("\"providerHash\":\"");

    /**
     * Find the end index of target string in the data string. Returns the end index + 1 if
     * the target string in the data string if found. Returns type(uint256).max if:
     * - Target is longer than data
     * - Target is not found
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

        for (uint i = 0; i <= dataBytes.length - targetBytes.length; i++) {
            bool isMatch = true;
            for (uint j = 0; j < targetBytes.length && isMatch; j++) {
                if (dataBytes[i + j] != targetBytes[j]) {
                    isMatch = false;
                }
            }
            if (isMatch) {
                return i + targetBytes.length; // Return end index + 1
            }
        }
        return type(uint256).max;
    }

    /**
     * Extracts a single field from a JSON-like context using prefix. 
     */
    function extractFieldFromContext(
        string memory data,
        string memory prefix
    ) internal pure returns (string memory) {
        uint256 start = findSubstringEndIndex(data, prefix);
        bytes memory dataBytes = bytes(data);
        if (start == dataBytes.length) {
            return ""; 
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
            return "";
        }
        bytes memory contextMessage = new bytes(end - start);
        for (uint i = start; i < end; i++) {
            contextMessage[i - start] = dataBytes[i];
        }
        return string(contextMessage);
    }

    /**
     * Extracts multiple values from serialized JSON.  
     * - maxValues: maximum # of values from `extractedParameters` you want to allow.  
     * - extractIntentAndProviderHash: if true, parse out providerHash.  
     */
    function extractAllFromContext(
        string memory data,
        uint8 maxValues,
        bool extractIntentAndProviderHash
    ) internal pure returns (string[] memory) {
        require(maxValues > 0, "Max values must be greater than 0");

        bytes memory dataBytes = bytes(data);
        // We'll reuse these variables to avoid "stack too deep"
        uint index = 0;
        uint valuesFound = 0;
        uint startIndex;
        uint endIndex;
        bool isValue;

        // Pre-allocate memory to store [start,end] index pairs for each extracted value
        uint[] memory valueIndices = new uint[](2 * maxValues);

        //
        // 1) Verify and skip past: {"contextAddress":"
        //
        for (uint i = 0; i < CONTEXT_ADDRESS_BYTES.length; i++) {
            require(
                dataBytes[index + i] == CONTEXT_ADDRESS_BYTES[i],
                "Extraction failed. Malformed contextAddress"
            );
        }
        index += CONTEXT_ADDRESS_BYTES.length;

        // 2) Extract actual contextAddress
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
        // Skip `","`
        index += 2; 

        //
        // 3) Verify and skip: "contextMessage":"
        //
        for (uint i = 0; i < CONTEXT_MESSAGE_BYTES.length; i++) {
            require(
                dataBytes[index + i] == CONTEXT_MESSAGE_BYTES[i],
                "Extraction failed. Malformed contextMessage"
            );
        }
        index += CONTEXT_MESSAGE_BYTES.length;

        // 4) Extract actual contextMessage
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
        // Skip `","`
        index += 2;

        //
        // 5) Verify and skip: "extractedParameters":{
        //
        for (uint i = 0; i < EXTRACTED_PARAMETERS_BYTES.length; i++) {
            require(
                dataBytes[index + i] == EXTRACTED_PARAMETERS_BYTES[i],
                "Extraction failed. Malformed extractedParameters"
            );
        }
        index += EXTRACTED_PARAMETERS_BYTES.length;
        isValue = false;

        //
        // 6) Loop through extractedParameters
        //
        while (index < dataBytes.length) {
            // Not a quote or is an escaped quote? Just keep moving.
            if (!(dataBytes[index] == '"' && dataBytes[index - 1] != "\\")) {
                index++;
                continue;
            }
            if (!isValue) {
                // Next should be :"
                require(
                    dataBytes[index + 1] == ":" && dataBytes[index + 2] == '"',
                    "Extraction failed. Malformed data 1"
                );
                // Move index after `:\"`
                index += 3;
                isValue = true;
                // Mark start
                valueIndices[2 * valuesFound] = index;
            } else {
                // We expect either `",` or "\"},`
                bool commaThenQuote = (dataBytes[index + 1] == "," && dataBytes[index + 2] == '"');
                bool braceThenComma = (dataBytes[index + 1] == '}' && dataBytes[index + 2] == ",");
                require(
                    commaThenQuote || braceThenComma,
                    "Extraction failed. Malformed data 2"
                );
                // Mark end
                valueIndices[2 * valuesFound + 1] = index;
                valuesFound++;

                // If we got a comma, there is another pair. If brace, we are done with extractedParams.
                if (commaThenQuote) {
                    // If we've hit the max, no more
                    require(valuesFound != maxValues, "Extraction failed. Exceeded max values");
                    index += 3;
                    isValue = false;
                } else {
                    // Move past "}, and break
                    index += 3;
                    break;
                }
            }
        }

        //
        // 7) If required, parse providerHash
        //
        if (extractIntentAndProviderHash) {
            for (uint i = 0; i < PROVIDER_HASH_PARAM_BYTES.length; i++) {
                require(
                    dataBytes[index + i] == PROVIDER_HASH_PARAM_BYTES[i],
                    "Extraction failed. Malformed providerHash"
                );
            }
            index += PROVIDER_HASH_PARAM_BYTES.length;

            // Mark start
            valueIndices[2 * valuesFound] = index;
            // Move until next unescaped quote
            while (index < dataBytes.length && dataBytes[index] != '"') {
                index++;
            }
            valueIndices[2 * valuesFound + 1] = index;
            valuesFound++;
        }

        //
        // 8) Build return array
        //
        string[] memory values = new string[](valuesFound);
        for (uint i = 0; i < valuesFound; i++) {
            startIndex = valueIndices[2 * i];
            endIndex   = valueIndices[2 * i + 1];
            bytes memory contextValue = new bytes(endIndex - startIndex);
            for (uint j = startIndex; j < endIndex; j++) {
                contextValue[j - startIndex] = dataBytes[j];
            }
            values[i] = string(contextValue);
        }
        return values;
    }
}