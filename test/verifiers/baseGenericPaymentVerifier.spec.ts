import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber } from "ethers";

import { GenericVerifier, NullifierRegistry } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

describe("BaseGenericPaymentVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;

  let baseGenericPaymentVerifier: GenericVerifier;
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
      escrow
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    // Deploy the nullifier registry
    nullifierRegistry = await deployer.deployNullifierRegistry();

    // Deploy the GenericVerifier (which inherits BaseGenericPaymentVerifier functionality)
    baseGenericPaymentVerifier = await deployer.deployGenericVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(minWitnessSignatures)
    );
  });

  describe("#constructor", async () => {
    it("should set the correct escrow address", async () => {
      const escrowAddress = await baseGenericPaymentVerifier.escrow();
      expect(escrowAddress).to.eq(escrow.address);
    });

    it("should set the correct nullifier registry", async () => {
      const nullifierRegistryAddress = await baseGenericPaymentVerifier.nullifierRegistry();
      expect(nullifierRegistryAddress).to.eq(nullifierRegistry.address);
    });

    it("should set the correct min witness signatures", async () => {
      const minSignatures = await baseGenericPaymentVerifier.minWitnessSignatures();
      expect(minSignatures).to.eq(BigNumber.from(minWitnessSignatures));
    });

    it("should have the correct owner set", async () => {
      const contractOwner = await baseGenericPaymentVerifier.owner();
      expect(contractOwner).to.eq(owner.address);
    });

    describe("when escrow address is zero", async () => {
      it("should revert", async () => {
        await expect(
          deployer.deployGenericVerifier(
            ethers.constants.AddressZero,
            nullifierRegistry.address,
            BigNumber.from(minWitnessSignatures)
          )
        ).to.be.revertedWith("BaseGenericPaymentVerifier: Invalid escrow");
      });
    });

    describe("when nullifier registry address is zero", async () => {
      it("should revert", async () => {
        await expect(
          deployer.deployGenericVerifier(
            escrow.address,
            ethers.constants.AddressZero,
            BigNumber.from(minWitnessSignatures)
          )
        ).to.be.revertedWith("BaseGenericPaymentVerifier: Invalid nullifier registry");
      });
    });

    describe("when min witness signatures is zero", async () => {
      it("should revert", async () => {
        await expect(
          deployer.deployGenericVerifier(
            escrow.address,
            nullifierRegistry.address,
            BigNumber.from(0)
          )
        ).to.be.revertedWith("BaseGenericPaymentVerifier: Min signatures must be > 0");
      });
    });
  });

  describe("#setMinWitnessSignatures", async () => {
    let subjectNewMinSignatures: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectNewMinSignatures = BigNumber.from(3);
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await baseGenericPaymentVerifier.connect(subjectCaller.wallet).setMinWitnessSignatures(subjectNewMinSignatures);
    }

    it("should update the min witness signatures", async () => {
      await subject();
      const minSignatures = await baseGenericPaymentVerifier.minWitnessSignatures();
      expect(minSignatures).to.eq(subjectNewMinSignatures);
    });

    it("should emit the MinWitnessSignaturesUpdated event", async () => {
      await expect(subject()).to.emit(baseGenericPaymentVerifier, "MinWitnessSignaturesUpdated")
        .withArgs(BigNumber.from(minWitnessSignatures), subjectNewMinSignatures);
    });

    describe("when new min signatures is zero", async () => {
      beforeEach(async () => {
        subjectNewMinSignatures = BigNumber.from(0);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Min signatures must be > 0");
      });
    });

    describe("when new min signatures is the same as current", async () => {
      beforeEach(async () => {
        subjectNewMinSignatures = BigNumber.from(minWitnessSignatures);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Same value");
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
      return await baseGenericPaymentVerifier.connect(subjectCaller.wallet).addPaymentMethod(
        subjectPaymentMethod,
        subjectTimestampBuffer,
        subjectProcessorHashes,
        subjectCurrencies
      );
    }

    it("should add the payment method", async () => {
      await subject();
      
      const paymentMethods = await baseGenericPaymentVerifier.getPaymentMethods();
      expect(paymentMethods).to.contain(subjectPaymentMethod);
      
      const timestampBuffer = await baseGenericPaymentVerifier.getTimestampBuffer(subjectPaymentMethod);
      expect(timestampBuffer).to.eq(subjectTimestampBuffer);
    });

    it("should add all processor hashes", async () => {
      await subject();
      
      const processorHashes = await baseGenericPaymentVerifier.getProcessorHashes(subjectPaymentMethod);
      expect(processorHashes).to.deep.eq(subjectProcessorHashes);
      
      for (const hash of subjectProcessorHashes) {
        const isAuthorized = await baseGenericPaymentVerifier.isProcessorHash(subjectPaymentMethod, hash);
        expect(isAuthorized).to.be.true;
      }
    });

    it("should add all currencies", async () => {
      await subject();
      
      const currencies = await baseGenericPaymentVerifier.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.deep.eq(subjectCurrencies);
      
      for (const currency of subjectCurrencies) {
        const isSupported = await baseGenericPaymentVerifier.isCurrency(subjectPaymentMethod, currency);
        expect(isSupported).to.be.true;
      }
    });

    it("should emit the PaymentMethodAdded event", async () => {
      await expect(subject()).to.emit(baseGenericPaymentVerifier, "PaymentMethodAdded")
        .withArgs(subjectPaymentMethod, subjectTimestampBuffer);
    });

    it("should emit ProcessorHashAdded events", async () => {
      const tx = await subject();
      
      for (const hash of subjectProcessorHashes) {
        await expect(tx).to.emit(baseGenericPaymentVerifier, "ProcessorHashAdded")
          .withArgs(subjectPaymentMethod, hash);
      }
    });

    it("should emit CurrencyAdded events", async () => {
      const tx = await subject();
      
      for (const currency of subjectCurrencies) {
        await expect(tx).to.emit(baseGenericPaymentVerifier, "CurrencyAdded")
          .withArgs(subjectPaymentMethod, currency);
      }
    });

    describe("when payment method already exists", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Payment method already exists");
      });
    });

    describe("when no processor hashes provided", async () => {
      beforeEach(async () => {
        subjectProcessorHashes = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Must provide at least one processor");
      });
    });

    describe("when no currencies provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Must provide at least one currency");
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
      await baseGenericPaymentVerifier.addPaymentMethod(
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
      return await baseGenericPaymentVerifier.connect(subjectCaller.wallet).setTimestampBuffer(subjectPaymentMethod, subjectNewBuffer);
    }

    it("should update the timestamp buffer", async () => {
      await subject();
      const buffer = await baseGenericPaymentVerifier.getTimestampBuffer(subjectPaymentMethod);
      expect(buffer).to.eq(subjectNewBuffer);
    });

    it("should emit the TimestampBufferSet event", async () => {
      await expect(subject()).to.emit(baseGenericPaymentVerifier, "TimestampBufferSet")
        .withArgs(subjectPaymentMethod, BigNumber.from(30), subjectNewBuffer);
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Payment method does not exist");
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

  describe("#addProcessorHash", async () => {
    let subjectPaymentMethod: string;
    let subjectProcessorHash: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Add a payment method first
      await baseGenericPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"],
        [usdCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectProcessorHash = "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9";
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await baseGenericPaymentVerifier.connect(subjectCaller.wallet).addProcessorHash(subjectPaymentMethod, subjectProcessorHash);
    }

    it("should add the processor hash", async () => {
      await subject();
      
      const isAuthorized = await baseGenericPaymentVerifier.isProcessorHash(subjectPaymentMethod, subjectProcessorHash);
      expect(isAuthorized).to.be.true;
      
      const processorHashes = await baseGenericPaymentVerifier.getProcessorHashes(subjectPaymentMethod);
      expect(processorHashes).to.contain(subjectProcessorHash);
    });

    it("should emit the ProcessorHashAdded event", async () => {
      await expect(subject()).to.emit(baseGenericPaymentVerifier, "ProcessorHashAdded")
        .withArgs(subjectPaymentMethod, subjectProcessorHash);
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Payment method does not exist");
      });
    });

    describe("when processor hash is zero", async () => {
      beforeEach(async () => {
        subjectProcessorHash = ethers.constants.HashZero;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Invalid processor hash");
      });
    });

    describe("when processor hash already exists", async () => {
      beforeEach(async () => {
        subjectProcessorHash = "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"; // Already added in setup
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Already authorized");
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

  describe("#removeProcessorHash", async () => {
    let subjectPaymentMethod: string;
    let subjectProcessorHash: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectProcessorHash = "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8";
      
      // Add a payment method with processor hash
      await baseGenericPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        [subjectProcessorHash],
        [usdCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await baseGenericPaymentVerifier.connect(subjectCaller.wallet).removeProcessorHash(subjectPaymentMethod, subjectProcessorHash);
    }

    it("should remove the processor hash", async () => {
      await subject();
      
      const isAuthorized = await baseGenericPaymentVerifier.isProcessorHash(subjectPaymentMethod, subjectProcessorHash);
      expect(isAuthorized).to.be.false;
      
      const processorHashes = await baseGenericPaymentVerifier.getProcessorHashes(subjectPaymentMethod);
      expect(processorHashes).to.not.contain(subjectProcessorHash);
    });

    it("should emit the ProcessorHashRemoved event", async () => {
      await expect(subject()).to.emit(baseGenericPaymentVerifier, "ProcessorHashRemoved")
        .withArgs(subjectPaymentMethod, subjectProcessorHash);
    });

    describe("when processor hash is not authorized", async () => {
      beforeEach(async () => {
        subjectProcessorHash = "0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9";
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Not authorized");
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

  describe("#addCurrency", async () => {
    let subjectPaymentMethod: string;
    let subjectCurrency: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Add a payment method first
      await baseGenericPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"],
        [usdCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectCurrency = eurCurrencyHash;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await baseGenericPaymentVerifier.connect(subjectCaller.wallet).addCurrency(subjectPaymentMethod, subjectCurrency);
    }

    it("should add the currency", async () => {
      await subject();
      
      const isSupported = await baseGenericPaymentVerifier.isCurrency(subjectPaymentMethod, subjectCurrency);
      expect(isSupported).to.be.true;
      
      const currencies = await baseGenericPaymentVerifier.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.contain(subjectCurrency);
    });

    it("should emit the CurrencyAdded event", async () => {
      await expect(subject()).to.emit(baseGenericPaymentVerifier, "CurrencyAdded")
        .withArgs(subjectPaymentMethod, subjectCurrency);
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Payment method does not exist");
      });
    });

    describe("when currency already exists", async () => {
      beforeEach(async () => {
        subjectCurrency = usdCurrencyHash; // Already added in setup
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Currency already supported");
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

  describe("#removeCurrency", async () => {
    let subjectPaymentMethod: string;
    let subjectCurrency: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectCurrency = usdCurrencyHash;
      
      // Add a payment method with currency
      await baseGenericPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"],
        [subjectCurrency]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await baseGenericPaymentVerifier.connect(subjectCaller.wallet).removeCurrency(subjectPaymentMethod, subjectCurrency);
    }

    it("should remove the currency", async () => {
      await subject();
      
      const isSupported = await baseGenericPaymentVerifier.isCurrency(subjectPaymentMethod, subjectCurrency);
      expect(isSupported).to.be.false;
      
      const currencies = await baseGenericPaymentVerifier.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.not.contain(subjectCurrency);
    });

    it("should emit the CurrencyRemoved event", async () => {
      await expect(subject()).to.emit(baseGenericPaymentVerifier, "CurrencyRemoved")
        .withArgs(subjectPaymentMethod, subjectCurrency);
    });

    describe("when currency is not supported", async () => {
      beforeEach(async () => {
        subjectCurrency = eurCurrencyHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Currency not supported");
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
      await baseGenericPaymentVerifier.addPaymentMethod(
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
      return await baseGenericPaymentVerifier.connect(subjectCaller.wallet).removePaymentMethod(subjectPaymentMethod);
    }

    it("should remove the payment method", async () => {
      await subject();
      
      const paymentMethods = await baseGenericPaymentVerifier.getPaymentMethods();
      expect(paymentMethods).to.not.contain(subjectPaymentMethod);
      
      // Should revert when trying to access removed payment method
      await expect(baseGenericPaymentVerifier.getTimestampBuffer(subjectPaymentMethod))
        .to.be.revertedWith("BaseGenericPaymentVerifier: Payment method does not exist");
    });

    it("should remove all processor hashes", async () => {
      const processorHashBefore = "0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8";
      expect(await baseGenericPaymentVerifier.isProcessorHash(subjectPaymentMethod, processorHashBefore)).to.be.true;
      
      await subject();
      
      expect(await baseGenericPaymentVerifier.isProcessorHash(subjectPaymentMethod, processorHashBefore)).to.be.false;
    });

    it("should remove all currencies", async () => {
      expect(await baseGenericPaymentVerifier.isCurrency(subjectPaymentMethod, usdCurrencyHash)).to.be.true;
      
      await subject();
      
      expect(await baseGenericPaymentVerifier.isCurrency(subjectPaymentMethod, usdCurrencyHash)).to.be.false;
    });

    it("should emit the PaymentMethodRemoved event", async () => {
      await expect(subject()).to.emit(baseGenericPaymentVerifier, "PaymentMethodRemoved")
        .withArgs(subjectPaymentMethod);
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("BaseGenericPaymentVerifier: Payment method does not exist");
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
      await baseGenericPaymentVerifier.addPaymentMethod(
        venmoPaymentMethodHash,
        BigNumber.from(30),
        ["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"],
        [usdCurrencyHash]
      );
      
      await baseGenericPaymentVerifier.addPaymentMethod(
        paypalPaymentMethodHash,
        BigNumber.from(60),
        ["0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"],
        [eurCurrencyHash]
      );
    });

    describe("#getPaymentMethods", async () => {
      it("should return all payment methods", async () => {
        const paymentMethods = await baseGenericPaymentVerifier.getPaymentMethods();
        expect(paymentMethods).to.contain(venmoPaymentMethodHash);
        expect(paymentMethods).to.contain(paypalPaymentMethodHash);
        expect(paymentMethods.length).to.eq(2);
      });
    });

    describe("#getTimestampBuffer", async () => {
      it("should return the correct timestamp buffer", async () => {
        const venmoBuffer = await baseGenericPaymentVerifier.getTimestampBuffer(venmoPaymentMethodHash);
        const paypalBuffer = await baseGenericPaymentVerifier.getTimestampBuffer(paypalPaymentMethodHash);
        
        expect(venmoBuffer).to.eq(BigNumber.from(30));
        expect(paypalBuffer).to.eq(BigNumber.from(60));
      });

      describe("when payment method does not exist", async () => {
        it("should revert", async () => {
          const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
          await expect(baseGenericPaymentVerifier.getTimestampBuffer(nonExistentMethod))
            .to.be.revertedWith("BaseGenericPaymentVerifier: Payment method does not exist");
        });
      });
    });

    describe("#getProcessorHashes", async () => {
      it("should return the correct processor hashes", async () => {
        const venmoHashes = await baseGenericPaymentVerifier.getProcessorHashes(venmoPaymentMethodHash);
        const paypalHashes = await baseGenericPaymentVerifier.getProcessorHashes(paypalPaymentMethodHash);
        
        expect(venmoHashes).to.deep.eq(["0xc46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a8"]);
        expect(paypalHashes).to.deep.eq(["0xd46df13daeb32109c4623d5f1554823a92b84a4e837287c718605911872729a9"]);
      });

      describe("when payment method does not exist", async () => {
        it("should revert", async () => {
          const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
          await expect(baseGenericPaymentVerifier.getProcessorHashes(nonExistentMethod))
            .to.be.revertedWith("BaseGenericPaymentVerifier: Payment method does not exist");
        });
      });
    });

    describe("#getCurrencies", async () => {
      it("should return the correct currencies", async () => {
        const venmoCurrencies = await baseGenericPaymentVerifier.getCurrencies(venmoPaymentMethodHash);
        const paypalCurrencies = await baseGenericPaymentVerifier.getCurrencies(paypalPaymentMethodHash);
        
        expect(venmoCurrencies).to.deep.eq([usdCurrencyHash]);
        expect(paypalCurrencies).to.deep.eq([eurCurrencyHash]);
      });

      describe("when payment method does not exist", async () => {
        it("should revert", async () => {
          const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
          await expect(baseGenericPaymentVerifier.getCurrencies(nonExistentMethod))
            .to.be.revertedWith("BaseGenericPaymentVerifier: Payment method does not exist");
        });
      });
    });
  });
});