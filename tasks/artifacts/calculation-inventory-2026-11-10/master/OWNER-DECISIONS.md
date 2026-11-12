# Owner decisions for the math audit (TJ, 2026-11-10, by pop-up)

These answer TRIAGE.md section 5. Auditors treat them as the intended contract.

1. **Served game win probability (`INITIAL_BASELINE_MODEL`, M-GPR-026)** is a **placeholder**. Audit it as a stand-in. Benchmark it against the home-win rate, Elo-style and de-vigged market baselines, and specify a fitted replacement with a home-ice term.
2. **RSO streaming rank and recent form (C13, M-RSO-007/060)**: recent form MAY influence rank, but only **shrunk by sample size** (regressed toward the projection) and on the **same unconditional basis** as the projection. Size the current 50/50 raw blend as a defect against that intent.
3. **RSO players with no FORGE line (C15, M-RSO-014/030)**: first **find out why** the player gets an all-zero stat line and fix the cause. If no fix is possible, treat them as **unknown**: shown as no-data, **never auto-dropped**, excluded from drop proposals (the existing policy).
4. **Database access for auditors**: **yes, bounded reads** under the read-hygiene rules. Allowed: small LIMIT-ed reads by id or date, and catalog reads (`pg_proc`, `pg_views`, `pg_matviews`). Check `pg_stat_activity` first and stop if more than 5 queries are active or any query has run longer than 10 s. Not allowed: bulk payload/jsonb reads, unbounded joins, full-table scans of large tables, and any writes.

Facts Chef checked (2026-11-10):
- `NHL_XG_MODEL_ARTIFACT_PATH` is **not set** in the `fhfhockey` Vercel project (env names checked, no values read). The xG audit must establish what the prediction and aggregate routes do when it is unset: default path, failure, or skip. It also needs to establish which xG the site actually serves.

Facts Chef checked after W1-1 (2026-11-10):
- The full `fhfhockey` production env list (101 names, via `vercel env ls production`; names only) has **no `NHL_XG_*` variables**: not `NHL_XG_MODEL_ARTIFACT_PATH`, `NHL_XG_MODEL_VERSION` or `NHL_XG_TEAM_AGGREGATE_MODEL_VERSION`. FORGE is therefore not pinned to the leaky team xG prior through an env override; downstream audits should confirm the default path that code takes when the variable is unset.
- Refits must run against a **local copy** of the shot features (export once, bounded and paged, with owner approval), never as repeated full-table reads of production.

## Decisions after W1-1 (TJ, 2026-11-10, by pop-up)
5. **Leaky champion xG model cfg9bac2706**: leave it serving for now. Demotion waits for the fix plan, as its own approved step with a registry backup.
6. **Headline xG**: **Natural Stat Trick's xG (labelled as NST) is the headline** until a leak-free, converged in-house model is approved. The bucket heuristic (0.18/0.08/0.02 with a 0.25 goal floor) is to be retired.
7. **Empty-net shots**: **excluded** from team, player and goalie xG totals (and from GSAx/xGA) and **reported separately**. The model should distinguish shooting at an empty net from the shooter's own net being empty.
8. **Rush definition**: **4-second window**, no faceoff sources (the common MoneyPuck-style convention).

## Codex cross-check of W1-1 (relayed by TJ, 2026-11-10)
- Confirmed: the champion's 0.934 AUC is inflated by outcome leakage. The corrected candidate is 0.712 overall and 0.736 at even strength on 17,834 held-out shots. The 0.748–0.761 refit is a small-sample experiment, not a production result.
- Agreed: FORGE's team xG prior falls back to another source, so it does not read the leaky model through the env override.
- **Fix-plan constraint:** demoting cfg9bac2706 in the registry will **not** hide its existing aggregates, because some pages read them directly. The xG fix must enumerate and handle **every consumer** of the old aggregates (team Metrics Timeline, homepage game analytics, xG Lab and any others) rather than relying on the champion flag.

## Decisions from the W1-2 audit chat (TJ, 2026-11-10; recorded by Chef from audits/nst-derived-stats.md)
9. **NST-named metrics must equal NST's definitions.** On-ice tables count every attempt or chance by the player's team while he's on the ice; individual tables count the player's own. HDCF, SCF, Rush Attempts, OZS% and OZFO% follow NST (War-On-Ice style scoring-chance values, 4 s rush, OZ/(OZ+DZ)).
10. **The goalie column is whatever NST labels it: GSAA** = shots against × (1 − league SV%) − GA (expected goals against at league-average save percentage minus actual goals against), computed at the aggregate level (same season, strength and date range), never by summing NST's per-game values. GSAx can be added later as its own column.
11. **Leading and Trailing include one-goal margins** (any lead or deficit); Up 1 and Down 1 are subsets.
12. **Bucket heuristic xG: hide now, then fix.** Hide the xG columns on the player, goalie and team underlying-stats pages and move the default sort off xGF%. xG returns only from a clean trained model (see 6).
13. **A penalty-shot infraction is not a penalty** in a player's totals.
14. **NST burst rule (TJ, clarified):** all four windows hold together across every caller: 40/1 min, 80/5 min, 100/15 min, 180/60 min. A burst may be **39 or fewer** URLs and must be followed by **at least 60 s** before the next call. **Two bursts in a row must be followed by a 5-minute pause.**
    - Chef's read of the deployed function (`nst_admit_attempt_budget_v1` plus migration 20261109015836): a "78 semi-burst" is two 39-request waves. The 39/1 min cap forces about 60 s between them, and the 80/5 min cap then leaves at most 2 more requests for anyone until the 5-minute window clears. So it is **mostly compliant**, NOT the violation W1-2 D10 describes.
    - **Remaining gap:** after two bursts, up to 2 more requests can still go out inside the 5 minutes. TJ's rule wants a full 5-minute pause. Fix: once a plan's second wave ends, deny all callers for 300 s. The cadence correction must cover **every layer**, not just the database function:
      - the deployed `nst_admit_attempt_budget_v1`, as a committed migration;
      - the TypeScript client and gate (`web/lib/nst/client.ts`, `web/lib/nst/sharedAdmission.ts`, `web/lib/cron/nstRateLimitPolicy.ts` `canUseNstSemiBurst`);
      - the **Python admission gate** (`functions/lib/nst_admission.py`, `nst_get`) and the Python callers that plan bursts (`functions/api/fetch_team_table.py`);
      - **resumable callers** (catch-up/backfill jobs that stop and resume across invocations: NST goalie catch-up, bounded past-season backfill, team-stats date queue). These must re-check the post-burst and post-double-burst cooldowns on resume rather than relying on in-process timers.
    - Tests for each layer, run together: a 39-request burst then any call within 60 s is denied; two bursts then any call within 300 s is denied; 40 or more planned requests pace at ≥21 s; the same answers in TS, Python and SQL.
    - It goes in the fix plan's NST work.

