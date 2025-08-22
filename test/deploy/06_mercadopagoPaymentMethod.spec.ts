import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  UnifiedPaymentVerifier,
  PaymentVerifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  UnifiedPaymentVerifier__factory,
  Escrow__factory,
  PaymentVerifierRegistry__factory,
} from "../../typechain";

import {
  getAccounts,
  getWaffleExpect,
} from "../../utils/test";
import {
  Account
} from "../../utils/test/types";
import {
  Address
} from "../../utils/types";

import {
  MULTI_SIG,
} from "../../deployments/parameters";
import {
  getMercadoReclaimProviderHashes,
  MERCADO_RECLAIM_TIMESTAMP_BUFFER,
  MERCADO_RECLAIM_CURRENCIES,
  MERCADOPAGO_PAYMENT_METHOD_HASH,
} from "../../deployments/verifiers/mercado_pago_reclaim";

const expect = getWaffleExpect();

describe("MercadoPago Payment Method Configuration", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let unifiedPaymentVerifier: UnifiedPaymentVerifier;
  let paymentVerifierRegistry: PaymentVerifierRegistry;

  const network: string = deployments.getNetworkName();

  function getDeployedContractAddress(network: string, contractName: string): string {
    return require(`../../deployments/${network}/${contractName}.json`).address;
  }

  before(async () => {
    [
      deployer,
    ] = await getAccounts();

    multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer.address;

    escrowAddress = getDeployedContractAddress(network, "Escrow");
    escrow = new Escrow__factory(deployer.wallet).attach(escrowAddress);

    const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
    paymentVerifierRegistry = new PaymentVerifierRegistry__factory(deployer.wallet).attach(paymentVerifierRegistryAddress);

    const unifiedPaymentVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");
    unifiedPaymentVerifier = new UnifiedPaymentVerifier__factory(deployer.wallet).attach(unifiedPaymentVerifierAddress);
  });

  describe("Payment Method Registry", async () => {
    it("should add MercadoPago payment method to the registry", async () => {
      const isPaymentMethod = await paymentVerifierRegistry.isPaymentMethod(MERCADOPAGO_PAYMENT_METHOD_HASH);
      expect(isPaymentMethod).to.be.true;
    });

    it("should add MercadoPago currencies to the registry", async () => {
      const currencies = await paymentVerifierRegistry.getCurrencies(MERCADOPAGO_PAYMENT_METHOD_HASH);
      expect(currencies).to.deep.eq(MERCADO_RECLAIM_CURRENCIES);
    });
  });

  describe("Unified Verifier Configuration", async () => {
    it("should add MercadoPago payment method to unified verifier", async () => {
      const paymentMethods = await unifiedPaymentVerifier.getPaymentMethods();
      expect(paymentMethods).to.include(MERCADOPAGO_PAYMENT_METHOD_HASH);
    });

    it("should set the correct timestamp buffer for MercadoPago", async () => {
      const timestampBuffer = await unifiedPaymentVerifier.getTimestampBuffer(MERCADOPAGO_PAYMENT_METHOD_HASH);
      expect(timestampBuffer).to.eq(MERCADO_RECLAIM_TIMESTAMP_BUFFER);
    });

    it("should set the correct provider hashes for MercadoPago", async () => {
      const providerHashes = await unifiedPaymentVerifier.getProviderHashes(MERCADOPAGO_PAYMENT_METHOD_HASH);
      const expectedHashes = await getMercadoReclaimProviderHashes(1);
      expect([...providerHashes].sort()).to.deep.eq([...expectedHashes].sort());
    });
  });

});
