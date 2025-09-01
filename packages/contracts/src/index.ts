/**
 * @zkp2p/contracts
 * 
 * ZKP2P V2 smart contract addresses, ABIs, and utilities
 * 
 * @packageDocumentation
 */

// Network-specific contract addresses
export * as addresses from '../addresses';

// Network-specific ABIs
export * as abis from '../abis';

// Network-specific constants
export * as constants from '../constants';

// Network-specific payment methods (verifiers + provider hashes)
export * as paymentMethods from '../paymentMethods';

// TypeChain types
export * from '../types';

// Utility functions
export * as utils from '../utils';

// Re-export version from package.json
export { version } from '../package.json';

// Helper functions for common operations
export { 
  Currency,
  getCurrencyInfo,
  getPaymentMethodId
} from '../utils/protocolUtils';