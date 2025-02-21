import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber, BytesLike } from "ethers";

import { MercadoPagoReclaimVerifier, NullifierRegistry, USDCMock } from "@utils/contracts";
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

const mercadoExtensionProof = {
}

const mercadoAppclipProof = {
  "identifier": "0xb32f8051d78e49b8b75332d31262942e8bfaf5b164da0267ae3d950e88f77315",
  "claimData": {
    "provider": "http",
    "parameters": "{\"additionalClientOptions\":{},\"body\":\"\",\"geoLocation\":\"\",\"headers\":{\"Sec-Fetch-Mode\":\"same-origin\",\"Sec-Fetch-Site\":\"same-origin\",\"User-Agent\":\"Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1\"},\"method\":\"GET\",\"paramValues\":{\"URL_PARAMS_1\":\"p2p_money_transfer-c2a624545946e41e5a069f7f652b47251c877fce\",\"URL_PARAMS_GRD\":\"mp-home\",\"amt\":\"420\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-07T12:47:00.000Z\",\"paymentStatus\":\"approved\",\"paymentType\":\"p2p_money_transfer\",\"paymetnId\":\"101586128026\",\"recipientId\":\"0000003100016901185863\"},\"responseMatches\":[{\"invert\":false,\"type\":\"contains\",\"value\":\"v2__detail\\\">CVU: {{recipientId}}</li>\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">{{amt}}</span><span aria-hidden=\\\"true\\\">,</span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">{{cents}}</span>\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"{{curr}}\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\",\\\"date\\\":\\\"{{date}}\\\",\\\"sections\\\"\"},{\"invert\":false,\"type\":\"contains\",\"value\":\"\\\"operationId\\\":\\\"{{paymetnId}}\\\",\\\"activityName\\\":\\\"{{paymentType}}\\\",\\\"activityStatus\\\":\\\"{{paymentStatus}}\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"\",\"regex\":\"v2__detail\\\">CVU: (.*?)</li>\",\"xPath\":\"\"},{\"jsonPath\":null,\"regex\":\"<span class=\\\"andes-money-amount__fraction\\\" aria-hidden=\\\"true\\\">(.*?)<\\\\/span><span aria-hidden=\\\"true\\\">,<\\\\/span><span class=\\\"andes-money-amount__cents\\\" aria-hidden=\\\"true\\\">(.*?)<\\\\/span>\",\"xPath\":null},{\"jsonPath\":null,\"regex\":\"\\\"Total\\\",\\\"amount\\\":{\\\"currency_id\\\":\\\"(.*?)\\\"\",\"xPath\":null},{\"jsonPath\":null,\"regex\":\",\\\"date\\\":\\\"(.*)\\\",\\\"sections\\\"\",\"xPath\":null},{\"jsonPath\":null,\"regex\":\"\\\"operationId\\\":\\\"(.*?)\\\",\\\"activityName\\\":\\\"(.*?)\\\",\\\"activityStatus\\\":\\\"(.*?)\\\"\",\"xPath\":null}],\"url\":\"https://www.mercadopago.com.ar/activities/detail/{{URL_PARAMS_1}}?from={{URL_PARAMS_GRD}}\"}",
    "owner": "0x26a6a591e79956709e16bead9ae6611af8f90c8d",
    "timestampS": 1740137543,
    "context": "{\"contextAddress\":\"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\",\"contextMessage\":\"20756922327599730735100651558696756420291259037277175062116341256901210969027\",\"extractedParameters\":{\"URL_PARAMS_1\":\"p2p_money_transfer-c2a624545946e41e5a069f7f652b47251c877fce\",\"URL_PARAMS_GRD\":\"mp-home\",\"amt\":\"420\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-07T12:47:00.000Z\",\"paymentStatus\":\"approved\",\"paymentType\":\"p2p_money_transfer\",\"paymetnId\":\"101586128026\",\"recipientId\":\"0000003100016901185863\"},\"providerHash\":\"0x7b7114ae280564c2b832837ddeb836001d813ba3572325497fe87a1ad59ab548\"}",
    "identifier": "0xb32f8051d78e49b8b75332d31262942e8bfaf5b164da0267ae3d950e88f77315",
    "epoch": 1
  },
  "signatures": [
    "0x2276d8a4f02b5642edc07e2ddadf7ee46330a48d25a8a3e870b2729b30e0ce484021efdaeb5426c45d51af1b7af6cd55557f9b96e4de5fb0ceac31a09eae32ec1c"
  ],
  "witnesses": [
    {
      "id": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
      "url": "wss://attestor.reclaimprotocol.org/ws"
    }
  ],
  "publicData": null
}


