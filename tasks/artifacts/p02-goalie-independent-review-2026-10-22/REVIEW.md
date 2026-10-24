# P02 goalie correctness — independent review

**The nine-file corrections pass their bounded local verification. One inherited production-consumer gap remains reproducible, so this is qualified acceptance of those corrections, not closure of end-to-end P02 completeness.** No new regression was identified in the leased delta. The remaining gap needs coordinated ownership of two files outside that lease. This audit pass is complete; no application fix was made here.

## P02-R1 — Unknown participation is discarded before headline/Trends ratio validation

**Priority:** P2, medium correctness. **Confidence:** high. **Impact:** an incomplete selected goalie window displays a numeric SV% in two production summaries while the corrected contextual view correctly reports unavailable. The numeric value is an undisclosed subset, not a complete-window rate.

**Exact evidence:**

- `web/components/PlayerStats/PlayerSummaryStrip.tsx:65` filters `gameLog` through `isAppearance` before calling `aggregateSummaryStat` at line 71.
- `web/components/PlayerStats/PlayerStatsSummary.tsx:24` similarly filters `Number(game.games_played) > 0` before aggregation at line 30.
- `playerStatsContract.ts:95` makes null participation fail the appearance predicate. Once the row is discarded, the stricter paired-count aggregation cannot detect its missing support.
- `PlayerContextualStats.tsx:127–132` correctly checks the unfiltered log for known participation before filtering, so it returns null for the same inputs.
- The actual page passes the same `filteredGameLog` into the Overview headline at `web/pages/stats/player/[playerId].tsx:266`, contextual view at line 288 and Trends summary at line 367. Its season query returns raw rows at lines 730–746 and selects nullable `games_played` at line 770; the fallback does the same at line 778. The table's generated contract at `web/lib/supabase/database-generated.types.ts:32413` permits null `games_played`. These are reachable input types, not invented nonnumeric primitives.

**Minimal imported-component reproduction:** supply a first row with `games_played:1, saves:27, shots_against:30`, plus a second selected-window row with `games_played:null, saves:null, shots_against:10`. Other columns follow the actual goalie profile query, with no QS or time exposure. Render the actual components with the existing service hook mocked:

| Consumer | Observed | Expected complete-window behavior |
| --- | --- | --- |
| Contextual Save Percentage | `-` | `-` |
| Overview SV% | `0.900` | `-` |
| Trends SV% | `0.900`, described as one game played | `-` |

`p02-independent.test.tsx:30–39` contains the two failing controls. `independent-tests.log` / `.json` retain **2 failures, 6 passes**. The first failure is `expected '0.900' to be '-'`; the second renders the same `0.900` in the Trends summary. No server or service call is involved in the reproduction.

**Attribution:** this is inherited filtering, not a newly introduced arithmetic defect. Both consumer files are byte-identical to commit `d3f057c6c849d5d5474bc912a6f461f617c65b15`; neither belongs to the nine-file lease. Their baseline/current hash equality is recorded in `end-integrity.json`. The packet fixes the contextual consumer but leaves the shared-contract admission boundary incomplete in these two other callers. No individual/model authorship is inferred for the inherited code.

**Surgical fix scope:** coordinate a lease extension for `PlayerSummaryStrip.tsx` and `PlayerStatsSummary.tsx` plus their nearest tests. For goalie ratios, validate participation on the full selected log before filtering out known nonappearances, matching the contextual contract. Preserve unknown rows as a completeness failure; do not reinterpret them as DNP or guess participation from unrelated fields. Preserve existing skater behavior and known `games_played:0` handling. A small shared admission helper is reasonable if needed to prevent the three consumers diverging; no page-query, forecast or VuDu change is required for this bug.

**Acceptance gate:** these two tests must pass against the corrected callers, while complete support still gives `.925`, true zero stays `0.000`, known nonappearances remain excluded, and existing 96 owner tests pass. Pin the expanded candidate and independently review it. The nine-file improvements can be tracked as locally verified, but do not claim full P02 complete-window behavior while this item remains open. This audit grants no release authorization.

## Verified corrections and production integration

