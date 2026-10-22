# Handoff diary: fix-forge-team-strength

## 1. Scope
- Fix two confirmed FORGE team-context defects that Chef (local_4317ea20) handed off on 2026-10-19. The evidence is the "FORGE triage" entry in `tasks/sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md`, which records the RSO bridge author's (local_08a0bf1c) findings.
  1. **Inverted sign:** `teamGoalsForPctAdjustment` subtracted the opponent's xGA edge, so a leaky opponent defence lowered our expected goals.
  2. **Ambiguous priors:** `fetchTeamStrengthPrior` took `.limit(1)` on `nhl_team_data`, which had 3 rows per team for 2026-10-19.

## 2. Where
- Work was done in `/Users/tim/Code/fhfhockey.com` on `octoberBranch`. This session made no commits.
- It shipped in **R6a**, commit `3755308fa` ("Release R6a: resumable FORGE projection run and team-context fixes"). That commit is an ancestor of `origin/master` (`b630e0767`, R6f) and of `octoberBranch` (`392c02af2`). Local `master` is stale (`457435eb3`) and does not contain it.
- Files:
  - `web/lib/projections/calculators/team-context-adjustments.ts` (line 85)
  - `web/lib/projections/queries/team-context-queries.ts`: new `buildTeamStrengthPriorFromNhlTeamDataRows`; `fetchTeamStrengthPrior` uses it
  - `web/lib/projections/queries/team-context-queries.test.ts`
  - `web/lib/projections/runProjectionV2.test.ts`: sign test
  - `web/lib/projections/types/run-forge-projections.types.ts`: optional `TeamStrengthPrior.rowSelection`
- Note: `tasks/artifacts/forge-team-context-fix-2026-10-19/NOTE.md` (tracked)

## 3. State
- Both fixes are released (R6a, now on `origin/master`).
- Checks at the time, all passed:
  - Vitest over `lib/projections`, `lib/rosterScheduleData`, `lib/game-predictions` and `__tests__/pages/api/v1/db/run-projection-v2.test.ts`: 71 files, 1402 tests.
  - ESLint on the changed files: clean.
  - `npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock`.
- `runProjectionV2.test.ts` and `run-forge-projections.types.ts` currently show uncommitted diffs on `octoberBranch` (+69/−6). I did not check whose they are. They may belong to other sessions; this session did not make them after R6a.

## 4. Next
- None planned. This task is complete.
- The optional follow-up is in Blocked below.

## 5. Blocked / needs TJ
- **Optional view migration (ask-first: DB migration).** Fix the view at its root:
  - Join `nhl_team_data` on `ns.season = ls.season_id` and `ns.situation = 'all'`.
  - The code-side row choice then becomes a no-op safeguard.
- **Read-only SQL (not run).** NOTE.md has a query that confirms the 3 rows are NST seasons.
- **Stale bridge comment.** `forgeDailyBridge.ts` (~line 176) still says the sign is inverted. That file belongs to the RSO owner (local_08a0bf1c).

## 6. Insights
- **`nhl_team_data` is a VIEW, not a table, so nothing writes to it.** It is defined in `supabase/migrations/20260716112908_production_schema_baseline.sql:14118`.
  - It keeps `nhl_standings_details` rows for the global max date only.
  - It LEFT JOINs `nst_team_stats` on team abbreviation alone. That table's primary key is `(team_abbreviation, season)` (`:32167`), so the join yields one row per stored NST season. That explains the implied GP of about 70, about 82, and the current season.
- `nst_team_stats` is written by `web/pages/api/Teams/nst-team-stats.ts` (`seasonStats`), in the `update-nst-tables-all` cron group.
- **The view only ever shows the latest standings date.** A lookup for an earlier date (backtest or replay) finds no rows. It falls back to the latest row, which uses information from after that date. This is still unfixed.
- **Row rule:**
  - Take the latest date on or before the target date.
  - Choose the row where `xga/xga_per_game` is closest to `games_played`, within 1.5 games.
  - If no row is within 1.5 games, return null, so the model uses the baseline.
  - With no `games_played`, use a row only when it is the only one.
  - The RSO bridge uses a stricter margin (< 0.5). The two were not unified.
- **Effect of choosing the wrong row:** full-season `xga` saturates `sampleWeight` (÷280) to 1. A prior-season row therefore got full weight, while a current-season row gets about 0.16.
- **Sign fix scope:**
  - The only consumer of `teamGoalsForPctAdjustment` is `goalie-stage.ts:356`; the effect is at most ±4.8% × `sampleWeight`.
  - The RSO bridge uses `opponentGoalsForPctAdjustment` from a swapped call, so the fix does not change its output.
- `game-predictions/featureSources.ts` lists `nhl_team_data` as excluded (`no_go`) and never queries it.
- Gotcha: the full `npx tsc --noEmit` ran out of memory at the default heap. It needs `NODE_OPTIONS=--max-old-space-size=8192`.
