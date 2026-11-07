# RSO-FLAKE slice 2 receipt: F6 upkeep-lease busy loop + end-to-end acceptance packet (2026-10-26, Claude)

Lane RSO-FLAKE (pinned 15:46Z). Nothing committed. No git mutations, pushes, deploys, or production/provider/DB reads. No GIT_DIR. Every input is a synthetic fixture.

## Files (uncommitted; sha256)
| File | Change | sha256 |
|---|---|---|
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | F6 fix | 6bf54fd06e001bb2ba042d19b8a20950a86afbef1adcdf0bfb070e0835400603 |
| web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx | F6 tests | a8bf9456976bfe46cc4374d3f7eb197cd712200d7d94ceeb2798c2c04c88943f |
| web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts | **new**: acceptance packet | 3459870d380ff6f4d0b8ed8fac69227b5c6d6a64bfd72eb7effd7181a722c1dc |

Not built: the optional browser spec `e2e/rso-acceptance.spec.ts`. The UI flows are already covered by `e2e/rso-continuity.spec.ts` (mapped below).

## A) F6: Yahoo diet upkeep-lease busy loop
- **Cause:** in the timed-upkeep `refresh()`, a tab denied the lease (`claimRsoUpkeepLease` false) called `scheduleNext()` without moving `nextAutoAt`, so the delay was `max(0, past due) = 0`. It re-fired immediately and spun on localStorage and CPU.
- **Fix:** a new `UPKEEP_LEASE_RETRY_MS = 60_000`. On denial, `schedule.nextAutoAt = max(nextAutoAt, now + 60 s)` before `scheduleNext()`, so the retry is bounded and never zero.
  - A non-holder makes no timed provider calls.
  - Its own first load (`refresh(true)`) and an explicit Refresh are unchanged: they read once, as before.
  - Takeover happens within 60 s after the holder's lease (6 min TTL) lapses.
- **Tests** (component test, describe "Yahoo diet upkeep lease (F6)", fake timers):
  1. 30 min of denied upkeep: provider reads stay 1 (the first load only); lease-key reads ≤ 52 and stop between timers (no tight loop).
  2. The holder's lease lapses at 7 min: still 1 read at 6.5 min, takeover by 8.5 min (reads 2, this tab now holds the lease).
  3. A clock jump of +2 h past a 1 h lease: takeover within one retry.
  4. Unmount: no further lease checks or provider reads over 30 min.
  - The existing diet test, "leaves timed upkeep to the tab holding the lease and marks manual refreshes" (two tabs simulated through a foreign lease, manual bypass, release on hide), still passes.
- **Mutation check against HEAD** (a `/private/tmp` git-archive copy with the new test file, since deleted; `f6-mut.log`): test 1 **times out (busy loop)** and test 2 fails; tests 3 and 4 pass on HEAD. Before the fix in the canonical tree, test 1 also timed out (`f6-before.log`).
- **Reported, not fixed (outside the lease):** `web/lib/integrations/yahoo/rosterPlanning.ts:317` (`cacheKey(userId, league.external_league_key)`) and the related roster and fact keys at `:346`, `:363`, `:365` key on the FHFH user plus the league or team key, not `connected_account_id`.
  - Cross-account mixing is unlikely because team keys belong to one Yahoo account.
  - But after a Yahoo disconnect, reconnect to another account, or loss of team ownership, the process-local caches can serve that team's facts and settings until their TTL expires (facts 5–30 min, settings 6 h) without re-checking access.
  - **Suggested fix for the owning lane:** include `team.connected_account_id` in these keys (or clear them on reconnect), plus a targeted reconnect test.

## B) Acceptance packet: `lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts`
It uses the real `candidatePlanMetrics`, `evaluatePlan`, `reconcileIntent` and per-account `workspace` storage, on a small daily points league (C/LW/D + BN, Mon–Wed; adds take effect Tuesday). Forecasts are bridge-labelled rows admitted only under the fixture review. Assertions are outcomes, checked against an independent points oracle `fp()`.

