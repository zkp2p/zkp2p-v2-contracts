import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getWiseReclaimProviderHashes = async (length: number) => {
  const hashes: string[] = [];
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
            "value": `"paymentId":"(?<paymentId>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"id":"(?<receiverId>[^"]+)"`,
            "hash": true
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
            "jsonPath": `$.stories[${i}].paymentId`,
            "xPath": ""
          },
          {
            "jsonPath": `$.stories[${i}].title.receiver.id`,
            "xPath": "",
          },
        ]
      }
    )
    hashes.push(hashed);
  }
  return hashes;
}

export const WISE_APPCLIP_PROVIDER_HASHES = [
  ""
]

export const WISE_RECLAIM_CURRENCIES: any = [
  Currency.USD,
];

export const WISE_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const WISE_RECLAIM_FEE_SHARE = BigNumber.from(0);  // 0% of sustainability fee
