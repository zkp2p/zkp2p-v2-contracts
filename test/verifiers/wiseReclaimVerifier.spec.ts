import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, WiseReclaimVerifier, USDCMock } from "@utils/contracts";
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

const wiseExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"id\\\":(?<paymentId>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"paymentStatus\\\":\\\"(?<paymentStatus>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"recipient\\\":\\\\{\\\"id\\\":(?<recipientId>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"targetCurrency\\\":\\\"(?<targetCurrency>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"targetValue\\\":(?<targetValue>[0-9\\\\.]+)\"},{\"type\":\"regex\",\"value\":\"\\\"transferredDate\\\":\\\"(?<transferredDate>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.id\",\"xPath\":\"\"},{\"jsonPath\":\"$.paymentStatus\",\"xPath\":\"\"},{\"jsonPath\":\"$.recipient\",\"xPath\":\"\"},{\"jsonPath\":\"$.targetCurrency\",\"xPath\":\"\"},{\"jsonPath\":\"$.targetValue\",\"xPath\":\"\"},{\"jsonPath\":\"$.transferredDate\",\"xPath\":\"\"}],\"url\":\"https://wise.com/api/v3/payment/details?paymentId=1038880090&simplifiedResult=0\",\"writeRedactionMode\":\"zk\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1737279699,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4080818544341039229495851033825904336592969679461569916639133799093374442763\",\"extractedParameters\":{\"paymentId\":\"1038880090\",\"paymentStatus\":\"transferred\",\"recipientId\":\"0xcacce013709154334af512b92ad6e65438a3195ad985cf17050b871a6933fce4\",\"targetCurrency\":\"EUR\",\"targetValue\":\"1.25\",\"transferredDate\":\"2024-04-17 22:34:06\"},\"providerHash\":\"0xc6cbb4dd0cb8f09201d2e05d17b2223bea494178172d6111d6bebc6102de8332\"}",
    "identifier": "0x6afc4ec0447264f813e98b684eeb40f3a9057a3b581472fe5a67095dfde97783",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "claimSignature": {
      "0": 182,
      "1": 11,
      "2": 110,
      "3": 194,
      "4": 73,
      "5": 200,
      "6": 156,
      "7": 68,
      "8": 69,
      "9": 251,
      "10": 158,
      "11": 124,
      "12": 75,
      "13": 172,
      "14": 72,
      "15": 207,
      "16": 35,
      "17": 153,
      "18": 210,
      "19": 162,
      "20": 222,
      "21": 75,
      "22": 35,
      "23": 233,
      "24": 118,
      "25": 88,
      "26": 77,
      "27": 41,
      "28": 42,
      "29": 145,
      "30": 237,
      "31": 218,
      "32": 33,
      "33": 11,
      "34": 54,
      "35": 43,
      "36": 87,
      "37": 187,
      "38": 212,
      "39": 115,
      "40": 225,
      "41": 52,
      "42": 91,
      "43": 201,
      "44": 246,
      "45": 113,
      "46": 85,
      "47": 208,
      "48": 45,
      "49": 38,
      "50": 67,
      "51": 34,
      "52": 147,
      "53": 204,
      "54": 177,
      "55": 231,
      "56": 218,
      "57": 92,
      "58": 25,
      "59": 17,
      "60": 55,
      "61": 85,
      "62": 88,
      "63": 68,
      "64": 27
    },
    "resultSignature": {
      "0": 71,
      "1": 42,
      "2": 159,
      "3": 100,
      "4": 182,
      "5": 46,
      "6": 129,
      "7": 38,
      "8": 254,
      "9": 117,
      "10": 185,
      "11": 74,
      "12": 8,
      "13": 11,
      "14": 189,
      "15": 1,
      "16": 149,
      "17": 24,
      "18": 157,
      "19": 223,
      "20": 192,
      "21": 152,
      "22": 46,
      "23": 192,
      "24": 172,
      "25": 32,
      "26": 201,
      "27": 40,
      "28": 72,
      "29": 237,
      "30": 237,
      "31": 75,
      "32": 61,
      "33": 217,
      "34": 115,
      "35": 205,
      "36": 61,
      "37": 78,
      "38": 148,
      "39": 68,
      "40": 210,
      "41": 5,
      "42": 87,
      "43": 110,
      "44": 233,
      "45": 160,
      "46": 242,
      "47": 199,
      "48": 191,
      "49": 155,
      "50": 18,
      "51": 103,
      "52": 59,
      "53": 37,
      "54": 44,
      "55": 2,
      "56": 93,
      "57": 69,
      "58": 47,
      "59": 10,
      "60": 114,
      "61": 240,
      "62": 159,
      "63": 36,
      "64": 28
    }
  }
}

