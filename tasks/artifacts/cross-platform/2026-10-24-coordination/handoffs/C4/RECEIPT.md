# C4 receipt — SITE-WIGO first connection (code, tests and browser evidence)

Lane: C4 (Claude). Stable ID: SITE-WIGO. Status: **implementation, unit and local browser verification complete; ready for independent review (C7)**. No Git writes and no FHFH production access. **The :3110 server slot is released**: the server was stopped and port 3110 had no listener at 2026-10-24 local check. One bounded deviation is recorded under "Network boundary".

## Hashes

- Base HEAD: `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`
- `web/pages/wigoCharts.tsx` baseline `96806e645d81076869dbd9f139afa4338af6643b54c0bd7a5ac2fcac6444bb15` (matches lease) → candidate `fd3e6b7fbaa7a27f97063123b7ab03c384f2fedba07c5a69d9eb3cf35b703469`
- `web/__tests__/pages/wigoCharts.test.tsx` (new) `ee8f00a8bcd70ef2ab80b03feb831d3550bffd5b3fa0b2966553dc9508046064`
- Patch `handoffs/C4/C4-SITE-WIGO.patch` `2266893f0e268690ab27819aa3d2d3ab6afc3a2d8af6058cf14d79d11e4e190e` (`git apply --check --reverse` OK against the working tree)

Read-only dependencies (unchanged, all git-clean at check time):

| Path | sha256 |
| --- | --- |
| web/lib/navigation/siteSurfaceLinks.ts | c37971f2c9679b8fc8825f82f37a67f4eaf15a9d5f093da718b97d9879093868 |
| web/components/SurfaceWorkflowLinks/SurfaceWorkflowLinks.tsx | 15afce75fbeb46013da6fea4370ff0eb0c949eee4bc0e4a9eb63f78e31e222d2 |
| web/components/SurfaceWorkflowLinks/SurfaceWorkflowLinks.module.scss | 49d6d136c0e192f567f38d410131f67e0bb28074e41c3b32da5ad320e030cb5b |
| web/components/SurfaceWorkflowLinks/index.ts | eebf437a3bf6ff6e83638ae728bf314181f07c9f95350c9dce2d6d4ad87d0eb9 |
| web/hooks/useWigoPlayerDashboard.ts | 1438e51a5be91d85ce2c2fbd9ec589df05291a62fb75148625e34e772a49cc5f |
| web/styles/wigoCharts.module.scss | f5048029d7d7b09e98a1936dcce3222d7e5591117c5c3e5967194ce64151480e |
| web/lib/teamsInfo.ts | 645f33ed7272e728b6ac1436754a13126ee25eb2eb6bc598fcefed3acc8e1584 |

## Change

`/wigoCharts` now renders the existing `SurfaceWorkflowLinks` fed by the existing `getWigoSurfaceLinks(teamAbbreviation)`. Before this, `getWigoSurfaceLinks` had no consumer.

- Desktop (>768px): one section **below** the dashboard grid (outside it, so the fixed grid areas/rows, including the 1600px work surface, are untouched). It uses an inline 10px top margin because the stylesheet is not leased.
- Mobile (≤768px): one section beneath the active tab panel, wrapped in the existing `styles.mobilePanel` for the gutter, so it shows on every tab.
- Partial states: with no player, or a player whose team is unresolved, only the league-wide links show (Trends, Game Grid, Starter Board), with copy saying so. With a resolved team, Team HQ `/stats/team/{ABBR}` and Team Lines `/lines/{ABBR}` come first.
- ID validity: the abbreviation is the hook's `teamNameToAbbreviationMap[getTeamInfoById(id).name]`. All 32 `teamsInfo` names map back to a `teamsInfo` key, which is exactly what `/stats/team/[teamAbbreviation]` accepts (`hasOwnProperty(teamsInfo, …)`). `/lines/[abbreviation]` already receives the same abbreviations from Team HQ via `getTeamSurfaceLinks`.
- Back behavior: links are plain `next/link` pushes. WiGO already keeps `playerId`/`tab` in its URL (`router.replace`), so Back restores the player and tab. Unit tests do not prove this; it is part of the pending browser check.
- No new route, ID, engine or global-nav change; no nested anchors; no change to the shared links, component or styles.

## Checks (actually run)

- `npm test -- __tests__/pages/wigoCharts.test.tsx`: **6/6 passed** on the candidate. Against the baseline page (HEAD bytes, temporarily restored and then put back): **6/6 failed**, so the tests detect the missing connection.
  - Cases: no player → generic only; player with unresolved team → no team links and no `/null` href; long name with team UTA → exact href order, no `a a`, a single section; keyboard Tab reaches Team HQ then Team Lines; 375px with `tab=comparison` → a single section with team links; resize from desktop to mobile → still a single section.
- `npx eslint` on both files: passed.
- `npx tsc --noEmit` (with `NODE_OPTIONS=--max-old-space-size=8192`; the default heap aborted with exit 134): exit 2, with only 2 errors, both pre-existing in other lanes' files: `lib/sources/tweetLunaReview.test.ts:192` and `scripts/review-ifttt-luna.ts:22` (Buffer/BinaryLike). There are none in the C4 files.
- No `.scss` touched, so the CSS-modules pure-selector check does not apply.

## Browser evidence (isolated server, :3110)

