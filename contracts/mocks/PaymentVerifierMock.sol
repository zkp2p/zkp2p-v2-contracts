// SPDX-License-Identifier: MIT

import { IPaymentVerifier } from "../interfaces/IPaymentVerifier.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";
import { StringConversionUtils } from "../lib/StringConversionUtils.sol";
import { Bytes32ArrayUtils } from "../external/Bytes32ArrayUtils.sol";
import { INullifierRegistry } from "../interfaces/INullifierRegistry.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity ^0.8.18;
import "hardhat/console.sol";

abstract contract BasePaymentVerifier is Ownable {

    using Bytes32ArrayUtils for bytes32[];

    /* ============ Events ============ */
    event TimestampBufferSet(uint256 timestampBuffer);
    event CurrencyAdded(bytes32 currencyCode);
    event CurrencyRemoved(bytes32 currencyCode);
    
    /* ============ State Variables ============ */
    address public immutable escrow;
    INullifierRegistry public nullifierRegistry;
    
    uint256 public timestampBuffer;

    bytes32[] internal currencies;
    mapping(bytes32 => bool) public isCurrency;
    
    /* ============ Constructor ============ */
    constructor(
        address _escrow,
        INullifierRegistry _nullifierRegistry,
        uint256 _timestampBuffer,
        bytes32[] memory _currencies
    )
        Ownable()
    {
        escrow = _escrow;
        nullifierRegistry = _nullifierRegistry;
        timestampBuffer = _timestampBuffer;

        for (uint256 i = 0; i < _currencies.length; i++) {
            addCurrency(_currencies[i]);
        }
    }

    /* ============ External Functions ============ */

    /**
     * @notice OWNER ONLY: Adds a currency code to supported currencies
     * @param _currencyCode Currency code to add
     */
    function addCurrency(bytes32 _currencyCode) public onlyOwner {
        require(!isCurrency[_currencyCode], "Currency already added");
        
        currencies.push(_currencyCode);
        isCurrency[_currencyCode] = true;
        
        emit CurrencyAdded(_currencyCode);
    }

    /**
     * @notice OWNER ONLY: Removes a currency code from supported currencies
     * @param _currencyCode Currency code to remove
     */
    function removeCurrency(bytes32 _currencyCode) external onlyOwner {
        require(isCurrency[_currencyCode], "Currency not added");
        
        currencies.removeStorage(_currencyCode);
        isCurrency[_currencyCode] = false;
        
        emit CurrencyRemoved(_currencyCode);
    }

    /**
     * @notice OWNER ONLY: Sets the timestamp buffer for payments. This is the amount of time in seconds
     * that the timestamp can be off by and still be considered valid. Necessary to build in flexibility 
     * with L2 timestamps.
     *
     * @param _timestampBuffer    The timestamp buffer for payments
     */
    function setTimestampBuffer(uint256 _timestampBuffer) external onlyOwner {
        timestampBuffer = _timestampBuffer;
        emit TimestampBufferSet(_timestampBuffer);
    }

    /* ============ External View Functions ============ */

    function getCurrencies() external view returns (bytes32[] memory) {
        return currencies;
    }

    /* ============ Internal Functions ============ */

    function _validateAndAddNullifier(bytes32 _nullifier) internal {
        require(!nullifierRegistry.isNullified(_nullifier), "Nullifier has already been used");
        nullifierRegistry.addNullifier(_nullifier);
    }
}


contract PaymentVerifierMock is BasePaymentVerifier, IPaymentVerifier {

    using StringConversionUtils for string;

    struct PaymentDetails {
        uint256 amount;
        uint256 timestamp;
        bytes32 offRamperId;
        bytes32 fiatCurrency;
        bytes32 intentHash;
    }

    uint256 internal constant PRECISE_UNIT = 1e18;

    /* ============ State Variables ============ */
    bool public shouldVerifyPayment;
    bool public shouldReturnFalse;

    /* ============ Constructor ============ */
    constructor(
        address _escrow,
        INullifierRegistry _nullifierRegistry,
        uint256 _timestampBuffer,
        bytes32[] memory _currencies
    ) BasePaymentVerifier(_escrow, _nullifierRegistry, _timestampBuffer, _currencies) {}

    /* ============ External Functions ============ */

    function setShouldVerifyPayment(bool _shouldVerifyPayment) external {
        shouldVerifyPayment = _shouldVerifyPayment;
    }

    function setShouldReturnFalse(bool _shouldReturnFalse) external {
        shouldReturnFalse = _shouldReturnFalse;
    }

    function extractIntentHash(bytes calldata _proof) external pure returns (bytes32) {
        (
            ,
            ,
            ,
            bytes32 intentHash
        ) = abi.decode(_proof, (uint256, uint256, bytes32, bytes32));

        return intentHash;
    }


    function verifyPayment(
        IPaymentVerifier.VerifyPaymentData calldata _verifyPaymentData
    )
        external
        view 
        override
        returns (PaymentVerificationResult memory)
    {
        PaymentDetails memory paymentDetails = _extractPaymentDetails(_verifyPaymentData.paymentProof);

        if (shouldVerifyPayment) {
            require(paymentDetails.timestamp >= _verifyPaymentData.intentTimestamp, "Payment timestamp is before intent timestamp");
            require(paymentDetails.amount >= 0, "Payment amount cannot be zero");
            require(paymentDetails.offRamperId == _verifyPaymentData.payeeDetails, "Payment offramper does not match intent relayer");
            require(paymentDetails.fiatCurrency == _verifyPaymentData.fiatCurrency, "Payment fiat currency does not match intent fiat currency");
        }
        
        if (shouldReturnFalse) {
            return PaymentVerificationResult({
                success: false,
                intentHash: bytes32(0),
                releaseAmount: 0
            });
        }

        // Calculate release amount based on payment amount and conversion rate
        uint256 releaseAmount = (paymentDetails.amount * PRECISE_UNIT) / _verifyPaymentData.conversionRate;
        
        // Cap release amount at intent amount
        if (releaseAmount > _verifyPaymentData.intentAmount) {
            releaseAmount = _verifyPaymentData.intentAmount;
        }

        return PaymentVerificationResult({
            success: true,
            intentHash: paymentDetails.intentHash,
            releaseAmount: releaseAmount
        });
    }

    function _extractPaymentDetails(bytes calldata _proof) internal pure returns (PaymentDetails memory) {
        (
            uint256 amount,
            uint256 timestamp,
            bytes32 offRamperId,
            bytes32 fiatCurrency,
            bytes32 intentHash
        ) = abi.decode(_proof, (uint256, uint256, bytes32, bytes32, bytes32));

        return PaymentDetails(amount, timestamp, offRamperId, fiatCurrency, intentHash);
    }
}
