import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getMercadoReclaimProviderHashes = async (length: number) => {
  return [
    '0x19d7a93c70b8cd149bb6ffc5497b64d62b5073be0f734a16395e938440362ac6'
  ]
}

export const MERCADO_APPCLIP_PROVIDER_HASHES = []

export const MERCADO_RECLAIM_CURRENCIES: any = [
  Currency.ARS
];

export const MERCADO_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const MERCADO_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(0),  // 0% of sustainability fee
  "sepolia": BigNumber.from(0),  // 0% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
}
