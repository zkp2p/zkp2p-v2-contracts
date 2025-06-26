import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  CashappReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  CashappReclaimVerifier__factory,
  NullifierRegistry__factory,
  Escrow__factory,
  PaymentVerifierRegistry,
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
  CASHAPP_RECLAIM_CURRENCIES
} from "../../deployments/verifiers/cashapp_reclaim";

const expect = getWaffleExpect();

describe("CashAppReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let cashappReclaimVerifier: CashappReclaimVerifier;
  let nullifierRegistry: NullifierRegistry;
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

    const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

    const cashappReclaimVerifierAddress = getDeployedContractAddress(network, "CashAppReclaimVerifier");
    cashappReclaimVerifier = new CashappReclaimVerifier__factory(deployer.wallet).attach(cashappReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await cashappReclaimVerifier.owner();
      const actualEscrowAddress = await cashappReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await cashappReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await cashappReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await cashappReclaimVerifier.timestampBuffer();
      const actualCurrencies = await cashappReclaimVerifier.getCurrencies();
      const hashes = await getCashappReclaimProviderHashes(15);

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(actualProviderHashes).to.deep.eq(hashes);
      expect(actualTimestampBuffer).to.eq(CASHAPP_RECLAIM_TIMESTAMP_BUFFER);
      expect(actualCurrencies).to.deep.eq(CASHAPP_RECLAIM_CURRENCIES);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(cashappReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  describe("Payment Verifier Registry", async () => {
    it("should add the CashAppReclaimVerifier to the payment verifier registry", async () => {
      const isWhitelisted = await paymentVerifierRegistry.isWhitelistedVerifier(cashappReclaimVerifier.address);
      expect(isWhitelisted).to.be.true;
    });
  });
});
