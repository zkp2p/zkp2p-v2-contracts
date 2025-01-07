import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, RevolutReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, parseAppclipProof, parseExtensionProof, encodeProof } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const revolutExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9\\\\-]+)\"},{\"type\":\"regex\",\"value\":\"\\\"completedDate\\\":(?<completedDate>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"currency\\\":\\\"(?<currency>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<id>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"username\\\":\\\"(?<username>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.[1].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].completedDate\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].currency\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].id\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].recipient.username\",\"xPath\":\"\"},{\"jsonPath\":\"$.[1].state\",\"xPath\":\"\"}],\"url\":\"https://app.revolut.com/api/retail/user/current/transactions/last?count=20\",\"writeRedactionMode\":\"zk\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1736195496,
    "context": "{\"contextAddress\":\"\",\"contextMessage\":\"17987314991900533465386579731694410438546809091389467293995987266679315178333\",\"extractedParameters\":{\"amount\":\"-98\",\"completedDate\":\"1735758706771\",\"currency\":\"EUR\",\"id\":\"67759372-3c29-a180-8947-6f71f4788e5a\",\"state\":\"COMPLETED\",\"username\":\"0xb0c846964b3a3afc29e2b1f931f7d66ee9cd542459cda2f7d22777e12394f923\"},\"providerHash\":\"0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c8\"}",
    "identifier": "0x4515bb8b1411028d0cdd7f19320cea2c337d2087edbb7c9349c03ba8db897a97",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "claimSignature": { "0": 70, "1": 139, "2": 113, "3": 217, "4": 202, "5": 247, "6": 40, "7": 40, "8": 96, "9": 145, "10": 210, "11": 128, "12": 21, "13": 25, "14": 101, "15": 81, "16": 53, "17": 217, "18": 25, "19": 67, "20": 34, "21": 201, "22": 151, "23": 249, "24": 145, "25": 144, "26": 101, "27": 58, "28": 228, "29": 116, "30": 30, "31": 30, "32": 125, "33": 193, "34": 24, "35": 164, "36": 41, "37": 206, "38": 46, "39": 52, "40": 177, "41": 125, "42": 7, "43": 199, "44": 237, "45": 156, "46": 145, "47": 30, "48": 254, "49": 76, "50": 38, "51": 49, "52": 31, "53": 93, "54": 48, "55": 186, "56": 75, "57": 207, "58": 119, "59": 220, "60": 240, "61": 225, "62": 156, "63": 74, "64": 28 },
    "resultSignature": { "0": 6, "1": 250, "2": 189, "3": 189, "4": 71, "5": 188, "6": 45, "7": 34, "8": 142, "9": 245, "10": 235, "11": 35, "12": 34, "13": 6, "14": 179, "15": 107, "16": 217, "17": 118, "18": 185, "19": 32, "20": 1, "21": 224, "22": 211, "23": 244, "24": 7, "25": 110, "26": 79, "27": 209, "28": 33, "29": 160, "30": 37, "31": 4, "32": 60, "33": 246, "34": 243, "35": 247, "36": 95, "37": 30, "38": 205, "39": 230, "40": 16, "41": 221, "42": 127, "43": 44, "44": 87, "45": 107, "46": 56, "47": 167, "48": 210, "49": 109, "50": 28, "51": 255, "52": 42, "53": 234, "54": 72, "55": 186, "56": 35, "57": 54, "58": 94, "59": 85, "60": 23, "61": 27, "62": 230, "63": 234, "64": 27 }
  }
}

