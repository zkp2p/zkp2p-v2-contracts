import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getMercadoReclaimProviderHashes = async (length: number) => {
  return [
    '0x7b7114ae280564c2b832837ddeb836001d813ba3572325497fe87a1ad59ab548'
  ]
}

export const MERCADO_APPCLIP_PROVIDER_HASHES = [
  '0afc40bd-83b7-46f1-9027-eebc5c3fd5c1'
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
