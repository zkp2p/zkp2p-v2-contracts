# Orchestrator Test Requirements - Comprehensive Analysis

## Executive Summary

The Orchestrator contract is the central coordinator for the ZKP2P protocol, managing intent lifecycle, fee distribution, and fund routing. Testing must ensure:
1. **Financial integrity** - No value creation/destruction, accurate fee calculations
2. **State consistency** - Intent lifecycle management, registry interactions
3. **Security boundaries** - Access control, reentrancy protection, pause mechanisms
4. **Economic resilience** - Protection against griefing, MEV, and fee manipulation

This document prioritizes testing based on risk and provides concrete implementation patterns using handler-based fuzzing and ghost ledgers.

---

## Core Invariants (P0 - CRITICAL)

These properties must **ALWAYS** hold regardless of operation sequence:

### 1. Token Conservation Invariant
```solidity
// INVARIANT: No tokens created or destroyed
// escrow_balance + orchestrator_balance + user_balances = initial_supply
```
**Risk**: Value creation/destruction could drain protocol or mint fake value
**Implementation**: Track all token flows through ghost ledger

### 2. Fee Bounds Invariant
```solidity
// INVARIANT: Total fees never exceed configured maximums
// protocolFee <= MAX_PROTOCOL_FEE (5%)
// referrerFee <= MAX_REFERRER_FEE (5%)
// totalFees <= amount * 10% (combined maximum)
```
**Risk**: Excessive fee extraction, user fund theft
**Implementation**: Check fee calculations against bounds in all paths

### 3. Intent State Consistency
```solidity
// INVARIANT: Intent exists <=> accountIntents contains it
// For every intentHash in intents mapping:
//   - Must exist in accountIntents[intent.owner]
//   - Must have corresponding locked funds in escrow
```
**Risk**: Ghost intents, locked funds without intent, orphaned state
**Implementation**: Cross-reference intent storage with escrow state

### 4. Intent Uniqueness
```solidity
// INVARIANT: Every intentHash is globally unique
// No two intents can have the same hash
// intentCounter only increases, never decreases
```
**Risk**: Intent collision could allow double-spending
**Implementation**: Track all generated hashes, ensure monotonic counter

### 5. Registry Consistency
```solidity
// INVARIANT: All referenced contracts are whitelisted
// verifier in paymentVerifierRegistry
// escrow in escrowRegistry (unless accepting all)
// postIntentHook in postIntentHookRegistry
```
**Risk**: Interaction with malicious contracts
**Implementation**: Validate all external references

---

## Critical Path Tests (P1 - HIGH PRIORITY)

### 1. Fee Calculation Paths

#### Protocol Fee Calculation
```solidity
Property: protocolFeeAmount = (releaseAmount * protocolFee) / PRECISE_UNIT
Tests:
- Monotonicity: larger amounts → larger fees
- Precision: no value lost in division
- Bounds: fees never exceed amount
- Zero handling: zero fee when protocolFee = 0
```

#### Referrer Fee Calculation  
```solidity
Property: referrerFeeAmount = (releaseAmount * referrerFee) / PRECISE_UNIT
Tests:
- Independence: referrer fee doesn't affect protocol fee
- Recipient validation: no fee if referrer = address(0)
- Combined bounds: protocolFee + referrerFee <= 10%
```

#### Net Amount Distribution
```solidity
Property: netAmount = releaseAmount - protocolFee - referrerFee
Tests:
- Conservation: releaseAmount = netAmount + protocolFee + referrerFee
- Minimum output: netAmount > 0 for valid amounts
- Recipient accuracy: funds go to intent.to or postIntentHook
```

### 2. Intent Lifecycle Management

#### Intent Creation Flow
```solidity
signalIntent() path:
1. Validate caller permissions (multiple intents check)
2. Validate intent parameters
3. Calculate unique intentHash
4. Lock funds in escrow
5. Store intent state
6. Update accountIntents
Tests:
- Permission boundaries (relayer vs regular user)
- Parameter validation (amounts, addresses, fees)
- Hash uniqueness across all scenarios
- Atomic state updates
```

