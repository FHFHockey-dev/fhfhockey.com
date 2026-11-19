# 2026-11-19 · Claude · BLSH live readiness (v6 first live capture, window 2026-11-21 12:05Z)

## Scope
Make the first live BLSH v6 capture ready except TJ's separate approvals: (1) L7 NST registration code+tests+budget evidence; (2) signer custody procedure + local public-key verification script (throwaway keys only); (3) validate pilot-control INSTALL/ARM/SCHEDULE-ONCE/DISARM on disposable local PG15; (4) receipt with ordered blockers. No production reads/writes, deploys, pushes, env/cron changes.

## Where
- Scratch clone `$SCRATCH/blsh-ready`, branch `chef/blsh-live-readiness` from origin/master `dbe6a9e33`.
- Receipt: `tasks/artifacts/blsh-pilot-readiness-2026-11-14/live-readiness-2026-11-19/RECEIPT.md`.

## State / checkpoints
- Orientation done. RELEASE-PINS.md and PILOT-APPROVAL.md are untracked in the canonical checkout (not in master) → item 4 corrections go in the receipt only.
- Decision: follow REGISTRATION.md contract — only the 12:05 primary is a direct NST start; backup audits under the same `blsh-native-capture` job name.

- L7: registry + cron-schedule rows 404–407 landed together; cronAuditCoverage now recognizes withOperationalRouteAuth (BLSH is the first scheduled route on it); frozen counts bumped. Vitest lib/cron + audit + vercel-ignore + alignment pass; typecheck exit 0; eslint 0.
- Keys: verify-approval-public-key.mjs selftest 21/21; scratch cross-check vs both real handlers agreed on 14 shapes (test file deleted, output kept).
- PG15: pg15-validate.py 41/41. Findings: DISARM leaves the one-time official job active (added CANCEL-OFFICIAL-ONCE.sql); DISARM without a permit rolls back its own switch-off (added SWITCH-OFF.sql).
- Receipt written with 12 ordered blockers.

## Next
Commit with explicit pathspecs → fetch into canonical as refs/rc/blsh-live-readiness-20261119 → report SHA. After that this diary stays until blocker 1 (L7 sign-off) lands the RC.

## Blockers / approvals
All 12 receipt blockers need TJ or owner action; none are this lane's to clear.

## Gotchas
- `psql` on PATH is libpq; use `/opt/homebrew/opt/postgresql@15/bin` explicitly (INSTALL hash-guards PG15 function text).
- New inventory rows move frozen counts in `cron-audit-wrappers.test.ts`.
