# Nov 21 daily forecast recovery: exact bounded plan

recovery-plan lane (fork of Chef), 17:45Z Nov 21 (11:45 CST). **Plan only.** No writes, route calls, resets or NST requests were made. Evidence: code at `096b78b62` (exported tree; identical to `f47905d28` for every file cited here except `update-nst-gamelog.ts` and the closure registry), plus production SELECTs logged in [QUERY-LOG.md](QUERY-LOG.md).

## Recommendation: Option B, one scoped projection run, no reset
- **One request**: `GET /api/v1/db/run-projection-v2?date=2026-11-21&gameIds=<unstarted ids>&maxDurationMs=210000`, cron-secret Bearer, `no-store`.
- Then **resume calls only if needed**: if the answer is 207 `operationStatus:"partial"`, repeat the identical request (same date, same gameIds). The route reuses the same `run_id` for scope `h1:<ids>` and projects only unfinished games (`run-projection-v2.ts:60-66`). Stop after at most 3 calls.
- **No deploy dependency.** This route doesn't touch the NST off-day code. It can run on current production `f47905d28` (producer closure `cdf87b73…` registered) or on `096b78b62` if that ships first (closure `0446100e…` registered). Evidence that `f47905d28` runs are proven: the 0359 live run on it was read by the Daily reader at 17:25Z. Readers prove uncaptured runs by release attribution against these registered closures (`externalInputProof.ts:185-195`).
- **No reset** of the exhausted `daily_incremental:2026-11-21` scope. The pipeline is not invoked.

### Game list (from api-web schedule, read 17:3xZ)
| Game | Start (UTC) | In the request if issued by… |
|---|---|---|
| 2026020359 EDM@CAR | 18:00 | **never** (started; live record `f55203dc` stays the server) |
| 2026020360 CHI@CGY | 20:30 | ≤ 20:10Z |
| 2026020361 BUF@FLA, 2026020362 PIT@NSH | 23:00 | ≤ 22:40Z |
| 2026020363–2026020369 (7 games) | 00:00 Nov 22 | ≤ 23:40Z |
| 2026020370 ANA@UTA | 02:00 Nov 22 | ≤ 01:40Z |
| 2026020371 MIN@VAN, 2026020372 SEA@SJS | 03:00 Nov 22 | ≤ 02:40Z |

- Rule: include a game only if its start is ≥ 20 min after the request is sent. The route answers within 225 s; up to 3 calls fits in 12 min, leaving 8 min margin.
- **At 19:40Z: 13 games recoverable** (`2026020360,…,2026020372`). **At 20:00Z: still 13.** After 20:10Z, 0360 drops (12 games). After 22:40Z, 10 games.
- **Latest safe start for the full 13: 20:10Z.**

### Bounds
- One date (2026-11-21); `gameIds` ≤ 13 (route cap 16, `run-forge-projections.ts:498`); `maxDurationMs=210000` (route cap).
- Expected writes:
  - 1 new `forge_runs` row (`execution_scope.mode=selected_games`, `requested_game_ids`=the list, resume `scope_key` `h1:2026020360,…`);
  - rows in `forge_player_projections` / `forge_team_projections` / `forge_goalie_projections` under that **new** `run_id` only, about 36 skaters per game (live 0359 run: 36 player, 2 team, 2 goalie rows for 1 game), so about 470 player, 26 team and 26 goalie rows.
- No goalie step: `goalie_start_projections` already has 66 rows for all 14 games, updated 09:30:07Z today (Q-goalie), and the projection route doesn't refresh them.

### Before-image (take immediately before the request, read-only)
- `select run_id,status,git_sha,created_at,metrics->'execution_scope' from forge_runs where as_of_date='2026-11-21'`: expected exactly 1 row, `f55203dc…` succeeded, `selected_games [2026020359]`.
- `select count(*) from forge_runs where as_of_date='2026-11-21' and status='running'`: expected 0. A running row means another writer exists; **stop**.
- `select count(*) from forge_player_projections where as_of_date='2026-11-21'`: record it (live run rows).
- The production deployment SHA (`f47905d28` or `096b78b62`) must equal a registered closure commit.

