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
import { IOrchestrator } from "./interfaces/IOrchestrator.sol";  // NEW: Added for orchestrator calls
import { IPostIntentHook } from "./interfaces/IPostIntentHook.sol";
import { IBasePaymentVerifier } from "./verifiers/interfaces/IBasePaymentVerifier.sol";
import { IPaymentVerifier } from "./verifiers/interfaces/IPaymentVerifier.sol";
import { IPaymentVerifierRegistry } from "./interfaces/IPaymentVerifierRegistry.sol";
import { IPostIntentHookRegistry } from "./interfaces/IPostIntentHookRegistry.sol";
import { IRelayerRegistry } from "./interfaces/IRelayerRegistry.sol";

pragma solidity ^0.8.18;

contract Escrow is Ownable, Pausable, IEscrow {

    using AddressArrayUtils for address[];
    using Bytes32ArrayUtils for bytes32[];
    using ECDSA for bytes32;
    using SignatureChecker for address;
    using StringArrayUtils for string[];
    using Uint256ArrayUtils for uint256[];

    /* ============ Constants ============ */
    uint256 internal constant PRECISE_UNIT = 1e18;
    
    /* ============ State Variables ============ */

    address public orchestrator;                                     // Address of the orchestrator contract
    IPaymentVerifierRegistry public paymentVerifierRegistry;         // Address of the payment verifier registry contract
    uint256 immutable public chainId;                                // chainId of the chain the escrow is deployed on

    mapping(address => uint256[]) internal accountDeposits;          // Mapping of address to depositIds

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

    mapping(uint256 => Deposit) internal deposits;                          // Mapping of depositIds to deposit structs
    mapping(uint256 => bytes32[]) internal depositIntentHashes;             // Mapping of depositId to array of intentHashes
    mapping(uint256 => mapping(bytes32 => Intent)) internal depositIntents; // Mapping of depositId to intentHash to intent

    uint256 public depositCounter;                                  // Counter for depositIds

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

    /**
     * @notice Modifier to restrict access to orchestrator-only functions
     */
    modifier onlyOrchestrator() {
        if (msg.sender != orchestrator) revert OnlyOrchestratorCanCallThis();
        _;
    }

    /* ============ Constructor ============ */
    constructor(
        address _owner,
        uint256 _chainId,
        address _paymentVerifierRegistry
    )
        Ownable()
    {
        chainId = _chainId;
        paymentVerifierRegistry = IPaymentVerifierRegistry(_paymentVerifierRegistry);

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
        if (_intentAmountRange.min == 0) revert MinIntentAmountCannotBeZero();
        if (_intentAmountRange.min > _intentAmountRange.max) revert MinIntentAmountMustBeLessThanMax();
        if (_amount < _intentAmountRange.min) revert AmountMustBeGreaterThanMinIntent();

        uint256 depositId = depositCounter++;

        accountDeposits[msg.sender].push(depositId);

        deposits[depositId] = Deposit({
            depositor: msg.sender,
            delegate: _delegate,
            token: _token,
            amount: _amount,
            intentAmountRange: _intentAmountRange,
            acceptingIntents: true,
            remainingDeposits: _amount,
            outstandingIntentAmount: 0
        });

        emit DepositReceived(depositId, msg.sender, _token, _amount, _intentAmountRange, _delegate);

        _addVerifiersToDeposit(depositId, _verifiers, _verifierData, _currencies);

        _token.transferFrom(msg.sender, address(this), _amount);
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
        Deposit storage deposit = deposits[_depositId];
        if (deposit.depositor != msg.sender) revert CallerMustBeDepositor();
        if (!deposit.acceptingIntents) revert DepositNotAcceptingIntents();
        
        deposit.amount += _amount;
        deposit.remainingDeposits += _amount;
        
        emit DepositFundsAdded(_depositId, msg.sender, _amount);
        
        deposit.token.transferFrom(msg.sender, address(this), _amount);
    }

    // TODO: Is there an opportunity to combine the two functions below?

    /**
     * @notice Removes funds from an existing deposit. Only the depositor can remove funds.
     * Can remove funds from the remaining deposits and prunable intents.
     *
     * @param _depositId    The deposit ID to remove funds from
     * @param _amount       The amount of tokens to remove
     */
    function removeFundsFromDeposit(uint256 _depositId, uint256 _amount)
        external
    {
        Deposit storage deposit = deposits[_depositId];
        if (deposit.depositor != msg.sender) revert CallerMustBeDepositor();
        if (!deposit.acceptingIntents) revert DepositNotAcceptingIntents();
        
        if (deposit.remainingDeposits < _amount) {
            _pruneExpiredIntents(deposit, _depositId, _amount);
        }
        
        deposit.amount -= _amount;
        deposit.remainingDeposits -= _amount;
        
        emit DepositWithdrawn(_depositId, msg.sender, _amount, true);
        
        IERC20 token = deposit.token;
        _closeDepositIfNecessary(_depositId, deposit);
        
        token.transfer(msg.sender, _amount);
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
            bytes32[] memory expiredIntents,
            uint256 reclaimableAmount
        ) = _getExpiredIntents(_depositId);

        _pruneIntents(_depositId, expiredIntents);

        uint256 returnAmount = deposit.remainingDeposits + reclaimableAmount;
        
        deposit.outstandingIntentAmount -= reclaimableAmount;

        emit DepositWithdrawn(_depositId, deposit.depositor, returnAmount, false);
        
        delete deposit.remainingDeposits;
        delete deposit.acceptingIntents;
        IERC20 token = deposit.token;
        _closeDepositIfNecessary(_depositId, deposit);
        
        token.transfer(msg.sender, returnAmount);
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

    // TODO: Should we store verifier data on the intent?
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

    // Todo: Should we update this function to support multiple currencies per verifier?

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
        if (deposit.acceptingIntents == _acceptingIntents) revert DepositAlreadyInState();
        // Doesn't reclaim liquidity for gas savings
        if (deposit.remainingDeposits == 0) revert DepositHasNoLiquidity();
        
        deposit.acceptingIntents = _acceptingIntents;
        emit DepositAcceptingIntentsUpdated(_depositId, _acceptingIntents);
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
     * @param _expiryTime When this intent expires (block.timestamp + intentExpirationPeriod)
     * @param _intentHash The intent hash this intent corresponds to
     */
    function lockFunds(
        uint256 _depositId, 
        bytes32 _intentHash,
        uint256 _amount, 
        uint256 _expiryTime
    ) 
        external 
        onlyOrchestrator 
    {
        Deposit storage deposit = deposits[_depositId];
        
        if (deposit.depositor == address(0)) revert DepositDoesNotExist();
        if (!deposit.acceptingIntents) revert DepositNotAcceptingIntents();
        if (_amount < deposit.intentAmountRange.min) revert AmountMustBeGreaterThanMinIntent();
        if (_amount > deposit.intentAmountRange.max) revert AmountMustBeLessThanMaxIntent();
        
        // Check if we need to reclaim expired liquidity first
        if (deposit.remainingDeposits < _amount) {
            _pruneExpiredIntents(deposit, _depositId, _amount);
        }
        
        // Update deposit state
        deposit.remainingDeposits -= _amount;
        deposit.outstandingIntentAmount += _amount;
        
        depositIntentHashes[_depositId].push(_intentHash);
        depositIntents[_depositId][_intentHash] = Intent({
            intentHash: _intentHash,
            amount: _amount,
            expiryTime: _expiryTime
        });

        emit FundsLocked(_depositId, _intentHash, _amount, _expiryTime);
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
        Deposit storage deposit = deposits[_depositId];
        Intent memory intent = depositIntents[_depositId][_intentHash];

        if (deposit.depositor == address(0)) revert DepositDoesNotExist();
        if (intent.intentHash == bytes32(0)) revert IntentDoesNotExist();

        // Update deposit state
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
        Deposit storage deposit = deposits[_depositId];
        Intent memory intent = depositIntents[_depositId][_intentHash];
        
        if (deposit.depositor == address(0)) revert DepositDoesNotExist();
        if (intent.intentHash == bytes32(0)) revert IntentDoesNotExist();
        if (_transferAmount == 0) revert TransferAmountCannotBeZero();
        if (_transferAmount > intent.amount) revert TransferAmountCannotBeGreaterThanIntentAmount();
        
        // Update deposit state
        deposit.outstandingIntentAmount -= intent.amount;
        if (_transferAmount < intent.amount) {
            // Return unused funds to remaining deposits (partial release)
            deposit.remainingDeposits += (intent.amount - _transferAmount);
        }

        _pruneIntent(_depositId, _intentHash);
        
        IERC20 token = deposit.token;
        _closeDepositIfNecessary(_depositId, deposit);
        
        token.transfer(_to, _transferAmount);

        emit FundsUnlockedAndTransferred(_depositId, _intentHash, intent.amount, _transferAmount, _to);
    }

    /* ============ Governance Functions ============ */
    
    /**
     * @notice NEW: Sets the orchestrator contract address. Only callable by owner.
     *
     * @param _orchestrator The orchestrator contract address
     */
    function setOrchestrator(address _orchestrator) external onlyOwner {
        if (_orchestrator == address(0)) revert OrchestratorCannotBeZeroAddress();
        
        orchestrator = _orchestrator;
        emit OrchestratorUpdated(_orchestrator);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the payment verifier registry address.
     *
     * @param _paymentVerifierRegistry   New payment verifier registry address
     */
    function setPaymentVerifierRegistry(address _paymentVerifierRegistry) external onlyOwner {
        if (_paymentVerifierRegistry == address(0)) revert PaymentVerifierRegistryCannotBeZeroAddress();
        
        paymentVerifierRegistry = IPaymentVerifierRegistry(_paymentVerifierRegistry);
        emit PaymentVerifierRegistryUpdated(_paymentVerifierRegistry);
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
        
        if (availableAmount < _minRequiredAmount) revert NotEnoughLiquidity();
        
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
        IOrchestrator(orchestrator).pruneIntents(_intents);

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
     * @notice Adds list of verifiers and corresponding verification data and currencies to a deposit.
     */
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

    /**
     * @notice Adds a currency to a deposit.
     */
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