#### Intent Fulfillment Flow
```solidity
fulfillIntent() path:
1. Verify intent exists
2. Validate payment proof
3. Calculate release amount
4. Prune intent
5. Transfer from escrow
6. Distribute fees
7. Execute post-intent hook (if any)
Tests:
- Proof validation accuracy
- Release amount calculations
- Fee distribution correctness
- Hook execution safety
- Reentrancy protection
```

#### Intent Cancellation Flow
```solidity
cancelIntent() path:
1. Verify intent exists
2. Verify caller is owner
3. Prune intent
4. Unlock escrow funds
Tests:
- Owner-only access
- Complete state cleanup
- Fund unlocking accuracy
```

### 3. Access Control Boundaries

```solidity
Tests:
- Only intent owner can cancel
- Only depositor can release funds manually
- Only whitelisted escrows can prune intents
- Only owner can update registries/fees
- Pause affects only specific functions
```

### 4. Registry Integration Points

```solidity
Tests:
- Escrow whitelist enforcement
- Payment verifier lookup and validation
- Post-intent hook whitelist check
- Relayer permissions for multiple intents
- Registry update propagation
```

---

## Handler Design for Stateful Testing

### OrchestratorHandler Contract

```solidity
contract OrchestratorHandler is Test {
    // ============ Ghost Ledger ============
    // Track observable effects without reimplementing logic
    
    // Token flow tracking
    uint256 public ghostTotalFeesCollected;
    uint256 public ghostProtocolFeesCollected;
    uint256 public ghostReferrerFeesCollected;
    mapping(address => uint256) public ghostUserNetReceived;
    
    // Intent state tracking
    mapping(bytes32 => bool) public ghostIntentExists;
    mapping(bytes32 => uint256) public ghostIntentAmount;
    mapping(address => uint256) public ghostActiveIntentCount;
    mapping(bytes32 => address) public ghostIntentOwner;
    
    // Intent lifecycle tracking
    uint256 public ghostIntentsCreated;
    uint256 public ghostIntentsFulfilled;
    uint256 public ghostIntentsCancelled;
    uint256 public ghostIntentsReleased;
    
    // Fee configuration tracking
    uint256 public ghostMaxProtocolFeeSeen;
    uint256 public ghostMaxReferrerFeeSeen;
    
    // ============ State Variables ============
    address[] public actors;
    bytes32[] public activeIntents;
    uint256[] public activeDepositIds;
    
    // ============ Bounded Operations ============
    
    function signalIntent(
        uint256 actorSeed,
        uint256 depositSeed,
        uint256 amount,
        uint256 referrerFeeSeed,
        bool useReferrer,
        bool usePostHook
    ) public {
        // Select actor and deposit
        address actor = actors[actorSeed % actors.length];
        if (activeDepositIds.length == 0) return;
        uint256 depositId = activeDepositIds[depositSeed % activeDepositIds.length];
        
        // Bound parameters
        amount = bound(amount, 1e6, 100000e6);
        uint256 referrerFee = bound(referrerFeeSeed, 0, MAX_REFERRER_FEE);
        
        // Build intent params
        IOrchestrator.SignalIntentParams memory params = buildIntentParams(
            depositId, 
            actor, 
            amount, 
            referrerFee,
            useReferrer,
            usePostHook
        );
        
        // Execute and track
        vm.prank(actor);
        try orchestrator.signalIntent(params) {
            bytes32 intentHash = calculateIntentHash();
            
            // Update ghost ledger
            ghostIntentExists[intentHash] = true;
            ghostIntentAmount[intentHash] = amount;
            ghostIntentOwner[intentHash] = actor;
            ghostActiveIntentCount[actor]++;
            ghostIntentsCreated++;
            activeIntents.push(intentHash);
            
            // Track fee configurations
            if (referrerFee > ghostMaxReferrerFeeSeen) {
                ghostMaxReferrerFeeSeen = referrerFee;
            }
        } catch {}
    }
    
    function fulfillIntent(
        uint256 intentSeed,
        uint256 releaseAmountSeed
    ) public {
        if (activeIntents.length == 0) return;
        bytes32 intentHash = activeIntents[intentSeed % activeIntents.length];
        
        if (!ghostIntentExists[intentHash]) return;
        
        // Get intent details
        IOrchestrator.Intent memory intent = orchestrator.getIntent(intentHash);
        
        // Bound release amount (can be less than intent amount)
        uint256 releaseAmount = bound(
            releaseAmountSeed, 
            intent.amount / 2, 
            intent.amount
        );
        
        // Track balances before
        uint256 protocolBalanceBefore = token.balanceOf(protocolFeeRecipient);
        uint256 referrerBalanceBefore = intent.referrer != address(0) ? 
            token.balanceOf(intent.referrer) : 0;
        uint256 recipientBalanceBefore = token.balanceOf(intent.to);
        
        // Execute fulfillment
        try orchestrator.fulfillIntent(buildFulfillParams(intentHash, releaseAmount)) {
            // Calculate actual fees collected
            uint256 protocolFeesActual = token.balanceOf(protocolFeeRecipient) - protocolBalanceBefore;
            uint256 referrerFeesActual = intent.referrer != address(0) ?
                token.balanceOf(intent.referrer) - referrerBalanceBefore : 0;
            uint256 netReceived = token.balanceOf(intent.to) - recipientBalanceBefore;
            
            // Update ghost ledger
            ghostTotalFeesCollected += protocolFeesActual + referrerFeesActual;
            ghostProtocolFeesCollected += protocolFeesActual;
            ghostReferrerFeesCollected += referrerFeesActual;
            ghostUserNetReceived[intent.to] += netReceived;
            
            ghostIntentExists[intentHash] = false;
            ghostActiveIntentCount[intent.owner]--;
            ghostIntentsFulfilled++;
            
            removeFromActiveIntents(intentHash);
        } catch {}
    }
    
    function cancelIntent(uint256 intentSeed) public {
        if (activeIntents.length == 0) return;
        bytes32 intentHash = activeIntents[intentSeed % activeIntents.length];
        
        if (!ghostIntentExists[intentHash]) return;
        
        address owner = ghostIntentOwner[intentHash];
        
        vm.prank(owner);
        try orchestrator.cancelIntent(intentHash) {
            // Update ghost ledger
            ghostIntentExists[intentHash] = false;
            ghostActiveIntentCount[owner]--;
            ghostIntentsCancelled++;
            
            removeFromActiveIntents(intentHash);
        } catch {}
    }
    
    function releaseFundsToPayer(uint256 intentSeed) public {
        if (activeIntents.length == 0) return;
        bytes32 intentHash = activeIntents[intentSeed % activeIntents.length];
        
        if (!ghostIntentExists[intentHash]) return;
        
        IOrchestrator.Intent memory intent = orchestrator.getIntent(intentHash);
        IEscrow.Deposit memory deposit = escrow.getDeposit(intent.depositId);
        
        // Track balances before
        uint256 recipientBalanceBefore = token.balanceOf(intent.to);
        
        vm.prank(deposit.depositor);
        try orchestrator.releaseFundsToPayer(intentHash) {
            uint256 netReceived = token.balanceOf(intent.to) - recipientBalanceBefore;
            
            // Update ghost ledger
            ghostUserNetReceived[intent.to] += netReceived;
            ghostIntentExists[intentHash] = false;
            ghostActiveIntentCount[intent.owner]--;
            ghostIntentsReleased++;
            
            removeFromActiveIntents(intentHash);
        } catch {}
    }
    
    function updateProtocolFee(uint256 newFee) public {
        newFee = bound(newFee, 0, MAX_PROTOCOL_FEE);
        
        vm.prank(owner);
        try orchestrator.setProtocolFee(newFee) {
            if (newFee > ghostMaxProtocolFeeSeen) {
                ghostMaxProtocolFeeSeen = newFee;
            }
        } catch {}
    }
}
```

