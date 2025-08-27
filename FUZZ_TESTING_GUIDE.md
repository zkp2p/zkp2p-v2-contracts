# Comprehensive Fuzz Testing Guide for ZKP2P V2 Contracts

## Table of Contents
1. [Should You Test All Calculations?](#should-you-test-all-calculations)
2. [What Else to Fuzz Test](#what-else-to-fuzz-test)
3. [Best Practices](#best-practices)
4. [Testing Without Rewriting Logic](#testing-without-rewriting-logic)
5. [Foundry-Specific Recommendations](#foundry-specific-recommendations)
6. [Priority Matrix](#priority-matrix)

---

## Should You Test All Calculations?

### The Short Answer: **No, but test the critical ones.**

Not all calculations deserve equal testing effort. Focus your fuzz testing on calculations that are:

### **MUST Test** (Critical Calculations)
These calculations directly impact user funds or protocol security:

```solidity
// Example from Escrow.sol - These MUST be fuzz tested
uint256 totalFees = 0;
if (makerProtocolFee > 0) {
    totalFees += (_params.amount * makerProtocolFee) / PRECISE_UNIT;  // ✅ Test for precision loss
}
if (_params.referrerFee > 0) {
    totalFees += (_params.amount * _params.referrerFee) / PRECISE_UNIT;  // ✅ Test for overflow
}
uint256 netDepositAmount = _params.amount - totalFees;  // ✅ Test for underflow
```

**Why test these?**
- **Financial Impact**: Errors directly affect user balances
- **Precision Loss**: Integer division can cause rounding errors
- **Edge Cases**: What happens with MAX_UINT256? Zero amounts? Dust amounts?
- **Compounding Effects**: Small errors can compound over many transactions

### **SHOULD Test** (Important Calculations)
These affect protocol functionality but not direct fund transfers:

```solidity
// Conversion rate calculations
uint256 fiatAmount = (cryptoAmount * conversionRate) / PRECISE_UNIT;

// Expiry time calculations  
uint256 expiryTime = block.timestamp + intentExpirationPeriod;

// Available liquidity calculations
uint256 availableAmount = deposit.remainingDeposits + reclaimableAmount;
```

### **NICE TO Test** (Supporting Calculations)
Simple arithmetic or view-only calculations:

```solidity
// Simple counters
depositCounter++;

// Basic comparisons
if (amount > maxAmount) revert();
```

### Decision Framework for Testing Calculations

Ask yourself these questions:
1. **Does it involve user funds?** → MUST test
2. **Does it use division?** → MUST test (precision loss risk)
3. **Can it overflow/underflow?** → MUST test
4. **Is the formula complex?** → SHOULD test
5. **Are there edge cases?** → SHOULD test
6. **Is it a simple increment/decrement?** → NICE to test

---

## What Else to Fuzz Test

### 1. **State Machine Properties**
Test that your contract maintains valid state transitions:

```solidity
// Fuzz test state transitions
function testFuzz_StateTransitions(uint8 action, uint256 amount) public {
    // Bound action to valid range
    action = uint8(bound(action, 0, 4));
    
    // Execute action based on fuzzed input
    if (action == 0) createDeposit(amount);
    else if (action == 1) addFunds(amount);
    else if (action == 2) signalIntent(amount);
    else if (action == 3) fulfillIntent();
    else if (action == 4) withdrawDeposit();
    
    // Assert invariants hold after any sequence
    assert(totalDeposits >= totalIntents);
    assert(remainingLiquidity >= 0);
}
```

### 2. **Invariant Properties**
Properties that should ALWAYS be true:

```solidity
// In your test file
function invariant_TotalBalanceConsistency() public {
    uint256 contractBalance = token.balanceOf(address(escrow));
    uint256 totalUserDeposits = getTotalUserDeposits();
    assertEq(contractBalance, totalUserDeposits, "Balance mismatch");
}

function invariant_NoNegativeLiquidity() public {
    for (uint i = 0; i < depositIds.length; i++) {
        Deposit memory d = escrow.getDeposit(depositIds[i]);
        assert(d.remainingDeposits >= 0);
    }
}
```

### 3. **Access Control Boundaries**
Fuzz test with different caller addresses:

```solidity
function testFuzz_AccessControl(address caller, uint256 depositId) public {
    vm.prank(caller);
    
    // Should revert for unauthorized callers
    if (caller != depositor && caller != delegate) {
        vm.expectRevert();
        escrow.withdrawDeposit(depositId);
    }
}
```

### 4. **Time-Based Logic**
Fuzz test timestamp-dependent functionality:

```solidity
function testFuzz_TimeDependentLogic(uint256 timeJump) public {
    timeJump = bound(timeJump, 0, 365 days);
    
    // Create intent
    bytes32 intentHash = createIntent();
    
    // Jump forward in time
    vm.warp(block.timestamp + timeJump);
    
    // Test expiration logic
    if (timeJump > intentExpirationPeriod) {
        // Intent should be prunable
        assertEq(escrow.isIntentExpired(intentHash), true);
    } else {
        // Intent should still be active
        assertEq(escrow.isIntentExpired(intentHash), false);
    }
}
```

### 5. **Array and Loop Boundaries**
Test gas limits and array operations:

```solidity
function testFuzz_ArrayBoundaries(uint8 numItems) public {
    numItems = uint8(bound(numItems, 0, 100));
    
    // Add multiple payment methods
    for (uint i = 0; i < numItems; i++) {
        escrow.addPaymentMethod(depositId, paymentMethods[i]);
    }
    
    // Should not exceed gas limit for withdrawal
    uint256 gasStart = gasleft();
    escrow.withdrawDeposit(depositId);
    uint256 gasUsed = gasStart - gasleft();
    
    assertLt(gasUsed, 8_000_000, "Gas usage too high");
}
```

### 6. **Economic Attack Vectors**
Test for MEV, sandwich attacks, and griefing:

```solidity
function testFuzz_GriefingResistance(uint256 dustAmount) public {
    dustAmount = bound(dustAmount, 1, dustThreshold);
    
    // Attacker tries to grief with dust deposits
    for (uint i = 0; i < 100; i++) {
        vm.prank(attacker);
        escrow.createDeposit(dustAmount);
    }
    
    // Protocol should handle this gracefully
    assert(escrow.activeDeposits() <= maxDepositsPerUser);
}
```

### 7. **Cross-Function Interactions**
Test complex sequences of operations:

```solidity
function testFuzz_ComplexInteractions(uint8[] memory actions) public {
    for (uint i = 0; i < actions.length; i++) {
        uint8 action = actions[i] % 10;
        
        if (action < 3) deposit();
        else if (action < 6) signalIntent();
        else if (action < 8) fulfillIntent();
        else withdraw();
        
        // Check invariants after each action
        checkProtocolInvariants();
    }
}
```

---

## Best Practices

### 1. **Input Bounding Strategy**

```solidity
// ❌ BAD: Unbounded input can cause unrealistic test failures
function testFuzz_Bad(uint256 amount) public {
    escrow.deposit(amount);  // Will fail with huge amounts
}

// ✅ GOOD: Bounded to realistic ranges
function testFuzz_Good(uint256 amount) public {
    amount = bound(amount, 1e6, 1000000e6);  // 1 to 1M USDC
    escrow.deposit(amount);
}
```

### 2. **Differential Testing**
Compare your implementation against a reference:

```solidity
contract ReferenceFeeCalculator {
    function calculateFee(uint256 amount, uint256 rate) pure returns (uint256) {
        // Simple, clearly correct implementation
        return (amount * rate) / 1e18;
    }
}

function testFuzz_DifferentialFees(uint256 amount, uint256 rate) public {
    amount = bound(amount, 0, type(uint128).max);
    rate = bound(rate, 0, 5e16);
    
    uint256 actualFee = escrow.calculateFee(amount, rate);
    uint256 expectedFee = reference.calculateFee(amount, rate);
    
    assertApproxEqAbs(actualFee, expectedFee, 1, "Fee calculation mismatch");
}
```

### 3. **Property-Based Testing**
Define properties, not specific outcomes:

```solidity
// Instead of testing specific values, test properties
function testFuzz_MonotonicProperty(uint256 a, uint256 b) public {
    a = bound(a, 1, 1000e6);
    b = bound(b, a, 2000e6);  // b >= a
    
    uint256 feeA = calculateFee(a);
    uint256 feeB = calculateFee(b);
    
    // Property: Larger amounts should have larger fees
    assertGe(feeB, feeA, "Fee not monotonic");
}
```

### 4. **Stateful Fuzzing**
Maintain state across multiple fuzz runs:

```solidity
contract StatefulFuzzTest is Test {
    uint256[] activeDeposits;
    mapping(uint256 => uint256) depositAmounts;
    
    function testFuzz_StatefulDeposit(uint256 amount) public {
        amount = bound(amount, 1e6, 1000e6);
        
        uint256 depositId = escrow.createDeposit(amount);
        activeDeposits.push(depositId);
        depositAmounts[depositId] = amount;
        
        // Invariant: Total tracked equals contract balance
        uint256 totalTracked = 0;
        for (uint i = 0; i < activeDeposits.length; i++) {
            totalTracked += depositAmounts[activeDeposits[i]];
        }
        assertEq(token.balanceOf(address(escrow)), totalTracked);
    }
}
```

### 5. **Symbolic Execution Helpers**
Use assume() to guide the fuzzer:

```solidity
function testFuzz_GuidedExecution(uint256 a, uint256 b) public {
    // Guide fuzzer to interesting cases
    vm.assume(a != 0);
    vm.assume(b != 0);
    vm.assume(a < b);
    vm.assume(a + b < type(uint256).max);
    
    // Now test with these constraints
    uint256 result = someComplexCalculation(a, b);
    assert(result > a && result > b);
}
```

### 6. **Coverage-Guided Fuzzing**
Structure tests to maximize code coverage:

```solidity
function testFuzz_MaxCoverage(uint8 scenario, uint256 value) public {
    scenario = uint8(bound(scenario, 0, 10));
    
    // Each scenario exercises different code paths
    if (scenario == 0) {
        // Test zero amount handling
        value = 0;
    } else if (scenario == 1) {
        // Test minimum amount
        value = 1;
    } else if (scenario == 2) {
        // Test maximum amount
        value = type(uint256).max;
    } else if (scenario == 3) {
        // Test dust threshold
        value = dustThreshold;
    } else {
        // Normal range
        value = bound(value, 1e6, 1000e6);
    }
    
    processAmount(value);
}
```

---

## Testing Without Rewriting Logic

### 1. **Use Contract's Public Interface**
Don't reimplement calculations; use the contract's getters:

```solidity
// ❌ BAD: Reimplementing logic in test
function testFuzz_Bad(uint256 amount, uint256 feeRate) public {
    uint256 expectedFee = (amount * feeRate) / 1e18;  // Reimplemented
    uint256 actualFee = escrow.calculateFee(amount, feeRate);
    assertEq(actualFee, expectedFee);
}

// ✅ GOOD: Using contract's interface
function testFuzz_Good(uint256 amount, uint256 feeRate) public {
    escrow.setFeeRate(feeRate);
    uint256 balanceBefore = token.balanceOf(feeRecipient);
    
    escrow.processWithFee(amount);
    
    uint256 balanceAfter = token.balanceOf(feeRecipient);
    uint256 actualFeeCollected = balanceAfter - balanceBefore;
    
    // Test the outcome, not the calculation
    assertGe(actualFeeCollected, 0, "No fee collected");
    assertLe(actualFeeCollected, amount, "Fee exceeds amount");
}
```

### 2. **Event-Based Verification**
Use emitted events to verify internal logic:

```solidity
function testFuzz_EventVerification(uint256 amount) public {
    amount = bound(amount, 1e6, 1000e6);
    
    vm.expectEmit(true, true, true, true);
    emit DepositCreated(depositId, depositor, amount);
    
    escrow.createDeposit(amount);
    
    // Event emission confirms internal logic executed correctly
}
```

### 3. **Helper Contracts for Internal State**
Create test helpers that expose internal state:

```solidity
contract EscrowHarness is Escrow {
    // Expose internal function for testing
    function exposed_calculateInternalFee(uint256 amount) external view returns (uint256) {
        return _calculateInternalFee(amount);
    }
    
    // Expose internal state
    function exposed_getInternalCounter() external view returns (uint256) {
        return internalCounter;
    }
}

// Use harness in tests
function testFuzz_InternalState(uint256 amount) public {
    EscrowHarness harness = new EscrowHarness();
    uint256 internalFee = harness.exposed_calculateInternalFee(amount);
    assertGe(internalFee, 0);
}
```

### 4. **Invariant-Based Testing**
Define what should always be true:

```solidity
// Don't test HOW it calculates, test WHAT must be true
function invariant_ProtocolSolvency() public view {
    uint256 totalUserDeposits = escrow.getTotalDeposits();
    uint256 totalUserWithdrawable = escrow.getTotalWithdrawable();
    uint256 protocolFees = escrow.getAccruedFees();
    uint256 contractBalance = token.balanceOf(address(escrow));
    
    // Invariant: Contract must always have enough to cover obligations
    assertGe(contractBalance, totalUserWithdrawable + protocolFees);
}
```

### 5. **Differential Fuzzing**
Compare outcomes, not implementations:

```solidity
function testFuzz_DifferentialOutcome(uint256 amount1, uint256 amount2) public {
    // Setup two identical deposits
    uint256 deposit1 = escrow.createDeposit(amount1);
    uint256 deposit2 = escrow.createDeposit(amount2);
    
    // Perform same operations
    escrow.processDeposit(deposit1);
    escrow.processDeposit(deposit2);
    
    // If inputs were same, outcomes should be same
    if (amount1 == amount2) {
        assertEq(
            escrow.getDepositValue(deposit1),
            escrow.getDepositValue(deposit2),
            "Same input, different output"
        );
    }
}
```

### 6. **Oracle Pattern**
Use an external source of truth:

```solidity
interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
}

function testFuzz_AgainstOracle(uint256 amount) public {
    uint256 oraclePrice = oracle.getPrice(address(token));
    uint256 protocolPrice = escrow.getTokenPrice(address(token));
    
    // Allow small deviation (0.1%)
    assertApproxEqRel(protocolPrice, oraclePrice, 0.001e18);
}
```

### 7. **State Transition Testing**
Test that state changes correctly without knowing internal logic:

```solidity
function testFuzz_StateTransition(uint256 depositAmount, uint256 withdrawAmount) public {
    depositAmount = bound(depositAmount, 1e6, 1000e6);
    withdrawAmount = bound(withdrawAmount, 0, depositAmount);
    
    // Record state before
    uint256 balanceBefore = escrow.getBalance(user);
    
    // Perform operations
    escrow.deposit(depositAmount);
    escrow.withdraw(withdrawAmount);
    
    // Verify state after
    uint256 balanceAfter = escrow.getBalance(user);
    assertEq(balanceAfter, balanceBefore + depositAmount - withdrawAmount);
}
```

---

## Foundry-Specific Recommendations

### 1. **Optimal Fuzz Configuration**

```toml
# foundry.toml
[profile.default]
fuzz_runs = 256  # Start here for development

[profile.deep]
fuzz_runs = 10000  # For thorough testing before deployment

[profile.ci]
fuzz_runs = 1000  # For CI/CD pipelines

[invariant]
runs = 256
depth = 15
fail_on_revert = false
```

### 2. **Using Foundry Cheatcodes Effectively**

```solidity
function testFuzz_FoundryCheatcodes(uint256 amount) public {
    // Use deal for setting balances
    deal(address(token), alice, amount);
    
    // Use prank for impersonation
    vm.prank(alice);
    escrow.deposit(amount);
    
    // Use warp for time manipulation
    vm.warp(block.timestamp + 1 days);
    
    // Use roll for block manipulation
    vm.roll(block.number + 100);
    
    // Use assume for input filtering
    vm.assume(amount > 0 && amount < type(uint128).max);
}
```

### 3. **Foundry Invariant Testing Setup**

```solidity
// Create handler contract for invariant testing
contract EscrowHandler is Test {
    Escrow escrow;
    
    function deposit(uint256 amount) public {
        amount = bound(amount, 1e6, 1000e6);
        escrow.deposit(amount);
    }
    
    function withdraw(uint256 amount) public {
        amount = bound(amount, 0, escrow.getBalance(msg.sender));
        escrow.withdraw(amount);
    }
}

// In test contract
function setUp() public {
    handler = new EscrowHandler();
    targetContract(address(handler));
}
```

### 4. **Gas Profiling in Fuzz Tests**

```solidity
function testFuzz_GasProfile(uint256 numOperations) public {
    numOperations = bound(numOperations, 1, 100);
    
    uint256 totalGas = 0;
    for (uint i = 0; i < numOperations; i++) {
        uint256 gasBefore = gasleft();
        escrow.someOperation();
        totalGas += gasBefore - gasleft();
    }
    
    emit log_named_uint("Average gas per operation", totalGas / numOperations);
    assertLt(totalGas / numOperations, 100000, "Operation too expensive");
}
```

---

## Priority Matrix

### Prioritize Your Fuzz Testing Effort

| Priority | What to Test | Why | Example |
|----------|-------------|-----|---------|
| **P0 - Critical** | Fund calculations, Fee calculations, Token transfers | Direct financial impact | `calculateFee()`, `transfer()` |
| **P1 - High** | Access control, State transitions, Invariants | Security and correctness | `onlyOwner()`, state machines |
| **P2 - Medium** | Time-based logic, Array operations, Edge cases | Potential for bugs | Expiration, loops |
| **P3 - Low** | View functions, Events, Simple getters | Low risk | `getBalance()`, events |

### Time Allocation Guide

For a typical DeFi protocol:
- **40%** - P0 Critical calculations
- **30%** - P1 Security and state
- **20%** - P2 Edge cases and boundaries  
- **10%** - P3 Supporting functionality

### Red Flags That Require Immediate Fuzz Testing

1. **Any division operation** → Precision loss risk
2. **Unchecked arithmetic** → Overflow/underflow risk
3. **External calls** → Reentrancy risk
4. **Loops over user input** → Gas DOS risk
5. **Complex conditionals** → Logic error risk
6. **Time-dependent logic** → Manipulation risk

---

## Conclusion

### Key Takeaways

1. **Don't test everything** - Focus on critical calculations and security boundaries
2. **Test properties, not implementations** - Use invariants and differential testing
3. **Leverage Foundry's features** - Cheatcodes, invariant testing, and gas profiling
4. **Bound your inputs** - Keep tests realistic and meaningful
5. **Use the contract's interface** - Don't reimplement logic in tests

### Recommended Workflow

1. **Start with critical calculations** - Fee math, token transfers
2. **Add invariant tests** - Properties that must always hold
3. **Test state machines** - Valid and invalid transitions
4. **Fuzz edge cases** - Boundaries, overflows, precision
5. **Profile gas usage** - Ensure operations stay within limits

### Remember

> "The goal isn't to test that your code does what you wrote, but to test that it does what you intended."

Fuzz testing is about finding the unknown unknowns - the edge cases you didn't think of. Focus your effort where bugs would hurt the most, and let the fuzzer explore the space you might have missed.