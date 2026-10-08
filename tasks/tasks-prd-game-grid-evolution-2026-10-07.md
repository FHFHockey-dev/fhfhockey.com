# Game Grid evolution: planning contract and implementation sequence

Date: 2026-10-07. Scope: planning only. Owner: Game Grid planning lane.

This document proposes expandable team rows and a research path for graded schedule opportunity and category-specific matchup strength. It authorizes no implementation, model promotion, ingestion, database change, provider transaction, push, deployment, flag change, or hosted write. FORGE, RSO, Start Chart and parser work remain paused. The separate visual owner handles the Best Players Available heading and corner radii.

## Brief PRD

**User outcome.** A fantasy GM can inspect a team's upcoming games, see available pregame category expectations for the rest of the selected week, understand schedule opportunity and opponent context, and identify missing or stale evidence without mistaking a team schedule rating for their own lineup or a player's ability.

**Minimal useful release.** Expandable team rows with upcoming game details, available category means and honest coverage, plus an explanation of the retained Week Score and visible slate sizes. Keep the retained ranking formula. Show unsupported categories as unavailable. A schedule-only expanded row is still useful when forecasts are unavailable; adding forecasts must not block the schedule display. Grade slate crowding in an offline challenger before allowing it to change rankings.

**Accepted constraints.** The retained Week Score has the strict comparisons 4GP/3ON > 4GP/1ON > 3GP/2ON at a common horizon and league schedule. Equal exact schedules should favor easier scoring opponents when comparable scoring evidence exists. Preserve these until the owner explicitly changes the contract. A league-wide slate proxy is not a calibrated probability of an open fantasy roster slot. O/U is context and a challenger comparator first. Pregame full-game means are not live remaining-game estimates.

**Excluded from the first release.** New personalized lineup optimization, acquisitions, provider writes, live rest-of-game forecasts, new market acquisition, new forecast training or publishing, automatic reconciliation of incompatible team/player models, and a universal all-category matchup score. This lane does not request cosmetic changes owned by the visual worker.

## Verified repository state and evidence boundary

Inspected repository: `/Users/tim/Code/fhfhockey.com`, branch `master`, HEAD `9b11d3607b5afe2d7c6dff6d6dd918c1bcff92c4`. Retained production reference supplied by the owner: `171116877633d537a39b2a3e168882913269d47f` ("Prioritize Week Score schedule volume and cap matchup bonus"). Both commits exist locally. The retained reference is **not an ancestor** of inspected HEAD; this is a source comparison, not evidence of the currently deployed revision. No hosted deployment was inspected.

The checkout differs materially from the retained reference. At inspected HEAD, `calcWeekScore.ts` averages non-null odds and adds `0.15 × averageWinOdds`, and its callers pass `calcWeightedOffNights`. The retained reference uses displayed integer off-night counts and `calculateMatchupBonus` bounded to ±0.5. Its `scheduleSummary.ts` and associated tests are absent at inspected HEAD. An implementation task must first choose and verify the approved starting revision; this document does not authorize restoring or cherry-picking code.

Pre-existing changes were preserved: `web/next-env.d.ts` and two untracked artifacts under `tasks/TASKS/lines-gdl-ingestion/` and `tasks/TASKS/nhl-game-prediction-model/`. No application source was edited by this lane. `mise-en-place.mdc` is absent; `AGENTS.md` and the actual `mise-en-place.md` were read. Repository-local `.agents`/`.codex` directories were absent. The accessibility and Supabase skill instructions were read. Parent creation requested GPT-6.1 Sol/xhigh; the parent reports no independent runtime inference verification. No children were spawned, avoiding the requirement that Chef's verified effort exceed every xhigh worker. The two audit owners are independent lanes coordinated by the parent.

### Architecture observed at inspected HEAD

| Surface/source | Observed contract | Consequence for this plan |
| --- | --- | --- |
| `web/pages/game-grid/index.tsx`, `[mode].tsx`, `dateRange.tsx` | Index redirects to 7-Day; mode accepts 7-Day/10-Day; custom range is a separate route. | Keep current routes and date controls; do not redefine a calendar week as a rolling interval by accident. |
| `web/components/GameGrid/GameGrid.tsx:146`, `:234`, `:557`, `:701`, `:937` | Owns date/exclusion state, weekly scores, four-week opponents/totals, summary score, and formula help. Desktop master, stacked and transposed renderers consume related data. | Add a focused adapter and shared detail content; avoid putting a forecast engine inside this already central component. |
| `web/components/GameGrid/utils/useSchedule.ts`, `useFourWeekSchedule.ts`, `useDateRangeTeamGrid.ts` | Separate schedule fetch paths; 10-Day appends next Monday–Wednesday; four-week fetching is independent of weekly day exclusions. | Define inclusion once for the new detail path; audit existing cross-view contracts before changing them. |
| `web/lib/NHL/client/index.ts:95`, `server/index.ts:460`, `web/pages/api/v1/schedule/[startDate].ts` | NHL schedule is transformed to team/day records, with date/state/type and optional `expected_goals` odds. API cache is 600 seconds. | Use canonical game IDs and actual dates; the simplified Game Grid payload lacks start time and venue. Preserve a schedule-only fallback if odds fail. |
| `web/lib/NHL/types.ts:282` | `GameData` has IDs, season, date, states, type, scores and odds. `WeekData` holds one game per team/day key. | A future detail DTO needs start time, venue and freshness. Use game arrays internally; a keyed day record cannot represent multiple games on one date without loss. |
| `web/components/GameGrid/utils/helper.ts`, `TotalGamesPerDayRow.tsx` | Integer off-night threshold is ≤8. Color bands distinguish ≤6, 7–8, ≥9. Existing weighted helper grades only off-nights, with 7 and 8 equal. | Distinguish binary ON count, visual band and continuous grade. A seven-game night is currently an ON even if colored as a medium night. |
| `web/components/GameGrid/TeamRow.tsx:124`, `DesktopMasterTable.tsx:1145`, `TransposedGrid.tsx` | Team surfaces navigate to Team HQ. Matchup cells expose Poisson tooltips. Layout orientation changes the direction of team rows. | Expansion needs its own native control and must preserve Team HQ navigation. In the transposed view, anchor details to the team header or a separate panel. |
| `web/components/GameGrid/utils/useOpponentMetricsData.ts` | Reads `nst_team_all` ordered by date, keeps first row per abbreviation, and computes week-one opponent rates. Null rates/missing opponents can become zero through the current reducer. | Do not use this output as an authoritative forecast/SoS input before the independent audit establishes season, cutoff, coverage and units. |
| `web/hooks/useTeamSummary.ts`, `GameGrid.tsx:612`, `utils/FourWeekGrid.tsx:105` | Current-season NHL point percentage feeds four-week opponent averages. Four-week score is centered GP + centered ON + inverted opponent point percentage. | This is a separate schedule summary heuristic, not the retained weekly score or a category-specific forecast. Preserve that distinction and await its audit. |
| `web/components/GameGrid/PDHC/PoissonHeatMap.tsx:123`, `utils/poissonHelpers.ts` | Heatmap reads legacy `expected_goals` directly by game ID, then builds an independent Poisson matrix. Its selected fields omit `updated_at` and model lineage. | Do not reuse the displayed matrix as validated fantasy-category uncertainty. The schema has an update timestamp, but the UI does not establish an as-of forecast contract. |
| `web/lib/game-predictions/publicPredictions.ts`, `featureSources.ts`, `web/pages/api/v1/game-predictions/latest.ts` | Public game predictions carry versions, computed time, stale-source warnings and captured market context. Category/strength fields are nullable. Market source policy already says comparator first until safe historical snapshots exist. | Candidate read-only serving seam; field existence does not prove available coverage, qualification or aligned definitions. Do not call generation/import/promotion routes from a read path. |
| `web/lib/homepageGameAnalytics.ts` | Existing read adapter distinguishes prediction context, projected goals, observed xG and shots, with freshness handling. | Reuse verified reader patterns where compatible; do not collapse measured xG into a future goals forecast. |
| `web/lib/player-forecasts/contracts.ts`, `contributions.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts` | Player means have conditioning, issued/cutoff times, revisions and per-target eligibility/missingness. `latest.ts` is admin-gated research access. | Public Game Grid must use an approved serving contract, not expose an admin route or bypass issued-revision admission. This lane does not reopen these systems. |

The table records code inspection, not successful data reads. No Supabase/provider credentials or live rows were inspected. Root `supabase/migrations/` contains the forecast foundation/history; do not invent a migration in another tree if a later authorized serving task needs schema work.

## Distinct quantities and one inclusion contract

Keep these quantities separately named in both code and UI:

1. **Schedule opportunity:** generic league slate size, games, ON count and a schedule score. It is comparable for teams over the same horizon; it does not know a GM's roster.
2. **Opponent environment:** category-specific ease versus a neutral opponent, holding focal team/player ability constant. This is what category-specific SoS measures.
3. **NHL category forecast:** expected team or player production given ability, role, opponent, venue and participation conditioning. This is not automatically usable fantasy production.
4. **Personalized started production:** forecast credit after actual roster slots, eligible positions, lineup locks, bench competition, matchup rules, acquisition limits/effective dates and goalie minimums. This requires the authorized RSO planning contract. Never infer it from NHL slate size alone.

A low slate count can increase generic opportunity while a particular roster still has no eligible open slot. An elite player on a crowded night may remain an automatic start. Neither case is a reason to alter the player's ability mean.

**Proposed detail inclusion contract:** key by `(seasonId, gameId, teamId)` and actual `gameDate`; use regular-season games for scoring; deduplicate league slate games once by canonical game ID and team appearances once per side. Resolve renamed franchises with season-appropriate identity. Retain displayable preseason/playoff games with their labels when the existing display permits them, but keep them outside a regular-season score/forecast horizon unless explicitly selected under a separately versioned policy.

Use the page's exact selected dates and explicit exclusions. Label a selected Monday–Sunday horizon "Rest of selected week"; 10-Day must say "Remaining selected 10-day window" and list next-week dates; custom intervals say "Remaining selected range". Provider matchup week numbers are labels, not a substitute for the interval. Weekly GP/ON displayed beside the expansion must derive from the same included game set or disclose that they are full-week values.

The first UI release must distinguish the retained score's selected/day-filtered schedule set from the strictly future forecast set when a game has already started today. For example, "Selected schedule: 3 games; pregame total: 2 not-started games" is honest; silently feeding a new future-only GP count into the retained score is a ranking change. Carry both ID sets in the DTO if they differ, with one canonical schedule source. Audit-backed type/status/window corrections may legitimately change inputs; review/version those separately from new score coefficients and continue to prove guarantees against the corrected counts.

For rest-of-week **pregame** totals, include only future, not-yet-started games with a validated start timestamp and eligible schedule state at `asOf`. Keep started, completed, cancelled and postponed/unscheduled games visible as status context but exclude them from future means. Do not subtract elapsed time or observed goals from a pregame full-game mean. An in-progress game says "Started — pregame estimate excluded from remaining total"; completed games show result separately. If start time/state cannot be established, mark remaining coverage incomplete rather than assume the game is still future.

Use source `gameDate` for the league day bucket and an explicitly labeled display timezone for clock times. Do not derive slate dates by truncating UTC start times. Keep date-only controls inclusive of Sunday; serialize actual dates instead of comparing week numbers across years. Select the source date-calendar and display timezone policy before implementation; personal fantasy lock time belongs to the personalized view. Count the original full league slate at the decision cutoff, including earlier games on that day, rather than making a late heavy night appear light as games finish. A schedule revision may change a postponement/date; a refresh must replace the whole dependent snapshot.

Unknown slate coverage is not `n=0`. A future game on a reported zero-game date is an inconsistency. Keep the game visible, mark the grade unavailable and exclude the grade from ranking until scope is complete. No scheduled games is a valid zero opportunity state; no data is a distinct error/missing state.

## Retained Week Score and graded alternatives

### Retained release contract

For a common included horizon, `L` unique league games, `T=32` active NHL teams, `GP` team games and `ON` displayed integer off-night games:

```text
leagueAverageGP = 2L / T = L / 16
adjustedGP = GP - leagueAverageGP
S0 = 6 × adjustedGP + 4 × ON + M
M = average over all included games of (known percent odds / 100 - 0.5)
    with unknown games contributing 0; M stays within [-0.5, +0.5]
```

The retained source clamps finite odds to 0–100 and keeps null/nonfinite odds neutral using the total included-game denominator. UI must still show missing odds/coverage; a neutral computational fallback is not observed 50% probability. Preserve the old `-100` no-games sentinel at compatibility boundaries if required, but model it internally as `status=no_games`, never a poor forecast. If the active league changes, use verified `2L/T`; do not describe 16 as the number of fantasy teams.

`M` is an interim win-odds heuristic, not a validated probability of fantasy value. Higher win probability does not establish easier scoring: a low-event defensive favorite and a weaker team in a high-event matchup can have different goal opportunity. It is unsuitable as a universal G/A/SOG/HIT/BLK/PPP/goalie signal. Retain it only as the current bounded compatibility term until a validated scoring-environment replacement is approved.

The retained source's equal-schedule numerical guarantee is monotonicity in its supplied win-odds input; it does **not** establish the stronger semantic claim that actual easier scoring opponents always rank higher. Keep that distinction in release copy. The category-environment replacement below must satisfy the scoring-ease property when the evidence is aligned and comparable; missing evidence cannot fulfill that property through invention.

At `L=47`, the schedule portions are 18.375 (4GP/3ON), 10.375 (4GP/1ON), and 8.375 (3GP/2ON). At opposite matchup endpoints, the required differences are still +7 and +1. The common centering term cancels when comparing teams within the same horizon; scores across different horizons are not directly comparable expected points.

### Illustrative slate grade, not a fitted probability

For the current 32-team league, use `q(n)=(16-n)/15` as a transparent **offline reference only**, for a complete slate of `1 ≤ n ≤ 16` unique league games. With another team universe, version and redefine its maximum; reject out-of-range slates rather than clamp bad data silently.

| League games `n` | `q(n)` | Interpretation |
| --- | ---: | --- |
| 1 | 1.000 | Lightest reference slate |
| 2 | 0.933 | More generic room than 7 |
| 7 | 0.600 | Still ON by existing threshold; meaningful crowding |
| 8 | 0.533 | Existing ON boundary |
| 9 | 0.467 | Heavy by existing threshold |
| 16 | 0.000 | Most crowded reference slate |

