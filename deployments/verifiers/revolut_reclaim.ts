import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getRevolutReclaimProviderHashes = async (length: number) => {
  const hashes = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://app.revolut.com/api/retail/user/current/transactions/last?count=20",
        method: "GET",
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
            "hash": true
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


export const REVOLUT_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds
