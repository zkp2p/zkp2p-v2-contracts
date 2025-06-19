import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, RevolutReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, parseAppclipProof, parseExtensionProof, encodeProof } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const revolutExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9\\\\-]+)\"},{\"type\":\"regex\",\"value\":\"\\\"completedDate\\\":(?<completedDate>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"currency\\\":\\\"(?<currency>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<id>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"username\\\":\\\"(?<username>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.[1].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].completedDate\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].currency\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].id\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].recipient.username\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].state\",\"xPath\":\"\"}],\"url\":\"https://app.revolut.com/api/retail/user/current/transactions/last?count=20\",\"writeRedactionMode\":\"zk\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1736260735,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"2618855330259351132643749738312276409026917421853980101201034599731745761128\",\"extractedParameters\":{\"amount\":\"-98\",\"completedDate\":\"1735758706771\",\"currency\":\"EUR\",\"id\":\"67759372-3c29-a180-8947-6f71f4788e5a\",\"state\":\"COMPLETED\",\"username\":\"0xb0c846964b3a3afc29e2b1f931f7d66ee9cd542459cda2f7d22777e12394f923\"},\"providerHash\":\"0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c8\"}",
    "identifier": "0x1d6c3c320ff12f7924516496e213b8a1b49b4834644b92c9405a0b47a0461f9f",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "claimSignature": { "0": 243, "1": 131, "2": 21, "3": 127, "4": 82, "5": 15, "6": 164, "7": 81, "8": 198, "9": 173, "10": 13, "11": 42, "12": 216, "13": 85, "14": 255, "15": 5, "16": 242, "17": 59, "18": 168, "19": 129, "20": 192, "21": 222, "22": 117, "23": 64, "24": 5, "25": 7, "26": 244, "27": 33, "28": 54, "29": 80, "30": 100, "31": 131, "32": 12, "33": 182, "34": 225, "35": 141, "36": 41, "37": 183, "38": 7, "39": 201, "40": 167, "41": 151, "42": 37, "43": 132, "44": 92, "45": 42, "46": 153, "47": 135, "48": 34, "49": 112, "50": 133, "51": 15, "52": 246, "53": 255, "54": 77, "55": 14, "56": 81, "57": 72, "58": 207, "59": 25, "60": 46, "61": 171, "62": 164, "63": 215, "64": 28 },
    "resultSignature": { "0": 226, "1": 0, "2": 231, "3": 229, "4": 255, "5": 87, "6": 176, "7": 81, "8": 104, "9": 41, "10": 174, "11": 172, "12": 137, "13": 110, "14": 171, "15": 77, "16": 72, "17": 56, "18": 113, "19": 40, "20": 137, "21": 176, "22": 100, "23": 220, "24": 134, "25": 228, "26": 194, "27": 227, "28": 128, "29": 104, "30": 26, "31": 137, "32": 89, "33": 130, "34": 168, "35": 202, "36": 15, "37": 201, "38": 252, "39": 96, "40": 128, "41": 62, "42": 11, "43": 90, "44": 67, "45": 224, "46": 67, "47": 43, "48": 180, "49": 249, "50": 250, "51": 35, "52": 65, "53": 148, "54": 23, "55": 19, "56": 213, "57": 219, "58": 199, "59": 11, "60": 227, "61": 144, "62": 164, "63": 76, "64": 27 }
  }
}

