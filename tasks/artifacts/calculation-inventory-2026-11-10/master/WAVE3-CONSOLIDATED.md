# Wave 3: Fable audits merged with Astra peer reviews

Claude (consolidation session for Chef), 2026-11-11, `octoberBranch` at `c05df316e`. This file is the authoritative reading of Wave 3 for the fix sprint wherever an audit and its review disagree. The original audits and reviews are **not edited**. Nothing here authorizes implementation, production reads or writes, refits, rebuilds, migrations, cron or env changes, or deployment. The new fix-sprint orchestrator ([FIX-SPRINT-ORCHESTRATOR-PROMPT.md](FIX-SPRINT-ORCHESTRATOR-PROMPT.md)) builds the final lanes from [WAVE2-CONSOLIDATED.md](WAVE2-CONSOLIDATED.md) and this file.

## Inputs

| Pass | Fable audit (commit; source baseline) | Astra review (commit) |
|---|---|---|
| W3-1 xG part 2, WiGO, stats helpers | [audits/xg-part2-wigo-helpers.md](audits/xg-part2-wigo-helpers.md) (`859cfb512`) | [w3-xg-wigo-helpers.md](W1-Astra-PR/w3-xg-wigo-helpers.md) (`c05df316e`) |
| W3-2 Player cards, homepage, trade value | [audits/player-cards-trade-value.md](audits/player-cards-trade-value.md) (`961046214`; `aeff5fab7`) | [w3-player-cards-trade-value.md](W1-Astra-PR/w3-player-cards-trade-value.md) (`c05df316e`) |
| W3-3 Misc / other | [audits/misc-other.md](audits/misc-other.md) (`729c5607a`) | [w3-misc-other.md](W1-Astra-PR/w3-misc-other.md) (`c05df316e`) |
| W3-4 FORGE parts 3–4 cross-check | [audits/forge-projections-part3-4-crosscheck.md](audits/forge-projections-part3-4-crosscheck.md) (`46f4d482d`; `859cfb512`) | [w3-forge-projections-part3-4-crosscheck.md](W1-Astra-PR/w3-forge-projections-part3-4-crosscheck.md) (`c05df316e`) |
| W3-5 Season forecasts parts 4–5 cross-check | [audits/player-forecasts-season-part4-5-crosscheck.md](audits/player-forecasts-season-part4-5-crosscheck.md) (`8d95393ba`; `859cfb512`) | [w3-season-part45-crosscheck.md](W1-Astra-PR/w3-season-part45-crosscheck.md) (`c05df316e`) |
| W3-6 Sustainability, rolling, rankings part 2 cross-check | [audits/sus-rolling-rankings-part2-crosscheck.md](audits/sus-rolling-rankings-part2-crosscheck.md) (`2fd0e1052`) | [w3-sus-rolling-rankings-crosscheck.md](W1-Astra-PR/w3-sus-rolling-rankings-crosscheck.md) (`c05df316e`) |
| W3-7 sKO and VuDu | [audits/sko-vudu.md](audits/sko-vudu.md) (`7174249cb`; `2372f694e`) | [w3-sko-vudu.md](W1-Astra-PR/w3-sko-vudu.md) (`c05df316e`) |

Binding context: [RULES-DIGEST.md](RULES-DIGEST.md) (decisions 1–80, rules 1–12), [OWNER-DECISIONS.md](OWNER-DECISIONS.md), [OWNER-INTENT-SKO-VUDU.md](OWNER-INTENT-SKO-VUDU.md) (`c05df316e`; binding for W3-7, §9 lists what it leaves open), and Wave 2's rules 13–21, open questions 1–40 and lanes L1–L15 in [WAVE2-CONSOLIDATED.md](WAVE2-CONSOLIDATED.md) (`f2019af33`).

Astra's evidence (cited, not re-run here): `W1-Astra-PR/w3-xg-wigo-helpers-fixtures.{cjs,json}` and `-tests.log` (146 existing tests passed); the inline harness in `w3-player-cards-trade-value.md` §7 (188 passed); the inline harness in `w3-misc-other.md` §6 (251 passed); `w3-forge-projections-part3-4-crosscheck-fixtures.{test.ts,json,log}` and `-tests.log` (237 passed, plus 8 fixtures through the real goalie stage); `w3-season-part45-peer-fixtures.{cjs,py,json}`; `w3-sus-rolling-rankings-fixtures.{cjs,json}` and `-tests.log` (66 passed); `w3-sko-vudu-fixtures.{cjs,json}`, `-source-manifest.json`, `-existing-tests.log`, `-legacy-tests.log` (172 passed; 32 offline cases, one a JS mirror of SQL, not Postgres).

## How the merge was done, and its limits

- Each audit was read for its summary, per-entry verdicts, defects, owner questions and "Final analysis and fix-agent handoff"; each review for its verdict, corrections, new findings and disposition table. Deep-dive passages were read for conclusions and fixtures.
- **Where Fable and Astra disagree, both views are recorded with their evidence.** Astra's correction wins only where its evidence is stronger: a fixture executed through the actual source function (or the real stage to its persistence payload), a traced call graph or schema file that contradicts a Fable claim, or a mathematical counterexample. Fable's production samples stand as dated samples with their n where Astra did not re-read them (Astra made no database reads in Wave 3).
- **Evidence labels:** *Reproduced* = actual source executed on synthetic inputs (by Astra unless stated). *Source-confirmed* = traced, not executed. *Reported* = a Fable production read on 2026-11-11 (or the stated date), a dated sample, not a population rate (rule 1).
- Fable's verdict tallies are its own classifications; Astra declined to certify them in every review.
- The three cross-check passes (W3-4, W3-5, W3-6) re-describe code Wave 1/2 judged. Their sections record only what they add or correct; everything else is "covered upstream".
- Each pass section ends with a **condensed fix-agent handoff**: Fable's "Final analysis and fix-agent handoff" with Astra's corrections applied. Paths are under `web/` unless shown otherwise; line numbers may have drifted.
- This consolidation made **no database reads, no network calls and no code execution**, and used no sub-agents.

---

## New cross-cutting rules for the fix plan (22 onward)

Rules 1–21 apply unchanged. Each rule below was raised by Astra in two or more Wave 3 reviews.

22. **The sample a label states must be the sample the number used.** Coverage, peer counts, "n games" and "complete" flags describe the exact set left after every filter: a count known for 10 games but TOI for 1 is a 1-game rate, not "10 of 10"; a peer check before per-stat null removal can rank a player alone; a value computed from appeared rows inside a window with an unknown status is a conditional subset. Raised in W3-1 (A3 panel, ratings weight coverage), W3-2 (A2 Player vs Player), W3-3 (D1 silent drops), W3-6 (N3 blended value shown as observed), W3-7 (A2 IPP and opportunity subsets).
23. **A missing value is never filled from a different source, strength, team or game.** No reviving a null NST rate from WGO exposure, no ES goals-for for on-ice GF, no ES TOI for 5v5 TOI, no opponent's timestamp freshening a stale side, and no older game back-filling a window because a newer row failed validation. Return unknown, or a labelled covered subset with its coverage. Raised in W3-1 (A2), W3-2 (A1), W3-6 (N2, N4), W3-7 (A2). Extends rules 5 and 13.
24. **A regression test must fail on the defect and must not encode an unchosen policy.** Reject tests that already pass on broken code ("null equals omitted" when both become 0), that assert a property the model does not imply ("twice baseline must be hot", "wins sum ≤ 1 for arbitrary priors", Poisson rate-invariance of an SD ratio, "score ratio follows games left"), or that hard-code one of several legitimate conventions (multiplicative opponent blend, shortest vs central interval, PP positional rule). Raised in W3-2, W3-4, W3-5, W3-6, W3-7. Extends rules 11 and 15.
25. **Information time and permitted use travel with every value to its last reader.** A forecast issued after the evaluated as-of, a value approved for totals but not comparisons, role evidence effective before but known after as-of, a five-month-old slate shown as "real-time", or a same-day row in a pre-date profile are admission failures, not display details. Carry issuance, knowledge time, cutoff and per-target permissions; never infer them from `fixture=false` or a parseable expiry. Raised in W3-2 (D1, A1), W3-4 (N1 same-day `lte`), W3-5 (PR5 actuals in the allocation base), W3-7 (A1, A3). Extends rule 10.
26. **Combine each quantity by its own algebra.** Counts add; rates and shares pool by their exposure (summing per-team rates, or averaging game percentages, is wrong even when a common factor cancels); a mean of percentiles is not a percentile; quantiles and probabilities of sums or of multi-game horizons need the joint distribution, not marginal endpoints or a horizon scalar. Raised in W3-1 (D4), W3-3 (D1, A2 TOT shares), W3-4 (N6), W3-5 (PR1, saves cross-bounds). Extends decision 28 and rule 13.

---

## Wave 1/2 items that Wave 3 confirms, contradicts or extends

