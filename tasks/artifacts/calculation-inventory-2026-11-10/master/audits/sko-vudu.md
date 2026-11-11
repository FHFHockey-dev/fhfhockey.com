# Audit W3-7: sKO and VuDu, M-SKO-001 to 029 and M-VUDU-001 to 003

Auditor: Claude (Fable), 2026-11-11, `octoberBranch` at `2372f694e`. No code changed. Inputs: `RULES-DIGEST.md` (decisions 1–80), `OWNER-INTENT-SKO-VUDU.md` (binding for its sourced decisions; its proposed formulas are treated as unvalidated), the slim packets, `audits/blsh-buy-low-sell-high.md`, `audits/sql-cross-cut.md` and both Astra reviews.

## 0. Brief

- **Questions.** (1) Is each calculation arithmetically right for its own contract? (2) Does it fit the owner's definition: sustainability = whether current production is supported and likely to persist against the player's own pre-window baseline (decisions 32–35, 61, 68, 80; intent §1–5)? (3) Is any predictive claim backed by evidence? The three are reported separately (intent §8.2).
- **Reference standards.** NHL definitions of SV% (saves ÷ shots against) and GAA (goals against × 60 ÷ minutes); IPP = points ÷ on-ice goals for; Luszczyszyn Game Score (5v5 on-ice terms); GSAx per shot as used by MoneyPuck and Evolving-Hockey (same shot population on both sides); robust z with the 1.4826 MAD constant; the mean and variance of a weighted sum of squared standard normals. No community formula exists for sKO or VuDu, so those are judged on internal soundness and labelling.
- **Fixtures and data.** `web/lib/skoElement/fixtures.ts` (13 fixture players, as-of 2026-10-18) run through `interpretPlayer`; hand-built point series through a verbatim copy of `buildPredictionRecord`; two bounded production reads dated 2026-11-11 (§6).
- **Done when** every entry has a verdict or a "covered by", each defect has reach, fix and test, and the last section can be handed to a fix agent.

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 10 | M-SKO-007, 009, 011, 018, 019, 020, 021; M-VUDU-001, 002, 003 |
| Mis-specified | 10 | M-SKO-004, 005, 006, 008, 010, 012, 014, 015, 023, 026 |
| Wrong | 4 | M-SKO-016, 017, 024, 025 |
| Covered by another audit or entry | 8 | M-SKO-001, 002, 003, 013, 022, 027, 028, 029 |
| Undetermined | 0 | |

**Reach, first.** There is no P0: no page in production shows a number from this family.

- `/sko-element/preview`, `/buy-low-sell-high/preview` and `/trade` return 404 when `NODE_ENV === "production"` (`pages/sko-element/preview.tsx:10-11`). Everything in `lib/skoElement/` runs on fixtures.
- `PredictionsLeaderboard` (the only reader UI for the legacy score) is imported by nothing; `pages/skoCharts.tsx` is a quarantine stub. Traced by import search over `web/`, tests excluded.
- **Two legacy writers are not dormant.** `cron.job` holds `update-predictions-sko` (10:45 daily, active) and `update-sko-stats-full-season` (10:30 daily, active). `predictions_sko` had 761 rows for 2026-11-11 and `sko_skater_stats` ran to 2026-11-10. `/api/v1/ml/get-predictions-sko` has no admin gate, so the legacy score is publicly readable by URL. The packet's "flagged off" status for C44 is not accurate: the reader UI is off, the writer and the read API are on.

**Fit to the owner's definition.** Nothing in the repo computes sKO or VuDu as defined. The Sko Element interpreter is an honest, mostly correct descriptive layer (expected minus observed, with opportunity and IPP context) and labels its own limits. It has no own-player established baseline (decision 34), no usual range (decision 33) and no persistence evidence. VuDu has no live gap, no volume/danger/stopping separation and no goalie adapter. The three legacy "sKO" formulas measure something else (decision 80 keeps them, to be defined and renamed).

### Top 5 findings by user impact

1. **The legacy "stability" multiplier does not measure stability (M-SKO-025, conditional).** Its neutral point is 0.9, not 1.0: a player whose recent variability equals his longer-run variability loses 10%. Any player with at most 10 games and any scoring gets exactly 0.9 (116 of 761 rows on 2026-11-11). Because point counts have variance that rises with the mean, the "stability" input correlates 0.82 with the predicted scoring rate, and the multiplier correlates −0.31 with it: the score taxes production, not volatility.
2. **`stability_cv` is a standard deviation in points per game (M-SKO-024, C44, conditional).** It is written daily and served by the public read API under a name that says coefficient of variation.
3. **Rebound and Cooling are assigned by sign alone (M-SKO-005, dormant).** Any gap above 1e-9 gets a "watch" label. On the fixtures, all 8 labelled skaters at the 10-game window sit within two standard errors of their own recent mean, and 4 within one. Decision 33 requires a sample-size-adjusted usual range first.
4. **Stored IPP can be impossible (M-SKO-017, writer live, readers dormant).** 42 of 10,223 rows from 2026-10-01 to 2026-11-11 have more points than on-ice goals for; 13 store IPP above 100 (max 200) and 29 store null for a player who scored. Null strength components are added as zero.
5. **Unknown power-play time reads as "no opportunity change" (M-SKO-008, dormant).** With PP minutes unknown and total TOI flat, the interpreter says "steady" and then tells the user the hot run "is not explained by an opportunity change". Intent §3.2 makes opportunity central; unknown must stay unknown (rule 5).

## 2. Per-entry table

Paths are under `web/`. Reach: live, cond (writer or API on, no page), dormant, research.

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| M-SKO-001 | covered by sql-cross-cut (Wrong; Astra retains) | — | dormant | zscores view |
| M-SKO-002 | covered by sql-cross-cut (Mis-specified) | — | dormant | scores view |
| M-SKO-003 | covered by sql-cross-cut (Mis-specified) | — | dormant | series RPC |
| M-SKO-004 | Mis-specified (umbrella for 014, 024, 025, 026) | `pages/api/v1/ml/update-predictions-sko.ts` `buildPredictionRecord` | cond | `predictions_sko`, read API |
| M-SKO-005 | Mis-specified (D3) | `lib/skoElement/interpret.ts` `direction`, points-gap text | dormant | preview, `market.ts` lists |
| M-SKO-006 | Mis-specified (D7) | `interpret.ts` `ipp` block | dormant | preview text |
| M-SKO-007 | Sound (inherits D3 direction) | `interpret.ts` `weightedPointsGap` | dormant | `market.ts:32` |
| M-SKO-008 | Mis-specified (D4) | `interpret.ts` `interpretOpportunity` | dormant | preview, BLSH label |
| M-SKO-009 | Sound; `displayScore` is an unvalidated display proposal | `lib/sko/gap.ts` | research (tests only) | none |
| M-SKO-010 | Mis-specified (D8) | `lib/supabase/utils/constants.ts` `STAT_WEIGHTS` | dormant | 012 |
| M-SKO-011 | Sound arithmetic; no caller | `lib/supabase/utils/statistics.ts` `computeConfidenceMultiplierSmooth`, `computeEmpiricalThresholds` | dormant | none |
| M-SKO-012 | Mis-specified (D8) | `statistics.ts` `computeCharacteristicResults` | dormant | test only |
| M-SKO-013 | covered by blsh D6 with Astra R5; Wave 2 open question 2 | `lib/supabase/utils/calculations.ts` | dormant | none |
| M-SKO-014 | Mis-specified (D1) | `buildPredictionRecord`, `fetchPlayerSeries` | cond | `predictions_sko` |
| M-SKO-015 | Mis-specified; `computeLuck` sign mixed (D6) | `lib/trends/utils.ts` `combineSKO`, `computeLuck` | dormant (no caller) | none |
| M-SKO-016 | Wrong (D9); extends sql-cross-cut | `sql/functions/analytics.rpc_sko_player_series.sql:44-61,111-129` | dormant | none |
| M-SKO-017 | Wrong (D5) | `pages/api/v1/db/update-sko-stats.ts` `buildSkoSkaterStatsRow` | cond (writer live) | legacy views, `dataFetching.ts` (test only) |
| M-SKO-018 | Sound; disclosed limit vs decision 34 | `interpret.ts` `personalReference`, `outlook` | dormant | preview |
| M-SKO-019 | Sound; adapter must supply decision 61 season scope | `interpret.ts` `normalizeTeamGames`, `perTeamGameValues` | dormant | gap, BLSH |
| M-SKO-020 | Sound | `interpret.ts` `sampleSd` | dormant | preview |
| M-SKO-021 | Sound; two fail-open guards (D10) | `interpret.ts` `expectedPerTeamGame`, `forecastExpiry` | dormant | gap |
| M-SKO-022 | covered by M-SKO-017 | — | cond | — |
| M-SKO-023 | Mis-specified (D10) | `components/Predictions/MetricCards.tsx:34-37` | dormant (unmounted) | none |
| M-SKO-024 | Wrong (D2) | `buildPredictionRecord`, `stability_cv` | cond | read API |
| M-SKO-025 | Wrong (D1) | `smoothstepMultiplier` and its thresholds | cond | `sko` |
| M-SKO-026 | Mis-specified (D1, D10) | `buildPredictionRecord`; `PredictionsLeaderboard.tsx` row choice | cond / dormant | read API |
| M-SKO-027 | covered by M-SKO-018, 019 | — | dormant | — |
| M-SKO-028 | covered by M-SKO-021, 005 | — | dormant | — |
| M-SKO-029 | covered by M-SKO-020, 018 | — | dormant | — |
| M-VUDU-001 | Sound as a narrow diagnostic; contract gap (Q2) | `lib/sko/gap.ts` `vuduSaveGap` | research (tests only) | none |
| M-VUDU-002 | Sound | `interpret.ts` `goalieResults` | dormant | preview |
| M-VUDU-003 | Sound pass-through; VuDu itself not implemented | `interpret.ts` `interpretGoalie` | dormant | preview |

Checked and found right, worth stating once: pooled SV% and GAA (never a mean of per-game ratios); saves + goals against = shots against enforced; missing exposure returns null, not zero; start share uses team games; lower-is-better orientation flips the sign; the gap is expected minus observed on a per-team-game basis on both sides; rows that became available after as-of are excluded (rule 10); conflicting duplicate rows become unknown; forwards and defensemen have separate IPP references (intent §3.3); FORGE already nulls an incomplete target total (`lib/player-forecasts/gameExpectations.ts:201`).

Two packet leads refuted. (a) "A scoreless 20 games gives multiplier 0.8": the short window is a subset of the long one, so both SDs are 0 and the multiplier is 1.0. (b) "Players without 2021–24 seasons get sigma 0 so every game flags": `mu0` is NULL, the comparisons are NULL and no game flags; such players silently never show hot or cold.

## 3. Defects

### D1 (P1, cond). Legacy points × stability score — M-SKO-004, 014, 025, 026
`sko = (0.6·mean(last 10) + 0.4·mean(last 5)) × horizon × multiplier`, where the multiplier falls from 1.0 to 0.8 as SD(last 10) moves from 0.8× to 1.2× SD(last 20).

- **Neutral point 0.9.** Equal short and long SD gives ratio 0.5, smoothstep 0.5, multiplier 0.9. A perfectly regular alternating 0/1 scorer over 20 games gets 0.9. With 10 or fewer games the two windows are identical, so the result is 0.9 by construction: 116 of 761 rows (15%) on 2026-11-11.
- **It reads level, not volatility.** Fixture: 15 quiet games then 5 hot ones gives 0.832; 15 good games then 5 scoreless gives 0.829. Production sample of 761 rows: corr(pred per game, `stability_cv`) = 0.818, corr(pred per game, multiplier) = −0.313. Intent §3.3 forbids turning "steadier" into "better" through an unexplained volatility penalty.
- **No baseline or shrinkage.** One 2-point game projects 10 points over 5 games with multiplier 1.0. The 120-day lookback means every October series is a handful of games. Decision 34 (pre-window baseline, shrunk to a position prior) is unmet.
- **Horizon.** 5 player games, where the owner chose the next 10 scheduled team games (intent §5.6). A missing `points` value becomes 0 (`points ?? 0`, rule 5). The series query has no game-type filter.
- **Fit to intent.** This is expected short-run points discounted for unsteadiness, not sustainability. Decision 80: keep it, define it, rename it, and blend it into sKO only on out-of-sample evidence.

**Fix.** Do not tune the constants (rule 12). Per decision 80: rename the output (for example "recent points pace, volatility-discounted (legacy v0.3)") in the API and any reader, and document the formula. If the multiplier is retained under its own name, the smallest sound correction is to withhold it (null, not 0.9) when the two windows hold the same games, and to state its neutral point. A production decision on the daily cron is the owner's (Q1).
**Test.** Frozen series through `buildPredictionRecord`: identical short and long windows return a null multiplier; a constant-rate Poisson series at two different rates returns the same multiplier in expectation (level invariance); a missing `points` is not counted as 0. Prove at the read API output (rule 7, 14).

### D2 (P1, cond). `stability_cv` holds an SD — M-SKO-024 (C44)
`stddev()` is a population SD in points per game (`update-predictions-sko.ts` `stddev`, written at `stability_cv`). A CV would divide by the mean. Readers: `get-predictions-sko` select list, `useQuarantinedPredictionsSko.PredictionRow`, `PredictionsLeaderboard`, `PlayerTable`, generated types.
**Fix.** Add a correctly named column (`points_sd_recent`) through a reviewed migration and write both for one version, then move every reader; or, with no migration, rename at the API boundary and label the legacy column in the response. Do not start writing a true CV into the old column: history would silently change meaning (rule 21).
**Test.** Series [0,2,0,2]: SD 1.0, CV 1.0 at mean 1; series [1,3,1,3]: SD 1.0, CV 0.5. The served field named SD must equal 1.0 for both.

### D3 (P1 before any promotion, dormant). Sign-only direction and "watch" wording — M-SKO-005, 007
`direction` uses `EPSILON = 1e-9`; the explanation text prints "Rebound watch" or "Cooling watch" for any nonzero gap, while `gap.ts` `watchLabel` (which needs a threshold) is unused. Fixtures, horizon 10: at the 5, 10 and 20-game windows, 8, 8 and 6 skaters get a direction; 7, 8 and 6 of those are within 2 SE of their own recent mean (5, 4, 3 within 1 SE), before any forecast uncertainty. `market.ts:52-53` builds the rebound and cooling lists from this sign. Same root as blsh D2/D8; Astra R2 applies: equal list sizes are not a correctness test, and a Poisson tail is not valid for weighted fantasy points.
**Fix.** Add a third state ("within usual range") driven by a declared, versioned range rule per target and window size (decision 33), and reserve "watch" for gaps outside it. Until a rule is accepted, show the signed gap with no directional label. Update `direction`, the points-gap text, `weightedPointsGap`, `market.ts` list filters, `SkoElementPreview` and `components/skoElement/format.ts`.
**Test.** Oriented fixtures: a gap of 0.01 with SD 0.8 over 10 games is not a watch; the same gap ranks nowhere in `market.ts`; held-out coverage of the range by player group and window size before the word "usual" is used (rule 11).

### D4 (P2, dormant). Unknown PP time treated as unchanged — M-SKO-008
In `interpretOpportunity`, a null PP change drops out of both `up` and `down`, so a flat TOI yields "steady" and the `conversion-not-role` explanation fires. Line and PP-unit changes (`roleEvidence`) do not enter the classification at all.
**Fix.** If either TOI or PP change is unknown, return "unknown" (or "steady on total TOI; PP unknown") and suppress `conversion-not-role`. **Test.** Fixture with equal TOI and null `ppToiMinutes` in one block: direction is not "steady" and the explanation is absent.

### D5 (P2, writer live, readers dormant). IPP row derivation — M-SKO-017, 022
`totalOnIceGoalsFor` adds ES, PP and SH on-ice goals with each null as 0, then `ipp = points ÷ total × 100`. Sample 2026-10-01 to 2026-11-11, n = 10,223: 42 rows have points above the summed on-ice goals (13 with IPP above 100, 29 null with points above 0); 2,157 rows have at least one null component; 4,701 have null IPP. The cause of the 42 is not established (a goal state outside the three strength columns, or a failed join) and is not guessed here. The scale is percent, where the Sko Element uses a fraction.
**Fix.** Null IPP when any component is null or when points exceed on-ice goals, and record the reason; declare the unit in the column comment (rule 17). Find the missing goal state before trusting any stored IPP. No backfill without approval. **Test.** Row builder: null PP component gives null IPP; points 2 with on-ice goals 1 gives null plus a flag, never 200.

### D6 (P2, dormant). `combineSKO` and `computeLuck` — M-SKO-015
`combineSKO` = clamp(0.45·offense + 0.25·defense + 0.30·on-ice − 0.35·luck) × 100: a league-relative quality score with a luck deduction and assumed weights (decision 32), not an own-baseline measure. `computeLuck` says "higher = more luck" but returns `xg − goals` (positive = unlucky) beside three deltas where positive = lucky. No caller. **Fix.** Decision 80: define and rename; orient all four deltas one way before any use. **Test.** A player with goals above xG and PDO above 1 yields four deltas of one sign.

### D7 (P2, dormant). IPP context — M-SKO-006
Pooled points ÷ pooled on-ice goals is right. Two gaps: no minimum denominator (one on-ice goal gives IPP 0 or 1; the `sparse` flag is not applied to IPP), and the deviation is against a class reference only, with fixture-illustrative values 0.65 and 0.35. Intent §3.3: a repeatably high-IPP player must not read as lucky against the league alone. **Fix.** Withhold or flag IPP below a declared on-ice-goal minimum; add the player's own pre-window IPP beside the class reference; replace fixture references with a versioned pre-window snapshot (decision 68). **Test.** One on-ice goal returns a sparse flag; the own-baseline value excludes window games.

### D8 (P2, dormant). Legacy characteristic-game classifier — M-SKO-010, 012
`T1 = Σw` and `T2 = Σw + 2√(2Σw²)` are the right mean and mean + 2 SD of Σw·z² for independent standard-normal z. The inputs are not that: single-game shooting % and IPP, z capped at ±5, missing values as 0 (`game[stat] ?? 0`; 46% of recent rows have null IPP), SD floored at 1 in raw units. "At or below the mean" is called Highly Characteristic although the distribution is right-skewed. The weights are inverse "ratings" with no source; intent §7 says survey rankings are not weights. **Fix.** None until a decision to revive it; then replace the thresholds with empirical pre-window quantiles (`computeEmpiricalThresholds` exists) and drop missing stats from the sum. **Test.** A game with null IPP equals the same game with IPP omitted.

