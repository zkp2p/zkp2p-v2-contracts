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
import { NullifierRegistry, BaseReclaimVerifier } from "@utils/contracts";
import { createSignDataForClaim } from "@utils/reclaimUtils";

const expect = getWaffleExpect();

describe("BaseReclaimVerifier", () => {
  let owner: Account;
  let witnessAddress: Address;
  let otherWitness: Account;

  let deployer: DeployHelper;
  let providerHashes: string[];

  let proxyBaseProcessor: BaseReclaimVerifier;

  beforeEach(async () => {
    [
      owner,
      otherWitness
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    witnessAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'    // hardhat 0
    providerHashes = [];

    proxyBaseProcessor = await deployer.deployBaseReclaimVerifier(
      providerHashes
    );
    proxyBaseProcessor.transferOwnership(owner.address);
  });

  describe("#constructor", async () => {
    let subjectProviderHashes: string[];

    beforeEach(async () => {
      subjectProviderHashes = [ethers.utils.formatBytes32String("random1"), ethers.utils.formatBytes32String("random2")];
    });

    async function subject(): Promise<any> {
      return deployer.deployBaseReclaimVerifier(
        subjectProviderHashes
      );
    }

    it("should add the correct provider hashes", async () => {
      const proxyBaseProcessor: BaseReclaimVerifier = await subject();

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
    let subjectRequiredThreshold: number;

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
      subjectRequiredThreshold = 1;
    });

    async function subject(): Promise<any> {
      return proxyBaseProcessor.verifyProofSignatures(subjectProof, subjectWitnesses, subjectRequiredThreshold);
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

    describe("when threshold signature required is not met", () => {
      describe("when threhsold is higher than the number of signatures", () => {
        beforeEach(async () => {
          subjectRequiredThreshold = 2;
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Fewer signatures than required threshold");
        });
      });

      describe("when number of signatures is greater than or equal to threshold but not all signatures are from required witnesses", () => {
        beforeEach(async () => {
          const message = createSignDataForClaim(subjectProof.signedClaim.claim);
          const nonWitnessWallet = ethers.Wallet.createRandom();
          subjectProof.signedClaim.signatures = [
            await nonWitnessWallet.signMessage(message),
            await otherWitness.wallet.signMessage(message)
          ];

          subjectWitnesses = [witnessAddress, otherWitness.address];
          subjectRequiredThreshold = 2;
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Not enough valid witness signatures");
        });
      });

      describe("when there are duplicate signatures", () => {
        beforeEach(async () => {
          const message = createSignDataForClaim(subjectProof.signedClaim.claim);
          const witnessWallet = ethers.Wallet.createRandom();
          subjectProof.signedClaim.signatures = [
            await witnessWallet.signMessage(message),
            await witnessWallet.signMessage(message)
          ];

          subjectWitnesses = [witnessWallet.address, otherWitness.address];
          subjectRequiredThreshold = 2;
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Not enough valid witness signatures");
        });
      });
    });

    describe("when required threshold is zero", () => {
      beforeEach(async () => {
        subjectRequiredThreshold = 0;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Required threshold must be greater than 0");
      });
    });

    describe("when required threshold is greater than number of witnesses", () => {
      beforeEach(async () => {
        subjectRequiredThreshold = 3;
        subjectWitnesses = [witnessAddress];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Required threshold must be less than or equal to number of witnesses");
      });
    });
  });
});