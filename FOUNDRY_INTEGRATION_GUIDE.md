# Foundry Integration Guide for ZKP2P V2

## Current Setup Status ✅

You've successfully:
1. Installed Foundry (`forge`, `cast`, `anvil`)
2. Initialized Foundry in the project (`forge init --no-git --no-commit`)
3. Updated `foundry.toml` to point to `contracts/` directory
4. Compiled contracts with Foundry (artifacts in `out/` folder)
5. Kept all existing Hardhat tests intact

## Foundry Configuration

Your current `foundry.toml`:
```toml
[profile.default]
src = 'contracts'
out = 'out'
libs = ['node_modules', 'lib']
test = 'test'
cache_path = 'cache_forge'
```

## Next Steps Action Plan

### 1. Install Hardhat-Foundry Plugin (Recommended)
```bash
# This enables seamless integration between Hardhat and Foundry
npm install --save-dev @nomicfoundation/hardhat-foundry

# Add to hardhat.config.ts:
# import "@nomicfoundation/hardhat-foundry";
```

### 2. Set Up Test Directory Structure
```bash
# Create Foundry test directories
mkdir -p test-foundry/{unit,fuzz,invariant,gas}

# Clean up example files if they exist
rm -f src/Counter.sol test/Counter.t.sol script/Counter.s.sol
```

### 3. Update foundry.toml for Better Organization
```toml
[profile.default]
src = 'contracts'
out = 'out'
libs = ['node_modules', 'lib']
test = 'test-foundry'              # Separate Foundry tests from Hardhat
cache_path = 'cache_forge'
optimizer = true
optimizer_runs = 800                # Match your Hardhat settings
solc_version = '0.8.18'

# Remappings
remappings = [
    '@openzeppelin/=node_modules/@openzeppelin/',
    'contracts/=contracts/',
    'forge-std/=lib/forge-std/src/'
]

# Fuzzing configuration
[fuzz]
runs = 256                          # Start with moderate runs
max_test_rejects = 65536
seed = '0x3e8'

[invariant]
runs = 256
depth = 15
fail_on_revert = false
```

### 4. Add NPM Scripts
```json
// Add to package.json
"scripts": {
  // ... existing scripts
  "forge:build": "forge build",
  "forge:test": "forge test -vvv",
  "forge:test:fuzz": "forge test --match-contract Fuzz -vvv",
  "forge:test:gas": "forge test --gas-report",
  "forge:coverage": "forge coverage"
}
```

## Orchestrator Fuzz Testing Strategy

### Critical Areas to Fuzz Test

Based on analysis of `Orchestrator.sol`, here are the key areas that would benefit most from fuzz testing:

#### 1. **Fee Calculation Boundaries** (Lines 466-487)
- Protocol fee calculations with various amounts
- Referrer fee calculations
- Combined fee scenarios
- Edge cases: zero fees, maximum fees, precision loss

#### 2. **Intent Amount Validation** (Lines 380-431)
- Amount ranges from deposits
- Conversion rate calculations
- Minimum/maximum amount boundaries
- Overflow/underflow protection

#### 3. **Signature Expiration Logic** (Lines 423-424)
- Timestamp boundaries
- Expiration edge cases
- Time-based attacks

#### 4. **Intent Hash Uniqueness** (Lines 436-448)
- Hash collision resistance
- Counter overflow scenarios
- Circom prime field modulo operation

#### 5. **Conversion Rate Handling** (Lines 414-418)
- Minimum rate validation
- Precision handling
- Mathematical operations with rates

## Foundry Test Implementation

### Create Base Test Contract
```solidity
// test-foundry/OrchestratorTest.t.sol
pragma solidity ^0.8.18;

import "forge-std/Test.sol";
import "../contracts/Orchestrator.sol";
import "../contracts/interfaces/IOrchestrator.sol";

contract OrchestratorBaseTest is Test {
    Orchestrator public orchestrator;
    // ... setup code
    
    function setUp() public {
        // Deploy contracts and setup
    }
}
```