15. **Player radar: move to 5v5** and label it "5v5".

## Review notes on W1-5 goalie-starters (TJ, 2026-11-10)
- The "named starter's saves/wins about 37% too high, partner's about 56% too low" figures are **inferred from average starter probabilities**, not measured errors in saves or wins. Treat them as an upper-level indication, not a measured magnitude.
- The Start Chart issue is **conditional**: its production serving flag is unverified. Chef checked env names only: `STARTER_BOARD_SERVING_ENABLED` exists in production, value not read. A **second fallback flag** also has to be checked before the Start Chart finding is confirmed.
- **Fix order:** first the actual-start outcome (who really started), the timestamps (`goalie_start_projections.updated_at` is never updated) and the pregame cutoffs (no look-ahead). Only then fit and validate replacement start probabilities.
- The proposed shrinkage (about 0.3 before the sigmoid) and the back-to-back adjustments are **hypotheses, not validated models**. They must be fit and validated on held-out dates before use.

## Review notes on W1-3 rolling and W1-4 team ratings (Codex/Astra reviews relayed by TJ, 2026-11-10)
**W1-3 rolling-player-averages-trends-part1**
- The four main defects are verified in current code: the seconds/minutes per-60 error, Rankings reading a rate where it expects a count, the trend display errors, and FORGE's exposure input. The FORGE issue affects **one evidence-weight component**, not necessarily the whole weight.
- Missing-row counts are from the audit's 2026-11-10 snapshot, not a fresh live check.
- Rolling/FORGE runs are currently held on `nst_persistence_unconfirmed` (also flagged to Scout). **First step: reconcile what those runs actually wrote before any retry or rebuild.**
- **Test correction:** don't assert "shots/60 ≥ 1". A value below 1 can be legitimate. The test recomputes the rate from the matching shot count and ice time instead.

**W1-4 team-ratings-power-ctpi-sos: recommended direction**
- Power ratings: compute from genuine games (one row per game, no all/5v5 mixing), then standardise **all 32 teams against the same daily baseline**. Keep pace separate. Label the 25-game, 10-game half-life rating as **descriptive**, not a proven predictor.
- PP/PK: displayed rates, ranks and tiers use **pooled season-to-date opportunities and results**. A recent-window view can be added separately.
- Game Grid: **fix or temporarily withhold** the misleading odds. Don't switch straight to the game-prediction model, which is still a placeholder (decision 1).
- CTPI: keep the newer candidate gated until it is validated. **Inventory dependencies before considering any legacy deletion.**
- Extra catches:
  - The Top Adds NaN reproduces in a local fixture; its visible impact is unchecked.
  - The proposed SOS helper can count an in-progress game as completed, so correct it before reuse.
  - Restoring early-season shrinkage alone won't work if the next normalisation step cancels it out.

## Decisions on the Batch A open questions (TJ, 2026-11-11, by pop-up)
16. **Rolling availability follows the player's team of record by date.** Label it "games available"; the "with current team" wording was TJ's starting point, but the rule follows the trade date. Fix the denominator and clamp bugs.
    - The last-N window is the player's team-of-record games by date. Each possible game belongs to the team he was rostered with on that date: before a trade it counts the old team's games, after it the new team's.
    - Numerator: games played. Denominator: team games of the team of record on each date.
    - TJ's worked example: in the window 11-01 to 11-11 the player is on team A for 4 team games (plays 3), is traded on 11-06, and is on team B for 6 team games (plays 5). Availability = (3 + 5)/(4 + 6) = 8/10.
    - Needs the roster or trade effective date. Where that date is unknown, say so (unknown, or an appearance-bounded proxy labelled as such); don't guess.
17. **Expected shooting % = ixG ÷ unblocked attempts (Fenwick), as a 0–100% scale, with one name and one definition everywhere** (rolling, trends, rankings). Retire the ixG/SOG and ixG/all-attempts variants or rename them if anything still needs them.
18. **"Last 7/14/30 days" means calendar days ending today.** An idle player shows few or no games.
19. **The team power-rating headline is a shrunk strength estimate.** Early-season values regress toward average by games played, with an approved prior applied **after** normalisation against a fixed reference distribution, so the final standardisation can't cancel it.
20. **CTPI PP/PK rates are pooled by ice time:** Σ(w·xG) ÷ Σ(w·TOI) × 3600 over the same valid observations.
21. **Strength of schedule "past" means final only** (completed with a known result). Started or postponed games go to an explicit pending or in-progress bucket and are never counted as played.
22. **Created-xG credit is exclusive and capped.** The contributors on one shot sum to at most that shot's xG, so credit adds up across players and teams.
23. **Results luck compares rates per 60:** (G − ixG)/60 in the window against the non-overlapping baseline (G − ixG)/60, using explicit count fields and matched exposure.

