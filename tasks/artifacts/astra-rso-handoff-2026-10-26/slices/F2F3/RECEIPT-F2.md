# F2 receipt: legal lineup selection separated from approved totals/comparison (Astra audit F2)

- **Lane:** RSO-MANUAL (lease pinned 15:46Z). **Date:** 2026-10-26.
- **Base HEAD:** `cd73cbd69`. Every leased F2 file matched HEAD before editing.
- **Status:** not committed. The orchestrator commits F2 before F3 starts.
- **Untouched:** `RosterScheduleOptimizer.tsx`, the e2e files, `projections/*`, `socialShare/*` and `player-cards/*`.

## File list and hashes

| File | HEAD sha256 | New sha256 |
|---|---|---|
| `web/lib/rosterScheduleOptimizer/planning.ts` | `d68bd7d091fd5e94bf622c08453ff735909b8a72e89a0e477f3d8d27bbac6d00` | `876543a511ff5b554a649274202171b11d2c811d4250d405a9505715d8f6125a` |
| `web/lib/rosterScheduleOptimizer/planningTypes.ts` | `9b47521c85e102e9387adafa132cedd596d9ef7aec3aeb2aaec81d347009e8a2` | `9d3af60c48b0463fa9fee2bfcdaa60e37557a85e1179875e1fda914eeed46f06` |
| `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts` | `30acc638e6019650dbe7c53b7a443c9670be8fdea54b38e7e56027e9e4883b90` | `636583c204a47e715b4070da4aa4af32c57f12605bebf1e8300098f13a38a402` |
| `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts` | `6830e4a75a1ded1a5e5fc3a4b3c7a01ef6ae9fa5b9a0b5678a5af97066cb4ce2` | `35024a277e1d1cfe14a820df2c152b578c520ecff3170d6b8aeda456f2319f1f` |

Diff: 4 files, +99 / −7.

## Change

### Lineup choice (unchanged code)

`assign()` still chooses the legal lineup.
- When any competing opportunity lacks assignment permission (`playValue` returns null), that slot component is
  filled by schedule capacity (games), not by quality.
- Conditional tie-break stays denied, so SOG never chooses a slot or breaks a tie.
- `refineOutcomeLineup` and bench counterfactuals still run only with no unresolved quality, so they don't run here.

### Approved-totals pricing (`planning.ts:873-886`)

- **New predicate `pricedOnly(issue)`.** An unresolved opportunity is *pricing-only* when all of these hold:
  - its player's eligibility is verified;
  - its forecast is unconditional;
  - it is not a conflicting forecast;
  - every scoring target is approved for **totals and comparison**, with a finite stat.
- `totalsUnresolved` is the unresolved opportunities that are not pricing-only.
- `capacitySelected` is true when quality is unresolved but every unresolved opportunity is pricing-only.

### What now uses `totalsUnresolved`

- **`projectedValue` nulling** (was `unresolved`). Unknown is still null, never zero. A totals or comparison denial,
  a missing row, unverified eligibility or a conflict all keep it null.
- **Category `own` values**, the same way.
- **`comparisonInputs`** (`:973`): the same gates as the old `inputEligible`, except that it accepts
  `assignmentValue === null` when `capacitySelected`.
- **`comparisonEligible`**: still additionally requires every scheduled opportunity (benched competitors included) to
  allow comparison for every scoring target.

### What does not change

- `inputEligible` and `recommendationEligible`, which are quality-based. A capacity-chosen plan is never a quality
  recommendation: `recommendation.eligible = false` and `mode = "schedule_capacity"`.
- `assignmentValue` stays null.

### Labels

- **`selectionMethod`** (new optional field on `PlanEvaluation`, `planningTypes.ts`): `"quality"` when no quality is
  unresolved, `"schedule_capacity"` otherwise.
- **New limitation** when `capacitySelected`: "Lineup chosen by schedule capacity: approved totals and comparisons are
  computed on it, but no projection chose slots or broke ties."

### Candidate metrics (`candidatePlanMetrics.ts:81`)

