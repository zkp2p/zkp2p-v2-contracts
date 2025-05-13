import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  ZelleChaseReclaimVerifier,
  ZelleCitiReclaimVerifier,
  ZelleBoAReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  ZelleChaseReclaimVerifier__factory,
  ZelleCitiReclaimVerifier__factory,
  ZelleBoAReclaimVerifier__factory,
  NullifierRegistry__factory,
  Escrow__factory,
  ZelleBaseVerifier,
  ZelleBaseVerifier__factory,
} from "../../typechain";

import {
  getAccounts,
  getWaffleExpect,
} from "../../utils/test";
import { Account } from "../../utils/test/types";
import { Address } from "../../utils/types";

import { MULTI_SIG } from "../../deployments/parameters";
import {
  getZelleChaseReclaimProviderHashes,
  getZelleCitiReclaimProviderHashes,
  getZelleBoAReclaimProviderHashes,
  ZELLE_RECLAIM_TIMESTAMP_BUFFER,
  ZELLE_RECLAIM_CURRENCIES,
  ZELLE_RECLAIM_FEE_SHARE,
  ZELLE_APPCLIP_PROVIDER_HASHES,
} from "../../deployments/verifiers/zelle_reclaim";

const expect = getWaffleExpect();

describe("Zelle Reclaim Verifier Deployments", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let nullifierRegistry: NullifierRegistry;

  let zelleBaseVerifier: ZelleBaseVerifier;
  let chaseVerifier: ZelleChaseReclaimVerifier;
  let citiVerifier: ZelleCitiReclaimVerifier;
  let boaVerifier: ZelleBoAReclaimVerifier;

  // Payment method IDs for each bank - must match deploy script
  const CHASE_PAYMENT_METHOD = 1;
  const CITI_PAYMENT_METHOD = 2;
  const BOA_PAYMENT_METHOD = 3;

  const network: string = deployments.getNetworkName();

  function getDeployedContractAddress(network: string, contractName: string): string {
    return require(`../../deployments/${network}/${contractName}.json`).address;
  }

  before(async () => {
    [deployer] = await getAccounts();
    multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer.address;

    escrowAddress = getDeployedContractAddress(network, "Escrow");
    escrow = new Escrow__factory(deployer.wallet).attach(escrowAddress);

    const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");
    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);

    const zelleBaseVerifierAddress = getDeployedContractAddress(network, "ZelleBaseVerifier");
    zelleBaseVerifier = new ZelleBaseVerifier__factory(deployer.wallet).attach(zelleBaseVerifierAddress);

    const chaseVerifierAddress = getDeployedContractAddress(network, "ZelleChaseReclaimVerifier");
    chaseVerifier = new ZelleChaseReclaimVerifier__factory(deployer.wallet).attach(chaseVerifierAddress);

    const citiVerifierAddress = getDeployedContractAddress(network, "ZelleCitiReclaimVerifier");
    citiVerifier = new ZelleCitiReclaimVerifier__factory(deployer.wallet).attach(citiVerifierAddress);

    const boaVerifierAddress = getDeployedContractAddress(network, "ZelleBoAReclaimVerifier");
    boaVerifier = new ZelleBoAReclaimVerifier__factory(deployer.wallet).attach(boaVerifierAddress);
  });

  describe("ZelleBaseVerifier", () => {
    it("should set the correct parameters", async () => {
      const actualOwner = await zelleBaseVerifier.owner();
      const actualEscrowAddress = await zelleBaseVerifier.escrow();
      const actualNullifierRegistryAddress = await zelleBaseVerifier.nullifierRegistry();
      const actualTimestampBuffer = await zelleBaseVerifier.timestampBuffer();
      const actualCurrencies = await zelleBaseVerifier.getCurrencies();

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(actualTimestampBuffer).to.eq(ZELLE_RECLAIM_TIMESTAMP_BUFFER);
      expect([...actualCurrencies].sort()).to.deep.eq([...ZELLE_RECLAIM_CURRENCIES].sort());
    });

    it("should be added to the whitelisted payment verifiers in Escrow", async () => {
      const isWhitelisted = await escrow.whitelistedPaymentVerifiers(zelleBaseVerifier.address);
      expect(isWhitelisted).to.be.true;
    });

    it("should have the correct fee share set in Escrow", async () => {
      const feeShare = await escrow.paymentVerifierFeeShare(zelleBaseVerifier.address);
      expect(feeShare).to.eq(ZELLE_RECLAIM_FEE_SHARE[network]);
    });

    it("should have the correct payment method mappings", async () => {
      const chaseVerifierAddress = await zelleBaseVerifier.paymentMethodToVerifier(CHASE_PAYMENT_METHOD);
      const citiVerifierAddress = await zelleBaseVerifier.paymentMethodToVerifier(CITI_PAYMENT_METHOD);
      const boaVerifierAddress = await zelleBaseVerifier.paymentMethodToVerifier(BOA_PAYMENT_METHOD);

      expect(chaseVerifierAddress).to.eq(chaseVerifier.address);
      expect(citiVerifierAddress).to.eq(citiVerifier.address);
      expect(boaVerifierAddress).to.eq(boaVerifier.address);
    });
  });

  describe("ZelleChaseReclaimVerifier", () => {
    testVerifier(
      "ZelleChaseReclaimVerifier",
      () => chaseVerifier,
      getZelleChaseReclaimProviderHashes
    );
  });

  describe("ZelleCitiReclaimVerifier", () => {
    testVerifier(
      "ZelleCitiReclaimVerifier",
      () => citiVerifier,
      getZelleCitiReclaimProviderHashes
    );
  });

  describe("ZelleBoAReclaimVerifier", () => {
    testVerifier(
      "ZelleBoAReclaimVerifier",
      () => boaVerifier,
      getZelleBoAReclaimProviderHashes
    );
  });

  function testVerifier(
    name: string,
    getVerifier: () => any,
    getProviderHashes: (n: number) => Promise<string[]>
  ) {
    describe(`${name} Constructor`, () => {
      it("should set the correct parameters", async () => {
        const verifier = getVerifier();
        const actualOwner = await verifier.owner();
        const actualBaseVerifier = await verifier.baseVerifier();
        const actualNullifierRegistryAddress = await verifier.nullifierRegistry();
        const actualProviderHashes = await verifier.getProviderHashes();

        // Use different n for each bank to match deploy script
        let n = 10;
        if (name.includes("Citi")) n = 20;

        const extensionHashes = await getProviderHashes(n);
        const appclipHashes = ZELLE_APPCLIP_PROVIDER_HASHES;
        const allHashes = [...extensionHashes, ...appclipHashes];

        expect(actualOwner).to.eq(multiSig);
        expect(actualBaseVerifier).to.eq(zelleBaseVerifier.address);
        expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
        expect([...actualProviderHashes].sort()).to.deep.eq([...allHashes].sort());
      });
    });

    describe(`${name} Write Permissions`, () => {
      it("should add write permissions to the NullifierRegistry", async () => {
        const verifier = getVerifier();
        const hasWritePermission = await nullifierRegistry.isWriter(verifier.address);
        expect(hasWritePermission).to.be.true;
      });
    });

    // Individual verifiers should no longer be directly whitelisted in escrow
    describe(`${name} Escrow Integration`, () => {
      it("should NOT be directly added to the whitelisted payment verifiers", async () => {
        const verifier = getVerifier();
        const isWhitelisted = await escrow.whitelistedPaymentVerifiers(verifier.address);
        expect(isWhitelisted).to.be.false;
      });
    });
  }
});
