# S05-R1 ownership — 2026-10-24

Parent explicitly returns exactly these two application paths for the S05-R1 hidden-page auth-refresh correction; original source pins verified before editing:

- `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.tsx` — 741008b25f39935a3bafcd34d83908f34e97d2802da34cd8f40893e7d4f2c529
- `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx` — 36c1b6b5bb1802f3bfb10a21f70f55be0f0421ef6d7dfece9d839866958a74fd

New revision artifacts: OWNERSHIP.md, HANDOFF.md, EVIDENCE.json, checks.log, r1.vitest.config.mts, tsconfig.json, correction.patch, before/TestingGroundsOwnerGate.tsx, before/TestingGroundsOwnerGate.test.tsx and artifact-local test cache. Continue existing task diary. Original slice05 and independent slice05-review packets/reproducer/failure logs are immutable.

Scope: authoritative foreground/pagehide lifecycle guard across auth callbacks and asynchronous results; keep current account/session generations, server capability checks, disabled actions and current APIs unchanged. Only original failing control and focused adjacent lifecycle controls, then scoped static checks. No shared auth/config or fixture changes, live verification/configuration/reload, server/browser, new workers, Git or paid work. Owner activation remains independently blocked, 0 of 1 approved Auth reads used. Scout retains acceptance.
