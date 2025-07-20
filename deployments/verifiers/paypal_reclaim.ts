import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";

export const PAYPAL_RECLAIM_PROVIDER_HASHES = [
  "0x14d1dc7bcbacd85b21c65a60eddeda012fd9697c84e00982c14c0d4dc592c500"
];

export const PAYPAL_RECLAIM_CURRENCIES: any = [
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.SGD,
  Currency.NZD,
  Currency.AUD,
  Currency.CAD,
  Currency.JPY
];

export const PAYPAL_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const PAYPAL_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(0),  // 0% of sustainability fee
  "sepolia": BigNumber.from(0),  // 0% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
  "base_sepolia": BigNumber.from(0),  // 0% of sustainability fee
}