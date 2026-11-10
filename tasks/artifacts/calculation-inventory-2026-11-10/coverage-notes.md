# Coverage notes: calculation inventory (Opus), 2026-11-10

Companion to [CALCULATIONS-OPUS.md](CALCULATIONS-OPUS.md), [calculations-opus.json](calculations-opus.json), [AUDIT-CONTEXT.md](AUDIT-CONTEXT.md) and [audit-context-opus.json](audit-context-opus.json). Read-only work: no code changes, no database queries of any kind (the production catalog was not read; repo migrations were the definition source), no network calls.

## Result

1029 entries (1034 raw before dedupe), 954 with at least one red flag. By prefix: XG 70, FRG 98, PFC 130, RSO 60, FSC 53, RNK 45, SUS 58, BLSH 15, TRD 5, GPR 42, SKO 26, VUDU 3, TEAM 54, UST 95, ROLL 45, NST 34, CARD 24, LINE 43, WIGO 15, GST 20, DRF 42, HLP 8, MISC 44.

Prefixes: XG xG; FRG FORGE projections; PFC player forecasts (season); RSO roster optimizer; FSC fantasy scoring; RNK rankings; SUS sustainability; BLSH buy low/sell high; TRD trade value; GPR game predictions & odds; SKO sKO; VUDU VuDu; TEAM team ratings/power/CTPI/SOS; UST underlying stats; ROLL rolling averages & trends; NST NST-derived stats; CARD player cards & homepage; LINE lines/TOI/PP; WIGO WiGO; GST goalie starters; DRF draft tools; HLP stats helpers; MISC other.

## Method

1. Surveyed the layout: web/lib ~400k lines, 384 API routes, 464 scripts, SQL baseline 44.8k lines plus ~130 later migrations, Python in functions/ and modeling/.
2. Twelve read-only research agents, one per family slice: xG; FORGE; player forecasts + RSO + fantasy scoring; rankings + stats helpers; sustainability + BLSH + trade value; game predictions + sKO + VuDu + team ratings/CTPI/SOS; underlying stats + rolling + NST + player cards; lines/TOI/PP + WiGO + goalie starters; draft tools (incl. VORP/VONA/VBD) + misc; inline math in API routes (plus a delegation map of all 122 v1/db routes); scripts + Python; SQL objects (all 612 functions/views/matviews/triggers classified CALC or PLUMBING, one line each, in the SQL appendix). Each wrote JSON in a fixed schema plus a coverage report (appendices).
3. Chef's scope updates folded in mid-run: input units, output scale, status, tests, intent, fixtures; must-cover weekScore, sKO, VuDu, BLSH, RSO, every FORGE stage (FRG stage map entry), xG includes/excludes (XG-001); draft value math (VORP/VONA/VBD with replacement level, value source, next-available logic, VBD baseline, scarcity and multi-position handling).
4. Merge: families normalized, duplicates removed (same name + first file), IDs assigned, intent and fixtures split into AUDIT-CONTEXT.md.
5. Discovery sweep for unnamed metrics. Candidate files are the union of two rg sweeps over web, functions, modeling, underlying-stats, supabase/migrations, migrations and sql, excluding tests, fixtures, generated types, web/scripts/output, e2e, stories and migration-archive:
   - math pattern: `Math\.(sqrt|pow|exp|log|max|min|round)|/ ?60\b|\* ?60\b|percentile|zscore|z_score|stddev|stdev|per60|per_60|regress|sigmoid|logistic|poisson|weighted|avg\(|AVG\(|SUM\(|np\.|\.mean\(` (994 files);
   - constants and functions: `\b[A-Z_]*(WEIGHT|FACTOR|MULTIPLIER|BASELINE|PRIOR|COEF|COEFFICIENT|SHRINK|ALPHA|DECAY|HALF_?LIFE|THRESHOLD|CLAMP)S?\b\s*[:=]` and `softmax|sigmoid|logit|ewma|exponential.?moving|clamp\(|percent_rank|cume_dist|ntile|percentile_cont|stddev_samp|regr_` (603 files);
   - union 1,172 files. The 577 not cited by any family entry went to four sweep agents, which gave every file a disposition (per-file lines in the sweep appendices):

| Sweep | Files | NEW | DUP-IMPL | COVERED-BY | INCIDENTAL | Entries added |
|---|---:|---:|---:|---:|---:|---:|
| 1: web/pages, web/scripts, web/sql | 200 | 5 | 3 | 42 | 150 | 9 |
| 2: web/lib a–o | 107 | 13 | 0 | 6 | 88 | 9 |
| 3: web/lib p–z and top-level lib | 129 | 12 | 3 | 27 | 87 | 20 |
| 4: components, hooks, utils | 142 | 23 | 1 | 47 | 71 | 24 |

   One top-level lib file sat in two lists (578 dispositions for 577 files). Files still uncited after the sweep (517) were judged incidental or covered by an entry elsewhere. Entries from the sweep carry `discovered_in_sweep: true` in the JSON.
6. "Not on TJ's or Scout's lists" in CALCULATIONS-OPUS.md was reviewed by hand at metric level (52 entries). Scout's own list file was not found in the repo or the notes folder, so the named seeds are the items in TJ's brief and Chef's messages.

## Completeness checks for named items

- **VuDu (3 entries):** rechecked. VuDu is the goalie side of sKO. The only gap math is `vuduSaveGap` (web/lib/sko/gap.ts), called only by tests; the Sko Element shows observed SV%/GAA/start share and passes FORGE expectations through, and the live gap is hard-coded to `pending_goalie_adapter`. The other VuDu-mentioning files (legacyQuarantine.ts, SkoElementPreview.tsx, fixtures.ts, market.ts) only label or render.
- **BLSH (15 entries):** every stage has an entry. Uncited BLSH files (researchSnapshot.server.ts, storage.ts, useBlshLocalState.ts, BlshCandidateLists.tsx, BlshPlayerDetail.tsx, pages/buyLowSellHigh.js) render, store or load data and hold no formulas. BLSH trade math is under Trade value (TRD) and the player-card retained BLSH view under CARD.
- **Out-of-scope pointer:** `web/scripts/blsh/*` (offline BLSH runners) belongs to Codex and was not inventoried; it may contain extra filtering math.
- weekScore, sKO, RSO, every FORGE stage, xG includes/excludes and VORP/VONA/VBD all have entries (search the JSON by name).

## Known gaps

- pg_cron schedules live in the database, not the repo, so "live" status for power ratings, CTPI, SOS and xG jobs is unconfirmed.
- Units of NST `toi` columns (seconds vs minutes) are not verified per table; writers disagree (see NST and API-route red flags).
- The deployed xG artifact path (MODEL_ARTIFACT_PATH) could not be checked read-only.
- Large files read in targeted ranges only: start-chart.ts, run-projection-accuracy.ts, skater-stage.ts (lines 1750–1850), playerMatrix.ts, entitySurfaceServer.ts, linesCccIngestion.ts, cron-report.ts, update-nst-gamelog.ts.
- Sweep files marked INCIDENTAL were judged from the matched lines plus a short read.
- functions/scripts contains only compiled .pyc files; nothing to read.
- NST rate-limit enforcement in SQL was classified as plumbing, not math.
- Tests were matched by name, not checked for whether they assert the formula.
- Red flags are observations from reading code. None were verified against data.

# Appendices: per-agent coverage reports

## Appendix: xg-coverage

### xG slice: coverage notes

Output: `parts/xg.json` has 60 entries, including the summary entry "xG model: includes/excludes". Every entry has the 18 keys from the brief plus the addendum.

