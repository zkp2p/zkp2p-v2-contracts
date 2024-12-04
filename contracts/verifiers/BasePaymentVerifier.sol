// SPDX-License-Identifier: MIT

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { IBasePaymentVerifier } from "./interfaces/IBasePaymentVerifier.sol";
import { INullifierRegistry } from "./nullifierRegistries/INullifierRegistry.sol";
import { Bytes32ArrayUtils } from "../external/Bytes32ArrayUtils.sol";

pragma solidity ^0.8.18;

contract BasePaymentVerifier is Ownable, IBasePaymentVerifier {

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