---

## Ghost Ledger Design

The ghost ledger tracks **observable effects** without reimplementing contract logic:

### Token Flow Tracking
```solidity
// Track all token movements
ghostTotalIn: Total tokens entering orchestrator
ghostTotalOut: Total tokens leaving orchestrator
ghostFeesCollected: Total fees taken
ghostNetDistributed: Total sent to users

// Invariant: Conservation
ghostTotalIn == ghostTotalOut + orchestratorBalance
```

### Intent State Tracking
```solidity
// Track intent lifecycle
ghostIntentsCreated: Total intents signaled
ghostIntentsFulfilled: Successfully completed
ghostIntentsCancelled: Cancelled by owner
ghostIntentsExpired: Pruned after expiry

// Invariant: Lifecycle consistency
ghostIntentsCreated == ghostIntentsFulfilled + ghostIntentsCancelled + 
                       ghostIntentsExpired + activeIntents.length
```

### Fee Tracking
```solidity
// Track fee accumulation
ghostProtocolFeesCollected: Total protocol fees
ghostReferrerFeesCollected: Total referrer fees

// Invariant: Fee bounds
ghostTotalFeesCollected <= ghostTotalIn * 0.1 (10% max)
```

---

## Property-Based Test Examples

### Monotonicity Properties

```solidity
function testFuzz_FeeMonotonicity(uint256 amount1, uint256 amount2, uint256 feeRate) public {
    vm.assume(amount1 < amount2);
    vm.assume(feeRate > 0 && feeRate <= MAX_PROTOCOL_FEE);
    
    uint256 fee1 = calculateFee(amount1, feeRate);
    uint256 fee2 = calculateFee(amount2, feeRate);
    
    // Property: Larger amounts produce larger fees
    assertGe(fee2, fee1, "Fee monotonicity violated");
}
```

