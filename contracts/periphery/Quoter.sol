// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IEscrow } from "../interfaces/IEscrow.sol";

/**
 * @title Quoter
 * @dev A contract to fetch the best conversion rate from the Escrow contract
 */
contract Quoter {

    /* ============ Structs ============ */

    struct QuoteData {
        uint256[] depositIds;           // depositIds to consider
        address tokenAddress;           // token address to filter by
        address verifierAddress;        // verifierAddress address to filter by
        address gatingServiceAddress;   // gating service address to filter by
        bytes32 currencyCode;           // currency code to filter by
        uint256 amountInputOrOutput;    // amount of tokens to convert
        bool isExactOutput;             // true if amountInputOrOutput is amountOutput, false if amountInputOrOutput is amountInput
    }

    /* ============ Constants ============ */
    
    uint256 internal constant PRECISE_UNIT = 1e18;

    /* ============ State Variables ============ */
    
    IEscrow public immutable escrow;

    /* ============ Constructor ============ */

    constructor(IEscrow _escrow) {
        escrow = _escrow;
    }

    /* ============ External Getter Functions ============ */

    /**
     * @notice Finds the best conversion rate from the provided deposit IDs for a given token, verifierAddress, and/or currency code in the specified Escrow contract.
     *
     * @param _depositIds               An array of deposit IDs to consider.
     * @param _tokenAddress             The token address to filter by.
     * @param _verifierAddress          The verifierAddress address to filter by. Use address(0) to ignore this filter.
     * @param _gatingServiceAddress     The gating service address to filter by.
     * @param _currencyCode             The currency code to filter by. Must be provided in bytes32 format.
     * @param _amountOutput             Amount of tokens to convert.
     *
     * @return bestDepositId The deposit ID with the best conversion rate.
     * @return amountInput The amount of tokens received.
     */
    function quoteExactOutput(
        uint256[] calldata _depositIds,
        address _tokenAddress,
        address _verifierAddress,
        address _gatingServiceAddress,
        bytes32 _currencyCode,
        uint256 _amountOutput
    )
        external
        view
        returns (uint256 bestDepositId, uint256 amountInput)
    {
        uint256 bestRate;
        QuoteData memory quoteData = QuoteData({
            depositIds: _depositIds,
            tokenAddress: _tokenAddress,
            verifierAddress: _verifierAddress,
            gatingServiceAddress: _gatingServiceAddress,
            currencyCode: _currencyCode,
            amountInputOrOutput: _amountOutput,
            isExactOutput: true
        });
        (bestDepositId, bestRate) = _getBestRateInternal(quoteData);

        amountInput = _amountOutput * bestRate / PRECISE_UNIT;
    }

    /**
     * @notice Finds the best conversion rate from the provided deposit IDs for a given token, verifierAddress, and/or currency code in the specified Escrow contract.
     * 
     * @dev Amount of input MUST be same base units as token (if token is USDC, amountInput is 10e6)
     *
     * @param _depositIds               An array of deposit IDs to consider.
     * @param _tokenAddress             The token address to filter by.
     * @param _verifierAddress          The verifierAddress address to filter by. Use address(0) to ignore this filter.
     * @param _gatingServiceAddress     The gating service address to filter by.
     * @param _currencyCode             The currency code to filter by. Must be provided in bytes32 format.
     * @param _amountInput              Amount of tokens to convert.
     *
     * @return bestDepositId The deposit ID with the best conversion rate.
     * @return amountOutput The amount of tokens received.
     */
    function quoteExactInput(
        uint256[] calldata _depositIds,
        address _tokenAddress,
        address _verifierAddress,
        address _gatingServiceAddress,
        bytes32 _currencyCode,
        uint256 _amountInput
    )
        external
        view
        returns (uint256 bestDepositId, uint256 amountOutput)
    {
        uint256 bestRate;
        QuoteData memory quoteData = QuoteData({
            depositIds: _depositIds,
            tokenAddress: _tokenAddress,
            verifierAddress: _verifierAddress,
            gatingServiceAddress: _gatingServiceAddress,
            currencyCode: _currencyCode,
            amountInputOrOutput: _amountInput,
            isExactOutput: false
        });
        (bestDepositId, bestRate) = _getBestRateInternal(quoteData);

        amountOutput = _amountInput * PRECISE_UNIT / bestRate;
    }

    /* ============ Internal Functions ============ */

    function _getBestRateInternal(
        QuoteData memory _quoteData
    )
        internal
        view
        returns (uint256 bestDepositId, uint256 bestRate)
    {
        bestRate = type(uint256).max;

        require(_quoteData.currencyCode != bytes32(0), "Currency code must be provided");
        require(_quoteData.depositIds.length > 0, "Deposit IDs array cannot be empty");
        require(_quoteData.tokenAddress != address(0), "Token address must be provided");
        require(_quoteData.gatingServiceAddress != address(0), "Gating service address must be provided");

        IEscrow.DepositView[] memory deposits = escrow.getDepositFromIds(_quoteData.depositIds);

        for (uint256 i = 0; i < deposits.length; i++) {
            IEscrow.DepositView memory depositView = deposits[i];

            // Skip deposits where the token address does not match
            if (address(depositView.deposit.token) != _quoteData.tokenAddress) {
                continue;
            }

            // Skip deposits that are not accepting intents
            if (!depositView.deposit.acceptingIntents) {
                continue;
            }

            IEscrow.VerifierDataView[] memory verifiers = depositView.verifiers;

            for (uint256 j = 0; j < verifiers.length; j++) {
                IEscrow.VerifierDataView memory verifierDataView = verifiers[j];
                address verifier = verifierDataView.verifier;

                // Skip verifiers where the gating service address does not match
                if (verifierDataView.verificationData.intentGatingService != _quoteData.gatingServiceAddress) {
                    continue;
                }

                // Skip if verifier address does not match
                if (
                    _quoteData.verifierAddress != address(0) &&
                    verifier != _quoteData.verifierAddress
                ) {
                    continue;
                }

                IEscrow.Currency[] memory currencies = verifierDataView.currencies;

                for (uint256 k = 0; k < currencies.length; k++) {
                    IEscrow.Currency memory currency = currencies[k];

                    // Check if the currency code matches
                    if (currency.code != _quoteData.currencyCode) {
                        continue;
                    }

                    uint256 amount = _quoteData.isExactOutput ? _quoteData.amountInputOrOutput : _quoteData.amountInputOrOutput * PRECISE_UNIT / currency.conversionRate;

                    // Skip deposits that are not within the intent amount range
                    if (
                        amount <= depositView.deposit.intentAmountRange.min ||
                        amount >= depositView.deposit.intentAmountRange.max
                    ) {
                        continue;
                    }

                    // Skip deposits if amount is greater than available liquidity
                    if (amount > depositView.availableLiquidity) {
                        continue;
                    }

                    // Update best rate and deposit ID if a better rate is found
                    if (currency.conversionRate < bestRate) {
                        bestRate = currency.conversionRate;
                        bestDepositId = depositView.depositId;
                    }
                }
            }
        }

        require(bestRate != type(uint256).max, "No valid conversion rate found");
    }
}
