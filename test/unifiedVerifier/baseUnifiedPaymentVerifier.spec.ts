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

describe.only("BaseUnifiedPaymentVerifier", () => {
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
  const minWitnessSignatures = 2;
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
      const escrowAddress = await BaseUnifiedPaymentVerifier.escrow();
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

    describe("when escrow address is zero", async () => {
      it("should revert", async () => {
        await expect(
          deployer.deployUnifiedPaymentVerifier(
            ethers.constants.AddressZero,
            nullifierRegistry.address,
            attestationVerifier.address
          )
        ).to.be.revertedWith("BUPN: Invalid escrow");
      });
    });

    describe("when nullifier registry address is zero", async () => {
      it("should revert", async () => {
        await expect(
          deployer.deployUnifiedPaymentVerifier(
            escrow.address,
            ethers.constants.AddressZero,
            attestationVerifier.address
          )
        ).to.be.revertedWith("BUPN: Invalid nullifier registry");
      });
    });

    describe("when attestation verifier address is zero", async () => {
      it("should revert", async () => {
        await expect(
          deployer.deployUnifiedPaymentVerifier(
            escrow.address,
            nullifierRegistry.address,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("BUPN: Invalid attestation verifier");
      });
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
        await expect(subject()).to.be.revertedWith("BUPN: Invalid attestation verifier");
      });
    });

    describe("when attestation verifier is the same as current", async () => {
      beforeEach(async () => {
        // Get the current attestation verifier address
        subjectAttestationVerifier = attestationVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Same verifier");
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
    let subjectProcessorHashes: string[];
    let subjectCurrencies: string[];
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectTimestampBuffer = BigNumber.from(60);
      subjectProcessorHashes = [
        "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8",
        "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"
      ];
      subjectCurrencies = [usdCurrencyHash, eurCurrencyHash];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).addPaymentMethod(
        subjectPaymentMethod,
        subjectTimestampBuffer,
        subjectProcessorHashes,
        subjectCurrencies
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

      const processorHashes = await BaseUnifiedPaymentVerifier.getProcessorHashes(subjectPaymentMethod);
      expect(processorHashes).to.deep.eq(subjectProcessorHashes);

      for (const hash of subjectProcessorHashes) {
        const isAuthorized = await BaseUnifiedPaymentVerifier.isProcessorHash(subjectPaymentMethod, hash);
        expect(isAuthorized).to.be.true;
      }
    });

    it("should add all currencies", async () => {
      await subject();

      const currencies = await BaseUnifiedPaymentVerifier.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.deep.eq(subjectCurrencies);

      for (const currency of subjectCurrencies) {
        const isSupported = await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, currency);
        expect(isSupported).to.be.true;
      }
    });

    it("should emit the PaymentMethodAdded event", async () => {
      await expect(subject()).to.emit(BaseUnifiedPaymentVerifier, "PaymentMethodAdded")
        .withArgs(subjectPaymentMethod, subjectTimestampBuffer);
    });

    it("should emit ProcessorHashAdded events", async () => {
      const tx = await subject();

      for (const hash of subjectProcessorHashes) {
        await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "ProcessorHashAdded")
          .withArgs(subjectPaymentMethod, hash);
      }
    });

    it("should emit CurrencyAdded events", async () => {
      const tx = await subject();

      for (const currency of subjectCurrencies) {
        await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "CurrencyAdded")
          .withArgs(subjectPaymentMethod, currency);
      }
    });

    describe("when payment method already exists", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Payment method already exists");
      });
    });

    describe("when no processor hashes provided", async () => {
      beforeEach(async () => {
        subjectProcessorHashes = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Must provide at least one processor");
      });
    });

    describe("when no currencies provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Must provide at least one currency");
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
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"],
        [usdCurrencyHash]
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

    it("should emit the TimestampBufferSet event", async () => {
      await expect(subject()).to.emit(BaseUnifiedPaymentVerifier, "TimestampBufferSet")
        .withArgs(subjectPaymentMethod, BigNumber.from(30), subjectNewBuffer);
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Payment method does not exist");
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

  describe("#addProcessorHashes", async () => {
    let subjectPaymentMethod: string;
    let subjectProcessorHashes: string[];
    let subjectCaller: Account;

    beforeEach(async () => {
      // Add a payment method first
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"],
        [usdCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectProcessorHashes = [
        "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9",
        "0xe46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729aa",
        "0xf46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729ab"
      ];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).addProcessorHashes(subjectPaymentMethod, subjectProcessorHashes);
    }

    it("should add multiple processor hashes", async () => {
      await subject();

      for (const hash of subjectProcessorHashes) {
        const isAuthorized = await BaseUnifiedPaymentVerifier.isProcessorHash(subjectPaymentMethod, hash);
        expect(isAuthorized).to.be.true;
      }

      const processorHashes = await BaseUnifiedPaymentVerifier.getProcessorHashes(subjectPaymentMethod);
      for (const hash of subjectProcessorHashes) {
        expect(processorHashes).to.contain(hash);
      }
    });

    it("should add a single processor hash", async () => {
      subjectProcessorHashes = ["0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"];

      await subject();

      const isAuthorized = await BaseUnifiedPaymentVerifier.isProcessorHash(subjectPaymentMethod, subjectProcessorHashes[0]);
      expect(isAuthorized).to.be.true;

      const processorHashes = await BaseUnifiedPaymentVerifier.getProcessorHashes(subjectPaymentMethod);
      expect(processorHashes).to.contain(subjectProcessorHashes[0]);
    });

    it("should emit ProcessorHashAdded events for each hash", async () => {
      const tx = await subject();

      for (const hash of subjectProcessorHashes) {
        await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "ProcessorHashAdded")
          .withArgs(subjectPaymentMethod, hash);
      }
    });

    describe("when empty array is provided", async () => {
      beforeEach(async () => {
        subjectProcessorHashes = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Must provide at least one processor");
      });
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Payment method does not exist");
      });
    });

    describe("when processor hash is zero", async () => {
      beforeEach(async () => {
        subjectProcessorHashes = [
          "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9",
          ethers.constants.HashZero,
          "0xe46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729aa"
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Invalid processor hash");
      });
    });

    describe("when processor hash already exists", async () => {
      beforeEach(async () => {
        subjectProcessorHashes = [
          "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9",
          "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8", // Already added in setup
          "0xe46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729aa"
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Already authorized");
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

  describe("#removeProcessorHashes", async () => {
    let subjectPaymentMethod: string;
    let subjectProcessorHashes: string[];
    let subjectCaller: Account;
    let existingProcessorHashes: string[];

    beforeEach(async () => {
      existingProcessorHashes = [
        "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8",
        "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9",
        "0xe46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729aa",
        "0xf46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729ab"
      ];

      // Add a payment method with multiple processor hashes
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        existingProcessorHashes,
        [usdCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectProcessorHashes = [
        existingProcessorHashes[0],
        existingProcessorHashes[2],
        existingProcessorHashes[3]
      ];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).removeProcessorHashes(subjectPaymentMethod, subjectProcessorHashes);
    }

    it("should remove multiple processor hashes in a single transaction", async () => {
      await subject();

      // Check that removed hashes are no longer authorized
      for (const hash of subjectProcessorHashes) {
        const isAuthorized = await BaseUnifiedPaymentVerifier.isProcessorHash(subjectPaymentMethod, hash);
        expect(isAuthorized).to.be.false;
      }

      // Check that non-removed hash is still authorized
      const stillAuthorized = await BaseUnifiedPaymentVerifier.isProcessorHash(subjectPaymentMethod, existingProcessorHashes[1]);
      expect(stillAuthorized).to.be.true;

      // Check the processor hashes array
      const processorHashes = await BaseUnifiedPaymentVerifier.getProcessorHashes(subjectPaymentMethod);
      for (const hash of subjectProcessorHashes) {
        expect(processorHashes).to.not.contain(hash);
      }
      expect(processorHashes).to.contain(existingProcessorHashes[1]);
    });

    it("should remove a single processor hash (array with one element)", async () => {
      subjectProcessorHashes = [existingProcessorHashes[0]];

      await subject();

      const isAuthorized = await BaseUnifiedPaymentVerifier.isProcessorHash(subjectPaymentMethod, existingProcessorHashes[0]);
      expect(isAuthorized).to.be.false;

      const processorHashes = await BaseUnifiedPaymentVerifier.getProcessorHashes(subjectPaymentMethod);
      expect(processorHashes).to.not.contain(existingProcessorHashes[0]);
      expect(processorHashes.length).to.eq(existingProcessorHashes.length - 1);
    });

    it("should emit ProcessorHashRemoved events for each processor hash removed", async () => {
      const tx = await subject();

      for (const hash of subjectProcessorHashes) {
        await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "ProcessorHashRemoved")
          .withArgs(subjectPaymentMethod, hash);
      }
    });

    describe("when empty array is provided", async () => {
      beforeEach(async () => {
        subjectProcessorHashes = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Must provide at least one processor");
      });
    });

    describe("when non-authorized processor hash is included", async () => {
      beforeEach(async () => {
        subjectProcessorHashes = [
          existingProcessorHashes[0],
          "0xa46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729ac", // Not authorized
          existingProcessorHashes[1]
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Not authorized");
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

  describe("#addCurrencies", async () => {
    let subjectPaymentMethod: string;
    let subjectCurrencies: string[];
    let subjectCaller: Account;

    beforeEach(async () => {
      // Add a payment method first
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"],
        [usdCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectCurrencies = [eurCurrencyHash, gbpCurrencyHash];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).addCurrencies(subjectPaymentMethod, subjectCurrencies);
    }

    it("should add multiple currencies in a single transaction", async () => {
      await subject();

      // Check EUR is supported
      const isEurSupported = await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, eurCurrencyHash);
      expect(isEurSupported).to.be.true;

      // Check GBP is supported
      const isGbpSupported = await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, gbpCurrencyHash);
      expect(isGbpSupported).to.be.true;

      const currencies = await BaseUnifiedPaymentVerifier.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.contain(eurCurrencyHash);
      expect(currencies).to.contain(gbpCurrencyHash);
      expect(currencies).to.contain(usdCurrencyHash); // Previously added
    });

    it("should add a single currency (array with one element)", async () => {
      subjectCurrencies = [eurCurrencyHash];

      await subject();

      const isSupported = await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, eurCurrencyHash);
      expect(isSupported).to.be.true;

      const currencies = await BaseUnifiedPaymentVerifier.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.contain(eurCurrencyHash);
    });

    it("should emit CurrencyAdded events for each currency added", async () => {
      const tx = await subject();

      await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "CurrencyAdded")
        .withArgs(subjectPaymentMethod, eurCurrencyHash);
      await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "CurrencyAdded")
        .withArgs(subjectPaymentMethod, gbpCurrencyHash);
    });

    describe("when empty array is provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Must provide at least one currency");
      });
    });

    describe("when invalid currency code (bytes32(0)) is provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [eurCurrencyHash, ethers.constants.HashZero, gbpCurrencyHash];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Invalid currency code");
      });
    });

    describe("when already supported currency is included", async () => {
      beforeEach(async () => {
        subjectCurrencies = [eurCurrencyHash, usdCurrencyHash, gbpCurrencyHash]; // USD already added in setup
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Currency already supported");
      });
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Payment method does not exist");
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

  describe("#removeCurrencies", async () => {
    let subjectPaymentMethod: string;
    let subjectCurrencies: string[];
    let subjectCaller: Account;

    beforeEach(async () => {
      // Add a payment method with multiple currencies
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"],
        [usdCurrencyHash, eurCurrencyHash, gbpCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectCurrencies = [usdCurrencyHash, eurCurrencyHash];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await BaseUnifiedPaymentVerifier.connect(subjectCaller.wallet).removeCurrencies(subjectPaymentMethod, subjectCurrencies);
    }

    it("should remove multiple currencies in a single transaction", async () => {
      await subject();

      // Check that removed currencies are no longer supported
      const isUsdSupported = await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, usdCurrencyHash);
      expect(isUsdSupported).to.be.false;

      const isEurSupported = await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, eurCurrencyHash);
      expect(isEurSupported).to.be.false;

      // Check that non-removed currency is still supported
      const isGbpSupported = await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, gbpCurrencyHash);
      expect(isGbpSupported).to.be.true;

      // Check the currencies array
      const currencies = await BaseUnifiedPaymentVerifier.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.not.contain(usdCurrencyHash);
      expect(currencies).to.not.contain(eurCurrencyHash);
      expect(currencies).to.contain(gbpCurrencyHash);
      expect(currencies.length).to.eq(1);
    });

    it("should remove a single currency (array with one element)", async () => {
      subjectCurrencies = [usdCurrencyHash];

      await subject();

      const isSupported = await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, usdCurrencyHash);
      expect(isSupported).to.be.false;

      const currencies = await BaseUnifiedPaymentVerifier.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.not.contain(usdCurrencyHash);
      expect(currencies).to.contain(eurCurrencyHash);
      expect(currencies).to.contain(gbpCurrencyHash);
      expect(currencies.length).to.eq(2);
    });

    it("should emit CurrencyRemoved events for each currency removed", async () => {
      const tx = await subject();

      await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "CurrencyRemoved")
        .withArgs(subjectPaymentMethod, usdCurrencyHash);
      await expect(tx).to.emit(BaseUnifiedPaymentVerifier, "CurrencyRemoved")
        .withArgs(subjectPaymentMethod, eurCurrencyHash);
    });

    describe("when empty array is provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Must provide at least one currency");
      });
    });

    describe("when non-supported currency is included", async () => {
      beforeEach(async () => {
        const nonSupportedCurrency = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("JPY"));
        subjectCurrencies = [usdCurrencyHash, nonSupportedCurrency, eurCurrencyHash];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BUPN: Currency not supported");
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
      // Add a payment method with multiple processors and currencies
      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        [
          "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8",
          "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"
        ],
        [usdCurrencyHash, eurCurrencyHash]
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
        .to.be.revertedWith("BUPN: Payment method does not exist");
    });

    it("should remove all processor hashes", async () => {
      const processorHashBefore = "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8";
      expect(await BaseUnifiedPaymentVerifier.isProcessorHash(subjectPaymentMethod, processorHashBefore)).to.be.true;

      await subject();

      expect(await BaseUnifiedPaymentVerifier.isProcessorHash(subjectPaymentMethod, processorHashBefore)).to.be.false;
    });

    it("should remove all currencies", async () => {
      expect(await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, usdCurrencyHash)).to.be.true;

      await subject();

      expect(await BaseUnifiedPaymentVerifier.isCurrency(subjectPaymentMethod, usdCurrencyHash)).to.be.false;
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
        await expect(subject()).to.be.revertedWith("BUPN: Payment method does not exist");
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
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"],
        [usdCurrencyHash]
      );

      await BaseUnifiedPaymentVerifier.addPaymentMethod(
        paypalPaymentMethodHash,
        BigNumber.from(60),
        ["0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"],
        [eurCurrencyHash]
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
            .to.be.revertedWith("BUPN: Payment method does not exist");
        });
      });
    });

    describe("#getProcessorHashes", async () => {
      it("should return the correct processor hashes", async () => {
        const venmoHashes = await BaseUnifiedPaymentVerifier.getProcessorHashes(venmoPaymentMethodHash);
        const paypalHashes = await BaseUnifiedPaymentVerifier.getProcessorHashes(paypalPaymentMethodHash);

        expect(venmoHashes).to.deep.eq(["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"]);
        expect(paypalHashes).to.deep.eq(["0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"]);
      });

      describe("when payment method does not exist", async () => {
        it("should revert", async () => {
          const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
          await expect(BaseUnifiedPaymentVerifier.getProcessorHashes(nonExistentMethod))
            .to.be.revertedWith("BUPN: Payment method does not exist");
        });
      });
    });

    describe("#getCurrencies", async () => {
      it("should return the correct currencies", async () => {
        const venmoCurrencies = await BaseUnifiedPaymentVerifier.getCurrencies(venmoPaymentMethodHash);
        const paypalCurrencies = await BaseUnifiedPaymentVerifier.getCurrencies(paypalPaymentMethodHash);

        expect(venmoCurrencies).to.deep.eq([usdCurrencyHash]);
        expect(paypalCurrencies).to.deep.eq([eurCurrencyHash]);
      });

      describe("when payment method does not exist", async () => {
        it("should revert", async () => {
          const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
          await expect(BaseUnifiedPaymentVerifier.getCurrencies(nonExistentMethod))
            .to.be.revertedWith("BUPN: Payment method does not exist");
        });
      });
    });
  });
});