# Draft Pro work ledger

## Resolved tasks
- W01 — Contracts and database foundation: 01a07c49-ae60-7ad1-ab7e-7f80faf44c10
- W02 — Stripe checkout and fulfillment: 01a07c49-b233-7733-88e7-e927f6917462
- W03 — Patreon access lifecycle: 01a07c49-b4b8-7472-9ced-d5ab3c7a253d
- W04 — Refund requests and account panel: 01a07c49-af5c-7f90-9cfe-27ea4d1099f0
- W05 — Recommendation correctness: 01a07c49-ae78-7531-a44f-ec2421566b23
- W06 — DUST premium analysis: 01a07c49-b237-7671-ba51-3c779d576db1
- W07 — Dashboard integration and CSV: 01a07c49-af52-7250-997c-363f4cfca7e0
- W08 — Saved Drafts and private imports: 01a07c49-ae55-7310-9bf2-98d030e8c872
- W09 — A-versus-B scenarios: 01a07c49-ae78-7531-a44f-ec4fcc6f1fa6
- W10 — Analytical reports: 01a07c49-ae79-7830-abd9-6eac03aedbe6
- W11 — Launch copy and operator checklist: 01a07c49-ae59-7581-9f02-5efd5cfa644d
- W12 — Integrated verification: 01a07c49-af48-7d63-8efd-734ea1d6c002
- W13 — Yahoo bookmarked work order: 01a07c49-b23c-7522-a74f-ce9fc438904d

All tasks moved into the Draft Pro section. W01 active foundation; W12 released for isolated DB harness only; W13 released for parked readiness document only. Other tasks remain queued. App listing missed newly created tasks; resolved their IDs from the local session index and verified W01 active through wait_threads. No duplicate tasks created.

- Chef task: 01a07c1d-047d-7660-954c-b3ce7d8ef7d2
- Section: CHEF — Draft Pro (3b3f2bf5-2939-484d-a6a6-655ae70f4039)
- Base: 4476fb90f (octoberBranch); user checkout left unchanged.
- Integration: codex/draft-pro at /Users/tim/.codex/worktrees/draft-pro-chef/fhfhockey.com
- Yahoo one-time heartbeat: yahoo-draft-pro-readiness, September 11 09:00 Eastern.
- Status: foundation under Chef review; no application implementation accepted yet.
- External checks pending: isolated DB availability, Stripe test credentials and merchant setup; never print secrets.

Task registrations and Chef decisions follow below.

## Registration checkpoint

| Order | Model / reasoning | Client setup ID | State |
|---|---|---|---|
| W01 | gpt-5.6-terra / medium | client-new-thread:3cb4bb34-0eb3-4e53-9d32-3af3869e2e3a | Released on setup completion |
| W02 | gpt-5.6-terra / medium | client-new-thread:2f35a485-4532-42a5-aadb-729df4a7453f | Queued; awaiting release |
| W03 | gpt-5.6-terra / medium | client-new-thread:059ec6e7-e343-4e1c-8123-ddca76efaf4a | Queued; awaiting release |
| W04 | gpt-5.6-luna / medium | client-new-thread:bdd78597-ea08-4258-86f4-42ed91693000 | Queued; awaiting release |
| W05 | gpt-5.6-terra / medium | client-new-thread:2903d74c-8381-4a20-a947-cf035a94e4f0 | Queued; awaiting release |
| W06 | gpt-5.6-terra / medium | client-new-thread:bae14b8d-73b4-4f86-8a5e-0610816bdd5e | Queued; awaiting release |
| W07 | gpt-5.6-luna / medium | client-new-thread:f81d6b9e-424b-4e4f-8b8b-a311da32f65d | Queued; awaiting release |
| W08 | gpt-5.6-terra / medium | client-new-thread:0a6ea4f5-e1e6-49ee-ab34-5868c83cea87 | Queued; awaiting release |
| W09 | gpt-5.6-terra / medium | client-new-thread:74c50f77-b32d-4586-8862-e4cc41f2b9a9 | Queued; awaiting release |
| W10 | gpt-5.6-luna / medium | client-new-thread:ae41cf24-59a8-4dff-ab40-270e7f749cca | Queued; awaiting release |
| W11 | gpt-5.4-mini / medium | client-new-thread:cf3a48c7-fbcc-45ab-a27d-957aa0812eb1 | Queued; awaiting release |
| W12 | gpt-5.6-terra / medium | client-new-thread:89040bc2-f0f7-4db3-8a71-643705f9eb19 | Queued; awaiting release |
| W13 | gpt-5.4-mini / low | client-new-thread:3f937164-88f2-4c53-89e6-997771a9f03b | Queued; awaiting release |

