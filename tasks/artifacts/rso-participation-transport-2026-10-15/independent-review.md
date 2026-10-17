# Independent review — RSO participation transport

Verdict: **ACCEPT the exact eight-file transport/schema increment.** No actionable findings within this bounded delta. Acceptance does not qualify the shared producer/model, grant participation uses, authorize account/live operations, or automatically change release membership.

## Reviewed behavior

- `refreshForecastInputs.ts:19` assigns the newly read participation catalog alongside forecasts and baseline sources. Both an explicit empty array and `undefined` replace the former catalog; no old-catalog fallback is introduced. The new evidence fallback is partial and explicitly unverified. Existing provider identity/time guards, provider arrays, rules, locks and non-statistical evidence remain intact.
- `workspace.ts:284` transports the same field into retained-roster snapshots. The surrounding code still downgrades availability, acquisition timing and acquisition budget authority. The new retained-roster fixture checks those restrictions and preserves denied totals use, catalog emptiness/absence, and input immutability.
- `RosterScheduleOptimizer.tsx:575` carries the field into the manual snapshot. The connected branch already uses the reviewed refresh helper. The new component case observes the catalog during evaluation and checks that strict save parsing preserves it and its denied use. The previously accepted save-context correction is not changed by this delta.
- `workspaceSchema.ts:51–65` defines strict model metadata and reuses a single strict participation receipt schema for both the top-level catalog and retained resolved-contribution inputs. Version, event, uncalibrated status and unavailable calibration are literal values. Hashes require 64 lowercase hexadecimal characters; numerator/denominator are bounded integers with numerator no greater than denominator; selected game identifiers must be positive, unique and at most 20. Probability remains finite and within [0,1]. The catalog and optional manifest metadata are preserved by parsing; empty catalogs, empty revision lists and null checksums are retained.
- Tests exercise metadata round-trip at both receipt locations, denied permissions, explicit empty/absent catalogs, partial fallback evidence, malformed hash/count/identifier bounds, promoted status/calibration, and unexpected private fields. Existing legacy snapshots may omit these optional additions.

This schema validates transport representation, not historical truth or admission. In particular, schema parsing alone does not prove the probability equals numerator/denominator, that selected-game count equals denominator, that hashes bind authentic source evidence, or that clocks/permissions are qualified. The available shared resolver contract applies further modeled-receipt checks, including ratio/count consistency and exact identity/time/use restrictions. That shared implementation remains FORGE-owned and requires its separate frozen review; no acceptance of it is inferred from this report. The transport layer itself does not calculate probabilities, modify permissions or claim calibration.

## Exact accepted pins

| Path | SHA-256 |
| --- | --- |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.ts` | `a77283cfdced008068f95cebb0dcc40315c70595cd28f8e55a0577d06384a594` |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts` | `2ee6ec70b8b1441b9de23ae33aa0ed142afae414912e892eed6bae964fffe47d` |
| `web/lib/rosterScheduleOptimizer/workspace.ts` | `8a82c0f7c21f031402e0a3d6a480de12a8e780a9fe2f5097236bce64e00fcb3f` |
| `web/lib/rosterScheduleOptimizer/workspace.test.ts` | `4c5666efe9b30203ded0f4d20aa64eeb479a9af28acffa703ab541e41bbe6810` |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | `add9e0ed99b3deac8fbb19a610ff1bd2e0cb5ab1ac1591815c58a22cd01551c4` |
| `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | `79c1cd78bd3279ad8eaa5bc81d093e0159de41c39dcc49e875caea0f139e9b3a` |
| `web/lib/in-season/workspaceSchema.ts` | `692c0c5de370f9e1586fa3f37da49076eaa6cd0bcec09844c04a5865838abee6` |
| `web/lib/in-season/workspaceSchema.test.ts` | `a9377b9e8d8310f2778c0c54f875d9033844c042b66bbc2c3f1fab3d5e33a133` |

Artifact hashes observed at review:

- `change.patch`: `6fff00375696ead9c27c9d3de1f83bad420ffb23e26572f663c1011039bf8aee`
- `receipt.json`: `1a6d9e03e2136db7a317dc2a9ac709da304a024d2d217d68bf79d24ca8b531f1`
- `before.json`: `55f57186de7bb1c043e859eca67557e4f3cb747788a6ff97804c9a63abd44b01`

All eight before copies match their declared hashes. Independent offline application of the patch reproduces every current file exactly, and all eight current hashes match the receipt. Patch paths equal the declared eight-path scope.

## Verification and limits

The retained author receipt reports 73/73 library/schema tests passed (25 refresh, 23 workspace, 25 schema), two affected main-component cases passed with 195 skipped, scoped ESLint zero errors/three existing warnings, and whitespace check passed. Tests and source were inspected; these checks were not rerun by the reviewer.

Reviewer actions were read-only source/test/necessary shared-contract inspection, SHA-256 checks, and offline patch reconstruction. This report is the only reviewer-written file. No application source, shared producer or release manifest was edited. No compiler, build, browser, worker, model, database, provider or network operation was run.

The earlier successful combined TypeScript receipt predates this increment and does not verify it. A coordinated compiler check must bind these eight accepted pins plus the final separately reviewed shared-source cohort. FORGE remains the sole combined compiler owner; none was started here. Synthetic transport/save-schema fixtures do not establish genuine denominator evidence, qualified participation forecasts, real account save/restore acceptance, or public release readiness.