This curve establishes direction only. It is not a probability that a player starts, expected usable GP, or a measured NHL/fantasy effect. Fit alternative monotone curves only with authorized historical evidence; retain the actual `n` in the UI. The ≤8 ON label and 7–8 color band need explicit wording, not an undisclosed threshold change.

| Candidate | Formula / use | Tradeoff and gate |
| --- | --- | --- |
| A: retained ranking plus visible grade | Keep `S0`; show per-game slate counts and `q`, and evaluate alternatives offline. | Recommended first release. Preserves prior rankings; grading is informative without promising extra ranking sensitivity. |
| B: bounded refinement | `S1 = S0 + εC`, where `C = 2 × mean(q(n)) - 1`, `ε=0.25`, over included team games. | Both required rankings survive even at opposite endpoints. Subtle grade; binary ON jump remains. New term requires owner approval, versioning and offline evaluation. Missing slate evidence yields no applied grade and a partial-coverage label, never synthetic `q`. |
| C: fully continuous opportunity | Illustrative `S2 = 6 × adjustedGP + 4 × sum(q(n)) + category matchup`. This replaces the ON term. | Removes the binary jump but can violate both guarantees. It cannot be promoted without an explicit new ranking contract. Coefficients are illustrative, not optimized. |
| D: personalized view later | Solve legal start assignments and sum admitted player-game category contributions under the provider/league constraints. | Most relevant to an individual GM; different input, permissions and validation scope. Do not quietly replace league-wide Week Score with this. |

For B, **±0.25 is the budget for the entire selected horizon**, whether 7 days, 10 days or a custom range; it is not ±0.25 per game or a separate allowance per calendar week. `C` is averaged across included games so adding games does not multiply the grading budget; GP already has its volume term. With `M` swing ≤1 and grading swing ≤0.5, the 8-point schedule gap stays ≥6.5 and the 2-point gap stays ≥0.5. A one-ON edge at equal GP stays ≥2.5. For exact equal schedules, the grade is equal and a supported, strictly increasing scoring-environment term can favor the easier opponents. Neutral/missing evidence cannot establish a strict ease comparison.

**Horizon-independent proof.** Let each compared team have any finite nonempty included game set after date/type/status/exclusion filtering. Complete valid slate inputs imply `0≤q≤1`; therefore their averages imply `-1≤C≤1`. If a grade cannot be applied because scope is incomplete, use applied grade 0 with a missingness label, also within the bound. Let both teams share the same selected league context `(L,T)` and score version. Subtracting their scores cancels `-6×2L/T`, giving `ΔS1 = 6ΔGP + 4ΔON + ΔM + εΔC`. Since `ΔM≥-1` and `εΔC≥-0.5`, the lower bounds are 6.5 for `(ΔGP,ΔON)=(0,2)`, 0.5 for `(1,-1)`, and 2.5 for `(0,1)`. The proof holds for **every finite supported 7/10/custom horizon and every common exclusion state**, not just the reference examples. It also covers missing matchup inputs, whose neutral contribution remains bounded. An exclusion state that removes all games yields the no-games state; a requested GP/ON comparison no longer applies to a team without those GP/ON counts. Different horizons, different team-specific league centering, per-target rescaling or score versions cannot use this guarantee.

Do not sum separate per-week grading allowances across a 10-day/custom range. Compute one mean and one budget over the exact selected included games. An unnormalized ±0.25 **per-game** term permits a grading swing of `0.25×(4+3)=1.75` in the 4/1 versus 3/2 comparison; combined with the matchup swing, the 2-point schedule edge could become `2-1-1.75=-0.75`. That design would violate the retained contract.

Retaining the GP/ON guarantees intentionally prioritizes the owner's simple schedule-ordering policy over allowing a more realistic crowding model to reorder those cases. B is a constrained refinement, not a claim that the more games/off-nights team has more actual starts on every roster. A personalized legal-start score may validly reverse these rankings, but must be separately named and evaluated. If the owner prefers realistic population/roster startability to dominate the generic ranking, D1 must change explicitly rather than hide that choice in coefficients.

Count crowding once. In B the binary ON bonus remains an explicit policy preference, and the only graded crowded-night adjustment is `εC`. Do not also pass legacy weighted ON, shrink GP by `q`, subtract a second bench-risk penalty, or multiply a category forecast already conditioned on actual starts by `q`. In C replace ON entirely with the continuous term. In D actual legal starts replace the generic proxy for personal totals. Rest/back-to-back/venue effects belong in one qualified forecast/environment term, not repeated in adjusted win odds and a separate bonus.

### Counterexamples the owner must see

The following use `6GP+4Σq` before the common league centering term, with matchup neutral. All slate values are unique-game counts; ON still means ≤8.

| Required comparison | First schedule | First continuous value | Second schedule | Second continuous value | Result |
| --- | --- | ---: | --- | ---: | --- |
| 4GP/3ON > 4GP/1ON | `[8,8,8,9]` | 32.267 | `[1,9,9,9]` | 33.600 | Reversed |
| 4GP/1ON > 3GP/2ON | `[8,16,16,16]` | 26.133 | `[1,2,9]` | 27.600 | Reversed |

These can coexist within common seven-day slates `[1,8,8,8,9,9,9]` and `[1,2,8,9,16,16,16]` respectively. They are not an artifact of comparing different league averages. Increasing a matchup coefficient cannot fix a schedule-policy contradiction.

If strict priority is mandatory but the owner wants more grade sensitivity than B, compare lexicographic schedule tiers with grading only inside an equal `(GP,ON)` tier. That limits continuous grading's influence and requires a clear rank/score display contract. Do not invent a tier order that claims more GP always wins: the owner specified particular comparisons, not every possible pair. Candidate B is the smallest complete numerical refinement with proven margins; candidate A is the smallest safe release.

### Score explanation and examples

Expose a focus/tap-accessible explanation containing the interval, included GP, league average, adjusted GP contribution, integer ON contribution, graded contribution if approved, bounded matchup contribution, coverage, formula version and `asOf`. Use the same decomposition object for the displayed score, rank and help text. Never format the score as a percentage. Example:

> Week Score 18.4: games +6.4, off-nights +12.0, matchup +0.0. Three of four upcoming matchups have usable scoring context; the missing matchup is neutral in the score. This is a schedule heuristic for the selected dates, not your roster's projected points.

The displayed components are rounded; compute/sort on full precision and offer exact values in detail. An unavailable component must say unavailable/neutral fallback, not imply a measured zero. Example retained reference: four games, three ON, `L=47`, odds `[60,60,60,null]` gives `M≈0.075` and `S0≈18.450` (the retained JavaScript formatter returns 18.4 for this value). Show coverage 3/4; rounding can obscure small differences and must not change ranks.

## Category-specific SoS and opponent environment

SoS should hold focal offensive/player ability constant and ask how this opponent changes a neutral team's category opportunity. Rank prospective opponent environments per category, not by generic point percentage or a win-moneyline favorite. Show a separate team-production forecast that includes focal ability. An easy opponent and a strong player are different explanations.

Proposed research baseline: estimate opponent category allowed rates from deduplicated, strength-state-specific prior games, with exposure-aware denominators and shrinkage toward a same-season prior. Use recency weights chosen with rolling validation; effective exposure/sample size must follow those weights. Model source/venue scorer effects only where historical evidence supports them. Estimate home/away, pace, rest, goalie/lineup information and PP/PK components once. If unavailable, omit the effect or use an explicitly labeled approved prior; never substitute zero.

