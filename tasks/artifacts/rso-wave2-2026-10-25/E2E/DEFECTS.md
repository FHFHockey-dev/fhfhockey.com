# RSO-E2E defects (2026-10-25)

Both come from `e2e/rso-continuity.spec.ts` case 2. Product code was not edited. Severity and whether to fix are TJ's call.

## D1: league/team context switch carries the previous league's selected moves and protections
- Repro: Yahoo workspace league-a with `intent.steps = [add fhfh:2]`, `protectedPlayerIds = [fhfh:1]`. Planning setup → League ID → `league-b`.
- Observed: league-b's saved workspace has empty roster, players and locks, but `intent.steps` still holds league-a's add, and `protectedPlayerIds` still holds league-a's player.
- Expected: a new league context starts without the other league's plan.
- Where: `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` `edit()` context-change branch (~line 336). It resets `managerRuleOverrides`, `roster`, `manualPlayers` and `lockedAssignments` but not `intent`.

## D2: on a shared device, a newly signed-in principal sees the previous principal's retained Yahoo roster and plan
- Repro: principal A (…0001) loads Yahoo league-a and the provider returns the roster ("Alpha Private", …). The session switches to principal B (…0002) and the page reloads.
- Observed: B's page shows "Alpha Private" in Current Roster and "ADD Bravo Private" under Selected steps ("Connected to Yahoo · Retained roster · unverified"). All requests correctly carry B's bearer, and the private read is denied ("synthetic scope belongs to another principal"), so the leak is purely local.
- Cause: the local workspace (`fhfh:rso:workspace:v1`, plus its Undo history) is device-global, not keyed by principal. See `readWorkspace(window.localStorage)` on hydrate (~line 230).
- Evidence: `screenshots/case2-failure-account-b-sees-a.png`, `screenshots/case2-account-b.png`.
- Open product question: decide whether local workspaces should be principal-scoped, or cleared or hidden on sign-out and account change.