### D9 (P2, dormant). Streak flags in `rpc_sko_player_series` — M-SKO-016
Settles the lead that sql-cross-cut left unverified. `hot_start` is `hot_flag = 1 AND lag(hot_flag, L−1) = 1`: only the two end games are tested, so flags 1,0,1 with L = 3 "start" a streak. It is also true on every later game of a real streak, so the cumulative `streak_id` increments each game. The baseline seasons (2021–24) are also inside the series being judged (decision 34). **Fix.** Gaps-and-islands: `rn − row_number() over (partition by flag)` for runs, keep runs of length ≥ L. Migration needs approval. **Test.** Flags 1,0,1,1,1,1 with L = 3: exactly one streak (games 3 to 6), with one id; flags 1,0,1 give none.

### D10 (P2). Smaller items
- **M-SKO-021.** A forecast with no parseable `expiresAt` has status "unknown" and is treated as current; `expectedPerTeamGame` does not require `coveredGames === requiredGames` (`lib/tradeValue/valuationComponents.ts:38` does). FORGE nulls incomplete totals today, so this is a guard, not a live error. Fix: withhold the gap on unknown expiry or coverage mismatch.
- **M-SKO-023.** The overall hit rate pools different stats and counts a null `hitRate` as 0 while keeping its samples. Unmounted. Fix when revived: skip null rates.
- **M-SKO-026.** `PredictionsLeaderboard` picks one row per player and date without matching `horizon_games` or `model_version`, so 5- and 10-game totals can share one sparkline. Unmounted.
- **M-SKO-019.** `slice(-k)` has no season boundary; a current-season default with actual n, and a labelled across-season view, are the adapter's job (decision 61). Absences count as 0 in per-team-game means and in the SD, which is right for that basis and shown beside per-appearance values.
- **M-SKO-018.** The prior block is disjoint (no overlap with the window) and its limit is disclosed in `limitations`. It is not the shrunk pre-window baseline of decision 34. Under rule 16 this is incompleteness, not a wrong number.

## 4. Owner questions (not answered by decisions 1–80 or Wave 2 Tier B)

1. **The two daily legacy crons.** `update-predictions-sko` and `update-sko-stats-full-season` still write every day and nothing on the site reads them. Keep running as history for decision 80's evaluation (recommended: keep `update-sko-stats`, pause `update-predictions-sko` until it is renamed and defined), or pause both? Either way no data is deleted.
2. **What does VuDu's expected save probability refer to?** `vuduSaveGap` is right only if both sides cover the same shots. Recommended: the expected save rate on the shots the goalie actually faced in the window (a GSAx-per-100 diagnostic), with FORGE's forward SV% shown separately as outlook. Alternative: forward forecast minus recent, labelled as such.
3. **Public read API.** Should `/api/v1/ml/get-predictions-sko` stay open while the score is quarantined? Recommended: check the request logs for outside callers first (as decision 79 did for `/forge/scoreboard`), then admin-gate it. Alternative: leave it open with the renamed fields.
4. **Interim label before a usual-range rule exists.** Recommended: signed gap only, no Rebound/Cooling word. Alternative: keep the words with a provisional fixed threshold labelled provisional.

Already open elsewhere and not repeated: Game Score definition (Wave 2 Q2), BLSH list naming (Q37–39), and the intent file's §9 design questions (final summary design, scale, headline target, VuDu adapter contract).

## 5. Limits

