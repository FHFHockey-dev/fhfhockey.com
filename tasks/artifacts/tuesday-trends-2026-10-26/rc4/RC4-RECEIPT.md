# Tuesday Trends release candidate 4 (2026-10-26, local, not pushed)

- **RC4 commit** `44cc5d63bbd30b4898bd7e43e044bd69997189f7`, tree `16804cadbd8f12b74e1fbb162145f403ee89ea11`, parent production master `04dca892c` (#390). Pinned at `refs/rc/2026-10-26-tuesday-trends-4`.
- **Scope:** 10 files (`FILES.txt`), +260/−65: social-share source/test/e2e only. The blobs are exact HEAD blobs from TT-10 part 1 `e9b8a801c` and part 2 `e789c3ba6`. For all 10 files, the master blob equals the RC3 blob that shipped in #389 (2b4f00fa8), and no non-TT commit touched them. Import closure, `vars.scss` and `_panel.scss` are identical to master.
- **Runtime reads:** READ-PLAN v3, about 15 statements typical and about 22 worst. M3 is TJ-approved (READ-APPROVAL addendum 3). Sparkline kill switch: `SOCIAL_SHARE_TUESDAY_SPARKLINES=0`.

## Gate (clean `git archive` export, symlinked node_modules, under the heavy lock)
| Check | Result |
|---|---|
| Full tsc | exit 0 |
| eslint (social-share dirs + spec) | exit 0 |
| CSS-module pure check | PURE OK |
| Vitest social-share | 236/236 |
| Vitest full | 14224 passed, 50 skipped, 6 failed tests / 7 failed files. All are environmental or load-related; details below |
| Playwright discovery | 34 tests |
| Playwright execution | not run on the export. Worker: 34/34 on octoberBranch with identical blobs, the v2 pins (18 Mon/Wed byte-identical) and the collision guard |

**Full-suite failures:**
- The RC3 set (five need `.git`; ArticleReader `next-sanity` fails identically on plain master).
- New: `__tests__/pages/api/v1/db/update-line-sources.test.ts` hit the 5 s default timeout under full-suite load. It **passes 31/31 alone in the RC4 export** and touches no TT file.

## Vercel expectation
4 Git-linked projects with previews disabled.
- `chef/` branch push and PR: 0 deployments.
- Squash-merge: 1 fhfhockey production build; cms, functions and root are ignored.

## Push and PR (TJ approved)
- 2026-10-26T23:15:00Z: pushed `44cc5d63b…` to the new branch `chef/tuesday-trends-rc-4` (master still `04dca892c`).
- 23:15:21Z: opened https://github.com/FHFHockey-dev/fhfhockey.com/pull/391, bound in the app with auto-merge **off**.
- No-build check at 23:17:07Z: Vercel deployments since the push **0**; GitHub check-runs 0 and deployments 0; MERGEABLE / CLEAN, 10 files, head `44cc5d63b`.
- **On hold** (TJ): ship together with TT-11 (team-colour logos) as RC5. Do not merge #391 on its own.
