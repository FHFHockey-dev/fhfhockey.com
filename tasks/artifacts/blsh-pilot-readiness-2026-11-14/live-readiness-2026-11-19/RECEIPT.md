# BLSH v6 first live capture: readiness receipt (2026-11-19)

**Verdict: NO-GO until the twelve blockers below clear in order. All local engineering for the 2026-11-21 12:05Z window is done.** This lane enabled, armed, deployed and pushed nothing. It made no production reads or writes, NST calls, env or cron changes, and did not re-date the window or bundle it into the FORGE release.

- Branch: `chef/blsh-live-readiness`, cut from origin/master `dbe6a9e3312f24c9fb2565da754b92803663ad29`.
- Fetched into the canonical checkout as `refs/rc/blsh-live-readiness-20261119`. The commit SHA is reported with the handoff.
- Production remains at `80af7e76c21b505eb2db12b93cbb936e78114143` (`dpl_D9YPjERZXhgbNrD2t1aUXt5mwc17`), with the native switch off and both public keys absent. That is the November 18 readback; this lane did not re-read it.

## Remaining blockers, in order

All times are UTC. "Hard latest" is when a script or handler refuses. "Plan by" leaves margin.

| # | Blocker: exact TJ approval or action | Cost | Plan by / hard latest |
| --- | --- | --- | --- |
| 1 | **L7 sign-off and integration.** The shared NST owner and the L7 reviewer review this RC's registration diff; see L7 below. TJ approves integrating it into master on its own. FORGE stays out. | Local review only. 0 builds. | Plan by Nov 20 12:00. Hard latest: before blocker 4's push. |
| 2 | **Signer custody.** TJ creates two Ed25519 keypairs off-Mac and records both fingerprints (CUSTODY.md steps 1–2). The independent verifier recomputes them (step 3). The release owner and the custodian confirm they are available Nov 21 12:00–12:50 (07:00–07:50 ET). | None. No secrets leave the signer environment. | Plan by Nov 20 12:00. Hard latest: before blocker 4's staging. |
| 3 | **Part B receipts.** The existing hosted operator returns the Nov 19 job 404/405 observations under `PART-B.md`. No local receipt existed at 20:24Z, and the mailbox entry reads "Acknowledgement pending". Keep the outcome unknown until then. | None. Existing records only; no new invocation. | Before blocker 10. |
| 4 | **Keyed release.** TJ approves two things: (a) staging both public SPKI PEMs as Vercel **production** variables, then the `--stdin --expect` readback (CUSTODY.md step 4), and (b) one push of the integrated SHA to master. Stage the keys **before** the push so one build carries them; a later env-only redeploy of unchanged web code is canceled by the Ignored Build Step and would need a separately approved CLI deploy. Before pushing, re-inventory every linked Vercel project. Then read back the READY deployment ID, Git SHA, alias and region. | 1 production web build plus the other linked projects' canceled/ignored entries (Nov 18: 1 build + 3 canceled). Env change. | Plan READY by Nov 20 20:00. Hard latest: before blocker 8. |
| 5 | **Release freeze.** TJ holds every fhfhockey production deployment, FORGE included, from blocker 4's readback until the official run closes on Nov 21 (about 12:50). INSTALL's claim trigger and both signed grants bind that deployment ID, so any later deploy voids them. | Delays other releases for about 40 h. | Starts at blocker 4. |
| 6 | **Managed ingress check.** The DB owner confirms read-only that managed PostgREST accepts a 5,592,690-byte RPC body and the network budget for it (packet requirement). | One read-only config check under owner approval. | Plan by Nov 20 20:00. |
| 7 | **Approve the disarm set.** TJ or the DB owner reviews and pins `CANCEL-OFFICIAL-ONCE.sql` (`c5fa1b15b181defac06f0425e930162d484f0b6b1bd1ae9ae8f459193b87a9a4`) and `SWITCH-OFF.sql` (`19abbc7f23ec69df490dd5ca4bd226353c421fe72bdf51460ad155c6f5c0ed33`) as part of the disarm set. On its own, DISARM-ROLLBACK leaves the one-time official job active. It also cannot clear a raw switch when no permit is installed. | None. | Before blocker 11. |
| 8 | **INSTALL.** TJ approves the production DB transaction. The DB owner runs the pinned `pilot-control/INSTALL.sql` with `release_sha` and `deployment_id` taken from blocker 4. Read back: one permit row, the trigger, raw off, effective off. | 1 short DDL transaction on `fyhftlxokyjtpndbkfse`. | Plan by Nov 20 22:00. Hard latest: 2026-11-21 12:04:59.999 (`pilot_install_after_primary_start`). |
| 9 | **NST day-of clearance.** The shared NST owner confirms that no manual `/db` runner, other lane or ad-hoc NST work runs from 11:05 to 12:07. BLSH's 2 URLs then sit alone in every rolling window. If any is planned, it must pass through the shared admission ledger and the headroom must be confirmed. | Possibly pausing manual NST work for about 1 h. | Nov 21 by 11:00. |
| 10 | **Dated go/no-go.** TJ signs the dated go/no-go per `PILOT-APPROVAL.md`, after blockers 1–9. | None. | Nov 21 by 11:30. |
| 11 | **ARM.** Separate one-date approval. The DB owner runs the pinned `pilot-control/ARM.sql` with the same pins. Read back: raw true, effective false until 12:05:00. | 1 transaction. | Plan 11:45–12:00. Hard latest: 12:04:59.999 (`pilot_arm_pins_or_time_mismatch`). |
| 12 | **Window staffing and the remaining gated steps.** The operator, signer and DB owner are present 12:00–12:50 on Nov 21. Steps: job 404 at 12:05; disarm after the primary disposition and before 12:20; request-context POST 12:35:00–12:35:59.999; then official Vault grant + `SCHEDULE-ONCE.sql` 12:35:00–12:44:59, which needs its own specific approval. Disarm = DISARM-ROLLBACK, then SWITCH-OFF if DISARM refuses. If the 12:45 job did not fire, run CANCEL-OFFICIAL-ONCE right after 12:46; once the official run closes, run it in every case. | 2 NST GETs + 2 admissions; 3 function invocations (≤250 s, 240 s, 240 s); one pg_net GET; up to 64 MiB context and 71.125 MiB official custody. | Nov 21 12:00–12:50. |

