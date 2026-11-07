# V4 continuation execution — stopped at E02 evidence binding

The independently accepted E02–E16 continuation began under the parent's explicit execution instruction and TJ's existing testing authorization. **One new Responses request completed for E02; its goalie evidence failed validation. The durable ledger was disabled immediately after grading, before any next invocation.** E03–E16 were not sent. No Decisions call was scheduled for E02, and E01 was neither rerun nor replayed.

## Observed result

Source: `SYN Avery Keeper will not start tonight.`

The provider returned the correct supplied identity `nhl:900001`, exact name evidence and `ruled_out` status. Its goalie evidence was:

```json
{"start":4,"end":38,"text":"Avery Keeper will not start tonight."}
```

The quoted text has 36 UTF-16 code units and occupies `[4,40)`. The supplied `[4,38)` slice is `Avery Keeper will not start tonigh`, so the text/offset binding is false. This is an exact evidence-offset error, not an absence of goalie classification, ambiguous identity or a scorer's allowed-evidence variant mismatch. The original frozen label already used end40. No label was expanded or output automatically repaired.

The existing validator returned `held` with `goalie_subject_binding_invalid`. `grade-E02.json` records identity pass, goalie fail and `proceed:false`. Its Decisions boolean is the scorer's no-required-Decisions condition, not evidence that a Decisions call ran. The saved raw proposal is `E02-observed-proposal.json`; the retained held review is `reviews/E02.json`. Provider response status was completed, with 202 output tokens; there was no truncation, refusal or uncertain provider outcome.

Request ID: `req_a41998e094bc4f87b4fe0a2557856226`.

Exact submitted request hash: `a008002a2f52e504b17262b7907edc00494d834e58c9420c7a3450406dfd3ed2`, the first frozen continuation hash.

## Actual usage and budget

| Metric | Result |
| --- | --- |
| This continuation | 1 Responses call; 0 Decisions; 0 retries |
| New usage | 3,085 input +202 output tokens; zero cache usage |
| Standard-rate usage estimate | $0.000409500 |
| Conservative ledger charge, including allowance/rounding | **$0.000450451** |
| All current evaluation calls | **3 of 20**; 2 prior E01 calls +1 E02 call |
| Cumulative usage-derived conservative charges | **$0.000965803** |
| Historical carried exposure | $0.262519843, including unresolved $0.254394800 reservation |
| Final aggregate exposure | **$0.263485646** of the same $1 cap |
| New uncertain outcomes | 0; historical uncertainty remains unresolved |
| E02 CLI wall time | 3.70 seconds |

Seventeen cumulative call slots remain, but the stopped continuation grants no automatic resume or retry. Fourteen reports remain unrun. These are exposed synthetic development examples; one v4 report cannot establish accuracy, recall, improved behavior versus v3, independent holdout performance or production readiness.

The post-run dashboard refresh still showed rounded $85 promotional and $10 purchased balances, plus the earlier one Responses/one Decisions usage. The new E02 call had not appeared in that view. These usage-derived amounts are not reconciled invoices; reporting lag/rounding remains explicit. Promotional expiry is November 13, 2026. No billing setting or purchased-fund allocation was changed.

## Preflight and preserved state

Before activation, fresh read-only Platform pages confirmed available promotional funds, restricted replacement-key permissions in the FHFH IFTTT project and usage consistent with the two earlier E01 calls. The other active test key remained unused. A boolean in-memory comparison matched the local key to masked metadata without logging its value. All 46 reviewed application/preparation pins and both ledger digests matched; the unchanged November 1, 2026, 23:59:59 UTC expiry had not passed. See `LIVE-PREFLIGHT.json`.

Activation changed only the reviewed policy ID, enabled flag and the known prior label-mismatch stop reason in the **same** real ledger. Its two existing attempts and receipts were preserved verbatim. `START-LEDGER.json` preserves the exact disabled pre-continuation state and matches its historical manifest hash; `ACTIVATION.json` records the authorized three-field transition. No historical uncertain stop was cleared.

The existing pinned CLI made the request. `control.ts` is an offline operator checker/scorer with no HTTP or credential loading; it checks frozen pins, preserved history, completed request prefixes, funding freshness, expiry and frozen labels. Its grade operation durably disabled the ledger on failure. It does not activate or run a batch. No further CLI invocation occurred after E02 failed.

Current real ledger:

- `enabled:false`, `blockedReason:bounded_continuation_stopped`
- 3 settled current-evaluation attempts; original 2 unchanged
- SHA256 `112b1763f21d3c953386498fd44d0627731625de4c53b34d8e154358baed8b26`

The archived original ledger remains unchanged and blocked. All 16 application pins and 30 frozen preparation artifacts still match. The old paid manifest intentionally describes the prior ledger state; its exact bytes are retained in `START-LEDGER.json`, while this new evidence records the authorized continuation. Application code, labels and request bodies were not edited in this execution turn.

## Remaining blocker

The exact-evidence failure triggered the reviewed stopping condition. Further paid execution is **blocked pending offline diagnosis and a newly reviewed continuation**, preserving the three consumed calls, all receipts and historical uncertainty. Do not retry E02, reset a ledger, silently fix the offsets, or send E03 under the stopped plan. The outcome is known and settled; this is not an access denial or a new uncertain charge.

No production read/write, publication, hosted activation, credential creation, build or deployment occurred. The key's owner-approved non-expiring setting does not bypass the separate verified revocation/rotation gate before any production transition. Operational account/ledger evidence remains local and outside the public reference package.
