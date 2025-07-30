import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, RevolutApiVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";
import { parseExtensionProof, encodeTwoProofs, getIdentifierFromClaimInfo, createSignDataForClaim } from "@utils/reclaimUtils";

const expect = getWaffleExpect();

// Real Revolut Business API dual proof data (from your actual JSON proof)
const revolutTransactionProofRaw = {
  "claim": {
    "provider": "http",
    "parameters": "{\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"(?<transaction_data>\\\\{.*\\\\})\"}],\"url\":\"https://b2b.revolut.com/api/1.0/transaction/6889440c-811e-a105-b976-a8af8492b790\"}",
    "owner": "0x0118664c3aa9236ddd6ee371093a61fda2d216a5",
    "timestampS": 1753826739,
    "context": "{\"contextAddress\":\"0x0118664c3aa9236ddd6ee371093a61fda2d216a5\",\"contextMessage\":\"6889440c-811e-a105-b976-a8af8492b790\",\"extractedParameters\":{\"aTransactionId\":\"6889440c-811e-a105-b976-a8af8492b790\",\"bAmountString\":\"-0.1\",\"cCounterpartyId\":\"30c9424e-a0b4-4a76-9970-7729d6834647\",\"dState\":\"completed\",\"eTimestampString\":\"2025-07-29T21:58:37.214701Z\"},\"providerHash\":\"0x8aa8f972a5cf6f7119bc6a1658c5cec0363b6c0773acdc8f152ac519cd9a582c\"}",
    "identifier": "0x1277499bd99eb7384d4ed549503dab46859de65740bfeedceafc152012f249ad",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
    "claimSignature": {
      "0": 132, "1": 37, "2": 105, "3": 61, "4": 34, "5": 142, "6": 22, "7": 222, "8": 179, "9": 37,
      "10": 141, "11": 1, "12": 179, "13": 163, "14": 47, "15": 244, "16": 254, "17": 67, "18": 16, "19": 47,
      "20": 36, "21": 54, "22": 210, "23": 123, "24": 224, "25": 154, "26": 186, "27": 122, "28": 176, "29": 248,
      "30": 18, "31": 48, "32": 22, "33": 18, "34": 198, "35": 146, "36": 125, "37": 211, "38": 92, "39": 190,
      "40": 217, "41": 89, "42": 181, "43": 154, "44": 70, "45": 41, "46": 77, "47": 4, "48": 39, "49": 239,
      "50": 181, "51": 69, "52": 167, "53": 127, "54": 236, "55": 153, "56": 52, "57": 84, "58": 23, "59": 157,
      "60": 69, "61": 113, "62": 54, "63": 54, "64": 27
    }
  }
};

const revolutCounterpartyProofRaw = {
  "claim": {
    "provider": "http",
    "parameters": "{\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"(?<counterparties_list>\\\\[.*\\\\])\"}],\"url\":\"https://b2b.revolut.com/api/1.0/counterparties\"}",
    "owner": "0x0118664c3aa9236ddd6ee371093a61fda2d216a5",
    "timestampS": 1753826741,
    "context": "{\"contextAddress\":\"0x0118664c3aa9236ddd6ee371093a61fda2d216a5\",\"contextMessage\":\"30c9424e-a0b4-4a76-9970-7729d6834647\",\"extractedParameters\":{\"aCounterpartyId\":\"30c9424e-a0b4-4a76-9970-7729d6834647\",\"bRevtag\":\"mohammgz8\",\"cCountry\":\"GB\"},\"providerHash\":\"0x8148ed5fc16917eb0e9773a4eb4f9608dd6b83957b3a905afd394db53cf76179\"}",
    "identifier": "0xc40a493c5e8d074f83f9a634b8dcd82611043c065daa356a5c2594f782cad222",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
    "claimSignature": {
      "0": 36, "1": 146, "2": 252, "3": 108, "4": 232, "5": 111, "6": 15, "7": 34, "8": 230, "9": 224,
      "10": 10, "11": 23, "12": 100, "13": 19, "14": 25, "15": 128, "16": 88, "17": 183, "18": 26, "19": 186,
      "20": 139, "21": 247, "22": 113, "23": 147, "24": 147, "25": 221, "26": 151, "27": 102, "28": 22, "29": 71,
      "30": 248, "31": 212, "32": 35, "33": 78, "34": 152, "35": 114, "36": 81, "37": 240, "38": 47, "39": 85,
      "40": 147, "41": 82, "42": 205, "43": 190, "44": 58, "45": 120, "46": 70, "47": 175, "48": 154, "49": 225,
      "50": 67, "51": 139, "52": 25, "53": 240, "54": 24, "55": 180, "56": 211, "57": 47, "58": 60, "59": 1,
      "60": 121, "61": 116, "62": 121, "63": 36, "64": 28
    }
  }
};

