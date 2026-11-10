# Audit packet: Draft tools

Master entries M-DRF-001 to M-DRF-051 (51 of 51 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-DRF-001 | fn initialize_draft_ranking_from_yahoo / reorder_draft_ranking / repa… | Both | 0 | 4 |
| M-DRF-002 | fn mock_draft_adp (+ mock_draft_ingest snake validation) | Both | 0 | 5 |
| M-DRF-003 | Yahoo ownership and ADP movement | Both | 0 | 2 |
| M-DRF-004 | Mock draft ADP aggregation (mock_draft_adp RPC) | Both | 0 | 6 |
| M-DRF-005 | LeagueStandings team value, DraftSummaryModal steals/reaches/draft wi… | Both | 0 | 6 |
| M-DRF-006 | ProjectionsTable value/VBD percentile bands, off-night rank colours, … | Both | 0 | 2 |
| M-DRF-007 | Actual-stat unit normalization (TOI, SV%) + derived DEFENSE_POINTS / … | Both | 0 | 4 |
| M-DRF-008 | Yahoo ADP / percent drafted parsing | Both | 0 | 2 |
| M-DRF-009 | Projected fantasy points + per-game FP (projection processing) | Both | 0 | 3 |
| M-DRF-010 | Projection vs actual diff % and round summaries | Both | 0 | 4 |
| M-DRF-011 | Draft Pro DUST wrapper (schedule bench waste) | Both | 0 | 2 |
| M-DRF-012 | Community draft rankings: regularized Bradley-Terry with ADP prior | Both | 0 | 6 |
| M-DRF-013 | Draft Ranker discovery signals: projection consensus gap, ownership r… | Both | 0 | 6 |
| M-DRF-014 | Draft Ranker assisted placement: binary-search rank interval engine | Both | 0 | 2 |
| M-DRF-015 | Draft Ranker pair queue selection | Both | 0 | 1 |
| M-DRF-016 | applyCategoryBoosts: Draft Pro valuation-only scoring boosts | Both | 0 | 1 |
| M-DRF-017 | aggregateTeamCategoryTotals / rankTeamCategories / categoryRankBand | Both | 0 | 8 |
| M-DRF-018 | Draft pick arithmetic: snake/custom order, keeper/traded pick numbers… | Both | 0 | 3 |
| M-DRF-019 | buildPositionTiers / advisePosition: 1-D k-means positional tiers + t… | Both | 0 | 4 |
| M-DRF-020 | calculateScheduleMetrics: team games, off-nights, back-to-backs for d… | Both | 0 | 2 |
| M-DRF-021 | calculateSourceAccuracy: projection source accuracy (mean normalized … | Both | 0 | 3 |
| M-DRF-022 | rankProjectionPlayers / calculateSourceRankImpacts | Both | 0 | 2 |
| M-DRF-023 | calculateWeightedProjection / source shares: multi-source projection … | Both | 0 | 4 |
| M-DRF-024 | Mock draft bot pick model (decide): utility score + softmax sampling | Both | 0 | 6 |
| M-DRF-025 | DraftDashboard roster needs: posNeeds, catNeeds, teamVorp, team proje… | Both | 0 | 5 |
| M-DRF-026 | usePlayerRecommendations / buildRecommendationCandidates: recommendat… | Both | 0 | 3 |
| M-DRF-027 | useVORPCalculations: VORP / VOLS / VONA / VBD per player | Both | 0 | 12 |
| M-DRF-028 | buildPersonalizedRecommendations (Draft Pro): need-weighted recommend… | Both | 0 | 6 |
| M-DRF-029 | Scenario / report adapters: globalVorp and roster category totals (Dr… | Both | 0 | 5 |
| M-DRF-030 | estimatePlayerAvailability: ADP normal-survival availability probabil… | Both | 0 | 4 |
| M-DRF-031 | buildPlayerValues: comparable draft value (points or category z-sum) … | Both | 0 | 4 |
| M-DRF-032 | computeProratedFantasyPoints / getProratedStat: 84-game skater pace | Both | 0 | 5 |
| M-DRF-033 | calculateCategoryScores: weighted category z-score composite with goa… | Both | 0 | 7 |
| M-DRF-034 | Mock draft roster feasibility (Dinic max-flow) | Both | 0 | 2 |
| M-DRF-035 | Projection source weight slider rebalancing | Opus only | 0 | 2 |
| M-DRF-036 | Projection source-weight sanitization and legacy percent-weight migra… | Opus only | 0 | 4 |
| M-DRF-037 | Social share rostered-% movers (Yahoo ownership pp change) | Opus only | 0 | 2 |
| M-DRF-038 | Legacy projections page: projection-vs-actual diff% colour bands, ADP… | Opus only | 0 | 3 |
| M-DRF-039 | ComparePlayersModal percentiles and per-game rates | Opus only | 0 | 2 |
| M-DRF-040 | CSV import name fuzzy match (Levenshtein similarity) | Opus only | 0 | 0 |
| M-DRF-041 | freezePlayers (mock draft adapter): per-category values, goalie workl… | Opus only | 0 | 1 |
| M-DRF-042 | SuggestedPicks free-path risk boost and sort keys | Opus only | 0 | 1 |
| M-DRF-043 | Goalie sample standard deviation | Codex only | 0 | 1 |
| M-DRF-044 | Community evidence bands and public top-250 admission | Codex only | 0 | 1 |
| M-DRF-045 | Sparse-order integrity counts and health status | Codex only | 0 | 1 |
| M-DRF-046 | Grouped roster assignment and forward-capacity redistribution | Codex only | 0 | 1 |
| M-DRF-047 | Draft player search similarity | Codex only | 0 | 1 |
| M-DRF-048 | Assigned-roster fill, vacancy and pick-window progress | Codex only | 0 | 1 |
| M-DRF-049 | Mock personality and research adjustments | Codex only | 0 | 1 |
| M-DRF-050 | Mock lookahead and stochastic choice | Codex only | 0 | 1 |
| M-DRF-051 | Player comparison radar percentile and mean | Codex only | 0 | 1 |

## M-DRF-001 fn initialize_draft_ranking_from_yahoo / reorder_draft_ranking / repair_draft_ranking_ordering

- **Match:** Both; Opus DRF-001; Codex roster-draft-sql-seed, roster-draft-sql-sparse-order
- **Purpose:** Seed a user's draft ranking from prior Yahoo ADP and maintain sparse order keys
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:1548 (initialize_draft_ranking_from_yahoo)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:3101 (reorder_draft_ranking)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:3509 (repair_draft_ranking_ordering)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:1548 [inline calculation: Yahoo-seeded personal rank and sparse order key]`; `supabase/migrations/20260716112908_production_schema_baseline.sql:1792 [inline calculation: Yahoo-seeded personal rank and sparse order key]`; `supabase/migrations/20260716112908_production_schema_baseline.sql:1805 [inline calculation: Yahoo-seeded personal rank and sparse order key]`; `supabase/migrations/20260716112908_production_schema_baseline.sql:3101 [inline calculation: Sparse order-key insertion and normalization]`; `supabase/migrations/20260716112908_production_schema_baseline.sql:3322 [inline calculation: Sparse order-key insertion and normalization]`; `supabase/migrations/20260716112908_production_schema_baseline.sql:3509 [inline calculation: Sparse order-key insertion and normalization]`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-001):**
  - Method: Seed value = preseason_adp if >0 else average pick fallback; per player keep best source (preseason ADP preferred, then lowest value); seed_rank = row_number over (preseason first, seed_value asc); order_key = seed_rank*1048576. Requires >=250 verified players. Reorder: midpoint key prev + floor((next-prev)/2), +/-1048576 at ends, renumber position*1048576 when midpoint exhausted.
  - Inputs/units: Yahoo ADP pick numbers; sources: yahoo players snapshot tables, draft_ranking_entries
  - Output scale: rank 1..N; order_key multiples of 1048576; writes: draft_rankings, draft_ranking_entries, draft_ranking_seed_runs
  - Status: live — web/lib/draft-ranker/server.ts and healthServer.ts call these RPCs
  - Consumers: web/lib/draft-ranker/server.ts; web/lib/draft-ranker/healthServer.ts
- **Codex view (roster-draft-sql-seed, calculation, location; Codex family 'Draft ranking operations'):** Yahoo-seeded personal rank and sparse order key
  - Purpose: Initial seed uses preferred pre-season Yahoo ADP when available, otherwise average ADP, resolves eligible unique canonical players, assigns row_number rank, and spaces order keys by1,048,576.
  - Inputs/units: Yahoo draft analysis ranks/ADP, preseason preference, verified/canonical identity and owner context.
  - Output scale: Ordinal seeded rank and bigint sparse order key=rank*1048576.
  - Version/status: Checked-in production-schema baseline migration dated 2026-07-16; execution/deployment not inspected. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or dep…
- **Codex view (roster-draft-sql-sparse-order, calculation, location; Codex family 'Draft ranking operations'):** Sparse order-key insertion and normalization
  - Purpose: Chooses inserted key before/after boundary by stride1,048,576 or interior prev+floor((next-prev)/2); normalizes whole order to rank*stride when key spacing/limits require, with bigint safety handling.
  - Inputs/units: Predecessor/successor bigint order keys and current ordinal order.
  - Output scale: Bigint storage key or normalized sequence preserving requested order.
  - Version/status: Checked-in SQL baseline only; not executed. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in SQL (archive migrations under supabase/migration-archive/pre-baseline-20260716/ hold the originals)
  - Intended contract (Codex roster-draft-sql-seed): initialize_draft_ranking_from_yahoo SQL body in schema baseline; migration presence is not proof installed. Source: supabase/migrations/20260716112908_production_schema_baseline.sql:1548.
  - Intended contract (Codex roster-draft-sql-sparse-order): reorder_draft_ranking and repair routines in baseline; this is order storage math, not draft value. Source: supabase/migrations/20260716112908_production_schema_baseline.sql:3101.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/draft-ranker/server.test.ts`; `web/lib/supabase/fhfhDraftRankerPlacementMigration.test.ts`; `web/lib/supabase/fhfhDraftRankerReorderMigration.test.ts`; `web/lib/supabase/fhfhDraftRankerRepairMigration.test.ts`; `web/lib/supabase/fhfhDraftRankerYahooSeedMigration.test.ts`; `{"discovered_not_run": [], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) defaults hard-code target season 20262027 and source Yahoo season 2025
  - (opus) preseason ADP and in-season average pick are mixed on one ordinal scale
  - (codex:roster-draft-sql-seed) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-draft-sql-sparse-order) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-002 fn mock_draft_adp (+ mock_draft_ingest snake validation)

- **Match:** Both; Opus DRF-002; Codex roster-mock-adp-mean, roster-mock-adp-quantiles, sql-mock-adp-crossref
- **Purpose:** Community mock-draft ADP with user-deduplicated mean and weighted pick quantiles
- **Where:** `supabase/migrations/20260917133519_mock_draft_adp.sql:113 (mock_draft_adp)`; `supabase/migrations/20260917133519_mock_draft_adp.sql:59 (mock_draft_ingest)`; `supabase/migrations/20260917133519_mock_draft_adp.sql:113 [inline calculation: Equal-user-weighted human mock-draft ADP]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:122 [inline calculation: Equal-user-weighted human mock-draft ADP]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:125 [inline calculation: Equal-user-weighted human mock-draft ADP]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:121 [inline calculation: Equal-user-weighted mock-pick quartiles]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:128 [inline calculation: Equal-user-weighted mock-pick quartiles]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:132 [inline calculation: Equal-user-weighted mock-pick quartiles]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:113 mock_draft_adp`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-002):**
  - Method: Eligible = human picks by the session's user seat, contributes, last 30 days, season/cohort/tier filter. adp = mean over users of each user's mean pick; weight per pick = 1/count(picks of that player by that user); weighted CDF over pick -> low/median/high = first pick with cumulative fraction >= 0.25/0.5/0.75. ADP and quantiles shown only when contributors >= 5. Ingest: snake seat = (pick-1)%n, reversed on odd rounds; total picks = teamCount * sum(roster slots).
  - Inputs/units: overall pick number; sources: mock_draft_events, mock_draft_sessions, fhfh_player_identities
  - Output scale: pick number (ADP); writes: —
  - Status: live — web/lib/mockDraft/api.ts calls it
  - Consumers: web/lib/mockDraft/api.ts
- **Codex view (roster-mock-adp-mean, calculation, location; Codex family 'Mock draft aggregate observations'):** Equal-user-weighted human mock-draft ADP
  - Purpose: Filters consenting contributing human choices from own seat, nonwithdrawn sessions, same season/cohort, optional tier/completed filter, observed in last30days. First averages each player-user picks, then averages user means so repeated users have equal weight. Numeric ADP withheld below5 contributors.
  - Inputs/units: Human observed overall pick numbers, user/session identity, timestamps, draft cohort/season/tier.
  - Output scale: ADP in overall-pick units, independent contributor count, selection count and last observed timestamp; ADP null with<5 users.
  - Version/status: Checked-in migration 20260917133519; execution/deployed aggregation not checked. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claim…
- **Codex view (roster-mock-adp-quantiles, calculation, location; Codex family 'Mock draft aggregate observations'):** Equal-user-weighted mock-pick quartiles
  - Purpose: Each selection gets weight1/(number selections for that player-user); pool by pick, compute cumulative fraction and choose first pick crossing .25/.5/.75. Quartiles withheld with<5 contributors under same filters as ADP.
  - Inputs/units: Eligible human pick values and per-player/user repetition counts.
  - Output scale: Low25th, median50th and high75th pick ordinal values or null.
  - Version/status: Checked-in mock ADP migration, not executed. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (sql-mock-adp-crossref, calculation, location; Codex family 'Draft SQL cross-reference'):** mock_draft_adp ADP / weighted quantiles
  - Purpose: Aggregate human mock-draft picks with equal user weight.
  - Inputs/units: Eligible own-seat human contributing picks within30days; cohort/tier/season/completed filters; pick positions and user IDs
  - Output scale: ADP=mean per-user mean pick; per-event weight1/user-player event count; weighted CDF25/50/75 quantiles; outputs only with contributors≥5; selections/contributors/lastObserved counts.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): supabase/migrations/20260917133519_mock_draft_adp.sql:1 'Raw mock history is private; only the server may ingest or aggregate it.'
  - Intended contract (Codex roster-mock-adp-mean): SQL mock_draft_adp CTEs and table constraints; bot/timeout choices do not contribute. Source: supabase/migrations/20260917133519_mock_draft_adp.sql:113.
  - Intended contract (Codex roster-mock-adp-quantiles): Weighted distribution/quantiles CTEs in mock_draft_adp; discrete first-crossing convention. Source: supabase/migrations/20260917133519_mock_draft_adp.sql:121.
  - Intended contract (Codex sql-mock-adp-crossref): SQL eligible, weighted, users, means, cumulative and quantiles CTEs define contract.
  - External references: FantasyPros/Yahoo ADP (mean pick); quantile ADP ranges
  - Fixtures/test data: `supabase/tests/mock_draft_adp.sql`
  - Tests: `supabase/tests/mock_draft_adp.sql`; `web/lib/mockDraft/api.test.ts`; `{"discovered_not_run": ["supabase/tests/mock_draft_adp.sql"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) raw overall pick numbers are pooled across league sizes only within a cohort; no normalization by team count
  - (opus) now()-30 days window makes results time-dependent
  - (codex:roster-mock-adp-mean) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-mock-adp-quantiles) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:sql-mock-adp-crossref) Applied/deployed state and current consumer execution unknown; not tested or audited.

## M-DRF-003 Yahoo ownership and ADP movement

- **Match:** Both; Opus DRF-006; Codex MISC-OWNERSHIP
- **Purpose:** Rank risers/fallers by change in Yahoo ownership % or ADP over a window.
- **Where:** `web/pages/api/v1/transactions/ownership-trends.ts:154 (calculateTrendMovement)`; `web/pages/api/v1/transactions/ownership-trends.ts:395 (window lookup in handler)`; `web/pages/api/v1/transactions/ownership-trends.ts:154 calculateTrendMovement`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (DRF-006):**
  - Method: previous = value on latest-date minus windowDays, else latest point at or before it. Ownership: delta = latest - previous, deltaPct = delta (percentage points). ADP: delta = previous - latest (lower ADP = rising), deltaPct = delta/previous*100, ADP <= 0 rejected. Sort by deltaPct for ADP, delta otherwise; sparkline last max(12, window+2) points.
  - Inputs/units: ownership percent 0-100; ADP pick number; sources: yahoo_players_with_normalized_history, yahoo_player_draft_analysis_history, yahoo_nhl_player_map_read
  - Output scale: percentage points or relative percent; writes: —
  - Status: live — TransactionTrends and FORGE TopAddsRail; route ledger calls=10
  - Consumers: web/components/TransactionTrends/TransactionTrends.tsx; web/components/forge-dashboard/TopAddsRail.tsx; web/pages/FORGE.tsx
- **Codex view (MISC-OWNERSHIP, calculation, location; Codex family 'Other product calculations'):** Ownership and ADP trend movement
  - Purpose: Convert adjacent source snapshots into direction-aware movement.
  - Inputs/units: Latest/previous ownership percent or positive ADP draft position.
  - Output scale: Ownership delta percentage points; ADP previous−latest and relative percent versus previous; 2-decimal rounding.
  - Version/status: Local API helper. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex MISC-OWNERSHIP): ADP improvement reverses sign; ownership deltaPct equals raw percentage-point delta.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No adjacent test located; broader suites not exhaustively traced.`; `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts`
- **Leads (not audited):**
  - (opus) deltaPct means percentage points for ownership but relative percent for ADP, same field name with two meanings
  - (codex:MISC-OWNERSHIP) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-DRF-004 Mock draft ADP aggregation (mock_draft_adp RPC)

- **Match:** Both; Opus DRF-008; Codex roster-mock-adp-mean, roster-mock-adp-quantiles, sql-mock-adp-crossref
- **Purpose:** Community mock-draft ADP with quantiles from human picks.
- **Where:** `supabase/migrations/20260917133519_mock_draft_adp.sql:113-151 (public.mock_draft_adp)`; `web/lib/mockDraft/api.ts:71-74, 129 (cohort = stableJson(league))`; `supabase/migrations/20260917133519_mock_draft_adp.sql:113 [inline calculation: Equal-user-weighted human mock-draft ADP]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:122 [inline calculation: Equal-user-weighted human mock-draft ADP]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:125 [inline calculation: Equal-user-weighted human mock-draft ADP]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:121 [inline calculation: Equal-user-weighted mock-pick quartiles]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:128 [inline calculation: Equal-user-weighted mock-pick quartiles]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:132 [inline calculation: Equal-user-weighted mock-pick quartiles]`; `supabase/migrations/20260917133519_mock_draft_adp.sql:113 mock_draft_adp`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-008):**
  - Method: Per player: per-user mean pick, then ADP = mean of user means (each user equal weight); contributors = distinct users. Quantiles low/median/high = smallest pick whose cumulative user-weighted share (weight 1/n_user_picks_of_player) reaches 0.25/0.5/0.75. ADP and quantiles NULL unless contributors >= 5. 30-day rolling window; cohort = canonical JSON of league settings (teamCount, roster, scoring); sorted by ADP nulls last; 50/page.
  - Inputs/units: overall pick number; sources: mock_draft_events, mock_draft_sessions, fhfh_player_identities
  - Output scale: ADP pick number; quantile picks; writes: —
  - Status: live — mock drafts
  - Consumers: components/DraftDashboard/MockAdpBoard.tsx; /api/v1/mock-draft adp route
- **Codex view (roster-mock-adp-mean, calculation, location; Codex family 'Mock draft aggregate observations'):** Equal-user-weighted human mock-draft ADP
  - Purpose: Filters consenting contributing human choices from own seat, nonwithdrawn sessions, same season/cohort, optional tier/completed filter, observed in last30days. First averages each player-user picks, then averages user means so repeated users have equal weight. Numeric ADP withheld below5 contributors.
  - Inputs/units: Human observed overall pick numbers, user/session identity, timestamps, draft cohort/season/tier.
  - Output scale: ADP in overall-pick units, independent contributor count, selection count and last observed timestamp; ADP null with<5 users.
  - Version/status: Checked-in migration 20260917133519; execution/deployed aggregation not checked. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claim…
- **Codex view (roster-mock-adp-quantiles, calculation, location; Codex family 'Mock draft aggregate observations'):** Equal-user-weighted mock-pick quartiles
  - Purpose: Each selection gets weight1/(number selections for that player-user); pool by pick, compute cumulative fraction and choose first pick crossing .25/.5/.75. Quartiles withheld with<5 contributors under same filters as ADP.
  - Inputs/units: Eligible human pick values and per-player/user repetition counts.
  - Output scale: Low25th, median50th and high75th pick ordinal values or null.
  - Version/status: Checked-in mock ADP migration, not executed. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (sql-mock-adp-crossref, calculation, location; Codex family 'Draft SQL cross-reference'):** mock_draft_adp ADP / weighted quantiles
  - Purpose: Aggregate human mock-draft picks with equal user weight.
  - Inputs/units: Eligible own-seat human contributing picks within30days; cohort/tier/season/completed filters; pick positions and user IDs
  - Output scale: ADP=mean per-user mean pick; per-event weight1/user-player event count; weighted CDF25/50/75 quantiles; outputs only with contributors≥5; selections/contributors/lastObserved counts.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (migration has no comments)
  - Intended contract (Codex roster-mock-adp-mean): SQL mock_draft_adp CTEs and table constraints; bot/timeout choices do not contribute. Source: supabase/migrations/20260917133519_mock_draft_adp.sql:113.
  - Intended contract (Codex roster-mock-adp-quantiles): Weighted distribution/quantiles CTEs in mock_draft_adp; discrete first-crossing convention. Source: supabase/migrations/20260917133519_mock_draft_adp.sql:121.
  - Intended contract (Codex sql-mock-adp-crossref): SQL eligible, weighted, users, means, cumulative and quantiles CTEs define contract.
  - External references: ADP conventions (FantasyPros/Yahoo: mean pick among drafts where selected; some providers assign undrafted players a penalty pick)
  - Fixtures/test data: none listed
  - Tests: `web/lib/mockDraft/api.test.ts`; `{"discovered_not_run": ["supabase/tests/mock_draft_adp.sql"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) only drafts where the player WAS picked by the human count - undrafted outcomes ignored (selection bias toward earlier ADP for fringe players)
  - (opus) picks not normalized for teamCount differences only because cohort JSON must match exactly; small cohorts fragment data
  - (opus) quantile uses step function (min pick reaching cumulative fraction), no interpolation
  - (codex:roster-mock-adp-mean) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-mock-adp-quantiles) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:sql-mock-adp-crossref) Applied/deployed state and current consumer execution unknown; not tested or audited.

## M-DRF-005 LeagueStandings team value, DraftSummaryModal steals/reaches/draft winner, DraftBoard heat

