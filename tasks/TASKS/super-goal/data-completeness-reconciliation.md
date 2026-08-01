# Data Completeness, Freshness, Provenance, and Leakage Reconciliation (6.2)

**Status:** Evidence-only verification completed 2026-07-31. This artifact reconciles the repository's full-table read contracts, freshness metadata, provenance boundaries, and leakage-safe model rules. It does not authorize a migration, writer, repair, backfill, provider call, deployment, or model promotion.

## Conclusion

The canonical read and model contracts use explicit ordered pagination or a documented bounded scope, source-derived freshness, and provenance-aware partial/unknown states. The local regression cohort passed 10 files and 44 tests covering the shared page loop, freshness policy, Sustainability and xG coverage helpers, underlying-stats coverage, prediction/source ownership, Draft Dashboard freshness, and model leakage guards. Existing live/value-free reports provide representative complete-table checks and digest/count receipts.

Completeness is not inferred from a first PostgREST page, a non-empty response, a request-time timestamp, or a fabricated zero. Known incomplete historical scopes remain explicitly partial, quarantined, or open for repair. Master verification task 6.2 therefore closes as an evidence-reconciliation task; the scoped data gates below remain open in their owning lists.

## Data-boundary matrix

| Concern | Evidence and contract | Disposition |
| --- | --- | --- |
| Ordered full-table reads | `web/lib/supabase/pagination.ts` provides ordered range/page loops, short-page completion, retries, and bounded filter chunks. Its eight-test suite covers range progression, short pages, limits, retry behavior, and filter chunking. Dashboard/Yahoo reads use this helper or an equivalent deterministic range loop; direct unbounded browser reads are not accepted as completeness proof. | Shared pagination contract verified. Any newly discovered large reader must still be registered and tested by its owning initiative. |
| Dashboard/trends freshness | Dashboard health evidence covers source-derived CTPI/skater dates, capped-page pagination, mixed-date warnings, requested/resolved/source/computation metadata, stale thresholds, and blocked historical fallbacks. Team-power and trend regressions include a row beyond the first 1,000. | Current reader/freshness contracts are evidenced. Historical source holes, late-source repairs, and natural scheduler proof remain open where listed. |
| Yahoo/Draft completeness | Draft Dashboard evidence records complete player-master pagination, bounded auxiliary-ID chunks, ordered Yahoo map/projection cross-checks, deterministic latest-row selection, and explicit unmapped/conflicting/current-game-missing diagnostics. Yahoo readers preserve non-Yahoo projections when Yahoo detail is unavailable and never fabricate zeros. | Consumer completeness and partial-state behavior are verified. Provider/league equivalence, historical backfill, and final owner-retirement gates remain open. |
| Sustainability and rolling history | The Sustainability dependency map records 753 surfaces, 1,872 local dependency edges, and 263 API edges (245 resolved route files and 18 unresolved literals retained for review). Coverage reports use paginated source reads and expose requested/observed/derived/scope metadata. The known playoff-unit, false-cutoff, rolling-history, and formula gaps remain explicit rather than silently filled. | Dependency/provenance coverage is reconciled; stored-history repair and version/provenance decisions remain open. |
| FORGE eligibility and results | The canonical latest-succeeded-run contract selects exact same-date games and reports 7,523 eligible player-games, of which 6,179 have results and 1,344 are missing (912 across 18 zero-result dates and 432 across three partial dates). Contaminated runs remain immutable and excluded from calibration; the atomic result contract exact-replaces a date scope and reports coverage. | Eligibility and leakage boundaries are verified locally. Migration application, eligible bounded backfill, and resulting Production coverage/idempotency proof remain open. |
| DRM raw → normalized → relationship → derived | Current contracts bind normalized stages to immutable raw snapshot hashes and versions, use per-game lock/CAS boundaries, and fail closed on incomplete PBP/roster/shift coverage instead of emitting truthful-looking zeros. The task inventory retains incomplete-row and affected-history counts as explicit repair scopes. | Stage ordering and partial-state semantics are verified. Durable status/version publication, bounded history repair, natural writer evidence, and legacy-owner retirement remain open. |
| xG/rankings/model training | Leakage registries and validators reject same-game target overlap and outcome leakage. Adjusted-impact and related model contracts require chronological held-out validation before persistence; source model, feature version, training/validation windows, and player coverage are retained in provenance. Candidate/shadow promotion stays disabled until its explicit gate. | Leakage-safe model boundary is verified by focused tests and recorded held-out receipts. Provider/source coverage and promotion decisions remain separately gated. |
| sKO seasonal/as-of boundary | The seasonal writer selects an explicit `asOfDate`, bounded lookback, discovered player scope, and horizon; the route records a truthful no-write manifest outside the official season. The compatibility reader reports page-bounded partial state and source freshness rather than claiming full coverage. | Date/model boundary is verified. In-season natural evidence and any future model/history decision remain open. |
| Provenance and partial/unknown semantics | `web/lib/predictions/sourceProvenance.ts`, `sourceOwnership.ts`, Draft freshness helpers, Sustainability coverage helpers, and route receipts preserve source, requested/resolved date, freshness, scope, warnings, and omission/partial state. Missing/ambiguous upstream rows remain unavailable or explicitly unknown. | Provenance contract is verified for the inspected families; historical repair and provider provenance reconciliation remain open. |

