import "module-alias/register";

import { ethers, network } from "hardhat";
import { Signer } from "ethers";

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
  PostIntentHookMock,
  PostIntentHookRegistry,
  PaymentVerifierRegistry,
  Orchestrator,
  RelayerRegistry,
  OrchestratorMock,
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

describe("Escrow", () => {
  let owner: Account;
  let offRamper: Account;
  let offRamperDelegate: Account;
  let offRamperNewAcct: Account;
  let onRamper: Account;
  let onRamperOtherAddress: Account;
  let onRamperTwo: Account;
  let receiver: Account;
  let maliciousOnRamper: Account;
  let feeRecipient: Account;
  let gatingService: Account;
  let witness: Account;
  let intentGuardian: Account;
  let chainId: BigNumber = ONE;
  let currentIntentCounter: number = 0;

  let ramp: Escrow;
  let protocolViewer: ProtocolViewer;
  let usdcToken: USDCMock;
  let paymentVerifierRegistry: PaymentVerifierRegistry;
  let postIntentHookRegistry: PostIntentHookRegistry;
  let escrowRegistry: EscrowRegistry;
  let orchestrator: Orchestrator;
  let relayerRegistry: RelayerRegistry;
  let postIntentHookMock: PostIntentHookMock;
  let orchestratorMock: OrchestratorMock;
  let protocolFeeRecipient: Account;

  let verifier: PaymentVerifierMock;
  let otherVerifier: PaymentVerifierMock;
  let deployer: DeployHelper;

  beforeEach(async () => {
    currentIntentCounter = 0;  // Reset intent counter for each test
    [
      owner,
      offRamper,
      offRamperDelegate,
      onRamper,
      onRamperOtherAddress,
      onRamperTwo,
      receiver,
      maliciousOnRamper,
      offRamperNewAcct,
      feeRecipient,
      gatingService,
      witness,
      protocolFeeRecipient,
      intentGuardian
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    paymentVerifierRegistry = await deployer.deployPaymentVerifierRegistry();
    postIntentHookRegistry = await deployer.deployPostIntentHookRegistry();
    escrowRegistry = await deployer.deployEscrowRegistry();
    relayerRegistry = await deployer.deployRelayerRegistry();

    await usdcToken.transfer(offRamper.address, usdc(10000));

    ramp = await deployer.deployEscrow(
      owner.address,
      chainId,
      paymentVerifierRegistry.address,
      ZERO,
      protocolFeeRecipient.address,
      ZERO,
      BigNumber.from(3),
      ONE_DAY_IN_SECONDS  // intentExpirationPeriod
    );

    await escrowRegistry.addEscrow(ramp.address);

    orchestrator = await deployer.deployOrchestrator(
      owner.address,
      chainId,
      escrowRegistry.address,
      paymentVerifierRegistry.address,
      postIntentHookRegistry.address,
      relayerRegistry.address,
      ZERO,
      feeRecipient.address
    );

    await ramp.connect(owner.wallet).setOrchestrator(orchestrator.address);

    protocolViewer = await deployer.deployProtocolViewer(ramp.address, orchestrator.address);

    const nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployPaymentVerifierMock(
      ramp.address,
      nullifierRegistry.address,
      ZERO,
      [Currency.USD, Currency.EUR]
    );
    otherVerifier = await deployer.deployPaymentVerifierMock(
      ramp.address,
      nullifierRegistry.address,
      ZERO,
      [Currency.USD]
    );

    await paymentVerifierRegistry.addPaymentVerifier(verifier.address);

    postIntentHookMock = await deployer.deployPostIntentHookMock(usdcToken.address, ramp.address);

    // Deploy orchestrator mock for testing orchestrator-only functions
    orchestratorMock = await deployer.deployOrchestratorMock(ramp.address);
  });

  describe("#constructor", async () => {
    it("should set the correct state variables", async () => {
      const ownerAddress: Address = await ramp.owner();
      const chainId: BigNumber = await ramp.chainId();
      const paymentVerifierRegistryAddress: Address = await ramp.paymentVerifierRegistry();
      const makerProtocolFee: BigNumber = await ramp.makerProtocolFee();
      const makerFeeRecipientAddress: Address = await ramp.makerFeeRecipient();
      const maxIntentsPerDeposit: BigNumber = await ramp.maxIntentsPerDeposit();
      const dustThreshold: BigNumber = await ramp.dustThreshold();
      const intentExpirationPeriod: BigNumber = await ramp.intentExpirationPeriod();

      expect(ownerAddress).to.eq(owner.address);
      expect(chainId).to.eq(chainId);
      expect(paymentVerifierRegistryAddress).to.eq(paymentVerifierRegistry.address);
      expect(makerProtocolFee).to.eq(ZERO);
      expect(makerFeeRecipientAddress).to.eq(protocolFeeRecipient.address);
      expect(maxIntentsPerDeposit).to.eq(BigNumber.from(3));
      expect(dustThreshold).to.eq(ZERO);
      expect(intentExpirationPeriod).to.eq(ONE_DAY_IN_SECONDS);
    });
  });

  describe("#createDeposit", async () => {
    let subjectToken: Address;
    let subjectAmount: BigNumber;
    let subjectIntentAmountRange: IEscrow.RangeStruct;
    let subjectVerifiers: Address[];
    let subjectVerificationData: IEscrow.DepositVerifierDataStruct[];
    let subjectCurrencies: IEscrow.CurrencyStruct[][];
    let subjectDelegate: Address;
    let subjectIntentGuardian: Address;

    beforeEach(async () => {
      subjectToken = usdcToken.address;
      subjectAmount = usdc(100);
      subjectIntentAmountRange = { min: usdc(10), max: usdc(200) }; // Example range
      subjectVerifiers = [verifier.address];
      subjectVerificationData = [
        {
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PaymentService1payeeDetails")),
          data: "0x"
        }
      ];
      subjectCurrencies = [
        [
          { code: Currency.USD, minConversionRate: ether(1.01) },
          { code: Currency.EUR, minConversionRate: ether(0.95) }
        ]
      ];
      subjectDelegate = offRamperDelegate.address;
      subjectIntentGuardian = ADDRESS_ZERO;
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
    });

    async function subject(): Promise<any> {
      return ramp.connect(offRamper.wallet).createDeposit({
        token: subjectToken,
        amount: subjectAmount,
        intentAmountRange: subjectIntentAmountRange,
        verifiers: subjectVerifiers,
        verifierData: subjectVerificationData,
        currencies: subjectCurrencies,
        delegate: subjectDelegate,
        intentGuardian: subjectIntentGuardian
      });
    }

    it("should transfer the tokens to the Ramp contract", async () => {
      await subject();

      const rampBalance = await usdcToken.balanceOf(ramp.address);
      const offRamperBalance = await usdcToken.balanceOf(offRamper.address);
      expect(rampBalance).to.eq(subjectAmount);
      expect(offRamperBalance).to.eq(usdc(9900));
    });

    it("should correctly update the deposits mapping", async () => {
      await subject();

      const depositView = await protocolViewer.getDeposit(0);

      expect(depositView.deposit.depositor).to.eq(offRamper.address);
      expect(depositView.deposit.token).to.eq(subjectToken);
      expect(depositView.deposit.amount).to.eq(subjectAmount);
      expect(depositView.deposit.intentAmountRange.min).to.eq(subjectIntentAmountRange.min);
      expect(depositView.deposit.intentAmountRange.max).to.eq(subjectIntentAmountRange.max);
      expect(depositView.deposit.acceptingIntents).to.be.true;
      expect(depositView.deposit.delegate).to.eq(subjectDelegate);

      expect(depositView.verifiers.length).to.eq(1);
      expect(depositView.verifiers[0].verifier).to.eq(subjectVerifiers[0]);
      expect(depositView.verifiers[0].verificationData.intentGatingService).to.eq(subjectVerificationData[0].intentGatingService);
      expect(depositView.verifiers[0].verificationData.payeeDetails).to.eq(subjectVerificationData[0].payeeDetails);
      expect(depositView.verifiers[0].verificationData.data).to.eq(subjectVerificationData[0].data);
      expect(depositView.verifiers[0].currencies.length).to.eq(2);
      expect(depositView.verifiers[0].currencies[0].code).to.eq(subjectCurrencies[0][0].code);
      expect(depositView.verifiers[0].currencies[0].minConversionRate).to.eq(subjectCurrencies[0][0].minConversionRate);
      expect(depositView.verifiers[0].currencies[1].code).to.eq(subjectCurrencies[0][1].code);
      expect(depositView.verifiers[0].currencies[1].minConversionRate).to.eq(subjectCurrencies[0][1].minConversionRate);
      expect(depositView.deposit.intentGuardian).to.eq(subjectIntentGuardian);
    });

    it("should add the deposit to the accountDeposits mapping", async () => {
      await subject();

      const accountDeposits = await ramp.getAccountDeposits(offRamper.address);
      expect(accountDeposits.length).to.eq(1);
      expect(accountDeposits[0]).to.eq(0);
    });

    it("should increment the deposit counter", async () => {
      const preDepositCounter = await ramp.depositCounter();

      await subject();

      const postDepositCounter = await ramp.depositCounter();
      expect(postDepositCounter).to.eq(preDepositCounter.add(1));
    });

    it("should correctly update the depositVerifierData mapping", async () => {
      await subject();

      const verificationData = await ramp.getDepositVerifierData(0, subjectVerifiers[0]);

      expect(verificationData.intentGatingService).to.eq(subjectVerificationData[0].intentGatingService);
      expect(verificationData.payeeDetails).to.eq(subjectVerificationData[0].payeeDetails);
      expect(verificationData.data).to.eq(subjectVerificationData[0].data);
    });

    it("should correctly update the depositCurrencyMinRate mapping", async () => {
      await subject();

      const currencyMinRate = await ramp.getDepositCurrencyMinRate(0, subjectVerifiers[0], subjectCurrencies[0][0].code);
      expect(currencyMinRate).to.eq(subjectCurrencies[0][0].minConversionRate);

      const currencyMinRate2 = await ramp.getDepositCurrencyMinRate(0, subjectVerifiers[0], subjectCurrencies[0][1].code);
      expect(currencyMinRate2).to.eq(subjectCurrencies[0][1].minConversionRate);
    });

    it("should emit a DepositReceived event", async () => {
      await expect(subject()).to.emit(ramp, "DepositReceived").withArgs(
        ZERO, // depositId starts at 0
        offRamper.address,
        subjectToken,
        subjectAmount,
        subjectIntentAmountRange,
        subjectDelegate,
        subjectIntentGuardian
      );
    });

    it("should emit a DepositVerifierAdded event", async () => {
      const payeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(["string"], [subjectVerificationData[0].payeeDetails]));
      await expect(subject()).to.emit(ramp, "DepositVerifierAdded").withArgs(
        ZERO, // depositId starts at 0
        subjectVerifiers[0],
        payeeDetailsHash,
        subjectVerificationData[0].intentGatingService
      );
    });

    it("should emit a DepositCurrencyAdded event", async () => {
      const tx = await subject();
      const receipt = await tx.wait();

      const events = receipt.events.filter((e: any) => e.event === "DepositCurrencyAdded");
      expect(events).to.have.length(2);

      // First event
      expect(events[0].args.depositId).to.equal(0);
      expect(events[0].args.verifier).to.equal(subjectVerifiers[0]);
      expect(events[0].args.currency).to.equal(subjectCurrencies[0][0].code);
      expect(events[0].args.conversionRate).to.equal(subjectCurrencies[0][0].minConversionRate);

      // Second event  
      expect(events[1].args.depositId).to.equal(0);
      expect(events[1].args.verifier).to.equal(subjectVerifiers[0]);
      expect(events[1].args.currency).to.equal(subjectCurrencies[0][1].code);
      expect(events[1].args.conversionRate).to.equal(subjectCurrencies[0][1].minConversionRate);
    });

    describe("when there are multiple verifiers", async () => {
      beforeEach(async () => {
        await paymentVerifierRegistry.addPaymentVerifier(otherVerifier.address);

        subjectVerifiers = [verifier.address, otherVerifier.address];
        subjectVerificationData = [
          {
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.formatBytes32String("test"),
            data: "0x"
          },
          {
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.formatBytes32String("test2"),
            data: "0x"
          }
        ];
        subjectCurrencies = [
          [
            { code: Currency.USD, minConversionRate: ether(1.01) },
            { code: Currency.EUR, minConversionRate: ether(0.92) }
          ],
          [
            { code: Currency.USD, minConversionRate: ether(1.02) }
          ]
        ];
      });

      it("should correctly update mappings for all verifiers", async () => {
        await subject();

        // Check first verifier
        const verificationData1 = await ramp.getDepositVerifierData(0, subjectVerifiers[0]);
        expect(verificationData1.intentGatingService).to.eq(subjectVerificationData[0].intentGatingService);
        expect(verificationData1.payeeDetails).to.eq(subjectVerificationData[0].payeeDetails);
        expect(verificationData1.data).to.eq(subjectVerificationData[0].data);

        const currencyRate1_1 = await ramp.getDepositCurrencyMinRate(0, subjectVerifiers[0], subjectCurrencies[0][0].code);
        expect(currencyRate1_1).to.eq(subjectCurrencies[0][0].minConversionRate);
        const currencyRate1_2 = await ramp.getDepositCurrencyMinRate(0, subjectVerifiers[0], subjectCurrencies[0][1].code);
        expect(currencyRate1_2).to.eq(subjectCurrencies[0][1].minConversionRate);

        // Check second verifier
        const verificationData2 = await ramp.getDepositVerifierData(0, subjectVerifiers[1]);
        expect(verificationData2.intentGatingService).to.eq(subjectVerificationData[1].intentGatingService);
        expect(verificationData2.payeeDetails).to.eq(subjectVerificationData[1].payeeDetails);
        expect(verificationData2.data).to.eq(subjectVerificationData[1].data);

        const currencyRate2_1 = await ramp.getDepositCurrencyMinRate(0, subjectVerifiers[1], subjectCurrencies[1][0].code);
        expect(currencyRate2_1).to.eq(subjectCurrencies[1][0].minConversionRate);
      });
    });

    describe("when the intent amount range min is zero", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroMinValue");
      });
    });

    describe("when the min intent amount is greater than max intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = usdc(2);
        subjectIntentAmountRange.max = usdc(1);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "InvalidRange");
      });
    });

    describe("when the amount is less than min intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = usdc(2);
        subjectAmount = usdc(1);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountBelowMin");
      });
    });

    describe("when the length of the verifiers array is not equal to the length of the verifiersData array", async () => {
      beforeEach(async () => {
        subjectVerifiers = [verifier.address, otherVerifier.address];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ArrayLengthMismatch");
      });
    });

    describe("when the length of the verifiers array is not equal to the length of the currencies array", async () => {
      beforeEach(async () => {
        subjectVerifiers = [verifier.address, otherVerifier.address];
        subjectVerificationData = [
          {
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.formatBytes32String("test"),
            data: "0x"
          },
          {
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.formatBytes32String("test"),
            data: "0x"
          }
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ArrayLengthMismatch");
      });
    });

    describe("when the accepted currencies is not supported by the verifier", async () => {
      beforeEach(async () => {
        subjectCurrencies[0][0].code = Currency.AED;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyNotSupported");
      });
    });

    describe("when the minConversionRate is zero", async () => {
      beforeEach(async () => {
        subjectCurrencies[0][0].minConversionRate = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroConversionRate");
      });
    });

    describe("when the verifier is zero address", async () => {
      beforeEach(async () => {
        subjectVerifiers = [ADDRESS_ZERO];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroAddress");
      });
    });

    describe("when the verifier is not whitelisted", async () => {
      beforeEach(async () => {
        subjectVerifiers = [otherVerifier.address];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierNotWhitelisted");
      });

      describe("when accept all verifiers is true", async () => {
        beforeEach(async () => {
          await otherVerifier.addCurrency(Currency.EUR);
          await paymentVerifierRegistry.connect(owner.wallet).setAcceptAllVerifiers(true);
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when payee details hash is empty", async () => {
      beforeEach(async () => {
        subjectVerificationData[0].payeeDetails = "";
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "EmptyPayeeDetails");
      });
    });

    describe("when there are duplicate verifiers", async () => {
      beforeEach(async () => {
        subjectVerifiers = [verifier.address, verifier.address];
        subjectVerificationData = [
          {
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.formatBytes32String("test"),
            data: "0x"
          },
          {
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.formatBytes32String("test"),
            data: "0x"
          }
        ];
        subjectCurrencies = [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }],
          [{ code: Currency.EUR, minConversionRate: ether(0.95) }]
        ]
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierAlreadyExists");
      });
    });

    describe("when there are duplicate currencies for a verifier", async () => {
      beforeEach(async () => {
        subjectVerifiers = [verifier.address];
        subjectVerificationData = [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.formatBytes32String("test"),
          data: "0x"
        }];
        subjectCurrencies = [
          [
            { code: Currency.USD, minConversionRate: ether(1.01) },
            { code: Currency.USD, minConversionRate: ether(1.02) }
          ]
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyAlreadyExists");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });

    describe("when maker fees are enabled", async () => {
      let makerFeeRate: BigNumber;

      beforeEach(async () => {
        // Set maker fee to 1%
        makerFeeRate = ether(0.01);
        await ramp.connect(owner.wallet).setMakerProtocolFee(makerFeeRate);
        await ramp.connect(owner.wallet).setMakerFeeRecipient(feeRecipient.address);
      });

      it("should calculate and reserve maker fees correctly", async () => {
        await subject();

        const deposit = await ramp.getDeposit(0);
        const expectedMakerFees = subjectAmount.mul(makerFeeRate).div(ether(1));
        const expectedNetAmount = subjectAmount.sub(expectedMakerFees);

        expect(deposit.reservedMakerFees).to.eq(expectedMakerFees);
        expect(deposit.accruedMakerFees).to.eq(0);
        expect(deposit.remainingDeposits).to.eq(expectedNetAmount);
        expect(deposit.amount).to.eq(subjectAmount);
      });

      it("should transfer the full gross amount from depositor", async () => {
        await subject();

        const rampBalance = await usdcToken.balanceOf(ramp.address);
        expect(rampBalance).to.eq(subjectAmount);
      });

      describe("when net amount after fees is below minimum intent amount", async () => {
        beforeEach(async () => {
          // Set high fee rate so net amount is below minimum
          makerFeeRate = ether(0.05); // 5% fee
          await ramp.connect(owner.wallet).setMakerProtocolFee(makerFeeRate);
          subjectAmount = usdc(100);
          subjectIntentAmountRange = { min: usdc(99), max: usdc(200) };
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountBelowMin");
        });
      });
    });
  });

  describe("#addFundsToDeposit", async () => {
    let subjectDepositId: BigNumber;
    let subjectAmount: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit to test adding funds
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectAmount = usdc(50);
      subjectCaller = offRamper;

      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).addFundsToDeposit(subjectDepositId, subjectAmount);
    }

    it("should transfer the tokens to the Ramp contract", async () => {
      const rampPreBalance = await usdcToken.balanceOf(ramp.address);
      const offRamperPreBalance = await usdcToken.balanceOf(offRamper.address);

      await subject();

      const rampPostBalance = await usdcToken.balanceOf(ramp.address);
      const offRamperPostBalance = await usdcToken.balanceOf(offRamper.address);

      expect(rampPostBalance).to.eq(rampPreBalance.add(subjectAmount));
      expect(offRamperPostBalance).to.eq(offRamperPreBalance.sub(subjectAmount));
    });

    it("should update the deposit amount correctly", async () => {
      const preDeposit = await ramp.getDeposit(subjectDepositId);

      await subject();

      const postDeposit = await ramp.getDeposit(subjectDepositId);
      expect(postDeposit.amount).to.eq(preDeposit.amount.add(subjectAmount));
      expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.add(subjectAmount));
    });

    it("should emit a DepositFundsAdded event", async () => {
      await expect(subject()).to.emit(ramp, "DepositFundsAdded").withArgs(
        subjectDepositId,
        offRamper.address,
        subjectAmount
      );
    });

    describe("when the deposit is not accepting intents", async () => {
      beforeEach(async () => {
        // Manually set deposit to not accept intents
        await ramp.connect(offRamper.wallet).setDepositAcceptingIntents(subjectDepositId, false);
      });

      it("should still allow adding funds", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);
        expect(preDeposit.acceptingIntents).to.be.false;

        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.amount).to.eq(preDeposit.amount.add(subjectAmount));
        expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.add(subjectAmount));
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
      });
    });

    describe("when the deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositNotFound");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });

    describe("when maker fees are enabled", async () => {
      let makerFeeRate: BigNumber;
      let initialDeposit: any;

      beforeEach(async () => {
        // Set maker fee to 1%
        makerFeeRate = ether(0.01);
        await ramp.connect(owner.wallet).setMakerProtocolFee(makerFeeRate);
        await ramp.connect(owner.wallet).setMakerFeeRecipient(feeRecipient.address);

        // Get initial deposit state
        initialDeposit = await ramp.getDeposit(subjectDepositId);
      });

      it("should calculate and add maker fees for additional amount", async () => {
        await subject();

        const deposit = await ramp.getDeposit(subjectDepositId);
        const expectedAdditionalFees = subjectAmount.mul(makerFeeRate).div(ether(1));
        const expectedNetAdditional = subjectAmount.sub(expectedAdditionalFees);

        expect(deposit.reservedMakerFees).to.eq(initialDeposit.reservedMakerFees.add(expectedAdditionalFees));
        expect(deposit.remainingDeposits).to.eq(initialDeposit.remainingDeposits.add(expectedNetAdditional));
        expect(deposit.amount).to.eq(initialDeposit.amount.add(subjectAmount));
      });

      it("should transfer the full additional amount from depositor", async () => {
        const rampPreBalance = await usdcToken.balanceOf(ramp.address);

        await subject();

        const rampPostBalance = await usdcToken.balanceOf(ramp.address);
        expect(rampPostBalance.sub(rampPreBalance)).to.eq(subjectAmount);
      });

      describe("when adding large amount with fees", async () => {
        beforeEach(async () => {
          subjectAmount = usdc(1000);
        });

        it("should handle large amounts correctly", async () => {
          await subject();

          const deposit = await ramp.getDeposit(subjectDepositId);
          const expectedAdditionalFees = subjectAmount.mul(makerFeeRate).div(ether(1));
          const expectedNetAdditional = subjectAmount.sub(expectedAdditionalFees);

          expect(deposit.reservedMakerFees).to.eq(initialDeposit.reservedMakerFees.add(expectedAdditionalFees));
          expect(deposit.remainingDeposits).to.eq(initialDeposit.remainingDeposits.add(expectedNetAdditional));
        });
      });
    });
  });

  describe("#removeFundsFromDeposit", async () => {
    let subjectDepositId: BigNumber;
    let subjectAmount: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit to test removing funds
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectAmount = usdc(30);
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).removeFundsFromDeposit(subjectDepositId, subjectAmount);
    }

    it("should transfer the tokens from the Ramp contract to the depositor", async () => {
      const rampPreBalance = await usdcToken.balanceOf(ramp.address);
      const offRamperPreBalance = await usdcToken.balanceOf(offRamper.address);

      await subject();

      const rampPostBalance = await usdcToken.balanceOf(ramp.address);
      const offRamperPostBalance = await usdcToken.balanceOf(offRamper.address);

      expect(rampPostBalance).to.eq(rampPreBalance.sub(subjectAmount));
      expect(offRamperPostBalance).to.eq(offRamperPreBalance.add(subjectAmount));
    });

    it("should update the deposit amount correctly", async () => {
      const preDeposit = await ramp.getDeposit(subjectDepositId);

      await subject();

      const postDeposit = await ramp.getDeposit(subjectDepositId);
      expect(postDeposit.amount).to.eq(preDeposit.amount.sub(subjectAmount));
      expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.sub(subjectAmount));
    });

    it("should emit a DepositWithdrawn event", async () => {
      await expect(subject()).to.emit(ramp, "DepositWithdrawn").withArgs(
        subjectDepositId,
        offRamper.address,
        subjectAmount,
        true    // still accepting intents
      );
    });

    describe("when the deposit is not accepting intents", async () => {
      beforeEach(async () => {
        // Manually set deposit to not accept intents
        await ramp.connect(offRamper.wallet).setDepositAcceptingIntents(subjectDepositId, false);

        subjectAmount = usdc(20);
      });

      it("should still allow removing funds", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);
        expect(preDeposit.acceptingIntents).to.be.false;

        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.amount).to.eq(preDeposit.amount.sub(subjectAmount));
        expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.sub(subjectAmount));
      });
    });

    describe("when removing funds causes remainingDeposits to go below min intent amount", async () => {
      beforeEach(async () => {
        // Remove funds to leave only 5 USDC (below min of 10)
        subjectAmount = usdc(95);
      });

      it("should auto-disable accepting intents", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);
        expect(preDeposit.acceptingIntents).to.be.true;

        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.remainingDeposits).to.eq(usdc(5)); // Below min of 10
        expect(postDeposit.acceptingIntents).to.be.false;
      });

      it("should emit DepositWithdrawn event", async () => {
        await expect(subject()).to.emit(ramp, "DepositWithdrawn").withArgs(
          subjectDepositId,
          offRamper.address,
          subjectAmount,
          false
        );
      });
    });

    describe("when removing all remaining funds", async () => {
      beforeEach(async () => {
        subjectAmount = usdc(100);
      });

      it("should NOT close the deposit", async () => {
        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.depositor).to.eq(offRamper.address);
      });
    });

    describe("when there are expired intents", async () => {

      let intentHash: string;

      beforeEach(async () => {
        // Signal an intent
        const intentAmount = usdc(50);
        const conversionRate = ether(1.1);

        const signalIntentParams = await createSignalIntentParams(
          ramp.address,
          subjectDepositId,
          intentAmount,
          onRamper.address,
          verifier.address,
          Currency.USD,
          conversionRate,
          ADDRESS_ZERO,
          ZERO,
          gatingService,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );

        await orchestrator.connect(onRamper.wallet).signalIntent(signalIntentParams);
        const currentTimestamp = await blockchain.getCurrentTimestamp();
        intentHash = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter
        );
        currentIntentCounter++;  // Increment after signalIntent

        // Fast forward time to expire the intent
        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());

        // Try to remove more than remaining deposits but less than remaining + expired intent
        subjectAmount = usdc(70);
      });

      it("should prune expired intents and allow removal", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);
        expect(preDeposit.remainingDeposits).to.eq(usdc(50)); // 100 - 50 (intent)

        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        // Should have pruned the intent and removed the requested amount
        expect(postDeposit.remainingDeposits).to.eq(usdc(30)); // 100 - 70
        expect(postDeposit.outstandingIntentAmount).to.eq(ZERO); // Intent was pruned
      });

      it("should emit DepositWithdrawn event", async () => {
        await expect(subject()).to.emit(ramp, "DepositWithdrawn").withArgs(
          subjectDepositId,
          offRamper.address,
          subjectAmount,
          true    // still accepting intents
        );
      });
    });

    describe("when the requested amount exceeds available liquidity", async () => {
      beforeEach(async () => {
        // Signal an intent that won't expire
        const intentAmount = usdc(60);
        const conversionRate = ether(1.1);
        const signalIntentParams = await createSignalIntentParams(
          ramp.address,
          subjectDepositId,
          intentAmount,
          onRamper.address,
          verifier.address,
          Currency.USD,
          conversionRate,
          ADDRESS_ZERO,
          ZERO,
          gatingService,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );

        await orchestrator.connect(onRamper.wallet).signalIntent(signalIntentParams);

        // Try to remove more than available (40 remaining, trying to remove 50)
        subjectAmount = usdc(50);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "InsufficientDepositLiquidity");
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
      });
    });

    describe("when the deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositNotFound");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#withdrawDeposit", async () => {
    let subjectDepositId: BigNumber;
    let subjectCaller: Account;

    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Create deposit to test withdrawal
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      depositConversionRate = ether(1.08);
      await ramp.connect(offRamper.wallet).createDeposit({
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
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).withdrawDeposit(subjectDepositId);
    }

    it("should transfer the correct amount of usdc to the caller", async () => {
      const offRamperPreBalance = await usdcToken.balanceOf(offRamper.address);
      const rampPreBalance = await usdcToken.balanceOf(ramp.address);

      await subject();

      const offRamperPostBalance = await usdcToken.balanceOf(offRamper.address);
      const rampPostBalance = await usdcToken.balanceOf(ramp.address);

      expect(offRamperPostBalance).to.eq(offRamperPreBalance.add(usdc(100)));
      expect(rampPostBalance).to.eq(rampPreBalance.sub(usdc(100)));
    });

    it("should delete the deposit", async () => {
      const preDeposit = await ramp.getDeposit(subjectDepositId);
      expect(preDeposit.depositor).to.not.eq(ADDRESS_ZERO);

      await subject();

      const postDeposit = await ramp.getDeposit(subjectDepositId);
      expect(postDeposit.depositor).to.eq(ADDRESS_ZERO);
    });

    it("should remove the deposit from the user deposits mapping", async () => {
      const preUserDeposits = await protocolViewer.getAccountDeposits(offRamper.address);
      expect(preUserDeposits.some(deposit => deposit.depositId.eq(subjectDepositId))).to.be.true;

      await subject();

      const postUserDeposits = await ramp.getAccountDeposits(offRamper.address);
      expect(postUserDeposits.some(depositId => depositId.eq(subjectDepositId))).to.be.false;
    });

    it("should remove the deposit verifier data", async () => {
      const preVerifierData = await ramp.getDepositVerifierData(subjectDepositId, verifier.address);
      expect(preVerifierData.intentGatingService).to.not.eq(ADDRESS_ZERO);

      await subject();

      const postVerifierData = await ramp.getDepositVerifierData(subjectDepositId, verifier.address);
      expect(postVerifierData.intentGatingService).to.eq(ADDRESS_ZERO);
    });

    it("should delete deposit currency min conversion data", async () => {
      const preCurrencyMinRate = await ramp.getDepositCurrencyMinRate(subjectDepositId, verifier.address, Currency.USD);
      expect(preCurrencyMinRate).to.not.eq(ZERO);

      await subject();

      const postCurrencyMinRate = await ramp.getDepositCurrencyMinRate(subjectDepositId, verifier.address, Currency.USD);
      expect(postCurrencyMinRate).to.eq(ZERO);
    });

    it("should emit a DepositWithdrawn event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "DepositWithdrawn").withArgs(
        subjectDepositId,
        offRamper.address,
        usdc(100),
        false
      );
    });

    it("should emit DepositClosed event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "DepositClosed").withArgs(subjectDepositId, offRamper.address);
    });

    describe("when there is an outstanding intent", async () => {
      let intentHash: string;

      beforeEach(async () => {
        const gatingServiceSignature = await generateGatingServiceSignature(
          gatingService,
          ramp.address,
          subjectDepositId,
          usdc(50),
          receiver.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          chainId.toString()
        );

        const params = await createSignalIntentParams(
          ramp.address,
          subjectDepositId,
          usdc(50),
          receiver.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          ADDRESS_ZERO,
          ZERO,
          null,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );
        params.gatingServiceSignature = gatingServiceSignature;
        await orchestrator.connect(onRamper.wallet).signalIntent(params);

        // Calculate the intent hash
        const currentTimestamp = await blockchain.getCurrentTimestamp();
        intentHash = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter
        );
        currentIntentCounter++;  // Increment after signalIntent
      });

      it("should transfer the correct amount of usdc to the caller", async () => {
        const offRamperPreBalance = await usdcToken.balanceOf(offRamper.address);
        const rampPreBalance = await usdcToken.balanceOf(ramp.address);

        await subject();

        const offRamperPostBalance = await usdcToken.balanceOf(offRamper.address);
        const rampPostBalance = await usdcToken.balanceOf(ramp.address);

        expect(offRamperPostBalance).to.eq(offRamperPreBalance.add(usdc(50)));
        expect(rampPostBalance).to.eq(rampPreBalance.sub(usdc(50)));
      });

      it("should zero out remainingDeposits", async () => {
        await subject();

        const deposit = await ramp.getDeposit(subjectDepositId);

        expect(deposit.depositor).to.not.eq(ADDRESS_ZERO);
        expect(deposit.remainingDeposits).to.eq(ZERO);
        expect(deposit.outstandingIntentAmount).to.eq(usdc(50));
      });

      it("should set the deposit to not accepting intents", async () => {
        await subject();

        const deposit = await ramp.getDeposit(subjectDepositId);
        expect(deposit.acceptingIntents).to.be.false;
      });

      it("should emit DepositWithdrawn event", async () => {
        const tx = await subject();

        expect(tx).to.emit(ramp, "DepositWithdrawn").withArgs(
          subjectDepositId,
          offRamper.address,
          usdc(50),
          false
        );
      });

      describe("but the intent is expired", async () => {
        beforeEach(async () => {
          await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());
        });

        it("should transfer the correct amount of usdc to the caller", async () => {
          const offRamperPreBalance = await usdcToken.balanceOf(offRamper.address);
          const rampPreBalance = await usdcToken.balanceOf(ramp.address);

          await subject();

          const offRamperPostBalance = await usdcToken.balanceOf(offRamper.address);
          const rampPostBalance = await usdcToken.balanceOf(ramp.address);

          expect(offRamperPostBalance).to.eq(offRamperPreBalance.add(usdc(100)));
          expect(rampPostBalance).to.eq(rampPreBalance.sub(usdc(100)));
        });

        it("should delete the deposit", async () => {
          await subject();

          const deposit = await ramp.getDeposit(subjectDepositId);
          expect(deposit.depositor).to.eq(ADDRESS_ZERO);
        });

        it("should delete the intent", async () => {
          const preIntent = await ramp.getDepositIntent(subjectDepositId, intentHash);
          expect(preIntent.amount).to.eq(usdc(50));

          await subject();

          const postIntent = await ramp.getDepositIntent(subjectDepositId, intentHash);

          expect(postIntent.amount).to.eq(ZERO);
        });

        it("should emit DepositWithdrawn event", async () => {
          const tx = await subject();

          expect(tx).to.emit(ramp, "DepositWithdrawn").withArgs(
            subjectDepositId,
            offRamper.address,
            usdc(100),
            false
          );
        });

        it("should emit DepositClosed event", async () => {
          const tx = await subject();

          expect(tx).to.emit(ramp, "DepositClosed").withArgs(subjectDepositId, offRamper.address);
        });
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
      });

      describe("when the caller is delegate", async () => {
        beforeEach(async () => {
          subjectCaller = offRamperDelegate;
        });

        it("should still revert", async () => {
          await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
        });
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should NOT revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });
    });

    describe("when maker fees are enabled", async () => {
      let makerFeeRate: BigNumber;
      let grossDepositAmount: BigNumber;
      let reservedFees: BigNumber;
      let netDepositAmount: BigNumber;

      beforeEach(async () => {
        // Set maker fee to 1%
        makerFeeRate = ether(0.01);
        await ramp.connect(owner.wallet).setMakerProtocolFee(makerFeeRate);
        await ramp.connect(owner.wallet).setMakerFeeRecipient(feeRecipient.address);

        // Create deposit with fees
        grossDepositAmount = usdc(100);
        reservedFees = grossDepositAmount.mul(makerFeeRate).div(ether(1));
        netDepositAmount = grossDepositAmount.sub(reservedFees);

        await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
        await ramp.connect(offRamper.wallet).createDeposit({
          token: usdcToken.address,
          amount: grossDepositAmount,
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
          delegate: offRamperDelegate.address,
          intentGuardian: ADDRESS_ZERO
        });

        subjectDepositId = BigNumber.from(1); // New deposit created
      });

      it("should return full amount including unused fees", async () => {
        const preBalance = await usdcToken.balanceOf(offRamper.address);
        const preRampBalance = await usdcToken.balanceOf(ramp.address);
        const preFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        await subject();

        const postBalance = await usdcToken.balanceOf(offRamper.address);
        const postRampBalance = await usdcToken.balanceOf(ramp.address);
        const postFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        // Depositor gets back full gross amount (including unused fees)
        expect(postBalance).to.eq(preBalance.add(grossDepositAmount));
        expect(postRampBalance).to.eq(preRampBalance.sub(grossDepositAmount));
        // No fees collected since no intents were fulfilled
        expect(postFeeRecipientBalance).to.eq(preFeeRecipientBalance);
      });

      it("should emit DepositClosed event", async () => {
        await expect(subject()).to.emit(ramp, "DepositClosed").withArgs(
          subjectDepositId,
          offRamper.address
        );
      });

      describe("when some fees have been accrued", async () => {
        let intentHash: string;
        let intentAmount: BigNumber;
        let paymentAmount: BigNumber;

        beforeEach(async () => {
          // Signal and fulfill an intent to accrue some fees
          intentAmount = usdc(50);
          paymentAmount = intentAmount.mul(ether(1.1));  // pay the full amount
          const conversionRate = ether(1.1);

          const signalIntentParams = await createSignalIntentParams(
            ramp.address,
            subjectDepositId,
            intentAmount,
            onRamper.address,
            verifier.address,
            Currency.USD,
            conversionRate,
            ADDRESS_ZERO,
            ZERO,
            gatingService,
            chainId.toString(),
            ADDRESS_ZERO,
            "0x"
          );

          await orchestrator.connect(onRamper.wallet).signalIntent(signalIntentParams);

          const currentTimestamp = await blockchain.getCurrentTimestamp();
          intentHash = calculateIntentHash(
            orchestrator.address,
            currentIntentCounter
          );
          currentIntentCounter++;  // Increment after signalIntent

          // Fulfill the intent - this will accrue fees
          const paymentData = ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256", "string", "bytes32", "bytes32"],
            [paymentAmount, currentTimestamp, "payeeDetails", Currency.USD, intentHash]
          );
          const fulfillParams = {
            paymentProof: paymentData,
            intentHash: intentHash,
            verificationData: "0x",
            postIntentHookData: "0x"
          };

          await orchestrator.connect(witness.wallet).fulfillIntent(fulfillParams);
        });

        it("should return remaining deposits plus unused fees", async () => {
          const preDepositorBalance = await usdcToken.balanceOf(offRamper.address);
          const preFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

          await subject();

          const postDepositorBalance = await usdcToken.balanceOf(offRamper.address);
          const postFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

          // Depositor gets: remaining deposits (49 USDC) + unused fees (1 - 0.5 = 0.5 USDC)
          let accruedFees = intentAmount.mul(makerFeeRate).div(ether(1));
          const expectedReturn = netDepositAmount.sub(intentAmount).add(reservedFees.sub(accruedFees));
          expect(postDepositorBalance).to.eq(preDepositorBalance.add(expectedReturn));

          // Fee recipient gets the accrued fees (0.5 USDC)
          expect(postFeeRecipientBalance).to.eq(preFeeRecipientBalance.add(accruedFees));
        });

        it("should emit MakerFeesCollected event", async () => {
          let accruedFees = intentAmount.mul(makerFeeRate).div(ether(1));
          await expect(subject()).to.emit(ramp, "MakerFeesCollected").withArgs(
            subjectDepositId,
            accruedFees,
            feeRecipient.address
          );
        });
      });

      describe("when all fees and dust have been collected", async () => {
        let fulfillParams: any;
        let intentAmount: BigNumber;

        beforeEach(async () => {
          // Set dust threshold
          // Signal intent for 99 USDC, reserved fees were 100 * 0.01 = 1 USDC
          // accrued fees after intent fulfillment are 99 * 0.01 = 0.99 USDC
          // dust threshold is 0.01 USDC
          // remaining deposits (non reserved fees) are 99 - 99 = 0 USDC
          // total remaining is 0 + (1 - 0.99) (reserved fees - accrued fees) = 0.01 USDC

          // Set dust threshold
          const dustThreshold = usdc(0.01);
          await ramp.connect(owner.wallet).setDustThreshold(dustThreshold);

          // Fulfill intent for full net deposit amount to accrue all fees
          intentAmount = netDepositAmount;
          const paymentAmount = intentAmount.mul(ether(1.1));  // pay the full amount
          const conversionRate = ether(1.1);

          const signalIntentParams = await createSignalIntentParams(
            ramp.address,
            subjectDepositId,
            intentAmount,
            onRamper.address,
            verifier.address,
            Currency.USD,
            conversionRate,
            ADDRESS_ZERO,
            ZERO,
            gatingService,
            chainId.toString(),
            ADDRESS_ZERO,
            "0x"
          );

          await orchestrator.connect(onRamper.wallet).signalIntent(signalIntentParams);

          const currentTimestamp = await blockchain.getCurrentTimestamp();
          const intentHash = calculateIntentHash(
            orchestrator.address,
            currentIntentCounter
          );
          currentIntentCounter++;  // Increment after signalIntent

          // Fulfill the intent
          const paymentData = ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256", "string", "bytes32", "bytes32"],
            [paymentAmount, currentTimestamp, "payeeDetails", Currency.USD, intentHash]
          );
          fulfillParams = {
            paymentProof: paymentData,
            intentHash: intentHash,
            verificationData: "0x",
            postIntentHookData: "0x"
          };
        });

        it("should only transfer accrued fees to fee recipient", async () => {
          const preDepositorBalance = await usdcToken.balanceOf(offRamper.address);
          const preFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

          // Fulfill the intent; close the deposit automatically; collect fees
          await orchestrator.connect(witness.wallet).fulfillIntent(fulfillParams);

          const postDepositorBalance = await usdcToken.balanceOf(offRamper.address);
          const postFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

          // Depositor gets nothing (all net deposits were fulfilled)
          expect(postDepositorBalance).to.eq(preDepositorBalance);

          // Fee recipient gets all reserved fees
          const feesCollected = intentAmount.mul(makerFeeRate).div(ether(1));
          const dustCollected = usdc(0.01);
          expect(postFeeRecipientBalance).to.eq(preFeeRecipientBalance.add(feesCollected).add(dustCollected));
        });

        it("should emit MakerFeesCollected event", async () => {
          const feesCollected = intentAmount.mul(makerFeeRate).div(ether(1));
          await expect(orchestrator.connect(witness.wallet).fulfillIntent(fulfillParams)).to.emit(
            ramp, "MakerFeesCollected"
          ).withArgs(
            subjectDepositId,
            feesCollected,
            feeRecipient.address
          );
        });

        it("should emit DustCollected event", async () => {
          const dustCollected = usdc(0.01);
          await expect(orchestrator.connect(witness.wallet).fulfillIntent(fulfillParams)).to.emit(
            ramp, "DustCollected"
          ).withArgs(
            subjectDepositId,
            dustCollected,
            feeRecipient.address
          );
        });
      });
    });
  });

  describe("#updateDepositMinConversionRate", async () => {
    let subjectDepositId: BigNumber;
    let subjectVerifier: Address;
    let subjectFiatCurrency: string;
    let subjectNewMinConversionRate: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectVerifier = verifier.address;
      subjectFiatCurrency = Currency.USD;
      subjectNewMinConversionRate = ether(1.05);
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).updateDepositMinConversionRate(
        subjectDepositId,
        subjectVerifier,
        subjectFiatCurrency,
        subjectNewMinConversionRate
      );
    }

    it("should update the min conversion rate", async () => {
      await subject();

      const newRate = await ramp.getDepositCurrencyMinRate(
        subjectDepositId,
        subjectVerifier,
        subjectFiatCurrency
      );
      expect(newRate).to.eq(subjectNewMinConversionRate);
    });

    it("should emit a DepositMinConversionRateUpdated event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "DepositMinConversionRateUpdated").withArgs(
        subjectDepositId,
        subjectVerifier,
        subjectFiatCurrency,
        subjectNewMinConversionRate
      );
    });

    describe("when the caller is delegate", async () => {
      beforeEach(async () => {
        subjectCaller = offRamperDelegate;
      });

      it("should not revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCallerOrDelegate");
      });
    });

    describe("when the currency or verifier is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.EUR;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyNotSupported");
      });
    });

    describe("when the new min conversion rate is zero", async () => {
      beforeEach(async () => {
        subjectNewMinConversionRate = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroConversionRate");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#updateDepositIntentAmountRange", async () => {
    let subjectDepositId: BigNumber;
    let subjectIntentAmountRange: IEscrow.RangeStruct;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectIntentAmountRange = { min: usdc(5), max: usdc(150) };
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).updateDepositIntentAmountRange(
        subjectDepositId,
        subjectIntentAmountRange
      );
    }

    it("should update the intent amount range", async () => {
      await subject();

      const deposit = await ramp.getDeposit(subjectDepositId);
      expect(deposit.intentAmountRange.min).to.eq(subjectIntentAmountRange.min);
      expect(deposit.intentAmountRange.max).to.eq(subjectIntentAmountRange.max);
    });

    it("should emit a DepositIntentAmountRangeUpdated event", async () => {
      await expect(subject()).to.emit(ramp, "DepositIntentAmountRangeUpdated").withArgs(
        subjectDepositId,
        subjectIntentAmountRange
      );
    });

    describe("when the caller is delegate", async () => {
      beforeEach(async () => {
        subjectCaller = offRamperDelegate;
      });

      it("should not revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCallerOrDelegate");
      });
    });

    describe("when the min amount is zero", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroMinValue");
      });
    });

    describe("when the min amount is greater than max amount", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange = { min: usdc(200), max: usdc(100) };
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "InvalidRange");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#addVerifiersToDeposit", async () => {
    let subjectDepositId: BigNumber;
    let subjectVerifiers: Address[];
    let subjectVerifierData: IEscrow.DepositVerifierDataStruct[];
    let subjectCurrencies: IEscrow.CurrencyStruct[][];
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit first with only one verifier
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      // Add otherVerifier to whitelist
      await paymentVerifierRegistry.connect(owner.wallet).addPaymentVerifier(otherVerifier.address);
      await otherVerifier.addCurrency(Currency.EUR);

      subjectDepositId = ZERO;
      subjectVerifiers = [otherVerifier.address];
      subjectVerifierData = [{
        intentGatingService: gatingService.address,
        payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("otherPayeeDetails")),
        data: "0x"
      }];
      subjectCurrencies = [
        [
          { code: Currency.USD, minConversionRate: ether(1.02) },
          { code: Currency.EUR, minConversionRate: ether(0.95) }
        ]
      ];
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).addVerifiersToDeposit(
        subjectDepositId,
        subjectVerifiers,
        subjectVerifierData,
        subjectCurrencies
      );
    }

    it("should add the verifier to the deposit", async () => {
      await subject();

      const verifiers = await ramp.getDepositVerifiers(subjectDepositId);
      expect(verifiers).to.include(otherVerifier.address);

      const verifierData = await ramp.getDepositVerifierData(subjectDepositId, otherVerifier.address);
      expect(verifierData.intentGatingService).to.eq(subjectVerifierData[0].intentGatingService);
      expect(verifierData.payeeDetails).to.eq(subjectVerifierData[0].payeeDetails);
      expect(verifierData.data).to.eq(subjectVerifierData[0].data);
    });

    it("should add the currencies to the verifier", async () => {
      await subject();

      const currencies = await ramp.getDepositCurrencies(subjectDepositId, otherVerifier.address);
      expect(currencies).to.have.length(2);
      expect(currencies).to.include(Currency.USD);
      expect(currencies).to.include(Currency.EUR);

      const usdRate = await ramp.getDepositCurrencyMinRate(subjectDepositId, otherVerifier.address, Currency.USD);
      expect(usdRate).to.eq(subjectCurrencies[0][0].minConversionRate);

      const eurRate = await ramp.getDepositCurrencyMinRate(subjectDepositId, otherVerifier.address, Currency.EUR);
      expect(eurRate).to.eq(subjectCurrencies[0][1].minConversionRate);
    });

    it("should emit DepositVerifierAdded and DepositCurrencyAdded events", async () => {
      const tx = await subject();

      const payeeDetailsHash = ethers.utils.keccak256(ethers.utils.solidityPack(["string"], [subjectVerifierData[0].payeeDetails]));
      await expect(tx).to.emit(ramp, "DepositVerifierAdded").withArgs(
        subjectDepositId,
        otherVerifier.address,
        payeeDetailsHash,
        subjectVerifierData[0].intentGatingService
      );

      const receipt = await tx.wait();
      const currencyEvents = receipt.events.filter((e: any) => e.event === "DepositCurrencyAdded");
      expect(currencyEvents).to.have.length(2);
    });

    describe("when the caller is delegate", async () => {
      beforeEach(async () => {
        subjectCaller = offRamperDelegate;
      });

      it("should not revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCallerOrDelegate");
      });
    });

    describe("when the verifier is not whitelisted", async () => {
      beforeEach(async () => {
        const newVerifier = await deployer.deployPaymentVerifierMock(
          ramp.address,
          ethers.constants.AddressZero,
          ZERO,
          [Currency.USD]
        );
        subjectVerifiers = [newVerifier.address];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierNotWhitelisted");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#removeVerifierFromDeposit", async () => {
    let subjectDepositId: BigNumber;
    let subjectVerifier: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit with multiple verifiers
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await paymentVerifierRegistry.connect(owner.wallet).addPaymentVerifier(otherVerifier.address);

      await ramp.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address, otherVerifier.address],
        verifierData: [
          {
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
            data: "0x"
          },
          {
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("otherPayeeDetails")),
            data: "0x"
          }
        ],
        currencies: [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }],
          [{ code: Currency.USD, minConversionRate: ether(1.02) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectVerifier = otherVerifier.address;
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).removeVerifierFromDeposit(
        subjectDepositId,
        subjectVerifier
      );
    }

    it("should remove the verifier from the deposit", async () => {
      await subject();

      const verifiers = await ramp.getDepositVerifiers(subjectDepositId);
      expect(verifiers).to.not.include(subjectVerifier);

    });

    it("should NOT delete the verifier data", async () => {
      await subject();

      const verifierData = await ramp.getDepositVerifierData(subjectDepositId, subjectVerifier);
      expect(verifierData.intentGatingService).to.eq(gatingService.address);
      expect(verifierData.payeeDetails).to.eq(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("otherPayeeDetails")));
      expect(verifierData.data).to.eq("0x");
    });

    it("should remove the currency data for the verifier", async () => {
      await subject();

      const currencies = await ramp.getDepositCurrencies(subjectDepositId, subjectVerifier);
      expect(currencies).to.have.length(0);

      const minConversionRate = await ramp.getDepositCurrencyMinRate(subjectDepositId, subjectVerifier, Currency.USD);
      expect(minConversionRate).to.eq(ZERO);
    });

    it("should emit a DepositVerifierRemoved event", async () => {
      await expect(subject()).to.emit(ramp, "DepositVerifierRemoved").withArgs(
        subjectDepositId,
        subjectVerifier
      );
    });

    describe("when the caller is delegate", async () => {
      beforeEach(async () => {
        subjectCaller = offRamperDelegate;
      });

      it("should not revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCallerOrDelegate");
      });
    });

    describe("when the verifier is not found for the deposit", async () => {
      beforeEach(async () => {
        const newVerifier = await deployer.deployPaymentVerifierMock(
          ramp.address,
          ethers.constants.AddressZero,
          ZERO,
          [Currency.USD]
        );
        subjectVerifier = newVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierNotFound");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#addCurrenciesToDepositVerifier", async () => {
    let subjectDepositId: BigNumber;
    let subjectVerifier: Address;
    let subjectCurrencies: IEscrow.CurrencyStruct[];
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectVerifier = verifier.address;
      subjectCurrencies = [
        { code: Currency.EUR, minConversionRate: ether(0.95) }
      ];
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).addCurrenciesToDepositVerifier(
        subjectDepositId,
        subjectVerifier,
        subjectCurrencies
      );
    }

    it("should add the currencies to the verifier", async () => {
      await subject();

      const currencies = await ramp.getDepositCurrencies(subjectDepositId, subjectVerifier);
      expect(currencies).to.include(Currency.EUR);

      const minConversionRate = await ramp.getDepositCurrencyMinRate(subjectDepositId, subjectVerifier, Currency.EUR);
      expect(minConversionRate).to.eq(subjectCurrencies[0].minConversionRate);
    });

    it("should emit a DepositCurrencyAdded event", async () => {
      await expect(subject()).to.emit(ramp, "DepositCurrencyAdded").withArgs(
        subjectDepositId,
        subjectVerifier,
        Currency.EUR,
        subjectCurrencies[0].minConversionRate
      );
    });

    describe("when the caller is delegate", async () => {
      beforeEach(async () => {
        subjectCaller = offRamperDelegate;
      });

      it("should not revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCallerOrDelegate");
      });
    });

    describe("when the verifier is not found for the deposit", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierNotFound");
      });
    });

    describe("when the currency is not supported by the verifier", async () => {
      beforeEach(async () => {
        subjectCurrencies = [
          { code: Currency.AED, minConversionRate: ether(3.67) }
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyNotSupported");
      });
    });

    describe("when the minConversionRate is zero", async () => {
      beforeEach(async () => {
        subjectCurrencies[0].minConversionRate = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroConversionRate");
      });
    });

    describe("when the currency already exists", async () => {
      beforeEach(async () => {
        subjectCurrencies = [
          { code: Currency.USD, minConversionRate: ether(1.05) }
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyAlreadyExists");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#removeCurrencyFromDepositVerifier", async () => {
    let subjectDepositId: BigNumber;
    let subjectVerifier: Address;
    let subjectCurrencyCode: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit with multiple currencies
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
          [
            { code: Currency.USD, minConversionRate: ether(1.01) },
            { code: Currency.EUR, minConversionRate: ether(0.95) }
          ]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectVerifier = verifier.address;
      subjectCurrencyCode = Currency.EUR;
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).removeCurrencyFromDepositVerifier(
        subjectDepositId,
        subjectVerifier,
        subjectCurrencyCode
      );
    }

    it("should remove the currency from the verifier", async () => {
      await subject();

      const currencies = await ramp.getDepositCurrencies(subjectDepositId, subjectVerifier);
      expect(currencies).to.not.include(subjectCurrencyCode);

      const minConversionRate = await ramp.getDepositCurrencyMinRate(subjectDepositId, subjectVerifier, subjectCurrencyCode);
      expect(minConversionRate).to.eq(ZERO);
    });

    it("should emit a DepositCurrencyRemoved event", async () => {
      await expect(subject()).to.emit(ramp, "DepositCurrencyRemoved").withArgs(
        subjectDepositId,
        subjectVerifier,
        subjectCurrencyCode
      );
    });

    describe("when the caller is delegate", async () => {
      beforeEach(async () => {
        subjectCaller = offRamperDelegate;
      });

      it("should not revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCallerOrDelegate");
      });
    });

    describe("when the verifier is not found for the deposit", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierNotFound");
      });
    });

    describe("when the currency is not found for the verifier", async () => {
      beforeEach(async () => {
        subjectCurrencyCode = Currency.AED;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyNotFound");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#setDepositDelegate", async () => {
    let subjectDepositId: BigNumber;
    let subjectDelegate: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: ADDRESS_ZERO,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectDelegate = offRamperDelegate.address;
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setDepositDelegate(
        subjectDepositId,
        subjectDelegate
      );
    }

    it("should set the delegate for the deposit", async () => {
      await subject();

      const deposit = await ramp.getDeposit(subjectDepositId);
      expect(deposit.delegate).to.eq(subjectDelegate);
    });

    it("should emit a DepositDelegateSet event", async () => {
      await expect(subject()).to.emit(ramp, "DepositDelegateSet").withArgs(
        subjectDepositId,
        subjectCaller.address,
        subjectDelegate
      );
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
      });

      describe("when the caller is delegate", async () => {
        beforeEach(async () => {
          subjectCaller = offRamperDelegate;
        });

        it("should still revert", async () => {
          await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
        });
      });
    });

    describe("when the delegate is zero address", async () => {
      beforeEach(async () => {
        subjectDelegate = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroAddress");
      });
    });

    describe("when updating an existing delegate", async () => {
      beforeEach(async () => {
        // First set a delegate
        await ramp.connect(offRamper.wallet).setDepositDelegate(subjectDepositId, offRamperDelegate.address);
        // Then change to a different delegate
        subjectDelegate = receiver.address;
      });

      it("should update the delegate", async () => {
        await subject();

        const deposit = await ramp.getDeposit(subjectDepositId);
        expect(deposit.delegate).to.eq(subjectDelegate);
      });

      it("should emit a DepositDelegateSet event", async () => {
        await expect(subject()).to.emit(ramp, "DepositDelegateSet").withArgs(
          subjectDepositId,
          subjectCaller.address,
          subjectDelegate
        );
      });
    });
  });

  describe("#removeDepositDelegate", async () => {
    let subjectDepositId: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit with delegate
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).removeDepositDelegate(subjectDepositId);
    }

    it("should remove the delegate from the deposit", async () => {
      await subject();

      const deposit = await ramp.getDeposit(subjectDepositId);
      expect(deposit.delegate).to.eq(ethers.constants.AddressZero);
    });

    it("should emit a DepositDelegateRemoved event", async () => {
      await expect(subject()).to.emit(ramp, "DepositDelegateRemoved").withArgs(
        subjectDepositId,
        subjectCaller.address
      );
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
      });

      describe("when the caller is delegate", async () => {
        beforeEach(async () => {
          subjectCaller = offRamperDelegate;
        });

        it("should still revert", async () => {
          await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
        });
      });
    });

    describe("when no delegate is set", async () => {
      beforeEach(async () => {
        // First remove the delegate, then try to remove again
        await ramp.connect(offRamper.wallet).removeDepositDelegate(subjectDepositId);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DelegateNotFound");
      });
    });
  });

  describe("#setDepositAcceptingIntents", async () => {
    let subjectDepositId: BigNumber;
    let subjectAcceptingIntents: boolean;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
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
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      subjectDepositId = ZERO;
      subjectAcceptingIntents = false; // Default to setting to false
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setDepositAcceptingIntents(
        subjectDepositId,
        subjectAcceptingIntents
      );
    }

    it("should update the accepting intents state", async () => {
      const preDeposit = await ramp.getDeposit(subjectDepositId);
      expect(preDeposit.acceptingIntents).to.be.true;

      await subject();

      const postDeposit = await ramp.getDeposit(subjectDepositId);
      expect(postDeposit.acceptingIntents).to.eq(subjectAcceptingIntents);
    });

    it("should emit a DepositAcceptingIntentsUpdated event", async () => {
      await expect(subject()).to.emit(ramp, "DepositAcceptingIntentsUpdated").withArgs(
        subjectDepositId,
        subjectAcceptingIntents
      );
    });

    describe("when setting accepting intents to true", async () => {
      beforeEach(async () => {
        // First set to false
        await ramp.connect(offRamper.wallet).setDepositAcceptingIntents(subjectDepositId, false);
        // Then set back to true
        subjectAcceptingIntents = true;
      });

      it("should update the accepting intents state to true", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);
        expect(preDeposit.acceptingIntents).to.be.false;

        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.acceptingIntents).to.be.true;
      });

      it("should emit a DepositAcceptingIntentsUpdated event", async () => {
        await expect(subject()).to.emit(ramp, "DepositAcceptingIntentsUpdated").withArgs(
          subjectDepositId,
          true
        );
      });
    });

    describe("when the caller is delegate", async () => {
      beforeEach(async () => {
        subjectCaller = offRamperDelegate;
      });

      it("should not revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });

      it("should update the accepting intents state", async () => {
        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.acceptingIntents).to.eq(subjectAcceptingIntents);
      });
    });

    describe("when the deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositNotFound");
      });
    });

    describe("when the caller is not the depositor or delegate", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCallerOrDelegate");
      });
    });

    describe("when the deposit is already in the requested state", async () => {
      beforeEach(async () => {
        subjectAcceptingIntents = true; // Deposit is already accepting intents by default
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositAlreadyInState");
      });
    });

    describe("when the deposit has no remaining liquidity", async () => {
      beforeEach(async () => {
        // Lock some funds first
        await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);
        const intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent"));
        const currentTimestamp = await blockchain.getCurrentTimestamp();
        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          intentHash,
          usdc(10)
        );

        // Remove all remaining deposits from deposit
        await ramp.connect(offRamper.wallet).withdrawDeposit(subjectDepositId);

        // Set accepting intents to true
        subjectAcceptingIntents = true; // Trying to restart accepting intents
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "InsufficientDepositLiquidity");
      });
    });

    describe("when the deposit has outstanding intents but still has remaining deposits", async () => {
      beforeEach(async () => {
        // Lock some funds first
        await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);
        const intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent"));
        const currentTimestamp = await blockchain.getCurrentTimestamp();

        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          intentHash,
          usdc(40)
        );
      });

      it("should not revert and update state", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);
        expect(preDeposit.remainingDeposits).to.eq(usdc(60)); // 100 - 40
        expect(preDeposit.outstandingIntentAmount).to.eq(usdc(40));

        await expect(subject()).to.not.be.reverted;

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.acceptingIntents).to.eq(subjectAcceptingIntents);
      });
    });

    describe("when the deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositNotFound");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#pruneExpiredIntents", async () => {
    let subjectCaller: Account;
    let subjectDepositId: BigNumber;

    let depositConversionRate: BigNumber;
    let intentHash: string;
    let intentHash2: string;

    beforeEach(async () => {
      // Create deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      depositConversionRate = ether(1.08);
      await ramp.connect(offRamper.wallet).createDeposit({
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
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent"));

      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);

      await orchestratorMock.connect(owner.wallet).lockFunds(
        ZERO,
        intentHash,
        usdc(40)
      );

      subjectCaller = onRamper;
      subjectDepositId = ZERO;
    });

    async function subject(): Promise<any> {
      await ramp.connect(subjectCaller.wallet).pruneExpiredIntents(subjectDepositId);
    }

    describe("when timestamp is before intent expiry", async () => {
      it("should not update deposit state", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);
        expect(preDeposit.remainingDeposits).to.eq(usdc(60));
        expect(preDeposit.outstandingIntentAmount).to.eq(usdc(40));

        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.remainingDeposits).to.eq(usdc(60));
        expect(postDeposit.outstandingIntentAmount).to.eq(usdc(40));
      });
    });

    describe("when timestamp is after intent expiry", async () => {
      beforeEach(async () => {
        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());
      });

      it("should update deposit state", async () => {
        await subject();

        const depositIntents = await ramp.getDepositIntentHashes(subjectDepositId);
        expect(depositIntents.length).to.eq(0);
      });

      it("should update deposit amounts", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);
        expect(preDeposit.remainingDeposits).to.eq(usdc(60));
        expect(preDeposit.outstandingIntentAmount).to.eq(usdc(40));

        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.remainingDeposits).to.eq(usdc(100));
        expect(postDeposit.outstandingIntentAmount).to.eq(ZERO);
      });

      it("should have called the orchestrator to prune intents", async () => {
        const preIntents = await orchestratorMock.getLastPrunedIntents();
        expect(preIntents.length).to.eq(0);

        await subject();

        const postIntents = await orchestratorMock.getLastPrunedIntents();
        expect(postIntents.length).to.eq(1);
        expect(postIntents[0]).to.eq(intentHash);
      });
    });

    describe("when there are multiple intents; few are expired", async () => {
      beforeEach(async () => {
        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());
        intentHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent2"));
        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          intentHash2,
          usdc(50)
        );
      });

      it("should prune only expired intents", async () => {
        await subject();

        const depositIntents = await ramp.getDepositIntentHashes(subjectDepositId);
        expect(depositIntents.length).to.eq(1);
        expect(depositIntents).to.not.include(intentHash);
        expect(depositIntents).to.include(intentHash2);
      });
    });
  });

  // ORCHESTRATOR-ONLY FUNCTIONS

  describe("#lockFunds", async () => {
    let subjectDepositId: BigNumber;
    let subjectIntentHash: string;
    let subjectAmount: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(60) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectDepositId = ZERO;
      subjectIntentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );
      currentIntentCounter++;  // Increment for consistency

      subjectAmount = usdc(30);
      subjectCaller = owner;

      // Set the orchestrator mock as the orchestrator
      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);
    });

    async function subject(): Promise<any> {
      return orchestratorMock.connect(subjectCaller.wallet).lockFunds(
        subjectDepositId,
        subjectIntentHash,
        subjectAmount
      );
    }

    it("should update the deposit state correctly", async () => {
      const preDeposit = await ramp.getDeposit(subjectDepositId);
      expect(preDeposit.remainingDeposits).to.eq(usdc(100));
      expect(preDeposit.outstandingIntentAmount).to.eq(ZERO);

      await subject();

      const postDeposit = await ramp.getDeposit(subjectDepositId);
      expect(postDeposit.remainingDeposits).to.eq(usdc(70)); // 100 - 30
      expect(postDeposit.outstandingIntentAmount).to.eq(usdc(30));
    });

    it("should create the intent correctly", async () => {
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      await subject();

      const intent = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
      expect(intent.intentHash).to.eq(subjectIntentHash);
      expect(intent.amount).to.eq(subjectAmount);
      expect(intent.expiryTime).to.eq(currentTimestamp.add(ONE_DAY_IN_SECONDS));
    });

    it("should add intent hash to deposit intent hashes", async () => {
      await subject();

      const intentHashes = await ramp.getDepositIntentHashes(subjectDepositId);
      expect(intentHashes).to.include(subjectIntentHash);
    });

    it("should emit the correct event", async () => {
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      await expect(subject()).to.emit(ramp, "FundsLocked").withArgs(
        subjectDepositId,
        subjectIntentHash,
        subjectAmount,
        currentTimestamp.add(ONE_DAY_IN_SECONDS)
      );
    });

    describe("when caller is not orchestrator", async () => {
      beforeEach(async () => {
        // remove the orchestrator mock
        await ramp.connect(owner.wallet).setOrchestrator(offRamper.address);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
      });
    });

    describe("when deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositNotFound");
      });
    });

    describe("when deposit is not accepting intents", async () => {
      beforeEach(async () => {
        // Lock some funds on the deposit
        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          subjectIntentHash,
          usdc(30)
        );

        // withdraw deposit
        await ramp.connect(offRamper.wallet).withdrawDeposit(subjectDepositId);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositNotAcceptingIntents");
      });
    });

    describe("when amount is less than min intent amount", async () => {
      beforeEach(async () => {
        subjectAmount = usdc(5); // min is 10
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountBelowMin");
      });
    });

    describe("when amount is greater than max intent amount", async () => {
      beforeEach(async () => {
        subjectAmount = usdc(70); // max is 60
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountAboveMax");
      });
    });

    describe("when there are expired intents and not enough liquidity", async () => {
      beforeEach(async () => {
        // First lock 50 USDC
        const firstIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent1"));
        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          firstIntentHash,
          usdc(50)
        );

        // Time travel to expire the first intent
        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());

        // Try to lock another 60 USDC (only 50 remaining, but expired intent can be pruned)
        subjectAmount = usdc(60);
      });

      it("should prune expired intents and lock funds", async () => {
        await subject();

        const deposit = await ramp.getDeposit(subjectDepositId);
        expect(deposit.remainingDeposits).to.eq(usdc(40)); // 100 - 60 (new intent)
        expect(deposit.outstandingIntentAmount).to.eq(usdc(60)); // Only new intent
      });
    });

    describe("when there is not enough liquidity even after pruning", async () => {
      beforeEach(async () => {
        // Lock all available funds
        const firstIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent1"));
        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          firstIntentHash,
          usdc(50)
        );

        const secondIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent2"));
        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          secondIntentHash,
          usdc(50)
        );

        // Try to lock more
        subjectAmount = usdc(30);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "InsufficientDepositLiquidity");
      });
    });

    describe("when we have reached max number of intents per deposit", async function () {
      const MAX_INTENTS_PER_DEPOSIT = 3; // Matches the contract constant
      let intentHashes: string[] = [];
      let depositId: BigNumber;

      async function signalIntent(): Promise<any> {
        const params = await createSignalIntentParams(
          ramp.address,
          depositId,
          usdc(1),
          onRamper.address,
          verifier.address,
          Currency.USD,
          ether(1),
          ADDRESS_ZERO,
          ZERO,
          gatingService,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );

        const tx = await orchestrator.connect(onRamper.wallet).signalIntent(params);
        currentIntentCounter++;
        return tx;
      }

      beforeEach(async () => {
        // Set max intents per deposit to 3
        await ramp.connect(owner.wallet).setMaxIntentsPerDeposit(MAX_INTENTS_PER_DEPOSIT);

        // Reset intentHashes array for each test
        intentHashes = [];

        // First time setup - create deposit and 99 intents
        await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(1000));

        const payeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails"));
        const depositData = ethers.utils.defaultAbiCoder.encode(
          ["address"],
          [witness.address]
        );

        await ramp.connect(offRamper.wallet).createDeposit({
          token: usdcToken.address,
          amount: usdc(1000),
          intentAmountRange: { min: usdc(1), max: usdc(100) },
          verifiers: [verifier.address],
          verifierData: [{
            intentGatingService: gatingService.address,
            payeeDetails: payeeDetails,
            data: depositData
          }],
          currencies: [[{ code: Currency.USD, minConversionRate: ether(1) }]],
          delegate: ADDRESS_ZERO,
          intentGuardian: ADDRESS_ZERO
        });

        const depositCounter = await ramp.depositCounter();
        depositId = depositCounter.sub(1);

        // Enable multiple intents so we can create many
        await orchestrator.connect(owner.wallet).setAllowMultipleIntents(true);
        await ramp.connect(owner.wallet).setOrchestrator(orchestrator.address);

        // Signal MAX_INTENTS_PER_DEPOSIT - 1 intents using batching
        for (let i = 0; i < MAX_INTENTS_PER_DEPOSIT - 1; i++) {
          await signalIntent();
          const intentHash = calculateIntentHash(
            orchestrator.address,
            currentIntentCounter
          );
          intentHashes.push(intentHash);
          currentIntentCounter++;
        }
      });

      it("should allow creating MAX_INTENTS_PER_DEPOSIT intents", async () => {
        await expect(signalIntent()).to.not.be.reverted;

        const depositIntents = await ramp.getDepositIntentHashes(depositId);
        expect(depositIntents.length).to.eq(MAX_INTENTS_PER_DEPOSIT);
      });

      it("should revert when trying to create more than MAX_INTENTS_PER_DEPOSIT intents", async () => {
        await signalIntent();

        const depositIntents = await ramp.getDepositIntentHashes(depositId);
        expect(depositIntents.length).to.eq(MAX_INTENTS_PER_DEPOSIT);

        await expect(signalIntent()).to.be.revertedWithCustomError(ramp, "MaxIntentsExceeded");
      });

      it("should allow new intents after cancelling old ones", async () => {
        await signalIntent();

        await expect(signalIntent()).to.be.revertedWithCustomError(ramp, "MaxIntentsExceeded");

        await orchestrator.connect(onRamper.wallet).cancelIntent(intentHashes[0]);
        await expect(signalIntent()).to.not.be.reverted;

        const depositIntents = await ramp.getDepositIntentHashes(depositId);
        expect(depositIntents.length).to.eq(MAX_INTENTS_PER_DEPOSIT);
      });

      it("should allow new intents after expired intents are pruned automatically", async () => {
        await signalIntent();

        await expect(signalIntent()).to.be.revertedWithCustomError(ramp, "MaxIntentsExceeded");

        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());

        await expect(signalIntent()).to.not.be.reverted;

        const depositIntents = await ramp.getDepositIntentHashes(depositId);
        expect(depositIntents.length).to.eq(1);
      });
    });
  });

  describe("#unlockFunds", async () => {
    let subjectDepositId: BigNumber;
    let subjectIntentHash: string;
    let subjectCaller: Account;

    let intentAmount: BigNumber;
    let intentExpiryTime: BigNumber;

    beforeEach(async () => {
      // Create deposit
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(50) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      // Lock funds first
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectDepositId = ZERO;
      subjectIntentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );
      currentIntentCounter++;  // Increment for consistency
      intentAmount = usdc(30);
      intentExpiryTime = currentTimestamp.add(ONE_DAY_IN_SECONDS);

      // Set the orchestrator mock as the orchestrator
      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);

      await orchestratorMock.connect(owner.wallet).lockFunds(
        subjectDepositId,
        subjectIntentHash,
        intentAmount
      );

      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestratorMock.connect(subjectCaller.wallet).unlockFunds(
        subjectDepositId,
        subjectIntentHash
      );
    }

    it("should update the deposit state correctly", async () => {
      const preDeposit = await ramp.getDeposit(subjectDepositId);
      expect(preDeposit.remainingDeposits).to.eq(usdc(70));
      expect(preDeposit.outstandingIntentAmount).to.eq(usdc(30));

      await subject();

      const postDeposit = await ramp.getDeposit(subjectDepositId);
      expect(postDeposit.remainingDeposits).to.eq(usdc(100)); // Funds returned
      expect(postDeposit.outstandingIntentAmount).to.eq(ZERO);
    });

    it("should delete the intent", async () => {
      const preIntent = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
      expect(preIntent.intentHash).to.eq(subjectIntentHash);

      await subject();

      const postIntent = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
      expect(postIntent.intentHash).to.eq(ZERO_BYTES32);
    });

    it("should remove intent hash from deposit intent hashes", async () => {
      const preIntentHashes = await ramp.getDepositIntentHashes(subjectDepositId);
      expect(preIntentHashes).to.include(subjectIntentHash);

      await subject();

      const postIntentHashes = await ramp.getDepositIntentHashes(subjectDepositId);
      expect(postIntentHashes).to.not.include(subjectIntentHash);
    });

    it("should emit the correct event", async () => {
      await expect(subject()).to.emit(ramp, "FundsUnlocked").withArgs(
        subjectDepositId,
        subjectIntentHash,
        intentAmount
      );
    });

    describe("when caller is not orchestrator", async () => {
      beforeEach(async () => {
        // remove the orchestrator mock
        await ramp.connect(owner.wallet).setOrchestrator(offRamper.address);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
      });
    });

    describe("when deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositNotFound");
      });
    });

    describe("when intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "IntentNotFound");
      });
    });
  });

  describe("#unlockAndTransferFunds", async () => {
    let subjectDepositId: BigNumber;
    let subjectIntentHash: string;
    let subjectTransferAmount: BigNumber;
    let subjectTo: Address;
    let subjectCaller: Account;

    let intentAmount: BigNumber;
    let intentExpiryTime: BigNumber;

    beforeEach(async () => {
      // Create deposit
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(50) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      // Lock funds first
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectDepositId = ZERO;
      subjectIntentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );
      currentIntentCounter++;  // Increment after signalIntent
      intentAmount = usdc(30);
      intentExpiryTime = currentTimestamp.add(ONE_DAY_IN_SECONDS);

      // Set the orchestrator mock as the orchestrator
      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);

      await orchestratorMock.connect(owner.wallet).lockFunds(
        subjectDepositId,
        subjectIntentHash,
        intentAmount
      );

      subjectTransferAmount = intentAmount; // Full amount by default
      subjectTo = orchestrator.address; // Transfer to the real orchestrator address
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestratorMock.connect(subjectCaller.wallet).unlockAndTransferFunds(
        subjectDepositId,
        subjectIntentHash,
        subjectTransferAmount,
        subjectTo
      );
    }

    it("should transfer the correct amount of tokens", async () => {
      const preToBalance = await usdcToken.balanceOf(subjectTo);
      const preRampBalance = await usdcToken.balanceOf(ramp.address);

      await subject();

      const postToBalance = await usdcToken.balanceOf(subjectTo);
      const postRampBalance = await usdcToken.balanceOf(ramp.address);

      expect(postToBalance).to.eq(preToBalance.add(subjectTransferAmount));
      expect(postRampBalance).to.eq(preRampBalance.sub(subjectTransferAmount));
    });

    it("should update the deposit state correctly for full transfer", async () => {
      await subject();

      const postDeposit = await ramp.getDeposit(subjectDepositId);
      expect(postDeposit.remainingDeposits).to.eq(usdc(70)); // 100 - 30
      expect(postDeposit.outstandingIntentAmount).to.eq(ZERO);
    });

    it("should delete the intent", async () => {
      await subject();

      const postIntent = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
      expect(postIntent.intentHash).to.eq(ZERO_BYTES32);
    });

    it("should emit the correct event", async () => {
      await expect(subject()).to.emit(ramp, "FundsUnlockedAndTransferred").withArgs(
        subjectDepositId,
        subjectIntentHash,
        intentAmount,
        subjectTransferAmount,
        ZERO,     // maker fee
        subjectTo
      );
    });

    it("should remove intent hash from deposit intent hashes", async () => {
      await subject();

      const postIntentHashes = await ramp.getDepositIntentHashes(subjectDepositId);
      expect(postIntentHashes).to.not.include(subjectIntentHash);
    });

    describe("when transferring partial amount", async () => {
      beforeEach(async () => {
        subjectTransferAmount = usdc(20); // Less than intent amount of 30
      });

      it("should transfer the partial amount", async () => {
        const preToBalance = await usdcToken.balanceOf(subjectTo);
        await subject();
        const postToBalance = await usdcToken.balanceOf(subjectTo);

        expect(postToBalance).to.eq(preToBalance.add(usdc(20)));
      });

      it("should return unused funds to remaining deposits and zero out outstanding intent amount", async () => {
        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        // 70 (remaining before) + 10 (unused from intent: 30 - 20)
        expect(postDeposit.remainingDeposits).to.eq(usdc(80));
        expect(postDeposit.outstandingIntentAmount).to.eq(ZERO);
      });
    });

    describe("when transfer amount is zero", async () => {
      beforeEach(async () => {
        subjectTransferAmount = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroValue");
      });
    });

    describe("when transferring would close the deposit", async () => {
      beforeEach(async () => {
        // Withdraw most funds first
        await ramp.connect(offRamper.wallet).removeFundsFromDeposit(subjectDepositId, usdc(70));
        // Now deposit only has the 30 USDC locked in the intent
      });

      it("should close the deposit after transfer", async () => {
        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.depositor).to.eq(ADDRESS_ZERO);
      });

      it("should emit DepositClosed event", async () => {
        await expect(subject()).to.emit(ramp, "DepositClosed").withArgs(
          subjectDepositId,
          offRamper.address
        );
      });
    });

    describe("when transfer amount exceeds intent amount", async () => {
      beforeEach(async () => {
        subjectTransferAmount = usdc(40); // Intent amount is only 30
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountExceedsAvailable");
      });
    });

    describe("when caller is not orchestrator", async () => {
      beforeEach(async () => {
        // remove the orchestrator mock
        await ramp.connect(owner.wallet).setOrchestrator(offRamper.address);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "UnauthorizedCaller");
      });
    });

    describe("when deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositNotFound");
      });
    });

    describe("when intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "IntentNotFound");
      });
    });

    describe("when maker fees are enabled", async () => {
      let makerFeeRate: BigNumber;
      let grossDepositAmount: BigNumber;
      let reservedFees: BigNumber;
      let netDepositAmount: BigNumber;
      let expectedAccruedFees: BigNumber;

      beforeEach(async () => {
        // Set maker fee to 1%
        makerFeeRate = ether(0.01);
        await ramp.connect(owner.wallet).setMakerProtocolFee(makerFeeRate);
        await ramp.connect(owner.wallet).setMakerFeeRecipient(feeRecipient.address);

        // Create deposit with fees
        grossDepositAmount = usdc(100);
        reservedFees = grossDepositAmount.mul(makerFeeRate).div(ether(1));
        netDepositAmount = grossDepositAmount.sub(reservedFees);

        await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
        await ramp.connect(offRamper.wallet).createDeposit({
          token: usdcToken.address,
          amount: grossDepositAmount,
          intentAmountRange: { min: usdc(10), max: usdc(100) },
          verifiers: [verifier.address],
          verifierData: [{
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
            data: "0x"
          }],
          currencies: [
            [{ code: Currency.USD, minConversionRate: ether(1.01) }]
          ],
          delegate: offRamperDelegate.address,
          intentGuardian: ADDRESS_ZERO
        });

        // Lock funds
        const currentTimestamp = await blockchain.getCurrentTimestamp();
        subjectDepositId = BigNumber.from(1); // New deposit
        subjectIntentHash = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter
        );
        intentAmount = usdc(30);
        intentExpiryTime = currentTimestamp.add(ONE_DAY_IN_SECONDS);
        currentIntentCounter++;  // Increment after signalIntent

        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          subjectIntentHash,
          intentAmount
        );

        subjectTransferAmount = intentAmount; // Full amount by default
        expectedAccruedFees = subjectTransferAmount.mul(makerFeeRate).div(ether(1));
      });

      it("should accrue maker fees on transfer", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);
        expect(preDeposit.accruedMakerFees).to.eq(ZERO);
        expect(preDeposit.reservedMakerFees).to.eq(reservedFees);

        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        expect(postDeposit.accruedMakerFees).to.eq(expectedAccruedFees);
        expect(postDeposit.reservedMakerFees).to.eq(reservedFees); // Reserved fees unchanged
      });

      it("should update the deposit state correctly with fees", async () => {
        await subject();

        const postDeposit = await ramp.getDeposit(subjectDepositId);
        // Remaining = 99 - 30 = 69 USDC
        expect(postDeposit.remainingDeposits).to.eq(netDepositAmount.sub(intentAmount));
        expect(postDeposit.outstandingIntentAmount).to.eq(ZERO);
      });

      it("should emit FundsUnlockedAndTransferred with correct fee amount", async () => {
        await expect(subject()).to.emit(ramp, "FundsUnlockedAndTransferred").withArgs(
          subjectDepositId,
          subjectIntentHash,
          intentAmount,
          subjectTransferAmount,
          expectedAccruedFees,
          subjectTo
        );
      });

      describe("when transferring partial amount", async () => {
        beforeEach(async () => {
          subjectTransferAmount = usdc(20); // Less than intent amount
          expectedAccruedFees = subjectTransferAmount.mul(makerFeeRate).div(ether(1));
        });

        it("should accrue fees proportional to transfer amount", async () => {
          await subject();

          const postDeposit = await ramp.getDeposit(subjectDepositId);
          expect(postDeposit.accruedMakerFees).to.eq(expectedAccruedFees); // 0.2 USDC
        });

        it("should return unused portion to remaining deposits", async () => {
          await subject();

          const postDeposit = await ramp.getDeposit(subjectDepositId);
          // Remaining = 69 + 10 (unused) = 79 USDC
          const expectedRemaining = netDepositAmount.sub(intentAmount).add(intentAmount.sub(subjectTransferAmount));
          expect(postDeposit.remainingDeposits).to.eq(expectedRemaining);
        });
      });

      describe("when transferring would accrue fees but not close deposit", async () => {
        beforeEach(async () => {
          // Remove most funds, leaving only the intent amount
          await ramp.connect(offRamper.wallet).removeFundsFromDeposit(subjectDepositId, netDepositAmount.sub(intentAmount));
        });

        it("should collect accrued fees and close deposit", async () => {
          const preFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

          await subject();

          const postFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const postDeposit = await ramp.getDeposit(subjectDepositId);

          // All fees should be collected (both the new accrued fees and any previously accrued)
          expect(postFeeRecipientBalance).to.eq(preFeeRecipientBalance);
          expect(postDeposit.accruedMakerFees).to.eq(expectedAccruedFees);
        });

        it("should zero out the outstanding intent amount and remaining deposits", async () => {
          await subject();

          const postDeposit = await ramp.getDeposit(subjectDepositId);
          expect(postDeposit.outstandingIntentAmount).to.eq(ZERO);
          expect(postDeposit.remainingDeposits).to.eq(ZERO);
        });

        it("should NOT emit MakerFeesCollected event", async () => {
          await expect(subject()).to.not.emit(ramp, "MakerFeesCollected");
        });

        describe("should allow the depositor to withdraw the reamaining reserved fees later", async () => {
          beforeEach(async () => {
            // Unlock and transfer to accrue fees
            await subject();
          });

          it("should allow the depositor to withdraw the reamaining funds", async () => {
            const preOffRamperBalance = await usdcToken.balanceOf(offRamper.address);

            await ramp.connect(offRamper.wallet).withdrawDeposit(subjectDepositId);

            const postOffRamperBalance = await usdcToken.balanceOf(offRamper.address);
            expect(postOffRamperBalance).to.eq(preOffRamperBalance.add(reservedFees.sub(expectedAccruedFees)));
          });
        });
      });

      describe("when deposit has remaining funds less than dust threshold", async () => {
        beforeEach(async () => {
          // Remove the old intent
          await orchestratorMock.connect(owner.wallet).unlockFunds(subjectDepositId, subjectIntentHash);

          // Set dust threshold
          await ramp.connect(owner.wallet).setDustThreshold(usdc(1));

          // Create a smaller intent that will leave dust
          intentAmount = netDepositAmount.sub(usdc(0.5)); // Leave 0.5 USDC

          // Re-lock funds with new amount
          const currentTimestamp = await blockchain.getCurrentTimestamp();
          subjectIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("newIntent"));

          await orchestratorMock.connect(owner.wallet).lockFunds(
            subjectDepositId,
            subjectIntentHash,
            intentAmount
          );

          subjectTransferAmount = intentAmount;
          expectedAccruedFees = subjectTransferAmount.mul(makerFeeRate).div(ether(1));
        });

        it("should collect dust and close deposit", async () => {
          const preFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

          await subject();

          const postFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const postDeposit = await ramp.getDeposit(subjectDepositId);

          // Fee recipient gets accrued fees + dust
          // accrued fees is 0.01 * (99 - 0.5) = 0.985 USDC
          // remaining reserved fees is 1 - 0.985 = 0.015 USDC
          // dust is 0.5 USDC
          // and total remaining is 0.5 + 0.015 = 0.515 USDC
          const expectedTotal = expectedAccruedFees.add(usdc(0.5)).add(usdc(0.015));
          expect(postFeeRecipientBalance).to.eq(preFeeRecipientBalance.add(expectedTotal));
          expect(postDeposit.depositor).to.eq(ADDRESS_ZERO); // Deposit closed
        });

        it("should emit both MakerFeesCollected and DustCollected events", async () => {
          const tx = await subject();

          await expect(tx).to.emit(ramp, "MakerFeesCollected").withArgs(
            subjectDepositId,
            expectedAccruedFees, // All accrued fees collected
            feeRecipient.address
          );

          await expect(tx).to.emit(ramp, "DustCollected").withArgs(
            subjectDepositId,
            usdc(0.5).add(usdc(0.015)), // dust + remaining reserved fees
            feeRecipient.address
          );
        });
      });

      describe("when multiple intents fulfilled", async () => {
        let secondIntentHash: string;
        let secondIntentAmount: BigNumber;

        beforeEach(async () => {
          // First fulfill the original intent
          await subject();

          // Create and lock a second intent
          secondIntentAmount = usdc(40);
          const currentTimestamp = await blockchain.getCurrentTimestamp();
          secondIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("secondIntent"));

          await orchestratorMock.connect(owner.wallet).lockFunds(
            subjectDepositId,
            secondIntentHash,
            secondIntentAmount
          );

          // Update subject params for second intent
          subjectIntentHash = secondIntentHash;
          subjectTransferAmount = secondIntentAmount;
        });

        it("should accumulate accrued fees", async () => {
          const firstIntentFees = intentAmount.mul(makerFeeRate).div(ether(1));
          const secondIntentFees = secondIntentAmount.mul(makerFeeRate).div(ether(1));

          await subject();

          const postDeposit = await ramp.getDeposit(subjectDepositId);
          expect(postDeposit.accruedMakerFees).to.eq(firstIntentFees.add(secondIntentFees));
        });
      });
    });
  });

  describe("#extendIntentExpiry", async () => {
    let subjectDepositId: BigNumber;
    let subjectIntentHash: string;
    let subjectAdditionalTime: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create a deposit with an intent guardian
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));

      await ramp.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(100) },
        verifiers: [verifier.address],
        verifierData: [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: ether(1) }]
        ],
        delegate: ADDRESS_ZERO,  // delegate
        intentGuardian: intentGuardian.address  // intentGuardian
      });

      subjectDepositId = ZERO;

      // Signal an intent
      const params = await createSignalIntentParams(
        ramp.address,
        subjectDepositId,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        ether(1),
        ADDRESS_ZERO,
        ZERO,
        gatingService,
        chainId.toString(),
        ADDRESS_ZERO,
        "0x"
      );

      await orchestrator.connect(onRamper.wallet).signalIntent(params);

      subjectIntentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );
      currentIntentCounter++;

      subjectAdditionalTime = BigNumber.from(3600); // 1 hour
      subjectCaller = intentGuardian;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).extendIntentExpiry(
        subjectDepositId,
        subjectIntentHash,
        subjectAdditionalTime
      );
    }

    it("should extend the intent expiry time", async () => {
      const intentBefore = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
      const oldExpiryTime = intentBefore.expiryTime;

      await subject();

      const intentAfter = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
      const newExpiryTime = intentAfter.expiryTime;

      expect(newExpiryTime).to.eq(oldExpiryTime.add(subjectAdditionalTime));
    });

    it("should emit IntentExpiryExtended event", async () => {
      const intentBefore = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
      const oldExpiryTime = intentBefore.expiryTime;
      const newExpiryTime = oldExpiryTime.add(subjectAdditionalTime);

      await expect(subject()).to.emit(ramp, "IntentExpiryExtended").withArgs(
        subjectDepositId,
        subjectIntentHash,
        newExpiryTime
      );
    });

    describe("when called by non-intent guardian", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "UnauthorizedCaller");
      });
    });

    describe("when intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "IntentNotFound");
      });
    });

    describe("when deposit has no intent guardian", async () => {
      beforeEach(async () => {
        // Cancel the intent
        await orchestrator.connect(onRamper.wallet).cancelIntent(subjectIntentHash);

        // Create a deposit without intent guardian
        await ramp.connect(offRamper.wallet).createDeposit({
          token: usdcToken.address,
          amount: usdc(100),
          intentAmountRange: { min: usdc(10), max: usdc(100) },
          verifiers: [verifier.address],
          verifierData: [{
            intentGatingService: gatingService.address,
            payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails2")),
            data: "0x"
          }],
          currencies: [
            [{ code: Currency.USD, minConversionRate: ether(1) }]
          ],
          delegate: ADDRESS_ZERO,  // delegate
          intentGuardian: ADDRESS_ZERO   // no intentGuardian
        });

        const newDepositId = ONE;

        // Signal an intent for the new deposit
        const params = await createSignalIntentParams(
          ramp.address,
          newDepositId,
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          ether(1),
          ADDRESS_ZERO,
          ZERO,
          gatingService,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );

        await orchestrator.connect(onRamper.wallet).signalIntent(params);

        const intentCounter = await orchestrator.intentCounter();

        subjectDepositId = ONE;
        subjectIntentHash = calculateIntentHash(
          orchestrator.address,
          intentCounter.sub(1)
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "UnauthorizedCaller");
      });
    });

    describe("when extending multiple times", async () => {
      it("should allow multiple extensions", async () => {
        const initialIntent = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
        const initialExpiry = initialIntent.expiryTime;

        // First extension
        await subject();

        const afterFirst = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
        expect(afterFirst.expiryTime).to.eq(initialExpiry.add(subjectAdditionalTime));

        // Second extension
        await subject();

        const afterSecond = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
        expect(afterSecond.expiryTime).to.eq(initialExpiry.add(subjectAdditionalTime.mul(2)));
      });
    });
  });


  // GOVERNANCE FUNCTIONS

  describe("#setOrchestrator", async () => {
    let subjectOrchestrator: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      const newOrchestrator = await deployer.deployOrchestrator(
        owner.address,
        chainId,
        ramp.address,
        paymentVerifierRegistry.address,
        postIntentHookRegistry.address,
        relayerRegistry.address,
        ZERO,
        feeRecipient.address
      );

      subjectOrchestrator = newOrchestrator.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setOrchestrator(subjectOrchestrator);
    }

    it("should set the correct payment verifier registry", async () => {
      const preOrchestrator = await ramp.orchestrator();
      expect(preOrchestrator).to.not.eq(subjectOrchestrator);

      await subject();

      const postOrchestrator = await ramp.orchestrator();
      expect(postOrchestrator).to.eq(subjectOrchestrator);
    });

    it("should emit a OrchestratorUpdated event", async () => {
      await expect(subject()).to.emit(ramp, "OrchestratorUpdated").withArgs(subjectOrchestrator);
    });

    describe("when the orchestrator is zero address", async () => {
      beforeEach(async () => {
        subjectOrchestrator = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroAddress");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#setPaymentVerifierRegistry", async () => {
    let subjectPaymentVerifierRegistry: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      const newRegistry = await deployer.deployPaymentVerifierRegistry();
      subjectPaymentVerifierRegistry = newRegistry.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setPaymentVerifierRegistry(subjectPaymentVerifierRegistry);
    }

    it("should set the correct payment verifier registry", async () => {
      const preRegistry = await ramp.paymentVerifierRegistry();
      expect(preRegistry).to.not.eq(subjectPaymentVerifierRegistry);

      await subject();

      const postRegistry = await ramp.paymentVerifierRegistry();
      expect(postRegistry).to.eq(subjectPaymentVerifierRegistry);
    });

    it("should emit a PaymentVerifierRegistryUpdated event", async () => {
      await expect(subject()).to.emit(ramp, "PaymentVerifierRegistryUpdated").withArgs(subjectPaymentVerifierRegistry);
    });

    describe("when the registry is zero address", async () => {
      beforeEach(async () => {
        subjectPaymentVerifierRegistry = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroAddress");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#pauseEscrow", async () => {
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).pauseEscrow();
    }

    it("should pause the escrow", async () => {
      await subject();

      const isPaused = await ramp.paused();
      expect(isPaused).to.be.true;
    });

    it("should emit a Paused event", async () => {
      await expect(subject()).to.emit(ramp, "Paused").withArgs(owner.address);
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("when the escrow is already paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#unpauseEscrow", async () => {
    let subjectCaller: Account;

    beforeEach(async () => {
      await ramp.connect(owner.wallet).pauseEscrow();
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).unpauseEscrow();
    }

    it("should unpause the escrow", async () => {
      await subject();

      const isPaused = await ramp.paused();
      expect(isPaused).to.be.false;
    });

    it("should emit an Unpaused event", async () => {
      await expect(subject()).to.emit(ramp, "Unpaused").withArgs(owner.address);
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("when the escrow is not paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).unpauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: not paused");
      });
    });
  });

  describe("#setMakerProtocolFee", async () => {
    let subjectMakerProtocolFee: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectMakerProtocolFee = ether(0.02); // 2%
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setMakerProtocolFee(subjectMakerProtocolFee);
    }

    it("should set the correct maker protocol fee", async () => {
      const preFee = await ramp.makerProtocolFee();
      expect(preFee).to.eq(ZERO);

      await subject();

      const postFee = await ramp.makerProtocolFee();
      expect(postFee).to.eq(subjectMakerProtocolFee);
    });

    it("should emit a MakerProtocolFeeUpdated event", async () => {
      await expect(subject()).to.emit(ramp, "MakerProtocolFeeUpdated").withArgs(subjectMakerProtocolFee);
    });

    describe("when setting fee to zero", async () => {
      beforeEach(async () => {
        // First set a non-zero fee
        await ramp.connect(owner.wallet).setMakerProtocolFee(ether(0.01));
        // Then set to zero
        subjectMakerProtocolFee = ZERO;
      });

      it("should allow setting fee to zero", async () => {
        await subject();

        const postFee = await ramp.makerProtocolFee();
        expect(postFee).to.eq(ZERO);
      });
    });

    describe("when the fee exceeds maximum", async () => {
      beforeEach(async () => {
        subjectMakerProtocolFee = ether(0.051); // 5.1%, exceeds max of 5%
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountAboveMax");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#setMakerFeeRecipient", async () => {
    let subjectMakerFeeRecipient: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectMakerFeeRecipient = receiver.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setMakerFeeRecipient(subjectMakerFeeRecipient);
    }

    it("should set the correct maker fee recipient", async () => {
      await subject();

      const postRecipient = await ramp.makerFeeRecipient();
      expect(postRecipient).to.eq(subjectMakerFeeRecipient);
    });

    it("should emit a MakerFeeRecipientUpdated event", async () => {
      await expect(subject()).to.emit(ramp, "MakerFeeRecipientUpdated").withArgs(subjectMakerFeeRecipient);
    });

    describe("when updating existing recipient", async () => {
      beforeEach(async () => {
        // First set an initial recipient
        await ramp.connect(owner.wallet).setMakerFeeRecipient(feeRecipient.address);
        // Then update to new recipient
        subjectMakerFeeRecipient = receiver.address;
      });

      it("should update to new recipient", async () => {
        const preRecipient = await ramp.makerFeeRecipient();
        expect(preRecipient).to.eq(feeRecipient.address);

        await subject();

        const postRecipient = await ramp.makerFeeRecipient();
        expect(postRecipient).to.eq(subjectMakerFeeRecipient);
      });
    });

    describe("when the recipient is zero address", async () => {
      beforeEach(async () => {
        subjectMakerFeeRecipient = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroAddress");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#setDustThreshold", async () => {
    let subjectDustThreshold: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectDustThreshold = usdc(1); // 1 USDC
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setDustThreshold(subjectDustThreshold);
    }

    it("should set the correct dust threshold", async () => {
      const preThreshold = await ramp.dustThreshold();
      expect(preThreshold).to.eq(ZERO);

      await subject();

      const postThreshold = await ramp.dustThreshold();
      expect(postThreshold).to.eq(subjectDustThreshold);
    });

    it("should emit a DustThresholdUpdated event", async () => {
      await expect(subject()).to.emit(ramp, "DustThresholdUpdated").withArgs(subjectDustThreshold);
    });

    describe("when setting threshold to zero", async () => {
      beforeEach(async () => {
        // First set a non-zero threshold
        await ramp.connect(owner.wallet).setDustThreshold(usdc(1));
        // Then set to zero
        subjectDustThreshold = ZERO;
      });

      it("should allow setting threshold to zero", async () => {
        await subject();

        const postThreshold = await ramp.dustThreshold();
        expect(postThreshold).to.eq(ZERO);
      });
    });

    describe("when setting a large threshold", async () => {
      beforeEach(async () => {
        subjectDustThreshold = usdc(100); // 100 USDC
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountAboveMax");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#setIntentExpirationPeriod", async () => {
    let subjectIntentExpirationPeriod: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectIntentExpirationPeriod = ONE_DAY_IN_SECONDS.mul(2);
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setIntentExpirationPeriod(subjectIntentExpirationPeriod);
    }

    it("should set the correct expiration time period", async () => {
      const preOnRampAmount = await ramp.intentExpirationPeriod();

      expect(preOnRampAmount).to.eq(ONE_DAY_IN_SECONDS);

      await subject();

      const postOnRampAmount = await ramp.intentExpirationPeriod();

      expect(postOnRampAmount).to.eq(subjectIntentExpirationPeriod);
    });

    it("should emit a IntentExpirationPeriodUpdated event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "IntentExpirationPeriodUpdated").withArgs(subjectIntentExpirationPeriod);
    });

    describe("when the intent expiration period is 0", async () => {
      beforeEach(async () => {
        subjectIntentExpirationPeriod = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroValue");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#setMaxIntentsPerDeposit", async () => {
    let subjectCaller: Account;
    let subjectMaxIntentsPerDeposit: BigNumber;

    beforeEach(async () => {
      subjectCaller = owner;
      subjectMaxIntentsPerDeposit = BigNumber.from(5);
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setMaxIntentsPerDeposit(subjectMaxIntentsPerDeposit);
    }

    it("should update the max intents per deposit", async () => {
      await subject();

      const postMaxIntents = await ramp.maxIntentsPerDeposit();
      expect(postMaxIntents).to.eq(subjectMaxIntentsPerDeposit);
    });

    it("should emit a MaxIntentsPerDepositUpdated event", async () => {
      await expect(subject()).to.emit(ramp, "MaxIntentsPerDepositUpdated").withArgs(subjectMaxIntentsPerDeposit);
    });

    describe("when setting max intents to zero", async () => {
      beforeEach(async () => {
        subjectMaxIntentsPerDeposit = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ZeroValue");
      });
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  // GETTER FUNCTIONS

  describe("#getExpiredIntents", async () => {
    let subjectCaller: Account;
    let subjectDepositId: BigNumber;

    let depositConversionRate: BigNumber;
    let intentHash: string;

    beforeEach(async () => {
      // Create deposit and signal intent first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      depositConversionRate = ether(1.08);
      await ramp.connect(offRamper.wallet).createDeposit({
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
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO
      });

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent"));

      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);

      await orchestratorMock.connect(owner.wallet).lockFunds(
        ZERO,
        intentHash,
        usdc(50)
      );

      subjectCaller = onRamper;
      subjectDepositId = ZERO;
    });

    async function subject(): Promise<{ expiredIntents: string[], reclaimedAmount: BigNumber }> {
      return ramp.connect(subjectCaller.wallet).getExpiredIntents(subjectDepositId);
    }

    describe("when timestamp is before intent expiry", async () => {
      it("should return empty array", async () => {
        const { expiredIntents, reclaimedAmount } = await subject();
        expect(expiredIntents.length).to.eq(1);
        expect(reclaimedAmount).to.eq(ZERO);
      });
    });

    describe("when timestamp is after intent expiry", async () => {
      it("should return prunable intents", async () => {
        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());

        const { expiredIntents, reclaimedAmount } = await subject();

        expect(expiredIntents).to.include(intentHash);
        expect(expiredIntents.length).to.eq(1);
        expect(reclaimedAmount).to.eq(usdc(50));
      });
    });

    describe("when there are no intents", async () => {
      beforeEach(async () => {
        await orchestratorMock.connect(owner.wallet).unlockFunds(
          subjectDepositId,
          intentHash,
        );
      });

      it("should return empty array", async () => {
        const { expiredIntents, reclaimedAmount } = await subject();
        expect(expiredIntents.length).to.eq(0);
        expect(reclaimedAmount).to.eq(ZERO);
      });
    });
  });
});