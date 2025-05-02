import "module-alias/register";
import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, ZelleChaseReclaimVerifier, USDCMock } from "@utils/contracts";
import { Account } from "@utils/test/types";
import { Address, ReclaimProof } from "@utils/types";
import DeployHelper from "@utils/deploys";
import { Currency } from "@utils/protocolUtils";
import { getIdentifierFromClaimInfo, createSignDataForClaim, encodeProof, parseExtensionProof, encodeTwoProofs } from "@utils/reclaimUtils";
import { Blockchain, usdc, ether } from "@utils/common";
import { ZERO_BYTES32 } from "@utils/constants";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";

const expect = getWaffleExpect();

const chaseListProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"pageId=&sortBy=PROCESS_DATE&orderBy=DESC\",\"headers\":{\"Accept\":\"*/*\",\"Accept-Language\":\"en-US,en;q=0.9\",\"Content-Type\":\"application/x-www-form-urlencoded; charset=UTF-8\",\"Origin\":\"https://secure.chase.com\",\"Referer\":\"https://secure.chase.com/web/auth/dashboard\",\"Sec-Fetch-Dest\":\"empty\",\"Sec-Fetch-Mode\":\"cors\",\"Sec-Fetch-Site\":\"same-origin\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36\",\"sec-ch-ua\":\"\\\"Chromium\\\";v=\\\"136\\\", \\\"Google Chrome\\\";v=\\\"136\\\", \\\"Not.A/Brand\\\";v=\\\"99\\\"\",\"sec-ch-ua-arch\":\"\\\"arm\\\"\",\"sec-ch-ua-bitness\":\"\\\"64\\\"\",\"sec-ch-ua-full-version-list\":\"\\\"Chromium\\\";v=\\\"136.0.7103.48\\\", \\\"Google Chrome\\\";v=\\\"136.0.7103.48\\\", \\\"Not.A/Brand\\\";v=\\\"99.0.0.0\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-model\":\"\\\"\\\"\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\",\"sec-ch-ua-platform-version\":\"\\\"15.4.1\\\"\",\"sec-ch-ua-wow64\":\"?0\",\"x-jpmc-client-request-id\":\"5a219128-33e8-42af-adba-39a3342a07e8\"},\"method\":\"POST\",\"paramValues\":{},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"id\\\":(?<id>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"status\\\":\\\"(?<status>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9\\\\.]+)\"}],\"responseRedactions\":[{\"jsonPath\":\"$.listItems[0].id\",\"xPath\":\"\"},{\"jsonPath\":\"$.listItems[0].status\",\"xPath\":\"\"},{\"jsonPath\":\"$.listItems[0].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.listItems[0].amount\",\"xPath\":\"\"}],\"url\":\"https://secure.chase.com/svc/rr/payments/secure/v1/quickpay/payment/activity/list\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1746195680,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"0x0000000000000000000000000000000000000000000000000000000000000000\",\"extractedParameters\":{\"amount\":\"10\",\"date\":\"20250428\",\"id\":\"24569221649\",\"status\":\"COMPLETED\"},\"providerHash\":\"0xe3648bbc283b9829eb2e81f6bb59608b26cb097c46fd18d678fcc4215986609e\"}",
    "identifier": "0x2a738aa044fe3f8a320a827071b44fd86c8497d4a2a06f94efb420507a8aa013",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": {"0":255,"1":99,"2":92,"3":168,"4":61,"5":179,"6":9,"7":153,"8":238,"9":9,"10":151,"11":14,"12":242,"13":235,"14":52,"15":222,"16":124,"17":83,"18":159,"19":167,"20":67,"21":42,"22":55,"23":157,"24":24,"25":63,"26":28,"27":152,"28":120,"29":172,"30":130,"31":76,"32":54,"33":146,"34":21,"35":131,"36":141,"37":112,"38":74,"39":139,"40":173,"41":194,"42":142,"43":61,"44":26,"45":146,"46":150,"47":149,"48":238,"49":227,"50":37,"51":35,"52":141,"53":118,"54":184,"55":66,"56":1,"57":62,"58":65,"59":58,"60":129,"61":13,"62":142,"63":201,"64":28},
    "resultSignature": {"0":173,"1":46,"2":41,"3":147,"4":117,"5":85,"6":35,"7":141,"8":160,"9":240,"10":207,"11":183,"12":124,"13":13,"14":202,"15":201,"16":138,"17":186,"18":203,"19":235,"20":191,"21":123,"22":222,"23":65,"24":6,"25":24,"26":165,"27":235,"28":58,"29":158,"30":139,"31":168,"32":73,"33":31,"34":197,"35":117,"36":177,"37":196,"38":175,"39":78,"40":22,"41":7,"42":158,"43":137,"44":235,"45":253,"46":219,"47":218,"48":79,"49":197,"50":93,"51":218,"52":87,"53":72,"54":186,"55":42,"56":39,"57":18,"58":40,"59":59,"60":44,"61":158,"62":221,"63":30,"64":27}
  }
};

const chaseDetailProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"paymentId={{PAYMENT_ID}}\",\"headers\":{\"Accept\":\"*/*\",\"Accept-Language\":\"en-US,en;q=0.9\",\"Content-Type\":\"application/x-www-form-urlencoded; charset=UTF-8\",\"Origin\":\"https://secure.chase.com\",\"Referer\":\"https://secure.chase.com/web/auth/dashboard\",\"Sec-Fetch-Dest\":\"empty\",\"Sec-Fetch-Mode\":\"cors\",\"Sec-Fetch-Site\":\"same-origin\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36\",\"sec-ch-ua\":\"\\\"Chromium\\\";v=\\\"136\\\", \\\"Google Chrome\\\";v=\\\"136\\\", \\\"Not.A/Brand\\\";v=\\\"99\\\"\",\"sec-ch-ua-arch\":\"\\\"arm\\\"\",\"sec-ch-ua-bitness\":\"\\\"64\\\"\",\"sec-ch-ua-full-version-list\":\"\\\"Chromium\\\";v=\\\"136.0.7103.48\\\", \\\"Google Chrome\\\";v=\\\"136.0.7103.48\\\", \\\"Not.A/Brand\\\";v=\\\"99.0.0.0\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-model\":\"\\\"\\\"\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\",\"sec-ch-ua-platform-version\":\"\\\"15.4.1\\\"\",\"sec-ch-ua-wow64\":\"?0\",\"x-jpmc-client-request-id\":\"88064867-f958-49e5-a14a-b6051acd9c0e\"},\"method\":\"POST\",\"paramValues\":{\"PAYMENT_ID\":\"24569221649\"},\"responseMatches\":[{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"recipientEmail\\\":\\\"(?<recipientEmail>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.recipientEmail\",\"xPath\":\"\"}],\"url\":\"https://secure.chase.com/svc/rr/payments/secure/v1/quickpay/payment/activity/detail/list\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1746196787,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"0x0000000000000000000000000000000000000000000000000000000000000000\",\"extractedParameters\":{\"PAYMENT_ID\":\"24569221649\",\"recipientEmail\":\"0x829bf7a59c5884cda204d6932e01e010a0b609e16dcef6da89b571a30b8b7cbb\"},\"providerHash\":\"0x21eb240c8a3131b258efceb330081cc0f8ca3e6e9e715e95fa0841ffe6a88dbe\"}",
    "identifier": "0xdfb32ab0ae5474cd3e4654b191035e587a23d2ec893287e4b712f327d08723a2",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": {"0":237,"1":207,"2":83,"3":6,"4":254,"5":121,"6":49,"7":133,"8":47,"9":149,"10":70,"11":37,"12":222,"13":215,"14":64,"15":1,"16":170,"17":102,"18":0,"19":30,"20":178,"21":17,"22":143,"23":21,"24":249,"25":204,"26":84,"27":167,"28":15,"29":196,"30":108,"31":55,"32":15,"33":125,"34":149,"35":236,"36":48,"37":106,"38":66,"39":198,"40":14,"41":61,"42":119,"43":36,"44":86,"45":223,"46":250,"47":143,"48":216,"49":226,"50":132,"51":182,"52":204,"53":192,"54":178,"55":187,"56":137,"57":109,"58":226,"59":208,"60":166,"61":171,"62":127,"63":12,"64":27},
    "resultSignature": {"0":252,"1":244,"2":154,"3":73,"4":43,"5":192,"6":218,"7":135,"8":106,"9":159,"10":21,"11":38,"12":84,"13":140,"14":15,"15":251,"16":217,"17":220,"18":75,"19":221,"20":195,"21":158,"22":126,"23":15,"24":237,"25":213,"26":72,"27":56,"28":139,"29":249,"30":150,"31":180,"32":34,"33":106,"34":157,"35":102,"36":32,"37":209,"38":207,"39":208,"40":130,"41":181,"42":123,"43":125,"44":197,"45":220,"46":63,"47":0,"48":122,"49":25,"50":151,"51":92,"52":89,"53":233,"54":91,"55":138,"56":245,"57":14,"58":77,"59":64,"60":163,"61":240,"62":175,"63":140,"64":27}
  }
};

