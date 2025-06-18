// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPostIntentHook } from "./IPostIntentHook.sol";

interface IOrchestrator {
    
    /* ============ Structs ============ */

    struct Intent {
        address owner;                              // Address of the intent owner  
        address to;                                 // Address to forward funds to (can be same as owner)
        address escrow;                             // Address of the escrow contract holding the deposit
        uint256 depositId;                          // ID of the deposit the intent is associated with
        uint256 amount;                             // Amount of the deposit.token the owner wants to take
        uint256 timestamp;                          // Timestamp of the intent
        address paymentVerifier;                    // Address of the payment verifier corresponding to payment service the owner is 
                                                    // going to pay with offchain
        bytes32 fiatCurrency;                       // Currency code that the owner is paying in offchain (keccak256 hash of the currency code)
        uint256 conversionRate;                     // Conversion rate of deposit token to fiat currency at the time of intent
        address referrer;                           // Address of the referrer who brought this intent (if any)
        uint256 referrerFee;                        // Fee to be paid to the referrer in preciseUnits (1e16 = 1%)
        IPostIntentHook postIntentHook;             // Address of the post-intent hook that will execute any post-intent actions
        bytes data;                                 // Additional data to be passed to the post-intent hook contract
    }

    struct SignalIntentParams {
        address escrow;                             // The escrow contract where the deposit is held
        uint256 depositId;                          // The ID of the deposit the taker intends to use
        uint256 amount;                             // The amount of deposit.token the user wants to take
        address to;                                 // Address to forward funds to
        address verifier;                           // The payment verifier for the payment service
        bytes32 fiatCurrency;                       // The currency code for offchain payment
        uint256 conversionRate;                     // The conversion rate agreed offchain
        address referrer;                           // Address of the referrer (address(0) if no referrer)
        uint256 referrerFee;                        // Fee to be paid to the referrer
        bytes gatingServiceSignature;               // Signature from the deposit's gating service
        IPostIntentHook postIntentHook;             // Optional post-intent hook (address(0) for no hook)
        bytes data;                                 // Additional data for the intent
    }

    /* ============ Events ============ */

    event IntentSignaled(
        bytes32 indexed intentHash, 
        address indexed escrow,
        uint256 indexed depositId, 
        address verifier, 
        address owner, 
        address to, 
        uint256 amount, 
        bytes32 fiatCurrency, 
        uint256 conversionRate, 
        uint256 timestamp
    );

    event IntentPruned(
        bytes32 indexed intentHash,
        address indexed escrow,
        uint256 indexed depositId
    );

    event IntentFulfilled(
        bytes32 indexed intentHash,
        address indexed escrow,
        uint256 indexed depositId,
        address verifier,
        address owner,
        address fundsTransferredTo,   // Address that funds were transferred to; can be intent.to or postIntentHook address
        uint256 amount,
        uint256 protocolFee,
        uint256 referrerFee,
        bool isManualRelease
    );

    event AllowMultipleIntentsUpdated(bool allowMultiple);
    event IntentExpirationPeriodSet(uint256 intentExpirationPeriod);

    event PaymentVerifierRegistryUpdated(address indexed paymentVerifierRegistry);
    event PostIntentHookRegistryUpdated(address indexed postIntentHookRegistry);
    event RelayerRegistryUpdated(address indexed relayerRegistry);
    
    event ProtocolFeeUpdated(uint256 protocolFee);
    event ProtocolFeeRecipientUpdated(address indexed protocolFeeRecipient);

    event EscrowRegistryUpdated(address indexed escrowRegistry);

    /* ============ Custom Errors ============ */
    
    // Authorization errors
    error SenderMustBeIntentOwner();
    error CallerMustBeDepositor();
    
    // Intent validation errors
    error AccountHasUnfulfilledIntent();
    error SignaledAmountMustBeGreaterThanMin();
    error SignaledAmountMustBeLessThanMax();
    error CannotSendToZeroAddress();
    error ReferrerFeeExceedsMaximum();
    error CannotSetReferrerFeeWithoutReferrer();
    error IntentDoesNotExist();
    error ReleaseAmountExceedsIntentAmount();

    // Verifier and currency errors
    error PaymentVerifierNotSupported();
    error PaymentVerifierNotWhitelisted();
    error CurrencyNotSupported();
    error RateMustBeGreaterThanOrEqualToMin();
    error InvalidGatingServiceSignature();
    error PostIntentHookNotWhitelisted();
    
    // Payment verification errors
    error PaymentVerificationFailed();
    error InvalidIntentHash();
    
    // Configuration errors
    error ProtocolFeeExceedsMaximum();
    error ProtocolFeeRecipientCannotBeZeroAddress();
    error MaxIntentExpirationPeriodCannotBeZero();
    error EscrowCannotBeZeroAddress();
    error EscrowNotWhitelisted();
    error EscrowRegistryCannotBeZeroAddress();
    
    // Transfer errors
    error ProtocolFeeTransferFailed();
    error ReferrerFeeTransferFailed();
    error TransferToRecipientFailed();

    // Escrow errors
    error FailedToLockLiquidity();


    /* ============ View Functions ============ */

    function getIntent(bytes32 intentHash) external view returns (Intent memory);
    function getAccountIntents(address account) external view returns (bytes32[] memory);
    
    /* ============ External Functions for Users ============ */

    function signalIntent(SignalIntentParams calldata params) external;

    function cancelIntent(bytes32 intentHash) external;

    function fulfillIntent(
        bytes calldata paymentProof,
        bytes32 intentHash,
        bytes calldata data
    ) external;

    function releaseFundsToPayer(
        bytes32 intentHash, 
        uint256 releaseAmount, 
        bytes calldata releaseData
    ) external;

    /* ============ External Functions for Escrow ============ */

    function pruneIntents(bytes32[] calldata intentIds) external;
}