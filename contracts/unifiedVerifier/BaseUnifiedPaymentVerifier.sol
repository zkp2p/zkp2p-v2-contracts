// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AddressArrayUtils } from "../external/AddressArrayUtils.sol";
import { Bytes32ArrayUtils } from "../external/Bytes32ArrayUtils.sol";
import { IBaseUnifiedPaymentVerifier } from "./IBaseUnifiedPaymentVerifier.sol";
import { IAttestationVerifier } from "./IAttestationVerifier.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";
import { WitnessAttestationVerifier } from "./WitnessAttestationVerifier.sol";

abstract contract BaseUnifiedPaymentVerifier is IBaseUnifiedPaymentVerifier, Ownable {
    
    using AddressArrayUtils for address[];
    using Bytes32ArrayUtils for bytes32[];
    
    /* ============ Events ============ */
    
    event AttestationVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    
    // todo: emit the payment method details
    event PaymentMethodAdded(bytes32 indexed paymentMethod, uint256 timestampBuffer);
    event PaymentMethodRemoved(bytes32 indexed paymentMethod);
    // todo: rename to TimestampBufferUpdated
    event TimestampBufferSet(bytes32 indexed paymentMethod, uint256 oldBuffer, uint256 newBuffer);
    
    event ProcessorHashAdded(bytes32 indexed paymentMethod, bytes32 indexed processorHash);
    event ProcessorHashRemoved(bytes32 indexed paymentMethod, bytes32 indexed processorHash);
    event CurrencyAdded(bytes32 indexed paymentMethod, bytes32 indexed currencyCode);
    event CurrencyRemoved(bytes32 indexed paymentMethod, bytes32 indexed currencyCode);
    
    /* ============ State Variables ============ */
    
    address public immutable escrow;
    INullifierRegistry public immutable nullifierRegistry;
    
    // The attestation verifier used for verifying attestation by the attestation service / attestor
    IAttestationVerifier public attestationVerifier;
    
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
     * @notice Initializes base payment verifier
     * @param _escrow The escrow contract address
     * @param _nullifierRegistry The nullifier registry contract
     * @param _attestationVerifier The attestation verifier contract
     */
    constructor(
        address _escrow,
        INullifierRegistry _nullifierRegistry,
        IAttestationVerifier _attestationVerifier
    ) Ownable() {
        require(_escrow != address(0), "BUPN: Invalid escrow");
        require(address(_nullifierRegistry) != address(0), "BUPN: Invalid nullifier registry");
        
        escrow = _escrow;
        nullifierRegistry = _nullifierRegistry;
        
        // Deploy and set the default witness attestation verifier
        attestationVerifier = _attestationVerifier;
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
     * @notice Updates the attestation verifier contract
     * @param _newAttestationVerifier The new attestation verifier address
     * @dev Only callable by owner
     */
    function setAttestationVerifier(IAttestationVerifier _newAttestationVerifier) external onlyOwner {
        require(address(_newAttestationVerifier) != address(0), "BUPN: Invalid attestation verifier");
        require(address(_newAttestationVerifier) != address(attestationVerifier), "BUPN: Same verifier");
        
        address oldVerifier = address(attestationVerifier);
        attestationVerifier = _newAttestationVerifier;
        emit AttestationVerifierUpdated(oldVerifier, address(_newAttestationVerifier));
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
}