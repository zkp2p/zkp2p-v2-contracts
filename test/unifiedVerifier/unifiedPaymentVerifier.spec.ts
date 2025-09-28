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
  UnifiedVerifierEscrowMock,
  UnifiedVerifierOrchestratorMock,
} from "@utils/contracts";
import {
  buildUnifiedPaymentProof,
  BuiltUnifiedPaymentProof,
  BuildPaymentProofOverrides,
  encodeUnifiedPaymentPayload,
} from "@utils/unifiedVerifierUtils";

const expect = getWaffleExpect();

const ZERO_BYTES = "0x";
const ZERO_ADDRESS = ethers.constants.AddressZero;


describe.only("UnifiedPaymentVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let orchestrator: Account;
  let witness: Account;

  let nullifierRegistry: NullifierRegistry;
  let attestationVerifier: SimpleAttestationVerifier;
  let verifier: UnifiedPaymentVerifier;
  let escrowMock: UnifiedVerifierEscrowMock;
  let orchestratorMock: UnifiedVerifierOrchestratorMock;
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
    escrowMock = await deployer.deployUnifiedVerifierEscrowMock();
    orchestratorMock = await deployer.deployUnifiedVerifierOrchestratorMock();

    verifier = await deployer.deployUnifiedPaymentVerifier(
      orchestratorMock.address,
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
    let subjectData: BytesLike;
    let subjectIntentHash: BytesLike;

    let builtProof: BuiltUnifiedPaymentProof;

    async function syncMocks(proof: BuiltUnifiedPaymentProof) {
      const depositIdBn = proof.intentContext.depositId;
      const depositId = depositIdBn.toNumber();
      await escrowMock.setPaymentMethodData(
        depositId,
        proof.intentSnapshot.paymentMethod,
        ethers.constants.AddressZero,
        proof.intentSnapshot.payeeDetails,
        "0x"
      );

      await orchestratorMock.setIntent(
        proof.attestation.intentHash,
        {
          owner: orchestrator.address,
          to: proof.intentContext.to,
          escrow: proof.intentContext.escrow,
          depositId: proof.intentContext.depositId,
          amount: proof.intentSnapshot.amount,
          timestamp: proof.intentSnapshot.signalTimestamp,
          paymentMethod: proof.intentSnapshot.paymentMethod,
          fiatCurrency: proof.intentSnapshot.fiatCurrency,
          conversionRate: proof.intentSnapshot.conversionRate
        }
      );
    }

    async function buildProof(overrides: BuildPaymentProofOverrides = {}) {
      const conversionRate = overrides.intentConversionRate ?? ethers.utils.parseEther("1");
      const depositId = overrides.intentDepositId ?? BigNumber.from(1);
      const signalTimestamp = overrides.intentSignalTimestamp ?? defaultTimestamp.div(1000);
      const timestampBuffer = overrides.intentTimestampBuffer ?? BigNumber.from(0);

      return await buildUnifiedPaymentProof({
        verifier: verifier.address,
        witness,
        chainId,
        method: overrides.method ?? venmoPaymentMethodHash,
        payeeId: overrides.payeeId ?? defaultPayeeId,
        amount: overrides.amount ?? defaultAmount,
        currency: overrides.currency ?? defaultCurrency,
        timestamp: overrides.timestamp ?? defaultTimestamp,
        paymentId: overrides.paymentId ?? defaultPaymentId,
        intentHash: overrides.intentHash ?? defaultIntentHash,
        releaseAmount: overrides.releaseAmount ?? defaultAmount,
        metadata: overrides.metadata ?? ZERO_BYTES,
        signer: overrides.signer,
        attestationDataOverride: overrides.attestationDataOverride,
        intentAmountOverride: overrides.intentAmountOverride ?? overrides.amount ?? defaultAmount,
        intentConversionRate: conversionRate,
        intentSignalTimestamp: signalTimestamp,
        intentPayeeDetails: overrides.intentPayeeDetails ?? defaultPayeeId,
        intentTimestampBuffer: timestampBuffer,
        intentDepositId: depositId,
        intentEscrow: overrides.intentEscrow ?? escrowMock.address,
        intentTo: overrides.intentTo ?? ethers.constants.AddressZero,
      });
    }

    beforeEach(async () => {
      builtProof = await buildProof();
      await syncMocks(builtProof);

      subjectCaller = orchestrator;
      subjectProof = builtProof.paymentProof;
      subjectData = ZERO_BYTES;
      subjectIntentHash = builtProof.attestation.intentHash;
    });

    async function subject() {
      return await orchestratorMock
        .connect(subjectCaller.wallet)
        .executeVerifyPayment(verifier.address, {
          intentHash: subjectIntentHash,
          paymentProof: subjectProof,
          data: subjectData,
        });
    }

    async function subjectCallStatic() {
      return await orchestratorMock
        .connect(subjectCaller.wallet)
        .callStatic.executeVerifyPayment(verifier.address, {
          intentHash: subjectIntentHash,
          paymentProof: subjectProof,
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
        builtProof = await buildProof({ releaseAmount: largeRelease });
        subjectProof = builtProof.paymentProof;
        await syncMocks(builtProof);
        subjectIntentHash = builtProof.attestation.intentHash;
      });

      it("should cap release amount to intent amount", async () => {
        const result = await subjectCallStatic();
        expect(result.releaseAmount).to.eq(builtProof.intentSnapshot.amount);
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
        await expect(
          verifier.connect(subjectCaller.wallet).verifyPayment({
            intentHash: subjectIntentHash,
            paymentProof: subjectProof,
            data: subjectData,
          })
        ).to.be.revertedWith("Only orchestrator can call");
      });
    });

    describe("when attestation data hash does not match provided data", async () => {
      beforeEach(async () => {
        const tamperedDetails = {
          ...builtProof.paymentDetails,
          amount: builtProof.paymentDetails.amount.add(1),
        };
        const tamperedData = encodeUnifiedPaymentPayload(tamperedDetails, builtProof.intentSnapshot);

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
