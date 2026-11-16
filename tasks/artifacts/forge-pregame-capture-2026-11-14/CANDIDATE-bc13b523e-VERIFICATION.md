# Candidate `bc13b523e` verification (clean export)

- **Candidate:** `bc13b523e28878e75fb48a5c631f049e4f8c0c45` (octoberBranch, local, not pushed). It is `e0cbb19a8` plus the slate re-plan fix and other lanes' commits in between.
- **Export:** `git archive` of the whole tree to `~/forge-pilot/export-bc13b523e-20261116T012855Z`, with `web/node_modules` linked from the checkout, at 2026-11-16 01:28:55Z.
- **Re-plan fix** (slate session, TJ's "Go"): `slateQueue.ts` +49 −18 and `slateQueue.test.ts` +21.
  - A re-plan happens only when a schedule read changes the slate (a start, a status, an add or a remove) or after a gate delay.
  - Games already due keep their turn (`planSlate(..., reservedAt)`).
  - **Regression:** two same-start games with a 325 ms schedule read, plain and with a late add, must give 0329 first, 0330 30 s later and max in flight 2. It fails on `e0cbb19a8`.

| Check (in the export, `web/`) | Result |
| --- | --- |
| `vitest run lib/projections/pregameCapture lib/projections/queries scripts/forge-pregame-slate.test.ts scripts/forge-pregame-capture.test.ts lib/supabase/supportedBaselineMigration.test.ts lib/projections/run-forge-projections.external-inputs.test.ts` | **18 files, 351 tests, exit 0** |
| `forge-pregame-slate.ts --rehearse` | exit 0, `networkAttempts: 0`, no check `ok: false` |
| `npm run typecheck` (under `/usr/bin/lockf -k -t 0 /tmp/fhfh-heavy.lock`, no GIT_DIR) | **exit 0** |
| `forge-pregame-slate.ts --plan` for 2026020331 + 2026020332 | dispatch 23:13:58Z and 01:13:58Z (see `SLATE-QUEUE-PACKET.md` §7) |

**Not in this candidate, and not needed to run it:**
- Migrations 155 and 156 and their records. Their files and authority rows were committed later.
- The deployed function itself is what the capture calls, and it is the same RPC name and signature.

**The other projection-code change in the range:** `web/lib/projections/ingest/shifts.ts` (#446, cron diagnostics). Only the ingest modules import it; `run-forge-projections` and the capture path do not. The capture suites above pass.

**Migration hashes the launcher relies on:** 150 `4213b110…98b9` and 151 `a3e1835f…9281`. They are unchanged since `e0cbb19a8` (`git diff --stat e0cbb19a8 bc13b523e` touches neither file).
