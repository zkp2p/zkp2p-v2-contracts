import "module-alias/register";

import { BigNumber } from "ethers";
import { ethers } from "ethers";

import { Account } from "@utils/test/types";
import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

import DeployHelper from "@utils/deploys";
import { Address } from "@utils/types";
import { NullifierRegistry, BaseReclaimPaymentVerifier, ClaimVerifier } from "@utils/contracts";
import { ADDRESS_ZERO } from "@utils/constants";
import { Currency } from "@utils/protocolUtils";

const expect = getWaffleExpect();

describe("BaseReclaimPaymentVerifier", () => {
  let owner: Account;
  let witnessAddress: Address;
  let otherWitness: Account;

  let deployer: DeployHelper;
  let providerHashes: string[];
  let claimVerifier: ClaimVerifier;

  let proxyBaseProcessor: BaseReclaimPaymentVerifier;
  let nullifierRegistry: NullifierRegistry;

  beforeEach(async () => {
    [
      owner,
      otherWitness
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    witnessAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'    // hardhat 0
    providerHashes = [];

    nullifierRegistry = await deployer.deployNullifierRegistry();
    claimVerifier = await deployer.deployClaimVerifier();
    const currencies = [ethers.utils.formatBytes32String("USD")];

    proxyBaseProcessor = await deployer.deployBaseReclaimPaymentVerifier(
      ADDRESS_ZERO,
      nullifierRegistry.address,
      BigNumber.from(30),
      currencies,
      providerHashes
    );
    proxyBaseProcessor.transferOwnership(owner.address);
  });

  describe("#constructor", async () => {
    let subjectNullifierRegistry: Address;
    let subjectProviderHashes: string[];

    beforeEach(async () => {
      subjectNullifierRegistry = nullifierRegistry.address;
      subjectProviderHashes = [ethers.utils.formatBytes32String("random1"), ethers.utils.formatBytes32String("random2")];
    });

    async function subject(): Promise<any> {
      return deployer.deployBaseReclaimPaymentVerifier(
        ADDRESS_ZERO,
        subjectNullifierRegistry,
        BigNumber.from(30),
        [Currency.USD],
        subjectProviderHashes,
        "contracts/lib/ClaimVerifier.sol:ClaimVerifier",
        claimVerifier.address
      );
    }

    it("should set the correct nullifier registry", async () => {
      const proxyBaseProcessor: BaseReclaimPaymentVerifier = await subject();

      const nullifierRegistry = await proxyBaseProcessor.nullifierRegistry();
      expect(nullifierRegistry).to.equal(subjectNullifierRegistry);
    });

    it("should add the correct provider hashes", async () => {
      const proxyBaseProcessor: BaseReclaimPaymentVerifier = await subject();

      const providerHashes = await proxyBaseProcessor.getProviderHashes();
      expect(providerHashes.length).to.equal(2);
      expect(JSON.stringify(providerHashes)).to.equal(JSON.stringify(subjectProviderHashes));
    });

    describe("when the a providerHash is duplicated", async () => {
      beforeEach(async () => {
        subjectProviderHashes = [ethers.utils.formatBytes32String("random1"), ethers.utils.formatBytes32String("random1")];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Provider hash already added");
      });
    });
  });

  describe("#addProviderHash", async () => {

    let subjectProviderHash: string;

    beforeEach(async () => {
      subjectProviderHash = '0x94303faca9758e19301320d1cdfa5f0a180fc2fd15e4adcc31fee67ec6d4d8f3';
    });

    async function subject(): Promise<any> {
      return proxyBaseProcessor.addProviderHash(subjectProviderHash);
    }

    it("should add provider hash", async () => {
      await subject();

      const providerHashes = await proxyBaseProcessor.getProviderHashes();

      expect(providerHashes.length).to.equal(1);
      expect(providerHashes[0]).to.equal(subjectProviderHash);
    });

    it("should update the isProviderHash mapping", async () => {
      await subject();

      const isProviderHash = await proxyBaseProcessor.isProviderHash(subjectProviderHash);
      expect(isProviderHash).to.be.true;
    });

    it("should emit a ProviderHashAdded event", async () => {
      await expect(subject())
        .to.emit(proxyBaseProcessor, "ProviderHashAdded")
        .withArgs(subjectProviderHash);
    });

    it("should revert if the provider hash already exists", async () => {
      await subject(); // Add the hash first

      await expect(subject()).to.be.revertedWith("Provider hash already added");
    });

    describe("when called by a non-owner", async () => {
      beforeEach(async () => {
        proxyBaseProcessor = proxyBaseProcessor.connect(otherWitness.wallet);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#removeProviderHash", async () => {
    let subjectProviderHash: string;

    beforeEach(async () => {
      // Add non-subject provider hash first to make sure we get coverage
      await proxyBaseProcessor.addProviderHash('0x94303faca9758e19301320d1cdfa5f0a180fc2fd15e4adcc31fee67ec6d4d8f2');

      subjectProviderHash = '0x94303faca9758e19301320d1cdfa5f0a180fc2fd15e4adcc31fee67ec6d4d8f3';
      await proxyBaseProcessor.addProviderHash(subjectProviderHash);
    });

    async function subject(): Promise<any> {
      return proxyBaseProcessor.removeProviderHash(subjectProviderHash);
    }

    it("should remove the provider hash", async () => {
      await subject();

      const providerHashes = await proxyBaseProcessor.getProviderHashes();
      const isProviderHash = await proxyBaseProcessor.isProviderHash(subjectProviderHash);

      expect(providerHashes.length).to.equal(1);
      expect(isProviderHash).to.be.false;
    });

    it("should emit a ProviderHashRemoved event", async () => {
      await expect(subject())
        .to.emit(proxyBaseProcessor, "ProviderHashRemoved")
        .withArgs(subjectProviderHash);
    });

    describe("when the provider hash is already removed", async () => {
      beforeEach(async () => {
        await subject(); // Remove the hash first
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Provider hash not found");
      });
    });

    describe("when called by a non-owner", async () => {
      beforeEach(async () => {
        proxyBaseProcessor = proxyBaseProcessor.connect(otherWitness.wallet);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#verifyProofSignatures", async () => {
    let subjectProof: any;
    let subjectWitnesses: Address[];
    beforeEach(async () => {
      subjectWitnesses = [witnessAddress, otherWitness.address];
      subjectProof = {
        claimInfo: {
          provider: 'http',
          parameters: '{"method":"GET","responseMatches":[{"type":"regex","value":"(?<name>\\"firstName\\":\\"[^\\"]+\\")"}],"responseRedactions":[{"jsonPath":"$.firstName","xPath":""}],"url":"https://identity.ticketmaster.com/json/user?hard=false&doNotTrack=false"}',
          context: '{"extractedParameters":{"name":"\\"firstName\\":\\"Richard\\""},"providerHash":"0x94303faca9758e19301320d1cdfa5f0a180fc2fd15e4adcc31fee67ec6d4d8f3"}',
        },
        signedClaim: {
          claim: {
            identifier: '0xba88860afae18798a6af58b239628f9c4d9d61066533bebcbb29e8f5550e6f63',
            owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            timestampS: '1719339653',
            epoch: '1'
          },
          signatures: ['0x95cdd30e518fc138c1f762b8ec4d33f9cc3048e315837774221ce14b98ccf3a54c0d489b64cef21d971d20eb84bf1f93c644eebc32cc22a2b5b2a6216dc2f6081c']
        }
      };
    });

    async function subject(): Promise<any> {
      return proxyBaseProcessor.verifyProofSignatures(subjectProof, subjectWitnesses);
    };

    it("should verify proof", async () => {
      await subject();
    });

    describe("when there are no signatures", () => {
      beforeEach(async () => {
        subjectProof.signedClaim.signatures = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("No signatures");
      });
    });

    describe("when the ClaimInfo hash doesn't match", () => {
      beforeEach(async () => {
        subjectProof.signedClaim.claim.identifier = '0xba88860afae18798a6af58b239628f9c4d9d61066533bebcbb29e8f5550e6f64';   // last 3 replaced with 4
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("ClaimInfo hash doesn't match");
      });
    });

    describe("when a signature is not from a witness", () => {
      beforeEach(async () => {
        const nonWitnessWallet = ethers.Wallet.createRandom();
        const message = "Hello Tickets";
        subjectProof.signedClaim.signatures[0] = await nonWitnessWallet.signMessage(message);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Signature not appropriate");
      });
    });
  });
});