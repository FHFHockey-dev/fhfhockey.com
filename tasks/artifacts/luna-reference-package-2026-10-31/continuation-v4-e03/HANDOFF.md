# Frozen continuation after E02: E03–E16

Prepared for independent review only. **No paid calls, retries, credential access, ledger activation, application edits, production actions, builds or deployments occurred.** The real ledger remains disabled with three settled attempts and its full historical exposure.

E01 and E02 are excluded from dispatch **and** receipt replay. Their failed outcomes remain intact: E01's v3 goalie omission consumed two calls; E02's v4 evidence-offset failure consumed one. The proposed E02 end-offset correction remains unapplied. Neither case is reclassified as successful or refunded from the call budget.

## Exact sequence

The frozen subset is **14 Responses calls plus three Decisions calls**, at most 17 new calls and 20 cumulatively. Every selected hash is absent from the existing ledger. A report's Responses leg precedes its optional Decisions leg, and the entire completed report must pass frozen grading before the next report begins.

| Case | New call numbers | Cumulative call numbers | Endpoint order |
| --- | --- | --- | --- |
| E03 | 1 | 4 | Responses |
| E04 | 2 | 5 | Responses |
| E05 | 3 | 6 | Responses |
| E06 | 4–5 | 7–8 | Responses, Decisions |
| E07 | 6 | 9 | Responses |
| E08 | 7 | 10 | Responses |
| E09 | 8 | 11 | Responses |
| E10 | 9–10 | 12–13 | Responses, Decisions |
| E11 | 11–12 | 14–15 | Responses, Decisions |
| E12 | 13 | 16 | Responses |
| E13 | 14 | 17 | Responses |
| E14 | 15 | 18 | Responses |
| E15 | 16 | 19 | Responses |
| E16 | 17 | 20 | Responses |

`PLAN.json.sequence` records every endpoint, hash and byte count in order. `REQUESTS.json` contains the exact 17 transport bodies. `PACKETS.json` contains unchanged source packets, candidate/date context, labels, allowed evidence alternatives and Decisions bindings. `inputs/` contains only E03–E16 for the pinned manual CLI. The subset exactly matches the original v4 rehearsal after excluding both consumed reports; neither prompts nor labels were tuned again.

All cases remain **exposed synthetic development material**, not an independent holdout or human ground truth. Being uncalled does not make the remaining cases independent. S01–S10 are absent from the selected request variant. The source/provenance metadata explicitly records both excluded failures.

## Budget and retained history

| Control | Frozen value |
| --- | --- |
| Cumulative maximum | 20 calls; 3 already consumed; at most 17 new |
| Retries / concurrency | 0 / 1 |
| Aggregate cap | $1.000000000 |
| Starting exposure | **$0.263485646** |
| Remaining additional exposure | **$0.736514354** |
| Historical carried exposure | $0.262519843 |
| Included historical uncertain reservation | **$0.254394800**, unresolved |
| Reservation before each call | $0.233000000 |
| Promotional safety reserve | $5.00, requiring fresh live verification before execution |
| Unchanged expiry | November 1, 2026, 23:59:59 UTC |
| Diagnostic remaining-cost estimate | $0.042087991; not a proven token ceiling or invoice |

The same real ledger is `enabled:false`, `blockedReason:bounded_continuation_stopped`, SHA256 `112b1763f21d3c953386498fd44d0627731625de4c53b34d8e154358baed8b26`. The archived historical ledger remains blocked and unchanged, SHA256 `e8418735afaeff893177e550df6774600c6c6fec4f49c2b01c183712cdc064f2`.

Any later approved activation must preserve all three existing attempts and receipts verbatim, plus `version`, `priorExposureNanoUsd`, `capNanoUsd`, `maxCalls` and `expiresAt`. Do not create another spending ledger or move existing attempts into a balance field that loses their call count. The plan describes only a proposed policy-ID/enabled/known-stop transition, guarded by the exact starting ledger hash and stop reason; it has not been applied. No historical uncertain stop may be cleared.

