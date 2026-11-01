# Lane G receipt: goalie inventory, Risky Starts, Start/Sit (SS 11.0)

Files are under `web/`. Posts: `risky-starts` and `start-sit`, group Goalies, basis observed. Consumer interface `goalie-inventory-v1` is unchanged.

## Subtasks

| Subtask | State | Evidence |
| --- | --- | --- |
| 11.1 Pure mapping | Done | `lib/socialShare/modules/shared/goalieInventory.sources.ts`, `buildGoalieInventory`. Tests: fixture conforms to the type and version; absent observation gives `none`; raw probability gives `unavailable` |
| 11.2 Lens metrics | Done | `buildTeamLenses`, `gameSignals`. Tests: pooled PP and PK, zero denominator unknown, known zero kept, ties shared, ranks withheld league-wide without a complete population, no score field |
| 11.3 Forecast admission | Done | `admitStartParticipation`. Tests: expired, wrong basis, wrong event, no model, mismatched probability, out of range, future issue and raw probability all give `unavailable`; confirmed with no forecast stays confirmed |
| 11.4 Risky Starts | Done | `riskyStarts.ts`, `.sources.ts`, `.test.ts`, `RiskyStartsCard.tsx` and SCSS. Tests: both sides of a game, mirrored pairs, flags per lens, another lens never moves a row, correlation note on data and alt text |
| 11.5 Start/Sit and search | Done | `startSit.ts`, `.sources.ts`, `.test.ts`, `StartSitCard.tsx` and SCSS, `searchGoalieInventory`, `clientOnly` search field. Tests: accents (including ø, which NFD cannot split), team abbreviation and name, token changes with search, server scope refuses the key |
| 11.6 Handoff fixture | Done | **`web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`**, export `GOALIE_INVENTORY_FIXTURE`. Fictional goalies, built by the real mapping. No Player Cards file edited |
| 11.7 Real reads | **Built on TJ's decision. Live read not run: the lead's at render** | Reads logged below. Both posts read through the server client and `resolveDailyBoardEvidence`, imported unedited. Tests cover IFTTT-origin evidence, corrections, stale reports, conflicts and no observation. No statement went through the app's server credential; my reads used the Supabase MCP. Coverage gaps are under "Provenance" |

## Checks

| Check | Result |
| --- | --- |
| `npm test` on the 3 test files and Player Cards' `sharedGoalieOutlook` test | Passed, 86 of 86 |
| `eslint` on all lane TS and TSX files | Passed, no findings |
| CSS-module pure check on both SCSS files | Passed |
| `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit` | Exit 0, no errors after the lead's fixes. **Correction: my two earlier reports said 0 errors in the whole project. That was wrong.** Plain `npx tsc --noEmit` runs out of memory here (exit 134) and prints no errors, and I had filtered its output without checking the exit code. It hid two real errors in my files, now fixed |
| `playwright test e2e/social-share-inventory.spec.ts --list` | 4 tests discovered |
| Browser run of that spec | **Not run**, the lead's at 13.0. Neither card's fit in the 1080 square has been seen |
| Browser bundle | **Not verified.** `lib/supabase/server` and the resolver are imported behind `typeof window === "undefined"`, so they should drop out of the client compile, which a dev compile at 13.0 will show. No credential is exposed either way, because the key is not `NEXT_PUBLIC` |
| Mapper on real rows | Passed. A temporary test (not committed) fed the 28 + 28 rows of reads 7 and 8 through `buildTeamLenses`; all 12 metrics for NJD and NYR matched read 9's independent SQL aggregates to 6 decimals |

## Real reads

Project `fyhftlxokyjtpndbkfse`, Supabase MCP `execute_sql`, 2026-10-31. Every statement was a single `SELECT`. Nothing was written. No NST, Yahoo, NHL or Vercel call was made.

