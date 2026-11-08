# DISCOVERY-NOPUNDIT receipt (audit F3), 2026-10-26, Claude

Not committed. The orchestrator commits.

## Change
- `web/lib/draft-ranker/discoveryServer.ts`: removed the `projectionSourcesConfig` import, `loadProjectionHealth`, `exactCount` (it had no other caller) and `sourceSeasonFromProjectionTable`. Discovery no longer issues the nine `PROJECTIONS_*` `count: exact` reads on any GET dry run or POST. `sourceHealth` now holds only the five native sources (yahoo_players, nhl_api_game_roster_spots, player_lineup_deployment_tallies, nhl_player_contracts, forge_roster_events). The `projection:*` rows and their `projection_season_mismatch`, `projection_observed_at_missing` and `projection_table_unreadable` warning codes are gone.
- Snapshot shape is unchanged. `projectionConsensus` is still `buildProjectionConsensus({ observations: [] })`, so it stays `[]`, and the `replace_draft_ranker_discovery_snapshot` RPC still gets an array. `sourceSummary` gains `projectionSources: "not_used"` and keeps `projectionConsensusPlayers: 0`.
- `web/lib/draft-ranker/discovery.test.ts`: added two tests.
  1. A structural AST guard over every non-test `.ts` and `.tsx` file in `lib/draft-ranker/**`. It flags string, template or regex literals that match `projectionsConfig/projectionSourcesConfig` or `PROJECTIONS_`, and the identifiers `PROJECTION_SOURCES_CONFIG` and `useProcessedProjectionsData`. It mirrors `lib/projections/nativeInputEligibility.test.ts`. Run against the HEAD baseline, the same check flagged 3 offenders (the import plus two `PROJECTION_SOURCES_CONFIG` uses). It flags none now.
  2. A behaviour test that builds a snapshot with an offline allow-list fake client. Any table outside the allow-list throws, and `rpc` throws. The test asserts no projection table is touched, `projectionConsensus` is `[]`, the health keys are exactly the five native sources, no `projection_*` warnings remain, and there are no projection_gap, previously_undrafted or cutoff_challenger signals.

## Readers checked (none changed)
- `discoveryReadServer.ts` `emptyMessage`: its `projection:` / `season_mismatch` branch no longer matches new runs, so it falls through to the stale or generic message. Runs persisted earlier still show the old message. Its dynamic signals come from `draft_ranker_discovery_projection_consensus` for the latest run, which is now always empty. So no pundit-driven ranking path remains.
- `components/DraftRanker/DraftDiscovery.tsx` only counts the health rows by `health_state`, so fewer rows is fine. Its `projection:` label helper is now unused for new data, and I left it alone (UI is outside this lane).
- `pages/api/v1/db/refresh-draft-ranker-discovery.ts` uses `projectionConsensus.length`, and that still works. Unchanged.
- `exportServer.ts` reads the materialized consensus table, not a pundit table. Unchanged.

## Checks (all local; no DB, production or refresh-route calls)
- `npx vitest run lib/draft-ranker`: 13 files, 84 tests, passed.
- Adjacent suites with the above: components/DraftRanker, draft-ranker-health, cron-audit-wrappers and yahoo writerPermissions. 23 files, 188 tests, passed (run before the final whitespace-only formatting pass).
- `npx eslint` on both changed files: clean.
- Whole-project `npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` (noclobber; the lock was free, then released): passed with exit 0 on the final files. The default heap ran out of memory, so it needed `NODE_OPTIONS=--max-old-space-size=8192`.
- Prettier: the test file is formatted. `discoveryServer.ts` already had one formatting difference before this change, at line 178, which I did not touch.

## Hashes (sha256)
| file | baseline (lease) | final |
|---|---|---|
| web/lib/draft-ranker/discoveryServer.ts | 07ebade83d8aa3bcd60b7d94089a17f2a29c9aa005e409da1a134758f380488a | 35f2d94b8ed5638d84902d23c821fb4cfb250676f4923d4ef17e032eeeba1eba |
| web/lib/draft-ranker/discovery.test.ts | 468720f5db889ba4e8251dd0f961321bdf182ad4a990199e2745830ac82fa1f6 | 4babf496bd5eb3cc428f7a3761cc041d136efb38995a426d6dbd3e40090ee001 |
| web/lib/draft-ranker/discoveryReadServer.ts | 87f204566084834b4afeb7e081b84660f15c9c4aa452ea3c36731e17fc63b449 | unchanged |
| web/pages/api/v1/db/refresh-draft-ranker-discovery.ts | 73b0eff48ab3841a2e61520c84d955379931eab0d5a55274a8fa5cd0988f05cc | unchanged |

## Follow-ups (not done, outside lane)
- Optional cleanup: drop the `emptyMessage` projection-mismatch branch and the `projection:` label in DraftDiscovery.tsx once no old run is the latest completed run.
