# FxTwitter poller: missing run captures and partial-source (207) responses

2026-11-09, read-only production checks (SELECT only), about 14:10 UTC. Nothing was replayed, repaired or deployed.

## 1. Why run captures are missing

**Root cause: pg_net reuses response ids, and the capture's key is the id.**

`x_timeline_capture_poll_runs()` (migration 20261106201221) copies each poller body from `net._http_response` into `x_timeline_poll_runs`:

- Its key is `(response_id, source_key)`.
- It inserts with `on conflict do nothing`.

pg_net's response id is not unique over time. It restarted near 1 four times since capture began: 2026-11-06 20:32, 11-07 23:26, 11-08 00:20 and 11-09 00:08 UTC (seen in the captured history as an id drop, for example 1253 → 15). After a restart, a new run whose id is already held by an older captured run (kept 35 days) is dropped silently. Gaps get worse each day, because more ids are already taken.

**Evidence (6 h that pg_net still holds, 08:10–14:10 UTC 11-09):**

| Check | Count |
|---|---|
| pg_cron poller job runs | all succeeded, 719 in 24 h |
| Poller bodies in `net._http_response` | 180 of 180 expected (one every 2 min) |
| Bodies captured as their own run (same id and same `run_at`) | 45 |
| Bodies whose id an older captured run already held | 135 (silently dropped) |

- The capture job itself is healthy: 96 of 96 runs succeeded in 24 h, longest 0.96 s.
- The live capture body's md5 is `7631439c…b1d2`, the same as the repo file.
- The report groups runs by `response_id` too (`summariseReads`, `summariseRunCadence`), so a reused id inside one 24 h window also merges two runs.

**The 72-minute gap (02:48–04:00 UTC 11-09):**
- 35 poller job runs started in it, and 4 posts were stored.
- It is a capture gap, not an intake outage. The other gaps over 20 minutes in the last 36 h show the same pattern: posts were stored and job runs started.

## 2. The 207s by source

The poller returns 207 when any one account's read failed in that run. Every failure is FxTwitter answering 404 after 3 attempts; there were no other error kinds.

The full 6 h in pg_net: 180 runs, 72 of them 207 (40%). That matches the 24 h edge-log figure of 281 of 714 (39%).

| Account | Failed reads / 180 | Longest failure streak |
|---|---|---|
| gamedaygoalies | 20 | 2 runs (4 min) |
| gamedaylines | 16 | 2 |
| nhl_rosters | 16 | 2 |
| fhfhockey | 12 | 1 |
| ccc | 12 | 2 |
| gamedaynewsnhl | 10 | 1 |
| dfofantasy | 9 | 3 (6 min) |

- That is about 7.5% of account reads. With 7 accounts, about 42% of runs would have at least one failure if failures are independent, which matches what was seen.
- At most 4 accounts failed in one run.
- No streak came near the watchdog's 8-run (16 minute) alarm.
- `via` was always `public` (no mirror), and there were no page gaps.
- A failed read is retried on the next run 2 minutes later. Edge logs carry no per-account detail, so the per-source split is only complete for pg_net's 6 h.

## 3. Were posts or downstream processing missed?

- **Queue parity** for the last 24 h, for switched accounts excluding fhfhockey: every shadow post due for a queue has a queue row.
  - ccc 35, dfofantasy 70, gamedaygoalies 13, gamedaylines 20, gamedaynewsnhl 34, nhl_rosters 21.
  - 0 missing, 0 pending older than 15 minutes.
- **Intake latency** (own posts, not reposts):
  - The median from post to first sighting is 0.9–2.0 minutes per account.
  - Since the shadow started, excluding the first-day backfill, exactly one post was more than 20 minutes late: CCC `2119551586024509868` ("Nov 8, 2026: NHL Starting Goalies").
    - Posted 22:04 UTC 11-08, first seen 03:00 UTC 11-09, about 5 hours late.
    - CCC reads were mostly fine then (30 of 33 captured runs ok), and other CCC posts were stored, so FxTwitter's profile feed left this post out. The 207s didn't cause it.
    - It was queued and processed when it arrived. Whether that was after that night's games started was not checked.
- **Five downstream processing failures** in 24 h: 4 CCC and 1 DFO queue rows are `failed` in the Lines processor (team-lines and starting-goalie posts, 11-08 15:32–23:56). That is the Lines lane, not intake. The rows store no error text.
- **Limit:** a post FxTwitter never returned cannot be seen from these tables. The independent cross-check, the twscrape shadow, has 0 observations because its secrets and variable are not set, and IFTTT stopped delivering after the switch.

## 4. Fix (built locally, not applied)

1. **`supabase/migrations/20261109150000_x_timeline_poll_runs_run_key.sql`**
   - The primary key becomes `(run_at, response_id, source_key)`; `run_at` is the response's own pg_net timestamp.
   - The capture function is unchanged except for the conflict target. It restates `search_path ''`, and grants stay service_role only. New body md5: `3b62975669b20c3840a135fdab1d8a15`.
   - The 9,464 current rows have no duplicates on the new key. No backfill.
2. **`web/lib/cron/xPollerHealth.ts`**
   - The report counts a run as `(run_at, response_id)`.
   - The longest-gap warning says how many posts were stored inside the gap ("…so the poller kept running and the gap is in the run capture").
   - The missed-runs warning now names a lost capture as one possible cause.
3. **Tests**
   - `supabase/tests/x_timeline_poll_runs_run_key.py`, local PostgreSQL 15: 9/9. It reproduces the drop on the old key and keeps both reused-id runs after the fix; also checks idempotency, search_path and grants.
   - `web/lib/cron/xPollerHealth.test.ts`: 2 new tests (reused ids count as separate runs; posts during a gap).
   - Vitest xPollerHealth + reportSectionReaders + CronReportEmail: 31 pass. supportedBaselineMigration: 21 pass.
   - `npm run typecheck` exit 0; eslint clean.
4. **Authority:** row 122, `pending`. Counts 122 / 84 applied / 28 unknown / 10 pending.

The scraper (`x-timeline-poll`) is untouched.

## 5. Exact plan for review (each step needs approval)

1. **Apply the migration** with Supabase `apply_migration`.
   - Readback: the constraint definition, the body md5 `3b62975669b20c3840a135fdab1d8a15`, `proconfig`, and execute privilege for service_role only.
   - Then rename the file to the ledger version, and set the authority row to `applied` with evidence.
   - Write scope: one ALTER TABLE on a 1.7 MB table, plus CREATE OR REPLACE FUNCTION.
2. **Optional catch-up**, only if approved, a one-off: run the capture's insert once from pg_net's oldest held response (about 6 h). This adds the dropped runs pg_net still holds, with `on conflict do nothing`. It writes only monitoring rows. Every hour of waiting loses about 30 runs from that window.
3. **Ship the web report change** in the next batched web release. No separate deploy.
4. **Then confirm, read-only, after 2 capture cycles** that new rows equal new pg_net poller bodies.

Not proposed:
- **Poller self-reporting** (the edge function writing its own run row). It would change and redeploy the scraper.
- **Capturing every 5 minutes** instead of 15. Whether a pg_net restart also empties uncaptured responses is unverified; revisit only if gaps remain after step 1.

## 6. Outcome (2026-11-09, with TJ's approval)

1. **Migration applied** by TJ in the SQL editor at about 14:30 UTC (the plugin's apply_migration was declined).
   - Readback matches the file: primary key `(run_at, response_id, source_key)`; body md5 `3b62975669b20c3840a135fdab1d8a15`; `search_path ''`; security definer; EXECUTE for service_role only.
2. **Ledger row** `20261109150000 x_timeline_poll_runs_run_key` inserted with approval. Statements are null, the same as the 11-07 ledger fixes.
   - Authority row 122 is `applied`. Counts: 122 / 85 applied / 28 unknown / 9 pending.
3. **Catch-up** added 136 runs (952 rows, 08:26–14:24 UTC) that the old key had dropped.
   - Afterwards, 180 of 180 poller bodies in pg_net had their own run rows.
   - Runs from before pg_net's 6-hour window can't be recovered.
4. **Not yet confirmed:** that the scheduled capture keeps up on its own. Its first run after the fix is 14:30 UTC.
   - Check, read-only: compare poller bodies in `net._http_response` with exact `(response_id, run_at)` matches in `x_timeline_poll_runs`. They should be equal apart from the newest 15 minutes.
