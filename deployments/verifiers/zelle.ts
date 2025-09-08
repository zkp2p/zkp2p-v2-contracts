import zelleCitiTemplate from "@zkp2p/providers/citi/transfer_zelle.json";
import zelleChaseTemplate from "@zkp2p/providers/chase/transfer_zelle.json";
import zelleBofaTemplate from "@zkp2p/providers/bankofamerica/transfer_zelle.json";

import { calculatePaymentMethodHash, Currency } from "@utils/protocolUtils";
import { ONE_DAY_IN_SECONDS } from "@utils/constants";
import { computeProviderHashesFromJson, ProviderConfig } from "@utils/providers/providerAdapter";

export const getZelleCitiProviderHashes = (length: number) => {
  return computeProviderHashesFromJson(zelleCitiTemplate as any, length);
}

export const getZelleChaseProviderHashes = (length: number) => {
  return computeProviderHashesFromJson(zelleChaseTemplate as any, length, { includeAdditionalProofsOnce: true });
}

export const getZelleBoAProviderHashes = (length: number) => {
  return computeProviderHashesFromJson(zelleBofaTemplate as any, length);
}

export const ZELLE_CURRENCIES: any = [
  Currency.USD
];

// Payment method hashes
export const ZELLE_CITI_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("zelle-citi");
export const ZELLE_CHASE_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("zelle-chase");
export const ZELLE_BOFA_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("zelle-bofa");

export const ZELLE_CITI_PROVIDER_CONFIG: ProviderConfig = {
  paymentMethodHash: ZELLE_CITI_PAYMENT_METHOD_HASH,
  currencies: ZELLE_CURRENCIES,
  timestampBuffer: ONE_DAY_IN_SECONDS,
  providerHashes: getZelleCitiProviderHashes(20)
};

export const ZELLE_CHASE_PROVIDER_CONFIG: ProviderConfig = {
  paymentMethodHash: ZELLE_CHASE_PAYMENT_METHOD_HASH,
  currencies: ZELLE_CURRENCIES,
  timestampBuffer: ONE_DAY_IN_SECONDS,
  providerHashes: getZelleChaseProviderHashes(10)
};

export const ZELLE_BOFA_PROVIDER_CONFIG: ProviderConfig = {
  paymentMethodHash: ZELLE_BOFA_PAYMENT_METHOD_HASH,
  currencies: ZELLE_CURRENCIES,
  timestampBuffer: ONE_DAY_IN_SECONDS,
  providerHashes: getZelleBoAProviderHashes(10)
};

