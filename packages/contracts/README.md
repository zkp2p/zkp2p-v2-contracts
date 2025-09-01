# @zkp2p/contracts-v2

Official npm package for ZKP2P V2 smart contract interfaces, ABIs, addresses, and utilities.

## Installation

```bash
npm install @zkp2p/contracts-v2
# or
yarn add @zkp2p/contracts-v2
# or
pnpm add @zkp2p/contracts-v2
```

## Quick Start (subpath imports)

```typescript
import baseAddresses from '@zkp2p/contracts-v2/addresses/base.json';
import * as baseAbis from '@zkp2p/contracts-v2/abis/base';
import { base as baseConstants } from '@zkp2p/contracts-v2/constants';
import { base as basePaymentMethods } from '@zkp2p/contracts-v2/paymentMethods';
import { ethers } from 'ethers';

// Create contract instance
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const orchestrator = new ethers.Contract(
  baseAddresses.Orchestrator,
  baseAbis.Orchestrator,
  provider
);

console.log('Intent expiration:', baseConstants.INTENT_EXPIRATION_PERIOD);
console.log('Venmo config:', basePaymentMethods.venmo);
```

## Features

### 📍 Network-Specific Contract Addresses

Pre-configured addresses for all deployed networks, exported per-network:

```typescript
import base from '@zkp2p/contracts-v2/addresses/base.json';
import baseSepolia from '@zkp2p/contracts-v2/addresses/baseSepolia.json';
console.log(base.Orchestrator);
console.log(base.Escrow);
console.log(baseSepolia.UnifiedPaymentVerifier);
```

Supported networks:
- Base (`base`)
- Base Sepolia (`baseSepolia`)

### 📜 Network-Specific Contract ABIs

Minimal ABIs extracted from on-chain deployments:

```typescript
import * as baseAbis from '@zkp2p/contracts-v2/abis/base';
const orchestratorABI = baseAbis.Orchestrator;
const escrowABI = baseAbis.Escrow;
```

### 🔧 Network-Specific Protocol Constants

All protocol parameters and configurations per network:

```typescript
import { base as baseConstants } from '@zkp2p/contracts-v2/constants';
const { INTENT_EXPIRATION_PERIOD, MAX_INTENTS_PER_DEPOSIT, DUST_THRESHOLD } = baseConstants;
```

### 💳 Payment Methods with Provider Hashes

Unified payment method configurations including provider hashes from deployment:

```typescript
import { base as basePaymentMethods } from '@zkp2p/contracts-v2/paymentMethods';
const venmoConfig = basePaymentMethods.venmo;
console.log('Payment Method Hash:', venmoConfig.paymentMethodHash);
console.log('Provider Hashes:', venmoConfig.providerHashes);
console.log('Currencies:', venmoConfig.currencies);
console.log('Timestamp Buffer:', venmoConfig.timestampBuffer);
```

### 🛠️ Utility Functions

Protocol utility functions:

```typescript
import * as utils from '@zkp2p/contracts-v2/utils';
const usdInfo = utils.getCurrencyInfo(utils.Currency.USD);
console.log('Currency code:', usdInfo.code);
console.log('Decimals:', usdInfo.decimals);
```


## API Reference

### Imports

- Prefer subpaths for clarity and smaller bundles:
  - `@zkp2p/contracts-v2/addresses` and `@zkp2p/contracts-v2/addresses/*.json`
  - `@zkp2p/contracts-v2/abis/<network>`
  - `@zkp2p/contracts-v2/constants`
  - `@zkp2p/contracts-v2/paymentMethods`
  - `@zkp2p/contracts-v2/utils`
  - `@zkp2p/contracts-v2/types`

## Development

### Build & Publish

From `packages/contracts`:
- `yarn build` – Clean, extract, and bundle to `dist/`
- `npm pack` – Preview tarball contents
- `npm publish --access public` – Publish (runs prepublishOnly)

Note: The package publishes `dist/` only. Tests and config files are excluded.

## License

MIT

## Links

- [GitHub Repository](https://github.com/zkp2p/zkp2p-v2-contracts)
- [Documentation](https://docs.zkp2p.xyz)
- [Website](https://zkp2p.xyz)
