# FORGE team-context fixes — 2026-10-19

Local and uncommitted. These are model-behaviour changes, so the release needs TJ's approval.

## Files changed

| File | Change |
| --- | --- |
| `web/lib/projections/calculators/team-context-adjustments.ts` | `teamGoalsForPctAdjustment` now **adds** `opponentDefenseEdge * 0.24`, so a leaky opponent defence raises our goals. |
| `web/lib/projections/runProjectionV2.test.ts` | New test: a leaky opponent gives a positive adjustment and a stingy one gives a negative adjustment. |
| `web/lib/projections/queries/team-context-queries.ts` | New exported `buildTeamStrengthPriorFromNhlTeamDataRows`. `fetchTeamStrengthPrior` reads up to 20 rows and lets that function choose. |
| `web/lib/projections/queries/team-context-queries.test.ts` | Four tests for the row choice. |
| `web/lib/projections/types/run-forge-projections.types.ts` | Optional `TeamStrengthPrior.rowSelection` (additive; this file also has unrelated uncommitted `resume` lines from another session). |

## Row selection rule

1. Keep only the rows for the latest `date` that is on or before the target date. If no row is that early, use the latest date overall, as before.
2. If `games_played` is greater than 0, choose the row whose `xga / xga_per_game` is closest to `games_played`, within 1.5 games. The margin allows a one-day NST lag. If no row is within the margin, return `null`, which means the baseline: no prior is better than a prior-season prior.
3. If `games_played` is missing, use a row only when it is the only row for that date.
4. The returned prior records `rowSelection: { method, candidateRows, gamesPlayed, impliedGamesPlayed }`.

The RSO bridge uses a stricter margin (`< 0.5`). These were not unified because the bridge file is out of scope.

## Root cause: `nhl_team_data` is a view, so nothing writes to it

In `supabase/migrations/20260716112908_production_schema_baseline.sql:14118`:

- The view takes `nhl_standings_details` rows for the **global max date** only.
- It then runs `LEFT JOIN public.nst_team_stats ns ON ns.team_abbreviation = ls.team_abbrev`, with **no `season` or `situation` filter**.
- `nst_team_stats` has the primary key `(team_abbreviation, season)` (`:32167`), so each team gets one row per stored NST season. That explains the 3 rows: implied GP of about 70, about 82, and the current season.
- `nst_team_stats` is written by `web/pages/api/Teams/nst-team-stats.ts` (`seasonStats` → `nst_team_stats`), which runs under the `update-nst-tables-all` cron group in `pages/api/v1/db/cron-report.ts`.

Other consequences of the view:

- It only ever shows the latest standings date. Any lookup for an earlier date (backtests, replays) finds no rows and falls back to the current row, which uses information from after that date. This is unchanged by the fix.

## Other readers

- `web/lib/game-predictions/featureSources.ts` lists `nhl_team_data` only as `excluded` / `no_go` and never queries it, so no change was needed.
- `forgeDailyBridge.ts` already filters by implied GP. It uses `opponentGoalsForPctAdjustment` from a swapped call rather than `teamGoalsForPctAdjustment`, so the sign fix does not change its output. Its comment at about line 176, which calls the sign inverted, is now stale. The bridge's owner should update it.
- The goalie stage (`goalie-stage.ts:356`) is the only consumer of `teamGoalsForPctAdjustment`. Goalie win context moves by at most ±4.8% × `sampleWeight`.
- The skater stage only fetches priors, so its effect comes through the row-selection fix.

## Read-only SQL for Chef (not run)

```sql
-- Confirms that the 3 rows are NST seasons, and which one the fix would choose
select d.team_abbrev, d.games_played, ns.season, ns.gp,
       round((d.xga / nullif(d.xga_per_game, 0))::numeric, 2) as implied_gp
from public.nhl_team_data d
join public.nst_team_stats ns
  on ns.team_abbreviation = d.team_abbrev and ns.gp = round(d.xga / nullif(d.xga_per_game, 0))
where d.team_abbrev in ('TOR', 'BOS')
order by 1, 3;
```

## Verification

- Vitest: `lib/projections`, `lib/rosterScheduleData`, `lib/game-predictions`, and `__tests__/pages/api/v1/db/run-projection-v2.test.ts`. 71 files and 1402 tests passed.
- ESLint on the five changed files: clean.
- `npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock`: passed. It needed `NODE_OPTIONS=--max-old-space-size=8192`; the default heap ran out of memory.

## Release list

1. The five files above. Commit only these hunks in the types file; leave its `resume` hunk with the session that owns it.
2. TJ approves the model-behaviour change: goalie win context (sign) and team priors for goalies and skaters (row choice). Projections change from the next FORGE run.
3. Optional follow-up, which needs a DB migration and is ask-first: fix the view itself. Join on `ns.season = ls.season_id` and `ns.situation = 'all'`. Then the code rule above becomes a no-op safeguard.
