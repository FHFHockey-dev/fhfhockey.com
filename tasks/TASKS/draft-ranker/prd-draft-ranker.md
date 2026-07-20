# PRD: Account-Backed Personal NHL Draft Ranker

## Introduction / Overview

The Draft Ranker gives each authenticated FHFH user a persistent personal NHL draft board backed by canonical player identities. The visible board contains 250 players, but the eligible universe extends beyond the prior season's Yahoo top 250 to verified NHL players, goalies, rookies, prospects, organizational players, projection-source players, and editorially verified unranked candidates.

This PRD reconciles the product authority in [product-strategy.md](./product-strategy.md), the execution contract in [goal-prompt.md](./goal-prompt.md), the approved decisions in [decision-record.md](./decision-record.md), the frozen implementation contract in [technical-contract.md](./technical-contract.md), the phased work in [implementation-plan.md](./implementation-plan.md), and the live status in [progress.md](./progress.md). Those source artifacts retain their detailed history and remain supporting authority; this document is the concise canonical PRD/task-list pair required by the repository-wide super-goal.

As of 2026-07-20, the approved launch plan through Phase 7 is complete and the canonical task list is 50/55 checked. The aggregate-only final review passed after more than 30 clean production hours, and the already authorized stage-only change moved personal Draft Ranker access from `staff` to `authenticated` on 2026-07-17. Production still has exactly three configured staff accounts and zero beta accounts; the homepage surface alone remains enabled under its recorded waiver, while beta entitlement, discovery, contribution collection, and public Community Ranking remain off. Phase 8 is explicitly deferred and tracked as the separate Wave-B residual initiative `B-DRAFT-RANKER-P8`. A separate ignored local override now exposes the same authenticated personal-ranker boundary on localhost without changing the page, tracked source, or production configuration.

## Goals

1. Seed a reproducible personal ranking from verified prior-season Yahoo preseason ADP without treating Yahoo as the player universe or permanent ranking evidence.
2. Persist one continuous, owner-scoped ordered player list whose top 250 and candidate bench survive sessions and devices.
3. Preserve canonical identity, provenance, ordering, comparison, placement, and ranking-event evidence when players cross the top-250 cutoff.
4. Support safe direct editing, canonical real-player search, watchlists, candidate actions, and deterministic assisted placement.
5. Offer an independently kill-switched homepage pairwise experience that records only explicit, consented evidence.
6. Produce explainable candidate discovery from versioned, fresh, reproducible signals and show an honest unavailable/empty state when sources do not qualify.
7. Produce a privacy-preserving Community Ranking v1 that separates market-seeded, emerging, and established evidence and permits previously undrafted players to qualify without invented ADP.
8. Provide versioned private exports, health/repair tooling, deletion support, observability, and a staged fail-closed rollout.

## User Stories

- As an authenticated user, I want a draft board that persists across sessions and devices.
- As a user, I want the top 250 to be a display cutoff rather than an eligibility boundary.
- As a user, I want to find and place a verified real player who was not in last season's Yahoo top 250.
- As a user, I want direct moves and assisted placement to preserve a complete continuous order and displace the cutoff correctly.
- As a user, I want to watch, dismiss, restore, or re-evaluate candidates without losing prior evidence.
- As a user, I want pairwise prompts to be blind by default, explain why they were selected, and respect my contribution consent.
- As a user, I want discovery cards to identify their source, freshness, threshold, and reason rather than making unsupported claims.
- As a user, I want CSV and JSON exports that identify ranking/version/provenance while excluding private comparison evidence by default.
- As a community visitor, I want public rankings to distinguish prior-market seeding from actual community evidence.
- As an operator, I want strict cohort controls, health reports, exact-confirmation repairs, account deletion drills, and immediate rollback switches.

## Functional Requirements