Registration is complete: all persistent task IDs above were resolved and section moves verified. Original client setup IDs remain as audit history; do not create duplicate tasks.

Environment: Node 22.11.0 and existing web/node_modules available; Docker running. Existing supabase_*_fhfhockey-super-goal-baseline belongs to another effort; do not reset/mutate it. Port 54322 also has an SSH listener; do not assume localhost is isolated. Provision a distinct isolated test database/container for this project. Stripe and Patreon configuration keys absent from root web/.env.local; Resend key present (no values exposed). No application changes accepted or runtime tests executed yet.

## Foundation review checkpoint
- W01: returned corrections for direct premium payload access after expiry, entitlement date bounds, explicit capability flags/reasons, server entitlement loader, and durable refund delivery state. Not approved.
- W12: isolated DB harness replay in progress; existing baseline stack untouched.
- W13: reviewed df65650ba; returned missing OAuth/mapping/manual-fallback/access-loss acceptance criteria and activation authorization wording. Documentation only; not yet approved.
- No model escalation. W01 and W12 implementation/preparation active; W13 bounded document correction active. Other orders await dependency release.

- W13 preparation APPROVED: 8aa0965da reviewed; expanded checklist and existing link verification accepted, documentation-only diff. Integrated locally. Yahoo remains PARKED; no provider evidence or activation claimed.

- W01 b3c35025e NOT approved: null/invalid expiry bypass remained, next verification timestamp slid on reads, partial capability denial returned eligible, refund choices incomplete. Escalated W01 only to Terra/high for bounded security/date/guard correction after initial review did not resolve defects. Exit: exact regression tests and Chef approval; return to medium afterward. W12 authorized provisional migration testing on that hash while corrections continue.

- W01 product-policy contract slice APPROVED for W11 copy preparation only; runtime/schema remain unapproved. Released W11 at 93b623493 with documentation-only ownership and explicit unshipped feature labeling. W01/W12/W11 are the three active tasks.
- W12 bare-image migration hit missing storage.buckets.public; baseline has no Storage definitions. Treat as harness/provider initialization uncertainty, not proof production migration is invalid. W12 investigating actual Storage migrations; no storage pass claimed.

- W01 67e812dde code/contracts APPROVED and integrated locally; SQL/RLS acceptance pending W12. Reviewed corrected null/future/expiry boundaries, fixed verification deadline, shared capability denial, six refund reasons, restrictive policy syntax. Evidence: 9 focused Vitest tests, scoped ESLint, scoped TypeScript passed by owner. Downgraded to Terra/medium after correction; future schema changes new commits only.
- W11 361944e1f returned corrections: wrong refund choices, misleading launch-available label, invented customer rules, missing locked/account states, test/live modes wording. No model escalation.

- W11 preparation APPROVED: e948822a7 reviewed and integrated; correct six reasons, locked retention, optional answers, owner bank/identity checklist, no promised Yahoo date. Final feature availability and config review remains after W07/W02. W12 modern Storage bootstrap now succeeds; direct user access probes in progress.

- W01 foundation APPROVED for dependent implementation at a39dbc1ee (source 67e812dde): W12 isolated real public baseline + cached Storage bucket migrations applied successfully; seven tables/RLS, no browser grants, two subjects cannot read payload, service role CRUD succeeds. W12 harness f9fd027f2/f9487382d/6bbc87560 integrated. Added targeted test critique for generic permissive storage-policy regression, proper entitlement key, catalog assertions; this strengthens evidence but no known application blocker. Storage HTTP lifecycle not tested.

