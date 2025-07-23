import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, PaypalReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, encodeProof, parseExtensionProof } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const paypalExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"headers\":{\"Accept\":\"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8\",\"Accept-Language\":\"en-GB,en;q=0.9\",\"Sec-Fetch-Dest\":\"document\",\"Sec-Fetch-Mode\":\"navigate\",\"Sec-Fetch-Site\":\"none\",\"Sec-GPC\":\"1\",\"Upgrade-Insecure-Requests\":\"1\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36\",\"sec-ch-ua\":\"\\\"Not)A;Brand\\\";v=\\\"8\\\", \\\"Chromium\\\";v=\\\"138\\\", \\\"Brave\\\";v=\\\"138\\\"\",\"sec-ch-ua-arch\":\"\\\"arm\\\"\",\"sec-ch-ua-bitness\":\"\\\"64\\\"\",\"sec-ch-ua-full-version-list\":\"\\\"Not)A;Brand\\\";v=\\\"8.0.0.0\\\", \\\"Chromium\\\";v=\\\"138.0.0.0\\\", \\\"Brave\\\";v=\\\"138.0.0.0\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-model\":\"\\\"\\\"\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\",\"sec-ch-ua-platform-version\":\"\\\"15.5.0\\\"\",\"sec-ch-ua-wow64\":\"?0\"},\"method\":\"GET\",\"paramValues\":{\"PAYMENT_ID\":\"25R77433N2369391C\"},\"responseMatches\":[{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"email\\\":\\\"(?<recvId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"isPersonal\\\":true\"},{\"type\":\"regex\",\"value\":\"\\\"value\\\":\\\"(?<amt>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"currencyCode\\\":\\\"(?<curr>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"status\\\":\\\"(?<status>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"primitiveTimeCreated\\\":\\\"(?<date>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.data.p2pRedirect.repeatTxn.email\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.p2pRedirect.repeatTxn.isPersonal\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.amount.rawAmounts.gross.value\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.amount.rawAmounts.gross.currencyCode\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.status\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.primitiveTimeCreated\",\"xPath\":\"\"}],\"url\":\"https://www.paypal.com/myaccount/activities/details/inline/{{PAYMENT_ID}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1753208266,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"14823957640193322997538336481928070393462453653955747677674582946934891004821\",\"extractedParameters\":{\"PAYMENT_ID\":\"25R77433N2369391C\",\"amt\":\"0.1\",\"curr\":\"USD\",\"date\":\"2025-07-22T16:08:52Z\",\"recvId\":\"0x4daf24e93e0a232dddf1113775290ae56eb982c56e79246856d06fc2c7e4ffe9\",\"status\":\"COMPLETED\"},\"providerHash\":\"0xad3ca6816c2dd7c513c56fac139834813ed4a72d0202ca4f650a0da21987f07d\"}",
    "identifier": "0x790516dce937ad7dc44e4a6664bc8a60c1fc97d36703e49e20b877c206fb33ee",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": {
      "0": 43,
      "1": 141,
      "2": 135,
      "3": 46,
      "4": 75,
      "5": 36,
      "6": 161,
      "7": 242,
      "8": 155,
      "9": 48,
      "10": 175,
      "11": 29,
      "12": 172,
      "13": 6,
      "14": 222,
      "15": 64,
      "16": 97,
      "17": 106,
      "18": 199,
      "19": 172,
      "20": 113,
      "21": 186,
      "22": 248,
      "23": 27,
      "24": 228,
      "25": 95,
      "26": 207,
      "27": 114,
      "28": 201,
      "29": 143,
      "30": 109,
      "31": 82,
      "32": 46,
      "33": 240,
      "34": 218,
      "35": 82,
      "36": 32,
      "37": 106,
      "38": 113,
      "39": 253,
      "40": 234,
      "41": 124,
      "42": 201,
      "43": 175,
      "44": 241,
      "45": 250,
      "46": 69,
      "47": 92,
      "48": 136,
      "49": 137,
      "50": 75,
      "51": 238,
      "52": 51,
      "53": 140,
      "54": 213,
      "55": 107,
      "56": 176,
      "57": 124,
      "58": 171,
      "59": 170,
      "60": 235,
      "61": 181,
      "62": 44,
      "63": 142,
      "64": 27
    },
    "resultSignature": {
      "0": 146,
      "1": 224,
      "2": 165,
      "3": 129,
      "4": 196,
      "5": 127,
      "6": 23,
      "7": 159,
      "8": 150,
      "9": 234,
      "10": 206,
      "11": 77,
      "12": 126,
      "13": 135,
      "14": 110,
      "15": 16,
      "16": 217,
      "17": 45,
      "18": 173,
      "19": 149,
      "20": 188,
      "21": 221,
      "22": 145,
      "23": 205,
      "24": 160,
      "25": 238,
      "26": 93,
      "27": 85,
      "28": 70,
      "29": 8,
      "30": 132,
      "31": 55,
      "32": 51,
      "33": 255,
      "34": 46,
      "35": 16,
      "36": 25,
      "37": 109,
      "38": 54,
      "39": 232,
      "40": 212,
      "41": 48,
      "42": 87,
      "43": 57,
      "44": 15,
      "45": 243,
      "46": 128,
      "47": 25,
      "48": 172,
      "49": 158,
      "50": 182,
      "51": 179,
      "52": 34,
      "53": 216,
      "54": 87,
      "55": 24,
      "56": 151,
      "57": 232,
      "58": 103,
      "59": 211,
      "60": 142,
      "61": 15,
      "62": 248,
      "63": 65,
      "64": 27
    }
  }
}