| # | Statement | Tables read | Rows returned | Result |
| --- | --- | --- | --- | --- |
| 1 | Column lists | `information_schema.columns` | 3 (metadata) | Passed |
| 2 | Coverage aggregates through 10-30 | `wgo_team_stats`, `nst_team_gamelogs_as_counts` | 1 (aggregate) | Passed. 432 of 432 unique rows on each, 32 teams, no nulls in any lens column, PP goals 300 = PP goals against 300, opportunities 1,381 = times shorthanded 1,381 |
| 3 | Schedule sample, 10-31 to 11-01 | `games` | 5 sample rows | Passed |
| 4 | Observation aggregates, first attempt | `player_forecast_goalie_start_observations` | 0 | **Failed before running**: no `source_kind` column. Corrected in 5 |
| 5 | Observation aggregates by status | `player_forecast_goalie_start_observations` | 2 (aggregates) | Passed. 486 confirmed, 118 projected, all accepted, all `tweet_projection`, every row has a player. **Every `source_url` and `expires_at` is null**, and none supersedes another |
| 6 | NST situation and season values; L10 read size | `nst_team_gamelogs_as_counts`, `wgo_goalie_stats`, `wgo_team_stats`, `games` | 2 (aggregates) | Passed. All rows `situation = all`, updated 2026-10-31. L10 windows start 10-03 at the earliest, needing 412 goalie rows. 48 games in the next 7 days |
| 7 | Team sample, NJD and NYR | `wgo_team_stats`, `teams` | 28 sample rows | Passed |
| 8 | NST sample, NJD and NYR | `nst_team_gamelogs_as_counts` | 28 sample rows | Passed |
| 9 | Same-date join and pooled metrics | `wgo_team_stats`, `teams`, `nst_team_gamelogs_as_counts`, `player_forecast_goalie_start_observations`, `games`, `wgo_goalie_stats` | 1 (aggregate) | Passed. 432 of 432 team games join NST on team and date. 7 of the 48 games in the next 7 days have an observation. 4 team games have zero PP opportunities |
| 10 | Writer provenance, first attempt | `line_source_ifttt_events` and others | 0 | **Failed before running**: no `created_at` on that table. Corrected in 11 |
| 11 | Writer provenance | `player_forecast_goalie_start_observations`, `player_forecast_observation_conflicts`, `player_forecast_conflict_resolutions`, `line_source_ifttt_events`, `line_source_snapshots` | 4 (aggregates) | Passed |
| 12 | Conflict columns; next-7-day observation counts | `information_schema.columns`, `player_forecast_goalie_start_observations`, `games` | 2 (aggregates) | Passed |

**Runtime reads exceed the sample bound, so they are the lead's to run at the render step.** Each edition reads, with exact counts and fail-closed ceilings: `games` (up to 1,400), `wgo_team_stats` (2,800), `nst_team_gamelogs_as_counts` (2,800), `wgo_goalie_stats` (1,200). Today those are about 264, 432, 432 and 412 rows.

## Provenance (TJ's decision, relayed by the lead, 2026-10-31)

**Writer.** IFTTT webhooks (`pages/api/v1/sources/ifttt/*-tweet.ts`) -> `lineSourceIftttReceiver` -> `line_source_ifttt_events` -> `update-line-sources` and `update-lines-ccc` -> `persistTweetProjectionReports` (`tweetProjectionStorage.ts:244`) -> `capturePlayerForecastSourceRows` -> `capture_starter_board_goalies` -> the table.

**`tweet_projection` is the IFTTT path, not a second source.** All 604 rows are `tweet_projection` / `validated_events` with `sourceAccountKind: internal_derivation`, so there is nothing to add and nothing is counted twice. The pipeline is live: newest IFTTT event 2026-10-31 18:53 UTC, newest observation written 18:37 UTC, 265 IFTTT events since 10-29.

**Resolver.** `resolveDailyBoardEvidence` in `lib/projections/dailyBoardEvidence.ts`, unedited. It is applied to a narrow read of the goalie, conflict and resolution tables with `lineups: []`, rather than `loadDailyBoardEvidence`, which also reads lineups with `select *`. `raw_status` and `metadata` are never selected. A failed conflict read fails the whole confirmation to unknown.

