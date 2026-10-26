# UI-BATCH-1 receipt (Claude lane, 2026-10-26)

Uncommitted on `octoberBranch`. No git mutations, production reads, deploys or provider calls.

## Item 1: page "reloads" on returning to Chrome (fixed)

**Root cause** (not auth, not a remount; every key and reset is on `user?.id`, which is unchanged):
- A Yahoo plan's private read carries a Yahoo freshness deadline of ≤ 2 minutes (`lib/integrations/yahoo/planningConfirmations.ts`).
- When it passes, `useRosterPlanning` withdraws the whole result: the grid, points and candidates go blank. It then re-plans with a new `POST /yahoo-current-data`.
- In a background tab, that lapse is first noticed on return. The access re-check (`GET /access`, which runs on `visibilitychange`) re-renders, the page blanks, and the re-plan fires. That is the exact console sequence TJ captured.

**Fix** (TJ chose "Fall back, no blank"):
- `executionAdapter` reports `privateLapsesFirst` when the Yahoo window, not a public input, ends the plan.
- For such a plan, `useRosterPlanning` reads the same generation from public inputs only (`yahooPrincipalId: null`), in the last 30 seconds before the deadline.
- When the Yahoo window lapses, the page shows that public stand-in instead of blanking. The Yahoo start marks drop, and expired numbers are never shown.
- It re-plans only when the stand-in also expires. Otherwise fresh Yahoo marks arrive with the next provider upkeep or input change, so there is no Yahoo read every 2 minutes.
- If no stand-in is ready (its read failed, or a public input expires first), the old withdraw-and-re-plan behaviour is unchanged.

**Tests:** 5 new hook tests and 2 adapter assertions plus 1 adapter test.
- Mutation check: the new hook tests fail against HEAD's hook in a `/private/tmp` git-archive copy.
- Opt-in diagnostics remain: `localStorage.setItem("fhfh:rso:debug","1")` logs mount, navigation type, auth, hydrate, provider refresh and visibility.

## Items 2–4
- **Bench days:** a Players | Bench days tab pair in Current Roster, with Players shown by default. Bench days replaces the player rows instead of squeezing them.
- **Goalie cells:** the same height as skater cells (asserted equal in Playwright). "exp" and "if GS" are stacked where skaters show points, so the name keeps room. The aria-labels and titles are unchanged.
- **Top five team schedules:**
  - opponent logos instead of H/A;
  - off-nights in green;
  - GP and OFF under the Score;
  - a team band in `primaryColor` with vertical `secondaryColor` text and a `jersey` inner outline;
  - a larger day strip.

## Checks
| Check | Result |
|---|---|
| Vitest: RSO components, `__tests__/…/RosterScheduleOptimizer`, `hooks`, `lib/rosterScheduleOptimizer`, UTC | 1266/1266 passed |
| Same, America/New_York | 1266/1266 passed |
| Playwright `e2e/rso-acceptance.spec.ts` (isolated `PLAYWRIGHT_ISOLATED_NEXT=1`, port 3172, network-blocked, fixtures), UTC and New York | 8/8 each; server stopped |
| CSS Modules pure check: `RosterScheduleOptimizer`, `SlotWeekGrid`, `TeamScheduleContext` `.module.scss` | pure OK |
| `tsc --noEmit` under the heavy lock (8 GB) | exit 0 |
| eslint on changed files | 0 errors (6 pre-existing hook-deps warnings in `RosterScheduleOptimizer.tsx`, none on changed lines) |

Not covered: no Playwright run of a Yahoo-provider plan across the 2-minute lapse. Hook and adapter tests cover it.

## Lease
- In lease: the RSO component folder and its tests, `e2e/rso-acceptance.spec.ts` and `e2e/fixtures/rso-acceptance/`. Styles: `RosterScheduleOptimizer.module.scss`, `SlotWeekGrid.module.scss`, `TeamScheduleContext.module.scss`.
- Extended for item 1: `hooks/useRosterPlanning.ts` (+ test) and `lib/rosterScheduleOptimizer/executionAdapter.ts` (+ test).

## Files (sha256)
```
ae11ce8f308599da1c6d5bf32eac99b79df02b7355d620ced92f1e9dfa405ba0  web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx
56649f02f1ec964a7b32a9c11b51cc52a2915baf331d72fd956429003f34bfa8  web/components/RosterScheduleOptimizer/ForecastPoints.test.tsx
961f54fc2b7a6895f01b8ea993b2cde072c5d623f613b85bbadaed30ad1b4fe3  web/components/RosterScheduleOptimizer/ForecastPoints.tsx
091131931e00bdbb1af447a7d2d2314a5846d95deff7b0da886a13b466a0c6aa  web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss
c9498ad4a652b5c923c82b9dfeb0ab525954dde2f565d59333d46606342dd21a  web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.points.test.tsx
cc682c37c82ac571c1a590a4a6afab7b877addd1337bb50b1d8dbf25725a65cd  web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx
7f8c15f943d1243face9c8a3bf5b9f6bae8f54d872ac5c9dcc5521718e46ec87  web/components/RosterScheduleOptimizer/SlotWeekGrid.module.scss
9fbc3bb562e43633683e036a47886fdfac6ca944faa32529fde5d64cf021e61f  web/components/RosterScheduleOptimizer/TeamScheduleContext.module.scss
6111b34ca52671cbc26fb3bdf5c5a20fe534acd3996088104ec0f7047072be8f  web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx
ccb966368d157f71815c2233a8b54f572e09ce04b21999cbecb16b4bda3bc367  web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx
8685e1533955848fd7ba6f2387cb7344845f0f5b2b095601772b159c8a79a0c3  web/e2e/fixtures/rso-acceptance/index.ts
9f5aea30d04464d7138b0f9570843a848a7ab61bffd853743445ee51cc65a777  web/e2e/rso-acceptance.spec.ts
a210cd0a204812f73bbf15975481ba113620de5b688385b0b33504f6d634f606  web/hooks/useRosterPlanning.test.tsx
4ea0fd32c2cb606301d0b569d07726709e0836527d7ae18bb7670a350f235123  web/hooks/useRosterPlanning.ts
cf541f789ba2697a0e5276e2c38c989dd2ff990c5c0b04017c503e87ff774c80  web/lib/rosterScheduleOptimizer/executionAdapter.test.ts
ba5176b5de6eee90c6fd0ec41eb1b862c9d8d1a0a629164fe9fff168c5814e77  web/lib/rosterScheduleOptimizer/executionAdapter.ts
```
Screenshots (this folder):
```
5c97d33e2753e7fa5ca7220ab39f561f5c8bcb4402695069afb32deab703db5c  ui1-desktop-1440.png
2c93ecbcfd11196f38bf7e1b26bbc7a32b9138f00196a5ad0aee502bcaa3cfe4  ui1-desktop-bench-days-1440.png
07be60fffcdc674c7c5d7e2e7c477d4b69939ae478e955a5cd786958e1860746  ui1-goalie-cells-1440.png
54b944834868042f2d62d821b88742d0736dd06b868eee0ae0aff2dcd94fc94c  ui1-mobile-bench-days-390.png
85eadec1b90c5fd1a9a622daf54111d8f8a7bb3d9017aa828a949823cb5e69c5  ui1-team-schedules-1440.png
91bb5b0a35d1eb8c0c7e4e7b25069936ddd9d24efb2e9d7c92c9173ad6549026  ui1-team-schedules-390.png
```