const revolutAppclipProof = {
  "identifier": "0xb3d799daf7eaca4b4cb1c117c96b56d7c43a84d475ce43f655585da869932c3c",
  "claimData": {
    "provider": "http",
    "parameters": "{\"additionalClientOptions\":{},\"body\":\"\",\"geoLocation\":\"\",\"headers\":{\"Referer\":\"https://app.revolut.com/home?code=Y2JmMjBhZmQtY2QyMS00YzJhLTlmY2QtMDU1Zjc4ZTQyN2Q1OjI1Mjk3MDgxOlMyNTY&state=AryE4alx1ELqBdjl\",\"Sec-Fetch-Mode\":\"same-origin\",\"User-Agent\":\"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1\",\"accept\":\"application/json, text/plain, */*\"},\"method\":\"GET\",\"paramValues\":{\"amount\":\"-100\",\"completedDate\":\"1736193670335\",\"currency\":\"USD\",\"id\":\"677c3686-4589-a4d3-b190-fc8380389c49\",\"state\":\"COMPLETED\",\"username\":\"alexgx7gy\"},\"responseMatches\":[{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"amount\\\":{{amount}}\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"currency\\\":\\\"{{currency}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"completedDate\\\":{{completedDate}}\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"username\\\":\\\"{{username}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"id\\\":\\\"{{id}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"state\\\":\\\"{{state}}\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$[0].amount\",\"regex\":\"\\\"amount\\\":(.*)\",\"xPath\":\"\"},{\"jsonPath\":\"$[0].currency\",\"regex\":\"\\\"currency\\\":\\\"(.*)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"$[0].completedDate\",\"regex\":\"\\\"completedDate\\\":(.*)\",\"xPath\":\"\"},{\"jsonPath\":\"$[0].recipient.username\",\"regex\":\"\\\"username\\\":\\\"(.*)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"$[0].id\",\"regex\":\"\\\"id\\\":\\\"(.*)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"$[0].state\",\"regex\":\"\\\"state\\\":\\\"(.*)\\\"\",\"xPath\":\"\"}],\"url\":\"https://app.revolut.com/api/retail/user/current/transactions/last?count=20\"}",
    "owner": "0xa4f239ae872b61a640b232f2066f21862caef5c1",
    "timestampS": 1736264732,
    "context": "{\"contextAddress\":\"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\",\"contextMessage\":\"21138964711553769010780423915557687380568289483182695160148231659899695028258\",\"extractedParameters\":{\"amount\":\"-100\",\"completedDate\":\"1736193670335\",\"currency\":\"USD\",\"id\":\"677c3686-4589-a4d3-b190-fc8380389c49\",\"state\":\"COMPLETED\",\"username\":\"alexgx7gy\"},\"providerHash\":\"0x1aab313df15d1b43710e53ed95b1b6118305aa9312f28b747c6c16cf574fb616\"}",
    "identifier": "0xb3d799daf7eaca4b4cb1c117c96b56d7c43a84d475ce43f655585da869932c3c",
    "epoch": 1
  },
  "signatures": [
    "0x18f6b64f0d5767eb5a29c8520baf1746df4a5248eb4bc52c292e44e1b13eb01031cf5320a885b2e4ca2f96cc56f08dbee65e9a11b42075e001e709f53eb2c4ca1c"
  ],
  "witnesses": [
    {
      "id": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
      "url": "wss://witness.reclaimprotocol.org/ws"
    }
  ],
  "publicData": {}
}


