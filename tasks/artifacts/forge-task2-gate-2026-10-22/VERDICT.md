# Task 2 gate: variant "c" on post-R19 inputs (2026-10-22)

**Verdict: not cleared under the literal ±10% gate, and a clear improvement on current master on every gated metric.** HIT is over-predicted (bias +10.9%, top decile 0.883) and FP is under-predicted (bias −10.7%); SOG passes. Whether to release c as an improvement over master, or hold it for a HIT fix, is TJ's call. The row-identity check passes for every row since 10-07. The season's first four dates hold stale or missing rows, which is a data-freshness gap, not a writer defect.

## What was compared

- **a (`va`)**: `origin/master` `d45a287f0` (R23 plus the 11.1–11.3 release), as deployed.
- **c (`vc`)**: a, plus hydration `6767073ea` (3-way port; master's S-F reader already existed), plus the F3/F4 hits/blocks hunks (`b8fe1072e` FORGE parts and `34a5588db`, from the 10-21 audit's export), plus the task 2 source repair `721486d0f`. The bundle is [variant-c.patch](variant-c.patch) (sha256 `a2e765a6…`). In c, `computeSkaterPhysicalEventRates`, `fetchLeaguePhysicalTotals` and the physical constants are byte-identical to octoberBranch `721486d0f`.
- Both exports use baseline model mode (`FORGE_SKATER_MODEL_MODE` unset). Migration 88 is not applied, per TJ's decision. Captures refuse RPCs anyway, so the league rescale is off in both variants.

## Production reads (TJ-approved in this session)

| run | requests | detail |
|---|---|---|
| captures, 62 games 10-13..10-20 × {a, c} | **14,368 GETs** | 124/124 runs rc 0, max 133 reads/run, all 124 replays matched, 18:10–18:51Z, sequential. Stop rules (>500/run, >4 h, >60k) not triggered. [log](CAPTURE-ALL.log) |
| row identity, 20 players | 1,047 GETs | read-only fence (GET/HEAD only, stop at 3k) |
| row identity detail, 3 of those players | 160 GETs | per-field and per-date breakdown |

The actuals are the 10-21 cohort files, reused unchanged with no new reads (`s3_actuals.json` sha256 `6b945b5a…`, `s9_hits_blocks.json` `aab787fa…`). Reconstructions read today's database, so the comparison is clean between variants but is not what production served on those dates.

## Results (2,079 dressed player-games, 62 games)

From [GATE-REPORT.md](GATE-REPORT.md) and [GATE-CI.md](GATE-CI.md). Paired cluster bootstrap by game: 2,000 reps, seed 1. "Rel. bias" is Σpred/Σactual − 1. "Top decile" is Σactual/Σpred over each variant's own top 10% of forecasts for that head.

| head (FP weight) | rel. bias a → c [c 95% CI] | top decile a → c [c 95% CI] | ΔRMSE c − a [95% CI] |
|---|---|---|---|
| **FP** | −15.9% → **−10.7%** [−14.9, −6.1] | 1.326 → **1.068** [0.93, 1.19] | −0.051 [−0.077, −0.024] |
| **HIT** (0.2) | +18.7% → **+10.9%** [+5.6, +16.7] | 0.636 → **0.883** [0.82, 0.96] | −0.184 [−0.226, −0.145] |
| **SOG** (0.2) | −9.5% → **−9.3%** [−12.5, −5.6] | 1.134 → **0.979** [0.89, 1.07] | +0.009 (spans 0) |
| BLK (0.25) | +3.0% → +11.6% | 0.623 → 0.858 | −0.136 [−0.161, −0.114] |
| G (3) | −17.1% → −7.5% | 1.421 → 0.960 | −0.006 [−0.010, −0.003] |
| A (2) | −33.4% → −26.2% | 2.032 → 1.329 | −0.011 [−0.018, −0.005] |
| PPP (1) | −37.7% → −30.1% | 1.426 → 1.020 | +0.001 (spans 0) |

Gate (FP, HIT, SOG bias and top decile within ±10%):

| | bias | top decile |
|---|---|---|
| FP | **fail** (−10.7%; CI includes −10%) | pass (1.068) |
| HIT | **fail** (+10.9%; CI includes +10%) | **fail** (0.883; CI upper bound 0.96) |
| SOG | pass (−9.3%) | pass (0.979) |

