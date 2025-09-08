import { BigNumber } from "ethers";
import wiseTemplate from "@zkp2p/providers/wise/transfer_wise.json";

import { calculatePaymentMethodHash, Currency } from "@utils/protocolUtils";
import { computeProviderHashesFromJson, ProviderConfig } from "@utils/providers/providerAdapter";

export const getWiseProviderHashes = (length: number) => {
  return computeProviderHashesFromJson(wiseTemplate as any, length);
}

// 0x554a007c2217df766b977723b276671aee5ebb4adaea0edb6433c88b3e61dac5
export const WISE_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("wise");

export const WISE_CURRENCIES: any = [
  Currency.USD,
  Currency.CNY,
  Currency.EUR,
  Currency.GBP,
  Currency.AUD,
  Currency.NZD,
  Currency.CAD,
  Currency.AED,
  Currency.CHF,
  Currency.ZAR,
  Currency.SGD,
  Currency.ILS,
  Currency.HKD,
  Currency.JPY,
  Currency.PLN,
  Currency.TRY,
  Currency.IDR,
  Currency.KES,
  Currency.MYR,
  Currency.MXN,
  Currency.THB,
  Currency.VND,
];

export const WISE_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const WISE_PROVIDER_CONFIG: ProviderConfig = {
  paymentMethodHash: WISE_PAYMENT_METHOD_HASH,
  currencies: WISE_CURRENCIES,
  timestampBuffer: WISE_TIMESTAMP_BUFFER,
  providerHashes: getWiseProviderHashes(1)
};

