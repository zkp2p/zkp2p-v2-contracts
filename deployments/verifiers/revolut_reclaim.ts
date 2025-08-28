import { BigNumber, ethers } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getRevolutReclaimProviderHashes = async (length: number) => {
  const hashes = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://app.revolut.com/api/retail/user/current/transactions/last?count=20",
        method: "GET",
        body: "",
        responseMatches: [
          {
            "type": "regex",
            "value": `"amount":(?<amount>[0-9\\-]+)`,
          },
          {
            "type": "regex",
            "value": `"completedDate":(?<completedDate>[0-9]+)`,
          },
          {
            "type": "regex",
            "value": `"currency":"(?<currency>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"id":"(?<id>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"state":"(?<state>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"username":"(?<username>[^"]+)"`,
          },
        ],
        responseRedactions: [
          {
            "jsonPath": `$.[${i}].amount`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].completedDate`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].currency`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].id`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].recipient.username`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].state`,
            "xPath": ""
          },
        ]
      }
    )
    hashes.push(hashed);
  }
  return hashes;
};

export const REVOLUT_RECLAIM_CURRENCIES: any = [
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.SGD,
  Currency.NZD,
  Currency.AUD,
  Currency.CAD,
  // Currency.JPY,    // Does not has 2 decimal places parsing; hence removed
  Currency.HKD,
  Currency.MXN,
  Currency.SAR,
  Currency.AED,
  Currency.THB,
  Currency.TRY,
  Currency.PLN,
  Currency.CHF,
  Currency.ZAR
];

// 0x617f88ab82b5c1b014c539f7e75121427f0bb50a4c58b187a238531e7d58605d
export const REVOLUT_PAYMENT_METHOD_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("revolut"));

export const REVOLUT_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds
