# Math audit W3 cross-check: sustainability part 2, rolling part 2, rankings part 2

Records M-SUS-061 to 075, M-ROLL-061 to 075, M-RNK-061 to 065 (35 Codex-only records). Auditor: Claude (Fable), 2026-11-11. No code changed. Paths are under `web/` unless stated.

## 0. Brief (written before the code was read)

- These 35 records re-describe code that `audits/sustainability-part1.md`, `audits/rolling-player-averages-trends-part1.md` and `audits/rankings-part1.md` already judged. The job is to find what slipped through, not to re-audit.
- For each record: name the upstream entry that covers the same function. Audit only a point that upstream missed or got wrong.
- Astra's corrections are applied first (`W1-Astra-PR/rolling-players.md`, `sustainability-part1.md`, `w2-rankings-part1.md`). Decisions 16–18, 23, 32–36, 61, 68, 74, 75 bind.
- Things worth a second look, because part 1 judged the family and not each member: the per-metric prior strengths in `bands.ts`, the exposure units of the PP and 5v5 collectors (the same file had a 60× unit bug), and the last-N fallback branch in `skaterWindowAggregation.ts`.
- Database: read-only, four small reads (one catalog, one aggregate on the indexed snapshot date, three by player id). `pg_stat_activity` showed one active query before the first read.

## 1. Summary

| | Count |
|---|---:|
| Records | 35 |
| Covered upstream, nothing to add | 27 |
| Covered upstream, with a new or corrected point | 8 |
| New points: mis-specified | 5 (across 6 records) |
| New points: wrong, latent | 1 (across 2 records) |
| New points: undetermined | 1 (decision 13 for the three penalty records) |
| New P0 defects | 0 |

No record contradicts an upstream verdict. One upstream magnitude is corrected (finding 2).

### Top 5 findings by user impact

1. **PP Goals/60 and PP Points/60 bands carry 2–4% data weight** (M-SUS-071, 072). The prior is 180 PP minutes; an L5 window holds about 4 weighted PP minutes. The band value is the baseline. Live in the Sandbox. Same class as upstream D9 (PDO), not named there.
2. **5v5 Points/60 compares a 5v5 numerator over even-strength ice time with a baseline over 5v5 ice time** (M-SUS-070). Upstream D14 said the 12% gap "may be real". It is structural: even-strength TOI is 8–14% larger than 5v5 TOI. Today the prior hides it; once hot/cold is repaired (decision 33) it reads as a false "cold" for everyone.
3. **Rankings last-N fallback divides a per-60 rate by seconds** (M-RNK-062, 063). Unreachable on stored rows today, but the mislabelled "numerator" is exported and stored with every last-N snapshot row.
4. **IPP band baseline falls back to even-strength goals-for** when the season's NST on-ice GF is null (M-SUS-063). All-situation points over ES goals can exceed 1 and make the beta prior negative. Conditional: 0 of 268 stored rows on 2026-11-11.
5. **Forecast bands' nominal 50% range covers 35–74% of a Poisson count** (M-SUS-061). Unserved (decision 37); decision 29 already asks for exact quantiles.

## 2. Per-entry table

Reach: live / conditional / dormant / research. "ROLL", "SUS", "RNK" are the part 1 audits' entry ids; "D" numbers are their defects.

### Rankings

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| 061 SAX% | Covered by RNK D5 (iCF denominator, decision 17) and D4 | `lib/rankings/skaterWindowAggregation.ts:400-415` | Live | Rankings, matrix, composites |
| 062 Shot Attempts/60 | Covered by ROLL-014, RNK-030; **new: N1** | `:466-510` | Live; N1 latent | Same |
| 063 SOG/60 | Covered by ROLL-014, RNK-041; **new: N1** | `:466-510` | Live; N1 latent | Same |
| 064 Unrealized xG | Covered by RNK D4, decision 75 | `:425-431` | Live | Same. It is exactly −(Goals Above Expected); both are `higherIsBetter: true`, so the two columns rank in opposite orders (label note only). |
| 065 xGA/60 | Covered by RNK D6 with Astra's qualification | `:377-389`, `:273-277` | Live | xGA rank, Defense Rating |

