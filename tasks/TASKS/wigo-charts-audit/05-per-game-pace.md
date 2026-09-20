# 05 — Per-game averages and 84-game pace

Status: complete locally; implementation and focused verification recorded below. Priority/dependencies: P1; depends on 04 totals contract.

## Scope and evidence

Current code calculates unrounded total/GP × 82 and labels Per-82. Rows are GP, G, A, PTS, SOG, S%, PPP, HIT, BLK and PIM. Shooting percentage is displayed directly, not projected; its fetch normalization guesses fraction versus percentage by magnitude.

- [PerGameStatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PerGameStatsTable.tsx)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)

## Distinct implementation plan

1. Replace the intended modern forward pace with 84 and make its basis explicit in label and calculation. Preserve actual historical totals. If this becomes a historical-season projection, obtain that season’s scheduled length rather than assuming all earlier seasons had 82 games.

2. Use total/GP × schedule length, round only display and never multiply S%, rates or GP into a count projection. Distinguish pace from a forecast of remaining games or injury-adjusted production.

3. Remove ambiguous percentage inference after confirming source units; verify S%=100×G/SOG where available and define zero-shots behavior. Reuse snapshot inputs.

## Verification and acceptance

Extend PerGameStatsTable.test.tsx with 42 points/21 GP→2.00 per game→168 per 84, 0 GP, null totals and S% unchanged. Check all labels and help text. The [NHL schedule announcement](https://www.nhl.com/news/nhl-announces-2026-27-regular-season-schedule) confirms 84 games beginning in 2026–27. This plan does not itself modify the pace.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.

## Implementation evidence — September 19, 2026

The table labels and help now specify a constant-rate 84-game pace. It computes unrounded count/GP × 84, displays rounded counts, and never projects GP or percentages. Historical totals remain unchanged. S% uses 100×goals/shots from the same totals row; zero/missing shots produce unavailable output. The shared season totals query also supplies the snapshot and trend references.

Eleven focused PerGameStatsTable tests pass: 42 points/21 GP gives 2.00 and 168, zero GP stays unavailable, missing counts do not become zeros, valid zero counts remain zeros, percentage is not projected, and stale source S% cannot override the counts. Live NHL totals were confirmed to store percentage fractions; the fetch adapter uses an explicit conversion. This completion does not certify the separate aggregate writer or publish data.
