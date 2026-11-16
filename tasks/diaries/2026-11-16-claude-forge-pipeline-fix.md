# 2026-11-16 Claude: FORGE pipeline reliability fix (C2, H1, M4, L2; M5 if same path)

## Scope
Fix AUDIT.md findings C2 (stuck `running` stage, no child deadline, no NHL fetch timeout, kill never recorded),
H1 (one rejected shift chart cancels the day; M5 retry if same code path), M4 (PP step reports success with 0 rows),
L2 (goalie `updated_at` never advances). Lane brief from Chef session local_e8064f61.

## Where
- Branch `octoberBranch`, checkout `/Users/tim/Code/fhfhockey.com`. Base HEAD `b296d52af`.
- Owned: `web/lib/rollingForgePipelineRunState.ts`, `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`,
  `ingest-projection-inputs.ts`, `update-goalie-projections-v2.ts`, `update-power-play-combinations/[gameId].ts`, their tests.
- Leases checked 17:10Z: only PROV-GUARD (idle since 10-26) names run-rolling-forge-pipeline.ts; Codex file stale (11-04).

## Design (pre-advisor)
- C2 retake: expired `running` stage is retaken only for replay-safe stages (core, contextual, ingest, derived,
  projection_execution + goalie marker, downstream). NST, rolling and relationship stay review-only (existing
  hardening tests pin them). Kill recorded via `recordRollingForgeStageKill`; 3 kills -> terminal `stage_killed`.
- Child deadline: every child step races `invocationStart + 225 s` (function maxDuration 240 s). Abandoned step =
  failed + `timedOut`; review hold (`stage_handoff_unconfirmed`, durable) for non-retakeable stages.
- Goalie route: `AbortSignal.timeout` on NHL fetches; `updated_at` in upsert payload (L2).
- H1/M5: under the durable cursor a source-rejected game within grace is isolated + recorded as a retry row
  (separate scope), slate completes; pipeline treats isolated-only ingest errors as degraded success.
- M4: [gameId] summary gets `outcome: deferred`; pipeline verifies PP rows (non-blocking degraded), reports
  writes-disabled as skipped. Batch `index.ts` is not owned -> ask TJ.

## State / checks
- C2 committed `a516725cd` (run-state, coordinator, goalie fetch timeouts, tests). Pipeline+goalie tests 125/125;
  `npm run typecheck` exit 0 (under lockf). No routes invoked. No prod reads.
- Advisor: verified RPC SQL (acquire over expired running row OK; key regexes fit). Child deadline 228 s.
- Start Chart `.lte("updated_at", endOfTargetDate)` (start-chart.ts:841-848) becomes live once L2 lands: report.

- H1/M5 committed `3dc9ae1ba` (ingest park/retry rows in scope `source_rejected_games`, pipeline degraded
  `projection_input_games_rejected`). Pipeline+ingest tests 130/130; typecheck exit 0 at 17:35Z.
- M5 not covered here: run-projection-v2 ingest gate denominator (not my file) and the HTML-report fallback.

- M4 committed `2f8d11dbc` ([gameId] outcome deferred + skip audit; pipeline verify-pp-context degraded
  `pp_context_deferred`, writes-off PP answer reported skipped). L2 committed `dd1f73575`.
- All six owned suites: 256/256 at 17:40Z. Final typecheck 17:41Z exit 2, errors only in other lanes'
  uncommitted `scripts/forge-build-admission.*` (earlier run: `forge/players.ts`); none in my files.
- Closure scanner not run (tsx not installed); membership from imports: all 5 source files reachable from root
  `run-rolling-forge-pipeline.ts`.

- Review fixes committed `a1235b83f` (parked-retry query excludes final rows; PP check reads 20 games at a time).
  Other importer suites 531/531 (+1 skip), closure/release suites 76/76, eslint clean. Typecheck 17:49Z exit 2 only on
  other lanes (`forgeDailyBridge.ts` uncommitted, `scripts/forge-build-admission.*` from `114494bf7`).
- Deferred PP body audited as `skipped` by the real `withCronJobAudit` (throwaway test, deleted).

## Next
Handed off to Chef: full report in the side-session notes folder, `forge-pipeline-fix-report.md`. Keep this diary
until release; the L2 Start Chart filter (read-paths lane) must ship with it.

## Blockers / approvals
- Possibly: editing `update-power-play-combinations/index.ts` (unowned).

## Gotchas
- PP writes are gated by `PP_STORED_CALCULATION_WRITES_ENABLED` (decision 152); `pp_team_game_clock` migration unapplied.
- Ingest default budget 270 s exceeds the 240 s function limit; pipeline passes no maxDurationMs today.
