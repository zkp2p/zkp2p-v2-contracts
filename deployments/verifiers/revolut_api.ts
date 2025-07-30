import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";

// Revolut Business API configuration
export const REVOLUT_API_RECLAIM_ATTESTOR = "0x244897572368eadf65bfbc5aec98d8e5443a9072";

export const REVOLUT_API_CURRENCIES: any = [
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.SGD,
  Currency.AUD,
  Currency.CAD,
  Currency.CHF,
];

export const REVOLUT_API_TIMESTAMP_BUFFER = BigNumber.from(3600); // 1 hour buffer

export const REVOLUT_API_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(30),  // 30% of sustainability fee
  "sepolia": BigNumber.from(30),  // 30% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
  "base_sepolia": BigNumber.from(0),  // 0% of sustainability fee
}