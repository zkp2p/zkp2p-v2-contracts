import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, VenmoReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, convertSignatureToHex, encodeProof, parseExtensionProof, parseAppclipProof } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32, ONE_DAY_IN_SECONDS } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const venmoExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"\",\"method\":\"GET\",\"paramValues\":{\"SENDER_ID\":\"1168869611798528966\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[0].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].paymentId\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].title.receiver.id\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1736260561,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"11654989686991483391164401508422551252323102533275653137147840482625607853061\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"1.01\",\"date\":\"2025-01-06T18:21:21\",\"paymentId\":\"4239767587180066226\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"providerHash\":\"0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fd\"}",
    "identifier": "0x1da094a2fb1486f3e8b7430242dfc818df705b22d6e30117d13deb1c1281f3d2",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "claimSignature": { "0": 11, "1": 189, "2": 41, "3": 248, "4": 196, "5": 241, "6": 195, "7": 44, "8": 2, "9": 238, "10": 113, "11": 239, "12": 230, "13": 10, "14": 199, "15": 187, "16": 229, "17": 36, "18": 51, "19": 239, "20": 255, "21": 12, "22": 200, "23": 63, "24": 49, "25": 230, "26": 177, "27": 65, "28": 226, "29": 76, "30": 197, "31": 60, "32": 37, "33": 20, "34": 250, "35": 104, "36": 97, "37": 72, "38": 12, "39": 106, "40": 64, "41": 92, "42": 104, "43": 184, "44": 41, "45": 40, "46": 76, "47": 210, "48": 137, "49": 104, "50": 150, "51": 176, "52": 134, "53": 49, "54": 38, "55": 28, "56": 12, "57": 126, "58": 249, "59": 53, "60": 178, "61": 181, "62": 253, "63": 140, "64": 27 },
    "resultSignature": { "0": 172, "1": 9, "2": 9, "3": 239, "4": 152, "5": 87, "6": 87, "7": 103, "8": 162, "9": 77, "10": 46, "11": 250, "12": 157, "13": 4, "14": 197, "15": 124, "16": 9, "17": 205, "18": 115, "19": 237, "20": 106, "21": 167, "22": 204, "23": 10, "24": 228, "25": 73, "26": 242, "27": 152, "28": 215, "29": 148, "30": 138, "31": 92, "32": 30, "33": 4, "34": 99, "35": 112, "36": 11, "37": 131, "38": 4, "39": 143, "40": 84, "41": 252, "42": 53, "43": 222, "44": 212, "45": 228, "46": 149, "47": 206, "48": 79, "49": 238, "50": 109, "51": 150, "52": 188, "53": 170, "54": 252, "55": 238, "56": 30, "57": 10, "58": 52, "59": 151, "60": 82, "61": 199, "62": 95, "63": 77, "64": 27 }
  }
}

const venmoAppclipProof = {
  "identifier": "0xd925b4d1d168a1a3550e378adcb46905e40588b9af23debb4b7c9be1ab24a7f8",
  "claimData": {
    "provider": "http",
    "parameters": "{\"additionalClientOptions\":{},\"body\":\"\",\"geoLocation\":\"\",\"headers\":{\"Referer\":\"https://account.venmo.com/account/mfa/sms?next=%2F%3Ffeed%3Dmine&k=sgMjgoKqOfFCxhOWKLZ3xqO4R17HkLY6oM1mZbaE4zIixMuF9qmcOGJUe1wmm7BG\",\"Sec-Fetch-Mode\":\"same-origin\",\"User-Agent\":\"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1\"},\"method\":\"GET\",\"paramValues\":{\"URL_PARAMS_GRD\":\"1168869611798528966\",\"amount\":\"1.01\",\"date\":\"2025-01-06T18:21:21\",\"paymentId\":\"4239767587180066226\",\"receiverId\":\"645716473020416186\"},\"responseMatches\":[{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"amount\\\":\\\"- ${{amount}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"date\\\":\\\"{{date}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"id\\\":\\\"{{receiverId}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"paymentId\\\":\\\"{{paymentId}}\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[0].amount\",\"regex\":\"\\\"amount\\\":\\\"- \\\\$(.*)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].date\",\"regex\":\"\\\"date\\\":\\\"(.*)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].title.receiver.id\",\"regex\":\"\\\"id\\\":\\\"(.*)\\\"\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].paymentId\",\"regex\":\"\\\"paymentId\\\":\\\"(.*)\\\"\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId={{URL_PARAMS_GRD}}\"}",
    "owner": "0xa4f239ae872b61a640b232f2066f21862caef5c1",
    "timestampS": 1736263527,
    "context": "{\"contextAddress\":\"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\",\"contextMessage\":\"19647628387338148605484475718635527316117450420056269639082394264683709644449\",\"extractedParameters\":{\"URL_PARAMS_GRD\":\"1168869611798528966\",\"amount\":\"1.01\",\"date\":\"2025-01-06T18:21:21\",\"paymentId\":\"4239767587180066226\",\"receiverId\":\"645716473020416186\"},\"providerHash\":\"0x14de8b5503a4a6973bbaa9aa301ec7843e9bcaa3af05e6610b54c6fcc56aa425\"}",
    "identifier": "0xd925b4d1d168a1a3550e378adcb46905e40588b9af23debb4b7c9be1ab24a7f8",
    "epoch": 1
  },
  "signatures": [
    "0xb818f5b14282fd5b687b7f35ccaa52524d4c22c3968b8ea6f19cd0971811886d5f028670d527ac17bf4af807476dbfd532c173ebf80132db66d2c58c0333e5e51c"
  ],
  "witnesses": [
    {
      "id": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
      "url": "wss://witness.reclaimprotocol.org/ws"
    }
  ]
}

describe("VenmoReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: VenmoReclaimVerifier;
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
    providerHashes = ["0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fd", "0x14de8b5503a4a6973bbaa9aa301ec7843e9bcaa3af05e6610b54c6fcc56aa425"];

    nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployVenmoReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.USD],
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
      proof = parseExtensionProof(venmoExtensionProof);
      subjectProof = encodeProof(proof);

      const paymentTimeString = '2025-01-06T18:21:21Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1.1);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(0.9);   // 1.1 * 0.9 = 0.99 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['645716473020416186'])
      );
      subjectFiatCurrency = ZERO_BYTES32;
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
      expect(intentHash).to.eq(BigNumber.from('11654989686991483391164401508422551252323102533275653137147840482625607853061').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['4239767587180066226']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is an appclip proof", async () => {
      beforeEach(async () => {
        proof = parseAppclipProof(venmoAppclipProof);
        subjectProof = encodeProof(proof);

        subjectPayeeDetailsHash = ethers.utils.keccak256(
          ethers.utils.solidityPack(['string'], ['645716473020416186'])
        );
      });

      it("should verify the proof", async () => {
        const [
          verified,
          intentHash
        ] = await subjectCallStatic();

        expect(verified).to.be.true;
        expect(intentHash).to.eq(BigNumber.from('19647628387338148605484475718635527316117450420056269639082394264683709644449').toHexString());
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

    describe("when the payment amount is less than the intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(1.2);  // 1.2 * 0.9 = 1.08 [1.08 > 1.01]
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

      describe("when the proof is an appclip proof", async () => {
        beforeEach(async () => {
          proof = parseAppclipProof(venmoAppclipProof);
          subjectProof = encodeProof(proof);
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
        });
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"4550365876404035370013319374327198777228946732305032418394862064756897839843\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"1.01\",\"date\":\"2025-01-06T18:21:21\",\"paymentId\":\"4239767587180066226\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"providerHash\":\"0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fc\"}";
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
