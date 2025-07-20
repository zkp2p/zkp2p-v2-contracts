import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";

export const MONZO_RECLAIM_PROVIDER_HASHES = [
  "0x84ddc30f67565667fb6a68855d19905e30624601b9d584736c6befaf2217077b"
];

export const MONZO_RECLAIM_CURRENCIES: any = [
  Currency.GBP,
];

export const MONZO_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const MONZO_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(0),  // 0% of sustainability fee
  "sepolia": BigNumber.from(0),  // 0% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
  "base_sepolia": BigNumber.from(0),  // 0% of sustainability fee
}