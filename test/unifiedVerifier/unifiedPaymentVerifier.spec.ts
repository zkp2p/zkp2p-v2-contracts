import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { Address } from "@utils/types";
import { Account } from "@utils/test/types";
import { UnifiedPaymentVerifier, WitnessAttestationVerifier, NullifierRegistry, USDCMock } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { Blockchain, usdc, ether } from "@utils/common";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

describe.only("UnifiedPaymentVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let witness1: Account;
  let witness2: Account;
  let witness3: Account;

  let nullifierRegistry: NullifierRegistry;
  let attestationVerifier: WitnessAttestationVerifier;
  let verifier: UnifiedPaymentVerifier;
  let usdcToken: USDCMock;

  let deployer: DeployHelper;
  let blockchain: Blockchain;

  const minWitnessSignatures = 1;
  const venmoPaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("venmo"));
  const usdCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("USD"));
  const eurCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EUR"));
  const gbpCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GBP"));

  // Sample payment data based on provided proof
  const samplePaymentDetails = {
    processorProviderHash: "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8",
    signatures: [] as BytesLike[], // Will be populated in tests
    paymentMethod: "venmo",
    intentHash: "11114168264614898234767045087100892814911930784849242636571146569793237988689",
    receiverId: "0xfb8364bbcc515c51ba6584b91d781a2b787ca30bfcde8fc2552654633276fe03",
    amount: 49980, // $499.80 in cents
    timestamp: 1753762763000, // milliseconds
    paymentId: "4386986668001199384",
    currency: "USD"
  };

  beforeEach(async () => {
    [
      owner,
      attacker,
      escrow,
      witness1,
      witness2,
      witness3
    ] = await getAccounts();

    blockchain = new Blockchain(ethers.provider);

    deployer = new DeployHelper(owner.wallet);
    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    nullifierRegistry = await deployer.deployNullifierRegistry();
    attestationVerifier = await deployer.deployWitnessAttestationVerifier(
      BigNumber.from(minWitnessSignatures)
    );
    verifier = await deployer.deployUnifiedPaymentVerifier(
      escrow.address,
      nullifierRegistry.address,
      attestationVerifier.address
    );

    await nullifierRegistry.connect(owner.wallet).addWritePermission(verifier.address);

    // Add venmo payment method with processor hash and USD currency
    await verifier.connect(owner.wallet).addPaymentMethod(
      venmoPaymentMethodHash,
      BigNumber.from(30000), // 30 second timestamp buffer (in milliseconds)
      [samplePaymentDetails.processorProviderHash],
      [usdCurrencyHash]
    );
  });

  describe("#constructor", async () => {
    it("should set the correct state", async () => {
      const escrowAddress = await verifier.escrow();
      const nullifierRegistryAddress = await verifier.nullifierRegistry();
      const attestationVerifierAddress = await verifier.attestationVerifier();

      expect(escrowAddress).to.eq(escrow.address);
      expect(nullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(attestationVerifierAddress).to.eq(attestationVerifier.address);
    });
  });

  describe("#verifyPayment", async () => {
    let subjectCaller: Account;
    let subjectProof: BytesLike;
    let subjectDepositToken: Address;
    let subjectIntentAmount: BigNumber;
    let subjectIntentTimestamp: BigNumber;
    let subjectConversionRate: BigNumber;
    let subjectPayeeDetails: string;
    let subjectFiatCurrency: BytesLike;
    let subjectDepositData: BytesLike;
    let subjectData: BytesLike;

    let witnesses: Address[];

    // EIP-712 Domain and Types
    const domain = {
      name: 'UnifiedPaymentVerifier',
      version: '1',
      chainId: 31337, // Hardhat default chainId
      verifyingContract: '' // Will be set to verifier.address
    };

    const types = {
      PaymentDetails: [
        { name: 'processorProviderHash', type: 'bytes32' },
        { name: 'paymentMethod', type: 'string' },
        { name: 'intentHash', type: 'uint256' },
        { name: 'receiverId', type: 'bytes32' },
        { name: 'amount', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'paymentId', type: 'string' },
        { name: 'currency', type: 'string' }
      ]
    };

    // Helper function to sign payment details using EIP-712
    async function signPaymentDetails(signer: any, paymentDetails: any): Promise<string> {
      const value = {
        processorProviderHash: paymentDetails.processorProviderHash,
        paymentMethod: paymentDetails.paymentMethod,
        intentHash: paymentDetails.intentHash,
        receiverId: paymentDetails.receiverId,
        amount: paymentDetails.amount,
        timestamp: paymentDetails.timestamp,
        paymentId: paymentDetails.paymentId,
        currency: paymentDetails.currency
      };
      return await signer._signTypedData(domain, types, value);
    }

    beforeEach(async () => {
      // Set the verifying contract in domain
      domain.verifyingContract = verifier.address;

      // Set up payee details and update receiverId to match
      const testPayeeDetails = "test_payee_id";
      const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

      // Create updated payment details with correct receiverId
      const updatedSamplePaymentDetails = {
        ...samplePaymentDetails,
        receiverId: hashedPayeeDetails
      };

      // Use the specific witness address (first Hardhat account)
      const hardhatWitness = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      witnesses = [hardhatWitness];

      // Create witness signature using EIP-712
      const signature = await signPaymentDetails(owner.wallet, updatedSamplePaymentDetails);

      // Create payment details with signature
      const paymentDetailsWithSignatures = {
        ...updatedSamplePaymentDetails,
        signatures: [signature]
      };

      subjectProof = ethers.utils.defaultAbiCoder.encode(
        ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
        [[
          paymentDetailsWithSignatures.processorProviderHash,
          paymentDetailsWithSignatures.signatures,
          paymentDetailsWithSignatures.paymentMethod,
          paymentDetailsWithSignatures.intentHash,
          paymentDetailsWithSignatures.receiverId,
          paymentDetailsWithSignatures.amount,
          paymentDetailsWithSignatures.timestamp,
          paymentDetailsWithSignatures.paymentId,
          paymentDetailsWithSignatures.currency
        ]]
      );

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(500); // Intent for $500
      subjectIntentTimestamp = BigNumber.from(samplePaymentDetails.timestamp - 100000); // Intent created 100 seconds before payment (in milliseconds)
      subjectConversionRate = ether(1); // 1:1 USD to USDC
      subjectPayeeDetails = testPayeeDetails;
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
        payeeDetails: subjectPayeeDetails,
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
        payeeDetails: subjectPayeeDetails,
        fiatCurrency: subjectFiatCurrency,
        conversionRate: subjectConversionRate,
        data: subjectData,
        depositData: subjectDepositData
      });
    }

    it("should verify the proof successfully", async () => {
      const result = await subjectCallStatic();

      expect(result.success).to.be.true;
      expect(result.intentHash).to.eq(BigNumber.from(samplePaymentDetails.intentHash).toHexString());
      expect(result.releaseAmount).to.eq(samplePaymentDetails.amount); // With 1:1 conversion
      expect(result.paymentCurrency).to.eq(Currency.USD);
      expect(result.paymentId).to.eq(samplePaymentDetails.paymentId);
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(samplePaymentDetails.paymentId));
      expect(await nullifierRegistry.isNullified(nullifier)).to.be.true;
    });

    describe("when payment amount is less than intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(600); // Intent for $600 but payment is only $499.80
      });

      it("should succeed with partial release", async () => {
        const result = await subjectCallStatic();

        expect(result.success).to.be.true;
        expect(result.releaseAmount).to.eq(samplePaymentDetails.amount); // 49980 cents
      });
    });

    describe("when there are 2 witnesses but only 1 signature", () => {
      beforeEach(async () => {
        // Use two witness addresses including the hardhat witness
        const hardhatWitness = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        witnesses = [hardhatWitness, witness1.address];

        // Update deposit data with 2 witnesses but still only 1 signature
        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [witnesses]
        );
      });

      it("should succeed with minimum threshold met", async () => {
        const result = await subjectCallStatic();
        expect(result.success).to.be.true;
      });
    });

    describe("when using 3 signatures from 3 witnesses", async () => {
      beforeEach(async () => {
        // Update to require 3 signatures
        await attestationVerifier.connect(owner.wallet).setMinWitnessSignatures(3);

        // Use hardhat witness and two other witnesses
        const hardhatWitness = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        witnesses = [hardhatWitness, witness1.address, witness2.address];

        // Need to recreate message with correct receiverId
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsForThree = {
          ...samplePaymentDetails,
          receiverId: hashedPayeeDetails
        };

        // Sign with EIP-712
        const signature1 = await signPaymentDetails(owner.wallet, paymentDetailsForThree);
        const signature2 = await signPaymentDetails(witness1.wallet, paymentDetailsForThree);
        const signature3 = await signPaymentDetails(witness2.wallet, paymentDetailsForThree);

        const paymentDetailsWithThreeSignatures = {
          ...paymentDetailsForThree,
          signatures: [signature1, signature2, signature3]
        };

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithThreeSignatures.processorProviderHash,
            paymentDetailsWithThreeSignatures.signatures,
            paymentDetailsWithThreeSignatures.paymentMethod,
            paymentDetailsWithThreeSignatures.intentHash,
            paymentDetailsWithThreeSignatures.receiverId,
            paymentDetailsWithThreeSignatures.amount,
            paymentDetailsWithThreeSignatures.timestamp,
            paymentDetailsWithThreeSignatures.paymentId,
            paymentDetailsWithThreeSignatures.currency
          ]]
        );

        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [witnesses]
        );

        subjectPayeeDetails = testPayeeDetails;
      });

      it("should verify successfully", async () => {
        const result = await subjectCallStatic();
        expect(result.success).to.be.true;
      });
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsWithInvalidMethod = {
          ...samplePaymentDetails,
          paymentMethod: "nonexistent",
          receiverId: hashedPayeeDetails
        };

        // Sign with EIP-712
        const signature = await signPaymentDetails(owner.wallet, paymentDetailsWithInvalidMethod);

        paymentDetailsWithInvalidMethod.signatures = [signature];

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithInvalidMethod.processorProviderHash,
            paymentDetailsWithInvalidMethod.signatures,
            paymentDetailsWithInvalidMethod.paymentMethod,
            paymentDetailsWithInvalidMethod.intentHash,
            paymentDetailsWithInvalidMethod.receiverId,
            paymentDetailsWithInvalidMethod.amount,
            paymentDetailsWithInvalidMethod.timestamp,
            paymentDetailsWithInvalidMethod.paymentId,
            paymentDetailsWithInvalidMethod.currency
          ]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UnifiedPaymentVerifier: Payment method does not exist");
      });
    });

    describe("when processor hash is not authorized", async () => {
      beforeEach(async () => {
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsWithInvalidProcessor = {
          ...samplePaymentDetails,
          processorProviderHash: "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9", // Different hash
          receiverId: hashedPayeeDetails
        };

        // Sign with EIP-712
        const signature = await signPaymentDetails(owner.wallet, paymentDetailsWithInvalidProcessor);

        paymentDetailsWithInvalidProcessor.signatures = [signature];

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithInvalidProcessor.processorProviderHash,
            paymentDetailsWithInvalidProcessor.signatures,
            paymentDetailsWithInvalidProcessor.paymentMethod,
            paymentDetailsWithInvalidProcessor.intentHash,
            paymentDetailsWithInvalidProcessor.receiverId,
            paymentDetailsWithInvalidProcessor.amount,
            paymentDetailsWithInvalidProcessor.timestamp,
            paymentDetailsWithInvalidProcessor.paymentId,
            paymentDetailsWithInvalidProcessor.currency
          ]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UnifiedPaymentVerifier: Unauthorized processor for payment method");
      });
    });

    describe("when not enough witness signatures provided", () => {
      beforeEach(async () => {
        // Update to require 2 signatures
        await attestationVerifier.connect(owner.wallet).setMinWitnessSignatures(2);

        // Use two witness addresses
        const hardhatWitness = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        witnesses = [hardhatWitness, witness1.address];

        // Provide only 1 signature when 2 are required (still using the existing signature)

        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [witnesses]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold exceeds signatures");
      });
    });

    describe("when witness signature is invalid", async () => {
      beforeEach(async () => {
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsWithInvalidSignature = {
          ...samplePaymentDetails,
          receiverId: hashedPayeeDetails,
          signatures: ["0x" + "00".repeat(65)] // Invalid signature
        };

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithInvalidSignature.processorProviderHash,
            paymentDetailsWithInvalidSignature.signatures,
            paymentDetailsWithInvalidSignature.paymentMethod,
            paymentDetailsWithInvalidSignature.intentHash,
            paymentDetailsWithInvalidSignature.receiverId,
            paymentDetailsWithInvalidSignature.amount,
            paymentDetailsWithInvalidSignature.timestamp,
            paymentDetailsWithInvalidSignature.paymentId,
            paymentDetailsWithInvalidSignature.currency
          ]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: Not enough valid witness signatures");
      });
    });

    describe("when payee details don't match", async () => {
      beforeEach(async () => {
        subjectPayeeDetails = "different_payee_id";
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UnifiedPaymentVerifier: Payee mismatch");
      });
    });

    describe("when currency doesn't match fiat currency", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.EUR; // Different from USD in payment details
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UnifiedPaymentVerifier: Currency mismatch");
      });
    });

    describe("when currency is not supported for payment method", async () => {
      beforeEach(async () => {
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsWithUnsupportedCurrency = {
          ...samplePaymentDetails,
          receiverId: hashedPayeeDetails,
          currency: "EUR" // EUR not added to venmo payment method
        };

        // Sign with EIP-712
        const signature = await signPaymentDetails(owner.wallet, paymentDetailsWithUnsupportedCurrency);

        paymentDetailsWithUnsupportedCurrency.signatures = [signature];

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithUnsupportedCurrency.processorProviderHash,
            paymentDetailsWithUnsupportedCurrency.signatures,
            paymentDetailsWithUnsupportedCurrency.paymentMethod,
            paymentDetailsWithUnsupportedCurrency.intentHash,
            paymentDetailsWithUnsupportedCurrency.receiverId,
            paymentDetailsWithUnsupportedCurrency.amount,
            paymentDetailsWithUnsupportedCurrency.timestamp,
            paymentDetailsWithUnsupportedCurrency.paymentId,
            paymentDetailsWithUnsupportedCurrency.currency
          ]]
        );

        subjectFiatCurrency = Currency.EUR;
        subjectPayeeDetails = testPayeeDetails; // Ensure payee matches
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UnifiedPaymentVerifier: Currency not supported for payment method");
      });
    });

    describe("when payment was made before intent", async () => {
      beforeEach(async () => {
        // Intent timestamp is after payment timestamp + buffer
        // Payment timestamp is 1753762763000 ms
        // Timestamp buffer is 30000 ms (30 seconds)
        // Intent timestamp needs to be after payment + buffer
        subjectIntentTimestamp = BigNumber.from(samplePaymentDetails.timestamp + 31000); // Intent created 31 seconds after payment
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UnifiedPaymentVerifier: Payment before intent");
      });
    });

    describe("when release amount exceeds intent amount", async () => {
      beforeEach(async () => {
        // Payment is 49980 cents, so set intent to something smaller to trigger the error
        subjectIntentAmount = BigNumber.from(40000); // Intent for 40000 units, but payment releases 49980
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UnifiedPaymentVerifier: Release amount exceeds intent");
      });
    });

    describe("when payment has already been verified", async () => {
      beforeEach(async () => {
        await subject(); // First verification
      });

      it("should revert on second verification", async () => {
        await expect(subject()).to.be.revertedWith("Nullifier has already been used");
      });
    });

    describe("when caller is not escrow", async () => {
      beforeEach(async () => {
        subjectCaller = owner;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Only escrow can call");
      });
    });

    describe("when no witnesses provided", async () => {
      beforeEach(async () => {
        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold exceeds witnesses");
      });
    });

    describe("when duplicate witnesses provided", async () => {
      beforeEach(async () => {
        // Use owner.address and witness1.address as duplicate witness
        // This tests that the system properly handles duplicate witness addresses
        witnesses = [owner.address, owner.address, witness1.address]; // Duplicate owner

        // Need to recreate message with correct receiverId
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsForTest = {
          ...samplePaymentDetails,
          receiverId: hashedPayeeDetails
        };

        // Get signatures from owner and witness1 using EIP-712
        // Even though owner appears twice in witnesses, only one signature counts
        const signature1 = await signPaymentDetails(owner.wallet, paymentDetailsForTest);
        const signature2 = await signPaymentDetails(witness1.wallet, paymentDetailsForTest);

        const paymentDetailsWithSignatures = {
          ...paymentDetailsForTest,
          signatures: [signature1, signature2]
        };

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithSignatures.processorProviderHash,
            paymentDetailsWithSignatures.signatures,
            paymentDetailsWithSignatures.paymentMethod,
            paymentDetailsWithSignatures.intentHash,
            paymentDetailsWithSignatures.receiverId,
            paymentDetailsWithSignatures.amount,
            paymentDetailsWithSignatures.timestamp,
            paymentDetailsWithSignatures.paymentId,
            paymentDetailsWithSignatures.currency
          ]]
        );

        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [witnesses]
        );

        subjectPayeeDetails = testPayeeDetails;
      });

      it("should succeed with duplicate witnesses", async () => {
        // Duplicate witnesses are allowed - the system handles them correctly
        // by counting unique valid signatures
        const result = await subjectCallStatic();
        expect(result.success).to.be.true;
      });
    });

    describe("when minWitnessSignatures exceeds number of witnesses", async () => {
      beforeEach(async () => {
        // Set minWitnessSignatures to 3
        await attestationVerifier.connect(owner.wallet).setMinWitnessSignatures(3);

        // But only provide 2 witnesses
        const hardhatWitness = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        witnesses = [hardhatWitness, witness1.address];

        // Need to recreate message with correct receiverId
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsForTest = {
          ...samplePaymentDetails,
          receiverId: hashedPayeeDetails
        };

        // Get 3 signatures (even though we only have 2 witnesses) using EIP-712
        const signature1 = await signPaymentDetails(owner.wallet, paymentDetailsForTest);
        const signature2 = await signPaymentDetails(witness1.wallet, paymentDetailsForTest);
        const signature3 = await signPaymentDetails(witness2.wallet, paymentDetailsForTest);

        const paymentDetailsWithSignatures = {
          ...paymentDetailsForTest,
          signatures: [signature1, signature2, signature3]
        };

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithSignatures.processorProviderHash,
            paymentDetailsWithSignatures.signatures,
            paymentDetailsWithSignatures.paymentMethod,
            paymentDetailsWithSignatures.intentHash,
            paymentDetailsWithSignatures.receiverId,
            paymentDetailsWithSignatures.amount,
            paymentDetailsWithSignatures.timestamp,
            paymentDetailsWithSignatures.paymentId,
            paymentDetailsWithSignatures.currency
          ]]
        );

        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [witnesses]
        );

        subjectPayeeDetails = testPayeeDetails;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold exceeds witnesses");
      });
    });


    describe("when same witness signs multiple times", async () => {
      beforeEach(async () => {
        // Use only 2 witnesses but require 3 signatures
        const hardhatWitness = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        witnesses = [hardhatWitness, witness1.address];

        // Set minWitnessSignatures to 3
        await attestationVerifier.connect(owner.wallet).setMinWitnessSignatures(3);

        // Need to recreate message with correct receiverId
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsForTest = {
          ...samplePaymentDetails,
          receiverId: hashedPayeeDetails
        };

        // Get signatures from only 2 witnesses using EIP-712
        const signature1 = await signPaymentDetails(owner.wallet, paymentDetailsForTest);
        const signature2 = await signPaymentDetails(witness1.wallet, paymentDetailsForTest);

        // Include duplicate signatures to try to meet threshold of 3 (won't work because only 2 unique witnesses)
        const paymentDetailsWithSignatures = {
          ...paymentDetailsForTest,
          signatures: [signature1, signature2, signature1, signature2] // Both signatures duplicated
        };

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithSignatures.processorProviderHash,
            paymentDetailsWithSignatures.signatures,
            paymentDetailsWithSignatures.paymentMethod,
            paymentDetailsWithSignatures.intentHash,
            paymentDetailsWithSignatures.receiverId,
            paymentDetailsWithSignatures.amount,
            paymentDetailsWithSignatures.timestamp,
            paymentDetailsWithSignatures.paymentId,
            paymentDetailsWithSignatures.currency
          ]]
        );

        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [witnesses]
        );

        subjectPayeeDetails = testPayeeDetails;
      });

      it("should revert when duplicate signatures are provided", async () => {
        await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold exceeds witnesses");
      });
    });

    describe("when valid signatures don't meet threshold", async () => {
      beforeEach(async () => {
        // Set minWitnessSignatures to 3
        await attestationVerifier.connect(owner.wallet).setMinWitnessSignatures(3);

        // Provide 3 witnesses
        const hardhatWitness = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        witnesses = [hardhatWitness, witness1.address, witness2.address];

        // Need to recreate message with correct receiverId
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsForTest = {
          ...samplePaymentDetails,
          receiverId: hashedPayeeDetails
        };

        // Only get 2 valid signatures (when 3 are required) using EIP-712
        const signature1 = await signPaymentDetails(owner.wallet, paymentDetailsForTest);
        const signature2 = await signPaymentDetails(witness1.wallet, paymentDetailsForTest);

        const paymentDetailsWithSignatures = {
          ...paymentDetailsForTest,
          signatures: [signature1, signature2] // Only 2 signatures when 3 are required
        };

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithSignatures.processorProviderHash,
            paymentDetailsWithSignatures.signatures,
            paymentDetailsWithSignatures.paymentMethod,
            paymentDetailsWithSignatures.intentHash,
            paymentDetailsWithSignatures.receiverId,
            paymentDetailsWithSignatures.amount,
            paymentDetailsWithSignatures.timestamp,
            paymentDetailsWithSignatures.paymentId,
            paymentDetailsWithSignatures.currency
          ]]
        );

        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [witnesses]
        );

        subjectPayeeDetails = testPayeeDetails;
      });

      it("should revert with not enough signatures error", async () => {
        await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: req threshold exceeds signatures");
      });
    });

    describe("when exactly meeting threshold without early exit", async () => {
      beforeEach(async () => {
        // Set minWitnessSignatures to 2
        await attestationVerifier.connect(owner.wallet).setMinWitnessSignatures(2);

        // Provide exactly 2 witnesses
        const hardhatWitness = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        witnesses = [hardhatWitness, witness1.address];

        // Need to recreate message with correct receiverId
        const testPayeeDetails = "test_payee_id";
        const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));

        const paymentDetailsForTest = {
          ...samplePaymentDetails,
          receiverId: hashedPayeeDetails
        };

        // Get exactly 2 valid signatures using EIP-712
        const signature1 = await signPaymentDetails(owner.wallet, paymentDetailsForTest);
        const signature2 = await signPaymentDetails(witness1.wallet, paymentDetailsForTest);

        const paymentDetailsWithSignatures = {
          ...paymentDetailsForTest,
          signatures: [signature1, signature2] // Exactly 2 signatures to meet threshold
        };

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,bytes[],string,uint256,bytes32,uint256,uint256,string,string)"],
          [[
            paymentDetailsWithSignatures.processorProviderHash,
            paymentDetailsWithSignatures.signatures,
            paymentDetailsWithSignatures.paymentMethod,
            paymentDetailsWithSignatures.intentHash,
            paymentDetailsWithSignatures.receiverId,
            paymentDetailsWithSignatures.amount,
            paymentDetailsWithSignatures.timestamp,
            paymentDetailsWithSignatures.paymentId,
            paymentDetailsWithSignatures.currency
          ]]
        );

        subjectDepositData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [witnesses]
        );

        subjectPayeeDetails = testPayeeDetails;
      });

      it("should succeed by meeting exact threshold", async () => {
        const result = await subjectCallStatic();
        expect(result.success).to.be.true;
      });
    });

    describe("integration with different conversion rates", async () => {
      describe("when conversion rate makes release amount smaller", async () => {
        beforeEach(async () => {
          subjectConversionRate = ether(2); // 1 USD = 2 USDC, so release amount will be halved
        });

        it("should calculate correct release amount", async () => {
          const result = await subjectCallStatic();
          const expectedReleaseAmount = BigNumber.from(samplePaymentDetails.amount).mul(ether(1)).div(ether(2));

          expect(result.releaseAmount).to.eq(expectedReleaseAmount);
        });
      });

      describe("when conversion rate makes release amount larger", async () => {
        beforeEach(async () => {
          subjectConversionRate = ether(0.5); // 1 USD = 0.5 USDC, so release amount will be doubled
          subjectIntentAmount = usdc(1000); // Increase intent to accommodate larger release
        });

        it("should calculate correct release amount", async () => {
          const result = await subjectCallStatic();
          const expectedReleaseAmount = BigNumber.from(samplePaymentDetails.amount).mul(ether(1)).div(ether(0.5));

          expect(result.releaseAmount).to.eq(expectedReleaseAmount);
        });
      });
    });
  });

  describe("multi-payment method support", async () => {
    const paypalPaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("paypal"));

    beforeEach(async () => {
      // Add PayPal with different configuration
      await verifier.connect(owner.wallet).addPaymentMethod(
        paypalPaymentMethodHash,
        BigNumber.from(60000), // 60 second timestamp buffer for PayPal
        ["0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"], // Different processor
        [usdCurrencyHash, eurCurrencyHash, gbpCurrencyHash] // Multiple currencies
      );
    });

    it("should support different payment methods with different configurations", async () => {
      // Check Venmo configuration
      const venmoProcessors = await verifier.getProcessorHashes(venmoPaymentMethodHash);
      const venmoCurrencies = await verifier.getCurrencies(venmoPaymentMethodHash);
      const venmoTimestampBuffer = await verifier.getTimestampBuffer(venmoPaymentMethodHash);

      expect(venmoProcessors.length).to.eq(1);
      expect(venmoCurrencies.length).to.eq(1);
      expect(venmoTimestampBuffer).to.eq(30000);

      // Check PayPal configuration
      const paypalProcessors = await verifier.getProcessorHashes(paypalPaymentMethodHash);
      const paypalCurrencies = await verifier.getCurrencies(paypalPaymentMethodHash);
      const paypalTimestampBuffer = await verifier.getTimestampBuffer(paypalPaymentMethodHash);

      expect(paypalProcessors.length).to.eq(1);
      expect(paypalCurrencies.length).to.eq(3);
      expect(paypalTimestampBuffer).to.eq(60000);
    });
  });
});