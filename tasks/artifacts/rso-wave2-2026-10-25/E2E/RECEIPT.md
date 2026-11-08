# RSO-E2E receipt: browser continuity acceptance (2026-10-25, Claude)

Lane RSO-E2E. Nothing committed. No product source and no `roster-schedule-optimizer.spec.ts` edits.

## Files (sha256)
- `web/e2e/rso-continuity.spec.ts`: `24f7f6720c2d54aff646707123b7a31ad98c68a35660940467f91322ba196c2a`
- `web/e2e/fixtures/rso-continuity/index.ts`: `b5c7662743cc01445125fc03748774ef8179072cc2dad6865745e19b8fe7bc35` (fixture builders mirrored from the existing spec, where they are file-local; a parameterized synthetic-principal session; loopback-only isolation)
- Reused unchanged: `routeCurrentPlanning` (private Yahoo POST, principal bearer check and read nonce), `installPlanningClock`, `setPlanningTime` and `showScheduleView` from `web/e2e/roster-schedule-optimizer-fixtures.ts`.

## Environment
- Server: `PLAYWRIGHT_ISOLATED_NEXT=1 npm run dev:stable -- -p 3160` (`.next-playwright`), run with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3160 PLAYWRIGHT_SKIP_WEB_SERVER=1`. Ports 3000 and 3105 were untouched. The server was stopped afterwards and 3160 has no listener.
- Network: every non-loopback request is aborted, unmocked `/api/**` returns 503, and `/rest/v1/**` returns `[]`. Sessions are unsigned `.fixture` JWTs for fictional principals …0001 and …0002. No production, Yahoo or DB access.
- Chromium ran normally (not sandbox-blocked).

## Final run: 9 passed, 1 failed (46 s)
Full log: `final-run.log`.

| # | Case | Result |
|---|---|---|
| 1 | Nonzero selected-move refresh → edit → Undo → second edit → reopen: steps, protections, exclusions and locks kept; Undo still enabled after reopen and reverts the pre-reload edit | PASS |
| 2 | League switch (League ID league-a→league-b→league-a) and account switch (principal A→B, same device) | **FAIL**: defects D1 and D2 (soft assertions, so all four checks ran). Passing parts: league-b clears roster, locks and A's players; switching back restores league-a's plan; after the account switch, every workspace and provider request carries only B's bearer. |
| 3 | PUT returns 409 `version_conflict` → "Another device saved this workspace. Your local plan is intact…" shown; no "Saved to account."; local intent and locks unchanged; Save re-enabled; a retry also surfaces the conflict | PASS |
| 4 | Desktop overflow with 19, 20 and 29 roster slots at 1440×900 and 1280×800 (By player and Itinerary): no horizontal page overflow; schedule scroll area inside the viewport | PASS ×3 |
| 5 | Mobile 375×812: no horizontal overflow; Itinerary, Roster, Candidates and Matchup reached by Tab; every focused element on-screen; Enter activates Roster; disabled Undo exposes "No edits to undo." | PASS |
| 6a | Access expired: "Saved inputs are read-only and may be stale.", Undo disabled with its reason, no provider call; "Continue manually" → provider manual with steps, protections and locks kept; edits work | PASS |
| 6b | Missing (empty workspace: 0 players, import affordance) and failed read (503) shown as a status; intent intact | PASS |
| 6c | Edit during a held planning read: latest intent wins, no stale or obsolete error, at most 2 reads, none failed | PASS (see interpretation) |

Earlier iterations (pw-run1 to pw-run3) were spec fixes, not product changes. In run 1, case 2's provider fixture used the wrong league; case 5 expected a disabled Undo to be a tab stop; 6b expected a collapsed readiness item to be visible; and 6c expected the edit to abort the shared GET.

## Interpretations and limits
- "Review state" in case 1 means intent protections and exclusions plus locks. The rule-confirmation state was not asserted across reopen.
- "Cancelling a running plan": the product has no user-facing Cancel control. Superseded requests are released (`hooks/useRosterPlanning.ts`) and the shared read is coalesced, not aborted. 6c verifies supersession from the browser only. Worker termination is covered by the existing spec test "planning worker measures the full typical workload and cancels superseded edits" and was not rerun here.
- One final run only; no repeat runs for flakiness.

## Checks
- `npx eslint e2e/rso-continuity.spec.ts e2e/fixtures/rso-continuity/index.ts`: clean.
- `npm run test:e2e -- --list`: 10 `rso-continuity` tests discovered.
- tsc: not run (heavy lock not taken). Playwright transpiled the spec, but that is not a type-check.

## Screenshots (`screenshots/`)
case1-reopen-undo, case2-account-b, case2-failure-account-b-sees-a, case3-save-conflict, case4-{19,20,29}-slots-{1440,1280}, case5-mobile-375, case5-mobile-roster, case6a-read-only, case6b-missing, case6b-error.
