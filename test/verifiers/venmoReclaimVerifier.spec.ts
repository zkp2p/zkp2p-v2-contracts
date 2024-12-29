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
  parameters: "{\"body\":\"\",\"method\":\"GET\",\"paramValues\":{\"SENDER_ID\":\"1168869611798528966\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"receiver\\\":\\\\{\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[0].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].title.receiver\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].paymentId\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}\"}",
  owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
  timestampS: 1735409756,
  context: "{\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"1.00\",\"date\":\"2024-12-27T18:38:13\",\"paymentId\":\"4232528312495771193\",\"receiverId\":\"0xc70eb85ded26d9377e4f0b244c638ee8f7e731114911bf547bff27f7d8fc3bfa\"},\"intentHash\":\"20763198655177264882257024227236641813116832862429638592176604264343126669866\",\"providerHash\":\"0x018ddd9ee6e342119ca207c6db1c55b22d111ee00d559bf5a09950c08ae082d6\"}",
  identifier: "0x1ce4677e48699432ee6993b502e235dcbc9530bfc1e8bb022fdbd2b071fa647f",
  epoch: 1,
  signature: { "0": 139, "1": 100, "2": 130, "3": 64, "4": 138, "5": 229, "6": 137, "7": 225, "8": 194, "9": 251, "10": 117, "11": 204, "12": 47, "13": 117, "14": 133, "15": 2, "16": 216, "17": 64, "18": 230, "19": 105, "20": 34, "21": 210, "22": 187, "23": 230, "24": 99, "25": 195, "26": 82, "27": 150, "28": 242, "29": 15, "30": 15, "31": 222, "32": 33, "33": 13, "34": 253, "35": 154, "36": 85, "37": 123, "38": 194, "39": 98, "40": 240, "41": 252, "42": 228, "43": 56, "44": 177, "45": 191, "46": 121, "47": 145, "48": 196, "49": 43, "50": 58, "51": 135, "52": 50, "53": 237, "54": 135, "55": 173, "56": 23, "57": 66, "58": 208, "59": 2, "60": 254, "61": 105, "62": 151, "63": 45, "64": 27 }
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
    providerHash = "0x018ddd9ee6e342119ca207c6db1c55b22d111ee00d559bf5a09950c08ae082d6";

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

    let paymentTimestamp: number;

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
      const paymentTimeString = '2024-12-27T18:38:13Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1.1);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(0.9);   // 1.1 * 0.9 = 0.99 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['1557532678029312858'])
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

      expect(intentHash).to.eq(BigNumber.from('20763198655177264882257024227236641813116832862429638592176604264343126669866').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['4232528312495771193']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
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
        subjectIntentAmount = usdc(1.2);  // 1.2 * 0.9 = 1.08 [1.08 > 1.00]
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });
    });

    describe("when the payment was made before the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(paymentTimestamp).add(1).add(BigNumber.from(30));  // payment timestamp + 1 + 30 seconds (buffer)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });

      describe("when the payment was made after the intent", async () => {
        beforeEach(async () => {
          subjectIntentTimestamp = BigNumber.from(paymentTimestamp).add(0).add(BigNumber.from(30));  // payment timestamp + 0 + 30 seconds (buffer)
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
        proof.claimInfo.context = "{\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"5.00\",\"date\":\"2024-10-03T00:17:47\",\"paymentId\":\"4170368513012150718\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"intentHash\":\"0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb\",\"providerHash\":\"0x92da474c63ba5e4ce0b927c557dc78dfd4b6284c39c587725c41c55cf709cae6\"}";
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
