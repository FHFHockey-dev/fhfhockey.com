# WIGO ticket 6 receipt: drop the writerless wigo_rates read (B-14 / A-08), 2026-10-25

**Item:** B-14 / A-08 (P2 performance, plus a latent data-correctness risk).
- `fetchPlayerAggregatedStats` read `wigo_rates` on every player load. The table has 0 rows and no writer, and `buildPlayerAggregatedStats` lets any non-null `wigo_rates` value **override** the `wigo_career` per-60 values.
- **Effect today:** one wasted request per player.
- **Risk if anything refilled the table:** stale per-60s would silently replace the real ones.

**Fix** (WIGO lease only; nothing committed)
- The `wigo_rates` query and its error handling are removed. The builder gets `ratesData: null`.
- `buildPlayerAggregatedStats` keeps its `ratesData` parameter, so its existing tests (including the guard that a rates override can't revive missing recent denominators) are unchanged.
- The page now makes 3 aggregate reads instead of 4.

**Test:** new "fetchPlayerAggregatedStats sources" in `utils/fetchWigoPlayerStats.test.ts`.
- It asserts the reads are exactly `wigo_career`, `wigo_recent` and `wgo_skater_stats_totals`, with no `wigo_rates`. On the base code it would have traced 4 tables.
- It also checks STD Goals still resolves from career data.

**Files** (sha256 after; base = master e8b0c95c3 working tree)
```
f0da8590764f8fa06f31ef81d13418a745c042a8d066a7b6a7a75c9d0eec8298  web/utils/fetchWigoPlayerStats.ts
43d6b4a84abe3798d43bad283df83048471c11da4d69db496870175007cfe282  web/utils/fetchWigoPlayerStats.test.ts
```
Base:
```
5090d3be70d10b24922161e8ba32f6520e7c0ce7c7df908f6bbd6242fbd987a0  web/utils/fetchWigoPlayerStats.ts
1e572bc83e62096c729030363ed432a45a3196b60b1a8d8ac55d3d520412ab7e  web/utils/fetchWigoPlayerStats.test.ts
```

**Checks actually run** (canonical `web/`)
- `utils/fetchWigoPlayerStats.test.ts`: **30/30**.
- All WiGO scope suites (WiGO components, the page test, `useWigoPlayerDashboard`, and `fetchWigoPlayerStats`, `fetchWigoPercentiles`, `calculateWigoRatings` and `calculatePercentiles` under utils): **24 files, 189/189 passed**.
- ESLint on the 2 touched files: **0 problems**.
- **Not run:**
  - Whole-project `tsc`: the heavy lock was held by TG, and I did not take it. The change only removes a local variable and query, and leaves the exported signatures unchanged; ESLint's TypeScript parse of both files is clean.
  - E2E: the e2e fixtures answer any table, so removing a read doesn't change them.
- No `.module.scss` touched. No live reads, no Git, no `calculate-wigo-stats.ts`.

**Next candidates:** C-10 (PPG season average comes from totals while the bars come from the game log), B-20 (DIFF shows green for PIM increases), A-13/A-17 (search ordering, raw position codes), and A-07/B-15 (staleTime 0 refetch on focus).
