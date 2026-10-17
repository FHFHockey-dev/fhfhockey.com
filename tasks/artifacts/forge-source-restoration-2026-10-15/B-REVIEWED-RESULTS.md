# Reviewed B results — descriptive development only

One authorized run completed and independently accepted. M0 remains unchanged; no promotion, tuning or per-target winner blending. M1 is recent minutes × own rates; M2 uses pooled/shrunk rates, with its separate fixed shrunk TOI head.

Positive gain means lower MSE than M0. Development covers the four folds through Jan 7; Jan 8–13 is separately exposed diagnostics. All heads/policies have 8,243 development and 1,260 continuation cases, zero forecast omissions, and 90/6 pooled fallbacks respectively.

| Target | Dev M1 gain | Dev M2 gain | Jan M1 gain | Jan M2 gain |
|---|---:|---:|---:|---:|
| G | -0.1883% | +4.2849% | -0.0725% | +1.6108% |
| A | +0.0118% | +4.7120% | +0.1286% | +1.6466% |
| SOG | -0.5086% | +1.7045% | +0.5783% | +1.8539% |
| HIT | -0.8947% | -6.9599% | -1.0683% | -7.8049% |
| BLK | -0.2332% | +2.7285% | -0.0629% | +0.9549% |
| PIM | -0.1751% | +4.1945% | -0.1544% | -0.0336% |
| TOI | +0.2018% | -38.8831% | +7.5072% | -24.7488% |

## Absolute paired development differences and uncertainty

The paired absolute MSE difference has squared-count units, or squared minutes for TOI. The fixed seven-day block bootstrap gives the following 95% percentile sensitivity ranges; these are exploratory, with dependence/stability assumptions unverified, not confirmatory confidence or superiority claims. Fourteen-day sensitivity and full fold/group matrices remain in the aggregate artifact.

| Target | Policy | Absolute paired MSE gain | 95% absolute sensitivity range |
|---|---|---:|---|
| G | M1 | -0.0003339 | [-0.0006296, -0.0000762] |
| G | M2 | +0.0075978 | [+0.0045032, +0.0099242] |
| A | M1 | +0.0000371 | [-0.0005019, +0.0006204] |
| A | M2 | +0.0147413 | [+0.0107605, +0.0188565] |
| SOG | M1 | -0.0094243 | [-0.0153037, -0.0042311] |
| SOG | M2 | +0.0315873 | [+0.0116219, +0.0502135] |
| HIT | M1 | -0.0126270 | [-0.0187061, -0.0034853] |
| HIT | M2 | -0.0982244 | [-0.1568663, -0.0541599] |
| BLK | M1 | -0.0022033 | [-0.0044920, +0.0007089] |
| BLK | M2 | +0.0257807 | [+0.0100414, +0.0424803] |
| PIM | M1 | -0.0036707 | [-0.0083929, +0.0007960] |
| PIM | M2 | +0.0879460 | [+0.0396056, +0.1334912] |
| TOI | M1 | +0.0144228 | [-0.1711586, +0.1304525] |
| TOI | M2 | -2.7790769 | [-3.1486272, -2.3946320] |

M2 improves five count targets in development but worsens HIT and TOI in all four folds. It is not a uniformly better complete pipeline. The descriptive equal-relative-MSE vector summaries are M0=1, M1=1.0025517383, M2=1.0403123920; these are neither selectors nor fantasy scores. No G>SOG violations were reported. Missing PPP/goalies and absent authentic roster/scoring contracts preclude complete fantasy-vector or legal-lineup utility claims.

## Execution and receipts

Exactly one invocation, three complete seven-head pipelines, 199,563 forecast values; 4,000 fixed shared bootstrap draws. Wall time15.310674292 seconds; worker/monitor peak269,008,896 bytes (256.55MiB), supervisor peak114,933,760 bytes. Memory observation was sampled, not a hard OS limit; recorded OS peak was within8GiB. No retries, original archive rereads, acquisitions, production/deployment/scheduler changes.

The terminal and aggregate files intentionally retain their original pending-review statuses; the separate immutable final review supplies acceptance. Coordinator independently checked these three hashes and read aggregate/receipt data only, not forecast or label bodies.

- [protocol/terminal-receipt.json](/Users/tim/Documents/FHFH-private/forge-core-multioutput-development-b-20261015-v1/protocol/terminal-receipt.json) — SHA256 `de19593a56f6a3e96ec15847b299c4fae57c0bf628285e1a4253753da661cb4d`.
- [protocol/reviews/final-review-v1.json](/Users/tim/Documents/FHFH-private/forge-core-multioutput-development-b-20261015-v1/protocol/reviews/final-review-v1.json) — SHA256 `eec8716fdc30a23a18017f265d65f8df2b11625f2c8b88e84d3d71ac63b39bfe`.
- [reports/aggregate-results.json](/Users/tim/Documents/FHFH-private/forge-core-multioutput-development-b-20261015-v1/reports/aggregate-results.json) — SHA256 `5733050c65c655e5ac52a18ecd5a06f8a37d9786be8e1b662e555d8d195c6d94`.

All results are exposed prior-season descriptive development: zero original-as-of/untouched or current-season qualification. January14 onward remains closed, PPP/goalies deferred, original829 record unstarted, accepted A immutable, separate live pilot unchanged. No further run or model choice is implied.
