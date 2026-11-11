# W1-9 audit: sustainability, part 1 (M-SUS-001 to M-SUS-060)

Auditor: Claude (Fable), 2026-11-11. Checkout: `octoberBranch` at `e56c5d635`. No code was changed.

**How the evidence was gathered**
- Code read at the cited lines in the current checkout.
- Bounded, read-only production reads (date- or id-keyed, `pg_stat_activity` checked first: 0–1 active queries each time). Every figure from them is **dated sample evidence** (snapshot 2026-11-11 unless stated), not a population rate.
- The offline Python pipeline, the debug page and the legacy NST chart routes were read by a research sub-agent; I spot-checked its caller claims.
- Existing tests: 29 files, 193 tests in `web/lib/sustainability`, `web/lib/baselines` and `web/__tests__/pages/trendsSandbox.test.tsx` all pass. None of the defects below is caught by them.

---

## 1. Summary

| Verdict | Count |
|---|---:|
| Sound | 16 |
| Mis-specified | 28 |
| Wrong | 15 |
| Undetermined | 1 |

### Answers to the brief's questions

1. **Which score is canonical?** `s_raw` / `s_100` from `web/lib/sustainability/score.ts` (M-SUS-028, model `sustainability_score_v3`, active config revision 3, hash `fnv1a_e11d5c91`, confirmed in `model_sustainability_config`). The 0–100 "composite score" in `model.ts` (M-SUS-027) is reached only from the admin debug page. The Python pipeline is offline and cannot persist.
2. **What may a baseline contain?** Three different answers are live:
   - Luck z-scores: the player's **last three completed seasons**, shrunk to the league. The current season is excluded by construction (`priors.ts:49-51`). The exclusion breaks only when a last-N window reaches back into last season (M-SUS-057).
   - Trend bands: the **latest four season rows including the one in progress** (`bandService.ts:146-157`). The baseline contains the judged games (C28).
   - Skill z-scores: the **current-season league distribution** for the position, not the player's own history.
3. **One standardisation basis?** No. Luck z uses a beta-binomial predictive spread that knows the window's trial count. Skill z divides a 3-to-20-game rate by the between-player season SD, which has no sample-size term. They are summed with fixed weights.
4. **Missing components?** A missing z is set to 0 and a warning is stored. A window with zero trials also gives z = 0 with no warning. On 2026-11-11 no l10 row had a missing-component flag, but 234 of 482 forwards and 197 of 268 defencemen had `z_ppshp` exactly 0.
5. **Scales.** Checked on stored rows (player 8478402):
   - Per-game `nst_oi_pdo` is near 1 (1.131), and totals PDO is near 1. Consistent.
   - PP share is 0–1 in both the game rows and the season totals. Consistent.
   - `toi_per_game` and `nst_toi` are **seconds** per game. The trend-band fallback treats `toi_per_game` as minutes (defect D1).
   - Per-game `nst_ipp` and `nst_oi_shooting_pct` are **0–100**. Baselines read `nst_ipp` raw, so it is 100× the band's fraction (defect D5).

### Done-criteria status

| Criterion | Status |
|---|---|
| One written definition exists | Proposed in section 3 (D7). Needs the owner's choice. |
| Baselines shown to exclude the judged window | **Not met** for trend bands (D4). Met for luck z except across the season boundary (D11). |
| Opponent factors recomputed with the PK scale fixed, shift reported | Done analytically (D10). No stored rows exist to recompute: `sustainability_projections` has 0 rows. |
| A simple predictive check on stored history | Done on two dates (section 2, M-SUS-028 and section 5). |

### Top 5 findings by user impact

1. **Trend bands divide by 60× too much ice time for any game that lacks an NST row (D1, M-SUS-055).** Last night's games have no NST row when the band cron runs. On the eight snapshots from 2026-11-04 to 11-11, 26 to 94 of 272 players per day (10–35%) had shots/60 collapse to roughly 0.1–0.5 with a stored z-score of −13 to −22. The mean stored shots/60 EWMA was 3.4–4.6 against 5.0–5.1 for unaffected rows.
2. **The Sandbox "hot / cold" band status can never fire, and the stored band percentile is a constant (D2, M-SUS-029, 044).** The status compares the band's own shrunk value with that value's own 80% interval. On 2026-11-11, 11 of 15 metrics had 0 hot and 0 cold rows out of about 272 each; the few flags elsewhere look like edge artifacts (they were not inspected row by row). Stored `percentile` ranged 46.6–49.3 for blocks/60 and was exactly 50.0 for three metrics.
3. **`/charts` career averages are computed wrongly (D3, M-SUS-040).** A reducer precedence bug resets a running sum to zero on any non-numeric season, and each stat is an unweighted mean of season percentages. Worked examples: IPP `[60, "-", 70, 65]` returns 33.75, not 65; 1-for-4 and 20-for-250 average to 16.5% where the pooled value is 8.3%. The red/blue sustainability colours are driven by these numbers.
4. **"Trust These Risers" lists the unluckiest players, not risers, and the Sandbox reason list leads with a constant (D6, D8; M-SUS-042, 054, 050).** The dashboard's trust column is sorted by lowest luck pressure only. In the two dated samples those players averaged 0.31–0.34 points per game against 0.70–0.74 for the "fade" column. The "Trust High" label needs |pressure| ≥ 1.25, which 85% of sampled players passed. Separately, every skater's top Sandbox reason reads "Extreme Threshold is running above baseline by 5.00 standard deviations".
5. **PDO bands are pinned to 1.000 and trend-band baselines include the current season (D4, D9; M-SUS-032, 006).** The PDO prior strength of 300 was written for shots but is applied against a weight sum of about 4–7 games, so the stored value moves 0.0014 on average while the recent PDO moves 0.064. Count and percentage baselines are 21.5% current season at 15 games played and 60% by season end; the fantasy-score baseline is 60% current season from game one, and a rookie's baseline is 100% the games being judged.

