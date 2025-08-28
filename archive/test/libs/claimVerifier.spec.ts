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

    claimVerifier = await deployer.deployClaimVerifierMock();
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
      "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4550365876404035370013319374327198777228946732305032418394862064756897839843\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"1.01\",\"date\":\"2025-01-06T18:21:21\",\"paymentId\":\"4239767587180066226\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"providerHash\":\"0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fd\"}",
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
        "0x0",
        "4550365876404035370013319374327198777228946732305032418394862064756897839843",
        "1168869611798528966",
        "1.01",
        "2025-01-06T18:21:21",
        "4239767587180066226",
        "0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d"
      ];

      expect(values).to.deep.equal(expectedValues);
    });

    describe("when extract provider hash is true", async () => {
      beforeEach(async () => {
        subjectExtractIntentAndProviderHash = true;
      });

      it("should return both hashes", async () => {
        const values = await subject();

        const expectedProviderHash = "0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fd"
        expect(values[values.length - 1]).to.equal(expectedProviderHash);
      });


      describe("when context address is missing", async () => {
        beforeEach(async () => {
          subjectData = '{\"contextMessage\":\"wow\",\{"extractedParameters":{"key1":"value1","key2":"value2"},\"otherHash\":\"0x1234\"}';
        });

        it("should revert with 'Extraction failed. Malformed contextAddress'", async () => {
          await expect(subject()).to.be.revertedWith("Extraction failed. Malformed contextAddress");
        });
      });

      describe("when context address is empty", async () => {
        beforeEach(async () => {
          subjectData = '{\"contextAddress\":\"\",\"contextMessage\":\"wow\",\{"extractedParameters":{"key1":"value1","key2":"value2"},\"otherHash\":\"0x1234\"}';
        });

        it("should revert with 'Extraction failed. Empty contextAddress value'", async () => {
          await expect(subject()).to.be.revertedWith("Extraction failed. Empty contextAddress value");
        });
      });

      describe("content message is missing", async () => {
        beforeEach(async () => {
          subjectData = '{\"contextAddress\":\"0x0\",\"extractedParameters\":{\"key1\":\"value1\",\"key2\":\"value2\"},\"otherHash\":\"0x1234\"}';
        });

        it("should revert with 'Extraction failed. Malformed data'", async () => {
          await expect(subject()).to.be.revertedWith("Extraction failed. Malformed contextMessage");
        });
      });

      describe("content message is empty", async () => {
        beforeEach(async () => {
          subjectData = '{\"contextAddress\":\"0x0\",\"contextMessage\":\"\",\"extractedParameters\":{\"key1\":\"value1\",\"key2\":\"value2\"},\"otherHash\":\"0x1234\"}';
        });

        it("should revert with 'Extraction failed. Empty contextMessage value'", async () => {
          await expect(subject()).to.be.revertedWith("Extraction failed. Empty contextMessage value");
        });
      });

      describe("provider hash is missing", async () => {
        beforeEach(async () => {
          subjectData = '{\"contextAddress\":\"0x0\",\"contextMessage\":\"wow\",\"extractedParameters\":{\"key1\":\"value1\",\"key2\":\"value2\"},\"otherHash\":\"0x1234\"}';
        });

        it("should revert with 'Extraction failed. Malformed data'", async () => {
          await expect(subject()).to.be.revertedWith("Extraction failed. Malformed providerHash");
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
        subjectData = '{\"contextAddress\":\"0x0\",\"contextMessage\":\"wow\",\"extractedParameters\":{\"key1:\"value1\",\"key2\":\"value2\"},\"otherHash\":\"0x1234\"}';
      });

      it("should revert with 'Extraction failed'", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Malformed data 1");
      });
    });

    describe("when the context data doesn't start with '{\"extractedParameters\":{\"'", async () => {
      beforeEach(async () => {
        subjectData = '{\"contextAddress\":\"0x0\",\"contextMessage\":\"wow\",\"wrongStart\":{\"wrongStart\":{\"key1\":\"value1\",\"key2\":\"value2\"},\"providerHash\":\"0x1234\"}';
      });

      it("should revert with 'Extraction failed. Malformed data", async () => {
        await expect(subject()).to.be.revertedWith("Extraction failed. Malformed extractedParameters");
      });
    });

    describe("when a value contains escaped quotes", async () => {
      beforeEach(async () => {
        subjectData = '{\"contextAddress\":\"0x0\",\"contextMessage\":\"wow\",\"extractedParameters\":{\"key1\":\"value with \\"quotes\\"\",\"key2\":\"normal value\"},\"providerHash\":\"0x1234\"}';
      });

      it("should correctly extract the value with escaped quotes", async () => {
        const values = await subject();
        expect(values[2]).to.equal('value with \\"quotes\\"');
      });
    });
  });
});