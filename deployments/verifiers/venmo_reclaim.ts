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
  '0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fd',
  '0xec9a8c3fc521fef9a805fe97babb505856569a137c88dd4ec3a3c293082a4dbd',
  '0xa418bd79c7b7d49360af56e6ae96ae087742474da03fea0e99b919e093a8aebc',
  '0x52d1835e47c7cdcadb5f15e81bb1c870d304a5d0511f4d5ae8037c31c24cf0d3',
  '0xaa9825c58cbb0a6b42f20a7d926bb3eff6068243fed8da7f86baf0467f7bd45b',
  '0x694206270d22f47fd1f0acd12242700ace67bd6f629026a8ac43157c5d0b9b53',
  '0x2d0e9b6a4c10fd4c5daa0d1b8e7b57a800de7bfd20968fea366d3ef2fc68ae36',
  '0xf857aa76140222b43cd6096f2dbce3f952be598b0b749f1d250d8dbd1540da93',
  '0x355e435a6195179da0b88b894babb806c5a8cd86010d516276bd7810e013f00a',
  '0x2b2fb88b503f1862d6c7d507465355eb49ad54e3a67bb1c2b0216af3ed3f42d7'
]


export const VENMO_OLD_APPCLIP_PROVIDER_HASHES = [
  "0x14de8b5503a4a6973bbaa9aa301ec7843e9bcaa3af05e6610b54c6fcc56aa425"
]

export const VENMO_APPCLIP_PROVIDER_HASHES = [
  "0xdc3505a6f5dd7255197394680a426672247489bfc5b50ad9f263289a9b47d74e"
]

export const VENMO_RECLAIM_CURRENCIES: any = [
  Currency.USD,
];

export const VENMO_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const VENMO_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(30),  // 30% of sustainability fee
  "sepolia": BigNumber.from(30),  // 30% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
}
