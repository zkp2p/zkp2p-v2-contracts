import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber } from "ethers";

import { BaseUnifiedPaymentVerifier, IAttestationVerifier, NullifierRegistry, SimpleAttestationVerifier } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

describe("BaseUnifiedPaymentVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let witness1: Account;
  let zktlsAttestor: Account;

  let BaseUnifiedPaymentVerifier: BaseUnifiedPaymentVerifier;
  let attestationVerifier: SimpleAttestationVerifier;
  let nullifierRegistry: NullifierRegistry;

  let deployer: DeployHelper;

  const venmoPaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("venmo"));
  const paypalPaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("paypal"));

  const usdCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("USD"));
  const eurCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EUR"));
  const gbpCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GBP"));

  beforeEach(async () => {
    [
      owner,
      attacker,
      escrow,
      witness1,
      zktlsAttestor
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    // Deploy the nullifier registry
    nullifierRegistry = await deployer.deployNullifierRegistry();

    attestationVerifier = await deployer.deploySimpleAttestationVerifier(
      witness1.address,
      zktlsAttestor.address
    );

    // Deploy the UnifiedPaymentVerifier (which inherits BaseUnifiedPaymentVerifier functionality)
    BaseUnifiedPaymentVerifier = await deployer.deployUnifiedPaymentVerifier(
      escrow.address,
      nullifierRegistry.address,
      attestationVerifier.address
    );
  });

  describe("#constructor", async () => {
    it("should set the correct escrow address", async () => {
      const escrowAddress = await BaseUnifiedPaymentVerifier.orchestrator();
      expect(escrowAddress).to.eq(escrow.address);
    });

    it("should set the correct nullifier registry", async () => {
      const nullifierRegistryAddress = await BaseUnifiedPaymentVerifier.nullifierRegistry();
      expect(nullifierRegistryAddress).to.eq(nullifierRegistry.address);
    });

    it("should set the correct attestation verifier", async () => {
      const attestationVerifierAddress = await BaseUnifiedPaymentVerifier.attestationVerifier();
      expect(attestationVerifierAddress).to.eq(attestationVerifier.address);
    });

    it("should have the correct owner set", async () => {
      const contractOwner = await BaseUnifiedPaymentVerifier.owner();
      expect(contractOwner).to.eq(owner.address);
    });
  });

  describe("#setAttestationVerifier", async () => {
    let subjectAttestationVerifier: Address;
    let subjectCaller: Account;

    let newAttestationVerifier: SimpleAttestationVerifier;

    beforeEach(async () => {
      newAttestationVerifier = await deployer.deploySimpleAttestationVerifier(
        witness1.address,
        zktlsAttestor.address
      );

      subjectAttestationVerifier = newAttestationVerifier.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).setAttestationVerifier(subjectAttestationVerifier);
    }

    it("should update the attestation verifier", async () => {
      await subject();
      const attestationVerifierAddress = await BaseUnifiedPaymentVerifier.attestationVerifier();
      expect(attestationVerifierAddress).to.eq(subjectAttestationVerifier);
    });

    it("should emit the AttestationVerifierUpdated event", async () => {
      await expect(subject()).to.emit(BaseUnifiedPaymentVerifier, "AttestationVerifierUpdated")
        .withArgs(attestationVerifier.address, subjectAttestationVerifier);
    });

    describe("when attestation verifier is zero", async () => {
      beforeEach(async () => {
        subjectAttestationVerifier = ethers.constants.AddressZero;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Invalid attestation verifier");
      });
    });

    describe("when attestation verifier is the same as current", async () => {
      beforeEach(async () => {
        // Get the current attestation verifier address
        subjectAttestationVerifier = attestationVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Same verifier");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = attacker;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#addPaymentMethod", async () => {
    let subjectPaymentMethod: string;
    let subjectTimestampBuffer: BigNumber;
    let subjectProviderHashes: string[];
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectTimestampBuffer = BigNumber.from(60);
      subjectProviderHashes = [
        "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8",
        "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"
      ];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).addPaymentMethod(
        subjectPaymentMethod,
        subjectTimestampBuffer,
        subjectProviderHashes
      );
    }

    it("should add the payment method", async () => {
      await subject();

      const paymentMethods = await BaseUnifiedPaymentVerifier.getPaymentMethods();
      expect(paymentMethods).to.contain(subjectPaymentMethod);

      const timestampBuffer = await BaseUnifiedPaymentVerifier.getTimestampBuffer(subjectPaymentMethod);
      expect(timestampBuffer).to.eq(subjectTimestampBuffer);
    });

    it("should add all processor hashes", async () => {
      await subject();

      const providerHashes = await BaseUnifiedPaymentVerifier.getProviderHashes(subjectPaymentMethod);
      expect(providerHashes).to.deep.eq(subjectProviderHashes);

      for (const hash of subjectProviderHashes) {
        const isAuthorized = await BaseUnifiedPaymentVerifier.isProviderHash(subjectPaymentMethod, hash);
        expect(isAuthorized).to.be.true;
      }
    });


    it("should emit the PaymentMethodAdded event", async () => {
      await expect(subject()).to.emit(BaseUnifiedPaymentVerifier, "PaymentMethodAdded")
        .withArgs(subjectPaymentMethod, subjectTimestampBuffer);
    });

    it("should emit ProviderHashAdded events", async () => {
      const tx = await subject();

      for (const hash of subjectProviderHashes) {
        await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "ProviderHashAdded")
          .withArgs(subjectPaymentMethod, hash);
      }
    });


    describe("when payment method already exists", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Payment method already exists");
      });
    });

    describe("when no processor hashes provided", async () => {
      beforeEach(async () => {
        subjectProviderHashes = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Invalid length");
      });
    });


    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = attacker;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#setTimestampBuffer", async () => {
    let subjectPaymentMethod: string;
    let subjectNewBuffer: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Add a payment method first
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectNewBuffer = BigNumber.from(120);
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).setTimestampBuffer(subjectPaymentMethod, subjectNewBuffer);
    }

    it("should update the timestamp buffer", async () => {
      await subject();
      const buffer = await BaseUnifiedPaymentVerifier.getTimestampBuffer(subjectPaymentMethod);
      expect(buffer).to.eq(subjectNewBuffer);
    });

    it("should emit the TimestampBufferUpdated event", async () => {
      await expect(subject()).to.emit(BaseUnifiedPaymentVerifier, "TimestampBufferUpdated")
        .withArgs(subjectPaymentMethod, BigNumber.from(30), subjectNewBuffer);
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Payment method does not exist");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = attacker;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#addProviderHashes", async () => {
    let subjectPaymentMethod: string;
    let subjectProviderHashes: string[];
    let subjectCaller: Account;

    beforeEach(async () => {
      // Add a payment method first
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectProviderHashes = [
        "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9",
        "0xe46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729aa",
        "0xf46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729ab"
      ];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).addProviderHashes(subjectPaymentMethod, subjectProviderHashes);
    }

    it("should add multiple processor hashes", async () => {
      await subject();

      for (const hash of subjectProviderHashes) {
        const isAuthorized = await BaseUnifiedPaymentVerifier.isProviderHash(subjectPaymentMethod, hash);
        expect(isAuthorized).to.be.true;
      }

      const providerHashes = await BaseUnifiedPaymentVerifier.getProviderHashes(subjectPaymentMethod);
      for (const hash of subjectProviderHashes) {
        expect(providerHashes).to.contain(hash);
      }
    });

    it("should add a single processor hash", async () => {
      subjectProviderHashes = ["0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"];

      await subject();

      const isAuthorized = await BaseUnifiedPaymentVerifier.isProviderHash(subjectPaymentMethod, subjectProviderHashes[0]);
      expect(isAuthorized).to.be.true;

      const providerHashes = await BaseUnifiedPaymentVerifier.getProviderHashes(subjectPaymentMethod);
      expect(providerHashes).to.contain(subjectProviderHashes[0]);
    });

    it("should emit ProviderHashAdded events for each hash", async () => {
      const tx = await subject();

      for (const hash of subjectProviderHashes) {
        await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "ProviderHashAdded")
          .withArgs(subjectPaymentMethod, hash);
      }
    });

    describe("when empty array is provided", async () => {
      beforeEach(async () => {
        subjectProviderHashes = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Invalid length");
      });
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Payment method does not exist");
      });
    });

    describe("when processor hash is zero", async () => {
      beforeEach(async () => {
        subjectProviderHashes = [
          "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9",
          ethers.constants.HashZero,
          "0xe46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729aa"
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Invalid provider hash");
      });
    });

    describe("when processor hash already exists", async () => {
      beforeEach(async () => {
        subjectProviderHashes = [
          "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9",
          "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8", // Already added in setup
          "0xe46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729aa"
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Provider hash already exists");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = attacker;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#removeProviderHashes", async () => {
    let subjectPaymentMethod: string;
    let subjectProviderHashes: string[];
    let subjectCaller: Account;
    let existingProviderHashes: string[];

    beforeEach(async () => {
      existingProviderHashes = [
        "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8",
        "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9",
        "0xe46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729aa",
        "0xf46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729ab"
      ];

      // Add a payment method with multiple processor hashes
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        existingProviderHashes
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectProviderHashes = [
        existingProviderHashes[0],
        existingProviderHashes[2],
        existingProviderHashes[3]
      ];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).removeProviderHashes(subjectPaymentMethod, subjectProviderHashes);
    }

    it("should remove multiple processor hashes in a single transaction", async () => {
      await subject();

      // Check that removed hashes are no longer authorized
      for (const hash of subjectProviderHashes) {
        const isAuthorized = await BaseUnifiedPaymentVerifier.isProviderHash(subjectPaymentMethod, hash);
        expect(isAuthorized).to.be.false;
      }

      // Check that non-removed hash is still authorized
      const stillAuthorized = await BaseUnifiedPaymentVerifier.isProviderHash(subjectPaymentMethod, existingProviderHashes[1]);
      expect(stillAuthorized).to.be.true;

      // Check the processor hashes array
      const providerHashes = await BaseUnifiedPaymentVerifier.getProviderHashes(subjectPaymentMethod);
      for (const hash of subjectProviderHashes) {
        expect(providerHashes).to.not.contain(hash);
      }
      expect(providerHashes).to.contain(existingProviderHashes[1]);
    });

    it("should remove a single processor hash (array with one element)", async () => {
      subjectProviderHashes = [existingProviderHashes[0]];

      await subject();

      const isAuthorized = await BaseUnifiedPaymentVerifier.isProviderHash(subjectPaymentMethod, existingProviderHashes[0]);
      expect(isAuthorized).to.be.false;

      const providerHashes = await BaseUnifiedPaymentVerifier.getProviderHashes(subjectPaymentMethod);
      expect(providerHashes).to.not.contain(existingProviderHashes[0]);
      expect(providerHashes.length).to.eq(existingProviderHashes.length - 1);
    });

    it("should emit ProviderHashRemoved events for each processor hash removed", async () => {
      const tx = await subject();

      for (const hash of subjectProviderHashes) {
        await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "ProviderHashRemoved")
          .withArgs(subjectPaymentMethod, hash);
      }
    });

    describe("when empty array is provided", async () => {
      beforeEach(async () => {
        subjectProviderHashes = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Invalid length");
      });
    });

    describe("when non-authorized processor hash is included", async () => {
      beforeEach(async () => {
        subjectProviderHashes = [
          existingProviderHashes[0],
          "0xa46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729ac", // Not authorized
          existingProviderHashes[1]
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Provider hash does not exist");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = attacker;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });


  describe("#removePaymentMethod", async () => {
    let subjectPaymentMethod: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Add a payment method with multiple processors
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        [
          "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8",
          "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"
        ]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).removePaymentMethod(subjectPaymentMethod);
    }

    it("should remove the payment method", async () => {
      await subject();

      const paymentMethods = await BaseUnifiedPaymentVerifier.getPaymentMethods();
      expect(paymentMethods).to.not.contain(subjectPaymentMethod);

      // Should revert when trying to access removed payment method
      await expect(BaseUnifiedPaymentVerifier.getTimestampBuffer(subjectPaymentMethod))
        .to.be.revertedWith("UPV: Payment method does not exist");
    });

    it("should remove all provider hashes", async () => {
      const providerHashBefore = "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8";
      expect(await BaseUnifiedPaymentVerifier.isProviderHash(subjectPaymentMethod, providerHashBefore)).to.be.true;

      await subject();

      expect(await BaseUnifiedPaymentVerifier.isProviderHash(subjectPaymentMethod, providerHashBefore)).to.be.false;
    });


    it("should emit the PaymentMethodRemoved event", async () => {
      await expect(subject()).to.emit(BaseUnifiedPaymentVerifier, "PaymentMethodRemoved")
        .withArgs(subjectPaymentMethod);
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("UPV: Payment method does not exist");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = attacker;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("view functions", async () => {
    beforeEach(async () => {
      // Add multiple payment methods for testing
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"]
      );

      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        paypalPaymentMethodHash,
        BigNumber.from(60),
        ["0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"]
      );
    });

    describe("#getPaymentMethods", async () => {
      it("should return all payment methods", async () => {
        const paymentMethods = await BaseUnifiedPaymentVerifier.getPaymentMethods();
        expect(paymentMethods).to.contain(venmoPaymentMethodHash);
        expect(paymentMethods).to.contain(paypalPaymentMethodHash);
        expect(paymentMethods.length).to.eq(2);
      });
    });

    describe("#getTimestampBuffer", async () => {
      it("should return the correct timestamp buffer", async () => {
        const venmoBuffer = await BaseUnifiedPaymentVerifier.getTimestampBuffer(venmoPaymentMethodHash);
        const paypalBuffer = await BaseUnifiedPaymentVerifier.getTimestampBuffer(paypalPaymentMethodHash);

        expect(venmoBuffer).to.eq(BigNumber.from(30));
        expect(paypalBuffer).to.eq(BigNumber.from(60));
      });

      describe("when payment method does not exist", async () => {
        it("should revert", async () => {
          const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
          await expect(BaseUnifiedPaymentVerifier.getTimestampBuffer(nonExistentMethod))
            .to.be.revertedWith("UPV: Payment method does not exist");
        });
      });
    });

    describe("#getProviderHashes", async () => {
      it("should return the correct provider hashes", async () => {
        const venmoHashes = await BaseUnifiedPaymentVerifier.getProviderHashes(venmoPaymentMethodHash);
        const paypalHashes = await BaseUnifiedPaymentVerifier.getProviderHashes(paypalPaymentMethodHash);

        expect(venmoHashes).to.deep.eq(["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"]);
        expect(paypalHashes).to.deep.eq(["0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"]);
      });

      describe("when payment method does not exist", async () => {
        it("should revert", async () => {
          const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
          await expect(BaseUnifiedPaymentVerifier.getProviderHashes(nonExistentMethod))
            .to.be.revertedWith("UPV: Payment method does not exist");
        });
      });
    });

  });
});