# Exact-quote binding review — offline candidate for independent review

Implemented a **default-off, pure offline correction-proposal function** that can derive source coordinates from a unique exact quote, preserve the original model output, and rerun the existing validators. It is not connected to the runtime caller or CLI. The strict response schema, prompt/reference version, original results and paid ledger remain unchanged. No API requests, retries, credential access, deployment or production action occurred in this phase.

## Diagnosis and bounded decision

Both saved responses contain a valid, unique source quote and the expected goalie wording, with an incorrect numeric end:

| Case | Raw model span | Exact span for unchanged quote | Original result |
| --- | --- | --- | --- |
| E02, ruled_out | `[4,38)`; omits `t.` from the claimed quote | `[4,40)` | Held; frozen label fails |
| E03, projected first-off | `[4,45)`; omits the claimed final period | `[4,46)` | Held; frozen label fails |

Exact saved-reply replay reproduces both historical reviews, request bodies and failed grades without modification. This rules out transport/scorer loss for these two results. The model's internal reason for choosing the wrong numbers remains unknown. Two exposed synthetic examples do not establish broader accuracy or a model-wide error rate.

A unique literal quote is sufficient to calculate coordinates, but does not prove semantic support, correct scope or trusted source/game binding. Automatically accepting repaired output would change the present fail-closed acceptance contract. The bounded implementation therefore proposes a separate review artifact and keeps the original failure held. No automatic repair or acceptance path is added.

## Candidate and exact ownership

- New `web/lib/sources/tweetLunaEvidenceBinding.ts`: `proposeLunaEvidenceBindingReview`, policy `luna-unique-exact-quote-review-v1`.
- `web/lib/sources/tweetLunaReview.ts`: only exports/names the existing goalie Zod schema so the candidate reuses it. Existing caller and validators retain the same behavior.
- `web/lib/sources/tweetLunaReview.test.ts`:32 new offline candidate tests in the nearest suite; historical tests retained.
- `web/lib/sources/tweetLunaReference.md`: documents the candidate, safety limits and current four-call stopped state. No executable prompt/rule change.

[candidate.patch](candidate.patch) shows only this phase's four-file change against the saved starting files. No transport, store, CLI, scorer, frozen label, identity validator, wording gate or S01–S10 library edit occurred. The other13 application files from the prior16-file manifest remain pinned. All14 E03 execution artifacts and26 approved preparation artifacts are unchanged. Shared work outside these files was preserved; work remains local/uncommitted on `octoberBranch`.

## Contract and safety comparison

| Concern | Existing runtime | Offline candidate |
| --- | --- | --- |
| Model response schema | Strict identity + goalieStatuses | Same schema parsed; no model fields added |
| Incorrect goalie offsets | Held | Original stays held; proposed coordinates are separate |
| Identity and dated candidates | Existing strict validator | Same request/hash/candidate/identity-span checks; no identity repair |
| Evidence lookup | Supplied exact offsets/text must agree | Literal source search only, then same exact-span validation |
| Duplicate/missing quote | Invalid spans hold | Any missing/multiple match holds, including overlapping matches; model offsets cannot disambiguate |
| Quote text | Must match source | Never trimmed, normalized, recased, paraphrased or extended |
| Subject/context | Existing goalie/overlap/wording guards | All existing guards rerun after derivation; no partial candidate on any failure |
| Acceptance | Human/source/game/conflict holds | Same holds plus explicit binding review; `canApply:false` |
| Dispatch or persistence | Existing separately authorized flow | No transport, environment loader, ledger, acceptance endpoint or runtime consumer |

The explicit policy is selected by the trusted caller, never read from source/model text. Disabled mode returns before accessing either input. Enabled mode accepts at most64 KiB of model output text, parses the strict shape and validates identity against the original prepared request. Each quote must occur exactly once in the **original** source. Search advances one UTF-16 unit when checking another match, so overlapping matches count. Derived offsets use JavaScript UTF-16 `indexOf`/`length`; `exactIdentitySpan` additionally enforces surrogate and grapheme boundaries.

All derived proposals must pass the unchanged selected-goalie/occurrence, overlap, full-context, negation/conditional, tentative wording, correction and repeated-identity checks. Only coordinates may differ; occurrence, canonical ID, status, identity and evidence text are unchanged. Empty goalie output remains empty, with `not_needed`; the candidate never invents a missing answer. Shape/identity/context failures return no candidate or partial corrections.

The immutable review record retains original model output text verbatim, its UTF-8 SHA256, request/source hashes, exact before/proposed spans and a candidate hash binding these to the policy version. Candidate statuses remain nested, `verified:false`, game/team/override null, and explicitly human-review-only. The existing ledger remains the authoritative receipt/raw output record. No original review, label, grade or receipt is replaced.

