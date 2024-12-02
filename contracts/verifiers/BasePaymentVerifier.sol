// SPDX-License-Identifier: MIT

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { INullifierRegistry } from "./nullifierRegistries/INullifierRegistry.sol";

pragma solidity ^0.8.18;

abstract contract BasePaymentVerifier is Ownable {

    /* ============ Events ============ */
    event MaxIntentTakeAmountSet(uint256 maxIntentTakeAmount);
    
    /* ============ State Variables ============ */
    address public immutable ramp;
    INullifierRegistry public nullifierRegistry;
    
    uint256 public timestampBuffer;
    
    /* ============ Constructor ============ */
    constructor(
        address _ramp,
        INullifierRegistry _nullifierRegistry,
        uint256 _timestampBuffer
    )
        Ownable()
    {
        ramp = _ramp;
        nullifierRegistry = _nullifierRegistry;

        timestampBuffer = _timestampBuffer;
    }

    /* ============ External Functions ============ */
    /**
     * @notice OWNER ONLY: Sets the timestamp buffer for payments. This is the amount of time in seconds
     * that the timestamp can be off by and still be considered valid. Necessary to build in flexibility 
     * with L2 timestamps.
     *
     * @param _timestampBuffer    The timestamp buffer for payments
     */
    function setTimestampBuffer(uint256 _timestampBuffer) external onlyOwner {
        timestampBuffer = _timestampBuffer;
    }

    /* ============ Internal Functions ============ */

    function _validateAndAddNullifier(bytes32 _nullifier) internal {
        require(!nullifierRegistry.isNullified(_nullifier), "Nullifier has already been used");
        nullifierRegistry.addNullifier(_nullifier);
    }
}
