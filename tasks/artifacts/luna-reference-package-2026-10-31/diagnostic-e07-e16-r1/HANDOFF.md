# E07–E16 diagnostic proposal R1 — offline repairs, inactive

**Both P2 findings are repaired in a separate, inactive revision. No paid calls, credentials, application changes, ledger activation or production action occurred.** The real ledger remains disabled with seven calls, **$0.265263690 exposure**, the historical uncertain reservation, $1 cap and zero retries unchanged. Independent re-review is pending.

The original [diagnostic proposal](../diagnostic-e07-e16/HANDOFF.md), all 41 of its pinned artifacts and every historical failed grade remain intact. That proposal was rejected as pinned: its claim that all saved artifacts were rechecked was too broad. This revision replaces it for review; neither version is activated.

## P2 repairs

**Explicit incomplete/error indicators:** [diagnostic-policy.ts](diagnostic-policy.ts) now applies the same rejection rule to Responses and Decisions: any non-null `error` or `incomplete_details`, or any supplied non-completed status, prevents advancement. It also checks Responses-message and Decisions-answer indicators. Responses still require `status:"completed"`. Decisions may omit status, matching the existing provider contract; absence is not converted into a claim of completion. A positive regression accepts valid completed/null-indicator receipts, while the original status-less Decisions fixtures still pass.

Classification remains post-report, using the existing caller's unchanged conditional Decisions behavior. These checks prevent advancing to another report; they do not introduce a new transport or change the existing caller. As before, the bounded CLI can consume its scheduled same-report Decisions leg before post-report classification. The maximum two calls for each E10/E11 report already includes that leg.

**All artifacts and full ledger contents:** the new read-only [diagnostic-checkpoint.ts](diagnostic-checkpoint.ts) replaces checks limited to selected files and ledger keys/states. After a case is classified and its files are durably written, it binds:

- the exact bytes of the original review, complete per-case receipt rows, separate candidate or explicit absence record, and diagnostic disposition;
- the complete ledger snapshot digest, including every old/new receipt body, usage/charge, reservation, request ID, attempt state, count and policy/accounting field;
- the case ID, ordered admitted hashes and previous checkpoint's trusted hash.

Expected file hashes come from the in-memory outputs just checked, not from blindly accepting whatever bytes happen to be on disk. The checkpoint itself is written exclusively and fsynced. Its expected hash is retained by the supervising process as a trusted anchor. Before every next invocation, the helper re-reads **all four artifacts and the checkpoint for every previous case**, checks their exact hashes and chain, cross-checks saved receipt rows against the ledger, and verifies every complete ledger prefix against its checkpoint. The pinned starting seven-receipt prefix and policy fields are rechecked as well.

The current call's before/after ledger comparison rejects changes to earlier receipts or policy fields during the call. Final completion performs another complete integrity check before writing the completed stop. Missing, altered, deleted or unexpected records cause a durable operational stop; the checker never repairs receipts, resets counts, releases reservations or regenerates an expected anchor from changed data. A corrupted or unverified case cannot count as a pass.

These are integrity checks, not cryptographic authentication of a hostile local operator. A future supervisor must retain the trusted checkpoint hashes independently of mutable case files and record them in its execution evidence; reopening a file and treating its newly computed hash as expected is prohibited. The helper remains artifact-local and has no application consumer.

## Unchanged frozen sequence and limits

Order: **E07 → E08 → E09 → E10 → E11 → E12 → E13 → E14 → E15 → E16**. Each has one Responses call; E10/E11 have Decisions only if their original Responses validates in the existing caller. A collectible held Responses permanently withholds that case's Decisions leg. A candidate cannot force it.

| Case | Potential new-call ordinals | Maximum cumulative ordinals |
| --- | --- | --- |
| E07 | 1 | 8 |
| E08 | 2 | 9 |
| E09 | 3 | 10 |
| E10 | 4–5 | 11–12 |
| E11 | 6–7 | 13–14 |
| E12 | 8 | 15 |
| E13 | 9 | 16 |
| E14 | 10 | 17 |
| E15 | 11 | 18 |
| E16 | 12 | 19 |

These ordinals assume both conditional Decisions legs run; later actual ordinals decrease when a leg is withheld. Maximum **12 new calls and 19 cumulative**. The global 20-call cap remains; the unused slot cannot be repurposed. E01–E06 and E06's unsent Decisions remain excluded.

Starting exposure remains **$0.265263690**, with **$0.734736310** headroom under the same $1 cap. Preserve **$0.254394800 historical uncertainty** within $0.262519843 prior exposure. Each request still needs a full **$0.233000000 reservation**. Zero retries; concurrency one; unchanged November 1, 2026 23:59:59 UTC expiry and $5 promotional reserve. The unchanged request-cost estimate is $0.030071588, not a token ceiling, guaranteed spend or invoice.

[PACKETS.json](PACKETS.json), [REQUESTS.json](REQUESTS.json), dated candidates, labels, evidence variants and Decisions bindings are byte-identical to the preceding proposal. [DIAGNOSIS.json](DIAGNOSIS.json) preserves the E02/E03/E06 offset finding; no raw response or failing grade was modified. All cases are exposed synthetic development material, not a holdout or human ground truth; S01–S10 remain absent from the request variant.

The six narrowly allowlisted goalie model-validation failures and valid-schema frozen-label mismatches remain recorded failures. Correction candidates remain separate and unapplied; they cannot affect scores, case selection, Decisions inputs or publication authority. Transport uncertainty, unresolved Decisions, malformed/schema output, unlisted validation failures and operational gates still stop. The proposed policy version is now `luna-exposed-diagnostic-collection-v2`.

## Actual offline verification

**59 final scenarios passed; scoped TypeScript passed.** Seven complete-collection scenarios retain the original success/failure distinctions, including valid completed/null-indicator receipts, status-less Decisions, label mismatches and repeated offset failures with separately saved candidates. The other 52 scenarios stop as specified.

The 34 additions to the original 25 checks cover:

- One positive completed/null-indicator scenario and 14 explicit failure-indicator scenarios across both endpoints, Responses messages and Decisions answers. The audit's `status:"incomplete"` and non-null `incomplete_details` Decisions probes now stop at E10 after five mock calls, before E11.
- Corruption and deletion of each of the four required artifact files and checkpoint file after E07 persistence. Every case stops before E08 after one mock call.
- Collected ledger receipt corruption, ledger-row deletion, starting-receipt corruption, policy-field changes, and the exact combined saved-receipt/candidate/ledger corruption probe. All stop before E08. Expected hashes are not re-baselined.
- Corruption/deletion of an actual bound E10 candidate, stopping before E11; mutation of a prior ledger receipt during E08, stopping before E09; and deletion after E16 persistence, preventing a successful completion declaration.

Tests use an empty inherited environment, a network-denial preload, prescribed fetch mocks and disposable ledgers only. Every final synthetic ledger is disabled, with a post-stop reservation probe rejected. The single test that deliberately corrupts one of the starting receipts reports that injection explicitly; the helper detects it, and the test does not silently repair it. **The real seven receipts, historical ledger and all original artifacts remain unchanged.** Raw grades are retained, while corrupted or operationally unverified results are excluded from pass counts.

[OFFLINE-VERIFICATION.json](OFFLINE-VERIFICATION.json), [COLLECTION-RESULTS.json](COLLECTION-RESULTS.json), [OFFLINE-RESULTS.json](OFFLINE-RESULTS.json), [offline-verification.log](offline-verification.log) and [typecheck.log](typecheck.log) retain evidence. The mock [E10 original failure](OFFSET-E10-original-review.json) remains separate from its [unapplied candidate](OFFSET-E10-separate-candidate.json). Prescribed mock replies verify controls, not model accuracy. No application suite/build was rerun because application code did not change.

Reproduction from `web/`:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_PATH=.:./node_modules NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowJs":false}' node --experimental-require-module -r ts-node/register/transpile-only ../tasks/artifacts/luna-reference-package-2026-10-31/diagnostic-e07-e16-r1/verify-continuation.ts
env -i PATH="$PATH" TMPDIR=/tmp NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' ./node_modules/.bin/tsc --noEmit --incremental false -p ../tasks/artifacts/luna-reference-package-2026-10-31/diagnostic-e07-e16-r1/tsconfig.json
```

The verifier refuses arguments and overwriting saved outputs. Repeat through a reviewed compare-only replay or alternate destination; preserve frozen evidence.

## Pending gate and exact pins

Independent re-review must accept this exact revision before use. Later execution still requires fresh funding/concurrent-spend, restricted credential, exact ledger/pin/expiry checks and supervised adoption of the checkpoint helper. No old execution script may silently adopt the changed policy. The owner-authorized non-expiring key does not extend batch expiry; verified rotation/revocation before production remains required.

- Plan SHA256: `2e134fc39e89fa800c76d312fd9793271886f8105a31aea16989d12d8e4aa4d9`.
- Classifier SHA256: `5e96e99beb1558c66f00c73cdce49f3b722cbdf7f4395f6fbb6388ec7cd1da20`.
- Checkpoint helper SHA256: `b10ab32677a05590028e236ee721ae12077e7943e28b82414172fb014fab87c9`.
- Unchanged packets SHA256: `b50ace71b2f7ad72d6ea86cbeb93c7427b729b1d44b5d623369f5777e98fef41`.
- Unchanged requests SHA256: `d59caecc7bb6d2c237c49d437259c66a7cbf097e232c71d538dc63a41cfc6fc4`.
- Disabled seven-call ledger SHA256: `2bf56d754b1f98888785b8d7e759d1c701b5541b0fb9e91ade63eff041ff3ceb`.

[FILE-PINS.json](FILE-PINS.json) pins this revision. No action was denied and no new provider outcome is uncertain; re-review and fresh execution preflight are pending. Hosted dispatch, production authorization, publishing and deployment remain disabled or untouched.
