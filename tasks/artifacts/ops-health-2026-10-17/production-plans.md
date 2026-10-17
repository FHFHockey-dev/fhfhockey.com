# Approval-ready production plans — 2026-10-17

Only P-B has been executed (2026-10-17 ~21:20 UTC; see its section). Each operation needs TJ's explicit approval
for that operation. Avoid applying any of them during the scheduled FORGE run,
2026-10-20 07:00–13:00 ET (11:00–17:00 UTC). AGENTS.md cost and deploy rules
apply: a push or merge that triggers Vercel builds is a separate approval.

Recommended order: P-B (today, before 2026-10-18 10:38 UTC) → P-A release →
P-D → P-G/P-H code fixes by their owners → P-I → P-E/P-K → P-F.

---

## P-A — Release the inventory and baseline-receipt patches

- **Target:** Vercel production, project `fhfhockey` (root `web/`), via `master`
  reconciliation per AGENTS.md. Paths: `tasks/TASKS/cron-operations/cron-schedule.md`,
  `web/pages/api/v1/db/sustainability/rebuild-baselines.ts`, and three test files.
- **Effects:** The 13:00 UTC report stops expecting job 234 (no false
  "missing daily-cron-report"). Baseline audit rows record `rows_affected` =
  committed upserts, and failure receipts carry `processed`, `rowsUpserted`
  and `partialWrite`.
- **Build impact:** `web/vercel.json` `ignoreCommand` builds when `web/` or
  `cron-schedule.md` changes, so expect **one web production build**.
  Inventory the CMS/functions projects' triggers before pushing (AGENTS.md);
  this change touches neither.
- **Lock/load risk:** None in the database.
- **Rollback:** Revert the commit and redeploy the prior production
  deployment (Vercel instant rollback).
- **Readback:**
  1. Confirm the production deployment SHA contains the change.
  2. The next natural 13:00 UTC email no longer lists `daily-cron-report`
     as missing, and still lists any genuinely missing active job.
  3. The next 10:40 baseline audit row has non-null `rows_affected`.
- **Precondition:** Confirm the deployed SHA (U-03) before release.

## P-B — Stop the baseline/matview lock collision (job 374)

