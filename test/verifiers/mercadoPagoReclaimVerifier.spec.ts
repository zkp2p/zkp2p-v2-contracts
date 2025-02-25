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

const mercadoExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"headers\":{\"Accept\":\"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8\",\"Accept-Language\":\"en-GB,en;q=0.7\",\"Sec-Fetch-Dest\":\"document\",\"Sec-Fetch-Mode\":\"navigate\",\"Sec-Fetch-Site\":\"none\",\"Sec-GPC\":\"1\",\"Upgrade-Insecure-Requests\":\"1\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36\",\"sec-ch-ua\":\"\\\"Not(A:Brand\\\";v=\\\"99\\\", \\\"Brave\\\";v=\\\"133\\\", \\\"Chromium\\\";v=\\\"133\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\"},\"method\":\"GET\",\"paramValues\":{\"PAYMENT_ID\":\"p2p_money_transfer-10ebee606478a10491d358b351d66dcbdbed2ea8\",\"URL_PARAMS_FROM\":\"mp-home\"},\"responseMatches\":[{\"hash\":true,\"type\":\"regex\",\"value\":\"v2__detail\\\">CVU: (?<recipientId>[0-9]+)</li>\"},{\"type\":\"regex\",\"value\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(?<amt>[0-9]+)</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(?<cents>[0-9]+)</span>\"},{\"type\":\"regex\",\"value\":\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(?<curr>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\",\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\",\\\"sections\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"operationId\\\":\\\"(?<paymentId>[^\\\"]+)\\\",\\\"activityName\\\":\\\"(?<paymentType>[^\\\"]+)\\\",\\\"activityStatus\\\":\\\"(?<paymentStatus>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"\",\"regex\":\"v2__detail\\\">CVU: (.*?)</li>\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(.*?)</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(.*?)</span>\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"\\\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(.*?)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\",\\\"date\\\":\\\"(.*)\\\",\\\"sections\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"\\\"operationId\\\":\\\"(.*?)\\\",\\\"activityName\\\":\\\"(.*?)\\\",\\\"activityStatus\\\":\\\"(.*?)\\\"\",\"xPath\":\"\"}],\"url\":\"https://www.mercadopago.com.ar/activities/detail/{{PAYMENT_ID}}?from={{URL_PARAMS_FROM}}\",\"writeRedactionMode\":\"zk\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1740414695,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"15355740232191144799068005262739621237810797929149738948331016783112511898998\",\"extractedParameters\":{\"PAYMENT_ID\":\"p2p_money_transfer-10ebee606478a10491d358b351d66dcbdbed2ea8\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"10\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-21T15:14:33.000Z\",\"paymentId\":\"102647815225\",\"paymentStatus\":\"approved\",\"paymentType\":\"p2p_money_transfer\",\"recipientId\":\"0x85b249d77a0dff4052563b8e98764025df7d8fca024614aeab02ead8438bb3e5\"},\"providerHash\":\"0x496c6289b4a6aab1c733d4bc871837266e6096172d92a1870f73c46bd37e2aed\"}",
    "identifier": "0x53e966e38415826e8152727dbb8a537d511724a01a5815dca3ed1b89fb15e23d",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": { "0": 94, "1": 150, "2": 252, "3": 11, "4": 117, "5": 108, "6": 89, "7": 196, "8": 73, "9": 25, "10": 247, "11": 47, "12": 51, "13": 216, "14": 240, "15": 104, "16": 97, "17": 80, "18": 7, "19": 140, "20": 200, "21": 76, "22": 234, "23": 168, "24": 149, "25": 253, "26": 145, "27": 57, "28": 154, "29": 205, "30": 234, "31": 25, "32": 39, "33": 97, "34": 231, "35": 1, "36": 73, "37": 183, "38": 228, "39": 255, "40": 214, "41": 47, "42": 6, "43": 74, "44": 153, "45": 167, "46": 63, "47": 80, "48": 133, "49": 46, "50": 255, "51": 199, "52": 28, "53": 48, "54": 252, "55": 157, "56": 144, "57": 68, "58": 72, "59": 89, "60": 45, "61": 62, "62": 118, "63": 158, "64": 28 },
    "resultSignature": { "0": 2, "1": 147, "2": 179, "3": 22, "4": 181, "5": 231, "6": 79, "7": 163, "8": 60, "9": 74, "10": 114, "11": 130, "12": 159, "13": 210, "14": 199, "15": 159, "16": 90, "17": 246, "18": 67, "19": 20, "20": 31, "21": 47, "22": 201, "23": 248, "24": 46, "25": 32, "26": 81, "27": 24, "28": 223, "29": 195, "30": 177, "31": 55, "32": 50, "33": 44, "34": 64, "35": 44, "36": 205, "37": 139, "38": 158, "39": 69, "40": 115, "41": 239, "42": 112, "43": 13, "44": 185, "45": 252, "46": 213, "47": 183, "48": 26, "49": 216, "50": 204, "51": 67, "52": 33, "53": 235, "54": 139, "55": 17, "56": 76, "57": 3, "58": 140, "59": 105, "60": 188, "61": 231, "62": 148, "63": 168, "64": 28 }
  }
}