describe("RevolutReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: RevolutReclaimVerifier;
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
    providerHashes = ["0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c8", "0x1aab313df15d1b43710e53ed95b1b6118305aa9312f28b747c6c16cf574fb616"];

    nullifierRegistry = await deployer.deployNullifierRegistry();
    verifier = await deployer.deployRevolutReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.EUR, Currency.USD, Currency.GBP, Currency.SGD],
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

    beforeEach(async () => {
      proof = parseExtensionProof(revolutExtensionProof);
      subjectProof = encodeProof(proof);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1);
      subjectIntentTimestamp = BigNumber.from(1735758706);
      subjectConversionRate = ether(0.98);     // 1 USDC * 0.98 EUR / USDC = 0.98 EUR required payment amount
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['alexgx7gy'])
      );
      subjectFiatCurrency = Currency.EUR;
      subjectData = "0x";
      subjectDepositData = ethers.utils.defaultAbiCoder.encode(
        ['address[]'],
        [witnesses]
      );
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
        data: subjectData,
        depositData: subjectDepositData
      });
    }

    async function subjectCallStatic(): Promise<any> {
      return await verifier.connect(subjectCaller.wallet).callStatic.verifyPayment({
        paymentProof: subjectProof,
        depositToken: subjectDepositToken,
        intentAmount: subjectIntentAmount,
        intentTimestamp: subjectIntentTimestamp,
        payeeDetails: subjectPayeeDetailsHash,
        fiatCurrency: subjectFiatCurrency,
        conversionRate: subjectConversionRate,
        data: subjectData,
        depositData: subjectDepositData
      });
    }

    it("should verify the proof", async () => {
      const result = await subjectCallStatic();

      expect(result.success).to.be.true;
      expect(result.intentHash).to.eq(BigNumber.from('2618855330259351132643749738312276409026917421853980101201034599731745761128').toHexString());
      // Payment is 0.98 EUR, conversion rate is 0.9, intent amount is 1 USDC
      // Release amount = 0.98 / 0.9 = 1.0888... but capped at intent amount 1
      expect(result.releaseAmount).to.eq(usdc(1));
      expect(result.paymentCurrency).to.eq(Currency.EUR);
      expect(result.paymentId).to.eq('67759372-3c29-a180-8947-6f71f4788e5a');
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['67759372-3c29-a180-8947-6f71f4788e5a']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is an appclip proof", async () => {
      beforeEach(async () => {
        proof = parseAppclipProof(revolutAppclipProof);
        subjectProof = encodeProof(proof);

        subjectFiatCurrency = Currency.USD;
        subjectPayeeDetailsHash = ethers.utils.keccak256(
          ethers.utils.solidityPack(['string'], ['alexgx7gy'])
        );
      });

      it("should verify the proof", async () => {
        const result = await subjectCallStatic();

        expect(result.success).to.be.true;
        expect(result.intentHash).to.eq(BigNumber.from('21138964711553769010780423915557687380568289483182695160148231659899695028258').toHexString());
        expect(result.releaseAmount).to.eq(usdc(1));
        expect(result.paymentCurrency).to.eq(Currency.USD);
        expect(result.paymentId).to.eq('677c3686-4589-a4d3-b190-fc8380389c49');
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

    describe("when the payment amount is less than the expected payment amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(2); // Intent expects 2 * 0.9 = 1.8, but actual payment is 0.98
        subjectConversionRate = ether(0.9);
      });

      it("should succeed with partial payment", async () => {
        const result = await subjectCallStatic();

        expect(result.success).to.be.true;
        expect(result.intentHash).to.eq(BigNumber.from("2618855330259351132643749738312276409026917421853980101201034599731745761128").toHexString());
        // Payment is 0.98 EUR, conversion rate is 0.9, intent amount is 2 USDC
        // Release amount = 0.98 / 0.9 = 1.0888... but capped at intent amount 1
        expect(result.releaseAmount).to.eq(usdc(1.088888));   // restricted to 6 decimal places and rounded down
        expect(result.paymentCurrency).to.eq(Currency.EUR);
        expect(result.paymentId).to.eq('67759372-3c29-a180-8947-6f71f4788e5a');
      });
    });

    describe("when the payment amount is zero", async () => {
      beforeEach(async () => {
        // Mock a proof with zero payment amount
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"2618855330259351132643749738312276409026917421853980101201034599731745761128\",\"extractedParameters\":{\"amount\":\"-0\",\"completedDate\":\"1735758706771\",\"currency\":\"EUR\",\"id\":\"67759372-3c29-a180-8947-6f71f4788e5a\",\"state\":\"COMPLETED\",\"username\":\"0xb0c846964b3a3afc29e2b1f931f7d66ee9cd542459cda2f7d22777e12394f923\"},\"providerHash\":\"0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c8\"}";
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
        subjectIntentTimestamp = BigNumber.from(1735758706).add(1).add(BigNumber.from(30));  // payment timestamp + 1 + 30 seconds (buffer)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });

      describe("when the payment was made after the intent", async () => {
        beforeEach(async () => {
          subjectIntentTimestamp = BigNumber.from(1735758706).add(0).add(BigNumber.from(30));  // payment timestamp + 0 + 30 seconds (buffer)
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

      describe("when the proof is an appclip proof", async () => {
        beforeEach(async () => {
          proof = parseAppclipProof(revolutAppclipProof);
          subjectProof = encodeProof(proof);
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
        });
      });
    });

    describe("when the currency is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = ZERO_BYTES32;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment currency");
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"17987314991900533465386579731694410438546809091389467293995987266679315178333\",\"extractedParameters\":{\"amount\":\"-98\",\"completedDate\":\"1735758706771\",\"currency\":\"EUR\",\"id\":\"67759372-3c29-a180-8947-6f71f4788e5a\",\"state\":\"COMPLETED\",\"username\":\"0xb0c846964b3a3afc29e2b1f931f7d66ee9cd542459cda2f7d22777e12394f923\"},\"providerHash\":\"0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c9\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof)
        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("No valid providerHash");
      });
    });

    describe("when the payment status is not correct", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"17987314991900533465386579731694410438546809091389467293995987266679315178333\",\"extractedParameters\":{\"amount\":\"-98\",\"completedDate\":\"1735758706771\",\"currency\":\"EUR\",\"id\":\"67759372-3c29-a180-8947-6f71f4788e5a\",\"state\":\"INCOMPLETE\",\"username\":\"0xb0c846964b3a3afc29e2b1f931f7d66ee9cd542459cda2f7d22777e12394f923\"},\"providerHash\":\"0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c8\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof)
        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid payment status");
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