# S-15 social-share lane — 2026-10-18

Local only. No commits, posting, provider, DB or Vercel calls. Sample exports are synthetic and stamped **NOT FOR POSTING**.

| File | Contents |
| --- | --- |
| `README.md` | Package inclusion, verification, findings, release checklist, decisions |
| `edition-contract.md` | Per-edition source/clock contract and weekday qualification map |
| `rights-checklist.md` | Rights/redistribution by source, plus owner questions |
| `harness/` | Node + Playwright renderer (`render-previews.mjs`), synthetic fixtures, esbuild entries |
| `exports/` | Sample PNGs plus `manifest.json` (hashes, clocks, geometry, checks) |
| `DIARY.md` | Lane diary |

## 1. Package inclusion status

**The social/SEO package is fully installed on `octoberBranch` and committed.** It arrived through `1ddef915d` ("10/11"), not by ancestry, and none of the three cited commits is an ancestor of HEAD.

| Commit | Where | Inclusion in HEAD `0de97e77d` | Action |
| --- | --- | --- | --- |
| `9a26f4c8` (reviewed social candidate, branch `chef/social-card-readiness-20261008`) | Local branch; its `/tmp` worktree and evidence directory are gone | **Fully included.** All added lines are present (35/35, 4/4). 14 of the 18 package files are byte-identical. The other four (`types.ts`, `schedule.ts`, `schedule.test.ts`, `seo.test.ts`) are the Oct 11 adaptation to the October reader shape (`retrievedAt`, team/day indexed rows) plus a narrower SEO test list. | Do not re-apply |
| `71ebb135`, `a2f94e1f` (same branch) | Same | Included (social files; `/social-share` is in `NOINDEX_PATHS`) | Do not re-apply |
| `b1346a24` (same branch: additive NHL reader metadata) | Same | **Not applied, superseded.** HEAD's reader supplies `retrievedAt`, `startTimeUTC` and `gameState`, and the social adapter consumes those instead | None |
| `2331cc1` (original studio, `chef/social-share-tools`) | Worktree `~/.codex/worktrees/social-share-tools` | Social files superseded by `71ebb135`. Its non-social hunks were deliberately not carried: `calcWinOdds` excluded-days, `vars.scss` share tokens (now local to the module), the `cssTestingGrounds` showcase entry, `fhfh-styles.md` and the PRD/task files | Do not apply. The PRD text survives only on that branch. |
| `0a6fed7` (production-base port) | **Not in any local repository.** It lived in standalone `/tmp/fhf-social-share-foundation-20261005`, now deleted | The Oct 8 report records its `calcWinOdds.ts` as byte-identical to `2331cc1`'s and says it was not cherry-picked | Unrecoverable locally. Nothing indicates unique social content. |

The 18-file package (current blob ids are in the inclusion check in `DIARY.md`):

- `web/components/SocialShare/{SocialShare.tsx,SocialShare.module.scss}`
- `web/lib/socialShare/{types,schedule,schedule.test,server,export}.ts`
- `web/pages/social-share/[format].tsx` and `web/pages/api/v1/social-share/[format].ts`
- `web/e2e/social-share.spec.ts`
- `web/public/fonts/social-share/` (3 fonts + 3 OFL texts)
- `web/lib/seo.js` and `web/__tests__/seo.test.ts`

**No package file was changed in this lane.**

## 2. Verification run

