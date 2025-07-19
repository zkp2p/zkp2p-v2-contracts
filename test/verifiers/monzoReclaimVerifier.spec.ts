import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, MonzoReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, encodeProof, parseExtensionProof } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const monzoExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"headers\":{\"User-Agent\":\"reclaim/0.0.1\"},\"method\":\"GET\",\"paramValues\":{\"TX_ID\":\"tx_0000AwGAsaQ0IKs6p4LlEi\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9\\\\-]+)\"},{\"type\":\"regex\",\"value\":\"\\\"settled\\\":\\\"(?<completedDate>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"user_id\\\":\\\"(?<userId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"scheme\\\":\\\"p2p_payment\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"currency\\\":\\\"(?<currency>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"hold_decision_status\\\":\\\"decision_status\\\\.released\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.transaction.amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.transaction.settled\",\"xPath\":\"\"},{\"jsonPath\":\"$.transaction.counterparty.user_id\",\"xPath\":\"\"},{\"jsonPath\":\"$.transaction.scheme\",\"xPath\":\"\"},{\"jsonPath\":\"$.transaction.currency\",\"xPath\":\"\"},{\"jsonPath\":\"$.transaction.metadata.hold_decision_status\",\"xPath\":\"\"}],\"url\":\"https://api.monzo.com/transactions/{{TX_ID}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1752933209,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"18114168264614898234767045087100892814911930784849242636571146569793237988689\",\"extractedParameters\":{\"TX_ID\":\"tx_0000AwGAsaQ0IKs6p4LlEi\",\"amount\":\"-100\",\"completedDate\":\"2025-07-18T14:01:56.31Z\",\"currency\":\"GBP\",\"userId\":\"0xf7d34e75095ea8fe491ba34938522c9066a9a01fb9daf722b819d69927149981\"},\"providerHash\":\"0x84ddc30f67565667fb6a68855d19905e30624601b9d584736c6befaf2217077b\"}",
    "identifier": "0x9c2b1f4e5a667f3f1fba13946a6a6542d8c3001401317f3fb0c687031e786c33",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": {
      "0": 202,
      "1": 123,
      "2": 132,
      "3": 70,
      "4": 91,
      "5": 45,
      "6": 172,
      "7": 9,
      "8": 192,
      "9": 34,
      "10": 89,
      "11": 108,
      "12": 185,
      "13": 137,
      "14": 231,
      "15": 136,
      "16": 253,
      "17": 230,
      "18": 65,
      "19": 30,
      "20": 129,
      "21": 71,
      "22": 1,
      "23": 133,
      "24": 105,
      "25": 1,
      "26": 137,
      "27": 126,
      "28": 98,
      "29": 246,
      "30": 12,
      "31": 64,
      "32": 115,
      "33": 37,
      "34": 205,
      "35": 250,
      "36": 162,
      "37": 230,
      "38": 182,
      "39": 144,
      "40": 24,
      "41": 115,
      "42": 51,
      "43": 49,
      "44": 71,
      "45": 43,
      "46": 154,
      "47": 40,
      "48": 203,
      "49": 29,
      "50": 41,
      "51": 110,
      "52": 47,
      "53": 66,
      "54": 127,
      "55": 170,
      "56": 21,
      "57": 220,
      "58": 213,
      "59": 58,
      "60": 140,
      "61": 209,
      "62": 59,
      "63": 127,
      "64": 28
    },
    "resultSignature": {
      "0": 252,
      "1": 170,
      "2": 145,
      "3": 42,
      "4": 32,
      "5": 227,
      "6": 142,
      "7": 33,
      "8": 192,
      "9": 174,
      "10": 251,
      "11": 162,
      "12": 150,
      "13": 221,
      "14": 108,
      "15": 4,
      "16": 35,
      "17": 220,
      "18": 192,
      "19": 60,
      "20": 192,
      "21": 159,
      "22": 123,
      "23": 104,
      "24": 93,
      "25": 226,
      "26": 109,
      "27": 36,
      "28": 151,
      "29": 19,
      "30": 162,
      "31": 62,
      "32": 115,
      "33": 156,
      "34": 89,
      "35": 20,
      "36": 35,
      "37": 78,
      "38": 210,
      "39": 146,
      "40": 77,
      "41": 118,
      "42": 144,
      "43": 125,
      "44": 208,
      "45": 242,
      "46": 22,
      "47": 245,
      "48": 255,
      "49": 138,
      "50": 51,
      "51": 127,
      "52": 199,
      "53": 28,
      "54": 72,
      "55": 240,
      "56": 191,
      "57": 149,
      "58": 234,
      "59": 26,
      "60": 186,
      "61": 33,
      "62": 161,
      "63": 7,
      "64": 27
    }
  }
}

