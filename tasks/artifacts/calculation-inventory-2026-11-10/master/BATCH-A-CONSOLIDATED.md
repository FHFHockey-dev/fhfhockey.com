# Wave 1 Batch A: Fable audits merged with Astra peer reviews

Chef, 2026-11-11. Sources: Fable audits in [audits/](audits/) (W1-1 to W1-5), Astra (Codex) peer reviews in [W1-Astra-PR/](W1-Astra-PR/), and [OWNER-DECISIONS.md](OWNER-DECISIONS.md). The original audits are **not edited**: this file is the authoritative reading for the fix plan wherever the two disagree. Nothing here authorizes implementation, production writes, refits or deployment.

**How to read it.** For each pass:
- **A. Astra-only defects:** issues Fable missed, now part of the defect list.
- **B. Corrections to Fable:** where Fable's diagnosis, magnitude or remedy is wrong or overstated.
- **C. Superseded remedies:** Fable's recommendations replaced by later owner decisions.
- **D. Enhancements:** improvements worth doing that are not defects.
- **E. Evidence status:** what is reproduced, what is reported only.

## Cross-cutting rules for the fix plan (from Astra, adopted by Chef)
1. **Magnitudes are dated, sample-based evidence.** Fable's production counts and replays (six-game NST sample, 300-game starter calibration, 230-game xG refit, team-ratings replay, rolling five-player checks) came from scratch scripts that aren't in the repo. Quote them with their sample size and date, and never as population rates. Before any implementation relies on a magnitude, keep a reproducible input manifest (game ids, cutoffs, hash), the script and its outputs.
2. **Use AUC/Brier thresholds as alarms, not proofs.** Leakage is proven by feature lineage and counterfactual tests (prefix invariance, target counterfactuals), not by AUC bounds. Calibration needs per-bin reliability, proper scores and paired comparisons on the same cohorts with time-ordered splits.
3. **Test invariants must be mathematically right.** League-relative scores may legitimately move when other teams change; tied values may make unequal tiers; a sub-1 shots/60 can be legitimate. Tests recompute from components and freeze inputs explicitly.
4. **Fix every reader, not just the flag.** Registry demotion, a `updated_at` fix or a writer change doesn't repair readers that select data independently. Every fix lists its readers and adds a selection test for each.
5. **Keep unknowns unknown.** Missing data, unresolved probability mass and incomplete coverage stay explicit and are never silently turned into zero, into "first row" or into rescaled certainty.
6. **Cleanup and deletion are separate decisions.** No legacy view, RPC or route is deleted because of a math finding. Dependencies get inventoried first.

---

## W1-1 · xG ([audit](audits/xg-part1.md), [Astra](W1-Astra-PR/xg.md))

**A. Astra-only defects**
- **Isotonic calibration tie defect (upgrade M-XG-002 to *wrong*).** Equal inputs aren't pooled; the output depends on row-ID order (ten predictions of 0.2 with 7 zeros then 3 ones give 1e-9, or 0.3 when reversed) (`web/lib/xg/calibration.ts:326-364,416-425`).
  - Fix: pool equal inputs.
  - Test: permutation invariance.
- **Rich-rebound cross-game collision (M-XG-015).** Possession is indexed by event ID only, so batching an unrelated game with the same event IDs changes labels (`reboundRichLabels.ts:125-128,173-178`).
  - Fix: key on `(gameId, eventId)` everywhere.
- **Metrics Timeline selects models without a pin.** It reads approved aggregates with no model-version or registry filter (`MetricsTimeline.tsx:158-167`). Registry demotion won't exclude the leaky model there.
  - Add an active-model-selection test.
  - Fable's "double-row" failure mode (D27) is not what happens: the first row wins (`metricsTimelineData.ts:50-65`).
- **xgboost-js probability-space mismatch** confirmed in the library and our scorer (`@fractal-solutions/xgboost-js/src/xgboost.js:22-41,120-125`; `shotFeaturePersistence.ts:593-601`).

