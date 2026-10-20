# RSO R7 + R8 design (for TJ approval; no code yet)

Author: Claude worker (Chef ticket from local_60e96358), 2026-10-20. Base: octoberBranch `e24b43712` plus uncommitted R5.
Scope: design only. Nothing below is implemented. Section 5 lists the wording that changes what the RSO tells a manager to do; it needs TJ's approval before any code.

Code references are octoberBranch working-tree lines, which may shift.

---

## 1. What exists today

### 1.1 Drop ordering: three different rules

| Surface | Where | Who is eligible | Order |
|---|---|---|---|
| Roster DROP chip | `lineupGaps.ts:48-53` | Active or bench, `canDrop === true`, not protected, not listed out (R3) | contribution (points mode: projected points; schedule: active games), nulls last → `holdValue` (nulls last) → id |
| Best Fit candidate swaps | `candidatePlanMetrics.ts:110-119` builds `dropOrder`, used by `planning.ts:1099` | Planner eligibility (not reserve-slotted, not out, droppable, not protected) | contribution, nulls last → id. No `holdValue`. |
| Full planner search | `planning.ts:1234` calls `extensions(...)` without `dropOrder` | Same as above | `holdValue ?? 0` (null counts as 0, i.e. lowest) → id |
| Equivalent final plans | `planning.ts:1195-1219` `orderStates` | Exact-equivalence groups (same objective, manifest, active games, outcome, goalie, …) | fewer adds → fewer drops → step-id string |
| Candidate plan pruning | `candidatePlanMetrics.ts:157-160` `dominates` | Same candidate, equal net AGP and points | `compareCandidatePlans` tie-break: no drop → fewer steps → **step-id string**. An equivalent plan that drops a 95%-owned player can survive while one dropping a 5%-owned player is pruned, depending only on ids. |

Ownership is never used in ranking.

### 1.2 Ownership data

- Loaded at `rosterScheduleData/planning.ts:219-244` from `yahoo_player_ownership_daily`. Only the most recent observation from the last 3 days is kept. Mapping must be unique (`yahoo_nhl_player_map_read`).
- `player.ownership` is set only when the value is finite, between 0 and 100, and observed within 3 days. A numeric `0` passes, which is correct under TJ's contract. Anything else stays `null`.
- **Gaps against the confirmed contract (0 = 0%, null/absent = unknown):**
  1. **No provenance.** `PlanningPlayer.ownership` is `number | null` (`planningTypes.ts:39`). The observation date, provider and fresh/stale status are thrown away. The evidence row keeps only the first row's `updated_at` (`planning.ts:243`).
  2. **Numeric strings become unknown.** `numberOrNull` (`planning.ts:39`) turns a numeric string into `null`. If PostgREST returns `ownership_pct` as a string for a `numeric` column, valid values, including 0, silently become unknown. This needs checking against the column type before implementation; it does not need a production call, the migration or generated types should show it.
  3. **Stale values become unknown.** An observation 3 or more days old is dropped to `null` rather than kept as a labelled last-known value.
  4. **Unknown displays as "—%".** The candidate detail panel renders `Ownership {number(ownership)}%` (`RosterScheduleOptimizer.tsx:1078`), so unknown shows as "Ownership —%". A valid 0 shows "Ownership 0%", which is correct.
  5. **Saved plans keep only the number.** `workspaceSchema.ts:31` stores `ownership` as a nullable number with no provenance. This file is `in-season/*`, the R6 worker's lane.

### 1.3 Category explanation

- **Alternatives:** `CategoryGains.tsx` already shows a whole-plan category comparison. It uses the planner's `categoryResults[].own`, computed in `planning.ts:767-771` through `categoryValue`. Ratio categories are recomputed from pooled numerator and denominator over the full lineup (`planning.ts:58-64`), which is what R8 requires. It requires the same manifest, comparison eligibility, legality and budget.
  - **Gap 1: no opponent, no deltas.** It requires `finite(after.opponent)`, so a league with no opponent scoreboard shows "Change unavailable" for every category, even though `own` before and after are known.
  - **Gap 2: no split into gains and sacrifices.** It shows net change only. It doesn't separate what the added player contributes from what dropped or displaced players lose.
- **Best Fit candidate cards:** `CandidateCard.tsx:79-81` shows Net AGP only in category leagues. `CandidateBrowser.tsx:137` says "Ranked by more starts. Check category gains before swapping." but the card offers no category gains to check. `CandidatePlan` (`candidatePlanMetrics.ts:6-15`) carries only `categoryComparisonVerified`, not the category vector.
- **Dropped players' losses:** `contributionLedger.ts` and `CandidatePlan.dropped` report lost points and active games only. There are no per-category lost stats.

