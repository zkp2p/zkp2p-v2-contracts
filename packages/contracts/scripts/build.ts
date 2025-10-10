#!/usr/bin/env ts-node

import { promises as fs } from 'fs';
import * as path from 'path';

import { extractAll } from './extract-all';
import { generateAbiWrappers } from './generate-abi-wrappers';
import { generateNetworkEntries } from './generate-network-entries';
import { buildModules } from './build-modules';

const PKG_ROOT = path.resolve(__dirname, '..');
const CLEAN_TARGETS = [
  '_cjs',
  '_esm',
  '_types',
  'addresses',
  'abis',
  'constants',
  'paymentMethods',
  'networks',
  'types',
  'utils'
];

function formatDuration(startedAt: number): string {
  const elapsed = Date.now() - startedAt;
  if (elapsed < 1000) return `${elapsed}ms`;
  return `${(elapsed / 1000).toFixed(2)}s`;
}

async function removePath(relativePath: string): Promise<void> {
  await fs.rm(path.join(PKG_ROOT, relativePath), { recursive: true, force: true });
}

export async function cleanArtifacts(): Promise<void> {
  console.log('🧹 Cleaning previous artifacts...');
  const started = Date.now();

  for (const entry of CLEAN_TARGETS) {
    await removePath(entry);
  }

  console.log(`✅ Clean complete (${formatDuration(started)})`);
}

export async function buildPackage(): Promise<void> {
  console.log('🚀 Starting @zkp2p/contracts-v2 build pipeline');
  const started = Date.now();

  await cleanArtifacts();
  await extractAll();
  await generateAbiWrappers();
  await generateNetworkEntries();
  await buildModules();

  console.log(`🎉 Build finished (${formatDuration(started)})`);
}

const TASKS = {
  build: buildPackage,
  clean: cleanArtifacts,
  extract: extractAll,
  wrappers: generateAbiWrappers,
  networks: generateNetworkEntries,
  bundle: buildModules
} as const;

type TaskName = keyof typeof TASKS;

function isTaskName(value: string): value is TaskName {
  return value in TASKS;
}

async function runFromCLI(argv: string[]): Promise<void> {
  const requested = argv[2] ?? 'build';

  if (!isTaskName(requested)) {
    const available = Object.keys(TASKS).join(', ');
    throw new Error(`Unknown task "${requested}". Available tasks: ${available}`);
  }

  const taskStarted = Date.now();
  await TASKS[requested]();
  console.log(`⏱️  ${requested} completed in ${formatDuration(taskStarted)}`);
}

if (require.main === module) {
  runFromCLI(process.argv).catch((error) => {
    console.error('❌  Build script failed:', error);
    process.exit(1);
  });
}
