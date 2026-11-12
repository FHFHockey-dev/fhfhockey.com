# W2 audit: player-forecasts-season-part3 (M-PFC-121 to M-PFC-180)

Auditor: Fable, 2026-11-11. Read-only; no code changed. Line numbers are as read on `octoberBranch` on that date.

## 0. Brief

**Questions**
1. Does the planning resolver (RSO, Start Chart) turn rates and participation into unconditional per-game lines correctly, and does its goalie start-mass check do what it claims (C20)?
2. Does ledger settlement let each forecast be scored on its declared basis (decision 41)?
3. Do unknowns stay unknown through coverage, settlement and the season reconciliation (rule 5; decisions 3, 47)?
4. Are the derived season targets (138–167) the standard definitions, and are the goalie heads coherent with decisions 25, 46 and 63?
5. Are the dormant Python pieces (participation, variance, research harnesses) sound and honestly labelled?

**Reference standards**
- Law of total expectation and the Bernoulli mixture variance, Var = p·σ² + p(1 − p)·μ².
- NHL official definitions: GAA = GA × 60 ÷ minutes; SV% = saves ÷ shots against; aggregate ratios are ratios of totals.
- Vollman's quality start (decision 40); Marcel-style playing-time projection and Beta-Binomial shrinkage for participation.
- Proper scoring on a declared population (decision 41, rule 9).

**Data and fixtures**
- `forge_served_forecast_ledger`, served 2026-10-22 to 11-08, read 2026-11-11 (aggregates only; queries in section 6).
- Catalog row counts for the season and native tables.
- A 200,000-draw rounding simulation of the bridge's four-decimal rounding.

**Done when** every entry has a verdict with file:line and reach, and each defect has a size (where data exists), a fix and a test.

## 1. Summary

| Verdict | Count |
|---|---:|
| Sound | 28 |
| Mis-specified | 23 |
| Wrong | 2 |
| Undetermined | 7 |

**Reach on 2026-11-11.** Live: the planning resolver (122), coverage (121), gates (123), schedule scopes (124) and ledger settlement (126). Dormant: everything under `fantasy-projections/` and `season.py` (125, 128, 129, 138–180), because all 21 `player_forecast_season_*` tables, `player_forecast_outputs` and `native_forecast_catalog_heads` hold 0 rows. Research only: 130–137. No entry in this packet resolves to SQL, so `audits/sql-cross-cut.md` adds nothing here.

**No P0.** No public page shows a wrong number from this packet today. The two "wrong" verdicts are P1.

**Top 5 findings by user impact**

1. **The ledger never records a player who did not play, so goalie accuracy is scored on a sample chosen by the outcome** (M-PFC-126, P1, live). The settle cron passes no completeness evidence, so 0 of 11,547 ledger rows have `dressed = false`. For `bridge_exact` goalies, the scored rows say the forecasts are 36% too low on saves (1,655 expected, 2,575 actual, 110 rows). The full set of 284 rows says they are 12% too high (2,880 expected). The start-probability reliability table is built from goalies who appeared, 105 of 110 of whom started.
2. **A valid goalie group can be thrown out by rounding** (M-PFC-122, P1, live). The bridge rounds each start chance to four decimals; the resolver rejects any team-game whose chances sum above 1.000001. One of 156 served team-game groups summed to 1.0001. With three known goalies the simulated rate is 12.6%. A rejected group loses every goalie line and start claim for that game.
3. **C20 is confirmed, but its proposed remedy is wrong** (M-PFC-122, P2, live). Start chances below 1 are legitimate: 15 of 156 groups summed below 0.999 (lowest 0.528) because one goalie's chance was unknown. Rejecting them would breach rule 5. The defect is that the missing share is silent, not that it is allowed.
4. **The unconditional goalie line has no relief term** (M-PFC-122, P2, live; decision 63). The line is P(start) × the if-he-starts line. Eight of 147 settled goalie appearances in the ledger (5.4%) were relief.
5. **Undefined season ratios become 0** (14 entries, P2, dormant). A goalie with no projected ice time gets GAA 0.00 and SV% .000. This is the TypeScript twin of W1-8's `_reconcile` finding.

## 2. Per-entry table