The **canonical score itself (M-SUS-028) is internally consistent and its luck z-scores are well calibrated** (stored SD 0.90–1.06), but the 0–100 scale saturates and the name overstates what it measures. See D7.

---

## 2. Per-entry table

"Live" means a production page or cron reads or writes it. "Unserved" means the code runs nowhere in production today.

| ID | Verdict | Evidence | Reference compared | Magnitude | Downstream |
|---|---|---|---|---|---|
| 001 matview `player_baselines_3yr` | Mis-specified | `migrations/20250930_add_baseline_3yr_career.sql:1-8`. Absent from `pg_matviews` on 2026-11-11. Weights 0.6/0.3/0.1 are not renormalised and the newest season is the one in progress. | Marcel-style multi-season weighting | None: not deployed | None |
| 002 `sustainability_trends_v` | Sound | Deployed definition read from `pg_views`: `luck_pressure = −Σ w·z`, the same as the route. `LEFT JOIN` keeps rows when the baseline row is missing. | Internal consistency with M-SUS-042 | — | No reader in `web/` |
| 003 window baselines L3–L20 | **Wrong** | `web/lib/baselines/aggregations.ts:67-250`. `nst_ipp` falls through to the raw NST per-game value on a 0–100 scale with null → 0 (`:84`, `:234`, `:17-20`). Percentages are a mean of per-game ratios with zero-denominator games counted as 0 (`:28-31`, `:120-125`). | Pooled rate Σ successes ÷ Σ trials | Stored row: L5 `nst_ipp` mu = 70 against a band value near 0.7; L5 SH% mu = 0.150 where pooled is 3/17 = 0.176 | Sandbox L5/L10/L20 comparison cards |
| 004 3-year and career baselines | **Wrong** | `aggregations.ts:462-517`, `:540-650`. (a) No-denominator fallback divides a weighted rate by weighted games (`:500-504`, `:626`). (b) `nst_oi_shooting_pct` uses a column that does not exist (`nst_oi_shots`, `:563`). (c) `seasonTotals[0]` is the current season, so `win_season_prev` is the season in progress (`rebuild-baselines.ts:300-311`). (d) Career `nst_ipp` reads a column the totals view lacks. | Pooled multi-season rate | Stored row: 3-year PDO = 0.0249, 3-year on-ice SV% = 0.0205, career on-ice SH% = 0 (numerator 629, denominator 0), career IPP = 0, `win_season_prev` season = 20262027 with 19 GP | Career comparison in the Sandbox (shows blank for IPP and on-ice SH%). `win_3yr` has no live reader |
| 005 PP share controls | Mis-specified | `aggregations.ts:391-459`; `rebuild-baselines.ts:315-320`. The "last season" reference is the current season's share, so the delta compares L10/L20 with a season that contains them. Hysteresis uses the reference, not a stored prior state. | Internal | Stored: ref 0.772, smoothed 0.798 | No reader of `band_widen_factor` or `pp1_flag` found |
| 006 trend-band baselines | **Wrong** | `bandService.ts:146-157` (latest 4 seasons, no exclusion); `bandCalculator.ts:79`, `:109-188`, `:488-512`. Confirms C28, with a correction to its size (below). PDO baseline is a constant 1.0 (`:486-487`). `points_per_60_5v5` baseline divides by 5v5 TOI but samples divide by even-strength TOI (`:228-236`, `:402-408`). | A baseline must not contain the judged sample | Current-season share of the baseline = 0.6g ÷ (0.6g + 0.3·82 + 0.1·82): 21.5% at 15 GP, 60% at 82 GP. Fantasy score: 60% from game one. Rookie: 100% | Every trend band, the Sandbox, FORGE's sustainability-band adjustment (part of W1-6/7) |
| 007 comparison deltas | **Wrong** | `entitySurfaceServer.ts:276-470`. Inherits 003 and 004. The fallback "L5/L10/L20 average" is a mean of already-smoothed band values (`:399-422`), and "season" is the mean of every stored band value. | Like-for-like scale and estimator | IPP "vs L5" ≈ (0.7 − 70) ÷ 70 = −99% | Sandbox comparison chips |
| 008 backtest metrics | Mis-specified | `backtest.ts:114-117`, `:151-155`: each variant is scored on its own non-null subset, then ranked. Errors are pooled across metrics and horizons (`backtestHarness.ts:64-72`). The 3-class Brier reference of 2/3 is right (`:195`). | Paired comparison on one cohort | — | No production caller; no stored results |
| 009 rate, z and weight helpers | Sound | `features.ts:248-440`. Seconds in, per-60 out. | — | — | Tests only |
| 010 usage and context deltas | Mis-specified | `features.ts:201-205`, `:603-710`: "greater than 1 means 0–100" misreads small percentages; PDO is not normalised. | — | On-ice SH% 0.9 against 9.0 gives +0.81, not −0.081 | Tests only |
| 011 Python finishing residuals | Mis-specified | `functions/lib/sustainability/finishing.py:57-79`. Fixed SD at every window length; reliability forced to 1. | Poisson spread of goals − ixG | At 40 games the count z is about 2.1× too high and the rate z about 12.6× too low | Offline only |
| 012 finishing residuals in baselines | Mis-specified | `aggregations.ts:52-62`. Subtracts all-situations ixG/60 from 5v5 goals/60; missing ixG becomes 0, so the game counts as goals above expected. | Owner decision 23: (G − ixG)/60 with matched exposure | — | No live reader |
| 013 Python player posterior | Mis-specified | `player_priors.py:72-73` puts the target season in the blend; `target − 1` season arithmetic fails for 8-digit ids. | — | With 8-digit ids every player is silently a rookie | Offline only |
| 014 Python league priors | Mis-specified | `priors.py:105-127`; k = 50/150/30 against 200/800/60 in TS. Conjugate maths is right. | Beta-binomial EB | 10 goals on 50 shots: 15.0% (Python) against 12.0% (TS) | Offline only |
| 015 linear shrinkage helpers | Sound | `features.ts:442-560`: n/(n+k). The gamma variant takes minutes while the same file's per-60 helper takes seconds. | Tango n/(n+k) | Unit trap only | Tests only |
| 016 rookie fallback | Mis-specified | `priors.ts:351-379`. Doubling the prior strength for a player with no history **narrows** the predictive spread, so a rookie's z is slightly larger, not more cautious. | A less-known talent should carry more uncertainty | z changes by about 3% (30-shot window, k 200 → 400) | Luck z for low-history players |
| 017 player 3-season posterior | Sound | `priors.ts:49-51`, `:295-349`, `:425-508`. Completed seasons only. Weights are not renormalised, so the blended trial count is a weighted average season, not a sum: a deliberate down-weighting. | Beta-binomial EB | — | Luck z baseline |
| 018 league Beta priors | Sound | `priors.ts:54-122`, `:383-422`. Stored 2026-27 means equal a fresh pooled recomputation to 4 dp (F: SH% 0.1332, on-ice SH% 0.1180, IPP 0.6824, PP SH% 0.1723; D: 0.0649, 0.1098, 0.4302, 0.1081). Implied talent SDs are plausible (SH% 2.4 pts, on-ice SH% 1.1 pts, IPP 6 pts). | Beta-binomial EB | Thin in the first week of a season | Luck z |
| 019 opponent factors | **Wrong** | `features.ts:170-176`, `:726-779`. Confirms C27 and adds a second error: tier 1 is the **best** penalty kill (`dashboard/teamContext.ts:34-39`) yet gets the largest positive edge. | A weak PK should raise, a strong PK lower, PP scoring | D10 | **Unserved**: `sustainability_projections` has 0 rows and no cron calls the recompute route |
| 020 count projections | Mis-specified | `recompute.ts:109-185`, `model.ts:740-806`. The rate is derived from the per-game average and converted back with the same TOI, so the projection is the season average × horizon. Bands are a normal approximation with no uncertainty about the rate. | Poisson or negative binomial predictive interval | Bands too narrow early in a season | Unserved (0 rows) |
| 021 faceoff bands | Mis-specified | `model.ts:807-839`: Wald interval, no shrinkage. | — | About 29% too narrow in a worked case | Debug page only |
| 022 Python reliability and clipping | Mis-specified | `reliability.py:59` is √(n/(n+k)); `clipping.py:39` is tanh(z/3); clipping is applied before damping. | Tango n/(n+k) | — | Offline only |
| 023 Python scoring and quintiles | **Wrong** (small) | `pipeline.py:162` passes the wrong object, so guardrails use 0.01/0.99, not the configured 0.005/0.995. Quintile 1 is top here; 4 is top in TS. | — | ≤ 0.5 points | Offline only |
| 024 TS distribution and quintiles | Sound | `distribution.ts:55-124`. The "per batch" lead is refuted: quintiles are assigned only under `runAll` (`rebuild-score.ts:152-166`). | — | The cron never passes `runAll`, so 0 of 3,000 rows on 2026-11-11 have a quintile and the snapshot table is empty | Leaderboard and player payloads return a null quintile |
| 025 guardrails | Sound | `guardrails.ts:16-18`, `:66-135`. The ±8 clamp bound 1–5 of 750 rows per window. | — | — | Score rows, trends route |
| 026 debug probability model | Mis-specified | `model.ts:318-393`, `:510-562`. The gradient is right. Platt scaling is fitted on the training logits; "softmax of log p" is plain renormalisation. | Platt (held-out fit) | — | Debug page only |
| 027 composite score (debug) | Mis-specified | `model.ts:860-960`. A second, unrelated 0–100 "sustainability score". Raw range is −6.25 to 106.25. The flags use |z|, so z = −2 can read "overperforming". | — | — | Debug page only |
| 028 canonical `s_raw` / `s_100` | Mis-specified | `score.ts:154-288`. See D7. | Regression to the mean with stat-specific reliability; out-of-sample test | l10 on 2026-11-11: `s_raw` SD 2.5, so `s_100` has mean 54, SD 35, with 78 of 750 at ≤ 5 and 107 at ≥ 95. Skill z-scores correlate 0.74–0.80 with each other | Dashboard badge, Sandbox, leaderboard, player API |
| 029 gamma / beta / normal band | **Wrong** | `bandCalculator.ts:88-107`, `:524-653`. The point value is the posterior mean (the "two estimators" lead is refuted for gamma and near-refuted for beta). `percentile` is that mean's linear position inside its own interval, so it is about 50 always. The normal band's margin divides by √Σw instead of the effective sample size. | Bayesian posterior; Kish effective n = (Σw)² ÷ Σw² | D2. Normal bands are about 22% too wide at l10 (Σw 5.8 against effective n 8.7) | Stored bands, Sandbox |
| 030 half-life weights and blend | Sound | `bands.ts:256-300`. With a 5-game half-life the weights can never sum past 7.7 games, so l10 and l20 bands are nearly the same and data weight is capped at about 28% against a 360-minute prior. | — | Design consequence, not a bug | Bands |
| 031 credible intervals | Sound | `bands.ts:304-487`. Numerical Recipes forms. The comment calls a Bayesian quantile "Clopper-Pearson". | — | Not stress-tested for extreme shapes (limits) | Bands |
| 032 metric spec table | **Wrong** | `bands.ts:132-138`: PDO is "normal" with prior strength 300, but the normal band's n is the sum of decay weights (`bandCalculator.ts:625-630`). Seven specs have no collector and never produce rows. | — | D9: data weight ≈ 2% | PDO band |
| 033 Python windows | Mis-specified | `windows.py:30`, `:98-135`: "STD" is a trailing 45 days, and windows cross seasons. | — | — | Offline only |
| 034 Python z-scores | Mis-specified | `zscores.py:26-80`: fixed placeholder SDs; only three metrics get a z, so the skill weights are dead. | Beta-binomial spread | — | Offline only |
| 035 TS reliability and soft clip | Mis-specified | `features.ts:563-600`: named reliability but is its square root. | Tango n/(n+k) | 0.707 against 0.5 at n = k | Tests only |
| 036 beta-binomial window z | Sound | `windows.ts:161-185`. var = μ(1−μ)(K+n) ÷ (n(K+1)) is the beta-binomial variance of s/n. Stored l10 z SDs: SH% 0.90/0.98, on-ice SH% 1.01/1.00, IPP 1.04/1.06 (F/D). | Beta-binomial EB | Means are slightly negative (−0.04 to −0.29). At small n the z is discrete and skewed (2 goals on 6 shots ≈ +1.9; 0 on 6 ≈ −0.8) | Canonical score, trends route |
| 037 sigma and config seeds | Mis-specified | `migrations/sql/20250928_seed_sigma_constants.sql:1-3` ("placeholder"). `sustainability_sigma_constants` is not in the production catalog. The active config keeps `sd_mode: fixed` and `freshness_days: 45`, which no TS code reads. | — | None | Config identity hash only |
| 038 `finalize_sustainability_score_snapshot` | Sound | Deployed body read from `pg_proc`. The cross-version lead is refuted: the update joins on the table's primary key. | — | Effectively never run (0 snapshot rows) | Recompute queue route |
| 039 `vw_entity_sustainability_scores` | Mis-specified | Deployed definition: `s_raw ≥ 0.75` is "overperforming". High `s_raw` means low luck and strong process, which is the opposite. | — | Direction inverted | No reader in `web/` (the app derives "unavailable", `entitySurface.ts:263-269`) |
| 040 legacy career averages | **Wrong** | `web/pages/api/CareerAverages/[playerId].ts:95-220`. D3. | Pooled career rate | D3 | `/charts` |
| 041 legacy date-window stats | **Wrong** | `web/pages/api/SustainabilityStats/[playerId].ts:59-65`, `:82`, `:101-107`. Filters NST by the player's current team, so a traded player's earlier games drop out. Name-equality match. The team map has no Utah entry. | — | Traded players only | `/charts` |
| 042 served luck pressure | Mis-specified | `web/pages/api/v1/sustainability/trends.ts:202-208`, `:239-251`. Confirms C29: the total is negated, the per-component "Impact" is not. `z_soft` repeats `z_raw`; `r` and `n` are always null. | — | Signs disagree in the "Why?" table | FORGE dashboard card |
| 043 `trendsDebug` demo model | **Wrong** | `web/pages/trendsDebug.tsx:140-153`, `:322-326`, `:1333-1334`. Trained on z-scale rows, scored on raw features; a 100-scale PDO of 101.2 becomes 0.1012. | — | An all-zero player scores 97% "hot" | Admin debug page only |
| 044 Sandbox streaks and barometer | **Wrong** | `web/pages/trendsSandbox.tsx:593-595`, `:2318-2322`, `:2961-2963`. D2. The barometer clips `s_raw` at ±3 while its SD is 2.5. | — | D2 | `/trendsSandbox` |
| 045 Python benchmark generator | **Wrong** (harness) | `benchmark.py:37-40`: the Poisson branch never runs; 60+ games produces an invalid date. | — | — | Benchmark only |
| 046 joined feature row | Undetermined | `dataJoins.ts:58-119`. As-of is inclusive; whether that leaks depends on whether a snapshot means before or after that date's games. `seasonTotal` has no date bound. | — | — | Tests only. Settled by a written snapshot convention |
| 047 legacy NST stat definitions | Mis-specified | `SustainabilityStats/[playerId].ts:123-125`: xS% = ixG ÷ shots as a fraction, and the chart labels the column "XG Per Sixty". | Owner decision 17: ixG ÷ unblocked attempts, 0–100, one name | — | `/charts` |
| 048 tier labels | Mis-specified | `components/sustainability/formatting.ts:10-34`; `SustainabilityCard.tsx:271-274`. Terciles are taken over the 16 rows on screen, which are the 8 luckiest and 8 unluckiest players. | — | The same score changes tier between views | Dashboard badge |
| 049 career colour rules | Mis-specified | `SustainabilityVSCareerChart.tsx:29-123`. One-sided fixed thresholds with no sample-size term; equality is red for two stats. | Binomial spread of the window | On 8 shots the SD of SH% is about 10 points against a 2-point threshold | `/charts` |
| 050 reason highlights | **Wrong** | `entitySurface.ts:285-310` lists every numeric component; `observability.ts:13-17` stores `extremeThreshold: 5` at the top level. D8. | — | Every skater | `/trendsSandbox` reasons |
| 051 recompute verification and drift | Sound | `observability.ts:40-108`. The sample diff mixes logit and 0–100 units (cosmetic). Drift runs only under `runAll`, so never in the cron. | — | — | Route response, logs |
| 052 leaderboard and rookie flag | Sound | `read.ts:230-290`. Rookie = current-season row and no earlier season with games. | — | — | `/api/v1/sustainability/leaderboard` |
| 053 config hashes | Sound | `runtimeContract.ts:18-35`, `config.ts:118-150`. The TS hash is checked against the stored row. Nothing compares it with the Python hash. | — | — | Provenance |
| 054 luck-pressure sort and "Trust" label | Mis-specified | `SustainabilityCard.tsx:59-64`, `:254-265`; `lib/dashboard/playerInsightContext.ts:19-21`. D6. | — | D6 | FORGE dashboard |
| 055 trend-band samples | **Wrong** | `bandCalculator.ts:200`, `:210`, `:220`, `:260`, `:270` (`toi_per_game * 60`); `:338-339` (missing PP share → 0); `:341-350` (PDO exposure computed, then ignored). D1. | TOI in one unit | D1 | Every per-60 band; FORGE band adjustment |
| 056 skill window rates | Sound | `score.ts:71-114`. `nst_hdcf` is the **individual** count (`nst_gamelog_as_counts.hdcf`), matching the reference; the on-ice lead is refuted. Games without NST ice time are skipped, not zeroed. | — | — | Canonical score |
| 057 window counts | Mis-specified | `windows.ts:80-96`: last N rows by date with no season filter. | Baseline must exclude the judged window | Early in a season the window reaches into the season that carries 0.6 of the baseline weight. Sample: 1 of 20 games at 19 GP; all 20 on opening night | Luck z, early season |
| 058 skill league reference | Mis-specified | `score.ts:23-68`. Unweighted over every player with a rate, however few games. | Reference SD from a qualified population | 2026-27 forwards: ixG/60 SD 0.450 against 0.345 for GP ≥ 10 (+30%); HDCF/60 2.10 against 1.54 (+36%); iCF/60 4.60 against 3.95 (+16%). The SD also falls through the season (0.326 for all of 2025-26) | Skill z, so `s_raw` |
| 059 count distribution | Mis-specified | `features.ts:207-246`, `:782-811`: the "Poisson" quantiles are a normal approximation. | Exact Poisson quantiles | Small at a 5-game horizon | Unserved |
| 060 multi-game aggregation | Sound | `features.ts:813-846`: sums means and variances; assumes independent games and a known rate. | — | — | Unserved |

---

## 3. Defects

Priority: **P0** user-visible wrong numbers now; **P1** misleading or will be wrong when a dependency changes; **P2** unserved, offline or cosmetic. Per the Batch A rules, every fix lists its readers, tests recompute from components, and unknowns stay unknown.

### D1 (P0). Trend-band ice-time fallback is 60× too large — M-SUS-055
- **What.** `const toiSeconds = row.nst_toi ?? (row.toi_per_game ?? 0) * 60` in five collectors. `toi_per_game` is already seconds per game (stored value 1,474). When the NST row is missing, exposure becomes 60× the true ice time. NST-sourced counts (iCF, ixG) are also null → 0 on that game.
- **Magnitude (dated sample).** On 2026-11-10 all 252 skater rows lacked NST data at snapshot time. Shots/60, l5, 2026-11-04 to 11-11: 26–94 of 272 rows per day had exposure above 200 minutes (445 row-days in all), and all but seven of those had z ≤ −5. Examples from 11-11: baseline 6.51, stored EWMA 0.44, z −21.7; baseline 3.34, EWMA 0.15, z −17.6. Hits, blocks, iCF and ixG per 60 share the path.
- **Readers.** `/api/v1/sustainability/trend-bands`, `entity-bands`, the Sandbox, and FORGE's sustainability-band adjustment (confirm in W1-6/7).
- **Fix.** Treat `toi_per_game` as seconds. For iCF and ixG, skip a game with no NST row instead of counting zero events (the score path already does this, `score.ts:96-99`). Rebuild affected history only as its own approved, bounded step.
- **Test.** A fixture with one game `{nst_toi: null, toi_per_game: 1080, shots: 3}` plus four normal games: shots/60 is recomputed from Σ shots ÷ Σ seconds and must equal that value; exposure must be within 1% of Σ seconds ÷ 60. A second fixture asserts an NST-less game contributes nothing to iCF/60.

### D2 (P0). Band hot/cold status is inert and `percentile` is a constant — M-SUS-029, 044
- **What.** `status = value > ciUpper ? "hot" : value < ciLower ? "cold" : "neutral"` uses the band row's `value`, which is the posterior mean, against the 10th–90th percentile of the same posterior. `percentile = 10 + 80·(value − lower) ÷ (upper − lower)` is therefore about 50.
- **Magnitude (2026-11-11, l5 and l10).** 0 hot and 0 cold for shots, iCF, ixG, hits, blocks, 5v5 points, PP goals and PP points per 60, PP share, PDO and fantasy score. SH% showed 22 "cold" rows, IPP 2 hot and 5 cold, on-ice SH% 4 cold and on-ice SV% 3 hot; these sit at percentile 9.5 or 90.5 and look like zero-baseline or tiny-sample artifacts (not inspected row by row). `percentile` mean 40–54, exactly 50.0 for the three normal metrics.
- **Readers.** `trendsSandbox.tsx` (three places), stored `percentile` and `z_score` columns.
- **Fix.** Decide what the band is. The label "usual range" implies an **expectation band**: the predictive interval for a window of this size given the baseline alone. Status then compares the window's observed rate (the EWMA) with that band. Drop `percentile` or define it as the baseline-predictive CDF of the observed rate.
- **Test.** A player whose last five games run at twice the baseline rate on normal ice time is "hot"; one at the baseline is "neutral". Assert that `percentile` differs between them by more than 30.

