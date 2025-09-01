/**
 * @zkp2p/contracts-v2
 * 
 * ZKP2P V2 smart contract addresses, ABIs, and utilities
 * 
 * @packageDocumentation
 */

/**
 * @zkp2p/contracts-v2
 *
 * Root entry intentionally minimal. All data modules are exposed via
 * package subpath exports for optimal tree-shaking and compatibility:
 *   - @zkp2p/contracts-v2/addresses
 *   - @zkp2p/contracts-v2/abis/<network>
 *   - @zkp2p/contracts-v2/constants
 *   - @zkp2p/contracts-v2/paymentMethods
 *   - @zkp2p/contracts-v2/types
 *   - @zkp2p/contracts-v2/utils
 */

// Re-export version from package.json
export { version } from '../package.json';
