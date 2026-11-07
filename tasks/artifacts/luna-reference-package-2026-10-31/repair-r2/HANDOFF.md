# Luna reference v3 — second audit repair

Implemented locally on canonical `octoberBranch`, ready for independent re-review. **265 tests pass; no paid calls, secret reads, production writes, hosted activation, builds or deployment.** R1 artifacts remain unchanged as historical evidence. This candidate supersedes R1 for future evaluation.

## Latest audit findings

Read the complete latest final result and scorer/adversarial probe commands from independent audit thread `01a1936a-45ae-73d0-ae05-fe4339c5a022` before editing. All eight R1 source pins and seven protected pins matched at entry.

| Finding | Implemented repair |
| --- | --- |
| P2: equivalent evidence/order scored incorrectly | New `tweetLunaEvaluationScoring.ts` compares identity and goalie arrays by occurrence ID. Duplicate/missing/extra IDs or changed canonical IDs/statuses fail. Identity evidence stays exact. The frozen batch declares four goalie evidence alternatives per positive case: subject-only or complete synthetic prefix, each with/without terminal period. No alternative is inferred from an answer. Tests exercise all four E01 alternatives through the real validator/scorer, reverse both arrays in a two-goalie fixture, and reject wrong fields/duplicate IDs/name-only evidence. |
| P2: teammate predicate borrowed by named speaker | Likely/projected and first-off predicates must start directly after the exact named subject, allowing only a limited auxiliary grammar. “Jeremy Swayman says his teammate is likely/expected to start” and “…was first goalie off” now reject, including possessive-subject control. |
| P2: model abstention bypassed repeated-identity hold | The guard uses prepared source occurrences/canonical candidate overlap and repeated literal subject text. It does not count model-selected identities. A second `not_player`/`missing` reply cannot remove the hold; even an omitted duplicate literal mention in supplied occurrences is detected. |
| P3: valid probably forms rejected | “Will probably be starting” and “probably gets the start” now pass as likely; “probably will start” and “probably is the starter” are additional positives. Negated/modal and teammate forms stay held. |
| Pronoun contradiction limitation | A separate he/she/they starter/first-off/backup clause conservatively holds all non-unknown goalie proposals. The audit's “starts tonight. He will not start tonight” rejects even with evidence cropped to the first sentence. Unknown remains valid; an unrelated “He looked relaxed” control still passes. This does not resolve coreference or determine which assertion is true. |

The strict Responses schema is unchanged. Reference/rules are version 3; synthetic batch/scoring policy are version 2. All proposal authority restrictions and `verified:false`/null game/team/override acceptance holds remain. The transport, ledger implementation, manual paid CLI, S01–S10 library, identity validator, existing hockey parser and retained Decisions adapter are unchanged and pinned.

## Frozen batch and offline evidence

Batch: `467ae6dc553c05744ff5ff7e434a25f849d41497b746b82cef9d1dee806be3f9`.

Synthetic-only reference: `224cfbc4e68f605104c029f882fae7cd224ab300e44593a16345abf11537420b`.

Actual request-set hash: `3cbffb80eb9a02142d914ba99762bd8a1bfaa59b8c247ce421f70540263c66c1`.

`rehearsal/` contains the frozen 16 packets, labels, evidence alternatives, four original deterministic Decisions bindings, budget, exact 20 transport bodies, results and synthetic ledger. `equivalent-rehearsal/` repeats the real caller/transport/admission with permitted evidence variants and reversed identity arrays. **Both pass 16/16 reports with 16 Responses + 4 Decisions mock calls; their frozen batch and request bodies are identical.** Maximum request size 14,985 bytes, below 65,536. Source/library omission and exact binding checks pass.

Budget is unchanged: 20 total calls, concurrency 1, zero retries; aggregate $1 including prior exposure $0.262519843, new maximum $0.737480157, per-call reservation $0.233, expiry November 1, 2026, 23:59:59 UTC. The estimated new cost $0.046428586 is diagnostic, not a proven token/cost ceiling. Synthetic receipts charge $0.000660000 in each mock ledger. **Actual provider calls/spend: 0/$0.** Rehearsal ledgers must never be used for real spending. The two mock scenarios do not authorize two paid runs; the proposed paid batch remains at most 20 total calls.

Verification completed with Node 22.11.0 and existing dependencies:

- **265/265 tests across five files:** 136 Luna tests (including 57 synthetic wording rows), 43 identity proposal, 54 Decisions review, 16 review sidecar, 16 dated identity evidence. Network-denial preload, empty inherited environment, Vite `envDir:false`. See `tests.log`.
- Scoped TypeScript exit 0 and eight-file ESLint exit 0; tracked diff whitespace check passed. See `typecheck.log`/`lint.log` and `verification.json`.
- Baseline standalone rehearsal exit 0; equivalent-output standalone rehearsal exit 0, both network-denied. Exact outputs retained with their logs. No real model invocation or accuracy measurement.
- Independent-audit examples supply two positive probably expectations and three negative teammate expectations. Additional literal-repeat, pronoun-policy and scorer fixtures were declared before validator outputs. This provenance does not make them human ground truth or a fresh holdout.
- During test construction, four new scorer checks initially failed because the generic harness supplied a conditional Decisions label while the expected batch required direct assertion. Those focused evidence tests were correctly limited to the Responses leg. The full baseline/equivalent batch tests still exercise all four Decisions bindings and pass; no expected semantic label was weakened.

Reproduce baseline from `web/` using a **new** directory:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_PATH=. NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowJs":false}' node --experimental-require-module -r ts-node/register/transpile-only scripts/rehearse-luna-evaluation.ts --output ../tasks/artifacts/luna-reference-package-2026-10-31/repair-r2/rehearsal-new
```

For equivalent-output reproduction, the same offline Node preload/ts-node flags can call exported `rehearseLunaEvaluation(NEW_DIRECTORY, "equivalent-evidence-and-order")`; the nearest suite also runs it. This scenario changes only prescribed replies, not requests or labels. Node's experimental `require(ESM)` warning is expected; no dependency/tooling change was made.

## Residual limits and next gate

The subject grammar and sentence/pronoun guards are deliberately finite lexical checks, not complete hockey semantics. They may hold valid indirect phrasing, consistent repeated mentions, ambiguous candidate overlaps and pronouns concerning another player. Unlisted paraphrases/anaphora, differently written missing references, punctuation and cross-report/time relationships remain human review concerns. The guard never establishes a verified starter or factual truth.

The scorer recognizes a **frozen finite set** of valid evidence alternatives. Other exact but unlisted quotations may need human adjudication and a separately versioned evaluation policy; do not automatically expand labels from model output or equate an evidence-policy mismatch with a factually wrong identity/status. No independently reviewed, rights-cleared real holdout was supplied. Synthetic/mock results establish contract and integration behavior only.

Nine application files (eight TypeScript plus reference documentation) and all evidence are pinned in `FILE-PINS.json`; `application.patch` captures only those nine files against its informational HEAD. Context diary is excluded; unrelated checkout work is preserved. All seven protected prerequisites still match R1.

TJ confirms a new `OPENAI_API_KEY` was generated and saved in `web/.env.local`; this worker has neither read nor used it. TJ explicitly selected a **non-expiring restricted evaluation key**. The 24-hour duration was a user-changeable local proposal, so the exception is recorded in [CREDENTIAL-HANDOFF.md](CREDENTIAL-HANDOFF.md), with verified revocation/rotation required before any separately authorized production transition. That production gate is pending, not verified.

**Paid/key use is stopped:** the parent reports that an unrelated browser snapshot captured a secret from an open API-key dialog; the key's identity is not confirmed. Await TJ's explicit confirmation that the active evaluation key was not exposed or has been replaced after revocation of the exposed key. This worker did not inspect the secret or use the saved key. That security clearance is now required in addition to independent re-review, current promotional headroom/concurrent-spend and organization/project-scope verification, and an authoritative reviewed ledger continuation/sequential execution plan. Keep prior uncertain exposure and historical stop intact. Non-expiring access does not renew an expired batch or authorize ongoing dispatch. No paid batch executor, automatic key loader or production activation was added.

The separate worker's prior Computer Use Terminal denial was not retried or rerouted. TJ's user-operated save confirmation is distinct from that denied operation. No new approval denial or uncertain external outcome occurred in this repair.
