# Frozen v4 continuation: E02–E16 only

Prepared locally for independent review. **No paid call, retry, ledger activation, credential access, production action, build or deployment occurred.** The reference v4 application candidate is unchanged from the independently audited omission diagnosis. This package freezes only the uncalled reports; E01 is excluded from both Responses and Decisions, including cached receipt replay.

All selected reports and labels are **exposed synthetic development material**, not an independent holdout or human ground truth. Being uncalled does not make E02–E16 an independent evaluation set. S01–S10 remain absent from the submitted request variant.

## Exact sequence

Run each report once, in this order, through the existing pinned manual `review-ifttt-luna.ts` CLI. Within a report, Responses precedes its optional Decisions call. Grade the complete result against its frozen labels before advancing. A failed/held result stops the entire continuation; no skip, substitution, rerun, prompt edit or new evidence alternative is allowed during execution.

| New call | Cumulative call | Case | Endpoint |
| --- | --- | --- | --- |
| 1 | 3 | E02 | Responses |
| 2 | 4 | E03 | Responses |
| 3 | 5 | E04 | Responses |
| 4 | 6 | E05 | Responses |
| 5 | 7 | E06 | Responses |
| 6 | 8 | E06 | Decisions |
| 7 | 9 | E07 | Responses |
| 8 | 10 | E08 | Responses |
| 9 | 11 | E09 | Responses |
| 10 | 12 | E10 | Responses |
| 11 | 13 | E10 | Decisions |
| 12 | 14 | E11 | Responses |
| 13 | 15 | E11 | Decisions |
| 14 | 16 | E12 | Responses |
| 15 | 17 | E13 | Responses |
| 16 | 18 | E14 | Responses |
| 17 | 19 | E15 | Responses |
| 18 | 20 | E16 | Responses |

There are **15 reports, 15 Responses calls and 3 Decisions calls, all 18 request hashes new relative to the two existing attempts**. `REQUESTS.json` freezes every complete transport body/hash/byte count; `PLAN.json.sequence` fixes the order. `PACKETS.json` freezes original inputs, labels, allowed evidence alternatives and Decisions bindings. `inputs/` contains only E02–E16 for the existing CLI. Their contents are unchanged from the full v4 offline batch; no labels or packet fields were revised for this continuation.

## Same cumulative budget and history

| Control | Frozen value |
| --- | --- |
| Existing requests | 2 settled E01 attempts, retained verbatim |
| Maximum additional requests | 18; cumulative maximum 20 |
| Retries / concurrency | 0 / 1 |
| Aggregate exposure ceiling | $1.000000000 |
| Starting aggregate exposure | $0.263035195 |
| Remaining additional exposure | $0.736964805 |
| Historical carried exposure | $0.262519843 |
| Included historical uncertain reservation | $0.254394800; still unresolved |
| Reservation before each request | $0.233000000 |
| Promotional safety reserve | $5.00, with fresh grant/scope verification before execution |
| Unchanged batch expiry | November 1, 2026, 23:59:59 UTC |
| Diagnostic new-cost estimate | $0.044959871; not an invoice or proven token ceiling |

The actual `paid-evaluation/ledger.json` remains `enabled:false` and `blockedReason:bounded_evaluation_stopped`. Its SHA256 is `e992f8e85a70e3c4c46630904ff6b278cbbd67f96c4886d357e453f0bf268c7e`. Both old attempts and usage receipts remain untouched. The archived original ledger remains blocked, with SHA256 `e8418735afaeff893177e550df6774600c6c6fec4f49c2b01c183712cdc064f2`.

Do not create a replacement spending ledger or roll the two attempts into a prior-exposure number that loses their call count. Future activation, only after independent review and explicit execution authorization, must operate on the same ledger and preserve `attempts`, `priorExposureNanoUsd`, `capNanoUsd`, `maxCalls`, `expiresAt` and version. `PLAN.json.activationProposalOnly` describes the three proposed changes—policy ID, enabled flag and the known stop reason—without applying them. No generic clearing of an uncertain/error stop is authorized. If the actual ledger differs from the frozen starting state, stop and reconcile instead of activating it.

## Execution prerequisites and stopping behavior

