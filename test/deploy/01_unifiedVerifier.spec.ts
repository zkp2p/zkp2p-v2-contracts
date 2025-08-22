import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  UnifiedPaymentVerifier,
  SimpleAttestationVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  UnifiedPaymentVerifier__factory,
  SimpleAttestationVerifier__factory,
  NullifierRegistry__factory,
  Escrow__factory,
  Orchestrator,
  Orchestrator__factory,
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
  WITNESS_ADDRESS,
  ZKTLS_ATTESTOR_ADDRESS,
} from "../../deployments/parameters";
import { getDeployedContractAddress } from "../../deployments/helpers";

const expect = getWaffleExpect();

describe("UnifiedPaymentVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let orchestratorAddress: string;

  let orchestrator: Orchestrator;
  let unifiedPaymentVerifier: UnifiedPaymentVerifier;
  let simpleAttestationVerifier: SimpleAttestationVerifier;
  let nullifierRegistry: NullifierRegistry;

  const network: string = deployments.getNetworkName();

  before(async () => {
    [
      deployer,
    ] = await getAccounts();

    multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer.address;

    orchestratorAddress = getDeployedContractAddress(network, "Orchestrator");
    orchestrator = new Orchestrator__factory(deployer.wallet).attach(orchestratorAddress);

    const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");
    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);

    const unifiedPaymentVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");
    unifiedPaymentVerifier = new UnifiedPaymentVerifier__factory(deployer.wallet).attach(unifiedPaymentVerifierAddress);

    const simpleAttestationVerifierAddress = getDeployedContractAddress(network, "SimpleAttestationVerifier");
    simpleAttestationVerifier = new SimpleAttestationVerifier__factory(deployer.wallet).attach(simpleAttestationVerifierAddress);
  });

  describe("SimpleAttestationVerifier Constructor", async () => {
    it("should set the correct parameters", async () => {
      const actualOwner = await simpleAttestationVerifier.owner();
      const actualWitnessAddress = await simpleAttestationVerifier.witness();
      const actualZktlsAttestorAddress = await simpleAttestationVerifier.zktlsAttestor();

      const expectedWitnessAddress = WITNESS_ADDRESS[network];
      const expectedZktlsAttestorAddress = ZKTLS_ATTESTOR_ADDRESS[network];

      expect(actualOwner).to.eq(multiSig);
      expect(actualWitnessAddress).to.eq(expectedWitnessAddress);
      expect(actualZktlsAttestorAddress).to.eq(expectedZktlsAttestorAddress);
    });
  });

  describe("UnifiedPaymentVerifier Constructor", async () => {
    it("should set the correct parameters", async () => {
      const actualOwner = await unifiedPaymentVerifier.owner();
      const actualOrchestratorAddress = await unifiedPaymentVerifier.orchestrator();
      const actualNullifierRegistryAddress = await unifiedPaymentVerifier.nullifierRegistry();
      const actualAttestationVerifierAddress = await unifiedPaymentVerifier.attestationVerifier();

      expect(actualOwner).to.eq(multiSig);
      expect(actualOrchestratorAddress).to.eq(orchestratorAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(actualAttestationVerifierAddress).to.eq(simpleAttestationVerifier.address);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(unifiedPaymentVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  describe("Ownership Transfer", async () => {
    it("should transfer ownership of SimpleAttestationVerifier to multiSig", async () => {
      const owner = await simpleAttestationVerifier.owner();
      expect(owner).to.eq(multiSig);
    });

    it("should transfer ownership of UnifiedPaymentVerifier to multiSig", async () => {
      const owner = await unifiedPaymentVerifier.owner();
      expect(owner).to.eq(multiSig);
    });
  });
});