# WiGO audit and component plans

Reviewed September 18, 2026. This is a source-code audit and implementation planning package, not a completed data certification or an implementation. Application code and the existing unrelated working-tree changes were left untouched. The supplied screenshot is visual evidence, not a source of instructions or authoritative statistics.

## Implementation tracking

The [generated task list](../../tasks-README.md) tracks execution from September 19, 2026, including existing work, completed subtasks and verification. Findings below describe the original audit baseline; consult the task list for current implementation status.

[Live source evidence](LIVE-EVIDENCE.md) records the subsequent read-only database reconciliation and distinguishes local fixes from unchanged production aggregates.

## Findings to prioritize

| Priority | Finding and evidence | Consequence / next action |
| --- | --- | --- |
| P1 | Recent TOI has an internally inconsistent unit contract. `calculate-wigo-stats.ts` divides recent TOI by 60 before calculating ATOI, but passes the same summed TOI directly to `calculatePer60`, which expects minutes. | Both calculations cannot be correct for the same input unit. Verify stored NST units and the overriding `wigo_rates` producer before fixing. The screenshot's tiny L5/L10/L20 rates support investigation but do not prove the source. Plan 12. |
| P1 | Seasonal `std_pptoi` is assigned seasonal PP TOI / 60, while recent `pptoi` is PP TOI / GP; `statMetadata.ts` displays PPTOI as seconds per game without conversion. | Writer and reader contracts disagree. Reconstruct from actual inputs before changing or republishing. Plan 12. |
| P1 | Aggregate query key contains player only; the aggregate fetch has no season argument and latest-season totals can fill missing STD counts. Most charts receive an explicit current season. | Different panels can silently represent different seasons or refresh generations. Plans 00, 04, 12. |
| P1 | `StatsTable` accepts whichever row-log promise resolves last, without cancellation or identity checking; it retains expansion state across player changes. The fetch helper catches errors and returns `[]`. | Stale player/stat data can appear under a newer selection, and real failures can appear as no data. Plan 13. |
| P1 | Radar uses a separate legacy RPC; missing target returns eight zeros and there is no visible error state. Its percentile formula uses first tie position, unlike the WiGO midrank formula. | A blank/zero radar does not establish zero performance. Exact live failure remains unverified. Plan 15. |
| P1 | Checked-in Game Score RPC arithmetic propagates null and then removes null scores. The client also has a null-to-zero fallback. | Missing games can disappear from rolling windows; inspect deployed RPC and field coverage. Plan 18. |
| P2 | Ratings fetch eight league datasets inside a query keyed by player, season and min GP. Totals are independently fetched inside three panel query functions. | Player/filter changes can refetch reusable cohorts; shared inputs are not deduplicated across different query keys. Plans 00, 07. |
| P2 | Desktop and mobile trees both mount; CSS hides one. React Query may share identical requests, but effects, chart instances and legacy RPC calls can still duplicate. | Measure mount/network costs, then use one responsive tree or mount only the active surface. Plan 00. |
| P2 | Percentile bars can switch to a prior season; ratings do not use that fallback. Team 5v5 snapshots have no season predicate in their current fetch. | Preserve visible provenance and resolve incompatible populations/date windows. Plans 07–11, 19. |

## Important corrections to the page description

