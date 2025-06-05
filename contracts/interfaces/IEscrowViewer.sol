// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IEscrow } from "./IEscrow.sol";

interface IEscrowViewer {
    
    /* ============ Structs ============ */

    struct VerifierDataView {
        address verifier;
        IEscrow.DepositVerifierData verificationData;
        IEscrow.Currency[] currencies;
    }

    struct DepositView {
        uint256 depositId;
        IEscrow.Deposit deposit;
        uint256 availableLiquidity;                 // Amount of liquidity available to signal intents (net of expired intents)
        VerifierDataView[] verifiers;
    }

    struct IntentView {
        bytes32 intentHash;
        IEscrow.Intent intent;
        DepositView deposit;
    }

    function getDepositFromIds(
        uint256[] memory _depositIds
    ) external view returns (DepositView[] memory depositArray);
}