For a scoring category `c`, estimate an opponent factor `m(o,c)=neutral-team expected category versus opponent / neutral-team expected category versus league-average opponent`, holding focal ability, exposure and credit definition fixed. A candidate bounded score term is `0.5 × mean(tanh(log(m(o,c))/s_c))`, with finite positive factor/denominator and scale `s_c>0` fixed from training data only. Reject unsupported/nonfinite factors rather than silently invent a floor. Unknown factors contribute neutral to the score but stay missing in the evidence/coverage record; divide score contribution by all included games. A comparable known easier scoring factor increases the term; finite-input monotonicity and bounds must be tested. This is a proposed calibrated environment input, not permission to use unqualified allowed-rate ratios as a forecast.

Show per-game category factors, a coverage-aware mean ease factor and projected total separately. Repeated opponents count once per scheduled game, not once per unique opponent. Separate raw schedule average from exposure/TOI-weighted player forecasts. Do not average ranks to obtain means or treat the mean of upcoming opponents as the league's underlying rate. Estimate league baselines from the correct team/game/exposure universe, not a schedule-weighted table labeled "league average".

| Category / use | Relevant opponent environment | Required caution |
| --- | --- | --- |
| G, A | Goals/xG allowed, shot quality/pace, goalie quality; assist-credit model for A | Goals, goals expected from shots and assist credits are distinct targets. A is not universally two assists per goal. |
| SOG | Opponent shots allowed, pace and focal role/TOI in the production forecast | Do not silently convert shot attempts (CF/FF) to shots on goal. Per-60 and per-game rates need correct exposure. |
| PPP | PP opportunities from opponent penalties and a qualified PK/PP matchup; participation/PP role for players | PPP = player PPG + PPA; a team's PP goals are not total PPP credits. All-strength allowed rates cannot stand in for PK defense. |
| HIT, BLK | Qualified event rates, possession/exposure and venue effects | Scoring ease/O/U has no guaranteed favorable direction; strong opposing pressure may raise block opportunity. Missing event history means unavailable. |
| PIM | Penalty-type/rate evidence and actual league scoring direction | More PIM is not intrinsically desirable in every format; do not infer it from total goals. |
| Goalies | Opponent goals/shots, likely starter, saves/GA/TOI and game-win context | More shots may help saves while hurting GA/ratios. Higher total goals is not uniformly favorable. Starter uncertainty and minimum-start rules are separate. |

Initial Week Score remains a clearly labeled schedule/skater-scoring heuristic. Later show category-specific ease/score views with explicit category choices; an all-category composite requires owner-approved category utility/weights. G/A/PPP share credits, so summing them with invented independent weights is not a validated composite. Do not reward both sides of a game with their win odds as if both imply favorable fantasy production: complementary win probabilities describe contest outcome. Both teams may have favorable scoring environments, but that requires separate team/category means and evidence.

### Team/player forecast reconciliation

An additive weekly team category mean is the sum of admitted per-game means for exactly the included future games. Do not sum per-game quantiles to form an interval. A weekly variance needs `sum variances + 2 sum covariances`; aggregate simulation needs an approved dependence model. Without that, provide means and per-game uncertainty or an explicitly qualified independent-game approximation that passed validation. A team-metric confidence band, a predictive outcome interval and uncertain forecast inputs must be named separately.

Reconcile a team mean with FORGE player means only when game identities, schedule revisions, `asOf`, full-game horizon, conditioning, inclusion roster and event-credit rules align. Unconditional player means can be summed; conditional-playing means need a valid appearance probability, and goalie conditional-start output needs a valid starter mixture. Apply participation once. A confirmed starter and a qualified unconditional mean are not a reason to multiply by start probability again.

| Identity to check | Condition for comparison |
| --- | --- |
| Team G versus summed player G | Same regulation + overtime scope; exclude the scoreboard shootout deciding goal from individual fantasy credit; include any goalie scoring credit or define a skater-only team target. |
| Team A versus player A | Team target is the sum of awarded assist credits, not goals or a constant multiple of goals. |
| Team SOG/HIT/BLK/PIM versus players | Source/event definitions align; explicitly account for unassigned/team events and roster coverage. |
| Team PPP versus players | Team target is summed PPG+PPA credits, not number of PP goals. |
| Team goalie quantities | All possible goalies and appearances/start mass align; do not infer starter identity from a team win forecast. |

Persist/show the difference and coverage by category; do not rescale a partial player roster to force equality. If a later approved hierarchical model allocates a team budget to players, document unallocated mass and validate that model separately. Missing forecasts remain missing. GAA and SV% are ratio targets requiring aligned GA/TOI and saves/shots exposure; do not sum or average percentages to obtain a team/week ratio, and distinguish ratio of expected exposures from expected random ratio. Goalies are outside the first expanded skater-total scope unless a serving contract is already admitted.

## Betting O/U: validation/challenger first

A total line is a priced threshold for the game's total, not automatically its expected mean. O/U alone supplies no unique `(home goals, away goals)` allocation: a total near 6 can be compatible with 3+3, 4+2 or many other splits. Moneyline/handicap and a declared joint score model could help a later inference, but that requires price/push/OT/shootout treatment and calibration. Do not split O/U 50/50 or multiply both teams by an "over boost".

The first release may show an existing admitted market snapshot as timestamped context, alongside a model's combined pregame goal mean and an explanation of their different definitions. It must not change Week Score or category totals. Retain provider/source, capture time, event start time at capture, available/recorded time where known, game/team mapping, total line, over/under prices, market period and book rules if available, and source URL. Never label model-computed win odds as market odds.

For each as-of comparison, select the latest valid snapshot **available by the decision cutoff**, with capture strictly before actual/scheduled start as applicable, correct game/team identity and matching market scope. Reuse the existing rejection logic in `espnOdds.ts`; additionally verify serving admission for the new use. Unknown capture/availability/rules or nonfinite/impossible prices are exclusion reasons, not usable historical observations. Preserve stale/suspended/not-posted/partial states. The owner/data contract must set a market freshness budget before any coefficient uses it; a schedule cache TTL is not that budget.

Coverage fallback: use the admitted non-market forecast if market context is absent/rejected/stale, displaying "Market unavailable" and `k/N` coverage. If no model forecast is admitted, show no forecast; O/U is not a replacement team category mean. Match odds, lines and prices within the same provider/capture snapshot. Handle integer-line pushes in any later probabilistic inversion and normalize bookmaker margin under a documented method, not a sum of raw implied probabilities.

Research ablations: (1) schedule only; (2) retained bounded heuristic; (3) category opponent environment without markets; (4) timestamped market comparator; (5) market-informed joint goal challenger. Test the challenger on the same eligible rows and also report total deployment coverage. A market/context-informed FORGE or team model already contains that information: do not reapply O/U, goalie, pace, venue or opponent factors downstream. Track an input/effect manifest per output and choose one adjustment layer. Do not let market availability itself reward a team or reweight only the easiest covered games.

HIT/BLK/PIM/goalie benefits require their own validated targets and signs. A combined goal total is not a universal fantasy advantage. No betting recommendations, transactions or new market collection are part of this task.

