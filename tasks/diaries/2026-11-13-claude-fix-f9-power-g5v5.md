# F9 — Team power ratings 5-on-5 goaltending (decision 145)

## Scope
Decision 145 (BA W1-4 B D9): goaltending component of team power ratings switches from NST all-situations rows to NST 5-on-5 rows, labelled "5-on-5 goaltending". GA, SA, xGA and exposure (TOI) all from one 5-on-5 scope. Other components, weights, headline unchanged. Missing/incomplete 5-on-5 inputs stay unknown (no fallback, no zero-fill). No production loop; plan + script for TJ.

## Where
- Branch `octoberBranch`, checkout `/Users/tim/Code/fhfhockey.com`.
- Code: `web/lib/power-ratings.ts`, `web/pages/api/v1/db/update-team-power-ratings.ts`, readers TBD.
- Plan: `tasks/artifacts/calculation-inventory-2026-11-10/master/production/power-g5v5-2026-11-13/PLAN.md`.

## State
- 13:xx UTC start. Current goalie component = `xga60_ewma - ga60_ewma` from `nst_team_gamelogs_as_rates` (situation all) → includes EN goals.
- Per-game 5-on-5 source: `nst_team_gamelogs_es_counts` / `_es_rates` (situation `5v5`, NST sit=5v5). `nst_team_5v5` is a different (season-to-date) table already read but ignored by `buildGenuineTeamGames`.

- EN verification (read-only, pbp `nhl_api_pbp_events` goals with goalie_in_net_id null): 102 EN goals / 93 team-games 10-01..11-12. NST all GA = pbp total GA 93/93; NST 5v5 GA = pbp 1551 GA 93/93 (incl. the one 0551 5-skater EN goal, OTT 10-06); SA 85/93 exact, 8 ±1; 5v5 TOI < all TOI 93/93.
- Coverage: es_counts rows = as_rates rows (2,538 in 05-02..11-12), 0 incomplete.
- Code: `power-ratings.ts` goalie_5v5 inputs from `nst_team_gamelogs_es_counts`; window must be complete else null; version → `team-power-v4-5v5-goaltending`. Labels: TeamPowerTerminal (+scss col 84px), TeamPowerCard, teamRatingNarrative, teamRatingsService doc. Tests pass (power-ratings*, writer, terminal, narrative...). New tests fail on HEAD (checked by swapping file, restored).
- Sample: harness in scratchpad f9/sample.ts reproduces stored v3 to 1e-14; v4 vs v3 goalie r 0.75–0.82; others identical.

