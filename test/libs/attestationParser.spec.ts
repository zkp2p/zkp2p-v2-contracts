import "module-alias/register";

import { BigNumber } from "ethers";
import { ethers } from "ethers";

import { Account } from "@utils/test/types";
import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

import DeployHelper from "@utils/deploys";
import { AttestationParserMock } from "@utils/contracts";

const expect = getWaffleExpect();

describe.only("AttestationParser", () => {
  let owner: Account;

  let deployer: DeployHelper;
  let attestationParser: AttestationParserMock;

  beforeEach(async () => {
    [owner] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    attestationParser = await deployer.deployAttestationParserMock();
  });

  describe('#extractAllValues', async () => {
    let subjectData: string;
    let subjectMaxValues: BigNumber;

    beforeEach(async () => {
      subjectData = "{\"date\":\"1752481340000\",\"recvId\":\"869365669\",\"amt\":\"10.0\",\"id\":\"1626956148\",\"curr\":\"USD\",\"status\":\"OUTGOING_PAYMENT_SENT\"}";
      subjectMaxValues = BigNumber.from(10);
    });

    async function subject(): Promise<any> {
      return await attestationParser.extractAllValues(
        subjectData,
        subjectMaxValues
      );
    }

    it("should extract all values from JSON", async () => {
      const values = await subject();

      const expectedValues = [
        "1752481340000",
        "869365669",
        "10.0",
        "1626956148",
        "USD",
        "OUTGOING_PAYMENT_SENT"
      ];

      expect(values).to.deep.equal(expectedValues);
    });

    describe("when JSON has less values than maxValues", async () => {
      beforeEach(async () => {
        subjectData = '{"key1":"value1","key2":"value2"}';
        subjectMaxValues = BigNumber.from(5);
      });

      it("should extract only the available values", async () => {
        const values = await subject();

        expect(values).to.deep.equal(["value1", "value2"]);
      });
    });

    describe("when data is empty object", async () => {
      beforeEach(async () => {
        subjectData = '{}';
      });

      it("should return empty array", async () => {
        const values = await subject();

        expect(values).to.deep.equal([]);
      });
    });

    describe("when maxValues is zero", async () => {
      beforeEach(async () => {
        subjectMaxValues = BigNumber.from(0);
      })

      it("should revert with 'Max values must be greater than 0'", async () => {
        await expect(subject()).to.be.revertedWith("Max values must be greater than 0");
      });
    });

    describe("when maxValues is less than the actual number of values", async () => {
      beforeEach(async () => {
        subjectMaxValues = BigNumber.from(3);
      });

      it("should revert with 'Extraction failed. Exceeded max values'", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Exceeded max values");
      });
    });

    describe("when the JSON data is malformed - missing colon", async () => {
      beforeEach(async () => {
        subjectData = '{"key1""value1","key2":"value2"}';
      });

      it("should revert with extraction failed", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Expected :\" after key");
      });
    });

    describe("when the JSON data is malformed - missing comma", async () => {
      beforeEach(async () => {
        subjectData = '{"key1":"value1""key2":"value2"}';
      });

      it("should revert with extraction failed", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Expected , or } after value");
      });
    });

    describe("when the JSON data doesn't start with '{'", async () => {
      beforeEach(async () => {
        subjectData = '"key1":"value1","key2":"value2"}';
      });

      it("should revert with 'Data must start with {'", async () => {
        await expect(subject()).to.be.revertedWith("Data must start with {");
      });
    });

    describe("when the JSON data is empty", async () => {
      beforeEach(async () => {
        subjectData = '';
      });

      it("should revert with 'Empty data'", async () => {
        await expect(subject()).to.be.revertedWith("Empty data");
      });
    });

    describe("when a value contains escaped quotes", async () => {
      beforeEach(async () => {
        subjectData = '{"key1":"value with \\"quotes\\"","key2":"normal value"}';
      });

      it("should correctly extract the value with escaped quotes", async () => {
        const values = await subject();
        expect(values[0]).to.equal('value with \\"quotes\\"');
        expect(values[1]).to.equal('normal value');
      });
    });

    describe("when the JSON has empty values", async () => {
      beforeEach(async () => {
        subjectData = '{"key1":"","key2":"value2","key3":""}';
      });

      it("should extract empty strings correctly", async () => {
        const values = await subject();
        expect(values).to.deep.equal(['', 'value2', '']);
      });
    });

    describe("when the JSON is missing closing quote after comma", async () => {
      beforeEach(async () => {
        subjectData = '{"key1":"value1",key2":"value2"}';
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Expected \" after ,");
      });
    });

    describe("when value ends unexpectedly", async () => {
      beforeEach(async () => {
        subjectData = '{"key1":"value1';
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Unexpected end of data");
      });
    });
  });
});