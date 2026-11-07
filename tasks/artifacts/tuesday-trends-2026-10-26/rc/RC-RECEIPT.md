# Tuesday Trends release candidate 2026-10-26 (local, not pushed)

- **RC commit** `42ff0cd2b19859b11e94b51f4fc7131a7b30947a`, tree `cb4e213ecaf409b729ff9a89e48c74b608cde72a`, parent production master `538100d41` (origin/master after fetch at build time). Pinned at `refs/rc/2026-10-26-tuesday-trends` (not a branch).
- **Built with** a scratch index (`GIT_INDEX_FILE`, never `GIT_DIR`): `read-tree 538100d41`, then the 13 TT blobs from HEAD swapped in, then `write-tree` and `commit-tree`. `git diff --name-only 538100d41 RC` is exactly those 13 files (+1260/−383). Each RC blob equals its HEAD blob. Each file's master blob equals its pre-TT base (`cd73cbd69`), so the delta is exactly TT commits 82490cd45, c5829aa9e and 8e755dab8.
- **Excluded:** no tasks/, diaries, other lanes' commits (RSO/FORGE/Astra), manifests, lockfile, migrations, cron or CI. Import closure: every non-TT import of the TT files is identical to master.

## Gate (clean `git archive` export of the RC, web/node_modules symlinked; manifests identical to master; under `/private/tmp/fhfh-heavy.lock`)
| Check | Result |
|---|---|
| Full `tsc --noEmit` (8 GB heap) | exit 0 |
| eslint `lib/socialShare components/SocialShare e2e/social-share.spec.ts` | exit 0 |
| CSS-module pure check, `SocialShare.module.scss` (sass with the web load path + postcss-modules-local-by-default pure) | PURE OK. The first attempt lacked the load path ("Can't find stylesheet"); it was re-run with `loadPaths: [web]` |
| Vitest social (`lib/socialShare`, `components/SocialShare`) | 221/221 |
| Vitest full suite | 13895 passed, 50 skipped, **4 failed**. All 4 fail with `git rev-parse HEAD: not a git repository`, because the export has no .git: `scripts/qualify-native-players-offline`, `lib/projections/{nativeGoalLedgerAudit,nativeIntervalReconciliation,researchGoalBaseline}`. They are unrelated to TT; the 10-25 RC showed the same class |
| Playwright discovery `e2e/social-share.spec.ts --list` | 33 tests |
| Playwright execution on the RC export | **not run**. The worker's 33/33 E2E ran on octoberBranch HEAD with byte-identical TT blobs, not on the master-based tree |

## Vercel inventory (read-only CLI `vercel api /v9/projects`, team `team_KVFicHhQJARTbO6wRD2x6jpq`)
| Project | Root | Git link | Production branch | Preview deployments | Latest deployment (538100d41) | ignoreCommand (repo) | Expected on `chef/` branch push | Expected on squash-merge to master |
|---|---|---|---|---|---|---|---|---|
| fhfhockey (`prj_LV0w…`) | web | FHFHockey-dev/fhfhockey.com | master | disabled | READY production | builds if web/ changed | none | **1 production build** (web/ changed) |
| functions-fhfhockey (`prj_q9tn…`) | functions | same | master | disabled | CANCELED (ignored) | builds only if functions/ changed | none | entry, CANCELED by ignore |
| cms-fhfhockey (`prj_gG8S…`) | cms | same | master | disabled | CANCELED (ignored) | builds only if cms/ changed | none | entry, CANCELED by ignore |
| fhfhockey.com (`prj_3X6g…`) | (root) | same | master | disabled | CANCELED | `exit 0` (always skip) | none | entry, CANCELED |
| web (`prj_LMVY…`) | (root) | **no Git link** | — | — | ERROR 2025-09-25 | — | none | none |
| functions (`prj_gUTz…`) | (root) | **no Git link** | — | — | READY 2025-09-25 | — | none | none |

The Vercel MCP connector returned 403 for this team scope, so the inventory used the npx-cached CLI.

## Release path (each step needs TJ's direct approval)
1. Push the RC as new branch `chef/tuesday-trends-rc` (not octoberBranch, not master). Expected: 0 deployments. Verify about 90 s later with a per-SHA deployment check.
2. Open a PR `chef/tuesday-trends-rc` → master (no deployment; previews disabled).
3. Squash-merge, which gives 1 web production build plus 3 ignored entries. Then a bounded smoke test: TJ's own refresh of `/social-share/tuesday-trends` (it is behind the editor gate) and one Vercel runtime-log read for `[social-share]`.
4. Sync octoberBranch from the released master with an ours-merge that leaves the tree unchanged, under a no-build watch.

Do not merge PR #379 (octoberBranch → master).

## Push (TJ approved directly in a pop-up, "Push chef branch")
- 2026-10-26T16:31:14Z: `git push origin 42ff0cd2b…:refs/heads/chef/tuesday-trends-rc` created a new branch. Nothing else was pushed; octoberBranch and master are untouched.
- No-build check at 16:33:02Z (~108 s after push):
  - Vercel deployments since the push, team-wide: **0**.
  - Vercel deployments for the RC SHA: **0**.
  - GitHub on the RC SHA: commit statuses 0, deployments 0, check-runs 0.
- Not done: PR, merge, production deploy, octoberBranch sync. Each needs its own approval.

## PR (TJ approved: "Open a PR… Do not merge")
- 2026-10-26T17:40:45Z: opened https://github.com/FHFHockey-dev/fhfhockey.com/pull/386 (`chef/tuesday-trends-rc` → `master`). Bound in the app with Auto-fix on and auto-merge **off**.
- Check at 17:41:59Z:
  - Vercel deployments team-wide since the push: **0**.
  - GitHub on the RC SHA: check-runs 0, deployments 0.
  - PR: MERGEABLE / CLEAN, 13 files.
- Not done: merge, production deploy, smoke test, octoberBranch sync.

## Merge and deploy (TJ approved "Merge and deploy")
- 2026-10-26T18:11:07Z: squash-merged PR #386 as master `19890a8cb`. Its tree `cb4e213ec` is identical to the gated RC.
- Vercel deployments for `19890a8cb`, exactly as expected:
  - **fhfhockey READY** production `dpl_BEb4ofmRGPZnnAhVXD2Tx6qdhRk4` (created 18:11:17Z, ready 18:14:59Z).
  - functions-fhfhockey CANCELED `dpl_CPbYh7Fi…`, cms-fhfhockey CANCELED `dpl_4ZfYMGco…` and fhfhockey.com CANCELED `dpl_4fBLDLBb…`, all ignore-step skips (no builds).
- Watcher note: the first background watcher looped on a jq parse error (the commit message has raw newlines in the deployment meta). I stopped it and read the deployments once with a tolerant parser.
