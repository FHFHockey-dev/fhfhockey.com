# R-HEALTH — bounded local proposal for NEW18 / C0096

**Genuine local health-contract gap; a small additive reader/test change is feasible. No implementation or checks executed.** Exact parent: `SRC::tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-barometer.md::C0096`, NEW18.0; adjacent C0095 batch-completeness context. Scheduler/finalizer enablement, accepted operational gap and natural/deployed receipts remain open.

## Current source evidence

- [GET-only admin route](/Users/tim/Code/fhfhockey.com/web/pages/api/internal/sustainability/health.ts:6) serializes the reader's report; no UI consumer was found among the immediately relevant Sustainability paths. Existing route need not change.
- [Health reader](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/health.ts:25) makes exactly six requests: latest date plus all-history exact count for each of scores/trend bands/projections. [Report type](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/health.ts:20) has no snapshot/window/quintile/distribution information. It cannot distinguish partial latest-date scores/finalization from a populated old history.
- [Existing two tests](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/health.test.ts:38) cover aggregate/date shape and count-query failure only. They do not exercise any partial snapshot observation.
- [Current score schema](/Users/tim/Code/fhfhockey.com/web/lib/supabase/database-generated.types.ts:30879) provides snapshot_date, window_code, nullable sustainability_quintile, model_version/config_hash and player identity. [Distribution schema](/Users/tim/Code/fhfhockey.com/web/lib/supabase/database-generated.types.ts:30561) provides date/window/season/config identity plus reported population_count. No new schema is required.
- [Actual full-run finalization](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/rebuild-score.ts:147) emits one distribution per l3/l5/l10/l20 and assigns quintiles. R-SCORE already exercises that local success path; this proposal is solely its named health-observability gap.

Scoped diff inspection showed no existing edits to health.ts, health.test.ts or the health route at this proposal boundary. No source/master/register/other-owner file changed.

## Exact smallest ownership requested

1. `web/lib/sustainability/health.ts`
2. `web/lib/sustainability/health.test.ts`

Keep existing `generatedAt` and `tables` fields unchanged. Add a typed `snapshotDiagnostics` object. Route/DB/schema/config/model/scoring/writer/scheduler files stay read-only. No new helper/test file, dependency, API or UI.

## Proposed bounded reads

Anchor to the existing latest **score** snapshot date, explicitly labelled as the latest observed score date, not today's validated/current snapshot. Do not infer freshness or choose a threshold. If absent, return unavailable diagnostics and make no additional requests.

For a nonnull date, issue at most six additional queries:

1. Four `sustainability_scores` exact HEAD counts, each filtered by `snapshot_date = anchor` and one of l3/l5/l10/l20. Read no score rows or full player history.
2. One exact HEAD count of `sustainability_scores` filtered by that date, the four window codes, and `sustainability_quintile IS NULL`.
3. One `sustainability_distribution_snapshots` query filtered by that date and four window codes, selecting only `window_code,season_id,config_revision,model_version,config_hash,population_count`. Request an exact count and at most **five rows** (four expected window observations plus a sentinel), ordered by config_revision/season_id/window_code for deterministic output. Five returned rows or exact count greater than four must not be mistaken for one complete four-window version. If backend capping means returned rows are fewer than exact count, mark truncation explicitly.

Maximum **12 total requests** including the six existing requests; at most **five additional returned data rows**, plus scalar counts. Serialize the six additional requests (concurrency one) to avoid increasing simultaneous health-query pressure. Existing aggregate-count semantics stay untouched; no new all-history scan, provider request, player roster/materializer scan, query-triggered writes or repeated polling. Exact counts may still require database work over the selected date; actual index plan/hosted latency/cost are unknown and must not be called cheap or measured. This proposal bounds query scope and payload, not execution duration or scan complexity.

## Truthful diagnostic contract

- Always expose `expectedPopulation: null`, `coverage: "unverified"` and a reason that no authoritative eligible-player denominator/snapshot manifest is available. Never publish100%, complete, healthy, or a false zero-expected population.
- Report observed per-window score row counts and observed null-quintile count. Zero score rows for a required window is a missing-window observation; unequal row counts is an inconsistent-count observation. **Equal positive counts do not establish equal player sets, complete population, model lineage or eligibility.** A partial250-player snapshot can satisfy equal counts across all four windows.
- Nonzero null-quintile count is a definite missing-assignment observation. Zero nulls is only an observation; it does not prove the right players/version were finalized.
- Include bounded distribution identity/window/population observations and exact row count. Zero distribution rows at this date is definitely missing finalization evidence. With an untruncated single identity group, missing window labels can be named. Multiple identity groups, duplicate window labels or truncated results remain explicitly ambiguous/unverified; do not choose the first revision or infer absent windows from a partial result.
- Distribution `population_count` is a reported producer count, **not** an authoritative expected denominator. Without a verified score/producer identity match, do not sum it, compare it as expected coverage, or turn equal distribution/score counts into completeness. Model/config identity/freshness checks beyond those observations remain unverified; no active-config coupling or model-selection change is introduced.
- Keep known missing/inconsistent observations separate from global coverage unverified. Diagnostic issue labels describe only the observations above. An apparently coherent four-window result still has unverified coverage.
- Preserve existing fail-closed query error behavior. A missing/nonfinite/negative exact count is an unavailable read, not zero: reject rather than report a healthy/missing-zero snapshot. Existing historical table-count fields are not refactored in this task.

This can reveal missing finalization/windows/quintiles and inconsistent counts. It **cannot detect every partial snapshot**, prove membership equality, or close C0096's operational acceptance. That limitation must remain in the API's diagnostic reasons and handoff.

## Meaningful mocked verification after exact assignment

Extend the existing test's query mock to retain filters/order/limit and exercise actual reader logic:

- Empty score table: additive unavailable result, expectedPopulation null, no added queries.
- Partial/latest date with one missing window and null quintiles: exact missing observations; ensure every added count/query uses the single anchored date.
- Unequal nonzero window counts: inconsistent count observation; never full coverage.
- Four equal250-row windows with four distribution rows: remain coverage unverified, even with zero null quintiles and matching reported producer counts.
- Multiple revisions/identities or a five-row sentinel/exact-count truncation: no arbitrary version selection or false missing-window/completeness conclusion.
- Count-query/distribution-query errors and null counts: fail closed, never convert unknown to zero.
- Assert at most12requests, bounded selected fields, limit5 and no added history/player table accesses. Preserve original aggregate/date behavior.

Run only `npm test -- lib/sustainability/health.test.ts` from web after implementation. No route invocation, database, browser, provider or global suite is needed for this local acceptance. Chef reserves global checks and independent review.

## Ownership / next step

No overlap with current R-FLAGS/R-BADGE reader/UI, R-APIERR, telemetry, matrix or R-RECEIPTS scopes. All scores/config/distribution schema types are inspected read-only; original fences remain in force. Chef may approve these exact two files and contract or narrow it before implementation. If payload/version ambiguity would require authoritative membership or schema, retain unverified rather than expanding scope.

Exact proposal-only write: `tasks/codex-sprint-2026-10-19/continuation-review/R-HEALTH-PROPOSAL.md`. No tests/DB/network/Python/global checks/source edits; no running operation. This is a bounded handoff while sprint remains active.
