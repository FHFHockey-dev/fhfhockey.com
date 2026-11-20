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

- Committed 1a6e54239 on chef/blsh-live-readiness and fetched as refs/rc/blsh-live-readiness-20261119; follow-up commit corrects the production-identity line (master advanced to dbe6a9e33 after 80af7e76c) and names job 408.

## 2026-11-20 resume (Chef ticket from local_23eb6989; TJ instruction 13:35Z, last paragraph)
- Scope: L7 + signer-custody copy-paste steps; one approval packet for the earliest eligible non-empty window; freeze start/end. No keys, deploy, re-date, arming. blsh-sandbox-run owns the handlers and the Nov 19 replay.
- Public NHL schedule (one GET, 13:3xZ): 2026-11-20 has 0 games. Native source date = capture day − 1, so capture Nov 21 is a no_slate window. Request-context needs a complete native packet; official needs ≥1 game. Earliest non-empty: capture Nov 22 12:05Z (source Nov 21, 14 games).
- The official step is date-literal: production migration 20261118155445 (lines 12/100/118/124), officialPilotAcquisition.ts:11, officialPilotHandler.ts:7, officialPilotStore.ts:7, plus the pinned operator SQL. The next window is therefore a re-date for TJ. Not drafted here.
- RC merged onto origin/master aa49b6c5e in scratch (merge-check-20261120, clean): cron suites, cron-report, auth boundaries pass; typecheck exit 0.
- Custody commands rehearsed with throwaway keys (deleted): script hash, generation, fingerprints, --expect, --stdin, private refusal exit 3, pair match, -rawin sign/verify.
- Part B: still no reply in the mailbox.

- Wrote live-readiness-2026-11-20/STEPS-L7-AND-CUSTODY.md and APPROVAL-PACKET-CAPTURE-20261122.md; committed bc3bbc911, fetched as refs/rc/blsh-live-readiness-20261120.
- Ran STEPS A1–A3 verbatim in a throwaway clone against that ref merged onto aa49b6c5e: 8 files/129+/10−; Vitest 43 files, 575 tests passed (file corrected from 579). Custody B-steps were rehearsed with throwaway keys; `pbpaste` (TJ's clipboard) and `~/blsh-verify` (TJ's home) were not exercised, `--stdin` was via redirect.

- FORGE live runs bind `expected_code_version` (release_mismatch at every stage), so the keyed push must avoid armed FORGE games. Packet now recommends push slot B (Nov 22 03:15Z, freeze about 9.5 h, re-date by Nov 21 14:00Z) over slot A (Nov 21 15:00Z). STEPS run claims narrowed; A6 now `rm -rf -- "${L7:?}"` (tested; a `$(dirname)` form was refused by the safety check).

## Next
Report the ref, steps and packet paths to the parent. Keep this diary until TJ decides the re-date (packet 6.1) and blocker 1 lands.

## Blockers / approvals
All 12 receipt blockers need TJ or owner action; none are this lane's to clear.

## Gotchas
- `psql` on PATH is libpq; use `/opt/homebrew/opt/postgresql@15/bin` explicitly (INSTALL hash-guards PG15 function text).
- New inventory rows move frozen counts in `cron-audit-wrappers.test.ts`.
