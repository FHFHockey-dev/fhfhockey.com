# Independent real-consumer binding review v1

Rejected for consumer acceptance: R16 and R17 allow invalid bindings to become actual native effects with authoritative receipts. Earlier accepted 67 paths and their bounded review verdicts remain unchanged. The frozen 73-file source manifest SHA256 is `6c7025537e3270467238b7a3ea7aa00b0ec973dcd01c6867a58ed33b541f2040`.

## R16 — authenticate the complete producer/consumer plan and source lineage (P1)

`web/lib/sources/tweetClaimForecastDelivery.ts:53` hashes the submitted plan and compares it to another caller-supplied hash. SQL4 lines 91–129 validate a subset of parent, assignment and queue fields; they do not establish that the plan equals the output recorded by the actual consumer, preserve all original attribution, or match the action's governing source clause to that parent.

Three independent private-PG regressions each start from the actual prepared producer/consumer plan. All three incorrectly bind, apply, commit native rows and retain a receipt:

| Input alteration | Observed durable result | Evidence |
|---|---|---|
| Remove one of two scopes produced by the real schedule/consumer, recompute proof hash | One native queue, one snapshot/assignment/receipt; reported applied | `evidence/R16-truncated-queue.json` |
| Replace native snapshot source account and URL with relay_wrapper and the relay URL, recompute proof hash | Actual native snapshot retains relay attribution; two queues and one receipt; applied | `evidence/R16-relay-attribution.json` |
| Before binding, replace action evidence text with “Jordan Staal will play tonight.” while its retained original parent says “will not play” | Two native queues and receipt; applied despite contradictory source lineage | `evidence/R16-semantic-clause.json` |

These are binding-boundary faults using permitted API inputs and retained-state inconsistency; they do not claim the normal preparation function itself changes these fields. Preserve an authoritative complete consumer plan and enforce exact source/attribution consistency before allowing either binding or native application. A self-reported hash alone does not establish that contract.

## R17 — enforce history/fence validation for every allowed binding insert (P1)

SQL4 line 25 grants `service_role` INSERT on bindings. The binding triggers at lines 26–29 reject only update/delete. The RPC's full history/identity/plan validation at lines 131–135 is bypassed by direct INSERT, and the read path at lines 171–173 treats the inserted `status` plus currently empty rows as not-applied.

The independent regression inserts through the granted service role, without disabling a trigger or using superuser writes. It supplies only `{status:"verified_not_dispatched"}` as proof: no basis, retention evidence, writer-fence evidence, knownAt, effect/transition/plan-hash proof binding. Normal recovery then reports applied and commits one real native snapshot, assignment, receipt, news row and two queues. See `evidence/R17-missing-proof.json`.

This is a bypass of this new interface's proof contract, not a claim that the already privileged service role cannot invoke legacy consumers directly. Every permitted insert must enforce equivalent binding/history invariants, and reconciliation must not promote an unvalidated status into positive no-dispatch proof.

## Checks and accepted observations

The unchanged owner harness passed all 15 tests (14 actual private-PG +1 default-off); nine unchanged original CR042–044 assertions were observed passing through the normal API. Scoped TypeScript passed, exit 0. The five independent PG regressions produced four failures above and one passing control: actual partial native capture history overrides nominal no-dispatch proof and holds unknown without replay. These failures are not original-oracle assertion failures; they demonstrate missing adjacent safeguards and withhold overall consumer acceptance.

Normal tested paths reach the real producer, real capturePlayerForecastSourceRows, native capture/assignment UUIDs, both queue scopes, actual loaded news trigger and atomic receipt. Existing suite results support rollback on second queue failure, lost consumer/settlement/readback responses, competing workers, stale owner denial, immutable receipt checks and the explicit native r3/carrier identity distinction. These positive observations do not close R16/R17.

All 73 pins, accepted 67, 11 read-only live dependencies and their retained snapshots match before/after. All 745 earlier review files plus status addendum remain unchanged. Original r3/adapter/reducer/oracle and earlier SQL are unchanged. Read-only dependencies were never owned or edited by this review. No source implementation, existing test, SQL or prior reviewer artifact was modified.

## Remaining gates and release

Correct R16/R17, freeze a new manifest and rerun these unchanged independent regressions plus the relevant normal consumer cases. Until then the real consumer boundary and original exact persistence contracts are not accepted. Original full-52 acceptance remains withheld: the pure oracle retains its earlier 41/43, 194/196 and nine deferrals; original ambiguous CR011/CR051 remain unchanged. Real history retention, complete writer fencing, deployed schema/ACL/trigger inventory, authentic future labels and operational approval remain separate prerequisites. The implemented acknowledgment boundary is native consumer/outbox acknowledgment, not a demonstrated raw IFTTT receiver or external queue contract.

All 73 source holds are released after final rehash so the owner may correct these findings. This review root is frozen for combined verification. No test/compiler remains active in this review; disposable Unix-socket PG17 clusters stopped and were removed. No aggregate compiler/build, hosted action, production DDL, real ingestion/dispatch/replay, publication, staging, commit, push or deployment occurred.

Reproduce from `web/` with `IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run ../tasks/ifttt-integration-2026-10-16/review-consumer-binding-v1/independent-consumer-binding.test.ts -t independent --no-file-parallelism --config ../tasks/ifttt-integration-2026-10-16/review-consumer-binding-v1/vitest.review.config.mjs`. The unchanged harness is `consumer-binding.test.ts` in the same root. JSON reports, logs, full before/after native rows and frozen copies are retained here. Scoped compiler project: `../tasks/ifttt-integration-2026-10-16/consumer-binding-increment/tsconfig.json`.
