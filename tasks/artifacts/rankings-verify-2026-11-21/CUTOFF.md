# Current-season Rankings cutoff · read-only check, Nov 21 2026

TJ approved up to 10 read-only SELECT statements on production Supabase (`fyhftlxokyjtpndbkfse`). Seven ran, one at a time, each with `statement_timeout = 15s`: markers, an EXPLAIN, Rankings physical counts, composite cohort, source coverage, support coverage, and 5v5 input nulls. Migration status came from the Supabase `list_migrations` metadata call. Nothing was written.

## Served pair: Nov 14, complete at row level

`ranking_publications` holds exactly one 2026-27 publication date, **2026-11-14**. All five markers are `complete` and pass `completePublicationCount`: `min_gp` 1, `min_toi_seconds` 300, `db_written_rows = expected_rows`, `written_entities = expected_entities`.

| Surface / window | Marker rows | Physical rows | Marker skaters | Physical skaters | Metrics | Methodology | Completed (UTC) |
|---|---:|---:|---:|---:|---:|---|---|
| Rankings season | 13,175 | 13,175 | 775 | 775 | 17 | contextual_rankings_v1 | Nov 15 20:30:04 |
| Rankings last 5 | 13,175 | 13,175 | 775 | 775 | 17 | contextual_rankings_v1 | Nov 15 20:30:24 |
| Rankings last 10 | 13,175 | 13,175 | 775 | 775 | 17 | contextual_rankings_v1 | Nov 15 20:30:41 |
| Rankings last 20 | 13,175 | 13,175 | 775 | 775 | 17 | contextual_rankings_v1 | Nov 15 20:30:59 |
| Season composite | 775 | 775 | 775 | 775 | — | contextual_composites_v3 | Nov 15 20:36:13 |

- The composite player set equals the season-window Rankings set at Nov 14 (0 missing in either direction). The last 5/10/20 windows were checked by count (775 each), not by set equality. 774 of 775 composites have an MCM score; one is null.
- No `entity_metric_rankings` rows exist after Nov 14 for this season/5v5/all-skaters scope. There are no unmarked or `writing` later dates. Composite rows also stop at Nov 14.
- Older unmarked dates Nov 11 and Nov 13 exist (740 and 769 skaters). The reader ignores them once markers exist.

## Newest cutoff the sources support: Nov 19

| Hockey date | Scheduled games | WGO games / appearances | 5v5 rolling games / rows | Appearances lacking a 5v5 row | Rows with support (game id match, same run) | Rolling written (UTC) |
|---|---:|---:|---:|---:|---:|---|
| Nov 14 | 14 | 14 / 504 | 14 / 504 | 0 | 504 | Nov 15 08:15–10:21 |
| Nov 15 | 5 | 5 / 180 | 5 / 180 | 0 | 180 | Nov 16 10:10–10:16 |
| Nov 16 | 2 | 2 / 72 | 2 / 72 | 0 | 72 | Nov 17 10:10–10:16 |
| Nov 17 | 11 | 11 / 396 | 11 / 396 | 0 | 396 | Nov 18 10:12–10:20 |
| Nov 18 | 3 | 3 / 108 | 3 / 108 | 0 | 108 | Nov 19 10:10–10:15 |
| Nov 19 | 12 | 12 / 432 | 12 / 432 | 0 | 432 | **Nov 21 11:44–11:54** |
| Nov 20 | 0 (off-day) | — | — | — | — | — |
| Nov 21 | 14 (tonight) | — | — | — | — | — |

The 5v5 inputs the Rankings writer reads have **zero nulls** on every date Nov 14–19, the same as the published Nov 14: season TOI average, last 5/10/20 TOI totals, goals/60 and ixG/60 inputs, points average, on-ice xGF and GF averages, and non-positive TOI.

Every support row has payload schema version 1 and a timestamp within 10 minutes of its rolling row. Nov 19 landed about 26 hours later than the usual ~10:15 UTC slot.

This covers schedule, WGO, rolling and support row coverage plus core input nulls only. It does not reproduce the full K1 readiness gate: NST terminal audits, final boxscore heads, and the single-revision proof. That gate's function, `read_rankings_publication_readiness`, is **not deployed**. Neither `20261118151903_rankings_publication_readiness` nor `20261118160000_rankings_daily_dispatch` appears in production `list_migrations`. The newest applied Rankings migration is `20261115210000_ranking_publications`.

## Verdict

**The served cutoff is stale.** The newest complete pair is Nov 14, and it is internally consistent. Source rows through Nov 19 appear complete, so five hockey dates (Nov 15–19) are unpublished.

First broken dependency: **the publication step itself**. Sources are not the blocker at row level. Specifically:
- the deployed SHA `f47905d28718` has no `pages/api/internal/rankings-daily-publication.ts`;
- `web/vercel.json` at that SHA registers no Rankings cron;
- the readiness and dispatch migrations are unapplied;
- the only publication ever written was the manual Nov 15 one.

This matches the Nov 18–19 decision to hold the K1 canary and leave the observer unscheduled. Nothing regressed; it was never switched on. The late Nov 19 rolling run belongs to the off-day pipeline lane (`tasks/artifacts/daily-offday-release-2026-11-21/`) and was not chased here.

## Smallest fix (proposed, not run)

No code defect was found, so the fix is operational: a **forward-only paired publish at D = 2026-11-19**, following the Nov 15 first-marked-publish procedure (`../rankings-acceptance-2026-11-14/first-marked-publish/PACKET.md`). Nov 14 keeps serving until all five markers for D complete.

1. **Testable step, done Nov 21 and passed ([DRYRUN.md](DRYRUN.md)).** Run the Rankings dry run `update-entity-metric-rankings?season=20262027&dryRun=true`, then the composites dry run at `as_of_date=2026-11-19`. Use the isolated `:3110` server from a clean export of the deployed SHA. On Nov 15 these took 20.3 s and 11.5 s. They read production, and each writes its normal cron-audit row.
2. **Publish, separate approval.** Write Rankings and then composites at D, then read back the markers and physical rows.
3. **Caveat.** The manual path bypasses the K1 readiness gate (NST audits, final boxscore heads, single-revision proof), the reason for the Nov 18 hold. The checks here cover rows, support and input nulls only.

The durable fix, releasing K1 (route, migrations, schedule), needs a deploy and migrations and is out of scope.
