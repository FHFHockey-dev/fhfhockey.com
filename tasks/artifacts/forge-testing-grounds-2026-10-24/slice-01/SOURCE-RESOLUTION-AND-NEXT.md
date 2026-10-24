# Additive source resolution and next decisions

2026-10-24, after slice 01 source/static-check freeze. This receipt supersedes only earlier statements that canonical requirements remain absent. Original handoff/evidence remain unchanged.

Complete installed files were read and verified against previously reviewed full Library text plus one terminal newline, and the parent's independent original-file hashes:

| File | Bytes / lines | SHA-256 |
| --- | --- | --- |
| `tasks/TASKS/prd-forge-testing-grounds.md` | 27,797 / 232 | `33f74b0c7df68483821bcf41e3c446d0eee26f788bbd101c3a92a0087cfbdaa5` |
| `tasks/tasks-prd-forge-testing-grounds.md` | 26,987 / 115 | `a0a760cabc61fe15a496b768634858171b32d6673999f3abaf4d8cbcb321c9b2` |

No requirement file was changed by this worker. Input-transfer blocker is **resolved**. All four application source/test pins and 19 dependency pins in EVIDENCE.json were rechecked unchanged after static checks. HANDOFF.md SHA-256: `9b6e58fc5b55f666e76ec60b64acac48d27f7d86dab3f74d5b3fc183be9c3ecc`. EVIDENCE.json SHA-256: `c08fc23157f91ec231f638303ea256cadee9800a0dd0e56f8f38bc7d70423600`.

## Parent clarifications accepted

- Owner means **TJ only**, not every admin. A fail-closed local policy with an explicit trusted owner identity and synthetic verification fixtures can be implemented now without hosted auth/config changes. This is the next independent slice; actual session/owner configuration and activation still need normal review. Do not present that configuration as a blocker to pure policy work.
- ROC-AUC can assess a continuous ranking score against a declared binary label. Expected goals may therefore provide **rank-only** evidence for a scored-at-least-once event. That does not turn the mean into a probability, authorize Brier/log-loss/probability-reliability calculations on it, or satisfy the validated-probability pilot.
- An explicit but uncalibrated probability head is distinct from a non-probabilistic ranking score. The existing official-starter frequency head merits validation of its population, as-of input evidence and mapping; unavailable prior calibration is not itself proof that the output is a fabricated probability. Its pilot suitability is still unverified here.
- No new Astra or implementation subagents. Independent Sol review is Scout's responsibility. Master/ledger remain with the audit worker.

## Concrete next decisions offered, not silently selected

1. **Remote execution:** choose between (A) a new Testing Grounds-specific bounded-step worker/store using the existing lease/CAS design or (B) a dedicated durable worker with a separately selected provider. A requires evidence that fits can finish/checkpoint inside approved function bounds; B requires provider/hosting/access/cost decisions. Neither option invokes existing production maintenance routes. Provisioning and remote tests remain blocked until exact runtime/concurrency/retry/storage/retention/network budgets are approved. No pricing or runtime estimate is invented without a candidate workload.
2. **Ranking diagnostic:** permit a separately labeled expected-count rank-only ROC/AUC view against frozen player-game binary labels. This is optional evidence, not a substitute for the probability track. Baseline/candidate must use identical paired eligible rows; ties get the declared treatment, and one-class cohorts are unavailable.
3. **PR summary convention:** approve non-interpolated average precision or trapezoidal PR area and label the selected convention explicitly. No metric implementation/choice in this slice.
4. **Probability scoring:** validate the starter-frequency head or another explicit head/distribution before probability-track wiring. Freeze event membership, conditional population, mapping version and threshold; choose exact treatment of zero/one probabilities for log loss (unclipped mathematical behavior versus an explicitly declared epsilon). No arbitrary clipping chosen.
5. **Uncertainty:** approve a dependence-aware scheme after pilot sample/date scope is known (e.g. paired resampling of whole game-date blocks with predeclared block length, replicate count and seed), rather than independent player-row resampling. Those parameters remain undecided; a small pilot may support descriptive paired differences with an explicit unavailable-interval reason until the method is justified.

The source packet is ready for independent review, not accepted integration. No server, shared Next cache, heavy-lock resource, production request, external model call or paid runtime was used. Any later browser run requires a separately allocated build directory/checkout **and** port; Claude owns the canonical `.next-playwright` directory and :3110.
