# F4: game finality from a stored game state (rule 19; L2 W2-3 D7)

## Scope
- Follow-up lane F4 of the math-audit fix sprint (brief: `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/FOLLOWUP-LANES-2026-11-13.md`).
- Store the NHL game state on `public.games` (migration, not applied), have `/api/v1/db/update-games` write it, switch the underlying-stats landing and detail readers to it, keep the date/time heuristic only as a labelled fallback.
- Owned: `web/lib/underlying-stats/playerStatsLandingServer.ts` (finality functions only) + its test, `web/pages/api/v1/db/update-games.ts` + test, new migration + authority row (+ count bump in `supportedBaselineMigration.test.ts`), new contract module `web/lib/games/gameFinality.ts` + test.
- Not mine: CTPI, SOS, Lines files.

## Where
- Branch `octoberBranch`, canonical checkout. Start HEAD 244645342.

## Findings
- Landing heuristic (`isFinishedPlayerStatsSourceGame`) is `date < UTC today OR start + 8 h <= now`. From 00:00 UTC every game of the previous ET date reads final, before or during play. Missing summaries are then built live from partial PBP.
- The Pg landing path does not even select `startTime`.
- `update-games` cron runs 03:00 UTC (22:00 ET), so late games are stored FUT/PRE/LIVE until the next day's run. A strict "stored non-final = not final" reader would hide them for about 24 h. Decision: a non-final state observed before start + 8 h is stale, so it is treated as unknown and falls back (labelled) to start + 8 h; a non-final state observed after start + 8 h is trusted.
- Other consumers of the heuristic use the safe AND form (`date < today AND start + 8 h <= now`): refresh windows (player, team, goalie), adminRouteHelpers, update-player/goalie-underlying-summaries, nhlRawGamecenterRoute, teamStatsSummaryRefresh (date only). Listed for follow-up, not changed.

## State
- Migration `supabase/migrations/20261113180000_games_game_state.sql` (NOT applied), authority order 146 pending, counts bumped (test 146/11 pending; super-goal summary 146). Proof `supabase/tests/f4_games_game_state.py` RESULT OK on local PG15; rollback `supabase/tests/f4_games_game_state_rollback.sql`.
- Contract `web/lib/games/gameFinality.ts` (`nhl-game-state-v1`) + test (10).
- Ingester writes the three columns; dedupe keeps the most advanced state; unknown values NULL + warning.
- Readers: landing filter, detail filter, direct-pg select use the contract; `resolvePlayerStatsSourceGameFinality` exported.
- Checks: vitest landing (34), update-games (13), supportedBaselineMigration (21), gameFinality (10) pass; the 9 new landing/ingester tests fail on HEAD code (checked by restoring HEAD files temporarily). ESLint exit 0 on changed files. `npm run typecheck` exit 0.
- Commits: 94e4c7c67 (migration, proof, rollback, authority row 146, counts); code commit follows.
- Production steps and consumer list: side-session notes `F4-game-finality-production-steps.md`.

## Next
- Report to Chef. Production steps (apply 146, release, backfill) wait for TJ's approval.

## Blockers / approvals
- None. No production reads or writes.