const wiseAppclipProof = {}

describe.only("WiseReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: WiseReclaimVerifier;
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
    providerHashes = ["0xc6cbb4dd0cb8f09201d2e05d17b2223bea494178172d6111d6bebc6102de8332"];

    nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployWiseReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.EUR],
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
      proof = parseExtensionProof(wiseExtensionProof);
      subjectProof = encodeProof(proof);

      const paymentTimeString = '2024-04-17 22:34:06Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1.1);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(1.13);   // 1.1 * 1.13 = 1.243 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['403384647'])
      );
      subjectFiatCurrency = Currency.EUR;
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
      expect(intentHash).to.eq(BigNumber.from('4080818544341039229495851033825904336592969679461569916639133799093374442763').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['1038880090']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    // describe.skip("when the proof is an appclip proof", async () => {
    //   beforeEach(async () => {
    //     proof = parseAppclipProof(wiseAppclipProof);
    //     subjectProof = encodeProof(proof);

    //     subjectPayeeDetailsHash = ethers.utils.keccak256(
    //       ethers.utils.solidityPack(['string'], ['645716473020416186'])
    //     );
    //   });

    //   it("should verify the proof", async () => {
    //     const [
    //       verified,
    //       intentHash
    //     ] = await subjectCallStatic();

    //     expect(verified).to.be.true;
    //     expect(intentHash).to.eq(BigNumber.from('19647628387338148605484475718635527316117450420056269639082394264683709644449').toHexString());
    //   });
    // });

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
        subjectIntentAmount = usdc(1.11);   // just 1 cent more than the actual ask amount (1.11 * 1.13 = 1.2543) which is greater than the payment amount (1.25)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });

      describe("when the payment amount is more than the intent amount * conversion rate", async () => {
        beforeEach(async () => {
          subjectIntentAmount = usdc(1.10);   // just 1 cent less than the actual ask amount (1.10 * 1.13 = 1.243) which is less than the payment amount (1.25)
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
        subjectPayeeDetailsHash = 'incorrect_recipient_id';
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
      });

      describe.skip("when the proof is an appclip proof", async () => {
        beforeEach(async () => {
          proof = parseAppclipProof(wiseAppclipProof);
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

    describe("when the currency is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = ZERO_BYTES32;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment currency");
      });
    });

    describe("when the provider hash is invalid", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4080818544341039229495851033825904336592969679461569916639133799093374442763\",\"extractedParameters\":{\"paymentId\":\"1038880090\",\"paymentStatus\":\"transferred\",\"recipientId\":\"0xcacce013709154334af512b92ad6e65438a3195ad985cf17050b871a6933fce4\",\"targetCurrency\":\"EUR\",\"targetValue\":\"1.25\",\"transferredDate\":\"2024-04-17 22:34:06\"},\"providerHash\":\"0xc6cbb4dd0cb8f09201d2e05d17b2223bea494178172d6111d6bebc6102de8331\"}";
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

    // describe("when the payment status is not transferred", async () => {
    //   beforeEach(async () => {
    //     subjectPayeeDetailsHash = 'incorrect_payment_status';
    //   });

    //   it("should revert", async () => {
    //     await expect(subject()).to.be.revertedWith("Incorrect payment status");
    //   });
    // });

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
