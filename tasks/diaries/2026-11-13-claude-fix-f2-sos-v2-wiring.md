# Diary: follow-up lane F2, SOS v2 wiring (Claude, 2026-11-13)

## Scope
Brief: `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/FOLLOWUP-LANES-2026-11-13.md` Lane F2 (+ `_COMMON.md`, `L12.md` SOS row, L12 diary).
- Route the writer `/api/v1/db/update-team-sos` (pg_cron 365, 09:12Z) and its readers through `computeDescriptiveSos` (descriptive-sos-v2, decision 21: past = final only, started/postponed pending).
- Versioned output; v1 `sos_standings` rows kept as issued history (rule 21). NHL API usage at or below today's.
- Write a bounded production recompute plan; do not run it. Code only: no production reads/writes, NHL calls, deploys or pushes.

## Where
octoberBranch, sole checkout. Contract actually lives at `web/lib/trends/strengthOfScheduleContract.ts` (brief said `lib/teamRatings/`).
Owned: contract, `web/lib/trends/strengthOfSchedule.ts`, `web/pages/api/v1/db/update-team-sos.ts`, readers `web/pages/api/v1/trends/team-sos.ts`, `web/pages/statsPlaceholder.tsx` (SOS block), `web/components/TeamLandingPage/StrengthOfSchedule.tsx`, SOS block of `web/pages/trends/placeholder.tsx`, `SosResponse` type in `web/lib/dashboard/dataFetchers.ts`, their tests, the new migration + authority row.
Not mine: `web/lib/underlying-stats/teamScheduleStrength.ts` (landing SOS reader, underlying-stats) -> ticket to Chef.

## Findings
- v1 writer: `gameDate <= currentDate` counts today's unplayed games as past; opponents' records include head-to-head; NHL calls = 32 club schedules + 1 standings GET per date (usually 2 dates).
- Contract needs event-level results. Club schedules already carry gameState, scores, gameOutcome, startTimeUTC, so v2 needs only the 32 schedule GETs (standings GETs dropped).
- No actual game-end or result-known timestamps exist in the source. Precedent `lib/player-cards/currentNhl.ts`: "FINAL/OFF at observation; current window only; no historical cutoff claim". So v2 computes only the current cutoff (run time); a result is known from the fetch that showed it final. No honest historical backfill -> v2 history accrues from the first run.
- Views: past = `past-retrospective` (opponents' records as of cutoff, as v1 did), future = `future`. Both metrics (win%, points%) and direct + indirect stored; Q6 (metric, 2:1 weighting) is still open, so no new weighting is chosen.
- Contract cost: record() re-parses timestamps per game per call; a full season x 32 teams x 2 metrics x 2 views would be billions of regex parses. Optimise inside the contract (pre-parse, memoise records) with outputs unchanged.
- Shared-file clash with F1: both add a migration -> `migration-authority.json`, `supportedBaselineMigration.test.ts` counts, `super-goal-final-summary.md`. Messaged F1 (go first, order 144; mine 145 after).

## State / checks
- Start: read brief, _COMMON, L12 brief+diary, decisions 21/93, BA W1-4, audit D7, readers. No Codex claim on my paths (CODEX-TO-CLAUDE tail). Claim `CLAUDE-FIX-F2-CLAIM-20261113` appended to CLAUDE-TO-CODEX.md.

## Next
Contract optimisation; adapter + row builder; writer; readers; failing-first tests; migration after F1 commits.

## Blockers
Waiting on F1's migration order before touching the three shared migration files.

## Checkpoint 1 (2026-11-13) — contract, writer, readers coded
- Contract: timestamps parsed once, records memoised by (team, at, excluded). Equivalence vs original on a synthetic season (scratchpad, 1312 fixtures, all 3 views x 2 metrics): 0 mismatches; full writer workload 1.6 s (original ~15 s for ONE team's 6 calls).
- New `web/lib/trends/teamSosSnapshot.ts`: club-schedule adapter (FINAL/OFF at observation, scores + lastPeriodType required, CNCL dropped, PPD kept -> pending if started, conflicting/incomplete finals pending and counted), cutoff = after last observation, row builder (both metrics, direct + indirect, past-retrospective + future, pending_games with state).
- Writer: 32 schedule GETs only (standings GETs dropped); `?start=` -> 400 (no honest backfill); upsert `team_sos_daily` on (season_id, snapshot_date, team_id, sos_version); snapshot_date = America/New_York date of cutoff (nhlCalendarDate, import only).
- Readers: team-sos API (latest v2 snapshot, labelled sosVersion/pastView/definition/cutoffAt, unknown stays null, combined = fixture-weighted mean, ties by team), statsPlaceholder + StrengthOfSchedule component ("—" for unknown, header label), trends/placeholder SOS block (reads winPct; tooltip says final games + pending; fixed "(points %)" mislabel), dataFetchers SosResponse type.
- Writer test `__tests__/pages/api/v1/db/update-team-sos.test.ts` 5/5 pass; on the original route 5/5 FAIL (old past = BOS,CGY,CBJ,CAR,CHI vs BOS,CGY; 2 standings GETs; ?start=200).

## Checkpoint 2 (2026-11-13) — readers tested, migration written (parked)
- team-sos API test: 3 new tests pass; on the original reader 3/3 FAIL (served the v1 row). strengthOfSchedule.test +2 (v2 rankings; fail on HEAD: helper absent). Writer test +1: row keys == migration columns.
- Checks: 41 files / 372 tests pass (dataFetchers, useDashboardData, trends index, cron-audit-wrappers, lib/underlying-stats, lib/trends, trends API). ESLint 0 errors (3 old <img> warnings). typecheck EXIT 2 only from F1's uncommitted `pages/api/v1/start-chart.ts` (ctpiVersion); my files clean.
- Migration `20261113170000_team_sos_daily_v2.sql` (team_sos_daily + sos_standings v1 freeze trigger) + rollback + proof `supabase/tests/f2_team_sos_daily_v2.py`: RESULT OK on local PG15. Parked in scratchpad so F1's authority test (144 rows) isn't broken; goes back as order 145 after F1 commits 144.

## Checkpoint 3 (2026-11-13) — commit A
- c894bb616: contract, adapter, writer, readers, tests, mailbox claim (13 files; no attribution). Migration-column test held back (needs the migration file).
- Production steps, landing ticket and Q6 questions: shared notes `F2-sos-v2-production-steps.md`.
- Waiting (background until-loop, 60 min cap) for F1 to commit order 144; then commit B = migration (order 145) + rollback + proof + authority row/counts/summary (scratchpad `add_f2_authority.py`) + column test. Report to Chef at local_016832c1-... after B.

## Checkpoint 4 (2026-11-13) — commit B, done
- F1 committed 144 (197612873, d8efc67a5). 244645342: migration 20261113170000 (order 145 pending), rollback, PG15 proof (RESULT OK), register counts 145/10 pending, summary line, writer column test.
- Checks: supportedBaselineMigration 21/21; SOS suites 44/44; npm run typecheck EXIT 0; ESLint clean.
- Next: report to Chef (local_016832c1-...). Production steps + landing ticket in shared notes F2-sos-v2-production-steps.md. Nothing applied or run in production.
