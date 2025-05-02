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

  let chaseVerifier: ZelleChaseReclaimVerifier;
  let citiVerifier: ZelleCitiReclaimVerifier;
  let boaVerifier: ZelleBoAReclaimVerifier;

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

    const chaseVerifierAddress = getDeployedContractAddress(network, "ZelleChaseReclaimVerifier");
    chaseVerifier = new ZelleChaseReclaimVerifier__factory(deployer.wallet).attach(chaseVerifierAddress);

    const citiVerifierAddress = getDeployedContractAddress(network, "ZelleCitiReclaimVerifier");
    citiVerifier = new ZelleCitiReclaimVerifier__factory(deployer.wallet).attach(citiVerifierAddress);

    const boaVerifierAddress = getDeployedContractAddress(network, "ZelleBoAReclaimVerifier");
    boaVerifier = new ZelleBoAReclaimVerifier__factory(deployer.wallet).attach(boaVerifierAddress);
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
        const actualEscrowAddress = await verifier.escrow();
        const actualNullifierRegistryAddress = await verifier.nullifierRegistry();
        const actualProviderHashes = await verifier.getProviderHashes();
        const actualTimestampBuffer = await verifier.timestampBuffer();
        const actualCurrencies = await verifier.getCurrencies();

        // Use different n for each bank to match deploy script
        let n = 10;
        if (name.includes("Citi")) n = 20;

        const extensionHashes = await getProviderHashes(n);
        const appclipHashes = ZELLE_APPCLIP_PROVIDER_HASHES;
        const allHashes = [...extensionHashes, ...appclipHashes];

        expect(actualOwner).to.eq(multiSig);
        expect(actualEscrowAddress).to.eq(escrowAddress);
        expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
        expect([...actualProviderHashes].sort()).to.deep.eq([...allHashes].sort());
        expect([...actualCurrencies].sort()).to.deep.eq([...ZELLE_RECLAIM_CURRENCIES].sort());
        expect(actualTimestampBuffer).to.eq(ZELLE_RECLAIM_TIMESTAMP_BUFFER);
      });
    });

    describe(`${name} Write Permissions`, () => {
      it("should add write permissions to the NullifierRegistry", async () => {
        const verifier = getVerifier();
        const hasWritePermission = await nullifierRegistry.isWriter(verifier.address);
        expect(hasWritePermission).to.be.true;
      });
    });

    describe(`${name} Whitelisted Payment Verifier`, () => {
      it("should add the verifier to the whitelisted payment verifiers", async () => {
        const verifier = getVerifier();
        const hasWritePermission = await escrow.whitelistedPaymentVerifiers(verifier.address);
        expect(hasWritePermission).to.be.true;
      });

      it("should set the correct fee share", async () => {
        const verifier = getVerifier();
        const feeShare = await escrow.paymentVerifierFeeShare(verifier.address);
        expect(feeShare).to.eq(ZELLE_RECLAIM_FEE_SHARE[network]);
      });
    });
  }
});
