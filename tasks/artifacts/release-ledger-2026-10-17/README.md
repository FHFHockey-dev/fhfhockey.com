# FHFH release and integration ledger, 2026-10-17

This was a read-only review. No ref, index, remote, branch, worktree, stash, production or database state was changed. Every git command ran with `GIT_OPTIONAL_LOCKS=0`. The only network calls were `git ls-remote` and read-only GitHub/Vercel GETs. The only writes are the files in this folder.

## Headline

1. **Release state verified:**
   - Production is `457435eb` (tree `15a49218`); local `master` matches it.
   - octoberBranch contains the release through merge `448231eca` (tree `987da54b`). That merge changed only the 4 released auth fixtures.
   - All 37 released paths are byte-identical on octoberBranch.
   - The backup tag `chef/pre-sync-20261017` points to `7f094c8e6`.
   - `f08e5909` is an unused commit object.
2. **Changed during this review:** GitHub's octoberBranch moved to **`ceceb407a`** at about 19:51Z. The three FORGE commits are pushed; this session did not push them. Vercel shows **0 deployments** since 2026-10-17T00Z, and GitHub shows 0 statuses or checks on `ceceb407a`. The local tracking ref is still stale at `448231eca`.
3. **319 non-`tasks/` paths differ from production:**

   | Category | Paths |
   |---|---|
   | Accepted locally at exact bytes | **109** |
   | Candidates needing review | **202** (37 have no receipt at all) |
   | Research / evidence only | **8** |
   | Already in production, parked or unknown | 0 |

   262 of the 319 form one import-connected FORGE/RSO/IFTTT graph, and its hubs have no accepted current bytes. So the old "integrated" label does not make that graph releasable.
4. **Next release:**
   - Only one small unit qualifies: **R1**, the 4 cron-audit and cron-report paths at the exact bytes of accepted commits `569245ef` and `26468a9f`.
   - Everything else waits on integrated review, the RSO test fixes, the 2026-10-20 FORGE run, and owner decisions (rights, pricing, SEO facts).
5. **Preservation:**
   - Counts match the dated evidence: 179 branches, 13 remote heads, 299 archive refs (bundle sha256 re-verified).
   - Worktrees: 104 registrations, of which 76 are prunable `/private/tmp` entries; 28 directories exist.
   - All 44 uncommitted files in the 3 dirty non-canonical worktrees match the 10-12 backups.
   - The backups exist on this disk only.
6. **Cleanup proposal:** stop tracking the npm `_cacache` (478 files, 75 MiB), with a reversible manifest. No deletion and no history rewrite.

## Files

| File | Contents |
|---|---|
| `ANCESTRY-STATE.md` | Ref table, ancestry proof, unreleased commit range with acceptance, artifact classes, hosted-vs-repo state |
| `PATH-LEDGER.md` / `path-ledger.json` | All 319 paths: disposition, evidence code, receipt, blob/sha256, import and manual dependency edges |
| `PRESERVATION-MANIFEST.md` / `preservation-manifest.json` | Branches, worktrees, stashes, tags, bundle, dirty-file hashes, ignored-but-important paths |
| `NEXT-RELEASE-PLAN.md` | R1 scope, deferred units and blockers, the single verification pass, baseline vs new failures |
| `CONFLICTS.md` | 14 exact unresolved conflicts |
| `APPROVAL-REQUESTS.md` | Separate requests: P0 (fetch), P (push), R (release), C1 (offsite backup), C2 (untrack cache), C3 (prune worktrees) |
| `TASKS-CLEANUP-PROPOSAL.md` / `cleanup-manifest-npm-cache.tsv` | Cleanup proposal and its reversible manifest |
| `COST-FOLLOW-THROUGH.md` / `vercel-github-observation.json` | Deployment entries vs builds vs spend, Node 20/22, empty-root project |

## Limits

- `~/Documents/FHFH-private/` was not readable (blocked by the permission classifier), so the evidence codes rest on in-repo receipts only.
- No tests, `tsc` or builds were run. The baseline comes from the 2026-10-16 receipts and FORGE LEDGER §9.
- The canonical working tree is being edited by other sessions; its snapshot is from 19:59:45Z.
- Excluded: Decisions API / Luna, and MEMORY.md cleanup.
