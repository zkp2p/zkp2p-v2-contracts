import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber } from "ethers";

import { Account } from "@utils/test/types";
import { NullifierRegistry, RevolutReclaimVerifier, USDCMock } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import { Address, GrothProof, ReclaimProof } from "@utils/types";
import { getIdentifierFromClaimInfo, createSignDataForClaim } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { Currency } from "@utils/protocolUtils";
import { ZERO, ZERO_BYTES32, ADDRESS_ZERO, ONE_DAY_IN_SECONDS } from "@utils/constants";
import { BytesLike } from "ethers";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const venmoPaymentProof = {
  provider: "http",
  parameters: "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9\\\\-]+)\"},{\"type\":\"regex\",\"value\":\"\\\"currency\\\":\\\"(?<currency>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"completedDate\\\":(?<completedDate>[0-9]+)\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"username\\\":\\\"(?<username>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<id>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.[11].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].currency\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].completedDate\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].recipient.username\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].id\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].state\",\"xPath\":\"\"}],\"url\":\"https://app.revolut.com/api/retail/user/current/transactions/last?count=20\",\"writeRedactionMode\":\"zk\"}",
  owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
  timestampS: 1735331469,
  context: "{\"extractedParameters\":{\"amount\":\"-20064\",\"completedDate\":\"1731488958497\",\"currency\":\"EUR\",\"id\":\"67346cbe-6ac5-afaf-875c-232594d79729\",\"state\":\"COMPLETED\",\"username\":\"0x58a978214918c8ec81ce5a56fbf5cda2f85bb70376c7a253e9b246aba258b5f3\"},\"intentHash\":\"21888242871839275222246405745257275088548364400416034343698204186575808495617\",\"providerHash\":\"0xd5850d39a47e17f5a546e8de045c1bb3a22228beebf8f3f943db759f46e330c6\"}","identifier":"0x2dc54602bbf54e7a87641dbbce1fe7fb4c92b8b714c5ea9b2e533b5b46ead5a0",
  epoch: 1,
  signature: {"0":192,"1":182,"2":73,"3":198,"4":253,"5":247,"6":189,"7":147,"8":203,"9":238,"10":44,"11":28,"12":198,"13":146,"14":159,"15":89,"16":0,"17":172,"18":177,"19":177,"20":186,"21":152,"22":132,"23":236,"24":185,"25":78,"26":123,"27":90,"28":240,"29":155,"30":140,"31":7,"32":109,"33":162,"34":104,"35":178,"36":138,"37":40,"38":19,"39":234,"40":69,"41":156,"42":231,"43":160,"44":252,"45":129,"46":70,"47":38,"48":175,"49":28,"50":12,"51":37,"52":85,"53":30,"54":228,"55":78,"56":230,"57":7,"58":170,"59":185,"60":241,"61":160,"62":139,"63":53,"64":28}
}


const blockchain = new Blockchain(ethers.provider);

