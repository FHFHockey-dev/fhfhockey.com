# Lane S-03 diary: Super Goal data-correctness fixes (2026-10-18)

Uncommitted on octoberBranch. No network, hosted DB, deploy, push or dev server. Full details are in the shared note `data-correctness-fixes-2026-10-18.md`.

## Files (web/)
- **Paging tie-breaks:**
  - Source: `lib/underlying-stats/teamStatsQueries.ts`, `lib/rankings/{teamMatrix,goalieMatrix,deploymentTiers}.ts`, `lib/supabase/Upserts/fetchRollingPlayerAverages.ts` (`fetchGames`).
  - Tests: each file's nearest `.test.ts`.
- **goalie-power (whole file owned by S-03):** `pages/api/v1/trends/goalie-power.ts`
  - `PAGE_SIZE` is now 1000.
  - The stable `GOALIE_TRENDS_UNAVAILABLE` 500 response was already in place from S-02.
  - `inFlight` is now cleared in `finally`, so a failed load no longer replays.
  - Test: `__tests__/pages/api/v1/trends/goalie-power.test.ts` (redaction, retry after failure, capped paging).
- **Trends sidecar:**
  - Source: `lib/supabase/Upserts/rollingPlayerSupportPayload.ts` (`mergeRollingSupportPayloadFields`), `pages/trends/player/[playerId].tsx`, `lib/supabase/Upserts/rollingPlayerValidationPayload.ts`.
  - Tests: the page test and `rollingPlayerValidationPayload.test.ts`.
- **fullRefresh:**
  - Source: `lib/rollingPlayerOperationalPolicy.ts` (`resolveRollingFullRefreshMode`), `fetchRollingPlayerAverages.ts` `main()`, `pages/api/v1/db/update-rolling-player-averages.ts`.
  - Tests: the route test and `fetchRollingPlayerAverages.test.ts`.
- **Forecast:**
  - Source: `lib/game-predictions/workflow.ts` (`NoProductionModelVersionError`, `summarizePredictionWindowOutcome`), `pages/api/v1/game-predictions/forecast.ts`.
  - Tests: `workflow.test.ts` and `__tests__/pages/api/v1/game-predictions/forecast.test.ts`, which runs the real `withCronJobAudit`.

## Checks
- **Vitest:** focused runs per item pass. 108 neighbouring test files (1,024 tests) pass. goalie-power has 3 of 3 passing after the merge.
- **Mutation checks:** each new test fails against the old code.
- **ESLint:** clean on all changed files.
- **8 GB tsc:** clean for S-03 files. The only errors are the two routes importing `persistCapturedGameNormalization` from `nhlRawGamecenter.mjs`, which another lane owns.

## Status
Done. Not committed. Production reads to size the impact are listed in the shared note.

## Next command
```bash
cd web && npx vitest run lib/rankings lib/underlying-stats/teamStatsQueries.test.ts lib/supabase/Upserts __tests__/pages/api/v1/trends/goalie-power.test.ts "__tests__/pages/trends/player/[playerId].test.tsx" __tests__/pages/api/v1/db/update-rolling-player-averages.test.ts lib/game-predictions/workflow.test.ts __tests__/pages/api/v1/game-predictions/forecast.test.ts
```
