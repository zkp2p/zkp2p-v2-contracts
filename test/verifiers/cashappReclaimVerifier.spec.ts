import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { NullifierRegistry, CashappReclaimVerifier, USDCMock } from "@utils/contracts";
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


const cashappExtensionProof = {
  "claim": {
    "provider": "http",
    "parameters": "{\"body\":\"{\\\"activity_token\\\":{\\\"activity_token_type\\\":\\\"CUSTOMER_TOKEN\\\",\\\"token\\\":\\\"{{SENDER_ID}}\\\"},\\\"activity_scope\\\":\\\"MY_ACTIVITY_WEB_V2\\\",\\\"caller_token\\\":\\\"{{SENDER_ID}}\\\",\\\"page_size\\\":15,\\\"request_context\\\":{}}\",\"method\":\"POST\",\"paramValues\":{\"SENDER_ID\":\"C_0twqj8ycc\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":(?<amount>[0-9]+)\"},{\"type\":\"regex\",\"value\":\"\\\"currency_code\\\":\\\"(?<currency_code>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"display_date\\\":(?<date>[0-9]+)\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"cashtag\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"token\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"state\\\":\\\"(?<state>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.amount.amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.amount.currency_code\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.display_date\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.recipient.cashtag\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.token\",\"xPath\":\"\"},{\"jsonPath\":\"$.activity_rows[1].payment_history_inputs_row.payment.state\",\"xPath\":\"\"}],\"url\":\"https://cash.app/cash-app/activity/v1.0/page\"}",
    "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
    "timestampS": 1736195952,
    "context": "{\"contextAddress\":\"\",\"contextMessage\":\"12014506636571874886965000811776567979685927375542718613570391557275994688735\",\"extractedParameters\":{\"SENDER_ID\":\"C_0twqj8ycc\",\"amount\":\"100\",\"currency_code\":\"USD\",\"date\":\"1735841166000\",\"paymentId\":\"7cwz2mgva\",\"receiverId\":\"0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585\",\"state\":\"COMPLETE\"},\"providerHash\":\"0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a5\"}",
    "identifier": "0xcb509d621e58aa3c71f9b890aa76df29b5e77b974e5c070a4f4e0d7d414ff35e",
    "epoch": 1
  },
  "signatures": {
    "attestorAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "claimSignature": { "0": 249, "1": 41, "2": 130, "3": 38, "4": 155, "5": 37, "6": 98, "7": 143, "8": 253, "9": 93, "10": 115, "11": 25, "12": 128, "13": 187, "14": 21, "15": 39, "16": 219, "17": 107, "18": 20, "19": 161, "20": 143, "21": 185, "22": 9, "23": 65, "24": 24, "25": 5, "26": 210, "27": 5, "28": 197, "29": 119, "30": 82, "31": 129, "32": 52, "33": 90, "34": 139, "35": 233, "36": 103, "37": 211, "38": 179, "39": 34, "40": 68, "41": 106, "42": 189, "43": 166, "44": 183, "45": 237, "46": 184, "47": 244, "48": 89, "49": 254, "50": 119, "51": 209, "52": 30, "53": 181, "54": 189, "55": 156, "56": 160, "57": 111, "58": 42, "59": 162, "60": 86, "61": 223, "62": 123, "63": 244, "64": 27 },
    "resultSignature": { "0": 97, "1": 242, "2": 54, "3": 3, "4": 202, "5": 212, "6": 21, "7": 154, "8": 70, "9": 25, "10": 230, "11": 181, "12": 54, "13": 42, "14": 217, "15": 164, "16": 214, "17": 169, "18": 229, "19": 106, "20": 180, "21": 109, "22": 118, "23": 242, "24": 137, "25": 255, "26": 59, "27": 4, "28": 150, "29": 122, "30": 87, "31": 91, "32": 26, "33": 99, "34": 7, "35": 93, "36": 217, "37": 217, "38": 2, "39": 191, "40": 115, "41": 199, "42": 141, "43": 200, "44": 108, "45": 43, "46": 50, "47": 193, "48": 166, "49": 228, "50": 131, "51": 63, "52": 202, "53": 126, "54": 95, "55": 171, "56": 11, "57": 206, "58": 250, "59": 145, "60": 180, "61": 171, "62": 205, "63": 245, "64": 28 }
  }
}

describe("CashappReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

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

    witnesses = ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "0x244897572368eadf65bfbc5aec98d8e5443a9072"];
    providerHashes = ["0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a5"];

    nullifierRegistry = await deployer.deployNullifierRegistry();
    const claimVerifier = await deployer.deployClaimVerifier();
    verifier = await deployer.deployCashappReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.USD],
      providerHashes,
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
      proof = parseExtensionProof(cashappExtensionProof);
      subjectProof = encodeProof(proof);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1.11);
      subjectIntentTimestamp = BigNumber.from(1735841166);
      subjectConversionRate = ether(0.9);   // 1.11 * 0.9 = 0.999 (payment amount)
      subjectPayeeDetailsHash = '0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585'
      subjectFiatCurrency = Currency.USD;
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
      expect(intentHash).to.eq(BigNumber.from("12014506636571874886965000811776567979685927375542718613570391557275994688735").toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['7cwz2mgva']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is invalid", async () => {
      beforeEach(async () => {
        proof.signedClaim.claim.identifier = ZERO_BYTES32;

        subjectProof = encodeProof(proof)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.reverted;
      });
    });

    describe("when the payment amount is less than the intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmount = usdc(1.12); // just 1 cent more than the actual ask amount (1.12 * 0.9 = 1.008) which is more than the payment amount (1.00)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });

      describe("when the payment amount is more than the intent amount * conversion rate", async () => {
        beforeEach(async () => {
          subjectIntentAmount = usdc(1.11); // just 1 cent less than the actual ask amount (1.11 * 0.9 = 0.999) which is less than the payment amount (1.00)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the payment was made before the intent", async () => {
      beforeEach(async () => {
        subjectIntentTimestamp = BigNumber.from(1735841166).add(1).add(BigNumber.from(30));  // payment timestamp + 1 + 30 seconds (buffer)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment timestamp");
      });

      describe("when the payment was made after the intent", async () => {
        beforeEach(async () => {
          subjectIntentTimestamp = BigNumber.from(1735841166).add(0).add(BigNumber.from(30));  // payment timestamp + 0 + 30 seconds (buffer)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the payment recipient is incorrect", async () => {
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
        proof.claimInfo.context = "{\"contextAddress\":\"\",\"contextMessage\":\"12014506636571874886965000811776567979685927375542718613570391557275994688735\",\"extractedParameters\":{\"SENDER_ID\":\"C_0twqj8ycc\",\"amount\":\"100\",\"currency_code\":\"USD\",\"date\":\"1735841166000\",\"paymentId\":\"7cwz2mgva\",\"receiverId\":\"0x7dfd873a8a837f59842e5493dcea3a71b6f559dacd5886d3ce65542e51240585\",\"state\":\"COMPLETE\"},\"providerHash\":\"0xb03e3643371b78072eeaa716fd7a4817ee747c89eb4a4bab1596cb70c6b7a4a6\"}";
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