- Commits: 06c8316a4 (code+tests), 4ed451bd3 (plan folder). typecheck exit 0; ESLint 0 errors; 156 vitest pass.
- Loop script `--preflight` tested read-only 14:49Z (1,440 v3 rows, 45 dates), test run/ output deleted. Final-verification block tested from a scratch copy with calls disabled.
- Report + landing patch in shared notes: F9-report.md, F9-landing-goaltending-label.patch (applies to HEAD after F10's b2d777ac9).

## Next
- Landing label applied with Chef approval: 820e5cb6d (16/16 landing tests, ESLint clean). F9 code work complete.
- Production loop: TJ approval + release live; not run by F9.

## Round 2 (Chef 15:0x UTC, TJ "Fix in v4, then rebuild")
- buildGenuineTeamGames: only gp = 1 rows are games (gp 82 season totals 04-17..06-30 and gp 20-24 on 2025-10-06 excluded; null gp not counted). Dead nst_team_5v5 query removed. Writer v4 doc covers both changes; version string kept.
- Regression test (gp 82 + null-gp rows before season start not counted) fails on HEAD, passes now. 55 tests across 12 files pass; ESLint clean.
- Sample rerun (6 dates): other components move most early (finishing/danger up to ~27 pts on 09-29), within 4 pts by 11-12; goalie r 0.72-0.81.
- Loop: done-rule per date = 32 rows, v4 = teams with gp=1 game in 150-day lookback (10/15/25/31 then 32 → 1,393), goalie known, 0 v3. 47 carried legacy rows (09-28, source 08-29) on 09-29..10-02. Preflight retested 15:02Z read-only.

## Blockers / approvals
- Production 45-call loop needs TJ approval (not run by this lane).

## Gotchas
- nst_team_gamelogs_* hold 1,920 gp=82 season-total rows dated 2026-05-02..06-30 (2025-26); the 150-day lookback treats them as games (pre-existing, flag to Chef).
- Existing `nst_team_5v5` fetch filters situation='all' but the table only has '5v5' → always empty (dead, left alone).
- Game predictions baseline model uses homeMinusAwayGoalieRating (team power goalie_rating) → definition shift; flag, not changed.
- pg_cron 283 already wrote 11-13 as v3 at 10:15Z.

## Round 3: read-only preflight (Chef + TJ, decision 150), 16:05–16:20Z
- Scope: preflight only. No route calls, no production writes; the 46-call rebuild waits for TJ.
- Deployed: GitHub deployment 7769867793, sha 496ab3766, Production, success 16:01:06Z. Writer and library blobs identical to d6626b521. Source evidence only; the alias was not checked live.
- `--preflight --end 2026-11-13` at 16:08Z: backup `run/issued-rows-2026-09-29_2026-11-13.tsv`, 1,472 rows, all v3; 46 calls; 1,425 v4 and 47 carried rows expected.
- The 47 carried keys (22/17/7/1) each have only gp = 82 rows in the lookback; last genuine game 04-09..04-16. None can be recomputed. Each carries its 09-28 row (`legacy_unversioned`, 08-29). No slide-out cases; no team codes outside the 32 teams; 618/618 genuine games have complete 5v5 inputs.
- Readers: none surface the version or source date, and the "5v5" label is wrong for carried legacy goalie values. Reported, not fixed.
- Script: the done rule now requires every carried row to equal its 09-28 snapshot exactly, and each real run writes a pre-run snapshot. Tested on a 09-28 scratch preflight and on the real preflight.
- Gotcha: `fetchAllRatings` uses `.lt(date, D)`, so the carry chain depends on ascending order. Starting at 09-30 would carry the v3 09-29 row; the readback would stop it (v3 left / carried mismatch).
- Next: commit PREFLIGHT.md, the script, PLAN.md, the queries and run/; report to the Chef. Then hold.

## Round 4: Astra #434 P1 rebuild gate (for release #435), 16:15–16:35Z
- Writer `2bf3c1d26`: `dryRun=true` with `date` computes one date, returns rows with labels, writes nothing, leaves no audit row on success.
  - Checks: 10/10 writer tests; 90/90 across 4 suites; both new tests fail on the old writer; ESLint clean.
  - Typecheck exit 2, only from F16's uncommitted `normalizers.ts`.
- Runner `f2d275f8e`: fail closed. In order: verified backup, 47-key manifest (`carry-manifest.tsv`), no-write probe on 2000-01-01, dry runs of 09-29 and 11-12, served `/api/team-ratings` labels; then writes with key-by-key readback; final check fails on any mismatch.
- Tests: local preflight against an isolated `next dev` on port 3108 passed (`PREFLIGHT_OK`). Five negative cases each stopped as designed. Server stopped by PID; :3000 untouched.
- Not tested: the write path (needs approval).
- Expected stops on production until #435 ships: stop 7 at the probe, then stop 6 at the served check until F16 is live.
- Gotcha: the old writer ignores `dryRun` and would write. The probe date has no data within the writer's windows, so even the old writer writes no rating (one audit row only).

## Round 5: cron timing and deployment gate, 16:30–16:40Z
- Cron 283 `15 10 * * *` is active. The next run is 2026-11-14 10:15 UTC (05:15 ET). Its last 3 runs only queue the call (~30 ms); the route itself takes ~3.5 s at 10:15:01–10:15:06.
- Other jobs that mention the table, 277 and 281, are inactive. No Vercel cron, workflow or other app code writes the table.
- Guard window 09:25–11:00 UTC (04:25–06:00 ET), with a 15-min start margin. The runner checks the live cron schedule at start and before the snapshot.
- Deployment gate: GitHub's latest successful Production deployment must be in master's history and its writer source must have the dry-run markers. Releases are squash-merged, so the gate checks the source, not ancestry.
  - Tested: production stops 7 at `496ab3766` with no request sent; the localhost path passes; the window arithmetic passes 14/14.

## Round 6: Astra #435 P2, stale window check (17:00Z)
- `write_gate()` checks the window before the DB guard and again after it returns (the guard can sleep 120 s), right before each write.
- Call margin 15 min (no write 09:10–11:00 UTC); start margin raised to 25 min, so a started run (~8 min) ends before the call margin.
- New `test_power_g5v5_loop.py` (fake clock, guard and stop; loaded from the runner via ast): 6/6 pass. They fail on 9f58e0423.
- The untracked `run/pre-run-20261113T164613Z.tsv` is TJ's rebuild output; not mine, not committed.
