import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, RevolutApiVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

// Revolut Business API proof format from working test
const revolutApiProof = {
  "claim": {
    "provider": "http",
    "parameters": "...GET https://b2b.revolut.com/api/1.0/transactions...",
    "context": "{\"extractedParameters\":{\"amount\":\"-0.1\",\"date\":\"2025-07-26T12:57:48.085855Z\",\"recipient\":\"Amazon\",\"state\":\"completed\",\"transaction_id\":\"6884d0cc-17c5-a974-90ca-a77d3980fcaf\"}}"
  },
  "signatures": {
    "attestorAddress": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
    "claimSignature": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef01",
    "resultSignature": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456789001"
  }
};

describe("RevolutApiVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let reclaimAttestor: string;

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

    reclaimAttestor = "0x244897572368eadf65bfbc5aec98d8e5443a9072";

    nullifierRegistry = await deployer.deployNullifierRegistry();
    verifier = await deployer.deployRevolutApiVerifier(
      escrow.address,
      nullifierRegistry.address,
      reclaimAttestor
    );

    await nullifierRegistry.connect(owner.wallet).addWritePermission(verifier.address);
  });

  describe("#constructor", async () => {
    it("should set the correct state", async () => {
      const escrowAddress = await verifier.escrow();
      const nullifierRegistryAddress = await verifier.nullifierRegistry();
      const reclaimAttestorAddress = await verifier.RECLAIM_ATTESTOR();

      expect(nullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(escrowAddress).to.eq(escrow.address);
      expect(reclaimAttestorAddress.toLowerCase()).to.eq(reclaimAttestor.toLowerCase());
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
    let subjectCaller: Account;
    let subjectPaymentProof: BytesLike;
    let subjectDepositToken: Address;
    let subjectIntentAmount: BigNumber;
    let subjectIntentTimestamp: BigNumber;
    let subjectPayeeDetails: string;
    let subjectFiatCurrency: BytesLike;
    let subjectConversionRate: BigNumber;
    let subjectData: BytesLike;

    beforeEach(async () => {
      // Encode the Revolut API proof data
      const claimData = ethers.utils.defaultAbiCoder.encode(
        ["string", "string", "string"],
        [revolutApiProof.claim.provider, revolutApiProof.claim.parameters, revolutApiProof.claim.context]
      );
      
      const signatures = ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes", "bytes"],
        [revolutApiProof.signatures.attestorAddress, revolutApiProof.signatures.claimSignature, revolutApiProof.signatures.resultSignature]
      );
      
      const extractedParameters = ethers.utils.defaultAbiCoder.encode(
        ["string", "string", "string", "string", "string"],
        ["6884d0cc-17c5-a974-90ca-a77d3980fcaf", "completed", "-0.1", "2025-07-26T12:57:48.085855Z", "Amazon"]
      );

      subjectPaymentProof = ethers.utils.defaultAbiCoder.encode(
        ["bytes", "bytes", "bytes"],
        [claimData, signatures, extractedParameters]
      );

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1); // 1 USDC
      // Use current block timestamp for intent timestamp since we're using block.timestamp in the contract
      const latestBlock = await ethers.provider.getBlock("latest");
      subjectIntentTimestamp = BigNumber.from(latestBlock.timestamp);
      subjectPayeeDetails = "Amazon";
      subjectFiatCurrency = Currency.USD;
      subjectConversionRate = ether(0.1); // 1 USDC = 0.1 USD (so we need 0.1 USD payment)
      subjectData = ethers.utils.defaultAbiCoder.encode(["address"], [reclaimAttestor]);
    });

    async function subject(): Promise<any> {
      return await verifier.connect(subjectCaller.wallet).verifyPayment({
        paymentProof: subjectPaymentProof,
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
      return await verifier.connect(subjectCaller.wallet).callStatic.verifyPayment({
        paymentProof: subjectPaymentProof,
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

      const nullifier = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("6884d0cc-17c5-a974-90ca-a77d3980fcaf"));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    it("should emit RevolutPaymentVerified event", async () => {
      const tx = await subject();
      const receipt = await tx.wait();
      
      const event = receipt.events?.find((e: any) => e.event === "RevolutPaymentVerified");
      expect(event).to.not.be.undefined;
      expect(event?.args?.transactionId).to.eq("6884d0cc-17c5-a974-90ca-a77d3980fcaf");
      expect(event?.args?.recipient).to.eq("Amazon");
    });

    describe("when the amount doesn't match", async () => {
      beforeEach(async () => {
        // Keep conversion rate but increase intent amount
        // 2 USDC * 0.1 = 0.2 USD required, but payment is only 0.1 USD  
        subjectIntentAmount = usdc(2);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Amount mismatch");
      });
    });

    describe("when the recipient doesn't match", async () => {
      beforeEach(async () => {
        subjectPayeeDetails = "WrongRecipient";
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Recipient mismatch");
      });
    });

    describe("when the currency is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = ZERO_BYTES32; // Unsupported currency
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Unsupported currency");
      });
    });

    describe("when the transaction is not completed", async () => {
      beforeEach(async () => {
        // Modify the extracted parameters to have "pending" state
        const extractedParameters = ethers.utils.defaultAbiCoder.encode(
          ["string", "string", "string", "string", "string"],
          ["6884d0cc-17c5-a974-90ca-a77d3980fcaf", "pending", "-0.1", "2025-07-26T12:57:48.085855Z", "Amazon"]
        );

        const claimData = ethers.utils.defaultAbiCoder.encode(
          ["string", "string", "string"],
          [revolutApiProof.claim.provider, revolutApiProof.claim.parameters, revolutApiProof.claim.context]
        );
        
        const signatures = ethers.utils.defaultAbiCoder.encode(
          ["address", "bytes", "bytes"],
          [revolutApiProof.signatures.attestorAddress, revolutApiProof.signatures.claimSignature, revolutApiProof.signatures.resultSignature]
        );

        subjectPaymentProof = ethers.utils.defaultAbiCoder.encode(
          ["bytes", "bytes", "bytes"],
          [claimData, signatures, extractedParameters]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment not completed");
      });
    });

    describe("when the payment has already been verified", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Nullifier already exists");
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

    describe("when the timestamp is too old", async () => {
      beforeEach(async () => {
        // Set intent timestamp to far in the past (beyond 1 hour buffer from current block timestamp)
        const latestBlock = await ethers.provider.getBlock("latest");
        subjectIntentTimestamp = BigNumber.from(latestBlock.timestamp - 7200); // 2 hours ago
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid timestamp");
      });
    });
  });
});