# Luna / IFTTT readiness — 22 October 2026

The local identity and review contracts pass the refreshed offline checks. They are not a live identity service or qualified publishing pipeline. No application source changed in this readiness pass. No credentials, provider/account APIs, hosted database, alias writes, cron, deployment or automation were used.

Canonical checkout: `octoberBranch`, HEAD `a811b0762ffe29006c3df7eaa4c19bf18deecda3`. Extensive concurrent work remains intact. This task owns only this artifact directory and `tasks/diaries/2026-10-22-codex-luna-ifttt-readiness.md`; FORGE, stats, Yahoo and central sprint registers were not edited.

## Reconciled current status

| Area | Completed evidence | Remaining boundary |
| --- | --- | --- |
| Dated identity directory | Pure versioned snapshot, distinct NHL/registry IDs, Unicode keys, explicit alias scope/provenance, membership intervals, hash and completeness. Current reviewed pins match. | No general adapter from persisted alias provenance and dated membership into this snapshot. Legacy directory loading flattens aliases to strings and current organization evidence; that is insufficient historical evidence. |
| Candidate retrieval | Alias-aware, conservative fuzzy and generic acronym candidates; ambiguity, collisions, omitted candidates and bounded widening are explicit. | Still experimental. A partial two-player export cannot measure league-wide retrieval or acronym collisions. |
| Resolver/local caller | Strict source/occurrence/ID/hash validation, abstentions, timeout and injection controls; literal default-off boundary; local caller supports injected mocks only. | No production caller imports the new modules. The separate sealed Responses trial does not provide a reusable production transport. Shared headings and ambiguous/malformed chunks remain held. |
| RNH nickname | Saved write/readback receipt confirms **RNH → Ryan Nugent-Hopkins, NHL 8476454 / registry 9521**, in canonical `fhfh_player_identity_aliases`, manual/verified, owner provenance, created 2026-10-20T23:07:11.812724Z. | Persistence is complete; do not repeat it or create a second lineup-store alias. Current live consumption/flags were not inspected. Confirmation does not establish historical team membership or authorize retroactive alias validity. |
| Phrase hints | `tweetNewsPhraseDictionary.ts` supplies meanings, required evidence and cautions. `buildTweetIdentityHints` excludes `autoPublish` and confidence authority, preserves no-keyword news, and adds conservative legacy keyword/Unicode line-shape hints. | This is a code-maintained dictionary, not a new persistent nickname database. Its caution strings do not prove semantic model accuracy. Changes need source-backed review and fixture evidence. |
| Dated source hints | Existing `applyTweetClaimSourceHints` checks dated source coverage, a complete unique team/date schedule and independent dated roster evidence; its database interface is mocked in this pass. | It is a separate mechanism from identity phrase hints. No live coverage, schedule completeness or roster freshness was verified. |
| Downstream Decisions review | Pure mapper/results tests pass; one canonical player, exact source/proposition bindings and temporal holds remain required; authority stays review-only. | No automatic statement producer or identity-to-claim bridge is supplied by the identity module. The native mapper currently supports availability, starter, transaction and limited observation facts, not a multi-player PP replacement operation. |
| Real model evidence | One sealed S06 development request completed on October 20. Both occurrence proposals agreed with TJ's exposed labels; strict validation passed. | One tweet, two-player partial universe, no independent holdout. It did not test PP replacement, prior-slot state, claim certainty, claim subject binding or representative accuracy. |
| IFTTT rollout | Existing handoffs contain accepted local held/retain-only/recovery slices and separate pure-review candidates. | Historical accepted manifests apply to their pinned bytes. This pass did not requalify the entire receiver/storage/consumer chain, production schema, flags, writers, authentic intake or deployment. |

The older `INTEGRATION.md`, paid-gate/preflight notes and early IFTTT checkpoints are historical checkpoints. Their missing-export/paid-call-blocked/alias-not-stored descriptions do not supersede the later [completed S06 trial](../luna-identity-offline-2026-10-20/acronym-continuation/TRIAL-RESULT.md) and [owner-confirmed nickname receipt/report](../luna-identity-offline-2026-10-20/owner-confirmed-nickname/REPORT.md). Their original evidence remains unchanged.

