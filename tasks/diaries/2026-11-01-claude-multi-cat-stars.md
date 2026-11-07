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

**Period control ticket:** shared control added at seam 884b4839d, default is the matchup week holding the cutoff; details in the receipt.
- Two isolated servers share `.next-playwright`, so they destroy each other's build: 500s and goto timeouts, not test failures. Run when no other `next dev -p 3000 -p 31xx` is up.

**SS-1103-H (2026-11-03):** the pager now takes its cutoff from the edition's `generatedAt`, so the spec's fixture edition is pinned to 2026-11-01 (cutoff Oct 31, the calendar mock's CUTOFF), with expiry still ten minutes from now. 8 of 8 passed on isolated port 3110 after the other session's schedule spec finished. Spec-only commit; this diary note is uncommitted by the ticket's rule.

**Next:** Chef renders on real data.
