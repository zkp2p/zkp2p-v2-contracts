import { BigNumber } from "ethers";
import paypalTemplate from "@zkp2p/providers/paypal/transfer_paypal.json";

import { calculatePaymentMethodHash, Currency } from "@utils/protocolUtils";
import { computeProviderHashesFromJson, ProviderConfig } from "@utils/providers/providerAdapter";

export const getPaypalProviderHashes = (length: number = 1) => {
  return computeProviderHashesFromJson(paypalTemplate as any, length);
}

export const PAYPAL_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("paypal");

export const PAYPAL_CURRENCIES: any = [
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.SGD,
  Currency.NZD,
  Currency.AUD,
  Currency.CAD
];

export const PAYPAL_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const PAYPAL_PROVIDER_CONFIG: ProviderConfig = {
  paymentMethodHash: PAYPAL_PAYMENT_METHOD_HASH,
  currencies: PAYPAL_CURRENCIES,
  timestampBuffer: PAYPAL_TIMESTAMP_BUFFER,
  providerHashes: getPaypalProviderHashes(1)
};

