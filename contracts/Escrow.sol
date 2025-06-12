//SPDX-License-Identifier: MIT

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import { AddressArrayUtils } from "./external/AddressArrayUtils.sol";
import { Bytes32ArrayUtils } from "./external/Bytes32ArrayUtils.sol";
import { StringArrayUtils } from "./external/StringArrayUtils.sol";
import { Uint256ArrayUtils } from "./external/Uint256ArrayUtils.sol";

import { IEscrow } from "./interfaces/IEscrow.sol";
import { IPostIntentHook } from "./interfaces/IPostIntentHook.sol";
import { IBasePaymentVerifier } from "./verifiers/interfaces/IBasePaymentVerifier.sol";
import { IPaymentVerifier } from "./verifiers/interfaces/IPaymentVerifier.sol";
import { IPaymentVerifierRegistry } from "./interfaces/IPaymentVerifierRegistry.sol";
import { IPostIntentHookRegistry } from "./interfaces/IPostIntentHookRegistry.sol";
import { IRelayerRegistry } from "./interfaces/IRelayerRegistry.sol";

pragma solidity ^0.8.18;

contract Escrow is Ownable, Pausable, IEscrow {

    /* ============ Custom Errors ============ */
    // Authorization errors
    error CallerMustBeDepositorOrDelegate();
    error CallerMustBeDepositor();
    error SenderMustBeIntentOwner();
    error OnlyDepositorCanSetDelegate();
    error OnlyDepositorCanRemoveDelegate();
    
    // Deposit validation errors
    error MinIntentAmountCannotBeZero();
    error MinIntentAmountMustBeLessThanMax();
    error AmountMustBeGreaterThanMinIntent();
    error MinCannotBeZero();
    error MinMustBeLessThanMax();
    error DepositDoesNotExist();
    error DepositNotAcceptingIntents();
    error NoDelegateSetForDeposit();
    
    // Intent validation errors
    error AccountHasUnfulfilledIntent();
    error SignaledAmountMustBeGreaterThanMin();
    error SignaledAmountMustBeLessThanMax();
    error CannotSendToZeroAddress();
    error ReferrerFeeExceedsMaximum();
    error CannotSetReferrerFeeWithoutReferrer();
    error IntentDoesNotExist();
    error NotEnoughLiquidity();
    error ReleaseAmountExceedsIntentAmount();

    // Verifier and currency errors
    error PaymentVerifierNotSupported();
    error PaymentVerifierNotWhitelisted();
    error CurrencyNotSupported();
    error CurrencyOrVerifierNotSupported();
    error RateMustBeGreaterThanOrEqualToMin();
    error InvalidGatingServiceSignature();
    error PostIntentHookNotWhitelisted();
    error VerifierNotFoundForDeposit();
    error CurrencyNotFoundForVerifier();
    error CurrencyNotSupportedByVerifier();
    error VerifierDataAlreadyExists();
    error CurrencyRateAlreadyExists();
    
    // Payment verification errors
    error PaymentVerificationFailed();
    error InvalidIntentHash();
    
    // Configuration errors
    error MinConversionRateMustBeGreaterThanZero();
    error ConversionRateMustBeGreaterThanZero();
    error DelegateCannotBeZeroAddress();
    error VerifierCannotBeZeroAddress();
    error PayeeDetailsCannotBeEmpty();
    error ProtocolFeeExceedsMaximum();
    error ProtocolFeeRecipientCannotBeZeroAddress();
    error MaxIntentExpirationPeriodCannotBeZero();
    
    // Array length errors
    error VerifiersAndDepositVerifierDataLengthMismatch();
    error VerifiersAndCurrenciesLengthMismatch();
    
    // Transfer errors
    error ProtocolFeeTransferFailed();
    error ReferrerFeeTransferFailed();
    error TransferToRecipientFailed();

    using AddressArrayUtils for address[];
    using Bytes32ArrayUtils for bytes32[];
    using ECDSA for bytes32;
    using SignatureChecker for address;
    using StringArrayUtils for string[];
    using Uint256ArrayUtils for uint256[];

    /* ============ Events ============ */

    event DepositReceived(
        uint256 indexed depositId,
        address indexed depositor,
        IERC20 indexed token,
        uint256 amount,
        Range intentAmountRange,
        address delegate
    );

    event DepositVerifierAdded(
        uint256 indexed depositId,
        address indexed verifier,
        bytes32 indexed payeeDetailsHash,
        address intentGatingService
    );

    event DepositCurrencyAdded(
        uint256 indexed depositId,
        address indexed verifier,
        bytes32 indexed currency,
        uint256 conversionRate
    );

    event DepositMinConversionRateUpdated(
        uint256 indexed depositId,
        address indexed verifier,
        bytes32 indexed currency,
        uint256 newMinConversionRate
    );

    event IntentSignaled(
        bytes32 indexed intentHash,
        uint256 indexed depositId,
        address indexed verifier,
        address owner,
        address to,
        uint256 amount,
        bytes32 fiatCurrency,
        uint256 conversionRate,
        uint256 timestamp
    );

    event IntentPruned(
        bytes32 indexed intentHash,
        uint256 indexed depositId
    );

    event IntentFulfilled(
        bytes32 indexed intentHash,
        uint256 indexed depositId,
        address indexed verifier,
        address owner,
        address to,
        uint256 amount,
        uint256 protocolFee,
        uint256 referrerFee,
        bool isManualRelease
    );

    event DepositWithdrawn(
        uint256 indexed depositId,
        address indexed depositor,
        uint256 amount
    );

    event DepositClosed(uint256 depositId, address depositor);
    
    event MinDepositAmountSet(uint256 minDepositAmount);
    event AllowMultipleIntentsUpdated(bool allowMultiple);
    event IntentExpirationPeriodSet(uint256 intentExpirationPeriod);
    
    event DepositIntentAmountRangeUpdated(uint256 indexed depositId, Range intentAmountRange);
    event DepositVerifierRemoved(uint256 indexed depositId, address indexed verifier);
    event DepositCurrencyRemoved(uint256 indexed depositId, address indexed verifier, bytes32 indexed currencyCode);
    
    event DepositDelegateSet(uint256 indexed depositId, address indexed depositor, address indexed delegate);
    event DepositDelegateRemoved(uint256 indexed depositId, address indexed depositor);

    event PaymentVerifierRegistryUpdated(address indexed paymentVerifierRegistry);
    event PostIntentHookRegistryUpdated(address indexed postIntentHookRegistry);
    event RelayerRegistryUpdated(address indexed relayerRegistry);
    
    event ProtocolFeeUpdated(uint256 protocolFee);
    event ProtocolFeeRecipientUpdated(address indexed protocolFeeRecipient);

    /* ============ Constants ============ */
    uint256 internal constant PRECISE_UNIT = 1e18;
    uint256 constant CIRCOM_PRIME_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant MAX_REFERRER_FEE = 5e16;      // 5% max referrer fee
    uint256 constant MAX_PROTOCOL_FEE = 5e16;      // 5% max protocol fee
    
    /* ============ State Variables ============ */

    uint256 immutable public chainId;                                      // chainId of the chain the escrow is deployed on

    mapping(address => uint256[]) internal accountDeposits;           // Mapping of address to depositIds
    mapping(address => bytes32[]) internal accountIntents;             // Mapping of address to array of intentHashes (Multiple intents per address allowed for relayers)
    
    // Mapping of depositId to verifier address to deposit's verification data. A single deposit can support multiple payment 
    // services. Each payment service has it's own verification data which includes the payee details hash and the data used for 
    // payment verification.
    // Example: Deposit 1 => Venmo => payeeDetails: 0x123, data: 0x456
    //                    => Revolut => payeeDetails: 0x789, data: 0xabc
    mapping(uint256 => mapping(address => DepositVerifierData)) internal depositVerifierData;
    mapping(uint256 => address[]) internal depositVerifiers;          // Handy mapping to get all verifiers for a deposit
    
    // Mapping of depositId to verifier address to mapping of fiat currency to min conversion rate. Each payment service can support
    // multiple currencies. Depositor can specify list of currencies and min conversion rates for each payment service.
    // Example: Deposit 1 => Venmo => USD: 1e18
    //                    => Revolut => USD: 1e18, EUR: 1.2e18, SGD: 1.5e18
    mapping(uint256 => mapping(address => mapping(bytes32 => uint256))) internal depositCurrencyMinRate;
    mapping(uint256 => mapping(address => bytes32[])) internal depositCurrencies; // Handy mapping to get all currencies for a deposit and verifier

    mapping(uint256 => Deposit) internal deposits;                    // Mapping of depositIds to deposit structs
    mapping(bytes32 => Intent) internal intents;                      // Mapping of intentHashes to intent structs

    // Registry contracts
    IPaymentVerifierRegistry public paymentVerifierRegistry;
    IPostIntentHookRegistry public postIntentHookRegistry;
    IRelayerRegistry public relayerRegistry;

    // Protocol fee configuration
    uint256 public protocolFee;                                     // Protocol fee taken from taker (in preciseUnits, 1e16 = 1%)
    address public protocolFeeRecipient;                            // Address that receives protocol fees

    bool public allowMultipleIntents;                               // Whether to allow multiple intents per account
    uint256 public intentExpirationPeriod;                          // Time period after which an intent can be pruned from the system

    uint256 public depositCounter;                                  // Counter for depositIds

    // Todo: Update how we calculate intent hash to allow multiple 
    // intents per account (for relayer accounts).

    /* ============ Modifiers ============ */

    /**
     * @notice Modifier to check if caller is depositor or their delegate for a specific deposit
     * @param _depositId The deposit ID to check authorization for
     */
    modifier onlyDepositorOrDelegate(uint256 _depositId) {
        Deposit storage deposit = deposits[_depositId];
        if (!(deposit.depositor == msg.sender || 
            (deposit.delegate != address(0) && deposit.delegate == msg.sender))) {
            revert CallerMustBeDepositorOrDelegate();
        }
        _;
    }

    /* ============ Constructor ============ */
    constructor(
        address _owner,
        uint256 _chainId,
        uint256 _intentExpirationPeriod,
        address _paymentVerifierRegistry,
        address _postIntentHookRegistry,
        address _relayerRegistry,
        uint256 _protocolFee,
        address _protocolFeeRecipient
    )
        Ownable()
    {
        chainId = _chainId;
        intentExpirationPeriod = _intentExpirationPeriod;
        paymentVerifierRegistry = IPaymentVerifierRegistry(_paymentVerifierRegistry);
        postIntentHookRegistry = IPostIntentHookRegistry(_postIntentHookRegistry);
        relayerRegistry = IRelayerRegistry(_relayerRegistry);
        protocolFee = _protocolFee;
        protocolFeeRecipient = _protocolFeeRecipient;

        transferOwnership(_owner);
    }

    /* ============ External Functions ============ */

    /**
     * @notice Creates a deposit entry by locking liquidity in the escrow contract that can be taken by signaling intents. This function will 
     * not add to previous deposits. Every deposit has it's own unique identifier. User must approve the contract to transfer the deposit amount
     * of deposit token. Every deposit specifies the payment services it supports by specifying their corresponding verifier addresses and 
     * verification data, supported currencies and their min conversion rates for each payment service.
     * Note that the order of the verifiers, verification data, and currency data must match.
     *
     * @param _token                     The token to be deposited
     * @param _amount                    The amount of token to deposit
     * @param _intentAmountRange         The max and min take amount for each intent
     * @param _verifiers                 The payment verifiers that deposit supports
     * @param _verifierData              The payment verification data for each verifier that deposit supports
     * @param _currencies                The currencies for each verifier that deposit supports
     * @param _delegate                  Optional delegate address that can manage this deposit (address(0) for no delegate)
     */
    function createDeposit(
        IERC20 _token,
        uint256 _amount,
        Range calldata _intentAmountRange,
        address[] calldata _verifiers,
        DepositVerifierData[] calldata _verifierData,
        Currency[][] calldata _currencies,
        address _delegate
    )
        external
        whenNotPaused
    {
        _validateDepositAmount(_amount, _intentAmountRange);

        uint256 depositId = depositCounter++;

        accountDeposits[msg.sender].push(depositId);

        deposits[depositId] = Deposit({
            depositor: msg.sender,
            delegate: _delegate,
            token: _token,
            amount: _amount,
            intentAmountRange: _intentAmountRange,
            acceptingIntents: true,
            intentHashes: new bytes32[](0),
            remainingDeposits: _amount,
            outstandingIntentAmount: 0
        });

        emit DepositReceived(depositId, msg.sender, _token, _amount, _intentAmountRange, _delegate);

        _addVerifiersToDeposit(depositId, _verifiers, _verifierData, _currencies);

        _token.transferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @notice Signals intent to pay the depositor defined in the _depositId the _amount * deposit conversionRate off-chain
     * in order to unlock _amount of funds on-chain. Caller must provide a signature from the deposit's gating service to prove
     * their eligibility to take liquidity. The offchain gating service can perform any additional verification, for example, 
     * verifying the payer's identity, checking the payer's KYC status, etc. If there are prunable intents then they will be 
     * deleted from the deposit to be able to maintain state hygiene.
     *
     * @param _params                   Struct containing all the intent parameters
     */
    function signalIntent(SignalIntentParams calldata _params)
        external
        whenNotPaused
    {
        Deposit storage deposit = deposits[_params.depositId];
        
        _validateIntent(_params, deposit);

        bytes32 intentHash = _calculateIntentHash(msg.sender, _params.verifier, _params.depositId);

        if (deposit.remainingDeposits < _params.amount) {
            (
                bytes32[] memory prunableIntents,
                uint256 reclaimableAmount
            ) = _getPrunableIntents(_params.depositId);

            if (deposit.remainingDeposits + reclaimableAmount < _params.amount) revert NotEnoughLiquidity();

            _pruneIntents(deposit, prunableIntents);
            deposit.remainingDeposits += reclaimableAmount;
            deposit.outstandingIntentAmount -= reclaimableAmount;
        }

        intents[intentHash] = Intent({
            owner: msg.sender,
            to: _params.to,
            depositId: _params.depositId,
            amount: _params.amount,
            paymentVerifier: _params.verifier,
            fiatCurrency: _params.fiatCurrency,
            conversionRate: _params.conversionRate,
            timestamp: block.timestamp,
            referrer: _params.referrer,
            referrerFee: _params.referrerFee,
            postIntentHook: _params.postIntentHook,
            data: _params.data
        });

        accountIntents[msg.sender].push(intentHash);

        deposit.remainingDeposits -= _params.amount;
        deposit.outstandingIntentAmount += _params.amount;
        deposit.intentHashes.push(intentHash);

        emit IntentSignaled(
            intentHash, 
            _params.depositId, 
            _params.verifier, 
            msg.sender, 
            _params.to, 
            _params.amount, 
            _params.fiatCurrency, 
            _params.conversionRate, 
            block.timestamp
        );
    }

    /**
     * @notice Only callable by the originator of the intent. Cancels an outstanding intent. Deposit state is 
     * updated to reflect the cancelled intent.
     *
     * @param _intentHash    Hash of intent being cancelled
     */
    function cancelIntent(bytes32 _intentHash) external {
        Intent memory intent = intents[_intentHash];
        
        if (intent.timestamp == 0) revert IntentDoesNotExist();
        if (intent.owner != msg.sender) revert SenderMustBeIntentOwner();

        Deposit storage deposit = deposits[intent.depositId];

        _pruneIntent(deposit, _intentHash);

        deposit.remainingDeposits += intent.amount;
        deposit.outstandingIntentAmount -= intent.amount;
    }

    /**
     * @notice Anyone can submit a fulfill intent transaction, even if caller isn't the intent owner. Upon submission the
     * offchain payment proof is verified, payment details are validated, intent is removed, and deposit state is updated. 
     * Deposit token is transferred to the intent.to address.
     *
     * @param _paymentProof         Payment proof. Can be Groth16 Proof, TLSNotary proof, TLSProxy proof, attestation etc.
     * @param _intentHash           Identifier of intent being fulfilled
     */
    function fulfillIntent( 
        bytes calldata _paymentProof,
        bytes32 _intentHash,
        bytes calldata _data
    )
        external
        whenNotPaused
    {
        Intent memory intent = intents[_intentHash];
        Deposit storage deposit = deposits[intent.depositId];
        
        address verifier = intent.paymentVerifier;
        if (verifier == address(0)) revert IntentDoesNotExist();
        
        DepositVerifierData memory verifierData = depositVerifierData[intent.depositId][verifier];
        (bool success, bytes32 intentHash, uint256 releaseAmount) = IPaymentVerifier(verifier).verifyPayment(
            IPaymentVerifier.VerifyPaymentData({
                paymentProof: _paymentProof,
                depositToken: address(deposit.token),
                intentAmount: intent.amount,
                intentTimestamp: intent.timestamp,
                payeeDetails: verifierData.payeeDetails,
                fiatCurrency: intent.fiatCurrency,
                conversionRate: intent.conversionRate,
                data: verifierData.data
            })
        );
        if (!success) revert PaymentVerificationFailed();
        if (intentHash != _intentHash) revert InvalidIntentHash();

        _pruneIntent(deposit, _intentHash);

        // Zero out outstanding intent amount regardless of release amount
        deposit.outstandingIntentAmount -= intent.amount;
        // Return unused funds to remaining deposits
        if (releaseAmount < intent.amount) {
            deposit.remainingDeposits += (intent.amount - releaseAmount);
        }
        
        IERC20 token = deposit.token;
        _closeDepositIfNecessary(intent.depositId, deposit);

        _transferFundsAndExecuteAction(token, intentHash, intent, releaseAmount, _data, false);
    }


    /**
     * @notice Allows depositor to release funds to the payer in case of a failed fulfill intent or because of some other arrangement
     * between the two parties. Upon submission we check to make sure the msg.sender is the depositor, the  intent is removed, and 
     * deposit state is updated. Deposit token is transferred to the payer.
     *
     * @param _intentHash        Hash of intent to resolve by releasing the funds
     * @param _releaseAmount     Amount of funds to release to the payer
     * @param _releaseData       Data to be passed to the post intent hook
     */
    function releaseFundsToPayer(
        bytes32 _intentHash, 
        uint256 _releaseAmount, 
        bytes calldata _releaseData
    ) external {
        Intent memory intent = intents[_intentHash];
        if (intent.owner == address(0)) revert IntentDoesNotExist();
        if (_releaseAmount > intent.amount) revert ReleaseAmountExceedsIntentAmount();

        Deposit storage deposit = deposits[intent.depositId];
        if (deposit.depositor != msg.sender) revert CallerMustBeDepositor();

        _pruneIntent(deposit, _intentHash);

        deposit.outstandingIntentAmount -= intent.amount;
        if (_releaseAmount < intent.amount) {
            deposit.remainingDeposits += (intent.amount - _releaseAmount);
        }

        IERC20 token = deposit.token;
        _closeDepositIfNecessary(intent.depositId, deposit);

        _transferFundsAndExecuteAction(token, _intentHash, intent, _releaseAmount, _releaseData, true);
    }

    /**
     * @notice Only callable by the depositor for a deposit. Allows depositor to update the min conversion rate for a currency for a 
     * payment verifier. Since intent's store the conversion rate at the time of intent, changing the min conversion rate will not affect
     * any intents that have already been signaled.
     *
     * @param _depositId                The deposit ID
     * @param _verifier                 The payment verifier address to update the min conversion rate for
     * @param _fiatCurrency             The fiat currency code to update the min conversion rate for
     * @param _newMinConversionRate        The new min conversion rate. Must be greater than 0.
     */
    function updateDepositMinConversionRate(
        uint256 _depositId, 
        address _verifier, 
        bytes32 _fiatCurrency, 
        uint256 _newMinConversionRate
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        uint256 oldMinConversionRate = depositCurrencyMinRate[_depositId][_verifier][_fiatCurrency];

        if (oldMinConversionRate == 0) revert CurrencyOrVerifierNotSupported();
        if (_newMinConversionRate == 0) revert MinConversionRateMustBeGreaterThanZero();

        depositCurrencyMinRate[_depositId][_verifier][_fiatCurrency] = _newMinConversionRate;

        emit DepositMinConversionRateUpdated(_depositId, _verifier, _fiatCurrency, _newMinConversionRate);
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
        if (_intentAmountRange.min == 0) revert MinCannotBeZero();
        if (_intentAmountRange.min > _intentAmountRange.max) revert MinMustBeLessThanMax();

        deposit.intentAmountRange = _intentAmountRange;

        emit DepositIntentAmountRangeUpdated(_depositId, _intentAmountRange);
    }

    /**
     * @notice Allows depositor to add a new payment verifier and its associated currencies to an existing deposit.
     *
     * @param _depositId             The deposit ID
     * @param _verifiers             The payment verifiers to add
     * @param _verifierData          The payment verification data for the verifiers
     * @param _currencies            The currencies for the verifiers
     */
    function addVerifiersToDeposit(
        uint256 _depositId,
        address[] calldata _verifiers,
        DepositVerifierData[] calldata _verifierData,
        Currency[][] calldata _currencies
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        _addVerifiersToDeposit(_depositId, _verifiers, _verifierData, _currencies);
    }

    /**
     * @notice Allows depositor to remove an existing payment verifier from a deposit. 
     * NOTE: This function does not delete the veirifier data, it only removes the verifier from the deposit.
     *
     * @param _depositId             The deposit ID
     * @param _verifier              The payment verifier to remove
     */
    function removeVerifierFromDeposit(
        uint256 _depositId,
        address _verifier
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        if (bytes(depositVerifierData[_depositId][_verifier].payeeDetails).length == 0) {
            revert VerifierNotFoundForDeposit();
        }

        // Remove verifier from the list
        depositVerifiers[_depositId].removeStorage(_verifier);

        // Delete associated currency data first
        bytes32[] storage currenciesForVerifier = depositCurrencies[_depositId][_verifier];
        for (uint256 i = currenciesForVerifier.length; i > 0; i--) {
            // Iterate backwards for safe deletion if removeStorage reorders/shrinks
            bytes32 currencyCode = currenciesForVerifier[i-1];
            delete depositCurrencyMinRate[_depositId][_verifier][currencyCode];
        }
        delete depositCurrencies[_depositId][_verifier];
        
        // Delete verifier data
        // Don't delete deposit verifier data to prevent reverting on existing intents
        // delete depositVerifierData[_depositId][_verifier];

        emit DepositVerifierRemoved(_depositId, _verifier);
    }

    /**
     * @notice Allows depositor to add a new currencies to an existing verifier for a deposit.
     *
     * @param _depositId             The deposit ID
     * @param _verifier              The payment verifier
     * @param _currencies            The currencies to add (code and conversion rate)
     */
    function addCurrenciesToDepositVerifier(
        uint256 _depositId,
        address _verifier,
        Currency[] calldata _currencies
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        if (bytes(depositVerifierData[_depositId][_verifier].payeeDetails).length == 0) revert VerifierNotFoundForDeposit();
        
        for (uint256 i = 0; i < _currencies.length; i++) {
            _addCurrencyToDeposit(
                _depositId, 
                _verifier, 
                _currencies[i].code, 
                _currencies[i].minConversionRate
            );
        }
    }

    /**
     * @notice Allows depositor to remove an existing currency from a verifier for a deposit.
     *
     * @param _depositId             The deposit ID
     * @param _verifier              The payment verifier
     * @param _currencyCode          The currency code to remove
     */
    function removeCurrencyFromDepositVerifier(
        uint256 _depositId,
        address _verifier,
        bytes32 _currencyCode
    )
        external
        whenNotPaused
        onlyDepositorOrDelegate(_depositId)
    {
        if (bytes(depositVerifierData[_depositId][_verifier].payeeDetails).length == 0) revert VerifierNotFoundForDeposit();
        if (depositCurrencyMinRate[_depositId][_verifier][_currencyCode] == 0) revert CurrencyNotFoundForVerifier();

        depositCurrencies[_depositId][_verifier].removeStorage(_currencyCode);
        delete depositCurrencyMinRate[_depositId][_verifier][_currencyCode];

        emit DepositCurrencyRemoved(_depositId, _verifier, _currencyCode);
    }

    /**
     * @notice Allows depositor to set a delegate address that can manage a specific deposit
     *
     * @param _depositId    The deposit ID
     * @param _delegate     The address to set as delegate (address(0) to remove delegate)
     */
    function setDepositDelegate(uint256 _depositId, address _delegate) external {
        Deposit storage deposit = deposits[_depositId];
        if (deposit.depositor != msg.sender) revert OnlyDepositorCanSetDelegate();
        if (_delegate == address(0)) revert DelegateCannotBeZeroAddress();
        
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
        if (deposit.depositor != msg.sender) revert OnlyDepositorCanRemoveDelegate();
        if (deposit.delegate == address(0)) revert NoDelegateSetForDeposit();
        
        delete deposit.delegate;
        
        emit DepositDelegateRemoved(_depositId, msg.sender);
    }

    /**
     * @notice Caller must be the depositor for depositId, if not revert. Depositor is returned all remaining deposits and any
     * outstanding intents that are expired. If an intent is not expired then those funds will not be returned. Deposit is marked 
     * as to not accept new intents and the funds locked due to intents can be withdrawn once they expire by calling this function
     * again. Deposit will be deleted as long as there are no more outstanding intents.
     *
     * @param _depositId   DepositId the depositor is attempting to withdraw
     */
    function withdrawDeposit(uint256 _depositId) external {
        Deposit storage deposit = deposits[_depositId];

        if (deposit.depositor != msg.sender) revert CallerMustBeDepositor();

        (
            bytes32[] memory prunableIntents,
            uint256 reclaimableAmount
        ) = _getPrunableIntents(_depositId);

        _pruneIntents(deposit, prunableIntents);

        uint256 returnAmount = deposit.remainingDeposits + reclaimableAmount;
        
        deposit.outstandingIntentAmount -= reclaimableAmount;

        emit DepositWithdrawn(_depositId, deposit.depositor, returnAmount);
        
        delete deposit.remainingDeposits;
        delete deposit.acceptingIntents;
        IERC20 token = deposit.token;
        _closeDepositIfNecessary(_depositId, deposit);
        
        token.transfer(msg.sender, returnAmount);
    }

    /* ============ Governance Functions ============ */

    /**
     * @notice GOVERNANCE ONLY: Updates the protocol fee. This fee is charged to takers upon a successful
     * fulfillment of an intent.
     *
     * @param _protocolFee   New protocol fee in preciseUnits (1e16 = 1%)
     */
    function setProtocolFee(uint256 _protocolFee) external onlyOwner {
        if (_protocolFee > MAX_PROTOCOL_FEE) revert ProtocolFeeExceedsMaximum();
        
        protocolFee = _protocolFee;
        emit ProtocolFeeUpdated(_protocolFee);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the protocol fee recipient address.
     *
     * @param _protocolFeeRecipient   New protocol fee recipient address
     */
    function setProtocolFeeRecipient(address _protocolFeeRecipient) external onlyOwner {
        if (_protocolFeeRecipient == address(0)) revert ProtocolFeeRecipientCannotBeZeroAddress();
        
        protocolFeeRecipient = _protocolFeeRecipient;
        emit ProtocolFeeRecipientUpdated(_protocolFeeRecipient);
    }

    /**
     * @notice GOVERNANCE ONLY: Sets whether all accounts can signal multiple intents.
     *
     * @param _allowMultiple   True to allow all accounts to signal multiple intents, false to restrict to whitelisted relayers only
     */
    function setAllowMultipleIntents(bool _allowMultiple) external onlyOwner {
        allowMultipleIntents = _allowMultiple;
        
        emit AllowMultipleIntentsUpdated(_allowMultiple);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the intent expiration period, after this period elapses an intent can be pruned to prevent
     * locking up a depositor's funds.
     *
     * @param _intentExpirationPeriod   New intent expiration period
     */
    function setIntentExpirationPeriod(uint256 _intentExpirationPeriod) external onlyOwner {
        if (_intentExpirationPeriod == 0) revert MaxIntentExpirationPeriodCannotBeZero();

        intentExpirationPeriod = _intentExpirationPeriod;
        emit IntentExpirationPeriodSet(_intentExpirationPeriod);
    }

    /**
     * @notice GOVERNANCE ONLY: Pauses deposit creation, intent creation and intent fulfillment functionality for the escrow.
     * Functionalities that are paused:
     * - Deposit creation
     * - Updating conversion rates
     * - Intent creation
     * - Intent fulfillment
     * TODO: Update this list.
     *
     * Functionalities that remain unpaused to allow users to retrieve funds in contract:
     * - Intent cancellation
     * - Deposit withdrawal
     * - Manual intent fulfillment
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

    /**
     * @notice GOVERNANCE ONLY: Updates the payment verifier registry address.
     *
     * @param _paymentVerifierRegistry   New payment verifier registry address
     */
    function setPaymentVerifierRegistry(address _paymentVerifierRegistry) external onlyOwner {
        require(_paymentVerifierRegistry != address(0), "Payment verifier registry cannot be zero address");
        
        paymentVerifierRegistry = IPaymentVerifierRegistry(_paymentVerifierRegistry);
        emit PaymentVerifierRegistryUpdated(_paymentVerifierRegistry);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the post intent hook registry address.
     *
     * @param _postIntentHookRegistry   New post intent hook registry address
     */
    function setPostIntentHookRegistry(address _postIntentHookRegistry) external onlyOwner {
        require(_postIntentHookRegistry != address(0), "Post intent hook registry cannot be zero address");
        
        postIntentHookRegistry = IPostIntentHookRegistry(_postIntentHookRegistry);
        emit PostIntentHookRegistryUpdated(_postIntentHookRegistry);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the relayer registry address.
     *
     * @param _relayerRegistry   New relayer registry address
     */
    function setRelayerRegistry(address _relayerRegistry) external onlyOwner {
        require(_relayerRegistry != address(0), "Relayer registry cannot be zero address");
        
        relayerRegistry = IRelayerRegistry(_relayerRegistry);
        emit RelayerRegistryUpdated(_relayerRegistry);
    }

    /* ============ External View Functions ============ */

    /**
     * @notice Cycles through all intents currently open on a deposit and sees if any have expired. If they have expired
     * the outstanding amounts are summed up to get the reclaimable amount and returned alongside the intentHashes.
     *
     * @param _depositId   The deposit ID
     */
    function getPrunableIntents(uint256 _depositId) external view returns (bytes32[] memory prunableIntents, uint256 reclaimedAmount) {
        return _getPrunableIntents(_depositId);
    }

    function getDeposit(uint256 _depositId) external view returns (Deposit memory) {
        return deposits[_depositId];
    }

    function getIntent(bytes32 _intentHash) external view returns (Intent memory) {
        return intents[_intentHash];
    }

    function getDepositVerifiers(uint256 _depositId) external view returns (address[] memory) {
        return depositVerifiers[_depositId];
    }

    function getDepositCurrencies(uint256 _depositId, address _verifier) external view returns (bytes32[] memory) {
        return depositCurrencies[_depositId][_verifier];
    }

    function getDepositCurrencyMinRate(uint256 _depositId, address _verifier, bytes32 _currencyCode) external view returns (uint256) {
        return depositCurrencyMinRate[_depositId][_verifier][_currencyCode];
    }

    function getDepositVerifierData(uint256 _depositId, address _verifier) external view returns (DepositVerifierData memory) {
        return depositVerifierData[_depositId][_verifier];
    }

    function getAccountDeposits(address _account) external view returns (uint256[] memory) {
        return accountDeposits[_account];
    }

    function getAccountIntents(address _account) external view returns (bytes32[] memory) {
        return accountIntents[_account];
    }

    function getDepositDelegate(uint256 _depositId) external view returns (address) {
        return deposits[_depositId].delegate;
    }
 
    /* ============ Internal Functions ============ */

    function _validateDepositAmount(
        uint256 _amount,
        Range memory _intentAmountRange
    ) internal view {
        if (_intentAmountRange.min == 0) revert MinIntentAmountCannotBeZero();
        if (_intentAmountRange.min > _intentAmountRange.max) revert MinIntentAmountMustBeLessThanMax();
        if (_amount < _intentAmountRange.min) revert AmountMustBeGreaterThanMinIntent();
    }

    function _validateIntent(SignalIntentParams memory _intent, Deposit storage _deposit) internal view {

        // Check if account can have multiple intents
        bool canHaveMultipleIntents = relayerRegistry.isWhitelistedRelayer(msg.sender) || allowMultipleIntents;
        if (!canHaveMultipleIntents && accountIntents[msg.sender].length > 0) {
            revert AccountHasUnfulfilledIntent();
        }

        if (_deposit.depositor == address(0)) revert DepositDoesNotExist();
        if (!_deposit.acceptingIntents) revert DepositNotAcceptingIntents();
        if (_intent.amount < _deposit.intentAmountRange.min) revert SignaledAmountMustBeGreaterThanMin();
        if (_intent.amount > _deposit.intentAmountRange.max) revert SignaledAmountMustBeLessThanMax();
        if (_intent.to == address(0)) revert CannotSendToZeroAddress();
        
        if (_intent.referrerFee > MAX_REFERRER_FEE) revert ReferrerFeeExceedsMaximum();
        if (_intent.referrer == address(0)) {
            if (_intent.referrerFee != 0) revert CannotSetReferrerFeeWithoutReferrer();
        }

        if (address(_intent.postIntentHook) != address(0)) {
            if (!postIntentHookRegistry.isWhitelistedHook(address(_intent.postIntentHook))) {
                revert PostIntentHookNotWhitelisted();
            }
        }

        uint256 depositId = _intent.depositId;
        DepositVerifierData memory verifierData = depositVerifierData[depositId][_intent.verifier];
        if (bytes(verifierData.payeeDetails).length == 0) revert PaymentVerifierNotSupported();
        
        uint256 minConversionRate = depositCurrencyMinRate[depositId][_intent.verifier][_intent.fiatCurrency];
        uint256 conversionRate = _intent.conversionRate;
        if (minConversionRate == 0) revert CurrencyNotSupported();
        if (conversionRate < minConversionRate) revert RateMustBeGreaterThanOrEqualToMin();

        address intentGatingService = verifierData.intentGatingService;
        if (intentGatingService != address(0)) {
            if (!_isValidSignature(
                abi.encodePacked(depositId, _intent.amount, _intent.to, _intent.verifier, _intent.fiatCurrency, conversionRate, chainId),
                _intent.gatingServiceSignature,
                intentGatingService
            )) {
                revert InvalidGatingServiceSignature();
            }
        }
    }

    function _calculateIntentHash(
        address _intentOwner,
        address _verifier,
        uint256 _depositId
    )
        internal
        view
        virtual
        returns (bytes32 intentHash)
    {
        // Mod with circom prime field to make sure it fits in a 254-bit field
        uint256 intermediateHash = uint256(keccak256(abi.encodePacked(_intentOwner, _verifier, _depositId, block.timestamp)));
        intentHash = bytes32(intermediateHash % CIRCOM_PRIME_FIELD);
    }

    /**
     * @notice Cycles through all intents currently open on a deposit and sees if any have expired. If they have expired
     * the outstanding amounts are summed and returned alongside the intentHashes
     */
    function _getPrunableIntents(
        uint256 _depositId
    )
        internal
        view
        returns(bytes32[] memory prunableIntents, uint256 reclaimedAmount)
    {
        bytes32[] memory intentHashes = deposits[_depositId].intentHashes;
        prunableIntents = new bytes32[](intentHashes.length);

        for (uint256 i = 0; i < intentHashes.length; ++i) {
            Intent memory intent = intents[intentHashes[i]];
            if (intent.timestamp + intentExpirationPeriod < block.timestamp) {
                prunableIntents[i] = intentHashes[i];
                reclaimedAmount += intent.amount;
            }
        }
    }

    function _pruneIntents(Deposit storage _deposit, bytes32[] memory _intentHashes) internal {
        for (uint256 i = 0; i < _intentHashes.length; ++i) {
            if (_intentHashes[i] != bytes32(0)) {
                _pruneIntent(_deposit, _intentHashes[i]);
            }
        }
    }

    /**
     * @notice Pruning an intent involves deleting its state from the intents mapping, deleting the intent from it's owners intents 
     * array, and deleting the intentHash from the deposit's intentHashes array.
     */
    function _pruneIntent(Deposit storage _deposit, bytes32 _intentHash) internal {
        Intent memory intent = intents[_intentHash];

        accountIntents[intent.owner].removeStorage(_intentHash);
        delete intents[_intentHash];
        _deposit.intentHashes.removeStorage(_intentHash);

        emit IntentPruned(_intentHash, intent.depositId);
    }

    /**
     * @notice Removes a deposit if no outstanding intents AND no remaining deposits. Deleting a deposit deletes it from the
     * deposits mapping and removes tracking it in the user's accountDeposits mapping. Also deletes the verification data for the
     * deposit.
     */
    function _closeDepositIfNecessary(uint256 _depositId, Deposit storage _deposit) internal {
        uint256 openDepositAmount = _deposit.outstandingIntentAmount + _deposit.remainingDeposits;
        if (openDepositAmount == 0) {
            accountDeposits[_deposit.depositor].removeStorage(_depositId);
            _deleteDepositVerifierAndCurrencyData(_depositId);
            emit DepositClosed(_depositId, _deposit.depositor);
            delete deposits[_depositId];
        }
    }

    /**
     * @notice Iterates through all verifiers for a deposit and deletes the corresponding verifier data and currencies.
     */
    function _deleteDepositVerifierAndCurrencyData(uint256 _depositId) internal {
        address[] memory verifiers = depositVerifiers[_depositId];
        for (uint256 i = 0; i < verifiers.length; i++) {
            address verifier = verifiers[i];
            delete depositVerifierData[_depositId][verifier];
            bytes32[] memory currencies = depositCurrencies[_depositId][verifier];
            for (uint256 j = 0; j < currencies.length; j++) {
                delete depositCurrencyMinRate[_depositId][verifier][currencies[j]];
            }
        }
    }

    /**
     * @notice Handles fee calculations and transfers, then executes any post-intent hooks
     */
    function _transferFundsAndExecuteAction(
        IERC20 _token, 
        bytes32 _intentHash, 
        Intent memory _intent, 
        uint256 _releaseAmount,
        bytes memory _fulfillIntentData,
        bool _isManualRelease
    ) internal {
        
        uint256 protocolFeeAmount;
        uint256 referrerFeeAmount; 

        // Calculate protocol fee (taken from taker) - based on release amount
        if (protocolFeeRecipient != address(0) && protocolFee > 0) {
            protocolFeeAmount = (_releaseAmount * protocolFee) / PRECISE_UNIT;
        }
        
        // Calculate referrer fee (taken from taker) - based on release amount
        if (_intent.referrer != address(0) && _intent.referrerFee > 0) {
            referrerFeeAmount = (_releaseAmount * _intent.referrerFee) / PRECISE_UNIT;
        }
        
        // Total fees taken from taker
        uint256 totalFees = protocolFeeAmount + referrerFeeAmount;
        
        // Net amount the taker receives after fees
        uint256 netAmount = _releaseAmount - totalFees;
        
        // Transfer protocol fee to recipient
        if (protocolFeeAmount > 0) {
            if (!_token.transfer(protocolFeeRecipient, protocolFeeAmount)) revert ProtocolFeeTransferFailed();
        }
        
        // Transfer referrer fee
        if (referrerFeeAmount > 0) {
            if (!_token.transfer(_intent.referrer, referrerFeeAmount)) revert ReferrerFeeTransferFailed();
        }

        // If there's a post-intent hook, handle it
        if (address(_intent.postIntentHook) != address(0)) {
            _token.approve(address(_intent.postIntentHook), netAmount);
            _intent.postIntentHook.execute(_intent, netAmount, _fulfillIntentData);
        } else {
            // Otherwise transfer directly to the intent recipient
            if (!_token.transfer(_intent.to, netAmount)) revert TransferToRecipientFailed();
        }

        emit IntentFulfilled(
            _intentHash, 
            _intent.depositId, 
            _intent.paymentVerifier, 
            _intent.owner, 
            _intent.to, 
            netAmount, 
            protocolFeeAmount,
            referrerFeeAmount,
            _isManualRelease
        );
    }

    function _isValidSignature(
        bytes memory _message,
        bytes memory _signature,
        address _signer
    )
        internal
        view
        returns(bool)
    {
        bytes32 verifierPayload = keccak256(_message).toEthSignedMessageHash();

        return _signer.isValidSignatureNow(verifierPayload, _signature);
    }

    function _addVerifiersToDeposit(
        uint256 _depositId,
        address[] calldata _verifiers,
        DepositVerifierData[] calldata _verifierData,
        Currency[][] calldata _currencies
    ) internal {

        // Check that the length of the verifiers, depositVerifierData, and currencies arrays are the same
        if (_verifiers.length != _verifierData.length) revert VerifiersAndDepositVerifierDataLengthMismatch();
        if (_verifiers.length != _currencies.length) revert VerifiersAndCurrenciesLengthMismatch();

        for (uint256 i = 0; i < _verifiers.length; i++) {
            address verifier = _verifiers[i];
            
            if (verifier == address(0)) revert VerifierCannotBeZeroAddress();
            if (!(paymentVerifierRegistry.isWhitelistedVerifier(verifier) || 
                paymentVerifierRegistry.isAcceptingAllVerifiers())) {
                revert PaymentVerifierNotWhitelisted();
            }
            if (bytes(_verifierData[i].payeeDetails).length == 0) revert PayeeDetailsCannotBeEmpty();
            if (bytes(depositVerifierData[_depositId][verifier].payeeDetails).length != 0) revert VerifierDataAlreadyExists();

            depositVerifierData[_depositId][verifier] = _verifierData[i];
            depositVerifiers[_depositId].push(verifier);

            bytes32 payeeDetailsHash = keccak256(abi.encodePacked(_verifierData[i].payeeDetails));
            emit DepositVerifierAdded(_depositId, verifier, payeeDetailsHash, _verifierData[i].intentGatingService);

            for (uint256 j = 0; j < _currencies[i].length; j++) {
                Currency memory currency = _currencies[i][j];

                _addCurrencyToDeposit(
                    _depositId, 
                    verifier, 
                    currency.code, 
                    currency.minConversionRate
                );
            }
        }
    }

    function _addCurrencyToDeposit(
        uint256 _depositId,
        address _verifier,
        bytes32 _currencyCode,
        uint256 _minConversionRate
    ) internal {
        if (!IBasePaymentVerifier(_verifier).isCurrency(_currencyCode)) {
            revert CurrencyNotSupportedByVerifier();
        }
        if (_minConversionRate == 0) revert ConversionRateMustBeGreaterThanZero();
        if (depositCurrencyMinRate[_depositId][_verifier][_currencyCode] != 0) {
            revert CurrencyRateAlreadyExists();
        }
        depositCurrencyMinRate[_depositId][_verifier][_currencyCode] = _minConversionRate;
        depositCurrencies[_depositId][_verifier].push(_currencyCode);

        emit DepositCurrencyAdded(_depositId, _verifier, _currencyCode, _minConversionRate);
    }
}
