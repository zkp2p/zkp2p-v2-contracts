// SPDX-License-Identifier: MIT

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { IBasePaymentVerifier } from "./interfaces/IBasePaymentVerifier.sol";
import { INullifierRegistry } from "./nullifierRegistries/INullifierRegistry.sol";
import { StringArrayUtils } from "../external/StringArrayUtils.sol";

pragma solidity ^0.8.18;

contract BasePaymentVerifier is Ownable, IBasePaymentVerifier {

    using StringArrayUtils for string[];

    /* ============ Events ============ */
    event TimestampBufferSet(uint256 timestampBuffer);
    event CurrencyAdded(string currencyCode);
    event CurrencyRemoved(string currencyCode);
    
    /* ============ State Variables ============ */
    address public immutable escrow;
    INullifierRegistry public nullifierRegistry;
    
    uint256 public timestampBuffer;

    string[] internal currencies;
    mapping(string => bool) public isCurrency;
    
    /* ============ Constructor ============ */
    constructor(
        address _escrow,
        INullifierRegistry _nullifierRegistry,
        uint256 _timestampBuffer,
        string[] memory _currencies
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
    function addCurrency(string memory _currencyCode) public onlyOwner {
        require(!isCurrency[_currencyCode], "Currency already added");
        
        currencies.push(_currencyCode);
        isCurrency[_currencyCode] = true;
        
        emit CurrencyAdded(_currencyCode);
    }

    /**
     * @notice OWNER ONLY: Removes a currency code from supported currencies
     * @param _currencyCode Currency code to remove
     */
    function removeCurrency(string calldata _currencyCode) external onlyOwner {
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

    function getCurrencies() external view returns (string[] memory) {
        return currencies;
    }

    /* ============ Internal Functions ============ */

    function _validateAndAddNullifier(bytes32 _nullifier) internal {
        require(!nullifierRegistry.isNullified(_nullifier), "Nullifier has already been used");
        nullifierRegistry.addNullifier(_nullifier);
    }
}
