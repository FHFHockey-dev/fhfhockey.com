# Sko Element scoring streak chart

Open the existing local [Sko preview](http://127.0.0.1:3167/sko-element/preview) and choose **Explore retained player scoring streaks**, or open [the chart](http://127.0.0.1:3167/sko-element/streaks). Select a skater and season. Hover over a bar, focus the chart and use the arrow keys, or use the appearance selector. Historical mode shows the visible episode nearest the selected game, including its lead-in and exit windows. As-known mode truncates the chart and both windows to the selected close. Use **Through appearance** to advance that cutoff. This reconstruction uses archived final observations without original publication timestamps.

The fixture preview at `web/pages/sko-element/preview.tsx` reads `fixtureRecords` through `SkoElementPreview`. It links to a development-only sibling route that reads the local reconciled `games.csv.gz` once per file revision and sends a single selected skater-season history to the chart. The existing `/skoCharts` page is a legacy quarantine notice. The Trends sandbox draws entity score/band/history API results, and player Trends uses metric summaries. Their feeds have different observation and labeling contracts.

After generating the identity worker’s `parent-v1/games.csv.gz`, start the isolated server on macOS from `web/`:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 \
NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=local-study-only \
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-study-only \
SUPABASE_SERVICE_ROLE_KEY=local-study-only \
CMS_URL=http://127.0.0.1:9 NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_ISOLATED_NEXT=1 \
sandbox-exec -p '(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:*"))' \
node_modules/.bin/next dev -H 127.0.0.1 -p 3167
```

Run `node tasks/artifacts/sko-streak-indicators-2026-11-18/parent-v1/chart-browser.cjs` from the repository root. The browser uses a fresh session, blocks requests outside the loopback server and blocks application API calls.

[Browser receipt](chart-browser-receipt.json) · [DeBrincat chart](chart-debrincat.png)

Chromium exercised all four boundary behaviors. DeBrincat confirmed cold on December 23, 2024 and exited the following appearance on December 27. The historical view showed both recovery games while the December 23 cutoff exposed no exit. Barkov’s October 28 record restarts continuity after a short team sheet, and his December 30 cold run has an unknown start. Perry’s April 16 final retained appearance ends inside a hot run. The UI exposes all 920 skaters in the admitted 2024–25 ledger. Scoped TypeScript and ESLint checks passed.

## Frozen forward hot-alert examples

- [Anze Kopitar, March 1, 2025](http://127.0.0.1:3167/sko-element/streaks?player=8471685/20242025&through=2024020957) opens after his 58th appearance against St. Louis.
- [Alex DeBrincat, March 12, 2025](http://127.0.0.1:3167/sko-element/streaks?player=8479337/20242025&through=2024021036) opens after his 65th appearance against Buffalo.

Both links open in **As known then** and derive chart markers and explanatory windows from the prefix through the specified official game. A missing player-season, invalid game or mismatched game returns HTTP 404 with an explanation when a cutoff is requested. Returning to the plain chart URL restores the full historical view.

Frozen links also enforce the cutoff on the server. Chromium checked the initial HTML payload and the Next navigation JSON independently. Both responses ended at Kopitar’s game 2024020957 with 58 appearances and DeBrincat’s game 2024021036 with 65 appearances. The **Open full historical season** link requests the rest of that skater’s history explicitly.
