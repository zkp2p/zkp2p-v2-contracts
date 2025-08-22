import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";
import { 
  getVenmoReclaimProviderHashes,
  VENMO_RECLAIM_CURRENCIES,
  VENMO_RECLAIM_TIMESTAMP_BUFFER 
} from "./venmo_reclaim";
import { 
  getCashappReclaimProviderHashes,
  CASHAPP_RECLAIM_CURRENCIES,
  CASHAPP_RECLAIM_TIMESTAMP_BUFFER 
} from "./cashapp_reclaim";
import { 
  getRevolutReclaimProviderHashes,
  REVOLUT_RECLAIM_CURRENCIES,
  REVOLUT_RECLAIM_TIMESTAMP_BUFFER 
} from "./revolut_reclaim";
import { 
  getWiseReclaimProviderHashes,
  WISE_RECLAIM_CURRENCIES,
  WISE_RECLAIM_TIMESTAMP_BUFFER 
} from "./wise_reclaim";
import { 
  getMercadoReclaimProviderHashes,
  MERCADO_RECLAIM_CURRENCIES,
  MERCADO_RECLAIM_TIMESTAMP_BUFFER 
} from "./mercado_pago_reclaim";
import { 
  getZelleCitiReclaimProviderHashes,
  getZelleChaseReclaimProviderHashes,
  getZelleBoAReclaimProviderHashes,
  ZELLE_RECLAIM_CURRENCIES,
  ZELLE_RECLAIM_TIMESTAMP_BUFFER 
} from "./zelle_reclaim";
import { ONE_DAY_IN_SECONDS } from "@utils/constants";

export interface PaymentMethodConfig {
  paymentMethodName: string;
  timestampBuffer: BigNumber;
  currencies: string[];
  providerHashes: string[];
}

export interface UnifiedVerifierConfig {
  paymentMethods: PaymentMethodConfig[];
}

// Helper function to create provider hashes for a payment method
export const createProviderHashes = async (
  paymentMethodName: string, 
  count: number = 10
): Promise<string[]> => {
  switch (paymentMethodName.toLowerCase()) {
    case "venmo":
      return await getVenmoReclaimProviderHashes(count);
    case "cashapp":
      return await getCashappReclaimProviderHashes(count);
    case "revolut":
      return await getRevolutReclaimProviderHashes(count);
    case "wise":
      return await getWiseReclaimProviderHashes(count);
    case "mercadopago":
      return await getMercadoReclaimProviderHashes(count);
    case "zelle-citi":
      return await getZelleCitiReclaimProviderHashes(count);
    case "zelle-chase":
      return await getZelleChaseReclaimProviderHashes(count);
    case "zelle-bofa":
      return await getZelleBoAReclaimProviderHashes(count);
    default:
      throw new Error(`Unknown payment method: ${paymentMethodName}`);
  }
};

// Get unified verifier configuration for deployment
export const getUnifiedVerifierConfig = async (): Promise<UnifiedVerifierConfig> => {
  const paymentMethods: PaymentMethodConfig[] = [
    {
      paymentMethodName: "venmo",
      timestampBuffer: VENMO_RECLAIM_TIMESTAMP_BUFFER,
      currencies: VENMO_RECLAIM_CURRENCIES,
      providerHashes: await createProviderHashes("venmo", 10),
    },
    {
      paymentMethodName: "cashapp", 
      timestampBuffer: CASHAPP_RECLAIM_TIMESTAMP_BUFFER,
      currencies: CASHAPP_RECLAIM_CURRENCIES,
      providerHashes: await createProviderHashes("cashapp", 10),
    },
    {
      paymentMethodName: "revolut",
      timestampBuffer: REVOLUT_RECLAIM_TIMESTAMP_BUFFER,
      currencies: REVOLUT_RECLAIM_CURRENCIES,
      providerHashes: await createProviderHashes("revolut", 10),
    },
    {
      paymentMethodName: "wise",
      timestampBuffer: WISE_RECLAIM_TIMESTAMP_BUFFER,
      currencies: WISE_RECLAIM_CURRENCIES,
      providerHashes: await createProviderHashes("wise", 10),
    },
    {
      paymentMethodName: "mercadopago",
      timestampBuffer: MERCADO_RECLAIM_TIMESTAMP_BUFFER,
      currencies: MERCADO_RECLAIM_CURRENCIES,
      providerHashes: await createProviderHashes("mercadopago", 10),
    },
    {
      paymentMethodName: "zelle-citi",
      timestampBuffer: ZELLE_RECLAIM_TIMESTAMP_BUFFER.citi,
      currencies: ZELLE_RECLAIM_CURRENCIES,
      providerHashes: await createProviderHashes("zelle-citi", 10),
    },
    {
      paymentMethodName: "zelle-chase",
      timestampBuffer: ZELLE_RECLAIM_TIMESTAMP_BUFFER.chase,
      currencies: ZELLE_RECLAIM_CURRENCIES,
      providerHashes: await createProviderHashes("zelle-chase", 10),
    },
    {
      paymentMethodName: "zelle-bofa",
      timestampBuffer: ZELLE_RECLAIM_TIMESTAMP_BUFFER.bofa,
      currencies: ZELLE_RECLAIM_CURRENCIES,
      providerHashes: await createProviderHashes("zelle-bofa", 10),
    },
  ];

  return { paymentMethods };
};

// Configuration for witness-based verifier (Generic payments)
export const WITNESS_VERIFIER_CONFIG = {
  paymentMethodName: "generic",
  timestampBuffer: BigNumber.from(60000), // 60 seconds in milliseconds
  currencies: [Currency.USD, Currency.EUR, Currency.GBP],
  // Dummy provider hash for witness-based verification (contract requires at least one)
  // This hash won't be used for verification since it's witness-based, not zkTLS-based
  providerHashes: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
};

// Helper to get payment method hash
export const getPaymentMethodHash = (paymentMethodName: string): string => {
  return require("ethers").utils.keccak256(
    require("ethers").utils.toUtf8Bytes(paymentMethodName.toLowerCase())
  );
};