## Required invariants retained

1. Every large read either completes an ordered page loop or declares a bounded scope with its limit and completeness state.
2. Freshness comes from source-owned dates/receipts, not request time; mixed or stale sources are visible as warnings, blocked, partial, or unknown.
3. Provenance carries requested, observed, derived, and scope identity; legacy/contaminated history is not silently promoted into current calibration.
4. Model features are bounded by the as-of/training split and same-game leakage guards; held-out validation precedes persistence or promotion.
5. A missing or incomplete source cannot become a synthetic zero or a false complete success.

## Explicitly not closed here

- Sustainability playoff-unit, cutoff-provenance, rolling-history, team-rating, formula, and versioned historical repairs.
- FORGE result-coverage migration/backfill and Production eligibility/idempotency proof.
- DRM normalized/relationship/derived historical repair, durable status publication, and natural scheduler proof.
- Yahoo provider/league equivalence, historical backfill, Python retirement, and legacy-map disposition.
- sKO in-season natural run and future model/history decisions.
- Odds/provider availability, model-promotion, and any business writer/backfill.

## Evidence references

- `web/lib/supabase/pagination.ts` and `web/lib/supabase/pagination.test.ts`
- `web/lib/dashboard/freshness.ts` and `web/lib/dashboard/freshness.test.ts`
- `web/lib/sustainability/coverageAudit.ts` and `web/lib/sustainability/coverageAudit.test.ts`
- `web/lib/xg/featureCoverage.ts` and `web/lib/xg/featureCoverage.test.ts`
- `web/lib/underlying-stats/playerUnderlyingCoverage.ts` and its focused test
- `web/lib/predictions/sourceOwnership.ts` and `sourceOwnership.test.ts`
- `web/lib/draftDashboard/projectionFreshness.ts` and its focused test
- `web/lib/ml/featureLeakageRegistry.ts` and its focused test
- `web/lib/xg/qotQoc.ts`, `qotQoc.test.ts`, `adjustedImpact.ts`, and `adjustedImpact.test.ts`
- `tasks/TASKS/three-pillars-analytics/sustainability/sustainability-trends-audit-report.md`
- `tasks/TASKS/draft-dashboard-yahoo/tasks-prd-draft-dashboard.md`
- `tasks/TASKS/dead-code-cleanup/tasks-prd-drm-refactor.md`
- `tasks/TASKS/super-goal/super-goal-final-summary.md`
