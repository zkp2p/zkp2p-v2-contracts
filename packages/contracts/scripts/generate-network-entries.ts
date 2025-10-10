#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';

const PKG_ROOT = path.resolve(__dirname, '..');
const ADDRESSES_DIR = path.join(PKG_ROOT, 'addresses');
const NETWORKS_DIR = path.join(PKG_ROOT, 'networks');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getNetworks(): string[] {
  if (!fs.existsSync(ADDRESSES_DIR)) return [];
  const files = fs.readdirSync(ADDRESSES_DIR).filter(f => f.endsWith('.json'));
  return files
    .map(f => path.basename(f, '.json'))
    .filter(n => n !== 'index');
}

function writeNetworkEntries(network: string) {
  const mjs = `// Auto-generated network entry for ${network}
export { default as addresses } from '../_esm/addresses/${network}.js';
export * from '../_esm/abis/${network}/index.js';
export { default as constants } from '../_esm/constants/${network}.js';
export { default as paymentMethods } from '../_esm/paymentMethods/${network}.js';
`;

  const cjs = `// Auto-generated network entry for ${network}
exports.addresses = require('../_cjs/addresses/${network}.js');
Object.assign(exports, require('../_cjs/abis/${network}/index.js'));
exports.constants = require('../_cjs/constants/${network}.js');
exports.paymentMethods = require('../_cjs/paymentMethods/${network}.js');
`;

  const dts = `// Auto-generated types for network ${network}
export { default as addresses } from '../addresses/${network}';
export * from '../abis/${network}';
export { default as constants } from '../constants/${network}';
export { default as paymentMethods } from '../paymentMethods/${network}';
`;

  fs.writeFileSync(path.join(NETWORKS_DIR, `${network}.mjs`), mjs);
  fs.writeFileSync(path.join(NETWORKS_DIR, `${network}.cjs`), cjs);
  fs.writeFileSync(path.join(NETWORKS_DIR, `${network}.d.ts`), dts);
}

function updatePackageExports(networks: string[]) {
  const packageJsonPath = path.join(PKG_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  pkg.exports = pkg.exports || {};

  for (const n of networks) {
    pkg.exports[`./networks/${n}`] = {
      types: `./networks/${n}.d.ts`,
      import: `./networks/${n}.mjs`,
      "react-native": `./networks/${n}.mjs`,
      require: `./networks/${n}.cjs`,
      default: `./networks/${n}.mjs`
    };
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
}

export async function generateNetworkEntries(): Promise<void> {
  ensureDir(NETWORKS_DIR);
  const networks = getNetworks();
  if (networks.length === 0) {
    console.log('ℹ️  No networks found for network entry generation');
    return;
  }
  for (const n of networks) writeNetworkEntries(n);
  updatePackageExports(networks);
  console.log('✅ Network entrypoints generated for:', networks.join(', '));
}

if (require.main === module) {
  generateNetworkEntries().catch(err => {
    console.error('❌ Failed to generate networks:', err);
    process.exit(1);
  });
}
