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
import { Account } from "../../utils/test/types";
import { Address } from "../../utils/types";

import { MULTI_SIG } from "../../deployments/parameters";
import {
  ZELLE_CITI_PROVIDER_CONFIG,
  ZELLE_CHASE_PROVIDER_CONFIG,
  ZELLE_BOFA_PROVIDER_CONFIG,
} from "../../deployments/verifiers/zelle";
import {
  ZELLE_CITI_PAYMENT_METHOD_HASH,
  ZELLE_CHASE_PAYMENT_METHOD_HASH,
  ZELLE_BOFA_PAYMENT_METHOD_HASH,
} from "../../deployments/verifiers/zelle";

const expect = getWaffleExpect();

describe("Zelle Payment Methods Configuration", () => {
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
    [deployer] = await getAccounts();
    multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer.address;

    escrowAddress = getDeployedContractAddress(network, "Escrow");
    escrow = new Escrow__factory(deployer.wallet).attach(escrowAddress);

    const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
    paymentVerifierRegistry = new PaymentVerifierRegistry__factory(deployer.wallet).attach(paymentVerifierRegistryAddress);

    const unifiedPaymentVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");
    unifiedPaymentVerifier = new UnifiedPaymentVerifier__factory(deployer.wallet).attach(unifiedPaymentVerifierAddress);
  });

  describe("Zelle Citi Payment Method", () => {
    describe("Payment Method Registry", () => {
      it("should add Zelle Citi payment method to the registry", async () => {
        const isPaymentMethod = await paymentVerifierRegistry.isPaymentMethod(ZELLE_CITI_PAYMENT_METHOD_HASH);
        expect(isPaymentMethod).to.be.true;
      });

      it("should add Zelle Citi currencies to the registry", async () => {
        const currencies = await paymentVerifierRegistry.getCurrencies(ZELLE_CITI_PAYMENT_METHOD_HASH);
        expect(currencies).to.deep.eq(ZELLE_CITI_PROVIDER_CONFIG.currencies);
      });
    });

    describe("Unified Verifier Configuration", () => {
      it("should add Zelle Citi payment method to unified verifier", async () => {
        const paymentMethods = await unifiedPaymentVerifier.getPaymentMethods();
        expect(paymentMethods).to.include(ZELLE_CITI_PAYMENT_METHOD_HASH);
      });

      it("should set the correct timestamp buffer for Zelle Citi", async () => {
        const timestampBuffer = await unifiedPaymentVerifier.getTimestampBuffer(ZELLE_CITI_PAYMENT_METHOD_HASH);
        expect(timestampBuffer).to.eq(ZELLE_CITI_PROVIDER_CONFIG.timestampBuffer);
      });

      it("should set the correct provider hashes for Zelle Citi", async () => {
        const providerHashes = await unifiedPaymentVerifier.getProviderHashes(ZELLE_CITI_PAYMENT_METHOD_HASH);
        const expectedHashes = ZELLE_CITI_PROVIDER_CONFIG.providerHashes;
        expect([...providerHashes].sort()).to.deep.eq([...expectedHashes].sort());
      });
    });
  });

  describe("Zelle Chase Payment Method", () => {
    describe("Payment Method Registry", () => {
      it("should add Zelle Chase payment method to the registry", async () => {
        const isPaymentMethod = await paymentVerifierRegistry.isPaymentMethod(ZELLE_CHASE_PAYMENT_METHOD_HASH);
        expect(isPaymentMethod).to.be.true;
      });

      it("should add Zelle Chase currencies to the registry", async () => {
        const currencies = await paymentVerifierRegistry.getCurrencies(ZELLE_CHASE_PAYMENT_METHOD_HASH);
        expect(currencies).to.deep.eq(ZELLE_CHASE_PROVIDER_CONFIG.currencies);
      });
    });

    describe("Unified Verifier Configuration", () => {
      it("should add Zelle Chase payment method to unified verifier", async () => {
        const paymentMethods = await unifiedPaymentVerifier.getPaymentMethods();
        expect(paymentMethods).to.include(ZELLE_CHASE_PAYMENT_METHOD_HASH);
      });

      it("should set the correct timestamp buffer for Zelle Chase", async () => {
        const timestampBuffer = await unifiedPaymentVerifier.getTimestampBuffer(ZELLE_CHASE_PAYMENT_METHOD_HASH);
        expect(timestampBuffer).to.eq(ZELLE_CHASE_PROVIDER_CONFIG.timestampBuffer);
      });

      it("should set the correct provider hashes for Zelle Chase", async () => {
        const providerHashes = await unifiedPaymentVerifier.getProviderHashes(ZELLE_CHASE_PAYMENT_METHOD_HASH);
        const expectedHashes = ZELLE_CHASE_PROVIDER_CONFIG.providerHashes;
        expect([...providerHashes].sort()).to.deep.eq([...expectedHashes].sort());
      });
    });
  });

  describe("Zelle Bank of America Payment Method", () => {
    describe("Payment Method Registry", () => {
      it("should add Zelle BofA payment method to the registry", async () => {
        const isPaymentMethod = await paymentVerifierRegistry.isPaymentMethod(ZELLE_BOFA_PAYMENT_METHOD_HASH);
        expect(isPaymentMethod).to.be.true;
      });

      it("should add Zelle BofA currencies to the registry", async () => {
        const currencies = await paymentVerifierRegistry.getCurrencies(ZELLE_BOFA_PAYMENT_METHOD_HASH);
        expect(currencies).to.deep.eq(ZELLE_BOFA_PROVIDER_CONFIG.currencies);
      });
    });

    describe("Unified Verifier Configuration", () => {
      it("should add Zelle BofA payment method to unified verifier", async () => {
        const paymentMethods = await unifiedPaymentVerifier.getPaymentMethods();
        expect(paymentMethods).to.include(ZELLE_BOFA_PAYMENT_METHOD_HASH);
      });

      it("should set the correct timestamp buffer for Zelle BofA", async () => {
        const timestampBuffer = await unifiedPaymentVerifier.getTimestampBuffer(ZELLE_BOFA_PAYMENT_METHOD_HASH);
        expect(timestampBuffer).to.eq(ZELLE_BOFA_PROVIDER_CONFIG.timestampBuffer);
      });

      it("should set the correct provider hashes for Zelle BofA", async () => {
        const providerHashes = await unifiedPaymentVerifier.getProviderHashes(ZELLE_BOFA_PAYMENT_METHOD_HASH);
        const expectedHashes = ZELLE_BOFA_PROVIDER_CONFIG.providerHashes;
        expect([...providerHashes].sort()).to.deep.eq([...expectedHashes].sort());
      });
    });
  });
});
