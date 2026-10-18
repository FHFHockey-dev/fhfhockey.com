# S-15 diary — 2026-10-18

**Lane:** social-share/SEO, optional. **Owner of record:** this session. **Mode:** sprint, local only.

## Owned files

- Created: `tasks/artifacts/social-share-lane-2026-10-18/**` (this folder only).
- Claimed but **unchanged**: the 18 social/SEO package files listed in `README.md` §1.
- Nothing else touched. No FORGE, RSO, Start Chart, `_app.tsx` or shared layout files. No git mutation.

## Timeline

1. Read the handoff prompt, the sprint register row S-15 and sibling notes (none social).
2. Ancestry: `9a26f4c8` and `2331cc1` exist on side branches and are not ancestors of HEAD. `0a6fed7` is absent from the object store and from every local clone. The master reconciliation register (row 62) had already recorded this.
3. Line presence: all of `9a26f4c8` present; `2331cc1` social lines present or superseded by `71ebb135`; its non-social hunks intentionally excluded. The Oct 8 report (`git show 71ebb135:tasks/social-card-readiness-20261008.md`) documents `0a6fed7` and its deleted `/tmp` repo. The package arrived via `1ddef915d`, and the package is not on `master`.
4. Baseline `npm test` for social + SEO: 27 passed.
5. Built the harness: esbuild bundles the real component (sass → `local-css` loader, single React alias, public assets external), Playwright serves everything from an intercepted `fhfh.local` origin, and the API route returns snapshots built in Node by the package's own `buildScheduleSnapshot`. Fixed along the way: font URLs need `external`; duplicate React; `page.evaluate` takes one argument; harness page overflow came from the missing site `globals.css` (served with remote Google Fonts imports stripped). Fixture opponents now vary per day.
6. Rendered 9 files and checked them visually. The real Download PNG equals the harness capture; two separate runs produced identical 1080 exports.
7. Wrote the contract, rights checklist and README.

## Inclusion check (blob ids, current tree = HEAD for all 18)

```
= 9a26 98539796a2 web/components/SocialShare/SocialShare.tsx
= 9a26 e59e89a119 web/components/SocialShare/SocialShare.module.scss
≠ 9a26 5b250e2b9f web/lib/socialShare/types.ts          (Oct 11 October-reader adapter)
≠ 9a26 3735d1b4bb web/lib/socialShare/schedule.ts       (Oct 11 October-reader adapter)
≠ 9a26 38daa2cc6d web/lib/socialShare/schedule.test.ts  (+3 adapter tests)
= 9a26 fa6328ed9d web/lib/socialShare/server.ts
= 9a26 3198fd1f2c web/lib/socialShare/export.ts
= 9a26 6945c1fcad web/pages/social-share/[format].tsx
= 9a26 e2a332da9b web/pages/api/v1/social-share/[format].ts
= 9a26 3cb790bf9e web/e2e/social-share.spec.ts
= 9a26 1dbec63b6d / 221055572b / 0a44ad4e53  fonts (Martian Mono, Roboto Condensed, Train One)
= 9a26 ec8a477ec9 / bafe4a2cfc / af80b6c36f  OFL texts
= 9a26 8a53818ef6 web/lib/seo.js
≠ 9a26 ae5e123e1f web/__tests__/seo.test.ts             (narrower social path list, +/social-shareable negative)
```

## Open items handed to Chef / TJ

- Rights R1, R2, R4, R7–R9 and operator questions O1–O6 (`rights-checklist.md`).
- Design decisions on findings 1–3 (tie labels, expiry/provider label on the image, feed legibility).
- E2E social spec not run (needs a dev server, which the Game Grid lane owns).
- Re-run the harness after any package change: `node tasks/artifacts/social-share-lane-2026-10-18/harness/render-previews.mjs [outDir]` (about 20 s, no network).
