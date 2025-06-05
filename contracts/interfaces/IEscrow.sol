// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPostIntentHook } from "./IPostIntentHook.sol";

interface IEscrow {
    
    /* ============ Structs ============ */

    struct Range {
        uint256 min;                                // Minimum value
        uint256 max;                                // Maximum value
    }

    struct Deposit {
        address depositor;                          // Address of depositor
        address delegate;                           // Address that can manage this deposit (address(0) if no delegate)
        IERC20 token;                               // Address of deposit token
        uint256 amount;                             // Amount of deposit token
        Range intentAmountRange;                    // Range of take amount per intent
        // Deposit state
        bool acceptingIntents;                      // State: True if the deposit is accepting intents, False otherwise
        uint256 remainingDeposits;                  // State: Amount of remaining deposited liquidity
        uint256 outstandingIntentAmount;            // State: Amount of outstanding intents (may include expired intents)
        bytes32[] intentHashes;                     // State: Array of hashes of all open intents (may include some expired if not pruned)
    }

    struct Currency {
        bytes32 code;                               // Currency code (keccak256 hash of the currency code)
        uint256 minConversionRate;                  // Minimum rate of deposit token to fiat currency (in preciseUnits)
        // todo: Do we need maxConversionRate?
    }

    struct DepositVerifierData {
        address intentGatingService;                // Public key of gating service that will be used to verify intents
        string payeeDetails;                        // Payee details, could be both hash or raw details; verifier will decide how to parse it
        bytes data;                                 // Verification Data: Additional data used for payment verification; Can hold attester address
                                                    // in case of TLS proofs, domain key hash in case of zkEmail proofs, currency code etc.
    }

    struct Intent {
        address owner;                              // Address of the intent owner  
        address to;                                 // Address to forward funds to (can be same as owner)
        uint256 depositId;                          // ID of the deposit the intent is associated with
        uint256 amount;                             // Amount of the deposit.token the owner wants to take
        uint256 timestamp;                          // Timestamp of the intent
        address paymentVerifier;                    // Address of the payment verifier corresponding to payment service the owner is 
                                                    // going to pay with offchain
        bytes32 fiatCurrency;                       // Currency code that the owner is paying in offchain (keccak256 hash of the currency code)
        uint256 conversionRate;                     // Conversion rate of deposit token to fiat currency at the time of intent
        IPostIntentHook postIntentHook;             // Address of the post-intent hook that will execute any post-intent actions
        bytes data;                                 // Additional data to be passed to the post-intent hook contract
    }

    struct VerifierDataView {
        address verifier;
        DepositVerifierData verificationData;
        Currency[] currencies;
    }

    struct DepositView {
        uint256 depositId;
        Deposit deposit;
        uint256 availableLiquidity;                 // Amount of liquidity available to signal intents (net of expired intents)
        VerifierDataView[] verifiers;
    }

    struct IntentView {
        bytes32 intentHash;
        Intent intent;
        DepositView deposit;
    }

    function getDeposit(uint256 _depositId) external view returns (Deposit memory);
    function getDepositVerifiers(uint256 _depositId) external view returns (address[] memory);
    function getDepositCurrencies(uint256 _depositId, address _verifier) external view returns (bytes32[] memory);
    function getDepositCurrencyMinRate(uint256 _depositId, address _verifier, bytes32 _currencyCode) external view returns (uint256);
    function getDepositVerifierData(uint256 _depositId, address _verifier) external view returns (DepositVerifierData memory);
    function getAccountDeposits(address _account) external view returns (uint256[] memory);
    
    function getIntent(bytes32 _intentHash) external view returns (Intent memory);
    function getAccountIntent(address _account) external view returns (bytes32);
    function getPrunableIntents(uint256 _depositId) external view returns (bytes32[] memory prunableIntents, uint256 reclaimedAmount);
}
