# Optional bound correction review — local integration for independent review

Implemented both prerequisites from the independent helper audit: candidates bind to the completed provider receipt, actual prepared request and retained source revision; candidates and reviewer decisions are saved separately from the unchanged original review. **No API calls, real credential access, deployment, live intake or production action occurred.** The real ledger remains disabled and byte-for-byte unchanged at four consumed calls.

## Behavior and ownership

- New `web/lib/sources/tweetLunaBindingWorkflow.ts` optionally wraps `runRetainedTweetLunaReview`. It captures the actual wire and successfully returned Responses receipt after existing retention/attribution/source/clock checks. It never supplies corrected fields to the original caller, Decisions or scorer.
- `web/scripts/review-ifttt-luna.ts` adds optional `--binding-candidate-output new-file.json` and a separate local feedback mode. Existing default-off dispatch/key/admission controls remain unchanged. Both original and candidate output paths must be new/distinct and are reserved before a request; existing artifacts are never overwritten.
- `web/lib/sources/tweetLunaReview.test.ts` adds31 integration tests. `tweetLunaReference.md` documents the workflow and local decision command. `tweetLunaEvidenceBinding.ts` changes only its documentation comment to identify the wrapper; its accepted binding logic is unchanged.

[candidate.patch](candidate.patch) contains this phase's exact five-file delta. The original caller/strict schema, prompt/reference-v4 rules, identity/wording validators, transport, admission store, frozen evaluation labels/scorer and S01–S10 library are unchanged. No manifest/lockfile changes, new UI, acceptance endpoint or training consumer were added. Work is local/uncommitted on `octoberBranch`; unrelated work was preserved.

Read the full independent audit final in thread `01a1936a-45ae-73d0-ae05-fe4339c5a022` before implementation. It accepted the pure helper and required this binding/separate-storage layer. That acceptance does not constitute review of the new integration; **independent integration review is pending**.

## Receipt, source and request binding

The optional wrapper delegates all source preparation to the existing caller. Its programmatic `bindingPolicy` is a trusted caller argument, separate from the untrusted report packet. The manual CLI selects it only when the explicit candidate-output flag is present. A disabled caller or omitted policy cannot produce a candidate.

Candidate creation is eligible only after the original review is held with `goalie_subject_binding_invalid` and exactly one Responses receipt was returned. It requires a completed response with nonempty provider response/request IDs, one complete assistant output text, no refusal/error/incomplete indication, and usage consistent with the settled receipt's charge. Invalid, incomplete or uncertain responses remain ineligible; no fallback dispatch or retry follows.

The `luna-bound-evidence-review-v1` artifact retains:

- the complete original provider receipt and receipt hash;
- actual caller wire/hash and original prepared identity request/hash;
- supplied source policy, retained source ID/revision and packet lineage;
- original review hash, queue key and unchanged original holds;
- receipt-observed and candidate-created timestamps;
- the pure helper's raw-output-preserving derivation, before/proposed spans and candidate hash;
- false authority flags, `canApply:false` and all inherited review/source/game/conflict holds.

Creation cross-checks the captured wire against the original caller's request hash, its prepared request and supplied source policy. Source text/version, reporter/URL/post, publication/ingestion clocks, packet binding and directory context remain bound. Local receipt/candidate chronology and identity cutoff are checked. Retrospective evidence retains an explicit hold.

The accepted exact-quote helper then validates identity and all derived goalie proposals. Missing/repeated/overlapping quotes, normalization, wrong subjects, clipped negation/conditions, correction/conflict or other semantic gate failures yield no candidate. The raw model output is retained verbatim; no original offset, quote, status, identity, receipt or result is rewritten.

The original result is returned exactly, including its held status, holds, empty goalie array, attempts and request IDs. Thus a candidate does not allow a Decisions call after a failed Responses leg, does not change exit2, and cannot turn a historical label failure into a model pass. The caller's review queue key and model request bodies remain unchanged.

## Separate persistence and human decision binding

The existing CLI writes the original review to `--output` and the candidate to `--binding-candidate-output`. If no candidate is eligible, the second file explicitly records that state. A candidate file reservation failure occurs before admission; the original newly reserved output may remain empty, but no existing file is clobbered and no request is made. Operators must inspect that failure rather than retry dispatch automatically.

The local-only decision mode is documented in [`tweetLunaReference.md`](../../../../web/lib/sources/tweetLunaReference.md). It requires a candidate file, separately retained original review, explicit decision JSON and a new output path. It rejects dispatch/input/ledger arguments before processing. It does not load credentials or instantiate admission/transport.

Decision JSON requires `candidateHash`, `reviewerId`, `reviewedAt`, `decision` and `rationale`. Choices are `accept_coordinate_proposal`, `reject` or `defer`. The artifact and original review are rechecked; changed hashes, raw receipt, prepared request, source revision, original result/holds or authority cannot silently carry forward. Review time must be at or after candidate creation and no later than recording, with an explicit timezone and valid calendar timestamp.

