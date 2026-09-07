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
- Current status: W01 foundation/payment SQL and W03 Patreon locally approved; W05 recommendations approved. W02/W04 active; W06 approved; W12 mapping checkpoint approved; W07–W10 queued; W11/W13 preparation approved; W12 SQL checkpoint approved. Historical entries below retain prior states.
- External checks pending: real Stripe/Patreon credentials and provider validation; isolated SQL/RLS verification passed. Never print secrets.

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

- W01 payment schema c315ba8dc reviewed and integrated as6a4d0e4b7 after actual migration, core state, and concurrency evidence; final small SQL matrix pending. W12 edb189b2b/83a388c8b/2f1ca85b6/a6e4b9177 integrated. Actual overlapping two-session begin returns one attempt; concurrent duplicate event returns one processed/one duplicate and one grant. Sol escalation exit met; W12 downgraded Terra/medium for remaining small SQL cases.
- W03 switched to Luna/medium for now-bounded test writing after architecture corrected; expiry/renewal regression8415a9a0e passed6, route151407c32 + process5b0a27103 tests passed7. Final review found recoverable account status error excluded from persist/reconciliation; owner correcting before final handoff. Provider-live evidence still absent.

- W12 payment SQL checkpoint APPROVED: debfed557+6f6f9cd6a integrated; actual concurrent begin/event, full/partial refunds, terminal dispute order, six RPC grants, session/intent/account mismatch, immutable activation, same-user repurchase/provider-row retention passed. Fixture independent Patreon row uses draft_pro rather than actual supporter mapping; proves SQL isolation only, integrated access test still later. W12 idle Terra/medium.
- W02 c44816043 adds configured catalog Price/Product validation; still unapproved pending actual session line item validation, CLI, checkout recovery and full evidence. W03 final outage-recovery test pending;22 tests/full tsc/lint passed before added test.

- RELEASED W05 at5a4fcf867 Terra/medium: pure recommendations/hooks/API/tests only, no central dashboard/SuggestedPicks/table edits. W07 owns composition. Active W02(high),W03(Luna/medium),W05(Terra/medium) three. W12 idle.

- W03 bounded Sol/medium escalation for two final recovery/disconnect tests: Luna then Terra could not construct mocked IO fixture and stopped after reads without actual blocker. Security regression evidence unresolved after focused attempts+Chef review. Scope only real refresh/persist recovery/deleted-account tests; exit pass+review then Terra/medium idle. W02 still high, W05 medium.

- Integration privacy constraint sent W05: no background API upload of local private imports before explicit account save; private-source premium calculations may be unavailable until W08 save/restoration rather than silently uploading/substituting rows. W07/W08 must preserve local free workflow and explain this boundary.

- W03 LOCAL IMPLEMENTATION APPROVED through eb71ffad7; all11 commits eeff92517..eb71ffad7 integrated.22 focused tests +2 real refresh recovery/deleted account tests passed; full tsc/targeted lint passed owner. Recovery mock corrected to enforce actual .in status filter. Sol exit met, W03 downgraded Terra/medium and idle. Provider live OAuth/webhook validation blocked by absent config; not launch-approved. W07 must align any remaining account UI disconnect copy/navigation.

- Released tiny W01 feature-flag contract follow-on at a2177bce1, Luna/medium (bounded configuration). Own features.ts only, all canonical capability env flags default false, private imports depend saved drafts, no entitlement bypass. W02/W05 informed. Active W01/W02/W05 three; W06 remains queued until flag checkpoint.

- W01 helper20a5fb37b approved/integratedff260fa93. W01 scoped tsc exposed W03 introduced undefined entitlementMetadata in no-member branch; earlier claimed full-tsc clean evidence unreliable. W03 reopened Luna/medium for exact no-member invalidation/history regression; code approval suspended for that defect. Chef running actual full tsc session45387 from integration with read-only dependency symlink. Active W02/W03/W05 three; W06 still queued.

- Chef actual full TypeScript run session45387 FAILED exit134: default4GiB heap OOM (~38sec). Empty30s output was not pass/time-window limit. W03 notified; require scopedchecks with repo-compatible esModuleInterop/bundler options. Full typecheck remains blocked/resource failure until controlled larger-heap RC attempt; not claim clean.