The S06 request used 1,930 input and 237 output tokens; saved usage-derived price was $0.000311500 and the conservative ledger charge ceiling $0.000342650. These are historical receipts, not fresh invoice verification. The saved final ledger receipt retains the original `lindgren-0` uncertain reservation and global unknown-outcome block. No paid script or spending ledger was executed or mutated in this pass. No further call is authorized by remaining arithmetic headroom.

## Bounded offline acceptance completed

**252 distinct tests passed across 11 files**, including the **91 existing identity tests**, not 252 plus 91. No new test cases were added. The prior 164-test and 91-test milestones are historical evidence and are not added to this count.

| Test file in `web/lib/sources/` | Passing cases |
| --- | ---: |
| `tweetIdentityCandidates.test.ts` | 26 |
| `tweetIdentityProposal.test.ts` | 43 |
| `tweetIdentityLocalReview.test.ts` | 17 |
| `tweetIdentityEvaluation.test.ts` | 5 |
| `playerIdentity.test.ts` | 7 |
| `tweetNewsInference.test.ts` | 7 |
| `tweetClaimSourceHints.test.ts` | 3 |
| `tweetClaimExtraction.test.ts` | 13 |
| `tweetDecisionReview.test.ts` | 54 |
| `tweetNewsAutomation.test.ts` | 29 |
| `iftttSemanticResearch.test.ts` | 48 |

These cover missing/invalid IDs, acronym collisions, truncated shortlists, absent true candidates, scoped/stale aliases, source-time membership, abstention, exact Unicode spans, hostile text, timeout, heading/chunk holds, default-off getters/dispatch, source certainty, and label/lineage separation. Research-fixture cases verify provenance/integrity and retain provisional labels; they are not semantic implementation acceptance. Mock/model plumbing checks are not Luna accuracy measurements.

Node **22.11.0**, npm **10.9.0**, existing dependencies. [Exact JSON result](vitest-results.json), [final log](vitest.log), [source/receipt pins](SOURCE-PINS.json), and [final preservation check](VERIFICATION.json) are retained.

The task config reuses repository transforms/setup, sets `envDir:false`, uses one worker, and stores Vite cache in `/tmp`. The command starts with an empty inherited environment, disables npm's update/audit/fund checks, uses inert user/global npm configuration, and preloads a guard before npm/Vitest. The guard blocks fetch, HTTP/HTTPS request/get, TCP/socket connect and TLS connect; tests additionally assert mocked transports were not called. No guarded attempt appears in the final run. This is reviewed JavaScript-interface denial, not an OS-wide network sandbox.

The initial npm command stopped before tests because npm rejects using the same `/dev/null` file for both global and user configuration. After separating those files, all 252 tests passed but the guard recorded one blocked attempt; that run is not used as a zero-attempt result. Disabling npm background checks and adding call-site diagnostics produced the final clean run. Initial logs are preserved; no blocked network operation was allowed through. No source fix was necessary.

Exact final command, from `web/`:

```sh
env -i PATH="$PATH" TMPDIR=/tmp \
  NODE_OPTIONS=--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/network-guard.cjs \
  npm_config_update_notifier=false npm_config_audit=false npm_config_fund=false \
  npm_config_userconfig=/dev/null \
  npm_config_globalconfig=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/empty-global.npmrc \
  npm_config_cache=/tmp/fhfh-luna-readiness-npm \
  npx --no-install vitest run \
  --config ../tasks/artifacts/luna-ifttt-readiness-2026-10-22/vitest.config.mjs \
  lib/sources/tweetIdentityCandidates.test.ts lib/sources/tweetIdentityProposal.test.ts \
  lib/sources/tweetIdentityLocalReview.test.ts lib/sources/tweetIdentityEvaluation.test.ts \
  lib/sources/playerIdentity.test.ts lib/sources/tweetNewsInference.test.ts \
  lib/sources/tweetClaimSourceHints.test.ts lib/sources/tweetClaimExtraction.test.ts \
  lib/sources/tweetDecisionReview.test.ts lib/sources/tweetNewsAutomation.test.ts \
  lib/sources/iftttSemanticResearch.test.ts \
  --reporter=default --reporter=json \
  --outputFile=../tasks/artifacts/luna-ifttt-readiness-2026-10-22/vitest-results.json \
  > ../tasks/artifacts/luna-ifttt-readiness-2026-10-22/vitest.log 2>&1
```