#### Files read in full or in the relevant sections
- web/lib/supabase/Upserts: nhlShotFeatureBuilder.ts, nhlCoordinates.ts, nhlStrengthState.ts, nhlEventInclusion.ts, nhlPriorEventContext.ts, nhlRebounds.ts, nhlRush.ts, nhlFlurries.ts, nhlMissReasons.ts, nhlPossessionChains.ts, nhlScoreState.ts, nhlContextualFeatures.ts (lines 119-500).
- Skimmed: nhlShiftStints.ts, nhlOnIceAttribution.ts (signatures and boundary rules only), nhlPlayByPlayParser.ts (owner, shot-like and timing parts), nhlRawGamecenter.mjs (strength duplicate only), fetchPbP.ts (column mapping only).
- web/lib/supabase/Upserts/nhlNstParityMetrics.ts: constants, danger and xG heuristics, strength segments, split matching, xG/goalie accumulation, and the pct/pdo/ipp/goalie output blocks. I did not read the accumulateToiBySplit body (906-1073) line by line.
- web/lib/supabase/Upserts/nhlXgValidation.ts: tolerances and classification only.
- web/lib/xg: baselineDataset, binaryLogistic, calibration, aggregates (build, rolling, flurry merge; drift and reconciliation thresholds only), flurryAdjusted, residualSkill, reboundHeads, reboundRichLabels, reboundControl, adjustedImpact (full), qotQoc (ratings plus feature-row skim), shotAssists, transitions, createdXg (skim), travelFatigue (skim), handedness, rosterPosition, deploymentContext (skim), shotFeatureEnrichment (skim), shotFeaturePersistence (encode/predict/fetch), hardeningAudit, featureCoverage (thresholds), trackingAlignment.
- Judged non-calculating (operational or registry): modelRegistry, executionLease, operationsHealth (alerts and tolerance only), backfillCoverageAudit (not opened beyond grep), releaseArtifactReference.
- web/lib/ml/*: featureLeakageRegistry, predictionsSkoRunControl, predictionsSkoDependencyChecks. Grep found no formulas, so these are judged non-calculating for xG.
- Scripts:
  - web/scripts/train-nhl-xg-baseline.ts: gates, standardization, splits, fit options, metrics, calibration and the main fit block.
  - web/scripts/train_nhl_xg_challengers.py: model configs, Platt, ECE and per-state models.
  - web/scripts/train-nhl-xg-rebound-heads-offline.ts: heads, AUC and gates.
  - web/scripts/benchmark-nhl-xg-baselines.ts: skim.
  - web/scripts/run-nhl-xg-release-validation.ts: skim.
  - web/scripts/audit-player-trend-expected-shooting.ts: formula line only.
- Routes:
  - Grepped for defaults and filters: update-nhl-xg-shot-predictions, update-nhl-xg-adjusted-impact, update-nhl-xg-aggregates (empty-net handling), update-nhl-xg-qot-qoc (rating inputs), update-nhl-xg-shot-features.
  - pages/api/v1/underlying-stats/xg.ts: table and window filters.
- Other: web/lib/underlying-stats/xgExplorer.ts, web/lib/rankings/xgDenominatorSemantics.ts, web/lib/rankings/adjustedImpactPromotionContract.ts, web/lib/socialShare/modules/goalieGsax.ts (GSAx block), components/ShotVisualization/ShotVisualization.tsx (transform, hexbin, summary), components/HeatMap/Heatmap.tsx (density).
- Third-party library read to explain the xgboost_js family: web/node_modules/@fractal-solutions/xgboost-js/src/xgboost.js.
- Artifacts inspected with jq (metadata, feature keys, test metrics, calibration bins): xg-corrected-candidate and the 3 xg-approval-run-20260522 artifacts.

#### rg patterns used
- `rg -il 'xg|expected.?goal|shot.?feature|rebound|rush|shot.?angle|shot.?distance'` over web/scripts, web/pages/api, functions and modeling.
- `rg --files | grep -iE 'xg|expected|shotfeat|rebound|rush|ShotVisual|HockeyRink|HeatMap|adjusted.?impact|nst.?parity'`
- `rg -l nhl_xg_adjusted`, `rg -l 'nhl_xg_(player|team|goalie)_.*aggregates'`
- Caller checks for: buildLaggedResidualSkillLayers, buildReboundHeadOutputs, auditXgTrackingAlignment, buildXgSegmentCalibrationAudit, calculateExpectedShootingPercentage, buildNstParityMetrics.
- `grep -n auc|roc` across the xG scripts.
- Test discovery: `find -name '*.test.*' | grep -iE ...`

#### Skimmed but judged non-calculating or out of slice
- **Keyword hits that are not xG:** most of the rg keyword hits are false positives on "rush" or "xg" in NST scrapers and season stats. These include update-nst-*, nst_gamelog_scraper.py, update-season-stats, ThreeYearAverages, start-chart, cron-report, skater-power/goalie-power trends, modeling/player_forecasts/*.py, functions/api/fetch_team_table.py, sustainability and FORGE routes, and audit-ctpi-*. They consume NST xG columns but do not compute xG. Other family agents own them.
- **Other non-xG files:** components/GameGrid/PDHC/PoissonHeatMap.tsx is a Poisson goal model (GameGrid family, not xG). PlayerPerformanceHeatmap.tsx is a performance grid, not a shot map. HockeyRinkSvg.tsx and lib/drawHockeyRink.ts only draw the rink.

#### Gaps and suspicions (honest)
- **Blocked-shot owner semantics.** I did not confirm from raw NHL payloads whether eventOwnerTeamId on blocked-shot rows is the shooting team or the blocking team. Several red flags depend on this: coordinate mirroring, rebound same-team, and the rush source.
- **Deployed artifact unknown.** I could not tell which artifact MODEL_ARTIFACT_PATH points to in production. That would need env or DB access, which the brief forbids.
- **No schedule found.** I found no cron schedule for any update-nhl-xg-* route in vercel.json or web/vercel.json. "live" status is inferred from the route contracts, docs/player-projections/model-inventory.json and the promotion contract (802 impact rows on 2026-06-09). It could also be a pg_cron or GitHub schedule that I did not search exhaustively.
- **Not fully read:**
  - nhlNstParityMetrics.ts:906-1100 (TOI split accumulation and shift-start zone-start helpers).
  - aggregates.ts:807-1184 (reconciliation and drift details).
  - qotQoc.ts unit-row internals.
  - createdXg.ts rolling and reconciliation.
  - backfillCoverageAudit.ts.
  - travelFatigue.ts localParts/timezone math.
- **playerTrendCalculator scale.** The expected_shooting_pct accessor's return scale (fraction vs percent) was not confirmed; the line was cut off.
- **Not opened:** the 62 tasks/artifacts/xg-*.md decision notes (tasks/ is excluded by the brief). They are cited only as intent paths.
- **.next-codex-reconcile/.** A duplicate copy of web/ exists there. I ignored it.
- **Things I may have missed:** any xG math in SQL views or migrations (supabase/, migrations/, sql/) was not searched. For example, a DB-side xG rollup would be missed.

## Appendix: forge-coverage

### FORGE projections — coverage notes

Output: `parts/forge.json` (74 entries, 18 keys each incl. the six addendum keys). Read-only; no code executed, no repo edits (the repo's context-diary rule was not applied because the brief forbids repo writes).

#### Read in full or near-full (calculation bodies)
- web/lib/projections/constants/projection-weights.ts, utils/number-utils.ts, utils/trend-adjustments.ts, utils/season-recency.ts, utils/date-utils.ts (horizon scalars), utils/devig.ts (header + function list), utils/market-output-builders.ts (thresholds, over-probability, comparison headers)
- stages/skater-stage.ts (1-1335 helpers fully; 1335-3635 runPerGameSkaterStage read in chunks; 1750-1850 pool-recovery block skimmed only)
- stages/goalie-stage.ts (full), stages/preflight-stage.ts (availability multiplier section)
- calculators/skater-adjustments.ts, goalie-starter.ts, goalie-save-pct-context.ts, team-context-adjustments.ts, scenario-blending.ts (full)
- reconcile.ts, skaterRollout.ts, uncertainty.ts, dispersion.ts, goalieModel.ts, goalie/goalieOutcomes.ts, goalie/leagueSavePct.ts, goalie/workloadEvidence.ts, reserveProjections.ts, seasonBootstrap.ts, gameLength.ts, accuracy/fantasyPoints.ts, promotionGates.ts
- queries/team-context-queries.ts, queries/goalie-queries.ts, queries/skater-queries.ts (profile/trend/deployment parts)
- derived/situation.ts, derived/buildStrengthTablesV2.ts (shot/goal attribution), derived/buildGoalieGameV2.ts, ingest/shifts.ts (buildShiftStrengthUpserts)
- nativeGoalAccounting.ts (accounting part), goalieStarterMixtures.ts (normalisation), startChartFantasyScoring.ts, starterBoardScoring.ts (scoring parts)
- run-forge-projections.ts (orchestration 800-1215, market flags)
- web/lib/rollingForgePipeline.ts (stage contract), web/lib/goalieWorkload.ts, web/lib/gameGoalProjections/calculations.ts + utils.ts, web/lib/projectionsConfig/proration.ts + fantasyPointsConfig.ts, web/utils/projectionsRanking.ts
- web/lib/forge-v2: model.ts, uncertainty.ts, participation.ts, evaluation.ts, horizonEvaluation.ts (math lines), researchBaselines.ts (math lines)
- web/lib/fantasy-projections: settlement.ts, evaluator.ts (200-380), seasonJobs.ts (quantile, newcomer prior)
- web/lib/player-forecasts/servedForecastLedger.ts (math lines; outside listed slice but it is the served-forecast ledger)
- API: run-projection-accuracy.ts (aggregates, calibration, gates, miss attribution, goalie loop), update-goalie-projections-v2.ts (math block), forge/goalies.ts (normalisation), start-chart.ts (grade, TOI), forge-served-forecast-settle.ts (imports/flow), forge/accuracy.ts (select)
- Components: Projections/ProjectionSourceAnalysis.tsx, forge-dashboard/HotColdCard.tsx, TeamPowerCard.tsx, forge-command-center/PlayerInsightCore.tsx, TeamPowerTerminal.tsx, ForgeV2/ForecastExplorer.tsx (math lines only)

#### Skimmed via grep for arithmetic, judged non-calculating or plumbing
evidenceTime, ingest/time, ingest/nhleFetch, ingest/pbp (persistence), ingest/projectionInputPersistence, ingest/rawSnapshotPersistence, utils/collection-utils, queryCaptureHook, starterBoardFlags, releasedRunFence, forgeProducerIdentity, acceptedNews, apiHelpers, adapters/*, materializationFingerprint, compatibilityInventory, projectionPipelineState, verifiedForgeReleases, consumerRevisionAdmission, gameRevisions, inputCapture, issuedContext, externalInputProof(.fixtures), privateParticipationScenario (validation), relationshipMaterialization, relationshipPlayerPosition, shiftChartCompleteness(Server), shiftChartRelationshipPayload, pbpCompletenessServer, dailyBoardEvidence, rosterEvents, starterBoardDataset/Queue/Validation/Operations (on-time share and nearest-rank quantile only), starterBoardPersonalization (weightedAssignment sum), weightedAssignment, startChartContract, startChartTeamForm (simple GF/GA means), modeledHeadTotals (sums), forgeSkaterContext, queries/run-lifecycle-queries, queries/line-combo-queries, queries/market-queries (book averaging; mentioned in market entry), stages/persistence-stage, stages/metrics-finalization-stage (learning-counter ratios), types/*, utils/projection-metadata-builders (horizon x values for metadata), derived/projectionDerived*; forge-testing-grounds/* (progress percents, leases only); rollingForgePipelineRunState.ts; fantasy-projections admin/contracts/readiness/rosterIntegrity/rosterReconciliation/identityResolution/transactionAudit/validation/queries/scoringSettings (only override-delta and derived goalie totals noted); forge-v2 contracts/api/data/history/operations/preparation/refresh/schedule/qualification/identity (scoring arithmetic noted).

#### rg patterns used
`Math\.|[a-zA-Z0-9_)\]] [*/] [a-zA-Z0-9_(]|reduce\(|clamp|exp\(|log\(|sqrt` per file; `^(export )?(async )?function`; caller/test searches `rg -l "\bNAME\b" -g '*.ts' -g '*.tsx' -g '!*.test.*'`; `rg -il 'forge|projection' web/pages/api`; `forge_goalie_game` writers; env flags `FORGE_SKATER_MODEL_MODE`, `FORGE_RESERVE_PASS_ENABLED`, `STARTER_BOARD_*`.

#### Gaps / not finished
- skater-stage.ts 1750-1850 (pool recovery / emergency inclusion details) and the per-row metadata blocks were skimmed, not read line by line.
- run-projection-accuracy.ts: ~2843 lines; read the scoring helpers and main loops, not every diagnostic finaliser (e.g. role-bucket interval calibration 705-773, goalie stat diagnostics 1230-1420 only skimmed).
- run-projection-v2.ts (route, 1863 lines) only scanned: arithmetic is batching/timeouts; shift-coverage ratio at :272 noted but not entered.
- forge/players.ts, ingest-projection-inputs.ts, build-projection-derived-v2.ts, update-goalie-starter-mixtures.ts, forge-served-forecast-snapshot.ts routes: scanned for inline math only.
- fantasy-projections evaluator.ts lines 1-200 and 380-693, seasonJobs.ts beyond 250, admin.ts beyond the override block, contracts.ts derived totals (468-545) only skimmed.
- forge-v2 horizonEvaluation/evaluation read at the formula lines; schedule/episode logic not audited.
- update-rolling-player-averages (rolling_player_game_metrics) and NST/WGO ingestion are upstream inputs owned by another slice; FORGE depends on their per-60/IPP/weighted_rate definitions (resolveNullableCompatibilityValue 'weighted_rate').
- web/scripts (fit-forge-dispersion, forge-goalie-backtest, forge-counterfactual-backtest) are fitting/backtest code for constants; not inventoried.
- forgeDailyBridge.ts (RSO) reuses computeTeamStrengthContextAdjustment — belongs to RSO slice.
- Env values (whether FORGE_SKATER_MODEL_MODE=candidate or FORGE_RESERVE_PASS_ENABLED=true in production) were not checked (.env skipped), so 'flagged off' statuses reflect code defaults.
- Tests listed were found by name search; not opened to confirm which branch they exercise.

## Appendix: forecasts-rso-coverage

### Coverage: Player forecasts (season) / RSO / Fantasy scoring slice

Output: parts/forecasts-rso.json — 230 entries, 18 keys each (brief + addendum).
Produced as four sub-slices: A = Python modeling (77), B = web player-forecasts + forecast-diagnostics (51), C = RSO (63), D = Game Grid / pickup / scoring / integrations / autopsy / NHL (39, written by the lead). Sub-slice coverage notes follow verbatim.
Read-only: no project code, tests, builds, DB or network calls were run. No repo file was edited.

#### Sub-slice D (lead): Game Grid, PlayerPickupTable, scoring, user-settings, integrations, rosterAutopsy, lib/NHL, in-season

Read fully: web/components/GameGrid/utils/{calcWeekScore,poisson,poissonHelpers,calcWinOdds,fourWeekMetricBands,metricRanks,scheduleSummary,teamGameExpectations,opponentCategoryEffects,scheduleOpportunity,helper,teamForecasts,fourWeekGridViews}.ts; useFourWeekSchedule.ts:100-170; useOpponentMetricsData.ts:77-170; GameGrid.tsx:249-300,370-425,530-590,860-880,1580-1600; TotalGamesPerDayRow.tsx:84-128; DateRangeTeamGrid.tsx:50-160; TeamDetails.tsx:135-152; PoissonHeatMap.tsx:145-170; PlayerPickupTable.tsx:111-134,171-293,1980-2050,2190-2240,2370-2500,2540-2810; web/lib/scoring/categoryScores.ts; web/lib/rosterAutopsy/{manual,diagnosis}.ts; web/lib/user-settings/defaults.ts (+ mappers.ts coerceNumberMap); web/lib/projectionsConfig/fantasyPointsConfig.ts:8-45; web/lib/integrations/yahoo/rosterPlanning.ts:20-140; yahoo/liveDraft.ts:440-500; yahoo/starterBoard.ts:130-300; yahoo/playerWriter.ts:85-122; espn/normalize.ts:180-282; fantrax/normalize.ts:540-660; web/lib/projections/starterBoardScoring.ts:40-66 and starterBoardPersonalization.ts:1-140 (Start Chart, outside the named slice but it is the Yahoo integration's scoring path); web/lib/NHL/TOI.ts; NHL/server/index.ts:455-571; NHL/statsPageFetch.ts:228-262; NHL/edgeFeatureContract.ts:240-271; pages/api/v1/transactions/ownership-trends.ts:20-60,150-175,380-480 (ownership trends, outside named slice but in "Cover").

rg patterns: `Math\.|reduce\(|/ |\* |weight|percentile|score|ownership|offNight|<= 8|THRESHOLD`, caller searches for every exported calc symbol, test-name searches in *.test.* / *.spec.* / __tests__, fixture searches (`*fixture*`, `__fixtures__`).

Skimmed and judged non-calculating (plumbing, auth, transport, UI layout): web/lib/in-season/** (billing/Stripe/schema; only a fixed $24.99 price check and a 31-minute checkout cutoff), yahoo/{oauth,tokenManager,globalCredentials,refresh*,providerClient,pollCoordinator,pollPolicy (backoff only),lifecycleHealth,observability,ingestionLifecycle (retry/backoff),discovery,teamRoster,pickup,planningCache,planningConfirmations,yahooIdentity,config,liveDraftAccess,liveDraftApi,liveDraftServer,liveDraftDatabase}, espn/{client,http,server,manualImport,sessionOverride,liveDraftServer,contracts}, fantrax/{client,http,server,manualImport,liveDraftServer,draftResults,playerIdentity,contracts}, patreon/**, stripe/**, providerSyncAccess*; web/lib/NHL/{base,client/*,corsProxy,edge,edgeIngestion (copies API percentiles),pptReplay*,nhlscraperContracts,seasonAwareScheduleTeam,playoffs,htmlReports,types,statsPageTypes,teamPageTypes,server/{rightRail,playoffBracket,scheduleDaily}}; GameGrid layout components (Header, TeamRow, TransposedGrid, VerticalMatchupCell, LoadingCells, Switch, Toggle, MetricInfoDisclosure, OpponentRoleToggle, RatingMeter (rounding only), OpportunitySparkline (SVG scaling), useOpportunityClock (timer), useSchedule (fetch), date-func); RosterAutopsy.tsx (UI over lib).

Must-cover items for D: weekScore (calcWeekScore + scheduleSummary + useFourWeekSchedule + helper + callers in GameGrid, PlayerPickupTable team boost, RSO TeamScheduleContext, socialShare offNightEdge) — covered as 8 entries. Yahoo/ESPN/Fantrax category and points scoring mapping — covered. Weekly matchup (category win/loss vs opponent) math lives in RSO and is covered in sub-slice C. sKO, VuDu, BLSH and the xG model are not in this slice (BLSH lives in web/components/blshTrade; xG in web/lib/xg) — left to their owning agents.

Gaps / suspected misses (D):
- PlayerPickupTable.tsx read in targeted ranges only (~45% of 3109 lines); data-mapping lines 2040-2190 skimmed. Filter logic (positions/teams/ownership) not inventoried beyond the threshold.
- GameGrid.tsx (1724 lines) and DesktopMasterTable.tsx (1405 lines) read only around calculation call sites; other derived client math there may be missed.
- Did not read socialShare/* or lib/gameGoalProjections/* (consumers / producers of weekScore and win odds; other slices).
- Integrations: liveDraftServer files (Yahoo 1847, ESPN 613, Fantrax 361) only rg-scanned; they appeared to be polling/plumbing.
- Tests listed are from filename/symbol rg hits; not verified to assert the specific formula.


---

### Coverage: Player forecasts (season) Python slice (forecasts-rso-A)

Output: forecasts-rso-A-python.json (75 entries). Read-only; no project code run.

#### Files read in full or near-full (calculating)
- modeling/player_forecasts/season.py: header constants and all SQL (1-628); audits 842-1210 (assist, fantasy-metric coverage, season-total audit, Gamecenter resolution); 1591-5014 read line by line (summaries, EB, GLM/NB/hurdle, context/aging, tournament, conformal, team contexts, venue, roster-adjusted, defense ratings, deployment, train_season_artifact, reconcile, multipliers, quantiles, evaluate_season_game, aggregation, settlement finality, release). freeze_season_dataset (1204-1590) only grep-scanned for math (roster_confidence 0.85/0.55/0.4, prior_based >= 20242025 found); run_season_audit (715-841) grep-scanned.
- modeling/player_forecasts/advanced.py: 1-240 (targets, on-ice SQL, source specs), 393-482, 600-1580, 1695-1715, 1793-2242. freeze_advanced_sources / run_advanced_source_audit (246-392, 483-604) and settlement body (1587-1792) only grep-scanned.
- forge_walk_forward.py: 28-175, 275-430, 718-736, 876-992. Remaining functions (capture, settle, issue, tick, main) are I/O/protocol; not read line by line.
- rookies.py 41-90, 241-703; pp_shot_support.py (all); pp_evidence_capture.py 389-660 (validation only); features.py, scoring.py, model.py, aggregation.py, horizons.py, challenger_math.py, challenger_features.py, challenger_model.py, challenger_inference.py (all); challenger_freeze.py 1-75; freeze.py 1-55; lockbox.py 20-70; contract.py 1-40.
- daily_board.py 20-236; daily_board_models.py (all); daily_board_training.py 16-96; daily_board_context.py 16-243; daily_board_strength.py 16-190; daily_board_scenarios.py 19-60, 145-256; daily_board_goalies.py 20-160; daily_board_baseline_issuance.py 20-116; daily_board_data.py 22-180; daily_board_settlement.py 38-184.
- functions/api/player_forecasts/infer.py, functions/lib/player_forecasts/inference.py, runtime.py 40-171.

#### rg/grep patterns used
- `^(def |class |[A-Z_]{3,} *=)` on every large file for function/constant inventory.
- `math\.|sum\(|/ |mean|median|ratio|share|>= *[0-9]|0\.[0-9]|\* ` on audit/freeze/settlement sections.
- consumer search: `player-forecast-season-import-v1|player-aggregates.jsonl|season-artifact.json`, `player_forecast_season_[a-z_]*` in web/scripts/import-player-forecast-season.ts, `player_forecast_season_player_aggregates|player_forecast_season_game_outputs` in web/.

#### Skimmed and judged non-calculating
- io.py, database.py, audit.py (row-count SQL only), __main__.py (CLI), contract.py (checksums/dates), lockbox.py/freeze.py (checksums, wrapper around evaluate_range), challenger_freeze.py beyond query, daily_board_candidates.py (identity/label matching; counts only), daily_board_roster_report.py (HTML parse), daily_board_daily.py (orchestration), functions/lib/player_forecasts/contracts.py, __init__ files.
- pp_evidence_capture.py outside 389-660: schema/shape validation and publishing.

#### Gaps / possible misses
- forge_walk_forward method A is computed in web/scripts/forge-walk-forward-native.ts (TS, out of slice); its native formula constants are only known from POLICY text (82/20/0.9/20).
- pp_shot_support baseline constants mirror web/lib/projections TS files (out of slice).
- daily_board_scenarios.validate_game (56-144) not read in detail; only shape checks expected.
- advanced.py settlement (1587-1792) and source audit not read line by line; may hold minor coverage ratios.
- freeze_season_dataset schedule/roster logic only grep-scanned; may contain transaction-coverage computations.
- Consumers on the web side (seasonJobs.ts, admin.ts, readiness.ts, orchestration.ts) identified by name only, not read.
- Line numbers for inline blocks inside long functions are the nearest anchor line verified with grep; a few (e.g. advanced 1965/2040/2159, season 2391/2341/3543) were re-verified after drafting.

#### Addendum pass (six keys)
- Added input_units, output_scale, status, tests, intent, audit_fixtures to all entries; added 2 entries (walk-forward BLK settlement labels; Starter Board daily run orchestration incl. FORGE TS export) -> 77 entries, 18 keys each.
- Status evidence: modeling/player_forecasts/__main__.py CLI parsers; web/package.json import:player-forecast-season; web/vercel.json (no player-forecast cron); .github/workflows (no reference); functions/api/player_forecasts/infer.py + web/lib/player-forecasts/orchestration.ts:355 (PLAYER_FORECAST_ENABLE_INFERENCE); runbook PLAYER_FORECAST_SEASON_INFERENCE_ENABLED=false (:469); docs/start-chart/launch-validation.md:20.
- Tests: grep of each function name in modeling/player_forecasts/tests/test_harness.py; functions/tests/test_player_forecast_inference.py; web/lib/fantasy-projections/fantasyProjections.test.ts. Untested (no reference found): _weighted_summary, _eb_rate, _venue_scorer_effects, _future_age_multiplier, train_season_artifact, project_season_release, _aggregate_components, _reconcile_quantiles, _fit_rate_policy, _build_advanced_observations, train_advanced_artifact, project_advanced_release, train_validation_challenger, _fit_logistic_offsets, SQL label queries.
- Intent: docs/player-projections/* (runbook, research contracts v3-v5, season-scoring-model-audit, evidence docs), docs/start-chart/launch-validation.md and daily-board-contract-v1.json, code docstrings/comments. Not opened in depth; cited by heading line.
- Fixtures: no committed fixture/golden files for the Python slice; test data is inline in test_harness.py; golden vectors are generated inside artifacts at train time; pp_shot_support engineering_fixtures are fictional; web/scripts/seed-player-forecast-fixtures.ts seeds serving fixtures.
- xG model, weekScore, sKO, VuDu, BLSH, RSO are outside this Python slice (advanced.py only consumes champion xG predictions).

---

### Coverage: player forecasts (season) slice B — web/lib/player-forecasts/** and web/lib/forecast-diagnostics/**

Output: forecasts-rso-B-webforecast.json (45 entries). Read-only; no project code run.

#### Read in full or near full (math-bearing)
- player-forecasts: baselineRates.ts, baselinePolicy.ts, goalieBaselineRates.ts, nativeGoalieOutcomes.ts, nativePowerPlayPoints.ts,
  restOfSeason.ts, contributions.ts, planningContributions.ts, gameExpectations.ts, modeledSkaterParticipation.ts,
  modeledGoalieParticipation.ts, rollingWindowParticipation.ts, accountability.ts, planComparison.ts, seasonGameContributions.ts,
  evaluation.ts, servedForecastLedger.ts (lines 1-311 read; 312-566 read via grep + targeted sections)
- forecast-diagnostics: pairedInputs.ts (scoreTeamGoals, accountForgeTeamGoals), contract.ts (comparableMean), historicalQualification.ts (cohort)

#### Read in targeted sections
- baselineGeneration.ts (181-235 native snapshot; bundle unit line 97), baselineSourceLineage.ts (186-365 target extraction),
  settlement.ts (constants, scoreForecast, actualForOutput, finality), currentSeasonSogBaseline.ts, currentSeasonSogContribution.ts (grep),
  nativeParticipationFrame.ts (window/cohort/dispositions), rollingParticipationFrame.ts (grep), resolvedPlanningForecast.ts (19-130),
  calendarCoverage.ts (28-172), schedule.ts (season id, scopes), readiness.ts (176-226, 295-312), rsoUsePolicy.ts (grep),
  sourceObservations.ts (94-110, 425-460), gameContract.ts (grep of refinement checks), nativeDailyMeansCapture.ts (bounds, policy selection),
  nativeDailyPipelineV2.ts (thresholds, participation method), orchestration.ts (stale schedule), dashboard.ts (checkpoint read),
  frozenResearchPair.ts (blend check), targetRosterObservation.ts, currentRosterInjuryEvidence.ts (grep)

#### Skimmed via rg and judged non-calculating (plumbing: contracts, stores, lineage, hashing, IO, admission)
artifacts.ts, runtimeSafety.ts, reviewToken.ts, researchContract.ts (both dirs), sourceSnapshot.ts, contracts.ts, contributionStore.ts,
nativeContributionAdmission.ts, modeledSkaterParticipationStore.ts, modeledGoalieParticipationStore.ts, nativeCatalogHead.ts,
currentRosterNativeInputs.ts, scopeReads.ts, nativeBaselinePublication.ts, goalieBaselineInputCapture.ts, baselineInputCapture.ts,
nativeDailyPipeline.ts, nativeCadenceOutputPreparation.ts (only 12 h expiry gate captured), nativeBaselineCadence.ts,
nativeInputMaterialization.ts (byte bounds only), yahooUniverse.ts, yahooUniverseCapture.ts, gameExpectationView.ts (wire encoding),
gameExpectationReader.ts (scope parse), forecastServingSource.ts (8 s deadline only), serving.ts (artifact checksums; inference runs elsewhere),
populationAudit.ts (identity classification, no numeric model), forecast-diagnostics/fixtures.ts.
Fixture files (*.fixtures.ts) and *.test.* skipped per brief.

#### rg patterns used
`Math\.|reduce\(|/ |\* |weight|decay|alpha|shrink|prior|mean|rate|threshold|clamp|round|ratio|percent|DAY|hours|>= [0-9]`,
`\.from\("..."\)|\.rpc\(` for tables, and symbol searches across web/{lib,pages,scripts,components} for consumers.

#### Gaps / not finished / suspected misses
- servedForecastLedger.ts 430-512 (paired cohort construction details) read only via grep; scorePairedLedger exclusion rules summarized, not line-audited.
- External dependencies outside slice not traced: lib/fantasy-projections/evaluator (season artifact model), lib/projections/utils/devig and
  market-output-builders (de-vig method, FORGE count distributions), lib/projections/starterBoardDataset (frozen board export),
  lib/projections/researchGameGoals (research goal model), computeSkater/GoalieFantasyPoints implementation.
- The composite skill score aggregation into player_forecast_accountability_revisions is not computed in this slice (likely SQL/RPC or another job).
- Runtime inference (serving.ts -> build_player_forecast_runtime_features RPC and worker) not in scope; its math lives elsewhere.
- Consumer lists come from rg of import names; dynamic imports or string-referenced callers may be missed. Several functions appear to have
  no non-test callers (aggregatePlayerForecastRestOfSeason, runProspectiveEvaluation, runForgeProspectiveEvaluation, evaluatePairedPointDecisions,
  validateNativeParticipationFrame, buildHistoricalQualificationCohort) — flagged as possible dead code, not confirmed.

#### Addendum pass (six extra keys; now 51 entries, 18 keys each)
- Added FORGE pipeline stage entries: nativeDailyPipeline.ts (v1), nativeDailyPipelineV2.ts (gates), nativeInputMaterialization.ts,
  nativeCadenceOutputPreparation.ts, nativeBaselineCadence.ts, nativeBaselinePublication.ts (read exports, doc comments, bounds).
- Status evidence: rg callers in web/{pages,lib,scripts,components} (non-test), web/vercel.json crons (only forge-served-forecast-snapshot
  30 12 * * * and forge-served-forecast-settle 0 11 * * * touch this slice), env PLAYER_FORECAST_ENABLE_INFERENCE, NATIVE_DAILY_V2_FLAGS.
- Tests: rg of function names in *.test.*/*.spec.*. Fixtures: gameContract.fixtures.ts, rsoUsePolicy.fixtures.ts, yahooUniverse.fixtures.ts,
  forecast-diagnostics/fixtures.ts, scripts/seed-player-forecast-fixtures.ts (seeds player_forecast_* tables incl. outcome/accountability rows).
- Gaps: actual V2 flag values used in live runs are in an external --flags file (not in repo), so rolling-14d status is 'unknown (flag-gated)'.
  /api/v1/player-forecasts/jobs/settle and /api/v1/forge/scoreboard have no cron or page caller found; marked unknown.
  Cadence slot math (prepareForecastCadence in lib/fantasy-projections/seasonJobs.ts) not traced.

---

### Coverage: RSO / roster optimizer (forecasts-rso-C)

Output: forecasts-rso-C-rso.json (62 entries). Read-only; no project code run.

#### Read fully (math-bearing)
- web/lib/rosterScheduleOptimizer: optimizer.ts, matching.ts, slots.ts, eligibility.ts, weeks.ts, risk.ts, recommendations.ts, types.ts (threshold constants), planning.ts (all 1587 lines), streamingChain.ts, futureImpact.ts, candidatePlanMetrics.ts, contributionLedger.ts, retention.ts, benchDecisions.ts, healthyReserves.ts, lineupGaps.ts, reconciliation.ts, providerRules.ts, providerGoalieStarts.ts, planningDates.ts, planningTimeline.ts, periodBoundaries.ts, recentForm.ts, categoryFormat.ts
- web/lib/rosterScheduleData: forgeDailyBridge.ts (all), planning.ts lines 1-120 and 275-430 (ownership, form labels, deployment), laterImpactInputs.ts lines 59-200, bridgeForecastWire.ts (reserve appearance, fitBridgeWire), constants.ts
- web/lib/projections/weightedAssignment.ts (Hungarian helper used by planner; outside slice, read for algorithm)
- docs/roster-schedule-optimizer.md (intent; it documents DUST only, not the planner/streaming/bridge)

#### Grepped / skimmed, judged non-calculating or validation-only
workspace.ts, signature.ts, diagnostic.ts (hard-coded dev diagnostic dates 2026-10-12..18), executionAdapter.ts, yahooEligibility.ts (08:40 UTC due time), yahooEligibilityCache.ts, currentPlanningRead.ts, privatePlanningRead.ts, refreshForecastInputs.ts, upkeepLease.ts (6-min lease), planningTypes.ts, index.ts; rosterScheduleData normalize.ts, source.ts, recurring.ts (proposal, not imported), refreshGuard.ts, query.ts, persistence.ts, planningDataTransport.ts, planningInputs.ts (paging, 36 h witness), types.ts. Components: canonicalSchedule.ts (36 h validation), CompactSchedule.tsx, SlotWeekGrid.tsx ('Likely starter' >= 0.5 display), CandidateBrowser.tsx (10% alt rule, list ordering), CandidateCard.tsx (SV% pooling), CategoryGains.tsx (5% band), TeamScheduleContext.tsx (delegates to GameGrid), BenchDays/BenchDecisions/RosterContribution/StreamingItinerary/ForecastPoints/HealthyReserveAlert/AcquisitionPeriodTimes/PlanFromSlider/RosterPlayerRow (display), RosterScheduleOptimizer.tsx (orchestration; refresh backoff 5/30 min, 6 h/2 h schedule warning).

#### rg patterns used
`Math\.|reduce\(|sort\(|weight|score|threshold|probab|expected|\* [0-9]|/ [0-9]|[0-9]{3,}|0\.[0-9]`, `bpa|best player` (none found in RSO), function-header listing, consumer lookups per exported symbol.

#### Gaps / not covered
- External calculators called by the bridge were not inventoried (other slices): computeTeamStrengthContextAdjustment, computeSkaterRestScheduleAdjustments, buildSkaterModeledHeadTotals, goalieOutcomes.teamWinProbability, projection-weights constants (values looked up only), resolvePlanningContributions / summarizeContributionCoverage (player-forecasts), GameGrid schedule score/off-night functions, draft-pro/dust.ts value input.
- rosterScheduleData/planning.ts lines 120-275 (native contribution / participation source selection) skimmed only; mostly admission plumbing.
- laterImpactInputs.ts lines 200-311 (assembly) skimmed; conditioning observation on basis rows not traced end-to-end through assembleLaterImpactScenario.
- No 'BPA' identifier exists in RSO code; BPA per streaming step is the rankOptions/blended score entry.

#### Addendum pass (six extra keys)
- All 63 entries now carry input_units, output_scale, status, tests, intent, audit_fixtures (18 keys each, validated).
- Added entry 63: RSO planning data load and forecast source selection (data load stage). Must-cover stages present: data load -> FORGE bridge -> eligibility -> slotting -> streaming chain -> future impact -> recommendations -> reconciliation/retention; weekly category matchup math = 'Category values, opponent totals and matchup result'.
- TeamScheduleContext entry trimmed to a consumer note (GameGrid owned elsewhere).
- tests: rg of each function name over *.test.* / *.spec.* in web/. Status evidence: rg callers, env flags RSO_FORGE_DAILY_BRIDGE, FORGE_RESERVE_PASS_ENABLED, RSO_LATER_IMPACT_SCENARIO, LATER_IMPACT_CONTRACT.accepted.
- Fixtures: web/e2e/roster-schedule-optimizer-fixtures.ts, web/e2e/fixtures/rso-acceptance|rso-continuity/index.ts, web/e2e/draft-pro-fixtures.ts, web/lib/rosterScheduleData/forgeReservePayload.fixture.ts, web/lib/player-forecasts/rsoUsePolicy.fixtures.ts, web/__tests__/fixtures/consumerGameRevision.ts. Not checked: tasks/artifacts sample payloads.

## Appendix: rankings-coverage

### Rankings family — coverage notes

Output: `rankings.json` (51 entries, 18 keys each incl. the 6 addendum keys).

#### Read in full (non-test)
- web/lib/rankings: rankingCalculator, metricDefinitions, skaterCompositeMethodology, defensiveCompositeMethodology, skaterCompositeWriter, rankingQueries, skaterWindowAggregation, skaterDeploymentAggregation, deploymentTiers, war, xgDenominatorSemantics, adjustedImpactPromotionContract, teamStyleMethodology, teamMatrix, resultsLuckIndex, resultsLuckSources, goalieMethodology, goalieMatrix, skaterCompositeSourceCoverage (calc part), rankingFormatters.
- web/lib/ratings/playerImpactRatings.ts; web/lib/math/utils.ts; web/lib/stats/percentUnits.ts; web/utils/calculatePercentiles.ts, calculateWigoRatings.ts, tierUtils.ts, projectionsRanking.ts; web/pages/api/v1/rankings.ts.

#### Read partially / skimmed (targeted greps + key ranges)
- web/lib/rankings: goaliePopulation (lines 60-243), playerMatrix (types + composite/sort/TOI ranges 574-700, 846-932, 1085-1120, 1335-1375), entityMetricRankingWriter (full), entityMetricRankingReader (330-470), trending (278-646 key ranges), splits (129-240), comparison (180-381: no math), snapshot (grep: no math), teamUnitToiBuilder (195-450), rankingUrlState (55-120 + defaults), matrixMetricRegistry (grep), teamUnitToiWriter/Nightly (grep: IO only).
- web/lib/splits/splitsServer.ts (grep + 147-185, 626-835); splitsSurface.ts (grep: formatting helpers).
- web/lib/xg/qotQoc.ts (101-200, 336-460) and pages/api/v1/db/update-nhl-xg-qot-qoc.ts (grep) — outside the slice, included for QoC/QoT.
- web/lib/power-ratings.ts calculateEwma/calculateZScores (310-540) — pointer entry only; owned by team-ratings family.
- web/components/WiGO/ratingWeights.ts (weights grep) for the WiGO ratings entry.
- components/Rankings/*: grep for Math/thresholds; matrixScoreFormatting.ts and PlayerSnapshotPanel strengths read.
- API routes: pages/api/v1/contextual-rankings.ts and contextual-rankings/*.ts (all 14-35 lines, thin wrappers); db/update-skater-composite-ratings.ts (grep: dryRun default true, limit 1000).

#### Judged non-calculating
availableFilters.ts, rankingMetadata.ts (glossary/constants; CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT 2026-06-09), entityCoverageContracts.ts (text contracts), rankingTypes.ts (request parsing), teamTokenResolver.ts, rollingRankingSelectFields.ts, apiErrorResponse.ts, comparison.ts, snapshot.ts, rankingFormatters.ts (display only), lib/standardization/* (name/column mapping, no math), utils/stats/formatters.ts & nhlStatsFetch.ts, components/Rankings table/filters/panels (display).

#### rg patterns used
`rankNormalizedMetricValues|buildContextualRankingRows|...`, `calculateOffenseRating|calculateMcmScore|...`, xgDenominatorSemantics function names, `buildSkaterDeploymentAggregate|resolveEvDeploymentBucket|...`, `skater_composite_ratings`, `unit_share` (SQL), route names in routeRunner, `function (\w*(zScore|stdDev|percentile|per60|regress|shrink|mean|median|ewma|weightedAverage|clamp)\w*)` over web/utils and web/lib/*.ts, each lib/math/utils export name, calculatePercentiles exports, `calculateTierThresholds`, `buildPlayerImpactRatings|buildSeasonDecayedPlayerImpactPriors`, `Math\.|reduce\(|\* 100|3600` in components/Rankings, `rg -il community web/lib/rankings web/components/Rankings` (no matches — community rankings are NOT in this slice).

#### Gaps / possibly missed
- playerMatrix.ts (1458 lines) not read line-by-line; rank-scope/deployment-scope logic and sampleConfidence filter only skimmed.
- trending.ts OPPORTUNITY_SIGNAL_CONTRACTS text and parse code skimmed; goaliePopulation lines 1-60 skipped (types).
- splitsServer fetchers (which tables) not enumerated; source_tables for that entry are generic.
- web/utils/fetchWigoPercentiles.ts cohort GP sanitation (0.35 x max GP / >=4 / >=10 thresholds at lines 125-160) seen but not given its own entry; fetchWigoPlayerStats.ts (1132 lines), getPowerPlayBlocks.ts, extractPPDetails.ts not read (likely WiGO/PP family).
- Other web/lib/*.ts top-level files (goalieWorkload, teamOpponentStrength, teamRatingsService, teamRatingsTrend, homepage*) not inventoried — assumed owned by team/goalie/homepage agents; only generic EWMA/z helper in power-ratings flagged.
- Did not verify nst_toi units (seconds vs minutes) in player_stats_unified for playerImpactRatings; flagged as unknown.
- No DB/fixture data inspected; audit_fixtures mostly empty except web/lib/rankings/fixtures/rankingsTrust.json.
- Cron/route-runner status checked only for update-team-unit-toi (registered); update-skater-composite-ratings / update-entity-metric-rankings / update-player-impact-ratings not found in routeRunner registry by rg (likely manual).

## Appendix: sustainability-blsh-coverage

### Coverage: Sustainability / BLSH / Trade value slice

Output: 68 entries in parts/sustainability-blsh.json (six addendum keys included on every entry).

#### Read in full or near-full
- web/lib/sustainability: config.ts, priors.ts, runtimeContract.ts, score.ts, windows.ts, guardrails.ts, observability.ts, distribution.ts, bands.ts, bandCalculator.ts, model.ts, features.ts (from line 150), recompute.ts, read.ts (scoring/leaderboard/explanation parts), backtest.ts, backtestHarness.ts, dataJoins.ts, incremental.ts (classification helpers), data.ts (opponent strength section 104-230), entitySurface.ts (255-346), entitySurfaceServer.ts (130-822).
- functions/lib/sustainability: README.md, constants.py, reliability.py, clipping.py, contributions.py, finishing.py, zscores.py, priors.py, player_priors.py, windows.py, scoring.py, distribution.py, benchmark.py, pipeline.py, orchestrator.py, config_loader.py (defaults + hash).
- web/lib/baselines: config.ts, aggregations.ts (1-660; MED/LOW blocks 656-841 skimmed — same pattern as HI).
- web/lib/buyLowSellHigh: productionReference.ts, supportGap.ts (1-340, 477-560, explanation grep), currentWindows.ts (84-278), opportunity.ts, forecastEvaluation.ts (1-300), market.ts, trade.ts, displayProfile.ts (230-480), researchSnapshot.ts (326-360).
- web/lib/tradeValue (all 4), web/lib/tradeAnalyzer (both), web/components/blshTrade/retrospective.ts, components/sustainability/formatting.ts, SustainabilityVSCareerChart.tsx colour rules.
- Routes: rebuild-priors.ts (k defaults), rebuild-window-z.ts / rebuild-score.ts (windows, grep), trends.ts (luck pressure), SustainabilityStats/[playerId].ts, db/sustainability/rebuild-baselines.ts (244-325).
- SQL: migrations/20250930_add_baseline_3yr_career.sql, migrations/20251001_add_sustainability_scores.sql, web/sql/sustainability/001_create_sustainability_projections.sql (constraints grep).

#### rg / grep patterns used
- `rg -il 'sustainab|blsh|buy.?low|trade' web/pages/api`; function-signature greps (`^export (function|const)`); `Math\.|reduce|\* |/ ` per route to find inline math; consumer greps for model/features/backtest exports; `pk_tier` scale check (lib/dashboard/invariants.ts:47 => 1-3 tiers); vercel.json cron grep; test-file discovery by name.

#### Skimmed, judged non-calculating (or pure plumbing)
- web/lib/sustainability: persist.ts (upsert/band-order assert), recomputeQueue.ts (cursor), health.ts, coverageAudit.ts (counts), dependencyChecks.ts, identity.ts, trendsIdentity.ts, dates.ts, resolveSeasonId.ts, featureDictionary.ts (labels), types.ts, bandService.ts (fetch/history loop; season-totals limit noted in an entry).
- web/lib/buyLowSellHigh: storage.ts, useBlshLocalState.ts, researchSnapshot.server.ts (sha/size pins), currentProcessEvidence.server.ts (time/byte gates; folded into the qualification entry).
- Components: BuyLowSellHighPreview, BlshCandidateLists (sort by positionRank only), BlshPlayerDetail, TradeAnalyzer.tsx, SustainabilityBadge/Tooltip/Sparkline (display scaling noted in tier entry), forge-dashboard/SustainabilityCard (Trust label captured in luck-pressure entry).
- API routes that only forward to lib: player/[playerId], upcoming/[playerId], leaderboard, entity-*, coverage-audit, process-recompute-queue, recompute, trend-bands, rebuild-trend-bands, internal/sustainability/health.
- Matched by rg only via the word 'trade'/'traded' (no BLSH/trade math): v1/db/calculate-wigo-stats.ts, update-wgo-skaters.ts, run-projection-v2.ts, cron-report.ts, update-line-sources.ts, update-goalie-projections-v2.ts; ThreeYearAverages/nstgamelog.py (comment reference only).
- functions/lib/sustainability: offline.py, secrets_stub.py; __pycache__ includes db_adapter/retro_recompute/anomalies .pyc with no .py source (not read).

#### Gaps / suspected misses
- entitySurfaceServer.ts 822-1445 (fetchSandboxScores/Bands/History) only skimmed: it reads `entity_sustainability_scores_daily` / `entity_sustainability_bands_daily` (team/goalie/skater unified tables). Their writer is NOT in this slice (defined in web/sql/ratings/002_create_analytics_trends_predictions_and_provenance.sql) — team/goalie sustainability math belongs to the ratings/analytics slice and is not inventoried here.
- supportGap.ts explanation layer 560-673 read via grep only; displayProfile.ts toDisplayProfile (302-410) mapping only skimmed (label/text mapping, no new math expected).
- forecastEvaluation.ts 300-340 (run summary/report packaging) not read.
- web/scripts/blsh/* (offline runners, export_db_history.py, nativeProcessCapture*) not inventoried: they orchestrate the BLSH pipeline and may contain extra filtering math.
- lib/skoElement/interpret.ts weightedPointsGap (used by BLSH watchlists) and lib/rosterAutopsy/manual analyzeRoster (used by trade analyzer) and pages/api/CareerAverages (used by the legacy chart) are outside the slice — referenced, not inventoried.
- Cron status for rebuild-baselines and sustainability/recompute was not found in web/vercel.json (may be Supabase pg_cron or manual); marked unknown.
- No DB queries were run, so data-scale claims (pk_tier 1-3, nst_oi_pdo scale, toi units) rest on code evidence only.

## Appendix: games-teams-coverage

### Coverage: games-teams slice (Game predictions & odds, sKO, VuDu, Team ratings / power / CTPI / SOS)

Output: `parts/games-teams.json` (94 entries, 18 keys each incl. the 6 addendum keys). Read-only; no code executed.

#### Read in full or near-full
- web/lib/game-predictions: baselineModel.ts (all), featureBuilder.ts (455-2610; fetch section 2610-3061 skimmed for tables/limits), rosterImpact.ts, teamGameNormalization.ts, evaluation.ts, espnOdds.ts (286-590 + no-vig call sites), workflow.ts (30-125, 254-330, 395-645, 817-905, 1340-1542), publicPredictions.ts (208-360, 545-565), accountability.ts (360-1000, 1110-1160, 1248-1300, 1354-1975, 2949-3020, 3185-3440, 3761-3800, 4165-4194), adminHealth.ts (grep + 226-420 math lines).
- web/lib/predictions: rollingWindows.ts (all); contracts/sourceProvenance/pipelineCronAlignment/legacyQuarantine/sourceOwnership grepped (metadata only; freshness 14-day rule captured).
- web/lib/sko/gap.ts, web/lib/skoElement/contract.ts, interpret.ts (all). fixtures.ts not read (fixture data; listed as audit fixture).
- functions/lib/sko_pipeline.py and functions/api/index.py: orchestration only (HTTP step runner), non-calculating.
- sKO legacy: web/pages/api/v1/ml/update-predictions-sko.ts (formula region), web/lib/supabase/utils/calculations.ts, statistics.ts, constants.ts (weights), update-sko-stats.ts (row builder), fetchSKOyears.js derived fields.
- web/lib/power-ratings.ts (all), web/pages/api/v1/db/update-team-power-ratings.ts (130-365), web/lib/teamRatingsTrend.ts (all), teamRatingsService.ts (mapping; no math), teamOpponentStrength.ts, underlying-stats/teamRatingsService.ts (re-export only), sql/001_team_power_ratings.sql (grep of formula lines + 360-503).
- web/lib/trends: ctpi.ts, recentTeamFormV2.ts (formula parts), strengthOfSchedule.ts, strengthOfScheduleContract.ts (formula parts), teamPercentiles.ts, teamMetricConfig.ts (weights), utils.ts, playerTrendCalculator.ts (100-330), goalieMetricConfig.ts.
- web/lib/dashboard: topAddsRanking.ts, topAddsScheduleContext.ts, reliability.ts, teamContext.ts, playerInsightContext.ts (tone), freshness.ts (policy).
- Components: Poisson chart, PoissonHeatMap + GameGrid/utils/poissonHelpers.ts + calcWinOdds.ts (blend fn only), GamePreview odds, GameStateAnalysis, TeamDashboard (AdvancedL10Metrics, GameByGameTimeline, TeamLeaders, TeamDashboard math lines), TeamStandingsChart, Predictions/*, SkoLineChart, GameScoreChart, skoElement/*.
- Routes: update-team-ctpi-daily.ts (200-363), update-team-sos.ts (200-330), trends/team-sos.ts, trends/team-ctpi.ts (95-160), update-power-rankings.ts and update-team-power-ratings-new.ts (stubs), lib/gameGoalProjections/*.
- Cross-slice dependency noted only: web/lib/xg/binaryLogistic.ts and web/lib/xg/calibration.ts (logistic trainer, log loss/Brier, Platt/isotonic) belong to the xG slice.

#### rg patterns used
`Math\.|/ [0-9a-zA-Z(]|\* [0-9a-zA-Z(]|0\.[0-9]+|reduce\(`, `^(export )?(async )?function |^export const`, `-il vudu`, `\bsko\b|skoElement|sko_`, `poisson|skellam|dixon`, caller searches for every exported formula (interpretPlayer, computeTeamPowerScore, computeSosRatings, buildPlayerTrendRecords, combineSKO, calculateGameScore, computeCharacteristicResults, generatePregamePredictionForGame), test-file discovery (`*.test.*`, `__tests__`).

#### Judged non-calculating (skimmed)
featureSources.ts (source registry), predictions/sourceOwnership.ts, legacyQuarantine.ts (registry; used for status), pipelineCronAlignment.ts (slot ordering), dashboard normalizers.ts/dataFetchers.ts/commandCenterData.ts/clientFetchCache/perfBudget/invariants/forgeLinks/commandCenterLinks/teamMetadata (pass-through), teamRatingsService.ts (fetch+cache), DashboardPillarHero, SkoLineChart/GameScoreChart (plot scaling only), trendsSurface.ts (display formatting), skoUtils.ts (sparkline geometry), recentTeamFormV2Materialization/Provenance (persistence plumbing), sko_pipeline.py.

#### Gaps / not finished
- featureBuilder.ts fetch functions (2610-3061) only skimmed: query limits recorded, no further math expected.
- accountability.ts 2065-2620 and 3019-3180, 3476-3760, 4194-4485 (persistence, readiness, orchestration) skimmed via function list only; selectAccuracyLoopSourceReadinessGames coverage math not itemized beyond buildMarketOddsSourceReadiness.
- espnOdds.ts import preflight (1105-1346) not read line-by-line (validation, sample stats).
- adminHealth.ts buildGamePredictionHealthReport only partly read.
- sql/001_team_power_ratings.sql lines 1-85 and 205-360 (CTEs for wgo tiers, fill) not read fully.
- fetchPowerRankings.js 130-300 (daily standings delta) and fetchOpponentAggregateRecord tail not read.
- sosStandings.js read in parts.
- TeamDashboard.tsx (2209 lines) only math lines inspected.
- `sKO` naming collision: "sKO score model v3" (tasks/artifacts/sko-model-v3-2026-11-03/DEPLOY-SQL.md) refers to the sustainability score in web/lib/sustainability/* — NOT covered here; expect the sustainability/BLSH slice to cover it. lib/buyLowSellHigh (BLSH ranking that consumes weightedPointsGap) also not covered.
- web/components/GameGrid/utils/calcWinOdds.ts back-to-back x0.75 adjustment and weekScore belong to the GameGrid slice; only calculateBlendedWinOdds is listed here.
- lib/stats/percentUnits.ts aggregateWgoTeamGames not read (only aggregateNstTeamCounts).
- pg_cron schedules for update-team-power-ratings / ctpi / sos are not in the repo, so "live" status for those is based on withCronJobAudit wrappers and nstClassification, not a verified schedule.

## Appendix: underlying-rolling-coverage

### Coverage: underlying-rolling slice (merged)

Families: Underlying stats summaries; Rolling player averages & trends; NST-derived stats; Player cards & homepage stats.
Method: the slice was split into five read-only sub-slices (A-E) worked in parallel, each following BRIEF.md and BRIEF-ADDENDUM.md; the parent merged them, checked that every 'where' path exists and every cited line is within its file (168/168 OK), normalised status prefixes, and spot-checked these flags in source: skater split fallthrough (playerStatsLandingServer.ts:1644-1663), goalie md/ld goals double-add (3548/3551 + 3564->3458/3461), OT game-clock (resolveGameSecondsElapsed ~928), GSAA=xGA-GA (nhlNstParityMetrics.ts:1780), SoS shadowed gameDateObj (fetchSoSgameLog.js:291), GoaliePage GAA higher-is-better (calculateRanking.ts:19), GP% trade team-game summing (rollingHistoricalAverages.ts:165-178), trend TOI units (playerTrendCalculator.ts:22-30,251-274).

Sub-slices: A = web/lib/underlying-stats + components/underlying-stats; B = rolling pipeline (fetchRollingPlayerAverages + rolling* contracts + lib/rollingPlayer*); C = other Upserts fetchers + nhl*.ts PbP/NST-parity/xG-feature modules; D = lib/nst, functions/lib/nst_admission.py, lib/NHL, lib/supabase non-Upserts helpers, lib/stats; E = player-cards, homepage, player trends, dashboard player metrics, StatsPage/SkaterPage/GoaliePage/TeamLandingPage.

Overlaps to dedupe at merge: xG feature/validation modules (C) and the copied fallback xG in teamStatsSummaryRefresh.ts (A) overlap the xG slice; team trend files (ctpi, recentTeamFormV2*, strengthOfSchedule*, teamPercentiles) were skimmed only (team-trends agent); sKO appears in C (legacy JS), D (legacy statistics/calculations) and E (skoUtils luck/sustainability).


---

#### Sub-slice A

### Coverage: underlying-stats slice (A)

46 entries in A.json. Family "Underlying stats summaries", with sub-families: player landing, goalie, team summaries, team ratings, schedule strength, xG explorer, refresh windows, shot quality, table presentation.

#### Read in full, or every calculation section read
- web/lib/underlying-stats/playerStatsLandingServer.ts (5,529 lines). I read these line ranges in full: 1-700, 791-1120, 1585-2130, 2258-3610, 3662-3931 and 4183-5335. For the rest (700-790, 1119-1584, 2135-2257, 3931-4182, 5334-5529) I ran a grep for arithmetic. Those ranges hold fetch/PG/payload plumbing, and the grep found no calculations.
- teamStatsSummaryRefresh.ts (all), teamStatsQueries.ts (232-1048 read, 1-231 types/select lists), teamScheduleStrength.ts, teamLandingRatings.ts, teamRatingNarrative.ts, teamLandingDashboard.ts, teamSpecialTeamsContext.ts, entityRatingsOverlay.ts, xgExplorer.ts, goalieStatsQueries.ts, goalieStatsServer.ts, goalieStatsSummaryRefresh.ts, player/goalie/teamStatsRefreshWindow.ts, playerUnderlyingCoverage.ts, availableSnapshotDates.ts, playerStatsFormatting.ts
- playerStatsFilters.ts and teamStatsFilters.ts: read the season-window, validation and parse helpers. The rest of each file is query-param serialization.
- playerStatsQueries.ts: read the trade-display and position helpers (150-290). The rest is API path building and parsing.
- adminRouteHelpers.ts: read the date/game-type/missing-game helpers (230-460). The rest is retry and batch orchestration.
- Components: PlayerStatsExpandedRowChart.tsx (rolling avg), UnderlyingStatsQuadrantMap.tsx (domain), UnderlyingStatsDashboard.tsx (bar scaling), playerStatsColumns.ts / teamStatsColumns.ts (format tokens), playerStatsSorting.ts.

#### Upstream code checked only to confirm a claim (other slices own it)
- lib/supabase/Upserts/nhlNstParityMetrics.ts: split keys at 38-60 and 1866-1885, goalie danger accumulation at 1508-1540. This confirmed the skater split-key mapping bug and the md/ld goals-against double count.
- lib/dashboard/teamContext.ts:34 (computeTeamPowerScore), lib/trends/strengthOfScheduleContract.ts:21 (recordPercentage), pages/api/v1/underlying-stats/xg.ts (source tables, DEFAULT_WINDOW_GAMES=10).

#### Judged non-calculating: skimmed or grepped only
playerStatsSummaryRefresh.ts (upsert/warm cache), playerSummaryRollbackPlan.ts and playerSummaryRollbackStore.ts (timestamp-microsecond ordering for rollback heads; not a stats calculation), playerStatsClientCache.ts (5-min TTL), ulsRouteStatus.ts, teamStatsLandingApi.ts (types and path building; the coverage note is covered in the coverage entry), playerStatsTypes.ts, UlsStatusPanel.tsx, PlayerStatsTable.tsx (pagination arithmetic only), PlayerStatsFilters.tsx / TeamStatsFilters.tsx (season-range min/max clamp), UnderlyingStatsDashboardCard.tsx, UnderlyingStatsLandingShell.tsx, UnderlyingStatsNavBar.tsx, PlayerStatsTableState.tsx, all .scss. I excluded the dashboard rating bar mapping ((v-70)/60 clamped to 4-100%) as display-only, but mention it here.

#### Search patterns used
`grep -nE "^(export )?(async )?function |Math\.|/ |\* 3600|Pct|pdo|per60|threshold|_DAYS|_MS"` over every file in both directories, plus targeted `sed -n` reads.

#### Gaps and uncertainty
- I did not open the per-shot xG/count definitions in nhlNstParityMetrics.ts or nhlShotFeatureBuilder.ts (another slice). The player on-ice/individual counts and xG come from those files.
- PDO and PDO-z (currentPdo, currentPdoZ, trendDelta) are computed in lib/teamRatingsTrend.ts, and team ratings in lib/teamRatingsService.ts. Both are outside this slice. The luck-status entry covers only the threshold.
- I did not verify the NHL API event-owner convention for blocked-shot events, so the related red flags are marked "verify".
- I did not check whether the xg.ts route bounds transition/rebound game aggregates to the same N-game window (the window-mismatch red flag).

#### Addendum pass (six keys added to all 46 entries)
- Status evidence: web/vercel.json crons (none for underlying routes); supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130 (lineCombinations insert trigger -> update-player-underlying-stats); tasks/TASKS/cron-operations/cron-schedule.md:382,827 (pg_cron 'update-player-underlying-stats-yesterday', 09:35 UTC); rg for callers in web/pages, components, lib and scripts.
- Status changes: entityRatingsOverlay.ts has no non-test callers, so it is marked legacy/dead (its consumers entry is corrected). classifyPlayerUnderlyingCoverage is used only by web/scripts/verify-player-underlying-query.ts.
- Tests: found by rg of function names across *.test.* files. No unit tests exist for: the strength/score classifiers (directly), the heuristic danger buckets and xG proxy, team segment TOI, team shot accumulation, the event-fallback standings, special-teams ranks, the entity overlay, or the chart rolling averages.
- Intent: PRDs in tasks/TASKS/three-pillars-analytics/underlying-stats/prd/ (player, goalie, team, SoS) plus code comments. New finding: the SoS PRD requires a 50/50 record + predictive split, but the code is record-only.
- xG: I spot-read nhlCoordinates.ts, nhlShotFeatureBuilder.ts:182-200, nhlRebounds.ts:6, nhlRush.ts:5 and nhlContextualFeatures.ts:277 (other slices) to state the proxy's includes and excludes. New finding: angle uses |dx|, so shots from behind the net count as low-angle.
- Fixtures: there is no underlying-stats fixture directory. Test files carry inline fixtures (cited by line), and the earlier audit notes live at tasks/TASKS/three-pillars-analytics/underlying-stats/*_Audit.md.

---

#### Sub-slice B

### Coverage: slice B - rolling player averages pipeline

#### Files read fully (non-test)
- web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts (lines 1-4400 read; 4400-4851 scanned with grep: orchestration only - resume, batching, upsert, run summary)
- web/lib/supabase/Upserts/rollingMetricAggregation.ts, rollingPlayerMetricMath.ts, rollingHistoricalAverages.ts, rollingWindowContract.ts
- rollingPlayerToiContract.ts, rollingPlayerPpShareContract.ts, rollingPlayerPpUnitContract.ts, rollingPlayerLineContextContract.ts
- rollingPlayerAvailabilityContract.ts, rollingPlayerSourceSelection.ts, rollingMetricScaleContract.ts, rollingMetricSourceUnitContract.ts, rollingPlayerSupportPayload.ts
- web/lib/rollingPlayerCountSupport.ts, rollingPlayerMetricCompatibility.ts, rollingPlayerDailyResume.ts, rollingPlayerOperationalPolicy.ts
- web/lib/predictions/rollingWindows.ts (first lines only, for CANONICAL_ROLLING_GAME_WINDOWS)

#### Read partially
- rollingPlayerPipelineDiagnostics.ts: read 292-420 and 512-825 (tail freshness, derived-window, suspicious outputs); summarizeCoverage (155-290) only grepped.
- rollingPlayerValidationPayload.ts (2525 lines): read 472-640, 730-890, 968-1320, 1580-1900; function list for the rest. 1315-1580 (comparison builders), 1898-2525 (snapshot, fetch, main builder) were not read line by line; judged as assembly/presentation.
- rollingDroppedColumns.ts: list of 491 dropped column names + isRollingDroppedColumn; non-calculating.

#### Spot checks outside slice (read-only, for units)
- web/pages/api/v1/db/update-nst-gamelog.ts:1400-1420 (NST toi / toi_per_gp parsed mm:ss to seconds)
- web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:40-80 (pp_share_of_team = PPTOI / team PP TOI, 0-1)
- rg for pp_toi_pct_per_game (WGO NHL ppTimeOnIcePctPerGame, 0-1) and toi_per_gp
- rg -l for rolling_player_game_metrics / support payload consumers (used for the consumers lists; consumers were not read)

#### Patterns used
rg -n "toi_per_gp", "pp_toi_pct_per_game", "pp_share_of_team\s*[:=]", "rolling_player_game_metrics", "readAlignedCountSupport|aligned_count_support", "rollingPlayerMetricCompatibility"; grep -n for function/metric keys in the main file.

#### Judged non-calculating
rollingDroppedColumns.ts, rollingPlayerDailyResume.ts (cron cursor parsing), rollingPlayerOperationalPolicy.ts (concurrency/budget profiles, full-refresh refusal), rollingPlayerSupportPayload.ts (storage merge), storage compaction/split in the main file (isPrunableRollingStorageField, splitRollingUpsertRowForDurableStorage: moves _all/_last3/_3ya/_career/_avg_ fields to rolling_player_metric_support_payloads), retry/limiter/progress code.

#### Gaps / not verified
- The traded-player GP% denominator double count is inferred from reading updateHistoricalGpPctAccumulator; not checked against the tests (tests skipped per brief).
- Whether the 'games' table contains preseason/playoff games (affects team-game denominators) was not checked.
- teamsInfo abbreviation coverage for historical teams not checked.
- Consumers (rankings, FORGE, trends page, socialShare) were located by filename only; how they read the columns is out of slice.
- No goalie metrics here (players.position != 'G' filter); no xGF% / HDCF% / percentiles computed in this pipeline.

#### Addendum pass
Added input_units, output_scale, status, tests, intent, audit_fixtures to all 20 entries. Status from web/vercel.json cron (run-rolling-forge-pipeline daily_incremental), lib/rollingForgePipeline.ts route list, lib/rollingPlayerOperationalPolicy.ts (skipDiagnostics=true on all profiles). Tests located with rg on module names in *.test.*/__tests__ (not run). Intent from code comments and web/README.md:244-304; tasks/ grepped for paths only. Note: rollingHistoricalAverages.test.ts:145 encodes the trade case with team 2 counter restarting at 3, unlike live ledger values.

---

#### Sub-slice C

### Coverage note: slice C (web/lib/supabase/Upserts, non-Yahoo, non-test)

36 entries in C.json.

#### Read in full or near-full
- nhlNstParityMetrics.ts (all 1,894 lines)
- nhlStrengthState.ts, nhlOnIceAttribution.ts, nhlShiftStints.ts, nhlEventInclusion.ts, nhlCoordinates.ts, nhlScoreState.ts, powerPlayCombinationMetrics.ts
- nhlRebounds.ts (most), nhlRush.ts (most), nhlPriorEventContext.ts, nhlMissReasons.ts
- nhlPlayByPlayParser.ts (lines 129-414; type definitions skipped)
- fetchRollingGames.js (lines 173-920), fetchPowerRankings.js (74-300, 574-1247), fetchSoSgameLog.js (106-392)
- fetchSKOskaterStats.js and fetchSKOyears.js (calculation blocks and endpoints)

#### Skimmed (outline + key formulas)
- nhlShotFeatureBuilder.ts (geometry, timing hydration, row assembly; many pass-through fields not itemized)
- nhlContextualFeatures.ts (shift age/PP age/movement/royal road; helper internals 74-260 only outlined)
- nhlFlurries.ts and nhlPossessionChains.ts (break rules read; sequence bookkeeping skimmed)
- nhlXgValidation.ts (tolerances, comparison, release disposition; raw-event validation 344-445 only outlined)

#### Judged non-calculating (pure fetch/copy, no entry)
- fetchWGOdata.js, fetchWGOskaterStats.js, fetchWGOgoalieData.js, fetchWGOgoalieStats.js, fetchPPTOIdata.js: copy NHL stats REST fields (per-60s, pct) straight into wgo_* / sko_pp_stats tables.
- fetchStandings.js: copies daily standings into raw_standings_sos.
- fetchPbP.ts: copies api-web PbP into pbp_plays/pbp_games (side note: column penalizedteam is filled from details.typeCode).
- nhlRawGamecenterRoute.ts: ingest routing (only logic: game treated finished 8 h after start); nhlRawGamecenterTelemetry.ts not opened (24 lines, telemetry).

#### Search patterns used
rg/grep: `^export function|^function`, `Math\.|reduce\(| / | \* |per60|Per60|avg|toFixed`, `\.from\("`, `blocked.*owner`, `buildNstParityMetrics|buildShotFeatureRows\(`, `home_score|away_score`, consumer greps for rolling_games, power_rankings_store, sko_*, sos_standings, powerPlayCombinations, nhlXgValidation.

#### Cross-checks made outside the slice (read-only)
- web/lib/underlying-stats/playerStatsLandingServer.ts:1066-1095: confirms production parity is called with buildShotFeatureRows output (no xgValue/dangerBucket), so heuristic xG and distance/angle danger buckets are what ship.
- web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts:292-312 (read only to check assumption): fixture treats blocked-shot eventOwnerTeamId as the shooting team.
- pages/api/v1/db/update-power-play-combinations/[gameId].ts:180-231: units = top 5 / next 5 / rest by PP TOI; writes powerPlayCombinations.

#### Gaps / not verified
- Blocked-shot event owner semantics in live api-web payloads not verified (affects CF/CA, iCF, rebounds, rush, chains). Flagged, not confirmed.
- Whether NHL PbP home_score/away_score are populated on non-goal events (affects score-state splits) not verified; no back-fill found in playerStatsLandingServer.ts on a quick grep.
- Legacy NST table percent scale (0-1 vs 0-100) not checked; it decides whether nhlXgValidation percent tolerance is sane.
- nhlXgValidation raw-event validation (344-445) and nhlContextualFeatures interval helpers not itemized as separate entries.
- xG-related modules (shot features, rebounds, rush, flurries, chains, contextual, validation) listed coarsely and tagged "overlap: xG slice".
- power_rankings_store has no in-repo reader found apart from its writer route; consumers for sos_standings listed from a combined grep and should be checked.

#### Addendum pass (six extra keys)
- All 36 entries now carry input_units, output_scale, status, tests, intent, audit_fixtures. xG INCLUDES/EXCLUDES text was appended to "method" for: fallback xG, goalie GSAA, coordinates, rebounds, rush, contextual features, shot feature assembly (trained-model facts), validation.
- Status evidence: tasks/TASKS/cron-operations/cron-schedule.md (pg_cron JSON + commented SQL), web/vercel.json (no slice routes), 410 quarantine stubs in pages/api/v1/db/update-rolling-games.ts and update-power-rankings.ts, web/lib/predictions/legacyQuarantine.ts:122-123 (SKO JS files).
- Intent sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md, tasks-nhl-api-xg-model.md, data-contract-boundaries.md, event-dictionary.md. The 10 s rush window and penalty-shot exclusion are DOCUMENTED choices (definitions-and-parity.md:60-71, :213-220).
- event-dictionary.md states score fields are not present on every event class, which supports the score-state-filter flag.
- Trained xG facts (model type, eligibility, default season 20252026, calibration) read from scripts/train-nhl-xg-baseline.ts, web/lib/xg/baselineDataset.ts and web/lib/xg/calibration.ts only at the cited lines; the released artifact/model registry was not checked (xG slice).
- Duplicate fallback xG/danger logic found outside the slice at web/lib/underlying-stats/teamStatsSummaryRefresh.ts:489-515.
- No real audit fixtures exist for the legacy JS loaders; parity fixtures are mostly inline in tests plus tasks/artifacts/nhl-pbp-recon-2026-03-30.json.

---

#### Sub-slice D

### Coverage D (lib/nst, lib/NHL, lib/supabase non-Upserts, lib/stats/percentUnits)

#### Read fully
- web/lib/nst/radarSeasonStats.ts, requestBudget.ts, sharedAdmission.ts, goalieFreshness.ts, gamelogProgress.ts
- functions/lib/nst_admission.py; web/lib/cron/nstRateLimitPolicy.ts (lines 1-140, outside slice, cited for window constants)
- web/lib/NHL/TOI.ts, utils/utils.ts; web/lib/stats/percentUnits.ts
- web/lib/supabase/utils/calculations.ts, statistics.ts, constants.ts
- web/lib/supabase/GoaliePage/calculateAverages.ts, calculateRanking.ts, calculateGoalieRanking.ts, updateWeeklyData.ts; shotsByCoord.js
#### Read in part (grep + targeted sed)
- web/lib/nst/goalieCatchup.ts (1-40, 88-130, 196-241), goalieCatchup.server.ts, goalieFreshness.server.ts, goaliePreparation.server.ts, jobLifecycle.server.ts, client.ts (retry/deadline lines)
- web/lib/NHL/edgeIngestion.ts, edgeFeatureContract.ts, statsPageFetch.ts (46-58, 120, 212-364), server/index.ts, nhlscraperContracts.ts, pptReplayCoverage.ts
- web/lib/supabase/sosStandings.js (172-240, 329-500, 605-700), GoaliePage/goaliePageWeeks.js, fetchGoalieDataForWeek.js, upsertGoalieData.js, utils/updateAllGoalies.ts, utils/dataFetching.ts, pagination.ts
- web/components/PlayerStats/PlayerRadarChart.tsx:410-432 (radar percentile consumer, outside slice; folded into the radar entry)

#### rg patterns
`Math\.|/ |\* |percent|Pct|pct|avg|average|rate|toi|TOI|odds|percentile`, plus importer searches for each helper (`lib/NHL/TOI`, `supabase/GoaliePage`, `shotsByCoord`, `sosStandings`, `percentUnits`, `sos_standings`, `shots_goals_by_coord`, `goalie_page_stats`).

#### Judged non-calculating (no entry)
- lib/NHL: edge.ts (fetch only), playoffs.ts (date/game-type gates), server/playoffBracket.ts, rightRail.ts, scheduleDaily.ts (types), base.ts, htmlReports.ts, client/*, seasonAwareScheduleTeam.ts / seasonAwareWriterTeams.cjs (identity resolution), pptReplayIngestion.ts / pptReplayCoverage.ts (event counting by type only), nhlscraperContracts.ts (identity matching; contract values passed through), corsProxy.ts, server/index.ts (only gameType = floor(id/10000)%100 and season selection).
- lib/nst: client.ts (transport, retries 2, 15 s timeout), jobLifecycle.server.ts, admissionOrigin.ts, gamelogProgress.ts (bookmark TTL 72 h + outcome counts only), goaliePreparation.server.ts (final-score validation).
- lib/supabase: utils/updateAllGoalies.ts (pass-through NHL goalie summary/advanced/days-rest mapping into wgo_goalie_stats; live via update-wgo-goalies), utils/fetchAll*.ts, GoaliePage/fetchAllGoalies.ts, pagination.ts, utils/dataFetching.ts (join of WGO + SKO logs; no math), auth/client files.
- Skipped per brief: database-generated.types.ts, Yahoo JSON/python, *.test.*.

#### Gaps / suspected misses
- Server-side NST admission window enforcement lives in SQL RPCs (nst_admit_attempt_v1 etc.) - not read.
- goalieCatchup.server.ts and goalieFreshness.server.ts only grepped; any extra thresholds there may be missing.
- edgeIngestion.ts (1,099 lines) grepped for math, not read line-by-line; supplemental detail builders assumed pass-through.
- sosStandings.js lines 1-170 and 700-780 (orchestration) not read in full.
- Live goalie ranking code (components/GoaliePage/goalieCalculations.ts), pages/api/toi.ts parseTime and pages/api/v1/db/update-team-sos.ts are outside this slice; noted only as duplicates.

#### Addendum pass (six extra keys)
- Tests found with rg over *.test.*, __tests__, functions/tests for each function/module name.
- Status evidence: web/vercel.json crons, web/lib/cron/nstCoordination.ts schedules, route imports, importer searches. lib/supabase/GoaliePage/*, shotsByCoord.js and statistics/calculations.ts are marked legacy/dead with evidence. sosStandings.js is marked legacy/unknown because update-team-sos.ts is the live writer.
- Fixtures: there are almost no standalone fixture files for this slice. Inline test data is the main audit material; web/__tests__/fixtures/nst/oct1-identity-source.json covers gamelog identity, not these calcs.
- Intent is cited from code comments and AGENTS.md:105 (NST policy). tasks/ and docs/ were searched by name only and gave no direct PRD hit for these calcs.

---

#### Sub-slice E

### E coverage: player cards, homepage, player trends, dashboard (player), Stats/Skater/Goalie/TeamLanding pages

43 entries in E.json. Read-only; no project code run.

#### Read in full or near-full
- web/lib/player-cards: aggregation.ts, ranking.ts, windows.ts, registry.ts, contracts.ts, adapter.ts, observedView.ts, goalieOutlook.ts, sharedGoalieOutlook.ts, retainedBlsh.ts, analysisSnapshot.ts (calc parts), currentNhl.ts (calc parts), nstCapture.ts (mapping), analysisEvidence.ts (market/trade parts)
- web/components/player-cards: ProductionGameChart.tsx, CurrentPlayerCard.tsx (difference), PlayerAnalysisCard.tsx (radar scale)
- web/lib/homepageGameAnalytics.ts, homepagePulse.ts, homepageVisitors.ts
- web/lib/trends: playerTrendCalculator.ts, skaterMetricConfig.ts, goalieMetricConfig.ts, utils.ts, skoUtils.ts, trendsSurface.ts, playerTrendRebuildScope.ts
- web/lib/dashboard: topAddsRanking.ts, topAddsScheduleContext.ts, playerInsightContext.ts, playerOwnership.ts (calc parts)
- web/components/SkaterPage: skaterCalculations.ts, skaterMetrics.ts (calc parts), seasonSkaterRows.ts, skaterFilters.ts
- web/components/GoaliePage: goalieCalculations.ts, goalieMetrics.ts (calc parts), goalieFilters.ts
- web/components/TeamLandingPage: goalieTrends.js (calc parts), GoalieWorkloadBars.js

#### rg/grep patterns
`Math\.|[*/] ?[0-9a-zA-Z(]|reduce\(|percent|average|mean|toFixed|function`, consumer searches for buildPlayerTrendRecords, combineSKO, computeLuck, winsorize, summarizeGoalieTrendConfidence, computeCategoryResults, fantasyPointsAboveAverage, `.from("` table names.

#### Skimmed, judged non-calculating (validation/provenance/display only)
- player-cards: cardEvidenceVerdict.ts, evidenceBundle.ts, evidenceLoader.ts, evidenceAdmissions.ts, evidenceVerdictCopy.ts, playerCatalog.ts (static ID list + token search), currentSelection.ts, shareExport.ts, currentNhlExport.ts, observedExport.ts, analysisExport.ts, currentArtwork.ts, teamLogo.ts, reviewedHeroSamples.ts, interactionSnapshot.ts. goalieOutlook/sharedGoalieOutlook only gate and format upstream values (start probability x100 display); no entry.
- player-card components other than the three above: percentile bar widths = 274*pct/100 (display).
- lib/trends/skoUtils.ts (sparkline min-max scaling for display), skoTypes.ts, types.ts.
- dashboard: normalizers.ts (parsing/coercion only), reliability.ts, freshness.ts (date-gap/staleness classification: gap<=3d ok, >=14d severe; not a stat score), commandCenterData.ts (fetch orchestration; rowCount sum), dataFetchers.ts (fetch + gap-day calc), invariants.ts (range checks 0-1/0-100), perfBudget.ts, forgeLinks.ts, commandCenterLinks.ts, teamMetadata.ts, clientFetchCache.ts.
- dashboard/teamContext.ts: team-level computeTeamPowerScore = mean(off,def,pace) + (3-ppTier)*1.5 + (3-pkTier)*1.5 and computeCtpiDelta = last-first spark value. Team-level, so not entered (outside player-only scope); flag for the team-calc owner.
- StatsPage/*: display only (SV% toFixed, QS%*100, assists = points-goals in MobileTabInterface:117, BSH display). StrengthOfSchedule.tsx displays sos*100 passed in; DoughnutChart.js display.
- SkaterTable/SkaterLeaderboard/SkaterAdvancedMetricsTable, GoalieTable/GoalieList/GoalieLeaderboard/GoalieAdvancedMetricsTable: display, sorting, seconds->minutes for TOI (GoalieList:137, :238).

#### Team trend files (owned by another agent; one-line notes, no entries)
- ctpi.ts: CTPI team composite (zScore, buildLinearWeights); team-only.
- recentTeamFormV2.ts / Materialization / Provenance: recent team form candidate (min 5, target 10 games, min component weight 0.65); team-only.
- strengthOfSchedule.ts / strengthOfScheduleContract.ts: SOS ratings, record percentage; team-only.
- teamMetricConfig.ts: team trend categories; teamPercentiles.ts computeCategoryResults: used only by team-power API (dashboard imports its type only).
- None of these functions are used for players (rg checked).

#### Gaps / not finished
- TOI units of player_stats_unified.toi_per_game and NST goalie/skater gamelog toi were not verified against the DB (read-only, no queries); unit red flags are observations from code comments and conversions.
- Did not trace where rolling 20-game skater windows or skater-power percentiles/deltas are computed (pages/api/v1/trends/skater-power.ts, goalie-power.ts are outside this slice).
- Did not read full analysisEvidence/compareMarketReference (lib/buyLowSellHigh is outside slice) or upstream sustainability luck_pressure.
- Goalie weekly aggregate/league average source for pages/goalies.js not fully traced (lib/supabase/GoaliePage uses goalie_page_stats, league_averages_goalies, goalie_page_weeks).

#### Addendum pass (six keys added to all entries)
- Now 45 entries: BLSH retained entry rebuilt in full (family 'Player cards & homepage stats / BLSH'); new BLSH current-card evidence + market gap entry; new grouped client-side display derivations entry.
- Status evidence: rg of pages/, pages/api, web/vercel.json (player-trend cron is not in vercel.json; found in web/lib/cron/cronInventory.ts:54 and tasks/TASKS/cron-operations/cron-schedule.md:752, '0 12 * * *'). PlayerAnalysisStudio (analysis snapshot, retained BLSH, goalie outlook) has no page importer, so it is marked draft. NST card path is fixture-only on social-share/player-cards. goalieTrends.js only on pages/statsPlaceholder.tsx.
- Tests: rg of *.test.* / __tests__ / *.spec.* by function/module name. No tests found for trends/utils.ts (sandbox), playerInsightContext.ts, ProductionGameChart (covered indirectly by CurrentPlayerCardStudio test), goalieTrends.js.
- Fixtures: web/lib/player-cards/research-fixtures is empty; __fixtures__/retained has one completion-read folder; BLSH fixtures in web/lib/buyLowSellHigh/__fixtures__.
- Unit caveat stays: player_stats_unified.toi_per_game comes from WGO (w.toi_per_game in supabase/migrations/20260716112908_production_schema_baseline.sql:22793+), and its unit (seconds vs minutes) is not confirmed without a DB read.

## Appendix: lines-wigo-goalies-coverage

### Coverage: Lines / TOI / PP units, WiGO, Goalie starters & starter odds

56 entries in `parts/lines-wigo-goalies.json`. All entries carry the six addendum keys. Every test, fixture and `where` path was checked for existence by script. Line numbers come from reads made on 2026-11-10.

#### Files read in full or in the calc-bearing ranges
- web/lib/lines: authority, decisions, gameState, reconcile, beatReporterInference (full). processor, service, trainerDecisions, sourceClaims, identity, binding, storage and webhookErrorDiagnostic were only checked with rg for numeric logic; they are mostly plumbing and validation.
- web/lib/exactFivePp: exactFivePpUnits (full), exactFivePpOracle (header).
- team_unit_toi: lib/rankings/teamUnitToiBuilder (full), teamUnitToiNightly (plan/complete), teamUnitToiWriter (fetch/upsert only), and the route pages/api/v1/db/update-team-unit-toi (helpers).
- web/utils: getPowerPlayBlocks, extractPPDetails, calculateWigoRatings, calculatePercentiles, fetchWigoRatingStats, tierUtils (all full). fetchWigoPercentiles and fetchWigoPlayerStats were read in their calc ranges. formattingUtils.calculateRollingAverage.
- PP units: pages/api/v1/db/update-power-play-combinations/[gameId].ts, lib/supabase/Upserts/powerPlayCombinationMetrics.ts, pages/api/v1/db/powerPlayTimeFrame.ts, pages/api/toi.ts.
- Linemate and lines: components/LinemateMatrix (index and utilities), pages/api/v1/db/update-line-combinations/[id].ts, components/LineCombinations/utilities.ts, components/ShiftChart/model.ts, components/DateRangeMatrix (fetchAggregatedData buildAggregatedPlayers, useTOIData percent block, lineCombinationHelper), and web/supabase/migrations/20260629020121 (deployment tallies SQL).
- Shift ingest: lib/projections/ingest/shifts.ts lines 95-330 and 596-900, lib/supabase/Upserts/nhlShiftStints.ts, nhlOnIceAttribution.ts, pages/api/v1/db/shift-charts.ts (lines 300-560 and 721-1000), update-shifts.ts, update-nhl-shift-charts.ts.
- lib/sources calc parts: lineSourceFirstArrival, tweetLunaEvaluationScoring, tweetClaimEvaluation, oddsSourceIngestion (implied probability), tweetSwipeTrainer (confidence), tweetNewsInference (thresholds), injuryStatusIngestion (confidence), and lineupSourceIngestion (goalie source TTL, ranking and model source).
- WiGO: components/WiGO ratingWeights, teamPerformanceDriverModel, gameLogMean, tableUtils, statMetadata (normalization), RateStatPercentiles (calc block), ConsistencyChart, GameScoreLineChart, PpgLineChart and ToiLineChart (grep). pages/api/v1/db/calculate-wigo-stats.ts lines 150-950. The SQL get_skater_game_scores_for_season is in supabase/migrations/20260716112908_production_schema_baseline.sql:1342.
- Goalies: lib/projections/starterBoardScoring (full), startChartFantasyScoring (ranks), starterBoardValidation (decisions), goalieStarterMixtures (full), calculators/goalie-starter.ts (full), constants/projection-weights (goalie constants), queries/goalie-queries.ts (starter context and line-combo prior), stages/goalie-stage.ts lines 385-512, stages/skater-stage.ts lines 3520-3615, preflight-stage.ts lines 150-200, dailyBoardEvidence.ts lines 200-240, pages/api/v1/db/update-goalie-projections-v2.ts (full), update-goalie-starter-mixtures.ts, migrations/20251126_create_goalie_start_projections.sql and 20251126_calculate_goalie_projections.sql, lib/goalieWorkload.ts, lib/projections/goalie/workloadEvidence.ts, components/Variance/*.
- Status evidence came from tasks/TASKS/cron-operations/cron-schedule.md, which lib/cron/cronInventory.ts names as the canonical pg_cron inventory. Only route names were grepped there.

#### rg patterns used
`team_unit_toi`, `starter.?board|startProb|start.?probab|starterOdds|confirmed.?starter`, `wigo`, `shift` (web/lib excluding xg/projections/rankings), `getPowerPlayBlocks|extractPowerPlayDetails|getPenaltyPowerPlayBlocks`, `pp_timeframes`, `shift_charts`, `computeStarterProbabilities`, `goalieOverrideByTeamId`, `confidence`, `Math\.|reduce|/ ?60|\* ?100` (per file), plus a test-file sweep per module name across *.test.* and *.spec.*.

#### Skimmed and judged non-calculating, or plumbing only
lib/lines processor, service, storage, identity, trainerDecisions and webhookErrorDiagnostic. lib/sources IFTTT/FxTwitter intake, tweetClaim* storage, lineage and registry, playerIdentity*, projectedLineups (report pairing only), lineSourceLineCombinations (12F/6D shape validation only). StarterBoardYahoo, StarterBoardPlayerDetails and StarterBoardValidation components (display). pages/api/internal/starter-board.ts, drain-starter-board and starter-board-release (queue dispatch). starterBoardQueue, starterBoardOperations and starterBoardFlags (env flags, recorded in status). WiGO NameSearchBar, PlayerHeader, WigoHelp, WigoSectionCard, OpponentGamelog, PerGameStatsTable, WigoComparisonMatrix (labels and colour strength only), TimeframeComparison, fetchTeamDriverSnapshots (fetch and coverage dates). TimeOnIceChart (display of /api/toi). PowerPlayAreaIndicators (colour math). GoalieShareChart colour and OKLab math (display only).

#### Known gaps / not finished / suspected misses
- **FORGE goalie stage beyond starter odds** (save % model, workload and rest-split adjustments in goalie-stage.ts lines 290-380 and 514-800, goalieModel.ts, goalie/goalieOutcomes.ts, goalie/leagueSavePct.ts) is only referenced here. I assumed the FORGE agent owns it and did not inventory it. The same applies to the skater-stage PP role and line-change multipliers.
- **pages/api/v1/start-chart.ts (2,238 lines)**: only the goalie mixture call site (line 1539) and the goalie_start_projections read were reviewed. The rest (computeDefenseEaseGrades, team form, ownership and fantasy totals) is unread. computeDefenseEaseGrades looks like a calculation and may need another owner.
- **Variance pages** (pages/variance/skaters.tsx and goalies.js) use components/SkaterPage and GoaliePage modules for weekly fantasy-point variance and peer-bucket value. Those modules are not in my slice and were not read, but they likely hold the live variance math.
- **sko_pp_stats.pp_toi_pct_per_game** and the **nst_percentile_*** tables are produced outside this slice (sKO / NST import). Their scales were not verified.
- **useWigoGameLog, useWigoPlayerTotals and useWigoPlayerDashboard** hooks were grepped only, with no calc found.
- **lib/projections/relationshipPlayerPosition.ts** (position resolution feeding shift-charts line assignment) was not read. Whether primary_position can be 'L'/'R' (the isForward red flag) is unverified.
- **lib/sources/lineupSourceIngestion.ts (1,985 lines)**: only the goalie-source sections were read. Lineup TTL constants were noted (nhl.com 18 h, dailyfaceoff 8 h, gamedaytweets 6 h) but not written up as a separate entry.
- **lib/lines/processor.ts** may hold claim-acceptance thresholds that I did not catch with the numeric grep.
- **DB triggers**: harden_line_combination_trigger_auth calls update-power-play-combinations. The trigger SQL was not read.
- No tests were found for tierUtils, extractPPDetails, the legacy SQL start projections, or ShiftChart PowerPlayAreaIndicators.

## Appendix: draft-misc-coverage

### Coverage: Draft tools + Misc / other (draft-misc.json, 63 entries)

Read-only. No repo files edited, nothing executed except rg/sed/cat/wc. The six addendum keys and the coordinator's VORP/VONA/VBD breakdown (points 1-5 in `method`) are applied.

#### Read in full or near full
- web/hooks/useVORPCalculations.ts, web/hooks/usePlayerRecommendations.ts
- web/lib/draftDashboard: playerValues, positionWeights, forwardGrouping, availability, positionalTiers, tierDashboardAdapter, sourceWeights, sourceAccuracy, sourceRankImpact, categoryBoosts, categoryStandings, roundRankHistory, godView, scheduleMetrics, fantasyPointRecalculation, derivedProjectionStats, draftOrder, previousSeasonTotals, projectionFreshness, projectionCrosscheck
- web/lib/scoring/categoryScores.ts, web/lib/projectionsConfig/proration.ts, fantasyPointsConfig.ts (outside the named slice but they feed draft value)
- web/lib/draft-pro: recommendations, dust, scenarios, reports (adapters only skimmed at the VORP lines)
- web/lib/mockDraft: engine, adapter, research, feasibility (head only)
- web/lib/draft-ranker: placementEngine, communityModel, discovery (main parts), queue (selection section), communityServer (market rank and publish sections), discoveryServer (opportunity section)
- supabase/migrations/20260917133519_mock_draft_adp.sql (mock_draft_adp function only)
- web/lib/api/averages/statsService.ts and helpers.ts
- web/lib/cron/nstRateLimitPolicy.ts, xPollerHealth.ts (threshold and status parts), reportMetrics.ts (limit check)
- web/lib/socialShare: score.ts, streak.ts, teamRates.ts, matchups.ts (40-161), plus top docstrings and key formula lines of every module
- web/lib/homepagePulse.ts, homepageGameAnalytics.ts (shots and xG section)
- hooks/useProcessedProjectionsData.tsx: lines 345-552 and 1080-1450 (blend, actual-stat normalization, derived stats, ADP, FP)

#### Skimmed with rg (formula lines only)
- components/DraftDashboard/*: DraftDashboard (picksUntilNext, teamStats, posNeeds, catNeeds), SuggestedPicks, ProjectionsTable, ComparePlayersModal, DraftSummaryModal, LeagueStandings, DraftBoard, ImportCsvModal, DraftScoringSettings, DustMatrix, RoundRankChart, MockDraftWorkspace, MyRoster
- components/DraftRanker/* and hooks/useDraft*.ts: only pagination and UI math, so no entries
- components: PlayerPickupTable, TeamScheduleCalendar, PlayerStats/* (contract, radar, chart, heatmap, contextual), DateRangeMatrix, Variance, PoissonDistributionChart (+ pages/game/[gameId].tsx lambda), GamePreview, TopMovers, TransactionTrends, MetricsTimeline, forge-command-center, GoalieShareChart, LinemateMatrix, PowerPlayCombos, ShotVisualization, RosterMatrix, CategoryCoverageChart, HomePage/*, SocialShare.tsx
- hooks: all files listed by `wc`, using rg for arithmetic; utils: fetchWigoPlayerStats, fetchWigoPercentiles, fetchWigoRatingStats, formattingUtils
- lib/sources: rg for score, threshold, confidence and probability; read tweetSwipeTrainer scoring, tweetIdentityCandidates distance, oddsSourceIngestion conversion, tweetDecisionReviewResults, tweetLunaEvaluationScoring
- pages (non-api): trends/placeholder, trends/index, trends/player/[playerId], goalies.js, trendsSandbox, rankings, start-chart, fantasy-projections
- One API route was read even though api routes are out of this slice: pages/api/v1/transactions/ownership-trends.ts calculateTrendMovement, because it is the "mover delta" source for TopMovers.

#### rg patterns used
`vorp|replacement|vbd|adp|auction|keeper|tier|zscore|percentile|Math\.(exp|log|sqrt|pow)`; `Math\.(max|min|round|floor|ceil|sqrt|abs|exp|log|pow)|reduce\(|/ 60|\* 60|percentile|average|mean`; `[a-zA-Z_)\]] (/|\*) [a-zA-Z_(0-9]`; for lib/sources: `confidence|score|threshold|probab|similarity|levenshtein`; and per-module name searches for tests in `*.test.*` and `*.spec.*`.

#### Checked and judged non-calculating (or plumbing only)
- lib/transactions/ownershipTrendMetadata.ts (string normalization)
- lib/analytics/edgeMetricCatalog.ts (catalog text)
- lib/api/scanSummary.ts, queryParams, requireApiUser
- lib/routeRunner/* (lease and queue plumbing; no numeric model)
- lib/cron/* apart from nstRateLimitPolicy, nstCoordination, xPollerHealth and reportMetrics: inventory, audit, timing and persistence plumbing
- lib/newsFeed.ts, newsLineupCard.ts (no numeric scoring found), homepageVisitors.ts (max(0, visitors) only)
- lib/socialShare: teamNeon, GoalieShareChart colour math, export and layout constants (colour and contrast math is not counted as a calculation)
- lib/draftDashboard: keepers.ts and pickTrades.ts (slot arithmetic only, grouped into one entry), settingsValidation, csv* and live-draft sync files (mapping and validation)
- lib/draft-pro: access, account, savedDrafts, privateImport*, dustSeason (season mapping)
- DraftRanker components and hooks: pagination only

#### Known gaps and suspected misses
- **Keeper value and auction values: none exist.** Keepers only reserve pick slots (cost "pick" or "none"). No auction, dollar-value or SGP code was found in this slice.
- **Draft Ranker seeding from ADP** (draft_ranking_seed_runs, seed_adp, seed_rank) runs in SQL or RPC migrations that were not read. Only the mock_draft_adp migration was in scope.
- **Code owned by other agents, referenced but not inventoried:**
  - lib/rosterScheduleOptimizer DUST math (Draft Pro DUST is a wrapper entry only)
  - components/GameGrid/utils/calcWeekScore.ts and scheduleOpportunity percentileMap (callers in socialShare are inventoried)
  - utils/calculatePercentiles calculateRankingResult
  - lib/goalieCalculations TGV
- **socialShare modules** were summarized from docstrings and key lines, not read in full. The following may hold further thresholds:
  - riskyStarts tie-breaks (win share vs opponent)
  - startSit conditional forecast
  - trends.ts and trendSources.ts sparkline differencing
  - playerVsPlayer
  - schedule.ts helper sums
- **lib/sources large ingestion files** (lineupSourceIngestion, linesCccIngestion, injuryStatusIngestion, tweetInterpretation, tweetSemanticEvents, tweetPatternReview) were only rg-scanned. They look classification and parse oriented with no numeric scoring found, but some rule thresholds may have been missed.
- **Components not inspected beyond rg:**
  - account/AccountSettingsPage (3.7k lines)
  - TeamStandingsChart (chart axis math only seen)
  - HomepagePlayoffBracket (layout)
  - BeatReporterReview, CronReportEmail (presentation)
  - player-cards: EditorialPlayerCard percentile wording seen, math not traced
  - LinemateMatrix shared-TOI ratio at index.tsx:884 (not entered)
- **Pages with possible inline math not entered:** pages/underlying-stats/index.tsx (38 hits, likely overlaps the underlying-stats lane), trendsSandbox, trendsDebug, trendsTestingGrounds, start-chart (colour math), wigoCharts, splits, podfeed, teamStats/[teamAbbreviation], nhl-predictions, player-forecasts.
- **Projection source configuration** (lib/projectionsConfig/projectionSourcesConfig.ts, statsMasterList.ts) was not read, so source-specific parsers and unit conversions (for example TOI parsers) are unverified.
- **Line numbers** are from rg and sed output on the current working tree, which has uncommitted changes in other lanes. Ranges such as "2464-2523" are approximate block spans.

## Appendix: api-routes-coverage

### Coverage: web/pages/api/** (inline route math)

Slice: 385 non-test files under web/pages/api (TS/JS routes plus 4 Python scripts and 1 docker-compose.yaml). 122 files under v1/db.
Output: 29 JSON entries in parts/api-routes.json (inline calculations only; lib modules belong to other agents).

#### Method
- File inventory: find + wc -l over web/pages/api (no *.test.*).
- rg patterns (glob !**/*.test.*): `Math\.(sqrt|exp|log|pow|abs|max|min|round)`, `reduce\(`, `/ ?60\b`, `\* ?60\b`, `\* ?0\.[0-9]`, `0\.[0-9]+ ?\*`, `percentile`, `zscore|z_score|stdev|variance`, `sigmoid|logistic`, `regress`, `weight`, `/ ?(total|count|games|gp|toi|length)`; per-file hit counts, then read every hit region. 191 files matched the broad brief pattern; most hits were progress bars, pagination, backoff, budget/time math or header mappings.
- For each v1/db file: listed `lib/`/`utils/` imports to build the delegation map below.
- Status evidence: web/vercel.json crons, docs/repository-audit/route-ledger.jsonl (frozen 2026-08-09 audit; incoming_counts), docs/player-projections/duplicate-retirement-ledger.md, web/lib/predictions/legacyQuarantine.ts, rg for route strings in components/hooks/pages/lib.
- Tests: rg for function/route names in *.test.* / *.spec.* under web and functions.

#### Read in full or by region (calculation entries written)
ThreeYearAverages/[playerId].ts, CareerAverages/[playerId].ts, Teams/[teamAbbreviation].ts, SustainabilityStats/[playerId].ts, toi.ts, v1/player/[id]/percentile-rank.ts, v1/trends/skater-power.ts, v1/trends/goalie-power.ts, v1/ml/update-predictions-sko.ts, v1/start-chart.ts (grade + TOI helpers only; 2238 lines, rest is orchestration of lib calls), v1/forge/goalies.ts, v1/transactions/ownership-trends.ts, v1/sustainability/trends.ts, v1/db/update-team-sos.ts, v1/db/update-team-power-ratings.ts, v1/db/update-sko-stats.ts, v1/db/update-wgo-averages.ts, v1/db/calculate-wigo-stats.ts, v1/db/update-goalie-projections-v2.ts, v1/db/run-projection-accuracy.ts (regions), v1/db/run-projection-v2.ts (preflight), v1/db/update-power-play-combinations/[gameId].ts, v1/db/shift-charts.ts (regions), NST writers (cell parsing regions), v1/db/upsert-csv.ts, v1/db/update-nhl-xg-shot-predictions.ts.

#### Skimmed, judged non-calculating or delegating (non-db)
- Delegate to lib: team-ratings.ts and underlying-stats/team-ratings.ts (lib/teamRatingsService); Averages/[playerId] (lib/api/averages/statsService); v1/trends/team-power (lib/trends/teamPercentiles), team-ctpi (lib/trends/ctpi), team-sos (lib/... computeSosRatings; inline only a debug min/max/avg summary), player-trends (lib/trends/playerTrendCalculator); all v1/game-predictions/* (lib/game-predictions/{baselineModel,accountability,workflow,espnOdds,publicPredictions,adminHealth}); v1/sustainability/* except trends.ts (lib/sustainability/{priors,score,windows,bands,bandService,distribution,coverageAudit,entitySurface,recompute,recomputeQueue}); v1/forge/players (lib/projections/forgeSkaterContext, modeledHeadTotals), forge/scoreboard (lib/player-forecasts/servedForecastLedger scoreLedger/scorePairedLedger/scoreMarketLedger), forge/accuracy (reads accuracy_avg *100 for display), forge/forecasts, forge/roster-events; v1/projections/* (lib/projections/apiHelpers); v1/underlying-stats/* (lib/underlying-stats/*, xgExplorer); v1/xg/operations (lib/xg/{flurryAdjusted,reboundHeads,residualSkill,...}); v1/splits (lib/splits); v1/contextual-rankings* and v1/rankings.ts (lib/rankings); v1/draft-pro/* (lib/draft-pro/dust etc.); v1/draft-ranker/* (lib/draft-ranker/*, community = communityReadServer); v1/player-forecasts/* (lib/player-forecasts/*); v1/roster-schedule-optimizer/* (lib/rosterScheduleOptimizer, rosterScheduleData); v1/social-share/* (matchup weeks delegated); v1/homepage/*; v1/lines/projected; v1/debug/rolling-player-metrics (lib/supabase/Upserts/rollingPlayerValidationPayload).
- No math: account/*, internal/* (sync jobs, starter-board), webhooks/*, sources/ifttt/*, cors, createComment, healthz, season/team/schedule/game readers, discord line-combo post (line index = floor(pos/players per line)+1 only), fetch_team_table.ts (renames "/60" to "_perSixty"), Teams/nst-team-stats.ts (scrape + mm:ss formatting).
- ThreeYearAverages/nstgamelog.py, nsttest.py: scrape-and-upsert scripts, no derived math found.

#### v1/db delegation map (all 122 files)
Legend: INLINE = has an entry in api-routes.json; DELEGATES -> module; INGEST = fetch/parse/copy; OPS = operational only; RETIRED = stub.
- audit-nhl-ppt-replay-coverage.ts: DELEGATES -> lib/NHL/pptReplayCoverage
- audit-nhl-xg-backfill.ts: DELEGATES -> lib/xg/backfillCoverageAudit
- auto-news-feed-items.ts: DELEGATES -> lib/sources/tweetNewsInference, tweetNewsAutomation, newsFeed (counts only inline)
- backfill-goalie-underlying-season.ts: DELEGATES -> lib/underlying-stats/goalieStatsSummaryRefresh
- backfill-player-underlying-season.ts: DELEGATES -> lib/underlying-stats/playerStatsSummaryRefresh
- backfill-team-underlying-season.ts: DELEGATES -> lib/underlying-stats/teamStatsSummaryRefresh
- beat-reporter-review.ts: DELEGATES -> lib/lines/beatReporterInference
- build-projection-derived-v2.ts: DELEGATES -> lib/projections/derived/buildStrengthTablesV2, buildGoalieGameV2 (FORGE stage: derived strength tables)
- calculate-wigo-stats.ts: INLINE (WiGO period builder)
- catch-up-goalie-underlying.ts / catch-up-player-underlying.ts / catch-up-team-underlying.ts: DELEGATES -> lib/underlying-stats/*StatsRefreshWindow + *StatsSummaryRefresh
- check-missing-goalie-data.ts: INGEST (NST goalie scrape; cell parsing like update-nst-goalies)
- cron-report.ts: OPS (timing averages, counts) via lib/cron/*
- cron/update-roster-optimizer-schedule-daily.ts: DELEGATES -> lib/rosterScheduleData/planningInputs, recurring; ../update-roster-optimizer-schedule
- cron/update-stats-cron.ts: DELEGATES -> lib/cron/gameStatsCompleteness, transactionalGameStatsPersistence; ../update-stats/[gameId]
- draft-ranker-health.ts: DELEGATES -> lib/draft-ranker/healthServer
- drain-starter-board.ts: DELEGATES -> lib/projections/starterBoardQueue
- forge-served-forecast-settle.ts: DELEGATES -> lib/player-forecasts/servedForecastLedger (forecast settlement)
- forge-served-forecast-snapshot.ts: DELEGATES -> lib/player-forecasts/servedForecastLedger, contributions; lib/rosterScheduleData/forgeDailyBridge
- ingest-projection-inputs.ts: DELEGATES -> lib/projections/ingest/{pbp,shifts}, projectionInputPersistence (FORGE stage: inputs)
- manual-refresh-yahoo-token.ts: OPS
- news-feed-items.ts: DELEGATES -> lib/newsFeed
- nst_gamelog_goalie_scraper.py / nst_gamelog_scraper.py: INGEST (Python; covered in NST normalization entry)
- player-name-aliases.ts: DELEGATES -> lib/sources/playerNameAliases, playerIdentity
- powerPlayTimeFrame.ts: DELEGATES -> utils/getPowerPlayBlocks, utils/extractPPDetails (writes pp_timeframes)
- rebuild-team-underlying-summaries.ts: DELEGATES -> lib/underlying-stats/teamStatsSummaryRefresh
- refresh-draft-ranker-community.ts: DELEGATES -> lib/draft-ranker/communityServer (community rankings)
- refresh-draft-ranker-discovery.ts: DELEGATES -> lib/draft-ranker/discoveryServer
- refresh-roster-optimizer-schedule.ts: DELEGATES -> lib/rosterScheduleData
- register-nhl-xg-model.ts: DELEGATES -> lib/xg/modelRegistry
- replay-player-aliases.ts: DELEGATES -> lib/sources/*
- rolling-coverage-check.ts: OPS (coverage counts)
- route-runner-tick.ts, route-runner/jobs.ts, route-runner/jobs/[id].ts: OPS -> lib/routeRunner/*
- run-fetch-wgo-data.ts: DELEGATES -> lib/supabase/Upserts/fetchWGOdata.js
- run-projection-accuracy.ts: INLINE (accuracy metrics, miss attribution, role buckets); fantasy points via lib/projections/accuracy/fantasyPoints
- run-projection-v2.ts: INLINE preflight gates; projection math DELEGATES -> lib/projections/run-forge-projections, goaliePipeline, constants/projection-weights
- run-rolling-forge-pipeline.ts: OPS orchestrator (vercel.json cron) -> lib/rollingForgePipeline; calls update-games, update-teams, update-players, update-nst-gamelog, update-wgo-skaters/totals, update-line-combinations, update-power-play-combinations, update-rolling-player-averages, ingest-projection-inputs, shift-charts, build-projection-derived-v2, update-goalie-projections-v2, run-projection-v2, run-projection-accuracy
- send-player-name-alias-review.ts: OPS
- shift-charts.ts: INLINE (overlap, line/pair assignment); strength segments DELEGATE -> lib/projections/ingest/shifts, pbp
- skaterArray.ts: RETIRED (410)
- starter-board-release.ts: DELEGATES -> lib/projections/starterBoardOperations, starterBoardValidation
- sustainability/rebuild-baselines.ts: DELEGATES -> lib/baselines/aggregations buildBaselinePayload
- sweep-gamecenter-normalization.ts: DELEGATES -> lib/underlying-stats/*, nhlRawGamecenter.mjs
- tweet-pattern-review.ts: DELEGATES -> lib/sources/tweetPatternReview, tweetSwipeTrainer
- update-PbP.ts: DELEGATES -> ./ingest-projection-inputs
- update-drafted-prospects.ts: DELEGATES -> lib/sources/nhlProspectIdentity
- update-entity-metric-rankings.ts: DELEGATES -> lib/rankings/rankingCalculator, skaterWindowAggregation, entityMetricRankingWriter
- update-game-goal-projections/index.ts: DELEGATES -> lib/gameGoalProjections/calculations (writes expected_goals)
- update-games.ts, update-seasons.ts, update-teams.ts, update-player/[playerId].ts, update-players.ts: INGEST (lib/NHL/server)
- update-goalie-projections-v2.ts: INLINE (start share, GSAA/60)
- update-goalie-starter-mixtures.ts: DELEGATES -> lib/projections/goalieStarterMixtures
- update-goalie-underlying-stats.ts / update-goalie-underlying-summaries.ts: DELEGATES -> lib/underlying-stats/goalieStatsSummaryRefresh, goalieStatsRefreshWindow
- update-last-7-14-30.ts: INGEST (copies WGO single-day game stats into wgo_skater_stats_last_30; see gaps)
- update-line-combinations/index.ts, [id].ts: DELEGATES -> components/LinemateMatrix (sortByLineCombination, getTOIData)
- update-line-sources.ts, update-lines-ccc.ts: DELEGATES -> lib/lines/processor, lib/sources/*
- update-lineup-deployment-tallies.ts: DELEGATES -> SQL RPC refresh_player_lineup_deployment_tallies
- update-lineup-source-provenance.ts: DELEGATES -> lib/sources/lineupSourceIngestion
- update-market-prices.ts: DELEGATES -> lib/sources/oddsSourceIngestion (any implied-probability math is there)
- update-nhl-edge-stats.ts: DELEGATES -> lib/NHL/edgeIngestion
- update-nhl-edge-teams.ts: RETIRED (410)
- update-nhl-play-by-play.ts, update-nhl-shift-charts.ts: DELEGATES -> lib/supabase/Upserts/nhlRawGamecenterRoute
- update-nhl-ppt-replay-tracking.ts: DELEGATES -> lib/NHL/pptReplayIngestion
- update-nhl-xg-adjusted-impact.ts: DELEGATES -> lib/xg/adjustedImpact (+ lib/xg/deploymentContext)
- update-nhl-xg-aggregates.ts: DELEGATES -> lib/xg/aggregates
- update-nhl-xg-created-xg.ts: DELEGATES -> lib/xg/createdXg
- update-nhl-xg-qot-qoc.ts: DELEGATES -> lib/xg/qotQoc
- update-nhl-xg-rebound-control.ts: DELEGATES -> lib/xg/reboundControl
- update-nhl-xg-shot-assists.ts: DELEGATES -> lib/xg/shotAssists
- update-nhl-xg-shot-features.ts: DELEGATES -> lib/supabase/Upserts/nhlShotFeatureBuilder, nhlPlayByPlayParser, lib/xg/shotFeatureEnrichment
- update-nhl-xg-shot-predictions.ts: INLINE gate only; scoring DELEGATES -> lib/xg/shotFeaturePersistence predictShotGoalProbabilities
- update-nhl-xg-transitions.ts: DELEGATES -> lib/xg/transitions
- update-nhl-xg-travel-fatigue.ts: DELEGATES -> lib/xg/travelFatigue
- update-nhlscraper-contracts.ts: DELEGATES -> lib/NHL/nhlscraperContracts
- update-nst-current-season.ts, update-nst-gamelog.ts, update-nst-goalies.ts, update-nst-last-ten.ts, update-nst-player-reports.ts, update-nst-team-daily.ts: INGEST (INLINE cell normalization entry); update-nst-team-daily also imports lib/power-ratings
- update-player-impact-ratings.ts: DELEGATES -> lib/ratings/playerImpactRatings
- update-player-statuses.ts: DELEGATES -> lib/sources/injuryStatusIngestion
- update-player-trend-metrics.ts: DELEGATES -> ../trends/player-trends -> lib/trends/playerTrendCalculator
- update-player-underlying-stats.ts / update-player-underlying-summaries.ts: DELEGATES -> lib/underlying-stats/playerStatsSummaryRefresh, playerStatsRefreshWindow
- update-power-play-combinations/[gameId].ts: INLINE (PP blocks, unit slices); row metrics DELEGATE -> lib/supabase/Upserts/powerPlayCombinationMetrics
- update-power-play-combinations/index.ts: DELEGATES -> ./[gameId]
- update-power-rankings.ts: RETIRED (410)
- update-rolling-games.ts: RETIRED (410)
- update-rolling-player-averages.ts: DELEGATES -> lib/supabase/Upserts/fetchRollingPlayerAverages (rolling averages)
- update-roster-optimizer-schedule.ts: DELEGATES -> lib/rosterScheduleData (RSO)
- update-season-stats.ts, update-stats/[gameId].ts: INGEST -> lib/NHL/htmlReports, lib/cron/* (no derived math found)
- update-shifts.ts: DELEGATES -> ./shift-charts
- update-skater-composite-ratings.ts: DELEGATES -> lib/rankings/skaterCompositeWriter, rankingCalculator
- update-sko-stats.ts: INLINE (IPP, SOG/60)
- update-standings-details/index.ts: INGEST (NHL standings copy)
- update-team-ctpi-daily.ts: DELEGATES -> lib/trends/ctpi computeTrendMetrics, computeCtpi
- update-team-power-ratings-new.ts: RETIRED (quarantine stub, no writes)
- update-team-power-ratings.ts: INLINE tiers/carry-forward; ratings DELEGATE -> lib/power-ratings, lib/teamRatingsTrend
- update-team-sos.ts: INLINE (opponent record tallies)
- update-team-unit-toi.ts: DELEGATES -> lib/rankings/teamUnitToiWriter, teamUnitToiNightly
- update-team-yearly-summary.ts: INGEST (NHL team summary copy to team_summary_years)
- update-wgo-averages.ts: INLINE (3YA/career per-60 table)
- update-wgo-goalie-totals.ts, update-wgo-goalies.ts, update-wgo-skaters.ts, update-wgo-totals.ts: INGEST -> lib/cron/wgoIngestion, wgoGoaliePersistence (no derived math beyond copy)
- update-yahoo-players.ts, update-yahoo-weeks.ts: INGEST -> lib/integrations/yahoo/*
- upsert-csv.ts: INLINE (Levenshtein name match)

#### Must-cover items vs this slice
- weekScore (components/GameGrid/utils/calcWeekScore.ts): not in web/pages/api; no route computes it.
- sKO: covered (update-predictions-sko, update-sko-stats). VuDu, BLSH: no API route computes them inline (blshTrade lives in components/lib).
- RSO: all v1/roster-schedule-optimizer/* routes delegate (no inline math).
- FORGE stages in routes: ingest-projection-inputs (delegates), shift-charts (inline), update-power-play-combinations (inline), build-projection-derived-v2 (delegates), update-goalie-projections-v2 (inline), run-projection-v2 (inline gates; core delegates), run-projection-accuracy (inline), forge-served-forecast-snapshot/settle (delegate), forge/scoreboard (delegates scoring).
- xG: routes only orchestrate; the INCLUDES/EXCLUDES list must come from the lib/xg agent.
- Community rankings: delegate (lib/draft-ranker/communityServer, communityReadServer). Weekly matchup math: social-share/matchup-weeks delegates.

#### Gaps and suspicions (honest)
- Very large files only read by region: start-chart.ts (2238), run-projection-accuracy.ts (2843; holdout comparison report building in lib not traced), update-nst-gamelog.ts (3170), cron-report.ts (2601, ops), update-wgo-skaters.ts (2235), update-sko-stats.ts (1844), run-rolling-forge-pipeline.ts (1792). Inline math could hide in unread regions; grep found none beyond what is listed.
- update-last-7-14-30.ts is not a calculation but maps fields suspiciously (sa_fenwick <- satCounts, sa_corsi <- satPercentages, shots_on_goal <- satCountsStat.shotsOnGoal) and fetches a single day despite its name; worth a look by whoever audits WGO tables.
- TOI units across nst_* tables (seconds vs minutes) were inferred from parsing code, not from schema or data.
- Status labels rely on vercel.json (only 21 cron paths) and the frozen route ledger; many routes are scheduled by Supabase pg_cron or the route-runner registry, which I did not enumerate in SQL.
- shift-charts getPairwiseTOI "always 0" is from reading the call site only; not executed.
- forge/goalies normalization concern assumes rows include non-starters; query filter checked but data not inspected.
- Python scripts in pages/api (not served by Next) checked by grep only.

## Appendix: scripts-python-coverage

### Coverage: scripts + Python slice (web/scripts, functions/api, functions/lib/sko_pipeline.py, functions/scripts, tools, underlying-stats, output, Yahoo .py)

Output: scripts-python.json (33 entries, 18 keys each incl. the six addendum keys). Read-only; no project code executed. Two `python3 -I` one-liners only read saved JSON artifacts (xG model-artifact.json) and wrote the scratchpad files.

#### Inventory
- web/scripts: 148 non-test source files (.ts/.mjs/.js/.py/.sql/.sh) outside fixtures/ and output/. The "464 files" figure includes fixtures, output artifacts, tests and __pycache__.
- web/scripts/modeling/: contains only __pycache__ (no source). web/scripts/output/: JSON artifacts only (no code); used as audit fixtures for xG.
- functions/scripts/: only __pycache__ (run_sustainability_pipeline, seed_sustainability_demo_games, sustainability_live_smoke .pyc); sources missing, nothing to read.
- functions/api: index.py (Flask routing/auth only), fetch_team_table.py (entry added), py-version.py, healthz/index.py (no math). functions/api/player_forecasts/infer.py NOT read (assumed covered by the player_forecasts agent).
- functions/lib/sko_pipeline.py: pure HTTP orchestration of external SKO_PIPELINE_ENDPOINT steps backfill/train/score/upload. No sKO math in this repo slice; the sKO model lives behind that endpoint (or in lib/trends/sko*, other agent). sko-output-authority.ts is path validation only.
- tools/: gen_tree.py, add-cron-audit-to-db-endpoints.mjs, x-twscrape-fallback/fallback.py: no calculations.
- underlying-stats/ (repo root): teamRatingsService.ts and types.ts are 1-line re-exports of web/lib/teamRatingsService; sample-team-ratings.json is a usable fixture for team power ratings (off/def/pace ratings ~100 scale, xgf60 etc.) for the lib agent.
- output/ (repo root): Playwright UI acceptance harness .ts only; no calculations.
- web/lib/supabase/Upserts/Yahoo/*.py: yahooHistoricalOwnership.py is a pass-through of Yahoo percent_owned (weekly snapshot stamped week_end, no math); player_name_matcher.py / populate_yahoo_nhl_mapping.py fuzzy match scoring (entry added); yahooAPI*.py, generate_yahoo_identity_promotion.py: plumbing.

#### rg patterns used
`Math\.|reduce\(|np\.|pandas|sklearn|xgboost|lightgbm|statsmodels|scipy|/ ?60|\* ?60|percentile|zscore|stdev|mean|weight|regress|logistic|poisson|sigmoid|train|fit\(` (per-file counts), then per-file greps for `function |def |Math\.(sqrt|log|exp|pow|abs)|3600|weight|mean|percentile`, plus header-comment reads.

#### Files read in depth (entries made)
train-nhl-xg-baseline.ts, train-nhl-xg-rebound-heads-offline.ts, train_nhl_xg_challengers.py, benchmark-nhl-xg-baselines.ts (gates), run-nhl-xg-release-validation.ts, audit-ctpi-formula.ts, audit-ctpi-multiseason.ts, forge-counterfactual-backtest.ts, forge-reconstruction-backtest.ts (metrics), forge-skater-candidate-ablation.ts, forge-goalie-backtest.ts, fit-forge-dispersion.ts, forge-ledger-evaluate.ts, audit-game-prediction-team-form.ts, audit-nhl-game-prediction-sources.ts (check queries skimmed), performance_prediction.py, fantasy_points_analysis.py, goals_correlation_analysis.py, top_scorers_relationship_analysis.py, WGOAverages/calculateAverages.ts, fetch_team_table.py (both copies), import-player-forecast-season-settlement.ts, audit-player-trend-playoff-repair.ts / audit-player-trend-expected-shooting.ts / audit-team-power-repair.ts / audit-team-underlying-vs-nhl.ts / check-rolling-player-* (grouped), Yahoo player_name_matcher.py. Also read lib/xg/baselineDataset.ts presets, nhlCoordinates/nhlRebounds/nhlRush/nhlFlurries constants, and two saved xG model artifacts to state xG includes/excludes.

#### Skimmed and judged non-calculating (plumbing / orchestration / validation wrappers around lib)
forge-daily.ts, forge-daily-v2.ts, forge-daily-universe.ts, native-means-capture.ts, native-means-replay.ts, native-baseline-cadence.ts, preview-native-baseline.ts, qualify-native-players-offline.ts, reconcile-native-intervals.ts, forge-walk-forward-native.ts, forge-horizon-evaluate.ts, forge-calendar-*.ts, run-forge-*.ts, forge-local-*.ts, forge-producer-closure.ts, forge-process-guardian.ts, forge-assist-export.ts, capture-forge-reconstruction.ts, replay-forge-snapshot.ts, verify-forge-release-sha.ts; run-game-prediction-accuracy-loop.ts, forecast-game-predictions.ts, backfill-game-prediction-feature-snapshots.ts, check-game-prediction-health.ts, promote-game-prediction-model-version.ts, import-historical-market-odds.ts (moneyline fields parsed only; implied-prob math is in lib/game-predictions), evaluate-research-game-goals.ts / evaluate-research-goal-baseline.ts (lib wrappers; equality checks 1e-10); import-player-forecast-season*.ts (pass-through), sync/seed/resolve/publish/register/reconcile/compact player-forecast scripts, audit-forecast-population-local.ts; blsh/*.ts and blsh/export_*.py (capture/export plumbing; NST spacing 22 s); check-rankings-*.ts (API latency/health), check-rolling-player-{coverage,runtime-budget,validation-freshness,context-labels}.ts, check-team-unit-toi-source-health.ts, verify-player-underlying-query.ts, refresh-team-underlying-season.ts, recon-nhl-pbp.mjs, ingest-nhl-api-raw.mjs, capture-current-season-sog-baseline.ts, beast/prepareRollingGapRepair.ts, audit-sustainability-*.{ts,mjs} (provenance/inventory, scoring in lib), audit-start-chart-release-gates.ts (calls lib calibrationEligibility), audit-retained-player-pp-evidence.ts (credit attribution, no math), audit-native-goal-ledger.ts, audit-draft-projection-inclusion.ts, audit-xg-registry-feature-coverage.ts (lib featureCoverage), tweet/X/Luna/IFTTT scripts (text parsing, accuracy counts only), draft-pro/* (RLS/Stripe probes), cron-audit-runner.ts, sql-refresh-*.ts, player-summaries-*.ts, repair-wgo-player-season-identity.ts, yahoo-live-draft-*.ts, dev-*.mjs, probe/report starter-board, export-starter-board-forecasts.ts.

#### Gaps / possible misses
- audit-nhl-game-prediction-sources.ts (4,113 lines) read only through its check names and identity predicates; ~60 SQL checks are summarized in one entry.
- check-rolling-player-*.ts reconstruction scripts: summarized as one audit entry; they recompute weighted /60 families via lib, not re-read line by line.
- top_scorers_relationship_analysis.py lines 580-916 and performance_prediction.py predict_future_performance (667-760) skimmed, not read fully.
- Must-cover items outside this slice: weekScore (components/GameGrid), VuDu, BLSH scoring, RSO, sKO model math, xG lib internals: no implementations found in this slice beyond what is listed; BLSH/sKO scripts here are capture/orchestration only.
- Weekly matchup math, community rankings, client-side component math: not present in this slice.

## Appendix: sql-coverage

### SQL slice coverage (calculation inventory)

Output: parts/sql.json (46 entries, each with the 12 base keys + 6 addendum keys). No database was queried; only repo SQL files were read.

#### Sources read
- supabase/migrations/*.sql: 124 files. Baseline 20260716112908_production_schema_baseline.sql: parsed 59 functions, 76 views, 8 matviews, 20 triggers (matches the brief's counts). All later migrations parsed.
- migrations/** (incl. migrations/sql/), sql/**, web/sql/** (functions, ratings, sustainability, tests, views), web/supabase/migrations/**, supabase/migration-archive/pre-baseline-20260716/** (authoritative-root + production-ledger). 185 .sql files total.
- supabase/tests/ listed for tests; web/sql/tests/sko_trends_validation.sql.

#### Method
- Mechanical list: `rg -n -i 'create\s+(or\s+replace\s+)?(function|view|materialized\s+view|trigger|procedure)\b'` over all trees (616 hits), plus a read-only Python parser (scratchpad/work/parse.py) that extracted 612 objects with body heuristics (counts of avg/sum/stddev/percentile/exp/ln/power, window OVER, division, CASE, rank). All objects with nonzero heuristics were opened and classified by reading the body; zero-score objects spot-checked.
- Also searched: `generated always as` (computed columns), `atan|sqrt|degrees` (geometry, none found), `ntile|percent_rank|cume_dist|regr_|corr(` and per-file aggregate counts to catch non-object INSERT...SELECT scripts (found migrations/20251126_populate_team_discipline_stats.sql and the two sustainability seed files).
- Status: rg of each object name across web/ and functions/ (excluding tests, generated types, .sql); tests via rg in *.test.*, __tests__, *.spec.*, supabase/tests, web/sql/tests.
- Later redefinitions: recorded the latest location first and listed earlier ones in "where".

#### Key findings for the merge
- No SQL object computes xG (no shot distance/angle/geometry anywhere in SQL). nhl_xg_* migrations create tables only; the xG model lives outside this slice (TS/Python). xG includes/excludes cannot be answered from SQL.
- Heavy NST/WGO view stack (nst_avg_* -> *_team_per_game -> nst_league_averages -> differentials / nst_att_def_scores / nst_team_scores_all_strengths) is mostly legacy; only nst_league_averages + nst_att_def_scores are read (by the legacy update-game-goal-projections route).
- nst_percentile_* base views contain raw per-60 values; the actual SQL percentile math is only in the *_filtered views, which nothing reads.
- player_totals_unified is the main live SQL calculation surface (sustainability pipeline).
- weekScore, VuDu, BLSH, RSO optimizer, FORGE core stages, xG: not in SQL. FORGE-adjacent SQL inventoried: opponent_skater_allowed_by_position, forge_league_skater_physical_totals, forge_served_forecast_scoreboard_daily (accuracy). forge_latest_rolling_rows, replace_forge_projection_results_atomic, publish/read_forge_game_revisions are PLUMBING (selection/persistence).

#### Judged non-calculating (examples, full list below)
- persist_projection_game_inputs_v1 / persist_projection_game_derived_v1 / persist_shift_chart_relationships_v1 / capture_projection_raw_source_snapshots_v1 and persist_nhl_api_gamecenter_normalized_v1/v2: validate and copy TS-computed payloads (TOI strings, shift durations, coords); aggregates are only count(distinct) checks.
- vw_goalie_stats_unified(_source), goalie_stats_unified(+_snapshot), player_stats_unified, player_gamelogs_unified, vw_team_stats_nst_wgo, mv_team_stats_nst_wgo, wigo_goalies: joins/pass-through (player_stats_unified adds COALESCE 'safe' defaults e.g. possession_pct_safe 0.5).
- Queue/lease/backoff arithmetic (advance_sustainability_recompute_queue 30*2^n s capped 3600, nst_admit_attempt_budget_v1 NST rate-window math, x_timeline_watchdog), auth/vault, draft-pro, ESPN/Fantrax/Yahoo sync, starter-board release control, updated_at triggers.
- publish_player_forecast_season_release_atomic: integrity counts only (32 teams, 84 games check).

#### Gaps / not finished
- Units of NST toi columns (nst_team_*, nst_gamelog_*) not verified against writers; flagged in entries as assumed seconds.
- Did not read every column of the 300-400 line unified views; ratios listed are from grep of '/' and CASE lines.
- Cron schedules for refreshes were not traced (pg_cron jobs live in DB, not repo, except register_* functions).
- Tables whose values are computed by TS (team_power_ratings_daily, sustainability_scores, rolling_player_game_metrics, nhl_xg_*, forge_*) are outside this slice; only their SQL table DDL exists.
- migration-archive: every archived object is superseded in baseline except upsert_yahoo_players_v2 (PLUMBING).

#### Extra non-object calculation sources
- generated column team_unit_toi.unit_share supabase/migrations/20260716112908_production_schema_baseline.sql:26007 CALC (also web/supabase/migrations/20260622150500_create_team_unit_toi.sql:23)
- script migrations/20251126_populate_team_discipline_stats.sql:4 CALC (one-off INSERT...SELECT, same logic as update_team_discipline_stats)
- seed migrations/sql/20250928_seed_sigma_constants.sql:13 CALC-constants
- seed migrations/sql/20250928_seed_sustainability_config.sql:11 CALC-constants
- sql/refresh_example.sql PLUMBING (refresh commands)

#### All objects found (kind name file:line classification)
- materialized view player_baselines_3yr migrations/20250930_add_baseline_3yr_career.sql:8 CALC
- function calculate_goalie_start_projections migrations/20251126_calculate_goalie_projections.sql:8 CALC
- function process_team_goalie_projections migrations/20251126_calculate_goalie_projections.sql:28 CALC
- function update_team_discipline_stats migrations/20251126_trigger_team_discipline_stats.sql:2 CALC
- trigger trigger_update_team_discipline_stats migrations/20251126_trigger_team_discipline_stats.sql:92 PLUMBING
- function public.truncate_rolling_player_game_metrics migrations/20260227_add_truncate_rolling_player_game_metrics_rpc.sql:4 PLUMBING
- function private.upsert_connected_account_tokens migrations/20260327_encrypt_connected_account_tokens_with_vault.sql:82 PLUMBING
- function private.get_connected_account_tokens migrations/20260327_encrypt_connected_account_tokens_with_vault.sql:222 PLUMBING
- function private.cleanup_connected_account_token_secrets migrations/20260327_encrypt_connected_account_tokens_with_vault.sql:272 PLUMBING
- trigger cleanup_connected_account_token_secrets migrations/20260327_encrypt_connected_account_tokens_with_vault.sql:297 PLUMBING
- function public.upsert_connected_account_tokens_secure migrations/20260327_expose_connected_account_token_rpc.sql:1 PLUMBING
- function prevent_nhl_api_game_payloads_raw_mutation migrations/20260330_create_nhl_api_raw_ingestion_tables.sql:25 PLUMBING
- trigger nhl_api_game_payloads_raw_no_update migrations/20260330_create_nhl_api_raw_ingestion_tables.sql:34 PLUMBING
- view nhl_api_pbp_shot_events_v1 migrations/20260330_create_nhl_api_raw_ingestion_tables.sql:218 PLUMBING
- view public.vw_goalie_stats_unified migrations/20260410_repair_goalie_stats_unified_views.sql:16 PLUMBING
- materialized view public.goalie_stats_unified migrations/20260410_repair_goalie_stats_unified_views.sql:402 PLUMBING
- view analytics.vw_nhl_edge_latest_skater_metrics migrations/20260522_create_nhl_edge_metric_tables.sql:241 PLUMBING
- view analytics.vw_nhl_edge_latest_team_metrics migrations/20260522_create_nhl_edge_metric_tables.sql:247 PLUMBING
- view analytics.vw_nhl_edge_latest_goalie_metrics migrations/20260522_create_nhl_edge_metric_tables.sql:253 PLUMBING
- view analytics.vw_nhl_edge_latest_skater_skating_distance_games migrations/20260530_create_nhl_edge_skating_distance_game_tables.sql:96 PLUMBING
- view analytics.vw_nhl_edge_latest_team_skating_distance_games migrations/20260530_create_nhl_edge_skating_distance_game_tables.sql:102 PLUMBING
- function public.set_contextual_snapshot_updated_at migrations/20260605_create_contextual_rankings.sql:816 PLUMBING
- trigger trg_entity_metric_rankings_updated_at migrations/20260605_create_contextual_rankings.sql:827 PLUMBING
- trigger trg_skater_composite_ratings_updated_at migrations/20260605_create_contextual_rankings.sql:835 PLUMBING
- function public.set_contextual_snapshot_updated_at migrations/20260606_add_contextual_snapshot_methodology_version.sql:7 PLUMBING
- trigger trg_entity_metric_rankings_updated_at migrations/20260606_add_contextual_snapshot_methodology_version.sql:18 PLUMBING
- trigger trg_skater_composite_ratings_updated_at migrations/20260606_add_contextual_snapshot_methodology_version.sql:26 PLUMBING
- function public.truncate_rolling_player_game_metrics migrations/20260609_create_rolling_player_metric_support_payloads.sql:72 PLUMBING
- function trg_touch_updated_at migrations/sql/20250928_create_sustainability_run_logs.sql:76 PLUMBING
- trigger trg_sustainability_run_logs_touch migrations/sql/20250928_create_sustainability_run_logs.sql:84 PLUMBING
- materialized view public.team_power_ratings_daily__new sql/001_team_power_ratings.sql:4 CALC
- function public.acquire_xg_execution_lease supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260712214739_xg_execution_leases.sql:31 PLUMBING [archive; superseded by baseline]
- function public.heartbeat_xg_execution_lease supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260712214739_xg_execution_leases.sql:110 PLUMBING [archive; superseded by baseline]
- function public.finish_xg_execution_lease supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260712214739_xg_execution_leases.sql:131 PLUMBING [archive; superseded by baseline]
- function public.acquire_xg_execution_lease supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260712230000_fix_xg_execution_lease_acquire_conflict.sql:1 PLUMBING [archive; superseded by baseline]
- function private.upsert_connected_account_tokens supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260713055537_encrypt_connected_account_tokens_with_vault.sql:82 PLUMBING [archive; superseded by baseline]
- function private.get_connected_account_tokens supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260713055537_encrypt_connected_account_tokens_with_vault.sql:222 PLUMBING [archive; superseded by baseline]
- function private.cleanup_connected_account_token_secrets supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260713055537_encrypt_connected_account_tokens_with_vault.sql:272 PLUMBING [archive; superseded by baseline]
- trigger cleanup_connected_account_token_secrets supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260713055537_encrypt_connected_account_tokens_with_vault.sql:297 PLUMBING [archive; superseded by baseline]
- function public.upsert_connected_account_tokens_secure supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260713055538_expose_connected_account_token_rpc.sql:1 PLUMBING [archive; superseded by baseline]
- function public.get_connected_account_tokens_secure supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260713060931_harden_auth_provider_ownership_and_refresh_tokens.sql:212 PLUMBING [archive; superseded by baseline]
- function public.immutable_unaccent supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260714211247_fix_immutable_unaccent_search_path.sql:197 PLUMBING [archive; superseded by baseline]
- function public.set_fhfh_player_identity_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260714223013_create_fhfh_player_identity_registry.sql:365 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_identities_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260714223013_create_fhfh_player_identity_registry.sql:384 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_external_identities_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260714223013_create_fhfh_player_identity_registry.sql:391 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_identity_aliases_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260714223013_create_fhfh_player_identity_registry.sql:398 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_organization_history_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260714223013_create_fhfh_player_identity_registry.sql:405 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_identity_review_queue_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260714223013_create_fhfh_player_identity_registry.sql:412 PLUMBING [archive; superseded by baseline]
- function public.set_draft_ranker_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715011329_create_draft_ranker_ownership_foundation.sql:355 PLUMBING [archive; superseded by baseline]
- trigger draft_rankings_touch_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715011329_create_draft_ranker_ownership_foundation.sql:370 PLUMBING [archive; superseded by baseline]
- trigger draft_entries_touch_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715011329_create_draft_ranker_ownership_foundation.sql:372 PLUMBING [archive; superseded by baseline]
- trigger draft_watchlist_touch_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715011329_create_draft_ranker_ownership_foundation.sql:374 PLUMBING [archive; superseded by baseline]
- trigger draft_contrib_touch_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715011329_create_draft_ranker_ownership_foundation.sql:376 PLUMBING [archive; superseded by baseline]
- trigger draft_pair_prefs_touch_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715011329_create_draft_ranker_ownership_foundation.sql:378 PLUMBING [archive; superseded by baseline]
- trigger draft_placement_touch_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715011329_create_draft_ranker_ownership_foundation.sql:380 PLUMBING [archive; superseded by baseline]
- function public.initialize_draft_ranking_from_yahoo supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715012955_initialize_draft_ranker_from_yahoo_adp.sql:5 CALC [archive; superseded by baseline]
- function public.reorder_draft_ranking supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715013836_reorder_draft_ranking_sparse.sql:11 CALC [archive; superseded by baseline]
- function public.validate_draft_ranking_order supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715013836_reorder_draft_ranking_sparse.sql:426 PLUMBING [archive; superseded by baseline]
- function public.persist_complete_game_stats_v1 supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715015300_add_transactional_game_stats_manifest.sql:101 PLUMBING [archive; superseded by baseline]
- function public.quarantine_game_stats_v1 supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715015300_add_transactional_game_stats_manifest.sql:594 PLUMBING [archive; superseded by baseline]
- function public.get_unupdated_games supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715015300_add_transactional_game_stats_manifest.sql:724 PLUMBING [archive; superseded by baseline]
- function public.immutable_unaccent supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715024101_add_draft_ranker_player_search.sql:11 PLUMBING [archive; superseded by baseline]
- function public.search_fhfh_draft_players supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715024101_add_draft_ranker_player_search.sql:42 PLUMBING [archive; superseded by baseline]
- function public.request_fhfh_player_addition supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715024101_add_draft_ranker_player_search.sql:244 PLUMBING [archive; superseded by baseline]
- trigger draft_player_preferences_touch_updated_at supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715025809_add_draft_ranker_player_actions.sql:35 PLUMBING [archive; superseded by baseline]
- function public.apply_draft_ranker_player_action supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715025809_add_draft_ranker_player_actions.sql:65 PLUMBING [archive; superseded by baseline]
- function public.begin_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715032036_add_draft_ranker_assisted_placement.sql:25 PLUMBING [archive; superseded by baseline]
- function public.advance_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715032036_add_draft_ranker_assisted_placement.sql:164 PLUMBING [archive; superseded by baseline]
- function public.cancel_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715032036_add_draft_ranker_assisted_placement.sql:294 PLUMBING [archive; superseded by baseline]
- function public.confirm_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715032036_add_draft_ranker_assisted_placement.sql:362 PLUMBING [archive; superseded by baseline]
- function public.begin_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715034601_enforce_single_active_draft_placement.sql:30 PLUMBING [archive; superseded by baseline]
- function public.set_draft_ranker_contribution_preference supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715042519_add_draft_ranker_pairwise_evidence.sql:63 PLUMBING [archive; superseded by baseline]
- function public.issue_draft_ranker_pair_prompt supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715042519_add_draft_ranker_pairwise_evidence.sql:193 PLUMBING [archive; superseded by baseline]
- function public.submit_draft_ranker_pair_comparison supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715042519_add_draft_ranker_pairwise_evidence.sql:339 PLUMBING [archive; superseded by baseline]
- function public.enforce_draft_ranker_pairwise_rate_limit supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715051533_add_draft_ranker_pairwise_rate_controls.sql:70 PLUMBING [archive; superseded by baseline]
- function public.issue_draft_ranker_pair_prompt_guarded supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715051533_add_draft_ranker_pairwise_rate_controls.sql:281 PLUMBING [archive; superseded by baseline]
- function public.submit_draft_ranker_pair_comparison_guarded supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715051533_add_draft_ranker_pairwise_rate_controls.sql:336 PLUMBING [archive; superseded by baseline]
- function public.replace_draft_ranker_discovery_snapshot supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715055259_create_draft_ranker_discovery_materialization.sql:243 PLUMBING [archive; superseded by baseline]
- function public.replace_draft_ranker_community_snapshot supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715061931_create_draft_ranker_community_snapshots.sql:298 PLUMBING [archive; superseded by baseline]
- function public.repair_draft_ranking_ordering supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715070405_add_draft_ranker_ordering_repair.sql:5 CALC [archive; superseded by baseline]
- function public.finalize_non_realized_game_stats_v1 supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715155738_add_non_realized_game_stats_and_season_selector.sql:78 PLUMBING [archive; superseded by baseline]
- function public.get_unupdated_games_for_season supabase/migration-archive/pre-baseline-20260716/authoritative-root/20260715155738_add_non_realized_game_stats_and_season_selector.sql:176 PLUMBING [archive; superseded by baseline]
- function public.upsert_yahoo_players_v2 supabase/migration-archive/pre-baseline-20260716/production-ledger/20250827012920_add_yahoo_ownership_history_and_new_rpc.sql:23 PLUMBING [archive-only, not in baseline]
- function public.upsert_yahoo_players_v3 supabase/migration-archive/pre-baseline-20260716/production-ledger/20250827025631_add_gameid_season_and_upsert_v3.sql:47 PLUMBING [archive; superseded by baseline]
- function public.upsert_players_batch supabase/migration-archive/pre-baseline-20260716/production-ledger/20250827042406_20250827_yahoo_upsert_and_mapping.sql.sql:39 PLUMBING [archive; superseded by baseline]
- function public.acquire_xg_execution_lease supabase/migration-archive/pre-baseline-20260716/production-ledger/20260712223015_xg_execution_leases.sql:31 PLUMBING [archive; superseded by baseline]
- function public.heartbeat_xg_execution_lease supabase/migration-archive/pre-baseline-20260716/production-ledger/20260712223015_xg_execution_leases.sql:110 PLUMBING [archive; superseded by baseline]
- function public.finish_xg_execution_lease supabase/migration-archive/pre-baseline-20260716/production-ledger/20260712223015_xg_execution_leases.sql:131 PLUMBING [archive; superseded by baseline]
- function public.acquire_xg_execution_lease supabase/migration-archive/pre-baseline-20260716/production-ledger/20260712223129_fix_xg_execution_lease_acquire_conflict.sql:1 PLUMBING [archive; superseded by baseline]
- function private.upsert_connected_account_tokens supabase/migration-archive/pre-baseline-20260716/production-ledger/20260713055537_encrypt_connected_account_tokens_with_vault.sql:82 PLUMBING [archive; superseded by baseline]
- function private.get_connected_account_tokens supabase/migration-archive/pre-baseline-20260716/production-ledger/20260713055537_encrypt_connected_account_tokens_with_vault.sql:222 PLUMBING [archive; superseded by baseline]
- function private.cleanup_connected_account_token_secrets supabase/migration-archive/pre-baseline-20260716/production-ledger/20260713055537_encrypt_connected_account_tokens_with_vault.sql:272 PLUMBING [archive; superseded by baseline]
- trigger cleanup_connected_account_token_secrets supabase/migration-archive/pre-baseline-20260716/production-ledger/20260713055537_encrypt_connected_account_tokens_with_vault.sql:297 PLUMBING [archive; superseded by baseline]
- function public.upsert_connected_account_tokens_secure supabase/migration-archive/pre-baseline-20260716/production-ledger/20260713055538_expose_connected_account_token_rpc.sql:1 PLUMBING [archive; superseded by baseline]
- function public.get_connected_account_tokens_secure supabase/migration-archive/pre-baseline-20260716/production-ledger/20260713060931_harden_auth_provider_ownership_and_refresh_tokens.sql:212 PLUMBING [archive; superseded by baseline]
- function public.set_fhfh_player_identity_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260714223013_create_fhfh_player_identity_registry.sql:365 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_identities_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260714223013_create_fhfh_player_identity_registry.sql:384 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_external_identities_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260714223013_create_fhfh_player_identity_registry.sql:391 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_identity_aliases_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260714223013_create_fhfh_player_identity_registry.sql:398 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_organization_history_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260714223013_create_fhfh_player_identity_registry.sql:405 PLUMBING [archive; superseded by baseline]
- trigger set_fhfh_player_identity_review_queue_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260714223013_create_fhfh_player_identity_registry.sql:412 PLUMBING [archive; superseded by baseline]
- function public.set_draft_ranker_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715011329_create_draft_ranker_ownership_foundation.sql:355 PLUMBING [archive; superseded by baseline]
- trigger draft_rankings_touch_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715011329_create_draft_ranker_ownership_foundation.sql:370 PLUMBING [archive; superseded by baseline]
- trigger draft_entries_touch_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715011329_create_draft_ranker_ownership_foundation.sql:372 PLUMBING [archive; superseded by baseline]
- trigger draft_watchlist_touch_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715011329_create_draft_ranker_ownership_foundation.sql:374 PLUMBING [archive; superseded by baseline]
- trigger draft_contrib_touch_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715011329_create_draft_ranker_ownership_foundation.sql:376 PLUMBING [archive; superseded by baseline]
- trigger draft_pair_prefs_touch_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715011329_create_draft_ranker_ownership_foundation.sql:378 PLUMBING [archive; superseded by baseline]
- trigger draft_placement_touch_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715011329_create_draft_ranker_ownership_foundation.sql:380 PLUMBING [archive; superseded by baseline]
- function public.initialize_draft_ranking_from_yahoo supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715012955_initialize_draft_ranker_from_yahoo_adp.sql:5 CALC [archive; superseded by baseline]
- function public.reorder_draft_ranking supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715013836_reorder_draft_ranking_sparse.sql:11 CALC [archive; superseded by baseline]
- function public.validate_draft_ranking_order supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715013836_reorder_draft_ranking_sparse.sql:426 PLUMBING [archive; superseded by baseline]
- function public.immutable_unaccent supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715024101_add_draft_ranker_player_search.sql:10 PLUMBING [archive; superseded by baseline]
- function public.search_fhfh_draft_players supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715024101_add_draft_ranker_player_search.sql:41 PLUMBING [archive; superseded by baseline]
- function public.request_fhfh_player_addition supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715024101_add_draft_ranker_player_search.sql:243 PLUMBING [archive; superseded by baseline]
- trigger draft_player_preferences_touch_updated_at supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715025809_add_draft_ranker_player_actions.sql:34 PLUMBING [archive; superseded by baseline]
- function public.apply_draft_ranker_player_action supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715025809_add_draft_ranker_player_actions.sql:64 PLUMBING [archive; superseded by baseline]
- function public.begin_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715032036_add_draft_ranker_assisted_placement.sql:24 PLUMBING [archive; superseded by baseline]
- function public.advance_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715032036_add_draft_ranker_assisted_placement.sql:163 PLUMBING [archive; superseded by baseline]
- function public.cancel_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715032036_add_draft_ranker_assisted_placement.sql:293 PLUMBING [archive; superseded by baseline]
- function public.confirm_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715032036_add_draft_ranker_assisted_placement.sql:361 PLUMBING [archive; superseded by baseline]
- function public.begin_draft_ranker_placement supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715034601_enforce_single_active_draft_placement.sql:29 PLUMBING [archive; superseded by baseline]
- function public.set_draft_ranker_contribution_preference supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715043956_add_draft_ranker_pairwise_evidence.sql:63 PLUMBING [archive; superseded by baseline]
- function public.issue_draft_ranker_pair_prompt supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715043956_add_draft_ranker_pairwise_evidence.sql:193 PLUMBING [archive; superseded by baseline]
- function public.submit_draft_ranker_pair_comparison supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715043956_add_draft_ranker_pairwise_evidence.sql:339 PLUMBING [archive; superseded by baseline]
- function public.enforce_draft_ranker_pairwise_rate_limit supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715051533_add_draft_ranker_pairwise_rate_controls.sql:70 PLUMBING [archive; superseded by baseline]
- function public.issue_draft_ranker_pair_prompt_guarded supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715051533_add_draft_ranker_pairwise_rate_controls.sql:281 PLUMBING [archive; superseded by baseline]
- function public.submit_draft_ranker_pair_comparison_guarded supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715051533_add_draft_ranker_pairwise_rate_controls.sql:336 PLUMBING [archive; superseded by baseline]
- function public.replace_draft_ranker_discovery_snapshot supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715055259_create_draft_ranker_discovery_materialization.sql:243 PLUMBING [archive; superseded by baseline]
- function public.replace_draft_ranker_community_snapshot supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715061931_create_draft_ranker_community_snapshots.sql:298 PLUMBING [archive; superseded by baseline]
- function public.repair_draft_ranking_ordering supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715070405_add_draft_ranker_ordering_repair.sql:5 CALC [archive; superseded by baseline]
- function public.immutable_unaccent supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715144458_fix_immutable_unaccent_search_path.sql:197 PLUMBING [archive; superseded by baseline]
- function public.persist_complete_game_stats_v1 supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715144606_add_transactional_game_stats_manifest.sql:101 PLUMBING [archive; superseded by baseline]
- function public.quarantine_game_stats_v1 supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715144606_add_transactional_game_stats_manifest.sql:594 PLUMBING [archive; superseded by baseline]
- function public.get_unupdated_games supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715144606_add_transactional_game_stats_manifest.sql:724 PLUMBING [archive; superseded by baseline]
- function public.finalize_non_realized_game_stats_v1 supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715161123_add_non_realized_game_stats_and_season_selector.sql:78 PLUMBING [archive; superseded by baseline]
- function public.get_unupdated_games_for_season supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715161123_add_non_realized_game_stats_and_season_selector.sql:176 PLUMBING [archive; superseded by baseline]
- function public.acquire_lock supabase/migrations/20260716112908_production_schema_baseline.sql:75 PLUMBING
- function public.acquire_xg_execution_lease supabase/migrations/20260716112908_production_schema_baseline.sql:113 PLUMBING
- function public.advance_draft_ranker_placement supabase/migrations/20260716112908_production_schema_baseline.sql:184 PLUMBING
- function public.apply_draft_ranker_player_action supabase/migrations/20260716112908_production_schema_baseline.sql:316 PLUMBING
- function public.begin_draft_ranker_placement supabase/migrations/20260716112908_production_schema_baseline.sql:554 PLUMBING
- function public.calculate_goalie_start_projections supabase/migrations/20260716112908_production_schema_baseline.sql:704 CALC
- function public.cancel_draft_ranker_placement supabase/migrations/20260716112908_production_schema_baseline.sql:730 PLUMBING
- function public.confirm_draft_ranker_placement supabase/migrations/20260716112908_production_schema_baseline.sql:803 PLUMBING
- function public.delete_duplicate_players_in_rosters supabase/migrations/20260716112908_production_schema_baseline.sql:927 PLUMBING
- function public.enforce_draft_ranker_pairwise_rate_limit supabase/migrations/20260716112908_production_schema_baseline.sql:949 PLUMBING
- function public.execute_sql supabase/migrations/20260716112908_production_schema_baseline.sql:1161 PLUMBING
- function public.finalize_non_realized_game_stats_v1 supabase/migrations/20260716112908_production_schema_baseline.sql:1172 PLUMBING
- function public.finish_xg_execution_lease supabase/migrations/20260716112908_production_schema_baseline.sql:1254 PLUMBING
- function public.get_aggregated_player_stats supabase/migrations/20260716112908_production_schema_baseline.sql:1279 CALC
- function public.get_aggregated_player_stats supabase/migrations/20260716112908_production_schema_baseline.sql:1302 CALC
- function public.get_connected_account_tokens_secure supabase/migrations/20260716112908_production_schema_baseline.sql:1326 PLUMBING
- function public.get_skater_game_scores_for_season supabase/migrations/20260716112908_production_schema_baseline.sql:1342 CALC
- function public.get_skaters_avg_stats supabase/migrations/20260716112908_production_schema_baseline.sql:1386 CALC
- function public.get_skaters_info_by_game_id supabase/migrations/20260716112908_production_schema_baseline.sql:1416 PLUMBING
- function public.get_unprocessed_line_combinations supabase/migrations/20260716112908_production_schema_baseline.sql:1455 PLUMBING
- function public.get_unupdated_games supabase/migrations/20260716112908_production_schema_baseline.sql:1472 PLUMBING
- function public.get_unupdated_games_for_season supabase/migrations/20260716112908_production_schema_baseline.sql:1492 PLUMBING
- function public.heartbeat_xg_execution_lease supabase/migrations/20260716112908_production_schema_baseline.sql:1513 PLUMBING
- function public.immutable_unaccent supabase/migrations/20260716112908_production_schema_baseline.sql:1533 PLUMBING
- function public.initialize_draft_ranking_from_yahoo supabase/migrations/20260716112908_production_schema_baseline.sql:1548 CALC
- function public.insert_into_statsupdatestatus supabase/migrations/20260716112908_production_schema_baseline.sql:2000 PLUMBING
- function public.issue_draft_ranker_pair_prompt supabase/migrations/20260716112908_production_schema_baseline.sql:2014 PLUMBING
- function public.issue_draft_ranker_pair_prompt_guarded supabase/migrations/20260716112908_production_schema_baseline.sql:2152 PLUMBING
- function public.persist_complete_game_stats_v1 supabase/migrations/20260716112908_production_schema_baseline.sql:2197 PLUMBING
- function public.prevent_nhl_api_game_payloads_raw_mutation supabase/migrations/20260716112908_production_schema_baseline.sql:2664 PLUMBING
- function public.process_team_goalie_projections supabase/migrations/20260716112908_production_schema_baseline.sql:2677 CALC
- function public.quarantine_game_stats_v1 supabase/migrations/20260716112908_production_schema_baseline.sql:2753 PLUMBING
- function public.refresh_player_lineup_deployment_tallies supabase/migrations/20260716112908_production_schema_baseline.sql:2866 CALC
- function public.refresh_team_power_ratings supabase/migrations/20260716112908_production_schema_baseline.sql:3086 PLUMBING
- function public.reorder_draft_ranking supabase/migrations/20260716112908_production_schema_baseline.sql:3101 CALC
- function public.repair_draft_ranking_ordering supabase/migrations/20260716112908_production_schema_baseline.sql:3509 CALC
- function public.replace_draft_ranker_community_snapshot supabase/migrations/20260716112908_production_schema_baseline.sql:3704 PLUMBING
- function public.replace_draft_ranker_discovery_snapshot supabase/migrations/20260716112908_production_schema_baseline.sql:3924 PLUMBING
- function public.request_fhfh_player_addition supabase/migrations/20260716112908_production_schema_baseline.sql:4176 PLUMBING
- function public.rpc_sko_player_series supabase/migrations/20260716112908_production_schema_baseline.sql:4342 PLUMBING (wrapper; CALC lives in analytics.rpc_sko_player_series)
- function public.safe_z supabase/migrations/20260716112908_production_schema_baseline.sql:4360 CALC
- function public.search_fhfh_draft_players supabase/migrations/20260716112908_production_schema_baseline.sql:4373 PLUMBING
- function public.set_contextual_snapshot_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:4557 PLUMBING
- function public.set_draft_ranker_contribution_preference supabase/migrations/20260716112908_production_schema_baseline.sql:4571 PLUMBING
- function public.set_draft_ranker_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:4697 PLUMBING
- function public.set_fhfh_player_identity_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:4712 PLUMBING
- function public.submit_draft_ranker_pair_comparison supabase/migrations/20260716112908_production_schema_baseline.sql:4727 PLUMBING
- function public.submit_draft_ranker_pair_comparison_guarded supabase/migrations/20260716112908_production_schema_baseline.sql:5038 PLUMBING
- function public.touch_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:5141 PLUMBING
- function public.trg_touch_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:5154 PLUMBING
- function public.truncate_rolling_player_game_metrics supabase/migrations/20260716112908_production_schema_baseline.sql:5167 PLUMBING
- function public.update_team_discipline_stats supabase/migrations/20260716112908_production_schema_baseline.sql:5182 CALC
- function public.update_updated_at_column supabase/migrations/20260716112908_production_schema_baseline.sql:5275 PLUMBING
- function public.upsert_connected_account_tokens_secure supabase/migrations/20260716112908_production_schema_baseline.sql:5289 PLUMBING
- function public.upsert_current_roster_membership supabase/migrations/20260716112908_production_schema_baseline.sql:5314 PLUMBING
- function public.upsert_players_batch supabase/migrations/20260716112908_production_schema_baseline.sql:5356 PLUMBING
- function public.upsert_players_batch supabase/migrations/20260716112908_production_schema_baseline.sql:5434 PLUMBING
- function public.upsert_yahoo_players_v3 supabase/migrations/20260716112908_production_schema_baseline.sql:5532 PLUMBING
- function public.validate_draft_ranking_order supabase/migrations/20260716112908_production_schema_baseline.sql:5672 PLUMBING
- view public.admin__column_catalog supabase/migrations/20260716112908_production_schema_baseline.sql:6978 PLUMBING
- view public.admin__table_profile supabase/migrations/20260716112908_production_schema_baseline.sql:7010 PLUMBING
- view public.admin__table_summary supabase/migrations/20260716112908_production_schema_baseline.sql:7062 PLUMBING
- view public.combined_sos supabase/migrations/20260716112908_production_schema_baseline.sql:7205 CALC
- view public.cron_job_report supabase/migrations/20260716112908_production_schema_baseline.sql:7260 PLUMBING
- view public.gameOutcomes supabase/migrations/20260716112908_production_schema_baseline.sql:8685 CALC
- view public.vw_goalie_stats_unified_source supabase/migrations/20260716112908_production_schema_baseline.sql:9664 PLUMBING
- view public.vw_goalie_stats_unified supabase/migrations/20260716112908_production_schema_baseline.sql:10015 PLUMBING
- materialized view public.goalie_stats_unified supabase/migrations/20260716112908_production_schema_baseline.sql:10419 PLUMBING
- materialized view public.goalie_stats_unified_snapshot supabase/migrations/20260716112908_production_schema_baseline.sql:10734 PLUMBING
- view public.goalie_totals_unified supabase/migrations/20260716112908_production_schema_baseline.sql:11043 CALC
- materialized view public.goalie_totals_unified_snapshot supabase/migrations/20260716112908_production_schema_baseline.sql:11425 PLUMBING
- view public.wigo_goalies supabase/migrations/20260716112908_production_schema_baseline.sql:11525 PLUMBING
- view public.goalie_weekly_aggregates supabase/migrations/20260716112908_production_schema_baseline.sql:11637 CALC
- view public.job_run_details supabase/migrations/20260716112908_production_schema_baseline.sql:11729 PLUMBING
- view public.league_weekly_goalie_averages supabase/migrations/20260716112908_production_schema_baseline.sql:11789 CALC
- view public.vw_team_stats_nst_wgo supabase/migrations/20260716112908_production_schema_baseline.sql:12820 PLUMBING
- materialized view public.mv_team_stats_nst_wgo supabase/migrations/20260716112908_production_schema_baseline.sql:13244 PLUMBING
- view public.nhl_api_pbp_shot_events_v1 supabase/migrations/20260716112908_production_schema_baseline.sql:13689 PLUMBING
- view public.nhl_team_data supabase/migrations/20260716112908_production_schema_baseline.sql:14118 CALC
- view public.nst_avg_all supabase/migrations/20260716112908_production_schema_baseline.sql:15206 CALC
- view public.nst_all_team_per_game supabase/migrations/20260716112908_production_schema_baseline.sql:15253 CALC
- view public.nst_avg_5v5 supabase/migrations/20260716112908_production_schema_baseline.sql:15349 CALC
- view public.nst_avg_pk supabase/migrations/20260716112908_production_schema_baseline.sql:15446 CALC
- view public.nst_avg_pp supabase/migrations/20260716112908_production_schema_baseline.sql:15543 CALC
- view public.nst_league_averages supabase/migrations/20260716112908_production_schema_baseline.sql:15590 CALC
- view public.nst_5v5_team_differentials supabase/migrations/20260716112908_production_schema_baseline.sql:15908 CALC
- view public.nst_5v5_team_per_game supabase/migrations/20260716112908_production_schema_baseline.sql:15993 CALC
- view public.nst_all_team_differentials supabase/migrations/20260716112908_production_schema_baseline.sql:16039 CALC
- view public.nst_pk_team_per_game supabase/migrations/20260716112908_production_schema_baseline.sql:16124 CALC
- view public.nst_pp_team_per_game supabase/migrations/20260716112908_production_schema_baseline.sql:16170 CALC
- view public.nst_att_def_scores supabase/migrations/20260716112908_production_schema_baseline.sql:16216 CALC
- view public.nst_seasonlong_es_counts supabase/migrations/20260716112908_production_schema_baseline.sql:18678 CALC
- view public.nst_seasonlong_es_counts_oi supabase/migrations/20260716112908_production_schema_baseline.sql:18719 CALC
- view public.nst_seasonlong_es_rates supabase/migrations/20260716112908_production_schema_baseline.sql:18762 CALC
- view public.nst_seasonlong_es_rates_oi supabase/migrations/20260716112908_production_schema_baseline.sql:18804 CALC
- view public.nst_percentile_es_defense supabase/migrations/20260716112908_production_schema_baseline.sql:18857 PLUMBING (pass-through join of rate views; inventoried as an entry because WiGO percentiles read it)
- view public.nst_percentile_es_defense_filtered supabase/migrations/20260716112908_production_schema_baseline.sql:18890 CALC
- view public.nst_percentile_es_offense supabase/migrations/20260716112908_production_schema_baseline.sql:18959 PLUMBING (pass-through join of rate views; inventoried as an entry because WiGO percentiles read it)
- view public.nst_percentile_es_offense_filtered supabase/migrations/20260716112908_production_schema_baseline.sql:19009 CALC
- view public.nst_seasonlong_pk_counts supabase/migrations/20260716112908_production_schema_baseline.sql:19108 CALC
- view public.nst_seasonlong_pk_counts_oi supabase/migrations/20260716112908_production_schema_baseline.sql:19149 CALC
- view public.nst_seasonlong_pk_rates supabase/migrations/20260716112908_production_schema_baseline.sql:19192 CALC
- view public.nst_seasonlong_pk_rates_oi supabase/migrations/20260716112908_production_schema_baseline.sql:19234 CALC
- view public.nst_percentile_pk_defense supabase/migrations/20260716112908_production_schema_baseline.sql:19287 PLUMBING (pass-through join of rate views; inventoried as an entry because WiGO percentiles read it)
- view public.nst_percentile_pk_defense_filtered supabase/migrations/20260716112908_production_schema_baseline.sql:19320 CALC
- view public.nst_percentile_pk_offense supabase/migrations/20260716112908_production_schema_baseline.sql:19397 PLUMBING (pass-through join of rate views; inventoried as an entry because WiGO percentiles read it)
- view public.nst_percentile_pk_offense_filtered supabase/migrations/20260716112908_production_schema_baseline.sql:19447 CALC
- view public.nst_seasonlong_pp_counts supabase/migrations/20260716112908_production_schema_baseline.sql:19531 CALC
- view public.nst_seasonlong_pp_counts_oi supabase/migrations/20260716112908_production_schema_baseline.sql:19572 CALC
- view public.nst_seasonlong_pp_rates supabase/migrations/20260716112908_production_schema_baseline.sql:19616 CALC
- view public.nst_seasonlong_pp_rates_oi supabase/migrations/20260716112908_production_schema_baseline.sql:19658 CALC
- view public.nst_percentile_pp_defense supabase/migrations/20260716112908_production_schema_baseline.sql:19711 PLUMBING (pass-through join of rate views; inventoried as an entry because WiGO percentiles read it)
- view public.nst_percentile_pp_defense_filtered supabase/migrations/20260716112908_production_schema_baseline.sql:19744 CALC
- view public.nst_percentile_pp_offense supabase/migrations/20260716112908_production_schema_baseline.sql:19821 PLUMBING (pass-through join of rate views; inventoried as an entry because WiGO percentiles read it)
- view public.nst_percentile_pp_offense_filtered supabase/migrations/20260716112908_production_schema_baseline.sql:19871 CALC
- view public.nst_pk_team_differentials supabase/migrations/20260716112908_production_schema_baseline.sql:19955 CALC
- view public.nst_pp_team_differentials supabase/migrations/20260716112908_production_schema_baseline.sql:20040 CALC
- view public.nst_seasonlong_as_counts supabase/migrations/20260716112908_production_schema_baseline.sql:20388 CALC
- view public.nst_seasonlong_as_counts_oi supabase/migrations/20260716112908_production_schema_baseline.sql:20429 CALC
- view public.nst_seasonlong_as_rates supabase/migrations/20260716112908_production_schema_baseline.sql:20472 CALC
- view public.nst_seasonlong_as_rates_oi supabase/migrations/20260716112908_production_schema_baseline.sql:20514 CALC
- view public.nst_seasonlong_combined_es supabase/migrations/20260716112908_production_schema_baseline.sql:20567 CALC
- view public.nst_seasonlong_combined_pk supabase/migrations/20260716112908_production_schema_baseline.sql:20692 CALC
- view public.nst_seasonlong_combined_pp supabase/migrations/20260716112908_production_schema_baseline.sql:20817 CALC
- view public.nst_team_scores_all_strengths supabase/migrations/20260716112908_production_schema_baseline.sql:21930 CALC
- materialized view public.player_gamelogs_unified supabase/migrations/20260716112908_production_schema_baseline.sql:22126 PLUMBING
- materialized view public.player_stats_unified supabase/migrations/20260716112908_production_schema_baseline.sql:22793 PLUMBING
- materialized view public.player_totals_unified supabase/migrations/20260716112908_production_schema_baseline.sql:23084 CALC
- view public.power_rankings supabase/migrations/20260716112908_production_schema_baseline.sql:23554 CALC
- view public.sustainability_trends_v supabase/migrations/20260716112908_production_schema_baseline.sql:25682 CALC
- view public.team_games supabase/migrations/20260716112908_production_schema_baseline.sql:25806 PLUMBING
- view public.view_active_player_ids_max_season supabase/migrations/20260716112908_production_schema_baseline.sql:26358 PLUMBING
- view public.vw_current_season supabase/migrations/20260716112908_production_schema_baseline.sql:26383 PLUMBING
- view public.vw_active_teams supabase/migrations/20260716112908_production_schema_baseline.sql:26392 PLUMBING
- view public.vw_pp_unit_share_recent supabase/migrations/20260716112908_production_schema_baseline.sql:26405 CALC
- view public.vw_season_game_dates supabase/migrations/20260716112908_production_schema_baseline.sql:26503 PLUMBING
- view public.vw_slate_day supabase/migrations/20260716112908_production_schema_baseline.sql:26517 PLUMBING
- view public.vw_team_abbrev_norm supabase/migrations/20260716112908_production_schema_baseline.sql:26555 PLUMBING
- view public.vw_team_strength_state_daily supabase/migrations/20260716112908_production_schema_baseline.sql:26567 CALC
- view public.vw_team_strength_state_daily_norm supabase/migrations/20260716112908_production_schema_baseline.sql:26618 CALC
- view public.wgo_goalie_stats_per_game supabase/migrations/20260716112908_production_schema_baseline.sql:27290 CALC
- view public.wgo_skater_stats_per_game supabase/migrations/20260716112908_production_schema_baseline.sql:27556 CALC
- materialized view public.yahoo_nhl_player_map_mat supabase/migrations/20260716112908_production_schema_baseline.sql:29863 PLUMBING
- trigger after_game_insert supabase/migrations/20260716112908_production_schema_baseline.sql:37238 PLUMBING
- trigger draft_contrib_touch_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37245 PLUMBING
- trigger draft_entries_touch_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37252 PLUMBING
- trigger draft_pair_prefs_touch_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37259 PLUMBING
- trigger draft_placement_touch_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37266 PLUMBING
- trigger draft_player_preferences_touch_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37273 PLUMBING
- trigger draft_rankings_touch_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37280 PLUMBING
- trigger draft_watchlist_touch_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37287 PLUMBING
- trigger nhl_api_game_payloads_raw_no_update supabase/migrations/20260716112908_production_schema_baseline.sql:37294 PLUMBING
- trigger predictions_sko_touch supabase/migrations/20260716112908_production_schema_baseline.sql:37301 PLUMBING
- trigger set_fhfh_player_external_identities_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37308 PLUMBING
- trigger set_fhfh_player_identities_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37315 PLUMBING
- trigger set_fhfh_player_identity_aliases_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37322 PLUMBING
- trigger set_fhfh_player_identity_review_queue_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37329 PLUMBING
- trigger set_fhfh_player_organization_history_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37336 PLUMBING
- trigger set_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37343 PLUMBING
- trigger set_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37350 PLUMBING
- trigger trg_entity_metric_rankings_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37357 PLUMBING
- trigger trg_skater_composite_ratings_updated_at supabase/migrations/20260716112908_production_schema_baseline.sql:37364 PLUMBING
- trigger trigger_update_team_discipline_stats supabase/migrations/20260716112908_production_schema_baseline.sql:37371 PLUMBING
- function public.upsert_line_combinations_from_source supabase/migrations/20260716112909_add_line_combinations_source_provenance.sql:19 PLUMBING
- function fhfh_internal.require_cron_request_headers supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:5 PLUMBING
- function public.on_new_line_combo supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:34 PLUMBING
- function public.on_new_player_underlying_stats supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:60 PLUMBING
- function public.update_power_play_combinations supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:93 PLUMBING
- trigger after_line_combo_insert supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:125 PLUMBING
- trigger after_player_underlying_stats_insert supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130 PLUMBING
- trigger update_power_play_combinations_after_line_combo_insert supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:136 PLUMBING
- function public.lock_nhl_api_game_payload_snapshot_insert supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:90 PLUMBING
- function public.advance_nhl_api_game_payload_snapshot_head supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:163 PLUMBING
- trigger nhl_api_game_payloads_raw_projection_lock supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:210 PLUMBING
- trigger nhl_api_game_payloads_raw_advance_snapshot_head supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:214 PLUMBING
- trigger nhl_api_game_payloads_raw_no_delete supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:218 PLUMBING
- function public.capture_projection_raw_source_snapshots_v1 supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:526 PLUMBING
- function public.persist_projection_game_inputs_v1 supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:800 PLUMBING
- function public.persist_shift_chart_relationships_v1 supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:2090 PLUMBING
- function public.persist_projection_game_derived_v1 supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:2799 PLUMBING
- function public.advance_projection_pipeline_state_v1 supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:3825 PLUMBING
- function public.enforce_shift_relationship_position_complete_v1 supabase/migrations/20260721013821_enforce_shift_relationship_positions.sql:10 PLUMBING
- trigger shift_charts_relationship_position_complete supabase/migrations/20260721013821_enforce_shift_relationship_positions.sql:74 PLUMBING
- function public.serialize_nhl_api_game_normalization_writes supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:105 PLUMBING
- function public.lock_nhl_api_game_normalization_scope_write supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:121 PLUMBING
- function public.invalidate_nhl_api_game_normalization_on_insert supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:179 PLUMBING
- function public.invalidate_nhl_api_game_normalization_on_delete supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:201 PLUMBING
- function public.invalidate_nhl_api_game_normalization_on_update supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:223 PLUMBING
- trigger nhl_api_game_roster_spots_normalization_serialize supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:258 PLUMBING
- trigger nhl_api_game_roster_spots_normalization_lock supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:261 PLUMBING
- trigger nhl_api_game_roster_spots_normalization_insert supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:264 PLUMBING
- trigger nhl_api_game_roster_spots_normalization_update supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:268 PLUMBING
- trigger nhl_api_game_roster_spots_normalization_delete supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:272 PLUMBING
- trigger nhl_api_pbp_events_normalization_serialize supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:277 PLUMBING
- trigger nhl_api_pbp_events_normalization_lock supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:280 PLUMBING
- trigger nhl_api_pbp_events_normalization_insert supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:283 PLUMBING
- trigger nhl_api_pbp_events_normalization_update supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:287 PLUMBING
- trigger nhl_api_pbp_events_normalization_delete supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:291 PLUMBING
- trigger nhl_api_shift_rows_normalization_serialize supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:296 PLUMBING
- trigger nhl_api_shift_rows_normalization_lock supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:299 PLUMBING
- trigger nhl_api_shift_rows_normalization_insert supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:302 PLUMBING
- trigger nhl_api_shift_rows_normalization_update supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:306 PLUMBING
- trigger nhl_api_shift_rows_normalization_delete supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:310 PLUMBING
- trigger nhl_api_game_payload_snapshot_heads_normalization_serialize supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:315 PLUMBING
- trigger nhl_api_game_payloads_raw_normalization_serialize supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:321 PLUMBING
- function public.invalidate_nhl_api_game_normalization_status supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:325 PLUMBING
- trigger nhl_api_game_payload_snapshot_heads_invalidate_normalization supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:373 PLUMBING
- function public.persist_nhl_api_gamecenter_normalized_v1 supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql:378 PLUMBING
- function public.upsert_yahoo_players_atomic supabase/migrations/20260723113533_make_yahoo_player_writer_atomic.sql:1 PLUMBING
- function public.replace_forge_projection_results_atomic supabase/migrations/20260723121407_replace_forge_projection_results_atomic.sql:1 PLUMBING
- function public.replace_yahoo_player_keys_snapshot supabase/migrations/20260725220704_reconcile_yahoo_player_key_snapshots.sql:36 PLUMBING
- function public.claim_sustainability_recompute_queue supabase/migrations/20260725223034_add_sustainability_version_provenance.sql:221 PLUMBING
- function public.advance_sustainability_recompute_queue supabase/migrations/20260725223034_add_sustainability_version_provenance.sql:249 PLUMBING
- function public.finalize_sustainability_score_snapshot supabase/migrations/20260725223034_add_sustainability_version_provenance.sql:301 CALC
- function public.activate_sustainability_config supabase/migrations/20260725223034_add_sustainability_version_provenance.sql:422 PLUMBING
- view public.yahoo_players_with_normalized_history supabase/migrations/20260725235646_add_normalized_yahoo_ownership_reader.sql:1 PLUMBING
- view public.yahoo_nhl_player_map_read supabase/migrations/20260726000603_harden_yahoo_read_surfaces.sql:91 PLUMBING
- function public.acquire_sko_prediction_run supabase/migrations/20260728225806_add_sko_prediction_run_control.sql:43 PLUMBING
- function public.heartbeat_sko_prediction_run supabase/migrations/20260728225806_add_sko_prediction_run_control.sql:123 PLUMBING
- function public.finish_sko_prediction_run supabase/migrations/20260728225806_add_sko_prediction_run_control.sql:146 PLUMBING
- function public.promote_game_prediction_model_version_atomic supabase/migrations/20260728235000_make_game_prediction_promotion_atomic.sql:10 PLUMBING
- function public.update_all_wgo_skaters supabase/migrations/20260730190000_tombstone_legacy_public_rpcs.sql:25 PLUMBING
- function public.get_skater_game_score_by_limit supabase/migrations/20260730190000_tombstone_legacy_public_rpcs.sql:38 PLUMBING
- function public.calculate_goalie_start_projections supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:8 PLUMBING (tombstone raising Legacy RPC retired)
- function public.get_aggregated_player_stats supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:32 CALC
- function public.upsert_players_batch supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:75 PLUMBING
- function public.replace_yahoo_game_weeks_snapshot supabase/migrations/20260730195000_replace_yahoo_game_weeks_snapshot.sql:27 PLUMBING
- view analytics.vw_team_ratings_daily supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:33 PLUMBING
- view analytics.vw_entity_ratings_daily supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:54 PLUMBING
- view analytics.vw_entity_sustainability_scores supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:131 CALC
- view analytics.vw_nhl_edge_latest_goalie_metrics supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:176 PLUMBING
- view analytics.vw_nhl_edge_latest_skater_metrics supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:225 PLUMBING
- view analytics.vw_nhl_edge_latest_skater_skating_distance_games supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:289 PLUMBING
- view analytics.vw_nhl_edge_latest_team_metrics supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:324 PLUMBING
- view analytics.vw_nhl_edge_latest_team_skating_distance_games supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:401 PLUMBING
- view analytics.vw_player_status_current supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:434 PLUMBING
- view analytics.vw_sko_skater_base supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:483 PLUMBING
- materialized view analytics.mv_sko_skater_moments supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:502 CALC
- view analytics.vw_sko_skater_zscores supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:638 CALC
- view analytics.vw_sko_skater_scores supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:733 CALC
- function analytics.rpc_sko_player_series supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:751 CALC
- function public.stage_wgo_player_season_repair_trends supabase/migrations/20260731015416_repair_wgo_player_season_identity.sql:44 PLUMBING
- function public.repair_wgo_player_season_identity supabase/migrations/20260731015416_repair_wgo_player_season_identity.sql:253 PLUMBING
- view public.goalie_stats_unified supabase/migrations/20260731040341_privatize_unified_materialized_views.sql:68 PLUMBING
- view public.player_stats_unified supabase/migrations/20260731040341_privatize_unified_materialized_views.sql:74 PLUMBING
- view public.player_totals_unified supabase/migrations/20260731040341_privatize_unified_materialized_views.sql:80 PLUMBING (wrapper view over CALC matview internal_stats.player_totals_unified)
- function fhfh_internal.reject_player_forecast_mutation supabase/migrations/20260802163747_add_player_forecast_foundation.sql:397 PLUMBING
- function public.enqueue_player_forecast_job supabase/migrations/20260802163747_add_player_forecast_foundation.sql:442 PLUMBING
- function fhfh_internal.enqueue_player_forecast_observation supabase/migrations/20260802163747_add_player_forecast_foundation.sql:495 PLUMBING
- trigger player_forecast_goalie_observation_enqueue supabase/migrations/20260802163747_add_player_forecast_foundation.sql:585 PLUMBING
- trigger player_forecast_lineup_observation_enqueue supabase/migrations/20260802163747_add_player_forecast_foundation.sql:589 PLUMBING
- function public.claim_player_forecast_jobs supabase/migrations/20260802163747_add_player_forecast_foundation.sql:593 PLUMBING
- function public.finish_player_forecast_job supabase/migrations/20260802163747_add_player_forecast_foundation.sql:634 PLUMBING
- function public.promote_player_forecast_model_atomic supabase/migrations/20260802163747_add_player_forecast_foundation.sql:677 PLUMBING
- function fhfh_internal.invoke_player_forecast_endpoint supabase/migrations/20260802163747_add_player_forecast_foundation.sql:811 PLUMBING
- function public.build_player_forecast_runtime_features supabase/migrations/20260805002036_add_player_forecast_runtime_feature_rpc.sql:1 CALC
- function public.build_player_forecast_runtime_features supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:3 CALC
- function public.enqueue_player_forecast_season_job supabase/migrations/20260813001304_player_forecast_season_v3.sql:619 PLUMBING
- function public.claim_player_forecast_season_jobs supabase/migrations/20260813001304_player_forecast_season_v3.sql:690 PLUMBING
- function public.finish_player_forecast_season_job supabase/migrations/20260813001304_player_forecast_season_v3.sql:732 PLUMBING
- function fhfh_internal.enqueue_player_forecast_season_change supabase/migrations/20260813001304_player_forecast_season_v3.sql:777 PLUMBING
- trigger player_forecast_season_roster_member_enqueue supabase/migrations/20260813001304_player_forecast_season_v3.sql:922 PLUMBING
- trigger player_forecast_season_schedule_game_enqueue supabase/migrations/20260813001304_player_forecast_season_v3.sql:925 PLUMBING
- trigger player_forecast_season_deployment_assignment_enqueue supabase/migrations/20260813001304_player_forecast_season_v3.sql:928 PLUMBING
- trigger player_forecast_season_override_enqueue supabase/migrations/20260813001304_player_forecast_season_v3.sql:931 PLUMBING
- function public.clone_player_forecast_season_run supabase/migrations/20260813001304_player_forecast_season_v3.sql:935 PLUMBING
- function public.publish_player_forecast_season_release_atomic supabase/migrations/20260813001304_player_forecast_season_v3.sql:1007 PLUMBING
- function public.rollback_player_forecast_season_release_atomic supabase/migrations/20260813001304_player_forecast_season_v3.sql:1260 PLUMBING
- function fhfh_internal.invoke_player_forecast_season_endpoint_if_due supabase/migrations/20260813001304_player_forecast_season_v3.sql:1304 PLUMBING
- function fhfh_internal.register_player_forecast_season_cron supabase/migrations/20260813001304_player_forecast_season_v3.sql:1329 PLUMBING
- function public.set_yahoo_draft_updated_at supabase/migrations/20260813015112_yahoo_live_draft_companion.sql:204 PLUMBING
- trigger yahoo_draft_sessions_set_updated_at supabase/migrations/20260813015112_yahoo_live_draft_companion.sql:216 PLUMBING
- trigger yahoo_draft_picks_set_updated_at supabase/migrations/20260813015112_yahoo_live_draft_companion.sql:220 PLUMBING
- function public.claim_yahoo_draft_poll supabase/migrations/20260813015112_yahoo_live_draft_companion.sql:291 PLUMBING
- function public.apply_yahoo_draft_snapshot supabase/migrations/20260813015112_yahoo_live_draft_companion.sql:367 PLUMBING
- function public.record_yahoo_draft_poll_failure supabase/migrations/20260813015112_yahoo_live_draft_companion.sql:757 PLUMBING
- function public.resolve_player_forecast_season_identity supabase/migrations/20260813144701_player_forecast_season_identity_resolution.sql:5 PLUMBING
- function public.commit_fantrax_connection_secure supabase/migrations/20260814192101_fantrax_settings_first.sql:64 PLUMBING
- function public.apply_fantrax_settings_secure supabase/migrations/20260814192101_fantrax_settings_first.sql:584 PLUMBING
- function public.disconnect_fantrax_account_secure supabase/migrations/20260814192101_fantrax_settings_first.sql:784 PLUMBING
- function public.set_espn_fantasy_updated_at supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:190 PLUMBING
- trigger external_league_state_snapshots_set_updated_at supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:202 PLUMBING
- trigger espn_draft_sessions_set_updated_at supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:205 PLUMBING
- trigger espn_draft_picks_set_updated_at supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:208 PLUMBING
- function public.commit_espn_connection_secure supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:278 PLUMBING
- function public.apply_espn_settings_secure supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:552 PLUMBING
- function public.disconnect_espn_account_secure supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:684 PLUMBING
- function public.delete_espn_league_secure supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:725 PLUMBING
- function public.claim_espn_draft_poll supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:780 PLUMBING
- function public.claim_espn_sync_lease supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:828 PLUMBING
- function public.apply_espn_draft_snapshot supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:894 PLUMBING
- function public.record_espn_draft_poll_failure supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:1030 PLUMBING
- function public.apply_player_forecast_season_roster_snapshot supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:235 PLUMBING
- function public.latest_player_forecast_season_roster_observations supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:408 PLUMBING
- function public.clone_player_forecast_season_run supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:469 PLUMBING
- function public.create_player_forecast_season_event_run supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:544 PLUMBING
- function public.publish_player_forecast_season_release_atomic supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:672 PLUMBING
- function public.compact_player_forecast_season_queue supabase/migrations/20260820014700_player_forecast_season_queue_compaction.sql:5 PLUMBING
- function public.create_yahoo_oauth_transaction supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:167 PLUMBING
- function public.consume_yahoo_oauth_transaction supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:200 PLUMBING
- function public.cleanup_yahoo_oauth_transactions supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:235 PLUMBING
- function public.claim_yahoo_token_refresh_lease supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:254 PLUMBING
- function public.release_yahoo_token_refresh_lease supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:320 PLUMBING
- function public.claim_yahoo_draft_poll supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:339 PLUMBING
- function public.nudge_yahoo_draft_poll supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:418 PLUMBING
- function public.bump_yahoo_draft_pick_mapping_revision supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:477 PLUMBING
- trigger yahoo_draft_picks_bump_mapping_revision supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:492 PLUMBING
- function public.reconcile_yahoo_draft_pick_identities supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:496 PLUMBING
- function public.cleanup_yahoo_draft_poll_observations supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:569 PLUMBING
- function public.verified_yahoo_player_identities_read supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:587 PLUMBING
- view public.yahoo_nhl_player_map_read supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:629 PLUMBING
- function fhfh_internal.register_player_forecast_season_cron supabase/migrations/20260826123000_schedule_player_forecast_season_roster_refresh.sql:1 PLUMBING
- function fhfh_internal.enforce_player_forecast_opening_release_editor supabase/migrations/20260826131500_require_editor_for_player_forecast_opening_release.sql:1 PLUMBING
- trigger enforce_player_forecast_opening_release_editor supabase/migrations/20260826131500_require_editor_for_player_forecast_opening_release.sql:23 PLUMBING
- trigger player_forecast_season_override_enqueue supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:12 PLUMBING
- function public.inherit_player_forecast_season_assumptions supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:18 PLUMBING
- function public.clone_player_forecast_season_run_with_assumptions supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:146 PLUMBING
- function public.create_player_forecast_season_event_run_with_assumptions supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:173 PLUMBING
- function public.read_yahoo_player_overlay_as_of supabase/migrations/20260828130824_start_chart_yahoo_overlay_reader.sql:1 PLUMBING
- trigger roster_optimizer_team_games_set_updated_at supabase/migrations/20260829161013_add_roster_optimizer_team_game_schedule.sql:74 PLUMBING
- trigger draft_pro_purchases_touch_updated_at supabase/migrations/20260907143356_draft_pro_foundation.sql:138 PLUMBING
- trigger draft_pro_refund_requests_touch_updated_at supabase/migrations/20260907143356_draft_pro_foundation.sql:139 PLUMBING
- trigger draft_pro_drafts_touch_updated_at supabase/migrations/20260907143356_draft_pro_foundation.sql:140 PLUMBING
- trigger draft_pro_private_imports_touch_updated_at supabase/migrations/20260907143356_draft_pro_foundation.sql:141 PLUMBING
- trigger draft_pro_scenarios_touch_updated_at supabase/migrations/20260907143356_draft_pro_foundation.sql:142 PLUMBING
- function public.begin_draft_pro_stripe_checkout_attempt supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql:24 PLUMBING
- function public.attach_draft_pro_stripe_checkout_session supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql:75 PLUMBING
- function public.record_draft_pro_stripe_event supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql:111 PLUMBING
- trigger draft_pro_save_sessions_touch_updated_at supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:74 PLUMBING
- trigger draft_pro_private_import_uploads_touch_updated_at supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:75 PLUMBING
- function public.begin_draft_pro_save_session supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:77 PLUMBING
- function public.begin_draft_pro_private_import_upload supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:110 PLUMBING
- function public.stage_draft_pro_private_import_upload supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:148 PLUMBING
- function public.read_draft_pro_private_import_upload supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:176 PLUMBING
- function public.commit_draft_pro_save_session supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:186 PLUMBING
- function public.list_draft_pro_saved_drafts supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:251 PLUMBING
- function public.read_draft_pro_snapshot supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:256 PLUMBING
- function public.read_draft_pro_private_import_blob supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:261 PLUMBING
- function public.rename_draft_pro_saved_draft supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:271 PLUMBING
- function public.delete_draft_pro_saved_draft supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:284 PLUMBING
- function public.duplicate_draft_pro_saved_draft supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:301 PLUMBING
- function public.claim_draft_pro_private_import_cleanup supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:319 PLUMBING
- function public.confirm_draft_pro_private_import_cleanup supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:337 PLUMBING
- function public.claim_draft_pro_private_import_upload_cleanup supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:349 PLUMBING
- function public.confirm_draft_pro_private_import_upload_cleanup supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:375 PLUMBING
- function public.redeem_draft_pro_access_code supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:34 PLUMBING
- function public.issue_draft_pro_access_code supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:58 PLUMBING
- function public.revoke_draft_pro_access_code supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:68 PLUMBING
- trigger forge_game_revisions_immutable supabase/migrations/20260916012353_starter_board_game_revisions.sql:23 PLUMBING
- function public.publish_forge_game_revisions supabase/migrations/20260916012353_starter_board_game_revisions.sql:27 PLUMBING
- function public.read_forge_game_revisions supabase/migrations/20260916012353_starter_board_game_revisions.sql:80 PLUMBING
- function fhfh_internal.enqueue_starter_board_game supabase/migrations/20260916014510_starter_board_news_queue.sql:30 PLUMBING
- function fhfh_internal.enqueue_starter_board_observation supabase/migrations/20260916014510_starter_board_news_queue.sql:50 PLUMBING
- trigger starter_board_lineup_news supabase/migrations/20260916014510_starter_board_news_queue.sql:58 PLUMBING
- trigger starter_board_goalie_news supabase/migrations/20260916014510_starter_board_news_queue.sql:60 PLUMBING
- function fhfh_internal.enqueue_starter_board_resolution supabase/migrations/20260916014510_starter_board_news_queue.sql:63 PLUMBING
- trigger starter_board_reviewed_news supabase/migrations/20260916014510_starter_board_news_queue.sql:71 PLUMBING
- function public.claim_starter_board_jobs supabase/migrations/20260916014510_starter_board_news_queue.sql:74 PLUMBING
- function public.finish_starter_board_job supabase/migrations/20260916014510_starter_board_news_queue.sql:103 PLUMBING
- function public.begin_forge_game_run supabase/migrations/20260916014510_starter_board_news_queue.sql:118 PLUMBING
- function fhfh_internal.guard_starter_board_publication supabase/migrations/20260916014510_starter_board_news_queue.sql:150 PLUMBING
- trigger starter_board_publication_guard supabase/migrations/20260916014510_starter_board_news_queue.sql:166 PLUMBING
- function fhfh_internal.enqueue_starter_board_observation supabase/migrations/20260916023000_starter_board_release_control.sql:56 PLUMBING
- function fhfh_internal.enqueue_starter_board_resolution supabase/migrations/20260916023000_starter_board_release_control.sql:72 PLUMBING
- function fhfh_internal.record_starter_board_dispatch supabase/migrations/20260916023000_starter_board_release_control.sql:86 PLUMBING
- trigger starter_board_dispatch_history supabase/migrations/20260916023000_starter_board_release_control.sql:95 PLUMBING
- function public.select_starter_board_revision supabase/migrations/20260916023000_starter_board_release_control.sql:98 PLUMBING
- function fhfh_internal.current_starter_board_revisions supabase/migrations/20260916023000_starter_board_release_control.sql:112 PLUMBING
- function public.freeze_starter_board_pregame supabase/migrations/20260916023000_starter_board_release_control.sql:124 PLUMBING
- function public.read_forge_game_revisions supabase/migrations/20260916023000_starter_board_release_control.sql:136 PLUMBING
- function public.record_starter_board_visibility supabase/migrations/20260916023000_starter_board_release_control.sql:149 PLUMBING
- function public.capture_starter_board_lineup supabase/migrations/20260916044919_starter_board_atomic_lineup_capture.sql:6 PLUMBING
- function fhfh_internal.capture_starter_board_revision_timing supabase/migrations/20260916045842_starter_board_operational_reporting.sql:9 PLUMBING
- trigger starter_board_revision_timing supabase/migrations/20260916045842_starter_board_operational_reporting.sql:18 PLUMBING
- function public.record_starter_board_visibility_timed supabase/migrations/20260916045842_starter_board_operational_reporting.sql:24 PLUMBING
- function public.read_starter_board_operational_events supabase/migrations/20260916045842_starter_board_operational_reporting.sql:41 PLUMBING
- function public.activate_starter_board_release supabase/migrations/20260916052239_starter_board_validation_registry.sql:46 PLUMBING
- function fhfh_internal.record_starter_board_live_slate supabase/migrations/20260916052239_starter_board_validation_registry.sql:56 PLUMBING
- trigger starter_board_live_slate supabase/migrations/20260916052239_starter_board_validation_registry.sql:74 PLUMBING
- function fhfh_internal.guard_starter_board_review supabase/migrations/20260916052239_starter_board_validation_registry.sql:77 PLUMBING
- trigger starter_board_review_guard supabase/migrations/20260916052239_starter_board_validation_registry.sql:99 PLUMBING
- function public.read_starter_board_validation supabase/migrations/20260916052239_starter_board_validation_registry.sql:102 PLUMBING
- function public.capture_starter_board_goalies supabase/migrations/20260916060521_starter_board_atomic_goalie_capture.sql:6 PLUMBING
- function public.mock_draft_register supabase/migrations/20260917133519_mock_draft_adp.sql:37 PLUMBING
- function public.mock_draft_ingest supabase/migrations/20260917133519_mock_draft_adp.sql:59 CALC
- function public.mock_draft_withdraw supabase/migrations/20260917133519_mock_draft_adp.sql:98 PLUMBING
- function public.mock_draft_adp supabase/migrations/20260917133519_mock_draft_adp.sql:113 CALC
- function public.claim_tweet_pipeline_job supabase/migrations/20260919005608_tweet_pipeline_reports_and_review.sql:66 PLUMBING
- function public.import_nhl_prospect_identity supabase/migrations/20260919005622_nhl_draft_identity_ingestion.sql:22 PLUMBING
- function public.import_nhl_prospect_identity supabase/migrations/20260919005852_nhl_prospect_verification_actor.sql:2 PLUMBING
- function public.claim_fantrax_draft_poll supabase/migrations/20260923184653_fantrax_live_draft_sessions.sql:29 PLUMBING
- trigger in_season_grants_touch_updated_at supabase/migrations/20260927104934_in_season_access_workspace.sql:41 PLUMBING
- trigger in_season_workspaces_touch_updated_at supabase/migrations/20260927104934_in_season_access_workspace.sql:43 PLUMBING
- function forge_execution_internal.lock_forge_execution_scope supabase/migrations/20261002021651_forge_local_execution_fence.sql:17 PLUMBING
- function forge_execution_internal.active_forge_local_execution supabase/migrations/20261002021651_forge_local_execution_fence.sql:30 PLUMBING
- function forge_execution_internal.guard_forge_local_reservation supabase/migrations/20261002021651_forge_local_execution_fence.sql:42 PLUMBING
- trigger forge_local_reservation_guard supabase/migrations/20261002021651_forge_local_execution_fence.sql:57 PLUMBING
- function public.inspect_forge_local_attempt supabase/migrations/20261002021651_forge_local_execution_fence.sql:60 PLUMBING
- function public.begin_forge_local_run supabase/migrations/20261002021651_forge_local_execution_fence.sql:73 PLUMBING
- function forge_execution_internal.guard_forge_local_publication supabase/migrations/20261002021651_forge_local_execution_fence.sql:131 PLUMBING
- trigger forge_local_publication_guard supabase/migrations/20261002021651_forge_local_execution_fence.sql:169 PLUMBING
- function public.reject_line_evidence_mutation supabase/migrations/20261002134400_game_line_snapshots.sql:59 PLUMBING
- trigger immutable_evidence supabase/migrations/20261002134400_game_line_snapshots.sql:68 PLUMBING
- function public.append_line_decisions supabase/migrations/20261002134400_game_line_snapshots.sql:73 PLUMBING
- function internal_stats.resolve_goalie_game_team supabase/migrations/20261002140500_resolve_goalie_unified_game_team.sql:4 PLUMBING
- view public.vw_goalie_stats_unified supabase/migrations/20261002140500_resolve_goalie_unified_game_team.sql:114 PLUMBING
- function public.read_forge_game_revisions supabase/migrations/20261004181455_forge_public_revision_reader.sql:7 PLUMBING
- function public.capture_projection_raw_source_snapshots_v1 supabase/migrations/20261011115124_preserve_projection_raw_shift_occurrences.sql:10 PLUMBING
- function public.cas_native_forecast_catalog_head supabase/migrations/20261017183611_native_forecast_catalog_heads.sql:22 PLUMBING
- function private.upsert_connected_account_tokens supabase/migrations/20261019053348_restore_private_token_vault.sql:88 PLUMBING
- function private.get_connected_account_tokens supabase/migrations/20261019053348_restore_private_token_vault.sql:228 PLUMBING
- function private.cleanup_connected_account_token_secrets supabase/migrations/20261019053348_restore_private_token_vault.sql:278 PLUMBING
- trigger cleanup_connected_account_token_secrets supabase/migrations/20261019053348_restore_private_token_vault.sql:302 PLUMBING
- function public.capture_projection_raw_source_snapshots_v1 supabase/migrations/20261019172842_accept_html_report_projection_shift_snapshots.sql:12 PLUMBING
- materialized view public.opponent_skater_allowed_by_position supabase/migrations/20261019211444_opponent_skater_allowed_by_position.sql:7 CALC
- function fhfh_internal.register_opponent_allowed_refresh_cron supabase/migrations/20261019211444_opponent_skater_allowed_by_position.sql:34 PLUMBING
- function public.forge_league_skater_physical_totals supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql:10 CALC
- function public.replace_forge_projection_results_atomic supabase/migrations/20261021165413_forge_projection_results_source_run_fence.sql:7 PLUMBING
- function public.forge_latest_rolling_rows supabase/migrations/20261021182129_forge_latest_rolling_rows.sql:26 PLUMBING
- trigger set_updated_at supabase/migrations/20261021230025_forge_served_forecast_ledger.sql:66 PLUMBING
- view public.forge_served_forecast_scoreboard_daily supabase/migrations/20261021230025_forge_served_forecast_ledger.sql:78 CALC
- trigger set_updated_at supabase/migrations/20261022133743_route_runner_tables.sql:64 PLUMBING
- function public.purge_rso_yahoo_past_lineups supabase/migrations/20261026200000_rso_yahoo_past_lineups.sql:40 PLUMBING
- function public.preserve_wgo_skater_on_ice_goals supabase/migrations/20261029184950_preserve_wgo_skater_on_ice_goals.sql:8 PLUMBING
- trigger wgo_skater_on_ice_goals_preserve_known supabase/migrations/20261029184950_preserve_wgo_skater_on_ice_goals.sql:30 PLUMBING
- function forge_v2_private.forge_v2_confirm_committed_output supabase/migrations/20261029235656_forge_v2_immutable_history.sql:44 PLUMBING
- trigger forge_v2_receipt_barrier supabase/migrations/20261029235656_forge_v2_immutable_history.sql:65 PLUMBING
- function forge_v2_private.forge_v2_hash_payload supabase/migrations/20261029235656_forge_v2_immutable_history.sql:84 PLUMBING
- trigger forge_v2_hash supabase/migrations/20261029235656_forge_v2_immutable_history.sql:96 PLUMBING
- trigger forge_v2_hash supabase/migrations/20261029235656_forge_v2_immutable_history.sql:97 PLUMBING
- function forge_v2_private.forge_v2_reject_mutation supabase/migrations/20261029235656_forge_v2_immutable_history.sql:115 PLUMBING
- trigger forge_v2_immutable supabase/migrations/20261029235656_forge_v2_immutable_history.sql:128 PLUMBING
- trigger forge_v2_no_truncate supabase/migrations/20261029235656_forge_v2_immutable_history.sql:129 PLUMBING
- function public.nst_goalie_verify_day_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:142 PLUMBING
- function public.nst_goalie_ensure_cohort_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:162 PLUMBING
- function public.nst_goalie_read_state_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:223 PLUMBING
- function public.nst_goalie_claim_step_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:244 PLUMBING
- function public.nst_goalie_commit_unit_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:280 PLUMBING
- function public.nst_goalie_finish_step_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:357 PLUMBING
- function public.nst_goalie_hold_step_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:379 PLUMBING
- function public.nst_job_state_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:425 PLUMBING
- function public.nst_job_begin_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:438 PLUMBING
- function public.nst_job_finish_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:458 PLUMBING
- function public.nst_job_hold_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:470 PLUMBING
- function public.nst_admit_attempt_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:484 PLUMBING
- function public.nst_admit_job_attempt_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:493 PLUMBING
- function public.nst_goalie_preparation_state_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:524 PLUMBING
- function public.nst_goalie_prepare_cohort_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:558 PLUMBING
- function public.nst_goalie_progress_v1 supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:619 PLUMBING
- view public.nst_percentile_as_offense supabase/migrations/20261104011002_nst_percentile_as_from_gamelogs.sql:24 PLUMBING (pass-through join of rate views; inventoried as an entry because WiGO percentiles read it)
- view public.nst_percentile_as_defense supabase/migrations/20261104011002_nst_percentile_as_from_gamelogs.sql:71 PLUMBING (pass-through join of rate views; inventoried as an entry because WiGO percentiles read it)
- function public.upsert_yahoo_players_atomic supabase/migrations/20261104011912_clear_stale_yahoo_player_status.sql:22 PLUMBING
- function public.x_timeline_poll_secret_matches supabase/migrations/20261106012951_x_timeline_poll_secret_check.sql:8 PLUMBING
- function public.tweet_intake_providers_touch supabase/migrations/20261106200000_tweet_intake_providers.sql:24 PLUMBING
- trigger tweet_intake_providers_touch supabase/migrations/20261106200000_tweet_intake_providers.sql:39 PLUMBING
- function public.x_timeline_capture_poll_runs supabase/migrations/20261106201221_x_timeline_poll_runs.sql:65 PLUMBING
- function public.x_timeline_watchdog supabase/migrations/20261106210000_x_timeline_watchdog.sql:34 PLUMBING
- function public.x_timeline_watchdog_label supabase/migrations/20261106220000_x_timeline_watchdog_loud_alerts.sql:13 PLUMBING
- function public.x_timeline_watchdog supabase/migrations/20261106220000_x_timeline_watchdog_loud_alerts.sql:32 PLUMBING
- function public.x_timeline_ingest_secret_matches supabase/migrations/20261107181046_x_timeline_twscrape_shadow.sql:22 PLUMBING
- function public.x_timeline_twscrape_observations_prune supabase/migrations/20261107181046_x_timeline_twscrape_shadow.sql:74 PLUMBING
- function public.upsert_current_roster_membership supabase/migrations/20261107192933_rosters_official_seen_at.sql:15 PLUMBING
- function public.nst_admit_attempt_budget_v1 supabase/migrations/20261109015836_nst_admission_post_burst_gap.sql:22 PLUMBING
- function public.persist_nhl_api_gamecenter_normalized_v2 supabase/migrations/20261109034000_gamecenter_normalized_v2_shift_dedupe.sql:13 PLUMBING
- function public.x_timeline_capture_poll_runs supabase/migrations/20261109150000_x_timeline_poll_runs_run_key.sql:26 PLUMBING
- function analytics.rpc_sko_player_series web/sql/functions/analytics.rpc_sko_player_series.sql:4 CALC
- function public.rpc_sko_player_series web/sql/functions/public.rpc_sko_player_series.sql:4 PLUMBING (wrapper; CALC lives in analytics.rpc_sko_player_series)
- view analytics.vw_team_ratings_daily web/sql/ratings/001_create_analytics_rating_contracts.sql:9 PLUMBING
- view analytics.vw_entity_ratings_daily web/sql/ratings/001_create_analytics_rating_contracts.sql:183 PLUMBING
- view analytics.vw_entity_sustainability_scores web/sql/ratings/002_create_analytics_trends_predictions_and_provenance.sql:375 CALC
- view analytics.vw_player_status_current web/sql/ratings/004_create_player_status_history.sql:34 PLUMBING
- view analytics.vw_sko_skater_base web/sql/views/analytics.vw_sko_skater_base.sql:6 PLUMBING
- view analytics.vw_sko_skater_scores web/sql/views/analytics.vw_sko_skater_scores.sql:4 CALC
- view analytics.vw_sko_skater_zscores web/sql/views/analytics.vw_sko_skater_zscores.sql:4 CALC
- function public.refresh_player_lineup_deployment_tallies web/supabase/migrations/20260629020121_create_player_lineup_deployment_tallies.sql:68 CALC
- function public.upsert_line_combinations_from_source web/supabase/migrations/20260711214500_add_line_combinations_source_provenance.sql:19 PLUMBING

## Appendix: sweep-1-coverage

### Coverage: discovery sweep 1 (200 files)

Output: parts/sweep-1.json (9 entries, all "discovered_in_sweep": true).

#### Method
- File list: sweep-1.txt (200 files). Per-file hit counts with rg using the sweep pattern set (Math.*, /60, *60, percentile, zscore, stddev, per60/per_60, regress, sigmoid, logistic, poisson, weighted, AVG(/SUM(, np., .mean(, *WEIGHT/FACTOR/MULTIPLIER/BASELINE/PRIOR/COEF/SHRINK/ALPHA/DECAY/HALF_LIFE/THRESHOLD/CLAMP, softmax/logit/ewma/clamp(, percent_rank/cume_dist/ntile/percentile_cont/stddev_samp/regr_).
- Every hit line printed and triaged; surrounding code read for every page with non-formatting hits (trends/player, underlying-stats index, trendsDebug, trendsSandbox, stats/game, projections/index, fantasy-projections, nhl-predictions, trueGoalieValue, stats/player, start-chart).
- SQL: second pass with a computation-only regex (nullif, *3600, avg/sum/stddev/percent_rank/greatest/least/exp/ln/sqrt, division) to separate DDL from executable math; none of the SQL files compute stats (only DDL, RPC plumbing, metric-description seed text).
- API routes: reused the api-routes agent's v1/db delegation map (parts/api-routes-coverage.md) and confirmed every hit line in my files is plumbing (limit clamps, batch sizes, timeouts, date math) or field mapping.
- Inventory cross-check: existing-inventory.json searched by name/where regex for each candidate to decide NEW vs COVERED vs DUP-IMPL.

#### Per-file disposition
- functions/lib/sustainability/orchestrator.py — COVERED-BY SUS-032 Python logistic scoring, components and quintiles (orchestrates priors/windows/scoring; t20..t80 snapshot thresholds reused, no inline math)
- functions/tests/test_config_loader.py — COVERED-BY SUS-042 config identity / weights validation (test file)
- functions/tests/test_contributions.py — INCIDENTAL (test file; no formula hits)
- functions/tests/test_distribution.py — INCIDENTAL (test file; no formula hits)
- functions/tests/test_full_scoring_pipeline.py — COVERED-BY SUS-031/SUS-032 contributions + logistic scoring (test file)
- functions/tests/test_orchestrator.py — INCIDENTAL (test file; no formula hits)
- functions/tests/test_orchestrator_incremental.py — INCIDENTAL (test file; no formula hits)
- functions/tests/test_orchestrator_retro_enqueue.py — INCIDENTAL (test file; no formula hits)
- functions/tests/test_orchestrator_snapshot_reuse.py — INCIDENTAL (test file; no formula hits)
- functions/tests/test_pipeline.py — INCIDENTAL (test file; no formula hits)
- functions/tests/test_player_forecast_inference.py — COVERED-BY PFC-071 Challenger/inference serving (test file; last_5_mean fixtures)
- functions/tests/test_player_priors.py — INCIDENTAL (test file; no formula hits)
- functions/tests/test_scoring.py — COVERED-BY SUS-032 Python logistic scoring (test file)
- functions/tests/test_scoring_edge_cases.py — COVERED-BY SUS-032 Python logistic scoring (test file)
- functions/tests/test_zscores.py — COVERED-BY SUS-053 Python z-scores (test file)
- migrations/20250115_add_nst_team_gamelogs_tables.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20251126_create_team_discipline_stats.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20251230_add_hits_blocks_metrics.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260309_add_explicit_historical_averages_to_rolling_player_game_metrics.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260311_add_canonical_rolling_player_metric_contract_fields.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260311_add_optional_rolling_player_weighted_rate_metrics.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260314_add_optional_rolling_player_penalties_drawn_metrics.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260410_repair_goalie_stats_unified_views.sql — INCIDENTAL (view rebuild passing NST goalie columns through; no derived expressions)
- migrations/20260522_create_nhl_edge_metric_tables.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260527_create_goalie_starter_mixture_tables.sql — INCIDENTAL (DDL for goalie starter mixtures; math lives in lib/projections/goalieStarterMixtures)
- migrations/20260527_create_nhl_xg_qot_qoc_tables.sql — COVERED-BY XG-038 QoT/QoC percentiles (table DDL/comments only)
- migrations/20260604_secure_public_data_api_tables.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260605_create_contextual_rankings.sql — COVERED-BY RNK-003 Skater contextual metric catalogue (SQL seed copy of formula_description text: per-60 = x / TOI s * 3600, shares, results_luck_index = 100*current/baseline; DDL, no executable math)
- migrations/20260606_add_metric_methodology_metadata.sql — COVERED-BY RNK-003 (methodology metadata text only, e.g. ixG / iFF * 100)
- migrations/20260606_add_rolling_shot_attempts_per_60.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260606_enable_shot_attempts_per_60_metric.sql — COVERED-BY RNK-003 (enables ICF/TOI*3600 metric definition row)
- migrations/20260606_enable_verified_xg_finishing_metrics.sql — COVERED-BY RNK-003 (metric definition rows)
- migrations/20260607_add_true_5v5_rolling_on_ice_xg_metrics.sql — INCIDENTAL (DDL + metric metadata caveats; no computation)
- migrations/20260607_create_nst_gamelog_5v5_skater_tables.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260608072046_add_skater_composite_context_key.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/20260608073908_add_rolling_player_penalties_taken_metrics.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/sql/20250928_add_sustainability_indexes_constraints.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- migrations/sql/20250928_create_sustainability_core_tables.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- modeling/player_forecasts/tests/test_harness.py — COVERED-BY PFC-085 PP shot-rate shrinkage ablation, PFC-026..028 daily_board_models (test file, no re-implemented formulas found)
- supabase/migrations/20260802163747_add_player_forecast_foundation.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20260805001038_add_player_forecast_rest_of_season_outputs.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20260813001304_player_forecast_season_v3.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20260813144701_player_forecast_season_identity_resolution.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20260814192101_fantrax_settings_first.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20260815023132_espn_fantasy_private_beta.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20260820052000_player_forecast_copy_on_write_runs.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20261011160000_preserve_nst_pk_fractional_start_rates.sql — INCIDENTAL (column type change int4 -> double for on_the_fly_starts_per_60; proposal-only note)
- supabase/migrations/20261021172444_rolling_tables_autovacuum_tuning.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20261021185034_drop_unread_rolling_columns.sql — INCIDENTAL (drops unread rolling columns; schema only)
- supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql — COVERED-BY NST-001 NST goalie catch-up planner (SQL request caps least(20|6, 60-attempts), 14-day windows: rate-limit/scheduling, not stats)
- supabase/migrations/20261104010705_nst_gamelog_season_indexes.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- supabase/migrations/20261106220000_x_timeline_watchdog_loud_alerts.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- tools/add-cron-audit-to-db-endpoints.mjs — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/pages/api/Teams/nst-team-stats.ts — INCIDENTAL (scrape + mm:ss <-> seconds formatting)
- web/pages/api/fetch_team_table.ts — INCIDENTAL (header rename /60 -> _perSixty)
- web/pages/api/internal/yahoo-live-draft.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/account/fantrax/player-data.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/audit-nhl-ppt-replay-coverage.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/auto-news-feed-items.ts — COVERED-BY lib/sources/tweetNewsInference (delegates; time windows only)
- web/pages/api/v1/db/beat-reporter-review.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/build-projection-derived-v2.ts — COVERED-BY FORGE derived strength tables (delegates lib/projections/derived)
- web/pages/api/v1/db/check-missing-goalie-data.ts — INCIDENTAL (NST goalie header -> column mapping; cell parsing covered by api-routes NST normalization entry)
- web/pages/api/v1/db/cron-report.ts — INCIDENTAL (cron slot matching windows, durations)
- web/pages/api/v1/db/ingest-projection-inputs.ts — COVERED-BY FORGE inputs ingest (delegates lib/projections/ingest)
- web/pages/api/v1/db/news-feed-items.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/nst_gamelog_goalie_scraper.py — INCIDENTAL (NST header -> column mapping; scrape only)
- web/pages/api/v1/db/player-name-aliases.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/run-rolling-forge-pipeline.ts — INCIDENTAL (orchestrator: chunk budget share, ms-per-player pacing)
- web/pages/api/v1/db/sweep-gamecenter-normalization.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/tweet-pattern-review.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-goalie-underlying-stats.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-goalie-underlying-summaries.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-last-7-14-30.ts — INCIDENTAL (ingest copy of WGO per-60 fields; field-mapping concerns already logged in api-routes coverage)
- web/pages/api/v1/db/update-line-combinations/index.ts — COVERED-BY components/LinemateMatrix line assignment (delegates; candidate window sizing)
- web/pages/api/v1/db/update-line-sources.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-lines-ccc.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-nhl-edge-stats.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-nhl-ppt-replay-tracking.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-nhl-xg-created-xg.ts — COVERED-BY lib/xg/createdXg (delegates)
- web/pages/api/v1/db/update-nhl-xg-rebound-control.ts — COVERED-BY lib/xg/reboundControl (delegates)
- web/pages/api/v1/db/update-nhl-xg-shot-assists.ts — COVERED-BY lib/xg/shotAssists (delegates)
- web/pages/api/v1/db/update-nhl-xg-shot-features.ts — COVERED-BY xG shot feature builder XG-0xx (delegates)
- web/pages/api/v1/db/update-nhl-xg-transitions.ts — COVERED-BY lib/xg/transitions (delegates)
- web/pages/api/v1/db/update-nhl-xg-travel-fatigue.ts — COVERED-BY lib/xg/travelFatigue (delegates)
- web/pages/api/v1/db/update-nhlscraper-contracts.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-player-impact-ratings.ts — COVERED-BY lib/ratings/playerImpactRatings (route lists NST per-60 input columns only)
- web/pages/api/v1/db/update-player-underlying-stats.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-player-underlying-summaries.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-player/[playerId].ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-rolling-player-averages.ts — COVERED-BY lib/supabase/Upserts/fetchRollingPlayerAverages ROLL-* (delegates; duration formatting)
- web/pages/api/v1/db/update-season-stats.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/db/update-wgo-goalie-totals.ts — INCIDENTAL (ingest field mapping)
- web/pages/api/v1/db/update-wgo-goalies.ts — INCIDENTAL (ingest field mapping)
- web/pages/api/v1/db/update-wgo-skaters.ts — INCIDENTAL (ingest; 30.44-day month offseason detection, backoff, progress %)
- web/pages/api/v1/db/update-wgo-totals.ts — INCIDENTAL (ingest field mapping)
- web/pages/api/v1/db/update-yahoo-players.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/draft-pro/fantrax-player-data.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/forge/forecasts.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/forge/players.ts — COVERED-BY lib/projections/forgeSkaterContext (delegates; scenarioCount max, date math)
- web/pages/api/v1/forge/roster-events.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/game-predictions/ingest-espn-odds.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/ml/get-predictions-sko.ts — COVERED-BY sKO points prediction (api-routes); reader only (prediction age in days)
- web/pages/api/v1/player-forecasts/conflicts.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/player-forecasts/jobs/drain.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/player-forecasts/latest.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/roster-schedule-optimizer/data.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/runs/latest.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/sustainability/coverage-audit.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/sustainability/entity-bands.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/sustainability/entity-history.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/sustainability/entity-options.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/sustainability/entity-scores.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/sustainability/rebuild-trend-bands.ts — COVERED-BY SUS-045/SUS-046 trend-band calculator (delegates)
- web/pages/api/v1/sustainability/recompute.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/sustainability/trend-bands.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/api/v1/trends/player-trends.ts — COVERED-BY lib/trends/playerTrendCalculator ROLL-012/ROLL-024 (delegates; limit clamp only)
- web/pages/api/v1/trends/team-power.ts — COVERED-BY lib/trends/teamPercentiles (delegates)
- web/pages/api/v1/underlying-stats/xg.ts — COVERED-BY lib/underlying-stats xgExplorer (delegates; preview row sizing)
- web/pages/api/v1/webhooks/on-new-line-combo.ts — INCIDENTAL (route plumbing: limit clamps, batching, timeouts; any stats delegate to lib per api-routes delegation map)
- web/pages/cssTestingGrounds.tsx — INCIDENTAL (static style demo table headers)
- web/pages/db/index.tsx — INCIDENTAL (UI timer chunking)
- web/pages/db/player-forecast-season-editor.tsx — INCIDENTAL (percent display of confidence/roster probability)
- web/pages/db/runner.tsx — INCIDENTAL (progress %, durations)
- web/pages/db/upsert-projections.tsx — INCIDENTAL (player-name fuzzy match: shared-prefix chars / max length >= 0.5; string matching, compare upsert-csv Levenshtein entry)
- web/pages/fantasy-projections.tsx — NEW (Fantasy projections page confidence tiers and stale/conflict badges); TOI/percent formatting incidental
- web/pages/forge/forecasts.tsx — INCIDENTAL (expiry timer)
- web/pages/nhl-predictions.tsx — INCIDENTAL (percent formatting, candle chart geometry, comparison-bar width = shifted share clamped 3-97; predictions COVERED-BY lib/game-predictions/publicPredictions)
- web/pages/player-forecasts.tsx — INCIDENTAL (candle chart geometry; p10/p90 quantile key lookup for display)
- web/pages/podfeed.tsx — INCIDENTAL (duration formatting, revalidate seconds)
- web/pages/projections/index.tsx — NEW (Legacy projections page diff% colour bands, ADP round buckets, source weight floor); diff% itself COVERED-BY DRF-012
- web/pages/rankings.tsx — COVERED-BY lib/rankings (RNK-*) (renders percentiles; min TOI s/60 display; top-percentile pick for narrative text)
- web/pages/splits/index.tsx — INCIDENTAL (TOI formatting)
- web/pages/start-chart.tsx — INCIDENTAL (RGB colour distance/brightness for team colours, chart axis bounds); grades COVERED-BY Start-chart defense ease grade (api-routes)
- web/pages/stats/game/[gameId].tsx — DUP-IMPL (Game stats page moneyline implied win probability with proportional de-vig — duplicates GPR-038/GPR-037)
- web/pages/stats/player/[playerId].tsx — COVERED-BY components/PlayerStats/playerStatsContract rollingAverage/windowGameLog (calls only; NST per-60 field mapping)
- web/pages/teamStats/[teamAbbreviation].tsx — INCIDENTAL (TOI mm:ss formatting; legacy page)
- web/pages/trends/player/[playerId].tsx — NEW (Player trend page: rolling-vs-baseline delta %, hot/cold streak and L7/L14/L30 quick cards)
- web/pages/trendsDebug.tsx — NEW (trendsDebug sustainability-model feature engineering and demo model)
- web/pages/trendsSandbox.tsx — NEW + DUP-IMPL (Sustainability Sandbox band-status streaks/barometer; Sandbox skater fantasy score duplicates DEFAULT_SKATER_FANTASY_POINTS)
- web/pages/trueGoalieValue.tsx — DUP-IMPL (True Goalie Value default goalie FP settings duplicate DEFAULT_GOALIE_FANTASY_POINTS); rankings COVERED-BY UST-025..UST-030
- web/pages/underlying-stats/index.tsx — DUP-IMPL (Underlying-stats landing popover component z-scores and special-teams bonus — re-implements TEAM-029 league z)
- web/pages/underlying-stats/playerStats/index.tsx — INCIDENTAL (progressive row loading/chunk sizes)
- web/pages/underlying-stats/teamStats/index.tsx — INCIDENTAL (pagination)
- web/pages/underlying-stats/xg/index.tsx — INCIDENTAL (rounding for display)
- web/pages/wigoCharts.tsx — COVERED-BY WiGO components (renders WigoPercentilesSection; layout height math)
- web/scripts/audit-forecast-population-local.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/audit-native-goal-ledger.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/audit-sustainability-trends-dependencies.mjs — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/audit-xg-registry-feature-coverage.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/backfill-gamedaytweets-lines.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/beast/prepareRollingGapRepair.ts — INCIDENTAL (lists per-60 numerator/denominator support columns; gameId validation)
- web/scripts/blsh/nativeProcessCaptureRunner.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/check-rankings-deployment-tiers-performance.ts — INCIDENTAL (asserts averagePercentile present; perf check)
- web/scripts/check-rankings-matrix-performance.ts — INCIDENTAL (perf check URLs)
- web/scripts/check-rankings-source-health.ts — INCIDENTAL (asserts percentile fields finite; health check)
- web/scripts/check-rankings-splits-performance.ts — INCIDENTAL (perf check URL)
- web/scripts/check-rolling-player-coverage.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/check-rolling-player-runtime-budget.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/compact-player-forecast-season-local-queue.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/draft-pro/verify-access-codes-runner.ts — INCIDENTAL (verification runner; token expiry math)
- web/scripts/draft-pro/verify-local-migration.sh — INCIDENTAL (verification shell script; BASELINE = schema file path)
- web/scripts/draft-pro/verify-reports-browser-runner.ts — INCIDENTAL (verification runner; token expiry math)
- web/scripts/draft-pro/verify-reports-routes-runner.ts — INCIDENTAL (verification runner; token expiry math)
- web/scripts/draft-pro/verify-saved-drafts-browser-runner.ts — INCIDENTAL (verification runner; token expiry math)
- web/scripts/draft-pro/verify-saved-drafts-routes-runner.ts — INCIDENTAL (verification runner; token expiry math)
- web/scripts/draft-pro/verify-scenarios-browser-runner.ts — INCIDENTAL (verification runner; token expiry math)
- web/scripts/draft-pro/verify-scenarios-routes-runner.ts — INCIDENTAL (verification runner; token expiry math)
- web/scripts/draft-pro/verify-storage-http.sh — INCIDENTAL (verification shell script; BASELINE = schema file path)
- web/scripts/evaluate-research-game-goals.ts — COVERED-BY lib/projections/researchGameGoals + researchGoalBaseline (delegates; 1e-10 replay equality check)
- web/scripts/evaluate-research-goal-baseline.ts — COVERED-BY lib/projections/researchGoalBaseline (delegates)
- web/scripts/fetch_team_table.py — INCIDENTAL (header rename /60 -> _perSixty)
- web/scripts/forge-assist-export.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/forge-calendar-execution.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/forge-local-ownership.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/forge-process-guardian.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/forge-walk-forward-native.ts — COVERED-BY lib/player-forecasts/baselineRates buildSkaterBaselineRates (delegates; previous season = seasonId - 10001)
- web/scripts/import-player-forecast-season.ts — INCIDENTAL (roster mapping coverage ratio)
- web/scripts/native-baseline-cadence.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/native-means-capture.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/native-means-replay.ts — INCIDENTAL (byte/row budget estimates)
- web/scripts/promote-game-prediction-model-version.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/recon-nhl-pbp.mjs — INCIDENTAL (recon: field presence %)
- web/scripts/reconcile-native-intervals.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/refresh-team-underlying-season.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/rehearse-exhausted-tweet-recovery.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/resolve-player-forecast-season-identities.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/review-ifttt-luna.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/run-forge-calendar-local.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/run-forge-local.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/run-game-prediction-accuracy-loop.ts — COVERED-BY lib/game-predictions/accountability (accuracy/Brier/log-loss computed in lib; script prints)
- web/scripts/seed-player-forecast-fixtures.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/seed-player-forecast-serving-proof.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/scripts/tweet-trainer-regression.ts — COVERED-BY lib/sources/tweetSwipeTrainer (parser accuracy % computed in lib)
- web/scripts/yahoo-live-draft-rehearsal.ts — INCIDENTAL (ops/runner script: deadlines, timeouts, limits, chunking)
- web/sql/ratings/001_create_analytics_rating_contracts.sql — INCIDENTAL (rating table contracts; percentile CHECK 0..1, NULL placeholder views; no computation)
- web/sql/ratings/014_create_tweet_pattern_review_items.sql — INCIDENTAL (schema/DDL/RPC plumbing; pattern hits are per_60 column names, nullif/greatest on text/timestamps)
- web/sql/sustainability/001_create_sustainability_projections.sql — INCIDENTAL (DDL only)
- web/sql/tests/sko_trends_validation.sql — COVERED-BY SKO-002/SKO-004 (smoke-test SELECTs; rpc_sko_player_series(…,5,1.8,1.6,2,3) parameters)
- web/sql/views/analytics.vw_sko_skater_base.sql — COVERED-BY SKO-001/SKO-002 (input join view only; note: joins NST on date_scraped = WGO game date)

#### Gaps and notes
- Large pages read by region only: trendsSandbox.tsx (3196 lines), trendsDebug.tsx (2654), fantasy-projections.tsx (1805), projections/index.tsx (1653). Non-pattern math (plain +,-,/ without Math.*) outside the read regions could be missed.
- Test files (functions/tests/*, modeling/.../test_harness.py) were treated as exercising existing entries; I checked for re-implemented formulas (none found) but did not map each assertion.
- I did not trace whether rolling_player_game_metrics actually has raw per-game columns named goals_per_60 etc. (affects the trend-page L7/L14/L30 cards).
- vw_sko_skater_base (web/sql) joins NST rows on date_scraped = WGO game date; not verified whether the hosted view (supabase reconstruct migration) uses the same join.
- nhl-predictions.tsx comparison bar shifts negative values by the minimum before computing a share (e.g. -0.2 vs 0.1 shows 0% vs 100% before the 3-97 clamp); judged display-only, not inventoried.
- db/upsert-projections.tsx name matcher (shared-prefix ratio >= 0.5) is string matching; skipped per brief, but it is a second fuzzy-name algorithm alongside upsert-csv Levenshtein.

## Appendix: sweep-2-coverage

### Sweep 2 coverage (web/lib a–o, 107 files)

Method: ran the sweep-brief regex over each file with `rg -n` (Math.*, /60, *60, percentile, weighted, *WEIGHT/FACTOR/…/THRESHOLD/CLAMP, clamp(, etc.). For the 20 files with no hits, a case-insensitive search for weight|threshold|factor|baseline|prior|score|ratio|rate. Read the code around every non-trivial hit and checked existing-inventory.json for overlap. Everything was read-only; no code was run.

Totals: 9 NEW entries drawn from 13 files marked NEW, 0 DUP-IMPL, 6 COVERED-BY, 88 INCIDENTAL (107 files).

#### Per-file disposition
- web/lib/NHL/types.ts — INCIDENTAL (PercentileRank type only)
- web/lib/analytics/edgeMetricCatalog.ts — INCIDENTAL (static catalog of NHL Edge endpoints, notes text only)
- web/lib/api/averages/types.ts — COVERED-BY NST career / 3-year averages (counts and rates) with multi-team TOT rows (types only)
- web/lib/api/scanSummary.ts — INCIDENTAL (issue-count clamp)
- web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl — INCIDENTAL (BLSH display fixture: real-player window/reference data; usable as an audit fixture for BLSH entries)
- web/lib/buyLowSellHigh/__fixtures__/syntheticProfiles.ts — INCIDENTAL (synthetic BLSH test profiles: personal_weight 0.8, covariance; audit fixture for supportGap scoreAndAttribute)
- web/lib/buyLowSellHigh/__fixtures__/syntheticSnapshots.ts — INCIDENTAL (synthetic snapshot fixture)
- web/lib/cron/cronInventory.ts — INCIDENTAL (cron hour*60+minute schedule math)
- web/lib/cron/formatDuration.ts — INCIDENTAL (duration formatting)
- web/lib/cron/gameStatsCompleteness.ts — INCIDENTAL (requested row count in error object)
- web/lib/cron/nhlOffSeason.ts — INCIDENTAL (cache TTL)
- web/lib/cron/nstBurstPlans.ts — COVERED-BY NST rate-limit plan assessment (wraps canBurstNstRequests/selectNstSafeInterval/assessNstRequestPlan)
- web/lib/cron/reportSource.ts — INCIDENTAL (deadline/timeout)
- web/lib/cron/sqlRpcExecution.ts — INCIDENTAL (retry attempts)
- web/lib/cron/timingContract.ts — INCIDENTAL (duration clamp)
- web/lib/cron/tweetReviewBacklog.ts — INCIDENTAL (no numeric transform)
- web/lib/cron/wgoGoaliePersistence.ts — INCIDENTAL (pagination clamps)
- web/lib/cron/wgoIngestion.ts — INCIDENTAL (gameId decode season=trunc(id/1e6), type=trunc(id/1e4)%100; page counts)
- web/lib/cron/xPollerHealth.server.ts — COVERED-BY X poller health thresholds (server wrapper: 6 h shadow lead, 2 min grace)
- web/lib/dashboard/dataFetchers.ts — NEW (Dashboard source-date alignment gap (recency state)); samplePolicy constants (minimumGames 3, seriesGames 40, shrink_to_neutral) are declared defaults only; the shrink is implemented upstream (trends API)
- web/lib/dashboard/normalizers.ts — INCIDENTAL (payload parsing; note: normalizeSkaterMoversResponse uses only the FIRST category's rankings by object key order)
- web/lib/draft-pro/access.ts — INCIDENTAL (entitlement expiry / 1 h Patreon verification)
- web/lib/draft-pro/account/refunds.ts — INCIDENTAL (168 h refund window, page limits)
- web/lib/draft-pro/contracts.ts — INCIDENTAL (schemas)
- web/lib/draft-pro/dustRateLimit.ts — INCIDENTAL (retry-after)
- web/lib/draft-pro/exportContract.ts — INCIDENTAL (restricted-source check on sourceWeights keys)
- web/lib/draft-pro/privateImportTransport.ts — INCIDENTAL (chunk math)
- web/lib/draft-pro/recommendationsContract.ts — INCIDENTAL (schema: needAlpha 0..1, categoryWeights; calc COVERED-BY buildPersonalizedRecommendations)
- web/lib/draft-pro/savedDrafts.ts — INCIDENTAL (schema: source weight 0..2, needAlpha 0..1)
- web/lib/draft-pro/scenariosContract.ts — INCIDENTAL (schema)
- web/lib/draft-pro/scenariosServer.ts — INCIDENTAL (freshness wrapper)
- web/lib/draft-pro/server.ts — INCIDENTAL (1 h verification freshness)
- web/lib/draft-ranker/discoveryReadServer.ts — COVERED-BY Draft Ranker discovery signals (owner-relative score = personalRank − consensusRank via deriveOwnerRelativeDiscovery at discovery.ts:500, not itself cited by the inventory; TYPE_PRIORITY ordering)
- web/lib/draft-ranker/exportRateLimit.ts — INCIDENTAL (retry-after)
- web/lib/draft-ranker/health.ts — INCIDENTAL (order-key integrity: minimumGap <= 1 → normalize; < 250 entries → underfilled; blocked/attention/healthy)
- web/lib/draft-ranker/healthServer.ts — INCIDENTAL (24 h window)
- web/lib/draft-ranker/server.ts — INCIDENTAL (reviewedThroughRank = max reviewed rank; 7-day window)
- web/lib/draftDashboard/customProjectionSources.ts — INCIDENTAL (CSV cache key / number coercion)
- web/lib/draftDashboard/espnLiveDraft.ts — INCIDENTAL (config mapping)
- web/lib/draftDashboard/settingsValidation.ts — NEW (part of Projection source-weight sanitization: 0..2 range check, share total ×100); other checks are pick/round validation (COVERED-BY Draft pick arithmetic)
- web/lib/draftDashboard/sourceControlPreferences.ts — NEW (Projection source-weight sanitization and legacy percent-weight migration)
- web/lib/draftDashboard/summaryConfiguration.ts — INCIDENTAL (echoes weights)
- web/lib/draftDashboard/yahooLiveDraft.ts — INCIDENTAL (inline round = ceil(pick/teamCount), trivial copy of Draft pick arithmetic)
- web/lib/draftDashboard/yahooMapping.ts — INCIDENTAL (identity match score: base 100, +20, +5 team, tie → unresolved; mapping diagnostics). Note: unmappedNhlIds = hints.size − rows.size can disagree with the per-id unresolved count
- web/lib/exactFivePp/exactFivePpFixtures.ts — INCIDENTAL (seeded synthetic shift fixture generator; audit fixture for Exact-five PP units)
- web/lib/fantasy-projections/identityResolution.ts — INCIDENTAL (similarity_score read from DB, limit clamp)
- web/lib/fantasy-projections/readiness.ts — NEW (36 h staleness and transaction-coverage defaults folded into Season roster consensus entry)
- web/lib/fantasy-projections/rosterIntegrity.ts — NEW (Season roster consensus and roster_confidence ladder)
- web/lib/fantasy-projections/rosterReconciliation.ts — NEW (confidence bands/defaults folded into Season roster consensus entry)
- web/lib/fantasy-projections/scoringSettings.ts — COVERED-BY Default fantasy points and category weights
- web/lib/fantasy-projections/validation.ts — NEW (Season projection draft validation gates)
- web/lib/fetchWithCache.ts — INCIDENTAL (cache TTL)
- web/lib/forecast-diagnostics/researchContract.ts — INCIDENTAL (availableAt = max of timestamps)
- web/lib/forge-testing-grounds/boundedWorker.ts — INCIDENTAL (timeouts)
- web/lib/forge-testing-grounds/memoryRunStore.ts — INCIDENTAL (lease/retry timing; stage percent = done/ids×100)
- web/lib/forge-testing-grounds/operationalProgress.ts — INCIDENTAL (BigInt timestamp ordering)
- web/lib/forge-testing-grounds/preview/TestingGroundsPreview.tsx — INCIDENTAL (duration formatting)
- web/lib/forge-testing-grounds/runStoreContract.testkit.ts — INCIDENTAL (test kit)
- web/lib/forge-testing-grounds/runnerContracts.ts — INCIDENTAL (schema)
- web/lib/forge-v2/api.ts — INCIDENTAL (request parsing; scoringProfile COVERED-BY Fantasy points scoring (FORGE defaults))
- web/lib/forge-v2/contracts.ts — INCIDENTAL (types incl. accuracy DTO; calc COVERED-BY FORGE v2 evaluation scoring)
- web/lib/forge-v2/fixtureHarness.server.ts — INCIDENTAL (synthetic harness; audit fixture)
- web/lib/forge-v2/operations.ts — NEW (FORGE v2 operational health summary and alarms)
- web/lib/forge-v2/pipeline.server.ts — NEW (FORGE v2 issuance: joint-distribution coherence gate and category support)
- web/lib/forge-v2/preparation.server.ts — INCIDENTAL (pagination bounds)
- web/lib/forge-v2/qualification.ts — NEW (FORGE v2 qualification gate)
- web/lib/forge-v2/refresh.ts — NEW (FORGE v2 refresh cadence and material-event coalescing)
- web/lib/forge-v2/researchCapture.ts — INCIDENTAL (capture validation)
- web/lib/forge-v2/schedule.ts — NEW (horizon episodes / lock folded into FORGE v2 refresh cadence)
- web/lib/hooks/useQuarantinedPredictionsSko.ts — COVERED-BY sKO stability multiplier (reads stability_multiplier)
- web/lib/in-season/access.ts — INCIDENTAL (entitlement windows)
- web/lib/in-season/billing.ts — INCIDENTAL (checkout cutoffs)
- web/lib/in-season/commerce.ts — INCIDENTAL (billing: calendarDayProrationCents = floor((amount×remaining×2 + days)/(2×days)), half-up; non-stat)
- web/lib/in-season/monthlyLifecycle.ts — INCIDENTAL (billing lifecycle dates)
- web/lib/in-season/monthlySchedule.ts — INCIDENTAL (billing periods)
- web/lib/in-season/server.ts — INCIDENTAL (verification freshness)
- web/lib/in-season/workspaceSchema.ts — INCIDENTAL (season-id validation)
- web/lib/integrations/espn/client.ts — INCIDENTAL (backoff 500·2^n + jitter)
- web/lib/integrations/espn/config.ts — INCIDENTAL (cooldowns)
- web/lib/integrations/espn/contracts.ts — INCIDENTAL (types)
- web/lib/integrations/espn/liveDraftServer.ts — INCIDENTAL (retry-after)
- web/lib/integrations/espn/manualImport.ts — INCIDENTAL (staleness)
- web/lib/integrations/espn/server.ts — INCIDENTAL (scoring-period paging, refresh buckets)
- web/lib/integrations/fantrax/client.ts — INCIDENTAL (backoff)
- web/lib/integrations/fantrax/contracts.ts — INCIDENTAL (types)
- web/lib/integrations/fantrax/liveDraftServer.ts — INCIDENTAL (retry floor 60 s)
- web/lib/integrations/fantrax/manualImport.ts — INCIDENTAL (retry-after)
- web/lib/integrations/fantrax/server.ts — INCIDENTAL (cooldowns, rotating hourly scan offset)
- web/lib/integrations/patreon/config.ts — INCIDENTAL (staleness)
- web/lib/integrations/patreon/oauth.ts — INCIDENTAL (15 min state TTL)
- web/lib/integrations/patreon/sync.ts — INCIDENTAL (limits, concurrency 5)
- web/lib/integrations/yahoo/ingestionLifecycle.ts — INCIDENTAL (backoff with jitter ×0.75–1.25, paging)
- web/lib/integrations/yahoo/lifecycleHealth.ts — INCIDENTAL (ops warnings: 36 h stale, 2 consecutive failures, mapped-player regression, rate-limit events >= 3)
- web/lib/integrations/yahoo/liveDraftServer.ts — INCIDENTAL (burst/unchanged poll counters, poll lag)
- web/lib/integrations/yahoo/oauth.ts — INCIDENTAL (TTL)
- web/lib/integrations/yahoo/planningCache.ts — INCIDENTAL (TTL)
- web/lib/integrations/yahoo/pollCoordinator.ts — INCIDENTAL (limits/concurrency)
- web/lib/integrations/yahoo/pollPolicy.ts — INCIDENTAL (live-draft poll cadence: predraft 60/30/12 s, drafting 10/15/30 s, failures 5·2^n capped at 60 s; background polling paused until 2027-08-01)
- web/lib/integrations/yahoo/providerClient.ts — INCIDENTAL (durations)
- web/lib/integrations/yahoo/refresh.ts — INCIDENTAL (cooldowns)
- web/lib/integrations/yahoo/teamRoster.ts — INCIDENTAL (cache TTL)
- web/lib/integrations/yahoo/tokenManager.ts — INCIDENTAL (token skew)
- web/lib/mappers/yahooPlayersToSheet.ts — INCIDENTAL (last-N ownership timeline padding for sheet export)
- web/lib/ml/predictionsSkoRunControl.ts — INCIDENTAL (run-lock TTL 30 s..1 day)
- web/lib/mockDraft/feasibility.ts — NEW (Mock draft roster feasibility (Dinic max-flow))
- web/lib/nst/gamelogProgress.ts — INCIDENTAL (72 h bookmark TTL)
- web/lib/nst/jobLifecycle.server.ts — INCIDENTAL (deadline)

#### Gaps / judgement calls
- Ops health classifiers (draft-ranker/health.ts, yahoo/lifecycleHealth.ts, yahoo/pollPolicy.ts) were marked INCIDENTAL although the inventory does include similar "X poller health thresholds". Promote them if ops thresholds are in scope.
- in-season/commerce.ts proration is a real integer formula but billing, not analytics, so it was not added.
- yahooMapping candidateScore (identity matching) was skipped as string/identity scoring; it does decide which Yahoo ADP attaches to which NHL player.
- The FORGE v2 entries reflect the local or draft implementation only. Hosted operation and qualification evidence do not exist yet (per the PRD).

## Appendix: sweep-3-coverage

### Sweep 3 coverage (web/lib p-z and top-level web/lib/*.ts)

Output: parts/sweep-3.json (20 entries, all `discovered_in_sweep: true`).

Method: read-only. rg -n -i over all 129 listed files with the brief's pattern set (Math.*, /60, *60, percentile, zscore, stddev, per60, regress, sigmoid, logistic, poisson, weighted, AVG(, SUM(, np., .mean(, *WEIGHT/FACTOR/MULTIPLIER/BASELINE/PRIOR/COEF/SHRINK/ALPHA/DECAY/HALF_LIFE/THRESHOLD/CLAMP, softmax/logit/ewma/clamp(/percent_rank/cume_dist/ntile/percentile_cont/stddev_samp/regr_), then a case-sensitive rerun (case-insensitive hits were dominated by 'baseline'/'prior' identifiers), then an arithmetic-operator scan on upsert/contract files, then reading surrounding code of every candidate. Existing inventory (existing-inventory.json) was checked by keyword and `where` path before each entry.

Gaps / honesty notes:
- Files judged INCIDENTAL were triaged from matched lines plus a short read, not read end to end (notably linesCccIngestion.ts 2372 lines, nameStandardization.ts, routeRunner/core.ts, startChartContract.ts, fetchWGOdata.js).
- socialShare/trends.ts entries split the four trend sections; the Movers entry is a DUP-IMPL of FSC-021.
- Consumers for the social-share entries were found by rg; I did not trace UI rendering in components/SocialShare.
- CONTRACT.md cited in socialShare comments was not found under web/ or docs/ (likely under tasks/, not read per brief).

#### Per-file disposition
- web/lib/fetchWithCache.ts — INCIDENTAL (cache TTL hours*3600000)
- web/lib/player-cards/adapter.ts — COVERED-BY CARD-016 / CARD-019 (orchestrates aggregateWindow + rankMetric; missing-player count only)
- web/lib/player-cards/analysisFixtures.ts — INCIDENTAL (synthetic fixture data)
- web/lib/player-cards/contracts.ts — COVERED-BY CARD-016 / CARD-019 (types: formula atoi/per60/percentage, Rank percentile)
- web/lib/player-cards/currentSelection.ts — INCIDENTAL (date min for window display)
- web/lib/player-cards/goalieOutlook.ts — INCIDENTAL (fixture admission gating, no numeric transform)
- web/lib/player-cards/interactionFixtures.ts — INCIDENTAL (seeded synthetic fixtures; listed as audit fixture)
- web/lib/player-cards/interactionSnapshot.ts — DUP-IMPL (Player-card interaction snapshot sample TOI back-calculation; dup of CARD-018)
- web/lib/player-forecasts/baselineInputCapture.ts — INCIDENTAL (capture/lineage; matches were 'baseline'/'prior' identifiers only)
- web/lib/player-forecasts/currentRosterInjuryEvidence.ts — INCIDENTAL (24 h source-clock staleness gate)
- web/lib/player-forecasts/gameContract.fixtures.ts — INCIDENTAL (test fixture constants)
- web/lib/player-forecasts/goalieBaselineInputCapture.ts — INCIDENTAL (capture; mm:ss to minutes equality check only)
- web/lib/player-forecasts/nativeCatalogHead.ts — INCIDENTAL (deadlines, release pins)
- web/lib/player-forecasts/nativeContributionAdmission.ts — COVERED-BY PFC baseline entries (calls buildNativeSkaterBaselineSnapshot; admission/provenance only)
- web/lib/player-forecasts/reviewToken.ts — INCIDENTAL (token TTL)
- web/lib/player-forecasts/scopeReads.ts — INCIDENTAL (pagination)
- web/lib/player-forecasts/serving.ts — NEW (Player forecast validation inference context (rest days, home indicator); also DUP-IMPL of XG-026/PFC-044 restDays)
- web/lib/predictions/legacyQuarantine.ts — INCIDENTAL (registry of legacy artefacts; points at SKO-018/SKO-019)
- web/lib/predictions/pipelineCronAlignment.ts — INCIDENTAL (cron slot ordering)
- web/lib/projections/consumerRevisionAdmission.ts — INCIDENTAL (freshness gate: expiry = min(published+36 h, puck drop); no stat transform)
- web/lib/projections/forgeSkaterContext.ts — COVERED-BY FORGE entries (parses stored multipliers/rest/trend fields; extractProjectionRange reads p10/p50/p90)
- web/lib/projections/ingest/time.ts — INCIDENTAL (mm:ss <-> seconds)
- web/lib/projections/inputCapture.ts — INCIDENTAL (deadline)
- web/lib/projections/nativeCoverageAssembly.ts — COVERED-BY FRG-053 (shift-chart parse/validate; note: assumes OT period = 300 s, wrong for playoff OT)
- web/lib/projections/projectionPipelineState.ts — INCIDENTAL (lease timers)
- web/lib/projections/queries/line-combo-queries.ts — INCIDENTAL (limit/lookback = limit*12 games query sizing)
- web/lib/projections/queries/run-lifecycle-queries.ts — INCIDENTAL (run active/resume windows)
- web/lib/projections/researchGoalAppearanceManifest.ts — INCIDENTAL (paging/time caps)
- web/lib/projections/rosterEvents.ts — NEW (Roster event confidence and TTL from reviewed tweets (+ preflight staleness gates))
- web/lib/projections/shiftChartCompleteness.ts — INCIDENTAL (mm:ss parse, completeness reasons)
- web/lib/projections/startChartContract.ts — COVERED-BY FSC-015 / GST-008 (contract parsing of fantasyWeight/historyWeight, multipliers; slateTeams = games*2)
- web/lib/projections/starterBoardOperations.ts — NEW (Starter board operations SLO report)
- web/lib/projections/starterBoardQueue.ts — INCIDENTAL (enqueue deadline)
- web/lib/projections/types/run-forge-projections.types.ts — COVERED-BY FORGE entries (types only)
- web/lib/projections/utils/projection-metadata-builders.ts — DUP-IMPL (FORGE goalie starter metadata: top-2 probability mass and horizon-scaled blended projection; dup of FRG-035/FRG-040 scaling)
- web/lib/projectionsConfig/formatToMMSS.ts — INCIDENTAL (formatting)
- web/lib/rankings/availableFilters.ts — INCIDENTAL (filter option labels)
- web/lib/rankings/entityCoverageContracts.ts — COVERED-BY RNK-018..RNK-023 / RNK-009 (contract prose)
- web/lib/rankings/matrixMetricRegistry.ts — COVERED-BY RNK-003 / RNK-006 (column registry; lowerIsBetter from definitions)
- web/lib/rankings/rankingFormatters.ts — COVERED-BY RNK-007 / RNK-008 (display text: percentile, sample-confidence words 'at least twice selected minimums')
- web/lib/rankings/rankingTypes.ts — COVERED-BY RNK-008 (types)
- web/lib/rankings/rollingRankingSelectFields.ts — INCIDENTAL (column list; no matches)
- web/lib/rollingForgePipelineRunState.ts — INCIDENTAL (lease timers)
- web/lib/rosterScheduleData/source.ts — COVERED-BY RSO-011 (schedule dedupe, day counts)
- web/lib/rosterScheduleOptimizer/currentPlanningRead.ts — COVERED-BY RSO-011 (forecastInputExpiry = min expiries)
- web/lib/rosterScheduleOptimizer/executionAdapter.ts — INCIDENTAL (deadline min)
- web/lib/rosterScheduleOptimizer/planningTypes.ts — COVERED-BY RSO entries (types)
- web/lib/rosterScheduleOptimizer/refreshForecastInputs.ts — INCIDENTAL (passthrough)
- web/lib/rosterScheduleOptimizer/workspace.ts — INCIDENTAL (Monday week range, seasonId, checksum)
- web/lib/routeRunner/core.ts — INCIDENTAL (job progress ETA = remaining*elapsed/advanced over last 6 points; timers)
- web/lib/routeRunner/tick.ts — INCIDENTAL (timeouts)
- web/lib/skoElement/contract.ts — COVERED-BY SKO-007..SKO-014 (types; states no SKO score is produced)
- web/lib/skoElement/fixtures.ts — INCIDENTAL (synthetic fixtures)
- web/lib/socialShare/export.ts — INCIDENTAL (image scaling, fonts)
- web/lib/socialShare/fixtures.ts — INCIDENTAL (seeded synthetic team stats)
- web/lib/socialShare/landingCatalog.ts — INCIDENTAL (catalog text)
- web/lib/socialShare/modules/contract.ts — INCIDENTAL (headline font size)
- web/lib/socialShare/modules/playerVsPlayer.ts — NEW (Player vs Player comparison)
- web/lib/socialShare/modules/shared/definitions.ts — NEW (Social share shared definitions; DUP flag vs CARD-019/CARD-016 per-60 and ranks)
- web/lib/socialShare/modules/shared/goalieBoards.ts — NEW (Goalie board heat level and best/worst tie handling)
- web/lib/socialShare/modules/shared/goalieInventory.sources.ts — NEW (Goalie inventory team lenses ...; Goalie inventory rank band, strength share and head-to-head winner)
- web/lib/socialShare/modules/shared/goalieLedger.ts — DUP-IMPL (Social share team start share; dup of GST-003/PFC-044/UST-074)
- web/lib/socialShare/modules/shared/periodWindow.ts — INCIDENTAL (matchup-week date walking)
- web/lib/socialShare/modules/startSit.ts — COVERED-BY Goalie inventory team lenses / rank band (new entries; renders inventory)
- web/lib/socialShare/modules/teamGames.ts — NEW (Team Games Played)
- web/lib/socialShare/pickupsFixture.ts — INCIDENTAL (seeded synthetic pickups)
- web/lib/socialShare/playerSources.ts — INCIDENTAL (paging; season/10000)
- web/lib/socialShare/server.ts — INCIDENTAL (cache-control max-age arithmetic)
- web/lib/socialShare/teamNeon.ts — INCIDENTAL (HSL colour conversion, glow alphas)
- web/lib/socialShare/trendSources.ts — INCIDENTAL (paging/concurrency)
- web/lib/socialShare/trends.ts — NEW (Hot/Cold Recent Form; per-60 rate standouts; deployment change; per-game series reconstruction) + DUP-IMPL (rostered-% movers, dup of FSC-021)
- web/lib/socialShare/trendsFixture.ts — INCIDENTAL (seeded synthetic rolling rows; listed as audit fixture)
- web/lib/socialShare/types.ts — COVERED-BY FSC-042 (weightedOffNights type) and new trends entries (types)
- web/lib/sources/decisionsReference/adapter.d.mts — COVERED-BY Decisions reference shadow adapter (type declarations)
- web/lib/sources/decisionsReference/adapter.mjs — NEW (Decisions reference shadow adapter: token reservation, USD budget and material-news triage)
- web/lib/sources/lineSourceProcessing.ts — INCIDENTAL (limit clamp, 12 h official refresh window)
- web/lib/sources/linesCccIngestion.ts — INCIDENTAL (retry backoff min(5*2^(n-1),360) min)
- web/lib/sources/lunaHosted/contract.ts — INCIDENTAL (mapping import)
- web/lib/sources/lunaHosted/runtimeConfig.ts — INCIDENTAL (<=1 h window check)
- web/lib/sources/nhlProspectIdentity.ts — INCIDENTAL (inches->cm x2.54, lb->kg x0.45359237 unit conversion)
- web/lib/sources/nhlRosterPreview.ts — INCIDENTAL (weight field mapping)
- web/lib/sources/playerAliasReviewToken.ts — INCIDENTAL (token TTL)
- web/lib/sources/projectedLineups.ts — INCIDENTAL (pairs reports within 90 min; timestamp max)
- web/lib/sources/tweetAliasReconciliation.ts — INCIDENTAL (limit clamp)
- web/lib/sources/tweetClaimCompatibility.ts — INCIDENTAL (record carry-forward; 'prior' identifier)
- web/lib/sources/tweetClaimForecastDelivery.ts — INCIDENTAL (delivery state machine)
- web/lib/sources/tweetClaimLineage.ts — INCIDENTAL (lineage merge)
- web/lib/sources/tweetClaimRegistry.ts — INCIDENTAL (RPC registry)
- web/lib/sources/tweetClaimSourceHints.ts — INCIDENTAL (source-directory hint)
- web/lib/sources/tweetIdentityEvaluation.ts — NEW (Tweet identity resolution evaluation grading)
- web/lib/sources/tweetIdentityLocalReview.ts — COVERED-BY MISC-021 (calls candidate builder/resolver)
- web/lib/sources/tweetIdentityProposal.ts — INCIDENTAL (span min/max)
- web/lib/sources/tweetLunaGoalieWording.ts — INCIDENTAL (sentence boundary)
- web/lib/sources/tweetLunaReference.ts — INCIDENTAL (reference mapping)
- web/lib/sources/tweetLunaReview.ts — COVERED-BY Decisions reference shadow adapter (caller)
- web/lib/sources/tweetPlayerEvents.ts — INCIDENTAL (text span windows of 40 chars)
- web/lib/sources/tweetSwipeTrainerServer.ts — COVERED-BY LINE-020 (server wrapper; TTL, limits)
- web/lib/sources/xTimelinePairing.ts — INCIDENTAL (string prefix match)
- web/lib/standardization/nameStandardization.ts — INCIDENTAL (name map; matches were 'mangiapane')
- web/lib/supabase/Upserts/Yahoo/test_yahoo_identity_promotion.py — INCIDENTAL (test file; out of scope per brief)
- web/lib/supabase/Upserts/Yahoo/yahooAPI.py — INCIDENTAL (elapsed minutes logging)
- web/lib/supabase/Upserts/Yahoo/yahooApiPlayerKeys.py — INCIDENTAL (elapsed minutes logging)
- web/lib/supabase/Upserts/fetchStandings.js — INCIDENTAL (day count)
- web/lib/supabase/Upserts/fetchWGOdata.js — INCIDENTAL (copies NHL.com per-60/percent fields; backoff; no derivation)
- web/lib/supabase/Upserts/fetchWGOgoalieData.js — INCIDENTAL (field copy)
- web/lib/supabase/Upserts/fetchWGOgoalieStats.js — INCIDENTAL (field copy, shots_against_per_60 from API)
- web/lib/supabase/Upserts/fetchWGOskaterStats.js — INCIDENTAL (copies NHL.com per-60/percentage fields; no arithmetic found)
- web/lib/supabase/Upserts/nhlRawGamecenterRoute.ts — INCIDENTAL (8 h finished-game cutoff, limit)
- web/lib/supabase/Upserts/rollingDroppedColumns.ts — INCIDENTAL (column list; no matches)
- web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts — COVERED-BY ROLL entries (unit contract metadata; useful intent source: per-60 = weighted from aggregated counts/TOI)
- web/lib/supabase/pagination.ts — INCIDENTAL (pagination)
- web/lib/supabase/utils/dataFetching.ts — INCIDENTAL (confidenceMultiplier set undefined; legacy)
- web/lib/supabase/utils/types.ts — COVERED-BY SKO-018 / SKO-019 (legacy types: sumOfWeightedSquaredZScores, gameScore)
- web/lib/supabase/utils/updateAllGoalies.ts — INCIDENTAL (field copy)
- web/lib/sustainability/featureDictionary.ts — COVERED-BY SUS entries (feature contract only; no consumers found; note usage_delta_pct declared fraction_0_to_1 although a delta can be negative)
- web/lib/sustainability/health.ts — INCIDENTAL (row-count health checks)
- web/lib/sustainability/persist.ts — INCIDENTAL (row mapping)
- web/lib/sustainability/trendsIdentity.ts — INCIDENTAL (paging; points clamp 2..30)
- web/lib/sustainability/types.ts — COVERED-BY SUS entries (types: poisson/negbin/rate)
- web/lib/trends/recentTeamFormV2Provenance.ts — COVERED-BY TEAM-021 (provenance wrapper around computeRecentTeamFormCandidateV2)
- web/lib/trends/skoTypes.ts — COVERED-BY SKO-025 (types: stability_multiplier)
- web/lib/trends/skoUtils.ts — INCIDENTAL (sparkline SVG geometry, formatting)
- web/lib/trends/types.ts — INCIDENTAL (types)
- web/lib/underlying-stats/playerStatsClientCache.ts — INCIDENTAL (cache TTL)
- web/lib/underlying-stats/playerStatsFormatting.ts — INCIDENTAL (display formatting)
- web/lib/underlying-stats/playerSummaryRollbackPlan.ts — INCIDENTAL (timestamps)
- web/lib/xg/backfillCoverageAudit.ts — INCIDENTAL (concurrency/limits)
- web/lib/xg/executionLease.ts — INCIDENTAL (lease TTL clamp 30..86400 s)
- web/lib/xg/operationsHealth.ts — NEW (xG team aggregate reconciliation (xGF/xGA symmetry) and operations alerts)

## Appendix: sweep-4-coverage

### Sweep 4 coverage (web/components, hooks, utils, styles — client-side derived math)

Files: 142. Dispositions: COVERED-BY 47, DUP-IMPL 1, INCIDENTAL 71, NEW 23

Method: rg over every listed file with the sweep patterns (Math.*, /60, *60, percentile, zscore, per60, regress, weighted, *WEIGHT/FACTOR/THRESHOLD/CLAMP constants, .reduce(, divisions) plus a broad pass (avg|average|percent|pct|ratio|share|delta|threshold|>=N|toi) for files with few narrow hits; read surrounding code; checked imports against existing-inventory.json (names/where/method) and against sweep-3 (lib/socialShare).

Gaps / caveats: large render-only files (AccountSettingsPage 3.7k lines, SocialShare.tsx 980 lines, HomepageGamesSection, TweetSwipeTrainer TrainerCard) were grep-scanned, not read end to end. Social-share lib math is assumed covered by sweep-3. Status "dead" for TeamPowerCard and usePlayerStats is based on rg finding no importers in web/ (dynamic/string imports not ruled out). No code was run.

#### Per-file disposition

- web/components/ArticleReader/headings.ts — INCIDENTAL (heading level clamp)
- web/components/BeatReporterReview/BeatReporterReview.tsx — COVERED-BY LINE-011 Beat-reporter candidate confidence (pct display, swipe gestures)
- web/components/CategoryCoverageChart/CategoryCoverageChart.tsx — COVERED-BY WiGO category percentiles (render; label geometry only)
- web/components/CronReportEmail/CronAuditEmail.tsx — INCIDENTAL (ops status labels / near-limit, not stats)
- web/components/CronReportEmail/CronReportEmail.tsx — INCIDENTAL (duration formatting)
- web/components/CronReportEmail/PollerHealthSection.tsx — INCIDENTAL (ops rate formatting)
- web/components/CronReportEmail/TweetBacklogSection.tsx — INCIDENTAL (backlog delta formatting)
- web/components/DateRangeMatrix/LinePairGrid.tsx — INCIDENTAL (mm:ss parse; renders LINE-007)
- web/components/DateRangeMatrix/index.tsx — NEW (Date Range Matrix cell shade from shared TOI%)
- web/components/DateRangeMatrix/useDateRangeMatrixData.ts — COVERED-BY LINE-021 / LINE-007 (mapping only)
- web/components/DraftDashboard/DraftSettings.tsx — INCIDENTAL (roster-slot sums, input clamps)
- web/components/DraftDashboard/DraftStatus.tsx — INCIDENTAL (round display clamp)
- web/components/DraftDashboard/DustMatrix.tsx — NEW (Client bench/dead-day tallies)
- web/components/DraftDashboard/GodView.tsx — COVERED-BY DRF-019 rankTeamCategories/categoryRankBand
- web/components/DraftDashboard/MockDraftWorkspace.tsx — INCIDENTAL (round number, random seat, list cap)
- web/components/DraftDashboard/MyRoster.tsx — COVERED-BY RSO-003 dustRate (x100 display) / INCIDENTAL roster progress
- web/components/DraftDashboard/ProjectionSourceSettings.tsx — NEW (Projection source weight slider rebalancing)
- web/components/DraftDashboard/RoundRankChart.tsx — INCIDENTAL (chart scales; ranks from DRF-007/019)
- web/components/DraftDashboard/YahooLiveDraftPanel.tsx — INCIDENTAL (resolved-pick counts, roster sums)
- web/components/DraftRanker/CommunityRankingsPage.tsx — COVERED-BY DRF-014 community ranking (signed delta display, pagination)
- web/components/DraftRanker/DraftRankerPage.tsx — INCIDENTAL (250-entry cap display)
- web/components/DraftRanker/DraftRankingTable.tsx — INCIDENTAL (pagination)
- web/components/ForgeV2/ForecastExplorer.tsx — NEW (FORGE v2 forecast revision traversal spans)
- web/components/GameGrid/OpportunitySparkline.tsx — NEW (Game Grid opportunity trend label)
- web/components/GameGrid/utils/date-func.tsx — INCIDENTAL (date diff)
- web/components/GameGrid/utils/useOpportunityClock.ts — INCIDENTAL (timer)
- web/components/GameGrid/utils/useSchedule.ts — INCIDENTAL (fetch concurrency)
- web/components/GameScoreChart/GameScoreChart.tsx — INCIDENTAL (chart y-domain; renders WIGO-008/sKO game score)
- web/components/GoaliePage/GoalieAdvancedMetricsTable.tsx — COVERED-BY UST-023..028 goalie metrics (labels/render)
- web/components/GoaliePage/GoalieLeaderboard.tsx — NEW (Goalie leaderboard percent colour bands and fPts diff vs league)
- web/components/GoaliePage/goalieTypes.ts — INCIDENTAL (types only; calcs in UST-026/027)
- web/components/HomePage/HomepageDesktopGameSlates.tsx — NEW (Homepage win-probability favoured/underdog tone)
- web/components/HomePage/HomepageDraftRanker.tsx — INCIDENTAL (list window centred on mean active rank)
- web/components/HomePage/HomepageGamesSection.tsx — NEW (Homepage win-probability favoured/underdog tone)
- web/components/HomePage/HomepagePlayoffBracket.tsx — INCIDENTAL (series wins >=4 display)
- web/components/HomePage/HomepagePulse.tsx — COVERED-BY CARD-012 homepage pulse (sparkline scaling only)
- web/components/HomePage/HomepageStandingsInjuriesSection.tsx — INCIDENTAL (pagination; point % display)
- web/components/HomePage/homepageGamePresentation.ts — COVERED-BY game predictions (probability/edge formatting)
- web/components/Layout/Header/Header.tsx — INCIDENTAL (scroll)
- web/components/PlayerForecastSeasonEditor/SeasonIdentityResolver.tsx — INCIDENTAL (similarity score display; computed server-side)
- web/components/PlayerStats/PlayerLineupDeploymentGrid.tsx — COVERED-BY line deployment tallies (share render)
- web/components/PlayerStats/PlayerStatsTable.tsx — INCIDENTAL (debug logging reduce)
- web/components/PlayerStats/types.ts — INCIDENTAL (types, labels, formatters)
- web/components/Rankings/DeploymentTiersPanel.tsx — COVERED-BY RNK-015 deployment buckets (render)
- web/components/Rankings/ExperimentalToolkitPanel.tsx — INCIDENTAL (roadmap copy)
- web/components/Rankings/GoalieMatrixTable.tsx — COVERED-BY RNK-020 / RNK-034 (render)
- web/components/Rankings/PlayerMatrixTable.tsx — COVERED-BY RNK-034 getScoreTileTone (render)
- web/components/Rankings/RankingsFilters.tsx — INCIDENTAL (filter inputs; min GP/TOI presets from lib)
- web/components/Rankings/RankingsTable.tsx — COVERED-BY rankNormalizedMetricValues (render)
- web/components/Rankings/ScoreText.tsx — INCIDENTAL (label split)
- web/components/Rankings/SplitsPanel.tsx — COVERED-BY rankings splits (render)
- web/components/Rankings/TeamMatrixTable.tsx — COVERED-BY RNK-009 / RNK-034 (render)
- web/components/Rankings/caveatLabels.ts — INCIDENTAL (labels)
- web/components/RosterAutopsy/RosterAutopsy.tsx — COVERED-BY RSO-050 / FSC-028 roster autopsy (render)
- web/components/RosterMatrix/RosterMatrix.tsx — NEW (Team roster matrix heat shade)
- web/components/RosterMatrix/RosterMatrixWrapper.tsx — NEW (Team roster matrix goalie gamelog aggregation; Player bio unit conversions)
- web/components/RosterScheduleOptimizer/BenchDays.tsx — NEW (Client bench/dead-day tallies)
- web/components/RosterScheduleOptimizer/CompactSchedule.tsx — INCIDENTAL (row sizing, bench capacity display)
- web/components/RosterScheduleOptimizer/ForecastPoints.tsx — COVERED-BY RSO forecast points (render)
- web/components/RosterScheduleOptimizer/InfoTooltip.tsx — INCIDENTAL (positioning)
- web/components/RosterScheduleOptimizer/PlanFromSlider.tsx — INCIDENTAL (slider index clamp)
- web/components/RosterScheduleOptimizer/SlotWeekGrid.tsx — NEW (RSO lineup expected-points tercile tiers; RSO goalie likely-starter mark)
- web/components/RosterScheduleOptimizer/StreamingItinerary.tsx — NEW (RSO streaming itinerary override totals and goalie-minimum tradeoff)
- web/components/ShiftChart/PowerPlayAreaIndicators/index.tsx — INCIDENTAL (timeline position 1200 s periods, OT offset 3600 s; colour darken)
- web/components/ShiftChart/Replay.tsx — INCIDENTAL (timeline layout)
- web/components/ShiftChart/testFixtures.ts — INCIDENTAL (fixture generator)
- web/components/SkaterPage/SkaterAdvancedMetricsTable.tsx — COVERED-BY UST-068 skater variance metrics (labels)
- web/components/SkaterPage/SkaterTable.tsx — INCIDENTAL (virtualization, decorative bucket hue)
- web/components/SkaterPage/seasonSkaterRows.ts — INCIDENTAL (keyset paging)
- web/components/SkaterPage/skaterTypes.ts — INCIDENTAL (types)
- web/components/SkoLineChart/LineChart.tsx — COVERED-BY SKO-017 thresholds (chart render of T1/T2 bands)
- web/components/SocialShare/PostStudio.tsx — INCIDENTAL (preview scale)
- web/components/SocialShare/SocialShare.tsx — NEW (Week Score five-tier band; gold-glow; pickup band chip DUP-IMPL; recent-form line) — rest COVERED-BY lib/socialShare (sweep-3)
- web/components/SocialShare/modules/BshBoardCard.tsx — COVERED-BY lib/socialShare/modules/bshBoard (sweep-3) (bar scaling)
- web/components/SocialShare/modules/BusyQuietCard.tsx — NEW (Social share card tone encodings) — workloadLevel itself in lib (sweep-3)
- web/components/SocialShare/modules/CategoryBlueprintCard.tsx — COVERED-BY lib/socialShare categoryPercentileBand (sweep-3)
- web/components/SocialShare/modules/CreaseShiftCard.tsx — COVERED-BY lib/socialShare/modules/creaseShift (sweep-3)
- web/components/SocialShare/modules/GoalieBoards.tsx — COVERED-BY lib/socialShare/modules/shared/goalieBoards heatLevel (sweep-3)
- web/components/SocialShare/modules/GoaliePeriodCard.tsx — NEW (Social share card tone encodings: fixed 1-20 spark scale)
- web/components/SocialShare/modules/LastNightsStandoutsCard.tsx — NEW (Social share card tone encodings: changeTone)
- web/components/SocialShare/modules/MultiCatStarsCard.tsx — COVERED-BY lib/socialShare/modules/multiCatStars (sweep-3) (radar geometry)
- web/components/SocialShare/modules/NightlyFloorCard.tsx — COVERED-BY lib/socialShare/modules/nightlyFloor (sweep-3)
- web/components/SocialShare/modules/RatioImpactCard.tsx — COVERED-BY lib/socialShare/modules/ratioImpact (sweep-3) (lane scaling)
- web/components/SocialShare/modules/RoleWatchCard.tsx — COVERED-BY lib/socialShare/modules/roleWatch (sweep-3)
- web/components/SocialShare/modules/WhatChangedCard.tsx — COVERED-BY lib/socialShare/modules/whatChanged (sweep-3)
- web/components/TeamStandingsChart/chartUtils.ts — INCIDENTAL (x-axis max games)
- web/components/TeamTabNavigation/TeamTabNavigation.tsx — INCIDENTAL (contrast check, point%/FO% display)
- web/components/TimeOnIceChart/TimeOnIceChart.tsx — COVERED-BY /api/toi powerPlayToiShare (render)
- web/components/TransactionTrends/TransactionTrends.tsx — COVERED-BY FSC-021 / DRF-003 / MISC-034 trend movement (render)
- web/components/TweetSwipeTrainer/PlayerCombobox.tsx — INCIDENTAL (keyboard index)
- web/components/TweetSwipeTrainer/TrainerCard.tsx — DUP-IMPL (Tweet trainer confidence tone bands); edit-distance name match INCIDENTAL (string scoring)
- web/components/TweetSwipeTrainer/TweetSwipeTrainer.tsx — INCIDENTAL (swipe gestures)
- web/components/WiGO/OpponentGamelog.tsx — INCIDENTAL (±5 game slice)
- web/components/WiGO/PerGameStatsTable.tsx — NEW (WiGO per-game table: per-GP, S%, 84-game pace; DUP of DRF-036 pace)
- web/components/WiGO/StatsTableRowChart.tsx — NEW (WiGO game-log chart reference averages and nice ticks)
- web/components/WiGO/TeamPerformanceDrivers.tsx — COVERED-BY WIGO-013 team performance drivers
- web/components/WiGO/WigoComparisonMatrix.tsx — COVERED-BY WIGO-003 DIFF (diff-strength fill capped 100%)
- web/components/WiGO/WigoDashboardSections.tsx — COVERED-BY WIGO-009/012 (render)
- web/components/WiGO/WigoHelp.tsx — INCIDENTAL (positioning)
- web/components/WiGO/errorMessages.ts — INCIDENTAL (strings)
- web/components/WiGO/playerBiography.ts — NEW (Player bio unit conversions)
- web/components/WiGO/types.ts — INCIDENTAL (types; ratings calc in WIGO-012/HLP-005)
- web/components/account/AccountSettingsPage.tsx — INCIDENTAL (settings form clamps)
- web/components/account/InSeasonPanel.tsx — INCIDENTAL (cancellation age constant)
- web/components/buyLowSellHigh/BlshCandidateLists.tsx — COVERED-BY BLSH stages (render)
- web/components/buyLowSellHigh/BlshPlayerDetail.tsx — COVERED-BY BLSH stages (bar chart scaling; displays normalization multiplier)
- web/components/buyLowSellHigh/BuyLowSellHighPreview.tsx — COVERED-BY BLSH stages (24 h staleness label)
- web/components/forge-command-center/CommandCenterShell.tsx — INCIDENTAL (sparkline scaling)
- web/components/forge-command-center/FocusedSlateContext.tsx — INCIDENTAL (pct format)
- web/components/forge-dashboard/SlateStripCard.tsx — COVERED-BY GST starter probabilities / TEAM-026 getGamePowerEdge (render)
- web/components/forge-dashboard/TeamPowerCard.tsx — NEW (Team power card trend and matchup tone thresholds) — scores COVERED-BY TEAM-018/026
- web/components/forge-dashboard/TopAddsRail.tsx — COVERED-BY TEAM-023 / CARD-009 Top Adds score (render, ownership filter)
- web/components/player-cards/EditorialPlayerCard.tsx — COVERED-BY CARD-* player-card rank/percentile (render)
- web/components/player-cards/InteractiveCard.tsx — COVERED-BY CARD-* (render)
- web/components/player-cards/ObservedPlayerCard.tsx — COVERED-BY CARD-* (render)
- web/components/player-cards/PlayerCard.tsx — COVERED-BY CARD-* (render; minutes->m:ss)
- web/components/player-cards/PlayerCardFlow.tsx — COVERED-BY CARD-* (render)
- web/components/player-cards/PlayerCardPreview.tsx — COVERED-BY CARD-* (render)
- web/components/player-cards/PlayerCardShareStudio.tsx — COVERED-BY CARD-* (render)
- web/components/player-cards/PlayerHeroHeader.tsx — INCIDENTAL (image outline geometry)
- web/components/sustainability/SustainabilityBadge.tsx — COVERED-BY SUS-033 getSustainabilityTier
- web/components/sustainability/SustainabilitySparkline.tsx — INCIDENTAL (sparkline scaling)
- web/components/underlying-stats/PlayerStatsFilters.tsx — INCIDENTAL (season range clamp)
- web/components/underlying-stats/PlayerStatsTable.tsx — INCIDENTAL (pagination)
- web/components/underlying-stats/TeamStatsFilters.tsx — INCIDENTAL (season range clamp)
- web/components/underlying-stats/UnderlyingStatsDashboard.tsx — NEW (Underlying stats team rating bar width 70–130)
- web/components/underlying-stats/playerStatsColumns.ts — INCIDENTAL (column config; values from UST server)
- web/components/underlying-stats/teamStatsColumns.ts — INCIDENTAL (column config)
- web/hooks/useAccountAccess.ts — INCIDENTAL (refresh timer)
- web/hooks/useCurrentSeason.ts — INCIDENTAL (cache times)
- web/hooks/useDraftSchedule.ts — INCIDENTAL (team id map)
- web/hooks/useFantraxDraftSync.ts — INCIDENTAL (retry backoff)
- web/hooks/useGoals.tsx — INCIDENTAL (goal timeline positioning, colour lighten)
- web/hooks/useMockDraft.ts — INCIDENTAL (pick timers)
- web/hooks/usePlayerStats.ts — NEW (usePlayerStats zone-start % and NST merge coercion; dead hook)
- web/hooks/useRosterPlanning.ts — INCIDENTAL (plan lapse timers)
- web/hooks/useRosterScheduleOptimizer.ts — INCIDENTAL (36 h staleness, week range)
- web/hooks/useSavedDrafts.ts — INCIDENTAL (upload chunking)
- web/hooks/useYahooEligibility.ts — INCIDENTAL (receipt expiry timers)
- web/public/pictures/NHL_Hockey_Rink.svg — INCIDENTAL (SVG asset)
- web/styles/wigoColors.ts — INCIDENTAL (colour alpha helper)
- web/utils/stats/formatters.ts — INCIDENTAL (formatting)
