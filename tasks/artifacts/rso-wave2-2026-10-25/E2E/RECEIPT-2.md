# RSO-PRIVACY receipt: D1 + D2 fixes (2026-10-25/26, Claude)

Lane RSO-PRIVACY. Nothing committed. No production, network, Yahoo or DB access. No GIT_DIR.

## Files (sha256, final, after the orchestrator's API-compatibility follow-up)
| File | sha256 |
|---|---|
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | 9485af7a50a3214a115f3bd9ad56cd1df7836b88a9079ece5aa06c7836925abb |
| web/lib/rosterScheduleOptimizer/workspace.ts | 2bb48bb85f7ae829e526db43012ccfa00aa0bcbfe2df0eff9c30b95b3d5d4bf5 |
| web/lib/rosterScheduleOptimizer/workspace.test.ts | 54bfcc47ae1b8660accba0b51f42d26198d032b62ca7c3d774ba6e7a76d1588d |
| web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx | a418ef4c6415dff179836fdc822265246e33297c6a99dbe23c65a4d88e38ecbc |
| web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx | eb81ce898178d4b3efd496842215c0604dd317121a85474ec35530d912b9ecd6 |
| web/e2e/rso-continuity.spec.ts | e7d6b1bc8fddc0558dc09d18eb4444aa99c9d536777ea3f1057ecaafda04177f |
| web/e2e/fixtures/rso-continuity/index.ts | b119ef90915f04310a3d0e5658799a002959f8b7e6871b6a6a62c3135652d63f |
| web/e2e/roster-schedule-optimizer.spec.ts | b847fe8b582edec54db31539817eabbc44994c1ab6808f32f203c9400c41715e |

`web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts` is **back to HEAD** (unedited) and passes. The component test also carries the RSO-FLAKE `waitFor` fix.

## Follow-up: API compatibility (orchestrator request)
Callers that pass no principal keep HEAD's device-key behaviour: `readWorkspace` and `readWorkspaceHistory` no longer strip provider data themselves. Stripping now lives in the component's signed-out paths, and `anonymousWorkspace()` is exported for that:
- On hydration with no signed-in user, the stored workspace goes through `anonymousWorkspace()`, so a Yahoo workspace shows as an empty manual one with no Undo.
- A signed-out context switch never restores a stored non-manual workspace.
- `migrateLegacyWorkspace` still purges provider data from the device key once.
- Signed-in principals still read only their own `:principal:<id>` namespace.

## What changed
**D2: local workspace scoped per principal** (`workspace.ts`)
- `workspaceStorageKey(principalId)`:
  - a signed-in principal uses `fhfh:rso:workspace:v1:principal:<id>`, with its own `:context:` and `:undo` keys;
  - `null` (signed out) uses the legacy key, which is now the single anonymous manual slot.
- `readWorkspace`, `readWorkspaceHistory` and `writeWorkspace` take an optional `principalId`, defaulting to anonymous so manual callers are unchanged. `preservationKeys` uses the principal's keys.
- `anonymousWorkspace()` reduces a non-manual workspace to an empty manual one that keeps season, dates and time zone. The component applies it to signed-out reads (see the follow-up above).
- `migrateLegacyWorkspace(storage)` runs once, idempotently, at hydration. It rewrites a provider-bearing legacy pointer to its stripped form and deletes every legacy `:context:` and `:undo` key whose context is not manual. Manual keys, principal keys and unrelated keys are kept.

**Component** (`RosterScheduleOptimizer.tsx`)
- Hydration waits for `useAuth().isLoading`, then loads the signed-in principal's own slot, or the anonymous slot when signed out.
- On account change or sign-out it reloads that scope's workspace, or an empty one, and its Undo. It never adopts another scope's workspace.
- Writes go to the scope the workspace was loaded under (`loadedScope` is set in the same batch as the workspace).
- Edits made while auth is resolving stay with that visitor: the first hydration with nothing saved keeps the in-memory workspace.

