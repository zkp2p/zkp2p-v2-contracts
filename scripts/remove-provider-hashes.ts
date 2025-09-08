import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const hre = require("hardhat") as HardhatRuntimeEnvironment;

/**
 * Script to remove specific provider hashes from the UnifiedPaymentVerifier contract
 * Usage: npx hardhat run scripts/remove-provider-hashes.ts --network <network>
 */
async function main() {
  const network = hre.network.name;
  console.log(`Removing provider hashes on network: ${network}`);

  if (!["base_sepolia", "base_staging", "base"].includes(network)) {
    console.log("This script is only for production networks: base_sepolia, base_staging, base");
    return;
  }

  // Get the deployed UnifiedPaymentVerifier address
  const deploymentPath = path.join(__dirname, "..", "deployments", network, "UnifiedPaymentVerifier.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error(`Deployment file not found: ${deploymentPath}`);
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const unifiedVerifierAddress = deployment.address;

  // Connect to the contract
  const unifiedVerifier = await ethers.getContractAt("UnifiedPaymentVerifier", unifiedVerifierAddress);

  // Example: Remove specific provider hashes
  // You can modify this array with the hashes you want to remove
  const hashesToRemove = [
    // Add provider hashes to remove here
    // "0x...",
  ];

  if (hashesToRemove.length === 0) {
    console.log("No provider hashes specified to remove. Please add hashes to the hashesToRemove array.");
    return;
  }

  const [signer] = await ethers.getSigners();
  const owner = await unifiedVerifier.owner();

  if (signer.address !== owner) {
    console.error(`Signer ${signer.address} is not the contract owner ${owner}`);
    return;
  }

  for (const hash of hashesToRemove) {
    try {
      const isProviderHash = await unifiedVerifier.isProviderHash(hash);
      if (isProviderHash) {
        console.log(`Removing provider hash: ${hash}`);
        const tx = await unifiedVerifier.removeProviderHash(hash);
        await tx.wait();
        console.log(`  Transaction hash: ${tx.hash}`);
        console.log(`  Successfully removed: ${hash}`);
      } else {
        console.log(`  Provider hash ${hash} does not exist, skipping...`);
      }
    } catch (error) {
      console.error(`  Failed to remove ${hash}:`, error);
    }
  }

  console.log("Provider hash removal complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });