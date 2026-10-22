# §5.3 / §5.4 — three approved reads

Observed 2026-10-20 16:07 UTC (11:07 America/Chicago), linked production project `fyhftlxokyjtpndbkfse`. TJ directly approved the three specific queries in this chat. Exactly three sequential SQL executions, each read-only with a 10-second statement timeout and rollback. No application/ingestion/refresh/cron request, extra query or write. [Exact queries and aggregate results](PRODUCTION-READS.json).

## NST catch-up dates (§5.3)

All eight tables have rows on every date from 2026-09-29 through 10-18; none has rows on 09-28. The schedule reports a regular-season game on each requested date. No coverage pattern supports a blanket one-day-back shift across this window. This does not prove row values/teams belong to the labeled dates, nor identify which manual invocation wrote them.

On 10-04 all-strength and ES tables have 10 teams; PP/PK tables have 9. Special-team participation/filtering can change table counts, so this is not by itself a missing-row finding. No extra identity read or repair was authorized or performed.

## Sustainability (§5.4)

No `missing_window_z_*` warning keys matched score rows for snapshots 10-13 through 10-20. There are therefore no observed remaining repairable keys under that predicate. This result does not count all score rows or establish which rebuilds ran; absent/deleted rows and changed policy remain indistinguishable. Do not mark historical rerun execution proven from an empty warning-key result.

## Sweep summaries (§5.4)

The bounded normalization-status cohort contains 171 games, all status `complete`, across 09-19 through 10-19. 82 have a missing/stale player-summary partition marker by the released sweep predicate. On 10-19 specifically all four games have a fresh marker and zero incomplete normalizations.

This establishes current marker freshness for 10-19 and a broader remaining backlog, not the invocation history or completeness of every player/team summary row. The handoff records a partial-write marker weakness. No sweep was invoked, and no automatic retry or repair follows from this read approval. Claude owns any operational repair proposal.
