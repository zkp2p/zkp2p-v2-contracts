import "module-alias/register";

import { BigNumber } from "ethers";

import { Account } from "@utils/test/types";
import { EscrowRegistry } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import { Address } from "@utils/types";
import { ethers } from "hardhat";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

describe("EscrowRegistry", () => {
  let owner: Account;
  let escrow: Account;
  let attacker: Account;

  let escrowRegistry: EscrowRegistry;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      owner,
      escrow,
      attacker,
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    escrowRegistry = await deployer.deployEscrowRegistry();
  });

  describe("#constructor", async () => {
    it("should have the correct owner set", async () => {
      const registryOwner = await escrowRegistry.owner();
      expect(registryOwner).to.eq(owner.address);
    });

    it("should have acceptAllEscrows set to false", async () => {
      const acceptAll = await escrowRegistry.acceptAllEscrows();
      expect(acceptAll).to.be.false;
    });
  });

  describe("#addEscrow", async () => {
    let subjectEscrow: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectEscrow = escrow.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await escrowRegistry.connect(subjectCaller.wallet).addEscrow(subjectEscrow);
    }

    it("should correctly add the escrow", async () => {
      await subject();

      const isWhitelisted = await escrowRegistry.isWhitelistedEscrow(subjectEscrow);
      const escrows = await escrowRegistry.getWhitelistedEscrows();

      expect(isWhitelisted).to.be.true;
      expect(escrows).to.contain(subjectEscrow);
    });

    it("should emit the correct EscrowAdded event", async () => {
      await expect(subject()).to.emit(escrowRegistry, "EscrowAdded").withArgs(
        subjectEscrow
      );
    });

    describe("when the escrow is zero address", async () => {
      beforeEach(async () => {
        subjectEscrow = ethers.constants.AddressZero;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Escrow cannot be zero address");
      });
    });

    describe("when the escrow has already been added", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Escrow already whitelisted");
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

  describe("#removeEscrow", async () => {
    let subjectEscrow: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      await escrowRegistry.addEscrow(escrow.address);

      subjectEscrow = escrow.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await escrowRegistry.connect(subjectCaller.wallet).removeEscrow(subjectEscrow);
    }

    it("should correctly remove the escrow", async () => {
      await subject();

      const isWhitelisted = await escrowRegistry.isWhitelistedEscrow(subjectEscrow);
      const escrows = await escrowRegistry.getWhitelistedEscrows();

      expect(isWhitelisted).to.be.false;
      expect(escrows).to.not.contain(subjectEscrow);
    });

    it("should emit the correct EscrowRemoved event", async () => {
      await expect(subject()).to.emit(escrowRegistry, "EscrowRemoved").withArgs(
        subjectEscrow
      );
    });

    describe("when the escrow is not whitelisted", async () => {
      beforeEach(async () => {
        subjectEscrow = attacker.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Escrow not whitelisted");
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

  describe("#setAcceptAllEscrows", async () => {
    let subjectAcceptAll: boolean;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectAcceptAll = true;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await escrowRegistry.connect(subjectCaller.wallet).setAcceptAllEscrows(subjectAcceptAll);
    }

    it("should correctly set acceptAllEscrows", async () => {
      await subject();

      const acceptAll = await escrowRegistry.acceptAllEscrows();
      expect(acceptAll).to.eq(subjectAcceptAll);
    });

    it("should emit the correct AcceptAllEscrowsUpdated event", async () => {
      await expect(subject()).to.emit(escrowRegistry, "AcceptAllEscrowsUpdated").withArgs(
        subjectAcceptAll
      );
    });

    describe("when setting to false", async () => {
      beforeEach(async () => {
        await escrowRegistry.setAcceptAllEscrows(true);
        subjectAcceptAll = false;
      });

      it("should correctly set acceptAllEscrows to false", async () => {
        await subject();

        const acceptAll = await escrowRegistry.acceptAllEscrows();
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

  describe("#isWhitelistedEscrow", async () => {
    let subjectEscrow: Address;

    beforeEach(async () => {
      await escrowRegistry.addEscrow(escrow.address);

      subjectEscrow = escrow.address;
    });

    async function subject(): Promise<boolean> {
      return await escrowRegistry.isWhitelistedEscrow(subjectEscrow);
    }

    it("should return true for whitelisted escrow", async () => {
      const result = await subject();
      expect(result).to.be.true;
    });

    describe("when escrow is not whitelisted", async () => {
      beforeEach(async () => {
        subjectEscrow = attacker.address;
      });

      it("should return false", async () => {
        const result = await subject();
        expect(result).to.be.false;
      });
    });
  });

  describe("#isAcceptingAllEscrows", async () => {
    async function subject(): Promise<boolean> {
      return await escrowRegistry.isAcceptingAllEscrows();
    }

    it("should return false by default", async () => {
      const result = await subject();
      expect(result).to.be.false;
    });

    describe("when acceptAllEscrows is set to true", async () => {
      beforeEach(async () => {
        await escrowRegistry.setAcceptAllEscrows(true);
      });

      it("should return true", async () => {
        const result = await subject();
        expect(result).to.be.true;
      });
    });
  });
});