import "module-alias/register";

import { BigNumber } from "ethers";
import { ethers } from "ethers";

import { Account } from "@utils/test/types";
import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

import DeployHelper from "@utils/deploys";
import { Address } from "@utils/types";
import { ClaimVerifierMock } from "@utils/contracts";

const expect = getWaffleExpect();

describe("ClaimVerifier", () => {
  let owner: Account;
  let witnessAddress: Address;
  let otherWitness: Account;

  let deployer: DeployHelper;

  let claimVerifier: ClaimVerifierMock;

  beforeEach(async () => {
    [
      owner,
      otherWitness
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    witnessAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'    // hardhat 0

    const claimVerifierLib = await deployer.deployClaimVerifier();
    claimVerifier = await deployer.deployClaimVerifierMock(
      "contracts/lib/ClaimVerifier.sol:ClaimVerifier",
      claimVerifierLib.address
    );
  });

  describe("#findSubstringEndIndex", async () => {
    let subjectData: string;
    let subjectTarget: string;

    beforeEach(async () => {
      subjectData = "{\"extractedParameters\":{\"amount\":\"5.00\",\"date\":\"2024-10-03T00:17:47\",\"paymentId\":\"4170368513012150718\",\"receiverId\":\"645716473020416186\"},\"intentHash\":\"0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb\",\"providerHash\":\"0x2c9c02c5327577be7f67a418eb97312c73b89323d1fd436e02de3510e6c8de04\"}";
      subjectTarget = 'date'
    });

    async function subject(): Promise<any> {
      return await claimVerifier.findSubstringEndIndex(subjectData, subjectTarget);
    };

    it("should return the index the substring terminates at", async () => {
      const actualIndex = await subject();

      expect(actualIndex).to.equal(BigNumber.from(45));
    });

    describe("when no match is found", async () => {
      beforeEach(async () => {
        subjectTarget = "dates/"
      });

      it("should return max uint256 value", async () => {
        const actualIndex = await subject();

        expect(actualIndex).to.equal(BigNumber.from(2).pow(256).sub(1));
      });
    });

    describe("when the target end index is data end index", async () => {
      beforeEach(async () => {
        subjectData = "hi";
        subjectTarget = "i";
      });

      it("should return the index of the target end", async () => {
        const actualIndex = await subject();

        expect(actualIndex).to.equal(BigNumber.from(2));
      });
    });

    describe("when the data is shorter than the target", async () => {
      beforeEach(async () => {
        subjectData = "hi";
      });

      it("should return max uint256 value", async () => {
        const actualIndex = await subject();

        expect(actualIndex).to.equal(BigNumber.from(2).pow(256).sub(1));
      });
    });
  });

  describe("#extractFieldFromContext", async () => {
    let subjectData: string;
    let subjectTarget: string;

    beforeEach(async () => {
      const PROOF = {
        "provider": "http",
        "parameters": "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?\u003Camount\u003E[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?\u003Cdate\u003E[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"receiver\\\":\\\\{\\\"id\\\":\\\"(?\u003CreceiverId\u003E[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?\u003CpaymentId\u003E[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[9].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].title.receiver\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].paymentId\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId=1168869611798528966\"}",
        "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
        "timestampS": 1732845455,
        "context": "{\"extractedParameters\":{\"amount\":\"5.00\",\"date\":\"2024-10-03T00:17:47\",\"paymentId\":\"4170368513012150718\",\"receiverId\":\"645716473020416186\"},\"intentHash\":\"0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb\",\"providerHash\":\"0x2c9c02c5327577be7f67a418eb97312c73b89323d1fd436e02de3510e6c8de04\"}",
        "identifier": "0xa674f652426d77a02bcb5f4f2e58390bdb469194996280150b94c6161a1659a1",
        "epoch": 1
      };
      const SIGNATURE = '0x'

      const proof = {
        claimInfo: {
          provider: PROOF.provider,
          parameters: PROOF.parameters,
          context: PROOF.context,
        },
        signedClaim: {
          claim: {
            identifier: PROOF.identifier,
            owner: PROOF.owner,
            timestampS: PROOF.timestampS,
            epoch: PROOF.epoch
          },
          signatures: [SIGNATURE]
        }
      };
      subjectData = proof.claimInfo.context;
      subjectTarget = '"date\":\"'
    });

    async function subject(): Promise<any> {
      return await claimVerifier.extractFieldFromContext(subjectData, subjectTarget);
    };

    it("should extract firstName from context", async () => {
      const extractedValue = await subject();

      expect(extractedValue).to.equal("2024-10-03T00:17:47");
    });

    describe("when the resulting string is empty", async () => {
      beforeEach(async () => {
        subjectData = "{\"extractedParameters\":{\"amount\":\"5.00\",\"date\":\"\", \"paymentId\":\"4170368513012150718\",\"receiverId\":\"645716473020416186\"},\"intentHash\":\"0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb\",\"providerHash\":\"0x2c9c02c5327577be7f67a418eb97312c73b89323d1fd436e02de3510e6c8de04\"}",
          subjectTarget = '"date\":\"';
      });

      it("should return an empty string", async () => {
        const extractedValue = await subject();

        expect(extractedValue).to.equal('');
      });
    });

    describe("when the target is not found in the context", async () => {
      beforeEach(async () => {
        subjectData = '{"someOtherField":"someValue"}';
        subjectTarget = '"firstName\\":\\"';
      });

      it("should return an empty string", async () => {
        const extractedValue = await subject();

        expect(extractedValue).to.equal('');
      });
    });
  });

  describe('#extractAllFromContext', async () => {
    let subjectData: string;
    let subjectMaxValues: BigNumber;
    let subjectExtractIntentAndProviderHash: boolean;

    const PROOF = {
      "provider": "http",
      "parameters": "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?\u003Camount\u003E[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?\u003Cdate\u003E[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"receiver\\\":\\\\{\\\"id\\\":\\\"(?\u003CreceiverId\u003E[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?\u003CpaymentId\u003E[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[9].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].title.receiver\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].paymentId\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId=1168869611798528966\"}",
      "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
      "timestampS": 1732845455,
      "context": "{\"extractedParameters\":{\"amount\":\"5.00\",\"date\":\"2024-10-03T00:17:47\",\"paymentId\":\"4170368513012150718\",\"receiverId\":\"645716473020416186\"},\"intentHash\":\"0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb\",\"providerHash\":\"0x2c9c02c5327577be7f67a418eb97312c73b89323d1fd436e02de3510e6c8de04\"}",
      "identifier": "0xa674f652426d77a02bcb5f4f2e58390bdb469194996280150b94c6161a1659a1",
      "epoch": 1
    };
    const SIGNATURE = '0x'

    beforeEach(async () => {
      const proof = {
        claimInfo: {
          provider: PROOF.provider,
          parameters: PROOF.parameters,
          context: PROOF.context,
        },
        signedClaim: {
          claim: {
            identifier: PROOF.identifier,
            owner: PROOF.owner,
            timestampS: PROOF.timestampS,
            epoch: PROOF.epoch
          },
          signatures: [SIGNATURE]
        }
      };
      subjectData = proof.claimInfo.context;
      subjectMaxValues = BigNumber.from(10);
      subjectExtractIntentAndProviderHash = false;
    });

    async function subject(): Promise<any> {
      return await claimVerifier.extractAllFromContext(
        subjectData,
        subjectMaxValues,
        subjectExtractIntentAndProviderHash
      );
    }

    it("should extract all values from context", async () => {
      const values = await subject();

      const expectedValues = [
        "5.00",
        "2024-10-03T00:17:47",
        "4170368513012150718",
        "645716473020416186"
      ];

      expect(values.length).to.equal(expectedValues.length);

      for (let i = 0; i < values.length; i++) {
        expect(values[i]).to.equal(expectedValues[i]);
      }
    });

    describe("when extract intent and provider hash is true", async () => {
      beforeEach(async () => {
        subjectExtractIntentAndProviderHash = true;
      });

      it("should return both hashes", async () => {
        const values = await subject();

        const expectedIntentHash = "0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb";
        const expectedProviderHash = "0x2c9c02c5327577be7f67a418eb97312c73b89323d1fd436e02de3510e6c8de04";
        expect(values[values.length - 2]).to.equal(expectedIntentHash);
        expect(values[values.length - 1]).to.equal(expectedProviderHash);
      });


      describe("intent hash is missing", async () => {
        beforeEach(async () => {
          subjectData = '{"extractedParameters":{"key1":"value1","key2":"value2"},\"otherHash\":\"0x1234\"}';
        });

        it("should revert with 'Extraction failed. Malformed data'", async () => {
          await expect(subject()).to.be.revertedWith("Extraction failed. Malformed intentHash");
        });
      });

      describe("provider hash is missing", async () => {
        beforeEach(async () => {
          subjectData = '{"extractedParameters":{"key1":"value1","key2":"value2"},\"intentHash\":\"0x1234\",\"otherHash\":\"0x1234\"}';
        });

        it("should revert with 'Extraction failed. Malformed data'", async () => {
          await expect(subject()).to.be.revertedWith("Extraction failed. Malformed providerHash");
        });
      });

      describe("when both hashes are missing", async () => {
        beforeEach(async () => {
          subjectData = '{"extractedParameters":{"key1":"value1","key2":"value2"},\"otherHash\":\"0x1234\"}';
        });

        it("should revert with 'Extraction failed. Malformed intentHash'", async () => {
          await expect(subject()).to.be.revertedWith("Extraction failed. Malformed intentHash");
        });
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

      it("should revert with 'Extraction failed; exceeded max values'", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Exceeded max values");
      });
    });

    describe("when the context data is malformed", async () => {
      beforeEach(async () => {
        subjectData = '{"extractedParameters":{"key1":value1","key2":"value2"},\"providerHash\":\"0x1234\"}';
      });

      it("should revert with 'Extraction failed'", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Malformed data 1");
      });
    });

    describe("when the context data is malformed", async () => {
      beforeEach(async () => {
        subjectData = '{"extractedParameters":{"key1":"value1""key2":"value2"},\"providerHash\":\"0x1234\"}';
      });

      it("should revert with 'Extraction failed'", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Malformed data 2");
      });
    });

    describe("when the context data doesn't start with '{\"extractedParameters\":{\"'", async () => {
      beforeEach(async () => {
        subjectData = '{"wrongStart":{"key1":"value1","key2":"value2"},\"providerHash\":\"0x1234\"}';
      });

      it("should revert with 'Extraction failed. Malformed data", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Malformed extractedParameters");
      });
    });

    describe("when a value contains escaped quotes", async () => {
      beforeEach(async () => {
        subjectData = '{"extractedParameters":{"key1":"value with \\"quotes\\"","key2":"normal value"},\"providerHash\":\"0x1234\"}';
      });

      it("should correctly extract the value with escaped quotes", async () => {
        const values = await subject();
        expect(values[0]).to.equal('value with \\"quotes\\"');
      });
    });
  });
});