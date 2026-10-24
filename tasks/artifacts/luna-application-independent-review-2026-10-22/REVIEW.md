# Independent review — Luna offline application contracts

**Outcome: one reproduced P2 correctness defect requires a narrow repair before accepting the two-subject contract. The temporal projection passes the tested local contract, subject to source-binding and evidence-authenticity limits below. No immediate production exposure or effect-authority escalation was found.** This review pass is complete; implementation and review of a corrected candidate are separate tasks.

## R1 — Outgoing subject can bind to a repeated non-subject word

**Priority/severity:** P2, medium review-evidence correctness. **Confidence:** high, two reproducible failing controls. **Owner/scope:** the new Luna contract packet, specifically `web/lib/sources/tweetIdentityReplacementReview.ts:26–35` and its nearest test. Existing identity validation is inherited; this missing grammatical-slot check is in the new helper.

The helper checks that the outgoing occurrence lies after the incoming occurrence and within the clause. It reconstructs the whole clause using the outgoing **text**, but never checks that the outgoing **offset** is the possessive subject slot immediately after ` will take `. An exact but unrelated occurrence of the same word therefore passes both validators.

| Synthetic source | Proper outgoing span, UTF-16 half-open | Supplied wrong span accepted |
| --- | --- | --- |
| `Milo North will take spot's spot` | `spot` at `[21,25)` | common noun `spot` at `[28,32)` |
| `Milo North will take will's spot` | second `will` at `[21,25)` | predicate `will` at `[11,15)` |

The synthetic directory contains Milo North and Riley Spot / Riley Will; the existing case-insensitive surname match supplies valid canonical candidates. The request is built through `prepareFixtureIdentityRequest`, not fabricated or rehashed. The scripted response selects those candidates with the supplied exact spans. `prepareTweetIdentityReplacementReview` returns **`reviewable_held` with a packet**, where **`held` with no packet** is expected for the misbound subject. Correctly positioned occurrences in the same fixture pass the other controls.

**User impact:** malformed extractor/caller annotations can become apparently validated subject evidence in a human review packet. This undermines the claimed subject-to-clause binding and could contaminate future evaluation/annotation data. It does **not** enable publication, alias writes, status changes, provider dispatch or swaps: every authority flag remains false, and the packet has no production caller.

**Minimal reproduction:** `review-contracts.test.ts:105–112`, cases `repeated noun` and `repeated predicate`; run `sh tasks/artifacts/luna-application-independent-review-2026-10-22/RUN-CHECK.sh adversarial`. Receipt: `adversarial-tests.log` and `.json`, **2 failures / 9 passes / 11 total**. The two failures both say `expected 'reviewable_held' to be 'held'`.

**Surgical repair:** require the outgoing span to start exactly at `incoming.evidence.end + " will take ".length` (and preserve exact span/end consistency), alongside the existing full-clause check. Extend the existing replacement test with repeated predicate/noun controls and a correct-slot positive control. Preserve the accepted apostrophe variants, UTF-16 binding, unit validation, full-source context, and all held effect flags. No broader parser/extractor or identity-policy change is indicated.

**Acceptance/release implication:** keep this packet local/default-off and return this one helper/test slice to its current owner. Re-run the 30 existing tests and these two controls against newly pinned bytes, then independently review the small diff. This finding blocks accepting the claimed exact two-subject binding; it is not evidence of a live security incident and does not authorize a release.

## Temporal integration limit — tested, not a current production regression

Within a single correctly paired invocation, `playerIdentitySnapshotEvidence.ts:45–67` enforces the causal source cutoff versus the retrospective review cutoff at microsecond precision. Aliases/memberships also require independently declared effective intervals; validity is evaluated as a half-open interval by `playerIdentitySnapshot.ts:111–126`. Missing knowledge or historical validity remains unavailable. The saved September causal fixture yields zero canonical rows; the explicitly retrospective fixture yields two. Database record timestamps do not substitute for historical membership. Supplied provenance is retained, not independently authenticated.

**A derived snapshot is not a reusable causal directory for arbitrary earlier sources.** The wrapper retains evaluation metadata at `playerIdentitySnapshotEvidence.ts:101–107`, but the underlying snapshot carries only a digest in provenance, not enforceable per-record knowledge clocks. Existing `prepareFixtureIdentityRequest` at `tweetIdentityProposal.ts:118–128` accepts that bare snapshot and another source timestamp. It does not enforce equality with the projection's original source date.

The independent characterization at `review-contracts.test.ts:95–103` projects canonical rows known September 20 using a September 29 causal cutoff, then prepares a September 1 source against the resulting snapshot. It obtains a canonical candidate; projecting correctly for September 1 produces zero rows. This is a demonstrated composition limitation with **no production caller or current wrong-source usage found**. It is not counted as another failing application test or a defect in the projection's supplied-cutoff comparison.

**Gate before integration or causal evaluation:** retain the full projection/mode lineage; prepare or validate requests against the same source publication instant; regenerate the causal projection for each source cutoff. If reuse is needed, add an explicit source-binding contract and a rejection regression test first. Do not label a retrospective result or a reused later-cutoff snapshot causal. Current positions remain directory attributes; this pass does not qualify them as historical role evidence.