| Earlier item | What Wave 3 adds | Effect |
|---|---|---|
| **W2-P0-1** NST season views include playoffs (decision 69) | WiGO game-log and calendar readers filter by season label only and will not be reached by the view fix (W3-1 D5); Astra: absent NST rows do not occupy a chart slot. | **Extends** (new readers). |
| W2-1 PR-SQL-3 WGO season-only filter | The shared WiGO calendar (`fetchWigoPlayerStats.ts:925-968`) confirmed as a separate reader (W3-1 D5, Astra §3). | **Confirms**. |
| W2-1 PR-SQL-1 / rule 13 count and exposure | WiGO seasonal writer zero-fills, reader revives nulls from WGO exposure (W3-1 A1, A2); player stats page averages game rates (W3-3 D1); Player vs Player per-60 coverage (W3-2 A2); share-card goalie sums (W3-3 A1); legacy TOT shares (W3-3 A2). | **Extends**; rules 22, 23, 26. |
| W1-1 xG items 6 (`isFlurryShot` leak), 9 (model "latest by date"), xg-part1 D8 (gates); decision 7 | Gate does not forbid the leak and accepts an unapplied calibrator (W3-1 D6, C2); explorer model not registry-pinned (D7); rolling xG keeps EN shots (D1); feature-version collisions (A4). | **Extends**. |
| Decision 5 (old champion keeps serving) | The xG Lab defaults to 2025-26, so its mixing and zero-fill defects are visible now (W3-1 C1). | **Corrects** Fable W3-1's "nothing users see today". |
| W2-4 D7 / decision 74 composites are scores | Team drivers print a mean of two percentiles as an ordinal percentile (W3-1 D4: 27th shown vs 15.6 true, fixture); heat map calls a fixed-threshold score a "weighted percentile" (W3-3 D1 extras). | **Extends**. |
| Wave 2 Q11 sample floors; Q20 composite missing inputs | WiGO PP/PK cohorts gate on games only (W3-1 D3, reported 41% of PP cohort < 30 PP min); WiGO ratings renormalise missing weights into full-looking scores (A3: 97.6 on 25 of 100 weight units). | **Extends** both open questions to WiGO. |
| Rule 5 / W2-P0-7 unknown as zero | Projections rank (W3-1 D2), Top Adds (W3-2 D3: incomplete row 54 outranks complete 8.5), fantasy-projection totals and transport readers (W3-5 F6, PR3), share-card goalie line (W3-3 A1), season settlement null bounds (W3-5 PR4), IPP baseline (W3-6 N4). | **Extends**. |
| W1 team-ratings D14 (Top Adds NaN) | NaN from object uncertainty reaches only the legacy FORGE preview and player detail; the rail already extracts it and excludes missing ownership (Astra W3-2). | **Corrects** reach; null-projection zero-fill added on all callers. |
| Decisions 42, 43 (W1 game predictions) | Homepage has no "unavailable" notice now; pick from raw while printing rounded (W3-2 D2). Pulse plots June playoff rows of the placeholder model (D1, reported). | **Extends** (new readers). |
| Decision 44 Poisson chart | Imported at `pages/game/[gameId].tsx:8`, never rendered (W3-3, Astra agrees). | **Confirms**. |
| W2-6 D2 / decision 72 credited goalie record | Share cards print `W-(GP − W)` (W3-3 D2); select owner is `playerSources.ts:107`. | **Extends**. |
| **W2-P0-12** means of game ratios | Same defect class on `/stats/player/[playerId]` per-60 and shares (W3-3 D1, W3-P0-1). | **Extends** (separate root). |
| W1 seconds vs minutes (P0 #9); sustainability-part1 D3 `/api/CareerAverages` | Dormant siblings `/api/Averages` and `/api/ThreeYearAverages`: SOG/60 60× low, TOT rates and shares wrong (W3-3 D3, A2). | **Extends** (dormant). |
| W1-6 007 / D24 horizon scalar | Reserve goalie shutout correctly stays per game; the lineup scalar is the defect (W3-4 N6); Astra: label the single-game basis; bridge reads horizon 1 only. | **Corrects** the W1-6 007 framing. |
| W1-6 D4b spread sign; decision 30 | Market flag "confidence" saturates at 100 on a wrong-way flag (W3-4 N2, dormant). | **Extends**; one contract item. |
| W1-6 028 goalie context tiny; decision 60 | Rest-split term inert on one-game WGO rows; activates on cumulative input; unknown rest → `4_plus` bonus (W3-4 N1). Decision 60 does not authorise deleting the rest path. | **Confirms, extends**. |
| W2-7 D2 (p2 D2) zero-rewarding skill score; decision 65 | Second copy in `fantasy-projections/settlement.ts` (W3-5 F7, 88.9 vs 48.0 reproduced); research goal folds MAE-only (W3-4 N4). | **Extends**; same root as W2-7 D2. |
| W1-8 p1 D4 (C17), D5, 006 (0.65 loading) | TypeScript twins in `evaluator.ts` serve the rows (W3-5 F2); Python vs TS advanced-assist variance already diverges (PR2: 0.175 vs 0.346). | **Extends**; one lane for both languages. |
| W2-8 D11, D12 (p3) band reconciliation | v5 joint bands are re-built from marginal endpoints at event recompute and publication, 1.34× wider (W3-5 PR1). | **Extends**, withdraws Fable's v5 exemption. |
| W1-3 RNK D4 / ROLL D2 rate aliases (W1 P0 #10, W2-P0-11) | Last-N fallback divides a rate by seconds; exported `numerator` is a rate (W3-6 N1, latent). Count paths (points, PP points) must keep the fallback. | **Extends**. |
| W1 SUS D14 (5v5 points gap "may be real") | Structural exposure mismatch; `toi_per_game_5v5` already exists but the band service does not select it (W3-6 N2, Astra). | **Extends, corrects** the fix (no migration). |
| W1 SUS D9 (PDO pinned), A1 (windows expand backward) | PP rate bands carry 2–4% data weight (reported); backward expansion reproduced for PP; L20 PP bands emitted (W3-6 N3). Astra rejects the twice-baseline test again. | **Extends**. |
| W1 SUS D1 hits/blocks 60× fallback | Reported L5 hits `n_eff` 260 vs ≈ 62 expected: still writing. Hits/blocks bands are **not** FORGE band inputs (allowlist: fantasy score, ixG/60, shots/60, 5v5 points/60). | **Confirms**; **corrects** FORGE reach. |
| Decision 37, SUS-059/060 forecast bands | Exact Poisson coverage of nominal 50% band 34.8–90.5% (W3-6 N5). | **Extends** (dormant). |
| W2-1 sql-cross-cut M-SKO-001–003, D16 | `rpc_sko_player_series` streak lead settled: endpoint-only test, ids increment per game; constant baseline flags hot and cold (W3-7 D9, A5). | **Extends**. |
| W2-9 BLSH (Codex), W2 Q37–39 | Trade comparison wording, uneven sides (W3-2 D6); Fable's D7 "same as arm C A1" withdrawn (current headline tracks are complete or null). `market.ts` watchlists have no caller. | **Extends** Codex lane; **corrects** a linkage. |
| W2-9 R5 "FORGE omits extra-attacker production" withdrawn | W3-7 must not copy that magnitude; the 42 impossible-IPP rows have no established cause. | **Confirms the correction**. |
| Decisions 59, 70 strength split | Relabelling ES/PP/PK cannot change `ES+PP+PK`; homepage SOG discrepancies (reported 8 of 112 and 8 of 118 team-games) need a coverage cause, not a label fix (W3-3 D5, Astra). | **Qualifies** what L1/L8 can promise. |
| sql-cross-cut D11 `gameOutcomes` | A team loss is not a goalie's credited loss (W3-3 keeps Astra W2-1). | **Confirms**. |

---

## How each pass section reads

- **Verdict:** the merged reading in one paragraph.
- **A. Fable defects and Astra's disposition:** *confirmed*, *corrected* (wording given), *downgraded*, *withdrawn* or *recategorised*.
- **B. Astra's new findings:** now part of the defect list.
- **C. Rejected or replaced tests** (rules 11, 15, 24).
- **D. Reach:** live, conditional, dormant or research (rule 8), with what was traced.
- **E. Condensed fix-agent handoff:** files and symbols, readers, proof, lane; then production steps and do-not-change items.

---
## W3-1 · xG part 2, WiGO and stats helpers ([audit](audits/xg-part2-wigo-helpers.md), [Astra](W1-Astra-PR/w3-xg-wigo-helpers.md))

M-XG-061–070, M-WIGO-001–015, M-HLP-001–008 (33).

**Verdict.** Main diagnoses accepted with one material reach correction: Fable's "nothing here changes a number users see today" is withdrawn, because the xG Lab page requests `seasonId=20252026` by default (`pages/underlying-stats/xg/index.tsx:213-235`); only the bare API defaults to the empty current season (Astra C1). Astra adds four findings (A1–A4) and withdraws M-WIGO-012 "Sound". Both refuted leads stand: `overall.final` has no reader; `calculateTierThresholds` is live. No P0.

**A. Fable defects and dispositions**

| Fable | Finding | Fable P | Astra disposition |
|---|---|---|---|
| D1 | Player rolling xG = last N games *with an attempt*; `games_count` = rows; EN shots included; no season grouping. Reported: 2025-26, 715 skaters, 45,723 GP vs 38,890 xG rows (14.9% missing). | P1, cond. | **Confirmed; attribution corrected (C3).** Reproduced: 12 games, attempts in 8 → "last 10" = 8 games, ixG 2.0 (dressed last 10: 1.75). The 6,833 absent rows are not proven true zero-attempt games; zero-fill only where participation **and** complete prediction coverage are proven. "Team and goalie windows are fine" too strong. EN goal with no goalie id creates no goalie row. |
| D2 | Projections rank: null as 0, ties by order, mutates input. | P1, live | **Reproduced.** Mutates shared player objects, not the arrays; actual-rank ties inherit projected order. |
| D3 | WiGO PP/PK ratings and percentiles gate on games, not minutes. Reported 2026-11-11: 134 of 330 PP-cohort players < 30 PP min; PK 168 of 332. | P1, live | **Confirmed absent;** the target is kept regardless of GP by design and warned (`calculateWigoRatings.ts:49-52`). Provider GP ≠ proven "games with time at strength". |
| D4 | Team drivers show mean of PP% and PK% percentiles as an ordinal percentile. | P1, live | **Reproduced** on a full 32-team fixture: **27th** shown vs true **15.6**. Keep the 90% coverage rule. |
| D5 | WiGO game-log and calendar readers filter by season label only; decision 69's view fix will not reach them. | P1, live | **Confirmed (query stub).** Absent NST rows do not occupy a chart slot (`WigoComparisonMatrix.tsx:217-232`): reconcile to a game ledger first. 99/67 example inherited. |
| D6 | xG approval gate: 10-goal floors, no base-rate check, `isFlurryShot` allowed, holdout includes calibrator's fit split, benchmark fails open. | P1, release | **Strengthened (C2).** Gate accepts an adoptable calibration *method* without proof it was applied. Reproduced: 140 test rows, 10 goals, constant 0.5 → `isEligible: true`; Brier 0.25 vs base-rate 0.066. Benchmark also passes `{isEligible:false, blockingReasons:[]}` and absent `testExampleCount`. Scoring route has an `allowUnapproved` override; aggregates filter approved rows. "≈ 370 goals" is a validation choice. |
| D7 | xG explorer mixes rolling and season sums; missing → 0; model latest-by-date. | P2, cond. | **Reach → live historical.** Sums are over a globally limited preview; core and created xG pick different latest rows (Jan 10 + Feb 10 shown together). Fix the `(model, feature, season, entity, games, cutoff)` contract. |
| D8 | Offline rebound heads inherit label collision. | P2, research | Retained. |
| D9 | Ratings: one-side "overall" fallback; shrink "hard step" at 10 GP; F/D share cohort. | P2 | **Shrink is continuous** at 10 GP (slope change). Rest retained. |
| D10 | Tier bands overlap; negatives uncovered. | P2, live | **Reproduced** ([5, 5.4, 4.1] → 5.2 in Tiers 1 and 3). Sorting can rename which round a band means: keep or relabel. |
| D11 | Writer: unweighted recent `pp_pct`; IPP across WGO 67 / NST 66 GP; `gp = max`. | P2, live | Confirmed; 67/66 does not prove "small". |
| D12 | DIFF is relative change on percent stats. | P2 | Labelling issue, not arithmetic. |

**B. Astra's new findings**
- **A1 (P1, live writer): seasonal nulls zeroed.** `calculate-wigo-stats.ts:524-541,571-581` `?? 0`: unknown ixG, goals, points over 200 NST min → `std_ixg=0`, `std_g_per_60=0`, `std_pts=0`. STD/LY/3YA/CA share it; the recent builder is guarded.
- **A2 (P1, live reader): null rate revived.** `derivePer60` (`fetchWigoPlayerStats.ts:301-349`) rebuilds a published null `std_ixg_per_60` as **1.5 ixG/60** from WGO minutes.
- **A3 (ratings P1, panel P2).** Panel checks peers before per-stat null removal → rank 1, 50th percentile alone. Ratings divide by available weights: **97.6** All Offense on 25 of 100 weight units, rendered without coverage.
- **A4 (P1, cond. rebuild): feature-version collisions.** Rolling rows group by entity; the flurry map drops version (`aggregates.ts:632-643`): one game under v1/v2 → v2 row "2 games", ixG 0.75, adjusted 1.00.

**C. Rejected or replaced tests.** D1: coverage-aware zero rows only; add version isolation, no-flurry adjusted = raw, order invariance, two seasons. D4: compute the full-cohort rank, do not assert 70. D6: test the applied artifact on untouched games; affirmative eligibility schema; never fit a calibrator on test. D5: separate selected-stat and shared-calendar tests; absent ≠ null row. A2: published null → served null end to end.

**D. Reach.** Live: D2–D5, D10–D12, A1–A3; D7 live historical. Conditional: D1, A4 (rebuild; stored 2025-26 rows; FORGE prior env-gated). Release tooling: D6. Research: D8. Dormant: `overall.final`, `fetchPercentilePlayerData`, `lib/math/utils`, `trackingAlignment.ts`. Production counts are Fable's reads.

**E. Condensed fix-agent handoff**

| # | Fix | Files and symbols | Readers | Proof | Lane |
|---|---|---|---|---|---|
| 1 | Finite-only competition ranks, no mutation | `utils/projectionsRanking.ts` `assignGlobalRanks`, `injectRanks` | `pages/projections/index.tsx`, `hooks/useProcessedProjectionsData.tsx` rank columns | D2 fixtures; unranked last both ways | L13 |
| 2 | Per-strength minutes floor; per-stat finite cohort with size; partial-rating coverage | `utils/calculateWigoRatings.ts`; `components/WiGO/RateStatPercentiles.tsx` | `PlayerRatingsDisplay.tsx`, help text | Full, one missing stat, one missing side, zero | L4b (Q42) |
| 3 | True composite percentile or two drivers | `components/WiGO/teamPerformanceDriverModel.ts` | `TeamPerformanceDrivers.tsx:104` | 32-team fixture | L4b |
| 4 | One game predicate (id, season, type 2) via a game ledger; sanitiser as alarm | `utils/fetchWigoPlayerStats.ts` `fetchPlayerGameLogForStat`, calendar; `utils/fetchWigoPercentiles.ts` | Game-log, PPG, Consistency, TOI, Game Score charts; `gameLogMean.ts` | D5 tests | L4b (after L4a) |
| 5 | Metric-level support at the writer; reader never revives a null | `pages/api/v1/db/calculate-wigo-stats.ts`; `fetchWigoPlayerStats.ts` `derivePer60` | Comparison matrix, DIFF, reference lines | A1/A2 fixtures | L4b (PP share per L8) |
| 6 | Dressed-game windows with proven coverage; season and version partition; EN split | `lib/xg/aggregates.ts` rolling builders, flurry map; `update-nhl-xg-aggregates.ts` | `api/v1/underlying-stats/xg.ts`, `MetricsTimeline`, `homepageGameAnalytics.ts`, `team-context-queries.ts:204` | C fixtures | L14 |
| 7 | One window/cutoff per row; nulls; registry pin | `lib/underlying-stats/xgExplorer.ts`; `api/v1/underlying-stats/xg.ts` | `pages/underlying-stats/xg/index.tsx` | "—" not 0.000 | L2 (L14 pin) |
| 8 | Applied-artifact gate; base-rate proper scores; backward-only features; strict benchmark | `scripts/train-nhl-xg-baseline.ts`; `lib/xg/baselineDataset.ts`; `scripts/benchmark-nhl-xg-baselines.ts`; rebound-heads script | `shotFeaturePersistence.ts`, scoring route | C2 fixture rejected | L14 |
| 9 | D9, D10, D12 | `calculateWigoRatings.ts`; `utils/tierUtils.ts`; `components/WiGO/tableUtils.ts` | Projections chart bands; matrix | Per defect | L4b; L13 (D10) |

Approvals: any xG aggregate rebuild or registry change (decision 5); decision 69 view migration (L4a). Do not change: mid-rank helper, 90% team-driver coverage rule, social shared definitions, MCM.

---

## W3-2 · Player cards, homepage stats and trade value ([audit](audits/player-cards-trade-value.md), [Astra](W1-Astra-PR/w3-player-cards-trade-value.md))

M-CARD-001–035, M-TRD-001–005 (40).

**Verdict.** Useful audit; reach, two defect claims and several fixes need revision. Fable's "no wrong hockey number to a production user today" is **not established**: its own reported SOG check has 8 disagreements in 112 team-games, and Astra reproduces partial-SOG sums and cross-team freshness masking on the enabled homepage reader (A1, withdraws M-CARD-018 "Sound"). Incidence is unmeasured, so no P0. D8's radar claim is withdrawn, D6 narrowed, D7 not established. The M-CARD-019 "less-negative edge" lead stays refuted.

**A. Fable defects and dispositions**

| Fable | Finding | Fable P | Astra disposition |
|---|---|---|---|
| D1 | Homepage pulse: no age limit or model filter; June playoff rows; switches `abs(p − market)` → `abs(p − 0.5)`. Reported: rows 2026-06-14/17, 0 market snapshots. | P1, live | **Retained.** Reproduced with June rows at 2026-11-11. The switch changes an unlabelled series' meaning across states. "Ten placeholder predictions" stays reported (jsonb edges unread). **"Already falls back to visitors" is false:** visitors-only initial render returns `null` (`HomepagePulse.tsx:100-128`). |
| D2 | No decision 42 notice; pick from raw, print rounded (0.504/0.496 → "BOS 50%"); mobile can sum to 101; unlabelled edge. | P1, cond. | **Split:** the missing notice is **live now**; rounding and edge are conditional on admitted predictions. Round one side and complement is defensible; validate [0,1] pairs; update the accessibility label too. |
| D3 | Top Adds: 5-game projection + games-left bonus; unknowns as 0; ownership `?? 0` gives +8. | P1, live | **Three dispositions.** Null projections → scores on **all three callers** (missing ES goals head → score **54**, above a complete 2-pt row's **8.5**); the API (`api/v1/forge/players.ts:377-394`) zero-fills too. Object-uncertainty NaN only on `pages/FORGE.tsx` and `pages/forge/player/[playerId].tsx`; the rail extracts it and excludes missing ownership, so +8 is player-page only. Week mismatch **conditional:** the API returns `blocked` rather than relabel one-game output. |
| D4 | Player vs Player totals over partly observed NST windows. | P2, live | **Reproduced** (3.00 vs 2.88, `higher='a'`); applies to WGO too; 90% is a configurable default. |
| D5 | Goalie leaders: hidden `floor(0.25 × mean GP)` (reported 4 GP); ties sliced; fallback season uses current threshold. | P2, live | **Retained; policy split from error.** Zero floor through mean GP 10; failed standings → 0 silently. Tie slice is deterministic (ID order), not random. Appearance qualifier is a policy. |
| D6 | Uneven trades; "2-for-1 always favours the two-player side". | P2, dormant | **Universal claim withdrawn** (1-for-2: 3 vs 1 + 1 → net −1, "behind"). `compareTrade` already discloses raw production. Real issue: "favours" wording. Codex. |
| D7 | Retrospective rate assumes a full track. | P2, dormant | **Not established:** `sumOrNull` nulls any missing current track ([1,null,3] → null). |
| D8 | Analysis card PP/60 on all-situation TOI; radar mixes units. | P2, dormant | **Radar withdrawn** (eight count axes, disclosed raw scale). PP/60: state the denominator; PP TOI changes the estimand. |

**B. Astra's new findings**
- **A1 (P1, live reader, conditional inputs): partial SOG and freshness masking.** `homepageGameAnalytics.ts:274-285` sums non-null buckets (ES 20, PP null, PK 1 → **21**); the merge keeps the **max** timestamp of both teams, so a June 17 row renders beside a fresh one. xG merge shares the pattern. Not blocked by the missing model.
- **A2 (P1, live share path): per-60 coverage misreported.** `metricSide` reports metric coverage, then narrows to timed games: ten ixG, one TOI → **0.90 ixG/60**, "10 of 10, 0 missing", builder `ready`.

**C. Rejected or replaced tests.** D3: drop "score ratio follows games left"; test the missing-head chain end to end, object uncertainty on both legacy callers, unknown vs 0% ownership, wrong horizon. D5: no shuffle-nondeterminism test. D6: displayed-wording tests, not "net null". D7, D8 radar: none. A1: one-missing-bucket, one-stale-side, version-mismatch matrix on rendered output. A2: same numerator and TOI game ids; no false `ready`.

**D. Reach.** Live: D1, D2 notice, D3 (nulls on all callers), D4, D5, A1, A2. Conditional: D2 rounding, D3 horizon. Dormant: D6–D8 (`/buy-low-sell-high/trade` 404; Studio unrouted).

**E. Condensed fix-agent handoff**

| # | Fix | Files and symbols | Readers | Proof | Lane |
|---|---|---|---|---|---|
| 1 | Per-side bucket completeness, version and freshness | `lib/homepageGameAnalytics.ts` `mergePersistedGameMetrics`; `components/HomePage/homepageGamePresentation.ts` | Desktop, mobile slates | A1 matrix | L16 |
| 2 | Decision 42 notice; displayed-pair helper; "Model vs market" edge; reject incoherent pairs | `homepageGamePresentation.ts`; `HomepageGamesSection.tsx`; `HomepageDesktopGameSlates.tsx`; `analyticsFromPrediction` | `pages/api/v1/games/index.js`; a11y label | 0.504/0.496 tie; no-prediction notice; update `homepageGameAnalytics.test.ts` | L16 |
| 3 | Bounded-age slate, model filter, one series meaning | `lib/homepagePulse.ts`; `HomepagePulse.tsx` | `pages/index.tsx:519`, `api/v1/homepage/pulse.ts` | Stale → `[]`; update `homepagePulse.test.ts` | L16 (Q45) |
| 4 | Typed adapter preserving missingness API → scorer; typed incomplete score | `lib/dashboard/topAddsRanking.ts`; `api/v1/forge/players.ts`; `TopAddsRail.tsx`, `TopAddsWatchlist.tsx`, `pages/FORGE.tsx`, `pages/forge/player/[playerId].tsx` | Four callers | C tests; with team-ratings D14 | L12 |
| 5 | Totals comparability; paired count + TOI coverage through state, highlights, export | `lib/socialShare/modules/playerVsPlayer.ts` | Card renderer, alt text | D4/A2 fixtures | L18 |
| 6 | Displayed-season qualifier, failure state, tie policy | `lib/NHL/statsPageFetch.ts` | `pages/stats/index.tsx`, `StatsPage/MobileTabInterface.tsx` | Tie at fifth; fallback season | L17 (Q46) |
| 7 | "More/fewer projected" wording; "level" at 0 | `lib/buyLowSellHigh/trade.ts`; `BlshTradeComparison.tsx` | — | Wording tests | Codex (Q48) |

No production action. Do not change `CARD_RANK_POLICY`, `currentNhl.ts` fail-closed checks, BLSH 404 gates, `liveData`.

---

## W3-3 · Misc / other ([audit](audits/misc-other.md), [Astra](W1-Astra-PR/w3-misc-other.md))

M-MISC-001–052.

**Verdict.** Retain the two leading live findings: the player stats page averages game rates and shares (now **W3-P0-1**) and share cards print a fabricated goalie loss count. Astra corrects the repair scope (the page merge drops NST TOI; the chart index is a separate reducer), adds missing goalie evidence → COLD badge (withdraws "sound" for parts of M-MISC-013, 043), withdraws Fable's legacy TOT-share exemption and D12's live claim, and qualifies homepage and trends reach. Passing tests (Fable 701, Astra 251) pin current behaviour; they do not endorse it.

**A. Fable defects and dispositions**

| Fable | Finding | Fable P | Astra disposition |
|---|---|---|---|
| D1 | `/stats/player/[playerId]`: season per-60 = mean of game per-60s; shares = mean of game %. Reported 2026-11-11, 8 skaters, 8–20 GP: G/60 0.454 vs pooled 0.408 (+11%), ixG/60 1.486 vs 1.343; CF% off ≤ 1.8 pts. Radar strictly-worse; heat map "weighted percentile". | P1 (meets P0 letter; Chef may promote) | **Reproduced** (3.0 vs 2.0 G/60; 62.5% vs 40% CF%). **Scope corrected:** merge (`[playerId].tsx:923-1022`) keeps neither NST `toi` nor all pairs (HDCF% vs individual `hdcf`, no on-ice HDCA). Do not TOI-weight per-game stats (mean TOI is right). Chart uses `rollingAverage` and `seasonIndexSeries` (index 120 vs pooled 122.2). Missing values are silently dropped. **Radar:** strictly-lower is a recognised convention (Q41); decision 15 is the binding dependency. Heat-map wording stands. |
| D2 | Share-card goalie line `W-(GP − W)`. | P1, live studio | **Reproduced** (3 W, 1 OTL, 1 ND → "3–2"). Select owner is `playerSources.ts:107` `RECENT_GOALIE_COLUMNS`; verify WGO loss-column definitions; never substitute team results. |
| D3 | Legacy `/api/Averages`, `/api/ThreeYearAverages`: SOG/60 60× low; TOT sums rates; unweighted seasons; drops newest season; zero → 0. | P2 (P1 if read) | **Reproduced:** 200 SOG / 1,400.5 min → 0.143 vs 8.57; TOT 1 vs 8. **TOT shares also wrong:** CF share 0.5 vs pooled 0.583. One versioned scale contract (some fields %-points, TOT fractions). Do not call the routes (NST). |
| D4 | Roster height 5'12"; age by 365.25 days. | P2, cond. | Retained; no prevalence. |
| D5 | Homepage SOG strength sum ≠ NHL in 8 of 118 team-games (reported). | P2, live | **Incomplete-support arithmetic** (ES 20 + PP null + PK 1 → 21). A label fix cannot change ES+PP+PK. LIVE games overlay official SOG (`useHomepageGames.ts`). One fix with W3-2 A1. |
| D6 | Pulse switches quantity unlabelled. | P2, live | Reproduced (0.20 vs 0.05). **"Keep it labelled placeholder" rejected** (decision 42). Same fix as W3-2 D1. |
| D7 | Pickup composite: GP counted twice; missing metric shows 0. | P2, live | Retained; renderer also falls back to "0%". Totals vs rates is a scoring choice. |
| D8 | Trends hot/cold overlap; input-order. | P2, live | **Overlap reproduced; source corrected:** already sorted; `delta` is rank places. Fix = exclusive definitions. |
| D9 | "Is downgraded" warning, no downgrade. | P2, live | Copy retained; no universal same-date rule. |
| D10 | Sparkline first-vs-last. | P2 | Verified; tolerance is a policy. |
| D11 | CSV name prefix match. | P2, admin | Real; no wrong import established. |
| D12 | Calendar `getPointsClass` makes every team "poor". | P2 | **Withdrawn:** no caller; visible cells use rank and points %. |

**B. Astra's new findings**
- **A1 (P1, live studio, missing-input dependent): unknown goalie evidence → COLD.** `attachRecent` sums null as 0 (`players.ts:262`): five appearances with null W/saves/SA/GA/QS → "0-5 · — SV% · 0 GA · 0 QS", fantasy score 0, **COLD 0/5 QS**. Independent saves/SA sums can skew SV%. The loader lacks `games_started`, so QS cannot meet decision 40.
- **A2: TOT shares** and **A3: index path** (in the table).

**C. Rejected or replaced tests.** D1: page merge → primitives → summary **and** chart; unequal exposure, missing part, zero opportunity, traded team; update tests asserting averaged rates. D2/A1: select → builder → text, score, streak; unknown QS cannot trigger COLD. D3: two-team unequal-TOI rates **and** shares; field scales; no route calls. D6: drop "labelled placeholder". D10: no arbitrary minimum.

**D. Reach.** Live: D1, D5–D10. Studio: D2, A1. Conditional: D4. Dormant in repo, public: D3. Admin: D11. Withdrawn: D12. Dormant: M-MISC-031 Poisson (never rendered; decision 44), 033. Research: 025, 026. Not maths: `lib/supabase/GoaliePage/updateWeeklyData.ts:16-17` logs the Supabase URL and a key value (route to its owner).

**E. Condensed fix-agent handoff**

| # | Fix | Files and symbols | Readers | Proof | Lane |
|---|---|---|---|---|---|
| 1 | Carry source-matched NST primitives and TOI seconds through the merge; pool per-60 by TOI and shares by their denominators; null on incomplete windows; label or repool the index | `pages/stats/player/[playerId].tsx:783-1022`; `components/PlayerStats/playerStatsContract.ts` `aggregateSummaryStat`, `seasonIndexSeries`; `types.ts` | `PlayerStatsSummary.tsx`, `PlayerSummaryStrip.tsx`, `PlayerContextualStats.tsx`, `PlayerStatsChart.tsx` | Two- and six-game fixtures via the page | **L17** (P0) |
| 2 | Heat-map copy; radar convention per Q41 | `PlayerPerformanceHeatmap.tsx`; `PlayerRadarChart.tsx` `rankAgainst` | — | — | L17; L4b (radar) |
| 3 | Credited W-L-OTL in the select; per-stat completeness; matched saves/SA; unavailable score | `lib/socialShare/playerSources.ts:107`; `players.ts` `attachRecent`; `types.ts:85`; `SocialShare.tsx` `recentLine`; `score.ts`; `streak.ts` | Player tiles, tier rows | Chain tests | L18 (Q49) |
| 4 | ×3600 at count sites; exposure-weighted TOT rates and shares; TOI-weighted seasons; null on zero | `lib/api/averages/statsService.ts`, `helpers.ts`; `pages/api/ThreeYearAverages/[playerId].ts` | External, unknown (Q50) | Fixtures | L19 |
| 5 | Homepage SOG and pulse | as W3-2 1–3 | `useHomepageGames.ts` | — | L16 |
| 6 | D4, D8, D9, D10, D11 | `RosterMatrixWrapper.tsx`; `pages/trends/index.tsx`, `lib/trends/teamPercentiles.ts`; `lib/dashboard/dataFetchers.ts`; `GameGrid/OpportunitySparkline.tsx`; `api/v1/db/upsert-csv.ts` | `/trends`; Game Grid | Per item | L3; L6; L6; L12; L19 |
| 7 | Missing metric "—" in cell and renderer | `PlayerPickupTable.tsx` | Pickup table | Null cell | L12 |

No production action. Do not change Category Counts, disclosed share formulas, `gameOutcomes` (L4a), `/api/CareerAverages` (L7). Delete nothing.

---

## W3-4 · FORGE projections, parts 3–4 cross-check ([audit](audits/forge-projections-part3-4-crosscheck.md), [Astra](W1-Astra-PR/w3-forge-projections-part3-4-crosscheck.md))

M-FRG-121–186 (66 Codex-only records): 37 covered upstream, 24 sound on a fresh read, 5 mis-specified.

**Verdict.** Accepted with qualifications, but not as five model failures. N3 and N4 are reproducible research-contract problems; N1 is a real latent integration hazard needing narrower wording (Astra adds unknown rest → long-rest bonus); N2 is a dormant naming item; N5 is recategorised as an unqualified research choice; N6 is right about direction but does not certify the multi-game contract. **No new live defect, no P0.** All Wave 1 Astra qualifications on W1-6/W1-7 stand.

**A. Fable defects and dispositions**

| Fable | Finding | Fable P | Astra disposition |
|---|---|---|---|
| N1 | Goalie rest-split SV% (M-FRG-130) is called live but fed a one-game WGO row, so it never fires (reported: 319 rows, `games_played` ≤ 1). Latent: raw calendar gap used as rest days (reported cross-tab, 523 appearances); overlaps the fitted −0.003 B2B term; ±.012 clamp on noisy 2-game buckets. | P2, inert | **Retained as P2 latent hazard; wording narrowed.** Real-stage fixture: eligible synthetic profile → raw −.012, lineup saves 26.699 → 26.610, GA 3.001 → 3.090, shutout .0492 → .0451; asymmetric candidates move `team_win_if_starts` .5000 → .4986/.5096. "Never fires for every goalie" stays conditional. **New:** null rest → `"4_plus"` (+.012 raw). "Double count" is an overlap risk; a jointly fitted alternative can be valid. The .018 noise figure is illustrative. Decision 60 does not authorise deleting the rest path. |
| N2 | Flag `confidence_0_to_100 = min(100, 50·abs(edge)/threshold)`; with the spread sign error a wrong-way flag stores 100. | P2, dormant | **Formula confirmed** (+2.3/home/100; sign-fixed −0.7/away/70, a direction check only; decision 30 needs a de-vigged cover probability). No reader shows it as a probability; it is a scaled clipped ratio, so a literal rename creates a new unit error. One item, not two. |
| N3 | Research `projectContext`: team `shotVolume` moves goals, not assists. | P2, research | **Strengthened:** the validator admits it only as team-owned (×1.03 → goals .206, assists .5). |
| N4 | Research goal folds scored by MAE only. | P2, research | **Retained for the goal mean** (an appearance Brier exists). Poisson(0.2): forecast 0 MAE .2 vs mean .327; squared error prefers the mean. |
| N5 | Opponent blend 0.5/0.5, no league reference (3.5 vs 4.08). | P2, research | **Recategorised:** linear pool is legitimate and labelled; additive gives 4.0. Compare fitted forms before promotion. |
| N6 | Reserve shutout correctly per game; lineup scalar is the defect (corrects W1-6 007). | — | **Directionally right:** p .05, scalar 5 → .05. Label the single-game basis; bridge reads horizon 1, so no reachable multi-game failure. M-FRG-163 is the skater builder. |

**B. Astra's new findings.** Null rest → `4_plus` (in N1). Otherwise the grouped table preserves upstream dispositions; private helper name matches are not consumers (rule 18).

**C. Rejected or replaced tests.** N1: final-payload test (lineup and reserve) plus asymmetric-candidate win check, a pinned provider rest-day receipt, a null-rest case; held-out vs legacy and no-rest (decision 60), not "exclude B2B" as the only model. N2: drop "not presented as 50% confident". N5: no test asserting 4.08. N4: paired squared error or deviance; MAE secondary.

**D. Reach.** Conditional: N1 (inert on one-game rows). Dormant: N2. Research: N3–N5. N6: no reader failure. `lib/forge-v2/*` disabled.

**E. Condensed fix-agent handoff**

| # | Fix | Files and symbols | Readers | Proof | Lane |
|---|---|---|---|---|---|
| 1 | Guard N1 against accidental activation now; later a qualified replacement (pooled saves/shots per bucket over credited starts before the date, gap − 1 pinned to a receipt, null rest unknown, joint fit with B2B) | `lib/projections/calculators/goalie-save-pct-context.ts`; `queries/goalie-queries.ts:174-250`; `stages/goalie-stage.ts:531-544` | Goalie row SV%, GA, SO, `team_win_if_starts`, `rest_split`; reserve `modeled_save_pct` | Final-payload fixtures | L9b (after W1-5 credited starts) |
| 2 | Name the stored quantity honestly or retire it with the market fixes | `lib/projections/utils/market-output-builders.ts:77-90,590`; `run-forge-projections.ts:1070-1116` | None in app | Direction fixture | L9a (decision 30) |
| 3 | N3–N5 before any promotion | `research/skater-candidates/context.ts`; `researchGameGoals.ts` | — | As above | L9a backlog |
| 4 | Lineup-only horizon fix; label reserve basis | `lib/projections/reserveProjections.ts:143-158` | RSO bridge | p .05 fixture | L9b |

Approvals: `confidence_0_to_100` rename or drop; WGO goalie ingest shape; odds ingestion (decision 30).

---

## W3-5 · Player forecasts, season parts 4–5 cross-check ([audit](audits/player-forecasts-season-part4-5-crosscheck.md), [Astra](W1-Astra-PR/w3-season-part45-crosscheck.md))

M-PFC-181–264 (84 records: 67 forecast heads, 17 functions): 48 covered, 20 covered but missing a TypeScript twin or reader, 12 new mis-specified, 1 new wrong (a second copy), 3 sound. None resolves to SQL.

**Verdict.** Keep goalie pace, the duplicate improper skill score, missing totals and the twin inventory. Repair the handoff first (Astra): v5 bands **are** widened at publication (Fable's exemption withdrawn); Python and TypeScript advanced-assist variances already diverge; null handling is broken in the transport readers too; F7's log-loss claim is wrong, while invalid probabilities, null interval bounds and the adjustment allocation base are new defects. All **dormant**: Fable reports 0 rows in the release, artifact and catalog tables (2026-11-11), and the page needs an active release. "P1" = blocker before importing a season release or claiming its accuracy.

**A. Fable defects and dispositions**

| Fable | Finding | Fable P | Astra disposition |
|---|---|---|---|
| F1 | Goalie W/L/OTL/SO/QS take `contextual × pace × venue` (`evaluator.ts:352`; `season.py:4090-4138`). | P1 | **Reproduced in both languages:** pace 1.2 → two complementary .5 wins become .6 each; W/L/OTL .5/.3/.2 → .6/.36/.24. Removing pace is necessary, not sufficient: "wins sum ≤ 1" does not follow for arbitrary priors; ±35% bound is the producer's clip, not an evaluator guarantee. |
| F2 | Upstream fixes name Python only; TS twins serve rows: C17 `max(rate, residual80²)`, unknown → 0, independent games, 0.65 loading. | P1 | **Confirmed** (base-goalie parity holds). **Added:** advanced-assist variance Python **0.175** vs TS **0.346** on identical endpoints (Python rebuilds it from a zero-clipped interval, `advanced.py:1982-2006`). |
| F3 | Descriptions wrong; conditional variance scaled by m (SD 9% low). | P2 | Descriptions confirmed. **m² rule narrowed** (exact only for mY). **Added:** missing-variance fallback multiplies by m twice in both languages (1.44 vs 1.2). |
| F4 | Bands of sums = sums of bands; 1.73×/1.28× too wide; v5 unaffected. | P2 | **v5 exemption withdrawn (PR1, now P1 before band claims):** event recompute, `addActuals` and publication with **no overrides** (`admin.ts:370-412`) rebuild from marginal endpoints: published POINTS width **1.34×** the simulated v5 width. Ratios hold only for unclamped equal-variance sums; **saves are SA-low − GA-high**, not a sum. |
| F5 | Fitted EV heads overwritten by total − others. | P2 | **Conditional on all twelve strength keys;** EV variance stays in metadata while endpoints are rebuilt. |
| F6 | `fantasyProjectionTotal` `?? 0`. | P1 | **Expanded (PR3):** faceoffs are v3 primitives (TAKEAWAYS is the right example); `admin.ts:72-77`, `queries.ts:33-43,303` and `expandFantasyProjectionSummary` turn null and absent into 0 before the total (round trip `{TAKEAWAYS:null}` → 0). |
| F7 | Second zero-rewarding skill score (`fantasy-projections/settlement.ts:13-19`); absolute error on probabilities; allocation by expected GP (1.37×); probabilities unbounded before log loss. | P1 | **Score reproduced** (88.9 vs 48.0). **Log-loss claim withdrawn** (clipped); the defect is accepting 1.2 at all. **Added:** null bounds → `finite(null)=0` → a perfect [0,0] interval; allocation base includes actuals (10 actual + 10 future, delta 4 → 2 allocated); published scores reuse model bounds. Inclusive discrete coverage is not a bug. |
| F8 | Newcomer prior: cohort medians, p25 play, ×2.25, fixed role odds shown. | P2 | Arithmetic confirmed (median 0 vs mean .012); role odds shown at `confidence=0`. A cohort mean is not validated either: label as heuristic. |
| F9 | Team "lines" are an ice-time sort; no PP positional rule. | P2 | Sort confirmed; **positional-rule claim withdrawn.** Relabel. |
| F10 | Roster-observation receipts keep the frozen-window label. | P2, cond. | Confirmed; fix the successor only (rule 21). |

**B. Astra's new findings.** PR1 joint quantiles lost at publication; PR2 variance divergence and double-m fallback; PR3 transport-reader nulls; PR4 invalid probabilities and null bounds; PR5 allocation over actuals (all in the table).

**C. Rejected or replaced tests.** F1: coherence across complementary priors, all candidates, start/relief/appearance bases and no-decision mass, not "sum ≤ 1". F2: parity on means **and variances** incl. clipped aliases and missing moments. F4: no-override release round-trip, plus actuals, editor, saves, EV. F6: TAKEAWAYS, full and compact round trips, zero-weight absence. F7: reject probability 1.2; null/absent/reversed bounds; allocation conservation on current view with actuals. F8: no ".012 is correct" test. F9: no positional test.

**D. Reach.** Dormant: F1–F9, PR1–PR5. Conditional: F10. Research: M-PFC-260, 261 (sound helpers to copy).

**E. Condensed fix-agent handoff** (TS and Python together; regenerate golden vectors)

| # | Fix | Files and symbols | Readers | Proof | Lane |
|---|---|---|---|---|---|
| 1 | One proper aggregated skill score for both settlement modules; reject invalid probabilities; null bounds unavailable; bump scoring version | `lib/fantasy-projections/settlement.ts`; `lib/player-forecasts/settlement.ts:171-180` | `scripts/import-player-forecast-season-settlement.ts` | PR4 tests | L10 |
| 2 | Allocation over the remaining-model manifest at issuance | importer `:319-339` | Settlement rows | PR5 tests | L10 |
| 3 | Joint quantiles through publication | `lib/fantasy-projections/admin.ts:370-412` | `queries.ts:362-365`; `pages/fantasy-projections.tsx` | Round trip | L10 |
| 4 | Nullable values in readers | `admin.ts:72-77`; `queries.ts`; page table, sort, compare, intervals | — | PR3 | L10 (after L15) |
| 5 | Goalie outcome heads without pace inside a coherent versioned treatment | `evaluator.ts` `targetMultiplier`; `season.py` `_target_multiplier` | Game outputs | Coherence matrix | L15 (Q52) |
| 6 | Explicit moments; alias variance; double-m; C17; unknown → 0; loading; independent games; joint event recompute | `evaluator.ts`; `contracts.ts` `reconcileProjectionQuantiles`, `fantasyProjectionTotal`, `expandFantasyProjectionSummary`; `seasonJobs.ts:392-405,977-996`; `advanced.py:1982-2015`; `season.py:4381-4385` | `seasonJobs.ts` writers | Moment parity | L15 |
| 7 | EV derive-or-use with clamp telemetry | `contracts.ts` `reconcileStrengthFamily`; Python `_reconcile` | Artifact policies | PR6 | L15 |
| 8 | Newcomer prior, role odds, team lines labels | `seasonJobs.ts` `buildRuntimeNewcomerPrior`, `teamDeployment`; page `:828,1651,1721-1727` | Page | F8/F9 | L15 (seasonJobs) + L10 (page) (Q53, Q54) |
| 9 | Successor receipt limitations | `lib/player-forecasts/modeledGoalieParticipation.ts` | Native pipeline | F10 | L10 |

Do not change in place: contract versions and checksums, scoring version (bump), native method strings, issued receipts; delete no EV heads or newcomer path. Approvals: importing an artifact or release; settlement reruns; evaluation-column migrations.

---

## W3-6 · Sustainability, rolling and rankings part 2 cross-check ([audit](audits/sus-rolling-rankings-part2-crosscheck.md), [Astra](W1-Astra-PR/w3-sus-rolling-rankings-crosscheck.md))

M-SUS-061–075, M-ROLL-061–075, M-RNK-061–065 (35 records): 27 covered, 8 covered with a new or corrected point.

**Verdict.** Unit, exposure, baseline and label findings accepted; fixes and some reach claims revised. Astra: a per-game 5v5 TOI field already exists (N2 needs no migration; "relabel ES" rejected); N3's mandatory-hot test is invalid; the IPP fallback (N4) shows an impossible value as **hot** and "0 of 268 above 1" does not prove it idle; N1's repair must spare real count paths; hits/blocks bands are **not** FORGE inputs. No P0.

**A. Fable points and dispositions**

| Fable | Finding | Fable P | Astra disposition |
|---|---|---|---|
| N1 | Last-N fallback divides `<metric>_per_60_total_lastN` (a rate) by seconds; rate exported as `numerator` (8.406 → 4.417). | P2, latent | **Reproduced** (8.4 / 6,852 s → 4.413). Populated raw values take precedence, so no live corruption shown; "stored rows cannot reach it" is a current-writer invariant. **Keep the fallback for count specs** (3 pts / 6,852 s → 1.576; 1 PPP / 120 s → 30). |
| N2 | 5v5 Points/60: sample over ES TOI, baseline over 5v5 TOI. Reported, one player, four seasons: ES/5v5 = 1.08–1.14. Fix: new column or relabel ES. | P2 (P1 after hot/cold repair) | **Mismatch reproduced** (3.6 vs 3.0, −16.7%). **`toi_per_game_5v5` exists** (WGO ingest, baseline schema, types, rolling writer); `bandService.ts:103-133` just omits it. ES-on-both keeps a 5v5 numerator: rejected. Four ratios are direction, not a decomposition of D14's 12%. |
| N3 | PP Goals/Points bands carry 2–4% data weight (prior 180 PP min). Reported snapshot of 259: n_eff 4.35/6.45 min; 123 and 89 zero baselines. Test: twice baseline must not be neutral. | P1 | **Shrinkage confirmed, in the right unit.** Fixture: EWMA 15 vs 7.5 → value 8.12, neutral. **Test rejected:** Poisson mean 2.5 over 20 PP min, 5 observed sits inside the central 80% [1, 5] (P(X ≥ 5) = .109). The defect is **showing the blended value as the observed comparison.** L20 PP bands are emitted (weight 15.5%), so "no window passes ~12%" is wrong. |
| N4 | IPP baseline falls back to ES GF (48/35 → 1.37, beta −18); "0 of 268 > 1, not firing". | P2, cond. | **Worse:** beta floored to 1e-6, value 1.243, Sandbox says **hot**. "Not firing" withdrawn (in-domain fallback 0.5 is invisible). Dropping ES GF alone fails: successes and trials are summed separately (baseline 2.5). |
| N5 | Forecast bands mean ± z·σ; 50% band covers 35–74%. | P2, dormant | **Reproduced** 34.8–90.5% (headline omitted 90%); "median" is the mean. Pick central vs shortest interval before testing (mean 0.7: [0,2] vs [0,1]). |
| N6 | "Fantasy Score" unlabelled FHFH default. | P2 | Stands; also Sandbox text and FORGE metadata (fantasy score **is** a FORGE input). |
| Reach | Hits/blocks bands feed FORGE. | — | **Withdrawn:** allowlist = fantasy_score, ixg_per_60, shots_per_60, points_per_60_5v5. `trend-bands.ts` GET with recompute writes: not a read check. |
| — | Decision 13 for NST penalty counts. | — | Undetermined (needs a saved NST reference). |

**B. Astra's new findings.** IPP shape flooring and split sums; L20 PP bands emitted; unused 5v5 field (in the table).

**C. Rejected or replaced tests.** N3: verify observed counts, exposure and rate apart from the shrunk value; classification tests use a frozen distribution and interval rule, with one unsurprising doubled case and one extreme case. N2: constant per-5v5-minute rate gives equal observed and baseline; extra non-5v5 ES minutes change nothing. N1: count-path fixtures stay green. N4: invalid, in-domain, both-null, mixed seasons at the saved band. N5: choose the convention first.

**D. Reach.** Live: N2, N3, N6 (Sandbox; FORGE metadata). Conditional: N4, N1. Dormant: N5; HDCF%, 5v5 SH%, PP SH% specs. Reported: the 259-player snapshot; a rolling row stuck at 2026-11-05 (held runs); L5 hits `n_eff` 260 vs ≈ 62 (SUS D1 still writing).

**E. Condensed fix-agent handoff**

| # | Fix | Files and symbols | Readers | Proof | Lane |
|---|---|---|---|---|---|
| 1 | Band redesign per metric (decision 33): fixed membership, matched exposure, pre-window baselines; observed window stored apart from the shrunk value; spec default windows only | `lib/sustainability/bands.ts`, `bandCalculator.ts`, `bandService.ts:24` | `api/v1/sustainability/trend-bands.ts`, `entity-bands.ts`, `entitySurfaceServer.ts`, `pages/trendsSandbox.tsx`; FORGE `skater-queries.ts`, `trend-adjustments.ts` | C tests at the API | L7 (+L9a validation) |
| 2 | Select `toi_per_game_5v5`; pair with same-game 5v5 points | `bandService.ts` `fetchPlayerGameRows`; `bandCalculator.ts` | Same | Identity fixture | L7 |
| 3 | Matched points/GF pairs, domain check, no shape floor as validation | `bandCalculator.ts:147-164,442-449`; `bands.ts:309-317` | Sandbox, API | N4 tests | L7 |
| 4 | Rate-alias specs never expose a rate as a count | `lib/rankings/skaterWindowAggregation.ts:89-104,495-503`; `rollingRankingSelectFields.ts` | `rankingQueries.ts`, `deploymentTiers.ts`, `rankingCalculator.ts`, `resultsLuck*` | N1 fixtures | L5 + L6 |
| 5 | Exact discrete intervals; null at zero samples | `lib/sustainability/features.ts` | `model.ts` (unserved) | N5 | L7 (decision 37) |
| 6 | "Fantasy Score (FHFH default)" | `bands.ts:247-255`; `trendsSandbox.tsx:2349,2848` | FORGE metadata | Label | L7 |

Approvals: band history rebuild (decision 36); rolling rebuild or backfill; held-run reconciliation. Do not change: exclusive percentile in `rankingCalculator.ts`, MCM/BEAST, NST xG, player-PP-time denominator.

---

## W3-7 · sKO and VuDu ([audit](audits/sko-vudu.md), [Astra](W1-Astra-PR/w3-sko-vudu.md); binding intent [OWNER-INTENT-SKO-VUDU.md](OWNER-INTENT-SKO-VUDU.md))

M-SKO-001–029, M-VUDU-001–003 (32): Fable 10 sound, 10 mis-specified, 4 wrong, 8 covered.

**Verdict.** Central conclusion kept: **no implementation is a completed, validated sKO or VuDu** as the owner defines them (intent §1–5; decisions 32–35, 61, 68, 80). The Sko Element interpreter's units, pooled goalie ratios and unknown-vs-zero handling are sound; the legacy score has real integrity defects; most of the product is unfinished design. Do not implement Fable's handoff unchanged. Astra adds a **forecast-admission defect** (A1), window-membership and opportunity defects (A2, A3), a legacy transform mismatch (A4) and SQL streak cases (A5); corrects the legacy multiplier claim (R1), the usual-range remedy (R2) and VuDu's sign (R4). No P0: Sko pages are 404 in production.

**Reach and lineage (Astra §1).** Paths sharing the name are separate:
- **Legacy score** (`update-predictions-sko.ts` → `predictions_sko` → unauthenticated `get-predictions-sko.ts` → quarantined hook, unmounted leaderboard): conditional. Fable reports pg_cron `update-predictions-sko` (10:45) active and 761 rows on 2026-11-11. The API already emits `compatibility_model_not_promoted`; the hook drops it.
- **Ancillary stats** (`buildSkoSkaterStatsRow` → `sko_skater_stats`): writer live (reported `update-sko-stats-full-season`, 10:30), readers dormant.
- **SQL analytics sKO** (`vw_sko_skater_base` → `rpc_sko_player_series`): reads WGO/NST, not `sko_skater_stats`; no caller.
- **Sko Element** (`fixtures.ts` → `interpretPlayer`): fixtures only; `/sko-element/preview` and **`/buy-low-sell-high/trade`** 404. `market.ts` `buildWatchlists` has **no caller**.
- **VuDu:** `vuduSaveGap` tests only; gap always `pending_goalie_adapter`. `combineSKO`/`computeLuck`: no caller.
- **Sustainability "sKO v3"** (`lib/sustainability/score.ts`) is **live in the Sandbox**, outside this packet (sustainability lanes own it). "No page shows a number from this family" holds only for the packet's paths.

**A. Fable defects and dispositions**

| Fable | Finding | Fable P | Astra disposition |
|---|---|---|---|
| D1 | Legacy `sko = (0.6·L10 + 0.4·L5) × horizon × multiplier`: neutral 0.9; ≤ 10 games → 0.9 (reported 116/761); "taxes production" (reported corr .818 / −.313); unshrunk pace; 5 player games; `points ?? 0`. | P1, cond. | **Partly corrected (R1); M-SKO-025 "wrong" → mis-specified interpretation.** The ratio is invariant to adding or multiplying every game by a constant (alternating 0/1 → .9; +5 → .9; ×3 → .9), so "taxes production" is not shown; one day's correlations cannot separate level, variance and window overlap. Zero-SD windows give **1.0**, not .9. "Neutral must be 1" is a policy, not a theorem. Retained: `points ?? 0`, no game-type filter, unshrunk pace, appearance horizon. Decision 80: rename and define; do not rewrite history. |
| D2 | `stability_cv` is a population SD. | P1, cond. | **Confirmed** ([0,2,0,2], [1,3,1,3]: SD 1, CV 1 vs .5). Keep version semantics; fix the hook's model filters too. |
| D3 | Rebound/Cooling by sign; fix with a usual-range gate. | P1 before promotion | **Interim agreed, remedy corrected (R2).** The gap is **forecast − recent**; its sign is right. Three comparisons stay separate: recent vs pre-window own baseline (decision 33), observed vs same-window support, forecast vs recent. `Var(F−R)` includes −2Cov, so "ignoring forecast error understates noise" is false. |
| D4 | Unknown PP reads "steady". | P2, dormant | Confirmed; broadened by A3. |
| D5 | Stored IPP adds null components as 0. Reported 2026-10-01..11-11, n = 10,223: 42 rows points > on-ice GF (13 IPP > 100). | P2, writer live | **Reproduced;** cause of the 42 not established (do not blame extra-attacker omission). Review manual `fetchSKO*.js`. |
| D6 | `combineSKO` league-relative; `computeLuck` mixed signs. | P2, dormant | Confirmed, unwired. "Four deltas one sign" test rejected. |
| D7 | IPP context: no minimum denominator. | P2, dormant | Retained (one on-ice goal → IPP 1, `sparse=false`); no universal minimum; carry exposure and a versioned reference. |
| D8 | Legacy classifier; "SD floored at 1". | P2, dormant | **Corrected:** positive SD not floored (`[0,1]` → .5). Fable's "null equals omitted IPP" test passes on broken code. |
| D9 | `rpc_sko_player_series` streaks test only end games. | P2, dormant | Confirmed; A5 extends. |
| D10 | Fail-open expiry and coverage guards; null hit rates; mixed horizons. | P2 | Retained; A1 supersedes the expiry item; a labelled micro-average is fine. |
| VuDu | `vuduSaveGap` right for matched shots; no gap, no workload/danger/stopping split. Q2: "a GSAx-per-100 diagnostic". | — | **Sign corrected (R4):** `100·(expSV − obsSV) = −100·GSAx/SA` (obs 95/100 vs .90 → −5; GSAx +5). Residual and forward outlook are two labelled fields. Observed ratios confirmed (SV .8788, GAA 3.4286). Skater `expectedPerAppearanceConditional` is a mean of if-play forecasts (5.5 vs Σpμ/Σp 1.9): label it. |

**B. Astra's new findings**
- **A1 (P1 before non-fixture use): forecast time, permission and completeness are lost.** A forecast issued after as-of → gap −0.15, `current`, `qualified`; POINTS without expiry still qualified; a value approved for totals but not comparisons → `compareTrade` **complete, not experimental**. `forecastTotals` strips provenance; `tradeValue/valuationComponents.ts` shows the stricter checks.
- **A2 (P1 before adapter promotion): validation changes window membership.** Malformed `availableAt` drops the newest game and backfills (Oct 5–14 → Oct 4–13; 0.9 → 0.8, "zero unknown"); `2026-99-99` accepted. IPP and opportunity use appeared rows while points withhold.
- **A3 (P1 before persistence claims): opportunity over-read.** 10 → 5 appearances at fixed minutes = "steady" though minutes per team game fall 18 → 9; one 38-minute game → "rising" over "10 appearances". `roleEvidence` lacks `knownAt`.
- **A4 (P2, dormant):** PA/SA maps primary-only to ∞ in the baseline and 10 in the game: six identical games → five `Uncharacteristic`.
- **A5 (P2, dormant, JS mirror of SQL):** flags 1,0,1,1,1,1,0 → invented starts and ids on non-hot games; σ0 = 0 with a baseline flags one game hot and cold.

**C. Rejected or replaced tests.** D1: Poisson rate-invariance rejected (expectation depends on rate for n ≤ 10); use affine invariance, bounds, zero history, SD labels. D3: no SD/√n, Poisson tail or equal-list oracles. D6, D8 as above. D9: L = 1–3, interrupted runs, zero MAD. A1–A3: future-issued, revoked-comparison, incomplete, observation-only cases; exact window game ids; 10 → 5 appearances.

**D. Reach.** Conditional: D1, D2, D5. Dormant: D3, D4, D6–D10, A1–A5. Live outside the packet: sustainability "sKO v3".

**E. Condensed fix-agent handoff** (Stage 1 deterministic contracts only; Astra's Stage 2 inputs and Stage 3 validation are design and research)

| # | Fix | Files and symbols | Readers | Proof | Lane |
|---|---|---|---|---|---|
| 1 | Define and rename the legacy construct; SD under an SD name (API alias first); unknown points stay unknown; select model + horizon; propagate warnings; version changes | `pages/api/v1/ml/{update,get}-predictions-sko.ts`; `lib/hooks/useQuarantinedPredictionsSko.ts`; `components/Predictions/**`; `lib/ml/predictionsSkoRunControl.ts` | API, hook, leaderboard | D2, R1 tests | L20 |
| 2 | Null IPP on any null part or points > GF, with reason; find the missing goal state | `pages/api/v1/db/update-sko-stats.ts` | Legacy views | Row-builder tests | L20 |
| 3 | One PA/SA transform; mask-qualified thresholds; null hit rates stay null | `lib/supabase/utils/statistics.ts`; `MetricCards.tsx` | Dormant | A4 | L20 (if kept in use) |
| 4 | Source admission; target-level clock, permission, coverage carried to every comparison; identity-complete window skeleton | `lib/skoElement/{contract,interpret,fixtures}.ts` | `lib/buyLowSellHigh/trade.ts`, `market.ts`, `components/blshTrade/**` (Codex) | A1/A2 tests | L21 + Codex |
| 5 | Signed gap without "watch" words; three named comparisons; opportunity unknown states; rename `observedDuration`; bump contract version | `interpret.ts`; `contract.ts`; `components/skoElement/**` | Preview | A3 tests | L21 (Q55) |
| 6 | Streak runs only after baseline, scale and onset are defined | `sql/functions/analytics.rpc_sko_player_series.sql` | None | Postgres tests | L4a (if kept) |
| 7 | Define and orient `combineSKO`/`computeLuck` | `lib/trends/utils.ts` | None | Per-component signs | L6 |
| — | VuDu | — | — | — | No lane until Q56 |

Approvals: `predictions_sko` columns; either pg_cron job; gating the read API; any sKO backfill; the RPC migration; promoting a preview page. Astra: cron and API choices need consumer, use and cost evidence. Do not change FORGE pass-through values, fail-closed nulls, the `vuduSaveGap` guard, 404 guards, issued BLSH artifacts. Delete nothing.

---

## Cross-packet defect map (Wave 3)

One owner per defect; each reader gets its own selection test (rule 4). "Earlier link" names the Wave 1 row ([BATCH-BC-CONSOLIDATED.md](BATCH-BC-CONSOLIDATED.md)) or Wave 2 row ([WAVE2-CONSOLIDATED.md](WAVE2-CONSOLIDATED.md)) that shares code, readers or root.

| Defect | Owner | Readers | Earlier link | Decision / rule |
|---|---|---|---|---|
| Per-game mean of rates and shares on the player stats page; merge drops NST TOI | W3-3 D1 | Summary, strip, contextual stats, chart index | W2-P0-12 (same class) | 13, 26 |
| Count/exposure support lost or revived in WiGO | W3-1 A1, A2, D11 | Comparison matrix, DIFF, chart reference lines | W2-1 PR-SQL-1 | 5, 13, 23 |
| Season-label-only game selection | W3-1 D5 | WiGO game-log charts, game mean, calendar, percentile GP sanitiser | W2-P0-1, PR-SQL-3 | 69 |
| Cohort and coverage of percentiles and ratings | W3-1 D3, A3 | WiGO ratings, PP/PK panel | Wave 2 Q11, Q20 | 74, 22 |
| Mean of percentiles shown as percentile | W3-1 D4 | Team drivers card | W2-4 D7 | 74, 26 |
| Unknown → 0 and order-dependent ranks | W3-1 D2; W3-2 D3; W3-3 A1, D7 | Projections rank columns; Top Adds (rail, preview, player page, API); share-card line, score, streak; pickup cells | W2-P0-7; W1 team-ratings D14 | 5, 20, 47, 48 |
| Rolling xG windows: attempt-conditioned, EN included, season and feature-version mixing | W3-1 D1, A4 | xG Lab, Timeline, homepage analytics, FORGE prior (env-gated) | W1-1 (decision 7 row) | 5, 7, 16 |
| xG approval gate and benchmark fail open | W3-1 D6, C2 | Scoring route approval, benchmark | xg-part1 D8; W1-1 item 6 | 2, 5, 11 |
| xG explorer window, cutoff and model mixing | W3-1 D7, C1 | xG Lab (default 2025-26) | W1-1 item 9 | 5, 13 |
| Homepage per-side completeness and freshness | W3-2 A1; W3-3 D5 | Desktop and mobile slates; xG merge | xg-part1 D1 (xG reader) | 23, 59, 70 |
| Decisions 42/43 homepage readers; pulse | W3-2 D1, D2; W3-3 D6 | Game slates, pulse, `/api/v1/games`, `/api/v1/homepage/pulse` | W1 game-predictions D-rows (42, 43) | 1, 42, 43, 25 |
| Paired coverage in Player vs Player | W3-2 D4, A2 | Share card, export, alt text | W2-1 PR-SQL-1 | 13, 22 |
| Credited goalie record on share cards | W3-3 D2 | Player tiles, tier rows | W2-6 D2 | 40, 46, 72 |
| Legacy averages units and TOT pooling | W3-3 D3, A2 | Public routes (external use unknown) | Seconds-as-minutes row; SUS-part1 D3 | 17, 26 |
| Goalie rest-split latent activation; unknown rest | W3-4 N1 | Goalie rows, reserve rows, `team_win_if_starts` | W1-6 028, D6, D7 | 60, 63 |
| Market flag confidence | W3-4 N2 | Flags table (no app reader) | W1-6 D4b, D17, D18 | 30, 35 |
| Season evaluator twins, moments and goalie pace | W3-5 F1, F2, F3, PR2 | Season game outputs, aggregates, golden vectors | W1-8 p1 D4, D5, 006; W2-8 PR8 | 38, 46, 63 |
| Joint quantiles lost at publication | W3-5 F4, PR1 | Release endpoints, page intervals | W2-8 D11, D12 | 29, 39, 26 |
| Nullable values through transport readers | W3-5 F6, PR3 | Table, sort, compare, detail | Rule 5 row | 47, 48 |
| Season settlement scoring, bounds, allocation | W3-5 F7, PR4, PR5 | Settlement importer, evaluations | W2-7 D2, D10 | 41, 65, 78 |
| Last-N rate alias divided by seconds | W3-6 N1 | Rankings, deployment tiers, snapshots, results luck | W1 P0 #10; W2-P0-11 | 23, 75 |
| Band exposure, pinning, IPP fallback, labels | W3-6 N2–N4, N6 | Sandbox, trend-bands API, FORGE (four-metric allowlist) | W1 SUS D2, D4, D9, D14 | 26, 32–34, 54 |
| Forecast band coverage | W3-6 N5 | `projectCountMetric` (unserved) | SUS-059/060 | 29, 37 |
| Legacy sKO construct and SD naming | W3-7 D1, D2 | Read API, hook, leaderboard | M-SKO lineage | 80, 21 |
| Sko Element admission, window membership, opportunity | W3-7 A1–A3, D3, D4 | Preview, trade comparison (Codex) | W2-9 A1 (arm C) | 32–35, 61, 25 |
| SQL streak runs | W3-7 D9, A5 | `rpc_sko_player_series` (no caller) | W2-1 D16 | 34 |

---

## Wave 3 P0 list

P0 = a user-visible wrong number on a live surface today, after Astra's corrections (the Wave 2 definition). **1 row, live.**

| # | Defect | Area | File:symbol | Reach | Source (audit + Astra) | Evidence |
|---:|---|---|---|---|---|---|
| W3-P0-1 | Season per-60 rates are means of game per-60s, and on-ice shares are means of game percentages; the page drops the NST TOI it fetches | Player stats page | `components/PlayerStats/playerStatsContract.ts:276-293` `aggregateSummaryStat`; merge `pages/stats/player/[playerId].tsx:923-1022` | Live (`/stats/player/[playerId]`) | W3-3 D1; Astra §1 | Reproduced (3.0 vs 2.0 G/60; 62.5% vs 40% CF%). Reported 2026-11-11, 8 skaters: up to +11% G/60 and ixG/60, CF% off up to 1.8 points |

**Promotion note.** Fable rated D1 P1 "on size" while stating it meets the letter of P0 and leaving promotion to Chef. It is carried as P0 because Wave 2 counted the same defect class on a live page as P0 (W2-P0-12, line-card goalie SV%/GAA as means of game ratios). Chef may demote it on size; the counts below then drop by one.

**Fable P1s considered and not carried as P0, and why**
- **W3-1 D4 team drivers "percentile"** (fixture 27th vs 15.6 true): consistent with Wave 2, where decision-74 formatting (W2-4 D7) was P1.
- **W3-1 D3 WiGO PP/PK cohorts without a minutes floor:** a sample-validity issue, like Wave 2 Q11 floors (P1).
- **W3-1 C1/D7 xG Lab mixing:** live historical page, but the mixing and zero-fill depend on which supplemental rows the bounded preview returns; magnitudes unmeasured. P1.
- **W3-2 A1 homepage partial SOG:** reproduced mechanism, but reported 0 of 118 sampled rows had a null part. P1, becomes P0 if a null part is observed on a served card.
- **W3-2 D3 Top Adds incomplete rows outranking complete ones:** depends on a missing projection head; incidence unmeasured. P1.
- **W3-3 D2 share-card record "3-2" for 3-0-1:** owner-only studio until a graphic is published. P1.
- **W3-1 A2 WiGO revived null rate:** missing-data dependent; incidence unmeasured. P1.

### Combined Waves 1 + 2 + 3 P0 count

| Wave | Live | Conditional | Total |
|---|---:|---:|---:|
| Wave 1 (Batch A + B/C) | 29 | 1 (W1 #17 Start Chart) | 30 |
| Wave 2 | 13 | 1 (W2-P0-14 draft season) | 14 |
| Wave 3 | 1 | 0 | 1 |
| **Combined (raw)** | **43** | **2** | **45** |

**By distinct root cause: 41** (39 live + 2 conditional). Wave 2's four shared roots stand (40 after Wave 2); W3-P0-1 has its own fix (different file and reader from W2-P0-12), so it adds one. If Chef demotes W3-P0-1: 44 raw, 40 by root.

Wave 3 also adds **readers** to existing P0s without adding rows: W2-P0-1 (WiGO game-log and calendar readers, W3-1 D5), W1 P0 #10 / W2-P0-11 (latent last-N fallback, W3-6 N1), W1 P0 #2 (no change; NST stays headline xG).

---

## Owner decisions still open (not answered by decisions 1–80 or Wave 2's questions 1–40)

For Chef's pop-ups. Numbering continues from Wave 2. Recommended answer first, then one alternative. **Tier A** blocks a P0 or P1 fix; **Tier B** can wait for its lane. sKO/VuDu questions stay inside [OWNER-INTENT-SKO-VUDU.md](OWNER-INTENT-SKO-VUDU.md) §9 (summary design, scale and coefficients, headline target, VuDu completion, backronyms) and do not reopen what it settles (own-player baseline, opportunity inside the question, F/D separation, goalie-specific treatment, labelled uncertainty, leakage-safe evaluation, 10-team-game horizon).

| # | Question (source) | Recommended | Alternative | Why it matters | Tier |
|---:|---|---|---|---|---|
| 41 | One percentile convention? (W3-1 Q1, W3-3 Q4) | Keep both conventions and label each: mid-rank in WiGO, social and the player radar; rankings keep exclusive with "ties share the lower bound" (W3-6: do not change `rankingCalculator.ts`) | Mid-rank everywhere, rankings numbers change | With 40% tied at zero, mid-rank gives 20 and exclusive 0; Astra: both are recognised conventions | B |
| 42 | WiGO PP/PK cohorts: add a per-strength minutes floor, and split forwards from defencemen? (W3-1 Q2, D3) | Yes to both: a visible, user-lowerable minutes floor per strength (Wave 2 Q11 pattern) validated by split-half stability, "insufficient sample" below it; F and D cohorts separate | Floor only, keep one skater cohort | Blocks the W3-1 D3 fix (reported 41% of the PP cohort under 30 PP minutes) | A |
| 43 | Projections "overall" rank (W3-1 Q3) | Keep one skater-plus-goalie rank labelled "overall", add a position rank | Rank skaters and goalies separately only | Rank column meaning | B |
| 44 | xG approval floor (W3-1 Q4; Astra C2) | Precision rule (holdout goal-rate SE ≤ 5% of the rate, about 370 goals) plus beat-the-base-rate on the applied artifact, as a model-validation choice | Reuse the rebound gate's 100 and 250 | Release gate only; becomes Tier A before any xG model is approved | B |
| 45 | Homepage pulse with no qualified game model (W3-2 Q1; W3-3 Q5 reframed by decision 42) | Hide the model series; show nothing unless a labelled visitors-only line is wanted | Keep a labelled visitors-only line (needs an explicit series-selection change; today it renders null) | Decision 42 already rules out "labelled placeholder model" | B |
| 46 | Stats-page goalie qualifier (W3-2 Q2) | Keep the house rule (quarter of mean team GP, by appearances), print it, compute it from the displayed season, show "unknown" when standings fail | Starts-based qualifier | Hidden policy; failed standings silently relax it | B |
| 47 | Top Adds week objective (W3-2 Q3) | Expected fantasy points over the games actually left this week from qualified per-game projections (decision 48), with demand and ownership as separate columns | Keep a blended "Add score" with labelled presentation weights | Missing-input fix proceeds either way | B |
| 48 | Uneven trades (W3-2 Q4; Codex lane) | Keep raw side totals and a raw difference labelled "more/fewer projected [units]"; no "favours" verdict until a league-aware replacement exists | Withhold the net entirely on uneven sides | Astra: withholding is a product choice; page is 404 | B |
| 49 | Share-card goalie record (W3-3 Q2, D2) | Credited W-L-OTL, extending decision 72 to share cards; unavailable if any decision is unknown | Drop the record from the line | Blocks the W3-3 D2 fix | A |
| 50 | Are the legacy public routes read outside the repo: `/api/Averages/[playerId]`, `/api/ThreeYearAverages/[playerId]`, `/api/v1/ml/get-predictions-sko`? (W3-3 Q1, W3-7 Q3) | One bounded read-only log check for all three (decision 79 pattern); fix units and labels in place regardless; gate the sKO read API only if no outside caller | Assume none and fix in place without a log check | D3 priority (P1 if read); API gating is an operational choice | B |
| 51 | The two daily legacy sKO crons (W3-7 Q1) | Keep `update-sko-stats` (history for decision 80's evaluation); pause `update-predictions-sko` until it is renamed and defined; delete nothing | Keep both running | Astra: needs consumer, use and cost evidence; not a math prerequisite | B |
| 52 | Season evaluator goalie outcome context (W3-5 Q1, F1) | No game-context multiplier on W/L/OTL/SO/QS until decision 38's fitted goalie model, inside a versioned coherent outcome treatment | Opponent strength only | Dormant activation blocker | B |
| 53 | Post-freeze newcomers on the season page (W3-5 Q2, F8) | Show a labelled "population prior" line with unknown targets null and no role odds | "No projection yet" until the next artifact | Astra: a cohort mean is not validated either | B |
| 54 | Season page team "lines" (W3-5 Q3, F9) | Relabel "projected ice-time order" and withhold PP/PK units until strength TOI is real | Hide the card | Dormant | B |
| 55 | Sko Element interim label before an alert contract (W3-7 Q4, D3) | Signed gap with units only; no Rebound/Cooling word | Keep the words with a provisional fixed threshold labelled provisional | Astra agrees the interim; the full fix is three named comparisons (R2) | B |
| 56 | VuDu completion contract (intent §9; W3-7 Q2 with Astra R4) | Two labelled fields: same-window stopping residual on the shots actually faced (= −GSAx per 100 shots under `vuduSaveGap`'s sign, positive = rebound) and the FORGE forward SV% outlook; workload, danger and stopping kept separate (decision 63) | One field: forward forecast minus recent, labelled | VuDu has no lane until this is answered | B |
| 57 | sKO summary design, scale and headline target (intent §9 items 1–3) | Keep gap, support and opportunity visible as separate components; choose any composite, scale and headline target only after held-out evidence (decisions 32, 65) | A provisional labelled composite now | Astra: not a blocker for arithmetic or admission repairs | B |

**Tier A: 42, 49 (2 questions). Tier B: 15.**

**Not carried, and why:** 5v5 band source (W3-6 Q1: premise withdrawn, `toi_per_game_5v5` exists); PP band window meaning (W3-6 Q2: Wave 2 Q15's pattern and decisions 16, 61 apply — last N games dressed, zero-PP games kept as zero opportunity, n shown); heat-map wording (decision 74); "labelled placeholder model" pulse (decision 42); WiGO partial ratings (Wave 2 Q20 extends to them); NST penalty counts (decision 13 needs a saved NST reference, not an owner choice); sKO/VuDu official backronyms (intent §9 item 5; naming, not math); `stability_cv` alias vs column (the lane uses an API alias; any column is an approval below); `confidence_0_to_100` rename (with decision 30's market fixes).

**Approvals the sprint will need (actions), added by Wave 3:** any xG aggregate rebuild or `update-nhl-xg-aggregates` rerun and any registry change (W3-1); `predictions_sko` column add or rename, either pg_cron change, gating `/api/v1/ml/get-predictions-sko`, any `sko_skater_stats` or `predictions_sko` backfill, the `rpc_sko_player_series` migration, promoting any Sko or BLSH preview page (W3-7); `confidence_0_to_100` rename or drop, any WGO goalie ingest shape change (W3-4); importing a season artifact or release, season settlement reruns or resettlement, evaluation-column migrations (W3-5); `sustainability_trend_bands` history rebuild (decision 36), rolling rebuild or backfill, held rolling-run reconciliation (W3-6); the bounded log check in Q50. Wave 1 and Wave 2 approvals still stand.

---

## Lane-grouping update (input to the fix-sprint orchestrator)

Wave 2's L1–L15 and the Codex BLSH lane stand. Wave 3 slots in as below, splits L4, moves the season evaluator into L15, and adds six lanes. "Owns" is file-level; a lane edits only files it owns. Chef should confirm exact paths when writing each brief.

### Wave 3 findings in existing lanes

| Lane | Wave 3 additions | Notes |
|---|---|---|
| L1 Event state, parity, PBP | None new. W3-3 D5 / Astra: a strength relabel cannot fix total SOG. | — |
| L2 Underlying-stats landing and summaries | W3-1 D7 xG explorer (owns `lib/underlying-stats/xgExplorer.ts`, `pages/api/v1/underlying-stats/xg.ts`, `pages/underlying-stats/xg/**`) | Registry pin supplied by L14 |
| L3 Variance, roster matrix, TOI | W3-3 D4 roster-tab height and age (`RosterMatrixWrapper.tsx:502-512`) | Reuse `WiGO/playerBiography.ts` (read only) |
| **L4a NST SQL views, migrations, NST game-log ingest** (was L4) | W3-7 D9/A5 `rpc_sko_player_series` (only if kept in use) | Owns migrations, `update-nst-gamelog.ts`, `sql/functions/**` |
| **L4b WiGO readers, ratings and writer** (split from L4) | W3-1 D3, D4, D5, D9, D11, D12, A1, A2, A3; W3-3 radar convention (Q41) | Owns `utils/fetchWigo*.ts`, `utils/calculateWigoRatings.ts`, `components/WiGO/**`, `hooks/useWigoGameLog.ts`, `pages/api/v1/db/calculate-wigo-stats.ts`, `components/PlayerStats/PlayerRadarChart.tsx`; after L4a; PP share follows L8's decision 71 definition |
| L5 Rankings | W3-6 N1 consumer side (`skaterWindowAggregation.ts`, `rankingQueries.ts`, `deploymentTiers.ts`, `rankingCalculator.ts`, `resultsLuck*`) | With L6 count fields |
| L6 Rolling and trends | W3-6 N1 writer count fields; W3-3 D8 hot/cold, D9 recency copy (`pages/trends/index.tsx`, `lib/trends/teamPercentiles.ts`, and now `lib/dashboard/dataFetchers.ts`); W3-7 D6 `lib/trends/utils.ts` `combineSKO`/`computeLuck` | — |
| L7 Sustainability | W3-6 N2–N6 (`bands.ts`, `bandCalculator.ts`, `bandService.ts`, `features.ts`, `entitySurfaceServer.ts`, `pages/api/v1/sustainability/**`, `pages/trendsSandbox.tsx`) | Validate FORGE's four-metric allowlist with L9a (decision 26) |
| L8 Lines, PP, TOI API | None new; W3-1 D11 `pp_pct` uses its PP-share definition | `lib/socialShare/trends.ts` stays here |
| L9a FORGE skater path | W3-4 N2 market confidence (with W1-6 D4b), N3–N5 research backlog | Research items only on promotion |
| L9b FORGE goalie path | W3-4 N1 rest-split guard and later replacement; N6 reserve label | After the W1-5 credited-start fix |
| L10 Served ledger and player-forecast planning (TS) | W3-5 F7/PR4/PR5 settlement; PR1 publication (`admin.ts`); PR3 readers (`admin.ts`, `queries.ts`, page); F8, F9 presentation; F10 receipts (`lib/player-forecasts/modeledGoalieParticipation.ts`) | Now owns `lib/fantasy-projections/{settlement,admin,queries}.ts`, `pages/fantasy-projections.tsx`, `scripts/import-player-forecast-season-settlement.ts`; after L15 |
| L11 RSO bridge | None new (W3-4: bridge reads reserve horizon 1 only) | — |
| L12 Team ratings, Game Grid, pickup, Week Score | W3-2 D3 Top Adds with W1 team-ratings D14; W3-3 D7 pickup cells, D10 sparkline | Now owns `lib/dashboard/topAddsRanking.ts`, `components/forge-dashboard/TopAddsRail.tsx`, `components/forge-command-center/TopAddsWatchlist.tsx`, the Top Adds blocks of `pages/FORGE.tsx` and `pages/forge/player/[playerId].tsx`, and `pages/api/v1/forge/players.ts` (zero-fill) |
| L13 Draft, projections page | W3-1 D2 ranks, D10 tier bands (`utils/projectionsRanking.ts`, `utils/tierUtils.ts`, `pages/projections/index.tsx`) | — |
| L14 xG model and shot map | W3-1 D1, A4, D6, D8 (`lib/xg/**`, `pages/api/v1/db/update-nhl-xg-aggregates.ts`, `scripts/train-nhl-xg-*.ts`, `scripts/benchmark-nhl-xg-baselines.ts`) | Supplies the registry pin to L2 and the xG source contract to L16 |
| **L15 Season evaluator, TS and Python** (was "Python season and forecast models") | W3-5 F1–F5, PR1 (event side), PR2, PR3 (contract) | Now owns `modeling/player_forecasts/**` **and** `lib/fantasy-projections/{evaluator,contracts,seasonJobs}.ts`; one lane so twins change together with regenerated golden vectors |
| Codex BLSH | W3-2 D6 wording; W3-7 A1 consumers in `lib/buyLowSellHigh/trade.ts`, `market.ts`, `components/blshTrade/**`; Q48 | Claude lanes do not edit these files |

### New lanes

| Lane | Owns | Wave 3 items | Stage |
|---|---|---|---|
| **L16 Homepage** | `lib/homepageGameAnalytics.ts`, `lib/homepagePulse.ts`, `components/HomePage/**`, `hooks/useHomepageGames.ts`, `pages/api/v1/homepage/**`, `pages/api/v1/games/index.js` | W3-2 A1, D1, D2; W3-3 D5, D6 | 2 |
| **L17 Player stats and stats leaderboards** | `pages/stats/**` (incl. `pages/stats/player/[playerId].tsx`), `components/PlayerStats/**` except the radar, `components/StatsPage/**`, `lib/NHL/statsPageFetch.ts` | **W3-P0-1** (W3-3 D1), heat-map copy; W3-2 D5 | 2 (first: carries the Wave 3 P0) |
| **L18 Social share** | `lib/socialShare/**` except `trends.ts` (L8), `components/SocialShare/**` | W3-3 D2, A1 (Q49); W3-2 D4, A2 (`modules/playerVsPlayer.ts`) | 2, after reconciling the active social-share lane |
| **L19 Misc legacy** | `lib/api/averages/**`, `pages/api/Averages/**`, `pages/api/ThreeYearAverages/**`, `pages/api/v1/db/upsert-csv.ts` | W3-3 D3, A2, D11 | 4 (dormant) |
| **L20 sKO legacy** | `pages/api/v1/ml/{update,get}-predictions-sko.ts`, `lib/hooks/useQuarantinedPredictionsSko.ts`, `components/Predictions/**`, `lib/ml/predictionsSkoRunControl.ts`, `lib/predictions/legacyQuarantine.ts`, `pages/api/v1/db/update-sko-stats.ts`, `lib/supabase/utils/{statistics,constants}.ts`, manual `fetchSKO*.js` (review only) | W3-7 D1, D2, D5, D8/A4, D10 (023, 026) | 4 |
| **L21 Sko Element** | `lib/skoElement/**`, `components/skoElement/**`, `lib/sko/**` | W3-7 A1–A3, D3, D4, D7, D10 (021, 018, 019) | 4 (dormant; with Codex for trade/market consumers) |
| VuDu | No lane | Design step after Q56 | — |

### File-ownership conflicts to settle when briefing

1. **`components/PlayerStats/PlayerRadarChart.tsx`:** Wave 2 gave it to L4 (W1 P0 #8, decision 15); W3-3 also touches it. It stays with **L4b**; L17 owns the rest of `components/PlayerStats/**`.
2. **xG explorer files** (`lib/underlying-stats/xgExplorer.ts`, `pages/api/v1/underlying-stats/xg.ts`, `pages/underlying-stats/xg/**`): Fable W3-1 routed D7 to its xG lane, but L2 owns those directories. **L2** implements D7; L14 supplies the registry-pinned model contract.
3. **`lib/fantasy-projections/**` vs `modeling/player_forecasts/**`:** W3-5 requires TS and Python twins to change together. Split by file: **L15** owns `evaluator.ts`, `contracts.ts`, `seasonJobs.ts` and the Python; **L10** owns `settlement.ts`, `admin.ts`, `queries.ts`, the page and the importer. PR3 crosses the boundary: L15 lands the nullable contract in `contracts.ts` first, then L10 updates the readers.
4. **`lib/trends/**` and `pages/trends/index.tsx`** are L6's. W3-3 D8/D9 and W3-7 D6 go to **L6**, not to the misc or sKO lanes. `lib/dashboard/dataFetchers.ts` is assigned to L6 with them.
5. **`lib/socialShare/**`:** an active Claude social-share lane has uncommitted edits (`tasks/diaries/2026-10-31-claude-social-share-chef.md`). Chef must close or absorb it before staffing **L18**; also check `tasks/artifacts/cross-platform/2026-10-24-coordination/` for Codex claims.
6. **Codex BLSH:** W3-7 A1 cannot be finished inside L21 because the comparison consumers (`trade.ts`, `market.ts`, `BlshTradeComparison.tsx`) are Codex-owned. L21 changes the Sko record contract; the Codex lane updates its consumers.
7. **`pages/api/v1/forge/players.ts`** (Top Adds zero-fill of hits/blocks and missing heads) is assigned to **L12**; it is a FORGE served route, so L9a reviews the change.
8. **`pages/FORGE.tsx` and `pages/forge/player/[playerId].tsx`:** L12 owns only the Top Adds blocks; any other edit there needs an explicit hand-off.
9. **`lib/homepageGameAnalytics.ts`** xG merge: L16 owns the file; L14 owns xG source and model admission (decisions 5–7).
10. **`components/RosterMatrix/**`** (L3), **`components/GameGrid/**`** and **`components/PlayerPickupTable/**`** (L12) keep their Wave 2 owners for W3-3 D4, D10 and D7.

### Suggested order (at most 4 lanes at once)

1. Definitions and units: **L1, L4a, L6, L14**.
2. Readers: **L17** (Wave 3 P0) and **L2** first, then **L3, L5, L8, L4b, L16, L18**.
3. Models and planners: **L9a, L9b, L12, L13**.
4. Evaluation, downstream and dormant: **L15 → L10, L11, L7, L19, L20, L21**.

Tier A questions 42 (L4b) and 49 (L18) should be answered before those lanes start.