**B. Corrections**
- **The test set is not mostly playoffs.** It is 139 regular-season games (11,638 shots) and 69 playoff games (6,196 shots, 34.7%), dated 2026-03-30 to 05-21.
- The "EV" AUC 0.736 is equal strength, not certified 5v5. External AUCs of 0.77–0.78 are context, not an acceptance threshold.
- **Drift threshold (M-XG-043):** a 0.015 shift at 1,000 shots is about **1.9** standard errors, not 11. Drift (mean xG versus mean goal rate separately) is not calibration. Keep drift monitoring and add a real calibration check.
- **L2 penalty:** the objective is already mean log loss + λ/2‖w‖². λ does not grow with row count. Nonconvergence still stands (training mean 0.0767 against 0.0717). Use gradient and objective convergence diagnostics, and tune λ by validation sweep, not a fixed 0.0005.
- **Artifact path:** the scoring route also accepts `modelArtifactPath` per request. An unset env var means default requests fail with 400, not that scoring is impossible.
- **Shot-assist pagination:** the truncation *risk* is real (200 × 500 cross-product against a 1,000-row cap), but the "96% loss" is unmeasured. Add a capped-client fixture and record eligible/resolved counts.
- **Created xG:** the rolling-window "last N" means last N credited events, not games; that one is confirmed. Whether credits may sum above shot xG depends on the attribution contract (exclusive or nonexclusive). Decide the contract before writing a conservation test.
- Miss-reason fix: moving `over` before `crossbar` doesn't fix `above-crossbar`. Use exact-reason fixtures.

**C. Superseded remedies**
- D6 "rename GSAA to GSAx" → decision 10 (NST GSAA: SA × (1 − league SV%) − GA, computed at the aggregate level). GSAx can be a separate column later.
- D9 rush fixture at 5 s → decision 8 (4 s, no faceoffs): 4 s true, 5 s false, a faceoff within 1–4 s false.
- D5 empty-net choice → decision 7 (exclude from totals and report separately). Keep the two net states distinct in fixtures.
- Headline xG → decisions 6 and 12 (NST labelled; the bucket heuristic is hidden, then retired).

**D. Enhancements**
- A deterministic feature-lineage and backward-only feature contract in CI.
- A durable local training dataset with a version lineage (manifest, splits, seed, predictions).

**E. Evidence status**
- Holdout metrics independently recomputed: candidate AUC 0.7124 overall and 0.7356 EV; old champion 0.9336.
- The flurry leak is reproduced.
- The 0.748/0.761 refit is a reported sample experiment and not reproducible yet.

## W1-2 · NST-derived ([audit](audits/nst-derived-stats.md), [Astra](W1-Astra-PR/nst-derived.md))

**A. Astra-only defects and qualifications**
- **The PBP-only fallback path** (`playerStatsLandingServer.ts:3045-3060`) has its own score-state handling. Test it separately, because the parity fix doesn't cover it.
- **Danger-split GSAA needs bucket-specific league baselines.** HD/MD/LD GSAA must not reuse the all-shot SV%. It also depends on the C36 MD/LD double count (M-UST-048/049): changing the formula alone won't fix the split goal totals.
- The **goalie score-state contexts** filter zero-TOI rows too (`:2938-2939`), so fix and test goalies alongside skaters.

