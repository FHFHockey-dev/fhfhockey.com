# Paired publish at D = 2026-11-19 · Nov 21 2026

**Published and verified.** Live Rankings moved from the Nov 14 pair to the Nov 19 pair in one step. All five completion markers sit at Nov 19 with 784 distinct skaters. TJ's instruction: publish the Nov 19 pair only, using the dry-run inputs, with no window advancing on its own.

## Before writing

- **Reader guard (deployed `f47905d28`, `entityMetricRankingReader.ts`).** A window serves date D only when that window's Rankings marker and the season composite marker at D are both `complete`. Otherwise it falls back to the newest complete pair. The matrix joins composites on the exact served date. Comparison, snapshot and war read through the matrix and touch no table directly.
- **Writer guard gap, handled by sequencing.** `skaterCompositeWriter` checks only the **season** Rankings marker before writing. If a last 5/10/20 window had failed, a composite write would have advanced the other windows without it. I therefore wrote composites only after SQL showed all four Rankings markers complete. No code change was made.
- **No conflicting work.**
  - `cron_job_audit` for the last 3 h showed only this session's two dry runs.
  - No `pg_cron` job was running. The only rolling `pg_cron` job is Sun 08:15 UTC.
  - The deployed Vercel crons write rolling data only at 10:xx UTC, and there is no Rankings or composite cron.
  - No marker was `writing`.
- **Same inputs as the dry runs.** 5v5 rolling rows ≤ Nov 19 numbered 12,887, equal to the composite dry run's scanned rows. Max `updated_at` was unchanged: rolling 11:54:20.158111 UTC, support 11:54:19.84258 UTC.

## Writes (isolated `next dev 127.0.0.1:3110` from a clean export of `f47905d28`, loopback admin trust)

| UTC | Call | Result |
|---|---|---|
| 17:50:08 | `update-entity-metric-rankings?season=20262027&as_of_date=2026-11-19&dryRun=false` | 200 in 114.0 s. 53,312 built = upserted = **53,312 reported by the database** (same as the dry run). Four windows `complete`, completed 17:50:48 → 17:52:01. |
| gate | SQL | All 4 Rankings markers `complete` at Nov 19 with 13,328 rows and 784/784 each. Every window stored the same 784-skater ID set (md5 `219d50d526a0a5df7945c3559d510941`, checked on the first and last metric). **0** composite rows at Nov 19, so readers still served Nov 14. |
| 17:53:24 | `update-skater-composite-ratings?season=20262027&as_of_date=2026-11-19&dryRun=false` | 200 in 25.6 s. 784 built = upserted = **784 reported by the database**. `completion.status=complete`, coverage verified at 784 with 0 stale or missing players. Completed 17:53:50.261. |

The server was stopped by exact PID. TJ's `:3000` was untouched. Two earlier read-only verification SELECTs timed out: the date filter can't use an index because the dispatch migration's date index isn't applied. They wrote nothing.

## Verification

- **Five markers at 2026-11-19, all `complete`:**
  - Rankings season, last 5, last 10 and last 20, each with 13,328 rows (database-reported) and 784/784 skaters, `contextual_rankings_v1`.
  - Season composite with 784 rows and 784/784 skaters, `contextual_composites_v3`.
- **Composite rows:** 784 rows for 784 distinct players. The ID set md5 is `219d50d5…`, identical to all four Rankings windows. One null MCM (Nov 14 also had one).
- **No incomplete markers anywhere.** The Nov 14 pair is intact (5 complete) as the fallback.
- **Live readback, 17:54 UTC (5 sequential GETs, all 200, all served Nov 19):**

| Request | Time | `snapshotDate` / latest | Ranked | Composites in the 10 rows |
|---|---:|---|---:|---|
| Matrix, season | 6.57 s | 2026-11-19 / 2026-11-19 | 784 | 10/10 at 2026-11-19, 0 null MCM |
| Matrix, last 5 | 3.40 s | 2026-11-19 / 2026-11-19 | 784 | none (pre-existing, see below) |
| Matrix, last 10 | 3.12 s | 2026-11-19 / 2026-11-19 | 784 | none (pre-existing) |
| Matrix, last 20 | 2.83 s | 2026-11-19 / 2026-11-19 | 784 | none (pre-existing) |
| Comparison (default 6) | 2.84 s | 2026-11-19 | — | 6 subjects |

## Pre-existing gap, not caused by this publish

The matrix joins window-specific composites (`last_5/10/20`), but composites have only ever been written for the season window (Nov 11, 13, 14 and 19). The last 5/10/20 views showed no composites on Nov 14 either. Out of scope here.

Receipts: [rankings-publish.json](publish/rankings-publish.json) · [composites-publish.json](publish/composites-publish.json) · [live readback](publish/live/)