| Required case | Test | What it proves |
|---|---|---|
| Complete roster + eligible pickup pool | (1) | Legal no-move baseline = the oracle sum; all 4 roster places used; all 4 pickups compared with `complete: true`; rostered players filtered |
| Improving legal drop/add | (2) | Free drop: net = 2 × fp(faGood) |
| Displayed gain = legal-plan difference incl. dropped player's lost contribution | (2) | With free drops protected, the best plan drops d1: `lostAGP 1`, `lostPoints = fp(d1)`, net = 2·fp(faGood) − fp(d1) > 0. Every displayed net equals `evaluatePlan(with steps) − evaluatePlan(no move)` for the same objective |
| Attractive but unstartable pickup | (3) | faStar (fp 9, more than 2× faGood) has no RW slot: every plan has `netAGP 0` and net ≤ 0, equal to the plan difference |
| Negative option | (4) | faWeak's best plan (free drops protected) is a loss: fp(faWeak) − fp(d1) < 0, reported as negative and equal to the plan difference |
| Protected drops | (5) | Protecting b1 and d1: no offered plan drops either |
| Missing data unknown, not zero | (6) | faMissing (no forecast row): `netPoints null`, `lostPoints null`, schedule value still known (`netAGP 1`) |
| Save/reopen, Undo, account isolation | (7a) | Per-principal save with an Undo entry reopens exactly; principal B and the signed-out slot read nothing |
| Refresh reconciliation + Undo | (7b) | The pickup is claimed on refresh → an issue on that step, and the selected move is kept; an unchanged refresh → no issues; Undo returns the pre-selection plan |
| Expected-version 409 conflict | existing: `lib/in-season/workspaceRoutes.test.ts:114-116` (server `version_conflict` 409, nothing written) and `e2e/rso-continuity.spec.ts` case 3 (UI surfaces the 409, local plan kept, retry re-surfaces) | Not duplicated; both pass |
| UI-level refresh/Undo/reopen, account and league isolation, offline misreport | existing `e2e/rso-continuity.spec.ts` cases 1, 2, 7 | Browser coverage of the same flows |

Bridge policy: the packet admits bridge rows only through `fixtureRsoPolicy` (mocked `currentRsoUsePolicy`). Nothing uses the bridge to get past a native permission denial.

## Runs
| Check | UTC | America/New_York |
|---|---|---|
| `dailyAcceptance.e2e.test.ts` | 8/8 | 8/8 |
| RSO suites (`lib/rosterScheduleOptimizer` incl. all `dailyAcceptance.*`, `__tests__/components/RosterScheduleOptimizer`, `components/RosterScheduleOptimizer`, `hooks`, `lib/in-season`) | **1657/1657** (`unit-f6-UTC.log`) | **1657/1657** |
| eslint (3 files) | 0 errors; the same 6 existing react-hooks warnings in the component | |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` | see the addendum below (the lock was held by RSO-MANUAL-F2 at first; I waited rather than take it) | |

**Shared-tree note:** RSO-MANUAL's uncommitted F2/F3 edits (`planning.ts`, `candidatePlanMetrics.ts` and its test, `planningTypes.ts`) were in the working tree during these runs. The packet asserts outcomes, but it ran against that in-progress code.

## Addendum: whole-project tsc
I took the heavy lock after waiting for RSO-MANUAL-F2 to release it (never stolen), ran tsc, and released the lock. **`tsc --noEmit`: exit 2, 3 errors, none in this lane's files.** All three are in FORGE projections tests that reference exports the active prov-guard lane is changing:
- `__tests__/pages/api/v1/forge/players.test.ts(163)`: `requireLatestExternalInputProvenRunId` missing on `lib/projections/apiHelpers`;
- `lib/projections/apiHelpers.runAdmission.test.ts(8)`: same export;
- `lib/projections/externalInputProof.test.ts(4)`: `runAttributedToVerifiedRelease` missing on `externalInputProof`.

There are no errors in `RosterScheduleOptimizer.tsx`, its test or `dailyAcceptance.e2e.test.ts`. Rerun tsc once prov-guard lands its matching source changes.

## Addendum 2: tsc retry (2026-10-26, after prov-guard and the reserve pass landed their edits)
- Whole-project `tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` (noclobber; acquired and released): **exit 0, 0 errors.**
- RSO suites rerun on the current shared tree: **1657/1657 in UTC and in America/New_York.**
