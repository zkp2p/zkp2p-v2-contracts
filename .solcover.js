module.exports = {
  skipFiles: ['interfaces', 'mocks', 'external'],
  configureYulOptimizer: true,
  solcOptimizerDetails: {
    yul: true,
    yulDetails: {
      stackAllocation: true,
    }
  },
  mocha: {
    enableTimeouts: false
  }
};