---

## 2. R7: one shared retention-caution policy

### 2.1 Ownership observation (data shape)

```ts
type OwnershipObservation = {
  value: number | null;            // 0..100; 0 is valid 0%
  observedOn: string | null;       // provider observation date (league-local date string from the source)
  provider: "yahoo" | null;
  status: "fresh" | "stale" | "unknown";  // fresh: < 3 days; stale: last known, older; unknown: none or invalid
};
```

- **Where it lives:** an additive `PlanningPlayer.ownershipEvidence?: OwnershipObservation`. `ownership: number | null` keeps its current meaning: the fresh value or null. Existing consumers, including Start Chart and home-page displays, are unaffected.
- **Parsing:** one pure function, `parseOwnership(raw, observedOn, now)`, in `rosterScheduleData/planning.ts`.
  - Accepts a finite number, or a numeric string that matches `^\d+(\.\d+)?$`, between 0 and 100.
  - Absent, `null`, `""`, `NaN`, out-of-range values and future `observedOn` dates become `unknown`.
  - A missing refresh never overwrites a prior observation with 0.
- **Saved plans:** keeping provenance in saved plans needs a schema change in `in-season/workspaceSchema.ts` (R6 worker). Until it lands, saved plans keep only the number, and anything without evidence is treated as `unknown` provenance.

### 2.2 Policy module (new, pure): `rosterScheduleOptimizer/retention.ts`

```ts
export function dropEligible(player, snapshot, intent, owned, reserved): boolean
// canDrop === true && !protected && not reserve-slotted && !providerListsOut(player) (R3)

export function retentionCaution(player, now): { level: "high_demand" | "none" | "unknown"; ownership: OwnershipObservation }
// high_demand: status fresh and value >= HIGH_DEMAND_PCT (proposal: 50; TJ decision)
// unknown: no fresh value. Never "none", never "high_demand"

export function orderDropCandidates(players, contribution: (id) => number | null): PlanningPlayer[]
```

`orderDropCandidates` uses equivalence groups, not a pairwise fallback comparator. It is transitive by construction.

1. Group players by exact contribution metric: points mode uses projected points, schedule mode uses active games. Nulls form their own last group.
2. Within a group, if **every** member has a fresh, known ownership, order by ownership ascending (low demand is dropped first), then `holdValue` ascending with nulls last, then id.
3. If **any** member is unknown or stale, the group uses the ownership-free order: `holdValue` ascending with nulls last, then id. Unknown is never treated as low or as high.
4. Groups are emitted in contribution order (lowest first), so contribution always dominates and ownership only breaks exact ties.

**Why group-level and not per-pair:** a pairwise rule of "compare ownership when both are known, otherwise compare `holdValue`" is not transitive. With A at 5% and holdValue 9, B unknown and holdValue 5, and C at 95% and holdValue 1: A < C by ownership, C < B by holdValue (1 < 5), and B < A by holdValue (5 < 9), which is a cycle. Group-level fallback avoids that.

### 2.3 Consumers (one ordering everywhere)

| Consumer | Change |
|---|---|
| `lineupGaps.ts` DROP chip | Eligibility uses `dropEligible`. Order uses `orderDropCandidates`. `bestDrop` gains `caution` (from `retentionCaution`). |
| `candidatePlanMetrics.ts` `dropOrder` | Built from `orderDropCandidates` over the baseline ledger. This replaces the local sort, which currently ignores `holdValue`. |
| `planning.ts` `extensions` | Defaults to `orderDropCandidates` when no `dropOrder` is passed. The full search currently uses `holdValue ?? 0`, which treats unknown as lowest. The ordering affects which drops are generated first under the evaluation budget, never which plan wins. |
| `planning.ts` `orderStates` equivalence groups | After fewer adds and fewer drops, and before step-id order: if every plan in the group has a fresh known ownership for its dropped players, order by the highest dropped ownership, ascending. Otherwise keep the current order. Only plans that are exact equivalents (same objective values) are reordered, so dominance and objective values are untouched. |
| `candidatePlanMetrics.ts` `compareCandidatePlans` / `dominates` | Same tie-break, placed before step-id order, so an exactly equivalent plan that drops a lower-demand player is the one that survives pruning. `netAGP` and `netPoints` dominance is unchanged. |

Unchanged: objective values (no points penalty, no mapping from ownership to claim probability), manager protection, explicit manual choices, the fewer-moves preference, and category partial orders.

### 2.4 Caution display (shown separately from the objective)