### D3 (P0). Legacy career averages — M-SUS-040
- **What.** `prev + X || 0` zeroes the running sum whenever a term is NaN, while the divisor still counts every row. Each stat is an unweighted mean of per-season values. No season or split filter.
- **Magnitude.** In section 1, finding 3. The secondary-assist line hits the bug on any zero-assist season.
- **Readers.** `hooks/useCareerAveragesStats.ts`, `SustainabilityVSCareerChart` on `/charts`. A dead duplicate lives in `pages/api/Teams/[teamAbbreviation].ts` (no deletion proposed; cleanup is a separate decision).
- **Fix.** Pool: Σ numerator ÷ Σ denominator over completed seasons, skipping (not zeroing) unparseable rows, and excluding the current season so the comparison is not circular.
- **Test.** Seasons `[{G 1, S 4}, {G 20, S 250}]` give 8.27%; a row with "-" changes nothing; a zero-assist season does not reset secondary-assist share.

### D4 (P1). Trend-band baseline contains the judged season — M-SUS-006 (C28, resized)
- **What.** `fetchSeasonTotals` takes the newest four rows of `player_totals_unified` with no exclusion. Weights apply to counts, so the current season's share grows with games played.
- **Magnitude.** 21.5% at 15 GP, 43% at 41 GP, 60% at 82 GP for count and percentage metrics (three full prior seasons assumed). Fantasy score is weighted per season, so 60% from the first game. A rookie's baseline is entirely the current season. TRIAGE C28's "60%" is the end-of-season figure, not the present one. History rebuilds also use seasons after the snapshot.
- **Fix.** Use completed seasons before the snapshot's season, as `priors.ts:49-51` already does, shrunk to the position mean with the same n/(n+k) used for the luck priors. A player with no prior season gets the position prior and a "no history" flag, not his own current games.
- **Test.** Changing only current-season totals must not change the baseline. A history snapshot dated in 2025 must not read a 2026 season row.

### D5 (P1). Baseline payload scales and estimators — M-SUS-003, 004, 007
- **What.** Listed in the table: `nst_ipp` on 0–100 and zero-filled; mean of per-game ratios; the rate ÷ games fallback; the wrong on-ice shots column; "previous season" = current season; career includes the current season.
- **Readers.** `entitySurfaceServer.ts:366-470` (L5/L10/L20/career chips). `loadPlayersForSnapshot` reads only ids and positions.
- **Fix.** Store and read pooled rates from the `numer`/`denom` already saved; compute IPP as Σ points ÷ Σ on-ice GF over games that have an NST row; use `nst_oi_sf`; blend rate-only metrics by Σ(w·rate·GP) ÷ Σ(w·GP); name the buckets for what they hold.
- **Test.** Five games with IPP inputs 1/3, 3/3, 4/4, 1/2, 2/3 give 11/15 = 0.733 on a 0–1 scale. Three seasons of PDO 1.01, 1.00, 0.99 give a 3-year value between 0.99 and 1.01.

### D6 (P1). Dashboard "Trust / Fade" framing — M-SUS-042, 054, 048
- **What.**
  - The trust column is the lowest luck pressure, with no production or process condition. Titled "Trust These Risers".
  - "Trust High" means |pressure| ≥ 1.25. Luck pressure had SD 2.1 on 2026-11-11. In the 2026-10-27 sample, 239 of 280 players (85%) were beyond ±1.25.
  - The code comment and copy say luck is measured against "league norms for the position"; the baseline is the player's own history (`windows.ts:215-219`).
  - Component "Impact" has the opposite sign to "Luck risk" (C29).
  - Badge terciles come from the 16 extreme rows on screen.
