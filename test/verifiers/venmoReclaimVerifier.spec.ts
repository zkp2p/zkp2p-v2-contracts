import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, VenmoReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, convertSignatureToHex } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";


import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const venmoPaymentProof = {
  provider: "http",
  parameters: "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"receiver\\\":\\\\{\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[7].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[7].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[7].title.receiver\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[7].paymentId\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId=1168869611798528966\"}",
  owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
  timestampS: 1734031970,
  context: "{\"extractedParameters\":{\"amount\":\"42.00\",\"date\":\"2024-10-27T18:16:11\",\"paymentId\":\"4188305907305244155\",\"receiverId\":\"0x7d017fe071884ed32040ce481e7561ab15da46c9478b566750e6617281172211\"},\"intentHash\":\"14527918542887692994877265012607290228020786464417481864664720498778276484603\",\"providerHash\":\"0x56a20cb9afab516f74191aa8a6e5f1dfd97c1514f7359975e75e364f022360fe\"}",
  identifier: "0x1f1bc1682b1f54ab0d4a5ac7608c05ef931639d30cc37c8770f2c0d3569efc93",
  epoch: 1,
  signature: { "0": 62, "1": 52, "2": 203, "3": 247, "4": 252, "5": 74, "6": 119, "7": 45, "8": 206, "9": 166, "10": 54, "11": 231, "12": 100, "13": 240, "14": 134, "15": 254, "16": 1, "17": 224, "18": 250, "19": 15, "20": 220, "21": 242, "22": 100, "23": 94, "24": 38, "25": 8, "26": 35, "27": 57, "28": 253, "29": 9, "30": 178, "31": 131, "32": 84, "33": 250, "34": 250, "35": 223, "36": 15, "37": 8, "38": 1, "39": 190, "40": 58, "41": 201, "42": 46, "43": 163, "44": 56, "45": 228, "46": 53, "47": 252, "48": 62, "49": 20, "50": 206, "51": 140, "52": 75, "53": 54, "54": 188, "55": 124, "56": 99, "57": 175, "58": 26, "59": 54, "60": 236, "61": 117, "62": 239, "63": 230, "64": 27 }
}


const blockchain = new Blockchain(ethers.provider);

