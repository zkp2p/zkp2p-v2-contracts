#!/usr/bin/env ts-node

import 'ts-node/register/transpile-only';
import { extractAddresses } from './extractors/addresses';
import { extractABIs } from './extractors/abis';
import { extractTypes } from './extractors/types';
import { extractConstants } from './extractors/constants';
import { extractUtils } from './extractors/utils';
import { extractPaymentMethods } from './extractors/paymentMethods';

async function main() {
  console.log('📦 Starting extraction from deployments/outputs...');

  const started = Date.now();
  await extractAddresses();
  await extractABIs();
  await extractTypes();
  await extractConstants();
  await extractUtils();
  await extractPaymentMethods();

  const ms = Date.now() - started;
  console.log(`✅ Extraction complete in ${ms}ms`);
}

main().catch((err) => {
  console.error('❌ Extraction failed:', err);
  process.exit(1);
});