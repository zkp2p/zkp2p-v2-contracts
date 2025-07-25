import { ethers } from 'ethers';
import { MetaTransactionData } from '@safe-global/types-kit';
import * as fs from 'fs';
import * as path from 'path';

export interface SafeConfig {
  safeAddress: string;
  serviceUrl: string;
}

export const SAFE_CONFIG: Record<string, SafeConfig> = {
  base: {
    safeAddress: '0x0bC26FF515411396DD588Abd6Ef6846E04470227',
    serviceUrl: 'https://safe-transaction-base.safe.global'
  }
};

/**
 * Exports Safe transactions to a JSON file that can be imported in the Safe UI
 * @param transactions Array of transactions to include in the batch
 * @param safeAddress The Safe multisig address
 * @param network Network name (e.g., 'base', 'sepolia')
 * @returns Path to the exported JSON file
 */
export function exportSafeTransactionJSON(
  transactions: MetaTransactionData[],
  safeAddress: string,
  network: string
): string {
  // Generate a unique identifier for this batch
  const timestamp = new Date().toISOString();
  const uniqueId = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(`${safeAddress}-${timestamp}-${transactions.length}`)
  );

  // Map network names to chain IDs
  const chainIds: Record<string, string> = {
    'base': '8453',
    'base_sepolia': '84532',
    'sepolia': '11155111',
    'mainnet': '1',
    'goerli': '5'
  };

  // Create transaction data in Safe UI format
  const safeTransactionData = {
    version: "1.0",
    chainId: chainIds[network] || "1",
    createdAt: timestamp,
    meta: {
      name: "ZKP2P Provider Hash Updates",
      description: `Batch transaction ${uniqueId.slice(0, 10)}...`,
      txBuilderVersion: "1.0.0",
      createdFromSafeAddress: safeAddress,
      txHash: uniqueId
    },
    transactions: transactions.map(tx => ({
      to: tx.to,
      value: tx.value || "0",
      data: tx.data || null,
      contractMethod: null,
      contractInputsValues: null
    }))
  };

  // Create exports directory if it doesn't exist
  const exportsDir = path.join(process.cwd(), 'safe-transactions');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestampForFilename = timestamp.replace(/[:.]/g, '-').slice(0, -5);
  const filename = `safe-tx-${network}-${timestampForFilename}.json`;
  const filepath = path.join(exportsDir, filename);

  // Write JSON file
  fs.writeFileSync(filepath, JSON.stringify(safeTransactionData, null, 2));

  console.log(`\n✅ [SAFE] Transaction batch exported to JSON file:`);
  console.log(`   ${filepath}`);
  console.log(`\n📋 [SAFE] To import this transaction:`);
  console.log(`1. Go to: https://app.safe.global/${network}:${safeAddress}`);
  console.log(`2. Click "New transaction" → "Transaction Builder"`);
  console.log(`3. Click the "..." menu → "Import from file"`);
  console.log(`4. Select the JSON file: ${filename}`);
  console.log(`5. Review and create the transaction`);
  console.log(`\n📊 [SAFE] Transaction details:`);
  console.log(`   - Total transactions: ${transactions.length}`);
  console.log(`   - Safe address: ${safeAddress}`);
  console.log(`   - Network: ${network} (Chain ID: ${chainIds[network] || 'unknown'})`);

  return filepath;
}

/**
 * Creates and exports a Safe transaction batch to JSON
 * This replaces the previous proposeSafeTransaction function
 */
export async function createSafeTransactionJSON(
  signer: ethers.Signer, // Kept for compatibility but not used
  network: string,
  transactions: MetaTransactionData[]
): Promise<string> {
  const config = SAFE_CONFIG[network];
  if (!config) {
    throw new Error(`No Safe configuration found for network: ${network}`);
  }

  console.log(`[SAFE] Creating transaction batch for Safe: ${config.safeAddress}`);
  console.log(`[SAFE] Network: ${network}`);
  console.log(`[SAFE] Number of transactions: ${transactions.length}`);

  // Export the transactions to JSON
  const filepath = exportSafeTransactionJSON(
    transactions,
    config.safeAddress,
    network
  );

  // Return the filepath instead of a transaction hash
  return filepath;
}

// Keep the old function name for backward compatibility
export const proposeSafeTransaction = createSafeTransactionJSON;