# All-source semantic reducer — paused local candidate

Saved on October 15 after the coordinator's quota stop. The bounded reducer and offline tests are saved, uncommitted, in the canonical `/Users/tim/Code/fhfhockey.com` checkout on `octoberBranch`. **This is not full semantic-feed acceptance or an integrated production feature.** Stop here pending the coordinator's next assignment; do not begin another validation/review pass under the current stop.

The subsequent explicit **3% checkpoint-all stop** is recorded in [CONTEXT-DIARY.md](CONTEXT-DIARY.md). No code or check changed after the saved candidate below. That diary is the fourth task-owned file; it adds no runtime work. No task-owned process remains running.

## Exact ownership and evidence

Only these new files were authored by this task:

- `web/lib/sources/tweetSemanticEvents.ts` — SHA-256 `fd043fee124efd23285770e982182c0d6d7b64bb59d61126d1b7dc4e71395df2`.
- `web/lib/sources/tweetSemanticEvents.test.ts` — SHA-256 `6da590c614467d8013cedf8ccc2b34bd720146188908275c330c51967c7d1b5b`.
- This handoff.

No existing receiver, parser, `playerIdentity.ts`, manifest, migration, task register, or ingestion integration was edited. Other workers' dirty files remain in place. No DB query/write, source request, reprocessing, push, build, deployment, server, or browser execution occurred. No command remains running.

The original policy was recovered at `/Users/tim/Documents/Codex/2026-10-11/task-2/ingestion-reliability/all-source-semantic-events-plan-v1/PLAN.md`, with its `NHL-ROUTE-AMENDMENT.json`. Its ticket 2 names exactly the new reducer/test pair. The earlier asynchronous question about its location no longer needs an answer. The retained Master Task List section 5 item `afdc2c93-478d-4860-8ad0-305c45265ccc` in `tasks/artifacts/repository-commitment-audit-2026-10-15/master-page.json` still leaves all-source semantic corroboration and authentic feed acceptance open.

Existing implementations inspected: `lineSourceIftttReceiver.ts`, `tweetPlayerEvents.ts`, `tweetInterpretation.ts`, `projectedLineups.ts`, `tweetProjectionStorage.ts`, and bounded references to the source-processing/ingestion helpers. Existing raw/report identity does not supply scenario identity or atomic semantic actions. The Supabase skill was read for the storage boundary; no Supabase feature was changed or verified through a database.

## Implemented bounded behavior

`reduceTweetSemanticEvents(observations, asOf)` is deterministic and side-effect free apart from local allocations; its only import is Node crypto for stable hashes. It consumes already-bound observations in retained arrival order. It returns readonly evidence, associations, scenario/revision records, and **initial action proposals**, never executed actions.

- Keeps every supplied observation, including retries, uncertain/irrelevant evidence, collisions and corrections. Original/wrapper publication, receipt, interpretation, effective time, evidence spans and source identity remain separate. Input objects are not mutated.
- Separates exact game/team/entry versus in-game/group scope, explicit practice sessions, and bounded transaction periods. Unknown scope/effective period stays pending. Line/unit slots and player order remain meaningful. Different starters, IR versus LTIR, and recall versus reassignment are distinct proposed revisions.
- Accepts the first sufficiently supported, asserted observation under the supplied gates; equivalent reports attach evidence to the same revision/action key. Same-original relays share a support group. Group counts never upgrade confidence or imply independent confirmation.
- Leaves uncertain/projected participation pending even if incorrectly given a supported label. Practice/first-off observations remain their own facts. No source scores, source priority, CCC/LinesLinesLines alias inference, or transaction-to-participation inference exists.
- Requires source/receipt/interpretation evidence to be known by the explicit cutoff. Later interpretation cannot be backdated to raw receipt. A later duplicate cannot refresh the first acceptance's validity or replace its timestamps.
- Holds contradictory or chronologically older differing evidence, supported corrections and retractions. A retraction can bind a named report that arrives later without becoming authorized. Historical first acceptance stays visible; unresolved scenarios yield no current action proposal. Tentative corrections remain pending rather than invalidating supported acceptance.