The new decision artifact binds the reviewer/time/choice to candidate, receipt, original review, prepared request, source revision and queue key. **Even acceptance is coordinate-proposal feedback only**: `canApply:false`, all authority flags false and every original/candidate hold remain. No method applies a correction, selects a winning review, changes a historical score, releases a reservation or resets a counter. Multiple decision files preserve disagreements; no automatic latest-wins behavior exists.

Reviewer identity is an operator assertion in this single-host manual workflow. Hashes provide internal integrity/substitution detection, not cryptographic authentication of a provider, source or human. The decision's expected candidate hash must come from the artifact actually reviewed. A future multi-user UI needs authenticated reviewers and trusted persistence; this change creates neither. Existing source/game/time/conflict acceptance remains a separate gate.

## Actual offline verification

Node22.11.0 and existing dependencies. Tests used an empty inherited environment, `envDir:false` and inherited fetch/HTTP/TCP/TLS/DNS denial. Temporary ledgers and a fixed noncredential test literal were used; no `.env.local` loading or real key access occurred.

| Check | Result |
| --- | --- |
| Full nearest suite before two additional path guards | **204 passed** |
| Final integration suite after those additions | **31 passed**,175 intentionally skipped |
| Distinct tests exercised across those runs | **206 passed** |
| Scoped TypeScript, including CLI/new module/tests | Passed, exit0 |
| ESLint on four touched/new TypeScript files | Passed, exit0 |
| Actual CLI E02/E03 saved-receipt replays | **2/2** original reviews reproduced exactly; separate bound candidates written |
| Focused diff/whitespace and preserved-file checks | Passed |

Initial TypeScript output identified a test child-environment declaration missing the repository-required `NODE_ENV`. Adding `NODE_ENV:"test"` fixed it; initial and final logs are retained. Final integration tests exercised that environment. No production logic changed after the204-test full run. The31 integration tests include opt-in/disabled behavior, completed/incomplete/refused/missing-ID/usage checks, retained-source/revision/clock failures, reversed receipt clocks, retrospective holds, raw/request/source/authority/hash tampering, reviewer/time decisions, no overwrite, ledger-path alias rejection and zero admission after output reservation failure. The preceding175 tests still cover the quote/identity/semantic guards and normal caller/transport/admission regressions.

[OFFLINE-CLI-REPLAY.json](OFFLINE-CLI-REPLAY.json) records actual child CLI execution against frozen E02/E03 inputs. [replay-cli.cjs](replay-cli.cjs) creates isolated synthetic ledgers; [mock-receipt.cjs](mock-receipt.cjs) replaces fetch only with an exact-request assertion and saved receipt, with **no network fallback**. The network tripwire loads first. The replay used `--dispatch` solely to exercise the existing CLI branch with a test literal and mocked fetch; it made zero provider requests and did not activate any persistent setting. Each child returned exit2 and exactly one mock call. No real admission ledger was passed to either child.

- [E02 original replay](replay-E02/original-review.json) and [separate candidate](replay-E02/binding-candidate.json): proposed end40; original held failure unchanged.
- [E03 original replay](replay-E03/original-review.json) and [separate candidate](replay-E03/binding-candidate.json): proposed end46; original held failure unchanged.

The replay candidates have **no recorded human decision**. Unit tests exercise synthetic reviewer choices only; none is represented as TJ's adjudication. All material remains exposed synthetic development data, not a holdout or new model prediction.

To reproduce the tests from `web/`, use the existing offline command in `tweetLunaReference.md`. The new scoped config is `../tasks/artifacts/luna-reference-package-2026-10-31/binding-review-integration/tsconfig.json`. The CLI replay command was:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' node ../tasks/artifacts/luna-reference-package-2026-10-31/binding-review-integration/replay-cli.cjs
```

It refuses to overwrite its existing artifact directories/files; use a separately reviewed copy/destination for another replay. No application build, live service check or model evaluation was needed for this local integration.

## Preserved state and remaining gate

All16 artifacts from the accepted pure-helper manifest,14 E03 execution artifacts and26 approved preparation artifacts remain unchanged. Thirteen of the previous17 application pins remain unchanged; the other four are the authorized CLI/test/documentation/helper-comment changes, plus the new workflow module. The final manifest pins all18 current application files and this integration's evidence.

Real ledger SHA256 remains `fc59014d3ff7f3abdfdec0703ffa77f80e5d02ef764f19d21cb85fc08adbd8f2`: disabled,4/20 used,16 slots remaining, $0.263950397 aggregate exposure under the $1 cap. Historical uncertain reservation and ledger SHA256 `e8418735afaeff893177e550df6774600c6c6fec4f49c2b01c183712cdc064f2` are unchanged. No reservation or failed grade was cleared; no paid continuation is authorized by these artifacts.

Independent review of this exact integration is pending. There is no permission denial or new uncertain operation. Semantic limitations remain: unique quote location and finite lexical validation do not prove universal negation/coreference/context/injection correctness. Human source/context review, source/game acceptance, credential rotation before production, hosted qualification and deployment remain separate requirements. No production or live dispatch was enabled.
