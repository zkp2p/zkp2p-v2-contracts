import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, VenmoReclaimVerifier, USDCMock, IPaymentVerifier } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, convertSignatureToHex, encodeProof, parseExtensionProof } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const venmoExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"method\":\"GET\",\"paramValues\":{\"SENDER_ID\":\"1168869611798528966\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"subType\\\":\\\"none\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[2].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[2].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[2].paymentId\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[2].title.receiver.id\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[2].subType\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1741289466,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"1130949156358289030228004429378196774671616229922798947763187449647160396233\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"1.00\",\"date\":\"2025-03-06T18:36:45\",\"paymentId\":\"4282537099205562654\",\"receiverId\":\"0xc70eb85ded26d9377e4f0b244c638ee8f7e731114911bf547bff27f7d8fc3bfa\"},\"providerHash\":\"0x709569cc5850c23c4d8966524137d40b82d3056949fb0912be29a10803784a75\"}",
    "identifier": "0x2392a6dbec48a64c9a0234d001837232fcfc80d4f79f2f53b0cf02605eeb7aad",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": { "0": 184, "1": 85, "2": 253, "3": 138, "4": 89, "5": 107, "6": 15, "7": 33, "8": 78, "9": 222, "10": 100, "11": 150, "12": 144, "13": 70, "14": 141, "15": 160, "16": 179, "17": 45, "18": 226, "19": 191, "20": 42, "21": 203, "22": 152, "23": 24, "24": 215, "25": 175, "26": 18, "27": 26, "28": 204, "29": 190, "30": 151, "31": 94, "32": 121, "33": 107, "34": 95, "35": 245, "36": 176, "37": 169, "38": 164, "39": 25, "40": 126, "41": 142, "42": 152, "43": 156, "44": 125, "45": 13, "46": 89, "47": 63, "48": 77, "49": 179, "50": 20, "51": 87, "52": 47, "53": 110, "54": 68, "55": 104, "56": 118, "57": 182, "58": 130, "59": 2, "60": 68, "61": 13, "62": 211, "63": 228, "64": 27 },
    "resultSignature": { "0": 182, "1": 9, "2": 118, "3": 147, "4": 66, "5": 156, "6": 239, "7": 12, "8": 146, "9": 76, "10": 46, "11": 93, "12": 102, "13": 241, "14": 223, "15": 20, "16": 95, "17": 108, "18": 28, "19": 204, "20": 209, "21": 117, "22": 33, "23": 69, "24": 197, "25": 89, "26": 228, "27": 35, "28": 179, "29": 1, "30": 140, "31": 129, "32": 10, "33": 30, "34": 224, "35": 53, "36": 64, "37": 190, "38": 14, "39": 140, "40": 62, "41": 46, "42": 234, "43": 33, "44": 62, "45": 86, "46": 116, "47": 228, "48": 140, "49": 244, "50": 8, "51": 102, "52": 246, "53": 43, "54": 100, "55": 47, "56": 37, "57": 190, "58": 183, "59": 37, "60": 13, "61": 249, "62": 83, "63": 129, "64": 27 }
  }
}

