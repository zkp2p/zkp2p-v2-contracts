import "module-alias/register";

import { ethers } from "hardhat";

import { Account } from "@utils/test/types";
import { StringConversionUtilsMock } from "@utils/contracts";
import DeployHelper from "@utils/deploys";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";
import { BigNumber } from "ethers";
import { ONE, ZERO } from "@utils/constants";

const expect = getWaffleExpect();

describe("StringConversionUtils", () => {
  let owner: Account;

  let stringUtils: StringConversionUtilsMock;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      owner,
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    stringUtils = await deployer.deployStringConversionUtilsMock();
  });

  describe("#stringToUint", async () => {
    let subjectString: string;
    let subjectDesiredDecimals: BigNumber;

    beforeEach(async () => {
      subjectString = "123.456";
      subjectDesiredDecimals = BigNumber.from(5);
    });

    async function subject(): Promise<any> {
      return await stringUtils.stringToUint(subjectString, subjectDesiredDecimals);
    }

    it("should return the correct value", async () => {
      const output = await subject();

      expect(output).to.equal(BigNumber.from(12345600));
    });

    describe("when the amount of decimals equals the amount of decimals in the string", async () => {
      beforeEach(async () => {
        subjectDesiredDecimals = BigNumber.from(3);
      });

      it("should return the correct value", async () => {
        const output = await subject();

        expect(output).to.equal(BigNumber.from(123456));
      });
    });

    describe("when the desired decimals is 0 and no decimal is found", async () => {
      beforeEach(async () => {
        subjectString = "120459"
        subjectDesiredDecimals = ZERO
      });

      it("should return the correct value", async () => {
        const output = await subject();

        expect(output).to.equal(BigNumber.from(120459));
      });
    });

    describe("when the desired decimals is 0 and a decimal is found at the very end", async () => {
      beforeEach(async () => {
        subjectString = "123456."
        subjectDesiredDecimals = ZERO
      });

      it("should return the correct value", async () => {
        const output = await subject();

        expect(output).to.equal(BigNumber.from(123456));
      });
    });

    describe("when passed string has more decimal places than the desired decimals", async () => {
      beforeEach(async () => {
        subjectDesiredDecimals = ONE;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("String has too many decimal places");
      });
    });

    describe("when passed string has more than one decimal point", async () => {
      beforeEach(async () => {
        subjectString = "123.45.6";
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("String has multiple decimals");
      });
    });
  });

  describe("#stringToUint (with specified decimal character)", async () => {
    let subjectString: string;
    let subjectDecimalCharacter: string;
    let subjectDesiredDecimals: BigNumber;

    beforeEach(async () => {
      subjectString = "123.456";
      subjectDecimalCharacter = "0x2E";
      subjectDesiredDecimals = BigNumber.from(5);
    });

    async function subject(): Promise<any> {
      return await stringUtils.stringToUintDefinedCharacter(
        subjectString,
        subjectDecimalCharacter,
        subjectDesiredDecimals
      );
    }

    it("should return the correct value", async () => {
      const output = await subject();

      expect(output).to.equal(BigNumber.from(12345600));
    });

    describe("when the decimal character is a comma", async () => {
      beforeEach(async () => {
        subjectString = "123,456";
        subjectDecimalCharacter = "0x2C";
      });

      it("should return the correct value", async () => {
        const output = await subject();

        expect(output).to.equal(BigNumber.from(12345600));
      });
    });

    describe("when the amount of decimals equals the amount of decimals in the string", async () => {
      beforeEach(async () => {
        subjectDesiredDecimals = BigNumber.from(3);
      });

      it("should return the correct value", async () => {
        const output = await subject();

        expect(output).to.equal(BigNumber.from(123456));
      });
    });

    describe("when the desired decimals is 0 and no decimal is found", async () => {
      beforeEach(async () => {
        subjectString = "120459"
        subjectDesiredDecimals = ZERO
      });

      it("should return the correct value", async () => {
        const output = await subject();

        expect(output).to.equal(BigNumber.from(120459));
      });
    });

    describe("when the desired decimals is 0 and a decimal is found at the very end", async () => {
      beforeEach(async () => {
        subjectString = "123456."
        subjectDesiredDecimals = ZERO
      });

      it("should return the correct value", async () => {
        const output = await subject();

        expect(output).to.equal(BigNumber.from(123456));
      });
    });

    describe("when passed string has more decimal places than the desired decimals", async () => {
      beforeEach(async () => {
        subjectDesiredDecimals = ONE;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("String has too many decimal places");
      });
    });

    describe("when passed string has more than one decimal point", async () => {
      beforeEach(async () => {
        subjectString = "123.45.6";
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("String has multiple decimals");
      });
    });
  });

  describe("#stringComparison", async () => {
    let subjectStringA: string;
    let subjectStringB: string;

    beforeEach(async () => {
      subjectStringA = "test string";
      subjectStringB = "test string";
    });

    async function subject(): Promise<any> {
      return await stringUtils.stringComparison(subjectStringA, subjectStringB);
    }

    it("should return true when strings are equal", async () => {
      const output = await subject();
      expect(output).to.be.true;
    });

    describe("when strings are different", async () => {
      beforeEach(async () => {
        subjectStringB = "different string";
      });

      it("should return false", async () => {
        const output = await subject();
        expect(output).to.be.false;
      });
    });

    describe("when strings have different case", async () => {
      beforeEach(async () => {
        subjectStringB = "TEST STRING";
      });

      it("should return false", async () => {
        const output = await subject();
        expect(output).to.be.false;
      });
    });

    describe("when strings have different lengths", async () => {
      beforeEach(async () => {
        subjectStringB = "test string with more words";
      });

      it("should return false", async () => {
        const output = await subject();
        expect(output).to.be.false;
      });
    });

    describe("when comparing empty strings", async () => {
      beforeEach(async () => {
        subjectStringA = "";
        subjectStringB = "";
      });

      it("should return true", async () => {
        const output = await subject();
        expect(output).to.be.true;
      });
    });
  });
});
