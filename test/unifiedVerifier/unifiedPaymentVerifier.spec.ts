import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { Account } from "@utils/test/types";
import {
  getAccounts,
  getWaffleExpect,
} from "@utils/test/index";
import DeployHelper from "@utils/deploys";
import {
  NullifierRegistry,
  SimpleAttestationVerifier,
  UnifiedPaymentVerifier,
} from "@utils/contracts";
import {
  buildUnifiedPaymentProof,
  BuiltUnifiedPaymentProof,
  BuildPaymentProofOverrides,
  encodeUnifiedPaymentDetails,
} from "@utils/unifiedVerifierUtils";

const expect = getWaffleExpect();

const ZERO_BYTES = "0x";
const ZERO_ADDRESS = ethers.constants.AddressZero;


describe("UnifiedPaymentVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let orchestrator: Account;
  let witness: Account;

  let nullifierRegistry: NullifierRegistry;
  let attestationVerifier: SimpleAttestationVerifier;
  let verifier: UnifiedPaymentVerifier;
  let deployer: DeployHelper;

  let venmoPaymentMethodHash: BytesLike;
  let defaultPayeeId: BytesLike;
  let defaultPaymentId: BytesLike;
  let defaultCurrency: BytesLike;
  let defaultTimestamp: BigNumber;
  let defaultAmount: BigNumber;
  let defaultIntentHash: BytesLike;
  let chainId: number;

  beforeEach(async () => {
    [owner, attacker, orchestrator, witness] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    nullifierRegistry = await deployer.deployNullifierRegistry();
    attestationVerifier = await deployer.deploySimpleAttestationVerifier(witness.address);
    verifier = await deployer.deployUnifiedPaymentVerifier(
      orchestrator.address,
      nullifierRegistry.address,
      attestationVerifier.address,
    );

    await nullifierRegistry.connect(owner.wallet).addWritePermission(verifier.address);

    venmoPaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("venmo"));
    await verifier.connect(owner.wallet).addPaymentMethod(venmoPaymentMethodHash);

    defaultPayeeId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee-123"));
    defaultPaymentId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payment-abc"));
    defaultCurrency = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("USD"));
    defaultTimestamp = BigNumber.from("1753762763000"); // matches legacy fixture
    defaultAmount = BigNumber.from(49980);
    defaultIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent-1"));

    chainId = (await ethers.provider.getNetwork()).chainId;
  });

  describe("#verifyPayment", () => {
    let subjectCaller: Account;
    let subjectProof: BytesLike;
    let subjectDepositToken: string;
    let subjectIntentAmount: BigNumber;
    let subjectIntentTimestamp: BigNumber;
    let subjectPayeeDetails: BytesLike;
    let subjectFiatCurrency: BytesLike;
    let subjectConversionRate: BigNumber;
    let subjectDepositData: BytesLike;
    let subjectData: BytesLike;

    let builtProof: BuiltUnifiedPaymentProof;

    async function buildProof(overrides: BuildPaymentProofOverrides = {}) {
      return await buildUnifiedPaymentProof({
        verifier: verifier.address,
        witness,
        chainId,
        method: venmoPaymentMethodHash,
        payeeId: defaultPayeeId,
        amount: defaultAmount,
        currency: defaultCurrency,
        timestamp: defaultTimestamp,
        paymentId: defaultPaymentId,
        intentHash: defaultIntentHash,
        releaseAmount: defaultAmount,
        metadata: ZERO_BYTES,
        ...overrides,
      });
    }

    beforeEach(async () => {
      builtProof = await buildProof();

      subjectCaller = orchestrator;
      subjectProof = builtProof.paymentProof;
      subjectDepositToken = ZERO_ADDRESS;
      subjectIntentAmount = builtProof.attestation.releaseAmount;
      subjectIntentTimestamp = defaultTimestamp;
      subjectPayeeDetails = builtProof.paymentDetails.payeeId;
      subjectFiatCurrency = builtProof.paymentDetails.currency;
      subjectConversionRate = ethers.utils.parseEther("1");
      subjectDepositData = ZERO_BYTES;
      subjectData = ZERO_BYTES;
    });

    async function subject() {
      return await verifier
        .connect(subjectCaller.wallet)
        .verifyPayment({
          paymentProof: subjectProof,
          depositToken: subjectDepositToken,
          intentAmount: subjectIntentAmount,
          intentTimestamp: subjectIntentTimestamp,
          payeeDetails: subjectPayeeDetails,
          fiatCurrency: subjectFiatCurrency,
          conversionRate: subjectConversionRate,
          depositData: subjectDepositData,
          data: subjectData,
        });
    }

    async function subjectCallStatic() {
      return await verifier
        .connect(subjectCaller.wallet)
        .callStatic.verifyPayment({
          paymentProof: subjectProof,
          depositToken: subjectDepositToken,
          intentAmount: subjectIntentAmount,
          intentTimestamp: subjectIntentTimestamp,
          payeeDetails: subjectPayeeDetails,
          fiatCurrency: subjectFiatCurrency,
          conversionRate: subjectConversionRate,
          depositData: subjectDepositData,
          data: subjectData,
        });
    }

    it("verifies witness signature successfully", async () => {
      const result = await subjectCallStatic();

      expect(result.success).to.be.true;
      expect(result.intentHash).to.eq(builtProof.attestation.intentHash);
      expect(result.releaseAmount).to.eq(builtProof.attestation.releaseAmount);
    });

    it("emits PaymentVerified event", async () => {
      await expect(subject())
        .to.emit(verifier, "PaymentVerified")
        .withArgs(
          builtProof.attestation.intentHash,
          builtProof.paymentDetails.method,
          builtProof.paymentDetails.currency,
          builtProof.paymentDetails.amount,
          builtProof.paymentDetails.timestamp,
          builtProof.paymentDetails.paymentId,
          builtProof.paymentDetails.payeeId,
        );
    });

    it("should nullify the payment with correct collision-resistant nullifier", async () => {
      await subject();

      // Verify the nullifier is calculated as keccak256(abi.encodePacked(paymentMethod, paymentId))
      const expectedNullifier = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes32", "bytes32"],
          [builtProof.paymentDetails.method, builtProof.paymentDetails.paymentId]
        )
      );

      expect(await nullifierRegistry.isNullified(expectedNullifier)).to.be.true;
    });

    describe("when payment method is not registered", async () => {
      beforeEach(async () => {
        const invalidMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("invalid"));
        const tampered = await buildProof({ method: invalidMethod });

        subjectProof = tampered.paymentProof;
        subjectPayeeDetails = tampered.paymentDetails.payeeId;
        subjectFiatCurrency = tampered.paymentDetails.currency;
        subjectIntentAmount = tampered.attestation.releaseAmount;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Invalid payment method");
      });
    });

    describe("when witness signature is not from the configured witness", async () => {
      beforeEach(async () => {
        const tampered = await buildProof({ signer: attacker });
        subjectProof = tampered.paymentProof;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith(
          "ThresholdSigVerifierUtils: Not enough valid witness signatures",
        );
      });
    });

    describe("when attestation verifier returns false", () => {
      beforeEach(async () => {
        const failingFactory = await ethers.getContractFactory("FailingAttestationVerifier", owner.wallet);
        const failingVerifier = await failingFactory.deploy();
        await verifier.connect(owner.wallet).setAttestationVerifier(failingVerifier.address);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Invalid attestation");
      });
    });

    describe("when release amount exceeds intent amount", async () => {
      beforeEach(async () => {
        const largeRelease = builtProof.attestation.releaseAmount.mul(2);
        const boosted = await buildProof({ releaseAmount: largeRelease });

        subjectProof = boosted.paymentProof;
        subjectIntentAmount = builtProof.attestation.releaseAmount; // smaller than attested release
      });

      it("should cap release amount to intent amount", async () => {
        const result = await subjectCallStatic();
        expect(result.releaseAmount).to.eq(subjectIntentAmount);
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

    describe("when attestation data hash does not match provided data", async () => {
      beforeEach(async () => {
        const tamperedData = encodeUnifiedPaymentDetails({
          method: builtProof.paymentDetails.method,
          payeeId: builtProof.paymentDetails.payeeId,
          amount: builtProof.paymentDetails.amount.add(1),
          currency: builtProof.paymentDetails.currency,
          timestamp: builtProof.paymentDetails.timestamp,
          paymentId: builtProof.paymentDetails.paymentId,
        });

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,uint256,bytes32,bytes[],bytes,bytes)"],
          [[
            builtProof.attestation.intentHash,
            builtProof.attestation.releaseAmount,
            builtProof.attestation.dataHash,
            builtProof.attestation.signatures,
            tamperedData,
            builtProof.attestation.metadata,
          ]],
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Data hash mismatch");
      });
    });

    describe("when the signature digest is tampered", async () => {
      beforeEach(async () => {
        const valid = await buildProof();
        const higherReleaseAmount = valid.attestation.releaseAmount.add(1);

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["tuple(bytes32,uint256,bytes32,bytes[],bytes,bytes)"],
          [[
            valid.attestation.intentHash,
            higherReleaseAmount,
            valid.attestation.dataHash,
            valid.attestation.signatures,
            valid.attestation.data,
            valid.attestation.metadata,
          ]],
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith(
          "ThresholdSigVerifierUtils: Not enough valid witness signatures",
        );
      });
    });
  });
});
