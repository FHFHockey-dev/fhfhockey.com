# C3 receipt — today's cron failures, offline reproduction

- **Lane:** C3, artifact-only. No source edits, no Git writes, no live logs, database, provider or cron calls. Patches are **not applied**.
- **Base:** canonical checkout `octoberBranch`. Work started at HEAD `9d4996033`. Codex committed `1ee5127dc` at 10:24 EDT during the run. Every pinned file still matches its pin (sha256 prefix): `calculate-wigo-stats.ts` f438eb12, `normalizeDependencyError.ts` 6bc3d986, `planningInputs.ts` 8193aa5d, `recurring.ts` e876ef82.
- **Production equivalence:** the release is `origin/master` `0619f9126`, which includes #380 `b3f9a7e25` (10/25 00:40 EDT). These files are byte-identical to it: `calculate-wigo-stats.ts`, `planningInputs.ts`, `forgeDailyBridge.ts`, `recurring.ts`, `normalizeDependencyError.ts`, `run-projection-accuracy.ts`, `update-player-underlying-stats.ts`, `nhlRawGamecenter.mjs`, `playerStatsRefreshWindow.ts`, `run-forge-projections.ts` and `calibrationEligibility.ts`. The local `forge-served-forecast-snapshot.ts` differs from the release only in the order of its export wrappers; its logic is identical.
- **Input:** the email text TJ pasted, kept in [EMAIL-EXCERPT.md](EMAIL-EXCERPT.md). All rows are fabricated. The only real identifiers are the public NHL IDs from the email.

## Decision matrix

| # | Report | Verdict | Reproduced offline | Proposed action |
|---|---|---|---|---|
| a | WiGO: invalid or duplicate appearance for player 8476368 | **Invalid stored input, rejected on purpose.** A design defect makes it worse: one bad row aborts the whole run. | Yes. The exact message appears for 4 legacy-row variants. Controls cover both clean frames and a bad row that sits outside the frame. | Run one live read first to name the bad row (L-a1). Then choose: repair the data (separate approval), or apply the optional per-player quarantine patch. |
| b | Normalization writer busy for 2026020179 and 2026020171 | **Expected lock contention, by design.** Nothing was committed. **Actual latent defect** in the recovery path. | Yes. The exact 502 body appears for both games, and no summaries are written. Source checks prove one global lock key and the trigger fan-out. The watermark skip is shown with a fake clock. | Patch `C3-b-incremental-recent-holes.patch`. Then read L-b1–3 to check whether the two games have recovered. |
| c | Latest succeeded forecast excluded for missing or legacy provenance | **Deliberate safety exclusion, working as designed.** It now repeats every day by construction. | Yes. The exact 422 message appears for the provenance production writes today. The opt-in label is the only way past the gate. | No code patch. Product decision for TJ/Codex (see c). |
| d | Planning-read deadline exceeded (2m 20s) | **Guard failed closed, as designed, but time was spent outside any deadline.** The slow stage is not identifiable offline (**evidence gap**). | Yes. Exact 500 body. Fake-clock tests cover the deadline, cancel and partial-page controls. | Diagnostic-only patch `C3-d-snapshot-stage-timing.patch`. Read the audit row (L-d1). |

Tests: `tests/*.test.ts`, **36/36 passed** ([c3-tests.log](c3-tests.log)). Retained repository controls, run read-only: 7 existing files, 212/212 passed. They are `calculate-wigo-stats.test.ts`, `update-player-underlying-stats.test.ts`, `nhlRawGamecenter.test.ts`, `apiHelpers.test.ts`, `run-projection-accuracy.test.ts`, `forge-served-forecast-snapshot.test.ts` and `planning.test.ts`. Not run: `tsc`, lint and the full suite. The patches have not been type-checked.

Run the C3 tests from `web/`:

```bash
npx vitest run --config ../tasks/artifacts/today-plan-2026-10-25/C3/c3.vitest.config.mts
```

---

## (a) WiGO — `GET /api/v1/db/calculate-wigo-stats`, 04:50 EDT, <1 s

**Evidence**
- The throw is at `web/pages/api/v1/db/calculate-wigo-stats.ts:318`. It fires when any of the player's last 20 `games_played = 1` rows fails one of these checks:
  - non-null game ID;
  - `^{seasonStart}02\d{4}$` (regular season only);
  - `season_id` consistent with the game ID;
  - no duplicate game IDs.

  Any single failure aborts the whole route (500) for **every** player.
