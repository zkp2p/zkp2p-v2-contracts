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
            "value": `"subType":"(none|business_profile)"`,
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

// Date: 24 July 2025
// Update: Enforce p2p and business profile transactions only
export const VENMO_OLD_EXTENSION_PROVIDER_HASHES = [
  "0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fd",
  "0xec9a8c3fc521fef9a805fe97babb505856569a137c88dd4ec3a3c293082a4dbd",
  "0xa418bd79c7b7d49360af56e6ae96ae087742474da03fea0e99b919e093a8aebc",
  "0x52d1835e47c7cdcadb5f15e81bb1c870d304a5d0511f4d5ae8037c31c24cf0d3",
  "0xaa9825c58cbb0a6b42f20a7d926bb3eff6068243fed8da7f86baf0467f7bd45b",
  "0x694206270d22f47fd1f0acd12242700ace67bd6f629026a8ac43157c5d0b9b53",
  "0x2d0e9b6a4c10fd4c5daa0d1b8e7b57a800de7bfd20968fea366d3ef2fc68ae36",
  "0xf857aa76140222b43cd6096f2dbce3f952be598b0b749f1d250d8dbd1540da93",
  "0x355e435a6195179da0b88b894babb806c5a8cd86010d516276bd7810e013f00a",
  "0x2b2fb88b503f1862d6c7d507465355eb49ad54e3a67bb1c2b0216af3ed3f42d7",
  "0xdc3505a6f5dd7255197394680a426672247489bfc5b50ad9f263289a9b47d74e",
  "0xfff1a0130fa96e14545786e9615917330f520d3c18e55d1cad176d135fb78d16",
  "0x654a9ad85aef525c1f46ae1003b6fc57f4ad93b1df15b8e05419cf0e285d973c",
  "0x709569cc5850c23c4d8966524137d40b82d3056949fb0912be29a10803784a75",
  "0x4377776e47d7f6ca0d0032c6f9097e6887c9eab7113405d3ec49c2e63074ece1",
  "0x65ef2e26a5842ff4802f26f44dd09e43435192c352fd2cc3779afeaa16b26a2d",
  "0x02cbd3676d313b0653d7bc6ec2140da8bc99249f80f44fa87a1add3cccada48d",
  "0x9e14bbc62dd63527f04b36f8ec22f0733c75200ba54c055445e338cb5b9adeb6",
  "0x433d4902fb2c435533e5b6189b369de2b54d284e6f3d6ff04922aa46bf0c794c",
  "0x83f0fd04d1a711071d8887cc69b5fa5efb947496f54e7aafdc76b65616369adb",
  "0x558d53f060a9cad7fabd34e9fa9dbe0f3886ca6f36aa610824d1c4f863297d45"
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
