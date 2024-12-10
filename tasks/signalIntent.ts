import { task } from "hardhat/config";


// > npx hardhat signal-intent --network localhost
task("signal-intent", "Signals intent to pay the depositor")
  .addParam("depositid", "The ID of the deposit to signal intent for", "0")
  .addParam("amount", "The amount of deposit.token the user wants to take", "20")
  .addParam("to", "Address to forward funds to (can be same as owner)", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
  .addParam("verifier", "The payment verifier corresponding to the payment service", "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853")
  .addParam("fiatcurrency", "The currency code that the user is paying in offchain", "0xbba694ae319758680b969f5b850cf8e66124d6c2703374d628a18bd3d4bc75e9")
  .addParam("gatingservicesignature", "The signature from the deposit's gating service on intent parameters", "0x00")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

    const depositId = taskArgs.depositid;
    const amount = ethers.utils.parseUnits(taskArgs.amount, 6); // Assuming the token has 6 decimals (USDC)
    const to = taskArgs.to;
    const verifier = taskArgs.verifier;
    const fiatCurrency = taskArgs.fiatcurrency;
    const gatingServiceSignature = taskArgs.gatingservicesignature;

    // Call the signalIntent function
    const tx = await escrow.signalIntent(depositId, amount, to, verifier, fiatCurrency, gatingServiceSignature);
    await tx.wait();

    console.log(`Intent signaled with transaction ID: ${tx.hash}`);
  });