- **Magnitude (dated samples, 2026-10-20 and 10-27, n = 285 and 280).** Trust column averaged 0.34 and 0.31 points per game in the window; fade column 0.74 and 0.70. Over the next two weeks the trust group rose by 0.13 and 0.14; the fade group fell by 0.12 and 0.03.
- **Fix.** Rename to what it is ("Unlucky lately" / "Running hot"), or require a rising production signal for "risers". Base the confidence label on a percentile of |pressure| or on the trial count. Negate the component contributions to match the total. Take badge terciles from the stored league distribution.
- **Test.** Components sum to the displayed total. A fixture league where 85% exceed the "High" threshold fails.

### D7 (P1). The canonical score: scale, composition and name — M-SUS-028, 058
- **What it is.** `s_raw = −1.2·z_SH% − 1.0·z_oiSH% − 0.8·z_IPP − 0.4·z_PPSH% + 0.9·z_ixG60 + 0.7·z_iCF60 + 0.6·z_HDCF60`, each z clipped to ±3, then `s_100 = 100·sigmoid(s_raw)`.
- **Problems.**
  - **Saturation.** `s_raw` has SD 2.5, so the logistic maps a quarter of the league to ≤ 5 or ≥ 95. `s_100` is not a probability and not a percentile.
  - **Two bases.** Luck terms are deviations from the player's own history with a sample-aware spread. Skill terms are deviations from the league mean with no sample term. A high-volume shooter gets a permanent boost; the skill terms measure player quality, not whether recent form is sustainable.
  - **Triple counting.** ixG, iCF and HDCF per 60 correlate 0.74–0.80; SH% and on-ice SH% 0.48.
  - **Reference SD.** Inflated 16–36% by players with a handful of games, and it shrinks as the season goes on (M-SUS-058).
  - **No reliability weighting by window.** l3 and l20 use the same weights.
- **Predictive check (dated, two overlapping samples).** Outcome: change in points per game from the three weeks before the snapshot to the two weeks after.

  | | 2026-10-20 (n 285) | 2026-10-27 (n 280) |
  |---|---:|---:|
  | corr(raw points/game, change) — the naive regression-to-the-mean baseline | −0.30 | −0.17 |
  | corr(luck pressure, change) | −0.32 | −0.24 |
  | corr(`s_raw`, change) | +0.31 | +0.25 |
  | partial corr(luck pressure, later points/game given earlier points/game) | −0.21 | −0.18 |
  | corr(`s_raw`, earlier points/game) | −0.37 | −0.39 |

  Reading: the luck component carries real signal beyond the raw rate (partial correlation about −0.2, the right sign). As a predictor of the change it is about level with the raw rate alone, not clearly better. `s_raw` is **negatively** related to production, so a high score does not mean a good or a safe player. These are alarms and direction checks on small, overlapping, early-season samples; the luck SD was 4.5 in the 10-20 sample against 2.1 on 11-11, and the cause was not investigated. They are not a validation.
- **Proposed single definition (for the owner).** "Sustainability = how far a player's recent results sit from what his own established rates and current shot volume would produce, in units of what chance alone would explain." That is the luck component, on a percentile scale within position. Report process (ixG, iCF, HDCF per 60 against **his own** baseline) as a separate "process trend" number, not blended in.
- **Test.** Scale: with fixture z-scores drawn at SD 1, fewer than 5% of scores fall outside 5–95, or the output is a percentile. Composition: doubling a player's season-long shot volume without changing recent-versus-own-history deviations must not move the score.

### D8 (P1). Sandbox reason list leads with a constant — M-SUS-050
- **What.** `extractReasonHighlights` treats every numeric component as a z-score. `extremeThreshold: 5` is always present and always the largest.
- **Fix.** Read only `z_*` keys (as `read.ts:29-40` does), and word skill terms as "against the position average", luck terms as "against his own history".
- **Test.** Components `{z_shp: 1.2, extremeThreshold: 5}` return one highlight, keyed `z_shp`.

### D9 (P1). PDO band pinned to its baseline — M-SUS-032, 055
- **What.** Prior strength 300 against Σw of about 4–7. The per-game shot exposure is collected and then ignored. The EWMA is an unweighted-by-shots mean of per-game PDO (stored mean 0.972, not 1.0).
- **Magnitude (2026-11-11).** Mean |value − 1| = 0.0014 against mean |EWMA − 1| = 0.064; median |z| = 0.01.
- **Fix.** Build PDO from its two beta components (on-ice SH% and SV% already have correct bands) or weight by shots and express the prior in shots.
- **Test.** Ten games at on-ice SH% 15% and SV% 93% on normal shot volume give a PDO value above 1.02.

