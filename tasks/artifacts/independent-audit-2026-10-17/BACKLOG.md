# Prioritized backlog

Items are ranked by impact × confidence ÷ effort and adjusted for risk. Each item is one bounded change with its own approval. "Owner overlap" names an active session that must agree before edits. Baseline numbers come from BASELINE.md.

| # | Item (finding) | Impact | Conf. | Effort | Risk | Prerequisite or approval | Owner overlap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Scope Apollo and notistack to their consumers (F1, Patch 01) | H | high | S | low | TJ OK to edit 4 files plus one local compile build | none (files clean) |
| 2 | Page goalie trends at the 1,000-row cap (F2) | M→H | high | XS | very low | code edit OK; **do before about 2026-12-01** | none seen |
| 3 | Page season games in accountability and backtests (F3) | M | high | S | low | code edit OK; label pre-fix backtests | game-predictions owner |
| 4 | Fan out line-source retries only for pending sources (F4a) | M | high | S–M | medium (freshness) | IFTTT owner sign-off | **ifttt-lines** |
| 5 | Index `cron_job_audit` (F4b) | M | high | XS | low | DB migration approval | **ops-cron-health** |
| 6 | Single h0 forecast issuer (F5) | L–M | high | XS | low | TJ decision on which cutoff to publish | game-predictions owner |
| 7 | Sustainability coverage signal and offset 750 (F6) | L→M | high | S | low | schedule-change approval | none seen |
| 8 | Homepage without moment-timezone (F7) | M | high | M | medium (DST) | code edit OK | homepage owner |
| 9 | Attribute, then split the `/draft-dashboard` chunk (F8) | M | medium | M | low | one more compile build | Draft Dashboard owner |
| 10 | `cron_job_audit` retention (F4c) | M | high | S | **destructive** | explicit ask-first approval plus archive | **ops-cron-health** |
| 11 | Archive ref for `.next-codex-reconcile` `local-snapshot` (F10) | L (risk) | high | XS | low | git-ref write approval | none |
| 12 | Remove 7 unused direct dependencies (F11) | L | medium | S | low | manifest and lockfile approval | security sprint (dependency audit) |
| 13 | One migration for confirmed duplicate indexes (F12) | L | high | S | low | DB migration approval, per-index sizes first | DB audit owner |
| 14 | Typecheck command with an explicit heap (F13) | L | high | XS | none | manifest or AGENTS.md change approval | none |

**Status of #1:** applied to the working tree and uncommitted. Measured −83.8 kB gz shared JS. Browser checks and the focused Comments test are still open (see PATCH-PROPOSAL-01.md, "Results").

## Acceptance tests and metrics

### 1. Scope global providers (Patch 01)

- **Metric.** The shared `_app` chunk falls from 176 kB gz to ≤ 96 kB gz, and shared First Load JS from 263 kB to about 172 kB. Predicted −91.1 kB gz.
- **Test.**
  - An isolated compile build plus `data/first_load.py`.
  - `grep -c` of `MuiCollapse`, `InMemoryCache` and `go.apollo.dev` in `static/chunks/pages/_app-*.js` returns 0.
  - Vitest: `__tests__/pages/blog.test.tsx` passes. Add a test rendering `Comments` with a mocked `NEXT_PUBLIC_SANITY_GRAPHQL_URI` that asserts the query runs inside the provider.
  - Manual or Playwright: blog comment refetch after posting; `/db` snackbar shows.
  - `npx tsc --noEmit` and `npm run lint`.

### 2. Goalie trends paging

- **Metric.** Rows returned = rows that exist for the metric and season. This becomes observable once a season has more than 1,000 goalie-games.
- **Test.** A new case beside `__tests__/pages/api/v1/trends/skater-power.test.ts`: a fake Supabase client returns at most 1,000 rows per `range`; with 2,500 seeded rows across 40 goalies, all 2,500 come back in `player_id`, `game_date` order.

### 3. Accountability paging

- **Metric.** For a completed season, games evaluated = games in the season (1,312 for 2025-26 regular season).
- **Test.** Extend `lib/game-predictions/accountability.test.ts` with a 1,000-row-capped fake holding 1,312 games, asserting the length and the date order, and that the backtest fold count covers the last month.

### 4. Pending-aware line-source retries

- **Metric.** `cron_job_audit` inserts/day fall from ≈6,170 to < 1,000, measured as the `n_tup_ins` delta per 24 h. Processor invocations/day fall from about 5.9k to roughly the number of pending-event minutes.
- **Test.**
  - Unit test of `retryPendingLineSourceEvents` with a fake pending query: 0 pending → 0 POSTs; 1 pending `gamedaylines` → exactly 1 POST to `update-line-sources?sourceKey=gamedaylines`.
  - A freshness test: an event received at minute *t* is processed by minute *t+1*.
  - If empty-queue reconciliation is needed, it runs at its own documented cadence.

### 5. Audit indexes

- **Metric.** `seq_scan` on `cron_job_audit` grows by ≤ 10/day, down from ≈84.
- **Test.** `EXPLAIN` (no ANALYZE) of the `cron-report` audit window query and the NST bookmark query shows Index or Bitmap scans. The migration uses `CONCURRENTLY`.

### 6. Single h0 issuer

- **Metric.** One `game_prediction_history` row per game per h0 day.
- **Test.** A config test asserting no forecast window appears in both `web/vercel.json` and the documented pg_cron list, plus a readback check on the next issuance day.

### 7. Sustainability coverage

- **Metric.** Every response carries `totalIds` and `remaining`, and `remaining` = 0 on every scheduled run.
- **Test.** Unit test: when `ids.length` is larger than `offset + limit` for the last scheduled offset, the response is flagged and `cron-report` or health shows it.

### 8. Homepage date library

- **Metric.** Homepage route-only JS falls from 198 kB gz to ≤ 150 kB gz, and from 1,243 kB raw to ≤ 460 kB raw.
- **Test.** Formatting parity tests for New York, Los Angeles and London across the 2026-11-01 and 2027-03-14 transitions; the existing `components/HomePage/useHomepageGames.test.tsx` passes.

### 9. Draft Dashboard split

- **Metric.** Set after attribution; the target is −100 kB gz First Load JS on `/draft-dashboard`.
- **Test.** The existing Draft Dashboard Vitest suites pass, and Playwright opens each lazily loaded panel.

### 10–13

- **10.** Archive first (row count and bytes recorded), then delete rows older than the agreed window; table size stops growing after 30 days.
- **11.** `git cat-file -e 6fcfa8627^{commit}` succeeds in the main repo and `git rev-list --count` matches.
- **12.** `npm ci && npx tsc --noEmit && npm run lint && npm run test:full` all pass.
- **13.** Index bytes are reclaimed as listed, and no plan regression shows in `EXPLAIN` of the top queries on the affected tables.
