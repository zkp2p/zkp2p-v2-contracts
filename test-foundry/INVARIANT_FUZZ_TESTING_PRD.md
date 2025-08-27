# Product Requirements Document: Invariant and Fuzz Testing Framework

## 1. Executive Summary

### 1.1 Purpose
Implement a comprehensive property-based testing framework for the ZKP2P V2 protocol using Foundry's invariant and fuzz testing capabilities to ensure protocol security, financial integrity, and state consistency.

### 1.2 Scope
- Invariant testing for Escrow and Orchestrator contracts
- Critical path fuzz testing for mathematical properties
- Migration from scenario-based to property-based testing
- Ghost ledger implementation for state tracking

### 1.3 Goals
- Detect edge cases and vulnerabilities that unit tests miss
- Ensure no value creation or destruction in the protocol
- Validate mathematical properties and bounds
- Provide continuous validation of system invariants

## 2. Background

### 2.1 Current State
- Existing Hardhat tests focus on specific scenarios
- Limited edge case coverage
- No systematic invariant testing
- Manual test case creation prone to missing edge cases

### 2.2 Problem Statement
Traditional unit tests cannot exhaustively explore the state space of complex DeFi protocols. We need automated property-based testing to:
- Discover unexpected edge cases
- Validate system-wide invariants
- Test mathematical properties across all possible inputs
- Ensure protocol safety under adversarial conditions

## 3. Requirements

### 3.1 Functional Requirements

#### 3.1.1 Invariant Testing
- **Token Conservation**: Total tokens in system must remain constant
- **Fee Bounds**: Fees must never exceed configured maximums (5% + 5% = 10%)
- **State Consistency**: All state transitions must maintain consistency
- **Solvency**: Protocol must always be able to honor withdrawals
- **Uniqueness**: Intent hashes must be globally unique

#### 3.1.2 Property-Based Testing
- **Monotonicity**: Functions must be monotonic where expected
- **Commutativity**: Order-independent operations must yield same results
- **Bounds**: All values must respect defined limits
- **Conservation**: Input must equal output plus fees
- **Precision**: No unexpected precision loss in calculations

#### 3.1.3 Handler-Based Fuzzing
- Stateful testing with realistic operation sequences
- Bounded random inputs within meaningful ranges
- Multi-actor scenarios with different permissions
- Time-based testing for expiration logic
- Cross-contract interaction validation

### 3.2 Non-Functional Requirements

#### 3.2.1 Performance
- Invariant tests: 256+ runs minimum
- Fuzz tests: 1000+ runs minimum
- Test execution time < 5 minutes for CI/CD
- Memory efficient ghost ledger implementation

#### 3.2.2 Maintainability
- No reimplementation of contract logic
- Clear separation of concerns
- Comprehensive documentation
- Reusable test patterns and helpers

#### 3.2.3 Coverage
- Line coverage > 95%
- Branch coverage > 90%
- Function coverage: 100%
- Zero invariant violations

## 4. Technical Architecture

### 4.1 Ghost Ledger Pattern

```
┌─────────────────┐     Observable      ┌──────────────┐
│                 │     Effects          │              │
│  Contract       │◄──────────────────►  │  Ghost       │
│  Under Test     │                      │  Ledger      │
│                 │                      │              │
└─────────────────┘                      └──────────────┘
        │                                        │
        │                                        │
        ▼                                        ▼
┌─────────────────┐                     ┌──────────────┐
│  Actual State   │                     │  Expected    │
│                 │  ◄──── Compare ───► │  State       │
└─────────────────┘                     └──────────────┘
```

### 4.2 Testing Hierarchy

```
Level 1: Core Invariants (P0)
├── Token Conservation
├── Fee Bounds
├── State Consistency
├── Intent Uniqueness
└── Registry Consistency

Level 2: Critical Paths (P1)
├── Fee Calculations
├── Intent Lifecycle
├── Access Control
└── Registry Integration

Level 3: Edge Cases (P2)
├── Payment Method Management
├── Partial Withdrawals
├── Dust Amount Handling
└── Time-based Expiration

Level 4: Attack Vectors (P3)
├── Reentrancy Protection
├── Griefing Resistance
├── MEV Protection
└── Fee Manipulation
```

### 4.3 Handler Implementation

```solidity
Handler Contract
├── Ghost Ledger State
│   ├── Token Flow Tracking
│   ├── Intent State Tracking
│   └── Fee Accumulation
├── Bounded Operations
│   ├── createDeposit()
│   ├── signalIntent()
│   ├── fulfillIntent()
│   └── cancelIntent()
└── Invariant Checks
    ├── assertTokenConservation()
    ├── assertFeeBounds()
    └── assertStateConsistency()
```

