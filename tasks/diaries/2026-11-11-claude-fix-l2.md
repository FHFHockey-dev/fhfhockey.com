# Diary: fix lane L2 (underlying-stats landing and team summaries), 2026-11-11

## Scope
Brief: tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L2.md (W2-P0-2..7, W1 P0 #2 display, #4, #5, P1s). Chef: local_78a99adf.
Owned: web/lib/underlying-stats/**, web/pages/api/v1/underlying-stats/**, web/pages/underlying-stats/**, web/components/underlying-stats/**.

## Where
Branch octoberBranch, sole checkout. Claim appended to CLAUDE-TO-CODEX.md (CLAUDE-FIX-L2-CLAIM-20261111); no Codex claim on these paths in last 60 lines of CODEX-TO-CLAUDE.md.

## State / checks
- (start) read brief/rules/decisions. Split by file (told Chef): sub-session fix-l2-landing (local_cd1b8e3c) owns player/goalie landing server + goalie files + player/goalie pages/APIs. I own team summaries/queries/landing, xG explorer, shared helpers.

- W2-P0-6 done: pooled helper `poolTeamSpecialTeams` + `rankSpecialTeamsCompetition` in web/lib/underlying-stats/teamSpecialTeamsContext.ts (L12 imports). Season bound via `seasons` table + season_id; regular season only. Tests: teamSpecialTeamsContext.test.ts (6), __tests__/pages/api/underlying-stats/landing-special-teams.test.ts (served). Old code: NJD ppPct 0 vs 25 (fail shown).
- Shared predicate web/lib/underlying-stats/underlyingStrengthPredicate.ts (+test) sent to fix-l2-landing.
- Team writer (teamStatsSummaryRefresh.ts): L1 manpower + running score; sudden-death end; playoff OT 1200 s; playoff OTL = loss. 6 new writer tests fail on HEAD (export-only patch), pass now.
- Team reader (teamStatsQueries.ts/teamStatsLandingApi.ts): nulls-last sort + tie-break, competition rank, per-team last N by date (gameRange == teamGameRange), record null under split, unresolved games out of point%, nullable TOI, xG nulled, 5v5 official overlay no SF/SA mixing + provenance. 8 reader tests fail on HEAD, pass now. Served test teams-served-math.test.ts (writer rows -> API): 3 fail on HEAD, pass now.
- Filters/columns: rates default sort cfPct; xG columns + sort keys removed; "# of GP" control merged into "# of Team GP" (decision 95). Updated pinned tests (teamStatsFilters, teamStatsColumns, teamStatsQueries placeholder test) with reasons.
- Decision: kept coverage as head-count approximation (labelled) to avoid adding a paged read per API request (cost); D15 summarized-count not changed.
- Read-only queries run: none.

- Landing: record-SoS labels (decision 93); trust tags + narrative descriptive (D16); tests updated.
- xG explorer (W3-1 D7, W2-3 D9/A4): rewrite started then REVERTED (usage limit). Plan: registry pin via fetchActiveXgModel; created-xG only when same as_of_game_id + games_count; hide unwindowed transition/rebound game sums; coverage from served rows; page shows "—".
- Typecheck: last full run exit 2 (one test-file type error, since fixed); not rerun after fix.

- Session 2: 829332f70 — xG Lab registry pin + one window per row (8 new tests fail on HEAD); team FHFH house labels; playerStatsSorting.test xgfPct->cfPct (L2-landing ticket).
- Checks: ESLint on all L2 files exit 0; typecheck exit 2, all errors in rankings files (other lanes), none in L2 files.
- Combined rebuild plan: side-session notes L2-rebuild-plan.md.

## Next
- Chef review; production rebuild only on TJ approval.

## Blockers / approvals
- Rebuild (TJ). DR1 decision (L2-landing). Bucket xG writer retirement needs nullable columns (L4a) — recommended to leave.

## Chef verification (2026-11-11)
- 829332f70 verified by Chef (43 files / 299 tests). Accepted: bucket-heuristic writer stays until cleanup inventory; D15 labelled approximation. D11 ticketed to L1. DR1 = decision 110, L2-landing implementing. Lane closes when L2-landing reports DR1. Keep this diary until the debrief.

- DR1 fixed by L2-landing in 90c6ace50 (decision 110); release-order note sent to Chef. Lane L2 closed per Chef; diary kept until debrief.
- Decision 111 done by L2-landing in 40b7cc4d3 (stale goalie summaries show "Recalculating goalie stats"; goalie rebuild runs right after deploy per updated plan).
