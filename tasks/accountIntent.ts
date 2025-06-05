
import { task } from "hardhat/config";

// > npx hardhat get-account-intent --network localhost
task("get-account-intent", "Gets the current intent for an account")
  .addParam("account", "The address of the account to check", "0x90F79bf6EB2c4f870365E785982E1f101E93b906")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

    const account = taskArgs.account;

    // Call the getAccountIntent function
    const intent = await escrow.getAccountIntent(account);

    // if (intent.intent.owner === ethers.constants.AddressZero) {
    //   console.log("No intent found for account");
    //   return;
    // }

    // console.log("Account Intent:");
    // console.log("Owner:", intent.intent.owner);
    // console.log("To:", intent.intent.to);
    // console.log("Deposit ID:", intent.intent.depositId.toString());
    // console.log("Amount:", ethers.utils.formatUnits(intent.intent.amount, 6)); // Assuming USDC (6 decimals)
    // console.log("Payment Verifier:", intent.intent.paymentVerifier);
    // console.log("Fiat Currency:", intent.intent.fiatCurrency);
    // console.log("Conversion Rate:", intent.intent.conversionRate.toString());
    // console.log("Timestamp:", new Date(intent.intent.timestamp.toNumber() * 1000).toLocaleString());
  });
