# Migration 151 apply receipt: `forge_latest_trend_bands`

- **Approval:** TJ's pop-up, 2026-11-15: "Apply + 2-read smoke (Recommended)". Packet: `MIGRATION-151-APPLY-PACKET.md`.
- **File:** `supabase/migrations/20261115190000_forge_latest_trend_bands.sql`, SHA-256 `a3e1835fc1dfc1c1562b5b39dd86f535d5acc37b74eee1fac6dcb49cb2049281`. The hash was checked on the copy that was applied.
- **Command:** `operator/apply-migration-151.sh --apply --confirm 20261115190000`, then `--smoke`. It ran attended, with psql 15 to the IPv4 session pooler as `postgres` (not superuser). Private outputs are in `~/forge-pilot/migration-151-20261115T193015Z/`.

## Gate (read-only, 19:30:17Z)
active 0 · longest 0 s · lock waits 0 · pg_cron runs in progress 0 · ledger row absent · function absent · columns 8/8 · non-superuser · API roles 3/3.

## Apply
| | |
|---|---|
| Transaction | `lock_timeout 5s`, `statement_timeout 30s`: CREATE FUNCTION, REVOKE, GRANT, COMMENT, ledger INSERT, NOTIFY pgrst, then COMMIT |
| Applied at | **2026-11-15 19:30:17.888359Z** (database clock); exit 0 |

## Readback (read-only)
`1|s|f|search_path=pg_catalog|postgres|p_player_ids integer[], p_metric_keys text[], p_window_codes text[], p_as_of date|t|f|f|f|t`
- the ledger row `20261115190000 | forge_latest_trend_bands`;
- STABLE, SECURITY INVOKER, `search_path=pg_catalog`, owner postgres, the four-argument signature;
- EXECUTE for service_role yes; anon, authenticated and PUBLIC no;
- the comment present.

## Smoke (2 read-only requests, 19:30:22Z; 0326 team 2's 18 players as of 2026-11-15)
- **SQL as service_role** (read-only, 8 s timeout): 144 keys returned, all 144 with a row. `EXPLAIN (ANALYZE, BUFFERS)`: Function Scan, 144 rows, execution 2.4 ms, shared hit 724. That was warm, after the count.
- **PostgREST GET** `/rest/v1/rpc/forge_latest_trend_bands`: HTTP 200 and 144 rows, so the schema cache sees the function. The service-key header file was deleted.
- **Data seen:** all 18 players have rows. 4 have their newest band on 2026-11-15 (age 0) and 14 on 2026-11-11 (age 4).

## After the apply
- Authority row 151 is set to `applied` with this receipt.
- Baseline-test pins are now 117 applied / 6 pending.
- The super-goal sentence is updated.
- The deployed writer is unchanged: it still reads by the table GET until the reader is released.
- The next capture can now use the RPC once the reader commit is the candidate.

**Rollback:** `supabase/tests/forge_latest_trend_bands_rollback.sql` (it also needs the ledger row removed). It was not run; running it needs TJ's approval.