### Rolling

All 15 run through the accumulators part 1 judged (`fetchRollingPlayerAverages.ts:2618-2637` additive, `:2854-2880` ratio).

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| 061 oi_xga, 062 oi_xgf, 063 oz_starts | Covered by ROLL-027 and the 046–060 pattern (NST on-ice only, no fallback) | `:1409`, `:1439`, `:1445` | Live | Rankings xGA/60, xGF% |
| 064 penalties_drawn | Covered by ROLL-027; decision 13 **undetermined** | `rollingPlayerSourceSelection.ts:113-123` | Live | Rankings |
| 065 penalties_drawn_per_60, 066 penalties_taken_per_60 | Covered by ROLL-014; decision 13 undetermined | `fetchRollingPlayerAverages.ts:1249-1275` | Live | Rankings |
| 067 pp_points | Covered by ROLL-027. Note: `all` rows use NHL PPP, `pp` rows use NST PP-strength points (`rollingPlayerSourceSelection.ts:145-153`) | — | Live | Rankings PP Points/60 |
| 068 pp_toi_seconds | Covered by ROLL-016/027; Astra withdrew the M-RNK-057 inheritance (player PP TOI is the right denominator) | `:1140-1146` | Live | Same |
| 069 primary_assists, 071 secondary_assists | Covered by ROLL-027 | `rollingPlayerSourceSelection.ts:89-111` | Live | FORGE, rankings |
| 070 primary_assists_per_60, 072 secondary_assists_per_60 | Covered by ROLL-014 and Astra §2 (count has an NHL fallback, the rate is NST-only, so the season support pair need not match the rate) | `:1289-1315` | Live | Rankings |
| 073 shot_attempts_per_60 | Covered by ROLL-014; denominator semantics by RNK D5 | `:1207-1219` | Live | Rankings xS%, SAX% |
| 074 shots | Covered by ROLL-027 | `:1639` | Live | Social share, rankings |
| 075 toi_seconds | Covered by ROLL-038 (D15) and ROLL-027 | `:1463`, `:1854` | Live | Every per-60 |

Spot check, one player (8478402, `all`, row dated 2026-11-05): the four season support pairs reproduce their stored rates (3.7428, 0.1497, 13.9233, 6.8868), and `_last5` equals `_total_last5` for both shot rates, as ROLL-040 says.

### Sustainability

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| 061 forecast bands | Covered by SUS-059/060 and Astra; **new: N5** (size) | `lib/sustainability/features.ts:226-246`, `:848-857` | Dormant (decision 37) | `model.ts:791` `projectCountMetric` only |
| 062 HDCF%, 065 SH% (5v5), 066 PP SH% | Covered by SUS-032: no collector and no baseline, so no rows | `bandCalculator.ts:284-323` (no case) | Dormant | None. 0 rows on 2026-11-11 |
| 063 IPP | Covered by SUS D2, D4, Astra A1; **new: N4** | `:293-298`, `:442-449` | Live; N4 conditional | Sandbox, trend-bands API |
| 064 SH% | Covered by SUS D2, D4, A1 | `:299-304` | Live | Same |
| 067 On-Ice SH%, 068 On-Ice SV% | Covered by SUS D2, D4, A1 | `:305-321` | Live | Same |
| 069 PDO | Covered by SUS D9 with Astra's correction | `:341-350`, `:486-487` | Live | Same |
| 070 Points/60 (5v5) | Covered by SUS D14; **corrected: N2** | `:228-236`, `:402-408` | Live | Same |
| 071 PP Goals/60, 072 PP Points/60 | **Mis-specified: N3** (new) | `bands.ts:209-226`; `bandCalculator.ts:238-257`, `:530-547` | Live | Same |
| 073 Hits/60, 074 Blocks/60 | Covered by SUS D1 | `:258-277` | Live | Same, plus FORGE band adjustment |
| 075 Fantasy Score | Covered by SUS D4, Astra A6; **new: N6** (label) | `:352-364`, `:488-509` | Live | Sandbox |

