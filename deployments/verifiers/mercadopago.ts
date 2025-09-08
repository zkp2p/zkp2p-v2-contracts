import { BigNumber, ethers } from "ethers";
import mercadopagoTemplate from "@zkp2p/providers/mercadopago/transfer_mercado_pago.json";

import { calculatePaymentMethodHash, Currency } from "@utils/protocolUtils";
import { computeProviderHashesFromJson, ProviderConfig } from "@utils/providers/providerAdapter";

export const getMercadopagoProviderHashes = (length: number) => {
  return computeProviderHashesFromJson(mercadopagoTemplate as any, length);
}

export const MERCADOPAGO_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("mercadopago");

export const MERCADOPAGO_CURRENCIES: any = [
  Currency.ARS
];

export const MERCADOPAGO_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const MERCADOPAGO_PROVIDER_CONFIG: ProviderConfig = {
  paymentMethodHash: MERCADOPAGO_PAYMENT_METHOD_HASH,
  currencies: MERCADOPAGO_CURRENCIES,
  timestampBuffer: MERCADOPAGO_TIMESTAMP_BUFFER,
  providerHashes: getMercadopagoProviderHashes(1)
};

