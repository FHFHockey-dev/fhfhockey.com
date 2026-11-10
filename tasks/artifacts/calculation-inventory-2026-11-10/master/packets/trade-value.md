# Audit packet: Trade value

Master entries M-TRD-001 to M-TRD-005 (5 of 5 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-TRD-001 | BLSH trade comparison: forecast league points per side (FHFH Standard… | Both | 0 | 3 |
| M-TRD-002 | Trade analyzer roster capacity and starting-slot coverage | Both | 0 | 3 |
| M-TRD-003 | Trade value components (projected league points, dated ADP; VOR/combi… | Both | 0 | 4 |
| M-TRD-004 | BLSH retrospective trade fallback (recorded FP per game) | Opus only | 0 | 2 |
| M-TRD-005 | Trade observation evidence selection (Yahoo trade market sightings) | Opus only | 0 | 0 |

## M-TRD-001 BLSH trade comparison: forecast league points per side (FHFH Standard or custom)

- **Match:** Both; Opus TRD-002; Codex core-027
- **Purpose:** Sum FORGE horizon forecasts under league scoring for give vs receive sides.
- **Where:** `web/lib/buyLowSellHigh/trade.ts:14 (FHFH_STANDARD_SCORING)`; `web/lib/buyLowSellHigh/trade.ts:21 (forecastQualification)`; `web/lib/buyLowSellHigh/trade.ts:63 (sumTarget)`; `web/lib/buyLowSellHigh/trade.ts:73 (sideValue)`; `web/lib/buyLowSellHigh/trade.ts:98 (playerPointsTotal)`; `web/lib/buyLowSellHigh/trade.ts:112 (compareTrade)`; `web/components/blshTrade/BlshTradeComparison.tsx:209 (verdict)`; `web/lib/buyLowSellHigh/trade.ts:112 compareTrade`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Opus view (TRD-002):**
  - Method: Points mode: side value = Σ_players Σ_targets weight*expected (FHFH: GOALS 3, ASSISTS 2, PP_POINTS 1, SOG 0.2, HITS 0.2, BLK 0.25); categories mode: Σ expected per category; goalie SV% = Σsaves/ΣSA, GAA = 60*ΣGA/Σminutes. net = receive − give; favourable = net>0 (or <0 for lower-is-better). Blocks on mixed horizons, mixed forecast issuances, expired/incomplete horizon, missing projections. Verdict text 'gain/give up about \|net\| league points'.
  - Inputs/units: expected counts over horizon; sources: Sko Element interpretation records (FORGE game expectations)
  - Output scale: fantasy points / category totals; writes: —
  - Status: live — pages/buy-low-sell-high/trade.tsx
  - Consumers: pages/buy-low-sell-high/trade.tsx via BlshTradeComparison
- **Codex view (core-027, calculation, location; Codex family 'BLSH interpretation'):** Trade side fantasy/category totals and net
  - Formula: Sum additive categories; combine goalie ratio primitives (not average ratios); receive-give.
  - Purpose: Compare projected production offered and received.
  - Inputs/units: Sko Element forecasts and league points/category weights.
  - Output scale: Give, receive, net per target; favorable direction respecting lower-is-better.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Local consumer UI is dirty; no claim of deployed change. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the f…
- **Audit context:**
  - Intent (Opus): trade.ts:1-5 header (FR-10..13 advisory only)
  - Intended contract (Codex core-027): No overall category winner without utility; uneven roster replacement effects omitted; experimental status retained.
  - External references: Standard fantasy points scoring
  - Fixtures/test data: `tasks/artifacts/blsh-trade-2026-11-04`
  - Tests: `Located only; not run for this inventory.`; `web/components/blshTrade/BlshTradeComparison.test.tsx`; `web/lib/buyLowSellHigh/trade.test.ts`
- **Leads (not audited):**
  - (opus) uneven roster sides allowed (non-blocking) with no replacement-level adjustment
  - (opus) no uncertainty range (FORGE expectations v1 supply none)
  - (codex:core-027) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-TRD-002 Trade analyzer roster capacity and starting-slot coverage

- **Match:** Both; Opus TRD-003; Codex roster-trade-capacity, roster-trade-slot-delta
- **Purpose:** Count roster sizes, required drops and filled/unfilled starting slots before/after a manual trade.
- **Where:** `web/lib/tradeAnalyzer/offer.ts:42 (previewOffer)`; `web/lib/tradeAnalyzer/slotFeasibility.ts:72 (slotFeasibility)`; `web/lib/tradeAnalyzer/offer.ts:42 previewOffer`; `web/lib/tradeAnalyzer/slotFeasibility.ts:72 slotFeasibility`
- **Tags (heuristic):** generation: current
- **Opus view (TRD-003):**
  - Method: beforeExcess=max(0,roster−cap); requiredDrops=max(0,afterExchange−cap); additionalDrops=max(0,after−cap). Slot coverage via rosterAutopsy analyzeRoster: filled=assignments, unfilled=totalSlots−filled, per-position filled/eligible before/after, unfilledChange. Valuation, impact, legality, acceptance explicitly unavailable.
  - Inputs/units: player counts; sources: —
  - Output scale: counts; writes: —
  - Status: live — pages/trade-analyzer.tsx
  - Consumers: pages/trade-analyzer.tsx (TradeAnalyzer)
- **Codex view (roster-trade-capacity, calculation, location; Codex family 'Trade and roster autopsy'):** Trade exchange roster size and required cuts
  - Purpose: Counts each team roster before/after player exchange, pre-existing over-capacity, resulting excess and minimum cuts max(0,postExchange-capacity), then after-cut capacity status.
  - Inputs/units: Two rosters, transferred player IDs/assets, roster capacities and selected drops.
  - Output scale: Player counts, excess/required-drop counts and preview availability.
  - Version/status: Manual offer preview; no trade-value formula or execution implied. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-trade-slot-delta, calculation, location; Codex family 'Trade and roster autopsy'):** Before/after trade active-slot coverage change
  - Purpose: Evaluates autopsy before/after each manual trade roster, counts covered/unfilled active slots and reports after-minus-before unfilled change, with unresolved-input blockers.
  - Inputs/units: Offer preview rosters plus each side active-slot counts/eligibility.
  - Output scale: Per-team structural coverage counts and signed unfilled-slot delta.
  - Version/status: Local trade analyzer preview. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): offer.ts:41 'Applies only an entered exchange and explicit drops. No slot solver or valuation.'
  - Intended contract (Codex roster-trade-capacity): Offer preview source/types; picks/assets do not stand in for roster players. Source: web/lib/tradeAnalyzer/offer.ts:42 previewOffer.
  - Intended contract (Codex roster-trade-slot-delta): Slot feasibility source states roster structure only, not NHL schedule or trade value. Source: web/lib/tradeAnalyzer/slotFeasibility.ts:72 slotFeasibility.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/TradeAnalyzer/TradeAnalyzer.test.tsx`; `web/lib/tradeAnalyzer/offer.test.ts`; `web/lib/tradeAnalyzer/slotFeasibility.test.ts`; `{"discovered_not_run": ["web/lib/tradeAnalyzer/offer.test.ts", "web/lib/tradeAnalyzer/slotFeasibility.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/tradeAnalyzer/slotFeasibility.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) structural counts only; no value math (by design)
  - (codex:roster-trade-capacity) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-trade-slot-delta) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-TRD-003 Trade value components (projected league points, dated ADP; VOR/combined unavailable)

- **Match:** Both; Opus TRD-005; Codex roster-trade-dated-adp, roster-trade-projected-points, web-lib-projections-starterboardscoring-scoreboardstats
- **Purpose:** Projected league points for one player from admitted game expectations, plus latest dated Yahoo ADP.
- **Where:** `web/lib/tradeValue/valuationComponents.ts:12 (leagueValuationComponents)`; `web/lib/tradeValue/valuationRequest.ts:106 (datedAdp)`; `web/lib/tradeValue/valuationRequest.ts:139 (qualifiedValuationComponents)`; `web/lib/projections/starterBoardScoring.ts:50 (scoreBoardStats, other slice)`; `web/lib/tradeValue/valuationRequest.ts:106 datedAdp`; `web/lib/tradeValue/valuationRequest.ts:139 qualifiedValuationComponents`; `web/lib/tradeValue/valuationComponents.ts:12 leagueValuationComponents`; `web/lib/projections/starterBoardScoring.ts:50 scoreBoardStats`
- **Tags (heuristic):** conditionality: unconditional; denominators: per game, per team game; generation: development, current
- **Opus view (TRD-005):**
  - Method: projectedPoints = Σ_target weight*expected over next 5/10/20 games, only if every game target is unconditional, issued before asOf, unexpired and totals equal sum of games; rounded 4dp. ADP = average_draft_pick of latest atomic-writer capture ≤ cutoff, within maxCaptureAgeDays. VOR, actuals, rank, combined value and plausibility explicitly unavailable.
  - Inputs/units: expected counts; ADP pick number; sources: game expectations view, yahoo ADP history table, fhfh_player_external_identities
  - Output scale: fantasy points; ADP; writes: —
  - Status: draft — no production caller (valuationComponents.ts:6)
  - Consumers: (no production caller per comment)
- **Codex view (roster-trade-dated-adp, calculation, location; Codex family 'Trade value qualification'):** Cutoff-qualified Yahoo ADP observation
  - Purpose: Selects latest atomic-writer ADP row at/before decision cutoff and retrieval time for two-way-unique scope-verified Yahoo identity; checks max capture age, conflicts and positive value. Passes through source ADP without reestimating it.
  - Inputs/units: Yahoo ADP observations, capture/source metadata, verified identity rows, league/game/season request and age policy in days.
  - Output scale: Positive ordinal average draft pick with capture timestamp/scope or unavailable. Wrapper forwards qualified projected points and withholds combined/VOR/rank/guard.
  - Version/status: qualified-valuation-components-v1; source ADP method not implemented here. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-trade-projected-points, calculation, location; Codex family 'Trade value qualification'):** Qualified future league-points component
  - Purpose: Admits only exact-cutoff complete next5/10/20 future-game expected-stat views with all scored unconditional targets permitted/consistent; delegates weighted sum to scoreBoardStats with existing four-decimal rounding.
  - Inputs/units: Admitted expected counts, league point weights/profile/version, player ID, cutoff and complete future-team-game horizon.
  - Output scale: League fantasy points or unavailable reasons. VOR, actuals, actual rank, ADP, combined trade value and plausibility remain unavailable in this helper.
  - Version/status: league-valuation-components-v1; pure qualification helper, production admission/deployment not verified. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or …
- **Codex view (web-lib-projections-starterboardscoring-scoreboardstats, calculation, location; Codex family 'FORGE staged projection math'):** Starter-board custom fantasy score (scoreBoardStats)
  - Purpose: Linear sum of nonzero category weights times compatible mean values; required missing category withholds.
  - Inputs/units: Per-game category counts/minutes and points-per-unit weights.
  - Output scale: Fantasy points or unavailable.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): valuationComponents.ts:5-10 and valuationRequest.ts:7-12 headers; tasks/artifacts/trade-value-pipeline-2026-11-04/PLAN.md
  - Intended contract (Codex roster-trade-dated-adp): Pure FR1 request binding comment: no loader, query, route or UI. Metadata provenance and completeness remain caller-asserted. Source: web/lib/tradeValue/valuationRequest.ts:106 datedAdp.
  - Intended contract (Codex roster-trade-projected-points): Header explicitly says no production caller or combined trade value; caller-supplied view is not proof of admission. Source: web/lib/tradeValue/valuationComponents.ts:12 leagueValuationComponents.
  - Intended contract (Codex web-lib-projections-starterboardscoring-scoreboardstats): {"source": "web/lib/projections/starterBoardScoring.ts:50", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/starterBoardScoring.ts:57 else points += value * weight;"]}
  - External references: VOR / replacement-level valuation (not implemented)
  - Fixtures/test data: none listed
  - Tests: `web/lib/tradeValue/valuationComponents.test.ts`; `web/lib/tradeValue/valuationRequest.test.ts`; `{"discovered_not_run": ["web/lib/tradeValue/valuationRequest.test.ts", "web/lib/tradeValue/valuationComponents.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/tradeValue/valuationRequest.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/startChartPipeline.test.ts:13"]}`
- **Leads (not audited):**
  - (opus) comment says 'no production caller' — scaffolding only
  - (codex:roster-trade-dated-adp) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-trade-projected-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:web-lib-projections-starterboardscoring-scoreboardstats) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-TRD-004 BLSH retrospective trade fallback (recorded FP per game)

