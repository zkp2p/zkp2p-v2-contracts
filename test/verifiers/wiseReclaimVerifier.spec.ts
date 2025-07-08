import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike, Wallet } from "ethers";

import { NullifierRegistry, WiseReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, convertSignatureToHex, encodeProof, parseExtensionProof } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ADDRESS_ZERO, ONE_DAY_IN_SECONDS } from "@utils/constants";

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
    let subjectDepositData: BytesLike;
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
      subjectDepositData = ethers.utils.defaultAbiCoder.encode(
        ['address[]'],
        [witnesses]
      );
      subjectData = "0x";
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
      expect(result.intentHash).to.eq(BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581139').toHexString());
      // Payment is 0.11 EUR, conversion rate is 1.1, intent amount is 0.1 USDC
      // Release amount = 0.11 / 1.1 = 0.1 USDC
      expect(result.releaseAmount).to.eq(usdc(0.1));
      expect(result.paymentCurrency).to.eq(Currency.EUR);
      expect(result.paymentId).to.eq('1036122853');
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['1036122853']));
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

    describe("when the payment amount is less than the expected payment amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(2); // Intent expects 2 * 1.1 = 2.2, but actual payment is 0.11
        subjectConversionRate = ether(1.01);
      });

      it("should succeed with partial payment", async () => {
        const result = await subjectCallStatic();

        expect(result.success).to.be.true;
        expect(result.intentHash).to.eq(BigNumber.from("3255272855445122854259407670991079284015086279635495324568586132056928581139").toHexString());
        // Payment is 0.11 EUR, conversion rate is 1.01, intent amount is 2 USDC
        // Release amount = 0.11 / 1.01 = 0.10891089
        expect(result.releaseAmount).to.eq(usdc(0.108910));  // limited to 6 decimal places and rounded down
        expect(result.paymentCurrency).to.eq(Currency.EUR);
        expect(result.paymentId).to.eq('1036122853');
      });
    });

    describe("when the payment amount is zero", async () => {
      beforeEach(async () => {
        // Mock a proof with zero payment amount
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"3255272855445122854259407670991079284015086279635495324568586132056928581139\",\"extractedParameters\":{\"PROFILE_ID\":\"41246868\",\"TRANSACTION_ID\":\"1036122853\",\"paymentId\":\"1036122853\",\"state\":\"OUTGOING_PAYMENT_SENT\",\"targetAmount\":\"0.00\",\"targetCurrency\":\"EUR\",\"targetRecipientId\":\"0x267d153c16d2605a4664ed8ede0a04a35cd406ecb879b8f119c2fe997a6921c4\",\"timestamp\":\"1713200478000\"},\"providerHash\":\"0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9646\"}";
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

    describe("when the provider hash is invalid", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"3255272855445122854259407670991079284015086279635495324568586132056928581139\",\"extractedParameters\":{\"PROFILE_ID\":\"41246868\",\"TRANSACTION_ID\":\"1036122853\",\"paymentId\":\"1036122853\",\"state\":\"OUTGOING_PAYMENT_SENT\",\"targetAmount\":\"0.11\",\"targetCurrency\":\"EUR\",\"targetRecipientId\":\"0x267d153c16d2605a4664ed8ede0a04a35cd406ecb879b8f119c2fe997a6921c4\",\"timestamp\":\"1713200478000\"},\"providerHash\":\"0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9647\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
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

    describe("when the wrong currency is sent", async () => {
      let currencyResolutionService: Wallet;
      let wrongCurrency: BytesLike;
      let penaltyBps: BigNumber;
      let signature: string;
      let witness: Wallet;

      beforeEach(async () => {
        // Create a new proof with wrong currency (USD instead of EUR)
        wrongCurrency = Currency.USD;
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"3255272855445122854259407670991079284015086279635495324568586132056928581139\",\"extractedParameters\":{\"PROFILE_ID\":\"41246868\",\"TRANSACTION_ID\":\"1036122853\",\"paymentId\":\"1036122853\",\"state\":\"OUTGOING_PAYMENT_SENT\",\"targetAmount\":\"0.11\",\"targetCurrency\":\"USD\",\"targetRecipientId\":\"0x267d153c16d2605a4664ed8ede0a04a35cd406ecb879b8f119c2fe997a6921c4\",\"timestamp\":\"1713200478000\"},\"providerHash\":\"0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9646\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // Sign the updated claim with witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof);

        // Setup currency resolution service
        currencyResolutionService = ethers.Wallet.createRandom();
        penaltyBps = ether(0.01); // 1 basis points = 0.01% penalty

        // Add currency resolution service to deposit data
        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'address'],
          [[witness.address], currencyResolutionService.address]
        );
        subjectConversionRate = ether(1.01);
      });

      describe("when currency resolution data is provided", async () => {
        beforeEach(async () => {
          // Create resolution data signature
          const resolutionData = {
            intentHash: BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581139').toHexString(),
            paymentCurrency: wrongCurrency,
            conversionRate: subjectConversionRate,
            penaltyBps: penaltyBps
          };

          const messageHash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
              ['bytes32', 'bytes32', 'uint256', 'uint256'],
              [resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps.toString()]
            )
          );

          signature = await currencyResolutionService.signMessage(ethers.utils.arrayify(messageHash));

          // Add resolution data to subject data
          subjectData = ethers.utils.defaultAbiCoder.encode(
            ['tuple(bytes32,bytes32,uint256,uint256,bytes)'],
            [[resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps, signature]]
          );
        });

        it("should verify the proof with penalty applied", async () => {
          const result = await subjectCallStatic();

          expect(result.success).to.be.true;
          expect(result.intentHash).to.eq(BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581139').toHexString());
          // Payment is 0.11 USD, conversion rate is 1.01, intent amount is 0.1 USDC
          // Release amount before penalty = 0.11 / 1.01 = 0.1 (capped at intent amount)
          // With 1% penalty: 0.1 * 0.99 = 0.099 USDC
          expect(result.releaseAmount).to.eq(usdc(0.099));  // limited to 6 decimal places and rounded down
          expect(result.paymentCurrency).to.eq(Currency.USD);
          expect(result.paymentId).to.eq('1036122853');
        });

        describe("when payment amount is less than the expected payment amount", async () => {
          beforeEach(async () => {
            // Create resolution data signature
            const resolutionData = {
              intentHash: BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581139').toHexString(),
              paymentCurrency: wrongCurrency,
              conversionRate: ether(2),
              penaltyBps: penaltyBps
            };

            const messageHash = ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ['bytes32', 'bytes32', 'uint256', 'uint256'],
                [resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps.toString()]
              )
            );

            signature = await currencyResolutionService.signMessage(ethers.utils.arrayify(messageHash));

            // Add resolution data to subject data
            subjectData = ethers.utils.defaultAbiCoder.encode(
              ['tuple(bytes32,bytes32,uint256,uint256,bytes)'],
              [[resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps, signature]]
            );
          });

          it("should verify the proof with penalty applied", async () => {
            const result = await subjectCallStatic();

            expect(result.success).to.be.true;
            // Payment is 0.11 USD, conversion rate is 2, intent amount is 0.1 USDC
            // Release amount before penalty = 0.11 / 2 = 0.055 USDC
            // With 1% penalty: 0.055 * 0.99 = 0.05445 USDC
            expect(result.releaseAmount).to.eq(usdc(0.05445));  // limited to 6 decimal places and rounded down
            expect(result.paymentCurrency).to.eq(Currency.USD);
            expect(result.paymentId).to.eq('1036122853');
          });
        });

        describe("when penalty is too high", async () => {
          beforeEach(async () => {
            // Create resolution data with excessive penalty (21% = 0.21)
            penaltyBps = ether(0.21);
            const resolutionData = {
              intentHash: BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581139').toHexString(),
              paymentCurrency: wrongCurrency,
              conversionRate: subjectConversionRate,
              penaltyBps: penaltyBps
            };

            const messageHash = ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ['bytes32', 'bytes32', 'uint256', 'uint256'],
                [resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps]
              )
            );

            signature = await currencyResolutionService.signMessage(ethers.utils.arrayify(messageHash));

            subjectData = ethers.utils.defaultAbiCoder.encode(
              ['tuple(bytes32,bytes32,uint256,uint256,bytes)'],
              [[resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps, signature]]
            );
          });

          it("should revert", async () => {
            await expect(subject()).to.be.revertedWith("Penalty exceeds max allowed");
          });
        });

        describe("when resolution currency doesn't match payment currency", async () => {
          beforeEach(async () => {
            // Create resolution data with wrong currency (GBP instead of USD)
            const resolutionData = {
              intentHash: BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581139').toHexString(),
              paymentCurrency: Currency.GBP, // Wrong currency in resolution
              conversionRate: subjectConversionRate,
              penaltyBps: penaltyBps
            };

            const messageHash = ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ['bytes32', 'bytes32', 'uint256', 'uint256'],
                [resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps]
              )
            );

            signature = await currencyResolutionService.signMessage(ethers.utils.arrayify(messageHash));

            subjectData = ethers.utils.defaultAbiCoder.encode(
              ['tuple(bytes32,bytes32,uint256,uint256,bytes)'],
              [[resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps, signature]]
            );
          });

          it("should revert", async () => {
            await expect(subject()).to.be.revertedWith("Resolution currency doesn't match payment");
          });
        });

        describe("when resolution intent hash is incorrect", async () => {
          beforeEach(async () => {
            // Create resolution data with wrong currency (GBP instead of USD)
            const resolutionData = {
              intentHash: BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581130').toHexString(),
              paymentCurrency: wrongCurrency,
              conversionRate: subjectConversionRate,
              penaltyBps: penaltyBps
            };

            const messageHash = ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ['bytes32', 'bytes32', 'uint256', 'uint256'],
                [resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps]
              )
            );

            signature = await currencyResolutionService.signMessage(ethers.utils.arrayify(messageHash));

            subjectData = ethers.utils.defaultAbiCoder.encode(
              ['tuple(bytes32,bytes32,uint256,uint256,bytes)'],
              [[resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps, signature]]
            );
          });

          it("should revert", async () => {
            await expect(subject()).to.be.revertedWith("Resolution intent doesn't match intent");
          });
        });


        describe("when signature is invalid", async () => {
          beforeEach(async () => {
            // Use a different signer for the signature
            const wrongSigner = ethers.Wallet.createRandom();
            const resolutionData = {
              intentHash: BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581139').toHexString(),
              paymentCurrency: wrongCurrency,
              conversionRate: subjectConversionRate,
              penaltyBps: penaltyBps
            };

            const messageHash = ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                ['bytes32', 'bytes32', 'uint256', 'uint256'],
                [resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps]
              )
            );

            signature = await wrongSigner.signMessage(ethers.utils.arrayify(messageHash));

            subjectData = ethers.utils.defaultAbiCoder.encode(
              ['tuple(bytes32,bytes32,uint256,uint256,bytes)'],
              [[resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps, signature]]
            );
          });

          it("should revert", async () => {
            await expect(subject()).to.be.revertedWith("Invalid currency resolution service signature");
          });
        });
      });

      describe("when currency resolution data is not provided", async () => {
        beforeEach(async () => {
          subjectData = "0x";
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Currency mismatch without resolution data");
        });
      });

      describe("when currency resolution service is not set in deposit data", async () => {
        beforeEach(async () => {
          // Only include witnesses, no currency resolution service
          subjectDepositData = ethers.utils.defaultAbiCoder.encode(
            ['address[]', 'address'],
            [[witness.address], ADDRESS_ZERO]
          );

          // Try to provide resolution data anyway
          const resolutionData = {
            intentHash: BigNumber.from('3255272855445122854259407670991079284015086279635495324568586132056928581139').toHexString(),
            paymentCurrency: wrongCurrency,
            conversionRate: subjectConversionRate,
            penaltyBps: penaltyBps
          };

          const messageHash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
              ['bytes32', 'bytes32', 'uint256', 'uint256'],
              [resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps]
            )
          );


          signature = await currencyResolutionService.signMessage(ethers.utils.arrayify(messageHash));

          subjectData = ethers.utils.defaultAbiCoder.encode(
            ['tuple(bytes32,bytes32,uint256,uint256,bytes)'],
            [[resolutionData.intentHash, resolutionData.paymentCurrency, resolutionData.conversionRate, resolutionData.penaltyBps, signature]]
          );
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Incorrect payment currency");
        });
      });
    });
  });
});
