# E01 omission diagnosis and reference v4 candidate

**Offline diagnosis complete.** The observed failure originated in the model's raw `goalieStatuses: []`, not in the transport, parser, validator or scorer. A small reference v4 clarification is implemented locally for independent review. It has **no new model evaluation** and no demonstrated accuracy improvement. The paid ledger remains disabled; no calls, retries, credentials, production actions, builds or deployments occurred in this diagnosis.

## Exact evidence and root cause

The paid E01 source was `SYN Avery Keeper starts tonight.` The original Responses request supplied one exact dated candidate, `nhl:900001`, with position G and an exact full-name match. It supplied publication/receipt times and original attribution. Team membership was absent, identity directory completeness was partial, and game binding/source acceptance remained downstream holds. The frozen response schema included goalie status fields and did not require a nonempty array. No truncation or refusal occurred: provider status was completed, output168 tokens, within the2,048 limit.

The provider's exact output text is preserved as `observed-proposal.json`; its original text SHA256 is `f46284357d6d5b4df1b633df19ee1d0c15a26731eec3f33848ee7e0313f56b71`. It matched the canonical identity and name span with tentative confidence, then returned an empty goalie array. No proposed goalie status existed for the validator to remove.

`replay.ts` injects the saved Responses and Decisions bodies into the existing real transport/caller/admission, with a fake credential, isolated synthetic temporary ledger and network-denial preload. It does not load environment files or use a network fallback. Before any candidate edit:

- Both reconstructed request hashes exactly matched the two paid request hashes.
- The retained result exactly matched `reviews/E01.json`, including its identity, empty goalie array, Decisions result, request IDs and holds.
- Frozen scoring produced identity pass / goalie fail / Decisions pass.
- A separate, explicitly synthetic control changed only `goalieStatuses` in the saved response to the already frozen positive label. It passed validation and all scoring, remaining `verified:false`, game/team/override null and subject to human/source/time/conflict holds.

This rules out a request mismatch, schema omission, result filtering, bad evidence variant or array-order bug as the cause of this observed failure. The empty array is schema-valid and safe to retain; `review_only` does not promise semantic completeness. The scorer correctly detected the omission. Decisions evaluates the separately bound deterministic statement and does not supply or repair a missing Responses proposal.

**The model's internal reason is unknown.** The v3 instructions already scoped identity-only instructions and distinguished wording from truth, so those repairs were present in the actual request. However, v3 said goalie statuses “may be empty” and explicit wording “may support” confirmation without an affirmative completeness instruction. Its nested phrase hint listed team/goalie `requiredEvidence`, and sourcePolicy marked game binding unresolved. These are plausible sources of over-abstention, not proven causes. There is no evidence that a particular sentence or field caused this single output.

## Candidate changes

Only three application files change relative to accepted R2:

- `web/lib/sources/tweetLunaReference.ts`: bump rules/package to v4; explicitly complete both response fields, emit supported wording for matched goalies under existing gates, and separate tentative identity confidence/missing team/game/source-acceptance prerequisites from unverified wording extraction. A match alone never forces a non-unknown status; ambiguity, conditions, corrections, contradictions and unsafe scope retain their existing abstention rules. No E01 answer/example or fixture name is inserted into runtime instructions.
- `web/lib/sources/tweetLunaReview.test.ts`: exact observed-output checksum/replay, unchanged empty-result failure, explicit synthetic positive control and wire-level scope/completeness checks. Existing57 wording rows and adverse subject/negation/correction/injection tests remain.
- `web/lib/sources/tweetLunaReference.md`: documents the clarification, observed failure, uncertainty and continuation boundary.

Strict schema, identity request/hash, validator, scorer, caller, transport, admission, manual CLI, Decisions mapping and library are unchanged. No synthesized fallback or mandatory `minItems` was added. The prompt change does not alter acceptance/publication authority or suppress abstentions. `candidate-vs-r2.patch` is the precise delta; baseline source copies and every original R2/paid artifact remain intact.

## Verification actually run

| Check | Result |
| --- | --- |
| Focused Luna suite | **139/139 passed**, including3 added cases and all existing safety/scoring cases |
| Scoped TypeScript | Exit0 |
| ESLint on two changed TypeScript files | Exit0 |
| Baseline saved-reply replay | Exact paid result/request hashes reproduced; synthetic positive passed |
| Candidate saved-reply replay | Omission still fails, synthetic positive passes; schema/identity request/Decisions unchanged |
| Standalone candidate rehearsal | 16/16 reports,20 mock requests, zero real requests |
| Candidate vs original batch | Inputs, labels, evidence variants, Decisions bindings and budget byte-structurally unchanged; only referencePackage differs |
| Integrity checks | All7 protected files,19 R2 artifacts and30 paid artifacts unchanged; real and archived ledger digests unchanged |

The focused suite also runs both baseline/equivalent-evidence rehearsal scenarios and the existing failure/uncertainty stop cases. Prior R2's265-test five-suite result remains historical; unchanged coupled suites were not rerun solely for this prompt clarification. No build or production test was needed.

Candidate replay differs from the original retained review only in `referencePackage`, `responsesRequestHash` and `reviewQueueKey`; the raw answer is deliberately unchanged. This demonstrates metadata versioning and unchanged validation, not a model response to the new prompt.

Synthetic-only reference hash: `9b8a10fd458596b75ba2c0900dea1b72b9ec446d5e0e660ca5c18341920abdb3`.

Offline candidate batch hash: `c4043a5ef36ffeb1ad5aa5ee9a45e1d34e249b1ad5477b129e14c9276e24a840`.

Offline candidate request-set hash: `e29967521c54117023b422e40ddaa8602e55ed152595184f592eed55ca961472`.

## Continuation remains blocked

The real ledger is still `enabled:false`, `bounded_evaluation_stopped`, with two settled requests and zero retries. Aggregate conservative exposure remains $0.263035195, including the full historical $0.262519843 and its unresolved $0.254394800 reservation. The historical ledger's stop remains intact.

The cumulative maximum remains20 calls: two used, at most18 remain if a continuation is separately reviewed and authorized. Remaining exposure under the same$1 cap is $0.736964805. Do not reset or clone the paid ledger to obtain20 more calls, reinterpret the historical uncertainty as zero, retry E01 automatically or resume merely because the package hash changed. The new full20-request rehearsal is strictly offline regression evidence, **not a paid continuation plan**; its synthetic ledger and unchanged original budget must never be used for spending.

Independent review must assess this prompt clarification and any subsequent continuation plan before paid work. Current instructions explicitly prohibit paid calls/retries. A future execution additionally needs current funding/scope checks and the verified production rotation/revocation gate; this candidate enables no production path. No authority is inferred from the owner's non-expiring key setting.

Residual limitations: v4 may still omit clear claims or over-abstain, and finite wording guards do not implement full semantic/coreference reasoning. E01 is now tuning/regression material. All16 synthetic reports and their labels were exposed development material; no independent rights-cleared real-world holdout exists. No new confidence/accuracy/recall claim is justified.
