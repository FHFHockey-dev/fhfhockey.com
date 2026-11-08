# Push-readiness inventory: octoberBranch → origin

Read-only inventory, prepared 2026-10-25 to inform TJ's push decision. **This is not approval to push.**

**Rechecked later on 2026-10-25, after the session-limit reset.** HEAD (`48809914a`) and `origin/octoberBranch` (`2f2b43230`) are unchanged: still 13 ahead and 0 behind. The origin ref was last updated by the 11:37 −0400 push. Because HEAD is unchanged, the commit, path, route and import findings below still hold. Only the working tree drifted, and the dirty-overlap list below is refreshed for it.

## How this was made

- Run in `/Users/tim/Code/fhfhockey.com` on `octoberBranch`.
- HEAD is `48809914a620927631cf94691e1339a6c30a2f02`. Local `origin/octoberBranch` is `2f2b432306b048f16bf48c2e274f21e55a7514d4` (2026-10-25 11:33 −0400). That is the ref as last fetched; I did not fetch.
- 13 commits ahead, 0 behind, so a push would be a fast-forward.
- Method: `git log`, `git show --name-status`, `git ls-tree` and `rg`, plus a scratch Node script that resolves imports read from git blobs.
- No git mutations, no GIT_DIR, no Vercel or production calls, no app code executed.

## Summary

- **Apps touched:**
  - `web/`: 11 commits, 74 distinct web paths in total.
  - `tasks/`: 2 commits, tasks-only.
  - `cms/`, `functions/`, `webhooks/`, `supabase/`, `migrations/`, `sql/`, `.github/`: none.
  - `web/vercel.json`, `web/package.json`, `web/package-lock.json`, root `vercel.json`: none.
- **Cron / API routes edited directly:** 2.
  - `web/pages/api/v1/db/calculate-wigo-stats.ts`: pg_cron job 231 `update-wigo-table-stats`, `50 8 * * *`.
  - `web/pages/api/v1/db/forge-served-forecast-snapshot.ts`: Vercel cron `30 12 * * *`.
- **Reached indirectly through changed libs:**
  - `lib/underlying-stats/playerStatsRefreshWindow` feeds `update-player-underlying-stats` (pg_cron `update-player-underlying-stats-yesterday`, `35 9 * * *`). It also feeds `catch-up-player-underlying` and `update-player-underlying-summaries`, which have no scheduled entry in `cron-schedule.md` or `vercel.json`.
  - `lib/socialShare/{server,types}` feed `pages/api/v1/social-share/[format].ts`, which is not scheduled.
  - No other changed lib, util or hook has an API importer.
- **Imports of files not on origin:** 14 import edges point at files that are not on origin. Every one resolves to a file added by the same commit or an earlier commit in this push. **None resolves to a file that is missing at that commit or at HEAD.** So this is bisect-safe, and nothing depends on an uncommitted or untracked file. There are 0 untracked files under `web/`.
- **Imports of dirty working-tree files:** 13 committed web files import origin files that have uncommitted local edits (list below). I checked every named import in them against the **HEAD** blob of its target, and all resolve. One flagged default import was a false positive: a re-export line in `GoalieShareChart/index.tsx`.

## Per commit