- **Match:** Opus only; Opus TRD-001; Codex —
- **Purpose:** Compare sides by each player's recorded FHFH points per game in the BLSH window.
- **Where:** `web/components/blshTrade/retrospective.ts:20 (retrospectivePlayer)`; `web/components/blshTrade/retrospective.ts:34 (retrospectiveComparison)`; `web/components/blshTrade/fixtureEvidence.ts:25 (synthetic index inversion)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (TRD-001):**
  - Method: recordedPerGame = headline observed / window games; referencePerGame = referenceAtCurrentTOI / games; side = Σ recordedPerGame (null if any missing); net = receive − give; FHFH Standard scoring only. Fixture: g = value/(100−\|value\|) inverts the 100g/(1+\|g\|) index.
  - Inputs/units: fantasy points per window; sources: BLSH display snapshot
  - Output scale: FP per game; writes: —
  - Status: live — pages/buy-low-sell-high/trade.tsx
  - Consumers: BlshTradeComparison
- **Audit context:**
  - Intent (Opus): retrospective.ts:1-4 header
  - External references: none suggested
  - Fixtures/test data: `web/components/blshTrade/fixtureEvidence.ts`
  - Tests: `web/components/blshTrade/retrospective.test.ts`
- **Leads (not audited):**
  - (opus) sums per-game rates across players on a side (2-for-1 trades compare a sum of two rates with one rate)
  - (opus) windows cover different dates/lengths (UI states this)

## M-TRD-005 Trade observation evidence selection (Yahoo trade market sightings)

- **Match:** Opus only; Opus TRD-004; Codex —
- **Purpose:** Validate and dedupe observed public trade sightings; count events.
- **Where:** `web/lib/tradeValue/observationEvidence.ts:8 (selectObservationEvidence)`
- **Tags (heuristic):** generation: development
- **Opus view (TRD-004):**
  - Method: Reject on source-use, URL, timing (observed ≤ asOf, traded ≤ observed), lineage; dedupe by sightingId; count proven events by scoped event id.
  - Inputs/units: —; sources: Yahoo trade market adapter (trusted)
  - Output scale: counts; writes: —
  - Status: draft — no caller found
  - Consumers: (none)
- **Audit context:**
  - Intent (Opus): observationEvidence.ts:2-7 header
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/tradeValue/observationEvidence.test.ts`