- **Match:** Both; Opus DRF-011; Codex roster-draft-steal-reach, roster-draft-winner, roster-team-value-standing
- **Purpose:** Post-draft team scoring summaries and visual intensity.
- **Where:** `web/components/DraftDashboard/LeagueStandings.tsx:58 (values)`; `web/components/DraftDashboard/DraftSummaryModal.tsx:176-250 (biggest steal/reach/topVorp)`; `web/components/DraftDashboard/DraftSummaryModal.tsx:260 (draftWinner)`; `web/components/DraftDashboard/DraftBoard.tsx:388-412 (heat map intensity)`; `web/lib/draftDashboard/roundRankHistory.ts:13 (buildRoundRankHistory)`; `web/components/DraftDashboard/DraftSummaryModal.tsx:196 [inline calculation: Biggest draft steal/reach and top VORP pick]`; `web/components/DraftDashboard/DraftSummaryModal.tsx:260 [inline calculation: Draft winner composite]`; `web/components/DraftDashboard/LeagueStandings.tsx:58 [inline calculation: Team value standing and round movement]`; `web/lib/draftDashboard/roundRankHistory.ts:13 buildRoundRankHistory`; `web/lib/draftDashboard/roundRankHistory.ts:67 roundRankMovement`
- **Tags (heuristic):** generation: current
- **Opus view (DRF-011):**
  - Method: Standings value: points -> team projected FP; categories -> MEAN of player category z-sum values (roundRankHistory uses same mean for categories, sum for points). Steal/reach delta = pickNumber - ADP (max = steal, min = reach), keepers excluded. Draft winner = argmax 0.6*minmax(projectedPoints) + 0.4*minmax(teamVorp) (0.5 when all equal). Heat level = FP/maxFP in pool: <=0.2 ->1, <=0.4 ->2, <=0.7 ->3, else 4. Round rank = 1 + count of teams with value > team value + 1e-9; null if any player value missing.
  - Inputs/units: fantasy points, z units, pick numbers; sources: in-memory
  - Output scale: min-max 0..1 score; rank 1..N; heat 0-4; writes: —
  - Status: live
  - Consumers: Draft Dashboard UI; RoundRankChart
- **Codex view (roster-draft-steal-reach, calculation, location; Codex family 'draft-summary'):** Biggest draft steal/reach and top VORP pick
  - Purpose: Nonkeeper pick delta=actual overall pick−ADP; maximum is steal, minimum reach; separately choose largest player VORP.
  - Inputs/units: Actual pick integer, Yahoo ADP or fallback ADP, player VORP.
  - Output scale: Signed pick delta, chosen pick/player.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-draft-winner, calculation, location; Codex family 'draft-summary'):** Draft winner composite
  - Purpose: Min-max normalize team projected FP and VORP (constant pool→.5), blend .6 normalized FP+.4 normalized VORP, choose maximum.
  - Inputs/units: Projected team FP and sum VORP across teams.
  - Output scale: Dimensionless0–1 score and selected winner.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-team-value-standing, calculation, location; Codex family 'draft-summary'):** Team value standing and round movement
  - Purpose: Points mode uses roster FP sum; category mode uses average available player comparable z-score. Round replay ranks team values with ties and reports beforeRank−afterRank.
  - Inputs/units: Team roster values, league mode, draft picks/keepers/trades and capacity.
  - Output scale: Team value, rank and signed round movement.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/draftDashboard/roundRankHistory.ts:12 'Reconstruct completed rounds from current picks, so undo/corrections cannot leave stale history.'
  - Intended contract (Codex roster-draft-steal-reach): Market timing comparison; not future realized performance. Source: web/components/DraftDashboard/DraftSummaryModal.tsx:196.
  - Intended contract (Codex roster-draft-winner): UI heuristic; not a probabilistic championship projection. Source: web/components/DraftDashboard/DraftSummaryModal.tsx:260.
  - Intended contract (Codex roster-team-value-standing): Not category win projection; category mode averages player scores rather than summing category standings points. Source: web/components/DraftDashboard/LeagueStandings.tsx:58.
  - External references: ADP value-vs-pick conventions
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/DraftSummaryModal.test.tsx`; `web/__tests__/components/DraftDashboard/LeagueStandings.test.tsx`; `web/lib/draftDashboard/roundRankHistory.test.ts`; `{"discovered_not_run": ["web/__tests__/components/DraftDashboard/DraftSummaryModal.test.tsx", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/draftDashboard/roundRankHistory.test.ts", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/LeagueStandings.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) draft winner uses projectedPoints even in categories leagues (FP may be meaningless there)
  - (opus) categories standing value averages per-player z, penalizing deeper rosters' bench players equally with starters
  - (opus) 0.6/0.4 weights magic
  - (codex:roster-draft-steal-reach) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-draft-winner) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-team-value-standing) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-006 ProjectionsTable value/VBD percentile bands, off-night rank colours, expected run forecast

- **Match:** Both; Opus DRF-012; Codex roster-projection-display-percentiles
- **Purpose:** Colour bands for remaining pool values and off-night schedule ranks.
- **Where:** `web/components/DraftDashboard/ProjectionsTable.tsx:924 (percentileBands)`; `web/components/DraftDashboard/ProjectionsTable.tsx:1007 (offNightRankById)`; `web/components/DraftDashboard/ProjectionsTable.tsx:1436-1450 (expected run forecast)`; `web/components/DraftDashboard/ProjectionsTable.tsx:955 [inline calculation: Value/VBD color percentiles and off-night quartiles]`; `web/components/DraftDashboard/ProjectionsTable.tsx:1007 [inline calculation: Value/VBD color percentiles and off-night quartiles]`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (DRF-012):**
  - Method: Within scope (overall or best position) over undrafted players: pct = index of last value <= x /(n-1); >=0.7 success, >=0.3 warning, else danger (null if n<2). Off-night rank percentile with ties at mid-rank ((start+end)/2)/(n-1), quartile = floor(p*4)+1. Run forecast = expectedTaken_p rounded to 0.1 over N.
  - Inputs/units: value units; games; sources: in-memory
  - Output scale: percentile 0-1 -> 3 bands; quartile 1-4; writes: —
  - Status: live
  - Consumers: ProjectionsTable UI