This is preparation only. Independent continuation review and execution authorization remain pending. Fresh grant balance/concurrent spending, active restricted replacement credential scope, unchanged source/request pins and unexpired policy must be verified before any activation; no new key creation or persistent access expansion is included. A non-expiring evaluation key does not extend this batch's expiry. Verified revocation/rotation remains a separate gate before any production transition.

For a later authorized run, use one `inputs/E02.json`…`E16.json` packet at a time with the existing pinned CLI, one new output per case, and the same real ledger. The old `paid-evaluation/control.ts` is R2/E01-specific and **must not be reused** for this continuation. The reviewed operator must apply this plan's preflight and frozen `scoreLunaEvaluation(entry.expected, review)` checks between invocations. The offline scripts here neither activate the ledger nor serve as a paid executor.

Before each invocation, verify that prior continuation results passed, the ledger contains exactly the two preserved attempts plus the corresponding completed prefix of the18 planned request hashes, every prior attempt is settled, the aggregate cap/expiry/funding still hold and at least one full reservation fits. The transport repeats admission for each endpoint. After each invocation, verify request IDs/usage, expected sequence/count, review status and frozen labels. On an error, uncertainty, mismatch, unresolved Decisions result, pin discrepancy or budget/funding failure, stop, retain all receipts/reservations and disable the ledger. Disable it after successful E16 completion too. Do not retry a failed or uncertain invocation.

## Offline verification

`verify-continuation.ts` uses the real caller, transport, scorer and admission with prescribed replies and isolated temporary ledger copies seeded with both existing attempts. Empty inherited environment and the network-denial preload were used. The actual ledger is read-only, and its byte identity is checked after the simulation.

- **Full continuation:** all 15 reports passed against frozen labels, exactly 18 new mock calls, 20 cumulative attempts. A 21st reserve was rejected with `luna_budget_exhausted`. Both existing receipts remained equal.
- **First-call uncertainty:** one new mock call, its full reservation retained, unknown-outcome stop; no next report or retry.
- **First-report label mismatch:** one settled mock call, false goalie label stops the sequence; no next report or retry.
- **Disabled ledger / insufficient reservation:** zero mock calls in each case; original history preserved.
- All packets, labels, evidence alternatives, Decisions bindings, request hashes and byte counts matched the frozen selected v4 subset. Application/source pins matched; no application changes were made this turn.
- Scoped TypeScript for the new verifier passed, exit0. Existing 139-test application result remains the previous audited result; application suites were not rerun for artifact-only preparation.

`OFFLINE-VERIFICATION.json`, `OFFLINE-RESULTS.json` and the log retain these checks. Simulated charges/aggregate totals are synthetic and are not actual usage. All temporary ledger copies were deleted; no reusable enabled ledger artifact was produced.

## Replay documentation correction

The old `replay.ts baseline` flag selected an output label, not archived v3 code. The historical baseline is valid because it ran before the v4 edit; rerunning that command under v4 would not reconstruct v3. [REPLAY-REPRODUCTION.md](REPLAY-REPRODUCTION.md) corrects this explicitly and gives a tested command for `verify-saved-replay.cjs`. That script loads archived v3 in memory and current v4 separately; all four saved request/result comparisons passed. It never replaces live source or sends E01 again. Initial startup could not resolve TypeScript from the artifact directory; the script now resolves the existing dependency from the documented `web/` working directory. Both startup and successful verification logs are retained.

## Review pins

- `PLAN.json`: `6898bb4fa8b8683bbd77165fa90f3194b7b0971cb6086f1d5cc8608ebd32b340`
- `PACKETS.json`: `4bdd7328c3fd201a4c6c6db4ac394161c552ad725221c0982f1ddf9cae1765a6`
- `REQUESTS.json`: `0380caaf035b971c4db22e408e5a0f9efc5e6a8d7092f687bf041f05ee70a62f`
- V4 synthetic reference: `9b8a10fd458596b75ba2c0900dea1b72b9ec446d5e0e660ca5c18341920abdb3`

`FILE-PINS.json` pins this preparation package. All original omission-diagnosis/R2/paid artifacts remain unchanged. The complete 16-report rehearsal remains offline regression evidence; it is not this continuation and must not be submitted as a new paid batch. V4 model behavior is still unmeasured, and no independent holdout or production qualification is claimed.
