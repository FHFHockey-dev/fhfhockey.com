# Luna identity: offline first milestone

Follow-on local integration, current checks and existing-cap paid-trial gates are recorded in [INTEGRATION.md](INTEGRATION.md). Its conditional use of the existing $0.52 TOTAL cap supersedes this first milestone's earlier proposed spending prerequisites; no cap reset or paid request occurred.

Implemented locally in the canonical checkout on `octoberBranch`. Starting HEAD was `0e32615584b1e6916ff9f5a4df05a113bae94aee`; concurrent work advanced HEAD through player-page commit `c270121d9505d7fc912ec446f60c40d6e980eb8f` to `ce604a55a206dbeec18ace9b650f5cefdd177e4a` at the final preservation check. This task made no commits or branch/worktree changes. All implementation files below are new; no existing application/test files were edited.

## Delivered files

| File under `web/lib/sources/` | Purpose |
| --- | --- |
| `playerIdentitySnapshot.ts` | Pure versioned export contract, content hash, validation and immutable index over supplied `PlayerIdentity` records. Explicit `nhl:` namespace, separate optional registry link, full/compound names, Unicode-preserving key plus existing accent-folded search key, positions, dated verified/scoped aliases with provenance, dated memberships, snapshot time and declared completeness. |
| `tweetIdentityCandidates.ts` | Alias-aware and conservative edit-distance retrieval, reusing `resolvePlayerIdentity`. Team/position rank candidates without removing lexical possibilities. Candidate rows withhold aliases ineligible at source time. Ambiguity, conflicting memberships, completeness and overflow remain visible; caps are 40 initially and 80 on one wider pass. Retrieval never selects an identity. |
| `tweetIdentityProposal.ts` | Default-off request preparation, injected fixture transport and strict per-occurrence output validation. Full source/provenance, request/directory hashes, exact UTF-16/grapheme-safe spans, allowed IDs per occurrence, null/abstention statuses, timeout/abort and fail-closed atomic results. At most two transport calls per run (initial plus one widening pass). |
| `fixtures/tweetIdentityOfflineFixture.ts` | Entirely synthetic people, IDs, teams, dates, aliases, provenance and mock replies. |
| `tweetIdentityCandidates.test.ts` | Snapshot/retrieval safety and comparisons with the actual unchanged current shortlist function. |
| `tweetIdentityProposal.test.ts` | Mock contract/safety, widening, source preservation, subject binding, injection-shaped output rejection and reference-digest tests. |

The experimental API requires literal `enabled: true` and an explicitly supplied transport. No environment flag, production caller, provider adapter, storage writer, publisher or notification hook was added. The existing alias-blind shortlist remains the live default; its repaired alternative is isolated in this fixture-only experiment.

Undated legacy `PlayerIdentity.aliases` and `teamId` are not promoted to verified historical evidence. Callers must supply explicit alias provenance/scope/validity and membership intervals; absent evidence remains absent. Only NHL-linked identities are supported in v1; an unlinked registry prospect is not silently converted into an NHL ID. Position is contextual, not historical roster proof.

## Comparative observations (synthetic structures only)

The comparisons execute `buildTweetNewsInferencePlayerCandidates` unchanged, then the new deterministic retrieval. These examples are test assertions, not a scored dataset or numerical accuracy claim.

| Synthetic mention | Current shortlist | New retrieval | Mock resolver contract |
| --- | --- | --- | --- |
| `Milo North` | Canonical candidate | Canonical candidate | Validated proposal possible; still human review |
| `Sparky` (verified global alias) | Missing with no team hint | Alias candidate | Scripted permitted ID accepted as a proposal |
| `Milo Nort` | Missing with no team hint | Conservative fuzzy candidate | Model efficacy untested |
| `Emile St-Pierre` | Canonical candidate | Unicode/compound candidate | Original accented spans preserved |
| `Vale` (two synthetic people) | Both candidates | Both candidates | Ungrounded choice held; explicit source team context can distinguish |
| Unknown text | Empty | Empty | Null outcomes allowed; nearest name never required |
| Two-edit spelling outside initial shortlist | No efficacy assertion | Candidate available on bounded widening | Scripted second-pass response proves plumbing only |

Other fixtures cover trades/history, wrong/stale teams, conflicting memberships, multiple people, separate compound-name spans, headings, cap overflow, invalid IDs, source/request mismatches, malformed output, timeouts/late replies, hostile text and certainty-preserving source handling. `Blackhawks lines`, `Lomberg-Del Bel-Garland` and `Greaves in the home` are unlabeled structural leads, not gold identity examples.

