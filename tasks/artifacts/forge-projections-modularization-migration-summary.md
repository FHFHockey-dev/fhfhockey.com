# FORGE Projections Modularization Migration Summary

## Scope
Structural refactor and runner rename from `runProjectionV2.ts` to `run-forge-projections.ts` with parity-first constraints (no intentional behavior/math changes during parity phase).

## Files Moved/Created
- Renamed orchestrator entry:
  - `web/lib/projections/run-forge-projections.ts`
  - compatibility shim retained at `web/lib/projections/runProjectionV2.ts`
- New extracted modules:
  - `web/lib/projections/types/run-forge-projections.types.ts`
  - `web/lib/projections/constants/projection-weights.ts`
  - `web/lib/projections/utils/number-utils.ts`
  - `web/lib/projections/utils/date-utils.ts`
  - `web/lib/projections/utils/collection-utils.ts`
  - `web/lib/projections/utils/projection-metadata-builders.ts`
  - `web/lib/projections/queries/skater-queries.ts`
  - `web/lib/projections/queries/goalie-queries.ts`
  - `web/lib/projections/queries/team-context-queries.ts`
  - `web/lib/projections/queries/run-lifecycle-queries.ts`
  - `web/lib/projections/calculators/skater-adjustments.ts`
  - `web/lib/projections/calculators/goalie-starter.ts`
  - `web/lib/projections/calculators/goalie-save-pct-context.ts`
  - `web/lib/projections/calculators/team-context-adjustments.ts`
  - `web/lib/projections/calculators/scenario-blending.ts`
- Added module import integrity test:
  - `web/lib/projections/module-imports.test.ts`

## Import/Reference Updates
- Runtime route kept stable (`/api/v1/db/run-projection-v2`) while importing new module path:
  - `web/pages/api/v1/db/run-projection-v2.ts` -> `lib/projections/run-forge-projections`
- Script path updated:
  - `fix_terminal.sh`
- Internal docs/tasks updated for active-path references:
  - `FORGE_EXPLAINED.md`
  - `FORGE_ECOSYSTEM_ELI5_AUDIT.md`
  - `tasks/tasks-prd-projection-model.md`
  - `tasks/tasks-skater-forge.md`
  - `tasks/tasks-goalie-forge.md`
  - `tasks/goalie-forge-implementation-plan.md`

## Validation Outcomes
- Targeted module/import tests passed:
  - `lib/projections/module-imports.test.ts`
  - `lib/projections/runProjectionV2.test.ts`
  - `lib/projections/goalieModel.test.ts`
  - `lib/projections/goaliePipeline.test.ts`
  - `lib/projections/uncertainty.test.ts`
  - `lib/projections/derived/situation.test.ts`
- Type integrity:
  - `npx tsc --noEmit` passed.
- Full test suite:
  - `npx vitest --run` passed (`107/107`).
- Deterministic parity evidence (fixtures `2026-01-24`, `2026-01-31`, `2026-02-08`):
  - Artifacts:
    - `tasks/artifacts/forge-projections-parity-report-2026-fixtures.json`
    - `tasks/artifacts/forge-projections-parity-delta-summary.json`
    - `tasks/artifacts/forge-projections-parity-report-2026-fixtures.md`
  - Results:
    - row-count parity: pass
    - identity-key parity: pass
    - uncertainty key-shape parity: pass
    - scalar exact parity: fail with bounded drift; approved epsilon `<= 0.005` absolute per scalar field (approved on `2026-03-03`).

## Residual Risks
- Small scalar drift remains relative to pre-modularization baseline (max observed absolute delta `0.005`), accepted via explicit epsilon approval.
- `npm run build` currently fails on pre-existing unrelated lint issues outside touched projection scope (example: `pages/FORGE.tsx` `react/no-unescaped-entities`).
- Fixture date `2026-02-08` had no scheduled games, so parity coverage there is zero-row parity only.