const mercadoAppclipProof = {
  "identifier": "0x7bbc9ac279ca19ec0ff564d0e58b89548751b8a4cd2e0848001f0cd76ddab1cd",
  "claimData": {
    "provider": "http",
    "parameters": "{\"additionalClientOptions\":{},\"body\":\"\",\"geoLocation\":\"\",\"headers\":{\"Sec-Fetch-Mode\":\"same-origin\",\"Sec-Fetch-Site\":\"same-origin\",\"User-Agent\":\"Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1\"},\"method\":\"GET\",\"paramValues\":{\"URL_PARAMS_1\":\"p2p_money_transfer-10ebee606478a10491d358b351d66dcbdbed2ea8\",\"URL_PARAMS_GRD\":\"mp-home\",\"amt\":\"10\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-21T15:14:33.000Z\",\"paymentId\":\"102647815225\",\"paymentStatus\":\"approved\",\"paymentType\":\"p2p_money_transfer\",\"recipientId\":\"0000003100064367123868\"},\"responseMatches\":[{\"invert\":false,\"type\":\"contains\",\"value\":\"v2__detail\\\">CVU: {{recipientId}}</li>\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">{{amt}}</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">{{cents}}</span>\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"{{curr}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\",\\\"date\\\":\\\"{{date}}\\\",\\\"sections\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"operationId\\\":\\\"{{paymentId}}\\\",\\\"activityName\\\":\\\"{{paymentType}}\\\",\\\"activityStatus\\\":\\\"{{paymentStatus}}\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"\",\"regex\":\"v2__detail\\\">CVU: (.*?)</li>\",\"xPath\":\"\"},{\"jsonPath\":null,\"regex\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(.*?)<\\\\/span><span aria-hidden=\\\"true\\\">,<\\\\/span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(.*?)<\\\\/span>\",\"xPath\":null},{\"jsonPath\":null,\"regex\":\"\\\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(.*?)\\\"\",\"xPath\":null},{\"jsonPath\":null,\"regex\":\",\\\"date\\\":\\\"(.*)\\\",\\\"sections\\\"\",\"xPath\":null},{\"jsonPath\":null,\"regex\":\"\\\"operationId\\\":\\\"(.*?)\\\",\\\"activityName\\\":\\\"(.*?)\\\",\\\"activityStatus\\\":\\\"(.*?)\\\"\",\"xPath\":null}],\"url\":\"https://www.mercadopago.com.ar/activities/detail/{{URL_PARAMS_1}}?from={{URL_PARAMS_GRD}}\"}",
    "owner": "0x26a6a591e79956709e16bead9ae6611af8f90c8d",
    "timestampS": 1740487503,
    "context": "{\"contextAddress\":\"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\",\"contextMessage\":\"5895292931244051742827375464284278318044186881104300559696598457894942240722\",\"extractedParameters\":{\"URL_PARAMS_1\":\"p2p_money_transfer-10ebee606478a10491d358b351d66dcbdbed2ea8\",\"URL_PARAMS_GRD\":\"mp-home\",\"amt\":\"10\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-21T15:14:33.000Z\",\"paymentId\":\"102647815225\",\"paymentStatus\":\"approved\",\"paymentType\":\"p2p_money_transfer\",\"recipientId\":\"0000003100064367123868\"},\"providerHash\":\"0xb7dcbcc5b413ad040ee9d02eafb9794e6472647b8e50247813fa2d3392727203\"}",
    "identifier": "0x7bbc9ac279ca19ec0ff564d0e58b89548751b8a4cd2e0848001f0cd76ddab1cd",
    "epoch": 1
  },
  "signatures": [
    "0xd9d2b8aac3cab87b9c441d99feb84449a82462e5d84f284aa4d3f19371d42cd86bfb524b61de4f85c4706a15adc8176bb287f0b1f05c60e57d9e8037a42a3b2f1b"
  ],
  "witnesses": [
    {
      "id": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
      "url": "wss://attestor.reclaimprotocol.org/ws"
    }
  ],
  "publicData": null
}


describe.only("MercadoPagoReclaimVerifier", () => {
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
    providerHashes = ["0x496c6289b4a6aab1c733d4bc871837266e6096172d92a1870f73c46bd37e2aed", "0xb7dcbcc5b413ad040ee9d02eafb9794e6472647b8e50247813fa2d3392727203"];

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
      proof = parseExtensionProof(mercadoExtensionProof);
      subjectProof = encodeProof(proof);

      const paymentTimeString = '2025-02-21T15:14:33.000Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(9);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(1.1);     // 9 USDC * 1.1 ARS / USDC = 9.9 ARS required payment amount
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['0000003100064367123868'])
      );
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

    async function subjectCallStatic(): Promise<[boolean, string]> {
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
        intentHash
      ] = await subjectCallStatic();

      expect(verified).to.be.true;
      expect(intentHash).to.eq(BigNumber.from('15355740232191144799068005262739621237810797929149738948331016783112511898998').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['102647815225']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is an appclip proof", async () => {
      beforeEach(async () => {
        proof = parseAppclipProof(mercadoAppclipProof);
        subjectProof = encodeProof(proof);

        subjectPayeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['0000003100064367123868']));
      });

      it("should verify the proof", async () => {
        const [
          verified,
          intentHash
        ] = await subjectCallStatic();

        expect(verified).to.be.true;
        expect(intentHash).to.eq(BigNumber.from('5895292931244051742827375464284278318044186881104300559696598457894942240722').toHexString());
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

    describe("when the payment amount is less than the intent amount * conversion rate", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(9.1);   // just 1 cent more than the actual ask amount (9.1 * 1.1 = 10.01) which is greater than the payment amount (10)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });

      describe("when the payment amount is more than the intent amount * conversion rate", async () => {
        beforeEach(async () => {
          subjectIntentAmount = usdc(9.09);   // just 1 cent less than the actual ask amount (9.09 * 1.1 = 10) which is less than the payment amount (10)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
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

      describe("when the proof is an appclip proof", async () => {
        beforeEach(async () => {
          proof = parseAppclipProof(mercadoAppclipProof);
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\",\"contextMessage\":\"20756922327599730735100651558696756420291259037277175062116341256901210969027\",\"extractedParameters\":{\"URL_PARAMS_1\":\"p2p_money_transfer-c2a624545946e41e5a069f7f652b47251c877fce\",\"URL_PARAMS_GRD\":\"mp-home\",\"amt\":\"420\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-07T12:47:00.000Z\",\"paymentStatus\":\"not-approved\",\"paymentType\":\"p2p_money_transfer\",\"paymetnId\":\"101586128026\",\"recipientId\":\"0000003100016901185863\"},\"providerHash\":\"0x7b7114ae280564c2b832837ddeb836001d813ba3572325497fe87a1ad59ab547\"}"; // changed last char to 7
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"15355740232191144799068005262739621237810797929149738948331016783112511898998\",\"extractedParameters\":{\"PAYMENT_ID\":\"p2p_money_transfer-10ebee606478a10491d358b351d66dcbdbed2ea8\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"10\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-21T15:14:33.000Z\",\"paymentId\":\"102647815225\",\"paymentStatus\":\"waiting\",\"paymentType\":\"p2p_money_transfer\",\"recipientId\":\"0x85b249d77a0dff4052563b8e98764025df7d8fca024614aeab02ead8438bb3e5\"},\"providerHash\":\"0x496c6289b4a6aab1c733d4bc871837266e6096172d92a1870f73c46bd37e2aed\"}";
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"15355740232191144799068005262739621237810797929149738948331016783112511898998\",\"extractedParameters\":{\"PAYMENT_ID\":\"p2p_money_transfer-10ebee606478a10491d358b351d66dcbdbed2ea8\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"10\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-21T15:14:33.000Z\",\"paymentId\":\"102647815225\",\"paymentStatus\":\"approved\",\"paymentType\":\"p2m_money_transfer\",\"recipientId\":\"0x85b249d77a0dff4052563b8e98764025df7d8fca024614aeab02ead8438bb3e5\"},\"providerHash\":\"0x496c6289b4a6aab1c733d4bc871837266e6096172d92a1870f73c46bd37e2aed\"}";
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