- RELEASED W02 Stripe and W03 Patreon at 07eac5f91, Terra/medium, isolated codex/draft-pro-w02/w03. W02 sole dependency owner and must isolate npm installation; W03 owns stale-reverify extension of server.ts, preserving shared interface. Schema changes route W01. W12 bounded storage-policy regression active; concurrency three. Other implementation orders remain queued.

- W12 foundation SQL/RLS checkpoint fully APPROVED: 35e89d1bd reviewed and integrated, generic permissive policies cannot bypass private bucket restrictive read/insert rules for authenticated/anon; unrelated bucket writes preserved; catalog assertions passed. W12 now idle.
- W01 released Terra/medium schema follow-on for atomic Stripe attempts/fulfillment, coordinating contract directly with W02. Requirements: immutable activation, independent purchase grants, durable refund/dispute facts robust to reorder, service-role-only RPC. Active tasks W01/W02/W03 (three). No additional escalation.

- Stripe RPC contract review rejected permanent unique(user,season) purchase history and timestamp-only dispute order. Approved one row per attempt, account-season advisory lock for pending reuse, immutable payment confirmation/activation, full-refund terminal per purchase, dispute terminal precedence including closed-before-created same-second events.
- Patreon architecture decision: preserve existing patreon_supporter row/source_reference ownership uniqueness; loadDraftProAccess maps only server-verified paid campaign metadata into Pro, purchase uses draft_pro key. No duplicate Patreon entitlement table/index redesign. W03 owns loader mapping + tests for legacy/free rows denied. W01 remains payment schema only.

- W03 eeff92517 NOT approved: loader omitted entitlement_key select; disconnect overwrote history metadata; duplicate failed webhooks skipped forever; next_charge_date incorrectly treated as paid access expiry and could qualify declined members; stale reverify recovery and bounded concurrency missing. Returned exact critiques and lifecycle fixture requirements. Root dependencies available read-only symlink, so absent dependencies not accepted as a terminal blocker.
- W02 preliminary focused provider tests/type/lint pass per progress, but no handoff accepted; awaits W01 atomic migration. W01 coding 20260907145602_draft_pro_stripe_fulfillment.sql.

- W01 payment source c315ba8dc handed to W12 (not approved): new 20260907145602 migration + types/constants/probe. W12 released real ordered migration/RPC/concurrency checks; W01 idle. W02 interim4b8932abd not accepted until verified normalized facts/atomic caller complete.
- W03 0b2da88ac first correction passes 14 tests + full tsc/targeted ESLint per owner, but NOT approved: read-before-write disconnect race persists; false/legacy eligibility never reverifies; free trial exclusion and process/route retry tests absent. Escalated W03 to Terra/high for bounded concurrency/recovery/security tests after failed medium correction. Exit review+targeted regression pass then return medium. Active W02/W03/W12 three.

- W12 edb189b2b/83a388c8b provisional tests passed subsets only; not integrated yet. W12 repeatedly ended turns with assigned matrix unfinished and no blocker, including an idle final claiming continuing. Escalated bounded remaining concurrency/RPC/event-order verification to Terra/high after repeated medium execution failures. Exit full matrix evidence+Chef review then medium. No claim of concurrency pass yet.

- W02 escalated Terra/high after medium correction still used inline prices, omitted Stripe idempotency key, skipped price/product/paid webhook validation, cast refund/dispute objects as checkout, and mismatched RPC args/return timestamp. Bounded exit complete secure adapter+tests reviewed then medium. All three active tasks now temporarily high for concrete unresolved security/test execution problems; no Sol used.
- W03 follow-ons0cf2a90bb/54006600d/faa0e1911 partially address generation/payment statuses/retained paid metadata; explicit lifecycle/process tests still required, none accepted yet. W12 subtask isolated to actual concurrency to prevent further partial sequential handoff.

- W12 bounded Sol/medium escalation authorized by Chef: after several medium/high turns, read_thread confirmed a no-tool final falsely implying concurrency work in progress while idle. Remaining security verification (simultaneous checkout/event writes) unresolved despite concrete instructions. Scope ONLY deterministic two-session evidence, existing harness/no product edits. Exit successful reviewed concurrency evidence then Terra/medium. This is the only Sol assignment, no xhigh.
