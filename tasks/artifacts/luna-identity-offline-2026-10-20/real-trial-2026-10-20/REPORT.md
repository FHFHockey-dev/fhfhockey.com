# S06 approved-data trial checkpoint

The approved read-only export completed. The paid request stopped at the retrieval gate before request sealing, ledger admission or credential loading. This is a real-data retrieval result, not a Luna accuracy result.

## Observed comparison

Original text, unchanged: “Podkolzin will take RNH’s spot on the first unit powerplay… via Babcock.” Source time: 2026-09-29T16:28:31Z; original post: 2104971594632454155, @JasonGregor. Owner-supplied names are exposed development labels, not an untouched holdout.

| Occurrence | Approved canonical identity | Existing caller result | Improved retrieval / deterministic result | Bounded widening |
| --- | --- | --- | --- | --- |
| `Podkolzin` [0,9) | Vasily Podkolzin, NHL 8481617; registry 10190 | Podkolzin selected | NHL 8481617 / selected | Same candidate |
| `RNH` [20,23) | Ryan Nugent-Hopkins, NHL 8476454; registry 9521 | Abstain | No candidates / abstain | No candidates |

The old shared shortlist contains only Podkolzin. Neither alias table returned `RNH`. Three-letter text is outside conservative fuzzy matching, and S06 contains no explicit team hint, so team-based widening cannot retrieve Nugent-Hopkins. The owner label is joined after retrieval; it is not a hint or a learned alias. A local forced-match validation exercise rejected Nugent-Hopkins with `identity_not_in_occurrence_candidates`.

The preflight policy explicitly requires stopping before paying when the expected ID is absent from its occurrence candidates. It would be misleading to dispatch this input and call its mandatory abstention a model failure, or to insert the owner's answer as a candidate hint to manufacture a successful trial.

## Read scope and provenance

Two connected `supabase_execute_sql` calls, each a single bounded SELECT, read the previously approved columns from the five approved tables. Returned: 2 player rows, 2 verified registry links, and 5 related rows (2 registry aliases, 1 lineup alias, 2 roster intervals). These represent 2 distinct NHL candidates. No collection hit its cap; no pagination, cap-plus-one probe, writes, refreshes or private league/account data. Exact SQL and returned records are in APPROVED-EXPORT.json.

Both roster intervals start September 19, before the retained September 29 source time, have no end, and are current. They support team 22 under the existing alias-review route's created_at/ended_at/is_current semantics. They are not independently audited transaction history. Current positions C/R have no source-time verification and supply no position hints. Returned aliases have no validity dates in the approved columns, so no alias is promoted into the dated snapshot. The directory is explicitly partial and candidate-scoped; its two-player set cannot establish league-wide absence or acronym uniqueness.

## Cost and invariant proof

Provider requests: **0**. Actual tokens, request ID, latency, raw model proposals and model validation outcome: **not available**, because no request was sent. New model cost and admitted reservation: **$0**. The new identity attempt is absent from the ledger.

The unused single-request maximum remains $0.231844800, from `(1,050,000 × $0.20 + 1,024 × $0.75) / 1,000,000 × 1.10`. It uses the full published context envelope, long-context rates and regional surcharge, rather than predicting this small input's usage. Existing exposure $0.262177193 plus this maximum would be $0.494021993, below the same $0.52 total cap by $0.025978007. Budget fit does not override the failed retrieval gate. No model substitution, retry, paid widening or downstream reviewer fan-out occurred.

- Aggregate ledger SHA-256 unchanged: `52d4848b5a9eb1a91b3ddfd9928625951fe2da81814669d41bdbd08a261c9b5c`.
- Original `lindgren-0`: uncertain, $0.254394800 reservation, actual null. Global `unknown billed outcome` block preserved.
- Retained decisions reference adapter SHA-256 unchanged: `055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`.

## Local verification and files

From `web/`, Node 22.11.0:

```sh
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' NODE_PATH=. node -r ts-node/register/transpile-only -r /tmp/fhfh-luna-offline-network-guard.cjs ../tasks/artifacts/luna-identity-offline-2026-10-20/real-trial-2026-10-20/evaluate-approved-export.ts
```

Passed. The guard replaces global fetch plus http/https request/get, counts attempted calls and exits nonzero for any attempt. No attempts occurred. The script invokes the existing local caller, initial/widened retrieval and output validator against the approved export; it has no transport, key loader, database client or ledger writer. This is one real-data local evaluation, not a new application test suite. Prior guarded application results remain 8 files / 164 tests; no application source changed in this checkpoint, so those suites were not rerun.

Added only this artifact directory: APPROVED-EXPORT.json, DIRECTORY.json, PREPARED-INPUT.json, OWNER-BINDINGS.json, RESULT.json, BUDGET-UNCHANGED.json, evaluate-approved-export.ts, REPORT.md, and final review/manifest records. Diary updated; existing preflight remains a dated historical preparation record superseded by this checkpoint. No dependencies, migrations, runtime defaults, live routes, settings or concurrent files changed.

## Remaining blocker and smallest next step

**Blocked, not denied or uncertain:** dispatch target `responses`, model `gpt-6-luna`, attempt `identity-s06-shadow-v1-0`. Its required candidate-recall admission check fails for `RNH`. There is no new uncertain provider outcome.

The useful next local change is a generic conservative acronym-candidate rule derived from canonical names (including compound surnames), with collision/ambiguity handling and no global alias learning. It should retrieve candidates independently of the owner labels and then rerun this exact gate before a newly reviewed sealed continuation. This checkpoint does not implement that further change or weaken the permitted-ID validator. Existing read approval and the original total spending authorization need no repeat approval; any additional directory scope must be explicit. The existing partial export is enough to reproduce this failure, but not to establish league-wide acronym uniqueness.

No conclusion about Luna accuracy, claim certainty, subject binding, fewer alias emails or release readiness follows from this stopped one-case development trial. Publication, replacement-slot state, no-keyword recall and live behavior remain untested.
