import 'ts-node/register/transpile-only';
import * as fs from 'fs';
import * as path from 'path';

// Preconfigure module aliasing to avoid pulling Hardhat at runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const moduleAlias = require('module-alias');
moduleAlias.addAlias('hardhat', 'ethers');

const ROOT = path.resolve(__dirname, '../../../../');
const PKG_ROOT = path.resolve(__dirname, '../..');
const PAYMENT_METHODS_DIR = path.join(PKG_ROOT, 'paymentMethods');

// TypeScript interface for payment method configuration
export interface PaymentMethodConfig {
  paymentMethodHash: string;
  currencies: string[];  // Array of currency hashes
  timestampBuffer: number;  // Always a number in decimal format
  providerHashes: string[];
}

export interface NetworkPaymentMethods {
  network: string;
  chainId?: number | string;
  generatedAt: string;
  methods: Record<string, PaymentMethodConfig>;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Helper to convert BigNumber values to decimal numbers
function convertToNumber(value: any): number {
  if (!value) return 30; // Default

  // Handle BigNumber objects
  if (typeof value === 'object') {
    if (value._isBigNumber || value.type === 'BigNumber') {
      // Convert hex to decimal
      const hex = value.hex || value._hex || '0x1e';
      return parseInt(hex, 16);
    }
    // Handle nested objects (like Zelle with per-bank buffers)
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Take the first value if it's an object with multiple entries
      const firstKey = Object.keys(value)[0];
      if (firstKey) {
        return convertToNumber(value[firstKey]);
      }
    }
  }

  // Handle string numbers
  if (typeof value === 'string') {
    return parseInt(value);
  }

  // Already a number
  if (typeof value === 'number') {
    return value;
  }

  return 30; // Default fallback
}

export async function extractPaymentMethods(): Promise<void> {
  ensureDir(PAYMENT_METHODS_DIR);

  // Step 1: Get chainId for each network from deployments/outputs (excluding localhost)
  const outputsDir = path.join(ROOT, 'deployments', 'outputs');
  const chainIdByNetwork: Record<string, number | string> = {};

  if (fs.existsSync(outputsDir)) {
    const contractsFiles = fs.readdirSync(outputsDir).filter(f => f.endsWith('Contracts.ts'));
    for (const file of contractsFiles) {
      try {
        const mod = require(path.join(outputsDir, file));
        const data = mod.default || mod;
        const network = file.replace(/Contracts\.ts$/, '');

        // Skip localhost
        if (network === 'localhost') continue;

        chainIdByNetwork[network] = data.chainId;
      } catch (e) {
        console.warn(`⚠️  Failed to get chainId from ${file}:`, e);
      }
    }
  }

  // Step 2: Load provider data from deployments/outputs/platforms (excluding localhost)
  // This now includes currencies and timestampBuffer from deployment snapshots
  const platformsDir = path.join(ROOT, 'deployments', 'outputs', 'platforms');

  if (!fs.existsSync(platformsDir)) {
    console.warn('⚠️  No provider hashes found at deployments/outputs/platforms');
    return;
  }

  const providerFiles = fs.readdirSync(platformsDir)
    .filter(f => f.endsWith('.json') && f !== 'localhost.json'); // Exclude localhost

  const networks: string[] = [];

  // Step 3: Create unified payment method configs per network
  for (const file of providerFiles) {
    try {
      const network = file.replace('.json', '');
      const providerData = JSON.parse(fs.readFileSync(path.join(platformsDir, file), 'utf8'));
      const methods = providerData.methods || {};

      // Build network payment methods config
      const networkConfig: NetworkPaymentMethods = {
        network,
        chainId: chainIdByNetwork[network],
        generatedAt: new Date().toISOString(),
        methods: {}
      };

      // Process each payment method
      for (const [methodKey, entry] of Object.entries<any>(methods)) {
        const paymentMethodHash = entry.paymentMethodHash?.toLowerCase?.() || '';
        // Read currencies and timestampBuffer directly from the snapshot
        const currencies = entry.currencies || [];
        const timestampBuffer = entry.timestampBuffer || 30;
        const providerHashes = (entry.hashes || []).map((h: string) => h.toLowerCase());

        networkConfig.methods[methodKey] = {
          paymentMethodHash,
          currencies,
          timestampBuffer, // Now always a number from snapshot
          providerHashes
        };
      }

      // Write network-specific payment methods file
      const normalizedNetworkName = network.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      const outPath = path.join(PAYMENT_METHODS_DIR, `${normalizedNetworkName}.json`);
      fs.writeFileSync(outPath, JSON.stringify(networkConfig, null, 2));
      networks.push(normalizedNetworkName);

    } catch (e) {
      console.warn(`⚠️  Failed to process provider file ${file}:`, e);
    }
  }

  // Step 4: Create index with metadata
  const indexJson = {
    networks,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(PAYMENT_METHODS_DIR, 'index.json'), JSON.stringify(indexJson, null, 2));

  // Step 5: Create TypeScript type definitions
  const typesContent = `// Auto-generated type definitions for payment method configurations

export interface PaymentMethodConfig {
  paymentMethodHash: string;
  currencies: string[];  // Array of currency hashes
  timestampBuffer: number;  // Always a number in decimal format
  providerHashes: string[];
}

export interface NetworkPaymentMethods {
  network: string;
  chainId?: number | string;
  generatedAt: string;
  methods: Record<string, PaymentMethodConfig>;
}
`;
  fs.writeFileSync(path.join(PAYMENT_METHODS_DIR, 'types.d.ts'), typesContent);

  // Step 6: Create TypeScript index
  const indexContent = `// Auto-generated by extract-all.ts
// Unified payment method configurations per network

import type { PaymentMethodConfig, NetworkPaymentMethods } from './types';
export type { PaymentMethodConfig, NetworkPaymentMethods };

// Network-specific payment method exports
${networks.map(net => `export { default as ${net} } from './${net}.json';`).join('\n')}

// Helper function to get payment method config for a specific network and method
export function getPaymentMethodConfig(network: string, paymentMethod: string): PaymentMethodConfig | undefined {
  try {
    const networkModule = require(\`./\${network}.json\`);
    return networkModule.methods?.[paymentMethod];
  } catch {
    return undefined;
  }
}

// Export all networks as a single object for convenience
export const paymentMethods = {
${networks.map(net => `  ${net}: require('./${net}.json')`).join(',\n')}
};
`;

  fs.writeFileSync(path.join(PAYMENT_METHODS_DIR, 'index.ts'), indexContent);

  console.log(`✅ Unified payment method configs written to ${PAYMENT_METHODS_DIR}`);
}
