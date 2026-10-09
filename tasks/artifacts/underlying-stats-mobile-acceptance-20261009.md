# Underlying Stats mobile, alignment and live-read acceptance

Date: 2026-10-09. Outcome: reviewed local repair candidate; production acceptance remains open until an authorized release and live recheck.

## Source and ownership

- Fresh `git ls-remote origin refs/heads/master refs/heads/octoberBranch` confirmed remote master at `171116877633d537a39b2a3e168882913269d47f` and octoberBranch at `7936a406e29e71d46a43ffd32d45a6bc7fb820eb`.
- Tested source: `171116877633d537a39b2a3e168882913269d47f`, isolated checkout `/tmp/fhf-underlying-stats-acceptance-20261009`, branch `chef/underlying-stats-mobile-acceptance-20261009`.
- The retained release-safe pin `98c1b5036dea54a1d9fdf551f279d241b7851ecf` has identical `web/pages/underlying-stats` and `web/components/underlying-stats` files. Dirty/divergent shared master at `9b11d3607b5afe2d7c6dff6d6dd918c1bcff92c4` was preserved, including its modified `web/next-env.d.ts` and untracked task files.
- Active-task inventory identified this task as the Underlying Stats owner. The other active owners work on Yahoo/RSO acceptance and forecast-contract code; no overlapping page owner was identified. Proposed page/style/test paths were reported before editing.
- Changed files: `web/pages/underlying-stats/playerStats/playerStats.module.scss`, `web/components/underlying-stats/PlayerStatsTable.module.scss`, `web/e2e/underlying-stats.spec.ts`, and this scoped receipt.
- No shared navigation, forecast/RSO/Start Chart/Game Grid, ingestion, schema, credential, release or dependency configuration changes. No push, deployment or production writes.

## Reconciled completed work

The existing restyle and scroll-first loading work is complete (site-roadmap tasks 5.x and 11.x). The July 11 receipts already cover initial 100-row loads, explicit incremental loading, rank/sticky headers and shared player/goalie contracts. April landing-page receipts cover trend repair and SoS and record incomplete desktop screenshot verification. This pass preserves those features; it does not rebuild them or close upstream follow-ups.

## Defects and smallest repairs

| Severity | Location | Before | After | Principle and impact |
| --- | --- | --- | --- | --- |
| HIGH | `web/pages/underlying-stats/playerStats/playerStats.module.scss:7` | A fixed 100vh page clips stacked controls on handsets. Skater/goalie table viewport height is zero at 320–430px; the unbounded team table extends below its clipped ancestor on desktop. | Page follows natural vertical flow; landing table shells get `clamp(20rem, 60vh, 42rem)` height and independent scrolling. | Plan for growth and clipping: users can reach filters, rows and Load more. |
| HIGH | `web/components/underlying-stats/PlayerStatsTable.module.scss:209` | Sticky identity columns cover metric headers after horizontal scrolling on a handset. A hit-test regression failed before this fix. | At the existing 640px handset boundary, only Rank stays pinned horizontally; all headers stay sticky vertically. Desktop identity behavior is preserved. | Hint at hidden content and keep content reachable: users can scroll to every metric. |

The initial headless audit directly observed zero-height player/goalie table viewports and team clipping. The new 390px skater regression then failed on metric header occlusion before the sticky-column repair. After both repairs, geometry and hit-testing confirm reachable rows/headers, alignment, vertical scrolling, rank pinning and absence of clipping/page horizontal overflow.

## Verification actually run

