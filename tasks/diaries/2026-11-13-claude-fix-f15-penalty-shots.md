# F15: penalty shots all-situations only (Astra AF-07, decision 149)

## Scope
- One shared event-strength adapter so the derived builder uses the canonical classifier; penalty shots (1010/0101 outside the shootout) count in no ES/PP/PK bucket.
- Oriented fixtures (home/away shooter); shootout still excluded; ordinary 5v5/PP/PK unchanged.
- Read-only count of affected 2026-27 games; rebuild PLAN.md (not run).
- Owned: `web/lib/supabase/Upserts/nhlStrengthState.ts`, `web/lib/projections/derived/situation.ts`, `web/lib/projections/derived/buildStrengthTablesV2.ts`, their tests, `master/production/penalty-shot-rebuild-2026-11-13/`.

## Where
- Branch `octoberBranch`, checkout `/Users/tim/Code/fhfhockey.com`. Base HEAD 4046bbe92.

## State
- 15:05 UTC: read AF-07, decision 149, L1 notes. Classifiers compared: identical for every code except a side with 0 skaters (canonical null, derived `es`).
- Read-only DB count (pg_stat_activity 0 active first): 2026-27 `pbp_plays` non-SO penalty-shot events = 8 events in 8 games (2 goals: 2026020065, 2026020131; 6 SOG: 2026020094, 2026020101, 2026020119, 2026020150, 2026020159, 2026020203). All 8 games have stored derived rows (2 team, 38 player). No OT penalty shots.

## Gotcha (needs a decision)
- `forge_player_game_strength` / `forge_team_game_strength` only have ES/PP/PK columns. Readers sum them as the all-situation total (`homepageGameAnalytics.ts:388` SOG pair, `splitsServer.ts:493`, `:746`). Moving penalty shots out of ES drops them from those sums. Carrying them needs new columns + a new `persist_projection_game_derived_v1` migration (strict jsonb_to_recordset lists, ~lines 2900-3400 of 20260720105524).
- Canonical parity (`nhlEventInclusion.ts` `includeInParity`) excludes penalty shots from parity "all" too: separate from this lane; note as follow-up.
- Exposure: penalty clock ignores penalty shots (`penaltyClock.ts:179` goal does not release; observedAdvantage needs >=3 skaters; PS typeCode has no units). Zero elapsed time.

## Decision (TJ pop-up ~15:20Z)
- Tonight: shared adapter + offline tests only. Builder not switched, no rebuild, AF-07 open in the builder.
- After freeze: one coordinated rollout (ps columns, transactional persistence, every ES+PP+PK reader, version/coverage marker, goal/save/miss/shootout tests, official-record game list); migration + deploy order + rebuild plan back to TJ for separate approval.

## Done (2026-11-13)
- 8463912d8: `classifyEventStrengthBucket` in nhlStrengthState.ts; tests in nhlStrengthState.test.ts and situation.test.ts (pins builder gap on 2026020065 / 2026020094).
- a0bb197cb: `master/production/penalty-shot-rebuild-2026-11-13/PLAN.md` (DRAFT, not approved).
- Checks: 17 test files / 269 tests passed (strength, normalization, parity, inclusion, raw gamecenter, derived, ingest/shifts, build-projection-derived route); `npm run typecheck` exit 0; ESLint exit 0 on changed files.
- No STRENGTH_VERSION bump (normalized output identical).
- 2025-26 count: 33 events / 33 games / 6 goals; 15 games with derived rows.

## Next
- Post-freeze rollout per PLAN.md, after Chef staffs it (touches unowned persistence, readers, migration).

