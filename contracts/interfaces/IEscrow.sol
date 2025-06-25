// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPostIntentHook } from "./IPostIntentHook.sol";

interface IEscrow {
    
    /* ============ Structs ============ */

    struct Intent {
        bytes32 intentHash;                        // Unique identifier for the intent
        uint256 amount;                            // Amount locked
        uint256 timestamp;                         // When this intent was created
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
        uint256 amount;                             // Amount of deposit token (gross amount including reserved fees)
        Range intentAmountRange;                    // Range of take amount per intent
        // Deposit state
        bool acceptingIntents;                      // State: True if the deposit is accepting intents, False otherwise
        uint256 remainingDeposits;                  // State: Amount of remaining deposited liquidity (net of reserved fees)
        uint256 outstandingIntentAmount;            // State: Amount of outstanding intents (may include expired intents)
        // Fee tracking
        uint256 reservedMakerFees;                  // State: Total fees reserved from maker (calculated upfront)
        uint256 accruedMakerFees;                   // State: Fees actually earned from fulfilled intents
        // Intent guardian
        address intentGuardian;                     // Address that can extend intent expiry times (address(0) if no guardian)
    }

    struct Currency {
        bytes32 code;                               // Currency code (keccak256 hash of the currency code)
        uint256 minConversionRate;                  // Minimum rate of deposit token to fiat currency (in preciseUnits)
    }

    struct DepositVerifierData {
        address intentGatingService;                // Public key of gating service that will be used to verify intents
        string payeeDetails;                        // Payee details, could be both hash or raw details; verifier will decide how to parse it
        bytes data;                                 // Verification Data: Additional data used for payment verification; Can hold attester address
                                                    // in case of TLS proofs, domain key hash in case of zkEmail proofs, currency code etc.
    }

    struct CreateDepositParams {
        IERC20 token;                             // The token to be deposited
        uint256 amount;                           // The amount of token to deposit
        Range intentAmountRange;                  // The max and min take amount for each intent
        address[] verifiers;                      // The payment verifiers that deposit supports
        DepositVerifierData[] verifierData;       // The payment verification data for each verifier that deposit supports
        Currency[][] currencies;                  // The currencies for each verifier that deposit supports
        address delegate;                         // Optional delegate address that can manage this deposit (address(0) for no delegate)
        address intentGuardian;                   // Optional intent guardian address that can extend intent expiry times (address(0) for no guardian)
    }

    /* ============ Events ============ */

    event DepositReceived(uint256 indexed depositId, address indexed depositor, IERC20 indexed token, uint256 amount, Range intentAmountRange, address delegate, address intentGuardian);

    event DepositVerifierAdded(uint256 indexed depositId, address indexed verifier, bytes32 indexed payeeDetailsHash, address intentGatingService);
    event DepositVerifierRemoved(uint256 indexed depositId, address indexed verifier);

    event DepositCurrencyAdded(uint256 indexed depositId, address indexed verifier, bytes32 indexed currency, uint256 conversionRate);
    event DepositCurrencyRemoved(uint256 indexed depositId, address indexed verifier, bytes32 indexed currencyCode);        

    event DepositFundsAdded(uint256 indexed depositId, address indexed depositor, uint256 amount);
    event DepositWithdrawn(uint256 indexed depositId, address indexed depositor, uint256 amount, bool acceptingIntents);
    event DepositClosed(uint256 depositId, address depositor);

    event DepositIntentAmountRangeUpdated(uint256 indexed depositId, Range intentAmountRange);
    event DepositMinConversionRateUpdated(uint256 indexed depositId, address indexed verifier, bytes32 indexed currency, uint256 newMinConversionRate);
    event DepositAcceptingIntentsUpdated(uint256 indexed depositId, bool acceptingIntents);

    event DepositDelegateSet(uint256 indexed depositId, address indexed depositor, address indexed delegate);
    event DepositDelegateRemoved(uint256 indexed depositId, address indexed depositor);

    event MinDepositAmountSet(uint256 minDepositAmount);

    event OrchestratorUpdated(address indexed orchestrator);
    event PaymentVerifierRegistryUpdated(address indexed paymentVerifierRegistry);

