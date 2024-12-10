import { task } from "hardhat/config";
// import { usdc } from "../utils/common/units";
// import { Currency } from "../utils/protocolUtils";

task("create-deposit", "Creates a deposit")
  .addParam("token", "The token to be deposited", "0x5FbDB2315678afecb367f032d93F642f64180aa3") // Default USDC address
  .addParam("amount", "The amount of token to deposit", "100")
  .addParam("minAmount", "The minimum amount for intents", "10")
  .addParam("maxAmount", "The maximum amount for intents", "100")
  .addParam("verifiers", "Comma-separated list of payment verifiers", "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853") // comma separated list of verifier addresses
  .addParam("verifierData", "Period-separated list of verifier data", `{
    "intentGatingService":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "payeeDetailsHash":"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d",
    "data":"0x00"}`
  )
  .addParam("currencies", "ambersent-separated list of currencies and conversion rates", `0xbba694ae319758680b969f5b850cf8e66124d6c2703374d628a18bd3d4bc75e9:1.0`)
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

    const token = await ethers.getContractAt("USDCMock", taskArgs.token);
    const amount = ethers.utils.parseUnits(taskArgs.amount, await token.decimals());
    const minAmount = ethers.utils.parseUnits(taskArgs.minAmount, await token.decimals());
    const maxAmount = ethers.utils.parseUnits(taskArgs.maxAmount, await token.decimals());

    const verifiers = taskArgs.verifiers.split(":");
    const verifierData = taskArgs.verifierData.split(".").map(data => JSON.parse(data));
    const currencies = taskArgs.currencies.split("&").map(currencyGroup => {
      return currencyGroup.split(",").map(currency => {
        const [code, rate] = currency.split(":");
        return { code, conversionRate: ethers.utils.parseUnits(rate, 18) };
      });
    });

    // Allow USDC to be transferred to the escrow
    await token.connect(owner).approve(escrow.address, amount);

    // Call the createDeposit function
    const tx = await escrow.createDeposit(token.address, amount, { min: minAmount, max: maxAmount }, verifiers, verifierData, currencies);
    await tx.wait();

    console.log(`Deposit created with ID: ${tx.hash}`);
  });