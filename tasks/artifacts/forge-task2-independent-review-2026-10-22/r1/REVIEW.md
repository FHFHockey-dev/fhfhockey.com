# Task 2 R1 independent review

**Accept the exact two-file repair on the original frozen candidate. Hold acceptance of the advertised combined R1 manifest.** Both original missing-count failures now pass without changing their assertions. One P2 packet-integrity finding remains; the separately reported live receipt-hash failure is unresolved.

## P2 — combined source pins do not describe the tested candidate

Location: `tasks/artifacts/forge-task2-2026-10-22/r1/SOURCE-PINS.json:27`.

The manifest advertises skater-stage SHA-256 `fe8357390ed4d5ed599bbd0429df5ea6150f703c9f8b121819198d6b4fc8c05b`. The original archived candidate, owner's retained R1 test snapshot, and this independently reassembled R1 snapshot all contain `e0f760d1bccf50ef02ba33cbb934ff3317e8abedd54df3801e721b890098d966`. The R1 archive and patch contain only the calculator and its existing test, so they cannot produce the advertised third-file change. All other 12 combined pins match.

The advertised stage adds negative-binomial simulation arguments and probability-based player-market outputs. It imports `buildModelMarketProbabilityFlagRow`, `compareModelWithMarket`, `forgePropOverProbability`, and `quotesFromMarketSummary`, none of which exists in the tested `market-output-builders.ts` dependency. The mismatch therefore includes executable behavior and an unrepresented dependency change, not only metadata. See [exact stage diff](STAGE-DRIFT.patch), [dependency evidence](STAGE-DEPENDENCY-DRIFT.json), and [snapshot pins](SNAPSHOT.json). The observed advertised stage was retained as review evidence; its concurrent implementation is not accepted by this narrow review.

Correction: issue a new/revised manifest for the two-file repair against the tested original stage, preserving historical receipts; or publish a complete frozen combined snapshot including the concurrent stage and dependencies, then verify that exact snapshot. The 326 passing owner cases cannot be attributed to the current advertised stage hash.

## Accepted repair and independent verification

The repair requires both finite, nonnegative current-season count and exposure before separating current from prior history. If either member is missing or invalid, it retains the established unsplit cumulative-history fallback at half weight. An observed zero with known positive exposure remains distinct. Complete pairs retain existing arithmetic, including clamping, league rescaling, recent-history blending, F/D priors and stale-season handling. No change outside `computeSkaterPhysicalEventRates` was found in the calculator.

Verified repair hashes:

| File | SHA-256 |
| --- | --- |
| `web/lib/projections/calculators/skater-adjustments.ts` | `89cf0e544daac80c01f9af267a7774a31ce523d2e483fd87074d999c18fd119b` |
| `web/lib/projections/runProjectionV2.test.ts` | `b669fbeb639c733c27dfee2f27003c9ae0d7359c282e0ee495e45792663ca5d3` |
| `r1.patch` | `b75b26430bb4559eeb7470160b01fd90cc39a0d8bd9e0a8474a9cfdf79543aae` |
| `r1-source.tar.gz` | `d745aad6252dcb1f054610b8915497d633517c86582057e7fb6295521944c907` |

**128 checks passed** using Node 22.11.0, existing npm dependencies, a clean synthetic environment, one Vitest worker and a transport-denial preload in a disposable non-Git snapshot:

- 112 calculator/regression cases and all 11 unchanged independent original oracles, including both missing-count regressions. [Log](TARGETED-TESTS.log).
- The exact previously failing native reproducibility case, exercising two sequential imported-code calculations with unchanged assertions. [Log](RECEIPT-REPRODUCIBILITY.log).
- Four independent F/D × HIT/BLK matrix cases: complete-pair parity against the retained pre-R1 implementation across current/stale seasons, zero/positive/over-limit counts and exposures, with/without league rescaling; null, undefined, NaN, infinity and negative partial pairs use the old unsplit fallback; observed zero remains distinct. [Fixture](fallback-parity.test.ts), [log](FALLBACK-PARITY.log).

The patch applies with whitespace checking in a separate temporary copy and reproduces both archive hashes exactly. Calculator bytes outside the function are unchanged. All original candidate packet hashes, R1 packet hashes, reviewed frozen pins and independent oracle assertions were unchanged at completion. [Integrity record](FINAL-INTEGRITY.json), [machine receipt](RECEIPT.json). Existing owner lint evidence was inspected; full TypeScript and broad suites were not repeated for this narrow review.

## Live receipt failure and release limits

The owner's `NATIVE-GREEN.log` records 92 passes and one actual failure at `qualify-native-players-offline.test.ts:40`: result hashes `92a0969c089c0c910d5b7404837f1f85fc56bed395354431b4330cbc3622cc3c` and `5646b1aa095b660ec5b1a513f7d856392867e70e7b60cfa7b70f79fda3994093` differed. This review reproduces a pass on the exact two-file frozen repair. It does **not** establish the cause of the earlier live failure or clear the combined live tree. The stage/dependency drift above is proven; a causal connection to the receipt failure is not. A complete stable snapshot of the intended combined candidate and a passing unchanged reproducibility check remain integration blockers. No live-tree tests were dispatched while other workers own those files.

`OPERATIONS.md` preserves immutable issued history and requires corrected forward forecasts to be new issuances/revisions. The exact helper's absence from the locally inspected release branch is not deployment evidence; production impact remains unestablished. Backfills, aggregate recomputes and new issuance require actual missing-input/version evidence and separate operational authorization.

Keep release/model qualification held for missing current-query physical/all-strength history, absent variant c, the real 20-player × five-strength writer comparison, target-specific bias/RMSE/calibration and ±10% gates. Synthetic correctness tests establish no predictive-quality result.

No canonical application edit, external request, production/NST call, database execution, migration, scheduler change, commit or deployment. Only independent review artifacts/diary and disposable verification files were written. No denied or uncertain tool operation; remaining blockers are evidence/integration gaps above.
