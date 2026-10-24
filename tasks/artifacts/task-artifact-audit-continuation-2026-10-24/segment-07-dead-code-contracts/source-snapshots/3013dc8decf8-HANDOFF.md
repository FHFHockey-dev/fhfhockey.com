# WiGO local data fix — ready for independent review

Status: local implementation and focused verification complete; **independent review/acceptance pending**. No workers spawned. Application changes remain in the sole canonical checkout, with no Git operations. Baselines were current working-tree bytes, preserving all prior modifications rather than reconstructing HEAD.

## Exact change and review files

| File | Change |
| --- | --- |
| [calculate-wigo-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:276) | Check all six seasonal/game-log source results for errors; build the recent window from NHL appearances first; validate unique game IDs, matching season and regular-season identity; read NST using those exact dates/seasons, without an independent latest-20 limit. |
| [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts:252) | Recent rates and their support come from one `wigo_recent` snapshot. Legacy rate fields cannot erase or replace supported recent values, including valid zero. Historical legacy behavior is retained. |
| [calculate-wigo-stats.test.ts](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts:242) | Extend nearest route suite with Kucherov-shaped current/prior regular-season appearances plus seven intervening NST postseason dates, with/without October 5, all six read failures, participation/zero-count and invalid/duplicate/season/type protections. New query mock applies filters, ordering, limits and projections. |
| [fetchWigoPlayerStats.test.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.test.ts:217) | Valid recent points, zero goals and PP rates survive null, missing, NaN, zero or stale numeric legacy values across all three recent windows. Existing missing-support protections remain. |

Exact combined incremental diff: [WIGO-DATA-FIX.patch](WIGO-DATA-FIX.patch). Separable review patches: [01-builder-window-and-errors.patch](01-builder-window-and-errors.patch), [02-recent-rate-authority.patch](02-recent-rate-authority.patch). Original working-tree bytes are in `baseline/`; frozen candidate bytes are in `candidate/`; exact before/after SHA-256 values are in [SOURCE-PINS.json](SOURCE-PINS.json).

Coordination record: `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/WIGO-DATA/WIGO-DATA-FIX-20261024-LEASE.json`. Neither coordinator nor Claude leases named any of the four exact scoped files. Git status/diff was not queried because Git was explicitly prohibited; diffs are generated against captured working-tree baselines. No C4 WiGO page, UI test, styling, manifest, lockfile, tooling, migration, original report, original ten-case result, or production-diagnostic artifact was edited.

## Behavior preserved and boundaries

- WiGO still means last N **regular-season appearances across seasons**. This does not impose the new-card PRD's still-separate season/carryover decision. NHL `games_played=1` defines an appearance; scratches are excluded, zero-count played games remain.
- Table schema has a unique `(player_id,date)` index; duplicate/invalid game identities are rejected rather than silently counted. The regular-season NHL game-ID prefix must agree with `season_id`; missing NHL season now fails explicitly rather than publishing unverified counts.
- NST individual/on-ice metrics still require exact season/date coverage. Missing October 5 keeps dependent L10/L20 metrics null. No NHL exposure fallback was added, and no missing NST numerator is fabricated.
- A synthetic complete L5 frame produces supported rates when the builder is invoked. Existing persisted L5 nulls are **not changed by editing code**. Source-arrival versus old computation chronology remains unproven.
- A source error now throws before the affected player is appended to output batches. Existing batches already written for earlier players are not transactionally rolled back; the route is still a broad batch job. Legacy rows with missing/inconsistent NHL identities will now stop the route instead of publishing their invalid frame. A population-wide compatibility audit was not authorized or run.

## Checks actually run

Environment: Node **22.11.0**, npm, owning directory `web/`; `GIT_DIR` absent/removed; inert synthetic Supabase configuration, all route/client transports mocked. The existing route middleware remains except explicit identity mocks for audit/off-season wrappers. Real exported application functions are exercised by Vitest; test inputs are synthetic and no real database writes occur.

- Before runtime fixes, new regression suite: **17 failed / 41 passed** ([red-tests.log](red-tests.log)). These expose source selection, ignored failures, invalid participation/identity and legacy override defects.
- First candidate test pass: **57 passed / 1 failed** ([green-tests-1.log](green-tests-1.log)); the sole failure was floating-point `2.3999999999999995` versus exact `2.4`. Replaced that arithmetic assertion with `toBeCloseTo`, retaining exact-null checks for missing inputs.
- Final focused suite: **58/58 passed**, two files ([focused-tests.log](focused-tests.log)):
  `npm test -- --run __tests__/pages/api/v1/db/calculate-wigo-stats.test.ts utils/fetchWigoPlayerStats.test.ts`
- Scoped ESLint: **passed**, exit 0 ([eslint.log](eslint.log)):
  `npx --no-install eslint pages/api/v1/db/calculate-wigo-stats.ts utils/fetchWigoPlayerStats.ts __tests__/pages/api/v1/db/calculate-wigo-stats.test.ts utils/fetchWigoPlayerStats.test.ts`
- Whole-web TypeScript: **failed**, exit 2, **only two pre-existing unrelated errors**, no errors in scoped files ([typescript.log](typescript.log), [timing](typescript-result.json)):
  `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit --incremental false`
  Existing errors: `lib/sources/tweetLunaReview.test.ts:192`, `scripts/review-ifttt-luna.ts:22`, both Buffer/BinaryLike. Same two errors are recorded in the earlier C4 receipt. Incremental output disabled to preserve generated files.

Each check acquired `/private/tmp/fhfh-heavy.lock` atomically only while absent and released its own lock afterward. No server/ports/Next cache, dependency install, build, browser/E2E, full suite, Git or deployment was used. No production reads were added beyond the earlier approved two-SELECT diagnosis.

## Parent/reviewer next steps

1. Review the pinned four-file incremental diff independently before acceptance. In particular review invalid-frame fail-closed behavior, exact season/date filter semantics, unchanged true-gap nulls, and current snapshot authority.
2. If accepted, integrate/release through the parent's normal custody and separate deployment authorization. This worker has neither committed nor deployed anything.
3. Production L5 still needs an explicitly approved bounded re-materialization after the corrected candidate is released. The existing route has no single-player execution option and still enumerates all non-goalies; do not invoke it as an implied single-player refresh. Add/review a bounded execution path if required before requesting execution approval.
4. October 5 ingestion repair/backfill remains separate and unapproved. L20's six older unmatched dates were only absent from the old selected NST slice, not proven absent in the underlying table; no broader backfill is justified from this evidence.

Independent review pending is the remaining acceptance gate, not an execution denial. No external action has an uncertain outcome or pending approval request.