## Decisions on Batch B/C open questions, round 1 (TJ, 2026-11-11, by pop-up)
24. **FORGE skater lines are all-situation totals:** ES + PP + PK + extra-attacker, with empty-net goals in their own named bucket (decision 7).
25. **FORGE goalies: one row per candidate.** Each row carries the if-he-starts line, the start probability and the unconditional product. The API shows the goalie's own Win and, separately, the team win %, and the slot rescale is removed.
26. **Sustainability trend band in FORGE regresses toward the band.** Above-band form is expected to come back down, never treated as momentum. The size is fitted and validated before use.
27. **Opponent and venue change team shot volume** through fitted terms (opponent shot suppression, home/away), sized on held-out games.
28. **The multi-game FORGE horizon is kept and fixed** (TJ chose this over removal). Probabilities are never multiplied by a horizon scalar: report per-game values or 1 − ∏(1 − p) as the definition requires. Fix the dead zero-rest branch, the goalie opponent averaging and the game-type filter, and keep the horizon option tested.
29. **Bands become a "typical range" with the real coverage shown.** Quantiles come from the exact distribution, not 400 draws. Calibration is judged by PIT and interval score per stat.
30. **Sportsbook odds ingestion comes back after the fixes.** Spread uses a cover probability against the de-vigged price (overtime rule stated), lines stay per book and are never averaged, and yes-only de-vig must be monotone. Only then resume.
31. **Healthy scratch: show his "if he plays" line, labelled** "scratched / not expected to dress", with 0 expected for that slate. A scratch is scoped to a game id, and injuries end with a RETURN event, not a 30-hour timer.

## Sustainability: owner definition (TJ, 2026-11-11, verbatim intent, binding for the fix plan)
32. **Definition.** Sustainability assesses whether a player's current level of production is **supported and likely to persist relative to his own established baseline**. Luck is one component, not the whole definition.
    - Inputs: recent production, underlying process and chance creation, and changes in opportunity or deployment. A promotion or reduced ice time can explain a change in results and is not automatically discounted; the stability of that opportunity is itself part of the question.
    - Goals: understand hot and cold stretches and whether they look supported, and research signals that may precede a streak starting or ending.
    - Baselines: player-specific, with forwards and defencemen distinguished. Goalies get the same conceptual goal using goalie evidence.
    - Output: a clear summary with its component evidence, coverage and uncertainty visible. **Do not preserve the current blended formula.** Inputs and weights are determined from evidence and **tested out of sample**.
    - Separate descriptive findings from predictions. Claim no continuation probability or predictive skill without validation.
33. **Usual range (Sandbox band).** A player-specific expectation range for a window of this size, from an appropriate baseline and adjusted for sample size and uncertainty.
    - Hot or cold when observed performance is meaningfully outside it.
    - Show baseline, window, sample size and range, and say whether the range is descriptive or validated as predictive.
    - Sparse histories and rookies: a peer-informed baseline with visible uncertainty, never false precision.
    - The band describes how unusual results are. Whether the stretch is supported is judged **separately**, through process, opportunity and luck. Crossing the band is not proof a streak continues or ends. Validate range and coverage on later held-out data before calling it predictive.
34. **Baselines** use only information available **before the evaluated window**: prior completed seasons plus, when appropriate, earlier current-season games. Never the judged games or future information.
    - Weight recent evidence and shrink sparse histories toward a position-based prior, with the method and weights validated on held-out data.
    - Rookies and limited histories: a position-informed prior, plus eligible early-season evidence as it accumulates. Label limited or no history, and show sample size and uncertainty.
    - A player's recent games are never both the streak and his own baseline.
    - Role, deployment and opportunity changes are shown as context, neither assumed permanent nor discarded.
35. **Dashboard lists:**
    - Rename the current lists to what they measure (e.g. "Potentially Unlucky", "Potentially Running Hot"), and only if the evidence supports those labels.
    - Show supporting results, process and opportunity context. A luck signal alone is never a trust or fade recommendation.
    - Keep **"Trust These Risers"** as a separate potential feature: only players whose production or opportunity is genuinely rising with supporting evidence. Define and validate it before presenting it.
    - Keep confidence and evidence coverage separate from the signal. Use a percentile only from an appropriate, labelled comparison group; a percentile is not confidence.
36. **Trend-band history:** a **bounded rebuild** after the 60× fix ships, as its own approved step.
37. **Sustainability count projections stay unserved and are tracked as open implementation work, not abandoned.** Before scheduling:
    - fix and test the opponent-PK direction and scale;
    - reconcile them with definition 32;
    - verify inputs and downstream consumers;
    - evaluate on held-out games.
    - Then bring the activation plan and schedule for approval.
38. **Native player-forecast path.** The goal is a qualified native path serving useful skater and goalie projections to FORGE, RSO and the Start Chart. Evaluate and complete it; don't activate it as-is or abandon it.
    - Implement and test evidence-supported skater shrinkage and goalie regression, including a defensible approach to wins and start probability. Don't assume a shrinkage constant, or that team win alone is a goalie's win probability.
    - Compare the native path with the bridge and sensible baselines on genuinely held-out games, with consistent conditional and unconditional definitions, calibrated probabilities and verified input coverage.
    - Keep it unserved until those checks pass and its consumers, fallback and rollout are reviewed. The activation plan and any data repair or configuration change come back for approval.
39. **Calibration evidence for v4/v5.** The 2025-26 lockbox is **consumed**, as the model contract already says.
    - Check for an untouched, time-appropriate historical holdout with documented provenance. If one exists, use it for a single evaluation, and never relabel examined or tuned-on data as fresh.
    - Until independent evidence supports calibration, label intervals **uncalibrated**.
    - Collect prospective 2026-27 forecasts frozen before each game and evaluate them against outcomes, reporting sample size, coverage and uncertainty, including discreteness. Don't claim calibration because a small sample lands near target.

## Decisions on Batch B/C open questions, round 2 (TJ, 2026-11-11, by pop-up; intent preserved, condensed by Chef)
40. **Quality Start means Vollman's definition everywhere it is labelled "Quality Start".**
    - SV% above that season's league-average SV%, or ≥ .885 when allowing ≤ 2 GA. Verify the exact boundaries against the original, and take league average for the matching season and scope.
    - Credited starter only, no relief. One shared implementation, with edge tests (threshold, low shots). Missing league average or shots means unavailable.
    - Any fixed-threshold variant is a separately named FHFH measure.
41. **Forecast ledger: score each forecast on its declared basis.**
    - Unconditional forecasts are scored over the full eligible pregame universe, with confirmed non-participation as 0. Conditional forecasts are scored only on players who dressed or played, per an explicit target.
    - Persist participation probability, basis, issuance time and eligible population with every forecast.
    - Compare like with like. A conversion uses a documented participation model, is labelled, and never divides by a missing, zero or unqualified probability.
    - Exclude unresolved participation or missing outcomes, never zero them. Evaluate participation calibration separately, on frozen pregame forecasts.
42. **No production game model:**
    - Show a clear "FHFH predictions unavailable while the model is developed and validated" notice.
    - If a current, authorized odds source exists, also show a separately labelled de-vigged market probability with source and timestamp, never as an FHFH prediction. If odds are stale, unavailable or not authorized, show the unavailable state.
    - The cron reports "no production model" as an explicit non-success or skipped state.
    - Verify actual page and homepage behaviour before describing it.
43. **Drop the 0.52 pick rule.** The pick follows the displayed probabilities; at exactly 50% show a tie or no pick. Home ice belongs in a qualified model. This doesn't activate or validate the unserved model.
44. **Game-page Poisson chart:**
    - First verify reachability (Astra: imported but maybe not rendered), and keep it unserved until inputs and output are accurate and defined.
    - Goal: a score distribution grounded in a qualified game model (both teams plus context), sharing Game Grid's calculation where definitions match.
    - Any illustrative historical-rate version is labelled as such and never presented as a win forecast. Define tie, OT and SO handling first; test both the distribution and the win-odds conversion. Relabelling alone doesn't activate it.
45. **Overtime rule:** one shared, documented rule converts regulation ties to final win probabilities.
    - Use a split fitted on historical tied-after-regulation games only if it beats 50/50 in time-based held-out testing, with season and rule context, sample size and uncertainty. No assumed home edge.
    - Until then, use **50/50, labelled as an approximation**. Probabilities sum to 100%, and regulation and OT/SO outcomes are tested separately.
    - Verify which conventions are actually reachable.
46. **Yahoo goalie W/L/OTL:**
    - Verify Yahoo's official definitions and stat IDs, and score only what each league uses.
    - Keep regulation L and OT/SO L distinct in the forecast; combine only where a verified provider category says to.
    - W, regulation L, OTL and no-decision reconcile to the start/appearance probability, never L = 1 − W. Add tests per outcome and per league type.
    - Until verified, label the mapping **unresolved**; the 35% estimate is not assumed.
47. **Forecast coverage in RSO:**
    - Goal: every eligible player has a usable, qualified forecast. Investigate and fix missing FORGE lines (reserve path, eligibility, freshness), with an evidence-based sparse-history fallback that shows its source and uncertainty. Never a fabricated zero or a full-confidence label on an unvalidated fallback.
    - Until coverage is complete, lineup totals are **incomplete** with the missing count, and those players are **unknown** for drops and rankings (no auto-drop).
    - Measure coverage across the eligible pool, and test fallback, totals and recommendations. Any migration, backfill or activation is a separately scoped action.
48. **Streaming rank.** Until a form blend is validated, rank on **qualified projections** on the same scoring, participation and horizon basis.
    - Account for the full legal swap and usable games. A missing projection is not 0, and a one-game streak never beats a stronger forecast.
    - In parallel, build and evaluate a same-basis, sample-aware, shrunk form component against projection-only and other baselines on held-out dates, with role, opportunity and schedule context where supported.
    - Adopt it only if it improves real roster decisions, showing evidence and uncertainty. Shrinkage strength is a parameter to validate.
