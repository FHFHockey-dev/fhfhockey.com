# Prior-strength (k) re-fit gate (2026-10-22)

**Verdict: neutral on accuracy, better calibrated for goals, assists and FP, worse for shots. Nothing ships yet.**

## Re-fit

[k-refit-moments.sql](../forge-priors-2026-10-22/k-refit-moments.sql) is one TJ-approved read-only aggregate, run once. It is a method-of-moments fit on player-season totals, 2023-24..2025-26, with minimum exposure (GF ≥ 5, shots ≥ 20, 2 h). τ² is pooled across seasons; the result is [K-REFIT.json](../forge-priors-2026-10-22/K-REFIT.json).

The tasks 3/4 values came from unweighted alternate-game split-half `corr()`, which overstates noise. The re-fit k are mostly far smaller:

| prior | F ES | D ES | F PP | D PP |
|---|---|---|---|---|
| assist share, on-ice goals: 3/4 → re-fit | 258 → **99** | 309 → **98** | 58 → **20** | 84 → **65** |
| goals per shot, shots: 3/4 → re-fit | 423 → **224** | 704 → **532** | 155 → **107** | 73 → **934** |
| shots per 60, hours: 3/4 → re-fit | 8.4 → **2.69** | 12.3 → **3.42** | 10.3 → **1.48** | 5 → **2.28** |

D PP conversion has no measurable true spread: τ² ≤ 0 in 2 of 3 seasons. The old k of 73 let D PP shooting run far from the prior.

## Gate

h = live model f (Release C) with only these constants changed; see [variant-h-over-f.patch](variant-h-over-f.patch). 62 games, 7,532 GETs (per-gate approval). Three transient zero-read stops were resumed; 62/62 replays matched.

- **RMSE:** every head is neutral (all ΔRMSE CIs span 0); see [PAIR-f-vs-h.md](PAIR-f-vs-h.md).
- **MZ slopes, f → h:** G 1.16 → **1.10**, A 1.36 → **1.30**, FP 1.14 → **1.09**, PPP 0.86 → 0.85, SOG 0.99 → **0.92** (now over-dispersed).
- **FP deciles:** 0.90–1.10 in f, **0.95–1.08** in h; top decile 1.099 → 1.082.
- **SOG deciles:** low deciles more under (d3 1.10 → 1.25).

## Reading

- **Conversion and assist-share k:** the re-fit helps calibration. Season-level moments suit them.
- **Shot rate:** the season-level moment k is too small. FORGE's shot history spans seasons, and talent drifts between them, so the effective prior strength is larger. The old split-half value already gave a slope of 0.99.
- **Recommended next candidate:** re-fit assist-share and conversion k, keep shot-rate k. It is untested as a combination and needs one gate.
- **What still compresses goals:** the small-sample second shrink. Its weight averages 0.63 and never exceeds 0.76, so established players lose at least 24% toward the prior. That shrink is kept only because the context goal multipliers inflate conversion (task 9, Q7). Fixing it needs single ownership of finishing: the shot-quality goal multiplier repeats what conversion history already holds.
