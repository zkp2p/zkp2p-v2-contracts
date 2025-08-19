  
//SPDX-License-Identifier: MIT

import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

pragma solidity ^0.8.18;


// This library is used to verify that signatures meet the required threshold from accepted witnesses
library ThresholdSigVerifierUtils {

    using SignatureChecker for address;
    using ECDSA for bytes32;

    // todo: does this function take care of duplicate signatures or witnesses? 

    /**
     * Verifies that signatures meet the required threshold from accepted witnesses
     * 
     * @param _digest The message digest to verify (EIP-712 or pre-hashed for EIP-191)
     * @param _signatures Array of signatures (must have at least minWitnessSignatures)
     * @param _witnesses Array of accepted witness addresses
     * @param _reqThreshold The minimum number of witness signatures required
     * @return bool Whether the threshold is met
     * @dev The digest should already be properly formatted:
     *      - For EIP-712: keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash))
     *      - For EIP-191: the message hash that will be signed with personal_sign
     *      SignatureChecker.isValidSignatureNow will handle both cases correctly
     */
    function verifyWitnessSignatures(
        bytes32 _digest,
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
        
        // For EIP-712, the digest is already properly formatted
        // For EIP-191, we need to convert to Ethereum signed message hash
        // SignatureChecker handles both EIP-712 and EIP-191 signatures
        // We'll pass the digest directly and let SignatureChecker handle it
        
        // Track unique signers using an array
        address[] memory seenSigners = new address[](_witnesses.length);
        uint256 validWitnessSignatures = 0;
        
        // Check each signature to find which witness signed it
        for (uint256 i = 0; i < _signatures.length; i++) {
            // Check if any witness created this signature
            for (uint256 j = 0; j < _witnesses.length; j++) {
                if (_witnesses[j].isValidSignatureNow(_digest, _signatures[i])) {
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