| # | Commit | Subject | Paths (A/M/D) | App | Cron / API route | Imports of files not on origin |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 9dbc55afb | Player-card evidence-bundle validator (C1, offline) | 2 (2A) | web lib | no | `evidenceBundle.test.ts → ./evidenceBundle`, added in this commit |
| 2 | ac98431aa | Codex custody transfer + BLSH P1 registration | 15 (7A 8M) | tasks-only | no | n/a |
| 3 | 80425a4a9 | WiGO appearances containment; refresh-window recovery holes (C3) | 4 (1A 3M) | web lib + API | **yes**: `calculate-wigo-stats.ts` (pg_cron 231); `playerStatsRefreshWindow.ts` (reaches `update-player-underlying-stats`, pg_cron `35 9 * * *`) | none |
| 4 | 27ea7fc36 | Social share recent-form, streaks, low-year weeks (SS1 17-19) | 15 (2A 13M) | web component + lib + e2e | indirect only: `social-share/[format]` (unscheduled) | 4 edges to `lib/socialShare/streak`, added in this commit |
| 5 | 4436789f1 | WiGO charts one-page layout + audit fixes | 32 (4A 27M 1D) | web page + components + utils + e2e | no (page `pages/wigoCharts.tsx`) | `wigoFixtures.ts → ./schema.json` and `wigo-one-page.spec.ts → ./fixtures/wigo/wigoFixtures`, both added in this commit. Deletes `e2e/wigo-single-viewport.spec.ts` |
| 6 | f951732dc | Goalie Share counts official starts | 4 (4M) | web component + lib | no | none |
| 7 | 9e861bfdc | RSO healthy reserves notice defects (D2) | 5 (5M) | web component + lib | no | none |
| 8 | cee5d6a1f | FORGE served snapshot: failing stage + per-stage timing (C3d) | 2 (2M) | web API | **yes**: `forge-served-forecast-snapshot.ts` (Vercel cron `30 12 * * *`) | none |
| 9 | 664345ce5 | Testing Grounds S06 run-store read adapter | 4 (4M) | web lib | no | none |
| 10 | 4d37b51c9 | Player cards retained-evidence loader | 4 (4A, incl. one JSON fixture) | web lib | no | 6 edges to `evidenceAdmissions` and `evidenceLoader` (this commit) and `evidenceBundle` (commit 1) |
| 11 | 33d99b377 | Claude coordination receipts, reviews, diaries | 116 (112A 4M) | tasks-only | no | n/a. It contains `.patch` and `tsconfig.json` files under `tasks/`, which are artifacts and not built |
| 12 | 63654c308 | Testing Grounds shared run-store contract kit | 2 (2A) | web lib | no | `runStoreContract.test.ts → ./runStoreContract`, added in this commit |
| 13 | 48809914a | RSO healthy reserves DTD-in-IR+ note, ranked activations | 5 (5M) | web component + lib | no | none |

"Indirect" means a changed lib is imported by a route that the commit does not edit. Importers were found by `rg` on the last two path segments under `web/pages/api`.

## Pushed state differs from the tested working tree

These files are touched by the 13 commits **and** still carry uncommitted edits. A push sends the committed version, without the edits:

- `web/pages/api/v1/db/calculate-wigo-stats.ts` +16/−0 (**cron route**; it was +14 at the first pass, so it is still being edited), with its test `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts` +49/−0
- `web/lib/goalieWorkload.ts` +2/−1, with `web/components/GoalieShareChart/GoalieShareChart.test.ts` +15/−0
- `web/lib/socialShare/playerSources.ts` +3/−0, with `playerSources.test.ts` +20/−0
- `web/utils/fetchWigoPlayerStats.ts` +22/−12, with `fetchWigoPlayerStats.test.ts` +21/−2
- tasks only: `CLAUDE-TO-CODEX.md`, `wigo-redesign-2026-10-25/AUDIT-REPORT.md`, and six 2026-10-24/25 Claude diaries

Separately, `web/hooks/useWigoPlayerDashboard.ts` (+8/−5) is imported by the committed `pages/wigoCharts.tsx` but was not changed by any of the 13 commits. It is dirty locally.

Any lane's local test or type-check pass was therefore observed on the working tree, not on HEAD. Named imports resolve at HEAD, as checked above. **I did not run type-checks or tests on the exact HEAD snapshot**, which would need a clean export (e.g. `git archive HEAD` into scratch). That is the main gap before trusting a push to build.

## Expected Vercel build triggers (from in-repo `ignoreCommand` only; project settings not inspected)

| Project root | ignoreCommand logic | Paths changed in push | Expected |
| --- | --- | --- | --- |
| `web/` | builds if `web/` or `tasks/TASKS/cron-operations/cron-schedule.md` changed since `VERCEL_GIT_PREVIOUS_SHA`; builds if that SHA is missing | yes, `web/` | **would build** if the project deploys this branch |
| `cms/` | builds if `cms/` changed since the previous SHA (else falls back to HEAD~1) | none | skip |
| `functions/` | same, for `functions/` | none | skip |
| root (`vercel.json`) | `exit 0` | n/a | always skip |
| `webhooks/` | no vercel.json in repo | none | unknown |

Per the standing rule, TJ re-checks the 4 Vercel projects' preview settings before any push. This table does not replace that check. Whether a branch push creates a web preview build depends on dashboard settings I did not read. A merge to `master` would build `web/` for production.

## Not done

- No fetch: origin may have moved since 11:33 −0400.
- No HEAD-snapshot test or type-check run.
- No Vercel or dashboard reads.
- No content review of the commits beyond paths and imports.
