import { BigNumber, ethers } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getMercadoReclaimProviderHashes = async (length: number) => {
  const hashes = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://www.mercadopago.com.ar/activities/detail/{{PAYMENT_ID}}?from={{URL_PARAMS_FROM}}",
        method: "GET",
        body: "",
        responseMatches: [
          {
            "type": "regex",
            "value": "v2__detail\">(.*?)CVU: (?<recipientId>[0-9]+)</li>"
          },
          {
            "type": "regex",
            "value": "<span class=\"andes-money-amount__fraction\" aria-hidden=\"true\">(?<amt>[0-9.]+)</span><span aria-hidden=\"true\">,</span><span class=\"andes-money-amount__cents\" aria-hidden=\"true\">(?<cents>[0-9]+)</span>"
          },
          {
            "type": "regex",
            "value": "Total\",\"amount\":{\"currency_id\":\"(?<curr>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": ",\"date\":\"(?<date>[^\"]+)\",\"sections\""
          },
          {
            "type": "regex",
            "value": "\"operationId\":(?<paymentId>[^,]+),\"activityName\":\"(?<paymentType>[^\"]+)\",\"activityStatus\":\"(?<paymentStatus>[^\"]+)\","
          }
        ],
        responseRedactions: [
          {
            "jsonPath": "",
            "xPath": "",
            "regex": "v2__detail\">(.*?)CVU: (.*?)</li>"
          },
          {
            "jsonPath": "",
            "xPath": "",
            "regex": "<span class=\"andes-money-amount__fraction\" aria-hidden=\"true\">(.*?)<\/span><span aria-hidden=\"true\">,<\/span><span class=\"andes-money-amount__cents\" aria-hidden=\"true\">(.*?)<\/span>"
          },
          {
            "jsonPath": "",
            "xPath": "",
            "regex": "\"Total\",\"amount\":{\"currency_id\":\"(.*?)\""
          },
          {
            "jsonPath": "",
            "xPath": "",
            "regex": ",\"date\":\"(.*)\",\"sections\""
          },
          {
            "jsonPath": "",
            "xPath": "",
            "regex": "\"operationId\":(.*?),\"activityName\":\"(.*?)\",\"activityStatus\":\"(.*?),"
          }
        ],
      }
    );
    hashes.push(hashed);
  }
  return hashes;
}

export const MERCADO_RECLAIM_CURRENCIES: any = [
  Currency.ARS
];

export const MERCADOPAGO_PAYMENT_METHOD_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("mercadopago"));

export const MERCADO_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds
