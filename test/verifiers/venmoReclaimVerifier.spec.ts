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
    "parameters": "{\"body\":\"\",\"method\":\"GET\",\"paramValues\":{\"SENDER_ID\":\"1168869611798528966\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"subType\\\":\\\"p2p\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[9].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].paymentId\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].title.receiver.id\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].title.payload.subType\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1741040819,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"17241995089265347562856273348407681006860445337286977787103845200506914238674\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"850.00\",\"date\":\"2025-02-26T22:18:57\",\"paymentId\":\"4276850732895209976\",\"receiverId\":\"0xc70eb85ded26d9377e4f0b244c638ee8f7e731114911bf547bff27f7d8fc3bfa\"},\"providerHash\":\"0x1f9bb657d328715a31789af4a1a2f6c1e970ff2e370ae5cd62d8c4f26997fa49\"}",
    "identifier": "0xd12eace7c770051b4e5dea41914f4ba5ee773642910f8900bd3543e8e0c7ec32",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": {"0":113,"1":187,"2":72,"3":135,"4":202,"5":30,"6":205,"7":4,"8":126,"9":5,"10":83,"11":180,"12":41,"13":16,"14":255,"15":161,"16":165,"17":20,"18":206,"19":191,"20":98,"21":130,"22":252,"23":1,"24":135,"25":239,"26":30,"27":222,"28":16,"29":217,"30":89,"31":5,"32":58,"33":245,"34":20,"35":224,"36":111,"37":106,"38":52,"39":9,"40":145,"41":5,"42":40,"43":116,"44":248,"45":234,"46":172,"47":191,"48":199,"49":70,"50":16,"51":233,"52":72,"53":138,"54":173,"55":104,"56":150,"57":230,"58":70,"59":249,"60":238,"61":150,"62":209,"63":139,"64":27},
    "resultSignature": {"0":71,"1":66,"2":92,"3":230,"4":246,"5":90,"6":149,"7":125,"8":129,"9":104,"10":30,"11":165,"12":133,"13":117,"14":95,"15":120,"16":234,"17":141,"18":4,"19":149,"20":67,"21":223,"22":237,"23":99,"24":144,"25":252,"26":203,"27":43,"28":42,"29":123,"30":191,"31":173,"32":66,"33":171,"34":107,"35":44,"36":122,"37":98,"38":134,"39":250,"40":25,"41":161,"42":64,"43":78,"44":14,"45":133,"46":30,"47":254,"48":147,"49":69,"50":33,"51":18,"52":182,"53":21,"54":168,"55":62,"56":180,"57":17,"58":130,"59":18,"60":107,"61":32,"62":67,"63":34,"64":27}
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

    witnesses = ["0x0636c417755e3ae25c6c166d181c0607f4c572a3", "0x244897572368eadf65bfbc5aec98d8e5443a9072"];
    providerHashes = ["0x1f9bb657d328715a31789af4a1a2f6c1e970ff2e370ae5cd62d8c4f26997fa49", "0x14de8b5503a4a6973bbaa9aa301ec7843e9bcaa3af05e6610b54c6fcc56aa425"];

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

      const paymentTimeString = '2025-02-26T22:18:57Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1.1);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(0.9);   // 1.1 * 0.9 = 0.99 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = "0xc70eb85ded26d9377e4f0b244c638ee8f7e731114911bf547bff27f7d8fc3bfa";
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
      expect(intentHash).to.eq(BigNumber.from('17241995089265347562856273348407681006860445337286977787103845200506914238674').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['4276850732895209976']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is an appclip proof", async () => {
      beforeEach(async () => {
        proof = parseAppclipProof(venmoAppclipProof);
        subjectProof = encodeProof(proof);
        const paymentTimeString = '2025-01-06T18:21:21Z'; // Added Z to make UTC
        const paymentTime = new Date(paymentTimeString);
        paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);
        subjectIntentTimestamp = BigNumber.from(paymentTimestamp);

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
        subjectIntentAmount = usdc(1000);  // 1000 * 0.9 = 900 [900 > 850]
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