**D1** (`RosterScheduleOptimizer.tsx` `edit()`): a provider, league, team or season switch to a context with no saved workspace now clears `intent.steps`, `protectedPlayerIds` and `excludedPlayerIds`, alongside the existing roster, players, locks and overrides reset. Goalie and alternative preferences are kept. Switching back restores the earlier context's plan through the existing per-context restoration. "Continue manually" is unaffected (it does not go through `edit()`).

## Tests
- `workspace.test.ts`: three new tests (principal isolation including Undo and preservation keys; anonymous manual slot stripping; legacy migration and idempotence). Two fixtures now write to "owner-a".
- Component test:
  - seeds and reads go through `activeKey()` (the signed-in user's slot);
  - preservation setup signs in before seeding;
  - signed-out Yahoo cases select Yahoo in-session instead of restoring it;
  - the two team-change expectations now assert the D1 reset;
  - the account-switch test now asserts that the second account starts empty and the first account's slot is intact. It previously asserted the D2 leak.
- E2E continuity case 2: the soft checks are now hard assertions, plus checks that the second account's slot is empty, the first's is intact, and sign-out shows only the anonymous manual slot. The fixtures seed and read per principal.

## Runs (final)
| Check | Result |
|---|---|
| RSO unit and component suites (`lib/rosterScheduleOptimizer`, which includes both `dailyAcceptance.*.test.ts`; `__tests__/components/RosterScheduleOptimizer`; `components/RosterScheduleOptimizer`; `hooks`; `lib/in-season`) with `TZ=UTC` | **1631/1631 passed** |
| Same suites in local time (America/*, after 00:00 UTC Monday) | 1627/1631. Both dailyAcceptance files pass (yahoo 34, manual 29). The 4 failing component cases also fail on HEAD at this hour: the test data's period runs from now to this week's end, which is invalid once UTC is in Monday. |
| E2E `roster-schedule-optimizer.spec.ts` + `rso-continuity.spec.ts`, isolated :3160, `--workers=1` | **50/54 passed**; all 10 continuity cases pass (`run-2/e2e-final.log`). The 4 failures (537, 594, 639 and 1359) **also fail on HEAD** (HEAD product code + HEAD spec on the same server). 2040 is flaky. 59 and 414 had read-right-after-click races and now poll (each passed 3 of 3 on rerun). |
| eslint on the 8 changed files | exit 0: 0 errors. The component has 6 react-hooks warnings; HEAD has 7, none new. |
| Whole-project `npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` (noclobber; acquired and released; 8 GB heap) | exit 0, 0 errors |
| Server | `PLAYWRIGHT_ISOLATED_NEXT=1` on :3160, non-loopback blocked in specs, stopped (no listener). For HEAD baselines I swapped HEAD product files in briefly and restored mine (hash-checked); this also made TJ's :3000 dev server recompile. |

## Granted out-of-lane test updates (mechanical)
- `AcquisitionRules.integration.test.tsx`: write and read the signed-in Yahoo manager's slot (`auth.user?.id ?? null`).
- `dailyAcceptance.yahoo.test.ts`: edit reverted (restored with `git checkout HEAD -- <file>`; the file was unstaged, so the index is unchanged). It passes unedited after the API-compatibility change.
- `roster-schedule-optimizer.spec.ts`:
  - `seedWorkspace` takes a principal;
  - the nine signed-in Yahoo tests seed and read the fixture principal's slot (1177 does so only in "connected" mode);
  - 968's account switch now asserts that the second account starts from its own empty slot and the first account's slot is intact, instead of the old carry-over and manual fork;
  - 414 and 59 poll for the asynchronous local write after a click instead of reading right away (both were flaky: one failure, then 3 of 3 passes).

Note: preservation backups captured before this change list the old device-global keys, so `validatePreservation` will now reject them ("unexpected storage keys"). That fits "never show it to a different principal", but it affects any owner-testing backup taken before this change.