- **Codex view (roster-projection-display-percentiles, calculation, location; Codex family 'draft-display'):** Value/VBD color percentiles and off-night quartiles
  - Purpose: Value/VBD uses last ascending index≤value divided by n−1, bands <.3/.3–.7/≥.7; off-nights descending tie-midrank normalized to0..1, quartile=floor(4p)+1 capped4.
  - Inputs/units: Filtered undrafted value pools by selected positional scope; off-night counts.
  - Output scale: Relative percentile fraction and UI color/quartile.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/components/DraftDashboard/ProjectionsTable.tsx:946 'Map deciles to 3 colors: bottom 0-30%=danger, 30-70%=warning, 70-100%=success'
  - Intended contract (Codex roster-projection-display-percentiles): Distinct tie conventions from card rankMetric and comparison radar. Source: web/components/DraftDashboard/ProjectionsTable.tsx:955.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/ProjectionsTable.test.tsx`; `{"discovered_not_run": ["web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx", "web/__tests__/components/DraftDashboard/ProjectionsTable.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) bands recomputed on the filtered/sorted view, so changing filters changes a player's band
  - (codex:roster-projection-display-percentiles) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-007 Actual-stat unit normalization (TOI, SV%) + derived DEFENSE_POINTS / SH_ASSISTS

- **Match:** Both; Opus DRF-013; Codex roster-projection-derived-dpoints, roster-projection-derived-sh-assists
- **Purpose:** Normalize actual stats to projection units and derive missing stats.
- **Where:** `web/hooks/useProcessedProjectionsData.tsx:1155-1195 (TOI and SV% parsing)`; `web/hooks/useProcessedProjectionsData.tsx:1283-1316 (DEFENSE_POINTS)`; `web/hooks/useProcessedProjectionsData.tsx:1318-1360 (SH_ASSISTS)`; `web/lib/draftDashboard/derivedProjectionStats.ts:1 (deriveShortHandedAssists)`; `web/hooks/useProcessedProjectionsData.tsx:1279 [inline calculation: Defense points derived total]`; `web/lib/draftDashboard/derivedProjectionStats.ts:1 deriveShortHandedAssists`; `web/hooks/useProcessedProjectionsData.tsx:1323 [inline calculation: Derived short-handed assists]`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: current
- **Opus view (DRF-013):**
  - Method: TIME_ON_ICE_PER_GAME: 'mm:ss' string -> minutes*60+seconds (SECONDS); number -> raw/60 (MINUTES if raw was seconds); other -> Number/60. SAVE_PERCENTAGE: number in (1,100] -> /100; '%' strings /100. DEFENSE_POINTS (D only) = G+A. SH_ASSISTS = max(0, SHP - SHG) unless a source supplies SHA directly.
  - Inputs/units: TOI seconds or 'mm:ss'; SV% 0-1 or 0-100; sources: current-season wgo/actual stats tables via ACTUAL_STATS_COLUMN_MAP
  - Output scale: TOI per game (seconds OR minutes - inconsistent); SV% fraction; writes: —
  - Status: live
  - Consumers: diff% columns; FP calc
- **Codex view (roster-projection-derived-dpoints, calculation, location; Codex family 'draft-projections'):** Defense points derived total
  - Purpose: For D-eligible display position, goals+assists in actual and projected rows; sum treats single missing component as0 but both missing as null.
  - Inputs/units: Goals/assists count totals and defenseman eligibility.
  - Output scale: Defense points count or null.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-projection-derived-sh-assists, calculation, location; Codex family 'draft-projections'):** Derived short-handed assists
  - Purpose: When both short-handed points and goals are finite, max(0,SHP−SHG); preserve explicit assists where caller uses them.
  - Inputs/units: Short-handed goals and points counts.
  - Output scale: Short-handed assists count or null.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/hooks/useProcessedProjectionsData.tsx:1324-1326 'Keep explicitly supplied provider SHA, including zero. Only custom sources without a direct SHA mapping retain the legacy derivation.'
  - Intended contract (Codex roster-projection-derived-dpoints): Derived scoring category, not on-ice impact or expected-goals model. Source: web/hooks/useProcessedProjectionsData.tsx:1279.
  - Intended contract (Codex roster-projection-derived-sh-assists): Bounded arithmetic derivation; tests are discovered, not run. Source: web/lib/draftDashboard/derivedProjectionStats.ts:1 deriveShortHandedAssists.
  - External references: NHL TOI conventions (mm:ss per game)
  - Fixtures/test data: none listed
  - Tests: `web/hooks/useProcessedProjectionsData.test.tsx`; `web/lib/draftDashboard/derivedProjectionStats.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/derivedProjectionStats.test.ts", "web/lib/draftDashboard/fantraxDisplay.test.ts", "web/lib/draftDashboard/projectionVisibility.test.ts", "web/lib/draftDashboard/espnLiveDraft.test.ts", "web/lib/draftDashboard/yahooLiveDraft.workflow.test.ts", "web/lib/draftDashboard/yahooLiveDraft.test.ts", "web/lib/draft-pro/reportDashboardAdapter.test.ts", "web/lib/draft-pro/scenarioDashboardAdapter.test.ts", "web/lib/integrations/yahoo/writerPermissions.test.ts", "web/hooks/useProcessedProjectionsData.test.tsx", "web/hooks/useRosterScheduleOptimizer.test.tsx", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/draftDashboard/fantraxDisplay.test.ts", "web/lib/draftDashboard/projectionVisibility.test.ts", "web/lib/draftDashboard/espnLiveDraft.test.ts", "web/lib/draftDashboard/yahooLiveDraft.workflow.test.ts", "web/lib/draftDashboard/yahooLiveDraft.test.ts", "web/lib/draft-pro/reportDashboardAdapter.test.ts", "web/lib/draft-pro/scenarioDashboardAdapter.test.ts", "web/lib/integrations/yahoo/writerPermissions.test.ts", "web/hooks/useProcessedProjectionsData.test.tsx", "web/hooks/useRosterScheduleOptimizer.test.tsx", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) TOI string branch yields SECONDS while numeric branch yields MINUTES - unit mismatch depending on source column type
  - (opus) SV% value exactly 1.0 is ambiguous (100% vs 1%) - kept as fraction
  - (codex:roster-projection-derived-dpoints) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-projection-derived-sh-assists) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-008 Yahoo ADP / percent drafted parsing

- **Match:** Both; Opus DRF-014; Codex roster-fantasy-points
- **Purpose:** Read market ADP used by VONA, availability, tiers, steals/reaches.
- **Where:** `web/hooks/useProcessedProjectionsData.tsx:1366-1395`; `web/lib/draftDashboard/fantasyPointRecalculation.ts:26 recalculateFantasyPoints`; `web/lib/draftDashboard/fantasyPointRecalculation.ts:3 pointValueForPlayerStat`; `web/hooks/useProcessedProjectionsData.tsx:1395 [inline calculation: Projected/actual fantasy points, per-game points and difference]`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (DRF-014):**
  - Method: parseFloat; '-' or null -> null; pctDrafted fraction *100.
  - Inputs/units: overall pick number; fraction 0-1; sources: yahoo_players
  - Output scale: pick number; percent 0-100; writes: —
  - Status: live
  - Consumers: useVORPCalculations (VONA); availability estimate; positional tiers; DraftSummaryModal steals/reaches; mock draft bots (market)
- **Codex view (roster-fantasy-points, calculation, location; Codex family 'draft-scoring'):** Projected/actual fantasy points, per-game points and difference
  - Purpose: Sum each stat×league points weight; use defense-specific HITS_D/BLOCKED_SHOTS_D override where applicable; divide point totals by projected/actual GP; calculate relative differences.
  - Inputs/units: Native count/rate stats and points-per-stat maps; GP counts; player position.
  - Output scale: Fantasy points, FP/game and percent difference; null where no usable data.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex roster-fantasy-points): Pure recalculation and raw-data-processing implementations coexist; no claim they have identical missing-input behavior. Source: web/lib/draftDashboard/fantasyPointRecalculation.ts:26 recalculateFantasyPoints.
  - External references: Yahoo ADP definition (mean pick among drafts where player was selected)
  - Fixtures/test data: none listed
  - Tests: `web/hooks/useProcessedProjectionsData.test.tsx`; `{"discovered_not_run": ["web/lib/draftDashboard/fantraxDisplay.test.ts", "web/lib/draftDashboard/projectionVisibility.test.ts", "web/lib/draftDashboard/fantasyPointRecalculation.test.ts", "web/lib/draftDashboard/espnLiveDraft.test.ts", "web/lib/draftDashboard/yahooLiveDraft.workflow.test.ts", "web/lib/draftDashboard/yahooLiveDraft.test.ts", "web/lib/draft-pro/reportDashboardAdapter.test.ts", "web/lib/draft-pro/scenarioDashboardAdapter.test.ts", "web/lib/integrations/yahoo/writerPermissions.test.ts", "web/hooks/useProcessedProjectionsData.test.tsx", "web/hooks/useRosterScheduleOptimizer.test.tsx", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) Yahoo ADP excludes drafts where the player was undrafted; late players' ADP biased early
  - (codex:roster-fantasy-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-009 Projected fantasy points + per-game FP (projection processing)

- **Match:** Both; Opus DRF-015; Codex roster-fantasy-points
- **Purpose:** Score weighted-average projections and actual stats into fantasy points and FP/GP.
- **Where:** `web/hooks/useProcessedProjectionsData.tsx:1402-1446 (FP sum, per game)`; `web/lib/draftDashboard/fantasyPointRecalculation.ts:3 (pointValueForPlayerStat), :26 (recalculateFantasyPoints)`; `web/lib/projectionsConfig/fantasyPointsConfig.ts:8-32 (defaults)`; `web/lib/draftDashboard/fantasyPointRecalculation.ts:26 recalculateFantasyPoints`; `web/lib/draftDashboard/fantasyPointRecalculation.ts:3 pointValueForPlayerStat`; `web/hooks/useProcessedProjectionsData.tsx:1395 [inline calculation: Projected/actual fantasy points, per-game points and difference]`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: development, current
- **Opus view (DRF-015):**
  - Method: FP = sum over every combinedStats key with nonzero point value of stat*pointValue (HITS_D/BLOCKED_SHOTS_D override for defensemen). Defaults skater G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25; goalie GA -1, SV 0.2, SO 3, W 4. FP/GP = FP / GAMES_PLAYED (projected or actual) when GP>0.
  - Inputs/units: season totals; sources: projection source tables configured in lib/projectionsConfig/projectionSourcesConfig.ts (e.g. projections_* per source), yahoo_players (average_draft_pick, percent_drafted, eligible_positions), yahoo_nhl_player_map / yahoo player map, current-season actual stats tables (ACTUAL_STATS_COLUMN_MAP)
  - Output scale: fantasy points (season total) and FP/GP; writes: —
  - Status: live — Draft Dashboard projections pipeline
  - Consumers: buildPlayerValues; ProjectionsTable; DraftSummaryModal; LeagueStandings; socialShare/score.ts (defaults)
- **Codex view (roster-fantasy-points, calculation, location; Codex family 'draft-scoring'):** Projected/actual fantasy points, per-game points and difference
  - Purpose: Sum each stat×league points weight; use defense-specific HITS_D/BLOCKED_SHOTS_D override where applicable; divide point totals by projected/actual GP; calculate relative differences.
  - Inputs/units: Native count/rate stats and points-per-stat maps; GP counts; player position.
  - Output scale: Fantasy points, FP/game and percent difference; null where no usable data.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/projectionsConfig/fantasyPointsConfig.ts:3-6 'Default fantasy point values for skater stats. Stats not listed here will default to 0.'
  - Intended contract (Codex roster-fantasy-points): Pure recalculation and raw-data-processing implementations coexist; no claim they have identical missing-input behavior. Source: web/lib/draftDashboard/fantasyPointRecalculation.ts:26 recalculateFantasyPoints.
  - External references: League scoring conventions (Yahoo/ESPN default points); ESPN default points scoring as comparison
  - Fixtures/test data: none listed
  - Tests: `web/hooks/useProcessedProjectionsData.test.tsx`; `web/lib/draftDashboard/fantasyPointRecalculation.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/fantraxDisplay.test.ts", "web/lib/draftDashboard/projectionVisibility.test.ts", "web/lib/draftDashboard/fantasyPointRecalculation.test.ts", "web/lib/draftDashboard/espnLiveDraft.test.ts", "web/lib/draftDashboard/yahooLiveDraft.workflow.test.ts", "web/lib/draftDashboard/yahooLiveDraft.test.ts", "web/lib/draft-pro/reportDashboardAdapter.test.ts", "web/lib/draft-pro/scenarioDashboardAdapter.test.ts", "web/lib/integrations/yahoo/writerPermissions.test.ts", "web/hooks/useProcessedProjectionsData.test.tsx", "web/hooks/useRosterScheduleOptimizer.test.tsx", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) FP sums every key present, including derived DEFENSE_POINTS and SH_ASSISTS; if a scoring map weights both SH_POINTS and SH_ASSISTS (or POINTS and GOALS/ASSISTS) counts are double-weighted
  - (opus) hasValidStatForFP=true if ANY projected OR actual stat is non-null, so projected FP can be 0 instead of null when only actuals exist
  - (codex:roster-fantasy-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-010 Projection vs actual diff % and round summaries

- **Match:** Both; Opus DRF-016; Codex roster-projection-difference, roster-round-projection-summary
- **Purpose:** Show projection accuracy per stat and per ADP round.
- **Where:** `web/hooks/useProcessedProjectionsData.tsx:350 (calculateDiffPercentage)`; `web/hooks/useProcessedProjectionsData.tsx:439 (addRoundSummariesToPlayers)`; `web/hooks/useProcessedProjectionsData.tsx:2508-2547, 2722-2770 (diff colour bands)`; `web/hooks/useProcessedProjectionsData.tsx:350 calculateDiffPercentage`; `web/lib/draftDashboard/fantasyPointRecalculation.ts:17 diffPercentage`; `web/hooks/useProcessedProjectionsData.tsx:439 addRoundSummariesToPlayers`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (DRF-016):**
  - Method: diff% = (actual-projected)/projected*100; projected 0 -> 0 if actual 0 else +/-99999 sentinel. Round = ceil(ADP/teamCount); per round sums projected/actual FP and GP; round FP/GP = sumFP/sumGP; round diff% on totals and on per-game. Colour bands \|diff\| <=10 light, <=25 medium, else strong; sentinel shown as ++/--.
  - Inputs/units: fantasy points / stat totals; sources: projection source tables configured in lib/projectionsConfig/projectionSourcesConfig.ts (e.g. projections_* per source), yahoo_players (average_draft_pick, percent_drafted, eligible_positions), yahoo_nhl_player_map / yahoo player map, current-season actual stats tables (ACTUAL_STATS_COLUMN_MAP)
  - Output scale: percent (unbounded), FP/GP; writes: —
  - Status: live
  - Consumers: ProjectionsTable
- **Codex view (roster-projection-difference, calculation, location; Codex family 'draft-projections'):** Actual vs projected percentage difference
  - Purpose: (actual−projected)/projected×100. Both zero=0; zero projected/nonzero actual returns +99999 or −99999 sentinel; missing input=null.
  - Inputs/units: Actual and projection in same units.
  - Output scale: Signed percentage or ±99999 infinity display sentinel.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-round-projection-summary, calculation, location; Codex family 'draft-projections'):** ADP-round fantasy-point totals and weighted per-game summary
  - Purpose: Group players by ceil(ADP/teamCount), sum nonnull projected/actual FP and GP, divide summed FP by summed GP; compare actual and projection.
  - Inputs/units: ADP picks, team count, projected/actual FP and GP.
  - Output scale: Round totals FP, FP/game, relative percent difference.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex roster-projection-difference): Duplicate implementation locations retained for later review, not judged equivalent. Source: web/hooks/useProcessedProjectionsData.tsx:350 calculateDiffPercentage.
  - Intended contract (Codex roster-round-projection-summary): Summary over player pool grouped by ADP, not simulated actual draft-team result. Source: web/hooks/useProcessedProjectionsData.tsx:439 addRoundSummariesToPlayers.
  - External references: Forecast error metrics (MAPE)
  - Fixtures/test data: none listed
  - Tests: `web/hooks/useProcessedProjectionsData.test.tsx`; `{"discovered_not_run": ["web/lib/draftDashboard/fantraxDisplay.test.ts", "web/lib/draftDashboard/projectionVisibility.test.ts", "web/lib/draftDashboard/espnLiveDraft.test.ts", "web/lib/draftDashboard/yahooLiveDraft.workflow.test.ts", "web/lib/draftDashboard/yahooLiveDraft.test.ts", "web/lib/draft-pro/reportDashboardAdapter.test.ts", "web/lib/draft-pro/scenarioDashboardAdapter.test.ts", "web/lib/integrations/yahoo/writerPermissions.test.ts", "web/hooks/useProcessedProjectionsData.test.tsx", "web/hooks/useRosterScheduleOptimizer.test.tsx", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/draftDashboard/sourceAccuracy.test.ts", "web/lib/draftDashboard/fantraxDisplay.test.ts", "web/lib/draftDashboard/projectionVisibility.test.ts", "web/lib/draftDashboard/fantasyPointRecalculation.test.ts", "web/lib/draftDashboard/espnLiveDraft.test.ts", "web/lib/draftDashboard/yahooLiveDraft.workflow.test.ts", "web/lib/draftDashboard/yahooLiveDraft.test.ts", "web/lib/draft-pro/reportDashboardAdapter.test.ts", "web/lib/draft-pro/scenarioDashboardAdapter.test.ts", "web/lib/integrations/yahoo/writerPermissions.test.ts", "web/hooks/useProcessedProjectionsData.test.tsx", "web/hooks/useRosterScheduleOptimizer.test.tsx", "web/hooks/useVORPCalculations.test.tsx", "web/__tests__/components/DraftDashboard/KeeperWorkflow.test.tsx", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx", "web/__tests__/components/DraftDashboard/ProjectionsTable.test.tsx", "web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) 99999 sentinel can leak into averages/sorts
  - (opus) round summary row sets yahooAvgPick = round*teamCount+0.00001 to sort it (synthetic ADP)
  - (codex:roster-projection-difference) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-round-projection-summary) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-011 Draft Pro DUST wrapper (schedule bench waste)

- **Match:** Both; Opus DRF-017; Codex roster-draft-pro-dust
- **Purpose:** Apply roster-schedule optimizer DUST to draft rosters and candidates.
- **Where:** `web/lib/draft-pro/dust.ts:108 (evaluateDraftProDust)`; `web/lib/draft-pro/dust.ts:172 (toInsight)`; `web/lib/draft-pro/dust.ts:108 evaluateDraftProDust`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (DRF-017):**
  - Method: Requires daily lineup mode, fresh schedule (<=36 h), matching seasons. Calls lib/rosterScheduleOptimizer evaluateRosterSchedule / calculateCandidateDust / classifyDustRisk / rankAlternativeRecommendations (computed in other lane). Sort by value or activeGamesAdded.
  - Inputs/units: games; sources: schedule tables via draftProDustRequest / dustSeason mapping
  - Output scale: games; rate 0-1; writes: —
  - Status: live — Draft Pro
  - Consumers: MyRoster DUST %; DustMatrix; SuggestedPicks schedule-fit sort; scenarios
- **Codex view (roster-draft-pro-dust, calculation, location; Codex family 'draft-pro'):** Draft Pro DUST package and ranking
  - Purpose: Apply exact-season/daily-lineup/freshness gates (36h), delegate static roster/candidate DUST, return top3 compatible alternatives; sort candidate active-games gain or original value.
  - Inputs/units: Projection season, schedule fetch times, roster/candidates and slots.
  - Output scale: DUST/active-game insights and state labels.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/components/DraftDashboard/MyRoster.tsx:608 'DUST means Daily Unstartable Schedule Tax'
  - Intended contract (Codex roster-draft-pro-dust): Composition layer over shared DUST; no separate new congestion formula. Source: web/lib/draft-pro/dust.ts:108 evaluateDraftProDust.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/draft-pro/api-tests/dust.test.ts`; `web/lib/draft-pro/dust.test.ts`; `{"discovered_not_run": ["web/lib/draft-pro/api-tests/dust.test.ts", "web/lib/draft-pro/dust.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) core DUST math lives in lib/rosterScheduleOptimizer (other agent's slice)
  - (codex:roster-draft-pro-dust) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-012 Community draft rankings: regularized Bradley-Terry with ADP prior

- **Match:** Both; Opus DRF-018; Codex roster-community-ranking, roster-community-stability
- **Purpose:** Aggregate users' pairwise preferences into a public community top-250.
- **Where:** `web/lib/draft-ranker/communityModel.ts:196 (computeCommunityRanking)`; `web/lib/draft-ranker/communityModel.ts:120 (priorScore), :126 (stabilityBuffer), :139 (deduplicateCommunityPreferences)`; `web/lib/draft-ranker/communityServer.ts:197-215 (market rank = prior Yahoo ADP)`; `web/lib/draft-ranker/communityServer.ts:348 (publicRanks)`; `web/lib/draft-ranker/communityServer.ts:417-470 (persist, rank_delta)`; `web/lib/draft-ranker/communityModel.ts:196 computeCommunityRanking`; `web/lib/draft-ranker/communityModel.ts:120 priorScore`; `web/lib/draft-ranker/communityModel.ts:111 sigmoid`; `web/lib/draft-ranker/communityModel.ts:126 stabilityBuffer`; `web/lib/draft-ranker/communityModel.ts:382 [inline calculation: Community stability buffer and conservative rank]`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-018):**
  - Method: Scores s_i, prior mean m_i = ln((F+1-r)/r) for market rank r (F = field size), 0 if unranked. Market prior weight = 4*max(0, 1-independentUsers/20). Objective: Bradley-Terry log-likelihood with P(i beats j)=sigmoid(s_i-s_j) - 0.25/2*s^2 (L2) - w_i/2*(s_i-m_i)^2. Diagonal (Jacobi) Newton: delta = clamp(0.5*grad/curvature, +/-1), up to 500 iters, tol 1e-8; must converge. Evidence states: emerging (>=5 users, >=10 comparisons, >=5 opponents), established (>=20 users, >=40 comparisons, >=10 opponents, >=2 opponents ranked 200-250 and >=2 ranked 251-300). stabilityBuffer = ceil(30/sqrt(users)+40/sqrt(comparisons)+10/sqrt(opponents)) (75 with no comparisons); conservativeRank = modelRank + buffer. Public top-250: market rank <=250 and not established (market prior), OR established and conservativeRank <= 250; renumbered 1..250 by model rank. rank_delta = previousPublicRank - publicRank.
  - Inputs/units: pairwise outcomes (binary); ADP pick numbers; sources: draft_ranker_pair_preferences, draft_ranker_pair_comparisons, draft_ranker_contribution_preferences, draft_ranker_community_moderation_exclusions, yahoo_players (prior season), fhfh_player_external_identities, fhfh_player_identities
  - Output scale: latent score (log-odds scale); ranks 1..N; public rank 1..250; writes: draft_ranker_community_snapshots, draft_ranker_community_player_results
  - Status: live — community snapshot job (draft-ranker community route)
  - Consumers: components/DraftRanker/CommunityRankingsPage.tsx; lib/draft-ranker/communityReadServer.ts; lib/draft-ranker/exportServer.ts
- **Codex view (roster-community-ranking, calculation, location; Codex family 'Draft ranking and discovery'):** Regularized Bradley–Terry community score and model rank
  - Purpose: Fits pairwise player preferences with an ADP/market prior. Prior mean log((fieldSize+1-rank)/rank); prior weight 4*max(0,1-independentUsers/20), regularizer .25; iterates bounded half-gradient/diagonal-curvature updates, default 500 iterations and 1e-8 convergence. Orders score descending with market rank and ID ties.
  - Inputs/units: Canonical candidate IDs, positive market ordinal ranks, eligible deduplicated independent-user pairwise choices. FieldSize=max(candidate count, maximum ceil market rank,1).
  - Output scale: Unbounded latent score, ordinal model rank 1..N, prior weight 0..4, iteration/convergence and accepted/excluded/deduplicated evidence counts.
  - Version/status: DRAFT_RANKER_COMMUNITY_MODEL_VERSION=regularized-bradley-terry-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-community-stability, calculation, location; Codex family 'Draft ranking and discovery'):** Community stability buffer and conservative rank
  - Purpose: Adds uncertainty padding to model rank: 75 ranks with no comparisons, otherwise ceil(30/sqrt(max(1,users))+40/sqrt(comparisons)+10/sqrt(max(1,opponents))). Conservative rank=modelRank+buffer.
  - Inputs/units: Independent user count, comparison count, distinct opponent count; ordinal model rank.
  - Output scale: Nonnegative integer buffer in rank positions and conservative rank (can exceed field size).
  - Version/status: Regularized Bradley–Terry model v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/draft-ranker/community-ranking-runbook.md:11-20 'Model: regularized-bradley-terry-v1... Prior: verified prior-season Yahoo ADP; its weight decays to zero at 20 independent users... Previously undrafted players: neutral broad prior, never a synthetic ADP'
  - Intended contract (Codex roster-community-ranking): Comments, exported threshold object and result types define this model, not a league fantasy-points model. Source: web/lib/draft-ranker/communityModel.ts:196 computeCommunityRanking.
  - Intended contract (Codex roster-community-stability): Implementation labels a stability buffer, not a calibrated confidence interval. Source: web/lib/draft-ranker/communityModel.ts:126 stabilityBuffer.
  - External references: Bradley-Terry / Elo-style paired comparison models with Gaussian prior (e.g. Glicko/TrueSkill shrinkage); Hunter MM algorithm
  - Fixtures/test data: none listed
  - Tests: `web/lib/draft-ranker/communityModel.test.ts`; `web/lib/draft-ranker/communityRedTeam.test.ts`; `web/lib/draft-ranker/communityServer.test.ts`; `{"discovered_not_run": ["web/lib/draft-ranker/communityModel.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/draft-ranker/communityRedTeam.test.ts", "web/lib/draft-ranker/communityModel.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) each user's comparisons count individually, so one prolific user can dominate likelihood (independentUsers only gates labels and prior decay)
  - (opus) priorScore uses ADP as a rank directly (fractional ADP), and field size includes ceil(max ADP)
  - (opus) cutoffOpponentsInside counts ranks 200-250 only (not the whole top-250)
  - (opus) Jacobi updates with fixed 0.5 damping may converge slowly; non-convergence throws
  - (codex:roster-community-ranking) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-community-stability) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-013 Draft Ranker discovery signals: projection consensus gap, ownership risers, opportunity change

- **Match:** Both; Opus DRF-019; Codex roster-opportunity-discovery, roster-ownership-riser, roster-projection-consensus, roster-projection-discovery
- **Purpose:** Surface players whose projections, ownership or role outpace market ADP.
- **Where:** `web/lib/draft-ranker/discovery.ts:158 (buildProjectionConsensus)`; `web/lib/draft-ranker/discovery.ts:251 (buildProjectionBackedSignals)`; `web/lib/draft-ranker/discovery.ts:330 (buildOwnershipRiserSignals)`; `web/lib/draft-ranker/discovery.ts:413 (buildOpportunityChangeSignals)`; `web/lib/draft-ranker/discovery.ts:500 (deriveOwnerRelativeDiscovery)`; `web/lib/draft-ranker/discoveryServer.ts:289-390 (opportunity candidates)`; `web/lib/draft-ranker/discovery.ts:413 buildOpportunityChangeSignals`; `web/lib/draft-ranker/discovery.ts:330 buildOwnershipRiserSignals`; `web/lib/draft-ranker/discovery.ts:134 percentile`; `web/lib/draft-ranker/discovery.ts:158 buildProjectionConsensus`; `web/lib/draft-ranker/discovery.ts:126 median`; `web/lib/draft-ranker/discovery.ts:251 buildProjectionBackedSignals` …
- **Tags (heuristic):** percent scale: 0-100; generation: development, current
- **Opus view (DRF-019):**
  - Method: Consensus rank = MEDIAN of per-source projection ranks (>=2 sources; conflicting duplicates drop the source). projection_gap if priorADP - consensus >= 25 (score = gap). previously_undrafted if consensus <= 300 (score = 301 - consensus). Ownership riser: latest vs point ~7 days earlier (gap 6-10 days, latest <=2 days old in season / 7 offseason); qualifies if delta >= 5 pp or >= top-decile (ceil(0.9n)-th) of positive deltas. Opportunity: verified event types with confidence >= 0.75 and unexpired, or team change; deployment share gain >= 0.15; score = max(rankGain, shareGain*100). Owner-relative: personalRank - consensusRank >= 25 -> cutoff_challenger if personal rank 251-275 else projection_gap.
  - Inputs/units: ranks, pick numbers, ownership percentage points, share fractions; sources: yahoo_players_with_normalized_history, fhfh_player_external_identities, fhfh_player_identities, forge_roster_events, nhl_api_game_roster_spots, seasons
  - Output scale: score in ranks or percentage points; writes: draft_ranker_discovery_projection_consensus, draft_ranker discovery signal tables (via RPC)
  - Status: live — discovery refresh run (draft_ranker_discovery_refresh_runs)
  - Consumers: components/DraftRanker/DraftDiscovery.tsx; lib/draft-ranker/discoveryReadServer.ts; exportServer
- **Codex view (roster-opportunity-discovery, calculation, location; Codex family 'Draft ranking and discovery'):** Opportunity-change discovery strength
  - Purpose: Admits supported fresh events with confidence>=.75 and sufficient projection-rank improvement (25) or deployment share improvement (.15), with team-change checks; strength uses max(rank gain,100*deployment-share gain).
  - Inputs/units: Event confidence fraction, deployment share fractions, rank before/after, team/context and timestamps.
  - Output scale: Heuristic score in mixed rank/percentage-point terms and signal eligibility.
  - Version/status: draft-ranker-discovery-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-ownership-riser, calculation, codex_part_of_opus; Codex family 'Draft ranking and discovery'):** Ownership riser change and cohort threshold
  - Purpose: Compares latest ownership with baseline at/before seven days earlier, subject to a 6..10-day gap and latest freshness (2 days, or 7 offseason). Qualifies >=5 percentage-point rise or top-90th-percentile positive rise among cohort.
  - Inputs/units: Ownership percentage 0..100 observations and timestamps, season activity state.
  - Output scale: Percentage-point change, relative cohort threshold, eligible riser signal.
  - Version/status: draft-ranker-discovery-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-projection-consensus, calculation, codex_part_of_opus; Codex family 'Draft ranking and discovery'):** Projection consensus rank
  - Purpose: Groups eligible fresh current-season source ranks per player, excludes conflicting duplicate source observations, and takes median when at least two eligible sources exist.
  - Inputs/units: Positive ordinal source ranks, source/provider IDs, projection season, timestamps and decision cutoff.
  - Output scale: Median consensus ordinal rank, source count and source metadata or unavailable.
  - Version/status: draft-ranker-discovery-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-projection-discovery, calculation, codex_part_of_opus; Codex family 'Draft ranking and discovery'):** Projection/market and owner-relative discovery gaps
  - Purpose: Finds projection-backed candidates where market ADP rank minus consensus rank>=25; previously undrafted consensus<=300 uses score301-consensus. Owner-relative score compares personal rank with consensus with same 25-rank threshold; ranks251..275 can be cutoff challengers.
  - Inputs/units: Market/personal/consensus ordinal ranks, source eligibility and player identity.
  - Output scale: Rank gap in picks/positions, discovery score and signal classifications.
  - Version/status: draft-ranker-discovery-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/draft-ranker/discovery.ts:7-16 DRAFT_RANKER_DISCOVERY_THRESHOLDS (minimumProjectionSources 2, projectionGapRanks 25, ownershipGainPoints 5, ownershipTopDecile 0.9, opportunityEventMinimumConfidence 0.75, opportunityDeploymentShareGain 0.15)
  - Intended contract (Codex roster-opportunity-discovery): Supported event types and thresholds in discovery.ts; no probabilistic calibration claimed. Source: web/lib/draft-ranker/discovery.ts:413 buildOpportunityChangeSignals.
  - Intended contract (Codex roster-ownership-riser): Explicit exported discovery thresholds. Source: web/lib/draft-ranker/discovery.ts:330 buildOwnershipRiserSignals.
  - Intended contract (Codex roster-projection-consensus): Explicit freshness and source eligibility gates in buildProjectionConsensus. Source: web/lib/draft-ranker/discovery.ts:158 buildProjectionConsensus.
  - Intended contract (Codex roster-projection-discovery): Discovery threshold object and signal result types; signals are candidate-discovery evidence, not verified future performance. Source: web/lib/draft-ranker/discovery.ts:251 buildProjectionBackedSignals.
  - External references: ADP vs projection-rank value gaps (FantasyPros ECR vs ADP)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/draft-ranker/discovery.test.ts`; `web/lib/draft-ranker/discovery.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/api/v1/draft-ranker/discovery.test.ts", "web/lib/draft-ranker/discovery.test.ts", "web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts", "web/__tests__/pages/api/v1/db/draft-ranker-health.test.ts", "web/lib/integrations/yahoo/writerPermissions.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/e2e/mock-draft.spec.ts", "web/lib/socialShare/modules/teamStream.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts", "web/__tests__/pages/api/v1/draft-ranker/discovery.test.ts", "web/lib/draft-ranker/discovery.test.ts", "web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts", "web/__tests__/pages/api/v1/db/draft-ranker-health.test.ts", "web/lib/sustainability/features.test.ts", "web/scripts/blsh/currentDryRun.test.ts", "web/lib/integrations/yahoo/writerPermissions.test.ts", "web/lib/projections/utils/market-output-builders.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/utils/fetchWigoPercentiles.test.ts", "web/utils/calculatePercentiles.test.ts", "web/tests/api/dashboard-endpoints.test.ts", "web/utils/calculateWigoRatings.test.ts", "web/hooks/usePercentileRank.test.tsx", "web/e2e/social-share-multi-cat-stars.spec.ts", "web/e2e/wigo-one-page.spec.ts", "web/e2e/social-share-skater-boards.spec.ts", "web/e2e/rankings.spec.ts", "web/__tests__/pages/trends/index.test.tsx", "web/lib/socialShare/modules/categoryBlueprint.test.ts", "web/__tests__/pages/forge/command-center.test.tsx", "web/__tests__/pages/rankings.test.tsx", "web/lib/socialShare/modules/teamStream.test.ts", "web/lib/socialShare/modules/multiCatStars.test.ts", "web/lib/socialShare/matchups.test.ts", "web/components/WiGO/TeamPerformanceDrivers.test.tsx", "web/components/WiGO/RateStatPercentiles.test.tsx", "web/components/WiGO/teamPerformanceDrivers.test.ts", "web/__tests__/pages/api/v1/draft-ranker/discovery.test.ts"], "additional_reference_tests": 38, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) discoveryServer sets projectionRankGain=null for all opportunity candidates, so the projection branch of opportunity_change is effectively dead
  - (opus) ADP and projection rank are on different scales (ADP pick vs rank among projected players)
  - (codex:roster-opportunity-discovery) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-ownership-riser) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-projection-consensus) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-projection-discovery) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-014 Draft Ranker assisted placement: binary-search rank interval engine

- **Match:** Both; Opus DRF-020; Codex roster-assisted-placement
- **Purpose:** Place a new player in a personal ranking with pairwise questions.
- **Where:** `web/lib/draft-ranker/placementEngine.ts:64 (initialPlacementInterval)`; `web/lib/draft-ranker/placementEngine.ts:116 (finish)`; `web/lib/draft-ranker/placementEngine.ts:233 (issueNextPlacementAnchor)`; `web/lib/draft-ranker/placementEngine.ts:288 (answerPlacementEngine)`; `web/lib/draft-ranker/placementEngine.ts:64 initialPlacementInterval`; `web/lib/draft-ranker/placementEngine.ts:288 answerPlacementEngine`; `web/lib/draft-ranker/placementEngine.ts:116 finish`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-020):**
  - Method: Initial interval by bucket (top_50 [1,50], 51-100, ..., outside_250 [251,N+1], unsure [1,N+1]). Ask the anchor nearest the interval midpoint; target_over_anchor -> high=min(high, rank); anchor_over_target -> low=max(low, rank+1); too_close -> [rank, rank+1]. When width<=1, validate ranks suggested-1, suggested and 250/251 cutoff; contradiction -> one retry then finish broadened. suggestedRank = floor((low+high)/2); plausible width +/-4 (<=100), 7 (<=200), 10 otherwise when broadened; confidence developing if contradictions, strong if >=5 questions else moderate. Cap 12 questions (16 with contradictions).
  - Inputs/units: rank positions; sources: draft_ranking_entries (via hooks/useDraftPlacement)
  - Output scale: rank 1..N; writes: draft_ranking_entries/events (on confirm)
  - Status: live — Draft Ranker
  - Consumers: components/DraftRanker/AssistedPlacementPanel.tsx
- **Codex view (roster-assisted-placement, calculation, location; Codex family 'Draft ranking and discovery'):** Assisted ranking interval and anchor selection
  - Purpose: Narrows a rough ordinal interval using pairwise anchors and midpoint placement. Completion widens by4/7/10 positions for ranks<=100/<=200/later; evidence/contradiction and 12/16 question caps determine confidence and stopping.
  - Inputs/units: Rough-range selection, current ordered player list, anchor answers, bounds and contradiction counts.
  - Output scale: Proposed rank and ordinal interval, strong/moderate/developing labels, next anchor/stopping state.
  - Version/status: No separate numeric formula version found. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in code; tasks/TASKS/draft-ranker/technical-contract.md
  - Intended contract (Codex roster-assisted-placement): Source constants and finite-state placement types; confidence labels are heuristic, not a statistical confidence interval. Source: web/lib/draft-ranker/placementEngine.ts:64 initialPlacementInterval.
  - External references: Binary insertion sort / noisy binary search
  - Fixtures/test data: none listed
  - Tests: `web/lib/draft-ranker/placementEngine.test.ts`; `{"discovered_not_run": ["web/components/TeamDashboard/TeamDashboard.test.tsx", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/__tests__/pages/auth/callback.test.tsx", "web/__tests__/pages/api/Teams/nst-team-stats.route.test.ts", "web/__tests__/pages/api/fetch_team_table.test.ts", "web/lib/cron/manualCronAudit.test.ts", "web/__tests__/pages/rankings.test.tsx", "web/scripts/run-forge-local.test.ts", "web/lib/draft-ranker/placementEngine.test.ts", "web/components/StatsPage/PlayerSearchBar.test.tsx", "web/components/blshTrade/BlshTradeComparison.test.tsx", "web/components/player-cards/PlayerCardShareStudio.test.tsx", "web/components/player-cards/CurrentPlayerCardStudio.test.tsx", "web/components/player-cards/PlayerCardFlow.test.tsx", "web/components/account/InSeasonPanel.test.tsx", "web/__tests__/pages/api/v1/db/update-nst-goalies.route.test.ts", "web/__tests__/pages/api/v1/db/cron-auth-boundaries.test.ts", "web/__tests__/pages/api/v1/db/update-nst-gamelog.test.ts", "web/components/GameGrid/utils/useFourWeekSchedule.test.ts"], "additional_reference_tests": 16, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) confidence labels are heuristic counts, not probabilistic
  - (codex:roster-assisted-placement) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-015 Draft Ranker pair queue selection

- **Match:** Both; Opus DRF-021; Codex roster-pairwise-queue
- **Purpose:** Choose which player pairs to ask a user next.
- **Where:** `web/lib/draft-ranker/queue.ts:140 (buildDeterministicDraftPairQueue)`; `web/lib/draft-ranker/queue.ts:141 buildDeterministicDraftPairQueue`; `web/lib/draft-ranker/queue.ts:106 takeDiverse`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-021):**
  - Method: Adjacent unresolved pairs among ranks 1-250; discovery pairs: candidates ranked 251-300 (first 50) vs nearest same-position anchor ranked 240-250; validation: contradictions (preferred ranked below other) or preferences >= 30 days old; boundary pairs (250,251), (245,252), (247,253).
  - Inputs/units: ranks; sources: draft_ranking_entries, draft_ranker_pair_preferences
  - Output scale: ordered queue; writes: —
  - Status: live
  - Consumers: hooks/useDraftPairwise.ts
- **Codex view (roster-pairwise-queue, calculation, location; Codex family 'Draft ranking and discovery'):** Deterministic comparison-pair priority queue
  - Purpose: Builds bounded diverse pair selection across adjacent personal top250, cutoff challengers251..300 versus240..250, stale/contradictory preferences and editorial watches/prospects. Applies deterministic priorities, pair deduplication, mode and position diversity quotas.
  - Inputs/units: Personal ordinal rankings, prior preferences and ages, player position, mode, discovery evidence.
  - Output scale: Ordered candidate comparison pairs with priority/reason metadata.
  - Version/status: DRAFT_PAIR_QUEUE_ALGORITHM_VERSION=deterministic_top_down_v2. DRAFT_PAIR_QUEUE_ALGORITHM_VERSION constant in queue.ts; local source only. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved.…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex roster-pairwise-queue): Algorithm constant, comments and queue limits are the intended scheduling contract, not a player metric. Source: web/lib/draft-ranker/queue.ts:141 buildDeterministicDraftPairQueue.
  - External references: Active learning for paired comparisons
  - Fixtures/test data: none listed
  - Tests: `web/lib/draft-ranker/queue.test.ts`; `web/lib/draft-ranker/queueServer.test.ts`; `{"discovered_not_run": ["web/lib/draft-ranker/queue.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-pairwise-queue) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-016 applyCategoryBoosts: Draft Pro valuation-only scoring boosts

- **Match:** Both; Opus DRF-022; Codex roster-category-boost
- **Purpose:** Scale scoring values by user boost percentages without changing league scoring.
- **Where:** `web/lib/draftDashboard/categoryBoosts.ts:4 (applyCategoryBoosts)`; `web/components/DraftDashboard/DraftScoringSettings.tsx:101-105, 241-242`; `web/lib/draftDashboard/categoryBoosts.ts:4 applyCategoryBoosts`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-022):**
  - Method: value' = value * (1 + clamp(boost,0,100)/100). Position weight UI: percent 0..200 -> fraction.
  - Inputs/units: percent 0-100; sources: in-memory
  - Output scale: scoring weights; writes: —
  - Status: live — Draft Pro
  - Consumers: DraftDashboard valuation (fantasyPointSettings/categoryWeights)
- **Codex view (roster-category-boost, calculation, location; Codex family 'draft-scoring'):** User category boost multiplier
  - Purpose: Clamp boost 0..100 then multiply base scoring value by 1+boost/100.
  - Inputs/units: Scoring weights, per-category boost percent.
  - Output scale: Boosted scoring weights at 1×–2× base.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/draftDashboard/categoryBoosts.ts:3 'Applies valuation-only Draft Pro boosts without mutating league scoring.'
  - Intended contract (Codex roster-category-boost): Adjusts category preference/scoring weight, not player stat projections. Source: web/lib/draftDashboard/categoryBoosts.ts:4 applyCategoryBoosts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/DraftSettingsScoring.test.tsx`; `{"discovered_not_run": ["web/__tests__/components/DraftDashboard/DraftSettingsScoring.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-category-boost) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-017 aggregateTeamCategoryTotals / rankTeamCategories / categoryRankBand

- **Match:** Both; Opus DRF-023; Codex roster-team-atoi, roster-team-category-counts, roster-team-category-rank, roster-team-faceoff-pct, roster-team-gaa, roster-team-save-pct, roster-team-shooting-pct
- **Purpose:** Team category totals without averaging rates, and per-category standings ranks.
- **Where:** `web/lib/draftDashboard/categoryStandings.ts:122 (aggregateTeamCategoryTotals)`; `web/lib/draftDashboard/categoryStandings.ts:58 (ratioAggregate), :88 (weightedRateAggregate)`; `web/lib/draftDashboard/categoryStandings.ts:242 (categoryRankBand)`; `web/lib/draftDashboard/categoryStandings.ts:255 (rankTeamCategories)`; `web/lib/draftDashboard/categoryStandings.ts:122 aggregateTeamCategoryTotals`; `web/lib/draftDashboard/categoryStandings.ts:58 ratioAggregate`; `web/lib/draftDashboard/categoryStandings.ts:88 weightedRateAggregate`; `web/lib/draftDashboard/categoryStandings.ts:255 rankTeamCategories`; `web/lib/draftDashboard/categoryStandings.ts:242 categoryRankBand`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, shots on goal; generation: current
- **Opus view (DRF-023):**
  - Method: Counting categories: sum. Rates exact from summed parts when all inputs present: SV% = sum saves/sum SA (SA = SAVES+GA fallback); GAA = sum GA/sum TOTAL_TOI*3600; S% = G/SOG; FO% = FOW/(FOW+FOL); TOI/G = sum TOTAL_TOI/sum GP. Otherwise 'estimated' workload-weighted mean of the rate (SV% by SA; GAA by starts then appearances; S% by SOG; FO% by attempts; TOI by GP); any invalid input -> unavailable. Ranks: competition ranking (ties share rank) ascending/descending by higherIsBetter (points league negative weights invert). Band: percentile=(N-rank+1)/N*100: <=25 red, <=50 orange, <=75 yellow, else green.
  - Inputs/units: season totals; TOI seconds; sources: in-memory
  - Output scale: totals; SV% fraction; GAA goals/60; rank 1..N; writes: —
  - Status: live
  - Consumers: LeagueStandings; DraftDashboard teamStats; GodView
- **Codex view (roster-team-atoi, calculation, codex_part_of_opus; Codex family 'draft-summary'):** Team time-on-ice per game
  - Purpose: sum(totalTOI)/sum(GP); fallback GP-weighted TOI/game.
  - Inputs/units: Complete role-appropriate Time and appearance counts; same source time unit.
  - Output scale: Source time unit per game or null; exact/estimated/unavailable quality.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-team-category-counts, calculation, location; Codex family 'draft-summary'):** Team counting-category projection totals
  - Purpose: For non-rate categories sum finite projected values, treating unavailable as0.
  - Inputs/units: Draft roster projected counting categories in native units.
  - Output scale: Team count total plus exact-from-projected-inputs label.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-team-category-rank, calculation, location; Codex family 'draft-summary'):** Team category competition rank and color band
  - Purpose: Direction-aware sort; ties share competition rank. Percentile=(teamCount−rank+1)/teamCount×100, mapped into quartiles red/orange/yellow/green.
  - Inputs/units: Team category totals, scoring mode/weights and statsMasterList higherIsBetter.
  - Output scale: 1-based rank and quartile color.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-team-faceoff-pct, calculation, codex_part_of_opus; Codex family 'draft-summary'):** Team faceoff win percentage
  - Purpose: sum(FOW)/sum(FOW+FOL); fallback attempts-weighted faceoff rate.
  - Inputs/units: Complete role-appropriate Faceoff wins/losses/attempts and supplied fraction.
  - Output scale: Fraction0–1 or null; exact/estimated/unavailable quality.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-team-gaa, calculation, codex_part_of_opus; Codex family 'draft-summary'):** Team goals-against average
  - Purpose: sum(GA)×3600/sum(totalTOI seconds); fallback starts-weighted GAA, then appearances-weighted GAA.
  - Inputs/units: Complete role-appropriate GA counts, time seconds, starts/appearances or supplied GAA.
  - Output scale: Goals per60 minutes or null; exact/estimated/unavailable quality.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-team-save-pct, calculation, codex_part_of_opus; Codex family 'draft-summary'):** Team save percentage
  - Purpose: sum(saves)/sum(shots against); shots may derive saves+GA; fallback shots-weighted SV%.
  - Inputs/units: Complete role-appropriate Saves, shots against or GA counts; optional supplied SV fraction.
  - Output scale: Fraction0–1 or null; exact/estimated/unavailable quality.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-team-shooting-pct, calculation, codex_part_of_opus; Codex family 'draft-summary'):** Team shooting percentage
  - Purpose: sum(goals)/sum(shots); fallback shots-weighted shooting fraction.
  - Inputs/units: Complete role-appropriate Goals/shots counts and supplied shooting fraction.
  - Output scale: Fraction0–1 or null; exact/estimated/unavailable quality.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/draftDashboard/categoryStandings.ts:117-121 'Aggregates category projections without treating rates as counting stats...'
  - Intended contract (Codex roster-team-atoi): Pooled components first; missing exact inputs may permit weighted estimate, invalid inputs do not. Any required incomplete contributor prevents complete rate. Source: web/lib/draftDashboard/categoryStandings.ts:122 aggregateTeamCategoryTotals.
  - Intended contract (Codex roster-team-category-counts): Rate categories follow separate pooling/fallback paths; no claim of full forecast coverage beyond implemented label. Source: web/lib/draftDashboard/categoryStandings.ts:122 aggregateTeamCategoryTotals.
  - Intended contract (Codex roster-team-category-rank): Missing rate values remain unranked; counts may default0; points negative weights reverse direction. Source: web/lib/draftDashboard/categoryStandings.ts:255 rankTeamCategories.
  - Intended contract (Codex roster-team-faceoff-pct): Pooled components first; missing exact inputs may permit weighted estimate, invalid inputs do not. Any required incomplete contributor prevents complete rate. Source: web/lib/draftDashboard/categoryStandings.ts:122 aggregateTeamCategoryTotals.
  - Intended contract (Codex roster-team-gaa): Pooled components first; missing exact inputs may permit weighted estimate, invalid inputs do not. Any required incomplete contributor prevents complete rate. Source: web/lib/draftDashboard/categoryStandings.ts:122 aggregateTeamCategoryTotals.
  - Intended contract (Codex roster-team-save-pct): Pooled components first; missing exact inputs may permit weighted estimate, invalid inputs do not. Any required incomplete contributor prevents complete rate. Source: web/lib/draftDashboard/categoryStandings.ts:122 aggregateTeamCategoryTotals.
  - Intended contract (Codex roster-team-shooting-pct): Pooled components first; missing exact inputs may permit weighted estimate, invalid inputs do not. Any required incomplete contributor prevents complete rate. Source: web/lib/draftDashboard/categoryStandings.ts:122 aggregateTeamCategoryTotals.
  - External references: Roto/H2H category standings conventions
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/GodView.test.tsx`; `web/__tests__/components/DraftDashboard/LeagueStandings.test.tsx`; `web/lib/draftDashboard/draftWorkflow.integration.test.tsx`; `{"discovered_not_run": ["web/lib/draftDashboard/draftWorkflow.integration.test.tsx", "web/__tests__/components/DraftDashboard/GodView.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) GAA ratio assumes TOTAL_TOI in seconds
  - (codex:roster-team-atoi) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-team-category-counts) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-team-category-rank) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-team-faceoff-pct) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-team-gaa) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-team-save-pct) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-team-shooting-pct) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-018 Draft pick arithmetic: snake/custom order, keeper/traded pick numbers, pick windows

- **Match:** Both; Opus DRF-024; Codex roster-draft-order-horizon, roster-mock-snake-prng
- **Purpose:** Map (round, pickInRound) <-> overall pick and owner; count picks until a team's turn.
- **Where:** `web/lib/draftDashboard/draftOrder.ts:55 (isRoundReversed), :66 (pickInRoundForTeamIndex), :82 (originalPickOwnerForPattern)`; `web/lib/draftDashboard/keepers.ts:61 (keeperPickNumber)`; `web/lib/draftDashboard/pickTrades.ts:266-350 (resolvePickOwner, findNextActionablePick, findPicksUntilTeamTurn)`; `web/lib/draftDashboard/godView.ts:10 (selectGodViewQueue), :31 (godViewRosterProgress), :55 (selectMyPickWindows)`; `web/lib/mockDraft/engine.ts:64 (seatAt), :68 (waitUntilNext)`; `web/lib/draftDashboard/draftOrder.ts:66 pickInRoundForTeamIndex`; `web/lib/draftDashboard/draftOrder.ts:82 originalPickOwnerForPattern`; `web/lib/draftDashboard/pickTrades.ts:239 findPicksUntilTeamTurn`; `web/lib/draftDashboard/pickTrades.ts:339 findSelectionHorizon`; `web/lib/draftDashboard/keepers.ts:61 keeperPickNumber`; `web/lib/mockDraft/engine.ts:53 random`; `web/lib/mockDraft/engine.ts:64 seatAt` …
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (DRF-024):**
  - Method: pick = (round-1)*teamCount + pickInRound; round = ceil(pick/teamCount); snake reverses even rounds; custom reverses listed rounds; owner via trades/keepers. Mock: seat = ((pick-1)/count odd) ? count-offset-1 : offset (snake only). Roster progress fraction = min(1, filled/capacity).
  - Inputs/units: picks; sources: in-memory
  - Output scale: pick numbers; writes: —
  - Status: live
  - Consumers: useVORPCalculations (picksUntilNext); availability horizon; GodView
- **Codex view (roster-draft-order-horizon, calculation, location; Codex family 'draft-logistics'):** Draft pick ownership, actionable turns and selection horizon
  - Purpose: Round/pick arithmetic under standard/snake/custom reversals; apply traded ownership, keeper/completed/full-roster skips; scan to user turn and count opposing actionable picks.
  - Inputs/units: Team count/order, round, custom reversal, pick trades, keepers, completed picks and capacity.
  - Output scale: Absolute pick numbers, signed/no-later turn state, actionable opposing count.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-mock-snake-prng, calculation, location; Codex family 'Mock draft'):** Seeded random draw and snake-pick distance
  - Purpose: Hashes session seed into repeatable mixed uint32 random draws divided by2^32; maps pick to alternating snake seat and counts picks until the same seat next selects.
  - Inputs/units: String seed, 1-based overall pick and team count.
  - Output scale: Pseudo-random fraction [0,1), seat index and intervening pick count.
  - Version/status: Mock-draft engine local tuning. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex roster-draft-order-horizon): findPicksUntilTeamTurn returns pick-number distance; availability uses actual opposing actionable count, not that distance. Source: web/lib/draftDashboard/draftOrder.ts:66 pickInRoundForTeamIndex.
  - Intended contract (Codex roster-mock-snake-prng): Pure deterministic mock-session helpers, not unpredictability/security utilities. Source: web/lib/mockDraft/engine.ts:53 random.
  - External references: Snake draft conventions
  - Fixtures/test data: none listed
  - Tests: `web/e2e/god-view.spec.ts`; `web/lib/draftDashboard/godView.test.ts`; `web/lib/draftDashboard/keepers.test.ts`; `web/lib/draftDashboard/pickTrades.test.ts`; `{"discovered_not_run": ["web/hooks/useMockDraft.test.ts", "web/lib/mockDraft/engine.test.ts", "web/__tests__/pages/api/v1/draft-ranker/pairwise/queue.test.ts", "web/lib/game-predictions/workflow.test.ts", "web/lib/integrations/yahoo/discovery.test.ts", "web/lib/integrations/yahoo/pollPolicy.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/draftDashboard/pickTrades.test.ts", "web/lib/draftDashboard/keepers.test.ts", "web/hooks/useVORPCalculations.test.tsx", "web/__tests__/components/DraftDashboard/KeeperWorkflow.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) mock-draft seatAt is snake-only; dashboard dashboardView labels mock order 'snake' - custom/standard orders unsupported in mocks
  - (codex:roster-draft-order-horizon) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-mock-snake-prng) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-019 buildPositionTiers / advisePosition: 1-D k-means positional tiers + take-now advice

- **Match:** Both; Opus DRF-025; Codex roster-position-tiers, roster-tier-availability-advice
- **Purpose:** Automatic value tiers per position and Take now / Can wait advice.
- **Where:** `web/lib/draftDashboard/positionalTiers.ts:14 (cluster)`; `web/lib/draftDashboard/positionalTiers.ts:81 (buildPositionTiers)`; `web/lib/draftDashboard/positionalTiers.ts:93 (remainingBands)`; `web/lib/draftDashboard/positionalTiers.ts:102 (advisePosition)`; `web/lib/draftDashboard/tierDashboardAdapter.ts:11 (buildDashboardTiers)`; `web/lib/draftDashboard/positionalTiers.ts:14 cluster`; `web/lib/draftDashboard/positionalTiers.ts:81 buildPositionTiers`; `web/lib/draftDashboard/positionalTiers.ts:93 remainingBands`; `web/lib/draftDashboard/positionalTiers.ts:102 advisePosition`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-025):**
  - Method: Values min-max scaled to 0..1; exact contiguous 1-D k-means (DP on prefix sums), k=2..min(8,unique,n-1), best k by mean silhouette (neighbour-group 1-D silhouette); n<4 -> one band. Then recursively split any band wider than 0.05 of the scaled range at its min-SSE boundary. Tied values never split. breakThreshold = max(3*median adjacent gap, 0.25*IQR). Remaining band gap = last remaining in band minus first remaining in next non-empty band; meaningfulBreak if gap > breakThreshold. Advice: expected = sum availability over remaining band players; 'Can wait' if opposingPicks=0 or expected>=1.5 (and gap known); 'Take now' if expected<0.5 and meaningfulBreak. Tier adapter nulls values whose required inputs (SV% needs SA>0, GAA needs starts) are incomplete.
  - Inputs/units: fantasy points or z-score sum; ADP pick numbers; sources: projection source tables configured in lib/projectionsConfig/projectionSourcesConfig.ts (e.g. projections_* per source), yahoo_players (average_draft_pick, percent_drafted, eligible_positions), yahoo_nhl_player_map / yahoo player map, current-season actual stats tables (ACTUAL_STATS_COLUMN_MAP)
  - Output scale: tier index 1..N; expected remaining count (players); writes: —
  - Status: live — Draft Pro tiers tab (gated) and mock draft pro bots
  - Consumers: SuggestedPicks tiers tab / TierCards; mockDraft engine (pro tier scarcity)
- **Codex view (roster-position-tiers, calculation, location; Codex family 'draft-recommendations'):** Positional value tiers and natural break threshold
  - Purpose: Normalize sorted values; dynamic-program contiguous clusters minimizing SSE, choose up to8 clusters by silhouette, preserve ties; split broad bands. Break=max(3×median positive/adjacent gap,.25×IQR).
  - Inputs/units: Comparable value per eligible position.
  - Output scale: Ranked tier bands, min/max values and break threshold in value units.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-tier-availability-advice, calculation, location; Codex family 'draft-recommendations'):** Tier gap and expected survivors at next turn
  - Purpose: Gap=worst available in band−best available lower band; sum ADP survival estimates. Can wait if no opposing picks or expected≥1.5 with gap; take now if expected<.5 and meaningful gap.
  - Inputs/units: Tier bands, available IDs, ADP horizon/spread and open starting-slot flag.
  - Output scale: Expected survivor count; gap; Take now/Can wait/Uncertain/preview labels.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/components/DraftDashboard/SuggestedPicks.tsx:785 'Bands wider than 5% of the positional value range are split... A meaningful break exceeds three times the median adjacent gap and one quarter of the positional interquartile range... Take now means fewer than 0.5 comparable players estimated to remain before a meaningful drop; Can wait requires at least 1.5'
  - Intended contract (Codex roster-position-tiers): Data-driven heuristic tiers; under4 valid players have null tier labels. Source: web/lib/draftDashboard/positionalTiers.ts:14 cluster.
  - Intended contract (Codex roster-tier-availability-advice): Recommendation based on same uncalibrated ADP availability, not observed room intent. Source: web/lib/draftDashboard/positionalTiers.ts:93 remainingBands.
  - External references: Jenks natural breaks / 1-D k-means tiering (e.g. Boris Chen Gaussian-mixture tiers)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx`; `web/lib/draftDashboard/positionalTiers.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/positionalTiers.test.ts", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx", "web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/draftDashboard/positionalTiers.test.ts", "web/lib/sources/lunaHosted/archiveBridge.test.ts", "web/scripts/blsh/baselineEvaluation.test.ts", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx", "web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) 5%-of-range band width cap is a product heuristic that can override silhouette-optimal clustering
  - (opus) thresholds 1.5 / 0.5 expected players are heuristics
  - (codex:roster-position-tiers) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-tier-availability-advice) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-020 calculateScheduleMetrics: team games, off-nights, back-to-backs for draft weeks

- **Match:** Both; Opus DRF-026; Codex roster-draft-schedule-metrics
- **Purpose:** Schedule opportunity counts per team over selected matchup weeks.
- **Where:** `web/lib/draftDashboard/scheduleMetrics.ts:27 (calculateScheduleMetrics)`; `web/lib/draftDashboard/scheduleMetrics.ts:58 (totalRosterScheduleMetrics)`; `web/lib/draftDashboard/scheduleMetrics.ts:27 calculateScheduleMetrics`; `web/lib/draftDashboard/scheduleMetrics.ts:58 totalRosterScheduleMetrics`
- **Tags (heuristic):** generation: current
- **Opus view (DRF-026):**
  - Method: Per team over dates inside selected weeks: games++, off-night if league games that day <= 8, b2b if team also played the previous calendar day. Roster totals sum player team metrics (null if any player unknown).
  - Inputs/units: games, dates; sources: NHL schedule (lib/NHL GameData via useDraftSchedule), yahoo_matchup_weeks
  - Output scale: counts; writes: —
  - Status: live
  - Consumers: ProjectionsTable off-night column; LeagueStandings schedule view; useDraftSchedule
- **Codex view (roster-draft-schedule-metrics, calculation, location; Codex family 'draft-schedule'):** NHL games, off-nights and back-to-back second nights
  - Purpose: Deduplicate regular-season games; exclude cancelled/postponed; count selected team dates. Off-night if league slate≤8 games; B2B if previous calendar date has team game. Sum unique roster IDs.
  - Inputs/units: NHL team schedule, selected matchup-week date ranges.
  - Output scale: Integer games/off-night games/B2B second-night games.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/draftDashboard/scheduleMetrics.ts:26 'Count NHL opportunities, not predicted player/goalie appearances.'
  - Intended contract (Codex roster-draft-schedule-metrics): Team opportunities, not predicted appearances. Previous date may lie outside selected week while second night is inside. Source: web/lib/draftDashboard/scheduleMetrics.ts:27 calculateScheduleMetrics.
  - External references: Off-night convention: nights with <= half the league (<=8 of 16 games) playing
  - Fixtures/test data: none listed
  - Tests: `web/e2e/draft-pro-free.spec.ts`; `web/hooks/useDraftSchedule.test.tsx`; `web/lib/draftDashboard/scheduleMetrics.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/scheduleMetrics.test.ts", "web/hooks/useDraftSchedule.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) off-night threshold 8 fixed regardless of league size (32 teams -> 16 max games)
  - (codex:roster-draft-schedule-metrics) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-021 calculateSourceAccuracy: projection source accuracy (mean normalized abs error)

- **Match:** Both; Opus DRF-027; Codex roster-source-accuracy
- **Purpose:** Rank projection sources by error vs actuals.
- **Where:** `web/lib/draftDashboard/sourceAccuracy.ts:21 (calculateSourceAccuracy)`; `web/lib/draftDashboard/sourceAccuracy.ts:21 calculateSourceAccuracy`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (DRF-027):**
  - Method: For every stat (excluding GP) and source: normalizedError += \|proj-actual\| / max(\|actual\|, 0.01); 'perGame' mode divides counting stats by source projected GP and actual GP (rate stats by regex PER_GAME\|PER_60\|AVERAGE\|PERCENTAGE\|_PCT\|RATE untouched). meanError% = sum/matched*100; accuracy = clamp(100-meanError, 0, 100); coverage = matched/projected*100.
  - Inputs/units: season totals or per-game; sources: projection source tables configured in lib/projectionsConfig/projectionSourcesConfig.ts (e.g. projections_* per source), yahoo_players (average_draft_pick, percent_drafted, eligible_positions), yahoo_nhl_player_map / yahoo player map, current-season actual stats tables (ACTUAL_STATS_COLUMN_MAP)
  - Output scale: percent 0-100; writes: —
  - Status: live
  - Consumers: components/DraftDashboard/ProjectionSourceAccuracy.tsx
- **Codex view (roster-source-accuracy, calculation, location; Codex family 'draft-projections'):** Projection source error, coverage and accuracy score
  - Purpose: Optionally convert counting metrics to per-game; absolute normalized error=abs(projected−actual)/max(abs(actual),.01). MeanError%=mean×100; coverage=matched/projected×100; accuracy=clamp(100−meanError,0,100).
  - Inputs/units: Source projections, actuals, game counts, metric/type and total/per-game basis.
  - Output scale: Mean normalized error%, coverage%, accuracy 0–100, counts.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/components/DraftDashboard/ProjectionSourceAccuracy.tsx:59 'Accuracy is 100 minus mean normalized absolute error'
  - Intended contract (Codex roster-source-accuracy): Descriptive historical score with denominator floor; not a calibrated forecast probability. Source: web/lib/draftDashboard/sourceAccuracy.ts:21 calculateSourceAccuracy.
  - External references: Forecast accuracy metrics (MAPE / sMAPE / MAE)
  - Fixtures/test data: none listed
  - Tests: `web/lib/draftDashboard/sourceAccuracy.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/sourceAccuracy.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) dividing by max(\|actual\|,0.01) explodes errors on near-zero actuals (e.g. 0 SHG -> 1/0.01*proj = huge), dominating the mean
  - (opus) all stats equally weighted regardless of fantasy relevance; accuracy floors at 0 quickly
  - (codex:roster-source-accuracy) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-022 rankProjectionPlayers / calculateSourceRankImpacts

