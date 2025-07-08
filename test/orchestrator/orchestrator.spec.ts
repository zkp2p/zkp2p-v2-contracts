import "module-alias/register";

import { ethers } from "hardhat";
import { Signer } from "ethers";

import {
  Address,
} from "@utils/types";
import { Account } from "@utils/test/types";
import {
  Escrow,
  Orchestrator,
  IOrchestrator,
  USDCMock,
  PaymentVerifierMock,
  PostIntentHookMock,
  PostIntentHookRegistry,
  PaymentVerifierRegistry,
  RelayerRegistry,
  NullifierRegistry,
  ProtocolViewer,
  EscrowRegistry
} from "@utils/contracts";
import DeployHelper from "@utils/deploys";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";
import { Blockchain, ether, usdc } from "@utils/common";
import { BigNumber } from "ethers";
import { ZERO, ZERO_BYTES32, ADDRESS_ZERO, ONE, ONE_DAY_IN_SECONDS, ONE_HOUR_IN_SECONDS } from "@utils/constants";
import { calculateIntentHash, calculateRevolutIdHash, calculateRevolutIdHashBN } from "@utils/protocolUtils";
import { Currency } from "@utils/protocolUtils";
import { generateGatingServiceSignature, createSignalIntentParams } from "@utils/test/helpers";

const expect = getWaffleExpect();

const blockchain = new Blockchain(ethers.provider);


