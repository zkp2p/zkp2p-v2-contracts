// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AddressArrayUtils } from "../external/AddressArrayUtils.sol";
import { Bytes32ArrayUtils } from "../external/Bytes32ArrayUtils.sol";
import { IBaseUnifiedPaymentVerifier } from "./IBaseUnifiedPaymentVerifier.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";
import { ThresholdSigVerifierUtils } from "../lib/ThresholdSigVerifierUtils.sol";

abstract contract BaseUnifiedPaymentVerifier is IBaseUnifiedPaymentVerifier, Ownable {
    
    using AddressArrayUtils for address[];
    using Bytes32ArrayUtils for bytes32[];
    
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
    mapping(bytes32 => IBaseUnifiedPaymentVerifier.PaymentMethodConfig) public paymentMethodConfig;
    
    // Array of payment method hashes for enumeration
    bytes32[] public paymentMethods;
    
    /* ============ Modifiers ============ */

    /**
     * Modifier to ensure only escrow can call
     */
    modifier onlyEscrow() {
        require(msg.sender == escrow, "Only escrow can call");
        _;
    }

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
        require(_escrow != address(0), "BUPN: Invalid escrow");
        require(address(_nullifierRegistry) != address(0), "BUPN: Invalid nullifier registry");
        require(_minWitnessSignatures > 0, "BUPN: Min signatures must be > 0");
        
        escrow = _escrow;
        nullifierRegistry = _nullifierRegistry;
        minWitnessSignatures = _minWitnessSignatures;
    }
    
    /* ============ External Functions ============ */
    
        /**
     * Adds a new payment method with processors and currencies
     * @param _paymentMethod The payment method hash
     * @param _timestampBuffer Payment method-specific timestamp buffer in seconds
     * @param _processorHashes Array of processor hashes to authorize
     * @param _currencyCodes Array of currency code hashes to support
     */
    function addPaymentMethod(
        bytes32 _paymentMethod,
        uint256 _timestampBuffer,
        bytes32[] calldata _processorHashes,
        bytes32[] calldata _currencyCodes
    ) external onlyOwner {
        require(!paymentMethodConfig[_paymentMethod].initialized, "BUPN: Payment method already exists");
        require(_processorHashes.length > 0, "BUPN: Must provide at least one processor");
        require(_currencyCodes.length > 0, "BUPN: Must provide at least one currency");
        
        // Initialize payment method
        paymentMethodConfig[_paymentMethod].initialized = true;
        paymentMethodConfig[_paymentMethod].timestampBuffer = _timestampBuffer;
        paymentMethods.push(_paymentMethod);
        
        // Add processors using batch function
        addProcessorHashes(_paymentMethod, _processorHashes);
        
        // Add currencies using batch function
        addCurrencies(_paymentMethod, _currencyCodes);
        
        emit PaymentMethodAdded(_paymentMethod, _timestampBuffer);
    }
    
    /**
     * Removes a payment method and all associated data
     * @param _paymentMethod The payment method hash to remove
     */
    function removePaymentMethod(bytes32 _paymentMethod) external onlyOwner {
        require(paymentMethodConfig[_paymentMethod].initialized, "BUPN: Payment method does not exist");
        
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
     * Updates the minimum witness signatures required
     * @param _newMinWitnessSignatures The new minimum witness signatures
     */
    function setMinWitnessSignatures(uint256 _newMinWitnessSignatures) external onlyOwner {
        require(_newMinWitnessSignatures > 0, "BUPN: Min signatures must be > 0");
        require(_newMinWitnessSignatures != minWitnessSignatures, "BUPN: Same value");
        
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
        require(paymentMethodConfig[_paymentMethod].initialized, "BUPN: Payment method does not exist");
        
        uint256 oldBuffer = paymentMethodConfig[_paymentMethod].timestampBuffer;
        paymentMethodConfig[_paymentMethod].timestampBuffer = _newTimestampBuffer;
        
        emit TimestampBufferSet(_paymentMethod, oldBuffer, _newTimestampBuffer);
    }
    
    /**
     * Authorizes processor hashes for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _processorHashes Array of processor provider hashes to authorize
     */
    function addProcessorHashes(bytes32 _paymentMethod, bytes32[] calldata _processorHashes) public onlyOwner {
        require(paymentMethodConfig[_paymentMethod].initialized, "BUPN: Payment method does not exist");
        require(_processorHashes.length > 0, "BUPN: Must provide at least one processor");
        
        for (uint256 i = 0; i < _processorHashes.length; i++) {
            bytes32 processorHash = _processorHashes[i];
            require(processorHash != bytes32(0), "BUPN: Invalid processor hash");
            require(!paymentMethodConfig[_paymentMethod].processorHashExists[processorHash], "BUPN: Already authorized");
            
            paymentMethodConfig[_paymentMethod].processorHashExists[processorHash] = true;
            paymentMethodConfig[_paymentMethod].processorHashes.push(processorHash);
            emit ProcessorHashAdded(_paymentMethod, processorHash);
        }
    }
    
    /**
     * Revokes processor hashes for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _processorHashes Array of processor provider hashes to revoke
     */
    function removeProcessorHashes(bytes32 _paymentMethod, bytes32[] calldata _processorHashes) external onlyOwner {
        require(_processorHashes.length > 0, "BUPN: Must provide at least one processor");
        
        for (uint256 i = 0; i < _processorHashes.length; i++) {
            bytes32 processorHash = _processorHashes[i];
            require(paymentMethodConfig[_paymentMethod].processorHashExists[processorHash], "BUPN: Not authorized");
            
            paymentMethodConfig[_paymentMethod].processorHashExists[processorHash] = false;
            paymentMethodConfig[_paymentMethod].processorHashes.removeStorage(processorHash);
            emit ProcessorHashRemoved(_paymentMethod, processorHash);
        }
    }
    
    /**
     * Adds supported currencies for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _currencyCodes Array of currency code hashes (e.g., keccak256("USD"), keccak256("EUR"))
     */
    function addCurrencies(bytes32 _paymentMethod, bytes32[] calldata _currencyCodes) public onlyOwner {
        require(paymentMethodConfig[_paymentMethod].initialized, "BUPN: Payment method does not exist");
        require(_currencyCodes.length > 0, "BUPN: Must provide at least one currency");
        
        for (uint256 i = 0; i < _currencyCodes.length; i++) {
            bytes32 currencyCode = _currencyCodes[i];
            require(currencyCode != bytes32(0), "BUPN: Invalid currency code");
            require(!paymentMethodConfig[_paymentMethod].currencyExists[currencyCode], "BUPN: Currency already supported");
            
            paymentMethodConfig[_paymentMethod].currencyExists[currencyCode] = true;
            paymentMethodConfig[_paymentMethod].currencies.push(currencyCode);
            emit CurrencyAdded(_paymentMethod, currencyCode);
        }
    }
    
    /**
     * Removes supported currencies for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _currencyCodes Array of currency code hashes to remove
     */
    function removeCurrencies(bytes32 _paymentMethod, bytes32[] calldata _currencyCodes) external onlyOwner {
        require(_currencyCodes.length > 0, "BUPN: Must provide at least one currency");
        
        for (uint256 i = 0; i < _currencyCodes.length; i++) {
            bytes32 currencyCode = _currencyCodes[i];
            require(paymentMethodConfig[_paymentMethod].currencyExists[currencyCode], "BUPN: Currency not supported");
            
            paymentMethodConfig[_paymentMethod].currencyExists[currencyCode] = false;
            paymentMethodConfig[_paymentMethod].currencies.removeStorage(currencyCode);
            emit CurrencyRemoved(_paymentMethod, currencyCode);
        }
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
        require(paymentMethodConfig[_paymentMethod].initialized, "BUPN: Payment method does not exist");
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
     * @param _currencyCode The currency code hash to check
     * @return Whether the currency is supported
     */
    function isCurrency(bytes32 _paymentMethod, bytes32 _currencyCode) external view returns (bool) {
        return paymentMethodConfig[_paymentMethod].currencyExists[_currencyCode];
    }
    
    /**
     * Gets all processor hashes for a payment method
     * @param _paymentMethod The payment method hash
     * @return Array of processor hashes
     */
    function getProcessorHashes(bytes32 _paymentMethod) external view returns (bytes32[] memory) {
        require(paymentMethodConfig[_paymentMethod].initialized, "BUPN: Payment method does not exist");
        return paymentMethodConfig[_paymentMethod].processorHashes;
    }
    
    /**
     * Gets all supported currencies for a payment method
     * @param _paymentMethod The payment method hash
     * @return Array of currency codes (as bytes32)
     */
    function getCurrencies(bytes32 _paymentMethod) external view returns (bytes32[] memory) {
        require(paymentMethodConfig[_paymentMethod].initialized, "BUPN: Payment method does not exist");
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
        
        require(witnesses.length > 0, "BUPN: No witnesses provided");
        require(witnesses.length >= minWitnessSignatures, "BUPN: Not enough witnesses");
        
        // Check for duplicates
        for (uint256 i = 0; i < witnesses.length; i++) {
            for (uint256 j = i + 1; j < witnesses.length; j++) {
                require(witnesses[i] != witnesses[j], "BUPN: Duplicate witnesses");
            }
        }
        
        return witnesses;
    }
    
    /**
     * Verifies that signatures meet the required threshold from accepted witnesses
     * 
     * @param _digest The message digest to verify (EIP-712 or EIP-191)
     * @param _signatures Array of signatures (must have at least minWitnessSignatures)
     * @param _witnesses Array of accepted witness addresses
     * @return bool Whether the threshold is met
     */
    function _verifyWitnessSignatures(
        bytes32 _digest,
        bytes[] memory _signatures,
        address[] memory _witnesses
    )
        internal
        view
        returns (bool)
    {
        return ThresholdSigVerifierUtils.verifyWitnessSignatures(
            _digest, 
            _signatures, 
            _witnesses, 
            minWitnessSignatures
        );
    }
}