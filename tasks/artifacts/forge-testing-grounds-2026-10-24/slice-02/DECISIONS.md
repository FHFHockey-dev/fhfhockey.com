# Testing Grounds: decisions needed next

2026-10-24. Based on inspected local source and retained receipts only. Full remote workflow, TJ-only access, guided settings, immutable runs, honest work progress, no early outcomes, no automatic repair and preservation of Release C are already settled. They do not need another product decision.

## Execution and storage

**Recommendation: prove the existing bounded-step pattern first, in a separate Testing Grounds worker and store.** The repository already has database-backed jobs, conditional leases and a scheduled tick that runs one bounded step. Reuse that design and its lessons, not its production-maintenance queue or arbitrary route invocation. Keep immutable configuration/input references, operational progress and sealed results separate, with one accepted logical output per work-unit identity. A launched job must not rely on an open browser.

- **Option A:** a dedicated Testing Grounds queue/checkpoint/state store using the existing database platform, executed in bounded server-side steps. Small configuration and report JSON can remain in database records; large artifacts would need separately reviewed private object storage only if measured sizes require it. New tables/access policies and worker wiring need a coordinated schema/shared-file handoff. Existing deployed capacity and policies are unverified. Fitting must be bounded or resumable; the inspected route-runner tick's stated 240-second function limit is not proof a FORGE fit will fit.
- **Option B:** a dedicated durable worker with a separately selected provider, retaining the same logical job/store contracts. Use this only if measured fitting/runtime requirements make A unsuitable. Provider, credentials, availability, storage integration and operating ownership have not been chosen.

**Cost is unknown for both.** Existing infrastructure is not automatically free. We have no approved workload size, measured fitting duration/artifact volume, or current billing attribution. No purchase, provisioning or remote benchmark is needed just to implement local policy/contracts. The next engineering step is an offline synthetic fit/checkpoint feasibility proof. A real operating plan must later specify runtime, concurrency, retries, storage/retention and network bounds before activation; no budget number is invented here.

## Model controls: what actually exists

| Source capability | Verified existing behavior | Proposed additional work |
| --- | --- | --- |
| HIT/BLK prior minutes | Constants hits 50 / blocks 300, consumed in `calculators/skater-adjustments.ts` | Expose as validated candidate settings only through an approved adapter seam; experiment bounds are not established. |
| HIT/BLK recent shrinkage | Constants hits 240 / blocks 1000, actually used in recent weighting | Same; these are compiled values, not current dashboard controls. |
| Prior-season weight | Constant 0.5, used in weighted historical counts and minutes | Pin historical data/versions before making it tunable. |
| Role-history window | Default 10; `summarizeSkaterRoleContinuity` accepts a local `windowGames` argument, floors it and enforces at least 1 | This is a helper argument, not a verified end-to-end experiment parameter or approved upper bound. |
| Participation window | Explicit fixed 14 America/New_York calendar days before cutoff's local date | Existing versioned model rule; changing the window is a new candidate/method, not a control already verified by this task. |

**Recommendation:** first establish a narrow adapter for HIT/BLK shrinkage settings, preserving the current values as a pinned baseline. This is a candidate for the parent's scope decision, not permission to edit shared projection code. Do not expose hypothetical decay, feature switches or arbitrary ranges. Candidate names/notes/cloning can proceed independently, but guided numeric controls need their actual model seam and bounds.

## Simplest binary target and honest evidence

**Best existing explicit probability candidate: goalie official start.** `buildRollingWindowGoalieStartReceipt` in `web/lib/player-forecasts/rollingWindowParticipation.ts` already emits method `goalie-rolling-14d-start-frequency-v1`. It reuses an explicit starter-label kernel: official starts divided by selected eligible opportunities within the preceding 14 local calendar days, with at most 20 eligible games. The source requires complete opportunity/dated-eligibility evidence; unresolved appearances or starter labels withhold estimates. It retains the roster-continuation assumption and original source clocks. Source comments identify the rolling policy as previously approved; no new model family is required simply to adapt this existing head.

The nearest retained source test demonstrates appearance 2/3 versus official start 1/3, and withholds the start estimate for an unknown starter label. Those model tests were inspected, **not rerun** here. This proves a concrete existing implementation/test contract, not readiness of real data or an accepted Testing Grounds adapter. Calibration is expressly unavailable; uncalibrated explicit probability estimates can be evaluated, but cannot be described as already calibrated or confirmed starts. Baseline/candidate pairing, target-population agreement, exact version/data pins and as-of input admissibility still need verification for the pilot.

**Simplest separate ranking diagnostic:** expected goals ranked against the declared player-game label `goals >= 1`. ROC/AUC can evaluate that continuous score without inventing a goal probability. Label it rank-only; do not compute Brier, log loss or probability reliability from count means. It does not replace the probability-pilot gate. The goalie-start head is the stronger initial path toward satisfying that gate without a new shot-level or count-distribution model.

Statistical choices still to freeze: exact binary population/outcome rules and eligible denominator; PR summary convention (recommend explicitly named non-interpolated average precision); zero/one log-loss handling; reliability buckets; and a dependence-aware interval method appropriate to the eventual sample. Do not let a revealed result choose those settings. Until pilot size/dates are fixed, uncertainty parameters cannot be justified; individual player-game row resampling would ignore dependence. These are one coherent preregistered evaluation contract for parent review, not a list of new product requirements.

## Protected reveal rules already established

- Every new run's outcome-bearing results stay hidden while work is active. Blind holdouts remain sealed after completion until their preregistered reveal condition and outcome-availability rules are satisfied. APIs/logs/exports/artifacts obey the same rule. Owner identity alone is not reveal authorization.
- Release C remains protected; do not tune on or repurpose its October 23–30 evaluation period. Its retained release SHA is `d4c2632d39ee8a59fa683f44a0e1d21c55db66bd`. Existing consumer/model gates remain untouched.
- Retained F6 rules require verified first serving, a contiguous version-consistent window containing at least seven settled game-bearing days, complete independent population/finality/revision evidence and separate approval for a bounded read. Missing evidence means refused/diagnostic, not a successful reveal.
- **No exact October 30 automatic reveal is established by inspected evidence.** October 23–29 is tentative pending first-serving proof; “around October 30” is a target, not a guarantee. F6's future seven-SELECT budget is a proposal, not current permission. Its existing diagnostic thresholds are not dashboard release criteria.

Do not ask TJ to redefine protected rules. The release owner needs to supply the authoritative first-serving/settlement/reveal receipts before any connection to that protected evaluation. New Testing Grounds development can continue on synthetic September fixtures without those data.

## Only the next choices

1. **Technical direction:** endorse local feasibility work for Option A before considering a new runner/provider. This commits no spending or activation.
2. **First adapter scope:** agree the pinned HIT/BLK count baseline/candidate seam and the existing rolling official-starter head as the first probability-adapter validation target; coordinate exact shared files and parameter bounds before edits.
3. **Before real execution:** approve one complete experiment contract and its exact data/runtime/retention/budget/reveal bounds once the local adapters and feasibility evidence make that choice concrete. No real pilot is requested by this packet.

Actual owner identity configuration/activation comes later through the normal reviewed server integration. The local TJ-only policy is implemented in this slice and does not wait on a live ID.