- W03 cfe1f3427 no-member fix/regression approved and integrated;7sync tests+scoped tsc/eslint pass. Full tsc actual exit134 OOM confirmed, not pass. W03 local approval restored and idle Terra/medium.
- W05 81c7aeab unapproved; escalated Terra/high after medium correction still leaked personalized globalVORP, squared categoryweights, averaged multi-position fit, used starts as GAA denominator, lacked hook categoryWeights. Exact regression requirements returned; W07 must not receive broken contract.
- W02 1c86707b4 lifecycle/line-item progress5tests,5600c67c0 CLI lacks live guard/sanitized errors/tests; returned bounded Luna correction. Not approved.

- RELEASED W06 at4f365e173 Terra/medium: DUST shared optimizer/API/hook and focused panel only, no centralUI or W05files. Active W02(Luna/medium),W05(Terra/high),W06(Terra/medium) three. Chef running strict scoped integration tsc afterW03fix; fulltypecheckRC needs controlled largerheap attempt.

- Chef strict scoped TypeScript for foundation flags/server + Patreon modules/routes PASSED exit0 (session14439); whole repository remains OOM, not clean.
- W05 f6f5d1d7 partial corrections reviewed; still invalid GAA starts-times-average denominator, contradictory supplied SV%, shared goalie category omission. Returned focused denominator/role tests; Terra/high exit not yet met.
- W02 Luna stopped without route tests or blocker. Returned one bounded signed-webhook regression to Terra/medium (task default complexity; no high-cost escalation). Next review must correct webhook raw exception leakage, centralized line-item verification, checkout terminal-session recovery, canonical flags, and unpaid confirmation state before approval.

- W05 APPROVED through8071f141; integrated fourcommits as5f7fbe6e0/0e712d3a3/105a97aec/4afcf2486. Chef reran19tests/4files and exact-file strictTypeScript, all exit0. Ratio TOTAL_TOI seconds confirmed existing projection fixtures. Downgraded Luna/medium for final API hardening, now idle.
- W06 c14961b3f returned conservative freshness (oldest not newest), explicit ranking default/window/origin, API+abort fixtures and scopedtypecheck; no approval yet.
- RELEASED W04 at4afcf2486 Luna/medium, focused refund/account API+panel only, W07 navigation exclusive. Payment DB contract approved sufficient for dependency; receipt omitted if unavailable. Active W02/W04/W06 three.

- W02 1d50e0a6e generic HTTP errors/size bound and95b2ba059 centralized catalog validation reviewed as partial, not approved. Terra repeatedly completed code subsets while omitting expressly requested refund/dispute adapter regressions. Bounded escalation Sol/medium ONLY actual provider matrix and proven defects; exit reviewedpassingmatrix then Terra/medium.
- W06 a59f13425 freshness/sort/window correction reviewed; final hook still uploaded unsavedprivate data before serverdenial. Returned no-serialization/no-fetch guard+fixture, downgraded Luna/medium for bounded adapterfix.

- W06 APPROVED through30c679266; integratedba4608927/7b0c9695b/9b35ecfcd. Chef11tests and exact-file scopedTypeScript pass exit0. W06 idle Luna/medium.
- RELEASED W12 bounded calculation/access integration fixtures at9b35ecfcd Terra/medium; tests/docs only, defects returned toowners, no redundant suite/fullbuild. Active W02(Sol/medium boundedproviderfixture),W04(Luna/medium),W12(Terra/medium).

- W12 mappingcheckpoint657b0f524+6a85494e0 APPROVED/integrated:6tests pass usingactual inactiveStripe/refundedmetadata withpaidPatreon andpurchasepreservedthroughPatreonoutage. Readonlydependency symlink resolved absentVitest. W12 idle.
- W02 provider5096e3819 matrix9tests approved scoped; exitSol, downgradedTerra/medium. Expiredrecovery d80b1ebef/0faa32145 partial, lifecyclematrix again omitted despite two focusedturns; boundedSol/medium for actual lifecyclehandlers/tests only, exit passreview thenTerra/medium.
- W04 369f49fee returned missingemail requestID/accountemail/activation, retryoptionalfieldmapping, lazyResendinit, checkedemailstatewrites/idempotency, accountsummary/refundeligibility andPatreonactions. Terra/medium for coupledcorrection afterinitialLuna; nohighreasoning.

- Chef verified official Link Checkout documentation https://docs.stripe.com/payments/link/checkout-link : enable Link inmerchantpaymentsettings; dynamicmethods omit payment_method_types, or explicitly include link. W02 current cardonly configuration needs explicit card+link or dynamicsetup plusoperatorcheck, no claimactualLinkUIverified.
