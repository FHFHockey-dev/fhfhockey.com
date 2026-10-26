# RSO-E2E diary (2026-10-25, Claude)
- Scope: new web/e2e/rso-continuity.spec.ts + web/e2e/fixtures/rso-continuity/ + tasks/artifacts/rso-wave2-2026-10-25/E2E/. No product edits under this lane, no commit.
- Server: isolated next dev on 3160 (.next-playwright), stopped at the end.
- State: first run 9/10 (case 2 = defects D1, D2 in DEFECTS.md). Both fixed under RSO-PRIVACY; continuity now 10/10 (see RECEIPT-2.md).
- Gotchas: a disabled Undo isn't a tab stop; the shared /data read is coalesced on supersede, not aborted; the provider fixture must return the workspace's league or the refresh is discarded.
- Next: orchestrator commits; retire after commit.
