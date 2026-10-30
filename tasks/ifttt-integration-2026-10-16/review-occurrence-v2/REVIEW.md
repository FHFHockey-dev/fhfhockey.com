# Independent occurrence v2 review

Verdict: **R10–R13 closed within the bounded pure candidate.** Accept the tested allocation/native-ID projection, conservative occurrence/proof holds, and corrected per-step immutable-row audit. No new finding arose in this rerun. This does not accept durable occurrence integration, full 52-case completion, delivery, production activation or future performance. The separate accepted v4 local held/shadow boundary is unchanged.

Frozen candidate: `../occurrence-increment/owned-source-v2-sha256.json`, **49 files**, SHA256 **b113230355acae6cbc3c1c75bad94d6d56afa9d65b6061effed651d79c90789a**. All hashes matched before and after checks. All 41 v4 pins, both staged SQL files, original cloud r3 registry, reconciled adapter, reducer and original oracle remain unchanged. The original oracle SHA256 is `d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b`.

`frozen-source/` and `frozen-owned-source-sha256.json` preserve exact reviewed bytes. `pin-check-before.json` and `evidence-summary.json` record inventory and result checks. Earlier 213 checkpoint artifacts plus 61 occurrence-v1 artifacts were rehashed unchanged. Historical failures and their original review were preserved.

## Independently verified corrections

- **R10:** overlapping same-text subject/predicate changes now hold before allocation. The unchanged original reviewer probe rejects the narrower `not play` anchor and retains the complete prior state. Nearby owner tests cover cross-receipt overlap and genuinely disjoint repeated lexical occurrences.
- **R11:** different text of the same bound original holds across receipts. The unchanged reviewer `tonight.`/`tomorrow.` probe no longer allocates a second token. The new original-ID consistency guard also rejects conflicting author/publication evidence in the tested cross-receipt cases.
- **R12:** the document validator checks exact input spans and both relative endpoints. All four unchanged invalid-end probes now reject; nearby owner tests cover either input side. The explicit valid disjoint-document control still passes.
- **R13:** the runner snapshots prior immutable registry and candidate identity payloads before each ingest, then compares them afterward. This includes held evidence/interpretations before any effect exists. It preserves append-only anchors/links/membership and documented mutable effect status fields while detecting prior immutable rewrites/removals and duplicate retained IDs in the tested cases. The metric no longer depends solely on the first effect key.

The last point was independently tested with the **same deliberate earlier pending interpretation rewrite** used in v1: `parserVersion = "REVIEW_DELIBERATE_OLD_ROW_REWRITE"`. The corrected audit identifies the exact prior interpretation row, reports `immutableRowReplacementCount:1`, and the unchanged CR019 assertion at index 2 fails. The normal run reports 0. The owner's separate `--mutation-control` produces the same failure. These are intentional negative controls, not observed planner mutations.

## Exact results

| Check | Outcome |
| --- | --- |
| Identity tests | 15 passed |
| Immutable-audit tests | 16 passed |
| Six original reviewer safety regressions, copied byte-identically | 6 passed |
| Total focused tests, network-denial setup enabled | **37 passed, 0 failed; exit 0** |
| Byte-identical copied runner with candidate flag | **41/43 pure cases, 194/196 assertions pass; exit 1** |
| Same runner with independent reviewer mutation | **40/43, 193/196; CR019 additionally fails as required; exit 1** |
| Same runner with owner's mutation flag | **40/43, 193/196; CR019 additionally fails as required; exit 1** |

The normal runner retains failures CR011 and CR051 and defers nine persistence cases. Every executed assertion was compared structurally with the unchanged oracle. The CR019 output records are identical to v1's actual allocator/native-ID projection: one canonical allocated token, distinct native r3 IDs and interpretation versions, one hypothetical initial proposal under the explicit synthetic absence proof. The new audit adds the previously missing observation of complete prior immutable payload retention. Candidate output now identifies the correct v2 manifest and its exact hash, separately from the v4 runtime baseline.