## 3. New points in detail

### N1 · Last-N fallback computes rate ÷ seconds (M-RNK-062, 063; also goals, assists, hits, blocks, ixG per 60) · wrong, latent · P2
- **Where.** `skaterWindowAggregation.ts:495-503`. For last-N, `numerator` is `<metric>_per_60_total_lastN`, which the writer fills with the pooled **rate** (`fetchRollingPlayerAverages.ts:2878-2879`). The fallback is `ratePer60(rate, toi_seconds_total_lastN)`.
- **Size.** Stored row above: SOG/60 last-5 is 8.406 with 6,852 s. The fallback would return 8.406 ÷ 6,852 × 3,600 = 4.417, a believable wrong number. It runs only when `_lastN` is null and `_total_lastN` is not; the writer sets both together and both are in the keep-list (`fetchRollingPlayerAverages.ts:399-401`), so stored rows cannot reach it. Test fixtures can.
- **Live side effect.** The aggregate's `numerator` (a rate) and `denominator` (seconds) are passed on and stored (`rankingQueries.ts:552-553`, `deploymentTiers.ts:712-713`). `calculateMetricRawValue` (`rankingCalculator.ts:143-164`) would recompute the same wrong value if a reader ever dropped `rawValue`.
- **Fix.** With RNK D4 / ROLL D2: read explicit window count fields. Until they exist, return `numerator: null` for last-N rate metrics and delete the fallback, so a missing rate is unknown (rule 5).
- **Test.** Fixture row with `sog_per_60_last5: null`, `sog_per_60_total_last5: 8.4`, `toi_seconds_total_last5: 6852` must return `rawValue: null`, not 4.41. After the count fields exist: counts 16 and 6,852 s give 8.406.

### N2 · 5v5 Points/60 sample uses even-strength TOI (M-SUS-070) · mis-specified · P1 once hot/cold is repaired, P2 today
- **Where.** Sample: `points_5v5 ÷ ev_time_on_ice` (`bandCalculator.ts:228-236`). Baseline: `points_5v5 ÷ toi_5v5_total` (`:402-408`).
- **Size (one player, 8478402, four seasons, read 2026-11-11).** Even-strength ÷ 5v5 TOI = 1.136, 1.081, 1.089, 1.081. The sample rate is therefore 8–12% below the baseline at identical play. This confirms the direction of upstream D14's 12% and removes "part of that may be real" for this part. Units checked: both fields are seconds.
- **Why it matters later.** Data weight is 13–20% today (n_eff 50 and 78 minutes against a 320-minute prior), so the stored value barely moves. Under decision 33 the observed window is compared with a baseline range, and this bias becomes a standing "cold" lean.
- **Fix.** Use one exposure for both. A per-game 5v5 TOI is needed in `player_stats_unified`; if it is not available, compute the baseline over `ev_time_on_ice` too and label the metric "even strength".
- **Test.** A fixture player whose every game equals his season average must give EWMA = baseline to 1e-6.