describe("ZelleChaseReclaimVerifier", () => {
  let owner: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: ZelleChaseReclaimVerifier;
  let usdcToken: USDCMock;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      owner,
      escrow
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    witnesses = ["0x0636c417755e3ae25c6c166d181c0607f4c572a3"];
    providerHashes = [
      "0xe3648bbc283b9829eb2e81f6bb59608b26cb097c46fd18d678fcc4215986609e", // list
      "0x21eb240c8a3131b258efceb330081cc0f8ca3e6e9e715e95fa0841ffe6a88dbe"  // detail
    ];

    nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployZelleChaseReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.USD],
      providerHashes
    );

    await nullifierRegistry.connect(owner.wallet).addWritePermission(verifier.address);
  });

  describe("#verifyPayment", async () => {
    let proofList: ReclaimProof;
    let proofDetail: ReclaimProof;

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
      proofList = parseExtensionProof(chaseListProof);
      proofDetail = parseExtensionProof(chaseDetailProof);

      subjectProof = encodeTwoProofs(proofList, proofDetail);

      // For this example, date is "20250428" (YYYYMMDD)
      const paymentTimeString = '2025-04-28';
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.floor(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(10);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(1);   // 10 * 1 = 10
      subjectPayeeDetailsHash = "0x829bf7a59c5884cda204d6932e01e010a0b609e16dcef6da89b571a30b8b7cbb";
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
      expect(intentHash).to.eq("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['24569221649']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the payment amount is less than the intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(1000);  // 1000 * 1 = 1000 [1000 > 10]
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });
    });

    describe("when the payment was made before the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(paymentTimestamp).add(86400).add(BigNumber.from(30));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });
    });

    describe("when the payment recipient is incorrect", async () => {
      beforeEach(async () => {
        subjectPayeeDetailsHash = "0x1234567890123456789012345678901234567890123456789012345678901234";
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

    describe("when the provider list hash is invalid", async () => {
      beforeEach(async () => {
        // Mutate the providerHash in the list proof
        proofList.claimInfo.context = proofList.claimInfo.context.replace(
          "0xe3648bbc283b9829eb2e81f6bb59608b26cb097c46fd18d678fcc4215986609e",
          "0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fc"
        );
        proofList.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proofList.claimInfo);
        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proofList.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proofList.signedClaim.signatures = [await witness.signMessage(digest)];

        // Re-encode
        subjectProof = encodeTwoProofs(proofList, proofDetail);
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address, witnesses[0]]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("No valid providerHashList");
      });
    });

    describe("when the provider detail hash is invalid", async () => {
      beforeEach(async () => {
        // Mutate the providerHash in the detail proof
        proofDetail.claimInfo.context = proofDetail.claimInfo.context.replace(
          "0x21eb240c8a3131b258efceb330081cc0f8ca3e6e9e715e95fa0841ffe6a88dbe",
          "0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fc"
        );
        proofDetail.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proofDetail.claimInfo);
        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proofDetail.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proofDetail.signedClaim.signatures = [await witness.signMessage(digest)];

        // Re-encode
        subjectProof = encodeTwoProofs(proofList, proofDetail);
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address, witnesses[0]]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("No valid providerHashDetail");
      });
    });

    describe("when the payment status is not COMPLETED", async () => {
      beforeEach(async () => {
        proofList.claimInfo.context = proofList.claimInfo.context.replace("COMPLETED", "PENDING");
        proofList.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proofList.claimInfo);
        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proofList.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proofList.signedClaim.signatures = [await witness.signMessage(digest)];

        // Re-encode
        subjectProof = encodeTwoProofs(proofList, proofDetail);
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address, witnesses[0]]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment not completed");
      });
    });

    describe("when the payment IDs do not match", async () => {
      beforeEach(async () => {
        proofDetail.claimInfo.context = proofDetail.claimInfo.context.replace("24569221649", "99999999999");
        proofDetail.signedClaim.claim.identifier = getIdentifierFromClaimInfo(proofDetail.claimInfo);
        // sign the updated claim with a witness
        const digest = createSignDataForClaim(proofDetail.signedClaim.claim);
        const witness = ethers.Wallet.createRandom();
        proofDetail.signedClaim.signatures = [await witness.signMessage(digest)];

        // Re-encode
        subjectProof = encodeTwoProofs(proofList, proofDetail);
        subjectData = ethers.utils.defaultAbiCoder.encode(
          ['address[]'],
          [[witness.address, witnesses[0]]]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment IDs do not match");
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
