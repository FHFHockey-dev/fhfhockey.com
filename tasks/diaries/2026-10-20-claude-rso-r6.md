# RSO R6: exact UTF-8 envelope budgets (claude session)

## Scope
Chef ticket. Measure exact UTF-8 bytes of the full data-route response (bridgeForecasts and forecastSource included) and the workspace save/response envelopes (packed, preservation responses included). Enforce budgets with graceful trimming or explicit rejection. Don't redo R6f packing.
Owned: forgeDailyBridge.ts, bridgeForecastWire.ts, lib/in-season/workspaceSchema.ts + workspaceRoutes.test, pages/api/v1/roster-schedule-optimizer/{data,workspace}.ts + tests.
Deliverables: octoberBranch working tree; tasks/artifacts/release-r9-2026-10-20/R6-utf8-envelope-master.patch on origin/master c2ed28384.

## Lessons carried over
- F1 master patch shipped node_modules/.vite/vitest/.../results.json: the scratch exclude covered only web/node_modules. Scratch exports now exclude `node_modules/` and `.vite/` everywhere, and I check the staged list before each commit.

## Design
- bridgeForecastWire: jsonUtf8Bytes() (TextEncoder) + fitBridgeWire(wire, envelope, budget). It keeps the earliest rows (game-time order) so the whole envelope fits, notes the trim in wire limitations, and falls back to no wire, else null. Sizes are exact from prefix sums, then verified once.
- data route: PLANNING_RESPONSE_BYTE_BUDGET 4,000,000 on the whole body; null → 503 planning_range_too_large.
- workspace: WORKSPACE_TRANSPORT_BYTE_BUDGET 4,000,000 on every packed response (ok guard → 503 workspace_too_large). A packed PUT body over WORKSPACE_SAVE_BYTE_BUDGET (−4,000 reserved for the response wrapper) → 413 before unpack, so nothing is written.

## State
- 2026-10-20: tests being written (octoberBranch).
- RED (octoberBranch): workspaceRoutes 5 fail (413/503 expected, got 200); data route sends 4,683,707 bytes (string length under 4 M); bridge fit unit tests fail (API missing).
- GREEN (octoberBranch): 3 target files, 50 tests; neighbours (lib/rosterScheduleData, lib/in-season, RSO API/page tests, lib/rosterScheduleOptimizer) 29 files / 686 tests; eslint clean.
- Master export scratchpad/master-r6 (c2ed28384, web tree c4148b0c). Excludes: node_modules/, .vite/, *.tsbuildinfo; staged list checked, no cache files. Ported the 6 shared files with 3-way (workspaceRoutes.test tail re-added by hand). data.ts hand-ported (master has no transport encoder: explicit 503 planning_range_too_large). New master data.test.ts. The preservation case is dropped from the master test copy (master harness has no preservation mocks; the route is identical).
- Master RED: 10 fail at master code; GREEN 37; neighbours 28 files / 592 tests.
- Patch tasks/artifacts/release-r9-2026-10-20/R6-utf8-envelope-master.patch: 8 files, +237/−13; apply-check OK; G1 guard (manifest incl. check 4) PASS dac3d5d30. tsc running under the lock.
- Follow-ups (not owned): provider.ts also sends bridgeForecasts unmeasured; client localStorage preservation backup (RosterScheduleOptimizer.tsx:262) has no size check; the client could pre-check WORKSPACE_SAVE_BYTE_BUDGET before PUT.
- tsc (master-r6, lock held then released): EXIT 0. DONE; handed to Chef, nothing committed.