## Data and serving dependencies

Proposed minimal path: existing schedule reader → pure canonical inclusion adapter → bounded batch of **already admitted** team-category forecasts/context → team detail DTO → shared expandable content. Read failure should degrade a component, not erase usable schedule rows. No client expansion may launch a forecast/recompute or ingestion job.

| Dependency | Required serving contract / fallback |
| --- | --- |
| Schedule identity and scope | Game/date/team/type/state, scheduled start UTC, venue, source observation time, covered dates and schedule revision. Incomplete coverage shows unknown, distinct from a genuine bye. |
| Opponent rates/SoS | Same-season, as-of and strength-state/exposure provenance; shrinkage/prior version, effective sample, per-category availability. Await audit; no `nst_team_all` missing-to-zero inheritance. |
| Team category means | `gameId`, `teamId`, target, mean, units/credit definition, conditioning, forecast scope, cutoff/issued time, source watermark, model/version, allowed use and status. Start with available qualified targets only. |
| FORGE player contributions | Approved public/consumer reader with issued-revision admission and per-target coverage. Existing admin research route is not the public seam. This is a later dependency owned by its paused lane. |
| Market context | Existing pregame-safe, timestamped snapshot; unavailable/stale fallback above. Provider availability and historical depth have not been verified. |
| Uncertainty | Admitted distribution/quantiles with named interpretation and validation coverage; otherwise show input limitations and mean without an invented interval. |

A detail DTO should carry `horizon={startDate,endDate,includedGameIds,excludedDates,mode,dateCalendar,displayTimezone,asOf}`, `scheduleRevision`, `scoreVersion`, `scoreDecomposition`, a games array, and per-category `{status,mean,units,conditioning,scope,issuedAt,cutoffAt,modelVersion,sourceWatermark,coverage,limitations,uncertainty?}`. Game rows carry opponent, home/away, start time, venue, slate count, state and forecast references. Client-generated response time is not source freshness. Weekly total coverage includes both game count and target coverage; a known subtotal over 2/3 games says "Known subtotal, 2 of 3 games", not "Weekly total". The player-forecast contract currently declares a maximum horizon of 10; a longer custom range must stay schedule-only/partial outside the admitted forecast scope rather than extrapolate forecasts. The grading proof does not expand a reader's permitted horizon.

Prefer one bounded range read and request coalescing over queries for every logo/cell. Include date/mode/exclusions/season/schedule revision/source revision/formula version in caches. Public generic reads and personalized reads have different keys and access boundaries. Snapshot the response atomically; reject late responses after a horizon change, preserve expansion state during refresh, and mark stale cached content while revalidating. Sort/rank and open detail must use the same served snapshot. Set independent forecast/market/schedule freshness policies; invalidate on postponement/start/schedule revision. Define count/time budgets with the actual reader owner during implementation; no unbounded all-history fetch is a new serving design.

