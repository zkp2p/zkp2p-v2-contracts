import "module-alias/register";

import { deployments, ethers, } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import {
  BasePaymentVerifier,
  NullifierRegistry,
  Escrow,
  ZelleBaseVerifier,
  ZelleBoAReclaimVerifier,
  USDCMock
} from "@utils/contracts";
import { Address, ReclaimProof } from "@utils/types";
import { usdc, ether } from "@utils/common";

import {
  getAccounts,
  getWaffleExpect,
} from "@utils/test";
import {
  Account
} from "@utils/test/types";
import { Currency } from "@utils/protocolUtils";

import DeployHelper from "@utils/deploys";
import { ADDRESS_ZERO } from "@utils/constants";
import { ZERO_BYTES32 } from "@utils/constants";
import { parseExtensionProof } from "@utils/reclaimUtils";
import { encodeProof } from "@utils/reclaimUtils";

const expect = getWaffleExpect();

const zelleBoAExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"{\\\"filterV1\\\":{\\\"dateFilter\\\":{\\\"timeframeForHistory\\\":\\\"DEFAULTDAYS\\\"}},\\\"sortCriteriaV1\\\":{\\\"fieldName\\\":\\\"DATE\\\",\\\"order\\\":\\\"DESCENDING\\\"},\\\"pageInfo\\\":{\\\"pageNum\\\":1,\\\"pageSize\\\":\\\"\\\"}}\",\"headers\":{\"Accept\":\"application/json\",\"Accept-Language\":\"en-US\",\"Content-Type\":\"application/json\",\"Origin\":\"https://secure.bankofamerica.com\",\"Referer\":\"https://secure.bankofamerica.com/pay-transfer-pay-portal/?request_locale=en-us&returnSiteIndicator=GAIEC&target=paymentactivity\",\"Sec-Fetch-Dest\":\"empty\",\"Sec-Fetch-Mode\":\"cors\",\"Sec-Fetch-Site\":\"same-origin\",\"User-Agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36\",\"X-Requested-With\":\"XMLHttpRequest\",\"sec-ch-ua\":\"\\\"Chromium\\\";v=\\\"136\\\", \\\"Google Chrome\\\";v=\\\"136\\\", \\\"Not.A/Brand\\\";v=\\\"99\\\"\",\"sec-ch-ua-mobile\":\"?0\",\"sec-ch-ua-platform\":\"\\\"macOS\\\"\"},\"method\":\"POST\",\"paramValues\":{},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"confirmationNumber\\\":\\\"(?<confirmationNumber>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"status\\\":\\\"(?<status>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"transactionDate\\\":\\\"(?<transactionDate>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9\\\\.]+)\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"aliasToken\\\":\\\"(?<aliasToken>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.completedTransactions[0].confirmationNumber\",\"xPath\":\"\"},{\"jsonPath\":\"$.completedTransactions[0].status\",\"xPath\":\"\"},{\"jsonPath\":\"$.completedTransactions[0].transactionDate\",\"xPath\":\"\"},{\"jsonPath\":\"$.completedTransactions[0].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.completedTransactions[0].targetAccount.aliasToken\",\"xPath\":\"\"}],\"url\":\"https://secure.bankofamerica.com/ogateway/payment-activity/api/v4/activity\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1746132575,
    "context": "{\"contextAddress\":\"0x0\",\"contextMessage\":\"0x0000000000000000000000000000000000000000000000000000000000000000\",\"extractedParameters\":{\"aliasToken\":\"0x3bcb39ffd57dd47e25c484c95ce7f7591305af0cfaaf7f18ab4ab548217fb303\",\"amount\":\"100.0\",\"confirmationNumber\":\"n5izkhusa\",\"status\":\"COMPLETED\",\"transactionDate\":\"2025-04-18\"},\"providerHash\":\"0x05eecaa422b995a513376f7ae0b3a16fab2bdcb7fb1eff38891475b56869a1bd\"}",
    "identifier": "0x222e8d48a28ee89aa6b99766594e8a4daa6188c7a530ce8ec617e3d868863260",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0x0636c417755e3ae25c6c166d181c0607f4c572a3",
    "claimSignature": { "0": 104, "1": 151, "2": 79, "3": 218, "4": 75, "5": 10, "6": 115, "7": 191, "8": 196, "9": 181, "10": 208, "11": 121, "12": 149, "13": 195, "14": 187, "15": 12, "16": 220, "17": 253, "18": 0, "19": 80, "20": 35, "21": 229, "22": 221, "23": 102, "24": 76, "25": 144, "26": 42, "27": 96, "28": 8, "29": 72, "30": 132, "31": 204, "32": 111, "33": 206, "34": 48, "35": 38, "36": 177, "37": 246, "38": 252, "39": 38, "40": 127, "41": 133, "42": 157, "43": 170, "44": 105, "45": 184, "46": 107, "47": 186, "48": 190, "49": 0, "50": 52, "51": 9, "52": 96, "53": 42, "54": 73, "55": 119, "56": 254, "57": 121, "58": 146, "59": 138, "60": 201, "61": 178, "62": 134, "63": 226, "64": 27 },
    "resultSignature": { "0": 141, "1": 48, "2": 96, "3": 49, "4": 69, "5": 77, "6": 17, "7": 183, "8": 8, "9": 244, "10": 237, "11": 41, "12": 161, "13": 212, "14": 48, "15": 27, "16": 132, "17": 200, "18": 68, "19": 235, "20": 237, "21": 17, "22": 230, "23": 223, "24": 199, "25": 128, "26": 105, "27": 51, "28": 200, "29": 119, "30": 101, "31": 99, "32": 38, "33": 27, "34": 201, "35": 229, "36": 70, "37": 162, "38": 68, "39": 77, "40": 92, "41": 111, "42": 147, "43": 141, "44": 99, "45": 125, "46": 129, "47": 164, "48": 211, "49": 11, "50": 209, "51": 204, "52": 165, "53": 234, "54": 81, "55": 157, "56": 4, "57": 68, "58": 113, "59": 96, "60": 130, "61": 196, "62": 187, "63": 153, "64": 28 }
  }
};

