# FR9-D1 / FR9-D2 fix receipt

- **Lane:** RSO-MANUAL. The lease covers `planning.ts`, `planning.test.ts`, `candidatePlanMetrics.ts` and its test, and
  `dailyAcceptance.categories.test.ts`. The orchestrator extended it to `planningReproducibility.test.ts` and
  `__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx`.
- **Date:** 2026-10-26. **Base HEAD:** `6c36c8e8c`. Every edited file was clean at HEAD.
- **Status:** not committed.

## Files and hashes

| File | HEAD sha256 | New sha256 |
|---|---|---|
| `web/lib/rosterScheduleOptimizer/planning.ts` | `876543a511ff5b554a649274202171b11d2c811d4250d405a9505715d8f6125a` | `99ca8911e1b9561312e0d3b73b4377e2ba176ea427d34283c1867ba028c51d48` |
| `web/lib/rosterScheduleOptimizer/planning.test.ts` | `56a5bba9454e57ded5d6cd85dae46391a31db6ca210c655bdce568d7ce9a33ee` | `c03e74b42a55d0c26ea562442989d259cbfce3dfdefd9b8881bf129b4b2968c1` |
| `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts` | `dc4e9bcacd4e5ece49d8a26469b61af7c7005275a69a1b6f27e4ba8cd5fbf60c` | `5a94d41bff83f4f6fdedf562f33670b78f12d6fdc2d76367fb70eb0e0d9e3db7` |
| `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts` | `a05478a4ff3069c8afffdbb243507a5490c98a740d3f9b7b68a7f8c68ef8e274` | `6bf52775f101b0b1f2ce47f0f97705b3afbba043c291c705161b64ce9059e41f` |
| `web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx` | `6812eae9128543165341507649f690ce6e5ceba745b5eba90c368366f6e80bce` | `093d56b6546b89c69ae04fd7f5aacf2a50f35693c735c26dea02f8e43603f1a9` |

- Diff: 5 files, +55 / −30.
- `candidatePlanMetrics.ts` and its test are unchanged.
- `planning.ts` is **not** in the FORGE producer closure (per the F3 closure listing).

## Changes (`planning.ts`)

### FR9-D1 (`opponentStats`, `:78-87`)

- The opponent's matchup totals now take the union of the `realized` and `remaining` keys.
  - A key is the sum only when both sides are finite. Otherwise it is `null`.
  - Before, keys missing from `remaining` kept the banked value: remaining was treated as 0.
- A category whose opponent component is unknown gives `opponent: null` and `result: "unknown"`. Categories whose
  components are all known stay known, and an explicit 0 counts as known.
- `remaining: null` still means no opponent projection at all, as before.

### FR9-D2 (`:902`, `:982`, `:1325`)

- Category mode reports **`projectedValue: null`**. The old value was Σ win = +1, loss = −1.
- An internal `matchupKnown` keeps the old category gate for comparison eligibility: every result known, totals
  priced, and no forfeiture. It is cleared at the same three places the old value was nulled: forfeiture risk, unpriced
  totals or incomplete opportunities, and conflicting forecasts.
- `comparisonEligible` uses `outcomeKnown`, which is `projectedValue !== null` in points mode and `matchupKnown` in
  category mode.
- The existing "Category assignments use schedule capacity … no approved overall utility …" limitation is still added
  in category mode.
- **Points mode is unchanged:** every edit is gated on category mode.

## Consumer audit of `projectedValue` in category mode

