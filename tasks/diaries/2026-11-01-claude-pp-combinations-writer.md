# powerPlayCombinations writer fix

- Scope: make PP time and units in `powerPlayCombinations` match NHL.com. Local fix only; no production writes.
- Where: `octoberBranch`. `web/utils/getPowerPlayBlocks.ts`, writer `[gameId].ts`, `LinemateMatrix/utilities.ts`, `powerPlayTimeFrame.ts`, the writer's game test. Report and backfill plan: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/pp-writer-fix.md`.
- State: 144/144 skaters within 2s on 4 games of 10-31, was 65/144. Affected tests, eslint and tsc on these files pass.
- Next: TJ runs the backfill in the report. Stored rows stay wrong until then.
- Blockers: none. Backfill needs TJ.
- Audit F1 and F11 fixed: gross shift gaps refuse the game (3 players per PP second per team), and a stale row is deleted only with boxscore evidence: shift time matches TOI within 2s, or the player did not play; bulk route capped at 60 games per call, 4 at once. The route test now mocks the audit and off-season wrappers, which also cleared its 4 old 503 failures.
- Gotchas: `pp_timeframes` keeps the old block logic on purpose.