describe("ZelleBaseVerifier Tests", () => {
  let owner: Account;
  let user: Account;
  let escrow: Account;

  let zelleBaseVerifier: ZelleBaseVerifier;
  let zelleBoAReclaimVerifier: ZelleBoAReclaimVerifier;
  let nullifierRegistry: NullifierRegistry;
  let usdcToken: USDCMock;
  let mockVerifier: any;

  let deployer: DeployHelper;

  before(async () => {
    [
      owner,
      user,
      escrow
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    nullifierRegistry = await deployer.deployNullifierRegistry();
    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");


    zelleBaseVerifier = await deployer.deployZelleBaseVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.USD]
    );

    const providerHashes = ["0x05eecaa422b995a513376f7ae0b3a16fab2bdcb7fb1eff38891475b56869a1bd"];


    zelleBoAReclaimVerifier = await deployer.deployZelleBoAReclaimVerifier(
      zelleBaseVerifier.address,
      nullifierRegistry.address,
      providerHashes
    );

    await nullifierRegistry.connect(owner.wallet).addWritePermission(zelleBoAReclaimVerifier.address);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters", async () => {
      const actualOwner = await zelleBaseVerifier.owner();
      const actualEscrowAddress = await zelleBaseVerifier.escrow();
      const actualNullifierRegistryAddress = await zelleBaseVerifier.nullifierRegistry();
      const actualCurrencies = await zelleBaseVerifier.getCurrencies();

      expect(actualOwner).to.eq(owner.address);
      expect(actualEscrowAddress).to.eq(escrow.address);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(actualCurrencies).to.include(Currency.USD);
    });
  });


  describe("#setPaymentMethodVerifier", async () => {
    let subjectCaller: Account;
    let subjectVerifier: Address;
    let subjectPaymentMethod: number;

    beforeEach(async () => {
      subjectCaller = owner;
      subjectVerifier = zelleBoAReclaimVerifier.address;
      subjectPaymentMethod = 1;
    });

    async function subject(): Promise<any> {
      return await zelleBaseVerifier.connect(subjectCaller.wallet).setPaymentMethodVerifier(
        subjectPaymentMethod,
        subjectVerifier
      );
    }

    it("should add the payment method verifier", async () => {
      await subject();

      const verifierAddress = await zelleBaseVerifier.paymentMethodToVerifier(subjectPaymentMethod);
      expect(verifierAddress).to.eq(subjectVerifier);
    });

    it("should emit a PaymentMethodVerifierSet event", async () => {
      await expect(subject()).to.emit(
        zelleBaseVerifier,
        "PaymentMethodVerifierSet"
      ).withArgs(
        subjectPaymentMethod,
        subjectVerifier
      );
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = user;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("when the verifier address is zero", async () => {
      beforeEach(async () => {
        subjectVerifier = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid verifier address");
      });
    });
  });

  describe("#removePaymentMethodVerifier", async () => {
    let subjectCaller: Account;
    let subjectPaymentMethod: number;

    beforeEach(async () => {
      subjectCaller = owner;
      subjectPaymentMethod = 1;

      // First set up a payment method verifier so we can remove it
      await zelleBaseVerifier.connect(owner.wallet).setPaymentMethodVerifier(
        subjectPaymentMethod,
        zelleBoAReclaimVerifier.address
      );
    });

    async function subject(): Promise<any> {
      return await zelleBaseVerifier.connect(subjectCaller.wallet).removePaymentMethodVerifier(
        subjectPaymentMethod
      );
    }

    it("should remove the payment method verifier", async () => {
      await subject();

      const verifierAddress = await zelleBaseVerifier.paymentMethodToVerifier(subjectPaymentMethod);
      expect(verifierAddress).to.eq(ethers.constants.AddressZero);
    });

    it("should emit a PaymentMethodVerifierRemoved event", async () => {
      await expect(subject()).to.emit(
        zelleBaseVerifier,
        "PaymentMethodVerifierRemoved"
      ).withArgs(
        subjectPaymentMethod
      );
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = user;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("when the verifier is not set", async () => {
      beforeEach(async () => {
        // First remove the verifier
        await zelleBaseVerifier.connect(owner.wallet).removePaymentMethodVerifier(subjectPaymentMethod);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Verifier not set");
      });
    });
  });


  describe("Payment Verification", async () => {
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
      // Set up a payment method verifier for testing
      const paymentMethod = 1;
      await zelleBaseVerifier.connect(owner.wallet).setPaymentMethodVerifier(
        paymentMethod,
        zelleBoAReclaimVerifier.address
      );

      proof = parseExtensionProof(zelleBoAExtensionProof);
      const PROOF_ENCODING_STRING = "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim, bool isAppclipProof)";
      subjectProof = ethers.utils.defaultAbiCoder.encode(
        [PROOF_ENCODING_STRING, "uint8"],
        [proof, paymentMethod]
      );

      const paymentTimeString = '2025-04-18';
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(110);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(0.9);   // 110 * 0.9 = 99 [intent amount * conversion rate = payment amount]
      subjectPayeeDetailsHash = "0x3bcb39ffd57dd47e25c484c95ce7f7591305af0cfaaf7f18ab4ab548217fb303";
      subjectFiatCurrency = ZERO_BYTES32;
      subjectData = ethers.utils.defaultAbiCoder.encode(
        ['address[]'],
        [["0x0636c417755e3ae25c6c166d181c0607f4c572a3"]]
      );
    });

    async function subjectCallStatic(): Promise<[boolean, string]> {
      return await zelleBaseVerifier.connect(subjectCaller.wallet).callStatic.verifyPayment({
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

    it("should verify the bank of america proof", async () => {
      const [
        verified,
        intentHash
      ] = await subjectCallStatic();

      expect(verified).to.be.true;
      expect(intentHash).to.eq("0x0000000000000000000000000000000000000000000000000000000000000000");
    });
  });
});
