import { task } from "hardhat/config";

// > npx hardhat token-balance --network localhost
task("token-balance", "Gets the token balance for an account")
  .addParam("token", "The token address", "0x5FbDB2315678afecb367f032d93F642f64180aa3") // Default USDC address
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [hardhat0, hardhat1, hardhat2, hardhat3, hardhat4] = await ethers.getSigners();

    const token = await ethers.getContractAt("ERC20Mock", taskArgs.token);
    const decimals = await token.decimals();
    const symbol = await token.symbol();

    for (let i = 0; i < 5; i++) {
      const account = [hardhat0, hardhat1, hardhat2, hardhat3, hardhat4][i];
      const balance = await token.balanceOf(account.address);
      console.log(`Balance for ${account.address}:`);
      console.log(`${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
    }
  });

