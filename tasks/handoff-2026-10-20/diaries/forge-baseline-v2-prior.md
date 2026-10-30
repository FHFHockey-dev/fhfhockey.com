# Handoff diary: forge-baseline-v2-prior (baseline v2: prior-season game window)

> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

Session id: `local_1a6919f9-e56f-47be-833d-24d2fcac68a4` ("FORGE baseline v2: prior-season game window"), idle after 3 turns. Proposed and started by `review-forge-model-82-ga` (proposal task_781c1a94).

## 1. Scope
- Replace the fixed `previousAppearanceWindow: 82` in `web/lib/player-forecasts/baselinePolicy.ts` with a window equal to the PRIOR season's per-team regular-season game count (`seasons.numberOfGames` for `seasonId - 10001`, via `getSeasonById` in `web/lib/NHL/server/index.ts`, or a pure per-season input), as a new versioned baseline definition (v2).
- Why: for 2026-27 forecasts the prior season (2025-26) had 82 games, so 82 is correct now. In 2027-28 the prior season has 84, so `buildPriorAppearanceSkaterRates` (`baselineRates.ts:205`) throws for any player with 83-84 appearances for one club, and the legacy/goalie paths would silently drop the 2 earliest games.

## 2. Where
- Nothing started. No files read or edited, nothing committed. `previousAppearanceWindow: 82` is still at `baselinePolicy.ts:60` and the v1 definition hash is still pinned at `baselinePolicy.ts:74` (checked by the helper on octoberBranch).
- Files the change touches (per its brief): `baselinePolicy.ts`, `baselineRates.ts` (lines 127, 205), `goalieBaselineRates.ts` (114), `web/scripts/forge-walk-forward-native.ts` (173), and tests (`contributions.test.ts`, `goalieBaseline.test.ts`, baseline rates tests). `baselineRates.ts` and `goalieBaselineRates.ts` are on the FORGE freeze list.
- Source analysis: `~/Library/Application Support/Claude/side-session-notes/local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41/forge-82-game-audit-2026-10-19.md`.

## 3. State
- Not started. On 2026-10-19 13:18 UTC it declined to start because the FORGE freeze runs until 2026-10-20 17:00 UTC. At compile time it is 2026-10-20 about 15:10 UTC, so the freeze is still on (lifts in under 2 hours).
- No checks run.

## 4. Next
- After 17:00 UTC Monday (2026-10-20), someone must message this session to start (it will not start by itself). It said it would check with the FORGE Chef session before integrating. The Chef session at the time was `local_4317ea20` (chef-resume-1019).
- Planned work: v2 definition with the prior-season game-count window; selection rule v1 for target season <= 20262027, v2 from 20272028 (or as Chef decides); keep v1 and its pinned `BASELINE_CANDIDATE_DEFINITION_HASH` intact so archived 2026-27 captures and replays still verify; Vitest cases for an 84-appearance prior season; `npx tsc --noEmit`; and a note on which definition hashes rotate.

## 5. Blocked / needs TJ
- Blocked by the freeze until 2026-10-20 17:00 UTC, then by Chef coordination: the other freeze-lifting work (FORGE v2 7-patch set plus means-only patches, see `forge-v1-fix-native-targ.md`) also lands in `web/lib/player-forecasts/` at that time. Apply order and conflicts are unverified.
- A new baseline definition is a method-level change. Whether it needs TJ approval under the standing approval (`tj-standing-approval-2026-10-17:forge-daily`, which covers only unchanged method/definition hashes) is unverified; the PRD says any new or changed definition hash goes to TJ.
- Timing: the change is only needed before 2027-28 captures (Oct 2027), so it is not urgent.

## 6. Insights
- The change rotates `baselineDefinitionHash` / `priorAppearanceDefinitionHash` and the catalog identities for any run that uses v2; v1 runs are unaffected, so 2026-27 outputs do not change.
- Do not edit the v1 policy object: the module throws at import if its payload hash differs from the pinned hash.
- The brief's selection rule keys on the target season (v1 up to 20262027, v2 from 20272028), which keeps replays deterministic. Chef may decide otherwise.
