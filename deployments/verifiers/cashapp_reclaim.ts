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
        body: "{\"activity_token\":{\"activity_token_type\":\"CUSTOMER_TOKEN\",\"token\":\"{{SENDER_ID}}\"},\"activity_scope\":\"MY_ACTIVITY_WEB_V2\",\"page_size\":15,\"request_context\":{}}",
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

export const CASHAPP_APPCLIP_PROVIDER_HASHES = []

// Date: 24 July 2025
export const CASHAPP_OLD_EXTENSION_PROVIDER_HASHES = [
  '0x5e3b19d2559f94bb09ec06bb3b11a099f47af374d54c8b98ee21efa3054357b1',
  '0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a5',
  '0x007b71e8851d3164bb11ae5c87752d736ccd13d7c4da61ac4b6ef9656f9914c3',
  '0x94ec5a7a93a6cec9f698feb873cbcdfac7713e43e3ec7668733fea3d6ac76490',
  '0xea57e3cfddd27da488a4978ca409fce18fe1807e4a497097843e422bbcd8362d',
  '0x3cd9eec85a149743ac863ae77413035b351216c83390b5ebbf8079ad32b7941d',
  '0xa43372a0495ac5112be6e9c137ab47e89d2b40f2d1f1e99c539d956d893e36b1',
  '0xa5887be699d240b0c68eb2776c5b1376996abc47086d7bb5d23aff4c92afbcb0',
  '0xb4c0c5aae02661ad30a5ea9694c0d8042d97e60f27a2c500049087c69ac5a02b',
  '0xcd8f73c4deb3f3b68125102787da671bf08285578914aea229153398a13ec0bf',
  '0x20bdb76eb88364dec7e206ea36ea33143e9b4c198f5e8694907a08b7a7c33527',
  '0x93acc7ec44813fcc3d154413e990f6d5f6212402d4535a7aa93d26df557f47c3',
  '0xc3b9e2179a485c105e90900788a55347d8559630432cb6903409dcba151006c7',
  '0xdf0c89146134ac843a5d9a7ab44a7985a0a8b0602d4f5ef6d0d99cc88fe84dd9',
  '0x94ccfdf3ec40b72c280cce190d0d8164a5653bf2838fc1f29d8b7d1b01d210a1'
]


export const CASHAPP_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const CASHAPP_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(30),  // 30% of sustainability fee
  "sepolia": BigNumber.from(30),  // 30% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
  "base_sepolia": BigNumber.from(0),  // 0% of sustainability fee
}