1. Every ranked or discoverable entity must map to one canonical real-player identity. Arbitrary free text must never create an identity.
2. Yahoo IDs must remain external mappings, not permanent canonical IDs. Prospects without Yahoo or NHL IDs may be rankable after verified editorial identity review.
3. Duplicate names must remain distinct and be disambiguated with stable identity evidence; ambiguous matches must enter review rather than auto-merge.
4. New rankings must initialize idempotently from verified prior-season Yahoo preseason ADP plus the approved bounded scalar fallback and record source/revision/provenance.
5. The system must persist one default ranking per owner and target season while leaving schema room for later named rankings.
6. Ranking entries must form one unique continuous order. The first 250 are the visible board and subsequent entries are the ordered candidate bench.
7. Moving or inserting a candidate into the top 250 must move the previous No. 250 to No. 251. Removing a ranked player must promote the highest eligible candidate.
8. Reordering, insertion, removal, normalization, and placement confirmation must be atomic, owner-scoped, version-checked, idempotent, and auditable.
9. Direct editing must control personal order but must not manufacture community pairwise wins.
10. Canonical search must support exact, prefix, alias, external-ID, and bounded fuzzy discovery with lifecycle, organization, position, and identity-quality context.
11. Addition requests must reuse the editorial identity-review workflow, be deduplicated/rate-limited, and never create identities directly.
12. Watch, dismiss, not-relevant, restore, and compare intent must persist independently from ordered ranking evidence.
13. Assisted placement must use deterministic server-owned state, bounded questions, explicit rough ranges, cutoff validation, contradiction handling, resume, cancel, and stale-board recovery.
14. Pairwise collection must require versioned explicit consent, validate server-issued prompts, preserve reversals/skips/too-close outcomes, and remove withdrawn evidence from future aggregates without deleting private history.
15. The adaptive queue must be deterministic and versioned at launch, enforce cooldown/diversity/cutoff rules, and disclose a human-readable selection reason while hiding anchoring evidence by default.
16. Homepage, discovery, contribution collection, personal-ranker access, and public Community Ranking must remain independently kill-switched.
17. Discovery results must be reproducible from frozen source contracts and include source, season/freshness, reason code, threshold, and null behavior. Stale or missing projections must not be relabeled as current recommendations.
18. Community Ranking v1 must use the approved pinned regularized Bradley–Terry contract, consent/moderation eligibility, per-user/pair dedupe, decaying market prior, evidence states, and conservative cutoff admission.
19. Public aggregate responses must expose no user IDs, pseudonymous account keys, raw comparisons, consent history, moderation evidence, or private histories. Signed-in owner context may add only that owner's personal rank/delta.
20. Exports must support versioned CSV and JSON at launch, stable IDs, explicit ADP/evidence state, optional candidates/watchlist/event summaries, and no private comparison evidence by default.
21. Health and repair operations must be read-only by default. Mutating repair actions require current versions, exact confirmation, reason, operation ID, backup/export, service/admin authorization, and immutable before/after audit.
22. Account deletion must remove account-owned ranking/evidence rows and future aggregate rebuilds must exclude deleted or opted-out contributions while preserving immutable aggregate audit artifacts.
23. Every personal API must derive ownership from authenticated server state and enforce the server-side `off`/`staff`/`allowlist`/`authenticated` rollout stage. Missing or invalid controls must fail closed.
24. Production expansion must follow the evidence and approval gates in [launch-runbook.md](./launch-runbook.md). The owner-approved low-traffic exception moved only the personal ranker from `staff` to `authenticated` after its exact final review; it did not enable beta entitlement or any non-homepage secondary/public surface. Every later expansion retains its own gate.

## Non-Goals / Deferred Scope

- Replacing the existing canonical player identity or site-auth architecture.
- Treating Yahoo ADP as a permanent preference, complete universe, or artificial value for previously undrafted players.
- Arbitrary name-based player creation or automatic fuzzy identity acceptance.
- Converting direct edits or automatic displacement into synthetic community votes.
- Publishing account-level evidence, precise Bayesian-confidence claims, or universal-consensus language.
- A mature adaptive/bandit queue or replacement community algorithm without a separate methodology decision and offline evidence.
- Multiple named or league-specific rankings at launch (DR-080).
- Paid/license-restricted prospect sources or expanded editorial infrastructure without a separate rights/identity checkpoint (DR-082).
- XLSX and advanced export/discovery capabilities in the launch release (DR-083).
- Any rollout beyond the completed personal-ranker `authenticated` stage, or any additional secondary/public flag, without its own evidence and explicit approval.

## Design Considerations

- Use the existing FHFH dark/Neon Noir system and preserve keyboard, screen-reader, reduced-motion, mobile, and zoom usability.
- Keep the 250/251 boundary visually explicit and distinguish ranked, candidate, watchlisted, previously undrafted, and limited-evidence states.
- Avoid anchoring: pairwise cards are blind by default; ADP/community/projection evidence is optional and expandable.
- Present confidence as understandable evidence tiers and stability labels, not false precision.
- Keep the wide ranking table independently scrollable on small screens without page-level overflow.

## Technical and Security Considerations

- Canonical identity, ranking ownership, sparse ordering, player actions, placement, pairwise evidence, discovery, community snapshots, rate controls, and health/repair contracts are implemented through additive Supabase migrations and service-only RPCs recorded in [technical-contract.md](./technical-contract.md).
- All browser ownership comes from authenticated server state. Raw privileged credentials and cohort identifiers must never reach the client or repository.
- Exposed tables require RLS and owner-qualified access. Privileged functions require fixed search paths, explicit execution revocation, bounded inputs, and service/admin-only callers.
- Operations must preserve idempotency keys, expected/resulting versions, immutable events, rollback switches, and pagination for potentially large reads.
- Community snapshots are derived and rebuildable; personal ranking and evidence rows are the durable owner-scoped source.
- Rollback is normally flag/stage/job disablement. Destructive down-migration or identity/table removal requires a separate approval checkpoint.

