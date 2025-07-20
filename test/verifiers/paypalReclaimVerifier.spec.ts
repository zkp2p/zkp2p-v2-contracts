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
    "parameters": "{\"body\":\"\",\"headers\":{\"Accept\":\"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7\",\"Accept-Language\":\"en-US,en;q=0.9\",\"Sec-Fetch-Dest\":\"document\",\"Sec-Fetch-Mode\":\"navigate\",\"Sec-Fetch-Site\":\"none\",\"Upgrade-Insecure-Requests\":\"1\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36\",\"sec-ch-ua\":\"\\\"Not)A;Brand\\\";v=\\\"8\\\", \\\"Chromium\\\";v=\\\"138\\\", \\\"Google Chrome\\\";v=\\\"138\\\"\",\"sec-ch-ua-arch\":\"\\\"arm\\\"\",\"sec-ch-ua-bitness\":\"\\\"64\\\"\",\"sec-ch-ua-full-version\":\"\\\"138.0.7204.93\\\"\",\"sec-ch-ua-full-version-list\":\"\\\"Not)A;Brand\\\";v=\\\"8.0.0.0\\\", \\\"Chromium\\\";v=\\\"138.0.7204.93\\\", \\\"Google Chrome\\\";v=\\\"138.0.7204.93\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-model\":\"\\\"\\\"\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\",\"sec-ch-ua-platform-version\":\"\\\"15.5.0\\\"\",\"sec-ch-ua-wow64\":\"?0\"},\"method\":\"GET\",\"paramValues\":{\"PAYMENT_ID\":\"8E565397UR371635Y\"},\"responseMatches\":[{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"email\\\":\\\"(?<email>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"isPersonal\\\":true\"},{\"type\":\"regex\",\"value\":\"\\\"value\\\":\\\"(?<value>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"currencyCode\\\":\\\"(?<currencyCode>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"status\\\":\\\"(?<status>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"primitiveTimeCreated\\\":\\\"(?<primitiveTimeCreated>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.data.p2pRedirect.repeatTxn.email\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.p2pRedirect.repeatTxn.isPersonal\"},{\"jsonPath\":\"$.data.amount.rawAmounts.gross.value\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.amount.rawAmounts.gross.currencyCode\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.status\",\"xPath\":\"\"},{\"jsonPath\":\"$.data.primitiveTimeCreated\",\"xPath\":\"\"}],\"url\":\"https://www.paypal.com/myaccount/activities/details/inline/{{PAYMENT_ID}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1752859972,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"18114168264614898234767045087100892814911930784849242636571146569793237988689\",\"extractedParameters\":{\"PAYMENT_ID\":\"8E565397UR371635Y\",\"currencyCode\":\"USD\",\"email\":\"0xa6ffcc4157012625a0ed3a0caf95f22244eeda1071b9cb5b87ddb40648388e84\",\"primitiveTimeCreated\":\"2025-07-18T16:09:39Z\",\"status\":\"COMPLETED\",\"value\":\"0.1\"},\"providerHash\":\"0x14d1dc7bcbacd85b21c65a60eddeda012fd9697c84e00982c14c0d4dc592c500\"}",
    "identifier": "0xd3398c0a51c5812c2eff85ec8b5ddeed28cdf43d8a51641c58f66e1c0b804e1f",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": {
      "0": 126,
      "1": 129,
      "2": 227,
      "3": 116,
      "4": 184,
      "5": 147,
      "6": 59,
      "7": 245,
      "8": 52,
      "9": 150,
      "10": 93,
      "11": 51,
      "12": 131,
      "13": 36,
      "14": 170,
      "15": 141,
      "16": 108,
      "17": 21,
      "18": 153,
      "19": 94,
      "20": 95,
      "21": 69,
      "22": 42,
      "23": 129,
      "24": 204,
      "25": 77,
      "26": 109,
      "27": 158,
      "28": 141,
      "29": 251,
      "30": 110,
      "31": 2,
      "32": 23,
      "33": 197,
      "34": 95,
      "35": 84,
      "36": 224,
      "37": 99,
      "38": 19,
      "39": 34,
      "40": 39,
      "41": 139,
      "42": 215,
      "43": 156,
      "44": 83,
      "45": 210,
      "46": 14,
      "47": 172,
      "48": 95,
      "49": 174,
      "50": 182,
      "51": 130,
      "52": 199,
      "53": 120,
      "54": 221,
      "55": 42,
      "56": 237,
      "57": 176,
      "58": 155,
      "59": 237,
      "60": 66,
      "61": 82,
      "62": 213,
      "63": 206,
      "64": 28
    },
    "resultSignature": {
      "0": 216,
      "1": 130,
      "2": 208,
      "3": 161,
      "4": 134,
      "5": 99,
      "6": 69,
      "7": 45,
      "8": 170,
      "9": 178,
      "10": 86,
      "11": 160,
      "12": 190,
      "13": 83,
      "14": 164,
      "15": 187,
      "16": 33,
      "17": 235,
      "18": 209,
      "19": 8,
      "20": 27,
      "21": 124,
      "22": 9,
      "23": 193,
      "24": 46,
      "25": 96,
      "26": 216,
      "27": 17,
      "28": 4,
      "29": 27,
      "30": 123,
      "31": 228,
      "32": 44,
      "33": 15,
      "34": 99,
      "35": 113,
      "36": 227,
      "37": 249,
      "38": 250,
      "39": 134,
      "40": 37,
      "41": 33,
      "42": 95,
      "43": 144,
      "44": 18,
      "45": 85,
      "46": 11,
      "47": 194,
      "48": 212,
      "49": 200,
      "50": 118,
      "51": 254,
      "52": 188,
      "53": 62,
      "54": 61,
      "55": 118,
      "56": 203,
      "57": 167,
      "58": 58,
      "59": 161,
      "60": 153,
      "61": 25,
      "62": 96,
      "63": 84,
      "64": 28
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
    providerHashes = ["0x14d1dc7bcbacd85b21c65a60eddeda012fd9697c84e00982c14c0d4dc592c500"];

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

      const paymentTimeString = '2025-07-18T16:09:39Z';
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(0.11);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(0.909);   // 0.11 * 0.909 = 0.09999 < 0.1 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = "0xa6ffcc4157012625a0ed3a0caf95f22244eeda1071b9cb5b87ddb40648388e84";
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
      expect(intentHash).to.eq(BigNumber.from('18114168264614898234767045087100892814911930784849242636571146569793237988689').toHexString());
    });

    it.skip("should nullify the payment id", async () => {
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

    describe.skip("when the proof has already been verified", async () => {
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"18114168264614898234767045087100892814911930784849242636571146569793237988689\",\"extractedParameters\":{\"PAYMENT_ID\":\"8E565397UR371635Y\",\"currencyCode\":\"USD\",\"email\":\"0xa6ffcc4157012625a0ed3a0caf95f22244eeda1071b9cb5b87ddb40648388e84\",\"primitiveTimeCreated\":\"2025-07-18T16:09:39Z\",\"status\":\"REVERTED\",\"value\":\"0.1\"},\"providerHash\":\"0x14d1dc7bcbacd85b21c65a60eddeda012fd9697c84e00982c14c0d4dc592c500\"}";
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