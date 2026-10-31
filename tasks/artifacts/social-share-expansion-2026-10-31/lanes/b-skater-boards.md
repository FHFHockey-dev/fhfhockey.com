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