## Dependency Graph and Delivery Order

1. Phase 0: repository audit, dirty-worktree boundary, decisions, and frozen contracts.
2. Phase 1: canonical identity plus account-owned ranking/RLS/API foundation.
3. Phase 2: Yahoo seed, continuous ordering, direct editing, and integrity verification.
4. Phase 3: search, watchlist, addition requests, and assisted placement.
5. Phase 4: consented pairwise evidence, adaptive queue, homepage module, and abuse controls.
6. Phase 5: explainable discovery with frozen source contracts.
7. Phase 6: Community Ranking v1, immutable snapshots, public aggregate, and red-team calibration.
8. Phase 7: exports, health/repair tooling, launch QA, staged deployment, and evidence-gated cohorts.
9. Phase 8: deferred mature capabilities, each requiring its own PRD/decision update.

Cross-initiative dependencies are `A-AUTH → A-DRAFT-RANKER` for account ownership/session boundaries and bounded `B-YAHOO` identity/mapping evidence → seeding/search. The launch scope consumed the existing verified contracts and is complete; residual A-AUTH work remains independently tracked. IFTTT/A-GDL provider retirement does not overlap this initiative. The five deferred Phase-8 rows are now grouped under `B-DRAFT-RANKER-P8` and require their own PRD/decision and approval gates.

## Current Reconciliation and Evidence

- All 29 defined completed DR tasks through DR-073 are claimed complete with detailed implementation, migration, browser, production, deletion, and test evidence in [implementation-plan.md](./implementation-plan.md) and [progress.md](./progress.md).
- The scoped product commit was reviewed through PR #335 and merged as `722f1dff02b7a4b9486836b386c0b576f57c5cfd`. Later reviewed releases added the homepage waiver/countdown, top-of-board queue, deterministic homepage timestamps, durable cron-audit configuration, and response-before-audit ordering through PRs #338, #342, #343, #347, and #350. Authoritative PR #352 merged the aggregate-only authenticated-rollout record into `octoberBranch` as `9ed2f3f8c787574180ab97a1545b45a82c819ba9`. Current READY production deployment `dpl_F6EpDdcMePEQorJfqnQTBoRzqy9Z` is an exact redeploy of source `89ace52c1eab547a0373a8ebae63648ec27c9262`; only the personal rollout stage changed to `authenticated`.
- The launch package passed 228/228 focused Draft Ranker tests, 18/18 affected WiGO regressions, project TypeScript, the production build, responsive board/community/export checks, red-team calibration, and two zero-residue disposable-account journeys.
- DR-072 completed on 2026-07-17. More than 30 clean hours on the durable response-order artifact passed the bounded aggregate-only review with no ordering, seed, placement, ownership/season, duplicate-operation, Draft Ranker runtime-error, or unexpected Draft Ranker 5xx blocker. The only attention state was the ten already documented pending identity reviews. Post-change evidence preserved anonymous denial, three staff IDs, zero beta IDs, and every non-homepage secondary/public flag off; no personal choices were inspected.
- Local development readiness passed on 2026-07-20 with only the ignored master/stage override: the intended 2-file/18-test flag/API suite passes after explicitly excluding the retained ignored clone that first duplicated discovery to 4 files/36 tests; process-level Watchpack polling removes its transient watcher pressure without tracked configuration; anonymous access returns `401 authentication_required` instead of the disabled `503`; both local routes return meaningful 200 responses without disabled copy or a framework error overlay; and the already authenticated account board renders through read-only requests. No ranking action, tracked page/code change, production flag, provider, or database mutation occurred.
- DR-080 through DR-083 and their Phase-8 parent remain explicitly deferred and unchecked under `B-DRAFT-RANKER-P8`; their scope is not silently waived.

## Success Metrics / Definition of Done

- All canonical task rows agree with the implementation plan and source evidence.
- DR-072's approved low-traffic review and stage-only authenticated change are recorded with value-free aggregate evidence; every other cohort/flag retains its separate gate.
- No owner-isolation, ordering, deletion-residue, retry/idempotency, privacy, unexpected-5xx, latency, health, or support gate is unresolved.
- All secondary flags and broader cohorts remain fail-closed until their own evidence and approvals.
- Deferred Phase-8 work remains explicitly scoped or is completed under a later approved PRD.
- The initiative passes a fresh dynamic Wave-C audit after its latest implementation/rollout changes.

## Open Questions / Checkpoints

1. Which, if any, secondary surface should be proposed next? Discovery, contribution collection, public Community Ranking, and beta entitlement remain off until separately evidenced and approved.
2. What normal aggregate-only monitoring cadence should be retained for the completed authenticated personal-ranker stage?
3. Phase-8 product/methodology/source/export choices remain deferred under `B-DRAFT-RANKER-P8` until separately planned and approved.