Reach: L = live, C = conditional, D = dormant, R = research. Paths are under `web/lib/` unless they start with `modeling/`.

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| 121 | Mis-specified | `player-forecasts/calendarCoverage.ts:93-100,127-131` | L (internal) | Coverage report; D3 |
| 122 | Wrong | `player-forecasts/planningContributions.ts:98-112,195-207`; `player-forecasts/contributions.ts:332`; `rosterScheduleData/forgeDailyBridge.ts:55,635-636` | L | RSO, Start Chart; D2, D4, D5 |
| 123 | Sound | `player-forecasts/rsoUsePolicy.ts:70-97,125-168`; `player-forecasts/nativeDailyPipelineV2.ts:55,85-89` | L | RSO permissions (fail closed) |
| 124 | Mis-specified | `player-forecasts/schedule.ts:45-52,63-73,90`; `player-forecasts/contributions.ts:19-21,307` | L | Horizon edge, blend weight; D6 |
| 125 | Mis-specified | `player-forecasts/seasonGameContributions.ts:17,45-47,72-73`; `player-forecasts/planningContributions.ts:199` | D | Preview script only; D7 |
| 126 | Wrong | `player-forecasts/servedForecastLedger.ts:269-311`; `pages/api/v1/db/forge-served-forecast-settle.ts:48-49` | L | `/api/v1/forge/scoreboard`; D1 |
| 127 | Mis-specified | `player-forecasts/settlement.ts:67-68,196-209,215-218` | D | Player-forecast settle job; D8 |
| 128 | Mis-specified | `modeling/player_forecasts/season.py:3190-3204,3464-3497` | D | Season unconditional means; D9 |
| 129 | Mis-specified | `modeling/player_forecasts/season.py:3331-3335,4410-4412` | D | Season intervals; D10 |
| 130 | Sound | `modeling/player_forecasts/forge_walk_forward.py:124-150,623-668` | R | Private pilot; conditional basis declared |
| 131 | Sound | `modeling/player_forecasts/advanced.py:1831-1852,2103-2108` | D | Only caller passes `reconcile_each_quantile=False`; D12 note |
| 132 | Sound | `modeling/player_forecasts/aggregation.py:16-27` | D | Mixture variance is exact |
| 133 | Sound | `modeling/player_forecasts/challenger_model.py:94-98` | R | Linear term clamped at 0 |
| 134 | Sound | `modeling/player_forecasts/challenger_model.py:155-170` | R | Falls back to position prior (W1-8 D7) |
| 135 | Sound | `modeling/player_forecasts/daily_board_context.py:186-236` | R | Labelled descriptive, not promotable |
| 136 | Sound | `modeling/player_forecasts/daily_board_goalies.py:24-79` | R | Drops groups whose starter is outside the pool; counted and disclosed |
| 137 | Sound | `modeling/player_forecasts/daily_board_goalies.py:82-160`; `daily_board_models.py:140-157` | R | Retrospective temperature fit, chronological split |
| 138–142 | Sound | `fantasy-projections/contracts.ts:566-589,606-610` | D | Sums of expectations are exact |
| 143, 144 | Mis-specified | `contracts.ts:594-596,477-482` | D | Undefined → 0; D11 |
| 145 | Sound | `contracts.ts:496-500` | D | xGA − GA, positive is good |
| 146, 148, 150 | Mis-specified | `contracts.ts:508-510` | D | Undefined → 0; D11 |
| 147, 149, 151 | Sound | `contracts.ts:503-507` | D | Shots − min(shots, goals) |
| 152–154 | Mis-specified | `contracts.ts:611-624` | D | Undefined → 0; D11 |
| 155 | Sound | `contracts.ts:579` | D | |
| 156 | Mis-specified | `contracts.ts:597-600` | D | Undefined → 0; D11 |
| 157, 158 | Sound | `contracts.ts:566-568,580-582` | D | |
| 159 | Sound | `contracts.ts:483-486` | D | E[GP] − E[GS] |
| 160 | Mis-specified | `contracts.ts:473-476` | D | Undefined → 0; D11 |
| 161–163 | Sound | `contracts.ts:468-472,569-571,583-585` | D | |
| 164–167 | Mis-specified | `contracts.ts:590-593,487-495,601-604` | D | Undefined → 0; D11. 167 is wins per start, see D12 |
| 168–174 | Undetermined | `contracts.ts:118-126`; `fantasy-projections/evaluator.ts:394-496` | D | No artifact exists to test; structure is rate × context × participation |
| 175 | Mis-specified | `contracts.ts:95`; `modeling/player_forecasts/season.py:563` | D | Decision 40 (W1-8 D9); D12 |
| 176–178 | Sound | `evaluator.ts:394-496`; `modeling/player_forecasts/season.py:4381-4392` | D | GP and GS inherit D9 |
| 179, 180 | Mis-specified | `contracts.ts:53-54,457-512`; `modeling/player_forecasts/season.py:551-552` | D | Decision 46; D12 |