### N3 · PP Goals/60 and PP Points/60 bands are pinned to the baseline (M-SUS-071, 072) · mis-specified · P1
- **Where.** `bands.ts:209-226`: `priorStrength: 180` PP minutes, half-life 6 games. `bandCalculator.ts:540-547` blends with weight n ÷ (n + 180).
- **Size (2026-11-11 snapshot, 259 players).** Mean n_eff 4.35 PP minutes (l5) and 6.45 (l10): data weight 2.4% and 3.5%. Mean |value − baseline| is 0.038 (goals) and 0.068 (points) while mean |EWMA − baseline| is 0.98 and 2.32. The weights sum to at most 2.7 / 4.0 / 6.3 games for l3 / l5 / l10, so no window can pass about 12% even on a first unit (about 4 PP minutes a game).
- **Also.** 123 of 259 PP-goal baselines and 89 of 259 PP-point baselines are exactly 0, and the largest are 8.9 and 23.3 per 60: unshrunk small-sample history (decision 34 asks for a position prior). Games with no PP time are dropped before the window is cut, so "L5" is the last five games with PP time (Astra A1).
- **Same pattern, smaller.** From the same snapshot: SH% 7–10% data weight, IPP 8–12%, 5v5 points 13–20%, fantasy score 16–22%. Upstream SUS-030 gave one figure (28%) for shots; Astra noted it varies by metric. These are the numbers.
- **Fix.** Part of the decision 33 redesign: an expectation range for a window of this size from the pre-window baseline, with the observed window compared against it. Until then, do not present the band value as "current form". Prior strengths are hypotheses to fit (rule 12), in the exposure unit of each metric.
- **Test.** A player with five games at twice his baseline PP points rate on normal PP time must show an observed-window value at least 50% above baseline, and must not be "neutral".

### N4 · IPP baseline fallback mixes strengths (M-SUS-063) · mis-specified, conditional · P2
- **Where.** `bandCalculator.ts:446`: trials = `nst_oi_gf ?? es_goals_for`. Successes are all-situation points. `clamp` (`:518-522`) guards NaN only.
- **Size.** Player 8478402, 2026-27: 48 points, NST on-ice GF 59 (IPP 0.81), ES goals-for 35. The fallback would give 1.37, then `beta0 = (1 − 1.37) × 50 + 0.5 = −18`. Stored rows on 2026-11-11: 0 of 268 baselines above 1, so the fallback is not firing now. It fires for any season total with no NST on-ice row.
- **Fix.** No cross-strength fallback: when on-ice GF is unknown the season contributes nothing (rule 5, rule 13). Reject a baseline outside 0–1.
- **Test.** Season totals `{points: 48, nst_oi_gf: null, es_goals_for: 35}` must not contribute; the baseline falls to the remaining seasons or to the position prior.

### N5 · Forecast-band coverage (M-SUS-061) · mis-specified, dormant · P2
- `emitForecastBands` (`features.ts:848-857`) returns mean ± z·√variance clamped at 0, and calls the mean "median". Exact Poisson coverage of the nominal 50% band, computed for this audit: mean 0.1 → 90%, 0.3 → 74%, 0.7 → 35%, 1.5 → 59%, 3 → 62%, 6 → 46%. The 80% band covers 84–96%.
- `evaluateBandCalibration` (`:859-903`) returns hit rates of 0 for zero samples (rule 5: should be null).
- **Fix.** With decision 29: exact discrete quantiles, real coverage reported, PIT and interval score. **Test.** For each mean above, the band is the smallest integer range with coverage at least the nominal level, and the reported coverage equals the exact sum.

### N6 · "Fantasy Score" label (M-SUS-075) · mis-specified · P2
- The band uses `getDefaultFantasyPointsConfig("skater")`: G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25 (`lib/projectionsConfig/fantasyPointsConfig.ts:8-15`). The label is "Fantasy Score" with no scoring named. Decision 54: label it "FHFH default". No formula change.

### Undetermined · decision 13 for penalties (M-ROLL-064 to 066)
`penalties_drawn` and `total_penalties` are NST's per-game counts with no fallback. Whether NST counts a penalty-shot infraction as a penalty cannot be settled without an NST reference page (no NST calls in this audit). Also note `total_penalties` includes misconducts and majors, so "penalties taken/60" is not minors/60.

## 4. Owner questions (new only)

