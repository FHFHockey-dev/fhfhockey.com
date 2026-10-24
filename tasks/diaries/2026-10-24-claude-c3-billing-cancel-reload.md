# C3 BILLING-CANCEL-RELOAD — diary (Claude side session)

## Scope
Lost cancellation response + browser reload must not mint a new cancellation request ID, and must never
recover another owner's ID. Edits only in isolated snapshot `/private/tmp/fhfh-c3-isolated/web` on the three
InSeasonPanel paths (transfer CODEX-20261024-003). Canonical bytes stay e5cde334/d21fd263/b63510f7.

## Where
- Snapshot: /private/tmp/fhfh-c3-isolated/web (manifest evidence/SNAPSHOT-MANIFEST.sha256 e69b61c1…, written pre-edit)
- Baseline copies: /private/tmp/fhfh-c3-isolated/baseline/
- Handoff target: tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C3/
- Base commit: octoberBranch 2a5092d37 (dirty tree)

## Findings
- Accepted mounted fix keeps IDs in a ref (`cancellationIds`) — lost on reload.
- Server idempotency key is `cancel:${requestId}`; a new ID after reload appends a second cancel event (and claim)
  while the first may still be in flight → the reload gap is real.
- Repo already uses web storage directly in hooks; chose per-tab sessionStorage inside the component (no new service).

## State / checks (done)
- Repro failed on baseline (unit + real browser reload). Fix: per-tab sessionStorage `fhfh:in-season-cancellation:v1`, owner-scoped, validated, 24h TTL, cleared on mounted sign-out / accept.
- 52/52 panel tests; 7 mutations all caught; ESLint 0; tsc exit 2 = only the 2 pre-existing LUNA errors (heavy lock taken+released).
- Browser :3120 from snapshot (fixtures only, foreign hosts aborted); server stopped.
- Candidate: InSeasonPanel.tsx 99876642…, .test.tsx 646b3379…, rollout unchanged. Patch c500b580…. Canonical bytes unchanged.
- Handoff: tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C3/RECEIPT.md (+SHA256SUMS).

## Next
- Parent/independent review; decide boundary proposal for lib/supabase/browser-auth.ts (one pattern line) so app sign-out clears the key.
- Second serial scope (refund consumer errors) not started.

## Blockers / gotchas
- App sign-out unmounts the panel (setUser(null)) before SIGNED_OUT → panel can't clear storage; same owner may reuse own ID within 24h in that tab. Never crosses accounts.
- Dev server needs CMS_URL set (rewrites) and NEXT_PUBLIC_SUPABASE_URL overridden — client defaults to the production Supabase URL.

## Ticket 2 — browser-auth cleanup (CODEX-20261024-012), in progress
- Snapshot copies verified: browser-auth.ts 7f4cae98…, AuthProviderContext.test.tsx 7e9bb5e5… (baseline2/).
- Applied anchored /^fhfh:in-season-cancellation:v1$/i → browser-auth.ts 6c4f86fe…. Regressions: 3 cases (resolve/reject/5s timeout), panel absent, case variant cleared, v2/suffix/prefix + manual plan preserved.
- Before fix 3 failed/22 passed; after 25/25; 4 pattern mutations caught; combined 77/77; consumers AuthForm+auth page 6/6; ESLint 0.
- Next: tsc (lock), browser ticket2 mode on :3120, RECEIPT-2 + auth patch.
- Ticket 2 done: tsc exit 2 (only 2 pre-existing LUNA errors, lock released); browser ticket2 9/9 (menu sign-out clears key); server stopped.
- Handback: handoffs/C3/RECEIPT-2.md + C3-AUTH-SIGNOUT-CLEANUP.patch 5ad23a50… (browser-auth 6c4f86fe…, auth test 9173deb1…). Canonical unchanged. Remaining limit: session loss outside app sign-out leaves entry (owner-scoped, 24h restore eligibility).

## Ticket 3 — C7 findings O1/O2 (done)
- O1: strict lowercase v4 check on restore+send (lowercase because randomUUID emits lowercase and the server route rejects uppercase). Before: 2 failed/47; after 81/81; ESLint 0; tsc exit 2 (2 pre-existing LUNA only).
- O2: state-capture-3.cjs, 9 distinct overlay screenshots on :3120 (8/8 checks); server stopped.
- Delta patch a258a6ac… on ticket-1 candidate → InSeasonPanel.tsx 498942ab…, .test.tsx 71494651…; chain of 3 patches from canonical verified.
- Boundary request: server cancel route regex to same v4 shape (not edited).
- Receipt: handoffs/C3/RECEIPT-3.md.

## Ticket 4 — refund consumer private-safe errors (done)
- Consumer: DraftProPanel submitRefund (baseline 09f2e94b…/257b5053…; pinned in billing-sales-rollout + release r1 → integration needs Codex transfer).
- Fixed copy by status/code; no server/browser text. Baseline 12 failed/25; after 37/37; all suites 118/118; ESLint 0; tsc exit 2 (2 pre-existing LUNA).
- Browser :3120 baseline 9/9 leaks; fixed 21/21, 11 distinct screenshots; server stopped.
- Patch C3-REFUND-PRIVATE-ERRORS.patch c53cc8a7…; receipt handoffs/C3/RECEIPT-4.md.
- Boundaries: refund-requests route duck-typing/409→500/Zod text; refunds.ts branded errors. Follow-ups: other DraftProPanel raw-message paths.

## Ticket 5 — C7 C3-4 findings F1/O2/O3 (done)
- F1 refund claims need status AND known code; O2 ends/ended by deadline vs now; O3 PanelMessage class + fixed copy for account load, redeem, verify, Patreon connect.
- Ticket-4 panel: 24 failed/36; now 60/60; 4 suites 141/141; 7/7 mutations caught; ESLint 0; tsc exit 2 (2 pre-existing LUNA; first attempt found lock held → retried).
- Browser :3120 full-page: baseline 3/14, fixed 14/14, 13 distinct; server stopped. Gotchas: panel double-loads account on mount; Next route announcer is role=alert.
- Delta C3-PANEL-MESSAGES.delta.patch 9f049155…; receipt handoffs/C3/RECEIPT-5.md. Remaining limit: route relabels 422/404 codes (O1 boundary).
