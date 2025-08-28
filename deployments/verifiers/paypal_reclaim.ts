import { BigNumber, ethers } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getPaypalReclaimProviderHashes = async (
  /*length: number*/
) => {
  const hashed = hashProviderParams(
    {
      url: "https://www.paypal.com/myaccount/activities/details/inline/{{PAYMENT_ID}}",
      method: "GET",
      body: "",
      responseMatches: [
        {
          "type": "regex",
          "value": "\"email\":\"(?<recvId>[^\"]+)\"",
        },
        {
          "type": "regex",
          "value": "\"isPersonal\":true"
        },
        {
          "type": "regex",
          "value": "\"value\":\"(?<amt>[^\"]+)\""
        },
        {
          "type": "regex",
          "value": "\"currencyCode\":\"(?<curr>[^\"]+)\""
        },
        {
          "type": "regex",
          "value": "\"status\":\"(?<status>[^\"]+)\""
        },
        {
          "type": "regex",
          "value": "\"primitiveTimeCreated\":\"(?<date>[^\"]+)\""
        }
      ],
      responseRedactions: [
        {
          "jsonPath": "$.data.p2pRedirect.repeatTxn.email",
          "xPath": ""
        },
        {
          "jsonPath": "$.data.p2pRedirect.repeatTxn.isPersonal",
          "xPath": ""
        },
        {
          "jsonPath": "$.data.amount.rawAmounts.gross.value",
          "xPath": ""
        },
        {
          "jsonPath": "$.data.amount.rawAmounts.gross.currencyCode",
          "xPath": ""
        },
        {
          "jsonPath": "$.data.status",
          "xPath": ""
        },
        {
          "jsonPath": "$.data.primitiveTimeCreated",
          "xPath": ""
        }
      ]
    }
  );

  return [hashed];
};

export const PAYPAL_RECLAIM_CURRENCIES: any = [
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.SGD,
  Currency.NZD,
  Currency.AUD,
  Currency.CAD
];

// July 26 2025
export const PAYPAL_OLD_EXTENSION_PROVIDER_HASHES = [
  '0xa57a091019928a7e6d22e7851b12abcc26f12b1a21e3b5d98fea002cdd1061fd'
];

export const PAYPAL_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const PAYPAL_PAYMENT_METHOD_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("paypal"));

