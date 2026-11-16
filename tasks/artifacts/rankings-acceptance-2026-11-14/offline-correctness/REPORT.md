# Rankings offline correctness: re-status of the 11-08 audit at `89da739cb`

Claude, 2026-11-14, offline only. This is input for Chef's verdict, not a verdict.

**Baseline.** The tests ran on `octoberBranch` at HEAD `9a312597e`. Chef reports that the Rankings paths there are byte-identical to deployed `89da739cb` (#446) and to #431, and none of them are dirty. All `file:line` references below are to that tree. No non-test source changed: `git diff` shows nothing under `web/lib/rankings`, `web/pages` or `web/components`.

**Bottom line.** Of the 11-08 defects, R06 is nearly closed and R05's arithmetic is fixed. R04's skater parsing is fixed. Still open: the rolling-fallback population horizon (R03), team-token handling for the team snapshot and comparison and for goalie invalid tokens (R04), goalie projection age and per-metric exposure (R05), and two cross-view divergences: the snapshot drawer and the matrix show different composite ranks for the same player on one screen, and Metric Explorer ranks metrics the matrix leaves blank (R07/parity). Two open items have no runtime reproduction (R03 role labels; R04 swallowed snapshot errors) and are cited from source. **16 "DEFECT PRESENT" reproductions pass, so 16 defects are present; 2 FIXED-CHECK tests confirm fixes (18/18 green).** Three of the 16 reproduce Chef's live findings (see the section below); the R03 horizon is **live in the published 2026-27 cohort** through the entity ranking writer.

## Fixes (2026-11-15, Chef-cleared; local, uncommitted)

Claim: `CLAUDE-RANKINGS-ACCEPTANCE-FIX-CLAIM-20261115`, plus its W1 addendum (TJ approved by pop-up: a local fix, no republish). Base: HEAD `711ca63b5`. The Rankings files there are unchanged since `9a312597e`/`89da739cb`.

Each fix was done in three steps: flip the reproduction into a correctness test, confirm that test fails on unfixed code, then make the smallest change. The status table and sections above describe the pre-fix state. This section supersedes them for F14, F13, F1, F4, F5, F6 and W1. Patch: `FIXES.patch` (`git diff` of the tracked files plus `git diff --no-index` for the new acceptance files).

| Fix | Before (failed against unfixed code) → after test | Change |
| --- | --- | --- |
| F14 | `SNAPSHOT-UNPUBLISHED-SCAN` → `FIXED F14 SNAPSHOT-ONE-BUILD`. Pre-fix: 120 per-player TOI reads for a missing id. Post-fix: page 1 = 50, page 3 = 20 with identical non-page reads, missing id = 0 per-player reads and fewer reads than a page-1 hit. | `playerMatrix.ts`: an internal `pageForSelected` request flag (never parsed from a query). It serves the page that holds `selectedPlayerId` from the already-ranked rows. When the id is absent it sets `meta.selectedPlayerAbsent` and skips all page enrichment. `snapshot.ts`: skaters use one build with that flag; reason "Selected skater is not in the published cohort for this context." (or "ranked cohort" on the rolling fallback). Goalies and teams use one build with a 10,000-row page; their surfaces already rank in memory. `scanPages` is removed from `snapshot.ts`. `snapshot.test.ts`: the old scan test now asserts one build, plus a new absent-skater test. |
| F13 | `TEAM-FILTER-SOURCE` → `FIXED F13 TEAM-POOL-FROM-PUBLICATION` | `entityMetricRankingReader.ts`: when no exact team/position/EV-deployment snapshot exists, read the published `all_skaters/all` snapshot, keep the rows in the declared pool (`team_id`, `position_group`, `deployment_bucket`) and re-rank them with the existing calculator. The response gets the source warning "Ranks are re-computed inside the selected pool from the all-skater publication." and `peerGroup` reports the ranked pool. PP/PK units are not derived: those rows store only the EV bucket. `playerMatrix.ts`: when no exact-scope composites exist, read league-scope (`all_skaters`) composites, rank them inside the displayed pool, expose `composite.peerGroupType/peerGroupKey`, and add the warning "Composite ratings are league-scope values…". Source and snapshot date now match the unfiltered view. |
| F1 | `PARITY-COMPOSITE-CONFIDENCE` (DEFECT) → `FIXED F1 PARITY-COMPOSITE-CONFIDENCE` | `playerMatrix.ts`: composite cohort ranks and the composite fetch use the whole ranked pool (`cohortRows`). Sample confidence, like search, only narrows the displayed rows. The matrix and the drawer now agree, even though the snapshot URL still omits `sample_confidence`; `rankingUrlState.ts` was not touched. |
| F4 | `R04-TEAM-SNAPSHOT-TOKEN`, `R04-TEAM-COMPARISON-TOKEN` → `FIXED F4 …` | `snapshot.ts` exports `findTeamRowByToken`, which runs `resolveTeamTokenFromRows` over the team-matrix rows (no extra read). The team snapshot and team comparison accept an id, abbreviation or full name. An unknown token is still an explicit "unavailable" subject. Team comparison is now one build (at most 32 teams per page of 50). |
| F5 | `R04-GOALIE-INVALID-TOKEN` → `FIXED F5 …` | `goalieMatrix.ts`: a non-empty team token that resolves to no team throws the same `ContextualRankingsQueryError` (message and details) as the skater parsers. The matrix, snapshot and comparison therefore return 400 instead of an empty 200. |
| W1 | `WRITER-POPULATION` → `FIXED W1 WRITER-POPULATION`. Pre-fix: the writer published players 1-4. Post-fix: it publishes 1-5 with the same values and ranks as the composite path, and throws when coverage is unverified. | `rankingQueries.ts`: `buildContextualRankingSnapshotRowsByMetric` gains `options?: { completeSeasonRows }`, passed through to `resolveRankedSnapshotsForMetrics`. Signature only; the interactive path is unchanged (+6/−1). `entityMetricRankingWriter.ts`: calls `loadSkaterCompositeSeasonSources` once per build, throws "Source coverage is not verified; no entity metric rankings were built. …" when `report.verified` is false (the route turns the throw into a 400 with no upsert), and passes `{ completeSeasonRows }` for every window. `entityMetricRankingWriter.test.ts`: mocks the coverage loader and the server client, asserts the rows are passed through, and adds a refusal test. **Production keeps showing 740 published skaters until an approved republish runs this writer.** |
| F6 | `R05-STARTSHARE-WINDOW` → `FIXED F6 …` | `goalieMatrix.ts`: when the window is not "season", the Start Share cell is the selected window's team share (`rawStartShare`). The season view keeps the matching-team projected season share. The projection stays as role context (`seasonStartShare`, `deploymentSource`). |

**Diff stat** (tracked files):

```
 web/lib/rankings/comparison.ts                     |  33 ++---
 web/lib/rankings/entityMetricRankingReader.ts      | 121 ++++++++++++++----
 web/lib/rankings/entityMetricRankingWriter.test.ts |  34 +++++-
 web/lib/rankings/entityMetricRankingWriter.ts      |  19 +++
 web/lib/rankings/goalieMatrix.ts                   |  13 ++
 web/lib/rankings/playerMatrix.ts                   | 135 ++++++++++++++-------
 web/lib/rankings/rankingQueries.ts                 |   7 +-
 web/lib/rankings/snapshot.test.ts                  |  34 +++++-
 web/lib/rankings/snapshot.ts                       | 104 +++++++++-------
 9 files changed, 360 insertions(+), 140 deletions(-)
```

The acceptance folder `web/lib/rankings/__acceptance__/` (new, untracked) is included in the patch as new-file diffs.

**Verification (post-fix):**
- `npm test -- --run lib/rankings/__acceptance__/`: 5 files, **18 passed** (`vitest-output.txt`).
  - Eight are `FIXED`: F14, F13, F1, F4 ×2, F5, F6, W1.
  - Two are `FIXED-CHECK`.
  - Eight still read `DEFECT PRESENT` for items not cleared for fixing: R01-WAR-SEASON, R01-STATIC-METADATA, R06-UNIT-TOI-CUTOFF, R05-EXPOSURE, R05-PROJECTION-AGE, PARITY-DURABLE-FALLBACK, R03-HORIZON (the interactive path, F3) and R07-PRESET-AND-API-FLOOR.
- `vitest --run lib/rankings/ __tests__/pages/rankings.test.tsx components/Rankings/`: **48 files, 512 passed**. This covers every touched file's suite, all other Rankings suites, the page test and the Rankings components.
- `__tests__/pages/api/v1/db/update-entity-metric-rankings.test.ts` and `cron-audit-wrappers.test.ts` (the writer's route consumers): **2 files, 59 passed**.
- `npx eslint` on the seven source files, both edited test files and `__acceptance__/`: passed, 0 warnings.
- `npm run typecheck -- --incremental false` (full app): **exit 0** after two fixes.
  - The earlier run caught a lost narrowing of `snapshotDate` inside `playerMatrix.ts`'s composite read.
  - It also caught a component test fixture without the new composite fields. Those fields are now optional, so `components/**` stays untouched.

### Round 2 fixes (2026-11-15: TJ decisions F11, F7, F9; Chef fix F15)

Each test was flipped first and failed on the round-1 code; only then did the source change.

| Fix | Before → after test | Change |
| --- | --- | --- |
| F11 | `R07-PRESET-AND-API-FLOOR` → `FIXED F11 R07-API-FLOOR` (plus `DEFECT PRESENT R07-FANTASY-PRESET`, kept open as a product decision) | `rankingCalculator.ts`: `buildContextualRankingRows` takes an optional `window`. When `minGp` is omitted, the floor is `defaultMinGpForWindow(window)` (10 / 5 / 3 / 2). An explicit `minGp` always wins, and `minToi` is unchanged (the definition's 300 s). Callers that pass `window`: `rankingQueries.ts` (one line), `entityMetricRankingReader.ts`, `deploymentTiers.ts`. `playerMatrix.ts`: the composite sample default uses the same floor. **Consumers checked:** `buildContextualRankingRows` has exactly three callers, all in `web/lib/rankings` (the rolling fallback, the durable reader and deployment tiers). Player Cards and other components don't import the calculator. Both writer routes pass an explicit `min_gp` (default 1), so published rows are unchanged. Every page request already sends `min_gp`. |
| F7 | `R05-PROJECTION-AGE` → `FIXED F7 R05-PROJECTION-AGE` | `goalieMatrix.ts`: `GOALIE_PROJECTION_MAX_AGE_DAYS = 7`, measured against the **team's latest scheduled game** in the window, or the goalie's own latest game if he has no team. Using the team date stops a goalie who hasn't played lately from making an old projection look fresh. A projection with no date counts as stale. A stale projection is not the role source; the role falls back to the verified window share, so a confirmed projection can't give "high". It is not used for Start Share, the row gets the `stale_start_projection` warning and a role note, and it still shows as context (`seasonStartShare`, `confirmedStatus`, `startProbability`). Exactly 7 days old is fresh; 8 is stale. |
| F9 (amended) | `R06-UNIT-TOI-CUTOFF` → `FIXED F9 R06-UNIT-TOI-CUTOFF` (in-season); new `FIXED F9 R06-UNIT-TOI-COMPLETED-SEASON`, which failed on the first F9 version | `teamMatrix.ts`: one event cutoff per response. An explicit `as_of_date` caps the unit-TOI publication. Without one, the cap is the power snapshot date only while the season is in progress (`latestPowerDate` before the season's `regularSeasonEndDate`, which is already loaded). A completed season uses its latest publication, because a later publication of a finished season has the same event cutoff. Rows stay bounded by `game_date <= latestPowerDate` in every case. **The first version's trade-off is resolved.** Chef's prod-data check found 2025-26 unit usage empty (power ends 04-17, publication in June). It is now present, and the new test covers that shape (including a post-power-date row that stays excluded). The in-season leak is still blocked. The `teamMatrix.test.ts` case is renamed "caps an in-season unit generation…"; its fixture is in season. |

| F15 | New `FIXED F15 UNIT-TOI-READ`. Part 1, the aggregator identity, already held before the fix. Part 2 (the read carries the filter) and part 3 (page count) failed before the fix. | `teamMatrix.ts` `fetchTeamUnitToiRows`: adds `.or("unit_type.eq.power_play,unit_number.eq.1")`, so the paged read returns only the rows `aggregateTeamUnitToiRows` consumes: unit 1 of each 5v5 type and every power-play unit (pool seconds, top-2 seconds and coverage statuses use all PP units). No index, schema or per-team rewrite. |

**F15 safety argument and its one edge.** The aggregator counts a team-game if it has any unit row (`gamesCount`, coverage "partial" when a game lacks a value). So rows it otherwise ignores can change the output only when a team-game has no unit-1 ES row and no PP row. On writer data that can't happen:
- `team_unit_toi` has only `forward_line`, `defense_pair` and `power_play` types, so no PK rows exist (`teamUnitToiBuilder.ts:1-4`).
- `emitRankedRows` numbers each team-game's non-empty units from 1 by TOI (`teamUnitToiBuilder.ts:280-293`), so any ES type present always has unit 1.
- Every PP unit passes the filter.

The test proves identity on a writer-shaped fixture with non-top lines and pairs, three PP units (one partial) and a hypothetical `penalty_kill` row in the same games. A hand-inserted orphan row (for example only `forward_line` unit 3 for a team-game) would still be dropped and lower that team's game count; nothing in the writer produces one. Page count on the large fixture: 6,600 rows (7 reads) become 3,000 consumed rows (3 full pages plus 1 empty terminating read). The live 2025-26 timeout itself is not re-measured here.

Existing tests updated to the new contracts (the tests beside the touched files):
- `playerMatrix.test.ts`: the composite sample-minimum table, for the omitted-`min_gp` floor.
- `rankingQueries.test.ts`: the MCM serving test now sends an explicit `min_gp: "1"`, so it still checks the MCM TOI minimum.
- `teamMatrix.test.ts`: the unit-generation policy (F9), and its fixture query builder now supports the flat `or` filter (F15). The `or` branch is evaluated before the null-key guard.

**Round 2 verification:**
- Acceptance tests: **20 passed in 5 files**.
  - 12 are `FIXED`: F14, F13, F1, F4 ×2, F5, F6, W1, F11, F7, F9, F15.
  - 2 are `FIXED-CHECK`.
  - 6 still read `DEFECT PRESENT`: R01-WAR-SEASON, R01-STATIC-METADATA, PARITY-DURABLE-FALLBACK, R03-HORIZON (interactive path), R07-FANTASY-PRESET and R05-EXPOSURE.
- 575 tests in 50 files across `lib/rankings/`, the page test, `components/Rankings/` and both writer route test files: all passed.
- ESLint on all 10 source files and 5 edited test files plus `__acceptance__/`: 0 warnings.
- Full typecheck (`npm run typecheck -- --incremental false`): **exit 0** after F11/F7/F9, and again after F15.
- Diff: 15 tracked files, +477/−161 (`FIXES.patch` regenerated).

**Still open, by Chef's routing:**
- To TJ: F8 (per-metric exposure), the Fantasy preset's 1 GP floor, and the **W1 production republish**. The W1 code is fixed locally; Chef's dry build gives 769 skaters, but publishing them needs an approved writer run. F7, F9 and F11 are done (round 2).
- Team unit-TOI read: only the F15 row filter is done. Not started, per Chef: an index, a schema change or the per-team rewrite.
- Stay open: F2 (durable vs fallback per column), F3 (interactive horizon), F10 (static metadata, WAR season) and F12 (page error surfacing).
- Note: `rankingUrlState.ts` still omits `sample_confidence` from the snapshot URL. After F1 that no longer changes ranks: the snapshot can still show a player the matrix hides, which is the intended snapshot behaviour.

Not verified: browser/page rendering of the new warnings and of the composite scope fields, and any production run. Nothing is committed, published or deployed.

## Release file set (commit candidate; nothing committed)

There are 22 files: 15 modified and 7 new. `FIXES.patch` is exactly this set: `git diff` of the modified files plus `git diff --no-index` for the new ones. The diff of the modified files is +491/−162.

**Modified source (10):**
- `web/lib/rankings/comparison.ts`
- `web/lib/rankings/deploymentTiers.ts`
- `web/lib/rankings/entityMetricRankingReader.ts`
- `web/lib/rankings/entityMetricRankingWriter.ts`
- `web/lib/rankings/goalieMatrix.ts`
- `web/lib/rankings/playerMatrix.ts`
- `web/lib/rankings/rankingCalculator.ts`
- `web/lib/rankings/rankingQueries.ts`
- `web/lib/rankings/snapshot.ts`
- `web/lib/rankings/teamMatrix.ts`

**Modified tests (5):**
- `web/lib/rankings/entityMetricRankingWriter.test.ts`
- `web/lib/rankings/playerMatrix.test.ts`
- `web/lib/rankings/rankingQueries.test.ts`
- `web/lib/rankings/snapshot.test.ts`
- `web/lib/rankings/teamMatrix.test.ts`

**New regression tests and harness (7):** these hold only FIXED and FIXED-CHECK tests (15 in all).
- `web/lib/rankings/__acceptance__/fakeSupabase.ts` (harness)
- `web/lib/rankings/__acceptance__/goalieFixture.ts` (harness)
- `web/lib/rankings/__acceptance__/chef-live-findings.acceptance.test.ts`: W1, F13, F14
- `web/lib/rankings/__acceptance__/r01-season-metadata.acceptance.test.ts`: FIXED-CHECK R01-DEFAULT
- `web/lib/rankings/__acceptance__/r04-r06-team.acceptance.test.ts`: F4 ×2, F9 ×2 (in-season and completed season), F15, FIXED-CHECK R06-POWER-SEASON
- `web/lib/rankings/__acceptance__/r05-goalie-samples.acceptance.test.ts`: F5, F6, F7
- `web/lib/rankings/__acceptance__/skater-parity.acceptance.test.ts`: F1, F11

**Placement.** The regression tests stay in `__acceptance__/` rather than moving into each file's own suite. Each of those suites already mocks `lib/supabase/server` (or the matrix modules) with its own incompatible harness. These tests depend on one shared fail-closed fake and the goalie fixture, so merging them would mean rewriting either the tests or the suites.

**Not in the release:** working notes and evidence stay in `tasks/`.
- This report, `vitest-output.txt` and `FIXES.patch`.
- The `repros/` folder.
- The diary `tasks/diaries/2026-11-14-claude-rankings-correctness.md`.
- The claim entries in `CLAUDE-TO-CODEX.md`.

## Open-defect reproductions (`repros/`)

The six tests that still assert `DEFECT PRESENT` moved out of `web/`, so they can't fail a release run the day their defect is fixed. Each moved with only the harness pieces it needs: copies of `fakeSupabase.ts` and `goalieFixture.ts`, imported by absolute `web/lib` paths, and the Supabase mock bound to the absolute module path (as in the perf bench).

| File | Test | Open item |
| --- | --- | --- |
| `repros/r01.repro.test.ts` | R01-WAR-SEASON, R01-STATIC-METADATA | F10 |
| `repros/skater.repro.test.ts` | PARITY-DURABLE-FALLBACK | F2 |
| `repros/skater.repro.test.ts` | R03-HORIZON (interactive path) | F3 |
| `repros/skater.repro.test.ts` | R07-FANTASY-PRESET | TJ product decision |
| `repros/goalie.repro.test.ts` | R05-EXPOSURE | F8 |

Run from `web/`: `npx vitest run --config ../tasks/artifacts/rankings-acceptance-2026-11-14/offline-correctness/repros/vitest.repros.config.mjs`. Result: 3 files, **6 passed**, so all six defects are still present. Output: `repros/vitest-repros-output.txt`. When one of these is fixed, flip its test into a regression test under `web/lib/rankings/__acceptance__/`.

**Final verification (after the move):**
- `vitest --run lib/rankings/__acceptance__/`: 5 files, **15 passed**, after the F9 amendment.
- `vitest --run lib/rankings/ __tests__/pages/rankings.test.tsx components/Rankings/` plus both writer route test files: 50 files, **570 passed**. That is the earlier 575, minus the 6 moved tests, plus the F9 completed-season test.
- Repros config: 3 files, 6 passed (unchanged).
- `npx eslint` on the 10 source files, all `lib/rankings/*.test.ts` and `__acceptance__/`: 0 problems. The `repros/` files are outside the web ESLint and typecheck scope (ESLint reports "outside of base path"), like the perf bench.
- Full typecheck (`npm run typecheck -- --incremental false`): **exit 0** after the move, and again after the F9 amendment.

## Status table

| Item | Status | Evidence at HEAD | Reproduction |
| --- | --- | --- | --- |
| **R01** default / active season | **Fixed (calendar season); partial (publication state)** | `rankingUrlState.ts:117` default `season: ""`; `resolveRankingsSeason` (`:358-366`) keeps an explicit 8-digit season, else uses `/api/v1/season`, which returns the latest *started* season (`lib/NHL/server/index.ts:249-267`; offseason = last started) or 503, never a guess. Every season-taking Rankings parser requires `season` (matrix, goalie, team, contextual; trending/splits/deployment-tiers delegate to `parseContextualRankingsRequest`). Still missing: a distinct "no current-season publication" state; an empty current season renders as empty/fallback, not as a labelled publication gap. | `FIXED-CHECK R01-DEFAULT`; resolver covered by existing `rankingUrlState.test.ts` |
| R01 WAR fallback season | **Open (low)** | `war.ts:60` falls back to `20252026`. WAR rows are always empty (source-pending), so only the echoed request is wrong. | `R01-WAR-SEASON` |
| R01 static June metadata | **Open** | `entityCoverageContracts.ts:34,177,338` (June 9 verification, row counts, "current through 2026-06-09"), shipped by `rankingMetadata.ts:212`. The metadata WAR stub is `season: 20252026` (`rankingMetadata.ts:206`). The contract has no generation, as-of or historical field. | `R01-STATIC-METADATA` |
| **R03** fallback horizon (30 dates / 200 games) | **Open, live in production** | `rankingQueries.ts:63,264,274`. Only the composite writer is exempt (`:699-716`, `completeSeasonRows` from `skaterCompositeWriter.ts:679`). The **entity ranking writer** (`entityMetricRankingWriter.ts:232`) and every interactive fallback still use the horizon. Chef's SQL: 740 published vs 764 WGO skaters. | `R03-HORIZON`, `WRITER-POPULATION` |
| R03 global snapshot date | **Partial** | Each row now carries `sourceSnapshot` (`rankingQueries.ts:55,573`), and the test shows it differs from `meta.snapshotDate`. Matrix and snapshot rows don't surface it; the matrix shows per-metric `snapshotDate`. | covered inside `R03-HORIZON` |
| R03 role-label semantics | **Open (by design so far, not tested)** | `rankingQueries.ts:525-545`: deployment filter and peer group come from the latest rolling row's `line_combo_*` / `pp_unit`, while values cover the whole window. No historical "performance while in role" reader exists. This is a contract decision, so there is no reproduction. | — |
| **R04** skater team-token parity | **Fixed** | Matrix, snapshot and comparison all use `parsePlayerMatrixRequestWithResolvedTeam` (`snapshot.ts:316`, `comparison.ts:341`). The table uses `parseContextualRankingsRequestWithResolvedTeam`. `team=EDM`, `22` and `Edmonton Oilers` all resolve. | control inside `R04-TEAM-SNAPSHOT-TOKEN` |
| R04 team snapshot / comparison token | **Open** | `snapshot.ts:281` and `comparison.ts:109,302` match abbreviations only, so an id or full name returns "unavailable". The page always sends abbreviations (`rankingUrlState.ts:794`, `rankings.tsx:1215`), so this hits API/deep-link callers only. | `R04-TEAM-SNAPSHOT-TOKEN`, `R04-TEAM-COMPARISON-TOKEN` |
| R04 goalie invalid token | **Open** | `goalieMatrix.ts:1494-1501`: an unknown token resolves to `[]`, giving 200 with zero rows and a snapshot "unavailable". Skaters return a query error for the same token. | `R04-GOALIE-INVALID-TOKEN` |
| R04 selected subject off-page | **Fixed** | Snapshot and comparison scan matrix pages (`snapshot.ts:166-180`). The matrix substitutes `rows[0]` when the selected id is off-page (`playerMatrix.ts:1425-1429`), but the page uses that only when nothing is selected; an explicit selection always wins (`rankings.tsx:1467-1470`). Comparison ids are capped at 6 client-side (`rankings.tsx:1166`), so no over-limit 400. | existing `snapshot.test.ts` / `comparison.test.ts` |
| R04 swallowed errors | **Partial (source only)** | The primary views and comparison now surface errors (11-12 usability lane). The snapshot hook drops `error` and `isLoading` (`rankings.tsx:1416`), and so does the comparison-opportunity hook (`:1523`). A failed or "unavailable" snapshot silently falls back to the page row. Not reproduced: it needs the page harness in `__tests__/pages/rankings.test.tsx`. | — |
| **R05** matched numerator/denominator | **Fixed** | xGA/shot, GSAx, HD and relative SV% each require complete per-row sources, or the metric is null for the window (`goalieMatrix.ts:960-1025`, e.g. `:985`). | existing `goalieMatrix.test.ts` |
| R05 traded stints / start share | **Fixed** | Team workload pools each team's own calendar window (`goalieMatrix.ts:1288-1325`, comment `:1314`); there is no top-two exclusion. | existing `goalieMatrix.test.ts` |
| R05 QS missing-as-zero | **Fixed** | QS uses the Vollman classifier on official counts (`goalieMatrix.ts:1047`). Null makes the metric unavailable; the WGO `quality_start` field is not read. | existing tests |
| R05 projection staleness | **Open** | `goalieMatrix.ts:1535-1575` takes the latest projection per player in `[season-07-01, as_of]` with no age bound. `:1354-1360`: a confirmed projection gets "high" role confidence regardless of age. | `R05-PROJECTION-AGE` |
| R05 start share vs window | **Open** | `goalieMatrix.ts:767`: the Start Share cell prefers `projection.season_start_pct` in every window, so Last 5 shows a season share. | `R05-STARTSHARE-WINDOW` |
| R05 per-metric exposure | **Open** | Ranking eligibility is only `starts ≥ min && shots ≥ min` (`goalieMatrix.ts:1683-1684`) for every metric. In the test, HD SV% ranks #1 (100th percentile) on one high-danger shot. | `R05-EXPOSURE` |
| **R06** power season bounds | **Fixed** | `teamMatrix.ts:1132-1179`: regular-season bounds, then the latest power date inside them. | `FIXED-CHECK R06-POWER-SEASON` |
| R06 5v5 vs all-strength | **Fixed in reader** | `teamMatrix.ts:1231-1251` reads only `nst_team_5v5`, with no all-strength fallback. The comment says legacy rows may carry `situation="all"`; whether such rows exist is a DB question for Chef's packet. | existing `teamMatrix.test.ts` |
| R06 unit-TOI as-of | **Partial** | `teamMatrix.ts:1312-1324` caps the publication only by an explicit `as_of_date`, which the page never sends. A rebuild newer than the power snapshot is used. Rows are still bounded by `game_date ≤ power date`. This is a policy question: should "as of" mean information available then? | `R06-UNIT-TOI-CUTOFF` |
| **R07** sample minimums | **Partial** (preset floor is a product decision; API default is a defect) | The page defaults are now 10 GP for the season window (`rankingUrlState.ts` `DEFAULT_MIN_GP_BY_WINDOW`), 5 starts / 100 shots for goalies, and 5 GP for teams. Two gaps remain: the Fantasy preset sets 1 GP (`rankingUrlState.ts:166`), and an API call without `min_gp` falls back to the metric definition's 1 GP / 300 s (`rankingCalculator.ts:274`, `metricDefinitions.ts:212`). High/medium labels are still multiples of the chosen floor (`rankingCalculator.ts:213-234`), not calibrated confidence. | `R07-PRESET-AND-API-FLOOR` |
| R07 ties / percentile | **Fixed, shared** | Skaters, goalies and teams all use `rankNormalizedMetricValues` (`rankingCalculator.ts:84-147`): dense rank and mid-rank percentile. | existing `rankingCalculator*.test.ts` |
| R07 search / pagination invariance | **Fixed** except composites | Search and paging apply after ranking: matrix `playerMatrix.ts:1144`, goalies `goalieMatrix.ts:1857`. The durable reader re-ranks the full snapshot before the `entityIds` filter (`entityMetricRankingReader.ts:428`). **Exception:** composite cohort ranks are computed after the `sample_confidence` filter (`playerMatrix.ts:1090,1123`). | `PARITY-COMPOSITE-CONFIDENCE` |

## Cross-view contract: where table, matrix, snapshot and comparison can diverge

- **Main Rankings table = the matrix.** On the Rankings tab the table *is* the matrix payload (`/matrix`, `/goalies`, `/teams`; `rankings.tsx:1313-1324`). The only client step between payload and display is `applyMatrixDisplayFilters` (`rankings.tsx:190-220`), which hides columns/groups and never touches ranks, values or row order. So table-vs-matrix parity holds by construction.
- **Metric Explorer:** `/contextual-rankings`, `buildSnapshotFirstContextualRankingsSurface`, fetched only on the Metric Explorer tab (`rankings.tsx:1325-1328`). It is the one-metric "table" of the 11-08 audit.
- **Snapshot and comparison:** both re-run the matrix builder with the page's query and scan its pages. They inherit the matrix's rank, percentile, tie handling and value only when they receive the same parameters and the matrix picks the same source.

| # | Divergence | Views | Proven by | Severity |
| --- | --- | --- | --- | --- |
| D1 | `buildSnapshotRequestPath` (`rankingUrlState.ts:757-805`) omits `sample_confidence`; the matrix (`:636`) and comparison (`rankings.tsx:1256-1257`) send it. Composite cohort ranks depend on that filter (`playerMatrix.ts:1090` then `:1123`). With Sample confidence = High, the matrix shows MCM #1 / 100th and the snapshot drawer shows #2 (tested). Comparison should match the matrix because it sends the filter (inferred from source, not tested). | matrix vs snapshot (composites) | `PARITY-COMPOSITE-CONFIDENCE` | High: same player, two ranks on one screen |
| D2 | The matrix chooses durable vs fallback once, from the sort metric's surface (`playerMatrix.ts:1049-1083`), then reads every column from that source (`:1171`). Metric Explorer chooses per metric (`rankingQueries.ts:1083`). A metric without durable rows is ranked in Metric Explorer and blank ("unavailable") in the matrix, snapshot and comparison. | Metric Explorer vs matrix / snapshot / comparison (cross-tab) | `PARITY-DURABLE-FALLBACK` | Medium; live only if 2026-27 durable coverage is partial (DB question) |
| D3 | Each durable metric reads its own latest `snapshot_date` (`entityMetricRankingReader.ts:184-226`), so matrix columns can come from different dates. This is the 11-08 R02 finding and is outside this lane's scope. | matrix columns | not reproduced (R02) | Medium |
| D4 | The team snapshot and comparison accept abbreviations only, while every other parser accepts id, abbreviation or name. | team snapshot / comparison vs the rest | `R04-TEAM-*` | Low for the page, medium for the API |
| D5 | An invalid goalie team token returns an empty 200; skaters get a 400. | goalie vs skater | `R04-GOALIE-INVALID-TOKEN` | Medium |
| D6 | Astra AFULL-RANK12-01: when a player is missing from the overall scope, the overall cell inherits the current-cohort rank (`playerMatrix.ts:1346-1348`, `?? metricRow`). | matrix / snapshot rank scopes | confirmed in source; Astra owns it | as Astra rated (P1) |

Also checked: AFULL-RANK12-03 is consistent with `TeamMatrixTable.tsx:225-233`, where a `metric_value` display mode falls through to percentile. AFULL-RANK12-02 was not independently traced. Astra owns all three.

## Reproduction files and output

Run from `web/`: `npm test -- --run lib/rankings/__acceptance__/`. Result: **5 files, 18 passed** (16 DEFECT PRESENT, 2 FIXED-CHECK). The full verbose output is in `vitest-output.txt` next to this report.

Other checks:
- Existing Rankings suites cited as evidence for "Fixed" rows, run together with the then-4-file acceptance folder: `goalieMatrix`, `teamMatrix`, `rankingCalculator`, `rankingCalculator.lowerIsBetter`, `snapshot`, `comparison`, `rankingQueries`, `entityMetricRankingReader`, `playerMatrix`, `rankingUrlState` → **14 files, 225 tests passed**.
- `npx eslint lib/rankings/__acceptance__/` → passed, no warnings.
- `npm run typecheck -- --incremental false` → passed (see Limits).

| File | Tests |
| --- | --- |
| `web/lib/rankings/__acceptance__/r01-season-metadata.acceptance.test.ts` | FIXED-CHECK R01-DEFAULT; DEFECT PRESENT R01-WAR-SEASON, R01-STATIC-METADATA |
| `web/lib/rankings/__acceptance__/r04-r06-team.acceptance.test.ts` | DEFECT PRESENT R04-TEAM-SNAPSHOT-TOKEN, R04-TEAM-COMPARISON-TOKEN, R06-UNIT-TOI-CUTOFF; FIXED-CHECK R06-POWER-SEASON |
| `web/lib/rankings/__acceptance__/r05-goalie-samples.acceptance.test.ts` | DEFECT PRESENT R05-EXPOSURE, R05-STARTSHARE-WINDOW, R05-PROJECTION-AGE, R04-GOALIE-INVALID-TOKEN |
| `web/lib/rankings/__acceptance__/skater-parity.acceptance.test.ts` | DEFECT PRESENT PARITY-COMPOSITE-CONFIDENCE, PARITY-DURABLE-FALLBACK, R03-HORIZON, R07-PRESET-AND-API-FLOOR |
| `web/lib/rankings/__acceptance__/chef-live-findings.acceptance.test.ts` | DEFECT PRESENT WRITER-POPULATION, TEAM-FILTER-SOURCE, SNAPSHOT-UNPUBLISHED-SCAN |
| `fakeSupabase.ts`, `goalieFixture.ts` | Harness (not tests) |

How the harness keeps the reproductions honest:

- Only `lib/supabase/server` is replaced, by an in-memory fake that fails closed: an undeclared table throws.
- Every request is built by the real page URL builder and parsed by the real parser. The real readers, matrix, snapshot and comparison code run.
- Each "DEFECT PRESENT" test includes a paired control: the same fixture with the trigger removed gives the correct or agreeing result.
- `fetch` is stubbed to throw, and every test asserts zero calls. Time is pinned with fake `Date`, and caches are cleared in `beforeEach`.
- The Vitest setup points Supabase at `unit-tests.supabase.invalid`, and the shell had no `SUPABASE_*` variables. `GIT_DIR` was explicitly unset for each run.

## Chef's live findings (2026-11-14 receipts), reproduced offline

### L1. Entity ranking writer omits skaters whose last game is older than the 30-date horizon (R03, live)

- **Reproduced:** `WRITER-POPULATION`. 40 game dates; player 5 last played 35 dates ago. `buildEntityMetricRankingRows` (the cron writer) publishes players 1-4 only. The composite writer's source path (`loadSkaterCompositeSeasonSources` + `buildContextualRankingsSurfaces(..., { completeSeasonRows })`, `skaterCompositeWriter.ts:674-680`) ranks all 5. Paired control: with player 5 ten dates back, the entity writer publishes 5.
- **Cause, confirmed:** `buildContextualRankingSnapshotRowsByMetric` (`rankingQueries.ts:965-969`) has no `completeSeasonRows` parameter, so it always resolves dates through `resolveRollingSnapshotDates` (`:240-277`). The comment at `:699-700` already says that search "is not a population bound".
- **Smallest writer fix (W1), two files:**
  1. `rankingQueries.ts:965-969`: add `options?: { completeSeasonRows?: RollingPlayerGameMetricRow[] }` and pass it to `resolveRankedSnapshotsForMetrics(request, metricKeys, options?.completeSeasonRows)`. That is a 2-line change mirroring `buildContextualRankingsSurfaces` (`:919-925`). **Yes, `rankingQueries.ts` changes**, but only this signature; the interactive path is untouched.
  2. `entityMetricRankingWriter.ts:220-238`: once per build request (one strength), call `loadSkaterCompositeSeasonSources(supabase, { season, strength, cutoffDate: asOfDate ?? today })`, refuse to publish when `report.verified` is false (same gate as the composite writer), and pass `{ completeSeasonRows: rows }` for each window.
  - The loader already attaches L6 window-count support, so last-5/10/20 windows work from the same rows.
  - Side effect: `snapshot_date` becomes the cohort's latest row date, as for composites.
  - Owner: this is the BEAST/composite publication lane's writer file. It needs no schema change and no shared rolling/NST writer change. **It takes effect only after a republish, which is a production write needing TJ approval.**

### L2. Team filter switches source, snapshot date, peer pool and composites

- **Contract:** the PRD declares "team skaters" as a peer group, and the team filter is meant to re-rank within it (`tasks/TASKS/contextual-hockey-rankings/tasks-prd-contextual-hockey-rankings.md` tasks 6.5 and 11.6; `derivePeerGroupType`, `playerMatrix.ts` / `rankingTypes.ts:293-310`). So the **pool change is intended**. What is not stated anywhere in the UI is that it happens (R07's "filter alters pool vs display subset" gap). `PlayerMatrixTable.tsx:102` only shows "Peer group 22".
- **What is a defect:** the publication covers only the all-skater cohort. Both writers default `team=null` (`update-entity-metric-rankings.ts:195`, `update-skater-composite-ratings.ts:126`).
  - The durable reader looks only for an exact `peer_group_type='team', peer_group_key='22'` snapshot (`entityMetricRankingReader.ts:204-213`, `:236-246`). It never finds one, so every team view falls back to rolling (slower, a different snapshot date, R03 horizon).
  - The composite read asks for `peer_group_key='22'` only (`playerMatrix.ts:796-805`), so league-scope composites that do exist come back null. The cell says "Composite rating row is not published for this player/context." That is explicit, but valid league-scope data is dropped.
- **Reproduced:** `TEAM-FILTER-SOURCE`. With team=EDM: fallback with the exact reason text, peer `team/22`, rows 1-3 only, MCM null with that reason, and a `skater_composite_ratings` read filtered to key 22. The paired league view uses the durable source with peer `all_skaters/all` and MCM 98.
- **Smallest reader fix (F13), reader-only, no writer, schema or republish:**
  1. `entityMetricRankingReader.ts:184-258`: when no rows exist for the exact team / position / deployment key, read the published `all_skaters/all` snapshot and filter rows by `team_id` (or `position_group` / `deployment_bucket`). The existing re-rank at `:428-445` (`buildContextualRankingRows` with the request's `peerGroupType`) then recomputes ranks inside the declared pool from durable values at the durable date. Label the surface "derived from the all-skater publication".
  2. `playerMatrix.ts:753-815`: same fallback for composites, reading `all_skaters` rows. `compositeCohortRanks` (`:1123`) already re-ranks composite values within the displayed cohort; label the value as league-scope.
  - Caveat: `team_id` on a durable row is the player's team at publication, which matches the rolling fallback's current-team semantics.
  - Decision for Chef/TJ: confirm "team = team peer pool", and add one line of UI copy saying so.

### L3. Snapshot for an unpublished skater scans every page

- **Bound, from code:** `snapshot.ts:166-180` calls `buildPlayerMatrixSurface` for pages 1..`pageCount` (at most 100) at 50 rows each. It stops only when the row is found.
  - Each page is a fresh build, because the cache key includes `page` (`playerMatrix.ts:1000-1003`). Each build:
    - re-reads the full durable cohort for the sort metric, then for every default column three times (current, overall and deployment scopes; `:1171-1213`), filtering to the page's ids only after ranking;
    - fetches composites;
    - issues one all-strength TOI query per page player (`:686-752`).
  - There is no rolling fallback in this case: the sort surface is non-empty. A missing player therefore costs `ceil(cohort/50)` full matrix builds: 15 for 740 skaters. That fits the 30 s seen locally.
  - The response is the generic "Selected skater is unavailable for the requested filter context.", with no "not published" distinction.
- **Reproduced:** `SNAPSHOT-UNPUBLISHED-SCAN`. With 120 published skaters, a missing id costs 169 query builders and 120 per-player TOI reads (3 pages). A page-1 player costs 89 builders and 50 TOI reads.
- **Smallest fix (F14), two files:**
  1. `playerMatrix.ts:1143-1153`: when `selectedPlayerId` is set and a new `pageForSelected` flag is on, set `page = floor(index / pageSize) + 1` from the already-ranked `sortedRows`. If the id is absent, return immediately with `meta.selectedPlayerAbsent = true` (no per-page enrichment).
  2. `snapshot.ts:166-180, 311-354`: one call with that flag. Return `reason: "Selected skater is not in the published cohort for this context"` when absent. Goalie and team snapshots can use the same pattern; those surfaces already rank in memory.
  - No writer, schema or republish needed.

## Candidate fixes from the live findings (added)

| Fix | Files | Change | Needs another owner? |
| --- | --- | --- | --- |
| W1 (L1) | `rankingQueries.ts:965-969`, `entityMetricRankingWriter.ts:220-238` | Pass the WGO-anchored complete population into the entity writer, as the composite writer does | **Writer lane** (BEAST/composite publication); production republish needs **TJ approval**; no schema |
| F13 (L2) | `entityMetricRankingReader.ts:184-258`, `playerMatrix.ts:753-815` | Derive team/position/deployment pools from the published all-skater cohort when no exact-scope rows exist | No; contract wording decision for Chef/TJ |
| F14 (L3) | `playerMatrix.ts:1143-1153`, `snapshot.ts:166-180,311-354` | Page-for-selected in one build, explicit "not in published cohort" | No |

## Candidate fixes (no source changed; for Chef to clear)

| Fix | Files | Smallest change | Needs another owner? |
| --- | --- | --- | --- |
| F1 (D1) | `web/lib/rankings/rankingUrlState.ts` (`buildSnapshotRequestPath`) **or** `playerMatrix.ts` | Preferred: rank composites over the cohort before the `sample_confidence` filter, i.e. move `sampleConfidenceMatches` after `compositeCohortRanks` (`playerMatrix.ts:1088-1138`). That keeps ranks invariant to a display filter, like search. Alternative: send `sample_confidence` from the snapshot builder. Test: flip `PARITY-COMPOSITE-CONFIDENCE` to assert equal snapshot and matrix ranks. | No. `rankingUrlState.ts` was the superstyle lane's file on 11-09; confirm it is free. |
| F2 (D2) | `web/lib/rankings/playerMatrix.ts` | Choose the source per column: when a durable column surface is unavailable, fill that column from `buildContextualRankingsSurfaces`, and label the cell's source. Alternatively, mark the column "durable missing" rather than "unavailable". | No. The real fix is complete durable publication (R02, BEAST/composite writer owner); F2 is the reader guard. |
| F3 (R03) | `web/lib/rankings/rankingQueries.ts` | Short term: label fallback responses as "recent-appearance population (last 30 game dates)" so omission is not silent. A real fix needs a durable per-player latest-row relation or a bounded SQL "latest row per player ≤ cutoff". | Real fix needs **schema plus a shared rolling writer or view** (rolling/NST owner) and a backfill. |
| F4 (R04 team) | `web/lib/rankings/snapshot.ts`, `comparison.ts` | Resolve each team token with `resolveTeamTokenFromRows` (one `teams` read), then match on the resolved abbreviation or id. | No |
| F5 (R04 goalie) | `web/lib/rankings/goalieMatrix.ts` (parse/build) | When a non-empty token resolves to no team, throw `unresolvedTeamError`, as the skater parser does. | No. The goalie files were a Codex lane on 11-09; confirm that claim is released. |
| F6 (R05 start share) | `goalieMatrix.ts:767` | For `window !== "season"`, use the window share (`rawStartShare`). Keep the projection share as role context only. | No (same goalie-lane check) |
| F7 (R05 projection age) | `goalieMatrix.ts:1354-1380`, `1535-1575` | Add `maxProjectionAgeDays` (for example 7) relative to the window's latest game. Past it, drop the projection to role context with a `stale_start_projection` warning and lower confidence. | No; the threshold is a product decision |
| F8 (R05 exposure) | `goalieMatrix.ts` rank input (`:1678-1690`), `matrixMetricRegistry`/methodology | Per-metric exposure floors (for example HD shots for HD SV%, NST shots for xGA/shot), with a warning when below. | No code owner conflict; the floors need a methodology decision (rule 13 / decision 98) |
| F9 (R06 unit TOI) | `teamMatrix.ts:1312-1324` | Cap the unit-TOI `snapshot_date` at `latestPowerDate` when `as_of_date` is absent. | No; policy confirmation from Chef/TJ |
| F10 (R01) | `war.ts:60`, `rankingMetadata.ts:206`, `entityCoverageContracts.ts` | Make WAR `season` required (400 if missing). Label the coverage contracts `historicalVerification` with their date, or move live counts to a small manifest. | Live counts need a manifest writer, i.e. a **data owner** |
| F11 (R07) | `rankingCalculator.ts:274` (API default); `rankingUrlState.ts:166` (preset) | Make the API default match the page's (`defaultMinGpForWindow`). The Fantasy preset's 1 GP floor is disclosed in its UI copy (`RankingsFilters.tsx:859`), so changing it is a **product decision for TJ**, not a bug fix. | No (shared calculator; Player Cards consumers should be checked) |
| F12 (R04 errors) | `web/pages/rankings.tsx:1416,1523` | Surface the snapshot and opportunity `error`, and show "unavailable" instead of silently using the page row. | Page file: the usability lane's 11-12 candidate is uncommitted there; serialize after it |

## Questions for Chef's DB packet (not decidable offline)

1. For 2026-27, which matrix default columns have `entity_metric_rankings` rows, and at which `snapshot_date`? This decides whether D2/D3 are live today and whether the R03 fallback is reachable.
2. Do `nst_team_5v5` rows with `situation='all'` exist in the 2026-27 window?
3. Which `team_unit_toi` `snapshot_date`s exist for 2026-27 relative to the latest `team_power_ratings_daily.date`? (R06 partial.)
4. What is the distribution of the latest `goalie_start_projections.game_date` age per active goalie? (R05 projection age.)

## Limits

- Offline fixtures only. Nothing here proves production data shape, coverage or latency.
- Not run: the page or browser harness, and any production/DB check.
- Full `npm run typecheck -- --incremental false` (8 GB heap): the first run found 2 TS2339 errors in these tests (`reason` on the snapshot union). After fixing them, a second run over all five files **passed (exit 0)**.
- R03 role semantics and R04 swallowed errors are cited from source, not reproduced.