- **Match:** Both; Opus DRF-028; Codex roster-source-rank-impact
- **Purpose:** Show how toggling a projection source moves player ranks.
- **Where:** `web/lib/draftDashboard/sourceRankImpact.ts:13 (rankProjectionPlayers)`; `web/lib/draftDashboard/sourceRankImpact.ts:39 (calculateSourceRankImpacts)`; `web/lib/draftDashboard/sourceRankImpact.ts:13 rankProjectionPlayers`; `web/lib/draftDashboard/sourceRankImpact.ts:39 calculateSourceRankImpacts`
- **Tags (heuristic):** generation: current
- **Opus view (DRF-028):**
  - Method: Rank skaters and goalies separately by projected FP desc (ties by id); delta = previousRank - currentRank; reported if \|delta\| >= 3 (materialRankDelta).
  - Inputs/units: fantasy points; sources: in-memory
  - Output scale: rank 1..N, delta ranks; writes: —
  - Status: live
  - Consumers: ProjectionSourceSettings
- **Codex view (roster-source-rank-impact, calculation, location; Codex family 'draft-projections'):** Projection source rank movement
  - Purpose: Rank finite projected fantasy points descending within defined roles/pool, then delta=previousRank−currentRank; omit changes below material threshold.
  - Inputs/units: Previous/current player projection pools and rank-delta threshold.
  - Output scale: Integer ordinal ranks and signed rank movement.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex roster-source-rank-impact): Positive delta denotes rise; source-control influence, not player performance change. Source: web/lib/draftDashboard/sourceRankImpact.ts:13 rankProjectionPlayers.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/draftDashboard/sourceRankImpact.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/sourceRankImpact.test.ts", "web/lib/draftDashboard/sourceWeights.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) goalie detection uses displayPosition === 'G' exactly (multi-position strings fall to skaters)
  - (codex:roster-source-rank-impact) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-023 calculateWeightedProjection / source shares: multi-source projection blend

