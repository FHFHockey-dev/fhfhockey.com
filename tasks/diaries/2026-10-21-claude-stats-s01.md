# Stats S01: team shares and Game State GS1 contracts

- Scope: ST01/ST01b + ST05-GS1 from the consolidated stats plan (~/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md). Local changes and local tests only; no push/deploy.
- Where: octoberBranch @ b5188a452 (R10 sync), uncommitted.
  - New: web/lib/stats/percentUnits.ts (+test), AdvancedL10Metrics.test.tsx, GameStateAnalysis.test.tsx.
  - Changed: AdvancedL10Metrics.tsx/.module.scss, TeamDashboard.tsx (season 5v5 panel aggregate + L10 season-date props), GameStateAnalysis.tsx/.module.scss.
- Source trace (read-only):
  - NST team writer (pages/api/Teams/nst-team-stats.ts) requests fd=td=date, stype=2 → one regular-season date per row, percentage points, count columns present, toi in seconds.
  - WGO team writer (lib/supabase/Upserts/fetchWGOdata.js) uses gameDate = that date, isGame=true → one game date per row; no game-type filter, so season_id alone may include preseason.
  - ST01b resolved: L10 now sums the per-game counts.
- Checks run, all pass: vitest on percentUnits, AdvancedL10Metrics, GameStateAnalysis, TeamDashboard dir, TeamTabNavigation, pages/stats/team (51 tests); tsc --noEmit (needed NODE_OPTIONS=--max-old-space-size=8192; default heap OOMs); eslint on changed files; CSS Modules pure check on both scss.
- Not run: browser render (local dev reads production Supabase; plan forbids that for fixture checks).
- Next: TJ review/commit; then S02.
- Follow-up (TJ approved): season special-teams card now aggregates every season WGO game row (date-bounded, games_played > 0) with `aggregateWgoTeamGames`, moved into lib/stats/percentUnits.ts and shared with the L10 panel; unused `pp_pct_l10`/`pk_pct_l10` use the last 10 rows. New TeamDashboard test; harness gained `.gt`. Rechecked: 52 tests, tsc, eslint pass.
- Open findings (not fixed, out of S01 scope):
  - All-teams rank colouring still averages raw NST pct per row (consistent units, so only ordering; S14 territory).
  - WGO score-state per-game shares: null vs 0 when a state never occurred is unverified.
  - Score-state reads may include preseason rows.
