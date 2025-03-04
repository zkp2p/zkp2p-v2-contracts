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
    "parameters": "{\"body\":\"\",\"headers\":{\"Accept\":\"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7\",\"Accept-Language\":\"en-US,en;q=0.9\",\"Referer\":\"https://www.mercadopago.com.ar/home\",\"Sec-Fetch-Dest\":\"document\",\"Sec-Fetch-Mode\":\"navigate\",\"Sec-Fetch-Site\":\"same-origin\",\"Upgrade-Insecure-Requests\":\"1\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36\",\"device-memory\":\"8\",\"downlink\":\"10\",\"dpr\":\"2\",\"ect\":\"4g\",\"rtt\":\"50\",\"sec-ch-ua\":\"\\\"Not(A:Brand\\\";v=\\\"99\\\", \\\"Google Chrome\\\";v=\\\"133\\\", \\\"Chromium\\\";v=\\\"133\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\",\"viewport-width\":\"1920\"},\"method\":\"GET\",\"paramValues\":{\"PAYMENT_ID\":\"p2p_money_transfer-995185a8e2cb0d1fd6f48f75c933083f58124710\",\"URL_PARAMS_FROM\":\"mp-home\"},\"responseMatches\":[{\"hash\":true,\"type\":\"regex\",\"value\":\"v2__detail\\\">CVU: (?<recipientId>[0-9]+)</li>\"},{\"type\":\"regex\",\"value\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(?<amt>[0-9.]+)</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(?<cents>[0-9]+)</span>\"},{\"type\":\"regex\",\"value\":\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(?<curr>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\",\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\",\\\"sections\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"operationId\\\":\\\"(?<paymentId>[^\\\"]+)\\\",\\\"activityName\\\":\\\"(?<paymentType>[^\\\"]+)\\\",\\\"activityStatus\\\":\\\"(?<paymentStatus>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"\",\"regex\":\"v2__detail\\\">CVU: (.*?)</li>\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(.*?)</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(.*?)</span>\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"\\\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(.*?)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\",\\\"date\\\":\\\"(.*)\\\",\\\"sections\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"\",\"regex\":\"\\\"operationId\\\":\\\"(.*?)\\\",\\\"activityName\\\":\\\"(.*?)\\\",\\\"activityStatus\\\":\\\"(.*?)\\\"\",\"xPath\":\"\"}],\"url\":\"https://www.mercadopago.com.ar/activities/detail/{{PAYMENT_ID}}?from={{URL_PARAMS_FROM}}\",\"writeRedactionMode\":\"zk\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1741104719,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"17914824782184704142586572377764177970970014014591995865317850920302169493308\",\"extractedParameters\":{\"PAYMENT_ID\":\"p2p_money_transfer-995185a8e2cb0d1fd6f48f75c933083f58124710\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"1.000\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-03-04T16:08:48.000Z\",\"paymentId\":\"103689145047\",\"paymentStatus\":\"approved\",\"paymentType\":\"p2p_money_transfer\",\"recipientId\":\"0x85b249d77a0dff4052563b8e98764025df7d8fca024614aeab02ead8438bb3e5\"},\"providerHash\":\"0x19d7a93c70b8cd149bb6ffc5497b64d62b5073be0f734a16395e938440362ac6\"}",
    "identifier": "0xccefde4d339be1980555d99b45f16a32af41e1e6330d3af47e290806e5889abc",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": {"0":205,"1":71,"2":182,"3":32,"4":143,"5":46,"6":148,"7":99,"8":133,"9":249,"10":90,"11":57,"12":74,"13":217,"14":248,"15":162,"16":249,"17":224,"18":207,"19":214,"20":186,"21":56,"22":242,"23":34,"24":82,"25":107,"26":224,"27":92,"28":168,"29":173,"30":22,"31":189,"32":1,"33":77,"34":123,"35":38,"36":176,"37":195,"38":233,"39":79,"40":7,"41":115,"42":153,"43":248,"44":180,"45":63,"46":172,"47":116,"48":228,"49":197,"50":200,"51":1,"52":113,"53":130,"54":1,"55":67,"56":28,"57":87,"58":51,"59":5,"60":65,"61":38,"62":167,"63":146,"64":27},
    "resultSignature": {"0":241,"1":90,"2":218,"3":54,"4":32,"5":7,"6":159,"7":94,"8":237,"9":80,"10":113,"11":125,"12":209,"13":189,"14":219,"15":32,"16":251,"17":127,"18":210,"19":66,"20":63,"21":96,"22":145,"23":19,"24":16,"25":27,"26":184,"27":25,"28":168,"29":31,"30":208,"31":213,"32":78,"33":53,"34":108,"35":232,"36":174,"37":241,"38":58,"39":31,"40":195,"41":200,"42":99,"43":164,"44":157,"45":121,"46":95,"47":47,"48":98,"49":108,"50":99,"51":202,"52":66,"53":220,"54":114,"55":103,"56":127,"57":157,"58":15,"59":180,"60":99,"61":48,"62":251,"63":54,"64":27}
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
    providerHashes = ["0x19d7a93c70b8cd149bb6ffc5497b64d62b5073be0f734a16395e938440362ac6"];

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

      const paymentTimeString = '2025-03-04T16:08:48.000Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(9);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(110);     // 9 USDC * 110 ARS / USDC = 990 ARS required payment amount
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
      expect(intentHash).to.eq(BigNumber.from('17914824782184704142586572377764177970970014014591995865317850920302169493308').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['103689145047']));
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

    describe("when the payment amount is less than the intent amount * conversion rate", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(9.1);   // just 1 cent more than the actual ask amount (9.1 * 110 = 1001) which is greater than the payment amount (1000)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });

      describe("when the payment amount is more than the intent amount * conversion rate", async () => {
        beforeEach(async () => {
          subjectIntentAmount = usdc(9.09);   // just 1 cent less than the actual ask amount (9.09 * 110 = 1000) which is less than the payment amount (1000)
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"17914824782184704142586572377764177970970014014591995865317850920302169493308\",\"extractedParameters\":{\"PAYMENT_ID\":\"p2p_money_transfer-995185a8e2cb0d1fd6f48f75c933083f58124710\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"1.000\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-03-04T16:08:48.000Z\",\"paymentId\":\"103689145047\",\"paymentStatus\":\"waiting\",\"paymentType\":\"p2p_money_transfer\",\"recipientId\":\"0x85b249d77a0dff4052563b8e98764025df7d8fca024614aeab02ead8438bb3e5\"},\"providerHash\":\"0x19d7a93c70b8cd149bb6ffc5497b64d62b5073be0f734a16395e938440362ac6\"}";
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"17914824782184704142586572377764177970970014014591995865317850920302169493308\",\"extractedParameters\":{\"PAYMENT_ID\":\"p2p_money_transfer-995185a8e2cb0d1fd6f48f75c933083f58124710\",\"URL_PARAMS_FROM\":\"mp-home\",\"amt\":\"1.000\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-03-04T16:08:48.000Z\",\"paymentId\":\"103689145047\",\"paymentStatus\":\"approved\",\"paymentType\":\"p2m_money_transfer\",\"recipientId\":\"0x85b249d77a0dff4052563b8e98764025df7d8fca024614aeab02ead8438bb3e5\"},\"providerHash\":\"0x19d7a93c70b8cd149bb6ffc5497b64d62b5073be0f734a16395e938440362ac6\"}";
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