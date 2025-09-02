import { BigNumber, ethers } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getMonzoReclaimProviderHashes = async (
  /*length: number*/
) => {
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
};

export const MONZO_RECLAIM_CURRENCIES: any = [
  Currency.GBP,
];

export const MONZO_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const MONZO_PAYMENT_METHOD_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("monzo"));
