import "module-alias/register";

import { Account } from "@utils/test/types";
import { PostIntentHookRegistry } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import { Address } from "@utils/types";
import { ethers } from "hardhat";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

describe("PostIntentHookRegistry", () => {
  let owner: Account;
  let hook: Account;
  let attacker: Account;

  let postIntentHookRegistry: PostIntentHookRegistry;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      owner,
      hook,
      attacker,
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    postIntentHookRegistry = await deployer.deployPostIntentHookRegistry();
  });

  describe("#constructor", async () => {
    it("should have the correct owner set", async () => {
      const registryOwner = await postIntentHookRegistry.owner();
      expect(registryOwner).to.eq(owner.address);
    });
  });

  describe("#addPostIntentHook", async () => {
    let subjectHook: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectHook = hook.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await postIntentHookRegistry.connect(subjectCaller.wallet).addPostIntentHook(subjectHook);
    }

    it("should correctly add the post intent hook", async () => {
      await subject();

      const isWhitelisted = await postIntentHookRegistry.whitelistedHooks(subjectHook);
      const hooks = await postIntentHookRegistry.getWhitelistedHooks();

      expect(isWhitelisted).to.be.true;
      expect(hooks).to.contain(subjectHook);
    });

    it("should emit the correct PostIntentHookAdded event", async () => {
      await expect(subject()).to.emit(postIntentHookRegistry, "PostIntentHookAdded").withArgs(
        subjectHook
      );
    });

    describe("when the hook is zero address", async () => {
      beforeEach(async () => {
        subjectHook = ethers.constants.AddressZero;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Hook cannot be zero address");
      });
    });

    describe("when the hook has already been added", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Hook already whitelisted");
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

  describe("#removePostIntentHook", async () => {
    let subjectHook: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      await postIntentHookRegistry.addPostIntentHook(hook.address);

      subjectHook = hook.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await postIntentHookRegistry.connect(subjectCaller.wallet).removePostIntentHook(subjectHook);
    }

    it("should correctly remove the post intent hook", async () => {
      await subject();

      const isWhitelisted = await postIntentHookRegistry.whitelistedHooks(subjectHook);
      const hooks = await postIntentHookRegistry.getWhitelistedHooks();

      expect(isWhitelisted).to.be.false;
      expect(hooks).to.not.contain(subjectHook);
    });

    it("should emit the correct PostIntentHookRemoved event", async () => {
      await expect(subject()).to.emit(postIntentHookRegistry, "PostIntentHookRemoved").withArgs(
        subjectHook
      );
    });

    describe("when the hook is not whitelisted", async () => {
      beforeEach(async () => {
        subjectHook = attacker.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Hook not whitelisted");
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

  describe("#isWhitelistedHook", async () => {
    let subjectHook: Address;

    beforeEach(async () => {
      await postIntentHookRegistry.addPostIntentHook(hook.address);

      subjectHook = hook.address;
    });

    async function subject(): Promise<boolean> {
      return await postIntentHookRegistry.isWhitelistedHook(subjectHook);
    }

    it("should return true for whitelisted hook", async () => {
      const result = await subject();
      expect(result).to.be.true;
    });

    describe("when hook is not whitelisted", async () => {
      beforeEach(async () => {
        subjectHook = attacker.address;
      });

      it("should return false", async () => {
        const result = await subject();
        expect(result).to.be.false;
      });
    });
  });

  describe("#getWhitelistedHooks", async () => {
    beforeEach(async () => {
      await postIntentHookRegistry.addPostIntentHook(hook.address);
      await postIntentHookRegistry.addPostIntentHook(owner.address);
    });

    async function subject(): Promise<Address[]> {
      return await postIntentHookRegistry.getWhitelistedHooks();
    }

    it("should return all whitelisted hooks", async () => {
      const result = await subject();
      expect(result).to.have.lengthOf(2);
      expect(result).to.include(hook.address);
      expect(result).to.include(owner.address);
    });
  });
}); 