- **Leaderboard:** actual imported `fetchStatsData` excludes null/invalid GAA from numerical ranking, preserves observed GAA 0, rejects unsupported SV/QS fractions and requires positive played-game support. Unknown ratios remain null in the wins list. Current query and pagination/position/season behavior remains covered by existing tests. Actual landing-page `getServerSideProps` calls `fetchStatsData` at `pages/stats/index.tsx:643`; desktop/mobile consumers use the nullable `GoalieStat` contract. Their rendering tests and scoped typecheck passed.
- **GAA:** the actual helper pools paired GA/numeric seconds, including relief: 4 GA / 4,200 seconds × 3,600 = 3.428571. Missing or invalid pairs and zero total exposure return null; true zero with positive exposure remains zero. No predictive weights or VuDu formula were changed.
- **SV:** complete paired counts give 37/40 = .925. Missing saves or shots in a supplied appearance withholds the rate rather than pooling unmatched counts. Known nonappearance exclusion, observed .000, and incomplete playoff support passed independent rendered controls. P02-R1 describes the remaining earlier-filtering gap.
- **QS:** known starts alone form the denominator; relief is excluded. All starts must have binary source classification before a numeric rate is shown. One QS in two classified starts plus relief gives .500; incomplete classification stays null with classified-start coverage retained. Actual contextual rendering and the independent helper controls passed.
- **Profile field omission:** the regular-season and fallback goalie selects really omit `quality_start` and `time_on_ice`. Independent rendering using exactly that column shape yields unavailable headline GAA and QS with `0 of 1 starts classified`, not fabricated zero/performance claims. This is the intentional behavior of the bounded packet. Field hydration, source completeness, units and the existing `GoalieGameLogEntry.time_on_ice` type remain a separate integration task; its current type is `string | null`, while this numeric-seconds calculation is intentionally strict.
- **Compatibility:** original tests were preserved and extended; both desktop and mobile observed-zero behavior passes. The nine-file patch does not touch SSR/radar, the 13 A7–A9 files, provider/writer selectors, dependencies or model formulas. Writer code at `web/pages/api/v1/db/update-wgo-goalies.ts:675–693` was inspected only to confirm the existing `stat.timeOnIce`/`advStats.qualityStart` mapping; no fresh provider-data or unit certification was performed.

## Verification and fixed boundary

**Independently executed:** 96/96 owner tests across six files; 6/8 independent controls with the two P02-R1 failures above; scoped TypeScript exit 0; nine-file ESLint exit 0. Logs contain only the existing `punycode` dependency deprecation warning and expected assertion diagnostics; no offline-network-block marker occurred. The owner's retained red receipt reports 38 failed/41 passed assertions in four imported-code files; it was inspected, not independently rerun or counted as current failure.

All **9 candidate hashes**, **13 A7–A9 preservation hashes**, and **50 tested import-closure hashes** matched at start and end. These are 72 checked manifest entries, including overlap. The isolated test snapshot's 50 files plus the added unchanged Trends-summary caller (**51 source/config files**) remained byte-identical to canonical sources. The before/after lease copies and packet hash also matched their manifest. No local files moved during this pass that require an immediate repeat; later changes to these hashes need a fresh snapshot review.

The owner report names `d3f057c6…`, CANDIDATE names `a6e9f8b6…`, and TESTED-SOURCE names `e92f3c2c…`; they reflect moving concurrent history. This pass began/ended at `octoberBranch` **`a565238f670edc4cf65da79ad52ba82ec41f3b71`**. File fingerprints, not those commit labels alone, establish the reviewed candidate. The owner manifest SHA-256 is `ed8550bfaf63983d71bd8f203de16f3fd5ac1013409db1bae1b169d6d266a275`; packet SHA-256 is `f5f7e4ea308493e1c57dfa0cdbdc642996fc7376d3deaf63445d6d10c3908f98`.

| Runtime file | Reviewed SHA-256 |
| --- | --- |
| `playerStatsContract.ts` | `d9453373cc4b774ac61e458e616091440559399bcb1358f704c4c90abffdf242` |
| `PlayerContextualStats.tsx` | `7872aa27fe8c421a5e3d17be898a6ece641589e3fa2cdfb1d4a3087c57c557b9` |
| `statsPageFetch.ts` | `1a58b8ed40a070905b3d180b8cfa1d3ae3ee6d2ecb25bff38ffa8b9834ff7f66` |
| `statsPageTypes.ts` | `486e67073a7ffe6a5efc94174772da2d0df528d2be362c0eded7b747bd9b8d09` |
| `LeaderboardCategoryGoalie.tsx` | `3a3dc4e7f5db7cdfafb7ccab1a3647ec893b6000fa330aaf4745d87dac433158` |
| inherited `PlayerSummaryStrip.tsx` | `9581b77429c45d8ab1fd0fc3c08365f380f2b3607e32878c76d32d9564e9c92a` |
| inherited `PlayerStatsSummary.tsx` | `cc53653a7458131313e1b20931c090b1444877eef4c6cfb65e08f2c478f8ec1e` |

All test-file hashes are in start/end integrity JSON. `reviewed-source.tar.gz` retains the test snapshot and independent fixture; `SHA256SUMS` pins the review receipts.

## Limits and next action

Coordinate the two-consumer admission fix, then re-review that narrow expanded candidate. Keep source hydration, historical QS definition/version, season/trade/window joins, model qualification and broad P02/S07/S12 acceptance separate.

No full application compiler/suite, browser, build, database, live provider or production API was run. The page query/caller path was inspected statically and the real components rendered offline; the full player-page SSR pipeline was not executed. No production incident or source-data prevalence is claimed. No application, owner artifact, canonical register, migration or dependency was edited; no secrets/raw sessions, external services, Git writes or deployment were involved. There is no execution denial, pending approval or uncertain tool action. The remaining blocker is correctness/ownership scope, not tool access.
