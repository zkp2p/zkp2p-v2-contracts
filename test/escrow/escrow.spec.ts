import "module-alias/register";

import { ethers } from "hardhat";
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
  OrchestratorMock
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
  let chainId: BigNumber = ONE;

  let ramp: Escrow;
  let protocolViewer: ProtocolViewer;
  let usdcToken: USDCMock;
  let paymentVerifierRegistry: PaymentVerifierRegistry;
  let postIntentHookRegistry: PostIntentHookRegistry;
  let orchestrator: Orchestrator;
  let relayerRegistry: RelayerRegistry;
  let postIntentHookMock: PostIntentHookMock;
  let orchestratorMock: OrchestratorMock;

  let verifier: PaymentVerifierMock;
  let otherVerifier: PaymentVerifierMock;
  let deployer: DeployHelper;

  beforeEach(async () => {
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
      witness
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    paymentVerifierRegistry = await deployer.deployPaymentVerifierRegistry();
    postIntentHookRegistry = await deployer.deployPostIntentHookRegistry();
    relayerRegistry = await deployer.deployRelayerRegistry();

    await usdcToken.transfer(offRamper.address, usdc(10000));

    ramp = await deployer.deployEscrow(
      owner.address,
      chainId,
      paymentVerifierRegistry.address,
    );

    orchestrator = await deployer.deployOrchestrator(
      owner.address,
      chainId,
      ONE_DAY_IN_SECONDS,
      ramp.address,
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

      expect(ownerAddress).to.eq(owner.address);
      expect(chainId).to.eq(chainId);
      expect(paymentVerifierRegistryAddress).to.eq(paymentVerifierRegistry.address);
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

      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
    });

    async function subject(): Promise<any> {
      return ramp.connect(offRamper.wallet).createDeposit(
        subjectToken,
        subjectAmount,
        subjectIntentAmountRange,
        subjectVerifiers,
        subjectVerificationData,
        subjectCurrencies,
        subjectDelegate
      );
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
        subjectDelegate
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "MinIntentAmountCannotBeZero");
      });
    });

    describe("when the min intent amount is greater than max intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = usdc(2);
        subjectIntentAmountRange.max = usdc(1);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "MinIntentAmountMustBeLessThanMax");
      });
    });

    describe("when the amount is less than min intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = usdc(2);
        subjectAmount = usdc(1);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountMustBeGreaterThanMinIntent");
      });
    });

    describe("when the length of the verifiers array is not equal to the length of the verifiersData array", async () => {
      beforeEach(async () => {
        subjectVerifiers = [verifier.address, otherVerifier.address];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifiersAndDepositVerifierDataLengthMismatch");
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifiersAndCurrenciesLengthMismatch");
      });
    });

    describe("when the accepted currencies is not supported by the verifier", async () => {
      beforeEach(async () => {
        subjectCurrencies[0][0].code = Currency.AED;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyNotSupportedByVerifier");
      });
    });

    describe("when the minConversionRate is zero", async () => {
      beforeEach(async () => {
        subjectCurrencies[0][0].minConversionRate = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ConversionRateMustBeGreaterThanZero");
      });
    });

    describe("when the verifier is zero address", async () => {
      beforeEach(async () => {
        subjectVerifiers = [ADDRESS_ZERO];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierCannotBeZeroAddress");
      });
    });

    describe("when the verifier is not whitelisted", async () => {
      beforeEach(async () => {
        subjectVerifiers = [otherVerifier.address];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "PaymentVerifierNotWhitelisted");
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "PayeeDetailsCannotBeEmpty");
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierDataAlreadyExists");
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyRateAlreadyExists");
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

  describe("#addFundsToDeposit", async () => {
    let subjectDepositId: BigNumber;
    let subjectAmount: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit to test adding funds
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.08) }]
        ],
        offRamperDelegate.address
      );

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

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositor");
      });
    });

    describe("when the deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositor");
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

  describe("#removeFundsFromDeposit", async () => {
    let subjectDepositId: BigNumber;
    let subjectAmount: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit to test removing funds
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.08) }]
        ],
        offRamperDelegate.address
      );

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

    describe("when removing all remaining funds", async () => {
      beforeEach(async () => {
        subjectAmount = usdc(100);
      });

      it("should close the deposit", async () => {
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

    describe("when there are expired intents", async () => {

      let intentHash: string;

      beforeEach(async () => {
        // Signal an intent
        const intentAmount = usdc(50);
        const conversionRate = ether(1.1);

        const signalIntentParams = await createSignalIntentParams(
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
          onRamper.address,
          ramp.address,
          verifier.address,
          subjectDepositId,
          currentTimestamp
        );

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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "NotEnoughLiquidity");
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositor");
      });
    });

    describe("when the deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositor");
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
  });

  describe("#withdrawDeposit", async () => {
    let subjectDepositId: BigNumber;
    let subjectCaller: Account;

    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Create deposit to test withdrawal
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      depositConversionRate = ether(1.08);
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: depositConversionRate }]
        ],
        offRamperDelegate.address
      );

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
          subjectDepositId,
          usdc(50),
          receiver.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          chainId.toString()
        );

        const params = await createSignalIntentParams(
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
          onRamper.address,
          ramp.address,
          verifier.address,
          ZERO,
          currentTimestamp
        );
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositor");
      });

      describe("when the caller is delegate", async () => {
        beforeEach(async () => {
          subjectCaller = offRamperDelegate;
        });

        it("should still revert", async () => {
          await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositor");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositorOrDelegate");
      });
    });

    describe("when the currency or verifier is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.EUR;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyOrVerifierNotSupported");
      });
    });

    describe("when the new min conversion rate is zero", async () => {
      beforeEach(async () => {
        subjectNewMinConversionRate = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "MinConversionRateMustBeGreaterThanZero");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositorOrDelegate");
      });
    });

    describe("when the min amount is zero", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "MinCannotBeZero");
      });
    });

    describe("when the min amount is greater than max amount", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange = { min: usdc(200), max: usdc(100) };
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "MinMustBeLessThanMax");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositorOrDelegate");
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "PaymentVerifierNotWhitelisted");
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

      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address, otherVerifier.address],
        [
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
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }],
          [{ code: Currency.USD, minConversionRate: ether(1.02) }]
        ],
        offRamperDelegate.address
      );

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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositorOrDelegate");
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierNotFoundForDeposit");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositorOrDelegate");
      });
    });

    describe("when the verifier is not found for the deposit", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierNotFoundForDeposit");
      });
    });

    describe("when the currency is not supported by the verifier", async () => {
      beforeEach(async () => {
        subjectCurrencies = [
          { code: Currency.AED, minConversionRate: ether(3.67) }
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyNotSupportedByVerifier");
      });
    });

    describe("when the minConversionRate is zero", async () => {
      beforeEach(async () => {
        subjectCurrencies[0].minConversionRate = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "ConversionRateMustBeGreaterThanZero");
      });
    });

    describe("when the currency already exists", async () => {
      beforeEach(async () => {
        subjectCurrencies = [
          { code: Currency.USD, minConversionRate: ether(1.05) }
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyRateAlreadyExists");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [
            { code: Currency.USD, minConversionRate: ether(1.01) },
            { code: Currency.EUR, minConversionRate: ether(0.95) }
          ]
        ],
        offRamperDelegate.address
      );

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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CallerMustBeDepositorOrDelegate");
      });
    });

    describe("when the verifier is not found for the deposit", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "VerifierNotFoundForDeposit");
      });
    });

    describe("when the currency is not found for the verifier", async () => {
      beforeEach(async () => {
        subjectCurrencyCode = Currency.AED;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "CurrencyNotFoundForVerifier");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        ADDRESS_ZERO
      );

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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "OnlyDepositorCanSetDelegate");
      });

      describe("when the caller is delegate", async () => {
        beforeEach(async () => {
          subjectCaller = offRamperDelegate;
        });

        it("should still revert", async () => {
          await expect(subject()).to.be.revertedWithCustomError(ramp, "OnlyDepositorCanSetDelegate");
        });
      });
    });

    describe("when the delegate is zero address", async () => {
      beforeEach(async () => {
        subjectDelegate = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DelegateCannotBeZeroAddress");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address  // Set delegate on creation
      );

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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "OnlyDepositorCanRemoveDelegate");
      });

      describe("when the caller is delegate", async () => {
        beforeEach(async () => {
          subjectCaller = offRamperDelegate;
        });

        it("should still revert", async () => {
          await expect(subject()).to.be.revertedWithCustomError(ramp, "OnlyDepositorCanRemoveDelegate");
        });
      });
    });

    describe("when no delegate is set", async () => {
      beforeEach(async () => {
        // First remove the delegate, then try to remove again
        await ramp.connect(offRamper.wallet).removeDepositDelegate(subjectDepositId);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "NoDelegateSetForDeposit");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: depositConversionRate }]
        ],
        offRamperDelegate.address
      );

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent"));

      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);

      await orchestratorMock.connect(owner.wallet).lockFunds(
        ZERO,
        intentHash,
        usdc(40),
        currentTimestamp.add(ONE_DAY_IN_SECONDS)
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
        const currentTimestamp = await blockchain.getCurrentTimestamp();
        intentHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent2"));

        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          intentHash2,
          usdc(50),
          currentTimestamp.add(ONE_DAY_IN_SECONDS.add(ONE_DAY_IN_SECONDS))
        );

        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());
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
    let subjectExpiryTime: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(60) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectDepositId = ZERO;
      subjectIntentHash = calculateIntentHash(
        onRamper.address,
        ramp.address,
        verifier.address,
        subjectDepositId,
        currentTimestamp
      );

      subjectAmount = usdc(30);
      subjectExpiryTime = currentTimestamp.add(ONE_DAY_IN_SECONDS);
      subjectCaller = owner;

      // Set the orchestrator mock as the orchestrator
      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);
    });

    async function subject(): Promise<any> {
      return orchestratorMock.connect(subjectCaller.wallet).lockFunds(
        subjectDepositId,
        subjectIntentHash,
        subjectAmount,
        subjectExpiryTime
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
      await subject();

      const intent = await ramp.getDepositIntent(subjectDepositId, subjectIntentHash);
      expect(intent.intentHash).to.eq(subjectIntentHash);
      expect(intent.amount).to.eq(subjectAmount);
      expect(intent.expiryTime).to.eq(subjectExpiryTime);
    });

    it("should add intent hash to deposit intent hashes", async () => {
      await subject();

      const intentHashes = await ramp.getDepositIntentHashes(subjectDepositId);
      expect(intentHashes).to.include(subjectIntentHash);
    });

    describe("when caller is not orchestrator", async () => {
      beforeEach(async () => {
        // remove the orchestrator mock
        await ramp.connect(owner.wallet).setOrchestrator(offRamper.address);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "OnlyOrchestratorCanCallThis");
      });
    });

    describe("when deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositDoesNotExist");
      });
    });

    describe("when deposit is not accepting intents", async () => {
      beforeEach(async () => {
        // Lock some funds on the deposit
        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          subjectIntentHash,
          usdc(30),
          (await blockchain.getCurrentTimestamp()).add(ONE_DAY_IN_SECONDS)
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountMustBeGreaterThanMinIntent");
      });
    });

    describe("when amount is greater than max intent amount", async () => {
      beforeEach(async () => {
        subjectAmount = usdc(70); // max is 60
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "AmountMustBeLessThanMaxIntent");
      });
    });

    describe("when there are expired intents and not enough liquidity", async () => {
      beforeEach(async () => {
        // First lock 50 USDC
        const firstIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent1"));
        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          firstIntentHash,
          usdc(50),
          (await blockchain.getCurrentTimestamp()).add(ONE_DAY_IN_SECONDS)
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
          usdc(50),
          (await blockchain.getCurrentTimestamp()).add(ONE_DAY_IN_SECONDS)
        );

        const secondIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent2"));
        await orchestratorMock.connect(owner.wallet).lockFunds(
          subjectDepositId,
          secondIntentHash,
          usdc(50),
          (await blockchain.getCurrentTimestamp()).add(ONE_DAY_IN_SECONDS)
        );

        // Try to lock more
        subjectAmount = usdc(30);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "NotEnoughLiquidity");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(50) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

      // Lock funds first
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectDepositId = ZERO;
      subjectIntentHash = calculateIntentHash(
        onRamper.address,
        ramp.address,
        verifier.address,
        subjectDepositId,
        currentTimestamp
      );
      intentAmount = usdc(30);
      intentExpiryTime = currentTimestamp.add(ONE_DAY_IN_SECONDS);

      // Set the orchestrator mock as the orchestrator
      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);

      await orchestratorMock.connect(owner.wallet).lockFunds(
        subjectDepositId,
        subjectIntentHash,
        intentAmount,
        intentExpiryTime
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

    describe("when caller is not orchestrator", async () => {
      beforeEach(async () => {
        // remove the orchestrator mock
        await ramp.connect(owner.wallet).setOrchestrator(offRamper.address);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "OnlyOrchestratorCanCallThis");
      });
    });

    describe("when deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositDoesNotExist");
      });
    });

    describe("when intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "IntentDoesNotExist");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(50) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

      // Lock funds first
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectDepositId = ZERO;
      subjectIntentHash = calculateIntentHash(
        onRamper.address,
        ramp.address,
        verifier.address,
        subjectDepositId,
        currentTimestamp
      );
      intentAmount = usdc(30);
      intentExpiryTime = currentTimestamp.add(ONE_DAY_IN_SECONDS);

      // Set the orchestrator mock as the orchestrator
      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);

      await orchestratorMock.connect(owner.wallet).lockFunds(
        subjectDepositId,
        subjectIntentHash,
        intentAmount,
        intentExpiryTime
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "TransferAmountCannotBeZero");
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "TransferAmountCannotBeGreaterThanIntentAmount");
      });
    });

    describe("when caller is not orchestrator", async () => {
      beforeEach(async () => {
        // remove the orchestrator mock
        await ramp.connect(owner.wallet).setOrchestrator(offRamper.address);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "OnlyOrchestratorCanCallThis");
      });
    });

    describe("when deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(999);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "DepositDoesNotExist");
      });
    });

    describe("when intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(ramp, "IntentDoesNotExist");
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
        ONE_DAY_IN_SECONDS,
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "OrchestratorCannotBeZeroAddress");
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
        await expect(subject()).to.be.revertedWithCustomError(ramp, "PaymentVerifierRegistryCannotBeZeroAddress");
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
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }],
        [
          [{ code: Currency.USD, minConversionRate: depositConversionRate }]
        ],
        offRamperDelegate.address
      );

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent"));

      await ramp.connect(owner.wallet).setOrchestrator(orchestratorMock.address);

      await orchestratorMock.connect(owner.wallet).lockFunds(
        ZERO,
        intentHash,
        usdc(50),
        currentTimestamp.add(ONE_DAY_IN_SECONDS)
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