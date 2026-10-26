# FR9/FR10 receipt: offline category-league acceptance packet

- **Lane:** RSO-MANUAL (lease: the single new test file). **Date:** 2026-10-26.
- **Base HEAD:** `0d173aed7` (octoberBranch).
- **Status:** not committed. No planner code was changed.

## File list

| File | sha256 |
|---|---|
| `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts` (new) | `a05478a4ff3069c8afffdbb243507a5490c98a740d3f9b7b68a7f8c68ef8e274` |

Support files in this folder: `tsconfig.json` (scoped tsc), `tsc-scoped.log`, `eslint.log`,
`vitest-UTC-run1..2.log`, `vitest-America-New_York-run1..2.log` and `rso-lib-NY.log`.

## Fixture and oracle

- **League:** daily head-to-head categories, Toronto time. The matchup week runs Mon 2026-10-19 → Sun 10-25 and is
  checked on Thursday (horizon Thu–Sun).
- **Categories:** G, A, SOG, SH% (G/SOG), W, SV% (SV/SA), GAA (GA/MIN × 60, lower is better).
- **Totals:** banked Mon–Wed `realized` totals plus interim-labelled per-game lines. The opponent has realized plus
  remaining totals.
- **Goalie minimum:** 3 starts, 1 credited, counts `starts`, penalty `lose_goalie_categories`.
- **Oracle:** an independent function pools the realized and assigned components, then computes each category value
  and its win/loss/tie. It never reads planner values.

## Scenarios: what each proves (11 `it` plus 2 `it.fails`)

**FR9: category and matchup decisions**
- **Banked plus future pooling.** Every category's own value matches the oracle; for example goals = 4 banked + 1.5 =
  5.5.
  - SV% is pooled: (50 + 54 + 44)/(55 + 58 + 50). That differs by more than 1e-4 from the mean of the five per-game
    rates.
  - GAA = 15/360 × 60. SH% = 5.5/40.
  - The projected stats carry the pooled components.
- **Known opponent.** Each category's result matches the oracle. All three of win, loss and tie occur (the goals tie
  is 5.5 vs 5.5).
- **Missing opponent** (`opponent: null`, or `remaining: null`). Every result is `unknown` with a null opponent value,
  while the team's own values stay known.
  - `projectedValue` is null.
  - The "Opponent projection is unavailable" and "calibrated joint probabilities are unavailable" limitations are
    present, and no probability field appears.
- **Missing or zero denominator.** SV% is unknown when the team's own denominator is missing, or when the opponent's
  *realized* denominator is missing. GAA is unknown when the opponent's minutes are 0. The other categories stay known.
  - **The opponent's *remaining* denominator is a defect: FR9-D1.**
- **No scalar blend.** A free agent who adds 2 starts raises G/A/SOG and lowers SH%.
  - Both plans: no quality recommendation, and the "no approved overall utility" limitation is present.
  - `candidatePlanMetrics`: `netAGP` 2, `netPoints` null, `categoryComparisonVerified` true. The per-category breakdown
    has pooled SH% components (net goals +0.25, net SOG +8) matching the oracle.
  - `planRoster` keeps the tradeoff as an alternative and carries the "not globally ranked" limitation.
  - **The category-mode `projectedValue` scalar is a defect: FR9-D2.**

**FR10: goalie minimum**
- **Credited, confirmed and projected stay separate.** Credited 1, confirmed 1, expected starts 1 + 0.75 + 0.5 + 0.5,
  and projected = credited + expected. Not satisfied, and not at risk.
