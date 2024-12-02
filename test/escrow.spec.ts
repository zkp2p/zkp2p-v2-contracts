import "module-alias/register";

import { ethers } from "hardhat";

import {
  Address,
  RevolutRegistrationData,
  RevolutRegistrationProof,
  RevolutSendData,
} from "@utils/types";
import { Account } from "@utils/test/types";
import {
  Escrow,
  USDCMock,
  PaymentVerifierMock
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

const expect = getWaffleExpect();

const blockchain = new Blockchain(ethers.provider);

describe("Escrow", () => {
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

  let ramp: Escrow;
  let usdcToken: USDCMock;

  let verifier: PaymentVerifierMock;
  let otherVerifier: PaymentVerifierMock;
  let deployer: DeployHelper;

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
      witness
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    await usdcToken.transfer(offRamper.address, usdc(10000));

    ramp = await deployer.deployEscrow(
      owner.address,
      ONE_DAY_IN_SECONDS,                // 1 day intent expiration period
      ZERO,                              // Sustainability fee
      feeRecipient.address
    );

    verifier = await deployer.deployPaymentVerifierMock();
    otherVerifier = await deployer.deployPaymentVerifierMock();

    await ramp.addWhitelistedPaymentVerifier(verifier.address, ZERO);
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
  });

  describe("#createDeposit", async () => {
    let subjectToken: Address;
    let subjectAmount: BigNumber;
    let subjectIntentAmountRange: Escrow.RangeStruct;
    let subjectVerifiers: Address[];
    let subjectVerificationData: Escrow.PaymentVerificationDataStruct[];

    beforeEach(async () => {
      subjectToken = usdcToken.address;
      subjectAmount = usdc(100);
      subjectIntentAmountRange = { min: usdc(10), max: usdc(200) }; // Example range
      subjectVerifiers = [verifier.address];
      subjectVerificationData = [{
        intentGatingService: gatingService.address,
        conversionRate: ether(1.08), // 1 USDC = 1.08 EUR
        payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
        data: "0x"
      }];

      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
    });

    async function subject(): Promise<any> {
      return ramp.connect(offRamper.wallet).createDeposit(
        subjectToken,
        subjectAmount,
        subjectIntentAmountRange,
        subjectVerifiers,
        subjectVerificationData
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

      const depositView = await ramp.getDeposit(0);

      expect(depositView.deposit.depositor).to.eq(offRamper.address);
      expect(depositView.deposit.token).to.eq(subjectToken);
      expect(depositView.deposit.amount).to.eq(subjectAmount);
      expect(depositView.deposit.intentAmountRange.min).to.eq(subjectIntentAmountRange.min);
      expect(depositView.deposit.intentAmountRange.max).to.eq(subjectIntentAmountRange.max);
      expect(depositView.verifiers[0].verifier).to.eq(subjectVerifiers[0]);
      expect(depositView.verifiers[0].verificationData.intentGatingService).to.eq(subjectVerificationData[0].intentGatingService);
      expect(depositView.verifiers[0].verificationData.conversionRate).to.eq(subjectVerificationData[0].conversionRate);
      expect(depositView.verifiers[0].verificationData.payeeDetailsHash).to.eq(subjectVerificationData[0].payeeDetailsHash);
      expect(depositView.verifiers[0].verificationData.data).to.eq(subjectVerificationData[0].data);
      expect(depositView.deposit.acceptingIntents).to.be.true;
    });

    it("should increment the deposit counter", async () => {
      const preDepositCounter = await ramp.depositCounter();

      await subject();

      const postDepositCounter = await ramp.depositCounter();
      expect(postDepositCounter).to.eq(preDepositCounter.add(1));
    });

    it("should correctly update the depositVerifierData mapping", async () => {
      await subject();

      const verificationData = await ramp.depositVerifierData(0, subjectVerifiers[0]);

      expect(verificationData.intentGatingService).to.eq(subjectVerificationData[0].intentGatingService);
      expect(verificationData.conversionRate).to.eq(subjectVerificationData[0].conversionRate);
      expect(verificationData.payeeDetailsHash).to.eq(subjectVerificationData[0].payeeDetailsHash);
      expect(verificationData.data).to.eq(subjectVerificationData[0].data);
    });

    // todo: figure out how to test this given that verifiers is an array
    it("should emit a DepositReceived event", async () => {
      await expect(subject()).to.emit(ramp, "DepositReceived").withArgs(
        ZERO, // depositId starts at 0
        offRamper.address,
        subjectVerifiers[0],
        subjectToken,
        subjectAmount,
        subjectVerificationData[0].conversionRate
      );
    });

    describe("when the conversion rate is zero", async () => {
      beforeEach(async () => {
        subjectVerificationData[0].conversionRate = ZERO;
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
    });

    describe("when there are duplicate verifiers", async () => {
      beforeEach(async () => {
        subjectVerifiers = [verifier.address, verifier.address];
        subjectVerificationData = [
          {
            intentGatingService: gatingService.address,
            conversionRate: ether(1),
            payeeDetailsHash: ethers.utils.formatBytes32String("test"),
            data: "0x"
          },
          {
            intentGatingService: gatingService.address,
            conversionRate: ether(1),
            payeeDetailsHash: ethers.utils.formatBytes32String("test"),
            data: "0x"
          }
        ];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Verifier already exists");
      });
    });
  });

  const generateGatingServiceSignature = async (depositId: BigNumber, amount: BigNumber, to: Address, processor: Address) => {
    const messageHash = ethers.utils.solidityKeccak256(
      ["uint256", "uint256", "address", "address"],
      [depositId, amount, to, processor]
    );
    return await gatingService.wallet.signMessage(ethers.utils.arrayify(messageHash));
  }

  describe("#signalIntent", async () => {
    let subjectDepositId: BigNumber;
    let subjectAmount: BigNumber;
    let subjectTo: Address;
    let subjectVerifier: Address;
    let subjectGatingServiceSignature: string;
    let subjectCaller: Account;

    beforeEach(async () => {
      // Create a deposit first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(100),
        { min: usdc(10), max: usdc(200) },
        [verifier.address],
        [{
          intentGatingService: gatingService.address,
          conversionRate: ether(1.08),
          payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }]
      );

      subjectDepositId = ZERO;
      subjectAmount = usdc(50);
      subjectTo = receiver.address;
      subjectVerifier = verifier.address;
      subjectGatingServiceSignature = await generateGatingServiceSignature(
        subjectDepositId,
        subjectAmount,
        subjectTo,
        subjectVerifier
      );

      subjectCaller = onRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).signalIntent(
        subjectDepositId,
        subjectAmount,
        subjectTo,
        subjectVerifier,
        subjectGatingServiceSignature
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

      const intent = await ramp.intents(intentHash);

      expect(intent.owner).to.eq(subjectCaller.address);
      expect(intent.paymentVerifier).to.eq(subjectVerifier);
      expect(intent.to).to.eq(subjectTo);
      expect(intent.depositId).to.eq(subjectDepositId);
      expect(intent.amount).to.eq(subjectAmount);
      expect(intent.timestamp).to.eq(currentTimestamp);
    });

    it("should update the deposit mapping correctly", async () => {
      const preDeposit = await ramp.deposits(subjectDepositId);

      await subject();

      const intentHash = calculateIntentHash(
        subjectCaller.address,
        subjectVerifier,
        subjectDepositId,
        await blockchain.getCurrentTimestamp()
      );

      const postDeposit = await ramp.getDeposit(subjectDepositId);

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

      const accountIntents = await ramp.getAccountIntents(subjectCaller.address);
      const intents = accountIntents.map((intent) => intent.intentHash);
      expect(intents).to.include(intentHash);
    });

    it("should emit an IntentSignaled event", async () => {
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
          subjectDepositId,
          subjectAmount,
          subjectTo,
          subjectVerifier
        );
      });

      it("should prune the old intent and update the deposit mapping correctly", async () => {
        const preDeposit = await ramp.getDeposit(subjectDepositId);

        await subject();

        const newIntentHash = calculateIntentHash(
          subjectCaller.address,
          subjectVerifier,
          subjectDepositId,
          await blockchain.getCurrentTimestamp()
        );

        const postDeposit = await ramp.getDeposit(subjectDepositId);

        expect(postDeposit.deposit.outstandingIntentAmount).to.eq(subjectAmount);
        expect(postDeposit.deposit.remainingDeposits).to.eq(preDeposit.deposit.remainingDeposits.sub(usdc(10))); // 10 usdc difference between old and new intent
        expect(postDeposit.deposit.intentHashes).to.include(newIntentHash);
        expect(postDeposit.deposit.intentHashes).to.not.include(oldIntentHash);
      });

      it("should delete the original intent from the intents mapping", async () => {
        await subject();

        const intent = await ramp.intents(oldIntentHash);

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

    describe("when the deposit is not accepting intents", async () => {
      beforeEach(async () => {
        // Create and signal an intent first to lock some liquidity
        await ramp.connect(onRamper.wallet).signalIntent(
          subjectDepositId,
          usdc(50),
          receiver.address,
          verifier.address,
          await generateGatingServiceSignature(
            subjectDepositId,
            usdc(50),
            receiver.address,
            verifier.address
          )
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
  });

  describe("#fulfillIntent", async () => {
    let subjectProof: string;
    let subjectIntentHash: string;
    let subjectCaller: Account;

    let intentHash: string;
    let payeeDetailsHash: string;

    beforeEach(async () => {
      // Create a deposit and signal an intent first
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
      payeeDetailsHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails"));
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
          conversionRate: ether(1.08),
          payeeDetailsHash: payeeDetailsHash,
          data: depositData
        }]
      );

      const gatingServiceSignature = await generateGatingServiceSignature(ZERO, usdc(50), onRamper.address, verifier.address);
      await ramp.connect(onRamper.wallet).signalIntent(
        ZERO, // depositId
        usdc(50),
        onRamper.address,
        verifier.address,
        gatingServiceSignature
      );
      const currentTimestamp = await blockchain.getCurrentTimestamp();
      intentHash = calculateIntentHash(onRamper.address, verifier.address, ZERO, currentTimestamp);

      // Prepare the proof and processor for the onRamp function
      subjectProof = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "bytes32", "bytes32"],
        [usdc(50), currentTimestamp, payeeDetailsHash, intentHash]
      );
      subjectIntentHash = intentHash;
      subjectCaller = onRamper;
    });

    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).fulfillIntent(subjectProof, subjectIntentHash);
    }

    it("should transfer the correct amount to the on-ramper", async () => {
      const initialBalance = await usdcToken.balanceOf(onRamper.address);

      await subject();

      const finalBalance = await usdcToken.balanceOf(onRamper.address);
      expect(finalBalance.sub(initialBalance)).to.eq(usdc(50));
    });

    it("should prune the intent", async () => {
      await subject();

      const intent = await ramp.intents(subjectIntentHash);

      expect(intent.owner).to.eq(ADDRESS_ZERO); // Intent should be deleted
    });

    it("should update the deposit balances correctly", async () => {
      const preDeposit = await ramp.deposits(ZERO);

      await subject();

      const postDeposit = await ramp.deposits(ZERO);
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
          ["uint256", "uint256", "bytes32", "bytes32"],
          [usdc(50), currentTimestamp, payeeDetailsHash, ZERO_BYTES32]
        );
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Invalid intent hash");
      });
    });

    describe("when the payment is invalid", async () => {
      beforeEach(async () => {
        subjectProof = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "bytes32", "bytes32"],
          [usdc(40), await blockchain.getCurrentTimestamp(), payeeDetailsHash, ZERO_BYTES32]
        );

        // await processor.setShouldVerifyPayment(true);
        await verifier.setShouldReturnFalse(true);
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Payment verification failed");
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
          conversionRate: ether(1.08),
          payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }]
      );

      // Signal an intent
      const gatingServiceSignature = await generateGatingServiceSignature(ZERO, usdc(50), receiver.address, verifier.address);
      await ramp.connect(onRamper.wallet).signalIntent(
        ZERO,
        usdc(50),
        receiver.address,
        verifier.address,
        gatingServiceSignature
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

      const intent = await ramp.intents(subjectIntentHash);

      expect(intent.owner).to.eq(ADDRESS_ZERO);
      expect(intent.amount).to.eq(ZERO);
    });

    it("should correctly update state in the deposit mapping", async () => {
      const preDeposit = await ramp.getDeposit(ZERO);

      await subject();

      const postDeposit = await ramp.getDeposit(ZERO);

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

        const gatingServiceSignature = await generateGatingServiceSignature(ZERO, usdc(50), receiver.address, verifier.address);
        await ramp.connect(onRamper.wallet).signalIntent(
          ZERO,
          usdc(50),
          receiver.address,
          verifier.address,
          gatingServiceSignature
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

        const deposit = await ramp.deposits(ZERO);
        expect(deposit.depositor).to.eq(ADDRESS_ZERO);
      });

      it("should emit a DepositClosed event", async () => {
        await expect(subject()).to.emit(ramp, "DepositClosed").withArgs(
          ZERO,
          offRamper.address
        );
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
          conversionRate: ether(1.08),
          payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }]
      );

      // Signal an intent
      const gatingServiceSignature = await generateGatingServiceSignature(ZERO, usdc(50), onRamper.address, verifier.address);
      await ramp.connect(onRamper.wallet).signalIntent(
        ZERO, // Assuming depositId is ZERO for simplicity
        usdc(50),
        onRamper.address,
        verifier.address,
        gatingServiceSignature
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
      const preDeposit = await ramp.deposits(ZERO);

      await subject();

      const postDeposit = await ramp.deposits(ZERO);
      const intent = await ramp.intents(subjectIntentHash);

      expect(intent.owner).to.eq(ADDRESS_ZERO); // Intent should be deleted
      expect(postDeposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.sub(usdc(50)));
      expect(postDeposit.remainingDeposits).to.eq(preDeposit.remainingDeposits.add(usdc(50)));
    });

    it("should remove the intent from the accountIntents mapping", async () => {
      await subject();

      const accountIntents = await ramp.getAccountIntents(onRamper.address);

      expect(accountIntents.map(intent => intent.intentHash).includes(subjectIntentHash)).to.be.false;
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
          conversionRate: ether(1.08),
          payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payeeDetails")),
          data: "0x"
        }]
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
      const preDeposit = await ramp.deposits(subjectDepositId);
      expect(preDeposit.depositor).to.not.eq(ADDRESS_ZERO);

      await subject();

      const postDeposit = await ramp.deposits(subjectDepositId);
      expect(postDeposit.depositor).to.eq(ADDRESS_ZERO);
    });

    it("should remove the deposit from the user deposits mapping", async () => {
      const preUserDeposits = await ramp.getAccountDeposits(offRamper.address);
      expect(preUserDeposits.some(deposit => deposit.depositId.eq(subjectDepositId))).to.be.true;

      await subject();

      const postUserDeposits = await ramp.getAccountDeposits(offRamper.address);
      expect(postUserDeposits.some(deposit => deposit.depositId.eq(subjectDepositId))).to.be.false;
    });

    it("should remove the deposit verifier data", async () => {
      const preVerifierData = await ramp.depositVerifierData(subjectDepositId, verifier.address);
      expect(preVerifierData.intentGatingService).to.not.eq(ADDRESS_ZERO);

      await subject();

      const postVerifierData = await ramp.depositVerifierData(subjectDepositId, verifier.address);
      expect(postVerifierData.intentGatingService).to.eq(ADDRESS_ZERO);
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
          subjectDepositId,
          usdc(50),
          receiver.address,
          verifier.address
        );

        await ramp.connect(onRamper.wallet).signalIntent(
          subjectDepositId,
          usdc(50),
          receiver.address,
          verifier.address,
          gatingServiceSignature
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

        const deposit = await ramp.deposits(subjectDepositId);

        expect(deposit.depositor).to.not.eq(ADDRESS_ZERO);
        expect(deposit.remainingDeposits).to.eq(ZERO);
        expect(deposit.outstandingIntentAmount).to.eq(usdc(50));
      });

      it("should set the deposit to not accepting intents", async () => {
        await subject();

        const deposit = await ramp.deposits(subjectDepositId);
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

          const deposit = await ramp.deposits(subjectDepositId);
          expect(deposit.depositor).to.eq(ADDRESS_ZERO);
        });

        it("should delete the intent", async () => {
          const preIntent = await ramp.intents(intentHash);
          expect(preIntent.amount).to.eq(usdc(50));

          await subject();

          const postIntent = await ramp.intents(intentHash);

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
    });
  });

  // GOVERNANCE FUNCTIONS

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
});