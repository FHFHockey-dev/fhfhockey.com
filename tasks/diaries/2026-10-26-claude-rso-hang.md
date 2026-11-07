# RSO-HANG diary (2026-10-26, Claude)
- Scope: diagnose the production stall on "Checking access…"; no canonical edits.
- Finding: navigator.onLine === false makes the access load return before clearing checkingAccess (RosterScheduleOptimizer.tsx:411-413); only the GET /workspace runs. Reproduced exactly on 538100d41 and on bd337d97a (pre-existing). TJ confirmed onLine=false. 0 games is separate: a team-less Yahoo context after the ownerless migration.
- Fix applied on TJ go-ahead (uncommitted): skip clears checkingAccess; offline reason before the access branch; regression test (fails on HEAD). RSO 1633/1633 UTC and NY; tsc 0; eslint 0 errors.
- Superseded by RSO-ONLINE (RECEIPT-8): attempt regardless of onLine; offline only on a real network failure; access deadline 15 s; held reason. RSO 1635/1635 UTC and NY; E2E 55/55 both; tsc 0.
- Next: orchestrator commits; retire after commit.
