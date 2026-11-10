# Audit packet: Player cards & homepage stats

Master entries M-CARD-001 to M-CARD-035 (35 of 35 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-CARD-001 | Player-card analysis snapshot readings (total / per-game / per-60, xG… | Both | 0 | 8 |
| M-CARD-002 | Player-card recent vs baseline difference | Both | 0 | 2 |
| M-CARD-003 | Player-card artwork/outline geometry (grouped) | Both | 0 | 2 |
| M-CARD-004 | BLSH current card evidence gate and market reference gap | Both | 0 | 3 |
| M-CARD-005 | Top Adds composite score | Both | 0 | 3 |
| M-CARD-006 | Current NHL card pooled basic rates (ATOI, shots/goals/points per 60,… | Both | 0 | 4 |
| M-CARD-007 | Player-card pooled NST metric (ATOI, per-60, percentage) | Both | 0 | 4 |
| M-CARD-008 | Observed-card sample TOI back-calculation | Both | 0 | 2 |
| M-CARD-009 | Player-card competition rank and midrank percentile | Both | 0 | 4 |
| M-CARD-010 | Player-card appearance window selection (L5/L10/L20 or calendar) | Both | 0 | 2 |
| M-CARD-011 | WiGO per-game table: per-GP, S%, 84-game pace | Opus only | 0 | 3 |
| M-CARD-012 | Player-card interaction snapshot sample TOI back-calculation | Opus only | 0 | 2 |
| M-CARD-013 | Player vs Player comparison (totals / per appearance / per 60 with NS… | Opus only | 0 | 2 |
| M-CARD-014 | Analysis card radar/bars common raw scale | Opus only | 0 | 1 |
| M-CARD-015 | BLSH retained research evidence on player cards (box comparison, capt… | Opus only | 0 | 4 |
| M-CARD-016 | Dashboard insight tone and trend bands | Opus only | 0 | 1 |
| M-CARD-017 | Yahoo ownership freshness gate | Opus only | 0 | 1 |
| M-CARD-018 | Homepage pregame projected-score freshness and SOG/xG merge | Opus only | 0 | 2 |
| M-CARD-019 | Homepage model-vs-market edge and favoured team | Opus only | 0 | 1 |
| M-CARD-020 | Homepage pulse sparkline (model edge / confidence) | Opus only | 0 | 2 |
| M-CARD-021 | Homepage daily visitors | Opus only | 0 | 0 |
| M-CARD-022 | Production-by-game chart scaling | Opus only | 0 | 1 |
| M-CARD-023 | NST gamelog capture mapping to card records | Opus only | 0 | 1 |
| M-CARD-024 | Stats page leaderboards (BSH, goalie min-GP filter, top-5 sorts) | Opus only | 0 | 3 |
| M-CARD-025 | Proposed NST average ice time | Codex only | 0 | 1 |
| M-CARD-026 | Proposed NST on-ice attempts for per 60 | Codex only | 0 | 1 |
| M-CARD-027 | Proposed NST individual attempts per 60 | Codex only | 0 | 1 |
| M-CARD-028 | Proposed NST individual points percentage | Codex only | 0 | 1 |
| M-CARD-029 | Proposed NST individual scoring chances per 60 | Codex only | 0 | 1 |
| M-CARD-030 | Proposed NST on-ice shooting percentage | Codex only | 0 | 1 |
| M-CARD-031 | Proposed NST on-ice chances for per 60 | Codex only | 0 | 1 |
| M-CARD-032 | Proposed NST individual shooting percentage | Codex only | 0 | 1 |
| M-CARD-033 | Proposed NST shots on goal per 60 | Codex only | 0 | 1 |
| M-CARD-034 | Proposed NST on-ice xGF per 60 | Codex only | 0 | 1 |
| M-CARD-035 | Proposed NST on-ice xG share | Codex only | 0 | 1 |

## M-CARD-001 Player-card analysis snapshot readings (total / per-game / per-60, xG share)

- **Match:** Both; Opus CARD-005; Codex roster-card-analysis-bsh, roster-card-analysis-change, roster-card-analysis-count-bases, roster-card-analysis-ice-time, roster-card-analysis-xg-bases, roster-card-analysis-xg-share
- **Purpose:** Compute recent-window and baseline values for counts, BSH, TOI, ixG/xGF/xGA and xG%
- **Where:** `web/lib/player-cards/analysisSnapshot.ts:53 (reading)`; `web/lib/player-cards/analysisSnapshot.ts:13 (ANALYSIS_FIELDS)`; `web/lib/player-cards/analysisSnapshot.ts:85 (buildAnalysisSnapshot)`; `web/lib/player-cards/analysisSnapshot.ts:13 ANALYSIS_FIELDS`; `web/lib/player-cards/analysisSnapshot.ts:53 reading`; `web/lib/player-cards/analysisSnapshot.ts:78 analysisDifference`; `web/lib/player-cards/analysisSnapshot.ts:85 buildAnalysisSnapshot`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game, shots on goal; generation: development, current
- **Opus view (CARD-005):**
  - Method: Sum fields across window games. xgPct = 100*sum(xgf)/(sum(xgf)+sum(xga)) (pooled). TOI metrics always per-game minutes: sum(sec)/GP/60. Else total = sum; per-game = sum/GP; per60 = sum*3600/sum(toiSeconds). BSH = blocks+shots+hits. Baseline 'previous' = next N older appearances (non-overlapping, requires 2N); 'season' = all season appearances (L5/L10 only, overlaps recent).
  - Inputs/units: counts per game; toiSeconds and ppToiSeconds in seconds; ixG/xGF/xGA in goals; sources: NHL game log (via analysisCaptureFromNhl), supplied captures
  - Output scale: totals, per-GP, per-60 rates; TOI minutes per GP; xG share 0-100; writes: —
  - Status: draft — PlayerAnalysisStudio (components/player-cards/PlayerAnalysisStudio.tsx) has no page importer (rg found none outside its own file/tests)
  - Consumers: PlayerAnalysisCard; PlayerAnalysisStudio; analysisDifference
- **Codex view (roster-card-analysis-bsh, calculation, codex_part_of_opus; Codex family 'Player-card analysis'):** BSH combined peripheral production
  - Purpose: Sums blocked shots+shots on goal+hits across selected appearances, then applies total/per-game/per60 basis using actualGP or pooledTOI.
  - Inputs/units: Complete BLK, SOG and HITS event counts; TOI seconds/GP as denominator.
  - Output scale: Combined events, events/GP or events/60; nonnegative or unavailable.
  - Version/status: fhfh-card-analysis-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-card-analysis-change, calculation, codex_part_of_opus; Codex family 'Player-card analysis'):** Recent-minus-baseline metric change
  - Purpose: Builds latestN or UTC calendar recent window and previous equal non-overlap N or season-to-date baseline (season comparison restricted to L5/L10). Reports overlap; delta=recent-baseline. Ordinary total delta withheld for unequal appearance sample sizes.
  - Inputs/units: Qualified recent/baseline readings, basis, requested window and complete capture.
  - Output scale: Signed delta in reading units (percentage-point difference for xG%), sample counts, overlap count and known-short flags.
  - Version/status: fhfh-card-analysis-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-card-analysis-count-bases, calculation, location; Codex family 'Player-card analysis'):** Analysis count metrics by total, appearance or 60 minutes
  - Purpose: Pools goals, assists, points, PP points, shots, blocks and hits; total=sum, per-game=sum/actualGP, per60=3600*sum/sumTOIseconds. Requires every selected game field with matching provider/revision/strength and correct count units.
  - Inputs/units: Complete admitted/synthetic field evidence, integer event counts, actual appearances and TOI seconds for per60.
  - Output scale: Counts, counts/GP or counts/60 for seven separate named categories; missing/undefined distinct from valid zero.
  - Version/status: fhfh-card-analysis-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-card-analysis-ice-time, calculation, codex_part_of_opus; Codex family 'Player-card analysis'):** Analysis total and power-play ice time per appearance
  - Purpose: For both totalTOI and PPTOI fields always uses sumseconds/actualGP/60, regardless selected count-stat basis; PPTOI cannot exceed or lack totalTOI.
  - Inputs/units: Total and PP TOI seconds with source/revision/strength and appearance count.
  - Output scale: Minutes/appearance for total and PP ice time or unavailable.
  - Version/status: fhfh-card-analysis-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-card-analysis-xg-bases, calculation, codex_part_of_opus; Codex family 'Player-card analysis'):** Analysis individual and on-ice xG bases
  - Purpose: Pools individual ixG, on-ice xGF and xGA, returning raw totals, per-appearance averages or per60 using pooledTOI. Requires provider model and revision; does not estimate xG from shots.
  - Inputs/units: Compatible supplied xG measurements with model/strength/revision, GP and TOI seconds.
  - Output scale: xG total, xG/GP or xG/60 for each field; nonnegative or unavailable.
  - Version/status: fhfh-card-analysis-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-card-analysis-xg-share, calculation, codex_part_of_opus; Codex family 'Player-card analysis'):** Analysis pooled on-ice xG share
  - Purpose: Always returns100*sumxGF/(sumxGF+sumxGA) independent of selected count-stat basis; requires xGF/xGA share provider/model/revision.
  - Inputs/units: Compatible on-ice xGF/xGA measurements.
  - Output scale: Percentage0..100 or undefined with zero total xG.
  - Version/status: fhfh-card-analysis-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/analysisSnapshot.ts:6 'Consumer contract only'; :84 'Copies inputs before selecting'; tasks/tasks-prd-player-cards-evolution-2026-10-31.md
  - Intended contract (Codex roster-card-analysis-bsh): ANALYSIS_FIELDS explicitly labels BSH as BLK+SOG+HITS; not a weighted fantasy-points score. Source: web/lib/player-cards/analysisSnapshot.ts:13 ANALYSIS_FIELDS.
  - Intended contract (Codex roster-card-analysis-change): Explicit disclosure: season includes recent games and is not independent. Missing comparisons are not zero. Source: web/lib/player-cards/analysisSnapshot.ts:78 analysisDifference.
  - Intended contract (Codex roster-card-analysis-count-bases): Analysis source contract and field map; ordinary counts need complete compatible source fields. Source: web/lib/player-cards/analysisSnapshot.ts:53 reading.
  - Intended contract (Codex roster-card-analysis-ice-time): Source implementation forces time metrics to per-game basis and validates compatible seconds. Source: web/lib/player-cards/analysisSnapshot.ts:53 reading.
  - Intended contract (Codex roster-card-analysis-xg-bases): Field-source contract requires xG units and model metadata. Source: web/lib/player-cards/analysisSnapshot.ts:53 reading.
  - Intended contract (Codex roster-card-analysis-xg-share): Explicit pooled-percentage basis and source equality checks. Source: web/lib/player-cards/analysisSnapshot.ts:53 reading.
  - External references: NST per-60 convention; ratio-of-sums
  - Fixtures/test data: `web/lib/player-cards/analysisFixtures.ts (captureFixture, deterministic synthetic)`
  - Tests: `web/components/player-cards/PlayerAnalysisStudio.test.tsx`; `web/lib/player-cards/analysisSnapshot.test.ts`; `{"discovered_not_run": ["web/components/player-cards/PlayerAnalysisStudio.test.tsx", "web/lib/player-cards/analysisEvidence.test.ts", "web/lib/player-cards/analysisSnapshot.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/scripts/forge-goalie-backtest.test.ts", "web/components/TweetSwipeTrainer/TweetSwipeTrainer.test.tsx", "web/lib/socialShare/modules/server.test.ts", "web/lib/socialShare/modules/lastNightsStandouts.test.ts", "web/lib/socialShare/modules/busyQuiet.test.ts", "web/lib/socialShare/modules/goalieGsax.test.ts", "web/lib/socialShare/modules/shared/goalieInventory.sources.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts", "web/lib/socialShare/modules/riskyStarts.test.ts", "web/lib/cron/nhlOffSeason.test.ts", "web/lib/buyLowSellHigh/researchSnapshot.server.test.ts", "web/e2e/social-share.spec.ts", "web/lib/lines/storage.test.ts", "web/components/player-cards/ObservedPlayerCard.test.tsx", "web/components/player-cards/EditorialPlayerCard.test.tsx", "web/components/player-cards/PlayerAnalysisStudio.test.tsx", "web/tests/api/forge-scoreboard.test.ts", "web/__tests__/pages/api/v1/draft-ranker/discovery.test.ts", "web/__tests__/pages/api/v1/draft-ranker/community.test.ts", "web/lib/rosterScheduleOptimizer/reconciliation.test.ts"], "additional_reference_tests": 34, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) ppPoints per60 uses all-situation toiSeconds (not ppToiSeconds), so 'PP points/60' is per all-TOI
  - (opus) season baseline includes the recent games (disclosed) so deltas are diluted
  - (codex:roster-card-analysis-bsh) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-card-analysis-change) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-card-analysis-count-bases) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-card-analysis-ice-time) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-card-analysis-xg-bases) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-card-analysis-xg-share) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-002 Player-card recent vs baseline difference

- **Match:** Both; Opus CARD-006; Codex roster-card-analysis-change
- **Purpose:** Signed change between recent window and baseline
- **Where:** `web/lib/player-cards/analysisSnapshot.ts:78 (analysisDifference)`; `web/components/player-cards/CurrentPlayerCard.tsx:10 (difference)`; `web/lib/player-cards/analysisSnapshot.ts:78 analysisDifference`; `web/lib/player-cards/analysisSnapshot.ts:85 buildAnalysisSnapshot`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: development, current
- **Opus view (CARD-006):**
  - Method: delta = recent - baseline; totals withheld when GP differs (except TOI/xG%). CurrentPlayerCard shows shootingPct delta as percentage points ('pp'), others in metric units.
  - Inputs/units: same unit as each reading (totals/per-GP/per-60; SH% 0-100); sources: —
  - Output scale: signed difference in metric units; SH% in percentage points; writes: —
  - Status: live (CurrentPlayerCard 'recent-previous' format on pages/player-cards.tsx and social-share NHL mode); analysisDifference draft (PlayerAnalysisStudio unrouted)
  - Consumers: PlayerAnalysisCard; CurrentPlayerCard recent-previous format
- **Codex view (roster-card-analysis-change, calculation, location; Codex family 'Player-card analysis'):** Recent-minus-baseline metric change
  - Purpose: Builds latestN or UTC calendar recent window and previous equal non-overlap N or season-to-date baseline (season comparison restricted to L5/L10). Reports overlap; delta=recent-baseline. Ordinary total delta withheld for unequal appearance sample sizes.
  - Inputs/units: Qualified recent/baseline readings, basis, requested window and complete capture.
  - Output scale: Signed delta in reading units (percentage-point difference for xG%), sample counts, overlap count and known-short flags.
  - Version/status: fhfh-card-analysis-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/currentNhl.ts:98-99 comment 'Equal, non-overlapping own-appearance windows... never becomes a smaller, silently substituted comparison'
  - Intended contract (Codex roster-card-analysis-change): Explicit disclosure: season includes recent games and is not independent. Missing comparisons are not zero. Source: web/lib/player-cards/analysisSnapshot.ts:78 analysisDifference.
  - External references: none suggested
  - Fixtures/test data: `web/lib/player-cards/analysisFixtures.ts (captureFixture, deterministic synthetic)`
  - Tests: `web/components/player-cards/CurrentPlayerCardStudio.test.tsx`; `web/lib/player-cards/analysisSnapshot.test.ts`; `{"discovered_not_run": ["web/components/player-cards/PlayerAnalysisStudio.test.tsx", "web/lib/player-cards/analysisEvidence.test.ts", "web/lib/player-cards/analysisSnapshot.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) raw difference, no sample-size or regression adjustment for L5 vs L5 noise
  - (codex:roster-card-analysis-change) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-003 Player-card artwork/outline geometry (grouped)

- **Match:** Both; Opus CARD-007; Codex roster-card-outline-transform, roster-card-portrait-transform
- **Purpose:** Image processing for card portraits and outlines
- **Where:** `web/lib/player-cards/alphaOutline.ts:28 (squared Euclidean distance transform)`; `web/lib/player-cards/alphaOutline.ts:50 (alphaOutlinePixels)`; `web/lib/player-cards/portraitTreatment.ts:33 (posterize/luminance banding)`; `web/lib/player-cards/outlineStack.ts:8 (outline recipe validation)`; `web/lib/player-cards/alphaOutline.ts:27 distanceToContour`; `web/lib/player-cards/alphaOutline.ts:50 alphaOutlinePixels`; `web/lib/player-cards/alphaOutline.ts:95 outlineBandPixels`; `web/lib/player-cards/portraitTreatment.ts:32 portraitPixels`; `web/lib/player-cards/portraitTreatment.ts:79 compositionPixels`
- **Tags (heuristic):** generation: current
- **Opus view (CARD-007):**
  - Method: Felzenszwalb two-pass squared EDT; outline coverage = clamp(radius+1-sqrt(d)); luminance = .2126R+.7152G+.0722B quantised to 4-6 bands; pixelation block = width/120 or /185.
  - Inputs/units: RGBA 0-255 pixel buffers; px widths 0.5-12 in 0.5 steps; sources: —
  - Output scale: RGBA pixels; writes: —
  - Status: live — CurrentPlayerCardStudio artwork on pages/player-cards.tsx
  - Consumers: CurrentPlayerCard artwork
- **Codex view (roster-card-outline-transform, calculation, location; Codex family 'Presentation arithmetic (not player metrics)'):** Euclidean contour distance and outline coverage
  - Purpose: Computes exact squared Euclidean distance from >=50%-alpha silhouette in two passes. Coverage=clamp(radius+1-sqrt(distance),0,1); outside alpha=round(coverage*(255-originalAlpha)), interior0. Cumulative disk dilation differences form disjoint multi-color rings.
  - Inputs/units: RGBA mask, raster width/height and ring widths at2x design scale, RGB colors.
  - Output scale: Squared-pixel distance field and outline RGBA bytes0..255.
  - Version/status: OUTLINE_VERSION=fhfh-alpha-outline-v3. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-card-portrait-transform, calculation, location; Codex family 'Presentation arithmetic (not player metrics)'):** Portrait quantization, pixelation and team-color mapping
  - Purpose: RGB-only treatment preserving original alpha: block-center pixelation with edge fallback; six lightness bands for standalone posterization or five grayscale regions before composition; luminance=.2126R+.7152G+.0722B maps/interpolates team palette. Combined effects run first-stage transform then team mapping.
  - Inputs/units: RGBA bytes0..255, image dimensions pixels, color palette and selected style.
  - Output scale: Transformed RGBA bytes0..255 and intermediate buffers.
  - Version/status: PORTRAIT_VERSION=fhfh-portrait-v1; COMPOSITION_VERSION=fhfh-sequential-v2. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/alphaOutline.ts:46-49; portraitTreatment.ts:31 'RGB-only transforms'
  - Intended contract (Codex roster-card-outline-transform): Comments specify disk-dilation outside contour, one-raster-pixel ramp and disjoint annuli; presentation calculation, not hockey metric. Source: web/lib/player-cards/alphaOutline.ts:27 distanceToContour.
  - Intended contract (Codex roster-card-portrait-transform): Source comment requires every alpha byte/silhouette retained; visual transform included for calculation completeness, not a hockey metric. Source: web/lib/player-cards/portraitTreatment.ts:32 portraitPixels.
  - External references: Rec.709 luminance; Felzenszwalb-Huttenlocher EDT
  - Fixtures/test data: `web/lib/player-cards/reviewedHeroSamples.ts`
  - Tests: `web/lib/player-cards/alphaOutline.test.ts`; `web/lib/player-cards/outlineStack.test.ts`; `web/lib/player-cards/portraitTreatment.test.ts`; `{"discovered_not_run": ["web/components/player-cards/PlayerCardShareStudio.test.tsx", "web/components/player-cards/CurrentPlayerCardStudio.test.tsx", "web/lib/player-cards/portraitTreatment.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/components/player-cards/PlayerCardShareStudio.test.tsx", "web/lib/player-cards/alphaOutline.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-outline-transform) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-card-portrait-transform) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-004 BLSH current card evidence gate and market reference gap

- **Match:** Both; Opus CARD-008; Codex core-026
- **Purpose:** Bind an owner-reviewed BLSH display profile to the card's recent window and compare an expected value to a market reference
- **Where:** `web/lib/player-cards/analysisEvidence.ts:36 (cardBlshEvidence)`; `web/lib/player-cards/analysisEvidence.ts:59 (cardMarketReference)`; `web/lib/buyLowSellHigh/market.ts:91 (compareMarketReference, outside slice, called)`; `web/lib/buyLowSellHigh/market.ts:91 compareMarketReference`
- **Tags (heuristic):** denominators: per team game; generation: development
- **Opus view (CARD-008):**
  - Method: Evidence: requires exact game-id and source-id set match between receipt, profile window and card recent window, same strength and observedAt, method 'support-conditioned-production-gap-v1', window fresh and context verified; direction from gapSign as in retained path. Market: gap = expected.value - reference.value only when unit, horizonGames and scoringBasis match and reference age (asOf - capturedAt)/3.6e6 <= maxAgeHours; else unavailable.
  - Inputs/units: fantasy_points or count over horizonGames team games; hours; sources: owner-supplied BLSH display profile and receipt, market reference (no live source in slice)
  - Output scale: signed gap in fantasy points/counts (2 dp); writes: —
  - Status: draft — PlayerAnalysisStudio unrouted; market reference requires approvedMaxAgeHours (none supplied)
  - Consumers: PlayerAnalysisStudio / PlayerAnalysisCard
- **Codex view (core-026, calculation, location; Codex family 'BLSH interpretation'):** Comparable market-reference gap
  - Formula: expected-reference only when all comparability checks pass.
  - Purpose: Compare forecast with explicit manager/external reference.
  - Inputs/units: Expected total and reference matching unit, horizon, scoring basis, source, freshness.
  - Output scale: Expected minus reference in fantasy points/count over horizon.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). No explicit metric version identified. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/analysisEvidence.ts:35 'Consumes the owner's display mapping. Never recomputes a BLSH score or direction.'; :8 'exposure qualification never certifies counting stats'
  - Intended contract (Codex core-026): Ownership/popularity not accepted as market value; source comments.
  - External references: none suggested
  - Fixtures/test data: `web/lib/buyLowSellHigh/__fixtures__/syntheticProfiles.ts`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `web/lib/player-cards/analysisFixtures.ts`
  - Tests: `Located only; not run for this inventory.`; `web/components/player-cards/PlayerAnalysisStudio.test.tsx`; `web/lib/buyLowSellHigh/market.test.ts`; `web/lib/player-cards/analysisEvidence.test.ts`
- **Leads (not audited):**
  - (opus) market gap is a raw difference in fantasy points or counts over N team games with no uncertainty
  - (opus) no approved maxAgeHours exists in slice, so market reference is always 'unavailable' in practice
  - (codex:core-026) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-CARD-005 Top Adds composite score

- **Match:** Both; Opus CARD-012; Codex MISC-TOPADDS
- **Purpose:** Rank waiver add candidates for tonight or the week
- **Where:** `web/lib/dashboard/topAddsRanking.ts:64 (scoreTopAddsCandidate)`; `web/lib/dashboard/topAddsRanking.ts:98 (rankTopAddsCandidates)`; `web/lib/dashboard/topAddsRanking.ts:64 scoreTopAddsCandidate`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (CARD-012):**
  - Method: trend = delta*5; ownershipBias = (100-own)/100*8; projection = 2.25*pts + 0.85*PPP + 0.35*SOG + 0.12*(HIT+BLK); schedule (week mode) = 1.5*games + 1.25*offNights; risk = 1.5*uncertainty; total = trend+own+proj+sched-risk, rounded 2dp. Ties: delta desc, ownership asc, projection desc.
  - Inputs/units: ownership 0-100; delta = ownership change in percentage points; projections in per-game counts/points; uncertainty unitless; schedule counts; sources: /api/v1/forge/players, /api/v1/transactions/ownership-trends, /api/v1/transactions/ownership-snapshots
  - Output scale: unbounded additive score (2 dp); writes: —
  - Status: live — pages/FORGE.tsx, components/forge-dashboard/TopAddsRail.tsx, components/forge-command-center/TopAddsWatchlist.tsx
  - Consumers: dashboard Top Adds module; forge dashboard
- **Codex view (MISC-TOPADDS, calculation, location; Codex family 'Other product calculations'):** Top Adds opportunity ranking
  - Purpose: Rank waiver candidates using ownership momentum and projection support.
  - Inputs/units: Ownership/delta percentage points; projected points, PPP/SOG/hits/blocks; remaining/off-night games; uncertainty.
  - Output scale: Unbounded heuristic total and five components, rounded 2dp.
  - Version/status: day/week modes. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED weights; product gate context in tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:3567 (FORGE-TOP-ADDS-WEEK)
  - Intended contract (Codex MISC-TOPADDS): 5*delta+8*(100−ownership)/100+2.25*points+.85*PPP+.35*SOG+.12*(hits+blocks)+weekly schedule−1.5*uncertainty.
  - External references: none suggested
  - Fixtures/test data: `web/lib/dashboard/topAddsRanking.test.ts (inline)`
  - Tests: `web/lib/dashboard/topAddsRanking.test.ts`
- **Leads (not audited):**
  - (opus) magic weights; projection components are per-game for tonight but schedule term adds weekly volume without scaling projections by games
  - (opus) delta units (ownership pp over window) unscaled while other terms are fantasy-point scale
  - (codex:MISC-TOPADDS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-CARD-006 Current NHL card pooled basic rates (ATOI, shots/goals/points per 60, SH%)

- **Match:** Both; Opus CARD-018; Codex roster-card-nhl-counts, roster-card-nhl-rates
- **Purpose:** Pool NHL game-log rows for last N appearances and an equal preceding window
- **Where:** `web/lib/player-cards/currentNhl.ts:47 (poolGames)`; `web/lib/player-cards/currentNhl.ts:42 (toi mm:ss -> seconds)`; `web/lib/player-cards/currentNhl.ts:62 (buildCurrentNhlCard)`; `web/lib/player-cards/currentNhl.ts:7 (CURRENT_NHL_DEFINITIONS)`; `web/lib/player-cards/currentNhl.ts:47 poolGames`; `web/lib/player-cards/currentNhl.ts:62 buildCurrentNhlCard`; `web/lib/player-cards/currentNhl.ts:7 CURRENT_NHL_DEFINITIONS`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game, shots on goal; generation: current
- **Opus view (CARD-018):**
  - Method: Validate points=goals+assists and goals<=shots; atoi = sumTOIsec/GP/60; shots60/goals60/points60 = total*3600/sumTOIsec; shootingPct = goals/shots*100 (null if 0 shots); previous window = appearances N+1..2N, must be full N.
  - Inputs/units: NHL game-log toi 'mm:ss' converted to seconds; integer counts per game; sources: NHL api-web player game-log and schedule (fetched server-side by caller)
  - Output scale: ATOI minutes/GP; per-60 rates; SH% 0-100; counts totals; writes: —
  - Status: live — pages/player-cards.tsx and pages/api/v1/player-cards.ts (parseCurrentNhlRequest, loadCurrentNhlCard)
  - Consumers: CurrentPlayerCard; ProductionGameChart; analysisCaptureFromNhl; pages/api player-card current route
- **Codex view (roster-card-nhl-counts, calculation, location; Codex family 'Player-card current NHL metrics'):** NHL window totals and average ice time
  - Purpose: Pools reconciled current NHL game-log G/A/P/SOG and TOI. ATOI=sumTOIseconds/appearances/60; validates P=G+A and G<=SOG. Selects requested5/10/20 latest appearances and equally sized non-overlapping preceding window if available.
  - Inputs/units: Current captured NHL regular-season logs, final schedule identities, total season GP and TOI mm:ss parsed to seconds.
  - Output scale: Goal/assist/point/shot totals; TOI seconds; ATOI minutes/appearance; actualGP or unavailable.
  - Version/status: Evidence version nhl-basic-skater-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-card-nhl-rates, calculation, location; Codex family 'Player-card current NHL metrics'):** NHL goals, points and shots per 60 and shooting percentage
  - Purpose: For pooled current NHL appearances returns3600*sum(stat)/sumTOIseconds for goals/points/shots and100*sumGoals/sumShots for shooting percentage; zero shots gives null percentage.
  - Inputs/units: Pooled NHL G/P/SOG counts and compatible positive TOI seconds.
  - Output scale: Goals/60, points/60, shots/60 and shooting percentage0..100 or unavailable.
  - Version/status: nhl-basic-skater-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/currentNhl.ts:1 'NHL basic skater results... deliberately separate from NST metrics'; definitions at currentNhl.ts:7-17
  - Intended contract (Codex roster-card-nhl-counts): Current observation only: FINAL/OFF is not an actual game-end timestamp or historical-cutoff proof; season appearances must reconcile. No full-NHL rank admitted. Source: web/lib/player-cards/currentNhl.ts:47 poolGames.
  - Intended contract (Codex roster-card-nhl-rates): CURRENT_NHL_DEFINITIONS documents each formula; values use pooled exposure rather than averages of per-game rates. Source: web/lib/player-cards/currentNhl.ts:47 poolGames.
  - External references: NHL.com TOI/GP and per-60 conventions; ratio-of-sums SH%
  - Fixtures/test data: `web/lib/player-cards/currentNhl.test.ts (inline fixtures)`; `contract-fixture source in CurrentPlayerCardStudio tests`
  - Tests: `web/components/player-cards/CurrentPlayerCardStudio.test.tsx`; `web/lib/player-cards/currentNhl.test.ts`; `{"discovered_not_run": ["web/components/player-cards/CurrentPlayerCardStudio.test.tsx", "web/lib/player-cards/currentNhl.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/components/player-cards/CurrentPlayerCardStudio.test.tsx", "web/lib/player-cards/currentSelection.test.ts", "web/lib/player-cards/currentNhl.test.ts", "web/lib/player-cards/analysisSnapshot.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) all-strength only; per-60 includes PP time
  - (opus) shootingPct on 0-100 scale
  - (codex:roster-card-nhl-counts) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-card-nhl-rates) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-007 Player-card pooled NST metric (ATOI, per-60, percentage)

- **Match:** Both; Opus CARD-019; Codex roster-card-nst-ixg60
- **Possible related records (low-confidence location link, unconfirmed):** roster-card-nst-atoi, roster-card-nst-cf60, roster-card-nst-icf60, roster-card-nst-ipp, roster-card-nst-iscf60, roster-card-nst-oishpct, roster-card-nst-scf60, roster-card-nst-shpct, roster-card-nst-sog60, roster-card-nst-xgf60, roster-card-nst-xgpct
- **Purpose:** Pool a player's selected appearance-window NST game rows into 12 card metrics using ratio-of-sums
- **Where:** `web/lib/player-cards/aggregation.ts:42 (pooledMetric)`; `web/lib/player-cards/aggregation.ts:62 (aggregateWindow)`; `web/lib/player-cards/registry.ts:10 (METRICS)`; `web/lib/player-cards/registry.ts:15 [inline calculation: Proposed NST individual xG per 60]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game; generation: development, current
- **Opus view (CARD-019):**
  - Method: Per metric: sum numerator components and denominator components over all selected games (ratio of sums). atoi = sum(individual.toi sec)/GP/60 (min/GP); per60 = 3600*sum(num)/sum(TOI sec) (individual metrics use individual.toi, on-ice metrics cf60/scf60/xgf60 use onIce.toi); percentage = 100*sum(num)/sum(den): xG% = xgf/(xgf+xga), IPP = total_points/onIce.gf, SH% = goals/shots, oiSH% = onIce.gf/onIce.sf. Per-game validation: any negative/missing component -> missing; per60 with zero TOI but events>0 -> missing; percentage num>den -> missing; pooled zero denominator -> state 'undefined'.
  - Inputs/units: TOI seconds (declared toiUnit 'seconds'); individual and on-ice event counts (totals per game); xG in goals; sources: nst_gamelog_{as\|es?\|pp}_counts, nst_gamelog_*_counts_oi (via nstCapture mapping)
  - Output scale: atoi minutes per GP; per-60 rates (events*3600/TOI sec); percentages 0-100 (xG%, IPP, SH%, oiSH%); ratio-of-sums across games; writes: —
  - Status: draft — synthetic/fixture-only path: rendered by components/player-cards/PlayerCardShareStudio.tsx on pages/social-share/player-cards.tsx (non-NHL mode) via interactionFixtures; PLAYER_CARD_CAPABILITIES.liveData=false (web/lib/player-cards/contracts.ts:42); observed NST population admission pending
  - Consumers: adapter.ts adaptLocalSnapshot; EditorialPlayerCard/ObservedPlayerCard/PlayerCard components; cardEvidenceVerdict observed card
- **Codex view (roster-card-nst-ixg60, calculation, location; Codex family 'Player-card proposed NST metrics'):** Proposed NST individual xG per 60
  - Purpose: 3600*sum(individual.ixg)/sum(individual.toi seconds).
  - Inputs/units: Provider individual xG and compatible individual TOI seconds.
  - Output scale: Expected goals per60 minutes, nonnegative or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/aggregation.ts:41 'Arithmetic only; makes no source, window or league-coverage claim'; registry formulas web/lib/player-cards/registry.ts:11-22; tasks/tasks-prd-player-cards-evolution-2026-10-31.md:46 (all-NHL same-definition cohort, competition ranks, midrank percentiles, no GP/TOI filters); tasks/tasks-prd-shareable-player-cards.md:42
  - Intended contract (Codex roster-card-nst-ixg60): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:15.
  - External references: NST per-60 convention (events*60/TOI min) and NST on-ice xGF%, IPP, SH%, oiSH% definitions; ratio-of-sums convention
  - Fixtures/test data: `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
  - Tests: `web/lib/player-cards/aggregation.r1.test.ts`; `web/lib/player-cards/domain.test.ts`; `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) assumes NST gamelog toi is in seconds (toiUnit:'seconds' enforced as a declared contract, not measured)
  - (opus) IPP and SH% returned on 0-100 scale while other FHFH modules (playerTrendCalculator primary_points_pct, skaterMetrics shootingPercentage) use 0-1
  - (opus) strength choices are only all/5v5/pp; registry says provider definitions 'unverified'
  - (codex:roster-card-nst-ixg60) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-008 Observed-card sample TOI back-calculation

- **Match:** Both; Opus CARD-021; Codex MISC-CARD-TOI
- **Purpose:** Derive sample total TOI seconds for display/export from ATOI
- **Where:** `web/lib/player-cards/observedView.ts:23 (projectObservedCard)`; `web/lib/player-cards/observedView.ts:13 projectObservedCard`
- **Tags (heuristic):** denominators: per game; generation: development, current
- **Opus view (CARD-021):**
  - Method: toiSeconds = atoi * 60 * gp; exportable only if gp, toiSeconds and at least one valid reading exist; poolComplete = all metric pools verified.
  - Inputs/units: atoi minutes per GP; GP count; sources: —
  - Output scale: TOI seconds total; writes: —
  - Status: draft — used only via cardEvidenceVerdict.observedCardView (web/lib/player-cards/cardEvidenceVerdict.ts:77); observed admission pending
  - Consumers: ObservedPlayerCard; observedCardView
- **Codex view (MISC-CARD-TOI, calculation, location; Codex family 'Other product calculations'):** Observed-card total TOI reconstruction
  - Purpose: Derive sample exposure from displayed ATOI and admitted game count.
  - Inputs/units: Valid ATOI minutes/game and actual GP.
  - Output scale: TOI seconds=ATOI*60*GP, or null when unavailable.
  - Version/status: Local observed-card view. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/observedView.ts:12 'Presentation projection only'
  - Intended contract (Codex MISC-CARD-TOI): Presentation projection only; trusted validator state gates rejection.
  - External references: none suggested
  - Fixtures/test data: `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
  - Tests: `No adjacent test located; broader suites not exhaustively traced.`; `web/components/player-cards/ObservedPlayerCard.test.tsx`; `web/lib/player-cards/observedExport.test.ts`
- **Leads (not audited):**
  - (opus) round-trips TOI via a derived average instead of the pooled toiSeconds already computed in aggregateWindow
  - (codex:MISC-CARD-TOI) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-CARD-009 Player-card competition rank and midrank percentile

- **Match:** Both; Opus CARD-022; Codex roster-card-rank
- **Possible related records (low-confidence location link, unconfirmed):** roster-card-analysis-bsh, roster-card-analysis-count-bases, roster-card-analysis-xg-bases
- **Purpose:** Rank a player's card metric within a verified full population
- **Where:** `web/lib/player-cards/ranking.ts:8 (rankMetric)`; `web/lib/player-cards/analysisSnapshot.ts:111 (analysisRank)`; `web/lib/player-cards/analysisSnapshot.ts:9 (CARD_RANK_POLICY)`; `web/lib/player-cards/ranking.ts:8 rankMetric`; `web/lib/player-cards/analysisSnapshot.ts:111 analysisRank`
- **Tags (heuristic):** percent scale: 0-100; generation: development, current
- **Opus view (CARD-022):**
  - Method: Highest value first; ordinal = (#values strictly above)+1 (competition ties 1,2,2,4); percentile = 100*(below + 0.5*equal)/N (midrank, inclusive of self); tied flag if equal>1. Returns null if any row missing, duplicate ids, or definition key mismatch. No min-GP/TOI/position qualifier.
  - Inputs/units: metric value in its own unit (same definitionKey); sources: —
  - Output scale: ordinal rank 1..N (competition ties), percentile 0-100 midrank; writes: —
  - Status: draft — synthetic/fixture-only path: rendered by components/player-cards/PlayerCardShareStudio.tsx on pages/social-share/player-cards.tsx (non-NHL mode) via interactionFixtures; PLAYER_CARD_CAPABILITIES.liveData=false (web/lib/player-cards/contracts.ts:42); observed NST population admission pending; analysisRank returns null for non-synthetic captures (analysisSnapshot.ts:113)
  - Consumers: adapter.ts; analysisSnapshot analysisRank; EditorialPlayerCard percentile bars
- **Codex view (roster-card-rank, calculation, location; Codex family 'Player-card population and windows'):** Competition ordinal rank and midrank percentile
  - Purpose: Within a complete same-definition pool, counts greater/below/equal values. Ordinal=greater+1; percentile=100*(below+.5*equal)/N. Excludes explicitly undefined values, rejects missing/incomplete/duplicate definitions. Analysis wrapper presently requires synthetic capture; observed population admission is pending.
  - Inputs/units: Finite metric values, matching definition key, unique player IDs and verified complete eligible-population evidence.
  - Output scale: Ordinal competition rank1..N, percentile0..100, population count and tie flag or unavailable.
  - Version/status: CARD_RANK_POLICY=fhfh-card-rank-policy-2026-11-01; source comment records approval, not independently verified here. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable …
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/analysisSnapshot.ts:8-9 CARD_RANK_POLICY approved by TJ 2026-11-01; web/lib/player-cards/ranking.ts:7 'Proposed numeric convention; no GP/TOI/position/active-roster qualifier'; tasks/tasks-prd-player-cards-evolution-2026-10-31.md:46 (all-NHL same-definition cohort, competition ranks, midrank percentiles, no GP/TOI filters); tasks/tasks-prd-shareable-player-cards.md:42
  - Intended contract (Codex roster-card-rank): ranking.ts calls numeric convention proposed; analysisSnapshot CARD_RANK_POLICY source records approved highest-numeric-first/competition/midrank policy with no additional qualifier. Observed source admission remains separate. Source: web/lib/player-cards/ranking.ts:8 rankMetric.
  - External references: Empirical percentile rank (midrank) convention
  - Fixtures/test data: `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
  - Tests: `web/components/player-cards/EditorialPlayerCard.test.tsx`; `web/lib/player-cards/analysisSnapshot.test.ts`; `web/lib/player-cards/ranking.test.ts`; `{"discovered_not_run": ["web/components/player-cards/PlayerAnalysisStudio.test.tsx", "web/lib/player-cards/ranking.test.ts", "web/lib/player-cards/analysisSnapshot.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) no minimum GP/TOI filter, so low-sample players enter the pool (explicitly documented as policy 'additionalQualifiers: none')
  - (opus) 'higher numeric is better' applied to every metric, including ones where direction is ambiguous
  - (opus) midrank percentile differs from trends utils percentile() and goalie percentile conventions elsewhere
  - (codex:roster-card-rank) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-010 Player-card appearance window selection (L5/L10/L20 or calendar)

- **Match:** Both; Opus CARD-024; Codex roster-card-window
- **Purpose:** Choose the last N completed appearances or a UTC calendar range before a cutoff
- **Where:** `web/lib/player-cards/windows.ts:62 (selectWindow)`; `web/lib/player-cards/windows.ts:37 (completionBounds)`; `web/lib/player-cards/windows.ts:51 (settingsError)`; `web/lib/player-cards/windows.ts:62 selectWindow`; `web/lib/player-cards/windows.ts:37 completionBounds`
- **Tags (heuristic):** generation: development, current
- **Opus view (CARD-024):**
  - Method: Filter season/regular-season played games up to cutoff, require verified-final completion; sort newest first by date, completion time, gameId; take first N (appearances mode) or all in inclusive UTC calendar range. knownShort when fewer than N; 'require-full' policy turns short into undefined. Same-date ordering ambiguity rejected.
  - Inputs/units: UTC ISO timestamps; appearance counts 5/10/20 (games, not days); sources: retained appearance-history receipts
  - Output scale: ordered game list; actualGp count; writes: —
  - Status: draft — synthetic/fixture-only path: rendered by components/player-cards/PlayerCardShareStudio.tsx on pages/social-share/player-cards.tsx (non-NHL mode) via interactionFixtures; PLAYER_CARD_CAPABILITIES.liveData=false (web/lib/player-cards/contracts.ts:42); observed NST population admission pending
  - Consumers: aggregation.ts aggregateWindow; adapter.ts
- **Codex view (roster-card-window, calculation, location; Codex family 'Player-card population and windows'):** Verified appearance window and exposure selection
  - Purpose: Selects last5/10/20 actual appearances or inclusive UTC calendar window under explicit season/short-sample policy. Exact completion timestamp or a bounded one-minute range determines eligibility at cutoff; ambiguous overlap/order is withheld. Computes actualGP, known-short and first/last dates.
  - Inputs/units: Complete official appearance history, played/final evidence, UTC cutoff/calendar dates and requested N.
  - Output scale: Ordered game IDs, actual appearance count, range dates, known-short state or unavailable.
  - Version/status: Proposed player-card window contract. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/windows.ts:61 'No implicit defaults; provisional season and short-sample choices are explicit'; windows.ts:36 minute-range completion contract
  - Intended contract (Codex roster-card-window): Explicit proposed season-only/full-versus-short policy in CardSettings; completion minute is a range, not an invented second. Source: web/lib/player-cards/windows.ts:62 selectWindow.
  - External references: Last-N-games window convention (games, not days)
  - Fixtures/test data: `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
  - Tests: `web/lib/player-cards/domain.test.ts`; `{"discovered_not_run": ["web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) only regular season; season-only policy so L10 early in season is a short sample
  - (codex:roster-card-window) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-011 WiGO per-game table: per-GP, S%, 84-game pace

- **Match:** Opus only; Opus CARD-001; Codex —
- **Purpose:** Per-game and 84-game pace rows for the WiGO player totals card.
- **Where:** `web/components/WiGO/PerGameStatsTable.tsx:87 (rows)`; `web/components/WiGO/PerGameStatsTable.tsx:90 (shooting_percentage)`; `web/components/WiGO/PerGameStatsTable.tsx:101 (perGameValue/per84Value)`; `web/components/WiGO/PerGameStatsTable.tsx:145 (summary perGame)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (CARD-001):**
  - Method: S% = 100*goals/shots (null if shots<=0). perGame = total/gp. per84 = perGame*84 (hard-coded season length). S% row has no pace.
  - Inputs/units: season totals (counts); sources: useWigoPlayerTotals (wgo totals)
  - Output scale: per-game rate; 84-game count; writes: —
  - Status: live — WiGO dashboard
  - Consumers: WigoDashboardSections (WiGO charts page)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NHL S% convention; season pace
  - Fixtures/test data: none listed
  - Tests: `web/components/WiGO/PerGameStatsTable.test.tsx`
- **Leads (not audited):**
  - (opus) duplicate implementation of DRF-036 84-game pace (getProratedStat NHL_REGULAR_SEASON_GAMES)
  - (opus) 84 hard-coded regardless of season length (82 pre-2026-27)
  - (opus) gp=0 not guarded for perGame (division by zero -> Infinity) unless upstream filters

## M-CARD-012 Player-card interaction snapshot sample TOI back-calculation

- **Match:** Opus only; Opus CARD-002; Codex —
- **Purpose:** Rebuild sample TOI seconds for the interactive card export from ATOI and games played.
- **Where:** `web/lib/player-cards/interactionSnapshot.ts:20-22 (displaySnapshot)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (CARD-002):**
  - Method: toiSeconds = atoi * 60 * actualGp (null if atoi missing); gp null when selection missing; pngContext refuses export when TOI or GP null.
  - Inputs/units: minutes per game; sources: (synthetic interaction fixtures)
  - Output scale: seconds; writes: —
  - Status: live — player-card flow (synthetic fixtures source)
  - Consumers: web/components/player-cards/PlayerCardFlow.tsx; web/components/player-cards/InteractiveCard.tsx; web/pages/social-share/player-cards.tsx; web/lib/player-cards/shareExport.ts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: `web/lib/player-cards/interactionFixtures.ts`
  - Tests: `web/components/player-cards/EditorialPlayerCard.test.tsx`; `web/lib/player-cards/shareExport.test.ts`
- **Leads (not audited):**
  - (opus) duplicate implementation of Observed-card sample TOI back-calculation (CARD-018, observedView.ts:23)
  - (opus) back-calculated from a per-game average, so TOI total inherits ATOI rounding

## M-CARD-013 Player vs Player comparison (totals / per appearance / per 60 with NST coverage gate)

- **Match:** Opus only; Opus CARD-003; Codex —
- **Purpose:** Compare two skaters on one window, basis and strength for the Player vs Player share post.
- **Where:** `web/lib/socialShare/modules/playerVsPlayer.ts:160 (metricSide)`; `web/lib/socialShare/modules/playerVsPlayer.ts:178 (comparePlayerWindows)`; `web/lib/socialShare/modules/playerVsPlayer.ts:135 (PVP_METRICS)`; `web/lib/socialShare/modules/playerVsPlayer.ts:126 (joinNst)`; `web/lib/socialShare/modules/playerVsPlayer.ts:247 (buildPlayerVsPlayer)`; `web/lib/socialShare/modules/playerVsPlayer.ts:338 (minCoverage default 90)`
- **Tags (heuristic):** denominators: per 60, per appearance; generation: current
- **Opus view (CARD-003):**
  - Method: Window L5, L10 appearances or season to date. Per metric: known values only; WGO metrics admitted if any known; NST metrics admitted if observed*100 >= minCoverage*expected (default 90%). Value = sum (total), sum/observed (per appearance), or per60 over games with both count and time (PP strength uses PP TOI). Refuses mixed strength/basis/window. 'higher' decided on printed values (equal printed = tie); totals not compared when sample sizes differ. NST row joined by player+date; duplicate dates join nothing; gp=0 rows skipped. Discussion summary counts sides of hand-picked posts but never claims consensus.
  - Inputs/units: counts; TOI seconds; sources: wgo_skater_stats, wgo_team_stats, games, nst_gamelog_as_counts, playerVsPlayer.candidates.json
  - Output scale: totals, per appearance, per 60; writes: —
  - Status: live — share module playerVsPlayerModule
  - Consumers: web/lib/socialShare/modules/lanes/comparison.ts; Player vs Player share card
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/playerVsPlayer.ts:7-10 comment (two players on one basis and strength; no consensus claimed)
  - External references: NST per-60 convention
  - Fixtures/test data: `web/lib/socialShare/modules/playerVsPlayer.candidates.json`
  - Tests: `web/lib/socialShare/modules/playerVsPlayer.test.ts`
- **Leads (not audited):**
  - (opus) per-appearance basis divides by observed (known) games, not window games, so missing games inflate per-game values
  - (opus) NST ixG/iSCF are NST-model values, joined by date_scraped which may differ from game date

## M-CARD-014 Analysis card radar/bars common raw scale

- **Match:** Opus only; Opus CARD-004; Codex —
- **Purpose:** Scale heterogeneous metrics on one raw axis
- **Where:** `web/components/player-cards/PlayerAnalysisCard.tsx:49`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development
- **Opus view (CARD-004):**
  - Method: maximum = max(1, all row values); radar radius = value/maximum*130.
  - Inputs/units: mixed: counts, minutes, xG, percent 0-100; sources: —
  - Output scale: relative 0-1 of max on a common raw axis; writes: —
  - Status: draft — PlayerAnalysisStudio unrouted
  - Consumers: PlayerAnalysisStudio
- **Audit context:**
  - Intent (Opus): web/components/player-cards/PlayerAnalysisCard.tsx:65/69 labels 'Raw count shape, not percentiles'
  - External references: none suggested
  - Fixtures/test data: `web/lib/player-cards/analysisFixtures.ts (captureFixture, deterministic synthetic)`
  - Tests: `web/components/player-cards/PlayerAnalysisStudio.test.tsx`
- **Leads (not audited):**
  - (opus) counts, xG, minutes and % share one raw scale, so the shape is dominated by large-unit metrics (labelled as 'raw count shape, not percentiles')

## M-CARD-015 BLSH retained research evidence on player cards (box comparison, capture age, direction)

- **Match:** Opus only; Opus CARD-009; Codex —
- **Purpose:** Validate and present a frozen BLSH support-conditioned production-gap snapshot on the player analysis card, with WGO-vs-official box comparison and provenance age
- **Where:** `web/lib/player-cards/retainedBlsh.ts:52 (retainedBlshEvidence)`; `web/lib/player-cards/retainedBlsh.ts:21 (retainedBoxEvidence)`; `web/lib/player-cards/retainedBlsh.ts:5-13 (SHA256 pins)`; `web/lib/player-cards/retainedBlsh.ts:64 (capture age hours)`; `web/lib/player-cards/retainedBlsh.ts:60 (direction from gapSign)`; `web/components/player-cards/PlayerAnalysisStudio.tsx:7 (consumer)`
- **Tags (heuristic):** generation: development
- **Opus view (CARD-009):**
  - Method: No BLSH score is recomputed here (scoreVersion must be 'support-conditioned-production-gap-v1'). Gates: snapshot SHA equals RETAINED_BLSH_SHA256; player/team/season match; research flags (provisional, exploratory, not trusted, no calibrated probability, no forecast/market claims); window games = dates = unique sourceIds; exactly 3 finite tracks. Direction: gapSign buy_low_evidence -> positive, sell_high_evidence -> negative, balanced -> level, withheld -> unknown. Capture age hours = (generatedAtUTC - asOfUTC)/3,600,000; stale if > maxCaptureAgeHours (must equal 24). Box comparison: per final-game row each field state = match if WGO==official else mismatch; summary counts match/differ/unknown rows; PPP unknown when PP assists not supplied. Tracks shown to 2 dp as 'window totals'.
  - Inputs/units: tracks in fantasy-relevant window totals (method units from DisplayProfile); TOI seconds in box rows; timestamps UTC; sources: retained BLSH display snapshot (fhfh.blsh.current-research-snapshot.v2) pinned by SHA256, provenance sidecar, NHL api-web gamecenter boxscore bodies (retained, pinned)
  - Output scale: direction label; signed gap totals (2 dp); age hours; writes: —
  - Status: draft — retainedBlshEvidence consumed only by components/player-cards/PlayerAnalysisStudio.tsx, which no page imports; retained tests gated by retainedEnabled in web/lib/buyLowSellHigh/__fixtures__/retainedData.ts
  - Consumers: components/player-cards/PlayerAnalysisStudio.tsx; PlayerAnalysisCard evidence panel
- **Audit context:**
  - Intent (Opus): web/lib/player-cards/retainedBlsh.ts:4 'Frozen local research handoff, not live input admission or a scoring implementation'; tasks/tasks-prd-buy-low-sell-high.md; tasks/tasks-prd-player-cards-evolution-2026-10-31.md
  - External references: Regression-to-support / expected-vs-actual production gap (BLSH method lives in web/lib/buyLowSellHigh); NHL official boxscore as ground truth for counts
  - Fixtures/test data: `web/lib/buyLowSellHigh/__fixtures__/retainedData.ts`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `web/lib/buyLowSellHigh/__fixtures__/syntheticProfiles.ts`; `web/lib/buyLowSellHigh/__fixtures__/syntheticSnapshots.ts`; `web/components/blshTrade/fixtureEvidence.ts`
  - Tests: `web/components/player-cards/PlayerAnalysisStudio.test.tsx`; `web/lib/buyLowSellHigh/displayProfile.test.ts`; `web/lib/player-cards/analysisEvidence.test.ts`; `web/lib/player-cards/retainedBlsh.test.ts`
- **Leads (not audited):**
  - (opus) tracks labelled 'window totals' — gap is in totals, not per-game, so windows of different length are not comparable
  - (opus) hard-coded SHA pins and 24-hour budget; any snapshot refresh makes the card unavailable until code changes
  - (opus) box comparison checks TOI + 5 counts only; PPP often unknown (no PP assists in box)
  - (opus) BLSH score math itself is outside this slice (web/lib/buyLowSellHigh)

## M-CARD-016 Dashboard insight tone and trend bands

- **Match:** Opus only; Opus CARD-010; Codex —
- **Purpose:** Classify luck pressure and trend scores into labelled bands
- **Where:** `web/lib/dashboard/playerInsightContext.ts:6 (resolveInsightTone)`; `web/lib/dashboard/playerInsightContext.ts:59 (describeTrendBand)`
- **Tags (heuristic):** generation: current
- **Opus view (CARD-010):**
  - Method: \|luck_pressure\| >=1.25 risk, >=0.75 watch, else stable. Movement mode: >=2 up fast, <=-2 dropping fast. HotCold mode: >=75 hot, <=25 cold.
  - Inputs/units: luck_pressure z-like; trend score percentile 0-100 or movement delta; sources: /api/v1/sustainability/trends, /api/v1/trends/skater-power
  - Output scale: categorical bands; writes: —
  - Status: live — components/forge-dashboard/SustainabilityCard.tsx and HotColdCard.tsx
  - Consumers: dashboard sustainability and trend cards
- **Audit context:**
  - Intent (Opus): web/lib/dashboard/playerInsightContext.ts:19-21 comment: luck pressure compares shooting, on-ice shooting and IPP with position norms
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) luck_pressure scale (z-like) assumed; computed upstream in sustainability API not in this slice

## M-CARD-017 Yahoo ownership freshness gate

- **Match:** Opus only; Opus CARD-011; Codex —
- **Purpose:** Accept ownership % only if observed within 3 days
- **Where:** `web/lib/dashboard/playerOwnership.ts:54 (ownershipSnapshot)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (CARD-011):**
  - Method: Valid if 0<=v<=100; fresh if age <= 3*86400000 ms, else stale and ownership null. Yahoo season = year if month>=8 else year-1.
  - Inputs/units: ownership percent 0-100; YYYY-MM-DD; sources: /api/v1/transactions/ownership-snapshots, /api/v1/transactions/ownership-trends
  - Output scale: ownership 0-100 or null; fresh/stale; writes: —
  - Status: live — pages/FORGE.tsx, pages/forge/player/[playerId].tsx, PlayerPickupTable, forge-dashboard cards
  - Consumers: dashboard player modules
- **Audit context:**
  - Intent (Opus): web/lib/dashboard/playerOwnership.ts:79-80 Yahoo season by starting year comment
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts`; `web/lib/dashboard/playerOwnership.test.ts`
- **Leads (not audited):**
  - (opus) age measured from UTC midnight of observation date

## M-CARD-018 Homepage pregame projected-score freshness and SOG/xG merge

- **Match:** Opus only; Opus CARD-013; Codex —
- **Purpose:** Attach FORGE projected goals, team xG and shots on goal to homepage games
- **Where:** `web/lib/homepageGameAnalytics.ts:188 (isFreshPregameScore)`; `web/lib/homepageGameAnalytics.ts:199 (mergeForgeProjectedScores)`; `web/lib/homepageGameAnalytics.ts:243 (mergePersistedGameMetrics)`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (CARD-013):**
  - Method: Fresh if -60s <= start - computed_at <= MAX_PREGAME_SCORE_AGE_MS; latest computed row per game wins. Team SOG = sum of non-null shots_es + shots_pp + shots_pk.
  - Inputs/units: expected goals per team; shots counts per strength bucket; ms timestamps; sources: forge score outputs table (game_prediction_outputs query), nhl_xg_model_registry, nhl_xg_team_game_aggregates, forge_team_game_strength
  - Output scale: goals (projected), xG, SOG totals; writes: —
  - Status: live — pages/index.tsx:607 and pages/api/v1/games/index.js
  - Consumers: homepage game cards
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NHL.com team SOG
  - Fixtures/test data: `web/lib/homepageGameAnalytics.test.ts (inline)`
  - Tests: `web/lib/homepageGameAnalytics.test.ts`
- **Leads (not audited):**
  - (opus) SOG sums only ES+PP+PK strength buckets; a null bucket is silently treated as 0 if any other bucket is present
  - (opus) is_home fallback used only for xG rows, not shots rows

## M-CARD-019 Homepage model-vs-market edge and favoured team

- **Match:** Opus only; Opus CARD-014; Codex —
- **Purpose:** Show win probabilities, favoured team and largest model edge vs no-vig market
- **Where:** `web/lib/homepageGameAnalytics.ts:89 (analyticsFromPrediction)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (CARD-014):**
  - Method: homeEdge = (pHome - pMarketHome)*100 pp; awayEdge likewise; selected edge = larger of the two (ties -> home); favoured = home if pHome >= pAway. Stale predictions suppress all values.
  - Inputs/units: probabilities 0-1 (model and no-vig market); sources: game_prediction_outputs (via fetchPublicGamePredictions)
  - Output scale: edge in percentage points (x100, 3 dp); writes: —
  - Status: live — pages/index.tsx:607 enrichHomepageGames and pages/api/v1/games/index.js
  - Consumers: homepage game cards (enrichHomepageGames)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: No-vig implied probability edge
  - Fixtures/test data: `web/lib/homepageGameAnalytics.test.ts (inline)`
  - Tests: `web/lib/homepageGameAnalytics.test.ts`
- **Leads (not audited):**
  - (opus) picks max signed edge, so when both edges are negative it reports the less-negative side as the 'edge'

## M-CARD-020 Homepage pulse sparkline (model edge / confidence)

- **Match:** Opus only; Opus CARD-015; Codex —
- **Purpose:** Build a 64-point timeline of model-vs-market disagreement for the current slate
- **Where:** `web/lib/homepagePulse.ts:155 (buildHomepagePulsePoints)`; `web/lib/homepagePulse.ts:106 (buildSnapshotEdgeObservations)`; `web/lib/homepagePulse.ts:76 (bucketObservations)`; `web/lib/homepagePulse.ts:50 (embeddedMarketEdge)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (CARD-015):**
  - Method: Observation = \|pModel - pMarket\| using latest prediction at or before each pre-start market snapshot, plus \|embedded model_vs_market_edge\|. Bucket into 15-min bins taking the max; downsample to 64 points by even index. If fewer than 2 market observations, fallback value = \|pHome - 0.5\| per prediction. Slate = today, else latest 2 snapshot dates.
  - Inputs/units: probabilities 0-1; embedded model_vs_market_edge unit unknown; sources: game_prediction_history, game_prediction_market_odds_snapshots
  - Output scale: absolute probability gap 0-0.5 (fraction); 64 points max; writes: —
  - Status: live — pages/index.tsx:666 and pages/api/v1/homepage/pulse.ts
  - Consumers: homepage pulse widget
- **Audit context:**
  - Intent (Opus): web/lib/homepagePulse.ts:191-193 comment: historical rows predate market snapshots; distance from 50% keeps offseason pulse real until market capture resumes
  - External references: none suggested
  - Fixtures/test data: `web/lib/homepagePulse.test.ts (inline)`
  - Tests: `web/__tests__/index.test.tsx`; `web/components/HomePage/HomepagePulse.test.tsx`; `web/lib/homepagePulse.test.ts`
- **Leads (not audited):**
  - (opus) fallback series measures model confidence (\|p-0.5\|), a different quantity than market edge, under the same chart
  - (opus) embedded edge units (fraction vs percentage points) not checked against snapshot edge fraction; both mixed in one series

## M-CARD-021 Homepage daily visitors

- **Match:** Opus only; Opus CARD-016; Codex —
- **Purpose:** Clamp Vercel analytics visitor counts
- **Where:** `web/lib/homepageVisitors.ts:22 (buildDailyVisitorPoints)`
- **Tags (heuristic):** generation: current
- **Opus view (CARD-016):**
  - Method: value = max(0, visitors) per day.
  - Inputs/units: visitor counts per day; sources: Vercel web-analytics API
  - Output scale: nonnegative counts; writes: —
  - Status: live — pages/api/v1/homepage/visitors.ts
  - Consumers: homepage pulse
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/homepageVisitors.test.ts`

## M-CARD-022 Production-by-game chart scaling

- **Match:** Opus only; Opus CARD-017; Codex —
- **Purpose:** Stacked goals/assists bars per appearance on fixed 0-5 scale
- **Where:** `web/components/player-cards/ProductionGameChart.tsx:5 (ProductionGameChart)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (CARD-017):**
  - Method: goals clipped to 5, assists clipped to 5-goals; bar height = value*26px; points label shows actual with arrow if >5.
  - Inputs/units: goals/assists/points per game counts; sources: —
  - Output scale: SVG pixels; fixed 0-5 point scale; writes: —
  - Status: live — CurrentPlayerCard production-by-game format (pages/player-cards.tsx)
  - Consumers: CurrentPlayerCard production format
- **Audit context:**
  - Intent (Opus): web/components/player-cards/ProductionGameChart.tsx:4 'Fixed 0-5 point scale across every window/player'
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/player-cards/CurrentPlayerCardStudio.test.tsx`
- **Leads (not audited):**
  - (opus) display-only clipping; included for completeness

## M-CARD-023 NST gamelog capture mapping to card records

- **Match:** Opus only; Opus CARD-020; Codex —
- **Purpose:** Join NST date-keyed gamelog rows to official appearances
- **Where:** `web/lib/player-cards/nstCapture.ts:37 (mapNstCapture)`
- **Tags (heuristic):** denominators: per game; generation: development, current
- **Opus view (CARD-020):**
  - Method: Key rows by player+season+date; reject dates with >1 official game; require gp===1 (or gp 0 with all-zero fields); copy nonnegative finite fields; capturedAt = min batch time.
  - Inputs/units: NST gamelog counts; toi declared seconds; date_scraped YYYY-MM-DD; sources: nst_gamelog_*_counts, nst_gamelog_*_counts_oi
  - Output scale: per-game component records; writes: —
  - Status: draft — called from cardEvidenceVerdict.observedCardEvidence; observed population admission pending
  - Consumers: aggregation.ts; cardEvidenceVerdict.observedCardEvidence
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in code beyond rejection reasons; tasks/diaries/2026-10-25-claude-c1-evidence-bundle.md (evidence bundle work)
  - External references: none suggested
  - Fixtures/test data: `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
  - Tests: `web/lib/player-cards/cardEvidenceVerdict.test.ts`; `web/lib/player-cards/nstCapture.test.ts`
- **Leads (not audited):**
  - (opus) join by scrape date (date_scraped) rather than game id

## M-CARD-024 Stats page leaderboards (BSH, goalie min-GP filter, top-5 sorts)

- **Match:** Opus only; Opus CARD-023; Codex —
- **Purpose:** Build season top-5 skater (points, goals, PPP, BSH, by position) and goalie (wins, SV%, GAA, QS%) leaderboards for /stats.
- **Where:** `web/lib/NHL/statsPageFetch.ts:120 (bsh)`; `web/lib/NHL/statsPageFetch.ts:52 (goalieRatio)`; `web/lib/NHL/statsPageFetch.ts:58 (buildSkaterLeaderboards)`; `web/lib/NHL/statsPageFetch.ts:212 (loadMinGamesThreshold)`; `web/lib/NHL/statsPageFetch.ts:338 (goalie leader sorts)`
- **Tags (heuristic):** denominators: per 60, per team game; generation: current
- **Opus view (CARD-023):**
  - Method: BSH = blocked_shots + shots + hits. Skater boards: sort desc, top 5 (positions L->LW, R->RW). Goalie min GP = floor(0.25 * average team GP from latest standings) only when average team GP > 10, else 0. goalieRatio keeps finite values >=0 and <=max (max 1 for save_pct and QS%), else null. SV% and QS% sorted desc, GAA asc, top 5, require games_played > 0.
  - Inputs/units: season totals (points, goals, pp_points, blocked_shots, shots, hits); goalie save_pct and quality_starts_pct as FRACTION 0-1, goals_against_avg per 60, games_played; team games_played; sources: wgo_skater_stats_totals, wgo_goalie_stats_totals, nhl_standings_details, players
  - Output scale: top-5 ranked lists; BSH integer total; min GP integer threshold; writes: —
  - Status: live — fetchStatsData used by web/pages/stats/index.tsx
  - Consumers: web/pages/stats/index.tsx
- **Audit context:**
  - Intent (Opus): web/lib/NHL/statsPageFetch.ts comments near :282 ('Filter the full season dataset before taking each position's top five'); goalie min-GP rule UNDOCUMENTED
  - External references: NHL.com goalie leader qualification (minimum games/minutes)
  - Fixtures/test data: `web/lib/NHL/statsPageFetch.test.ts (mocked Supabase rows)`
  - Tests: `web/lib/NHL/statsPageFetch.test.ts`
- **Leads (not audited):**
  - (opus) before average team GP exceeds 10 there is no goalie minimum, so a 1-GP goalie can lead SV%/GAA
  - (opus) save_pct must be a 0-1 fraction; a 0-100 source value is silently nulled
  - (opus) goalie games_played includes relief appearances; qualification is by GP, not minutes/shots as NHL uses

## M-CARD-025 Proposed NST average ice time

- **Match:** Codex only; Opus —; Codex roster-card-nst-atoi
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** sum(individual.toi seconds)/official GP/60.
- **Where:** `web/lib/player-cards/registry.ts:11 [inline calculation: Proposed NST average ice time]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** generation: current
- **Codex view (roster-card-nst-atoi, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST average ice time
  - Purpose: sum(individual.toi seconds)/official GP/60.
  - Inputs/units: Official matched appearance count and individual TOI seconds.
  - Output scale: Minutes per NHL appearance, nonnegative or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-atoi): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:11.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-atoi) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-026 Proposed NST on-ice attempts for per 60

- **Match:** Codex only; Opus —; Codex roster-card-nst-cf60
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 3600*sum(onIce.cf)/sum(onIce.toi seconds).
- **Where:** `web/lib/player-cards/registry.ts:16 [inline calculation: Proposed NST on-ice attempts for per 60]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (roster-card-nst-cf60, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST on-ice attempts for per 60
  - Purpose: 3600*sum(onIce.cf)/sum(onIce.toi seconds).
  - Inputs/units: On-ice team attempt counts and compatible on-ice TOI seconds.
  - Output scale: On-ice attempts for per60 minutes, nonnegative or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-cf60): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:16.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-cf60) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-027 Proposed NST individual attempts per 60

- **Match:** Codex only; Opus —; Codex roster-card-nst-icf60
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 3600*sum(individual.icf)/sum(individual.toi seconds).
- **Where:** `web/lib/player-cards/registry.ts:13 [inline calculation: Proposed NST individual attempts per 60]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (roster-card-nst-icf60, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST individual attempts per 60
  - Purpose: 3600*sum(individual.icf)/sum(individual.toi seconds).
  - Inputs/units: Individual shot-attempt counts and compatible individual TOI seconds.
  - Output scale: Attempts per60 minutes, nonnegative or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-icf60): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:13.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-icf60) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-028 Proposed NST individual points percentage

- **Match:** Codex only; Opus —; Codex roster-card-nst-ipp
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 100*sum(individual.total_points)/sum(onIce.gf).
- **Where:** `web/lib/player-cards/registry.ts:20 [inline calculation: Proposed NST individual points percentage]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** generation: current
- **Codex view (roster-card-nst-ipp, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST individual points percentage
  - Purpose: 100*sum(individual.total_points)/sum(onIce.gf).
  - Inputs/units: Individual point counts and compatible on-ice goals for.
  - Output scale: Percentage0..100 or unavailable; rejects numerator greater than denominator.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-ipp): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:20.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-ipp) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-029 Proposed NST individual scoring chances per 60

- **Match:** Codex only; Opus —; Codex roster-card-nst-iscf60
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 3600*sum(individual.iscfs)/sum(individual.toi seconds).
- **Where:** `web/lib/player-cards/registry.ts:14 [inline calculation: Proposed NST individual scoring chances per 60]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (roster-card-nst-iscf60, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST individual scoring chances per 60
  - Purpose: 3600*sum(individual.iscfs)/sum(individual.toi seconds).
  - Inputs/units: Individual scoring-chance counts and compatible individual TOI seconds.
  - Output scale: Scoring chances per60 minutes, nonnegative or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-iscf60): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:14.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-iscf60) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-030 Proposed NST on-ice shooting percentage

- **Match:** Codex only; Opus —; Codex roster-card-nst-oishpct
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 100*sum(onIce.gf)/sum(onIce.sf).
- **Where:** `web/lib/player-cards/registry.ts:22 [inline calculation: Proposed NST on-ice shooting percentage]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** generation: current
- **Codex view (roster-card-nst-oishpct, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST on-ice shooting percentage
  - Purpose: 100*sum(onIce.gf)/sum(onIce.sf).
  - Inputs/units: Compatible on-ice goal-for and shot-for counts.
  - Output scale: Percentage0..100 or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-oishpct): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:22.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-oishpct) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-031 Proposed NST on-ice chances for per 60

- **Match:** Codex only; Opus —; Codex roster-card-nst-scf60
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 3600*sum(onIce.scf)/sum(onIce.toi seconds).
- **Where:** `web/lib/player-cards/registry.ts:17 [inline calculation: Proposed NST on-ice chances for per 60]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (roster-card-nst-scf60, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST on-ice chances for per 60
  - Purpose: 3600*sum(onIce.scf)/sum(onIce.toi seconds).
  - Inputs/units: On-ice team scoring-chance counts and compatible on-ice TOI seconds.
  - Output scale: On-ice scoring chances for per60 minutes, nonnegative or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-scf60): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:17.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-scf60) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-032 Proposed NST individual shooting percentage

- **Match:** Codex only; Opus —; Codex roster-card-nst-shpct
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 100*sum(individual.goals)/sum(individual.shots).
- **Where:** `web/lib/player-cards/registry.ts:21 [inline calculation: Proposed NST individual shooting percentage]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** generation: current
- **Codex view (roster-card-nst-shpct, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST individual shooting percentage
  - Purpose: 100*sum(individual.goals)/sum(individual.shots).
  - Inputs/units: Individual goal and shot-on-goal counts.
  - Output scale: Percentage0..100 or unavailable; zero-shot denominator undefined.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-shpct): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:21.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-shpct) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-033 Proposed NST shots on goal per 60

- **Match:** Codex only; Opus —; Codex roster-card-nst-sog60
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 3600*sum(individual.shots)/sum(individual.toi seconds).
- **Where:** `web/lib/player-cards/registry.ts:12 [inline calculation: Proposed NST shots on goal per 60]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** denominators: per 60, shots on goal; generation: current
- **Codex view (roster-card-nst-sog60, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST shots on goal per 60
  - Purpose: 3600*sum(individual.shots)/sum(individual.toi seconds).
  - Inputs/units: Individual shots on goal counts and compatible individual TOI seconds.
  - Output scale: Shots per60 minutes, nonnegative or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-sog60): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:12.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-sog60) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-034 Proposed NST on-ice xGF per 60

- **Match:** Codex only; Opus —; Codex roster-card-nst-xgf60
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 3600*sum(onIce.xgf)/sum(onIce.toi seconds).
- **Where:** `web/lib/player-cards/registry.ts:18 [inline calculation: Proposed NST on-ice xGF per 60]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Codex view (roster-card-nst-xgf60, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST on-ice xGF per 60
  - Purpose: 3600*sum(onIce.xgf)/sum(onIce.toi seconds).
  - Inputs/units: Provider on-ice xGF and compatible on-ice TOI seconds.
  - Output scale: On-ice xGF per60 minutes, nonnegative or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-xgf60): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:18.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-xgf60) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-CARD-035 Proposed NST on-ice xG share

- **Match:** Codex only; Opus —; Codex roster-card-nst-xgpct
- **Possible related records (low-confidence location link, unconfirmed):** CARD-019
- **Purpose:** 100*sum(onIce.xgf)/(sum(onIce.xgf)+sum(onIce.xga)).
- **Where:** `web/lib/player-cards/registry.ts:19 [inline calculation: Proposed NST on-ice xG share]`; `web/lib/player-cards/aggregation.ts:42 pooledMetric`; `web/lib/player-cards/aggregation.ts:62 aggregateWindow`
- **Tags (heuristic):** generation: current
- **Codex view (roster-card-nst-xgpct, calculation; Codex family 'Player-card proposed NST metrics'):** Proposed NST on-ice xG share
  - Purpose: 100*sum(onIce.xgf)/(sum(onIce.xgf)+sum(onIce.xga)).
  - Inputs/units: Same-definition on-ice expected goals for and against.
  - Output scale: Percentage0..100 or unavailable.
  - Version/status: REGISTRY_VERSION=proposed-nst-v0, universe provider-definition-unverified and entitlement allocation-pending. This is a proposed arithmetic contract, not observed source/deployment admission. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserles…
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/InteractiveCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/EditorialPlayerCard.tsx:4", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/player-cards/PlayerCardFlow.tsx:5", "Static …
- **Audit context:**
  - Intended contract (Codex roster-card-nst-xgpct): Registry declares provider NST, seconds TOI, selected strength, regular season, complete matching game components. pooledMetric sums components across official appearances rather than averages rates, requires finite nonnegative values and compatible positive denominators; valid zeros are preserved, zero denominator is undefined, missing stays missing. Source: web/lib/player-cards/registry.ts:19.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/player-cards/aggregation.r1.test.ts", "web/lib/player-cards/domain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-card-nst-xgpct) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