- The outcome baseline and the outcome objective are used only when the outcome evaluation is comparable **and**
  quality-selected.
- Under capacity selection the outcome lineup is the AGP lineup, so candidates compare against the AGP baseline,
  labelled `objective: "agp"`.
- This exactly preserves the old behaviour, because previously comparability implied no unresolved quality.

### Kept exactly

- The full legal baseline, the no-move baselines, and the drop-loss ledger (`contributionLedger`, `dropped[].lostAGP`
  and `lostPoints`).
- `safeAlternative` and the ranking code.

**Consequence to note for review:** with comparison approved, `playerAssignedPoints` (used by the drop order) and plan
ranking can now read the approved SOG comparison values on capacity-chosen plans. That is comparison use, not slot
choice.

## Tests (`candidatePlanMetrics.test.ts`, new describe)

The describe is "approved totals/comparison without assignment permission". It ports the audit's reproduction to a
SOG-only fictional league.

| Test | Assignment / totals / comparison | Asserts |
|---|---|---|
| control (audit control) | granted / ✓ / ✓ | legal, comparable, `projectedValue` 10, `selectionMethod: "quality"`, recommendation quality; swapping values swaps the starter |
| audit repro | **denied** / ✓ / ✓ | legal, 1 active game, **comparable**, `projectedValue` = the SOG of the assigned starter, `assignmentValue` null, `selectionMethod: "schedule_capacity"`, recommendation not eligible, the limitation; **swapping values leaves the same starter** (SOG never chooses); the outcome objective gives the same capacity lineup and no recommendation |
| candidate selection | **denied** / ✓ / ✓ | baseline `agp`; candidate `c` plans are all `agp`; `netAGP` and `netPoints` equal re-evaluated plan minus baseline; drop-loss `lostAGP` is reported |
| unknown never zero | denied / ✗ / ✓ and denied / ✓ / ✗ | `projectedValue` null, not comparable, every candidate `netPoints` null |

**Regression proof:** against `git show HEAD:` copies of `planning.ts`, `candidatePlanMetrics.ts` and
`planningTypes.ts` (fixed files restored afterwards), all 5 new tests fail.
- The audit repro and candidate-selection tests fail on behaviour.
- The control and the two unknown cases fail only on the new `selectionMethod` label; their behaviour is unchanged.

## Checks (offline, from `web/`)

| Check | Result |
|---|---|
| RSO suites, `TZ=UTC`: `lib/rosterScheduleOptimizer lib/rosterScheduleData lib/player-forecasts lib/integrations/yahoo components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer` | **passed**, 94 files and 2,725 tests (`f2-suites-UTC.log`) |
| The same suites with `TZ=America/New_York` | **passed**, 94 files and 2,725 tests (`f2-suites-America-New_York.log`) |
| ESLint on the 4 changed files | **passed**, exit 0 (`f2-eslint.log`) |
| Scoped tsc (`tsconfig.f2.json`): changed files plus `planning.test.ts`, `benchDecisions.ts` and `CategoryGains.tsx` | **passed**, exit 0 (`f2-tsc-scoped.log`) |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (noclobber, released only by its owner) | **failed, on other lanes' files only**: 2 errors, both about `requireLatestExternalInputProvenRunId` missing from `lib/projections/apiHelpers.ts` (`__tests__/pages/api/v1/forge/players.test.ts:163`, `lib/projections/apiHelpers.runAdmission.test.ts:8`). PROV-GUARD is editing those files (uncommitted, out of this lease). An earlier run saw 6 errors in that lane's `scripts/verify-forge-release-sha.ts` while it was mid-edit. **No error is in an F2 file.** (`f2-tsc-full.log`) |

No network, database, production, server, git mutation or `GIT_DIR` was used.

## UI note (reported, not changed)

`RosterScheduleOptimizer.tsx` (RSO-FLAKE) shows `selected.limitations`, so the new capacity-selection limitation is
displayed. Showing `selectionMethod` next to the plan totals, and keeping "Optimize lineup" gated on
`recommendation.eligible` (already the case at `:711`), is the UI lane's choice.
