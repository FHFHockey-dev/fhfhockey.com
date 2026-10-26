# RSO-FLAKE C1/U1 receipt: category summary count + opponent remaining hint (C7 R46) (2026-10-26, Claude)

Lease: `components/RosterScheduleOptimizer/` and `__tests__/components/RosterScheduleOptimizer/`. Nothing committed. No scss change, so no CSS pure check was needed. No git mutations, production reads or deploys.

## Files (uncommitted; sha256)
| File | sha256 |
|---|---|
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | 30312764d87b45f3b1330ca057c83db3ee5724fa9902227cef356472406ea249 |
| web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx | 9d1d698a7c9214bebe804c59c5b07d42861ee7b8883a3f12e140d3afcc4a99be |

## Changes
- **C1:** in category mode, the "Category outcomes" summary card now shows a per-category **count** from `result.selected.categoryResults` (new module helper `categoryTally`), for example `1 W · 2 L · 1 T · 1 unknown`, with the detail "Categories projected won · lost · tied (a count, not a score)". It never shows a blended score.
  - When **every** category is unknown (or there are none), the card shows **Unknown** with a reason:
    - no opponent: "Add opponent totals under Manual matchup totals to compare categories.";
    - opponent remaining totals empty, null or partially null: "Opponent remaining totals are missing; enter 0 where nothing remains.";
    - otherwise: "Projections don't yet cover these categories."
  - Before any plan exists, the card still shows "—" / "Shows once projections cover your lineup".
  - **Points mode is unchanged:** the same `number(projectedValue)` value and detail text.
- **U1:** Manual matchup totals now says: "Enter every opponent remaining total, using 0 when nothing remains. A missing remaining total leaves that category unknown."
  - A small **No games remaining** button writes explicit 0s to opponent remaining for every component named by the opponent's realized or remaining totals or by the league categories (a ratio category's numerator and denominator). Realized totals are untouched.

## Tests (component test, describe "category summary metric (C7 R46 C1) and opponent remaining hint (U1)")
1. Mixed results → `1 W · 2 L · 1 T · 1 unknown` plus the count detail.
2. All unknown with no opponent → Unknown plus the "Add opponent totals…" reason.
3. All unknown with opponent remaining `{}` → Unknown plus the "enter 0" reason.
4. Points mode: value 7.5, the detail "League scoring, active games only", and no "Category outcomes" card.
5. The hint text, and the quick-fill writing `{ GOALS: 0, ASSISTS: 0, SAVES: 0, SHOTS_AGAINST: 0 }` with realized unchanged.

**Mutation check against HEAD** (a `/private/tmp` git-archive copy with the new test file, since deleted; `c1-mutation-head.log`): tests 1, 2, 3 and 5 **fail on HEAD**; test 4 (points mode) passes on HEAD as well, confirming points mode is unchanged.

## Runs
| Check | UTC | America/New_York |
|---|---|---|
| RSO component tests (`__tests__/components/RosterScheduleOptimizer`, incl. `CategoryGains.test.tsx`; `components/RosterScheduleOptimizer`) | **375/375** | **375/375** |
| eslint (2 files) | 0 errors (the same 6 existing react-hooks warnings) | |
| Whole-project `tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` | exit 0, 0 errors | |
