import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { MercadoPagoReclaimVerifier, NullifierRegistry, USDCMock } from "@utils/contracts";
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

const mercadoOnlineTransferExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"headers\":{\"Accept\":\"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7\",\"Accept-Language\":\"en-US,en;q=0.9\",\"Sec-Fetch-Dest\":\"document\",\"Sec-Fetch-Mode\":\"navigate\",\"Sec-Fetch-Site\":\"none\",\"Upgrade-Insecure-Requests\":\"1\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36\",\"device-memory\":\"8\",\"downlink\":\"10\",\"dpr\":\"2\",\"ect\":\"4g\",\"rtt\":\"50\",\"sec-ch-ua\":\"\\\"Chromium\\\";v=\\\"134\\\", \\\"Not:A-Brand\\\";v=\\\"24\\\", \\\"Google Chrome\\\";v=\\\"134\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\",\"viewport-width\":\"1066\"},\"method\":\"GET\",\"paramValues\":{\"PAYMENT_ID\":\"online_transfer_movement-40397c71e99fb3afceeed91664536aa631484ceb\",\"URL_PARAMS_FROM\":\"mp-home\"},\"responseMatches\":[{\"hash\":true,\"type\":\"regex\",\"value\":\"v2__detail\\\">(.*?)CVU: (?<recipientId>[0-9]+)</li>\"},{\"type\":\"regex\",\"value\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(?<amt>[0-9.]+)</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(?<cents>[0-9]+)</span>\"},{\"type\":\"regex\",\"value\":\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(?<curr>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\",\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\",\\\"sections\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"operationId\\\":(?<paymentId>[^,]+),\\\"activityName\\\":\\\"(?<paymentType>[^\\\"]+)\\\",\\\"activityStatus\\\":\\\"(?<paymentStatus>[^\\\"]+)\\\",\"}],\"responseRedactions\":[{\"jsonPath\":\"\",\"regex\":\"v2__detail\\\">(.*?)CVU: (.*?)</li>\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(.*?)</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(.*?)</span>\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"\\\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(.*?)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\",\\\"date\\\":\\\"(.*)\\\",\\\"sections\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"\\\"operationId\\\":(.*?),\\\"activityName\\\":\\\"(.*?)\\\",\\\"activityStatus\\\":\\\"(.*?),\",\"xPath\":\"\"}],\"url\":\"https://www.mercadopago.com.ar/activities/detail/{{PAYMENT_ID}}?from={{URL_PARAMS_FROM}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1742588826,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4519540906848171844380991692694776058038564615875128315222420248570560176998\",\"extractedParameters\":{\"PAYMENT_ID\":\"online_transfer_movement-40397c71e99fb3afceeed91664536aa631484ceb\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"1\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-03-21T19:54:05.000Z\",\"paymentId\":\"105936159704\",\"paymentStatus\":\"approved\",\"paymentType\":\"transfer_online\",\"recipientId\":\"0xf5b16d9e4edde5a51d378b8126eaffb65d0d06d0ad21f4d037611f945d3837e8\"},\"providerHash\":\"0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee\"}",
    "identifier": "0x7f0945b665233c542c5988c363df654482ce1ef27e082e434cc2edf8d620279d",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": { "0": 106, "1": 232, "2": 106, "3": 151, "4": 63, "5": 106, "6": 116, "7": 136, "8": 175, "9": 173, "10": 116, "11": 51, "12": 79, "13": 248, "14": 27, "15": 219, "16": 248, "17": 0, "18": 32, "19": 92, "20": 213, "21": 62, "22": 36, "23": 49, "24": 10, "25": 236, "26": 120, "27": 232, "28": 242, "29": 22, "30": 14, "31": 11, "32": 127, "33": 227, "34": 246, "35": 18, "36": 9, "37": 117, "38": 14, "39": 255, "40": 174, "41": 204, "42": 111, "43": 176, "44": 4, "45": 236, "46": 31, "47": 82, "48": 119, "49": 88, "50": 252, "51": 222, "52": 32, "53": 11, "54": 33, "55": 221, "56": 124, "57": 232, "58": 72, "59": 245, "60": 63, "61": 102, "62": 166, "63": 205, "64": 27 },
    "resultSignature": { "0": 185, "1": 54, "2": 48, "3": 63, "4": 138, "5": 215, "6": 211, "7": 242, "8": 228, "9": 164, "10": 24, "11": 18, "12": 185, "13": 124, "14": 4, "15": 151, "16": 57, "17": 187, "18": 149, "19": 94, "20": 150, "21": 188, "22": 188, "23": 93, "24": 186, "25": 160, "26": 202, "27": 238, "28": 150, "29": 186, "30": 26, "31": 243, "32": 44, "33": 11, "34": 22, "35": 222, "36": 252, "37": 57, "38": 222, "39": 27, "40": 19, "41": 148, "42": 52, "43": 176, "44": 250, "45": 217, "46": 141, "47": 144, "48": 140, "49": 212, "50": 245, "51": 201, "52": 208, "53": 72, "54": 194, "55": 30, "56": 142, "57": 193, "58": 240, "59": 161, "60": 61, "61": 54, "62": 53, "63": 14, "64": 27 }
  }
}