The input contract assumes existing gates have already established genuine original attribution, canonical identities, complete units, exact applicability and support. A `support.basis` string does not itself prove those facts. `support.validUntil`, session identity, transaction period and canonical effective time must be supplied by reviewed gates; this candidate chooses no default expiry or time window. It is not a general runtime JSON validator or a raw-tweet parser.

## Exact unresolved policy decision

**What evidence and authority may resolve an accepted scenario's contradiction, correction or retraction, and what happens to a downstream action already issued before that conflict became known?** The original plan requires resolution but does not specify the issuer, admissible resolution proof, historical-effective-time overrides, or compensating action. A later timestamp or more reports cannot answer that question.

Bounded proposed next design: an explicit resolution record containing the exact scenario, expected accepted revision (compare-and-set), chosen revision or retraction, referenced conflicting/source observation IDs, resolution reason/authority evidence, effective time and resolution availability time. Reject stale expected revisions, missing evidence, cross-scope targets and cutoff violations. Retain prior revisions and all source associations. If authorized, the new action identity must include the predecessor revision so a genuine A → B → A change is not suppressed as an old duplicate. **This resolution API and policy are not implemented.** Until approved, the candidate deliberately emits only initial action proposals and preserves later revisions in review.

Also establish the consumer contract for related fact families before issuance: this candidate groups starter, availability, lineup, transaction and observation facts separately. It does not adjudicate cross-family contradictions or authorize participation/forecast issuance. Full-feed integration must retain that existing eligibility/consistency boundary.

Removing an action from the current reduction is not a withdrawal of an already delivered action. Consumers must not treat `firstAcceptance` as current when scenario status is unresolved or expired. A production design must explicitly address those transitions.

## Checks actually completed

- **Passed: 56/56 tests, one file**, after the final code amendment: `npm test -- --run lib/sources/tweetSemanticEvents.test.ts` from `web/`. Final Vitest receipt: v3.2.7, 240 ms total, 15 ms test time. Fixtures are synthetic canonical observations; no authentic inbound acceptance is claimed.
- **Passed: scoped TypeScript, zero diagnostics**, after the final amendment. Used the installed TypeScript API with the owning `web/tsconfig.json` compiler options, only the two owned files as root files, `noEmit: true`, `incremental: false`, and `getPreEmitDiagnostics`. This is not an aggregate web type-check.
- **Passed: scoped ESLint**, after the final amendment: `./node_modules/.bin/eslint --max-warnings 0 lib/sources/tweetSemanticEvents.ts lib/sources/tweetSemanticEvents.test.ts`, exit 0, no output.
- Initial new-file whitespace checks passed before the later timing/readonly amendments; they were not repeated after the stop. At the import check, only the new test referenced this module; no integration edits followed.
- **Not run:** browser/render checks (no UI change), full test suite, aggregate TypeScript, DB/concurrency tests, live source/receiver tests, builds, deployment or independent review.

Tests cover all six source arrival orders and reversals, duplicate/replay/original grouping, frozen input preservation, known/unknown identity and time, delayed interpretation, uncertainty, source chronology, expiry, contradiction ordering, duplicate-majority refusal, correction/retraction preservation, uncertain corrections, distinct game/team/group/phase/session/transaction/player boundaries, IR/LTIR and recall/reassignment.

## Resume and integration prerequisites

1. Coordinator reviews the exact two file hashes and bounded-policy choice; no independent acceptance is asserted. Reuse the successful test/type/lint evidence unless changes justify another run.
2. Resolve the policy decision above before adding automatic revision/retraction actions. Keep the canonical scenario/fact-family mapping, expiry and effective-time contracts explicit; do not derive them from arrival time.
3. A separately owned adapter must feed authenticated, retained reports and already-qualified canonical observations, preserving original versus relay and interpretation timing. Parser/quote/transaction extraction remains separate work. Raw processing completion and semantic pending status remain distinct.
4. Design and review durable append-only evidence associations, unique semantic action claims, transactional scenario advancement and reliable delivery together. Raw event leases and these pure tests do not establish exactly-once behavior. Concurrency/rollback/recovery tests belong to that separate integration ticket.
5. Receiver/storage/parser integration, schema work, authentic inbound validation, source calls, migrations, reprocessing and release remain unperformed and require their own ownership and applicable authorization. Do not close the master task from this candidate.
