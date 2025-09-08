import { BigNumber } from "ethers";
import revolutTemplate from "@zkp2p/providers/revolut/transfer_revolut.json";

import { calculatePaymentMethodHash, Currency } from "@utils/protocolUtils";
import { computeProviderHashesFromJson, ProviderConfig } from "@utils/providers/providerAdapter";

export const getRevolutProviderHashes = (length: number) => {
  return computeProviderHashesFromJson(revolutTemplate as any, length);
}

// 0x617f88ab82b5c1b014c539f7e75121427f0bb50a4c58b187a238531e7d58605d
export const REVOLUT_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("revolut");

export const REVOLUT_CURRENCIES: any = [
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.SGD,
  Currency.NZD,
  Currency.AUD,
  Currency.CAD,
  Currency.JPY,    // unified verifier handles decimals
  Currency.HKD,
  Currency.MXN,
  Currency.SAR,
  Currency.AED,
  Currency.THB,
  Currency.TRY,
  Currency.PLN,
  Currency.CHF,
  Currency.ZAR
];

export const REVOLUT_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const REVOLUT_PROVIDER_CONFIG: ProviderConfig = {
  paymentMethodHash: REVOLUT_PAYMENT_METHOD_HASH,
  currencies: REVOLUT_CURRENCIES,
  timestampBuffer: REVOLUT_TIMESTAMP_BUFFER,
  providerHashes: getRevolutProviderHashes(20)
};

