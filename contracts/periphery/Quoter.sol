// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IEscrow } from "../interfaces/IEscrow.sol";

/**
 * @title Quoter
 * @dev A contract to fetch the best quotes for taking token liquidity from the Escrow contract
 */
contract Quoter {

    /* ============ Structs ============ */

    struct QuoteData {
        uint256[] depositIds;           // Deposit IDs to consider
        address paymentVerifier;        // [Optional] Payment verifier address to filter by (E.g. VenmoReclaim, RevolutTLSN etc)
        address gatingService;          // [Optional] Gating service address to filter by (based on the client from which the intent was created)
        address receiveToken;           // Token address which the user wants to receive onchain
        bytes32 sendCurrency;           // Fiat currency code which the user wants to send offchain
        uint256 amount;                 // Either fiat amount or token amount
        bool isTokenAmount;             // True if amount is token amount, false if amount is fiat amount
                                        // If true, user has specified the exact amount of tokens they want to receive
                                        // If false, user has specified the exact amount of fiat they want to send
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
     * @notice Finds the deposit that asks for the lowest amount of fiat for a exact amount of tokens the user wants to receive.
     * User can filter the deposits by their chosen payment service (aka verifier) and/or the client from which the intent was 
     *created (aka gating service).
     *
     * @param _depositIds               An array of deposit IDs to consider.
     * @param _paymentVerifier          The verifier address the user has chosen. Use address(0) to ignore this filter.
     * @param _gatingService            The gating service address the user has chosen. Use address(0) to ignore this filter.
     * @param _receiveToken             The token address the user wants to receive onchain.
     * @param _sendCurrency             The currency code the user wants to send offchain. Must be provided in bytes32 format.
     * @param _exactTokenAmount         Exact amount of tokens the user wants to receive. Decimal precision depends on the token.
     *
     * @return bestDeposit              The deposit that asks for the lowest amount of fiat for the exact amount of tokens the user wants to receive.
     * @return minFiatAmount            The minimum amount of fiat the user needs to send to receive the exact amount of tokens
     */
    function quoteMinFiatInputForExactTokenOutput(
        uint256[] calldata _depositIds,
        address _paymentVerifier,
        address _gatingService,
        address _receiveToken,
        bytes32 _sendCurrency,
        uint256 _exactTokenAmount   
    )
        external
        view
        returns (IEscrow.DepositView memory bestDeposit, uint256 minFiatAmount)
    {
        QuoteData memory quoteData = QuoteData({
            depositIds: _depositIds,
            paymentVerifier: _paymentVerifier,
            gatingService: _gatingService,
            receiveToken: _receiveToken,
            sendCurrency: _sendCurrency,
            amount: _exactTokenAmount,
            isTokenAmount: true
        });
        
        _validateQuoteData(quoteData);

        uint256 bestTokenToFiatConversionRate;
        (bestDeposit, bestTokenToFiatConversionRate) = _getBestRate(quoteData);

        minFiatAmount = _exactTokenAmount * bestTokenToFiatConversionRate / PRECISE_UNIT;
    }

    /**
     * @notice Finds the deposit that gives the maximum amount of tokens for a exact amount of fiat the user wants to send.
     * User can filter the deposits by their chosen payment service (aka verifier) and/or the client from which the intent was 
     *created (aka gating service).
     *
     * @dev _exactFiatAmount MUST be same base units as token (if token is USDC, _exactFiatAmount is 10e6)
     *
     * @param _depositIds               An array of deposit IDs to consider.
     * @param _receiveToken             The token address the user wants to receive onchain.
     * @param _paymentVerifier          The payment service (aka verifier) the user has chosen. Use address(0) to ignore this filter.
     * @param _gatingService            The gating service (aka client) address the user has chosen. Use address(0) to ignore this filter.
     * @param _sendCurrency             The currency code the user wants to send offchain. Must be provided in bytes32 format.
     * @param _exactFiatAmount          Exact amount of fiat the user wants to send. Decimal precision depends on the token.
     *
     * @return bestDeposit              The deposit that gives the maximum amount of tokens for the exact amount of fiat the user wants to send.
     * @return maxTokenAmount           The maximum amount of tokens the user will receive.
     */
    function quoteMaxTokenOutputForExactFiatInput(
        uint256[] calldata _depositIds,
        address _paymentVerifier,
        address _gatingService,
        address _receiveToken,
        bytes32 _sendCurrency,
        uint256 _exactFiatAmount
    )
        external
        view
        returns (IEscrow.DepositView memory bestDeposit, uint256 maxTokenAmount)
    {
        QuoteData memory quoteData = QuoteData({
            depositIds: _depositIds,
            paymentVerifier: _paymentVerifier,
            gatingService: _gatingService,
            receiveToken: _receiveToken,
            sendCurrency: _sendCurrency,
            amount: _exactFiatAmount,
            isTokenAmount: false
        });
        
        _validateQuoteData(quoteData);

        uint256 bestTokenToFiatConversionRate;
        (bestDeposit, bestTokenToFiatConversionRate) = _getBestRate(quoteData);

        maxTokenAmount = _exactFiatAmount * PRECISE_UNIT / bestTokenToFiatConversionRate;
    }

    /* ============ Internal Functions ============ */

    function _getBestRate(
        QuoteData memory _quoteData
    )
        internal
        view
        returns (IEscrow.DepositView memory bestDeposit, uint256 bestTokenToFiatConversionRate)
    {
        // As the user is taking token liquidity, we want to find the lowest tokenToFiatConversion rate. Hence, we initialize
        // bestTokenToFiatConversionRate to type(uint256).max.
        bestTokenToFiatConversionRate = type(uint256).max;

        IEscrow.DepositView[] memory deposits = escrow.getDepositFromIds(_quoteData.depositIds);

        for (uint256 i = 0; i < deposits.length; i++) {
            IEscrow.DepositView memory depositView = deposits[i];
            if (!_isDepositValid(depositView, _quoteData)) {
                continue;
            }

            IEscrow.VerifierDataView[] memory verifiers = depositView.verifiers;

            for (uint256 j = 0; j < verifiers.length; j++) {
                IEscrow.VerifierDataView memory verifierDataView = verifiers[j];
                if (!_isVerifierValid(verifierDataView, _quoteData)) {
                    continue;
                }

                IEscrow.Currency[] memory currencies = verifierDataView.currencies;

                for (uint256 k = 0; k < currencies.length; k++) {
                    IEscrow.Currency memory currency = currencies[k];
                    if (!_isCurrencyValid(currency, _quoteData)) {
                        continue;
                    }

                    uint256 tokenAmount = _quoteData.isTokenAmount ? 
                        _quoteData.amount : 
                        _getTokenAmount(_quoteData.amount, currency.conversionRate);

                    if (!_isValidTokenAmount(tokenAmount, depositView)) {
                        continue;
                    }

                    if (currency.conversionRate < bestTokenToFiatConversionRate) {
                        bestTokenToFiatConversionRate = currency.conversionRate;
                        bestDeposit = depositView;
                    }
                }
            }
        }

        require(bestTokenToFiatConversionRate != type(uint256).max, "No valid deposit found");
    }

    function _validateQuoteData(QuoteData memory _quoteData) internal pure {
        require(_quoteData.depositIds.length > 0, "Deposit IDs array cannot be empty");
        require(_quoteData.sendCurrency != bytes32(0), "Currency code must be provided");
        require(_quoteData.receiveToken != address(0), "Token address must be provided");
        require(_quoteData.amount > 0, "Amount must be greater than 0");
    }

    function _isDepositValid(IEscrow.DepositView memory _depositView, QuoteData memory _quoteData) internal pure returns (bool) {
        // Skip deposit if it is not accepting intents
        if (!_depositView.deposit.acceptingIntents) {
            return false;
        }
        // Skip deposit if the token does not match the receive token
        if (address(_depositView.deposit.token) != _quoteData.receiveToken) {
            return false;
        }
        return true;
    }

    function _isVerifierValid(IEscrow.VerifierDataView memory _verifierDataView, QuoteData memory _quoteData) internal pure returns (bool) {
        // Skip verifier if verifier filter is provided and does not match
        if (_quoteData.paymentVerifier != address(0) && _verifierDataView.verifier != _quoteData.paymentVerifier) {
            return false;
        }
        // Skip verifier if gating service filter is provided and does not match
        if (_quoteData.gatingService != address(0) && _verifierDataView.verificationData.intentGatingService != _quoteData.gatingService) {
            return false;
        }
        return true;
    }

    function _isCurrencyValid(IEscrow.Currency memory _currency, QuoteData memory _quoteData) internal pure returns (bool) {
        // Skip currency if deposit currency does not match the send currency
        if (_currency.code != _quoteData.sendCurrency) {
            return false;
        }
        return true;
    }

    function _isValidTokenAmount(uint256 _tokenAmount, IEscrow.DepositView memory _depositView) internal pure returns (bool) {
        // Skip deposit if amount is not within the intent amount range
        if (_tokenAmount < _depositView.deposit.intentAmountRange.min || _tokenAmount > _depositView.deposit.intentAmountRange.max) {
            return false;
        }
        // Skip deposit if amount is greater than available liquidity
        if (_tokenAmount > _depositView.availableLiquidity) {
            return false;
        }
        return true;
    }

    /**
     * @notice Converts a token amount to a fiat amount given a token to fiat conversion rate
     */
    function _getFiatAmount(uint256 _tokenAmount, uint256 _tokenToFiatConversionRate) internal pure returns (uint256) {
        return _tokenAmount * _tokenToFiatConversionRate / PRECISE_UNIT;
    }

    /**
     * @notice Converts a fiat amount to a token amount given a token to fiat conversion rate
     */
    function _getTokenAmount(uint256 _fiatAmount, uint256 _tokenToFiatConversionRate) internal pure returns (uint256) {
        return _fiatAmount * PRECISE_UNIT / _tokenToFiatConversionRate;
    }
}
