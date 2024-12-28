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
import { IPaymentVerifier } from "./verifiers/interfaces/IPaymentVerifier.sol";

pragma solidity ^0.8.18;

contract Escrow is Ownable, Pausable, IEscrow {

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
        Range intentAmountRange
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

    event DepositConversionRateUpdated(
        uint256 indexed depositId,
        address indexed verifier,
        bytes32 indexed currency,
        uint256 newConversionRate
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
        uint256 sustainabilityFee,
        uint256 verifierFee
    );

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

    /* ============ Constants ============ */
    uint256 internal constant PRECISE_UNIT = 1e18;
    uint256 constant CIRCOM_PRIME_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant MAX_SUSTAINABILITY_FEE = 5e16;   // 5% max sustainability fee
    
    /* ============ State Variables ============ */

    uint256 immutable public chainId;                                      // chainId of the chain the escrow is deployed on

    mapping(address => uint256[]) public accountDeposits;           // Mapping of address to depositIds
    mapping(address => bytes32) public accountIntent;               // Mapping of address to intentHash (Only one intent per address at a given time)
    
    // Mapping of depositId to verifier address to deposit's verification data. A single deposit can support multiple payment 
    // services. Each payment service has it's own verification data which includes the payee details hash and the data used for 
    // payment verification.
    // Example: Deposit 1 => Venmo => payeeDetails: 0x123, data: 0x456
    //                    => Revolut => payeeDetails: 0x789, data: 0xabc
    mapping(uint256 => mapping(address => DepositVerifierData)) public depositVerifierData;
    mapping(uint256 => address[]) public depositVerifiers;          // Handy mapping to get all verifiers for a deposit
    
    // Mapping of depositId to verifier address to mapping of fiat currency to conversion rate. Each payment service can support
    // multiple currencies. Depositor can specify list of currencies and conversion rates for each payment service.
    // Example: Deposit 1 => Venmo => USD: 1e18
    //                    => Revolut => USD: 1e18, EUR: 1.2e18, SGD: 1.5e18
    mapping(uint256 => mapping(address => mapping(bytes32 => uint256))) public depositCurrencyConversionRate;
    mapping(uint256 => mapping(address => bytes32[])) public depositCurrencies; // Handy mapping to get all currencies for a deposit and verifier

    mapping(uint256 => Deposit) public deposits;                    // Mapping of depositIds to deposit structs
    mapping(bytes32 => Intent) public intents;                      // Mapping of intentHashes to intent structs

    // Governance controlled
    bool public acceptAllPaymentVerifiers;                            // True if all payment verifiers are accepted, False otherwise
    mapping(address => bool) public whitelistedPaymentVerifiers;      // Mapping of payment verifier addresses to boolean indicating if they are whitelisted
    mapping(address => uint256) public paymentVerifierFeeShare;       // Mapping of payment verifier addresses to their fee share

    uint256 public intentExpirationPeriod;                          // Time period after which an intent can be pruned from the system
    uint256 public sustainabilityFee;                               // Fee charged to takers in preciseUnits (1e16 = 1%)
    address public sustainabilityFeeRecipient;                      // Address that receives the sustainability fee

    uint256 public depositCounter;                                  // Counter for depositIds


    /* ============ Constructor ============ */
    constructor(
        address _owner,
        uint256 _chainId,
        uint256 _intentExpirationPeriod,
        uint256 _sustainabilityFee,
        address _sustainabilityFeeRecipient
    )
        Ownable()
    {
        chainId = _chainId;
        intentExpirationPeriod = _intentExpirationPeriod;
        sustainabilityFee = _sustainabilityFee;
        sustainabilityFeeRecipient = _sustainabilityFeeRecipient;

        transferOwnership(_owner);
    }

    /* ============ External Functions ============ */

    /**
     * @notice Creates a deposit entry by locking liquidity in the escrow contract that can be taken by signaling intents. This function will 
     * not add to previous deposits. Every deposit has it's own unique identifier. User must approve the contract to transfer the deposit amount
     * of deposit token. Every deposit specifies the payment services it supports by specifying their corresponding verifier addresses and 
     * verification data, supported currencies and their conversion rates for each payment service.
     * Note that the order of the verifiers, verification data, and currency data must match.
     *
     * @param _token                     The token to be deposited
     * @param _amount                    The amount of token to deposit
     * @param _intentAmountRange         The max and min take amount for each intent
     * @param _verifiers                 The payment verifiers that deposit supports
     * @param _verifierData              The payment verification data for each verifier that deposit supports
     * @param _currencies                The currencies for each verifier that deposit supports
     */
    function createDeposit(
        IERC20 _token,
        uint256 _amount,
        Range calldata _intentAmountRange,
        address[] calldata _verifiers,
        DepositVerifierData[] calldata _verifierData,
        Currency[][] calldata _currencies
    )
        external
        whenNotPaused
    {
        _validateCreateDeposit(_amount, _intentAmountRange, _verifiers, _verifierData, _currencies);

        uint256 depositId = depositCounter++;

        accountDeposits[msg.sender].push(depositId);

        deposits[depositId] = Deposit({
            depositor: msg.sender,
            token: _token,
            amount: _amount,
            intentAmountRange: _intentAmountRange,
            acceptingIntents: true,
            intentHashes: new bytes32[](0),
            remainingDeposits: _amount,
            outstandingIntentAmount: 0
        });

        emit DepositReceived(depositId, msg.sender, _token, _amount, _intentAmountRange);

        for (uint256 i = 0; i < _verifiers.length; i++) {
            address verifier = _verifiers[i];
            require(
                bytes(depositVerifierData[depositId][verifier].payeeDetails).length == 0,
                "Verifier data already exists"
            );
            depositVerifierData[depositId][verifier] = _verifierData[i];
            depositVerifiers[depositId].push(verifier);

            bytes32 payeeDetailsHash = keccak256(abi.encodePacked(_verifierData[i].payeeDetails));
            emit DepositVerifierAdded(depositId, verifier, payeeDetailsHash, _verifierData[i].intentGatingService);
        
            for (uint256 j = 0; j < _currencies[i].length; j++) {
                Currency memory currency = _currencies[i][j];
                require(
                    depositCurrencyConversionRate[depositId][verifier][currency.code] == 0,
                    "Currency conversion rate already exists"
                );
                depositCurrencyConversionRate[depositId][verifier][currency.code] = currency.conversionRate;
                depositCurrencies[depositId][verifier].push(currency.code);

                emit DepositCurrencyAdded(depositId, verifier, currency.code, currency.conversionRate);
            }
        }

        _token.transferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @notice Signals intent to pay the depositor defined in the _depositId the _amount * deposit conversionRate off-chain
     * in order to unlock _amount of funds on-chain. Caller must provide a signature from the deposit's gating service to prove
     * their eligibility to take liquidity. The offchain gating service can perform any additional verification, for example, 
     * verifying the payer's identity, checking the payer's KYC status, etc. If there are prunable intents then they will be 
     * deleted from the deposit to be able to maintain state hygiene.
     *
     * @param _depositId                The ID of the deposit the taker intends to use for taking onchain liquidity
     * @param _amount                   The amount of deposit.token the user wants to take
     * @param _to                       Address to forward funds to (can be same as owner)
     * @param _verifier                 The payment verifier corresponding to the payment service the user is going to pay with 
     *                                  offchain (e.g. Venmo, Revolut, Mercado, etc.)
     * @param _fiatCurrency             The currency code that the user is paying in offchain
     * @param _gatingServiceSignature   The signature from the deposit's gating service on intent parameters
     */
    function signalIntent(
        uint256 _depositId,
        uint256 _amount,
        address _to,
        address _verifier,
        bytes32 _fiatCurrency,
        bytes calldata _gatingServiceSignature
    )
        external
        whenNotPaused
    {
        Deposit storage deposit = deposits[_depositId];
        
        _validateIntent(_depositId, deposit, _amount, _to, _verifier, _fiatCurrency, _gatingServiceSignature);

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

        uint256 conversionRate = depositCurrencyConversionRate[_depositId][_verifier][_fiatCurrency];
        intents[intentHash] = Intent({
            owner: msg.sender,
            to: _to,
            depositId: _depositId,
            amount: _amount,
            paymentVerifier: _verifier,
            fiatCurrency: _fiatCurrency,
            conversionRate: conversionRate,
            timestamp: block.timestamp
        });

        accountIntent[msg.sender] = intentHash;

        deposit.remainingDeposits -= _amount;
        deposit.outstandingIntentAmount += _amount;
        deposit.intentHashes.push(intentHash);

        emit IntentSignaled(intentHash, _depositId, _verifier, msg.sender, _to, _amount, _fiatCurrency, conversionRate, block.timestamp);
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
     * @notice Anyone can submit a fulfill intent transaction, even if caller isn't the intent owner. Upon submission the
     * offchain payment proof is verified, payment details are validated, intent is removed, and deposit state is updated. 
     * Deposit token is transferred to the intent.to address.
     *
     * @param _paymentProof         Payment proof. Can be Groth16 Proof, TLSNotary proof, TLSProxy proof, attestation etc.
     * @param _intentHash           Identifier of intent being fulfilled
     */
    function fulfillIntent( 
        bytes calldata _paymentProof,
        bytes32 _intentHash
    )
        external
        whenNotPaused
    {
        Intent memory intent = intents[_intentHash];
        Deposit storage deposit = deposits[intent.depositId];
        
        address verifier = intent.paymentVerifier;
        require(verifier != address(0), "Intent does not exist");
        
        DepositVerifierData memory verifierData = depositVerifierData[intent.depositId][verifier];
        (bool success, bytes32 intentHash) = IPaymentVerifier(verifier).verifyPayment(
            _paymentProof,
            address(deposit.token),
            intent.amount,
            intent.timestamp,
            verifierData.payeeDetails,
            intent.fiatCurrency,
            intent.conversionRate,
            verifierData.data
        );
        require(success, "Payment verification failed");
        require(intentHash == _intentHash, "Invalid intent hash");

        _pruneIntent(deposit, _intentHash);

        deposit.outstandingIntentAmount -= intent.amount;
        IERC20 token = deposit.token;
        _closeDepositIfNecessary(intent.depositId, deposit);

        _transferFunds(token, intentHash, intent, verifier);
    }


    /**
     * @notice Allows depositor to release funds to the payer in case of a failed fulfill intent or because of some other arrangement
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

        _transferFunds(token, _intentHash, intent, address(0));
    }

    /**
     * @notice Only callable by the depositor for a deposit. Allows depositor to update the conversion rate for a currency for a 
     * payment verifier. Since intent's store the conversion rate at the time of intent, changing the conversion rate will not affect
     * any intents that have already been signaled.
     *
     * @param _depositId                The deposit ID
     * @param _verifier                 The payment verifier address to update the conversion rate for
     * @param _fiatCurrency             The fiat currency code to update the conversion rate for
     * @param _newConversionRate        The new conversion rate. Must be greater than 0.
     */
    function updateDepositConversionRate(
        uint256 _depositId, 
        address _verifier, 
        bytes32 _fiatCurrency, 
        uint256 _newConversionRate
    )
        external
        whenNotPaused
    {
        Deposit storage deposit = deposits[_depositId];
        uint256 oldConversionRate = depositCurrencyConversionRate[_depositId][_verifier][_fiatCurrency];

        require(deposit.depositor == msg.sender, "Caller must be the depositor");
        require(oldConversionRate != 0, "Currency or verifier not supported");
        require(_newConversionRate > 0, "Conversion rate must be greater than 0");

        depositCurrencyConversionRate[_depositId][_verifier][_fiatCurrency] = _newConversionRate;

        emit DepositConversionRateUpdated(_depositId, _verifier, _fiatCurrency, _newConversionRate);
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
     * @param _feeShare   The fee share for the payment verifier
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
     * @notice GOVERNANCE ONLY: Updates the sustainability fee. This fee is charged to takers upon a successful 
     * fulfillment of an intent.
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

    /**
     * @notice GOVERNANCE ONLY: Pauses deposit creation, intent creation and intent fulfillment functionality for the escrow.
     * Functionalities that are paused:
     * - Deposit creation
     * - Updating conversion rates
     * - Intent creation
     * - Intent fulfillment
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

    function getDeposit(uint256 _depositId) public view returns (DepositView memory depositView) {
        Deposit memory deposit = deposits[_depositId];
        ( , uint256 reclaimableAmount) = _getPrunableIntents(_depositId);

        VerifierDataView[] memory verifiers = new VerifierDataView[](depositVerifiers[_depositId].length);
        for (uint256 i = 0; i < verifiers.length; ++i) {
            address verifier = depositVerifiers[_depositId][i];
            Currency[] memory currencies = new Currency[](depositCurrencies[_depositId][verifier].length);
            for (uint256 j = 0; j < currencies.length; ++j) {
                bytes32 code = depositCurrencies[_depositId][verifier][j];
                currencies[j] = Currency({
                    code: code,
                    conversionRate: depositCurrencyConversionRate[_depositId][verifier][code]
                });
            }
            verifiers[i] = VerifierDataView({
                verifier: verifier,
                verificationData: depositVerifierData[_depositId][verifier],
                currencies: currencies
            });
        }

        depositView = DepositView({
            depositId: _depositId,
            deposit: deposit,
            availableLiquidity: deposit.remainingDeposits + reclaimableAmount,
            verifiers: verifiers
        });
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

    function getIntent(bytes32 _intentHash) public view returns (IntentView memory intentView) {
        Intent memory intent = intents[_intentHash];
        DepositView memory deposit = getDeposit(intent.depositId);
        intentView = IntentView({
            intentHash: _intentHash,
            intent: intent,
            deposit: deposit
        });
    }

    function getIntents(bytes32[] calldata _intentHashes) external view returns (IntentView[] memory intentArray) {
        intentArray = new IntentView[](_intentHashes.length);

        for (uint256 i = 0; i < _intentHashes.length; ++i) {
            intentArray[i] = getIntent(_intentHashes[i]);
        }
    }

    function getAccountIntent(address _account) external view returns (IntentView memory intentView) {
        bytes32 intentHash = accountIntent[_account];
        intentView = getIntent(intentHash);
    }

 
    /* ============ Internal Functions ============ */

    function _validateCreateDeposit(
        uint256 _amount,
        Range memory _intentAmountRange,
        address[] calldata _verifiers,
        DepositVerifierData[] calldata _verifierData,
        Currency[][] calldata _currencies
    ) internal view {

        require(_intentAmountRange.min != 0, "Min intent amount cannot be zero");
        require(_intentAmountRange.max != 0, "Max intent amount cannot be zero");
        require(_intentAmountRange.min <= _intentAmountRange.max, "Min intent amount must be less than max intent amount");
        require(_amount >= _intentAmountRange.min, "Amount must be greater than min intent amount");
        require(_amount <= _intentAmountRange.max, "Amount must be less than max intent amount");

        // Check that the length of the verifiers, depositVerifierData, and currencies arrays are the same
        require(_verifiers.length == _verifierData.length, "Verifiers and depositVerifierData length mismatch");
        require(_verifiers.length == _currencies.length, "Verifiers and currencies length mismatch");

        for (uint256 i = 0; i < _verifiers.length; i++) {
            address verifier = _verifiers[i];
            
            require(verifier != address(0), "Verifier cannot be zero address");
            require(whitelistedPaymentVerifiers[verifier] || acceptAllPaymentVerifiers, "Payment verifier not whitelisted");

            // _verifierData.intentGatingService can be zero address, _verifierData.data can be empty
            require(bytes(_verifierData[i].payeeDetails).length != 0, "Payee details cannot be empty");

            for (uint256 j = 0; j < _currencies[i].length; j++) {
                require(
                    IPaymentVerifier(verifier).isCurrency(_currencies[i][j].code), 
                    "Currency not supported by verifier"
                );
                require(_currencies[i][j].conversionRate > 0, "Conversion rate must be greater than 0");
            }
        }
    }

    function _validateIntent(
        uint256 _depositId,
        Deposit storage _deposit,
        uint256 _amount,
        address _to,
        address _verifier,
        bytes32 _fiatCurrency,
        bytes calldata _gatingServiceSignature
    ) internal view {
        require(accountIntent[msg.sender] == bytes32(0), "Account has unfulfilled intent");
        require(_deposit.depositor != address(0), "Deposit does not exist");
        require(_deposit.acceptingIntents, "Deposit is not accepting intents");
        require(_amount >= _deposit.intentAmountRange.min, "Signaled amount must be greater than min intent amount");
        require(_amount <= _deposit.intentAmountRange.max, "Signaled amount must be less than max intent amount");
        require(_to != address(0), "Cannot send to zero address");
        
        DepositVerifierData memory verifierData = depositVerifierData[_depositId][_verifier];
        require(bytes(verifierData.payeeDetails).length != 0, "Payment verifier not supported");
        require(depositCurrencyConversionRate[_depositId][_verifier][_fiatCurrency] != 0, "Currency not supported");

        address intentGatingService = verifierData.intentGatingService;
        if (intentGatingService != address(0)) {
            require(
                _isValidSignature(
                    abi.encodePacked(_depositId, _amount, _to, _verifier, _fiatCurrency, chainId),
                    _gatingServiceSignature,
                    intentGatingService
                ),
                "Invalid gating service signature"
            );
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

        delete accountIntent[intent.owner];
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
                delete depositCurrencyConversionRate[_depositId][verifier][currencies[j]];
            }
        }
    }

    /**
     * @notice Checks if sustainability fee has been defined, if so sends fee to the respective fee recipients, and intent amount
     * minus total fee to the taker. Total fee is split between the sustainability fee recipient and the payment verifier. To 
     * skip payment verifier fee split, set _verifier to zero address. If sustainability fee is undefined then full intent amount 
     * is transferred to taker. 
     */
    function _transferFunds(IERC20 _token, bytes32 _intentHash, Intent memory _intent, address _verifier) internal {
        uint256 fee;
        uint256 verifierFee;
        if (sustainabilityFee != 0) {
            fee = (_intent.amount * sustainabilityFee) / PRECISE_UNIT;
            if (_verifier != address(0)) {
                verifierFee = (fee * paymentVerifierFeeShare[_verifier]) / PRECISE_UNIT;
                _token.transfer(_verifier, verifierFee);
            }
            _token.transfer(sustainabilityFeeRecipient, fee - verifierFee);
        }

        uint256 transferAmount = _intent.amount - fee;
        _token.transfer(_intent.to, transferAmount);

        emit IntentFulfilled(
            _intentHash, 
            _intent.depositId, 
            _verifier, 
            _intent.owner, 
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
