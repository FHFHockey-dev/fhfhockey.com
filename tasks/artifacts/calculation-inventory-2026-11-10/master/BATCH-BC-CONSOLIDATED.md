# Wave 1 Batches B and C: Fable audits merged with Astra peer reviews

Chef, 2026-11-11. Sources: Fable audits in [audits/](audits/) (W1-6 to W1-12), Astra (Codex) peer reviews in [W1-Astra-PR/](W1-Astra-PR/), [OWNER-DECISIONS.md](OWNER-DECISIONS.md) (decisions 1–60) and [BATCH-A-CONSOLIDATED.md](BATCH-A-CONSOLIDATED.md). The original audits and reviews are **not edited**: this file is the authoritative reading for the fix plan wherever they disagree. Nothing here authorizes implementation, production reads or writes, refits, rebuilds, migrations or deployment.

**How to read it.** Same layout as Batch A. For each pass:
- **A. Astra-only defects:** issues Fable missed, now part of the defect list.
- **B. Corrections to Fable:** where Fable's diagnosis, magnitude, test or remedy is wrong or overstated.
- **C. Superseded remedies:** Fable's recommendations replaced by owner decisions (cited by number).
- **D. Enhancements:** improvements worth doing that are not defects.
- **E. Evidence status:** what is reproduced, what is reported only.

Then: the **cross-packet defect map**, the **Wave 1 P0 list** (Batch A plus B/C) and the **owner decisions still open**.

"Reproduced" below means Astra (or Fable) executed the actual source function on synthetic inputs. "Source-confirmed" means the code path was traced but not executed. "Reported" means a Fable production read or scratch script that is not in the repo; per Batch A rule 1 it is a dated sample, not a population rate.

## Cross-cutting rules for the fix plan

Batch A rules 1–6 apply unchanged. Batch B/C adds six more, each raised by Astra in several reviews:

7. **Test the final served output, not an intermediate step.** FORGE's season bootstrap re-splits shots, goals, assists and physical counts *after* reconciliation (W1-6 PR3), and candidate uncertainty can describe the pre-bootstrap mean (W1-7 N1). Identities such as "team shots pinned to the target" or "1.65 assists per ES goal" hold only at the intermediate step until a final-output check proves them.
8. **Label every finding's reach: live, conditional, dormant or research.** Several Fable P0s rest on a serving flag (Start Chart, native path), a dated table state (empty market or projection tables) or code that is imported but never rendered (game-page Poisson). A dated observation is not a permanent state, and a zero-row table does not prove a path never ran.
9. **One estimand per comparison.** Conditional (if he plays/starts) against unconditional, appearance against credited start, team goalie slot against an individual goalie, regulation against full game: score like with like, and never publish cross-basis skill as comparable (decision 41).
10. **An issued forecast is not a reconstruction.** Pregame evidence needs publication before the frozen start, receipt cutoffs and payload cutoffs. `.lt(date)` proves a date filter, not knowledge time for backfilled rows (W1-7 C4, W1-10 R2).
11. **Proposed tests must be valid statistics.** Astra rejected many Fable tests: exactly 300 skater-minutes, every goalie tier non-empty, a ±0.02 sample-mean pass rule (about one standard error), "one game can't beat a 20% higher projection", "<5% of scores outside 5–95", "percentile moves by more than 30", "a calibrated forecast passes at any n". Replace them with algebraic identities on frozen fixtures plus held-out calibration with stated uncertainty.
12. **Fable's suggested coefficients are hypotheses.** Examples: the `tier − 2` PK edge and ±5%, k values, the 50 + 16.7z bar mapping, `min(18000, n × 1200)`, and a 22% OT-loss share. Fit and validate them, or label them as presentation choices.

## Batch A items that Batch B/C confirms, contradicts or extends

| Batch A item | What Batch B/C adds | Effect |
|---|---|---|
| W1-3 D3: FORGE evidence weight reads per-game TOI | W1-6 M-FRG-046 confirms it. Astra W1-6 PR5: only the TOI component is mis-scaled, because the shots term already accumulates (100 shots at 1,200 s against 120,000 s gives .6211 against .8653). | **Extends.** Fable's "a 500-game veteran is regressed like a second-year player" is not universal. Batch A's withdrawn call-up test stays withdrawn. |
| W1-3 D1: 60× seconds/minutes fallback | The same unit error recurs in other code paths: sustainability band collectors (W1-9 D1), NST team xGA per 60 (W1-6 M-FRG-025, 60× low), WGO `n <= 60 → ×60` in two normalizers (W1-7 M-FRG-063), and actual TOI ≤ 80 read as minutes in the accuracy job (W1-7 M-FRG-080). | **Extends.** Fix each path; one shared unit-contract test pattern. |
| W1-5: maximum TOI does not identify the credited starter | Further readers: FORGE `goalie-queries.ts:113-123` (all 2,699 `toi_seconds` null, so the first row wins), the dormant season model `season.py:532-555` (W1-8 PR-P8), game-prediction workload "start = TOI ≥ 1,200 s" (W1-10 M-GPR-038). | **Extends** the fix-every-reader list. |
| W1-5: accuracy outcome `actualRow ? 1 : 0` | W1-6 M-FRG-016 and W1-7 M-FRG-085 confirm. Astra narrows it: the `_30d` probability gates use one day's accumulators and an empty Brier subgate passes, but saves/GA MAE read `rolling_30d` and empty interval coverage fails. | **Confirms**, with a narrower gate claim. |
| W1-5: team-goalie mixture stored under one goalie's id | Confirmed in the stage (W1-6 D2), the goalies API (W1-6 M-FRG-011, W1-7 M-FRG-094) and the RSO bridge (W1-11 M-RSO-017). Astra W1-6: unconditional lines also need relief mass. | **Confirms**; decision 25 settles the contract. |
| W1-5: three-candidate vector sums above 1 | The Start Chart mixture zeroes the whole team when rounded inputs sum to 1.0001 (W1-7 M-FRG-092, conditional on serving). | **Extends.** |
| W1-5 / W1-2: fixed .900 GSAA comparator | More readers: the FORGE opponent-goalie adjustment (W1-6 M-FRG-044, the largest single goal lever), goalie evidence residuals and tiers (M-FRG-031/033), the accuracy goalie baseline (W1-7 M-FRG-080). | **Extends**; decision 10. |
| W1-4 D5: Game Grid odds, fix or withhold | W1-10 D2 benchmarks them (log loss .683 against de-vigged market .642; mean home probability .500). W1-12 M-FSC-021 shows a 0.75 back-to-back multiplier on them feeds the Week Score bonus. W1-6 M-FRG-004: book odds averaged without de-vig (path currently idle). | **Confirms** and widens the readers. |
| W1-4 D3: PP/PK tiers from one game | W1-9 D10: the sustainability opponent-PK factor reads that tier, with the wrong scale and direction. | **Extends** (unserved reader); decision 20. |
| W1-4: slate-only ratings and null-to-zero | Readers: the placeholder game model's logit (W1-10 D5), the Team Power Terminal (W1-7 M-FRG-074), the slate-relative defence grade (W1-7 M-FRG-096, W1-10 M-GPR-030). | **Extends**; decisions 19, 58. |
| W1-1: isotonic tie defect and non-converging L2 trainer | W1-10 M-GPR-018 inherits the isotonic defect. W1-10 M-GPR-025 uses the same trainer; Astra says that is not proof of non-convergence on game data. | **Extends**, qualified. |
| W1-1: leaky champion and FORGE | Astra W1-6 PR5: FORGE's model-version resolver returns null with the absent env overrides, so no route to the leaky champion is established. W1-8 M-PFC-004: dormant v5 GSAx inherits leaky goalie xG and its on-ice xG query has no empty-net exclusion. | **Confirms** the Batch A qualification. |
| W1-2: PDO 1.0 against 100 is a unit-adapter issue | W1-6 M-FRG-043: the PDO adapter is discontinuous at 1. Astra: PDO is not in the goal multiplier, so its live effect is mostly cancelled. W1-9 D9: the PDO band is pinned to 1.0 by a prior in the wrong units. | **Extends.** |
| W1-2 D8: penalty-expiry TOI | W1-6 M-FRG-058: shift segments hold the last event's state, so a power play runs past its expiry, and events and shifts use two strength classifiers. | **Extends.** |
| W1-3 / decision 17: expected shooting % | W1-9 D12: the legacy `/charts` routes use ixG/shots (recent and career), labelled "XG Per Sixty". | **Extends.** |
| W1-3 / decision 23: results luck | W1-9 M-SUS-012: finishing residuals mix 5v5 goals with all-situation ixG; the Python version uses (G − ixG)/shots. | **Extends** (no live reader). |
| W1-3 / decision 16: team of record by date | Current-team violations: pickup GP% (W1-12 M-FSC-039), Yahoo historical points and goalie credits (W1-12 R2), legacy NST date-window stats (W1-9 M-SUS-041), counterfactual PP history (W1-6 M-FRG-012). | **Extends.** |
| Batch A rule 5: unknowns stay unknown | Violations found in B/C: no-line players as known zeros (W1-11 D2), missing category values scored as average (W1-12 R1), Yahoo history false zeros (W1-12 R2), an all-missing sustainability score shown as 50 and "ready" (W1-9 A2), partial recent-form rows (W1-10 R3), zero-shot history treated as missing (W1-6 PR8), null fantasy points ranked as 0 (W1-6 M-FRG-010), undefined ratios as 0 (W1-8 PR-P10). | **Confirms** the rule is needed; see the cross-packet map. |
| W1-5: Start Chart serving is conditional | W1-7 M-FRG-092, W1-10 M-GPR-030 and W1-12 M-FSC-014 all depend on the same unverified serving branch. | **Confirms**: these stay conditional. |
| W1-3: rolling/FORGE runs held on `nst_persistence_unconfirmed` | W1-11 D2: FORGE lineups have been frozen since the 2026-11-09 run, inflating the no-line count. | **Confirms**: reconcile writes before any retry. |

