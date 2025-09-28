// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IOrchestrator } from "../interfaces/IOrchestrator.sol";
import { IPostIntentHook } from "../interfaces/IPostIntentHook.sol";
import { IPaymentVerifier } from "../interfaces/IPaymentVerifier.sol";

contract UnifiedVerifierOrchestratorMock {
    struct StoredIntent {
        address owner;
        address to;
        address escrow;
        uint256 depositId;
        uint256 amount;
        uint256 timestamp;
        bytes32 paymentMethod;
        bytes32 fiatCurrency;
        uint256 conversionRate;
    }

    mapping(bytes32 => StoredIntent) private intents;

    function setIntent(
        bytes32 intentHash,
        StoredIntent calldata intent
    ) external {
        intents[intentHash] = intent;
    }

    function getIntent(bytes32 intentHash) external view returns (IOrchestrator.Intent memory) {
        StoredIntent memory stored = intents[intentHash];
        return IOrchestrator.Intent({
            owner: stored.owner,
            to: stored.to,
            escrow: stored.escrow,
            depositId: stored.depositId,
            amount: stored.amount,
            timestamp: stored.timestamp,
            paymentMethod: stored.paymentMethod,
            fiatCurrency: stored.fiatCurrency,
            conversionRate: stored.conversionRate,
            referrer: address(0),
            referrerFee: 0,
            postIntentHook: IPostIntentHook(address(0)),
            data: bytes("")
        });
    }

    function executeVerifyPayment(address verifier, IPaymentVerifier.VerifyPaymentData calldata params)
        external
        returns (IPaymentVerifier.PaymentVerificationResult memory)
    {
        return IPaymentVerifier(verifier).verifyPayment(params);
    }
}