## 3. Defects

### D1 (P1, live) · The ledger cannot settle a non-appearance: M-PFC-126

**What happens.** `settleLedgerRows` writes zeros and `dressed = false` only when a trusted completeness receipt covers the team and class (`servedForecastLedger.ts:269-311`). The cron supplies none (`forge-served-forecast-settle.ts:48-49`, with a comment saying so). Every player who did not play stays unknown for good.

**Size** (ledger served 2026-10-22 to 11-08, read 2026-11-11, games more than 3 days old).
- 0 rows with `dressed = false` in any source.
- 174 `bridge_exact` goalie rows and 221 `bridge_exact` skater rows are unresolved. None has a WGO row today, so they are true non-appearances, not late data.
- `bridge_exact` goalies, 284 rows: expected starts 115.8, actual starts 105 (forecast 10% high). On the 110 scored rows alone: expected 66.9, actual 105 (forecast looks 36% low). Saves show the same flip: 2,880 expected against 2,575 on all rows; 1,655 on scored rows.
- The scoreboard's start reliability uses "settled known events", so every scored goalie appeared and 95% of them started.

**Why it is a defect.** Decision 41 scores an unconditional forecast over the full eligible universe. Bridge lines are unconditional. Without settled non-appearances that universe does not exist, and the dressed-only fallback reverses the sign of the goalie bias. The scoreboard labels itself "dressed_only", so this is misleading rather than hidden. The bridge rows also store no participation probability (`participation_probability` is null on every bridge row), which decision 41 asks for.

**Fix.**
1. Give the settle route a completeness receipt per game, team and class: the game is final and the WGO row count for that team matches the official boxscore's dressed list. With it, absent rows settle as `dressed = false` with zeros.
2. Score unconditional sources over settled rows of both kinds. Keep a separate, labelled conditional table for players who appeared.
3. Score start probability over every issued goalie row with a settled outcome, including `started = false`.
4. Persist participation probability and basis on bridge rows.

**Tests.**
- Fixture with a starter (p 0.7, played) and a backup (p 0.3, absent) and a complete receipt: the backup settles with `dressed = false`, `started = false`, saves 0; summed expected starts equal summed actual starts.
- Same fixture without a receipt: the backup stays null, and the scoreboard reports the unconditional score as unavailable, not as a dressed-only number.
- Readers to cover (rule 4): `scoreLedger`, the paired comparison, the model-against-market table and the start reliability bins.

### D2 (P1, live) · Rounded start chances can exceed the mass tolerance: M-PFC-122

**What happens.** The bridge emits `round(p)` at four decimals (`forgeDailyBridge.ts:55,635-636`). The resolver sums those and invalidates the team-game above 1.000001 (`planningContributions.ts:98-112`), then nulls every goalie line in it (`:113-128`). The provider override already avoids this ("Unrounded, so the team-game's chances still sum to at most 1", `providerGoalieStarts.ts:52`); the bridge does not.

**Size.** One of 156 served bridge team-game groups summed to 1.0001. Simulation (200,000 draws): three continuous shares that sum to 1 exceed the tolerance after rounding 12.6% of the time; two shares never do unless both sit on a five-decimal tie.

**Fix.** Set the tolerance to half a rounding unit per goalie (0.00005 × group size), or have the bridge emit unrounded chances and round only for display. Apply the same change to `calendarCoverage.ts:99`, `resolvedPlanningForecast.ts:108-122` and `rosterScheduleOptimizer/planning.ts:534`.

**Test.** Three goalies with shares 0.33337, 0.33337 and 0.33326 pass through the bridge and the resolver; the group stays valid and the three lines survive.

### D3 (P2, live) · Start mass below 1 is silent, and placeholder rows count as covered: M-PFC-121, 122 (C20)

- **C20 narrowed.** The check rejects only sums above 1. Sums below 1 are intended when a goalie's chance is unknown (`forgeDailyBridge.ts:573-580`). Observed: 15 of 156 groups below 0.999, 8 below 0.90, lowest 0.528. Do not reject them and do not rescale them (rule 5). Carry the unallocated share on the team-game and show it ("47% of this start is unassigned"), and mark any team total that depends on it as incomplete (decision 47).
- **Coverage.** `summarizeCalendarConsumerCoverage` counts a target as eligible when the row allows the use and the value is finite (`calendarCoverage.ts:127-131`). The bridge's labelled zero for a no-line player has all uses allowed (W1-11 D2), so it counts as covered. Honour the reserve code and report those targets under their own exclusion reason.

**Tests.** A team-game with shares 0.6 and unknown keeps the 0.6 line, reports 0.4 unassigned and is not rejected. A no-line placeholder row lowers `eligiblePlayerGameTargets` by its target count.

### D4 (P2, live) · No relief term in the unconditional goalie line: M-PFC-122 (decision 63)

The detailed goalie source is labelled `per_start` and multiplied by the start probability (`planningContributions.ts:199-207`; `contributions.ts:332`). Decision 63 requires P(start)·E[start] + P(relief)·E[relief]. In the ledger sample, 8 of 147 settled bridge goalie appearances were relief (5.4%). The effect is small for starters and larger for backups, whose expected saves are understated. The native baseline path (per-appearance rate × appearance probability) is already coherent, as Astra showed.

**Fix.** Add a relief component with its own probability and line, fitted on history (rule 12). Until then, label the goalie line "starts only". **Test.** On frozen inputs, the unconditional saves equal p_start × start line + p_relief × relief line, and wins, regulation losses, OTL and no-decisions sum to the appearance probability (decision 46).

### D5 (P2, conditional) · The basis of `conditionalStats` is implied, not stated: M-PFC-122, 125

The resolver treats any goalie `conditionalStats` as per start and pairs it with the start probability (`planningContributions.ts:199,202`). The season preview emits goalie `conditionalStats` that are per appearance, relief included (`seasonGameContributions.ts:17,45-47`), together with a start probability. If that forecast ever reached the resolver, a per-appearance mean would be multiplied by a start probability, understating every goalie count. All its uses are denied today, so nothing is served.

**Fix.** Add an explicit `conditionalBasis` field to `GameForecast`; the resolver rejects a row whose basis and probability disagree (rule 9). **Test.** A goalie row with `conditionalBasis = per_appearance` and only a start probability resolves to no unconditional mean.

### D6 (P2, live) · Calendar lead days are UTC days, which splits a slate: M-PFC-124

Lead day is the UTC day of puck drop minus the UTC day of "now" (`schedule.ts:63-73,90`; `contributions.ts:19-21`). A 7:00 pm ET game starts at 23:00 UTC in daylight time and 00:00 UTC in standard time, so from early November it falls on the next UTC day, while afternoon games on the same NHL date do not. Two games of one slate can get different lead days, a different blend weight (one-seventh steps, `contributions.ts:307`) and different sides of the 14-day edge. The policy states `timeZone: "UTC"`, so the label is honest; the unit is the wrong one for a hockey schedule. `regularSeasonForDate` is sound: it is used as a cross-check against `games.seasonId`, not in place of it.

**Fix.** Measure lead in NHL schedule dates (`games.date`). **Test.** A 1:00 pm ET and a 7:00 pm ET game on the same date in December get the same lead day.

### D7 (P2, dormant) · Season preview supports PP points only through a derived key: M-PFC-125

