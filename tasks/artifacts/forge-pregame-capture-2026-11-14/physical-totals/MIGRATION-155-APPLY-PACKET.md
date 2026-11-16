# Migration 155 apply packet: physical-totals covering index + date-range body (for TJ's approval)

## Why
`forge_league_skater_physical_totals(20262027, '2026-11-15')`, one capture read per game, has been running just under the 8 s statement timeout:

| When (Z) | Caller | Time | Result |
| --- | --- | --- | --- |
| 2026-11-15 14:40 | capture 0326 | 7,441 ms | 200 |
| 2026-11-15 20:10 | capture 0328 (qualified) | 7,507 ms | 200 |
| 2026-11-16 00:44 | capture 0330 | 8,031 ms | **57014**: `source_failed`, queue stopped, 0329 `never_dispatched` |

**Production read-only EXPLAIN** (2026-11-16 00:54:36Z, approved; `results/production-explain-20261116T005436Z.txt`):
- The body already narrows by date: a BitmapOr of its two date ranges on `idx_wgo_skater_stats_date`.
- The cost is the heap. `wgo_skater_stats` holds 2,256,218 rows in 278,574 pages (2.2 GB, about 8 rows per page), and date correlation is 0.39. About 2.2 seasons of wide rows are scattered over tens of thousands of pages.
- `effective_cache_size` is 768 MB. That is a planner setting, so the claim that the 2.2 GB table cannot stay cached is **inferred**; it is consistent with cold reads near 8 s.

## What would change in production
**Migration file:** `supabase/migrations/20261116010000_forge_physical_totals_covering_index.sql`, SHA-256 `7835a06deb5d89ac324df5d586d592e5d7d830ffe5646bcf5f8d748e1c5c887f` (authority order 155, pending). It applies in two attended steps, each with its own approval.

1. **Index (step 1):**
   - Statement: `create index concurrently idx_wgo_skater_stats_gp1_physical on public.wgo_skater_stats (date) include (season_id, position_code, toi_per_game, hits, blocked_shots) where games_played = 1 and toi_per_game > 0`.
   - It holds every column the function reads, so the read can skip the heap on all-visible pages.
   - **Size:** about 58 MB (measured locally at production scale).
   - **CONCURRENTLY:** it does not block the WGO upserts. It reads the 2.2 GB heap twice and waits for transactions already open, which means a few minutes of extra I/O.
   - **Writes:** an update that changes one of the included columns can no longer be a HOT update. `date` and `season_id` are already indexed today.
2. **Function body (step 2, only once the index is valid):**
   - The same body plus one date range spanning both scopes, written from the arguments alone, so the planner can use it as an index condition.
   - The function plans generically (a non-inlined SQL function). With the OR of two ranges, the planner keeps the bitmap heap scan and never uses the index on its own.
   - **Unchanged:** the signature, result columns and order, STABLE, SECURITY INVOKER, `search_path ''`, and EXECUTE for service_role only.
   - The ledger row `('20261116010000', 'forge_physical_totals_covering_index')` and `notify pgrst` go in the same transaction.
3. **Nothing else:** no table, data, grant, policy, cron or setting change; no push or deploy; no Vercel build. No code change, because the reader in `skater-queries.ts` calls the same RPC.

**Order matters.** The rewritten body without the index reads slightly more pages than today (local: 57k against 54k). The script refuses step 2 unless:
- the index is present, valid and exactly as defined;
- a read-only plain EXPLAIN of the new body in production, planned generically as the function plans, shows `Index Only Scan using idx_wgo_skater_stats_gp1_physical`. This is the production plan gate.

## Evidence (local, offline)
**Benchmark** at production scale (2.23M rows, 7 rows per page, date correlation 0.25, PG15 with production planner settings; `results/bench-20261116.txt`). The plans are generic, as the function runs:

| Variant | Pages (cold) | Plan | Local time |
| --- | --- | --- | --- |
| Today's function | 54,660 | bitmap heap scan | 174 ms* |
| Rewrite only | about 60,000 | index scan + heap | 185 ms* |
| Index only | 36,051 | bitmap heap scan | 126 ms* |
| **Index + rewrite (155)** | **5,064** | **Index Only Scan** | **45 ms** |

\* The local times are with the table in the OS page cache. Production reads these pages from disk (7.4–8.0 s), so the page count is the comparable measure.

**Expected in production:** about a tenth of the pages, mostly from a 58 MB index. This is an expectation, not a measurement; the smoke confirms it, and refuses anything over 2 s or a plan that is not an Index Only Scan.

**Caveat on heap fetches:**
- An index-only scan visits the heap only for pages not marked all-visible.
- Production's statistics counters read zero and show no vacuum timestamps, so `relallvisible` (272,620 of 278,574 pages) may be stale.
- The bench assumed only recent current-season pages need heap visits. The smoke records `Heap Fetches` so this is measured, not assumed.
- A VACUUM, if the fetches turn out high, would be a separate ask.

**The answer is identical in every variant:** md5 `e37e23e0…` for the 4 rows.

**Proof** (`supabase/tests/forge_physical_totals_covering.py`): **13/13.**
- Starts from the 137 production state, readback md5 `0eec9782…`.
- **Same answers:** 121 calls of (season, cutoff), valid, invalid and null, give the same answer or the same error after step 1+2, after a CONCURRENTLY rebuild, and after rollback.
- **Index:** exact definition, valid.
- **Plan:** the function's own nested generic plan is an Index Only Scan on the new index.
- **Posture:** unchanged.
- **Readback:** the header's md5 matches (`5b67ecb4…`).
- **Rollback:** restores 137.

