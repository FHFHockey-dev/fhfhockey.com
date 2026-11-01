# Social Share: Top Multi-Cat Stars of the Week

**Scope:** new post `multi-cat-stars`: 2x2 board of top skaters, each with a season-percentile radar and a last-7-days table, ranked over the fantasy week in four views.

**Where:** `octoberBranch`, canonical checkout. Files: `web/lib/socialShare/modules/multiCatStars{,.sources,.test}.ts`, `web/components/SocialShare/modules/MultiCatStarsCard{.tsx,.module.scss}`, `web/e2e/social-share-multi-cat-stars.spec.ts`, one line in `lanes/skaterBoards.ts`. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/multi-cat-stars.md`.

**Decisions:**
- Fantasy week: CONTRACT §2, skater posts are Monday to Sunday (`calendarWeekStart`), not `yahoo_matchup_weeks`. The week holding the cutoff, so a Monday post shows the week just ended.
- Radar: Wigo's `CategoryCoverageChart` is Chart.js canvas with `usePercentileRank`. Reused `calculateRankingResult` on per-game averages, same 8 spokes and colours; own SVG with attribute colours.
- `plus_minus` is not on `SkaterAppearance`; the post has its own read rather than changing a shared type other lanes build fixtures on.

**State:** built and checked on fictional data; details in the receipt. Default view is Fantasy Week Total, Standard.

**Gotchas:**
- The preview scales the 1080 node, so `getBoundingClientRect` lengths need dividing by the scale before comparing to pixels.
- Whole-app `tsc` runs out of memory at the default heap; use `NODE_OPTIONS=--max-old-space-size=8192`.
- `bshBoard.test.ts` pins the barrel's id list, so a new post in that barrel must update it.

**Next:** Chef renders on real data.
