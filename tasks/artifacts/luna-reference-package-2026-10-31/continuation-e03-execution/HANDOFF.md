# E03 continuation — stopped after one completed request

The independently reviewed E03–E16 continuation passed live preflight and sent **one Responses request for E03**. The model supplied the correct identity and `projected` goalie wording, but its evidence text and numeric end offset disagree. The existing validator held the result, and report-level grading durably disabled the same ledger before any further invocation. **E04–E16 were not sent.** No E01/E02 rerun, retry, new uncertain outcome, application edit, deployment or production action occurred.

## Exact finding

Source: `SYN Avery Keeper was first goalie off the ice.` (46 UTF-16 units; ASCII).

The raw goalie proposal quotes `Avery Keeper was first goalie off the ice.` with `[4,45)`. That slice excludes the final period, while the quoted text includes it. The quote occurs once, starts at4, and requires exclusive end46. The frozen labels already allow both `[4,46)` with the period and `[4,45)` without it. The returned mixture is neither valid alternative. This is a numeric binding failure, not an overly narrow punctuation label. No repair, label change or validator relaxation was applied.

The raw proposal is in [E03-observed-proposal.json](E03-observed-proposal.json); the source/slice comparison and all predeclared variants are in [E03-EVIDENCE-CHECK.json](E03-EVIDENCE-CHECK.json). The retained review and [grade-E03.json](grade-E03.json) preserve `goalie_subject_binding_invalid`. Identity matches; goalie validation/label matching fails. The grade's Decisions match means no Decisions output was expected, not that a Decisions request ran.

## Execution and accounting

| Item | Observed result |
| --- | --- |
| New provider requests | 1 Responses, 0 Decisions |
| Request ID | `req_e7803dc01f86494eadd832c1c7490158` |
| Model / provider status | `gpt-6-luna` / completed |
| Provider usage | 3,165 input, 212 output, 0 cached tokens |
| CLI | Exit2, held; wall2.97 seconds |
| Standard-rate usage estimate | $0.000422500 |
| Conservative usage-priced charge ceiling | $0.000464751 |
| Current evaluation, all four requests | $0.001430554 conservative ceiling; 10,095 input /582 output tokens |
| Historical carried exposure | $0.262519843, including $0.254394800 unresolved reservation |
| Aggregate exposure now | **$0.263950397 of $1** |
| Cumulative call count | **4 of20**; 16 slots remain, with no automatic resume |
| Retries / new uncertain outcomes | 0 /0 |

[RESULTS.json](RESULTS.json) retains the computed totals. The historical uncertainty remains reserved; it was not resolved or retried. All three prior current-evaluation receipts are unchanged. The single new receipt settled from returned usage. These dollar figures are local usage-based accounting, not a final invoice or grant-allocation reconciliation.

The one post-run billing observation still shows rounded $85 promotional and $10 purchased balances. Usage still displays E01+E02 (two Responses and one Decisions) and has not yet incorporated E03. This reporting lag does not negate the completed E03 receipt. See [POST-RUN-BILLING.json](POST-RUN-BILLING.json); no zero-cost claim or additional polling follows.

## Preflight and preserved evidence

Parent execution authorization and independent acceptance were read from threads `01a189f6-9a3a-7235-a989-e1af4f47b014` and `01a1936a-45ae-73d0-ae05-fe4339c5a022`. Live checks verified the active promotional grant expires November13,2026; available rounded funding and the $5 reserve exceed the complete $1 exposure cap. All-project/all-key usage matched the three previous receipts, with no additional usage observed; reporting lag limits certainty about concurrent spend.

The replacement restricted evaluation key was Active in the FHFH IFTTT project, with Responses read/write and Decisions write only. A boolean-only local mask comparison verified the selected credential without printing or persisting the secret. Owner-authorized non-expiry remains an explicit local exception; verified rotation/revocation before any production use remains pending. No key, billing, permission or account setting was changed.

All16 application pins and26 preparation artifact pins matched before execution and at finalization. The historical ledger digest is unchanged. The actual request hash matches the first frozen sequence entry: `cb4ebd599a52911bd995fd7089baf7062544dabdf3efd093e05d7782cf540084`. No later sequence hash appears in the ledger.

- Reviewed plan SHA256: `4714db6b50a246bc05ca2b7cd8f6f90a45e01d39e3a8627e0fece91da9016946`.
- Preparation manifest SHA256: `6dedfd949dee759838498f8792093a6e33021d4cf5979948a5f3a17c0b46f22b`.
- Starting three-attempt ledger SHA256: `112b1763f21d3c953386498fd44d0627731625de4c53b34d8e154358baed8b26`, retained exactly in [START-LEDGER.json](START-LEDGER.json).
- Final disabled four-attempt ledger SHA256: `fc59014d3ff7f3abdfdec0703ffa77f80e5d02ef764f19d21cb85fc08adbd8f2`.

The authorized activation changed only policy ID, enabled and blocked reason. The existing pinned CLI then appended one receipt; the offline operator grader atomically persisted the stop. [ACTIVATION.json](ACTIVATION.json), [LIVE-PREFLIGHT.json](LIVE-PREFLIGHT.json), [preflight-E03.json](preflight-E03.json) and [control.ts](control.ts) retain those checks. Preparation files preserve their earlier pending-review/no-execution wording as historical checkpoint evidence; this handoff records subsequent acceptance and execution.

## Current limits and next gate

The same real ledger is `enabled:false`, reason `bounded_continuation_stopped`, with unchanged cumulative20-call limit, $1 cap and November1,2026 23:59:59 UTC expiry. Continuing E04–E16 is **pending a separately reviewed continuation after offline assessment**; this stop is a deliberate evaluation guard, not an uncertain provider action or permission denial. The remaining16 request slots are not a fresh budget.

All cases are exposed synthetic development material. S01–S10 were omitted from the paid variant; there is no independent holdout or real-report accuracy claim. This single case establishes the observed status/offset result only. The previous focused143 tests and offline continuation rehearsals remain recorded in their original artifacts; no application tests were rerun for this execution-only phase. Current verification covered the actual returned prefix, exact source binding, preserved history and frozen pins.

The reference package and strict schema remain unchanged and local. Hosted dispatch and production authorization remain disabled; production data, publishing, builds and deployments were untouched. Any future field correction must preserve the original proposal and pass explicit version-bound review; no automatic correction or training was added.
