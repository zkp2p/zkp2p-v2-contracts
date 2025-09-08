import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const hre = require("hardhat") as HardhatRuntimeEnvironment;

/**
 * Script to restore provider hashes from a specific snapshot file
 * Usage: npx hardhat run scripts/restore-provider-snapshot.ts --network <network>
 * 
 * Set environment variables:
 * - PAYMENT_METHOD: The payment method key (e.g., "venmo", "revolut")
 * - SNAPSHOT_FILE: The snapshot filename to restore from (e.g., "venmo_2025-09-08T12-30-45.json")
 *   If not provided, uses the latest snapshot
 */
async function main() {
  const network = hre.network.name;
  const paymentMethod = process.env.PAYMENT_METHOD;
  const snapshotFile = process.env.SNAPSHOT_FILE;

  console.log(`Restoring provider snapshot on network: ${network}`);

  if (!["base_sepolia", "base_staging", "base"].includes(network)) {
    console.log("This script is only for production networks: base_sepolia, base_staging, base");
    return;
  }

  if (!paymentMethod) {
    console.error("Please set PAYMENT_METHOD environment variable (e.g., 'venmo', 'revolut')");
    return;
  }

  // Determine snapshot file path
  const snapshotsDir = path.join(__dirname, "..", "deployments", "outputs", "platforms", "snapshots", network);
  let snapshotPath: string;

  if (snapshotFile) {
    snapshotPath = path.join(snapshotsDir, snapshotFile);
  } else {
    // Use the latest snapshot
    snapshotPath = path.join(snapshotsDir, `${paymentMethod}_latest.json`);
  }

  if (!fs.existsSync(snapshotPath)) {
    console.error(`Snapshot file not found: ${snapshotPath}`);
    console.log(`Available snapshots in ${snapshotsDir}:`);
    if (fs.existsSync(snapshotsDir)) {
      const files = fs.readdirSync(snapshotsDir).filter(f => f.startsWith(paymentMethod));
      files.forEach(f => console.log(`  - ${f}`));
    }
    return;
  }

  // Load snapshot data
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  console.log(`Loading snapshot from: ${snapshotPath}`);
  console.log(`  Payment Method Hash: ${snapshot.paymentMethodHash}`);
  console.log(`  Number of Provider Hashes: ${snapshot.hashes.length}`);
  console.log(`  Timestamp Buffer: ${snapshot.timestampBuffer}`);
  console.log(`  Updated At: ${snapshot.updatedAt}`);

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

  const [signer] = await ethers.getSigners();
  const owner = await unifiedVerifier.owner();

  if (signer.address !== owner) {
    console.error(`Signer ${signer.address} is not the contract owner ${owner}`);
    console.log("You may need to use a multisig transaction for production networks.");
    return;
  }

  // Check current provider hashes
  console.log("\nChecking current provider hashes...");
  const currentHashes: string[] = [];
  for (const hash of snapshot.hashes) {
    const isProviderHash = await unifiedVerifier.isProviderHash(hash);
    if (isProviderHash) {
      currentHashes.push(hash);
    }
  }

  console.log(`  Currently active: ${currentHashes.length} of ${snapshot.hashes.length} hashes`);

  // Add missing provider hashes
  const hashesToAdd = snapshot.hashes.filter(h => !currentHashes.includes(h));
  if (hashesToAdd.length > 0) {
    console.log(`\nAdding ${hashesToAdd.length} missing provider hashes...`);
    for (const hash of hashesToAdd) {
      try {
        console.log(`  Adding: ${hash}`);
        const tx = await unifiedVerifier.addProviderHash(hash);
        await tx.wait();
        console.log(`    Transaction hash: ${tx.hash}`);
      } catch (error) {
        console.error(`    Failed to add ${hash}:`, error);
      }
    }
  } else {
    console.log("\nAll provider hashes from snapshot are already active.");
  }

  console.log("\nSnapshot restoration complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });