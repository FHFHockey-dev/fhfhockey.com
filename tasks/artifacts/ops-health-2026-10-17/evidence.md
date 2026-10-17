# Evidence — 2026-10-17 (all reads bounded and read-only)

Every production read used `BEGIN READ ONLY; SET LOCAL statement_timeout='8s'`
with LIMIT. No EXPLAIN ANALYZE, no maintenance-statistics read
(`pg_stat_user_indexes` / `pg_stat_statements`), no advisors, no writes.
Times are UTC. `cron_job_audit` has no index, so each read of it was a full
306 MB scan; nine such reads completed (one more errored on a JSON cast).

## A. Cron reporting

### A1. Job 234 and the static inventory

- **Live `cron.job` 234 `daily-cron-report`:** `15 21 * * *`, `active=false`,
  HTTP via Vault. Last run: 2026-10-15 21:15:00 (run 182924, succeeded). No
  runs on 10-16 or 10-17.
- **Static inventory before this session:** job 234 `"active": true`
  (`cron-schedule.md` JSON). `master` (`457435eb3`) carries the same file, so
  the deployed report probably shares the stale entry (U-03).
- **Mechanism:** `loadScheduledCronJobs` keeps `active` JSON entries and
  `expectedRunAtWithinWindow` resolves a 13:00 run to the previous day's 21:15
  slot. With no observation, the report emits "No cron or audit observation
  matched this scheduled slot".
- **Live vs. inventory diff** (`live-cron-job-2026-10-17.json`): live has 72
  jobs (58 active); the inventory had 69 entries (56 active). The only drift
  was 234 `active` (inventory true, live false). Live jobs 394, 396 and 397
  are missing from the inventory.
- **Vercel crons** (`web/vercel.json`): 27, including `0 13 * * *`
  `/api/v1/db/cron-report`. The report does not load them as expected runs.

### A2. Historical candidate `chef/cron-reporting-combined-20261004`

- `git merge-base --is-ancestor da549b9ae HEAD` → not an ancestor. `git cherry
  -v HEAD da549b9ae 438fc5250` → all three commits are `+` (no matching
  patch-id).
- Hunk-by-hunk, current `web/pages/api/v1/db/cron-report.ts` contains:
  `incompleteYahooReceiptWarning` (identical body), `classifyAuditStatus` →
  unknown for partial Yahoo, entry-first method/url/route precedence,
  `BenchmarkSummary.scope`, removal of the per-row `Bottleneck:` note, and the
  removal of the email `Benchmark:` line. `canonicalRoute` provides exact
  query matching. Inventory route `/api/v1/db/update-yahoo-players` (no
  query) matches. Existing tests cover Yahoo partial and exact-query cases
  (test file lines 526–528).
- `tasks/artifacts/branch-reconciliation-2026-10-12/manifest.json` disposition:
  `superseded_or_uncertain_alternative`.
- SHA-256 of `git diff 438fc5250d3b da549b9ae2e2` = `187a34cf7e1d5876…`;
  `--full-index --binary` = `a3cac8233e52cd40…`; `format-patch --stdout` =
  `070e0e78c4308a32…`. None matches the quoted `e8d5e6368a5f…`.

## B. Data health

### B1. Sustainability baselines (OPS-02)

`cron.job_run_details`:

| Day | Job 326 (HTTP submit) | Job 374 refresh | Duration |
| --- | --- | --- | --- |
| 10-12 | 10:40:00.09 | 10:41:00.57–10:41:04.48 | 3.91 s |
| 10-13 | 10:40:00.10 | 10:41:00.20–10:41:04.12 | 3.92 s |
| 10-14 | 10:40:00.17 | 10:41:00.37–10:41:04.22 | 3.85 s |
| 10-15 | 10:40:00.17 | 10:41:00.12–10:41:03.17 | 3.05 s |
| 10-16 | 10:40:00.11 | 10:41:00.38–10:41:04.31 | 3.93 s |
| 10-17 | 10:40:00.14 | 10:41:00.58–10:41:11.44 | **10.85 s** |

Route audit (`/api/v1/db/sustainability/rebuild-baselines`):

| Day | Started | Ended | Duration | Result |
| --- | --- | --- | --- | --- |
| 10-14 | 10:40:01.5 | 10:41:12.8 | 71.3 s | success, 970 players |
| 10-15 | 10:40:02.0 | 10:41:10.0 | 67.9 s | success, 969 |
| 10-16 | 10:40:02.0 | 10:41:10.7 | 68.7 s | success, 968 |
| 10-17 | 10:40:00.9 | 10:41:10.1 | 69.2 s | **500**: `Supabase query error on table=player_totals_unified select=* range=0-999: canceling statement due to statement timeout` |

`rows_affected` was null on every run because the success response had no
row-count key.

Objects and settings:

- `public.player_totals_unified` is a `security_invoker` view over matview
  `internal_stats.player_totals_unified`: 4,327 rows, 203 columns, 9 MB.
  Unique index `idx_player_totals_unified_pk (player_id, season_id)`. The
  matview depends only on `internal_stats.player_stats_unified`, which
  refreshes at 07:50 (job 248).
- Job 374 command: `REFRESH MATERIALIZED VIEW internal_stats.player_totals_unified;`
  (not concurrent).
- Role settings: `authenticator` and `authenticated` have
  `statement_timeout=8s`; anon has 3s; `service_role` has none, so PostgREST
  requests run under the 8 s login-role timeout.

Route semantics (`rebuild-baselines.ts`):

- It lists players, then works in batches of 100. Each batch paginates the
  game rows, reads totals (`select=*`, `range 0-999`, always the batch's first
  and only page), then makes one `upsert` on `(player_id, snapshot_date)`.
- Each upsert is its own PostgREST transaction, so earlier batches stay
  committed when a later batch fails.
- The run is key-idempotent: re-running a date overwrites the same keys.

Partial write (`player_baselines`, index `idx_baselines_date`):

| snapshot_date | Rows | First computed_at | Last computed_at |
| --- | --- | --- | --- |
| 2026-10-15 | 969 | 10:40:27.4 | 10:41:09.8 |
| 2026-10-16 | 968 | 10:40:27.3 | 10:41:10.5 |
| 2026-10-17 | **400** | 10:40:28.6 | **10:40:53.3** |

Downstream 2026-10-17 audits (Vercel crons):

- **priors** (10:42): success, 1,816 rows.
- **window-z:** offset 0 = 250 players, offset 250 = 16, offset 500 = 0.
  All three report success.
- **score:** offset 0 = 250 players / 1,000 rows. Offsets 250 and 500 were
  `skipped: source_already_processed`.
- **trend-bands:** 82, 67, 67 and 60 players.

`sustainability_scores` distinct players: 10-16 = 642, 10-17 = 250.

### B2. Score offset skip (OPS-01)

Score audits, 2026-10-12 → 10-17, showing `latest_source_date` /
`latest_processed_source_date` before each call:

- **10-12, 10-13, 10-14, 10-15, 10-17:** offset 0 processed 1,000 rows
  (`new_source_date`). Offsets 250 and 500 then skipped because offset 0 had
  advanced the watermark.
- **10-16:** all three offsets processed (1,000 / 1,000 / 568 rows), and the
  processed watermark stayed at 10-14 throughout (U-02).

Code: `web/lib/sustainability/incremental.ts` `detectSustainabilitySourceAdvance`
reads the newest 100 `sustainability_scores` rows by `computed_at`. It has
existed since `fbaf45caa` (2026-07-23). Consumer:
`entitySurfaceServer.resolveLegacySnapshotDate` selects the newest
`snapshot_date` from `sustainability_scores` for list views.

### B3. Shift charts (OPS-03)

`update-shift-charts` audits:

- **10-04, 10-05:** failure, `Invalid relationship roster scope for game 2026010001`.
- **10-06 … 10-11:** failure, `… for game 2026010004` (10-06 wrote 40 rows
  first).
- **10-12 … 10-17:** failure, `Conflicting relationship position for player
  8483678` (10-12 wrote 38 rows first; the others wrote 0).

Sources:

- `nhl_api_game_roster_spots` for player 8483678: Elias Pettersson, team 23,
  position D, games on 10-11, 10-13 and 10-15.
- `yahoo_positions` with `full_name = 'Elias Pettersson'`: `427.p.7520` C
  (C,LW); `477.p.32762` D; `477.p.7520` C. The route uses
  `playerPositions.find(full_name === name)` and gets the first by
  `player_key`, which is C.
- `relationshipPlayerPosition.ts` throws when the Yahoo type and the roster
  type disagree.

Freshness: `shift_charts` max `game_date` = 2026-10-15. 34 distinct games
since 10-07, against 68 `games` rows in the same span (approximate).

### B4. Projection inputs (OPS-04)

`ingest-projection-inputs` failed on all three days, 09:45. On 10-17 the
response showed `startDate 2026-09-26`, `resumeFromDate 2026-09-26`,
`gamesTotal 14`, `gamesProcessed 0`, `failedRows 1`, and message
`INVALID_PROJECTION_RAW_SHIFT_ROWS`. `run-projection-v2` (10:12) and
`run-projection-accuracy` (11:30) failed on all three days with "Preflight
freshness checks failed".

### B5. NST skater gamelog (OPS-05)

`update-nst-gamelog` audit `nstProgress`:

| Day | Result | Stopped early | Duration | Deferred URLs | rows_persisted outcomes |
| --- | --- | --- | --- | --- | --- |
| 10-15 | failure | yes | 108 s | 334 | 6 |
| 10-16 | failure | yes | 109 s | 354 | 6 |
| 10-17 | failure | yes | 108 s | 374 | 6 |

There were no failed URLs. Earlier successes on 10-14 13:38–13:42 were
manual-looking single-URL runs.

`max(date_scraped)` since 10-01, with distinct dates since 10-07:

