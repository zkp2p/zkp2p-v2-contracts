import { task } from "hardhat/config";

// > npx hardhat release-funds-to-payer --network localhost
task("release-funds-to-payer", "Allows depositor to release funds to the payer")
  .addParam("intenthash", "Hash of intent to resolve by releasing the funds", "0x025a4befe5543b978f6d4835320a6b38c898c3751188fd40d3dcfe08e800f0a1")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

    const intentHash = taskArgs.intenthash;


    // Call the releaseFundsToPayer function
    const tx = await escrow.connect(owner).releaseFundsToPayer(intentHash);
    await tx.wait();

    console.log(`Funds released to payer with transaction ID: ${tx.hash}`);
  });
