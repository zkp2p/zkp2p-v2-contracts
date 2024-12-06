// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEscrow {
    
    /* ============ Structs ============ */

    struct Range {
        uint256 min;                                // Minimum value
        uint256 max;                                // Maximum value
    }

    struct Deposit {
        address depositor;                          // Address of depositor
        IERC20 token;                               // Address of deposit token
        uint256 amount;                             // Amount of deposit token
        Range intentAmountRange;                    // Range of take amount per intent
        // Deposit state
        bool acceptingIntents;                      // State: True if the deposit is accepting intents, False otherwise
        uint256 remainingDeposits;                  // State: Amount of remaining deposited liquidity
        uint256 outstandingIntentAmount;            // State: Amount of outstanding intents (may include expired intents)
        bytes32[] intentHashes;                     // State: Array of hashes of all open intents (may include some expired if not pruned)
    }

    struct Currency {
        bytes32 code;                               // Currency code (keccak256 hash of the currency code)
        uint256 conversionRate;                     // Conversion rate of deposit token to fiat currency
    }

    struct DepositVerifierData {
        address intentGatingService;                // Public key of gating service that will be used to verify intents
        bytes32 payeeDetailsHash;                   // Hash of payee details stored offchain
        bytes data;                                 // Verification Data: Additional data used for payment verification; Can hold attester address
                                                    // in case of TLS proofs, domain key hash in case of zkEmail proofs, currency code etc.
    }

    struct Intent {
        address owner;                              // Address of the intent owner  
        address to;                                 // Address to forward funds to (can be same as owner)
        uint256 depositId;                          // ID of the deposit the intent is associated with
        uint256 amount;                             // Amount of the deposit.token the owner wants to take
        uint256 timestamp;                          // Timestamp of the intent
        address paymentVerifier;                    // Address of the payment verifier corresponding to payment service the owner is 
                                                    // going to pay with offchain
        bytes32 fiatCurrency;                       // Currency code that the owner is paying in offchain (keccak256 hash of the currency code)
    }

    struct VerifierDataView {
        address verifier;
        DepositVerifierData verificationData;
        Currency[] currencies;
    }

    struct DepositView {
        uint256 depositId;
        Deposit deposit;
        uint256 availableLiquidity;                 // Amount of liquidity available to signal intents (net of expired intents)
        VerifierDataView[] verifiers;
    }

    struct IntentView {
        bytes32 intentHash;
        Intent intent;
        DepositView deposit;
    }

    function getDepositFromIds(uint256[] memory _depositIds) external view returns (DepositView[] memory depositArray);
    function getDepositIdsForVerifierAndPayeeDetailsHash(
        address _verifier, 
        bytes32 _payeeDetailsHash
    )
        external
        view
        returns (uint256[] memory);
}
