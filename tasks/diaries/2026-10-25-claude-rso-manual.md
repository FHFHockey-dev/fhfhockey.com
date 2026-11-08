# 2026-10-25 · Claude · RSO-MANUAL (offline manual/free daily acceptance packet)

## Scope
New fixture-based acceptance suite `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts` driving the real planner
(planning, planningTimeline, workspace, reconciliation) through scenarios (a)–(g); artifacts in
`tasks/artifacts/rso-wave1-2026-10-25/MANUAL/` (RECEIPT.md, DEFECTS.md). No product source edits, no commit (orchestrator commits).

## Where
- Branch octoberBranch, base HEAD recorded in RECEIPT.
- Lease: CLAUDE-LEASES.json lane RSO-MANUAL.

## State / checks
- [start] Read planningTypes, planningTimeline, reconciliation, workspace, planning evaluatePlan/planRoster, retention, rsoUsePolicy(.fixtures).
- Interim forecasts use `fixtureRsoPolicy`/`fixtureRsoBindings` with codeVersion labelled interim FORGE bridge fixture.

- [done] Suite written: 7 describes, 28 tests (26 pass + 2 `it.fails` defects D1, D2). sha256 d5177d39…58962.
- Vitest 3/3 green (~1.1 s), eslint exit 0, scoped tsc (MANUAL/tsconfig.json) exit 0. Whole-project tsc not run.
- Each it.fails was run once as a plain `it` (file restored afterwards): each fails only at its defect line (346, 411).
- RECEIPT.md + DEFECTS.md written in MANUAL/.

- [RSO-RECON] Packet committed as 0f8a09fff. Fixed D1 (reconciliation reserve + verified-timing rechecks) and D2
  (goalie.projected null once met with unknown start). Flipped both it.fails; added 2 reconciliation tests; updated
  1 pinned planning assertion. RSO suites 916/916, eslint 0, whole tsc 0 (8 GB heap; default heap OOMs) under heavy lock.
  RECEIPT-2.md has hashes.

- [RSO-RECON 2] e8e8c293c committed; C7 R30 accepted with limits R1/R2. Added timeline cross-check (effective order,
  flags first offending step until the suggestion is timeline-legal) + explicit unknown-timing / waiver-clearance issues.
  Two old reconciliation fixtures set to same_day (default rules have unknown timing). Invariant test: 1,122 cases,
  550 rejected. RSO suites 918/918, eslint 0, whole tsc 0 under heavy lock. RECEIPT-3.md has hashes.

## Next
Orchestrator commits the test file and MANUAL/ artifacts; RSO owner decides D1/D2 fixes. Retire this diary after commit.

## Blockers
None.

## Gotchas
- Production RSO_USE_POLICY catalog is empty; tests must spy `currentRsoUsePolicy` (pattern from dailyDecisionReplay.test.ts).
- The real interim bridge (`withCurrentPlanningRead`) needs a fetch; not exercised offline.
- Any playing D can take UTIL; don't assert a specific UTIL occupant.
- buildTimeline().legal is lazy: call .at(far future) first or legality is vacuous.
- Whole-project tsc needs node --max-old-space-size=8192.
- (fixed) reconcileIntent had no reserve-step branch (D1); goalie.projected skips unknown probabilities once the minimum is met (D2).
