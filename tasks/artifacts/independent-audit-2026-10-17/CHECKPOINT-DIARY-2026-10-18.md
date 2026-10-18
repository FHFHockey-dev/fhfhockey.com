# Checkpoint diary, 2026-10-18

```text
Diary: S-09 (audit proposals after Patch 01) and Q-03 (site UX / statistical display) / owner: independent-audit session (started by Chef local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41) / written 2026-10-18 at about 19:15 UTC
```

## Outcome and settled decisions

- **Patch 01 v2 is in HEAD** via `0de97e77d`. Apollo is scoped to Comments, notistack loads lazily only on `/db*` and `/auth`, and the redirect toast persists. Not re-opened.
- **S-09 (3 patches, local, uncommitted).**
  - **A:** the homepage no longer ships moment-timezone's zone data. Measured: homepage First Load JS 379.2 → **343.6 kB gz**; route-only JS 1,244 → **513 kB raw**; other routes ±0.
  - **B:** 7 unused direct dependencies plus `@types/formidable` removed.
  - **C:** `npm run typecheck` added (8 GB heap).
  - **Settled:** North American zone labels are identical; outside North America, labels use the offset form (`GMT+1` instead of `BST`). Moment core stays for the homepage calendar.
- **Q-03.**
  - **Classification:** the old findings are reclassified. Fixed: A01, R01, the game page (frozen hashes match), radar (pins match), C01–C03, P05. Fixed in this patch: A05, A06, A03, A02 (lines logo). Present and deferred: the A02 projections header and `statsPlaceholder`, A04 (legacy `/teamStats` with `useTeams`), and P01–P04.
  - **Settled:** the Spinner's spoken label is opt-in (`label` prop), so GameGrid markup is unchanged. Focus uses the design `$focus-color` (3px rgb(255,193,8)).

## Branch, commit, dirty files and file hashes

Branch `octoberBranch`, HEAD `0de97e77d`. Nothing is committed by me. The working tree also holds many other lanes' changes; do not attribute them here.

| SHA256 (first 16) | git | File | Owner |
| --- | --- | --- | --- |
| 6c605589aded3a31 | ?? | web/components/HomePage/homepageTime.ts | S-09 A |
| df95fa2b8989e89f | ?? | web/components/HomePage/homepageTime.test.ts | S-09 A |
| bd614af56b5b353a | M | web/components/HomePage/homepageGameFormatting.ts | S-09 A |
| 3e4171b507c35856 | M | web/components/HomePage/HomepageStandingsInjuriesSection.tsx | S-09 A |
| b4bb395e97e0dce5 | M | web/components/HomePage/HomepageGamesSection.tsx | S-09 A |
| 73884547a17befc4 | M | web/pages/index.tsx (only the `import "moment-timezone"` removal is mine) | S-09 A |
| fc904bdc9e3a058e | M | web/package.json (B removals plus C script) | S-09 B and C |
| fe7b9cac6900e841 | M | web/package-lock.json | S-09 B |
| 39675d9156e37e3a | M | web/components/Spinner/Spinner.tsx | Q-03 |
| df29dd551c903115 | M | web/components/Spinner/Spinner.module.scss | Q-03 |
| f864fef2cafd3719 | ?? | web/components/Spinner/Spinner.test.tsx | Q-03 |
| a740414f31f79b62 | M | web/components/Comments/Comments.tsx (`label="Loading comments"`) | Q-03 |
| 73b73857471187fe | M | web/pages/lines/[abbreviation].tsx | Q-03 |
| 38ef9ff93881171e | M | web/pages/lines/[abbreviation].module.scss | Q-03 |
| 0ffc9b3832e50d95 | ?? | web/__tests__/pages/lines/abbreviation-header.test.tsx | Q-03 |
| 576ae2416e0a0fe0 | M | web/pages/underlying-stats/playerStats/playerStats.module.scss (3 appended classes) | Q-03 |
| 3b8f13322ebc6e6c | M | web/pages/underlying-stats/teamStats/index.tsx | Q-03 |
| 31b455cdae317287 | M | web/__tests__/pages/underlying-stats/teamStats/index.test.tsx | Q-03 |
| 259d29e45e50436e | M | web/styles/globals.css | Q-03 |
| a5dbf2d78614b5e3 | ?? | web/__tests__/styles/globalFocus.test.ts | Q-03 |

## Changes and evidence paths

All four patches pass `git apply --check --cached` against HEAD, and each is fully present in the tree.

- `s09/s09-a-homepage-without-moment-timezone.diff`, `s09/s09-b-remove-unused-dependencies.diff` and `s09/s09-c-typecheck-script.diff`.
  - Notes: `s09/README.md`.
  - Data: `s09/first-load-{before,after}.tsv`.
  - Job script: `s09/s09-heavy.sh`.
- `q03/q03-a11y-status-and-focus.diff` (12 files). Notes: `q03/README.md`, with the full classification table.
- The audit itself: `README.md`, `REPORT.md`, `BACKLOG.md`, `BASELINE.md`, `CLEANUP-MANIFEST.md`, `PATCH-PROPOSAL-01.md` and `browser-checks/` (Patch 01 probes).

## Tests (run from `web/`, with synthetic env `NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid` and dummy keys)

**S-09 A:**
- `npx vitest --run components/HomePage __tests__/index.test.tsx`: **63/63 passed**.
- The parity file rerun with `TZ` set to America/Los_Angeles, Europe/London and Asia/Tokyo: **48/48 each**.
- ESLint on the 6 files: exit 0.

