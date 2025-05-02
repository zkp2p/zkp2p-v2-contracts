import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getZelleCitiReclaimProviderHashes = async (length: number) => {
  const hashes: string[] = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://online.citi.com/gcgapi/prod/public/v1/p2ppayments/pastActivityTransactions?transactionCount=20&pageId=0&tab=All",
        method: "GET",
        responseMatches: [
          {
            "type": "regex",
            "value": "\"paymentID\":\"(?<paymentID>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"paymentStatus\":\"(?<paymentStatus>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"updatedTimeStamp\":\"(?<updatedTimeStamp>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"amount\":\"(?<amount>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"partyToken\":\"(?<partyToken>[^\"]+)\"",
            "hash": true
          }
        ],
        responseRedactions: [
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].paymentID`,
            "xPath": ""
          },
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].paymentStatus`,
            "xPath": ""
          },
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].updatedTimeStamp`,
            "xPath": ""
          },
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].amount`,
            "xPath": ""
          },
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].partyToken`,
            "xPath": ""
          }
        ],
      }
    );
    hashes.push(hashed);
  }
  return hashes;
}

export const getZelleChaseReclaimProviderHashes = async (length: number) => {
  const hashes: string[] = [];
  for (let i = 0; i < length; i++) {
    const listHashes = hashProviderParams(
      {
        url: "https://secure.chase.com/svc/rr/payments/secure/v1/quickpay/payment/activity/list",
        method: "POST",
        responseMatches: [
          {
            "type": "regex",
            "value": "\"id\":(?<id>[0-9]+)"
          },
          {
            "type": "regex",
            "value": "\"status\":\"(?<status>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"date\":\"(?<date>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"amount\":(?<amount>[0-9\\.]+)"
          }
        ],
        responseRedactions: [
          {
            "jsonPath": `$.listItems[${i}].id`,
            "xPath": ""
          },
          {
            "jsonPath": `$.listItems[${i}].status`,
            "xPath": ""
          },
          {
            "jsonPath": `$.listItems[${i}].date`,
            "xPath": ""
          },
          {
            "jsonPath": `$.listItems[${i}].amount`,
            "xPath": ""
          }
        ],
      }
    );
    hashes.push(listHashes);
  }

  const detailsHash = hashProviderParams(
    {
      url: "https://secure.chase.com/svc/rr/payments/secure/v1/quickpay/payment/activity/detail/list",
      method: "POST",
      responseMatches: [
        {
          "type": "regex",
          "value": "\"recipientEmail\":\"(?<recipientEmail>[^\"]+)\"",
          "hash": true
        }
      ],
      responseRedactions: [
        {
          "jsonPath": "$.recipientEmail",
          "xPath": ""
        }
      ]
    }
  )
  hashes.push(detailsHash);

  return hashes;
}

export const getZelleBoAReclaimProviderHashes = async (length: number) => {
  const hashes: string[] = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://secure.bankofamerica.com/ogateway/payment-activity/api/v4/activity",
        method: "POST",
        responseMatches: [
          {
            "type": "regex",
            "value": "\"confirmationNumber\":\"(?<confirmationNumber>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"status\":\"(?<status>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"transactionDate\":\"(?<transactionDate>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"amount\":(?<amount>[0-9\\.]+)"
          },
          {
            "type": "regex",
            "value": "\"aliasToken\":\"(?<aliasToken>[^\"]+)\"",
            "hash": true
          }
        ],
        responseRedactions: [
          {
            "jsonPath": `$.completedTransactions[${i}].confirmationNumber`,
            "xPath": ""
          },
          {
            "jsonPath": `$.completedTransactions[${i}].status`,
            "xPath": ""
          },
          {
            "jsonPath": `$.completedTransactions[${i}].transactionDate`,
            "xPath": ""
          },
          {
            "jsonPath": `$.completedTransactions[${i}].amount`,
            "xPath": ""
          },
          {
            "jsonPath": `$.completedTransactions[${i}].targetAccount.aliasToken`,
            "xPath": ""
          }
        ],
      }
    );
    hashes.push(hashed);
  }
  return hashes;
}

export const ZELLE_APPCLIP_PROVIDER_HASHES = []

export const ZELLE_RECLAIM_CURRENCIES: any = [
  Currency.USD
];

export const ZELLE_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const ZELLE_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(0),  // 0% of sustainability fee
  "sepolia": BigNumber.from(0),  // 0% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
}
