# Task 2 hydration and physical-head independent review

**Changes requested: one P2 in the retained physical-rate helper.** The new query/offline/fallback delta passes the focused checks, but the complete pinned candidate does not meet the requested unknown-history contract. This finding predates the eight-file task-2 delta; it is in an explicitly retained dependency, not a regression introduced by the new RPC guard.

## P2 — Treat an incomplete current-season count/exposure pair as unknown

Pinned `web/lib/projections/calculators/skater-adjustments.ts:503–506` independently normalizes `eventsSeason` and `toiSecondsSeason` with `nonNegative`, which converts `null`/missing values to zero. Hydration accepts partial historical payloads and correctly leaves a missing season count null (`queries/skater-queries.ts:223–233`). When season minutes are present but the season hit or block count is unknown, the calculator nevertheless applies full weight to those minutes and zero season events. This gives exactly the result of an observed zero-event season and biases the baseline down. The inverse partial pair can similarly over-weight known events against invented zero season exposure.

Two actual imported-code regressions demonstrate the first path through `fetchRollingRows` and then `computeSkaterPhysicalEventRates`, with current-season identity, 200 cumulative events, 240,000 cumulative seconds, a null season count, 120,000 season seconds, and no recent rate:

| Fallback position | Metric | Unknown season count result | Explicit zero count result |
|---|---|---:|---:|
| Forward | hits/60 | 2.0475409836065572 | 2.0475409836065572 |
| Forward | blocks/60 | 2.0090909090909093 | 2.0090909090909093 |

The query preserves null as expected; the error occurs in the calculator. See the final two cases in [adversarial.test.ts](adversarial.test.ts) and [ADVERSARIAL.log](ADVERSARIAL.log). These are synthetic correctness counterexamples, not measurements of real-data prevalence or predictive impact.

Validate the current-season numerator and exposure as a pair before applying the season split. If either is unavailable, retain an explicit unavailable state and use a documented fallback (such as the existing unsplit-history prior treatment) or reject that incomplete input; do not silently substitute an observed zero. Keep explicit numeric zero distinct and add both partial-pair regressions. Coordinate any repair with the current file owner; this reviewer made no application changes.

## What passed

- All **13 declared source pins** match the eight-file archive plus five retained dependencies. Tests ran in a non-Git temporary source extraction from base `84cb1229cd1c1cdd037c43e660d2a181304ada51`, overlaid with the exact eight archived files, with no environment files copied. The candidate patch reverse-check passes against that frozen tree. The concurrently leased live stage was not used for tests or edited.
- The **311 focused cases** from query, physical/helper, stage accounting, and native offline suites were verified. Initial execution passed 310; the receipt-writing case failed solely because the isolated snapshot has no Git metadata. Only that case was rerun, passing with an explicit test adapter supplying the pinned base and branch for exactly two metadata queries. No assertion or candidate source was changed. [Initial log](FOCUSED-TESTS.log), [isolated case](RECEIPT-CASE.log), [metadata adapter](git-metadata.cjs).
- **Nine of eleven independent adversarial cases passed**: F/D priors with wholly unknown history; explicit observed-zero handling; independently calculated seconds/minutes and current/prior season weighting for F and D; stale-season treatment; sidecar strength/season/event mismatch rejection; and zero RPC-property access through an awaited read-only capture. The two failures are the single partial-season issue above.
- Code review and the focused tests confirm one cached physical read per season/date, null caching on failure, a finite unavailable counter starting from an absent key, and one missing-RPC warning for both teams. `PGRST202` is distinguished from other provider/transport errors. The read-only guard runs before RPC property access; normal RPC calls request GET. There is no new table-scan fallback for league physical totals.
- All-strength rows feed the physical helper; split rows retain their aligned support. The unchanged stage converts seconds to minutes and then per-60 events, with the existing bounded all-situation TOI multiplier. Complete current-season data uses full weight and prior history half weight. Missing league totals retain constant F/D priors and scale 1. This validates mechanics only, not the calibration of those constants.
- Each of the 72 synthetic rolling rows differs from the base fixture only by the nine requested physical columns set to null. The new support input is empty. No physical observations were invented. Fixture bytes match `12953ed69ad7ab160c91f712bee24b3f891ce62092ce12ac7d0962a489d538fe`, including the updated checksum consumer.

All execution used Node 22.11.0 and npm 10.9.0 with existing dependencies, synthetic settings and a transport-denial preload. The 118 related owner cases, owner lint and full TypeScript were not rerun. The supplied TS log contains 11 diagnostics in `gameForecastPoints.test.ts`; that separately assigned concurrent test is outside this candidate. No claim of a passing full TypeScript build is made.

## Gates retained

The owner's 62-game / 2,074-dressed-skater-game rescore concerns historical a/b/a0/b0 reconstructions. It does not evaluate this candidate. The availability and replay receipts document absent physical/all-strength reads in those captures, no variant-c captures, and an unrecorded rolling-input failure on current-code replay. Those receipts were inspected, not re-executed in this review.

Release quantification remains held for a matched current-query cohort, variant c, all-head bias/RMSE/calibration and target-specific checks, and the real 20-player by 5-strength row-identical writer recompute. No synthetic test qualifies predictive skill, production Q5/Q6, migration application, or release.

Exact candidate, dependency, packet and review-evidence hashes are in [RECEIPT.json](RECEIPT.json); assembly provenance is in [SNAPSHOT.json](SNAPSHOT.json). No source edits, SQL, target-service requests, external production calls, commits or deployment. Review artifacts and diary are the only repository writes. There was no approval denial or uncertain external execution.
