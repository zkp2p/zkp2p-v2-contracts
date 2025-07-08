//SPDX-License-Identifier: MIT

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AddressArrayUtils } from "../external/AddressArrayUtils.sol";
import { IRelayerRegistry } from "../interfaces/IRelayerRegistry.sol";

pragma solidity ^0.8.18;

contract RelayerRegistry is Ownable, IRelayerRegistry {

    using AddressArrayUtils for address[];
    
    /* ============ Events ============ */
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    

    /* ============ State Variables ============ */
    mapping(address => bool) public isWhitelistedRelayer;
    address[] public relayers;

    /* ============ Constructor ============ */
    constructor() Ownable() {}
    
    /* ============ External Functions ============ */

    /**
     * ONLY OWNER: Adds a relayer to the whitelist.
     *
     * @param _relayer   The relayer address to add
     */
    function addRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "Relayer cannot be zero address");
        require(!isWhitelistedRelayer[_relayer], "Relayer already whitelisted");
        
        isWhitelistedRelayer[_relayer] = true;
        relayers.push(_relayer);
        
        emit RelayerAdded(_relayer);
    }

    /**
     * ONLY OWNER: Removes a relayer from the whitelist.
     *
     * @param _relayer   The relayer address to remove
     */
    function removeRelayer(address _relayer) external onlyOwner {
        require(isWhitelistedRelayer[_relayer], "Relayer not whitelisted");
        
        isWhitelistedRelayer[_relayer] = false;
        relayers.removeStorage(_relayer);
        
        emit RelayerRemoved(_relayer);
    }



    /* ============ External View Functions ============ */

    function getWhitelistedRelayers() external view returns (address[] memory) {
        return relayers;
    }
} 