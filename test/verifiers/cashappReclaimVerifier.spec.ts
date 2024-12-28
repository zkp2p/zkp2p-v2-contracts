import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, CashappReclaimVerifier, USDCMock } from "@utils/contracts";
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
  parameters: "{\"body\":\"{\\\"activity_token\\\":{\\\"activity_token_type\\\":\\\"CUSTOMER_TOKEN\\\",\\\"token\\\":\\\"{{SENDER_ID}}\\\"},\\\"activity_scope\\\":\\\"MY_ACTIVITY_WEB_V2\\\",\\\"caller_token\\\":\\\"{{SENDER_ID}}\\\",\\\"page_size\\\":15,\\\"request_context\\\":{}}\",\"method\":\"POST\",\"paramValues\":{\"SENDER_ID\":\"C_0twqj8ycc\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"currency_code\\\":\\\"(?<currency_code>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"display_date\\\":(?<date>[0-9]+)\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"cashtag\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"token\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.activity_rows[0].payment_history_inputs_row.payment.amount.amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[0].payment_history_inputs_row.payment.amount.currency_code\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[0].payment_history_inputs_row.payment.display_date\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[0].payment_history_inputs_row.recipient.cashtag\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[0].payment_history_inputs_row.payment.token\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[0].payment_history_inputs_row.payment.state\",\"xPath\":\"\"}],\"url\":\"https://cash.app/cash-app/activity/v1.0/page\"}",
  owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
  timestampS: 1735332028,
  context: "{\"extractedParameters\":{\"SENDER_ID\":\"C_0twqj8ycc\",\"amount\":\"100\",\"currency_code\":\"USD\",\"date\":\"1735331910000\",\"paymentId\":\"kzkvq9e9f\",\"receiverId\":\"0x95ea91aec8d010b3e69df4a512d624e1e0c9b2f170c799e33e555dc1fa5c4503\",\"state\":\"WAITING_ON_RECIPIENT\"},\"intentHash\":\"21888242871839275222246405745257275088548364400416034343698204186575808495617\",\"providerHash\":\"0x5e3b19d2559f94bb09ec06bb3b11a099f47af374d54c8b98ee21efa3054357b1\"}",
  identifier: "0xea74f61810733d1394c432768e91d433e1ef81469e432a4c80d397273d3712a9",
  epoch: 1,
  signature: { "0": 190, "1": 24, "2": 249, "3": 53, "4": 127, "5": 85, "6": 166, "7": 65, "8": 108, "9": 237, "10": 38, "11": 11, "12": 235, "13": 54, "14": 210, "15": 125, "16": 60, "17": 246, "18": 155, "19": 65, "20": 198, "21": 120, "22": 36, "23": 249, "24": 92, "25": 91, "26": 145, "27": 126, "28": 208, "29": 188, "30": 148, "31": 157, "32": 35, "33": 210, "34": 232, "35": 241, "36": 136, "37": 88, "38": 251, "39": 195, "40": 238, "41": 140, "42": 91, "43": 189, "44": 212, "45": 153, "46": 246, "47": 3, "48": 213, "49": 67, "50": 235, "51": 175, "52": 185, "53": 10, "54": 216, "55": 15, "56": 9, "57": 228, "58": 47, "59": 82, "60": 228, "61": 222, "62": 241, "63": 253, "64": 28 }
}


const blockchain = new Blockchain(ethers.provider);

describe("CashappReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHash: string;
  let witnessAddress: Address;

  let nullifierRegistry: NullifierRegistry;
  let verifier: CashappReclaimVerifier;
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
    providerHash = "0x5e3b19d2559f94bb09ec06bb3b11a099f47af374d54c8b98ee21efa3054357b1";

    nullifierRegistry = await deployer.deployNullifierRegistry();
    const claimVerifier = await deployer.deployClaimVerifier();
    verifier = await deployer.deployCashappReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.USD],
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
      subjectIntentAmount = usdc(1);
      subjectIntentTimestamp = BigNumber.from(1727914697);
      subjectConversionRate = ether(1);
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['onurytjts'])
      );
      subjectFiatCurrency = Currency.USD;
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

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['kzkvq9e9f']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
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

    describe("when the payment amount is less than the intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(101);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });
    });

    describe("when the payment was made before the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(1735331910).add(1).add(BigNumber.from(30));  // payment timestamp + 1 + 30 seconds (buffer)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });

      describe("when the payment was made after the intent", async () => {
        beforeEach(async () => {
          subjectIntentTimestamp = BigNumber.from(1735331910).add(0).add(BigNumber.from(30));  // payment timestamp + 0 + 30 seconds (buffer)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe.skip("when the payment recipient is incorrect", async () => {
      beforeEach(async () => {
        subjectPayeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['random-recipient-id']));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
      });
    });

    describe("when the currency is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.EUR;
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
        proof.claimInfo.context = "{\"extractedParameters\":{\"SENDER_ID\":\"C_0twqj8ycc\",\"amount\":\"100\",\"currency_code\":\"USD\",\"date\":\"1735331910000\",\"paymentId\":\"kzkvq9e9f\",\"receiverId\":\"0x95ea91aec8d010b3e69df4a512d624e1e0c9b2f170c799e33e555dc1fa5c4503\",\"state\":\"WAITING_ON_RECIPIENT\"},\"intentHash\":\"21888242871839275222246405745257275088548364400416034343698204186575808495617\",\"providerHash\":\"0x5e3b19d2559f94bb09ec06bb3b11a099f47af374d54c8b98ee21efa3054357b2\"}";
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