- **Match:** Both; Opus DRF-029; Codex roster-projection-weighting
- **Purpose:** Blend projections from several selected sources with user weights.
- **Where:** `web/lib/draftDashboard/sourceWeights.ts:40 (calculateWeightedProjection)`; `web/lib/draftDashboard/sourceWeights.ts:3 (getEffectiveSourceShares), :21 (normalizeSourceWeights), :60 (equalizeSourceWeights)`; `web/hooks/useProcessedProjectionsData.tsx:1080-1137 (per-stat blend)`; `web/hooks/useProjectionSourceAnalysis.ts:84 (setWeight clamp 0..2), :100 (effectiveShares duplicate)`; `web/lib/draftDashboard/sourceWeights.ts:40 calculateWeightedProjection`; `web/lib/draftDashboard/sourceWeights.ts:3 getEffectiveSourceShares`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (DRF-029):**
  - Method: Per stat: weighted mean = sum(value*w)/sum(w) over selected sources with finite value and w>0; sources missing the player/stat are skipped (implicit renormalization). Shares = w/sum(selected w); normalize rounds shares to 3 decimals; equalize sets 1/count. Weights clamped 0..2 in UI hook (MIN_ENABLED_WEIGHT 0.1).
  - Inputs/units: source-native units (totals; SV% fraction; TOI as parsed); sources: projection source tables configured in lib/projectionsConfig/projectionSourcesConfig.ts (e.g. projections_* per source), yahoo_players (average_draft_pick, percent_drafted, eligible_positions), yahoo_nhl_player_map / yahoo player map, current-season actual stats tables (ACTUAL_STATS_COLUMN_MAP)
  - Output scale: same units as inputs; writes: —
  - Status: live
  - Consumers: useProcessedProjectionsData -> all draft valuation; ProjectionSourceSettings UI
- **Codex view (roster-projection-weighting, calculation, location; Codex family 'draft-projections'):** Weighted multi-source projection and effective shares
  - Purpose: Weighted mean sum(value×weight)/sum(weight) across finite positive-weight source values; effective selected source shares normalize selected weights.
  - Inputs/units: Projection values in same target units and source weights.
  - Output scale: Weighted projection native units or null; source shares 0–1 summing1 when usable.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/hooks/useProcessedProjectionsData.tsx:2411 tooltip 'Projected is a weighted average.'
  - Intended contract (Codex roster-projection-weighting): Missing source values are excluded from their metric denominator; source selection/weighting is not an accuracy calibration. Source: web/lib/draftDashboard/sourceWeights.ts:40 calculateWeightedProjection.
  - External references: Projection aggregation (FantasyPros-style weighted consensus)
  - Fixtures/test data: none listed
  - Tests: `web/e2e/draft-settings.spec.ts`; `web/lib/draftDashboard/draftWorkflow.integration.test.tsx`; `web/lib/draftDashboard/sourceWeights.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/draftWorkflow.integration.test.tsx", "web/lib/draftDashboard/sourceWeights.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) rate stats (SV%, GAA, TOI/G) are averaged across sources unweighted by each source's volume (e.g. SV% not recomputed from blended saves/SA)
  - (opus) per-stat renormalization means a player's G and A can come from different source mixes (internally inconsistent stat lines, e.g. P != G+A)
  - (opus) duplicate share logic in useProjectionSourceAnalysis.ts and sourceWeights.ts
  - (codex:roster-projection-weighting) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-024 Mock draft bot pick model (decide): utility score + softmax sampling

- **Match:** Both; Opus DRF-031; Codex roster-mock-bot-score, roster-mock-delay, roster-mock-snake-prng
- **Purpose:** Simulate opponent picks in mock drafts with personalities.
- **Where:** `web/lib/mockDraft/engine.ts:169 (decide)`; `web/lib/mockDraft/engine.ts:46 (tuning)`; `web/lib/mockDraft/engine.ts:53 (random seeded RNG)`; `web/lib/mockDraft/engine.ts:142 (makeRoom)`; `web/lib/mockDraft/engine.ts:414 (delayMs)`; `web/lib/mockDraft/engine.ts:169 decide`; `web/lib/mockDraft/engine.ts:46 tuning`; `web/lib/mockDraft/engine.ts:414 delayMs`; `web/lib/mockDraft/engine.ts:53 random`; `web/lib/mockDraft/engine.ts:64 seatAt`; `web/lib/mockDraft/engine.ts:68 waitUntilNext`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (DRF-031):**
  - Method: range = max(1, top value - value at rank teamCount*3). score = (v - top)/range + 0.15*(v - baseline_pos)/range [baseline = value at index roster_pos*teamCount-1 in full pool] - max(0, ADP - pick)/(teamCount*(Vanilla?1:4)) + (needed ? (Conservative 0.65 : 0.28) : -0.25) - 0.25*max(0, heldAtPos - slots). Pro: + scarcity*0.22*min(2, planningWait/teamCount) where scarcity = max(0, v - replacement_value)/range and replacement = available player at index round(demand) (demand = sum over opponents picking before my next turn of 1 if they still need the position else 0.25); + min(0.3, gap/range) if needed and a meaningful tier break is nearly exhausted; categories weakness bonus clamp(+/-0.2, 0.04*sum cat_k/(1+held_k)). Free: + min(0.15, 0.08*scarcity). Personalities: Zero-G -1.5*max(0,0.9-progress) for G; Fade -0.65*(1-progress) at position; Reach +0.5+0.3*scarcity; Hero-G +min(0.9, workload/70)*(games?0.6:1); BPA +0.4*(v-top)/range; Contrarian + (0.4*positive - 0.6 fade\|0.3 bust)*confidence(1/0.7/0.4). Shortlist (6, Aggressive pro 10) from plausible (rank<2T or ADP<=pick+2T or needed&scarcity>0.2) that keep rosters completable (max-flow feasibility). Turn planning (pro, consecutive picks): +0.3*max(next best + 0.35 if fits open slot). Choice ~ softmax(score/temperature), temperature 0.08 (Vanilla/BPA) else 0.13 (+0.22 Aggressive) + 0.04*variation; seeded FNV/mulberry RNG.
  - Inputs/units: value in FP or z units; ADP picks; sources: frozen projection pool (freezePlayers), components/DraftDashboard/mock-sleepers-value-list.json (Contrarian research)
  - Output scale: dimensionless score; pick probabilities via softmax; writes: mock_draft_events (via mock_draft_ingest, only human picks contribute to ADP)
  - Status: live — mock drafts (lib/mockDraft/flags.ts gates)
  - Consumers: hooks/useMockDraft.ts; components/DraftDashboard/MockDraftWorkspace.tsx
- **Codex view (roster-mock-bot-score, calculation, location; Codex family 'Mock draft'):** Mock-bot baseline value, need, ADP, scarcity and category fit
  - Purpose: Builds candidate utility from top-range normalized value, positional replacement weighting(.15), ADP reach penalty scaled by teams, need (.28; conservative .65), unused-slot/overstack penalties(-.25), Pro scarcity(.22 with capped wait/team), tier urgency<=.3, and category weakness contribution(.04, clamped ±.2).
  - Inputs/units: Projected league value, ADP, draft pick/team count, team roster and categories, tiers, mode/personality.
  - Output scale: Dimensionless heuristic candidate score and component/reason metadata.
  - Version/status: Local mock engine tuning object. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-mock-delay, calculation, location; Codex family 'Mock draft'):** Simulated pick delay distribution
  - Purpose: Chooses delay factor from weighted ranges: 25% uses 0.10..0.25, 55% uses 0.35..0.70, 15% uses 0.85..0.99, and 5% uses full clock; multiplies configured seconds by 1000 and rounds.
  - Inputs/units: Pick clock seconds and seeded uniform random draws.
  - Output scale: Integer simulated delay milliseconds.
  - Version/status: Local mock engine. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-mock-snake-prng, calculation, location; Codex family 'Mock draft'):** Seeded random draw and snake-pick distance
  - Purpose: Hashes session seed into repeatable mixed uint32 random draws divided by2^32; maps pick to alternating snake seat and counts picks until the same seat next selects.
  - Inputs/units: String seed, 1-based overall pick and team count.
  - Output scale: Pseudo-random fraction [0,1), seat index and intervening pick count.
  - Version/status: Mock-draft engine local tuning. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/mockDraft/engine.ts:91 'Augmenting paths reassign dual-eligible players; greedy allocation can falsely fill a bench.'; :120 'All held players must remain assigned...'
  - Intended contract (Codex roster-mock-bot-score): Tuning constants and decide body; simulated behavior utility, not a probability or recommended production trade value. Source: web/lib/mockDraft/engine.ts:169 decide.
  - Intended contract (Codex roster-mock-delay): Explicit delayMs implementation; UX simulation, not a player metric. Source: web/lib/mockDraft/engine.ts:414 delayMs.
  - Intended contract (Codex roster-mock-snake-prng): Pure deterministic mock-session helpers, not unpredictability/security utilities. Source: web/lib/mockDraft/engine.ts:53 random.
  - External references: Opponent modelling in draft simulators (ADP-based pick probability / softmax over value)
  - Fixtures/test data: `web/components/DraftDashboard/mock-sleepers-value-list.json`
  - Tests: `web/hooks/useMockDraft.test.ts`; `web/lib/mockDraft/engine.test.ts`; `{"discovered_not_run": ["web/hooks/useMockDraft.test.ts", "web/lib/mockDraft/engine.test.ts", "web/__tests__/pages/api/v1/draft-ranker/pairwise/queue.test.ts", "web/lib/game-predictions/workflow.test.ts", "web/lib/integrations/yahoo/discovery.test.ts", "web/lib/integrations/yahoo/pollPolicy.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/hooks/useMockDraft.test.ts", "web/lib/mockDraft/engine.test.ts", "web/lib/routeRunner/core.test.ts", "web/lib/rosterScheduleData/planning.test.ts", "web/lib/integrations/yahoo/discovery.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/hooks/useMockDraft.test.ts", "web/lib/socialShare/modules/goalieRescue.test.ts", "web/lib/mockDraft/engine.test.ts", "web/lib/socialShare/postedWeek.test.ts", "web/__tests__/pages/api/v1/db/update-rolling-player-averages.test.ts", "web/scripts/blsh/forecastDevRun.test.ts", "web/lib/game-predictions/workflow.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) many magic constants (0.28, 0.22, 0.15, 0.25, 0.65, 70-start workload, temperatures) without calibration
  - (opus) ADP penalty only punishes reaching (ADP > pick) - no bonus for fallers beyond value term
  - (opus) category 'weakness' uses per-category z-values that may be negative; held totals clamped at 0
  - (codex:roster-mock-bot-score) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-mock-delay) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-mock-snake-prng) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-025 DraftDashboard roster needs: posNeeds, catNeeds, teamVorp, team projected points, picksUntilNext

- **Match:** Both; Opus DRF-032; Codex roster-roster-need, roster-team-points-vorp
- **Purpose:** Derive per-team totals and my-team needs feeding recommendations and standings.
- **Where:** `web/components/DraftDashboard/DraftDashboard.tsx:2232 (picksUntilNext)`; `web/components/DraftDashboard/DraftDashboard.tsx:2464-2523 (teamStats: projectedPoints, teamVorp, categoryTotals)`; `web/components/DraftDashboard/DraftDashboard.tsx:2534 (posNeeds)`; `web/components/DraftDashboard/DraftDashboard.tsx:2616 (catNeeds)`; `web/components/DraftDashboard/DraftDashboard.tsx:2529 [inline calculation: Position need fraction and category deficits]`; `web/components/DraftDashboard/DraftDashboard.tsx:2615 [inline calculation: Position need fraction and category deficits]`; `web/components/DraftDashboard/DraftDashboard.tsx:2464 [inline calculation: Draft roster projected fantasy points and team VORP totals]`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: shots on goal; generation: current
- **Opus view (DRF-032):**
  - Method: picksUntilNext = findPicksUntilTeamTurn over draft order/trades/keepers (span teamCount*max(2,rosterSlots)); returns teamCount if my team absent. Team projectedPoints = sum projected FP of drafted players; teamVorp = sum VORP; categoryTotals via aggregateTeamCategoryTotals. posNeeds_p = min(1, (slots_p - filled_p)/max(1,slots_p)). catNeeds_k = max(0, leagueMean_k - myTotal_k) for HARD-CODED keys G, A, PPP, SOG, HIT, BLK.
  - Inputs/units: counts / fantasy points / picks; sources: in-memory draft state
  - Output scale: needs 0..1 (positions) or raw counts (categories); writes: —
  - Status: live
  - Consumers: useVORPCalculations (picksUntilNext); SuggestedPicks / usePlayerRecommendations (needs); LeagueStandings; DraftSummaryModal
- **Codex view (roster-roster-need, calculation, location; Codex family 'draft-recommendations'):** Position need fraction and category deficits
  - Purpose: Position need=min(1,max(0,max(1,slotTotal)−filled)/max(1,slotTotal)). Six-category need=max(0,league mean−own total).
  - Inputs/units: Position slot/filled counts and six skater category team totals.
  - Output scale: Position fraction0–1; native-count category deficits.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-team-points-vorp, calculation, location; Codex family 'draft-summary'):** Draft roster projected fantasy points and team VORP totals
  - Purpose: Sum projected FP for all roster assignments and separately sum player VORP; absent entries are0.
  - Inputs/units: Drafted/keeper roster IDs and full player-value pool.
  - Output scale: Team fantasy-point total and sum VORP.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/components/DraftDashboard/DraftDashboard.tsx:2533 'compute my team's positional needs normalized 0..1 (remaining slots / total slots)'; :2615 'category deficits vector for my team (categories mode): league mean - my totals'
  - Intended contract (Codex roster-roster-need): Feeds personalized suggestions; category deficits are not normalized probabilities. Source: web/components/DraftDashboard/DraftDashboard.tsx:2529.
  - Intended contract (Codex roster-team-points-vorp): Includes roster/bench players, not actual daily lineup startable totals. Source: web/components/DraftDashboard/DraftDashboard.tsx:2464.
  - External references: Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx`; `web/lib/draftDashboard/draftWorkflow.integration.test.tsx`; `{"discovered_not_run": ["web/lib/draftDashboard/roundRankHistory.test.ts", "web/__tests__/components/DraftDashboard/KeeperWorkflow.test.tsx", "web/__tests__/components/DraftDashboard/DraftSettingsShell.test.tsx", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx", "web/__tests__/components/DraftDashboard/DraftSettingsScoring.test.tsx", "web/__tests__/pages/draft-dashboard.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) catNeeds keys are hard-coded to six skater categories regardless of the league's categories (goalie categories never produce need)
  - (opus) catNeeds are raw count deficits (hits ~ hundreds vs PPP ~ tens) - unstandardized, so high-volume categories dominate category fit
  - (opus) teamVorp sums VORP against a moving 'remaining' replacement baseline
  - (codex:roster-roster-need) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-team-points-vorp) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-026 usePlayerRecommendations / buildRecommendationCandidates: recommendation rank score

- **Match:** Both; Opus DRF-034; Codex roster-recommendation-baseline
- **Purpose:** Build Suggested Picks candidates and their baseline rank score from VORP metrics.
- **Where:** `web/hooks/usePlayerRecommendations.ts:50 (buildRecommendationCandidates)`; `web/hooks/usePlayerRecommendations.ts:83 (usePlayerRecommendations)`; `web/hooks/usePlayerRecommendations.ts:50 buildRecommendationCandidates`
- **Tags (heuristic):** generation: current
- **Opus view (DRF-034):**
  - Method: (1) Replacement level: inherited from useVORPCalculations; optionally the personalized metrics where replacement indices subtract MY filled slots. (2) Value source: VORP metrics value. (3) VONA as in useVORPCalculations. (4) Baseline: rankValue = VBD (fallback VORP); baselineScore = 0.7*VBD + 0.3*VONA (VONA effectively weighted 0.51 overall since VBD already contains 0.3*VONA); globalVorp kept unpersonalized for display. (5) Eligibility grouped per forwardGrouping; role goalie if G eligible. Then passed to buildPersonalizedRecommendations with needAlpha = needWeightEnabled ? needAlpha : 0.
  - Inputs/units: fantasy points or z-score units; sources: projection source tables configured in lib/projectionsConfig/projectionSourcesConfig.ts (e.g. projections_* per source), yahoo_players (average_draft_pick, percent_drafted, eligible_positions), yahoo_nhl_player_map / yahoo player map, current-season actual stats tables (ACTUAL_STATS_COLUMN_MAP)
  - Output scale: rank score in value units; writes: —
  - Status: live
  - Consumers: components/DraftDashboard/SuggestedPicks.tsx; components/DraftDashboard/MyRoster.tsx