## Actual verification

Node22.11.0, existing dependencies; empty inherited environment, `envDir:false` and inherited fetch/HTTP/TCP/TLS/DNS denial. Fake-key transport mocks and temporary synthetic ledgers only.

| Check | Result |
| --- | --- |
| Nearest Luna suite | **175 passed** (143 existing +32 new) |
| Final targeted candidate tests after type-only fixture correction | **32 passed**,143 intentionally skipped |
| Exact saved E02/E03 response replay through unchanged caller/transport | **2/2 original held reviews and request bodies reproduced exactly** |
| Separate derived candidates | Both match the pre-existing label fields/allowed spans; not scored as new model successes |
| Scoped TypeScript, including replay and tests | Passed, exit0 |
| ESLint on three touched/new TypeScript files | Passed, exit0 |
| Focused whitespace/diff and preserved-file hashes | Passed |

The first typecheck found only widening of the test helper's policy string literal. An explicit argument type fixed it; [typecheck-initial.log](typecheck-initial.log) and final [typecheck.log](typecheck.log) preserve both outcomes. The production helper did not change after the175-test pass. Final candidate tests and lint were rerun after that test annotation. No full-app build, application-wide suite or live model run was performed.

The32 additions cover valid negative/first-off/likely/explicit warmup statements; emoji prefixes and grapheme splits; repeated/overlapping quotes; missing, case/whitespace/Unicode-normalized text; clipped negation and conditions; later corrections, repeated identity and pronoun contradictions; wrong/overlapping subjects and teammate predicates; attendance/backup inflation; identity/ID/hash/extra-field/type violations; duplicate subjects; atomic rejection; immutable raw/input/candidate data; disabled policy; already-valid spans and omission preservation.

[OFFLINE-REPLAY.json](OFFLINE-REPLAY.json) contains both raw-output-preserving correction candidates and unchanged historical scores. [replay.ts](replay.ts) is the network-denied reproducer; it never modifies the real ledger and writes a new output only (`wx`). [START-PINS.json](START-PINS.json) records the baseline; final [FILE-PINS.json](FILE-PINS.json) pins deliverables and evidence.

Reproduction from `web/` uses the existing offline config/tripwire. The full test and lint commands are in `web/lib/sources/tweetLunaReference.md`. Scoped TypeScript:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' ./node_modules/.bin/tsc --noEmit --incremental false -p ../tasks/artifacts/luna-reference-package-2026-10-31/span-binding-review/tsconfig.json
```

The replay was run with the same tripwire plus `NODE_PATH=.`, `TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowJs":false}'` and `node --experimental-require-module -r ts-node/register/transpile-only ../tasks/artifacts/luna-reference-package-2026-10-31/span-binding-review/replay.ts`. It refuses to overwrite the existing output; use a separately reviewed artifact copy/destination for another run. Node's experimental ESM warning is expected. No replay invocation is a paid retry.

## Remaining limits and independent-review gate

This helper is a proposed **review mechanism**, not an automatic replacement for the strict output contract. It depends on the caller supplying the original prepared dated request and retained output from the same source/receipt. It does not independently authenticate a source, check a provider envelope's completion status, reconstruct packet lineage or record a human decision. Any future integration must preserve the existing completion/retention/clock checks and bind receipt, source revision, request, reviewer identity/time/decision and candidate hashes. This pure module grants no acceptance, publication or dispatch authority.

Unique text can still be misleading, clipped or semantically unrelated in ways the existing finite lexical gates do not understand. The current tests cover the named attacks; they do not prove universal negation/coreference/prompt-injection resistance. Full human source/context review, independent game/time acceptance and conflict/retraction review remain required. No new swipe UI, automatic training or semantic inference was added.

Independent review is **pending** for the local four-file candidate. There is no permission denial or uncertain new action. E02/E03 remain failed model evaluations; all material is exposed synthetic development data, with the real independent evaluation gap unchanged. A later automatic binding contract or paid continuation needs its own exact reviewed plan; neither is activated here.

The real ledger is byte-for-byte unchanged at SHA256 `fc59014d3ff7f3abdfdec0703ffa77f80e5d02ef764f19d21cb85fc08adbd8f2`: disabled,4/20 used,16 slots remaining, aggregate exposure $0.263950397/$1 including the historical uncertain reservation. Historical ledger SHA256 remains `e8418735afaeff893177e550df6774600c6c6fec4f49c2b01c183712cdc064f2`. No reservations were released or budgets reset. Credential rotation before production, hosted qualification and deployment remain separate gates.
