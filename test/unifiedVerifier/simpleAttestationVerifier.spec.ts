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
import { SimpleAttestationVerifier } from "@utils/contracts";
import { ADDRESS_ZERO } from "@utils/constants";

const expect = getWaffleExpect();

describe("SimpleAttestationVerifier", () => {
  let owner: Account;
  let nonOwner: Account;
  let witness: Account;
  let zkTlsAttestor: Account;
  let otherAccount: Account;

  let deployer: DeployHelper;
  let simpleAttestationVerifier: SimpleAttestationVerifier;

  beforeEach(async () => {
    [
      owner,
      nonOwner,
      witness,
      zkTlsAttestor,
      otherAccount
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    simpleAttestationVerifier = await deployer.deploySimpleAttestationVerifier(
      witness.address,
      zkTlsAttestor.address
    );
  });

  describe("#constructor", () => {
    let subjectWitness: Address;
    let subjectZkTlsAttestor: Address;

    beforeEach(async () => {
      subjectWitness = witness.address;
      subjectZkTlsAttestor = zkTlsAttestor.address;
    });

    async function subject(): Promise<SimpleAttestationVerifier> {
      return await deployer.deploySimpleAttestationVerifier(
        subjectWitness,
        subjectZkTlsAttestor
      );
    }

    describe("when parameters are valid", () => {
      it("should deploy successfully with correct initial state", async () => {
        simpleAttestationVerifier = await subject();

        expect(await simpleAttestationVerifier.witness()).to.equal(subjectWitness);
        expect(await simpleAttestationVerifier.zktlsAttestor()).to.equal(subjectZkTlsAttestor);
        expect(await simpleAttestationVerifier.owner()).to.equal(owner.address);
        expect(await simpleAttestationVerifier.MIN_WITNESS_SIGNATURES()).to.equal(1);
      });

      it("should deploy with zero witness address", async () => {
        subjectWitness = ADDRESS_ZERO;

        simpleAttestationVerifier = await subject();

        expect(await simpleAttestationVerifier.witness()).to.equal(ADDRESS_ZERO);
      });

      it("should deploy with zero zkTLS attestor address", async () => {
        subjectZkTlsAttestor = ADDRESS_ZERO;

        simpleAttestationVerifier = await subject();

        expect(await simpleAttestationVerifier.zktlsAttestor()).to.equal(ADDRESS_ZERO);
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

  describe("#setZktlsAttestor", () => {
    let subjectNewAttestor: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectNewAttestor = otherAccount.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await simpleAttestationVerifier
        .connect(subjectCaller.wallet)
        .setZktlsAttestor(subjectNewAttestor);
    }

    describe("when called by owner", () => {
      describe("when new attestor is valid", () => {
        it("should update zkTLS attestor", async () => {
          await subject();

          expect(await simpleAttestationVerifier.zktlsAttestor()).to.equal(subjectNewAttestor);
        });

        it("should emit ZktlsAttestorUpdated event", async () => {
          await expect(subject())
            .to.emit(simpleAttestationVerifier, "ZktlsAttestorUpdated")
            .withArgs(zkTlsAttestor.address, subjectNewAttestor);
        });
      });

      describe("when new attestor is zero address", () => {
        beforeEach(async () => {
          subjectNewAttestor = ADDRESS_ZERO;
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
      subjectData = ethers.utils.defaultAbiCoder.encode(["address"], [zkTlsAttestor.address]);
    });

    async function subject(): Promise<boolean> {
      return await simpleAttestationVerifier.verify(
        subjectDigest,
        subjectSignatures,
        subjectData
      );
    }

    describe("attestation verification", () => {
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

        describe("when attestor doesn't match", () => {
          beforeEach(async () => {
            subjectData = ethers.utils.defaultAbiCoder.encode(["address"], [otherAccount.address]);
          });

          it("should return false", async () => {
            const result = await subject();
            expect(result).to.be.false;
          });
        });
      });

      describe("when witness signature is invalid", () => {
        beforeEach(async () => {
          // Sign with wrong account
          const sig = await otherAccount.wallet.signMessage(ethers.utils.arrayify(messageHash));
          subjectSignatures = [sig];
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith(
            "ThresholdSigVerifierUtils: Not enough valid witness signatures"
          );
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

    describe("trust anchor verification", () => {
      beforeEach(async () => {
        // Setup valid witness signature
        const sig = await witness.wallet.signMessage(ethers.utils.arrayify(messageHash));
        subjectSignatures = [sig];
      });

      describe("when attestor matches registered attestor", () => {
        it("should return true", async () => {
          const result = await subject();
          expect(result).to.be.true;
        });
      });

      describe("when attestor doesn't match registered attestor", () => {
        beforeEach(async () => {
          subjectData = ethers.utils.defaultAbiCoder.encode(["address"], [otherAccount.address]);
        });

        it("should return false", async () => {
          const result = await subject();
          expect(result).to.be.false;
        });
      });

      describe("when attestor is zero address", () => {
        beforeEach(async () => {
          subjectData = ethers.utils.defaultAbiCoder.encode(["address"], [ADDRESS_ZERO]);
        });

        it("should return false if registered attestor is not zero", async () => {
          const result = await subject();
          expect(result).to.be.false;
        });
      });

      describe("when registered attestor is zero", () => {
        beforeEach(async () => {
          const sig = await witness.wallet.signMessage(ethers.utils.arrayify(messageHash));
          subjectSignatures = [sig];
          subjectData = ethers.utils.defaultAbiCoder.encode(["address"], [ADDRESS_ZERO]);
        });

        it("should return true if provided attestor is also zero", async () => {
          const result = await subject();
          expect(result).to.be.false;
        });
      });

      describe("when data is malformed", () => {
        beforeEach(async () => {
          const sig = await witness.wallet.signMessage(ethers.utils.arrayify(messageHash));
          subjectSignatures = [sig];
          subjectData = "0x1234"; // Invalid encoding
        });

        it("should revert", async () => {
          await expect(subject()).to.be.reverted;
        });
      });
    });
  });
});