const mercadoP2PMoneyTransferExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"headers\":{\"Accept\":\"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7\",\"Accept-Language\":\"en-US,en;q=0.9\",\"Sec-Fetch-Dest\":\"document\",\"Sec-Fetch-Mode\":\"navigate\",\"Sec-Fetch-Site\":\"none\",\"Upgrade-Insecure-Requests\":\"1\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36\",\"device-memory\":\"8\",\"downlink\":\"9.05\",\"dpr\":\"2\",\"ect\":\"4g\",\"rtt\":\"50\",\"sec-ch-ua\":\"\\\"Chromium\\\";v=\\\"134\\\", \\\"Not:A-Brand\\\";v=\\\"24\\\", \\\"Google Chrome\\\";v=\\\"134\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\",\"viewport-width\":\"1066\"},\"method\":\"GET\",\"paramValues\":{\"PAYMENT_ID\":\"p2p_money_transfer-ad80aabb3d28fac6c060a439102295fdf1cf72d1\",\"URL_PARAMS_FROM\":\"mp-home\"},\"responseMatches\":[{\"hash\":true,\"type\":\"regex\",\"value\":\"v2__detail\\\">(.*?)CVU: (?<recipientId>[0-9]+)</li>\"},{\"type\":\"regex\",\"value\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(?<amt>[0-9.]+)</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(?<cents>[0-9]+)</span>\"},{\"type\":\"regex\",\"value\":\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(?<curr>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\",\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\",\\\"sections\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"operationId\\\":(?<paymentId>[^,]+),\\\"activityName\\\":\\\"(?<paymentType>[^\\\"]+)\\\",\\\"activityStatus\\\":\\\"(?<paymentStatus>[^\\\"]+)\\\",\"}],\"responseRedactions\":[{\"jsonPath\":\"\",\"regex\":\"v2__detail\\\">(.*?)CVU: (.*?)</li>\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(.*?)</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(.*?)</span>\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"\\\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(.*?)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\",\\\"date\\\":\\\"(.*)\\\",\\\"sections\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"\\\"operationId\\\":(.*?),\\\"activityName\\\":\\\"(.*?)\\\",\\\"activityStatus\\\":\\\"(.*?),\",\"xPath\":\"\"}],\"url\":\"https://www.mercadopago.com.ar/activities/detail/{{PAYMENT_ID}}?from={{URL_PARAMS_FROM}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1742590582,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4519540906848171844380991692694776058038564615875128315222420248570560176998\",\"extractedParameters\":{\"PAYMENT_ID\":\"p2p_money_transfer-ad80aabb3d28fac6c060a439102295fdf1cf72d1\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"4.000\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-03-21T17:23:52.000Z\",\"paymentId\":\"\\\"105505128951\\\"\",\"paymentStatus\":\"approved\",\"paymentType\":\"p2p_money_transfer\",\"recipientId\":\"0x1896afdf8be7ebf298330be094a5f46967b641841f634f23520f4d919cbc4fa8\"},\"providerHash\":\"0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee\"}",
    "identifier": "0x8a653b2763bbc387b263957560e71bd4d01b1d62e67d947130c4d9c777feebdb",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": { "0": 97, "1": 246, "2": 62, "3": 224, "4": 145, "5": 33, "6": 170, "7": 30, "8": 225, "9": 55, "10": 117, "11": 169, "12": 228, "13": 176, "14": 62, "15": 226, "16": 76, "17": 45, "18": 176, "19": 228, "20": 71, "21": 44, "22": 201, "23": 188, "24": 113, "25": 58, "26": 214, "27": 252, "28": 212, "29": 227, "30": 144, "31": 56, "32": 43, "33": 11, "34": 15, "35": 199, "36": 103, "37": 139, "38": 118, "39": 32, "40": 110, "41": 59, "42": 108, "43": 92, "44": 190, "45": 33, "46": 79, "47": 15, "48": 228, "49": 76, "50": 219, "51": 91, "52": 100, "53": 76, "54": 229, "55": 255, "56": 193, "57": 146, "58": 166, "59": 33, "60": 235, "61": 134, "62": 237, "63": 66, "64": 27 },
    "resultSignature": { "0": 243, "1": 227, "2": 60, "3": 103, "4": 68, "5": 53, "6": 167, "7": 246, "8": 232, "9": 239, "10": 33, "11": 62, "12": 155, "13": 65, "14": 36, "15": 126, "16": 215, "17": 33, "18": 248, "19": 114, "20": 65, "21": 20, "22": 132, "23": 58, "24": 231, "25": 146, "26": 118, "27": 122, "28": 97, "29": 65, "30": 194, "31": 219, "32": 4, "33": 210, "34": 80, "35": 131, "36": 1, "37": 204, "38": 194, "39": 249, "40": 140, "41": 66, "42": 148, "43": 255, "44": 123, "45": 240, "46": 34, "47": 171, "48": 96, "49": 193, "50": 41, "51": 181, "52": 117, "53": 216, "54": 231, "55": 228, "56": 251, "57": 91, "58": 251, "59": 127, "60": 21, "61": 61, "62": 196, "63": 172, "64": 27 }
  }
}

