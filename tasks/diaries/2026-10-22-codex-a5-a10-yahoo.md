# A5 / A10 Yahoo packet

- Scope: A5 weighted actual null handling and A10 stale provider entitlement test seam; sole custody of `web/lib/integrations/yahoo/rosterPlanning.test.ts`. No guard/billing changes, remote calls, commits, or release operations.
- Where: canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; existing dirty checkout preserved. Queue/VERIFY and original report are scoped evidence.
- Baseline: HEAD `a811b0762ffe29006c3df7eaa4c19bf18deecda3`; both assigned files initially clean. Node v22.11.0/npm 10.9.0 confirmed. Read queue, preserved report, VERIFY, real provider-sync guard and central access/paywall tests; Supabase skill read for security context (no Supabase feature/schema change or remote verification).
- Reproduction: sanitized snapshot `/tmp/fhfh-queue-check-5s8u51no/isolation/snapshot/web`, source fingerprints beside snapshot. Offline focused A5/A10 run: 5 failed, 1 passed, 60 skipped; actual GOALS=2/HITS=null yielded 2, and four existing route tests failed at obsolete entitlement seam. Receipt `baseline-a5-a10.log` in snapshot root.
- Decision: update only weighted field conversion and test entitlement dependencies, preserving the real guard and route. Adapter's existing absent-player DNP inference is a separate completeness limitation; no completeness claim follows from A5.
- Implementation complete: only `rosterPlanning.ts` weighted conversion and `rosterPlanning.test.ts` entitlement seam/regressions changed. Preserved real guard/route and all original assertions; foreign-owner test invokes the real adapter.
- Verification: fixed snapshot `/tmp/fhfh-queue-check-czo1qy0n/isolation/snapshot/web`; focused checks 24 passed/57 skipped, combined adapter/access/paywall 138 passed, focused ESLint and diff-check clean. No full type-check/build/full-suite run. Fixed source and five guard/test dependencies rehashed against snapshot with no drift.
- Handoff: `tasks/artifacts/claude-audit-fixes-2026-10-22/a5-a10-yahoo/HANDOFF.md`, immutable before/after manifest, checksum file, patch, and four receipts. Shared-test custody released to parent for independent review; no commit or canonical-register change.
- Next: independent review of pinned hashes; diary retained for handoff continuity, excluded from candidate.
- Blockers: none. Parent coordinates other workers and usage. No further delegation.
- Gotchas: tests must use sanitized `/tmp` snapshot, synthetic env and network denial; do not load canonical local env files. Diary excluded from release candidate.
