# E04 continuation — stopped after three settled requests

The exact independently reviewed E04–E16 plan passed live preflight. **E04 and E05 passed; E06 failed exact evidence binding.** The supervising grader durably disabled the same ledger immediately after E06, before its Decisions call or E07. Three new Responses requests settled. No retry, E01–E03 replay, new uncertainty, application/label change, deployment or production action occurred.

| Report | Original result | New requests | Conservative usage charge |
| --- | --- | --- | --- |
| E04 — practice attendance | Matched identity; correctly omitted a goalie status; pass | 1 Responses | $0.000428671 |
| E05 — warmup attendance | Matched identity; correctly omitted a goalie status; pass | 1 Responses | $0.000426031 |
| E06 — explicit warmup starter | Matched identity and confirmed wording; invalid numeric evidence span; held | 1 Responses | $0.000458591 |

These are exposed synthetic development cases, not an independent holdout. Two passing reports do not establish real-report accuracy. S01–S10 were absent from this paid request variant.

## E06 exact finding and separate review candidate

Source: `SYN Avery Keeper starts tonight, as confirmed during warmups.`

The raw proposal quotes `Avery Keeper starts tonight, as confirmed during warmups.` with `[4,57)`. That source slice ends at `warm`, omitting `ups.` from the quoted text. The unique full quote requires `[4,61)`. The frozen variants already permit a matching full quote or punctuation-free quote; this output matches neither. The original validator and failed grade are unchanged.

The optional integration produced a separate `luna-bound-evidence-review-v1` candidate proposing only end57 → end61. It retains the exact raw output and completed receipt, prepared request, retained source revision and original held review. It has `canApply:false`, retains the original hold and requires human review. **No human decision was recorded, correction applied, grade replaced, reservation released or continuation permitted.** E06 Decisions was not sent.

[E06-EVIDENCE-CHECK.json](E06-EVIDENCE-CHECK.json), [raw proposal](E06-observed-proposal.json), [original review](reviews/E06.json), [original grade](grade-E06.json) and [separate candidate](candidates/E06.json) retain the evidence. The grade's optional top-level `candidateVersion` metadata is null because the candidate is an envelope with its version under `content`; the actual bound version and candidate presence are recorded correctly in [RESULTS.json](RESULTS.json). This metadata does not enter scoring or continuation.

## Accounting and stop state

- New requests: **3 Responses, 0 Decisions**; 9,314 input and 525 output tokens, no cached tokens.
- New standard-rate usage estimate: **$0.001193900**.
- New conservative usage-priced charge ceiling: **$0.001313293**.
- Current evaluation: **7 of 20 calls**, all settled; cumulative conservative charge **$0.002743847**.
- Historical carried exposure remains **$0.262519843**, including the unresolved **$0.254394800** reservation.
- Aggregate exposure: **$0.265263690 of $1**. Zero retries or new uncertain outcomes.
- Ledger: `enabled:false`, `bounded_continuation_stopped`; unchanged November 1, 2026 23:59:59 UTC expiry.

All four starting receipts are preserved verbatim. E06 Decisions and E07–E16 remain unsent. The 13 unused call slots are not automatic resume authority; the held E06 Decisions leg cannot be dispatched through a correction shortcut. Any further continuation needs a newly reviewed still-uncalled sequence and fresh preflight, with the same cumulative history and cap.

The single post-run billing observation still displays rounded $85 promotional and $10 purchased balances. All-project usage still shows the pre-run three Responses plus one Decisions, so the three new settled receipts are not yet reflected. [POST-RUN-BILLING.json](POST-RUN-BILLING.json) records this reporting lag. Local usage-based charges are not a final invoice or confirmed allocation to a particular grant; no zero-cost claim or additional polling follows.

## Preflight and verification

Parent authorization and independent acceptance came from threads `01a189f6-9a3a-7235-a989-e1af4f47b014` and `01a1936a-45ae-73d0-ae05-fe4339c5a022`. Fresh read-only browser checks showed the available promotional grant expiring November 13, 2026, with the $5 reserve above the full $1 exposure ceiling. All-project/all-key/all-source usage matched the four prior receipts; the other active test key was never used and the historical key expired. Reporting lag limits certainty about concurrent activity.

The replacement evaluation key was active in FHFH IFTTT with Responses read/write and Decisions write only. A boolean-only comparison matched the local configured key to the displayed masked suffix without outputting or persisting the secret. The owner's non-expiring-key exception remains; verified rotation/revocation before production is still required. No credential, access, billing or account setting was changed.

All **47 reviewed pins** matched before dispatch and at finalization. The historical ledger digest is unchanged. Actual admitted hashes are exactly the first three frozen sequence entries, excluding E06 Decisions and all subsequent requests. Application code, prompt, schema, labels and past evidence are unchanged.

The adapted offline operator control passed scoped TypeScript and four disposable-ledger rehearsals: complete 20-call sequence, failed E06 with a valid separate candidate, uncertain first call preserving its reservation/reason, and CLI error. An initial rehearsal stopped before executing because artifact-local Node module resolution could not find TypeScript; adding the existing `web/node_modules` to `NODE_PATH` resolved it. The failed log is retained. No dependency install or paid retry occurred.

The operator uses the ledger's exclusive lock, re-reads the latest state, writes/fsyncs the disabled record, renames it and fsyncs its directory. The one-report wrapper has no loop or retry; it always invokes the original-output grader after the pinned CLI returns. Candidate output is never substituted into that grade. [control.ts](control.ts), [run-report.py](run-report.py), [OFFLINE-CONTROL-VERIFICATION.json](OFFLINE-CONTROL-VERIFICATION.json), [LIVE-PREFLIGHT.json](LIVE-PREFLIGHT.json) and [ACTIVATION.json](ACTIVATION.json) record the implementation and checks. No application suite/build was rerun for this execution-only phase; accepted prior test evidence remains intact.

## Pins and remaining gate

- Frozen plan SHA256: `32d4048054109b84258c70800f679809077e3bf7ffe03b2e85a833ee487d3ab1`.
- Preparation manifest SHA256: `dac5a4041ca57cb571fe4360952526475bcdc7b4b873488f1bda3509ba83018a`.
- Starting four-call ledger: `fc59014d3ff7f3abdfdec0703ffa77f80e5d02ef764f19d21cb85fc08adbd8f2`.
- Final disabled seven-call ledger: `2bf56d754b1f98888785b8d7e759d1c701b5541b0fb9e91ade63eff041ff3ceb`.

[FILE-PINS.json](FILE-PINS.json) pins this execution evidence. Frozen preparation files retain their original pending-review wording as checkpoint history; this record documents subsequent independent acceptance and stopped execution.

This is a conclusive original-schema failure and an intentional safe stop, not a permission denial or uncertain provider outcome. Further paid work is pending reviewed continuation. Original grades remain authoritative. Hosted dispatch, production authorization, publishing, data writes, builds and deployments remain disabled or untouched.