### Commutativity Properties

```solidity
function testFuzz_FeeCommutativity(uint256 protocolFee, uint256 referrerFee, uint256 amount) public {
    // Calculate fees in different orders
    uint256 protocolFirst = calculateProtocolFee(amount, protocolFee);
    uint256 referrerSecond = calculateReferrerFee(amount - protocolFirst, referrerFee);
    uint256 total1 = protocolFirst + referrerSecond;
    
    uint256 referrerFirst = calculateReferrerFee(amount, referrerFee);
    uint256 protocolSecond = calculateProtocolFee(amount - referrerFirst, protocolFee);
    uint256 total2 = referrerFirst + protocolSecond;
    
    // Property: Fee order shouldn't matter for total
    assertApproxEqAbs(total1, total2, 2, "Fee calculation not commutative");
}
```

### Idempotency Properties

```solidity
function testFuzz_CancelIdempotency(bytes32 intentHash) public {
    // First cancellation
    vm.prank(intentOwner);
    orchestrator.cancelIntent(intentHash);
    
    // Second cancellation should fail cleanly
    vm.prank(intentOwner);
    vm.expectRevert();
    orchestrator.cancelIntent(intentHash);
    
    // Property: Multiple cancels don't corrupt state
    assertEq(orchestrator.getIntent(intentHash).owner, address(0));
}
```

---

## Implementation Roadmap

### Phase 1: Core Invariants (Week 1)
- [ ] Implement OrchestratorHandler contract
- [ ] Set up ghost ledger tracking
- [ ] Write token conservation invariant
- [ ] Write fee bounds invariant
- [ ] Write intent consistency invariant

