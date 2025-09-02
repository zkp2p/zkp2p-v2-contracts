/**
 * @zkp2p/contracts-v2
 * 
 * ZKP2P V2 smart contract addresses, ABIs, and utilities
 * 
 * @packageDocumentation
 */

// This is the main entry point that just exports types
// The actual modules are exported via package.json exports field

export type { PaymentMethodConfig, NetworkPaymentMethods } from '../paymentMethods/types';

// Re-export version
export { version } from '../package.json';