# Finite FORGE development receipt — October 14, 2026

One declared historical comparison pass completed at 09:30:46 Eastern. All artifacts are private under `/Users/tim/Documents/FHFH-private/forge-full-development-20261014-v3/`. Research acceptance is governed by the independent selected-artifact receipt, not by completion of the scripts. No production writes, deployment, public serving or live runtime replacement occurred.

## Data and chronology

The metadata allocation was accepted before target decoding; the executable/runtime gate preceded one native materialization; the independent dataset gate preceded one fit. Event dates are October 7, 2025–January 7, 2026. January 8 onward was excluded before target decoding. Every historical prediction uses eligible event history at least two calendar days earlier. Actual late acquisition clocks remain intact: **zero genuinely as-of-qualified historical rows**. This is retrospective development, not an untouched test.

Native validation produced 662 skater appearances across 17 identities, 46 PPP receipts across two identities, and 39 positive-minute goalie appearances across two identities. Twenty zero-minute goalie observations were excluded, without turning them into participation/start negatives. One otherwise valid goalie-volume observation has conflicting auxiliary outcome evidence and contributes no W label; 38 explicit starter/W observations remain.

The initial seed ends November 16. Four reporting folds cover November 17–30, December 1–14, December 15–January 2, and January 3–7. The scored population is smaller than the source population: 370 appearances/16 skaters for core counts and total ice time; 22 appearances/one player for PPP; 26 goalie appearances for joint components; 25 verified-start decisions for W. These are target-specific denominators, not a complete population of fantasy opportunities.

## Fixed comparisons and selections

Eight distinct count recipes, six distinct skater TOI recipes, four joint goalie-component recipes, and three W recipes were predeclared. Native prior-season comparators are unavailable because the required 2024–25 prior is absent; pooled research estimates are not relabeled as native. No post-result grid expansion or tuning occurred.

| Target | Selected recipe | Baseline loss | Selected loss | Scored rows |
|---|---|---:|---:|---:|
| G | expanding season mean | 0.417574 MAE | 0.417574 | 370 |
| A | prior usage × historical rate | 0.616398 MAE | 0.615928 | 370 |
| PPP | expanding season mean | 0.196669 MAE | 0.196669 | 22 |
| SOG | expanding season mean | 1.293832 MAE | 1.293832 | 370 |
| HIT | expanding season mean | 0.704730 MAE | 0.704730 | 370 |
| BLK | 50% recent-five mixture | 0.714701 MAE | 0.710316 | 370 |
| PIM | expanding season mean | 0.733532 MAE | 0.733532 | 370 |
| Skater conditional minutes | 25% recent-five mixture | 1.769192 MAE | 1.754777 | 370 |
| Joint goalie family | 25% recent-five mixture | 0.348016 binomial loss | 0.347899 | 26 |
| W given verified start | train-only pool, 20 pseudo-starts | 0.286442 Brier | 0.267828 | 25 |

The PPP challenger sample fails the minimum two-player condition. Baseline retention is valid, not evidence of a winning model. Improvements in A, BLK, TOI and goalie primary loss are small and selected on exposed development data.

The goalie family deliberately shares one selected recipe to preserve SV+GA=SA and derive exposure-consistent SV% and GAA. Its selected SV MAE is 6.191444 versus 6.178367 baseline; GA 1.116683 versus 1.099966; SA 5.743795 versus 5.708581. Conditional minute MAE also worsens, 4.849922 versus 4.775792. These regressions remain visible even though the declared primary binomial loss improves. Derived ratios are component rates, not expected random per-game ratios.

All finite trial metrics, fold stability, coverage, errors and fallback/omission details are in `development-report.json` and `trial-predictions.json`. Train-only empirical p10/p90 bands are descriptive, not calibrated intervals. Repeated players and games make row errors dependent; no significance or proven lineup-decision value is claimed.

## Unsupported and unqualified heads

Credited SO lacks explicit individual credit evidence. Participation lacks a complete candidate/negative-label frame. Goalie-start probability lacks the complete peer pool and cutoff-bound source lineage. PP role/strength-specific ice time lacks admitted historical deployment/exposure. Unconditional ice time lacks qualified participation. These heads were not fitted and remain unavailable, never zero or silently pooled probabilities.

All 370 scored core-skater rows have at least five eligible historical appearances. There are no evaluated zero-/sparse-history rows establishing fallback accuracy. Rookie and returning-player identity flags are unverified; historical team sequences and prior-team differences are preserved as diagnostics, not proof of trade effects or current roles. Older-season success establishes no current-season newcomer/role qualification.

## Reproduction and operation

`protocol/allocation-v2.json` pins the exact source spans and original hashes. `protocol/reviews/execution-gate.json` binds reviewed source/runtime files and the exact native module manifest. `data/materialization-start.json` records the durable once-only attempt. `data/materialization-receipt.json` and `protocol/reviews/dataset-gate.json` bind the normalized data. `candidates/research-state.json` retains per-player/head sufficient statistics, train-only population pools, and the last five appearances including null targets. `candidates/research-freeze-manifest.json` pins recipes, data, code, state and per-head statuses for independent acceptance. Historical predictions can be reconstructed from the pinned ordered records and code; the original output paths refuse overwrite.

Ten focused family synthetic checks passed, plus the native/materializer synthetic checks and independent source/dataset review. These are engineering and data-coherence checks, not prospective predictive qualification.

The selected research package was created before the 17:30 Eastern deadline. It does not authorize additional live heads. The accepted v1 BLK operation remains pinned at 17:50 capture, 18:15 cutoff and 18:30 issuance. Future wake/issuance success remains unverified. Its separately approved adaptive block and sealed final evaluation retain their existing ownership and policy. No new full-model untouched final was allocated, and exposed October 13/older development results cannot be made untouched by hiding them now.
