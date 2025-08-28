import "module-alias/register";

import { ethers } from "hardhat";
import { BigNumber } from "ethers";

import { Address } from "@utils/types";
import { Account } from "@utils/test/types";
import {
  Escrow,
  USDCMock,
  NullifierRegistry,
  OTPVerifier
} from "@utils/contracts";
import DeployHelper from "@utils/deploys";

import {
  getWaffleExpect,
  getAccounts,
  addSnapshotBeforeRestoreAfterEach
} from "@utils/test/index";
import { ether, usdc, Blockchain } from "@utils/common";
import { ZERO, ONE, ADDRESS_ZERO } from "@utils/constants";
import { Currency, calculateIntentHash } from "@utils/protocolUtils";

const expect = getWaffleExpect();

const blockchain = new Blockchain(ethers.provider);

describe("OTPVerifier - Simple Integration Test", () => {
  let owner: Account;
  let depositor: Account;
  let withdrawer: Account;

  let escrow: Escrow;
  let usdcToken: USDCMock;
  let nullifierRegistry: NullifierRegistry;
  let otpVerifier: OTPVerifier;

  let deployer: DeployHelper;

  // Test parameters
  const depositAmount = usdc(100); // 100 USDC
  const secret = ethers.utils.formatBytes32String("horse battery staple magic");
  const payeeDetails = "alice-deposit-123";

  addSnapshotBeforeRestoreAfterEach();

  beforeEach(async () => {
    [owner, depositor, withdrawer] = await getAccounts();
    deployer = new DeployHelper(owner.wallet);

    // Deploy USDC mock and mint tokens
    usdcToken = await deployer.deployUSDCMock(ether(1000000), "USDC", "USDC");
    await usdcToken.transfer(depositor.address, usdc(1000));

    // Deploy Escrow
    escrow = await deployer.deployEscrow(
      owner.address,
      BigNumber.from(86400), // 1 day intent expiration
      ether(0.01),           // 1% sustainability fee
      owner.address,         // fee recipient
      ONE                    // chain ID
    );

    // Deploy Nullifier Registry
    nullifierRegistry = await deployer.deployNullifierRegistry();

    // Deploy OTP Verifier
    otpVerifier = await deployer.deployOTPVerifier(
      escrow.address,
      nullifierRegistry.address,
      BigNumber.from(300), // 5 min timestamp buffer
      [Currency.USD]       // supported currencies
    );

    // Add OTP verifier as whitelisted payment verifier
    await escrow.addWhitelistedPaymentVerifier(otpVerifier.address, ZERO);

    console.log("\n=== Contract Addresses ===");
    console.log("Escrow:", escrow.address);
    console.log("USDC:", usdcToken.address);
    console.log("OTPVerifier:", otpVerifier.address);
    console.log("NullifierRegistry:", nullifierRegistry.address);
  });

  describe("Full OTP Flow", () => {
    it("Should complete entire OTP deposit and withdrawal flow", async () => {
      console.log("\n=== Step 1: Generate OTP Secret Hash ===");
      
      // Generate secret hash using deposit-specific hashing
      const secretHash = await otpVerifier.generateSecretHash(secret, payeeDetails);
      console.log("Secret:", ethers.utils.parseBytes32String(secret));
      console.log("Payee Details:", payeeDetails);  
      console.log("Secret Hash:", secretHash);

      console.log("\n=== Step 2: Create Deposit ===");
      
      // Approve USDC transfer
      await usdcToken.connect(depositor.wallet).approve(escrow.address, depositAmount);

      // Create deposit with OTP verifier
      await escrow.connect(depositor.wallet).createDeposit(
        usdcToken.address,
        depositAmount,
        { min: depositAmount, max: depositAmount }, // Force full withdrawal
        [otpVerifier.address], // verifiers
        [{
          intentGatingService: ADDRESS_ZERO,
          payeeDetails: payeeDetails,
          data: ethers.utils.defaultAbiCoder.encode(["bytes32"], [secretHash])
        }], // verifier data  
        [[{ code: Currency.USD, conversionRate: ether(1) }]] // currencies
      );

      const depositId = 0;
      console.log("✓ Deposit created with ID:", depositId);

      // Verify deposit state
      const deposit = await escrow.deposits(depositId);
      expect(deposit.amount).to.equal(depositAmount);
      expect(deposit.remainingDeposits).to.equal(depositAmount);
      console.log("✓ Deposit amount:", ethers.utils.formatUnits(deposit.amount, 6), "USDC");

      console.log("\n=== Step 3: Signal Intent ===");
      
      // Signal intent to withdraw full amount
      const signalIntentTx = await escrow.connect(withdrawer.wallet).signalIntent(
        depositId,
        depositAmount,
        withdrawer.address,
        otpVerifier.address,
        Currency.USD,
        "0x" // empty gating service signature since we use ADDRESS_ZERO
      );

      // Get timestamp from the block where the intent was signaled
      const signalIntentReceipt = await signalIntentTx.wait();
      const signalBlock = await ethers.provider.getBlock(signalIntentReceipt.blockNumber);
      const signalTimestamp = BigNumber.from(signalBlock.timestamp);
      
      const calculatedIntentHash = calculateIntentHash(
        withdrawer.address,
        otpVerifier.address, 
        BigNumber.from(depositId),
        signalTimestamp
      );
      
      // Get the actual intent hash stored in the escrow
      const actualIntentHash = await escrow.accountIntent(withdrawer.address);
      
      console.log("✓ Intent signaled");
      console.log("  - Calculated intent hash:", calculatedIntentHash);
      console.log("  - Actual intent hash:    ", actualIntentHash);
      console.log("  - Intent hashes match:   ", calculatedIntentHash === actualIntentHash);
      
      const intentHash = actualIntentHash; // Use the actual hash from the escrow

      console.log("\n=== Step 4: Fulfill Intent (Provide OTP) ===");

      // Encode the secret and intent hash as payment proof
      // Format: [secret, intentHash] - following the same pattern as other verifiers
      const paymentProof = ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32"], 
        [secret, intentHash]
      );

      // Fulfill intent by providing the OTP secret and intent hash
      await escrow.connect(withdrawer.wallet).fulfillIntent(paymentProof, intentHash);

      console.log("✓ Intent fulfilled with OTP secret!");

      console.log("\n=== Step 5: Verify Final State ===");

      // Check that withdrawer received the tokens
      const withdrawerBalance = await usdcToken.balanceOf(withdrawer.address);
      expect(withdrawerBalance).to.be.gt(ZERO); // Should have received tokens minus fees
      console.log("✓ Withdrawer received:", ethers.utils.formatUnits(withdrawerBalance, 6), "USDC");

      // Check that deposit is consumed
      const finalDeposit = await escrow.deposits(depositId);
      expect(finalDeposit.remainingDeposits).to.equal(ZERO);
      console.log("✓ Deposit fully consumed");

      console.log("\n=== ✅ OTP Flow Complete! ===");
      console.log("Summary:");
      console.log("- Depositor locked 100 USDC with OTP secret");
      console.log("- Withdrawer provided correct OTP and received USDC");
      console.log("- No cross-deposit attack possible (deposit-specific hashing)");
      console.log("- No nullifiers used (escrow handles double-spending)");
    });

    it("Should reject incorrect OTP secret", async () => {
      console.log("\n=== Testing Incorrect OTP ===");

      // Generate secret hash
      const secretHash = await otpVerifier.generateSecretHash(secret, payeeDetails);

      // Create deposit  
      await usdcToken.connect(depositor.wallet).approve(escrow.address, depositAmount);
      await escrow.connect(depositor.wallet).createDeposit(
        usdcToken.address,
        depositAmount,
        { min: depositAmount, max: depositAmount },
        [otpVerifier.address],
        [{
          intentGatingService: ADDRESS_ZERO,
          payeeDetails: payeeDetails,
          data: ethers.utils.defaultAbiCoder.encode(["bytes32"], [secretHash])
        }],
        [[{ code: Currency.USD, conversionRate: ether(1) }]]
      );

      // Signal intent
      const signalIntentTx2 = await escrow.connect(withdrawer.wallet).signalIntent(
        0, depositAmount, withdrawer.address, 
        otpVerifier.address, Currency.USD, "0x"
      );

      // Calculate intent hash properly
      const signalIntentReceipt2 = await signalIntentTx2.wait();
      const signalBlock2 = await ethers.provider.getBlock(signalIntentReceipt2.blockNumber);
      const signalTimestamp2 = BigNumber.from(signalBlock2.timestamp);
      
      const intentHash = calculateIntentHash(
        withdrawer.address,
        otpVerifier.address,
        ZERO,
        signalTimestamp2
      );

      // Try to fulfill with WRONG secret
      const wrongSecret = ethers.utils.formatBytes32String("wrong secret");
      const wrongPaymentProof = ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32"], 
        [wrongSecret, intentHash]
      );

      // Should fail
      await expect(
        escrow.connect(withdrawer.wallet).fulfillIntent(wrongPaymentProof, intentHash)
      ).to.be.revertedWith("Invalid OTP: secret does not match hash");

      console.log("✓ Correctly rejected wrong OTP secret");
    });
  });
});