- **Codex view (roster-recommendation-baseline, calculation, location; Codex family 'draft-recommendations'):** Suggestion baseline VBD/VONA blend
  - Purpose: baselineScore=0.7×VBD+0.3×VONA from selected suggestion metric context; preserve global VORP as display value.
  - Inputs/units: Global and optionally personalized VORP metrics.
  - Output scale: Unbounded comparable suggestion score.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/hooks/usePlayerRecommendations.ts:2-4 'Computes top-N recommended players based on VORP/VBD and optional team needs weighting.'; :34 'A separately calculated filled-roster replacement map; never mutate global table VORP.'
  - Intended contract (Codex roster-recommendation-baseline): Recommendation baseline differs from raw VBD and league-wide VORP. Source: web/hooks/usePlayerRecommendations.ts:50 buildRecommendationCandidates.
  - External references: Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/MyRoster.test.tsx`; `web/hooks/usePlayerRecommendations.test.tsx`; `web/lib/draftDashboard/draftWorkflow.integration.test.tsx`; `{"discovered_not_run": ["web/lib/draftDashboard/draftWorkflow.integration.test.tsx", "web/hooks/usePlayerRecommendations.test.tsx", "web/__tests__/components/DraftDashboard/MyRoster.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) VONA double-counted (0.7*VBD + 0.3*VONA where VBD = 0.6VORP+0.3VONA+0.1VOLS)
  - (opus) candidates use VBD from personalized metrics but display globalVorp, so ordering and displayed VORP can disagree
  - (codex:roster-recommendation-baseline) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-027 useVORPCalculations: VORP / VOLS / VONA / VBD per player

- **Match:** Both; Opus DRF-035; Codex roster-vbd, roster-vols, roster-vona, roster-vorp-replacement
- **Purpose:** Compute league-wide draft value over replacement (VORP), over last starter (VOLS), over next available (VONA) and the blended VBD rank value for every projected player.
- **Where:** `web/hooks/useVORPCalculations.ts:67 (useVORPCalculations)`; `web/hooks/useVORPCalculations.ts:125-136 (replacement indices)`; `web/hooks/useVORPCalculations.ts:166-181 (expectedTaken / next-turn depletion)`; `web/hooks/useVORPCalculations.ts:211-253 (best position, VONA, VBD)`; `web/hooks/useVORPCalculations.ts:253 [inline calculation: VBD blended draft value]`; `web/hooks/useVORPCalculations.ts:123 [inline calculation: VOLS: value over last starter]`; `web/hooks/useVORPCalculations.ts:211 [inline calculation: VOLS: value over last starter]`; `web/hooks/useVORPCalculations.ts:166 [inline calculation: VONA and expected players taken by position]`; `web/hooks/useVORPCalculations.ts:216 [inline calculation: VONA and expected players taken by position]`; `web/hooks/useVORPCalculations.ts:67 useVORPCalculations`; `web/hooks/useVORPCalculations.ts:123 [inline calculation: VORP replacement level and value over replacement]`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (DRF-035):**
  - Method: (1) REPLACEMENT LEVEL: per roster position p (C/LW/RW/D/G, or FWD/D/G when grouped; +FWD pool when rosterConfig.FWD>0) with T=teamCount and starters s_p (minus my filled slots when personalizeReplacement): VORP index = floor(T*(s_p + utilAdj_p) + 1) - 1 = T*(s_p+utilAdj_p) (0-based, i.e. the first player beyond league starters); VOLS index = floor(T*s_p) - 1 (the last league starter). UTIL slots are split 1/3 each to C/LW/RW (UTIL_TO_DEF_ENABLED=false so D gets 0); in 'fwd' grouping UTIL goes wholly to FWD. Bench slots are NOT counted (not handled). Goalies get no UTIL share. Replacement pool = remaining (available) players by default or full pool when baselineMode='full'; index clamped to pool length-1; empty pool -> replacement 0. (2) VALUE SOURCE: buildPlayerValues -> points leagues: projected fantasy points (source-weighted projection x league scoring; optional 84-game proration for skaters); categories leagues: sum of weighted z-scores from calculateCategoryScores. Optional Draft Pro position weight multiplier (0..2) applied to the value before pools. (3) VONA: N = floor(picksUntilNext); take the N available players with lowest Yahoo ADP (players without ADP ignored); each contributes 1/k to each of its k eligible positions -> expectedTaken_p. Baseline = value at index floor(currentIndexOfPlayerInAvailablePool_p + expectedTaken_p) in that position's available pool (or index floor(expectedTaken_p) if the player is not in the pool); VONA = value - baseline. Assumes opponents draft strictly by ADP; ignores opponent roster needs. (4) VBD = 0.6*VORP + 0.3*VONA + 0.1*VOLS (dashboard-specific blend; classic VBD uses one baseline). (5) MULTI-POSITION: eligibility normalized (F/FWD -> C,LW,RW); a player appears in every eligible pool; reported metrics come from the eligible position with max VORP (ties broken by VONA then VOLS) - not summed. Positional scarcity enters only through per-position replacement depth.
  - Inputs/units: value: fantasy points (season totals; 84-game pace if prorate84) or dimensionless z-score sum; picksUntilNext in picks; ADP in overall pick number; sources: projection source tables configured in lib/projectionsConfig/projectionSourcesConfig.ts (e.g. projections_* per source), yahoo_players (average_draft_pick, percent_drafted, eligible_positions), yahoo_nhl_player_map / yahoo player map, current-season actual stats tables (ACTUAL_STATS_COLUMN_MAP)
  - Output scale: VORP/VOLS/VONA/VBD in same units as value (fantasy points or z-score sum), unbounded, can be negative; writes: —
  - Status: live — used by DraftDashboard (pages/draft-dashboard) for every table/recommendation
  - Consumers: components/DraftDashboard/DraftDashboard.tsx (vorpMetrics, personalized metrics); ProjectionsTable, SuggestedPicks, MyRoster, DraftBoard, LeagueStandings, DraftSummaryModal; hooks/usePlayerRecommendations.ts; lib/draft-pro/scenarioDashboardAdapter.ts, reportDashboardAdapter.ts (globalVorp)
- **Codex view (roster-vbd, calculation, codex_part_of_opus; Codex family 'draft-value'):** VBD blended draft value
  - Purpose: 0.6×bestVORP + 0.3×bestVONA + 0.1×bestVOLS.
  - Inputs/units: VORP/VONA/VOLS in comparable value units.
  - Output scale: Signed blended fantasy-point or z-score units.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-vols, calculation, codex_part_of_opus; Codex family 'draft-value'):** VOLS: value over last starter
  - Purpose: Last-starter index=max(0,floor(teams×remaining starters)−1), capped to pool; VOLS=value−last-starter value at selected best position.
  - Inputs/units: Comparable value, league position starter count, teams, full/remaining pool.
  - Output scale: Signed fantasy-point or z-score difference.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-vona, calculation, codex_part_of_opus; Codex family 'draft-value'):** VONA and expected players taken by position
  - Purpose: Take N=floor(nonnegative picksUntilNext) lowest finite-ADP available players; split each1 across eligible positions. Next baseline=floor(current position rank+expectedTaken), capped to end; VONA=value−next baseline.
  - Inputs/units: Available ADP picks/position eligibility, current positional value ranks and picks until next turn.
  - Output scale: Fractional expectedTaken counts; signed value over next available.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-vorp-replacement, calculation, codex_part_of_opus; Codex family 'draft-value'):** VORP replacement level and value over replacement
  - Purpose: Replacement index=floor(teams×(remaining starters+UTIL positional share)); clamp to pool end. VORP=value−replacement. Full or remaining pool; optional filled-slot personalization.
  - Inputs/units: Comparable fantasy points/z-score, eligible position pools, league teams/slots, utility allocation.
  - Output scale: Signed fantasy points or z-score units above position replacement.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): tasks/draft-dashboard-youtube-outline.md:195-206: 'VORP - Value Over Replacement Player: how much more value a player offers than the position's estimated replacement option... Replacement depth comes from league size, starting slots, and a utility adjustment'; 'VONA - Value Over Next Available: estimated cost of waiting until your next turn... uses available players' ADP and the number of intervening picks... Multi-position players split their expected positional contribution'; 'VBD = 60% VORP + 30% VONA + 10% VOLS'; tasks/prd-positional-weighting.md:11-14 (weights applied to comparable value before replacement metrics)
  - Intended contract (Codex roster-vbd): Fixed heuristic blend after best-position selection; distinct from raw VORP. Source: web/hooks/useVORPCalculations.ts:253.
  - Intended contract (Codex roster-vols): Shares useVORPCalculations replacement policy; independent of utility-adjusted VORP denominator. Source: web/hooks/useVORPCalculations.ts:123.
  - Intended contract (Codex roster-vona): ADP heuristic, not calibrated room simulation; already-drafted players use expectedTaken baseline index. Source: web/hooks/useVORPCalculations.ts:166. If player is absent from the available pool, next baseline starts at expectedTaken instead of currentRank; empty position pool yields VONA=value. Expected taken counts divide each top-N player equally among valid positions. PicksUntilNext is supplied by caller; actionable horizon logic is separately inventoried.
  - Intended contract (Codex roster-vorp-replacement): UTIL split across C/LW/RW (D disabled) or wholly FWD. Best eligible position maximizes VORP, then VONA, then VOLS. Source: web/hooks/useVORPCalculations.ts:67 useVORPCalculations. Pools use configured effective roster positions and player eligibility; T is league team count. Optional personalization subtracts own filled slots from per-team starter counts. Empty pool baseline0; index capped at last available value; ineligible players receive0 VORP/VOLS/VONA/VBD. Multi-position players enter eligible pools but select a single best position for final metrics.
  - External references: Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
  - Fixtures/test data: `web/hooks/useVORPCalculations.test.tsx (inline player fixtures)`
  - Tests: `web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx`; `web/__tests__/components/DraftDashboard/DraftRetention.test.tsx`; `web/hooks/useVORPCalculations.test.tsx`; `web/lib/draft-pro/scenarioDashboardAdapter.test.ts`; `{"discovered_not_run": ["web/lib/draft-pro/reportDashboardAdapter.test.ts", "web/lib/draft-pro/scenarioDashboardAdapter.test.ts", "web/hooks/useVORPCalculations.test.tsx", "web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) VONA baseline index = player's own index + expectedTaken, so with expectedTaken=0 the top player compares against himself (VONA 0); classic VONA compares to the best player expected at the NEXT pick (own index+1+taken) - possible off-by-one
  - (opus) expectedTaken counts the player himself if he is in the top-N ADP list
  - (opus) bench slots ignored and UTIL split equally 1/3 to C/LW/RW regardless of positional depth; D never receives UTIL share
  - (opus) baselineMode 'remaining' moves replacement level as the draft proceeds, so 'VORP' is a moving target (differs from classic static VBD)
  - (opus) VBD blend 0.6/0.3/0.1 is a magic constant; VBD includes VONA which depends on ADP availability, so non-ADP players get understated VONA
  - (opus) clamp() helper defined but unused (dead code)
  - (opus) VONA uses floor of fractional expectedTaken (e.g. 0.9 -> 0)
  - (opus) ProjectionsTable tooltip calls categories Score a '0-100 percentile-weighted composite' but value is a weighted z-score sum (tasks/draft-dashboard-youtube-outline.md:112 notes this)
  - (codex:roster-vbd) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-vols) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-vona) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-vorp-replacement) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-028 buildPersonalizedRecommendations (Draft Pro): need-weighted recommendation score

- **Match:** Both; Opus DRF-036; Codex roster-recommendation-goalie-ratios, roster-recommendation-need-score
- **Purpose:** Personalize suggestion order by roster and category needs without changing league VORP.
- **Where:** `web/lib/draft-pro/recommendations.ts:152 (buildPersonalizedRecommendations)`; `web/lib/draft-pro/recommendations.ts:111 (fitForPosition)`; `web/lib/draft-pro/recommendations.ts:119 (categoryFit)`; `web/lib/draft-pro/recommendations.ts:88 (categoryValuesFor)`; `web/lib/draft-pro/recommendations.ts:88 categoryValuesFor`; `web/lib/draft-pro/recommendations.ts:152 buildPersonalizedRecommendations`; `web/lib/draft-pro/recommendations.ts:119 categoryFit`; `web/lib/draft-pro/recommendations.ts:111 fitForPosition`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: development, current
- **Opus view (DRF-036):**
  - Method: (1) Replacement: not recomputed (uses candidate.rankValue/baselineScore). (2) Value source: rankScore = baselineScore ?? rankValue. Category values recomputed: SV% = saves/(saves+GA or SA), GAA = GA*3600/TOTAL_TOI (TOI in seconds); per-category z-scores via calculateCategoryScores over the CANDIDATE pool. (3) No VONA logic here; availability = estimatePlayerAvailability (reason tag only, not in score). (4) Position fit = max(clamp01(need_p)) over eligible positions. Category fit = sum(z_k * need_k)/sum(\|need_k\|*\|w_k\|) over enabled role-applicable categories; categories add position fit. normalizedFit = clamp01(fit / max(1, max\|fit\|)). recommendationScore = rankScore + alpha * normalizedFit * adjustmentScale, adjustmentScale = max(1, max \|rankScore\| over all candidates). (5) Multi-position: best eligible position need.
  - Inputs/units: rank values in FP or z units; needs 0..1 (position) or raw counts (categories); TOI seconds; sources: in-memory candidates (sent to /api/v1/draft-pro/recommendations for Pro)
  - Output scale: recommendation score in rank-value units; writes: —
  - Status: live — Draft Pro gated (draftProEligible); free path uses alpha only when needWeightEnabled
  - Consumers: pages/api/v1/draft-pro/recommendations (server); SuggestedPicks (remote Pro path); usePlayerRecommendations (local path)
- **Codex view (roster-recommendation-goalie-ratios, calculation, location; Codex family 'draft-recommendations'):** Recommendation goalie ratio reconstruction
  - Purpose: Derive shots against=saves+GA if absent; SV%=saves/shots if valid; GAA=GA×3600/totalTOI seconds. Delete invalid ratio rather than infer.
  - Inputs/units: Goalie saves, GA, shots counts, total time seconds.
  - Output scale: SV fraction and GAA goals/60 or omitted values.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-recommendation-need-score, calculation, location; Codex family 'draft-recommendations'):** Personalized roster/category recommendation score
  - Purpose: Position fit=max(clamped eligible needs). Category fit=sum(directional category z×need)/sum(abs(need)×abs(weight)); add position fit. Normalize fit by max(1,max abs fit), clamp0..1. Score=baseline+clamped alpha×normalized fit×max(1,max abs baseline).
  - Inputs/units: Candidate comparable scores, position/category needs, enabled weights, alpha0–1.
  - Output scale: Recommendation score, rank score, global VORP, reasons and missing categories.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/draft-pro/recommendations.ts:148-151 'Builds suggestion-only personalized ranks. globalVorp and rankScore remain the league-wide values so tables can continue to present raw VORP.'; :137-139 'categoryScores already applies lower-is-better direction... missing categories contribute no fit.'; tasks/draft-pro/PLAN.md:28
  - Intended contract (Codex roster-recommendation-goalie-ratios): Feeds recommendation category z-score population; related but distinct from categoryStandings fallback aggregation. Source: web/lib/draft-pro/recommendations.ts:88 categoryValuesFor.
  - Intended contract (Codex roster-recommendation-need-score): Suggestion-only; globalVorp/rankScore unchanged. Category missing inputs contribute no fit. Source: web/lib/draft-pro/recommendations.ts:152 buildPersonalizedRecommendations.
  - External references: Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative; SGP-based category need weighting
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx`; `web/__tests__/pages/api/v1/draft-pro/recommendations.test.ts`; `web/lib/draft-pro/recommendations.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/positionalTiers.test.ts", "web/lib/draft-pro/api-tests/scenarios.test.ts", "web/lib/draft-pro/api-tests/checkout-verify.test.ts", "web/lib/draft-pro/api-tests/reports.test.ts", "web/lib/draft-pro/recommendations.test.ts", "web/lib/integrations/yahoo/pickupApi.test.ts", "web/lib/integrations/yahoo/liveDraftApi.test.ts", "web/lib/integrations/providerSyncRolloutRoutes.test.ts", "web/lib/integrations/providerSyncPaywall.test.ts", "web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx", "web/__tests__/pages/api/v1/draft-pro/recommendations.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) adjustmentScale = max \|rankScore\| in the whole candidate pool, so with alpha=0.5 a fully-needed player gets +50% of the top player's VBD - need can dominate value
  - (opus) category z-scores recomputed over the candidate pool only (different population than league valuation)
  - (opus) catNeeds supplied by DraftDashboard are raw count deficits in heterogenous units (see catNeeds entry) yet divided by \|weight\| sums - unit mixing
  - (opus) GAA uses TOTAL_TOI assumed seconds (*3600)
  - (codex:roster-recommendation-goalie-ratios) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-recommendation-need-score) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-029 Scenario / report adapters: globalVorp and roster category totals (Draft Pro)

- **Match:** Both; Opus DRF-037; Codex roster-report-category-strength, roster-scenario-candidate-deltas, roster-scenario-roster-totals
- **Purpose:** Convert dashboard players into scenario/report players carrying league VORP and projected category values; compare candidates.
- **Where:** `web/lib/draft-pro/scenarioDashboardAdapter.ts:82-95 (scenarioPlayer)`; `web/lib/draft-pro/reportDashboardAdapter.ts:68-78 (reportPlayer)`; `web/lib/draft-pro/scenarios.ts:45 (categoryTotal), :55 (summarizeScenarioRoster), :61 (compareDraftProScenarios)`; `web/lib/draft-pro/reports.ts:54 (buildDraftProReport strengths/weaknesses)`; `web/lib/draft-pro/reports.ts:54 buildDraftProReport`; `web/lib/draft-pro/reportDashboardAdapter.ts:83 adaptReportDashboard`; `web/lib/draft-pro/scenarios.ts:61 compareDraftProScenarios`; `web/lib/draft-pro/scenarioDashboardAdapter.ts:101 adaptScenarioDashboard`; `web/lib/draft-pro/scenarios.ts:55 summarizeScenarioRoster`; `web/lib/draft-pro/scenarios.ts:45 categoryTotal`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: development, current
- **Opus view (DRF-037):**
  - Method: (1) Replacement level: none recomputed - globalVorp = PlayerVorpMetrics.vorp at capture time (moving 'remaining' baseline). (2) Value source: rankValue = metric.value; category values = raw projected stats. Roster totals: rawVorp = sum globalVorp; projectedPoints sum (null if any missing); counting categories summed over role-applicable players; SV% = sum saves / sum SA; GAA = sum GA*3600 / sum TOTAL_TOI. (3) VONA: not handled. (4) Candidate delta: rawVorpDelta = candidate.globalVorp; category delta = total(after)-total(before). Report strengths/weaknesses = categories better/worse than a reference roster (direction inverted for GAA/GA/L). (5) Multi-position: only positionNeeds listed; not handled in value.
  - Inputs/units: fantasy points / z units; TOI seconds; sources: in-memory; saved drafts (draft_pro saved draft snapshots)
  - Output scale: VORP sums, category totals, SV% fraction, GAA goals/60; writes: draft_pro saved scenarios/reports (via scenariosServer / savedDraftsServer)
  - Status: live — Draft Pro gated
  - Consumers: ScenarioComparisonPanel; AnalyticalReportsPanel; /api/v1/draft-pro/scenarios, /reports
- **Codex view (roster-report-category-strength, calculation, location; Codex family 'draft-pro'):** Report reference-roster category strengths/weaknesses
  - Purpose: Use scenario totals; direction-adjusted difference own−reference or reference−own for inverted category; sign selects stronger/weaker; schedule conflicts reuse DUST bench counts.
  - Inputs/units: Roster, optional explicit reference roster/basis, category direction, optional DUST.
  - Output scale: Category strength/weakness labels and daily bench conflict counts.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-scenario-candidate-deltas, calculation, location; Codex family 'draft-pro'):** Candidate A/B add-only scenario delta
  - Purpose: Append each available candidate independently to baseline roster; report after−before FP/category totals, raw VORP addition, position needs and server DUST insight.
  - Inputs/units: Current roster, two distinct candidates, scoring/source context and optional DUST response.
  - Output scale: Signed FP/category deltas; VORP addition; activeGamesAdded/marginal bench.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-scenario-roster-totals, calculation, location; Codex family 'draft-pro'):** Scenario roster sum and pooled goalie rates
  - Purpose: Sum raw VORP and complete projected points; role-applicable counts require all finite; SV=sum saves/sum SA, GAA=sum GA×3600/sum TOI.
  - Inputs/units: Scenario roster global VORP, projected FP, enabled category values.
  - Output scale: FP/VORP sums, category count/rate totals or null.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/draft-pro/scenarioDashboardAdapter.ts:82 'Scenario data is unavailable because ... has no current league VORP.'; tasks/draft-pro/PLAN.md:10
  - Intended contract (Codex roster-report-category-strength): No strengths inferred without a comparison roster; report schemaVersion1. Source: web/lib/draft-pro/reports.ts:54 buildDraftProReport.
  - Intended contract (Codex roster-scenario-candidate-deltas): Add-only comparison; not trade or automatic drop recommendation. scenario-v1 fingerprint binds source inputs. Source: web/lib/draft-pro/scenarios.ts:61 compareDraftProScenarios.
  - Intended contract (Codex roster-scenario-roster-totals): Separate aggregator from categoryStandings: no weighted-rate fallback here. Source: web/lib/draft-pro/scenarios.ts:55 summarizeScenarioRoster.
  - External references: Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
  - Fixtures/test data: none listed
  - Tests: `web/lib/draft-pro/api-tests/reports.test.ts`; `web/lib/draft-pro/api-tests/scenarios.test.ts`; `web/lib/draft-pro/reportDashboardAdapter.test.ts`; `web/lib/draft-pro/reports.test.ts`; `web/lib/draft-pro/scenarioDashboardAdapter.test.ts`; `web/lib/draft-pro/scenarios.test.ts`; `{"discovered_not_run": ["web/lib/draft-pro/api-tests/scenarios.test.ts", "web/lib/draft-pro/api-tests/reports.test.ts", "web/lib/draft-pro/scenarios.test.ts", "web/hooks/useDraftProScenarios.test.tsx", "web/hooks/useDraftProReports.test.tsx", "web/lib/draft-pro/scenarioDashboardAdapter.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/draft-pro/reports.test.ts", "web/lib/draft-pro/reportDashboardAdapter.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) summed VORP is relative to a replacement level that shifts as players are drafted, so a saved scenario's rawVorp is not comparable over time
  - (opus) TOTAL_TOI assumed seconds for GAA
  - (codex:roster-report-category-strength) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-scenario-candidate-deltas) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-scenario-roster-totals) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-030 estimatePlayerAvailability: ADP normal-survival availability probability

- **Match:** Both; Opus DRF-038; Codex roster-adp-availability
- **Purpose:** Probability a player is still available at the user's target pick, conditional on being available now.
- **Where:** `web/lib/draftDashboard/availability.ts:21 (estimatePlayerAvailability)`; `web/lib/draftDashboard/availability.ts:13 (logNormalSurvival)`; `web/lib/draft-pro/recommendations.ts:62 (estimateAvailability wrapper)`; `web/components/DraftDashboard/ProjectionsTable.tsx:768 (risk column)`; `web/lib/draftDashboard/availability.ts:21 estimatePlayerAvailability`; `web/lib/draftDashboard/availability.ts:13 logNormalSurvival`; `web/lib/draft-pro/recommendations.ts:62 estimateAvailability`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (DRF-038):**
  - Method: Player draft slot ~ Normal(ADP, sd). now = (currentPick-1-ADP)/sd; later = (currentPick-1+opposingPicks-ADP)/sd. P = S(later)/S(now) with S = upper-tail normal survival via Abramowitz-Stegun 26.2.17 polynomial in log space (constants 0.2316419, 0.31938153, -0.356563782, 1.781477937, -1.821255978, 1.330274429). opposingPicks=0 -> 1. Clamped 0..1.
  - Inputs/units: ADP and picks in overall pick numbers; spread in picks; sources: yahoo_players ADP
  - Output scale: probability 0-1; writes: —
  - Status: live
  - Consumers: positionalTiers.advisePosition (expected remaining players); Draft Pro recommendations (availabilityEstimate); SuggestedPicks avail sort / free riskBoost; ProjectionsTable risk column