`PP_POINTS` needs `PP_GOALS` and `PP_ASSISTS` to be primitives (`seasonGameContributions.ts:8,48-49`). Under the v5 strength family, PP assists are derived from primary and secondary PP assists (`contracts.ts:566-568`), so an artifact that lists only those primitives reports PP points as a missing target. Undetermined in practice because no artifact exists. **Fix.** Check support against the reconciled value's inputs. **Test.** A v5 artifact with PP primary and secondary assists yields a PP points line.

### D8 (P2, dormant) · Scratches cannot settle, and per-game ratios are scored as outcomes: M-PFC-127

- An unconditional skater output settles as 0 only with an explicit zero-TOI row (`settlement.ts:67-68,215-218`). A healthy scratch is not in the boxscore at all, so he stays unresolved. This is D1 in the other settlement path. A final boxscore with complete forward, defence and goalie lists proves absence for a player whose team identity is verified.
- Per-game `save_percentage` and `goals_against_average` are outcome values (`:204-207`). A five-minute relief stint with one goal is a 12.00 GAA and counts the same as a full game. Score the counts and form the ratio from totals.

**Tests.** A scratched skater in a complete final boxscore settles 0 for unconditional targets and stays excluded for conditional ones. Aggregate SV% from settled saves and shots equals Σ saves ÷ Σ shots.

### D9 (P2, dormant) · Participation shrinkage: M-PFC-128

1. Every season is divided by 82 (`season.py:3192,3198,3464`). The 48-, 56- and roughly 70-game seasons understate participation (56 of 56 games reads as 0.68) if the freeze includes them. The rookie path divides by 84 (`:3481`).
2. Only seasons with at least one game enter the denominator, so a fully missed season is invisible.
3. The prior is the **median** player-season rate (`:3202-3204`), used as the centre of a mean-type shrinkage estimate. Goalie start rates are bimodal, so the median sits between the starter and backup groups.
4. The pseudo-count is borrowed from the games-played rate policy (`:3465`), and the availability cut (1 − 0.5·injury − 0.7·scratch, `:3491-3496`) is unfitted (rule 12).
5. No recency decay, unlike the rate models.

**Fix.** Use each team's actual games per season as the denominator, the population mean (by role for goalies) as the prior, and a fitted pseudo-count and decay. **Tests.** A goalie who started 40 of 56 games in 2020-21 gets a start rate of 0.71 before shrinkage. Held-out calibration of play and start probability in ten bins with stated uncertainty.

### D10 (P2, dormant) · Variance can be silently zero: M-PFC-129

`variance × max(0, float(policy.get("intervalVarianceScale") or 0.0))` (`season.py:3331-3335`) gives variance 0, and so a zero-width interval, when the scale is missing. The Poisson floor (`max(variance, |rate|, 0.01)`) is sound for counts. The 2.25 prior-based factor is unfitted. Parameter uncertainty is left out, as W1-8 D5 found. **Fix.** Fail when the scale is absent. **Test.** A policy without the key raises, and no p10 equals p90 for a positive mean.

### D11 (P2, dormant) · Undefined ratios become 0: M-PFC-143, 144, 146, 148, 150, 152–154, 156, 160, 164–167

`reconcileProjectionValues` first turns every non-finite input into 0 (`contracts.ts:461-466`), then returns 0 for any ratio with a non-positive denominator (`:473-495,508-510,590-604,611-624`). GAA 0.00 is the best possible value, SV% .000 the worst; both are false. The ratio of expected totals is otherwise the right estimand for a season aggregate. **Fix.** Return null for an undefined ratio and for a missing primitive, and carry null through quantiles and the API (rule 5). Every reader of these fields needs a null path (rule 4): the projections page, the draft dashboard and the season editor. **Test.** `reconcileProjectionValues({}, "goalie")` returns null for SV%, GAA, start % and win %.

### D12 (P2, dormant) · Goalie heads are not reconciled to starts: M-PFC-167, 175, 179, 180

