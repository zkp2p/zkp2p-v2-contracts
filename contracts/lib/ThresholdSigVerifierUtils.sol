  
//SPDX-License-Identifier: MIT

import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

pragma solidity ^0.8.18;


// This library is used to verify that signatures meet the required threshold from accepted witnesses
library ThresholdSigVerifierUtils {

    using SignatureChecker for address;
    using ECDSA for bytes32;

    /**
     * Verifies that signatures meet the required threshold from accepted witnesses
     * 
     * @param _messageHash The hash of the message that was signed
     * @param _signatures Array of signatures (must have at least minWitnessSignatures)
     * @param _witnesses Array of accepted witness addresses
     * @param _reqThreshold The minimum number of witness signatures required
     * @return bool Whether the threshold is met
     */
    function verifyWitnessSignatures(
        bytes32 _messageHash,
        bytes[] memory _signatures,
        address[] memory _witnesses,
        uint256 _reqThreshold
    )
        internal
        view
        returns (bool)
    {
        require(_reqThreshold > 0, "ThresholdSigVerifierUtils: req threshold must be > 0");
        require(_reqThreshold <= _signatures.length, "ThresholdSigVerifierUtils: req threshold exceeds signatures");
        require(_reqThreshold <= _witnesses.length, "ThresholdSigVerifierUtils: req threshold exceeds witnesses");
        
        // Convert to Ethereum signed message hash
        bytes32 ethSignedMessageHash = _messageHash.toEthSignedMessageHash();
        
        // Track unique signers using an array
        address[] memory seenSigners = new address[](_witnesses.length);
        uint256 validWitnessSignatures = 0;
        
        // Check each signature to find which witness signed it
        for (uint256 i = 0; i < _signatures.length; i++) {
            // Check if any witness created this signature
            for (uint256 j = 0; j < _witnesses.length; j++) {
                if (_witnesses[j].isValidSignatureNow(ethSignedMessageHash, _signatures[i])) {
                    // Check if we've already counted this witness
                    bool alreadySeen = false;
                    for (uint256 k = 0; k < validWitnessSignatures; k++) {
                        if (seenSigners[k] == _witnesses[j]) {
                            alreadySeen = true;
                            break;
                        }
                    }
                    if (!alreadySeen) {
                        seenSigners[validWitnessSignatures] = _witnesses[j];
                        validWitnessSignatures++;
                        
                        // Early exit if threshold is met
                        if (validWitnessSignatures >= _reqThreshold) {
                            return true;
                        }
                        break;
                    }
                }
            }
        }
        
        // Check threshold
        require(
            validWitnessSignatures >= _reqThreshold,
            "ThresholdSigVerifierUtils: Not enough valid witness signatures"
        );
        
        return true;
    }
}