### Fuzz Test Examples for Orchestrator

#### 1. Fuzz Test Fee Calculations
```solidity
contract OrchestratorFuzzTest is OrchestratorBaseTest {
    
    // Fuzz test protocol fee calculations
    function testFuzz_ProtocolFeeCalculation(
        uint256 amount,
        uint256 feeRate
    ) public {
        // Bound inputs to realistic ranges
        amount = bound(amount, 1e6, 1e24);  // 1 USDC to 1M tokens
        feeRate = bound(feeRate, 0, 5e16);  // 0% to 5% max
        
        // Set protocol fee
        vm.prank(owner);
        orchestrator.setProtocolFee(feeRate);
        
        // Calculate expected fee
        uint256 expectedFee = (amount * feeRate) / 1e18;
        
        // Verify no overflow and correct calculation
        assertLe(expectedFee, amount, "Fee should not exceed amount");
        
        // Test actual fee collection in intent
        // ... setup and execute intent with fuzzed amount
    }
    
    // Fuzz test combined fees don't exceed amount
    function testFuzz_CombinedFeesNeverExceedAmount(
        uint256 amount,
        uint256 protocolFee,
        uint256 referrerFee
    ) public {
        amount = bound(amount, 1e6, 1e24);
        protocolFee = bound(protocolFee, 0, 5e16);
        referrerFee = bound(referrerFee, 0, 5e16);
        
        uint256 totalFees = (amount * protocolFee / 1e18) + 
                           (amount * referrerFee / 1e18);
        
        assertTrue(totalFees <= amount, "Combined fees exceed amount");
        
        // Also verify user receives non-zero amount
        uint256 netAmount = amount - totalFees;
        assertTrue(netAmount > 0 || amount == 0, "User should receive funds");
    }
}
```

#### 2. Fuzz Test Intent Validation
```solidity
function testFuzz_SignalIntentAmountBounds(
    uint256 intentAmount,
    uint256 depositMin,
    uint256 depositMax,
    uint256 conversionRate
) public {
    // Bound to realistic values
    depositMin = bound(depositMin, 1e6, 1e20);
    depositMax = bound(depositMax, depositMin, 1e24);
    intentAmount = bound(intentAmount, 0, 1e24);
    conversionRate = bound(conversionRate, 1e15, 1e21); // 0.001 to 1000
    
    // Setup deposit with fuzzed ranges
    _createDepositWithRanges(depositMin, depositMax);
    
    // Test signalIntent with fuzzed amount
    if (intentAmount < depositMin || intentAmount > depositMax) {
        vm.expectRevert();
    }
    
    _signalIntentWithAmount(intentAmount, conversionRate);
}
```

#### 3. Fuzz Test Signature Expiration
```solidity
function testFuzz_SignatureExpirationBoundaries(
    uint256 currentTime,
    uint256 expirationTime
) public {
    // Bound times to realistic ranges
    currentTime = bound(currentTime, block.timestamp, block.timestamp + 365 days);
    expirationTime = bound(expirationTime, 0, type(uint64).max);
    
    // Warp to fuzzed current time
    vm.warp(currentTime);
    
    // Create intent params with fuzzed expiration
    IOrchestrator.SignalIntentParams memory params = _getBaseParams();
    params.signatureExpiration = expirationTime;
    
    // Test validation
    if (currentTime > expirationTime && params.gatingServiceSignature.length > 0) {
        vm.expectRevert(abi.encodeWithSelector(
            IOrchestrator.SignatureExpired.selector,
            expirationTime,
            currentTime
        ));
    }
    
    orchestrator.signalIntent(params);
}
```

#### 4. Fuzz Test Intent Hash Uniqueness
```solidity
function testFuzz_IntentHashUniqueness(uint256 numIntents) public {
    numIntents = bound(numIntents, 1, 1000);
    
    bytes32[] memory hashes = new bytes32[](numIntents);
    
    for (uint256 i = 0; i < numIntents; i++) {
        // Signal intent and get hash
        bytes32 intentHash = _signalAndGetHash();
        
        // Check uniqueness
        for (uint256 j = 0; j < i; j++) {
            assertTrue(hashes[j] != intentHash, "Hash collision detected");
        }
        
        hashes[i] = intentHash;
    }
}
```

