# RSO-PRIVACY-2 receipt: C7 R34 follow-ups P1–P3 (2026-10-26, Claude)

Lane RSO-PRIVACY. Nothing committed. No product source outside `workspace.ts`. `RosterScheduleOptimizer.tsx` is unchanged in this pass. No production, network, Yahoo or DB access. No GIT_DIR. No HEAD files were swapped into the canonical tree.

## Files changed (sha256)
| File | sha256 |
|---|---|
| web/lib/rosterScheduleOptimizer/workspace.ts | 4f4c105d350a6d5e56dc18f6fb448733bb934abf7bb86b371b51ebea4bbeeb65 |
| web/lib/rosterScheduleOptimizer/workspace.test.ts | 5ffe77f24dae321754408ef96a062ce31a62cb481f403e10b12242878123af7f |
| web/e2e/rso-continuity.spec.ts | ea808b9a1738a61f68521fa24069dea5225d91ce5277404222072fae7307300a |
| web/e2e/roster-schedule-optimizer.spec.ts | 22bbc98f215b4c19b16c9095135c789ff5b40785370b23d773081d91052cc8cd |
| web/e2e/start-chart.spec.ts | 96b8054d3797822057cd7ec76340bd4776583b6182d2868fc03faeb680e82bca |

`e2e/start-chart.spec.ts` was added to the lease by TJ (AskUserQuestion: "Grant and update it").

## Decisions
- **P1: ownerless legacy migration** (TJ, AskUserQuestion: "Ownerless: reset all"). Pre-upgrade entries can't be attributed. "Continue manually" relabels provider periods as `unknown` and drops `providerId`, so there is no reliable marker of provider-derived data.

## Changes
- `workspace.ts`:
  - The signed-out slot moves to `ANONYMOUS_WORKSPACE_KEY = "fhfh:rso:workspace:v1:anonymous"` (contexts at `…:anonymous:context:…`). Principal keys and the writer lock name are unchanged.
  - The bare device layout (`fhfh:rso:workspace:v1` plus `…:context:…` and `:undo`) is now only a migration source.
  - `migrateLegacyWorkspace` writes an ownerless workspace (season, dates and time zone only; empty roster, players, locks, plan and Undo) into the anonymous slot, and only when that slot is empty. It then removes every legacy key: pointer, all contexts and all `:undo`, manual or not.
  - Once the legacy keys are gone, the migration is a no-op, so no marker is needed. A tab still running pre-upgrade code that writes legacy keys again just gets migrated again.
  - `anonymousWorkspace` is unchanged in behaviour (provider workspace → ownerless).
  - The no-principal API shape is unchanged: callers that pass no principal (e.g. `dailyAcceptance.*`) write and read the anonymous slot consistently.
- **P2:** each legacy key is removed in its own `try`, and keys are no longer decoded. An undecodable key can't stop the loop or keep later legacy Yahoo keys alive (covered by the fixture's `%E0%A4%A` key).
- **P3:** unchanged and intentional. A preservation journal held from before the upgrade lists the old device keys, so `validatePreservation` rejects it ("Backup contains unexpected storage keys") and recovery stays held. That fails closed: an old journal can never restore into another account's or the anonymous slot.

## Tests
- `workspace.test.ts`:
  - **legacy pre-upgrade fixture:** a "Continue manually" workspace carrying a Yahoo roster ("Prior Account Goalie"), plan, locks and one Undo entry, plus a legacy Yahoo context and an undecodable key. After migration no legacy key remains, the anonymous workspace has only dates, there is no Undo history, the owner's principal keys are intact, an unrelated key is kept, and a second run is a no-op.
  - an existing anonymous workspace is never overwritten by migrated dates;
  - existing scoping tests now use the anonymous key.
- E2E: the signed-out reads move from `"fhfh:rso:workspace:v1"` to the anonymous key, with principal keys untouched:
  - `roster-schedule-optimizer.spec.ts`: 36 literals;
  - `rso-continuity.spec.ts`: 2;
  - `start-chart.spec.ts`: 3, all in its saved-intent hand-off test.

## Runs
| Check | Result |
|---|---|
| RSO unit and component suites (`lib/rosterScheduleOptimizer` incl. `dailyAcceptance.*`, `__tests__/components/RosterScheduleOptimizer`, `components/RosterScheduleOptimizer`, `hooks`, `lib/in-season`) | **UTC 1632/1632; America/New_York 1632/1632.** `workspace.test.ts` was rerun alone after a final type-only import fix: 27/27 in both. |
| E2E `rso-continuity.spec.ts` | **10/10 in UTC and America/New_York** (isolated :3160, `PLAYWRIGHT_ISOLATED_NEXT=1`, non-loopback blocked, server stopped) |
| E2E `roster-schedule-optimizer.spec.ts` + `start-chart.spec.ts` (America/New_York, `--workers=1`) | 60/62 (`run-4/e2e-America-New_York.log`). Both failures are `start-chart.spec.ts:541` ("protects the private Yahoo comparison…", 1440 and 390 px), which **fails consistently** at its first assertion (the "My Yahoo team · Today · Draft Pro" summary is not visible). Unrelated: it never touches RSO storage, and no Start Chart code imports `lib/rosterScheduleOptimizer/workspace` (only the RSO component and its workspace API route do). Not baselined against HEAD within the time box; proposed as a separate follow-up. |
| `start-chart.spec.ts` saved-intent hand-off (the 3 updated reads) | 5/5 viewports passed |
| eslint (5 changed files) | clean, no warnings |
| Whole-project `npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` (noclobber; acquired and released; 8 GB heap) | exit 0, 0 errors |
