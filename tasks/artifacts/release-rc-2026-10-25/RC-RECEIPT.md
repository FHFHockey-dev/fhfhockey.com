# Release candidate 2026-10-25 (web only), local, not pushed

- RC commit `8384a8563c9194524dc946b4968d2d1ad0c44918`, tree `b3980d9ad8529797ee8153215fa6aeafb8a45e11`, parent master `0619f9126` (production). It's pinned at `refs/rc/2026-10-25-web`, which is not a branch.
- Built with `git mktree`/`commit-tree`: master's root tree with only the `web` entry swapped for octoberBranch `5ba2117d5:web`. Diff vs master: 118 files, all under web/ (+6266/−1502). tasks/, diaries and .gitignore are not included. There are no package, lockfile, next.config, tsconfig, env or migration changes. Cron/API routes changed: calculate-wigo-stats (500 on rejected upserts, stable order) and forge-served-forecast-snapshot (stage timing, diagnostic).
- Includes this morning's frozen checkpoints from before today's lanes (cards studio and hero portraits, NST mapper, goalie workload evidence seam). The social-share and player-card pages stay behind SocialShareAccessGate (social_editor/admin); the goalie seam is dormant.
- Gate on a clean full-tree `git archive` export, under the heavy lock:
  - tsc: exit 0.
  - eslint: 0 errors, 69 pre-existing warnings.
  - CSS-module pure check: all changed .module.scss pass.
  - vitest: 13732 passed, 50 skipped, 5 failed. Four need `git rev-parse` (the export has no .git); the fifth, RosterScheduleOptimizer.test.tsx ("releaseCache is not a function"), fails only under full-suite load and passes 209/209 three times alone in the same export. All 5 pass in the canonical checkout, whose web tree is identical.
- Reviews: C7 R20–R26 accepted every Claude commit in scope; limits are closed or recorded. PC L3 client-bundle check passed (local, network-denied build).
- Release path, per #380/#381: push a `chef/` branch holding this commit, PR into master, squash-merge, then the production deploy. Every step needs TJ's direct pop-up approval. Do not merge PR #379 (octoberBranch → master).
