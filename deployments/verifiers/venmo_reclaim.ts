import { BigNumber, ethers } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getVenmoReclaimProviderHashes = async (length: number) => {
  const hashes = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}",
        method: "GET",
        body: "",
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
          },
          {
            "type": "regex",
            "value": `"subType":"(none|business_profile)"`
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
          {
            "jsonPath": `$.stories[${i}].subType`,
            "xPath": "",
          },
        ]
      }
    )
    hashes.push(hashed);
  }
  return hashes;
}

// 0x90262a3db0edd0be2369c6b28f9e8511ec0bac7136cefbada0880602f87e7268
export const VENMO_PAYMENT_METHOD_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("venmo"));


export const VENMO_RECLAIM_CURRENCIES: any = [
  Currency.USD,
];

export const VENMO_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds
