import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";

export const CASHAPP_RECLAIM_PROVIDER_HASHES: any = [
  "0x5e3b19d2559f94bb09ec06bb3b11a099f47af374d54c8b98ee21efa3054357b1",
];

export const CASHAPP_RECLAIM_CURRENCIES: any = [
  Currency.USD,
];

export const CASHAPP_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const CASHAPP_RECLAIM_FEE_SHARE = BigNumber.from(30);  // 30% of sustainability fee
