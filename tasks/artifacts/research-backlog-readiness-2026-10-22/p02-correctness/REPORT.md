# P02 goalie correctness — local review packet

Implemented the bounded corrections in **nine leased source/test files** on `octoberBranch`, HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`. Independent review is pending. All **13 A7–A9 candidate pins remain byte-identical**; the lease has no overlap. Pre-existing `statsPageFetch` source/test changes are retained, and [packet.patch](packet.patch) describes only this packet's delta against captured working-tree bytes.

[Exact lease](LEASE.md), [before/after hashes and checks](CANDIDATE.json), [application checksums](SHA256SUMS), and [tested import-closure pins](TESTED-SOURCE.json). Candidate manifest SHA-256: `ed8550bfaf63983d71bd8f203de16f3fd5ac1013409db1bae1b169d6d266a275`. The `before/` and `after/` directories preserve all leased source bytes needed for independent comparison.

## What changed

| Defect / actual code boundary | Corrected behavior | Regression evidence |
| --- | --- | --- |
| Missing GAA became 0 and ranked first in `fetchStatsData` | Reported goalie ratios are finite nonnegative numbers or null; SV/QS fractions must also be ≤1. Each numeric ranking excludes missing values and requires positive played-game support. A goalie with an unknown ratio can still remain in the wins list, carrying null for that ratio. | Full imported `fetchStatsData` with in-memory query boundaries: missing versus observed GAA2 versus true GAA0, invalid primitives, no games, out-of-range fractions. Existing pagination/season/position tests preserved. |
| `aggregateSummaryStat` averaged game GAA across unequal exposure | GAA uses paired GA and numeric `time_on_ice` seconds: 4 GA over 4,200 seconds gives 3.428571 rather than 4.5. Any missing/invalid pair or zero total exposure returns null; positive GA at zero exposure is invalid. | Actual imported helper: 60-minute start plus 10-minute relief; unknown, clock-string, blank, nonfinite and negative exposure; true zero and missing GA. |
| Contextual SV independently summed incomplete counts | Shared goalie SV aggregation now requires complete valid saves/shots pairs across the supplied window. Contextual regular/playoff displays reuse it on appearances and withhold values when participation is unknown. Missing ratios receive an unavailable explanation, not a performance label. | Actual helper and rendered component: 27/30 plus missing/10 returns unavailable, not .675 or an undisclosed .900 subset. Valid 27/30 +10/10 gives .925; known nonappearance excluded, unknown participation withheld. |
| QS divided by appearances; missing classification became 0 | `summarizeQualityStarts` uses known starts with binary source QS classification. Relief stays an appearance but is outside the QS denominator. Missing start identity or incomplete classifications withhold the rate. The UI reports classified-start coverage instead of labeling unknown data “Inconsistent starts.” | Actual rendered component: one QS in two classified starts plus relief gives 50%; true classified zero remains 0%; relief-only, unknown starts and missing/invalid classification remain unavailable. |
| Desktop formatter hid observed zero | Null checks distinguish observed SV .000, GAA0.00 and QS0.0 from unavailable. Nullable types match transport; existing mobile formatting already supported null/zero. | Actual desktop component zero/empty tests; unchanged mobile and landing-page tests pass. |

No goalie projection weights, team-xGA influences, historical forecast inputs, source selectors, migration, dependency, release setting or canonical register was changed. This is count/exposure admission and presentation correctness, not a new predictive formula.

## Distinction from the research audit

- The prior `goalie/P02-OVERLAP.md` ran unchanged extracted function bodies/blocks in a VM. It was useful characterization, but not a React render or full-module query reproduction.
- This packet's tests import the actual `playerStatsContract`, `PlayerContextualStats`, `PlayerSummaryStrip`, `fetchStatsData`, and desktop component. Service boundaries are mocked; calculations, mapping, ranking and rendering are real application code. Existing mobile and landing-page consumers are also tested.
- Main-audit **GR-D1** concerned the separate fixture-only SKO interpreter accepting impossible counts. It is **not** one of these P02 fixes and remains unchanged. GR-D2–D5 FORGE reader/workload/rest/date findings likewise remain separately owned. No production incident is inferred from either packet.
- The changed `playerStatsContract.ts` necessarily differs from older research whole-file hash pins. Those historical SOG/goalie receipts were not rewritten or rerun to pretend their old snapshots still match. This packet retains the pre-edit bytes and current regression evidence. Existing appearance/window/season behavior remains covered by the unchanged contract tests.

## Current data limits

The player-page goalie query still omits `quality_start` and `time_on_ice`. This patch **intentionally renders those unsupported summaries unavailable** rather than fetching extra fields or inventing classifications/minutes. The summary-component test exercises this state. A later field hydration/adapter packet must establish source completeness, grain, identities and units before enabling more values; SSR/radar files and PlayerStats/types remain untouched.

Numeric seconds follow the repository's WGO mapping (`update-wgo-goalies.ts:676–693`, `stat.timeOnIce`) and existing seconds display convention. The helper accepts numeric primitives only; formatted clock strings and numeric strings are withheld rather than guessed. This is not a fresh provider-unit or production-data certification. Landing-page seasonal ratios remain supplied provider values with numeric admission checks; this packet does not reconstruct their classifications or reconcile different landing/profile seasons. Trade/season/window joins, live QS definition/version and broad P02/S07/S12 acceptance remain open.

## Verification

| Check | Result |
| --- | --- |
| Imported-code regressions before fixes | **38 expected assertion failures, 41 passes** across four files. All requested defect families reproduced. [Receipt](REGRESSIONS-RED.log). |
| First corrected focused run | 82 passed, including unchanged mobile tests. [Receipt](FOCUSED-GREEN.log). |
| Final corrected candidate | **96 passed across six files**. Includes source helper, contextual/summary rendering, mapper, desktop/mobile formatting and landing page. [Receipt](FINAL-TESTS.log). |
| Scoped TypeScript | **Passed**, all leased files plus imports and mobile/landing consumers. Initial check caught one incomplete test fixture; it was corrected to satisfy the existing goalie-log type without an application/type-contract workaround. [Initial diagnostic](TYPECHECK-initial.log), [final receipt](TYPECHECK.log), [scope](tsconfig.p02.json). |
| Changed-file ESLint | **Passed**, zero errors/warnings. [Receipt](LINT.log). |
| Diff/pins | Tracked diff check passed; all nine final source/test hashes match the tested snapshot, and all 13 A7–A9 hashes match their accepted candidate. Packet-only diff inspected; authored additions checked directly because two tests are untracked. |

Runtime Node22.11.0, installed Vitest3.2.7 and TypeScript5.7.3. Test runs emitted the existing dependency `punycode` deprecation warning; no test/network-guard failure remains. No full application suite, browser, build or remote validation ran.

## Offline reproduction

From repository root, [stage.cjs](stage.cjs) copies the nine-file lease and bounded local import closure (50 files in this run) to an isolated temporary tree, pins bytes, excludes environment/credential/session-store paths and reuses installed dependencies. It does not install anything or import the application during staging. A network-deny preload and setup guard block unmocked socket/HTTP/fetch requests. Test processes receive only an explicit inert environment; no local environment file is copied.

```sh
node tasks/artifacts/research-backlog-readiness-2026-10-22/p02-correctness/stage.cjs
```

Use the returned directory as `<snapshot>`:

```sh
sh tasks/artifacts/research-backlog-readiness-2026-10-22/p02-correctness/run-tests.sh <snapshot> \
  components/PlayerStats/playerStatsContract.test.ts \
  components/PlayerStats/PlayerContextualStats.test.tsx \
  lib/NHL/statsPageFetch.test.ts \
  components/StatsPage/LeaderboardCategoryGoalie.test.tsx \
  components/StatsPage/MobileTabInterface.test.tsx \
  __tests__/pages/stats/index.test.tsx
```

Final tested snapshot: `/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/fhfh-p02-check-71Z5S7/isolation/snapshot/web`. Scoped tsc and ESLint were executed there via installed Node binaries with an empty/inert environment and the same network-deny preload. A reviewer should verify candidate hashes before reproducing; later canonical edits do not belong to this candidate.

No external calls, credentials/private-data reads, migrations, commits, pushes or deployments. No action is denied, pending approval or uncertain. Remaining gates are independent review and the separate data/source integration work described above.
