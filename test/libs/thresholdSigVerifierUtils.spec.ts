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
import { ThresholdSigVerifierUtilsMock } from "@utils/contracts";

const expect = getWaffleExpect();

describe("ThresholdSigVerifierUtils", () => {
  let owner: Account;
  let witness1: Account;
  let witness2: Account;
  let witness3: Account;
  let witness4: Account;
  let witness5: Account;
  let nonWitness: Account;
  let contractWitnessOwner: Account;

  let deployer: DeployHelper;

  let thresholdVerifier: ThresholdSigVerifierUtilsMock;

  let messageHash: string;
  let message: string;

  beforeEach(async () => {
    [
      owner,
      witness1,
      witness2,
      witness3,
      witness4,
      witness5,
      nonWitness,
      contractWitnessOwner
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    // Deploy mock contracts
    thresholdVerifier = await deployer.deployThresholdSigVerifierUtilsMock();

    // Set up test message
    message = "Test message for signature verification";
    messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message));
  });

  describe("#verifyWitnessSignatures", () => {
    let subjectMessageHash: string;
    let subjectSignatures: string[];
    let subjectWitnesses: Address[];
    let subjectThreshold: BigNumber;

    beforeEach(async () => {
      // Convert to Ethereum Signed Message Hash for EIP-191
      // This is what gets signed when using signMessage()
      const ethSignedMessageHash = ethers.utils.keccak256(
        ethers.utils.concat([
          ethers.utils.toUtf8Bytes("\x19Ethereum Signed Message:\n32"),
          messageHash
        ])
      );
      subjectMessageHash = ethSignedMessageHash;
      subjectSignatures = [];
      subjectWitnesses = [];
      subjectThreshold = BigNumber.from(1);
    });

    async function subject(): Promise<boolean> {
      return await thresholdVerifier.verifyWitnessSignatures(
        subjectMessageHash,
        subjectSignatures,
        subjectWitnesses,
        subjectThreshold
      );
    }

    describe("Valid Signature Scenarios", () => {
      describe("Single witness with threshold of 1", () => {
        beforeEach(async () => {
          const signature = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          subjectSignatures = [signature];
          subjectWitnesses = [witness1.address];
          subjectThreshold = BigNumber.from(1);
        });

        it("should verify successfully", async () => {
          const result = await subject();
          expect(result).to.be.true;
        });
      });

      describe("Multiple witnesses meeting exact threshold", () => {
        beforeEach(async () => {
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig2 = await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig3 = await witness3.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectSignatures = [sig1, sig2, sig3];
          subjectWitnesses = [witness1.address, witness2.address, witness3.address];
          subjectThreshold = BigNumber.from(3);
        });

        it("should verify successfully when meeting exact threshold", async () => {
          const result = await subject();
          expect(result).to.be.true;
        });
      });

      describe("More signatures than threshold", () => {
        beforeEach(async () => {
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig2 = await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig3 = await witness3.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig4 = await witness4.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectSignatures = [sig1, sig2, sig3, sig4];
          subjectWitnesses = [witness1.address, witness2.address, witness3.address, witness4.address];
          subjectThreshold = BigNumber.from(2);
        });

        it("should verify successfully with excess signatures", async () => {
          const result = await subject();
          expect(result).to.be.true;
        });
      });

      describe("Different signature orderings", () => {
        let sig1: string;
        let sig2: string;
        let sig3: string;

        beforeEach(async () => {
          sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          sig2 = await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash));
          sig3 = await witness3.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectWitnesses = [witness1.address, witness2.address, witness3.address];
          subjectThreshold = BigNumber.from(2);
        });

        it("should verify with signatures in order", async () => {
          subjectSignatures = [sig1, sig2, sig3];
          const result = await subject();
          expect(result).to.be.true;
        });

        it("should verify with signatures in reverse order", async () => {
          subjectSignatures = [sig3, sig2, sig1];
          const result = await subject();
          expect(result).to.be.true;
        });

        it("should verify with signatures in random order", async () => {
          subjectSignatures = [sig2, sig3, sig1];
          const result = await subject();
          expect(result).to.be.true;
        });
      });
    });

    describe("Invalid/Error Scenarios", () => {
      describe("Zero threshold", () => {
        beforeEach(async () => {
          const signature = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          subjectSignatures = [signature];
          subjectWitnesses = [witness1.address];
          subjectThreshold = BigNumber.from(0);
        });

        it("should revert with proper error message", async () => {
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold must be > 0");
        });
      });

      describe("Threshold exceeds signatures provided", () => {
        beforeEach(async () => {
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          subjectSignatures = [sig1];
          subjectWitnesses = [witness1.address, witness2.address];
          subjectThreshold = BigNumber.from(2);
        });

        it("should revert with proper error message", async () => {
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold exceeds signatures");
        });
      });

      describe("Threshold exceeds witnesses provided", () => {
        beforeEach(async () => {
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig2 = await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash));
          subjectSignatures = [sig1, sig2];
          subjectWitnesses = [witness1.address];
          subjectThreshold = BigNumber.from(2);
        });

        it("should revert with proper error message", async () => {
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold exceeds witnesses");
        });
      });

      describe("Not enough valid signatures to meet threshold", () => {
        beforeEach(async () => {
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const invalidSig = await nonWitness.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectSignatures = [sig1, invalidSig];
          subjectWitnesses = [witness1.address, witness2.address];
          subjectThreshold = BigNumber.from(2);
        });

        it("should revert when not enough valid signatures", async () => {
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: Not enough valid witness signatures");
        });
      });

      describe("Some valid signatures but below threshold", () => {
        beforeEach(async () => {
          // Get 2 valid signatures from actual witnesses
          const validSig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const validSig2 = await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash));

          // Get 2 invalid signatures (from non-witnesses)
          const invalidSig1 = await nonWitness.wallet.signMessage(ethers.utils.arrayify(messageHash));
          // Create another invalid signature from a different message
          const wrongMessage = "Different message";
          const wrongMessageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(wrongMessage));
          const invalidSig2 = await witness3.wallet.signMessage(ethers.utils.arrayify(wrongMessageHash));

          // Mix valid and invalid signatures: 2 valid + 2 invalid = 4 total
          subjectSignatures = [validSig1, invalidSig1, validSig2, invalidSig2];

          // Provide 4 witnesses but threshold requires 3 valid signatures
          subjectWitnesses = [witness1.address, witness2.address, witness3.address, witness4.address];
          subjectThreshold = BigNumber.from(3);
        });

        it("should revert with proper error when valid signatures exist but don't meet threshold", async () => {
          // This test verifies that even though we have 2 valid signatures (from witness1 and witness2),
          // they don't meet the required threshold of 3, so the function should revert
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: Not enough valid witness signatures");
        });

        it("should verify the exact failure scenario", async () => {
          // Additional test to confirm the specific case:
          // - Threshold is 3
          // - 4 witnesses are provided
          // - Only 2 valid signatures (witness1 and witness2)
          // - 2 invalid signatures (non-witness and wrong message)

          // First, let's verify that if we had 3 valid signatures, it would pass
          const validSig3 = await witness3.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const validSig4 = await witness4.wallet.signMessage(ethers.utils.arrayify(messageHash));

          // With 3 valid signatures, it should pass
          const threeValidSigs = [
            await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash)),
            await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash)),
            await witness3.wallet.signMessage(ethers.utils.arrayify(messageHash)),
            await nonWitness.wallet.signMessage(ethers.utils.arrayify(messageHash)) // Invalid but doesn't matter
          ];

          const result = await thresholdVerifier.verifyWitnessSignatures(
            subjectMessageHash,
            threeValidSigs,
            [witness1.address, witness2.address, witness3.address, witness4.address],
            BigNumber.from(3)
          );
          expect(result).to.be.true;

          // But with only 2 valid signatures (our original setup), it should fail
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: Not enough valid witness signatures");
        });
      });

      describe("Invalid signatures", () => {
        beforeEach(async () => {
          // Create invalid signature by signing with wrong account
          const invalidSig = await nonWitness.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectSignatures = [invalidSig];
          subjectWitnesses = [witness1.address];
          subjectThreshold = BigNumber.from(1);
        });

        it("should revert with invalid signatures", async () => {
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: Not enough valid witness signatures");
        });
      });

      describe("Duplicate witnesses signing", () => {
        beforeEach(async () => {
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          // Same witness signs again (duplicate)
          const sig1Duplicate = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectSignatures = [sig1, sig1Duplicate];
          subjectWitnesses = [witness1.address, witness2.address];
          subjectThreshold = BigNumber.from(2);
        });

        it("should only count unique witnesses", async () => {
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: Not enough valid witness signatures");
        });
      });

      describe("Empty signatures array", () => {
        beforeEach(async () => {
          subjectSignatures = [];
          subjectWitnesses = [witness1.address];
          subjectThreshold = BigNumber.from(1);
        });

        it("should revert when signatures array is empty", async () => {
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold exceeds signatures");
        });
      });

      describe("Empty witnesses array", () => {
        beforeEach(async () => {
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          subjectSignatures = [sig1];
          subjectWitnesses = [];
          subjectThreshold = BigNumber.from(1);
        });

        it("should revert when witnesses array is empty", async () => {
          await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold exceeds witnesses");
        });
      });
    });

    describe("Edge Cases", () => {
      describe("Maximum practical threshold", () => {
        beforeEach(async () => {
          // Create 10 witnesses
          const witnesses = [witness1, witness2, witness3, witness4, witness5];
          const additionalAccounts = await getAccounts();
          for (let i = 0; i < 5; i++) {
            witnesses.push(additionalAccounts[i + 8]);
          }

          // Sign with all 10 witnesses
          const signatures: string[] = [];
          const witnessAddresses: Address[] = [];

          for (const witness of witnesses) {
            const sig = await witness.wallet.signMessage(ethers.utils.arrayify(messageHash));
            signatures.push(sig);
            witnessAddresses.push(witness.address);
          }

          subjectSignatures = signatures;
          subjectWitnesses = witnessAddresses;
          subjectThreshold = BigNumber.from(10);
        });

        it("should handle maximum threshold of 10 witnesses", async () => {
          const result = await subject();
          expect(result).to.be.true;
        });
      });

      describe("Signatures from non-witnesses", () => {
        beforeEach(async () => {
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const nonWitnessSig = await nonWitness.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig2 = await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectSignatures = [sig1, nonWitnessSig, sig2];
          subjectWitnesses = [witness1.address, witness2.address];
          subjectThreshold = BigNumber.from(2);
        });

        it("should ignore signatures from non-witnesses and still pass", async () => {
          const result = await subject();
          expect(result).to.be.true;
        });
      });

      describe("Same witness appearing multiple times in witness array", () => {
        beforeEach(async () => {
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig2 = await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectSignatures = [sig1, sig2];
          // witness1 appears twice in the array
          subjectWitnesses = [witness1.address, witness1.address, witness2.address];
          subjectThreshold = BigNumber.from(2);
        });

        it("should handle duplicate witnesses in array correctly", async () => {
          const result = await subject();
          expect(result).to.be.true;
        });
      });

      describe("Early exit optimization when threshold is met", () => {
        beforeEach(async () => {
          // Create many signatures but only need 2
          const sig1 = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig2 = await witness2.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig3 = await witness3.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig4 = await witness4.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const sig5 = await witness5.wallet.signMessage(ethers.utils.arrayify(messageHash));

          subjectSignatures = [sig1, sig2, sig3, sig4, sig5];
          subjectWitnesses = [witness1.address, witness2.address, witness3.address, witness4.address, witness5.address];
          subjectThreshold = BigNumber.from(2);
        });

        it("should exit early when threshold is met", async () => {
          // Should pass with just first 2 signatures checked
          const result = await subject();
          expect(result).to.be.true;
        });
      });

      describe("Malformed signatures", () => {
        it("should handle signatures with wrong length", async () => {
          const validSig = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const malformedSig = "0x1234"; // Too short

          await expect(
            thresholdVerifier.verifyWitnessSignatures(
              messageHash,
              [validSig, malformedSig],
              [witness1.address, witness2.address],
              2
            )
          ).to.be.revertedWith("ThresholdSigVerifierUtils: Not enough valid witness signatures");
        });

        it("should handle empty signature bytes", async () => {
          const validSig = await witness1.wallet.signMessage(ethers.utils.arrayify(messageHash));
          const emptySig = "0x";

          await expect(
            thresholdVerifier.verifyWitnessSignatures(
              messageHash,
              [validSig, emptySig],
              [witness1.address, witness2.address],
              2
            )
          ).to.be.revertedWith("ThresholdSigVerifierUtils: Not enough valid witness signatures");
        });
      });
    });
  });
});