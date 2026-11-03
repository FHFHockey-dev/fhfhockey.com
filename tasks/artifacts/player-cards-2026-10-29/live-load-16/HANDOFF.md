# Checkpoint16 — selected-player load fixed locally

Usable URL: http://127.0.0.1:3125/player-cards/live?playerId=8484387&season=20262027&count=10 . Click **Load NHL results**. Name search and explicit NHL IDs remain supported. Existing `/player-cards/recent`, `/player-cards/current` and `/player-cards/search` aliases now use this loader. Numbered15/14 retain their saved snapshots.

## Cause and change
The old15 local server replayed Kucherov's landing data for every player. Michkov8484387 and Konecny8478439 failed identity validation locally (502, zero NHL requests), then the UI hid the specific reason. Reproduction screenshot and logs confirm this. The old browser harness completed its visible assertion/screenshot but hung awaiting response.json; timeout logs preserved. No browser launch failure is claimed.

The owned loopback server now uses the existing currentNhl provider with bounded secure public NHL transport: landing→selected-season game log→verified-current-team schedule. No credentials, DB/account writes, redirects or retry. Each selection up to3 GETs,5s/512KiB each,15s total. One load at a time,5min capture cache,12GET/min and60GET/server-lifetime ceiling. Window/category changes reuse the capture. A same-player reload may reuse the cache, as the preview banner states. No production deployment or hosted changes.

Frontend now shows bounded server error explanations instead of always hiding the cause. Only two owned application files changed; `source.patch` records them against pre16 even though another lane's integration has made them git-clean at HEAD `c91d8445fc4163686d63fa4e79fe9770f6531808`. No Git mutation was performed here. Shared artwork, math, formats and style defaults unchanged.

## Verification
- 38 Vitest cases,3 transport tests, scoped TypeScript and ESLint: PASS.
- Actual served browser: Michkov and Konecny each200/ready, correct identity/team; rates/results/recent-comparison controls and5/10/20 cached window behavior preserved; checked5 transition.
- Two1200×1020 PNG downloads and manifests verified. Independent raw counts/TOI match exports; source response hashes verified.
- 390/320 responsive layout, no horizontal overflow, no browser errors or external browser request attempts. Server made6 authorized public NHL GETs total, 396175 bytes; individual batches 422ms/412ms. Cached reload0GETs. No further reads for verification.
- Michkov10GP:7G2A9P15shots/9659s. Konecny only5 season appearances from source for requested10:0G3A3P8shots/5043s; explicit5/10 known-short label, not invented10GP.
- Actual exported Michkov PNG and Konecny mobile page pixels inspected. Phone page reflows; complete card's fine evidence text needs image zoom.

## Runtime and retained dependencies
Only ownedPID84959 replaced withPID22117 on127.0.0.1:3125. Latest HTML SHA619ea133c6fb72018f3740881c516c98f5059be313997a745a411464f38f48e7; saved15 byte readback unchanged. Detached session, no automatic restart; availability verified at handoff, not guaranteed indefinitely. Heavy verification slot released normally. Keep this entire artifact, live captures, `KEEP-RUNTIME.json` dependencies and source paths; no archives/deletions done.

## Honest limits / next work
PHI players' reviewed matching artwork is not bound: explicit image-unavailable fallback preserves statistics. League rank/N/percentiles, NST chance/on-ice metrics, strength splits, exact game-end times, historical cutoff, career milestones and goalie suites remain unavailable; no inferred formulas. Current sources are observed snapshots, not continuous refresh. Existing name catalog remains dated2026-10-24. Trade/history mismatches still fail closed. Richer visualization work remains next; Thursday follows card acceptance. No BLSH crossover or further styling added.

No coordinator message retried after prior denial. Evidence is local for parent independent review.
