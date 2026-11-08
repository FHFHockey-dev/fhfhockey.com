# Decisions for TJ: FORGE forecast qualification (2026-10-25)

Six decisions, each with a recommendation and why. The evidence is in [QUALIFICATION-PLAN.md](QUALIFICATION-PLAN.md) and [GAPS.md](GAPS.md). None of these authorizes production reads, code changes or releases by itself.

## D1. Release C Oct 23–30 block: exact rules

I couldn't find the exact boundaries or reveal rules anywhere local. The testing-grounds PRD (`tasks/TASKS/prd-forge-testing-grounds.md:225`) lists them as an open question.

- **Recommended:** for this qualification, treat Oct 23–30 as fully sealed. That means no issued-row, readback or outcome reads for those dates, and no use of them to choose a target, threshold or method. Qualification slates start on the first slate after Oct 30 *and* after D2–D4 are frozen.
- **Alternative:** point me to the existing rule document, and the checker's sealed window and reveal handling will follow it exactly.

## D2. First target and claim

- **Recommended:**
  - Target: skater `SHOTS_ON_GOAL`, unconditional expected value, h1, from released `captured_live` FORGE game revisions.
  - Claim: a Start Chart display claim, plus RSO `totals` and `comparison`.
  - RSO `assignment` and `conditionalTieBreak` stay denied until a later, separate review.
  - Why: one immutable issued row reaches both consumers through the same RPC and admission. SOG has the highest volume and settles cleanly. Start/sit (`assignment`) needs per-game ranking calibration, not only mean accuracy.
- **Alternatives:**
  - include `assignment` now: higher payoff, but it needs a ranking metric and more slates;
  - start with goalie `SAVES_GOALIE`: low volume, and it mixes start probability with workload.

## D3. What counts as "configuration" and "artifact" for the heuristic

The RSO binding needs two 64-hex hashes (`rsoUsePolicy.ts:63-64`). The heuristic has no fitted artifact.

- **Recommended:**
  - `configurationHash` = the canonical sha256 of the run's `modelEnvironment` (the 8 model and rollout env flags the replay already checks, `run-forge-projections.ts:399-403`, `:610-614`).
  - `artifactHash` = the sha256 of `{codeVersion, configurationHash}`, declared as "no fitted artifact; the code constants are the artifact".
  - The producer carries both into the revision payload, and `planning.ts:213` binds them.
  - It's small and honest: weights and priors are code constants already pinned by `codeVersion`.
- **Alternative:** hash the actual constant modules (`projection-weights.ts`, prior tables) into `artifactHash`. That's stronger against a constant changing without a sha change, but it means more producer code.

## D4. Claim thresholds and the evaluation / repeated-look protocol

All of this is predeclared in a hashed `scope.json` before the first capture.

**Population**
- Every skater row issued in admitted revisions on canary games, for slates after the block.
- Unconditional: a skater who doesn't dress counts with an actual of 0.
- Milestone (P3): **14 slates and ≥500 settled skater-games**. SOG will far exceed 500.

**Baselines**
- (a) The player's season-to-date shots per game at `cutoffAt`, times the issued participation probability.
- (b) The previous released FORGE code version, where its revisions exist for the same games. Otherwise (a) only.

**Metrics and thresholds (recommended)**
- **Bias:** |mean(predicted − actual)| ≤ 5% of mean actual.
- **Calibration slope:** actual regressed on predicted, between 0.85 and 1.15.
- **Accuracy:** non-inferior to baseline (a). The upper 95% bound of ΔMAE (FORGE − baseline) must be below +0.02 shots. Use a bootstrap clustered by player and game.
- **Integrity:** 100% of E1 rows must have positive readbacks in both consumers, with zero `identity_mismatch` and zero `readback_unissued`. Any integrity failure stops the claim, whatever the accuracy.

**Repeated looks**
- Two looks only: after slate 7 and after slate 14.
- Look 1 can only **stop for harm**: bias beyond ±15%, or a ΔMAE lower bound above 0. It never declares success early.
- Success is decided at look 2 only.
- No tuning between looks. Any producer change (a new `codeVersion` or hash) resets the clock and needs a new scope.

**Reporting:** failed literal gates are reported alongside any owner exception, never replaced by it (the Release B/C practice).

**Alternative:** a single look at slate 14 only. It's simpler, but it loses the early stop for harm.

## D5. Whether to add a review to `rsoUsePolicy` now

- **Recommended: no review now.** First extend `RsoTargetUseReview` with `prospectiveEvidenceRef` (the scope hash plus the final checker report hash) and `ownerApprovalRef`, matching the native contribution store's review (`contributionStore.ts:190-226`).
  - Add the single `SHOTS_ON_GOAL` totals + comparison review only after D4 passes.
  - Give it an `expiresAt` of at most 30 days, and an `inputCutoffFrom/Until` covering only the qualified code version's issuance window.
  - Why: a review added today would deny anyway (G1), and a review without evidence fields can't later be audited.
- **Alternative:** add the evidence fields now, and leave the review for after the evaluation. This is the same as the recommendation, minus the timing detail.

## D6. Native v2 participation after Oct 27, 04:00 UTC (time-bound, separate from this plan)

`FROZEN_PARTICIPATION_LAST_CUTOFF = 2026-10-27T04:00Z` (`nativeDailyPipelineV2.ts:29-30`). After that, `inputs-v2` stops with `rolling_first_issuance_not_approved` unless `rollingFirstIssuance` is approved.

- **Recommended:** let it stop, which fails closed, until a native qualification plan exists. This plan's first target doesn't depend on native issuance. Before Oct 27, confirm from a single Start Chart response's `forecastSource.kind` (part of R4, not an extra read) that production isn't serving `native`. If it is, decide this before Oct 27.
- **Alternative:** approve the rolling 14-day first issuance under its prepared plan. That keeps native rates and participation flowing, but extends unqualified native output.