### D10 (P2 now, P0 if projections are ever served). Opponent PK factor — M-SUS-019 (C27)
- **What.** Baseline 16 on a 1–3 tier, and the best PK gets the largest boost.
- **Shift with the scale fixed (analytic; no stored rows exist).** Today, at full sample weight: goal multiplier +4.1% (tier 3) to +4.7% (tier 1), assists +3.3% to +3.8%, defense score +0.065 to +0.075 for **every** opponent. At 15 opponent games (weight 0.375): goals +1.5% to +1.8%. With `pkEdge = (tier − 2)` (tier 3 weakest = +1): goals −5%, 0, +5% and assists −4%, 0, +4% for tiers 1, 2, 3. Net shift for a tier-1 opponent: about −9.7 points on the goal multiplier at full weight.
- **Also.** The tier itself is one game's PK% (W1-4 D3), so the input is noise until that is fixed. Use pooled season PK% directly.
- **Test.** A stronger PK must never raise the goal multiplier; a league-average PK gives exactly 1.

### D11 (P1, seasonal). Windows cross the season boundary — M-SUS-057
- **What.** The last-N window has no season filter, and last season carries 0.6 of the baseline weight.
- **Fix.** Either stop the window at the season start (and report the shorter n), or keep the crossing games and drop them from the baseline. Owner decision 18's calendar logic suggests the first.
- **Test.** On opening night, an l20 window reports the games actually played this season.

### D12 (P1). `/charts` window stats — M-SUS-041, 047, 049
- Traded players lose earlier-team games; xS% is not the owner's definition (decision 17) and is labelled "XG Per Sixty"; colour thresholds ignore sample size.
- **Fix.** Query by player across teams; one expected-shooting definition; thresholds in units of the window's binomial SD.
- **Test.** A player traded mid-window has all his games counted.

### D13 (P2). Quintiles and distribution snapshots are never produced — M-SUS-024, 038
- The cron calls `rebuild-score` in four offset slices without `runAll`, so quintile assignment, the distribution snapshot and drift monitoring never run. The SQL finalizer is only reached through the recompute queue.
- **Fix.** Call the finalizer once after the last slice. Readers already handle null.

### D14 (P2). Smaller items
- M-SUS-016: rookie prior boost narrows the spread; the effect is about 3%.
- M-SUS-029: normal-band margin should use Kish effective n.
- M-SUS-006/055: 5v5 points over even-strength TOI in samples, over 5v5 TOI in the baseline. On 2026-11-11 the sample mean was 12% below the baseline mean; part of that may be real.
- M-SUS-039: view label direction inverted (no reader).
- M-SUS-012: finishing residual mixes strengths; align with decision 23.
- Offline Python (011, 013, 014, 022, 023, 033, 034, 045) and debug (021, 026, 027, 043): leave as is unless the pipeline is revived. If it is, it must not be called "the" sustainability score: it has different windows, k values, clipping and quintile direction.

---

## 4. Questions for the owner

1. **Definition.** Is "sustainability" the luck gap only (D7's proposal), with process shown separately? Or should one blended index stay?
2. **Band meaning.** Should the Sandbox band be an expectation range from the baseline (so hot/cold can fire), as D2 proposes?
3. **Baselines.** Completed seasons only for every sustainability baseline (D4)? What does a rookie get: position prior, or no band?
4. **Dashboard wording.** Keep "Trust These Risers" and add a real riser condition, or rename the columns (D6)?
5. **Window at season start.** Stop at the season boundary, or reach into last season (D11)?
6. **Projections.** `sustainability_projections` is empty and nothing schedules the recompute. Is that feature parked? If so D10 can wait.
7. **History.** Bands with the 60× error are stored back through the season. Rebuild them after the fix (bounded, approved), or only fix forward?

---

## 5. Limits

- **Sample evidence is dated and small.** Band counts cover 272 players per snapshot on eight dates. Score distributions are one date. The predictive check uses two overlapping early-season dates; its past and future windows are calendar ranges, not the exact last-10 games; no confidence intervals were computed; and the stored 10-20 scores have a much wider luck spread than today's, for a reason not investigated. Treat every correlation as an alarm, not a proof.
- **Why only 272 players have bands each day** (against 750 scored) was not investigated.
- **Opponent factors** could not be recomputed on data: no stored projection rows exist. The `sv_pct` scale and TOI unit in `nst_team_all` were not read.
- **Numerics.** The incomplete beta and gamma routines were judged from code and from plausible stored intervals, not stress-tested at extreme shapes.
- **NST contents.** No NST call was made. Whether the legacy career table includes the current season or per-team split rows is unverified.
- **FORGE's use of bands** (how far D1 and D4 reach into projections) belongs to W1-6/7 and was not traced here.
- **What triggers `rebuild-baselines`** is not in `web/vercel.json`; rows are current to 2026-11-11, so something runs it. That route reads every game row for every player on each run, which is worth a look under the read-hygiene rules.
- **Sub-agent findings** for the offline, debug and legacy entries were spot-checked for callers, not re-derived line by line.
- Scratch SQL was run ad hoc and is not in the repo. Before any fix relies on a magnitude here, keep the query, date and row counts with the fix plan.
