# FORGE reserve pass (plan B′): receipt, 2026-10-26

Lane: forge reserve pass, started by the orchestrator (`local_88650158`). Local, uncommitted, on octoberBranch. The orchestrator commits.
Nothing remote happened: no migration applied, no FORGE run, no cron or ETL invocation, no push, no deploy, 0 NST requests.

## TJ decisions (pop-ups, 2026-10-26)
1. **Marker:** a separate reserve table. Each row is bound to player, team, game, run, model version and conditioning. Goalie starting is kept distinct from skater dressing. Run admission is unchanged. A lineup line always wins (no double use).
2. **Payload:** full selected-horizon coverage. Raise the budget only after measuring. Never truncate silently or favour early games. Name the scope that is missing.
3. **Participation:** unknown (null) by default. No hard-coded 0.5 or 0.2 priors. Distinct evidence states. The optimizer counts a labelled conservative 0. Goalie start policy is separate.

## What changed
| File | Change |
|---|---|
| `supabase/migrations/20261027090000_forge_reserve_projections.sql` (new, **local only**) | Table `forge_reserve_projections`: PK (run, game, player, horizon); FKs to runs, games, players and teams. `player_class` is 'skater' or 'goalie'. `conditioning` is 'if_dressed' (skater) or 'if_starts' (goalie), enforced by a check. Also `reserve_reason`, `model_version`, the line columns, RLS public read and a service-role write. |
| `web/lib/projections/reserveProjections.ts` (new) | `forgeReservePassEnabled` (env `FORGE_RESERVE_PASS_ENABLED`, default off), `selectReserveSkaters`, `buildReserveSkaterLine`, `buildReserveSkaterRow` and `buildReserveGoalieRow`. A skater line uses the lineup pass's rate model on his own recent usage: TOI is recent, else season, else 620 s (F) or 900 s (D) at even strength and 0 on the power play. Assists come from the lineup's own on-ice environment, which is never changed. |
| `web/lib/projections/stages/skater-stage.ts` | Reserve pass after the team row is written. It covers each current-roster skater not in the lineup, with the reason as evidence: not_in_lineup, ruled_out, hard_stale or missing_recent_metrics. |
| `web/lib/projections/stages/goalie-stage.ts` | Each current goalie other than the selected starter gets his own "if he starts" line (`computeGoalieProjectionModel`, starterProbability 1), with no start chance. The goalie row and its wins are unchanged. |
| `web/lib/projections/stages/persistence-stage.ts` | `persistForgeReserveProjectionRows` (upsert on the PK). |
| `web/lib/projections/run-forge-projections.ts` | `forge_reserve_projections` added to `FORGE_AUDITED_INPUT_SOURCES` (FORGE's own output, not a fantasy source). |
| `web/lib/rosterScheduleData/forgeDailyBridge.ts` | Reads reserve rows (flag on; a failed read is stated). Rows from the team's latest run only. A reserve skater gets `conditionalStats` = the "if he dresses" line and `stats` = a labelled conservative 0. The exception is accepted news confirming him in this game's lineup, where the line counts in full. Evidence states per game: confirmed_lineup (appearance 1), confirmed_out (0), and the rest null: projected_lineup, projected_scratch, return_reported, uncertain, disputed, ruled_out_at_run, no_lineup_evidence, evidence_unavailable. Goalies use their own reserve line as the per-start source. A goalie with no start share gets `startProbability` null, a 0 count and the conditional line (`goalie:start_unknown`). Reserve rows are withheld all together when they don't fit, never only the late games. Expanded budget: **4 MB with the pass off (unchanged), 6 MB only with it on** (`FORGE_RESERVE_EXPANDED_BYTE_BUDGET`, applied when reserve rows are passed in, which the loader does only when `forgeReservePassEnabled()`). |
| `web/lib/rosterScheduleData/bridgeForecastWire.ts` | An optional 9th wire element (reserve code). The client rebuilds the note and the appearance probability exactly (lossless; round-trip tested). `fitBridgeWire` withholds every reserve row before any prefix trim. An old client skips 9-element rows. |
| `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts` (new) | The production-shaped league fixture shared by the payload test and the browser measurement. |
| `tasks/artifacts/forge-week-coverage-2026-10-26/measure/mobile/*` (new) | The offline browser measurement and its `results.json`. |
| Tests | `reserveProjections.test.ts` (new); `forgeReservePayload.test.ts` (new); additions to `forgeDailyBridge.test.ts` and `run-forge-projections.local-attempt.test.ts`. |

With the flag off (the default), every path is unchanged, including the 4 MB expanded budget. The full pre-existing suites pass, a legacy-mode bridge test asserts the unchanged path, and `forgeReservePayload.test.ts` asserts the budget: 4 MB off (lineup rows trimmed at 4 MB) and 6 MB on (every lineup row of a 5.9 MB fortnight kept).

## What the tests prove
- **Reserve rows never change lineup output, team totals, goalie rows or revisions.** In `local-attempt` the real producer runs through the fenced transport twice on the same roster: 2 extra skaters and a third goalie per club, pass off vs on. All rows of `forge_player_projections`, `forge_team_projections` and `forge_goalie_projections` are identical. The captured `outputHash` (game revisions / Start Chart publication) is identical. The run still proves external-input exclusion. The reserve table holds exactly 4 `if_dressed` and 2 `if_starts` rows, none of them in a lineup table.
- **No other reader can see them.** A `git grep` test allows exactly 4 source files that name the table: the writer, the source audit, the module and the RSO bridge. Start Chart, accuracy, team rows, game revisions (`starter_board_game_revisions` SQL) and every other reader cannot see reserve rows.
- **Every rostered player gets a weekly line.** `forgeReservePayload`: in a production-shaped league week, each player on an NHL roster has a forecast for every game of his team. Nothing is trimmed or withheld, and the compact wire rebuilds every row exactly.
- **Payload stays within budget.** Same test, with the budgets asserted below.
- **A strong reserve pickup stays among candidates, and his conditional value is never added into compared totals.** Test `keeps a strong reserve pickup among candidates…` in `forgeDailyBridge.test.ts` runs through the real current-read admission (`withCurrentPlanningRead`) and the planner's own candidate functions.
  - Setup: a reserve skater with an "if he dresses" line of 2 goals and 1 assist a game (8 points under the fixture scoring), no lineup news, and a rostered lineup skater leaving a second C slot open.
  - `candidateHorizonPoints` is **0**, not null. He is a known candidate, never "—".
  - `candidateActivePoints`, the full-plan gain from adding him, is **0**.
  - His forecast rows keep `conditionalStats` {GOALS 2, ASSISTS 1, POINTS 3}, `appearanceProbability` null and the label `skater:no_lineup_evidence` after admission, ready for the candidate card.
  - Control: with accepted news confirming him in both lineups, the same slot credits **16** (2 games × 8), so the open slot was usable and only the unknown participation held the value at 0.
- Bridge semantics: dedupe (lineup wins; an older run's reserve row is ignored), each evidence state, news for another game not carrying over, the goalie unknown start, an unreadable table stated, and legacy behaviour with the pass off.

## Payload measurement (`forgeReservePayload.test.ts`, offline fixture)
Fixture: 32 teams × (30 skaters + 4 goalies) + 58 teamless players = 1,146 players, against 1,065 in production on 10-26. It uses 64-hex revisions, numeric identity ids and uuid runs. Every skater has season totals, so every stat key is filled, and there is no lineup news, so every row carries the longest note. Per-row bytes are 1,769 overall and 2,059 for a reserve row.

| Horizon | Games | Player-games | Reserve rows | Expanded | Compact wire | Unpacked snapshot* | Result at 6 MB / 2.5 MB budgets |
|---|---|---|---|---|---|---|---|
| 7 days, typical (3 per team; production week had 47 games) | 48 | 3,196 | 1,316 | 5.65 MB | 1.71 MB | 6.08 MB | **full coverage** |
| 7 days, maximal (4 per team) | 56 | 3,808 | 1,568 | 6.74 MB | 2.04 MB | 7.17 MB | all reserve rows withheld, stated |
| 14 days, typical | 96 | 6,392 | 2,632 | 11.3 MB | 3.42 MB | 11.8 MB | reserves withheld; lineup trimmed as before |
| 21 days, typical | 144 | 9,112 | 3,752 | 16.1 MB | 4.88 MB | 16.6 MB | reserves withheld; lineup trimmed as before |

*Unpacked snapshot = forecasts + players + games, which is what the server stores and validates. The tightest unpacked check is the 8 MiB (8.39 MB) preservation backup, not the 10 MB save check. The 6 MB budget plus 0.43 MB of players and games leaves about 1.9 MB for workspace copies (local, history, journal), roster settings and selections; the test asserts at least 1.5 MB of that headroom. For a typical week the measured headroom is 2.3 MB. The response (wire + players + games) is about 2.1 MB against the 4 MB budget. Node rebuild time is about 3 ms per week.

Decode check: `expandBridgeForecasts`, the client-side rebuild, returns rows byte-identical to the server forecasts for every measured case: typical and maximal weeks, 14 and 21 days. It takes about 3, 4, 8 and 11 ms in Node.

### Browser measurement: decode, memory, save/reopen (mobile and desktop)
`tasks/artifacts/forge-week-coverage-2026-10-26/measure/mobile/` (`mobile.test.ts`, `entry.ts`, `vitest.config.mts`; output `results.json`). How it ran:
- Offline, in local Playwright Chromium. No Next server and no app routes, so none of :3000 or :3105 and no `.next` was touched.
- Every page request was aborted (network blocked), and only fixture data was used.
- The browser bundle holds the exact client code: `expandBridgeForecasts`, `packPlanningSnapshots` and `unpackPlanningSnapshots`.
- Fixture: the typical 7-day full-coverage week (3,196 player-games). The response body is 2.14 MB.
- Save = pack + `JSON.stringify` (the workspace PUT body). Reopen = `JSON.parse` + unpack. It was checked to be an exact round trip.

| Profile | Parse | Expand | Save | Reopen | JS heap used after decode / after save+reopen | Heap allocated (max) |
|---|---|---|---|---|---|---|
| Mobile: Pixel 7 emulation, 4× CPU throttle | 12 ms | 23 ms | 178 ms | 29 ms | 10.4 MB / 21.2 MB | 31.4 MB |
| Desktop Chrome, no throttle | 3 ms | 5 ms | 43 ms | 7 ms | 8.0 MB / 20.5 MB | 33.2 MB |

The saved body is 2.14 MB packed, and the reopened snapshot 6.08 MB unpacked. Mobile bounds asserted: decode under 2 s, save + reopen under 4 s, heap under 250 MB. Heap figures are CDP samples taken after each step, not a continuous peak; the allocated size bounds the peak.

Not measured, and listed below as activation gates:
- a physical phone, Safari or WebKit;
- the full RSO page (React render and planner evaluation over the expanded rows);
- the real save/reopen through `/api/v1/roster-schedule-optimizer/workspace` (auth, schema validation, database).

## Checks
- vitest, affected set (`lib/projections`, `lib/rosterScheduleData`, `lib/rosterScheduleOptimizer`, `lib/in-season`, `lib/player-forecasts`, the RSO, start-chart, projections and forge API tests, RSO components):
  - **Final run (after the budget split, on HEAD 595ab13d9 plus this work): 169 files, 4,627 tests passed (1 skipped) in both UTC and America/New_York.**
  - Earlier runs: a UTC planner performance timeout and another lane's mid-edit file passed on isolated rerun.
- Browser measurement (`measure/mobile`): 1 test passed (above).
- **eslint:** clean on every changed file.
- **tsc (whole project)** under `/private/tmp/fhfh-heavy.lock` (noclobber, waited, never stole; 12 GB heap):
  - First run: 1 error, in my `bridgeForecastWire.ts` tuple. Fixed.
  - Second run: 3 errors, all in another lane's in-flight `game-predictions` work (`__tests__/pages/nhl-predictions.test.tsx` ×2, `lib/game-predictions/featureBuilder.test.ts` ×1). 0 errors in reserve-pass files.
  - Run after the candidate test (2026-10-26T16:41Z): exit 0.
  - **Final run (2026-10-26T17:50Z, after the budget split and fixture extraction): exit 0, no errors.**
- **Producer closure** (files changed inside it): `stages/skater-stage.ts`, `stages/goalie-stage.ts`, `stages/persistence-stage.ts`, `run-forge-projections.ts`, and the new `reserveProjections.ts`.
  - `scripts/verify-forge-release-sha.ts --worktree` (re-run on HEAD 595ab13d9 with this work applied): **VERIFIED, 0 findings**, closure `c1f0129aca9b2520cbd922cf81c292661b1499fa50b024f76ca6283d362cc4aa`, 194 modules, 21 dynamic table sites. Receipt: `tasks/artifacts/projection-table-audit-2026-10-26/release-verification/closure-c1f0129a….json`.
  - The allowlist was not edited; the orchestrator re-verifies at integration.
- **Reverted:** an early edit to `run-lifecycle-queries.ts` (resume cleanup of reserve rows) and its resume test. That file is on the orchestrator's hold list, and the edit created an unreviewed dynamic table site. Both diffs are now empty.
  - Impact: after a resumed run, a killed attempt's reserve rows can linger. The bridge ignores them, because a lineup line wins and a reserve row must match the player's current team.
  - Follow-up: add `forge_reserve_projections` to `clearRunGameRows` with a resolvable literal loop, once the file is free.

## Migration status
- File: `supabase/migrations/20261027090000_forge_reserve_projections.sql`. That is the same `supabase/migrations/` tree as the existing FORGE tables (`forge_player_projections` and `forge_goalie_projections` are defined in `20260716112908_production_schema_baseline.sql`).
- **Not applied anywhere.** No local or hosted database was touched, there was no `supabase db push`, and no MCP `apply_migration`. The generated types are unchanged; the writer and the reader use an untyped table name.

## Before activation (each needs TJ's approval)
0. **Unmeasured gates:**
   - decode, memory and save/reopen on a physical phone (Safari or WebKit);
   - the full RSO page render and planner evaluation with full reserve coverage, on mobile and desktop;
   - the real workspace save/reopen through the authenticated API and database.
   The offline Chromium numbers above cover only the client decode and pack/unpack code.
1. Apply the migration **before** setting `FORGE_RESERVE_PASS_ENABLED=true`. With the flag on and no table, the run's reserve write fails. The bridge would report that the reserve rows could not be read.
2. Set the flag in the FORGE run environment and in the web environment the bridge runs in. The first validation run needs TJ's explicit approval.
3. Expected cost per diagnosis: about 50–60% longer runs (resumable), about 500 more rows a day, 0 NST requests, and one release build when authorized.

## Count-0 decision (settled)
The orchestrator's condition is "unknown, never 0". TJ's pop-up answer allowed a labelled conservative 0: "unsupported reserves may contribute zero guaranteed starts as a conservative planning assumption, clearly labeled—not a claim of zero chance."
- Implemented: participation null, a labelled 0 plan contribution, and the conditional line kept.
- Why: a null per-game value would blank whole-team totals and comparisons again (planning.ts:398-406, :924, :960-962; candidatePlanMetrics.ts:165).
- The orchestrator found TJ's answer verbatim in the transcript and accepted it (2026-10-26). Switching to null later would be one change in `emitReserve` (forgeDailyBridge.ts).

## Follow-ups (not done here)
- Resume cleanup of reserve rows in `clearRunGameRows` (held file; see Checks).
- **RSO UI:** skaters show no "if he dresses" value yet. `gameForecastPoints` (planning.ts) and `ForecastPoints` show "if starts" for goalies only. The data, label and conditional line are all in each forecast. Those files belong to the RSO-MANUAL lane.
- **Payload architecture:** for windows over about 7 days, or a maximal week, reserve rows are withheld, with a statement. Full coverage there would require separating refreshable forecast data from the saved snapshot, or loading it in chunks (TJ's fallback option). That is a separate RSO workspace task.
- **Participation estimator:** a tested, qualified dress/start-probability model, which TJ asked for as separate work.
- Yahoo free agents with no NHL roster spot are still outside RSO's player set (diagnosis item 6).

## File hashes (sha256)
- `supabase/migrations/20261027090000_forge_reserve_projections.sql` c30269fa9db05dcadac0b88863ad46e25edc73b517df181adadeb6595b96dd04
- `web/lib/projections/reserveProjections.ts` bccbc958a18f038da03a514437fe1ca2a813e4c0d14d50e9fcf0c08ac4e44c5e
- `web/lib/projections/reserveProjections.test.ts` 45d2d70f84940243b2ccb28c567e295f93241ebec70bdd9d85c6333597e2cf21
- `web/lib/projections/stages/skater-stage.ts` b36f1e0057d00bd38187f6c959c061ae206f0637987a7659ddb191cd314a78e8
- `web/lib/projections/stages/goalie-stage.ts` f2ad75738abec2e601e05815d5cab4b5497f8d04b0761ad0a5c1e7d5bb18f1da
- `web/lib/projections/stages/persistence-stage.ts` 64bdab989990433cbb16a010f0f5b5ed416df29e12f8c90e083ad2c0527852d6
- `web/lib/projections/run-forge-projections.ts` a9de1e2600d2c375c3a3dd42bccc8806a5fca63a5d1a8b02e7d306d81edac9a2
- `web/lib/projections/run-forge-projections.local-attempt.test.ts` 7a6899b191d573469af14bcfab2bba234e570d70c4cb14be6cda39b88f529af3
- `web/lib/rosterScheduleData/forgeDailyBridge.ts` e23601f5bcaf239550003d339c01ab8c8863f349f5367d0117be8833b0533db8
- `web/lib/rosterScheduleData/forgeDailyBridge.test.ts` 4bedd609998fa7ad23c48af1842bb1d6223cd32e22b9de7691606418bec341b4
- `web/lib/rosterScheduleData/bridgeForecastWire.ts` af37b0d644248b75ceaded767bd551bb8652800aea79c84ee7a206731c8ff2f4
- `web/lib/rosterScheduleData/forgeReservePayload.test.ts` f85d140959950cb813bf84dea303bd1e850ba31b87c07b8b06077aa1e81b91a1
- `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts` 3d682137ac927a7c8742e1a43997ce2f9bce5f8356a1c48c09e5c5baf0609592
- `tasks/artifacts/forge-week-coverage-2026-10-26/measure/mobile/mobile.test.ts` ff12c451fc5622ff912a3c178c581eba3381af117dd41a2d6991c9c747cb372f
- `tasks/artifacts/forge-week-coverage-2026-10-26/measure/mobile/entry.ts` ecbca3cdf324e4968dd3baf976d234dc9445d0360c9b1fdb098fdc5b352beeeb
- `tasks/artifacts/forge-week-coverage-2026-10-26/measure/mobile/vitest.config.mts` a8fe051930648ee96868f5ceaa76ee76289e67ebb8261ea5b5da35cf79003322
- `tasks/artifacts/forge-week-coverage-2026-10-26/measure/mobile/results.json` 973042845942e8e98c8b53ee4f03bbd80f6482ea968f19aab729f7b2d2ed44c0
- `tasks/diaries/2026-10-26-claude-forge-reserve-pass.md` b8dd08ed9f05e7dad34813fd294d36e16f7302812fbd65a10ba79bf5ea686308

The final checks are listed under Checks. The diary hash is as of this receipt; the diary may change later.
