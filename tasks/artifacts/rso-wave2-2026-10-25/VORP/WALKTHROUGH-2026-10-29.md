# RSO real-league walkthrough, 2026-10-29 (after release #399)

Claude orchestrator, in TJ's Chrome tab. Read-only: no clicks that change the plan, no "Refresh provider", no Yahoo actions. No names, rosters or screenshots are recorded here.

## State of the page

- Yahoo league workspace, Mon Oct 26 – Sun Nov 1, America/New_York. The page was loaded about 20 minutes before the check, and the browser reported online.
- **Yahoo availability read:** 58 pages, 1,388 rows, finished in 5.5 s of its 8 s budget. 818 candidates matched the catalog.
- **Data health:** 2 items, both league rules Yahoo does not report (inferred add timing and reset; goalie-minimum counting).
- **"Confirm planning inputs":** shown inline in Best Fit and the planner (#398 is working).
- **Chips:** line and PP chips appear on 10 Best Fit cards (deployment read OK).

## Findings

1. **The recent-form read failed in production.**
   - The page's evidence shows `form: partial · recent_form_stats_query_failed`, so no player has `lastFive` or `recentTotals`.
   - As a result the cards show **no L5 box score**, and the streaming blend (projection + last-10) has no recent half.
   - This is the 30-day `wgo_skater_stats` / `wgo_goalie_stats` read in `web/lib/rosterScheduleData/planning.ts:343-380`, with a 2 s deadline and caps of 25,000 / 2,500 rows.
   - The likely cause is that deadline, but it is not confirmed.
   - Note: a WGO historical repair window (Codex) is open until 2026-10-30 01:00Z and may add load.
   - Diagnosing needs the Vercel runtime logs (read-only production) or a timed read.
2. **Best Fit gives the wrong reason when no adds remain.**
   - The league has no adds left this period. The Streaming plan correctly says "No adds remain this period; hold the roster."
   - Best Fit instead shows "Rankings appear once projections and schedules load." (`CandidateBrowser.tsx:152`), and lists cards alphabetically with no gains.
   - The cause: `hasEvaluatedFit` is false because no add plan can be built with a zero budget.
3. **The S1 "Alternative" lines could not be checked live.** With no adds, there are no Best Fit plans and no streaming chains. The only "Alternative" text on the page is the planner's existing "Alternative 1 · projected points comparison".

## Not exercised

Preview swap, "Use this streaming plan", the streaming chain, the 30-minute upkeep and the plan-from slider. None is meaningful while the add budget is zero; they need a week with adds left.

## Vercel logs (read-only, TJ pop-up "Read Vercel logs")

- **Sources:** the Vercel MCP `get_runtime_logs` returned 403 forbidden, so I used the CLI `vercel logs --project fhfhockey --environment production --since 2h --query roster-schedule-optimizer --json` instead.
- **Every RSO request returned 200**, apart from two 401s on an unauthenticated load at 20:38Z.
- **The cause of `recent_form_stats_query_failed` is not visible here.** The request records carry no duration and no application log lines, because the loader catches the error and stores only the reason code.
- **A 2-minute re-read pattern after the 20:53Z load.**
  - `/data` ran at 20:55:07, 20:57:10, 20:59:13 and 21:01:21Z, and `yahoo-current-data` at 20:55:37, 20:57:40 and 20:59:43Z.
  - The pattern then stopped, likely when the tab was hidden or moved.
  - **Cause:** `useRosterPlanning.ts`. A private Yahoo plan carries a confirmation that expires within 120 s (`currentPlanningRead.ts:110`). A public stand-in read (`/data`) runs shortly before the deadline, and the plan is re-planned at expiry (`yahoo-current-data`).
  - **Cost:** with the diet flag off, each `yahoo-current-data` makes about one Yahoo today-roster read (`planningConfirmations.ts:59-60`, no cache). That is roughly 30–60 Yahoo reads an hour while the page is visible, beside the 30-minute provider upkeep. With the diet flag on, the cache absorbs it.
  - This behavior predates #399.

## Timed read (TJ pop-up "One timed DB read")

- **What ran:** one `BEGIN READ ONLY` transaction (statement_timeout 5 s, lock_timeout 1 s) on `fyhftlxokyjtpndbkfse`. It ran an `EXPLAIN ANALYZE` of the loader's exact count and of its first page.
- **First page:** season 20262027, `games_played = 1`, 2026-09-29..2026-10-28, ordered by date desc and id, limit 1000. It scanned 1,261 index rows and took **4.5 ms** (`wgo_skater_stats_gp1_date`).
- **Exact count:** its result was not returned by the tool, and no second read was made.
- **Volume:** about 250 rows per game day, so roughly 5–6 sequential PostgREST pages, each with an exact count.
- **Conclusion:** the database is fast. The failure is either:
  - the 2 s budget across sequential page round trips from Vercel, or
  - the pager's "count changed between pages" guard tripping while WGO ingest or the open repair window writes.

  The stored reason (`recent_form_stats_query_failed`) cannot tell which.