No full TypeScript, lint, build, browser, disposable-Postgres or production check was run: this pass changed no application TypeScript, and the focused existing tests answer its readiness questions. Historical compiler/lint results are not represented as current runs.

## Actionable next work and decisions

1. **Smallest next local increment: export-to-snapshot provenance adapter.** Use the already retained two-player export and owner receipt as development fixtures, with no new data access. Preserve alias status, owner/source provenance, canonical namespaces, scope, observation time and explicit membership intervals. Do not route through the existing flattened alias strings. Acceptance: RNH is withheld at S06's September 29 source time unless independently justified historical eligibility exists; post-confirmation eligibility must follow the agreed time policy; missing dates/conflicts/truncation remain unknown. Generalizing from two rows is expressly out of scope. Decision needed before mapping: distinguish when a nickname was known/verified from the interval when it was valid; do not silently turn the confirmation timestamp into historical truth.
2. **Prepare the identity-to-claim boundary using the same retained S06 source.** Reuse saved validated proposals offline; never redispatch the paid script. Bind Podkolzin/RNH to separate original occurrences, retain replacement direction and the source's literal “first unit” wording, and hold unsupported multi-player operation/prior-slot/game applicability. Do not feed a two-player chunk to the single-player reviewer or equate a matched identity with confirmed participation. Define the review-only native replacement contract and deterministic statement producer before implementing automatic swaps. This is the next integration decision, not a completed feature.
3. **Close caller/hint coverage deliberately.** Keep shared headings held until an explicit bounded scope contract is reviewed. Reuse existing malformed extraction, repeated-name, compound-name, wrong-team, stale-membership and no-keyword fixtures; add a real source case only when context and lineage are retained. “Blackhawks lines,” “Lomberg-Del Bel-Garland,” and “Greaves in the home” remain unlabeled leads, not identity gold. Do not ask TJ to repeat the already supplied S06 name interpretation.
4. **Qualify efficacy separately.** A broader approved dated directory and independently adjudicated real failure bank/untouched representative holdout are missing. Split by original/relay/edit lineage; freeze labels after source review and keep them out of prompts. Compare retrieval recall, wrong-player counts/rates, resolution/abstention, non-player errors, certainty inflation, subject-binding errors and cost/latency on identical inputs. No additional synthetic-only score or single-sample success closes this gate.
5. **Leave live gates with the rollout owner.** Exact combined candidate/pins, receiver/storage/migration compatibility, known writer/fence state, actual flags/freshness/refresh cadence, authentic intake, bounded future evaluation, durable transport/spend admission and publication/notification authority require their separate evidence and authorization. Current readiness does not authorize any of them. RNH persistence requires no repeat approval or write; live ingestion consumption remains unverified. Notification deduplication/cadence remains a future proposal.

No new execution denial or uncertain external outcome occurred in this pass. Local acceptance is complete. Further model/data/operational steps are deliberately unattempted under this turn's restrictions; the historical uncertain paid attempt remains unresolved. No claim of fewer alias emails or production accuracy is made.

## Preservation

All **40** files in the independently reviewed S06 manifest still matched before verification; all **33** selected current source/config/fixture/receipt pins matched afterward. This is a bounded preservation proof, not a claim that unrelated concurrent files stopped changing. The existing `tweetNewsInference.ts` diff remains its single parameter-type narrowing; no runtime body edit was made here.

Retained `decisionsReference/adapter.mjs` SHA256 remains:

`055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`

No reference bytes, model, interface, aliases, sealed trial artifacts, spending state, runtime defaults, dependencies or lockfiles were changed by this pass.