### Stop conditions (zero writes, or a clean stop)
- **Preflight FAIL** → 422 before any run row is created (`run-projection-v2.ts:1566-1612`). Report the failing gates and do **not** retry with `bypassPreflight`.
- Error `Rolling skater history read incomplete: …` (dependency error): stop. No retry.
- A 207 with `resume.runId: null` (step still holding the lease): wait for lease expiry; at most 1 more call, then stop.
- If any listed game starts within 20 min of the next resume call: **stop resuming**. Don't shrink `gameIds`: that changes the scope key and starts a second run. The finished games are served; unfinished games stay unforecast.

### Revert
There is nothing to revert in place: the run writes only rows under its new `run_id`. If the run is wrong, marking it non-succeeded removes it from both readers (they read `status='succeeded'` only: `start-chart.ts:897-905`, `forgeDailyBridge.ts:886-887`). That is a separate production write needing TJ approval, so propose it; don't do it.

## Answers to the six questions

### 1. Missing inputs for source date Nov 19
| Stage | Status for Nov 19 inputs | Evidence |
|---|---|---|
| `projection_input_ingest` (pbp, shifts) | **Complete.** Runs on its own 09:45Z cron, independent of the pipeline. | Q1: `canonical:2026-11-19` complete (cursor 2026020358, 2026-11-20 09:45:14Z); `canonical:2026-11-20` complete 2026-11-21 09:45:01Z. Q3: pbp_games 12/12, shift_charts 12/12. |
| `contextual_builders` (lines, PP) | **Complete** via standalone crons. | Q3: lineCombinations 12/12, powerPlayCombinations 12/12. |
| `rolling_player_recompute` | **Complete** (TJ-approved bounded rerun 11:44–11:54Z). | 2,160 rows, 0 null game_id (Chef diary). |
| `projection_relationship_build` + `projection_derived_build` | **11/12 games.** The standalone 10:25Z derived build (6 runs in 4 days) upserted 10 Nov 19 games today; 0358 was done Nov 20. It **deferred 2026-11-19** because of game **2026020357** (SEA 55 vs VAN 23): `input_manifest: Projection input and relationship manifest is not complete for game 2026020357`. | Q4, Q8 |
| Goalie start priors | **Fresh** for all 14 Nov 21 games (09:30Z). | Q-goalie |

- **Consequence:** a Nov 21 forecast will **not** silently lack Nov 19, except game 0357's derived strength rows. VAN (0371) and SEA (0372) will project from derived history up to their previous game.
- The preflight `skater_derived_freshness` gate uses a 7-day window (`run-projection-v2.ts:640-682`), so it still passes for VAN/SEA. This is a **known degradation**, not a block.
- Fixing 0357 needs the relationship build (`shift-charts`) and a derived rerun. That is outside this recovery: it is the same 0357 data that failed the Nov 19 live capture. List it as a follow-up.
- The 0359 live run's `data_quality.missing_pbp_games: 1` is metric-level for its own run. It is not evidence about Nov 19 ingest, which Q3 shows complete.

### 2. Option A: one-row reset + one pipeline GET (rejected)
- The scheduled run is an implicit window (no date params → `useDurableProjectionBacklog`, `run-rolling-forge-pipeline.ts:1832-1844`), source = run date − 1 = Nov 20 (`:225-243`).
- After resetting `upstream_skater_sources`, stages 2 → 8 run in order:
  - NST off-day skip (needs `096b78b62`);
  - WGO for Nov 20 (0 games);
  - contextual builders: line combos in recent-gap mode `count=10`, PP skipped for 0 games (`:943-970`);
  - rolling for Nov 20;
  - ingest and derived on their **durable backlog cursors** (no dates, `:1146`, `:1195`);
  - relationship `gameId=all`;
  - then `projection_execution`: goalie step plus `run-projection-v2?date=<d>` for the run date **and each days-ahead date** (`:1244-1290`, `FORGE_PROJECTION_DAYS_AHEAD`), **with no gameIds**.
- **Three blockers:**
  1. **Displaces 0359.** A full-slate run for 2026-11-21 includes started 0359. A newer full-slate run becomes the date's base and supersedes every older run in both readers (`start-chart.ts:936-952`, `forgeDailyBridge.ts:893-903`), so the live 0359 record stops being served, replaced by a forecast computed after puck drop.
  2. **Likely re-blocks at stage 7.** The durable derived backlog still holds deferred 2026-11-19 (0357 manifest). The 10:25Z build returned `success:false` on exactly that, so `projection_derived_build` would fail before execution.
  3. **Broader blast radius.** Days-ahead dates, line-combo and rolling writes, plus a production-state reset, all needing the deploy first.