describe("RevolutReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHash: string;
  let witnessAddress: Address;

  let nullifierRegistry: NullifierRegistry;
  let verifier: RevolutReclaimVerifier;
  let usdcToken: USDCMock;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      owner,
      attacker,
      escrow
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    witnessAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    providerHash = "0xd5850d39a47e17f5a546e8de045c1bb3a22228beebf8f3f943db759f46e330c6";

    nullifierRegistry = await deployer.deployNullifierRegistry();
    const claimVerifier = await deployer.deployClaimVerifier();
    verifier = await deployer.deployRevolutReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.EUR, Currency.USD, Currency.GBP, Currency.SGD],
      [providerHash],
      "contracts/lib/ClaimVerifier.sol:ClaimVerifier",
      claimVerifier.address
    );

    await nullifierRegistry.connect(owner.wallet).addWritePermission(verifier.address);
  });

  describe("#constructor", async () => {
    it("should set the correct state", async () => {
      const escrowAddress = await verifier.escrow();
      const nullifierRegistryAddress = await verifier.nullifierRegistry();
      const timestampBuffer = await verifier.timestampBuffer();
      const providerHashes = await verifier.getProviderHashes();

      expect(nullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(timestampBuffer).to.eq(BigNumber.from(30));
      expect(providerHashes).to.deep.eq([providerHash]);
      expect(escrowAddress).to.eq(escrow.address);
    });
  });

  function convertSignatureToHex(signature: { [key: string]: number }): string {
    const byteArray = Object.values(signature);
    return '0x' + Buffer.from(byteArray).toString('hex');
  }

  describe.only("#verifyPayment", async () => {
    let proof: ReclaimProof;

    let subjectCaller: Account;
    let subjectProof: BytesLike;
    let subjectDepositToken: Address;
    let subjectIntentAmount: BigNumber;
    let subjectIntentTimestamp: BigNumber;
    let subjectConversionRate: BigNumber;
    let subjectPayeeDetailsHash: string;
    let subjectFiatCurrency: BytesLike;
    let subjectData: BytesLike;

    beforeEach(async () => {
      proof = {
        claimInfo: {
          provider: venmoPaymentProof.provider,
          parameters: venmoPaymentProof.parameters,
          context: venmoPaymentProof.context
        },
        signedClaim: {
          claim: {
            identifier: venmoPaymentProof.identifier,
            owner: venmoPaymentProof.owner,
            timestampS: BigNumber.from(venmoPaymentProof.timestampS),
            epoch: BigNumber.from(venmoPaymentProof.epoch)
          },
          signatures: [convertSignatureToHex(venmoPaymentProof.signature)]
        }
      };
      subjectProof = ethers.utils.defaultAbiCoder.encode(
        [
          "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
        ],
        [proof]
      );

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(5);
      subjectIntentTimestamp = BigNumber.from(1727914697);
      subjectConversionRate = ether(1);
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['onurytjts'])
      );
      subjectFiatCurrency = Currency.EUR;
      subjectData = ethers.utils.defaultAbiCoder.encode(
        ['address'],
        [witnessAddress]
      );
    });

    async function subject(): Promise<any> {
      return await verifier.connect(subjectCaller.wallet).verifyPayment(
        subjectProof,
        subjectDepositToken,
        subjectIntentAmount,
        subjectIntentTimestamp,
        subjectPayeeDetailsHash,
        subjectFiatCurrency,
        subjectConversionRate,
        subjectData
      );
    }

    async function subjectCallStatic(): Promise<[boolean, string]> {
      return await verifier.connect(subjectCaller.wallet).callStatic.verifyPayment(
        subjectProof,
        subjectDepositToken,
        subjectIntentAmount,
        subjectIntentTimestamp,
        subjectPayeeDetailsHash,
        subjectFiatCurrency,
        subjectConversionRate,
        subjectData
      );
    }

    it("should verify the proof", async () => {
      const [
        verified,
        intentHash
      ] = await subjectCallStatic();

      expect(verified).to.be.true;
      // 21888242871839275222246405745257275088548364400416034343698204186575808495617 converted to hex
      expect(intentHash).to.eq("0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001");
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['67346cbe-6ac5-afaf-875c-232594d79729']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    // TODO
    // describe("when proof payee details is not hash but just raw revolut id", async () => {
    //   beforeEach(async () => {
    //     const venmoPaymentProof2 = {
    //       provider: "http",
    //       parameters: "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"receiver\\\":\\\\{\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[9].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].title.receiver\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].paymentId\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId=1168869611798528966\"}",
    //       owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
    //       timestampS: 1734114562,
    //       context: "{\"extractedParameters\":{\"amount\":\"42.00\",\"date\":\"2024-10-27T18:16:11\",\"paymentId\":\"4188305907305244155\",\"receiverId\":\"1662743480369152806\"},\"intentHash\":\"14527918542887692994877265012607290228020786464417481864664720498778276484603\",\"providerHash\":\"0x2c9c02c5327577be7f67a418eb97312c73b89323d1fd436e02de3510e6c8de04\"}",
    //       identifier: "0x8a0af951fc18f323c5d883126113f3ff41c7769afaf65cc743e33d7ee9694695",
    //       epoch: 1,
    //       signature: { "0": 9, "1": 140, "2": 7, "3": 173, "4": 107, "5": 201, "6": 6, "7": 25, "8": 98, "9": 142, "10": 77, "11": 184, "12": 16, "13": 204, "14": 63, "15": 25, "16": 119, "17": 143, "18": 12, "19": 131, "20": 20, "21": 156, "22": 174, "23": 253, "24": 5, "25": 158, "26": 230, "27": 74, "28": 212, "29": 114, "30": 243, "31": 246, "32": 66, "33": 149, "34": 15, "35": 208, "36": 178, "37": 139, "38": 36, "39": 242, "40": 114, "41": 147, "42": 8, "43": 68, "44": 218, "45": 19, "46": 158, "47": 62, "48": 197, "49": 100, "50": 55, "51": 73, "52": 50, "53": 130, "54": 130, "55": 44, "56": 184, "57": 67, "58": 198, "59": 93, "60": 21, "61": 75, "62": 6, "63": 32, "64": 28 }
    //     };

    //     const proof2 = {
    //       claimInfo: {
    //         provider: venmoPaymentProof2.provider,
    //         parameters: venmoPaymentProof2.parameters,
    //         context: venmoPaymentProof2.context
    //       },
    //       signedClaim: {
    //         claim: {
    //           identifier: venmoPaymentProof2.identifier,
    //           owner: venmoPaymentProof2.owner,
    //           timestampS: BigNumber.from(venmoPaymentProof2.timestampS),
    //           epoch: BigNumber.from(venmoPaymentProof2.epoch)
    //         },
    //         signatures: [convertSignatureToHex(venmoPaymentProof2.signature)]
    //       }
    //     };

    //     subjectProof = ethers.utils.defaultAbiCoder.encode(
    //       [
    //         "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
    //       ],
    //       [proof2]
    //     );
    //     subjectPayeeDetailsHash = "1662743480369152806";

    //     await verifier.connect(owner.wallet).addProviderHash('0x2c9c02c5327577be7f67a418eb97312c73b89323d1fd436e02de3510e6c8de04')
    //   });

    //   it("should verify the proof", async () => {
    //     const [
    //       verified,
    //       intentHash
    //     ] = await subjectCallStatic();

    //     expect(verified).to.be.true;
    //     expect(intentHash).to.eq("0x201e82b028debcfa4effc89d7e52d8023270ed9b1b1e99a8d2d7e1d53ca5d5fb");
    //   });
    // });

    describe("when the proof is invalid", async () => {
      beforeEach(async () => {
        proof.signedClaim.claim.identifier = ZERO_BYTES32;

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          [
            "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
          ],
          [proof]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.reverted;
      });
    });

    describe("when the payment amount is less than the intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(210);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });
    });

    describe("when the payment was made after the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(1735323362).add(ONE_DAY_IN_SECONDS);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });
    });

    describe("when the payment recipient is incorrect", async () => {
      beforeEach(async () => {
        subjectPayeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['645716473020416187']));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
      });
    });

    describe("when the proof has already been verified", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Nullifier has already been used");
      });
    });

    describe("when the provider hash is invalid", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"extractedParameters\":{\"amount\":\"-20064\",\"completedDate\":\"1731488958497\",\"currency\":\"EUR\",\"id\":\"67346cbe-6ac5-afaf-875c-232594d79729\",\"state\":\"COMPLETED\",\"username\":\"0x58a978214918c8ec81ce5a56fbf5cda2f85bb70376c7a253e9b246aba258b5f3\"},\"intentHash\":\"21888242871839275222246405745257275088548364400416034343698204186575808495617\",\"providerHash\":\"0xd5850d39a47e17f5a546e8de045c1bb3a22228beebf8f3f943db759f46e330c7\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          [
            "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
          ],
          [proof]
        );
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address'],
          [witness.address]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("No valid providerHash");
      });
    });

    describe("when the caller is not the escrow", async () => {
      beforeEach(async () => {
        subjectCaller = owner;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Only escrow can call");
      });
    });
  });
});
