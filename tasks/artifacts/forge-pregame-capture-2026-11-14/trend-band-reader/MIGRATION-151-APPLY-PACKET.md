# Migration 151 apply packet: `forge_latest_trend_bands` (for TJ's approval)

## What would change in production
- **One new read-only function,** `public.forge_latest_trend_bands(integer[], text[], text[], date)`:
  - STABLE, SECURITY INVOKER, `search_path = pg_catalog`;
  - EXECUTE for service_role only (public, anon and authenticated revoked);
  - a comment.
- **File:** `supabase/migrations/20261115190000_forge_latest_trend_bands.sql`, SHA-256 `a3e1835fc1dfc1c1562b5b39dd86f535d5acc37b74eee1fac6dcb49cb2049281`. The script refuses any other hash.
- **Ledger row:** `('20261115190000', 'forge_latest_trend_bands')` in `supabase_migrations.schema_migrations`, in the same transaction.
- **`notify pgrst, 'reload schema'`,** so PostgREST sees the function at once (a schema-cache reload only).
- **Nothing else:**
  - no table, index, policy, cron or setting change;
  - no push or deploy;
  - no Vercel build: psql to the database triggers none.

## What it does and does not do
- **Writer:** no behaviour change at apply time. The deployed writer still reads trend bands by the table GET; the new reader is only in local commits.
- **Capture:** this makes the next capture possible. Without it, the capture's transport refuses the RPC's 404 (PGRST202).
- **Lock footprint:** a new `pg_proc` entry and grants on it. It takes no lock on `sustainability_trend_bands` and does not touch the 11M rows. Creating the function does not run it.

## Exact command (from the repository root, attended)
```bash
zsh tasks/artifacts/forge-pregame-capture-2026-11-14/operator/apply-migration-151.sh --apply --confirm 20261115190000
```
**Connection:** psql 15 to the IPv4 session pooler as `postgres` (not superuser). Credentials are read from `web/.env.local` and never printed. Outputs go to a private run directory, `~/forge-pilot/migration-151-<UTC>/`.

**Steps:**
1. **Hash:** the script copies the file and checks its SHA-256.
2. **DNS:** the pooler host must resolve.
3. **Gate** (one read-only query, 5 s timeout). It must show:
   - 5 or fewer other active queries, none longer than 10 s, and 0 lock waits;
   - no pg_cron run in progress (last 2 h);
   - no ledger row 151 and no function yet;
   - the 8 expected columns with their types;
   - a non-superuser session, and the 3 API roles present.
4. **Apply:** one transaction with `lock_timeout 5s` and `statement_timeout 30s`. It runs the file, the ledger insert and the notify, then commits, under a 120 s wall-clock alarm.
5. **Readback** (read-only). It must show exactly:
   - the ledger row;
   - STABLE, not SECURITY DEFINER, `search_path=pg_catalog`, the four-argument signature;
   - EXECUTE for service_role yes, anon no, authenticated no, PUBLIC no;
   - the comment present.

**Window:** any minute clear of the Vercel crons. Today that is now to 20:12Z, or 20:20–21:05Z (the 2-hourly cron runs at 20:17Z and another at 21:10Z). The gate decides at run time.

**Stop rule:** any `FAIL` (exit 7) stops. I report it and do not retry without a new approval.

## Optional smoke after the apply (2 read-only requests)
```bash
zsh tasks/artifacts/forge-pregame-capture-2026-11-14/operator/apply-migration-151.sh --smoke
```
The inputs are 0326 team 2 (the 18 players whose read timed out) as of 2026-11-15, which is 144 keys.
1. **SQL:** in a read-only transaction with an 8 s timeout, `set local role service_role`, count the rows, then `EXPLAIN (ANALYZE, BUFFERS)` the call (production timing).
2. **PostgREST GET:** `/rest/v1/rpc/forge_latest_trend_bands` with the service key from `web/.env.local`, sent from a 0600 header file that is deleted afterwards. It must return HTTP 200 and 144 rows, which also proves the schema cache sees the function.

## Evidence
- **Local proof:** `supabase/tests/forge_latest_trend_bands.py`, 18/18 (non-superuser owner, refusals, grants, ordering, stale and missing keys, rollback).
- **Apply-script self-test:** `operator/apply-migration-151-selftest.sh`, 10/10 on a disposable PG15. It covers:
  - a clean preflight;
  - refusal without, or with a wrong, `--confirm`;
  - smoke failing before the apply;
  - refusal while a cron run is in progress;
  - commit with ledger row and exact readback;
  - SQL smoke as service_role;
  - refusals after the apply and on a second apply;
  - refusal of a superuser session.
- **Production read-only EXPLAIN** of the body (18:33:47Z): one backward primary-key scan per key (`results/production-explain-20261115T183347Z.txt`).
- **Benchmark:** 206–351 cold pages per team, against 6.8k–11.8k for the old read (`TREND-BAND-READER-PROTOTYPE.md`).

## After a successful apply (local commits only)
- **Records:**
  - `MIGRATION-151-APPLY-RECEIPT.md`;
  - authority row 151 set to `applied` with the receipt;
  - baseline-test pins changed to 117 applied / 6 pending;
  - the super-goal sentence updated.
- **Rollback, if ever needed** (needs your approval): `supabase/tests/forge_latest_trend_bands_rollback.sql` drops the function, and the reader falls back to the table GET. The ledger row would also need removing.

## Still separate after this
- releasing the reader (push/deploy);
- the pilot packet revision (three RPCs, new candidate SHA);
- choosing the next capture game.