- Not read: `packets/` originals, `MASTER.md`, `TRIAGE.md`, the sustainability audits. The sustainability "sKO score model v3" (`s_raw`, `s_100`) is not an M-SKO entry and is judged in the sustainability audits, not here.
- M-SKO-001, 002, 003 rest on sql-cross-cut and Astra; only 016 was re-read (repo SQL text; sql-cross-cut reports its hash equals the deployed function).
- The fixture run used `npx tsx` on `lib/skoElement/fixtures.ts`. The `buildPredictionRecord` examples used a verbatim copy of its arithmetic, because importing the route needs Supabase keys. No Vitest suites were run.
- Standard errors in D3 are observed SD ÷ √n on the recent window; they ignore forecast error and non-normal counts, so they understate the noise. They are an alarm, not a proposed rule.
- The correlations in D1 are one date (761 rows); they describe that day, not a population (rule 1).
- Database, read-only, 2026-11-11, `pg_stat_activity` showed 0 other active queries before each read:
  - `select jobname, schedule, active from cron.job where jobname ilike '%sko%'`; `pg_indexes` and `pg_class.reltuples` for the sKO tables.
  - `predictions_sko where as_of_date = (select max(as_of_date) …)`: counts, multiplier buckets (=0.9, ≥0.999999, ≤0.800001), `corr(pred_points_per_game, stability_multiplier)`, `corr(pred_points_per_game, stability_cv)`.
  - `sko_skater_stats where date between '2026-10-01' and '2026-11-11'`: counts of `ipp is null`, `ipp > 100`, `points > coalesce(es,0)+coalesce(pp,0)+coalesce(sh,0)`, any null component, `max(ipp)`, `avg(time_on_ice)` (990, so seconds).
- No NST, NHL or Yahoo calls; no jsonb reads; no writes.

## 6. Final analysis and fix-agent handoff

### Final analysis

**The name outran the metric.** "sKO" labels four things. Under decision 80 and the intent file, the product meaning is the sustainability interpretation that the Sko Element is meant to deliver; the other three are kept, defined and renamed, and may enter sKO only on out-of-sample evidence. None of the four is a finished sKO today.

**The legacy score is the only part still producing numbers.** It runs daily, has no page, and is readable by URL. Its two arithmetic problems are real: a column named CV that holds an SD, and a "stability" multiplier whose neutral value is 0.9, which is constant for short series and which tracks scoring level rather than steadiness. Its design problem is bigger: an unshrunk recent pace multiplied by a horizon is a hot-hand extrapolation, the opposite of a baseline-relative sustainability read.

**The Sko Element interpreter is the sound part.** Its unit handling, pooled goalie ratios, point-in-time filter, unknown-versus-zero handling and expected-minus-observed orientation are right, and its limitations text is candid. What it lacks is what the owner's definition adds: an established own-player baseline (it uses one preceding block), a usual range (it labels by sign), complete opportunity evidence (unknown PP reads as steady; role evidence is display-only), and any persistence evidence. These are incompleteness and labelling issues on a fixture-stage layer, not wrong numbers. Astra's corrections carry over: a retrospective descriptive gap is not refuted by a failed forward test, equal list sizes are not a correctness invariant, the model's unit variance is not calibration, and the inherited "FORGE omits extra-attacker production" claim is withdrawn (the real issue is PK omission and exclusive strength accounting, decisions 24 and 70) and must not be given a copied magnitude here.

**VuDu is a contract, not yet a metric.** The save-gap helper is correct for matched on-net populations and refuses unblocked-attempt expectations, as the owner required. The goalie observed ratios are right. No gap is computed anywhere, there is no volume, danger and stopping split, and the unconditional line of decision 63 has no adapter.

### Recommendations, by priority

