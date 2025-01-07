//SPDX-License-Identifier: MIT

import { Claims } from "../../external/Claims.sol";

pragma solidity ^0.8.18;

interface IReclaimVerifier {
    
    struct ReclaimProof {
        Claims.ClaimInfo claimInfo;
        Claims.SignedClaim signedClaim;
        bool isAppclipProof;
    }
}
