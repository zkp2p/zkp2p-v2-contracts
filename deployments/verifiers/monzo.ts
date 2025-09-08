import { BigNumber, ethers } from "ethers";
import monzoTemplate from "@zkp2p/providers/monzo/transfer_monzo.json";

import { calculatePaymentMethodHash, Currency } from "@utils/protocolUtils";
import { computeProviderHashesFromJson, ProviderConfig } from "@utils/providers/providerAdapter";

export const getMonzoProviderHashes = (length: number = 1) => {
  return computeProviderHashesFromJson(monzoTemplate as any, length);
}

export const MONZO_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("monzo");

export const MONZO_CURRENCIES: any = [
  Currency.GBP,
];

export const MONZO_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const MONZO_PROVIDER_CONFIG: ProviderConfig = {
  paymentMethodHash: MONZO_PAYMENT_METHOD_HASH,
  currencies: MONZO_CURRENCIES,
  timestampBuffer: MONZO_TIMESTAMP_BUFFER,
  providerHashes: getMonzoProviderHashes(1)
};

