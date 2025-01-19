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
    "parameters": "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"id\\\":(?<paymentId>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"OUTGOING_PAYMENT_SENT\\\",\\\"date\\\":(?<timestamp>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"targetAmount\\\":(?<targetAmount>[0-9\\\\.]+)\"},{\"type\":\"regex\",\"value\":\"\\\"targetCurrency\\\":\\\"(?<targetCurrency>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"targetRecipientId\\\":(?<targetRecipientId>[0-9]+)\"}],\"responseRedactions\":[{\"jsonPath\":\"$.id\",\"xPath\":\"\"},{\"jsonPath\":\"$.state\",\"xPath\":\"\"},{\"jsonPath\":\"$.stateHistory\",\"xPath\":\"\"},{\"jsonPath\":\"$.targetAmount\",\"xPath\":\"\"},{\"jsonPath\":\"$.targetCurrency\",\"xPath\":\"\"},{\"jsonPath\":\"$.targetRecipientId\",\"xPath\":\"\"}],\"url\":\"https://wise.com/gateway/v3/profiles/41213881/transfers/1038880090\",\"writeRedactionMode\":\"zk\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1737295216,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4080818544341039229495851033825904336592969679461569916639133799093374442763\",\"extractedParameters\":{\"paymentId\":\"1038880090\",\"state\":\"OUTGOING_PAYMENT_SENT\",\"targetAmount\":\"1.25\",\"targetCurrency\":\"EUR\",\"targetRecipientId\":\"0xcacce013709154334af512b92ad6e65438a3195ad985cf17050b871a6933fce4\",\"timestamp\":\"1713393246000\"},\"providerHash\":\"0x29d924de3db7eb3733ff16e1cd8be3cf2b070909f15c88c1d4128eb4f2295894\"}",
    "identifier": "0xac20c8afaa6aaf4d43d73b3e7691db2d9cc3023a22b07d0f243d03145d75e6c0",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "claimSignature": { "0": 179, "1": 131, "2": 98, "3": 104, "4": 177, "5": 151, "6": 224, "7": 57, "8": 140, "9": 58, "10": 6, "11": 41, "12": 146, "13": 50, "14": 10, "15": 177, "16": 61, "17": 85, "18": 200, "19": 91, "20": 59, "21": 201, "22": 116, "23": 106, "24": 195, "25": 236, "26": 74, "27": 35, "28": 192, "29": 214, "30": 95, "31": 232, "32": 120, "33": 196, "34": 126, "35": 38, "36": 145, "37": 102, "38": 227, "39": 109, "40": 148, "41": 179, "42": 49, "43": 88, "44": 18, "45": 95, "46": 167, "47": 147, "48": 91, "49": 63, "50": 215, "51": 90, "52": 176, "53": 92, "54": 38, "55": 199, "56": 217, "57": 243, "58": 104, "59": 183, "60": 237, "61": 78, "62": 181, "63": 81, "64": 27 },
    "resultSignature": { "0": 84, "1": 50, "2": 186, "3": 187, "4": 147, "5": 252, "6": 149, "7": 143, "8": 133, "9": 236, "10": 3, "11": 98, "12": 125, "13": 220, "14": 126, "15": 210, "16": 155, "17": 27, "18": 231, "19": 17, "20": 63, "21": 111, "22": 219, "23": 216, "24": 193, "25": 206, "26": 192, "27": 16, "28": 127, "29": 165, "30": 134, "31": 16, "32": 15, "33": 46, "34": 44, "35": 10, "36": 29, "37": 66, "38": 161, "39": 253, "40": 214, "41": 3, "42": 121, "43": 135, "44": 113, "45": 63, "46": 118, "47": 27, "48": 187, "49": 203, "50": 228, "51": 66, "52": 163, "53": 238, "54": 222, "55": 197, "56": 99, "57": 79, "58": 159, "59": 249, "60": 92, "61": 186, "62": 139, "63": 109, "64": 27 }
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
    providerHashes = ["0x29d924de3db7eb3733ff16e1cd8be3cf2b070909f15c88c1d4128eb4f2295894"];

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

      paymentTimestamp = 1713393246;

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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4080818544341039229495851033825904336592969679461569916639133799093374442763\",\"extractedParameters\":{\"paymentId\":\"1038880090\",\"state\":\"OUTGOING_PAYMENT_SENT\",\"targetAmount\":\"1.25\",\"targetCurrency\":\"EUR\",\"targetRecipientId\":\"0xcacce013709154334af512b92ad6e65438a3195ad985cf17050b871a6933fce4\",\"timestamp\":\"1713393246000\"},\"providerHash\":\"0x29d924de3db7eb3733ff16e1cd8be3cf2b070909f15c88c1d4128eb4f2295895\"}";
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4080818544341039229495851033825904336592969679461569916639133799093374442763\",\"extractedParameters\":{\"paymentId\":\"1038880090\",\"state\":\"INCOMPLETE\",\"targetAmount\":\"1.25\",\"targetCurrency\":\"EUR\",\"targetRecipientId\":\"0xcacce013709154334af512b92ad6e65438a3195ad985cf17050b871a6933fce4\",\"timestamp\":\"1713393246000\"},\"providerHash\":\"0x29d924de3db7eb3733ff16e1cd8be3cf2b070909f15c88c1d4128eb4f2295894\"}";
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
