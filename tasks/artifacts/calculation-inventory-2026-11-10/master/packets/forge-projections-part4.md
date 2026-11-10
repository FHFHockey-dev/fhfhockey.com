# Audit packet: FORGE projections (part 4 of 4)

Master entries M-FRG-181 to M-FRG-186 (6 of 186 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-FRG-181 | Position-specific stat distribution (summarizeStatDistribution) | Codex only | 0 | 1 |
| M-FRG-182 | Implied probability to american (impliedProbabilityToAmerican) | Codex only | 0 | 1 |
| M-FRG-183 | Median (median) | Codex only | 0 | 1 |
| M-FRG-184 | Build flag confidence (buildFlagConfidence) | Codex only | 0 | 1 |
| M-FRG-185 | Build model market flag row (buildModelMarketFlagRow) | Codex only | 0 | 1 |
| M-FRG-186 | Expected value with push (expectedValueWithPush) | Codex only | 0 | 1 |

## M-FRG-181 Position-specific stat distribution (summarizeStatDistribution)

- **Match:** Codex only; Opus —; Codex web-lib-projections-uncertainty-summarizestatdistribution
- **Purpose:** Resolve fitted dispersion for stat/position/horizon/TOI, then summarize NB or Poisson count law.
- **Where:** `web/lib/projections/uncertainty.ts:902 summarizeStatDistribution`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Codex view (web-lib-projections-uncertainty-summarizestatdistribution, calculation; Codex family 'FORGE staged projection math'):** Position-specific stat distribution (summarizeStatDistribution)
  - Purpose: Resolve fitted dispersion for stat/position/horizon/TOI, then summarize NB or Poisson count law.
  - Inputs/units: Stat G/A/SOG/HIT/BLK/SV/SA, F/D/G position, projected total, horizon/TOI-CV.
  - Output scale: Mean/variance, P(at least k) and p10/p50/p90.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-projections-uncertainty-summarizestatdistribution): {"source": "web/lib/projections/uncertainty.ts:902", "explicit_comment": "Mean, P(X >= k) and quantiles for a projected stat total; Poisson when no alpha is fitted.", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:917 /** Over = X > line, under = X < line, push = X == line (integer lines only). */"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/projections/uncertainty.test.ts:15"]}`
- **Leads (not audited):**
  - (codex:web-lib-projections-uncertainty-summarizestatdistribution) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-182 Implied probability to american (impliedProbabilityToAmerican)

- **Match:** Codex only; Opus —; Codex web-lib-projections-utils-devig-impliedprobabilitytoamerican
- **Purpose:** Inverse of americanToImpliedProbability, for prices rebuilt from averaged probabilities.
- **Where:** `web/lib/projections/utils/devig.ts:263 impliedProbabilityToAmerican`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-projections-utils-devig-impliedprobabilitytoamerican, symbol_candidate; Codex family 'FORGE staged projection math'):** Implied probability to american (impliedProbabilityToAmerican)
  - Purpose: Inverse of americanToImpliedProbability, for prices rebuilt from averaged probabilities.
  - Inputs/units: Parameter/type declaration excerpt: export function impliedProbabilityToAmerican(probability: number): number \| null { if (!isProbability(probability)) return null; return probability >= 0.5 ? -(100 * probability) / (1 - probability) : (100 * (1 - probability)) / probability; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["web/lib/projections/utils/market-output-builders.ts:9"]
- **Audit context:**
  - Intended contract (Codex web-lib-projections-utils-devig-impliedprobabilitytoamerican): {"source": "web/lib/projections/utils/devig.ts:263", "explicit_comment": "Inverse of americanToImpliedProbability, for prices rebuilt from averaged probabilities.", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:266 ? -(100 * probability) / (1 - probability)", "web/lib/projections/utils/devig.ts:267 : (100 * (1 - probability)) / probability;"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/devig.test.ts:12"]}`
- **Leads (not audited):**
  - (codex:web-lib-projections-utils-devig-impliedprobabilitytoamerican) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-183 Median (median)

- **Match:** Codex only; Opus —; Codex web-lib-projections-utils-devig-median
- **Purpose:** Median for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/projections/utils/devig.ts:255 median`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-projections-utils-devig-median, symbol_candidate; Codex family 'FORGE staged projection math'):** Median (median)
  - Purpose: Median for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function median(values: number[]): number \| null { const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b); if (finite.length === 0) return null; const mid = Math.floor(finite.length / 2); return finite.length % 2 === 1 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2; } /** Inverse of americanToImpliedProbability, for prices rebuilt from averaged probabilities. */
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["modeling/player_forecasts/advanced.py:1840", "modeling/player_forecasts/rookies.py:10", "modeling/player_forecasts/season.py:10", "web/components/DraftDashboard/MockAdpBoard.tsx:10", "web/components/DraftDashboard/SuggestedPicks.tsx:785", "web/components/Projections/ProjectionSourceAnalysis.tsx:88", "web/components/Projections/RoundPerformanceBoxPlotChart.tsx:163", "web/lib/draft-ranker/discove…
- **Audit context:**
  - Intended contract (Codex web-lib-projections-utils-devig-median): {"source": "web/lib/projections/utils/devig.ts:255", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:258 const mid = Math.floor(finite.length / 2);", "web/lib/projections/utils/devig.ts:259 return finite.length % 2 === 1 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;", "web/lib/projections/utils/devig.ts:262 /** Inverse of americanToImpliedProbability, for prices rebuilt from averaged probabilities. */"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2729", "web/lib/draft-ranker/discovery.test.ts:40", "web/lib/projections/utils/devig.test.ts (module test)", "web/lib/projections/utils/market-output-builders.test.ts:77", "web/lib/socialShare/modules/goaliePeriod.test.ts:348", "web/lib/socialShare/modules/teamStream.test.ts:57", "web/lib/sustainability/features.test.ts:590", "web/scripts/blsh/currentDryRun.test.ts:128"]}`