## Deliverable 1: L7 NST registration (code and tests)

- `web/lib/cron/nstCoordination.ts`: `blsh-native-capture` at 12:05 is now the fifth `NST_ACTIVE_DIRECT_CRON_STARTS` entry.
  - Burst clearance is allowed: 130 min back to 09:55 and 1,225 min on to 08:30.
  - The 09:55 job's next gap is now 130 min.
- `web/lib/cron/nstClassification.ts`: `blsh-native-capture` is added to `DIRECT_REMOTE_NST_JOBS`.
  - **Backup classification (REGISTRATION.md contract):** the 12:20 backup is not a separate start. It shares the route, and the route audits under the job name `blsh-native-capture`. The tests pin that the backup has no slot of its own.
- `tasks/TASKS/cron-operations/cron-schedule.md`:
  - JSON inventory rows for jobs 404/405 (POST, same route) and 406/407 (SQL);
  - prose time-list entries;
  - a schedule-floor NST note.
- **Required collateral.**
  - The cron audit scanner (`web/lib/cron/cronAuditCoverage.ts`) matched only literal `adminOnly(` and `withCronJobAudit(` calls. It therefore reported the BLSH route, the first scheduled route on `withOperationalRouteAuth`, as unprotected and unaudited. That wrapper always applies `adminOnly` outermost, and applies `withCronJobAudit` unless `audit: false`. The scanner now recognizes it; a test covers both the audited and the `audit: false` forms.
  - Frozen inventory counts moved: auth findings 46→47, job names 50→52, cron-only 28→29, pg_cron 58→62 and total 90→94. Each move carries a dated comment.
