# W-B rolling writer correctness fixes (2026-10-21)
- Scope: forge audit Q10/Q11 — (1) season= scopes writes only, not history reads; (2) expected_sh_pct null-ixG skip; (3) drop null keys from support_payload sidecar.
- Where: octoberBranch, uncommitted. Files: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts (+ .test.ts). rollingMetricAggregation.ts untouched (generic coercion is a documented contract in rollingWindowContract.ts).
- State: fixes 1,3 + expected_sh_pct committed by TJ in ebdcfe6be; generic null-numerator rule in rollingMetricAggregation.ts uncommitted. Vitest 82 pass, eslint clean.
- Next: Chef runs tsc, decides on follow-up for expected_sh_pct_{ixg,shots}_{season,3ya,career} support pair (still total shots).
- Gotcha: supportRow still emitted when all pruned values are null (sidecar upsert replaces payload; skipping would leave stale values).
