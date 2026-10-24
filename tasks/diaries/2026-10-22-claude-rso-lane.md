# Claude RSO lane — 2026-10-22

## Scope
RSO lane of `tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md`:
inventory Codex's uncommitted P07 R2 + task10 candidate, fix the 13 held planner/bridge
failures, verify + commit, then task 7.3 (bridge serves FORGE paired win probability).
No push, no release, no production reads. Report to Chef `local_08a0bf1c`.

## Where
`/Users/tim/Code/fhfhockey.com`, `octoberBranch`, start HEAD `cbb4f6836`.

## Inventory (checkpoint 1)
- Hash match vs `p07-rso-use-policy-2026-10-22/{,r2/}CANDIDATE.json`, `task10-display-2026-10-22/{,r1/}candidate.json`:
  every listed RSO file matches the task10 R1 pin set (which carries P07 R2's 30 pins).
  - P07 R2 bytes == current: hooks/*, data.ts + test, planningContributions, rsoUsePolicy, gameExpectationReader,
    yahoo/rosterPlanning, workspaceSchema, rosterScheduleData/planning*, planningDataTransport, currentPlanningRead,
    executionAdapter, planningTypes, RSO planning.test.ts, CandidateBrowser*, CompactSchedule, RSO __tests__.
  - task10 only: RosterScheduleOptimizer.tsx, SlotWeekGrid.{tsx,module.scss,test.tsx}, ForecastPoints*,
    RosterScheduleOptimizer.points.test.tsx, gameForecastPoints.test.ts, rosterScheduleOptimizer/planning.ts.
- NOT P07/task10: `web/lib/in-season/monthlyIntegration.test.ts` (billing relocation: points at
  `tasks/artifacts/in-season-billing-2026-10-21/drafts/...sql`, pairs with the deleted migration). Left untouched; report to TJ.
- `forgeDailyBridge.ts`/`.test.ts` are clean (committed). The 12 planner failures are in
  `rosterScheduleOptimizer/candidatePlanMetrics.test.ts` (clean, not in the listed lane files).

## Fixes (checkpoint 2)
- Reproduced 13/13. Root cause as Codex said: native fixtures have no reviewed binding; bridge rows used outside a current read.
- forgeDailyBridge.test: runs the planner inside `withCurrentPlanningRead` (mocked GET, JSON round trip) with season totals
  so FACEOFFS_WON has an input (7/game); expected value adds 2 × 0.7. Literal rows outside a read → null (kept as denial).
  Gotcha: structuredClone keeps the bridge's shared per-skater stats object across games, which collides in the
  authority map keyed by stats identity; real JSON never shares. Fail-closed, not a runtime defect.
- candidatePlanMetrics.test: fictional reviewed GOALS binding + denial cases (unbound / production catalog → netPoints null).
- New `lib/player-forecasts/rsoUsePolicy.fixtures.ts` (fixtureRsoBindings / bindFixtureForecast / fixtureRsoPolicy).
- Wider lane run found 35 more failures in 5 files Codex never selected (CategoryGains, AcquisitionRules.integration,
  dailyDecisionReplay, lineupGaps, planningReproducibility). Same cause; fixed with the fixtures module, plus:
  fake Date.now ticks from fixture time (was 1970), AcquisitionRules stub Worker now runs executeRosterPlanning and
  the data mock returns a current-read receipt; request-count assertion narrowed to "only current-read GETs".
- planning.test.ts fixture review expired 2026-11-01 on the real clock → extended to 2100 (time bomb).
- OPEN runtime defect: re-resolution denies baseline-rate + issued-participation rows: forecastFromContributions sets
  modelVersion to the rate's policyVersion, so restrictRsoForecast's pass-2 binding check fails (planningReproducibility
  "baseline" case). Fail-closed; no live effect while the catalog is empty. Needs TJ/Chef decision.
- `candidateMetrics.worker.ts` is no longer spawned by anything (dead after P07).

## Checkpoint 3: verified + committed
- TJ (pop-up): baseline defect → mark known (it.fails), commit; 7.3 re-aimed W → FORGE's paired win function.
- Lane suite 128 files: 3130 pass (baseline case as it.fails). eslint clean. tsc pass (needs
  NODE_OPTIONS=--max-old-space-size=8192; default heap OOMs) under /private/tmp/fhfh-heavy.lock. SlotWeekGrid pure check OK.
- Commits: 2708fd428 P07 R2 (exact r2/after bytes, incl. RSO.tsx/planning.ts staged from after/),
  78a445a27 task10 R1, 1a9c48975 integration fixes. Not pushed.

## Checkpoint 4: 7.3 committed
- 293b5dc36: bridge teamWins (forge / forge_paired / forge_model via goalieOutcomes.teamWinProbability), goalie
  W = start chance × 0.984 × team P(win); blank/missing → null. Legacy xG function kept only for the ledger snapshot route.
- Bridge 30/30; RSO + rsoData + snapshot route 1018 pass; eslint clean; tsc pass.

## State / next
- Done, not pushed. Hand-over: side-session-notes/.../rso-lane-p07-task10-7.3-2026-10-22.md (open items 1–8).
- Chef sequences the release; 7.3 ships with or after 7.2 (6b4898a95).

## Ticket: "16 players unprojected" (from Chef, 2026-10-22 evening)
- Evidence (TJ-approved reads, isolated :3210): data route 200 in 2.9 s; all 16 players have complete bridge rows,
  no null stats; response passes every current-read guard. Offline replay of executeRosterPlanning with the captured
  response: lineup plans fine (103.3 pts, drop = Dvorak) when the lineup is legal.
- TJ's refreshed notice: "the no-move lineup fails a rule check (Retained roster inputs are unverified ... Initial reserve
  placement for 9431 is unverified.)". 9431 = Jared Spurgeon, in TJ's IR slot but playing (5 GP, 4 pts) → no IR
  eligibility → timeline illegal → every contribution unknown → old gapReport fell back to listing all droppable players.
- Fix (uncommitted yet): lineupGaps.projectionBlockers names the reserve-slot player / unresolved player-games / lineup-wide
  cause; unprojectedDrops only lists players with their own missing projection. UI notice + chip title use it.
  Tests: lineupGaps 10/10 (new reserve + non-droppable cases fail on old code); RSO suites 825 pass; tsc pass.
- TJ's earlier connected view vs now retained path: both illegal for the same reserve reason.
- Committed 7346454a4 (lineupGaps blockers + notice + chip title). TJ moved Spurgeon out of IR; his :3000 notice then named
  Spurgeon: no FORGE projection for his MIN games (he is missing from MIN's latest FORGE run). Final wording groups dates:
  "Jared Spurgeon has unknown projected points: no FORGE projection issued for 2026-10-22, 2026-10-24, 2026-10-25".
- Checks: lineupGaps 10/10; RSO suites 34 files / 827 pass; eslint 0 errors (6 old warnings); tsc pass.
- Isolated :3210 UI check blocked: RSO needs sign-in (access/workspace 401). Production reads used: 2 approved GETs
  (diagnosis) + 2 by the signed-out page load (data, schedule). Server stopped. TJ verified on :3000 instead.
- Follow-up idea (not done): one unprojected roster player still blanks all drop suggestions in points leagues (strict by
  design); TJ may want drop ranking that excludes the unknown player.