## Reading

- c beats master on every gated number: FP bias and top decile, HIT bias and top decile, and SOG top decile. Master itself fails five of the six gate cells today. RMSE improves on FP, G, A, HIT and BLK (CIs exclude 0) and is neutral on SOG and PPP.
- **HIT over-prediction is real but halved.** On the 10-21 inputs, hydration alone took HIT to +0.26 per game with a 0.636 top decile. With the F/D-prior hits model, c is at +0.125 per game and 0.883. Hits are still ~12% too high among the biggest hitters, and BLK, at +11.6% bias with a 0.858 top decile, leans the same way. Candidate levers, each needing its own gate run:
  - the league rescale (migration 88), which the offline harness can't measure;
  - a smaller prior-season weight or a larger prior strength in `SKATER_PHYSICAL_RATE_PRIORS`.
- **The FP shortfall is assists and PPP**: A −26%, PPP −30%. That's task 3's scope (assists on the right scale), not task 2's.
- Deciles: c flattens BLK and HIT across the range (master's HIT d1 was 48× under; c's is 1.22). SOG low deciles are under-predicted in both variants (d1 1.63 in c).

## Release implications found while gating

- **Production reads rolling rows through the S-F RPC.** c's hydration lives in the legacy-scan path, which reconstruction uses. Master's RPC path drops `support_row`, so shipping c's reader would hydrate nothing in production. The release must carry octoberBranch's full reader (task 2.4: RPC sidecar hydration) plus `lib/rollingPlayerCountSupport.ts`. The aligned-count branch stays inert, since master's writer stores no `alignedCountSupport`. Proven in the release prototype: tsc clean, 56/56 `lib/projections` test files pass.
- The offline qualification fixture must be regenerated for the candidate, with its checksum (`qualify-native-players-offline.ts` and `.md`). Neither the 10-21 c fixture nor octoberBranch's passes on master-based code. See the release plan.

## Row identity (streamlining 7.5)

The released writer's `recomputePlayerRowsForValidation` and `splitRollingUpsertRowForDurableStorage` were compared with the stored wide row plus sidecar for 20 cohort regulars in season 20262027, across all five strengths (all, ev, 5v5, pp, pk). Evidence: [row-identity/](row-identity/).

- **Every row dated 10-07 or later is field-identical** (tolerance 1e-6) in the detailed 3-player rerun, wide and sidecar alike. Three of the 20 players have zero mismatches overall.
- All mismatches and missing rows fall on **2026-09-29, 09-30, 10-03 and 10-06**: the season's first regular-season games (`20260200xx`).
  - Ten to fifteen recomputed rows per player (2–3 dates × 5 strengths) are absent from the store.
  - Stored rows on those dates differ across NST-derived families: penalties, on-ice, primary/secondary assists, zone starts, PDO, CF/FF and ixG.
  - In the 20-player run, mismatch totals scale with the number of early dates stored (≈1.8k fields per date). That fits the same pattern, though only 3 players were broken down by date.
- **Interpretation:** those early rows were written before their NST data existed and were never rewritten. Later rows (rolling and season fields included) match, so recent runs used current data. FORGE reads only the latest row per player and is unaffected.
- **The column drop (S-G) is cleared**: no dropped or pruned field changed a value.
- **Follow-up for TJ:** a bounded rolling rewrite for 09-29..10-06 would refresh the stale early-season rows. It's a production write and is not done here.

## Decisions (TJ, this session, 2026-10-22 ~19:00Z)

- **Release task 2 as an improvement** over master in the next FORGE model release, despite the literal gate miss. Follow-ups: the HIT overshoot (physical prior tuning or migration 88 rescale, each gated) and the A/PPP shortfall (task 3).
- **Migration 88 stays unapplied**; the release runs on F/D priors with scale 1.
- **Early-season rolling rows:** TJ runs the refresh later from `/db/runner`. Scope: `update-rolling-player-averages` for `startDate=2026-09-29&endDate=2026-10-06`, bounded per `web/README.md` (Contextual rankings pipeline, step 2: `executionProfile=overnight` or `maxPlayers`/`resumeFrom`). Afterwards, rerun `row-identity/row-identity.ts` on the same 20 players (~1k GETs) to confirm.
