# Downstream Failure Dependencies

## Scope

- `08:50 UTC` `/api/v1/db/calculate-wigo-stats`
- `10:20 UTC` `/api/v1/db/update-season-stats`
- `10:25 UTC` `/api/v1/db/update-rolling-games?date=recent`
- `10:30 UTC` `/api/v1/db/update-sko-stats`
- `10:35 UTC` `/api/v1/db/update-wgo-averages`
- `10:40 UTC` `/api/v1/db/sustainability/rebuild-baselines`
- `10:42 UTC` `/api/v1/sustainability/rebuild-priors?season=current`
- `10:43 UTC` `/api/v1/sustainability/rebuild-window-z?season=current&runAll=true`
- `10:44 UTC` `/api/v1/sustainability/rebuild-score?season=current&runAll=true`
- `10:45 UTC` `/api/v1/ml/update-predictions-sko`
- `10:46 UTC` `/api/v1/sustainability/rebuild-trend-bands?runAll=true`

## Direct Dependency Map

### calculate-wigo-stats

Benchmark result:

- timer: `05:00`
- reason: `fetch failed`
- summary: `null`

Direct failing dependency:

- not a single explicit table error captured at route level
- route depends on a broad source set:
  - `wgo_skater_stats_totals`
  - `nst_seasonal_individual_counts`
  - `nst_gamelog_as_counts`
  - `nst_gamelog_as_counts_oi`
  - plus writes to `wigo_career` and `wigo_recent`

Code evidence:

- [calculate-wigo-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts#L259)

Assessment:

- primary failure mode is route/runtime timeout on a broad multi-source aggregation path
- unlike several later routes, the benchmark did not capture a structured inner dependency error for this one

### update-season-stats

Benchmark result:

- timer: `02:50`
- reason: `Failed to determine latest processed game for goaliesGameStats ... <!DOCTYPE html>`

Direct failing dependency:

- `goaliesGameStats`

Code evidence:

- [update-season-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-season-stats.ts#L226)
- [update-season-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-season-stats.ts#L239)

Assessment:

- this route failed during its initial “latest processed game” lookup
- it did not fail while processing game payloads yet
- the direct blocker is the `goaliesGameStats` lookup path returning upstream HTML

### update-rolling-games?date=recent

Benchmark result:

- timer: `00:00`
- reason: `Error: require is not a function`

Direct failing dependency:

- none; this is a code defect

Code evidence:

- [update-rolling-games.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-games.ts#L6)

Assessment:

- standalone application defect
- not blocked by stale tables or upstream transport

### update-sko-stats

Benchmark result:

- timer: `01:18`
- reason: `Failed to determine latest sko_skater_stats date ... <!DOCTYPE html>`

Direct failing dependency:

- `sko_skater_stats`

Code evidence:

- [update-sko-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-sko-stats.ts#L114)

Assessment:

- this route failed during its latest-date lookup against its own destination table
- the benchmark shape indicates the lookup path itself received upstream HTML

### update-wgo-averages

Benchmark result:

- timer: `00:38`
- reason: `Failed to fetch data from nst_seasonal_on_ice_counts: <!DOCTYPE html>`

Direct failing dependency:

- `nst_seasonal_on_ice_counts`

Code evidence:

- [update-wgo-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-averages.ts#L946)
- [update-wgo-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-averages.ts#L405)

Assessment:

- clean direct dependency failure
- route never got past source-table fetch

### rebuild-baselines

Benchmark result:

- timer: `00:38`
- reason: `Supabase query error on table=player_stats_unified ... <!DOCTYPE html>`

Direct failing dependency:

- `player_stats_unified`

Secondary dependency:

- `player_totals_unified`

Code evidence:

- [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts#L149)
- [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts#L193)
- [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts#L199)

Assessment:

- direct blocker in the benchmark was `player_stats_unified`
- even if that succeeds, the route also depends on `player_totals_unified`

### rebuild-priors

Benchmark result:

- timer: `00:39`
- reason: upstream HTML in route error body

Direct failing dependency:

- `player_totals_unified`

Code evidence:

- [priors.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/priors.ts#L26)
- [priors.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/priors.ts#L96)

Assessment:

- this route builds league priors and player posteriors from `player_totals_unified`
- with the `10:41` `player_totals_unified` refresh already failing, this route is directly exposed to the same stale/HTML-leaking dependency chain

### rebuild-window-z

Benchmark result:

- timer: `00:39`
- reason: upstream HTML in route error body

Direct failing dependencies:

- `sustainability_priors`
- `player_stats_unified`

Code evidence:

- [windows.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/windows.ts#L12)
- [windows.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/windows.ts#L70)

Assessment:

- this route depends on priors already being available
- it also reads `player_stats_unified` for the rolling-window counts

### rebuild-score

Benchmark result:

- timer: `00:39`
- reason: upstream HTML in route error body

Direct failing dependencies:

- `player_totals_unified`
- `sustainability_window_z`
- `player_stats_unified`

Code evidence:

- [score.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/score.ts#L12)
- [score.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/score.ts#L49)
- [score.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/score.ts#L108)

Assessment:

- this route is downstream of both priors/window-z and the unified views
- it is not the first broken link in the chain

### update-predictions-sko

Benchmark result:

- timer: `00:39`
- reason: upstream HTML in route error body

Direct failing dependency:

- `player_stats_unified`

Code evidence:

- [update-predictions-sko.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/ml/update-predictions-sko.ts#L151)
- [update-predictions-sko.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/ml/update-predictions-sko.ts#L277)

Assessment:

- this route discovers players and fetches per-player series from `player_stats_unified`
- it also writes to `predictions_sko`, but the benchmark failure shape points to the source-read side first

### rebuild-trend-bands

Benchmark result:

- timer: `00:38`
- reason: upstream HTML in route error body

Direct failing dependencies:

- `player_stats_unified`
- `player_totals_unified`

Code evidence:

- [bandService.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/bandService.ts#L90)
- [bandService.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/bandService.ts#L132)

Assessment:

- this route computes trend bands from game rows plus season totals
- it is directly exposed to both broken unified-view sources

## Remediation Order Implied By Dependencies

1. Fix standalone defect:
   - `update-rolling-games`
2. Restore direct source/read stability:
   - `goaliesGameStats`
   - `sko_skater_stats`
   - `nst_seasonal_on_ice_counts`
   - `player_stats_unified`
   - `player_totals_unified`
3. Re-run first-layer consumers:
   - `update-season-stats`
   - `update-sko-stats`
   - `update-wgo-averages`
   - `rebuild-baselines`
   - `update-predictions-sko`
4. Re-run downstream sustainability chain:
   - `rebuild-priors`
   - `rebuild-window-z`
   - `rebuild-score`
   - `rebuild-trend-bands`

## Bottom Line

The direct blockers are:

- `goaliesGameStats`
- `sko_skater_stats`
- `nst_seasonal_on_ice_counts`
- `player_stats_unified`
- `player_totals_unified`
- plus one standalone code defect in `update-rolling-games`

Most of the later sustainability and ML failures are downstream consequences, not independent first-order failures.
