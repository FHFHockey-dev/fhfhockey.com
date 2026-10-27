# RECEIPT (P1): D6 add timing applies without RSO_YAHOO_DIET

**Bug.** TJ's production RSO had an empty Best Fit list ("Rankings appear once projections and schedules load") and asked "choose when an add counts". `rosterPlanning.ts` applied TJ's D6 inference only when `diet && fresh`, and `RSO_YAHOO_DIET` is off in production. So timing stayed `unknown`, and no add could be evaluated.

**Fix** (uncommitted on fe285adcf; no git mutations, provider or production reads, or GIT_DIR):
- `const inferredTiming = fresh ? yahooInferredAcquisitionTiming(settings) : null`. The diet flag now gates only the read reductions (D2, D3, D5, D8 caching).
- Unchanged:
  - the labelled note "Add timing is inferred from Yahoo's weekly deadline (same-day | next-day); change it in League rules if your league differs.";
  - the `acquisitionTiming` evidence entry ("Inferred from Yahoo weekly deadline"), so a manager override replaces it (`providerRules.ts`);
  - a daily league with `intraday` gives same_day and `tomorrow` gives next_day; any other value, or a stale settings read, stays `unknown`.

## Files

| File | sha256 at HEAD | sha256 now |
|---|---|---|
| `web/lib/integrations/yahoo/rosterPlanning.ts` | `ce57e852c4da356696a3a2cdb45013bc063474a5792255cd373148a40973d52a` | `45438557341841b00351dcc709937bcb6e35565c684f3be8c19d91e300b87352` |
| `web/lib/integrations/yahoo/rosterPlanning.test.ts` | `8efff00de3d47e317a2bc5e337a43c2da4411df892fcc92e466cfbc4b1f17cb1` | `a3a78aef087610a8e9f3e3b5ca03c654c33d2b3f5544671877039ce3a1c9f914` |
| `web/lib/integrations/yahoo/yahooDiet.test.ts` | `e35d32e0dead56c60d6116a3d90015bc50a1fd571973fa0b2e8663bc5afbc7db` | `049a5dd1c9ff4f53ad5462b0cef8e2b614b4a484a143016ba9b702afcfa35926` |
| `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts` | `207007ae2c721d3c08fd276e39ed50cd2c480e94e2815a9a4914fd1189ba1886` | `fb71bf9e1d6730f3157b38a9394c989f80e58d5c98589d0a9ee730e6cbffdcd2` |

## Tests

All of these use the existing fixtures, with the flag off unless stated:
- `dailyAcceptance.yahoo.test.ts`:
  - `intraday` gives `same_day`, labelled, and the bounded add becomes legal (`legal: true`, charged to the Yahoo week);
  - `tomorrow` gives `next_day`, labelled;
  - `"1"`, `""`, `null` and `"weekly"` give `unknown`, with no label;
  - a manager `next_day` override replaces an inferred `same_day` with no conflict, and the label is dropped;
  - the original "unknown timing refuses adds" and "manager fills unknown timing" tests now run with an unrecognised deadline, so that coverage is kept;
  - the Y1 Data health list starts with the inferred-timing note and asks to confirm "whether the add timing inferred … is right".
- `rosterPlanning.test.ts`: the nested-roster snapshot (intraday) now expects `same_day` and the updated Data health text.
- `yahooDiet.test.ts`: with the flag off, every read still happens and timing is inferred (`same_day`, labelled). Flag-on behaviour is unchanged: the cadence test and the deadline `null` / `"1"` / `"weekly"` cases still give the same results.
- `providerRules.test.ts` (unchanged) still covers inferred plus override, inferred alone, explicit-provider precedence and unknown.

## Planner: with a known timing, candidates get active games from the schedule alone

- **Effective time from timing only.** `web/lib/rosterScheduleOptimizer/planningTimeline.ts:14` (`acquisitionEffectiveAt`) returns null only when timing is `unknown`. Otherwise it gives the effective time: same-day uses the move time; next-day uses the next league-local midnight; waivers use the clearance time.
- **Plays come from the schedule.** `web/lib/rosterScheduleOptimizer/planning.ts:692–709`:
  - every scheduled game of each roster-timeline member becomes a play;
  - `const forecast = forecasts.get(…) ?? null` (:707), and `plays.push({ player, game, forecast })` (:709) happens whether or not a forecast exists.
- **Active games count assignments.** `planning.ts:986`: `plannedRows = assignments.filter(…held/started…)`, which becomes `activeGames` (:996). That counts assigned schedule rows, not forecasts.
- **Net active games.** `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:177`: `netAGP: scheduleKnown ? evaluation.activeGames - baseline.activeGames : null`. `scheduleKnown` (:153) needs only a legal baseline, roster team coverage, no unsupported rules and an admitted schedule.
- **Points still need projections.** Projected-points gains (`netPoints`, :178) still need forecasts on both sides. "Most starts" (AGP) ranking needs only the schedule.

## Checks

| Check | Result |
|---|---|
| `lib/integrations`, `lib/rosterScheduleOptimizer`, RSO API routes and both RSO component folders (87 files), `TZ=UTC` and `TZ=America/New_York` | 1,541 passed, 3 skipped in each. **1 failed in each: `planning.test.ts` "evaluates the entire 1000-player population across 13 days", a load-sensitive timing test.** It passes alone (2.2 s, UTC), doesn't involve this change, and nothing under `lib/rosterScheduleOptimizer/planning*.ts` is modified. |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (noclobber, released), 8 GB heap | exit 2: **2 errors, both in another lane's new untracked file `web/lib/player-cards/currentNhl.server.test.ts`**; 0 in this lane's files |
| ESLint on the 4 changed files | clean |