## Offline verification

The subset verifier builds on the previously reviewed offline verifier, with explicit changes for three prior attempts, E03–E16,17 remaining requests and updated pins/exposure. It uses the unchanged real caller, transport, scorer and admission, prescribed replies and disposable synthetic ledgers seeded with the exact three-attempt history. It has no credential/environment loader, real network fallback, activation or paid-dispatch option. Existing dependencies were used with an empty inherited environment and network-denial preload.

- **All-pass scenario:** 14 reports, 17 new mock requests, 20 cumulative attempts; all original receipts preserved; request 21 rejected with `luna_budget_exhausted`.
- **Uncertain first call:** one mock request, full reservation preserved and unknown-outcome stop; no subsequent report or retry.
- **First-report label mismatch:** one settled mock request, then stop; no subsequent report or retry.
- **Disabled ledger and insufficient reservation:** zero mock requests; existing history preserved.
- Every input/label/binding and generated transport body/hash matches the frozen subset. All 16 current application pins match, including the new E02 regression tests.
- Scoped verifier TypeScript passed, exit0. The prior independently verified 143-test application result remains valid historical evidence; no application suite was rerun solely for artifact preparation.

`OFFLINE-VERIFICATION.json`, `OFFLINE-RESULTS.json` and logs retain the observed checks. Synthetic simulation charges are not actual spend. Temporary ledgers were removed; no enabled ledger artifact was saved. Real and archived ledger bytes remained unchanged.

## Execution gate and operator requirements

**Independent review is pending; this preparation does not authorize paid execution.** Before any later run, verify current promotional balance/concurrent spending, active restricted replacement credential scope, unchanged pins, exact disabled starting ledger and unexpired policy. The prior live checks are historical. The owner's non-expiring key choice does not extend this batch's expiry. Production revocation/rotation remains a separate mandatory transition gate.

For a separately approved run, use the existing pinned manual CLI one report at a time and the same durable ledger. Prior R2/E02-specific operator scripts must not be reused unchanged: their starting-state/count assumptions are stale. Apply this plan's three-attempt history and exact completed request prefix.

Before each invocation, all prior continuation reports must have passed and all prior attempts must be settled; verify the exact preserved-three-plus-completed-prefix sequence, source/request pins, cap, expiry, funding and reservation headroom. After each report, check status, actual request sequence/usage and `scoreLunaEvaluation(entry.expected, review)`. **Durably disable the ledger on a schema/label failure, error, unresolved Decisions result or uncertainty before any further invocation.** Transport blocks uncertain/budget failures, but semantic label failures require the supervising operator's durable stop. A schema-valid Responses label failure can incur that same report's scheduled Decisions call before report-level grading, as in the reviewed flow. No retries, skips, substitutions or label changes are allowed. Disable after successful E16 completion too.

No new continuation budget or E01/E02 rerun is implied by this plan's new hash. Preserve original failed outcomes, raw proposals and unapplied correction artifacts. V4 performance remains unqualified; passing mock answers is not model accuracy.

## Exact pins

- Plan SHA256: `4714db6b50a246bc05ca2b7cd8f6f90a45e01d39e3a8627e0fece91da9016946`
- Packets SHA256: `4fc4abb9b49c5961b6542dd2836bc85a6dcb58d35bb87d73ebccf98ce4a5e2fe`
- Requests SHA256: `c9aa77c79333b5aca70e554ca331566de42261d4c59a1297887ee036afe97b63`
- V4 synthetic reference: `9b8a10fd458596b75ba2c0900dea1b72b9ec446d5e0e660ca5c18341920abdb3`

`FILE-PINS.json` pins the complete preparation. All previous execution, diagnosis and plan artifacts remain unchanged. The corrected explicit-version replay documentation remains in `../continuation-v4/REPLAY-REPRODUCTION.md`; this new subset does not require replaying either paid case.
