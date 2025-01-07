import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, VenmoReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, convertSignatureToHex, encodeProof, parseExtensionProof, parseAppclipProof } from "@utils/reclaimUtils";
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
    "parameters": "{\"body\":\"\",\"method\":\"GET\",\"paramValues\":{\"SENDER_ID\":\"1168869611798528966\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[0].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].paymentId\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].title.receiver.id\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1736195782,
    "context": "{\"contextAddress\":\"\",\"contextMessage\":\"4550365876404035370013319374327198777228946732305032418394862064756897839843\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"1.01\",\"date\":\"2025-01-06T18:21:21\",\"paymentId\":\"4239767587180066226\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"providerHash\":\"0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fd\"}",
    "identifier": "0x121a29df03357bcf1f8a94246a0b53d9d24d6a326ab70b524920368311799730",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "claimSignature": { "0": 228, "1": 113, "2": 191, "3": 128, "4": 171, "5": 133, "6": 180, "7": 35, "8": 56, "9": 175, "10": 84, "11": 135, "12": 197, "13": 64, "14": 240, "15": 193, "16": 137, "17": 46, "18": 60, "19": 170, "20": 59, "21": 169, "22": 218, "23": 104, "24": 178, "25": 0, "26": 40, "27": 32, "28": 211, "29": 152, "30": 129, "31": 127, "32": 36, "33": 237, "34": 221, "35": 50, "36": 128, "37": 110, "38": 220, "39": 58, "40": 98, "41": 245, "42": 63, "43": 110, "44": 170, "45": 92, "46": 147, "47": 81, "48": 21, "49": 87, "50": 225, "51": 55, "52": 171, "53": 218, "54": 180, "55": 47, "56": 202, "57": 0, "58": 236, "59": 172, "60": 186, "61": 191, "62": 16, "63": 132, "64": 28 },
    "resultSignature": { "0": 138, "1": 251, "2": 54, "3": 204, "4": 229, "5": 219, "6": 63, "7": 186, "8": 161, "9": 44, "10": 52, "11": 156, "12": 187, "13": 17, "14": 103, "15": 241, "16": 118, "17": 132, "18": 225, "19": 250, "20": 148, "21": 76, "22": 70, "23": 229, "24": 6, "25": 84, "26": 186, "27": 207, "28": 144, "29": 234, "30": 32, "31": 136, "32": 122, "33": 217, "34": 206, "35": 68, "36": 163, "37": 211, "38": 240, "39": 126, "40": 98, "41": 144, "42": 176, "43": 106, "44": 254, "45": 86, "46": 188, "47": 166, "48": 12, "49": 224, "50": 108, "51": 152, "52": 166, "53": 92, "54": 92, "55": 127, "56": 107, "57": 3, "58": 45, "59": 153, "60": 84, "61": 194, "62": 199, "63": 220, "64": 28 }
  }
}