- **Checks.**
  - Vitest passed: `lib/cron` (all files), `__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`, `scripts/vercel-ignore.test.ts`, `lib/predictions/pipelineCronAlignment.test.ts`, and the `cron-report` tests.
  - `npm run typecheck` exit 0.
  - ESLint on the changed files exit 0.

**Budget evidence.**
- **BLSH plan.** One run issues 2 NST URLs, 22 s apart, with zero retries. Each GET is preceded by one shared admission RPC (`nst_admit_attempt_v1`, not an NST URL).
- **Rate-limit assessment.** `assessNstRequestPlan({requestCount: 2, intervalMs: 22000})` is compliant: 2/39 per 1 min, 2/80 per 5 min, 2/100 per 15 min and 2/180 per hour. A test asserts it.
- **Other scheduled NST callers.**
  - pg_cron starts at 08:30, 08:45, 09:15 and 09:55.
  - The Vercel rolling-forge pipeline runs 10:05–10:55; its gamelog step fetches NST, and its last invocation ends by about 11:00.
  - Nothing else in pg_cron or `web/vercel.json` near the window is classified as direct NST. The route files for 12:00 trend metrics, 12:15/12:45 draft-ranker and 12:40 FORGE snapshot contain no NST reference.
- **Result.** The 60-minute window ending 12:07 (from 11:07) contains no other scheduled NST start. The 12:20 backup cannot claim during the pilot, because the permit window is 12:05–12:07.
- **Not covered.** Manual `/db` runner jobs and other lanes are governed by the shared admission ledger, not the schedule. That is blocker 9.

## Deliverable 2: custody and key verification

Files:
- [CUSTODY.md](CUSTODY.md): the exact procedure.
- [verify-approval-public-key.mjs](verify-approval-public-key.mjs): SHA-256 `6118ac842e25e33de6fb3df4d74cb28f5173d896e835f5add23adc22daa7d98e`.
- [key-crosscheck.txt](key-crosscheck.txt): the handler cross-check.

Results, with throwaway keys only:
- The selftest passed 21/21.
- OpenSSL and script fingerprints were identical.
- Private input was refused with exit 3 and no echo.
- Over 14 key shapes, the script's verdict equalled both real handlers' verdicts.

## Deliverable 3: pilot-control SQL on disposable PostgreSQL 15

[pg15-validate.py](pg15-validate.py) (SHA-256 `59676b4e0df18d6d538e11a8ea5cf35f0c839a9b0023752fc0d1f4ef43256f29`) runs on PostgreSQL 15 from `/opt/homebrew/opt/postgresql@15`.

**Setup.**
- Unix socket only, with no TCP listener and no `PG*` environment.
- The four real BLSH migrations were applied in release order. Their SHA-256s match the release pins. Migration 154 was compiled with `check_function_bodies = off`, because the disposable DB has no source tables; its functions are never called.
- pg_cron, pg_net, Vault and storage are stubs. Jobs 404–407 are seeded with their live names, plus an unrelated job 408, and the job-ID sequence starts at 409.
- INSTALL, ARM, DISARM and SCHEDULE-ONCE match their release pins byte for byte.

**Clock.**
- Byte-exact runs use the real database clock, which is before 2026-11-21 12:05Z.
- Runs inside the window use labelled *shifted* copies, in which only `pg_catalog.clock_timestamp()` is swapped for a fixture clock.
- The native and context completion states needed by SCHEDULE-ONCE's preflight were set directly as fixtures, in replica mode.

Output: [pg15-validate.out](pg15-validate.out), **41/41 PASS, exit 0**.

