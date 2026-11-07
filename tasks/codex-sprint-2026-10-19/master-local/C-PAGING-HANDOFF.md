# C-PAGING / ranking post-alignment C0064

Status: local boundary acceptance passed; ready for Chef review. Ownership released; no running processes or blockers. Runtime Sol/medium previously confirmed from own matching turn_context. Canonical octoberBranch; no Git mutations.

Exact files changed/created by this assignment:

- `web/lib/rankings/teamMatrix.test.ts`
- `web/lib/rankings/goalieMatrix.test.ts`
- `web/lib/rankings/deploymentTiers.test.ts`
- `tasks/codex-sprint-2026-10-19/master-local/C-PAGING-HANDOFF.md`

Runtime source remained read-only. Each existing test file gained one representative boundary case, retaining exact ordering assertions for other paged tables. Existing query mocks now slice actual fixture rows by requested offsets, retain requested sort keys, and permit a different backend ordering for unresolved ties on the second page. Missing-key simulation changes only in-memory mock behavior, never source bytes.

## Actual boundary and sensitivity

| Reader exercised through public surface builder | Exact fixture / successful output | In-memory missing-key adversary / observed wrong output |
| --- | --- | --- |
| `buildTeamMatrixSurface` → `team_underlying_stats_summary` | 1,001 rows: one leading team1 row, then 500 two-team game pairs on distinct dates, ordered descending date/ascending game/team. The final pair straddles rows999/1000. Output styleGames is team1=501/team2=500. Requests `[0,999]`, `[1000,1999]` asserted. | Ignore `team_id` ordering, reverse unresolved team ties on later page: team1 row repeats and team2's final game vanishes. Output team1=501/team2=499 (distinct-date counting masks duplicate, still exposes loss). |
| `buildGoalieMatrixSurface` → `goalie_stats_unified` | 1,001 distinct goalie IDs on one tied date; each has one start/game,29saves/30shots/3,600seconds. Output totalRankedRows=1,001 and goalie1 gamesPlayed=1. Both actual page offsets asserted. | Ignore `player_id` ordering, reverse unresolved date ties on later page: goalie1001 disappears, goalie1 repeats. Output totalRankedRows=1,000 and goalie1 gamesPlayed=2. |
| `buildDeploymentTiersSurface` → exact PP rolling snapshot | 1,001 PP1 player IDs on one selected date, valid existing rolling numerator/denominator fixture fields and sample minima; metadata supplied for every player. PP1 playerCount=1,001 and available. Both actual page offsets asserted. Distinct team request/cache keys isolate control/adversary. | Ignore player ordering and reverse later-page tied snapshot rows: duplicate collapses during latest-per-player selection, PP1 playerCount=1,000. |

All successful-completeness assertions would encounter the adversarial output if the representative tie-break were removed: team and goalie fixtures derive unique ordering from actual requested keys; deployment likewise checks the actual requested `player_id` key. Explicit omit controls exercise that same missing-key branch within each passing test. Tests check data/aggregate outputs, not only `.order()` call arrays. Fixtures are synthetic reader exercises, not real NHL chronology, production row counts, query-plan measurements or hosted behavior.

## Checks actually run

Exact focused command from `web/`:

`npm test -- lib/rankings/teamMatrix.test.ts lib/rankings/goalieMatrix.test.ts lib/rankings/deploymentTiers.test.ts`

- First run FAIL exit1:20pass/1fail; team initially used one date for all rows, but actual aggregator counts distinct dates. Goalie new boundary passed. A deployment edit script also failed before writing because its relative path included redundant `web/` from web cwd; corrected to absolute path.
- Second run FAIL exit1:21pass/1fail; corrected team fixture/adversary passed, deployment count passed but its offset assertion revealed two dates from existing games mock, producing two page pairs. New fixture narrowed to its intended single snapshot.
- Final run PASS exit0:22/22 across all three files (team9, goalie9, deployment4), including all three completeness and in-memory adversary cases. Nonfatal Node punycode deprecation only.
- Scoped `git diff --check` on the three test files PASS exit0.
- Global tsc/lint, full suites, builds, browser, hosted/provider requests NOT RUN; Chef owns global verification. No dependencies added, source files edited, or new test files created.

SHA-256 at handoff:

- teamMatrix.test.ts: `b740b2ae1a241cc4e96d322b4a56590532cbda235634cbaa3d98f3657a1fe1c5`
- goalieMatrix.test.ts: `51a6a00dc2557975570d2392862d7ba071ea7cd1c950a53020271c546979d2ca`
- deploymentTiers.test.ts: `1a1b90379ff95804c6f0ce032a3f50fb64a8b4fdb9ff68bd010f8d26f90de54f`

Next action: Chef independently reviews/reruns this focused three-file cohort and runs reserved global checks. C0064 requires that acceptance, not the earlier order-array-only receipt. No pending worker work.
