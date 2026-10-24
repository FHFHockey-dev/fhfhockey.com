# Evidence inventory and integration recommendation

This is a local research packet, not production formula approval or NHL predictive qualification. Reuse the October20 work; do not restart broad method research.

## Recommendation and the three time meanings

Use a per-fixture opponent-quality mean as the interpretive baseline. Compare excluded opponent records, the specified RPI-style blend and schedule-adjusted opponent ratings under the same cutoff/cohort contract. Keep team quality, opponent difficulty and opportunity volume distinct. No method is universally best here.

The first offline comparison uses final-win credit because it is complementary. Keep standings points credit and regulation-equivalent credit as separately labeled sensitivities. TJ must choose the headline meaning before coefficients are tuned: standings achievement, eventual-win difficulty and fantasy category opportunity are different targets. Demonstration prior strengths are not production recommendations.

The implementable past default is explicitly **retrospective at cutoff t**: evaluate opponents in the selected past fixtures using results available before t. This may use results later than those fixtures. **Faced then** instead requires each fixture's actual retained pregame snapshot; missing snapshots remain unavailable. **Future as of t** changes only the outer fixture list and freezes every rating, second-hop historical mix and schedule revision at information known before t. That is an as-of estimate, not proven predictive skill. Full definitions are in [CONTRACT.md](CONTRACT.md).

## Existing research and PRDs actually inspected

Paths in this inventory refer to `/Users/tim/Code/fhfhockey.com`. Historical data counts, releases and validation claims are source lineage, not fresh production observations.

| File | What is reused / limitation |
|---|---|
| [SOS-METHODS.md](../codex-2026-10-20/research/imported-checkpoint/sos/SOS-METHODS.md) | Team quality versus schedule, temporal/exclusion rules, record/BT/Colley candidates, category distinctions and walk-forward gates. |
| [FHFH-SOS-AND-MATCHUP-RESEARCH-2026-10-20.md](../codex-2026-10-20/research/imported-checkpoint/sos/FHFH-SOS-AND-MATCHUP-RESEARCH-2026-10-20.md) | Consolidated memo/code map and findings; duplicated content is not independent evidence. |
| [SOS-CODE-MAP.md](../codex-2026-10-20/research/imported-checkpoint/sos/SOS-CODE-MAP.md) | Existing divergent SoS definitions, source units, FORGE effect ownership and missing historical provenance. |
| [SOS-SYNTHETIC.md](../codex-2026-10-20/research/imported-checkpoint/sos/SOS-SYNTHETIC.md), [sos_synthetic.py](../codex-2026-10-20/research/imported-checkpoint/sos/sos_synthetic.py) | Fifteen retained exact-arithmetic tests. The unchanged pure class prefix is reused and pinned in CORE-PROVENANCE.json. |
| [SOS-DEFINITION-FIXTURE.json](../codex-2026-10-20/research/imported-checkpoint/sos/SOS-DEFINITION-FIXTURE.json), [SOS-SCALE-FIXTURE.json](../codex-2026-10-20/research/imported-checkpoint/sos/SOS-SCALE-FIXTURE.json) | Retained synthetic evidence of incompatible win%/points% rankings and a100-centered producer/50-centered feature. No new production-harm claim. |
| [benchmark.mjs](../codex-2026-10-20/research/sos/benchmark.mjs), [results.json](../codex-2026-10-20/research/sos/results.json) | Existing synthetic RPI, ridge BT and Colley comparison. Reuse its methodology lineage; its results are not NHL evidence. |
| [Landing-page SoS PRD](../../TASKS/three-pillars-analytics/underlying-stats/prd/prd-underlying-stats-landing-page-sos.md), [task list](../../TASKS/three-pillars-analytics/underlying-stats/tasks-prd-underlying-stats-landing-page-sos.md) | Original50/50 design. The July29 overlay points to the successor roadmap as current authority. |
| [Historical final formula](../underlying-stats-sos-final-formula.md) | April100-centered50/50 formula is historical; do not revive its coefficients or scale as current behavior. |
| [Power-rankings roadmap](../../TASKS/three-pillars-analytics/underlying-stats/tasks-underlying-stats-power-rankings-roadmap.md) | Later separate past/future BCS-style record values; schedule texture remains separate. |
| [Roster/SoS prediction task list](../../TASKS/nhl-game-prediction-model/tasks-prd-nhl-game-prediction-roster-sos-model.md) | Feature lineage and historical promotion gates. Old live counts and performance figures were not refreshed. |
| [Game Grid revamp plan](../../TASKS/three-pillars-analytics/underlying-stats/game-grid/game-grid-revamp-plan.md) | 4WG/OMT/display lineage, not a current UI editing lease or SoS score approval. |
| [Team-strength fix handoff](../../handoff-2026-10-20/diaries/fix-forge-team-strength.md) | Sign/row-selection fixes and latest-only historical-source concerns; separate from a new estimator. |

A thread catalog mentions `FHFH-Game-Grid-Scores-PLAN-v2.md`, but the exact file was not found in the bounded relevant repo search. It was not treated as an inspected source. Actual score code below supplies the current arithmetic.

## Current source observations

- `web/lib/underlying-stats/teamScheduleStrength.ts`: points-percentage direct term pools opponents' record denominators. `computeScheduleBucket` averages each opponent's same-bucket direct value, drops missing indirect entries and falls back to whichever component exists. The future indirect term therefore uses opponents' **future schedule** context. It is not the specified historical-quality second hop. Its equal-value ranking is sequential rather than candidate competition ties. Source existence is not a claim about current deployment.
- `web/pages/api/v1/db/update-team-sos.ts` and `web/lib/trends/strengthOfSchedule.ts` are separate paths in the existing code map. Preaggregated records cannot recover focal exclusions, result publication revisions or a consistent per-fixture estimand. Do not manufacture histories from totals.
- `web/components/GameGrid/utils/calcWeekScore.ts` declares `schedule-v2-crowding-0.25`: `6*(GP-leagueGames/16) + 4*offNights + matchupBonus + crowding`. MatchupBonus is the mean centered win-odds contribution over all included games, unknowns neutral, bounded[-.5,.5]. Crowding is one horizon-level adjustment bounded[-.25,.25]. Zero games return-100. This is preserved.
- `web/components/GameGrid/utils/scheduleOpportunity.ts` computes `GP+.25*offNights`. Raw opponent xGF/xGA per game and xGA bands are descriptive context, not automatically opponent-adjusted OFF/DEF or SoS.
- `web/components/GameGrid/utils/opponentCategoryEffects.ts` is the existing category-direction/effect-ownership boundary documented in the code map. FORGE's `skater-adjustments.ts`, `team-context-adjustments.ts` and stage consumers have separate opponent/pace/goalie/rest effects in documented paths. Any later integration must inspect the **selected release version**, not presume every historical/experimental effect is deployed.

No listed application file was changed. READ-SOURCE-PINS.json records the reviewed evidence bytes; no assertion is made about unrelated concurrent changes.

## Deeper findings

RPI's two hops are dependent record summaries, not a fitted latent-strength objective. Strict focal exclusion removes self feedback but also removes information and can disconnect early schedules. It is a design tradeoff requiring empirical comparison.

The existing JS benchmark generates outcomes from a BT log-strength model; success of that family under its own generator is not NHL superiority. Other ratings use a fixed, uncalibrated `sigmoid(4*(ratingA-ratingB))` mapping. Mapping schedule difficulty to a team's own win probability is also a different estimand, so that comparison cannot select a SoS formula by itself.

The old benchmark's [0,1] Colley assertion holds only for its selected scenarios. Our unbalanced chain yields approximately1.226 and−.226, with a tiny matrix residual. A bound or clamp would conceal valid index behavior. Colley is included as a transparent deterministic adjustment benchmark, not a calibrated probability model or chosen future production model.

## Primary-source checks and transfer limits

