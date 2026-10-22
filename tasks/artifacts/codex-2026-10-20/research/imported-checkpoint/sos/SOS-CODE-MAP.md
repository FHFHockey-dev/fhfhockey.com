# Strength-of-schedule code map

Read-only inspection, 2026-10-20. Application baseline supplied by lead: base `392c02af`, master `b630e0767`. Paths below are relative to `/workspace/shared/fhfhockey.com`. This is source evidence, not a claim about deployed behavior, populated data, model selection, or measured predictive improvement. No application, Git, dependency, provider, production, Vercel, or Supabase changes/calls were made. No application runtime or test suite was executed; one isolated pure-helper fixture was run outside the repository, as detailed below.

## Result

There is already an opponent/opponents'-opponents formula, but there is **no single consistent SOS contract** across the inspected surfaces. The underlying-stats page has a BCS-style points-percentage composite; the trends/legacy team page uses direct win percentage only; game predictions construct a separate recent-opponent power-rating adjustment; OMT describes raw upcoming opponent rates; FORGE already applies explicit matchup, goalie, pace, venue, and rest effects. A new multiplier pasted across those surfaces would risk inconsistent definitions and double counting.

A particularly actionable code-level concern is that the prediction-form adjustment assumes neutral power **50**, while the canonical producer centers the relevant ratings at **100**. This must be characterized before interpreting that adjustment or reusing it.

## 1. Existing record-based SOS and displayed surfaces

### Snapshot producer: common data, not a recursive rating

`web/pages/api/v1/db/update-team-sos.ts:226-241` fetches regular-season schedules once and standings at each requested date. For every occurrence of an opponent, `:268-285` adds that opponent's entire W/L/OTL record as of the snapshot date; repeat meetings repeat its record. Games dated **on or before** that date enter past, later dates enter future. Both buckets therefore use records known at the snapshot date, not future realized win records. The producer persists team records, opponent arrays with opponent/date, and aggregate opponent W/L/OTL (`:290-310`). It does not remove games against the focal team, require completed game status, or save per-opponent adjusted records.

This yields a valid descriptive question: “How good are these opponents now?” It is not the same as “How good were they before each historical meeting?” A same-day snapshot must not be assumed pregame-safe. Historic schedule reconstruction also uses the schedule fetched at run time, not necessarily the schedule version known then.

### Trends and older team-page SOS: direct wins only

`web/lib/trends/strengthOfSchedule.ts:53-59` uses W/(W+L+OTL), expressly not NHL points percentage. `:83-110` computes past and future values, pools their record denominators into combinedWinPct, and outputs 100×combinedWinPct as sosScore. `:117-172` provides separate canonical-team rankings with the same formula. Empty denominators return zero rather than unknown.

Readers: `/api/v1/trends/team-sos` reads the latest season snapshot and calls this function (`web/pages/api/v1/trends/team-sos.ts:24-50,65-89`). It does not honor a historic date selector in the inspected handler. `web/pages/statsPlaceholder.tsx:314-347` uses the canonical rankings. Thus “SOS” here excludes opponents' opponents.

### Underlying-stats SOS: BCS-style composite already implemented

`web/lib/underlying-stats/teamScheduleStrength.ts:134-149` defines NHL points percentage P=(2W+OTL)/(2(W+L+OTL)). For bucket b:

- Direct D_i,b is P from i's aggregate opponent record.
- Indirect I_i,b is the meeting-count-weighted mean of each opponent j's **own direct bucket** D_j,b (`:202-232`).
- SOS_i,b=(2D_i,b+I_i,b)/3, falling back to the available component (`:233-245`).
- Past and future are separately ranked (`:279-298`); overall sos is their unweighted arithmetic mean (`:309-322`).

The loader reads exact-date sos_standings plus games within ±14 days (`:505-538`). Schedule texture is separate: next-7/14 game counts, home/road, B2B, 3-in-4, rest advantage/disadvantage (`:430-467`). The merge appends SOS fields to team ratings, without changing those ratings (`web/lib/underlying-stats/teamLandingRatings.ts:277-308`). The actual page calls the labels “BCS-style” (`web/pages/underlying-stats/index.tsx:1188-1205`).

**Interpretation limitations:**

1. Direct ratios pool record denominators, so opponents with more games played receive additional weight beyond meeting count. Indirect is an average of ratios. These are different estimands.
2. No focal-team exclusions: i's results contribute to opponents' records, and paths i→j→i contribute indirectly. This is a finite two-hop calculation, not a converged recursive adjustment or a decontaminated RPI implementation.
3. For future, I averages opponents' **future-schedule difficulty**, rather than using opponents' historical opponent quality to estimate their present strength. That is remaining-schedule network context, not necessarily stronger evidence that the upcoming opponents are good.
4. A season-average past/future score is not a clean retrospective or upcoming SOS. Keep those outputs distinct.
5. Missing opponent snapshots are silently omitted from the indirect mean (`:223-228`); counts exist, but there is no per-component full-coverage admission gate.

## 2. Team power and CTPI are not schedule-adjusted team statistics

Canonical team power (`web/lib/power-ratings.ts`): raw NST/WGO rate sources (`:131-180`), last-25-game exponential decay with 10-game half-life (`:3-4,320-380`), early-season league shrinkage (`:503-521`), offense = .7z(xGF60)+.2z(SF60)+.1z(GF60), defense = -.7z(xGA60)-.2z(SA60)-.1z(GA60), pace=z(pace) (`:581-589`). Final main and subratings are centered at **100**, generally 100+15z (`:652-683`). No opponent quality enters these formulas.

The display team-power composite is a further different number: mean(off,def,pace)+1.5×(3−PP tier)+1.5×(3−PK tier), `web/lib/dashboard/teamContext.ts:27-40`. The dated opponent-strength index splits that composite into thirds only when ≥30 teams are present (`web/lib/teamOpponentStrength.ts:16-49`). It is reusable context, not a continuous corrected SOS.

CTPI (`web/lib/trends/ctpi.ts`) filters gp=1 and uses last-10 linear weights 1,.9,…,.1 (`:45-46,120-149,230-235`). After cross-team standardization, offense=.5xGF+.3HDCF+.2GF; defense=−.5xGA−.3HDCA−.2CA; ST=.55PPxGF−.45PKxGA; goalie=.4 season GSAx+.6 recent GSAx. Raw=.35 offense+.30 defense+.20 goalie+.15 ST+.10 PDO luck; score=50+15raw (`:291-321`). It contains no opponent ID or schedule correction. Only explicitly approved, versioned, nonempty CTPI is eligible for trusted consumers (`:3-18`).

The V2 candidate improves missingness/coverage, effective sample size and excludes PDO from the score, but is still not opponent-adjusted (`web/lib/trends/recentTeamFormV2.ts:3-10,64-69,107-112,171-241`). Do not present candidate availability as publication or model promotion.

## 3. Forecast context is a separate existing path

`web/lib/game-predictions/featureBuilder.ts:1091-1157` constructs recent-opponent strength from at most 10 prior team games and each opponent's power snapshot strictly **before that historical game**. It averages off/def/goalie/special (`:1082-1088`), unlike the display's off/def/pace+tier composite. Last-5 is calculated after dropping opponents missing power rows, which can differ from the raw recent-form window; a gap-aware join is needed for exact comparability.

Current adjustment formulas (`:1160-1208`):

- adjusted goal differential/game = raw + (opponent composite−50)/50.
- adjusted xGF share = clamp(raw + .05×(opponent composite−50)/50,0,1).

**Scale mismatch:** canonical ratings are centered at 100 (`power-ratings.ts:652-683`). A composite of 100 produces +1 GD/game and +.05 xGF share, not zero adjustment. It is not safe to “correct” coefficients without an offline characterization and evaluation. Equal offsets can cancel in a home-minus-away feature, but clipping, missingness, heterogeneous producer versions and interpretation remain relevant. This audit does not establish realized prediction harm.

**Verified source provenance and offline check:** `update-team-power-ratings.ts:221-222,316-323,359-363` passes calculateFinalRating output unmodified into team_power_ratings_daily. `featureBuilder.ts:2730-2737` selects the same columns, and `:2894` passes raw results directly to feature inputs; `:670-673` only converts finite numeric values. No 100→50 conversion occurs. The reader does not select calculation_version/source_through_date, so it cannot admit rows by canonical producer version. The standalone `verify-sos-scale.cjs` extracts/transpiles only the actual pure producer/consumer functions, without importing application modules. `SOS-SCALE-FIXTURE.json` records source hashes and passing arithmetic observations: neutral producer ratings/composite=100; raw GD=0 becomes1; raw xGF=.50 becomes.55. Home−away GD (.4−.2) stays .2; interior xGF (.55−.50) stays .05; clipped xGF (.98−.95) changes from .03 to0. Downstream subtracts home−away before vectorization (`featureBuilder.ts:1906-1920`), and learned training-set centering/scaling is applied (`baselineModel.ts:578-628`), so the per-team offset alone does not prove probability bias or predictive degradation. No model inference, calibration check, row-population claim, or live version check was performed.

