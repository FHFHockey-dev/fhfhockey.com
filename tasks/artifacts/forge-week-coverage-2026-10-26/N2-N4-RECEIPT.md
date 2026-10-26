# FORGE reserve: N2, N4 and V3 receipt (2026-10-26)

Restart ticket from the orchestrator (`local_88650158`), after release #387. Base: octoberBranch at e6e5798bf, plus this work, all uncommitted. Everything ran locally and offline, and the reserve flag stays off: no production reads, no deploys, no git mutations, 0 NST requests.

## N2: confirmed lineup news outranks an unconfirmed availability report
`skaterState` in `web/lib/rosterScheduleData/forgeDailyBridge.ts` now applies confirmed news before unconfirmed news, in this order:

1. A confirmed "out" counts 0, with appearance 0.
2. A confirmed lineup slot counts the full line, with appearance 1. It beats an unconfirmed scratch report.
3. An unconfirmed scratch report gives `projected_scratch`.
4. An unconfirmed lineup slot gives `projected_lineup`.
5. Return, then uncertain, then the run-time reason.

Within one dimension, a confirmed assertion is the one that speaks.

Tests (both orders of each pair):
- unconfirmed out + confirmed lineup → `confirmed_lineup`;
- confirmed out + confirmed lineup → `confirmed_out`;
- unconfirmed out + unconfirmed lineup → `projected_scratch`;
- unconfirmed out + confirmed return → `return_reported`.

## N4: the team starter's stand-in line is labelled
A goalie with neither his own reserve row nor his own starter row borrows his team starter's line, and the forecast now says so:
- With an unknown start chance: `goalie:start_unknown_team_line`. The note ends "the 'if he starts' line is his team starter's."
- With a known start share: the label-only `goalie:team_line`, applied only with the reserve pass on. `isReserveLine` keeps it out of reserve withholding, both in the bridge budget and in `fitBridgeWire`. A known start is never dropped for a label.
- With the pass off: no label, as before (tested).

Tests:
- both codes, and both notes mention "team starter's";
- g1's own line stays unlabelled;
- a tight budget withholds the reserve rows but keeps g2's labelled forecast;
- the round trip is exact;
- the response trim keeps the label.

## V3: run proof travels with the bridge forecasts
- `forgeDailyBridge.ts`:
  - The loader attaches `runProofDiagnostics(runId, proof)` to each proven run. This is a read-only use of `lib/projections/externalInputProof`; no proof file was edited.
  - The result gains `runProofs`, covering only runs that served rows after trimming.
- `bridgeForecastWire.ts` (**in the producer closure**):
  - The wire gains an optional field `proofs?: BridgeRunProof[]` (runId, basis, releaseSha, closureSha256).
  - `compactBridgeForecasts(..., proofs?)` keeps only proofs for runs the wire carries.
  - `bridgeRunProofs(wire)` is a validating, display-only reader for the client.
  - Forecasts, `expandBridgeForecasts` and the snapshot schema are unchanged.
- `planning.ts`: the new option `onBridgeRunProofs` is a non-transported side channel. It is not on PlanningData, planningTypes or planningDataTransport.
- Routes `data.ts` and `yahoo-current-data.ts` pass the proofs into `compactBridgeForecasts`.
- **Not wired: `provider.ts`.** Its bridge path is `loadYahooPlanningSnapshot` in `lib/integrations/yahoo/rosterPlanning.ts`, which is outside the lease. Wiring it means passing `onBridgeRunProofs` through and handing the proofs to `compactBridgeForecasts`. Until then, provider responses carry no `proofs` field; the current-read routes do.
- The RSO component was not touched (rso-flake owns it). It can read the proofs with `bridgeRunProofs(body.bridgeForecasts)`.

Tests:
- bridge: `runProofs` match the served runs;
- the wire carries only proofs for runs it serves, survives JSON, and a malformed list yields none;
- byte-identical: the result JSON equals the plain result apart from `runProofs`, and the wire JSON equals the plain wire apart from `proofs`;
- **never saved**: after the client expands, `packPlanningSnapshots` output, the unpacked save and the forecasts contain no proof;
- loader: the snapshot-proven run reports `basis: "captured_snapshot"`;
- `planning.test.ts`: the side channel receives the proof and the returned PlanningData does not contain it;
- `data.test.ts`: the route sends `bridgeForecasts.proofs` for the served run only, the strict transport has none, and there is no field without the side channel.

## Checks
- vitest, affected set (`lib/projections`, `lib/rosterScheduleData`, `lib/rosterScheduleOptimizer`, `lib/in-season`, `lib/player-forecasts`, `lib/integrations/yahoo`, the RSO, start-chart, projections and forge API tests, RSO components): **188 files, 4,940 tests passed (1 skipped) in both UTC and America/New_York.**
- eslint: clean on every changed file.
- tsc, whole project, under `/private/tmp/fhfh-heavy.lock` (noclobber, never stolen): **exit 0** (2026-10-26T19:00:59Z).
- Closure: `verify-forge-release-sha --worktree`: **VERIFIED, 0 findings**, closure `dd6ec27d7ac0b38615d017035c46d169379a6224518ed6fa8a2a080342fdae44`, 194 modules, 21 dynamic table sites. The id changed from `c1f0129a…` because **`web/lib/rosterScheduleData/bridgeForecastWire.ts`** is the one closure file changed here. The allowlist was not edited. The verifier's output JSON was removed from the tree; re-run it at the next release candidate.

## Files (sha256)
- `web/lib/rosterScheduleData/forgeDailyBridge.ts` fc01b875e9b7a48e4cd27e3edf8bf3b76fc83aebf7e0ca2c839d58e26e882c11
- `web/lib/rosterScheduleData/forgeDailyBridge.test.ts` fa1ef5f5dbaba69a2ff131ae247d9a79b4af4f86f2adb682d40713bb4d3931c1
- `web/lib/rosterScheduleData/bridgeForecastWire.ts` 28f96a0482a02fd8494d21c5cfb92a21b22f39d8fd2b65d16332e84131d2f49c
- `web/lib/rosterScheduleData/planning.ts` 06ba406c2cb657fbfbc6e36ecfbc89f2a4ffc134fbf471baf9a6b01be938971c
- `web/lib/rosterScheduleData/planning.test.ts` 338de9b71edfcbb4e05264e13003100662eeab37fb9592635b7cb73468a980d5
- `web/pages/api/v1/roster-schedule-optimizer/data.ts` d605311bb06704c9a7bb738572de7215e0280cebe2cc9ba3869ee6ab96e57cb5
- `web/pages/api/v1/roster-schedule-optimizer/yahoo-current-data.ts` 05069f9e209f42e90d086332f1e17591684c5ed971c161d5774f3922a345c335
- `web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts` 5af60c9c5d9d2ee568d4baaa5e40ca92172f2f6c826a41183b461c300e5e10a5
- `tasks/diaries/2026-10-26-claude-forge-reserve-pass.md` 1ea65b08b9aa133c3198b5dc9521487ad6c6010bc95da7f48fe874c2f1f8a816
