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
            "value": `"paymentId":"(?<paymentId>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"id":"(?<receiverId>[^"]+)"`,
            "hash": true
          },
          {
            "type": "regex",
            "value": `"subType":"none"`, // This is to prevent business payments which charge 2% fees
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

// Date: 5 March 2024
// Update: Enforce p2p transactions only
export const VENMO_OLD_EXTENSION_PROVIDER_HASHES = [
  '0x355e37a5769297ad515f5909054c3874ac5b2f7413dc7ad758e2554c921085af',
  '0xb5067b01d2bbb42723387932adf831a330176a4f6f87b0d4f39507f86b8d9a43',
  '0x1ce2a53e1ad5f1e95773feb94112c18ebf185d2718802a42859b19801bf13a09',
  '0x497f65035466d93e2de72c485f645eed473e691fa8d8900c608406650a2896b2',
  '0x66c112b0fac2ba628d4c058c2deb7f6ee5c68b24de9d984e6efc1729dce9b11b',
  '0x73cd340ba8b874a7a07fba5c5e65065a908a970cae4404d3501183106f46fd74',
  '0x9e8c0bf986f27a474ccfde1c9180cb40d73306c691fae3cf1862110c461ba83c',
  '0xcbe606c9f4f190a578c99d8e10c635d0029805c636c3d982c69a20a9a10fe404',
  '0x5c084f7696c7b5ea85b23c7da714487e9f3b0c95aa5c036c7fc88443ab4b044b',
  '0x1f9bb657d328715a31789af4a1a2f6c1e970ff2e370ae5cd62d8c4f26997fa49'
]


export const VENMO_RECLAIM_CURRENCIES: any = [
  Currency.USD,
];

export const VENMO_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds
