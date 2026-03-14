## trendsDebug pass-2 test coverage

Sub-task: `4.7`

This step adds targeted test coverage for the pass-2 validation-console surface and the read-only validation payload route.

### Added coverage

- [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx)
  - renders the validation console from a mocked pass-2 payload
  - covers blocked readiness and stale-tail messaging
  - covers focused metric comparison rendering
  - covers formula-panel rendering for the selected metric
  - covers refresh-prerequisite preview output
  - covers copy-helper clipboard output for:
    - formula-ledger entry
    - comparison block
    - refresh prerequisites

- [rolling-player-metrics.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.test.ts)
  - adds explicit server error coverage when payload generation throws
  - preserves method handling and selector parsing coverage from `4.3`

### Covered pass-2 expectations

- stale blockers appear in the debug-console freshness surface
- focused metric comparisons are visible without needing live Supabase access in the test
- copy-helper outputs preserve the artifact-boundary rule:
  - strict formula ledger output
  - separate comparison/rationale output
  - separate refresh/runbook output
