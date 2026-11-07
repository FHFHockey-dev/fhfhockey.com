# WIGO ticket 2 receipt: STD season-guard fix (A-01 / B-03), 2026-10-25

**Item chosen:** A-01 / B-03, the top open P1 data-correctness item fixable offline.
- **The bug:** when `wigo_career` had no `std_*` count, the season-to-date (STD) column fell back to the **latest** `wgo_skater_stats_totals` row, read with no season filter. A player with no games this season showed last season's goals, assists, points, SOG, hits, blocks, PIM and PPP labelled as STD.

**Fix (lease paths only; no commit, no Git)**
- `buildPlayerAggregatedStats` takes `stdSeasonId`. The totals fallback applies only when `totalsData.season` equals the dashboard season; otherwise STD stays empty ("-"), never a guess.
- `fetchPlayerAggregatedStats(playerId, stdSeasonId)` passes the season through.
- In `useWigoPlayerDashboard`, the aggregate query key now includes the season. This partly addresses A-02: STD is tied to the dashboard season for the fallback, but `wigo_career` itself is still unseasoned.
- The query waits until the season resolves, so it runs once with the season instead of twice (an early season-less read plus a refetch).
- **Trade-off:** if the season lookup fails, the matrix stays in its loading state, as the totals and schedule already do (A-06).

**Files, sha256 after the change**
```
5090d3be70d10b24922161e8ba32f6520e7c0ce7c7df908f6bbd6242fbd987a0  web/utils/fetchWigoPlayerStats.ts
1e572bc83e62096c729030363ed432a45a3196b60b1a8d8ac55d3d520412ab7e  web/utils/fetchWigoPlayerStats.test.ts
3af2c9a74dd391ad3c25dcc7a803628b4ff25fe715195cd74de8d74a2f6f3629  web/hooks/useWigoPlayerDashboard.ts
f03a74ab6feb09bd53ac1452f48ab3e6b8f70947538a78937f88895b5802c9e5  web/hooks/useWigoPlayerDashboard.test.tsx
```
**Base sha256 (WiGO commit 4436789f1 as found in the working tree)**
```
9d10e9dae2afa77f3bfe3d7411268e91d4df7ba173d6a9cd658d59cc7e51f076  utils/fetchWigoPlayerStats.ts
93744bad7ab1312e7dd4749dd3c537705305a1fe1dd3e2b81493c46d40a736cd  utils/fetchWigoPlayerStats.test.ts
1438e51a5be91d85ce2c2fbd9ec589df05291a62fb75148625e34e772a49cc5f  hooks/useWigoPlayerDashboard.ts
35b42a08be20c90d6f76b6888685e8d073ea929ab3cfe1a6194bb9b3f9649446  hooks/useWigoPlayerDashboard.test.tsx
```

**Checks actually run** (canonical `web/`)
- Vitest: `utils/fetchWigoPlayerStats.test.ts`, `hooks/useWigoPlayerDashboard.test.tsx`, all of `components/WiGO` and the page test: 19 files, **163/163 passed**. A rerun of the two touched test files after the final assertion edit gave **43/43**.
  - New test: STD fills from totals only when the season matches; last season's totals and an unknown season give null.
  - New hook assertions: exactly one aggregate read per player, called with the resolved season.
  - Updated the old totals-fallback test to pass a matching season.
- ESLint on the 4 touched files: **0 problems**.
- No `.module.scss` touched, so no CSS pure check is needed. No dev server, Playwright, production reads or Git.
- **Resume check after the session-limit reset:**
  - All 4 files still match the post-change hashes above (`shasum -c` OK).
  - All 4 are WIGO lease paths.
  - Vitest: 19 files, **163/163** again. ESLint: **0 problems** again.
  - Whole-project `tsc --noEmit` (8 GB heap, under the heavy lock, released after): **exit 0, no errors**.

**Left open:** A-02 (`wigo_career` is player-only and unseasoned; a writer change plus recompute, ask-first), B-10 recompute, and the other items in `AUDIT-REPORT.md`.
