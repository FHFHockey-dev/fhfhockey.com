# Task 2 R1 — paired physical-history repair

Corrected the independently reproduced P2. The precise `computeSkaterPhysicalEventRates` function lease is released after this pinned R1 candidate; preserve its paired-support guard when integrating the next model work.

Only two application files changed:

- `web/lib/projections/calculators/skater-adjustments.ts`: validate the current-season numerator and exposure together, using an explicit null season split when either is unavailable. An incomplete split uses the existing unsplit cumulative-history fallback at half weight and the existing prior/rescale policy. Complete pairs, including an observed zero count with known exposure, retain the prior behavior. No other calculator function changed.
- `web/lib/projections/runProjectionV2.test.ts`: four F/D × HIT/BLK cases check null and undefined counts with known exposure, known counts with missing exposure, zero paired with missing support, exact fallback arithmetic, observed zero and complete nonzero pairs.

`r1.patch` and `r1-source.tar.gz` contain this two-file overlay on the original candidate. `SOURCE-PINS.json` versions the combined candidate; `RECEIPT.json` records integrity and tests. The original task-2 source archive, patch, 13-pin receipt and gate evidence remain unchanged. The function was byte-identical to the reviewed dependency before repair; its surrounding calculator code is byte-identical before/after this repair.

## Verification

- Four newly added partial-pair cases **failed before** the repair.
- Live helper/query/unchanged independent oracle checks: **233 passed**, including both original failing oracles.
- Live native integration/offline checks: **92 passed, one failed** on deterministic `resultHash` equality. Its cause was not established; it is retained in `NATIVE-GREEN.log` despite that filename. Do not describe the live-tree run as entirely green.
- Reassembled a fresh non-Git copy of the independent review's pinned source, overlaid **only these two files**, preserved its unchanged adversarial test, and ran with transport denial, a clean environment, one Vitest worker, and the review's test-only adapter for the two Git metadata lookups. **326 passed, zero failures** across the five query/helper/native/offline/adversarial suites (`ISOLATED-GREEN.log`). Assertions were unchanged. This includes the previously failing receipt-reproducibility case. The snapshot's two edited files match the pinned live delta.
- Scoped ESLint and `git diff --check` passed. Full TypeScript was not repeated for this function-only repair; the original full-check outcome remains historical evidence. Final combined integration should use a frozen batch to avoid concurrent source changes.

No backfill, recompute, production query, database write, migration, release or deployment was performed. No denied or uncertain tool action remains. Model qualification is still held for the missing current-query physical/all-strength cohort, variant c, target-specific bias/RMSE/calibration and ±10% gates, and the real 20×5 writer comparison. Synthetic correctness tests do not establish predictive skill.

## Backfill or rerun?

See [OPERATIONS.md](OPERATIONS.md) for the bounded decision tree, local run/head identification, proposed separately approved SELECTs and new-issuance requirements. Correct code first; backfill only verified missing source observations, recompute aggregates only when needed, and issue corrected forward forecasts as new revisions without overwriting immutable original history.

The exact P2 helper is absent from local master `457435eb3010c5b3dd92d2e1a46d9c75d851780a`, which still uses the older EV physical-rate path. The bug is established in the development candidate. Current production alias/run versions have not been observed, so production impact is unestablished. The P2 counterexamples yield lowered nonzero rates, not zero projected counts; this finding must not be used to explain all production zeros.