const venmoAppclipProof = {
  "claim": {
    "identifier": "0x1625c2abaacc64e8f2be84f0b1600c10c82871f9680315ce07b1637035f76cdb",
    "claimData": {
      "provider": "http",
      "parameters": { "additionalClientOptions": {}, "body": "", "geoLocation": "", "headers": { "Referer": "https://account.venmo.com/account/mfa/code-prompt?k=GaGokSMZ6HPHRbHjmKW1jCLEKvP1lz49F3YiDSW5hDHwQpFsHA00gi2HNanwIaDB&next=%2F%3Ffeed%3Dmine", "Sec-Fetch-Mode": "same-origin", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1" }, "method": "GET", "paramValues": { "URL_PARAMS_GRD": "1168869611798528966", "amount": "1.01", "date": "2025-01-06T18:21:21", "paymentId": "4239767587180066226", "receiverId": "645716473020416186" }, "responseMatches": [{ "invert": false, "type": "contains", "value": "\"amount\":\"- ${{amount}}\"" }, { "invert": false, "type": "contains", "value": "\"date\":\"{{date}}\"" }, { "invert": false, "type": "contains", "value": "\"id\":\"{{receiverId}}\"" }, { "invert": false, "type": "contains", "value": "\"paymentId\":\"{{paymentId}}\"" }], "responseRedactions": [{ "jsonPath": "$.stories[0].amount", "regex": "\"amount\":\"- \\$(.*)\"", "xPath": "" }, { "jsonPath": "$.stories[0].date", "regex": "\"date\":\"(.*)\"", "xPath": "" }, { "jsonPath": "$.stories[0].title.receiver.id", "regex": "\"id\":\"(.*)\"", "xPath": "" }, { "jsonPath": "$.stories[0].paymentId", "regex": "\"paymentId\":\"(.*)\"", "xPath": "" }], "url": "https://account.venmo.com/api/stories?feedType=me&externalId={{URL_PARAMS_GRD}}" },
      "owner": "0xa4f239ae872b61a640b232f2066f21862caef5c1",
      "timestampS": 1736190917,
      "context": { "contextAddress": "0x0", "contextMessage": "", "extractedParameters": { "URL_PARAMS_GRD": "1168869611798528966", "amount": "1.01", "date": "2025-01-06T18:21:21", "paymentId": "4239767587180066226", "receiverId": "645716473020416186" }, "providerHash": "0x14de8b5503a4a6973bbaa9aa301ec7843e9bcaa3af05e6610b54c6fcc56aa425" },
      "epoch": 1
    },
    "signatures": {
      "0": "0xd13dfb32a32ac2e91e9a54fc7d04faffa15f6facf3bed6033c775f8775dde0c771592c870b7406617d25f06cc7e620ac3de3a49769d8aba23532122bbc3508ef1c"
    },
    "witnesses": {
      "0": {
        "id": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
        "url": "wss://witness.reclaimprotocol.org/ws",
        "publicData": ""
      }
    }
  }
};

describe.only("VenmoReclaimVerifier", () => {
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

    witnesses = ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "0x244897572368eadf65bfbc5aec98d8e5443a9072"];
    providerHashes = ["0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fd", "0x14de8b5503a4a6973bbaa9aa301ec7843e9bcaa3af05e6610b54c6fcc56aa425"];

    nullifierRegistry = await deployer.deployNullifierRegistry();
    const claimVerifier = await deployer.deployClaimVerifier();
    verifier = await deployer.deployVenmoReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.USD],
      providerHashes,
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
    let subjectData: BytesLike;

    let paymentTimestamp: number;

    beforeEach(async () => {
      proof = parseExtensionProof(venmoExtensionProof);
      subjectProof = encodeProof(proof);

      const paymentTimeString = '2025-01-06T18:21:21Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1.1);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(0.9);   // 1.1 * 0.9 = 0.99 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['645716473020416186'])
      );
      subjectFiatCurrency = ZERO_BYTES32;
      subjectData = ethers.utils.defaultAbiCoder.encode(
        ['address[]'],
        [witnesses]
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

      expect(intentHash).to.eq(BigNumber.from('4550365876404035370013319374327198777228946732305032418394862064756897839843').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['4239767587180066226']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is an appclip proof", async () => {
      beforeEach(async () => {
        proof = parseAppclipProof(venmoAppclipProof);
        subjectProof = encodeProof(proof);

        subjectPayeeDetailsHash = ethers.utils.keccak256(
          ethers.utils.solidityPack(['string'], ['645716473020416186'])
        );
      });

      it("should verify the proof", async () => {
        const [
          verified,
          intentHash
        ] = await subjectCallStatic();

        expect(verified).to.be.true;

        // expect(intentHash).to.eq(BigNumber.from('4550365876404035370013319374327198777228946732305032418394862064756897839843').toHexString());
      });
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

    describe("when the payment amount is less than the intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(1.2);  // 1.2 * 0.9 = 1.08 [1.08 > 1.01]
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
        subjectPayeeDetailsHash = 'incorrect_recipient_id';
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
      });

      describe("when the proof is an appclip proof", async () => {
        beforeEach(async () => {
          proof = parseAppclipProof(venmoAppclipProof);
          subjectProof = encodeProof(proof);
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
        });
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
        proof.claimInfo.context = "{\"contextAddress\":\"\",\"contextMessage\":\"4550365876404035370013319374327198777228946732305032418394862064756897839843\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"1.01\",\"date\":\"2025-01-06T18:21:21\",\"paymentId\":\"4239767587180066226\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"providerHash\":\"0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fc\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof);
        subjectData = ethers.utils.defaultAbiCoder.encode(
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
