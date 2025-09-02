// Test setup file for Jest
import { ethers } from 'ethers';

// Set up test environment
beforeAll(() => {
  // Any global setup needed for tests
});

afterAll(() => {
  // Any global cleanup needed after tests
});

// Mock ethers if needed for unit tests
jest.mock('ethers', () => {
  const originalModule = jest.requireActual('ethers');
  return {
    ...originalModule,
    // Add any mocked functions here
  };
});

// Global test utilities
export const TEST_CONSTANTS = {
  ZERO_ADDRESS: ethers.constants.AddressZero,
  MAX_UINT256: ethers.constants.MaxUint256,
  TEST_CHAIN_ID: 31337,
  TEST_BLOCK_NUMBER: 12345678
};

export function mockProvider() {
  return new ethers.providers.JsonRpcProvider('http://localhost:8545');
}

export function mockSigner() {
  const wallet = ethers.Wallet.createRandom();
  return wallet.connect(mockProvider());
}

// Helper to create test addresses
export function generateAddress(): string {
  return ethers.Wallet.createRandom().address;
}

// Helper to create test hashes
export function generateHash(): string {
  return ethers.utils.keccak256(ethers.utils.randomBytes(32));
}