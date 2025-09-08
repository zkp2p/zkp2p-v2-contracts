import "module-alias/register";
import { deployments, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ether, usdc } from "@utils/common/units";
import { Currency } from "@utils/protocolUtils";
import { ADDRESS_ZERO, ZERO } from "@utils/constants";

// Configuration for test deposits with only registered payment methods
const DEPOSIT_CONFIGS = [
    {
        amount: usdc(500),
        minIntent: usdc(50),
        maxIntent: usdc(200),
        paymentMethod: "venmo",
        payeeEmail: "test1@venmo.com",
        currencies: [Currency.USD],
        referrer: true,
        delegate: false,
    },
    {
        amount: usdc(1000),
        minIntent: usdc(100),
        maxIntent: usdc(400),
        paymentMethod: "venmo",  // Using venmo since it's registered
        payeeEmail: "test2@venmo.com",
        currencies: [Currency.USD],
        referrer: false,
        delegate: true,
    },
    {
        amount: usdc(750),
        minIntent: usdc(75),
        maxIntent: usdc(300),
        paymentMethod: "revolut",  // Revolut should be registered from deployment
        payeeEmail: "test3@revolut.com",
        currencies: [Currency.USD],
        referrer: true,
        delegate: true,
    },
    {
        amount: usdc(2000),
        minIntent: usdc(200),
        maxIntent: usdc(800),
        paymentMethod: "revolut",
        payeeEmail: "test4@revolut.com",
        currencies: [Currency.USD],
        referrer: false,
        delegate: false,
    },
    {
        amount: usdc(1500),
        minIntent: usdc(150),
        maxIntent: usdc(600),
        paymentMethod: "venmo",
        payeeEmail: "test5@venmo.com",
        currencies: [Currency.USD],
        referrer: true,
        delegate: false,
    },
    {
        amount: usdc(3000),
        minIntent: usdc(300),
        maxIntent: usdc(1000),
        paymentMethod: "venmo",
        payeeEmail: "test6@venmo.com",
        currencies: [Currency.USD],
        referrer: false,
        delegate: true,
    },
];

