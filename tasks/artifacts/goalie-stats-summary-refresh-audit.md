# Goalie Stats Summary Refresh Audit (`1.4`)

## Findings

### 1. The canonical refresh path already rebuilds goalie summary snapshots from the same shared source-of-truth pipeline.

- The shared summary refresh module delegates to `buildPlayerStatsLandingSummarySnapshotsForGameIds(...)` in [`web/lib/underlying-stats/playerStatsSummaryRefresh.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.ts:223).
- Inside the shared summary builder, each supported strength iterates both `"onIce"` and `"goalies"` modes when creating summary rows in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:3383).

Conclusion:

- There is no verified goalie-only ingest gap in the summary snapshot build path.
- Goalie summary rows are already first-class outputs of the canonical shared summary builder.

### 2. Both refresh entry points already reuse the shared summary refresh helper with no goalie-specific branches.

- The heavy route at [`web/pages/api/v1/db/update-player-underlying-stats.ts`](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-player-underlying-stats.ts:218) does:
  1. raw NHL Gamecenter ingest
  2. `refreshPlayerUnderlyingSummarySnapshotsForGameIds(...)`
  3. optional landing-cache warm
- The summary-only route at [`web/pages/api/v1/db/update-player-underlying-summaries.ts`](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-player-underlying-summaries.ts:358) also delegates directly to `refreshPlayerUnderlyingSummarySnapshotsForGameIds(...)`.

Conclusion:

- The goalie branch should reuse these existing refresh URLs instead of introducing goalie-only maintenance endpoints.

### 3. Legacy-summary migration and raw rebuild behavior are also shared and therefore already cover goalie rows.

- `refreshPlayerUnderlyingSummarySnapshotsForGameIds(...)` can either:
  - migrate legacy summary payload rows with `buildPlayerStatsLandingSummarySnapshotsFromPayloadRows(...)`, or
  - rebuild fresh snapshots with `buildPlayerStatsLandingSummarySnapshotsForGameIds(...)`
  in [`web/lib/underlying-stats/playerStatsSummaryRefresh.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.ts:197).

Conclusion:

- The existing repair/backfill paths are already goalie-compatible because they operate on shared summary snapshots, not skater-only snapshot types.

### 4. The shared refresh path invalidates the shared season aggregate cache after snapshot writes, so goalie reads stay consistent with rebuilt summaries.

- After summary upserts, `invalidatePlayerStatsSeasonAggregateCache()` is called in [`web/lib/underlying-stats/playerStatsSummaryRefresh.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.ts:208).

Conclusion:

- No goalie-specific cache invalidation path is required for correctness.

### 5. The optional landing-cache warm step is not goalie-specific today.

- `warmPlayerStatsLandingSeasonAggregateCache(...)` starts from `createDefaultLandingFilterState()` in [`web/lib/underlying-stats/playerStatsSummaryRefresh.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.ts:111).
- The default stat mode is still `onIce` in [`web/lib/underlying-stats/playerStatsFilters.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.ts:29).
- The warm step only overrides season range and season type, not stat mode, display mode, or strength in [`web/lib/underlying-stats/playerStatsSummaryRefresh.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.ts:113).

Conclusion:

- This is not a goalie ingest gap or data-correctness blocker.
- It does mean the current optional cache prewarm is optimized for the default shared landing state, not explicitly for goalie caches.
- The dedicated goalie route can still read correct data after refresh; it may just take the cold-read path unless a goalie-specific warm strategy is added later.

## Recommended Reuse Boundary

Safe to reuse as-is for the dedicated goalie route:

- `/api/v1/db/update-player-underlying-stats`
- `/api/v1/db/update-player-underlying-summaries`
- `refreshPlayerUnderlyingSummarySnapshotsForGameIds(...)`
- shared summary snapshot schema and storage endpoint
- shared cache invalidation after snapshot writes

Not required for goalie correctness, but potentially useful later:

- a goalie-specific landing aggregate warm step
- a multi-mode warm strategy that prewarms goalie counts/rates caches alongside the default on-ice cache

## Verified vs Inferred

Verified:

- shared summary refresh helper rebuilds goalie rows
- heavy refresh route and summary-only route both delegate to that helper
- legacy migration and raw rebuild paths both feed the shared snapshot builder
- summary writes invalidate the shared aggregate cache
- the current warm step uses the default landing state, which is not goalie-specific

Inferred:

- the dedicated goalie route should keep using the current shared refresh URLs unless product explicitly wants goalie-oriented cache warming as part of route performance work
