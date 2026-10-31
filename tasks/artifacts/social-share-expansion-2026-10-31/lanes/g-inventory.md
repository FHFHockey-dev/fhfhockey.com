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
| `npm test` on the 3 test files and Player Cards' `sharedGoalieOutlook` test | Passed, 82 of 82 |
| `eslint` on all lane TS and TSX files | Passed, no findings |
| CSS-module pure check on both SCSS files | Passed |
| `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit` | 0 errors in lane files. 4 errors remain elsewhere, in `modules/contract.test.ts` and `modules/server.ts`, which the lead is fixing. **Correction: my two earlier reports said 0 errors in the whole project. That was wrong.** Plain `npx tsc --noEmit` runs out of memory here (exit 134) and prints no errors, and I had filtered its output without checking the exit code. It hid two real errors in my files, now fixed |
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

**Printed on both cards:** "Reports aren't separated by reporter, so conflicts between sources can't be detected." and "No source link or expiry exists for these reports." Each appears only when the rows read have that gap.

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

## Decisions to review

- PP, PK and times shorthanded come from WGO, not NST PP and PK logs. WGO has opportunities and known zeros, and NST is missing 4 rows of each.
- Rates are season to date through the day before the edition, since `InventoryMetric.window` allows one window per metric.
- `likely`, `unconfirmed` and `ruled_out` observations show unknown. None exist in the data today.
- `loadGoalieInventory`, the frozen entry point Player Cards will call, also reads through the server client. Without the credential it degrades to unknown with the reason.
- Risky Starts flags are top third on both sides, as Cherry-Picked Matchups does; PP v PK uses a bottom-third PK. Default lens is ratio exposure, and days ahead defaults to 7. These are chosen starting points, not findings.
- Games already under way are dropped from both posts, but stay in the inventory.
- A blocked source is left out of the card's evidence list because it was not read; the card prints its reason instead.
