# PK source audit and bounded model proposal

Prepared 2026-10-02. This is a read-only source investigation and design deliverable. No model was implemented, executed, activated, or published. No application, migration, database, forecast-plan, or existing owner file was changed. The only additions are this report and its evidence/fixture/manifest artifacts.

## Recommendation

Start with a local, offline **source qualification and situation reconciliation** slice. Do not append a PK term to the retained ES/PP model. Real PK inputs exist, but three independent problems remain: historically known availability is not established by current rows; upstream definitions disagree; and FORGE's current component taxonomy includes numerical skater disadvantages caused by empty nets.

After qualification, develop a separately identified shadow candidate using matching opportunity/rate components and a conserved all-strength prior. Keep the existing full-game consumer gate closed until its component contract is demonstrated. A separately released full-game per-appearance baseline can be a nearer RSO path, but it must be selected as a complete alternative source, never added to the component model.

Proposed identities: `pk-source-contract-v1`, `skater-situation-features-v2`, `forge-skater-opportunity-v2-shadow`, and `conserved-all-strength-prior-v1`. These are proposed names, not registered or approved versions. Definition hashes must include the source resolver, strength taxonomy, units, cutoff policy, configuration and conditioning. Retained v1 outputs stay attached to their original inputs and definitions.

## Evidence and scope

[evidence.json](evidence.json) contains exact SQL and normalized results for 22 successful read-only queries, including schema and source receipts. Inspection used explicit player IDs, team IDs/abbreviations, bounded dates, or exact raw game IDs. Relevant indexes were inspected: player/date keys on WGO/NST and rolling metrics; team/date and season/date keys on NST team logs. No production-wide coverage scan occurred. Queries were separate observations, not one atomic database snapshot.

The selected player IDs are 8476453, 8477939 and 8478402. The coverage interval is 2026-03-01 inclusive through 2026-04-16 exclusive, season 20252026. Historical availability cutoff is 2026-04-16T00:00:00Z. These are known audit examples, not a holdout or representative league sample.

| NHL player ID | WGO appearances | Positive WGO PK TOI | NST PK rows | Positive exposure lacking NST row | PK disagreements | NST insertions after historical cutoff |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 8476453 | 22 | 5 | 6 | 0 | 1 | 0 |
| 8477939 | 22 | 11 | 11 | 0 | 1 | 1 |
| 8478402 | 20 | 15 | 15 | 0 | 0 | 1 |

All 64 selected WGO appearances had non-null SH goals, assists, shots and TOI. Their WGO goal/assist and TOI partitions reconciled. NST all/EV/PP/PK totals reconciled for 31 appearances with all four rows. One additional PK appearance lacked at least one companion strength row. Missing NST PK rows occurred on 32 WGO zero-exposure appearances. An absent NST row must therefore remain distinct from an observed zero; WGO corroboration may support zero only under a verified source contract.

Observed PK evidence is not purely hypothetical: player 8476453 on 2026-03-21 has 11 PK seconds, one PK goal and one PK shot in both WGO and NST. Across the selected NST PK rows, the three players have respectively 114/327/905 exposure seconds and 1/0/0 goals. These small totals do not justify a fitted player-specific conversion rate without shrinkage and a declared sample rule.

Concrete conflicts:

- Player 8476453, 2026-03-03: WGO SH TOI = 0, NST PK TOI = 69 seconds, both with zero PK goals/assists/shots.
- Player 8477939, 2026-03-30: WGO SH TOI = 6, NST PK TOI = 75 seconds.
- PK rows for players 8477939 and 8478402 on 2026-04-13 were inserted on 2026-06-09. A game-date-only April backtest would admit unavailable rows.
- In the inspected FORGE materializations there are only 13 player rows in this 64-appearance window, four with missing PK exposure. Historical FORGE rows also disagree with WGO/NST; for example, 8476453 on March 17 has 40 PK seconds and one PK shot in FORGE, versus WGO zero and no NST PK row. Do not attribute old rows to today's code version without their producer receipt.

Team observations:

| Team / local ID | Calendar games in interval | NST PK matches | Missing calendar dates | FORGE team-strength rows |
| --- | ---: | ---: | ---: | ---: |
| TOR / 10 | 22 | 19 | 3 | 5 |
| TBL / 14 | 24 | 21 | 3 | 4 |
| UTA / 68 | 22 | 18 | 4 | 4 |

These denominators are scheduled regular-season game records, not independently certified completed games. They identify reconciliation work, not a definitive feed-completeness percentage. NST team PK rows have non-null TOI/SF/GF in the sample; TBL has one explicit zero-TOI row. Missing team observations must not be omitted when estimating mean team opportunity without reporting the denominator.

The current interval 2026-09-20 through October 1 has no selected-player NST PK rows, no selected-player rolling rows, and no NST PK team rows for TBL/TOR/UTA. WGO does have a current 8476453 October 1 appearance. This does not prove league-wide absence, but it rules out claiming current coverage from these samples.

## Exact source contracts and semantics

| Surface | Columns / role | Qualification required |
| --- | --- | --- |
| `public.wgo_skater_stats` | `player_id,date,season_id,game_id,games_played,team_abbrev,sh_goals,sh_assists,sh_shots,sh_time_on_ice`; EV/PP and full totals also present | GP=1, exact game/season/date/type binding; units; raw origin; historical team. No availability timestamp in inspected schema |
| `public.nst_gamelog_pk_counts` | `player_id,date_scraped,season,gp,toi,goals,total_assists,shots,created_at` | Same-row count/exposure pairing; exact game binding; zero/missing distinction; first insertion is not immutable correction lineage |
| `nst_gamelog_es_counts,pp_counts,as_counts,5v5_counts` | Same category counts and TOI, with schema differences | Reconcile complete component sets. AS and PP inspected schemas do not have `created_at`; do not borrow PK insertion time for them |
| `public.nst_team_gamelogs_pk_counts` | `team_abbreviation,date,season_id,gp,toi_seconds,sf,gf,created_at,updated_at` | Unique season/game team resolver, availability receipt, team clock units. Timestamps are without timezone; no assumed UTC conversion |
| `public.forge_player_game_strength` | Explicit game/player/team, ES/PP/PK TOI, shots/goals/assists | Producer/version and raw receipt; taxonomy qualification; missing exposure despite zero event values remains invalid for rate calculation |
| `public.forge_team_game_strength` | Explicit game/team, component TOI and shots/goals | TOI is summed player seconds in current builder, not wall-clock seconds. Coverage and matching player universe must be complete |
| `public.rolling_player_game_metrics` | `strength_state,game_date,player_id,season,game_id,team_id`, window totals and TOI | Derived/current mutable source; window and supported numerator/denominator qualification, pagination, original as-of lineage |
| `public.nhl_api_game_payloads_raw` | `id,game_id,endpoint,season_id,payload,payload_hash,fetched_at` | Exact endpoint, verified schema/finality/hash, eligible retained revision fetched before cutoff; do not choose an arbitrary/latest row |
| `gamelog_game_map` / `games` / historical roster receipts | Canonical game and season-correct team | Require exactly one agreeing game/team; never join UTA by abbreviation alone or use current player team historically |

