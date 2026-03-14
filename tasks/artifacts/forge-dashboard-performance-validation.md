# Forge Dashboard Performance Validation (6.3)

Date: 2026-03-05  
Environment: local Next.js dev server (`http://127.0.0.1:3000`)  
Raw data: `tasks/artifacts/forge-dashboard-performance-results.json`

## PRD Targets

- Warm initial dashboard interactive: `<= 2500ms`
- Key endpoint p95 latency: `<= 800ms`

## Initial Dashboard Load (Warm Cache)

- Sample count: `10` (after `2` warmups), viewport `1440x900`
- `loadEventEnd` p95: `466.5ms` (PASS)
- Dashboard-ready p95 (`loadEventEnd + no-loading-state`): `1433.47ms` (PASS)

Assessment:
- Warm-cache initial interactivity is within PRD target in this local environment.

## Key Endpoint Latency (p95)

| Endpoint | p95 (ms) | Target (ms) | Result |
|---|---:|---:|---|
| `/api/team-ratings?date=2026-03-05` | 3.51 | 800 | PASS |
| `/api/v1/trends/team-ctpi` | 364.30 | 800 | PASS |
| `/api/v1/trends/skater-power?position=forward&window=3&limit=60` | 1034.33 | 800 | FAIL |
| `/api/v1/sustainability/trends?...` | 94.68 | 800 | PASS |
| `/api/v1/forge/goalies?date=2026-03-05&horizon=1` | 576.16 | 800 | PASS |
| `/api/v1/start-chart?date=2026-03-05` | 1130.37 | 800 | FAIL |

## Findings

- Two key endpoints exceed PRD p95 target:
  - `skater-power` (`1034.33ms`)
  - `start-chart` (`1130.37ms`)
- This creates a clear optimization backlog item for `6.4`.

## Notes

- Results are from local dev mode and are best used for regression directionally.
- Final launch confidence should include staged/prod-like measurements with representative data volume.
