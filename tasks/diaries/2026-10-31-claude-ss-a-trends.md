# SS lane A: Trends (What Changed 2.0, Role Watch 4.0)

- **Scope:** five-file sets for `whatChanged` and `roleWatch`, `lanes/trends.ts`, `e2e/social-share-trends.spec.ts`, receipt `tasks/artifacts/social-share-expansion-2026-10-31/lanes/a-trends.md`.
- **Where:** `octoberBranch`, canonical checkout, base `7bddeaf0d`.
- **State:** both posts built and tested; real rows for one player ran through builders and cards. Checks in the receipt.
- **Next:** lead runs the E2E spec and the league-wide real render at 13.0, then closes 2.5 and 4.4.
- **Decisions:** NST is read only when an NST metric ranks, or for one selected player. Per-60 denominators use WGO TOI of the same covered games, avoiding NST's unit. PP points per 60 use PP time. WGO metrics require 100% coverage; NST uses `minCoverage`.
- **Gotchas:** on-ice xGF% vs STD admits only 380 of 502 eligible today, since NST gaps cluster in the first week. Rolling has no first-week line rows.
- **Blockers:** none.
