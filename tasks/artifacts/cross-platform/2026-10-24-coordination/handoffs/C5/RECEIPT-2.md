# C5 receipt 2: yahoo-live-draft idle-exit auditing (CRON-AUDIT-COVERAGE)

- Ticket: C5 ticket 2 (same lease), under CODEX-20261024-007. Date: 2026-10-24.
- Base: `octoberBranch` @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. No Git writes, no commit. Nothing was run against a live route, cron, provider or database.
- Status: **implemented locally and checked; needs independent review.** It has not been accepted, integrated or released.
- This replaces only the idle-exit decision in `RECEIPT.md`, which said "no row for disabled/suspended". The rest of `RECEIPT.md` still stands.

## Decision: one heartbeat row a day

Disabled and suspended exits still do no work. Most of them still write no row. The one invocation whose wall clock falls in the **12:00 UTC minute** goes through a second `withCronJobAudit` delegate instead (`auditedIdle`, same `jobName`, `recordRowMetrics: false`, preview keys `disabled`, `suspended`, `resumesAt`). It writes one `success` row whose `details.response` is `{"suspended":true,"resumesAt":"…"}` or `{"disabled":true}`. The response to the caller is byte-for-byte the same as before.

Why this over the alternatives:

| Option | Rows per year off-season | What an operator sees in `cron_job_audit` | Verdict |
| --- | --- | --- | --- |
| No row (ticket 1) | 0 | Nothing for about 10 months, so "suspended as designed" looks the same as "schedule removed or route never runs" | Weakest evidence |
| Audit every idle exit | ~525,600 | Everything | Rejected as noise and cost: one insert a minute for months |
| One row per state change | n/a | Flips only | Rejected: knowing the previous state needs a DB read every minute or per-instance memory, which is unreliable on serverless. Neither is cheaper or truer than a daily row |
| **One row a day, at a fixed minute (chosen)** | ~365 | A daily heartbeat: the cron fires, CRON_SECRET admits, and the route reports its idle state and `resumesAt`. A flag flip shows up within 24 h | Cheap and bounded. It needs no wrapper, classifier or cron change and no extra DB read |

Choosing the slot by time needs no shared state. `Date.now()` lands in a given UTC minute on about one per-minute invocation a day. 12:00 UTC sits ahead of the 13:00 UTC cron-report and is far from the 04:00 UTC suspension boundary (2027-08-01T04:00Z), so the two `idleState()` reads in one heartbeat call cannot disagree.

**Operator view, off-season.**
- Can see: one row a day showing the job fired and which state it is in (`disabled` or `suspended`, plus `resumesAt`), and when the flag flipped, within 24 h.
- Cannot see:
  - the other ~1,439 idle exits a day;
  - denied calls (401, 405, or 503 because CRON_SECRET is missing). Authentication still runs before any audit, so those never write a row, and an expired secret shows only as missing heartbeats;
  - anything that happens before the handler runs.
- Caveats:
  - A delayed Vercel invocation can miss the 12:00 minute, or two can land in it. So one missing or duplicated heartbeat is a weak signal; several consecutive missing days is strong evidence.
  - No current consumer reads these rows. `cron-report.ts` does not map `/api/internal/yahoo-live-draft`, so the heartbeat is evidence for manual queries and not an alert.

**Real runs are unchanged.** Once the route is enabled and unsuspended, every invocation writes exactly one poll row, as in ticket 1: success, failure, partial counters, a throw, and no-session `cycles: 0`. When a real run lands in the 12:00 minute it writes only the poll row, never a second one. The poll delegate still reports real failures as `failure` rows; heartbeat rows never stand in for them.

## Patches

- Full candidate against HEAD: `handoffs/C5/C5-cron-audit-coverage-r2.patch`, SHA-256 `e86b43ce3ad0d62586d5c1423b79a65139ceef73e262596c5e39b537d807c062`. 5 files, +299/−46. `git apply --check -R` passes on the current tree.
- Delta against the first patch (`62faa9ce4657ceeb12ea645fcf907992500f2e72b3a5b6994f38f8951542a541`): `handoffs/C5/C5-r2-delta-vs-62faa9ce.patch`, SHA-256 `ebb3e054882531bdf8eceb39cc8cd2f5a90745bd4886b9314826941f3713d01d`. It covers 3 files. I rebuilt the ticket-1 tree from HEAD plus patch 1 in scratch and applied the delta to it; the result is byte-identical (`cmp`) to the current files.