1. **P1, lane SKO-LEGACY: rename and correct labels on the legacy score (D1, D2; decision 80).** Files: `web/pages/api/v1/ml/update-predictions-sko.ts` (`buildPredictionRecord`, `stddev`, `smoothstepMultiplier`), `web/pages/api/v1/ml/get-predictions-sko.ts`, `web/lib/hooks/useQuarantinedPredictionsSko.ts`, `web/components/Predictions/{PredictionsLeaderboard,PlayerTable,SkoExplainer,MetricCards}.tsx`, `web/lib/ml/predictionsSkoRunControl.ts` (run key carries the version), `web/lib/predictions/legacyQuarantine.ts`. Write the definition; expose the SD under an SD name; null the multiplier when windows coincide; stop `points ?? 0`. Bump `MODEL_VERSION` so old and new rows never mix (rule 21). Tests: D1 and D2 tests at the read API.
2. **P1 before promotion, lane SKO-ELEMENT: direction and range (D3).** Files: `web/lib/skoElement/interpret.ts` (`direction`, `weightedPointsGap`, explanation text), `web/lib/skoElement/contract.ts` (`GapDirection`), `web/lib/buyLowSellHigh/market.ts`, `web/components/skoElement/{SkoElementPreview.tsx,format.ts}`, `web/components/blshTrade/BlshTradeComparison.tsx`, `web/lib/buyLowSellHigh/trade.ts`. Bump `SKO_CONTRACT_VERSION`.
3. **P2, lane SKO-ELEMENT: opportunity unknowns, IPP minimum and own baseline, expiry and coverage guards (D4, D7, D10).** Same files plus `fixtures.ts` for new cases.
4. **P2, lane SKO-LEGACY: IPP row derivation (D5).** `web/pages/api/v1/db/update-sko-stats.ts` `buildSkoSkaterStatsRow`; find the missing goal state first.
5. **P2, SQL lane (with sql-cross-cut D16): streak islands (D9).** Only if the object is kept in use; otherwise record it as defined-and-dormant.
6. **P2, lane SKO-LEGACY: define and orient `combineSKO`/`computeLuck`; record the classifier as dormant (D6, D8).**

### Directional suggestions (not defects)

- Build the baseline once and share it: a pre-window, shrunk, position-aware reference per target (decisions 34, 61, 68) that the Sko Element, BLSH arm C and sustainability can all read. Fix Astra's A1 (per-track exposure) before reusing arm C.
- Keep three visible components instead of forcing one number early: gap, support (process), opportunity. A summary score should come after held-out tests show what adds information (intent §3.4, §9).
- For VuDu, define the adapter around three separate quantities (workload, shot danger faced, stopping against a matched expectation) and report relief and no-appearance terms explicitly (decision 63).
- Use the owner's horizon everywhere: next 10 scheduled team games, with 5 and 20 as options.
- Evaluate each legacy variant as a candidate feature with proper scores against simple baselines (decision 65), on data not already consumed (decision 39).

### Context for fix agents

- **Decisions that apply.** 32–35 (definition, usual range, pre-window baseline, naming), 61, 68, 63 (goalie unconditional line), 24 and 70 (strength accounting behind the FORGE side of the gap), 65, 80 (keep, define, rename; blend only on evidence), rules 5, 6, 12, 14, 16, 17, 21.
- **Traps.** IPP is percent in `sko_skater_stats` and a fraction in `lib/skoElement`. `time_on_ice` is seconds in `sko_skater_stats`; Sko Element minutes are minutes. `stability_cv` is an SD in points per game. `sko` scales with `horizon_games`. `confirmed_absent` counts as zero only on the per-team-game basis. Lower-is-better targets flip sign (`LOWER_IS_BETTER`). Legacy rows from v0.2 and v0.3 share one table.
- **Do not change.** FORGE values passed through the interpreter; the fail-closed nulls; the `vuduSaveGap` population guard; the production 404 guards on the three preview pages; issued BLSH artifacts and their hashes (Astra R1). Delete nothing (rule 6, decision 80). `web/lib/buyLowSellHigh/**` and `web/scripts/blsh/**` belong to the Codex BLSH lane: coordinate `market.ts` and `trade.ts` edits with it.
- **Needs the owner's approval.** Any column add or rename on `predictions_sko`; any change to the two pg_cron jobs; gating the read API; any backfill of `sko_skater_stats` or `predictions_sko`; the `rpc_sko_player_series` migration; promoting any preview page.
- **Suggested lanes.** SKO-LEGACY (items 1, 4, 6; one agent; touches API routes and legacy components only). SKO-ELEMENT (items 2, 3; one agent; coordinates with the Codex BLSH lane). Item 5 rides with the SQL cleanup lane. VuDu has no fix lane: it needs a design step and Q2 first.
