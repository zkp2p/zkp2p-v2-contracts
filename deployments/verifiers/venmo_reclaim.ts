import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getVenmoReclaimProviderHashes = async (length: number) => {
  const hashes = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}",
        method: "GET",
        responseMatches: [
          {
            "type": "regex",
            "value": `"amount":"- \\$(?<amount>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"date":"(?<date>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"receiver":\\{"id":"(?<receiverId>[^"]+)"`,
            "hash": true
          },
          {
            "type": "regex",
            "value": `"paymentId":"(?<paymentId>[^"]+)"`,
          },
        ],
        responseRedactions: [
          {
            "jsonPath": `$.stories[${i}].amount`,
            "xPath": ""
          },
          {
            "jsonPath": `$.stories[${i}].date`,
            "xPath": ""
          },
          {
            "jsonPath": `$.stories[${i}].title.receiver`,
            "xPath": ""
          },
          {
            "jsonPath": `$.stories[${i}].paymentId`,
            "xPath": ""
          }
        ]
      }
    )
    hashes.push(hashed);
  }
  return hashes;
}

export const VENMO_RECLAIM_CURRENCIES: any = [
  Currency.USD,
];

export const VENMO_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const VENMO_RECLAIM_FEE_SHARE = BigNumber.from(30);  // 30% of sustainability fee