## 5. Implementation Plan

### 5.1 Phase 1: Foundation (Week 1)
- [x] Set up Foundry testing framework
- [x] Create ghost ledger architecture
- [x] Implement basic handler contracts
- [x] Write core invariant tests

### 5.2 Phase 2: Critical Paths (Week 2)
- [x] Implement fee calculation tests
- [x] Add intent lifecycle tests
- [x] Create access control tests
- [x] Add registry integration tests

### 5.3 Phase 3: Edge Cases (Week 3)
- [x] Migrate unique tests from existing suite
- [x] Add payment method management tests
- [x] Implement dust handling tests
- [x] Add partial withdrawal tests

### 5.4 Phase 4: Optimization (Week 4)
- [ ] Performance profiling
- [ ] Gas optimization analysis
- [ ] Test suite optimization
- [ ] Documentation completion

## 6. Success Metrics

### 6.1 Quantitative Metrics
- **Invariant Violations**: 0
- **Test Coverage**: >95% line, >90% branch
- **Fuzz Runs**: >1000 per test
- **Unique Bugs Found**: Track and document
- **Gas Usage**: <500k per operation

### 6.2 Qualitative Metrics
- **Code Confidence**: High confidence in protocol safety
- **Maintainability**: Easy to add new invariants
- **Documentation**: Clear and comprehensive
- **Developer Experience**: Simple to understand and extend

## 7. Risk Analysis

### 7.1 Technical Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| False positives | Medium | Low | Careful invariant design |
| Test flakiness | High | Medium | Deterministic test setup |
| Performance issues | Medium | Medium | Optimize ghost ledger |
| Incomplete coverage | High | Low | Systematic test planning |

### 7.2 Implementation Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Scope creep | Medium | Medium | Clear requirements |
| Timeline delay | Medium | Low | Phased implementation |
| Knowledge gap | Low | Low | Documentation and training |

## 8. Deliverables

### 8.1 Code Deliverables
- [x] `EscrowInvariant.t.sol` - Escrow invariant tests
- [x] `OrchestratorInvariant.t.sol` - Orchestrator invariant tests
- [x] `EscrowCriticalPathFuzz.t.sol` - Escrow property tests
- [x] `OrchestratorCriticalPathFuzz.t.sol` - Orchestrator property tests

### 8.2 Documentation Deliverables
- [x] Testing strategy documentation
- [x] Ghost ledger pattern guide
- [x] Property-based testing guide
- [x] Migration strategy from Hardhat

### 8.3 Analysis Deliverables
- [x] Test coverage report
- [x] Invariant analysis report
- [x] Edge case discovery report
- [ ] Performance analysis report

## 9. Acceptance Criteria

### 9.1 Functional Acceptance
- All invariant tests pass with 256+ runs
- All fuzz tests pass with 1000+ runs
- No invariant violations detected
- All critical properties validated

### 9.2 Quality Acceptance
- Code follows established patterns
- Documentation is complete
- Tests are maintainable
- Performance meets requirements

### 9.3 Security Acceptance
- No value creation/destruction
- Fee bounds enforced
- Access control validated
- State consistency maintained

## 10. Future Enhancements

### 10.1 Short Term (1-2 months)
- Add differential testing against Hardhat tests
- Implement mutation testing
- Add formal verification hooks
- Enhance gas profiling

### 10.2 Medium Term (3-6 months)
- Integrate with CI/CD pipeline
- Add continuous fuzzing
- Implement symbolic execution
- Create test oracle system

### 10.3 Long Term (6+ months)
- Formal verification integration
- AI-assisted test generation
- Cross-chain testing framework
- Production monitoring integration

## 11. Appendix

### 11.1 Glossary
- **Ghost Ledger**: Parallel accounting system for verification
- **Invariant**: Property that must always hold
- **Property-Based Testing**: Testing relationships rather than values
- **Handler**: Contract that performs bounded random operations
- **Fuzz Testing**: Automated testing with random inputs

### 11.2 References
- [Foundry Book - Invariant Testing](https://book.getfoundry.sh/forge/invariant-testing)
- [Property-Based Testing with Foundry](https://www.paradigm.xyz/2021/12/property-based-testing)
- [Ghost Ledger Pattern](https://github.com/foundry-rs/foundry/discussions/ghost-ledger)
- [ZKP2P V2 Protocol Documentation](../contracts/CLAUDE.md)

### 11.3 Change Log
| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024-12-27 | 1.0.0 | Initial PRD | Team |

---

*This PRD represents the comprehensive testing framework for the ZKP2P V2 protocol, ensuring security, reliability, and maintainability through systematic property-based testing.*