**Retrieval coverage prerequisite:** the live-input loader requests only the latest 100 power rows across the entire league, without a team-specific historical bound/pagination (`featureBuilder.ts:2730-2737`), while this feature needs dated opponents’ snapshots from prior meetings. It can therefore omit older required snapshots even when they exist. Characterize this with bounded fixtures before reusing the recent-opponent features.

The baseline's feature list contains raw form, CTPI, opponent composite, opponent-adjusted form and FORGE projection differences (`web/lib/game-predictions/baselineModel.ts:22-58`). This establishes a source-code input path, not that all are selected in the deployed champion. `featureBuilder.ts:702-710` provides a useful strict-prior selector, while date filtering alone does not prove original publication-time availability.

## 4. OMT is descriptive upcoming context, not a forecast scaler

`web/components/GameGrid/utils/useOpponentMetricsData.ts:74-105` averages raw GF/GA/xGF/xGA/SF/SA per game across selected week opponents, plus PTS/(2GP), and returns null unless every scheduled opponent has the metric. Current-season all-strength nst_team_stats is the source (`:140-165`); source-observation freshness/as-of safety is explicitly unknown (`:251-272`). This is not opponent-adjusted and has no opponents'-opponents component.

Existing safeguards are especially reusable: role/category-specific direction rather than a universal “easy” sign; high opponent shots help saves/blocks but hurt GA; all-strength rates cannot proxy PPP or SV% (`web/components/GameGrid/utils/opponentCategoryEffects.ts:24-56`). Generic strength inputs are explicitly disallowed as category factors (`:72-99`). The file already has effect-ownership/double-count detection (`:82-89`).

## 5. FORGE already applies opponent effects

The historical forge_team_game_strength table contains raw summed player shots/goals/TOI by manpower, not schedule-adjusted strength despite its name (`web/lib/projections/derived/buildStrengthTablesV2.ts:365-402`). Raw team history queries exclude the cutoff date (`web/lib/projections/queries/team-context-queries.ts:39-50,420-452`).

Forecast adjustments are explicit: team xGF, opponent xGA/save%, NST pace proxy, PDO, sample shrinkage and bounded shot/goal/assist multipliers (`web/lib/projections/calculators/skater-adjustments.ts:221-295`), plus opponent goalie and rest/venue context (`:298-402`). These multiply skater rate/conversion forecasts directly (`web/lib/projections/stages/skater-stage.ts:2097-2116,2148-2161`). Goalie shots/win context also uses opponent offense/defense priors (`web/lib/projections/calculators/team-context-adjustments.ts:30-100`) and further rest/home/ST/NST effects (`web/lib/projections/stages/goalie-stage.ts:281-287,333-339`). No record-based OOW input was found in these bounded stage/calculator paths.

Do not apply an additional generic opponent/pace/rest/goalie factor to a FORGE-derived output without attributing and ablating effects already present. Preserve neutral baseline vs today's matchup-conditioned forecast as separate objects.

## 6. Legacy duplication not to revive

`web/lib/supabase/Upserts/fetchPowerRankings.js:849-941` has another SOS: average l_ten_pts_pct from power_rankings_store, with past rows date≤cutoff and **future rows date≥cutoff**. It is not OOW, weights returned history rows rather than scheduled repetitions, and is unsuitable for pregame backtests. Its route is a 410 quarantine stub (`web/pages/api/v1/db/update-power-rankings.ts:20-32`). The alternate `update-team-power-ratings-new.ts` is a no-write quarantine stub. Do not add parallel writers or treat retained source as active ownership.

## Recommended reuse boundary

Reuse canonical game/team identity, retained cutoff-safe game facts, dated power/CTPI provenance, existing SOS opponent arrays where verified, and texture/coverage/effect-ownership patterns. Define one versioned **raw record SOS** and an independently evaluated **latent/opponent-adjusted team strength** module; expose past vs next-N/remaining schedule explicitly. Freeze a cutoff for every evaluation. Resolve win% vs NHL points%, meeting vs pooled-denominator weights, focal-team exclusions, early-season shrinkage and missing-source gates before selecting coefficients. Compare OWP-only, existing two-hop, and recursive/shrinkage challengers offline; keep outcome adjustment separate from fantasy category context.

Nearest existing tests: `web/lib/underlying-stats/teamScheduleStrength.test.ts:8-128`, `web/lib/trends/strengthOfSchedule.test.ts:29-69`, `web/lib/game-predictions/featureBuilder.test.ts:979-1127`, and OMT tests beside the hook. They were inspected by name/source only, not executed.
