//SPDX-License-Identifier: MIT

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Bytes32ArrayUtils } from "../external/Bytes32ArrayUtils.sol";
import { IPaymentVerifierRegistry } from "../interfaces/IPaymentVerifierRegistry.sol";

pragma solidity ^0.8.18;

contract PaymentVerifierRegistry is Ownable, IPaymentVerifierRegistry {

    using Bytes32ArrayUtils for bytes32[];

    /* ============ Structs ============ */

    struct PaymentMethodConfig {
        bool initialized;
        address verifier;
        mapping(bytes32 => bool) isCurrency;
        bytes32[] currencies;
    }
    
    /* ============ Events ============ */

    event PaymentMethodAdded(bytes32 indexed paymentMethod);
    event PaymentMethodRemoved(bytes32 indexed paymentMethod);
    event CurrencyAdded(bytes32 indexed paymentMethod, bytes32 indexed currencyCode);
    event CurrencyRemoved(bytes32 indexed paymentMethod, bytes32 indexed currencyCode);

    /* ============ State Variables ============ */
    mapping(bytes32 => PaymentMethodConfig) public store;
    bytes32[] public paymentMethods;

    /* ============ Constructor ============ */
    constructor() Ownable() {}
    
    /* ============ External Functions ============ */

    /**
     * Adds a new payment method with processors and currencies
     * @param _paymentMethod The payment method hash; Hash the payment method name in lowercase
     * @param _verifier The verifier address to add for this payment method
     * @param _currencies Array of currency code hashes to support
     */
    function addPaymentMethod(
        bytes32 _paymentMethod,
        address _verifier,
        bytes32[] calldata _currencies
    ) external onlyOwner {
        require(!store[_paymentMethod].initialized, "Payment method already exists");
        require(_verifier != address(0), "Invalid verifier");
        require(_currencies.length > 0, "Invalid currencies length");
        
        store[_paymentMethod].initialized = true;
        store[_paymentMethod].verifier = _verifier;
        
        addCurrencies(_paymentMethod, _currencies);

        paymentMethods.push(_paymentMethod);
        
        emit PaymentMethodAdded(_paymentMethod);
    }
    
    /**
     * Removes a payment method and associated configuration
     * @param _paymentMethod The payment method to remove
     * @dev Only callable by owner
     */
    function removePaymentMethod(bytes32 _paymentMethod) external onlyOwner {
        require(store[_paymentMethod].initialized, "Payment method does not exist");
        
        bytes32[] memory currencies = store[_paymentMethod].currencies;
        for (uint256 i = 0; i < currencies.length; i++) {
            _removeCurrency(_paymentMethod, currencies[i]);
        }
        
        delete store[_paymentMethod];
        
        paymentMethods.removeStorage(_paymentMethod);
        
        emit PaymentMethodRemoved(_paymentMethod);
    }

    /**
     * Adds supported currencies for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _currencies Array of currency code hashes (e.g., keccak256("USD"), keccak256("EUR"))
     */
    function addCurrencies(bytes32 _paymentMethod, bytes32[] calldata _currencies) public onlyOwner {
        require(store[_paymentMethod].initialized, "Payment method does not exist");
        require(_currencies.length > 0, "Invalid currencies length");
        
        for (uint256 i = 0; i < _currencies.length; i++) {
            _addCurrency(_paymentMethod, _currencies[i]);
        }
    }
    
    /**
     * Removes supported currencies for a specific payment method
     * @param _paymentMethod The payment method hash
     * @param _currencies Array of currency code hashes to remove
     */
    function removeCurrencies(bytes32 _paymentMethod, bytes32[] calldata _currencies) external onlyOwner {
        require(_currencies.length > 0, "Invalid currencies length");
        
        for (uint256 i = 0; i < _currencies.length; i++) {
            _removeCurrency(_paymentMethod, _currencies[i]);
        }
    }

    /* ============ External View Functions ============ */
    
    function isPaymentMethod(bytes32 _paymentMethod) external view returns (bool) {
        return store[_paymentMethod].initialized;
    }

    function getPaymentMethods() external view returns (bytes32[] memory) {
        return paymentMethods;
    }
    
    function getVerifier(bytes32 _paymentMethod) external view returns (address) {
        return store[_paymentMethod].verifier;
    }

    function isCurrency(bytes32 _paymentMethod, bytes32 _currencyCode) external view returns (bool) {
        return store[_paymentMethod].isCurrency[_currencyCode];
    }
    
    function getCurrencies(bytes32 _paymentMethod) external view returns (bytes32[] memory) {
        return store[_paymentMethod].currencies;
    }

    /* ============ Internal Functions ============ */

    function _addCurrency(bytes32 _paymentMethod, bytes32 _currencyCode) internal {
        require(_currencyCode != bytes32(0), "Invalid currency code");
        require(!store[_paymentMethod].isCurrency[_currencyCode], "Currency already exists");

        store[_paymentMethod].isCurrency[_currencyCode] = true;
        store[_paymentMethod].currencies.push(_currencyCode);
        emit CurrencyAdded(_paymentMethod, _currencyCode);
    }
    
    function _removeCurrency(bytes32 _paymentMethod, bytes32 _currencyCode) internal {
        require(store[_paymentMethod].isCurrency[_currencyCode], "Currency does not exist");

        store[_paymentMethod].isCurrency[_currencyCode] = false;
        store[_paymentMethod].currencies.removeStorage(_currencyCode);
        emit CurrencyRemoved(_paymentMethod, _currencyCode);
    }
} 