import { task } from "hardhat/config";
import { Currency } from "../utils/protocolUtils";

// > npx hardhat create-deposit --network localhost

task("create-deposit", "Creates a deposit")
  .addParam("token", "The token to be deposited", "0x5FbDB2315678afecb367f032d93F642f64180aa3") // Default USDC address
  .addParam("amount", "The amount of token to deposit", "100")
  .addParam("minamount", "The minimum amount for intents", "0.1")
  .addParam("maxamount", "The maximum amount for intents", "100")
  .addParam("verifiers", "Comma-separated list of payment verifiers", "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853") // comma separated list of verifier addresses
  .addParam("verifierdata", "Period-separated list of verifier data", `{
    "intentGatingService":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "payeeDetails":"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d",
    "data":"0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266"}`
  )
  .addParam("currencies", "ambersent-separated list of currencies and conversion rates", `${Currency.USD}:0.9`)
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

    const token = await ethers.getContractAt("USDCMock", taskArgs.token);
    const amount = ethers.utils.parseUnits(taskArgs.amount, await token.decimals());
    const minAmount = ethers.utils.parseUnits(taskArgs.minamount, await token.decimals());
    const maxAmount = ethers.utils.parseUnits(taskArgs.maxamount, await token.decimals());

    const verifiers = taskArgs.verifiers.split(":");
    const verifierData = taskArgs.verifierdata.split(".").map((data: string) => JSON.parse(data));
    const currencies = taskArgs.currencies.split("&").map((currencyGroup: string) => {
      return currencyGroup.split(",").map((currency: string) => {
        const [code, rate] = currency.split(":");
        return { code, conversionRate: ethers.utils.parseUnits(rate, 18) };
      });
    });

    // Allow USDC to be transferred to the escrow
    await token.connect(owner).approve(escrow.address, amount);

    // Call the createDeposit function
    const tx = await escrow.createDeposit(token.address, amount, { min: minAmount, max: maxAmount }, verifiers, verifierData, currencies);
    const receipt = await tx.wait();

    // Get the deposit ID from the DepositReceived event
    const depositReceivedEvent = receipt.events?.find(e => e.event === "DepositReceived");
    const depositId = depositReceivedEvent?.args?.depositId;

    // Get the deposit view
    const depositView = await escrow.getDepositFromIds([depositId]);
    console.log("\nDeposit View:");
    console.log(`- Deposit ID: ${depositView[0].depositId}`);
    console.log(`  Depositor: ${depositView[0].deposit.depositor}`);
    console.log(`  Token: ${depositView[0].deposit.token}`);
    console.log(`  Amount: ${depositView[0].deposit.amount}`);
    console.log(`  Intent amount range:`);
    console.log(`    Min: ${depositView[0].deposit.intentAmountRange.min}`);
    console.log(`    Max: ${depositView[0].deposit.intentAmountRange.max}`);
    console.log(`  Accepting intents: ${depositView[0].deposit.acceptingIntents}`);
    console.log(`  Remaining deposits: ${depositView[0].deposit.remainingDeposits}`);
    console.log(`  Outstanding intent amount: ${depositView[0].deposit.outstandingIntentAmount}`);
    console.log(`  Available liquidity: ${depositView[0].availableLiquidity}`);
    console.log("    Verifiers:");
    for (const verifier of depositView[0].verifiers) {
      console.log(`    - Verifier address: ${verifier.verifier}`);
      console.log(`      Intent gating service: ${verifier.verificationData.intentGatingService}`);
      console.log(`      Payee details: ${verifier.verificationData.payeeDetails}`);
      console.log("      Supported currencies:");
      for (const currency of verifier.currencies) {
        console.log(`        - Currency code: ${currency.code}`);
        console.log(`    Conversion rate: ${currency.conversionRate}`);
      }
      console.log();
    }

    console.log(`Deposit created with ID: ${tx.hash}`);
  });