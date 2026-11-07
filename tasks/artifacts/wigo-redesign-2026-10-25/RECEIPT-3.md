# WIGO ticket 3 receipt: rate-percentile GP sanitization (C-05), 2026-10-25

**Item chosen:** C-05 (P1). It was the highest-value open item fixable offline inside the WIGO lease that doesn't touch the `calculate-wigo-stats` route.
- **The bug:** the rate-stat percentile panel trusted NST's per-strength `gp`, which has been seen contaminated in production (GP 102 in an 82-game season, per LIVE-EVIDENCE).
- **Consequences:**
  - Users saw "Player GP: 102", and the min-GP slider ran past 82.
  - Contaminated rows passed min-GP filters and distorted TOI/GP.
  - One bad row inflated the cohort's maximum GP, so `isPercentileSeasonIncomplete` never flagged a stale current-season cohort, and an incomplete season was labelled complete.

**Fix** (one source file; no UI change needed)
- New exported `sanitizePercentileCohortGp` in `web/utils/fetchWigoPercentiles.ts`. It runs on the requested-season cohort in `fetchPercentileCohortForPlayer`, after the canonical WGO lookups that were already fetched (no new reads):
  - If the selected player's NST GP is above their canonical WGO GP, it is clamped to the canonical GP (the "Player GP" shown).
  - Any other row whose NST GP is above the season's WGO maximum gets `gp: null`. That row is then left out of min-GP filters, TOI/GP, the slider maximum and the staleness check.
  - With no canonical coverage (season max 0 or player GP unknown), rows pass through unchanged.
- The cached league rows stay raw; sanitizing is per player, after the cache.
- **Not covered:** a previous-season fallback cohort is not sanitized, because its canonical maximum isn't fetched. Adding it would cost one more small read.

**Files, sha256 after the change**
```
2a81c3d83a0530069e539e37c063d09ecc50ec5d8bd153ab9019e208cef7aeca  web/utils/fetchWigoPercentiles.ts
8eef5e8e024c7760a7ea5b916ada69928c74ac330bd87264b6d812c514191209  web/utils/fetchWigoPercentiles.test.ts
```
**Base sha256 (working tree after ticket 2, commit 1d91cbdd8)**
```
a0218435c570dc4fdf28c2823c6ccf2d16d999cd51c4fdaaceaf2b7a409b9ef9  web/utils/fetchWigoPercentiles.ts
4da118d336b2aeaccedc89a2f437068724c235be6902b0d37c272c5c7af74e32  web/utils/fetchWigoPercentiles.test.ts
```
`web/components/WiGO/RateStatPercentiles.tsx` is unchanged (hash re-checked).

**Checks actually run** (canonical `web/`)
- New tests in `utils/fetchWigoPercentiles.test.ts`:
  - "treats NST GP above the canonical WGO GP as invalid": clamp, exclude, and pass-through without coverage.
  - "detects a stale cohort even when one contaminated row reports an impossible GP".
  - **Regression proof:** with the sanitizer call disabled, the second test **fails** (1 failed / 7 passed). With it restored, **8/8 pass**.
- Vitest across all WiGO-scope suites (WiGO components, the page test, `useWigoPlayerDashboard`, and `fetchWigoPercentiles`, `fetchWigoPlayerStats`, `calculateWigoRatings` and `calculatePercentiles` under utils): **22 files, 177/177 passed**.
- ESLint on the 2 touched files: **0 problems**.
- **Not run:** whole-project `tsc`, because the heavy lock was held by C1 ("full npm run lint rerun", taken 18:32:15Z); I did not take it. No `.module.scss` touched, so no CSS pure check is needed. No dev server, Playwright, production reads or Git. Nothing committed.

**Left open:** C-02 (radar cohort, outside the lease: `hooks/usePercentileRank.ts`), C-03 and C-04 (F/D pooling needs position data), A-02 and B-10 (writer and recompute, ask-first), A-03, A-05, A-06 and the P2 fetch items in `AUDIT-REPORT.md`.
