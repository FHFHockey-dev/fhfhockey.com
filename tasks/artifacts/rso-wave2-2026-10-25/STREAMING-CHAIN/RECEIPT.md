# RSO streaming chain — receipt (2026-10-27)

**Commit:** `979c05ae16f93de27c348039bb63542f46efc094` on octoberBranch, local only (base 60cd358ea). Nothing was pushed, deployed or migrated. There were no production or Yahoo reads.

## Diagnosis (verified by reading `planning.ts`)
Chef's diagnosis holds:
- With ~816 FAs, `defaultWorkQuotas` gives ~43 evaluations and 13 fit groups.
- `scheduleFits` walks the groups alphabetically.
- `phaseBudget` is ~5 per depth per objective.
- In `extensions`, a streamer the plan itself just added sorts after the ranked drops, so "drop the streamer I just added" is only tried in the long tail.

The existing search is unchanged.

## Approach
New `web/lib/rosterScheduleOptimizer/streamingChain.ts`, called once from `planRoster`. The result is in `PlanningResult.streaming` (`rso-stream-v1`).

- **State.** The chain starts at today or the range start. Its budget is the remaining adds (`remaining / acquisitionCost`) of the provider period containing the first possible move. Past days are skipped, and the chain stops at the period end.
- **Timing.** Each leg uses the search's add timing: league-local midnight of the action date (the day before for `next_day`). A move due now uses `latestEquivalentActionAt` (RSO-2b-A3). Moves after `asOf` are `conditional`. `acquisitionEffectiveAt` supplies the effective time.
- **Slot gains.** For each day, locked or started rows hold their slots. A small Kuhn matching then asks whether a player with eligibility E gains an active slot on top of the roster minus the drop (and any other spot's streamers). A streamer only gains a game when this matching says so.
- **DP.** One stream spot is a sequence of contiguous day windows. Each next add drops the previous streamer, and the first add drops a drop candidate: the top 3 in `knownDropOrder` that `dropEligible` allows. The DP maximises AGP, then projected FPts, then fewer adds. Each leg starts on its pick's first game.
- **Ranking within a window (TJ decision 1).** Projected FPts over the games the player would start come first; this is `forecastPointsReader`, the same admitted totals as `gameForecastPoints`. Recent form only orders near ties (≤ 0.1 FPts), then id. The top 5 are shown as options.
- **1 vs 2 spots (TJ decision 2).**
  - The two-spot split runs spot A, then spot B on top of A, over every budget split and drop pair.
  - All chains are certified by `evaluatePlan` (planRoster's objective; legal, budget verified), and net AGP/FPts come from that evaluation.
  - The two-spot chain is suggested only if its certified net beats the one-spot chain; the one-spot chain is then still offered second.
  - Chains with net AGP ≤ 0 are dropped.
- **Contract.** `alternatives` is unchanged, so its existing tests and consumers are unaffected; streaming lives in a separate field.
- **UI.** `StreamingItinerary.tsx` sits at the top of the Itinerary panel, above By position / By player / Itinerary. It shows:
  - ADD/DROP or HOLD (plays / no game) per day and spot, with a "claim <day>" note for next_day moves;
  - adds used k/R and running AGP;
  - ranked option buttons that swap the player and re-link the next drop (`streamingChainSteps`);
  - totals, marked "estimate after swaps" until re-planned;
  - a One/Two spot toggle and "Use this streaming plan", which selects the steps through `editIntent`, with the same gating as plan alternatives.

## Recent form
The only existing read path is `PlanningPlayer.form`. It is loaded in `lib/rosterScheduleData/planning.ts` from `skatersGameStats.points` and holds NHL points over the last 3–5 games, not last-10 fantasy points. Last-10 FPts/G would need a changed production query in a file outside this lane. Shipped: projection-first ranking, with the existing form shown as "recent X P/G" and used only as the near-tie tiebreak. This is a pending question for TJ.

## Files (sha256 at commit)
| File | sha256 |
|---|---|
| web/lib/rosterScheduleOptimizer/streamingChain.ts | e569a88a2cf4cd1b06a237d3c4ab26cb4eea962337bb1e1792f309dea39d6d48 |
| web/lib/rosterScheduleOptimizer/streamingChain.test.ts | 5eb47546522cbb747d11ac661c1ab6531bbc0724fcf9c756110fb120b3658760 |
| web/lib/rosterScheduleOptimizer/planning.ts | 50a8c72f6855225492981688a08a86804447cb46e15ce725e7f3b1bdf1af4966 |
| web/lib/rosterScheduleOptimizer/planningTypes.ts | 5c7145307a6cf8e2891689dc90e53cf2c85caf0ef0facbf9faf84d8c4518f732 |
| web/components/RosterScheduleOptimizer/StreamingItinerary.tsx | 7e9d03978a00cc675f1c28b8e7701a8965cf02bba4b7cc68fb8d20283cd002fc |
| web/components/RosterScheduleOptimizer/StreamingItinerary.module.scss | 3f977ddbed21788fda04d159fa73efaaf4a08169a1f07eae5b92814c8a9d3b2d |
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | ba49bbccc0b34ed91284ccabed9067bab6e73b9083a411b8b2cec36793fd1df8 |
| web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx | 1d989bb8921ab4de79faf15309a340c0eb5ac4d9240c1b57b3ba584527abecda |

## Tests added (synthetic fixtures only)
`streamingChain.test.ts`:
- TJ's exact week gives a +7 AGP, 4/4-add chain (LAK → PHI over NJD → WPG → EDM over OTT by recent-form near tie). Wed, Fri and Sun are HOLD days. Step times are 22:59Z dueNow, then league midnights, all conditional.
- A mid-week Wednesday start with 2 adds left gives +4: WPG Thu, then EDM Sat.
- The two-spot split (+14, 4 adds) is suggested over the one-spot chain (+7), which is still offered. With one open slot, only the one-spot chain is returned.
- Chain steps stay legal on four newer and older reads: `evaluatePlan` stays legal with net +7, and `reconcileIntent` reports no issues.
- next_day: action the day before, effective at midnight; +6 over 3 adds.
- An option swap re-links the next drop and stays legal at +7.

`StreamingItinerary.test.tsx`:
- The day list shows ADD/HOLD, k/R adds, running AGP and ranked options with recent form.
- A swap shows aria-pressed, the re-linked drop and estimated totals; selecting passes the swapped steps.
- The two-spot toggle marks "suggested", and a blocked select shows its reason.

## Commands and results
- `npx vitest run lib/rosterScheduleOptimizer/streamingChain.test.ts`: 6/6 passed.
- `npx vitest run __tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx`: 3/3 passed.
- `TZ=UTC npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer`: 43 files, 1025 tests passed.
- `TZ=America/New_York …` (same paths): 43 files, 1025 tests passed.
- `npx vitest run hooks/useRosterPlanning.test.tsx`: 9/9 passed.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, under `/private/tmp/fhfh-heavy.lock` (noclobber; waited for a BLSH holder; released): exit 0.
- eslint on the 7 touched TS/TSX files: 0 errors. The 6 `react-hooks/exhaustive-deps` warnings in `RosterScheduleOptimizer.tsx` were already there.
- CSS-module pure check (sass, then postcss-modules-local-by-default `pure`) on `StreamingItinerary.module.scss`: ok.
- Perf probe (temporary test, deleted): 830 synthetic FAs, 32 teams, 7 days, no forecasts. `planRoster` took ~0.4 s in total.

## Limits
- DP proposals are heuristic (gains from per-day matchings; the two-spot pass is sequential and greedy). Only `evaluatePlan`-certified chains are returned, and their totals come from that evaluation.
- Chain structure is AGP-first, then FPts. A 1-game star never beats a 2-game streamer in the same window.
- Only free agents and manager-available players are chained; waiver claims are not.
- Daily lineup leagues only. One acquisition period per chain. At most 3 drop candidates (`knownDropOrder`).
- Within a stream spot, a player is never re-added.
- Option totals after a swap are estimates until re-planned.
- The goalie minimum is not targeted directly. A goalie streamer counts when a G slot is open, and the evaluation reports `goalie.risk`.
- Recent form is NHL points per game over the last ≤5 games, not last-10 FPts (see above).
- Not browser-verified. No dev server was run.

## TJ decision (pop-up, after commit)
TJ chose the last-10 FPts read. Chef stages it as a follow-up: 10 games of box-score stats, weighted by league scoring, in the planning-data loader. This is a production query change for Chef's review. Display it combined with projections: projected points for the week's games, with last-10 FPts/G for past results and momentum. The itinerary already renders `StreamingOption.recentPointsPerGame`/`recentGames`, so the follow-up only has to fill them with FPts/G (and relabel "P/G" as "FPts/G").

## Last-10 FPts hint (commit `a7dfb06a18403fafbae728853dea0257de513230`)
TJ's pop-up decisions were: extend the existing planning read (no shortlist request), and use `wgo_skater_stats` + `wgo_goalie_stats`, replacing the `skatersGameStats` form read. Chef approved the one-line schema change. TJ also suggested an L10GP materialized view, which is a possible follow-up only: it needs a migration.

### Query shape and row bound (`web/lib/rosterScheduleData/planning.ts`)
- **Two reads.** One read per table, in parallel and paged by the existing `pages()` helper (1,000-row pages; the count is checked and the read fails if it exceeds the cap). They replace the old pair (a 21-day `games` read, then `skatersGameStats` in 100-game `in` batches).
- **Filter:** `season_id = query.seasonId`, `games_played = 1`, and `date` from `now − 30 days` through yesterday (the same "before the previous day" cutoff as before).
- **Order and paging:** `date desc`. Skaters are paged by `id`, because `(player_id, date)` is not unique in that table. Goalies are paged by `(goalie_id, date)`, which is unique.
- **Indexes used:** `idx_wgo_skater_stats_date`, `wgo_skater_stats_date_idx` (partial, `games_played = 1`) and `idx_wgo_goalie_stats_date`.
- **Columns:** the id, `date`, `games_played`, plus the 17 skater or 7 goalie per-game columns behind the Yahoo per-game point stats. These are the same columns as `yahooPastLineupPoints`, now in `lib/rosterScheduleOptimizer/recentForm.ts`.
- **Row caps:** 25,000 skater rows (theoretical full 30 days ≈ 16 games × 36 skaters × 30 = 17,280) and 2,500 goalie rows (≈ 16 × 4 × 30 = 1,920). Same 2-second form deadline. A failure stays optional: it is reported as `recent_form_stats_query_failed` and planning continues.
- **No per-player queries.** No new tables and no migrations; no `PROJECTIONS_*` tables are read.
- **Payload:** `PlanningPlayer.recentTotals = { games ≤ 10, stats }` holds league-agnostic sums keyed by Yahoo stat. Zeros are omitted, and null marks a game with a missing value. The client applies the league's weights per player class (`recentPointsPerGame`). The result is null in category leagues, or when a weighted stat can't be scored per game or is missing.
- **UI:** options read "X FPts/G (last N)". It is still only a hint and near-tie tiebreak; ranking stays projection-first.
- **Schema:** `web/lib/in-season/workspaceSchema.ts` gets exactly one new line: optional, strict `recentTotals` in `player`.

### Does the source swap change `form` or other consumers?
- **Same `form` algorithm.** Last 3 points ≥ 6 is "Scoring hot"; 5 games with 0 points is "Scoring cold"; otherwise "Recent scoring" over ≤5 games; fewer than 3 games gives no label. Goalies still get no `form`.
- **Values can differ in three cases:**
  1. *Wider window.* It is now 30 days instead of 21, so a player with fewer than 3 games (or fewer than 5) in the last 21 days but enough in 30 days now gets a label, or a "cold" check, where before he got none.
  2. *Points source.* It is now `wgo_skater_stats.points` instead of `skatersGameStats.points`. Both are NHL points per game, but their ingestion timing or corrections may differ. Not checked against production: no production reads were allowed.
  3. *Regular season only.* Before, `games.type = 2` enforced it. Now it relies on `wgo_skater_stats` being the regular-season table (playoffs are a separate table) and on `season_id`. Whether preseason rows ever land there is unverified.
- **Other consumers:**
  - `form` is read by the CandidateCard hot/cold chip and the player-detail chip in `RosterScheduleOptimizer.tsx`. The contract is unchanged and they render the same.
  - `evidence.form` keeps its source and limitation text.
  - Start-chart and game-expectation consumers pass `skipRecentForm` and make no form reads.
  - `calendarCoverage` (via `loadPlanningData`) now issues the WGO reads instead of `games` + `skatersGameStats`. It doesn't use `form` or `recentTotals`.
  - The Yahoo planning read passes `recentTotals` through; transport is passthrough.
- **Snapshot size:** grows by roughly 0.2 KB per player with recent games, within the 4 MB budget.
- **Tests that prove it:**
  - `lib/rosterScheduleData/planning.test.ts`:
    - "orders WGO game logs by date, derives recent form and sums the last 10 played games": same `form` output for the hot case, last-10 sums, duplicate dates and the query shape.
    - "sums goalie rows separately and gives goalies no skater form".
    - "leaves recent form empty without failing when no recent games are present".
    - "reports a safe recent-form failure stage without database details".
    - "preserves complete schedule planning when optional reads are incomplete": a WGO failure is non-fatal.
    - "shared game expectations skip unused ownership and recent outcome reads…": start_chart makes no WGO reads.
  - `lib/rosterScheduleOptimizer/recentForm.test.ts`: played-only and max-10 sums, per-class weights, unknown cases.
  - `lib/rosterScheduleOptimizer/streamingChain.test.ts`:
    - near-tie ordering by last-10 FPts/G;
    - "round-trips recentTotals and still accepts an older snapshot without it" (fails without the schema line, which I confirmed by temporarily removing it).
  - `components/RosterScheduleOptimizer/CandidateCard.test.tsx` and `RosterScheduleOptimizer.test.tsx`: the form chip, unchanged.
- **Not proven:** numeric parity between the two point sources on production data.

### Files (sha256 at a7dfb06a1)
| File | sha256 |
|---|---|
| web/lib/in-season/workspaceSchema.ts | 7ebad4b98e3710cddc3418cbe51f466b9c7095123e1023c5e7a2d7df04457ae9 |
| web/lib/rosterScheduleData/planning.ts | 0d5d7c77004ac4c52f73d45a6eae5f47b86266b7a9fa91201ec6cba41333f5c2 |
| web/lib/rosterScheduleData/planning.test.ts | c954a6005ab3edcaa9fe0e83fe57ecb0aeb97666c72b252d9c131be067b2bf40 |
| web/lib/rosterScheduleOptimizer/recentForm.ts | 6a250035c90e8871864fa15775037a1e2884c15745732140911d905013e1e0c9 |
| web/lib/rosterScheduleOptimizer/recentForm.test.ts | 4614560dc702dc358751cb86fb1d97c123f8d94ce8c7ae4f414f19bb7353e30f |
| web/lib/rosterScheduleOptimizer/planningTypes.ts | 6a616b663dfcb12bcf7d4d8d92db3411225c75a2c6769064e3f1462e823354e6 |
| web/lib/rosterScheduleOptimizer/streamingChain.ts | 86154406c8e2ba1a8a6af6329b242f9487b48ad4d60e375d576db03dcb4e1443 |
| web/lib/rosterScheduleOptimizer/streamingChain.test.ts | 8990c7e4252e5d8a5d4434d2b4504d5483fbc748f3e6dd37c0f96837bcc0f66f |
| web/components/RosterScheduleOptimizer/StreamingItinerary.tsx | 5f09eafc60b3de2232341f5f638ce5ba778e775d114fec27e99e0d9040ae406f |
| web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx | fae9ddd0ef54cef19aa8c375b21df3c39fde6474d0ec4b87bb60b66f7ab4f28c |

### Commands and results
- Focused tests (`recentForm`, `streamingChain`, `StreamingItinerary`, `rosterScheduleData/planning`): all pass.
- `TZ=UTC` and then `TZ=America/New_York` `npx vitest run lib/rosterScheduleOptimizer lib/rosterScheduleData components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer hooks/useRosterPlanning.test.tsx lib/integrations/yahoo/rosterPlanning.test.ts lib/in-season/workspaceSchema.test.ts lib/in-season/workspaceRoutes.test.ts __tests__/pages/api/v1/forge/forecasts.test.ts`: 56 files, 1459 tests passed in each. `calendarCoverage` has no test file.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, under `/private/tmp/fhfh-heavy.lock` (noclobber, released): exit 0.
- eslint on the 10 touched files: 0 errors, 0 warnings.
- No production, Supabase or Yahoo calls; the Supabase client is mocked.
- **Follow-up for Chef:** `SKATER/GOALIE_POINT_COLUMNS` in `lib/integrations/yahoo/rosterPlanning.ts` now duplicate `recentForm.ts`. Deduping them means editing that file, which is outside my lanes.
