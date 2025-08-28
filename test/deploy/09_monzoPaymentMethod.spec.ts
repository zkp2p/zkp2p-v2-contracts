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
  getMonzoReclaimProviderHashes,
  MONZO_RECLAIM_TIMESTAMP_BUFFER,
  MONZO_RECLAIM_CURRENCIES,
  MONZO_PAYMENT_METHOD_HASH
} from "../../deployments/verifiers/monzo_reclaim";

const expect = getWaffleExpect();

describe("Monzo Payment Method Configuration", () => {
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
    it("should add Monzo payment method to the registry", async () => {
      const isPaymentMethod = await paymentVerifierRegistry.isPaymentMethod(MONZO_PAYMENT_METHOD_HASH);
      expect(isPaymentMethod).to.be.true;
    });

    it("should add Monzo currencies to the registry", async () => {
      const currencies = await paymentVerifierRegistry.getCurrencies(MONZO_PAYMENT_METHOD_HASH);
      expect(currencies).to.deep.eq(MONZO_RECLAIM_CURRENCIES);
    });

    it("should only support GBP currency for Monzo", async () => {
      const currencies = await paymentVerifierRegistry.getCurrencies(MONZO_PAYMENT_METHOD_HASH);
      // Monzo only supports GBP
      expect(currencies.length).to.eq(1);
      expect(currencies[0]).to.eq(MONZO_RECLAIM_CURRENCIES[0]);
    });
  });

  describe("Unified Verifier Configuration", async () => {
    it("should add Monzo payment method to unified verifier", async () => {
      const paymentMethods = await unifiedPaymentVerifier.getPaymentMethods();
      expect(paymentMethods).to.include(MONZO_PAYMENT_METHOD_HASH);
    });

    it("should set the correct timestamp buffer for Monzo", async () => {
      const timestampBuffer = await unifiedPaymentVerifier.getTimestampBuffer(MONZO_PAYMENT_METHOD_HASH);
      expect(timestampBuffer).to.eq(MONZO_RECLAIM_TIMESTAMP_BUFFER);
    });

    it("should set the correct provider hashes for Monzo", async () => {
      const providerHashes = await unifiedPaymentVerifier.getProviderHashes(MONZO_PAYMENT_METHOD_HASH);
      const expectedHashes = await getMonzoReclaimProviderHashes();
      expect(providerHashes).to.deep.eq(expectedHashes);
    });

    it("should have exactly one provider hash for Monzo", async () => {
      const providerHashes = await unifiedPaymentVerifier.getProviderHashes(MONZO_PAYMENT_METHOD_HASH);
      // Monzo returns single transaction details, not an array
      expect(providerHashes.length).to.eq(1);
    });
  });

});