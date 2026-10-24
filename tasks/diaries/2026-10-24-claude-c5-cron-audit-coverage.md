# C5 CRON-AUDIT-COVERAGE (Claude lane session)

- Scope: adopt existing `withCronJobAudit` in `web/pages/api/internal/yahoo-live-draft.ts` and `web/pages/api/v1/db/update-drafted-prospects.ts`; extend their two route tests and `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`. No shared wrapper/auth/classifier, cron config, provider writer, Git.
- Where: canonical checkout, octoberBranch @ 2a5092d37 (dirty tree, untouched). Packet: `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C5/`.
- Baselines: all five leased files matched CLAUDE-LEASES.json SHA-256 at start (14:4xZ).

## Decisions
- Prospects: `adminOnly(withCronJobAudit(...))` (auth-first, matches 50+ reviewed routes); static classifier qualifies it as shared-wrapper.
- Yahoo: keep the reviewed 5-statement cron-secret prefix and the enabled/suspended no-op gates outside the audit; return an audited delegate (espn-sync pattern). Avoids a per-minute audit insert during the months-long suspension.
- Gotcha: `classifyVercelCronSource` (lib/cron/cronAuditCoverage.ts, shared, not leased) only recognises delegates for espn/fantrax/patreon, so yahoo stays statically "unqualified" until its owner adds a reviewed yahoo delegate form. Held hunk, requested in receipt.

## State / next
- Routes + 3 tests edited. Focused Vitest 65/65 pass (3 files); with baseline routes swapped back in, 19 fail (tests detect the missing audit). Routes restored byte-identical (cmp). eslint on 5 files: exit 0.
- Gotcha: the wrapper restores `res.json` as a bound copy, so route-test spies must be held separately (`res.sent`). `vi.clearAllMocks` resets spies, so the no-network check uses a plain counter.
- Patch: handoffs/C5/C5-cron-audit-coverage.patch (reverse-applies cleanly).
- Whole-project tsc: heap OOM (exit 134); not a type result, not retried. Focused tsc (scratch tsconfig extending web/tsconfig, 5 files + imports): exit 0, 0 errors.
- Ticket 2 (CODEX-007 released the hold): chose a daily idle heartbeat. The 12:00 UTC invocation goes through a second withCronJobAudit delegate (`auditedIdle`); other idle exits still write no row. 72/72 focused pass. 23 fail on HEAD routes, 4 (heartbeat-only) on the ticket-1 route. eslint and focused tsc clean. Heavy lock held by C3, so no whole-project tsc. Disclosed that the ticket-1 whole-project tsc ran without the lock. RECEIPT-2.md, the r2 full patch and the delta vs 62faa9ce are in handoffs/C5.
- RECEIPT.md written in handoffs/C5. Lane done pending independent review; held hunk = yahoo delegate form in lib/cron/cronAuditCoverage.ts (owner's file). Keep this diary until Codex integrates or rejects the patch.