describe("PaypalReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: PaypalReclaimVerifier;
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

    witnesses = ["0x0636c417755e3ae25c6c166d181c0607f4c572a3"];
    providerHashes = ["0xad3ca6816c2dd7c513c56fac139834813ed4a72d0202ca4f650a0da21987f07d"];

    nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployPaypalReclaimVerifier(
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
    let subjectData: BytesLike;

    let paymentTimestamp: number;

    beforeEach(async () => {
      proof = parseExtensionProof(paypalExtensionProof);
      subjectProof = encodeProof(proof);

      const paymentTimeString = '2025-07-22T16:08:52Z';
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(0.11);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(0.909);   // 0.11 * 0.909 = 0.09999 < 0.1 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = "0x4daf24e93e0a232dddf1113775290ae56eb982c56e79246856d06fc2c7e4ffe9";
      subjectFiatCurrency = Currency.USD;
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
      expect(intentHash).to.eq(BigNumber.from('14823957640193322997538336481928070393462453653955747677674582946934891004821').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['8E565397UR371635Y']));
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
        subjectIntentAmount = usdc(0.12);  // 0.12 * 0.909 = 0.10908 > 0.1
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
    });

    describe("when the proof has already been verified", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Nullifier has already been used");
      });
    });

    describe("when the currency is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.EUR;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment currency");
      });
    });

    describe("when the provider hash is invalid", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"18114168264614898234767045087100892814911930784849242636571146569793237988689\",\"extractedParameters\":{\"PAYMENT_ID\":\"8E565397UR371635Y\",\"currencyCode\":\"USD\",\"email\":\"0xa6ffcc4157012625a0ed3a0caf95f22244eeda1071b9cb5b87ddb40648388e84\",\"primitiveTimeCreated\":\"2025-07-18T16:09:39Z\",\"status\":\"OUTGOING_PAYMENT_SENT\",\"value\":\"0.1\"},\"providerHash\":\"0x14d1dc7bcbacd85b21c65a60eddeda012fd9697c84e00982c14c0d4dc592c501\"}";
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

    describe("when the payment status is not correct", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"14823957640193322997538336481928070393462453653955747677674582946934891004821\",\"extractedParameters\":{\"PAYMENT_ID\":\"25R77433N2369391C\",\"amt\":\"0.1\",\"curr\":\"USD\",\"date\":\"2025-07-22T16:08:52Z\",\"recvId\":\"0x4daf24e93e0a232dddf1113775290ae56eb982c56e79246856d06fc2c7e4ffe9\",\"status\":\"REVERTED\"},\"providerHash\":\"0xad3ca6816c2dd7c513c56fac139834813ed4a72d0202ca4f650a0da21987f07d\"}";
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