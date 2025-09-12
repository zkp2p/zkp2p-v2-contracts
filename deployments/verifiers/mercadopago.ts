import { BigNumber, ethers } from "ethers";
import { calculatePaymentMethodHash, Currency } from "@utils/protocolUtils";

export const MERCADOPAGO_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("mercadopago");

export const MERCADOPAGO_CURRENCIES: any = [
  Currency.ARS
];

export const MERCADOPAGO_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const MERCADOPAGO_PROVIDER_CONFIG = {
  paymentMethodHash: MERCADOPAGO_PAYMENT_METHOD_HASH,
  currencies: MERCADOPAGO_CURRENCIES,
  timestampBuffer: MERCADOPAGO_TIMESTAMP_BUFFER
};
