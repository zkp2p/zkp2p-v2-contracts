import "module-alias/register";

import { BigNumber } from "ethers";

import { Account } from "@utils/test/types";
import { PaymentVerifierRegistry } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import { Address } from "@utils/types";
import { ethers } from "hardhat";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

describe.only("PaymentVerifierRegistry", () => {
  let owner: Account;
  let verifier: Account;
  let attacker: Account;

  let paymentVerifierRegistry: PaymentVerifierRegistry;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      owner,
      verifier,
      attacker,
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    paymentVerifierRegistry = await deployer.deployPaymentVerifierRegistry(owner.address);
  });

  describe("#constructor", async () => {
    it("should have the correct owner set", async () => {
      const registryOwner = await paymentVerifierRegistry.owner();
      expect(registryOwner).to.eq(owner.address);
    });

    it("should have acceptAllVerifiers set to false", async () => {
      const acceptAll = await paymentVerifierRegistry.acceptAllVerifiers();
      expect(acceptAll).to.be.false;
    });
  });

  describe("#addPaymentVerifier", async () => {
    let subjectVerifier: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectVerifier = verifier.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await paymentVerifierRegistry.connect(subjectCaller.wallet).addPaymentVerifier(subjectVerifier);
    }

    it("should correctly add the payment verifier", async () => {
      await subject();

      const isWhitelisted = await paymentVerifierRegistry.whitelistedVerifiers(subjectVerifier);
      const verifiers = await paymentVerifierRegistry.getWhitelistedVerifiers();

      expect(isWhitelisted).to.be.true;
      expect(verifiers).to.contain(subjectVerifier);
    });

    it("should emit the correct PaymentVerifierAdded event", async () => {
      await expect(subject()).to.emit(paymentVerifierRegistry, "PaymentVerifierAdded").withArgs(
        subjectVerifier
      );
    });

    describe("when the verifier is zero address", async () => {
      beforeEach(async () => {
        subjectVerifier = ethers.constants.AddressZero;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verifier cannot be zero address");
      });
    });

    describe("when the verifier has already been added", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verifier already whitelisted");
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

  describe("#removePaymentVerifier", async () => {
    let subjectVerifier: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      await paymentVerifierRegistry.addPaymentVerifier(verifier.address);

      subjectVerifier = verifier.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await paymentVerifierRegistry.connect(subjectCaller.wallet).removePaymentVerifier(subjectVerifier);
    }

    it("should correctly remove the payment verifier", async () => {
      await subject();

      const isWhitelisted = await paymentVerifierRegistry.whitelistedVerifiers(subjectVerifier);
      const verifiers = await paymentVerifierRegistry.getWhitelistedVerifiers();

      expect(isWhitelisted).to.be.false;
      expect(verifiers).to.not.contain(subjectVerifier);
    });

    it("should emit the correct PaymentVerifierRemoved event", async () => {
      await expect(subject()).to.emit(paymentVerifierRegistry, "PaymentVerifierRemoved").withArgs(
        subjectVerifier
      );
    });

    describe("when the verifier is not whitelisted", async () => {
      beforeEach(async () => {
        subjectVerifier = attacker.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verifier not whitelisted");
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

  describe("#setAcceptAllVerifiers", async () => {
    let subjectAcceptAll: boolean;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectAcceptAll = true;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await paymentVerifierRegistry.connect(subjectCaller.wallet).setAcceptAllVerifiers(subjectAcceptAll);
    }

    it("should correctly set acceptAllVerifiers", async () => {
      await subject();

      const acceptAll = await paymentVerifierRegistry.acceptAllVerifiers();
      expect(acceptAll).to.eq(subjectAcceptAll);
    });

    it("should emit the correct AcceptAllVerifiersUpdated event", async () => {
      await expect(subject()).to.emit(paymentVerifierRegistry, "AcceptAllVerifiersUpdated").withArgs(
        subjectAcceptAll
      );
    });

    describe("when setting to false", async () => {
      beforeEach(async () => {
        await paymentVerifierRegistry.setAcceptAllVerifiers(true);
        subjectAcceptAll = false;
      });

      it("should correctly set acceptAllVerifiers to false", async () => {
        await subject();

        const acceptAll = await paymentVerifierRegistry.acceptAllVerifiers();
        expect(acceptAll).to.be.false;
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

  describe("#isWhitelistedVerifier", async () => {
    let subjectVerifier: Address;

    beforeEach(async () => {
      await paymentVerifierRegistry.addPaymentVerifier(verifier.address);

      subjectVerifier = verifier.address;
    });

    async function subject(): Promise<boolean> {
      return await paymentVerifierRegistry.isWhitelistedVerifier(subjectVerifier);
    }

    it("should return true for whitelisted verifier", async () => {
      const result = await subject();
      expect(result).to.be.true;
    });

    describe("when verifier is not whitelisted", async () => {
      beforeEach(async () => {
        subjectVerifier = attacker.address;
      });

      it("should return false", async () => {
        const result = await subject();
        expect(result).to.be.false;
      });
    });
  });

  describe("#isAcceptingAllVerifiers", async () => {
    async function subject(): Promise<boolean> {
      return await paymentVerifierRegistry.isAcceptingAllVerifiers();
    }

    it("should return false by default", async () => {
      const result = await subject();
      expect(result).to.be.false;
    });

    describe("when acceptAllVerifiers is set to true", async () => {
      beforeEach(async () => {
        await paymentVerifierRegistry.setAcceptAllVerifiers(true);
      });

      it("should return true", async () => {
        const result = await subject();
        expect(result).to.be.true;
      });
    });
  });
}); 