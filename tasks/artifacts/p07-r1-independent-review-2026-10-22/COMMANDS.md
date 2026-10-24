# P07 R1 independent commands and receipts

Candidate reconstruction followed r1/VERIFY.md: verify combined archive SHA-2561744faa8139dde75c8affd8457771b4eef7706725cddfa23019ae54996e6bf04 and overlay SHA-256a973d8ec1052033e9f6bd0f6fe49a89f6a1ce4c39130c8e1c2a657879ca631ac; extract into an ordinary temporary directory; copy four audit files and unchanged C08; verify all3372 hashes before changing only the private cache directory. Existing canonical node_modules was symlinked, not installed.

Executed in /tmp/fhfh-p07-r1-review-3mw_5nd7/web. Each test command below used this wrapper:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME=/tmp/fhfh-p07-r1-review-3mw_5nd7/web/.audit-home \
  TMPDIR=/tmp/fhfh-p07-r1-review-3mw_5nd7/web/.audit-tmp \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
  SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS='--require /tmp/fhfh-p07-r1-review-3mw_5nd7/web/audit-network-deny.cjs --max-old-space-size=8192' \
  npm test -- --run --config audit.vitest.config.mts <paths and filters below>
```

1. `lib/rosterScheduleOptimizer/executionAdapter.test.ts hooks/useRosterPlanning.test.tsx hooks/useCandidateMetrics.test.tsx lib/player-forecasts/rsoUsePolicy.test.ts lib/player-forecasts/p07BridgeClaimOracle.test.ts` —47pass, exit0; focused.log.
2. `lib/in-season/workspaceRoutes.test.ts __tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts lib/rosterScheduleData/planning.test.ts -t 'P07|serves interim|workspace|account|access|owner|capability|private|no-store|policy'` —29pass,108filtered/skipped, exit0; routes.log.
3. Copy p07ReviewFixture.ts and p07IndependentBoundary.test.ts from this artifact into scratch web/lib/rosterScheduleOptimizer/. First run (five cases, before appending review-expiry case): `lib/rosterScheduleOptimizer/p07IndependentBoundary.test.ts` —3pass,2clock-skew failures, exit1; independent-boundary.log.
4. After appending the sixth case: `lib/rosterScheduleOptimizer/p07IndependentBoundary.test.ts -t 'synthetic positive native review'` —1failure,5filtered/skipped, exit1; independent-review-expiry.log. Running the final artifact file without the filter reproduces all six cases.
5. Copy p07IndependentComponent.test.tsx alongside that fixture in scratch. `lib/rosterScheduleOptimizer/p07IndependentComponent.test.tsx` —1pass, exit0; independent-component.log. Actual implementation is imported, not an adapter/policy replacement. Initial harness assertion incorrectly counted access/workspace GETs together with /data; trace identified this and the corrected assertion checks exactly one /data GET and one execution. Earlier diagnostic retained in component-harness-diagnostic.log; not counted as a product defect.
6. `__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx -t 'eligible full-team evidence for goalie starts'` —1pass,208filtered/skipped, exit0; goalie-display.log.

No app code changed. Instrumentation lives only in scratch/test artifacts. Fixture identities and private-* strings are synthetic. All fetch operations above were mocks; network calls were blocked. Canonical integrity, historical stats pins and scoped billing baseline comparison used Python hashlib and read-only Git show/rev-parse. END-HASHES.json records the moving HEAD and unchanged35pins. EXTRA-BOUNDARY-HASHES.json records nine extra exact current/tested matches.

No broader suite, build, installation, production/DB/provider operation or retry of a denied action was performed.