## Rollout code (Chef, ~17:05Z: TJ approved starting the rollout; code now, each production step to TJ)
- Migration `supabase/migrations/20261113200000_forge_strength_penalty_shot_split.sql` (NOT applied): shots_ps/goals_ps/penalty_shot_split_version + CHECK on both tables; new RPC persist_projection_game_derived_v2 (generated from v1 by an anchored script, then reviewed); v1 = sql wrapper over v2 (legacy rows), so a code rollback can't double-count.
- PG15 proof `supabase/tests/f15_penalty_shot_split.py` RESULT OK (19 checks); rollback `supabase/tests/f15_penalty_shot_split_rollback.sql` refuses while split rows exist.
- Gotcha: generator first doubled the PS upsert assignments in the player upsert (goals_pk anchor matched twice); the proof caught it (42601).
- Builder uses classifyEventStrengthBucket (null -> ps); assisted PS goal refused; persistence -> v2; route gameId filter; readers: homepage SOG (fail closed), splits goals/shots (lenient). Algorithm version deliberately unchanged (queue would rebuild all history).
- Runner `production/penalty-shot-rebuild-2026-11-13/ps-rebuild.py` (dry run default, --execute) + 7 offline tests.
- Read-only (guard 1 active / 0 s): stored pbp penalty shots = the 8 exactly; all 8 legacy totals equal stored official boxscores (SO winner's extra goal removed).
- Checks: 12 affected files 128 tests + 48 dependent files 627 tests passed; typecheck exit 0; ESLint exit 0.
- Blocked: authority row. Order 147 = Codex item6 20261113190000 (c89ff5d24) is unregistered, so supportedBaselineMigration.test.ts already fails; asked Chef (a: I register 147+148, b: owner registers 147 first). Mine would be 148 pending.
- Parity (includeInParity "all") proposed as session card F15b (task_d63d7128); can't start sessions from a Chef-triggered turn.

## Next
- Authority row 148 after Chef answers; then report SHAs + ship order (migration -> code -> rebuild).
- Chef chose (a): 2a9227343 registers 147 (Codex item 6, pending, held) and 148 (mine, pending); test counts 148/8 pending; super-goal summary 148. Authority tests pass (29). SHAs sent to Chef.
- Chef: fix parity "all" here if small. Done: nhlEventInclusion `includeInAllSituationsOnly` (non-SO PS goal/SOG/miss); nhlNstParityMetrics counts it in `all` only (individual + goalie all), no strength split/on-ice/xG; includeInParity stays false. 5 tests fail on the old code (verified by restoring HEAD sources temporarily), pass now; Upserts + underlying-stats 75 files / 674 tests pass; ESLint 0. F15b card dismissed.
- Gotcha: the underlying-stats landing reads stored summaries (formula revision 2), so the 8 games need a bounded summary refresh after release (not planned yet; don't bump the revision).
- 8a4a7d8d1 committed (parity fix + PLAN note); Chef's later "uncommitted" message had crossed it. Chef applied migration 148 at 17:28:45Z (05a2843e6). Next: code release, then ps-rebuild.py dry run -> --execute (TJ approval), then plan the 8-game summary refresh.
- Summary refresh planned (Chef, after #437 b6d43efdc live 17:42Z; rebuild --execute run by Chef): SUMMARY-REFRESH.md + summary-refresh.py (dry run default, --max-games 1 first) + 6 offline tests. Player partitions 1,176 append-only rows, goalie partitions 376 upserts; revision stays 2; team summaries unaffected (shot-feature based; separate gap flagged). Not run.
- Chef's dry run stopped at 094 (stale heads). Diagnosis: 18 pre-existing orphan heads in 6 games (threeOnThree in regulation games; EN partitions pre decision 84; written 10-14..11-09, no formula revision); landing reader skips them; builder no longer writes them. Runner now names orphans, requires them unchanged, expects rowsUpserted = current partitions (1,158). Dry run rerun 17:56Z: DRY_RUN_OK (b6d43efdc); goalie expected lines equal official boxscores (150 differs by its EN goal). 8 offline tests OK.
- Team summaries (TJ spec via Chef): 84b013054 builder counts PS once in allStrengths (shooter CF/FF/SF/GF-if-scored, opponent CA/FA/SA/GA), not ES/PP/PK/xG/chances; route gameIds= + diff=true (dry run only). Boxscore-fixture tests (131 goal, 101 save, 094 away save + SO) fail on old code; 40 files / 299 tests; typecheck 0; ESLint 0. No team version column -> no revision bump; 2025-26 33 PS games stay old unless rebuilt. a7b91faf8 TEAM-REFRESH.md + team-refresh.py (diff default, --execute per game) + 6 tests. Nothing run.
- Strict read-only diff (TJ via Chef): team rebuild audit contract skipAuditWhenNoOp for a clean dry run; route test fails on old wrapper; team-refresh deploy gate checks the marker. Committed (see git log).
- A3-02 (Astra P2, offline): run-unique "x" evidence files + planned-only preflight in summary-refresh, team-refresh (approved diff create-once), ps-rebuild; 29 offline tests. Plan docs (SUMMARY-REFRESH/TEAM-REFRESH/PLAN.md) still cite the old file names (not in the ticket's file list).
- A3-02 follow-up: execute-path resume tests (team, ps) driving main(--execute) with stubs; 31 offline tests. Runners unchanged.
- A3-02 TJ extra bar: team execute-path diff call dry-run check (exit 2); tests (a) pending-only diff vs original approved, (b) changed diff exit 6 with no write; 33 offline tests.
- A3-02 exact bar: both team stop tests assert no write call, no added snapshot (glob before/after), done + approved byte-identical; dryRun-missing subtest added; 33 offline tests.