describe("VenmoReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHash: string;
  let witnessAddress: Address;

  let nullifierRegistry: NullifierRegistry;
  let verifier: VenmoReclaimVerifier;
  let usdcToken: USDCMock;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      owner,
      attacker,
      escrow
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    witnessAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    providerHash = "0x56a20cb9afab516f74191aa8a6e5f1dfd97c1514f7359975e75e364f022360fe";

    nullifierRegistry = await deployer.deployNullifierRegistry();
    const claimVerifier = await deployer.deployClaimVerifier();
    verifier = await deployer.deployVenmoReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.USD],
      [providerHash],
      "contracts/lib/ClaimVerifier.sol:ClaimVerifier",
      claimVerifier.address
    );

    await nullifierRegistry.connect(owner.wallet).addWritePermission(verifier.address);
  });

  describe("#constructor", async () => {
    it("should set the correct state", async () => {
      const escrowAddress = await verifier.escrow();
      const nullifierRegistryAddress = await verifier.nullifierRegistry();
      const timestampBuffer = await verifier.timestampBuffer();
      const providerHashes = await verifier.getProviderHashes();

      expect(nullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(timestampBuffer).to.eq(BigNumber.from(30));
      expect(providerHashes).to.deep.eq([providerHash]);
      expect(escrowAddress).to.eq(escrow.address);
    });
  });

  describe("#verifyPayment", async () => {
    let proof: ReclaimProof;

    let subjectCaller: Account;
    let subjectProof: BytesLike;
    let subjectDepositToken: Address;
    let subjectIntentAmount: BigNumber;
    let subjectIntentTimestamp: BigNumber;
    let subjectConversionRate: BigNumber;
    let subjectPayeeDetailsHash: string;
    let subjectFiatCurrency: BytesLike;
    let subjectData: BytesLike;

    beforeEach(async () => {
      proof = {
        claimInfo: {
          provider: venmoPaymentProof.provider,
          parameters: venmoPaymentProof.parameters,
          context: venmoPaymentProof.context
        },
        signedClaim: {
          claim: {
            identifier: venmoPaymentProof.identifier,
            owner: venmoPaymentProof.owner,
            timestampS: BigNumber.from(venmoPaymentProof.timestampS),
            epoch: BigNumber.from(venmoPaymentProof.epoch)
          },
          signatures: [convertSignatureToHex(venmoPaymentProof.signature)]
        }
      };
      subjectProof = ethers.utils.defaultAbiCoder.encode(
        [
          "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
        ],
        [proof]
      );

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(5);
      subjectIntentTimestamp = BigNumber.from(1727914697);
      subjectConversionRate = ether(1);
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['1662743480369152806'])
      );
      subjectFiatCurrency = ZERO_BYTES32;
      subjectData = ethers.utils.defaultAbiCoder.encode(
        ['address'],
        [witnessAddress]
      );
    });

    async function subject(): Promise<any> {
      return await verifier.connect(subjectCaller.wallet).verifyPayment(
        subjectProof,
        subjectDepositToken,
        subjectIntentAmount,
        subjectIntentTimestamp,
        subjectPayeeDetailsHash,
        subjectFiatCurrency,
        subjectConversionRate,
        subjectData
      );
    }

    async function subjectCallStatic(): Promise<[boolean, string]> {
      return await verifier.connect(subjectCaller.wallet).callStatic.verifyPayment(
        subjectProof,
        subjectDepositToken,
        subjectIntentAmount,
        subjectIntentTimestamp,
        subjectPayeeDetailsHash,
        subjectFiatCurrency,
        subjectConversionRate,
        subjectData
      );
    }

    it("should verify the proof", async () => {
      const [
        verified,
        intentHash
      ] = await subjectCallStatic();

      expect(verified).to.be.true;
      expect(intentHash).to.eq("0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb");
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['4188305907305244155']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when proof payee details is not hash but just raw venmo id", async () => {
      beforeEach(async () => {
        const venmoPaymentProof2 = {
          provider: "http",
          parameters: "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"receiver\\\":\\\\{\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[9].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].title.receiver\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].paymentId\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId=1168869611798528966\"}",
          owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
          timestampS: 1734114562,
          context: "{\"extractedParameters\":{\"amount\":\"42.00\",\"date\":\"2024-10-27T18:16:11\",\"paymentId\":\"4188305907305244155\",\"receiverId\":\"1662743480369152806\"},\"intentHash\":\"14527918542887692994877265012607290228020786464417481864664720498778276484603\",\"providerHash\":\"0x2c9c02c5327577be7f67a418eb97312c73b89323d1fd436e02de3510e6c8de04\"}",
          identifier: "0x8a0af951fc18f323c5d883126113f3ff41c7769afaf65cc743e33d7ee9694695",
          epoch: 1,
          signature: { "0": 9, "1": 140, "2": 7, "3": 173, "4": 107, "5": 201, "6": 6, "7": 25, "8": 98, "9": 142, "10": 77, "11": 184, "12": 16, "13": 204, "14": 63, "15": 25, "16": 119, "17": 143, "18": 12, "19": 131, "20": 20, "21": 156, "22": 174, "23": 253, "24": 5, "25": 158, "26": 230, "27": 74, "28": 212, "29": 114, "30": 243, "31": 246, "32": 66, "33": 149, "34": 15, "35": 208, "36": 178, "37": 139, "38": 36, "39": 242, "40": 114, "41": 147, "42": 8, "43": 68, "44": 218, "45": 19, "46": 158, "47": 62, "48": 197, "49": 100, "50": 55, "51": 73, "52": 50, "53": 130, "54": 130, "55": 44, "56": 184, "57": 67, "58": 198, "59": 93, "60": 21, "61": 75, "62": 6, "63": 32, "64": 28 }
        };

        const proof2 = {
          claimInfo: {
            provider: venmoPaymentProof2.provider,
            parameters: venmoPaymentProof2.parameters,
            context: venmoPaymentProof2.context
          },
          signedClaim: {
            claim: {
              identifier: venmoPaymentProof2.identifier,
              owner: venmoPaymentProof2.owner,
              timestampS: BigNumber.from(venmoPaymentProof2.timestampS),
              epoch: BigNumber.from(venmoPaymentProof2.epoch)
            },
            signatures: [convertSignatureToHex(venmoPaymentProof2.signature)]
          }
        };

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          [
            "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
          ],
          [proof2]
        );
        subjectPayeeDetailsHash = "1662743480369152806";

        await verifier.connect(owner.wallet).addProviderHash('0x2c9c02c5327577be7f67a418eb97312c73b89323d1fd436e02de3510e6c8de04')
      });

      it("should verify the proof", async () => {
        const [
          verified,
          intentHash
        ] = await subjectCallStatic();

        expect(verified).to.be.true;
        expect(intentHash).to.eq("0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb");
      });
    });

    describe("when the proof is invalid", async () => {
      beforeEach(async () => {
        proof.signedClaim.claim.identifier = ZERO_BYTES32;

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          [
            "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
          ],
          [proof]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.reverted;
      });
    });

    describe("when the payment amount is less than the intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(43);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });
    });

    describe("when the payment was made before the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(1730052971).add(1).add(BigNumber.from(30));  // payment timestamp + 1 + 30 seconds (buffer)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });

      describe("when the payment was made after the intent", async () => {
        beforeEach(async () => {
          subjectIntentTimestamp = BigNumber.from(1730052971).add(0).add(BigNumber.from(30));  // payment timestamp + 0 + 30 seconds (buffer)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the payment recipient is incorrect", async () => {
      beforeEach(async () => {
        subjectPayeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['645716473020416187']));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
      });
    });

    describe("when the proof has already been verified", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Nullifier has already been used");
      });
    });

    describe("when the provider hash is invalid", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"extractedParameters\":{\"amount\":\"5.00\",\"date\":\"2024-10-03T00:17:47\",\"paymentId\":\"4170368513012150718\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"intentHash\":\"0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb\",\"providerHash\":\"0x92da474c63ba5e4ce0b927c557dc78dfd4b6284c39c587725c41c55cf709cae6\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          [
            "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
          ],
          [proof]
        );
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address'],
          [witness.address]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("No valid providerHash");
      });
    });

    describe("when the caller is not the escrow", async () => {
      beforeEach(async () => {
        subjectCaller = owner;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Only escrow can call");
      });
    });
  });
});