// TODO: ASK RICHARD TO GENERATE BOTH THESE PROOFS FOR THE SAME PAYMENT
const revolutAppclipProof = {
  "claim": {
    "identifier": "0x5c04c5772181d94dd47e9eb71975fa5fd5b0ca5f0240a24002df8488acf2e1d9",
    "claimData": {
      "provider": "http",
      "parameters": { "additionalClientOptions": {}, "body": "", "geoLocation": "", "headers": { "Referer": "https://app.revolut.com/home?code=Y2JmMjBhZmQtY2QyMS00YzJhLTlmY2QtMDU1Zjc4ZTQyN2Q1Ojk2NTY4MzA0OlMyNTY&state=njuKAGDiZKJJrflx", "Sec-Fetch-Mode": "same-origin", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1", "accept": "application/json, text/plain, */*" }, "method": "GET", "paramValues": { "amount": "-100", "completedDate": "1736193670335", "currency": "USD", "id": "677c3686-4589-a4d3-b190-fc8380389c49", "state": "COMPLETED", "username": "alexgx7gy" }, "responseMatches": [{ "invert": false, "type": "contains", "value": "\"amount\":{{amount}}" }, { "invert": false, "type": "contains", "value": "\"currency\":\"{{currency}}\"" }, { "invert": false, "type": "contains", "value": "\"completedDate\":{{completedDate}}" }, { "invert": false, "type": "contains", "value": "\"username\":\"{{username}}\"" }, { "invert": false, "type": "contains", "value": "\"id\":\"{{id}}\"" }, { "invert": false, "type": "contains", "value": "\"state\":\"{{state}}\"" }], "responseRedactions": [{ "jsonPath": "$[0].amount", "regex": "\"amount\":(.*)", "xPath": "" }, { "jsonPath": "$[0].currency", "regex": "\"currency\":\"(.*)\"", "xPath": "" }, { "jsonPath": "$[0].completedDate", "regex": "\"completedDate\":(.*)", "xPath": "" }, { "jsonPath": "$[0].recipient.username", "regex": "\"username\":\"(.*)\"", "xPath": "" }, { "jsonPath": "$[0].id", "regex": "\"id\":\"(.*)\"", "xPath": "" }, { "jsonPath": "$[0].state", "regex": "\"state\":\"(.*)\"", "xPath": "" }], "url": "https://app.revolut.com/api/retail/user/current/transactions/last?count=20" },
      "owner": "0xa4f239ae872b61a640b232f2066f21862caef5c1",
      "timestampS": 1736195260,
      "context": { "contextAddress": "0x0", "contextMessage": "", "extractedParameters": { "amount": "-100", "completedDate": "1736193670335", "currency": "USD", "id": "677c3686-4589-a4d3-b190-fc8380389c49", "state": "COMPLETED", "username": "alexgx7gy" }, "providerHash": "0x1aab313df15d1b43710e53ed95b1b6118305aa9312f28b747c6c16cf574fb616" },
      "identifier": "0x5c04c5772181d94dd47e9eb71975fa5fd5b0ca5f0240a24002df8488acf2e1d9",
      "epoch": 1
    },
    "signatures": {
      "0": "0x5222588829ddc3cff7e66ab66244be391079f8ffcd7ffccf0d119984d7b70c461009372306498b864225880264e15b206b5f35d0f75c462d2afe4d6b90c7e7d21c"
    },
    "witnesses": {
      "0": {
        "id": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
        "url": "wss://witness.reclaimprotocol.org/ws",
        "publicData": ""
      }
    }
  }
};


describe("RevolutReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

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

    witnesses = ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "0x244897572368eadf65bfbc5aec98d8e5443a9072"];
    providerHashes = ["0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c8", "0x1aab313df15d1b43710e53ed95b1b6118305aa9312f28b747c6c16cf574fb616"];

    nullifierRegistry = await deployer.deployNullifierRegistry();
    verifier = await deployer.deployRevolutReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.EUR, Currency.USD, Currency.GBP, Currency.SGD],
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

    beforeEach(async () => {
      proof = parseExtensionProof(revolutExtensionProof);
      subjectProof = encodeProof(proof);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1);
      subjectIntentTimestamp = BigNumber.from(1735758706);
      subjectConversionRate = ether(0.98);     // 1 USDC * 0.98 EUR / USDC = 0.98 EUR required payment amount
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['alexgx7gy'])
      );
      subjectFiatCurrency = Currency.EUR;
      subjectData = ethers.utils.defaultAbiCoder.encode(
        ['address[]'],
        [witnesses]
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
      expect(intentHash).to.eq(BigNumber.from('17987314991900533465386579731694410438546809091389467293995987266679315178333').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['67759372-3c29-a180-8947-6f71f4788e5a']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is an appclip proof", async () => {
      beforeEach(async () => {
        proof = parseAppclipProof(revolutAppclipProof);
        subjectProof = encodeProof(proof);

        subjectFiatCurrency = Currency.USD;
        subjectPayeeDetailsHash = ethers.utils.keccak256(
          ethers.utils.solidityPack(['string'], ['alexgx7gy'])
        );
      });

      it("should verify the proof", async () => {
        const [
          verified,
          intentHash
        ] = await subjectCallStatic();

        expect(verified).to.be.true;

        // TODO: INSERT INTENT HASH IN APPCLIP PROOFS
        // expect(intentHash).to.eq(BigNumber.from('17987314991900533465386579731694410438546809091389467293995987266679315178333').toHexString());
      });
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
        subjectIntentAmount = usdc(1.01);   // just 1 cent more than the actual ask amount (1.01 * 0.98 = 0.9898) which is greater than the payment amount (0.98)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });

      describe("when the payment amount is more than the intent amount * conversion rate", async () => {
        beforeEach(async () => {
          subjectIntentAmount = usdc(0.99);   // just 1 cent less than the actual ask amount (0.99 * 0.98 = 0.9702) which is less than the payment amount (0.98)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the payment was made before the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(1735758706).add(1).add(BigNumber.from(30));  // payment timestamp + 1 + 30 seconds (buffer)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });

      describe("when the payment was made after the intent", async () => {
        beforeEach(async () => {
          subjectIntentTimestamp = BigNumber.from(1735758706).add(0).add(BigNumber.from(30));  // payment timestamp + 0 + 30 seconds (buffer)
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

      describe("when the proof is an appclip proof", async () => {
        beforeEach(async () => {
          proof = parseAppclipProof(revolutAppclipProof);
          subjectProof = encodeProof(proof);
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
        });
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
        proof.claimInfo.context = "{\"contextAddress\":\"\",\"contextMessage\":\"17987314991900533465386579731694410438546809091389467293995987266679315178333\",\"extractedParameters\":{\"amount\":\"-98\",\"completedDate\":\"1735758706771\",\"currency\":\"EUR\",\"id\":\"67759372-3c29-a180-8947-6f71f4788e5a\",\"state\":\"COMPLETED\",\"username\":\"0xb0c846964b3a3afc29e2b1f931f7d66ee9cd542459cda2f7d22777e12394f923\"},\"providerHash\":\"0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c9\"}";
        proof.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proof.claimInfo);

        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proof.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proof.signedClaim.signatures = [await witness.signMessage(digest)];

        subjectProof = encodeProof(proof)
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