- `nst_gamelog_as_counts`: 2026-10-13 (5 dates).
- `nst_gamelog_5v5_counts`: 2026-10-02 (0).
- `nst_gamelog_pp_counts`: 2026-10-02 (0).
- `nst_gamelog_goalie_all_counts`: 2026-10-16 (10).
- `games` played: 10 dates.

### B6. Others

- **Yahoo** (`/api/v1/db/update-yahoo-players`), 10-15 to 10-17: success,
  1,599 / 1,599 / 1,600 rows, ~50 s. The response has no `status` or
  `completeSnapshot` partial markers. Classed historical (H-01).
- **Line updates (72 h):** `update-line-sources` 32 failures / 13,191
  successes (`Forecast schedule scope is incomplete or inconsistent`) at
  00/14/15/21 UTC. `update-lines-ccc` had 1 failure (timeout, 10-16 18:39)
  and 4,419 successes. `update-line-combinations` had 219 successes.
- **PbP:** `update-PbP` had 1 failure on 10-14 (`timedOut`) and succeeded on
  10-15 and 10-16.

## C. Database security and maintenance (catalog-only)

### C1. SECURITY DEFINER

- Every SECURITY DEFINER function outside system schemas has a pinned
  `search_path`.
- Executable by anon/authenticated (all read-only):
  - `analytics.rpc_sko_player_series`: `search_path=analytics, public`,
    without `pg_temp`. Its relations are schema-qualified. Low risk.
  - `public.get_skater_game_scores_for_season`: pinned, ends in `pg_temp`.
  - `public.rpc_sko_player_series`: same.
  - `public.verified_yahoo_player_identities_read`: `search_path=""`,
    `row_security=off`. Returns verified Yahoo↔NHL player identity mappings
    (`external_player_id`, `season_id`, `fhfh_player_id`, `nhl_player_id`,
    `canonical_name`): public sports data, not user records. Acceptable;
    it's also the right key for P-H.
- `public.execute_sql(sql_statement text)` is SECURITY DEFINER, owned by
  postgres, and not executable by anon/authenticated. It's a high-value
  function, so keep it service-role only.
- `public.truncate_rolling_player_game_metrics`: anon and authenticated
  EXECUTE are false (the 2026-10-16 revocation reads back).
- User-data RPCs (draft_pro, connected accounts, ESPN/Fantrax): none is
  executable by anon/authenticated.

### C2. RLS and policies (public schema)

- 395 base tables, all with RLS enabled. 143 have RLS and no policy
  (service-role only).
- No permissive write policy with a `true` gate applies to anon or
  authenticated. The owner-scoped insert/delete policies use
  `(select auth.uid()) = user_id`.
- 273 tables grant anon SELECT. 210 have an anon read-all policy (stats
  tables, plus `cron_job_audit`).
- 110 tables grant anon INSERT/UPDATE/DELETE. 101 of those have no anon
  write policy, so RLS is the only barrier.
- `public.cron_job_report` is a `security_invoker` view (anon also needs
  `cron.*` rights, which it lacks). No `cron.job` command contains an inline
  bearer token; 62 use `vault.decrypted_secrets`.

### C3. Indexes

- `cron_job_audit`: no indexes at all (175k rows, 306 MB).
- Exact duplicate groups (same table, key, opclass, expressions, predicate;
  `indoption` not compared): 50 groups, ~400 MB reclaimable.
- Largest groups:

| Table | Duplicate indexes | Reclaimable |
| --- | --- | --- |
| `wgo_skater_stats` | `wgo_skater_stats_player_id_date_key` / `idx_wgo_skater_stats_player_date` | 97 MB |
| `nst_gamelog_as_counts` | two identical uniques on `(player_id, date_scraped)` | 22 MB |
| `nst_gamelog_as_counts` | three identical `(player_id, date_scraped, season)` | 21 MB |
| `nst_gamelog_as_rates`, `…_rates_oi`, `…_counts_oi` | the same triple | 21 MB each |
| `wgo_skater_stats` | `wgo_skater_stats_date_idx` / `wgo_skater_stats_gp1_date` | 17 MB |

- Smaller groups: `player_baselines_pkey` / `idx_baselines_player_date`;
  `wgo_skater_stats_totals` (3 on the same key);
  `internal_stats.player_stats_unified` pk / `player_date_desc`;
  `shift_charts` `idx_team_id_game_date` is a prefix of the covering index
  (a near-duplicate, not counted).

### C4. Foreign keys

- 496 FKs; 194 lack a leading-column index. 3 of those are on children with
  more than 100k rows.
- Top by child size:
  - `rolling_player_game_metrics.game_id` → `games` (885k rows, 6.5 GB).
  - `rolling_player_game_metrics.team_id` → `teams` (62 rows).
  - `entity_metric_rankings.team_id`, `.metric_key` (52k rows).
  - `forge_player_projections.opponent_team_id` (24k rows).

### C5. Version

- `server_version` 15.1. Supabase image `15.1.1.19`, region us-east-1,
  status ACTIVE_HEALTHY.
