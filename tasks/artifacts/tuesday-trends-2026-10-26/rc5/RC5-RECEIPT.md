# Tuesday Trends release candidate 5 (2026-10-26, local, not pushed)

Supersedes RC4 (`44cc5d63b`, PR #391 held). RC5 contains everything in RC4 plus the team-colour neon logos.

- **RC5 commit** `64f9960573d65ebb42472fa4b57e591638261005`, tree `7b7fd6db4805c3fa82d589db1165aff25a7de6cb`, parent production master `04dca892c` (#390). Pinned at `refs/rc/2026-10-26-tuesday-trends-5`.
- **Scope:** 45 files (`FILES.txt`), +470/−80:
  - 13 social-share source/test/e2e files, including the new `teamNeon.ts` and its test;
  - 32 new baked `web/public/teamLogos/outline/color/*.png`. The single-colour `outline/*.png` are unchanged from master and still used for tinted teams (NSH, TBL, ANA orange variant).
- **Provenance:** the blobs are exact HEAD (`084ae51c3`) blobs from TT-10 (e9b8a801c, e789c3ba6) through TT-11 (d78bb720b), TT-12 (8beaa186b, e123d3c2c) and TT-13 (084ae51c3). For all 45 files, master equals the RC3 blob shipped in #389 (or the file is absent), and no non-TT commit touched them. Import closure, `teamsInfo.ts`, `vars.scss` and `_panel.scss` are identical to master.
- **Runtime reads:** READ-PLAN v3 (M3 TJ-approved, addendum 3), about 15 typical and about 22 worst. The neon colours are static, so they add no reads.

## Gate (clean `git archive` export, symlinked node_modules, under the heavy lock)
| Check | Result |
|---|---|
| Full tsc | exit 0 |
| eslint (social-share dirs + spec) | exit 0 |
| CSS-module pure check | PURE OK |
| Vitest social-share | 241/241 |
| Vitest full | 14230 passed, 50 skipped, 5 failed tests / 6 failed files. This is exactly the known environmental set: five need `.git`, and ArticleReader `next-sanity` fails identically on plain master. RC4's line-sources load timeout did not recur |
| Playwright discovery | 34 tests |
| Playwright execution | not run on the export. Worker: 34/34 on octoberBranch at TT-13 with identical blobs, the v2 pins (18 Mon/Wed byte-identical) and the collision guard |

## Vercel expectation
4 Git-linked projects with previews disabled.
- `chef/` branch push and PR: 0 deployments.
- Squash-merge: 1 fhfhockey production build; cms, functions and root are ignored.
- PR #391 should be closed as superseded, but only with TJ's OK.

## Push, PR, close #391 (TJ approved)
- 2026-10-27T00:17:42Z: pushed `64f996057…` to the new branch `chef/tuesday-trends-rc-5`.
- 00:18:02Z: opened https://github.com/FHFHockey-dev/fhfhockey.com/pull/392, bound with auto-merge **off**.
- Closed #391 without merging, with a supersession comment. The branch `chef/tuesday-trends-rc-4` is kept.
- No-build check at 00:19:52Z: **0 deployments for RC5** and 0 GitHub check-runs or deployments on `64f996057`. #392 is MERGEABLE / CLEAN, 45 files.
  - The check did see 4 deployments for `598942a78`, another lane's release **#393** (RSO) merged to master at 00:18:40Z: fhfhockey BUILDING, the other three CANCELED. These are not from this lane.
- **Master moved** `04dca892c` → `598942a78` (#393, 30 files). No overlap with RC5's 45 files, its direct import closure, or any config/manifest. RC5 was rebuilt on the new master as **RC5b** (same 45 blobs) and is being re-gated locally (`refs/rc/2026-10-26-tuesday-trends-5b`).
- **RC5/RC5b superseded** before merging. The RC5b gate was stopped. The worker committed a COL cutout fix (`ce4ea8b60`), and TJ asked to move the stripes to the card centre (TT-14). A new RC follows TT-14. PR #392 should be closed as superseded once the new PR exists, with TJ's OK.
