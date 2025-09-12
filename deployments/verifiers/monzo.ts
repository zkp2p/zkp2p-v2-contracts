import { BigNumber, ethers } from "ethers";
import { calculatePaymentMethodHash, Currency } from "@utils/protocolUtils";

export const MONZO_PAYMENT_METHOD_HASH = calculatePaymentMethodHash("monzo");

export const MONZO_CURRENCIES: any = [
  Currency.GBP,
];

export const MONZO_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const MONZO_PROVIDER_CONFIG = {
  paymentMethodHash: MONZO_PAYMENT_METHOD_HASH,
  currencies: MONZO_CURRENCIES,
  timestampBuffer: MONZO_TIMESTAMP_BUFFER
};