### Phase 2: Critical Path Testing (Week 2)
- [ ] Fee calculation fuzz tests
- [ ] Intent lifecycle fuzz tests
- [ ] Access control boundary tests
- [ ] Registry integration tests
- [ ] Pause mechanism tests

### Phase 3: Stateful Fuzzing (Week 3)
- [ ] Handler-based operation sequences
- [ ] Multi-actor scenarios
- [ ] Time-based expiration testing
- [ ] Gas optimization profiling
- [ ] Edge case exploration

### Phase 4: Economic Attack Vectors (Week 4)
- [ ] Griefing resistance tests
- [ ] MEV vulnerability analysis
- [ ] Fee manipulation attempts
- [ ] Reentrancy attack simulations
- [ ] Front-running scenarios

### Phase 5: Integration Testing (Week 5)
- [ ] Orchestrator-Escrow interaction invariants
- [ ] Multi-verifier scenarios
- [ ] Post-intent hook testing
- [ ] Full protocol flow testing
- [ ] Upgrade path validation

---

## Test Configuration

### Foundry Configuration
```toml
[profile.orchestrator]
fuzz_runs = 1000
max_test_rejects = 100000
dictionary_weight = 40

[invariant]
runs = 500
depth = 20
fail_on_revert = false
call_override = true
```

### Coverage Targets
- Line Coverage: > 95%
- Branch Coverage: > 90%
- Function Coverage: 100%
- Invariant Violations: 0

---

## Risk Matrix

| Component | Risk Level | Testing Priority | Potential Impact |
|-----------|------------|------------------|------------------|
| Fee Calculations | CRITICAL | P0 | Direct fund loss |
| Intent Hash Generation | CRITICAL | P0 | Double spending |
| Token Transfers | CRITICAL | P0 | Fund loss/lock |
| Access Control | HIGH | P1 | Unauthorized access |
| Registry Validation | HIGH | P1 | Malicious contracts |
| Intent Lifecycle | HIGH | P1 | State corruption |
| Pause Mechanism | MEDIUM | P2 | Emergency response |
| Event Emission | LOW | P3 | Off-chain tracking |

---

## Success Criteria

1. **No Critical Invariant Violations** after 10,000+ fuzz runs
2. **All Fee Calculations** accurate within 1 wei precision
3. **Intent Lifecycle** maintains consistency across all paths
4. **Access Control** properly enforced in all scenarios
5. **Gas Usage** remains under 500k for all operations
6. **No Reentrancy** vulnerabilities found
7. **Economic Attacks** successfully mitigated

---

## Notes and Considerations

### Key Testing Principles
1. **Never reimplement logic** - Use ghost ledgers and observable effects
2. **Test properties, not implementations** - Focus on what must be true
3. **Bound inputs realistically** - Keep tests meaningful
4. **Track everything** - Comprehensive ghost ledger catches subtle bugs
5. **Cross-reference state** - Verify consistency across contracts

### Common Pitfalls to Avoid
1. Testing implementation details instead of outcomes
2. Unbounded fuzzing leading to unrealistic scenarios
3. Missing cross-contract invariants
4. Inadequate gas profiling
5. Incomplete state cleanup verification

### Areas Requiring Special Attention
1. **Intent Hash Uniqueness** - Critical for preventing collisions
2. **Fee Precision** - Rounding errors can compound
3. **Reentrancy Protection** - Post-intent hooks are external calls
4. **Registry Updates** - Must handle mid-operation updates gracefully
5. **Pause State** - Ensure proper function availability

---

## Conclusion

The Orchestrator contract's central role in the protocol demands comprehensive testing focused on:
1. Financial integrity through invariant testing
2. State consistency through property-based testing
3. Security through boundary and access control testing
4. Economic resilience through attack simulation

The handler-based approach with ghost ledgers provides a robust framework for discovering edge cases without reimplementing contract logic, ensuring the protocol's safety and reliability.