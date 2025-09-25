import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { Address } from "@utils/types";
import { Account } from "@utils/test/types";
import { UnifiedPaymentVerifier, SimpleAttestationVerifier, NullifierRegistry, USDCMock } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { Blockchain, usdc, ether } from "@utils/common";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";
import { createAttestation, encodePaymentDetails, signPaymentDetails } from "@utils/unifiedVerifierUtils";
import { PaymentDetails } from "@utils/unifiedVerifierUtils";

const expect = getWaffleExpect();


describe("UnifiedPaymentVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let orchestrator: Account;
  let witness1: Account;

  let nullifierRegistry: NullifierRegistry;
  let attestationVerifier: SimpleAttestationVerifier;
  let zktlsAttestor: Account;
  let verifier: UnifiedPaymentVerifier;
  let usdcToken: USDCMock;

  let deployer: DeployHelper;
  let blockchain: Blockchain;

  let venmoPaymentMethodHash: BytesLike;
  let venmoProviderHash: BytesLike;

  beforeEach(async () => {
    [
      owner,
      attacker,
      orchestrator,
      witness1,
      zktlsAttestor
    ] = await getAccounts();

    blockchain = new Blockchain(ethers.provider);

    deployer = new DeployHelper(owner.wallet);
    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    venmoPaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("venmo"));
    venmoProviderHash = "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8";

    nullifierRegistry = await deployer.deployNullifierRegistry();
    attestationVerifier = await deployer.deploySimpleAttestationVerifier(
      witness1.address,
      zktlsAttestor.address
    );
    verifier = await deployer.deployUnifiedPaymentVerifier(
      orchestrator.address,
      nullifierRegistry.address,
      attestationVerifier.address
    );

    await nullifierRegistry.connect(owner.wallet).addWritePermission(verifier.address);

    await verifier.connect(owner.wallet).addPaymentMethod(
      venmoPaymentMethodHash,
      BigNumber.from(30000) // 30 second timestamp buffer (in milliseconds)
    );
  });

  describe("#constructor", async () => {
    it("should set the correct state", async () => {
      const orchestratorAddress = await verifier.orchestrator();
      const nullifierRegistryAddress = await verifier.nullifierRegistry();
      const attestationVerifierAddress = await verifier.attestationVerifier();

      expect(orchestratorAddress).to.eq(orchestrator.address);
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

    let paymentDetails: any;

    beforeEach(async () => {
      // Set up the attestation verifier data (zkTLS attestor address)
      // This will be passed to the attestation verifier AND its hash will be stored in dataHash
      const attestationData = ethers.utils.defaultAbiCoder.encode(
        ['address'],
        [zktlsAttestor.address]
      );
      const dataHash = ethers.utils.keccak256(attestationData);

      const testPayeeDetails = "test_payee_id";
      const hashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(testPayeeDetails));
      const paymentId = "4386986668001199384";
      const hashedPaymentId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(paymentId));

      paymentDetails = {
        paymentMethod: venmoPaymentMethodHash,
        providerHash: venmoProviderHash,
        intentHash: "0x18926574de6ca4682ebe5c9b6425295e92962d505da5737185785206584cb551",
        recipientId: hashedPayeeDetails,
        amount: BigNumber.from(49980), // $499.80 in cents
        timestamp: BigNumber.from(1753762763000), // milliseconds
        paymentId: hashedPaymentId,
        currency: Currency.USD,
        dataHash: dataHash
      } as PaymentDetails;

      subjectProof = await createAttestation(
        witness1,
        paymentDetails,
        verifier.address
      );

      subjectCaller = orchestrator;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(500); // Intent for $500
      subjectIntentTimestamp = paymentDetails.timestamp.sub(100000); // Intent created 100 seconds before payment (in milliseconds)
      subjectConversionRate = ether(1); // 1:1 USD to USDC
      subjectPayeeDetails = hashedPayeeDetails;
      subjectFiatCurrency = Currency.USD;
      subjectDepositData = '0x';
      subjectData = attestationData;
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
        depositData: subjectDepositData,
        data: subjectData
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
        depositData: subjectDepositData,
        data: subjectData
      });
    }

    it("should verify the proof successfully", async () => {
      const result = await subjectCallStatic();

      expect(result.success).to.be.true;
      expect(result.intentHash).to.eq(paymentDetails.intentHash);
      expect(result.releaseAmount).to.eq(paymentDetails.amount); // With 1:1 conversion
    });

    it("should nullify the payment with correct collision-resistant nullifier", async () => {
      await subject();

      // Verify the nullifier is calculated as keccak256(abi.encodePacked(paymentMethod, paymentId))
      const expectedNullifier = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes32", "bytes32"],
          [paymentDetails.paymentMethod, paymentDetails.paymentId]
        )
      );

      expect(await nullifierRegistry.isNullified(expectedNullifier)).to.be.true;
    });

    describe("when payment amount is less than intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(600); // Intent for $600 but payment is only $499.80
      });

      it("should succeed with partial release", async () => {
        const result = await subjectCallStatic();

        expect(result.success).to.be.true;
        expect(result.releaseAmount).to.eq(paymentDetails.amount); // 1:1 conversion
      });
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        const invalidPaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("invalid"));
        const paymentDetailsWithInvalidMethod = {
          ...paymentDetails,
          paymentMethod: invalidPaymentMethodHash,
        };

        subjectProof = await createAttestation(
          witness1,
          paymentDetailsWithInvalidMethod,
          verifier.address
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Payment method does not exist");
      });
    });

    // provider hash check removed from contracts

    describe("when witness signature is invalid", async () => {
      beforeEach(async () => {
        const paymentDetailsWithInvalidSignature = {
          ...paymentDetails,
          signatures: ["0x" + "00".repeat(65)] // Invalid signature
        };

        subjectProof = encodePaymentDetails(paymentDetailsWithInvalidSignature);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("ThresholdSigVerifierUtils: Not enough valid witness signatures");
      });
    });

    describe("when payee details don't match", async () => {
      beforeEach(async () => {
        const differentPayeeDetails = "different_payee_id";
        const differentHashedPayeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(differentPayeeDetails));

        subjectPayeeDetails = differentHashedPayeeDetails;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Payee mismatch");
      });
    });

    describe("when currency doesn't match fiat currency", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.EUR; // Different from USD in payment details
      });

      it("should not revert", async () => {
        const result = await subjectCallStatic();

        expect(result.success).to.be.true;
        expect(result.paymentCurrency).to.eq(Currency.USD); // the currency returned in the proof
      });
    });

    describe("when payment was made before intent", async () => {
      beforeEach(async () => {
        // Intent timestamp is after payment timestamp + buffer
        // Payment timestamp is 1753762763000 ms
        // Timestamp buffer is 30000 ms (30 seconds)
        // Intent timestamp needs to be after payment + buffer
        subjectIntentTimestamp = BigNumber.from(paymentDetails.timestamp.toNumber() + 31000); // Intent created 31 seconds after payment
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Payment before intent");
      });
    });

    describe("when release amount exceeds intent amount", async () => {
      beforeEach(async () => {
        // Payment is 49980 cents, so set intent to something smaller to trigger the error
        subjectIntentAmount = BigNumber.from(40000); // Intent for 40000 units, but payment releases 49980
      });

      it("should revert", async () => {
        const result = await subjectCallStatic();

        expect(result.releaseAmount).to.eq(40000); // With 1:1 conversion
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

    describe("when caller is not orchestrator", async () => {
      beforeEach(async () => {
        subjectCaller = owner;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Only orchestrator can call");
      });
    });

    describe("when dataHash doesn't match provided data", async () => {
      beforeEach(async () => {
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address'],
          [attacker.address] // Different address than what was hashed
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Data hash mismatch");
      });
    });

    describe("when attestation verifier returns false", async () => {
      beforeEach(async () => {
        // Use a different zkTLS attestor than what's registered
        const wrongAttestationData = ethers.utils.defaultAbiCoder.encode(
          ['address'],
          [attacker.address] // Not the registered zkTLS attestor
        );
        const dataHash = ethers.utils.keccak256(wrongAttestationData);

        const paymentDetailsWithInvalidDataHash = {
          ...paymentDetails,
          dataHash: dataHash
        };

        subjectData = wrongAttestationData;
        subjectProof = await createAttestation(
          witness1,
          paymentDetailsWithInvalidDataHash,
          verifier.address
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Invalid witness signatures");
      });
    });

    describe("integration with different conversion rates", async () => {
      describe("when conversion rate makes release amount smaller", async () => {
        beforeEach(async () => {
          subjectConversionRate = ether(2); // 1 USD = 2 USDC, so release amount will be halved
        });

        it("should calculate correct release amount", async () => {
          const result = await subjectCallStatic();
          const expectedReleaseAmount = BigNumber.from(paymentDetails.amount).mul(ether(1)).div(ether(2));

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
          const expectedReleaseAmount = BigNumber.from(paymentDetails.amount).mul(ether(1)).div(ether(0.5));

          expect(result.releaseAmount).to.eq(expectedReleaseAmount);
        });
      });
    });
  });
});
