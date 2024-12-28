import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";

export const REVOLUT_RECLAIM_PROVIDER_HASHES: any = [
  "0xd5850d39a47e17f5a546e8de045c1bb3a22228beebf8f3f943db759f46e330c6",
];

export const REVOLUT_RECLAIM_CURRENCIES: any = [
  Currency.EUR,
  Currency.GBP,
  Currency.USD,
  Currency.SGD,
];

export const REVOLUT_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const REVOLUT_RECLAIM_FEE_SHARE = BigNumber.from(30);  // 30% of sustainability fee