- High-demand caution is shown on any DROP of a player with fresh ownership at or above the threshold. That includes players with zero remaining games this week; a low short-term contribution doesn't make him cheap to lose.
- Unknown ownership shows "Ownership unknown" and no caution. Stale ownership shows the last-known value with its date and a "last known" label, and gets no caution and no tie-break.
- Unknown ownership never excludes a candidate from the main optimisation.

### 2.5 Tests (to add at implementation)

- **5% vs 95% drops:** an exactly equivalent pair of legal plans dropping a 5% and a 95% player. The 5% plan is ordered first and survives candidate pruning. This holds under every permutation of player ids.
- **Parsing:** numeric 0, a valid nonzero value, `null`, omitted, `""`, `"abc"`, `-1`, `101`, the numeric string `"0"`, a stale 0, and a future date. Check what each parses to and what each displays.
- **Unknown in a tie:** a tied group containing an unknown member falls back to `holdValue` and id. Includes the three-player cycle fixture from 2.2.
- **Contribution still dominates:** a 95% player with a lower contribution is still ordered first.
- **Excluded players:** protected, listed out (R3) and reserve-slotted players are never offered, whatever their ownership.
- **Zero-game caution:** a 95% player with zero remaining games carries the high-demand caution.
- **Same order everywhere:** the DROP chip, the first `candidatePlanMetrics` drop and the first drop `extensions` generates are the same player.

---

## 3. R8: whole-swap category gains and sacrifices

Principle: reuse the planner's admitted values. No new projection math and no category blending.

### 3.1 Data (planning layer)

1. **`playerAssignedStats(snapshot, evaluation, playerId)`** in `planning.ts`, the stat-line sibling of `playerAssignedPoints` (`planning.ts:106-127`).
   - Sums `forecastInputs[].stats` over that player's rows in `evaluation.assignments`, only where use is allowed for `totals` and `comparison`.
   - Returns `{ stats, complete }`. Rows with no forecast, such as games already under way or locked players listed out, are skipped and noted, never counted as zero.
2. **`swapCategoryBreakdown(snapshot, baseline, plan)`** in `candidatePlanMetrics.ts`, or `categoryBreakdown.ts` if it gets long. Requires the same manifest and comparison eligibility on both, as `CategoryGains` does now. For each league category:
   - **Pooled before and after:** taken directly from `baseline.categoryResults[].own` and `plan.categoryResults[].own`, which the planner already computed with ratio categories pooled.
   - **Gain:** stats the added players contribute in the plan, from `playerAssignedStats`.
   - **Sacrifice:** stats lost from every player whose assigned rows shrink, meaning the dropped players plus any roster player displaced from a start. Each is that player's baseline stats minus their plan stats.
   - **Counting categories:** net equals gain minus sacrifice, which must reconcile with after minus before. The test asserts this.
   - **Ratio categories:** show pooled before and after, plus numerator and denominator component gains and sacrifices (for example, saves +14 / shots +15). Never a per-player percentage gain, and never added or subtracted percentages.
   - **Coverage:** `known` when every contributing row has an admitted forecast for the components. Otherwise `incomplete`, with the reasons from `recommendation.unresolved` / `exclusions`, such as a missing category head.
   - **Opponent:** shown only when an opponent scoreboard exists. Without one, the own-side deltas are still shown, and win/loss is "no opponent scoreboard".
   - **Goalies:** the goalie minimum status from `evaluation.goalie` (credited, projected, required, risk) is shown alongside the goalie categories, not merged into them.
3. **`CandidatePlan.categoryBreakdown?`:** filled in category mode inside `retain()`, after dominance. `baseline` and `evaluation` are already in hand there, so there is no extra evaluation.

### 3.2 Surfaces (component changes; files not owned by this worker)

- `CategoryGains.tsx`:
  - Drop the opponent requirement for own deltas.
  - Add Gain and Sacrifice columns, and the ratio component line.
  - Mark incomplete coverage.
- `CandidateCard.tsx`, category mode: a compact line per category, "Δ own (gain / sacrifice)", with incomplete rows marked.
- `CandidateBrowser.tsx:137`: the note now points to the card's gains (see section 5).
- Roster review: when the DROP chip shows a player, his own-contribution categories for the week appear in his row details (using `playerAssignedStats` on the baseline).

### 3.3 Tests (to add at implementation)

