//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import { AddressArrayUtils } from "./external/AddressArrayUtils.sol";
import { Bytes32ArrayUtils } from "./external/Bytes32ArrayUtils.sol";

import { IOrchestrator } from "./interfaces/IOrchestrator.sol";
import { IEscrow } from "./interfaces/IEscrow.sol";
import { IEscrowRegistry } from "./interfaces/IEscrowRegistry.sol";
import { IPostIntentHook } from "./interfaces/IPostIntentHook.sol";
import { IBasePaymentVerifier } from "./verifiers/interfaces/IBasePaymentVerifier.sol";
import { IPaymentVerifier } from "./verifiers/interfaces/IPaymentVerifier.sol";
import { IPaymentVerifierRegistry } from "./interfaces/IPaymentVerifierRegistry.sol";
import { IPostIntentHookRegistry } from "./interfaces/IPostIntentHookRegistry.sol";
import { IRelayerRegistry } from "./interfaces/IRelayerRegistry.sol";



// Todo: Update how we calculate intent hash to allow multiple intents per account (for relayer accounts).
contract Orchestrator is Ownable, Pausable, IOrchestrator {

    using AddressArrayUtils for address[];
    using Bytes32ArrayUtils for bytes32[];
    using ECDSA for bytes32;
    using SignatureChecker for address;


    /* ============ Constants ============ */
    uint256 internal constant PRECISE_UNIT = 1e18;
    uint256 constant CIRCOM_PRIME_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant MAX_REFERRER_FEE = 5e16;      // 5% max referrer fee
    uint256 constant MAX_PROTOCOL_FEE = 5e16;      // 5% max protocol fee

    /* ============ State Variables ============ */

    uint256 immutable public chainId;              // chainId of the chain the orchestrator is deployed on

    mapping(bytes32 => Intent) internal intents;                       // Mapping of intentHashes to intent structs
    mapping(address => bytes32[]) internal accountIntents;             // Mapping of address to array of intentHashes

    // Contract references
    IEscrowRegistry public escrowRegistry;                              // Registry of escrow contracts
    IPaymentVerifierRegistry public  paymentVerifierRegistry;          // Registry of payment verifiers
    IPostIntentHookRegistry public postIntentHookRegistry;             // Registry of post intent hooks
    IRelayerRegistry public relayerRegistry;                           // Registry of relayers

    // Protocol fee configuration
    uint256 public protocolFee;                                     // Protocol fee taken from taker (in preciseUnits, 1e16 = 1%)
    address public protocolFeeRecipient;                            // Address that receives protocol fees

    bool public allowMultipleIntents;                               // Whether to allow multiple intents per account
    uint256 public intentExpirationPeriod;                          // Time period after which an intent can be pruned from the system

    /* ============ Modifiers ============ */

    modifier onlyWhitelistedEscrow() {
        require(
            escrowRegistry.isWhitelistedEscrow(msg.sender) || escrowRegistry.isAcceptingAllEscrows(),
            "Only whitelisted escrow can call this function"
        );
        _;
    }

    /* ============ Constructor ============ */
    constructor(
        address _owner,
        uint256 _chainId,
        uint256 _intentExpirationPeriod,
        address _escrowRegistry,
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
        escrowRegistry = IEscrowRegistry(_escrowRegistry);
        paymentVerifierRegistry = IPaymentVerifierRegistry(_paymentVerifierRegistry);
        postIntentHookRegistry = IPostIntentHookRegistry(_postIntentHookRegistry);
        relayerRegistry = IRelayerRegistry(_relayerRegistry);
        protocolFee = _protocolFee;
        protocolFeeRecipient = _protocolFeeRecipient;

        transferOwnership(_owner);
    }

    /* ============ External Functions ============ */

    /**
     * @notice Signals intent to pay the depositor defined in the _depositId the _amount * deposit conversionRate off-chain
     * in order to unlock _amount of funds on-chain. Caller must provide a signature from the deposit's gating service to prove
     * their eligibility to take liquidity. If there are prunable intents then they will be deleted from the deposit to be able 
     * to maintain state hygiene. Locks liquidity for the corresponding deposit on the escrow contract.
     *
     * @param _params                   Struct containing all the intent parameters
     */
    function signalIntent(SignalIntentParams calldata _params)
        external
        whenNotPaused
    {
        _validateSignalIntent(_params);

        bytes32 intentHash = _calculateIntentHash(msg.sender, _params.escrow, _params.verifier, _params.depositId);

        // Lock liquidity in escrow with expiry time
        uint256 expiryTime = block.timestamp + intentExpirationPeriod;
        IEscrow(_params.escrow).lockFunds(_params.depositId, intentHash, _params.amount, expiryTime);

        intents[intentHash] = Intent({
            owner: msg.sender,
            to: _params.to,
            escrow: _params.escrow,
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

        emit IntentSignaled(
            intentHash, 
            _params.escrow,
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
     * @notice Only callable by the originator of the intent. Cancels an outstanding intent. Unlocks liquidity
     * for the corresponding deposit on the escrow contract.
     *
     * @param _intentHash    Hash of intent being cancelled
     */
    function cancelIntent(bytes32 _intentHash) external {
        Intent memory intent = intents[_intentHash];
        
        if (intent.timestamp == 0) revert IntentDoesNotExist();
        if (intent.owner != msg.sender) revert SenderMustBeIntentOwner();

        _pruneIntent(_intentHash);

        IEscrow(intent.escrow).unlockFunds(intent.depositId, _intentHash);
    }

    /**
     * @notice Anyone can submit a fulfill intent transaction, even if caller isn't the intent owner. Upon submission the
     * offchain payment proof is verified, payment details are validated, intent is removed, and escrow state is updated. 
     * Deposit token is transferred to the intent.to address.
     *
     * @param _paymentProof         Payment proof. Can be Groth16 Proof, TLSNotary proof, TLSProxy proof, attestation etc.
     * @param _intentHash           Identifier of intent being fulfilled
     * @param _data                 Additional data for hooks
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
        if (intent.paymentVerifier == address(0)) revert IntentDoesNotExist();
        
        // Get deposit and verifier data from escrow contract
        IEscrow.Deposit memory deposit = IEscrow(intent.escrow).getDeposit(intent.depositId);
        IEscrow.DepositVerifierData memory verifierData = IEscrow(intent.escrow).getDepositVerifierData(
            intent.depositId, intent.paymentVerifier
        );
        
        (bool success, bytes32 intentHash, uint256 releaseAmount) = IPaymentVerifier(intent.paymentVerifier).verifyPayment(
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

        _pruneIntent(_intentHash);

        IEscrow(intent.escrow).unlockAndTransferFunds(intent.depositId, _intentHash, releaseAmount, address(this));

        _transferFundsAndExecuteAction(deposit.token, _intentHash, intent, releaseAmount, _data, false);
    }

    /**
     * @notice Allows depositor to release funds to the payer in case of a failed fulfill intent or because of some other arrangement
     * between the two parties. Upon submission we check to make sure the msg.sender is the depositor, the intent is removed, and 
     * escrow state is updated. Deposit token is transferred to the payer.
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

        IEscrow.Deposit memory deposit = IEscrow(intent.escrow).getDeposit(intent.depositId);
        if (deposit.depositor != msg.sender) revert CallerMustBeDepositor();

        _pruneIntent(_intentHash);

        IEscrow(intent.escrow).unlockAndTransferFunds(intent.depositId, _intentHash, _releaseAmount, address(this));

        _transferFundsAndExecuteAction(deposit.token, _intentHash, intent, _releaseAmount, _releaseData, true);
    }

    /* ============ Escrow Functions ============ */

    /**
     * @notice Only the escrow contract can call this function. Called by escrow to prune specific expired intents.
     * Escrow leads the cleanup process.
     * 
     * @param _intents   Array of intent hashes to prune
     */
    function pruneIntents(bytes32[] calldata _intents) external onlyWhitelistedEscrow {
        for (uint256 i = 0; i < _intents.length; i++) {
            bytes32 intentHash = _intents[i];
            if (intentHash != bytes32(0)) {
                Intent memory intent = intents[intentHash];
                if (intent.timestamp != 0) {    // Only prune if intent exists
                    _pruneIntent(intentHash);
                }
            }
        }
    }

    /* ============ Governance Functions ============ */

    /**
     * @notice GOVERNANCE ONLY: Updates the escrow registry address.
     *
     * @param _escrowRegistry   New escrow registry address
     */
    function setEscrowRegistry(address _escrowRegistry) external onlyOwner {
        if (_escrowRegistry == address(0)) revert EscrowRegistryCannotBeZeroAddress();
        
        escrowRegistry = IEscrowRegistry(_escrowRegistry);
        emit EscrowRegistryUpdated(_escrowRegistry);
    }

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

    /**
     * @notice GOVERNANCE ONLY: Pauses intent creation and intent fulfillment functionality for the orchestrator.
     */
    function pauseOrchestrator() external onlyOwner {
        _pause();
    }

    /**
     * @notice GOVERNANCE ONLY: Restarts paused functionality for the orchestrator.
     */
    function unpauseOrchestrator() external onlyOwner {
        _unpause();
    }

    /* ============ External View Functions ============ */

    function getIntent(bytes32 _intentHash) external view returns (Intent memory) {
        return intents[_intentHash];
    }

    function getAccountIntents(address _account) external view returns (bytes32[] memory) {
        return accountIntents[_account];
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Validates an intent before it is signaled.
     */
    function _validateSignalIntent(SignalIntentParams memory _intent) internal view {
        // Check if account can have multiple intents
        bool canHaveMultipleIntents = relayerRegistry.isWhitelistedRelayer(msg.sender) || allowMultipleIntents;
        if (!canHaveMultipleIntents && accountIntents[msg.sender].length > 0) {
            revert AccountHasUnfulfilledIntent();
        }

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

        // Validate escrow is whitelisted
        if (!escrowRegistry.isWhitelistedEscrow(_intent.escrow) && !escrowRegistry.isAcceptingAllEscrows()) {
            revert EscrowNotWhitelisted();
        }

        uint256 depositId = _intent.depositId;
        IEscrow escrow = IEscrow(_intent.escrow);
        IEscrow.DepositVerifierData memory verifierData = escrow.getDepositVerifierData(depositId, _intent.verifier);
        if (bytes(verifierData.payeeDetails).length == 0) revert PaymentVerifierNotSupported();
        
        uint256 minConversionRate = escrow.getDepositCurrencyMinRate(depositId, _intent.verifier, _intent.fiatCurrency);
        uint256 conversionRate = _intent.conversionRate;
        if (minConversionRate == 0) revert CurrencyNotSupported();
        if (conversionRate < minConversionRate) revert RateMustBeGreaterThanOrEqualToMin();

        address intentGatingService = verifierData.intentGatingService;
        if (intentGatingService != address(0)) {
            if (!_isValidSignature(
                abi.encodePacked(_intent.escrow, depositId, _intent.amount, _intent.to, _intent.verifier, _intent.fiatCurrency, conversionRate, chainId),
                _intent.gatingServiceSignature,
                intentGatingService
            )) {
                revert InvalidGatingServiceSignature();
            }
        }
    }

    /**
     * @notice Calculates a unique hash for an intent using the intent params.
     */
    function _calculateIntentHash(
        address _intentOwner,
        address _escrow,
        address _verifier,
        uint256 _depositId
    )
        internal
        view
        returns (bytes32 intentHash)
    {
        // Mod with circom prime field to make sure it fits in a 254-bit field
        uint256 intermediateHash = uint256(keccak256(abi.encodePacked(_intentOwner, _escrow, _verifier, _depositId, block.timestamp)));
        intentHash = bytes32(intermediateHash % CIRCOM_PRIME_FIELD);
    }

    /**
     * @notice Deletes an intent from storage mappings.
     */
    function _pruneIntent(bytes32 _intentHash) internal {
        Intent memory intent = intents[_intentHash];

        accountIntents[intent.owner].removeStorage(_intentHash);
        delete intents[_intentHash];

        emit IntentPruned(_intentHash, intent.escrow, intent.depositId);
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

        // If there's a post-intent hook, handle it; skip if manual release
        address fundsTransferredTo = _intent.to;
        if (address(_intent.postIntentHook) != address(0) && !_isManualRelease) {
            _token.approve(address(_intent.postIntentHook), netAmount);
            _intent.postIntentHook.execute(_intent, netAmount, _fulfillIntentData);

            fundsTransferredTo = address(_intent.postIntentHook);
        } else {
            // Otherwise transfer directly to the intent recipient
            if (!_token.transfer(_intent.to, netAmount)) revert TransferToRecipientFailed();
        }

        emit IntentFulfilled(
            _intentHash, 
            _intent.escrow,
            _intent.depositId, 
            _intent.paymentVerifier, 
            _intent.owner, 
            fundsTransferredTo, 
            netAmount, 
            protocolFeeAmount,
            referrerFeeAmount,
            _isManualRelease
        );
    }

    /**
     * @notice Checks if a signature is valid.
     */
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
}