describe("MercadoPagoReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: MercadoPagoReclaimVerifier;
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
    providerHashes = ["0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee"];

    nullifierRegistry = await deployer.deployNullifierRegistry();
    verifier = await deployer.deployMercadoPagoReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.ARS],
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
    let subjectData: BytesLike;

    let paymentTimestamp: number;

    beforeEach(async () => {
      proof = parseExtensionProof(mercadoOnlineTransferExtensionProof);
      subjectProof = encodeProof(proof);

      const paymentTimeString = '2025-03-21T19:54:05.000Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(9);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(.11);     // 9 USDC * .11 ARS / USDC = .99 ARS required payment amount
      subjectPayeeDetailsHash = "0xf5b16d9e4edde5a51d378b8126eaffb65d0d06d0ad21f4d037611f945d3837e8";
      subjectFiatCurrency = Currency.ARS;
      subjectData = ethers.utils.defaultAbiCoder.encode(
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
        data: subjectData
      });
    }

    async function subjectCallStatic(): Promise<[boolean, string, BigNumber]> {
      return await verifier.connect(subjectCaller.wallet).callStatic.verifyPayment({
        paymentProof: subjectProof,
        depositToken: subjectDepositToken,
        intentAmount: subjectIntentAmount,
        intentTimestamp: subjectIntentTimestamp,
        payeeDetails: subjectPayeeDetailsHash,
        fiatCurrency: subjectFiatCurrency,
        conversionRate: subjectConversionRate,
        data: subjectData
      });
    }

    it("should verify the proof", async () => {
      const [
        verified,
        intentHash,
        releaseAmount
      ] = await subjectCallStatic();

      expect(verified).to.be.true;
      expect(intentHash).to.eq(BigNumber.from('4519540906848171844380991692694776058038564615875128315222420248570560176998').toHexString());
      // Payment is 1 ARS, conversion rate is .11, intent amount is 9
      // Release amount = 1 / .11 = 9.0909... but capped at intent amount 9
      expect(releaseAmount).to.eq(usdc(9));
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['105936159704']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is a p2p transfer", async () => {
      beforeEach(async () => {
        proof = parseExtensionProof(mercadoP2PMoneyTransferExtensionProof);
        subjectProof = encodeProof(proof);

        const paymentTimeString = '2025-03-21T17:23:52.000Z';
        const paymentTime = new Date(paymentTimeString);
        paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

        subjectIntentTimestamp = BigNumber.from(paymentTimestamp).sub(ONE_DAY_IN_SECONDS); // 1 day before payment
        subjectPayeeDetailsHash = "0x1896afdf8be7ebf298330be094a5f46967b641841f634f23520f4d919cbc4fa8";
        subjectIntentAmount = usdc(36.36); // 36.36 USDC * 0.11 ARS/USDC = 4.00 ARS
      });

      it("should verify the proof", async () => {
        const [verified, intentHash] = await subjectCallStatic();

        expect(verified).to.be.true;
        expect(intentHash).to.eq(BigNumber.from('4519540906848171844380991692694776058038564615875128315222420248570560176998').toHexString());
      });

      it("should nullify the payment id", async () => {
        await subject();

        const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['\\\"105505128951\\\"']));
        const isNullified = await nullifierRegistry.isNullified(nullifier);

        expect(isNullified).to.be.true;
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
        subjectIntentAmount = usdc(10); // Intent expects 10 * .11 = 1.1 ARS, but actual payment is 1 ARS
        subjectConversionRate = ether(.11);
      });

      it("should succeed with partial payment", async () => {
        const [
          verified,
          intentHash,
          releaseAmount
        ] = await subjectCallStatic();

        expect(verified).to.be.true;
        expect(intentHash).to.eq(BigNumber.from('4519540906848171844380991692694776058038564615875128315222420248570560176998').toHexString());
        // Payment is 1 ARS, conversion rate is .11, intent amount is 10
        // Release amount = 1 / .11 = 9.0909... but capped at intent amount 10
        expect(releaseAmount).to.eq(usdc(1).mul(ether(1)).div(ether(.11)));
      });
    });

    describe("when the payment amount is zero", async () => {
      beforeEach(async () => {
        // Mock a proof with zero payment amount
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4519540906848171844380991692694776058038564615875128315222420248570560176998\",\"extractedParameters\":{\"PAYMENT_ID\":\"online_transfer_movement-40397c71e99fb3afceeed91664536aa631484ceb\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-03-21T19:54:05.000Z\",\"paymentId\":\"105936159704\",\"paymentStatus\":\"approved\",\"paymentType\":\"transfer_online\",\"recipientId\":\"0xf5b16d9e4edde5a51d378b8126eaffb65d0d06d0ad21f4d037611f945d3837e8\"},\"providerHash\":\"0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // Sign the updated claim with witness
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
        subjectPayeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['invalid_recipient']));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\",\"contextMessage\":\"20756922327599730735100651558696756420291259037277175062116341256901210969027\",\"extractedParameters\":{\"URL_PARAMS_1\":\"p2p_money_transfer-c2a624545946e41e5a069f7f652b47251c877fce\",\"URL_PARAMS_GRD\":\"mp-home\",\"amt\":\"420\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-07T12:47:00.000Z\",\"paymentStatus\":\"not-approved\",\"paymentType\":\"p2p_money_transfer\",\"paymetnId\":\"101586128026\",\"recipientId\":\"0000003100016901185863\"},\"providerHash\":\"0x19d7a93c70b8cd149bb6ffc5497b64d62b5073be0f734a16395e938440362ac7\"}"; // changed last char to 7
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof)
        subjectData = ethers.utils.defaultAbiCoder.encode(
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4519540906848171844380991692694776058038564615875128315222420248570560176998\",\"extractedParameters\":{\"PAYMENT_ID\":\"online_transfer_movement-40397c71e99fb3afceeed91664536aa631484ceb\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"1\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-03-21T19:54:05.000Z\",\"paymentId\":\"105936159704\",\"paymentStatus\":\"waiting\",\"paymentType\":\"transfer_online\",\"recipientId\":\"0xf5b16d9e4edde5a51d378b8126eaffb65d0d06d0ad21f4d037611f945d3837e8\"},\"providerHash\":\"0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof)
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid payment status");
      });
    });

    describe("when the payment type is not correct", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4519540906848171844380991692694776058038564615875128315222420248570560176998\",\"extractedParameters\":{\"PAYMENT_ID\":\"online_transfer_movement-40397c71e99fb3afceeed91664536aa631484ceb\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"1\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-03-21T19:54:05.000Z\",\"paymentId\":\"105936159704\",\"paymentStatus\":\"waiting\",\"paymentType\":\"merchant\",\"recipientId\":\"0xf5b16d9e4edde5a51d378b8126eaffb65d0d06d0ad21f4d037611f945d3837e8\"},\"providerHash\":\"0x09ff1db71c6ed6f079954a9cd5539cacf65cd3cf3c76b3c3c33ebfc4e5c0f7ee\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof)
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid payment type");
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