**B. Corrections**
- **D1 scope:** describe it as missing or incorrect score-state exposure, often empty. It isn't guaranteed empty, since a goal followed by a later event can create a scored segment. Classify events by pre-event score and intervals by post-event score, and define explicit ordering for goal and stoppage events on the same clock. Tests: conservation, goal at a boundary, one-goal subsets, missing scores, skaters and goalies.
- **Bucket xG "every goal = 0.25"** holds only for non-null geometric values; goals missing coordinates can be null.
- **Including misses in xGA is normal for GSAx.** The defect is the GSAA label/contract, the heuristic values and the mismatched event populations.
- **D5 (NST danger, scoring chance, rush) is not yet an executable spec.**
  - The glossary was recalled from memory and the polygons weren't established.
  - Get an archived reference and pin coordinates, boundaries, timestamp inclusion, allowed sources, ownership and blocked-shot coordinates. Exclude faceoffs (decision 8).
  - The "90% exact" acceptance is an example only. Test event-level classification and directional bias, then validate on held-out games. Don't tune polygons to six games.
- **M-NST-019 freshness:** production merges durable checkpoint state that can escalate, so "a permanent gap becomes healthy" is not established end to end (`goalieFreshness.server.ts:24-36,63-73`).
- **D15 catch-up:** keep fail-closed accounting. Refund only provably unused attempts after acknowledged settlement, never a generic "refund on finish".
- **D8 penalty-expiry TOI:** "PP seconds = penalty time" is not a universal oracle (coincidental, double-minor halves, early goals, OT manpower). Specify fixtures per case.
- **D11 tolerances** (±1 count, ±2 s) are candidates, not policy. Prefer narrow versioned exceptions.
- **PDO** at 1.0 versus 100 is a unit-adapter issue, not a different statistic. Trace consumers before changing public scaling.
- A full budget-function body exists in migration `20261109015836`. "In no migration" was too broad. Its header still reads DRAFT although it was applied on 2026-11-09 (Chef applied it; fix the header).

**C. Superseded remedies**
- D10 "cap at 39" → decision 14: a shared cooldown state, ≤39 per burst with 60 s after, a full 300 s after two bursts, and every caller in SQL, TS and Python, including resumable jobs.
- D6 radar "label all situations" → decision 15: move **both** the player value and the cohort to 5v5, with the same minimum and season. Fix rank N+1 of N (`PlayerRadarChart.tsx:428`).

**D. Enhancements**
- Ship the original sample runner and a bounded extraction spec with the fix plan, so the parity numbers can be reproduced.

**E. Evidence status**
- Reproduced with synthetic fixtures: score-state empty rows, the MIN4/MIS10/PS penalty classes, the bucket floor and blocked-shot xG, the `1010` penalty shot treated as empty net, and OZFO% 50 against 66.7.
- The six-game magnitudes are reported, not reproduced.

## W1-3 · Rolling ([audit](audits/rolling-player-averages-trends-part1.md), [Astra](W1-Astra-PR/rolling-players.md))

**A. Astra-only defects**
- **Three different "expected shooting %" denominators.**
  - Rolling: ixG/SOG.
  - Trends: ixG/unblocked × 100.
  - Rankings: ixG/all attempts.
  - The owner must pick equivalence or distinct names. ixG/SOG can exceed 1 legitimately, so the contract's 0–1 bound (`rollingMetricScaleContract.ts`) is wrong for it.
- **Season support pairs may not match the published ratio.** Independent additive accumulators can mix exposure (ixG accumulated only when xG exists, against TOI that includes NHL-only rows; assists numerator NST-only) (`fetchRollingPlayerAverages.ts:2360-2499,1242-1246`). Counterexample: published 1.8 ixG/60 against a reconstructed 0.9. **M-ROLL-023 is not unconditionally sound.**
- **Results-luck baseline flags lie.** `baselineWindowExcluded=true` is set from field presence, not temporal exclusion (`resultsLuckSources.ts:155-165`). On-ice season totals are rebuilt as average × all appearances, which overstates them when coverage is partial (`:140-148`).
- **Social-share pruning also kills point-game streaks.** `goals_total_all` and `assists_total_all` are pruned too (`players.ts:214-219`), not just hits and blocks.
- **The `playerTrendCalculator.test.ts` fixture asserts a minutes contract** (TOI 20). It passes today and hides the unit bug.

