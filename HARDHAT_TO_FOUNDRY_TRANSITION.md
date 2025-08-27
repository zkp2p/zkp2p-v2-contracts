# Transitioning from Hardhat to Foundry Testing: A Paradigm Shift

## Executive Summary

**The Short Answer**: No, you cannot simply 1:1 convert Hardhat tests to Foundry fuzz tests by adding bounds/assumes. The testing paradigm fundamentally changes from **testing specific scenarios** to **testing properties and relationships**. However, Foundry is largely a superset - you gain powerful capabilities while potentially losing some integration testing convenience.

---

## Table of Contents
1. [The Fundamental Difference](#the-fundamental-difference)
2. [Conversion Strategy](#conversion-strategy)
3. [What Foundry Adds](#what-foundry-adds)
4. [What You Might Miss](#what-you-might-miss)
5. [Practical Conversion Examples](#practical-conversion-examples)
6. [Hybrid Approach](#hybrid-approach)
7. [Decision Framework](#decision-framework)

---

## The Fundamental Difference

### Hardhat Testing Mindset
```typescript
// "I will test that depositing 100 USDC works correctly"
it("should transfer the tokens to the Ramp contract", async () => {
    await ramp.createDeposit(usdc(100));
    expect(await usdcToken.balanceOf(ramp.address)).to.eq(usdc(100));
});
```
**Philosophy**: Test known scenarios with predetermined inputs and expected outputs.

### Foundry Fuzz Testing Mindset
```solidity
// "I will test that ANY valid deposit amount works correctly"
function testFuzz_Deposit(uint256 amount) public {
    amount = bound(amount, 1e6, 1000000e6);
    uint256 balanceBefore = usdc.balanceOf(address(ramp));
    
    ramp.createDeposit(amount);
    
    // Test the RELATIONSHIP, not the VALUE
    assertEq(usdc.balanceOf(address(ramp)), balanceBefore + amount);
}
```
**Philosophy**: Test that properties hold across all possible inputs.

### The Mental Model Shift

| Aspect | Hardhat/Unit Testing | Foundry/Fuzz Testing |
|--------|---------------------|---------------------|
| **Input** | Specific values | Random ranges |
| **Output** | Exact expectations | Properties & relationships |
| **Coverage** | Known edge cases | Unknown edge cases |
| **Bugs Found** | Expected failures | Unexpected failures |
| **Test Design** | Scenarios | Invariants |
| **Verification** | "Does it do X?" | "Does it always maintain Y?" |

---

## Conversion Strategy

### Level 1: Direct Translation (Basic)
**Can you do it?** Yes, but you're missing the point.

```solidity
// Hardhat test translated literally to Foundry
function test_DepositExactAmount() public {
    uint256 amount = 100e6; // Hardcoded like Hardhat
    
    ramp.createDeposit(amount);
    
    assertEq(usdc.balanceOf(address(ramp)), amount);
}
```
**Problem**: This is just Hardhat in Solidity. No fuzzing benefit.

### Level 2: Adding Fuzzing (Better)
**Convert specific values to ranges:**

```solidity
function testFuzz_Deposit(uint256 amount) public {
    // Add bounds based on your Hardhat test cases
    amount = bound(amount, 1e6, 1000000e6);
    
    uint256 preBalance = usdc.balanceOf(address(ramp));
    ramp.createDeposit(amount);
    uint256 postBalance = usdc.balanceOf(address(ramp));
    
    // Test relationship, not specific value
    assertEq(postBalance - preBalance, amount);
}
```
**Better**: Now testing many values, but still thinking in unit test terms.

### Level 3: Property-Based Thinking (Best)
**Test mathematical and logical properties:**

```solidity
function testFuzz_DepositProperties(uint256 amount1, uint256 amount2) public {
    amount1 = bound(amount1, 1e6, 1000000e6);
    amount2 = bound(amount2, 1e6, 1000000e6);
    
    // Property 1: Deposits are additive
    uint256 deposit1 = createDeposit(amount1);
    uint256 deposit2 = createDeposit(amount2);
    
    assertEq(
        ramp.getTotalDeposits(),
        amount1 + amount2,
        "Deposits not additive"
    );
    
    // Property 2: No value destruction
    assertGe(
        usdc.balanceOf(address(ramp)),
        amount1 + amount2,
        "Value destroyed"
    );
    
    // Property 3: Monotonicity
    if (amount1 > amount2) {
        assertGt(
            ramp.getDeposit(deposit1).amount,
            ramp.getDeposit(deposit2).amount,
            "Monotonicity violated"
        );
    }
}
```
**Best**: Testing properties that MUST hold, not specific scenarios.

---

## What Foundry Adds

### 1. **Unknown Unknown Discovery** 🎯
Hardhat tests what you think of. Foundry finds what you didn't.

```solidity
// This might find that amount = 2^255 + 1 causes overflow
function testFuzz_UnexpectedEdgeCase(uint256 amount) public {
    vm.assume(amount > 0);
    
    // Fuzzer might find:
    // - Precision loss at certain values
    // - Gas issues at large arrays
    // - Unexpected state at boundary conditions
    deposit(amount);
}
```

### 2. **Invariant Testing** 🔒
Test properties that must ALWAYS be true:

```solidity
function invariant_ProtocolSolvency() public {
    // This runs after EVERY operation in a random sequence
    assertGe(
        usdc.balanceOf(address(escrow)),
        escrow.getTotalObligations(),
        "Insolvent!"
    );
}
```
**Hardhat equivalent**: Would require manually testing every possible sequence.

### 3. **Stateful Fuzzing** 🎲
Test complex interaction patterns:

```solidity
contract EscrowHandler {
    function deposit(uint256 amount) public { /* ... */ }
    function withdraw(uint256 amount) public { /* ... */ }
    function signal(uint256 amount) public { /* ... */ }
}

// Foundry randomly calls these in any order with any values
// and checks invariants hold after each sequence
```
**Hardhat equivalent**: Would need to write hundreds of specific test cases.

### 4. **Symbolic Test Coverage** 📊
Instead of testing `[0, 1, 100, MAX]`, fuzzer tests the entire range:

```solidity
function testFuzz_FullRangeCoverage(uint8 percentage) public {
    // Tests all 256 possible values automatically
    uint256 fee = (amount * percentage) / 100;
    
    // Property: Fee never exceeds amount
    assertLe(fee, amount);
}
```

### 5. **Performance Under Stress** ⚡
```solidity
function testFuzz_GasUnderStress(uint8 numOps) public {
    for (uint i = 0; i < numOps; i++) {
        escrow.addPaymentMethod(...);
    }
    
    uint256 gasUsed = gasleft();
    escrow.withdrawDeposit(depositId);
    gasUsed = gasUsed - gasleft();
    
    assertLt(gasUsed, 8_000_000, "DoS vulnerability");
}
```

### 6. **Differential Testing** 🔄
Compare implementations automatically:

```solidity
function testFuzz_DifferentialBehavior(uint256 input) public {
    uint256 result1 = implementationV1(input);
    uint256 result2 = implementationV2(input);
    
    assertEq(result1, result2, "Implementations differ");
}
```

---

## What You Might Miss

### 1. **Specific Business Logic Scenarios** 📋
Some business rules need exact scenarios:

```typescript
// Hardhat - Easy to test specific business rule
it("should give 10% bonus for deposits on Tuesdays", async () => {
    await network.provider.send("evm_setNextBlockTimestamp", [TUESDAY_TIMESTAMP]);
    await deposit(100);
    expect(getBonus()).to.eq(10);
});
```

```solidity
// Foundry - Can do it but less natural
function test_TuesdayBonus() public {
    vm.warp(TUESDAY_TIMESTAMP);
    // ... not fuzzing, just unit testing
}
```

### 2. **Complex Integration Tests** 🔗
Hardhat excels at testing with external services:

```typescript
// Hardhat - Natural async/await pattern
it("should verify payment through external API", async () => {
    const proof = await paymentAPI.getProof(txHash);
    await ramp.verifyPayment(proof);
    expect(await ramp.isVerified(txHash)).to.be.true;
});
```

### 3. **Detailed Event Sequence Testing** 📝
Hardhat makes it easier to test exact event sequences:

```typescript
// Hardhat - Clean event testing
await expect(ramp.createDeposit(100))
    .to.emit(ramp, "DepositReceived").withArgs(0, depositor, usdc, 100)
    .to.emit(ramp, "PaymentMethodAdded").withArgs(0, venmo)
    .to.emit(ramp, "CurrencyAdded").withArgs(0, "USD");
```

### 4. **JavaScript/TypeScript Conveniences** 🛠️
- BigNumber utilities
- Async/await patterns
- NPM package ecosystem
- Existing helper libraries

---

## Practical Conversion Examples

### Example 1: State Update Test

**Hardhat Test:**
```typescript
it("should correctly update the deposits mapping", async () => {
    await ramp.createDeposit({
        amount: usdc(100),
        intentAmountRange: { min: usdc(10), max: usdc(200) }
    });
    
    const deposit = await ramp.getDeposit(0);
    expect(deposit.amount).to.eq(usdc(100));
    expect(deposit.intentAmountRange.min).to.eq(usdc(10));
    expect(deposit.intentAmountRange.max).to.eq(usdc(200));
});
```

**Foundry Conversion (Level 1 - Basic):**
```solidity
function test_DepositStateUpdate() public {
    // Direct translation - not using fuzzing
    ramp.createDeposit(100e6, 10e6, 200e6);
    
    Deposit memory deposit = ramp.getDeposit(0);
    assertEq(deposit.amount, 100e6);
    assertEq(deposit.intentAmountRange.min, 10e6);
    assertEq(deposit.intentAmountRange.max, 200e6);
}
```

**Foundry Conversion (Level 2 - With Fuzzing):**
```solidity
function testFuzz_DepositStateUpdate(
    uint256 amount,
    uint256 minIntent,
    uint256 maxIntent
) public {
    // Add realistic bounds
    amount = bound(amount, 1e6, 1000000e6);
    minIntent = bound(minIntent, 1e6, amount);
    maxIntent = bound(maxIntent, minIntent, amount * 10);
    
    uint256 depositId = ramp.createDeposit(amount, minIntent, maxIntent);
    
    Deposit memory deposit = ramp.getDeposit(depositId);
    assertEq(deposit.amount, amount);
    assertEq(deposit.intentAmountRange.min, minIntent);
    assertEq(deposit.intentAmountRange.max, maxIntent);
}
```

**Foundry Conversion (Level 3 - Property-Based):**
```solidity
function testFuzz_DepositInvariants(
    uint256 amount,
    uint256 minIntent,
    uint256 maxIntent
) public {
    vm.assume(amount > 0 && amount < type(uint128).max);
    vm.assume(minIntent > 0 && minIntent <= amount);
    vm.assume(maxIntent >= minIntent && maxIntent <= amount * 10);
    
    uint256 depositId = ramp.createDeposit(amount, minIntent, maxIntent);
    
    // Test PROPERTIES, not values
    Deposit memory deposit = ramp.getDeposit(depositId);
    
    // Property 1: Range is valid
    assertLe(deposit.intentAmountRange.min, deposit.intentAmountRange.max);
    
    // Property 2: Amount is conserved
    assertEq(usdc.balanceOf(address(ramp)), amount);
    
    // Property 3: Deposit is retrievable
    assertTrue(deposit.depositor != address(0));
}
```

### Example 2: Revert Condition Test

**Hardhat Test:**
```typescript
describe("when the min intent amount is greater than max", () => {
    it("should revert", async () => {
        await expect(
            ramp.createDeposit({
                amount: usdc(100),
                intentAmountRange: { min: usdc(200), max: usdc(100) }
            })
        ).to.be.revertedWithCustomError(ramp, "InvalidRange");
    });
});
```

**Foundry Conversion (With Fuzzing):**
```solidity
function testFuzz_RevertInvalidRange(
    uint256 amount,
    uint256 min,
    uint256 max
) public {
    amount = bound(amount, 1e6, 1000000e6);
    
    // Ensure invalid range
    vm.assume(min > max);
    vm.assume(min > 0 && min < type(uint128).max);
    vm.assume(max > 0 && max < min);
    
    vm.expectRevert(
        abi.encodeWithSelector(Escrow.InvalidRange.selector, min, max)
    );
    ramp.createDeposit(amount, min, max);
}
```

### Example 3: Event Emission Test

**Hardhat Test:**
```typescript
it("should emit a DepositReceived event", async () => {
    await expect(ramp.createDeposit(depositParams))
        .to.emit(ramp, "DepositReceived")
        .withArgs(0, depositor.address, usdc.address, amount);
});
```

**Foundry Conversion (With Fuzzing):**
```solidity
function testFuzz_EmitDepositReceived(uint256 amount) public {
    amount = bound(amount, 1e6, 1000000e6);
    
    // Get current deposit counter for expected ID
    uint256 expectedId = ramp.depositCounter();
    
    vm.expectEmit(true, true, true, true);
    emit DepositReceived(expectedId, depositor, address(usdc), amount);
    
    ramp.createDeposit(amount);
}
```

### Example 4: Complex State Machine Test

**Hardhat Test:**
```typescript
describe("deposit lifecycle", () => {
    it("should handle full lifecycle", async () => {
        // Create
        await ramp.createDeposit(depositParams);
        expect(await ramp.getDeposit(0).amount).to.eq(100);
        
        // Add funds
        await ramp.addFundsToDeposit(0, 50);
        expect(await ramp.getDeposit(0).amount).to.eq(150);
        
        // Remove funds
        await ramp.removeFundsFromDeposit(0, 30);
        expect(await ramp.getDeposit(0).amount).to.eq(120);
        
        // Withdraw
        await ramp.withdrawDeposit(0);
        expect(await ramp.getDeposit(0).depositor).to.eq(ADDRESS_ZERO);
    });
});
```

**Foundry Conversion (Stateful Fuzzing):**
```solidity
contract DepositLifecycleHandler {
    Escrow escrow;
    
    // Ghost accounting
    mapping(uint256 => uint256) public ghostBalances;
    
    function createDeposit(uint256 amount) public {
        amount = bound(amount, 1e6, 1000000e6);
        uint256 id = escrow.createDeposit(amount);
        ghostBalances[id] = amount;
    }
    
    function addFunds(uint256 depositId, uint256 amount) public {
        amount = bound(amount, 1e6, 1000000e6);
        if (ghostBalances[depositId] > 0) {
            escrow.addFundsToDeposit(depositId, amount);
            ghostBalances[depositId] += amount;
        }
    }
    
    function removeFunds(uint256 depositId, uint256 amount) public {
        if (ghostBalances[depositId] > 0) {
            amount = bound(amount, 0, ghostBalances[depositId]);
            escrow.removeFundsFromDeposit(depositId, amount);
            ghostBalances[depositId] -= amount;
        }
    }
}

// Invariant test
function invariant_DepositIntegrity() public {
    // After ANY sequence of operations, this must hold
    uint256 totalGhost = 0;
    for (uint i = 0; i < handler.depositCount(); i++) {
        totalGhost += handler.ghostBalances(i);
    }
    
    assertEq(
        usdc.balanceOf(address(escrow)),
        totalGhost,
        "Ghost accounting mismatch"
    );
}
```

---

## Hybrid Approach

### The Optimal Strategy: Use Both

```
├── test/
│   ├── unit/           # Hardhat: Business logic, integration
│   │   ├── escrow.spec.ts
│   │   └── orchestrator.spec.ts
│   └── test-foundry/   # Foundry: Fuzz, invariants, properties
│       ├── fuzz/
│       │   └── EscrowFuzz.t.sol
│       └── invariant/
│           └── ProtocolInvariants.t.sol
```

### When to Use Hardhat

1. **Integration Tests**
   ```typescript
   // Testing with external APIs, oracles, etc.
   const price = await chainlink.getPrice();
   await escrow.updatePrice(price);
   ```

2. **Specific Business Scenarios**
   ```typescript
   // Testing exact business rules
   it("should apply holiday discount on Dec 25", async () => {
       await time.setNextBlockTimestamp(DEC_25);
       // ... specific logic
   });
   ```

3. **Complex Setup/Teardown**
   ```typescript
   beforeEach(async () => {
       // Complex multi-contract deployment
       // Mock setups
       // Initial state configuration
   });
   ```

4. **UI/Frontend Integration**
   ```typescript
   // Testing with frontend interactions
   const tx = await contract.connect(signer).method();
   const receipt = await tx.wait();
   ```

### When to Use Foundry

1. **Mathematical Properties**
   ```solidity
   function testFuzz_FeeCalculation(uint256 amount, uint256 rate) public {
       // Test fee properties across all inputs
   }
   ```

2. **Security Properties**
   ```solidity
   function invariant_NoNegativeBalances() public {
       // Always true after any operation sequence
   }
   ```

3. **State Machine Testing**
   ```solidity
   contract StateMachineHandler {
       // Random operation sequences
   }
   ```

4. **Performance Testing**
   ```solidity
   function testFuzz_GasLimits(uint256 operations) public {
       // Test gas across different scales
   }
   ```

---

## Decision Framework

### Conversion Decision Tree

```
Is your test checking...
│
├── A specific business rule? → Keep in Hardhat
├── An exact sequence of events? → Keep in Hardhat  
├── Integration with external services? → Keep in Hardhat
├── That a property always holds? → Convert to Foundry Fuzz
├── Mathematical relationships? → Convert to Foundry Fuzz
├── Security invariants? → Convert to Foundry Invariant
├── Unknown edge cases? → Convert to Foundry Fuzz
└── Gas limits under stress? → Convert to Foundry Fuzz
```

### Migration Priority

**High Priority to Convert:**
1. Fee calculations
2. Token transfer logic
3. Access control
4. State transitions
5. Mathematical operations

**Low Priority to Convert:**
1. Event emission order
2. Specific error messages
3. View function returns
4. Simple getters/setters

**Keep in Hardhat:**
1. External integrations
2. Time-specific scenarios
3. Multi-contract orchestration
4. UI interaction tests

---

## Key Insights

### 1. **It's Not About Translation, It's About Transformation**
Don't think "How do I write this test in Solidity?" 
Think "What property does this test verify?"

### 2. **Foundry is (Mostly) a Superset**
- ✅ Can do everything Hardhat does (unit tests in Solidity)
- ✅ Plus fuzzing, invariants, symbolic execution
- ⚠️ But less convenient for some integration patterns
- ⚠️ Requires different mental model

### 3. **The Ghost Pattern is Your Friend**
Track external effects, not internal state:
```solidity
contract GhostAccounting {
    uint256 totalIn;
    uint256 totalOut;
    
    // After any operation sequence:
    // token.balanceOf(protocol) == totalIn - totalOut
}
```

### 4. **Start Gradually**
1. Keep existing Hardhat tests
2. Add Foundry fuzz tests for new features
3. Gradually migrate critical paths
4. Maintain both for different purposes

### 5. **The Real Power: Finding Unknown Unknowns**
Hardhat tests what you expect.
Foundry finds what you don't.

---

## Conclusion

### Your Question Answered

**"Can I 1:1 convert Hardhat tests to Foundry?"**
- **Technically**: Yes, you can write unit tests in Solidity
- **Practically**: You shouldn't - you'd miss the paradigm shift
- **Optimally**: Transform tests to leverage fuzzing and invariants

**"Is Foundry purely a superset?"**
- **Mostly yes**: All unit testing + powerful fuzzing
- **Small gaps**: Less convenient for integration tests
- **Net positive**: Massive security and coverage improvements

**"Will I miss things on Foundry side?"**
- **You'll miss**: Some JS conveniences, easy async patterns
- **You'll gain**: Unknown edge case discovery, property verification
- **Solution**: Use both tools for their strengths

### The Mental Model Shift

From asking:
> "Does depositing 100 USDC work?"

To asking:
> "Does depositing ANY valid amount maintain protocol solvency?"

This shift from **testing scenarios** to **testing properties** is the key to mastering Foundry and significantly improving your protocol's security.

### Final Recommendation

1. **Keep your Hardhat tests** - They're valuable for specific scenarios
2. **Add Foundry fuzz tests** - For mathematical and security properties
3. **Use handlers for complex flows** - Let the fuzzer explore state spaces
4. **Think in invariants** - What must always be true?
5. **Embrace the paradigm shift** - Properties over scenarios

The goal isn't to translate your tests - it's to transcend them.