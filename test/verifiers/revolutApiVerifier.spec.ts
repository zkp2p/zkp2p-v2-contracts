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

// Revolut Business API proof format from working test - updated with new transaction
const revolutApiProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"method\":\"GET\",\"url\":\"https://b2b.revolut.com/api/1.0/transactions\",\"headers\":{\"Authorization\":\"Bearer YOUR_TOKEN\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<transaction_id>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>-?[0-9\\.]+)\"},{\"type\":\"regex\",\"value\":\"\\\"created_at\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"description\\\":\\\"To (?<recipient>[^\\\"]+)\\\"\"}]}",
    "context": "{\"extractedParameters\":{\"amount\":\"-0.1\",\"date\":\"2025-07-28T11:23:17.309867Z\",\"recipient\":\"10ecf84e-0dc5-4371-ac99-593cfd427b1c\",\"state\":\"completed\",\"transaction_id\":\"68875da5-f2d9-ac4f-9063-51e33a1b8906\"},\"providerHash\":\"0x1234567890abcdef1234567890abcdef12345678\"}"
  },
  "signatures": {
    "attestorAddress": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
    "claimSignature": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef01",
    "resultSignature": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456789001"
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
        ["68875da5-f2d9-ac4f-9063-51e33a1b8906", "completed", "-0.1", "2025-07-28T11:23:17.309867Z", "10ecf84e-0dc5-4371-ac99-593cfd427b1c"]
      );

      subjectPaymentProof = ethers.utils.defaultAbiCoder.encode(
        ["bytes", "bytes", "bytes"],
        [claimData, signatures, extractedParameters]
      );

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(0.1); // 0.1 USDC 
      // Use current block timestamp for intent timestamp since we're using block.timestamp in the contract
      const latestBlock = await ethers.provider.getBlock("latest");
      subjectIntentTimestamp = BigNumber.from(latestBlock.timestamp);
      subjectPayeeDetails = "10ecf84e-0dc5-4371-ac99-593cfd427b1c";
      subjectFiatCurrency = Currency.GBP;
      subjectConversionRate = ether(1.0); // 1 USDC = 1.0 GBP (so we need 0.1 GBP payment for 0.1 USDC)
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

      const nullifier = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("68875da5-f2d9-ac4f-9063-51e33a1b8906"));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    it("should emit RevolutPaymentVerified event", async () => {
      const tx = await subject();
      const receipt = await tx.wait();
      
      const event = receipt.events?.find((e: any) => e.event === "RevolutPaymentVerified");
      expect(event).to.not.be.undefined;
      expect(event?.args?.transactionId).to.eq("68875da5-f2d9-ac4f-9063-51e33a1b8906");
      expect(event?.args?.recipient).to.eq("10ecf84e-0dc5-4371-ac99-593cfd427b1c");
    });

    describe("when the amount doesn't match", async () => {
      beforeEach(async () => {
        // Keep conversion rate but increase intent amount
        // 0.2 USDC * 1.0 = 0.2 GBP required, but payment is only 0.1 GBP  
        subjectIntentAmount = usdc(0.2);
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
          ["68875da5-f2d9-ac4f-9063-51e33a1b8906", "pending", "-0.1", "2025-07-28T11:23:17.309867Z", "10ecf84e-0dc5-4371-ac99-593cfd427b1c"]
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


    describe("when testing amount precision", async () => {
      describe("when the payment amount equals intent amount exactly", async () => {
        beforeEach(async () => {
          // 0.1 USDC * 1.0 = 0.1 GBP (exact match with real transaction)
          subjectConversionRate = ether(1.0);
          subjectIntentAmount = usdc(0.1);
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });

      describe("when the payment amount is slightly more than required", async () => {
        beforeEach(async () => {
          // 0.099 USDC * 1.0 = 0.099 GBP, but payment is 0.1 GBP (acceptable overpayment)
          subjectConversionRate = ether(1.0);
          subjectIntentAmount = usdc(0.099);
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });

      describe("when testing decimal amounts with real transaction", async () => {
        beforeEach(async () => {
          // Use the actual -0.1 GBP from real transaction with matching conversion
          subjectConversionRate = ether(1.0); // 1 USDC = 1.0 GBP equivalent  
          subjectIntentAmount = usdc(0.1); // 0.1 USDC * 1.0 = 0.1 GBP payment required
        });

        it("should handle decimal amounts correctly with real transaction data", async () => {
          const [verified, intentHash] = await subjectCallStatic();
          expect(verified).to.be.true;
          expect(intentHash).to.not.eq(ZERO_BYTES32);
        });
      });
    });

    describe("when testing timestamp validation edge cases", async () => {
      describe("when payment is exactly at buffer limit (past)", async () => {
        beforeEach(async () => {
          const latestBlock = await ethers.provider.getBlock("latest");
          // Set intent timestamp exactly 1 hour (3600 seconds) after current block timestamp
          subjectIntentTimestamp = BigNumber.from(latestBlock.timestamp + 3600);
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });

      describe("when payment is exactly at buffer limit (future)", async () => {
        beforeEach(async () => {
          const latestBlock = await ethers.provider.getBlock("latest");
          // Set intent timestamp exactly 1 hour (3600 seconds) before current block timestamp  
          subjectIntentTimestamp = BigNumber.from(latestBlock.timestamp - 3600);
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });

      describe("when payment is just beyond buffer limit", async () => {
        beforeEach(async () => {
          const latestBlock = await ethers.provider.getBlock("latest");
          // Set intent timestamp just beyond 1 hour buffer
          subjectIntentTimestamp = BigNumber.from(latestBlock.timestamp + 3601);
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Invalid timestamp");
        });
      });
    });

    describe("when testing proof structure validation", async () => {
      describe("when the proof data is malformed", async () => {
        beforeEach(async () => {
          // Invalid proof structure
          subjectPaymentProof = "0x1234";
        });

        it("should revert", async () => {
          await expect(subject()).to.be.reverted;
        });
      });

      describe("when extracted parameters are invalid", async () => {
        beforeEach(async () => {
          // Invalid extracted parameters (missing fields)
          const extractedParameters = ethers.utils.defaultAbiCoder.encode(
            ["string", "string"],
            ["68875da5-f2d9-ac4f-9063-51e33a1b8906", "completed"]
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
          await expect(subject()).to.be.reverted;
        });
      });
    });
  });
});