- **Same points, different categories:** two plans with equal projected points but different category vectors get distinct breakdowns, and neither changes rank.
- **Bench-conflicted specialist:** the added player is benched on conflict days, so gain counts only startable days.
- **Lost drop contribution:** the sacrifice equals the dropped player's baseline assigned stats.
- **Displaced starter:** a roster player who loses a start appears in the sacrifice.
- **Custom scoring:** a category with a multiplier, and a ratio with a non-standard numerator and denominator.
- **Missing heads:** marked `incomplete` with its reason; no zero-filling.
- **Goalie ratio from pooled components:** for example, save percentage moving 0.910 → 0.912 is shown with saves and shots component deltas, and the goalie minimum status is shown.
- **No opponent scoreboard:** own deltas are shown and win/loss reads "no opponent scoreboard".
- **Totals reconcile:** for every counting category, gain minus sacrifice equals after minus before.
- **Same values as the planner:** the breakdown before and after values are identical to the planner's `categoryResults[].own`.

---

## 4. Ownership of files and dependencies

- **This worker** (`rosterScheduleOptimizer/**`, `rosterScheduleData/planning.ts`): `retention.ts`, the `lineupGaps` / `candidatePlanMetrics` / `planning` changes, `parseOwnership` with provenance in `planning.ts`, `playerAssignedStats`, and the breakdown.
- **Needs Chef assignment:** `components/RosterScheduleOptimizer/*` (CandidateCard, CandidateBrowser, CategoryGains, RosterPlayerRow, and the detail panel in RosterScheduleOptimizer.tsx), and `in-season/workspaceSchema.ts` for persisting provenance (R6 worker).
- **Contract scope:** TJ's 0-vs-unknown contract also names Start Chart ownership filters and home-page TransactionTrends. Those are outside RSO. This design doesn't touch them, but `parseOwnership` should be the helper they reuse.
- **Depends on:** R1–R3 (shipped), R5 (this ticket), and G1/F6 for qualified category heads. Without those heads, R8 shows "incomplete", which is correct behaviour, not a blocker.

---

## 5. Advice and wording changes for TJ to approve

Every string below is new or changed user-facing text. Old → new. Nothing changes the objective values.

| # | Where | Today | Proposed |
|---|---|---|---|
| W1 | Candidate detail panel, ownership unknown | `Ownership —%` | `Ownership unknown` |
| W2 | Candidate detail panel, ownership stale | (shown as unknown) | `Ownership {x}% · last known {date}` |
| W3 | Candidate detail panel, valid 0 | `Ownership 0%` | `Ownership 0%` (unchanged; 0 is a real value) |
| W4 | DROP chip / DROP move, high demand (new) | — | `Widely rostered: {x}% of Yahoo leagues. Others may claim him quickly if dropped.` |
| W5 | DROP chip / DROP move, ownership unknown (new) | — | `Ownership unknown. Demand from other managers isn't checked.` |
| W6 | Plan or candidate tie note when ownership broke a tie (new) | — | `Same projected result as other options. This one drops the less-rostered player.` |
| W7 | Best Fit header, category leagues | `Ranked by more starts. Check category gains before swapping.` | `Ranked by more starts. Each card shows the category gains and losses for the whole swap.` |
| W8 | CategoryGains, no opponent (today all rows read "Change unavailable") | `Change unavailable` | `No move {a} → plan {b} · Δ {d} · gain {g} / sacrifice {s} · no opponent scoreboard` |
| W9 | CategoryGains ratio rows (new) | — | `{key}: pooled {a} → {b} · components {num} {±n} / {den} {±d}` |
| W10 | CategoryGains incomplete row | `Change unavailable` | `Incomplete: {reason}` (for example `missing projection for {player} {date}`) |
| W11 | CategoryGains intro (amend) | `…Displaced roster contributions are included. Ratios use each full lineup's numerator and denominator.` | `…Gains are what added players contribute on days they start; sacrifices are what dropped or displaced players no longer contribute. Ratios use each full lineup's numerator and denominator.` |
| W12 | CandidateCard, category leagues (new compact line) | — | `{key} {Δ} ({+gain} / −{sacrifice})` per category, `incomplete` where coverage is missing |

---

## 6. Decisions for TJ

1. **High-demand threshold.** Proposed: fresh ownership ≥ **50%**. Alternatives: 60% or 75%. This drives the caution only; ordering uses raw ownership within ties.
2. **Stale window.** Keep 3 days as the fresh cutoff, and show older values as "last known". Alternative: hide them entirely, as today.
3. **Equivalent-plan tie-break order.** Proposed: fewer adds → fewer drops → **lower dropped ownership** → id. Alternative: put ownership before the drop count.
4. **Ownership in the drop order (DROP chip, generation order).** Proposed: break exact contribution ties only. Alternative: caution only, with no effect on ordering.
5. **R8 scope.** Proposed first slice: planning-layer breakdown plus CategoryGains (W7–W11), then the CandidateCard line (W12) as a second slice.