describe("Orchestrator", () => {
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
  let relayerAccount: Account;
  let witness: Account;
  let protocolFeeRecipient: Account;
  let chainId: BigNumber = ONE;
  let currentIntentCounter: number = 0;

  let escrow: Escrow;
  let orchestrator: Orchestrator;
  let protocolViewer: ProtocolViewer;
  let usdcToken: USDCMock;
  let paymentVerifierRegistry: PaymentVerifierRegistry;
  let postIntentHookRegistry: PostIntentHookRegistry;
  let relayerRegistry: RelayerRegistry;
  let nullifierRegistry: NullifierRegistry;
  let escrowRegistry: EscrowRegistry;

  let verifier: PaymentVerifierMock;
  let otherVerifier: PaymentVerifierMock;
  let postIntentHookMock: PostIntentHookMock;
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
      relayerAccount,
      protocolFeeRecipient
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    escrowRegistry = await deployer.deployEscrowRegistry();

    paymentVerifierRegistry = await deployer.deployPaymentVerifierRegistry();

    postIntentHookRegistry = await deployer.deployPostIntentHookRegistry();

    relayerRegistry = await deployer.deployRelayerRegistry();

    nullifierRegistry = await deployer.deployNullifierRegistry();

    await usdcToken.transfer(offRamper.address, usdc(10000));

    escrow = await deployer.deployEscrow(
      owner.address,
      chainId,
      paymentVerifierRegistry.address,
      ZERO,
      protocolFeeRecipient.address,
      ZERO,
      BigNumber.from(10),
      ONE_DAY_IN_SECONDS  // intentExpirationPeriod
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
      feeRecipient.address,              // protocol fee recipient
      ONE_HOUR_IN_SECONDS                // partialManualReleaseDelay (1 hour)
    );

    protocolViewer = await deployer.deployProtocolViewer(escrow.address, orchestrator.address);

    // Set orchestrator in escrow
    await escrow.connect(owner.wallet).setOrchestrator(orchestrator.address);

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

    postIntentHookMock = await deployer.deployPostIntentHookMock(usdcToken.address, orchestrator.address);

    await postIntentHookRegistry.addPostIntentHook(postIntentHookMock.address);

    await paymentVerifierRegistry.addPaymentVerifier(verifier.address);
  });

  describe("#constructor", async () => {
    it("should set the correct state variables", async () => {
      const actualChainId = await orchestrator.chainId();
      const actualEscrowRegistry = await orchestrator.escrowRegistry();
      const actualPaymentVerifierRegistry = await orchestrator.paymentVerifierRegistry();
      const actualPostIntentHookRegistry = await orchestrator.postIntentHookRegistry();
      const actualRelayerRegistry = await orchestrator.relayerRegistry();
      const actualProtocolFee = await orchestrator.protocolFee();
      const actualProtocolFeeRecipient = await orchestrator.protocolFeeRecipient();
      const actualPartialManualReleaseDelay = await orchestrator.partialManualReleaseDelay();

      expect(actualChainId).to.eq(chainId);
      expect(actualEscrowRegistry).to.eq(escrowRegistry.address);
      expect(actualPaymentVerifierRegistry).to.eq(paymentVerifierRegistry.address);
      expect(actualPostIntentHookRegistry).to.eq(postIntentHookRegistry.address);
      expect(actualRelayerRegistry).to.eq(relayerRegistry.address);
      expect(actualProtocolFee).to.eq(ZERO);
      expect(actualProtocolFeeRecipient).to.eq(feeRecipient.address);
      expect(actualPartialManualReleaseDelay).to.eq(ONE_HOUR_IN_SECONDS);
    });
  });

  describe("#signalIntent", async () => {
    let subjectEscrow: Address;
    let subjectDepositId: BigNumber;
    let subjectAmount: BigNumber;
    let subjectTo: Address;
    let subjectVerifier: Address;
    let subjectFiatCurrency: string;
    let subjectConversionRate: BigNumber;
    let subjectReferrer: Address;
    let subjectReferrerFee: BigNumber;
    let subjectGatingServiceSignature: string;
    let subjectPostIntentHook: Address;
    let subjectSignatureExpiration: BigNumber;
    let subjectIntentData: string;
    let subjectCaller: Account;

    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Create a deposit first
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      depositConversionRate = ether(1.01);

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
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO,  // intentGuardian
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      const currentTimestamp = await blockchain.getCurrentTimestamp();

      subjectEscrow = escrow.address;
      subjectDepositId = ZERO;
      subjectAmount = usdc(50);
      subjectTo = receiver.address;
      subjectVerifier = verifier.address;
      subjectFiatCurrency = Currency.USD;
      subjectConversionRate = ether(1.02);   // Slightly higher than depositConversionRate
      subjectReferrer = ADDRESS_ZERO;       // No referrer by default
      subjectReferrerFee = ZERO;             // No referrer fee by default
      subjectSignatureExpiration = currentTimestamp.add(ONE_DAY_IN_SECONDS).add(10);
      subjectGatingServiceSignature = await generateGatingServiceSignature(
        gatingService,
        orchestrator.address,
        escrow.address,
        subjectDepositId,
        subjectAmount,
        subjectTo,
        subjectVerifier,
        subjectFiatCurrency,
        subjectConversionRate,
        chainId.toString(),
        subjectSignatureExpiration
      );

      subjectPostIntentHook = ADDRESS_ZERO;
      subjectIntentData = "0x";

      subjectCaller = onRamper;
    });

    async function subject(): Promise<any> {
      const params = await createSignalIntentParams(
        orchestrator.address,
        subjectEscrow,
        subjectDepositId,
        subjectAmount,
        subjectTo,
        subjectVerifier,
        subjectFiatCurrency,
        subjectConversionRate,
        subjectReferrer,
        subjectReferrerFee,
        null, // gating service
        chainId.toString(),
        subjectPostIntentHook,
        subjectIntentData,
        subjectSignatureExpiration
      );
      params.gatingServiceSignature = subjectGatingServiceSignature;

      return orchestrator.connect(subjectCaller.wallet).signalIntent(params);
    }

    it("should create the correct entry in the intents mapping", async () => {
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      const intentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );

      await subject();

      const intent = await orchestrator.getIntent(intentHash);

      expect(intent.owner).to.eq(onRamper.address);
      expect(intent.to).to.eq(subjectTo);
      expect(intent.depositId).to.eq(subjectDepositId);
      expect(intent.amount).to.eq(subjectAmount);
      expect(intent.paymentVerifier).to.eq(subjectVerifier);
      expect(intent.fiatCurrency).to.eq(subjectFiatCurrency);
      expect(intent.conversionRate).to.eq(subjectConversionRate);
      expect(intent.referrer).to.eq(subjectReferrer);
      expect(intent.referrerFee).to.eq(subjectReferrerFee);
      expect(intent.postIntentHook).to.eq(subjectPostIntentHook);
      expect(intent.data).to.eq(subjectIntentData);
    });

    it("should lock funds in the escrow contract", async () => {
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      const intentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );

      const preDeposit = await escrow.getDeposit(subjectDepositId);

      await subject();

      const postDeposit = await escrow.getDeposit(subjectDepositId);
      const postIntents = await escrow.getDepositIntentHashes(subjectDepositId);

      expect(postDeposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.add(subjectAmount));
      expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.sub(subjectAmount));
      expect(postIntents).to.include(intentHash);
    });

    it("should add the intent hash to the account's intents", async () => {
      const tx = await subject();
      const receipt = await tx.wait();

      // Get the block timestamp from the transaction receipt
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const intentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );

      const accountIntents = await orchestrator.getAccountIntents(onRamper.address);
      expect(accountIntents).to.include(intentHash);
    });

    it("should emit an IntentSignaled event", async () => {
      const tx = await subject();
      const receipt = await tx.wait();

      // Get the block timestamp from the transaction receipt
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const intentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );

      expect(tx).to.emit(orchestrator, "IntentSignaled").withArgs(
        intentHash,
        escrow.address,
        subjectDepositId,
        subjectVerifier,
        onRamper.address,
        subjectTo,
        subjectAmount,
        subjectFiatCurrency,
        subjectConversionRate,
        block.timestamp
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
        currentIntentCounter++;  // Increment counter after signalIntent

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        oldIntentHash = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter - 1  // Use the counter value when the intent was created
        );

        await blockchain.increaseTimeAsync(timeJump);

        subjectAmount = usdc(60);
        subjectCaller = onRamperTwo;
        subjectSignatureExpiration = currentTimestamp.add(ONE_DAY_IN_SECONDS).add(10);
        subjectGatingServiceSignature = await generateGatingServiceSignature(
          gatingService,
          orchestrator.address,
          escrow.address,
          subjectDepositId,
          subjectAmount,
          subjectTo,
          subjectVerifier,
          subjectFiatCurrency,
          subjectConversionRate,
          chainId.toString(),
          subjectSignatureExpiration
        );
      });

      it("should prune the old intent and update the deposit mapping correctly", async () => {
        const preDeposit = await protocolViewer.getDeposit(subjectDepositId);

        await subject();

        const newIntentHash = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter  // Current counter value for the new intent
        );
        currentIntentCounter++;  // Increment after creating new intent

        const postDeposit = await protocolViewer.getDeposit(subjectDepositId);

        expect(postDeposit.deposit.outstandingIntentAmount).to.eq(subjectAmount);
        expect(postDeposit.deposit.remainingDeposits).to.eq(preDeposit.deposit.remainingDeposits.sub(usdc(10))); // 10 usdc difference between old and new intent
        expect(postDeposit.intentHashes).to.include(newIntentHash);
        expect(postDeposit.intentHashes).to.not.include(oldIntentHash);
      });

      it("should delete the original intent from the intents mapping", async () => {
        await subject();

        const intent = await orchestrator.getIntent(oldIntentHash);

        expect(intent.owner).to.eq(ADDRESS_ZERO);
        expect(intent.depositId).to.eq(ZERO);
      });

      it("should emit an IntentPruned event", async () => {
        await expect(subject()).to.emit(orchestrator, "IntentPruned").withArgs(
          oldIntentHash
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
          await expect(subject()).to.be.reverted;
        });
      });
    });

    describe("when the account has an unfulfilled intent", async () => {
      beforeEach(async () => {
        await subject();
        currentIntentCounter++;  // Increment after signalIntent
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "AccountHasActiveIntent");
      });

      describe("when the intent is cancelled", async () => {
        beforeEach(async () => {
          const currentTimestamp = await blockchain.getCurrentTimestamp();
          const oldIntentHash = calculateIntentHash(
            orchestrator.address,
            currentIntentCounter - 1  // Use the counter value when the intent was created
          );
          await orchestrator.connect(onRamper.wallet).cancelIntent(oldIntentHash);
        });

        it("should not revert", async () => {
          expect(await subject()).to.not.be.reverted;
        });
      });

      describe("when multiple intents are allowed", async () => {
        beforeEach(async () => {
          await orchestrator.connect(owner.wallet).setAllowMultipleIntents(true);
        });

        it("should not revert", async () => {
          expect(await subject()).to.not.be.reverted;
        });
      });

      describe("when caller is relayer", async () => {
        beforeEach(async () => {
          await relayerRegistry.connect(owner.wallet).addRelayer(relayerAccount.address);

          subjectCaller = relayerAccount;
        });

        it("should not revert", async () => {
          expect(await subject()).to.not.be.reverted;
        });
      });
    });

    describe("when post intent hook is set", async () => {
      beforeEach(async () => {
        subjectPostIntentHook = postIntentHookMock.address;
        subjectIntentData = "0x1234"
      });

      it("should set the post intent hook and intent data", async () => {
        await subject();

        const intent = await orchestrator.getIntent(calculateIntentHash(
          orchestrator.address,
          currentIntentCounter  // Current counter for this intent
        ));
        currentIntentCounter++;  // Increment after creating intent
        expect(intent.postIntentHook).to.eq(postIntentHookMock.address);
        expect(intent.data).to.eq(subjectIntentData);
      });

      describe("when the post intent hook is not whitelisted", async () => {
        beforeEach(async () => {
          await postIntentHookRegistry.removePostIntentHook(postIntentHookMock.address);
        });

        it("should revert", async () => {
          await expect(subject()).to.be.revertedWithCustomError(orchestrator, "PostIntentHookNotWhitelisted");
        });
      });
    });

    describe("when the deposit does not exist", async () => {
      beforeEach(async () => {
        subjectDepositId = ONE; // Non-existent deposit
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "VerifierNotSupported");
      });
    });

    describe("when the verifier is not supported", async () => {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address; // Not supported verifier
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "VerifierNotSupported");
      });
    });

    describe("when the fiat currency is not supported by the verifier", async () => {
      beforeEach(async () => {
        subjectFiatCurrency = Currency.EUR;    // supported by verifier but not supported by deposit
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "CurrencyNotSupported");
      });
    });

    describe("when the conversion rate is less than the min conversion rate", async () => {
      beforeEach(async () => {
        subjectConversionRate = ether(0.99); // Less than min conversion rate
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "RateBelowMinimum");
      });

      describe("when the conversion rate is equal to the min conversion rate", async () => {
        beforeEach(async () => {
          subjectConversionRate = ether(1.01); // Equal to min conversion rate
          const currentTimestamp = await blockchain.getCurrentTimestamp();
          subjectSignatureExpiration = currentTimestamp.add(ONE_DAY_IN_SECONDS).add(10);

          subjectGatingServiceSignature = await generateGatingServiceSignature(
            gatingService,
            orchestrator.address,
            escrow.address,
            subjectDepositId,
            subjectAmount,
            subjectTo,
            subjectVerifier,
            subjectFiatCurrency,
            subjectConversionRate,
            chainId.toString(),
            subjectSignatureExpiration
          );
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the escrow is not whitelisted", async () => {
      beforeEach(async () => {
        await escrowRegistry.connect(owner.wallet).removeEscrow(escrow.address);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "EscrowNotWhitelisted");
      });

      describe("when the escrow registry is accepting all escrows", async () => {
        beforeEach(async () => {
          await escrowRegistry.connect(owner.wallet).setAcceptAllEscrows(true);
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the deposit is not accepting intents", async () => {
      beforeEach(async () => {
        // Create and signal an intent first to lock some liquidity
        const params = await createSignalIntentParams(
          orchestrator.address,
          escrow.address,
          subjectDepositId,
          usdc(50),
          receiver.address,
          verifier.address,
          Currency.USD,
          subjectConversionRate,
          ADDRESS_ZERO,    // referrer
          ZERO,            // referrerFee
          gatingService,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );
        await orchestrator.connect(onRamperOtherAddress.wallet).signalIntent(params);

        await escrow.connect(offRamper.wallet).withdrawDeposit(subjectDepositId);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(escrow, "DepositNotAcceptingIntents");
      });
    });

    describe("when the amount is less than the minimum intent amount", async () => {
      beforeEach(async () => {
        subjectAmount = usdc(5); // Less than minimum intent amount
      });

      it("should revert", async () => {
        await expect(subject()).to.be.reverted;
      });
    });

    describe("when the amount is more than the maximum intent amount", async () => {
      beforeEach(async () => {
        subjectAmount = usdc(250); // More than maximum intent amount
      });

      it("should revert", async () => {
        await expect(subject()).to.be.reverted;
      });
    });

    describe("when the to address is zero", async () => {
      beforeEach(async () => {
        subjectTo = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "ZeroAddress");
      });
    });

    describe("when the gating service signature is invalid", async () => {
      beforeEach(async () => {
        subjectGatingServiceSignature = "0x"; // Invalid signature
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "InvalidSignature");
      });

      describe("when the deposit doesn't has intent gating service", async () => {
        beforeEach(async () => {
          await escrow.connect(offRamper.wallet).createDeposit({
            token: usdcToken.address,
            amount: usdc(100),
            intentAmountRange: { min: usdc(10), max: usdc(200) },
            verifiers: [verifier.address],
            verifierData: [{
              intentGatingService: ADDRESS_ZERO,
              payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
              data: "0x"
            }],
            currencies: [
              [{ code: Currency.USD, minConversionRate: depositConversionRate }]
            ],
            delegate: offRamperDelegate.address,
            intentGuardian: ADDRESS_ZERO,  // intentGuardian
            referrer: ADDRESS_ZERO,
            referrerFee: ZERO
          });

          subjectDepositId = ONE;
        });

        it("should not revert", async () => {
          await expect(subject()).to.not.be.reverted;
        });
      });
    });

    describe("when the gating service signature is expired", async () => {
      beforeEach(async () => {
        subjectSignatureExpiration = ONE_DAY_IN_SECONDS.sub(1);

        await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(1).toNumber());
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "SignatureExpired");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await orchestrator.connect(owner.wallet).pauseOrchestrator();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });
    });

    describe("when referrer fee exceeds maximum", async () => {
      beforeEach(async () => {
        subjectReferrer = receiver.address;
        subjectReferrerFee = ether(0.06); // 6% exceeds 5% max
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "FeeExceedsMaximum");
      });
    });

    describe("when referrer is not set but fee is set", async () => {
      beforeEach(async () => {
        subjectReferrer = ADDRESS_ZERO;
        subjectReferrerFee = ether(0.01); // 1% fee without referrer
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "InvalidReferrerFeeConfiguration");
      });
    });

    describe("when referrer is set with valid fee", async () => {
      beforeEach(async () => {
        subjectReferrer = receiver.address;
        subjectReferrerFee = ether(0.02); // 2% fee
      });

      it("should create intent with referrer and fee", async () => {
        await subject();

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        const intentHash = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter
        );
        currentIntentCounter++;  // Increment after creating intent

        const intent = await orchestrator.getIntent(intentHash);
        expect(intent.referrer).to.eq(subjectReferrer);
        expect(intent.referrerFee).to.eq(subjectReferrerFee);
      });
    });
  });

  describe("#cancelIntent", async () => {
    let subjectIntentHash: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create a deposit first
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      const depositConversionRate = ether(1.01);

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
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO,  // intentGuardian
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      // Signal an intent
      const params = await createSignalIntentParams(
        orchestrator.address,
        escrow.address,
        ZERO,
        usdc(50),
        onRamper.address,
        verifier.address,
        Currency.USD,
        depositConversionRate,
        ADDRESS_ZERO,
        ZERO,
        gatingService,
        chainId.toString(),
        ADDRESS_ZERO,
        "0x"
      );

      await orchestrator.connect(onRamper.wallet).signalIntent(params);

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      subjectIntentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );
      currentIntentCounter++;  // Increment after signalIntent
      subjectCaller = onRamper;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).cancelIntent(subjectIntentHash);
    }

    it("should cancel the intent and unlock funds in escrow", async () => {
      const preDeposit = await escrow.getDeposit(ZERO);

      await subject();

      const postDeposit = await escrow.getDeposit(ZERO);
      expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.add(usdc(50)));
      expect(postDeposit.outstandingIntentAmount).to.eq(ZERO);
    });

    it("should remove the intent from the intents mapping", async () => {
      await subject();

      const intent = await orchestrator.getIntent(subjectIntentHash);
      expect(intent.owner).to.eq(ADDRESS_ZERO);
    });

    it("should remove the intent from the accountIntents mapping", async () => {
      await subject();

      const accountIntents = await orchestrator.getAccountIntents(onRamper.address);
      expect(accountIntents).to.not.include(subjectIntentHash);
    });

    describe("when the intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.formatBytes32String("nonexistent");
      });

      it("should revert with IntentDoesNotExist", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "IntentNotFound");
      });
    });

    describe("when the caller is not the intent owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamperTwo;
      });

      it("should revert with SenderMustBeIntentOwner", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "UnauthorizedCaller");
      });
    });

    describe("when the escrow is paused", async () => {
      beforeEach(async () => {
        await orchestrator.connect(owner.wallet).pauseOrchestrator();
      });

      it("should NOT revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });
    });
  });

  describe("#fulfillIntent", async () => {
    let subjectProof: string;
    let subjectIntentHash: string;
    let subjectVerificationData: string;
    let subjectPostIntentDataData: string;
    let subjectCaller: Account;

    let intentAmount: BigNumber;
    let releaseAmount: BigNumber;
    let intentHash: string;
    let payeeDetails: string;
    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Create a deposit first
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      depositConversionRate = ether(1.08);

      payeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails"));
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
          data: depositData
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: depositConversionRate }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      // Signal an intent
      intentAmount = usdc(50);
      const params = await createSignalIntentParams(
        orchestrator.address,
        escrow.address,
        ZERO,
        intentAmount,
        onRamper.address,
        verifier.address,
        Currency.USD,
        depositConversionRate,
        ADDRESS_ZERO,    // referrer
        ZERO,            // referrerFee
        gatingService,
        chainId.toString(),
        ADDRESS_ZERO,
        "0x"
      );

      await orchestrator.connect(onRamper.wallet).signalIntent(params);

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      intentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );
      currentIntentCounter++;  // Increment after signalIntent

      await verifier.setShouldVerifyPayment(true);

      subjectProof = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "string", "bytes32", "bytes32"],
        [usdc(50), currentTimestamp, payeeDetails, Currency.USD, intentHash]
      );
      subjectIntentHash = intentHash;
      subjectVerificationData = "0x";
      subjectPostIntentDataData = "0x";
      subjectCaller = onRamper;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).fulfillIntent({
        paymentProof: subjectProof,
        intentHash: subjectIntentHash,
        verificationData: subjectVerificationData,
        postIntentHookData: subjectPostIntentDataData
      });
    }

    it("should transfer the correct amount to the on-ramper", async () => {
      const initialBalance = await usdcToken.balanceOf(onRamper.address);

      await subject();

      const finalBalance = await usdcToken.balanceOf(onRamper.address);
      const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
      expect(finalBalance.sub(initialBalance)).to.eq(releaseAmount);
    });

    it("should prune the intent", async () => {
      await subject();

      const intent = await orchestrator.getIntent(subjectIntentHash);

      expect(intent.owner).to.eq(ADDRESS_ZERO); // Intent should be deleted
    });

    it("should update the deposit balances correctly", async () => {
      const preDeposit = await escrow.getDeposit(ZERO);

      await subject();

      const postDeposit = await escrow.getDeposit(ZERO);
      const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
      expect(postDeposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.sub(usdc(50))); // 50 USDC is the intent amount
      // Not released amount is added to remaining deposits
      expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.add(usdc(50).sub(releaseAmount)));
    });

    it("should emit an IntentFulfilled event", async () => {
      const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
      await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
        intentHash,
        onRamper.address,
        releaseAmount,
        false,
        Currency.USD,
        "1234abcd"    // hardcoded payment ID in mock verifier
      );
    });

    describe("when the conversion rate is updated by depositor", async () => {
      beforeEach(async () => {
        // Incresases min rate from 1.08 to 1.09
        await escrow.connect(offRamper.wallet).updateDepositMinConversionRate(
          ZERO, verifier.address, Currency.USD, ether(1.09)
        );
      });

      it("should still transfer the correct amount to the on-ramper", async () => {
        const initialBalance = await usdcToken.balanceOf(onRamper.address);

        await subject();

        const finalBalance = await usdcToken.balanceOf(onRamper.address);
        const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
        expect(finalBalance.sub(initialBalance)).to.eq(releaseAmount);
      });

      it("should update the deposit balances correctly", async () => {
        const preDeposit = await escrow.getDeposit(ZERO);

        await subject();

        const postDeposit = await escrow.getDeposit(ZERO);
        const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
        expect(postDeposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.sub(usdc(50))); // 50 USDC is the intent amount
        // Not released amount is added to remaining deposits
        expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.add(usdc(50).sub(releaseAmount)));
      });
    });

    describe("when the fulfill intent zeroes out the deposit", async () => {
      beforeEach(async () => {
        const currentTimestamp1 = await blockchain.getCurrentTimestamp();
        const proof1 = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "string", "bytes32", "bytes32"],
          [usdc(60), currentTimestamp1, payeeDetails, Currency.USD, intentHash]
        );

        // Release 60 / 1.08 = 55.56 USDC > 50 USDC intent amount; so release full $50 to the payer
        await orchestrator.connect(onRamper.wallet).fulfillIntent({
          paymentProof: proof1,
          intentHash: intentHash,
          verificationData: "0x",
          postIntentHookData: "0x"
        });

        // // Wait for 1 day
        // await blockchain.increaseTimeAsync(ONE_DAY_IN_SECONDS.add(10).toNumber());

        // Signal a new intent for $50
        const params = await createSignalIntentParams(
          orchestrator.address,
          escrow.address,
          ZERO,
          intentAmount,
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          ADDRESS_ZERO,    // referrer
          ZERO,            // referrerFee
          gatingService,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );

        await orchestrator.connect(onRamper.wallet).signalIntent(params);

        const currentTimestamp2 = await blockchain.getCurrentTimestamp();
        subjectIntentHash = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter
        );
        currentIntentCounter++;  // Increment after signalIntent
        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "string", "bytes32", "bytes32"],
          [usdc(60), currentTimestamp2, payeeDetails, Currency.USD, subjectIntentHash]
        );
      });

      it("should delete the deposit", async () => {
        await subject();

        const deposit = await escrow.getDeposit(ZERO);
        expect(deposit.depositor).to.eq(ADDRESS_ZERO);
      });

      it("should delete the deposit verifier data", async () => {
        await subject();

        const verifierData = await escrow.getDepositVerifierData(ZERO, verifier.address);
        expect(verifierData.intentGatingService).to.eq(ADDRESS_ZERO);
      });

      it("should delete deposit currency conversion data", async () => {
        await subject();

        const currencyConversionData = await escrow.getDepositCurrencyMinRate(ZERO, verifier.address, Currency.USD);
        expect(currencyConversionData).to.eq(ZERO);
      });

      it("should emit a DepositClosed event", async () => {
        await expect(subject()).to.emit(escrow, "DepositClosed").withArgs(
          ZERO,
          offRamper.address
        );
      });
    });

    describe("when the protocol fee is set", async () => {
      beforeEach(async () => {
        await orchestrator.connect(owner.wallet).setProtocolFee(ether(0.02)); // 2% fee
      });

      it("should transfer the correct amounts including fee", async () => {
        const initialOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        await subject();

        const finalOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
        const fee = releaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount

        expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(releaseAmount.sub(fee));
        expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(fee);
      });

      it("should emit an IntentFulfilled event with fee details", async () => {
        const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
        const fee = releaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount

        await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
          intentHash,
          onRamper.address,
          releaseAmount.sub(fee),
          false,
          Currency.USD,
          "1234abcd"    // hardcoded payment ID in mock verifier
        );
      });
    });

    describe("when referrer and referrer fee are set", async () => {
      beforeEach(async () => {
        // Cancel the existing intent first
        await orchestrator.connect(onRamper.wallet).cancelIntent(intentHash);

        // Create a new intent with referrer
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
          ZERO, // depositId
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          receiver.address,    // referrer
          ether(0.01),         // referrerFee - 1%
          null,                // passing null since we already have the signature
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );
        params.gatingServiceSignature = gatingServiceSignature;
        await orchestrator.connect(onRamper.wallet).signalIntent(params);

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        intentHash = calculateIntentHash(orchestrator.address, currentIntentCounter);
        currentIntentCounter++;  // Increment after signalIntent

        // Update the subject variables
        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "string", "bytes32", "bytes32"],
          [usdc(50), currentTimestamp, payeeDetails, Currency.USD, intentHash]
        );
        subjectIntentHash = intentHash;
      });

      it("should transfer the correct amounts including referrer fee", async () => {
        const initialOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const initialReferrerBalance = await usdcToken.balanceOf(receiver.address);

        await subject();

        const finalOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const finalReferrerBalance = await usdcToken.balanceOf(receiver.address);

        const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
        const referrerFee = releaseAmount.mul(ether(0.01)).div(ether(1)); // 1% of release amount

        expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(releaseAmount.sub(referrerFee));
        expect(finalReferrerBalance.sub(initialReferrerBalance)).to.eq(referrerFee);
      });

      it("should emit an IntentFulfilled event with referrer fee details", async () => {
        const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
        const referrerFee = releaseAmount.mul(ether(0.01)).div(ether(1)); // 1% of release amount

        await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
          intentHash,
          onRamper.address,
          releaseAmount.sub(referrerFee),        // Amount transferred to the on-ramper
          false,
          Currency.USD,
          "1234abcd"    // hardcoded payment ID in mock verifier  
        );
      });

      describe("when protocol fee is also set", async () => {
        beforeEach(async () => {
          await orchestrator.connect(owner.wallet).setProtocolFee(ether(0.02)); // 2% fee
        });

        it("should transfer the correct amounts including both protocol and referrer fees", async () => {
          const initialOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
          const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const initialReferrerBalance = await usdcToken.balanceOf(receiver.address);

          await subject();

          const finalOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
          const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const finalReferrerBalance = await usdcToken.balanceOf(receiver.address);

          const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
          const protocolFee = releaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount
          const referrerFee = releaseAmount.mul(ether(0.01)).div(ether(1)); // 1% of release amount
          const totalFees = protocolFee.add(referrerFee);

          expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(releaseAmount.sub(totalFees));
          expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(protocolFee);
          expect(finalReferrerBalance.sub(initialReferrerBalance)).to.eq(referrerFee);
        });

        it("should emit an IntentFulfilled event with correct fee details", async () => {
          const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
          const protocolFee = releaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount
          const referrerFee = releaseAmount.mul(ether(0.01)).div(ether(1)); // 1% of release amount
          const totalFees = protocolFee.add(referrerFee);

          await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
            intentHash,
            onRamper.address,
            releaseAmount.sub(totalFees),
            false,
            Currency.USD,
            "1234abcd"    // hardcoded payment ID in mock verifier
          );
        });
      });
    });

    describe("when the intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("invalid"));
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "IntentNotFound");
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
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "HashMismatch");
      });
    });

    describe("when the payment verification fails", async () => {
      beforeEach(async () => {
        await verifier.setShouldReturnFalse(true);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "PaymentVerificationFailed");
      });
    });

    describe("when the orchestrator is paused", async () => {
      beforeEach(async () => {
        await orchestrator.connect(owner.wallet).pauseOrchestrator();
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Pausable: paused");
      });

      describe("when the orchestrator is unpaused", async () => {
        beforeEach(async () => {
          await orchestrator.connect(owner.wallet).unpauseOrchestrator();
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

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        const signatureExpiration = currentTimestamp.add(ONE_DAY_IN_SECONDS).add(10);

        // Create a new intent with post intent hook action
        const gatingServiceSignatureForHook = await generateGatingServiceSignature(
          gatingService,
          orchestrator.address,
          escrow.address,
          ZERO,
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          chainId.toString(),
          signatureExpiration
        );

        // First cancel the existing intent
        await orchestrator.connect(onRamper.wallet).cancelIntent(intentHash);

        // Signal an intent that uses the postIntentHookMock
        const params = await createSignalIntentParams(
          orchestrator.address,
          escrow.address,
          ZERO,
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          ADDRESS_ZERO,
          ZERO,
          null, // passing null since we already have the signature
          chainId.toString(),
          postIntentHookMock.address,
          signalIntentDataForHook,
          signatureExpiration
        );
        // Override the signature since we generated it manually
        params.gatingServiceSignature = gatingServiceSignatureForHook;
        await orchestrator.connect(onRamper.wallet).signalIntent(params);
        const currentTimestamp2 = await blockchain.getCurrentTimestamp();
        intentHash = calculateIntentHash(orchestrator.address, currentIntentCounter);
        currentIntentCounter++;  // Increment after signalIntent

        // Set the verifier to verify payment
        await verifier.setShouldVerifyPayment(true);

        // Prepare the proof and processor for the onRamp function
        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "string", "bytes32", "bytes32"],
          [usdc(50), currentTimestamp2, payeeDetails, Currency.USD, intentHash]
        );
        subjectIntentHash = intentHash;
        subjectCaller = onRamper;
        subjectPostIntentDataData = "0x"; // Still keep it empty
      });

      it("should transfer funds to the hook's target address, not the intent.to address", async () => {
        const initialTargetAddressBalance = await usdcToken.balanceOf(hookTargetAddress);
        const initialIntentToBalance = await usdcToken.balanceOf(onRamper.address);
        const initialEscrowBalance = await usdcToken.balanceOf(escrow.address);

        await subject();

        const finalTargetAddressBalance = await usdcToken.balanceOf(hookTargetAddress);
        const finalIntentToBalance = await usdcToken.balanceOf(onRamper.address);
        const finalEscrowBalance = await usdcToken.balanceOf(escrow.address);

        const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
        expect(finalTargetAddressBalance.sub(initialTargetAddressBalance)).to.eq(releaseAmount);
        expect(finalIntentToBalance.sub(initialIntentToBalance)).to.eq(ZERO); // onRamper should not receive funds directly
        expect(initialEscrowBalance.sub(finalEscrowBalance)).to.eq(releaseAmount); // Escrow pays out the 50 USDC
      });

      it("should emit IntentFulfilled event with original intent.to address but funds routed by hook", async () => {
        const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
        await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
          subjectIntentHash,    // Hash of the intent fulfilled
          postIntentHookMock.address,     // Post intent hook address
          releaseAmount,             // Amount transferred (after 0 fees in this case)
          false,
          Currency.USD,
          "1234abcd"    // hardcoded payment ID in mock verifier
        );
      });

      describe("when protocol fee is set with a hook", async () => {
        beforeEach(async () => {
          await orchestrator.connect(owner.wallet).setProtocolFee(ether(0.02)); // 2% fee
        });

        it("should transfer (intent amount - fee) to hook's target and fee to recipient", async () => {
          const initialHookTargetBalance = await usdcToken.balanceOf(hookTargetAddress);
          const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const initialEscrowBalance = await usdcToken.balanceOf(escrow.address);

          await subject();

          const finalHookTargetBalance = await usdcToken.balanceOf(hookTargetAddress);
          const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const finalEscrowBalance = await usdcToken.balanceOf(escrow.address);

          const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
          const fee = releaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount
          expect(finalHookTargetBalance.sub(initialHookTargetBalance)).to.eq(releaseAmount.sub(fee)); // 49 USDC
          expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(fee); // 1 USDC
          expect(initialEscrowBalance.sub(finalEscrowBalance)).to.eq(releaseAmount); // Escrow still pays out total of 50
        });

        it("should emit IntentFulfilled with correct fee details when hook is used", async () => {
          const releaseAmount = usdc(50).mul(ether(1)).div(ether(1.08));
          const fee = releaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount
          await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
            subjectIntentHash,
            postIntentHookMock.address,     // Post intent hook address
            releaseAmount.sub(fee),    // Amount transferred to hook's destination
            false,
            Currency.USD,
            "1234abcd"    // hardcoded payment ID in mock verifier
          );
        });
      });
    });

    describe("when a partial payment is made", async () => {
      beforeEach(async () => {
        // Payment is only 40 USDC instead of the expected 50 USDC
        const currentTimestamp = await blockchain.getCurrentTimestamp();
        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "string", "bytes32", "bytes32"],
          [usdc(40), currentTimestamp, payeeDetails, Currency.USD, intentHash]
        );

        // Update the mock verifier to not check the payment amount (allow partial payments)
        await verifier.setShouldVerifyPayment(false);
      });

      it("should transfer the partial amount to the on-ramper", async () => {
        const initialBalance = await usdcToken.balanceOf(onRamper.address);

        await subject();

        const finalBalance = await usdcToken.balanceOf(onRamper.address);
        // With conversion rate of 1.08, and payment of 40 USDC:
        // Release amount = 40 / 1.08 = 37.03 USDC
        const expectedAmount = usdc(40).mul(ether(1)).div(depositConversionRate);
        expect(finalBalance.sub(initialBalance)).to.eq(expectedAmount);
      });

      it("should return unused funds to the deposit", async () => {
        const preDeposit = await escrow.getDeposit(ZERO);

        await subject();

        const postDeposit = await escrow.getDeposit(ZERO);
        // Intent was for 50 USDC, but only 37.03 USDC released
        const releasedAmount = usdc(40).mul(ether(1)).div(depositConversionRate);
        const returnedAmount = usdc(50).sub(releasedAmount);

        expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.add(returnedAmount));
        expect(postDeposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.sub(usdc(50)));
      });

      it("should emit an IntentFulfilled event with the partial amount", async () => {
        const releasedAmount = usdc(40).mul(ether(1)).div(depositConversionRate);

        await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
          intentHash,
          onRamper.address,
          releasedAmount,
          false,
          Currency.USD,
          "1234abcd"    // hardcoded payment ID in mock verifier
        );
      });

      describe("when protocol fee is set", async () => {
        beforeEach(async () => {
          await orchestrator.connect(owner.wallet).setProtocolFee(ether(0.02)); // 2% fee
        });

        it("should calculate fees based on the partial release amount", async () => {
          const initialOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
          const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

          await subject();

          const finalOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
          const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

          const releasedAmount = usdc(40).mul(ether(1)).div(depositConversionRate);
          const fee = releasedAmount.mul(ether(0.02)).div(ether(1)); // 2% of released amount

          expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(releasedAmount.sub(fee));
          expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(fee);
        });
      });
    });
  });

  describe("#releaseFundsToPayer", async () => {
    let subjectIntentHash: string;
    let subjectReleaseAmount: BigNumber;
    let subjectReleaseData: string;
    let subjectCaller: Account;

    let intentAmount: BigNumber;
    let payeeDetails: string;
    let intentHash: string;
    let depositConversionRate: BigNumber;

    beforeEach(async () => {
      // Create a deposit first
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      depositConversionRate = ether(1.08);

      payeeDetails = "12345678@revolut.me";
      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(200) },
        verifiers: [verifier.address],
        verifierData: [{
          payeeDetails: payeeDetails,
          intentGatingService: gatingService.address,
          data: "0x"
        }],
        currencies: [
          [{ code: Currency.USD, minConversionRate: depositConversionRate }]
        ],
        delegate: offRamperDelegate.address,
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      intentAmount = usdc(50);

      // Signal an intent
      const params = await createSignalIntentParams(
        orchestrator.address,
        escrow.address,
        ZERO,
        intentAmount,
        onRamper.address,
        verifier.address,
        Currency.USD,
        depositConversionRate,
        ADDRESS_ZERO,
        ZERO,
        gatingService,
        chainId.toString(),
        ADDRESS_ZERO,
        "0x"
      );

      await orchestrator.connect(onRamper.wallet).signalIntent(params);

      const currentTimestamp = await blockchain.getCurrentTimestamp();
      intentHash = calculateIntentHash(
        orchestrator.address,
        currentIntentCounter
      );
      currentIntentCounter++;  // Increment after signalIntent

      subjectIntentHash = intentHash;
      subjectReleaseAmount = usdc(40);  // Partial release
      subjectReleaseData = "0x";
      subjectCaller = offRamper; // Depositor

      // Increase time to 1 hour + 1 second
      await blockchain.increaseTimeAsync(ONE_HOUR_IN_SECONDS.toNumber() + 1);
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).releaseFundsToPayer(
        subjectIntentHash,
        subjectReleaseAmount,
        subjectReleaseData
      );
    }

    it("should transfer the usdc correctly to the payer", async () => {
      const preBalance = await usdcToken.balanceOf(onRamper.address);

      await subject();

      const postBalance = await usdcToken.balanceOf(onRamper.address);
      expect(postBalance.sub(preBalance)).to.eq(subjectReleaseAmount);
    });

    it("should delete the intent from the intents and account intents mapping", async () => {
      await subject();

      const intent = await orchestrator.getIntent(subjectIntentHash);
      expect(intent.owner).to.eq(ADDRESS_ZERO);

      const accountIntents = await orchestrator.getAccountIntents(onRamper.address);
      expect(accountIntents.length).to.eq(0);
    });

    it("should correctly update state on the escrow", async () => {
      const preDeposit = await escrow.getDeposit(ZERO);
      const preRemainingDeposits = preDeposit.remainingDeposits;
      const preOutstandingIntentAmount = preDeposit.outstandingIntentAmount;

      await subject();

      const postDeposit = await escrow.getDeposit(ZERO);
      const expectedPostRemainingDeposits = preRemainingDeposits.add(intentAmount.sub(subjectReleaseAmount));
      const expectedPostOutstandingIntentAmount = preOutstandingIntentAmount.sub(intentAmount);

      expect(postDeposit.remainingDeposits).to.eq(expectedPostRemainingDeposits);
      expect(postDeposit.outstandingIntentAmount).to.eq(expectedPostOutstandingIntentAmount);
    });

    it("should emit an IntentFulfilled event", async () => {
      await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
        subjectIntentHash,
        onRamper.address,
        subjectReleaseAmount,
        true, // manual release
        Currency.USD,
        ""    // Empty payment ID since release is manual
      );
    });

    describe("when the fulfill intent zeroes out the deposit", async () => {
      beforeEach(async () => {
        subjectReleaseAmount = intentAmount;
        await subject(); // release the full $50 to the payer

        // Signal a new intent for $50
        const params = await createSignalIntentParams(
          orchestrator.address,
          escrow.address,
          ZERO,
          intentAmount,
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          ADDRESS_ZERO,    // referrer
          ZERO,            // referrerFee
          gatingService,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );

        await orchestrator.connect(onRamper.wallet).signalIntent(params);

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        const intentHash2 = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter
        );
        currentIntentCounter++;  // Increment after signalIntent

        subjectIntentHash = intentHash2;
        subjectReleaseAmount = usdc(50);
      });

      it("should delete the deposit", async () => {
        await subject();

        const deposit = await escrow.getDeposit(ZERO);
        expect(deposit.depositor).to.eq(ADDRESS_ZERO);
      });

      it("should delete the deposit verifier data", async () => {
        await subject();

        const verifierData = await escrow.getDepositVerifierData(ZERO, verifier.address);
        expect(verifierData.intentGatingService).to.eq(ADDRESS_ZERO);
      });

      it("should delete deposit currency conversion data", async () => {
        await subject();

        const currencyConversionData = await escrow.getDepositCurrencyMinRate(ZERO, verifier.address, Currency.USD);
        expect(currencyConversionData).to.eq(ZERO);
      });

      it("should emit a DepositClosed event", async () => {
        await expect(subject()).to.emit(escrow, "DepositClosed").withArgs(
          ZERO,
          offRamper.address
        );
      });
    });

    describe("when the protocol fee is set", async () => {
      beforeEach(async () => {
        await orchestrator.connect(owner.wallet).setProtocolFee(ether(0.02)); // 2% fee
      });

      it("should transfer the correct amounts including fee", async () => {
        const initialOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        await subject();

        const finalOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);

        const fee = subjectReleaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount

        expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(subjectReleaseAmount.sub(fee));
        expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(fee);
      });

      it("should emit an IntentFulfilled event with fee details", async () => {
        const fee = subjectReleaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount

        await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
          intentHash,
          onRamper.address,
          subjectReleaseAmount.sub(fee),
          true,  // manual release
          Currency.USD,
          ""    // Empty payment ID since release is manual
        );
      });
    });

    describe("when referrer and referrer fee are set", async () => {
      beforeEach(async () => {
        // Cancel the existing intent first
        await orchestrator.connect(onRamper.wallet).cancelIntent(intentHash);

        // Create a new intent with referrer
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
          ZERO, // depositId
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          receiver.address,    // referrer
          ether(0.01),         // referrerFee - 1%
          null,                // passing null since we already have the signature
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );
        params.gatingServiceSignature = gatingServiceSignature;
        await orchestrator.connect(onRamper.wallet).signalIntent(params);

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        intentHash = calculateIntentHash(orchestrator.address, currentIntentCounter);
        currentIntentCounter++;  // Increment after signalIntent

        // Increase time to 1 hour + 1 second
        await blockchain.increaseTimeAsync(ONE_HOUR_IN_SECONDS.toNumber() + 1);

        // Update the subject variables
        subjectIntentHash = intentHash;
      });

      it("should transfer the correct amounts including referrer fee", async () => {
        const initialOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const initialReferrerBalance = await usdcToken.balanceOf(receiver.address);

        await subject();

        const finalOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
        const finalReferrerBalance = await usdcToken.balanceOf(receiver.address);

        const referrerFee = subjectReleaseAmount.mul(ether(0.01)).div(ether(1)); // 1% of release amount

        expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(subjectReleaseAmount.sub(referrerFee));
        expect(finalReferrerBalance.sub(initialReferrerBalance)).to.eq(referrerFee);
      });

      it("should emit an IntentFulfilled event with referrer fee details", async () => {
        const referrerFee = subjectReleaseAmount.mul(ether(0.01)).div(ether(1)); // 1% of release amount

        await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
          intentHash,
          onRamper.address,
          subjectReleaseAmount.sub(referrerFee),        // Amount transferred to the on-ramper
          true,  // manual release
          Currency.USD,
          ""    // Empty payment ID since release is manual
        );
      });

      describe("when protocol fee is also set", async () => {
        beforeEach(async () => {
          await orchestrator.connect(owner.wallet).setProtocolFee(ether(0.02)); // 2% fee
        });

        it("should transfer the correct amounts including both protocol and referrer fees", async () => {
          const initialOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
          const initialFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const initialReferrerBalance = await usdcToken.balanceOf(receiver.address);

          await subject();

          const finalOnRamperBalance = await usdcToken.balanceOf(onRamper.address);
          const finalFeeRecipientBalance = await usdcToken.balanceOf(feeRecipient.address);
          const finalReferrerBalance = await usdcToken.balanceOf(receiver.address);

          const protocolFee = subjectReleaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount
          const referrerFee = subjectReleaseAmount.mul(ether(0.01)).div(ether(1)); // 1% of release amount
          const totalFees = protocolFee.add(referrerFee);

          expect(finalOnRamperBalance.sub(initialOnRamperBalance)).to.eq(subjectReleaseAmount.sub(totalFees));
          expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.eq(protocolFee);
          expect(finalReferrerBalance.sub(initialReferrerBalance)).to.eq(referrerFee);
        });

        it("should emit an IntentFulfilled event with correct fee details", async () => {
          const protocolFee = subjectReleaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount
          const referrerFee = subjectReleaseAmount.mul(ether(0.01)).div(ether(1)); // 1% of release amount
          const totalFees = protocolFee.add(referrerFee);

          await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
            intentHash,
            onRamper.address,
            subjectReleaseAmount.sub(totalFees),
            true,  // manual release
            Currency.USD,
            ""    // Empty payment ID since release is manual
          );
        });
      });
    });

    describe("when the intent does not exist", async () => {
      beforeEach(async () => {
        subjectIntentHash = ZERO_BYTES32;
      });

      it("should revert with IntentDoesNotExist", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "IntentNotFound");
      });
    });

    describe("when a postIntentHook is used", async () => {
      let hookTargetAddress: Address;

      beforeEach(async () => {
        hookTargetAddress = receiver.address;
        const signalIntentDataForHook = ethers.utils.defaultAbiCoder.encode(["address"], [hookTargetAddress]);

        // Create a new intent with post intent hook action
        // Get expiration timestamp for signature
        const currentBlock = await ethers.provider.getBlock("latest");
        const signatureExpiration = BigNumber.from(currentBlock.timestamp + 86400); // 1 day from now

        const gatingServiceSignatureForHook = await generateGatingServiceSignature(
          gatingService,
          orchestrator.address,
          escrow.address,
          ZERO,
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          chainId.toString(),
          signatureExpiration
        );

        // First cancel the existing intent
        await orchestrator.connect(onRamper.wallet).cancelIntent(intentHash);

        // Signal an intent that uses the postIntentHookMock
        const params = await createSignalIntentParams(
          orchestrator.address,
          escrow.address,
          ZERO,
          usdc(50),
          onRamper.address,
          verifier.address,
          Currency.USD,
          depositConversionRate,
          ADDRESS_ZERO,
          ZERO,
          null, // passing null since we already have the signature
          chainId.toString(),
          postIntentHookMock.address,
          signalIntentDataForHook,
          signatureExpiration
        );
        // Override the signature since we generated it manually
        params.gatingServiceSignature = gatingServiceSignatureForHook;
        await orchestrator.connect(onRamper.wallet).signalIntent(params);
        const currentTimestamp = await blockchain.getCurrentTimestamp();
        intentHash = calculateIntentHash(orchestrator.address, currentIntentCounter);
        currentIntentCounter++;  // Increment after signalIntent

        // Increase time to 1 hour + 1 second
        await blockchain.increaseTimeAsync(ONE_HOUR_IN_SECONDS.toNumber() + 1);

        subjectIntentHash = intentHash;
      });

      it("should STILL transfer funds to the intent.to address", async () => {
        const preBalance = await usdcToken.balanceOf(onRamper.address);

        await subject();

        const postBalance = await usdcToken.balanceOf(onRamper.address);
        expect(postBalance.sub(preBalance)).to.eq(subjectReleaseAmount);
      });


      describe("when protocol fee is set with a hook", async () => {
        beforeEach(async () => {
          await orchestrator.connect(owner.wallet).setProtocolFee(ether(0.02)); // 2% fee
        });

        it("should transfer (intent amount - fee) to the intent.to address", async () => {
          const initialIntentToBalance = await usdcToken.balanceOf(onRamper.address);

          await subject();

          const finalIntentToBalance = await usdcToken.balanceOf(onRamper.address);

          const fee = subjectReleaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount
          expect(finalIntentToBalance.sub(initialIntentToBalance)).to.eq(subjectReleaseAmount.sub(fee)); // 49 USDC
        });

        it("should emit IntentFulfilled with correct fee details when hook is used", async () => {
          const fee = subjectReleaseAmount.mul(ether(0.02)).div(ether(1)); // 2% of release amount
          await expect(subject()).to.emit(orchestrator, "IntentFulfilled").withArgs(
            subjectIntentHash,
            onRamper.address,     // Original intent.to
            subjectReleaseAmount.sub(fee),    // Amount transferred to hook's destination
            true,
            Currency.USD,
            ""    // Empty payment ID since release is manual
          );
        });
      });
    });

    describe("when the release amount exceeds the intent amount", async () => {
      beforeEach(async () => {
        subjectReleaseAmount = usdc(60); // More than intent amount of 50
      });

      it("should revert with ReleaseAmountExceedsIntentAmount", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "AmountExceedsLimit");
      });
    });

    describe("when the caller is not the depositor", async () => {
      beforeEach(async () => {
        subjectCaller = onRamperTwo;
      });

      it("should revert with CallerMustBeDepositor", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "UnauthorizedCaller");
      });
    });

    describe("when release amount exceeds intent amount", async () => {
      beforeEach(async () => {
        subjectReleaseAmount = usdc(100); // More than intent amount of 50
      });

      it("should revert with ReleaseAmountExceedsIntentAmount", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "AmountExceedsLimit");
      });
    });

    describe("when partialManualReleaseDelay has not passed", async () => {
      beforeEach(async () => {
        // Set partial manual release delay to 1 day
        await orchestrator.connect(owner.wallet).setPartialManualReleaseDelay(ONE_DAY_IN_SECONDS.toNumber());
      });

      describe("when trying to release partial amount before delay", async () => {
        beforeEach(async () => {
          subjectReleaseAmount = usdc(30); // Partial release
        });

        it("should revert with PartialReleaseNotAllowedYet", async () => {
          await expect(subject()).to.be.revertedWithCustomError(orchestrator, "PartialReleaseNotAllowedYet");
        });
      });

      describe("when trying to release full amount before delay", async () => {
        beforeEach(async () => {
          subjectReleaseAmount = intentAmount; // Full release
        });

        it("should allow full release even before delay", async () => {
          const preBalance = await usdcToken.balanceOf(onRamper.address);

          await subject();

          const postBalance = await usdcToken.balanceOf(onRamper.address);
          expect(postBalance.sub(preBalance)).to.eq(subjectReleaseAmount);
        });
      });
    });
  });

  // Escrow Functions

  describe("#pruneIntents", async () => {
    let subjectIntents: string[];
    let subjectCaller: Account;

    let depositId: BigNumber;
    let intentHashes: string[];
    let intentAmounts: BigNumber[];

    beforeEach(async () => {
      // Create a deposit
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(300),
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
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });

      // Enable multiple intents
      await orchestrator.connect(owner.wallet).setAllowMultipleIntents(true);

      depositId = ZERO;
      intentHashes = [];
      intentAmounts = [usdc(50), usdc(60), usdc(70)];

      // Signal multiple intents
      for (let i = 0; i < 3; i++) {
        const params = await createSignalIntentParams(
          orchestrator.address,
          escrow.address,
          depositId,
          intentAmounts[i],
          onRamper.address,
          verifier.address,
          Currency.USD,
          ether(1.02),
          ADDRESS_ZERO,
          ZERO,
          gatingService,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );

        await orchestrator.connect(onRamper.wallet).signalIntent(params);

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        const intentHash = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter
        );
        currentIntentCounter++;  // Increment after signalIntent
        intentHashes.push(intentHash);

        // Increase time by 1 second
        await blockchain.increaseTimeAsync(1);
      }

      subjectIntents = intentHashes;
      subjectCaller = owner; // Will be escrow in real scenario
    });

    async function subject(): Promise<any> {
      // For testing, we need to set escrow as the caller
      // In production, only escrow can call this function
      await escrowRegistry.connect(owner.wallet).addEscrow(subjectCaller.address);
      const tx = await orchestrator.connect(subjectCaller.wallet).pruneIntents(subjectIntents);
      // Reset orchestrator
      await escrowRegistry.connect(owner.wallet).removeEscrow(subjectCaller.address);
      return tx;
    }

    it("should delete the intents from the intents mapping", async () => {
      // Verify intents exist before pruning
      for (const intentHash of intentHashes) {
        const intent = await orchestrator.getIntent(intentHash);
        expect(intent.owner).to.eq(onRamper.address);
      }

      await subject();

      // Verify intents are deleted after pruning
      for (const intentHash of intentHashes) {
        const intent = await orchestrator.getIntent(intentHash);
        expect(intent.owner).to.eq(ADDRESS_ZERO);
      }
    });

    it("should remove intents from the accountIntents mapping", async () => {
      const preAccountIntents = await orchestrator.getAccountIntents(onRamper.address);
      expect(preAccountIntents.length).to.eq(3);
      for (const intentHash of intentHashes) {
        expect(preAccountIntents).to.include(intentHash);
      }

      await subject();

      const postAccountIntents = await orchestrator.getAccountIntents(onRamper.address);
      expect(postAccountIntents.length).to.eq(0);
    });

    it("should emit IntentPruned events for each intent", async () => {
      const tx = await subject();

      for (let i = 0; i < intentHashes.length; i++) {
        await expect(tx).to.emit(orchestrator, "IntentPruned").withArgs(
          intentHashes[i]
        );
      }
    });

    describe("when some intents have zero bytes32 value", async () => {
      beforeEach(async () => {
        subjectIntents = [intentHashes[0], ZERO_BYTES32, intentHashes[2]];
      });

      it("should only prune non-zero intents", async () => {
        await subject();

        // First intent should be pruned
        const intent0 = await orchestrator.getIntent(intentHashes[0]);
        expect(intent0.owner).to.eq(ADDRESS_ZERO);

        // Second intent should still exist
        const intent1 = await orchestrator.getIntent(intentHashes[1]);
        expect(intent1.owner).to.eq(onRamper.address);

        // Third intent should be pruned
        const intent2 = await orchestrator.getIntent(intentHashes[2]);
        expect(intent2.owner).to.eq(ADDRESS_ZERO);
      });
    });

    describe("when intents don't exist", async () => {
      beforeEach(async () => {
        // Create some non-existent intent hashes
        subjectIntents = [
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent1")),
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent2"))
        ];
      });

      it("should not revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });

      it("should not emit IntentPruned events", async () => {
        const tx = await subject();

        // Since intents don't exist (timestamp == 0), no events should be emitted
        await expect(tx).to.not.emit(orchestrator, "IntentPruned");
      });
    });

    describe("when caller is not the escrow", async () => {
      beforeEach(async () => {
        subjectCaller = maliciousOnRamper;
      });

      it("should revert", async () => {
        await expect(
          orchestrator.connect(subjectCaller.wallet).pruneIntents(subjectIntents)
        ).to.be.revertedWithCustomError(orchestrator, "UnauthorizedEscrowCaller");
      });
    });

    describe("when pruning intents from multiple accounts", async () => {
      let onRamperTwoIntentHash: string;

      beforeEach(async () => {
        // Signal an intent from a different account
        const params = await createSignalIntentParams(
          orchestrator.address,
          escrow.address,
          depositId,
          usdc(40),
          onRamperTwo.address,
          verifier.address,
          Currency.USD,
          ether(1.02),
          ADDRESS_ZERO,
          ZERO,
          gatingService,
          chainId.toString(),
          ADDRESS_ZERO,
          "0x"
        );

        await orchestrator.connect(onRamperTwo.wallet).signalIntent(params);

        const currentTimestamp = await blockchain.getCurrentTimestamp();
        onRamperTwoIntentHash = calculateIntentHash(
          orchestrator.address,
          currentIntentCounter
        );
        currentIntentCounter++;  // Increment after signalIntent

        // Add this intent to the list to be pruned
        subjectIntents = [intentHashes[0], onRamperTwoIntentHash];
      });

      it("should correctly update accountIntents for both accounts", async () => {
        // Check pre-state
        const preOnRamperIntents = await orchestrator.getAccountIntents(onRamper.address);
        const preOnRamperTwoIntents = await orchestrator.getAccountIntents(onRamperTwo.address);
        expect(preOnRamperIntents.length).to.eq(3);
        expect(preOnRamperTwoIntents.length).to.eq(1);

        await subject();

        // Check post-state
        const postOnRamperIntents = await orchestrator.getAccountIntents(onRamper.address);
        const postOnRamperTwoIntents = await orchestrator.getAccountIntents(onRamperTwo.address);

        // onRamper should have 2 intents left (3 - 1 pruned)
        expect(postOnRamperIntents.length).to.eq(2);
        expect(postOnRamperIntents).to.not.include(intentHashes[0]);
        expect(postOnRamperIntents).to.include(intentHashes[1]);
        expect(postOnRamperIntents).to.include(intentHashes[2]);

        // onRamperTwo should have 0 intents left
        expect(postOnRamperTwoIntents.length).to.eq(0);
      });
    });

    describe("when array is empty", async () => {
      beforeEach(async () => {
        subjectIntents = [];
      });

      it("should not revert", async () => {
        await expect(subject()).to.not.be.reverted;
      });

      it("should not emit any events", async () => {
        const tx = await subject();
        await expect(tx).to.not.emit(orchestrator, "IntentPruned");
      });
    });
  });

  // Governance Functions

  describe("#setEscrowRegistry", async () => {
    let subjectEscrow: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectEscrow = onRamper.address; // Mock new escrow address
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).setEscrowRegistry(subjectEscrow);
    }

    it("should set the escrow address", async () => {
      await subject();

      const escrowAddress = await orchestrator.escrowRegistry();
      expect(escrowAddress).to.eq(subjectEscrow);
    });

    it("should emit EscrowUpdated event", async () => {
      await expect(subject()).to.emit(orchestrator, "EscrowRegistryUpdated").withArgs(subjectEscrow);
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("when escrow is zero address", async () => {
      beforeEach(async () => {
        subjectEscrow = ADDRESS_ZERO;
      });

      it("should revert with EscrowCannotBeZeroAddress", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "ZeroAddress");
      });
    });
  });

  describe("#setProtocolFee", async () => {
    let subjectProtocolFee: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectProtocolFee = ether(0.02);
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).setProtocolFee(subjectProtocolFee);
    }

    it("should set the protocol fee", async () => {
      await subject();

      const protocolFee = await orchestrator.protocolFee();
      expect(protocolFee).to.eq(subjectProtocolFee);
    });

    it("should emit ProtocolFeeUpdated event", async () => {
      await expect(subject()).to.emit(orchestrator, "ProtocolFeeUpdated").withArgs(subjectProtocolFee);
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("when protocol fee exceeds maximum", async () => {
      beforeEach(async () => {
        subjectProtocolFee = ether(0.1); // 10% > 5% max
      });

      it("should revert with ProtocolFeeExceedsMaximum", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "FeeExceedsMaximum");
      });
    });
  });

  describe("#setProtocolFeeRecipient", async () => {
    let subjectProtocolFeeRecipient: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectProtocolFeeRecipient = owner.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).setProtocolFeeRecipient(subjectProtocolFeeRecipient);
    }

    it("should set the correct protocol fee recipient", async () => {
      const preProtocolFeeRecipient = await orchestrator.protocolFeeRecipient();

      expect(preProtocolFeeRecipient).to.eq(feeRecipient.address);

      await subject();

      const postProtocolFeeRecipient = await orchestrator.protocolFeeRecipient();

      expect(postProtocolFeeRecipient).to.eq(subjectProtocolFeeRecipient);
    });

    it("should emit a ProtocolFeeRecipientUpdated event", async () => {
      const tx = await subject();

      expect(tx).to.emit(orchestrator, "ProtocolFeeRecipientUpdated").withArgs(subjectProtocolFeeRecipient);
    });

    describe("when the passed fee recipient is the zero address", async () => {
      beforeEach(async () => {
        subjectProtocolFeeRecipient = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "ZeroAddress");
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

  describe("#setPartialManualReleaseDelay", async () => {
    let subjectPartialManualReleaseDelay: BigNumber;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectPartialManualReleaseDelay = BigNumber.from(7200); // 2 hours
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).setPartialManualReleaseDelay(subjectPartialManualReleaseDelay);
    }

    it("should set the partial manual release delay", async () => {
      await subject();

      const partialManualReleaseDelay = await orchestrator.partialManualReleaseDelay();
      expect(partialManualReleaseDelay).to.eq(subjectPartialManualReleaseDelay);
    });

    it("should emit PartialManualReleaseDelayUpdated event", async () => {
      await expect(subject()).to.emit(orchestrator, "PartialManualReleaseDelayUpdated").withArgs(subjectPartialManualReleaseDelay);
    });

    describe("when the caller is not the owner", async () => {
      beforeEach(async () => {
        subjectCaller = onRamper;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("when setting it to below 15 minutes", async () => {
      beforeEach(async () => {
        subjectPartialManualReleaseDelay = ONE;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "AmountBelowMin");
      });
    });
  });

  describe("#setPostIntentHookRegistry", async () => {
    let subjectPostIntentHookRegistry: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      const newRegistry = await deployer.deployPostIntentHookRegistry();
      subjectPostIntentHookRegistry = newRegistry.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).setPostIntentHookRegistry(subjectPostIntentHookRegistry);
    }

    it("should set the correct post intent hook registry", async () => {
      const preRegistry = await orchestrator.postIntentHookRegistry();
      expect(preRegistry).to.not.eq(subjectPostIntentHookRegistry);

      await subject();

      const postRegistry = await orchestrator.postIntentHookRegistry();
      expect(postRegistry).to.eq(subjectPostIntentHookRegistry);
    });

    it("should emit a PostIntentHookRegistryUpdated event", async () => {
      await expect(subject()).to.emit(orchestrator, "PostIntentHookRegistryUpdated").withArgs(subjectPostIntentHookRegistry);
    });

    describe("when the registry is zero address", async () => {
      beforeEach(async () => {
        subjectPostIntentHookRegistry = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "ZeroAddress");
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

  describe("#setRelayerRegistry", async () => {
    let subjectRelayerRegistry: Address;
    let subjectCaller: Account;

    beforeEach(async () => {
      const newRegistry = await deployer.deployRelayerRegistry();

      subjectRelayerRegistry = newRegistry.address;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).setRelayerRegistry(subjectRelayerRegistry);
    }

    it("should set the correct relayer registry", async () => {
      const preRegistry = await orchestrator.relayerRegistry();
      expect(preRegistry).to.not.eq(subjectRelayerRegistry);

      await subject();

      const postRegistry = await orchestrator.relayerRegistry();
      expect(postRegistry).to.eq(subjectRelayerRegistry);
    });

    it("should emit a RelayerRegistryUpdated event", async () => {
      await expect(subject()).to.emit(orchestrator, "RelayerRegistryUpdated").withArgs(subjectRelayerRegistry);
    });

    describe("when the registry is zero address", async () => {
      beforeEach(async () => {
        subjectRelayerRegistry = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWithCustomError(orchestrator, "ZeroAddress");
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

  describe("#setAllowMultipleIntents", async () => {
    let subjectAllowMultiple: boolean;
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectAllowMultiple = true;
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return await orchestrator.connect(subjectCaller.wallet).setAllowMultipleIntents(subjectAllowMultiple);
    }

    it("should correctly set allowMultipleIntents", async () => {
      await subject();

      const allowMultiple = await orchestrator.allowMultipleIntents();
      expect(allowMultiple).to.eq(subjectAllowMultiple);
    });

    it("should emit the correct AllowMultipleIntentsUpdated event", async () => {
      await expect(subject()).to.emit(orchestrator, "AllowMultipleIntentsUpdated").withArgs(
        subjectAllowMultiple
      );
    });

    describe("when setting to false", async () => {
      beforeEach(async () => {
        await orchestrator.setAllowMultipleIntents(true);
        subjectAllowMultiple = false;
      });

      it("should correctly set allowMultipleIntents to false", async () => {
        await subject();

        const allowMultiple = await orchestrator.allowMultipleIntents();
        expect(allowMultiple).to.be.false;
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

  describe("#pauseOrchestrator", async () => {
    let subjectCaller: Account;

    beforeEach(async () => {
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).pauseOrchestrator();
    }

    it("should pause the orchestrator", async () => {
      await subject();

      const isPaused = await orchestrator.paused();
      expect(isPaused).to.eq(true);
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

  describe("#unpauseOrchestrator", async () => {
    let subjectCaller: Account;

    beforeEach(async () => {
      await orchestrator.connect(owner.wallet).pauseOrchestrator();
      subjectCaller = owner;
    });

    async function subject(): Promise<any> {
      return orchestrator.connect(subjectCaller.wallet).unpauseOrchestrator();
    }

    it("should unpause the orchestrator", async () => {
      await subject();

      const isPaused = await orchestrator.paused();
      expect(isPaused).to.eq(false);
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

  // Getter Functions

  describe("#getAccountIntents", async () => {
    beforeEach(async () => {
      // Enable multiple intents for testing
      await orchestrator.connect(owner.wallet).setAllowMultipleIntents(true);

      // Create a deposit
      await usdcToken.connect(offRamper.wallet).approve(escrow.address, usdc(10000));
      await escrow.connect(offRamper.wallet).createDeposit({
        token: usdcToken.address,
        amount: usdc(1000),
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
        intentGuardian: ADDRESS_ZERO,
        referrer: ADDRESS_ZERO,
        referrerFee: ZERO
      });
    });

    it("should return empty array for account with no intents", async () => {
      const intents = await orchestrator.getAccountIntents(onRamper.address);
      expect(intents.length).to.eq(0);
    });

    it("should return all intents for an account", async () => {
      // Signal two intents
      const params1 = await createSignalIntentParams(
        orchestrator.address,
        escrow.address,
        ZERO,
        usdc(50),
        receiver.address,
        verifier.address,
        Currency.USD,
        ether(1.02),
        ADDRESS_ZERO,
        ZERO,
        gatingService,
        chainId.toString(),
        ADDRESS_ZERO,
        "0x"
      );
      await orchestrator.connect(onRamper.wallet).signalIntent(params1);

      // Add a small delay to prevent gas estimation issues
      await new Promise(resolve => setTimeout(resolve, 100));

      const params2 = await createSignalIntentParams(
        orchestrator.address,
        escrow.address,
        ZERO,
        usdc(75),
        receiver.address,
        verifier.address,
        Currency.USD,
        ether(1.02),
        ADDRESS_ZERO,
        ZERO,
        gatingService,
        chainId.toString(),
        ADDRESS_ZERO,
        "0x"
      );
      await orchestrator.connect(onRamper.wallet).signalIntent(params2);

      const intents = await orchestrator.getAccountIntents(onRamper.address);
      expect(intents.length).to.eq(2);
    });
  });
});