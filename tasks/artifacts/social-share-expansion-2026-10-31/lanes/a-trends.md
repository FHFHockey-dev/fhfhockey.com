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

Each loader is season to date, so it needs more than 50 rows. Today: `wgo_skater_stats` 7,775 rows (ceiling 50,000, about 46,000 at season end), `wgo_team_stats` 432 (2,800), `games` 216 (1,400). What Changed adds an NST table of about 7,000 rows (50,000) only when ranking an NST metric, and only that table; ranking a WGO metric now adds `nst_gamelog_as_counts` for the players on the boards (ceiling 1,200: 12 players, 100 rows each); a selected player reads under 82 rows from each. Role Watch adds at most 288 rolling rows and 960 PP rows for listed players. All are exact-count and fail closed. Reads are page-size bounded and sequential.

## Choices to review at 13.0

- What Changed has fields beyond the contract's two defaults: comparison, min coverage, metric, basis, and a one-player lookup. A name matching more than one player selects nobody and the card lists the candidates.
- Role Watch requires a baseline at least as long as the window, a fixed rule printed in the cohort line rather than a new field.
- Per-60 uses WGO TOI of the same covered games. PP points per 60 uses PP time, so a player with no PP time is unknown rather than 0. TOI, PP TOI and xGF% have no per-60 form and always show their own unit.
- Both posts' boards show 6 rows a side and count the rest in the evidence cohort line. Card fit in the 1080 square has not been seen in a browser.

## Whitespace pass (TJ's review, lead's direction)

- **Fill:** both cards now take the full body height. Rows share each section's height, and sections split the body by row count. Lists went from 6 to 8 ranks per direction, table text from 22 to 24 px (one-player view 26 px).
- **Budget, estimated from CSS, not measured:** about 690 px for rows in the 860 px body. 16 rows at about 43 px each; the worst case of 18 rows gets about 38 px against a 29 px text line and a 37 px two-line role cell.
- **On-card text:** one legend line per card. What Changed keeps GP and "OV = recent games inside STD" (or "No game in both"), plus "† new team" when needed. Role Watch keeps "Observed opportunity, not a forecast.", BASE and GP. The one-player view also keeps Short sample, Below min GP and the move, since they prevent a false claim.
- **Moved to evidence and alt text:** ranked and unranked counts stay in `evidence.cohort`, which now also counts unlisted rows. `evidence.sample` gains new-team detail, the dash and Unknown / Off PP meanings, and the one player's GP and overlap.
- **Copy:** `ROLE_WATCH_COPY` shortened to the lead's wording. The PRD's 4.2 line says "not a production forecast".
- **Not run:** browser render. The lead renders on real data and sends measurements if anything clips. Role Watch's real row counts at default minimums are still unknown; the rows stretch to fill whatever the count.

## What Changed boards (TJ's review, lead's direction; Role Watch unchanged)

- **Layout:** Up and Down side by side at 6 rows a side, with team logo, name and a large change tile reusing lane E's `HeatTile`, read-only. Strength scales against the largest change shown, and sign sets the colour.
- **Tiles:** one metric per group, labelled Production, Opportunity, Underlying. Defaults are Points/G, TOI and ixG/G. The ranked metric takes its own group's slot, so its recent value always prints.
- **Nulls and coverage:** each tile uses the normal admission rule. A null prints "—", and a window below `minCoverage` prints an n/m mark instead of the change.
- **Sparkline:** the ranked metric over the last 10 appearances. A missing game breaks the line and leaves a tick, and a band marks where the recent window starts. In L10 the band covers the whole line, because the series stays at 10 appearances.
- **Ties:** a side stops at 6 rows. Ranks stay shared, and a tie running past the last row is said in the legend.
- **Overlap:** the per-row OV column is gone, because in STD it always equals the recent games. The legend says "L5 games are inside STD"; alt text keeps the count.
- **Data shape:** `WhatChangedRow` gains `tiles`, `series` and `recentFrom`; `WhatChangedData` gains `moreTied`.
- **Read-plan change:** a WGO ranking now reads NST for the boards' players, after a first build picks them. The default post therefore lists `nst_gamelog_as_counts` as a source, and a failure of that read fails the post closed.
- **Fit, estimated from CSS, not measured:** a 6-row side gets about 128 px a row, and a row's content needs about 117 px.
- **Not run:** browser render and the E2E spec (`--list` only). No new real reads in this pass; the listed-player NST read first runs at the lead's render.

## Role Watch boards (TJ's review, lead's direction)

- **Measure choice:** a new Board field, default TOI, picks whether TOI or PP TOI ranks, on its own minimum. The field is beyond the contract's three listed settings. Both measures stay reachable, the heading names the board and its strength, and each row has a small tile for the other measure. One PNG shows one board: four sides would not fit 860 px with larger rows.
- **Layout:** the same Up and Down boards as What Changed, sharing its `ChangeSide`, `RecentSpark` and row styles. The change tile is in m:ss per game. Each row keeps recent versus BASE and its actual samples.
- **Role context:** each row keeps Before and Latest, each with line and PP unit, including Unknown and Off PP.
- **Ranks:** now per side rather than by size across both directions.
- **Sparkline:** the board's measure, not always TOI, so the PP board draws PP time. **A listed row cannot show a gap today:** a qualifying change needs complete recent and baseline windows, and the last 10 appearances sit inside them. The gap is tested through the card with a patched series, not from the builder.
- **Untouched:** Tuesday's deployment section; `trends.ts`, `trends.test.ts` and `trendSources.ts` have no diff from this lane.
- **Fit, estimated from CSS, not measured:** the same row budget as What Changed. **Not run:** browser render and E2E (`--list` only). No new real reads.

## Blockers

None. No frozen file needed a change. No fan-out sessions were started.

## Larger sparklines (TJ's second review)

- **Chart:** 180×54 grew to 280×84 on both cards. The value axis marks the line's high and low with hairlines and labels in the metric's own format. The date axis has a tick per game with the first and last dates, and the recent label sits on the band. All colours are SVG attributes, and a test checks this.
- **Row layout:** the tiles moved from a horizontal strip into a stack beside the chart, each one line high with its group and metric labels. All three What Changed group tiles stay. Role Watch's stack holds Before and Latest and the other-measure tile.
- **Rows:** boards now show 5 rows a side, down from 6, to make the height. Ties past the last row are still counted in the legend. Role Watch's read ceilings fall to 200 rolling rows and 800 PP rows.
- **Fit, estimated from CSS, not measured:** about 150 px a row against 145 px of content in the 860 px body, assuming a two-line legend. No browser run; the lead renders.
