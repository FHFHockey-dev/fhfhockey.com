# Independent consumer binding correction review v2

R16/R17 are closed for the bounded default-off local consumer capability. No new defect was found in the requested correction scope. Source manifest `consumer-binding-increment/owned-source-v2-sha256.json` SHA256 `9cba26d4e4617532c14d784b2d39038dce3ba9a085a0c337a0c68345532deefb` has 73 matching pins. Only SQL4 and its test changed; runtime and accepted 67 remain byte-identical.

## Independent results

The five original reviewer contract cases were copied byte-for-byte from immutable v1 evidence into a new harness. Their complete case block is unchanged; only the enclosing result's manifest reference names v2. All five pass. The owner copy also matches that block after normalizing its evidence output directory.

The full frozen 26-case suite passes (25 actual private-PG +1 default-off), including those five cases and all nine original CR042–044 assertions. Scoped TypeScript passes, exit 0. Five additional independent nearby cases pass. There were 36 executions across three runs, covering 31 distinct cases (30 actual PG +1 default-off); the five contract reruns are not counted twice as distinct cases.

The four earlier invalid bindings now reject before native rows or receipts: omitted queue scope, relay account/link substituted into the snapshot, contradictory governing semantic clause, and direct service insert with status-only history proof. The partial native-history control continues to hold unknown without replay. Full before/after evidence is retained under `evidence/`, beside the immutable v1 failure evidence in its prior root.

## Accepted correction boundaries

SQL reconstructs this supported consumer snapshot, assignment and complete bounded next-ten prefix from retained original/report/derived-parent and schedule rows, and compares the complete plan. It enforces original attribution, exact governing UTF-16 source anchors, full action payload, effect/transition/carrier binding, typed causal history proof and exact proof/plan hash. BEFORE INSERT applies the same validation to direct service-role inserts and ON CONFLICT; native application revalidates before side effects. Receipt-backed recovery remains separate from new application.

Nearby probes verify that direct INSERT ON CONFLICT with a recomputed proof hash still rejects either queue omission or relay attribution, leaving the existing binding unchanged and no native effect. Postponed status and two home-side rows without the away side conservatively hold, with no binding/capture/queue/receipt. A previously committed exact receipt remains recoverable after later unsupported schedule evidence: only read and receipt-backed acknowledgment RPCs run, with no native apply/capture/enqueue, no changed receipt and no replay.

The unchanged normal suite also verifies actual native capture/assignment UUIDs, both queue scopes, loaded news trigger and append-only receipt; atomic rollback on the second queue failure; consumer/settlement/readback acknowledgment loss; two workers; stale-owner denial; original historical clocks; and distinct native r3 effect versus carrier action identity. The local CR042–044 producer/consumer/outbox projections and their nine original assertions are accepted under the explicit fixture prior-state/history inputs. This is meaningful actual durable integration, not pure candidate-only testing.

## Limits and remaining gates

Acceptance is narrow: one fully retained confirmed injury/availability-out event and player, one original/report/derived parent, and up to ten future games with exactly two consistent FUT/PRE+OK sides. The 5,000-row discovery cap, unsupported schedule versions/statuses and wider derivations conservatively hold. SQL mirrors the current ten-scope and five-minute debounce contract; dependency changes require a new pin and compatibility review. No claim of general schedule-reader equivalence is made.

Trusted retained history/fence evidence remains an explicit prerequisite; nonempty typed evidence fields do not independently prove real production history. The tested acknowledgment boundary is actual native consumer/outbox bookkeeping, not raw receiver-job acknowledgment or an external queue/transport. No authentic source/NLP or prospective performance claim follows from these synthetic already-bound fixtures.

Original full-52 acceptance remains withheld. The unchanged pure oracle retains 41/43 cases, 194/196 assertions and nine pure persistence deferrals; original ambiguous CR011/CR051 are preserved and the separate positive game fixtures do not replace them. Deployed exact schema/RPC/trigger/grant inventory, complete real writer fencing and retained history, genuine future cohort labels/metrics, migration/release/activation and dispatch/replay approvals remain separate gates. SQL4 stays staged outside the active migration tree; no route/caller/scheduler activates this API.

## Evidence integrity and checkpoint

All 73 pins and 11 live/snapshot read-only dependencies match before/after. All 854 prior reviewer files plus status addendum, including all 109 v1 review files, remain unchanged. The correction owner's 23-file artifact manifest matches SHA256 `5af94df3451b5c514c88c24c1b02b3f74996560777882aa7379124041bc04a4c`.

The owner disclosed an earlier replacement of its v1-only atomic probe. Its replacement hash and old expected hash are preserved in copied `owner-integrity.json`, and the current hash was independently verified; the historical owner artifact manifest is not presented as fully matching. The v1 complete results equal the retained final-pinned result byte-for-byte. Independent v1 evidence was unaffected. See `owner-evidence-disclosure-check.json`.

All 73 source review holds are released after final rehash. This new review root and all earlier reviewer roots will remain stable. No implementation/shared test/SQL edits, staging or commits occurred. No active review compiler/test or disposable PG cluster remains. No aggregate compiler/build, hosted action, production DDL, ingestion/dispatch/replay, forecast publication, push, deployment or activation occurred. Read-only dependencies remain owned by their existing owners; no other IFTTT runtime writer is known during the owner's freeze.

Reproduce from `web/` with `IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run ../tasks/ifttt-integration-2026-10-16/review-consumer-binding-v2/unchanged-contract.test.ts -t independent --no-file-parallelism --config ../tasks/ifttt-integration-2026-10-16/review-consumer-binding-v2/vitest.review.config.mjs`. Run `consumer-binding.test.ts` there for the frozen 26, or `nearby-consumer-binding.test.ts -t nearby` for the additional five. Scoped compiler project: `../tasks/ifttt-integration-2026-10-16/consumer-binding-increment/tsconfig.json`. All test clusters used fresh temporary Unix sockets, port 65442, TCP disabled, scrubbed PG variables and network-denying setup; each stopped and removed its cluster.
