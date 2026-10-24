# C7 independent review — C5 CRON-AUDIT-COVERAGE r2

**Reviewer:** Claude C7 lane session (not the author). Read-only: I ran no live route, cron or database. There were no Git writes and no server. Evidence is in `r4-evidence/c5/`.

**Verdict: accepted with limits.** On the reviewed routes:

- auth denial writes no row;
- real failures are recorded as `failure`;
- disabled or suspended exits write exactly one heartbeat row per simulated day;
- every invocation writes at most one row, with no duplicate finalisation.

## Pins

- **Patch:** `C5-cron-audit-coverage-r2.patch` `e86b43ce…c062`, which matches.
- **Scratch:** I set the five files to the bytes from `git show HEAD:<path>` (read-only Git) in an rsynced scratch copy. r2 applies cleanly to HEAD.
- **After applying:**
  - `yahoo-live-draft.ts` `20c99628…`
  - `yahoo-live-draft.test.ts` `f1d3238b…`
  - `cron-audit-wrappers.test.ts` `c2de0f7e…`
  - `update-drafted-prospects.ts` `e4c5e476…`
  - `update-drafted-prospects.test.ts` `f16fad19…`

  All five are byte-identical to the canonical working tree and match the receipt.
- **Dependencies, read only:** `withCronJobAudit.ts`, the real `adminOnlyMiddleware.ts`, and the `vercel.json` schedules (`* * * * *` for yahoo-live-draft; `17 */2 * * *` for prospects).

## Executed (vitest node env, real `withCronJobAudit` and real `adminOnly`; DB, provider and auth client mocked; offline guard)

**Base (HEAD routes):**
- **8 of my 16 controls fail**, as expected: there are no audit rows at HEAD, so every row-count control fails. The deny controls pass trivially.
- The owner's old suites pass: 6 + 6 + 39.

**Two mistakes of mine (logs kept):**
- Run 1 passed `undefined` for "no header", which hit the default parameter and sent a valid bearer.
- The inventory test needed `tasks/TASKS/cron-operations/cron-schedule.md` at a repo-relative path. I copied it into scratch.

**After r2: 88/88 pass.**
- My 16 controls.
- yahoo 17, inventory 41 and prospects 14, reproducing C5's 72.

## What holds

| Requirement | Evidence |
| --- | --- |
| Auth denial writes no row | yahoo: wrong bearer, no header, POST and missing `CRON_SECRET` at 12:00 → 401/405/503, 0 rows. Prospects with the **real** `adminOnly`: no header, non-bearer and bad token → 401, non-admin → 403, 0 rows. The owner's prospects tests replace `adminOnly` with a passthrough, so this path is independently covered only here. |
| Real failure reporting | Active run with `failed > 0` → 503 and exactly 1 `failure` row, both at 11:00 **and inside the 12:00 heartbeat minute** (no success heartbeat substitutes). Coordinator throws → 503, generic body, 1 `failure` row, no provider text in the row. Admitted cron call with a wrong method on prospects (PUT) → 405, 1 `failure` row. |
| Once-a-day idle row | A simulated day of 1,440 per-minute invocations (each at +2.5 s), **suspended** and **disabled**: **exactly 1** `success` row each. The response is identical across all 1,440 calls (`{"suspended":true,"resumesAt":"2027-08-01T00:00:00-04:00"}` / `{"disabled":true}`, 200), with no coordinator or DB work. |
| No duplicate finalisation | Every invocation above gives at most 1 insert and exactly 1 `json` flush. A heartbeat insert that rejects still flushes once, with no retry insert. |

## Limits and observations

- **C5-O1 (documented):** two invocations in the same 12:00 UTC minute write **2** heartbeat rows (my Y2). A delayed invocation that lands after 12:00:59 writes 0. A single missing or duplicated heartbeat is therefore weak evidence, and C5 says so.
- **Heartbeat is unconsumed:** no consumer reads it, since `cron-report.ts` doesn't map this route. It is manual-query evidence only. Denied calls (an expired secret) show up only as missing heartbeats.
- **Held boundary (unchanged):** the static classifier still rates yahoo-live-draft `unqualified`. Updating `classifyVercelCronSource` belongs to the owner of `cronAuditCoverage.ts`.
- **Process:** C5 disclosed that its ticket-1 whole-project `tsc` ran without the heavy lock (it hit OOM and produced no result). I ran no whole-project `tsc` for C5. Its focused tsc and ESLint are owner claims, and I didn't rerun them.
- **Not run:** live crons, the real `cron_job_audit` table, or the 207/continuation paths, none of which these routes use.
