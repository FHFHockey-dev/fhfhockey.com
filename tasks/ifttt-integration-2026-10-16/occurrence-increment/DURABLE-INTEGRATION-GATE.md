# Durable occurrence integration: next bounded increment

The corrected pure candidate passed bounded independent review under its 49-path v2 manifest. No source/test/runner/SQL file is changed by this note. This is an implementation boundary, not completed storage behavior or a new production permission.

## Existing path to extend after review

`retainQualifiedTweetClaimScope` already reads `read_tweet_claim_context`, plans qualification, and commits raw observations, qualification versions and held outputs through `commit_qualified_tweet_claim_scope`. The replacement RPC holds the global context clock for update and rejects stale clocks before committing a scope. Reuse that transaction and its three-attempt application retry; do not introduce a second writer, queue or service.

The accepted v4 lineage wrapper derives a lexical ID from verified original identity/text/spans and retains the r3 adapter's own state. The new pure ledger is currently absent from that path. A canonical ID in the task runner does not change a native r3 effect key, a legacy sink key or an outbox key. Those compatibility boundaries must be tested explicitly before the new ID is operational.

## Required atomic state

1. Retain the allocator namespace/counter and append-only occurrence, anchor, derivation and original-binding evidence in the same existing context transaction. Allocate from durable state, never a request, record label, scenario, fact hash or retry-local counter. Preserve existing native IDs and immutable observations as aliases/evidence.
2. Read the whole bounded linked receipt/original component and all its retained effects/history before planning an upgrade. Missing, truncated, ambiguous, materially conflicting or already independently allocated components stay held. A token or an alias cannot establish history absence.
3. Validate the proposed state transition against the exact retained state under the context CAS. An exact retry retains the same token, bindings, effect admission clocks and original derivation bytes. The SQL boundary must reject rewrites or missing prior ledger rows even if an application planner is bypassed.
4. Commit identity state, native/canonical alias mapping, qualification and held outbox changes atomically. Keep old native evidence/effect rows; do not rewrite historical IDs or dispatch receipts. Material rebindings must still block every affected scope. Reconciliation of previously distinct tokens needs an explicit component policy; the current candidate deliberately rejects it.
5. Join effect compatibility across canonical and all native/legacy aliases. Two canonical labels over separate native effects are insufficient duplicate protection. Unknown or partial receipts block release, and uncertain external effects stay uncertain. No dispatcher is added in this increment.

The smallest expected implementation surface is the occurrence module, `tweetClaimLineage.ts`, `tweetClaimQualificationStorage.ts`, a new locally staged additive SQL revision, and nearby local fixture/tests. The retained r3 registry/reducer and both accepted staged migrations should remain evidence; changes require a new pin and review rather than silently inheriting v4 acceptance.

## Local proof before acceptance

- Through the real replacement RPC: provisional receipt, serialization/restart, verified exact upgrade and exact retry retain one canonical allocation while old native evidence stays byte-identical.
- Two clients starting from the same context clock cannot commit separate allocations for the same proved occurrence. The loser reloads; bounded exhaustion retains the source receipt for reconciliation.
- Inject failure before commit and acknowledgement loss after commit. Readback verifies the exact identity/qualification commit; it never blindly allocates or emits again.
- Reject same-ID payload changes, tampered prior anchors, removed bindings, author/post/clock conflicts, cross-scope material rebinds, partial components and two previously allocated provisional roots without a merge policy.
- Show that one provisional/verified canonical token cannot create two reviewable effect reservations through native aliases. Unknown legacy or sink history remains held; no external exactly-once assertion.
- Keep unchanged CR019 assertions and baseline output separate. CR011/CR051 require the missing lexical proof/policy documented in `CROSS-TEXT-PROOF.md`; nine exact persistence DSL gates remain deferred until independently mapped and executed.

No hosted schema read is required for these fixture/disposable-storage checks. TJ approved the exact previously rejected catalog retry; query one returned only a size/missing-count guard, and query two was stopped. Object-level deployed compatibility remains unverified. Application history, production DDL, activation, dispatch, replay, compensation and genuine future evaluation each retain their existing separate gates.