---

## W1-6 · FORGE projections, part 1 ([audit](audits/forge-projections-part1.md), [Astra](W1-Astra-PR/forge-projections-part1.md))

**A. Astra-only defects**
- **The season bootstrap changes the line after reconciliation** (`skater-stage.ts:2811-2821`; `seasonBootstrap.ts:94-125`). A 2 ES + 1 PP shot line with a 6-shot prior at 10 games becomes **3.857** shots, with an effective history share of .2/(.5 + .2). So "team volume pinned" and "rest and context cancel exactly" are not unconditional. Conditional on bootstrap being active (it was off on Fable's traced row).
  - Fix: reconcile the final serialized heads, or bootstrap before final reconciliation. Test final outputs with mixed bootstrap participation, binding role caps and fallback targets.
- **Known zero-shot history loses its exposure** (P1, `skater-adjustments.ts:643-645`). Hours are rebuilt as shots/rate only when both are positive, so `(0, 0)` returns 6.62 shots/60, the same as `(null, null)`. A supported zero rate can't regress by its real exposure.
  - Fix: pass matched accumulated seconds. Test zero shots at increasing exposure (the posterior must fall toward zero). Check the reserve reader (`reserveProjections.ts:67-72`) too.
- **Explicit null p10/p90 become a covered zero-width interval** (P1 evaluation, conditional; `fantasy-projections/settlement.ts:4-6,57-62`). `Number(null) = 0`, so `{actual 0, p10 null, p90 null}` scores `interval80Covered: true`, width 0.
  - Fix: reject null, empty and non-finite endpoints before conversion; require ordered bounds.

**B. Corrections**
- **D1 (skater totals):** ES+PP omits the explicit **PK bucket**, not all extra-attacker or empty-net production. `situation.ts:27-54` adjusts for pulled goalies, so 6v5 events are already ES; a short-handed empty-net goal sits in PK; overtime can be any state. Adding an EN component on top of ES+PP can double count. Decision 7 governs xG and GSAx, not the removal of credited fantasy goals. Fable's ±1% and ±2% tests are candidate acceptance criteria, not laws.
- **D4 (physical exposure):** 18,000 skater-seconds is a nominal regulation budget (two minutes at 4v5 already gives 298 minutes). Derive ES/PP/PK/extra-attacker seconds from manpower and apply physical rates once. The "exactly 300 minutes" test is invalid.
- **D2/D9/D12 (goalie populations):**
  - Candidate metadata already exists (`goalie-stage.ts:620-632,787-800`).
  - Unconditional ≠ conditional × P(start): counts need P(start)·E[Y|start] + P(relief)·E[Y|relief], or an explicit zero-relief assumption (`goalieOutcomes.ts:201-260`). Start-only credited wins normally sum below team win.
  - The 15-against-24 saves sample is not a direct test of an individual conditional line.
  - Reconcile opposing skater goals **net of empty-net goals** with the aggregate goalie GA of that team-game, not with one named starter.
- **D3 (opponent goalie):** "Read FORGE's own modelled save %" is circular, because skater goals are computed before the goalie stage and feed it (`run-forge-projections.ts:1035-1050`). Extract a shared, independently estimated goalie-quality input. Keep NST GSAA as the descriptive column (decision 10) and give any shrunk predictive feature its own name.
- **D5 (sample weight):** only the TOI component is mis-scaled (see the Batch A table). Refit scale, scope, thresholds and the second conversion shrink together. Two shrinks are not invalid in themselves.
- **D6 (context inputs):** the NST unit error is reproduced (3 xGA in 3,600 s gives 0.05). PDO is absent from the goal multiplier (`skater-adjustments.ts:288`); it enters shots and assists, which mostly cancel or go unused on the lineup path. Don't attribute the goal range to PDO.
- **D8 (goalie shots-against context):** a zero-mean ±0.5% rule isn't required; a fitted baseline may legitimately be non-zero.
- **D13 (home ice):** home already enters through the skater goal multipliers (`skater-adjustments.ts:388,401`), and `goalie-stage.ts:382` prefers de-vigged market odds when present. Fit only a residual home term for the non-market branch. Decision 1 is about the separate game model.
- **D14 (assist allocation):** TOI-only allocation is a simplification; the quintile bias is not shown to be its cause. Drop the ±5% gate.
- **D23 (goalie tiers): rejected.** ELITE is reachable: league .8924, 1,900 shots and 95 GA give .9063, ELITE. "Every tier non-empty" is not a valid test.
- **D28 / M-FRG-017:** fixed-baseline decile bins and RMSE already exist (`forge-counterfactual-backtest.ts:348-357`; `promotionGates.ts:127-145`). The null-actual coercion, latest-team PP history and PP over-allocation remain.
- **D10 (accuracy gates):** see the Batch A table; not "every 30-day gate passes empty".
- **D16 (ranks):** null-as-0 is reproduced (`[120, null, −4]` ranks `[1, 2, 3]`). Equal ranks against a tie-break is a stated rank policy, not a correctness rule.
- **D24 (horizon):** 1 − ∏(1 − p) is an independence formula for "at least one", not a universal substitute.
- **D4b (spread sign):** confirmed (code +2.30, correct −0.70). The edge is in goal-margin units, not a cover probability.
- Fable's 13 sound / 29 mis-specified / 16 wrong / 2 undetermined is its own classification, not an independent count.

**C. Superseded remedies**
- Question 1 / D1 → **decision 24**: all-situation totals (ES + PP + PK + extra-attacker), empty-net goals in their own named bucket. Read with Astra's caution: build mutually exclusive strength × net-state × regulation/OT buckets so EN isn't counted twice. TOI split → **decision 59**.
- Question 4 / D2 → **decision 25**: one row per candidate (if-he-starts line, start probability, unconditional product), the goalie's own Win plus a separate team win %, and the slot rescale removed. Relief treatment still needs stating (see open decisions).
- Question 3 / M-FRG-056 → **decision 26**: the trend band regresses toward the band, fitted before use.
- Question 5 → **decision 27**: opponent and venue change team shot volume through fitted terms.
- Question 6 / D24 → **decision 28**: keep and fix the multi-game horizon; never multiply a probability by a horizon scalar; fix the zero-rest branch, goalie opponent averaging and game-type filter.
- Question 2 / D25 → **decision 60**: keep legacy rest buckets; backtest the newer tiers against the current model and a no-rest baseline after full reconciliation.
- D3 comparator → **decision 10**. D12 ledger basis → **decision 41**. D17/D18/D4b market items → **decision 30** (they block resuming odds ingestion). D20 legacy Game Grid odds → the W1-4 direction (fix or withhold, never the placeholder).

**D. Enhancements**
- A shared, independently estimated goalie-quality input used by both the skater and goalie stages.
- One non-overlapping situation-accounting module (strength × net state × regulation/OT, shootout excluded) feeding every total.
- A saved ledger/run extract with issuance and cutoff identity, so the ledger biases can be reproduced.

**E. Evidence status**
- Reproduced (Astra, actual functions): `1560` is ES for both sides while the shift classifier differs; the yes-only de-vig discontinuity (+2300 → .0017, +2400 → .0370); ELITE reachable; bootstrap 3 → 3.857 shots; evidence weights .6211/.8653; null ranks; null interval scored as covered; PP allocation 1,400 against a 1,200 target; NST 3/3600 → .05; zero-shot = missing (6.62); spread −0.70. Nine Vitest files, 162 tests pass.
- Reported only: every ledger bias (FP −5.5%, shots −6.1%, goals −9.0%, assists −10.8%, blocks +12.5%, hits +4.0%), the 2,699 null-TOI rows, the November GSAA distribution (40% at the clamp), the trace-game numbers, the 42-team-game context range and the 114-start goalie sample.

## W1-7 · FORGE projections, part 2 ([audit](audits/forge-projections-part2.md), [Astra](W1-Astra-PR/forge-projections-part2.md))

**A. Astra-only defects**
- **Candidate intervals can describe the pre-bootstrap mean** (P1, conditional on candidate scenario mode plus an active bootstrap). The stage passes the bootstrapped point line but the *old* scenario goal/assist lines (`skater-stage.ts:2837-2862`), and the simulator prefers scenario values (`uncertainty.ts:265-284,323-328`). Final G and A means of 1 give bands `[0,1,2]`; a stale weight-1 scenario at 0.1 gives G `[0,0,1]`, A `[0,0,0]`.
  - Fix: apply the bootstrap to each scenario, or rebuild the distribution around the final line. Keep candidate mode gated until evaluated.
- **A zero own-goal mean collapses a positive assist distribution** (P1 boundary; `uncertainty.ts:362-369`). 1 expected ES assist with 0 own goals gives A `[0,0,0]`; own goals 0.001 gives `[0,1,2]`. The assist model uses on-ice team goals, not the player's own goals.
- **Dispersion-fit correction** (P2 offline; `fit-forge-dispersion.ts:58-74`). `n/(n − 1)` is not unbiased for unequal exposures: 20 games at exposures 1 and 3 with true zero over-dispersion give an excess of −0.526.
- **Residual TOI variance compounds** (P2; `uncertainty.ts:762-771`). Target quadratic coefficient .0247 against .02483 actual. Small; can't explain the goalie coverage gap.
- **The WGO seconds-as-minutes normalizer has a second, actually used copy** (`queries/skater-queries.ts:142-147,529-532`). D8 must fix both.

**B. Corrections**
- **p10/p90 coverage above 80% is a property of discrete quantiles.** Poisson 0.17 has correct quantiles `[0,0,1]` and inclusive coverage .987. The 91–96% skater hit rates prove neither miscalibration nor calibration; compare each issued CDF with its own outcome (randomised PIT, proper scores).
- **Don't replace the simulator with one NB distribution.** It is a mixture over scenarios and TOI. Identical complete inputs are already deterministic (seeded). `samplePoisson` uses a normal approximation at means ≥ 30.
- **Goalie coverage 47/66:** about 2.03 SE, not 1.8; Wilson interval [.594, .807]. Still only an alarm (dependent rows, mismatched population).
- **M-FRG-067:** "no over-dispersion" is literally false; the team total is Poisson given random TOI.
- **D7 pool guard: remedy rejected.** `min(18000, n × 1200)` lets one player reach 4,517 s, past the 2,100 s cap; `18000 × n/18` gives 14,000, contradicting Fable's own "≥ 16,000" test. Use a completeness gate or a constrained allocator with explicit infeasibility.
- **D2 roster tweets:** reachable only when the review route publishes matching events (`tweet-pattern-review.ts:1084-1102`); frequency is unknown. A zero multiplier omits the row (`skater-stage.ts:2351`). A Monday 23:00 UTC scratch expires Wednesday 05:00, and the date-only reader applies it Wednesday. `SCRATCH` already yields a confidence-dependent multiplier, so renaming alone fails. **Conditional, not a live P0, until the event count is known.**
- **D3 Team Power Terminal:** the 50 + 16.7z bar mapping is an arbitrary presentation choice; a synthetic three-point sparkline must not pass as history.
- **D4:** the one-row case already skips normalization (`goalies.ts:172`).
- **D6 spread:** fixture P(home wins by 2+) = .3808; the mirrored case gives .6192, not "near .38" again. A flag needs the de-vigged price; don't add EN/OT goals already in the means.
- **D9:** a pure rounding envelope is about n × .00005; .975 + .0205 + .01 = 1.0055 is not roundoff. Don't normalise unknown mass into certainty.
- **D10:** goalie SA equals opponent SOG only "at a goalie"; empty-net SOG and relief break the equality; ±1% isn't an invariant.
- **D12:** PK need not be positive in every game. **D13:** the components take absolute values, so they can't sum to signed error. **D15:** these are model proposals; compute mode's 0/1 availability is deliberate. **D17:** MAE and skill scores are unbounded; drop the "bounded" test.
- **M-FRG-083 withdrawn:** the Start Chart query and selector enforce horizon 1 (`start-chart.ts:887,940`).
- **M-FRG-092 back-to-back ×0.65:** the lost mass is kept as unresolved by design; don't redistribute it.
- **M-FRG-103/104/106/109/110:** the 1.65/1.91 and shots × rate identities hold at the intermediate step only (rule 7).
- FORGE v2 accountability on raw means is legitimate research if labelled as such.

**C. Superseded remedies**
- Question 1 / D5 → **decision 29**: "typical range" with real coverage shown; quantiles from the exact distribution, not 400 draws; PIT and interval score per stat. Astra's caution applies: "exact" must preserve the scenario and TOI mixture, not collapse to one NB.
- Question 2 / D6 → **decision 30**: odds ingestion returns after the fixes. D6 stays P1 and must land first.
- Question 3 / D2 → **decision 31**: show the "if he plays" line labelled scratched, 0 expected for that slate; scratches scoped to a game id; injuries end with a RETURN event.
- Question 4 / D12 → **decision 59**: split ES, PP, PK (`proj_toi_pk_seconds`), mutually exclusive and reconciling to total TOI.
- Question 5 / D3 → **decision 58**: the 100-centred rating on a diverging bar; risers by actual change; real history or "unavailable".
- D1 → decisions 24 and 59. D4 → decision 25. D16 → decision 28.

**D. Enhancements**
- Evaluate the existing opt-in joint goalie counts (`jointGoalieCounts`, binomial GA given SA; `uncertainty.ts:588-624`), not passed by the stage today (`goalie-stage.ts:738-749`).
- Store each issued distribution per row so coverage can be scored against what was actually served.
- One role-tier map shared by the stage and the accuracy route (D14).

**E. Evidence status**
- Reproduced (Astra): Poisson .17 coverage .987; deterministic bands for identical inputs; N1 and N2 band collapses; the N3 counterexample; N4 coefficients; pool guard 18,000 / 7,809 / 1,800; .6001/.3001/.0999 → all zero; 45 s → 2,700 in both normalizers; the scratch translator; regulation cover .3808. Nine Vitest files, 100 tests pass.
- Reported only: the coverage sample (1,835 skater-games, 66 goalie rows), the 12-row goalie run, 152 game predictions, empty market tables, 141 of 152 games flagging the underdog, and the 18,000 against 17,800 skater-seconds estimate.

## W1-8 · Player forecasts and season models ([audit](audits/player-forecasts-season-part1.md), [Astra](W1-Astra-PR/player-forecasts-season.md))

Both reviewers agree: **no currently served P0** in this packet. The live parts are the ledger scoring behind `/api/v1/forge/scoreboard`, the game-expectation view and the deployed runtime-feature RPC; v4, v5 and the native path are dormant on the dated snapshot.

**A. Astra-only defects**
- **The dormant season model picks goalie starts by maximum TOI** (P1 before activation; `season.py:532-536,548-555`). The longest-playing goalie is the "starter", W/L/OTL come from the team result and SO from GA = 0 with ≥ 59 minutes. A starter pulled after 10 minutes and a 50-minute reliever are swapped, which can select a reliever. Add this file to Batch A's W1-5 fix-every-reader inventory. (The native labeller `nativeGoalieOutcomes.ts` is sound.)
- **Reported coverage is not the coverage of the emitted interval** (`advanced.py:923-941` against `:1997-2017`). The gate scores randomised residual-boundary coverage; the bundle emits deterministic p10/p90. All-zero fixture: expected .80, observed randomised .77, inclusive 1.0, eligible for serving.
- **Undefined ratios become 0** (`season.py:3943-3958,4060-4068`): `_reconcile({}, 'goalie')` returns SV% 0, GAA 0, Win% 0. The advanced builder only creates player-games from contributing rows, so missing games can vanish while observed ones keep initialized zeros (`advanced.py:1030-1282`). `restOfSeason.ts:43-45,63` accepts NaN participation and defaults missing actuals to 0.
- **The v5 on-ice xG query has no empty-net exclusion** (`advanced.py:104-106`; decision 7).
- The runtime-feature RPC uses started-before-cutoff, not completed-before-cutoff (`20260805003121_…context_rates.sql:131-134`).

**B. Corrections**
- **Gates can fail.** v4 blocks on missing support, loss regression, calibration failure and rookie validation (`advanced.py:451-463`); v5 needs ≥ 100 rows and 20 entities and checks observed coverage (`:900,975,1507-1526`). What is circular is the selected-model non-inferiority and the expected calibration on reused rows. The "halve the intervals" test must recompute coverage.
- **The lockbox was already designated consumed** by the v4 and v5 contracts (`research-contract-v4-season-fantasy.json:159-163`; v5 `:129-140`). This is not a new violation.
- **Copula:** a loading of 0.65 gives a primitive correlation of **0.65² = 0.4225**. Reconciliation on every draw makes derived quantiles depend on it (points p10–p90 width 6.03 against 4.46 at loading 0). Fable's "±0.11 SD" is about one standard error.
- **Native goalie means are coherent.** Per-appearance rates (relief included) × appearance probability is the law of total expectation: (2/5) × (5/10) = 0.2. Switching to start probability needs start-conditional means plus a relief term. The 146-start experiment conditions on actual future shots and uses a `naive_season` proxy, so it is a save-rate diagnostic, not a forecast backtest. A slope of .043 is not "4% signal". Fable's "both within ±.010" test is unjustified without shots, prior and baseline.
- **D1 (native skater means):** the prior path captures at most 20 games here, not 82. Kish effective n 14.88 is confirmed. In `(Σw·x + k·prior)/(Σw + k)`, k is in weight units. The first game does move the estimate: test a bounded update, not "no jump".
- **C17:** the ~90% figure holds only in the residual-dominated normal case (.8995). With participation below 1, "mean ± residual" is not enough; carry the DNP atom.
- **D5:** the 30-goal ±7 / ±11 example is hypothetical; the exact form is Var(ΣY) = ΣVar + 2ΣCov. Opposite-endpoint ratio intervals are not always too wide (a zero denominator understates the upper tail).
- **D6 (ledger):** goalie naive controls do multiply by an empirical start share; binary W/SO/start are scored on settled rows, not dressed-only.
- **M-PFC-024:** the 300-minute issuer is a separately named fixed policy (`servingActivation=false`), not a mis-served selection. Adding 300 to the grid doesn't make it win.
- **M-PFC-020/023:** TOI exposure for goalie rates and one shared 180-minute strength prior are not mathematical defects.
- **D9 (quality start):** the "under-counts by 18%" direction holds for that .8926-league sample only; it skipped the 59-minute gate and used WGO starts where the producer uses max-TOI starts. 30/33 = .909 is a QS only if league SV% is below .909.
- **D8 window:** up to 20 games in 60 days with one in the last 14, not 6–8 games in 14 days.
- M-PFC-047 (venue multiplier on both teams is reasonable), 053 ("about double" not universal; percentiles are scale-invariant), 059 ("70% shrink" not established), 060 (conditional NHLe estimand) and 021 (convergence unverified) are narrowed.
- Serving: without a catalog head the alternatives are `legacy`, `legacy_flagged` or `empty`; a zero row count doesn't prove "never imported".

**C. Superseded remedies**
- Questions 1–2 / D1 → **decision 38**: evaluate and complete the native path, unserved until held-out checks pass.
- Question 3 / D2 → **decision 38**: Fable's "wins = team win × start probability" is replaced ("don't assume team win alone is a goalie's win probability"; no assumed shrinkage constant).
- Question 4 / D3 → **decision 39**: lockbox consumed; label intervals uncalibrated; collect prospective 2026-27 frozen forecasts.
- Question 5 / D9 → **decision 40**: Vollman's QS everywhere it is labelled QS, credited starter only.
- Question 6 / D6 → **decision 41**: score each forecast on its declared basis; persist participation probability and basis.

**D. Enhancements**
- Separate fit/select, calibrate and report stages with versioned artifacts; a real per-target source-coverage denominator in place of the constant 1.0.
- State the bootstrap estimand (equal-slate against player-game weighted) in `daily_board.py:102-114` and `model.py:107-135`.

**E. Evidence status**
- Reproduced (Astra, extracted Python functions): Kish n 14.88; C17 coverage .8995; copula widths 6.03/4.46; the `_fit_rate_policy` all-zero fixture; `_reconcile` zeros; the appearance algebra.
- Reported only: the zero-row tables, the 10,956-row ledger, the 2,215-skater-game RMSE table, the 146 goalie starts and the 482-start QS sample.
- **Read-hygiene breach (disclosed by Fable):** one whole-table jsonb read of `player_forecast_source_observations` (71 MB). Not repeated; record it in the fix plan's data-access log.

## W1-9 · Sustainability ([audit](audits/sustainability-part1.md), [Astra](W1-Astra-PR/sustainability-part1.md))

**A. Astra-only defects**
- **Named windows expand backward** (P1; `bandCalculator.ts:190-326,530,573,614`; `bandService.ts:98-140` fetches 40 games). Collectors drop zero-trial rows *before* taking the first N, so older games fill an L3/L5. Fixture: three newest 0-shot games plus three older 1-for-1 games give an L3 SH% band with EWMA 1.0.
  - Fix: choose the N games first; zero-opportunity games stay members with zero trials. Test suffix invariance.
- **An all-missing score reads as neutral and ready** (P1; `score.ts:209-265`; `guardrails.ts:73-135`; `trends.ts:210-237`). No inputs give `s_raw` 0, `s_100` 50, eight warnings, `guardrailState: "ok"`, and the dashboard marks it ready.
- **NST TOI present ≠ metric present** (P1; `score.ts:96-112`). `nst_ixg: null` with TOI becomes ixG/60 = 0 over the shared denominator.
- **IPP league prior mixes coverage** (P1; `priors.ts:93-105,248-261`). The fixture gives a league IPP of 1.0 where the window rule gives 0.5. `betaPosterior` accepts s > n: beta −16, mean 1.8.
- **As-of leaks beyond the season totals** (P1). `rebuild-baselines.ts:248-256` fetches games with no date bound, so historical L5/L10/L20 baselines can include games after the snapshot. League priors and skill references read the current season (`priors.ts:54-105,399-468`; `score.ts:23-40`). "Current season excluded by construction" is true only for the player-history count term.
- **Normal-band uncertainty is manufactured** (P1; `bandCalculator.ts:608-650`). One PP-share observation of 1.0 with prior .5 and strength 15 gives [.518, .544], z 3.13, from the 1e-4 variance floor. Kish n doesn't fix this.
- **Prior overrides escape the config hash** (P2, conditional; `rebuild-priors.ts:47-50,84-95`).
- **FORGE reads the band with the same own-value-against-own-interval test** (`skater-queries.ts:643-694`; `trend-adjustments.ts:69-109`). A genuinely doubled shot rate and a 60×-corrupt row both return neutral multipliers. So D1/D4 do **not** currently bias FORGE, and a redesigned band will switch on FORGE adjustments that are inert today; validate them together (decision 26).

**B. Corrections**
- **D1 test is wrong:** stored exposure is *discounted* minutes (69.5 against 90 raw in the fixture). Don't "skip" a missing-NST game and let A1 pull in an older one. Corrupt fixture: EWMA 0.61, z −20.96.
- **D2 is narrower than "never fires" and "constant":** the beta point value and interval use different priors (+0.5/+0.5), and the gamma prior adds 1e-3. Five 0-for-4 games against a zero baseline read **cold** (percentile 9.5) while observed equals baseline. The percentile is exactly 50 only for the normal band. Drop the ">30 percentile" test.
- **D3/D5:** 33.75 and .0827 reproduced; three PDO seasons give a 3-year 0.0123. The saved `numer`/`denom` are independently zero-filled and partly overwritten, so they can't be pooled as-is; rebuild from matched components.
- **D4/D11:** 21.5% at 15 GP and 60% at 82 GP assume equal exposure per game and two 82-game prior seasons; the fourth fetched season has zero weight. Decision 18 is about calendar windows and does **not** settle last-N windows crossing the season boundary.
- **D6/D7:** the badge and API already describe a "process-support index" (`SustainabilityBadge.tsx:18-25`; `entitySurfaceServer.ts:664-670`). Luck-z SD .90–1.06 is not calibration; the partial correlations are exploratory (overlapping dates, coupling of X with Y − X); a percentile of |pressure| is an extremeness rank. Drop "< 5% outside 5–95": seven unit z's at these weights have variance 4.9.
- **D8:** exact text is "ExtremeThreshold is running above baseline by 5.00 standard deviations"; `read.ts:29-37` also calls raw z "impact".
- **D9:** the PDO spec is at `bands.ts:191-198`. Ten PDO-1.08 games give 1.0018. A shot-weighted PDO mean is not the pooled-component PDO (1.05 against 1.099 in Astra's example).
- **D10:** 15-GP multipliers 1.0176 / 1.0164 / 1.0152 reproduced; "full weight" is asymptotic. The `tier − 2` ±5% fix is a hypothesis. The feature is reachable through an admin recompute route.
- **D12:** the legacy career route needs decision 17 too, and NST identity is matched by name.
- **D13:** finalise only after a verified complete manifest, not when the last slice returns. The leaderboard payload doesn't emit a quintile field at all (`read.ts:248-267`).
- Smaller: rookie z +3.30%; the "28% cap" assumes about 18 min/game; count quantiles are normal approximations (p90 .505 at mean 0.1 where the exact value is 0); Python 8-digit seasons make players rookies only conditionally; rounded Python scores can differ by 1; the debug page's 97% "hot" needs PDO = 1, not all zeros.

**C. Superseded remedies**
- Question 1 / D7 → **decision 32**: don't preserve the blended formula; evidence-based inputs, tested out of sample; luck is one component. Fable's luck-only proposal is superseded too.
- Question 2 / D2 → **decision 33**: a player-specific expected range for a window of this size; hot/cold when outside it; supportedness judged separately.
- Question 3 / D4 → **decision 34**: only pre-window information; rookies get a position-informed prior. Read it as also covering A5 (league priors and skill references need an as-of version).
- Question 4 / D6 → **decision 35**: rename the lists; "Trust These Risers" becomes a separate feature to define and validate.
- Question 6 / D10 → **decision 37**: projections stay unserved, tracked as open work (fix the PK direction and scale first).
- Question 7 → **decision 36**: bounded rebuild of trend-band history after the 60× fix, as its own approved step.
- D12 xS% → **decision 17**. M-SUS-012 finishing residuals → **decision 23**. FORGE's use of the band → **decision 26**.
- Question 5 / D11 (window at season start) is **not** superseded; see open decisions.

**D. Enhancements**
- One component-coverage contract carried through producer, guard, trends feed, player API, leaderboard and Sandbox.
- Cutoff-keyed (as-of) prior and reference versions.
- A held-out evaluation design: paired, clustered by player and date, with abstention reported.

**E. Evidence status**
- Reproduced (Astra): D1 fixture; D2 boundary case; D3 33.75 and .0827; PDO 3-year .0123; D8 text; D9 1.0018; D10 multipliers; A1–A4 and A6; rookie +3.30%. Eleven Vitest files, 103 tests pass.
- Reported only: the eight-date, 272-player band counts (445 row-days), the l10 score distribution, the predictive correlations, the empty projection and snapshot tables, catalog states and the league-prior means.

## W1-10 · Game predictions and odds ([audit](audits/game-predictions-odds.md), [Astra](W1-Astra-PR/game-predictions-odds.md))

**A. Astra-only defects**
- **The default backtest leaks same-start-time results** (P1; `accountability.ts:2998-3015,3796,4060-4077`). In the non-blind replay each outcome is added to training at once and the model retrains every game, so a game that starts at the same time as another learns its result. Offline counterfactual: changing one game's result moved a simultaneous game's prediction from **33% to 67%** (0.333998 → 0.666002). The explicit `trainStartDate` + `blindDate` branch is clean (`:3923-3942`). M-GPR-005 is not sound.
  - Fix: split and retrain at slate boundaries; one artifact for all simultaneous forecasts. Test: flipping a simultaneous or later outcome leaves earlier-cutoff predictions unchanged.
- **"Final pregame issuance" doesn't prove publication before the game** (P1). `finalPregamePredictions` uses `prediction_cutoff_at ?? computed_at` (`accountability.ts:1385-1402`), so a forecast computed after the game but stamped with an earlier cutoff is accepted; a missing start time accepts everything. Persisted payload validation ignores the cutoff (`:3107-3153`). Goalie and line rows use end-of-day, not the cutoff (`featureBuilder.ts:2764,2905-2922`). **Don't fix D7 by copying this helper unchanged.**
- **Partial recent-form rows become fabricated rates** (P1; `featureBuilder.ts:907-970`). A missing-count game halves 4 GF/game to 2 and 2 xGA/60 to 1; a missing xGA makes xGF share 1.0. This feeds the served-weight recent-5/10 goal differential and recent-10 xGF%.
- **Odds bars can pair two sportsbooks** (P2; `GamePreview.tsx:93-99,211-226`; `stats/game/[gameId].tsx:175-196`). GamePreview is the rendered pregame surface.
- **The forecast route always drops the current lineup** (P2; `forecast.ts:59-78`; `featureBuilder.ts:2762,2834-2838,1646-1654`), costing a 0.06 dampening penalty.
- **Poisson boundaries** (P2): negative or NaN λ gives P(0) = 1; the heat-map tie helper returns NaN when both λ are 0 (`poissonHelpers.ts:45-58`).
- Completed-season game reads are unpaginated too (`accountability.ts:2595-2604`). Promoting a different version makes the cron refuse to persist, because serving checks the compiled identity (`workflow.ts:836-842,914-916`).

**B. Corrections**
- **D3 game-page Poisson is dormant, not a live P0.** `PoissonDistributionChart` is imported but never rendered (`pages/game/[gameId].tsx:8`; `chartData` unused). "Three draw conventions are live" is false. The pregame surface is GamePreview; the Game Grid heat map is wired. Conditioning on non-draw outcomes is not an arithmetic error; presenting it as full-game win probability without an OT rule is.
- **D1 "silent" is narrowed.** Health already emits `production_model_missing` and `missing_predictions` (`adminHealth.ts:468-483`; `workflow.ts:1497-1502`; tested). What is true: the forecast cron records `success` for an intentional skip (`forecast.ts:86-94`). Whether anyone receives the alerts is unverified. The null public calibration summary (C25) is confirmed separately.
- The 85-game market comparison uses the last pre-start snapshot (about 3.1 h before), not a verified close. Game Grid rows were overwritten after games, so their scores are a retrospective diagnostic.
- 0.0043 log loss on 369 games: uncertainty was not computed; that is not the same as "no skill".
- v1 against v2: an ablation is needed before blaming normalisation.
- **D8 test is wrong:** a truly calibrated forecaster can fail a fixed max-gap rule by chance.
- **D6:** removing dampening is a candidate to validate; two teams' stale tables can be two real uncertainties. "Weight zero" ≠ no effect (missingness and dampening still act).
- **D9:** six converters including `devig.ts`, no seventh. An unsigned "150" is ambiguous without a declared input format.
- Home > 50% for identical teams is a fitted behaviour, not an identity.
- M-GPR-002 downgraded (R2); 011 upgraded to wrong under partial support (R3); 009 conditional on final state; 037 dormant by caller search (17 tests pass); ExtraTrees and linear-factor wording narrowed.

**C. Superseded remedies**
- Question 1 / D1 → **decision 42**: a "FHFH predictions unavailable" notice; the cron reports an explicit non-success or skipped state.
- Question 5 → **decision 42**: a separately labelled de-vigged market probability only from a current, authorised source.
- Question 4 / D4 → **decision 43**: drop the 0.52 rule; pick follows displayed probability; tie at exactly 50%.
- Question 2 / D3 → **decision 44**: verify reachability first (Astra did: not rendered); keep unserved until grounded in a qualified model.
- Question 3 → **decision 45**: one shared OT rule; 50/50 labelled as an approximation until a fitted split beats it on time-ordered holdout.
- D5 replacement spec → **decision 1** (benchmarks: home rate, Elo, de-vigged market; fitted home-ice term).
- D2 Game Grid → the W1-4 direction: fix or withhold, never the placeholder.

**D. Enhancements**
- An Elo benchmark (none exists in the repo).
- A promoted-model artifact holding feature order, scaling, weights, intercept, calibrator, clipping and quality policy, cutoff policy, version and training manifest, plus a replay test that rebuilds a stored prediction exactly.
- One typed odds module that also enforces same-book pairing.

**E. Evidence status**
- Reproduced (Astra's retained fixture, 16 assertions): the same-start leak 0.333998 → 0.666002; late publication and late payload accepted; partial-row rates; three issuances scored as three games; the null calibration summary; both health alerts; a singleton max gap of .85; Poisson NaN and negative λ; heat-map NaN; chart imported but not rendered. Eight Vitest files, 117 tests pass.
- Reported only: the 85-game market cohort (log loss .642 / .683 / .697), mean home probability .500 over 274 games against 55.8% home wins, the 49 playoff games, the 369-game backtest, dampening .68 over 53 issuances, and 948 cron "success" rows.

## W1-11 · RSO / roster optimizer ([audit](audits/rso-roster-optimizer.md), [Astra](W1-Astra-PR/rso-roster-optimizer.md))

**A. Astra-only defects**
- **Re-aimed goalie lines break SA = SV + GA** (P1, conditional on re-aiming; `forgeDailyBridge.ts:200-206`). Saves are scaled by the shots multiplier and GA by another: SA 33, SV 29.7, GA 3.6 in a sensitivity fixture; −0.048 with the real context helper inside current clamps. Fix: derive SV = SA − GA.
- **The provider override turns a partial goalie group into certainty** (P1; `providerGoalieStarts.ts:40-62`). Catalog A, B and Unknown, rows only for A (0.6) and B (0.2); Yahoo marks B not starting → A becomes 1.0. M-RSO-021 changes from Sound to Wrong.
- **The near-tie comparator is not transitive** (P1; `streamingChain.ts:73-81`). A < B < C < A; permuting identical candidates changes the pick. Removing form alone does not fix it.
- **The healthy-reserve selector sums isolated gains** (P1; `healthyReserves.ts:60-112`). It picks A + B (jointly 6 points, 1 start) over A + D (10 points, 2 starts). M-RSO-022 becomes Wrong for the "best" claim.
- **The positional tilt doesn't conserve totals after clamping** (P2; `forgeDailyBridge.ts:146-153`): 0.93 instead of 1. Also the W1-6 D19 handoff (dividing by a source tilt FORGE never applied) belongs here.
- **Midnight conversion can return the previous date** (P2; `planningDates.ts:15-26`): Cairo 2026-04-24 and Beirut 2026-03-29 return 23:00 the day before. Edge zones only.
- W1-12 R2 (Yahoo historical false zeros) feeds RSO banked points and the goalie minimum; owned by W1-12.

**B. Corrections**
- **D1 (streaming form):** the form sample counts appearances, including goalie relief. Choose the estimand before blending; don't multiply an already unconditional form by participation again. Delete the "one game can't beat a 20% higher projection" test. The goalie ratio invariant needs equal per-start lines, form and weights. W1-8's RMSE table isn't a test of form's incremental value over FORGE. The UI already prints both projected and blended totals.
- **D2 (no-line zeros):** not every missing line becomes zero (some produce no row). A machine-readable reserve code already exists in the wire (`bridgeForecastWire.ts:32-47,78-89`); honour it. Applying the migration or rerunning FORGE is not enough, because `emitReserve` still zeroes an unconfirmed reserve. Making the drop tier null globally can exclude every player once one forecast is ineligible; use a per-player evidence gate. The unknown drop is a proposal, not an executed transaction.
- **D3 (goalie losses):** +35% assumes regulation-loss semantics; the ±0.02 test is about one standard error (0.0203 at n = 568); the 22% OT share is not a universal constant. The conservation error holds whatever Yahoo's rule is.
- **D4 (live-game bench):** the plan keeps `objective="outcome"` and its numeric total; the trigger needs a relevant locked skater plus a bench placement.
- **D5 (chain DP):** "rerun until stable" has no guarantee; a best-single floor fixes the example, not every k → k + 1 case. The later-impact scenario is informational only by contract (`futureImpact.ts:224-227`); enabling it would not price retention.
- **D6:** the 0.55 back-to-back factor applies only without an exact FORGE row, with more than one known candidate.
- 003 (overlapping buckets, a labelling issue), 006 (an estimand choice), 008 (applies only to AGP plans), 010 (the docstring is already correct), 019 (date-only is fine), 020 (independence assumption), 058 (72 h is not off by one).
- Shutout: p^r is exact only for a pure Poisson zero, not for a mixture.
- Fable's 36 / 16 / 7 / 1 is not an independent count; 009, 021, 022 and 055 need revision.

**C. Superseded remedies**
- Question 1 / D3 → **decision 46**: verify Yahoo's definitions; keep regulation L and OTL distinct; W + L + OTL + no-decision reconciles to the start/appearance probability; mapping labelled unresolved until verified.
- Question 2 / D2 → **decisions 3 and 47**: unknown for drops and rankings; totals marked incomplete with the missing count.
- Question 3 / D1 → **decision 48**: rank on qualified projections until a validated, shrunk, same-basis form component exists.
- Question 4 / M-RSO-035 → **decision 49**: a drop with unknown value is "needs review", never auto-recommended.
- Question 5 / D5 last-day drops → **decision 50**.
- Question 6 / M-RSO-008 → **decision 51**: show starts against ratio as a tradeoff.
- Question 7 / reserve pass → **decision 52**: prepared as a separately reviewed production step.
- D6 → the W1-5 fix order.

**D. Enhancements**
- Report the chance of meeting the goalie minimum (sum per team-game first, then a Poisson-binomial over team-games, labelled as an independence approximation).
- One per-player evidence gate shared by the planner, Best Fit, streaming and the DROP chip.

**E. Evidence status**
- Reproduced (Astra): E1 (+2 chosen where +4 was available), E4c unknown drop, E3 (+8.5 with three adds against +10 with one), E6 bench check, PR1–PR6, and 500 exhaustive assignment checks with zero mismatches.
- Reported only: 101 of 673 skaters without a line, the 568-start W/L/OTL sample, Fable's 4,000 and 60,000 assignment trials, the 305,140 timezone checks, and lineups frozen since 2026-11-09.

## W1-12 · Fantasy scoring ([audit](audits/fantasy-scoring.md), [Astra](W1-Astra-PR/fantasy-scoring.md))

**A. Astra-only defects**
- **Missing category values score as average** (P1; `categoryScores.ts:119-140`). `GOALS = [1, 3, missing]` gives `[−0.707, +0.707, 0]`, so an unknown player outranks a measured low one. Missing SA or starts become zero workload, so SV% .900 and .920 both score 0 (`:73-79`). Readers: Fantasy Projections page, Draft Dashboard values, Draft Pro.
- **Yahoo historical points and goalie credits produce false zeros** (P1; `rosterPlanning.ts:52,74,118,78-81,130-134`). The current team is used for past games (a traded player's 2-goal game scores 0 instead of 6), and any row in a final game counts as proof of a non-appearance. M-FSC-043/044 change from Sound to Wrong. Feeds RSO.
- **The date-range grid counts postponed, cancelled and playoff games** for back-to-backs and home/away (P2; `DateRangeTeamGrid.tsx:50-61,123-139`; `useDateRangeTeamGrid.ts:111-138`).
- **Draft Dashboard standings ignore signed weights** (`categoryStandings.ts:263-268`): a reversed GAA weight ranks GAA 2 first while the category score prefers 4.

**B. Corrections**
- **D1 (pickup boost):** Saturday still has a spread (1.203–1.25). Sunday's 14 teams have identical schedules here, so they should tie. Min-max over the remaining active teams can blow a tiny difference up to the full 0.5 spread; freeze a reference scale. Relabel rather than cap at 100.
- **D2 (goalie category values):** with equal workloads the rate z is the raw z × SA/(SA + 1,200) (SV%) or starts/(starts + 25) (GAA). At 60 starts the GAA factor is .706, so "nearly ignores GAA" is not general, and the sample comparison is about one quarter, not one sixth. It may be a deliberate reliability weighting, but it is not the brief's roster-pool impact valuation. GAA impact uses TOI, not starts. SD = 1 holds only for an unweighted fixed pool.
- **D3 (sensitivity):** reproduced (0.8 / 1 / 1.2, always "candidate"), but the UI already calls it a stress scenario. The whole `MINUTES|TIME_ON_ICE|PERCENTAGE|AVERAGE` regex is exempt; PIM is the clear mistake.
- **D6 (direction):** Draft Pro keeps the sign (`abs` is only in a denominator; executed). The standings bug is at `categoryStandings.ts:263-268`, not `:100`; settings rejection is at `settingsValidation.ts:183-194`, not `:227`. `reports.ts:58-60` is a real fixed-list reader. A registry already exists (`statsMasterList.ts`, FACEOFFS_LOST and OTL lower-is-better); extend it rather than add a new one.
- **D5 / Week Score:** it is not lexicographic (3 games / 3 off-nights scores 30, beating 4 / 1 at 28). The weighted off-night helper ranges .2857–.3929, not .286–.32. `getFourWeekScore`'s opponent term can reach 1.0 (0.2 in Astra's example).
- **D4 (back-to-back):** don't replace it with an arbitrary additive offset; any adjustment must keep probabilities in [0, 1] and complementary.
- 012 (SHG + SHP overlap may be intended), 009 (neutral per-play utility is deliberate), 040/041 (missing percentiles enter display averages as 0), 045 (the ledger already labels the defaults "League-default (TJ's)").
- Start Chart: unsupported categories are rejected, so the suffix routing defect is conditional.

**C. Superseded remedies**
- Question 1 / D5 → **decision 53**: off-night value is measured, not fixed; 1.67× and 1.25× are not facts.
- Question 2 / M-FSC-045 → **decision 54**: label defaults "FHFH default"; connected leagues use their own settings.
- Question 3 / OTL → **decision 55**: per league, direction from the provider through one stat registry. Also covers D6.
- Question 4 / D1 → **decision 56**: mark idle teams, show 0 in-window contribution, exclude them from the boost normalisation.
- Question 5 / M-FSC-009 → **decision 57**: a real category-aware Roster Optimizer; fix category scoring first.
- M-FSC-039 GP% → **decision 16**. D4 → the W1-4 direction for Game Grid odds.

**D. Enhancements**
- Calibrate the off-night value from RSO lineup-fit results (decision 53).
- Extend `statsMasterList.ts` into the single registry for role, direction and counting/ratio type.

**E. Evidence status**
- Reproduced (Astra): weekend multipliers; shrink against unshrunk SD (SD .5; a one-shot goalie moves the others); missing = 0; no exposure = 0; Draft Pro sign; reversed-GAA standings; sensitivity 0.8/1/1.2; back-to-back `[null, 55]` and `[55, 41.25]`; off-night helper range; `getFourWeekScore` 0.2; postponed back-to-back; Yahoo false zeros. Five Vitest files, 42 tests pass.
- Reported only: the 98-goalie and 951-skater aggregates, the rank moves (Shesterkin 13th → 8th, Dostal 10th → 17th), Fable's 4,000 assignment trials and 16 of 104 second nights.

---

## Cross-packet defect map

One owner per defect; every reader gets its own selection test (Batch A rule 4).

| Defect | Owning packet | Readers (packet: surface) | Decision |
|---|---|---|---|
| **Hits and blocks count PK time twice** | W1-6 D4 | W1-7 D1 (`proj_hits`, `proj_blocks`, M-FRG-105/108); fantasy points everywhere; blocked-shot props; served ledger; RSO bridge; Start Chart | 24, 59 |
| **Skater lines are ES+PP, not all situations; ES label holds PK** | W1-6 D1 | W1-7 M-FRG-111 (`proj_toi_es_seconds`); Start Chart TOI (PK summed as 0, W1-7 083); goalie win λ (W1-6 029/038); game-prediction FORGE features (W1-10 M-GPR-035); ledger; RSO bridge | 24, 59 |
| **Goalie slot rows under one goalie's id** | W1-6 D2 (stage), with W1-5 | Goalies API and GoalieRiskCard "Win" (W1-6 011, W1-7 094); ledger build and scoring (W1-6 014/037, W1-8 030); accuracy job (W1-5, W1-6 016, W1-7 085); market saves comparison (W1-7 Q2); RSO bridge per-start line, re-aim and provider override (W1-11 017, PR1, PR2); goalie metadata horizon scaling (W1-7 077) | 25 |
| **Credited start identified by maximum TOI / appearance** | W1-5 | FORGE `goalie-queries.ts` (W1-6 023); season model `season.py` (W1-8 PR-P8, dormant); game-prediction workload TOI ≥ 1,200 s (W1-10 038); quality-start rule (W1-8 D9); Yahoo credited appearances (W1-12 R2, appearance contract); RSO recent-form `losses` (W1-11 D3) | W1-5 fix order; 40 |
| **GSAA against a fixed .900** | W1-5 (route) and W1-2 (definition) | FORGE opponent-goalie adjustment (W1-6 044); goalie evidence residuals and tiers (W1-6 031/033); accuracy goalie baseline (W1-7 080); game-prediction goalie blend (W1-10 013, weight 0); legacy SQL GSAA (W1-5) | 10 |
| **Accuracy job: wrong start outcome, one-day "30-day" gates, empty Brier subgate, non-proper "accuracy %"** | W1-5 (outcome), W1-6 D10 (gates and score) | `run-projection-accuracy.ts`; `/api/v1/forge/accuracy`; promotion and launch gates (W1-7 080/085); goalie interval coverage (W1-7 068); role buckets (W1-7 081) | W1-5 order |
| **Game Grid win odds** | W1-4 D5 | Game Grid heat map and TeamRow (W1-10 D2, 016/017); Week Score matchup bonus via the 0.75 back-to-back cut (W1-12 018/021) → pickup boost, RSO team context, social share; legacy book-average without de-vig (W1-6 004); tie-breaker no-op and NaN (W1-10 016, W1-12 025) | W1-4 direction; 1, 45 |
| **Odds conversion, de-vig and pairing** | W1-6 (`devig.ts`, spread sign, averaged lines) and W1-10 D9 (converters) | Market flags (W1-6 041, W1-7 095, dormant); ledger market rows (W1-6 037); GamePreview and stats game page (W1-10 R4); ESPN snapshots (W1-10 027) | 30, 42 |
| **Ledger scores unconditional forecasts on dressed players** | W1-8 D6 | `/api/v1/forge/scoreboard`; ledger goalie heads (W1-6 014/037); naive baseline in the snapshot route (W1-11 010) | 41 |
| **Seconds read as minutes (and the reverse)** | Each owning packet | Rolling fallback (W1-3 D1); sustainability band collectors (W1-9 D1); NST team xGA/60 (W1-6 025); WGO TOI normalizers (W1-7 063, two copies); accuracy actual TOI (W1-7 080); FORGE evidence weight (W1-3 D3 / W1-6 046) | none needed |
| **Sustainability trend band read by FORGE** | W1-9 | FORGE trend adjustment (W1-6 056; inert today per Astra W1-9); Sandbox; entity-bands API | 26, 33, 36 |
| **Recent form blended into rankings** | W1-11 D1 | Streaming chain rank and chain order (W1-11 007/060); `recentForm.ts` (W1-12 011); Roster Autopsy hint (W1-12 016) | 2, 48 |
| **Unknowns turned into zeros or averages** | Each owning packet | No-line players (W1-11 D2); category scores (W1-12 R1); Yahoo history (W1-12 R2); all-missing sustainability score (W1-9 A2, A3); partial recent-form rows (W1-10 R3); zero-shot history (W1-6 PR8); null ranks (W1-6 010); undefined ratios (W1-8 PR-P10); opponent point % (W1-12 017); pickup percentiles (W1-12 040) | 3, 47; Batch A rule 5 |
| **Current team used where the team of record by date is needed** | W1-3 (decision 16 owner) | Pickup GP% (W1-12 039); Yahoo historical points and credits (W1-12 R2); legacy NST date-window stats (W1-9 041); counterfactual PP history (W1-6 012); game-prediction goalie workload (W1-10 038) | 16 |
| **Starter probabilities and mixtures** | W1-5 | Start Chart mixture overflow (W1-7 092); RSO bridge back-to-back 0.55 and provider override (W1-11 018, PR2); game-prediction start-mass renormalisation (W1-10 013); native participation frequency (W1-8 D8) | W1-5 order |
| **Opponent positional tilt** | W1-11 (bridge) | Handoff from W1-6 001/D19; re-aimed bridge lines (W1-11 013, PR5); ledger `bridge_reaimed` rows | none yet |
| **PP/PK tiers from one game** | W1-4 D3 | Sustainability opponent-PK factor (W1-9 D10, unserved); Start Chart | 20 |
| **Team power rating** | W1-4 D1 | Placeholder game model logit (W1-10 D5); Team Power Terminal (W1-7 074); slate-relative defence grade (W1-7 096, W1-10 030) | 19, 58 |
| **Expected shooting % definition** | W1-3 | Legacy `/charts` recent and career routes (W1-9 D12) | 17 |
| **Off-night threshold and valuation** | W1-12 D5 | Week Score, four-week opportunity, social share, draft-dashboard schedule metrics, date-range grid (W1-12 019/024/027/049) | 53 |
| **Category direction and role routing** | W1-12 D6 | RSO stat applicability (W1-12 031); Start Chart (014); Draft Dashboard standings and settings validation; Draft Pro reports; ESPN/Fantrax/Yahoo adapters (046–048) | 55 |
| **Post-reconciliation bootstrap** | W1-6 PR3 | Final skater heads (W1-7 103–110); candidate uncertainty (W1-7 N1); reserve lines | 24 (final-output accounting) |
| **Horizon scaling of probabilities** | W1-6 D24 | Goalie stage (W1-6 024/027); goalie metadata (W1-7 077); reserve shutout (W1-6 007); goalies API rescale (W1-7 094) | 28 |
| **Isotonic ties and the logistic trainer** | W1-1 | Game-prediction calibrators and candidates (W1-10 018/025) | none needed |
| **Regulation ties and the OT rule** | W1-10 (decision 45 owner) | Legacy Game Grid 50/50 split (W1-6 004); FORGE team win (W1-6 029); game-page chart (W1-10 D3, dormant); heat map (W1-12 025) | 45 |

---

## Wave 1 P0 list (Batch A plus B/C)

P0 = a user-visible wrong number on a live surface today, after Astra's corrections. **30 rows: 29 live and 1 conditional on a serving flag.** "Evidence" uses the labels defined at the top. Every magnitude stays a dated sample until a saved, reproducible extract exists (rule 1).

| # | Defect | Packet(s) | Readers | Depends on decision | Evidence |
|---:|---|---|---|---|---|
| 1 | Leaky xG champion `cfg9bac2706` serves the in-house xG aggregates | W1-1 D1 | Metrics Timeline, homepage game analytics, xG API and xG Lab (FORGE team prior: no route established) | 5 (stays serving until its own approved demotion step), 6 | Holdout AUCs recomputed; leak reproduced |
| 2 | Bucket-heuristic xG with a 0.25 goal floor on the underlying-stats pages (also the default xGF% sort) | W1-1 D6, W1-2 D2 | Player, goalie and team underlying-stats pages | 6, 12 (hide now) | Floor and blocked-shot xG reproduced on fixtures; six-game NST gap reported |
| 3 | Team shot map mirrors left and right | W1-1 D10 | Team shot map (`ShotVisualization.tsx`) | none | Transform reproduced by Astra |
| 4 | Score-state filters return nothing for skaters | W1-2 D1 | Underlying-stats score-state views (skaters and goalies; PBP fallback path separately) | 11 | Reproduced on fixtures |
| 5 | "GSAA" column is heuristic xGA − GA | W1-2 D4 | Goalie underlying stats | 10 | Source-confirmed; 13-goalie-game comparison reported |
| 6 | Penalty classes in the wrong column | W1-2 D3 | Player penalty columns | 13 | MIN4/MIS10/PS reproduced; two-week counts reported |
| 7 | HDCF, SCF and rush attempts carry NST names with different definitions | W1-2 D5 | On-ice and individual tables, goalie HD shots | 8, 9 | Source-confirmed; definitions not yet an executable spec; magnitudes reported |
| 8 | Player radar compares against the wrong cohort | W1-2 D6 | Player radar | 15 (5v5) | Confirmed against stored codes (Fable); asymmetric sample gate reproduced |
| 9 | Rolling shots/60 and ixG/60 fallback 60× low | W1-3 D1 | Rolling dashboard, Hot/Cold card, trends | none | Reproduced (0.163 against 9.77) |
| 10 | Results luck reads a per-60 rate as a count | W1-3 D2 | Rankings results-luck index | 23 | Reproduced |
| 11 | Trend page prints fractions and PDO as percentages; L7/L14/L30 views can never show data | W1-3 D4 | Player trend page | 17, 18 | Source-confirmed by Astra |
| 12 | Power ratings standardised against the night's slate and carried forward | W1-4 D1 | Team ratings, Start Chart grade, placeholder game model | 19 | Source-confirmed; shrinkage cancellation reproduced; replay numbers reported |
| 13 | PP/PK tiers from the last single game | W1-4 D3 | Team ratings tiers, Start Chart | 20 | Source-confirmed; reported |
| 14 | Game Grid win odds: all-time snapshot goals, no home ice, weak against market; 0.75 back-to-back cut in Week Score | W1-4 D5, W1-10 D2, W1-12 021 | Game Grid heat map and TeamRow; Week Score bonus → pickup boost, RSO team context, social share | W1-4 direction (fix or withhold, never the placeholder); 45 | Source-confirmed; 85-game benchmark and 274-game home rate reported; back-to-back cut reproduced |
| 15 | Top Adds score is NaN at two call sites | W1-4 D14 | Top Adds | none | Reproduced offline; visible impact unchecked |
| 16 | FORGE starter probability over-confident (0.83 stated, 60% started) | W1-5 D1 | Every FORGE goalie row, skater opponent-goalie weights, RSO bridge | W1-5 fix order (outcome, timestamps, cutoffs, then refit) | Amplification and probability-sum reproduced; 300-game calibration reported |
| 17 | Start Chart "start probability" is the raw L10 share and ignores back-to-backs | W1-5 D2 | Start Chart | W1-5 fix order | **Conditional** on the serving and fallback flags; 2,311-game reconstruction reported |
| 18 | Skater lines omit the PK bucket and are labelled totals | W1-6 D1 | FORGE skater rows, fantasy points, ledger, RSO bridge, Start Chart, goalie win λ | 24, 59 | Source-confirmed (narrowed to PK by Astra); ledger biases reported |
| 19 | Hits and blocks count PK time twice | W1-6 D4, W1-7 D1 | Skater rows, fantasy points, blocked-shot props, ledger | 24, 59 | Source-confirmed by both reviews; +12.5% / +4.0% reported |
| 20 | Goalie row is the team slot under one goalie's id; API "Win" is the team win | W1-6 D2, W1-7 D4 | Goalies API, GoalieRiskCard, ledger, accuracy job, market saves, RSO bridge | 25 | Source-confirmed; trace values reported |
| 21 | Opponent-goalie adjustment: fixed .900 GSAA, unshrunk, clamped after mixing | W1-6 D3 | Skater goals and (via team goals) assists; win λ | 10; shared goalie-quality input to fit | Source-confirmed; November distribution reported |
| 22 | Team Power Terminal: saturated bars, risers in power order, rising fallback sparkline for fallers | W1-7 D3 | `/forge` command center | 58 | Source-confirmed; data availability conditional |
| 23 | Sustainability trend-band TOI fallback 60× too large | W1-9 D1 | Trend-band and entity-band APIs, Sandbox (FORGE reads it but is neutral today) | 36 (bounded rebuild after fix) | Reproduced (z −20.96); prevalence reported |
| 24 | Sandbox band status compares the band with its own interval; stored percentile near 50 | W1-9 D2 | Sandbox (three places), stored `percentile`/`z_score`, FORGE trend reader | 33, 26 | Reproduced, including a false cold flag; "never fires" narrowed |
| 25 | `/charts` career averages: reducer reset and unweighted season means | W1-9 D3 | `/charts` sustainability-versus-career chart | 17, 34 | Reproduced (33.75; .165 against .0827) |
| 26 | Streaming rank blends raw recent form 50/50 with the projection | W1-11 D1 | Streaming itinerary and chain order | 48 | Reproduced (+2 chosen where +4 was available) |
| 27 | No-FORGE-line players are known zeros; unknown players enter the drop order | W1-11 D2 | Planner drop order, plan alternatives, streaming, Best Fit, DROP chip, lineup totals | 3, 47, 52 | Reproduced; 101-of-673 count reported |
| 28 | Goalie losses = 1 − wins (OTL and no-decisions counted as losses) | W1-11 D3 | RSO goalie points and category L in leagues that score losses | 46 | Source-confirmed; 568-start sample reported; size depends on league L/OTL mapping |
| 29 | Pickup team boost min-max scales the −100 "no games" marker | W1-12 D1 | Pickup table BPA ranking (default on) | 56 | Reproduced (weekend multipliers) |
| 30 | Category z-scores attenuate goalie SV%/GAA (shrunk numerator over unshrunk SD; whole-pool reference) | W1-12 D2 | Fantasy Projections page, Draft Dashboard values and tiers, Draft Pro category fit | 57 (+ open pool/impact contract) | Mechanism reproduced; rank moves reported |

**Fable P0s not carried as P0, and why**
- **Spread flag sign** (W1-6 D4b): no flags are stored and market tables are empty (W1-7). P1, and a blocker before odds ingestion resumes (decision 30).
- **Scratch tweets as 30-hour injuries; default L3/PP2 tags** (W1-7 D2): needs published matching events, frequency unknown. Conditional P0: the fix plan's first step is a bounded count of `forge_roster_events` (a database read needing approval). Decision 31.
- **Game-page Poisson chart** (W1-10 D3): imported but never rendered. Dormant; decision 44.
- **FORGE evidence weight** (W1-3 D3): sized by W1-6 as P1 (D5); only the TOI component is wrong.

---

## Owner decisions still open after decisions 1–60

1. **Sustainability last-N windows at the season start** (W1-9 D11). Stop at the season boundary and report the shorter n, or keep N appearances and fix the baseline overlap? Decision 18 covers calendar windows only.
2. **Category valuation contract** (W1-12 D2). Which reference pool (rostered by league settings, or all players), rate impact (SV − pool SV% × SA; GAA via TOI) or rate z, and whether to keep the reliability shrink. Decision 57 says fix category scoring first but not to which contract.
3. **Goalie relief in unconditional lines** (W1-6 Astra PR4). Decision 25 gives if-he-starts × start probability. Model relief explicitly, or state a zero-relief assumption?
4. **Game Grid odds now** (W1-4 direction). Withhold them until the fix lands, or keep showing them meanwhile?
5. **Forecast evaluation objective** (W1-8 Astra). Mean forecasts selected by squared error or Poisson deviance rather than MAE (which targets the median)?
6. **Starter-board baseline policy** (W1-8 M-PFC-024). Make the issuer consume the selected 60/180/360 artifact, or keep the fixed 300-minute policy as its own separately evaluated baseline?
7. **Manual RSO comparisons with an unknown drop** (W1-11 Astra). Automatic proposals are settled (decisions 3, 49). May a schedule comparison the user asks for include a player whose value is unknown?
8. **Sustainability league priors and skill references** (W1-9 A5). Decision 34 rules out the judged games for the player's baseline. Is a current-season league reference acceptable for the descriptive index if versioned as-of, or must it be a frozen earlier reference?

Approvals the fix plan will need (actions, not new decisions): the bounded `forge_roster_events` count; the reserve migration (decision 52); the trend-band rebuild (decision 36); demotion of `cfg9bac2706` (decision 5); reconciling the held rolling/FORGE writes before any retry.