    event FundsLocked(uint256 indexed depositId, bytes32 indexed intentHash, uint256 amount, uint256 expiryTime);
    event FundsUnlocked(uint256 indexed depositId, bytes32 indexed intentHash, uint256 amount);
    event FundsUnlockedAndTransferred(uint256 indexed depositId, bytes32 indexed intentHash, uint256 unlockedAmount, uint256 transferredAmount, uint256 accruedFees, address to);
    event IntentExpiryExtended(uint256 indexed depositId, bytes32 indexed intentHash, uint256 newExpiryTime);

    event MakerProtocolFeeUpdated(uint256 makerProtocolFee);
    event MakerFeeRecipientUpdated(address indexed makerFeeRecipient);
    event MakerFeesCollected(uint256 indexed depositId, uint256 collectedFees, address indexed makerFeeRecipient);
    event DustCollected(uint256 indexed depositId, uint256 dustAmount, address indexed makerFeeRecipient);
    event DustThresholdUpdated(uint256 dustThreshold);
    event MaxIntentsPerDepositUpdated(uint256 maxIntentsPerDeposit);
    event IntentExpirationPeriodUpdated(uint256 intentExpirationPeriod);

    /* ============ Standardized Custom Errors ============ */
    
    // Zero value errors
    error ZeroAddress();
    error ZeroValue();
    error ZeroMinValue();
    error ZeroConversionRate();

    // Authorization errors
    error UnauthorizedCaller(address caller, address authorized);
    error UnauthorizedCallerOrDelegate(address caller, address owner, address delegate);

    // Range and amount errors
    error InvalidRange(uint256 min, uint256 max);
    error AmountBelowMin(uint256 amount, uint256 min);
    error AmountAboveMax(uint256 amount, uint256 max);
    error AmountExceedsAvailable(uint256 requested, uint256 available);

    // Not found errors
    error DepositNotFound(uint256 depositId);
    error IntentNotFound(bytes32 intentHash);
    error VerifierNotFound(uint256 depositId, address verifier);
    error CurrencyNotFound(address verifier, bytes32 currency);
    error DelegateNotFound(uint256 depositId);

    // Already exists errors
    error VerifierAlreadyExists(uint256 depositId, address verifier);
    error CurrencyAlreadyExists(address verifier, bytes32 currency);

    // State errors
    error DepositNotAcceptingIntents(uint256 depositId);
    error DepositAlreadyInState(uint256 depositId, bool currentState);
    error InsufficientDepositLiquidity(uint256 depositId, uint256 available, uint256 required);
    error MaxIntentsExceeded(uint256 depositId, uint256 current, uint256 max);

    // Validation errors
    error EmptyPayeeDetails();
    error ArrayLengthMismatch(uint256 length1, uint256 length2);

    // Verifier errors
    error VerifierNotWhitelisted(address verifier);
    error CurrencyNotSupported(address verifier, bytes32 currency);

    
    /* ============ External Functions for Orchestrator ============ */

    function lockFunds(uint256 _depositId, bytes32 _intentHash, uint256 _amount) external;
    function unlockFunds(uint256 _depositId, bytes32 _intentHash) external;
    function unlockAndTransferFunds(uint256 _depositId, bytes32 _intentHash, uint256 _transferAmount, address _to) external;
    function extendIntentExpiry(uint256 _depositId, bytes32 _intentHash, uint256 _newExpiryTime) external;

    /* ============ View Functions ============ */

    function getDeposit(uint256 _depositId) external view returns (Deposit memory);
    function getDepositIntent(uint256 _depositId, bytes32 _intentHash) external view returns (Intent memory);
    function getDepositVerifiers(uint256 _depositId) external view returns (address[] memory);
    function getDepositCurrencies(uint256 _depositId, address _verifier) external view returns (bytes32[] memory);
    function getDepositCurrencyMinRate(uint256 _depositId, address _verifier, bytes32 _currencyCode) external view returns (uint256);
    function getDepositVerifierData(uint256 _depositId, address _verifier) external view returns (DepositVerifierData memory);
    function getAccountDeposits(address _account) external view returns (uint256[] memory);
    function getDepositIntentHashes(uint256 _depositId) external view returns (bytes32[] memory);
    function getExpiredIntents(uint256 _depositId) external view returns (bytes32[] memory expiredIntents, uint256 reclaimedAmount);
}