- **This guard is new in release #380** (00:40 EDT). The 04:50 run was the first scheduled run after the release, which fits a latent data problem surfacing for the first time. The "last success: Unknown" in the email cannot separate this from the off-season pause.
- The identity constraints on `wgo_skater_stats` were added `NOT VALID` (`supabase/migrations/20260814020808_harden_wgo_game_identity.sql`) and no migration ever validates them. Legacy rows are therefore never checked. The legacy writer `web/lib/supabase/Upserts/fetchWGOskaterStats.js` stamped `season_id: currentSeason` from the run date and wrote no game ID.
- The retained live evidence (`tasks/TASKS/wigo-charts-audit/LIVE-EVIDENCE.md`, Sept 19) shows **20252026 clean**: 0 missing IDs, 0 duplicates. Older seasons were not checked.
- **Inference (not proven):** 8476368 has few appearances, so their 20-game window reaches a pre-2025 legacy row. The player list is unordered, so a failure after <1 s just means this player happened to be processed early.

**Tests** (`tests/a-wigo-appearance.test.ts`)
- Released code reproduces the exact email message for four row types: null game ID, run-date season label, postseason ID, and duplicate ID.
- Controls: a clean frame passes, and a legacy row more than 20 games back is never read.
- Blast radius: a clean second player gets **no** writes.

**Proposed patch (optional, needs a decision):** [C3-a-wigo-per-player-quarantine.patch](C3-a-wigo-per-player-quarantine.patch).
- The same check runs, but a rejected player gets no career and no recent writes. Every other player is written.
- The run returns `207 {success:false, error, rejectedPlayerIds}`, so the audit still reports a failure.
- Tested: the rejected player is never published, and clean runs are unchanged (200).
- Tradeoff: the rejected player's existing `wigo_recent` row stays stale. That already happens for every player today.
- It does not weaken the check or skip rows inside a frame. The data repair stays a separate, approval-gated backfill.

## (b) Writer busy — `POST /api/v1/db/update-player-underlying-stats?gameId=2026020179&warmLandingCache=true`, 06:10 EDT, 2 s, 6 failures

**Evidence**
- **Caller.** The trigger `public.on_new_player_underlying_stats` POSTs to that exact URL through pg_net on every home-team `lineCombinations` insert (`supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:60-90,129-132`).
  - The FORGE pipeline cron runs `5,10,…,55 10 * * *` UTC (06:05–06:55 EDT, `web/vercel.json`). Its `contextual_builders` step runs `update-line-combinations` before `projection_input_ingest` (`web/lib/rollingForgePipeline.ts`).
  - So every game from the night before fires its own concurrent request at the same moment.
- **Lock.** Every write statement on the three normalized tables (and raw capture) takes **one global** try-lock, `hashtextextended('fhfh:normalization-direct-writer',0)`, and raises `NHL_NORMALIZATION_WRITER_BUSY` instead of waiting (`20260722010355_…sql:105-117`).
  - The competing writer is the pipeline's `ingest-projection-inputs`, through `persistCapturedGameNormalization`, plus the sibling trigger requests.
- **Retry.** Raw capture retries a busy rejection once, after at most 500 ms (`web/lib/supabase/Upserts/nhlRawGamecenter.mjs:1128`).
  - Only the BEFORE-statement rejection is retried, so nothing was committed and the normalization manifests stay stale.
  - The route then returns 502 "failed for every requested game" (`update-player-underlying-stats.ts:253`).
- **Verdict:** expected contention. The guard is correct and must not be weakened.
- **Actual defect (latent, source-proven): recovery.**
  - Nothing retries a trigger-fanned request.
  - The incremental selection (`web/lib/underlying-stats/playerStatsRefreshWindow.ts:130`) starts at the **latest covered date**. Once any later game gets a summary, an earlier uncovered game is never selected again.
  - Tonight's trigger requests will cover the 10/25 slate, so 2026020171 and 2026020179 drop out of incremental catch-up for good.
  - The `update-player-underlying-stats-yesterday` job is defined in pg_cron, not in the repo, so its mode is an **evidence gap**. It was UNKNOWN in this briefing anyway.

**Tests** (`tests/b-normalization-writer-busy.test.ts`)
- Exact 502 body for each game, with no summary writes.
- Control: the same URL succeeds once the lock is free.
- Source assertions: the global key, the trigger URL, the shared writer and the retry budget.
- Fake clock: the same-day watermark still covers the holes (control), and the next-day watermark skips them (**defect**).

