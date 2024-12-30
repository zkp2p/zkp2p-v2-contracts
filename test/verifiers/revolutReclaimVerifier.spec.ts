import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, RevolutReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, convertSignatureToHex } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const paymentProof = {
  provider: "http",
  parameters: "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9\\\\-]+)\"},{\"type\":\"regex\",\"value\":\"\\\"currency\\\":\\\"(?<currency>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"completedDate\\\":(?<completedDate>[0-9]+)\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"username\\\":\\\"(?<username>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<id>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.[11].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].currency\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].completedDate\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].recipient.username\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].id\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].state\",\"xPath\":\"\"}],\"url\":\"https://app.revolut.com/api/retail/user/current/transactions/last?count=20\",\"writeRedactionMode\":\"zk\"}",
  owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
  timestampS: 1735331469,
  context: "{\"extractedParameters\":{\"amount\":\"-20064\",\"completedDate\":\"1731488958497\",\"currency\":\"EUR\",\"id\":\"67346cbe-6ac5-afaf-875c-232594d79729\",\"state\":\"COMPLETED\",\"username\":\"0x58a978214918c8ec81ce5a56fbf5cda2f85bb70376c7a253e9b246aba258b5f3\"},\"intentHash\":\"21888242871839275222246405745257275088548364400416034343698204186575808495617\",\"providerHash\":\"0xd5850d39a47e17f5a546e8de045c1bb3a22228beebf8f3f943db759f46e330c6\"}",
  identifier: "0x2dc54602bbf54e7a87641dbbce1fe7fb4c92b8b714c5ea9b2e533b5b46ead5a0",
  epoch: 1,
  signature: { "0": 192, "1": 182, "2": 73, "3": 198, "4": 253, "5": 247, "6": 189, "7": 147, "8": 203, "9": 238, "10": 44, "11": 28, "12": 198, "13": 146, "14": 159, "15": 89, "16": 0, "17": 172, "18": 177, "19": 177, "20": 186, "21": 152, "22": 132, "23": 236, "24": 185, "25": 78, "26": 123, "27": 90, "28": 240, "29": 155, "30": 140, "31": 7, "32": 109, "33": 162, "34": 104, "35": 178, "36": 138, "37": 40, "38": 19, "39": 234, "40": 69, "41": 156, "42": 231, "43": 160, "44": 252, "45": 129, "46": 70, "47": 38, "48": 175, "49": 28, "50": 12, "51": 37, "52": 85, "53": 30, "54": 228, "55": 78, "56": 230, "57": 7, "58": 170, "59": 185, "60": 241, "61": 160, "62": 139, "63": 53, "64": 28 }
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

  describe("#verifyPayment", async () => {
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
          provider: paymentProof.provider,
          parameters: paymentProof.parameters,
          context: paymentProof.context
        },
        signedClaim: {
          claim: {
            identifier: paymentProof.identifier,
            owner: paymentProof.owner,
            timestampS: BigNumber.from(paymentProof.timestampS),
            epoch: BigNumber.from(paymentProof.epoch)
          },
          signatures: [convertSignatureToHex(paymentProof.signature)]
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
      subjectIntentAmount = usdc(100.32);
      subjectIntentTimestamp = BigNumber.from(1727914697);
      subjectConversionRate = ether(2);     // 100.32 USDC * 2 EUR / USDC = 200.64 EUR required payment amount
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

    describe("when proof payee details is not hash but just raw revolut id", async () => {
      beforeEach(async () => {
        const revolutPaymentProof2 = {
          provider: "http",
          parameters: "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9\\\\-]+)\"},{\"type\":\"regex\",\"value\":\"\\\"currency\\\":\\\"(?<currency>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"completedDate\\\":(?<completedDate>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"username\\\":\\\"(?<username>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<id>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.[11].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].currency\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].completedDate\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].recipient.username\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].id\",\"xPath\":\"\"},{\"jsonPath\":\"$.[11].state\",\"xPath\":\"\"}],\"url\":\"https://app.revolut.com/api/retail/user/current/transactions/last?count=20\",\"writeRedactionMode\":\"zk\"}",
          owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
          timestampS: 1735358034,
          context: "{\"extractedParameters\":{\"amount\":\"-20064\",\"completedDate\":\"1731488958497\",\"currency\":\"EUR\",\"id\":\"67346cbe-6ac5-afaf-875c-232594d79729\",\"state\":\"COMPLETED\",\"username\":\"onurytjts\"},\"intentHash\":\"21888242871839275222246405745257275088548364400416034343698204186575808495617\",\"providerHash\":\"0xf09e9363bf18ae13ddc9ee52aefddc4456e719ce10c3e6d9ea6c4b663de311ba\"}",
          identifier: "0xc8ec85fc7a944f3952d0eba243e58f1e6f580798bce4b5a9b53b1324e053bdc8",
          epoch: 1,
          signature: { "0": 72, "1": 46, "2": 8, "3": 25, "4": 250, "5": 119, "6": 32, "7": 41, "8": 205, "9": 53, "10": 72, "11": 32, "12": 193, "13": 200, "14": 206, "15": 103, "16": 181, "17": 157, "18": 177, "19": 209, "20": 193, "21": 29, "22": 29, "23": 161, "24": 153, "25": 28, "26": 223, "27": 135, "28": 234, "29": 98, "30": 249, "31": 163, "32": 26, "33": 1, "34": 158, "35": 195, "36": 29, "37": 112, "38": 123, "39": 231, "40": 72, "41": 189, "42": 22, "43": 199, "44": 239, "45": 15, "46": 184, "47": 1, "48": 253, "49": 71, "50": 3, "51": 60, "52": 51, "53": 109, "54": 195, "55": 247, "56": 214, "57": 198, "58": 208, "59": 217, "60": 218, "61": 206, "62": 213, "63": 61, "64": 27 }
        };

        const proof2 = {
          claimInfo: {
            provider: revolutPaymentProof2.provider,
            parameters: revolutPaymentProof2.parameters,
            context: revolutPaymentProof2.context
          },
          signedClaim: {
            claim: {
              identifier: revolutPaymentProof2.identifier,
              owner: revolutPaymentProof2.owner,
              timestampS: BigNumber.from(revolutPaymentProof2.timestampS),
              epoch: BigNumber.from(revolutPaymentProof2.epoch)
            },
            signatures: [convertSignatureToHex(revolutPaymentProof2.signature)]
          }
        };

        subjectProof = ethers.utils.defaultAbiCoder.encode(
          [
            "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
          ],
          [proof2]
        );
        subjectPayeeDetailsHash = "onurytjts";

        await verifier.connect(owner.wallet).addProviderHash('0xf09e9363bf18ae13ddc9ee52aefddc4456e719ce10c3e6d9ea6c4b663de311ba')
      });

      it("should verify the proof", async () => {
        const [
          verified,
          intentHash
        ] = await subjectCallStatic();

        expect(verified).to.be.true;
        // 21888242871839275222246405745257275088548364400416034343698204186575808495617 converted to hex
        expect(intentHash).to.eq("0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001");
      });
    });

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

    describe("when the payment amount is less than the intent amount * conversion rate", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(100.33);   // just 1 cent more than the actual ask amount (100.33 * 2 = 200.66) which is greater than the payment amount (200.64)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });

      describe("when the payment amount is more than the intent amount * conversion rate", async () => {
        beforeEach(async () => {
          subjectIntentAmount = usdc(100.31);   // just 1 cent less than the actual ask amount (100.31 * 2 = 200.62) which is less than the payment amount (200.64)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the payment was made before the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(1731488958).add(1).add(BigNumber.from(30));  // payment timestamp + 1 + 30 seconds (buffer)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });

      describe("when the payment was made after the intent", async () => {
        beforeEach(async () => {
          subjectIntentTimestamp = BigNumber.from(1731488958).add(0).add(BigNumber.from(30));  // payment timestamp + 0 + 30 seconds (buffer)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
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

    describe("when the currency is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = ZERO_BYTES32;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment currency");
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