1. **5v5 Points/60 band:** keep the name and add a per-game 5v5 TOI source, or relabel it "even-strength" and use ES TOI on both sides? (N2)
2. **PP band windows:** should "L5" for a PP metric mean the last five games dressed (zero-PP games count as zero opportunity) or the last five games with PP time, labelled so? Astra A1 fixes the mechanism but not this choice.

Not re-asked: rankings last-N across seasons and the unit of ranked Unrealized xG (Wave 2 questions 21, 22; decision 75), the xS% denominator (decision 17), band meaning (decision 33).

## 5. Limits

- Cross-check only. I did not re-derive the part 1 verdicts I cite, and I read only the functions named in the tables.
- Magnitudes are dated samples: one band snapshot (2026-11-11, 259–272 players, l5 and l10) and one player (8478402) for unit, TOI-ratio and support-pair checks. They are not population rates.
- That player's newest `rolling_player_game_metrics` row is dated 2026-11-05 while `player_stats_unified` has his games of 11-07 and 11-09. This fits the held rolling runs noted in Batch A (`nst_persistence_unconfirmed`); I did not check other players or the cause.
- No test was run. N1's 4.417 and N4's −18 are arithmetic on read values, not executed code.
- N5's coverage figures are exact Poisson sums; the negative-binomial branch was not evaluated.
- Whether `player_totals_unified.nst_oi_gf` is ever null for a season with points (N4's trigger) was not counted: that needs a scan of the view.

## 6. Final analysis and fix-agent handoff

### Final analysis

Nothing in these 35 records overturns part 1. The rolling writer's 15 metrics are plain sums and pooled rates through the two accumulators already judged, and one stored row reproduces by hand. Their open problems are the ones upstream owns: rate aliases named `_total_` (ROLL D2), count and rate windows that can cover different games, support pairs that need not match the rate (Astra §2), the TOI minutes heuristic (D15), and availability and season-boundary contracts.

The five rankings records sit on those same aliases. Unrealized xG in last-N is a per-60 difference (RNK D4; decision 75 makes it a count in goals). SAX% and xS% divide by all attempts while the catalogue says "verified" Fenwick (RNK D5; decision 17). Season xGA/60 passes per-game TOI as its sample (RNK D6). The one thing part 1 did not write down is that the last-N branch has a fallback that divides a rate by seconds and that the "numerator" it exports is a rate (N1). It is harmless on stored rows and a trap for the D4 fix.

The sustainability band records are where the cross-check adds most. Part 1 found the band inert (D2), the PDO band pinned (D9) and the baseline contaminated (D4). Per metric, the pinning is general: for the six metrics sized in N3 the band value is 78–98% prior on the 2026-11-11 snapshot, and for the two PP rates it is 96–98%. (Hits/60 was left out: its stored n_eff is inflated by D1.) The 5v5 points band has a real exposure mismatch that part 1 sized but did not attribute (N2). The IPP baseline has an unsafe fallback (N4). Three specs (HDCF%, 5v5 SH%, PP SH%) have no collector and are dormant, as SUS-032 said. Astra's corrections stand: D2 is "nearly always neutral", not "never"; windows expand backward (A1); the normal band's uncertainty is manufactured (A6); FORGE reads the same inert comparison, so repairing the band switches FORGE adjustments on (decision 26).

### Recommendations, in priority order

1. **(P1, with SUS D2/D9) Band redesign covers every metric, not only PDO.** Files: `lib/sustainability/bands.ts` (`METRIC_SPECS` prior strengths), `lib/sustainability/bandCalculator.ts` (`computeGammaBand`, `computeBetaBand`, `computeNormalBand`, `computeTrendBandsForPlayer`). Readers: `pages/api/v1/sustainability/trend-bands.ts`, `entity-bands.ts`, `pages/trendsSandbox.tsx`, FORGE `skater-queries.ts` / `trend-adjustments.ts`. Test: N3's doubled-rate fixture, per distribution family, at the served API output (rule 7).
2. **(P1 after 1) One exposure for 5v5 Points/60.** `bandCalculator.ts` `collectGammaSamples` case `points_per_60_5v5` and `baselineForMetric`. Test: N2's identity fixture.
3. **(P2, with RNK D4 / ROLL D2) Remove the last-N rate fallback and stop exporting a rate as `numerator`.** `lib/rankings/skaterWindowAggregation.ts` `extractWindowMetric`; readers `rankingQueries.ts:552`, `deploymentTiers.ts:712`, `resultsLuckIndex.ts:83-92`, stored snapshot rows; fixture at `skaterWindowAggregation.test.ts:27-30`. Test: N1.
4. **(P2) IPP baseline: no ES fallback, reject out-of-range baselines.** `bandCalculator.ts` `baselineForMetric` case `ipp`. Test: N4.
5. **(P2, unserved) Forecast bands.** `lib/sustainability/features.ts` `symmetricBandFromMeanVariance`, `emitForecastBands`, `evaluateBandCalibration`; reader `model.ts` `projectCountMetric`. Do with decisions 29 and 37. Test: N5.
6. **(P2) Label.** "Fantasy Score (FHFH default)" in `bands.ts` and wherever the spec label is shown.

### Directional suggestions (not defects)

- Store each band's observed window (counts, exposure, games used) beside the blended value, so a reader can show "what happened" and "what we expect" separately.
- Keep prior strength in the metric's own exposure unit and fit it per metric on held-out windows (rule 12); a shared half-life table hides that an L5 of PP time is about four minutes.
- Either wire or remove the three collector-less specs after a dependency inventory (rule 6); do not delete them from a math finding.
- Show Goals Above Expected and Unrealized xG as one signed column, or state on the page that they are mirror images.

### Context for fix agents

- **Decisions:** 17 (xS% = ixG ÷ Fenwick, 0–100), 23 (luck vs non-overlapping baseline), 26 (band adjustment regresses toward the band), 29, 33, 34, 36 (band history rebuild is its own approved step), 37 (projections stay unserved), 54, 61, 68, 74, 75. Rules 4, 5, 7, 12, 13, 14, 16, 17.
- **Units (verified on stored rows):** `player_stats_unified.pp_toi`, `ev_time_on_ice`, `toi_per_game`, `nst_toi` are seconds per game. `player_totals_unified.pp_toi`, `toi_all_situations`, `toi_5v5_total`, `ev_time_on_ice` are season seconds. Band exposure is minutes; `n_eff` is discounted minutes, shots, goals or games depending on the metric. Band percentages are 0–1; rolling `shooting_pct` is 0–100.
- **Traps.** `<metric>_per_60_total_lastN` is a rate. `toi_seconds_avg_season` is per game. Zero-opportunity games are dropped before windows are cut (A1); fix that before reading any window size as a game count. Stored hits/60 `n_eff` averaged 260 minutes for l5 on 2026-11-11 against about 62 expected, so the 60× fallback (SUS D1) is still writing. Do not change the PP Points/60 denominator to team PP time (Astra withdrew that).
- **Do not change:** the exclusive percentile convention in `rankingCalculator.ts`; the MCM formula or BEAST thresholds (decision 74); NST as the xG source (decision 6); anything in the Codex-owned BLSH lane.
- **Needs owner approval (production actions):** any rebuild of `sustainability_trend_bands` history (decision 36); new columns or a view change for per-game 5v5 TOI or explicit window counts (migration); a rolling rebuild or backfill; reconciling the held rolling runs before any retry.
- **Suggested lanes.** *Sustainability bands* (recommendations 1, 2, 4, 6; one owner for `bands.ts` and `bandCalculator.ts`, validated together with FORGE's band reader). *Rankings window units* (recommendation 3, inside the existing RNK D4 / ROLL D2 lane, which also owns the rolling writer's count fields). *Sustainability projections* (recommendation 5, parked with decision 37).
