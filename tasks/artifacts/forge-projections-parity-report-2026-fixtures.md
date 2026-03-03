# FORGE Projection Parity Report (Task 7.2)

## Scope
Deterministic parity checks for fixture dates:
- 2026-01-24
- 2026-01-31
- 2026-02-08

Comparison target:
- Baseline: pre-modularization commit `a3f6173` (executed via `/api/v1/db/run-projection-v2`)
- Current: modularized runner on current branch (same endpoint/settings)

Query settings (both sides):
- `horizonGames=1`
- `maxDurationMs=270000`
- `bypassPreflight=true`

Artifacts:
- `tasks/artifacts/forge-projections-parity-report-2026-fixtures.json`
- `tasks/artifacts/forge-projections-parity-delta-summary.json`

## Run Pairs
- `2026-01-24`: baseline `1155cf5c-2949-44fc-b60e-e57fa4badf2b` vs current `7f9d6b9d-9d9f-42a8-97fb-f7ec55aa8ced`
- `2026-01-31`: baseline `831cc6a6-ed66-4fd0-917c-da30c324a37d` vs current `bd410c75-8c75-4dca-ab59-28d93d41cd3a`
- `2026-02-08`: baseline `a4514264-a64e-4285-8c14-c1230d7c309c` vs current `0c196dee-9860-4499-a3b7-528eccd03e84`

## Results
Global parity status:
- Row-count parity: PASS
- Identity-key parity: PASS
- Scalar-field exact parity: FAIL
- Uncertainty key-shape parity: PASS

Drift summary (numeric scalar fields only):
- 2026-01-24
  - `forge_player_projections`: 160 numeric diffs across 260 shared rows, max abs diff `0.005`
  - `forge_team_projections`: 4 numeric diffs across 18 shared rows, max abs diff `0.001`
  - `forge_goalie_projections`: 2 numeric diffs across 18 shared rows, max abs diff `0.0002`
- 2026-01-31
  - `forge_player_projections`: 223 numeric diffs across 404 shared rows, max abs diff `0.004`
  - `forge_team_projections`: 3 numeric diffs across 28 shared rows, max abs diff `0.001`
  - `forge_goalie_projections`: 1 numeric diff across 28 shared rows, max abs diff `0.0002`
- 2026-02-08
  - No games; all projection tables had zero rows on both sides.

## Interpretation
- Structural parity checks passed for row counts, identity keys, and uncertainty payload key-shape.
- Exact scalar parity did not pass.
- Observed drift is small (max abs delta `0.005`) and appears at rounding-sensitive projection fields.

## Approval Gate
No epsilon tolerance was pre-approved in the task definition. To close Task 7.2, an explicit epsilon acceptance is required (for example: `<= 0.005` absolute per scalar field).