**Proposed patch:** [C3-b-incremental-recent-holes.patch](C3-b-incremental-recent-holes.patch).
- Selection also includes **uncovered** finished games from the last 7 days.
- Covered games in between are not re-fetched, so NHL fetches grow only by the number of real holes.
- Tested: the holes are reselected, a hole older than 7 days is not, and the no-hole case is unchanged.
- It does not touch the lock, retries or schedules.
- Codex should still choose 7 days. A postponed game would show up as a failed retry for 7 days.

## (c) Provenance exclusion — `POST /api/v1/db/run-projection-accuracy?projectionOffsetDays=0`, 07:30 EDT, 15 s

**Evidence**
- `run-projection-accuracy.ts:1724-1734` throws a 422 when `evaluateForgeCalibrationEligibility` rejects the latest succeeded run's `metrics.input_provenance`.
- **Release #380 added a second requirement**: `external_fantasy_input_contract = "excluded_from_native_inputs_v1"`. It was absent at the 10/22 release `d4c2632d3` and present at `b3f9a7e25`/`0619f9126`. That explains the 10/24 07:30 success and the 10/25 failure.
- The label is **opt-in only** (`calibrationEligibility.ts:21-29`). All three production write sites in `web/lib/projections/run-forge-projections.ts` (lines 518, 595, 651) call `buildForgeInputProvenance()` without it.
- The gate's own test says this is intentional (`web/lib/projections/apiHelpers.test.ts:79`): "stages still blend external fantasy priors; that provenance must stay ineligible."
- The existing route test stamps the opt-in label (`__tests__/pages/api/v1/db/run-projection-accuracy.test.ts:106`), so it never sees what production actually writes.
- **Verdict:** deliberate safety exclusion. It is not a code defect. **It will fail every day** until FORGE stages stop blending external fantasy priors and a pipeline earns the label.
- The same predicate makes `start-chart` flag `unverified_projection_provenance` for every run (`web/pages/api/v1/start-chart.ts:1479-1586`). That is consistent, but it is visible to users. Codex/FORGE owns it.

**Tests** (`tests/c-forecast-provenance.test.ts`)
- Exact 422 message for both production-shaped and legacy-empty provenance, with no data writes. The mocked audit row is excluded from the write check.
- Control: the opt-in label passes the gate.
- Static checks: no production opt-in exists, and the intent comment is present.

**No patch.** Removing the requirement would weaken a guard without evidence. Open decisions for TJ/Codex:
1. Accept the daily 422 as a known blocked state. Optionally have the cron briefing show this 422 under "Worth a look", not FAIL. That is a reporting change outside these pins.
2. Pause this job's schedule until FORGE is eligible. That is a schedule change, so it needs approval.
3. Prioritise the FORGE work that removes external priors.

## (d) Planning-read deadline — `/api/v1/db/forge-served-forecast-snapshot`, 08:32:40 EDT, 2m 20s

**Evidence**
- `PlanningReadDeadlineError` comes only from `pages()`/`withinDeadline()` in `web/lib/rosterScheduleData/planningInputs.ts`. The route's catch returns `500 {success:false, date, error}`, and the email shows exactly that.
- Every read is deadline-bounded:
  - the route's fixed `start + 45 s` (`forge-served-forecast-snapshot.ts:32`);
  - `loadPlanningInputs`'s **own fresh** `now + 8 s`, which ignores the route deadline (`planningInputs.ts:127`, call site `:36`);
  - the bridge's `min(deadline, now + 6 s)`.
- Reads alone cannot account for **140 s**. The work outside any deadline is the ledger upserts (`:83`, `:102`) and the synchronous CPU builders (`buildForgeDailyBridgeForecasts`, `buildLedgerRows`).
- So some stage spent about 95 s or more outside a deadline, and the next read threw on entry. The error does not say which stage it was.
- The same briefing reports a degraded database that morning: the cron report's own source query exceeded its deadline, and 12 jobs were UNKNOWN or possibly killed at 240 s. That fits but is **unproven**.
- `recurring.ts` (pinned) feeds `roster_optimizer_team_games` freshness. That only adds limitations in `hasScheduleCoverage`; it never throws this error, so it is not on the failure path.
- **Verdict:** the guard failed closed as designed (no ledger rows written). The slow stage is an **evidence gap**. No defect is proven.

**Tests** (`tests/d-planning-read-deadline.test.ts`, fake clock)
- Partial page: page 2 stalls, the read rejects at the deadline, and no partial rows are returned.
- Cancel: the in-flight signal is aborted.
- Control: a complete 1,500-row read succeeds.
- A spent budget throws on entry and issues zero reads.
- `loadPlanningInputs` reads even when the caller's budget is long gone.
- Released route: 95 s spent in the planning stage gives exactly the email's 500 body and no ledger writes.

