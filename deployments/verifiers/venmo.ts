import { BigNumber } from "ethers";
import venmoTemplate from "@zkp2p/providers/venmo/transfer_venmo.json";

import { calculatePaymentMethodHash, Currency } from "@utils/protocolUtils";
import { computeProviderHashesFromJson, ProviderConfig } from "@utils/providers/providerAdapter";

export const getVenmoProviderHashes = (length: number) => {
  return computeProviderHashesFromJson(venmoTemplate as any, length);
}

// 0x90262a3db0edd0be2369c6b28f9e8511ec0bac7136cefbada0880602f87e7268
export const VENMO_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("venmo");


export const VENMO_CURRENCIES: any = [
  Currency.USD,
];

export const VENMO_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const VENMO_PROVIDER_CONFIG: ProviderConfig = {
  paymentMethodHash: VENMO_PAYMENT_METHOD_HASH,
  currencies: VENMO_CURRENCIES,
  timestampBuffer: VENMO_TIMESTAMP_BUFFER,
  providerHashes: getVenmoProviderHashes(10)
};