describe("MonzoReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: MonzoReclaimVerifier;
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

    witnesses = ["0x0636c417755e3ae25c6c166d181c0607f4c572a3"];
    providerHashes = ["0x84ddc30f67565667fb6a68855d19905e30624601b9d584736c6befaf2217077b"];

    nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployMonzoReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.GBP],
      providerHashes
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
      expect(providerHashes).to.deep.eq(providerHashes);
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

    let paymentTimestamp: number;

    beforeEach(async () => {
      proof = parseExtensionProof(monzoExtensionProof);
      subjectProof = encodeProof(proof);

      const paymentTimeString = '2025-07-18T14:01:56.31Z';
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.floor(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1.1);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(0.909);   // 1.1 * 0.909 = 0.9999 < 1 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = "0xf7d34e75095ea8fe491ba34938522c9066a9a01fb9daf722b819d69927149981";
      subjectFiatCurrency = Currency.GBP;
      subjectData = ethers.utils.defaultAbiCoder.encode(
        ['address[]'],
        [witnesses]
      );
    });

    async function subject(): Promise<any> {
      return await verifier.connect(subjectCaller.wallet).verifyPayment({
        paymentProof: subjectProof,
        depositToken: subjectDepositToken,
        intentAmount: subjectIntentAmount,
        intentTimestamp: subjectIntentTimestamp,
        payeeDetails: subjectPayeeDetailsHash,
        fiatCurrency: subjectFiatCurrency,
        conversionRate: subjectConversionRate,
        data: subjectData
      });
    }

    async function subjectCallStatic(): Promise<[boolean, string]> {
      return await verifier.connect(subjectCaller.wallet).callStatic.verifyPayment({
        paymentProof: subjectProof,
        depositToken: subjectDepositToken,
        intentAmount: subjectIntentAmount,
        intentTimestamp: subjectIntentTimestamp,
        payeeDetails: subjectPayeeDetailsHash,
        fiatCurrency: subjectFiatCurrency,
        conversionRate: subjectConversionRate,
        data: subjectData
      });
    }

    it("should verify the proof", async () => {
      const [
        verified,
        intentHash
      ] = await subjectCallStatic();

      expect(verified).to.be.true;
      expect(intentHash).to.eq(BigNumber.from('18114168264614898234767045087100892814911930784849242636571146569793237988689').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['tx_0000AwGAsaQ0IKs6p4LlEi']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is invalid", async () => {
      beforeEach(async () => {
        proof.signedClaim.claim.identifier = ZERO_BYTES32;
        subjectProof = encodeProof(proof);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.reverted;
      });
    });

    describe("when the payment amount is less than the intent amount * conversion rate", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(1.2);  // 1.2 * 0.909 = 1.0908 > 1.0
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });
    });

    describe("when the payment was made before the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(paymentTimestamp).add(1).add(BigNumber.from(30));  // payment timestamp + 1 + 30 seconds (buffer)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });

      describe("when the payment was made after the intent", async () => {
        beforeEach(async () => {
          subjectIntentTimestamp = BigNumber.from(paymentTimestamp).add(0).add(BigNumber.from(30));  // payment timestamp + 0 + 30 seconds (buffer)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the payment recipient is incorrect", async () => {
      beforeEach(async () => {
        subjectPayeeDetailsHash = 'incorrect_recipient_id';
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

    describe("when the currency is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.USD;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment currency");
      });
    });

    describe("when the provider hash is invalid", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"18114168264614898234767045087100892814911930784849242636571146569793237988689\",\"extractedParameters\":{\"TX_ID\":\"tx_0000AwGAsaQ0IKs6p4LlEi\",\"amount\":\"-100\",\"completedDate\":\"2025-07-18T14:01:56.31Z\",\"currency\":\"GBP\",\"userId\":\"0xf7d34e75095ea8fe491ba34938522c9066a9a01fb9daf722b819d69927149981\"},\"providerHash\":\"0x6517cd2ca8d1608fa4f9306f729e581cfdb78a4ff76d71df74582dd9f7478f4f\"}"
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof);
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address]]
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