- **Codex view (roster-adp-availability, calculation, location; Codex family 'draft-recommendations'):** Conditional ADP survival availability estimate
  - Purpose: Normal-survival ratio S((current−1+opposingPicks−ADP)/sd)/S((current−1−ADP)/sd), computed in log space; sd clamped2..40 default12; no opposing picks→1.
  - Inputs/units: Positive ADP (pick), actionable current/target picks and opposing pick count; spread in picks.
  - Output scale: Probability-like heuristic fraction0–1 or null.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/draftDashboard/availability.ts:20 'ADP heuristic, conditional on availability now; not a calibrated room forecast.'
  - Intended contract (Codex roster-adp-availability): Explicitly uncalibrated ADP heuristic conditional on availability now; legacy positional arguments cannot establish horizon. Source: web/lib/draftDashboard/availability.ts:21 estimatePlayerAvailability.
  - External references: ADP-normal availability models (e.g. FantasyPros 'chance available'); ADP SD typically scales with ADP
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx`; `web/lib/draft-pro/recommendations.test.ts`; `web/lib/draftDashboard/positionalTiers.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/positionalTiers.test.ts", "web/lib/draft-pro/api-tests/scenarios.test.ts", "web/lib/draft-pro/api-tests/checkout-verify.test.ts", "web/lib/draft-pro/api-tests/reports.test.ts", "web/lib/draft-pro/recommendations.test.ts", "web/lib/integrations/yahoo/pickupApi.test.ts", "web/lib/integrations/yahoo/liveDraftApi.test.ts", "web/lib/integrations/providerSyncRolloutRoutes.test.ts", "web/lib/integrations/providerSyncPaywall.test.ts", "web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx", "web/__tests__/pages/api/v1/draft-pro/recommendations.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) constant SD for all ADPs; empirical ADP spread grows with ADP (early picks sd ~2, late ~15+)
  - (opus) no calibration against real draft outcomes (code comment says heuristic)
  - (opus) no dedicated availability.test.ts found
  - (codex:roster-adp-availability) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-031 buildPlayerValues: comparable draft value (points or category z-sum) + position weights

- **Match:** Both; Opus DRF-039; Codex roster-position-weights
- **Purpose:** Shared per-player comparable value and grouped eligibility feeding VORP, tiers and mock drafts.
- **Where:** `web/lib/draftDashboard/playerValues.ts:9 (buildPlayerValues)`; `web/lib/draftDashboard/positionWeights.ts:25 (buildPositionWeightMultipliers)`; `web/lib/draftDashboard/forwardGrouping.ts:30 (normalizePlayerEligibility), :52 (groupPlayerEligibility), :133 (buildPositionPools)`; `web/lib/draftDashboard/positionWeights.ts:25 buildPositionWeightMultipliers`; `web/lib/draftDashboard/playerValues.ts:9 buildPlayerValues`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-039):**
  - Method: Points: value = projected FP; if prorate84 and not goalie -> computeProratedFantasyPoints (counting stats / projected GP * 84) with league scoring only (mergeWithDefaults=false). Categories: build per-player projected map, derive SHOTS_AGAINST_GOALIE = SAVES+GA when missing and GAMES_STARTED from first of STARTS_GOALIE/GAMES_STARTED_GOALIE/GAMES_GOALIE/GAMES_PLAYED_GOALIE/GP_GOALIE, then calculateCategoryScores. Position weights: multiplier = max over player's eligible positions of weight (default 1), accepted only 0..2 and !=1; value *= multiplier after scoring; unweighted value kept. Eligibility: F/FWD expands to C,LW,RW; 'split' grouping keeps C/LW/RW and adds FWD if roster has a FWD slot; 'fwd' grouping collapses to FWD/D/G.
  - Inputs/units: fantasy points totals or projected counting stats; weights fraction 0-2; sources: projection source tables configured in lib/projectionsConfig/projectionSourcesConfig.ts (e.g. projections_* per source), yahoo_players (average_draft_pick, percent_drafted, eligible_positions), yahoo_nhl_player_map / yahoo player map, current-season actual stats tables (ACTUAL_STATS_COLUMN_MAP)
  - Output scale: fantasy points or z-score sum (unbounded); writes: —
  - Status: live — via useVORPCalculations, tierDashboardAdapter, mockDraft adapter
  - Consumers: useVORPCalculations; tierDashboardAdapter.buildDashboardTiers; lib/mockDraft/adapter.freezePlayers
- **Codex view (roster-position-weights, calculation, location; Codex family 'draft-scoring'):** Position preference multiplier and comparable player value
  - Purpose: Choose maximum eligible position multiplier; multiply comparable fantasy points/category z-sum after scoring/proration and before replacement pools/tiers; retain unweighted value.
  - Inputs/units: Projected FP or category score, league eligibility, user positional multipliers 0–2.
  - Output scale: Comparable weighted value, same nominal units as score.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/draftDashboard/playerValues.ts:8 'Shared league-wide values; no availability or personalized replacement inputs.'; :90 'Weight only the comparable valuation, after scoring/proration and before replacement pools and tiers.'; tasks/prd-positional-weighting.md:11-14
  - Intended contract (Codex roster-position-weights): Never mutates raw projections or scoring maps. Source: web/lib/draftDashboard/positionWeights.ts:25 buildPositionWeightMultipliers.
  - External references: Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
  - Fixtures/test data: none listed
  - Tests: `web/hooks/useVORPCalculations.test.tsx`; `web/lib/draftDashboard/forwardGrouping.test.ts`; `web/lib/draftDashboard/positionalTiers.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/positionalTiers.test.ts", "web/hooks/useVORPCalculations.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) GAMES_STARTED fallback uses GAMES_PLAYED_GOALIE (appearances) as starts - inflates GAA regression workload
  - (opus) multiplier uses MAX across eligible positions, so a C/LW player gets the more favourable weight
  - (opus) negative category composites scaled by weight<1 move toward zero (documented intentional in PRD)
  - (codex:roster-position-weights) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-032 computeProratedFantasyPoints / getProratedStat: 84-game skater pace

- **Match:** Both; Opus DRF-040; Codex roster-skater-season-proration, web-lib-projectionsconfig-proration-computeproratedfantasypoints, web-lib-projectionsconfig-proration-getproratedstat
- **Purpose:** Optionally pace skater counting projections to a full season before valuation.
- **Where:** `web/lib/projectionsConfig/proration.ts:62 (getProratedStat)`; `web/lib/projectionsConfig/proration.ts:83 (computeProratedFantasyPoints)`; `web/lib/projectionsConfig/proration.ts:62 getProratedStat`; `web/lib/projectionsConfig/proration.ts:83 computeProratedFantasyPoints`
- **Tags (heuristic):** denominators: shots on goal; generation: development, current
- **Opus view (DRF-040):**
  - Method: For skaters and PRORATABLE_SKATER_STAT_KEYS (G, A, P, SOG, HIT, BLK, FOW, FOL, PIM, PPG, PPA, PPP, SHG, SHA, SHP): prorated = raw / projectedGP * 84 (NHL_REGULAR_SEASON_GAMES=84). FP = sum over scoring keys (HITS_D/BLOCKED_SHOTS_D position-specific values via pointValueForPlayerStat) of prorated*weight. Goalies, +/-, TOI and rate stats never prorated.
  - Inputs/units: season totals and projected GP (games); sources: in-memory projections
  - Output scale: fantasy points (season, 84-game pace); writes: —
  - Status: live — opt-in toggle 'projections.prorate84' in Draft Dashboard
  - Consumers: buildPlayerValues (prorate84); tierDashboardAdapter; ProjectionsTable display
- **Codex view (roster-skater-season-proration, calculation, location; Codex family 'draft-projections'):** 84-game skater pace and prorated fantasy points
  - Purpose: Eligible counting stat→raw/GP×84; exclude goalie, +/- and time/rate stats. Re-score prorated supported counts with authoritative or merged scoring map.
  - Inputs/units: Projected count stats, projected GP, scoring points/stat and enabled flag.
  - Output scale: Projected 84-game counting pace and fantasy points.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (web-lib-projectionsconfig-proration-computeproratedfantasypoints, calculation, location; Codex family 'Fantasy scoring and display pacing'):** Prorated fantasy total (computeProratedFantasyPoints)
  - Purpose: Sum optionally paced category × resolved default/custom/position-specific weight; omitted authoritative categories zero.
  - Inputs/units: Named model/observation inputs at cited declaration; Fantasy points or null. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Fantasy points or null.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projectionsconfig-proration-getproratedstat, calculation, location; Codex family 'Fantasy scoring and display pacing'):** 84-game skater proration (getProratedStat)
  - Purpose: Eligible projected counting stat / projected GP ×84; bypass goalie/rate/noneligible stats.
  - Inputs/units: Named model/observation inputs at cited declaration; 84-game paced counting stat; original source unchanged. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: 84-game paced counting stat; original source unchanged.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): web/lib/projectionsConfig/proration.ts:1-4 'Helpers for full-season pacing (proration) of skater counting stats.'; :61 'Return (raw / GP) * season games for eligible skater counting stats.'
  - Intended contract (Codex roster-skater-season-proration): Optional comparison value transformation; preserves original projections. NHL_REGULAR_SEASON_GAMES=84. Source: web/lib/projectionsConfig/proration.ts:62 getProratedStat.
  - Intended contract (Codex web-lib-projectionsconfig-proration-computeproratedfantasypoints): {"source": "web/lib/projectionsConfig/proration.ts:83", "explicit_comment": "Compute fantasy points total using (optionally) prorated counting stats.", "arithmetic_locations": ["web/lib/projectionsConfig/proration.ts:112 total += val * weight;"]}
  - Intended contract (Codex web-lib-projectionsconfig-proration-getproratedstat): {"source": "web/lib/projectionsConfig/proration.ts:62", "explicit_comment": "Return (raw / GP) * season games for eligible skater counting stats.", "arithmetic_locations": ["web/lib/projectionsConfig/proration.ts:79 return (raw / gp) * NHL_REGULAR_SEASON_GAMES;", "web/lib/projectionsConfig/proration.ts:82 /** Compute fantasy points total using (optionally) prorated counting stats. */"]}
  - External references: Full-season pace normalization (rate x games); compare with games-played risk adjustment conventions
  - Fixtures/test data: none listed
  - Tests: `web/lib/draftDashboard/fantasyPointRecalculation.test.ts`; `web/lib/draftDashboard/positionalTiers.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/fantasyPointRecalculation.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["web/lib/draftDashboard/fantasyPointRecalculation.test.ts:3"]}`
- **Leads (not audited):**
  - (opus) pacing a 30-GP projection to 84 assumes full health and removes injury/role risk entirely
  - (opus) 84-game constant hard-coded (correct only for seasons with an 84-game schedule)
  - (codex:roster-skater-season-proration) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:web-lib-projectionsconfig-proration-computeproratedfantasypoints) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projectionsconfig-proration-getproratedstat) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-DRF-033 calculateCategoryScores: weighted category z-score composite with goalie rate shrinkage

- **Match:** Both; Opus DRF-041; Codex roster-category-zscore, roster-goalie-rate-shrink
- **Purpose:** Convert projected category stats to one comparable value for categories leagues.
- **Where:** `web/lib/scoring/categoryScores.ts:84 (calculateCategoryScores)`; `web/lib/scoring/categoryScores.ts:67 (regressedGoalieRate)`; `web/lib/scoring/categoryScores.ts:54 (standardDeviation)`; `web/lib/scoring/categoryScores.ts:84 calculateCategoryScores`; `web/lib/scoring/categoryScores.ts:54 standardDeviation`; `web/lib/scoring/categoryScores.ts:67 regressedGoalieRate`
- **Tags (heuristic):** denominators: per 60; generation: development, current
- **Opus view (DRF-041):**
  - Method: Per role (skater/goalie) and category: mean and SAMPLE std dev (n-1) over every player in the supplied pool with a finite value. Goalie SV% shrunk: (SA*sv + 1200*mean)/(SA+1200) (PRIOR_SHOTS=1200); GAA shrunk: (GS*gaa + 25*mean)/(GS+25) (PRIOR_STARTS=25). z = (value-mean)/sd, inverted for GAA, GOALS_AGAINST_GOALIE, LOSSES_GOALIE. Score = sum weight_k * z_k (weight defaults to 1 if non-finite). GAMES_PLAYED and TOTAL_TOI apply to both roles. Categories with sd=0 or missing values contribute 0.
  - Inputs/units: projected season totals; SV% fraction 0-1; GAA goals/60; sources: in-memory projections (see buildPlayerValues)
  - Output scale: dimensionless weighted z-score sum (unbounded, ~0 mean); writes: —
  - Status: live — categories leagues in Draft Dashboard, Draft Pro recommendations, mock drafts
  - Consumers: buildPlayerValues; lib/draft-pro/recommendations.ts (per-category scores); lib/mockDraft/adapter.ts (per-category values)
- **Codex view (roster-category-zscore, calculation, location; Codex family 'draft-scoring'):** Role-specific weighted category z-score sum
  - Purpose: Compute per-role/category mean and sample SD (n−1); directional z=(value−mean)/SD, reversed for GAA/GA/losses; sum category weight×z. Skip missing/zero-SD categories.
  - Inputs/units: Skater/goalie projected category values in native units, enabled category weights.
  - Output scale: Dimensionless weighted z-sum, unbounded signed.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-goalie-rate-shrink, calculation, location; Codex family 'draft-scoring'):** Workload-regressed goalie SV% and GAA
  - Purpose: Regress SV% toward role population mean using 1200 prior shots, GAA using 25 prior starts: (workload×rate+prior×mean)/(workload+prior).
  - Inputs/units: Saves percentage fraction, goals/60 GAA, shots-against or starts counts, role mean.
  - Output scale: Same rate units as input; used inside category z-scoring.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in code; tasks/draft-dashboard-youtube-outline.md:108-112 says 'The current VORP value calculation uses a weighted standardized score'
  - Intended contract (Codex roster-category-zscore): Default six skater categories only when weight map empty; role applicability separates goalie/skater populations. Source: web/lib/scoring/categoryScores.ts:84 calculateCategoryScores.
  - Intended contract (Codex roster-goalie-rate-shrink): Raw population SD remains the normalization denominator; workload regression is applied only to goalie rate values. Source: web/lib/scoring/categoryScores.ts:67 regressedGoalieRate.
  - External references: Standard z-score category valuation (e.g. Razzball/FanGraphs z-score method); SGP (standings gain points) as alternative; Tango-style regression to mean for rate stats
  - Fixtures/test data: none listed
  - Tests: `web/lib/scoring/categoryScores.test.ts`; `{"discovered_not_run": ["web/lib/scoring/categoryScores.test.ts", "web/lib/sustainability/features.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/scoring/categoryScores.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) mean/sd computed over the ENTIRE projection pool, not the draftable top-N (standard z-score methods recompute on the replacement-level pool) - deep pools compress top-player z gaps
  - (opus) goalie rates are shrunk toward the mean AFTER mean/sd are computed from unshrunk values, so shrunk rates' z-scores are understated
  - (opus) rate categories (SV%, GAA) are not volume-weighted beyond shrinkage; a 10-start goalie with elite SV% scores close to a 60-start goalie
  - (opus) PRIOR_SHOTS=1200, PRIOR_STARTS=25 magic constants
  - (opus) skater rate categories (e.g. SHOOTING_PERCENTAGE, FACEOFF_PERCENTAGE) get no shrinkage
  - (codex:roster-category-zscore) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-goalie-rate-shrink) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-034 Mock draft roster feasibility (Dinic max-flow)

- **Match:** Both; Opus DRF-042; Codex roster-mock-feasibility
- **Purpose:** Check that every team can still fill all roster slots from held plus remaining players, so the bot or user pick never makes the draft infeasible.
- **Where:** `web/lib/mockDraft/feasibility.ts:5 (feasibleRosters)`; `web/lib/mockDraft/engine.ts:121 (canComplete)`; `web/lib/mockDraft/engine.ts:353 (feasibility may force pick outside reach window)`; `web/lib/mockDraft/engine.ts:92 allocate`; `web/lib/mockDraft/engine.ts:121 canComplete`; `web/lib/mockDraft/feasibility.ts:5 feasibleRosters`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-042):**
  - Method: Quick reject if held + available < teamCount × slots. Flow network: source → player groups (key = seat + sorted positions, capacity = group count) → (seat, slot type) nodes (capacity = slot count) → sink. Held groups connect only to their own seat; free players (seat −1) connect to any seat. Dinic max-flow (BFS levels plus DFS augment). Held players must all route (flow = held count); then free players are added to the residual graph and total flow must equal teamCount × slots.
  - Inputs/units: counts; sources: in-memory MockSession (players frozen by mockDraft/adapter freezePlayers)
  - Output scale: boolean; writes: —
  - Status: live — mock drafts (lib/mockDraft/flags.ts gates)
  - Consumers: mock draft engine decide()/canComplete (bot picks and user pick validation)
- **Codex view (roster-mock-feasibility, calculation, location; Codex family 'Mock draft'):** Roster allocation and full-draft completion feasibility
  - Purpose: Augmenting-path assignment respects multi-position eligibility; prospective bot picks require enough distinct remaining players to fill all teams slots via full-room maximum flow.
  - Inputs/units: Player eligibility, grouped roster slots and already selected/remaining players for every seat.
  - Output scale: Slot allocation, filled slot count and completion-feasibility boolean.
  - Version/status: Local mock engine. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): feasibility.ts:4 comment: capacity matching groups interchangeable players and slots to keep 40-team drafts bounded; engine.ts:120 comment: all held players must remain assigned
  - Intended contract (Codex roster-mock-feasibility): Mock engine comments and full-room feasibility helper. No fantasy value inferred from assignment alone. Source: web/lib/mockDraft/engine.ts:92 allocate.
  - External references: Bipartite matching / max-flow (Dinic)
  - Fixtures/test data: none listed
  - Tests: `web/lib/mockDraft/engine.test.ts`; `{"discovered_not_run": ["web/hooks/useMockDraft.test.ts", "web/lib/mockDraft/engine.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) grouping by sorted positions assumes fits() depends only on positions; any fits rule using other player fields (e.g. goalie flags) would be wrong for grouped players
  - (codex:roster-mock-feasibility) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-035 Projection source weight slider rebalancing

- **Match:** Opus only; Opus DRF-003; Codex —
- **Purpose:** When a user sets one source's share, rescales the other selected sources so shares still sum to 1.
- **Where:** `web/components/DraftDashboard/ProjectionSourceSettings.tsx:46 (changeWeight)`; `web/components/DraftDashboard/ProjectionSourceSettings.tsx:114 (total share check)`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-003):**
  - Method: multipliers mode: weight = value. weights mode: normalizeSourceWeights; target = clamp(value/100, 0, 1); others scaled to (1-target) * w/sum(others) (equal split 1/k if sum 0). Displayed total = round(sum(shares)*100).
  - Inputs/units: percent 0-100; sources: user draft settings
  - Output scale: weights summing to 1; writes: —
  - Status: live — draft dashboard settings
  - Consumers: DraftDashboard / DraftSettings -> calculateWeightedProjection (DRF-025)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/DraftSettingsShell.test.tsx`
- **Leads (not audited):**
  - (opus) if the edited source is the only selected one, its weight is set to target <1 and shares no longer sum to 1
  - (opus) two modes (multipliers vs normalized shares) share one weight field

## M-DRF-036 Projection source-weight sanitization and legacy percent-weight migration

- **Match:** Opus only; Opus DRF-004; Codex —
- **Purpose:** Clamp and persist per-source projection blend weights (skater/goalie) and migrate v2/v3 saved weights into the v4 0..2 multiplier scale.
- **Where:** `web/lib/draftDashboard/sourceControlPreferences.ts:34 (clampWeight)`; `web/lib/draftDashboard/sourceControlPreferences.ts:40 (sanitizeControls)`; `web/lib/draftDashboard/sourceControlPreferences.ts:71 (legacyArrayToMap)`; `web/lib/draftDashboard/settingsValidation.ts:225-240 (multiplier range check and share total %)`
- **Tags (heuristic):** generation: development, current
- **Opus view (DRF-004):**
  - Method: clampWeight: non-finite weight becomes 1, otherwise clamp to [0,2] and round to 3 decimals. Sources with no saved value get the default {isSelected: defaultSelected, weight 1}, and custom sources default to selected with weight 1. Legacy migration: if any legacy weight is above 2, the array is treated as percent style and each selected weight becomes raw/sum(selected raw), so 50/30/20 becomes 0.5/0.3/0.2. Otherwise raw weights are kept. The same migrated map is applied to both the skater and goalie groups. Validation flags any weight outside [0,2], then returns round(sum(effective shares)*100) as the share total.
  - Inputs/units: dimensionless multipliers (v4) or legacy percents (0-100); sources: browser localStorage draft.sourceControls.v4 / v3 / v2, lib/projectionsConfig/projectionSourcesConfig (static)
  - Output scale: weight multiplier 0..2, 3 decimals; share total percent 0..100; writes: browser localStorage draft.sourceControls.v4
  - Status: live — loaded by the draft dashboard source settings (localStorage)
  - Consumers: calculateWeightedProjection / getEffectiveSourceShares (sourceWeights.ts); DraftDashboard settings; draft-pro savedDrafts schema (weight 0..2)
- **Audit context:**
  - Intent (Opus): web/lib/draftDashboard/sourceControlPreferences.ts:130 comment: invalid preferences fail closed to the official-source defaults; otherwise UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: `web/lib/draftDashboard/sourceControlPreferences.test.ts`
  - Tests: `web/lib/draftDashboard/sourceControlPreferences.test.ts`; `web/lib/draftDashboard/sourceWeights.test.ts`
- **Leads (not audited):**
  - (opus) migrated percent-style weights become fractions (sum 1) while any default-selected source missing from the legacy payload gets weight 1, so the new source can take a much larger share than intended (e.g. ~3x a migrated 0.33 source)
  - (opus) percent-style detection relies on 'any weight > 2'; a legacy percent payload with all values <= 2 is kept raw
  - (opus) one legacy array is mapped onto both skater and goalie controls
  - (opus) the 0..2 clamp is duplicated in useProjectionSourceAnalysis.ts:84, settingsValidation.ts and the draft-pro savedDrafts zod schema

## M-DRF-037 Social share rostered-% movers (Yahoo ownership pp change)

