import { BigNumber } from "ethers";
import { Currency, getKeccak256Hash } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getWiseReclaimProviderHashes = async (length: number) => {
  const hashed = hashProviderParams(
    {
      url: "https://wise.com/gateway/v3/profiles/{{PROFILE_ID}}/transfers/{{TRANSACTION_ID}}",
      method: "GET",
      body: "",
      responseMatches: [
        {
          "type": "regex",
          "value": "\"id\":(?<paymentId>[0-9]+)"
        },
        {
          "type": "regex",
          "value": "\"state\":\"(?<state>[^\"]+)\""
        },
        {
          "type": "regex",
          "value": "\"state\":\"OUTGOING_PAYMENT_SENT\",\"date\":(?<timestamp>[0-9]+)"
        },
        {
          "type": "regex",
          "value": "\"targetAmount\":(?<targetAmount>[0-9\\.]+)"
        },
        {
          "type": "regex",
          "value": "\"targetCurrency\":\"(?<targetCurrency>[^\"]+)\""
        },
        {
          "type": "regex",
          "value": "\"targetRecipientId\":(?<targetRecipientId>[0-9]+)",
          "hash": true
        }
      ],
      responseRedactions: [
        {
          "jsonPath": "$.id",
          "xPath": ""
        },
        {
          "jsonPath": "$.state",
          "xPath": ""
        },
        {
          "jsonPath": "$.stateHistory",
          "xPath": ""
        },
        {
          "jsonPath": "$.targetAmount",
          "xPath": ""
        },
        {
          "jsonPath": "$.targetCurrency",
          "xPath": ""
        },
        {
          "jsonPath": "$.targetRecipientId",
          "xPath": ""
        }
      ]
    }
  );

  return [hashed];
}

export const WISE_APPCLIP_PROVIDER_HASHES = []

// Date: 24 July 2025
export const WISE_OLD_EXTENSION_PROVIDER_HASHES = [
  '0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9646'
]

export const WISE_RECLAIM_CURRENCIES: any = [
  Currency.USD,
  Currency.CNY,
  Currency.EUR,
  Currency.GBP,
  Currency.AUD,
  Currency.NZD,
  Currency.CAD,
  Currency.AED,
  Currency.CHF,
  Currency.ZAR,
  Currency.SGD,
  Currency.ILS,
  Currency.HKD,
  Currency.JPY,
  Currency.PLN,
  Currency.TRY,
  Currency.IDR,
  Currency.KES,
  Currency.MYR,
  Currency.MXN,
  Currency.THB,
  Currency.VND,
  Currency.CZK,
  Currency.DKK,
  Currency.SEK,
  Currency.RON,
  Currency.HUF,
  Currency.PHP,
  Currency.INR,
  Currency.NOK,
];

export const WISE_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const WISE_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(0),  // 0% of sustainability fee
  "sepolia": BigNumber.from(0),  // 0% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
  "base_sepolia": BigNumber.from(0),  // 0% of sustainability fee
}
