# Lane B receipt: skater boards (SS 3.0, 7.0)

Posts: `bsh-board`, `category-blueprint`, `nightly-floor` (Cardio Masters is its `cardio` view). Reach each at `/social-share/posts?post=<id>`.

## Subtasks

| Subtask | State | Evidence |
| --- | --- | --- |
| 3.1 BSH leaderboard | Done | `bshBoard.test.ts`: missing component unranked, shared ranks and ties below the cut, no shot-attempt substitution, short window count, position and GP, traded skater |
| 3.2 Risers and fallers | Done | `bshBoard.test.ts`: previous N and season excluding recent, short windows excluded under both, known zero kept, missing baseline unranked, equal changes tie |
| 3.3 Category Blueprint | Done | `categoryBlueprint.test.ts`: chosen combinations and order, one basis and cohort, missing shown as missing and counted, no score field |
| 3.4 BSH and Blueprint cards | Done on fixtures | Card tests render through the lazy `card()`. `suggestedUse` is a note and no field is a date. Browser fixture render is the lead's: spec written, `--list` only |
| 3.5 BSH and Blueprint sources | Done: sample read logged | Reads R2 and R3 below. Ceilings below |
| 7.1 Strict thresholds | Done | `nightlyFloor.test.ts`: exactly X fails for SOG, hits and blocks; DNP absent; missing neither passes nor fails |
| 7.2 Views | Done | `nightlyFloor.test.ts`: ≥1 point, Cardio Masters, selected-category zero, zero versus missing |
| 7.3 Filters | Done | `nightlyFloor.test.ts`: coverage boundary (90% admitted, 80% not), unknown ownership, inclusive range, stated 0 known, ties, empty pool |
| 7.4 Nightly Floor card | Done on fixtures | Card tests. Browser fixture render is the lead's |
| 7.5 Bounded read | Done: sample read logged | Read R4 below |

The real reads are samples of 2 players each. The full-season loaders were not run because they exceed the 50-row bound.

## Real reads

Project `fyhftlxokyjtpndbkfse`, 2026-10-31, SELECT only. R2 to R4 ran with the anon key through the real `readSkaterAppearances`, each capped at `limit: 16`, then through the real builders. The key was not printed or stored.

| # | Statement | Tables read | Sample rows | Result |
| --- | --- | --- | --- | --- |
| R1 | Coverage, null and join aggregates through MCP `execute_sql` | `wgo_skater_stats`, `wgo_team_stats`, `games`, `yahoo_players`, `yahoo_nhl_player_map_read` | 0 (1 aggregate row) | Passed. 7,775 rows, 432 of 432 team games have skater rows, 216 scheduled, 0 null BSH or category values, positions C, L, R, D, team codes all known |
| R1b | Pick 6 sample player ids through MCP | `wgo_skater_stats` | 0 (1 aggregate row) | Passed |
| R2 | BSH: 2 skaters, 2026-10-18 to 10-30 | `wgo_skater_stats` | 11 | Passed. L5 built correctly |
| R3 | Blueprint: 2 skaters, same dates | `wgo_skater_stats` | 10 | Passed |
| R4 | Nightly Floor, `cardio`: 2 skaters, same dates, plus their id map and Yahoo rows | `wgo_skater_stats`, `yahoo_nhl_player_map_read`, `yahoo_players` | 12, 4, 2 | Passed. One known at 21%, one unknown shown as unknown |
| R5 | Independent L5 totals for the same 6 skaters through MCP | `wgo_skater_stats` | 0 (6 aggregate rows) | Passed. BLK, SOG, hits, BSH and zero-point games match the builders exactly |

Sample totals: `wgo_skater_stats` 33, map 4, `yahoo_players` 2. All within 50.

R1 also binds the join: `yahoo_players.player_key` matches the map 1,325 times and bare `player_id` 0 times, and 972 NHL ids hold more than one Yahoo id. `ownershipByPlayer` tries both keys and treats differing values as unknown. 30 of 733 skaters have no map row, so they show unknown.

## For the lead at the render step

The live loaders read more than the 50-row bound, so they are yours to run:

| Read | Ceiling (fails closed above) | Now |
| --- | --- | --- |
| `wgo_skater_stats`, season to date | 50,000 | 7,775 |
| `wgo_team_stats` | 2,700 | 432 |
| `games` | 1,400 | 216 scheduled to date |
| `yahoo_players`, Nightly Floor only | 2,500 | 1,608 |
| `yahoo_nhl_player_map_read`, Nightly Floor only | 3,500 | 2,373 |

Late in the season the appearance read is about 47,000 rows, in pages against the studio's 20-second request timeout. It is untested at that size, so it may need narrowing by then.

## Not verified

- Browser runs. `e2e/social-share-skater-boards.spec.ts` passed `--list` only. It includes a fit check, because a clipped table would lose evidence from the PNG. Row counts (20) are estimated from the CSS, not measured.
- A real full-pool ranking, for the reason above.

## Behaviour to review

- Default BSH risers and fallers (L10 vs previous 10) need 20 GP. Teams have about 13.5 games now, so that default shows its empty state. L5 vs previous 5 works today.
- Nightly Floor's default excludes unknown ownership even at 0-100%, per the contract. 757 Yahoo rows are null, and the card prints how many skaters that removes. Task 13.8 already tracks the source gap.
- Blueprint's "Top N in every category" defaults to 250, and missing categories neither pass nor fail. This default is mine, not the contract's. See "Blueprint default" below.

## Blockers

None for this lane.

Shell issue reported to the lead and fixed at `839aa7af4`: export is now refused when server-scoped settings differ from `snapshot.settings`. These posts keep their own guard, because the card body should not show old data under new labels while the editor is still changing settings. The shell's message appears first.

## Blueprint default (follow-up to the real render)

The first default, Top 100, made an empty post: nobody of 633 skaters was top 100 in points, shots, hits and blocks. Read R6 (MCP `execute_sql`, `wgo_skater_stats`, 0 sample rows, 8 aggregate rows; same rule as the post: season through 2026-10-30, 5+ season GP, L10 per game, competition rank) counted skaters in the top N of every category:

| Top N | PTS, SOG, HITS, BLK | PTS, SOG, HITS | PTS, SOG, BLK | SOG, HITS, BLK | PTS, SOG |
| --- | --- | --- | --- | --- | --- |
| 50 | 0 | 1 | 0 | 0 | 27 |
| 100 | 0 | 2 | 1 | 0 | 64 |
| 150 | 1 | 9 | 12 | 3 | 90 |
| 200 | 5 | 32 | 34 | 11 | 167 |
| 250 | **16** | 53 | 52 | 29 | 191 |
| 300 | 31 | 83 | 91 | 49 | 238 |

**Decision: keep the four categories and default to Top 250.** That gives 16 skaters today, all shown under the 20-row limit.

- The four categories stay because offense and physical play rarely meet, which is the point of this post. Dropping to PTS and SOG would just list scoring forwards.
- Top 200 gives 5 and Top 150 gives 1, so a few games could empty the default again. 250 leaves margin.
- 250 of 633 is about the top 40%, a looser claim than the old default. The card prints the N and the cohort, so the reader can see that.
- It stays a visible field. No score was added. A strict setting still gets the honest empty state and no export.

The count comes from SQL using the post's rule, not from the loader. The lead's real render is the check that the card shows 16.

## Checks

- `npm test` on the lane's three files plus `PostStudio`, `server` and `contract` tests: passed.
- eslint on the lane's TypeScript files: clean. The CSS-module pure check on `BshBoardCard.module.scss`: passed.
- `npx tsc --noEmit` with an 8 GB heap: 0 errors in this lane's files. Errors remain in `modules/contract.test.ts`, `modules/server.ts` and `shared/goalieInventory.sources.ts`, which are not this lane's.
- `playwright --list`: 6 tests found. Not run in a browser.

