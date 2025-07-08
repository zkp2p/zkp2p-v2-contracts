//SPDX-License-Identifier: MIT

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AddressArrayUtils } from "../external/AddressArrayUtils.sol";
import { IEscrowRegistry } from "../interfaces/IEscrowRegistry.sol";

pragma solidity ^0.8.18;

contract EscrowRegistry is Ownable, IEscrowRegistry {

    using AddressArrayUtils for address[];
    
    /* ============ Events ============ */
    event EscrowAdded(address indexed escrow);
    event EscrowRemoved(address indexed escrow);
    event AcceptAllEscrowsUpdated(bool acceptAll);

    /* ============ State Variables ============ */
    bool public acceptAllEscrows;
    mapping(address => bool) public isWhitelistedEscrow;
    address[] public escrows;

    /* ============ Constructor ============ */
    constructor() Ownable() {}
    
    /* ============ External Functions ============ */

    /**
     * ONLY OWNER: Adds an escrow to the whitelist.
     *
     * @param _escrow   The escrow address to add
     */
    function addEscrow(address _escrow) external onlyOwner {
        require(_escrow != address(0), "Escrow cannot be zero address");
        require(!isWhitelistedEscrow[_escrow], "Escrow already whitelisted");
        
        isWhitelistedEscrow[_escrow] = true;
        escrows.push(_escrow);
        
        emit EscrowAdded(_escrow);
    }

    /**
     * ONLY OWNER: Removes an escrow from the whitelist.
     *
     * @param _escrow   The escrow address to remove
     */
    function removeEscrow(address _escrow) external onlyOwner {
        require(isWhitelistedEscrow[_escrow], "Escrow not whitelisted");
        
        isWhitelistedEscrow[_escrow] = false;
        escrows.removeStorage(_escrow);
        
        emit EscrowRemoved(_escrow);
    }

    /**
     * ONLY OWNER: Sets whether all escrows can be used without whitelisting.
     *
     * @param _acceptAll   True to accept all escrows, false to require whitelisting
     */
    function setAcceptAllEscrows(bool _acceptAll) external onlyOwner {
        acceptAllEscrows = _acceptAll;
        
        emit AcceptAllEscrowsUpdated(_acceptAll);
    }

    /* ============ External View Functions ============ */

    function isAcceptingAllEscrows() external view returns (bool) {
        return acceptAllEscrows;
    }

    function getWhitelistedEscrows() external view returns (address[] memory) {
        return escrows;
    }
}