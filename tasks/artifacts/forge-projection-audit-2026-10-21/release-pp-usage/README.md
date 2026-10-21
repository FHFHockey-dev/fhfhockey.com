# Power-play usage fix ("pp1", official PP targets) — release patch for master (TJ-cleared 2026-10-21)

**Decision (TJ, this session, pop-up):** "Clear pp1; patch it" — treat the top-decile PPP/G calibration shift as an exposed compensating error (halved PP assists), not a regression.

**Patch:** `PP-USAGE-OFFICIAL-TARGETS-master.patch` — base `origin/master` **56fb03fef** (R18); 6 files, +360/−34; sha256 `c301b5ec953259df838476c59feca99d8881fa392d649bdaccf8f4ff58599b69`. `git apply --check` passes on a pristine archive export. Ported from octoberBranch `e316db4c0` with identical hunks (offsets only).

## What it changes
- `web/lib/projections/queries/team-context-queries.ts`: `fetchTeamStrengthAverages` reads `toi_pk_seconds`; new `fetchTeamOfficialPpUsage(teamId, asOfDate)` — the team's last 10 regular-season games (`games.type = 2`), WGO per-player rows by `team_abbrev`: team means of summed PP TOI, all-situation TOI, PP shots, and each player's mean PP TOI over the games he played; null under 3 games.
- `web/lib/projections/stages/skater-stage.ts`: team PP share = official PP TOI ÷ official TOI (fallback: strength table with PK in the denominator); team PP shots reconciled to the official average; PP minutes allocated in proportion to each player's official last-10 PP TOI (fallback: rolling PP TOI), role no longer a multiplier; PP minimums only with a PP unit; `pp_opportunity` persists `target_source`, `allocation_evidence`, `legacy_team_pp_target_seconds`.
- Tests: team-context-queries, runProjectionV2, startChartPipeline (role-only allocation no longer moves PP time), nativeGoalAccounting (cache stubs).

## Checks on the patched master export
Vitest `lib/projections` + bridge + Start Chart: 53 files, 1,166 → 1,174 tests, 0 failures; eslint clean; `tsc --noEmit` (8 GB heap, under the lock) exit 0. Every column the new query uses exists in the generated schema (`games.type/homeTeamId/awayTeamId/date`, `teams.abbreviation`, `wgo_skater_stats.team_abbrev/game_id/player_id/pp_toi/pp_toi_per_game/pp_shots/toi_per_game`).

## Evidence
`../pp-usage-verdict.md` and `../pp-overprediction-diagnosis.md` (TJ-approved read-only S5–S8): team PP targets ran 26–29% above actual because `forge_team_game_strength` (shift-chart totals) over-counts PP time 38% and PP shots 19%; pp1 brings target/actual to 1.06, PP TOI bias +24.8 s → +4.8 s (RMSE −33 s), PP shots and PP goals bias/RMSE better, PPP RMSE −0.009; top-decile PPP 1.047 → 1.140 and G 1.050 → 1.083 (accepted by TJ).

## Release notes
- **Replay:** input captures recorded before this change cannot be replayed against it (three new reads and a changed `forge_team_game_strength` select; `inputCapture.ts` throws "Unrecorded projection input"). Live runs and `suppressWrites` reconstruction are unaffected.
- One extra bounded read set per team per run (games, teams, ≤400 WGO rows), cached per team and date.
- **Measured on octoberBranch inputs.** The release session found master's reader does not hydrate the pruned rolling fields (finding 1 of `../forge-model-release-inventory.md`); the PP-usage change does not depend on those fields (it reads WGO), but the cohort's PP goals/assists came from octoberBranch runs. The master-mode reconstruction backtest now running will report pp1-relevant heads on master inputs too if TJ wants it.
- The PP half of the assist refit stays on HOLD (top-decile PPP over-predicted by 29% when added).
