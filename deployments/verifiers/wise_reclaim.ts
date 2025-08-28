import { BigNumber, ethers } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getWiseReclaimProviderHashes = async (length: number) => {
  const hashed = hashProviderParams({
    url: "https://wise.com/gateway/v3/profiles/{{PROFILE_ID}}/transfers/{{TRANSACTION_ID}}",
    method: "GET",
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
        "value": "\"targetRecipientId\":(?<targetRecipientId>[0-9]+)"
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
    ],
  });

  return [hashed];
}

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
];

// 0x554a007c2217df766b977723b276671aee5ebb4adaea0edb6433c88b3e61dac5
export const WISE_PAYMENT_METHOD_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("wise"));

export const WISE_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds
