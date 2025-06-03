//SPDX-License-Identifier: MIT

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AddressArrayUtils } from "../external/AddressArrayUtils.sol";
import { IPaymentVerifierRegistry } from "../interfaces/IPaymentVerifierRegistry.sol";

pragma solidity ^0.8.18;

contract PaymentVerifierRegistry is Ownable, IPaymentVerifierRegistry {

    using AddressArrayUtils for address[];
    
    /* ============ Events ============ */
    event PaymentVerifierAdded(address indexed verifier);
    event PaymentVerifierRemoved(address indexed verifier);
    event AcceptAllVerifiersUpdated(bool acceptAll);

    /* ============ State Variables ============ */
    bool public acceptAllVerifiers;
    mapping(address => bool) public isWhitelistedVerifier;
    address[] public verifiers;

    /* ============ Constructor ============ */
    constructor() Ownable() {}
    
    /* ============ External Functions ============ */

    /**
     * ONLY OWNER: Adds a payment verifier to the whitelist.
     *
     * @param _verifier   The payment verifier address to add
     */
    function addPaymentVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Payment verifier cannot be zero address");
        require(!isWhitelistedVerifier[_verifier], "Payment verifier already whitelisted");
        
        isWhitelistedVerifier[_verifier] = true;
        verifiers.push(_verifier);
        
        emit PaymentVerifierAdded(_verifier);
    }

    /**
     * ONLY OWNER: Removes a payment verifier from the whitelist.
     *
     * @param _verifier   The payment verifier address to remove
     */
    function removePaymentVerifier(address _verifier) external onlyOwner {
        require(isWhitelistedVerifier[_verifier], "Payment verifier not whitelisted");
        
        isWhitelistedVerifier[_verifier] = false;
        verifiers.removeStorage(_verifier);
        
        emit PaymentVerifierRemoved(_verifier);
    }

    /**
     * ONLY OWNER: Sets whether all payment verifiers can be used without whitelisting.
     *
     * @param _acceptAll   True to accept all payment verifiers, false to require whitelisting
     */
    function setAcceptAllVerifiers(bool _acceptAll) external onlyOwner {
        acceptAllVerifiers = _acceptAll;
        
        emit AcceptAllVerifiersUpdated(_acceptAll);
    }

    /* ============ External View Functions ============ */

    function isAcceptingAllVerifiers() external view returns (bool) {
        return acceptAllVerifiers;
    }

    function getWhitelistedVerifiers() external view returns (address[] memory) {
        return verifiers;
    }
} 