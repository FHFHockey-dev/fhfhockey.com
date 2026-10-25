# Smallest next data-read request — proposed, not executed

Purpose: determine whether the five already captured L5 appearances have matching regular-season game identities and contract-v1 completion manifests. This fills an evidence field omitted from the original diagnostic; it does not reread the accepted metric totals or run a repair.

**Proposed authority:** one read-only transaction on the previously confirmed FHFH Supabase project `fyhftlxokyjtpndbkfse`, using [PROPOSED-READ-ONLY-COMPLETION.sql](PROPOSED-READ-ONLY-COMPLETION.sql) exactly after the parent reconfirms the project. No authorization has been requested or consumed by this worker.

- One SELECT; exactly five requested game IDs taken from the frozen capture; at most five output rows.
- Only `public.games` and `public."statsUpdateStatus"`, joined on their game identity keys. Explicit columns; no private user/league/account information.
- `BEGIN READ ONLY`, five-second statement timeout, one-second lock timeout, `ROLLBACK`; concurrency one, ten-second total execution budget, zero retries.
- No application endpoint, RPC, provider request, refresh, cron, backfill, write, deployment or additional player/cohort read.
- Retain query text/hash, returned JSON/hash, actual query timestamp and result/error. Stop once the single response is received; an error or missing row is a blocker, not permission to broaden the read.

Review outcomes:

1. Missing game/manifest, non-regular type, wrong season/date, unverified legacy outcome, quarantine, incomplete row counts or no ingestion timestamp: retain the finality/history block and report the exact row.
2. Complete contract-v1 rows: compare with the inspected final-state writer contract. `ingestion_completed_at` remains an ingestion timestamp. Any use as a conservative “known final by” bound requires explicit semantics review and a cutoff at or after that bound; do not relabel it actual game-end time.
3. Either result still leaves full history, UTC date semantics, provider/model/placeholder meaning, source freshness and the all-NHL metric population unresolved. No live/rank/premium activation follows from this read alone.

The query is source/schema-checked locally, not database-planned or executed. Expected resource work is five indexed game-key lookups in each table. Actual execution cost and runtime remain unmeasured; the declared timeout and row bound are the stop conditions.
