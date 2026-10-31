# SS lane A: Trends (What Changed 2.0, Role Watch 4.0)

- **Scope:** five-file sets for `whatChanged` and `roleWatch`, `lanes/trends.ts`, `e2e/social-share-trends.spec.ts`, receipt `tasks/artifacts/social-share-expansion-2026-10-31/lanes/a-trends.md`.
- **Where:** `octoberBranch`, canonical checkout, base `7bddeaf0d`.
- **State:** both posts built and tested; real rows for one player ran through builders and cards. Checks in the receipt.
- **Next:** lead runs the E2E spec and the league-wide real render at 13.0, then closes 2.5 and 4.4.
- **Decisions:** NST is read only when an NST metric ranks, or for one selected player. Per-60 denominators use WGO TOI of the same covered games, avoiding NST's unit. PP points per 60 use PP time. WGO metrics require 100% coverage; NST uses `minCoverage`.
- **Gotchas:** on-ice xGF% vs STD admits only 380 of 502 eligible today, since NST gaps cluster in the first week. Rolling has no first-week line rows.
- **Whitespace pass:** cards fill the body with stretched rows, 8 ranks per list, one legend line; fine print moved to evidence. No browser run; lead sends measurements if anything clips.
- **What Changed boards:** Up and Down at 6 rows, group tiles, last-10 sparkline; a WGO ranking now reads NST for the boards' players. Role Watch untouched. No browser run; lead renders on real data.
- **Role Watch boards:** same layout, new Board field picks TOI or PP TOI. Sparkline gaps can't occur on listed rows today, since windows must be complete. No browser run.
- **Larger sparklines:** 280×84 with value and date axes, tiles stacked beside the chart, boards at 5 rows. No browser run.
- **Blockers:** none.
