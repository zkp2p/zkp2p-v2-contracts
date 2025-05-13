// SPDX-License-Identifier: MIT

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { DateParsing } from "../lib/DateParsing.sol";
import { ClaimVerifier } from "../lib/ClaimVerifier.sol";
import { StringConversionUtils } from "../lib/StringConversionUtils.sol";
import { Bytes32ConversionUtils } from "../lib/Bytes32ConversionUtils.sol";

import { BasePaymentVerifier } from "./BaseVerifiers/BasePaymentVerifier.sol";
import { INullifierRegistry } from "./nullifierRegistries/INullifierRegistry.sol";
import { IPaymentVerifier } from "./interfaces/IPaymentVerifier.sol";
import { IReclaimVerifier } from "./interfaces/IReclaimVerifier.sol";
pragma solidity ^0.8.18;

/*
 * @notice ZelleBaseVerifier is a base contract for verifying Zelle payments. The Zelle payment method is a 
 * collection of different payment methods, each with their own verification logic. This verifier is added 
 * to Escrow by sellers who want to receive Zelle payments. It manages currencies (only USD) and payment method 
 * to verifier mappings and DELEGATES VERIFICATION to the appropriate verifier based on the payment method.
 */
contract ZelleBaseVerifier is IPaymentVerifier, BasePaymentVerifier {

    /* ============ Events ============ */  
    
    event PaymentMethodVerifierSet(uint8 paymentMethod, address verifier);
    event PaymentMethodVerifierRemoved(uint8 paymentMethod);

    /* ============ State Variables ============ */
    
    mapping(uint8 => address) public paymentMethodToVerifier;
    
    /* ============ Constructor ============ */
    constructor(
        address _escrow,
        INullifierRegistry _nullifierRegistry,
        uint256 _timestampBuffer,
        bytes32[] memory _currencies
    )   
        BasePaymentVerifier(
            _escrow, 
            _nullifierRegistry, 
            _timestampBuffer, 
            _currencies
        )
    { }

    /* ============ External Functions ============ */

    /**
     * ONLY RAMP: Verifies a reclaim proof of an offchain Zelle payment. Because Zelle supports multiple payment methods 
     * (each with their own verification logic), the _verifyPaymentData.data field should contain the payment method.
     *
     * @param _verifyPaymentData Payment proof, intent details, and payment method required for verification
     */
    function verifyPayment(
        IPaymentVerifier.VerifyPaymentData memory _verifyPaymentData
    )
        external 
        override
        returns (bool, bytes32)
    {
        require(msg.sender == escrow, "Only escrow can call");

        (
            IReclaimVerifier.ReclaimProof memory proof,
            uint8 paymentMethod
        ) = abi.decode(_verifyPaymentData.paymentProof, (IReclaimVerifier.ReclaimProof, uint8));

        address verifier = paymentMethodToVerifier[paymentMethod];
        require(verifier != address(0), "Verifier not set");

        // Strip the payment method from the proof
        bytes memory paymentProof = abi.encode(proof);
        _verifyPaymentData.paymentProof = paymentProof;

        return IPaymentVerifier(verifier).verifyPayment(_verifyPaymentData);
    }

    /* ============ Governance Functions ============ */

    function setPaymentMethodVerifier(uint8 _paymentMethod, address _verifier) external onlyOwner {
        // Todo: Can _paymentMethod be 0?
        require(_verifier != address(0), "Invalid verifier address");

        paymentMethodToVerifier[_paymentMethod] = _verifier;
        emit PaymentMethodVerifierSet(_paymentMethod, _verifier);
    }

    function removePaymentMethodVerifier(uint8 _paymentMethod) external onlyOwner {
        require(paymentMethodToVerifier[_paymentMethod] != address(0), "Verifier not set");

        delete paymentMethodToVerifier[_paymentMethod];
        emit PaymentMethodVerifierRemoved(_paymentMethod);
    }    
}
