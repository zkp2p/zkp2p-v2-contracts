import "module-alias/register";

import { BigNumber } from "ethers";

import { Account } from "@utils/test/types";
import { RelayerRegistry } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import { Address } from "@utils/types";
import { ethers } from "hardhat";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

describe("RelayerRegistry", () => {
  let owner: Account;
  let relayer: Account;
  let attacker: Account;

  let relayerRegistry: RelayerRegistry;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      owner,
      relayer,
      attacker,
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    relayerRegistry = await deployer.deployRelayerRegistry(owner.address);
  });

  describe("#constructor", async () => {
    it("should have the correct owner set", async () => {
      const registryOwner = await relayerRegistry.owner();
      expect(registryOwner).to.eq(owner.address);
    });
  });

  describe("#addRelayer", async () => {
    let subjectRelayer: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectRelayer = relayer.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await relayerRegistry.connect(subjectCaller.wallet).addRelayer(subjectRelayer);
    }

    it("should correctly add the relayer", async () => {
      await subject();

      const isWhitelisted = await relayerRegistry.isWhitelistedRelayer(subjectRelayer);
      const relayers = await relayerRegistry.getWhitelistedRelayers();

      expect(isWhitelisted).to.be.true;
      expect(relayers).to.contain(subjectRelayer);
    });

    it("should emit the correct RelayerAdded event", async () => {
      await expect(subject()).to.emit(relayerRegistry, "RelayerAdded").withArgs(
        subjectRelayer
      );
    });

    describe("when the relayer is zero address", async () => {
      beforeEach(async () => {
        subjectRelayer = ethers.constants.AddressZero;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Relayer cannot be zero address");
      });
    });

    describe("when the relayer has already been added", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Relayer already whitelisted");
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

  describe("#removeRelayer", async () => {
    let subjectRelayer: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      await relayerRegistry.addRelayer(relayer.address);

      subjectRelayer = relayer.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await relayerRegistry.connect(subjectCaller.wallet).removeRelayer(subjectRelayer);
    }

    it("should correctly remove the relayer", async () => {
      await subject();

      const isWhitelisted = await relayerRegistry.isWhitelistedRelayer(subjectRelayer);
      const relayers = await relayerRegistry.getWhitelistedRelayers();

      expect(isWhitelisted).to.be.false;
      expect(relayers).to.not.contain(subjectRelayer);
    });

    it("should emit the correct RelayerRemoved event", async () => {
      await expect(subject()).to.emit(relayerRegistry, "RelayerRemoved").withArgs(
        subjectRelayer
      );
    });

    describe("when the relayer is not whitelisted", async () => {
      beforeEach(async () => {
        subjectRelayer = attacker.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Relayer not whitelisted");
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

  describe("#isWhitelistedRelayer", async () => {
    let subjectRelayer: Address;

    beforeEach(async () => {
      await relayerRegistry.addRelayer(relayer.address);

      subjectRelayer = relayer.address;
    });

    async function subject(): Promise<boolean> {
      return await relayerRegistry.isWhitelistedRelayer(subjectRelayer);
    }

    it("should return true for whitelisted relayer", async () => {
      const result = await subject();
      expect(result).to.be.true;
    });

    describe("when relayer is not whitelisted", async () => {
      beforeEach(async () => {
        subjectRelayer = attacker.address;
      });

      it("should return false", async () => {
        const result = await subject();
        expect(result).to.be.false;
      });
    });
  });
}); 