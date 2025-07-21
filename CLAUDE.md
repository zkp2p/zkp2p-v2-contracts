# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the zkp2p-v2-contracts repository for ZK Peer to Peer fiat on/off-ramp smart contracts. It's a Hardhat-based Solidity project that implements payment verification using zero-knowledge proofs and Reclaim Protocol for various payment platforms (Venmo, Revolut, Cashapp, Wise, MercadoPago, Zelle, Paypal, Monzo).

## Essential Commands

### Build and Development
- `yarn build` - Clean, compile contracts, and generate TypeScript types
- `yarn compile` - Compile Solidity contracts only
- `yarn clean` - Remove all build artifacts, coverage data, and generated files
- `yarn typechain` - Generate TypeScript bindings for contracts

### Testing
- `yarn test` - Run core tests (libs, verifiers, periphery, escrow)
- `yarn test:integration` - Run integration tests
- `yarn test:deploy` - Run deployment tests
- `yarn test:clean` - Clean build and run tests
- `yarn test:fast` - Run tests without compilation (for faster iteration)

### Local Development
- `yarn chain` - Start local Hardhat node without auto-deployment
- `yarn deploy:localhost` - Deploy contracts to local network

### Network Deployment
- `yarn deploy:sepolia` - Deploy to Sepolia testnet
- `yarn deploy:base` - Deploy to Base mainnet and export contract addresses
- `yarn deploy:base_staging` - Deploy to Base staging and export contract addresses

### Verification
- `yarn etherscan:sepolia` - Verify contracts on Sepolia Etherscan
- `yarn etherscan:base` - Verify contracts on Base Etherscan
- `yarn etherscan:base_staging` - Verify contracts on Base staging Etherscan

## Architecture

### Core Components

**Escrow Contract** (`contracts/Escrow.sol`)
- Central contract managing deposits, intents, and payment verification
- Handles multi-currency support and payment processing
- Uses modular verifier system for different payment platforms

**Payment Verifiers** (`contracts/verifiers/`)
- Modular verification system for different payment platforms
- Base classes: `BasePaymentVerifier`, `BaseReclaimVerifier`, `BaseReclaimPaymentVerifier`
- Platform-specific verifiers: Venmo, Revolut, Cashapp, Wise, MercadoPago, Zelle variants, Paypal, Monzo
- Each verifier handles platform-specific proof verification and payment validation

**Nullifier Registry** (`contracts/verifiers/nullifierRegistries/`)
- Prevents double-spending by tracking used nullifiers
- Shared across verifiers to ensure payment uniqueness

**Utility Libraries** (`contracts/lib/`)
- `ClaimVerifier` - Core claim verification logic
- `StringConversionUtils`, `DateParsing` - Data processing utilities
- `Bytes32ConversionUtils` - Type conversion helpers

### Key Directories

- `contracts/` - Solidity smart contracts
- `deploy/` - Hardhat deployment scripts numbered sequentially
- `test/` - Comprehensive test suite organized by component type
- `utils/` - TypeScript utilities for testing and deployment
- `deployments/` - Network-specific deployment artifacts and addresses
- `tasks/` - Custom Hardhat tasks for contract interaction

### Module Aliases

The project uses module aliases defined in package.json:
- `@utils` maps to `utils/`
- `@typechain` maps to `typechain/`

### Network Configuration

- **localhost**: Local Hardhat network
- **sepolia**: Ethereum testnet
- **base**: Base mainnet
- **base_staging**: Base staging environment

All networks support contract verification via Etherscan/Basescan APIs.

## Testing Strategy

Tests are organized into categories:
- `libs/` - Library and utility function tests
- `verifiers/` - Payment verifier logic tests
- `periphery/` - Peripheral contract tests (Quoter, etc.)
- `escrow/` - Core escrow functionality tests
- `integration/` - End-to-end workflow tests
- `deploy/` - Deployment script validation tests

## Development Notes

- Uses Solidity 0.8.18 with optimizer enabled (200 runs)
- TypeChain generates type-safe contract interfaces in `typechain/`
- Supports both unit testing with Mocha/Chai and integration testing
- Coverage reports available via `yarn coverage`
- Gas reporting can be enabled in hardhat.config.ts

## Local Node Setup (from README)

1. Run `yarn install` from the contracts directory
2. Run `npx hardhat node`
3. Configure browser wallet with local hardhat network
4. Import account private key for Account #0 (the deployer)
5. Run `yarn deploy:localhost`