Server: `PLAYWRIGHT_ISOLATED_NEXT=1 npx next dev -p 3110` (distDir `.next-playwright`) in the built-in browser pane, run against candidate `fd3e6b7f…`. Every backend env var was overridden to an inert host or a synthetic value: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_DB_URL`, `CMS_URL`, `NEXT_PUBLIC_SERVERLESS_API_URL`, `SCHEDULE_API_URL` and `NHL_API_URL` pointed at `c4-fixture.invalid`; the Supabase keys were synthetic; the OpenAI, Resend and Parlay keys were empty. The selected player is a synthetic fixture: an in-page `window.fetch` stub returns one row for `players?id=eq.999001` (`team_id` 10 → TOR, name "Fixture Skater Longname-Hyphenated") and `[]` for every other cross-origin request. The player was selected by client-side navigation, so there was no reload.

| Check | Result |
| --- | --- |
| 1280×900, no player | One section, "Keep exploring", below the grid. Hrefs: `/trends`, `/game-grid/7-Day-Forecast`, `/start-chart`. 0 nested anchors. |
| 1280×900, fixture player (team resolved) | Heading "Take the Fixture Skater Longname-Hyphenated read further". Hrefs: `/stats/team/TOR`, `/lines/TOR`, then the three league-wide links. The long name wraps cleanly. |
| 1680×1050 work surface | Grid unchanged. The section starts 10px below the grid bottom (881 → 891px). `scrollWidth` 1665 ≤ 1680, so no horizontal overflow. One section. |
| 375×812 (mobile emulation, `tab=trends`) | One section under the Trends panel, inside the mobile gutter. Cards are 343×75px, well above the 44px minimum. `scrollWidth` 375. At page bottom the last card ends at 687px, above the 65px fixed bottom nav (starts at 747px), so the nav never covers it. |
| Keyboard | Tab from the preceding control (Percentiles "PK") lands on Team HQ with `:focus-visible` and a 1px auto outline in rgb(229,151,0), visible in the zoom. Tab ×2 reaches Trends Dashboard. Enter navigates to `/trends` client-side (same document). |
| Back from keyboard navigation | Browser Back returns to `/wigoCharts?playerId=999001` with the same team links restored. |
| Touch-sized activation at 375 | Tapping the Trends tab sets the URL to `?playerId=999001&tab=trends`. Tapping the Starter Board card goes to `/start-chart?date=2026-10-24`. Back returns to `/wigoCharts?playerId=999001&tab=trends`, with Trends still the active tab and the team links restored. |

Limits of this evidence:
- Taps in the emulated touch viewport are delivered as mouse clicks, not real touch events.
- Team HQ and Team Lines were checked by href and focus but not activated. Their server props need the (inert) database, so following them would only show a 404 or error page. Route validity rests on the `teamsInfo` round-trip analysis above.
- The team-resolved state uses a synthetic player row, not live data. This is not live or production acceptance.

Screenshots in `handoffs/C4/screenshots/` (sha256):

- `desktop-1280-no-player.jpg` `8897ffabc13c260f1c52f109a9621b101952cf4a5d5e71bd2ad773162b56cab2`
- `desktop-1280-team-resolved-long-name.jpg` `5dbc453aca6d86c26ba0db573e38b45b2d41f33388419071b2af99992e49495d`
- `desktop-1680-work-surface-team-resolved.jpg` `5d2bc2c73c5a72fbdaa6500a2422c753852c3d4844781c74b0549ced2de841eb`
- `narrow-375-trends-tab-team-resolved.jpg` `381ce984506fe4adde48443d450cedb76516ea379fe2b4c4fc58871ee6967ec5`

## Network boundary (deviation, reported)

- **FHFH production Supabase: not contacted.** The prod URL is only a fallback in `lib/supabase/*` when `NEXT_PUBLIC_SUPABASE_URL` is empty, and it was set to the inert host. The server log shows every Supabase-backed API route failing with `fetch failed` (HTTP 500).
- **TJ's :3000: not reached.** `utils/fetchCurrentSeason.ts` defaults its server-side base to `http://localhost:3000` (from `.env.development`'s `NEXT_PUBLIC_SITE_URL`) and tried it 4 times. Nothing was listening on :3000 (`lsof` empty), so all 4 attempts ended in ECONNREFUSED.
- **Public NHL API (api-web.nhle.com): reached. This was not fixture-only.**
  - On the first player load, the WiGO schedule widget used the same-origin proxy `GET /api/cors?url=…/club-schedule-season/TOR/20262027`; the server fetched it from the NHL. After that, `/api/cors` was stubbed too.
  - Navigating to `/trends` and `/start-chart` for the Back checks ran their API routes. 4× `fetchCurrentSeason` logged "falling back to NHL API". Those routes may have made other hard-coded NHL calls, and outbound requests are not logged, so the exact count is unknown (at least 5).
  - These were public, unauthenticated reads: no FHFH data, no writes, no cost.
- Next time: start the server with `NEXT_PUBLIC_SITE_URL` set to an inert host too, and stub `/api/cors` before the first player load. Fully blocking server-side NHL calls would need a code-level seam, which is outside this lease.

## Remaining

- Independent review (C7) of this frozen packet.
- Integration, index and release stay with Codex.

## Preserved / out of scope

Game Grid, global nav, `siteSurfaceLinks.ts`, the shared component and its tests, sKO/forecast formulas, the BLSH follow-up (needs its own ticket and qualified props) and `tasks/tasks-README.md` (C6) are all untouched. Integration, index and release stay with Codex.