49. **"Most starts" plans with a drop are not safe when the dropped player's value is unknown.** Fix coverage so the full swap can be valued. Until then, mark the plan "needs review", say whose value is unknown, and never auto-recommend or execute it. A known points cost still isn't automatically safe: league scoring, roster fit and longer-term value matter.
50. **Last-day drops:** evaluate the full tradeoff (in-range gain, the dropped player's value beyond the range, replacement path, league settings, matchup).
    - If the longer-term cost is known and favourable under the user's objective, it may be suggested. Don't assume the player can be reclaimed.
    - If the cost is unknown, mark it "needs review" with a warning. The manager decides.
    - Support planning horizons (including a final matchup), with assumptions visible.
51. **Category leagues: show starts versus ratio as a tradeoff** until category-aware valuation is ready. Never auto-rank one more start above a materially worse GAA or SV%.
    - Show the projected impact per category, including volume, ratio denominators and minimum starts.
    - Build toward a real category objective (league settings, matchup or standings, full-roster totals), comparing category win probability and standings gain on held-out outcomes. Uncertainty stays visible and the manager sets priorities.
52. **Reserve projections are prepared for activation as a separately reviewed production step.**
    - Verify the migration against the current schema, check coverage of the eligible missing players, and confirm the inputs, scoring, participation, hits, blocks and shutouts are sound.
    - Test sparse-history players, with the fallback's source and uncertainty visible.
    - Measure coverage before and after with one eligible-player definition.
    - Present the migration, rollout, resource impact, recovery plan and checks for approval before applying anything. Meanwhile, unknown plus incomplete totals.
53. **Off-night value is measured, not fixed.**
    - Measure incremental usable games from schedule and roster configurations (off-night and busy-night lineup fit), and use the user's own fit where roster and settings are known.
    - General tools (Game Grid) get a transparent default derived and validated from representative scenarios, with assumptions shown. 1.67× and 1.25× are not facts.
    - Share the definition where the products measure the same thing, and label any differences. Test on held-out weeks, and show off-night games and raw games separately.
54. **Default points weights are labelled "FHFH default".** Connected leagues use their own verified settings, and unconnected users can edit. Never call them Yahoo defaults unless verified. Show the active scoring source and weights, and flag unmappable league categories rather than silently applying defaults.
55. **OT losses in category value follow each league's settings**, with direction from the provider (Yahoo `sort_order`, ESPN reverse flag) through one stat registry.
56. **Pickup boost and idle teams:**
    - In the selected window, mark players whose teams have no games left, and show their in-window contribution as 0 when the schedule is verified.
    - Exclude idle teams from the boost normalisation.
    - Immediate-streaming views rank them after players with usable games but keep them visible and searchable. Longer-horizon views evaluate them on that horizon.
    - Users can filter them out. A verified empty schedule ≠ missing schedule data (unknown).
57. **A real category-aware Roster Optimizer.**
    - Evaluate the full lineup and swap against the league's actual categories, direction, slots and scoring period, with ratio denominators, goalie minimums and combined roster impact, not just summed z-scores.
    - Fix and qualify the category scoring first. Compare roster-relative z against matchup or standings gain on held-out periods, show tradeoffs and uncertainty, and let the manager set priorities.
    - Until qualified, label schedule-capacity results as such.
58. **Team Power Terminal:**
    - The 100-centred rating is primary, on a diverging bar centred at 100 with a labelled, consistent scale.
    - Rank or percentile only if the population is complete and correct, labelled separately; the rating is never a percentile.
    - Sort risers and fallers by actual change over a stated period. Sparklines come from real dated history, or show "unavailable".
    - Fix the underlying all-team rating first.
59. **Ice time is split into ES, PP and PK** (`proj_toi_pk_seconds`).
    - Define how OT and extra-attacker time are classified, with an explicit other/unknown bucket if needed. The categories are mutually exclusive and reconcile to total TOI, with no double-counted PK.
    - Update consumers and migrations together, keep units, and test missing data and unusual states.
    - Never relabel historical values as true ES.
60. **FORGE rest buckets.** Keep legacy in production, clearly documented, until a replacement is qualified.
    - Backtest the newer tiers using only pregame information, against both the current model and a **no-rest baseline**, with the impact measured **after full team reconciliation**. Check outcomes and calibration on held-out dates, with enough samples per tier.
    - Adopt them if better. If not, try a simpler rest feature before deciding what to remove.
    - Never keep an unreachable tier as though it were active.

## Decisions on the Batch B/C consolidation's open questions (TJ, 2026-11-11, by pop-up; intent preserved, condensed by Chef)
61. **Sustainability windows support both views.**
    - The default is a **current-season** view showing the actual n when fewer than N games exist.
    - An optional **last-N across seasons** view is labelled with its seasons, dates and sample size.
    - In both views, evaluated games are excluded from the player baseline and from any league prior used to judge them, and only pre-window information is used for historical evaluation.
    - Account for team, role and opportunity changes, and show uncertainty for small samples. Calendar L7/L14/L30 windows (decision 18) stay distinct from last-N windows.
62. **Category value contract.**
    - Use a league-aware pool (rostered positions, slots, bench, goalie requirements) when settings exist. Generic rankings use a clearly labelled, configurable reference pool, with eligibility and replacement level explicit.
    - Value SV% and GAA by their effect on the combined roster's saves, shots against, GA and playing time, not raw rate z alone. Respect direction and minimums.
    - No second shrink without justification. Missing or insufficient exposure is not zero.
    - Test pool and valuation approaches against baselines on held-out league outcomes. Show source, assumptions, sample and uncertainty, and never present an unvalidated z as a guaranteed standings gain.
63. **Unconditional goalie lines include relief.**
    - Line = P(start)·E[stats | start] + P(relief)·E[stats | relief]. Roles are mutually exclusive for the target game, and no-appearance is accounted for.
    - Relief probability, minutes and outcomes are estimated from history, with shrinkage and uncertainty.
    - Conditional-start, conditional-relief and unconditional lines stay distinct. SA, saves and GA reconcile, and W, regulation L, OTL and no-decision follow the actual credited outcome, never "starter gets the decision".
    - Validate against a labelled zero-relief baseline on held-out games, and disclose the omission until relief is qualified.
64. **Game Grid win odds are withheld now**, along with their Week Score nudge, behind a "model odds unavailable" message. The rest of the grid and Week Score keep working, with the calculation explained.
    - Repair and evaluate on genuinely pregame, held-out games with home ice and aligned inputs, against baselines and (where authorized) de-vigged market probabilities.
    - Restore only when the model and its consumers qualify. A separately labelled, authorized market probability may be shown, never silently substituted.
65. **Mean forecasts are evaluated with proper scores.** Use squared error, or Poisson/NB deviance and log score where a valid distribution is supplied with appropriate zero handling. MAE is secondary only.
    - Evaluate by stat, population and horizon against baselines on held-out games, plus downstream decision impact for fantasy uses.
    - Don't force one distribution on every stat. Document the scoring rule, exclusions and sample sizes.
66. **Starter-board baseline policy.**
    - Evaluate the existing 300-minute policy alongside the grid's values and baselines, using pregame inputs on time-based held-out games.
    - Select by the documented process. The issuer then consumes the **exact versioned artifact** selected, and each issuance records version, training cutoff and selection evidence.
    - If no candidate qualifies, keep production behaviour explicitly labelled and never claim it won. Test that the issuer matches the artifact, and that a missing or stale artifact produces a clear, safe state.
67. **Manual RSO comparisons with an unknown drop are allowed when the manager explicitly requests them.**
    - Show the known in-range effects, name the player whose value is unavailable, and label the result **incomplete: dropped-player value unknown**.
    - No definitive net gain, no "safe" label, never ranked above complete comparisons, never auto-proposed or executed.
    - A defensible fallback shows its source and uncertainty, never a fabricated zero. The manager controls any move.
68. **Sustainability league reference** is versioned and point-in-time, built only from pre-window information.
    - Define and label the comparison population (position, per-metric minimum exposure), kept separate from the player's own baseline.
    - When current-season evidence is thin, use a documented, appropriately weighted earlier reference or prior, with weighting and thresholds validated (no one-size cutoff).
    - Record source seasons, cutoff, sample and version so history is reproducible. Show when the reference is sparse or unavailable, and never describe a percentile or standardised score as a calibrated probability.

## Decisions on the Wave 2 consolidation's Tier A questions (TJ, 2026-11-11, by pop-up; intent preserved, condensed by Chef)
Source: `WAVE2-CONSOLIDATED.md`, "Owner decisions still open" Q1, 5, 6, 9, 18, 19, 22, 26, 27, 33 and 36. The 29 Tier B questions are asked by pop-up when the lane that needs them starts.

69. **NST season-long views are regular season only** (game type 2). Playoff views come later as their own views. (Q1, W2-P0-1)
70. **Strength classification follows the penalty and manpower context, not a raw skater count.** (Q5, W2-P0-2)
    - PP/PK come from actual penalty-advantage context. 4v4 and 3v3 with no penalty advantage are ES.
    - Empty net / extra attacker is a **separate attribute that can overlap** ES, PP or PK. A 6v5 is not automatically a PP, and pulled-goalie events are not forced into their own exclusive bucket.
    - Verify and save the current NST and official NHL definitions before mapping their numbers or claiming parity. Where they differ, keep source-specific definitions and label the difference; never silently mix them.
    - Apply one classification to events and exposure time. Fixtures: 6v5 without a penalty, pulled goalie during a real PP or PK, 4v4, 3v3, penalty expiry, overtime.
    - The mutually exclusive strength totals reconcile to total time, and the overlapping empty-net attribute is not double-counted.
71. **One qualified, source-attributed PP clock drives displayed PP time and shares.** (Q6, W2-P0-13)
    - Evaluate the penalty-box simulation against official game records and the saved NHL/NST definitions across regulation, OT, penalty expiry, overlapping penalties and extra-attacker states.
    - Confirm complete game and player coverage; a verified zero is distinct from a missing or partial record.
    - It becomes the canonical display source once those checks pass.
    - FORGE's modelled split stays labelled as a model input, repaired or reconciled where needed, and is never displayed as observed PP time.
    - Player PP time and share use matching team/game exposure and the same classification. **Never cap an impossible percentage**: flag and investigate the mismatch.
72. **Line-card goalie record = the goalie's own credited decisions.** (Q9, W2-P0-12)
73. **Variance-page skater advanced columns.** (Q18, W2-P0-8)
    - **Now:** show iCF/60 only when it uses the player's individual attempts with matching, complete TOI exposure. Hide IPP and ixG/60, or mark them unavailable, until their inputs are wired and verified; never show missing data as zero. Don't delay this display correction for the integration.
    - **Same workstream:** implement the intended metrics from matched NST or other qualified sources. Keep individual iCF/60 and ixG/60 distinct from on-ice CF/60, and compute IPP from matching on-ice goal and point definitions.
    - Before any join, verify source, season, strength, game window, player identity, units and coverage. Pool numerators and denominators; never average per-game rates.
    - Test the actual page output on single- and multi-game fixtures, including missing TOI and partial coverage. Restore each column only when its data and label are verified.
74. **Rankings composites are 0–100 scores, labelled with what they measure, never formatted as percentiles.** (Q19)
    - A percentile, if shown, is computed separately: the player's actual rank in a clearly identified, qualified cohort (same season, position, strength and window), with cohort size, minimum-sample rules and consistent ties.
    - A weighted average of percentiles is never presented as a true percentile.
    - BEAST thresholds stay tied to the scale they were designed for until the score and inputs are repaired and validated. If the scale or cohort changes, re-evaluate and **version** the thresholds; don't carry old cutoffs over automatically.
    - Missing inputs follow an explicit, visible policy, never silent zeros.
75. **Ranked GAx and Unrealized xG are window counts in goals**, with per-60 as separate, labelled columns. (Q22, W2-P0-11)
76. **Draft base score = a qualified, league-aware VORP, with VONA shown separately.** (Q26, W2-P0-14)
    - First correct and validate replacement level: positional eligibility, multi-position assignment, league slots and bench assumptions.
    - VONA joins the score only once its definition is fixed **and** a blend improves decisions in held-out draft replays.
    - Roster need and positional scarcity stay visible as separate factors, and can't arbitrarily reverse comparable players without an explainable reason.
    - Show the league settings and reference pool. Label incomplete replacement values or projections as such.
77. **Replacement reference.** (Q27)
    - Season totals, awards and cross-scenario comparisons use a **frozen, league-aware, versioned and labelled** replacement reference.
    - Bench treatment comes from the league's settings and the measure's purpose; it isn't universally excluded.
    - Live draft decisions separately evaluate the available pool and actual roster fills (multi-position eligibility and UTIL), labelled as current availability or scarcity. They never silently change the frozen VORP baseline.
    - Slot assignment is globally consistent, not greedy, with multi-position counterexample tests.
    - Document pool, settings, cutoff and missing-player treatment, and validate both measures before they drive recommendations.
78. **Non-appearance settlement uses identity-complete receipts from stored final official boxscores**, with no new provider calls, when those records carry the roster and participation details. (Q33, W2-8 D1)
    - Verify game finality, player identity and team/roster scope. Distinguish an official non-appearance from a missing, incomplete or unparseable record; a matching row count is not proof.
    - When stored evidence can't establish the eligible universe and outcome, leave the player **unresolved** and name the evidence or producer needed.
    - Confirmed non-appearance scores 0 **only on unconditional forecasts**; verify that the accuracy scorer includes them. Keep the receipt, source version and settlement time.
79. **External use of `/api/v1/forge/scoreboard` is unknown.** (Q36)
    - Check documented integrations and available access logs or other evidence. Absence from the codebase isn't proof of no external use.
    - Keep the endpoint contract while investigating. Set W2-8 D1's priority from verified consumers and impact; make no production change on this answer alone.

## sKO and VuDu (TJ, 2026-11-11)
The binding definitions are in `OWNER-INTENT-SKO-VUDU.md` (TJ, written with Codex, 2026-11-11). w3-7 is handed to Astra.

80. **The other sKO variants are kept and defined, not discarded.** The legacy points × stability score, sustainability "sKO score model v3" and `combineSKO` all describe the *likelihood of sustaining current production relative to baselines*. Each gets a written definition and its own name. Any of them may be blended into sKO **if evidence shows it is useful** (decision 32: inputs and weights earn their place out of sample). None is reinstated as sKO merely to resolve the name, and none is deleted (rule 6).

## Decisions on the Wave 3 consolidation's Tier A questions (TJ, 2026-11-11, by pop-up)
Source: `WAVE3-CONSOLIDATED.md`, "Owner decisions still open" Q42 and Q49. The 15 Tier B questions (and Wave 2's 29) are asked by pop-up when the lane that needs them starts.

81. **WiGO PP/PK cohorts get a per-strength minutes floor, and forwards and defencemen are compared separately.** (Q42, W3-1 D3) The floor is visible and user-lowerable (the Wave 2 sample-floor pattern), validated by split-half stability, with "insufficient sample" shown below it.
82. **Share cards show the goalie's credited W-L-OTL**, extending decision 72; the record is unavailable if any decision is unknown. (Q49, W3-3 D2)

## Decisions on Tier B questions at fix-lane start (TJ, 2026-11-11, by pop-up in the fix-sprint Chef session)
83. **Missing stats placeholders** (Q30, L1): the writer stores null when PP/SH TOI or faceoffs are absent; labels come from WGO or shift seconds; repairing historical `00:00` / `0/0` rows is a separate approved step.
84. **Empty-net goals** (Q31, L1): EN = scored into the opponent's empty net. A goal scored while the scorer's own net is empty keeps its official strength.
85. **Game Score** (Q2, L4a/L4b): keep the house variant, labelled "FHFH Game Score (all-situation goals)" with its formula shown, until a verified 5v5 goal source exists.
86. **PP deployment share** (Q4, L4a/L8): show **both** as separately labelled measures: PP1 share of games with a recorded PP-unit assignment, and PP1 share of games dressed. Each uses its own matching, verified denominator and shows coverage; missing assignments stay unknown, never confirmed non-PP games. Downstream tallies, social cards, draft and RSO readers name the measure they use explicitly.
87. **`team_discipline_stats` trigger** (Q40, L4a): leave it for the cleanup inventory (rule 6); any disable is its own production step.
88. **xG approval floor** (Q44, L14): the 5% relative standard-error rule is a minimum, computed from the actual holdout (not a fixed goal count). Evaluate the exact artifact that would be served, including its applied calibration, on a separate untouched chronological holdout. It must beat the base-rate benchmark on proper scores, pass calibration and relevant subgroup checks, and show no outcome leakage. With insufficient evidence the model stays unapproved.
89. **Stats-page goalie qualifier** (Q46, L17): keep the house rule (a quarter of mean team GP, by appearances), print it on the page, compute it from the displayed season, show "unknown" when standings fail, and use an explicit tie policy.
90. **Percentile conventions** (Q41, L4b/L5/L17/L18; TJ replaced his first answer the same day): **mid-rank everywhere**, including Rankings, WiGO, social cards and the player radar. Tied players get the same mid-rank percentile. Rankings values and tests for tied players are updated accordingly (this supersedes Wave 2 W2-4 D11 / Wave 3 W3-6 "do not change the exclusive percentile in `rankingCalculator.ts`").
91. **Ratings overlay on historical tables** (Q12, L2): hide it for non-current seasons or ranges; when current, show it with its snapshot date.
92. **Record columns under split filters** (Q13, L2): hide W/L/OTL and points outside all strengths and all score states.
93. **Landing SOS** (Q14, L2): record-only for now, labelled as such; revisit after L12's ratings fixes.
94. **"Last N" on a split** (Q15, L2): the player's last N games played (decision 16), with split numbers inside them; split GP = games with time in the split, labelled.
95. **Team "# of GP"** (Q16, L2): each team's own last N games by date, merged with "# of Team GP".
96. **Players with no position** (Q17, L2): shown, labelled "position unknown".
97. **Goalie week tiers** (Q10, L3): starters only (≥ 1 start, ≥ 20 min); ties get half credit (all-tied = Average); missed weeks excluded; weeks played shown.
98. **Sample floors** (Q11, L3 and L5 composites): a visible, user-lowerable default floor (e.g. 5 starts) with "insufficient sample" below it.
99. **In-house xG after the event-layer change** (L1/L14): accepted. L1 and L14 release together; xG features are versioned (v2), so the v1 champion `cfg9bac2706` cannot score new games and in-house xG for new games shows "unavailable" until a leak-free v2 model passes the decision-88 gate. Training and approving that model is its own approved step; stored history stays until the approved demotion (decision 5). NST xG stays the headline (decision 6).
100. **Empty-net shots in the xG adjusted-impact regression** (L14): a strength covariate alone does not establish that EN shots are handled appropriately. Compare a model excluding them with one that explicitly identifies and handles empty-net situations, on held-out data and the intended impact target; document the chosen definition and evidence. Until then, label the current treatment unvalidated.
101. **Shadow scoring (`allowUnapproved`)** (L14): keep it for clearly labelled shadow scoring, with: unapproved status persisted through storage; exclusion enforced in every serving and aggregate path, proven by end-to-end tests covering direct reads and downstream consumers; restricted access to the shadow-scoring operation; model version and provenance recorded. A candidate never becomes approved or served because shadow scoring succeeded.
102. **Composite missing inputs** (Q20, L5): refuse the composite when a required input is missing (MCM policy), shown as "insufficient data"; no silent reweighting.
103. **Rankings last-N across seasons** (Q21, L5): current season by default with the actual n shown (decision 61 pattern); an optional, labelled cross-season view.
104. **Goalie matrix strengths** (Q23, L5): one strength per view; drop Value Signal until it is defined.
105. **Deployment peer group** (Q24, L5): the player's most-used line over the selected window, based on verified shared ice time, with the basis and coverage shown. Show the most recent line separately when it differs; never silently substitute it. When evidence is insufficient or tied, label the assignment uncertain rather than guessing.
106. **RBS and Steal** (Q25, L5): the RBS column uses Vollman's definition, clearly labelled. The existing 5v5 GSAx-based measure and Steal stay as separately named FHFH measures with their exact rules and strength scope visible. Verify each measure's inputs and denominator before displaying it.
107. **What is a "line"** (Q7, L8): the most-used observed 5v5 units, after L5's shift-overlap repair of `team_unit_toi`; the all-strength grouping stays as a labelled legacy view. Applies to `/lines` and FORGE's line prior.
108. **PP unit minimum** (Q8, L8): below a validated share of the team's PP time a deployment is "incidental", not PP1/PP2; the floor is fitted and validated, not guessed.
109. **Homepage pulse with no qualified game model** (Q45, L16): hide the model series; show nothing model-based until a qualified model exists (decision 42).
110. **Goalie summary readers** (W2-3 DR1, L2-landing): point the goalie underlying-stats readers at the goalie summary partitions (same pattern as players and teams), with a freshness and completeness check, falling back to building from raw payloads only when the partition is missing or stale; prove it at the served goalie routes. Snapshot seeding must not copy a stale partition.
111. **Goalie underlying-stats release order** (L2-landing, decision 110 follow-up): serve no pre-fix goalie rows. Deploy, then immediately run the bounded goalie summary rebuild (its own approval); until it finishes the default goalie landing is empty with a "recalculating" note.
112. **Quality Start definition** (W2-4 D9, L5; TJ by pop-up in the fix-l5-goalie session, 2026-11-11): use the original Vollman rule: a credited start with SV% at or above the league average, or at or above .885 when facing 20 or fewer shots. One shared implementation, credited starter only (decision 40).
113. **UTIL eligibility** (Q28, L13): any non-goalie fills UTIL when computing replacement levels (matches the dashboard allocator).
114. **Category-league draft winner** (Q29, L13): projected category standings from each team's starting slots, ratio-aware (SV%/GAA by effect on totals, decision 62), ranked.
115. **Projections ranks** (Q43, L13): show an overall skater-plus-goalie rank only when both are valued on the same qualified league-scoring basis, plus a rank within position. Label the scoring basis and position grouping. When comparable valuations or required inputs are unavailable, withhold the overall rank rather than mix incompatible numbers; show qualified position ranks where possible.
116. **NHL schedule odds** (L22; TJ by pop-up in the L22 session, 2026-11-11): the NHL schedule's partner odds are an authorised source for the labelled market probability (decision 42); odds bars stay labelled same-book.
117. **Ties in game-prediction accuracy** (L22; TJ by pop-up in the L22 session): an exactly-50% pick is a tie (decision 43); ties are excluded from accuracy and counted separately (`tieGames`).
118. **Top Adds week objective** (Q47, L12): expected fantasy points over the games actually left this week from qualified per-game projections (decision 48); demand and ownership shown as separate columns.
119. **FORGE physical-totals migration** (Q3, L9a): apply now, as is (TJ, 2026-11-11). Applied 2026-11-12 ~02:30 UTC by Chef via the session pooler (authority row 88). The prior-season cutoff gap (W2-1 C8) stays a known gap; L9a adds the guard as a successor migration through L4a.
120. **Bench in the frozen replacement reference** (L13, decision 77 follow-up; TJ by pop-up in the L13 session, 2026-11-11): bench slots (any position) are included in the frozen, league-aware replacement reference.
121. **Season evaluator goalie outcome context** (Q52, L15): no game-context multiplier on W/L/OTL/SO/QS until decision 38's fitted goalie model, inside a versioned, coherent outcome treatment.
122. **Post-freeze newcomers on the season page** (Q53, L15/L10): a line labelled "population prior", unknown targets null, no role odds shown.
123. **Season page team "lines"** (Q54, L15/L10): relabel "projected ice-time order"; withhold PP/PK units until strength TOI is real.
124. **Legacy public routes** (Q50, L19/L20): one bounded read-only log check for `/api/Averages/[playerId]`, `/api/ThreeYearAverages/[playerId]` and `/api/v1/ml/get-predictions-sko` (decision 79 pattern, its own approval); unit and label fixes go in regardless; gate the sKO read API only if no outside caller is found.
125. **Team power score** (L12, decision 19 follow-up; TJ by pop-up in the L12 session, 2026-11-12): one power score = (offense + defense) / 2; the shrinkage prior weight is a linear ramp reaching full data weight at GP 10, applied after normalisation against the fixed all-team baseline.
126. **`LEDGER_MARKET_ENABLED`** (Q32, L10): off until decision 30's market fixes ship and are validated; turning it off is its own env-change approval.
127. **Forecast lead-day and calendar date basis** (Q35, L10/L11): NHL schedule dates, as one versioned change shared by issuance, replay, bridge, coverage, planning and evaluation (rule 19).
128. **Unassigned start share** (Q34, L11): show it on the team-game and mark goalie totals incomplete with the count (decision 47).
129. **Legacy sKO crons** (Q51, L20): keep `update-sko-stats` (history for decision 80's evaluation); pause `update-predictions-sko` until it is renamed and defined; delete nothing; each cron change is its own approval. TJ adds: **define `predictions_sko`, vet it, fix it and optimize it** (L20's scope).
130. **Sko Element interim label** (Q55, L21): the signed gap with its units only; no Rebound/Cooling words until an alert contract exists.
131. **sKO summary** (Q57, L21): keep gap, support and opportunity as separate components; choose any composite, scale or headline only after held-out evidence (decisions 32, 65).
132. **Players without a FORGE line, availability and plan comparisons** (W1 P0 #27, decisions 3/47 follow-up; TJ by pop-up in the L11 session, 2026-11-12):
    1. Plan comparisons are difference-based: an unknown player's contribution cancels only where it is demonstrably unchanged in both plans; totals show incomplete with the unknown count; the comparison is unavailable when unknown contributions differ; an unknown player is never auto-dropped.
    2. FORGE builds a projection for **every eligible player**, including injured players and long absences, with a distinct "if he plays" line. A returning player is based on his last active games with a validated time-away decay that widens uncertainty (no fixed-rate decline).
    3. Availability is separate: a confirmed out shows 0.0 for that game (RSO) and keeps the if-active line; uncertain availability uses a qualified participation probability, shown as such; missing data is never a confirmed 0.
    4. Implement and validate the coverage path, including reserve projections. Any production migration or backfill is its own approval.
133. **Legacy averages scale** (W3-3 A2, L19; TJ by pop-up in the L19 session, 2026-11-12): every share in the legacy averages routes is on 0–100 points, served under one versioned contract (`legacy-averages-v2`); xS% = ixG ÷ iFF (decision 17).
