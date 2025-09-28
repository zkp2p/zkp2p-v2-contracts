// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract UnifiedVerifierEscrowMock {
    struct DepositPaymentMethodData {
        address intentGatingService;
        bytes32 payeeDetails;
        bytes data;
    }

    mapping(uint256 => mapping(bytes32 => DepositPaymentMethodData)) private paymentMethodData;
    mapping(uint256 => mapping(bytes32 => mapping(bytes32 => uint256))) private minRates;

    function setPaymentMethodData(
        uint256 depositId,
        bytes32 paymentMethod,
        address intentGatingService,
        bytes32 payeeDetails,
        bytes calldata data
    ) external {
        paymentMethodData[depositId][paymentMethod] = DepositPaymentMethodData({
            intentGatingService: intentGatingService,
            payeeDetails: payeeDetails,
            data: data
        });
    }

    function setMinConversionRate(
        uint256 depositId,
        bytes32 paymentMethod,
        bytes32 currency,
        uint256 minConversionRate
    ) external {
        minRates[depositId][paymentMethod][currency] = minConversionRate;
    }

    function getDepositPaymentMethodData(uint256 depositId, bytes32 paymentMethod)
        external
        view
        returns (DepositPaymentMethodData memory)
    {
        return paymentMethodData[depositId][paymentMethod];
    }

    function getDepositCurrencyMinRate(uint256 depositId, bytes32 paymentMethod, bytes32 currency)
        external
        view
        returns (uint256)
    {
        return minRates[depositId][paymentMethod][currency];
    }
}