- **Cover versus accept risk** (2 credited; only Thursday's confirmed start remains, and it can only hurt SV% and GAA).
  - *Cover* keeps the start: projected 3, not at risk, SV% lost, matchup projection known.
  - *Accept risk* sits it: projected 2, at risk, SV% won (52/55).
  - **Forfeiture path:** `projectedValue` is null and the "Goalie-category forfeiture risk…" limitation is present.
    With penalty `none`, the same risk keeps the projection.
- **Unknown semantics stay incomplete.** With `counts` unknown or `penalty` unknown, the "Goalie minimum semantics are
  incomplete" limitation appears. An unknown count leaves projected null. Credited stays 1 and the minimum is never
  marked satisfied.
- **Starts are never appearances.** With `counts: "appearances"`, projected is null and the plan is at risk, with the
  "starter probabilities cannot verify" limitation. Starts are still reported as starts: expected 2.75, confirmed 1.
- **Preferred window and refresh.** An early (Mon–Wed) window with only Thursday–Sunday starts gets the "coverage is
  infeasible" limitation. Changed starter evidence is flagged by `reconcileIntent`.

**Does not prove:**
- the Yahoo provider's category or remaining-stat feeds (the opponent's `remaining` is `null` from the Yahoo loader);
- weekly category leagues;
- appearance-probability sources (none exist).

## Defects (pinned as `it.fails`; planner not changed)

Each pin was run once as a plain `it` (file restored, hash re-verified). Each failed only at its defect assertion:
test lines 187 and 225.

### FR9-D1 (medium): a missing *remaining* opponent component is treated as zero

- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:78-83` (`opponentStats`). Line 81 iterates only the keys
  present in `opponent.remaining`. A key in `realized` but absent from `remaining` keeps the realized value as the full
  matchup total.
- **Minimal reproduction:** the category fixture with
  `delete opponent.remaining.SHOTS_AGAINST_GOALIE`; then `evaluatePlan(data, intent, "agp", [])`.
- **Expected:** opponent SV% `null`, result `"unknown"`.
- **Actual:** opponent SV% = (70 + 40)/76 = **1.447** (a save percentage above 100%), result `"loss"`.
- **Contrast:** a component missing from `realized` correctly gives unknown.
- **Suggested fix:** union the keys of `realized` and `remaining`. Any key missing on either side (when `remaining` is
  not null) becomes null.
- **Pin:** `it.fails("keeps the opponent's ratio unknown when its remaining denominator is missing")`.

### FR9-D2 (low): category mode reports a fixed equal-weight scalar as `projectedValue`

- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:900`. In category mode, once every result is known,
  `projectedValue` is the sum of win = +1 and loss = −1.
- **Displayed:** `RosterScheduleOptimizer.tsx:1124` (Matchup panel) as "… projected" for both the no-move plan and the
  selected plan.
- **Not used for ranking:** `compareEvaluations`, `safeAlternative` and `orderStates` use the per-category partial
  order, and `candidatePlanMetrics` reports `netPoints: null`. Category `comparisonEligible` currently requires this
  value to be non-null.
- **Minimal reproduction:** the default category fixture, `evaluatePlan(data, intent, "agp", [])`.
- **Expected** (FR9: no scalar category blend): `projectedValue: null` while `comparisonEligible: true`.
- **Actual:** `projectedValue: -4`.
- **Suggested fix:** for the planner owner, decouple category comparison eligibility from `projectedValue` and report
  null, or a per-category count object, instead of a net-wins scalar. For the UI owner: label or hide the category
  "projected" number.
- **Pin:** `it.fails("reports no scalar category score once every category result is known")`.

## Checks (offline, from `web/`)

| Check | Result |
|---|---|
| `TZ=UTC env -u GIT_DIR npx vitest run lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts` ×2 | **passed** 13/13 each (11, plus 2 pinned defects as `it.fails`) |
| The same with `TZ=America/New_York` ×2 | **passed** 13/13 each |
| `TZ=America/New_York … vitest run lib/rosterScheduleOptimizer` | **passed**, 23 files and 627 tests |
| ESLint on the new file | **passed**, exit 0 |
| Scoped tsc (`tsconfig.json` here) | **passed**, exit 0 |
| Whole-project tsc | **not run** (a test-only file; scoped tsc covers it; the heavy lock was not taken) |

No network, database, production, server, git mutation or `GIT_DIR` was used.