**B. Corrections**
- **D1/D8 units:** the current **playoff** shots/60 fallback is *correct*, because the adapter converts seconds to minutes first. Its TOI output is wrong (24.57 minutes where downstream expects seconds). The regular-season fallback is 60× low. **Fix the adapter and the fallback together.** Changing only `*60` makes playoffs 60× too high. Old playoff rows are historical corruption, not proof of the current path.
- **D3 FORGE evidence weight:**
  - The unit fix is right, but the proposed call-up test is wrong. Total TOI *raises* the weight: 3 games × 1,200 s gives 0.513, above the 0.22 threshold even with zero shots.
  - Calibrate the evidence scope, exposure scale and thresholds together, and use a monotonicity test.
  - "~0.76 cap" and "25% lower TOI" are not general facts; the actual change is (1 − w)(prior − current).
- **D5 availability:** current-team last-N is the **existing explicit contract** (`rollingPlayerAvailabilityContract.ts:99-114`). Changing it to follow prior stints needs an owner decision. First appearance isn't roster eligibility, and an 82-game ceiling isn't universal.
- **D6 PP denominator:** confirmed. Use a team PP clock for every dressed game, and validate the clock itself.
- **D7/D14/D16 zero denominators:** keep *known* zeros, never turn unknowns into zeros, and keep pairing safeguards. Don't accumulate numerator and denominator independently as a general policy.
- **D10 percentiles:** equal values get equal *raw* mid-rank percentiles. Sample-size shrinkage may still differentiate displayed scores, so test them separately. The producer is a mean of non-null per-game values, so the Nth slot is the Nth non-null observation.
- **D4 calendar windows:** decide whether "last 7 days" means calendar recency or the 7 days ending at the last game, and pool from component differences.
- Missing-row counts, the 108/108 rows and the five-player recomputations are a 2026-11-10 snapshot, not re-read.
- Rolling and FORGE runs are held on `nst_persistence_unconfirmed`. **Reconcile what they wrote before any retry or rebuild.**

**C. Superseded remedies:** none. Owner decisions still needed: availability scope, cross-season window contract, and the expected-SH definitions.

**D. Enhancements**
- Explicit count fields: never infer counts from `/60` aliases. Migrate readers before removing aliases (`rollingRankingSelectFields.ts`).
- Prove selected-window membership within the season, and reject overlapping or unknown baselines.
- Decide whether results luck compares a count, a rate or a standardised residual.

**E. Evidence status**
- Reproduced: the regular-season 60× fallback (0.163 against 9.77), the playoff path being correct, the rate-alias luck numbers (0.326 against 2.5), the PP 0/0 → null, the zero-SOG drop (0.1 against 0.18), and the TOI heuristic (37 → 2,220 s).
- 58 existing tests pass despite these.

## W1-4 · Team ratings, CTPI, SOS ([audit](audits/team-ratings-power-ctpi-sos.md), [Astra](W1-Astra-PR/team-ratings.md))

**A. Astra-only defects**
- **Early-season shrinkage cancels out.** Blending toward the league mean multiplies z by w, but the final re-standardisation divides it back out. GP=1 and GP=10 give identical ratings (max difference 7e-14) (`power-ratings.ts:510-521,581-590,604-627,652-670`). Fixing GP alone won't restore shrinkage.
  - Decide whether the score is a relative rank scale with a fixed SD or a shrunk strength estimate. If the latter, use a fixed reference distribution or shrink after normalisation, with an approved prior.