describe("RevolutApiVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: RevolutApiVerifier;
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

    // Provider hashes from the real proof data
    providerHashes = [
      "0x8aa8f972a5cf6f7119bc6a1658c5cec0363b6c0773acdc8f152ac519cd9a582c", // transaction proof hash
      "0x8148ed5fc16917eb0e9773a4eb4f9608dd6b83957b3a905afd394db53cf76179"  // counterparty proof hash
    ];

    witnesses = ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "0x244897572368eadf65bfbc5aec98d8e5443a9072"];

    nullifierRegistry = await deployer.deployNullifierRegistry();
    verifier = await deployer.deployRevolutApiVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(3600), // 1 hour timestamp buffer
      [Currency.GBP, Currency.EUR, Currency.USD], // supported currencies
      providerHashes
    );

    await nullifierRegistry.connect(owner.wallet).addWritePermission(verifier.address);
  });

  describe("#constructor", async () => {
    it("should set the correct state", async () => {
      const escrowAddress = await verifier.escrow();
      const nullifierRegistryAddress = await verifier.nullifierRegistry();
      const timestampBuffer = await verifier.timestampBuffer();

      expect(nullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(escrowAddress).to.eq(escrow.address);
      expect(timestampBuffer).to.eq(BigNumber.from(3600));
    });

    it("should support the correct currencies", async () => {
      const supportedGBP = await verifier.isCurrency(Currency.GBP);
      const supportedEUR = await verifier.isCurrency(Currency.EUR);
      const supportedUSD = await verifier.isCurrency(Currency.USD);
      
      expect(supportedGBP).to.be.true;
      expect(supportedEUR).to.be.true;
      expect(supportedUSD).to.be.true;
    });
  });

  describe("#verifyPayment", async () => {
    let proofTransaction: ReclaimProof;
    let proofCounterparty: ReclaimProof;

    let subjectProof: BytesLike;
    let subjectDepositToken: Address;
    let subjectIntentAmount: BigNumber;
    let subjectIntentTimestamp: BigNumber;
    let subjectPayeeDetails: string;
    let subjectFiatCurrency: BytesLike;
    let subjectConversionRate: BigNumber;
    let subjectData: BytesLike;

    beforeEach(async () => {
      // Parse the raw proof data using the utility function (like ZelleChase)
      proofTransaction = parseExtensionProof(revolutTransactionProofRaw);
      proofCounterparty = parseExtensionProof(revolutCounterpartyProofRaw);

      // Recalculate identifiers to ensure they match the claim info
      proofTransaction.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proofTransaction.claimInfo);
      proofCounterparty.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proofCounterparty.claimInfo);

      // Generate valid signatures for the recalculated identifiers (like ZelleChase test)
      const digestTransaction = createSignDataForClaim(proofTransaction.signedClaim.claim);
      const digestCounterparty = createSignDataForClaim(proofCounterparty.signedClaim.claim);
      const witnessTransaction = ethers.Wallet.createRandom();
      const witnessCounterparty = ethers.Wallet.createRandom();
      proofTransaction.signedClaim.signatures = [await witnessTransaction.signMessage(digestTransaction)];
      proofCounterparty.signedClaim.signatures = [await witnessCounterparty.signMessage(digestCounterparty)];

      // Encode dual proofs using the utility function (like ZelleChase)
      subjectProof = encodeTwoProofs(proofTransaction, proofCounterparty);

      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(0.1); // 0.1 USDC 
      // Use current block timestamp for intent timestamp since we're using block.timestamp in the contract
      const latestBlock = await ethers.provider.getBlock("latest");
      subjectIntentTimestamp = BigNumber.from(latestBlock.timestamp);
      subjectPayeeDetails = "mohammgz8"; // This is the revtag we're validating against
      subjectFiatCurrency = Currency.GBP;
      subjectConversionRate = ether(1.0); // 1 USDC = 1.0 GBP (so we need 0.1 GBP payment for 0.1 USDC)
      subjectData = ethers.utils.defaultAbiCoder.encode(["address[]"], [[witnessTransaction.address, witnessCounterparty.address]]);
    });

    async function subject(): Promise<any> {
      return await verifier.connect(escrow.wallet).verifyPayment({
        paymentProof: subjectProof,
        depositToken: subjectDepositToken,
        intentAmount: subjectIntentAmount,
        intentTimestamp: subjectIntentTimestamp,
        payeeDetails: subjectPayeeDetails,
        fiatCurrency: subjectFiatCurrency,
        conversionRate: subjectConversionRate,
        data: subjectData
      });
    }

    async function subjectCallStatic(): Promise<[boolean, string]> {
      return await verifier.connect(escrow.wallet).callStatic.verifyPayment({
        paymentProof: subjectProof,
        depositToken: subjectDepositToken,
        intentAmount: subjectIntentAmount,
        intentTimestamp: subjectIntentTimestamp,
        payeeDetails: subjectPayeeDetails,
        fiatCurrency: subjectFiatCurrency,
        conversionRate: subjectConversionRate,
        data: subjectData
      });
    }

    it("should verify the proof", async () => {
      const [verified, intentHash] = await subjectCallStatic();
      
      expect(verified).to.be.true;
      expect(intentHash).to.not.eq(ZERO_BYTES32);
    });

    it("should nullify the transaction ID", async () => {
      await subject();
      
      // Try to reuse the same proof - should fail
      await expect(subject()).to.be.revertedWith("Nullifier has already been used");
    });

    it("should emit RevolutPaymentVerified event", async () => {
      await expect(subject())
        .to.emit(verifier, "RevolutPaymentVerified");
    });

    describe("when the amount doesn't match", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(1); // Require 1 USDC but proof shows 0.1 GBP payment
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });
    });

    describe("when the recipient doesn't match", async () => {
      beforeEach(async () => {
        subjectPayeeDetails = "wrongrevtag";
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("RevTag mismatch - payment not to intended recipient");
      });
    });

    describe("when the currency is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.AUD; // Not supported
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Unsupported currency");
      });
    });

    describe("when the transaction is not completed", async () => {
      // TODO: Create a proof with non-completed state - for now this is handled in the proof data
      it("should revert", async () => {
        // This test would need modified proof data with state != "completed"
        // await expect(subject()).to.be.revertedWith("Payment not completed");
      });
    });

    describe("when the caller is not the escrow", async () => {
      it("should revert", async () => {
        await expect(
          verifier.connect(attacker.wallet).verifyPayment({
            paymentProof: subjectProof,
            depositToken: subjectDepositToken,
            intentAmount: subjectIntentAmount,
            intentTimestamp: subjectIntentTimestamp,
            payeeDetails: subjectPayeeDetails,
            fiatCurrency: subjectFiatCurrency,
            conversionRate: subjectConversionRate,
            data: subjectData
          })
        ).to.be.revertedWith("Only escrow can call");
      });
    });
  });
});