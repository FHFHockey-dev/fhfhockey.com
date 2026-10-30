# Independent occurrence identity review

Verdict: **corrections required for the new pure candidate**. R10–R12 reproduce unsafe identity/proof decisions; R13 prevents the runner from establishing its claimed complete CR019 immutability boundary. This verdict does not reopen the unchanged, independently accepted v4 local held/shadow slice. No durable integration, production or full 52-case acceptance is granted.

Reviewed manifest: `../occurrence-increment/owned-source-sha256.json`, 46 files, SHA256 **67c289b5336b08db0cb957f0df3abeaf9d13e8d263e7a9f844d7c6eb16cfbb3d**. Every pin matched before and after checks; all 41 v4 pins are identical. `evidence-summary.json` records exact hashes, results and CR019 output. `frozen-source/` and `frozen-owned-source-sha256.json` preserve the reviewed bytes. The copied `run-acceptance.ts` is byte-identical to the pinned owner's runner. The original oracle remains SHA256 `d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b`.

## Findings

All four findings are P2 blockers to accepting the new module/runner as a general identity compatibility implementation. The module is currently unwired, so these probes do not demonstrate a production regression.

1. **R10 — overlapping anchors allocate a second occurrence.** In `web/lib/sources/tweetClaimOccurrenceIdentity.ts:64–88`, candidates require exact anchors and new allocation has no overlap guard. In the same receipt and same immutable text, `Jordan Staal` with predicate `[13,26) = "will not play"`, followed by `[18,26) = "not play"`, is accepted as `occurrence:2`, with `nextToken:3`. This is a narrower extraction of the same lexical occurrence. Native r3 explicitly holds this at `tweetSourceClaimRegistry.ts:274–282` as `overlapping_same_text_anchor_change_held`. Reject/hold overlapping subject+predicate changes before allocation, including across receipts bound to the same original. Preserve genuinely disjoint occurrences.
2. **R11 — a new receipt bypasses the same-original cross-text hold.** At identity module lines 65–67 and 84–85, the original match requires equal text/anchors, but the different-text guard checks only receipt equality. Retain original `9900000000000000001`, `fixture_a`, publication `2026-10-15T12:00:00Z`, text ending `tonight.` at receipt A; submit the same original at receipt B with text ending `tomorrow.`. Both are accepted as different tokens without a distinct-document/alignment proof. The same-original lineage must govern the hold, including aliases/cross-root receipts; changing a receipt must not manufacture evidence of a new occurrence.
3. **R12 — distinct-document validation ignores input span ends.** At identity module lines 111–113, the validator compares relative starts and text only. A valid disjoint full-document proof still returns true when the input `subjectSpan.end` or `predicateSpan.end` is changed to 0 or 999. Four independent assertions fail. Validate both input spans against their own complete source text and compare both relative endpoints, before treating the full document as evidence for those exact inputs. This is a standalone validator defect; `planOccurrenceIdentity` independently rejects invalid spans and the runner does not invoke this validator.
4. **R13 — CR019's immutable-row metric does not measure immutable rows.** `offline-completion/run-acceptance.ts:212` counts only whether the first effect key changes. It never compares the previously retained held evidence/interpretation rows. The review-only `run-acceptance-mutation.ts` deliberately rewrites the earlier CR019 pending interpretation's `parserVersion` to `REVIEW_DELIBERATE_OLD_ROW_REWRITE`, retaining its original version ID. CR019 still passes all four assertions and reports `immutableRowReplacementCount:0`. See `acceptance-mutation.log` and `mutation-acceptance-identity-candidate-results.json`. This negative control proves a harness gap, **not** that the actual candidate rewrites that row. Snapshot complete prior immutable rows and compare exact retained bytes/payloads after every step, including removal; retain the original oracle assertion and prove it catches deliberate mutation.

The owner acknowledged R10–R12 before release. R13, exact results and the explicit release were also sent directly to the owner.

Report provenance caveat: even candidate-mode output currently names `../next-increment/owned-source-v4-sha256.json`. That manifest omits this identity module and runner. Future reports should identify the actual occurrence manifest/hash as well as their unchanged v4 baseline. The review's own manifest and snapshots remove ambiguity for these results.

## What is supported

The unchanged author's ten tests pass. Exact retained-receipt/text/subject/predicate proof preserves the allocator token; missing/future/forged proofs, immutable same-ID payload collisions, binding conflicts and multiple allocated provisional-root convergence reject in those tested cases. The earlier derivation and input state remain unchanged in the positive test. The six added independent safety assertions all fail and are preserved unchanged in `independent-regressions.test.ts`.

CR019's canonical field projection is a **real caller-retained counter allocation**, not a fixture record label, resolved player/scenario hash, or literal expected answer. Its final state contains one token, two derivations and one appended provenance binding; both outputs use `dsl-identity:CR019:occurrence:1`. Native r3 IDs remain separately exposed and distinct. Interpretation version IDs are distinct. This supports the narrow positive identity projection under the explicit synthetic proof. R13 means the four passing machine assertions cannot establish the complete claimed immutable-row semantics.