Follow-up commit (Blueprint default): 50 tests in the lane's 3 files passed, eslint clean on the changed TypeScript, `--list` found 6 tests, and `tsc` shows 0 errors in this lane's files (3 remain in `creaseShift.test.ts`, not this lane's). No SCSS changed. Not run in a browser.

## Layout pass (TJ's review: less whitespace, less meta text)

- **Rows:** the limit moved from 12 to 20. Rows now share all the body height the legend leaves, so a short board stretches instead of leaving a dead band, and boards over 14 rows use 24px type instead of 28px.
- **Text:** each card has one legend line. Kept on the card: Nightly Floor's "Exactly X fails", Blueprint's "no combined score", the ranked count, and the per-row MET / KNOWN and MISSING columns.
- **Moved to `evidence.sample` and `evidence.cohort`:** the DNP rule, the unranked and excluded counts, skaters missing a category, and how many rows sit below the card. These print on the page, not in the PNG.
- **Risers and fallers:** cells changed from "4.00 was 1.00" to "4.00 1.00", with the earlier value in grey as the legend says.
- **Fit test:** the spec now fails on clipping, a truncated cell or name, or a dead band over 40px, with a new test at the 20-row limit for each post.
- **Not measured:** the 20-row fit and the name widths are from the CSS. No browser run; the lead renders on real data.
- **Checks:** 50 tests in the lane's 3 files passed, eslint clean, the pure check passed, `--list` found 9 tests, and `tsc` exited 0 for the whole app.

## BSH leaders chart and tile (TJ's review: "Add a layered line, with each segment representing B, S and H")

- **Chart:** each leader row has a stacked chart of the window's appearances, oldest to newest: blocks at the bottom, then shots, then hits, with a white top edge at that game's BSH. All rows share one scale.
- **Colours:** B `#3f9bdc`, S `#c88120`, H `#cf5cad`, with a B, S, H key in the one legend line and the same tints behind the BLK, SOG and HITS columns. The dataviz validator passes them on the post's dark surface.
- **Tile:** the goalie `HeatTile`, per-game BSH scaling with value, caption "N total". BLK, SOG and HITS each still print total over per game.
- **Gap versus 0:** a game with a missing component breaks the shape and draws nothing. A known 0 draws on the baseline.
- **Gaps cannot reach a ranked leader today.** The rule unranks a skater with a missing component in the window, so a gap only appears if that rule changes. The card and tests handle it anyway.
- **Rows:** leaders go from 20 to 12, because the chart and tile need the height. Risers, fallers, Blueprint and Nightly Floor stay at 20. Skaters below the card are counted in `evidence.cohort`.
- **PNG:** drawn as inline SVG like the What Changed sparkline. Not measured or exported here; no browser run.
- **Checks:** 57 tests in the lane's 3 files passed, eslint clean, the pure check passed, `--list` found 9 tests, `tsc` printed no errors.

## BSH risers and fallers, side by side (TJ's review: same visuals)

- **View:** the View field's Risers and Fallers options became one, "Risers and fallers" (`view=movers`). An old `?view=risers` link now returns a 400; these posts have not shipped.
- **Rows:** 7 a side, about 114px each against about 107px of content (from the CSS, not measured). Rows reuse the What Changed `ChangeSide` layout, so the sides are headed Up and Down. Skaters below the card are counted per side in `evidence.cohort`.
- **Each row:** a coloured change tile, red or green and scaling with size on one scale across both sides. Below it, BLK, SOG and HITS per game with the earlier value in grey, in the leaders' tints, then the stacked chart.
- **Chart:** spans the baseline and recent windows, oldest to newest, on one scale across both sides, with a dashed line and a light band from where the recent window starts. With "Season excl. recent" it covers the whole season.
- **Kept on the card:** "L5 vs previous 5" and the short-comparison count in the one legend line. The full wording stays in the evidence.
- **Gaps:** a missing component in either window unranks the skater, so no gap reaches this card under the current rule either.
- **Not measured:** no browser run; the lead renders on real data.
- **Checks:** 59 tests in the lane's 3 files passed before a final legend-wording edit, and `bshBoard.test.ts` was rerun after it. eslint clean, the pure check passed, `--list` found 10 tests, `tsc` printed no errors (both before that edit).

## Category Blueprint rank colours (TJ's review: add visuals)

- **Scale:** each cell is coloured by its own category rank as a share of the cohort, on one scale for every category: top 5% (strong green), 15%, 30%, 50% (neutral), lower (red). Rank 1 is always the top band, whatever the cohort size.
- **Unchanged:** value and rank stay printed, rows stay ordered by Category 1, and there is no combined score or summed colour. Up to 20 rows.
- **Missing:** a dashed outline with "missing" in amber and no fill, so it cannot read as weak.
- **On the default:** Top 250 of 633 is about the top 39.5%, so every ranked cell falls in the top 50% and red cannot appear. Red needs a looser Top N.
- **Legend:** "Per game, L10. Rank among 633: top 5% 15% 30% 50% lower. Top 250 in each; no combined score." with colour swatches. One line by estimate, not measured.
- **Checks:** 63 tests in the lane's 3 files passed, including each band boundary. eslint clean, the pure check passed, `--list` found 10 tests, `tsc` printed no errors. No browser run.

## Nightly Floor and Cardio Masters strip and tile (TJ's review: add visuals)

- **Strip:** one mark per appearance in the window, oldest to newest: a tall bar for met, a low grey bar for not met, a hollow amber box for a missing stat. It applies to all six views, since they share the card.
- **Same test as the count:** the row stores the `floorOutcome` results as `marks`, and the numerator and denominator are counted from that same list. Exactly X is not met.
- **Tile:** % on one absolute scale, full strength at 100%, so a colour means the same on every board. Green for SOG, hits, blocks and points.
- **My call, not in the ticket:** Cardio Masters and zero-category boards use red for the tile and the met marks, because the count is one a skater would rather not have.
- **Kept:** MET / KNOWN, MISSING, "Exactly X fails" and the ranked count, in one legend line with a mark key.
- **Rows:** 20 to 14 (about 57px each), so the strip and tile fit. Skaters below the card are counted in `evidence.cohort`.
- **Spec fixture:** crowded names changed from "Fictional Longname Skater N" to "Fictional Long Name N". 21 to 22 characters is longer than real NHL names as far as I know, but the old 28 no longer fit this card's narrower name column by estimate.
- **Not measured:** no browser run; the lead renders on real data.
- **Checks:** 67 tests in the lane's 3 files passed, including met marks equal to the numerator on every view, scoreless marks, the equality boundary and the missing gap. eslint clean, the pure check passed, `--list` found 10 tests, `tsc` printed no errors. The last test expectation was corrected after those three ran.

## BSH segmented bar (TJ's reference; replaces the stacked charts above)

- **Bar:** every leader and riser/faller row has one full-width bar, B then S then H, each section as wide as its share of the total, with its letter centred. Colours `#4DA6DE`, `#E5AE5B`, `#C75B52` are inline on the element, and the BLK, SOG and HITS tiles wear the same tints inline.
- **Data:** leaders use the shown per-game values; risers and fallers use the recent-window values, and the earlier values stay in the tiles. The per-game series, `recentFrom`, the dashes and their legend wording are gone.
- **Edges:** a section under 18px hides its letter (at 982px on leaders, 481px on movers). A zero has no section, all zeros give a neutral empty bar, and a missing value gives a dashed amber "missing" bar with no split.
- **Layout by CSS, not measured:** leaders about 67px a row, a 37px line then a 30px bar line; the BSH tile went to one line. Movers need about 110px of about 114px, so the three tiles went to one line each.
- **Palette validator:** on the dark surface blue and amber fail the lightness band (0.694, 0.785); CVD, normal-vision and contrast checks pass. These are the ticket's colours and each section carries a direct letter, so I kept them.
- **Checks:** 68 tests in the lane's 3 files passed, eslint clean, the pure check passed, `tsc` printed no errors, `--list` found 10 tests. No browser run.

## Nightly Floor and Cardio Masters rework (TJ's review)

- **Headline:** `floorHeadline(settings)` gives "GP% WITH 3+ SOG", "GP% WITH 5+ HITS", "GP% WITH 2+ BLK", "GP% WITH 1+ PTS", "GP% WITH 0 PPP" and "CARDIO MASTERS". A threshold that is not whole prints "OVER 2.5". It is wired through the module's `headline`, using the lead's seam in `contract.ts` and `PostStudio.tsx`. The picker and panel keep "Nightly Floor".
- **Metric label:** 34px line at the top of the board, such as "METRIC: SOG, 3+ per game" or "METRIC: POINTS, exactly 0". The legend went from 19px to 15px on this post only.
- **Average column:** named per view (SOG/G, HITS/G, BLK/G, PTS/G), known games only, two decimals, "—" with no known game.
- **MISSING column removed:** a missing game stays as the strip's outlined block and in the legend, MET / KNOWN keeps its denominator, and alt text and the row data keep the count.
- **Width:** of the 82px freed, the new column takes about 72px and the strip 10px (170px to 180px). More for the strip would clip the 22-character fixture name by estimate.
- **Not measured:** rows drop to about 54px by CSS; no browser run.
- **Checks:** 75 tests in the lane's 3 files passed, eslint clean, the pure check passed, `tsc` printed no errors, `--list` found 10 tests.
- **Headline length (from `54ed1bd11`):** the longest whole-number headline is "GP% WITH 11+ HITS" (17 characters). The field accepts a value like 9.5, which gives "GP% WITH OVER 9.5 HITS" (22), the same length as the longest post title. A new E2E test measures that form on one line; not run here.
- **Column rename:** "MET / KNOWN" is now "# GP" (values unchanged, such as 9 / 10; the GP column stays). Earlier notes in this receipt use the old name. No other text printed on the PNG says "known".

## Multi Cat Monsters (TJ's rework of Category Blueprint)

**TJ's decision overrides the earlier "no combined score" rule for this card only.** The post id stays `category-blueprint`, so links and the registry hold; the picker now says "Multi Cat Monsters".

- **Headlines:** "MULTI CAT MONSTERS" and "POINTS-FIRST MULTI CAT MONSTERS", from one `view` setting. The category pickers and the top-N gate are gone; min season GP, window and position stay.
- **Percentile:** the share of the other eligible skaters beaten in that category, with a tie counting as half. Every category averages 50 however many skaters tie, so a category full of ties weighs the same. A lone skater is 50.
- **Score:** the average of the four percentiles; Points-First is (2×PTS + SOG + HITS + BLK) / 5. A missing category leaves the skater unranked and counted, never zero.
- **Colour:** inline fills on one scale, 95+, 85+, 70+, 50+, below.
- **Header risk, by estimate:** the 31-character Points-First headline is about 1,000px at the header's 52px, against about 776px available. It needs a smaller size for long headlines in frozen `PostStudio.tsx`. The E2E test fails if it wraps.

Read for the real-data check, one `SELECT` through MCP `execute_sql` on 2026-11-01:

| # | Statement | Tables read | Rows returned | Result |
| --- | --- | --- | --- | --- |
| R6 | L10 percentiles and both scores, top 15 per list, three lists | `wgo_skater_stats` | 0 sample rows (45 per-player aggregate rows) | Passed. 644 eligible at 5+ GP through 2026-10-31 |

Points-First top 15, L10 (SQL using the same formula; the builder itself has not run on the full season):

| RK | Skater | Score | PTS/G | P PTS | P SOG | P HITS | P BLK | Standard rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Rasmus Dahlin D | 86.2 | 0.90 | 87 | 94 | 72 | 91 | 1 |
| 2 | Seth Jones D | 84.8 | 1.70 | 100 | 93 | 60 | 72 | 3 |
| 3 | Neal Pionk D | 84.5 | 0.90 | 87 | 87 | 89 | 72 | 2 |
| 4 | Nick Suzuki C | 84.0 | 1.33 | 98 | 94 | 71 | 59 | 5 |
| 5 | Tim Stützle C | 81.9 | 1.30 | 97 | 82 | 86 | 47 | 9 |
| 6 | Drake Batherson R | 80.6 | 1.30 | 97 | 87 | 75 | 47 | 15 |
| 7 | Brandon Hagel L | 80.3 | 1.30 | 97 | 100 | 40 | 68 | 17 |
| 8 | Alex Tuch R | 80.2 | 1.00 | 90 | 93 | 60 | 68 | 11 |
| 9 | Charlie McAvoy D | 80.1 | 0.89 | 85 | 73 | 63 | 94 | 7 |
| 10 | Brady Tkachuk L | 79.8 | 1.50 | 99 | 98 | 97 | 5 | 18 |
| 11 | Moritz Seider D | 79.2 | 0.60 | 73 | 71 | 79 | 100 | 4 |
| 12 | Zach Werenski D | 78.8 | 0.80 | 83 | 94 | 36 | 98 | 10 |
| 13 | Jake Sanderson D | 78.6 | 1.14 | 94 | 73 | 42 | 90 | 20 |
| 14 | Jake Neighbours L | 78.6 | 0.80 | 83 | 77 | 96 | 55 | 13 |
| 15 | Evan Bouchard D | 78.5 | 1.20 | 95 | 90 | 30 | 82 | 23 |

**Verdict: 2x helps but does not fully deliver what TJ described.** It swaps 4 of the standard top 15 and keeps the same top 3, with 2 and 3 reversed. 12 of 15 are P85+ in points, but 8 of 15 are defensemen, and only 8 are P50+ in all four. Tkachuk (P5 blocks) and Bouchard (P30 hits) rank on two or three strong categories. A points floor at P70 changes none of this top 15, because the lowest here is P73; about P85 would remove Seider, Werenski and Neighbours. None added.

**Checks:** 84 tests in the lane's 3 files passed, eslint clean, the pure check passed, `tsc` printed no errors, `--list` found 11 tests. No browser run.