**Proposed patch (diagnostic only):** [C3-d-snapshot-stage-timing.patch](C3-d-snapshot-stage-timing.patch).
- The same failure and the same zero writes. The 500 body adds `stage` (where it threw) and `stageMs` (time spent per stage).
- Tested: `{day_games:0, planning_inputs:95000, forge_bridge:0}`, `stage:"forge_bridge"`.
- No budget, guard or schedule changes.
- Passing the route deadline into `loadPlanningInputs` is left out on purpose. It would change failure frequency, so it should wait for the stage data.

---

## Bounded live-check proposals (NOT run; each needs TJ's separate approval)

All are single read-only SQL statements run with `set statement_timeout` as stated. None writes, triggers a cron or fans out. Run them in sequence, concurrency 1, and stop after L-a1 if it already answers (a).

| ID | Purpose | Query | Rows | Timeout |
|---|---|---|---|---|
| L-a1 | Name the rejected row | `select id, date, game_id, season_id, games_played from wgo_skater_stats where player_id = 8476368 and games_played = 1 order by date desc, game_id desc limit 20;` | ≤20 | 5 s |
| L-a2 | Confirm the identity constraints were never validated | `select conname, convalidated from pg_constraint where conname in ('wgo_skater_stats_game_id_required','wgo_skater_stats_game_identity_valid');` | 2 | 5 s |
| L-a3 | Size the legacy problem (optional; full scan) | `select season_id, count(*) from wgo_skater_stats where games_played = 1 and (game_id is null or season_id is distinct from (game_id/1000000)*10001+1 or (game_id/10000)%100 <> 2) group by season_id order by season_id;` | ≤25 | 15 s |
| L-b1 | Pin the `-yesterday` job's mode (URL only, never the headers) | `select jobname, schedule, substring(command from 'https?://[^''[:space:]]+') as url from cron.job where jobname = 'update-player-underlying-stats-yesterday';` | 1 | 5 s |
| L-b2 | Have the two games recovered? | `select game_id, count(*) from nhl_api_game_payloads_raw where season_id = 20262027 and endpoint = 'landing' and source_url like 'derived://underlying-player-summary-v2/%' and game_id in (2026020171, 2026020179) group by game_id;` | ≤2 | 5 s |
| L-b3 | Normalization state of the two games | `select game_id, status from nhl_api_game_normalization_status where game_id in (2026020171, 2026020179);` | ≤2 | 5 s |
| L-c1 | Confirm the stamped provenance | `select run_id, as_of_date, created_at, metrics->'input_provenance' as input_provenance from forge_runs where status = 'succeeded' and as_of_date between '2026-10-23' and '2026-10-25' order by created_at desc limit 6;` | ≤6 | 5 s |
| L-d1 | Recorded timing for the failed snapshot | `select run_time, status, details->'timing' as timing, details->>'statusCode' as status_code from cron_job_audit where job_name ilike '%forge-served-forecast-snapshot%' and run_time between '2026-10-25T12:28:00Z' and '2026-10-25T12:35:00Z' order by run_time limit 3;` | ≤3 | 5 s |

L-d2 (optional) is one Vercel runtime-log lookup for that route between 12:30 and 12:33 UTC, read-only. It is only useful once the stage-timing patch exists. Without it, the logs carry only the stack trace.

**Recovery is not asserted.** Any repair of 2026020171/2026020179 must be a separately approved single-game rerun, and only after L-b2/L-b3 show the games are still missing. So must any repair of legacy WGO rows, which is a backfill.

## Out-of-scope observations (not fixed)

- `calculate-wigo-stats.ts:1288,1332`: upsert errors are only logged, and the run still returns `success: true`. A failed write is silent.
- `calculate-wigo-stats`: batches of 200 are upserted inside the loop. A player rejected after the first 200 leaves a partial run already written, so the current abort is not atomic.
- Snapshot route market path: it returns `207 {success:false, marketError}` with no `error` key. `withCronJobAudit` failure inference may record this as a success. Not verified.
- The briefing's `update-stats-cron` "gameState: CRIT" failure was not in C3 scope.

## Files

`RECEIPT.md`, `EMAIL-EXCERPT.md`, `c3.vitest.config.mts`, `c3-tests.log`, `tests/{a,b,c,d}-*.test.ts`, `patched/` (patched copies the tests import), the three `C3-*.patch` files (`git apply --check` passes on the current tree), and `SHA256SUMS`.