describe("VenmoReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

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

    witnesses = ["0x0636c417755e3ae25c6c166d181c0607f4c572a3", "0x244897572368eadf65bfbc5aec98d8e5443a9072"];
    providerHashes = ["0x709569cc5850c23c4d8966524137d40b82d3056949fb0912be29a10803784a75", "0x14de8b5503a4a6973bbaa9aa301ec7843e9bcaa3af05e6610b54c6fcc56aa425"];

    nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployVenmoReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.USD],
      providerHashes
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
      expect(providerHashes).to.deep.eq(providerHashes);
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
    let subjectDepositData: BytesLike;
    let subjectData: BytesLike;

    let paymentTimestamp: number;

    beforeEach(async () => {
      proof = parseExtensionProof(venmoExtensionProof);
      subjectProof = encodeProof(proof);

      const paymentTimeString = '2025-03-06T18:36:45Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1.1);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(0.9);   // 1.1 * 0.9 = 0.99 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = "0xc70eb85ded26d9377e4f0b244c638ee8f7e731114911bf547bff27f7d8fc3bfa";
      subjectFiatCurrency = Currency.USD;
      subjectDepositData = ethers.utils.defaultAbiCoder.encode(
        ['address[]'],
        [witnesses]
      );
      subjectData = "0x";
    });

    async function subject(): Promise<any> {
      return await verifier.connect(subjectCaller.wallet).verifyPayment({
        paymentProof: subjectProof,
        depositToken: subjectDepositToken,
        intentAmount: subjectIntentAmount,
        intentTimestamp: subjectIntentTimestamp,
        payeeDetails: subjectPayeeDetailsHash,
        fiatCurrency: subjectFiatCurrency,
        conversionRate: subjectConversionRate,
        depositData: subjectDepositData,
        data: subjectData
      });
    }

    async function subjectCallStatic(): Promise<IPaymentVerifier.PaymentVerificationResultStruct> {
      return await verifier.connect(subjectCaller.wallet).callStatic.verifyPayment({
        paymentProof: subjectProof,
        depositToken: subjectDepositToken,
        intentAmount: subjectIntentAmount,
        intentTimestamp: subjectIntentTimestamp,
        payeeDetails: subjectPayeeDetailsHash,
        fiatCurrency: subjectFiatCurrency,
        conversionRate: subjectConversionRate,
        depositData: subjectDepositData,
        data: subjectData
      });
    }

    it("should verify the proof", async () => {
      const result = await subjectCallStatic();

      expect(result.success).to.be.true;
      expect(result.intentHash).to.eq(BigNumber.from('1130949156358289030228004429378196774671616229922798947763187449647160396233').toHexString());
      // Payment is $1.00, conversion rate is 0.9, intent amount is 1.1
      // Release amount = 1.00 / 0.9 = 1.111... but capped at intent amount 1.1
      expect(result.releaseAmount).to.eq(usdc(1.1));
      expect(result.paymentCurrency).to.eq(Currency.USD);
      expect(result.paymentId).to.eq('4282537099205562654');
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['4282537099205562654']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is invalid", async () => {
      beforeEach(async () => {
        proof.signedClaim.claim.identifier = ZERO_BYTES32;
        subjectProof = encodeProof(proof);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.reverted;
      });
    });

    describe("when the payment amount is less than the expected payment amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(5); // Intent expects 5 * 0.9 = 4.5, but actual payment is 1.00
        subjectConversionRate = ether(0.9);
      });

      it("should succeed with partial payment", async () => {
        const result = await subjectCallStatic();

        expect(result.success).to.be.true;
        expect(result.intentHash).to.eq(BigNumber.from('1130949156358289030228004429378196774671616229922798947763187449647160396233').toHexString());
        // Payment is $1.00, conversion rate is 0.9, intent amount is 5
        // Release amount = 1.00 / 0.9 = 1.111... USDC
        expect(result.releaseAmount).to.eq(usdc(1).mul(ether(1)).div(ether(0.9)));
        expect(result.paymentCurrency).to.eq(Currency.USD);
        expect(result.paymentId).to.eq('4282537099205562654');
      });
    });

    describe("when the payment amount is zero", async () => {
      beforeEach(async () => {
        // Mock a proof with zero payment amount
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"1130949156358289030228004429378196774671616229922798947763187449647160396233\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"0.00\",\"date\":\"2025-03-06T18:36:45\",\"paymentId\":\"4282537099205562654\",\"receiverId\":\"0xc70eb85ded26d9377e4f0b244c638ee8f7e731114911bf547bff27f7d8fc3bfa\"},\"providerHash\":\"0x709569cc5850c23c4d8966524137d40b82d3056949fb0912be29a10803784a75\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // Sign the updated claim with witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof);
        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment amount must be greater than zero");
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
        subjectPayeeDetailsHash = 'incorrect_recipient_id';
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4550365876404035370013319374327198777228946732305032418394862064756897839843\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"1.01\",\"date\":\"2025-01-06T18:21:21\",\"paymentId\":\"4239767587180066226\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"providerHash\":\"0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fc\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof);
        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address]]
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