- **Target:** `cron.job` 374 `daily-refresh-player-totals-unified-matview`.
- **Change:** Run `proposed-sql/p-b-job-374-concurrent-refresh.sql`. It moves
  the job from `41 10 * * *` to `38 10 * * *` and uses
  `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
- **Why both:**
  - **Reorder (10:38).** Baselines (10:40, ~70 s) and priors (Vercel 10:42) then
    read one already-refreshed totals snapshot, instead of a mix of pre- and
    post-refresh rows. The matview depends only on
    `internal_stats.player_stats_unified`, refreshed at 07:50, so 10:38 loses no
    upstream data.
  - **CONCURRENTLY.** Takes an EXCLUSIVE lock, which blocks no readers. This
    covers anon site readers (3 s timeout) and any overrun of the refresh into
    10:40. Precondition met: unique, valid index
    `idx_player_totals_unified_pk (player_id, season_id)`, no WHERE clause, and
    the matview is populated.
- **Lock/load risk:**
  - `cron.alter_job` updates one catalog row.
  - A concurrent refresh rebuilds and diffs 4,327 rows (9 MB): seconds of CPU
    and a short-lived temp table. It does more work than a plain refresh, but
    readers are never blocked.
  - If the unique index ever stops covering duplicates, the refresh fails, but
    a plain refresh would fail on the same index.
- **Rollback:** The rollback block in the same file restores `41 10 * * *` and
  the original command.
- **Readback, immediately after:** `select jobid, schedule, command, active
  from cron.job where jobid = 374` returns schedule `38 10 * * *`, the
  CONCURRENTLY command, and active=true.
- **Recovery verification, 2026-10-18 after 10:43 UTC:** Run
  `proposed-sql/p-b-verify-recovery.sql` (read-only). Recovery is verified only
  if all four checks pass:
  1. Job 374 run 2026-10-18 `succeeded` and ended before 10:40:00 UTC.
  2. The 2026-10-18 audit row for `/api/v1/db/sustainability/rebuild-baselines`
     has `status = 'success'` (and `rows_affected` ≈ the count in check 3, once
     P-A is deployed).
  3. `player_baselines` for `snapshot_date = '2026-10-18'` has a row count
     equal to the route's candidate set: distinct non-null `player_id` in
     `public.player_stats_unified` with `date >= '2025-10-18'`. Expect about
     968, the 2026-10-16 count.
  4. The window-z offsets for 2026-10-18 report `processed_players` summing to
     the baseline players with a forward/defence position. (Score coverage
     stays limited by OPS-01 until P-G lands.)
- **Inventory follow-up:** After execution, change job 374 in
  `cron-schedule.md` to `38 10 * * *` / `10:38 UTC`. The report's ±30-minute
  match window tolerates the move until then.
- **EXECUTED 2026-10-17 ~21:20 UTC** (TJ approval in chat: "Approved: apply ops plan P-B exactly as written…").
  - **Preflight (read-only):** schedule `41 10 * * *`, active, the plain refresh command. Unique index valid on `(player_id, season_id)`, with no predicate or expressions. The matview is populated.
  - **Change:** one `cron.alter_job(374, '38 10 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal_stats.player_totals_unified;')`.
  - **Readback:** `38 10 * * *`, active=true, the CONCURRENTLY command.
  - **Inventory:** `cron-schedule.md` updated, reordered before job 326. Cron tests 105/105.
  - **Recovery verification:** scheduled read-only for 2026-10-18 11:05 UTC; it is not verified yet.
  - **Independent readback 2026-10-17 21:32:11 UTC (ops-health session, read-only):** job 374 is `38 10 * * *`, active=true, with the CONCURRENTLY command. The unique index is valid, the matview is populated, and no job-374 run is in flight. Cron inventory and report tests: 116/116 pass. No second `alter_job` was issued.

## P-C — The partial 2026-10-17 sustainability snapshot

- **Facts:**
  - `player_baselines` 2026-10-17 has 400 of ~968 players.
  - window-z 2026-10-17 covered 266 players and `sustainability_scores`
    covered 250.
  - The other 568 players' latest baseline is 2026-10-16.
- **Recommendation: do not backfill.** The 2026-10-18 natural run (after P-B)
  produces a complete snapshot, and consumers read the newest snapshot. A
  backfill means four write-heavy routes in sequence, and the score step would
  also need `force=true` because of OPS-01. That makes the 10-17 history
  internally consistent but adds nothing current.
- **If TJ wants 10-17 complete anyway (explicit approval):**
  1. `GET /api/v1/db/sustainability/rebuild-baselines?snapshot_date=2026-10-17`,
     once. That is ≤ ~968 upserts in ≤ 10 batches, keyed on
     `(player_id, snapshot_date)`, and takes about 70 s. Earlier batches are
     overwritten using post-refresh totals.
  2. window-z offsets 0/250/500 with `snapshot_date=2026-10-17`, sequentially.
  3. Score offsets 0/250/500 with `snapshot_date=2026-10-17&force=true`,
     sequentially.
  4. Trend bands: separate decision.
  - Stop on the first non-200 response and do not retry without inspecting it.
  - Run nothing between 10:30 and 11:40 UTC, or inside the FORGE window.
  - Readback: rerun check 3 of P-B with `2026-10-17`.

## P-D — `cron_job_audit`: index and access

- **Target:** `public.cron_job_audit` (175k rows, 306 MB, no indexes, anon
  read-all policy). SQL: `proposed-sql/p-d-cron-job-audit.sql`. It must land
  through the repository's migration authority; this session cannot edit
  `supabase/migrations/`.
- **Change 1 — index:**
  `CREATE INDEX CONCURRENTLY cron_job_audit_run_time_idx ON public.cron_job_audit (run_time);`
  - Lock: SHARE UPDATE EXCLUSIVE. Inserts from route wrappers continue.
  - Build is one scan of 306 MB, est. tens of seconds; resulting index est.
    4–6 MB.
  - Run it outside 07:00–13:00 UTC so it doesn't compete with the pipeline.
  - Each report page then reads by range instead of scanning the full table.
  - Rollback: `DROP INDEX CONCURRENTLY public.cron_job_audit_run_time_idx;`
  - Readback: `pg_index.indisvalid = true`. Confirm improvement with an
    `EXPLAIN` (no ANALYZE) of the report query shape.
- **Change 2 — access:** drop policy `Enable read access for all users` and
  `REVOKE SELECT ON public.cron_job_audit FROM anon, authenticated`.
  - Every repository reader is server-side (`web/pages/api/**`,
    `web/lib/**`); none uses the anon key.
  - Pre-check: confirm in PostgREST logs that no anon or authenticated GET of
    `/rest/v1/cron_job_audit` happened in the last 7 days.
  - Lock: brief ACCESS EXCLUSIVE for DROP POLICY.
  - Rollback: re-grant SELECT and recreate the policy, both in the file.
  - Readback: `has_table_privilege('anon','public.cron_job_audit','SELECT') = false`;
    the next 13:00 report still reads it (service role).

## P-E — Duplicate indexes (~50 groups, ~400 MB)

- **Target:** Exact duplicates listed in `evidence.md` §C3.
- **Before any drop:**
  1. Re-list with `indoption` included, to separate DESC near-duplicates.
  2. For each group, keep the index that backs a constraint (PK/UNIQUE) or is
     referenced by an FK. Drop the others with `DROP INDEX CONCURRENTLY`.
  3. Where two constraint-backed uniques duplicate each other, drop the extra
     constraint (`ALTER TABLE … DROP CONSTRAINT`, brief ACCESS EXCLUSIVE). Do
     those in a quiet window, one table at a time.
  4. With approval, read `pg_stat_user_indexes.idx_scan` for the candidates.
     That is a maintenance-statistics read, which was deliberately not rerun
     today.
- **First tranche candidates (non-constraint duplicates):**
  `idx_wgo_skater_stats_player_date` (97 MB), the redundant
  `(player_id, date_scraped, season)` pairs on `nst_gamelog_as_*`,
  `idx_baselines_player_date`, `idx_player_stats_unified_player_date_desc`
  (verify DESC use first).
- **Lock/load risk:** CONCURRENTLY drops wait for in-flight transactions.
  Writes speed up and storage shrinks.
- **Rollback:** Recreate from the saved `pg_get_indexdef` output with
  `CREATE INDEX CONCURRENTLY`.
- **Readback:** Index absent, and EXPLAIN (no ANALYZE) of the main readers
  still uses the surviving index.

## P-F — Postgres patching (plan only; do not start)

- **Target:** Supabase project `fyhftlxokyjtpndbkfse`. Image `15.1.1.19`
  (server_version 15.1), about 28.8 GiB.
- **Path:** Supabase dashboard → Infrastructure → upgrade to the newest
  offered image, either latest 15.x or a 17.x major. The upgrade is
  in-place (`pg_upgrade`) and can't be downgraded.
- **Backup:**
  - Confirm the latest daily backup or PITR point immediately before the
    window.
  - Take a logical dump of the schema with `pg_dump --schema-only`, plus
    critical small tables (`cron.job` definitions, `fhfh_internal`, auth
    config).
  - Record the extension versions in use (`pg_cron`, `pg_net`, `pgsodium`,
    `vault`, `pg_graphql`, `supautils`).
- **Pre-checks:**
  - Read the Supabase upgrade notes for deprecated extensions or `pgsodium`
    changes.
  - Confirm all 72 cron jobs are re-registered after the upgrade.
  - Snapshot `select jobid, jobname, schedule, active from cron.job`.
- **Window:** A weekday 05:00–06:30 UTC. Only the recurring jobs run then
  (line updates, stats, drain, settlement, Vercel per-minute crons). Do not use
  2026-10-20, and avoid 07:00–13:00 UTC on any day. Downtime scales with size;
  plan for up to ~60 minutes.
- **Rollback:** Restore the pre-upgrade backup or PITR into the project, or
  into a new project if the in-place restore fails. Data written during the
  window is lost, so pause writers first or accept that the window's ingest
  reruns the next day.
- **Readback:**
  1. `show server_version`.
  2. The `cron.job` snapshot diff is empty.
  3. One natural 13:00 UTC report.
  4. Spot-check the 10:40 sustainability chain the next morning.

## P-G — Sustainability score offset skip (code; owner: sustainability score route)

- **Defect:** `detectSustainabilitySourceAdvance` compares the newest
  `player_stats_unified.date` with the newest cutoff recorded in *any* of the
  last 100 `sustainability_scores` rows. Offset 0 writes 250 rows with the new
  cutoff, so offsets 250 and 500 skip as `source_already_processed`.
- **Minimal fix:** Key the skip to the requested snapshot and batch. Skip only
  when every player in the requested batch already has score rows for
  `snapshot_date` carrying the current source cutoff. Alternatively, evaluate
  the watermark once for `offset=0`/`runAll` and never for later offsets.
- **Test:** Offset 250 after offset 0 must process.
- **Production:** Release only. Then verify `count(distinct player_id)` in
  `sustainability_scores` for the next snapshot ≈ the window-z player count.
- **Fix (local patch, 2026-10-17; not committed or released):**
  - `detectSustainabilitySourceAdvance(client, { snapshotDate, playerIds,
    windowCodes })` in `web/lib/sustainability/incremental.ts` reads only the
    requested snapshot's `sustainability_scores` rows for the batch players
    (chunked `.in`, `components->sourceCutoffs` only). It also reads the newest
    `player_stats_unified.date` ≤ the snapshot.
  - It skips (`source_already_processed`) only when every batch player has
    all four window rows for the snapshot **and** the newest cutoff among
    them has reached that source date. Otherwise it processes with
    `snapshot_batch_incomplete` or `new_source_date`.
  - Why "newest of the batch", not "every row": each row's
    `sourceCutoffs.observed.player_stats_unified` is that player's own newest
    game date, so most rows carry older dates. Hypothesis for U-02 (not
    verified): the old 100-row sample on 10-16 held no player from the newest
    game date.
  - `rebuild-score.ts` now loads the batch (`loadPlayersForSnapshot`) before
    the check. `force=true` still bypasses it, and `runAll` checks the union
    of all batches. An empty batch processes and falls through to the
    prerequisite check.
  - Tests: `web/lib/sustainability/incremental.test.ts` (offset 250 after
    offset 0 processes; a re-run of the same batch skips; another snapshot's
    rows don't count; a missing window counts as incomplete) and
    `web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts` (the
    offset's batch ids reach the check; `force` bypasses it).
- **Behaviour change (cost):** On a game-free day each offset now rebuilds the
  new snapshot, as baselines and window-z already do, instead of skipping.
  That costs about one game day's score work. A same-day re-run of a finished
  batch still skips.
- **Residual edge:** If baseline membership shifts between runs *and* the
  source advances, a batch whose newest rows are current can skip although
  some members' rows are older. `force=true` or the next snapshot corrects it.
- **Post-release readback** (read-only, after the next natural
  11:00/11:06/11:12 UTC runs; no route calls):
  1. `select count(distinct player_id) from sustainability_scores where
     snapshot_date = '<next>'` ≈ `select count(distinct player_id) from
     sustainability_window_z where snapshot_date = '<next>'`. The crons cover
     player positions 0–749 only, so expect the smaller of that count and 750.
  2. The `cron_job_audit` receipts for offsets 250 and 500 show no
     `skipped`, and `processed_players` > 0.

## P-H — Shift-charts Yahoo name collision (code; owner: shift-charts route)

- **Defect:** `yahoo_positions.find(full_name === name)` picks the wrong Elias
  Pettersson. Stale `427.*` keys from a prior game add more candidates.
- **Minimal fix:**
  - Resolve Yahoo positions by verified NHL id
    (`public.verified_yahoo_player_identities_read()` returns `nhl_player_id`
    ↔ `external_player_id`).
  - If that's unavailable, treat multiple same-name candidates as ambiguous and
    use the NHL roster position (`source: "nhl_roster"`, already supported)
    instead of throwing.
  - Consider scoping to the current Yahoo game key.
- **Effect:** The daily shift run resumes. Backfill of the ~34 missing games
  needs its own bounded approval.
- **Fix applied locally (2026-10-17, uncommitted, not deployed):**
  - The ambiguity fallback was chosen over the RPC. The RPC would add a
    second Supabase dependency to every run with unknown coverage.
  - New `selectRelationshipYahooPosition` in
    `web/lib/projections/relationshipPlayerPosition.ts`. Rows that share a
    full name but carry more than one Yahoo player id (`<game>.p.<id>`) are
    treated as ambiguous: no Yahoo row is used, so
    `resolveRelationshipPlayerPosition` falls back to the roster
    (`source: "nhl_roster"`). Rows for one Yahoo player across seasons
    resolve to the newest game key, so stale `427.*` rows no longer win
    over `477.*`.
  - `web/pages/api/v1/db/shift-charts.ts` now collects all full-name matches
    and calls the selector instead of `find`. `PlayerPosition` gains
    `player_key`, which the existing `select("*")` already returns.
  - Unchanged: a single Yahoo player whose type disagrees with the roster
    still throws `Conflicting relationship position`. Missing, stale, or
    invalid roster evidence still throws.
  - Side effect: both Petterssons now report `nhl_roster` and appear in
    `positionFallbackNames`. The C's display position becomes `C` instead
    of Yahoo's `C,LW`. Line and pair grouping uses the type (F/D), which is
    correct for both.
  - Tests: `relationshipPlayerPosition.test.ts` has 3 new cases (ambiguous
    Pettersson rows fall back to D; newest season wins; single or
    unparseable keys). `shift-charts.audit.test.ts` has a route-level
    two-Pettersson game that returns 200 with a `success` audit and D/D for
    8483678. With the old first-match lookup, this case fails with
    `Conflicting relationship position for player 8483678` and HTTP 500.
    The 5 shift-chart/position test files pass (58 tests).
    `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` reports 0
    errors; without the larger heap, tsc runs out of memory.
- **Release and readback:** The fix needs a release (one web build;
  approval per P-A). Avoid 2026-10-20 07:00–13:00 ET. Then, with no route
  invocation, check the first natural job-16 run (07:45 UTC,
  `update-shifts?action=all`):
  - `select run_time, status, rows_affected, details->'context'->'positionFallbackNames'
    from cron_job_audit where job_name = 'update-shift-charts'
    and run_time >= '<release date> 07:40+00' order by run_time limit 1;`
    Expect `success`, `rows_affected > 0`, and "Elias Pettersson" among the
    fallbacks if a VAN game was in scope. This is one full scan until P-D
    adds an index.
  - `select max(game_date), count(distinct game_id) from shift_charts
    where game_date >= '2026-10-07';` Expect the max to pass 2026-10-15 and
    the count to rise from 34.
  - Catch-up (inferred from code, not observed): each run takes up to 16
    pending games, oldest first, from `projection_game_materialization_status`
    (`input_status = 'complete'` with a missing or stale relationship). The
    backlog should drain without a manual backfill, at up to 16 games per
    run minus each day's new games (roughly 7 a day in season), so expect
    about a week. Games without complete inputs (see OPS-04) stay excluded. If the
    run fails with a different error, a new blocker sits further down the
    queue.

## P-I — NST skater gamelog throughput (schedule; owner: NST)

- **Facts:** 6 URLs per ~108 s run with ≥21 s spacing, and a backlog of 374
  growing ~20/day. 5v5 and PP tables haven't been reached since 2026-10-02.
- **Options:**
  - (a) Add one or two extra daily `update-nst-gamelog` slots in NST-free
    gaps. Check `lib/cron/nstCoordination` spacing; each slot adds about 2 min
    of function time.
  - (b) A bounded catch-up schedule of N runs over M days, stated in advance.
  - (c) Reorder the queue so 5v5/PP aren't starved.
- **Constraint:** Never reduce the 21 s spacing or allow bursts.
- **Rollback:** Unschedule the added slots.
- **Readback:** Deferred count falls run over run, and the `date_scraped`
  maximum advances in all four families.

## P-J — Inventory additions for jobs 394/396/397

- **Proposal:** Add the three live player-forecast jobs to the
  `cron-schedule.md` JSON inventory (`method: "SQL"`, the `fhfh_internal`
  wrapper).
- **Decision needed:** How their receipts should match.
  - The SQL row proves submission only.
  - Endpoint audits use their own names.
  - The `*/5` drain creates 288 expected slots per day.
- **Testing:** Update the combined-inventory count assertions and confirm the
  collision checks stay empty before release.

## P-K — Anon write grants on 101 tables

- **Proposal:** Generate the table list, classify each table (public stats vs.
  operational vs. user data), and revoke INSERT/UPDATE/DELETE from anon where
  no anon write policy exists.
- **Effect:** None today, because RLS already denies these writes. The value
  is defence in depth.
- **Lock risk:** REVOKE takes a brief lock per table.
- **Rollback:** GRANT back.
- **Readback:** `has_table_privilege` checks.
