# Homepage loading candidate handoff

## Implemented

- `pages/index.tsx` resolves the season once using the existing server reader, then reuses equivalent season/offseason dates. Removes both internal HTTP calls to `/api/v1/season`, so homepage rendering no longer triggers a nested development API compilation.
- Starts independent injuries, standings, news, injury news, player count and pulse reads concurrently with the slate path. Keeps their individual fail-soft handling; injury news now also survives independent general-news failure.
- Transaction Trends displays loading immediately and shares identical client requests for up to 30 seconds, including StrictMode remounts. Existing error messages and stale-result guards retained.
- API shares the public raw source snapshot for up to 60 seconds per metric/season/UTC day, including concurrent requests and changes of filter/window/page. Each response still recomputes its own filter and movement contract. Full history, older baseline observations, season fallback, source-date freshness and identity mapping are preserved. Cache has bounded entry count, does not retain failures, and measures freshness from read start.

Exact 10-file scope and SHA-256 pins: CANDIDATE.json. No changes to schema, provider writers, auth, global navigation or RSO files.

## Verification

- Five focused Vitest files: **63 tests passed**. Includes direct-season/no-self-fetch, independent-read concurrency, news failure isolation, StrictMode one-fetch, API cross-window snapshot sharing, cache expiry/failure/capacity, existing trend UI and ownership identity/provenance regressions.
- Focused ESLint: **passed**, no lint output.
- Scoped `git diff --check`: **passed**.
- Full TypeScript: **pending coordinator's combined final check** to avoid overlapping heavyweight runs.
- Fresh blank Chrome tab, no page inputs: final server handling **1.626s**, hydration **2.053s**, navigation-tool wall **2.011s**. Before warm comparison: **2.675s / 3.141s / 3.071s**. No nested season API request in this final navigation.
- Both trend tables populated with no browser console errors. Only one initial trend request, replacing two prior identical requests. Cold/invalidated API compilation and the first history read are still substantial; don't describe first cold fetch as instantaneous.
- Two bounded anonymous local API checks: uncached **11.339s**, cached **0.083s**, both 200, same source date 2026-11-10 and totals (89 risers / 200 fallers). This is process-local caching, not a production performance guarantee. HMR and serverless instance churn can make a request cold again.

Logs: tests.log, lint.log, comparison.json, after-route-timings.json. Original diagnosis retained in FINDINGS.md and before timing JSON.

## Release and limitations

Application files are handed off and no further edits are planned. No commit/push/build/deployment, migration, data repair or server restart performed by this lane. Release coordinator owns combined validation, reconciliation and publication. No schema optimizations were introduced: a future bounded-history/snapshot design must retain the prior-observation contract and needs separate migration review if chosen. Client skeletons cannot eliminate time before the first HTML document arrives.
