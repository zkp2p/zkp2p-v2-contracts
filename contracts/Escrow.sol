//SPDX-License-Identifier: MIT

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import { AddressArrayUtils } from "./external/AddressArrayUtils.sol";
import { Bytes32ArrayUtils } from "./external/Bytes32ArrayUtils.sol";
import { StringArrayUtils } from "./external/StringArrayUtils.sol";
import { Uint256ArrayUtils } from "./external/Uint256ArrayUtils.sol";

import { IEscrow } from "./interfaces/IEscrow.sol";
import { IOrchestrator } from "./interfaces/IOrchestrator.sol";
import { IPostIntentHook } from "./interfaces/IPostIntentHook.sol";
import { IPaymentVerifier } from "./interfaces/IPaymentVerifier.sol";
import { IPaymentVerifierRegistry } from "./interfaces/IPaymentVerifierRegistry.sol";
import { IPostIntentHookRegistry } from "./interfaces/IPostIntentHookRegistry.sol";
import { IRelayerRegistry } from "./interfaces/IRelayerRegistry.sol";

pragma solidity ^0.8.18;

/**
 * @title Escrow
 * @notice Escrows deposits and manages deposit lifecycle.
 */
contract Escrow is Ownable, Pausable, IEscrow {

    using AddressArrayUtils for address[];
    using Bytes32ArrayUtils for bytes32[];
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;
    using SignatureChecker for address;
    using StringArrayUtils for string[];
    using Uint256ArrayUtils for uint256[];

    /* ============ Constants ============ */
    uint256 internal constant PRECISE_UNIT = 1e18;
    uint256 internal constant MAX_MAKER_FEE = 5e16;                 // 5% max maker fee
    uint256 internal constant MAX_REFERRER_FEE = 5e16;             // 5% max referrer fee
    uint256 internal constant MAX_DUST_THRESHOLD = 1e6;            // 1 USDC
    uint256 internal constant MAX_TOTAL_INTENT_EXPIRATION_PERIOD = 86400 * 5; // 5 days
    uint256 internal constant MAX_PAYMENT_METHODS_PER_DEPOSIT = 10; // Maximum payment methods per deposit
    uint256 internal constant MAX_CURRENCIES_PER_METHOD = 10;       // Maximum currencies per payment method
    
    /* ============ State Variables ============ */

    IOrchestrator public orchestrator;                               // Address of the orchestrator contract
    IPaymentVerifierRegistry public paymentVerifierRegistry;         // Address of the payment verifier registry contract
    uint256 immutable public chainId;                                // chainId of the chain the escrow is deployed on

    mapping(address => uint256[]) internal accountDeposits;          // Mapping of address to depositIds

    // Mapping of depositId to verifier address to deposit's verification data. A single deposit can support multiple payment 
    // services. Each payment service has it's own verification data which includes the payee details hash and the data used for 
    // payment verification.
    // Example: Deposit 1 => Venmo => payeeDetails: 0x123, data: 0x456
    //                    => Revolut => payeeDetails: 0x789, data: 0xabc
    mapping(uint256 => mapping(bytes32 => DepositPaymentMethodData)) internal depositPaymentMethodData;
    mapping(uint256 => bytes32[]) internal depositPaymentMethods;          // Handy mapping to get all payment methods for a deposit
    
    // Mapping of depositId to verifier address to mapping of fiat currency to min conversion rate. Each payment service can support
    // multiple currencies. Depositor can specify list of currencies and min conversion rates for each payment service.
    // Example: Deposit 1 => Venmo => USD: 1e18
    //                    => Revolut => USD: 1e18, EUR: 1.2e18, SGD: 1.5e18
    mapping(uint256 => mapping(bytes32 => mapping(bytes32 => uint256))) internal depositCurrencyMinRate;
    mapping(uint256 => mapping(bytes32 => bytes32[])) internal depositCurrencies; // Handy mapping to get all currencies for a deposit and verifier

    mapping(uint256 => Deposit) internal deposits;                          // Mapping of depositIds to deposit structs
    mapping(uint256 => bytes32[]) internal depositIntentHashes;             // Mapping of depositId to array of intentHashes
    mapping(uint256 => mapping(bytes32 => Intent)) internal depositIntents; // Mapping of depositId to intentHash to intent

    uint256 public depositCounter;          // Counter for depositIds
    
    uint256 public makerProtocolFee;        // Protocol fee taken from maker (in preciseUnits, 1e16 = 1%)
    address public makerFeeRecipient;       // Address that receives maker protocol fees
    uint256 public dustThreshold;           // Amount below which deposits are considered dust and can be closed
    uint256 public maxIntentsPerDeposit;    // Maximum active intents per deposit (suggested to keep below 100 to prevent deposit withdraw DOS)
    uint256 public intentExpirationPeriod;  // Time period after which an intent expires

    /* ============ Modifiers ============ */

    /**
     * @notice Modifier to check if caller is depositor or their delegate for a specific deposit
     * @param _depositId The deposit ID to check authorization for
     */
    modifier onlyDepositorOrDelegate(uint256 _depositId) {
        Deposit storage deposit = deposits[_depositId];
        if (!(deposit.depositor == msg.sender || 
            (deposit.delegate != address(0) && deposit.delegate == msg.sender))) {
            revert UnauthorizedCallerOrDelegate(msg.sender, deposit.depositor, deposit.delegate);
        }
        _;
    }

    /**
     * @notice Modifier to restrict access to orchestrator-only functions
     */
    modifier onlyOrchestrator() {
        if (msg.sender != address(orchestrator)) revert UnauthorizedCaller(msg.sender, address(orchestrator));
        _;
    }

    /* ============ Constructor ============ */
    constructor(
        address _owner,
        uint256 _chainId,
        address _paymentVerifierRegistry,
        uint256 _makerProtocolFee,
        address _makerFeeRecipient,
        uint256 _dustThreshold,
        uint256 _maxIntentsPerDeposit,
        uint256 _intentExpirationPeriod
    )
        Ownable()
    {
        chainId = _chainId;
        paymentVerifierRegistry = IPaymentVerifierRegistry(_paymentVerifierRegistry);
        makerProtocolFee = _makerProtocolFee;
        makerFeeRecipient = _makerFeeRecipient;
        dustThreshold = _dustThreshold;
        maxIntentsPerDeposit = _maxIntentsPerDeposit;
        intentExpirationPeriod = _intentExpirationPeriod;

        transferOwnership(_owner);
    }

    /* ============ Deposit Owner Only (External Functions) ============ */

    /**
     * @notice Creates a deposit entry by locking liquidity in the escrow contract that can be taken by signaling intents. This function will 
     * not add to previous deposits. Every deposit has it's own unique identifier. User must approve the contract to transfer the deposit amount
     * of deposit token. Every deposit specifies the payment methods it supports by specifying their verification data, supported currencies and 
     * their min conversion rates for each payment method. Optionally, a referrer and a referrer fee can be specified.
     * Note that the order of the payment methods, verification data, and currency data must match.
     */
    function createDeposit(CreateDepositParams calldata _params) external whenNotPaused {
        // Checks
        if (_params.intentAmountRange.min == 0) revert ZeroMinValue();
        if (_params.intentAmountRange.min > _params.intentAmountRange.max) { 
            revert InvalidRange(_params.intentAmountRange.min, _params.intentAmountRange.max);
        }

        // Validate referrer fee configuration
        if (_params.referrerFee > MAX_REFERRER_FEE) revert FeeExceedsMaximum(_params.referrerFee, MAX_REFERRER_FEE);
        if (_params.referrer == address(0) && _params.referrerFee != 0) revert InvalidReferrerFeeConfiguration();

        // Calculate maker fees and net deposit amount
        uint256 totalFees = 0;
        if (makerProtocolFee > 0) {
            totalFees += (_params.amount * makerProtocolFee) / PRECISE_UNIT;
        }
        if (_params.referrerFee > 0) {
            totalFees += (_params.amount * _params.referrerFee) / PRECISE_UNIT;
        }
        uint256 netDepositAmount = _params.amount - totalFees;
        if (netDepositAmount < _params.intentAmountRange.min) {
            revert AmountBelowMin(netDepositAmount, _params.intentAmountRange.min);
        }
        
        // Effects
        uint256 depositId = depositCounter++;
        accountDeposits[msg.sender].push(depositId);
        deposits[depositId] = Deposit({
            depositor: msg.sender,
            delegate: _params.delegate,
            token: _params.token,
            amount: _params.amount,
            intentAmountRange: _params.intentAmountRange,
            acceptingIntents: true,
            remainingDeposits: netDepositAmount,    // Net amount available for intents
            outstandingIntentAmount: 0,
            makerProtocolFee: makerProtocolFee,
            reservedMakerFees: totalFees,
            accruedMakerFees: 0,
            accruedReferrerFees: 0,
            intentGuardian: _params.intentGuardian,
            referrer: _params.referrer,
            referrerFee: _params.referrerFee
        });

        emit DepositReceived(
            depositId, 
            msg.sender, 
            _params.token, 
            _params.amount, 
            _params.intentAmountRange, 
            _params.delegate, 
            _params.intentGuardian
        );

        _addPaymentMethodsToDeposit(depositId, _params.paymentMethods, _params.paymentMethodData, _params.currencies);

        // Interactions
        _params.token.safeTransferFrom(msg.sender, address(this), _params.amount);
    }

    /**
     * @notice Adds additional funds to an existing deposit. Only the depositor can add funds.
     * The funds will be added to the remaining deposits amount, making it available for new intents.
     *
     * @param _depositId    The deposit ID to add funds to
     * @param _amount       The amount of tokens to add
     */
    function addFundsToDeposit(uint256 _depositId, uint256 _amount)
        external
        whenNotPaused
    {
        // Checks
        Deposit storage deposit = deposits[_depositId];
        if (deposit.depositor != msg.sender) revert UnauthorizedCaller(msg.sender, deposit.depositor);
        if (_amount == 0) revert ZeroValue();
        
        // Effects
        uint256 additionalMakerFees = 0;
        uint256 additionalReferrerFees = 0;

        if (deposit.makerProtocolFee > 0) {
            additionalMakerFees = (_amount * deposit.makerProtocolFee) / PRECISE_UNIT;
        }
        if (deposit.referrerFee > 0) {
            additionalReferrerFees = (_amount * deposit.referrerFee) / PRECISE_UNIT;
        }

        uint256 totalFees = additionalMakerFees + additionalReferrerFees;
        uint256 netAdditionalAmount = _amount - totalFees;
        
        deposit.amount += _amount;
        deposit.remainingDeposits += netAdditionalAmount;
        deposit.reservedMakerFees += totalFees;
        
        emit DepositFundsAdded(_depositId, msg.sender, _amount);
        
        // Interactions
        deposit.token.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @notice Removes funds from an existing deposit. Only the depositor can remove funds. If the amount to remove is greater
     * than the remaining deposits, then expired intents will be pruned to reclaim liquidity. If the remaining deposits is less than
     * the min intent amount, then the deposit will be marked as not accepting intents. Reserved maker fees remain locked until full
     * withdrawal via withdrawDeposit().
     *
     * @param _depositId    The deposit ID to remove funds from
     * @param _amount       The amount of tokens to remove
     */
    function removeFundsFromDeposit(uint256 _depositId, uint256 _amount)
        external
        whenNotPaused
    {
        // Checks
        Deposit storage deposit = deposits[_depositId];
        if (deposit.depositor != msg.sender) revert UnauthorizedCaller(msg.sender, deposit.depositor);
        if (_amount == 0) revert ZeroValue();
        
        // Effects
        if (deposit.remainingDeposits < _amount) {
            _pruneExpiredIntents(deposit, _depositId, _amount);
        }
        
        deposit.amount -= _amount;
        deposit.remainingDeposits -= _amount;
        
        if (deposit.acceptingIntents && deposit.remainingDeposits < deposit.intentAmountRange.min) {
            deposit.acceptingIntents = false;
        }

        emit DepositWithdrawn(_depositId, msg.sender, _amount, deposit.acceptingIntents);
        
        // Interactions
        deposit.token.safeTransfer(msg.sender, _amount);
    }

    /**
     * @notice Depositor is returned all remaining deposits, any outstanding intents that are expired, and unused maker fees.
     * Only the depositor can withdraw. If an intent is not expired then those funds will not be returned. Deposit is marked
     * as to not accept new intents and the funds locked due to intents can be withdrawn once they expire by calling this
     * function again. Deposit will be deleted and accrued maker fees collected to protocol as long as there are no more
     * outstanding intents.
     *
     * @param _depositId   DepositId the depositor is attempting to withdraw
     */
    function withdrawDeposit(uint256 _depositId) external {
        // Checks
        Deposit storage deposit = deposits[_depositId];
        if (deposit.depositor != msg.sender) revert UnauthorizedCaller(msg.sender, deposit.depositor);

        // Effects
        (
            bytes32[] memory expiredIntents,
            uint256 reclaimableAmount
        ) = _getExpiredIntents(_depositId);

        _pruneIntents(_depositId, expiredIntents);

        uint256 unusedFees = deposit.reservedMakerFees - deposit.accruedMakerFees - deposit.accruedReferrerFees;
        uint256 returnAmount = deposit.remainingDeposits + reclaimableAmount + unusedFees;
        
        _collectAccruedMakerFees(_depositId, deposit);
        _collectAccruedReferrerFees(_depositId, deposit);

        IERC20 token = deposit.token;
        deposit.outstandingIntentAmount -= reclaimableAmount;
        delete deposit.remainingDeposits;
        delete deposit.acceptingIntents;
        delete deposit.accruedMakerFees;
        delete deposit.accruedReferrerFees;

        emit DepositWithdrawn(_depositId, deposit.depositor, returnAmount, false);

        if (deposit.outstandingIntentAmount == 0) {
            _closeDeposit(_depositId, deposit);
        }
        
        // Interactions
        token.safeTransfer(msg.sender, returnAmount);
    }

    /**
     * @notice Allows depositor to set a delegate address that can manage a specific deposit
     *
     * @param _depositId    The deposit ID
     * @param _delegate     The address to set as delegate (address(0) to remove delegate)
     */
    
    function setDepositDelegate(uint256 _depositId, address _delegate) external {
        Deposit storage deposit = deposits[_depositId];
        if (deposit.depositor != msg.sender) revert UnauthorizedCaller(msg.sender, deposit.depositor);
        if (_delegate == address(0)) revert ZeroAddress();
        
        deposit.delegate = _delegate;
        
        emit DepositDelegateSet(_depositId, msg.sender, _delegate);
    }

    /**
     * @notice Allows depositor to remove the delegate for a specific deposit
     *
     * @param _depositId    The deposit ID
     */
    function removeDepositDelegate(uint256 _depositId) external {
        Deposit storage deposit = deposits[_depositId];
        if (deposit.depositor != msg.sender) revert UnauthorizedCaller(msg.sender, deposit.depositor);
        if (deposit.delegate == address(0)) revert DelegateNotFound(_depositId);
        
        delete deposit.delegate;
        
        emit DepositDelegateRemoved(_depositId, msg.sender);
    }

    /* ============ Deposit Owner OR Delegate Only (External Functions) ============ */

    /**
     * @notice Only callable by the depositor for a deposit. Allows depositor to update the min conversion rate for a currency for a 
     * payment verifier. Since intent's store the conversion rate at the time of intent, changing the min conversion rate will not affect
     * any intents that have already been signaled.
     *
     * @param _depositId                The deposit ID
     * @param _paymentMethod            The payment method to update the min conversion rate for
     * @param _fiatCurrency             The fiat currency code to update the min conversion rate for
     * @param _newMinConversionRate     The new min conversion rate. Must be greater than 0.
     */
    function updateDepositMinConversionRate(
        uint256 _depositId, 
        bytes32 _paymentMethod, 
        bytes32 _fiatCurrency, 
        uint256 _newMinConversionRate
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        uint256 oldMinConversionRate = depositCurrencyMinRate[_depositId][_paymentMethod][_fiatCurrency];

        if (oldMinConversionRate == 0) revert CurrencyNotSupported(_paymentMethod, _fiatCurrency);
        if (_newMinConversionRate == 0) revert ZeroConversionRate();

        depositCurrencyMinRate[_depositId][_paymentMethod][_fiatCurrency] = _newMinConversionRate;

        emit DepositMinConversionRateUpdated(_depositId, _paymentMethod, _fiatCurrency, _newMinConversionRate);
    }

    /**
     * @notice Allows depositor to update the intent amount range for a deposit. Since intent's are already created within the
     * previous intent amount range, changing the intent amount range will not affect any intents that have already been signaled.
     *
     * @param _depositId                The deposit ID
     * @param _intentAmountRange        The new intent amount range
     */
    function updateDepositIntentAmountRange(
        uint256 _depositId, 
        Range calldata _intentAmountRange
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        Deposit storage deposit = deposits[_depositId];
        if (_intentAmountRange.min == 0) revert ZeroMinValue();
        if (_intentAmountRange.min > _intentAmountRange.max) revert InvalidRange(_intentAmountRange.min, _intentAmountRange.max);

        deposit.intentAmountRange = _intentAmountRange;

        emit DepositIntentAmountRangeUpdated(_depositId, _intentAmountRange);
    }

    /**
     * @notice Allows depositor to add a new payment verifier and its associated currencies to an existing deposit.
     * @dev WARNING: Adding excessive payment methods or currencies may cause withdrawal to exceed gas limits. Depositors
     * can remove entries individually if needed. Recommended: <10 payment methods, <50 currencies each.
     *
     * @param _depositId             The deposit ID
     * @param _paymentMethods        The payment methods to add
     * @param _paymentMethodData     The payment verification data for the payment methods
     * @param _currencies            The currencies for the payment methods
     */
    function addPaymentMethodsToDeposit(
        uint256 _depositId,
        bytes32[] calldata _paymentMethods,
        DepositPaymentMethodData[] calldata _paymentMethodData,
        Currency[][] calldata _currencies
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        _addPaymentMethodsToDeposit(_depositId, _paymentMethods, _paymentMethodData, _currencies);
    }

    /**
     * @notice Allows depositor to remove an existing payment verifier from a deposit. 
     * NOTE: This function does not delete the veirifier data, it only removes the verifier from the deposit.
     *
     * @param _depositId             The deposit ID
     * @param _paymentMethod         The payment method to remove
     */
    function removePaymentMethodFromDeposit(
        uint256 _depositId,
        bytes32 _paymentMethod
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        if (depositPaymentMethodData[_depositId][_paymentMethod].payeeDetails == bytes32(0)) {
            revert PaymentMethodNotFound(_depositId, _paymentMethod);
        }

        depositPaymentMethods[_depositId].removeStorage(_paymentMethod);

        bytes32[] storage currenciesForPaymentMethod = depositCurrencies[_depositId][_paymentMethod];
        for (uint256 i = 0; i < currenciesForPaymentMethod.length; i++) {
            bytes32 currencyCode = currenciesForPaymentMethod[i];
            delete depositCurrencyMinRate[_depositId][_paymentMethod][currencyCode];
        }
        delete depositCurrencies[_depositId][_paymentMethod];
        
        // Don't delete deposit payment method data to allow existing intents to be fulfilled        

        emit DepositPaymentMethodRemoved(_depositId, _paymentMethod);
    }

    /**
     * @notice Allows depositor to add a new currencies to an existing verifier for a deposit.
     * @dev WARNING: Adding excessive currencies may cause withdrawal to exceed gas limits. Depositors
     * can remove entries individually if needed. Recommended: <50 currencies per payment method.
     *
     * @param _depositId             The deposit ID
     * @param _paymentMethod         The payment method
     * @param _currencies            The currencies to add (code and conversion rate)
     */
    function addCurrenciesToDepositPaymentMethod(
        uint256 _depositId,
        bytes32 _paymentMethod,
        Currency[] calldata _currencies
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        bytes32 payeeDetails = depositPaymentMethodData[_depositId][_paymentMethod].payeeDetails;
        if (payeeDetails == bytes32(0)) revert PaymentMethodNotFound(_depositId, _paymentMethod);
        
        for (uint256 i = 0; i < _currencies.length; i++) {
            _addCurrencyToDeposit(
                _depositId, 
                _paymentMethod, 
                _currencies[i].code, 
                _currencies[i].minConversionRate
            );
        }
    }

    /**
     * @notice Allows depositor to remove an existing currency from a verifier for a deposit.
     *
     * @param _depositId             The deposit ID
     * @param _paymentMethod         The payment method
     * @param _currencyCode          The currency code to remove
     */
    function removeCurrencyFromDepositPaymentMethod(
        uint256 _depositId,
        bytes32 _paymentMethod,
        bytes32 _currencyCode
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        bytes32 payeeDetails = depositPaymentMethodData[_depositId][_paymentMethod].payeeDetails;
        if (payeeDetails == bytes32(0)) revert PaymentMethodNotFound(_depositId, _paymentMethod);

        uint256 currencyMinRate = depositCurrencyMinRate[_depositId][_paymentMethod][_currencyCode];
        if (currencyMinRate == 0) revert CurrencyNotFound(_paymentMethod, _currencyCode);

        depositCurrencies[_depositId][_paymentMethod].removeStorage(_currencyCode);
        delete depositCurrencyMinRate[_depositId][_paymentMethod][_currencyCode];

        emit DepositCurrencyRemoved(_depositId, _paymentMethod, _currencyCode);
    }

    /**
     * @notice Allows depositor or delegateto set the accepting intents state for a deposit.
     *
     * @param _depositId             The deposit ID
     * @param _acceptingIntents      The new accepting intents state
     */
    function setDepositAcceptingIntents(
        uint256 _depositId, 
        bool _acceptingIntents
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        Deposit storage deposit = deposits[_depositId];
        if (deposit.acceptingIntents == _acceptingIntents) revert DepositAlreadyInState(_depositId, _acceptingIntents);
        // Doesn't reclaim liquidity for gas savings
        if (deposit.remainingDeposits == 0) revert InsufficientDepositLiquidity(_depositId, 0, 1);
        
        deposit.acceptingIntents = _acceptingIntents;
        emit DepositAcceptingIntentsUpdated(_depositId, _acceptingIntents);
    }

    /* ============ Anyone callable (External Functions) ============ */

    /**
     * @notice ANYONE: Can be called by anyone to clean up expired intents.
     * 
     * @param _depositId The deposit ID to prune expired intents for
     */
    function pruneExpiredIntents(uint256 _depositId) external {
        _pruneExpiredIntents(deposits[_depositId], _depositId, 0);
    }


    /* ============ Orchestrator-Only Locking and Unlocking Functions ============ */

    /**
     * @notice ORCHESTRATOR ONLY: Locks funds for an intent with expiry time. Only callable by orchestrator.
     *
     * @param _depositId The deposit ID to lock funds from
     * @param _amount The amount to lock
     * @param _intentHash The intent hash this intent corresponds to
     */
    function lockFunds(
        uint256 _depositId, 
        bytes32 _intentHash,
        uint256 _amount
    ) 
        external 
        onlyOrchestrator 
    {
        // Checks
        Deposit storage deposit = deposits[_depositId];
        if (deposit.depositor == address(0)) revert DepositNotFound(_depositId);
        if (!deposit.acceptingIntents) revert DepositNotAcceptingIntents(_depositId);
        if (_amount < deposit.intentAmountRange.min) revert AmountBelowMin(_amount, deposit.intentAmountRange.min);
        if (_amount > deposit.intentAmountRange.max) revert AmountAboveMax(_amount, deposit.intentAmountRange.max);
        
        // Effects
        // Check if we need to reclaim expired liquidity first
        uint256 currentIntentCount = depositIntentHashes[_depositId].length;
        if (deposit.remainingDeposits < _amount || currentIntentCount >= maxIntentsPerDeposit) {
            _pruneExpiredIntents(deposit, _depositId, _amount);

            currentIntentCount = depositIntentHashes[_depositId].length;
            if (currentIntentCount >= maxIntentsPerDeposit) {
                revert MaxIntentsExceeded(_depositId, currentIntentCount, maxIntentsPerDeposit);
            }
        }
        
        // Update deposit state
        deposit.remainingDeposits -= _amount;
        deposit.outstandingIntentAmount += _amount;
        
        depositIntentHashes[_depositId].push(_intentHash);
        uint256 expiryTime = block.timestamp + intentExpirationPeriod;
        depositIntents[_depositId][_intentHash] = Intent({
            intentHash: _intentHash,
            amount: _amount,
            timestamp: block.timestamp,
            expiryTime: expiryTime
        });

        emit FundsLocked(_depositId, _intentHash, _amount, expiryTime);
    }

    /**
     * @notice ORCHESTRATOR ONLY: Unlocks funds from a cancelled intent by removing the specific intent. 
     * Only callable by orchestrator.
     * 
     * @param _depositId The deposit ID to unlock funds from
     * @param _intentHash The intent hash to find and remove the intent for
     */
    function unlockFunds(uint256 _depositId, bytes32 _intentHash) 
        external 
        onlyOrchestrator 
    {
        // Checks
        Deposit storage deposit = deposits[_depositId];
        Intent memory intent = depositIntents[_depositId][_intentHash];

        if (deposit.depositor == address(0)) revert DepositNotFound(_depositId);
        if (intent.intentHash == bytes32(0)) revert IntentNotFound(_intentHash);

        // Effects
        deposit.remainingDeposits += intent.amount;
        deposit.outstandingIntentAmount -= intent.amount;

        _pruneIntent(_depositId, _intentHash);

        emit FundsUnlocked(_depositId, _intentHash, intent.amount);
    }

    /**
     * @notice ORCHESTRATOR ONLY: Unlocks and transfers funds from a fulfilled intent by removing the specific intent.
     * Only callable by orchestrator.
     * 
     * @param _depositId The deposit ID to transfer from
     * @param _intentHash The intent hash to find and remove the intent for
     * @param _transferAmount The amount to actually transfer (may be less than intent amount)
     * @param _to The address to transfer to (orchestrator)
     */
    function unlockAndTransferFunds(
        uint256 _depositId, 
        bytes32 _intentHash,
        uint256 _transferAmount, 
        address _to
    ) 
        external 
        onlyOrchestrator 
    {
        // Checks
        Deposit storage deposit = deposits[_depositId];
        Intent memory intent = depositIntents[_depositId][_intentHash];
        
        if (deposit.depositor == address(0)) revert DepositNotFound(_depositId);
        if (intent.intentHash == bytes32(0)) revert IntentNotFound(_intentHash);
        if (_transferAmount == 0) revert ZeroValue();
        if (_transferAmount > intent.amount) revert AmountExceedsAvailable(_transferAmount, intent.amount);
        
        // Effects
        uint256 makerFeeForThisTransfer = 0;
        uint256 referrerFeeForThisTransfer = 0;

        if (deposit.makerProtocolFee > 0) {
            makerFeeForThisTransfer = (_transferAmount * deposit.makerProtocolFee) / PRECISE_UNIT;
            deposit.accruedMakerFees += makerFeeForThisTransfer;
        }
        if (deposit.referrerFee > 0) {
            referrerFeeForThisTransfer = (_transferAmount * deposit.referrerFee) / PRECISE_UNIT;
            deposit.accruedReferrerFees += referrerFeeForThisTransfer;
        }

        deposit.outstandingIntentAmount -= intent.amount;
        if (_transferAmount < intent.amount) {
            // Return unused funds to remaining deposits (partial release)
            deposit.remainingDeposits += (intent.amount - _transferAmount);
        }

        _pruneIntent(_depositId, _intentHash);
        
        IERC20 token = deposit.token;
        _closeDepositIfNecessary(_depositId, deposit);
        
        emit FundsUnlockedAndTransferred(
            _depositId, _intentHash, intent.amount, _transferAmount, makerFeeForThisTransfer, referrerFeeForThisTransfer, _to
        );

        // Interactions
        token.safeTransfer(_to, _transferAmount);
    }

    /* ============ Intent Guardian Only (External Functions) ============ */

    /**
     * @notice INTENT GUARDIAN ONLY: Extends the expiry time of an existing intent. Only callable by intent guardian.
     * 
     * @param _depositId The deposit ID containing the intent
     * @param _intentHash The intent hash to extend expiry for
     * @param _additionalTime The additional time to extend the expiry by
     */
    function extendIntentExpiry(
        uint256 _depositId, 
        bytes32 _intentHash,
        uint256 _additionalTime
    ) 
        external 
    {
        Deposit storage deposit = deposits[_depositId];
        Intent storage intent = depositIntents[_depositId][_intentHash];
        
        if (deposit.depositor == address(0)) revert DepositNotFound(_depositId);
        if (intent.intentHash == bytes32(0)) revert IntentNotFound(_intentHash);
        if (deposit.intentGuardian != msg.sender) revert UnauthorizedCaller(msg.sender, deposit.intentGuardian);
        if (_additionalTime == 0) revert ZeroValue();
        if (intent.expiryTime + _additionalTime > intent.timestamp + MAX_TOTAL_INTENT_EXPIRATION_PERIOD) {
            revert AmountAboveMax(_additionalTime, MAX_TOTAL_INTENT_EXPIRATION_PERIOD);
        }
        
        intent.expiryTime += _additionalTime;
        
        emit IntentExpiryExtended(_depositId, _intentHash, intent.expiryTime);
    }

    /* ============ Governance Functions ============ */
    
    /**
     * @notice NEW: Sets the orchestrator contract address. Only callable by owner.
     *
     * @param _orchestrator The orchestrator contract address
     */
    function setOrchestrator(address _orchestrator) external onlyOwner {
        if (_orchestrator == address(0)) revert ZeroAddress();
        
        orchestrator = IOrchestrator(_orchestrator);
        emit OrchestratorUpdated(_orchestrator);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the payment verifier registry address.
     *
     * @param _paymentVerifierRegistry   New payment verifier registry address
     */
    function setPaymentVerifierRegistry(address _paymentVerifierRegistry) external onlyOwner {
        if (_paymentVerifierRegistry == address(0)) revert ZeroAddress();
        
        paymentVerifierRegistry = IPaymentVerifierRegistry(_paymentVerifierRegistry);
        emit PaymentVerifierRegistryUpdated(_paymentVerifierRegistry);
    }

    /**
     * @notice GOVERNANCE ONLY: Sets the maker protocol fee rate. This fee is charged to makers upon fulfillment of 
     * intents.
     *
     * @param _makerProtocolFee The maker protocol fee in preciseUnits (1e16 = 1%)
     */
    function setMakerProtocolFee(uint256 _makerProtocolFee) external onlyOwner {
        if (_makerProtocolFee > MAX_MAKER_FEE) revert AmountAboveMax(_makerProtocolFee, MAX_MAKER_FEE);
        
        makerProtocolFee = _makerProtocolFee;
        emit MakerProtocolFeeUpdated(_makerProtocolFee);
    }
    
    /**
     * @notice GOVERNANCE ONLY: Sets the address that receives maker protocol fees.
     *
     * @param _makerFeeRecipient The address to receive maker fees
     */
    function setMakerFeeRecipient(address _makerFeeRecipient) external onlyOwner {
        if (_makerFeeRecipient == address(0)) revert ZeroAddress();
        
        makerFeeRecipient = _makerFeeRecipient;
        emit MakerFeeRecipientUpdated(_makerFeeRecipient);
    }
    
    /**
     * @notice GOVERNANCE ONLY: Sets the dust threshold below which deposits can be closed automatically.
     *
     * @param _dustThreshold The new dust threshold amount
     */
    function setDustThreshold(uint256 _dustThreshold) external onlyOwner {
        if (_dustThreshold > MAX_DUST_THRESHOLD) revert AmountAboveMax(_dustThreshold, MAX_DUST_THRESHOLD);
        
        dustThreshold = _dustThreshold;
        emit DustThresholdUpdated(_dustThreshold);
    }

    /**
     * @notice GOVERNANCE ONLY: Sets the maximum number of active intents per deposit.
     *
     * @param _maxIntentsPerDeposit The new maximum number of active intents per deposit
     */
    function setMaxIntentsPerDeposit(uint256 _maxIntentsPerDeposit) external onlyOwner {
        if (_maxIntentsPerDeposit == 0) revert ZeroValue();
        
        maxIntentsPerDeposit = _maxIntentsPerDeposit;
        emit MaxIntentsPerDepositUpdated(_maxIntentsPerDeposit);
    }

    /**
     * @notice GOVERNANCE ONLY: Sets the intent expiration period.
     *
     * @param _intentExpirationPeriod The new intent expiration period in seconds
     */
    function setIntentExpirationPeriod(uint256 _intentExpirationPeriod) external onlyOwner {
        if (_intentExpirationPeriod == 0) revert ZeroValue();
        
        intentExpirationPeriod = _intentExpirationPeriod;
        emit IntentExpirationPeriodUpdated(_intentExpirationPeriod);
    }

    /**
     * @notice GOVERNANCE ONLY: Pauses deposit creation, intent creation and intent fulfillment functionality for the escrow.
     * Functionalities that are paused:
     * - Deposit creation
     * - Updating conversion rates
     * TODO: Update this list.
     *
     * Functionalities that remain unpaused to allow users to retrieve funds in contract:
     * - Deposit withdrawal
     */
    function pauseEscrow() external onlyOwner {
        _pause();
    }

    /**
     * @notice GOVERNANCE ONLY: Restarts paused functionality for the escrow.
     */
    function unpauseEscrow() external onlyOwner {
        _unpause();
    }

    /* ============ External View Functions ============ */

    function getDeposit(uint256 _depositId) external view returns (Deposit memory) {
        return deposits[_depositId];
    }

    function getDepositIntentHashes(uint256 _depositId) external view returns (bytes32[] memory) {
        return depositIntentHashes[_depositId];
    }

    function getDepositIntent(uint256 _depositId, bytes32 _intentHash) external view returns (Intent memory) {
        return depositIntents[_depositId][_intentHash];
    }

    function getDepositPaymentMethods(uint256 _depositId) external view returns (bytes32[] memory) {
        return depositPaymentMethods[_depositId];
    }

    function getDepositCurrencies(uint256 _depositId, bytes32 _paymentMethod) external view returns (bytes32[] memory) {
        return depositCurrencies[_depositId][_paymentMethod];
    }

    function getDepositCurrencyMinRate(uint256 _depositId, bytes32 _paymentMethod, bytes32 _currencyCode) external view returns (uint256) {
        return depositCurrencyMinRate[_depositId][_paymentMethod][_currencyCode];
    }

    function getDepositPaymentMethodData(uint256 _depositId, bytes32 _paymentMethod) external view returns (DepositPaymentMethodData memory) {
        return depositPaymentMethodData[_depositId][_paymentMethod];
    }

    function getAccountDeposits(address _account) external view returns (uint256[] memory) {
        return accountDeposits[_account];
    }
    
    function getExpiredIntents(uint256 _depositId) external view returns (bytes32[] memory expiredIntents, uint256 reclaimedAmount) {
        return _getExpiredIntents(_depositId);
    }


    /* ============ Internal Functions ============ */

    /**
     * @notice Cycles through all intents currently open on a deposit and sees if any have expired. If they have expired
     * the outstanding amounts are summed and returned alongside the intentHashes.
     */
    function _getExpiredIntents(
        uint256 _depositId
    )
        internal
        view
        returns(bytes32[] memory expiredIntents, uint256 reclaimedAmount)
    {
        bytes32[] memory intentHashes = depositIntentHashes[_depositId];
        expiredIntents = new bytes32[](intentHashes.length);

        for (uint256 i = 0; i < intentHashes.length; ++i) {
            Intent memory intent = depositIntents[_depositId][intentHashes[i]];
            if (intent.expiryTime < block.timestamp) {
                expiredIntents[i] = intentHashes[i];
                reclaimedAmount += intent.amount;
            }
        }
    }

    /**
     * @notice Free up deposit liquidity by removing intents that have expired. Tries to remove all expired intents that are expired
     * and adds the reclaimable amount to the deposit's remaining deposits. If the remaining amount including the new recovered amount
     * is less than the minimum required amount, this function will revert with a NotEnoughLiquidity error.
     */
    function _pruneExpiredIntents(Deposit storage _deposit, uint256 _depositId, uint256 _minRequiredAmount) internal {
        (
            bytes32[] memory expiredIntents,
            uint256 reclaimableAmount
        ) = _getExpiredIntents(_depositId);
        
        uint256 availableAmount = _deposit.remainingDeposits;
        availableAmount += reclaimableAmount;
        
        if (availableAmount < _minRequiredAmount) revert InsufficientDepositLiquidity(_depositId, availableAmount, _minRequiredAmount);
        
        // Prune expired intents to free up funds
        _pruneIntents(_depositId, expiredIntents);
        _deposit.remainingDeposits += reclaimableAmount;
        _deposit.outstandingIntentAmount -= reclaimableAmount;
    }

    /**
     * @notice Prunes given intents from a deposit. Also calls orchestrator to clean up intents.
     */
    function _pruneIntents(uint256 _depositId, bytes32[] memory _intents) internal {
        // Call orchestrator to clean up intents first
        try IOrchestrator(orchestrator).pruneIntents(_intents) {} catch {}

        for (uint256 i = 0; i < _intents.length; i++) {
            Intent memory intent = depositIntents[_depositId][_intents[i]];
            if (intent.intentHash != bytes32(0)) {
                _pruneIntent(_depositId, intent.intentHash);
                
                emit FundsUnlocked(_depositId, intent.intentHash, intent.amount);
            }
        }
    }

    /**
     * @notice Prunes an intent from a deposit. Does not call orchestrator.
     */
    function _pruneIntent(uint256 _depositId, bytes32 _intentHash) internal {
        delete depositIntents[_depositId][_intentHash];
        depositIntentHashes[_depositId].removeStorage(_intentHash);
    }

    /**
     * @notice Removes a deposit if no outstanding intents AND remaining funds is dust. Before deletion, collects any 
     * accrued maker fees to the protocol fee recipient and transfers any remaining dust to the protocol fee recipient.
     */
    function _closeDepositIfNecessary(uint256 _depositId, Deposit storage _deposit) internal {
        // If no remaining deposits, delete the acceptingIntents flag
        if (_deposit.remainingDeposits == 0) {
            delete _deposit.acceptingIntents;
        }

        // Close if no outstanding intents, no remaining deposits, and no reserved fees left
        uint256 reservedFeesLeft = _deposit.reservedMakerFees - _deposit.accruedMakerFees - _deposit.accruedReferrerFees;
        uint256 totalRemaining = _deposit.remainingDeposits + reservedFeesLeft;

        if (_deposit.outstandingIntentAmount == 0 && totalRemaining <= dustThreshold) {
            
            _collectAccruedMakerFees(_depositId, _deposit);
            _collectAccruedReferrerFees(_depositId, _deposit);
            
            if (totalRemaining > 0) {
                _deposit.token.safeTransfer(makerFeeRecipient, totalRemaining);
                emit DustCollected(_depositId, totalRemaining, makerFeeRecipient);
            }
            
            _closeDeposit(_depositId, _deposit);
        }
    }


    /**
     * @notice Collects any accrued maker fees to the protocol fee recipient.
     */
    function _collectAccruedMakerFees(uint256 _depositId, Deposit storage _deposit) internal {
        if (_deposit.accruedMakerFees > 0) {
            _deposit.token.safeTransfer(makerFeeRecipient, _deposit.accruedMakerFees);
            emit MakerFeesCollected(_depositId, _deposit.accruedMakerFees, makerFeeRecipient);
        }
    }

    /**
     * @notice Collects any accrued referrer fees to the referrer.
     */
    function _collectAccruedReferrerFees(uint256 _depositId, Deposit storage _deposit) internal {
        if (_deposit.accruedReferrerFees > 0) {
            _deposit.token.safeTransfer(_deposit.referrer, _deposit.accruedReferrerFees);
            emit ReferrerFeesCollected(_depositId, _deposit.accruedReferrerFees, _deposit.referrer);
        }
    }

    /**
     * @notice Closes a deposit. Deleting a deposit deletes it from the deposits mapping and removes tracking
     * it in the user's accountDeposits mapping. Also deletes the verification and currency data for the deposit.
     */
    function _closeDeposit(uint256 _depositId, Deposit storage _deposit) internal {
        address depositor = _deposit.depositor;
        accountDeposits[depositor].removeStorage(_depositId);
        
        _deleteDepositPaymentMethodAndCurrencyData(_depositId);
        
        delete deposits[_depositId];
        
        emit DepositClosed(_depositId, depositor);
    }

    /**
     * @notice Iterates through all verifiers for a deposit and deletes the corresponding verifier data and currencies.
     */
    function _deleteDepositPaymentMethodAndCurrencyData(uint256 _depositId) internal {
        bytes32[] memory paymentMethods = depositPaymentMethods[_depositId];
        for (uint256 i = 0; i < paymentMethods.length; i++) {
            bytes32 paymentMethod = paymentMethods[i];
            delete depositPaymentMethodData[_depositId][paymentMethod];
            bytes32[] memory currencies = depositCurrencies[_depositId][paymentMethod];
            for (uint256 j = 0; j < currencies.length; j++) {
                delete depositCurrencyMinRate[_depositId][paymentMethod][currencies[j]];
            }
            delete depositCurrencies[_depositId][paymentMethod];
        }
        delete depositPaymentMethods[_depositId];
    }

    /**
     * @notice Adds list of payment methods and corresponding verification data and currencies to a deposit.
     */
    function _addPaymentMethodsToDeposit(
        uint256 _depositId,
        bytes32[] calldata _paymentMethods,
        DepositPaymentMethodData[] calldata _paymentMethodData,
        Currency[][] calldata _currencies
    ) internal {

        // Check that the length of the payment methods, depositPaymentMethodData, and currencies arrays are the same
        if (_paymentMethods.length != _paymentMethodData.length) revert ArrayLengthMismatch(_paymentMethods.length, _paymentMethodData.length);
        if (_paymentMethods.length != _currencies.length) revert ArrayLengthMismatch(_paymentMethods.length, _currencies.length);

        for (uint256 i = 0; i < _paymentMethods.length; i++) {
            bytes32 paymentMethod = _paymentMethods[i];
            
            if (paymentMethod == bytes32(0)) revert ZeroAddress();
            if (!paymentVerifierRegistry.isPaymentMethod(paymentMethod)) {
                revert PaymentMethodNotWhitelisted(paymentMethod);
            }
            if (_paymentMethodData[i].payeeDetails == bytes32(0)) revert EmptyPayeeDetails();
            if (depositPaymentMethodData[_depositId][paymentMethod].payeeDetails != bytes32(0)) revert PaymentMethodAlreadyExists(_depositId, paymentMethod);

            depositPaymentMethodData[_depositId][paymentMethod] = _paymentMethodData[i];
            depositPaymentMethods[_depositId].push(paymentMethod);

            emit DepositPaymentMethodAdded(_depositId, paymentMethod, _paymentMethodData[i].payeeDetails, _paymentMethodData[i].intentGatingService);

            for (uint256 j = 0; j < _currencies[i].length; j++) {
                Currency memory currency = _currencies[i][j];

                _addCurrencyToDeposit(
                    _depositId, 
                    paymentMethod, 
                    currency.code, 
                    currency.minConversionRate
                );
            }
        }
    }

    /**
     * @notice Adds a currency to a deposit.
     */
    function _addCurrencyToDeposit(
        uint256 _depositId,
        bytes32 _paymentMethod,
        bytes32 _currencyCode,
        uint256 _minConversionRate
    ) internal {
        if (!paymentVerifierRegistry.isCurrency(_paymentMethod, _currencyCode)) {
            revert CurrencyNotSupported(_paymentMethod, _currencyCode);
        }
        if (_minConversionRate == 0) revert ZeroConversionRate();
        if (depositCurrencyMinRate[_depositId][_paymentMethod][_currencyCode] != 0) {
            revert CurrencyAlreadyExists(_paymentMethod, _currencyCode);
        }
        depositCurrencyMinRate[_depositId][_paymentMethod][_currencyCode] = _minConversionRate;
        depositCurrencies[_depositId][_paymentMethod].push(_currencyCode);

        emit DepositCurrencyAdded(_depositId, _paymentMethod, _currencyCode, _minConversionRate);
    }
}