The reviewer runner and audit copies are byte-identical to the pinned owner files. Only `run-acceptance-mutation.ts` contains the clearly marked independent fault injection and separate output filenames. All logs and full JSON outputs are retained beside this report.

Run from `web/`:

```sh
npm test -- --run lib/sources/tweetClaimOccurrenceIdentity.test.ts ../tasks/ifttt-integration-2026-10-16/occurrence-increment/immutable-registry-audit.test.ts ../tasks/ifttt-integration-2026-10-16/review-occurrence-v2/independent-regressions.test.ts --config ../tasks/ifttt-integration-2026-10-16/review-occurrence-v2/vitest.review.config.mjs
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../tasks/ifttt-integration-2026-10-16/review-occurrence-v2/run-acceptance.ts --occurrence-identity-candidate
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../tasks/ifttt-integration-2026-10-16/review-occurrence-v2/run-acceptance-mutation.ts --occurrence-identity-candidate
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../tasks/ifttt-integration-2026-10-16/review-occurrence-v2/run-acceptance.ts --occurrence-identity-candidate --mutation-control
```

No aggregate compiler, build, browser, database or consumer check was started. The owner's targeted strict typecheck/lint claims were not independently rerun. No tests, compilers or database processes remain running in this reviewer thread.

## Remaining gates and rejected extensions

1. **CR011/CR051:** retained full-document/new-occurrence proof or an explicitly approved semantic policy remains unresolved. The runner does not call the full-document validator or fabricate a source document from the two snippets. Different scopes/game IDs are insufficient proof. Their assertions remain unchanged and failed.
2. **Durable occurrence integration:** this module remains pure/unwired. Persist/reload the allocator and identity state with the canonical projection under global context CAS; reconcile every linked original/receipt and prior effect. Independently verify actual hook/RPC paths, concurrent first allocation, losing-writer readback, restart and acknowledgement loss, immutable parent readback, exact historical aliases/receipts and sink/consumer behavior. This review establishes none of those new durable properties.
3. **Exact deferred DSL cases:** CR036, CR037, CR039, CR040, CR041, CR042, CR043, CR044 and CR052 remain deferred. They cover immutable conflicts, legacy child suppression, interruption/recovery, reservation/delivery acknowledgement boundaries and concurrent commit. Earlier bounded v4 storage evidence does not automatically satisfy all exact DSL contracts for this new identity module.
4. **Operational prerequisites:** authentic source and legacy/writer/consumer inventory, dated retention/fence proofs, genuine prospective cohort/adjudication/export, migration/deployment approval and bounded activation remain separate gates. Both SQL proposals remain staged and unapplied. No dispatch/replay or operational exactly-once guarantee is accepted.

## Ownership and release checkpoint

Reviewer ownership is only `tasks/ifttt-integration-2026-10-16/review-occurrence-v2/*`. No runtime/source/test/SQL implementation file was changed, and no file was staged or committed. All earlier review roots remain stable. Review source snapshots and deliberate mutation scripts are audit evidence, excluded from runtime/release inputs.

All 49 source pins were rehashed unchanged immediately before the explicit release message to owner thread `01a14299-0127-7424-85aa-42578c6740ef`. **The source hold is released.** Any subsequent implementation change needs a new manifest and applicable review; this acceptance remains tied to the frozen hash above. The owner is the only known IFTTT implementation writer; unrelated repository work was preserved and not audited or stopped. These new review artifacts will remain stable after their manifest is written.

No hosted read, production write/DDL, ingestion, migration, dispatch, replay, scheduler/forecast activation, push, deployment or remote build occurred in this reviewer increment. No action has an uncertain external outcome.

Inherited external blocker remains unchanged: the owner's earlier `schema-relations.sql` request through connected Supabase `execute_sql` against shared/production project `fyhftlxokyjtpndbkfse` was **denied before execution by automatic approval review** because the trusted task prohibited live reads and no later trusted user message expressly authorized the hosted query. The second statement was not attempted. No retry or bypass occurred here; the owner's direct-user approval question remains pending. See `../offline-completion/CATALOG-READ-BLOCKED.md`.
