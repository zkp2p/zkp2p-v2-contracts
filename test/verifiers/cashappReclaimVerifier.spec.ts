import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, CashappReclaimVerifier, USDCMock } from "@utils/contracts";
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


const cashappExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"{\\\"activity_token\\\":{\\\"activity_token_type\\\":\\\"CUSTOMER_TOKEN\\\",\\\"token\\\":\\\"{{SENDER_ID}}\\\"},\\\"activity_scope\\\":\\\"MY_ACTIVITY_WEB_V2\\\",\\\"caller_token\\\":\\\"{{SENDER_ID}}\\\",\\\"page_size\\\":15,\\\"request_context\\\":{}}\",\"method\":\"POST\",\"paramValues\":{\"SENDER_ID\":\"C_0twqj8ycc\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"currency_code\\\":\\\"(?<currency_code>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"display_date\\\":(?<date>[0-9]+)\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"cashtag\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"token\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.amount.amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.amount.currency_code\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.display_date\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.recipient.cashtag\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.token\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.state\",\"xPath\":\"\"}],\"url\":\"https://cash.app/cash-app/activity/v1.0/page\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1736260362, "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"12014506636571874886965000811776567979685927375542718613570391557275994688735\",\"extractedParameters\":{\"SENDER_ID\":\"C_0twqj8ycc\",\"amount\":\"100\",\"currency_code\":\"USD\",\"date\":\"1735841166000\",\"paymentId\":\"7cwz2mgva\",\"receiverId\":\"0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585\",\"state\":\"COMPLETE\"},\"providerHash\":\"0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a5\"}",
    "identifier": "0xa799a7b7bbdc062955ecca3d6d7dbc1ef7f0047696287812111346568212db98",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "claimSignature": { "0": 183, "1": 139, "2": 111, "3": 147, "4": 154, "5": 121, "6": 182, "7": 129, "8": 169, "9": 132, "10": 137, "11": 60, "12": 60, "13": 178, "14": 199, "15": 176, "16": 37, "17": 127, "18": 75, "19": 10, "20": 122, "21": 73, "22": 207, "23": 182, "24": 198, "25": 21, "26": 122, "27": 102, "28": 157, "29": 215, "30": 44, "31": 35, "32": 87, "33": 157, "34": 85, "35": 178, "36": 71, "37": 214, "38": 117, "39": 82, "40": 98, "41": 80, "42": 149, "43": 61, "44": 182, "45": 57, "46": 228, "47": 98, "48": 181, "49": 244, "50": 253, "51": 161, "52": 41, "53": 128, "54": 248, "55": 88, "56": 52, "57": 232, "58": 168, "59": 187, "60": 27, "61": 216, "62": 150, "63": 38, "64": 27 },
    "resultSignature": { "0": 170, "1": 233, "2": 46, "3": 142, "4": 246, "5": 42, "6": 47, "7": 200, "8": 118, "9": 196, "10": 2, "11": 89, "12": 134, "13": 218, "14": 144, "15": 195, "16": 6, "17": 225, "18": 109, "19": 172, "20": 97, "21": 99, "22": 99, "23": 241, "24": 179, "25": 44, "26": 238, "27": 194, "28": 213, "29": 29, "30": 203, "31": 48, "32": 98, "33": 143, "34": 164, "35": 213, "36": 79, "37": 205, "38": 246, "39": 30, "40": 236, "41": 202, "42": 8, "43": 213, "44": 93, "45": 171, "46": 101, "47": 109, "48": 164, "49": 250, "50": 241, "51": 156, "52": 63, "53": 27, "54": 211, "55": 18, "56": 76, "57": 172, "58": 200, "59": 88, "60": 2, "61": 133, "62": 249, "63": 191, "64": 27 }
  }
}