- Wins, losses, OTL and quality starts are independent rates (`contracts.ts:48-58,95`); nothing keeps W + L + OTL at or below games played, or quality starts at or below starts. Sampled draws can break both. Decision 46 requires W, regulation L, OTL and no-decision to reconcile to the start or appearance probability.
- `WIN_PERCENTAGE_GOALIE` is wins ÷ starts with relief wins in the numerator (`contracts.ts:491-495`). Call it "wins per start" or divide by decisions.
- `QUALITY_STARTS_GOALIE` inherits the non-Vollman label rule (W1-8 D9; decision 40).
- Note on 131: the default `reconcile_each_quantile=True` would add p10s to get a p10 of a sum. The one caller turns it off (`advanced.py:2108`). The TypeScript twin does reconcile each quantile first (`contracts.ts:632-634`), then repairs ratios with opposite endpoints.

**Fix.** Model decisions as one multinomial per appearance. **Test.** On every draw, W + L + OTL ≤ GP and QS ≤ GS; expected W + L + OTL + no-decision equals expected GP.

## 4. Owner questions (not answered by decisions 1–68)

1. **Completeness receipt for the ledger (D1).** Is "final game and WGO row count equals the official dressed count" enough proof to settle an absent player as did-not-play, or should the settle job read the stored boxscore payload?
2. **Unassigned start share (D3).** When a team's start chances sum to less than 1, should RSO show the unassigned share on the team-game, or only flag the total as incomplete?
3. **Lead-day unit (D6).** Should the forecast horizon count NHL schedule dates in place of UTC days?
4. **Scoreboard audience.** No page in `web/` calls `/api/v1/forge/scoreboard`. Is it read outside the repo? That decides whether D1 is P1 or P0.

## 5. Limits

- No tests were run and no code was changed. Verdicts on 168–174 are structural only; no season artifact exists to evaluate.
- The ledger is a served subset, not every NHL goalie: 124 past `bridge_exact` team-games, of which 105 include the actual starter's row. The 10% and 12% figures describe those rows only (rule 1).
- The rounding simulation assumes continuous shares; real shares may sit on a coarser grid.
- I did not read `evaluator.ts` in full, the rookie translation, `_target_multiplier` or `fit_context`; 133–135 are judged on the named functions and their labels.
- Whether the season freeze contains shortened seasons (D9.1) was not checked.
- D7 is a reading of the support check, not a reproduced failure.

## 6. Reproduction

All queries ran against production on 2026-11-11 with `pg_stat_activity` showing 0 other active queries. No jsonb column was read.

```sql
-- Q1 ledger settlement state (D1)
select source, player_class, count(*),
  count(*) filter (where dressed is true), count(*) filter (where dressed is false),
  count(*) filter (where dressed is null and scheduled_at < now() - interval '3 days')
from forge_served_forecast_ledger group by 1, 2;

-- Q2 late data? Left-join the unresolved past rows of Q1 (sources bridge_exact, naive_season) to
--    wgo_goalie_stats (goalie_id, game_id) and wgo_skater_stats (player_id, game_id), with date
--    between served_date - 1 and served_date + 2. Matches: 0 for goalies and for skaters.

-- Q3 goalie expected against actual, all rows and scored rows (D1, D4)
select source, count(*), count(*) filter (where started),
  count(*) filter (where dressed and started is false),
  sum(start_probability), sum(start_probability) filter (where dressed),
  sum(exp_saves), sum(exp_saves) filter (where dressed), sum(act_saves),
  count(distinct (game_id, team_id)),
  count(distinct (game_id, team_id)) filter (where started)
from forge_served_forecast_ledger
where player_class = 'goalie' and scheduled_at < now() - interval '3 days'
  and source in ('bridge_exact', 'bridge_reaimed') group by 1;

-- Q4 start mass per served team-game (D2, D3)
with g as (select served_date, game_id, team_id, count(*) k, sum(start_probability) mass
  from forge_served_forecast_ledger
  where player_class = 'goalie' and source in ('bridge_exact', 'bridge_reaimed')
  group by 1, 2, 3)
select k, count(*), count(*) filter (where mass > 1.000001),
  count(*) filter (where mass < 0.999), count(*) filter (where mass < 0.9), min(mass), max(mass)
from g group by k;

-- Q5 dormant tables: n_live_tup from pg_stat_user_tables for player_forecast_season_%,
--    player_forecast_outputs, native_forecast_catalog_heads (all 0)
```

Rounding simulation: draw three uniform values, normalise to sum 1, round each to four decimals, count sums above 1.000001 (200,000 draws → 12.6%).
