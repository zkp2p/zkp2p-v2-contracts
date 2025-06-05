import "module-alias/register";

import { ethers } from "hardhat";

import {
  Address,
} from "@utils/types";
import { Account } from "@utils/test/types";
import {
  Escrow,
  EscrowViewer,
  IEscrow,
  USDCMock,
  PaymentVerifierMock,
  PostIntentHookMock
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
import { generateGatingServiceSignature } from "@utils/test/helpers";

const expect = getWaffleExpect();

const blockchain = new Blockchain(ethers.provider);

describe.only("Escrow", () => {
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
  let escrowViewer: EscrowViewer;
  let usdcToken: USDCMock;

  let verifier: PaymentVerifierMock;
  let otherVerifier: PaymentVerifierMock;
  let postIntentHookMock: PostIntentHookMock;
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

    await usdcToken.transfer(offRamper.address, usdc(10000));

    ramp = await deployer.deployEscrow(
      owner.address,
      ONE_DAY_IN_SECONDS,                // 1 day intent expiration period
      ZERO,                              // Sustainability fee
      feeRecipient.address,
      chainId
    );

    // Deploy EscrowViewer after escrow is deployed
    escrowViewer = await deployer.deployEscrowViewer(ramp.address);

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

    await ramp.addWhitelistedPaymentVerifier(verifier.address, ZERO);

    postIntentHookMock = await deployer.deployPostIntentHookMock(usdcToken.address, ramp.address);
  });

  describe("#constructor", async () => {
    it("should set the correct owner", async () => {
      const ownerAddress: Address = await ramp.owner();
      expect(ownerAddress).to.eq(owner.address);
    });

    it("should set the correct sustainability fee", async () => {
      const sustainabilityFee: BigNumber = await ramp.sustainabilityFee();
      expect(sustainabilityFee).to.eq(ZERO);
    });

    it("should set the correct sustainability fee recipient", async () => {
      const sustainabilityFeeRecipient: Address = await ramp.sustainabilityFeeRecipient();
      expect(sustainabilityFeeRecipient).to.eq(feeRecipient.address);
    });

    it.skip("should not exceed contract size limits", async () => {
      const escrowFactory = await ethers.getContractFactory("Escrow");
      const escrowViewerFactory = await ethers.getContractFactory("EscrowViewer");

      const escrowSize = (escrowFactory.bytecode.length - 2) / 2;
      const viewerSize = (escrowViewerFactory.bytecode.length - 2) / 2;

      console.log(`Escrow size: ${escrowSize} bytes`);
      console.log(`EscrowViewer size: ${viewerSize} bytes`);

      expect(escrowSize).to.be.lessThan(24576); // 24KB limit
      expect(viewerSize).to.be.lessThan(24576);
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
          { code: Currency.USD, conversionRate: ether(1.01) },
          { code: Currency.EUR, conversionRate: ether(0.95) }
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

      const depositView = await escrowViewer.getDeposit(0);

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
      expect(depositView.verifiers[0].currencies[0].conversionRate).to.eq(subjectCurrencies[0][0].conversionRate);
      expect(depositView.verifiers[0].currencies[1].code).to.eq(subjectCurrencies[0][1].code);
      expect(depositView.verifiers[0].currencies[1].conversionRate).to.eq(subjectCurrencies[0][1].conversionRate);
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

    it("should correctly update the depositCurrencyConversionRate mapping", async () => {
      await subject();

      const currencyConversionRate = await ramp.getDepositCurrencyConversionRate(0, subjectVerifiers[0], subjectCurrencies[0][0].code);
      expect(currencyConversionRate).to.eq(subjectCurrencies[0][0].conversionRate);

      const currencyConversionRate2 = await ramp.getDepositCurrencyConversionRate(0, subjectVerifiers[0], subjectCurrencies[0][1].code);
      expect(currencyConversionRate2).to.eq(subjectCurrencies[0][1].conversionRate);
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
      expect(events[0].args.conversionRate).to.equal(subjectCurrencies[0][0].conversionRate);

      // Second event  
      expect(events[1].args.depositId).to.equal(0);
      expect(events[1].args.verifier).to.equal(subjectVerifiers[0]);
      expect(events[1].args.currency).to.equal(subjectCurrencies[0][1].code);
      expect(events[1].args.conversionRate).to.equal(subjectCurrencies[0][1].conversionRate);
    });

    describe("when there are multiple verifiers", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).addWhitelistedPaymentVerifier(otherVerifier.address, ZERO);

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
            { code: Currency.USD, conversionRate: ether(1.01) },
            { code: Currency.EUR, conversionRate: ether(0.92) }
          ],
          [
            { code: Currency.USD, conversionRate: ether(1.02) }
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

        const currencyRate1_1 = await ramp.getDepositCurrencyConversionRate(0, subjectVerifiers[0], subjectCurrencies[0][0].code);
        expect(currencyRate1_1).to.eq(subjectCurrencies[0][0].conversionRate);
        const currencyRate1_2 = await ramp.getDepositCurrencyConversionRate(0, subjectVerifiers[0], subjectCurrencies[0][1].code);
        expect(currencyRate1_2).to.eq(subjectCurrencies[0][1].conversionRate);

        // Check second verifier
        const verificationData2 = await ramp.getDepositVerifierData(0, subjectVerifiers[1]);
        expect(verificationData2.intentGatingService).to.eq(subjectVerificationData[1].intentGatingService);
        expect(verificationData2.payeeDetails).to.eq(subjectVerificationData[1].payeeDetails);
        expect(verificationData2.data).to.eq(subjectVerificationData[1].data);

        const currencyRate2_1 = await ramp.getDepositCurrencyConversionRate(0, subjectVerifiers[1], subjectCurrencies[1][0].code);
        expect(currencyRate2_1).to.eq(subjectCurrencies[1][0].conversionRate);
      });
    });

    describe("when the intent amount range min is zero", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Min intent amount cannot be zero");
      });
    });

    describe("when the min intent amount is greater than max intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = usdc(2);
        subjectIntentAmountRange.max = usdc(1);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Min intent amount must be less than max intent amount");
      });
    });

    describe("when the amount is less than min intent amount", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = usdc(2);
        subjectAmount = usdc(1);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Amount must be greater than min intent amount");
      });
    });

    describe("when the length of the verifiers array is not equal to the length of the verifiersData array", async () => {
      beforeEach(async () => {
        subjectVerifiers = [verifier.address, otherVerifier.address];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Verifiers and depositVerifierData length mismatch");
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
        await expect(subject()).to.be.revertedWith("Verifiers and currencies length mismatch");
      });
    });

    describe("when the accepted currencies is not supported by the verifier", async () => {
      beforeEach(async () => {
        subjectCurrencies[0][0].code = Currency.AED;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency not supported by verifier");
      });
    });

    describe("when the conversion rate is zero", async () => {
      beforeEach(async () => {
        subjectCurrencies[0][0].conversionRate = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Conversion rate must be greater than 0");
      });
    });

    describe("when the verifier is zero address", async () => {
      beforeEach(async () => {
        subjectVerifiers = [ADDRESS_ZERO];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Verifier cannot be zero address");
      });
    });

    describe("when the verifier is not whitelisted", async () => {
      beforeEach(async () => {
        subjectVerifiers = [otherVerifier.address];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verifier not whitelisted");
      });

      describe("when accept all verifiers is true", async () => {
        beforeEach(async () => {
          await otherVerifier.addCurrency(Currency.EUR);
          await ramp.connect(owner.wallet).updateAcceptAllPaymentVerifiers(true);
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
        await expect(subject()).to.be.revertedWith("Payee details cannot be empty");
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
          [{ code: Currency.USD, conversionRate: ether(1.01) }],
          [{ code: Currency.EUR, conversionRate: ether(0.95) }]
        ]
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Verifier data already exists");
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
            { code: Currency.USD, conversionRate: ether(1.01) },
            { code: Currency.USD, conversionRate: ether(1.02) }
          ]
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency conversion rate already exists");
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

  describe("#signalIntent", async () => {
    let subjectDepositId: BigNumber;
    let subjectAmount: BigNumber;
    let subjectTo: Address;
    let subjectVerifier: Address;
    let subjectFiatCurrency: string;
    let subjectGatingServiceSignature: string;
    let subjectCaller: Account;
    let subjectPostIntentHook: Address;
    let subjectIntentData: string;

    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Create a deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      depositConversionRate = ether(1.01);
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
          [{ code: Currency.USD, conversionRate: depositConversionRate }]
        ],
        offRamperDelegate.address
      );

      subjectDepositId = ZERO;
      subjectAmount = usdc(50);
      subjectTo = receiver.address;
      subjectVerifier = verifier.address;
      subjectFiatCurrency = Currency.USD;
      subjectGatingServiceSignature = await generateGatingServiceSignature(
        gatingService,
        subjectDepositId,
        subjectAmount,
        subjectTo,
        subjectVerifier,
        subjectFiatCurrency,
        chainId.toString()
      );

      subjectPostIntentHook = ADDRESS_ZERO;
      subjectIntentData = "0x";

      subjectCaller = onRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).signalIntent(
        subjectDepositId,
        subjectAmount,
        subjectTo,
        subjectVerifier,
        subjectFiatCurrency,
        subjectGatingServiceSignature,
        subjectPostIntentHook,
        subjectIntentData
      );
    }

    it("should create the correct entry in the intents mapping", async () => {
      await subject();

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      const intentHash = calculateIntentHash(
        subjectCaller.address,
        subjectVerifier,
        subjectDepositId,
        currentTimestamp
      );

      const intent = await ramp.getIntent(intentHash);

      expect(intent.owner).to.eq(subjectCaller.address);
      expect(intent.paymentVerifier).to.eq(subjectVerifier);
      expect(intent.to).to.eq(subjectTo);
      expect(intent.depositId).to.eq(subjectDepositId);
      expect(intent.amount).to.eq(subjectAmount);
      expect(intent.timestamp).to.eq(currentTimestamp);
      expect(intent.fiatCurrency).to.eq(subjectFiatCurrency);
    });

    it("should have stored the correct conversion rate in the intent", async () => {
      await subject();
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      const intentHash = calculateIntentHash(
        subjectCaller.address,
        subjectVerifier,
        subjectDepositId,
        currentTimestamp
      );

      const depositConversionRate = await ramp.getDepositCurrencyConversionRate(subjectDepositId, subjectVerifier, subjectFiatCurrency);

      const intent = await ramp.getIntent(intentHash);
      expect(intent.conversionRate).to.eq(depositConversionRate);
    });

    it("should update the deposit mapping correctly", async () => {
      const preDeposit = await ramp.getDeposit(subjectDepositId);

      await subject();

      const intentHash = calculateIntentHash(
        subjectCaller.address,
        subjectVerifier,
        subjectDepositId,
        await blockchain.getCurrentTimestamp()
      );

      const postDeposit = await escrowViewer.getDeposit(subjectDepositId);

      expect(postDeposit.deposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.add(subjectAmount));
      expect(postDeposit.deposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.sub(subjectAmount));
      expect(postDeposit.deposit.intentHashes).to.include(intentHash);
    });

    it("should add the intent hash to the account's intents", async () => {
      await subject();

      const intentHash = calculateIntentHash(
        subjectCaller.address,
        subjectVerifier,
        subjectDepositId,
        await blockchain.getCurrentTimestamp()
      );

      const accountIntent = await escrowViewer.getAccountIntent(subjectCaller.address);
      expect(accountIntent.intentHash).to.eq(intentHash);
    });

    it.skip("should emit an IntentSignaled event", async () => {
      const txn = await subject();

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      const intentHash = calculateIntentHash(
        subjectCaller.address,
        subjectVerifier,
        subjectDepositId,
        currentTimestamp
      );

      await expect(txn).to.emit(ramp, "IntentSignaled").withArgs(
        intentHash,
        subjectDepositId,
        subjectVerifier,
        subjectCaller.address,
        subjectTo,
        subjectAmount,
        subjectFiatCurrency,
        depositConversionRate,
        currentTimestamp
      );
    });

    describe("when there aren't enough deposits to cover requested amount but there are prunable intents", async () => {
      let timeJump: number;
      let oldIntentHash: string;

      before(async () => {
        timeJump = ONE_DAY_IN_SECONDS.add(1).toNumber();
      });

      beforeEach(async () => {
        await subject();

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        oldIntentHash = calculateIntentHash(
          subjectCaller.address,
          subjectVerifier,
          subjectDepositId,
          currentTimestamp
        );

        await blockchain.increaseTimeAsync(timeJump);

        subjectAmount = usdc(60);
        subjectCaller = onRamperTwo;
        subjectGatingServiceSignature = await generateGatingServiceSignature(
          gatingService,
          subjectDepositId,
          subjectAmount,
          subjectTo,
          subjectVerifier,
          subjectFiatCurrency,
          chainId.toString()
        );
      });

      it("should prune the old intent and update the deposit mapping correctly", async () => {
        const preDeposit = await escrowViewer.getDeposit(subjectDepositId);

        await subject();

        const newIntentHash = calculateIntentHash(
          subjectCaller.address,
          subjectVerifier,
          subjectDepositId,
          await blockchain.getCurrentTimestamp()
        );

        const postDeposit = await escrowViewer.getDeposit(subjectDepositId);

        expect(postDeposit.deposit.outstandingIntentAmount).to.eq(subjectAmount);
        expect(postDeposit.deposit.remainingDeposits).to.eq(preDeposit.deposit.remainingDeposits.sub(usdc(10))); // 10 usdc difference between old and new intent
        expect(postDeposit.deposit.intentHashes).to.include(newIntentHash);
        expect(postDeposit.deposit.intentHashes).to.not.include(oldIntentHash);
      });

      it("should delete the original intent from the intents mapping", async () => {
        await subject();

        const intent = await ramp.getIntent(oldIntentHash);

        expect(intent.owner).to.eq(ADDRESS_ZERO);
        expect(intent.depositId).to.eq(ZERO);
      });

      it("should emit an IntentPruned event", async () => {
        await expect(subject()).to.emit(ramp, "IntentPruned").withArgs(
          oldIntentHash,
          subjectDepositId
        );
      });

      describe("when the reclaimable amount can't cover the new intent", async () => {
        before(async () => {
          timeJump = ONE_DAY_IN_SECONDS.div(2).toNumber();
        });

        after(async () => {
          timeJump = ONE_DAY_IN_SECONDS.add(1).toNumber();
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("Not enough liquidity");
        });
      });
    });

    describe("when the account has an unfulfilled intent", async () => {
      beforeEach(async () => {
        await subject();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Account has unfulfilled intent");
      });

      describe("when the intent is cancelled", async () => {
        beforeEach(async () => {
          const currentTimestamp = await blockchain.getCurrentTimestamp();
          const oldIntentHash = calculateIntentHash(
            subjectCaller.address,
            subjectVerifier,
            subjectDepositId,
            currentTimestamp
          );
          await ramp.connect(onRamper.wallet).cancelIntent(oldIntentHash);
        });

        it("should not revert", async () => {
          expect(await subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = BigNumber.from(10); // Non-existent deposit ID
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Deposit does not exist");
      });
    });

    describe("when the verifier is not supported", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address; // Not supported verifier
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verifier not supported");
      });
    });

    describe("when the fiat currency is not supported by the verifier", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.EUR;    // supported by verifier but not supported by deposit
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency not supported");
      });
    });

    describe("when the deposit is not accepting intents", async () => {
      beforeEach(async () => {
        // Create and signal an intent first to lock some liquidity
        await ramp.connect(onRamperOtherAddress.wallet).signalIntent(
          subjectDepositId,
          usdc(50),
          receiver.address,
          verifier.address,
          Currency.USD,
          await generateGatingServiceSignature(
            gatingService,
            subjectDepositId,
            usdc(50),
            receiver.address,
            verifier.address,
            Currency.USD,
            chainId.toString()
          ),
          ADDRESS_ZERO,
          "0x"
        );

        await ramp.connect(offRamper.wallet).withdrawDeposit(subjectDepositId);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Deposit is not accepting intents");
      });
    });

    describe("when the amount is less than the minimum intent amount", async () => {
      beforeEach(async () => {
        subjectAmount = usdc(5); // Less than minimum intent amount
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Signaled amount must be greater than min intent amount");
      });
    });

    describe("when the amount is more than the maximum intent amount", async () => {
      beforeEach(async () => {
        subjectAmount = usdc(250); // More than maximum intent amount
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Signaled amount must be less than max intent amount");
      });
    });

    describe("when the to address is zero", async () => {
      beforeEach(async () => {
        subjectTo = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Cannot send to zero address");
      });
    });

    describe("when the gating service signature is invalid", async () => {
      beforeEach(async () => {
        subjectGatingServiceSignature = "0x"; // Invalid signature
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid gating service signature");
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

  describe("#fulfillIntent", async () => {
    let subjectProof: string;
    let subjectIntentHash: string;
    let subjectCaller: Account;
    let subjectFulfillIntentData: string; // Added for clarity

    let intentHash: string;
    let payeeDetails: string;

    beforeEach(async () => {
      // Create a deposit and signal an intent first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      payeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails"));
      const depositData = ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [witness.address]
      );

      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          payeeDetails: payeeDetails,
          data: depositData
        }],
        [
          [{ code: Currency.USD, conversionRate: ether(1.08) }]
        ],
        offRamperDelegate.address
      );

      const gatingServiceSignature = await generateGatingServiceSignature(
        gatingService,
        ZERO,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        chainId.toString()
      );
      await ramp.connect(onRamper.wallet).signalIntent(
        ZERO, // depositId
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        gatingServiceSignature,
        ADDRESS_ZERO,
        "0x"
      );
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      intentHash = calculateIntentHash(onRamper.address, verifier.address, ZERO, currentTimestamp);

      // Set the verifier to verify payment
      await verifier.setShouldVerifyPayment(true);

      // Prepare the proof and processor for the onRamp function
      subjectProof = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "string", "bytes32", "bytes32"],
        [usdc(50), currentTimestamp, payeeDetails, Currency.USD, intentHash]
      );
      subjectIntentHash = intentHash;
      subjectCaller = onRamper;
      subjectFulfillIntentData = "0x"; // Default to empty data for existing tests
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).fulfillIntent(
        subjectProof,
        subjectIntentHash,
        subjectFulfillIntentData // Added
      );
    }

    it("should transfer the correct amount to the on-ramper", async () => {
      const initialBalance = await usdcToken.balanceOf(onRamper.address);

      await subject();

      const finalBalance = await usdcToken.balanceOf(onRamper.address);
      expect(finalBalance.sub(initialBalance)).to.eq(usdc(50));
    });

    it("should prune the intent", async () => {
      await subject();

      const intent = await ramp.getIntent(subjectIntentHash);

      expect(intent.owner).to.eq(ADDRESS_ZERO); // Intent should be deleted
    });

    it("should update the deposit balances correctly", async () => {
      const preDeposit = await ramp.getDeposit(ZERO);

      await subject();

      const postDeposit = await ramp.getDeposit(ZERO);
      expect(postDeposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.sub(usdc(50)));
    });

    it("should emit an IntentFulfilled event", async () => {
      await expect(subject()).to.emit(ramp, "IntentFulfilled").withArgs(
        intentHash,
        ZERO,
        verifier.address,
        onRamper.address,
        onRamper.address,
        usdc(50),
        0,
        0
      );
    });

    describe("when the conversion rate is updated by depositor", async () => {
      beforeEach(async () => {
        await ramp.connect(offRamper.wallet).updateDepositConversionRate(ZERO, verifier.address, Currency.USD, ether(1.09));
      });

      it("should still transfer the correct amount to the on-ramper", async () => {
        const initialBalance = await usdcToken.balanceOf(onRamper.address);

        await subject();

        const finalBalance = await usdcToken.balanceOf(onRamper.address);
        expect(finalBalance.sub(initialBalance)).to.eq(usdc(50));
      });

      it("should update the deposit balances correctly", async () => {
        const preDeposit = await ramp.getDeposit(ZERO);

        await subject();

        const postDeposit = await ramp.getDeposit(ZERO);
        expect(postDeposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.sub(usdc(50)));
      });
    });

    describe("when the sustainability fee is set", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).setSustainabilityFee(ether(0.02)); // 2% fee
      });

      it("should transfer the correct amounts including fee", async () => {
        const initialOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        await subject();

        const finalOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        const fee = usdc(50).mul(ether(0.02)).div(ether(1)); // 2% of 50 USDC
        expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(usdc(50).sub(fee));
        expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(fee);
      });

      it("should emit an IntentFulfilled event with fee details", async () => {
        const fee = usdc(50).mul(ether(0.02)).div(ether(1)); // 2% of 50 USDC

        await expect(subject()).to.emit(ramp, "IntentFulfilled").withArgs(
          intentHash,
          ZERO,
          verifier.address,
          onRamper.address,
          onRamper.address,
          usdc(49),
          fee,
          0 // Assuming no verifier fee
        );
      });

      describe("when the verifier fee share is set", async () => {
        beforeEach(async () => {
          await ramp.connect(owner.wallet).updatePaymentVerifierFeeShare(verifier.address, ether(0.3)); // 30% of total fee
        });

        it("should transfer the correct amounts including both fees", async () => {
          const initialOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
          const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const initialVerifierBalance = await usdcToken.balanceOf(verifier.address);

          await subject();

          const finalOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
          const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const finalVerifierBalance = await usdcToken.balanceOf(verifier.address);

          const totalFee = usdc(50).mul(ether(0.02)).div(ether(1)); // 2% of 50 USDC
          const verifierFee = totalFee.mul(ether(0.3)).div(ether(1)); // 30% of total fee

          expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(usdc(50).sub(totalFee));
          expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(totalFee.sub(verifierFee));
          expect(finalVerifierBalance.sub(initialVerifierBalance)).to.eq(verifierFee);
        });

        it("should emit an IntentFulfilled event with both fee details", async () => {
          const totalFee = usdc(50).mul(ether(0.02)).div(ether(1)); // 2% of 50 USDC
          const verifierFee = totalFee.mul(ether(0.3)).div(ether(1)); // 30% of total fee

          await expect(subject()).to.emit(ramp, "IntentFulfilled").withArgs(
            intentHash,
            ZERO,
            verifier.address,
            onRamper.address,
            onRamper.address,
            usdc(50).sub(totalFee),
            totalFee.sub(verifierFee),
            verifierFee
          );
        });
      });
    });

    describe("when the intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("invalid"));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Intent does not exist");
      });
    });

    describe("when the intent hash is invalid", async () => {
      beforeEach(async () => {
        const currentTimestamp = await blockchain.getCurrentTimestamp();

        subjectIntentHash = intentHash;
        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "string", "bytes32", "bytes32"],
          [usdc(50), currentTimestamp, payeeDetails, Currency.USD, ZERO_BYTES32]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid intent hash");
      });
    });

    describe("when the payment is invalid", async () => {
      beforeEach(async () => {
        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "string", "string", "bytes32"],
          [usdc(40), await blockchain.getCurrentTimestamp(), payeeDetails, Currency.USD, intentHash]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment amount is less than intent amount");
      });
    });

    describe("when the payment verification fails", async () => {
      beforeEach(async () => {
        await verifier.setShouldReturnFalse(true);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verification failed");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).pauseEscrow();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });

      describe("when the escrow is unpaused", async () => {
        beforeEach(async () => {
          await ramp.connect(owner.wallet).unpauseEscrow();
        });

        it("should revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when a postIntentHook is used", async () => {
      let hookTargetAddress: Address;

      beforeEach(async () => {
        hookTargetAddress = receiver.address;
        const signalIntentDataForHook = ethers.utils.defaultAbiCoder.encode(["address"], [hookTargetAddress]);

        // Create a new intent with post intent hook action
        const gatingServiceSignatureForHook = await generateGatingServiceSignature(
          gatingService,
          ZERO,
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          chainId.toString()
        );

        // First cancle the existing intent
        await ramp.connect(onRamper.wallet).cancelIntent(intentHash);

        // Signal an intent that uses the postIntentHookMock
        await ramp.connect(onRamper.wallet).signalIntent(
          ZERO,
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          gatingServiceSignatureForHook,
          postIntentHookMock.address,
          signalIntentDataForHook
        );
        const currentTimestamp = await blockchain.getCurrentTimestamp();
        intentHash = calculateIntentHash(onRamper.address, verifier.address, ZERO, currentTimestamp);

        // Set the verifier to verify payment
        await verifier.setShouldVerifyPayment(true);

        // Prepare the proof and processor for the onRamp function
        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "string", "bytes32", "bytes32"],
          [usdc(50), currentTimestamp, payeeDetails, Currency.USD, intentHash]
        );
        subjectIntentHash = intentHash;
        subjectCaller = onRamper;
        subjectFulfillIntentData = "0x"; // Still keep it empty
      });

      it("should transfer funds to the hook's target address, not the intent.to address", async () => {
        const initialTargetAddressBalance = await usdcToken.balanceOf(hookTargetAddress);
        const initialIntentToBalance = await usdcToken.balanceOf(onRamper.address);
        const initialEscrowBalance = await usdcToken.balanceOf(ramp.address);

        await subject();

        const finalTargetAddressBalance = await usdcToken.balanceOf(hookTargetAddress);
        const finalIntentToBalance = await usdcToken.balanceOf(onRamper.address);
        const finalEscrowBalance = await usdcToken.balanceOf(ramp.address);

        expect(finalTargetAddressBalance.sub(initialTargetAddressBalance)).to.eq(usdc(50));
        expect(finalIntentToBalance.sub(initialIntentToBalance)).to.eq(ZERO); // onRamper should not receive funds directly
        expect(initialEscrowBalance.sub(finalEscrowBalance)).to.eq(usdc(50)); // Escrow pays out the 50 USDC
      });

      it("should emit IntentFulfilled event with original intent.to address but funds routed by hook", async () => {
        await expect(subject()).to.emit(ramp, "IntentFulfilled").withArgs(
          subjectIntentHash,    // Hash of the intent fulfilled
          ZERO,    // ID of the deposit used
          verifier.address,     // Verifier used
          onRamper.address,     // Intent owner
          onRamper.address,     // Original intent.to (even though hook redirected funds)
          usdc(50),             // Amount transferred (after 0 fees in this case)
          ZERO,                 // Sustainability fee
          ZERO                  // Verifier fee
        );
      });

      describe("when sustainability fee is set with a hook", async () => {
        beforeEach(async () => {
          await ramp.connect(owner.wallet).setSustainabilityFee(ether(0.02)); // 2% fee
        });

        it("should transfer (intent amount - fee) to hook's target and fee to recipient", async () => {
          const initialHookTargetBalance = await usdcToken.balanceOf(hookTargetAddress);
          const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const initialEscrowBalance = await usdcToken.balanceOf(ramp.address);

          await subject();

          const finalHookTargetBalance = await usdcToken.balanceOf(hookTargetAddress);
          const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const finalEscrowBalance = await usdcToken.balanceOf(ramp.address);

          const fee = usdc(50).mul(ether(0.02)).div(ether(1)); // 2% of 50 USDC = 1 USDC
          expect(finalHookTargetBalance.sub(initialHookTargetBalance)).to.eq(usdc(50).sub(fee)); // 49 USDC
          expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(fee); // 1 USDC
          expect(initialEscrowBalance.sub(finalEscrowBalance)).to.eq(usdc(50)); // Escrow still pays out total of 50
        });

        it("should emit IntentFulfilled with correct fee details when hook is used", async () => {
          const fee = usdc(50).mul(ether(0.02)).div(ether(1));
          await expect(subject()).to.emit(ramp, "IntentFulfilled").withArgs(
            subjectIntentHash,
            ZERO,
            verifier.address,
            onRamper.address,
            onRamper.address,     // Original intent.to
            usdc(50).sub(fee),    // Amount transferred to hook's destination
            fee,                  // Sustainability fee
            ZERO                  // Verifier fee
          );
        });
      });
    });
  });

  describe("#releaseFundsToPayer", async () => {
    let subjectIntentHash: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create a deposit and signal an intent first
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
          [{ code: Currency.USD, conversionRate: ether(1.08) }]
        ],
        offRamperDelegate.address
      );

      // Signal an intent
      const gatingServiceSignature = await generateGatingServiceSignature(
        gatingService,
        ZERO, usdc(50), receiver.address, verifier.address, Currency.USD, chainId.toString()
      );
      await ramp.connect(onRamper.wallet).signalIntent(
        ZERO,
        usdc(50),
        receiver.address,
        verifier.address,
        Currency.USD,
        gatingServiceSignature,
        ADDRESS_ZERO,
        "0x"
      );

      // Calculate the intent hash
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectIntentHash = calculateIntentHash(
        onRamper.address,
        verifier.address,
        ZERO,
        currentTimestamp
      );

      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).releaseFundsToPayer(subjectIntentHash);
    }

    it("should transfer the usdc correctly to the payer", async () => {
      const receiverPreBalance = await usdcToken.balanceOf(receiver.address);
      const rampPreBalance = await usdcToken.balanceOf(ramp.address);

      await subject();

      const receiverPostBalance = await usdcToken.balanceOf(receiver.address);
      const rampPostBalance = await usdcToken.balanceOf(ramp.address);

      expect(receiverPostBalance).to.eq(receiverPreBalance.add(usdc(50)));
      expect(rampPostBalance).to.eq(rampPreBalance.sub(usdc(50)));
    });

    it("should delete the intent from the intents mapping", async () => {
      await subject();

      const intent = await ramp.getIntent(subjectIntentHash);

      expect(intent.owner).to.eq(ADDRESS_ZERO);
      expect(intent.amount).to.eq(ZERO);
    });

    it("should correctly update state in the deposit mapping", async () => {
      const preDeposit = await escrowViewer.getDeposit(ZERO);

      await subject();

      const postDeposit = await escrowViewer.getDeposit(ZERO);

      expect(postDeposit.deposit.remainingDeposits).to.eq(preDeposit.deposit.remainingDeposits);
      expect(postDeposit.deposit.outstandingIntentAmount).to.eq(preDeposit.deposit.outstandingIntentAmount.sub(usdc(50)));
      expect(postDeposit.deposit.intentHashes).to.not.include(subjectIntentHash);
    });

    it("should emit a IntentFulfilled event", async () => {
      await expect(subject()).to.emit(ramp, "IntentFulfilled").withArgs(
        subjectIntentHash,
        ZERO,
        ADDRESS_ZERO,   // cause manual release of funds
        onRamper.address,
        receiver.address,
        usdc(50),
        0,
        0
      );
    });

    describe("when the intent zeroes out the deposit", async () => {
      beforeEach(async () => {
        await subject();    // Release $50 to the payer; And then signal a new intent for $50

        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(10).toNumber());

        const gatingServiceSignature = await generateGatingServiceSignature(
          gatingService,
          ZERO, usdc(50), receiver.address, verifier.address, Currency.USD, chainId.toString()
        );
        await ramp.connect(onRamper.wallet).signalIntent(
          ZERO,
          usdc(50),
          receiver.address,
          verifier.address,
          Currency.USD,
          gatingServiceSignature,
          ADDRESS_ZERO,
          "0x"
        );

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        subjectIntentHash = calculateIntentHash(
          onRamper.address,
          verifier.address,
          ZERO,
          currentTimestamp
        );
      });

      it("should delete the deposit", async () => {
        await subject();

        const deposit = await ramp.getDeposit(ZERO);
        expect(deposit.depositor).to.eq(ADDRESS_ZERO);
      });

      it("should delete the deposit verifier data", async () => {
        await subject();

        const verifierData = await ramp.getDepositVerifierData(ZERO, verifier.address);
        expect(verifierData.intentGatingService).to.eq(ADDRESS_ZERO);
      });

      it("should delete deposit currency conversion data", async () => {
        await subject();

        const currencyConversionData = await ramp.getDepositCurrencyConversionRate(ZERO, verifier.address, Currency.USD);
        expect(currencyConversionData).to.eq(ZERO);
      });

      it("should emit a DepositClosed event", async () => {
        await expect(subject()).to.emit(ramp, "DepositClosed").withArgs(
          ZERO,
          offRamper.address
        );
      });
    });

    describe("when the sustainability fee is set", async () => {
      beforeEach(async () => {
        await ramp.connect(owner.wallet).setSustainabilityFee(ether(0.02)); // 2% fee
      });

      it("should transfer the correct amounts including fee", async () => {
        const initialOnRamperBalance = await usdcToken.balanceOf(receiver.address);
        const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        await subject();

        const finalOnRamperBalance = await usdcToken.balanceOf(receiver.address);
        const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        const fee = usdc(50).mul(ether(0.02)).div(ether(1)); // 2% of 50 USDC
        expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(usdc(50).sub(fee));
        expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(fee);
      });

      it("should emit an IntentFulfilled event with fee details", async () => {
        const fee = usdc(50).mul(ether(0.02)).div(ether(1)); // 2% of 50 USDC

        await expect(subject()).to.emit(ramp, "IntentFulfilled").withArgs(
          subjectIntentHash,
          ZERO,
          ADDRESS_ZERO,
          onRamper.address,
          receiver.address,
          usdc(49),
          fee,
          0 // Assuming no verifier fee
        );
      });

      describe("when the verifier fee share is set", async () => {
        beforeEach(async () => {
          await ramp.connect(owner.wallet).updatePaymentVerifierFeeShare(verifier.address, ether(0.3)); // 30% of total fee
        });

        it("should still not transfer the verifier fee", async () => {
          const initialOnRamperBalance = await usdcToken.balanceOf(receiver.address);
          const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const initialVerifierBalance = await usdcToken.balanceOf(verifier.address);

          await subject();

          const finalOnRamperBalance = await usdcToken.balanceOf(receiver.address);
          const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const finalVerifierBalance = await usdcToken.balanceOf(verifier.address);

          const totalFee = usdc(50).mul(ether(0.02)).div(ether(1)); // 2% of 50 USDC
          const verifierFee = totalFee.mul(ether(0.3)).div(ether(1)); // 30% of total fee

          expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(usdc(50).sub(totalFee));
          expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(totalFee);
          expect(finalVerifierBalance.sub(initialVerifierBalance)).to.eq(ZERO);
        });

        it("should emit an IntentFulfilled event with both fee details", async () => {
          const totalFee = usdc(50).mul(ether(0.02)).div(ether(1)); // 2% of 50 USDC

          await expect(subject()).to.emit(ramp, "IntentFulfilled").withArgs(
            subjectIntentHash,
            ZERO,
            ADDRESS_ZERO,
            onRamper.address,
            receiver.address,
            usdc(50).sub(totalFee),
            totalFee,
            ZERO
          );
        });
      });
    });


    describe("when the intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("invalid"));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Intent does not exist");
      });
    });

    describe("when the sender is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Caller must be the depositor");
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

  describe("#cancelIntent", async () => {
    let subjectIntentHash: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create a deposit and signal an intent first
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
          [{ code: Currency.USD, conversionRate: ether(1.08) }]
        ],
        offRamperDelegate.address
      );

      // Signal an intent
      const gatingServiceSignature = await generateGatingServiceSignature(
        gatingService,
        ZERO, usdc(50), onRamper.address, verifier.address, Currency.USD, chainId.toString()
      );
      await ramp.connect(onRamper.wallet).signalIntent(
        ZERO, // depositId
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        gatingServiceSignature,
        ADDRESS_ZERO,
        "0x"
      );

      // Calculate the intent hash
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectIntentHash = calculateIntentHash(
        onRamper.address,
        verifier.address,
        ZERO,
        currentTimestamp
      );

      subjectCaller = onRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).cancelIntent(subjectIntentHash);
    }

    it("should cancel the intent and update the deposit correctly", async () => {
      const preDeposit = await ramp.getDeposit(ZERO);

      await subject();

      const postDeposit = await ramp.getDeposit(ZERO);
      const intent = await ramp.getIntent(subjectIntentHash);

      expect(intent.owner).to.eq(ADDRESS_ZERO); // Intent should be deleted
      expect(postDeposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.sub(usdc(50)));
      expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.add(usdc(50)));
    });

    it("should remove the intent from the accountIntents mapping", async () => {
      await subject();

      const accountIntent = await escrowViewer.getAccountIntent(onRamper.address);

      expect(accountIntent.intentHash).to.eq(ZERO_BYTES32);
    });

    it("should revert if the intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.formatBytes32String("nonexistent");
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Intent does not exist");
      });
    });

    describe("when the caller is not the intent owner", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Sender must be the intent owner");
      });
    });

    describe("when the intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.formatBytes32String("nonexistent");
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Intent does not exist");
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

  describe("#updateDepositConversionRate", async () => {
    let subjectDepositId: BigNumber;
    let subjectVerifier: Address;
    let subjectFiatCurrency: string;
    let subjectNewConversionRate: BigNumber;
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
          [{ code: Currency.USD, conversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

      subjectDepositId = ZERO;
      subjectVerifier = verifier.address;
      subjectFiatCurrency = Currency.USD;
      subjectNewConversionRate = ether(1.05);
      subjectCaller = offRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).updateDepositConversionRate(
        subjectDepositId,
        subjectVerifier,
        subjectFiatCurrency,
        subjectNewConversionRate
      );
    }

    it("should update the conversion rate", async () => {
      await subject();

      const newRate = await ramp.getDepositCurrencyConversionRate(
        subjectDepositId,
        subjectVerifier,
        subjectFiatCurrency
      );
      expect(newRate).to.eq(subjectNewConversionRate);
    });

    it("should emit a DepositConversionRateUpdated event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "DepositConversionRateUpdated").withArgs(
        subjectDepositId,
        subjectVerifier,
        subjectFiatCurrency,
        subjectNewConversionRate
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
        await expect(subject()).to.be.revertedWith("Caller must be the depositor or delegate");
      });
    });

    describe("when the currency or verifier is not supported", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.EUR;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency or verifier not supported");
      });
    });

    describe("when the new conversion rate is zero", async () => {
      beforeEach(async () => {
        subjectNewConversionRate = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Conversion rate must be greater than 0");
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

    beforeEach(async () => {
      // Create deposit to test withdrawal
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
          [{ code: Currency.USD, conversionRate: ether(1.08) }]
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
      const preUserDeposits = await escrowViewer.getAccountDeposits(offRamper.address);
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

    it("should delete deposit currency conversion data", async () => {
      const preCurrencyConversionData = await ramp.getDepositCurrencyConversionRate(subjectDepositId, verifier.address, Currency.USD);
      expect(preCurrencyConversionData).to.not.eq(ZERO);

      await subject();

      const postCurrencyConversionData = await ramp.getDepositCurrencyConversionRate(subjectDepositId, verifier.address, Currency.USD);
      expect(postCurrencyConversionData).to.eq(ZERO);
    });

    it("should emit a DepositWithdrawn event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "DepositWithdrawn").withArgs(
        subjectDepositId,
        offRamper.address,
        usdc(100)
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
          chainId.toString()
        );

        await ramp.connect(onRamper.wallet).signalIntent(
          subjectDepositId,
          usdc(50),
          receiver.address,
          verifier.address,
          Currency.USD,
          gatingServiceSignature,
          ADDRESS_ZERO,
          "0x"
        );

        // Calculate the intent hash
        const currentTimestamp = await blockchain.getCurrentTimestamp();
        intentHash = calculateIntentHash(
          onRamper.address,
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
          usdc(50)
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
          const preIntent = await ramp.getIntent(intentHash);
          expect(preIntent.amount).to.eq(usdc(50));

          await subject();

          const postIntent = await ramp.getIntent(intentHash);

          expect(postIntent.owner).to.eq(ADDRESS_ZERO);
        });

        it("should emit DepositWithdrawn event", async () => {
          const tx = await subject();

          expect(tx).to.emit(ramp, "DepositWithdrawn").withArgs(
            subjectDepositId,
            offRamper.address,
            usdc(100)
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
        await expect(subject()).to.be.revertedWith("Caller must be the depositor");
      });

      describe("when the caller is delegate", async () => {
        beforeEach(async () => {
          subjectCaller = offRamperDelegate;
        });

        it("should still revert", async () => {
          await expect(subject()).to.be.revertedWith("Caller must be the depositor");
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

  // GOVERNANCE FUNCTIONS

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

  describe("#addWhitelistedPaymentVerifier", async () => {
    let subjectVerifier: Address;
    let subjectFeeShare: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectVerifier = otherVerifier.address;
      subjectFeeShare = ether(0.1); // 10% fee share
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).addWhitelistedPaymentVerifier(subjectVerifier, subjectFeeShare);
    }

    it("should add the verifier to the whitelist", async () => {
      await subject();

      const isWhitelisted = await ramp.whitelistedPaymentVerifiers(subjectVerifier);
      expect(isWhitelisted).to.be.true;
    });

    it("should set the correct fee share", async () => {
      await subject();

      const feeShare = await ramp.paymentVerifierFeeShare(subjectVerifier);
      expect(feeShare).to.eq(subjectFeeShare);
    });

    it("should emit a PaymentVerifierAdded event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "PaymentVerifierAdded").withArgs(subjectVerifier, subjectFeeShare);
    });

    describe("when the verifier is the zero address", async () => {
      beforeEach(async () => {
        subjectVerifier = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verifier cannot be zero address");
      });
    });

    describe("when the verifier is already whitelisted", async () => {
      beforeEach(async () => {
        subjectVerifier = verifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verifier already whitelisted");
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

  describe("#removeWhitelistedPaymentVerifier", async () => {
    let subjectVerifier: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectVerifier = verifier.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).removeWhitelistedPaymentVerifier(subjectVerifier);
    }

    it("should remove the verifier from the whitelist", async () => {
      await subject();

      const isWhitelisted = await ramp.whitelistedPaymentVerifiers(subjectVerifier);
      expect(isWhitelisted).to.be.false;
    });

    it("should emit a PaymentVerifierRemoved event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "PaymentVerifierRemoved").withArgs(subjectVerifier);
    });

    describe("when the verifier is not whitelisted", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verifier not whitelisted");
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

  describe("#updatePaymentVerifierFeeShare", async () => {
    let subjectVerifier: Address;
    let subjectFeeShare: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectVerifier = verifier.address;
      subjectFeeShare = ether(0.2); // 20% fee share
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).updatePaymentVerifierFeeShare(subjectVerifier, subjectFeeShare);
    }

    it("should update the fee share", async () => {
      await subject();

      const feeShare = await ramp.paymentVerifierFeeShare(subjectVerifier);
      expect(feeShare).to.eq(subjectFeeShare);
    });

    it("should emit a PaymentVerifierFeeShareUpdated event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "PaymentVerifierFeeShareUpdated").withArgs(subjectVerifier, subjectFeeShare);
    });

    describe("when the verifier is not whitelisted", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verifier not whitelisted");
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

  describe("#updateAcceptAllPaymentVerifiers", async () => {
    let subjectAcceptAll: boolean;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectAcceptAll = true;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).updateAcceptAllPaymentVerifiers(subjectAcceptAll);
    }

    it("should update the accept all payment verifiers flag", async () => {
      await subject();

      const acceptAll = await ramp.acceptAllPaymentVerifiers();
      expect(acceptAll).to.eq(subjectAcceptAll);
    });

    it("should emit an AcceptAllPaymentVerifiersUpdated event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "AcceptAllPaymentVerifiersUpdated").withArgs(subjectAcceptAll);
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

    it("should emit a IntentExpirationPeriodSet event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "IntentExpirationPeriodSet").withArgs(subjectIntentExpirationPeriod);
    });

    describe("when the intent expiration period is 0", async () => {
      beforeEach(async () => {
        subjectIntentExpirationPeriod = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Max intent expiration period cannot be zero");
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

  describe("#setSustainabilityFee", async () => {
    let subjectSustainabilityFee: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectSustainabilityFee = ether(.002);
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setSustainabilityFee(subjectSustainabilityFee);
    }

    it("should set the correct sustainability fee", async () => {
      const preSustainabilityFee = await ramp.sustainabilityFee();

      expect(preSustainabilityFee).to.eq(ZERO);

      await subject();

      const postSustainabilityFee = await ramp.sustainabilityFee();

      expect(postSustainabilityFee).to.eq(subjectSustainabilityFee);
    });

    it("should emit a SustainabilityFeeUpdated event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "SustainabilityFeeUpdated").withArgs(subjectSustainabilityFee);
    });

    describe("when the fee exceeds the max sustainability fee", async () => {
      beforeEach(async () => {
        subjectSustainabilityFee = ether(.1);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Fee cannot be greater than max fee");
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

  describe("#setSustainabilityFeeRecipient", async () => {
    let subjectSustainabilityFeeRecipient: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectSustainabilityFeeRecipient = owner.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).setSustainabilityFeeRecipient(subjectSustainabilityFeeRecipient);
    }

    it("should set the correct sustainability fee recipient", async () => {
      const preSustainabilityFeeRecipient = await ramp.sustainabilityFeeRecipient();

      expect(preSustainabilityFeeRecipient).to.eq(feeRecipient.address);

      await subject();

      const postSustainabilityFeeRecipient = await ramp.sustainabilityFeeRecipient();

      expect(postSustainabilityFeeRecipient).to.eq(subjectSustainabilityFeeRecipient);
    });

    it("should emit a SustainabilityFeeRecipientUpdated event", async () => {
      const tx = await subject();

      expect(tx).to.emit(ramp, "SustainabilityFeeRecipientUpdated").withArgs(subjectSustainabilityFeeRecipient);
    });

    describe("when the passed fee recipient is the zero address", async () => {
      beforeEach(async () => {
        subjectSustainabilityFeeRecipient = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Fee recipient cannot be zero address");
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

  describe("#getPrunableIntents", async () => {
    let subjectCaller: Account;
    let subjectDepositId: BigNumber;

    beforeEach(async () => {
      // Create deposit and signal intent first
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
          [{ code: Currency.USD, conversionRate: ether(1.08) }]
        ],
        offRamperDelegate.address
      );

      const gatingServiceSignature = await generateGatingServiceSignature(
        gatingService,
        ZERO,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        chainId.toString()
      );

      await ramp.connect(onRamper.wallet).signalIntent(
        ZERO,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        gatingServiceSignature,
        ADDRESS_ZERO,
        "0x"
      );

      subjectCaller = onRamper;
      subjectDepositId = ZERO;
    });

    async function subject(): Promise<{ prunableIntents: string[], reclaimedAmount: BigNumber }> {
      return ramp.connect(subjectCaller.wallet).getPrunableIntents(subjectDepositId);
    }

    describe("when timestamp is before intent expiry", async () => {
      it("should return empty array", async () => {
        const { prunableIntents, reclaimedAmount } = await subject();
        expect(prunableIntents.length).to.eq(1);
        expect(reclaimedAmount).to.eq(ZERO);
      });
    });

    describe("when timestamp is after intent expiry", async () => {
      it("should return prunable intents", async () => {
        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());

        const { prunableIntents, reclaimedAmount } = await subject();

        expect(prunableIntents.length).to.eq(1);
        expect(reclaimedAmount).to.eq(usdc(50));
      });
    });

    describe("when there are no intents", async () => {
      beforeEach(async () => {
        await ramp.connect(onRamper.wallet).cancelIntent(
          calculateIntentHash(
            onRamper.address,
            verifier.address,
            ZERO,
            await blockchain.getCurrentTimestamp()
          )
        );
      });

      it("should return empty array", async () => {
        const { prunableIntents, reclaimedAmount } = await subject();
        expect(prunableIntents.length).to.eq(0);
        expect(reclaimedAmount).to.eq(ZERO);
      });
    });
  });

  // DEPOSIT MANAGEMENT FUNCTIONS

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
          [{ code: Currency.USD, conversionRate: ether(1.01) }]
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
        await expect(subject()).to.be.revertedWith("Caller must be the depositor or delegate");
      });
    });

    describe("when the min amount is zero", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange.min = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Min cannot be zero");
      });
    });

    describe("when the min amount is greater than max amount", async () => {
      beforeEach(async () => {
        subjectIntentAmountRange = { min: usdc(200), max: usdc(100) };
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Min must be less than max");
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
          [{ code: Currency.USD, conversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

      // Add otherVerifier to whitelist
      await ramp.connect(owner.wallet).addWhitelistedPaymentVerifier(otherVerifier.address, ZERO);
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
          { code: Currency.USD, conversionRate: ether(1.02) },
          { code: Currency.EUR, conversionRate: ether(0.95) }
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

      const usdRate = await ramp.getDepositCurrencyConversionRate(subjectDepositId, otherVerifier.address, Currency.USD);
      expect(usdRate).to.eq(subjectCurrencies[0][0].conversionRate);

      const eurRate = await ramp.getDepositCurrencyConversionRate(subjectDepositId, otherVerifier.address, Currency.EUR);
      expect(eurRate).to.eq(subjectCurrencies[0][1].conversionRate);
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
        await expect(subject()).to.be.revertedWith("Caller must be the depositor or delegate");
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
        await expect(subject()).to.be.revertedWith("Payment verifier not whitelisted");
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
      await ramp.connect(owner.wallet).addWhitelistedPaymentVerifier(otherVerifier.address, ZERO);

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
          [{ code: Currency.USD, conversionRate: ether(1.01) }],
          [{ code: Currency.USD, conversionRate: ether(1.02) }]
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

      const conversionRate = await ramp.getDepositCurrencyConversionRate(subjectDepositId, subjectVerifier, Currency.USD);
      expect(conversionRate).to.eq(ZERO);
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
        await expect(subject()).to.be.revertedWith("Caller must be the depositor or delegate");
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
        await expect(subject()).to.be.revertedWith("Verifier not found for deposit");
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
          [{ code: Currency.USD, conversionRate: ether(1.01) }]
        ],
        offRamperDelegate.address
      );

      subjectDepositId = ZERO;
      subjectVerifier = verifier.address;
      subjectCurrencies = [
        { code: Currency.EUR, conversionRate: ether(0.95) }
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

      const conversionRate = await ramp.getDepositCurrencyConversionRate(subjectDepositId, subjectVerifier, Currency.EUR);
      expect(conversionRate).to.eq(subjectCurrencies[0].conversionRate);
    });

    it("should emit a DepositCurrencyAdded event", async () => {
      await expect(subject()).to.emit(ramp, "DepositCurrencyAdded").withArgs(
        subjectDepositId,
        subjectVerifier,
        Currency.EUR,
        subjectCurrencies[0].conversionRate
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
        await expect(subject()).to.be.revertedWith("Caller must be the depositor or delegate");
      });
    });

    describe("when the verifier is not found for the deposit", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Verifier not found for deposit");
      });
    });

    describe("when the currency is not supported by the verifier", async () => {
      beforeEach(async () => {
        subjectCurrencies = [
          { code: Currency.AED, conversionRate: ether(3.67) }
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency not supported by verifier");
      });
    });

    describe("when the conversion rate is zero", async () => {
      beforeEach(async () => {
        subjectCurrencies[0].conversionRate = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Conversion rate must be greater than 0");
      });
    });

    describe("when the currency already exists", async () => {
      beforeEach(async () => {
        subjectCurrencies = [
          { code: Currency.USD, conversionRate: ether(1.05) }
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency conversion rate already exists");
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
            { code: Currency.USD, conversionRate: ether(1.01) },
            { code: Currency.EUR, conversionRate: ether(0.95) }
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

      const conversionRate = await ramp.getDepositCurrencyConversionRate(subjectDepositId, subjectVerifier, subjectCurrencyCode);
      expect(conversionRate).to.eq(ZERO);
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
        await expect(subject()).to.be.revertedWith("Caller must be the depositor or delegate");
      });
    });

    describe("when the verifier is not found for the deposit", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Verifier not found for deposit");
      });
    });

    describe("when the currency is not found for the verifier", async () => {
      beforeEach(async () => {
        subjectCurrencyCode = Currency.AED;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency not found for verifier");
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
          [{ code: Currency.USD, conversionRate: ether(1.01) }]
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

      const delegateFromGetter = await ramp.getDepositDelegate(subjectDepositId);
      expect(delegateFromGetter).to.eq(subjectDelegate);
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
        await expect(subject()).to.be.revertedWith("Only depositor can set delegate");
      });

      describe("when the caller is delegate", async () => {
        beforeEach(async () => {
          subjectCaller = offRamperDelegate;
        });

        it("should still revert", async () => {
          await expect(subject()).to.be.revertedWith("Only depositor can set delegate");
        });
      });
    });

    describe("when the delegate is zero address", async () => {
      beforeEach(async () => {
        subjectDelegate = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Delegate cannot be zero address");
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
          [{ code: Currency.USD, conversionRate: ether(1.01) }]
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

      const delegateFromGetter = await ramp.getDepositDelegate(subjectDepositId);
      expect(delegateFromGetter).to.eq(ethers.constants.AddressZero);
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
        await expect(subject()).to.be.revertedWith("Only depositor can remove delegate");
      });

      describe("when the caller is delegate", async () => {
        beforeEach(async () => {
          subjectCaller = offRamperDelegate;
        });

        it("should still revert", async () => {
          await expect(subject()).to.be.revertedWith("Only depositor can remove delegate");
        });
      });
    });

    describe("when no delegate is set", async () => {
      beforeEach(async () => {
        // First remove the delegate, then try to remove again
        await ramp.connect(offRamper.wallet).removeDepositDelegate(subjectDepositId);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("No delegate set for this deposit");
      });
    });
  });
});
