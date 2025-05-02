import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, ZelleCitiReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, encodeProof, parseExtensionProof } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32 } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const zelleCitiExtensionProof = {
  claim: {
    provider: "http",
    parameters: "{\"body\":\"\",\"headers\":{\"Accept\":\"application/json\",\"Accept-language\":\"en_US\",\"Content-Type\":\"application/json\",\"Referer\":\"https://online.citi.com/US/nga/zelle/transfer\",\"Sec-Fetch-Dest\":\"empty\",\"Sec-Fetch-Mode\":\"cors\",\"Sec-Fetch-Site\":\"same-origin\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36\",\"appVersion\":\"CBOL-ANG-2025-04-01\",\"businessCode\":\"GCB\",\"channelId\":\"CBOL\",\"client_id\":\"4a51fb19-a1a7-4247-bc7e-18aa56dd1c40\",\"countryCode\":\"US\",\"sec-ch-ua\":\"\\\"Chromium\\\";v=\\\"136\\\", \\\"Google Chrome\\\";v=\\\"136\\\", \\\"Not.A/Brand\\\";v=\\\"99\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\"},\"method\":\"GET\",\"paramValues\":{},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"paymentID\\\":\\\"(?<paymentID>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentStatus\\\":\\\"(?<paymentStatus>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"updatedTimeStamp\\\":\\\"(?<updatedTimeStamp>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"(?<amount>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"partyToken\\\":\\\"(?<partyToken>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.content.paymentTransactionsData[1].paymentID\",\"xPath\":\"\"},{\"jsonPath\":\"$.content.paymentTransactionsData[1].paymentStatus\",\"xPath\":\"\"},{\"jsonPath\":\"$.content.paymentTransactionsData[1].updatedTimeStamp\",\"xPath\":\"\"},{\"jsonPath\":\"$.content.paymentTransactionsData[1].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.content.paymentTransactionsData[1].partyToken\",\"xPath\":\"\"}],\"url\":\"https://online.citi.com/gcgapi/prod/public/v1/p2ppayments/pastActivityTransactions?transactionCount=20&pageId=0&tab=All\"}",
    owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
    timestampS: 1746152327,
    context: "{\"contextAddress\":\"0x0\",\"contextMessage\":\"0x0000000000000000000000000000000000000000000000000000000000000000\",\"extractedParameters\":{\"amount\":\"10.00\",\"partyToken\":\"0x3bcb39ffd57dd47e25c484c95ce7f7591305af0cfaaf7f18ab4ab548217fb303\",\"paymentID\":\"CTIwjcKauxso\",\"paymentStatus\":\"DELIVERED\",\"updatedTimeStamp\":\"04/28/2025\"},\"providerHash\":\"0x3a3d23f3f3c5063af7fa0bd48aa98f4cd4658770aa5de971924fda7ef92ea743\"}",
    identifier: "0x3694f804d9aabaab9a31bda50e6a1491c73d1067d9bec558ba0dba6e34d8c0c1",
    epoch: 1
  },
  signatures: {
    attestorAddress: "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    claimSignature: [
      57, 148, 209, 226, 97, 236, 95, 190, 18, 226, 221, 93, 3, 198, 5, 37,
      26, 240, 232, 94, 239, 88, 167, 95, 203, 144, 57, 45, 44, 173, 113, 154,
      69, 45, 240, 5, 89, 231, 124, 226, 229, 145, 71, 212, 12, 145, 18, 172,
      42, 149, 206, 165, 180, 103, 20, 82, 38, 216, 48, 146, 3, 102, 72, 166,
      27
    ],
    resultSignature: [
      17, 242, 170, 113, 221, 222, 14, 161, 137, 83, 210, 215, 33, 132, 6, 35,
      250, 214, 225, 115, 179, 43, 192, 116, 223, 228, 166, 6, 157, 78, 39, 99,
      57, 100, 221, 158, 121, 58, 154, 173, 110, 92, 207, 109, 123, 233, 215, 49,
      34, 68, 116, 80, 220, 180, 205, 57, 217, 218, 218, 112, 48, 145, 251, 30,
      28
    ]
  }
};

describe("ZelleCitiReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: ZelleCitiReclaimVerifier;
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
    providerHashes = ["0x3a3d23f3f3c5063af7fa0bd48aa98f4cd4658770aa5de971924fda7ef92ea743"];

    nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployZelleCitiReclaimVerifier(
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
      proof = parseExtensionProof(zelleCitiExtensionProof);
      subjectProof = encodeProof(proof);

      const paymentTime = new Date('2025-04-28');  // Convert to YYYY-MM-DD for JS Date
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(11);  // 11 * 0.9 = 9.9 [less than payment amount of 10]
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp - 86400); // 1 day before
      subjectConversionRate = ether(0.9);
      subjectPayeeDetailsHash = "0x3bcb39ffd57dd47e25c484c95ce7f7591305af0cfaaf7f18ab4ab548217fb303";
      subjectFiatCurrency = ZERO_BYTES32;
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
      expect(intentHash).to.eq("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['CTIwjcKauxso']));
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

    describe("when the payment amount is less than the intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(1000);  // 1000 * 0.9 = 900 [900 > 10]
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });
    });

    describe("when the payment was made before the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(paymentTimestamp).add(86400).add(BigNumber.from(30));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });
    });

    describe("when the payment recipient is incorrect", async () => {
      beforeEach(async () => {
        subjectPayeeDetailsHash = "0x1234567890123456789012345678901234567890123456789012345678901234";
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
        proof.claimInfo.context = proof.claimInfo.context.replace(
          "0x3a3d23f3f3c5063af7fa0bd48aa98f4cd4658770aa5de971924fda7ef92ea743",
          "0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fc"
        );
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

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

    describe("when the payment status is not DELIVERED", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = proof.claimInfo.context.replace("DELIVERED", "PENDING");
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

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
        await expect(subject()).to.be.revertedWith("Payment not delivered");
      });
    });

    describe("when the date format is invalid", async () => {
      beforeEach(async () => {
        // Replace the valid date "04/28/2025" with an invalid format "4/28/2025" (9 characters)
        proof.claimInfo.context = proof.claimInfo.context.replace(
          "\"updatedTimeStamp\":\"04/28/2025\"",
          "\"updatedTimeStamp\":\"4/28/2025\""
        );
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

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
        await expect(subject()).to.be.revertedWith("Invalid date format");
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