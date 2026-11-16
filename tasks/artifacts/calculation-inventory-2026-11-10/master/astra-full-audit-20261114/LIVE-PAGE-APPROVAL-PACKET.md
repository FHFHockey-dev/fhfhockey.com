# Proposed live page audit budget — not approved or executed

The frozen source audit is complete. This is the remaining production display check from governing prompt §6; source review cannot establish deployed rendering, network status, current values or mobile visibility.

## Proposed bounds

- Target: `https://fhfhockey.com`, TJ’s existing Chrome profile.
- 49 desktop URL observations at 1440×900 and 15 mobile observations at 375×812: 64 observations, **at most 64 top-level navigations**. Reuse the same loaded page for its mobile observation wherever possible, reducing actual loads.
- `/game-grid` may follow its usual one 307 to `/game-grid/7-Day-Forecast`; allow up to two such redirect follow-ups across the two widths (at most 66 document requests). No other route expansion, cache-busting, manual API calls, repeated reloads or deliberate retry.
- Concurrency one; at least 10 seconds between navigation starts. One controlled tab per page; one RSO tab total. Reuse existing matching user tabs and preserve them. Close new audit tabs promptly to avoid accumulating background polling. Reset viewport overrides at the end.
- Observe for no more than 30 seconds per loaded page; stop if readiness exceeds 30 seconds. Do not deliberately trigger or wait for periodic refresh. Page-driven ordinary read requests are part of this page budget; their exact fan-out and cost remain unknown and will be recorded where observable.
- No Run, Refresh, Rebuild, Sync, Publish, Save, authentication changes, preference/account saves or provider action buttons. RSO/sign-in and internal tools are load-state only. Stop before any indicated write or operation trigger.
- Stop on any 5xx (stricter than the prompt’s repeated-5xx rule), timeout, suspected write, unexpected route/provider operation, or failed DB health gate. No automatic resume after a stop.
- Separately approve the exact one-row `live-page-health-batch.sql` on project `fyhftlxokyjtpndbkfse`, up to five executions before observations 1/16/31/46/61; five-second statement timeout, one-second lock timeout, no retries. Stop above five other active queries, any older than ten seconds, or unknown visibility. Observations include viewport-only observations, so health checking is at least as frequent as the required load interval.
- No activity during protected 2026-11-17 13:45–14:15 UTC.
- Record actual loads, redirects, observations, elapsed times, health checks and early stops; unused budget is not permission for extra routes or retries.

## Excluded page

`https://fhfhockey.com/db` is held back: its authorized-admin mount runs three full exact table counts, a season game count and started-game metadata reads. Those are not bounded by this page budget or the SELECT hygiene limits. The source audit covers it; a safe bounded live method or explicit separate exception is needed before loading it. No silent full-scan approval is requested.

## Evidence plan and limits

Record rendered state, relevant console messages, visible network statuses, nonfinite/broken text, impossible values, labels, missingness and debug leakage; cross-check three displayed numbers against already-loaded response data where available. Save desktop/mobile screenshots in the prescribed pages directory. Chrome provides screenshots, DOM and console access; full network response capture requires DevTools inspection. Any unavailable network/response evidence is marked unverified, not passed. No extra API fetch or database query is implied.

`/forge/team/TOR` uses the route’s verified abbreviation contract, rather than a guessed numeric ID; record the actual linked context observed on FORGE. The game/player examples remain the prompt’s IDs.

## Exact URL list

| URL | Desktop 1440 | Mobile 375 |
|---|---|---|
| https://fhfhockey.com/ | yes | yes |
| https://fhfhockey.com/game-grid | yes | yes |
| https://fhfhockey.com/game-grid/dateRange | yes | — |
| https://fhfhockey.com/start-chart | yes | yes |
| https://fhfhockey.com/goalies | yes | yes |
| https://fhfhockey.com/trueGoalieValue | yes | — |
| https://fhfhockey.com/variance/goalies | yes | — |
| https://fhfhockey.com/variance/skaters | yes | — |
| https://fhfhockey.com/lines | yes | yes |
| https://fhfhockey.com/lines/TOR | yes | yes |
| https://fhfhockey.com/lines/line-combo/2026020131 | yes | — |
| https://fhfhockey.com/shiftChart?gameId=2026020131 | yes | yes |
| https://fhfhockey.com/shiftChart?gameId=2026020038 | yes | — |
| https://fhfhockey.com/shiftChart?gameId=2026020153 | yes | — |
| https://fhfhockey.com/charts | yes | — |
| https://fhfhockey.com/wigoCharts | yes | — |
| https://fhfhockey.com/stats | yes | yes |
| https://fhfhockey.com/stats/team/TOR | yes | yes |
| https://fhfhockey.com/stats/player/8478402 | yes | yes |
| https://fhfhockey.com/stats/game/2026020309 | yes | — |
| https://fhfhockey.com/statsPlaceholder | yes | — |
| https://fhfhockey.com/underlying-stats | yes | yes |
| https://fhfhockey.com/underlying-stats/playerStats | yes | yes |
| https://fhfhockey.com/underlying-stats/playerStats/8478402 | yes | — |
| https://fhfhockey.com/underlying-stats/teamStats | yes | yes |
| https://fhfhockey.com/underlying-stats/xg | yes | — |
| https://fhfhockey.com/underlying-stats/xg/operations | yes | — |
| https://fhfhockey.com/rankings | yes | yes |
| https://fhfhockey.com/splits | yes | — |
| https://fhfhockey.com/trends | yes | — |
| https://fhfhockey.com/trends/player/8478402 | yes | — |
| https://fhfhockey.com/trends/placeholder | yes | — |
| https://fhfhockey.com/FORGE | yes | yes |
| https://fhfhockey.com/forge/player/8478402 | yes | — |
| https://fhfhockey.com/forge/team/TOR | yes | — |
| https://fhfhockey.com/forge/command-center | yes | — |
| https://fhfhockey.com/projections | yes | — |
| https://fhfhockey.com/fantasy-projections | yes | — |
| https://fhfhockey.com/player-forecasts | yes | — |
| https://fhfhockey.com/roster-schedule-optimizer | yes | — |
| https://fhfhockey.com/drm | yes | — |
| https://fhfhockey.com/draft-dashboard | yes | — |
| https://fhfhockey.com/nhl-predictions | yes | — |
| https://fhfhockey.com/game/2026020309 | yes | — |
| https://fhfhockey.com/sko-element/preview | yes | — |
| https://fhfhockey.com/buy-low-sell-high/preview | yes | — |
| https://fhfhockey.com/social-share | yes | — |
| https://fhfhockey.com/trendsDebug | yes | — |
| https://fhfhockey.com/trendsSandbox | yes | — |

Full planned evidence rows: `live-page-plan.tsv`. SQL SHA256: `2842c587e1d24f5e03df69b5a4f05f7e8f339ed6aacbae0b5ca6339a2bc64cd2`.
