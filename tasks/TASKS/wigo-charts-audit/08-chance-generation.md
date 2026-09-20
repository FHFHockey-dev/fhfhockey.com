# 08 — Team Chance Generation

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; shared loader owned here with plans 09–11.

## Scope and evidence

Latest nst_team_5v5 snapshots within a 22-day inclusive window feed xGF/GP. Higher is better; midrank percentile maps to strength/neutral/concern. Fetch has no season predicate, while special teams is season-filtered. Model requires at least 24 team identities, not necessarily 24 valid values for each metric.

- [TeamPerformanceDrivers.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/TeamPerformanceDrivers.tsx)
- [teamPerformanceDriverModel.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/teamPerformanceDriverModel.ts)

## Distinct implementation plan

1. Confirm snapshot season and that xgf/gp are matching cumulative 5v5 totals. Bound the lookup to the intended season using a real season field or authoritative season dates; do not compare stale previous-season 5v5 with current special teams.

2. Validate one latest row per team, snapshot dates and metric-valid cohort sizes. The 704-row cap assumption depends on unique team/date rows; verify uniqueness and pagination before relying on it.

3. Own a cached league snapshot fetch shared by all four cards and responsive instances. Preserve per-source as-of ranges and insufficient-data states. Do not re-fetch all team snapshots separately per card.

## Verification and acceptance

Extend teamPerformanceDrivers.test.ts for 24 teams but fewer valid xGF/GP values, duplicates, stale dates and zero GP. Acceptance: independently calculated xGF/GP and correctly oriented percentile, clearly labeled as team context. Check source coverage separately from total team identities.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
