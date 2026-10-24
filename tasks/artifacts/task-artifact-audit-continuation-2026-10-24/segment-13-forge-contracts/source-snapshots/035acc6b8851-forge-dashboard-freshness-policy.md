# Forge Dashboard Freshness Policy

## Purpose
Defines expected update cadence and maximum allowed staleness for each dashboard feed used in the Forge Dashboard audit.

## Policy Table

| Source | Endpoint | Timestamp Field | Max Age | Severity | Rationale |
|---|---|---|---:|---|---|
| Team Ratings | `/api/team-ratings` | `date` | 30h | error | Daily snapshot used for immediate decisions; must be current day or very recent fallback. |
| Forge Goalies | `/api/v1/forge/goalies` | `asOfDate` | 30h | error | Start/risk decisions are highly date-sensitive. |
| Start Chart | `/api/v1/start-chart` | `dateUsed` | 30h | error | Slate-based decisions require near-current date. |
| Team CTPI | `/api/v1/trends/team-ctpi` | `generatedAt` | 72h | warn | Trend context tolerates moderate lag. |
| Skater Power | `/api/v1/trends/skater-power` | `generatedAt` | 72h | warn | Trend-only mover feed, less critical than start/slate. |
| Sustainability | `/api/v1/sustainability/trends` | `snapshot_date` | 72h | warn | Signal remains useful with moderate lag, but should be surfaced as stale. |

## Implementation References
- Policy + evaluator: `web/lib/dashboard/freshness.ts`
- Automated checks: `web/tests/audit/dashboard-freshness-audit.spec.ts`

## Enforcement Notes
- `error` severity issues fail freshness audit (`ok = false`).
- `warn` severity issues do not fail audit but must be surfaced in audit outputs and dashboard stale indicators.
- Date-only timestamps are interpreted as UTC midnight for age calculations.