## What passed and what is preserved

- The five additions in `application.patch` reconstruct byte-for-byte to `CANDIDATE.json`. All 55 checked owner pins match at start/end: 5 candidate files, 40 retained trial pins, 5 verification inputs, 4 receipt files, and the patch. All 17 source/configuration files in the isolated test snapshot stayed unchanged in the canonical tree and scratch copy. HEAD stayed `d3f057c6c849d5d5474bc912a6f461f617c65b15` on `octoberBranch`.
- **30/30 owner tests passed independently:** 16 projection, 14 replacement. Owner first-run fixture failures were not counted as current failures. The new independent suite has **8 passing safety controls, 1 passing integration characterization, and 2 failing R1 controls**. These are synthetic contract tests, not model accuracy evidence.
- Microsecond canonical knowledge ordering, late knowledge versus backdated validity, half-open membership validity, and current-record-without-effective-history controls passed. Unknown membership stayed unknown in both the candidate and replacement packet.
- Literal `enabled === true` is required before payload access. Conditional prefix/full source context is retained, governing context and certainty remain unassessed, and successful packets are frozen. Existing heading and conflicting-membership rejection gates still reject through the new helper. The unchanged validator continues to enforce candidate membership, counts, namespace/hash/span binding, ambiguity and truncation checks; not every inherited branch was independently rerun here.
- The retained evidence still contains the owner-confirmed global RNH alias, without invented historical validity. The S06 owner test passes through the existing acronym candidate path while the undated alias itself stays withheld. No live nickname mapping was queried, rewritten or disabled. The retained reference adapter hash remains `055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`.
- Bounded TypeScript and four-file ESLint both exited **0**, with no diagnostics. No non-test imports of either new module were found in `web` TypeScript/TSX sources. The patch consists only of the declared five additions; no existing application source was modified by this packet or review.

## Snapshot and verification receipts

Tests ran on a source copy reconstructed from the pinned patch, with its bounded dependency closure copied and hashed. This is a scratch snapshot, not another Git worktree or branch. Existing installed dependencies were symlinked read-only for use; no install or lockfile change occurred. Node **22.11.0**, npm **10.9.0**, Vitest **3.2.7**. Execution used an empty inherited environment, inert npm config, disabled background npm checks, `envDir:false`, one worker, and the pinned fetch/HTTP/TCP/TLS denial preload. No network-denial diagnostics appeared. No network/service/API calls were requested by this review.

The independent Vitest config uses node environment and direct `lib` alias resolution; it intentionally does not load the app's environment/setup. Both owner test files already declare node environment. Scoped compiler options and ESLint configuration retain the owner's semantics; details and exact commands are in `COMMANDS.md` and `RUN-CHECK.sh`. The scratch copy, configs and adversarial test are preserved in `reviewed-source.tar.gz`; `snapshot.json`, start/end integrity JSON and `SHA256SUMS` bind receipts to bytes.

| Candidate | SHA-256 |
| --- | --- |
| `playerIdentitySnapshotEvidence.ts` | `390ed603af2cf2ca742ac36ec81c4973d2543684dfb42efbc9c9afeed84c7d4b` |
| `playerIdentitySnapshotEvidence.test.ts` | `77b834b8c011222d60360c5b8ab111bed4b1dfe8e44eb3cbd238f6c322bbaaaf` |
| `tweetIdentityReplacementReview.ts` | `23131921ff0d8caea93c4302f01bb3377bb823611c9410108973e0cab09b1124` |
| `tweetIdentityReplacementReview.test.ts` | `620479333f55017fcc7749535cd09fa893e2772ac8ff4f2371716df8a3640ee2` |
| `fixtures/tweetIdentitySavedEvidence.json` | `a6ed14b24e05ffdadd0d0de9593c12e5c8aad92bd8a8168d0cf91532598f0a2d` |

Patch SHA-256: `f918be644677718b90e59962345196ff44544cc081c1559afa794859d28c340d`. These are uncommitted additions at the stated base; the commit alone does not identify the reviewed candidate.

## Limits and next actions

1. Have the existing owner repair R1 in the helper and nearest tests, then obtain a fresh independent review of that exact diff and hashes. This review does not take ownership or implement the fix.
2. Preserve the source-cutoff binding gate when integrating the projection. Unknown membership/alias validity, prior-slot/game qualification, shared-heading extraction and native two-subject semantics remain open.
3. Keep paid model evaluation, representatively adjudicated accuracy, production integration and release as separate approvals/tasks. Old trial pins were checked for preservation, not rerun or converted into new qualification evidence.

No full application suite/compiler, build, browser, database, paid model trial or live service was run. No credentials/raw sessions were accessed; no application, billing, NST, CTPI, stats or owner-packet files were edited. No commit, push, migration or deployment occurred. Files that move after these recorded hashes require a later fixed-snapshot review. No execution denial or pending tool approval blocks this completed audit; R1 blocks unqualified local contract acceptance.
