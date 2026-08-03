# WGO Relocation-Era Identity Contract

**2026-08-03 local WGO contract verification:** The active writer already resolves each requested season through `createSeasonAwareWriterTeamsFromLineageRecords` before its first `wgo_team_stats` read. The stale source assertion was updated to that canonical lineage call; focused authority verification passes `28/28`, full local Vitest passes `642` files / `3,599` tests, and targeted lint/format/diff checks pass. This changes no writer, data, repair, provider, deployment, or authorization state.

## Scope

This contract closes the evidence and design scope of `B-CLEAN NEW 107` without authorizing a production backfill. It covers the WGO all-seasons team writer and the relocation-era rows already stored in `public.wgo_team_stats`. The 2024–25/2025–26 Utah correction remains separately owned by NEW 104/105.

## Authoritative identity

- Daily NHL team-stat payloads are authoritative for metric values and `franchiseId`, but not historical display identity: the API returns current franchise branding for historical Atlanta, Phoenix, and Utah dates.
- NHL Records `franchise-team-totals` regular-season rows are authoritative for `franchiseId`, `teamId`, `triCode`, `teamName`, `firstSeasonId`, and `lastSeasonId`.
- NHL club season schedules are authoritative for per-date team/opponent/game identity.
- A writer season must select exactly one regular-season lineage row per active franchise. Missing, malformed, overlapping-franchise, duplicate-team, or duplicate-tricode lineage fails the run before WGO writes.

The forward writer fetches the lineage catalog once per run, selects the exact identity for every requested season, and continues to join the remaining daily datasets by `franchiseId`. A live value-free validation resolves all 109 NHL seasons from 1917–18 through 2026–27 across 120 lineage rows, including every Atlanta/Winnipeg, original Winnipeg/Phoenix/Arizona, and Utah transition.

## Current production inventory

Read-only aggregate SQL finds 38,484 WGO rows across 16 seasons from 2010–11 through 2025–26. The complete pre-Utah relocation defect is:

| Stored season | Stored identity      | Required identity      | Rows/dates |
| ------------- | -------------------- | ---------------------- | ---------: |
| 2010–11       | Winnipeg Jets / 52   | Atlanta Thrashers / 11 |         82 |
| 2010–11       | Arizona Coyotes / 53 | Phoenix Coyotes / 27   |         82 |
| 2011–12       | Arizona Coyotes / 53 | Phoenix Coyotes / 27   |         82 |
| 2012–13       | Arizona Coyotes / 53 | Phoenix Coyotes / 27   |         48 |
| 2013–14       | Arizona Coyotes / 53 | Phoenix Coyotes / 27   |         82 |

The cohort is exactly 376 rows on 376 distinct dates. All 376 currently have null `game_id` and `opponent_id`; no target `(season_id, required_team_id, date)` row exists. Official club schedules independently contain exactly 82 Atlanta games and 294 Phoenix games across those same five season scopes, each on a unique date with a complete opponent ID.

## Separately authorized backfill design

No SQL or production mutation is part of NEW 107 closure. A future authorized repair must:

1. Freeze the five-scope manifest above and the exact source-row digest.
2. Load the matching official club schedules and require one exact regular-season game for each of the 376 dates.
3. Run one transaction under an advisory lock covering the WGO relocation repair.
4. Recheck 376 source rows, zero target-key conflicts, null current links, and unchanged source digest.
5. Insert exact copies under team IDs 11/27 with historical names and resolved `game_id`/`opponent_id`; preserve every metric value.
6. Verify 376 inserted rows, unique target keys, complete game/opponent links, and metric digests equal to their source rows before deleting the five wrong-identity scopes.
7. Verify total table cardinality is unchanged, all 376 wrong keys are absent, all 376 required keys exist, and a physical replay performs no DML.
8. Persist a value-free receipt with scope counts/digests and retain an inverse manifest that can restore the original keys if post-write verification fails.

The repair must not select, update, delete, or validate Utah IDs 59/68 or seasons 2024–25/2025–26; those remain under NEW 104/105 and require their own production-mutation authorization.