**Apply-script self-test** (`operator/apply-migration-155-selftest.sh`, disposable PG15): **27/27.** It covers:
- refusals without, or with a wrong, `--confirm`;
- refusal when the session cannot see other sessions' activity;
- step 1 while a cron run is in progress, while another transaction has been open too long, and a second time;
- **a cancelled build:** another session holds an older snapshot and a 2 s timeout cancels the build at its end, leaving an INVALID index. The script drops it concurrently, verifies it is gone, and fails.
- step 2 before the index exists, while it is invalid, and when the plan gate sees no Index Only Scan;
- a clean step 1, step 2 and smoke with exact readback. The smoke reports `Heap Fetches`.
- the drop refused while the new body is live;
- `--rollback-function` restoring 137 and removing the ledger row;
- `--drop-index` verified, which brings the database back to its starting state;
- a superuser session.

**Pins:** `supportedBaselineMigration.test.ts` 21/21 (155 rows: 120 applied, 28 unknown, 7 pending).

## Exact commands (from the repository root, attended)
**Connection:** psql 15 to the IPv4 session pooler as `postgres` (not superuser). Credentials are read from `web/.env.local` and never printed. Outputs go to a private `~/forge-pilot/migration-155-<UTC>/`.

```bash
zsh tasks/artifacts/forge-pregame-capture-2026-11-14/operator/apply-migration-155.sh --preflight
```
```bash
zsh tasks/artifacts/forge-pregame-capture-2026-11-14/operator/apply-migration-155.sh --index --confirm idx_wgo_skater_stats_gp1_physical
```
```bash
zsh tasks/artifacts/forge-pregame-capture-2026-11-14/operator/apply-migration-155.sh --function --confirm 20261116010000
```
```bash
zsh tasks/artifacts/forge-pregame-capture-2026-11-14/operator/apply-migration-155.sh --smoke
```

**Each step:**
- **Checks first:** the migration and rollback file hashes and pooler DNS. Then one read-only state query (5 s timeout). It must show:
  - 5 or fewer other active queries, none longer than 10 s, and 0 lock waits;
  - no pg_cron run in progress;
  - a non-superuser session with index privilege on `wgo_skater_stats`, `pg_read_all_stats` (otherwise those counts would silently read 0), and the 3 API roles.
  - **Step 1 also needs** no other client transaction open for more than 60 s, because a concurrent build waits for them.
- **Step 1:**
  - **Needs:** no index yet and the 137 body.
  - **Runs:** `statement_timeout 15min`, `lock_timeout 10s`, under a 1,000 s wall-clock alarm, then a readback that must show valid, ready and the exact definition.
  - **If the build ends invalid:** the script drops that index concurrently (cleanup, part of this approval), re-reads the catalog to verify it is gone, and fails. If the drop does not verify, it says an INVALID index may remain. No retry without a new approval.
- **Step 2:**
  - **Needs:** a valid index, the 137 body, no ledger row, and the production plan gate (read-only plain EXPLAIN) showing the Index Only Scan.
  - **Runs:** one transaction (`lock_timeout 5s`, `statement_timeout 30s`) with only the file's function part, the ledger row and the notify.
  - **Readback:** must show exactly the ledger row, md5 `5b67ecb4dee0e75e6285fc5468ef06e7`, STABLE, not SECURITY DEFINER, `search_path=""`, EXECUTE for service_role only, and the index valid.
- **Smoke** (read-only, 3 requests):
  - the function timed as service_role (8 s timeout), which must take ≤ 2,000 ms and return 4 rows;
  - the body's generic plan with `EXPLAIN (ANALYZE, BUFFERS)`, which must be the Index Only Scan, recording `Heap Fetches`;
  - a PostgREST GET, which must return HTTP 200 and 4 rows.

**Window:** a quiet minute clear of the Vercel crons, with the gate deciding at run time. Steps 1 and 2 can run minutes apart in the same sitting.

**Stop rule:** any `FAIL` (exit 7) stops. I report it and do not retry without a new approval.

## Rollback (rehearsed in the self-test)
```bash
zsh tasks/artifacts/forge-pregame-capture-2026-11-14/operator/apply-migration-155.sh --rollback-function --confirm 20261116010000
```
```bash
zsh tasks/artifacts/forge-pregame-capture-2026-11-14/operator/apply-migration-155.sh --drop-index --confirm idx_wgo_skater_stats_gp1_physical
```
- **`--rollback-function`:** in one transaction, restores the 137 body (md5 `0eec9782…`) from the pinned rollback file (SHA-256 `f121c9c4…042c`), removes the ledger row and reloads PostgREST, then reads back. It first checks DELETE privilege on the ledger.
- **`--drop-index`:** refuses while the new body is live, then drops concurrently and verifies.
- **Order:** body first, then index.
- **Approval:** each needs approval. The pop-up asks whether a failed smoke may trigger `--rollback-function` at once.

## After a successful apply (local commits only)
- `MIGRATION-155-APPLY-RECEIPT.md`, authority row 155 set to `applied`, pins 121 applied / 6 pending, and the super-goal sentence updated.
- **Capture:** the next capture's read of this RPC should take well under a second. A new capture or queue run still needs its own approval; the slate session's re-plan fix is being verified separately.

## Not part of this packet
Push, deploy, capture runs, or any other index, setting or timeout change.
