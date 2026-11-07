# RSO-RECON receipt 3: C7 R1/R2 and the "never silent" invariant

- **Lane:** RSO-RECON (same lease). **Date:** 2026-10-25.
- **Base:** HEAD `842ea60f6`, which includes `e8e8c293c`.
- **Review addressed:** C7 `handoffs/C7/RECEIPT-R30.md`, findings R1 and R2.
- **Status:** not committed. The orchestrator commits.
- **Untouched:** `rosterScheduleData/**`, `RosterScheduleOptimizer.tsx`, `planning.ts` and `planning.test.ts` are
  unchanged by this ticket.

## Hash list

| File | HEAD sha256 | New sha256 |
|---|---|---|
| `web/lib/rosterScheduleOptimizer/reconciliation.ts` | `b8375a30bd25b45052c26cd50432e11dbd0ebfee5523b86a991e5c3c03d2176d` | `d3e27bc0fd9ed8dce1bc85ecc9382fccfe0ee83516505bf4f2bbb91dba0bb57a` |
| `web/lib/rosterScheduleOptimizer/reconciliation.test.ts` | `39bd07305d5402bf8a927958a0b000be200616a95103d6aab0b5d520ed42c38a` | `775393b4c3e2131f1257396e75253f4aea4f6fda21313b67be728645ba3a9d61` |
| `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts` | `049e8386ab0efffce52f4e6efe3f4201195b66276e20d8789842543f5ce9a9bb` | `52e448f45e7a99eac2455cd0faa4f3e33f632592d0dad86ddaa4af44bb20ae2b` |

Diff: 3 files, +112 / −9.

## Changes (`reconciliation.ts`)

### R1: timeline cross-check

After the existing action-order passes, reconciliation asks `buildTimeline` (advanced past every step) whether the
retained steps are legal.

- **If they are not:**
  - Steps are walked in the timeline's effective-time order (`effectiveAt`, then `at`, then id).
  - The first step whose prefix, including its prerequisites, makes the timeline illegal is flagged and removed.
  - The issue text carries the timeline's own new rejection reasons, for example "…: IR capacity exceeded."
  - Dependents are repaired through `invalidateDependents()`.
  - This repeats until the remaining steps are timeline-legal.
- **If the refreshed roster is illegal before any move:** a single global issue is raised. Steps can't be blamed
  for it.

This makes the invariant hold by construction. Whenever the timeline rejects the selected intent, reconciliation
returns at least one issue and a non-null `suggestedSteps`, and that suggestion is timeline-legal.

**C7 X2** (a next-day add at T1, effective T3, that drops the IR holder, plus a reserve move at T2) now flags `res`
with "IR capacity exceeded." and suggests `[swap]`.

### R2: explicit timing issues

| Case | Message |
|---|---|
| Unknown `acquisitionTiming` | "Acquisition timing is unknown; `<name>`'s effective time cannot be verified." |
| Waiver claim with no or invalid `waiverClearsAt` | "Cannot verify waiver clearance for `<name>`." |

The existing too-early check, for next-day timing or a later clearance, is unchanged.

**Owner tests and unknown timing.**
- No owner test asserts that unknown timing should be silent.
- Two older tests built their fixture from `defaultWorkspace().rules`, which defaults to
  `acquisitionTiming: "unknown"`:
  - "flags unavailable selected adds and leaves intent untouched"
  - "does not charge an invalid add or treat it as a later drop prerequisite"
- Neither is about timing, and under the invariant both would now see a timing issue. I set
  `acquisitionTiming: "same_day"` in those two fixtures. Their assertions are unchanged.
- My own ticket-1 assertion ("unknown timing not flagged") is replaced by the explicit issue.

**Behaviour change to note:** on a connected Yahoo refresh whose rules leave `acquisitionTiming` unknown, every
selected add now gets a repair issue, and `suggestedSteps` drops it. This is intended per R2: the timeline already
rules such plans illegal.

## Tests

**`reconciliation.test.ts`:**
- New: "follows the timeline's effective-time order for a next-day add that frees an IR slot (C7 X1/X2)".
  - X1: legal, no issues.
  - X2: timeline-illegal. Exactly one issue, on `res`. The suggestion is `[swap]` and is timeline-legal.
- The timing test now asserts the explicit unknown-timing issues, and the missing-clearance issue with the same-day
  add surviving. Each case is cross-checked with `buildTimeline`.

**`dailyAcceptance.manual.test.ts`:**
- New property-style test: "invariant: reconciliation is never silent on moves the timeline rejects".
- *Scenarios:* 3 acceptance snapshots (stream, IR-injured, waivers).
- *Plans:* 7 hand-picked selected-move plans, plus every multi-step alternative `planRoster` returns for each scenario.
- *Refresh mutations (11):*
  - unchanged
  - next-day timing
  - unknown timing
  - daily limit spent
  - IR removed
  - IR eligibility lost
  - streamers claimed
  - waiver clearance unknown
  - waiver clearance later
  - drop locked
  - drops protected
- *Result:* 1,122 cases, 550 of them timeline-rejected. For every rejected case it asserts that issues are non-empty
  and that `suggestedSteps` is non-null and timeline-legal.
- It also asserts at least 200 checked and at least 50 rejected, so the property cannot pass vacuously.

## Checks (offline, from `web/`)

| Check | Result |
|---|---|
| Focused: reconciliation and dailyAcceptance tests | **passed**, 35/35 |
| Regression proof: the same files against `git show HEAD:` `reconciliation.ts` (fixed file restored, hash re-verified) | **failed as expected**: exactly 3 fail. They are the timing test (unknown-timing and clearance issues), C7 X2, and the invariant ("unknown timing: stream: expected 0 to be greater than 0"). |
| RSO suites: `env -u GIT_DIR npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer` | **passed**, 38 files and 918 tests (`recon3-rso-suites.log`) |
| ESLint on the 3 changed files | **passed**, exit 0 (`recon3-eslint.log`) |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (noclobber, released only by its owner) with `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | **passed**, exit 0 (`recon3-tsc-full.log`) |

No network, database, provider, production, server, git mutation or `GIT_DIR` was used.
