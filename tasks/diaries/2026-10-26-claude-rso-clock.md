# RSO-CLOCK diary (2026-10-26, Claude)
- Scope: test-side fixes for time-dependent RSO failures (component test + e2e/roster-schedule-optimizer.spec.ts). No product edits, no commit.
- State: done. Unit 1631/1631 in UTC and America/New_York; E2E 54/54 in both; eslint clean. RECEIPT-3.md has hashes and root causes.
- Gotchas: 537/594 were an auth storage-key mirror gap, not clock; 2042 was a scroll-sync race; 639 had a Node-side `new Date()` issuedAt plus a Sunday-UTC-midnight pin.
- Next: orchestrator commits; retire after commit.
