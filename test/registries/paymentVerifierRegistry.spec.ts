import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber } from "ethers";

import { PaymentVerifierRegistry } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address } from "@utils/types";
import DeployHelper from "@utils/deploys";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

describe("PaymentVerifierRegistry", () => {
  let owner: Account;
  let attacker: Account;
  let verifier1: Account;
  let verifier2: Account;
  let verifier3: Account;

  let paymentVerifierRegistry: PaymentVerifierRegistry;

  let deployer: DeployHelper;

  const venmoPaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("venmo"));
  const paypalPaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("paypal"));
  const wisePaymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("wise"));

  const usdCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("USD"));
  const eurCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EUR"));
  const gbpCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GBP"));
  const jpyCurrencyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("JPY"));

  beforeEach(async () => {
    [
      owner,
      attacker,
      verifier1,
      verifier2,
      verifier3
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    paymentVerifierRegistry = await deployer.deployPaymentVerifierRegistry();
  });

  describe("#constructor", async () => {
    it("should have the correct owner set", async () => {
      const contractOwner = await paymentVerifierRegistry.owner();
      expect(contractOwner).to.eq(owner.address);
    });

    it("should have empty payment methods array", async () => {
      const paymentMethods = await paymentVerifierRegistry.getPaymentMethods();
      expect(paymentMethods).to.deep.eq([]);
    });
  });

  describe("#addPaymentMethod", async () => {
    let subjectPaymentMethod: string;
    let subjectVerifier: Address;
    let subjectCurrencies: string[];
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectVerifier = verifier1.address;
      subjectCurrencies = [usdCurrencyHash, eurCurrencyHash];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await paymentVerifierRegistry.connect(subjectCaller.wallet).addPaymentMethod(
        subjectPaymentMethod,
        subjectVerifier,
        subjectCurrencies
      );
    }

    it("should add the payment method", async () => {
      await subject();

      const isPaymentMethod = await paymentVerifierRegistry.isPaymentMethod(subjectPaymentMethod);
      expect(isPaymentMethod).to.be.true;

      const paymentMethods = await paymentVerifierRegistry.getPaymentMethods();
      expect(paymentMethods).to.contain(subjectPaymentMethod);
      expect(paymentMethods.length).to.eq(1);
    });

    it("should set the correct verifier", async () => {
      await subject();

      const verifier = await paymentVerifierRegistry.getVerifier(subjectPaymentMethod);
      expect(verifier).to.eq(subjectVerifier);
    });

    it("should add all currencies", async () => {
      await subject();

      const currencies = await paymentVerifierRegistry.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.deep.eq(subjectCurrencies);

      for (const currency of subjectCurrencies) {
        const isSupported = await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, currency);
        expect(isSupported).to.be.true;
      }
    });

    it("should emit the PaymentMethodAdded event", async () => {
      await expect(subject()).to.emit(paymentVerifierRegistry, "PaymentMethodAdded")
        .withArgs(subjectPaymentMethod);
    });

    it("should emit CurrencyAdded events", async () => {
      const tx = await subject();

      for (const currency of subjectCurrencies) {
        await expect(tx).to.emit(paymentVerifierRegistry, "CurrencyAdded")
          .withArgs(subjectPaymentMethod, currency);
      }
    });

    describe("when payment method already exists", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment method already exists");
      });
    });

    describe("when verifier is zero address", async () => {
      beforeEach(async () => {
        subjectVerifier = ethers.constants.AddressZero;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid verifier");
      });
    });

    describe("when empty currencies array provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid currencies length");
      });
    });

    describe("when currency is bytes32(0)", async () => {
      beforeEach(async () => {
        subjectCurrencies = [usdCurrencyHash, ethers.constants.HashZero, eurCurrencyHash];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid currency code");
      });
    });

    describe("when duplicate currencies provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [usdCurrencyHash, eurCurrencyHash, usdCurrencyHash];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency already exists");
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
      // Add payment methods first
      await paymentVerifierRegistry.addPaymentMethod(
        venmoPaymentMethodHash,
        verifier1.address,
        [usdCurrencyHash, eurCurrencyHash]
      );

      await paymentVerifierRegistry.addPaymentMethod(
        paypalPaymentMethodHash,
        verifier2.address,
        [gbpCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await paymentVerifierRegistry.connect(subjectCaller.wallet).removePaymentMethod(subjectPaymentMethod);
    }

    it("should remove the payment method", async () => {
      await subject();

      const isPaymentMethod = await paymentVerifierRegistry.isPaymentMethod(subjectPaymentMethod);
      expect(isPaymentMethod).to.be.false;

      const paymentMethods = await paymentVerifierRegistry.getPaymentMethods();
      expect(paymentMethods).to.not.contain(subjectPaymentMethod);
      expect(paymentMethods).to.contain(paypalPaymentMethodHash);
      expect(paymentMethods.length).to.eq(1);
    });

    it("should remove all associated currencies", async () => {
      // Check currencies exist before removal
      expect(await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, usdCurrencyHash)).to.be.true;
      expect(await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, eurCurrencyHash)).to.be.true;

      await subject();

      // Check currencies are removed
      expect(await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, usdCurrencyHash)).to.be.false;
      expect(await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, eurCurrencyHash)).to.be.false;
    });

    it("should clear the verifier", async () => {
      await subject();

      // Trying to get verifier for removed payment method should revert
      await expect(paymentVerifierRegistry.getVerifier(subjectPaymentMethod))
        .to.be.revertedWith("Payment method does not exist");
    });

    it("should set initialized to false", async () => {
      await subject();
      const isInitialized = await paymentVerifierRegistry.isPaymentMethod(subjectPaymentMethod);
      expect(isInitialized).to.be.false;
    });

    it("should emit the PaymentMethodRemoved event", async () => {
      await expect(subject()).to.emit(paymentVerifierRegistry, "PaymentMethodRemoved")
        .withArgs(subjectPaymentMethod);
    });

    it("should emit CurrencyRemoved events for each currency", async () => {
      const tx = await subject();

      await expect(tx).to.emit(paymentVerifierRegistry, "CurrencyRemoved")
        .withArgs(subjectPaymentMethod, usdCurrencyHash);
      await expect(tx).to.emit(paymentVerifierRegistry, "CurrencyRemoved")
        .withArgs(subjectPaymentMethod, eurCurrencyHash);
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = wisePaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment method does not exist");
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
      await paymentVerifierRegistry.addPaymentMethod(
        venmoPaymentMethodHash,
        verifier1.address,
        [usdCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectCurrencies = [eurCurrencyHash, gbpCurrencyHash];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await paymentVerifierRegistry.connect(subjectCaller.wallet).addCurrencies(
        subjectPaymentMethod,
        subjectCurrencies
      );
    }

    it("should add multiple currencies in a single transaction", async () => {
      await subject();

      // Check EUR is supported
      const isEurSupported = await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, eurCurrencyHash);
      expect(isEurSupported).to.be.true;

      // Check GBP is supported
      const isGbpSupported = await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, gbpCurrencyHash);
      expect(isGbpSupported).to.be.true;

      const currencies = await paymentVerifierRegistry.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.contain(eurCurrencyHash);
      expect(currencies).to.contain(gbpCurrencyHash);
      expect(currencies).to.contain(usdCurrencyHash); // Previously added
      expect(currencies.length).to.eq(3);
    });

    it("should add a single currency (array with one element)", async () => {
      subjectCurrencies = [eurCurrencyHash];

      await subject();

      const isSupported = await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, eurCurrencyHash);
      expect(isSupported).to.be.true;

      const currencies = await paymentVerifierRegistry.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.contain(eurCurrencyHash);
      expect(currencies.length).to.eq(2); // USD + EUR
    });

    it("should emit CurrencyAdded events for each currency added", async () => {
      const tx = await subject();

      await expect(tx).to.emit(paymentVerifierRegistry, "CurrencyAdded")
        .withArgs(subjectPaymentMethod, eurCurrencyHash);
      await expect(tx).to.emit(paymentVerifierRegistry, "CurrencyAdded")
        .withArgs(subjectPaymentMethod, gbpCurrencyHash);
    });

    describe("when empty array is provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid currencies length");
      });
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment method does not exist");
      });
    });

    describe("when invalid currency code (bytes32(0)) is provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [eurCurrencyHash, ethers.constants.HashZero, gbpCurrencyHash];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid currency code");
      });
    });

    describe("when already supported currency is included", async () => {
      beforeEach(async () => {
        subjectCurrencies = [eurCurrencyHash, usdCurrencyHash, gbpCurrencyHash]; // USD already added in setup
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency already exists");
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
      await paymentVerifierRegistry.addPaymentMethod(
        venmoPaymentMethodHash,
        verifier1.address,
        [usdCurrencyHash, eurCurrencyHash, gbpCurrencyHash, jpyCurrencyHash]
      );

      subjectPaymentMethod = venmoPaymentMethodHash;
      subjectCurrencies = [usdCurrencyHash, gbpCurrencyHash];
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await paymentVerifierRegistry.connect(subjectCaller.wallet).removeCurrencies(
        subjectPaymentMethod,
        subjectCurrencies
      );
    }

    it("should remove multiple currencies in a single transaction", async () => {
      await subject();

      // Check that removed currencies are no longer supported
      const isUsdSupported = await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, usdCurrencyHash);
      expect(isUsdSupported).to.be.false;

      const isGbpSupported = await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, gbpCurrencyHash);
      expect(isGbpSupported).to.be.false;

      // Check that non-removed currencies are still supported
      const isEurSupported = await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, eurCurrencyHash);
      expect(isEurSupported).to.be.true;

      const isJpySupported = await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, jpyCurrencyHash);
      expect(isJpySupported).to.be.true;

      // Check the currencies array
      const currencies = await paymentVerifierRegistry.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.not.contain(usdCurrencyHash);
      expect(currencies).to.not.contain(gbpCurrencyHash);
      expect(currencies).to.contain(eurCurrencyHash);
      expect(currencies).to.contain(jpyCurrencyHash);
      expect(currencies.length).to.eq(2);
    });

    it("should remove a single currency (array with one element)", async () => {
      subjectCurrencies = [usdCurrencyHash];

      await subject();

      const isSupported = await paymentVerifierRegistry.isCurrency(subjectPaymentMethod, usdCurrencyHash);
      expect(isSupported).to.be.false;

      const currencies = await paymentVerifierRegistry.getCurrencies(subjectPaymentMethod);
      expect(currencies).to.not.contain(usdCurrencyHash);
      expect(currencies).to.contain(eurCurrencyHash);
      expect(currencies).to.contain(gbpCurrencyHash);
      expect(currencies).to.contain(jpyCurrencyHash);
      expect(currencies.length).to.eq(3);
    });

    it("should emit CurrencyRemoved events for each currency removed", async () => {
      const tx = await subject();

      await expect(tx).to.emit(paymentVerifierRegistry, "CurrencyRemoved")
        .withArgs(subjectPaymentMethod, usdCurrencyHash);
      await expect(tx).to.emit(paymentVerifierRegistry, "CurrencyRemoved")
        .withArgs(subjectPaymentMethod, gbpCurrencyHash);
    });

    describe("when empty array is provided", async () => {
      beforeEach(async () => {
        subjectCurrencies = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid currencies length");
      });
    });

    describe("when non-supported currency is included", async () => {
      beforeEach(async () => {
        const nonSupportedCurrency = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CAD"));
        subjectCurrencies = [usdCurrencyHash, nonSupportedCurrency, eurCurrencyHash];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency does not exist");
      });
    });

    describe("when payment method does not exist", async () => {
      beforeEach(async () => {
        subjectPaymentMethod = paypalPaymentMethodHash;
        subjectCurrencies = [usdCurrencyHash];
      });

      it("should revert on internal call", async () => {
        // The contract doesn't check if payment method exists in removeCurrencies,
        // but the internal _removeCurrency will fail when checking isCurrency
        await expect(subject()).to.be.revertedWith("Currency does not exist");
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
      await paymentVerifierRegistry.addPaymentMethod(
        venmoPaymentMethodHash,
        verifier1.address,
        [usdCurrencyHash, eurCurrencyHash]
      );

      await paymentVerifierRegistry.addPaymentMethod(
        paypalPaymentMethodHash,
        verifier2.address,
        [gbpCurrencyHash]
      );

      await paymentVerifierRegistry.addPaymentMethod(
        wisePaymentMethodHash,
        verifier3.address,
        [eurCurrencyHash, gbpCurrencyHash, jpyCurrencyHash]
      );
    });

    describe("#isPaymentMethod", async () => {
      it("should return true for existing payment methods", async () => {
        expect(await paymentVerifierRegistry.isPaymentMethod(venmoPaymentMethodHash)).to.be.true;
        expect(await paymentVerifierRegistry.isPaymentMethod(paypalPaymentMethodHash)).to.be.true;
        expect(await paymentVerifierRegistry.isPaymentMethod(wisePaymentMethodHash)).to.be.true;
      });

      it("should return false for non-existent payment methods", async () => {
        const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("zelle"));
        expect(await paymentVerifierRegistry.isPaymentMethod(nonExistentMethod)).to.be.false;
      });
    });

    describe("#getPaymentMethods", async () => {
      it("should return all payment methods", async () => {
        const paymentMethods = await paymentVerifierRegistry.getPaymentMethods();
        expect(paymentMethods).to.contain(venmoPaymentMethodHash);
        expect(paymentMethods).to.contain(paypalPaymentMethodHash);
        expect(paymentMethods).to.contain(wisePaymentMethodHash);
        expect(paymentMethods.length).to.eq(3);
      });
    });

    describe("#getVerifier", async () => {
      it("should return the correct verifier for each payment method", async () => {
        expect(await paymentVerifierRegistry.getVerifier(venmoPaymentMethodHash)).to.eq(verifier1.address);
        expect(await paymentVerifierRegistry.getVerifier(paypalPaymentMethodHash)).to.eq(verifier2.address);
        expect(await paymentVerifierRegistry.getVerifier(wisePaymentMethodHash)).to.eq(verifier3.address);
      });

      describe("when payment method does not exist", async () => {
        it("should revert", async () => {
          const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("cashapp"));
          await expect(paymentVerifierRegistry.getVerifier(nonExistentMethod))
            .to.be.revertedWith("Payment method does not exist");
        });
      });
    });

    describe("#isCurrency", async () => {
      it("should return true for supported currencies", async () => {
        expect(await paymentVerifierRegistry.isCurrency(venmoPaymentMethodHash, usdCurrencyHash)).to.be.true;
        expect(await paymentVerifierRegistry.isCurrency(venmoPaymentMethodHash, eurCurrencyHash)).to.be.true;
        expect(await paymentVerifierRegistry.isCurrency(paypalPaymentMethodHash, gbpCurrencyHash)).to.be.true;
        expect(await paymentVerifierRegistry.isCurrency(wisePaymentMethodHash, jpyCurrencyHash)).to.be.true;
      });

      it("should return false for unsupported currencies", async () => {
        expect(await paymentVerifierRegistry.isCurrency(venmoPaymentMethodHash, gbpCurrencyHash)).to.be.false;
        expect(await paymentVerifierRegistry.isCurrency(venmoPaymentMethodHash, jpyCurrencyHash)).to.be.false;
        expect(await paymentVerifierRegistry.isCurrency(paypalPaymentMethodHash, usdCurrencyHash)).to.be.false;
        expect(await paymentVerifierRegistry.isCurrency(wisePaymentMethodHash, usdCurrencyHash)).to.be.false;
      });

      it("should return false for non-existent payment methods", async () => {
        const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("revolut"));
        expect(await paymentVerifierRegistry.isCurrency(nonExistentMethod, usdCurrencyHash)).to.be.false;
      });
    });

    describe("#getCurrencies", async () => {
      it("should return the correct currencies for venmo", async () => {
        const currencies = await paymentVerifierRegistry.getCurrencies(venmoPaymentMethodHash);
        expect(currencies).to.deep.eq([usdCurrencyHash, eurCurrencyHash]);
      });

      it("should return the correct currencies for paypal", async () => {
        const currencies = await paymentVerifierRegistry.getCurrencies(paypalPaymentMethodHash);
        expect(currencies).to.deep.eq([gbpCurrencyHash]);
      });

      it("should return the correct currencies for wise", async () => {
        const currencies = await paymentVerifierRegistry.getCurrencies(wisePaymentMethodHash);
        expect(currencies).to.deep.eq([eurCurrencyHash, gbpCurrencyHash, jpyCurrencyHash]);
      });

      describe("when payment method does not exist", async () => {
        it("should revert", async () => {
          const nonExistentMethod = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("stripe"));
          await expect(paymentVerifierRegistry.getCurrencies(nonExistentMethod))
            .to.be.revertedWith("Payment method does not exist");
        });
      });
    });
  });

  describe("complex scenarios", async () => {
    describe("when adding and removing multiple payment methods", async () => {
      it("should maintain correct state", async () => {
        // Add venmo
        await paymentVerifierRegistry.addPaymentMethod(
          venmoPaymentMethodHash,
          verifier1.address,
          [usdCurrencyHash]
        );

        // Add paypal
        await paymentVerifierRegistry.addPaymentMethod(
          paypalPaymentMethodHash,
          verifier2.address,
          [eurCurrencyHash, gbpCurrencyHash]
        );

        // Add wise
        await paymentVerifierRegistry.addPaymentMethod(
          wisePaymentMethodHash,
          verifier3.address,
          [jpyCurrencyHash]
        );

        let paymentMethods = await paymentVerifierRegistry.getPaymentMethods();
        expect(paymentMethods.length).to.eq(3);

        // Remove paypal
        await paymentVerifierRegistry.removePaymentMethod(paypalPaymentMethodHash);

        paymentMethods = await paymentVerifierRegistry.getPaymentMethods();
        expect(paymentMethods.length).to.eq(2);
        expect(paymentMethods).to.contain(venmoPaymentMethodHash);
        expect(paymentMethods).to.contain(wisePaymentMethodHash);
        expect(paymentMethods).to.not.contain(paypalPaymentMethodHash);

        // Verify paypal data is cleared
        expect(await paymentVerifierRegistry.isPaymentMethod(paypalPaymentMethodHash)).to.be.false;
        expect(await paymentVerifierRegistry.isCurrency(paypalPaymentMethodHash, eurCurrencyHash)).to.be.false;
        expect(await paymentVerifierRegistry.isCurrency(paypalPaymentMethodHash, gbpCurrencyHash)).to.be.false;
      });
    });

    describe("when modifying currencies for multiple payment methods", async () => {
      beforeEach(async () => {
        await paymentVerifierRegistry.addPaymentMethod(
          venmoPaymentMethodHash,
          verifier1.address,
          [usdCurrencyHash]
        );

        await paymentVerifierRegistry.addPaymentMethod(
          paypalPaymentMethodHash,
          verifier2.address,
          [eurCurrencyHash]
        );
      });

      it("should handle currency modifications independently", async () => {
        // Add currencies to venmo
        await paymentVerifierRegistry.addCurrencies(venmoPaymentMethodHash, [eurCurrencyHash, gbpCurrencyHash]);

        // Add currencies to paypal
        await paymentVerifierRegistry.addCurrencies(paypalPaymentMethodHash, [gbpCurrencyHash, jpyCurrencyHash]);

        // Check venmo currencies
        let venmoCurrencies = await paymentVerifierRegistry.getCurrencies(venmoPaymentMethodHash);
        expect(venmoCurrencies).to.contain(usdCurrencyHash);
        expect(venmoCurrencies).to.contain(eurCurrencyHash);
        expect(venmoCurrencies).to.contain(gbpCurrencyHash);
        expect(venmoCurrencies.length).to.eq(3);

        // Check paypal currencies
        let paypalCurrencies = await paymentVerifierRegistry.getCurrencies(paypalPaymentMethodHash);
        expect(paypalCurrencies).to.contain(eurCurrencyHash);
        expect(paypalCurrencies).to.contain(gbpCurrencyHash);
        expect(paypalCurrencies).to.contain(jpyCurrencyHash);
        expect(paypalCurrencies.length).to.eq(3);

        // Remove some currencies from venmo
        await paymentVerifierRegistry.removeCurrencies(venmoPaymentMethodHash, [eurCurrencyHash]);

        // Verify venmo currencies updated
        venmoCurrencies = await paymentVerifierRegistry.getCurrencies(venmoPaymentMethodHash);
        expect(venmoCurrencies).to.not.contain(eurCurrencyHash);
        expect(venmoCurrencies).to.contain(usdCurrencyHash);
        expect(venmoCurrencies).to.contain(gbpCurrencyHash);
        expect(venmoCurrencies.length).to.eq(2);

        // Verify paypal currencies unchanged
        paypalCurrencies = await paymentVerifierRegistry.getCurrencies(paypalPaymentMethodHash);
        expect(paypalCurrencies.length).to.eq(3);
      });
    });
  });
});