The runner does not call `verifyDistinctOccurrenceDocument`, nor synthesize a full original document from CR011/CR051 snippets. Those cases remain held/failed. A validator supplied with synthetic full-document evidence cannot authenticate that document or establish its historical retention.

## Checks actually run

| Check | Result |
| --- | --- |
| All 46 frozen files, unchanged 41-file v4 subset, copied runner and original oracle | Match |
| Author identity tests plus independent regressions, with review network-denial setup | 10 passed; 6 failed; exit 1 |
| Byte-identical pure runner, baseline | 40/43 cases; 193/196 assertions pass; CR011/CR019/CR051 fail; 9 deferred; exit 1 |
| Same runner, `--occurrence-identity-candidate` | 41/43 cases; 194/196 assertions pass; CR011/CR051 fail; 9 deferred; exit 1 |
| Review-only deliberate immutable-row mutation control | CR019 still reports passed; same 41/43 and 194/196; expected evidence of R13 |

Run from `web/`:

```sh
npm test -- --run lib/sources/tweetClaimOccurrenceIdentity.test.ts ../tasks/ifttt-integration-2026-10-16/review-occurrence/independent-regressions.test.ts --config ../tasks/ifttt-integration-2026-10-16/review-occurrence/vitest.review.config.mjs
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../tasks/ifttt-integration-2026-10-16/review-occurrence/run-acceptance.ts
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../tasks/ifttt-integration-2026-10-16/review-occurrence/run-acceptance.ts --occurrence-identity-candidate
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../tasks/ifttt-integration-2026-10-16/review-occurrence/run-acceptance-mutation.ts --occurrence-identity-candidate
```

No compiler, build, browser, database or consumer test was run in this increment. The owner's targeted strict typecheck/lint claims were not independently rerun. No test/compiler/database process remains running in this reviewer thread.

## Exact remaining gates

1. Correct and repin R10–R13; rerun the six reviewer assertions unchanged, positive disjoint/exact-proof controls, complete immutable-row mutation control, and unchanged oracle. Preserve baseline reports and failures. The new candidate stays excluded from release until independently accepted.
2. CR011 and CR051 still lack the required retained full-document/new-occurrence proof. Do not weaken their assertions or infer proof from scopes, game IDs, snippets, or generic alignment labels. Preserve holds until genuine evidence or explicitly approved semantic policy resolves the cases.
3. Persist/reload the identity state, allocator and native-to-canonical projection under the existing global context CAS. Reconcile the entire linked component and prior effects. Verify actual hook/RPC behavior, restart, concurrent first allocation, acknowledgement loss, immutable readback and exact legacy aliases/receipts before operational use. Current pure counters and proposals satisfy none of those durable requirements.
4. The exact deferred DSL gates remain: **CR036** immutable evidence key/payload collision; **CR037** every legacy same-key conflict preserving parent/suppressing children; **CR039** pre-commit interruption; **CR040** lost registry acknowledgement/readback; **CR041** lost parent acknowledgement/exact readback before children; **CR042** retained transition/effect reuse under positive no-dispatch proof; **CR043** unknown dispatch outcome/no blind resend; **CR044** delivered receipt suppressing replay despite queue failure; **CR052** concurrent CAS and losing-writer reconciliation. Earlier v4 tests establish only their separately documented bounded cases; this pure runner defers all nine exact DSL contracts.
5. Prior v4 operational gates remain unchanged: authentic dated source/provenance and legacy/writer/consumer inventory, history/retention/fence evidence, future cohort/adjudication/export, and separately approved activation/release prerequisites. The inherited catalog-read denial below leaves hosted prerequisites unverified.

## Ownership, release and external-action status

This reviewer changed **only** `tasks/ifttt-integration-2026-10-16/review-occurrence/*`. Previous `review/`, `review-v2/`, `review-v3/`, `review-v4/` and `review-checkpoint/` artifacts remain unchanged. Frozen source snapshots are audit evidence, not a deployment candidate. No files were staged/committed, and no runtime/test/SQL implementation file was changed by this reviewer.

All 46 pins were rechecked unchanged immediately before explicitly releasing the owner's hold. The owner may now make bounded corrections and produce a new manifest; this verdict remains attached to the frozen hash above. Review artifacts are stable after their manifest is written. No other IFTTT runtime writer is known; unrelated repository writers were not stopped or audited.

No production write/DDL, hosted source read, ingestion, replay, dispatch, migration, scheduler/forecast activation, push or deployment was performed. There is no uncertain external outcome from this reviewer.

The implementation owner's earlier connected Supabase `execute_sql` action for `schema-relations.sql`, targeting shared/production project `fyhftlxokyjtpndbkfse`, was **denied before execution by automatic approval review**. Its stated reason was that the trusted task prohibited live reads and no later trusted user message expressly authorized that hosted query. Query two was not attempted; no hosted schema/ACL evidence was obtained. This reviewer did not retry or bypass it. The owner's direct-user approval question remains pending; see `../offline-completion/CATALOG-READ-BLOCKED.md`.
