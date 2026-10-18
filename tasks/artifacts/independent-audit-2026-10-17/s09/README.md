# Sprint lane S-09: the next audit proposals after Patch 01

All work is local and uncommitted. Base: `0de97e77d` ("checkpointing"), which already contains Patch 01 v2. Each change is its own patch, and each applies to HEAD on its own (`git apply --check --cached`).

| Patch | Proposal | Files |
| --- | --- | --- |
| [s09-a-homepage-without-moment-timezone.diff](s09-a-homepage-without-moment-timezone.diff) | Audit F7 / backlog #8: the homepage stops shipping moment-timezone's zone database | `web/components/HomePage/{homepageTime.ts (new), homepageTime.test.ts (new), homepageGameFormatting.ts, HomepageStandingsInjuriesSection.tsx, HomepageGamesSection.tsx}`, `web/pages/index.tsx` |
| [s09-b-remove-unused-dependencies.diff](s09-b-remove-unused-dependencies.diff) | Audit F11 / backlog #12: drop unused direct dependencies | `web/package.json`, `web/package-lock.json` |
| [s09-c-typecheck-script.diff](s09-c-typecheck-script.diff) | Audit F13 / backlog #14: a typecheck command that does not run out of memory | `web/package.json` |

## Results (2026-10-18; heavy jobs ran under `/private/tmp/fhfh-heavy.lock`, held 18:51:12–18:53:56 UTC)

### S09-A: homepage without moment-timezone

- **Change.**
  - The new `homepageTime.ts` uses `Intl.DateTimeFormat` to replace every moment-timezone call on the homepage: start-time and playoff labels in the viewer's zone, New York standings and transaction dates, and the New York opening-night target and label.
  - The two side-effect `import "moment-timezone"` lines in `pages/index.tsx` and `HomepageGamesSection.tsx` are removed.
  - Moment core stays where the calendar uses it.
  - No client module relies on moment-timezone patching moment globally; checked by grep for `.tz(` users.
- **Measured, with isolated compile builds before and after in one locked job and only S09-A's five edits toggled:**

  | Measure | Before | After | Change |
  | --- | ---: | ---: | ---: |
  | Homepage First Load JS (gz) | 379.2 kB | **343.6 kB** | −35.6 kB |
  | Homepage route-only JS (raw) | 1,244 kB | **513 kB** | −731 kB (−59%) |
  | Zone-data chunk on the homepage | present (`0b62e0ef-*.js`) | none | — |
  | All 78 other routes | — | — | ±0.0 kB |

  Data: `first-load-before.tsv`, `first-load-after.tsv`.
- **Tests.**
  - All 63 homepage tests pass, in `components/HomePage/*` and `__tests__/index.test.tsx`.
  - The new `homepageTime.test.ts` compares the new code with moment-timezone itself: 13 North American zones × 10 instants for both formatters (260 comparisons) across the 2026-11-01 and 2027-03-14 DST changes, plus New York date and timestamp labels and New York midnight on DST days.
  - The parity tests also pass with `TZ` set to America/Los_Angeles, Europe/London and Asia/Tokyo.
  - ESLint is clean.
- **Behavior difference, intentional and tested.** North American zone labels are identical. Elsewhere, Intl labels zones by offset, for example `7:30 PM GMT+1` where moment printed `BST`. Clock, date and countdown values are unchanged.

### S09-B: remove unused direct dependencies

- **Removed:** formidable, immer, use-immer, json2csv (6.0.0-alpha.2), jstat, ml-pca and react-flip-move, plus `@types/formidable`. None has a string reference anywhere in `web/` outside `node_modules`, and no remaining package depends on them.
- **Measured.** Dependencies went from 80 to 73 and devDependencies from 36 to 35. Lockfile entries went from 1,629 to 1,609: 20 removed, 0 added, the 8 direct plus 12 orphaned transitives. That is 201 lockfile lines and about 6.4 MB installed. There is no client or server bundle change, because nothing imported these packages.
- **Verification.**
  - `npm ls --package-lock-only --all` exits 0.
  - None of the 12 transitives is imported directly by app code.
  - Made with `npm uninstall --package-lock-only`, so the shared `node_modules` was **not** modified and the packages remain there as extraneous until the next `npm ci`.
  - **Not run:** a clean `npm ci`. Run it at integration time, then `npm run typecheck` and `npm run test:full`.

### S09-C: `npm run typecheck`

- **Change.** A new script, `"typecheck": "NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit"`.
- **Measured, same locked job.**

  | Command | Result |
  | --- | --- |
  | Documented `npx tsc --noEmit` | **aborted with a heap OOM**, exit 134 after 31 s |
  | `npm run typecheck` | **completed** in 54 s, exit 2 |

  The exit 2 comes from 2 type errors, both in `pages/api/v1/db/ingest-projection-inputs.ts` (lines 668 and 670: `PbpResponse` vs `PlayByPlayPayload`, and the shift-chart payload type). That file is unmodified since HEAD and belongs to the FORGE ingestion area. Other lanes' uncommitted type changes are the likely cause; S-09 touches no involved types. **No type errors are in S-09 files.**
- **Follow-up for the AGENTS.md owner (not edited here).** Point the documented typecheck command at `npm run typecheck`.

### Apply order and checks

- Each patch applies to HEAD independently (`git apply --check --cached`). B and C both touch `package.json` in different hunks.
- No dev server was used.
- Both builds used `PLAYWRIGHT_ISOLATED_NEXT=1 PRESERVE_NEXT_DIST=1` and compile mode, so nothing touched `web/.next` or `.next-player-forecasts`.
- `next-env.d.ts` is unchanged.
- No commits.


## Deferred: proposals that belong to other lanes

These are not implemented. Each is ready to hand over, with its acceptance test, as written in `../BACKLOG.md`.

| Backlog | Proposal | Owning lane (off limits to S-09) |
| --- | --- | --- |
| #2 | `goalie-power.ts` pages at 2,000 rows against the 1,000-row cap; fix before about 2026-12-01 | `trends/*` routes |
| #3 | `fetchCompletedSeasonGames` unpaged (backtests see ≤ 1,000 of 1,312 games) | `game-predictions` |
| #4, #5, #10 | Pending-aware line-source fan-out; `cron_job_audit` indexes; retention | cron files, IFTTT, ops |
| #6 | Single h0 forecast issuer | cron and `game-predictions` |
| #7 | Sustainability coverage signal and offset 750 | `lib/sustainability` |
| #9 | Split the `/draft-dashboard` chunk; the homepage's framer-motion (36 kB gz) comes from `HomepageDraftRanker` | Draft and draft-ranker |
| #13 | Duplicate-index migration | database; ask-first |
| #11 | Archive ref for `web/.next-codex-reconcile` | git-ref write; needs TJ |
