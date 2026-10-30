# RELOAD-FLAKE receipt (2026-10-29, Claude, lease RSO-RELOAD-FLAKE)

File changed (only): `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` (not committed)
- sha256 before: `dd2e2b150f5d9c7205bc992f4863d01d88514e36af9541b90eb7dc2c89ad30cb`
- sha256 after:  `aa5d2d594ead5c1d11b27532438273d9e1e6bbb812d627681c23bf18cff4153a`
- Test: `it.each(["manual","yahoo"])("reloads shared schedule data for %s without changing the selected plan or refreshing a provider")`.

## Cause (test race, not a product bug)
Failing assertion: `await waitFor(() => expect(snapshots.at(-1)?.games.length).toBe(2))` -> `expected 1 to be 2`.
The test clicks "Reload schedule data" as soon as the *first* plan snapshot (games=1) is recorded. That snapshot is pushed inside the
`planningState.evaluate` stub, i.e. *before* React commits `loadingData=false`. The product button is
`disabled={!hydrated || loadingData || networkSuspended}` (`RosterScheduleOptimizer.tsx:1177`), and `fireEvent.click` on a disabled
button is silently dropped. If the click lands in that window (wider when the machine is busy), no reload starts, `reads` stays 1,
the 1 s default `waitFor` then times out with `expected 1 to be 2` (the RC15 gate's ~1,100-1,200 ms). Pure CPU load alone only slows
the test (~350 ms -> 1.1-2.1 s with 64 burners) because each individual wait stays under 1 s; the failure needs the click to hit the
disabled window. The same hazard exists on the second reload click (after the `games=2` plan), and each wait inherits the 1 s default.
Product behaviour (disable while loading) is correct; nothing in `web/components/RosterScheduleOptimizer/**` needs changing.

## Change
In that one test only:
1. `reload()` helper: `await waitFor(() => button.disabled === false, settle)` then click. Used for both Reload clicks.
2. `const settle = { timeout: 15_000 }` passed to the five `waitFor`s (initial games=1, games=2, reads 3, reads 4, button-enabled), because each spans fetch + re-plan + renders.
3. Per-test timeout `30_000` (Vitest default 5 s would otherwise cap the longer waits).
No assertion removed or loosened (reads, URL params, readToken, saved workspace fields, no `/provider` call, repeated URL are unchanged).
Same-pattern search in the file: only this test clicks a loading-gated reload then waits on a snapshot/read count; no other edits.

## Evidence (all from `web/`)
Reproduction (temporary injections into a copy of the owned file, then restored; final sha verified above):
| Condition | OLD (dd2e2b15) | NEW (aa5d2d59) |
|---|---|---|
| Commit of first plan delayed 300 ms (forces click-while-loading), manual case, UTC | FAIL `expected 1 to be 2` at 1,211 ms | pass (679 ms); NY also pass |
| Async 1.3 s delay on reload's shared read (both cases, UTC and NY) | 4/4 FAIL `expected 1 to be 2` (~1.15-1.25 s) | 4/4 pass |
| Synchronous 1.3 s CPU spin before first post-reload plan | pass (sync stalls do not trip waitFor) | pass |
Real file, 64 node CPU burners (load avg ~200 on 16 cores), `-t "reloads shared schedule data"` (manual+yahoo):
- Intermediate version (timeouts only, no button wait): run 4 of each TZ **failed after ~16 s** (`expected 1 to be 2`), i.e. the
  swallowed click, which longer timeouts cannot fix -> this is how the disabled-button cause was found.
- Final version: UTC 8/8 pass, America/New_York 8/8 pass.
Whole file, unloaded: TZ=UTC 3/3 and TZ=America/New_York 3/3, 238/238 each.
Whole file with 64 burners: America/New_York 238/238 (28.7 s). TZ=UTC: 237/238 (177 s); the one failure is
`resumes a display day without aliasing a different timezone or rewriting the plan` at 5,158 ms = Vitest's default 5 s test timeout
under extreme load (a similar one, `...different league...`, 5,287 ms, appeared with the intermediate version). Not the same flake
and not touched (out of scope); if it shows in gates, the fix would be a per-test/`testTimeout` raise, not this test's change.
`npx eslint <file>`: exit 0. tsc not run (test-body change only).

## Notes
- Load generator: `node -e 'const t=Date.now()+180000;while(Date.now()<t){}'` x64, all killed afterward (0 left).
- Scratch copies in the session scratchpad only. No Git, no product edits, no production/Yahoo access.