In repository `fetchRollingPlayerAverages.ts:263`, `ev` maps to NST ES tables; `5v5` maps to distinct 5v5 tables. It is not a 5v5 alias. On 2026-04-15 player 8476453 has EV TOI 952 and 5v5 TOI 879; April 13 has EV goals 1 and 5v5 goals 0. Exact attribution to 3v3, 4v4, or empty-net situations requires event/shift evidence. The [NHL glossary](https://www.nhl.com/stats/glossary) identifies an even-strength ice-time measure, but does not certify NST's partition. The [Evolving-Hockey source glossary](https://evolving-hockey.com/glossary/general-terms/) explicitly distinguishes its equal-skater states and empty-net states; its definitions cannot be transplanted onto NST. NST's glossary could not be retrieved (robots exclusion); one bounded search alternative did not establish its complete empty-net contract.

FORGE code supplies a concrete different meaning. `derived/situation.ts:32` and `ingest/shifts.ts:97` compare only the two skater counts, ignoring the parsed goalie flags. Equal 3v3/4v4/5v5 maps to ES; 5v6 maps to PK for the five-skater team. This is numerical advantage, not demonstrated penalty status. `derived/buildStrengthTablesV2.ts` applies this resolver to individual shot/goal/assist events and sums player TOI into team totals.

Retained raw example: game 2025021076, March 17, TBL is away team 14. PBP row 596, event 1022, goal by 8476453 has situation `1560`: away goalie present/five skaters; home six skaters/no goalie. Current FORGE resolver would assign this event to away PK. WGO lists zero SH goals/SH shots and three EV goals for this appearance. The raw receipt was fetched April 1, hash `f3c4b24bda9c79126018c2e1fb044fffd628350eb25a3fdfb1c333cd40c3837c`. This demonstrates a definition mismatch, not a claim about the penalty sequence at that moment. In contrast, the March 21 PK goal has situation `1451` with both goalies present and four away skaters.

Consequently ES+PP+PK can be an exhaustive *numerical-skater* classification for valid situations while still being incompatible with NST/WGO penalty splits. Do not add overtime or empty-net totals as extra components if already included. Penalty shots, shootouts, invalid situations, missed events and unassigned shifts need explicit coverage/residual rules. Exact component sums in a small sample do not establish a universal partition.

The current FORGE builder's team TOI is summed player time. For TOR March 14 it is 2364 PK player seconds versus NST 450 team clock seconds. These are different units and taxonomies, not interchangeable denominators. Even a fixed division by four fails for 3v5, changing personnel, missing shifts, and numerical empty-net disadvantages.

## Existing model and consumer boundaries

- `queries/skater-queries.ts:101` reads rolling `ev|pp` only, strict game date before cutoff, with a 5000-row cap. Extending the union alone does not establish complete input retrieval. Latest WGO deployment also reads total/ES/PP only; its fallback total-minus-PP includes PK, so it must not seed a true EV opportunity after adding PK.
- `queries/team-context-queries.ts:39` reads ten FORGE team rows and ES/PP fields only. Its per-field non-null mean can use different row universes. New PK opportunities require a single qualified paired game cohort and an explicit missing-game receipt.
- `stages/skater-stage.ts:2356` reconciles ES/PP toward 60*60*5 player seconds. This budget absorbs omitted situations and ignores actual overtime/manpower changes. Do not add PK allocation on top. A new candidate needs a conserved opportunity budget derived from compatible situation durations.
- `seasonBootstrap.ts:147` blends full-strength G/A/S priors into ES+PP, then reconstructs ES as total minus PP and divides total shots between ES/PP. A later PK add would double-count prior mass.
- The stage emits null PK TOI/shots/goals/assists at lines 3066 onward. These nulls must remain in retained outputs. Do not retrofit zeros.
- `starterBoardScoring.ts:130` requires all ES/PP/PK target components; `rosterScheduleData/planning.ts:167` uses that complete adapter. Evaluation independently rejects incomplete all-strength source components at `evaluation.ts:353`. Preserve these safeguards and extend them to taxonomy/residual qualification for a new candidate.
- `baselineRates.ts` is a separate unvalidated full-game per-appearance candidate with immutable-input requirements and no participation adjustment. Its all-strength ability estimate needs no extra PK addition.
- `inputCapture.ts` already supports captured read transcripts and replay. A current captured receipt supports deterministic replay from capture onward; it does not establish that those values existed at an earlier prediction cutoff.
- `planningContributions.ts:175` and `contributions.ts:146` distinguish per-appearance means from participation-integrated game means. Preserve that distinction, issued game/roster/schedule identity, allowed-use flags, expiry and serving boundaries.

## Cutoff and historical identity contract

A source observation must retain canonical and NHL player IDs, exact game/season/team/opponent, situation taxonomy, target, count, matching exposure with units, original availability evidence, capturedAt, source row/revision IDs, source content hash and producer version.

Require game occurrence before the inference cutoff and source availability at/before cutoff. Same-day completed observations require a retained finality receipt before cutoff; a date-only predicate cannot establish intraday availability. For current WGO or mutable NST values, record availableAt as this capture's completion, not the game date or a presumed scraping time. `created_at <= cutoff` is necessary for a first-insert bound where available, but does not prove the current value survived unchanged since then.

PBP/boxscore/shift raw receipts for March audit examples were first retained April 1. They can support an April 16 engineering reconstruction if schema/hash/identity checks pass; they cannot be used as inputs for March 4 or March 22 forecasts. Landing endpoint has multiple incompatible-looking rows with null gameState, so endpoint name alone is not a schema/finality guarantee. Select an exact validated raw ID/hash, not the head of a current view.

Retain player-career continuity by NHL/canonical player identity; season/game team remains historical. Inspected alias rows map ARI 2000–2024 to local ID 59 and UTA 2025–2099 to 68, while `teams` identifies ARI=53, PHX=27, Utah Hockey Club=59, Mammoth=68. The alias is not independently sufficient for historical identity. Do not repair it here or assume local IDs universally match NHL IDs. Reject absent, overlapping or contradictory mappings; coordinate resolution with the separate goalie/team owner.

## Proposed opportunity/rate model

Use a versioned joint situation ledger retaining: skater configuration, both goalie-presence flags, penalty-strength evidence where available, period and regulation/OT, and disjoint event/shift IDs. Collapse to official-compatible EV/PP/PK only once the source definition and reconciliation are demonstrated. Otherwise retain numerical-strength names or an explicit other/unresolved bucket and make full-game output unavailable.

For each qualified component j:

- Player history: count K_j, matched exposure E_j in player seconds. Rate r_j = K_j/E_j; per60 = 3600*r_j. Never average per-game per60 values or combine WGO counts with disagreeing NST exposure.
- Experimental shrinkage: rhat_j = (K_j + tau_j*r0_j)/(E_j + tau_j), where r0_j is a cutoff-safe prior in events/player-second and tau_j is prior exposure in seconds. This is proposed arithmetic, not a calibrated policy. Fit/configure separately by target and situation; record population/prior hashes. Offline sensitivity grid may examine 60/300/900/1800 seconds, without adopting a chosen value on these known fixtures.
- Opportunity: estimate team PK wall-clock duration B_j from complete compatible team/opponent observations. Convert it to a player-time budget P_j using the observed manpower sequence, then allocate e_ij = a_ij*P_j across the complete conditional-playing roster, with nonnegative shares summing to one and player e_ij no greater than B_j. Preserve uncertainty/missing role evidence; do not infer PK usage from ES line or PP unit. Forecast conditional count mu_ij = rhat_ij*e_ij.
- Alternative without trustworthy team opportunity: model per-appearance PK count/exposure directly with a qualified appearance denominator. It is simpler and omits opponent/role opportunity adjustments. It still requires full appearance coverage, sparse-data shrinkage and coherent full-game prior allocation.
- Participation is applied once after component reconciliation: unconditional_game = p_play * sum_j(mu_ij). If a released source already integrates participation, the contribution resolver uses multiplier one. Availability penalties and p_play must not both discount the same ability. Unknown probability leaves conditional tie-break ability only if explicitly permitted.
- Goals must not exceed same-situation SOG expectation if the candidate uses a shot-conversion formulation. Assists need their own matched opportunity/rate evidence; do not multiply a player's shot rate by an invented assist factor. Complete roster and team shot/goal budgets must be tested under the declared model formulation.

### Conserved prior choices

**Recommended for the component candidate: partition the complete prior before blending.** For each target t, a complete all-strength prior T_t gets a nonnegative allocation vector q_tj whose sum over every included component, including other if needed, is exactly one. Shares come from qualified same-player previous-season counts or an explicitly configured cutoff-safe population prior; shares are target-specific. Unknown components cannot be dropped and remaining shares renormalized.

With organic complete components O_tj and complete prior mass, use M_tj = w_org*O_tj + w_prev*q_prev,tj*T_prev,t + w_fant*q_fant,tj*T_fant,t. The declared available weights sum to one. Thus sum_j M_tj equals the corresponding all-strength blend. Only complete prior allocation vectors may enter; a missing component leaves that prior source unavailable. Missing organic completeness leaves detailed full-game output unavailable rather than fabricating a mass.

Example for one complete prior: goals T=1.00, q=(EV .75, PP .20, PK .03, other .02) gives (.75,.20,.03,.02), sum 1.00. Taking the existing ES=.80, PP=.20 and adding PK=.03 would yield 1.03 and fail. Each approved opportunity modifier is applied within its component once; record the intentional total delta rather than silently renormalizing it away.

**Nearer RSO alternative: independent full-game baseline.** Use the existing all-strength per-appearance source as a complete alternative for each target. The contribution resolver selects it or detailed output under compatible conditioning; it never adds baseline and detailed components. This avoids split-prior estimation and can cover longer calendar horizons, but has no new PK role/opponent capability and still needs release, participation, serving and calibration decisions.

**Reject additive PK patch.** Leaving retained bootstrap and ES/PP opportunity budgets in place while adding PK duplicates all-strength priors and allocation time. Setting PK zero for non-PK players based on absent rows is equally unsupported.

Recommended next source priority is exact retained NHL event/shift reconstruction under an explicitly named taxonomy, checked against same-game full boxscores, with NST/WGO as independent reconciliation evidence. Until this is demonstrated, use each provider's matched count/exposure pairs only for provider-qualified diagnostics, not a silent hybrid.

## Exact implementation slice and validation plan

First bounded local slice: add a pure `pkSourceQualification.ts` and nearest regression test under the forecast owner's approval, using frozen input receipts only. It returns qualified component observations, coverage manifests, source conflicts and exclusion reasons. It must not generate model forecasts, change shared producers, write DB records or bypass existing serving flags. Add proposed version/config identities and a report exporter only after the source API stabilizes. Use a separate worktree with a reviewed copy of dirty dependencies.

Acceptance tests and offline fixtures are specified in [fixture-spec.json](fixture-spec.json). They cover:

1. Observed zero with positive exposure, verified zero exposure, missing row, null target, zero exposure with nonzero event, insufficient exposure, and mismatched providers.
2. EV versus 5v5, equal 3v3/4v4, empty-net 5v6, ordinary PK/PP, penalty shots/shootouts, invalid situations and unmatched shifts. Every supported event appears exactly once; unresolved mass blocks complete totals.
3. Counts and exposure component sums against full same-game player/team totals. Integer event sums require equality; TOI tolerance must be tied to declared source rounding, never invented to pass a conflict.
4. Team clock versus player time, 3v5/4v5 manpower budgets, roster completeness and player sum-to-team allocation.
5. Strict cutoff, late insert, post-cutoff corrections, raw schema/finality, retained-version hash mismatch and deterministic row-order/replay.
6. Season/game IDs, trades, PHX/ARI and Utah HC/Mammoth boundaries, duplicate/overlapping aliases and current-team misuse.
7. Prior mass conservation, target-specific vectors, unsupported residual, sparse prior sensitivity and participation once for conditional versus integrated inputs.
8. Consumer/evaluation refusals for incomplete targets, incompatible basis, stale/future identity, disabled serving and unapproved uses. Complete PK does not automatically approve ratio targets or goalie participation.

Relevant existing suites to extend later: `derived/buildStrengthTablesV2.test.ts`, `derived/situation.test.ts`, `ingest/shifts.test.ts`, `startChartPipeline.test.ts` (existing bootstrap tests), `queries/skater-queries.test.ts`, `player-forecasts/contributions.test.ts`, `planningContributions.test.ts`, `evaluation.test.ts`, and `rosterScheduleData/planning.test.ts`. All are under `web/lib/`; unprefixed entries refer to the corresponding projections or player-forecasts directory. Application suites were deliberately not run for this report-only task.

Engineering validation establishes reproducibility, units, conservation, exclusion handling and component contracts. It does not establish predictive calibration. Prospective validation needs forecasts actually issued before games, immutable input availability, a declared target/season/role cohort, frozen model/config, comparison against the same full-game baseline, and error/calibration metrics appropriate to output type. Sparse PK counts require cohort sample reporting. No prediction intervals, win probabilities or calibrated certainty are unlocked by arithmetic tests.

## RSO effects and remaining gates

| Use case | What a successful candidate could supply | Remaining gate |
| --- | --- | --- |
| Skater G/A/S points, assignment and totals | Complete game means for approved targets; proper PK/full-strength inclusion | Released issued revision, complete taxonomy, participation, serving and allowed-use checks |
| PP-only scoring | Independent applicable PP components | Existing release/participation/identity gates; PK does not expand it |
| Longer calendar horizon | Independent baseline contributions on actual scheduled games | Calendar policy, rate source release/coverage, participation; no AGP multiplication of a horizon total |
| Category standings comparison | Complete expected additive totals | Opponent/realized inputs, ratios, eligibility, provider periods and permitted comparison |
| Probability of matchup win / uncertainty | None from means-only PK candidate | Joint scenario/distribution model and prospective calibration |
| Goalie categories and minimums | No new coverage | Start/appearance/relief coverage, target permissions, ratio conditioning and serving |
| Yahoo allowance/acquisition planning | No new provider evidence | Separate Yahoo field/week/limit evidence |

Nonurgent choices for parent: recommend approving the offline source-qualification slice first; then choosing a conserved component shadow candidate for richer role modelling, while treating the existing independent full-game baseline as the faster RSO alternative. Do not authorize production activation by implication. The true evidence gate is a compatible, complete and cutoff-qualified event/exposure partition, not simply whether a PK column exists.

## Verification receipt

Passed: read-only source/schema/index queries; bounded current-row evidence collection; direct code inspection of taxonomy, units, bootstrap and consumer gates; report/evidence JSON and arithmetic consistency checks recorded in `verification.json`.

Blocked: universal NST empty-net taxonomy documentation; immutable historically-known NST/WGO values for earlier cutoffs; league-wide completeness and current PK coverage; prospective forecast calibration.

Not run: model inference, application tests, production generation, schema changes, backfills, builds or deployments. Account readout during this audit: 44% weekly used, 56% remaining; no reset inferred.
