# Checkpoint: execute the actual pure app functions

Later checkpoint: `exposure-writer-roundtrip.md` additionally executes actual deriveOutputs and compaction under explicitly scoped inert mocks. “Still unexecuted” below records this earlier checkpoint's boundary, not the latest aggregate status.

2026-10-20 UTC. Extends `exposure-deep.md`; no recommendation to change the model. The previous Python experiment was a modeled slice. This checkpoint closes a narrower gap by importing unchanged repository exports and executing them on synthetic inputs.

## Reproduction and safety

Run `bash /workspace/shared/fhfh-research-2026-10-20/run_exposure_actual.sh`.

- Explicit Node **22.11.0**, existing ts-node transpile-only loader, no dependency installation, app-source rewriting or extracted-function substitutions.
- Empty inherited environment. A preload blocks sockets/TLS/HTTP/fetch/DNS/UDP and provider-client creation; dotenv imports are prohibited. A deliberate socket guard self-test succeeds before the app imports.
- Only synthetic fixtures; no history, protected labels, environment files, service requests or provider configuration.
- **PASS: 12 synthetic app-executed checks.** Seventeen transitive app modules loaded, all source hashes retained in `exposure-actual-results.json`. No app network, client-creation or dotenv-load attempt occurred. No repository edits or app patches.
- The first harness run failed only because an assertion compared floating-point `0.30000000000000004` to literal `0.3` with strict equality. It was corrected to a 1e-10 arithmetic tolerance; the full harness then passed. No forecast formula changed.

Artifacts: `exposure_actual_harness.cjs`, `exposure_offline_guard.cjs`, `run_exposure_actual.sh`, `exposure-actual-results.json`, and `exposure-actual-run.txt`.

## Now app-executed, not copied formulas

1. **Paired exposure and missing slots.** Actual `resolvePer60Components` → `updateRatioRollingAccumulator` → snapshot/component exports process six synthetic appearances. An older 10-shot/20-minute game precedes one known one-shot/20-minute game and four missing-count/known-TOI games. The actual recent-five rate is 3/60, with numerator **1**, denominator **1,200 seconds**, and **one valid component observation**. The older known observation is not backfilled. Those five fixture rows contain 6,000 total TOI seconds, but only 1,200 rate-supported seconds.

2. **Zero versus missing.** Five zero-shot/20-minute games produce actual rate 0 with 6,000 paired seconds and five supported observations. Five missing-count games produce null rate with zero supported seconds/observations. The low-level normalizer can coerce an explicitly supplied null numerator to zero when a denominator exists, but the actual per-60 resolver returns null instead of constructing that invalid pair. Testing the resolver-plus-aggregator composition matters.

3. **Reconstructed evidence.** Five missing-raw-count fixtures with supplied 3/60 rate and 20 minutes each produce five reconstructed numerator equivalents over 6,000 seconds. This confirms a usable rate does not imply raw counts are present. Any new evidence contract must label reconstruction, not quietly call every numerator an observed integer count.

4. **Independent simple support.** Actual public historical-average accumulators give raw-shot sum 11 across two known observations and TOI sum 7,200 across six observations. Separate scalar sums/counts cannot prove common support. This executes the historical helper, not the private rolling writer's update or its database path.

5. **Shared EV/PP weight.** Actual `computeSkaterSampleShrinkageAdjustments` keeps PP fixed at one shot/300 seconds. As only EV history increases 1→80→800 games, the current weight is **0.3887→0.6908→0.7710**. Supplying cumulative EV TOI yields **0.3887→0.9029→0.9880**. Null versus zero shot inputs give identical complete helper outputs. The stage's use of this shared weight for PP forecasts remains code-traced, not stage-executed here.

6. **Effective bootstrap.** Actual `blendSeasonBootstrap`, tested by changing organic HIT from 10 to 20, gives effective organic sensitivity **0.116279/0.454545/0.714286** at one/five/ten current-season appearances when previous HIT exists and fantasy input is empty. At five games, disclosure still reports nominal history/fantasy weights 0.30/0.45 despite no fantasy category contributing. With previous HIT missing, sensitivity is **1.0**, including the zero-positive-weight fallback at zero current games. With both priors present, sensitivity is the nominal n/20. At the same five-game origin, HITS with prior history and BLOCKED_SHOTS without it receive different effective weights.

7. **H/B overlap arithmetic.** Actual `computeSkaterPhysicalEventRates` reproduces the prior example: HIT rate **9.1142857/60**, recent weight 20/140, for 10 historical events/100 minutes concentrated in the last 20 minutes. This confirms the existing explicit recency blend; it does not establish a static Bayesian posterior or validate the policy empirically.

## Still unexecuted and next prerequisite

The private rolling simple accumulator/`deriveOutputs`, writer history filtering, selected sidecar readback, stage caller, deployment/role/availability logic, PP allocation, team reconciliation, actual bootstrap source-loading and final forecast assembly were **not executed**. Generic recent TOI in this harness is a transparent fixture sum, not a writer result. Gamma-Poisson references and workload-risk reversals remain the separately labeled Python model.

Do not import the full writer casually: it loads dotenv and initializes a provider client. The next bounded slice is a network-inert writer/reader contract fixture using the existing test seam and injected fake sources, with no real credentials or database access. Scope that slice before execution; this checkpoint did not run it. It should prove that emitted rate-support numerator, denominator, source/reconstruction status and window identity survive compaction/sidecar selection before anyone changes F3's caller. If that seam cannot expose matched support, document the exact missing field rather than substituting generic cumulative TOI.

Suggested task-list checkpoint: “Actual pure functions verified: missing-slot ratio support, shared EV/PP weight, effective bootstrap renormalization and H/B blend. F3 remains a target-specific support/estimand task; next prove offline writer-to-reader support round trip. No predictive or release qualification follows.”
