# Crease Shift: team filter, exact games window, rows that grow (2026-11-11, Claude)

## Scope
Social Share Crease Shift (SS 8.0) only. Started by the Social Share Chef session (local_c4fd32c8). TJ settled the spec by pop-up 2026-11-11.
- `window` becomes a number field (1 to 84, default 10), legacy "5"/"10"/"20" still parse. `minComparisonGames` max 84.
- New `teams` field: up to 12 picks from the 32 active teams; blank = top 12 by shift (today's behaviour).
- Picked teams always show; ranked first by league rank; unranked print RK/PTS "—" with the reason in pageNotes.
- 1 to 4 rows grow (logo, type, chart) so the 1080 square has no empty band.

## Where
- Branch `octoberBranch`, canonical checkout. Owned: `web/lib/socialShare/modules/creaseShift{,.sources,.test}.ts`,
  `web/components/SocialShare/modules/CreaseShiftCard.{tsx,module.scss}`, Crease parts of `web/e2e/social-share-crease-category.spec.ts`.
- Shared (minimal, reported): `web/components/SocialShare/PostStudio.tsx` (checkbox disabled rule), `PostStudio.module.scss`
  (dim a disabled box's label), `web/lib/socialShare/modules/contract.ts` (type only: `maxChoices`).
- Renders: `tasks/artifacts/crease-shift-filters-2026-11-11/` (before/, after/, option-side-by-side/side/, sheets/). Untracked.
- Temporary harness `web/e2e/zz-crease-renders.tmp.spec.ts`: never commit; moved to the artifacts folder at the end.
- Isolated dev server: `PLAYWRIGHT_ISOLATED_NEXT=1 NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid npx next dev -p 3117` (stop by exact PID).

## State / checks
- 11-11: DB SELECT counts (bounded, read only): 20232024 goalie 2797 / team 2624; 20242025 2764 / 2640;
  20252026 2940 / 2788 (team rows include playoffs, through 2026-06-11). 84 games = 1,344 games, 2,688 team rows; plus playoffs
  ~2,900 > the old 2,800 team cap, so team cap raised to 3,000. Goalie 3,400 still covers ~3,010.
- TJ approved by pop-up: stacked rows for 1-4 teams (vs side by side at 3-4), long-window charts (no dots under 14px slots), controls.
- Vitest: creaseShift + goalieGsax + contract + PostStudio pass (130); all Social Share unit tests pass (1,324).
- e2e `social-share-crease-category.spec.ts` against :3117: 25 passed.
- CSS Modules pure check (sass + postcss-modules-local-by-default pure): both stylesheets ok; script in session scratchpad `pure.cjs`.
- `npm run typecheck`: exit 0. `npm run lint`: 0 errors (69 existing warnings, none in touched files).
- Crease e2e re-run on final files: 11 passed. Dev server :3117 stopped by PID (92765/92787/92788).
- Commit `5ae1037cc` on octoberBranch (9 files, explicit pathspecs). Not pushed.
- Harness moved to `tasks/artifacts/crease-shift-filters-2026-11-11/render-harness.spec.ts.txt`.

## Next
Chef verifies `5ae1037cc` and releases. Keep this diary until the Chef accepts.

## Blockers / approvals
- None. No push/deploy (Chef releases).
- `web/next-env.d.ts` was already modified at session start; it now references `.next-playwright` (next dev rewrites it on start). Not committed.

## Insights
- `teams` must be a server field (not clientOnly): snapshot `teams` (logos) and pageNotes are built on the server.
- Export token is page-only (not stored), so `window` turning into a number only changes the token string.
- Stacked header is 21px (15px head) and the table is 818px: rows budget 797. The old 820 budget only worked for side-by-side.
- `expectBodyFilled` cannot see a table overflowing into the note or an empty band inside a row; `expectCreaseRowsFilled` checks both.

- Chef outcome (2026-11-11): accepted 5ae1037cc; release pending TJ. Retire this diary once it ships.
- Chef outcome (2026-11-11): released as #428 (master d8e336d75). Lane closed; diary can be retired.

## Follow-up 2026-11-11: plain-words labels (Chef, TJ's pop-up decisions)
- Scope: SHARE → LAST n, PREV n GP → PRIOR n / SEASON (season GP in the subtitle), PTS → CHANGE with ▲/▼ in the row's colour,
  a plain-words subtitle at the top of the card body, a plain-words note; evidence.sample and altText follow. Same owned files.
- Where: octoberBranch (after #428 sync, HEAD 3e81061cb). `creaseShiftWords(data)` in creaseShift.ts feeds headers, subtitle,
  note, evidence and alt. Alt keeps the "FHFH Crease Shift: " prefix: postedWeek.test.ts pins it (matcher regex is /^Crease Shift\b/).
- Heights: subtitle 22px/1.2 + 5px gap = 32px. ROWS_HEIGHT 820 → 768 (now the real side-by-side row budget: 786 table − 18 head),
  STACKED_HEIGHT 790 → 758. Measured: table 786, no overflow, charts 8-10px clear of the note, slack ≤ 15px, at 1/2/3/4/5/12 teams.
- Arrows: the share font has no ▲/▼ (fontTools cmap); fallback glyph was heavier than the digits, so `.arrow` is 0.72em.
  Full-size kept as an option render. Stacked per-row "n GP" label raised 13 → 17px to read beside 25-34px rows.
- Note drops "Describes past starts only" → "Past starts only." to fit one line (175 chars, measured fit; e2e checks no clip).
- Checks: crease unit 56 pass; all Social Share unit 1,328 pass; typecheck exit 0; lint 0 errors (69 old warnings);
  pure CSS ok; crease/category e2e 26 pass then crease 12 pass on final code (isolated :3117).
- Renders: `tasks/artifacts/crease-shift-filters-2026-11-11/labels/{before,after,option-full-arrows,sheets}`.
  Temp harness `web/e2e/zz-crease-labels.tmp.spec.ts`: never commit; move to labels/ at the end.
- TJ approved by pop-up: layout as rendered (grey subtitle), smaller arrows, note ending "Past starts only.".
- Commit `7a1fa1a23` on octoberBranch (5 owned files, explicit pathspecs; no shared files touched). Not pushed.
- Harness moved to `labels/render-harness.spec.ts.txt`. Dev server :3117 stopped by PID (33643/33664/33665).
- Next: Chef verifies `7a1fa1a23` and releases. Keep this diary until it ships.

## Chef outcome (labels follow-up)
- 7a1fa1a23 released as #429 (master 1cdb1dc8f), production READY, smoke 200 x4; octoberBranch ca68aba61 pushed. Lane diary retirable once TJ archives the session.
