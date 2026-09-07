# Sponsored stake: 14-day fee model and implementation review

Status: economic model implemented; sponsorship runtime design proposed.
No sponsor fee, contract deployment, referral reassignment, or customer pricing
change is activated by this work.

## Recommendation

Price sponsorship independently of referral acquisition. Use **80 bps (0.80%)
of gross sponsored settled volume** as the initial pricing hypothesis for a
14-day, fully collateralized position. This is a modeled pilot price, not an
empirically calibrated risk premium or a guaranteed return. It depends on 75%
capital utilization, a 12% simple annual net-return target, 10 bps expected
principal losses per settled dollar, and 5 bps operating costs per settled
dollar. The exact minimum whole-bp fee under those assumptions is 77 bps.

Matching the repository's 40 bps L1 default yields only 4.89% net annualized
under those same assumptions. Referral rates are configurable and budget
clamped; 40/10 bps are source defaults, not verified live rates. The 80 bps
hypothesis must be repriced or rejected if observed losses, utilization,
release delays, or the available fee budget do not support it.

## What the existing implementation actually does

Reviewed contracts main `2e70f3c` and Curator main `69f01365`, plus Pay main
`57468099` and its merchant staking design. These are source snapshots, not a
live deployment audit.

| Fact | Source |
| --- | --- |
| Referral rewards follow the **seller's** referral chain, with at most two levels | [Curator makerReferralChain.ts](https://github.com/zkp2p/curator/blob/69f01365/src/services/makerReferralChain.ts) |
| Default ladder is L1 40 bps / L2 10 bps | [Curator envConfig.ts](https://github.com/zkp2p/curator/blob/69f01365/src/common/utils/envConfig.ts) |
| Existing referrals draw from the service-fee budget in L1, L2, Peer order | [Curator serviceFee.ts](https://github.com/zkp2p/curator/blob/69f01365/src/common/utils/serviceFee.ts) |
| The **taker** selects an authorized stake owner; sponsor retains custody rights | [StakeVault.sol](../../contracts/StakeVault.sol) |
| Signal locks the full intent amount; settlement resizes to full gross release amount | [DisputeProtectionPolicy.sol](../../contracts/hooks/DisputeProtectionPolicy.sol) |
| Lock maturity is settlement time plus the snapshotted risk window | [DisputeProtectionPolicy.sol](../../contracts/hooks/DisputeProtectionPolicy.sol) |
| An explicit release transaction is required; exposure continues until release executes | [IDisputeProtectionPolicy.sol](../../contracts/interfaces/IDisputeProtectionPolicy.sol) |
| Referral fee recipients and rates are stored at signal, paid on settlement | [OrchestratorV3.sol](../../contracts/OrchestratorV3.sol) |
| Pay's staking rollout exposes self-staking, while an externally selected owner makes the page read-only | [Pay staking design, section 3.2](https://github.com/zkp2p/pay/blob/57468099/docs/superpowers/specs/2026-08-20-merchant-staking-chargebacks-design.md) |

Cash App's dispute window was retired in the current contracts source and
recorded deployment lanes. Do not carry the older Pay design's three-rail
assumption into sponsor eligibility. Resolve the exact policy and nonzero
payment-method window when building a sponsored quote.

## Review of the conversation's initial plan

1. **Seller and taker were conflated.** If Aaron provides liquidity as a seller,
   staking on his behalf does not currently back his seller fills. Existing
   collateral compensates that seller for a dispute against a taker. A
   seller-sponsorship product needs a separately defined obligation before its
   payouts can be implemented. The runtime design below assumes Aaron is a
   taker/merchant using someone else's collateral; that scope is unconfirmed.
2. **L1 is not an available sponsor slot.** Keep the existing seller referral
   relationship and L2 attribution. Sponsor compensation is another economic
   role. If the same wallet performs both roles it may receive both allocations,
   within the agreed total fee, without changing the referral tree.
3. **Fourteen days is a minimum after settlement.** Pending intents already tie
   up capital. Settlement delays, failed/cancelled reservations, delayed release
   transactions, and idle capital lower realized returns. Exiting does not
   erase outstanding exposure or earned fees.
4. **The fee needs a payer.** Adding a recipient to the settlement array alone
   reduces the taker's payout. Preserving advertised output requires grossing up
   the quote or reallocating an explicitly sufficient existing fee budget.
5. **Quote-only enforcement is insufficient.** Current vault delegation does
   not require a sponsor fee or cap each taker's use of a shared sponsor pool.
   A caller able to signal directly could consume collateral without paying the
   expected fee. Fee consent, recipient, amount, and exposure limits need atomic
   on-chain enforcement before lock creation.

## Reproducible model

Run from the contracts repository with Node; no credentials, dependencies,
network calls, or chain transactions are needed:

```sh
node scripts/model-sponsor-fees.mjs scripts/fixtures/sponsor-fees.json
node --test scripts/model-sponsor-fees.spec.mjs
```

Copy the JSON fixture and edit the assumptions to price another scenario. All
inputs are required integers; rate inputs use basis points (10,000 = 100%).
Unknown inputs are rejected so a misspelled assumption cannot silently leave
the model unchanged. The output includes its inputs, dollar cashflows, simple
annualized returns, minimum whole-bp fee, and fee-budget shortfall.

Let:

- `C` = average total sponsor capital, including idle capital;
- `u` = fraction allocated to the modeled successful position lifecycle;
- `D` = 14-day risk window plus average additional holding days;
- `f`, `l`, `o` = sponsor fee, principal loss, and operating cost per settled dollar;
- `r` = target simple annual net return on all sponsor capital.

The model assumes 100% gross collateral and stable capital, utilization, and
transaction flow:

```text
annual settled volume = C × u × 365 / D
annual net income    = annual settled volume × (f - l - o)
net APR              = (f - l - o) × u × 365 / D
required fee         = r × D / (365 × u) + l + o
```

The implementation rounds the required rate upward to whole bps using integer
arithmetic. Displayed returns use ordinary numerical approximation; this is an
offline pricing model, never transaction amount or quote arithmetic. Zero
utilization yields zero income and no volume-based fee recommendation.

`additionalHoldDays` represents pending and release delay for successful
positions. `utilizationBps` discounts idle capital and capital consumed by
cancelled or unproductive reservations. Do not also count the same pending or
release delay in both inputs. Losses are value-weighted, net of actual
recoveries, divided by gross eligible settled volume; a dispute count alone is
not a loss rate. Operating costs are averaged per settled dollar, including
failed/reservation/release work. Fixed overhead should be converted at the
modeled volume; at zero volume this calculator shows zero variable costs and
does not estimate fixed operating losses.

This is a steady-state expectation, not a simulation of bankruptcy, correlated
fraud, liquidity shocks, compounding, or reinvestment. Losses must be replenished
to maintain the assumed capital and volume. A sponsor can lose the full
collateral backing a disputed trade; these illustrative loss inputs do not
establish that any taker is safe to sponsor.

## Sensitivities

Net simple annualized return, assuming a 14-day hold, 10 bps principal loss and
5 bps operating cost per settled dollar:

| Sponsor fee | 50% utilization | 75% utilization | 100% utilization |
| --- | ---: | ---: | ---: |
| 40 bps / 0.40% | 3.26% | 4.89% | 6.52% |
| 60 bps / 0.60% | 5.87% | 8.80% | 11.73% |
| 80 bps / 0.80% | 8.47% | 12.71% | 16.95% |
| 100 bps / 1.00% | 11.08% | 16.62% | 22.16% |

At the proposed 80 bps price:

| Scenario (other base inputs unchanged) | Minimum fee for 12% net APR | Net APR at 80 bps |
| --- | ---: | ---: |
| Base case | 77 bps | 12.71% |
| Two additional holding days | 86 bps | 11.12% |
| 50% utilization | 108 bps | 8.47% |
| 25 bps losses per settled dollar | 92 bps | 9.78% |
| 100 bps losses per settled dollar | 167 bps | -4.89% |

For $10,000 average capital at base assumptions, annual settled volume is
$195,535.71; sponsor fees $1,564.29; losses $195.54; operating costs $97.77;
net income $1,270.98. Monthly equivalents are $16,294.64 volume and $105.92
income on average, not a promise of monthly liquidity or payouts. Do not assume
that $10,000 collateral can repeatedly back $100,000 each month with a 14-day
full-principal lock.

The 80 bps price can tolerate only **13.63 bps losses** while still meeting the
12% target at the base utilization and cost assumptions. Its safety margin is
small; 80 bps should not become a universal rate for unknown takers.

## Funding and coexistence with referrals

Budget every role explicitly, without silently reducing an existing referral:

```text
service fee >= sponsor fee + L1 fee + L2 fee + minimum Peer remainder
150 bps    = 80 bps      + 40 bps + 10 bps + 20 bps
```

The 150 bps total and 20 bps Peer remainder are proposed inputs. Neither is
claimed to be current production configuration. A hypothetical 100 bps total
has a 50 bps shortfall against this proposal. It can fund only 30 bps of sponsor
fees while preserving 40/10/20, producing 2.93% modeled net annual return at
base utilization. Options are an explicitly accepted sponsored-route price,
an explicitly funded Peer subsidy, or declining to offer sponsorship at that
budget. Do not confiscate L1 or silently clip the sponsor's contracted rate.

An 80 bps sponsor receives $8 per $1,000 gross settled volume; L1 receives $4,
L2 receives $1, and Peer retains $2 in this example. Any separate orchestrator,
manager, integration, or bridge fees must also be included in the final quote.
The fixture models a full maker-referral chain, not every route's fee topology.

## Proposed runtime implementation, after scope is resolved

This section is a design, not an implemented or deployed feature. The open
product question is whether Aaron is a taker/merchant, as required by existing
dispute collateral, or a seller for whom a new collateral obligation is intended.

For the taker/merchant interpretation:

1. **Agreement.** Sponsor sets a rate, allowed payment methods, maximum risk
   window and outstanding exposure cap for one taker; taker explicitly accepts
   those exact terms. Sponsor custody stays in the vault. Paid sponsorship must
   be bound to that consent, not inferred from free delegation alone.
2. **Signal.** The authorized lifecycle path resolves the taker's effective
   owner, enforces consent and sponsor rate in the orchestrator's actual stored
   fee plan, and atomically checks/increments the exposure cap before locking
   principal. Reject a missing fee, insufficient budget, self-sponsorship
   rebate, stale terms or a substituted recipient. A sponsor can stop future
   admissions; previously signaled terms remain immutable.
3. **Quote.** Curator resolves the same agreement and eligible risk-bearing
   route, preserves seller attribution, validates the service-fee allocation,
   and prices the exact final output. An unavailable sponsor or unsupported
   policy/window is an explicit quote failure. Do not accept client overrides
   for the authoritative recipient or agreed rate. Free/whitelisted paths
   that create no sponsor exposure must not pay a sponsor fee.
4. **Settlement.** Pay the snapshotted sponsor fee on exact gross release using
   the existing referral-fee transport, with separately attributable sponsor
   metadata/events for reporting. Manual release has identical economics.
   There is no fee on cancelled intents. This proposal pays at settlement and
   leaves that fee earned if a later dispute occurs; its losses are modeled on
   full collateral, without clawing back already paid fees.
5. **Exposure release.** Cancellation releases pending exposure. Settlement
   adjusts exposure to gross release. Only successful collateral release or
   dispute resolution frees settled exposure capacity. Changing owner,
   revoking authorization or changing terms cannot move an existing lock or
   its liabilities to a new sponsor.
6. **Visibility.** Indexer and product surfaces separate sponsor earnings from
   L1/L2 earnings and show capital, remaining exposure capacity, observed
   utilization, losses, release delays and net returns. Quote/UI must disclose
   any incremental sponsorship cost before the taker accepts it.

The contract changes must enforce the fee and exposure obligations for direct
callers as well as Curator traffic. A Curator-only extra fee entry would not
satisfy this design. Existing locks cannot be migrated casually into a fresh
policy: preserve their original controller/lifecycle or drain them according
to the existing deployment conventions.

Runtime tests must prove: exact fee budget and net output; quote/signaling
agreement; direct-call fee omission rejected before locking; stale consent;
same-wallet referral/sponsor accounting; per-taker concurrent exposure caps;
self-sponsorship; whitelist/no-risk exclusions; partial settlement; cancellation;
manual release; dispute; maturity without release; sponsor switch/revocation;
and invariants for total stake, locked exposure, claims and fee conservation.

## PR scope and ownership

This PR implements the executable pricing model, scenario fixture, tests and
reviewed design. It leaves runtime sponsorship pending the seller/taker scope
decision. It does not change contract ABI, package versions, addresses,
production fee configuration, or existing referral attribution.

For runtime delivery, concrete owners are contracts (fee/consent/cap
enforcement), Curator (quote allocation and authenticated agreement), indexer
(exposure and earnings projections), and the selected client (consent and fee
display). Pay is a runtime owner if this is merchant sponsorship; ordinary
Peer buyers use clients/mobile instead. Package, API and deployment ordering
must follow the final changed interfaces; the calculator itself requires no
package release, migration, reindex or deployment.
