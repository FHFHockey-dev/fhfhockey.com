# Tuesday Trends release candidate 3 (2026-10-26, local, not pushed)

Supersedes RC2 (`24680c3de`, never pushed).

- **RC3 commit** `d001d9112480dd2798f16772fbe70712ad56e50c`, tree `5de0c48676f1e16163f9e6828cbbc635c750638c`, parent production master `65a02acb1` (#388). Pinned at `refs/rc/2026-10-26-tuesday-trends-3`.
- **Scope:** 50 files (`FILES.txt`), +843/−99:
  - 13 social-share source/test/e2e files;
  - 32 `teamLogos/outline/*.png` (v2.5);
  - `OTT.png` (new) and `OTT-2.png` (legacy);
  - `Tomorrow-SemiBoldItalic.ttf` and `tomorrow-OFL.txt` (TJ-approved download from google/fonts);
  - `web/styles/vars.scss`, one added line: `$font-family-sporty`.
- **Provenance:** every blob is the exact HEAD blob (`2b4f00fa8`) from TT-4 to TT-9 and logo commit e6e5798bf. For all 50 files, the master blob equals the released TT-3 blob (8e755dab8) or is absent, and no non-TT commit touched them. Import and SCSS closure (incl. `styles/_panel.scss`, `TransactionTrends/OwnershipSparkline`) is identical to master.
- **Runtime reads:** READ-PLAN v2, sparklines on by default (READ-APPROVAL addendum 2). `SOCIAL_SHARE_TUESDAY_SPARKLINES` is not set on Vercel; set it to `0` to turn them off.

## Gate (clean `git archive` export, symlinked node_modules, under the heavy lock)
| Check | Result |
|---|---|
| Full tsc | exit 0 |
| eslint (social-share dirs + spec) | exit 0 |
| CSS-module pure check | PURE OK |
| Vitest social-share | 231/231 |
| Vitest full | 14207 passed, 50 skipped, 5 failed tests / 6 failed files. All are environmental and the same set as RC2: five need `.git`, and ArticleReader `next-sanity` fails identically on a plain master export |
| Playwright discovery | 34 tests |
| Playwright execution | not run on the export. Worker: 34/34 on octoberBranch with identical blobs, v2 pins (18 Mon/Wed byte-identical) and the tile-collision guard |

## Vercel expectation
4 Git-linked projects with previews disabled.
- `chef/` branch push: 0 deployments.
- PR: 0 deployments.
- Squash-merge: 1 fhfhockey production build; cms, functions and root are ignored or CANCELED.

## Push and PR (TJ approved: "Push RC3 as new branch chef/tuesday-trends-rc-3 and open a PR into master; verify 0 deployments")
- 2026-10-26T20:33:35Z: pushed `d001d9112…` to the new branch `chef/tuesday-trends-rc-3`. master was still `65a02acb1`.
- 20:33:57Z: opened https://github.com/FHFHockey-dev/fhfhockey.com/pull/389, bound in the app with Auto-fix on and auto-merge **off**.
- No-build check at 20:35:39Z: Vercel deployments team-wide since the push **0**; GitHub check-runs 0 and deployments 0 on the SHA. PR is MERGEABLE / CLEAN, 50 files, head `d001d9112`.
- Not done: merge, production deploy, smoke test, octoberBranch sync.

## Merge and deploy (TJ approved "Squash-merge PR #389")
- 2026-10-26T20:50:42Z: squash-merged PR #389 as master `74a6e7d04`. Its tree `5de0c4867` is identical to RC3.
- Deployments for `74a6e7d04`, as expected:
  - **fhfhockey READY** production `dpl_BShSQSBknDJ7KjY9UtUcH1kM3hvY` (20:50:49 → 20:55:02Z);
  - cms-fhfhockey CANCELED `dpl_2cSrFnRx…`, functions-fhfhockey CANCELED `dpl_FMU1ChP2…` and fhfhockey.com CANCELED `dpl_FxshViVv…`, all ignore-step skips.
- Next: SMOKE-PLAN-2.md, which needs TJ approval before any production request.

## octoberBranch sync (TJ approved)
- Ours-merge of origin/master `74a6e7d04` into octoberBranch as `9b462e9c9`. The tree is unchanged: all 50 release files were already byte-identical to HEAD.
- Vercel was re-checked right before the push: the 4 Git-linked projects have previews disabled and production on `master`; `web` and `functions` have no Git link.
- Pushed at 2026-10-26T21:14:33Z (`38ca8bcce..9b462e9c9`). This included the worker's TT-9 follow-up `2b4f00fa8`.
- No-build check at 21:16:12Z: 0 Vercel deployments; GitHub check-runs 0, deployments 0, workflow runs 0. octoberBranch is in sync with origin.
