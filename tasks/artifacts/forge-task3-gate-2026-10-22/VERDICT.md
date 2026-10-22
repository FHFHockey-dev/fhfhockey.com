# Task 3 gate: assists from team on-ice goals × assist share (2026-10-22)

**Verdict: big gains on A and FP, but PPP becomes over-predicted.** That's the 3.4 failure mode, driven by over-predicted PP and defence goals. **TJ decided:** commit on octoberBranch, don't release alone, and release together with task 4 after a combined 3+4 gate.

## Model

- **Priors.** [forge-priors-2026-10-22](../forge-priors-2026-10-22/) holds one TJ-approved read-only aggregate over NST regular-season game logs, 2023-24 to 2025-26.
  - Assist share of on-ice GF: F ES 0.375, D ES 0.278, F PP 0.355, D PP 0.484.
  - Split-half k (on-ice goals): ES 258 (F) / 309 (D); PP 58 (F) / 84 (D).
  - League A/G: ES 1.65, PP 1.91 (the audit's ~1.8 PP A per PP G).
- **Assist share.** `computeSkaterAssistShare` (`calculators/skater-adjustments.ts`):
  - on-ice GF history = (G_all + A_all) / IPP_all; IPP is a percentage, read from the hydrated sidecar `ipp_all`.
  - share = (A + k·prior) / (GF + k), clamped to [0.02, 0.9].
- **Allocation.** `allocateTeamAssists` uses team goals at each strength × (player TOI / team TOI × 5 skaters) × share. Team assists are then scaled to league A/G at that strength.
  - This replaces own-goals × assists-per-goal, removes the per-two-goals PP scale and the 0.4–3.4 clamp, and drops the separate assist context multipliers: the team-goal environment carries them.
- **Reader.** It now selects `ipp_all`. The offline fixture adds `ipp_all: null`; the rows hash and the checksum (`7b8a39a4…`) were updated.

## Gate

Same 62 games (10-13..10-20). Baseline c: master-equivalent skater model after Release B. Candidate d: c plus task 3 ([variant-d.patch](variant-d.patch)). Production reads, all within TJ's per-gate approval:
- d: 7,550 GETs (max 133/run), 62/62 replays matched.
- e: 2,192 GETs. e tried adding the HOLD PP-usage fix `e316db4c0` and turned out identical to d, because master already uses official PP targets (`target_source: official_wgo`). It stopped after 18 games on one `read_failed`. Wasted reads, recorded here.

[PAIR-c-vs-d.md](PAIR-c-vs-d.md): 2,079 dressed player-games (1,383 F / 696 D). Seed-1, 2,000-rep game-cluster bootstrap.

| head | rel. bias c → d | RMSE c → d [Δ 95% CI] | top decile c → d [d CI] |
|---|---|---|---|
| **A** | −26.2% → **−3.8%** | 0.5594 → 0.5520 [−0.013, −0.002] | 1.329 → 1.187 [0.98, 1.42] |
| **FP** | −10.7% → **−1.2%** | 2.0027 → 1.9689 [−0.051, −0.015] | 1.068 → **0.992** [0.89, 1.12] |
| **PPP** | −30.1% → **+19.9%** | 0.3449 → 0.3414 (spans 0) | 1.020 → **0.767** [0.53, 1.06] |
| PPP, D only | −34.5% → +52.5% | flat | 1.235 → 0.675 [0.41, 0.96] |
| PPP, F only | −29.2% → +12.7% | flat | 0.985 → 0.796 [0.53, 1.13] |

G, SOG, HIT and BLK are unchanged; assists don't feed them. The FP deciles flatten, with d1–d10 between 0.88 and 1.12.

**ES-only control** ([PAIR-c-vs-d-es-only.md](PAIR-c-vs-d-es-only.md), offline merge of d's ES assists with c's PP assists): A top decile worsens to 1.57 and RMSE doesn't improve. The PP half is needed.

## Why PPP overshoots

Team PP assists are now 1.91 × team PP goals, which is correct. The overshoot is in PP goals. With the old halved PP scale, c's PPP was −30%. Holding A/G at its true value turns that into +20%, so team PP goals run roughly 15–20% high. D goals are already +46% (pre-existing), and D PPP is worst. Task 4 targets exactly that: position-specific, season-current conversion priors and fewer D in the top FP decile. Hence the combined 3+4 release gate.

## Checks

- Vitest: 66 files, 1,396 pass. This covers `lib/projections`, the offline qualification (56/56) and the bridge. The tests are new assist-share and team-allocation unit tests in `runProjectionV2.test.ts`.
- eslint is clean on the changed files; tsc is clean on the tree (heavy lock).