Reopened the [2018 NCAA hockey memorandum, p.3](https://ncaaorg.s3.amazonaws.com/championships/sports/icehockey/d3/common/2018-20DIIIMWIH_Selections_Pilot_Program.pdf): it documents historical standard25/50/25 RPI, schedule-only2/3 OWP+1/3 OOWP, OWP head-to-head exclusion and distinct hockey weights. Our stronger second-hop exclusion is a specified FHFH variant. College tournament methods, including basketball/football and college hockey, are **not NHL predictive validation** or current NCAA-policy authority.

Reopened [Colley's original derivation](https://www.colleyrankings.com/matrate.pdf) and reproduced its one-game and five-team solutions. This verifies arithmetic, not NHL performance. The unbounded-chain result is this packet's synthetic derivation. NHL's [standings explanation](https://www.nhl.com/news/nhl-standings-are-tight-at-quarter-mark-of-2025-26-season) verifies the OT/SO-loss point fact used by the contract. Turner/Firth's JSS page in the inherited bibliography timed out on verification attempts; no new BT implementation or new paper-derived claim depends on it.

Only bounded public methodology/reference reads occurred. No sports-data API, production database, paid provider or capture was called.

## Retained local data

Inspected `tasks/artifacts/game-grid-lane-2026-10-18/crowding-experiment/schedule-2025-03-17_04-07.json`:22 dates,32 team calendar entries, described as a frozen TJ Schedule Planner export. It contains opponent/home cells, without canonical game IDs, exact kickoffs, result-availability revisions or verified historical as-of provenance. It is unsuitable for this contract's NHL backtest. No invented IDs or availability times were attached. Existing SoS fixtures are synthetic. The bounded inventory found no qualified full-cohort ledger; it does not establish that none exists elsewhere.

## Minimal future integration and decision gates

1. **Adapter first.** A separately assigned owner supplies a pinned game-level adapter with canonical identity, event/availability timestamps, complete cohort and retained schedule revisions. Use authorized retained local history if suitable. New production reads/backfills/captures require a separate bounded authorization. Keep existing formulas throughout review.
2. **4WG separate difficulty.** Display per-fixture opponent difficulty, cutoff, horizon, outcome definition and coverage beside unchanged `Opportunity=GP+.25*ON`. Combine weeks by fixture weights, not by an unweighted average of weekly means. No-games is null; missing coverage differs from prior-only. Preserve OFF/DEF descriptive labels until genuinely adjusted category models qualify.
3. **WeekScore shadow comparison.** Freeze current numeric outputs as baseline. Test replacement of its existing matchup term with a separately approved bounded SoS component; do not add another generic opponent bonus on top of existing win odds. Preserve volume, ON and crowding while isolating the comparison. No coefficient or rank-to-percent mapping is chosen here.
4. **Effect ownership.** Attribute GP, ON/crowding, opponent attack/defense, goalie, venue/rest, own quality and lineup usability once each. Do not multiply matchup-conditioned FORGE outputs by another generic SoS factor. Opponent difficulty for a fixed reference team and the focal team's win odds are different questions. Stronger offense can help goalie saves while harming ratios; evaluate category-specific utility.
5. **Empirical qualification.** Freeze chronological train/tune/test windows and identical team-fixture support. Compare direct-only, RPI-style, global adjusted estimates and leave-focal-out adjusted estimates. Fit priors/calibration only on earlier data. Probability scoring requires a legitimate predictive mapping; evaluate fantasy category/decision utility separately. Report early/mid/late-season, low-GP/missingness/disconnected slices,1-week versus4-week horizons and paired time/team-week uncertainty. Predeclare practical improvement and tolerated regressions before using test results to select a model.

Required ablations: keep GP/ON/crowding fixed while opponent effects vary; current odds-only versus replacement-only (combined arm diagnostic only, to expose duplication); descriptive raw xG versus adjusted category rates; global versus focal-excluded estimates; outcome/prior sensitivities; identical-coverage failure slices. Repeating an identical opponent contribution over distinct fixtures changes volume but not average difficulty. Venue/rest must enter once if later used.

TJ decisions: headline purpose/outcome target, retrospective versus faced-then label, prior-only display policy, practical promotion gates and any WeekScore term replacement. Required evidence: trustworthy historical availability/schedules and equal-support NHL/category evaluation. UI, runtime integration and release remain with their existing owners.