**S-09 B:**
- `npm ls --package-lock-only --all`: exit 0.
- Lockfile: 1,629 → 1,609 entries, 0 added.
- Zero app references to any removed package or its 12 orphaned transitives.
- **UNVERIFIED:** `npm uninstall --package-lock-only` was used, so the shared `node_modules` still contains the removed packages. **A clean `npm ci` has NOT been run**, so nothing has proven that the app builds without them installed. Running it requires reinstalling `node_modules`, which the sprint forbade (`npm install`), and it affects every session.

**S-09 C:** under the lock, `npx tsc --noEmit` **aborted with a heap OOM** (exit 134, 31 s); `npm run typecheck` completed in 54 s. At that time, 2 errors came from another lane's `ingest-projection-inputs.ts`. They were gone by the Q-03 pass.

**Q-03:**
- **Focused:** `npx vitest --run components/Spinner/Spinner.test.tsx __tests__/pages/lines __tests__/styles/globalFocus.test.ts __tests__/components/Comments.test.tsx __tests__/pages/underlying-stats components/WiGO/GameScoreLineChart/index.test.tsx __tests__/pages/blog.test.tsx`: **70/70**.
- **Spinner callers:** `components/GameGrid __tests__/components/GameGrid __tests__/pages/game-grid components/SustainabilityVSCareerChart components/TimeOnIceChart components/WiGO __tests__/pages/variance`: **343/343**.
- **Candidate sweep before the edits** (auth, game, radar, stats, lines, underlying-stats, `__tests__/pages/api`): **1,581 passed, 1 skipped, in 183 files**.
- **RED check:** the team-explorer assertions fail 3 of 7 against HEAD and pass 7 of 7 with the fix.
- **ESLint:** exit 0; the two `<img>` warnings in `lines/[abbreviation].tsx` were already there.
- **Locked full typecheck:** `tsc --noEmit` with an 8 GB heap, exit 0, 0 errors, 53 s.
- **Locked compile build:** `PLAYWRIGHT_ISOLATED_NEXT=1 PRESERVE_NEXT_DIST=1 next build --experimental-build-mode=compile`, exit 0, 38 s.

**Not run:**
- browser, keyboard or screen-reader checks (no dev server allowed);
- `npm run test:full`;
- `npm ci`;
- a production build with prerendering;
- any production or live-data verification.

## Status, acceptance remaining and blockers

**S-09:**
- A is ready for review.
- B is blocked on a clean `npm ci` with `typecheck`, `test:full` and a build.
- C is ready. The AGENTS.md typecheck command still needs updating by its owner.

**Q-03:** a statically verified local patch, **not** browser-verified. Still to check:
- Tab and Enter/Space on the lines logo button.
- The focus ring at 320, 390, 768 and 1440 px.
- Reduced-motion spinner rendering.
- The "Loading comments" announcement.
- Rendered-pixel contrast.
- A visual pass on the A03 change: text inputs without their own focus style now show the ring on mouse click as well.

**Deferred, needing an owner or a decision:**
- **A02, projections sort header:** confirm with S-13 first.
- **A02, `statsPlaceholder`:** retire or fix (a product call).
- **A04:** `useTeams` must expose errors.
- **P01–P04.**

**Other lanes:** the audit backlog items written up for other lanes are listed in `s09/README.md`, under "Deferred".

## Operations

| Operation | State | Evidence |
| --- | --- | --- |
| S-09 heavy job `bks45joia` | finished | exit 0; lock 18:51:12–18:53:56 UTC |
| Q-03 heavy job `b2oky8nml` | finished | typecheck exit 0, build exit 0; lock 19:05:02–19:06:33 UTC |
| Monitors `bzbmk161o`, `bs41ikubd` | ended with their source | — |
| Heavy lock `/private/tmp/fhfh-heavy.lock` | **not held** | verified absent |
| Dev servers | none running | port 3107 servers from Patch 01 were stopped 2026-10-17 |
| `web/next-env.d.ts` | at HEAD | verified |

## Ownership held, and safe transfer or release conditions

This lane holds the 20 files in the hash table, and only for the hunks in the four patches.

- Another owner may take them over after confirming the hashes above, or by checking that `git apply -R --check <patch>` succeeds.
- To release a patch without keeping it: `git apply -R <patch>`. For B, then also restore `package.json` ordering by applying C on its own if C should stay.
- `pages/index.tsx` and `package.json` also carry other lanes' edits, so reverse only with the patch files, never `git checkout`.

## Next command (within authorization: no commit, no `npm install`)

```bash
cd /Users/tim/Code/fhfhockey.com && for p in tasks/artifacts/independent-audit-2026-10-17/s09/*.diff tasks/artifacts/independent-audit-2026-10-17/q03/*.diff; do git apply -R --check "$p" && echo "present: $p"; done
```

Then, once a browser session or `npm ci` is authorized, run the Q-03 browser checklist above, and verify S-09 B with `npm ci`, then `npm run typecheck`, then `npm run test:full`. Run each of these behind the heavy lock.

## Receiving owner, handoff verification and outstanding diary work

- **Receiving owner:** Chef (local_08a0bf1c) or the next assigned lane.
- **Verify first:** compare the hash table and run the `git apply -R --check` command above before editing any of these files.
- **Outstanding:** none for the diary. The audit `README.md` and `q03/README.md` are current.