- **Static.** No operator file names job ID 404–408 in code. The only mention is an INSTALL comment.
- **Rerun behavior (exact bytes).**
  - INSTALL ✓. A rerun is refused (`pilot_migration_153_definition_mismatch`) with state identical.
  - ARM ✓. A rerun is refused (`pilot_not_armable`) with state identical; wrong pins are refused.
  - DISARM returns exactly to baseline: the switch is off, migration 153's function is restored (its hash equals INSTALL's guard) and the permit is gone. A rerun is refused with the baseline intact.
  - INSTALL → DISARM repeats cleanly.
- **Full sequence (shifted).**
  - INSTALL 11:00 → ARM 12:00 → claim at 12:05:30 succeeds. A backup claim at 12:20 is refused.
  - SCHEDULE-ONCE is refused at 12:34:59. At 12:40 it registers job **409** `blsh-official-once-20261120` `45 12 21 11 *`, and the dispatch row records 409. A rerun is refused with state identical.
  - **Finding:** after DISARM, that job is still active.
  - DISARM + CANCEL-OFFICIAL-ONCE leaves **0 active BLSH pilot jobs**. The native claim and the dispatch row are retained. A CANCEL rerun is a no-op.
  - Rows 404–408 are byte-identical at the end, and the job-ID set equals the baseline.
- **Fired variant.** One queued GET, then self-unscheduled. DISARM + CANCEL then leaves 0 jobs, with 404–408 intact.
- **Never registered.** CANCEL is a no-op. If a same-name job exists without a dispatch row, CANCEL refuses and leaves it for a human.
- **Partial state.**
  - **Finding:** with the raw switch on and no permit installed, DISARM's DROP fails and rolls back its own switch-off, leaving the **switch ON**.
  - SWITCH-OFF clears raw and effective state without DDL or cron access, and a rerun is a no-op.

## Deliverable 4: stale receipt lines (corrections here only)

`tasks/artifacts/blsh-shipping-2026-11-18/RELEASE-PINS.md` (SHA-256 `cbacb836789e91c05eba64c295e38eb7a779cb0fcbd3cbc516f7e3d2a9b2feec` as read) and `PILOT-APPROVAL.md` (`1553fac53265c06c45838ff71798940aa49cab9e9645560871006a002953c83b`) are **untracked** in the canonical checkout and absent from origin/master. This lane therefore did not edit them. Its owner should apply these corrections:

- **RELEASE-PINS.md line 24.** "exact approval and readback pending" → "Applied 2026-11-18 under TJ approval; catalog readback 16:39:22.115850Z (`PRODUCTION-DEPLOY-RECEIPT.md`)". Line 25 is equally stale: "Applied 2026-11-18; readback 16:40:12.984415Z".
- **RELEASE-PINS.md line 30.** "Two disabled-path observations pending" → "The Nov 19 12:05/12:20Z firings have passed. No operator receipt exists in the canonical checkout as of 20:24Z, and the mailbox acknowledgement is pending. The outcome is unknown until the operator returns PART-B."
- **RELEASE-PINS.md line 5 and PILOT-APPROVAL.md line 25.** The joint L7 registration now exists as `refs/rc/blsh-live-readiness-20261119`, pending blocker 1. It is not yet the enabled-release SHA.
- **Nov 17 v5 outcome.** `TJ-APPROVALS.md` line 30 and the BLSH diary (another owner) read "NOT RUN; A2–A4 lapsed". `PILOT-APPROVAL.md` line 18, `RELEASE-PINS.md` line 41 and the deploy receipt read "unknown".
  - **Reconciled reading:** the Chef wake-up fired about 51.5 h late and its date guard held, so nothing was relayed and the Chef side ran no capture. Operator `local_017907a3` never gave a terminal attestation.
  - **Single wording:** "not run (no relay sent; A2–A4 lapsed); operator attestation absent".

## Not verified here

- Any production state after the November 18 readback.
- Actual managed pg_cron, pg_net, Vault and PostgREST behavior. The stubs prove only the transaction logic.
- The FORGE pregame lane's or other lanes' NST plans for Nov 21.
- The Part B outcomes.
