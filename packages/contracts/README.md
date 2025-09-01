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

## Quick Start

```typescript
import { addresses, abis, constants, paymentMethods } from '@zkp2p/contracts-v2';
import { ethers } from 'ethers';

// Get contract addresses for Base mainnet
const baseAddresses = addresses.base;
console.log('Orchestrator:', baseAddresses.Orchestrator);
console.log('Escrow:', baseAddresses.Escrow);

// Get ABIs for Base mainnet
const baseAbis = abis.base;

// Create contract instance
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const orchestrator = new ethers.Contract(
  baseAddresses.Orchestrator,
  baseAbis.Orchestrator,
  provider
);

// Use network-specific constants
const baseConstants = constants.base;
console.log('Intent expiration:', baseConstants.INTENT_EXPIRATION_PERIOD);

// Access payment methods with provider hashes
const basePaymentMethods = paymentMethods.base;
console.log('Venmo config:', basePaymentMethods.venmo);
```

## Features

### 📍 Network-Specific Contract Addresses

Pre-configured addresses for all deployed networks, exported per-network:

```typescript
import { addresses } from '@zkp2p/contracts-v2';

// Network-specific addresses
const baseAddresses = addresses.base;
const baseSepoliaAddresses = addresses.baseSepolia;

// Access individual contracts
console.log(baseAddresses.Orchestrator);
console.log(baseAddresses.Escrow);
console.log(baseAddresses.UnifiedPaymentVerifier);
console.log(baseAddresses.SimpleAttestationVerifier);
```

Supported networks:
- Base (`base`)
- Base Sepolia (`baseSepolia`)

### 📜 Network-Specific Contract ABIs

Minimal ABIs extracted from on-chain deployments:

```typescript
import { abis } from '@zkp2p/contracts-v2';

// Network-specific ABIs
const baseAbis = abis.base;
const baseSepoliaAbis = abis.baseSepolia;

// Individual contract ABIs
const orchestratorABI = baseAbis.Orchestrator;
const escrowABI = baseAbis.Escrow;
```

### 🔧 Network-Specific Protocol Constants

All protocol parameters and configurations per network:

```typescript
import { constants } from '@zkp2p/contracts-v2';

// Network-specific constants
const baseConstants = constants.base;

// Protocol parameters
const {
  INTENT_EXPIRATION_PERIOD,
  MAX_INTENTS_PER_DEPOSIT,
  DUST_THRESHOLD,
  PARTIAL_MANUAL_RELEASE_DELAY
} = baseConstants;
```

### 💳 Payment Methods with Provider Hashes

Unified payment method configurations including provider hashes from deployment:

```typescript
import { paymentMethods } from '@zkp2p/contracts-v2';

// Network-specific payment methods
const basePaymentMethods = paymentMethods.base;

// Access payment method configuration
const venmoConfig = basePaymentMethods.venmo;
console.log('Payment ID:', venmoConfig.paymentId);
console.log('Provider Hash:', venmoConfig.providerHash);
console.log('Currencies:', venmoConfig.currencies);
console.log('Timestamp Buffer:', venmoConfig.timestampBuffer);
```

### 🛠️ Utility Functions

Protocol utility functions:

```typescript
import { utils } from '@zkp2p/contracts-v2';
import { Currency, getCurrencyInfo, getPaymentMethodId } from '@zkp2p/contracts-v2';

// Currency utilities
const usdInfo = getCurrencyInfo(Currency.USD);
console.log('Currency code:', usdInfo.code);
console.log('Decimals:', usdInfo.decimals);

// Payment method utilities
const venmoId = getPaymentMethodId('venmo');
```


## API Reference

### Main Exports

| Export | Type | Description |
|--------|------|-------------|
| `addresses` | Object | Network-specific contract addresses |
| `abis` | Object | Network-specific contract ABIs |
| `constants` | Object | Network-specific protocol constants |
| `paymentMethods` | Object | Network-specific payment method configs |
| `utils` | Object | Protocol utility functions |
| `Currency` | Enum | Currency enumeration |
| `getCurrencyInfo` | Function | Get currency details |
| `getPaymentMethodId` | Function | Get payment method identifier |

### Package Exports

The package provides multiple entry points:

```json
{
  "@zkp2p/contracts-v2": "Main package exports",
  "@zkp2p/contracts-v2/addresses": "Address exports only",
  "@zkp2p/contracts-v2/addresses/*": "Network-specific addresses",
  "@zkp2p/contracts-v2/abis/*": "Network-specific ABIs", 
  "@zkp2p/contracts-v2/constants": "Constants exports",
  "@zkp2p/contracts-v2/constants/*": "Network-specific constants",
  "@zkp2p/contracts-v2/paymentMethods": "Payment method configs",
  "@zkp2p/contracts-v2/paymentMethods/*": "Network-specific payment methods",
  "@zkp2p/contracts-v2/types": "TypeChain types",
  "@zkp2p/contracts-v2/utils": "Utility functions"
}
```

## Development

### Package Scripts

From the root directory:
- `yarn package:extract` - Extract addresses, ABIs, and constants from deployments
- `yarn package:build` - Build the package for distribution

From the package directory (`packages/contracts`):
- `yarn extract` - Extract data from deployments
- `yarn build` - Build package for distribution
- `yarn clean` - Clean generated files
- `yarn test` - Run package tests

This ensures the package always reflects the actual deployed state of the protocol.

## License

MIT

## Links

- [GitHub Repository](https://github.com/zkp2p/zkp2p-v2-contracts)
- [Documentation](https://docs.zkp2p.xyz)
- [Website](https://zkp2p.xyz)