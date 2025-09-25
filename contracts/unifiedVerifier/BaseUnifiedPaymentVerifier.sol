// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Bytes32ArrayUtils } from "../external/Bytes32ArrayUtils.sol";
import { IAttestationVerifier } from "../interfaces/IAttestationVerifier.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";

/**
 * @title BaseUnifiedPaymentVerifier
 * @notice Base contract for unified payment verification that manages configuration for multiple payment methods.
 * 
 * This contract handles:
 * - Supported payment methods
 * - Attestation verification through pluggable attestation verifiers
 * 
 * @dev This is an abstract contract that must be inherited by concrete implementations.
 *      It replaces the previous BaseReclaimVerifier with a more flexible architecture.
 */
abstract contract BaseUnifiedPaymentVerifier is Ownable {
    
    using Bytes32ArrayUtils for bytes32[];
    
    /* ============ Constants ============ */

    uint256 internal constant PRECISE_UNIT = 1e18;

    /* ============ Events ============ */
    
    event PaymentMethodAdded(bytes32 indexed paymentMethod);
    event PaymentMethodRemoved(bytes32 indexed paymentMethod);
    event AttestationVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    /* ============ State Variables ============ */
    
    address public immutable orchestrator;
    INullifierRegistry public immutable nullifierRegistry;
    IAttestationVerifier public attestationVerifier;

    bytes32[] public paymentMethods;
    mapping(bytes32 => bool) public isPaymentMethod;
    
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
     * ONLY OWNER: Adds a new payment method with timestamp buffer
     * @param _paymentMethod The payment method hash; Hash the payment method name in lowercase
     */
    function addPaymentMethod(bytes32 _paymentMethod) external onlyOwner {
        require(!isPaymentMethod[_paymentMethod], "UPV: Payment method already exists");
        
        isPaymentMethod[_paymentMethod] = true;
        paymentMethods.push(_paymentMethod);
        
        emit PaymentMethodAdded(_paymentMethod);
    }
    
    /**
     * ONLY OWNER: Removes a payment method and associated configuration
     * @param _paymentMethod The payment method to remove
     */
    function removePaymentMethod(bytes32 _paymentMethod) external onlyOwner {
        require(isPaymentMethod[_paymentMethod], "UPV: Payment method does not exist");
        
        delete isPaymentMethod[_paymentMethod];
        paymentMethods.removeStorage(_paymentMethod);
        
        emit PaymentMethodRemoved(_paymentMethod);
    }
    
    /**
     * @notice Updates the attestation verifier contract
     * @param _newVerifier The new attestation verifier address
     */
    function setAttestationVerifier(address _newVerifier) external onlyOwner {
        address oldVerifier = address(attestationVerifier);
        require(_newVerifier != address(0), "UPV: Invalid attestation verifier");
        require(_newVerifier != oldVerifier, "UPV: Same verifier");
        
        attestationVerifier = IAttestationVerifier(_newVerifier);
        emit AttestationVerifierUpdated(oldVerifier, _newVerifier);
    }
                                                                                                               
    
    /* ============ View Functions ============ */
    
    function getPaymentMethods() external view returns (bytes32[] memory) {
        return paymentMethods;
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
