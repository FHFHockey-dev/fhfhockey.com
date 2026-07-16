# Pre-baseline migration archive — 2026-07-16

This directory preserves both histories that existed before the supported schema-baseline reconciliation:

- `authoritative-root/` contains the 34 SQL files from authoritative commit `47066fa25fca3ef8b78f98af1a06efbcb064e7c4`.
- `production-ledger/` contains the exact 42 SQL statements fetched from the production migration ledger.
- `SHA256SUMS` records all 76 archived SQL files. These files are evidence, not an active replay chain.

The active `supabase/migrations/` directory intentionally contains one reviewed current-schema baseline followed by the A-GDL source-provenance/RPC delta and the NEW 55 trigger-auth delta. Production history reconciliation registers the baseline without executing its schema dump against the populated database; only the reviewed post-baseline deltas execute there.

## Baseline source and exclusions

The baseline was generated from the 2026-07-16 schema-only production `public` dump (source SHA-256 `90e0b4a9067c1451243c7d976eba478b16dd811a9cee81079619d14969e70970`). It normalizes pg_dump client meta-commands and `CREATE SCHEMA public` for migration replay. Its generated SHA-256 is `0cac4c4434d90daed186a08ce3525bdea46afe4f1c98e77c1d1eec06de659de9`.

Seven exact objects are omitted from the baseline:

- the three credential-bearing `lineCombinations` trigger functions;
- their three triggers, all recreated by the NEW 55 delta with the same route and row semantics; and
- credential-bearing `public.update_all_wgo_skaters()`, tracked separately as NEW 56 because production has no proven internal consumer but an unknown external RPC consumer cannot yet be excluded.

The baseline contains zero occurrences of `Authorization` or `Bearer`. It does not contain any secret value.

## Squash-omitted data and configuration manifest

The baseline is intentionally schema-only. The archived ledger retains every historical data statement, but a new Supabase branch is data-less and must not replay production-specific backfills or identity decisions onto absent source rows.

| Category | Disposition | Verification boundary |
|---|---|---|
| Yahoo ownership/history transforms | Archived; not replayed | Production data remains unchanged; blank branches have no source rows. |
| Connected-account token encryption and per-row Vault token creation | Archived; not replayed | Environment/data dependent; no token or secret value is committed. |
| Identity-registry and Yahoo mapping backfills/promotions | Archived; not replayed | Production decisions remain in production; blank branches have no source identities. |
| Draft Ranker initialization, prospect insertion, and ordering/materialization backfills | Archived; not replayed | Operational data/bootstrap content is outside schema reproducibility and remains absent on a data-less branch. |
| Cron jobs/schedules | Environment managed; not replayed | The 42-entry ledger contains no `cron.schedule` or `cron.alter_job`; production job definitions/schedules are preserved and verified separately. |
| Canonical `cron_secret` | Environment managed; never committed | Branch auth tests use only rollback-contained dummy state; production uses the existing unique Vault secret. |
| Auth/storage/provider settings and storage buckets | Provider managed; not represented by the `public` schema dump | Compare provider/catalog invariants separately; do not synthesize values in SQL. |
| Seed file | Disabled | `supabase/config.toml` sets `[db.seed].enabled = false`; no canonical value-bearing seed exists. |

The active baseline already reflects the resulting current table/function/index/policy schema of historical transforms. Any later need for static reference data must be introduced as a new, explicit, reviewable post-baseline migration rather than copied implicitly from production.

## Replay and production gates

Before production history repair:

1. Replay the three active migrations on a blank PostgreSQL 15 Supabase branch.
2. Prove catalog counts, ACLs, the A-GDL RPC contract, all three trigger semantics, missing-secret fail-closed behavior, and rollback-only dummy-secret queue cardinality.
3. Compare the replayed schema to the reviewed baseline and run Supabase security/performance advisors.
4. Reconcile production migration tracking by compare-and-swap evidence, register the baseline without executing it, and apply only the two reviewed deltas.
5. Preserve production cron jobs, Vault values, application data, and all archived SQL unchanged.
