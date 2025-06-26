import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  VenmoReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  VenmoReclaimVerifier__factory,
  NullifierRegistry__factory,
  Escrow__factory,
  PaymentVerifierRegistry__factory,
  PaymentVerifierRegistry,
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
  getVenmoReclaimProviderHashes,
  VENMO_RECLAIM_TIMESTAMP_BUFFER,
  VENMO_RECLAIM_CURRENCIES
} from "../../deployments/verifiers/venmo_reclaim";

const expect = getWaffleExpect();

describe("VenmoReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let venmoReclaimVerifier: VenmoReclaimVerifier;
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

    const venmoReclaimVerifierAddress = getDeployedContractAddress(network, "VenmoReclaimVerifier");
    venmoReclaimVerifier = new VenmoReclaimVerifier__factory(deployer.wallet).attach(venmoReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await venmoReclaimVerifier.owner();
      const actualEscrowAddress = await venmoReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await venmoReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await venmoReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await venmoReclaimVerifier.timestampBuffer();
      const actualCurrencies = await venmoReclaimVerifier.getCurrencies();
      const hashes = await getVenmoReclaimProviderHashes(10);

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(actualProviderHashes).to.deep.eq(hashes);
      expect(actualTimestampBuffer).to.eq(VENMO_RECLAIM_TIMESTAMP_BUFFER);
      expect(actualCurrencies).to.deep.eq(VENMO_RECLAIM_CURRENCIES);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(venmoReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  describe("Payment Verifier Registry", async () => {
    it("should add the VenmoReclaimVerifier to the payment verifier registry", async () => {
      const isWhitelisted = await paymentVerifierRegistry.isWhitelistedVerifier(venmoReclaimVerifier.address);
      expect(isWhitelisted).to.be.true;
    });
  });
});
