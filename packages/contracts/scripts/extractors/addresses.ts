import 'ts-node/register/transpile-only';
import * as fs from 'fs';
import * as path from 'path';

type OutputsContractEntry = {
  address: string;
  abi: any[];
};

type OutputsFileShape = {
  name: string; // network name
  chainId: string | number;
  contracts: Record<string, OutputsContractEntry>;
};

const ROOT = path.resolve(__dirname, '../../../../');
const OUTPUTS_DIR = path.join(ROOT, 'deployments', 'outputs');
const PKG_ROOT = path.resolve(__dirname, '../..');
const OUT_ROOT = path.join(PKG_ROOT, 'dist');
const ADDRESSES_DIR = path.join(OUT_ROOT, 'addresses');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeNetworkName(fileName: string): string {
  // e.g. baseContracts.ts => base; baseSepoliaContracts.ts => baseSepolia
  return fileName.replace(/Contracts\.ts$/, '');
}

export async function extractAddresses(): Promise<void> {
  ensureDir(ADDRESSES_DIR);

  const files = fs
    .readdirSync(OUTPUTS_DIR)
    .filter((f) => f.endsWith('Contracts.ts') && !f.startsWith('localhost')); // Exclude localhost

  const indexExports: string[] = [];

  for (const file of files) {
    const network = normalizeNetworkName(file);
    const modPath = path.join(OUTPUTS_DIR, file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(modPath);
    const data: OutputsFileShape = mod.default || mod;
    const chainId = typeof data.chainId === 'string' ? Number(data.chainId) : data.chainId;

    const contracts: Record<string, string> = {};
    for (const [name, entry] of Object.entries(data.contracts)) {
      contracts[name] = entry.address;
    }

    const payload = {
      name: data.name,
      chainId,
      contracts,
      meta: { generatedAt: new Date().toISOString() },
    };

    const outPath = path.join(ADDRESSES_DIR, `${network}.json`);
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

    indexExports.push(`export { default as ${network} } from './${network}.json';`);
  }

  // Write an index.ts exporting each network JSON
  const indexPath = path.join(ADDRESSES_DIR, 'index.ts');
  fs.writeFileSync(indexPath, indexExports.join('\n') + '\n');

  console.log(`✅ Addresses written to ${ADDRESSES_DIR}`);
}
