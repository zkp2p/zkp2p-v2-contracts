import * as fs from "fs";
import * as path from "path";

/**
 * Script to list all available provider hash snapshots for a network
 * Usage: npx ts-node scripts/list-provider-snapshots.ts <network> [payment-method]
 * 
 * Examples:
 *   npx ts-node scripts/list-provider-snapshots.ts base_sepolia
 *   npx ts-node scripts/list-provider-snapshots.ts base_sepolia venmo
 */
async function main() {
  const args = process.argv.slice(2);
  const network = args[0];
  const paymentMethodFilter = args[1];

  if (!network) {
    console.error("Please provide a network name (base_sepolia, base_staging, or base)");
    process.exit(1);
  }

  const snapshotsDir = path.join(__dirname, "..", "deployments", "outputs", "platforms", "snapshots", network);

  if (!fs.existsSync(snapshotsDir)) {
    console.log(`No snapshots directory found for network: ${network}`);
    console.log(`Path checked: ${snapshotsDir}`);
    return;
  }

  const files = fs.readdirSync(snapshotsDir);
  
  // Group files by payment method
  const snapshots: { [key: string]: string[] } = {};
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const parts = file.split('_');
      const paymentMethod = parts[0];
      
      if (!paymentMethodFilter || paymentMethod === paymentMethodFilter) {
        if (!snapshots[paymentMethod]) {
          snapshots[paymentMethod] = [];
        }
        snapshots[paymentMethod].push(file);
      }
    }
  });

  if (Object.keys(snapshots).length === 0) {
    if (paymentMethodFilter) {
      console.log(`No snapshots found for payment method: ${paymentMethodFilter} on network: ${network}`);
    } else {
      console.log(`No snapshots found for network: ${network}`);
    }
    return;
  }

  console.log(`\nProvider Hash Snapshots for ${network}:`);
  console.log('=' .repeat(60));

  for (const [paymentMethod, files] of Object.entries(snapshots)) {
    console.log(`\n${paymentMethod.toUpperCase()}:`);
    
    // Sort files by timestamp (newest first)
    const sortedFiles = files.sort().reverse();
    
    sortedFiles.forEach(file => {
      const filePath = path.join(snapshotsDir, file);
      const stats = fs.statSync(filePath);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      const isLatest = file.includes('_latest');
      const label = isLatest ? ' [LATEST]' : '';
      
      console.log(`  • ${file}${label}`);
      console.log(`    - Provider Hashes: ${data.hashes.length}`);
      console.log(`    - Timestamp Buffer: ${data.timestampBuffer}s`);
      console.log(`    - Updated: ${data.updatedAt}`);
      console.log(`    - File Size: ${(stats.size / 1024).toFixed(2)} KB`);
      
      if (data.currencies && data.currencies.length > 0) {
        console.log(`    - Currencies: ${data.currencies.length}`);
      }
    });
  }

  console.log('\n' + '=' .repeat(60));
  console.log('\nTo restore a snapshot, use:');
  console.log('  PAYMENT_METHOD=<method> SNAPSHOT_FILE=<filename> npx hardhat run scripts/restore-provider-snapshot.ts --network <network>');
  console.log('\nExample:');
  console.log(`  PAYMENT_METHOD=venmo SNAPSHOT_FILE=venmo_2025-09-08T12-30-45.json npx hardhat run scripts/restore-provider-snapshot.ts --network ${network}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });