# BLSH retrospective tool: reconciliation independent of forecasting

> Updated after the independent re-review of explanation v3. Case values and wording follow `dry-run-v3/DRY-RUN-REPORT.md`. The baseline-missingness finding is unchanged. The 134 "No personal history" notes in arm B now correctly say a history exists but was not usable. The 4 "rate-change" flips are reference-composition changes, not shown performance changes.

**Status: review and policy options. Nothing implemented or changed. The frozen score, the complete-window rule and all earlier outputs are untouched. No threshold is set.**

The retrospective BLSH tool answers one question: did recent production run above or below what the player's own reference and current support imply? It can be useful and honest **without** any forecast result, provided its labels say what it is and what it is not.

## 1. What the corrected cases establish (dry run v2, A overlay)

| Case | Observed | Retrospective reading allowed |
|---|---|---|
| Kovacevic +66.9 | FP 2.5 vs 9.15; process up (+2.43) | Production below what his reference and improved process imply. |
| Hyman +65.4 | reference gap +9.70, process −0.345; shots/60 down | Production below reference. The observed shot drop is a caution to show, not part of the score. |
| McDavid −75.9 | G+A 16 vs 8.98; TOI up and already in the expected value | Production above reference at his current ice time. PP share and linemates are not modelled. |
| Coronato −70.4 | 35-game reference; TOI 12.7 → 17.4 | Above reference. A role change is plausible and is shown, not explained away. |
| Doughty, conflicting | reference and support signs disagree | Withheld from lists (correct). |
| Landeskog (cohort) | no 2022-24 history | Provisional; the label must be visible. |
| Dowling, zero shots | 2-game personal reference, labelled "measured" | Scoreable (correct). The tier label overstates the evidence. |
| Lyubushkin, 1 game | +42.6 | Large value on minimal evidence. |
| Mangiapane, 2 games over 26 days | TOI 7.1 vs 16.1 | Sparse, stale-window and role-change evidence. |
| Tavares, unavailable | 4 of 5 games qualified | Complete-window rule (unchanged). |

## 2. Baseline-missingness issue (from dry run v2)

Arm B adds early-2026 games to the reference. Most of the differences it creates come from evidence availability:
- **Without the overlay**, one early-2026 game with null Game Score fields voids the whole 50-game personal history. That accounts for 19 of 27 sign flips.
- **With the overlay:**
  - 26 of 40 flips come from early-2026 games without NST rows, which make the reference process rates unavailable;
  - 10 are players with no 2022-24 history who gain a personal reference from early-2026 games;
  - only 4 have the same evidence modes. Those 4 are near-zero scores whose reference composition changed (2–7 early-2026 games replaced older ones); they do not show changed ability.

So A versus B is mainly a choice about **missing data**, not about how much recent performance should count.

## 3. Options (decision needed; not implemented)

**Baseline policy:**

| Option | What it means | Cost |
|---|---|---|
| R1 Keep A (2022-24 only) for now | No missingness from early-2026 games. The reference is about 2.5 years old and labelled stale and provisional. | Ignores real 2026 changes until the reserved season is evaluated and released. |
| R2 B as is | Uses recent games. | Evidence loss from early-2026 gaps changes signs. Not recommended. |
| R3 A new "complete-games reference" estimator | Builds H from the last 50 games **that have complete data**, recording skipped games. | A different estimator from frozen v1. It needs its own written method, tests, a comparison with v1 on matched-evidence cases, and a review. It must not be a silent edit. |

**Recommendation:** R1 now, with R3 as a separately documented and tested candidate, decided on matched-evidence cases rather than on how the lists look.

**Labelling** (needed whatever the baseline policy):
- Show personal-reference games, window games, window span and the evidence tier next to every score.
- Reword the tier so "measured personal reference" with 1–2 personal games is not presented as strong. This is a display or label change, not a score change; any rule change needs its own method.

**List membership:** the lists currently hold 85–87% of scored players. Membership should eventually depend on **evidence quantity**, such as window games and personal-reference games, defined by a separately documented method and checked on cases. It must never depend on a cutoff chosen to reach a list size. Until then, keep the full lists and visible evidence labels, and do not call them evidence lists.

## 4. Acceptance for an honestly labelled retrospective tool, without forecasting

1. Every score shows: actual versus expected per track; components that add back exactly; tier; personal games; window games and span; coverage reasons; stale-reference age.
2. Explanations pass the v3.1 integrity checks on real windows. The independent re-review found no blockers, and its should-fix items are fixed or recorded (`EXPLANATION-REVIEW.md`). Codex's own re-review is still pending.
3. The wording is fixed: "production above or below reference given current support". Never luck, value, a forecast or a trade recommendation.
4. The baseline policy and any list-membership rule are decided on cases and documented, with their limits.
5. The forecast comparison (`FORECAST-PROPOSAL-v2.md`) can add or withhold a forward claim. It is not a gate for items 1–4.
