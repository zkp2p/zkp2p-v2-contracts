import "module-alias/register";

import { ethers } from "hardhat";

import {
  Address,
} from "@utils/types";
import { Account } from "@utils/test/types";
import {
  Escrow,
  ProtocolViewer,
  IEscrow,
  USDCMock,
  PaymentVerifierMock,
  PostIntentHookRegistry,
  PaymentVerifierRegistry,
  Orchestrator,
  RelayerRegistry,
  EscrowRegistry
} from "@utils/contracts";
import DeployHelper from "@utils/deploys";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";
import { Blockchain, ether, usdc } from "@utils/common";
import { BigNumber } from "ethers";
import { ZERO, ZERO_BYTES32, ADDRESS_ZERO, ONE } from "@utils/constants";
import { calculateIntentHash, calculateRevolutIdHash, calculateRevolutIdHashBN } from "@utils/protocolUtils";
import { ONE_DAY_IN_SECONDS } from "@utils/constants";
import { Currency } from "@utils/protocolUtils";
import { generateGatingServiceSignature, createSignalIntentParams } from "@utils/test/helpers";

const expect = getWaffleExpect();

const blockchain = new Blockchain(ethers.provider);

describe("ProtocolViewer", () => {
  let owner: Account;
  let offRamper: Account;
  let offRamperNewAcct: Account;
  let onRamper: Account;
  let onRamperOtherAddress: Account;
  let onRamperTwo: Account;
  let receiver: Account;
  let maliciousOnRamper: Account;
  let feeRecipient: Account;
  let gatingService: Account;
  let witness: Account;
  let protocolFeeRecipient: Account;
  let chainId: BigNumber = ONE;

  let escrow: Escrow;
  let orchestrator: Orchestrator;
  let protocolViewer: ProtocolViewer;
  let usdcToken: USDCMock;
  let paymentVerifierRegistry: PaymentVerifierRegistry;
  let postIntentHookRegistry: PostIntentHookRegistry;
  let relayerRegistry: RelayerRegistry;
  let escrowRegistry: EscrowRegistry;

  let verifier: PaymentVerifierMock;
  let otherVerifier: PaymentVerifierMock;
  let deployer: DeployHelper;
  let currentIntentCounter: number = 0;

  beforeEach(async () => {
    [
      owner,
      offRamper,
      onRamper,
      onRamperOtherAddress,
      onRamperTwo,
      receiver,
      maliciousOnRamper,
      offRamperNewAcct,
      feeRecipient,
      gatingService,
      witness,
      protocolFeeRecipient
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    paymentVerifierRegistry = await deployer.deployPaymentVerifierRegistry();
    postIntentHookRegistry = await deployer.deployPostIntentHookRegistry();
    escrowRegistry = await deployer.deployEscrowRegistry();
    relayerRegistry = await deployer.deployRelayerRegistry();

    await usdcToken.transfer(offRamper.address, usdc(10000));

    escrow = await deployer.deployEscrow(
      owner.address,
      chainId,
      paymentVerifierRegistry.address,
      ZERO,
      protocolFeeRecipient.address,
      ZERO,
      BigNumber.from(10),
      ONE_DAY_IN_SECONDS
    );

    await escrowRegistry.addEscrow(escrow.address);

    orchestrator = await deployer.deployOrchestrator(
      owner.address,
      chainId,
      escrowRegistry.address,
      paymentVerifierRegistry.address,
      postIntentHookRegistry.address,
      relayerRegistry.address,           // relayer registry
      ZERO,                              // protocol fee (0%)
      feeRecipient.address               // protocol fee recipient
    );

    await escrow.connect(owner.wallet).setOrchestrator(orchestrator.address);

    protocolViewer = await deployer.deployProtocolViewer(
      escrow.address,
      orchestrator.address
    );

    const nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployPaymentVerifierMock(
      escrow.address,
      nullifierRegistry.address,
      ZERO,
      [Currency.USD, Currency.EUR]
    );
    otherVerifier = await deployer.deployPaymentVerifierMock(
      escrow.address,
      nullifierRegistry.address,
      ZERO,
      [Currency.USD]
    );

    await paymentVerifierRegistry.addPaymentVerifier(verifier.address);
  });

  describe("#getDeposit", async () => {
    let subjectDepositId: BigNumber;

    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Create a deposit first
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      depositConversionRate = ether(1.08);
      const payeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails"));
      const depositData = ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [witness.address]
      );

      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: payeeDetails,
          data: depositData,
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: depositConversionRate }]
        ],
        delegate: ethers.constants.AddressZero,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      subjectDepositId = ZERO;
    });

    async function subject(): Promise<any> {
      return protocolViewer.getDeposit(subjectDepositId);
    }

    it("should return the correct deposit details", async () => {
      const depositView = await subject();

      expect(depositView.depositId).to.eq(subjectDepositId);
      expect(depositView.deposit.token).to.eq(usdcToken.address);
      expect(depositView.deposit.depositor).to.eq(offRamper.address);
      expect(depositView.deposit.amount).to.eq(usdc(100));
      expect(depositView.deposit.intentAmountRange.min).to.eq(usdc(10));
      expect(depositView.deposit.intentAmountRange.max).to.eq(usdc(200));
      expect(depositView.deposit.remainingDeposits).to.eq(usdc(100));
      expect(depositView.deposit.outstandingIntentAmount).to.eq(ZERO);
      expect(depositView.deposit.acceptingIntents).to.be.true;
    });

    it("should return the correct verifier details", async () => {
      const depositView = await subject();

      expect(depositView.verifiers.length).to.eq(1);
      expect(depositView.verifiers[0].verifier).to.eq(verifier.address);
      expect(depositView.verifiers[0].verificationData.intentGatingService).to.eq(gatingService.address);
      expect(depositView.verifiers[0].currencies.length).to.eq(1);
      expect(depositView.verifiers[0].currencies[0].code).to.eq(Currency.USD);
      expect(depositView.verifiers[0].currencies[0].minConversionRate).to.eq(depositConversionRate);
    });

    it("should return the correct available liquidity", async () => {
      const depositView = await subject();

      expect(depositView.availableLiquidity).to.eq(usdc(100));
    });

    describe("when there are prunable intents", async () => {
      beforeEach(async () => {
        // Create and signal an intent
        const params = await createSignalIntentParams(
          orchestrator.address,
          escrow.address,
          subjectDepositId,
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          ethers.constants.AddressZero,  // referrer
          ZERO,                           // referrerFee
          gatingService,
          chainId.toString(),
          ethers.constants.AddressZero,
          "0x"
        );

        await orchestrator.connect(onRamper.wallet).signalIntent(params);

        // Move time forward past intent expiration
        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());
      });

      it("should include prunable amounts in available liquidity", async () => {
        const depositView = await subject();

        expect(depositView.availableLiquidity).to.eq(usdc(100));
      });
    });

    describe("when the deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = ONE;
      });

      it("should return empty deposit view", async () => {
        const depositView = await subject();

        expect(depositView.deposit.depositor).to.eq(ADDRESS_ZERO);
        expect(depositView.verifiers.length).to.eq(0);
      });
    });
  });

  describe("#getAccountDeposits", async () => {
    let subjectAccount: string;

    beforeEach(async () => {
      // Create a few deposits for the test account
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));

      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: ether(1.08) }]
        ],
        delegate: ethers.constants.AddressZero,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(200),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: ether(1.08) }]
        ],
        delegate: ethers.constants.AddressZero,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      subjectAccount = offRamper.address;
    });

    async function subject(): Promise<any> {
      return protocolViewer.getAccountDeposits(subjectAccount);
    }

    it("should return correct deposit IDs for account", async () => {
      const deposits = await subject();

      expect(deposits.length).to.eq(2);
      expect(deposits[0].depositId).to.eq(ZERO);
      expect(deposits[1].depositId).to.eq(ONE);
    });

    describe("when account has no deposits", async () => {
      beforeEach(async () => {
        subjectAccount = onRamper.address;
      });

      it("should return empty array", async () => {
        const deposits = await subject();
        expect(deposits.length).to.eq(0);
      });
    });
  });

  describe("#getDepositFromIds", async () => {
    let subjectDepositIds: BigNumber[];

    beforeEach(async () => {
      // Create two deposits
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: ether(1.08) }]
        ],
        delegate: ethers.constants.AddressZero,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(200),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: ether(1.08) }]
        ],
        delegate: ethers.constants.AddressZero,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      subjectDepositIds = [ZERO, ONE];
    });

    async function subject(): Promise<any> {
      return protocolViewer.getDepositFromIds(subjectDepositIds);
    }

    it("should return correct deposits", async () => {
      const deposits = await subject();

      expect(deposits.length).to.eq(2);
      expect(deposits[0].depositId).to.eq(ZERO);
      expect(deposits[1].depositId).to.eq(ONE);
    });

    describe("when deposit IDs don't exist", async () => {
      beforeEach(async () => {
        subjectDepositIds = [BigNumber.from(2)];
      });

      it("should return deposit with zero address depositor", async () => {
        const deposits = await subject();
        expect(deposits[0].deposit.depositor).to.eq(ADDRESS_ZERO);
      });
    });
  });

  describe("#getIntent", async () => {
    let subjectIntentHash: string;

    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Create deposit and signal intent
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      depositConversionRate = ether(1.08);
      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: depositConversionRate }]
        ],
        delegate: ethers.constants.AddressZero,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      const gatingServiceSignature = await generateGatingServiceSignature(
        gatingService,
        orchestrator.address,
        escrow.address,
        ZERO,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        depositConversionRate,
        chainId.toString()
      );

      const params = await createSignalIntentParams(
        orchestrator.address,
        escrow.address,
        ZERO,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        depositConversionRate,
        ethers.constants.AddressZero,  // referrer
        ZERO,                           // referrerFee
        gatingService,
        chainId.toString(),
        ethers.constants.AddressZero,
        "0x"
      );

      await orchestrator.connect(onRamper.wallet).signalIntent(params);

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectIntentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );
    });

    async function subject(): Promise<any> {
      return protocolViewer.getIntent(subjectIntentHash);
    }

    it("should return correct intent", async () => {
      const intent = await subject();

      expect(intent.intentHash).to.eq(subjectIntentHash);
      expect(intent.intent.owner).to.eq(onRamper.address);
      expect(intent.intent.depositId).to.eq(ZERO);
    });
  });

  describe("#getIntents", async () => {
    let subjectIntentHashes: string[];
    let intentHash: string;

    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Create deposit and signal intent
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      depositConversionRate = ether(1.08);
      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: depositConversionRate }]
        ],
        delegate: ethers.constants.AddressZero,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      const gatingServiceSignature = await generateGatingServiceSignature(
        gatingService,
        orchestrator.address,
        escrow.address,
        ZERO,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        depositConversionRate,
        chainId.toString()
      );

      const params = await createSignalIntentParams(
        orchestrator.address,
        escrow.address,
        ZERO,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        depositConversionRate,
        ethers.constants.AddressZero,  // referrer
        ZERO,                           // referrerFee
        gatingService,
        chainId.toString(),
        ethers.constants.AddressZero,
        "0x"
      );

      await orchestrator.connect(onRamper.wallet).signalIntent(params);

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      intentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );

      subjectIntentHashes = [intentHash];
    });

    async function subject(): Promise<any> {
      return protocolViewer.getIntents(subjectIntentHashes);
    }

    it("should return correct intents", async () => {
      const intents = await subject();

      expect(intents.length).to.eq(1);
      expect(intents[0].intentHash).to.eq(intentHash);
      expect(intents[0].intent.owner).to.eq(onRamper.address);
    });
  });

  describe("#getAccountIntents", async () => {
    let subjectAccount: string;

    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Enable multiple intents for testing
      await orchestrator.connect(owner.wallet).setAllowMultipleIntents(true);

      // Create deposit and signal intent
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      depositConversionRate = ether(1.08);
      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: depositConversionRate }]
        ],
        delegate: ethers.constants.AddressZero,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      const params = await createSignalIntentParams(
        orchestrator.address,
        escrow.address,
        ZERO,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        depositConversionRate,
        ethers.constants.AddressZero,  // referrer
        ZERO,                           // referrerFee
        gatingService,
        chainId.toString(),
        ethers.constants.AddressZero,
        "0x"
      );

      await orchestrator.connect(onRamper.wallet).signalIntent(params);

      subjectAccount = onRamper.address;
    });

    async function subject(): Promise<any> {
      return protocolViewer.getAccountIntents(subjectAccount);
    }

    it("should return correct intents for account", async () => {
      const intents = await subject();

      expect(intents.length).to.eq(1);
      expect(intents[0].intent.owner).to.eq(onRamper.address);
    });

    describe("when account has no intents", async () => {
      beforeEach(async () => {
        subjectAccount = offRamper.address;
      });

      it("should return empty array", async () => {
        const intents = await subject();
        expect(intents.length).to.eq(0);
      });
    });

    describe("when account has multiple intents", async () => {
      beforeEach(async () => {
        // Signal a second intent
        const params2 = await createSignalIntentParams(
          orchestrator.address,
          escrow.address,
          ZERO,
          usdc(30),
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          ethers.constants.AddressZero,
          ZERO,
          gatingService,
          chainId.toString(),
          ethers.constants.AddressZero,
          "0x"
        );

        await orchestrator.connect(onRamper.wallet).signalIntent(params2);

        // Add a small delay to prevent gas estimation issues
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      it("should return all intents for the account", async () => {
        const intents = await subject();
        expect(intents.length).to.eq(2);
        expect(intents[0].intent.owner).to.eq(onRamper.address);
        expect(intents[1].intent.owner).to.eq(onRamper.address);
      });
    });
  });
});
