> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# native-serving-plan (session local_e0302afc-1042-4001-ab60-fac686a77d43)

Title: "Native FORGE serving plan for RSO and Start Chart". Idle after 58 turns. Plan-only: it edited nothing but its one PLAN.md.

## 1. Scope
- Task: a concrete, evidence-backed plan to serve native FORGE forecasts to production RSO, Start Chart and the FORGE dashboard from one source. Audit findings A-11 (native serving), A-09 (provenance label policy) and A-08 (missing-head rule) in `tasks/artifacts/sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md`.
- Started by the RSO owner session (local_08a0bf1c, "Code handoff review and project recommendation"), which relays TJ's work.
- Six required sections: inventory (master / branch-only / still-to-write), single source selection plus fallback, step order, release slices, acceptance checks, decisions for TJ.

## 2. Where
- Branch octoberBranch. Plan: `tasks/artifacts/forge-native-serving-plan-2026-10-19/PLAN.md` (272 lines). Committed in `5ae65fc13` ("octoberBranch reconciliation", 10-19 14:18). On octoberBranch and origin/octoberBranch, not on master.
- Written against branch HEAD `b47c512fb` and master `ad93e2887` (R4). It predates R5 and R6a-R6f, so master facts in it are stale.
- Follow-on build of its slice S-1: `tasks/artifacts/r6-s1-serving-source-2026-10-19/README.md` (new `web/lib/player-forecasts/forecastServingSource.ts` and edits to start-chart, RSO `/data`, `forge/forecasts`, `planning.ts`). Present on octoberBranch via `5ae65fc13`; absent from origin/master (checked with git cat-file).

## 3. State
- Done: PLAN.md delivered with all six sections, file/line citations and an "Unverified points" list. No tests or builds run (plan only).
- Decisions since: the S-1 README says TJ chose D-1 = serve-and-flag and D-2 = empty fallback. No record found of TJ's answers on D-3 to D-7 (activation, head-ID process, B2, expiry window, dashboard scope); the README lists D-5 as undecided and D-6 as left open.
- Released: only S-0 (A-08 shared missing-head rule) shipped, in R5 `bb21d5942`. S-1 to S-3 and activation are not released. The R6 plan (`release-r6-2026-10-19/PLAN.md`) says S-1 and the frozen native files stay out of R6 and the native path stays off in production (head env not set in Vercel production, checked by name only).

## 4. Next (the plan's own order)
1. After the 2026-10-20 17:00Z freeze: apply the FORGE patch set in the recorded order, run focused tests, tsc and replays.
2. Native v1 re-run before 2026-10-27 04:00Z: first publish with a new head UUID at revision 0, then local readback.
3. Build and release R6 (S-1 to S-3) inert, with the head env unset.
4. B2: ship the two schedule writers and a bounded daily refresh, or native totals read `incomplete_refresh`.
5. Activate (set `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` and `FORGE_NATIVE_SERVING_FALLBACK`, one redeploy) only after two clean consecutive daily issuances on one head. Plan estimate: about 10-29, never on the v1-to-v2 switch day.

## 5. Blocked / needs TJ
- D-3 activate and when; D-4 head-ID process (recommended: one fixed ID set once); D-5 approve the B2 refresh cron; D-6 expiry window; D-7 dashboard scope (keep Top Adds, Goalie Risk, GameGrid team forecasts on legacy).
- Any env change or redeploy is a costly remote action: needs explicit authorization and the 4-project Vercel check (see memory "Push octoberBranch together").
- Whether any serving file is on the 19-file frozen list was never located (unverified).

## 6. Insights
- Five premises in the brief were wrong: (1) the head env holds one head-row ID that each daily issuance advances by compare-and-swap, so no daily env edit or redeploy; (2) `/data` `forecastedOpportunities` counts legacy game revisions only and stays 0 under native-only serving, so acceptance uses resolved-forecast counts; (3) the branch Start Chart page always sends `forecast_source=game_expectations` (`start-chart.tsx:442`), which would empty the page in production unless the server picks the source; (4) a native catalog expires at the league's first puck drop, so every surface falls back every evening; (5) RSO has no legacy fallback.
- 0 of 382 succeeded legacy runs carry the provenance label, so refusing unlabelled runs would empty every legacy surface.
- Possibly stale: C-5 ("production RSO serves no forecasts") predates R6c, which put an interim FORGE bridge (reads `forge_runs` and `forge_player_projections`) into production RSO. Re-check before relying on it (unverified).
- Unverified items in the plan: production values of several env vars; whether a hosted cron rewrites schedule rows in full mode and strips freshness markers; whether dashboard cards parse the native board; R5's final scope (now known).