#### 5. Invariant Testing
```solidity
contract OrchestratorInvariantTest is OrchestratorBaseTest {
    
    // Invariant: Total fees never exceed MAX_PROTOCOL_FEE
    function invariant_ProtocolFeeLimit() public {
        assertLe(orchestrator.protocolFee(), 5e16);
    }
    
    // Invariant: Intent counter only increases
    function invariant_IntentCounterMonotonic() public {
        uint256 currentCounter = orchestrator.intentCounter();
        assertTrue(currentCounter >= lastKnownCounter);
        lastKnownCounter = currentCounter;
    }
    
    // Invariant: No intent can have zero owner unless deleted
    function invariant_IntentOwnerConsistency() public {
        // Check random intent hashes
        bytes32 intentHash = _getRandomIntentHash();
        IOrchestrator.Intent memory intent = orchestrator.getIntent(intentHash);
        
        if (intent.timestamp != 0) {
            assertTrue(intent.owner != address(0), "Active intent has zero owner");
        }
    }
}
```

## Gas Optimization Testing

```solidity
contract OrchestratorGasTest is OrchestratorBaseTest {
    
    function test_SignalIntentGas() public {
        uint256 gasBefore = gasleft();
        _signalIntent();
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used for signalIntent:", gasUsed);
        assertLt(gasUsed, 200000, "Gas usage too high");
    }
    
    function test_FulfillIntentGas() public {
        bytes32 intentHash = _setupIntent();
        
        uint256 gasBefore = gasleft();
        _fulfillIntent(intentHash);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used for fulfillIntent:", gasUsed);
        assertLt(gasUsed, 300000, "Gas usage too high");
    }
}
```

## Recommended Testing Priority

1. **Week 1: Core Fuzz Tests**
   - Fee calculation boundaries
   - Amount validation ranges
   - Conversion rate edge cases

2. **Week 2: Security-Critical Tests**
   - Signature validation edge cases
   - Hash collision resistance
   - Reentrancy scenarios

3. **Week 3: Invariant Tests**
   - Protocol state consistency
   - Fund accounting invariants
   - Intent lifecycle invariants

4. **Ongoing: Gas Optimization**
   - Benchmark current gas usage
   - Test optimization changes
   - Compare with Hardhat tests

## Commands to Run

```bash
# Run all Foundry tests
forge test

# Run only fuzz tests with more iterations
forge test --match-contract Fuzz --fuzz-runs 10000

# Run with gas reporting
forge test --gas-report

# Run specific test with verbose output
forge test --match-test testFuzz_ProtocolFeeCalculation -vvvv

# Generate coverage report
forge coverage

# Create gas snapshot
forge snapshot

# Compare gas changes
forge snapshot --diff
```

## Integration Benefits

### Why Foundry for These Tests?

1. **Speed**: Fuzz tests run 10-100x faster than JavaScript property tests
2. **Native Fuzzing**: Built-in fuzzer finds edge cases automatically
3. **Invariant Testing**: Continuously verify protocol properties
4. **Gas Snapshots**: Track gas optimization progress
5. **Fork Testing**: Test against mainnet state efficiently

### Keep Hardhat For:

1. Integration tests (multi-contract flows)
2. Deployment scripts
3. External service mocking
4. Complex event testing
5. Your existing test suite

## Next Immediate Actions

1. ✅ Create `test-foundry/` directory structure
2. ✅ Update `foundry.toml` with recommended settings
3. ✅ Install hardhat-foundry plugin
4. ✅ Write first fuzz test for fee calculations
5. ✅ Run test and verify it works
6. ✅ Gradually add more fuzz tests for critical functions

This dual approach gives you the best of both worlds without disrupting your existing workflow!