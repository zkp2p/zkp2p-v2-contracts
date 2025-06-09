//SPDX-License-Identifier: MIT

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AddressArrayUtils } from "../../external/AddressArrayUtils.sol";

pragma solidity ^0.8.18;

interface IPaymentVerifierRegistry {
    function isWhitelistedVerifier(address _verifier) external view returns (bool);
    function getVerifierFeeShare(address _verifier) external view returns (uint256);
    function isAcceptingAllVerifiers() external view returns (bool);
    function getWhitelistedVerifiers() external view returns (address[] memory);
}

contract PaymentVerifierRegistry is Ownable, IPaymentVerifierRegistry {

    using AddressArrayUtils for address[];
    
    /* ============ Events ============ */
    event PaymentVerifierAdded(address indexed verifier, uint256 feeShare);
    event PaymentVerifierRemoved(address indexed verifier);
    event PaymentVerifierFeeShareUpdated(address indexed verifier, uint256 feeShare);
    event AcceptAllVerifiersUpdated(bool acceptAll);

    /* ============ State Variables ============ */
    bool public acceptAllVerifiers;
    mapping(address => bool) public whitelistedVerifiers;
    mapping(address => uint256) public verifierFeeShare;
    address[] public verifiers;

    /* ============ Constructor ============ */
    constructor(address _owner) Ownable() {
        transferOwnership(_owner);
    }
    
    /* ============ External Functions ============ */

    /**
     * ONLY OWNER: Adds a payment verifier to the whitelist with a fee share.
     *
     * @param _verifier   The payment verifier address to add
     * @param _feeShare   The fee share for the payment verifier
     */
    function addPaymentVerifier(address _verifier, uint256 _feeShare) external onlyOwner {
        require(_verifier != address(0), "Payment verifier cannot be zero address");
        require(!whitelistedVerifiers[_verifier], "Payment verifier already whitelisted");
        require(_feeShare <= 1e18, "Fee share cannot exceed 100%");
        
        whitelistedVerifiers[_verifier] = true;
        verifierFeeShare[_verifier] = _feeShare;
        verifiers.push(_verifier);
        
        emit PaymentVerifierAdded(_verifier, _feeShare);
    }

    /**
     * ONLY OWNER: Removes a payment verifier from the whitelist.
     *
     * @param _verifier   The payment verifier address to remove
     */
    function removePaymentVerifier(address _verifier) external onlyOwner {
        require(whitelistedVerifiers[_verifier], "Payment verifier not whitelisted");
        
        whitelistedVerifiers[_verifier] = false;
        delete verifierFeeShare[_verifier];
        verifiers.removeStorage(_verifier);
        
        emit PaymentVerifierRemoved(_verifier);
    }

    /**
     * ONLY OWNER: Updates the fee share for a payment verifier.
     *
     * @param _verifier   The payment verifier address to update
     * @param _feeShare   The new fee share
     */
    function updateVerifierFeeShare(address _verifier, uint256 _feeShare) external onlyOwner {
        require(whitelistedVerifiers[_verifier], "Payment verifier not whitelisted");
        require(_feeShare <= 1e18, "Fee share cannot exceed 100%");

        verifierFeeShare[_verifier] = _feeShare;
        
        emit PaymentVerifierFeeShareUpdated(_verifier, _feeShare);
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

    function isWhitelistedVerifier(address _verifier) external view returns (bool) {
        return whitelistedVerifiers[_verifier];
    }

    function getVerifierFeeShare(address _verifier) external view returns (uint256) {
        return verifierFeeShare[_verifier];
    }

    function isAcceptingAllVerifiers() external view returns (bool) {
        return acceptAllVerifiers;
    }

    function getWhitelistedVerifiers() external view returns (address[] memory) {
        return verifiers;
    }
} 