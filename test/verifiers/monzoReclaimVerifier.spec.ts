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
    "parameters": "{\"body\":\"\",\"headers\":{\"User-Agent\":\"reclaim/0.0.1\"},\"method\":\"GET\",\"paramValues\":{\"TX_ID\":\"tx_0000AwGAsaQ0IKs6p4LlEi\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9\\\\-]+)\"},{\"type\":\"regex\",\"value\":\"\\\"settled\\\":\\\"(?<completedDate>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"user_id\\\":\\\"(?<userId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"scheme\\\":\\\"p2p_payment\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"currency\\\":\\\"(?<currency>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.transaction.amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.transaction.settled\",\"xPath\":\"\"},{\"jsonPath\":\"$.transaction.counterparty.user_id\",\"xPath\":\"\"},{\"jsonPath\":\"$.transaction.scheme\",\"xPath\":\"\"},{\"jsonPath\":\"$.transaction.currency\",\"xPath\":\"\"}],\"url\":\"https://api.monzo.com/transactions/{{TX_ID}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1752916554,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"115792089237316195423570985008687907853269984665640564039457584007913129639936\",\"extractedParameters\":{\"TX_ID\":\"tx_0000AwGAsaQ0IKs6p4LlEi\",\"amount\":\"-100\",\"completedDate\":\"2025-07-18T14:01:56.31Z\",\"currency\":\"GBP\",\"userId\":\"0xf7d34e75095ea8fe491ba34938522c9066a9a01fb9daf722b819d69927149981\"},\"providerHash\":\"0x6517cd2ca8d1608fa4f9306f729e581cfdb78a4ff76d71df74582dd9f7478f4e\"}",
    "identifier": "0x8aebc697a53202aa1e09ac7a38b2a1887e7d906ffd7e53d31a3262a6fb8d6321",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": {
      "0": 60,
      "1": 5,
      "2": 98,
      "3": 160,
      "4": 193,
      "5": 202,
      "6": 150,
      "7": 211,
      "8": 194,
      "9": 72,
      "10": 177,
      "11": 128,
      "12": 155,
      "13": 247,
      "14": 196,
      "15": 195,
      "16": 127,
      "17": 213,
      "18": 190,
      "19": 28,
      "20": 34,
      "21": 188,
      "22": 116,
      "23": 112,
      "24": 149,
      "25": 170,
      "26": 107,
      "27": 95,
      "28": 112,
      "29": 31,
      "30": 88,
      "31": 105,
      "32": 77,
      "33": 47,
      "34": 4,
      "35": 31,
      "36": 32,
      "37": 44,
      "38": 189,
      "39": 127,
      "40": 250,
      "41": 144,
      "42": 60,
      "43": 176,
      "44": 2,
      "45": 127,
      "46": 246,
      "47": 61,
      "48": 85,
      "49": 250,
      "50": 101,
      "51": 171,
      "52": 9,
      "53": 250,
      "54": 115,
      "55": 137,
      "56": 5,
      "57": 119,
      "58": 81,
      "59": 96,
      "60": 36,
      "61": 124,
      "62": 203,
      "63": 138,
      "64": 28
    },
    "resultSignature": {
      "0": 185,
      "1": 226,
      "2": 33,
      "3": 136,
      "4": 131,
      "5": 248,
      "6": 139,
      "7": 192,
      "8": 36,
      "9": 205,
      "10": 167,
      "11": 68,
      "12": 176,
      "13": 94,
      "14": 146,
      "15": 69,
      "16": 240,
      "17": 23,
      "18": 215,
      "19": 104,
      "20": 0,
      "21": 211,
      "22": 124,
      "23": 81,
      "24": 14,
      "25": 32,
      "26": 126,
      "27": 8,
      "28": 117,
      "29": 170,
      "30": 173,
      "31": 108,
      "32": 29,
      "33": 232,
      "34": 187,
      "35": 105,
      "36": 90,
      "37": 190,
      "38": 64,
      "39": 241,
      "40": 86,
      "41": 132,
      "42": 150,
      "43": 21,
      "44": 53,
      "45": 128,
      "46": 216,
      "47": 3,
      "48": 153,
      "49": 227,
      "50": 133,
      "51": 87,
      "52": 185,
      "53": 19,
      "54": 188,
      "55": 146,
      "56": 34,
      "57": 2,
      "58": 142,
      "59": 201,
      "60": 89,
      "61": 199,
      "62": 11,
      "63": 116,
      "64": 28
    }
  }
}

describe.only("MonzoReclaimVerifier", () => {
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
    providerHashes = ["0x6517cd2ca8d1608fa4f9306f729e581cfdb78a4ff76d71df74582dd9f7478f4e"];

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
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

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
      expect(intentHash).to.eq(BigNumber.from('115792089237316195423570985008687907853269984665640564039457584007913129639936').toHexString());
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"115792089237316195423570985008687907853269984665640564039457584007913129639936\",\"extractedParameters\":{\"TX_ID\":\"tx_0000AwGAsaQ0IKs6p4LlEi\",\"amount\":\"-100\",\"completedDate\":\"2025-07-18T14:01:56.31Z\",\"currency\":\"GBP\",\"userId\":\"0xf7d34e75095ea8fe491ba34938522c9066a9a01fb9daf722b819d69927149981\"},\"providerHash\":\"0x6517cd2ca8d1608fa4f9306f729e581cfdb78a4ff76d71df74582dd9f7478f4f\"}"
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