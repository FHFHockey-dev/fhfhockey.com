# RECEIPT: bridge run proofs through the Yahoo provider path (lane RSO-YAHOO-DIET-P2)

This follows e2038b17a. That commit added the side channel (`forgeDailyBridge` → `onBridgeRunProofs` → `compactBridgeForecasts(…, proofs)` → `wire.proofs`, read with `bridgeRunProofs(wire)`) for `data.ts` and `yahoo-current-data.ts`. Here, `provider.ts` gets the same pattern. The work is uncommitted on top of 6c36c8e8c; no git mutations, provider or production reads, or GIT_DIR.

## Change
- `loadYahooPlanningSnapshot` takes an optional `onBridgeRunProofs` callback and forwards it to `loadPlanningData` **only when given**, so the call is otherwise byte-identical. The proofs never touch the snapshot, `PlanningData` or the returned result.
- `provider.ts` collects the served proofs in a request-local variable, exactly like `data.ts`, and passes them to `compactBridgeForecasts(snapshot.forecasts, snapshot, seasonId, proofs)`. So `bridgeForecasts.proofs` carries only the runs the wire carries.
- The response `snapshot`, which the client keeps and saves to the workspace, never contains proofs. The client rebuilds forecasts from the wire as before and stores no wire.
- Flag-off (and flag-on) output is unchanged apart from the optional `bridgeForecasts.proofs` field, which is present only when a served bridge run has a proof.

## Files

| File | sha256 at HEAD | sha256 now |
|---|---|---|
| `web/lib/integrations/yahoo/rosterPlanning.ts` | `5f778924ed4d3f0cd16a95169f0c1999b2c6f949ee1d1d3ff08b5b16b1d67c65` | `a86c1720d51c09d07d3a06b678e494ed6a1fe2da402d8175fc1fb7f878e4e33d` |
| `web/pages/api/v1/roster-schedule-optimizer/provider.ts` | `b4bcb961b9ae1f8bd27383b1f3bdf6f155b89ee643bd69f1c10fa02bfc5602b2` | `dacfff009388e1f0003ddaa3b6d68f212868318c4a77f5627cdd70529c334875` |
| `web/lib/integrations/yahoo/rosterPlanning.test.ts` | `32deab9f0c1757623ad06db2ed348eb9a6fb1613cdec1bca4d2463da5de35410` | `1ea6ddd39422553f909df26ec9f1942e0bb013c2ff081e0d0e0cc2761c2e88f4` |
| `web/lib/integrations/yahoo/yahooDiet.test.ts` | `1a646c24c4ab4a25e0f74fc131f55b0bafbb7da563585f6158751b5bb780c451` | `3a58e37985b1cde455e21e7865812b287110462fcc916c0d6e4b06077cc3638f` |

## Tests
- `rosterPlanning.test.ts`, provider route:
  - the proof of the served run rides on `bridgeForecasts.proofs` (and `bridgeRunProofs` reads it back);
  - the proof of a run that wasn't served is dropped;
  - the response `snapshot` holds no proof;
  - the forecasts rebuilt from the wire equal the originals;
  - without the side channel, there's no `proofs` field.
- `yahooDiet.test.ts`, with the flag on and off: the loader hands proofs to the caller only when asked; the result holds no proof; a call without the callback passes no `onBridgeRunProofs` key to `loadPlanningData`.

## Checks

| Check | Result |
|---|---|
| `rosterPlanning.test.ts` + `yahooDiet.test.ts`, `TZ=UTC` and `TZ=America/New_York` | passed: 106/106 in each |
| Wider set: `lib/integrations`, `lib/rosterScheduleOptimizer`, `lib/rosterScheduleData`, the RSO component folders, RSO API routes (94 files), UTC and NY | **12 failed in UTC, 11 in NY, none related to this change.** Failing files: `planningReproducibility.test.ts`, `dailyAcceptance.categories.test.ts`, `planning.test.ts` (credited goalie minimum) and `CategoryGains.test.tsx`, plus the 1000-player planning-engine timing test in UTC only. None of them imports Yahoo or provider code, and nothing under `lib/rosterScheduleOptimizer` is modified in the working tree. They arrived with or after 6c36c8e8c (FR9/FR10 packet). The same suites were green earlier today. Example: `planning.test.ts:1371` expected 1 and got null. **Handed back to the orchestrator / RSO-FLAKE.** |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (noclobber, released), 8 GB heap | passed, exit 0 |
| ESLint on the 4 changed files | clean |
