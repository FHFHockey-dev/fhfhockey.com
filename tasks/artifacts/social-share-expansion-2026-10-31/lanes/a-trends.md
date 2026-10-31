# Lane A receipt: Trends (What Changed 2.0, Role Watch 4.0)

Run 2026-10-31 on `octoberBranch`, base `7bddeaf0d`. Post ids: `what-changed`, `role-watch`.

## Subtasks

| Subtask | State | Evidence |
| --- | --- | --- |
| 2.1 Per-player L5/L10 vs STD | Done | `buildWhatChanged`; 11 metrics, per game or per 60, per-player samples and overlap. Tests: short samples, overlap count, null never zero, game missing from NST |
| 2.2 Matched recent vs previous | Done | `comparison` field through `previousN`. Test: no game in both windows, short previous window unranked |
| 2.3 NST coverage admission | Done | `coverageAdmits`, `minCoverage`, numerator, denominator, missing, `unresolved`. Tests: 89 vs 90 boundary, L5 with 4 of 5 refused and L10 with 9 of 10 admitted, two games or two NST rows on one date unresolved |
| 2.4 `WhatChangedCard.tsx` | Done | Card tests by static render on fixtures; no ranks without an admitted population |
| 2.5 [real] Sources and read | **Open for the lead's render only**: builder and card ran on real rows (reads R1, R3 below); the loader has not run against the live database, since a league read exceeds the 50-row bound | `whatChanged.sources.ts`, read plan tests, budget below |
| 4.1 TOI and PP TOI change | Done | `buildRoleWatch`. Tests: seconds, exact threshold boundary, short sample, traded player's new team |
| 4.2 Role context | Done | `roleSlotReader`. Tests: unknown vs off PP, forecast-wording check on card and alt text |
| 4.3 `RoleWatchCard.tsx` | Done | Card tests by static render on fixtures |
| 4.4 [real] Bounded read; Tuesday unchanged | **Open for the lead's render only**, as 2.5; Tuesday part done | Reads R1, R3. `trends.ts`, `trends.test.ts`, `trendSources.ts`, `SocialShare.tsx` have no diff; `trends.test.ts` 34 of 34 passed |

## Checks

| Check | Result |
| --- | --- |
| `npm test -- whatChanged.test.ts roleWatch.test.ts` | Passed, 36 tests |
| `trends.test.ts`, `server.test.ts`, `contract.test.ts`, `PostStudio.test.tsx` | Passed, 49 tests |
| eslint on lane files | Clean |
| `npx tsc --noEmit` | 0 errors |
| CSS-module pure check (`WhatChangedCard`, `RoleWatchCard`) | Passed |
| `playwright test social-share-trends.spec.ts --list` | 3 tests discovered. Discovery only: the browser run is the lead's |

## Real reads

Project `fyhftlxokyjtpndbkfse`, Supabase MCP `execute_sql`, 2026-10-31. Single `SELECT`s, no writes, no provider calls.

| # | Statement | Tables | Sample rows | Result |
| --- | --- | --- | --- | --- |
| R0 | Uniqueness and join: NST rows per player and date, WGO games per date, NST rows with no WGO date, season totals | `nst_gamelog_as_counts`, `nst_gamelog_as_counts_oi`, `wgo_skater_stats` | 0 (6 aggregates) | Passed. 0 duplicates in 7,019 and 6,839 keys; 0 players with two games on one date in 7,775; every NST row lands on a WGO date; `gp` always 1 |
| R0b | Same pick query, first attempt | Same | 0 | **Failed before running**: ambiguous column. Corrected in R1 |
| R1 | Choose sample players by coverage | `wgo_skater_stats`, `nst_gamelog_as_counts` | 0 (aggregates and 2 player ids) | Passed. 502 skaters with 10+ GP; none has an L5 NST gap; 386 have an STD gap |
| R2 | Admission and completeness | `wgo_skater_stats`, `nst_gamelog_as_counts`, `nst_gamelog_as_counts_oi`, `wgo_team_stats`, `games` | 0 (1 aggregate) | Passed. See findings |
| R3 | Rows for 2 players (ids 8482094, 8478444), `LIMIT 50` per table | `wgo_skater_stats` 29, `nst_gamelog_as_counts` 28, `nst_gamelog_as_counts_oi` 27, `rolling_player_game_metrics` 22, `powerPlayCombinations` 20 plus 29 distinct game ids | At most 50 per table | Passed |

**Real render (no export claim):** player 8482094's R3 rows went through `toSkaterAppearances`, both builders and both cards by static render, not a browser. Hand arithmetic agrees: L5 TOI 4,221 s ÷ 5 = 14:04; baseline 7,281 s ÷ 9 = 13:29; xGF 3.08 ÷ 5.83 = 52.8%; STD NST coverage 13 of 14 admitted at 90%; MIN to NSH flagged, 3 of 5 recent games; before P2 and Off PP, latest P3 and Off PP. At Role Watch's default minimums this player has no mover (+0:35, +0:18), so that view used 30 s and 15 s.

## Findings for the lead

- **NST gaps all sit in 2026-09-29 to 10-06.** No L5 window is affected today, but STD is: 487 of 502 eligible skaters are admitted for individual metrics at 90%, and **only 380 of 502 for on-ice xGF%**. Ranking xGF% vs STD leaves 122 unranked, and the card says so. Eligible NST missing: 401 of 6,581 appearances.
- **Completeness today:** 432 team games reported for 216 scheduled, so the WGO window is complete.
- **Rolling's first-week gap is real on the card:** the sample players' line rows start at 10-06 and 10-08. A "before" game in that week prints "Line unknown".
- **Unit 3 prints Off PP**, following Tuesday's rule that only PP1 and PP2 are units. The player above had 2 and 3 seconds of PP time in such games.
- The shared `normalizeEvDeploymentBucket` clamps a defense slot 4 to P3; real rows hold slot 4. Unchanged and read-only here.

## Read budget for the lead's render

Each loader is season to date, so it needs more than 50 rows. Today: `wgo_skater_stats` 7,775 rows (ceiling 50,000, about 46,000 at season end), `wgo_team_stats` 432 (2,800), `games` 216 (1,400). What Changed adds an NST table of about 7,000 rows (50,000) only when ranking an NST metric, and only that table; a selected player reads under 82 rows from each. Role Watch adds at most 648 rolling rows and 1,440 PP rows for listed players. All are exact-count and fail closed. Reads are page-size bounded and sequential.

## Choices to review at 13.0

- What Changed has fields beyond the contract's two defaults: comparison, min coverage, metric, basis, and a one-player lookup. A name matching more than one player selects nobody and the card lists the candidates.
- Role Watch requires a baseline at least as long as the window, a fixed rule printed in the cohort line rather than a new field.
- Per-60 uses WGO TOI of the same covered games. PP points per 60 uses PP time, so a player with no PP time is unknown rather than 0. TOI, PP TOI and xGF% have no per-60 form and always show their own unit.
- Lists show 6 ranks, keeping ties up to 9 rows, and count the rest. Card fit in the 1080 square has not been seen in a browser.

## Blockers

None. No frozen file needed a change. No fan-out sessions were started.
