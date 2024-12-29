import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getCashappReclaimProviderHashes = async (length: number) => {
  const hashes = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://cash.app/cash-app/activity/v1.0/page",
        method: "POST",
        responseMatches: [
          {
            "type": "regex",
            "value": `"amount":(?<amount>[0-9]+)`,
          },
          {
            "type": "regex",
            "value": `"currency_code":"(?<currency_code>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"display_date":(?<date>[0-9]+)`,
          },
          {
            "type": "regex",
            "value": `"cashtag":"(?<receiverId>[^"]+)"`,
            "hash": true
          },
          {
            "type": "regex",
            "value": `"token":"(?<paymentId>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"state":"(?<state>[^"]+)"`,
          },
        ],
        responseRedactions: [
          {
            "jsonPath": `$.activity_rows[${i}].payment_history_inputs_row.payment.amount.amount`,
            "xPath": ""
          },
          {
            "jsonPath": `$.activity_rows[${i}].payment_history_inputs_row.payment.amount.currency_code`,
            "xPath": ""
          },
          {
            "jsonPath": `$.activity_rows[${i}].payment_history_inputs_row.payment.display_date`,
            "xPath": ""
          },
          {
            "jsonPath": `$.activity_rows[${i}].payment_history_inputs_row.recipient.cashtag`,
            "xPath": ""
          },
          {
            "jsonPath": `$.activity_rows[${i}].payment_history_inputs_row.payment.token`,
            "xPath": ""
          },
          {
            "jsonPath": `$.activity_rows[${i}].payment_history_inputs_row.payment.state`,
            "xPath": ""
          }
        ],
      }
    );
    hashes.push(hashed);
  }
  return hashes;
};

export const CASHAPP_RECLAIM_CURRENCIES: any = [
  Currency.USD,
];

export const CASHAPP_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const CASHAPP_RECLAIM_FEE_SHARE = BigNumber.from(30);  // 30% of sustainability fee