| Consumer | Uses it in category mode? | Change |
|---|---|---|
| `planning.ts` `comparisonEligible` | yes (required non-null) | now `matchupKnown`; same truth value as before |
| `planning.ts` `planRoster` "Fantasy-point drop recommendations need …" limitation (`:1325`) | yes (`baseline.projectedValue === null`) | category mode keys on `!baseline.comparisonEligible`, so it is not added to every category league |
| `planning.ts` `compareEvaluations`, `safeAlternative`, `orderStates`, `compareCategoryEvaluations` | no: the category branches use per-category results or the partial order | none |
| `planning.ts` `playerAssignedPoints`, `candidateActivePoints`, bench-forced deltas | no: points only | none |
| `benchDecisions.ts:77` (`category_outcomes` basis) | unreachable: runs only when `recommendation.eligible`, which is never true in category mode | none (not edited) |
| `player-forecasts/planComparison.ts` | unreachable: needs `recommendation.eligible` | none |
| `candidatePlanMetrics.ts` (`netPoints`, `projectedPoints`) | no: points only; `categoryComparisonVerified` uses `comparisonEligible` | none |
| `healthyReserves.ts`, `lineupGaps.ts` | no: points only | none |
| `CategoryGains.tsx` | no: the points branch only; the category branch uses `swapCategoryBreakdown` | none |
| `RosterScheduleOptimizer.tsx:1124` Matchup panel "… projected" | displayed | now shows "—" for category leagues (no edit; UI lane) |
| `RosterScheduleOptimizer.tsx:1121` capacity-selection note | reads `projectedValue == null` | category plans show the note without "totals priced" (no edit) |

## Test updates (fixtures and assertions only)

**`dailyAcceptance.categories.test.ts`:**
- Both `it.fails` pins are now plain `it` regression tests.
  - The D1 test also asserts that the other categories stay known, that the plan is not comparable, and that an
    explicit 0 counts as known.
- The cover/accept-risk test now asserts known results plus `comparisonEligible` in place of `projectedValue`. The
  forfeiture path is `comparisonEligible: false` with the limitation, and `penalty: "none"` stays comparable.

**`planning.test.ts`:**
- "keeps a credited goalie minimum satisfied…": `projectedValue` 1 becomes null, plus result `win` and
  `comparisonEligible: true`.
- The fixture at line 1564 used `remaining: {}` to mean nothing remaining. It now uses an explicit
  `{ GOALS_AGAINST_GOALIE: 0 }`, so the test keeps its original meaning.

**`planningReproducibility.test.ts`:**
- The opponent fixture's `remaining: {}` becomes an explicit 0 for each realized key.
- Category profiles expect `projectedValue: null` (with `comparisonEligible: true` where asserted). The points profile
  is unchanged.

**`CategoryGains.test.tsx`:**
- Category `projectedValue: 0` becomes null, with the baseline `comparisonEligible: true`.
- The goalie-ratio fixture's `remaining: {}` becomes explicit zeros.

**Regression proof:** the same suites against `git show HEAD:` `planning.ts` (fixed file restored, hash re-verified)
fail in exactly the 9 changed category-mode tests and nothing else (`fix-regression-proof.log`). Every points-mode test
passes against both versions.

## UX note for rso-flake (reported, not changed)

The manual "Add opponent totals" button (`RosterScheduleOptimizer.tsx`, `MatchupSetup`) creates
`opponent: { realized: {}, remaining: {} }`. After FR9-D1, a component with no remaining entry is unknown. So matchup
results stay "unknown" until the manager enters each remaining component, **including an explicit 0** for "nothing
left". Previously a blank remaining entry silently meant 0.

Suggested form change: prefill remaining with 0 for each component the manager enters in realized, or prompt for it.
The Yahoo loader is unaffected, because it always sets `remaining: null`.

## Checks (offline, from `web/`)

| Check | Result |
|---|---|
| RSO suites, `TZ=UTC`: `lib/rosterScheduleOptimizer` (all `dailyAcceptance.*`), `lib/rosterScheduleData`, `lib/player-forecasts`, `lib/integrations/yahoo`, `lib/in-season`, `components/RosterScheduleOptimizer`, `__tests__/components/RosterScheduleOptimizer` | **passed**, 106 files and 3,226 tests (`fix-suites-UTC.log`) |
| The same with `TZ=America/New_York` | **passed**, 106 files and 3,226 tests (`fix-suites-America-New_York.log`) |
| ESLint on the 5 changed files | **passed**, exit 0 (`fix-eslint.log`) |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (waited for another lane's hold, then took it with noclobber, released only by its owner) with `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | **passed**, exit 0 (`fix-tsc-full.log`) |

**Earlier run notes:** the first full run had one failure in `lib/integrations/yahoo/yahooDiet.test.ts`, and the New
York run also had the known load-sensitive "1000-player … 13 days" timeout. Both came from another lane's uncommitted
Yahoo edits and from load. The rerun above was fully green.

No network, database, production, server, git mutation or `GIT_DIR` was used.
