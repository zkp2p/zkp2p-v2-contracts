// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import { AddressArrayUtils } from "../../external/AddressArrayUtils.sol";
import { Bytes32ArrayUtils } from "../../external/Bytes32ArrayUtils.sol";
import { IBaseGenericPaymentVerifier } from "../interfaces/IBaseGenericPaymentVerifier.sol";
import { INullifierRegistry } from "../../interfaces/INullifierRegistry.sol";

abstract contract BaseGenericPaymentVerifier is IBaseGenericPaymentVerifier, Ownable {
    using AddressArrayUtils for address[];
    using Bytes32ArrayUtils for bytes32[];
    using SignatureChecker for address;
    using ECDSA for bytes32;
    
    /* ============ Events ============ */
    
    event MinWitnessSignaturesUpdated(uint256 oldMin, uint256 newMin);
    event PaymentMethodAdded(bytes32 indexed paymentMethod, uint256 timestampBuffer);
    event PaymentMethodRemoved(bytes32 indexed paymentMethod);
    event TimestampBufferSet(bytes32 indexed paymentMethod, uint256 oldBuffer, uint256 newBuffer);
    event ProcessorHashAdded(bytes32 indexed paymentMethod, bytes32 indexed processorHash);
    event ProcessorHashRemoved(bytes32 indexed paymentMethod, bytes32 indexed processorHash);
    event CurrencyAdded(bytes32 indexed paymentMethod, bytes32 indexed currencyCode);
    event CurrencyRemoved(bytes32 indexed paymentMethod, bytes32 indexed currencyCode);
    
    /* ============ State Variables ============ */
    
    address public immutable escrow;
    INullifierRegistry public immutable nullifierRegistry;
    
    uint256 public minWitnessSignatures;
    
    // Mapping of payment method hash => configuration
    mapping(bytes32 => IBaseGenericPaymentVerifier.PaymentMethodConfig) public paymentMethodConfig;
    
    // Array of payment method hashes for enumeration
    bytes32[] public paymentMethods;
    
    /* ============ Constructor ============ */
    
    /**
     * Initializes base payment verifier
     * @param _escrow The escrow contract address
     * @param _nullifierRegistry The nullifier registry contract
     * @param _minWitnessSignatures Minimum number of witness signatures required
     */
    constructor(
        address _escrow,
        INullifierRegistry _nullifierRegistry,
        uint256 _minWitnessSignatures
    ) Ownable() {
        require(_escrow != address(0), "BaseGenericPaymentVerifier: Invalid escrow");
        require(address(_nullifierRegistry) != address(0), "BaseGenericPaymentVerifier: Invalid nullifier registry");
        require(_minWitnessSignatures > 0, "BaseGenericPaymentVerifier: Min signatures must be > 0");
        
        escrow = _escrow;
        nullifierRegistry = _nullifierRegistry;
        minWitnessSignatures = _minWitnessSignatures;
    }
    
    /* ============ External Functions ============ */
    
    /**
     * Updates the minimum witness signatures required
     * @param _newMinWitnessSignatures The new minimum witness signatures
     */
    function setMinWitnessSignatures(uint256 _newMinWitnessSignatures) external onlyOwner {
        require(_newMinWitnessSignatures > 0, "BaseGenericPaymentVerifier: Min signatures must be > 0");
        require(_newMinWitnessSignatures != minWitnessSignatures, "BaseGenericPaymentVerifier: Same value");
        
        uint256 oldMin = minWitnessSignatures;
        minWitnessSignatures = _newMinWitnessSignatures;
        emit MinWitnessSignaturesUpdated(oldMin, _newMinWitnessSignatures);
    }
    
    /**
     * Updates the timestamp buffer for a payment method
     * @param _paymentMethod The payment method hash
     * @param _newTimestampBuffer The new timestamp buffer in seconds
     */
    function setTimestampBuffer(bytes32 _paymentMethod, uint256 _newTimestampBuffer) external onlyOwner {
        require(paymentMethodConfig[_paymentMethod].initialized, "BaseGenericPaymentVerifier: Payment method does not exist");
        
        uint256 oldBuffer = paymentMethodConfig[_paymentMethod].timestampBuffer;
        paymentMethodConfig[_paymentMethod].timestampBuffer = _newTimestampBuffer;
        
        emit TimestampBufferSet(_paymentMethod, oldBuffer, _newTimestampBuffer);
    }
    
    /**
     * Authorizes a processor hash for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _processorHash The processor provider hash to authorize
     */
    function addProcessorHash(bytes32 _paymentMethod, bytes32 _processorHash) public onlyOwner {
        require(paymentMethodConfig[_paymentMethod].initialized, "BaseGenericPaymentVerifier: Payment method does not exist");
        require(_processorHash != bytes32(0), "BaseGenericPaymentVerifier: Invalid processor hash");
        require(!paymentMethodConfig[_paymentMethod].processorHashExists[_processorHash], "BaseGenericPaymentVerifier: Already authorized");
        
        paymentMethodConfig[_paymentMethod].processorHashExists[_processorHash] = true;
        paymentMethodConfig[_paymentMethod].processorHashes.push(_processorHash);
        emit ProcessorHashAdded(_paymentMethod, _processorHash);
    }
    
    /**
     * Revokes a processor hash for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _processorHash The processor provider hash to revoke
     */
    function removeProcessorHash(bytes32 _paymentMethod, bytes32 _processorHash) external onlyOwner {
        require(paymentMethodConfig[_paymentMethod].processorHashExists[_processorHash], "BaseGenericPaymentVerifier: Not authorized");
        
        paymentMethodConfig[_paymentMethod].processorHashExists[_processorHash] = false;
        paymentMethodConfig[_paymentMethod].processorHashes.removeStorage(_processorHash);
        emit ProcessorHashRemoved(_paymentMethod, _processorHash);
    }
    
    /**
     * Adds a supported currency for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _currency The currency code (e.g., "USD", "EUR")
     */
    function addCurrency(bytes32 _paymentMethod, string memory _currency) public onlyOwner {
        bytes32 currencyCode = keccak256(abi.encodePacked(_currency));
        
        require(paymentMethodConfig[_paymentMethod].initialized, "BaseGenericPaymentVerifier: Payment method does not exist");
        require(!paymentMethodConfig[_paymentMethod].currencyExists[currencyCode], "BaseGenericPaymentVerifier: Currency already supported");
        
        paymentMethodConfig[_paymentMethod].currencyExists[currencyCode] = true;
        paymentMethodConfig[_paymentMethod].currencies.push(currencyCode);
        emit CurrencyAdded(_paymentMethod, currencyCode);
    }
    
    /**
     * Removes a supported currency for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _currency The currency code
     */
    function removeCurrency(bytes32 _paymentMethod, string memory _currency) external onlyOwner {
        bytes32 currencyCode = keccak256(abi.encodePacked(_currency));
        
        require(paymentMethodConfig[_paymentMethod].currencyExists[currencyCode], "BaseGenericPaymentVerifier: Currency not supported");
        
        paymentMethodConfig[_paymentMethod].currencyExists[currencyCode] = false;
        paymentMethodConfig[_paymentMethod].currencies.removeStorage(currencyCode);
        emit CurrencyRemoved(_paymentMethod, currencyCode);
    }
    
    /**
     * Removes a payment method and all associated data
     * @param _paymentMethod The payment method hash to remove
     */
    function removePaymentMethod(bytes32 _paymentMethod) external onlyOwner {
        require(paymentMethodConfig[_paymentMethod].initialized, "BaseGenericPaymentVerifier: Payment method does not exist");
        
        // Clear all processor hashes
        bytes32[] storage processorHashes = paymentMethodConfig[_paymentMethod].processorHashes;
        for (uint256 i = 0; i < processorHashes.length; i++) {
            delete paymentMethodConfig[_paymentMethod].processorHashExists[processorHashes[i]];
        }
        delete paymentMethodConfig[_paymentMethod].processorHashes;
        
        // Clear all currencies
        bytes32[] storage currencies = paymentMethodConfig[_paymentMethod].currencies;
        for (uint256 i = 0; i < currencies.length; i++) {
            delete paymentMethodConfig[_paymentMethod].currencyExists[currencies[i]];
        }
        delete paymentMethodConfig[_paymentMethod].currencies;
        
        // Clear payment method config
        delete paymentMethodConfig[_paymentMethod];
        
        // Remove from paymentMethods array
        paymentMethods.removeStorage(_paymentMethod);
        
        emit PaymentMethodRemoved(_paymentMethod);
    }
    
    /**
     * Adds a new payment method with processors and currencies
     * @param _paymentMethod The payment method hash
     * @param _timestampBuffer Payment method-specific timestamp buffer in seconds
     * @param _processorHashes Array of processor hashes to authorize
     * @param _currencies Array of currency codes to support
     */
    function addPaymentMethod(
        bytes32 _paymentMethod,
        uint256 _timestampBuffer,
        bytes32[] calldata _processorHashes,
        string[] calldata _currencies
    ) external onlyOwner {
        require(!paymentMethodConfig[_paymentMethod].initialized, "BaseGenericPaymentVerifier: Payment method already exists");
        require(_processorHashes.length > 0, "BaseGenericPaymentVerifier: Must provide at least one processor");
        require(_currencies.length > 0, "BaseGenericPaymentVerifier: Must provide at least one currency");
        
        // Initialize payment method
        paymentMethodConfig[_paymentMethod].initialized = true;
        paymentMethodConfig[_paymentMethod].timestampBuffer = _timestampBuffer;
        paymentMethods.push(_paymentMethod);
        
        // Add processors
        for (uint256 i = 0; i < _processorHashes.length; i++) {
            addProcessorHash(_paymentMethod, _processorHashes[i]);
        }
        
        // Add currencies
        for (uint256 i = 0; i < _currencies.length; i++) {
            addCurrency(_paymentMethod, _currencies[i]);
        }
        
        emit PaymentMethodAdded(_paymentMethod, _timestampBuffer);
    }
    
    /* ============ View Functions ============ */
    
    /**
     * Gets all registered paymentMethods
     * @return Array of payment method hashes
     */
    function getPaymentMethods() external view returns (bytes32[] memory) {
        return paymentMethods;
    }
    
    /**
     * Gets the timestamp buffer for a payment method
     * @param _paymentMethod The payment method hash
     * @return The timestamp buffer in seconds
     */
    function getTimestampBuffer(bytes32 _paymentMethod) external view returns (uint256) {
        require(paymentMethodConfig[_paymentMethod].initialized, "BaseGenericPaymentVerifier: Payment method does not exist");
        return paymentMethodConfig[_paymentMethod].timestampBuffer;
    }
    
    /**
     * Checks if a processor is authorized for a payment method
     * @param _paymentMethod The payment method hash
     * @param _processorHash The processor hash to check
     * @return Whether the processor is authorized
     */
    function isProcessorHash(bytes32 _paymentMethod, bytes32 _processorHash) external view returns (bool) {
        return paymentMethodConfig[_paymentMethod].processorHashExists[_processorHash];
    }
    
    /**
     * Checks if a currency is supported for a payment method
     * @param _paymentMethod The payment method hash
     * @param _currency The currency code to check
     * @return Whether the currency is supported
     */
    function isCurrency(bytes32 _paymentMethod, string memory _currency) external view returns (bool) {
        bytes32 currencyCode = keccak256(abi.encodePacked(_currency));
        return paymentMethodConfig[_paymentMethod].currencyExists[currencyCode];
    }
    
    /**
     * Gets all processor hashes for a payment method
     * @param _paymentMethod The payment method hash
     * @return Array of processor hashes
     */
    function getProcessorHashes(bytes32 _paymentMethod) external view returns (bytes32[] memory) {
        require(paymentMethodConfig[_paymentMethod].initialized, "BaseGenericPaymentVerifier: Payment method does not exist");
        return paymentMethodConfig[_paymentMethod].processorHashes;
    }
    
    /**
     * Gets all supported currencies for a payment method
     * @param _paymentMethod The payment method hash
     * @return Array of currency codes (as bytes32)
     */
    function getCurrencies(bytes32 _paymentMethod) external view returns (bytes32[] memory) {
        require(paymentMethodConfig[_paymentMethod].initialized, "BaseGenericPaymentVerifier: Payment method does not exist");
        return paymentMethodConfig[_paymentMethod].currencies;
    }
    
    /* ============ Internal Functions ============ */
    
    /**
     * Validates and adds a nullifier to prevent double-spending
     * @param _nullifier The nullifier to add
     */
    function _validateAndAddNullifier(bytes32 _nullifier) internal {
        require(!nullifierRegistry.isNullified(_nullifier), "Nullifier has already been used");
        nullifierRegistry.addNullifier(_nullifier);
    }
    
    /**
     * Decodes witness addresses from deposit data with duplicate checking
     * @param _depositData The encoded witness addresses
     * @return witnesses Array of unique witness addresses
     */
    function _decodeWitnesses(bytes memory _depositData) internal view returns (address[] memory) {
        address[] memory witnesses = abi.decode(_depositData, (address[]));
        
        require(witnesses.length > 0, "BaseGenericPaymentVerifier: No witnesses provided");
        require(witnesses.length >= minWitnessSignatures, "BaseGenericPaymentVerifier: Not enough witnesses");
        
        // Check for duplicates
        for (uint256 i = 0; i < witnesses.length; i++) {
            for (uint256 j = i + 1; j < witnesses.length; j++) {
                require(witnesses[i] != witnesses[j], "BaseGenericPaymentVerifier: Duplicate witnesses");
            }
        }
        
        return witnesses;
    }
    
    /**
     * TODO: cleanup
     * Verifies that signatures meet the required threshold from accepted witnesses
     * @param _messageHash The hash of the message that was signed
     * @param _signatures Array of signatures to verify
     * @param _witnesses Array of accepted witness addresses
     * @param _requiredThreshold Minimum number of valid witness signatures required
     * @return Whether the threshold is met
     */
    function _verifyWitnessSignatures(
        bytes32 _messageHash,
        bytes[] memory _signatures,
        address[] memory _witnesses,
        uint256 _requiredThreshold
    )
        internal
        view
        returns (bool)
    {
        require(_requiredThreshold > 0, "BaseGenericPaymentVerifier: Required threshold must be greater than 0");
        require(_requiredThreshold <= _witnesses.length, "BaseGenericPaymentVerifier: Required threshold must be less than or equal to number of witnesses");
        require(_signatures.length > 0, "BaseGenericPaymentVerifier: No signatures");
        
        // Convert to Ethereum signed message hash
        bytes32 ethSignedMessageHash = _messageHash.toEthSignedMessageHash();
        
        // Recover signers from signatures
        address[] memory signers = new address[](_signatures.length);
        uint256 validSigners = 0;
        
        for (uint256 i = 0; i < _signatures.length; i++) {
            address signer = ECDSA.recover(ethSignedMessageHash, _signatures[i]);
            if (signer != address(0)) {
                signers[validSigners] = signer;
                validSigners++;
            }
        }
        
        require(validSigners >= _requiredThreshold, "BaseGenericPaymentVerifier: Fewer signatures than required threshold");
        
        // Track unique signers using an array
        address[] memory seenSigners = new address[](validSigners);
        uint256 validWitnessSignatures = 0;
        
        // Count how many signers are accepted witnesses, skipping duplicates
        for (uint256 i = 0; i < validSigners; i++) {
            address currSigner = signers[i];
            
            // Skip if we've already seen this signer
            if (seenSigners.contains(currSigner)) {
                continue;
            }
            
            // Check if signer is an accepted witness (supports both EOA and smart contract wallets)
            bool isWitness = false;
            if (_witnesses.contains(currSigner)) {
                isWitness = true;
            } else {
                // Check smart contract signature validity for each witness
                for (uint256 j = 0; j < _witnesses.length; j++) {
                    if (_witnesses[j].isValidSignatureNow(ethSignedMessageHash, _signatures[i])) {
                        currSigner = _witnesses[j]; // Use witness address for tracking
                        isWitness = true;
                        break;
                    }
                }
            }
            
            if (isWitness) {
                seenSigners[validWitnessSignatures] = currSigner;
                validWitnessSignatures++;
            }
        }
        
        // Check threshold
        require(
            validWitnessSignatures >= _requiredThreshold,
            "BaseGenericPaymentVerifier: Not enough valid witness signatures"
        );
        
        return true;
    }
    
    /**
     * Modifier to ensure only escrow can call
     */
    modifier onlyEscrow() {
        require(msg.sender == escrow, "Only escrow can call");
        _;
    }
}