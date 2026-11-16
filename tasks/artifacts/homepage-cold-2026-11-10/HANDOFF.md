# Transaction Trends follow-on candidate

## Outcome
Local three-file fix, not deployed. Canonical seasonal Yahoo keys are now used by Trends and understood by ownership snapshots. History pagination first reads cheap keys and hydrates only those keys, preserving all timeline observations, prior-point fallback, existing ordering, filters, source dates and caches. Numeric/name snapshot fallback and fail-closed ambiguity remain as before.

## Verified causes
- Production mapping view definition returns `player.player_key AS yahoo_player_id`. A bounded read-only inventory found 2373 mapping rows, all 2373 full seasonal keys, zero numeric IDs.
- Trends queried numeric `player_id` strings then called Number() on returned mapping keys. The identical code exists at commit9621935b9, before the released homepage cache change. This is an existing reader/schema mismatch, not a new caching regression.
- Existing retained local post-cache/pre-deploy bodies and production release smoke both showed0 mapped/4438 unmapped. No pre-cache response body with counts was retained.
- Production EXPLAIN (not ANALYZE) puts the historical JSON aggregate in a Result node below LIMIT/OFFSET. Successive1000-row pages rebuild histories for skipped players. For4438 players the plan requires1000+2000+3000+4000+4438=14438 player-history aggregations.
- Existing pg_stat_statements: unfiltered normalized-history request210calls, mean2541.31ms per page; seasonal variant70calls, mean452.29ms; filtered mapping query342calls, mean32.54ms. These are cumulative historical statistics, not measurements of this candidate.

## Fix and tradeoffs
- Page metadata keys with the original player_id/season sort; fetch full histories for up to500 exact keys per query at OFFSET0; reassemble original order. Reject incomplete or invalid identity pages instead of silently dropping players. No history-window truncation and no schema change.
- Fixture coverage of4438 players confirms each history is fetched once, with nine bounded history queries. Five cheap key pages add round trips; net source queries14 instead of5, but history aggregates decrease from14438 to4438. New wall-clock latency has not been measured.
- Mapping uses full seasonal keys and positive safe NHL IDs, and drops conflicting mappings. No invented numeric-ID fallback in Trends.
- Snapshots routes exact full-key identities to player_key and legacy numeric/name resolutions to player_id. Existing unresolved/cross-season ambiguity remains fail-closed; this is not a database identity repair.

## Verification and release
See tests.log, lint.log and TypeScript logs; CANDIDATE.json records final pins/results. No browser/UI change, no provider write, DB repair, migration, server restart, staging, commit, push or deployment. Other owners' dirty files and generated next-env changes are untouched.

Production application smoke budget from the prior release is exhausted. This continuation made no application requests to production or localhost backed by production. It used five read-only SQL calls (six statements: schema definition, old plan, existing query stats, mapping count and two new EXPLAIN statements). The last tool result includes only the last EXPLAIN. No ANALYZE or execution of full candidate history reads. A bounded authorized live measurement remains needed before claiming an end-to-end speedup.

Source scope:
- web/pages/api/v1/transactions/ownership-trends.ts
- web/pages/api/v1/transactions/ownership-snapshots.ts
- web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts
