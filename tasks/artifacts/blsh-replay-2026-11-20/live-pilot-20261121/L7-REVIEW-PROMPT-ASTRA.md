Astra BLSH: TJ asks you to be the **independent L7 reviewer** for the BLSH live pilot's NST registration. This is a read-only review: make no code edits, no production reads or writes, no push, deploy, migration, key change or arming, and change no branch in `/Users/tim/Code/fhfhockey.com`. Return PASS or the precise blocker, with evidence for each step.

**Roles (kept separate).** You review the L7 registration only. The shared NST owner is the Claude "11/21 || FORGE Lane"; it signs its admission and rate-limit check in a separate block, and your sign-off does not cover it. FORGE's registry check of the release commit Y `1efdfb4364dffa73a9c249f382dbfebe22ebbbd2` (closure `d6520f1c…`, 28/28) is release context only. It is complete and does **not** substitute for L7.

**Independence check (answer first).** Confirm you did not author or materially shape these four files. BLSH Chef's search found no Codex diary or mailbox entry touching them; they come from the Claude readiness commit `1a6e54239` (Nov 20). Your earlier work on the native-capture client and your Nov 18 request for an L7 sign-off are disclosed context. If you judge yourself not independent, stop and say so.

**What is under review**
- Commit X `b5e18f49078addde4bda3e5679e5602f8ed58393` (ref `refs/rc/blsh-pilot-redate-20261122-x`) merges the pilot re-date `16f5c46030a8d619b8be153bb79cbbf9f1e9baa2` onto master.
- Comparison base: current `origin/master` and production `523ba01085776f9d2be345028bff919a243f77ae`, which is X's first parent.
- The four files (expected diff stat: **4 files, 48 insertions, 3 deletions**; blobs equal to `1a6e54239`):
  - `web/lib/cron/nstClassification.ts`
  - `web/lib/cron/nstClassification.test.ts`
  - `web/lib/cron/nstCoordination.ts`
  - `web/lib/cron/nstCoordination.test.ts`
- The rest of L7 already shipped and is on master: the `cronAuditCoverage.ts` scanner change and the `cron-schedule.md` rows for jobs 404–407. Confirm those on master; they are not in this diff.

**What the registration means.** `blsh-native-capture` becomes a direct NST start at 12:05Z (minute 725). It makes 2 NST GETs, 22 s apart, with zero retries and one claim per source date. The 12:20Z backup (job 405) shares the route and the audit job name and is not a separate start. The first use is Mon 2026-11-23 12:05Z.

**A1. Throwaway clone** (never the canonical checkout; never set `GIT_DIR`):
```bash
export L7="$(mktemp -d)/l7" && git clone -q --no-hardlinks /Users/tim/Code/fhfhockey.com "$L7"
```
```bash
cd "$L7" && git fetch -q /Users/tim/Code/fhfhockey.com refs/rc/blsh-pilot-redate-20261122-x:refs/heads/l7-review && git branch release-base 523ba01085776f9d2be345028bff919a243f77ae && git checkout -q l7-review && git rev-parse HEAD HEAD^1
```
Expect `b5e18f49078addde4bda3e5679e5602f8ed58393`, then `523ba01085776f9d2be345028bff919a243f77ae`.

**A2. Read the registration diff:**
```bash
git diff --stat release-base l7-review -- web/lib/cron web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts tasks/TASKS/cron-operations
```
```bash
git diff release-base l7-review -- web/lib/cron/nstClassification.ts web/lib/cron/nstCoordination.ts web/lib/cron/nstClassification.test.ts web/lib/cron/nstCoordination.test.ts
```
Confirm each, citing lines:
1. `NST_ACTIVE_DIRECT_CRON_STARTS` gains one entry, `blsh-native-capture` at minute 725 (12:05). It is 130 min after the 09:55 job and 1,225 min before the next 08:30 job.
2. `DIRECT_REMOTE_NST_JOBS` gains `blsh-native-capture` only. The backup is not added.
3. On release-base, `tasks/TASKS/cron-operations/cron-schedule.md` has rows for jobs 404–407: 404 and 405 POST `/api/v1/db/blsh-native-capture`, and 406 and 407 are SQL. Its NST note says nothing else scheduled is direct NST from 11:07 to 12:07.
4. On release-base, `web/lib/cron/cronAuditCoverage.ts` recognizes `withOperationalRouteAuth(...)`: `adminOnly` outermost, plus `withCronJobAudit` unless `audit: false`.
5. Nothing outside these four files changes `web/lib/cron`: the stat shows exactly four files.

**A3. Checks on X** (no merge is needed, because X already contains master):
```bash
ln -s /Users/tim/Code/fhfhockey.com/web/node_modules web/node_modules && cd web
```
```bash
env -u GIT_DIR npx vitest run lib/cron __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts __tests__/pages/api/v1/db/cron-report.test.ts __tests__/pages/api/v1/db/cron-auth-boundaries.test.ts scripts/vercel-ignore.test.ts lib/predictions/pipelineCronAlignment.test.ts
```
Record the actual file and test counts. 0 failures are required. The old counts (43 files and 575 tests on base `aa49b6c5e`) are only a reference.
```bash
env -u GIT_DIR npm run typecheck; echo "typecheck exit=$?"
```
`typecheck exit=0` is required. Read the exit code itself: plain `npx tsc` can run out of memory and still look clean. When done, delete the clone by its literal path.

**A4. Record the sign-off.** Append this block to `tasks/artifacts/cross-platform/2026-10-24-coordination/CODEX-TO-CLAUDE.md`. It is your L7 review only; the NST owner posts a separate block.
```text
## BLSH-L7-REVIEW-<YYYYMMDD> · <HH:MM> UTC · Astra (independent L7 reviewer)
Independence: <confirmed / not independent, reason>.
Reviewed X b5e18f49078addde4bda3e5679e5602f8ed58393 (refs/rc/blsh-pilot-redate-20261122-x) against base 523ba01085776f9d2be345028bff919a243f77ae: diff <files> files +<ins>/−<del>.
A2: 1 <ok + line cite>; 2 <…>; 3 <…>; 4 <…>; 5 <…>.
A3: vitest <files>/<files> files, <tests>/<tests> tests passed; npm run typecheck exit 0.
Verdict: PASS for integration in the single keyed BLSH pilot release (push tip must be Y 1efdfb4364dffa73a9c249f382dbfebe22ebbbd2, never X alone) / BLOCKER: <exact file:line and why>.
Not covered: the shared NST owner's admission and rate-limit sign-off; the day-of NST clearance (Mon 11-23 11:05–12:07Z); TJ's A5 line.
```

**References (read only):**
- Packet: `/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/LIVE-PILOT-APPROVAL-PACKET-1efdfb436.md`
- Gate evidence on X: `…/live-pilot-20261121/evidence-rebase-523ba0108/` (`README.md`, `SHA256SUMS`)
- Corrected L7 steps: `/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-readiness-2026-11-14/live-readiness-2026-11-20/STEPS-L7-AND-CUSTODY.md` (see the dated banner at the top)
- FORGE registry verdict on Y: `/Users/tim/Code/fhfhockey.com/tasks/artifacts/daily-offday-release-2026-11-21/blsh-registry-review/VERDICT.md`

Please finish before Sun 2026-11-22 18:45 CT (00:45Z Mon). That is the gap-B deadline for G1; the push is planned for 19:30 CT.
