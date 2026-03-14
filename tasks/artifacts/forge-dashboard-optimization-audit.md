# Forge Dashboard Optimization Audit

## Objective
Validate optimization readiness for dashboard dependencies by reviewing:
- Query scope and pagination strategy
- Payload size pressure points
- Expensive-path frequency risks
- Practical mitigation actions

## Endpoint Review

### `/api/team-ratings`
- Query scope:
  - Date filtered (`eq("date", selectedDate)`), optional team filter
  - Uses fallback table logic
- Risk level: Low
- Notes:
  - Small bounded result set (teams)
  - Good candidate for short cache TTL

### `/api/v1/forge/goalies`
- Query scope:
  - Date + horizon + run fallback logic
  - Includes uncertainty metadata and diagnostics payload
- Risk level: Medium
- Expensive-path risks:
  - Fallback + diagnostics fan-out (extra summary queries)
  - Larger row payload due to uncertainty model blob
- Mitigations:
  - Keep client cache TTL >= 60s
  - Monitor payload size and consider optional `includeDiagnostics=false` path for UI-only consumers

### `/api/v1/start-chart`
- Query scope:
  - Multi-table joins via application logic (games, projections, goalie rows, yahoo map, yahoo players, CTPI)
  - Week games + CTPI history adds extra scans
- Risk level: High (heaviest endpoint)
- Expensive-path risks:
  - Multiple sequential and fan-out queries
  - Potential payload growth from enriched players list
- Mitigations:
  - Maintain strict date filtering and row limits where possible
  - Add profiling for p95 latency and payload bytes
  - Consider optional reduced response mode for dashboard strip-only use case

### `/api/v1/trends/team-ctpi`
- Query scope:
  - Prefers daily precomputed table; falls back to on-the-fly compute path
- Risk level: Medium
- Expensive-path risks:
  - Fallback compute path can be expensive when daily table empty
- Mitigations:
  - Alert if fallback path frequency increases
  - Ensure `team_ctpi_daily` freshness pipeline is healthy

### `/api/v1/trends/skater-power`
- Query scope:
  - Paged reads from `player_trend_metrics` with optional position filter
- Risk level: Medium
- Expensive-path risks:
  - High limits can increase payload and sort/aggregate cost
- Mitigations:
  - Keep dashboard limits constrained
  - Track p95 for larger position=all windows

### `/api/v1/sustainability/trends`
- Query scope:
  - Snapshot + direction + position filter
- Risk level: Low-Medium
- Expensive-path risks:
  - Minimal when snapshot indexed and filters selective
- Mitigations:
  - Keep directional requests bounded (limit<=15 in shared loader)

## Shared Client Optimization Controls Implemented
- In-flight dedupe + TTL cache:
  - `web/lib/dashboard/clientFetchCache.ts`
- Response normalization to avoid repeated defensive parsing across components:
  - `web/lib/dashboard/normalizers.ts`
- Canonicalized goalie endpoint in shared orchestrator:
  - `web/lib/dashboard/dataFetchers.ts`

## Budget Baseline
Defined in `web/lib/dashboard/perfBudget.ts`:
- Team ratings max payload: 120 KB
- Forge goalies max payload: 220 KB
- Start chart max payload: 300 KB
- Team CTPI max payload: 180 KB
- Skater power max payload: 280 KB
- Sustainability trends max payload: 140 KB

## Follow-up Recommendations
1. Add server timing headers (`Server-Timing`) for the heaviest endpoints.
2. Add endpoint-level payload logging in non-production sampling mode.
3. Add alert threshold for repeated `/start-chart` p95 > target.
4. Consider endpoint variants for dashboard cards that only need a subset of fields.
