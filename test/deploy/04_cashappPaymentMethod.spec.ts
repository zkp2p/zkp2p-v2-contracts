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
  getCashappReclaimProviderHashes,
  CASHAPP_RECLAIM_TIMESTAMP_BUFFER,
  CASHAPP_RECLAIM_CURRENCIES,
  CASHAPP_PAYMENT_METHOD_HASH,
} from "../../deployments/verifiers/cashapp_reclaim";

const expect = getWaffleExpect();

describe("CashApp Payment Method Configuration", () => {
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
    it("should add CashApp payment method to the registry", async () => {
      const isPaymentMethod = await paymentVerifierRegistry.isPaymentMethod(CASHAPP_PAYMENT_METHOD_HASH);
      expect(isPaymentMethod).to.be.true;
    });

    it("should add CashApp currencies to the registry", async () => {
      const currencies = await paymentVerifierRegistry.getCurrencies(CASHAPP_PAYMENT_METHOD_HASH);
      expect(currencies).to.deep.eq(CASHAPP_RECLAIM_CURRENCIES);
    });
  });

  describe("Unified Verifier Configuration", async () => {
    it("should add CashApp payment method to unified verifier", async () => {
      const paymentMethods = await unifiedPaymentVerifier.getPaymentMethods();
      expect(paymentMethods).to.include(CASHAPP_PAYMENT_METHOD_HASH);
    });

    it("should set the correct timestamp buffer for CashApp", async () => {
      const timestampBuffer = await unifiedPaymentVerifier.getTimestampBuffer(CASHAPP_PAYMENT_METHOD_HASH);
      expect(timestampBuffer).to.eq(CASHAPP_RECLAIM_TIMESTAMP_BUFFER);
    });

    it("should set the correct provider hashes for CashApp", async () => {
      const providerHashes = await unifiedPaymentVerifier.getProviderHashes(CASHAPP_PAYMENT_METHOD_HASH);
      const expectedHashes = await getCashappReclaimProviderHashes(20);
      expect(providerHashes).to.deep.eq(expectedHashes);
    });
  });

});
