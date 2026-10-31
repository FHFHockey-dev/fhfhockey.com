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
| 11.7 Real reads | **Team and schedule reads done. Live confirmation open** | Logged below. The post route's client never queries the observation table, and every goalie shows `none` with the reason |

## Checks

| Check | Result |
| --- | --- |
| `npm test` on the 3 test files | Passed, 59 of 59 |
| `eslint` on all lane TS and TSX files | Passed, no findings |
| CSS-module pure check on both SCSS files | Passed |
| `npx tsc --noEmit` | Passed, 0 errors in the whole project at the time of the run |
| `playwright test e2e/social-share-inventory.spec.ts --list` | 4 tests discovered |
| Browser run of that spec | **Not run**, the lead's at 13.0. Neither card's fit in the 1080 square has been seen |
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

**Runtime reads exceed the sample bound, so they are the lead's to run at the render step.** Each edition reads, with exact counts and fail-closed ceilings: `games` (up to 1,400), `wgo_team_stats` (2,800), `nst_team_gamelogs_as_counts` (2,800), `wgo_goalie_stats` (1,200). Today those are about 264, 432, 432 and 412 rows.

## Blockers and open items

1. **Live confirmation (11.7).** My brief said to show `none` until the access decision lands. The Chef diary (`tasks/diaries/2026-10-31-claude-social-share-chef.md`) records a TJ decision for a server-only read and says it was relayed to this lane, but no such message reached this session, so I did not act on it. The seam is `loadGoalieInventoryDetail(client, request, { observationClient })`; neither post passes it yet.
2. **That decision goes beyond the frozen type.** The diary asks to keep `conflicting` and `unknown` states and to reuse the starter-board resolver. `goalie-inventory-v1` has only `confirmed`, `projected` and `none`, so a conflict shows `none` today. Showing it needs a §5 change, which needs Codex's agreement.
3. **Live forecast.** Every live forecast is `unavailable`. Admission is built and tested, and `readStartParticipations` is the seam, but no post passes it. `loadGameExpectations` is a broad planning read whose cost I did not assess.

## Decisions to review

- PP, PK and times shorthanded come from WGO, not NST PP and PK logs. WGO has opportunities and known zeros, and NST is missing 4 rows of each.
- Rates are season to date through the day before the edition, since `InventoryMetric.window` allows one window per metric.
- `likely`, `unconfirmed` and `ruled_out` observations show `none`. None exist in the data today.
- Risky Starts flags are top third on both sides, as Cherry-Picked Matchups does; PP v PK uses a bottom-third PK. Default lens is ratio exposure, and days ahead defaults to 7. These are chosen starting points, not findings.
- Games already under way are dropped from both posts, but stay in the inventory.
- A blocked source is left out of the card's evidence list because it was not read; the card prints its reason instead.
