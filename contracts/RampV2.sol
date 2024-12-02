//SPDX-License-Identifier: MIT

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import { Bytes32ArrayUtils } from "./external/Bytes32ArrayUtils.sol";
import { Uint256ArrayUtils } from "./external/Uint256ArrayUtils.sol";
import { AddressArrayUtils } from "./external/AddressArrayUtils.sol";

import { IPaymentVerifier } from "./verifiers/interfaces/IPaymentVerifier.sol";

import "hardhat/console.sol";

pragma solidity ^0.8.18;

// todo: add circuit breakers!
// todo: add ability to add payment verifiers to existing deposits? too much?

contract RampV2 is Ownable {

    using Bytes32ArrayUtils for bytes32[];
    using Uint256ArrayUtils for uint256[];
    using AddressArrayUtils for address[];
    
    using SignatureChecker for address;
    using ECDSA for bytes32;

    /* ============ Events ============ */
    event DepositReceived(
        uint256 indexed depositId,
        address indexed depositor,
        address[] indexed verifier,
        IERC20 token,
        uint256 amount
    );

    event IntentSignaled(
        bytes32 indexed intentHash,
        uint256 indexed depositId,
        address indexed verifier,
        address payer,
        address to,
        uint256 amount,
        uint256 timestamp
    );

    event IntentPruned(
        bytes32 indexed intentHash,
        uint256 indexed depositId
    );

    event IntentFulfilled(
        bytes32 indexed intentHash,
        uint256 indexed depositId,
        address indexed payer,
        address verifier,
        address to,
        uint256 amount,
        uint256 sustainabilityFee,
        uint256 verifierFee
    );

    // event FundsReleasedToPayer(
    //     bytes32 indexed intentHash,
    //     uint256 indexed depositId,
    //     address indexed payer,
    //     address verifier,
    //     address to,
    //     uint256 amount,
    //     uint256 sustainabilityFee,
    //     uint256 verifierFee
    // );

    event DepositWithdrawn(
        uint256 indexed depositId,
        address indexed depositor,
        uint256 amount
    );

    event DepositClosed(uint256 depositId, address depositor);
    event MinDepositAmountSet(uint256 minDepositAmount);
    
    event SustainabilityFeeUpdated(uint256 fee);
    event SustainabilityFeeRecipientUpdated(address feeRecipient);
    event AcceptAllPaymentVerifiersUpdated(bool acceptAllPaymentVerifiers);
    event IntentExpirationPeriodSet(uint256 intentExpirationPeriod);
    
    event PaymentVerifierAdded(address verifier, uint256 feeShare);
    event PaymentVerifierFeeShareUpdated(address verifier, uint256 feeShare);
    event PaymentVerifierRemoved(address verifier);

    /* ============ Structs ============ */

    struct PaymentVerificationData {
        address intentGatingService;                // Public key of gating service that will be used to verify intents
        uint256 conversionRate;                     // Conversion rate of deposit token to fiat currency
        bytes32 payeeDetailsHash;                   // Hash of payee details stored offchain
        bytes data;                                 // Verification Data: Additional data used for payment verification; Can hold attester address
                                                    // in case of TLS proofs, domain key hash in case of zkEmail proofs, currency code etc.
    }

    struct Range {
        uint256 min;
        uint256 max;
    }

    struct Deposit {
        address depositor;                          // Address of depositor
        IERC20 token;                               // Address of deposit token
        uint256 amount;                             // Amount of deposit token
        Range intentAmountRange;                    // Range of take amount per intent
        address[] verifiers;                        // Array of verifiers supported for the deposit
        bool acceptingIntents;                      // State: True if the deposit is accepting intents, False otherwise
        uint256 remainingDeposits;                  // State: Amount of remaining deposited liquidity
        uint256 outstandingIntentAmount;            // State: Amount of outstanding intents (may include expired intents)
        bytes32[] intentHashes;                     // State: Array of hashes of all open intents (may include some expired if not pruned)
    }

    struct Intent {
        address owner;
        address to;
        uint256 depositId;
        uint256 amount;
        uint256 timestamp;
        address paymentVerifier;
    }

    struct VerifierDataView {
        address verifier;
        PaymentVerificationData verificationData;
    }

    struct DepositView {
        uint256 depositId;
        Deposit deposit;
        uint256 availableLiquidity;
        VerifierDataView[] verifiers;
    }

    struct IntentView {
        bytes32 intentHash;                 // Intent hash
        Intent intent;                      // Intent struct
    }

    /* ============ Constants ============ */
    uint256 internal constant PRECISE_UNIT = 1e18;
    uint256 constant CIRCOM_PRIME_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant MAX_SUSTAINABILITY_FEE = 5e16;   // 5% max sustainability fee
    
    /* ============ State Variables ============ */

    mapping(address => uint256[]) public accountDeposits;
    mapping(address => bytes32[]) public accountIntents;
    mapping(uint256 => mapping(address => PaymentVerificationData)) public depositVerifierData;

    mapping(uint256 => Deposit) public deposits;                    // Mapping of depositIds to deposit structs
    mapping(bytes32 => Intent) public intents;                      // Mapping of intentHashes to intent structs

    // Governance controlled
    bool public acceptAllPaymentVerifiers;
    mapping(address => bool) public whitelistedPaymentVerifiers;          // Mapping of payment verifier addresses to boolean indicating if they are whitelisted
    mapping(address => uint256) public paymentVerifierFeeShare;           // Mapping of payment verifier addresses to their fee share

    uint256 public minDepositAmount;                                // Minimum amount of USDC that can be deposited
    uint256 public intentExpirationPeriod;          // Time period after which an intent can be pruned from the system
    uint256 public sustainabilityFee;                               // Fee charged to on-rampers in preciseUnits (1e16 = 1%)
    address public sustainabilityFeeRecipient;                      // Address that receives the sustainability fee

    uint256 public depositCounter;                                  // Counter for depositIds


    /* ============ Constructor ============ */
    constructor(
        address _owner,
        uint256 _minDepositAmount,
        uint256 _intentExpirationPeriod,
        uint256 _sustainabilityFee,
        address _sustainabilityFeeRecipient
    )
        Ownable()
    {
        minDepositAmount = _minDepositAmount;
        intentExpirationPeriod = _intentExpirationPeriod;
        sustainabilityFee = _sustainabilityFee;
        sustainabilityFeeRecipient = _sustainabilityFeeRecipient;

        transferOwnership(_owner);
    }

    /* ============ External Functions ============ */

    /**
     * @notice Generates a deposit entry for off-rampers that can then be fulfilled by an on-ramper. This function will not add to
     * previous deposits. Every deposit has it's own unique identifier. User must approve the contract to transfer the deposit amount
     * of deposit token. Every deposit specifies verifiers and verification data for each verifier.
     *
     * @param _token                     The token to be deposited
     * @param _amount                    The amount of token to deposit
     * @param _intentAmountRange         The max and min take amount for each intent
     * @param _verifier                  The payment verifiers for the deposit
     * @param _verificationData          The payment verification data for the deposit
     */
    function createDeposit(
        IERC20 _token,
        uint256 _amount,
        Range calldata _intentAmountRange,
        address[] calldata _verifier,
        PaymentVerificationData[] calldata _verificationData
    )
        external
    {
        _validateCreateDeposit(_amount, _verifier, _verificationData);

        uint256 depositId = depositCounter++;

        accountDeposits[msg.sender].push(depositId);

        Deposit storage deposit = deposits[depositId];
        
        deposits[depositId] = Deposit({
            depositor: msg.sender,
            token: _token,
            amount: _amount,
            intentAmountRange: _intentAmountRange,
            acceptingIntents: true,
            intentHashes: new bytes32[](0),
            remainingDeposits: _amount,
            outstandingIntentAmount: 0,
            verifiers: new address[](0)
        });

        for (uint256 i = 0; i < _verifier.length; i++) {
            require(
                depositVerifierData[depositId][_verifier[i]].payeeDetailsHash == bytes32(0),
                "Verifier already exists"
            );
            deposit.verifiers.push(_verifier[i]);
            depositVerifierData[depositId][_verifier[i]] = _verificationData[i];
        }

        _token.transferFrom(msg.sender, address(this), _amount);

        emit DepositReceived(depositId, msg.sender, _verifier, _token, _amount);
    }

    /**
     * @notice Signals intent to pay the depositor defined in the _depositId the _amount * deposit conversionRate off-chain
     * in order to unlock _amount of funds on-chain. Caller must provide a signature from the deposit's gating service to prove
     * their eligibility to take liquidity. If there are prunable intents then they will be deleted from the deposit to be able 
     * to maintain state hygiene.
     *
     * @param _depositId                The ID of the deposit the taker intends to use for 
     * @param _amount                   The amount of USDC the user wants to take
     * @param _to                       Address to forward funds to (can be same as owner)
     * @param _verifier                 The payment verifier for the intent (example: VenmoVerifier, RevolutVerifier, etc.)
     * @param _gatingServiceSignature   The signature from the deposit's gating service on intent parameters
     */
    function signalIntent(
        uint256 _depositId,
        uint256 _amount,
        address _to,
        address _verifier,
        bytes calldata _gatingServiceSignature
    )
        external
    {
        Deposit storage deposit = deposits[_depositId];

        _validateIntent(_depositId, deposit, _amount, _to, _verifier, _gatingServiceSignature);

        bytes32 intentHash = _calculateIntentHash(msg.sender, _verifier, _depositId);

        if (deposit.remainingDeposits < _amount) {
            (
                bytes32[] memory prunableIntents,
                uint256 reclaimableAmount
            ) = _getPrunableIntents(_depositId);

            require(deposit.remainingDeposits + reclaimableAmount >= _amount, "Not enough liquidity");

            _pruneIntents(deposit, prunableIntents);
            deposit.remainingDeposits += reclaimableAmount;
            deposit.outstandingIntentAmount -= reclaimableAmount;
        }

        intents[intentHash] = Intent({
            owner: msg.sender,
            paymentVerifier: _verifier,
            to: _to,
            depositId: _depositId,
            amount: _amount,
            timestamp: block.timestamp
        });

        accountIntents[msg.sender].push(intentHash);

        deposit.remainingDeposits -= _amount;
        deposit.outstandingIntentAmount += _amount;
        deposit.intentHashes.push(intentHash);

        emit IntentSignaled(intentHash, _depositId, _verifier, msg.sender, _to, _amount, block.timestamp);
    }

    /**
     * @notice Only callable by the originator of the intent. Cancels an outstanding intent. Deposit state is 
     * updated to reflect the cancelled intent.
     *
     * @param _intentHash    Hash of intent being cancelled
     */
    function cancelIntent(bytes32 _intentHash) external {
        Intent memory intent = intents[_intentHash];
        
        require(intent.timestamp != 0, "Intent does not exist");
        require(intent.owner == msg.sender, "Sender must be the intent owner");

        Deposit storage deposit = deposits[intent.depositId];

        _pruneIntent(deposit, _intentHash);

        deposit.remainingDeposits += intent.amount;
        deposit.outstandingIntentAmount -= intent.amount;
    }

    /**
     * @notice Anyone can submit a fullfill intent transaction, even if caller isn't the intent owner. Upon submission the
     * payment proof is verified, payment details are validated, intent is removed, and deposit state is updated. Deposit token
     * is transferred to the intent.to address.
     *
     * @param _paymentProof         Payment proof. Can be Groth16 Proof, TLSNotary proof, TLSProxy proof, attestation etc.
     * @param _intentHash           Identifier of intent being fulfilled
     */
    function fulfillIntent( 
        bytes calldata _paymentProof,
        bytes32 _intentHash
    )
        external
    {
        Intent memory intent = intents[_intentHash];
        Deposit storage deposit = deposits[intent.depositId];
        
        address verifier = intent.paymentVerifier;
        require(verifier != address(0), "Intent does not exist");
        
        PaymentVerificationData memory verificationData = depositVerifierData[intent.depositId][verifier];
        (bool success, bytes32 intentHash) = IPaymentVerifier(verifier).verifyPayment(
            _paymentProof,
            address(deposit.token),
            intent.amount,
            intent.timestamp,
            verificationData.conversionRate,
            verificationData.payeeDetailsHash,
            verificationData.data
        );
        require(success, "Payment verification failed");
        require(intentHash == _intentHash, "Invalid intent hash");      // Did revolut ramp do this?

        _pruneIntent(deposit, _intentHash);

        deposit.outstandingIntentAmount -= intent.amount;
        IERC20 token = deposit.token;
        _closeDepositIfNecessary(intent.depositId, deposit);

        _transferFunds(token, intentHash, intent, verifier);
    }


    /**
     * @notice Allows depositor to release funds to the payer in case of a failed fullfill intent or because of some other arrangement
     * between the two parties. Upon submission we check to make sure the msg.sender is the depositor, the  intent is removed, and 
     * deposit state is updated. Deposit token is transferred to the payer.
     *
     * @param _intentHash        Hash of intent to resolve by releasing the funds
     */
    function releaseFundsToPayer(bytes32 _intentHash) external {
        Intent memory intent = intents[_intentHash];
        Deposit storage deposit = deposits[intent.depositId];

        require(intent.owner != address(0), "Intent does not exist");
        require(deposit.depositor == msg.sender, "Caller must be the depositor");

        _pruneIntent(deposit, _intentHash);

        deposit.outstandingIntentAmount -= intent.amount;
        IERC20 token = deposit.token;
        _closeDepositIfNecessary(intent.depositId, deposit);

        // todo: should the processor get fees in this scenario?
        _transferFunds(token, _intentHash, intent, intent.paymentVerifier);
    }

    /**
     * @notice Caller must be the depositor for depositId, if not revert. Depositor is returned all remaining deposits and any
     * outstanding intents that are expired. If an intent is not expired then those funds will not be returned. Deposit is marked 
     * as not accepting intents and the funds locked due to intents can be withdrawn once the corresponding intents are expired.
     * Deposit will be deleted as long as there are no more outstanding intents.
     *
     * @param _depositId   DepositId the depositor is attempting to withdraw
     */
    function withdrawDeposit(uint256 _depositId) external {
        Deposit storage deposit = deposits[_depositId];

        require(deposit.depositor == msg.sender, "Caller must be the depositor");

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
     * @notice GOVERNANCE ONLY: Adds a payment verifier to the whitelist.
     *
     * @param _verifier   The payment verifier address to add
     */
    function addWhitelistedPaymentVerifier(address _verifier, uint256 _feeShare) external onlyOwner {
        require(_verifier != address(0), "Payment verifier cannot be zero address");
        require(!whitelistedPaymentVerifiers[_verifier], "Payment verifier already whitelisted");
        
        whitelistedPaymentVerifiers[_verifier] = true;
        paymentVerifierFeeShare[_verifier] = _feeShare;
        
        emit PaymentVerifierAdded(_verifier, _feeShare);
    }

    /**
     * @notice GOVERNANCE ONLY: Removes a payment verifier from the whitelist.
     *
     * @param _verifier   The payment verifier address to remove
     */
    function removeWhitelistedPaymentVerifier(address _verifier) external onlyOwner {
        require(whitelistedPaymentVerifiers[_verifier], "Payment verifier not whitelisted");
        
        whitelistedPaymentVerifiers[_verifier] = false;
        emit PaymentVerifierRemoved(_verifier);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the fee share for a payment verifier.
     *
     * @param _verifier   The payment verifier address to update
     * @param _feeShare   The new fee share
     */
    function updatePaymentVerifierFeeShare(address _verifier, uint256 _feeShare) external onlyOwner {
        require(whitelistedPaymentVerifiers[_verifier], "Payment verifier not whitelisted");

        paymentVerifierFeeShare[_verifier] = _feeShare;
        emit PaymentVerifierFeeShareUpdated(_verifier, _feeShare);
    }

    /**
     * @notice GOVERNANCE ONLY: Sets whether all payment verifiers can be used without whitelisting.
     *
     * @param _acceptAllPaymentVerifiers   True to accept all payment verifiers, false to require whitelisting
     */
    function updateAcceptAllPaymentVerifiers(bool _acceptAllPaymentVerifiers) external onlyOwner {
        acceptAllPaymentVerifiers = _acceptAllPaymentVerifiers;
        emit AcceptAllPaymentVerifiersUpdated(_acceptAllPaymentVerifiers);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the minimum deposit amount a user can specify for deposits.
     *
     * @param _minDepositAmount   The new minimum deposit amount
     */
    function setMinDepositAmount(uint256 _minDepositAmount) external onlyOwner {
        require(_minDepositAmount != 0, "Minimum deposit cannot be zero");

        minDepositAmount = _minDepositAmount;
        emit MinDepositAmountSet(_minDepositAmount);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the sustainability fee. This fee is charged to takers upon a successful 
     * fullfillment of an intent.
     *
     * @param _fee   The new sustainability fee in precise units (10**18, ie 10% = 1e17)
     */
    function setSustainabilityFee(uint256 _fee) external onlyOwner {
        require(_fee <= MAX_SUSTAINABILITY_FEE, "Fee cannot be greater than max fee");

        sustainabilityFee = _fee;
        emit SustainabilityFeeUpdated(_fee);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the recepient of sustainability fees.
     *
     * @param _feeRecipient   The new fee recipient address
     */
    function setSustainabilityFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Fee recipient cannot be zero address");

        sustainabilityFeeRecipient = _feeRecipient;
        emit SustainabilityFeeRecipientUpdated(_feeRecipient);
    }

    /**
     * @notice GOVERNANCE ONLY: Updates the intent expiration period, after this period elapses an intent can be pruned to prevent
     * locking up a depositor's funds.
     *
     * @param _intentExpirationPeriod   New intent expiration period
     */
    function setIntentExpirationPeriod(uint256 _intentExpirationPeriod) external onlyOwner {
        require(_intentExpirationPeriod != 0, "Max intent expiration period cannot be zero");

        intentExpirationPeriod = _intentExpirationPeriod;
        emit IntentExpirationPeriodSet(_intentExpirationPeriod);
    }

    
    /* ============ External View Functions ============ */

    function getDeposit(uint256 _depositId) public view returns (DepositView memory depositView) {
        Deposit memory deposit = deposits[_depositId];
        ( , uint256 reclaimableAmount) = _getPrunableIntents(_depositId);

        VerifierDataView[] memory verifiers = new VerifierDataView[](deposit.verifiers.length);
        for (uint256 j = 0; j < deposit.verifiers.length; ++j) {
            address verifier = deposit.verifiers[j];
            verifiers[j] = VerifierDataView({
                verifier: verifier,
                verificationData: depositVerifierData[_depositId][verifier]
            });
        }

        depositView = DepositView({
            depositId: _depositId,
            deposit: deposit,
            availableLiquidity: deposit.remainingDeposits + reclaimableAmount,
            verifiers: verifiers
        });
    }

    function getIntentsWithIntentHash(bytes32[] calldata _intentHashes) external view returns (IntentView[] memory intentArray) {
        intentArray = new IntentView[](_intentHashes.length);

        for (uint256 i = 0; i < _intentHashes.length; ++i) {
            bytes32 intentHash = _intentHashes[i];
            Intent memory intent = intents[intentHash];
            intentArray[i] = IntentView({
                intentHash: _intentHashes[i],
                intent: intent
            });
        }
    }

    function getAccountIntents(address _account) external view returns (IntentView[] memory intentsArray) {
        bytes32[] memory accountIntentHashes = accountIntents[_account];
        intentsArray = new IntentView[](accountIntentHashes.length);
        
        for (uint256 i = 0; i < accountIntentHashes.length; ++i) {
            bytes32 intentHash = accountIntentHashes[i];
            Intent memory intent = intents[intentHash];
            intentsArray[i] = IntentView({
                intentHash: intentHash,
                intent: intent
            });
        }
    }

    function getAccountDeposits(address _account) external view returns (DepositView[] memory depositArray) {
        uint256[] memory accountDepositIds = accountDeposits[_account];
        depositArray = new DepositView[](accountDepositIds.length);
        
        for (uint256 i = 0; i < accountDepositIds.length; ++i) {
            uint256 depositId = accountDepositIds[i];
            depositArray[i] = getDeposit(depositId);
        }
    }

    function getDepositFromIds(uint256[] memory _depositIds) external view returns (DepositView[] memory depositArray) {
        depositArray = new DepositView[](_depositIds.length);

        for (uint256 i = 0; i < _depositIds.length; ++i) {
            uint256 depositId = _depositIds[i];
            depositArray[i] = getDeposit(depositId);
        }
    }

    /* ============ Internal Functions ============ */

    function _validateCreateDeposit(
        uint256 _amount,
        address[] calldata _verifier,
        PaymentVerificationData[] calldata _paymentVerificationData
    ) internal view {
        require(_amount >= minDepositAmount, "Deposit amount must be greater than min deposit amount");
        for (uint256 i = 0; i < _verifier.length; i++) {
            require(_verifier[i] != address(0), "Verifier cannot be zero address");
            require(whitelistedPaymentVerifiers[_verifier[i]] || acceptAllPaymentVerifiers, "Payment verifier not whitelisted");
            // Gating service can be zero address
            // Attester can be zero address
            require(_paymentVerificationData[i].conversionRate > 0, "Conversion rate must be greater than 0");
            require(_paymentVerificationData[i].payeeDetailsHash != bytes32(0), "Payee details hash cannot be empty");
            // Data can be empty
        }
    }

    function _validateIntent(
        uint256 _depositId,
        Deposit storage _deposit,
        uint256 _amount,
        address _to,
        address _verifier,
        bytes calldata _gatingServiceSignature
    ) internal view {
        require(_deposit.depositor != address(0), "Deposit does not exist");
        require(depositVerifierData[_depositId][_verifier].payeeDetailsHash != bytes32(0), "Payment verifier not supported");
        require(_deposit.acceptingIntents, "Deposit is not accepting intents");
        
        require(_amount >= _deposit.intentAmountRange.min, "Signaled amount must be greater than min intent amount");
        require(_amount <= _deposit.intentAmountRange.max, "Signaled amount must be less than max intent amount");
        
        require(_to != address(0), "Cannot send to zero address");

        address intentGatingService = depositVerifierData[_depositId][_verifier].intentGatingService;
        if (intentGatingService != address(0)) {
            require(
                _isValidSignature(
                    abi.encodePacked(_depositId, _amount, _to, _verifier),
                    _gatingServiceSignature,
                    intentGatingService
                ),
                "Invalid gating service signature"
            );
        }
    }

    function _calculateIntentHash(
        address _onRamper,
        address _verifier,
        uint256 _depositId
    )
        internal
        view
        virtual
        returns (bytes32 intentHash)
    {
        // Mod with circom prime field to make sure it fits in a 254-bit field
        uint256 intermediateHash = uint256(keccak256(abi.encodePacked(_onRamper, _verifier, _depositId, block.timestamp)));
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

    function _pruneIntents(Deposit storage _deposit, bytes32[] memory _intents) internal {
        for (uint256 i = 0; i < _intents.length; ++i) {
            if (_intents[i] != bytes32(0)) {
                _pruneIntent(_deposit, _intents[i]);
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
     * deposits mapping and removes tracking it in the user's accountDeposits mapping.
     */
    function _closeDepositIfNecessary(uint256 _depositId, Deposit storage _deposit) internal {
        uint256 openDepositAmount = _deposit.outstandingIntentAmount + _deposit.remainingDeposits;
        if (openDepositAmount == 0) {
            accountDeposits[_deposit.depositor].removeStorage(_depositId);
            _deleteDepositVerifierData(_depositId);
            emit DepositClosed(_depositId, _deposit.depositor);
            delete deposits[_depositId];
        }
    }

    /**
     * @notice Iterates through all verifiers for a deposit and deletes the corresponding verifier data.
     */
    function _deleteDepositVerifierData(uint256 _depositId) internal {
        Deposit storage deposit = deposits[_depositId];
        for (uint256 i = 0; i < deposit.verifiers.length; i++) {
            address verifier = deposit.verifiers[i];
            delete depositVerifierData[_depositId][verifier];
        }
    }

    /**
     * @notice Checks if sustainability fee has been defined, if so sends fee to the respective fee recipients, and intent amount
     * minus total fee to the on-ramper. If sustainability fee is undefined then full intent amount is transferred to on-ramper. 
     * Total fee is split between the sustainability fee recipient and the payment verifier.
     */
    function _transferFunds(IERC20 _token, bytes32 _intentHash, Intent memory _intent, address _verifier) internal {
        uint256 fee;
        uint256 verifierFee;
        if (sustainabilityFee != 0) {
            fee = (_intent.amount * sustainabilityFee) / PRECISE_UNIT;
            verifierFee = (fee * paymentVerifierFeeShare[_verifier]) / PRECISE_UNIT;
            _token.transfer(sustainabilityFeeRecipient, fee - verifierFee);
            _token.transfer(_verifier, verifierFee);
        }

        uint256 transferAmount = _intent.amount - fee;
        _token.transfer(_intent.to, transferAmount);

        emit IntentFulfilled(
            _intentHash, 
            _intent.depositId, 
            _intent.owner, 
            _verifier, 
            _intent.to, 
            transferAmount, 
            fee - verifierFee, 
            verifierFee
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
}
