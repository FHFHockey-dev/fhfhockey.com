# Next-release candidate plan (proposal only)

Nothing here has been run. This plan only uses source that an independent review accepted at exact bytes, and that does not need a path that lacks such acceptance.

## 1. Method: a curated candidate on production, not a merge

Build the next release the way 2026-10-16 was built:
- start from `origin/master` `457435eb`
- add individually accepted paths at their exact accepted bytes
- make a detached candidate commit; no ref or shared index moves until the approved push

**Do not merge octoberBranch into master.** A merge would publish all of this to production `master`:
- 5,536 `tasks/` paths (about 300 MiB, including 75 MiB of npm cache)
- research code
- 202 unreviewed paths
- activation-gated IFTTT intake

## 2. Candidate R1: cron audit outcomes and failure diagnostics (4 paths)

This is the only coherent unit that is independently accepted at exact bytes, whose changed-dependency closure is fully accepted, and that is neither activation-gated nor owner-excluded. Register row 45 already names `569245ef` and `26468a9f` for "the next release scope".

| Path | Production blob | Candidate blob = accepted commit | sha256 | Acceptance |
|---|---|---|---|---|
| `web/lib/cron/withCronJobAudit.ts` | `0a0e7387d284…` | `d604b720d26b5ad522200f695686b457330ee11d` (`569245efd`) | `eb3991f6…aacf` | Master Page: bounded-response fix independently accepted locally |
| `web/lib/cron/withCronJobAudit.test.ts` | `72c124476d66…` | `4df6e369de9aeadf11173326360281885f6cace5` (`569245efd`) | `6ff4e717…1fb7` | same |
| `web/pages/api/v1/db/cron-report.ts` | `d56a3b16bc6e…` | `aa3ef5c55596c4825b255cec8e3b226713339571` (`26468a9fc`) | `f32b78a8…ff93` | Master Page: two-file cron-report fix independently accepted locally |
| `web/__tests__/pages/api/v1/db/cron-report.test.ts` | `658ee2e5a4f4…` | `6725ddac8d0539e3a57a8874751ff7c30425e4bb` (`26468a9fc`) | `a2697143…7685` | same |

Notes:
- Each production blob equals the parent of its accepted commit, so the accepted bytes drop in without a rebase.
- Diff size: +190 / −3 lines.
- **Behaviour change:** every cron route wrapped by `withCronJobAudit` (96 production importers) adds `details.responseTruncated` and `details.responseOutcome` to its `cron_job_audit` row.
  - There is no schema change; these are fields inside the `details` JSON.
  - `cron-report` reads retained failure diagnostics.
- **Deliberately excluded** from R1:
  - octoberBranch's later `cron-report.ts` (`3e991cfa7`) and `cronInventory.ts` (`387fa5cdb`). They only add aliases for the unreleased `refresh-roster-optimizer-schedule` route. They are accepted under schedule-refresh v2 as an engineering proposal, but they belong with that route.
- This does not reopen the NST repairs, the evening cron removal, or the RPC revocation.

**Decision for TJ:** whether R1 is worth one production web build on its own, or should wait and ride with a larger scope. It is small and observability-only.

## 3. Units that are not releasable yet, and what unblocks each

| Unit | Paths | Blocker | Unblocked by |
|---|---|---|---|
| U2 FORGE / RSO / Start Chart / IFTTT graph | 262 connected | Hubs with no accepted current bytes: `contributions.ts`, `sourceSnapshot.ts`, `planningTypes.ts`, `gameExpectations.ts`, `tweetInterpretation.ts`, `rosterScheduleData/types.ts`. Failing tests are owned by the RSO fix session. The independent RSO verdict (`fresh-rso-forge-review-2026-10-16`) found consequential defects. IFTTT intake is activation-gated | All of: an integrated review of one frozen manifest; RSO fixes landed; the Oct 20 FORGE run outcome; explicit activation decisions. Prefer splitting into a default-off FORGE serving slice plus a separate RSO slice |
| U3 migration-record alignment | `20261017183611` migration, `migration-authority.json`, `supportedBaselineMigration.test.ts` | The test also counts the pending `20261011115124` and `20261011160000` files; adding pending SQL to master invites an accidental `db push` | A decision on whether master should carry pending SQL. Purely record-keeping; no runtime effect |
| U4 Social share | 16 | Redistribution-rights decision (register row 62); was part of the not-accepted `1ddef915d` | Rights decision + review |
| U5 In-season commerce | 2 | Pricing, refund and cutoff decisions (row 60); the Master Page claims a 44-test review but there is no hash receipt in the repo | Owner decisions + byte pin |
| U6 SEO | 2 | Owner facts for operator, contact and retention (row 84) | Owner facts |
| U7 Instructions (`AGENTS.md`, `SPRINT-MODE.md`) | 2 | None at runtime | Can ride with any release; on master it gives 0 builds and only ignored entries |
| Research / evidence | 8 | Not for release | Stays on octoberBranch |