- **CTPI v2 PP/PK uses a weighted mean of per-game ratios, not a ratio of totals.** Example: 34.4 against 11.4 xGF/60 (`recentTeamFormV2.ts:140-157,194-195`; v1 the same at `ctpi.ts:151-162,191-192`). **v2 is not a drop-in fix.**
- **CTPI v2 confidence ignores per-metric observation counts.** One measured game in ten rows still reports "ready / high / ≈1.0" (`:255-266,407-418`).
- **The SOS research helper counts unfinished games as past.** It selects by `startsAt < cutoff` without a final result (`strengthOfScheduleContract.ts:118-123`). Postponed games behave the same way. M-TEAM-027 is not "sound" for D7's final-only rule.
- **Null PP/PK percentages become 0** through `Number()` in the adapter (`power-ratings.ts:735-736`). Fix it at the adapter as well as the tiering.
- **v2 publication needs an explicit version migration.** Trust requires the exact v1 formula and input versions (`ctpi.ts:8-18`).
- **Start Chart exposure uses the blended xGA** (`power-ratings.ts:518,673-674`). After the GP fix, it depends on the prior and reference population.

**B. Corrections**
- D1 invariance test: freeze *all 32 teams' inputs* and vary only the slate-membership mask; the output must not change. Other teams' real changes may legitimately move ratings.
- **SD convention:** the code uses sample SD. Specify that, and let zero variance return 100. Don't demand SD = 15 alongside shrinkage.
- **D3 tiers:** ties make unequal tiers. The 10–12 per tier rule holds only for distinct values or an approved tie-break.
- **The D1 magnitudes are a combined D1+D2 counterfactual** from one date. Isolating them needs a four-way ablation (original, grain fix only, population fix only, both). "11 of 32 is chance" needs a stated null model.
- **CTPI weights summing to 1.10** is a scale issue, not invalid maths. The real spec finding is the unbounded `50 + 15 × raw` under a 0–100 label. Removing PDO is a model change that needs holdout validation.
- Pace and home ice are product-definition choices. The null-to-zero failure and the two inconsistent power-score definitions are hard facts (`teamContext.ts:34-39`; `teamRatingsTrend.ts:48-53`).
- As-of selection (M-TEAM-055) prevents later-dated rows but doesn't prove knowledge time for backfilled rows.
- D9 "relabel or exclude": decision 7 requires exclusion of empty-net shots, and relabelling can't replace it.

**C. Superseded remedies and adopted direction** (Astra and Codex review, recorded under decisions):
- Compute ratings from genuine games and standardise all 32 teams against one daily baseline.
- Keep pace separate, and label the rating descriptive.
- Use pooled season-to-date PP/PK.
- Fix or withhold the Game Grid odds, without switching to the placeholder model.
- Keep CTPI gated, and inventory dependencies before any deletion.

**D. Enhancements**
- A reproducible replay artifact: input extract hash, command, cutoff, the four-way ablation and held-out validation.

**E. Evidence status**
- Reproduced offline: the shrinkage cancellation, CTPI PP pooling, CTPI sparse confidence, the SOS unfinished game and the Top Adds NaN.
- The production replay numbers are Fable's and are reported only.

## W1-5 · Goalie starters ([audit](audits/goalie-starters-starter-odds.md), [Astra](W1-Astra-PR/goalie-starters.md))

**A. Astra-only defects**
- **Maximum TOI doesn't identify the credited starter.** Executed counterexample: a starter pulled at 600 s against a reliever at 3,000 s selects the reliever (`goalie-queries.ts:113-123`). Filling TOI won't fix it.
  - Use one official `games_started = 1` label per completed team-game, with unknown when it is missing or contradictory.
  - Keep last appearance, last credited start and workload separate (`:126-144,174-210`). Use game id, not date.
- **The accuracy outcome is wrong.** It scores `actualRow ? 1 : 0`, so a reliever counts as positive and a missing feed as negative (`run-projection-accuracy.ts:2073-2082,1606-1627`). Require settled credited-start labels and exclude unknowns.
- **Accuracy selects the latest run by date, not the latest pregame issuance per game** (`:1716-1723`).
- **The three-candidate probability vector sums above 1.** Example: 0.49999, 0.49999 and 0.01, totalling 1.0099 (`goalie-starter.ts:236-241`).
- **The stage stores a team-goalie mixture under the selected goalie's id** (`goalie-stage.ts:656-685,804-824`), and the RSO bridge reads it as a per-start line (`forgeDailyBridge.ts:283-289,610-636`). Trace conditional and team-slot fields through every consumer.
- **The legacy SQL GSAA has both errors** (`production_schema_baseline.sql:2708,2733-2735`). The coordinator is tombstoned, so accept the finding with no deletion.

