# 12 — Complete timeframe comparison table

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; main attraction, depends on 00.

## Scope and evidence

36 metrics × seven timeframes plus DIFF. Fetch merges wigo_career, wigo_recent and overriding wigo_rates, with latest totals fallback. DIFF compares counts per GP but compares rates/percentages directly. Writer uses last 20 logs without a season predicate. CA averages historical seasonal totals; it is not simply a career sum.

- [StatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/StatsTable.tsx)
- [TimeframeComparison.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/TimeframeComparison.tsx)
- [statMetadata.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/statMetadata.ts)
- [tableUtils.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/tableUtils.ts)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)
- [calculate-wigo-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts)

## Distinct implementation plan

1. Build a metric/timeframe contract matrix with source column, unit, numerator, denominator, included games/seasons and fallback precedence. Define STD, LY, 3YA and CA inclusion of current season and partial seasons; decide deliberately whether recent windows cross season boundaries.

2. Resolve conflicting NST TOI handling: recent ATOI divides summed TOI by 60 while per-60 assumes the sum is minutes. Verify source units with a known game. Resolve seasonal PPTOI total-versus-average and minutes-versus-seconds mismatch. Do not patch display scales to conceal writer defects.

3. Locate the live wigo_rates writer and scheduling/refresh metadata; it can override otherwise-correct career/recent rates. This audit did not locate its producer in inspected source paths. Independently reconstruct totals and weighted rates: count×3600/TOI_seconds; PP rates use PP seconds, not all-strength seconds.

4. Reconcile cross-provider games by stable game identity and coverage, rather than assuming date_scraped is a game date. Never combine complete counts with incomplete TOI silently. Preserve nulls when denominators or source coverage are missing.

5. Validate DIFF=(left−right)/abs(right)×100 after count/GP normalization; define zero baseline and same-period behavior. Explain relative percentage change versus percentage-point difference and distinguish increasing values from universally better performance.

6. Optimize the writer only after correctness: bound reads, fetch needed columns, reuse source rows and consider bounded concurrency for the current sequential player loop. Stage affected-player recomputes/diffs for review; production publishing requires explicit authorization. Preserve all 36 metrics and every timeframe in the UI.

## Verification and acceptance

Extend fetchWigoPlayerStats.test.ts, tableUtils.test.ts, statMetadata.test.ts and existing calculate-wigo-stats.test.ts with statistical fixtures (current writer coverage is only an error path). Fixture: 5 goals/100 minutes→3.0 G/60; 5 games→20:00 ATOI; 2 PPP/10 PP minutes→12.0 PPP/60. Acceptance: all 36×7 values have a documented contract and fixture/sample reconciliation; no removed rows, columns or precision to achieve speed.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
