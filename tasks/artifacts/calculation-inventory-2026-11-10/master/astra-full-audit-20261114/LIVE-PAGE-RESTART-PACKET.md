# Proposed live restart — direct approval required

The first pass stopped before a new Game Grid navigation. One home reload and one aggregate health query were executed; home desktop/mobile evidence is retained. Repeated Yahoo pickup 503 entries were visible in the existing Game Grid Console, with unknown age. No fresh 503 or actual write is asserted.

## Why Game Grid is excluded

Frozen `89da739cb` source, unchanged in the current checkout for the traced implementation:
- `web/components/PlayerPickupTable/PlayerPickupTable.tsx:1833–1868` automatically fetches Yahoo pickup on mount for an eligible signed-in user.
- `web/pages/api/v1/account/yahoo/pickup.ts:17` invokes `loadYahooPickupContext`.
- `web/lib/integrations/yahoo/pickupServer.ts:29–32` calls the Yahoo league-roster provider reader.
- `web/lib/integrations/yahoo/providerClient.ts:234–239,298–315` can refresh an access token or mark reauthentication required.
- `web/lib/integrations/yahoo/tokenManager.ts:96–119,201–216,263–265` contains account-state updates, secure token persistence and a refresh-lease RPC.

A GET and no button clicks do not make this signed-in page read-only. Both Game Grid views are held back. The original `/db` full-table-count exclusion stays. No provider call, token write, sign-out, profile change, request interception or production fix is requested.

## Exact remaining budget

- 47 desktop observations at1440×900 and13mobile at375×812:60observations, at most60additional navigations; no redirect allowance. Reuse loaded views for mobile wherever possible. The home page is complete and will not be reloaded.
- Exact URLs below. The date-range route now has an explicit seven-day window, November15–21, rather than the missing-parameter landing state.
- Same concurrency1, >=10seconds navigation spacing, no cache-busting/retry loops, one tab per page/oneRSOtab, preserve usertabs, close new audit tabs promptly, reset viewport, no write/run/sync buttons.
- Inspect source before any remaining page whose startup side effects are uncertain; hold it back if it could invoke a provider sync or write. Such exclusions do not authorize replacements or added routes.
- Stop further loads on any newly observed5xx, >30second readiness, possible write/provider operation, or failed hygiene. The already documented pre-navigation Game Grid console history is excluded from a new-load failure count; no old error is declared resolved.
- Separately approved restart health batch: exact `live-page-restart-health.sql`, at most4single-rowSELECTs before remaining observations1/16/31/46. Same project,5sstatement/1slock, no retries, no application data/query text/RPCs/writes. Stop active_others>5, max_active_seconds>10, visibility_unknown>0, timeout/error. This replaces, and does not add to, the four unused earlier health checks.
- No work in the protected November17 13:45–14:15UTC slot. No automatic restart after another stop.
- Full API/status capture and three response/row comparisons remain required where safely observable; unavailable evidence stays explicitly unverified. No extra manual API or SQL reads are implied.

## URLs

| URL | Widths |
|---|---|
| https://fhfhockey.com/game-grid/dateRange?start=2026-11-15&end=2026-11-21 | 1440 |
| https://fhfhockey.com/start-chart | 1440, 375 |
| https://fhfhockey.com/goalies | 1440, 375 |
| https://fhfhockey.com/trueGoalieValue | 1440 |
| https://fhfhockey.com/variance/goalies | 1440 |
| https://fhfhockey.com/variance/skaters | 1440 |
| https://fhfhockey.com/lines | 1440, 375 |
| https://fhfhockey.com/lines/TOR | 1440, 375 |
| https://fhfhockey.com/lines/line-combo/2026020131 | 1440 |
| https://fhfhockey.com/shiftChart?gameId=2026020131 | 1440, 375 |
| https://fhfhockey.com/shiftChart?gameId=2026020038 | 1440 |
| https://fhfhockey.com/shiftChart?gameId=2026020153 | 1440 |
| https://fhfhockey.com/charts | 1440 |
| https://fhfhockey.com/wigoCharts | 1440 |
| https://fhfhockey.com/stats | 1440, 375 |
| https://fhfhockey.com/stats/team/TOR | 1440, 375 |
| https://fhfhockey.com/stats/player/8478402 | 1440, 375 |
| https://fhfhockey.com/stats/game/2026020309 | 1440 |
| https://fhfhockey.com/statsPlaceholder | 1440 |
| https://fhfhockey.com/underlying-stats | 1440, 375 |
| https://fhfhockey.com/underlying-stats/playerStats | 1440, 375 |
| https://fhfhockey.com/underlying-stats/playerStats/8478402 | 1440 |
| https://fhfhockey.com/underlying-stats/teamStats | 1440, 375 |
| https://fhfhockey.com/underlying-stats/xg | 1440 |
| https://fhfhockey.com/underlying-stats/xg/operations | 1440 |
| https://fhfhockey.com/rankings | 1440, 375 |
| https://fhfhockey.com/splits | 1440 |
| https://fhfhockey.com/trends | 1440 |
| https://fhfhockey.com/trends/player/8478402 | 1440 |
| https://fhfhockey.com/trends/placeholder | 1440 |
| https://fhfhockey.com/FORGE | 1440, 375 |
| https://fhfhockey.com/forge/player/8478402 | 1440 |
| https://fhfhockey.com/forge/team/TOR | 1440 |
| https://fhfhockey.com/forge/command-center | 1440 |
| https://fhfhockey.com/projections | 1440 |
| https://fhfhockey.com/fantasy-projections | 1440 |
| https://fhfhockey.com/player-forecasts | 1440 |
| https://fhfhockey.com/roster-schedule-optimizer | 1440 |
| https://fhfhockey.com/drm | 1440 |
| https://fhfhockey.com/draft-dashboard | 1440 |
| https://fhfhockey.com/nhl-predictions | 1440 |
| https://fhfhockey.com/game/2026020309 | 1440 |
| https://fhfhockey.com/sko-element/preview | 1440 |
| https://fhfhockey.com/buy-low-sell-high/preview | 1440 |
| https://fhfhockey.com/social-share | 1440 |
| https://fhfhockey.com/trendsDebug | 1440 |
| https://fhfhockey.com/trendsSandbox | 1440 |

Health SQL SHA256: `76b16b58237f1897ee040100955425c88114fe47c1d4443c7f22359106daf095`.
