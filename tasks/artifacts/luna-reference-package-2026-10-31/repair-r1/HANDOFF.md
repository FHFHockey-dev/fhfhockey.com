# Luna reference v2 — audit repairs and synthetic rehearsal

Local implementation is ready for independent re-review. **No paid requests, credential creation, hosted activation, production writes, builds or deployment occurred.** Code remains uncommitted on canonical `octoberBranch`; concurrent work is preserved. This handoff supersedes v1 implementation claims in the parent artifact directory, which remains historical evidence.

## Audit findings addressed

Read the full independent Astra result and probe evidence in thread `01a1936a-45ae-73d0-ae05-fe4339c5a022`.

| Finding | Repair and evidence |
| --- | --- |
| P1: synthetic-only variant existed only as a plan | Executable `referenceMode: "rules-and-synthetic-only"` omits all S01–S10 records, examples, labels and library metadata. It has its own package hash. Sixteen frozen packets, explicit labels and four eligible Decisions bindings are in `rehearsal/batch.json`. The real transport's 20 exact bodies/hashes are retained in `requests.json`; byte-bound and source-exclusion assertions pass. |
| P2: likely/projected accepted name-only, negative, backup or attendance evidence | Both exact evidence and governing subject sentence must contain the positive tentative starting predicate. First-off requires first-off evidence and projected status. Adversarial cases cover both tentative statuses, cropped evidence, unrelated likely/expected words, curly negation and modal conditions. Valid explicit likely/probable/projected/expected and first-off positives remain covered. |
| P2: confirmed accepted clipped false-prefix, unless condition or earlier version of a correction | Conservative subject-sentence gates retain governing negation/disavowal/conditions. Correction/update/retraction markers anywhere or repeated matched identity bindings hold non-unknown statuses. Exact-source/full-source definite wording checks remain. Regression covers all three audit probes, pronoun correction and repeated-name conflict without a correction marker; explicit affirmative, negative and warmup-starter controls pass. |
| P3: identity-only and outer goalie instructions conflicted | Trusted instructions now contain one strict outer `{identity,goalieStatuses}` contract. The unchanged nested identity instructions are explicitly scoped to `identity`, with an input scope marker. The conflicting identity-only instructions are no longer concatenated into the trusted outer instruction. Schema, identity hash and validator stay unchanged. |

The application changes are eight files: the prior reference module/document, review caller/tests and synthetic regression fixture; plus `tweetLunaGoalieWording.ts`, `fixtures/tweetLunaEvaluation.ts` and `scripts/rehearse-luna-evaluation.ts`. Exact bytes and protected prerequisites are pinned in `FILE-PINS.json`; `application.patch` is against the recorded current HEAD, including new files. The unchanged transport, admission store, manual paid CLI, S01–S10 library, identity proposal validator, hockey parser and Decisions reference all match the original protected hashes.

## Frozen synthetic variant

Batch hash: `3450aab7010da412d8e1922f8928f1369de1bd55508a860b9ce19f05e031cf74`.

- 16 fictional reports/identities/receipts cover explicit positive/negative starts, first-off, practice, warmups, backup, unless condition, surname collision, prompt injection, mixed subjects, later correction, history, PP versus even strength, Unicode and missing identity. No public source was fetched. These are exposed development examples, not independent real holdout or human ground truth.
- Four Decisions bindings: E01, E06, E10, E11. The existing deterministic mapper holds negative-start and first-off claims, so those stay in Responses. We did not weaken the mapper or fabricate supported bindings. Explicit statement/proposition/source-span hashes are frozen before mock replies.
- Budget: max 20 total requests (16 Responses + 4 Decisions), concurrency 1, **zero retries**, stop on held/uncertain outcome or label mismatch. Aggregate cap $1.00 includes $0.262519843 historical exposure; new maximum $0.737480157; per-request reservation $0.233. Recheck promotional headroom with $5 reserve before any future real execution. Frozen expiry November 1, 2026, 23:59:59 UTC; an expired plan needs renewed review, not a silent clock edit.
- `rehearsal.json`: 16/16 prescribed report results match; 20 synthetic receipts settle; no blocked ledger. Estimated new cost $0.045629544 is a diagnostic byte-based estimate, **not** a proved token/cost ceiling. Mock usage produced $0.000660000 synthetic accounting charges; actual provider calls/spend are **0/$0**. The full-context reservation and aggregate admission remain the spending control.
- The rehearsal has no paid switch, environment loader or network fallback. Its newly created ledger is explicitly synthetic; never reuse/reset it for paid requests. The actual manual worker remains default-off and requires an existing approved ledger, dispatch argument and both runtime gates. No paid batch executor was added.

## Verification actually run

Node 22.11.0, existing dependencies, no installation. Network-denial preload, empty inherited environment and Vite `envDir:false` were used for tests and standalone rehearsal.

- **243/243 tests passed in five files:** 114 Luna review/integration/library/regression/rehearsal, 43 identity proposal, 54 Decisions review, 16 review sidecar, 16 dated identity evidence. See `tests.log`. The 45 synthetic wording rows are part of the 114, not extra tests to add again.
- Scoped TypeScript: exit 0 (`typecheck.log`). ESLint across seven changed TypeScript files: exit 0 (`lint.log`). Tracked application diff whitespace check: exit 0.
- Standalone offline rehearsal: exit 0, 16 Responses and 4 Decisions mock calls, no real service attempt. See `rehearsal.log`, `rehearsal/batch.json`, `requests.json`, `results.json`, `rehearsal.json` and `SYNTHETIC-ONLY-ledger.json`.
- Tests also demonstrate whole-batch stop on an uncertain first call, retained reservation, no retry, refusal to overwrite an existing rehearsal directory, and detection of a schema-valid but label-wrong omission. Passing validator acceptance alone is not treated as correctness.

During construction, the first batch freeze correctly failed because E01 lacked explicit synthetic team context and E02/E03 were unsupported deterministic Decisions claims. The fixture was corrected to include explicit synthetic context and select four eligible affirmative bindings; no production policy was loosened. Earlier 106/110-test checkpoints are superseded by the final 243 combined run. No application build, browser test or live model-accuracy test was run.

Reproduce the artifact in a **new** output directory from `web/`:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_PATH=. NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowJs":false}' node --experimental-require-module -r ts-node/register/transpile-only scripts/rehearse-luna-evaluation.ts --output ../tasks/artifacts/luna-reference-package-2026-10-31/repair-r1/rehearsal-new
```

Node emits its experimental `require(ESM)` warning; execution completes successfully. `allowJs:false` prevents ts-node from rewriting the retained `.mjs` adapter.

## Limits and remaining handoff

The new guards are conservative lexical gates, not proof of general semantic understanding. Harmless update markers or consistent repeated names can be held. Unlisted paraphrases, pronoun-only contradictions, punctuation boundaries, missed subject extraction and cross-report/time relationships still need human review. All accepted proposals remain `verified:false`, game/team/override null, with source/game/time/conflict acceptance holds and no publication/alias/status/replacement authority. Broader injury/lineup/PP output still requires an explicit coordinated schema change.

No genuinely separated, reviewed, rights-cleared real evaluation set was available. Synthetic labels are frozen before predictions but assistant-authored and **pending independent review**. The mock run measures wiring/validation/budget behavior, not Luna accuracy or prompt-injection resistance. The parent owns independent re-review of these exact bytes before any paid evaluation.

Credential and spending actions are **pending**, not executed: [CREDENTIAL-HANDOFF.md](CREDENTIAL-HANDOFF.md) verifies the existing user-operated destination and loading requirements. The available key was expired at preflight. TJ is now preparing user-operated replacement entry; this worker has not inspected its outcome. Current promotional balance/concurrent spend must be rechecked, credential use authorized, and an authoritative ledger continuation/sequential execution plan reviewed. Prior uncertain exposure remains counted; the historical stop/ledger was not cleared or reset. Hosted state was not inspected; no activation/deployment was performed.

Parent reports a separate key worker's **Computer Use Terminal action was denied**, and no key was created by that worker. This action was not retried or rerouted. The restriction remains; user-operated setup instructions do not claim completion or agent credential authority.
