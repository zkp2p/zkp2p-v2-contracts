import "module-alias/register";

import { ethers } from "hardhat";

import { Account } from "@utils/test/types";
import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

import DeployHelper from "@utils/deploys";
import { Address } from "@utils/types";
import { SimpleAttestationVerifier } from "@utils/contracts";
import { ADDRESS_ZERO } from "@utils/constants";

const expect = getWaffleExpect();

describe("SimpleAttestationVerifier", () => {
  let owner: Account;
  let nonOwner: Account;
  let witness: Account;
  let otherAccount: Account;

  let deployer: DeployHelper;
  let simpleAttestationVerifier: SimpleAttestationVerifier;

  beforeEach(async () => {
    [
      owner,
      nonOwner,
      witness,
      otherAccount
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    simpleAttestationVerifier = await deployer.deploySimpleAttestationVerifier(
      witness.address
    );
  });

  describe("#constructor", () => {
    let subjectWitness: Address;

    beforeEach(async () => {
      subjectWitness = witness.address;
    });

    async function subject(): Promise<SimpleAttestationVerifier> {
      return await deployer.deploySimpleAttestationVerifier(
        subjectWitness
      );
    }

    describe("when parameters are valid", () => {
      it("should deploy successfully with correct initial state", async () => {
        simpleAttestationVerifier = await subject();

        expect(await simpleAttestationVerifier.witness()).to.equal(subjectWitness);
        expect(await simpleAttestationVerifier.owner()).to.equal(owner.address);
        expect(await simpleAttestationVerifier.MIN_WITNESS_SIGNATURES()).to.equal(1);
      });

      it("should deploy with zero witness address", async () => {
        subjectWitness = ADDRESS_ZERO;

        simpleAttestationVerifier = await subject();

        expect(await simpleAttestationVerifier.witness()).to.equal(ADDRESS_ZERO);
      });

    });
  });

  describe("#setWitness", () => {
    let subjectNewWitness: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectNewWitness = otherAccount.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await simpleAttestationVerifier
        .connect(subjectCaller.wallet)
        .setWitness(subjectNewWitness);
    }

    describe("when called by owner", () => {
      describe("when new witness is valid", () => {
        it("should update witness", async () => {
          await subject();

          expect(await simpleAttestationVerifier.witness()).to.equal(subjectNewWitness);
        });

        it("should emit WitnessUpdated event", async () => {
          await expect(subject())
            .to.emit(simpleAttestationVerifier, "WitnessUpdated")
            .withArgs(witness.address, subjectNewWitness);
        });
      });

      describe("when new witness is zero address", () => {
        beforeEach(async () => {
          subjectNewWitness = ADDRESS_ZERO;
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith(
            "SimpleAttestationVerifier: Zero address"
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
    let subjectData: string;

    let messageHash: string;

    beforeEach(async () => {
      // Create a test message and digest (EIP-712 style)
      const message = "Test attestation message";
      messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message));

      subjectDigest = ethers.utils.keccak256(
        ethers.utils.concat([
          ethers.utils.toUtf8Bytes("\x19Ethereum Signed Message:\n32"),
          messageHash
        ])
      );
      subjectSignatures = [];
      subjectData = ethers.utils.defaultAbiCoder.encode(["address"], [witness.address]);
    });

    async function subject(): Promise<boolean> {
      return await simpleAttestationVerifier.verify(
        subjectDigest,
        subjectSignatures,
        subjectData
      );
    }


    describe("when witness signature is valid", () => {
      beforeEach(async () => {
        // ThresholdSigVerifierUtils expects the digest to be passed as-is
        // and will handle EIP-191 prefix internally when verifying with SignatureChecker
        // We use signMessage which adds the EIP-191 prefix
        const sig = await witness.wallet.signMessage(ethers.utils.arrayify(messageHash));
        subjectSignatures = [sig];
      });

      it("should return true with valid signature and attestor", async () => {
        const result = await subject();
        expect(result).to.be.true;
      });
    });

    describe("when witness signature is invalid", () => {
      describe("when signed by non-witness account", () => {
        beforeEach(async () => {
          // Sign with wrong account
          const sig = await otherAccount.wallet.signMessage(ethers.utils.arrayify(messageHash));
          subjectSignatures = [sig];
        });

        it("should revert with threshold error", async () => {
          await expect(subject()).to.be.revertedWith(
            "ThresholdSigVerifierUtils: Not enough valid witness signatures"
          );
        });
      });

      describe("when witness signs wrong message", () => {
        beforeEach(async () => {
          // Witness signs a different message
          const wrongMessage = "Wrong message";
          const wrongMessageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(wrongMessage));
          const sig = await witness.wallet.signMessage(ethers.utils.arrayify(wrongMessageHash));
          subjectSignatures = [sig];
        });

        it("should revert with threshold error", async () => {
          await expect(subject()).to.be.revertedWith(
            "ThresholdSigVerifierUtils: Not enough valid witness signatures"
          );
        });
      });

      describe("when signature is malformed", () => {
        beforeEach(async () => {
          // Create malformed signature (too short)
          subjectSignatures = ["0x1234"];
        });

        it("should revert with threshold error", async () => {
          await expect(subject()).to.be.revertedWith(
            "ThresholdSigVerifierUtils: Not enough valid witness signatures"
          );
        });
      });

      describe("when signature is empty bytes", () => {
        beforeEach(async () => {
          subjectSignatures = ["0x"];
        });

        it("should revert with threshold error", async () => {
          await expect(subject()).to.be.revertedWith(
            "ThresholdSigVerifierUtils: Not enough valid witness signatures"
          );
        });
      });
    });

    describe("when no signatures provided", () => {
      beforeEach(async () => {
        subjectSignatures = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith(
          "ThresholdSigVerifierUtils: req threshold exceeds signatures"
        );
      });
    });

    describe("when multiple signatures provided", () => {
      beforeEach(async () => {
        const sig1 = await witness.wallet.signMessage(ethers.utils.arrayify(messageHash));
        const sig2 = await otherAccount.wallet.signMessage(ethers.utils.arrayify(messageHash));
        subjectSignatures = [sig1, sig2];
      });

      it("should still verify correctly with first valid signature", async () => {
        const result = await subject();
        expect(result).to.be.true;
      });
    });
  });
});
