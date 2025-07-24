import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getMercadoReclaimProviderHashes = async (length: number) => {
  const hashed = hashProviderParams(
    {
      url: "https://api.monzo.com/transactions/{{TX_ID}}",
      method: "GET",
      body: "",
      responseMatches: [
        {
          "type": "regex",
          "value": "\"amount\":(?<amount>[0-9\\-]+)"
        },
        {
          "type": "regex",
          "value": "\"settled\":\"(?<completedDate>[^\"]+)\""
        },
        {
          "type": "regex",
          "value": "\"user_id\":\"(?<userId>[^\"]+)\"",
          "hash": true
        },
        {
          "type": "regex",
          "value": "\"scheme\":\"p2p_payment\""
        },
        {
          "type": "regex",
          "value": "\"currency\":\"(?<currency>[^\"]+)\""
        },
        {
          "type": "regex",
          "value": "\"hold_decision_status\":\"decision_status\\.released\""
        }
      ],
      responseRedactions: [
        {
          "jsonPath": "$.transaction.amount",
          "xPath": ""
        },
        {
          "jsonPath": "$.transaction.settled",
          "xPath": ""
        },
        {
          "jsonPath": "$.transaction.counterparty.user_id",
          "xPath": ""
        },
        {
          "jsonPath": "$.transaction.scheme",
          "xPath": ""
        },
        {
          "jsonPath": "$.transaction.currency",
          "xPath": ""
        },
        {
          "jsonPath": "$.transaction.metadata.hold_decision_status",
          "xPath": ""
        }
      ]
    }
  );

  return [hashed];
}

export const MERCADO_APPCLIP_PROVIDER_HASHES = []

export const MERCADO_RECLAIM_CURRENCIES: any = [
  Currency.ARS
];

// Date: 24 July 2025
export const MERCADO_OLD_EXTENSION_PROVIDER_HASHES = [
  '0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee'
]


export const MERCADO_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const MERCADO_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(0),  // 0% of sustainability fee
  "sepolia": BigNumber.from(0),  // 0% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
  "base_sepolia": BigNumber.from(0),  // 0% of sustainability fee
}
