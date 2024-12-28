import { task } from "hardhat/config";

// > npx hardhat block-number --network localhost

task("block-number", "Prints the current block number and timestamp")
  .setAction(async (taskArgs, hre) => {
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    const block = await hre.ethers.provider.getBlock(blockNumber);
    console.log("Current block number:", blockNumber);
    console.log("Current block timestamp:", block.timestamp);
  });