async function main() {
    console.log("🚀 Seeding test deposits for backend indexing...\n");
    
    // Get signers
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    console.log(`Deployer address: ${deployer.address}`);
    console.log(`Available signers: ${signers.length}\n`);
    
    // Get deployed contracts
    const Escrow = await deployments.get("Escrow");
    const USDCMock = await deployments.get("USDCMock");
    const PaymentVerifierRegistry = await deployments.get("PaymentVerifierRegistry");
    const UnifiedPaymentVerifier = await deployments.get("UnifiedPaymentVerifier");
    
    const escrow = await ethers.getContractAt("Escrow", Escrow.address);
    const usdcToken = await ethers.getContractAt("IERC20", USDCMock.address);
    const registry = await ethers.getContractAt("PaymentVerifierRegistry", PaymentVerifierRegistry.address);
    
    console.log("📋 Contract Addresses:");
    console.log(`  Escrow: ${escrow.address}`);
    console.log(`  USDC Token: ${usdcToken.address}`);
    console.log(`  Payment Registry: ${registry.address}`);
    console.log(`  Unified Verifier: ${UnifiedPaymentVerifier.address}\n`);
    
    // Check deployer's USDC balance
    const deployerBalance = await usdcToken.balanceOf(deployer.address);
    console.log(`Deployer USDC balance: ${ethers.utils.formatUnits(deployerBalance, 6)} USDC\n`);
    
    // Calculate total USDC needed
    const totalUsdcNeeded = DEPOSIT_CONFIGS.reduce((sum, config) => sum.add(config.amount.mul(2)), ethers.BigNumber.from(0));
    console.log(`Total USDC needed: ${ethers.utils.formatUnits(totalUsdcNeeded, 6)} USDC`);
    
    if (deployerBalance.lt(totalUsdcNeeded)) {
        console.warn(`⚠️ Warning: Deployer may not have enough USDC for all deposits\n`);
    }
    
    // Check which payment methods are registered
    const venmoHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("venmo"));
    const revolutHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("revolut"));
    
    const venmoRegistered = await registry.isPaymentMethod(venmoHash);
    const revolutRegistered = await registry.isPaymentMethod(revolutHash);
    
    console.log("📝 Payment Method Registration Status:");
    console.log(`  Venmo: ${venmoRegistered ? "✅ Registered" : "❌ Not registered"}`);
    console.log(`  Revolut: ${revolutRegistered ? "✅ Registered" : "❌ Not registered"}\n`);
    
    // Create deposits
    const createdDeposits = [];
    let depositCounter = 0;
    
    for (let i = 0; i < DEPOSIT_CONFIGS.length && i < signers.length - 1; i++) {
        const config = DEPOSIT_CONFIGS[i];
        const depositor = signers[i + 1]; // Skip deployer
        
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📦 Creating Deposit #${i + 1}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  Depositor: ${depositor.address}`);
        console.log(`  Amount: ${ethers.utils.formatUnits(config.amount, 6)} USDC`);
        console.log(`  Intent Range: ${ethers.utils.formatUnits(config.minIntent, 6)} - ${ethers.utils.formatUnits(config.maxIntent, 6)} USDC`);
        console.log(`  Payment Method: ${config.paymentMethod}`);
        console.log(`  Currencies: ${config.currencies.map(c => Currency[c]).join(", ")}`);
        console.log(`  Features: ${config.referrer ? "✓ Referrer" : "✗ Referrer"} | ${config.delegate ? "✓ Delegate" : "✗ Delegate"}`);
        
        try {
            // Check if payment method is registered
            const paymentMethodHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(config.paymentMethod));
            const isRegistered = await registry.isPaymentMethod(paymentMethodHash);
            
            if (!isRegistered) {
                console.log(`  ⚠️ Skipping: Payment method ${config.paymentMethod} not registered`);
                continue;
            }
            
            // Transfer USDC to depositor
            const transferAmount = config.amount.mul(2); // Extra for safety
            const currentDepositorBalance = await usdcToken.balanceOf(depositor.address);
            
            if (currentDepositorBalance.lt(config.amount)) {
                const transferTx = await usdcToken.connect(deployer).transfer(depositor.address, transferAmount);
                await transferTx.wait();
                console.log(`  ✅ Transferred ${ethers.utils.formatUnits(transferAmount, 6)} USDC to depositor`);
            } else {
                console.log(`  ℹ️ Depositor already has sufficient USDC`);
            }
            
            // Approve escrow
            const currentAllowance = await usdcToken.allowance(depositor.address, escrow.address);
            if (currentAllowance.lt(config.amount)) {
                const approveTx = await usdcToken.connect(depositor).approve(escrow.address, ethers.constants.MaxUint256);
                await approveTx.wait();
                console.log(`  ✅ Approved escrow to spend USDC`);
            }
            
            // Prepare currencies with conversion rates
            const currenciesWithRates = config.currencies.map(currencyCode => {
                let rate = ether(1.02); // Default USD rate
                if (currencyCode === Currency.EUR) rate = ether(0.95);
                else if (currencyCode === Currency.GBP) rate = ether(0.85);
                else if (currencyCode === Currency.CAD) rate = ether(1.35);
                
                return {
                    code: currencyCode,
                    minConversionRate: rate
                };
            });
            
            // Create deposit parameters
            const depositParams = {
                token: usdcToken.address,
                amount: config.amount,
                intentAmountRange: {
                    min: config.minIntent,
                    max: config.maxIntent
                },
                paymentMethods: [paymentMethodHash],
                paymentMethodData: [{
                    intentGatingService: ADDRESS_ZERO,
                    payeeDetails: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(config.payeeEmail)),
                    data: "0x"
                }],
                currencies: [currenciesWithRates],
                delegate: config.delegate ? deployer.address : ADDRESS_ZERO,
                intentGuardian: ADDRESS_ZERO,
                referrer: config.referrer ? deployer.address : ADDRESS_ZERO,
                referrerFee: config.referrer ? ether(0.01) : ZERO // 1% referrer fee
            };
            
            // Create deposit
            const createTx = await escrow.connect(depositor).createDeposit(depositParams);
            const receipt = await createTx.wait();
            
            // Extract deposit ID from events
            const depositEvent = receipt.events?.find(e => e.event === "DepositReceived");
            const depositId = depositEvent?.args?.depositId;
            
            console.log(`  ✅ Deposit created successfully!`);
            console.log(`     Deposit ID: ${depositId}`);
            console.log(`     Tx Hash: ${createTx.hash}`);
            
            createdDeposits.push({
                id: depositId?.toString(),
                depositor: depositor.address,
                amount: ethers.utils.formatUnits(config.amount, 6),
                paymentMethod: config.paymentMethod,
                currencies: config.currencies.map(c => Currency[c]).join(", "),
                txHash: createTx.hash
            });
            
            depositCounter++;
            
        } catch (error: any) {
            console.error(`  ❌ Failed to create deposit: ${error.message}`);
        }
        
        // Small delay between deposits for better indexing
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Print summary
    console.log("\n" + "═".repeat(60));
    console.log("📊 DEPOSIT GENERATION SUMMARY");
    console.log("═".repeat(60));
    console.log(`\nTotal deposits created: ${depositCounter}`);
    console.log(`Total USDC locked: ${ethers.utils.formatUnits(
        DEPOSIT_CONFIGS.slice(0, depositCounter).reduce((sum, config) => sum.add(config.amount), ethers.BigNumber.from(0)), 
        6
    )} USDC\n`);
    
    if (createdDeposits.length > 0) {
        console.log("📋 Created Deposits:");
        console.log("─".repeat(60));
        
        for (const deposit of createdDeposits) {
            console.log(`\nDeposit ID: ${deposit.id}`);
            console.log(`  Depositor: ${deposit.depositor}`);
            console.log(`  Amount: ${deposit.amount} USDC`);
            console.log(`  Payment: ${deposit.paymentMethod}`);
            console.log(`  Currencies: ${deposit.currencies}`);
            console.log(`  Tx: ${deposit.txHash.substring(0, 20)}...`);
        }
    }
    
    // Verify deposits in escrow
    console.log("\n📍 Verification - Deposits per Account:");
    console.log("─".repeat(60));
    
    for (let i = 1; i <= depositCounter && i < signers.length; i++) {
        const depositor = signers[i];
        const deposits = await escrow.getAccountDeposits(depositor.address);
        if (deposits.length > 0) {
            console.log(`${depositor.address}:`);
            console.log(`  ${deposits.length} deposit(s) | IDs: [${deposits.map(d => d.toString()).join(", ")}]`);
        }
    }
    
    // Final stats
    const deployerFinalBalance = await usdcToken.balanceOf(deployer.address);
    console.log(`\n💰 Deployer final USDC balance: ${ethers.utils.formatUnits(deployerFinalBalance, 6)} USDC`);
    
    console.log("\n✨ Deposit seeding completed successfully!");
    console.log("Your backend indexer should now be able to detect these deposits.\n");
}

// Execute script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Script failed:");
        console.error(error);
        process.exit(1);
    });