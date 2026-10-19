# R6 slice S-1: one server-side forecast source (local build, 2026-10-19)

Built against `tasks/artifacts/forge-native-serving-plan-2026-10-19/PLAN.md` §2 and §4 S-1, with TJ's decisions D-1 (serve-and-flag) and D-2 (empty fallback). Everything is uncommitted on `octoberBranch`. There were no deploys, production requests or env changes.

## No post-freeze patch is staged

Neither frozen file (`nativeCatalogHead.ts`, `contributionStore.ts`) was edited, and S-1 does not need either one changed.

PLAN §1.3 asked `nativeCatalogHead.ts:90` to also return the selection's `issuedAt`/`expiresAt`. Instead, the selector reads them itself:

- **On success:** one extra read of the immutable selection row the head points at, checked against the head's `payload_hash`.
- **On failure:** a head read plus a selection read. This only classifies `native_catalog_expired` apart from `native_catalog_head_unavailable_or_invalid`, because the resolver reports every failure the same way.

After the freeze, a resolver change could return the window and the expiry reason directly and remove those reads. That is optional cleanup, not a requirement.

## Files

| File | Change |
|---|---|
| `web/lib/player-forecasts/forecastServingSource.ts` (new) | `selectForecastServingSource`, `unavailableForecastServingSource`, `forecastSourceSummary` |
| `web/lib/rosterScheduleData/planning.ts` | `loadPlanningData(..., { source })`. Without a source it selects one itself. Loaders read `source.environment`, and the fallback reason is added to the limitations |
| `web/lib/player-forecasts/gameExpectationReader.ts` | `loadGameExpectations(db, scope, now, { source })` passes the source through |
| `web/pages/api/v1/start-chart.ts` | The server selects the source. `forecast_source` is still accepted but ignored (C-3). The cache key holds the kind and head revision, and no entry or `s-maxage` outlives `forecastSource.expiresAt`. `legacy_flagged` row flag. `empty` board |
| `web/pages/start-chart.tsx` | Requests `/api/v1/start-chart?date=` (same URL as the dashboard) |
| `web/pages/api/v1/roster-schedule-optimizer/data.ts` | One selection per request, passed to planning. `forecastSource` sits beside `data`. Native `s-maxage` is capped at the catalog expiry |
| `web/pages/api/v1/forge/forecasts.ts` | One selection, passed to the reader. `forecastSource` is in the body, and `s-maxage` is capped at the catalog expiry |
| `web/lib/rosterScheduleData/planningDataTransport.ts` | **Unchanged.** `forecastSource` sits beside `data`, not inside the strict transport schema, so a client bundle from before the deploy still decodes `/data` |

Tests:
- New: `web/lib/player-forecasts/forecastServingSource.test.ts` and `web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts`.
- New cases in `web/__tests__/pages/api/v1/start-chart.test.ts`: C-3, `legacy_flagged`, `empty`, the A-8 cache key and the A-4 page/dashboard parity.
- Updated: the existing native start-chart cases select native through the mocked selector rather than the query parameter. The page test URLs and one `forge/forecasts` call assertion were also updated.

## Behaviour by kind

| Kind | When | Start Chart (page, API, dashboard) | RSO `/data`, FORGE `forge/forecasts` |
|---|---|---|---|
| `legacy` | `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` unset | Today's legacy board. No head or season lookup, and `forecast_source=game_expectations` also gets legacy. Unlabelled skater runs keep `unverified_projection_provenance` (D-1). Adds `forecastSource` | Process-env pins (none in production). Cache headers unchanged |
| `native` | Head resolves and `now < expiresAt` | Native game-expectation board from the head's pins only | Head pins only. `s-maxage` ≤ time left until catalog expiry |
| `legacy_flagged` | Head set but unusable, and `FORGE_NATIVE_SERVING_FALLBACK=legacy_flagged` exactly | Legacy board. Every skater and goalie row is flagged `native_unavailable_legacy_fallback`. The D-1 provenance flag still applies | Blank pins, so no forecasts (C-5). Reports the kind and reason |
| `empty` | Head set but unusable, and any other fallback value (including unset) | The slate's games with `players: []` and no goalies. `serving.reason` is the native reason, with a plain message the page already displays | Blank pins, so no forecasts |

**Unusable** means the resolution failed, the head is missing or malformed, the season is wrong or unresolvable, the selection has expired (`native_catalog_expired`), or the 8 s deadline was missed (`native_catalog_head_unavailable_or_invalid`).

## Left for release assembly

1. Re-pin `slice.json`: add `forecastServingSource.ts`, its test, the RSO `/data` route test and `gameExpectationReader.ts`, and re-pin `start-chart.ts`, `planning.ts`, the page and the routes.
2. The B2 schedule writers (`source.ts`, `update-roster-optimizer-schedule.ts`). D-5 is undecided.
3. S-2's single provenance policy beyond the existing Start Chart flag.
4. S-3's per-component dashboard parity. The A-4 test here proves:
   - all six callers and the page send the same `date`-only request, with no `forecast_source`;
   - they get one cached board;
   - they parse it with the shared `normalizeStartChartResponse`.

   It does not render `SlateStripCard`, `TeamPowerCard` or the team page.
5. D-6, the expiry window.
6. Cost note: while native is active, every Start Chart request (including cache hits) makes a season lookup and about 4 head/selection reads to build the cache key. Pre-activation adds none.
