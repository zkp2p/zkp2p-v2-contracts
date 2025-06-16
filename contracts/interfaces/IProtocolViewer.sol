// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IEscrow } from "./IEscrow.sol";
import { IOrchestrator } from "./IOrchestrator.sol";

interface IProtocolViewer {

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
        bytes32[] intentHashes;
    }

    struct IntentView {
        bytes32 intentHash;
        IOrchestrator.Intent intent;
        DepositView deposit;
    }

    /* ============ Functions ============ */

    function getDepositFromIds(
        uint256[] memory _depositIds
    ) external view returns (DepositView[] memory);

    function getAccountIntents(
        address _account
    ) external view returns (IntentView[] memory intentViews);
}