**Row counts (2026-10-31):** 604 observations, 486 confirmed and 118 projected, all accepted, all from 10-10 onward. `source_account`, `source_url`, `expires_at` and `supersedes_id` are null on all 604. 0 `goalie_start` conflict rows and 0 conflict resolutions.

**Printed on both cards (TJ's layout review):** the legend keeps "Unknown = no report yet. Reports aren't split by reporter." The full notes, "Reports aren't separated by reporter, so conflicts between sources can't be detected." and "No source link or expiry exists for these reports.", print in the evidence beside the preview. Each appears only when the rows read have that gap.

**Conflict proof:** because live rows cannot produce a conflict, `startSit.test.ts` and `riskyStarts.test.ts` feed fixtures with distinct reporters through the real resolver and render the real cards, which must show "Conflicting reports" and not "Source: confirmed". The writer gap goes to TJ through the lead; `tweetProjectionStorage.ts` is untouched.

**Gaps, which are flagged and not filled:**

1. **Reporter disagreement cannot be detected live.** The writer sets `source_account` null on every row, and both the resolver and the capture RPC identify a reporter by account, else `source_key`. All live rows are therefore one reporter: the newest report wins. **There have been 0 `goalie_start` conflict rows ever, yet 3 team games hold confirmations of two different goalies.** Those may be corrections or real disagreements; the data cannot say which. The cards print this gap. Fixing it means the writer keeping the original reporter, which is outside this lane.
2. **No expiry-based staleness.** `expires_at` is null on every row, so only a later report retires an old one. The cards show age instead (for example "3d ago"). I added no threshold of my own.
3. **No source link.** `source_url` is null on every row, although the writer passes `report.originalUrl`, so attribution may be pending. I did not trace why.
4. **Partial coverage.** 13 team games have observations in the next 7 days, out of 96. Unknown is the common state.
5. **`supersedes_id` is ignored**, as the resolver ignores it. No live row sets it.
6. **Goalies outside the L10 list.** A confirmed goalie with no recent appearance, such as a call-up, is not listed. The source's reasons state the count.

## Blockers and open items

1. **`conflicting` is not in v1, and stays out** (lead's decision: no v2, because Player Cards already tests the version id). A conflict is `none` in `goalie-inventory-v1`, with a count in the source's `reasons`. `GoalieInventoryDetail.conflicts` carries the list, and both posts show "Conflicting reports" from it. Player Cards sees unknown plus the reason unless both owners agree on a v2. `likely`, `unconfirmed` and `ruled_out` also show unknown.
2. **Live forecast.** Every live forecast is `unavailable`. Admission is built and tested, and `readStartParticipations` is the seam, but no post passes it. `loadGameExpectations` is a broad planning read whose cost I did not assess.
3. **Render step is the lead's.** The confirmation read adds `player_forecast_goalie_start_observations` (ceiling 2,000), `player_forecast_observation_conflicts` (500) and `player_forecast_conflict_resolutions` (500), through the server credential.

## Render follow-up (lead, real render)

- The goalie observations source now reports `asOf` as the New York date of the newest report, with the exact time in `updatedAt`, so the shell prints a date and "(updated ...)". The value changed, not the v1 shape: `asOf` is still `string | null`, and Player Cards only prints it in `sourceNotes`.
- "1 observed goalie has..." and "1 team game has..." are now singular. Browser re-render is the lead's.

## Layout pass (TJ: fill the space, cut meta text)

- Risky Starts shows up to 8 tiles (was 6), and Start/Sit up to 18 rows (was 12), and both stretch to fill the body. Row and tile counts come from estimates of the 860px body. **Not measured: no browser run in this lane.** The lead renders on real data and reports any clipping.
- Each card has one legend line. The correlation, unknown, gap and forecast notes moved to `evidence.sample` and `evidence.cohort`, and the alt text. Per-lens flag counts came off the tile.
- Below about 5 tiles or 10 rows (thin data or a narrow search) the card stays at natural height rather than stretching one row over the body, so it can show a band.
- "Validated" replaces "Validated reports" on Start/Sit rows for width.

## Decisions to review

- PP, PK and times shorthanded come from WGO, not NST PP and PK logs. WGO has opportunities and known zeros, and NST is missing 4 rows of each.
- Rates are season to date through the day before the edition, since `InventoryMetric.window` allows one window per metric.
- `likely`, `unconfirmed` and `ruled_out` observations show unknown. None exist in the data today.
- `loadGoalieInventory`, the frozen entry point Player Cards will call, also reads through the server client. Without the credential it degrades to unknown with the reason.
- Risky Starts flags are top third on both sides, as Cherry-Picked Matchups does; PP v PK uses a bottom-third PK. Default lens is ratio exposure, and days ahead defaults to 7. These are chosen starting points, not findings.
- Games already under way are dropped from both posts, but stay in the inventory.
- A blocked source is left out of the card's evidence list because it was not read; the card prints its reason instead.

## Visual rework (Chef's ticket, TJ asked for visuals on both cards)

- **Scale:** `RANK_BANDS` and `rankBand` in `goalieInventory.sources.ts`, in thirds, the same cut as the Risky Starts flag, which now reads from it. One hue, because a high rank is danger in the ratio lens and support in the win lens, so green and red would mislabel one of them. Category Blueprint's green and red scale was not reused for that reason.
- **Risky Starts:** each pairing is head-to-head SVG bars out from the centre. Length is `(cohort - rank + 1) / cohort`. Fills are attributes. Numbers stay beside the bars. No rank gives a dashed empty track. Only the lens in view is drawn.
- **Start/Sit:** every lens number is its own chip, filled inline by rank. Source status: confirmed green, projected amber, conflicting magenta with a dashed edge, unknown unfilled. Forecast has no fill in either state.
- **Known reading point:** a weak PK is flagged from the bottom of the league, so its bar is short and pale on a flagged row. It was not inverted, so length means the same thing on every bar. The flagged row's bold text carries the signal.
- **Checks:** lane tests and `sharedGoalieOutlook` pass; full tsc with the larger heap exit 0; eslint clean; CSS pure check passed; spec `--list` shows 4 tests. **Browser not run. Fit at 860px is estimated, not measured:** about 206px a tile (30px a pairing at 4 pairs) and about 45px a Start/Sit row.
- **Not this lane:** `lib/player-cards/cardEvidenceVerdict.test.ts` fails in the shared checkout, in a file with another lane's uncommitted edits.

## TJ review rework (winner rule, home and away, mockup)

- **Winner rule:** `headToHeadWinner`, `strengthRank` and `strengthShare` in `goalieInventory.sources.ts`, used by both cards. Every metric ranks #1 at its highest value (checked in `buildTeamLenses`). SA, xGA, SCA, GA and TSH/GP convert to `cohort - rank + 1`; SF, xGF, SCF, GF, PP%, PK% and GD/GP keep their rank. Equal strength or a missing side has no winner.
- **Risky Starts:** built to TJ's mockup (`~/Desktop/Untitled-1.png`). The actual home team is on the left whichever team the tile is for. The mockup's sample put CAR's numbers under WPG, which this corrects.
- **Choices against the mockup:** bar length is strength, not raw rank, so the longer bar always agrees with the triangle. Raw length would contradict it, for example xGF #10 against xGA #5. Text is white rather than dark because dark text is unreadable where a short bar ends. The printed ordinal stays the real league rank, 1ST = highest.
- **Opposing goalies:** read from the other team's row in the inventory. If there are none, the side shows "No goalie listed". The tile's own team has white names; the opponent's are muted.
- **Start/Sit:** winner green, loser red, tie and missing plain. Logos and triangle sit between the chips. Goalie, status and forecast columns narrowed.
- **Checks:** see the commit report. **Browser not run; fit at 860px is estimated.** About 206px per tile; 4 pairings get at least 20px each even with 4 wrapped goalie lines. Start/Sit lens cells take about 165px, leaving about 460px for the other five columns.

## Market lines on Risky Starts (TJ chose stored DraftKings plus NHL.com partner odds)

- **Precedence, per game:** the latest stored row captured before puck drop and by the edition, otherwise NHL.com `/now`. A line comes whole from one row or one feed entry, so books never mix. The feed is read at most once per load, 4s timeout, only if a game still has no line.
- **`normalizeNhlScheduleOdds` not reused:** it reads the schedule's provider-keyed odds and files ledger rows, while this feed has description-keyed odds. The feed's own parser is in `riskyStarts.sources.ts`.
- **Feed guard:** `/now` keeps live prices, -100000 on one game in the sample read, so an update at or after puck drop is refused.
- **Coverage gap:** most of a 7-day window will print "No line yet". Stored rows exist only for same-day games and the feed held one slate. At the time read, it still showed the previous night's slate.
- **Read log, 2026-11-01:**

| # | Statement | Source | Rows returned | Result |
| --- | --- | --- | --- | --- |
| 13 | Coverage by provider (SELECT, aggregate) | `game_prediction_market_odds_snapshots` | 1 | Passed; 0 sample rows |
| 14 | Coverage by game date (SELECT, aggregate) | Same | 8 | Passed; 0 sample rows |
| 15 | Anon privilege, policy count, games next week (SELECT) | Same, `pg_policies`, `games` | 1 | Passed; anon can select, but this post reads with the server client |
| 16 | 4 single GETs, no retries | `partner-game/US/now`, `/US/2026-11-03`, `/US/2026-11-01`, `/US/2026-10-31` | | 200, then 404, 404, 404 |

- **Checks:** see the commit report. Tests use mocks only. **Browser not run; head row grows to about 42px when the date wraps, leaving at least about 90px for 4 pairings, against the 86px minimum.**

## Start/Sit sides and names (TJ's review)

- Game column prints team logo, vs or @, opponent logo. With no logo URL, the kit's fallback still prints that team's abbreviation.
- Every lens has the goalie's team left and the opponent right, for chips, logos and triangle. Columns run Quality (`xGA / OPP xGF`), Quantity (`SA / OPP SF`), Win (`GF / OPP GA`). Each lens is tested with the winner on each side.
- Evidence and alt text say "Quality, quantity and win". Shared field names (`volume`, `ratioExposure`) are unchanged.
- **Old names still printed elsewhere, not changed:** Risky Starts ("Volume upside", "Ratio exposure"), Player Cards' goalie outlook (`lib/player-cards/goalieOutlook.ts`, `sharedGoalieOutlook.ts`), Goalie Rescue ("Volume" group, and a "ratio exposure" comment).
- **Browser not run; fit at 860px not measured.** The lens cells are unchanged in width and the game column is narrower.

## Risky Starts footer and tile edge (TJ's final review)

- **Footer, no shell change:** the shell prints `evidence.sources` on the PNG, so `compactRiskyEvidence` files one combined source for this post only. Example: "NHL.com, NST, goalie reports, DraftKings through 2026-10-30 · All situations · 432 of 432 completed team games", 110 characters; 115 estimated to fit on one line.
- **Full list:** each source, its date and its update time now print in the panel's **Cohort** line, because the panel's Source line prints the same field as the footer. Tables and reasons carry over on the combined source. The shell has no field for footer-only text, so a separate one would need a shell change.
- **Combined date:** the oldest date any source reaches.
- **Tile edge:** inline `TILE_EDGE`, 1.5px lighter border, 10px radius, light shadow. Grid gap 4px to 6px, tile padding 4px to 5px.
- **Browser not run; one line and fit at 860px not measured.**
