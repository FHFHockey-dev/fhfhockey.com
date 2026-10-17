# Approval requests: one per mutation, each a separate yes

Nothing below has been done. Each request names its exact scope, its preconditions and its expected external effect.

- None may run during the scheduled FORGE window, 2026-10-20 07:00–13:00 ET.
- None may run while another session holds the files involved.

---

### P0. Refresh the stale tracking ref (local only)
Run `git fetch origin` in `/Users/tim/Code/fhfhockey.com`, with no `--prune`.
- **Effect:** `refs/remotes/origin/octoberBranch` goes from `448231eca` to `ceceb407a`. Other remote-tracking refs refresh. No branch, index or worktree changes.
- **External:** one read from GitHub.
- **Why:** sessions reading the stale ref think three commits are unpushed (`CONFLICTS.md` #2).

**Approve P0?**

### P. Next octoberBranch push (together with TJ, per the standing rule)
Push the exact fast-forward from `ceceb407a` to a named new SHA.
- **Before:** TJ and Claude re-check that all four Vercel projects still have previews disabled.
- **After:** confirm 0 new deployment entries.
- **External:** public GitHub update. Expected 0 builds.
- **Note:** octoberBranch is **already** at `ceceb407a` on GitHub. No push is pending from this ledger.

**Approve P for SHA ______?**

### R. Release candidate R1 to production `master`
Create a candidate commit on `457435eb` containing exactly these four blobs (`NEXT-RELEASE-PLAN.md` §2):

| Path | Blob |
|---|---|
| `withCronJobAudit.ts` | `d604b720` |
| `withCronJobAudit.test.ts` | `4df6e369` |
| `cron-report.ts` | `aa3ef5c5` |
| `cron-report.test.ts` | `6725ddac` |

- **Gate:** the §4 verification pass, with candidate failures a subset of the 17 baseline identities.
- **Push:** one ordinary fast-forward to `master`.
- **Expected:** 1 web production build plus 3 canceled entries.
- **Rollback:** `dpl_6ccUfnYgqnueRsNEbSESqZmSbzPu`.
- **Smoke:** no cron invocation. One bounded read-only `SELECT` of the newest `cron_job_audit` rows after the next natural run, plus at most two static GETs.
- **Then:** octoberBranch is synced from the released commit, under P.

**Approve R as specified?** (Or: defer R1 to ride with a larger scope.)

### C1. Off-machine copy of the recovery material
Copy these to a destination TJ names:
- `.git/fhf-reconciliation/20261012-1621/` (bundle `bae1028c…` plus worktree backups 000/083/097/104)
- the `chef/pre-sync-20261017` tag (as a bundle)

**Effect:** none on the repo; files are only copied. This removes the single-disk risk in `PRESERVATION-MANIFEST.md` §3.

**Approve C1, destination ______?**

### C2. Stop tracking the committed npm cache (`TASKS-CLEANUP-PROPOSAL.md`)
One octoberBranch commit:
- `git rm -r --cached` of `…/approved-dependency-audit/cache/` (478 files, 75 MiB)
- `.gitignore` guard lines

- Not affected: the files on disk, and history.
- **Reversible** with `cleanup-manifest-npm-cache.tsv`.
- **External:** only when pushed under P. Expected 0 builds.

**Approve C2?**

### C3. Prune stale worktree registrations
Run `git worktree prune` for the **76** registrations whose `/private/tmp` directories no longer exist.

- **Precondition, verified 2026-10-17:** every one of those HEADs is reachable from a ref, and the 10-12 archive refs hold the original worktree heads.
- **Not touched:** the 28 existing worktrees, any branch, any stash, the `.codex` worktrees.
- **Effect:** removes administrative entries under `.git/worktrees/` only.

**Approve C3?** (It can wait indefinitely; it costs nothing to keep.)

---

Explicitly **not** requested: deleting any branch, tag, stash, archive ref, worktree directory or `tasks/` evidence; any history rewrite; any Vercel settings change; any database write.
