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
    "parameters": "{\"body\":\"\",\"method\":\"GET\",\"paramValues\":{\"PROFILE_ID\":\"41246868\",\"TRANSACTION_ID\":\"1036122853\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"id\\\":(?<paymentId>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"OUTGOING_PAYMENT_SENT\\\",\\\"date\\\":(?<timestamp>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"targetAmount\\\":(?<targetAmount>[0-9\\\\.]+)\"},{\"type\":\"regex\",\"value\":\"\\\"targetCurrency\\\":\\\"(?<targetCurrency>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"targetRecipientId\\\":(?<targetRecipientId>[0-9]+)\"}],\"responseRedactions\":[{\"jsonPath\":\"$.id\",\"xPath\":\"\"},{\"jsonPath\":\"$.state\",\"xPath\":\"\"},{\"jsonPath\":\"$.stateHistory\",\"xPath\":\"\"},{\"jsonPath\":\"$.targetAmount\",\"xPath\":\"\"},{\"jsonPath\":\"$.targetCurrency\",\"xPath\":\"\"},{\"jsonPath\":\"$.targetRecipientId\",\"xPath\":\"\"}],\"url\":\"https://wise.com/gateway/v3/profiles/{{PROFILE_ID}}/transfers/{{TRANSACTION_ID}}\",\"writeRedactionMode\":\"zk\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1737300588,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"3255272855445122854259407670991079284015086279635495324568586132056928581139\",\"extractedParameters\":{\"PROFILE_ID\":\"41246868\",\"TRANSACTION_ID\":\"1036122853\",\"paymentId\":\"1036122853\",\"state\":\"OUTGOING_PAYMENT_SENT\",\"targetAmount\":\"0.11\",\"targetCurrency\":\"EUR\",\"targetRecipientId\":\"0x267d153c16d2605a4664ed8ede0a04a35cd406ecb879b8f119c2fe997a6921c4\",\"timestamp\":\"1713200478000\"},\"providerHash\":\"0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9646\"}",
    "identifier": "0xc1c633299549ee8779de99e3af3d50174d5b3544232d8d9b745067f82f03d1f9",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": { "0": 190, "1": 92, "2": 174, "3": 41, "4": 66, "5": 221, "6": 222, "7": 130, "8": 218, "9": 56, "10": 29, "11": 55, "12": 179, "13": 111, "14": 174, "15": 98, "16": 219, "17": 61, "18": 204, "19": 184, "20": 78, "21": 64, "22": 249, "23": 33, "24": 117, "25": 66, "26": 176, "27": 107, "28": 103, "29": 225, "30": 21, "31": 44, "32": 100, "33": 80, "34": 116, "35": 239, "36": 13, "37": 162, "38": 59, "39": 157, "40": 101, "41": 78, "42": 111, "43": 183, "44": 116, "45": 228, "46": 240, "47": 132, "48": 94, "49": 219, "50": 200, "51": 41, "52": 146, "53": 2, "54": 208, "55": 145, "56": 168, "57": 87, "58": 184, "59": 28, "60": 131, "61": 68, "62": 210, "63": 22, "64": 27 },
    "resultSignature": { "0": 6, "1": 39, "2": 146, "3": 240, "4": 60, "5": 116, "6": 211, "7": 181, "8": 93, "9": 6, "10": 206, "11": 76, "12": 144, "13": 236, "14": 6, "15": 8, "16": 3, "17": 29, "18": 255, "19": 152, "20": 151, "21": 105, "22": 95, "23": 188, "24": 242, "25": 91, "26": 164, "27": 79, "28": 130, "29": 250, "30": 186, "31": 193, "32": 110, "33": 126, "34": 123, "35": 181, "36": 220, "37": 203, "38": 221, "39": 57, "40": 190, "41": 251, "42": 61, "43": 6, "44": 208, "45": 165, "46": 255, "47": 66, "48": 226, "49": 156, "50": 171, "51": 100, "52": 244, "53": 112, "54": 75, "55": 103, "56": 236, "57": 72, "58": 148, "59": 63, "60": 206, "61": 9, "62": 59, "63": 58, "64": 28 }
  }
}

const wiseAppclipProof = {}

describe("WiseReclaimVerifier", () => {
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

    witnesses = ["0x0636c417755e3ae25c6c166d181c0607f4c572a3"];
    providerHashes = ["0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9646"];

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

      paymentTimestamp = 1713200478;

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(0.1);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(1.1);   // 0.1 * 1.1 = 0.11 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['402863684'])
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
      expect(intentHash).to.eq(BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581139').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['1036122853']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    // describe("when the proof is an appclip proof", async () => {
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
        subjectIntentAmount = usdc(0.11);   // just 1 cent more than the actual ask amount (0.11 * 1.1 = 0.121) which is greater than the payment amount (0.12)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });

      describe("when the payment amount is more than the intent amount * conversion rate", async () => {
        beforeEach(async () => {
          subjectIntentAmount = usdc(0.10);   // just 1 cent less than the actual ask amount (0.10 * 1.1 = 0.11) which is less than the payment amount (0.12)
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"3255272855445122854259407670991079284015086279635495324568586132056928581139\",\"extractedParameters\":{\"PROFILE_ID\":\"41246868\",\"TRANSACTION_ID\":\"1036122853\",\"paymentId\":\"1036122853\",\"state\":\"OUTGOING_PAYMENT_SENT\",\"targetAmount\":\"0.11\",\"targetCurrency\":\"EUR\",\"targetRecipientId\":\"0x267d153c16d2605a4664ed8ede0a04a35cd406ecb879b8f119c2fe997a6921c4\",\"timestamp\":\"1713200478000\"},\"providerHash\":\"0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9647\"}";
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"3255272855445122854259407670991079284015086279635495324568586132056928581139\",\"extractedParameters\":{\"PROFILE_ID\":\"41246868\",\"TRANSACTION_ID\":\"1036122853\",\"paymentId\":\"1036122853\",\"state\":\"INCOMPLETE\",\"targetAmount\":\"0.11\",\"targetCurrency\":\"EUR\",\"targetRecipientId\":\"0x267d153c16d2605a4664ed8ede0a04a35cd406ecb879b8f119c2fe997a6921c4\",\"timestamp\":\"1713200478000\"},\"providerHash\":\"0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9646\"}";
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
