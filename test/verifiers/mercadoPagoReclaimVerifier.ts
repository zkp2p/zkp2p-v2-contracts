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
  "identifier": "0x7ad0e838c26b748d00586c919ec02cf5ca20feff358d5b1c84882eed96139509",
  "claimData": {
    "provider": "http",
    "parameters": '{"additionalClientOptions":{},"body":"","geoLocation":"","headers":{"Sec-Fetch-Mode":"same-origin","Sec-Fetch-Site":"same-origin","User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1"},"method":"GET","paramValues":{"URL_PARAMS_1":"p2p_money_transfer-4e89751e1a887bb8c646b5c2c7cdf5faa15f362c","URL_PARAMS_GRD":"mp-home","amt":"100","cents":"00","curr":"ARS","date":"2025-02-07T12:24:57.000Z","paymentStatus":"approved","paymentType":"p2p_money_transfer","paymetnId":"101584251600","recipientId":"0000003100016901185863"},"responseMatches":[{"invert":false,"type":"contains","value":"v2__detail\">CVU: {{recipientId}}</li>"},{"invert":false,"type":"contains","value":"<span class=\"andes-money-amount__fraction\" aria-hidden=\"true\">{{amt}}</span><span aria-hidden=\"true\">,</span><span class=\"andes-money-amount__cents\" aria-hidden=\"true\">{{cents}}</span>"},{"invert":false,"type":"contains","value":"Total\",\"amount\":{\"currency_id\":\"{{curr}}\""},{"invert":false,"type":"contains","value":",\"date\":\"{{date}}\",\"sections\""},{"invert":false,"type":"contains","value":"\"operationId\":\"{{paymetnId}}\",\"activityName\":\"{{paymentType}}\",\"activityStatus\":\"{{paymentStatus}}\""}],"responseRedactions":[{"jsonPath":"","regex":"v2__detail\">CVU: (.*?)</li>","xPath":""},{"jsonPath":null,"regex":"<span class=\"andes-money-amount__fraction\" aria-hidden=\"true\">(.*?)<\\/span><span aria-hidden=\"true\">,<\\/span><span class=\"andes-money-amount__cents\" aria-hidden=\"true\">(.*?)<\\/span>","xPath":null},{"jsonPath":null,"regex":"\"Total\",\"amount\":{\"currency_id\":\"(.*?)\"","xPath":null},{"jsonPath":null,"regex":",\"date\":\"(.*)\",\"sections\"","xPath":null},{"jsonPath":null,"regex":"\"operationId\":\"(.*?)\",\"activityName\":\"(.*?)\",\"activityStatus\":\"(.*?)\"","xPath":null}],"url":"https://www.mercadopago.com.ar/activities/detail/{{URL_PARAMS_1}}?from={{URL_PARAMS_GRD}}"}',
    "owner": "0x26a6a591e79956709e16bead9ae6611af8f90c8d",
    "timestampS": 1740122392,
    "context": '{"contextAddress":"0x0","contextMessage":"","extractedParameters":{"URL_PARAMS_1":"p2p_money_transfer-4e89751e1a887bb8c646b5c2c7cdf5faa15f362c","URL_PARAMS_GRD":"mp-home","amt":"100","cents":"00","curr":"ARS","date":"2025-02-07T12:24:57.000Z","paymentStatus":"approved","paymentType":"p2p_money_transfer","paymetnId":"101584251600","recipientId":"0000003100016901185863"},"providerHash":"0x7b7114ae280564c2b832837ddeb836001d813ba3572325497fe87a1ad59ab548"}',
    "identifier": "0x7ad0e838c26b748d00586c919ec02cf5ca20feff358d5b1c84882eed96139509",
    "epoch": 1
  },
  "signatures": [
    "0xf3ce1dad59db5eafb79dbca038c11a5928f0cae7184bb896d1c6e702c70e432a473ebc080ed37a5e187ca0c26c8e4fc3ff81e41cfe4035f3462e13fa7366c6ac1b"
  ],
  "witnesses": [
    {
      "id": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
      "url": "wss://attestor.reclaimprotocol.org/ws"
    }
  ],
  "publicData": {}
}


describe.only("MercadoPagoReclaimVerifier", () => {
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

  describe.only("#constructor", async () => {
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
      // proof = parseExtensionProof(mercadoExtensionProof);
      proof = parseAppclipProof(mercadoAppclipProof);
      subjectProof = encodeProof(proof);

      subjectCaller = escrow;
      subjectDepositToken = usdcToken.address;
      subjectIntentAmount = usdc(1);
      subjectIntentTimestamp = BigNumber.from(1735758706);
      subjectConversionRate = ether(100);     // 1 USDC * 100 ARS / USDC = 100 ARS required payment amount
      // subjectPayeeDetailsHash = ethers.utils.keccak256(
      //   ethers.utils.solidityPack(['string'], ['alexgx7gy'])
      // );
      subjectPayeeDetailsHash = '0000003100016901185863';
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
      // expect(intentHash).to.eq(BigNumber.from('2618855330259351132643749738312276409026917421853980101201034599731745761128').toHexString());
    });

    it("should nullify the payment id", async () => {
      await subject();

      const nullifier = ethers.utils.keccak256(ethers.utils.solidityPack(['string'], ['101584251600']));
      const isNullified = await nullifierRegistry.isNullified(nullifier);

      expect(isNullified).to.be.true;
    });

    describe.only("when the proof is an appclip proof", async () => {
      beforeEach(async () => {
        proof = parseAppclipProof(mercadoAppclipProof);
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
        // expect(intentHash).to.eq(BigNumber.from('21138964711553769010780423915557687380568289483182695160148231659899695028258').toHexString());
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"17987314991900533465386579731694410438546809091389467293995987266679315178333\",\"extractedParameters\":{\"amount\":\"-98\",\"completedDate\":\"1735758706771\",\"currency\":\"EUR\",\"id\":\"67759372-3c29-a180-8947-6f71f4788e5a\",\"state\":\"COMPLETED\",\"username\":\"0xb0c846964b3a3afc29e2b1f931f7d66ee9cd542459cda2f7d22777e12394f923\"},\"providerHash\":\"0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c9\"}";
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
        proof.claimInfo.context = "{\"contextAddress\":\"0x0\",\"contextMessage\":\"17987314991900533465386579731694410438546809091389467293995987266679315178333\",\"extractedParameters\":{\"amount\":\"-98\",\"completedDate\":\"1735758706771\",\"currency\":\"EUR\",\"id\":\"67759372-3c29-a180-8947-6f71f4788e5a\",\"state\":\"INCOMPLETE\",\"username\":\"0xb0c846964b3a3afc29e2b1f931f7d66ee9cd542459cda2f7d22777e12394f923\"},\"providerHash\":\"0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c8\"}";
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