// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AddressArrayUtils } from "../external/AddressArrayUtils.sol";
import { Bytes32ArrayUtils } from "../external/Bytes32ArrayUtils.sol";
import { IAttestationVerifier } from "../interfaces/IAttestationVerifier.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";

/**
 * @title BaseUnifiedPaymentVerifier
 * @notice Base contract for unified payment verification that manages configuration for multiple payment methods.
 * 
 * This contract handles:
 * - Payment method configuration (timestamp buffers, zkTLS provider hashes)
 * - zkTLS attestation verification through pluggable attestation verifiers
 * - Support for multiple zkTLS proofs per payment method
 * 
 * @dev This is an abstract contract that must be inherited by concrete implementations.
 *      It replaces the previous BaseReclaimVerifier with a more flexible architecture.
 */
abstract contract BaseUnifiedPaymentVerifier is Ownable {
    
    using AddressArrayUtils for address[];
    using Bytes32ArrayUtils for bytes32[];
    
    /* ============ Constants ============ */

    uint256 internal constant PRECISE_UNIT = 1e18;

    /* ============ Structs ============ */

    struct PaymentMethodStore {
        bool initialized;
        uint256 timestampBuffer;
        mapping(bytes32 => bool) isProviderHash;
        bytes32[] providerHashes;
    }

    /* ============ Events ============ */
    
    event PaymentMethodAdded(bytes32 indexed paymentMethod, uint256 timestampBuffer);
    event PaymentMethodRemoved(bytes32 indexed paymentMethod);
    event TimestampBufferUpdated(bytes32 indexed paymentMethod, uint256 oldBuffer, uint256 newBuffer);
    event ProviderHashAdded(bytes32 indexed paymentMethod, bytes32 indexed providerHash);
    event ProviderHashRemoved(bytes32 indexed paymentMethod, bytes32 indexed providerHash);
    event AttestationVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    /* ============ State Variables ============ */
    
    address public immutable orchestrator;
    INullifierRegistry public immutable nullifierRegistry;
    IAttestationVerifier public attestationVerifier;

    bytes32[] public paymentMethods;
    mapping(bytes32 => PaymentMethodStore) public store;
    
    /* ============ Modifiers ============ */

    /**
     * Modifier to ensure only escrow can call
     */
    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "Only orchestrator can call");
        _;
    }

    /* ============ Constructor ============ */
    
    /**
     * @notice Initializes base payment verifier
     * @param _orchestrator The orchestrator contract address that will be used to verify payments
     * @param _nullifierRegistry The nullifier registry contract that will be used to prevent double-spends
     * @param _attestationVerifier The attestation verifier contract that will be used to verify attestation by the
     * offchain / ZK attestation service
     */
    constructor(
        address _orchestrator,
        INullifierRegistry _nullifierRegistry,
        IAttestationVerifier _attestationVerifier
    ) Ownable() {
        orchestrator = _orchestrator;
        nullifierRegistry = _nullifierRegistry;
        attestationVerifier = _attestationVerifier;
    }
    
    /* ============ External Functions ============ */
    
    /**
     * ONLY OWNER: Adds a new payment method with timestamp buffer and zkTLS provider hashes
     * @param _paymentMethod The payment method hash; Hash the payment method name in lowercase
     * @param _timestampBuffer Payment method-specific timestamp buffer in seconds
     * @param _providerHashes Array of zkTLS provider hashes to store
     */
    function addPaymentMethod(
        bytes32 _paymentMethod,
        uint256 _timestampBuffer,
        bytes32[] calldata _providerHashes
    ) external onlyOwner {
        require(!store[_paymentMethod].initialized, "UPV: Payment method already exists");
        require(_providerHashes.length > 0, "UPV: Invalid length");
        
        store[_paymentMethod].initialized = true;
        store[_paymentMethod].timestampBuffer = _timestampBuffer;
        paymentMethods.push(_paymentMethod);
        
        addProviderHashes(_paymentMethod, _providerHashes);
        
        emit PaymentMethodAdded(_paymentMethod, _timestampBuffer);
    }
    
    /**
     * ONLY OWNER: Removes a payment method and associated configuration
     * @param _paymentMethod The payment method to remove
     * @dev Only callable by owner
     */
    function removePaymentMethod(bytes32 _paymentMethod) external onlyOwner {
        require(store[_paymentMethod].initialized, "UPV: Payment method does not exist");
        
        // Remove all provider hashes
        bytes32[] memory providerHashes = store[_paymentMethod].providerHashes;
        for (uint256 i = 0; i < providerHashes.length; i++) {
            _removeProviderHash(_paymentMethod, providerHashes[i]);
        }
        
        // Remove payment method config
        delete store[_paymentMethod];
        
        // Remove from paymentMethods array
        paymentMethods.removeStorage(_paymentMethod);
        
        emit PaymentMethodRemoved(_paymentMethod);
    }
    
    /**
     * @notice Updates the attestation verifier contract
     * @param _newVerifier The new attestation verifier address
     * @dev Only callable by owner
     */
    function setAttestationVerifier(address _newVerifier) external onlyOwner {
        address oldVerifier = address(attestationVerifier);
        require(_newVerifier != address(0), "UPV: Invalid attestation verifier");
        require(_newVerifier != oldVerifier, "UPV: Same verifier");
        
        attestationVerifier = IAttestationVerifier(_newVerifier);
        emit AttestationVerifierUpdated(oldVerifier, _newVerifier);
    }

    /**
     * Updates the timestamp buffer for a payment method
     * @param _paymentMethod The payment method hash
     * @param _newTimestampBuffer The new timestamp buffer in seconds
     */
    function setTimestampBuffer(bytes32 _paymentMethod, uint256 _newTimestampBuffer) external onlyOwner {
        require(store[_paymentMethod].initialized, "UPV: Payment method does not exist");
        
        uint256 oldBuffer = store[_paymentMethod].timestampBuffer;
        store[_paymentMethod].timestampBuffer = _newTimestampBuffer;
        
        emit TimestampBufferUpdated(_paymentMethod, oldBuffer, _newTimestampBuffer);
    }
                                                                                                               
    /**
     * Batch adds provider hashes for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _providerHashes Array of provider hashes to add
     */
    function addProviderHashes(bytes32 _paymentMethod, bytes32[] calldata _providerHashes) public onlyOwner {
        require(store[_paymentMethod].initialized, "UPV: Payment method does not exist");
        require(_providerHashes.length > 0, "UPV: Invalid length");
        
        for (uint256 i = 0; i < _providerHashes.length; i++) {
            _addProviderHash(_paymentMethod, _providerHashes[i]);
        }
    }
    
    /**
     * Batch removes provider hashes for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _providerHashes Array of provider hashes to remove
     */
    function removeProviderHashes(bytes32 _paymentMethod, bytes32[] calldata _providerHashes) external onlyOwner {
        require(_providerHashes.length > 0, "UPV: Invalid length");
        
        for (uint256 i = 0; i < _providerHashes.length; i++) {
            _removeProviderHash(_paymentMethod, _providerHashes[i]);
        }
    }
    
    /* ============ View Functions ============ */
    
    function getPaymentMethods() external view returns (bytes32[] memory) {
        return paymentMethods;
    }
    
    function isProviderHash(bytes32 _paymentMethod, bytes32 _providerHash) external view returns (bool) {
        return store[_paymentMethod].isProviderHash[_providerHash];
    }

    function getTimestampBuffer(bytes32 _paymentMethod) external view returns (uint256) {
        require(store[_paymentMethod].initialized, "UPV: Payment method does not exist");
        return store[_paymentMethod].timestampBuffer;
    }
    
    function getProviderHashes(bytes32 _paymentMethod) external view returns (bytes32[] memory) {
        require(store[_paymentMethod].initialized, "UPV: Payment method does not exist");
        return store[_paymentMethod].providerHashes;
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
     * Gets the payment method store for a given payment method
     * @param paymentMethod The payment method to get the store for
     * @return _store The payment method store
     */
    function _getPaymentMethodStore(
        bytes32 paymentMethod
    ) internal view returns (PaymentMethodStore storage _store) {
        _store = store[paymentMethod];

        require(_store.initialized, "UPV: Payment method does not exist");
        return _store;
    }

    /**
     * Calculates the release amount based on the actual payment amount and conversion rate.
     * Caps the release amount at the intent amount.
     * NOTES:
     * - Assumes that _conversionRate is not zero and is in the same precision as PRECISE_UNIT.
     * - Function might overflow if _paymentAmount is very very large.
     * 
     * @param _paymentAmount The actual payment amount.
     * @param _conversionRate The conversion rate of the deposit token to the fiat currency.
     * @param _intentAmount The max amount of tokens the offchain payer wants to take.
     * @return The release amount.
     */
    function _calculateReleaseAmount(uint256 _paymentAmount, uint256 _conversionRate, uint256 _intentAmount) internal pure returns (uint256) {
        // releaseAmount = paymentAmount / conversionRate
        uint256 releaseAmount = (_paymentAmount * PRECISE_UNIT) / _conversionRate;
        
        // Ensure release amount doesn't exceed the intent amount (cap at intent amount)
        if (releaseAmount > _intentAmount) {
            releaseAmount = _intentAmount;
        }

        return releaseAmount;
    }

    /* ============ Helper Internal Functions ============ */

    function _addProviderHash(bytes32 _paymentMethod, bytes32 _providerHash) internal {
        require(_providerHash != bytes32(0), "UPV: Invalid provider hash");
        require(!store[_paymentMethod].isProviderHash[_providerHash], "UPV: Provider hash already exists");

        store[_paymentMethod].isProviderHash[_providerHash] = true;
        store[_paymentMethod].providerHashes.push(_providerHash);
        emit ProviderHashAdded(_paymentMethod, _providerHash);
    }

    function _removeProviderHash(bytes32 _paymentMethod, bytes32 _providerHash) internal {
        require(store[_paymentMethod].isProviderHash[_providerHash], "UPV: Provider hash does not exist");

        store[_paymentMethod].isProviderHash[_providerHash] = false;
        store[_paymentMethod].providerHashes.removeStorage(_providerHash);
        emit ProviderHashRemoved(_paymentMethod, _providerHash);
    }

}