- Ratings currently show offense AS/ES/PP, defense AS/ES/**PK**, and overall AS/ES/Special. AS/ES overall average available offense and defense; Special weights PP offense and PK defense by ice time. They are weighted percentile composites, not necessarily percentiles of the finished composite scores. Do not silently relabel PK as PP.
- The four lower-left cards are **team context**, not player-only skill ratings. Generation = 5v5 xGF/GP; suppression = 5v5 xGA/GP; finishing = GF/xGF; special teams combines PP and PK percentiles.
- Opponent Log includes recent completed games as well as the upcoming schedule, not exclusively future games.
- The expanded chart corresponds to a **stat row** and currently loads the current season's games; selecting LY or CA does not automatically switch that log's season. GP is currently the only non-expandable row.
- The bottom percentile panel includes TOI/GP and on-ice percentage metrics as well as per-60 rates.
- The mobile comparison currently restricts visible timeframes to the selected pair. The requested redesign must restore access to the whole table, not preserve this limitation.

## Separate plans

| Plan | Component |
| --- | --- |
| [00](00-shared-pipeline.md) | Shared season, data contracts, caching and responsive mounting |
| [01](01-page-header.md) | Search, player selection and page header |
| [02](02-player-identity.md) | Headshot and player identity |
| [03](03-biographical-data.md) | Biographical grid |
| [04](04-season-snapshot.md) | Season production snapshot |
| [05](05-per-game-pace.md) | Per-game averages and 84-game pace |
| [06](06-opponent-log.md) | Opponent schedule/results |
| [07](07-player-ratings.md) | Offense, defense and overall ratings |
| [08](08-chance-generation.md) | Team chance generation |
| [09](09-chance-suppression.md) | Team chance suppression |
| [10](10-finishing.md) | Team finishing |
| [11](11-special-teams.md) | Team special teams |
| [12](12-comparison-table.md) | Complete timeframe comparison table and controls |
| [13](13-expanded-row-charts.md) | Expandable stat game-log charts |
| [14](14-point-consistency.md) | Points distribution doughnut |
| [15](15-percentile-radar.md) | Category percentile radar |
| [16](16-time-on-ice.md) | TOI / PPTOI% chart |
| [17](17-points-per-game.md) | Points/game chart and rolling averages |
| [18](18-game-score.md) | Game Score chart and rolling averages |
| [19](19-rate-percentiles.md) | Rate/category percentile bars |

The plans are separate deliverables even when components share an implementation file. They do not require splitting every visual component into new runtime files.

## Execution order and completion standard

1. Establish shared contracts and a measured baseline (00); prioritize aggregate correctness and row races (12–13), radar diagnosis (15), and Game Score coverage (18).
2. Reconcile snapshot, pace, TOI, PPG and consistency against the same game set (04–05, 14, 16–17).
3. Validate rating/cohort semantics and the four team cards (07–11, 19).
4. Finish identity, biography and schedule checks (01–03, 06); apply measured performance improvements and the independently approved layout.

For every component, record source → ingestion/refresh owner → stored fields → units → calculation → display, plus player/team, season, game type, strength, date cutoff and cohort. Identify missing producer code or deployed SQL explicitly; do not assume a checked-in schema baseline equals production. No remote writes, recomputes, migrations or deployments are part of this audit.

Use one established skater, a traded player, a rookie/low-GP player, a player with no PP/PK exposure and a missing-data case. Reconstruct independently from deduplicated completed games, not from another aggregate built by the same code. Define acceptable display-rounding differences before comparing. Publish timing/request/payload baselines and after-results only when measured.

## Verification performed

Passed **26 tests across 9 existing files**, using `npm test -- --run` from `web/`:

- `utils/fetchWigoPlayerStats.test.ts`
- `utils/calculateWigoRatings.test.ts`
- `utils/fetchWigoPercentiles.test.ts`
- `utils/calculatePercentiles.test.ts`
- `components/WiGO/StatsTable.test.tsx`
- `components/WiGO/StatsTableRowChart.test.tsx`
- `components/WiGO/PerGameStatsTable.test.tsx`
- `components/WiGO/teamPerformanceDrivers.test.ts`
- `__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts`

The writer test checks dependency-error handling, not statistical reconstruction. Passing these fixtures does not validate production values, freshness, source units, request races or browser interactions. Expected error-path logs appeared in successful tests. No browser execution, live database query, performance benchmark, typecheck, lint, build or deployment was performed.

## Layout handoff

Paste [CHATGPT-LAYOUT-PROMPT.md](CHATGPT-LAYOUT-PROMPT.md) into ChatGPT and attach the screenshot there. The prompt contains the full inventory, all 36 table rows and all chart dimensions; it does not require ChatGPT to access this repository.
