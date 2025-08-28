import { BigNumber, ethers } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";
import { ONE_DAY_IN_SECONDS } from "@utils/constants";

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
            "value": "\"verboseStatus\":\"(?<verboseStatus>[^\"]+)\""
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
            "jsonPath": `$.listItems[${i}].verboseStatus`,
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

  const detailsHash = "0x0f50cfe682d82acfcff1140cfca303d627a9d468764cfa401611d476695ce6cd";
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

export const ZELLE_RECLAIM_CURRENCIES: any = [
  Currency.USD
];

export const ZELLE_RECLAIM_TIMESTAMP_BUFFER = {
  'citi': ONE_DAY_IN_SECONDS,
  'chase': ONE_DAY_IN_SECONDS,
  'bofa': ONE_DAY_IN_SECONDS,
}

// 0x817260692b75e93c7fbc51c71637d4075a975e221e1ebc1abeddfabd731fd90d
export const ZELLE_CITI_PAYMENT_METHOD_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("zelle-citi"));
// 0x6aa1d1401e79ad0549dced8b1b96fb72c41cd02b32a7d9ea1fed54ba9e17152e
export const ZELLE_CHASE_PAYMENT_METHOD_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("zelle-chase"));
// 0x4bc42b322a3ad413b91b2fde30549ca70d6ee900eded1681de91aaf32ffd7ab5
export const ZELLE_BOFA_PAYMENT_METHOD_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("zelle-bofa"));