- **Match:** Opus only; Opus DRF-005; Codex —
- **Purpose:** Rank players by percentage-point change in Yahoo rostered % between the latest observation and one on/before 5 days earlier.
- **Where:** `web/lib/socialShare/trends.ts:231-247 (trendShortlists movers)`; `web/lib/socialShare/trends.ts:74-85 (MOVER_WINDOW_DAYS=5, MIN_MOVER_POINTS=1, MOVER_CANDIDATES=30, OWNERSHIP_MAX_AGE_DAYS=1)`; `web/lib/socialShare/trends.ts:283 (ownershipSeriesDates)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (DRF-005):**
  - Method: latestDate = newest ownership date; previousDate = newest date <= latestDate - 5 days. Values must be 0..100. Both rounded to 0.1 before differencing; delta = latest - previous (0.1). Keep \|delta\| >= 1 pp; missing previous observation = no mover (not 0%). Risers delta desc then latest desc; fallers mirror; top 30 candidates mapped to exactly one NHL id with a current rolling row; 5 shown. Section stale if latest date older than yesterday (NY).
  - Inputs/units: percent 0-100; sources: yahoo ownership timeline rows, yahoo_nhl_player_map, rolling_player_game_metrics
  - Output scale: percentage points (0.1 resolution); writes: —
  - Status: live — social-share edition trend layer (movers section)
  - Consumers: web/lib/socialShare/server.ts (Tuesday trend layer of the social-share edition); web/components/SocialShare/SocialShare.tsx (Hot/Cold, Deployment, Rate, Movers cards)
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/trends.ts:231 comment and trendDefinitions trends.ts:482 ('No observation != 0% · not add/drop counts')
  - External references: none suggested
  - Fixtures/test data: `web/lib/socialShare/trendsFixture.ts (ownership series)`
  - Tests: `web/components/SocialShare/SocialShare.test.tsx`; `web/e2e/social-share.spec.ts`; `web/lib/socialShare/trendSources.test.ts`; `web/lib/socialShare/trends.test.ts`
- **Leads (not audited):**
  - (opus) duplicate implementation of Ownership / ADP trend movement (FSC-021, web/pages/api/v1/transactions/ownership-trends.ts calculateTrendMovement) with a different window anchor (latest observation date - 5 days vs today UTC - window)
  - (opus) rounding to 0.1 before differencing can move a 0.95 pp change across the 1 pp threshold

## M-DRF-038 Legacy projections page: projection-vs-actual diff% colour bands, ADP round buckets and source weight floor

- **Match:** Opus only; Opus DRF-007; Codex —
- **Purpose:** Colour-code fantasy-point projection misses, bucket players into draft rounds for the round box plot, and bound user source weights.
- **Where:** `web/pages/projections/index.tsx:815-850 (diff% cell bands)`; `web/pages/projections/index.tsx:1160 (round = ceil(yahooAvgPick/12), rounds <= 15)`; `web/pages/projections/index.tsx:1173-1235 (box-plot series by round / position, excluding +/-99999 sentinels)`; `web/pages/projections/index.tsx:1302 (handleSourceWeightChange floor 0.1)`
- **Tags (heuristic):** generation: legacy
- **Opus view (DRF-007):**
  - Method: Diff% bands: >0 and <=10 light positive, <=25 positive, >25 strong; mirrored for negatives; 99999/-99999 sentinels shown as '++'/'--' and excluded from box plots. Draft round = ceil(ADP/12) (assumes 12-team league), only rounds 1-15 plotted, plus an 'All Drafted' series; fallback groups by first listed position. Source weight = max(0.1, input).
  - Inputs/units: percent difference; ADP pick number; sources: projection source tables + yahoo players via hooks/useProcessedProjectionsData
  - Output scale: categorical colour bands; round 1..15; writes: —
  - Status: legacy/dead — page renders LegacySurfaceNotice
  - Consumers: /projections legacy page table and RoundPerformanceBoxPlotChart; DRF-025 calculateWeightedProjection (weights)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) round = ceil(ADP/12) hard-codes a 12-team league regardless of the user's league size
  - (opus) +/-99999 sentinel values for infinite diff% leak into the column sort order
  - (opus) 10/25% colour cutoffs are magic numbers (related to DRF-012 diff% computation)

## M-DRF-039 ComparePlayersModal percentiles and per-game rates

- **Match:** Opus only; Opus DRF-009; Codex —
- **Purpose:** Head-to-head player comparison radar.
- **Where:** `web/components/DraftDashboard/ComparePlayersModal.tsx:139 (percentile)`; `web/components/DraftDashboard/ComparePlayersModal.tsx:170-176 (average percentile)`; `web/components/DraftDashboard/ComparePlayersModal.tsx:179-214 (per-game rates)`; `web/components/DraftDashboard/ComparePlayersModal.tsx:301 (share)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (DRF-009):**
  - Method: Percentile = (index of first value >= x + 1)/n*100 over all players' projected values (ties take lowest rank), inverted 100-p for lower-better; missing -> 50. Average percentile per player; share = avg/(sum avgs)*100. Per-game = stat/projected GP for non-percentage stats.
  - Inputs/units: projected totals; sources: in-memory projections
  - Output scale: percentile 0-100; writes: —
  - Status: live
  - Consumers: Draft Dashboard compare modal
- **Audit context:**
  - Intent (Opus): web/components/DraftDashboard/ComparePlayersModal.tsx:128 'Build percentiles across allPlayers for fairness'
  - External references: Percentile rank conventions (mid-rank for ties)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/ComparePlayersModal.test.tsx`
- **Leads (not audited):**
  - (opus) tie handling gives the lowest rank among ties (not mid-rank); missing stat imputed as 50th percentile
  - (opus) pool mixes skaters and goalies for shared stats

## M-DRF-040 CSV import name fuzzy match (Levenshtein similarity)

- **Match:** Opus only; Opus DRF-010; Codex —
- **Purpose:** Match imported projection names to players.
- **Where:** `web/components/DraftDashboard/ImportCsvModal.tsx:130-145 (levenshtein)`; `web/components/DraftDashboard/ImportCsvModal.tsx:1034-1040 (score)`; `web/components/DraftDashboard/ImportCsvModal.tsx:893 (coverage threshold)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (DRF-010):**
  - Method: score = 1 - levenshtein/maxLen; coverage = resolved/total compared to user min coverage %.
  - Inputs/units: strings; sources: players table / projection pool
  - Output scale: 0-1; writes: —
  - Status: live
  - Consumers: custom CSV source import
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Levenshtein / Jaro-Winkler name matching
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/ImportCsvModal.test.tsx`

## M-DRF-041 freezePlayers (mock draft adapter): per-category values, goalie workload

- **Match:** Opus only; Opus DRF-030; Codex —
- **Purpose:** Freeze a mock-draft player pool with values, per-category values and goalie workload.
- **Where:** `web/lib/mockDraft/adapter.ts:11 (freezePlayers)`; `web/lib/mockDraft/adapter.ts:81 (dashboardView projectedPoints)`
- **Tags (heuristic):** generation: current
- **Opus view (DRF-030):**
  - Method: value = buildPlayerValues value; categories: separate calculateCategoryScores run per nonzero category {k: w}; workload = first of GAMES_STARTED/STARTS_GOALIE/GAMES_STARTED_GOALIE else GAMES_GOALIE/GAMES_PLAYED_GOALIE/GP_GOALIE; adp = yahooAvgPick if >0. dashboardView projectedPoints = sum player.value.
  - Inputs/units: FP/z units; starts or games; sources: projection source tables configured in lib/projectionsConfig/projectionSourcesConfig.ts (e.g. projections_* per source), yahoo_players (average_draft_pick, percent_drafted, eligible_positions), yahoo_nhl_player_map / yahoo player map, current-season actual stats tables (ACTUAL_STATS_COLUMN_MAP)
  - Output scale: value units; writes: —
  - Status: live
  - Consumers: mock engine; MockDraftWorkspace
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/mockDraft/engine.test.ts`
- **Leads (not audited):**
  - (opus) dashboardView labels sum of category z-values as 'projectedPoints' in categories leagues

## M-DRF-042 SuggestedPicks free-path risk boost and sort keys

- **Match:** Opus only; Opus DRF-033; Codex —
- **Purpose:** Re-score free recommendations by availability risk and provide sort keys.
- **Where:** `web/components/DraftDashboard/SuggestedPicks.tsx:405-414 (riskBoost)`; `web/components/DraftDashboard/SuggestedPicks.tsx:495-540 (sort)`
- **Tags (heuristic):** generation: current
- **Opus view (DRF-033):**
  - Method: Free path only (not remote Pro results): score += 0.25*(1-availability)*max(0,VBD). Sorts: rank score, personal rank, projected FP, VORP, VBD, ADP, availability, fit.
  - Inputs/units: rank units; availability 0-1; sources: in-memory
  - Output scale: rank units; writes: —
  - Status: live
  - Consumers: Suggested Picks cards
- **Audit context:**
  - Intent (Opus): web/components/DraftDashboard/SuggestedPicks.tsx:408-409 'Preserve the established free rank ordering while using the shared availability estimate'
  - External references: Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx`; `web/e2e/draft-layout.spec.ts`
- **Leads (not audited):**
  - (opus) free and Pro paths rank differently (Pro path omits the riskBoost) for the same inputs

## M-DRF-043 Goalie sample standard deviation

- **Match:** Codex only; Opus —; Codex core-334
- **Purpose:** Calculate goalie sample standard deviation.
- **Where:** `web/components/GoaliePage/goalieCalculations.ts:146 calculateStandardDeviation`
- **Codex view (core-334, calculation; Codex family 'goalie value UI'):** Goalie sample standard deviation
  - Formula: sqrt(sum((x-mean)^2)/(n-1)); n<2 gives 0.
  - Purpose: Calculate goalie sample standard deviation.
  - Inputs/units: Weekly quality points or game fantasy scores.
  - Output scale: Sample SD, despite some consumer field names saying variance.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["Associated UI components; complete runtime consumer graph not traced."]
- **Audit context:**
  - Intended contract (Codex core-334): Source types and implementation in web/components/GoaliePage/goalieCalculations.ts:146; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/GoaliePage/goalieCalculations.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-334) ["Inventory only; no correctness verdict."]

## M-DRF-044 Community evidence bands and public top-250 admission

- **Match:** Codex only; Opus —; Codex roster-community-evidence
- **Purpose:** Emerging requires users>=5, comparisons>=10, opponents>=5. Established requires 20/40/10 plus >=2 opponents ranked 200..250 and >=2 ranked 251..300. Until established, market top250 remains market-seeded; community admission requires established and conservative rank<=250.
- **Where:** `web/lib/draft-ranker/communityModel.ts:342 [inline calculation: Community evidence bands and public top-250 admission]`; `web/lib/draft-ranker/communityModel.ts:387 [inline calculation: Community evidence bands and public top-250 admission]`
- **Tags (heuristic):** generation: current
- **Codex view (roster-community-evidence, calculation; Codex family 'Draft ranking and discovery'):** Community evidence bands and public top-250 admission
  - Purpose: Emerging requires users>=5, comparisons>=10, opponents>=5. Established requires 20/40/10 plus >=2 opponents ranked 200..250 and >=2 ranked 251..300. Until established, market top250 remains market-seeded; community admission requires established and conservative rank<=250.
  - Inputs/units: Counts of eligible independent comparisons/opponents, market rank, model/conservative rank.
  - Output scale: Evidence state market_seeded/building/emerging/established, confidence label, public-display and top250 eligibility booleans, admission basis.
  - Version/status: regularized-bradley-terry-v1. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
  - Consumers: ["Internal helper in implementation file; no separate non-test consumer identified by bounded reference search."]
- **Audit context:**
  - Intended contract (Codex roster-community-evidence): Exported DRAFT_RANKER_COMMUNITY_THRESHOLDS and returned labels are the source contract. Source: web/lib/draft-ranker/communityModel.ts:342.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/draft-ranker/communityModel.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-community-evidence) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-045 Sparse-order integrity counts and health status

- **Match:** Codex only; Opus —; Codex roster-draft-order-health
- **Purpose:** Sorts order keys, computes min/max/minimum adjacent gap, duplicate/non-increasing/unsafe counts, recommends normalization if any invalidity or gap<=1. Flags nonempty<250 entries. Overall blocked/attention/healthy derives from order and pending-evidence checks.
- **Where:** `web/lib/draft-ranker/health.ts:15 analyzeDraftRankingOrdering`; `web/lib/draft-ranker/health.ts:52 summarizeDraftRankerHealth`
- **Tags (heuristic):** generation: current
- **Codex view (roster-draft-order-health, calculation; Codex family 'Draft ranking operations'):** Sparse-order integrity counts and health status
  - Purpose: Sorts order keys, computes min/max/minimum adjacent gap, duplicate/non-increasing/unsafe counts, recommends normalization if any invalidity or gap<=1. Flags nonempty<250 entries. Overall blocked/attention/healthy derives from order and pending-evidence checks.
  - Inputs/units: Numeric sparse order keys, entry counts, lock revision and operational pending counts/flags.
  - Output scale: Counts, key gap, booleans and health status. Not a player ranking score.
  - Version/status: No model version; diagnostic helper. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/lib/draft-ranker/healthServer.ts:15", "Static import/symbol reference (navigation hint, not a verified call edge): web/pages/api/v1/db/draft-ranker-health.ts:13"]
- **Audit context:**
  - Intended contract (Codex roster-draft-order-health): Function types and explicit boolean conditions. Source: web/lib/draft-ranker/health.ts:15 analyzeDraftRankingOrdering.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/draft-ranker/health.test.ts", "web/__tests__/pages/api/v1/db/draft-ranker-health.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-draft-order-health) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-046 Grouped roster assignment and forward-capacity redistribution

- **Match:** Codex only; Opus —; Codex roster-draft-roster-allocation
- **Purpose:** Build position value pools; assign compatible roster slots with overrides and reassignment; distribute changed total forward count proportionally by largest fractional remainder.
- **Where:** `web/lib/draftDashboard/forwardGrouping.ts:160 allocateGroupedRosterSlots`; `web/lib/draftDashboard/forwardGrouping.ts:102 setForwardRosterTotal`; `web/lib/draftDashboard/forwardGrouping.ts:133 buildPositionPools`
- **Tags (heuristic):** generation: current
- **Codex view (roster-draft-roster-allocation, calculation; Codex family 'draft-logistics'):** Grouped roster assignment and forward-capacity redistribution
  - Purpose: Build position value pools; assign compatible roster slots with overrides and reassignment; distribute changed total forward count proportionally by largest fractional remainder.
  - Inputs/units: Eligibility, split/FWD grouping, roster slots, player values and overrides.
  - Output scale: Assigned slot counts/bench, sorted position pools, integer forward slot counts.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/lib/draftDashboard/settingsValidation.ts:7", "Static import/symbol reference (navigation hint, not a verified call edge): web/lib/draft-pro/scenarioDashboardAdapter.ts:3", "Static import/symbol reference (navigation hint, not a verified call edge): web/lib/draft-pro/reportDashboardAdapter.ts:3", "Static import/symbo…
- **Audit context:**
  - Intended contract (Codex roster-draft-roster-allocation): Dashboard allocation helper distinct from RSO min-cost flow and mock-draft whole-room max-flow. Source: web/lib/draftDashboard/forwardGrouping.ts:160 allocateGroupedRosterSlots.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/draftDashboard/forwardGrouping.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-draft-roster-allocation) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-047 Draft player search similarity

- **Match:** Codex only; Opus —; Codex roster-draft-search-similarity
- **Purpose:** Normalizes names using lower/unaccent, computes pg_trgm similarity against canonical name and aliases, takes strongest match and prioritizes exact/prefix matches with canonical similarity cutoff .25.
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:4373 [inline calculation: Draft player search similarity]`
- **Tags (heuristic):** generation: current
- **Codex view (roster-draft-search-similarity, calculation; Codex family 'Draft ranking operations'):** Draft player search similarity
  - Purpose: Normalizes names using lower/unaccent, computes pg_trgm similarity against canonical name and aliases, takes strongest match and prioritizes exact/prefix matches with canonical similarity cutoff .25.
  - Inputs/units: Name query and canonical/alias strings.
  - Output scale: Search relevance similarity 0..1 plus ordered identity candidates.
  - Version/status: Checked-in SQL baseline only; not executed. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
  - Consumers: ["Internal helper in implementation file; no separate non-test consumer identified by bounded reference search."]
- **Audit context:**
  - Intended contract (Codex roster-draft-search-similarity): search_fhfh_draft_players SQL query; identity-search score, not hockey value. Source: supabase/migrations/20260716112908_production_schema_baseline.sql:4373.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": [], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-draft-search-similarity) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-048 Assigned-roster fill, vacancy and pick-window progress

- **Match:** Codex only; Opus —; Codex roster-god-view-roster-progress
- **Purpose:** Counts assigned players once per slot; open=max(0,capacity-filled), over=max(0,filled-capacity), fill fraction=min(1,filled/capacity), with zero-capacity fallback. Sorts top3 vacancies with required slots before UTIL/bench. Enumerates actionable pick offsets using ownership/keeper rules.
- **Where:** `web/lib/draftDashboard/godView.ts:31 godViewRosterProgress`; `web/lib/draftDashboard/godView.ts:46 godViewRosterNeeds`; `web/lib/draftDashboard/godView.ts:55 selectMyPickWindows`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Codex view (roster-god-view-roster-progress, calculation; Codex family 'draft-summary'):** Assigned-roster fill, vacancy and pick-window progress
  - Purpose: Counts assigned players once per slot; open=max(0,capacity-filled), over=max(0,filled-capacity), fill fraction=min(1,filled/capacity), with zero-capacity fallback. Sorts top3 vacancies with required slots before UTIL/bench. Enumerates actionable pick offsets using ownership/keeper rules.
  - Inputs/units: Assigned roster slots and capacity counts; draft order/ownership, completed picks and keepers.
  - Output scale: Fill/open/over counts, fraction0..1, vacancy ordering and future selectable-pick offsets.
  - Version/status: Local dashboard presentation helpers. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/components/DraftDashboard/SuggestedPicks.tsx:12", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/DraftDashboard/DraftDashboard.tsx:51", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/DraftDashboard/GodView.tsx:3"]
- **Audit context:**
  - Intended contract (Codex roster-god-view-roster-progress): Source explicitly reads assigned slots rather than overlapping eligibility; offsets count selectable picks, not simulated selections. Source: web/lib/draftDashboard/godView.ts:31 godViewRosterProgress.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/draftDashboard/godView.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-god-view-roster-progress) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-049 Mock personality and research adjustments

- **Match:** Codex only; Opus —; Codex roster-mock-personality
- **Purpose:** Applies ZeroG/FadeG progress penalties, reach/star scarcity bonuses, HeroG workload bonus and BPA preference. Research contrarian adjustment=(positive?.4:0)-(fade?.6:bust?.3:0), times confidence high1/medium.7/low.4.
- **Where:** `web/lib/mockDraft/engine.ts:297 [inline calculation: Mock personality and research adjustments]`; `web/lib/mockDraft/research.ts:92 contrarianAdjustment`
- **Tags (heuristic):** generation: research, development, current
- **Codex view (roster-mock-personality, calculation; Codex family 'Mock draft'):** Mock personality and research adjustments
  - Purpose: Applies ZeroG/FadeG progress penalties, reach/star scarcity bonuses, HeroG workload bonus and BPA preference. Research contrarian adjustment=(positive?.4:0)-(fade?.6:bust?.3:0), times confidence high1/medium.7/low.4.
  - Inputs/units: Personality, draft progress fraction, candidate role/value/scarcity/workload, reviewed research labels and confidence.
  - Output scale: Dimensionless additive utility adjustment.
  - Version/status: Local mock-draft/research configuration. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/hooks/useMockDraft.ts:10", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/DraftDashboard/MockDraftWorkspace.tsx:15"]
- **Audit context:**
  - Intended contract (Codex roster-mock-personality): Explicit personality branches and contrarianAdjustment source. Research eligibility governed by season/schema, not inferred from existence. Source: web/lib/mockDraft/engine.ts:297.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/hooks/useMockDraft.test.ts", "web/lib/mockDraft/engine.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-mock-personality) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-050 Mock lookahead and stochastic choice

- **Match:** Codex only; Opus —; Codex roster-mock-selection-softmax
- **Purpose:** At a Pro turn with zero intervening picks, adds 0.3 times the best following candidate score plus its 0.35 open-slot fit bonus. Draws from exp((score-maxScore)/temperature) over a bounded feasible shortlist. Temperature is 0.08 for Vanilla/BPA; otherwise (0.22 aggressive or 0.13 other)+0.04*variation.
- **Where:** `web/lib/mockDraft/engine.ts:367 [inline calculation: Mock lookahead and stochastic choice]`; `web/lib/mockDraft/engine.ts:389 [inline calculation: Mock lookahead and stochastic choice]`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Codex view (roster-mock-selection-softmax, calculation; Codex family 'Mock draft'):** Mock lookahead and stochastic choice
  - Purpose: At a Pro turn with zero intervening picks, adds 0.3 times the best following candidate score plus its 0.35 open-slot fit bonus. Draws from exp((score-maxScore)/temperature) over a bounded feasible shortlist. Temperature is 0.08 for Vanilla/BPA; otherwise (0.22 aggressive or 0.13 other)+0.04*variation.
  - Inputs/units: Candidate utilities, future available candidates, roster needs, personality/variation and seeded random draw.
  - Output scale: Chosen player ID, reasons and shortlist scores; normalized softmax probabilities are implicit sampling weights, not returned.
  - Version/status: Local mock engine. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
  - Consumers: ["Static import/symbol reference (navigation hint, not a verified call edge): web/hooks/useMockDraft.ts:10", "Static import/symbol reference (navigation hint, not a verified call edge): web/components/DraftDashboard/MockDraftWorkspace.tsx:15"]
- **Audit context:**
  - Intended contract (Codex roster-mock-selection-softmax): decide implementation; probabilities model bot behavior, not real-player selection risk. Source: web/lib/mockDraft/engine.ts:367.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/hooks/useMockDraft.test.ts", "web/lib/mockDraft/engine.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-mock-selection-softmax) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-DRF-051 Player comparison radar percentile and mean

- **Match:** Codex only; Opus —; Codex roster-player-comparison-percentile
- **Purpose:** Across allPlayers, rank=first ascending value≥x index+1; percent=rank/n×100, reverse if lower-is-better; empty/missing50. Average displayed category percentiles per player.
- **Where:** `web/components/DraftDashboard/ComparePlayersModal.tsx:125 [inline calculation: Player comparison radar percentile and mean]`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Codex view (roster-player-comparison-percentile, calculation; Codex family 'draft-display'):** Player comparison radar percentile and mean
  - Purpose: Across allPlayers, rank=first ascending value≥x index+1; percent=rank/n×100, reverse if lower-is-better; empty/missing50. Average displayed category percentiles per player.
  - Inputs/units: Projected metric values, global comparison pool and direction metadata.
  - Output scale: Percentile0–100 and average0–100.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
  - Consumers: ["Internal helper in implementation file; no separate non-test consumer identified by bounded reference search."]
- **Audit context:**
  - Intended contract (Codex roster-player-comparison-percentile): Display normalization, not the category z-score or card midrank percentile. Source: web/components/DraftDashboard/ComparePlayersModal.tsx:125.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/__tests__/components/DraftDashboard/DraftRetention.test.tsx", "web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx", "web/__tests__/components/DraftDashboard/ComparePlayersModal.test.tsx", "web/__tests__/components/DraftDashboard/ProjectionsTable.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-player-comparison-percentile) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

