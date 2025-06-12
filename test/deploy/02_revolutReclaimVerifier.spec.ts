import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  RevolutReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  RevolutReclaimVerifier__factory,
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
  getRevolutReclaimProviderHashes,
  REVOLUT_RECLAIM_TIMESTAMP_BUFFER,
  REVOLUT_RECLAIM_CURRENCIES,
  REVOLUT_RECLAIM_FEE_SHARE,
  REVOLUT_APPCLIP_PROVIDER_HASHES
} from "../../deployments/verifiers/revolut_reclaim";

const expect = getWaffleExpect();

describe("RevolutReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let revolutReclaimVerifier: RevolutReclaimVerifier;
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

    const revolutReclaimVerifierAddress = getDeployedContractAddress(network, "RevolutReclaimVerifier");
    revolutReclaimVerifier = new RevolutReclaimVerifier__factory(deployer.wallet).attach(revolutReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await revolutReclaimVerifier.owner();
      const actualEscrowAddress = await revolutReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await revolutReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await revolutReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await revolutReclaimVerifier.timestampBuffer();
      const actualCurrencies = await revolutReclaimVerifier.getCurrencies();
      const hashes = await getRevolutReclaimProviderHashes(20);
      const appclipHashes = REVOLUT_APPCLIP_PROVIDER_HASHES;
      const allHashes = [...hashes, ...appclipHashes];

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect([...actualProviderHashes].sort()).to.deep.eq([...allHashes].sort());
      expect([...actualCurrencies].sort()).to.deep.eq([...REVOLUT_RECLAIM_CURRENCIES].sort());
      expect(actualTimestampBuffer).to.eq(REVOLUT_RECLAIM_TIMESTAMP_BUFFER);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(revolutReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  describe("Payment Verifier Registry", async () => {
    it("should add the RevolutReclaimVerifier to the payment verifier registry", async () => {
      const isWhitelisted = await paymentVerifierRegistry.isWhitelistedVerifier(revolutReclaimVerifier.address);
      expect(isWhitelisted).to.be.true;
    });
  });
});
