# WiGO Charts overhaul: shared auditor brief (2026-11-01)

All auditor lanes read this first. It holds TJ's approvals and the rules. Your own session prompt names your lane.

## Goal
TJ owns fhfhockey.com and wants `web/pages/wigoCharts.tsx` overhauled: fix the layout, audit each component's health, ensure every unique component renders correct, complete, current data, speed up load, improve UX/UI. A planning thread (the session that started you) combines your reports into a plan. **You audit. You change no application code.**

## Settled layout decisions (TJ, pop-ups, 2026-11-01)
- **No-scroll stays** at >=1280x800: every panel on one screen, as decided on 10-25.
- **Workspace widens** from 90% to 95% on this page.
- **Centre table:** one band, 36 metric columns, time periods as rows (STD, LY, CA, 3YA, L5, L10, L20), DIFF as the bottom row. Compare dropdowns stay in the toolbar. L and R markers go on the period row labels. The period column is pinned. No side-scroll at 1280: a group row (Totals, Per 60, On-ice) lets headers drop "/60", and DIFF drops its decimal.
- **Charts:** one full-width row of four: Metric Game Log, TOI, Points/GM, Game Score.
- **Bio group (about 60% wide, top left):** headshot and identity, season production, per-game pace, date/opponent list (`OpponentGamelog`), rate stat percentiles.
- **Right of the bio group:** doughnut and radar side by side, ratings and team drivers beneath them.
- **Phone:** keep the four tabs, regroup content, horizontal table with pinned period column and side-scroll.
- Goalies are excluded from search, so no goalie test case.

## TJ's approvals (exact scope; do not exceed)
**Production database reads, lanes B and C only.** SELECT only, through the Supabase MCP `execute_sql`, one at a time. 40 queries in total: **lane B 20, lane C 20**. At most 200 rows returned per query; aggregates preferred; scope by season and player so nothing scans a whole large table. Tables: `wgo_skater_stats`, `wgo_skater_stats_totals`, `wgo_team_stats`, `wigo_recent`, `wigo_career`, `players`, `games`, `nst_team_5v5`, `nst_gamelog_*`, `nst_percentile_*` (WiGO's only), plus RPCs `get_skater_game_scores_for_season` and `get_skaters_avg_stats`. `get_skaters_avg_stats` timed out in September, so wrap it in a count or small projection and run it at most twice. Confirm the project by matching the ref in `web/.env.local`'s Supabase URL; never print keys or copy env values anywhere. Log every query, before you run it, as one line in `audits/PROD-READ-LEDGER.md` (lane, purpose, SQL, then rows returned). If a query you need falls outside this scope, stop and ask the planning thread.

**Lane B extension (TJ, pop-up, 2026-11-01).** Lane B only, within its 20 queries, aggregates only: `seasons` (newest 2 rows), `cron_job_audit` and `cron.job` (WiGO writer rows only), `nst_seasonal_individual_counts`, `nst_seasonal_on_ice_counts`. Then TJ approved 4 more lane B reads for these tables, since the 20 were already spent: total budget 44, lane B 24. TJ also approved lane C's 20th read for the two `nst_seasonal_*` tables, aggregate, season 20262027.

**Live page loads, lane D only.** At most 6 page loads, one at a time, from an isolated local dev server against production Supabase. Do not call any route on purpose. Log each in the ledger.

**Target players.** Lane B's first query picks four current-season skaters from the data: star (top points), depth (low TOI per game with real GP), rookie or low GP, traded (two or more teams this season). Lane B writes `audits/TARGET-PLAYERS.md` (id, name, why). Other lanes use those.

## Hard rules
- Write only your report, your diary and the ledger/target file above. Nothing else. No application code, tests, configs or stylesheets. No git mutations at all (no add, commit, stash, reset, checkout).
- No production writes, migrations, deploys, pushes or Vercel builds. No cron, ETL, refresh or recompute routes; TJ runs routes from the browser. Do not read Vercel usage or logs in a way that makes app requests.
- NST code is the Codex lane: report NST findings, do not propose silent edits. NST limits in `AGENTS.md` still apply; you should make no NST requests at all.
- Never set `GIT_DIR`. Dev servers are isolated: `PLAYWRIGHT_ISOLATED_NEXT=1` (uses `.next-playwright`), on a port other than TJ's, in `web/`. Check first that nobody else is using `.next-playwright` (`lsof`, process list); if someone is, ask the planning thread. Stop your server by exact PID, never a broad pkill. Do not run e2e with `PLAYWRIGHT_PORT` against a running server; use `PLAYWRIGHT_BASE_URL` plus `PLAYWRIGHT_SKIP_WEB_SERVER=1`.
- Other lanes' dirty files are off limits, even to tidy: `functions/api/fetch_team_table.py`, `tasks/artifacts/tuesday-trends-2026-10-26/**`, `tasks/artifacts/social-share-expansion-2026-10-31/**`, coordination files.
- For independent sub-work, start new sessions rather than Agent subagents; subagents are for read-only research you synthesize yourself. Pass this rule on to any session you start. Ask questions only if truly blocked, as one short `SendMessage` to the planning thread.
- Keep a context diary per `AGENTS.md`: `tasks/diaries/2026-11-01-claude-wigo-audit-<lane>.md`.

## Starting point
- `tasks/artifacts/wigo-redesign-2026-10-25/AUDIT-REPORT.md` and `audit-A.md`, `audit-B.md`, `audit-C.md`. Re-verify the open items in your area (A-02, B-05, B-06, B-07, B-10 to B-13, C-02 and others) as still open or fixed. Do not re-derive items closed there unless the code has since changed.
- `tasks/artifacts/wigo-visual-pass-2026-10-30/` (`STEPS.md`, `AUDIT-2026-10-30.md`, `DESIGN-REVIEW-2026-10-30.md`, `A11Y-2026-10-30.md`, `tools/`). This declutter landed on `octoberBranch` after the 10-25 audit, so line numbers in the older reports have moved.
- Code: `web/pages/wigoCharts.tsx`, `web/components/WiGO/**`, `web/components/CategoryCoverageChart/**`, `web/hooks/useWigo*`, `web/utils/fetchWigo*`, `web/utils/calculateWigoRatings*`, `web/pages/api/v1/db/calculate-wigo-stats.ts`.
- Fixtures: `web/e2e/fixtures/wigo/`, `web/e2e/wigo-one-page.spec.ts`, `tasks/artifacts/wigo-redesign-2026-10-25/net-deny.cjs`.

## Report format
One file: `tasks/artifacts/wigo-charts-overhaul-2026-11-01/audits/<lane>.md`. Lead with the worst findings. Every finding has:
- an ID (`<lane letter>-NN`, plus the old ID if it continues one);
- severity: **P0** wrong number shown, **P1** misleading or missing, **P2** performance, **P3** minor;
- `file:line`;
- the failure scenario, with concrete inputs and what the user sees;
- how it was verified: `code`, `fixture` or `production read` (cite the ledger line), and what you could not verify.

Say plainly what you did not check. A claim marked verified must have been run or read by you in this session. Establish the current season from the data, never by assumption. End with a short table of re-verified old items (still open or fixed). Your closing message to the planning thread is a few lines, with the report path first; the detail belongs in the file.