describe("MercadoPagoReclaimVerifier", () => {
  let owner: Account;
  let attacker: Account;
  let escrow: Account;
  let providerHashes: string[];
  let witnesses: Address[];

  let nullifierRegistry: NullifierRegistry;
  let verifier: MercadoPagoReclaimVerifier;
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
    providerHashes = ["0x7b7114ae280564c2b832837ddeb836001d813ba3572325497fe87a1ad59ab548"];

    nullifierRegistry = await deployer.deployNullifierRegistry();
    verifier = await deployer.deployMercadoPagoReclaimVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.ARS],
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
      // proof = parseExtensionProof(mercadoExtensionProof);
      proof = parseAppclipProof(mercadoAppclipProof);
      subjectProof = encodeProof(proof);

      const paymentTimeString = '2025-02-07T12:47:00Z'; // Added Z to make UTC
      const paymentTime = new Date(paymentTimeString);
      paymentTimestamp = Math.ceil(paymentTime.getTime() / 1000);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(2);
      subjectIntentTimestamp = BigNumber.from(paymentTimestamp);
      subjectConversionRate = ether(210);     // 2 USDC * 210 ARS / USDC = 420 ARS required payment amount
      subjectPayeeDetailsHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(['string'], ['0000003100016901185863'])
      );
      subjectFiatCurrency = Currency.ARS;
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
      expect(intentHash).to.eq(BigNumber.from('20756922327599730735100651558696756420291259037277175062116341256901210969027').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['101586128026']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe("when the proof is an appclip proof", async () => {
      beforeEach(async () => {
        proof = parseAppclipProof(mercadoAppclipProof);
        subjectProof = encodeProof(proof);

        subjectPayeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['0000003100016901185863']));
      });

      it("should verify the proof", async () => {
        const [
          verified,
          intentHash
        ] = await subjectCallStatic();

        expect(verified).to.be.true;
        expect(intentHash).to.eq(BigNumber.from('20756922327599730735100651558696756420291259037277175062116341256901210969027').toHexString());
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
        subjectIntentAmount = usdc(2.02);   // just 1 cent more than the actual ask amount (2.02 * 210 = 424.2) which is greater than the payment amount (420)
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment amount");
      });

      describe("when the payment amount is more than the intent amount * conversion rate", async () => {
        beforeEach(async () => {
          subjectIntentAmount = usdc(1.99);   // just 1 cent less than the actual ask amount (1.99 * 210 = 417.9) which is less than the payment amount (420)
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
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
        subjectPayeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['invalid_recipient']));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Incorrect payment recipient");
      });

      describe("when the proof is an appclip proof", async () => {
        beforeEach(async () => {
          proof = parseAppclipProof(mercadoAppclipProof);
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\",\"contextMessage\":\"20756922327599730735100651558696756420291259037277175062116341256901210969027\",\"extractedParameters\":{\"URL_PARAMS_1\":\"p2p_money_transfer-c2a624545946e41e5a069f7f652b47251c877fce\",\"URL_PARAMS_GRD\":\"mp-home\",\"amt\":\"420\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-07T12:47:00.000Z\",\"paymentStatus\":\"not-approved\",\"paymentType\":\"p2p_money_transfer\",\"paymetnId\":\"101586128026\",\"recipientId\":\"0000003100016901185863\"},\"providerHash\":\"0x7b7114ae280564c2b832837ddeb836001d813ba3572325497fe87a1ad59ab547\"}"; // changed last char to 7
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

    describe("when the payment status is not correct", async () => {
      beforeEach(async () => {
        proof.claimInfo.context = "{\"contextAddress\":\"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\",\"contextMessage\":\"20756922327599730735100651558696756420291259037277175062116341256901210969027\",\"extractedParameters\":{\"URL_PARAMS_1\":\"p2p_money_transfer-c2a624545946e41e5a069f7f652b47251c877fce\",\"URL_PARAMS_GRD\":\"mp-home\",\"amt\":\"420\",\"cents\":\"00\",\"curr\":\"ARS\",\"date\":\"2025-02-07T12:47:00.000Z\",\"paymentStatus\":\"not-approved\",\"paymentType\":\"p2p_money_transfer\",\"paymetnId\":\"101586128026\",\"recipientId\":\"0000003100016901185863\"},\"providerHash\":\"0x7b7114ae280564c2b832837ddeb836001d813ba3572325497fe87a1ad59ab548\"}";
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
        await expect(subject()).to.be.revertedWith("Invalid payment status");
      });
    });

    // todo: add tests for when payment type is not correct, payment is not a send transaction, etc.

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