describe("CashappReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: CashappReclaimVerifier;
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
    providerHashes = ["0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a5"];

    nullifierRegistry = await deployer.deployNullifierRegistry();
    verifier = await deployer.deployCashappReclaimVerifier(
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
    let subjectDepositData: BytesLike;
    let subjectData: BytesLike;

    beforeEach(async () => {
      proof = parseExtensionProof(cashappExtensionProof);
      subjectProof = encodeProof(proof);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1.11);
      subjectIntentTimestamp = BigNumber.from(1735841166);
      subjectConversionRate = ether(0.9);   // 1.11 * 0.9 = 0.999 (payment amount)
      subjectPayeeDetailsHash = '0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585'
      subjectFiatCurrency = Currency.USD;
      subjectData = "0x";
      subjectDepositData = ethers.utils.defaultAbiCoder.encode(
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
      expect(result.intentHash).to.eq(BigNumber.from("12014506636571874886965000811776567979685927375542718613570391557275994688735").toHexString());
      // Payment is $1.00, conversion rate is 0.9, intent amount is 1.11
      // Release amount = 1.00 / 0.9 = 1.111... but capped at intent amount 1.11
      expect(result.releaseAmount).to.eq(usdc(1.11));
      expect(result.paymentCurrency).to.eq(Currency.USD);
      expect(result.paymentId).to.eq('7cwz2mgva');
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['7cwz2mgva']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is invalid", async () => {
      beforeEach(async () => {
        proof.signedClaim.claim.identifier = ZERO_BYTES32;

        subjectProof = encodeProof(proof)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.reverted;
      });
    });

    describe("when the payment amount is less than the expected payment amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(5); // Intent expects 5 * 0.9 = 4.5, but actual payment is 1.00
        subjectConversionRate = ether(0.9);
      });

      it("should succeed with partial payment", async () => {
        const result = await subjectCallStatic();

        expect(result.success).to.be.true;
        expect(result.intentHash).to.eq(BigNumber.from("12014506636571874886965000811776567979685927375542718613570391557275994688735").toHexString());
        // Payment is $1.00, conversion rate is 0.9, intent amount is 5
        // Release amount = 1.00 / 0.9 = 1.111... USDC
        expect(result.releaseAmount).to.eq(usdc(1).mul(ether(1)).div(ether(0.9)));
        expect(result.paymentCurrency).to.eq(Currency.USD);
        expect(result.paymentId).to.eq('7cwz2mgva');
      });

      it("should nullify the payment", async () => {
        await subject();

        const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['7cwz2mgva']));
        const isNullified = await nullifierRegistry.isNullified(nullifier);

        expect(isNullified).to.be.true;
      });
    });

    describe("when the payment amount is zero", async () => {
      beforeEach(async () => {
        // Mock a proof with zero payment amount
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"12014506636571874886965000811776567979685927375542718613570391557275994688735\",\"extractedParameters\":{\"SENDER_ID\":\"C_0twqj8ycc\",\"amount\":\"0\",\"currency_code\":\"USD\",\"date\":\"1735841166000\",\"paymentId\":\"7cwz2mgva\",\"receiverId\":\"0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585\",\"state\":\"COMPLETE\"},\"providerHash\":\"0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a5\"}";
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
        subjectIntentTimestamp = BigNumber.from(1735841166).add(1).add(BigNumber.from(30));  // payment timestamp + 1 + 30 seconds (buffer)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });

      describe("when the payment was made after the intent", async () => {
        beforeEach(async () => {
          subjectIntentTimestamp = BigNumber.from(1735841166).add(0).add(BigNumber.from(30));  // payment timestamp + 0 + 30 seconds (buffer)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the payment recipient is incorrect", async () => {
      beforeEach(async () => {
        subjectPayeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['random-recipient-id']));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"12014506636571874886965000811776567979685927375542718613570391557275994688735\",\"extractedParameters\":{\"SENDER_ID\":\"C_0twqj8ycc\",\"amount\":\"100\",\"currency_code\":\"USD\",\"date\":\"1735841166000\",\"paymentId\":\"7cwz2mgva\",\"receiverId\":\"0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585\",\"state\":\"COMPLETE\"},\"providerHash\":\"0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a6\"}";
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"12014506636571874886965000811776567979685927375542718613570391557275994688735\",\"extractedParameters\":{\"SENDER_ID\":\"C_0twqj8ycc\",\"amount\":\"100\",\"currency_code\":\"USD\",\"date\":\"1735841166000\",\"paymentId\":\"7cwz2mgva\",\"receiverId\":\"0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585\",\"state\":\"INCOMPLETE\"},\"providerHash\":\"0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a5\"}";
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
  });
});