## 4. The single verification pass (run once, after scope is frozen)

Run in an exported candidate directory, never in the canonical `web/`. `cleanDistDir` wipes `web/.next`, which TJ's dev server uses. Do not run 2026-10-20 07:00–13:00 ET.

1. **Export without touching refs or the index:**
   ```bash
   mkdir -p /private/tmp/fhf-release-r1/candidate && git -C /Users/tim/Code/fhfhockey.com archive 457435eb | tar -x -C /private/tmp/fhf-release-r1/candidate
   ```
   - Write the four accepted blobs with `git cat-file blob <blob>`.
   - Re-hash them against the table above.
   - Link `web/node_modules` read-only from the canonical checkout.
   - Synthetic environment only, as on 10-16: no `.env*` files.
2. **Focused**, from `candidate/web`:
   ```bash
   npm test -- --run lib/cron/withCronJobAudit.test.ts __tests__/pages/api/v1/db/cron-report.test.ts
   ```
3. **Types and lint**, from `candidate/web`:
   ```bash
   NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
   ```
   ```bash
   npx eslint lib/cron/withCronJobAudit.ts lib/cron/withCronJobAudit.test.ts pages/api/v1/db/cron-report.ts __tests__/pages/api/v1/db/cron-report.test.ts
   ```
4. **Full unit, once**, from `candidate/web`:
   ```bash
   npm run test:full -- --maxWorkers=4
   ```
   Then compare failure identities (file › test name) against the **17 baseline identities** in `checkpoint-production-release-2026-10-16/final-unit-and-baseline-reconciliation.json`:
   - 1 in `CategoryGains.test.tsx`
   - 2 in `RosterScheduleOptimizer.test.tsx`
   - 5 in `planningReproducibility.test.ts`
   - 1 in `supportedBaselineMigration.test.ts`
   - 8 in `qualify-native-players-offline.test.ts`

   Pass if the candidate's failures are a subset of those 17. Any other identity is a **new** failure, and the candidate stops.
5. **Local `next build`: not run for R1.** R1 only changes a server-side wrapper and one API route, with no page, prerender or config surface, so AGENTS.md's "absolutely necessary" bar is not met. If scope grows to include pages:
   - use `checkpoint-production-release-2026-10-16/run-offline-build.py`
   - with `offline-build-guard.cjs`
   - in the candidate directory only

**Baseline versus new failures on octoberBranch.** These do not affect R1, because R1 contains none of these files:
- `planningReproducibility.test.ts`: 10 failures (5 baseline + **5 new**)
- `planning.test.ts`: **2 new** (snapshot schema rejects `powerPlayRole`)
- `__tests__/pages/api/v1/start-chart.test.ts`: **2 new**, including the shared FORGE→Start Chart basis check
- `currentSeasonSogContribution.test.ts`: **1 new**

The source is FORGE LEDGER §9. The RSO/Start Chart fix session owns them, and they gate U2.

## 5. Release mechanics, once approved (approval R in `APPROVAL-REQUESTS.md`)

1. Make a candidate commit whose parent is `457435eb`, with the exact tree recorded.
2. Re-run the read-only Vercel inventory for that exact SHA (expect 0 entries).
3. One ordinary fast-forward push to `master`. Expected entries:

   | Project | Expected entry |
   |---|---|
   | `fhfhockey` (root `web`) | 1 production web build |
   | `fhfhockey.com` | CANCELED (`ignoreCommand: exit 0`) |
   | `cms-fhfhockey` | ignored/CANCELED |
   | `functions-fhfhockey` | ignored/CANCELED |

4. Rollback target: `dpl_6ccUfnYgqnueRsNEbSESqZmSbzPu` (`457435eb`), which is READY. No rebuild is needed.
5. **Smoke check:** do not invoke any cron endpoint. After the next naturally scheduled cron run, do one bounded read-only SQL `SELECT` of the newest `cron_job_audit` rows, checking that `details.responseOutcome` is present. Plus at most two read-only GETs of static routes. Stop once that is conclusive.
6. Then sync octoberBranch from the released commit (AGENTS.md). This is a separate push, under approval P.
