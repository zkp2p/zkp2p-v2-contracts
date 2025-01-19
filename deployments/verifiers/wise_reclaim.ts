import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getWiseReclaimProviderHashes = async (length: number) => {
  const hashes: string[] = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://wise.com/gateway/v3/profiles/{PROFILE_ID}/transfers/{TRANSACTION_ID}",
        method: "GET",
        responseMatches: [
          {
            "type": "regex",
            "value": `"id":(?<paymentId>[0-9]+)`,
          },
          {
            "type": "regex",
            "value": `"state":"(?<state>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"state":"OUTGOING_PAYMENT_SENT","date":(?<timestamp>[0-9]+)`,
          },
          {
            "type": "regex",
            "value": `"targetAmount":(?<targetAmount>[0-9\\.]+)`,
          },
          {
            "type": "regex",
            "value": `"targetCurrency":"(?<targetCurrency>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"targetRecipientId":(?<targetRecipientId>[0-9]+)`,
            "hash": true
          },
        ],
        responseRedactions: [
          {
            "jsonPath": `$.id`,
            "xPath": ""
          },
          {
            "jsonPath": `$.state`,
            "xPath": ""
          },
          {
            "jsonPath": `$.stateHistory`,
            "xPath": ""
          },
          {
            "jsonPath": `$.targetAmount`,
            "xPath": ""
          },
          {
            "jsonPath": `$.targetCurrency`,
            "xPath": ""
          },
          {
            "jsonPath": `$.targetRecipientId`,
            "xPath": ""
          },
        ]
      }
    )
    hashes.push(hashed);
  }
  return hashes;
}

export const WISE_APPCLIP_PROVIDER_HASHES = [
  ""
]

export const WISE_RECLAIM_CURRENCIES: any = [
  Currency.EUR,
];

export const WISE_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const WISE_RECLAIM_FEE_SHARE = BigNumber.from(0);  // 0% of sustainability fee
