import { task } from "hardhat/config";

// > npx hardhat get-fee-recipient --network localhost
task("get-fee-recipient", "Gets the sustainability fee recipient address from Escrow contract")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

    const feeRecipient = await escrow.sustainabilityFeeRecipient();
    console.log(`Sustainability fee recipient address: ${feeRecipient}`);
  });
