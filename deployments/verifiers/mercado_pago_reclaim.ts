import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getMercadoReclaimProviderHashes = async (length: number) => {
  return [
    '0x496c6289b4a6aab1c733d4bc871837266e6096172d92a1870f73c46bd37e2aed'
  ]
}

export const MERCADO_APPCLIP_PROVIDER_HASHES = [
  '0x7b7114ae280564c2b832837ddeb836001d813ba3572325497fe87a1ad59ab548'
]

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
