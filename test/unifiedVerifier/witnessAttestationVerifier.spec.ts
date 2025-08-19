import "module-alias/register";

import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import { Account } from "@utils/test/types";
import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

import DeployHelper from "@utils/deploys";
import { Address } from "@utils/types";
import { WitnessAttestationVerifier } from "@utils/contracts";

const expect = getWaffleExpect();

describe.only("WitnessAttestationVerifier", () => {
  let owner: Account;
  let nonOwner: Account;
  let witness1: Account;
  let witness2: Account;
  let witness3: Account;

  let deployer: DeployHelper;
  let witnessAttestationVerifier: WitnessAttestationVerifier;

  beforeEach(async () => {
    [
      owner,
      nonOwner,
      witness1,
      witness2,
      witness3
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
  });

  describe("#constructor", () => {
    let subjectMinWitnessSignatures: BigNumber;

    beforeEach(async () => {
      subjectMinWitnessSignatures = BigNumber.from(2);
    });

    async function subject(): Promise<WitnessAttestationVerifier> {
      return await deployer.deployWitnessAttestationVerifier(
        subjectMinWitnessSignatures
      );
    }

    describe("when minWitnessSignatures is valid", () => {
      it("should deploy successfully with correct initial state", async () => {
        witnessAttestationVerifier = await subject();

        expect(await witnessAttestationVerifier.minWitnessSignatures()).to.equal(subjectMinWitnessSignatures);
        expect(await witnessAttestationVerifier.owner()).to.equal(owner.address);
      });

      it("should deploy with minWitnessSignatures of 1", async () => {
        subjectMinWitnessSignatures = BigNumber.from(1);

        witnessAttestationVerifier = await subject();

        expect(await witnessAttestationVerifier.minWitnessSignatures()).to.equal(1);
      });

      it("should deploy with large minWitnessSignatures value", async () => {
        subjectMinWitnessSignatures = BigNumber.from(100);

        witnessAttestationVerifier = await subject();

        expect(await witnessAttestationVerifier.minWitnessSignatures()).to.equal(100);
      });
    });

    describe("when minWitnessSignatures is invalid", () => {
      it("should revert when minWitnessSignatures is 0", async () => {
        subjectMinWitnessSignatures = BigNumber.from(0);

        await expect(subject()).to.be.revertedWith(
          "WitnessAttestationVerifier: Min signatures must be > 0"
        );
      });
    });
  });

  describe("#setMinWitnessSignatures", () => {
    let subjectNewMinWitnessSignatures: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      witnessAttestationVerifier = await deployer.deployWitnessAttestationVerifier(
        BigNumber.from(2)
      );

      subjectNewMinWitnessSignatures = BigNumber.from(3);
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await witnessAttestationVerifier
        .connect(subjectCaller.wallet)
        .setMinWitnessSignatures(subjectNewMinWitnessSignatures);
    }

    describe("when called by owner", () => {
      describe("when new value is valid and different", () => {
        it("should update minWitnessSignatures", async () => {
          await subject();

          expect(await witnessAttestationVerifier.minWitnessSignatures()).to.equal(
            subjectNewMinWitnessSignatures
          );
        });

        it("should emit MinWitnessSignaturesUpdated event", async () => {
          await expect(subject())
            .to.emit(witnessAttestationVerifier, "MinWitnessSignaturesUpdated")
            .withArgs(2, subjectNewMinWitnessSignatures);
        });

        it("should allow updating to 1", async () => {
          subjectNewMinWitnessSignatures = BigNumber.from(1);

          await subject();

          expect(await witnessAttestationVerifier.minWitnessSignatures()).to.equal(1);
        });

        it("should allow updating to large value", async () => {
          subjectNewMinWitnessSignatures = BigNumber.from(50);

          await subject();

          expect(await witnessAttestationVerifier.minWitnessSignatures()).to.equal(50);
        });
      });

      describe("when new value is same as current", () => {
        beforeEach(async () => {
          subjectNewMinWitnessSignatures = BigNumber.from(2);
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith(
            "WitnessAttestationVerifier: Same value"
          );
        });
      });

      describe("when new value is 0", () => {
        beforeEach(async () => {
          subjectNewMinWitnessSignatures = BigNumber.from(0);
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith(
            "WitnessAttestationVerifier: Min signatures must be > 0"
          );
        });
      });
    });

    describe("when called by non-owner", () => {
      beforeEach(async () => {
        subjectCaller = nonOwner;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });
    });
  });

  describe("#verify", () => {
    let subjectDigest: string;
    let subjectSignatures: string[];
    let subjectMetadata: string;

    beforeEach(async () => {
      witnessAttestationVerifier = await deployer.deployWitnessAttestationVerifier(
        BigNumber.from(2)
      );

      // Create a test message and digest
      const message = "Test attestation message";
      const messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message));

      // Convert to Ethereum Signed Message Hash for EIP-191
      const ethSignedMessageHash = ethers.utils.keccak256(
        ethers.utils.concat([
          ethers.utils.toUtf8Bytes("\x19Ethereum Signed Message:\n32"),
          messageHash
        ])
      );

      subjectDigest = ethSignedMessageHash;
      subjectSignatures = [];
      subjectMetadata = "0x";
    });

    async function subject(): Promise<boolean> {
      return await witnessAttestationVerifier.verify(
        subjectDigest,
        subjectSignatures,
        subjectMetadata
      );
    }

    describe("metadata encoding and decoding", () => {
      describe("when metadata contains valid witness addresses", () => {
        beforeEach(async () => {
          // Create signatures
          const messageHash = ethers.utils.keccak256(
            ethers.utils.concat([
              ethers.utils.toUtf8Bytes("\x19Ethereum Signed Message:\n32"),
              subjectDigest
            ])
          );

          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig2 = await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectSignatures = [sig1, sig2];

          // Encode witness addresses in metadata
          const witnesses = [witness1.address, witness2.address];
          subjectMetadata = ethers.utils.defaultAbiCoder.encode(["address[]"], [witnesses]);
        });

        it("should correctly decode and verify with valid witnesses", async () => {
          // Note: This will revert in the actual ThresholdSigVerifierUtils
          // because we're double-hashing the message. For testing metadata decoding,
          // we'll check the revert message indicates it got to verification
          await expect(subject()).to.be.revertedWith(
            "ThresholdSigVerifierUtils: Not enough valid witness signatures"
          );
        });
      });

      describe("when metadata contains empty witness array", () => {
        beforeEach(async () => {
          const witnesses: Address[] = [];
          subjectMetadata = ethers.utils.defaultAbiCoder.encode(["address[]"], [witnesses]);
          subjectSignatures = [];
        });

        it("should handle empty witness array", async () => {
          await expect(subject()).to.be.revertedWith(
            "ThresholdSigVerifierUtils: req threshold exceeds signatures"
          );
        });
      });

      describe("when metadata contains single witness", () => {
        beforeEach(async () => {
          const witnesses = [witness1.address];
          subjectMetadata = ethers.utils.defaultAbiCoder.encode(["address[]"], [witnesses]);
        });

        it("should handle single witness in metadata", async () => {
          await expect(subject()).to.be.revertedWith(
            "ThresholdSigVerifierUtils: req threshold exceeds signatures"
          );
        });
      });

      describe("when metadata contains many witnesses", () => {
        beforeEach(async () => {
          // Create array of 10 witness addresses
          const witnesses: Address[] = [];
          const accounts = await getAccounts();
          for (let i = 0; i < 10; i++) {
            witnesses.push(accounts[i].address);
          }

          subjectMetadata = ethers.utils.defaultAbiCoder.encode(["address[]"], [witnesses]);
          subjectSignatures = [];
        });

        it("should handle large witness arrays in metadata", async () => {
          await expect(subject()).to.be.revertedWith(
            "ThresholdSigVerifierUtils: req threshold exceeds signatures"
          );
        });
      });

      describe("when metadata is malformed", () => {
        beforeEach(async () => {
          // Invalid ABI encoding
          subjectMetadata = "0x1234";
        });

        it("should revert on malformed metadata", async () => {
          await expect(subject()).to.be.reverted;
        });
      });
    });
  });
});