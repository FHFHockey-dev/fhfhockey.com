# Cron Loop And Batching Decisions

## Decision Framework

For each looping or resumable job, choose one of:

- `Keep Single Cron-Safe Call`
  The route already bounds its own work well enough for normal scheduled use.
- `Optimize First, Then Re-benchmark`
  Keep the route as a single cron target for now, but fix the endpoint before deciding whether explicit sequential URLs are necessary.
- `Split Into Explicit Sequential URLs`
  The route already exposes stable offset or batch parameters and should be scheduled as multiple sequential cron hits instead of one `runAll` call.

This follows the PRD preference to rank optimization first where reasonable, but it does not force that choice when the route already exposes a clean explicit-batch contract.

## Decisions

| Job | Loop / Batch Shape | Decision | Why |
| --- | --- | --- | --- |
| `update-nst-gamelog` | Builds `16` NST URLs per date and iterates forward/backward across dates. Incremental default is resumable and internally paced. | `Keep Single Cron-Safe Call` | The normal cron-safe mode is already the bounded incremental path. Explicit per-date cron URLs would create unnecessary operational sprawl for daily use. Reserve `startDate` / `runMode` variants for repair or backfill only. |
| `update-nst-tables-all` | `nst-team-stats` slices backlog to `1` date per run and may add season-based refreshes when clear. | `Keep Single Cron-Safe Call` | This route is already intentionally chunked for cron use. The main problem is schedule placement relative to other NST jobs, not lack of explicit batch parameters. |
| `update-nst-goalies` | Queues up to `10` dataset URLs per date but defaults to a bounded `maxPendingUrls=8` run and supports `maxUrls`, `maxDays`, and `startDate`. | `Optimize First, Then Re-benchmark` | It is already partially chunked, but the observed `17:00` failure shows the default shape is still unstable. Fix the failing path and confirm the default bounded run behaves consistently before considering explicit multi-URL scheduling. |
| `update-nst-current-season` | Exactly `4` report fetches for one strength; no explicit offset scheme. | `Keep Single Cron-Safe Call` | This is not really an offset-loop endpoint. The action item is to restore real inter-request pacing or keep it schedule-separated, not to split it into multiple cron URLs. |
| `update-nst-team-daily` | Processes `8` datasets per date; single-date incremental runs are already the cron-safe default. | `Keep Single Cron-Safe Call` | The normal scheduled mode is already a bounded single-date resumable pass. The issue is NST adjacency in the schedule, not a missing batch contract. |
| `update-nst-team-daily-incremental` | Same route and loop shape as `update-nst-team-daily`. | `Keep Single Cron-Safe Call` | Same conclusion as above. Move it away from other NST jobs rather than exploding it into per-dataset cron entries. |
| `rebuild-sustainability-priors` | No explicit offset loop; one season-scoped rebuild. | `Keep Single Cron-Safe Call` | No evidence that this route needs explicit batch URLs. Current failures came from upstream data-source instability, not from an internal offset loop. |
| `rebuild-sustainability-window-z` | Explicit `limit` + `offset`; `runAll=true` loops across all batches inside one request. | `Split Into Explicit Sequential URLs` | This route already has the right batch contract. For production cron safety, explicit offset URLs are the safer operational choice unless a later optimization proves `runAll=true` can reliably finish under budget. |
| `rebuild-sustainability-score` | Explicit `limit` + `offset`; `runAll=true` loops all batches and all windows inside one request. | `Split Into Explicit Sequential URLs` | Same as `rebuild-window-z`, but even more strongly so because it nests player and window work before upsert. Explicit offset scheduling is the safer near-term choice. |
| `rebuild-sustainability-trend-bands` | Explicit `limit` + `offset`; `runAll=true` loops batches of player IDs. | `Split Into Explicit Sequential URLs` | This route already exposes the needed batch controls. Keep `runAll=true` as a manual operator path, but use explicit offsets for cron scheduling. |
| `update-goalie-projections-v2` | Stateful resumable progress from latest existing date; not offset-based. | `Optimize First, Then Re-benchmark` | The route is already resumable, but the behavior is date-state dependent and not operator-friendly for precise repair work. Add stronger date/window targeting before deciding whether further cron decomposition is needed. |
| `ingest-projection-inputs` | Backlog-sensitive multi-stage ingest over recent game windows. | `Optimize First, Then Re-benchmark` | The route should remain one orchestration step in the schedule, but it needs internal chunking or resumability improvements before it can be considered cron-safe. |
| `build-forge-derived-v2` | Multi-builder orchestration in one request. | `Optimize First, Then Re-benchmark` | Keep as a single logical step for now. If it still overruns after optimization, then decompose by derived-table family rather than by arbitrary offsets. |

## Explicit Sequential URL Candidates

These are the strongest current candidates for explicit sequential cron URLs because they already expose `offset` and `limit` parameters cleanly.

### `rebuild-sustainability-window-z`

Use sequential URLs such as:

- `/api/v1/sustainability/rebuild-window-z?season=current&snapshot_date=<DATE>&offset=0&limit=250`
- `/api/v1/sustainability/rebuild-window-z?season=current&snapshot_date=<DATE>&offset=250&limit=250`
- `/api/v1/sustainability/rebuild-window-z?season=current&snapshot_date=<DATE>&offset=500&limit=250`

### `rebuild-sustainability-score`

Use sequential URLs such as:

- `/api/v1/sustainability/rebuild-score?season=current&snapshot_date=<DATE>&offset=0&limit=250`
- `/api/v1/sustainability/rebuild-score?season=current&snapshot_date=<DATE>&offset=250&limit=250`
- `/api/v1/sustainability/rebuild-score?season=current&snapshot_date=<DATE>&offset=500&limit=250`

### `rebuild-sustainability-trend-bands`

Use sequential URLs such as:

- `/api/v1/sustainability/rebuild-trend-bands?snapshot_date=<DATE>&offset=0&limit=250`
- `/api/v1/sustainability/rebuild-trend-bands?snapshot_date=<DATE>&offset=250&limit=250`
- `/api/v1/sustainability/rebuild-trend-bands?snapshot_date=<DATE>&offset=500&limit=250`

## Recommendation For The Next Schedule Pass

- Treat the sustainability `runAll=true` routes as operator conveniences, not as the first-choice cron shape.
- Keep the NST scrapers and resumable ingestion routes as single scheduled steps, but move and optimize them rather than exploding them into many static cron entries.
- Revisit the split-vs-optimize decision only after the next benchmark run on a healthier dataset state.
