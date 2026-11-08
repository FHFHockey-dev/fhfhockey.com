# Consumer binding R16/R17 correction checkpoint

The corrected candidate is frozen for independent review, not accepted for rollout. The owner run passes **26 tests: 25 private-PG cases and one default-off case**, including the unchanged five reviewer cases and nine original CR042–044 assertions. Scoped TypeScript and runtime lint pass. No compiler/test/database remains active.

Manifest: `../owned-source-v2-sha256.json`, SHA256 **9cba26d4e4617532c14d784b2d39038dce3ba9a085a0c337a0c68345532deefb**. All 73 pins are held until the reviewer releases them. All accepted 67 paths and all 11 live/snapshot read-only dependencies match. The forecast dependencies remain owned by their existing owner; this hold does not claim their ownership.

Only two source/test/SQL paths changed from the rejected v1 candidate:

- `../20261016060900_tweet_claim_forecast_delivery.sql` — `b030ca1b718cca895095ef798a494f085a197846c8833ef58e3a515a1654df00`.
- `../consumer-binding.test.ts` — `02002d18f102c6776371223d68619fed0ff8df164c1c6196e8149f585dcacaaf`.

The runtime `web/lib/sources/tweetClaimForecastDelivery.ts` and prior accepted source/SQL remain byte-identical. No route, caller, flag, scheduler, cohort or production operation was activated. The sole checkout remains on octoberBranch; no staging/commit/reset/push/deployment occurred.

## What changed

SQL4 now validates every permitted binding insert with a BEFORE INSERT trigger, including direct service-role INSERT and INSERT ON CONFLICT. The RPC uses that same boundary. Effect/transition/carrier identity, full retained action payload, parent identity, all required typed history/fence fields, proof hash and causal/offset clocks must agree. No security-definer privilege escalation was introduced.

The supported consumer plan is reconstructed from actual retained original/report/derived-parent rows and the bounded canonical schedule. It must exactly match the submitted snapshot, assignment and complete next-ten queue set. Original attribution, parser/metadata/source timing, governing clause text and UTF-16 anchors are checked. Native application revalidates retained source/report and schedule before invoking the real capture and queue RPCs. Receipt-backed recovery still records a known prior receipt without resending or requiring old sources to become dispatchable.

This validator intentionally supports one confirmed, fully retained validated injury-out event/report/original and a simple scheduled prefix. It checks complete canonical discovery up to 5,000 rows, then at most ten future games, each with exactly two consistent scheduled status rows (FUT/PRE with OK). Missing sides, competing versions, non-scheduled/unsupported statuses or wider derivations conservatively hold rather than approximating the general forecast reader. Current existing consumer constants remain ten scopes and five-minute debounce; changes to that consumer contract require a new pin and compatibility review.

SQL4 still creates two append-only tables; its corrected function/trigger inventory is **11**, superseding the seven-function count in the historical v1 rollout proposal. The existing native tables/RPCs/news trigger remain dependencies, with deployed definitions/ACLs/fences still unproven.

## Before and after evidence

The immutable independent v1 report records four invalid bindings that actually committed native rows/receipts: queue truncation, substituted relay attribution, contradictory governing clause, and direct insertion with status-only proof. `../../review-consumer-binding-v1/REVIEW.md` and its 109-file artifact manifest are unchanged.

The same five-case reviewer block is copied into the owner test without changing its assertions; only evidence output paths differ. It now passes. Additional checks cover each required direct-insert proof field and type, blank/invalid clocks/identity overrides and ON CONFLICT; a complete ten-scope positive; omitted-prefix rejection; original/report/schedule movement before application; and UTF-16/clamped/surrogate boundaries. Existing rollback, ack-loss/readback, two-worker, stale-owner, original-clock and native r3 identity cases continue to pass. The final run is `evidence/final-pinned-run.log`; original assertion readbacks are `consumer-binding-results.json`; scoped compiler/lint logs and exact hash comparisons are linked in `integrity.json`.

Earlier correction failures are retained: a SQL CASE parsing error, then 24/25 passing with one changed error-message precedence. Parenthesizing CASE fixed parsing; retaining the existing semantic validation order restored the original assertion without changing it. A 25-case passing development pin/log precedes the final retained-report check and 26-case pin; only the final manifest above identifies this candidate.

Evidence handling correction: the first correction probes ran the old owner harness before output isolation and replaced owner-only `../evidence/atomic-probe.json`. Its historical expected hash and replacement hash are disclosed in `integrity.json`; the old 47-file owner artifact manifest is therefore not fully matching. The v1 complete results were restored byte-for-byte from retained `../evidence/final-pinned-results.json`. All 109 independent v1 review artifacts, original failures, frozen source copies, earlier review roots and original oracle were left untouched. All subsequent correction outputs are isolated here.

## Remaining gates and next task

Next: independent rerun of the unchanged R16/R17 regressions and bounded neighboring cases against this exact pin. R16/R17 closure and consumer acceptance remain pending that review. No full-52 or external exactly-once acceptance is claimed; the original pure report remains 41/43 cases, 194/196 assertions with nine original persistence deferrals and ambiguous original CR011/CR051 fixtures preserved.

Deployment prerequisites, exact live schema/RPC/trigger/grant inventory, authentic retained history and complete writer fencing, raw receiver-job/external queue acknowledgment, genuine future cohort labels/metrics, and migration/release/activation/dispatch/replay approvals remain separate. No live reads, DDL, ingestion, dispatch, replay, compensation, scheduler activation, forecast publication or hosted validation was performed for this correction.

Reproduce from `web/`:

```sh
IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run ../tasks/ifttt-integration-2026-10-16/consumer-binding-increment/consumer-binding.test.ts --config ../tasks/ifttt-integration-2026-10-16/consumer-binding-increment/vitest.config.mjs
npx tsc --noEmit -p ../tasks/ifttt-integration-2026-10-16/consumer-binding-increment/tsconfig.json
npx eslint --report-unused-disable-directives-severity warn lib/sources/tweetClaimForecastDelivery.ts
```

Private-PG tests use temporary Unix sockets, disabled TCP, scrubbed PG variables and the existing network-denial harness; they stop/remove their cluster. Do not run the frozen reviewer original in place: it writes its own report paths. Copy to a new reviewer-owned root for the independent rerun.
