# RSO-RECON receipt: fixes for MANUAL D1 and D2

- **Lane:** RSO-RECON (CLAUDE-LEASES.json). **Date:** 2026-10-25.
- **Base:** `0f8a09fff`. Every leased file matched its baseline sha256 before editing.
- **Status:** not committed. The orchestrator commits.
- **Untouched:** `rosterScheduleData/**` and `RosterScheduleOptimizer.tsx`. No UI copy change was needed.

## Hash list

| File | Baseline sha256 | New sha256 |
|---|---|---|
| `web/lib/rosterScheduleOptimizer/reconciliation.ts` | `f43c7f84cd408d95c7cc89fad545f05c41c8f69beae03f13f1188e2ed50ab69d` | `b8375a30bd25b45052c26cd50432e11dbd0ebfee5523b86a991e5c3c03d2176d` |
| `web/lib/rosterScheduleOptimizer/reconciliation.test.ts` | `7a83a334e68ca83b4b24b0fb8adab2d8a7f9cfbfb4e3f7a7b0a3fa5981784ec5` | `39bd07305d5402bf8a927958a0b000be200616a95103d6aab0b5d520ed42c38a` |
| `web/lib/rosterScheduleOptimizer/planning.ts` | `d1300a64ac98d97765b9daff8017f3fe8341aa8757984ff176a177fc3a2674f2` | `d68bd7d091fd5e94bf622c08453ff735909b8a72e89a0e477f3d8d27bbac6d00` |
| `web/lib/rosterScheduleOptimizer/planning.test.ts` | `95b534df3ace78d45187dcc99f791b1a46d71f2c79f7b0b942786a79a45e27a9` | `82d8773d01bba424ecff709cb4628d17131aae8ab436285f161f3fcd7f446f5f` |
| `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts` | `d5177d39a88d5bc1821ba8f070c5d9c60a3b130c551708a1385aeefd03658962` | `049e8386ab0efffce52f4e6efe3f4201195b66276e20d8789842543f5ce9a9bb` |

Diff: 5 files, +104 / −11.

## Changes

### D1: `reconciliation.ts`

**Reserve steps are now rechecked.**
- *First loop:* a `reserve` step is flagged, and removed from the suggestion, when its `reservePosition` is missing
  from the refreshed `reserveEligibility`.
  - Message: "`<name>` is no longer verified for `<pos>`."
  - A player missing from the catalog is already flagged by the existing check.
- *Second loop,* in action order:
  - A reserve step for a player no longer on the actual or planned roster is flagged with the existing roster message.
  - A reserve step that would push its position past `rules.rosterSlots[pos]` is flagged: "Selected moves exceed
    `<pos>` capacity."
  - Occupancy starts from the refreshed roster. A retained drop, or a retained add's `dropPlayerId`, frees the
    occupant's reserve place. A retained reserve step takes one.
  - Dependents are repaired through the existing `invalidateDependents()` ("A prerequisite step needs repair.").

**Add timing is now rechecked.**
- A selected `effectiveAt` earlier than the verified earliest time is flagged and removed.
  - The earliest time comes from `acquisitionEffectiveAt`, the same helper the timeline and search use. This covers a
    change to `next_day` timing and a later `waiverClearsAt`.
  - Message: "`<name>` cannot take effect at the selected time under current league timing or waiver clearance."
- **Scoping decision:** when timing is unverified (`acquisitionTiming: "unknown"`, or a waiver with no clearance
  time), there is no earliest time to compare, so reconciliation does not flag the step.
  - `buildTimeline` still reports those plans as illegal.
  - This keeps connected Yahoo refreshes without a timing rule from proposing to drop every selected add.
  - A test pins this behaviour.

### D2: `planning.ts` (around line 903)

- Once the minimum is already met, an unknown start probability on an assigned goalie now makes `goalie.projected`
  `null`, consistent with `expectedStarts`.
- `risk` is computed before the readout is nulled, so a met minimum stays `risk: false`.
- Unchanged:
  - a fully known plan (credited plus known probabilities);
  - the appearance-minimum path, which does not sum starts;
  - unmet-minimum behaviour.
- No type or UI change was needed. The Matchup panel's `number()` formatter already renders null as unknown, so I
  have no UI copy change to report.

### Tests

**`dailyAcceptance.manual.test.ts`:** both `it.fails` cases are now plain `it` regression tests (MANUAL D1 and D2).

**`reconciliation.test.ts`:** two new tests and one helper.
- *Reserve rechecks:* covers lost eligibility, a player no longer on the roster, and exhausted IR capacity. Each case
  has a dependent-add repair and `suggestedSteps: []`. It also checks that a retained earlier drop of the IR occupant
  frees the slot, and that the intent is never mutated.
- *Timing rechecks:* covers a switch from same-day to next-day timing and a later waiver clearance. Each case flags
  only the affected step, and the other step survives in `suggestedSteps`. Unknown timing is not flagged.
- Each test cross-checks `buildTimeline` legality.
- *Helper `timelineLegal`:* advances the timeline before reading `.legal`, because the timeline applies steps lazily.
  - Observation, no change made: the existing test "keeps a later standalone drop…" reads
    `buildTimeline(...).legal` without advancing, so its `true` check is vacuous.

**`planning.test.ts`:** one existing assertion changed.
- The test "keeps a credited goalie minimum satisfied when future start odds are missing" pinned `projected: 1` for
  exactly the D2 case. It now expects `projected: null` and `expectedStarts: null`, while keeping `risk: false`,
  `minimumSatisfied: true` and `projectedValue: 1`.
- It adds a known-probability contrast: 0.4 gives `projected: 1.4`.

## Checks (offline, from `web/`)

| Check | Result |
|---|---|
| Focused: `npx vitest run` on reconciliation, dailyAcceptance and planning tests | **passed**, 178/178 |
| Regression proof: the same three files against `git show HEAD:` copies of `reconciliation.ts` and `planning.ts` (fixed files then restored; hashes re-verified) | **failed as expected**: exactly the 5 new or changed tests fail, 173 pass |
| RSO suites: `env -u GIT_DIR npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer` | **passed**, 38 files and 916 tests (`recon-rso-suites.log`) |
| ESLint on the 5 changed files | **passed**, exit 0 (`recon-eslint.log`) |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (taken with noclobber, released only by its owner) | first attempt hit a V8 out-of-memory crash, exit 134 (`recon-tsc-full-oom.log`). Retried with `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`: **passed**, exit 0 (`recon-tsc-full.log`) |

No network, database, provider, production, server, git mutation or `GIT_DIR` was used.