| Path | Ticket-1 SHA-256 | Ticket-2 SHA-256 |
| --- | --- | --- |
| web/pages/api/internal/yahoo-live-draft.ts | 96704e8bf332… | 20c99628240be857c349a3a2b97c36fc48a58519f7a30c06cb33a71fd1f8abbe |
| web/__tests__/pages/api/internal/yahoo-live-draft.test.ts | 247565864c28… | f1d3238b68c45d43eb15c77825bed0a6e718779c8bccf34efccadafdefc6c8c6 |
| web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts | 5e2365e7d45a… | c2de0f7e2d86d5e26e87592428e0f112004ac1c30d5407ec0d01356513cc977e |
| web/pages/api/v1/db/update-drafted-prospects.ts | e4c5e476c50e… | unchanged |
| web/__tests__/pages/api/v1/db/update-drafted-prospects.test.ts | f16fad191886… | unchanged |

Dependency pins are unchanged from `RECEIPT.md`: `withCronJobAudit.ts` 02790f98…, `cronAuditCoverage.ts` 754a0df9…, `adminOnlyMiddleware.ts` de749fa9…, `timingContract.ts` ded35e2b…, `vercel.json` bcd2cab8…. All are clean at HEAD.

## What the delta adds

- Route: `idleState()` returns the disabled/suspended body or null. `isIdleHeartbeatMinute()` is true at 12:00 UTC. The `auditedIdle` delegate sits beside the existing `auditedPoll`. After the unchanged 5-statement auth prefix, the handler is now `const idle = idleState(); if (idle) return isIdleHeartbeatMinute() ? auditedIdle(req, res) : res.status(200).json(idle); return auditedPoll(req, res);`.
- Tests: 7 new heartbeat cases.
  - Suspended and disabled at 12:00 UTC each write 1 bounded row with the same response.
  - 11:59:59.999 and 12:01 write no row.
  - A wrong bearer or a missing secret at 12:00 writes no row.
  - An active run at 12:00 writes only the poll row.
  - A failed heartbeat insert still flushes the response once.
- The inventory pin test also checks that `auditedIdle` is present.

## Checks actually run

- `npm test -- __tests__/pages/api/internal/yahoo-live-draft.test.ts __tests__/pages/api/v1/db/update-drafted-prospects.test.ts __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`: **passed**, 3 files, 72/72 (yahoo 17, prospects 14, inventory 41).
- Original failures, with the new tests run against older routes. The candidate routes were restored and verified byte-identical with `cmp` after each run.
  - HEAD routes: **23 failed / 49 passed**. Ticket 1 measured 19 failed / 65 tests with its own suite.
  - Ticket-1 yahoo route: **4 failed / 68 passed**. All 4 are heartbeat-specific: the suspended row, the disabled row, the insert-failure flush, and the `auditedIdle` inventory pin.
- `npx eslint` on the 5 files: **passed** (exit 0).
- Focused tsc (scratch tsconfig extending `web/tsconfig.json`, the 5 files plus their imports): **passed**, exit 0, 0 errors.
- Whole-project `tsc --noEmit`: **not run**. `/private/tmp/fhfh-heavy.lock` is held by `claude-C3 local_d400a595…` (since 16:14:24Z), and I did not take it.
- **Disclosure:** my ticket-1 whole-project tsc ran in the background *without* taking that lock. It aborted on heap OOM (exit 134) and was not retried. That broke the heavy-check protocol. It produced no type result and wrote nothing.

## Held boundary (update to RECEIPT.md)

The static classifier still rates yahoo-live-draft `unqualified`. Under this shape, a reviewed yahoo form in `classifyVercelCronSource` would need to pin:
- the 5-statement prefix;
- `const idle = idleState();` and the exact `if (idle) return isIdleHeartbeatMinute() ? auditedIdle(req, res) : res.status(200).json(idle);`;
- `return auditedPoll(req, res);`;
- both delegates as `const … = withCronJobAudit(<arrow>)`.

That change belongs to the owner of `web/lib/cron/cronAuditCoverage.ts`; I have not edited it. No exemption was added.

Diary: `/Users/tim/Code/fhfhockey.com/tasks/diaries/2026-10-24-claude-c5-cron-audit-coverage.md`.