Mention extraction remains caller supplied and exact-span validated. V1 context hints must be occurrence-local: they cannot overlap the name, cross a sentence/line boundary or span another supplied occurrence. Shared heading/team context requires a future explicit scope contract and is conservatively held. These structural checks do not prove the semantics of a caller's team-label mapping or identify every unnamed subject. No automatic segmentation of ambiguous unspaced hyphenated chunks was introduced. Heading/chunk matches are rejected. No alias can be learned from any result. The contract cannot establish whether a real model chooses the correct allowed ID or resists all injection attempts; it prevents output from expanding authority or escaping the permitted schema/IDs/spans.

Phrase hints reuse the existing dictionary's categories, meanings, evidence requirements and notes without forwarding `autoPublish`. Curated cautions preserve projected first-off observations, practice versus game confirmation, actual game-time context, five-on-three meaning and explicit injury subjects. No keyword is required for request preparation. No model-written lineup prose or claim-certainty field is accepted, and downstream interpretation/gating remains unchanged.

## Checks actually run

Node `v22.11.0`; existing npm installation; no install or lockfile changes. Commands run from `web/` unless stated otherwise.

1. `npx --no-install vitest run lib/sources/tweetIdentityCandidates.test.ts lib/sources/tweetIdentityProposal.test.ts` — initial 53 tests passed, then 59 after bounded safety/comparison cases. Acceptance review added three regression tests, giving **62 new tests**, all passing in the final guarded six-file command below.
2. `NODE_OPTIONS=--require=/tmp/fhfh-luna-offline-network-guard.cjs npx --no-install vitest run lib/sources/tweetIdentityCandidates.test.ts lib/sources/tweetIdentityProposal.test.ts lib/sources/playerIdentity.test.ts lib/sources/tweetNewsInference.test.ts lib/sources/tweetDecisionReview.test.ts lib/sources/tweetClaimExtraction.test.ts` — initial **140 = 59 new + 81 existing** tests passed. After acceptance-review corrections, **6 files / 143 = 62 new + 81 existing tests passed**, no network attempts. The temporary preload replaces Node HTTP/HTTPS request/get and global fetch with throwing guards and exits unsuccessfully if an underlying request is attempted. New tests also spy on these APIs. Existing tests use supplied fixture/database stubs and injected mock transports; no route execution. This guard covers these interfaces, not every possible operating-system network primitive; the reviewed import/call paths contain no other live client.
3. `npx --no-install tsc --noEmit -p .` — default heap exhausted, exit 134. Retried with `NODE_OPTIONS=--max-old-space-size=8192` (the repository's typecheck-script setting); found one Buffer typing mismatch in the new hash test. Corrected it with an explicit `Uint8Array`. The same 8 GiB command then **passed**, and **passed again after both acceptance-review corrections**.
4. `npx --no-install eslint lib/sources/playerIdentitySnapshot.ts lib/sources/tweetIdentityCandidates.ts lib/sources/tweetIdentityProposal.ts lib/sources/tweetIdentityCandidates.test.ts lib/sources/tweetIdentityProposal.test.ts lib/sources/fixtures/tweetIdentityOfflineFixture.ts` — **passed**, including final edits.
5. From repository root: direct whitespace scans of the six new files and handoff/diary, baseline hash comparison and retained-file comparison — **passed for this slice**. `git diff --check` initially passed, but the final whole-checkout run exited 2 for four trailing-whitespace lines (270, 283, 306, 517) in concurrently added/changed `tasks/artifacts/release-r7-2026-10-20/F1-local-run-fence-master.patch`, outside this task; left untouched. One initially dirty player-page stylesheet changed concurrently; no task edit touched it. The two initially dirty neighboring interpretation test files retained their inspected bytes. No overlapping source edit was found.

Reference preservation proof: SHA-256 of `decisionsReference/adapter.mjs` before and after is **`055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`**. A passing test independently hashes the retained file. `git diff --quiet 0e32615584b1e6916ff9f5a4df05a113bae94aee --` returned zero for the adapter, its declaration, downstream mapping/results, `playerIdentity.ts`, `tweetNewsInference.ts`, automation/dictionary, claim extraction, alias-review route and update-players route. The retained model remains `gpt-6-luna`; bytes, digest, interface, one-player requirement and temporal gates are preserved.

No local production build, dependency installation, paid model call, production request, data read/write, roster refresh, alias learning, email, notification suppression, cron invocation, push, merge, migration, deployment or settings change occurred. No secrets were read. Live flags, freshness and roster schedule remain unverified. Existing provisional IFTTT cases were neither relabeled nor treated as a holdout.

## Acceptance adversarial review

Two concrete defects were reproduced with failing tests and corrected locally in the experimental files only:

- A team or position hint could quote another subject's clause while retaining exact source offsets. Both `hint borrowed` regression cases initially returned a proposal; context binding now holds them before dispatch, including when another supplied name intervenes without sentence punctuation.
- Ineligible scoped/historical aliases were excluded from retrieval matching but still exposed inside a candidate's full row. The `out-of-scope alias metadata` test initially exposed `Little Spark` after a synthetic trade. Candidate rows now contain only source-eligible aliases; the immutable full snapshot is preserved.

The requested review also confirmed:

| Adversarial case | Current boundary |
| --- | --- |
| Correct ID hidden by shortlist cap | Counts/omissions/truncation remain explicit; every matched proposal over a truncated set is held. Only one widening pass is allowed, capped at 80, then unresolved outcomes remain unresolved. |
| Missing source-time membership | No undated team fallback. Membership/alias evidence is unknown/withheld before interval starts or after snapshot time. A canonical lexical identity proposal may remain possible without team proof; it does not establish a historical team. |
| Alias scope leakage | Matching and model candidate metadata both use only verified aliases eligible at source time, including team scope. |
| Forced nearest match | Retrieval selects nothing; null outcomes and rejection of every candidate are allowed. Context-only candidate selection is rejected. |
| Injected or invalid IDs | Strict schema and exact per-occurrence candidate ID membership, request/directory hashes and evidence spans fail closed. A wrong-but-permitted ID still requires real-model evaluation and human review. |
| Default-off/live calls | Literal `enabled: true` is checked before input or transport getters. No provider/default transport, environment activation or production callsite exists. An explicitly enabled injected callback is trusted code, not an operating-system sandbox; all verification supplied mocks and guarded networking. |

No other concrete defect was found in this bounded review. Remaining semantic/model efficacy limits are not demonstrated by mocked tests.

## Bounded follow-on proposal (not authorized or run)

First freeze independently adjudicated labels for a targeted failure bank and a separate untouched representative sample. Split by original tweet/relay/edit lineage, not receipt, so no lineage leaks between sets. Obtain permission to use the source data and a dated, verified directory export; confirm intended occurrence identities and claim modalities, including abstentions/non-players and ambiguous historical membership.

Proposed small pilot: at most **20 distinct original lineages** (10 targeted, 10 untouched), concurrency one, at most one widening pass per original (**40 total requests maximum**), bounded full-input/output token budgets, no automatic retries, and retained tokens/billing/latency per request. A fresh explicit total spending cap, current verified pricing/routing/model availability and worst-case token/cost reservation are prerequisites. The prior $0.52 cap grants no allowance here. Stop before dispatch if the remaining approved budget cannot cover the bounded worst case.

Compare current baseline, improved deterministic retrieval and real model proposals separately. Report retrieval recall, wrong-player count/rate (with denominators), coverage/abstention, certainty inflation, subject-binding errors, tokens, actual billed cost and latency by cohort. Do not optimize for fewer alias emails or infer accuracy from these mocked tests. Any live wiring, grouped notifications, alias learning or publishing remains a separate decision; this milestone changes no cadence or production behavior.

## Approved real-data continuation checkpoint

See [real-trial-2026-10-20/REPORT.md](real-trial-2026-10-20/REPORT.md). The approved bounded export completed; RNH has no eligible alias or candidate, including bounded widening. Paid dispatch stopped at the required retrieval gate. No provider request or ledger mutation. Original reserve/block/reference unchanged.

## Acronym correction and paid-execution denial

See [acronym-continuation/REPORT.md](acronym-continuation/REPORT.md). Generic weak acronym retrieval corrected; 91 focused tests, project typecheck/lint and five in-memory admission tests passed. Exact wire and40-pin manifest independently approved. Automatic approval review rejected the paid command before process creation for insufficient explicit payload/destination/spend authorization; no process, provider request, credential load, reserve or retry. Original ledger/block/reference unchanged. Sealed continuation awaits narrow explicit confirmation described in the report.

## Completed one-request real trial

See [acronym-continuation/TRIAL-RESULT.md](acronym-continuation/TRIAL-RESULT.md). After explicit confirmation the same sealed request was admitted once and completed. Luna proposed Podkolzin -> Vasily Podkolzin (strong), RNH -> Ryan Nugent-Hopkins (tentative); both agree with owner development labels and pass validator. Tokens1930in/237out, conservative costceiling$0.000342650 against reserved$0.231844800; aggregate exposure$0.262519843. Originalunknown/block/36priorrows and reference remain unchanged. No extra calls, alias writes, production changes or deployment. Two-player exposed development trial only; no general accuracy or email-volume claim.

## Owner-confirmed persistent nickname

Stored and independently read back RNH -> Ryan Nugent-Hopkins (NHL8476454, registry9521) in canonical live `fhfh_player_identity_aliases`, row49ecf910-d9fd-469d-856a-73b80a0689d8, manual/verified with TJconfirmationprovenance. No duplicates/conflicts, occurrence/replay/membership writes or paidcalls. See [owner-confirmed-nickname/REPORT.md](owner-confirmed-nickname/REPORT.md) and receipt.