- **Leads (not audited):**
  - (codex:web-lib-projections-utils-devig-median) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-184 Build flag confidence (buildFlagConfidence)

- **Match:** Codex only; Opus —; Codex web-lib-projections-utils-market-output-builders-buildflagconfidence
- **Purpose:** Build flag confidence for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/projections/utils/market-output-builders.ts:77 buildFlagConfidence`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-projections-utils-market-output-builders-buildflagconfidence, symbol_candidate; Codex family 'FORGE staged projection math'):** Build flag confidence (buildFlagConfidence)
  - Purpose: Build flag confidence for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function buildFlagConfidence(edgeValue: number, threshold: number): number { if ( !Number.isFinite(edgeValue) \|\| !Number.isFinite(threshold) \|\| threshold <= 0 ) { return 0; } return Number( Math.min(100, Math.max(0, (Math.abs(edgeValue) / threshold) * 50)).toFixed( 2, ), ); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["market-context-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-projections-utils-market-output-builders-buildflagconfidence): {"source": "web/lib/projections/utils/market-output-builders.ts:77", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/market-output-builders.ts:86 Math.min(100, Math.max(0, (Math.abs(edgeValue) / threshold) * 50)).toFixed("]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/market-output-builders.test.ts (module test)"]}`
- **Leads (not audited):**
  - (codex:web-lib-projections-utils-market-output-builders-buildflagconfidence) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-185 Build model market flag row (buildModelMarketFlagRow)

- **Match:** Codex only; Opus —; Codex web-lib-projections-utils-market-output-builders-buildmodelmarketflagrow
- **Purpose:** Build model market flag row for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/projections/utils/market-output-builders.ts:92 buildModelMarketFlagRow`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-projections-utils-market-output-builders-buildmodelmarketflagrow, symbol_candidate; Codex family 'FORGE staged projection math'):** Build model market flag row (buildModelMarketFlagRow)
  - Purpose: Build model market flag row for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildModelMarketFlagRow(args: { asOfDate: string; entityType: "game" \| "player" \| "team"; entityId: number; gameId: number; marketType: string; flagType: string; edgeValue: number; reasons: Array<Record<string, unknown>>; provider: string \| null; metadata?: Record<string, unknown>; }): Record<string, unknown> { const threshold = args.entityType === "game" ? ((GAME_MARKET_EDGE_THRESHOLDS as Record<string, number>)[ args.marketType ] ?? 0.25) : (PLAYER_MARKET_EDGE_THRESHOLDS[args.marketType] ?? 0.25);
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["market-context-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["web/lib/projections/run-forge-projections.ts:312"]
- **Audit context:**
  - Intended contract (Codex web-lib-projections-utils-market-output-builders-buildmodelmarketflagrow): {"source": "web/lib/projections/utils/market-output-builders.ts:92", "explicit_comment": "web/lib/projections/utils/market-output-builders.ts:135 ---------------------------------------------------------------------------", "arithmetic_locations": ["web/lib/projections/utils/market-output-builders.ts:143 /** Default minimum \|model - market\| probability gap that raises a flag. */", "web/lib/projections/utils/market-output-builders.ts:146 /**", "web/lib/projections/utils/market-output-builders.ts:158 /** Poisson P(X > line) = 1 - CDF(floor(line)). */"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/projections/module-imports.test.ts:34", "web/lib/projections/utils/market-output-builders.test.ts:4"]}`
- **Leads (not audited):**
  - (codex:web-lib-projections-utils-market-output-builders-buildmodelmarketflagrow) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-186 Expected value with push (expectedValueWithPush)

- **Match:** Codex only; Opus —; Codex web-lib-projections-utils-market-output-builders-expectedvaluewithpush
- **Purpose:** Expected value with push for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/projections/utils/market-output-builders.ts:363 expectedValueWithPush`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-projections-utils-market-output-builders-expectedvaluewithpush, symbol_candidate; Codex family 'FORGE staged projection math'):** Expected value with push (expectedValueWithPush)
  - Purpose: Expected value with push for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function expectedValueWithPush( win: number, lose: number, price: number \| null, ): number \| null { const decimal = americanToDecimal(price); if (decimal == null) return null; return win * (decimal - 1) - lose; } /** * Compare the model with the market in probability space. * * Combining books: quotes are grouped by line; the consensus line is the one * quoted by the most books (ties go to the lower line). Each two-way book is * de-vigged on its own over/under pair (Shin by default); a book with only * "yes"/"over" gets devigYesOnly's assumption-based estimate (overround from * `yesOnlyOverround`, else FORGE_YES_ONLY_OVERROUND, else the default). The
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["market-context-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-projections-utils-market-output-builders-expectedvaluewithpush): {"source": "web/lib/projections/utils/market-output-builders.ts:363", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/market-output-builders.ts:370 return win * (decimal - 1) - lose;", "web/lib/projections/utils/market-output-builders.ts:373 /**"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/market-output-builders.test.ts (module test)"]}`
- **Leads (not audited):**
  - (codex:web-lib-projections-utils-market-output-builders-expectedvaluewithpush) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