| Check | Result |
| --- | --- |
| `npm test -- --run lib/socialShare/schedule.test.ts __tests__/seo.test.ts` | **Passed**, 27 tests |
| Harness renders (`node tasks/artifacts/social-share-lane-2026-10-18/harness/render-previews.mjs`), using the real `SocialShare` component bundled by esbuild in headless Chromium, with no dev server and every non-local request aborted | **Passed.** 0 external requests. |
| Contract checks on frozen editions (manifest `checks`): weekly ready; provider update unknown; remaining-week defaults to Thu–Sun; counts only future selected games; a 22:30 ET Wednesday game stays Wednesday; all-days reselect excludes elapsed Mon/Tue; unknown game state → partial; a re-render is a new edition, not a renewal | **8/8 passed** |
| 1080 geometry for all 5 exports: 1080×1080 PNG, no element outside the square or the 48px safe area, no horizontal text overflow, all three share fonts loaded, long names (Columbus Blue Jackets, Montréal Canadiens) on one line | **Passed** |
| Real `downloadSharePng` export vs harness capture (3 ready editions) | **Byte-identical** |
| Determinism: repeat capture in-session, and two separate browser launches | **Byte-identical** for all 1080 exports. Full-page studio screenshots are not byte-stable (not exports). |
| Mobile studio at 390px and 320px | No horizontal page overflow |
| Export gate: partial and expired editions show UNRANKED / PREVIEW ONLY with Download disabled; `tuesday-trends` shows "Source qualification required" and makes no API call | **Passed** |
| `web/e2e/social-share.spec.ts` (Playwright) | **Not run.** It needs `npm run dev:stable`, and the dev server belongs to the Game Grid lane. |
| tsc / lint / build | Not run (no web source changed) |

## 3. Sample exports (`exports/`, all SYNTHETIC)

| File | Edition | Path |
| --- | --- | --- |
| `weekly-top3.png` | Weekly, Mon 10:00 ET, ready | Real Download PNG |
| `weekly-team-focus-cbj.png` | Weekly, team focus with itinerary | Real Download PNG |
| `remaining-week-top3.png` | Remaining week, Wed 12:00 ET, Thu–Sun | Real Download PNG |
| `remaining-week-partial.png` | One Thursday game with unknown state | Harness capture (gate closed) |
| `weekly-expired.png` | Weekly rendered 1 min after `expiresAt` | Harness capture (gate closed) |
| `weekly-top3-feed-390.png` | Export downscaled to a 390px feed | Screenshot |
| `studio-mobile-390.png`, `studio-mobile-320.png` | Studio page on phones | Screenshot |
| `tuesday-trends-blocked.png` | Blocked weekday format | Screenshot |

The harness adds red top and bottom bands (synthetic / partial / expired + edition id) inside the 48px padding, outside the content safe area.

## 4. Findings (not fixed: product or design decisions)

1. **Ties shown as strict ranks.** In both synthetic editions the top three tie on score (19.5 and 8.8) but display as #1/#2/#3, ordered alphabetically. Option: show "T-1" for tied scores.
2. **The image has no expiry and no provider-update label.** The square shows "NHL schedule checked" and "Remaining after", but not "valid until" or "provider update unknown"; only the studio page shows those. The handoff asks for source/expiry labels on exports.
3. **Footer is unreadable at feed size.** The smallest text is 24px at 1080, which is about 8.7px at a 390px phone feed width. The check time, selection and basis lines are effectively unreadable on phones, though the title and metrics are fine.
4. **No current real-source evidence.** The Oct 8 real-source checks and captures were in deleted `/tmp` folders. A fresh real edition needs an approved retrieval.

## 5. Approval-ready release checklist (all unchecked)

- [ ] R1/R2 answered: NHL schedule redistribution and team-name use (`rights-checklist.md`)
- [ ] O1–O4 answered: destinations, operator, per-post approver, attribution/disclaimer wording
- [ ] Decisions on findings 1–3 (tie labels, expiry/provider label, feed legibility), with any change re-verified by this harness and the unit tests
- [ ] Fresh real edition under an approved local read: state `ready`, `expiresAt` in the future at export time, provider update shown as unknown
- [ ] `web/e2e/social-share.spec.ts` run against a local server when one is free
- [ ] Image + alt text + destination + timing approved by TJ for each post; posting done separately from this repository
- [ ] Release of the package itself (it is in `octoberBranch` and not yet on `master`) follows the normal release ledger and Vercel cost rules
