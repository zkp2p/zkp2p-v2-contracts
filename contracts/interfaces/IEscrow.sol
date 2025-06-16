// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPostIntentHook } from "./IPostIntentHook.sol";

interface IEscrow {
    
    /* ============ Structs ============ */

    struct Intent {
        bytes32 intentHash;                        // Unique identifier for the intent
        uint256 amount;                            // Amount locked
        uint256 expiryTime;                        // When this intent expires
    }

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

    /* ============ Events ============ */

    event DepositReceived(uint256 indexed depositId, address indexed depositor, IERC20 indexed token, uint256 amount, Range intentAmountRange, address delegate);

    event DepositVerifierAdded(uint256 indexed depositId, address indexed verifier, bytes32 indexed payeeDetailsHash, address intentGatingService);
    event DepositVerifierRemoved(uint256 indexed depositId, address indexed verifier);

    event DepositCurrencyAdded(uint256 indexed depositId, address indexed verifier, bytes32 indexed currency, uint256 conversionRate);
    event DepositCurrencyRemoved(uint256 indexed depositId, address indexed verifier, bytes32 indexed currencyCode);        

    event DepositFundsAdded(uint256 indexed depositId, address indexed depositor, uint256 amount);
    event DepositWithdrawn(uint256 indexed depositId, address indexed depositor, uint256 amount, bool acceptingIntents);
    event DepositClosed(uint256 depositId, address depositor);

    event DepositIntentAmountRangeUpdated(uint256 indexed depositId, Range intentAmountRange);
    event DepositMinConversionRateUpdated(uint256 indexed depositId, address indexed verifier, bytes32 indexed currency, uint256 newMinConversionRate);

    event DepositDelegateSet(uint256 indexed depositId, address indexed depositor, address indexed delegate);
    event DepositDelegateRemoved(uint256 indexed depositId, address indexed depositor);

    event MinDepositAmountSet(uint256 minDepositAmount);

    event OrchestratorUpdated(address indexed orchestrator);
    event PaymentVerifierRegistryUpdated(address indexed paymentVerifierRegistry);

    /* ============ Custom Errors ============ */
    
    // Authorization errors
    error CallerMustBeDepositorOrDelegate();
    error CallerMustBeDepositor();
    error OnlyDepositorCanSetDelegate();
    error OnlyDepositorCanRemoveDelegate();
    error OnlyOrchestratorCanCallThis();
    
    // Deposit validation errors
    error MinIntentAmountCannotBeZero();
    error MinIntentAmountMustBeLessThanMax();
    error MinCannotBeZero();
    error MinMustBeLessThanMax();
    error DepositDoesNotExist();
    error DepositNotAcceptingIntents();
    error NoDelegateSetForDeposit();
    error NotEnoughLiquidity();
    
    error CurrencyOrVerifierNotSupported();
    error PaymentVerifierNotWhitelisted();
    error VerifierNotFoundForDeposit();
    error CurrencyNotFoundForVerifier();
    error CurrencyNotSupportedByVerifier();
    error VerifierDataAlreadyExists();
    error CurrencyRateAlreadyExists();
    
    // Locking errors
    error IntentDoesNotExist();
    error AmountMustBeLessThanMaxIntent();
    error AmountMustBeGreaterThanMinIntent();
    error TransferAmountCannotBeZero();
    error TransferAmountCannotBeGreaterThanIntentAmount();

    // Configuration errors
    error MinConversionRateMustBeGreaterThanZero();
    error ConversionRateMustBeGreaterThanZero();
    error DelegateCannotBeZeroAddress();
    error VerifierCannotBeZeroAddress();
    error PayeeDetailsCannotBeEmpty();
    error OrchestratorCannotBeZeroAddress();
    error PaymentVerifierRegistryCannotBeZeroAddress();
    
    // Array length errors
    error VerifiersAndDepositVerifierDataLengthMismatch();
    error VerifiersAndCurrenciesLengthMismatch();

    
    /* ============ External Functions for Orchestrator ============ */

    function lockFunds(uint256 _depositId, bytes32 _intentHash, uint256 _amount, uint256 _expiryTime) external;
    function unlockFunds(uint256 _depositId, bytes32 _intentHash) external;
    function unlockAndTransferFunds(uint256 _depositId, bytes32 _intentHash, uint256 _transferAmount, address _to) external;

    /* ============ View Functions ============ */

    function getDeposit(uint256 _depositId) external view returns (Deposit memory);
    function getDepositVerifiers(uint256 _depositId) external view returns (address[] memory);
    function getDepositCurrencies(uint256 _depositId, address _verifier) external view returns (bytes32[] memory);
    function getDepositCurrencyMinRate(uint256 _depositId, address _verifier, bytes32 _currencyCode) external view returns (uint256);
    function getDepositVerifierData(uint256 _depositId, address _verifier) external view returns (DepositVerifierData memory);
    function getAccountDeposits(address _account) external view returns (uint256[] memory);
    function getDepositIntentHashes(uint256 _depositId) external view returns (bytes32[] memory);
    function getExpiredIntents(uint256 _depositId) external view returns (bytes32[] memory expiredIntents, uint256 reclaimedAmount);
}
