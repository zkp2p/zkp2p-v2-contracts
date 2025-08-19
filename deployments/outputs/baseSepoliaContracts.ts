export default {
  "name": "base_sepolia",
  "chainId": "84532",
  "contracts": {
    "CashappReclaimVerifier": {
      "address": "0xD3cd3B579b76ec560953132946d2bf9b89E9dA80",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrow",
              "type": "address"
            },
            {
              "internalType": "contract INullifierRegistry",
              "name": "_nullifierRegistry",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            },
            {
              "internalType": "bytes32[]",
              "name": "_currencies",
              "type": "bytes32[]"
            },
            {
              "internalType": "string[]",
              "name": "_providerHashes",
              "type": "string[]"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "TimestampBufferSet",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "COMPLETE_PAYMENT_STATUS",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "addCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_newProviderHash",
              "type": "string"
            }
          ],
          "name": "addProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "escrow",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getCurrencies",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getProviderHashes",
          "outputs": [
            {
              "internalType": "string[]",
              "name": "",
              "type": "string[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "name": "isCurrency",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "name": "isProviderHash",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "nullifierRegistry",
          "outputs": [
            {
              "internalType": "contract INullifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "providerHashes",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "removeCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_removeProviderHash",
              "type": "string"
            }
          ],
          "name": "removeProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "setTimestampBuffer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "timestampBuffer",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "address",
                  "name": "depositToken",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "intentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "intentTimestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "depositData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IPaymentVerifier.VerifyPaymentData",
              "name": "_verifyPaymentData",
              "type": "tuple"
            }
          ],
          "name": "verifyPayment",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bool",
                  "name": "success",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "releaseAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes32",
                  "name": "paymentCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "string",
                  "name": "paymentId",
                  "type": "string"
                }
              ],
              "internalType": "struct IPaymentVerifier.PaymentVerificationResult",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "components": [
                    {
                      "internalType": "string",
                      "name": "provider",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "parameters",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "context",
                      "type": "string"
                    }
                  ],
                  "internalType": "struct Claims.ClaimInfo",
                  "name": "claimInfo",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "identifier",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "address",
                          "name": "owner",
                          "type": "address"
                        },
                        {
                          "internalType": "uint32",
                          "name": "timestampS",
                          "type": "uint32"
                        },
                        {
                          "internalType": "uint32",
                          "name": "epoch",
                          "type": "uint32"
                        }
                      ],
                      "internalType": "struct Claims.CompleteClaimData",
                      "name": "claim",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bytes[]",
                      "name": "signatures",
                      "type": "bytes[]"
                    }
                  ],
                  "internalType": "struct Claims.SignedClaim",
                  "name": "signedClaim",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IReclaimVerifier.ReclaimProof",
              "name": "proof",
              "type": "tuple"
            },
            {
              "internalType": "address[]",
              "name": "_witnesses",
              "type": "address[]"
            },
            {
              "internalType": "uint256",
              "name": "_requiredThreshold",
              "type": "uint256"
            }
          ],
          "name": "verifyProofSignatures",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "pure",
          "type": "function"
        }
      ]
    },
    "Escrow": {
      "address": "0xf906F893326a1A98e62cAB45C980b2afE0e2A8a0",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_owner",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_chainId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_paymentVerifierRegistry",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_makerProtocolFee",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_makerFeeRecipient",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_dustThreshold",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "_maxIntentsPerDeposit",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "_intentExpirationPeriod",
              "type": "uint256"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "max",
              "type": "uint256"
            }
          ],
          "name": "AmountAboveMax",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "min",
              "type": "uint256"
            }
          ],
          "name": "AmountBelowMin",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "requested",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "available",
              "type": "uint256"
            }
          ],
          "name": "AmountExceedsAvailable",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "length1",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "length2",
              "type": "uint256"
            }
          ],
          "name": "ArrayLengthMismatch",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            },
            {
              "internalType": "bytes32",
              "name": "currency",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyAlreadyExists",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            },
            {
              "internalType": "bytes32",
              "name": "currency",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyNotFound",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            },
            {
              "internalType": "bytes32",
              "name": "currency",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyNotSupported",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            }
          ],
          "name": "DelegateNotFound",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "internalType": "bool",
              "name": "currentState",
              "type": "bool"
            }
          ],
          "name": "DepositAlreadyInState",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            }
          ],
          "name": "DepositNotAcceptingIntents",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            }
          ],
          "name": "DepositNotFound",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "EmptyPayeeDetails",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "fee",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "maximum",
              "type": "uint256"
            }
          ],
          "name": "FeeExceedsMaximum",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "available",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "required",
              "type": "uint256"
            }
          ],
          "name": "InsufficientDepositLiquidity",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "intentHash",
              "type": "bytes32"
            }
          ],
          "name": "IntentNotFound",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "min",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "max",
              "type": "uint256"
            }
          ],
          "name": "InvalidRange",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "InvalidReferrerFeeConfiguration",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "current",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "max",
              "type": "uint256"
            }
          ],
          "name": "MaxIntentsExceeded",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "caller",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "authorized",
              "type": "address"
            }
          ],
          "name": "UnauthorizedCaller",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "caller",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "delegate",
              "type": "address"
            }
          ],
          "name": "UnauthorizedCallerOrDelegate",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            }
          ],
          "name": "VerifierAlreadyExists",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            }
          ],
          "name": "VerifierNotFound",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            }
          ],
          "name": "VerifierNotWhitelisted",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "ZeroAddress",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "ZeroConversionRate",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "ZeroMinValue",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "ZeroValue",
          "type": "error"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "acceptingIntents",
              "type": "bool"
            }
          ],
          "name": "DepositAcceptingIntentsUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "depositor",
              "type": "address"
            }
          ],
          "name": "DepositClosed",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "currency",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "conversionRate",
              "type": "uint256"
            }
          ],
          "name": "DepositCurrencyAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "DepositCurrencyRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "depositor",
              "type": "address"
            }
          ],
          "name": "DepositDelegateRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "depositor",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "delegate",
              "type": "address"
            }
          ],
          "name": "DepositDelegateSet",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "depositor",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "DepositFundsAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "min",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "max",
                  "type": "uint256"
                }
              ],
              "indexed": false,
              "internalType": "struct IEscrow.Range",
              "name": "intentAmountRange",
              "type": "tuple"
            }
          ],
          "name": "DepositIntentAmountRangeUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "currency",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "newMinConversionRate",
              "type": "uint256"
            }
          ],
          "name": "DepositMinConversionRateUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "depositor",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "contract IERC20",
              "name": "token",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "min",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "max",
                  "type": "uint256"
                }
              ],
              "indexed": false,
              "internalType": "struct IEscrow.Range",
              "name": "intentAmountRange",
              "type": "tuple"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "delegate",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "intentGuardian",
              "type": "address"
            }
          ],
          "name": "DepositReceived",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "payeeDetailsHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "intentGatingService",
              "type": "address"
            }
          ],
          "name": "DepositVerifierAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            }
          ],
          "name": "DepositVerifierRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "depositor",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "acceptingIntents",
              "type": "bool"
            }
          ],
          "name": "DepositWithdrawn",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "dustAmount",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "makerFeeRecipient",
              "type": "address"
            }
          ],
          "name": "DustCollected",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "dustThreshold",
              "type": "uint256"
            }
          ],
          "name": "DustThresholdUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "intentHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "expiryTime",
              "type": "uint256"
            }
          ],
          "name": "FundsLocked",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "intentHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "FundsUnlocked",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "intentHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "unlockedAmount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "transferredAmount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "makerFees",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "referrerFees",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "to",
              "type": "address"
            }
          ],
          "name": "FundsUnlockedAndTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "intentExpirationPeriod",
              "type": "uint256"
            }
          ],
          "name": "IntentExpirationPeriodUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "intentHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "newExpiryTime",
              "type": "uint256"
            }
          ],
          "name": "IntentExpiryExtended",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "makerFeeRecipient",
              "type": "address"
            }
          ],
          "name": "MakerFeeRecipientUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "collectedFees",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "makerFeeRecipient",
              "type": "address"
            }
          ],
          "name": "MakerFeesCollected",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "makerProtocolFee",
              "type": "uint256"
            }
          ],
          "name": "MakerProtocolFeeUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "maxIntentsPerDeposit",
              "type": "uint256"
            }
          ],
          "name": "MaxIntentsPerDepositUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "minDepositAmount",
              "type": "uint256"
            }
          ],
          "name": "MinDepositAmountSet",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "orchestrator",
              "type": "address"
            }
          ],
          "name": "OrchestratorUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "address",
              "name": "account",
              "type": "address"
            }
          ],
          "name": "Paused",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "paymentVerifierRegistry",
              "type": "address"
            }
          ],
          "name": "PaymentVerifierRegistryUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "collectedFees",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "referrer",
              "type": "address"
            }
          ],
          "name": "ReferrerFeesCollected",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "address",
              "name": "account",
              "type": "address"
            }
          ],
          "name": "Unpaused",
          "type": "event"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            },
            {
              "components": [
                {
                  "internalType": "bytes32",
                  "name": "code",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "minConversionRate",
                  "type": "uint256"
                }
              ],
              "internalType": "struct IEscrow.Currency[]",
              "name": "_currencies",
              "type": "tuple[]"
            }
          ],
          "name": "addCurrenciesToDepositVerifier",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "_amount",
              "type": "uint256"
            }
          ],
          "name": "addFundsToDeposit",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "address[]",
              "name": "_verifiers",
              "type": "address[]"
            },
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "intentGatingService",
                  "type": "address"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IEscrow.DepositVerifierData[]",
              "name": "_verifierData",
              "type": "tuple[]"
            },
            {
              "components": [
                {
                  "internalType": "bytes32",
                  "name": "code",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "minConversionRate",
                  "type": "uint256"
                }
              ],
              "internalType": "struct IEscrow.Currency[][]",
              "name": "_currencies",
              "type": "tuple[][]"
            }
          ],
          "name": "addVerifiersToDeposit",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "chainId",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "contract IERC20",
                  "name": "token",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "amount",
                  "type": "uint256"
                },
                {
                  "components": [
                    {
                      "internalType": "uint256",
                      "name": "min",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "max",
                      "type": "uint256"
                    }
                  ],
                  "internalType": "struct IEscrow.Range",
                  "name": "intentAmountRange",
                  "type": "tuple"
                },
                {
                  "internalType": "address[]",
                  "name": "verifiers",
                  "type": "address[]"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "intentGatingService",
                      "type": "address"
                    },
                    {
                      "internalType": "string",
                      "name": "payeeDetails",
                      "type": "string"
                    },
                    {
                      "internalType": "bytes",
                      "name": "data",
                      "type": "bytes"
                    }
                  ],
                  "internalType": "struct IEscrow.DepositVerifierData[]",
                  "name": "verifierData",
                  "type": "tuple[]"
                },
                {
                  "components": [
                    {
                      "internalType": "bytes32",
                      "name": "code",
                      "type": "bytes32"
                    },
                    {
                      "internalType": "uint256",
                      "name": "minConversionRate",
                      "type": "uint256"
                    }
                  ],
                  "internalType": "struct IEscrow.Currency[][]",
                  "name": "currencies",
                  "type": "tuple[][]"
                },
                {
                  "internalType": "address",
                  "name": "delegate",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "intentGuardian",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "referrer",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "referrerFee",
                  "type": "uint256"
                }
              ],
              "internalType": "struct IEscrow.CreateDepositParams",
              "name": "_params",
              "type": "tuple"
            }
          ],
          "name": "createDeposit",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "depositCounter",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "dustThreshold",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "_intentHash",
              "type": "bytes32"
            },
            {
              "internalType": "uint256",
              "name": "_additionalTime",
              "type": "uint256"
            }
          ],
          "name": "extendIntentExpiry",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_account",
              "type": "address"
            }
          ],
          "name": "getAccountDeposits",
          "outputs": [
            {
              "internalType": "uint256[]",
              "name": "",
              "type": "uint256[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            }
          ],
          "name": "getDeposit",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "depositor",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "delegate",
                  "type": "address"
                },
                {
                  "internalType": "contract IERC20",
                  "name": "token",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "amount",
                  "type": "uint256"
                },
                {
                  "components": [
                    {
                      "internalType": "uint256",
                      "name": "min",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "max",
                      "type": "uint256"
                    }
                  ],
                  "internalType": "struct IEscrow.Range",
                  "name": "intentAmountRange",
                  "type": "tuple"
                },
                {
                  "internalType": "bool",
                  "name": "acceptingIntents",
                  "type": "bool"
                },
                {
                  "internalType": "uint256",
                  "name": "remainingDeposits",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "outstandingIntentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "makerProtocolFee",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "reservedMakerFees",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "accruedMakerFees",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "accruedReferrerFees",
                  "type": "uint256"
                },
                {
                  "internalType": "address",
                  "name": "intentGuardian",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "referrer",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "referrerFee",
                  "type": "uint256"
                }
              ],
              "internalType": "struct IEscrow.Deposit",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            }
          ],
          "name": "getDepositCurrencies",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            },
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "getDepositCurrencyMinRate",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "_intentHash",
              "type": "bytes32"
            }
          ],
          "name": "getDepositIntent",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "amount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "timestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "expiryTime",
                  "type": "uint256"
                }
              ],
              "internalType": "struct IEscrow.Intent",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            }
          ],
          "name": "getDepositIntentHashes",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            }
          ],
          "name": "getDepositVerifierData",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "intentGatingService",
                  "type": "address"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IEscrow.DepositVerifierData",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            }
          ],
          "name": "getDepositVerifiers",
          "outputs": [
            {
              "internalType": "address[]",
              "name": "",
              "type": "address[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            }
          ],
          "name": "getExpiredIntents",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "expiredIntents",
              "type": "bytes32[]"
            },
            {
              "internalType": "uint256",
              "name": "reclaimedAmount",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "intentExpirationPeriod",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "_intentHash",
              "type": "bytes32"
            },
            {
              "internalType": "uint256",
              "name": "_amount",
              "type": "uint256"
            }
          ],
          "name": "lockFunds",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "makerFeeRecipient",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "makerProtocolFee",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "maxIntentsPerDeposit",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "orchestrator",
          "outputs": [
            {
              "internalType": "contract IOrchestrator",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "pauseEscrow",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "paused",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "paymentVerifierRegistry",
          "outputs": [
            {
              "internalType": "contract IPaymentVerifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            }
          ],
          "name": "pruneExpiredIntents",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            },
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "removeCurrencyFromDepositVerifier",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            }
          ],
          "name": "removeDepositDelegate",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "_amount",
              "type": "uint256"
            }
          ],
          "name": "removeFundsFromDeposit",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            }
          ],
          "name": "removeVerifierFromDeposit",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "bool",
              "name": "_acceptingIntents",
              "type": "bool"
            }
          ],
          "name": "setDepositAcceptingIntents",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_delegate",
              "type": "address"
            }
          ],
          "name": "setDepositDelegate",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_dustThreshold",
              "type": "uint256"
            }
          ],
          "name": "setDustThreshold",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_intentExpirationPeriod",
              "type": "uint256"
            }
          ],
          "name": "setIntentExpirationPeriod",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_makerFeeRecipient",
              "type": "address"
            }
          ],
          "name": "setMakerFeeRecipient",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_makerProtocolFee",
              "type": "uint256"
            }
          ],
          "name": "setMakerProtocolFee",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_maxIntentsPerDeposit",
              "type": "uint256"
            }
          ],
          "name": "setMaxIntentsPerDeposit",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_orchestrator",
              "type": "address"
            }
          ],
          "name": "setOrchestrator",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_paymentVerifierRegistry",
              "type": "address"
            }
          ],
          "name": "setPaymentVerifierRegistry",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "_intentHash",
              "type": "bytes32"
            },
            {
              "internalType": "uint256",
              "name": "_transferAmount",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_to",
              "type": "address"
            }
          ],
          "name": "unlockAndTransferFunds",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "_intentHash",
              "type": "bytes32"
            }
          ],
          "name": "unlockFunds",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "unpauseEscrow",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "min",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "max",
                  "type": "uint256"
                }
              ],
              "internalType": "struct IEscrow.Range",
              "name": "_intentAmountRange",
              "type": "tuple"
            }
          ],
          "name": "updateDepositIntentAmountRange",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            },
            {
              "internalType": "bytes32",
              "name": "_fiatCurrency",
              "type": "bytes32"
            },
            {
              "internalType": "uint256",
              "name": "_newMinConversionRate",
              "type": "uint256"
            }
          ],
          "name": "updateDepositMinConversionRate",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            }
          ],
          "name": "withdrawDeposit",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ]
    },
    "EscrowRegistry": {
      "address": "0x4e0B0B4b20b94d17b1cA0a9fC7541312a5672F34",
      "abi": [
        {
          "inputs": [],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bool",
              "name": "acceptAll",
              "type": "bool"
            }
          ],
          "name": "AcceptAllEscrowsUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "escrow",
              "type": "address"
            }
          ],
          "name": "EscrowAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "escrow",
              "type": "address"
            }
          ],
          "name": "EscrowRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "acceptAllEscrows",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrow",
              "type": "address"
            }
          ],
          "name": "addEscrow",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "escrows",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getWhitelistedEscrows",
          "outputs": [
            {
              "internalType": "address[]",
              "name": "",
              "type": "address[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "isAcceptingAllEscrows",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "name": "isWhitelistedEscrow",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrow",
              "type": "address"
            }
          ],
          "name": "removeEscrow",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bool",
              "name": "_acceptAll",
              "type": "bool"
            }
          ],
          "name": "setAcceptAllEscrows",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ]
    },
    "MercadoPagoReclaimVerifier": {
      "address": "0x70060D3CA3c8796aFBC3EdF9e60c79F39DB31912",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrow",
              "type": "address"
            },
            {
              "internalType": "contract INullifierRegistry",
              "name": "_nullifierRegistry",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            },
            {
              "internalType": "bytes32[]",
              "name": "_currencies",
              "type": "bytes32[]"
            },
            {
              "internalType": "string[]",
              "name": "_providerHashes",
              "type": "string[]"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "TimestampBufferSet",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "COMPLETE_PAYMENT_STATUS",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "ONLINE_TRANSFER_TYPE",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "P2P_PAYMENT_TYPE",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "addCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_newProviderHash",
              "type": "string"
            }
          ],
          "name": "addProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "escrow",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getCurrencies",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getProviderHashes",
          "outputs": [
            {
              "internalType": "string[]",
              "name": "",
              "type": "string[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "name": "isCurrency",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "name": "isProviderHash",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "nullifierRegistry",
          "outputs": [
            {
              "internalType": "contract INullifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "providerHashes",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "removeCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_removeProviderHash",
              "type": "string"
            }
          ],
          "name": "removeProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "setTimestampBuffer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "timestampBuffer",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "address",
                  "name": "depositToken",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "intentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "intentTimestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "depositData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IPaymentVerifier.VerifyPaymentData",
              "name": "_verifyPaymentData",
              "type": "tuple"
            }
          ],
          "name": "verifyPayment",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bool",
                  "name": "success",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "releaseAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes32",
                  "name": "paymentCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "string",
                  "name": "paymentId",
                  "type": "string"
                }
              ],
              "internalType": "struct IPaymentVerifier.PaymentVerificationResult",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "components": [
                    {
                      "internalType": "string",
                      "name": "provider",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "parameters",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "context",
                      "type": "string"
                    }
                  ],
                  "internalType": "struct Claims.ClaimInfo",
                  "name": "claimInfo",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "identifier",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "address",
                          "name": "owner",
                          "type": "address"
                        },
                        {
                          "internalType": "uint32",
                          "name": "timestampS",
                          "type": "uint32"
                        },
                        {
                          "internalType": "uint32",
                          "name": "epoch",
                          "type": "uint32"
                        }
                      ],
                      "internalType": "struct Claims.CompleteClaimData",
                      "name": "claim",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bytes[]",
                      "name": "signatures",
                      "type": "bytes[]"
                    }
                  ],
                  "internalType": "struct Claims.SignedClaim",
                  "name": "signedClaim",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IReclaimVerifier.ReclaimProof",
              "name": "proof",
              "type": "tuple"
            },
            {
              "internalType": "address[]",
              "name": "_witnesses",
              "type": "address[]"
            },
            {
              "internalType": "uint256",
              "name": "_requiredThreshold",
              "type": "uint256"
            }
          ],
          "name": "verifyProofSignatures",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "pure",
          "type": "function"
        }
      ]
    },
    "NullifierRegistry": {
      "address": "0xbfEe97ec04f21882E4F23D32631477D653839AcB",
      "abi": [
        {
          "inputs": [],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "nullifier",
              "type": "bytes32"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "writer",
              "type": "address"
            }
          ],
          "name": "NullifierAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "address",
              "name": "writer",
              "type": "address"
            }
          ],
          "name": "WriterAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "address",
              "name": "writer",
              "type": "address"
            }
          ],
          "name": "WriterRemoved",
          "type": "event"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_nullifier",
              "type": "bytes32"
            }
          ],
          "name": "addNullifier",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_newWriter",
              "type": "address"
            }
          ],
          "name": "addWritePermission",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getWriters",
          "outputs": [
            {
              "internalType": "address[]",
              "name": "",
              "type": "address[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "name": "isNullified",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "name": "isWriter",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_removedWriter",
              "type": "address"
            }
          ],
          "name": "removeWritePermission",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "writers",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ]
    },
    "Orchestrator": {
      "address": "0x3D1752E0cC528fd4e3f29f3E0C49faB9ff4c1285",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_owner",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_chainId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_escrowRegistry",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "_paymentVerifierRegistry",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "_postIntentHookRegistry",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "_relayerRegistry",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_protocolFee",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "_protocolFeeRecipient",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_partialManualReleaseDelay",
              "type": "uint256"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "account",
              "type": "address"
            },
            {
              "internalType": "bytes32",
              "name": "existingIntent",
              "type": "bytes32"
            }
          ],
          "name": "AccountHasActiveIntent",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "max",
              "type": "uint256"
            }
          ],
          "name": "AmountAboveMax",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "min",
              "type": "uint256"
            }
          ],
          "name": "AmountBelowMin",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "limit",
              "type": "uint256"
            }
          ],
          "name": "AmountExceedsLimit",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            },
            {
              "internalType": "bytes32",
              "name": "currency",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyNotSupported",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "EscrowLockFailed",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "escrow",
              "type": "address"
            }
          ],
          "name": "EscrowNotWhitelisted",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "fee",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "maximum",
              "type": "uint256"
            }
          ],
          "name": "FeeExceedsMaximum",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "expected",
              "type": "bytes32"
            },
            {
              "internalType": "bytes32",
              "name": "actual",
              "type": "bytes32"
            }
          ],
          "name": "HashMismatch",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "intentHash",
              "type": "bytes32"
            }
          ],
          "name": "IntentNotFound",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "InvalidReferrerFeeConfiguration",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "InvalidSignature",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "currentTime",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "allowedTime",
              "type": "uint256"
            }
          ],
          "name": "PartialReleaseNotAllowedYet",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "PaymentVerificationFailed",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "hook",
              "type": "address"
            }
          ],
          "name": "PostIntentHookNotWhitelisted",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "rate",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "minRate",
              "type": "uint256"
            }
          ],
          "name": "RateBelowMinimum",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "expiration",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "currentTime",
              "type": "uint256"
            }
          ],
          "name": "SignatureExpired",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "recipient",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "TransferFailed",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "caller",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "authorized",
              "type": "address"
            }
          ],
          "name": "UnauthorizedCaller",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "caller",
              "type": "address"
            }
          ],
          "name": "UnauthorizedEscrowCaller",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            }
          ],
          "name": "VerifierNotSupported",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            }
          ],
          "name": "VerifierNotWhitelisted",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "ZeroAddress",
          "type": "error"
        },
        {
          "inputs": [],
          "name": "ZeroValue",
          "type": "error"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bool",
              "name": "allowMultiple",
              "type": "bool"
            }
          ],
          "name": "AllowMultipleIntentsUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "escrowRegistry",
              "type": "address"
            }
          ],
          "name": "EscrowRegistryUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "intentHash",
              "type": "bytes32"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "fundsTransferredTo",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "isManualRelease",
              "type": "bool"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "paymentCurrency",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "string",
              "name": "paymentId",
              "type": "string"
            }
          ],
          "name": "IntentFulfilled",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "intentHash",
              "type": "bytes32"
            }
          ],
          "name": "IntentPruned",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "intentHash",
              "type": "bytes32"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "escrow",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "depositId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "fiatCurrency",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "conversionRate",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "timestamp",
              "type": "uint256"
            }
          ],
          "name": "IntentSignaled",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "partialManualReleaseDelay",
              "type": "uint256"
            }
          ],
          "name": "PartialManualReleaseDelayUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "address",
              "name": "account",
              "type": "address"
            }
          ],
          "name": "Paused",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "paymentVerifierRegistry",
              "type": "address"
            }
          ],
          "name": "PaymentVerifierRegistryUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "postIntentHookRegistry",
              "type": "address"
            }
          ],
          "name": "PostIntentHookRegistryUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "protocolFeeRecipient",
              "type": "address"
            }
          ],
          "name": "ProtocolFeeRecipientUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "protocolFee",
              "type": "uint256"
            }
          ],
          "name": "ProtocolFeeUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "relayerRegistry",
              "type": "address"
            }
          ],
          "name": "RelayerRegistryUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "address",
              "name": "account",
              "type": "address"
            }
          ],
          "name": "Unpaused",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "allowMultipleIntents",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_intentHash",
              "type": "bytes32"
            }
          ],
          "name": "cancelIntent",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "chainId",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "escrowRegistry",
          "outputs": [
            {
              "internalType": "contract IEscrowRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "bytes",
                  "name": "verificationData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "postIntentHookData",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IOrchestrator.FulfillIntentParams",
              "name": "_params",
              "type": "tuple"
            }
          ],
          "name": "fulfillIntent",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_account",
              "type": "address"
            }
          ],
          "name": "getAccountIntents",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_intentHash",
              "type": "bytes32"
            }
          ],
          "name": "getIntent",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "owner",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "to",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "escrow",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "depositId",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "amount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "timestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "address",
                  "name": "paymentVerifier",
                  "type": "address"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "address",
                  "name": "referrer",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "referrerFee",
                  "type": "uint256"
                },
                {
                  "internalType": "contract IPostIntentHook",
                  "name": "postIntentHook",
                  "type": "address"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IOrchestrator.Intent",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "intentCounter",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "partialManualReleaseDelay",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "pauseOrchestrator",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "paused",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "paymentVerifierRegistry",
          "outputs": [
            {
              "internalType": "contract IPaymentVerifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "postIntentHookRegistry",
          "outputs": [
            {
              "internalType": "contract IPostIntentHookRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "protocolFee",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "protocolFeeRecipient",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32[]",
              "name": "_intents",
              "type": "bytes32[]"
            }
          ],
          "name": "pruneIntents",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "relayerRegistry",
          "outputs": [
            {
              "internalType": "contract IRelayerRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_intentHash",
              "type": "bytes32"
            },
            {
              "internalType": "uint256",
              "name": "_releaseAmount",
              "type": "uint256"
            },
            {
              "internalType": "bytes",
              "name": "_releaseData",
              "type": "bytes"
            }
          ],
          "name": "releaseFundsToPayer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bool",
              "name": "_allowMultiple",
              "type": "bool"
            }
          ],
          "name": "setAllowMultipleIntents",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrowRegistry",
              "type": "address"
            }
          ],
          "name": "setEscrowRegistry",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_partialManualReleaseDelay",
              "type": "uint256"
            }
          ],
          "name": "setPartialManualReleaseDelay",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_postIntentHookRegistry",
              "type": "address"
            }
          ],
          "name": "setPostIntentHookRegistry",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_protocolFee",
              "type": "uint256"
            }
          ],
          "name": "setProtocolFee",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_protocolFeeRecipient",
              "type": "address"
            }
          ],
          "name": "setProtocolFeeRecipient",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_relayerRegistry",
              "type": "address"
            }
          ],
          "name": "setRelayerRegistry",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "escrow",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "depositId",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "amount",
                  "type": "uint256"
                },
                {
                  "internalType": "address",
                  "name": "to",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "verifier",
                  "type": "address"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "address",
                  "name": "referrer",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "referrerFee",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "gatingServiceSignature",
                  "type": "bytes"
                },
                {
                  "internalType": "uint256",
                  "name": "signatureExpiration",
                  "type": "uint256"
                },
                {
                  "internalType": "contract IPostIntentHook",
                  "name": "postIntentHook",
                  "type": "address"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IOrchestrator.SignalIntentParams",
              "name": "_params",
              "type": "tuple"
            }
          ],
          "name": "signalIntent",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "unpauseOrchestrator",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ]
    },
    "PaymentVerifierRegistry": {
      "address": "0x60354e0DFF25404D8722f4dF8640b9103A78Cc3A",
      "abi": [
        {
          "inputs": [],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bool",
              "name": "acceptAll",
              "type": "bool"
            }
          ],
          "name": "AcceptAllVerifiersUpdated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            }
          ],
          "name": "PaymentVerifierAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            }
          ],
          "name": "PaymentVerifierRemoved",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "acceptAllVerifiers",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            }
          ],
          "name": "addPaymentVerifier",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getWhitelistedVerifiers",
          "outputs": [
            {
              "internalType": "address[]",
              "name": "",
              "type": "address[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "isAcceptingAllVerifiers",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "name": "isWhitelistedVerifier",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            }
          ],
          "name": "removePaymentVerifier",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bool",
              "name": "_acceptAll",
              "type": "bool"
            }
          ],
          "name": "setAcceptAllVerifiers",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "verifiers",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ]
    },
    "PostIntentHookRegistry": {
      "address": "0xb1127Bf450140cE90a06556C2e8d3C2CaDC6E185",
      "abi": [
        {
          "inputs": [],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "hook",
              "type": "address"
            }
          ],
          "name": "PostIntentHookAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "hook",
              "type": "address"
            }
          ],
          "name": "PostIntentHookRemoved",
          "type": "event"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_hook",
              "type": "address"
            }
          ],
          "name": "addPostIntentHook",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getWhitelistedHooks",
          "outputs": [
            {
              "internalType": "address[]",
              "name": "",
              "type": "address[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "hooks",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_hook",
              "type": "address"
            }
          ],
          "name": "isWhitelistedHook",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_hook",
              "type": "address"
            }
          ],
          "name": "removePostIntentHook",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "name": "whitelistedHooks",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ]
    },
    "ProtocolViewer": {
      "address": "0xcd8FF17f8d38d4Dd49ed8084BA2B153955f4F844",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrow",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "_orchestrator",
              "type": "address"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "inputs": [],
          "name": "escrowContract",
          "outputs": [
            {
              "internalType": "contract IEscrow",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_account",
              "type": "address"
            }
          ],
          "name": "getAccountDeposits",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "depositId",
                  "type": "uint256"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "depositor",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "delegate",
                      "type": "address"
                    },
                    {
                      "internalType": "contract IERC20",
                      "name": "token",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "amount",
                      "type": "uint256"
                    },
                    {
                      "components": [
                        {
                          "internalType": "uint256",
                          "name": "min",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "max",
                          "type": "uint256"
                        }
                      ],
                      "internalType": "struct IEscrow.Range",
                      "name": "intentAmountRange",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bool",
                      "name": "acceptingIntents",
                      "type": "bool"
                    },
                    {
                      "internalType": "uint256",
                      "name": "remainingDeposits",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "outstandingIntentAmount",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "makerProtocolFee",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "reservedMakerFees",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "accruedMakerFees",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "accruedReferrerFees",
                      "type": "uint256"
                    },
                    {
                      "internalType": "address",
                      "name": "intentGuardian",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "referrer",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "referrerFee",
                      "type": "uint256"
                    }
                  ],
                  "internalType": "struct IEscrow.Deposit",
                  "name": "deposit",
                  "type": "tuple"
                },
                {
                  "internalType": "uint256",
                  "name": "availableLiquidity",
                  "type": "uint256"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "verifier",
                      "type": "address"
                    },
                    {
                      "components": [
                        {
                          "internalType": "address",
                          "name": "intentGatingService",
                          "type": "address"
                        },
                        {
                          "internalType": "string",
                          "name": "payeeDetails",
                          "type": "string"
                        },
                        {
                          "internalType": "bytes",
                          "name": "data",
                          "type": "bytes"
                        }
                      ],
                      "internalType": "struct IEscrow.DepositVerifierData",
                      "name": "verificationData",
                      "type": "tuple"
                    },
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "code",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "uint256",
                          "name": "minConversionRate",
                          "type": "uint256"
                        }
                      ],
                      "internalType": "struct IEscrow.Currency[]",
                      "name": "currencies",
                      "type": "tuple[]"
                    }
                  ],
                  "internalType": "struct IProtocolViewer.VerifierDataView[]",
                  "name": "verifiers",
                  "type": "tuple[]"
                },
                {
                  "internalType": "bytes32[]",
                  "name": "intentHashes",
                  "type": "bytes32[]"
                }
              ],
              "internalType": "struct IProtocolViewer.DepositView[]",
              "name": "depositArray",
              "type": "tuple[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_account",
              "type": "address"
            }
          ],
          "name": "getAccountIntents",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "owner",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "to",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "escrow",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "depositId",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "amount",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "timestamp",
                      "type": "uint256"
                    },
                    {
                      "internalType": "address",
                      "name": "paymentVerifier",
                      "type": "address"
                    },
                    {
                      "internalType": "bytes32",
                      "name": "fiatCurrency",
                      "type": "bytes32"
                    },
                    {
                      "internalType": "uint256",
                      "name": "conversionRate",
                      "type": "uint256"
                    },
                    {
                      "internalType": "address",
                      "name": "referrer",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "referrerFee",
                      "type": "uint256"
                    },
                    {
                      "internalType": "contract IPostIntentHook",
                      "name": "postIntentHook",
                      "type": "address"
                    },
                    {
                      "internalType": "bytes",
                      "name": "data",
                      "type": "bytes"
                    }
                  ],
                  "internalType": "struct IOrchestrator.Intent",
                  "name": "intent",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "internalType": "uint256",
                      "name": "depositId",
                      "type": "uint256"
                    },
                    {
                      "components": [
                        {
                          "internalType": "address",
                          "name": "depositor",
                          "type": "address"
                        },
                        {
                          "internalType": "address",
                          "name": "delegate",
                          "type": "address"
                        },
                        {
                          "internalType": "contract IERC20",
                          "name": "token",
                          "type": "address"
                        },
                        {
                          "internalType": "uint256",
                          "name": "amount",
                          "type": "uint256"
                        },
                        {
                          "components": [
                            {
                              "internalType": "uint256",
                              "name": "min",
                              "type": "uint256"
                            },
                            {
                              "internalType": "uint256",
                              "name": "max",
                              "type": "uint256"
                            }
                          ],
                          "internalType": "struct IEscrow.Range",
                          "name": "intentAmountRange",
                          "type": "tuple"
                        },
                        {
                          "internalType": "bool",
                          "name": "acceptingIntents",
                          "type": "bool"
                        },
                        {
                          "internalType": "uint256",
                          "name": "remainingDeposits",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "outstandingIntentAmount",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "makerProtocolFee",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "reservedMakerFees",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "accruedMakerFees",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "accruedReferrerFees",
                          "type": "uint256"
                        },
                        {
                          "internalType": "address",
                          "name": "intentGuardian",
                          "type": "address"
                        },
                        {
                          "internalType": "address",
                          "name": "referrer",
                          "type": "address"
                        },
                        {
                          "internalType": "uint256",
                          "name": "referrerFee",
                          "type": "uint256"
                        }
                      ],
                      "internalType": "struct IEscrow.Deposit",
                      "name": "deposit",
                      "type": "tuple"
                    },
                    {
                      "internalType": "uint256",
                      "name": "availableLiquidity",
                      "type": "uint256"
                    },
                    {
                      "components": [
                        {
                          "internalType": "address",
                          "name": "verifier",
                          "type": "address"
                        },
                        {
                          "components": [
                            {
                              "internalType": "address",
                              "name": "intentGatingService",
                              "type": "address"
                            },
                            {
                              "internalType": "string",
                              "name": "payeeDetails",
                              "type": "string"
                            },
                            {
                              "internalType": "bytes",
                              "name": "data",
                              "type": "bytes"
                            }
                          ],
                          "internalType": "struct IEscrow.DepositVerifierData",
                          "name": "verificationData",
                          "type": "tuple"
                        },
                        {
                          "components": [
                            {
                              "internalType": "bytes32",
                              "name": "code",
                              "type": "bytes32"
                            },
                            {
                              "internalType": "uint256",
                              "name": "minConversionRate",
                              "type": "uint256"
                            }
                          ],
                          "internalType": "struct IEscrow.Currency[]",
                          "name": "currencies",
                          "type": "tuple[]"
                        }
                      ],
                      "internalType": "struct IProtocolViewer.VerifierDataView[]",
                      "name": "verifiers",
                      "type": "tuple[]"
                    },
                    {
                      "internalType": "bytes32[]",
                      "name": "intentHashes",
                      "type": "bytes32[]"
                    }
                  ],
                  "internalType": "struct IProtocolViewer.DepositView",
                  "name": "deposit",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IProtocolViewer.IntentView[]",
              "name": "intentViews",
              "type": "tuple[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_depositId",
              "type": "uint256"
            }
          ],
          "name": "getDeposit",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "depositId",
                  "type": "uint256"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "depositor",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "delegate",
                      "type": "address"
                    },
                    {
                      "internalType": "contract IERC20",
                      "name": "token",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "amount",
                      "type": "uint256"
                    },
                    {
                      "components": [
                        {
                          "internalType": "uint256",
                          "name": "min",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "max",
                          "type": "uint256"
                        }
                      ],
                      "internalType": "struct IEscrow.Range",
                      "name": "intentAmountRange",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bool",
                      "name": "acceptingIntents",
                      "type": "bool"
                    },
                    {
                      "internalType": "uint256",
                      "name": "remainingDeposits",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "outstandingIntentAmount",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "makerProtocolFee",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "reservedMakerFees",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "accruedMakerFees",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "accruedReferrerFees",
                      "type": "uint256"
                    },
                    {
                      "internalType": "address",
                      "name": "intentGuardian",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "referrer",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "referrerFee",
                      "type": "uint256"
                    }
                  ],
                  "internalType": "struct IEscrow.Deposit",
                  "name": "deposit",
                  "type": "tuple"
                },
                {
                  "internalType": "uint256",
                  "name": "availableLiquidity",
                  "type": "uint256"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "verifier",
                      "type": "address"
                    },
                    {
                      "components": [
                        {
                          "internalType": "address",
                          "name": "intentGatingService",
                          "type": "address"
                        },
                        {
                          "internalType": "string",
                          "name": "payeeDetails",
                          "type": "string"
                        },
                        {
                          "internalType": "bytes",
                          "name": "data",
                          "type": "bytes"
                        }
                      ],
                      "internalType": "struct IEscrow.DepositVerifierData",
                      "name": "verificationData",
                      "type": "tuple"
                    },
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "code",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "uint256",
                          "name": "minConversionRate",
                          "type": "uint256"
                        }
                      ],
                      "internalType": "struct IEscrow.Currency[]",
                      "name": "currencies",
                      "type": "tuple[]"
                    }
                  ],
                  "internalType": "struct IProtocolViewer.VerifierDataView[]",
                  "name": "verifiers",
                  "type": "tuple[]"
                },
                {
                  "internalType": "bytes32[]",
                  "name": "intentHashes",
                  "type": "bytes32[]"
                }
              ],
              "internalType": "struct IProtocolViewer.DepositView",
              "name": "depositView",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256[]",
              "name": "_depositIds",
              "type": "uint256[]"
            }
          ],
          "name": "getDepositFromIds",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "depositId",
                  "type": "uint256"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "depositor",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "delegate",
                      "type": "address"
                    },
                    {
                      "internalType": "contract IERC20",
                      "name": "token",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "amount",
                      "type": "uint256"
                    },
                    {
                      "components": [
                        {
                          "internalType": "uint256",
                          "name": "min",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "max",
                          "type": "uint256"
                        }
                      ],
                      "internalType": "struct IEscrow.Range",
                      "name": "intentAmountRange",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bool",
                      "name": "acceptingIntents",
                      "type": "bool"
                    },
                    {
                      "internalType": "uint256",
                      "name": "remainingDeposits",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "outstandingIntentAmount",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "makerProtocolFee",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "reservedMakerFees",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "accruedMakerFees",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "accruedReferrerFees",
                      "type": "uint256"
                    },
                    {
                      "internalType": "address",
                      "name": "intentGuardian",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "referrer",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "referrerFee",
                      "type": "uint256"
                    }
                  ],
                  "internalType": "struct IEscrow.Deposit",
                  "name": "deposit",
                  "type": "tuple"
                },
                {
                  "internalType": "uint256",
                  "name": "availableLiquidity",
                  "type": "uint256"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "verifier",
                      "type": "address"
                    },
                    {
                      "components": [
                        {
                          "internalType": "address",
                          "name": "intentGatingService",
                          "type": "address"
                        },
                        {
                          "internalType": "string",
                          "name": "payeeDetails",
                          "type": "string"
                        },
                        {
                          "internalType": "bytes",
                          "name": "data",
                          "type": "bytes"
                        }
                      ],
                      "internalType": "struct IEscrow.DepositVerifierData",
                      "name": "verificationData",
                      "type": "tuple"
                    },
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "code",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "uint256",
                          "name": "minConversionRate",
                          "type": "uint256"
                        }
                      ],
                      "internalType": "struct IEscrow.Currency[]",
                      "name": "currencies",
                      "type": "tuple[]"
                    }
                  ],
                  "internalType": "struct IProtocolViewer.VerifierDataView[]",
                  "name": "verifiers",
                  "type": "tuple[]"
                },
                {
                  "internalType": "bytes32[]",
                  "name": "intentHashes",
                  "type": "bytes32[]"
                }
              ],
              "internalType": "struct IProtocolViewer.DepositView[]",
              "name": "depositArray",
              "type": "tuple[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_intentHash",
              "type": "bytes32"
            }
          ],
          "name": "getIntent",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "owner",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "to",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "escrow",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "depositId",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "amount",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "timestamp",
                      "type": "uint256"
                    },
                    {
                      "internalType": "address",
                      "name": "paymentVerifier",
                      "type": "address"
                    },
                    {
                      "internalType": "bytes32",
                      "name": "fiatCurrency",
                      "type": "bytes32"
                    },
                    {
                      "internalType": "uint256",
                      "name": "conversionRate",
                      "type": "uint256"
                    },
                    {
                      "internalType": "address",
                      "name": "referrer",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "referrerFee",
                      "type": "uint256"
                    },
                    {
                      "internalType": "contract IPostIntentHook",
                      "name": "postIntentHook",
                      "type": "address"
                    },
                    {
                      "internalType": "bytes",
                      "name": "data",
                      "type": "bytes"
                    }
                  ],
                  "internalType": "struct IOrchestrator.Intent",
                  "name": "intent",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "internalType": "uint256",
                      "name": "depositId",
                      "type": "uint256"
                    },
                    {
                      "components": [
                        {
                          "internalType": "address",
                          "name": "depositor",
                          "type": "address"
                        },
                        {
                          "internalType": "address",
                          "name": "delegate",
                          "type": "address"
                        },
                        {
                          "internalType": "contract IERC20",
                          "name": "token",
                          "type": "address"
                        },
                        {
                          "internalType": "uint256",
                          "name": "amount",
                          "type": "uint256"
                        },
                        {
                          "components": [
                            {
                              "internalType": "uint256",
                              "name": "min",
                              "type": "uint256"
                            },
                            {
                              "internalType": "uint256",
                              "name": "max",
                              "type": "uint256"
                            }
                          ],
                          "internalType": "struct IEscrow.Range",
                          "name": "intentAmountRange",
                          "type": "tuple"
                        },
                        {
                          "internalType": "bool",
                          "name": "acceptingIntents",
                          "type": "bool"
                        },
                        {
                          "internalType": "uint256",
                          "name": "remainingDeposits",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "outstandingIntentAmount",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "makerProtocolFee",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "reservedMakerFees",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "accruedMakerFees",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "accruedReferrerFees",
                          "type": "uint256"
                        },
                        {
                          "internalType": "address",
                          "name": "intentGuardian",
                          "type": "address"
                        },
                        {
                          "internalType": "address",
                          "name": "referrer",
                          "type": "address"
                        },
                        {
                          "internalType": "uint256",
                          "name": "referrerFee",
                          "type": "uint256"
                        }
                      ],
                      "internalType": "struct IEscrow.Deposit",
                      "name": "deposit",
                      "type": "tuple"
                    },
                    {
                      "internalType": "uint256",
                      "name": "availableLiquidity",
                      "type": "uint256"
                    },
                    {
                      "components": [
                        {
                          "internalType": "address",
                          "name": "verifier",
                          "type": "address"
                        },
                        {
                          "components": [
                            {
                              "internalType": "address",
                              "name": "intentGatingService",
                              "type": "address"
                            },
                            {
                              "internalType": "string",
                              "name": "payeeDetails",
                              "type": "string"
                            },
                            {
                              "internalType": "bytes",
                              "name": "data",
                              "type": "bytes"
                            }
                          ],
                          "internalType": "struct IEscrow.DepositVerifierData",
                          "name": "verificationData",
                          "type": "tuple"
                        },
                        {
                          "components": [
                            {
                              "internalType": "bytes32",
                              "name": "code",
                              "type": "bytes32"
                            },
                            {
                              "internalType": "uint256",
                              "name": "minConversionRate",
                              "type": "uint256"
                            }
                          ],
                          "internalType": "struct IEscrow.Currency[]",
                          "name": "currencies",
                          "type": "tuple[]"
                        }
                      ],
                      "internalType": "struct IProtocolViewer.VerifierDataView[]",
                      "name": "verifiers",
                      "type": "tuple[]"
                    },
                    {
                      "internalType": "bytes32[]",
                      "name": "intentHashes",
                      "type": "bytes32[]"
                    }
                  ],
                  "internalType": "struct IProtocolViewer.DepositView",
                  "name": "deposit",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IProtocolViewer.IntentView",
              "name": "intentView",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32[]",
              "name": "_intentHashes",
              "type": "bytes32[]"
            }
          ],
          "name": "getIntents",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "components": [
                    {
                      "internalType": "address",
                      "name": "owner",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "to",
                      "type": "address"
                    },
                    {
                      "internalType": "address",
                      "name": "escrow",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "depositId",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "amount",
                      "type": "uint256"
                    },
                    {
                      "internalType": "uint256",
                      "name": "timestamp",
                      "type": "uint256"
                    },
                    {
                      "internalType": "address",
                      "name": "paymentVerifier",
                      "type": "address"
                    },
                    {
                      "internalType": "bytes32",
                      "name": "fiatCurrency",
                      "type": "bytes32"
                    },
                    {
                      "internalType": "uint256",
                      "name": "conversionRate",
                      "type": "uint256"
                    },
                    {
                      "internalType": "address",
                      "name": "referrer",
                      "type": "address"
                    },
                    {
                      "internalType": "uint256",
                      "name": "referrerFee",
                      "type": "uint256"
                    },
                    {
                      "internalType": "contract IPostIntentHook",
                      "name": "postIntentHook",
                      "type": "address"
                    },
                    {
                      "internalType": "bytes",
                      "name": "data",
                      "type": "bytes"
                    }
                  ],
                  "internalType": "struct IOrchestrator.Intent",
                  "name": "intent",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "internalType": "uint256",
                      "name": "depositId",
                      "type": "uint256"
                    },
                    {
                      "components": [
                        {
                          "internalType": "address",
                          "name": "depositor",
                          "type": "address"
                        },
                        {
                          "internalType": "address",
                          "name": "delegate",
                          "type": "address"
                        },
                        {
                          "internalType": "contract IERC20",
                          "name": "token",
                          "type": "address"
                        },
                        {
                          "internalType": "uint256",
                          "name": "amount",
                          "type": "uint256"
                        },
                        {
                          "components": [
                            {
                              "internalType": "uint256",
                              "name": "min",
                              "type": "uint256"
                            },
                            {
                              "internalType": "uint256",
                              "name": "max",
                              "type": "uint256"
                            }
                          ],
                          "internalType": "struct IEscrow.Range",
                          "name": "intentAmountRange",
                          "type": "tuple"
                        },
                        {
                          "internalType": "bool",
                          "name": "acceptingIntents",
                          "type": "bool"
                        },
                        {
                          "internalType": "uint256",
                          "name": "remainingDeposits",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "outstandingIntentAmount",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "makerProtocolFee",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "reservedMakerFees",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "accruedMakerFees",
                          "type": "uint256"
                        },
                        {
                          "internalType": "uint256",
                          "name": "accruedReferrerFees",
                          "type": "uint256"
                        },
                        {
                          "internalType": "address",
                          "name": "intentGuardian",
                          "type": "address"
                        },
                        {
                          "internalType": "address",
                          "name": "referrer",
                          "type": "address"
                        },
                        {
                          "internalType": "uint256",
                          "name": "referrerFee",
                          "type": "uint256"
                        }
                      ],
                      "internalType": "struct IEscrow.Deposit",
                      "name": "deposit",
                      "type": "tuple"
                    },
                    {
                      "internalType": "uint256",
                      "name": "availableLiquidity",
                      "type": "uint256"
                    },
                    {
                      "components": [
                        {
                          "internalType": "address",
                          "name": "verifier",
                          "type": "address"
                        },
                        {
                          "components": [
                            {
                              "internalType": "address",
                              "name": "intentGatingService",
                              "type": "address"
                            },
                            {
                              "internalType": "string",
                              "name": "payeeDetails",
                              "type": "string"
                            },
                            {
                              "internalType": "bytes",
                              "name": "data",
                              "type": "bytes"
                            }
                          ],
                          "internalType": "struct IEscrow.DepositVerifierData",
                          "name": "verificationData",
                          "type": "tuple"
                        },
                        {
                          "components": [
                            {
                              "internalType": "bytes32",
                              "name": "code",
                              "type": "bytes32"
                            },
                            {
                              "internalType": "uint256",
                              "name": "minConversionRate",
                              "type": "uint256"
                            }
                          ],
                          "internalType": "struct IEscrow.Currency[]",
                          "name": "currencies",
                          "type": "tuple[]"
                        }
                      ],
                      "internalType": "struct IProtocolViewer.VerifierDataView[]",
                      "name": "verifiers",
                      "type": "tuple[]"
                    },
                    {
                      "internalType": "bytes32[]",
                      "name": "intentHashes",
                      "type": "bytes32[]"
                    }
                  ],
                  "internalType": "struct IProtocolViewer.DepositView",
                  "name": "deposit",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IProtocolViewer.IntentView[]",
              "name": "intentArray",
              "type": "tuple[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "orchestrator",
          "outputs": [
            {
              "internalType": "contract IOrchestrator",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ]
    },
    "RelayerRegistry": {
      "address": "0x02300136d9C819105B8AA79f81417927431F785b",
      "abi": [
        {
          "inputs": [],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "relayer",
              "type": "address"
            }
          ],
          "name": "RelayerAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "relayer",
              "type": "address"
            }
          ],
          "name": "RelayerRemoved",
          "type": "event"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_relayer",
              "type": "address"
            }
          ],
          "name": "addRelayer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getWhitelistedRelayers",
          "outputs": [
            {
              "internalType": "address[]",
              "name": "",
              "type": "address[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "name": "isWhitelistedRelayer",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "relayers",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_relayer",
              "type": "address"
            }
          ],
          "name": "removeRelayer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ]
    },
    "RevolutReclaimVerifier": {
      "address": "0x2caF0167FCE64689B92a8d35d812e84616623491",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrow",
              "type": "address"
            },
            {
              "internalType": "contract INullifierRegistry",
              "name": "_nullifierRegistry",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            },
            {
              "internalType": "bytes32[]",
              "name": "_currencies",
              "type": "bytes32[]"
            },
            {
              "internalType": "string[]",
              "name": "_providerHashes",
              "type": "string[]"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "TimestampBufferSet",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "COMPLETE_PAYMENT_STATUS",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "addCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_newProviderHash",
              "type": "string"
            }
          ],
          "name": "addProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "escrow",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getCurrencies",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getProviderHashes",
          "outputs": [
            {
              "internalType": "string[]",
              "name": "",
              "type": "string[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "name": "isCurrency",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "name": "isProviderHash",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "nullifierRegistry",
          "outputs": [
            {
              "internalType": "contract INullifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "providerHashes",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "removeCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_removeProviderHash",
              "type": "string"
            }
          ],
          "name": "removeProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "setTimestampBuffer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "timestampBuffer",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "address",
                  "name": "depositToken",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "intentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "intentTimestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "depositData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IPaymentVerifier.VerifyPaymentData",
              "name": "_verifyPaymentData",
              "type": "tuple"
            }
          ],
          "name": "verifyPayment",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bool",
                  "name": "success",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "releaseAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes32",
                  "name": "paymentCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "string",
                  "name": "paymentId",
                  "type": "string"
                }
              ],
              "internalType": "struct IPaymentVerifier.PaymentVerificationResult",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "components": [
                    {
                      "internalType": "string",
                      "name": "provider",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "parameters",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "context",
                      "type": "string"
                    }
                  ],
                  "internalType": "struct Claims.ClaimInfo",
                  "name": "claimInfo",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "identifier",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "address",
                          "name": "owner",
                          "type": "address"
                        },
                        {
                          "internalType": "uint32",
                          "name": "timestampS",
                          "type": "uint32"
                        },
                        {
                          "internalType": "uint32",
                          "name": "epoch",
                          "type": "uint32"
                        }
                      ],
                      "internalType": "struct Claims.CompleteClaimData",
                      "name": "claim",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bytes[]",
                      "name": "signatures",
                      "type": "bytes[]"
                    }
                  ],
                  "internalType": "struct Claims.SignedClaim",
                  "name": "signedClaim",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IReclaimVerifier.ReclaimProof",
              "name": "proof",
              "type": "tuple"
            },
            {
              "internalType": "address[]",
              "name": "_witnesses",
              "type": "address[]"
            },
            {
              "internalType": "uint256",
              "name": "_requiredThreshold",
              "type": "uint256"
            }
          ],
          "name": "verifyProofSignatures",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "pure",
          "type": "function"
        }
      ]
    },
    "USDCMock": {
      "address": "0x56dCe1aBa18Da0cd74e93B9AE43560A3DDf0268C",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_mintAmount",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "symbol",
              "type": "string"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "spender",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "value",
              "type": "uint256"
            }
          ],
          "name": "Approval",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "from",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "value",
              "type": "uint256"
            }
          ],
          "name": "Transfer",
          "type": "event"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "spender",
              "type": "address"
            }
          ],
          "name": "allowance",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "spender",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "approve",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "account",
              "type": "address"
            }
          ],
          "name": "balanceOf",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "decimals",
          "outputs": [
            {
              "internalType": "uint8",
              "name": "",
              "type": "uint8"
            }
          ],
          "stateMutability": "pure",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "spender",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "subtractedValue",
              "type": "uint256"
            }
          ],
          "name": "decreaseAllowance",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "spender",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "addedValue",
              "type": "uint256"
            }
          ],
          "name": "increaseAllowance",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "name",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "symbol",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "totalSupply",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "transfer",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "from",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "transferFrom",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ]
    },
    "VenmoReclaimVerifier": {
      "address": "0x6bF49e1d10C6357506e47403d6838c505A150878",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrow",
              "type": "address"
            },
            {
              "internalType": "contract INullifierRegistry",
              "name": "_nullifierRegistry",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            },
            {
              "internalType": "bytes32[]",
              "name": "_currencies",
              "type": "bytes32[]"
            },
            {
              "internalType": "string[]",
              "name": "_providerHashes",
              "type": "string[]"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "TimestampBufferSet",
          "type": "event"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "addCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_newProviderHash",
              "type": "string"
            }
          ],
          "name": "addProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "escrow",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getCurrencies",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getProviderHashes",
          "outputs": [
            {
              "internalType": "string[]",
              "name": "",
              "type": "string[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "name": "isCurrency",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "name": "isProviderHash",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "nullifierRegistry",
          "outputs": [
            {
              "internalType": "contract INullifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "providerHashes",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "removeCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_removeProviderHash",
              "type": "string"
            }
          ],
          "name": "removeProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "setTimestampBuffer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "timestampBuffer",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "address",
                  "name": "depositToken",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "intentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "intentTimestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "depositData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IPaymentVerifier.VerifyPaymentData",
              "name": "_verifyPaymentData",
              "type": "tuple"
            }
          ],
          "name": "verifyPayment",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bool",
                  "name": "success",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "releaseAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes32",
                  "name": "paymentCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "string",
                  "name": "paymentId",
                  "type": "string"
                }
              ],
              "internalType": "struct IPaymentVerifier.PaymentVerificationResult",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "components": [
                    {
                      "internalType": "string",
                      "name": "provider",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "parameters",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "context",
                      "type": "string"
                    }
                  ],
                  "internalType": "struct Claims.ClaimInfo",
                  "name": "claimInfo",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "identifier",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "address",
                          "name": "owner",
                          "type": "address"
                        },
                        {
                          "internalType": "uint32",
                          "name": "timestampS",
                          "type": "uint32"
                        },
                        {
                          "internalType": "uint32",
                          "name": "epoch",
                          "type": "uint32"
                        }
                      ],
                      "internalType": "struct Claims.CompleteClaimData",
                      "name": "claim",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bytes[]",
                      "name": "signatures",
                      "type": "bytes[]"
                    }
                  ],
                  "internalType": "struct Claims.SignedClaim",
                  "name": "signedClaim",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IReclaimVerifier.ReclaimProof",
              "name": "proof",
              "type": "tuple"
            },
            {
              "internalType": "address[]",
              "name": "_witnesses",
              "type": "address[]"
            },
            {
              "internalType": "uint256",
              "name": "_requiredThreshold",
              "type": "uint256"
            }
          ],
          "name": "verifyProofSignatures",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "pure",
          "type": "function"
        }
      ]
    },
    "WiseReclaimVerifier": {
      "address": "0x4805D44114D4d8d3E91F4C461d2C4e48C1a1D359",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrow",
              "type": "address"
            },
            {
              "internalType": "contract INullifierRegistry",
              "name": "_nullifierRegistry",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            },
            {
              "internalType": "bytes32[]",
              "name": "_currencies",
              "type": "bytes32[]"
            },
            {
              "internalType": "string[]",
              "name": "_providerHashes",
              "type": "string[]"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "TimestampBufferSet",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "COMPLETE_PAYMENT_STATUS",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "addCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_newProviderHash",
              "type": "string"
            }
          ],
          "name": "addProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "escrow",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getCurrencies",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getProviderHashes",
          "outputs": [
            {
              "internalType": "string[]",
              "name": "",
              "type": "string[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "name": "isCurrency",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "name": "isProviderHash",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "nullifierRegistry",
          "outputs": [
            {
              "internalType": "contract INullifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "providerHashes",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "removeCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_removeProviderHash",
              "type": "string"
            }
          ],
          "name": "removeProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "setTimestampBuffer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "timestampBuffer",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "address",
                  "name": "depositToken",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "intentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "intentTimestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "depositData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IPaymentVerifier.VerifyPaymentData",
              "name": "_verifyPaymentData",
              "type": "tuple"
            }
          ],
          "name": "verifyPayment",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bool",
                  "name": "success",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "releaseAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes32",
                  "name": "paymentCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "string",
                  "name": "paymentId",
                  "type": "string"
                }
              ],
              "internalType": "struct IPaymentVerifier.PaymentVerificationResult",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "components": [
                    {
                      "internalType": "string",
                      "name": "provider",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "parameters",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "context",
                      "type": "string"
                    }
                  ],
                  "internalType": "struct Claims.ClaimInfo",
                  "name": "claimInfo",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "identifier",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "address",
                          "name": "owner",
                          "type": "address"
                        },
                        {
                          "internalType": "uint32",
                          "name": "timestampS",
                          "type": "uint32"
                        },
                        {
                          "internalType": "uint32",
                          "name": "epoch",
                          "type": "uint32"
                        }
                      ],
                      "internalType": "struct Claims.CompleteClaimData",
                      "name": "claim",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bytes[]",
                      "name": "signatures",
                      "type": "bytes[]"
                    }
                  ],
                  "internalType": "struct Claims.SignedClaim",
                  "name": "signedClaim",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IReclaimVerifier.ReclaimProof",
              "name": "proof",
              "type": "tuple"
            },
            {
              "internalType": "address[]",
              "name": "_witnesses",
              "type": "address[]"
            },
            {
              "internalType": "uint256",
              "name": "_requiredThreshold",
              "type": "uint256"
            }
          ],
          "name": "verifyProofSignatures",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "pure",
          "type": "function"
        }
      ]
    },
    "ZelleBaseVerifier": {
      "address": "0x6577d3645f8fE66833E9B927B37798a4f303EA90",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_escrow",
              "type": "address"
            },
            {
              "internalType": "contract INullifierRegistry",
              "name": "_nullifierRegistry",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            },
            {
              "internalType": "bytes32[]",
              "name": "_currencies",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "CurrencyRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint8",
              "name": "paymentMethod",
              "type": "uint8"
            }
          ],
          "name": "PaymentMethodVerifierRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint8",
              "name": "paymentMethod",
              "type": "uint8"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "verifier",
              "type": "address"
            }
          ],
          "name": "PaymentMethodVerifierSet",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "TimestampBufferSet",
          "type": "event"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "addCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "escrow",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getCurrencies",
          "outputs": [
            {
              "internalType": "bytes32[]",
              "name": "",
              "type": "bytes32[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "name": "isCurrency",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "nullifierRegistry",
          "outputs": [
            {
              "internalType": "contract INullifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint8",
              "name": "",
              "type": "uint8"
            }
          ],
          "name": "paymentMethodToVerifier",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "_currencyCode",
              "type": "bytes32"
            }
          ],
          "name": "removeCurrency",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint8",
              "name": "_paymentMethod",
              "type": "uint8"
            }
          ],
          "name": "removePaymentMethodVerifier",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint8",
              "name": "_paymentMethod",
              "type": "uint8"
            },
            {
              "internalType": "address",
              "name": "_verifier",
              "type": "address"
            }
          ],
          "name": "setPaymentMethodVerifier",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "setTimestampBuffer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "timestampBuffer",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "address",
                  "name": "depositToken",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "intentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "intentTimestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "depositData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IPaymentVerifier.VerifyPaymentData",
              "name": "_verifyPaymentData",
              "type": "tuple"
            }
          ],
          "name": "verifyPayment",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bool",
                  "name": "success",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "releaseAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes32",
                  "name": "paymentCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "string",
                  "name": "paymentId",
                  "type": "string"
                }
              ],
              "internalType": "struct IPaymentVerifier.PaymentVerificationResult",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ]
    },
    "ZelleBoAReclaimVerifier": {
      "address": "0xc94BCbb3DE1Fb69D113b2766172cF484738c3ac1",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_baseVerifier",
              "type": "address"
            },
            {
              "internalType": "contract INullifierRegistry",
              "name": "_nullifierRegistry",
              "type": "address"
            },
            {
              "internalType": "string[]",
              "name": "_providerHashes",
              "type": "string[]"
            },
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "newTimestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "TimestampBufferSet",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "COMPLETED_STATUS",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_newProviderHash",
              "type": "string"
            }
          ],
          "name": "addProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "baseVerifier",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getProviderHashes",
          "outputs": [
            {
              "internalType": "string[]",
              "name": "",
              "type": "string[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "name": "isProviderHash",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "nullifierRegistry",
          "outputs": [
            {
              "internalType": "contract INullifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "providerHashes",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_removeProviderHash",
              "type": "string"
            }
          ],
          "name": "removeProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "setTimestampBuffer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "timestampBuffer",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "address",
                  "name": "depositToken",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "intentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "intentTimestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "depositData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IPaymentVerifier.VerifyPaymentData",
              "name": "_verifyPaymentData",
              "type": "tuple"
            }
          ],
          "name": "verifyPayment",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bool",
                  "name": "success",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "releaseAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes32",
                  "name": "paymentCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "string",
                  "name": "paymentId",
                  "type": "string"
                }
              ],
              "internalType": "struct IPaymentVerifier.PaymentVerificationResult",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "components": [
                    {
                      "internalType": "string",
                      "name": "provider",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "parameters",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "context",
                      "type": "string"
                    }
                  ],
                  "internalType": "struct Claims.ClaimInfo",
                  "name": "claimInfo",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "identifier",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "address",
                          "name": "owner",
                          "type": "address"
                        },
                        {
                          "internalType": "uint32",
                          "name": "timestampS",
                          "type": "uint32"
                        },
                        {
                          "internalType": "uint32",
                          "name": "epoch",
                          "type": "uint32"
                        }
                      ],
                      "internalType": "struct Claims.CompleteClaimData",
                      "name": "claim",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bytes[]",
                      "name": "signatures",
                      "type": "bytes[]"
                    }
                  ],
                  "internalType": "struct Claims.SignedClaim",
                  "name": "signedClaim",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IReclaimVerifier.ReclaimProof",
              "name": "proof",
              "type": "tuple"
            },
            {
              "internalType": "address[]",
              "name": "_witnesses",
              "type": "address[]"
            },
            {
              "internalType": "uint256",
              "name": "_requiredThreshold",
              "type": "uint256"
            }
          ],
          "name": "verifyProofSignatures",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "pure",
          "type": "function"
        }
      ]
    },
    "ZelleChaseReclaimVerifier": {
      "address": "0xB162C6E900E49065fF7283A402e60BCD98BAd0d5",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_baseVerifier",
              "type": "address"
            },
            {
              "internalType": "contract INullifierRegistry",
              "name": "_nullifierRegistry",
              "type": "address"
            },
            {
              "internalType": "string[]",
              "name": "_providerHashes",
              "type": "string[]"
            },
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "newTimestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "TimestampBufferSet",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "COMPLETED_STATUS",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "DELIVERED_STATUS",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_newProviderHash",
              "type": "string"
            }
          ],
          "name": "addProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "baseVerifier",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getProviderHashes",
          "outputs": [
            {
              "internalType": "string[]",
              "name": "",
              "type": "string[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "name": "isProviderHash",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "nullifierRegistry",
          "outputs": [
            {
              "internalType": "contract INullifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "providerHashes",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_removeProviderHash",
              "type": "string"
            }
          ],
          "name": "removeProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "setTimestampBuffer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "timestampBuffer",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "address",
                  "name": "depositToken",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "intentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "intentTimestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "depositData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IPaymentVerifier.VerifyPaymentData",
              "name": "_verifyPaymentData",
              "type": "tuple"
            }
          ],
          "name": "verifyPayment",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bool",
                  "name": "success",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "releaseAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes32",
                  "name": "paymentCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "string",
                  "name": "paymentId",
                  "type": "string"
                }
              ],
              "internalType": "struct IPaymentVerifier.PaymentVerificationResult",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "components": [
                    {
                      "internalType": "string",
                      "name": "provider",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "parameters",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "context",
                      "type": "string"
                    }
                  ],
                  "internalType": "struct Claims.ClaimInfo",
                  "name": "claimInfo",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "identifier",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "address",
                          "name": "owner",
                          "type": "address"
                        },
                        {
                          "internalType": "uint32",
                          "name": "timestampS",
                          "type": "uint32"
                        },
                        {
                          "internalType": "uint32",
                          "name": "epoch",
                          "type": "uint32"
                        }
                      ],
                      "internalType": "struct Claims.CompleteClaimData",
                      "name": "claim",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bytes[]",
                      "name": "signatures",
                      "type": "bytes[]"
                    }
                  ],
                  "internalType": "struct Claims.SignedClaim",
                  "name": "signedClaim",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IReclaimVerifier.ReclaimProof",
              "name": "proof",
              "type": "tuple"
            },
            {
              "internalType": "address[]",
              "name": "_witnesses",
              "type": "address[]"
            },
            {
              "internalType": "uint256",
              "name": "_requiredThreshold",
              "type": "uint256"
            }
          ],
          "name": "verifyProofSignatures",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "pure",
          "type": "function"
        }
      ]
    },
    "ZelleCitiReclaimVerifier": {
      "address": "0xAAefE9CdF9b4B4372c53B04Cc8D586DC0AdE2EEa",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "_baseVerifier",
              "type": "address"
            },
            {
              "internalType": "contract INullifierRegistry",
              "name": "_nullifierRegistry",
              "type": "address"
            },
            {
              "internalType": "string[]",
              "name": "_providerHashes",
              "type": "string[]"
            },
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashAdded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "providerHash",
              "type": "string"
            }
          ],
          "name": "ProviderHashRemoved",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "newTimestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "TimestampBufferSet",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "DELIVERED_STATUS",
          "outputs": [
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_newProviderHash",
              "type": "string"
            }
          ],
          "name": "addProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "baseVerifier",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getProviderHashes",
          "outputs": [
            {
              "internalType": "string[]",
              "name": "",
              "type": "string[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "name": "isProviderHash",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "nullifierRegistry",
          "outputs": [
            {
              "internalType": "contract INullifierRegistry",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "providerHashes",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_removeProviderHash",
              "type": "string"
            }
          ],
          "name": "removeProviderHash",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "_timestampBuffer",
              "type": "uint256"
            }
          ],
          "name": "setTimestampBuffer",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "timestampBuffer",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "internalType": "bytes",
                  "name": "paymentProof",
                  "type": "bytes"
                },
                {
                  "internalType": "address",
                  "name": "depositToken",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "intentAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "intentTimestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "payeeDetails",
                  "type": "string"
                },
                {
                  "internalType": "bytes32",
                  "name": "fiatCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "conversionRate",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes",
                  "name": "depositData",
                  "type": "bytes"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                }
              ],
              "internalType": "struct IPaymentVerifier.VerifyPaymentData",
              "name": "_verifyPaymentData",
              "type": "tuple"
            }
          ],
          "name": "verifyPayment",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "bool",
                  "name": "success",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "intentHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint256",
                  "name": "releaseAmount",
                  "type": "uint256"
                },
                {
                  "internalType": "bytes32",
                  "name": "paymentCurrency",
                  "type": "bytes32"
                },
                {
                  "internalType": "string",
                  "name": "paymentId",
                  "type": "string"
                }
              ],
              "internalType": "struct IPaymentVerifier.PaymentVerificationResult",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "components": [
                {
                  "components": [
                    {
                      "internalType": "string",
                      "name": "provider",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "parameters",
                      "type": "string"
                    },
                    {
                      "internalType": "string",
                      "name": "context",
                      "type": "string"
                    }
                  ],
                  "internalType": "struct Claims.ClaimInfo",
                  "name": "claimInfo",
                  "type": "tuple"
                },
                {
                  "components": [
                    {
                      "components": [
                        {
                          "internalType": "bytes32",
                          "name": "identifier",
                          "type": "bytes32"
                        },
                        {
                          "internalType": "address",
                          "name": "owner",
                          "type": "address"
                        },
                        {
                          "internalType": "uint32",
                          "name": "timestampS",
                          "type": "uint32"
                        },
                        {
                          "internalType": "uint32",
                          "name": "epoch",
                          "type": "uint32"
                        }
                      ],
                      "internalType": "struct Claims.CompleteClaimData",
                      "name": "claim",
                      "type": "tuple"
                    },
                    {
                      "internalType": "bytes[]",
                      "name": "signatures",
                      "type": "bytes[]"
                    }
                  ],
                  "internalType": "struct Claims.SignedClaim",
                  "name": "signedClaim",
                  "type": "tuple"
                }
              ],
              "internalType": "struct IReclaimVerifier.ReclaimProof",
              "name": "proof",
              "type": "tuple"
            },
            {
              "internalType": "address[]",
              "name": "_witnesses",
              "type": "address[]"
            },
            {
              "internalType": "uint256",
              "name": "_requiredThreshold",
              "type": "uint256"
            }
          ],
          "name": "verifyProofSignatures",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "pure",
          "type": "function"
        }
      ]
    }
  }
} as const;