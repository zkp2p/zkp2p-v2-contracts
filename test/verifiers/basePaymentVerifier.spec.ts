import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { Account } from "@utils/test/types";
import { BasePaymentVerifier, NullifierRegistry } from "@utils/contracts"; // Adjust the import paths as necessary
import DeployHelper from "@utils/deploys";
import { Address } from "@utils/types";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

describe.only("BasePaymentVerifier", () => {
  let owner: Account;
  let writer: Account;
  let attacker: Account;
  let escrow: Account;

  let basePaymentVerifier: BasePaymentVerifier;
  let nullifierRegistry: NullifierRegistry;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      owner,
      writer,
      attacker,
      escrow
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    // Deploy the nullifier registry
    nullifierRegistry = await deployer.deployNullifierRegistry();

    // Deploy the BasePaymentVerifier
    basePaymentVerifier = await deployer.deployBasePaymentVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      ["USD", "EUR", "INR"]
    );
  });

  describe("#constructor", async () => {
    it("should have the correct owner set", async () => {
      const keyHash = await basePaymentVerifier.owner();
      expect(keyHash).to.eq(owner.address);
    });

    it("should set the correct timestamp buffer", async () => {
      const buffer = await basePaymentVerifier.timestampBuffer();
      expect(buffer).to.eq(BigNumber.from(30));
    });

    it("should set the correct currencies", async () => {
      const currencies = await basePaymentVerifier.getCurrencies();
      expect(currencies).to.deep.equal(["USD", "EUR", "INR"]);
    });
  });

  describe("#addCurrency", async () => {
    let subjectCurrency: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectCurrency = "SGD";
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await basePaymentVerifier.connect(subjectCaller.wallet).addCurrency(subjectCurrency);
    }

    it("should correctly add a currency", async () => {
      await subject();
      expect(await basePaymentVerifier.isCurrency(subjectCurrency)).to.be.true;
    });

    it("should emit the correct CurrencyAdded event", async () => {
      await expect(subject()).to.emit(basePaymentVerifier, "CurrencyAdded").withArgs(subjectCurrency);
    });

    describe("when the currency has already been added", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency already added");
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
    let subjectCurrency: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectCurrency = "SGD";
      subjectCaller = owner;
      await basePaymentVerifier.addCurrency(subjectCurrency);
    });

    async function subject(): Promise<any> {
      return await basePaymentVerifier.connect(subjectCaller.wallet).removeCurrency(subjectCurrency);
    }

    it("should correctly remove a currency", async () => {
      await subject();
      expect(await basePaymentVerifier.isCurrency(subjectCurrency)).to.be.false;
    });

    it("should emit the correct CurrencyRemoved event", async () => {
      await expect(subject()).to.emit(basePaymentVerifier, "CurrencyRemoved").withArgs(subjectCurrency);
    });

    describe("when the currency has not been added", async () => {
      beforeEach(async () => {
        await basePaymentVerifier.removeCurrency(subjectCurrency);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency not added");
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
    let subjectBuffer: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectBuffer = BigNumber.from(60);
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await basePaymentVerifier.connect(subjectCaller.wallet).setTimestampBuffer(subjectBuffer);
    }

    it("should set the timestamp buffer correctly", async () => {
      await subject();
      expect(await basePaymentVerifier.timestampBuffer()).to.equal(subjectBuffer);
    });

    it("should emit the TimestampBufferSet event", async () => {
      await expect(subject()).to.emit(basePaymentVerifier, "TimestampBufferSet").withArgs(subjectBuffer);
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
});