### 3. Option B: no reset (recommended)
- **Request list:** the single `run-projection-v2` above. Nothing upstream needs rerunning: every input is present except the 0357 derived rows (§1).
- **Write targets:** a new `forge_runs` row plus projection rows keyed by the new `run_id` (`run-forge-projections.ts:535-545` creates or claims the run id).
- **Duplicate prevention:**
  - **Resume scope:** `claimResumableRun` reuses only a *running* row with the same scope key `h1:<sorted ids>` (`run-lifecycle-queries.ts:193-199`), and `hasPausedResumableRun` checks `status='running'` with that key (`run-projection-v2.ts:535-551`).
  - **Live row is never reused:** the live row is `succeeded`, has resume `scope_key` null and carries `pregame_publication` (Q7).
  - **Identical calls resume the same run, so no double run:** repeating the identical request is the resume mechanism.
  - **Changing `gameIds` mid-recovery would start a second run**, so the plan forbids it (stop instead).
- **Idempotency of a retry after a lost response:** the next identical call resumes the running row or finds it succeeded. **Before any retry, read `forge_runs` for the date first. Never blind-retry.**

### 4. Reader choice
- **Rule in both readers:** newest first; a selected_games run serves only its own games; stop at the newest full-slate run (`start-chart.ts:936-952` + `keepRowsOfServingRun`, `externalInputProof.ts:277-288`; `forgeDailyBridge.ts:893-903`). Only succeeded, released, proven runs count.
- **Now:** the only 2026-11-21 run is the live `f55203dc` (`selected_games [2026020359]`, Q7), so readers serve only 0359 from it, and 13 games have no forecast. Astra's 11:06Z readback (0 skaters) predates the 17:25Z publish.
  - Note that Start Chart's candidate query doesn't apply `excludePregamePublications`; only `runs/latest` and `apiHelpers` do. Start Chart therefore serves the pregame publication for 0359. That looks consistent with H3 but isn't verified live here.
- **After recovery:** newest = recovery run (selected_games, 13 ids), then live run (selected_games, 0359), and no full-slate run.
  - **Per game:** 0360–0372 come from the recovery run, 0359 from the live run.
  - 0359 is left alone, provided the recovery run is proven (attribution to a registered closure). If it is unproven, both readers withhold it: Start Chart's `withheld` count and the bridge's `withheld` list.

### 5. `invalid_row` risk
- The reader throws `invalid_row` when a player's latest rolling row inside the lookback lacks `game_id`/`season` (`skater-queries.ts:337-341`, `hasRollingGameIdentity` `:208-210`). The lookback is at most 1100 days, 1095 on the long-absence path.
- **Q6 census:** across *all* players, rows with `game_date > 2026-11-21 − 1095 d` have `null_or_bad_game_id = 0` and `null_season = 0`; latest date 2026-11-19. So no reader window for any of the 13 games can hit the Nov 17–19 failure mode.
- **Supporting:** the 0359 live capture read the same history on `f47905d28` at 16:20Z and qualified.

### 6. Summary
- **Recommendation:** Option B, about 1–3 identical calls, 1 date, 13 gameIds, no reset, no pipeline call and no deploy dependency.
- **Recoverable games:** 13 at 19:40Z and at 20:00Z. Latest safe start 20:10Z.
- **Acceptance**, after the call:
  - the new run is `succeeded` with `execution_scope.requested_game_ids` = the 13;
  - projection rows exist for the 13 games;
  - Start Chart GET 2026-11-21 shows skater rows for those games and still 0359 from `f55203dc`;
  - the daily RSO GET shows forecasts for unstarted games, with `withheld` = 0.

## Follow-ups (not in this recovery)
- 2026020357 relationship/derived manifest gap: SEA/VAN degraded and the derived backlog stuck on 2026-11-19. It will also re-block any full pipeline run at stage 7.
- Decide whether Start Chart should apply `excludePregamePublications` (product decision, not a defect claim).