Public serving must use existing permitted server readers and expose only approved fields. Any later Supabase view/RPC/table change must first verify access/RLS and public projection boundaries under the active migration workflow; see [Supabase's Data API security guidance](https://supabase.com/docs/guides/api/securing-your-api). No such schema/access change is made or authorized here. The changelog Markdown fetch failed on content type; the HTML changelog was reviewed instead. No platform upgrade is proposed.

## Expandable row interaction and acceptance

Use a native button beside/in the team-logo area with a continuous accessible name such as "Show Carolina upcoming category forecasts", `aria-expanded` and an associated detail ID. Keep the separate Team HQ anchor; avoid a button nested inside a link and avoid making the entire table row clickable. Collapsed schedule density should remain useful. A desktop table uses a sibling detail row with correct `colSpan` across visible columns; stacked mobile uses the same detail content below its team row. Transposed orientation opens the same content from its team header into a clearly anchored panel rather than breaking column semantics. Decide that panel placement before implementation.

The behavior follows the [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/): Enter/Space toggle the button and `aria-expanded` tracks visibility. Native Tab order, visible focus, readable names and touch targets are required. Use a 44px touch target where space allows, with no overlapping hit areas. Expansion is not a modal and should not trap focus. Closing while focus is inside returns focus to its trigger; a context change that removes content must move focus to a stable heading/control. Tooltips must be readable by focus and tap; do not rely on hover/color alone.

Expanded content order: selected horizon and as-of/coverage → category summary (G/A/SOG/HIT/BLK/PPP, optional other targets) → game previews in actual chronological order → scoring/opponent explanation and limitations. Each preview shows actual date/time, opponent, home/away/venue, slate count, forecast source/age, category means and uncertainty if admitted. Keep match result, modeled pregame means, actual xG and market line distinctly labeled. Small totals use appropriate precision (usually one decimal for means), never imply a fractional realized stat.

Acceptance checklist for the later implementation:

- Keyboard and screen reader can open, traverse, close and return to the correct team across sorting; labels/expanded state update correctly. Verify touch at 320/375px, desktop and 200% zoom, with no clipped logos, focus rings, text or detail controls. Honor reduced motion.
- Multiple rows may be open, keyed by stable team identity rather than array index. Sorting keeps each detail with its team and preserves the user's open set and focus. Orientation changes preserve the open team; breakpoint changes do not duplicate fetched data or accessible IDs.
- A new date interval/season clears the old open set and prevents stale detail; same-horizon sort/refresh/exclusion/mode changes preserve open teams, recompute the complete detail snapshot and label the new horizon. If a team disappears, remove its expansion safely. Explicitly test 7→10-Day and back.
- Refresh announces one concise status, retains usable content with age while loading and distinguishes partial/error/unavailable. An older request cannot overwrite a newer horizon or revision. No auto-reordering during focus unless current explicit sort requires it; preserve focus on stable keyed controls.
- Bye/empty future schedule says "No upcoming games in this selection". Unknown schedule says unavailable/retry. All postponed games remain visible with their status and are absent from future totals unless a new time is qualified. Duplicate/rescheduled IDs do not double-count.
- Included/excluded games, midnight start, Sunday late game, next Monday, DST and year/season rollover obey the inclusion contract. Historical selections label historical/pregame snapshots correctly; without historical as-of evidence, do not display today's model as the forecast originally available then.
- Team forecast missingness is category-specific. Actual zero, no games, partial subtotal, absent source, stale source and invalid scope have distinct states. Team/player comparisons reject mismatched credit/conditioning/horizon rather than force a total.

Accessibility implementation/browser behavior has **not been verified** in this planning lane. These are release acceptance requirements, not an approval of current UI coverage.

## Reference fixtures, property tests and as-of evaluation

### Deterministic/property tests to add in an implementation lane

Extend the nearest Game Grid helper/score/sort tests instead of adding a duplicate framework. Preserve retained reference tests when choosing a production-compatible branch. Use bounded generated cases in Vitest if no property-test library exists; no dependency addition is required for these properties.

| Property / fixture | Required result |
| --- | --- |
| Schedule priority, opposite endpoints | At common `L`, 4/3 > 4/1 > 3/2 under all matchup and approved grade endpoint combinations; any equal-GP extra ON must win if that stronger retained guarantee remains contractual. |
| Slate direction | For known complete slates, replacing n=7 with n=2 increases grade; n=16 with n=8 increases grade; test every adjacent valid slate size. n=0/missing and out-of-range counts are invalid for a game. |
| Exact equal schedules | Same GP/ON/slates, same focal ability: a known easier scoring environment strictly improves its comparable category score; missing/saturated unsupported comparisons must not claim easier. |
| Score bounds / determinism | Matchup stays ±0.5, B grade stays ±0.25; finite outputs; input order/duplicate windows do not change score; displayed decomposition sums to unrounded score. No-games state is separate. |
| Missingness and coverage | Retained `[100,null]` / 2 gives +0.25 while exposing 1/2 coverage. Missing event category stays null; a real 0 remains 0. Reject future/stale/invalid sources without converting them to measured zero. |
| One game, two sides | League GP counts the game once; each team has one appearance. Repeated opponents on different game IDs count twice. Heavy-night/opponent/market effects appear once in the effect manifest. |
| Horizons and boundaries | Full calendar 7 days versus 10 days, explicit exclusions, late Sunday/next Monday, Dec–Jan week rollover, DST, different client timezones, season transition, duplicate IDs and game-date changes. Test actual dates, not weekday-only keys. |
| State and reconciliation | A game starts between requests; pregame mean leaves remaining total. Postponement changes schedule revision. Partial player roster/conditional means/shootout goal/PPP-credit mismatch cannot satisfy a team-total identity. |
| Interaction | Open state survives sorting/refresh/orientation, clears on new range, stale response cannot replace new range, keyboard/cell links do not trigger expansion, unknown/empty/error states stay distinct. |

Reference arithmetic verified in this lane: retained opposite-endpoint differences +7 and +1; two continuous counterexamples above; 28 equal-GP/extra-ON endpoint comparisons for GP 1–7 with ±0.25 grade still pass; B's 4/1 > 3/2 endpoint passes; retained missingness example passes. A second source diagnostic enumerated all 1,152 binary inclusion masks for 7/10-day horizons, including 912 with at least four included dates and 1,824 endpoint assertions for the two guarantees. It also checked 24 arbitrary-horizon/centering combinations. These numeric checks complement the all-finite-horizons algebraic proof; they do not enumerate every real schedule or custom interval. These are mathematical/source diagnostics, not a backtest or startability calibration.

### As-of backtest design

Freeze a manifest per decision cutoff: canonical schedule revision/known postponements, active season team universe, actual available source rows, strength-state/exposure definitions, lineup/starter claims and observed times, model/effect versions, and market capture **and availability** timestamps. A corrected final boxscore can be used as the declared settlement label, not as an input that was unknown at prediction time. Latest season-to-date aggregates cannot reconstruct earlier forecasts; current-only lineup sources and untimestamped legacy means are not historical evidence. If no as-of snapshot exists, mark that segment unevaluable and collect prospectively only under later authorization.

Use chronological rolling training/validation and a final untouched lockbox, with early-season/low-sample, normal/heavy/off slates, repeated opponents, home/away, confirmed/projected goalies, stale/missing markets and schedule disruptions reported separately. Fit shrinkage/lookback/grade curves/scales only in training. Version parameters and define success criteria before looking at the lockbox. Group uncertainty by game/week/team dependence rather than treating player/game rows as independent observations.

Compare A/B/C and opponent/market ablations against the retained reference. Measure ranking churn and every guarantee violation separately from forecast skill. For category means use MAE/bias and appropriate count/distribution scores if an actual distribution is served; check empirical interval coverage only for admitted intervals. Win-probability calibration/Brier/log-loss evaluate win probabilities, not Week Score. Report target definitions, rows/games/weeks, data age, coverage and selection losses for every result.

For a generic slate curve, synthetic roster simulations can test plausibility across slot counts/positions but cannot validate actual start probabilities. Real personalized value requires consented/frozen roster configurations, eligibility, locks, acquisitions and goalie minimums at each cutoff, evaluated through legal assignments. Compare unused scheduled GP/started GP and category contribution regret under that contract; keep synthetic and observed results labeled separately. Do not fit a population curve on one convenient fantasy roster and call it league-wide probability.

Release gates: all retained guarantees pass for A/B; no future/post-start inputs; coverage/missingness and credit identities pass; no hidden double-counting; category model validation improves a predeclared relevant baseline on the lockbox with uncertainty reported; market challenger improves over non-market on common rows without concealing coverage loss; keyboard/mobile/state tests pass. The owner/model owner must approve numerical calibration/coverage/freshness thresholds before promotion. An attractive UI or a few examples are insufficient to promote a probability model.

## Owner decisions and audit integration gate

| Decision | Proposed default | What changes if another choice is approved |
| --- | --- | --- |
| D1: priority versus continuous grade | Keep both prior strict comparisons; ship A, evaluate B. | C needs explicit permission to relax guarantees; show expected reversal cases and ranking churn first. |
| D2: numerical grading budget | B is a ±0.25 reference candidate only. | A larger budget must re-prove priority margins; do not silently retune volume/ON/matchup weights. |
| D3: scoring target | Generic schedule/skater-scoring view, separate category ease. | Custom category utility or goalie score is separately named and validated. No universal favorable-opponent sign. |
| D4: horizon/calendar | Page-selected dates with explicit source date calendar and display timezone; future games only for remaining means. | Provider matchup calendars/personal lock rules belong to a personalized contract. Confirm calendar/display policy before implementation. |
| D5: initial category availability | Available qualified means plus explicit missing/partial states. | A requirement for complete G/A/SOG/HIT/BLK/PPP needs source/serving qualification work first. Do not block useful schedule expansion on unsupported totals. |
| D6: market use | Timestamped comparator/context only. | Feature use requires safe historical/prospective evidence, no-double-counting proof and model-owner approval. |
| D7: uncertainty | Source-supported per-game uncertainty; no invented weekly interval. | Weekly distributions require validated dependence/aggregation and aligned player/team conditioning. |
| D8: transposed detail placement | Team-header button opening an anchored shared panel. | Alternative interaction must retain semantic table/navigation contracts and pass accessibility tests. |
| D9: ON threshold | Retain ≤8 for the binary ON count and explain the 7–8 visual band. | Calling an 8-game slate "heavy" in the new UI would require an explicit threshold/label decision; grading 8 below 2 and above 16 needs no threshold change. |

These are decisions for a later authorized implementation/research task. This plan chooses safe defaults for sequencing but does not request or infer approval to execute them.

The parent was asked for both independent audits before table-specific recommendations and relayed their findings. Opponent audit thread: `01a116e6-cfea-7629-bc54-91bedeab50f6`; report read directly at `/tmp/opponent-metrics-audit-20261007/report.md`, including its revision-comparison addendum. Four-week audit thread: `01a116ef-2204-73a5-ac7c-14c7edc6a0e8`; final report read at `/tmp/four-week-grid-audit-20261007/report.md`. Both final reports are integrated below. These audits compare inspected `9b11d360…` against retained `171116877…`, not against hosted rows/deployments.

### OpponentMetricsTable: accepted planning prerequisites from the independent report

| Priority | Finding on both revisions | Narrow recommendation / preserved behavior |
| --- | --- | --- |
| P1 | Hook selects the latest row per abbreviation from `nst_team_all`; current writer requests a **single date** (`fd=td`) in counts mode, all strengths/both venues. Fixture daily xGF 1 then 9 uses 9, while the two-game rate is 5. No declared season/as-of bound. | Choose a declared season/recent-game/as-of window before claiming opponent strength. Verify historical row granularity first; use verified accumulated counts or a qualified bounded aggregate, not a naive sum of potentially mixed hosted rows. Writer evidence: `web/pages/api/Teams/nst-team-stats.ts:855`, `functions/api/fetch_team_table.py:69`. |
| P1 | Missing opponent/null metric/GP≤0 becomes 0 and stays in the scheduled-opponent denominator. Fixture known xGF 2 plus missing opponent displays 1; all missing displays 0. | Preserve null/invalid state per metric. Compute a valid-observation mean with explicit `k/N` coverage or suppress incomplete means. Keep score-neutral fallback separate from this displayed statistical mean. Correct this before sophisticated SoS. |
| P2 | W% actually computes points/(2GP). Six wins, 14 points, 10GP displays 70% rather than win percentage 60%. | Default to relabeling PTS% if point-based opponent strength remains intended; computing wins needs an explicit target/data choice. |
| P2 | Standalone tie colors depend on display sort; bottom-ten severity is reversed; tiny samples have overlapping good/bad bands. Desktop has corresponding tie/severity issues. | Derive color ranks independently from display sort, classify ties consistently, order severity correctly and make small-sample bands disjoint or neutral. Preserve numeric null-last sorting. No forced z-score rewrite. |
| Optimization | Source fetch depends on new `teamData` identity and downloads unbounded history; local API cap is 1000. | Fetch bounded season/as-of source stats independently of schedule-row identity; aggregate/average locally or through a reviewed server read. Do not presume the hosted cap or pagination completeness. |

**Retained-source fixes already present:** selected-period opponent input in 10-Day, regular-season filtering, excluded-day alignment, and removal of the outer-sort dependency from that input path. Those findings on `9b11d360…` are not new retained-production fixes. The hook/table/writer blobs match both revisions; the integration paths differ.

**Keep:** repeated opponents weighted once per scheduled matchup; each opponent normalized by its own historical GP before averaging future games; correct home/away identity; all-strength/both-venue descriptive metrics when labeled; valid per-game units; true numeric null-last sorting. The AVG row is a mean of displayed schedule-row averages, which is valid if labeled accordingly; it is not a pooled game rate or a literal league-team baseline for a new SoS model. Favorable xGA/GA/SA for skaters and low xGF/GF for goalie ratios can coexist; low SF is not universally best for saves. Improve context rather than invert signs indiscriminately.

Audit evidence reused after reading its report/source contracts: 16 hook/render diagnostics, 5 selected-window callback assertions, 17 revision assertions and 8 sortable-header tests passed according to the independent owner. They were not rerun by this lane. No hosted source incidence, legacy row mixtures or full retained browser execution was established.

### FourWeekGrid: accepted planning prerequisites from the final independent report

The final report records 31 isolated diagnostics (including two retained hook tests) and 13 nearest current-checkout tests passed while reproducing bugs and valid behavior on **both** source snapshots. Results were reused after reading the report, not rerun by this lane. APIs/database/CSS were mocked, and the aggregate callback was extracted from exact source; this is not hosted or visual verification. Prioritize window/status/missingness correctness before more sophisticated scoring.

- Accepted Wednesday `2026-10-07` start fetches Oct 7/12/19/26; Oct 12 overlaps and Nov 2 is omitted from a consecutive 28-day interval. Fixture: 4GP from 3 distinct game IDs, 26 covered dates rather than 28. Normal Monday navigation avoids the trigger. Select calendar-week normalization with matching labels or exact nonoverlapping seven-day windows; use canonical dates/game IDs. Because four-week calendar meaning is intentional, prefer a correctly labeled four-week calendar anchor after confirming the route contract. Do not blanket-reject non-Monday weekly deep links without checking existing selected-range consumers; date-control changes must preserve their accepted behavior. Deduplicating totals alone does not repair overlapping detail rows. Sources: `useFourWeekSchedule.ts:148` on inspected HEAD / `:130` retained, `date-func.tsx:81` on inspected HEAD and retained `GameGrid.tsx:408`.
- GP is regular-only but the **four-week** opponent collector includes preseason: one regular opponent at .8 plus one preseason at .2 yields 1GP/OPP .5. Align four-week opponent eligibility with its GP universe. The retained **selected-period** opponent path already has this fix; these are different paths.
- Missing standings becomes 0% OPP and gets easiest-opponent score credit; the reported fixture gets +0.30 relative to an otherwise equal known .6 opponent. Preserve missingness/coverage rather than assign a weak opponent. Shared summary/master score needs the same fallback policy.
- PPD/CNCL games count toward GP/OFF despite the status exclusion policy elsewhere (`web/lib/draftDashboard/scheduleMetrics.ts`). Establish one eligible schedule-state policy, retaining status display without counting these as usable opportunities.
- Correctly shaped but uncovered W4 (`coveredDates=[]`) becomes padded `0G/0O — No games`. Validate all expected source dates; distinguish an unavailable week from a covered bye. Reuse the coverage-checking pattern in `useScheduleRange` rather than equate missing dates with zeros. Sources: `useFourWeekSchedule.ts:58` on inspected HEAD / `:56` retained and `FourWeekGrid.tsx:532`.
- Equal metrics can receive arbitrary top/bottom colors dependent on incoming order. Apply a consistent tie/band policy rather than value-independent colors.

**Useful bounded optimization:** the hook requests odds and computes per-week Week Score that FourWeekGrid does not consume; its displayed four-week score is recomputed from centered GP/ON/OPP. After verifying all consumers, use the schedule-only read and remove unused odds/score work with a focused contract change. This can avoid up to four odds lookups on schedule API cache misses; no live latency gain was measured. Bounded parallel four-week fetches and cross-hook coalescing are optional measured follow-ups, with odds mode/date/revision in cache keys. Do not add a broad caching framework.

**Do not repeat a fixed issue:** raw mixed-type slate counting on local master is already corrected in the retained release. **Keep valid behavior:** repeated-opponent game weighting; GP edge exceeds the point-percentage swing in the four-week heuristic; two team records do not double-count the league slate; all-zero four-week teams are intentionally excluded while idle individual weeks are padded; stale completion guard works; tested Monday windows preserve date membership across US/EU DST and Dec–Jan in UTC/New York/Los Angeles/London/Auckland; the fixed four-week calendar is deliberately independent of weekly 7/10-Day and excluded-past-day controls and includes completed games. New remaining-week expansion must not redefine those four-week controls. Do not merge four-week point-percentage score into Week Score as a shortcut or multiply its fractional OPP term by 100. No actual alias-duplicate payload or production freshness incident was established; no speculative franchise merge or mandatory cancellation refactor is justified.

## Relevant Files

- `web/components/GameGrid/GameGrid.tsx` — horizon/exclusion state, data integration and all layouts; one integration owner.
- `web/components/GameGrid/DesktopMasterTable.tsx`, `TeamRow.tsx`, `TransposedGrid.tsx` — disclosure controls/detail placement and stable identity; one UI owner to avoid overlap.
- `web/components/GameGrid/utils/calcWeekScore.ts`, `calcWeekScore.test.js`, `helper.ts` — retained formula and any approved graded score; current checkout differs from production reference.
- `web/components/GameGrid/utils/useSchedule.ts`, `useFourWeekSchedule.ts`, `useDateRangeTeamGrid.ts`, `date-func.tsx`, `date-func.test.ts` — inclusion adapter seams and boundary tests; audit owner dependencies.
- `web/components/GameGrid/utils/useOpponentMetricsData.ts`, `OpponentMetricsTable.tsx`, `utils/FourWeekGrid.tsx`, `utils/fourWeekGridViews.ts`, `utils/fourWeekGridViews.test.ts`, `utils/FourWeekGrid.test.tsx` — independent audits; modifications only after evidence and authorization.
- `web/lib/NHL/server/index.ts`, `types.ts`, `web/pages/api/v1/schedule/[startDate].ts` — start/venue/source coverage contract if needed; avoid changing unrelated NHL API behavior.
- `web/lib/game-predictions/publicPredictions.ts`, `featureSources.ts`, `espnOdds.ts`, `publicPredictions.test.ts`, `web/pages/api/v1/game-predictions/latest.ts`, `web/lib/homepageGameAnalytics.ts` — candidate admitted game/context readers and market lineage; no generation path.
- `web/lib/player-forecasts/contracts.ts`, `contributions.ts`, `planningContributions.ts` — future aligned contribution contract; paused source owners retain ownership.
- `web/components/GameGrid/SortableHeaders.test.tsx`, `web/e2e/navigation.spec.ts`, `web/e2e/player-pickup.spec.ts` — existing integration/navigation fixtures to extend where applicable. A focused disclosure spec is reasonable if existing browser specs do not cover the behavior.

### Notes

- All implementation tasks below are unstarted. They are actionable scope for future authorization, not work performed in this lane.
- Task IDs are identifiers; dependencies determine order. Use one owner for shared Game Grid integration and UI files. Source/market research can run independently of UI after common contracts are frozen, with reports/artifacts owned separately. No new workers were launched here.
- Follow root `AGENTS.md` and more specific future instructions. Do not alter the visual owner's component/styles or the paused systems without a new assignment. If the approved baseline lacks newer serving modules, request a focused integration plan from their owners rather than cherry-pick the whole divergent branch.
- Commands run from `web/`; package authority is npm/lockfile and `.nvmrc` pins Node 22.11.0. Planned Vitest checks may use `npm test -- --run <paths>`; planned `npx tsc --noEmit` / `npm run lint` are for a later TypeScript implementation. Existing `npm run test:e2e -- <focused-spec>` is the browser entry point. Discovery alone does not prove browser behavior. No build/deployment is a routine gate.

## Tasks

- [ ] 1.0 Freeze the implementation contract and source baseline. **Owner:** lead/parent. **Dependencies:** independent audits and D1/D3/D4/D5; blocks score/table changes.
  - [ ] 1.1 Record approved starting commit and compare audited defects against the retained reference; preserve unrelated checkout work.
  - [ ] 1.2 Accept/reject each audit recommendation with its evidence; record valid no-change conclusions.
  - [ ] 1.3 Fix horizon, event-credit, category availability, score version and freshness budgets; retain A until B or another scheme is explicitly approved.
  - [ ] 1.4 In separately authorized narrow fixes, correct the accepted table source-window/missingness/label/rank issues and four-week window/type/status/coverage issues. Preserve already-correct retained selection and intentional calendar behavior; these correctness prerequisites precede advanced SoS.
- [ ] 2.0 Build the smallest admitted read contract. **Owner:** schedule/serving owner. **Depends on:** 1.3. **Owns:** narrow schedule/type/reader changes; no UI ownership.
  - [ ] 2.1 Produce canonical game arrays and coverage/revision identity with time/venue/state; test deduplication, exclusions, type and boundary rules.
  - [ ] 2.2 Adapt already admitted forecasts/context into the DTO, preserving per-target missingness/lineage; ensure request path cannot generate/publish anything.
  - [ ] 2.3 Implement bounded batched/coalesced reads and atomic refresh; validate empty/partial/stale/error behavior and public access boundaries. Keep unsupported categories unavailable.
- [ ] 3.0 Deliver expandable team rows and retained score explanation. **Owner:** Game Grid UI/integration owner. **Depends on:** 2; may develop fixture-only UI after 1.3.
  - [ ] 3.1 Implement shared detail content/native controls across desktop, stacked/mobile and transposed views; preserve Team HQ links and stable open state.
  - [ ] 3.2 Show correct horizon, per-game previews, available means/coverage, source freshness and qualified uncertainty; explain the retained score from one decomposition.
  - [ ] 3.3 Extend meaningful component/browser tests and verify keyboard, touch, zoom, sorting/refresh/postponement/boundary behavior with frozen fixtures. Release schedule-only/partial coverage if its labels are honest.
- [ ] 4.0 Qualify graded schedule and category SoS challengers offline. **Owner:** model research owner. **Depends on:** 1.3; independent of UI 3 after the common contract is fixed.
  - [ ] 4.1 Freeze as-of manifests and train/validation/lockbox partitions; inventory missing historical scope without backfilling future information.
  - [ ] 4.2 Compare A/B/C monotone slate curves and category opponent environments; prove required score properties and quantify coverage, forecast skill and rank reversals.
  - [ ] 4.3 Evaluate market comparator/ablation only on pregame-safe timestamped evidence; audit adjustment manifests for repeated effects. Report untestable targets/segments explicitly.
- [ ] 5.0 Review and release approved refinements separately. **Owner:** lead/model owner. **Depends on:** 3 verification for UI; 4 evidence plus explicit owner choice for scoring.
  - [ ] 5.1 Deliver local reviewed UI/data diff with checks; any later push/deployment requires its own authorization. Preserve retained score if research gates fail.
  - [ ] 5.2 Promote a versioned bounded score/category source only after owner approval and release checks; retain a tested prior-version fallback. No flag or hosted promotion occurs in this lane.
  - [ ] 5.3 Consider personalized started-production and aligned FORGE reconciliation as a separately authorized project after paused owners resume; do not make them prerequisites for the useful generic expansion.

## Verification performed and remaining limits

**Passed:** repository/commit/diff inspection; retained score source/tests inspected with `git show`; current checkout `npm test -- --run components/GameGrid/utils/calcWeekScore.test.js components/GameGrid/utils/calcWinOdds.test.js` (2 files, 8 tests); independent Node/TypeScript source arithmetic diagnostics (retained endpoints/missingness, 28 bounded-grade comparisons, GP-priority bound, continuous counterexamples, all 1,152 inclusion masks / 1,824 endpoint assertions and 24 arbitrary-horizon centering checks). Planning source references, npm command entries, Node pin, Markdown fences and unstarted task state were checked locally.

**Not run:** UI/browser/screen-reader tests, app typecheck/lint/build, backtest/model fit, hosted reads, data/coverage validation, ingestion/recompute/migrations, push/deployment. They are not justified by a planning-only artifact. Passing current tests does not establish retained production behavior: current score tests contain only one historical example, and the checkout's odds term can reverse the retained order.

**Pending for implementation/research:** approved source baseline, actual per-target forecast coverage/admission, timezone/threshold policy, market/forecast freshness thresholds and approved evaluation criteria. Both independent audit reports are integrated; no audit artifact remains pending. Hosted/deployed behavior remains unverified. All numbers for new grading are reference examples. No probability, predictive interval, performance gain or actual roster startability has been validated. HockeyViz deep-research reports were not imported as authority.
