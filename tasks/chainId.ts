import { task } from "hardhat/config";

// > npx hardhat get-chain-id --network localhost
task("get-chain-id", "Gets the chainId of the current network")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

    // Call the getAccountIntent function
    const chainId = await escrow.chainId();

    console.log("Chain ID:", chainId);
  });