- **Passed:** focused Vitest group, 7 files / 53 tests: player landing, goalie landing, team landing, player detail, goalie detail, PlayerStatsTable and PlayerStatsFilters.
- **Passed:** `PLAYWRIGHT_BROWSERS_PATH=/Users/tim/Code/fhfhockey.com/web/.ms-playwright PLAYWRIGHT_BASE_URL=http://127.0.0.1:3114 PLAYWRIGHT_SKIP_WEB_SERVER=1 npx playwright test e2e/underlying-stats.spec.ts --workers=1`, final run 40/40 in 45.8s. Log: `/tmp/uls-playwright-final.log`.
- Browser coverage: all three landing surfaces at 320x568, 390x844, 430x932, 768x1024, 1440x900 and 720x450; data, two-axis scrolling, sticky header/body alignment, exposed last metric, Load more without page-2 prefetch; loading/empty/error at 390 and 1440; player/goalie trend expansion and linked detail at 390 and 1440. Ready/pending status panels are represented. Fixtures validate behavior, not live data.
- **Passed:** `npm run lint`, 0 errors / 66 existing warnings; final focused `npx eslint e2e/underlying-stats.spec.ts` also passes.
- **Passed:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`. Default-heap `npx tsc --noEmit` first failed from heap exhaustion (exit 134), so the retry changed the environment only. Successful log: `/tmp/uls-typecheck.log` (empty, exit 0).
- **Passed:** `git diff --check` and final scope review.
- Existing Node 22.11.0 and cached dependencies/browser were reused; no installation or lockfile changes. Chromium 148.0.7778.96 ran headlessly. Browser launch/local port binding required authorized sandbox exceptions; no desktop UI or cursor interaction.
- **Passed:** local replay of captured public responses at 390 and 1440 for player/goalie/current-season and team/previous-season: 100 skaters, 60 goalies and 32 teams. Table viewport heights were 423–504px, with no clipped ancestor or page horizontal overflow; last metric hit-tests passed and no page errors occurred. Replay log/data: `/tmp/uls-public-replay-results.json`; screenshots: `/tmp/uls-public-replay-{playerStats,teamStats,goalieStats}-{390,1440}.png`.

## Fresh public read-only observations

At 14:13 UTC, a local headless browser read `https://fhfhockey.com/underlying-stats/{playerStats,teamStats,goalieStats}`, allowing GET requests only and blocking telemetry/writes. All page responses and relevant APIs were HTTP 200; there were no page errors. Public build ID: `bXuWR-qTlV4FWDrGblnZy` (not independently mapped to a Git commit).

| API query | First observed API response | Subsequent GET capture at 14:17 UTC | Result |
| --- | --- | --- | --- |
| Players, 2026–27, regular season, 5v5, On-Ice counts, page 1 / 100 | 3,946ms | 1,600ms | 100 rows of 642 |
| Teams, 2026–27, regular season, 5v5, counts | 384ms | 381ms | Valid empty result, 0 teams |
| Goalies, 2026–27, regular season, 5v5, counts, page 1 / 100 | 485ms | 691ms | 60 rows |
| Teams, 2025–26, regular season, 5v5, counts | Not observed in first browser pass | 1,326ms | 32 teams |

Current production mobile skater and goalie rows exist in the DOM but both table viewports have **zero height**. This confirms the page defect with live reads; the local repair has not been deployed. First browser page/result observations took 4,604ms / 804ms / 1,102ms for skater/team/goalie. These include navigation and screenshot overhead and are not Web Vitals. Capture evidence: `/tmp/uls-live-results.json`, `/tmp/uls-live-payloads.json`, `/tmp/uls-live-{playerStats,teamStats,goalieStats}-390.png`.

Route-status snapshots: team ratings latest 2026-10-09; skater offense/defense and goalie ratings latest 2026-03-08; game predictions latest 2026-09-29; player predictions and market flags pending. Current-season team data coverage and stale rating dates are live limits for the ingestion owners, not page repairs in this candidate. No source correctness or forecast qualification claim is made.

## Remaining limits and decision

**Approve the scoped local layout candidate.** Production acceptance remains open: release is not authorized here, production still exhibits the mobile defect, current-season team data is empty, and rating snapshots include stale/pending products.

Single public timing samples do not establish cold-cache/warm-cache guarantees, tail latency, CPU/4G/mobile-hardware performance, Core Web Vitals or scroll frame rate. No load test was run. Actual 200% browser zoom and RTL were not verified; 720x450 covers the corresponding effective layout size only. The xG/operations and top-level power-rankings surfaces were outside this bounded player/team/goalie pass. No production build or broad application suite was run because the repair is page-specific CSS with focused browser coverage.
