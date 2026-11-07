# Frozen E04–E16 continuation — preparation only

Prepared the remaining 13 reports for independent plan review after acceptance of the optional local span-binding integration. **No API calls, retries, credential access, real-ledger activation, application edits, deployment or production action occurred.** The real ledger remains disabled with all four current-evaluation receipts and historical exposure unchanged.

E01–E03 are excluded from this continuation's dispatch and receipt replay. Their original failures remain authoritative: E01's omission consumed two calls; E02/E03's coordinate mismatches consumed one each. Separate correction candidates are unaccepted review material, not repaired model grades, refunded calls or authority to continue.

## Exact frozen sequence

The primary plan uses **13 Responses + 3 Decisions = at most 16 new calls**, bringing the existing four to the cumulative 20 limit. Every selected request hash is absent from the real ledger. Packets, dated candidates, labels, allowed evidence variants and Decisions bindings are unchanged from the original v4 synthetic rehearsal; model request bodies are unchanged by the optional binding wrapper.

| Case | New calls | Cumulative calls | Endpoint order |
| --- | --- | --- | --- |
| E04 | 1 | 5 | Responses |
| E05 | 2 | 6 | Responses |
| E06 | 3–4 | 7–8 | Responses, Decisions |
| E07 | 5 | 9 | Responses |
| E08 | 6 | 10 | Responses |
| E09 | 7 | 11 | Responses |
| E10 | 8–9 | 12–13 | Responses, Decisions |
| E11 | 10–11 | 14–15 | Responses, Decisions |
| E12 | 12 | 16 | Responses |
| E13 | 13 | 17 | Responses |
| E14 | 14 | 18 | Responses |
| E15 | 15 | 19 | Responses |
| E16 | 16 | 20 | Responses |

[PLAN.json](PLAN.json) freezes every endpoint/hash/byte count. [REQUESTS.json](REQUESTS.json) contains the 16 exact transport bodies; [PACKETS.json](PACKETS.json) and `inputs/` contain only E04–E16. S01–S10 are absent from this request variant. All cases are **exposed synthetic development material**, not an independent holdout or human ground truth. Uncalled does not mean unseen or independent.

## Same budget, same retained history

| Control | Value |
| --- | --- |
| Cumulative maximum | 20; four consumed, at most 16 new |
| Retries / concurrency | 0 / 1 |
| Aggregate exposure ceiling | $1.000000000 |
| Starting exposure | **$0.263950397** |
| Remaining additional exposure | **$0.736049603** |
| Historical carried exposure | $0.262519843 |
| Included unresolved historical reservation | **$0.254394800** |
| Reservation before each call | $0.233000000 |
| Promotional safety reserve | $5.00; requires fresh live verification |
| Unchanged policy expiry | November 1, 2026 23:59:59 UTC |
| Diagnostic remaining-cost estimate | $0.039183330; not a token ceiling or invoice |

The call allowance is an upper bound, not a guarantee that all 16 requests fit after actual usage settles. Each full reservation must still fit under the same aggregate ceiling. Preserve the historical uncertain reservation; do not resolve or retry it by assumption.

[START-LEDGER.json](START-LEDGER.json) is an exact copy of the current disabled four-attempt ledger, SHA256 `fc59014d3ff7f3abdfdec0703ffa77f80e5d02ef764f19d21cb85fc08adbd8f2`. The archived historical ledger remains unchanged at `e8418735afaeff893177e550df6774600c6c6fec4f49c2b01c183712cdc064f2`.

A future separately approved activation may change only the planned policy ID, enabled flag and known continuation-stop reason. Preserve all four attempts/receipts verbatim and preserve version, prior exposure, cap, maximum calls and expiry. Do not create another real ledger, move attempts into a balance field, clear an uncertain-outcome stop or use a new package/plan hash to reset admission.

## Binding candidates do not change continuation criteria

The selected implementation is the accepted existing manual CLI, one saved packet at a time, with a separate new `--binding-candidate-output` file alongside the original review output. No new HTTP runner or live intake hook exists. The explicit binding policy remains `luna-unique-exact-quote-review-v1`; bound artifact version is `luna-bound-evidence-review-v1`.

Only `scoreLunaEvaluation(entry.expected, ORIGINAL_REVIEW)` determines the report's grade. A derived candidate, coordinate acceptance or other human feedback cannot replace that result, lift its holds, change a label, release money or permit the next report. All current source/game/conflict and human-review restrictions remain.

Before each future invocation, verify pins, fresh funding/concurrent-spend and restricted credential scope, exact preserved-four-plus-completed-prefix ledger state, expiry and reservation headroom. All previous reports in this continuation must have passed their original grades and all prior current attempts must be settled. E01–E03 remain excluded. Prior E02/E03 operator scripts have stale counts/pins and must not be reused unchanged.

After each report, grade the original output and check the actual admitted request prefix and settled usage. **Durably disable the same ledger before any further invocation** on schema/label failure, provider/CLI error, uncertainty, unresolved Decisions, changed pins/sequence or failed funding/budget/expiry checks. Preserve an existing unknown-outcome stop reason. Disable after successful E16 completion as well. A failure stops the plan; there is no automatic resume, retry, skip, reordering or substitution.

The unchanged caller validates Responses before its scheduled Decisions leg. A schema-valid but label-wrong Responses result can therefore incur the same report's Decisions call before report-level grading; this was already part of the reviewed flow. An invalid evidence span holds before Decisions. Both paths are explicitly rehearsed below.

## Actual offline rehearsal

The verifier uses the accepted optional wrapper, existing caller/transport/admission/scorer, frozen requests and prescribed replies. Disposable synthetic ledgers begin with exact copies of all four existing attempts; only those temporary copies are enabled. The verifier has no credential/environment loader, real fetch fallback, activation mode or paid-dispatch option. Existing dependencies, empty inherited environment and network-denial preload were used.

| Scenario | New mock calls | Result |
| --- | --- | --- |
| All pass | 16 | 13 reports pass; 20 cumulative attempts; ledger durably disabled on completion |
| Uncertain first Responses | 1 | Full new reservation retained; unknown-outcome reason preserved; stop |
| E04 valid-schema identity label mismatch | 1 | Original grade fails; durable stop |
| E04 schema escape | 1 | Held; durable stop |
| E06 wrong offset with valid separate candidate | 3 | E04/E05 pass; E06 original fails; candidate stays separate; **no E06 Decisions or E07** |
| E06 schema-valid goalie omission | 4 | Same report's Decisions completes; original grade fails; no E07 |
| Uncertain E06 Decisions | 4 | Full unresolved reservation retained; no E07 |
| Disabled ledger | 0 | Admission blocked |
| Insufficient full reservation | 0 | Admission blocked |
| Expired policy | 0 | Admission blocked |

All ten scenarios passed. Every end-state ledger was disabled using file+directory fsync, and a subsequent admission probe was rejected. In the full case, request 21 was rejected after the completion stop; the ledger contained exactly 20 attempts and retained its max 20 setting. Every scenario preserved the four prior attempts and original exposure fields. Temporary ledgers were removed; the real and archived ledgers were unchanged.

[OFFLINE-VERIFICATION.json](OFFLINE-VERIFICATION.json), [OFFLINE-RESULTS.json](OFFLINE-RESULTS.json) and [offline-verification.log](offline-verification.log) retain outcomes. [binding-stop-E06-original-review.json](binding-stop-E06-original-review.json) and [binding-stop-E06-candidate.json](binding-stop-E06-candidate.json) demonstrate a valid candidate alongside a stopped original failure. No human decision was recorded. Synthetic usage charges are not actual spend; prescribed-answer passes do not measure model accuracy.

Scoped verifier TypeScript passed, exit 0. All 18 accepted application pins matched. No application suite/build was rerun solely for artifact preparation; the independent integration review already verified 206 tests, 17 extra probes, TypeScript/lint and saved-receipt CLI replays. No application code changed here.

Reproduction from `web/`:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_PATH=. NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowJs":false}' node --experimental-require-module -r ts-node/register/transpile-only ../tasks/artifacts/luna-reference-package-2026-10-31/continuation-v4-e04/verify-continuation.ts
env -i PATH="$PATH" TMPDIR=/tmp NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' ./node_modules/.bin/tsc --noEmit --incremental false -p ../tasks/artifacts/luna-reference-package-2026-10-31/continuation-v4-e04/tsconfig.json
```

The verifier refuses arguments or overwriting its saved outputs. Use a separately reviewed copy/destination for another rehearsal; no invocation is a paid retry. The expected Node experimental ESM warning is retained in the log.

## Alternative and remaining gate

[ALTERNATIVE-DESIGN.md](ALTERNATIVE-DESIGN.md) proposes a mutually exclusive coverage-first order: nine abstention/context cases, then four positive wording cases. It could reduce coverage lost to another early coordinate failure while preserving every validator, original grade, stop rule, budget and authority restriction. **It is not selected, frozen as an executable alternative, or authorized.** Adopting it requires a replacement sequence and independent review before execution; it is not a second 16-call allowance and cannot be silently chosen after a failure.

**Independent review of this exact continuation is pending.** Fresh live grant/concurrent-spend, active restricted replacement credential, pins, starting ledger and expiry checks remain mandatory before any separately approved paid execution. Old billing observations are historical, not current evidence. The owner's non-expiring key choice does not extend this batch's expiry; verified revocation/rotation before production remains separate.

There is no denied or uncertain new action in this preparation. Broader model qualification, rights-cleared independent evaluation, semantic limits of lexical guards and production acceptance/deployment remain unresolved separate work. Nothing here enables hosted dispatch or production publishing.

## Exact pins

- Plan: `32d4048054109b84258c70800f679809077e3bf7ffe03b2e85a833ee487d3ab1`
- Packets: `8abeaeef45892f8b3a36c0f7486b89f73e17542b2d96532b2e22b3cf3061a824`
- Requests: `e3853c46659363d69c1dfb954edb961074e0cd7c654f3a07aeb971f3ed98e4fc`
- V4 synthetic reference: `9b8a10fd458596b75ba2c0900dea1b72b9ec446d5e0e660ca5c18341920abdb3`
- Accepted integration manifest: `ae33006bf89340dd6e66e5cd334316037bb542a40abfc278a11f75cc4e6b2c01`

[FILE-PINS.json](FILE-PINS.json) pins the complete preparation. Earlier integration, paid execution, diagnosis and planning evidence remains unchanged.
