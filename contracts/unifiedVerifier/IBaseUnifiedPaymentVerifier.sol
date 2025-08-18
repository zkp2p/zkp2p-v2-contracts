//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface IBaseUnifiedPaymentVerifier {    
    struct PaymentMethodConfig {
        bool initialized;
        uint256 timestampBuffer;
        mapping(bytes32 => bool) processorHashExists;
        mapping(bytes32 => bool) currencyExists;
        bytes32[] processorHashes;
        bytes32[] currencies;
    }
}