**B. Corrections**
- **Every candidate's probability is stored** in metadata (`candidate_goalies`, `daily_board_candidates`), not just the top pick. Check per-version coverage before calling partner calibration unavailable, and never reconstruct a partner as 1 − p(top).
- A fresh `updated_at` is necessary but not sufficient. Require immutable issued forecasts with the candidate set, receipt clocks, information cutoff, publication time and frozen start. Reuse the stronger `starterBoardDataset.ts:42-55` contract.
- **"Three L10 counts" overstates it.** The score has L10 share at 2.4, logit L10 prior at 0.7 and a distinct season start share. The amplification is verified (7/10 gives 0.895 and 8/10 gives 0.967), but the main cause needs an ablation or held-out refit.
- **Unresolved mass is not automatically a bug.** Closed complete sets sum to 1; incomplete sets carry an explicit unknown bucket. D7's "move the mass to the other goalie" needs a completeness condition.
- The LIKELY override defect is conditional (only when starter-board compute is off).
- **Serving is decided first by the native-source resolver** (`start-chart.ts:1196-1242`; `forecastServingSource.ts:21-25,59-78`), then `STARTER_BOARD_SERVING_ENABLED`, which defaults from `START_CHART_GAME_REVISIONS` when absent (`starterBoardFlags.ts:1-10`). D2 and the stale display stay conditional until the effective branch is established.
- **Release testing:**
  - Separate top-pick calibration from all-candidate calibration.
  - Report reliability intervals and paired score differences with time-ordered, clustered validation.
  - A constant baseline Brier is about 0.239, so a 0.25 coin flip is too weak as the sole bar.
  - Don't weaken the existing gate in `starterBoardValidation.ts:59-75` (200 games, 30 slates, paired improvement).
- **GSAA arithmetic in v2 is algebraically right.** The defects are the fixed .900 comparator and the use of an unstable descriptive value as a prior. If shrunk, give the predictive feature its own name.
- The 37%/56% figures are inferred, not measured. The 0.3 shrink and 8.7%/0.09 back-to-back values are hypotheses. Owner question 4 is stale (decision 10).

**C. Superseded remedies:** GSAA formula (decision 10). Fix order per TJ: actual-start outcome, then timestamps, then pregame cutoffs, then refit.

**D. Enhancements**
- Persist immutable pregame issuances per game. Freeze cohorts and model versions for calibration.

**E. Evidence status**
- Reproduced: the relief-starter selection, the amplification examples and the probability-sum defect.
- 87 tests pass.
- The 300-game calibration, 8,941 rows and back-to-back rate are reported only.

---

## Owner decisions from Batch A: SETTLED 2026-11-11 (see OWNER-DECISIONS.md 16–23)
1. **Rolling availability:** keep current-team last-N, which is the existing contract, or follow the player across teams?
2. **Expected shooting %:** pick one definition or three honestly named ones (ixG/SOG, ixG/unblocked, ixG/all attempts)?
3. **Calendar windows:** does "last 7 days" mean calendar recency or the span ending at the last game?
4. **Power rating:** a relative rank scale with a fixed SD, or a shrunk strength estimate with an approved prior?
5. **CTPI PP/PK:** exposure-pooled rates, or a deliberately equal-game mean?
6. **SOS "past":** final-only, or scheduled-before-cutoff with an explicit in-progress category?
7. **Created-xG attribution:** exclusive (capped at shot xG) or nonexclusive credit?
8. **Results luck:** compare counts, rates or standardised residuals?
