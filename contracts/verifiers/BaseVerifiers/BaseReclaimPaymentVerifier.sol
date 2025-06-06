//SPDX-License-Identifier: MIT
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { AddressArrayUtils } from "../../external/AddressArrayUtils.sol";
import { Claims } from "../../external/Claims.sol";
import { StringArrayUtils } from "../../external/StringArrayUtils.sol";

import { ClaimVerifier } from "../../lib/ClaimVerifier.sol";
import { INullifierRegistry } from "../nullifierRegistries/INullifierRegistry.sol";
import { IReclaimVerifier } from "../interfaces/IReclaimVerifier.sol";

import { BasePaymentVerifier } from "../BaseVerifiers/BasePaymentVerifier.sol";

pragma solidity ^0.8.18;

contract BaseReclaimPaymentVerifier is IReclaimVerifier, BasePaymentVerifier {

    using AddressArrayUtils for address[];
    using StringArrayUtils for string[];

    /* ============ Constants ============ */

    uint256 internal constant PRECISE_UNIT = 1e18;

    /* ============ State Variables ============ */
    mapping(string => bool) public isProviderHash;
    string[] public providerHashes;                         // Set of provider hashes that these proofs should be for

    /* ============ Events ============ */
    event ProviderHashAdded(string providerHash);
    event ProviderHashRemoved(string providerHash);

    /* ============ Constructor ============ */
    constructor(
        address _ramp,
        INullifierRegistry _nulliferRegistry,
        uint256 _timestampBuffer,
        bytes32[] memory _currencies,
        string[] memory _providerHashes
    )
        BasePaymentVerifier(
            _ramp,
            _nulliferRegistry,
            _timestampBuffer,
            _currencies
        )
    {
        for (uint256 i = 0; i < _providerHashes.length; i++) {
            require(!isProviderHash[_providerHashes[i]], "Provider hash already added");
            isProviderHash[_providerHashes[i]] = true;
            providerHashes.push(_providerHashes[i]);

            emit ProviderHashAdded(_providerHashes[i]);
        }
    }

    /* ============ Admin Functions ============ */

    /**
     * ONLY OWNER: Add provider hash string. Provider hash must not have been previously added.
     *
     * @param _newProviderHash    New provider hash to be added
     */
    function addProviderHash(string memory _newProviderHash) external onlyOwner {
        require(!isProviderHash[_newProviderHash], "Provider hash already added");

        isProviderHash[_newProviderHash] = true;
        providerHashes.push(_newProviderHash);

        emit ProviderHashAdded(_newProviderHash);
    }

    /**
     * ONLY OWNER: Remove provider hash string. Provider hash must have been previously added.
     *
     * @param _removeProviderHash    Provider hash to be removed
     */
    function removeProviderHash(string memory _removeProviderHash) external onlyOwner {
        require(isProviderHash[_removeProviderHash], "Provider hash not found");

        delete isProviderHash[_removeProviderHash];
        providerHashes.removeStorage(_removeProviderHash);

        emit ProviderHashRemoved(_removeProviderHash);
    }

    /* ============ Public Functions ============ */
    
    /**
     * Verify proof generated by witnesses. Claim is constructed by hashing claimInfo (provider, context, parameters)
     * to get the identifier. And then signing on (identifier, owner, timestamp, epoch) to get claim signature. 
     * This function verifies a claim by performing the following checks on the claim
     * - Calculates the hash of the claimInfo and checks if it matches the identifier in the claim
     * - Checks if the signatures are valid and from the witnesses
     * This function reverts if
     * - No signatures are found on the proof
     * - ClaimInfo hash does not match the identifier in the claim
     * - Signatures are invalid (not from the witnesses)
     * 
     * DEV NOTE: This function does NOT validate that the claim provider hash is valid. That is the 
     * responsibility of the caller. Ensure witnesses are unique otherwise the threshold can be met 
     * with duplicate witnesses.
     * 
     * Parts of the code are adapted from: https://basescan.org/address/0x7281630e4346dd4c0b7ae3b4689c1d0102741410#code
     *    
     * @param proof                 Proof to be verified
     * @param _witnesses            List of accepted witnesses
     * @param _requiredThreshold    Minimum number of signatures required from accepted witnesses
     */
    function verifyProofSignatures(
        ReclaimProof memory proof, 
        address[] memory _witnesses,
        uint256 _requiredThreshold
    ) public pure returns (bool) {

        require(_requiredThreshold > 0, "Required threshold must be greater than 0");
        require(_requiredThreshold <= _witnesses.length, "Required threshold must be less than or equal to number of witnesses");
        require(proof.signedClaim.signatures.length > 0, "No signatures");

        Claims.SignedClaim memory signed = Claims.SignedClaim(
            proof.signedClaim.claim,
            proof.signedClaim.signatures
        );

        // check if the hash from the claimInfo is equal to the infoHash in the claimData
        bytes32 hashed = Claims.hashClaimInfo(proof.claimInfo);
        require(proof.signedClaim.claim.identifier == hashed, "ClaimInfo hash doesn't match");
        require(hashed != bytes32(0), "ClaimInfo hash is zero");

        // Recover signers of the signed claim
        address[] memory claimSigners = Claims.recoverSignersOfSignedClaim(signed);
        require(claimSigners.length >= _requiredThreshold, "Fewer signatures than required threshold");

        // Track unique signers using an array
        address[] memory seenSigners = new address[](claimSigners.length);
        uint256 validWitnessSignatures;

        // Count how many signers are accepted witnesses, skipping duplicates
        for (uint256 i = 0; i < claimSigners.length; i++) {
            address currSigner = claimSigners[i];
            if (seenSigners.contains(currSigner)) {
                continue;
            }

            if (_witnesses.contains(currSigner)) {
                seenSigners[validWitnessSignatures] = currSigner;
                validWitnessSignatures++;
            }
        }

        // Check threshold
        require(
            validWitnessSignatures >= _requiredThreshold,
            "Not enough valid witness signatures"
        );

        return true;
    }


    /* ============ View Functions ============ */

    function getProviderHashes() external view returns (string[] memory) {
        return providerHashes;
    }

    /* ============ Internal Functions ============ */

    function _validateProviderHash(string memory _providerHash) internal view returns (bool) {
        return isProviderHash[_providerHash];
    }

    function _validateAndAddSigNullifier(bytes[] memory _sigArray) internal {
        bytes32 nullifier = keccak256(abi.encode(_sigArray));
        require(!nullifierRegistry.isNullified(nullifier), "Nullifier has already been used");
        nullifierRegistry.addNullifier(nullifier);
    }
}
