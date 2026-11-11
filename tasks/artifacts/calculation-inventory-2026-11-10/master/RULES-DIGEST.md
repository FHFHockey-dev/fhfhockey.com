# Math audit: binding rules digest (Chef, 2026-11-11)

One-line form of `OWNER-DECISIONS.md` 1–68 and the consolidations' cross-cutting rules 1–12. It is binding. Where the code differs from a decision, that is a defect. Open `OWNER-DECISIONS.md` only for the numbered decisions your packet touches; it holds the full wording and wins on any conflict.

## Cross-cutting rules (apply to every finding and test)
1. Magnitudes are dated samples: give the sample size, date and reproducible inputs, never population rates.
2. AUC/Brier are alarms, not proofs. Prove leakage by feature lineage and counterfactual tests; calibration needs reliability bins, proper scores and paired time-ordered comparisons.
3. Test invariants must be mathematically right. Recompute from components on frozen inputs; league-relative values may legitimately move.
4. Fix every reader, not just a flag. List each reader and give it a selection test.
5. Unknowns stay unknown: never turn missing data into zero, "first row" or rescaled certainty.
6. No deletion because of a math finding. Inventory the dependencies first; cleanup is a separate decision.
7. Test the final served output, not an intermediate step.
8. Label each finding's reach: live, conditional (behind a flag or a dated table state), dormant, or research.
9. One estimand per comparison: conditional vs unconditional, regulation vs full game, team slot vs individual goalie.
10. An issued forecast is not a reconstruction. `.lt(date)` proves a date filter, not knowledge time.
11. Proposed tests must be valid statistics: algebraic identities on frozen fixtures, plus held-out calibration with stated uncertainty.
12. Suggested coefficients are hypotheses: fit and validate them, or label them as presentation choices.

## Owner decisions (one line each)
**Models, xG, NST**
1. Game win probability (`INITIAL_BASELINE_MODEL`) is a placeholder; benchmark it and specify a fitted replacement with home ice.
5. The leaky xG champion cfg9bac2706 keeps serving until the fix plan. Demotion must handle every consumer of its old aggregates.
6. The headline xG is NST's (labelled NST) until a leak-free in-house model is approved. The bucket heuristic is retired.
7. Empty-net shots are excluded from xG/GSAx/xGA totals and reported separately.
8. Rush = 4-second window, no faceoff sources.
9. NST-named metrics equal NST's definitions (on-ice vs individual, HDCF/SCF, OZS% = OZ/(OZ+DZ)).
10. GSAA = SA × (1 − league SV%) − GA, at the aggregate level (never summed per game).
11. Leading/Trailing include one-goal margins.
12. Hide the bucket-heuristic xG columns now; default sort moves off xGF%.
13. A penalty-shot infraction is not a penalty in player totals.
14. NST: 40/1 min, 80/5 min, 100/15 min, 180/60 min across all callers. A burst is ≤39 URLs, then ≥60 s; two bursts in a row, then a 5-minute pause. This applies in SQL, TS, Python and resumable callers.
15. The player radar is 5v5 and labelled so.

**Rolling, team ratings**
16. Rolling availability follows the team of record by date; label it "games available".
17. xSH% = ixG ÷ Fenwick on a 0–100 scale, with one name and one definition everywhere.
18. "Last 7/14/30 days" are calendar days ending today.
19. The power rating is a shrunk estimate, with the prior applied after normalisation against a fixed reference.
20. CTPI PP/PK rates are pooled by TOI: Σ(w·xG) ÷ Σ(w·TOI) × 3600.
21. SOS "past" means final games only. In-progress or postponed games are bucketed separately.
22. Created-xG credit is exclusive and capped at the shot's xG.
23. Luck = (G − ixG)/60 in the window vs a non-overlapping baseline, with matched exposure.

**FORGE**
24. Skater lines are all-situation totals (ES+PP+PK+EA), with empty-net goals in their own bucket.
25. Goalies get one row per candidate: if-starts line, start probability and unconditional product. The goalie's own Win is shown separately from team win %; no slot rescale.
26. The sustainability trend band regresses toward the band (never momentum); its size is fitted.
27. Opponent and venue shot terms are fitted on held-out games.
28. The multi-game horizon is kept: no probability × horizon scalar; use per-game values or 1 − ∏(1 − p).
29. Bands become a "typical range" with real coverage shown, exact quantiles, judged by PIT and interval score.
30. Sportsbook ingestion resumes only after the fixes: cover probability vs de-vigged price, per book, monotone yes-only de-vig.
31. A healthy scratch shows a labelled "if he plays" line and 0 expected for that slate. Scratches are scoped to a game id; injuries end on a RETURN event.
59. TOI is split into ES, PP and PK; categories are exclusive and reconcile to total TOI, with OT/EA classified.
60. Keep the legacy rest buckets until the new tiers beat them and a no-rest baseline after reconciliation.
63. Unconditional goalie line = P(start)·E[start] + P(relief)·E[relief]. W, regulation L, OTL and no-decision follow the credited outcome.

**Sustainability**
32. Definition: is current production supported and likely to persist relative to the player's own baseline? Luck is one component. Don't preserve the current blended formula; weights come from out-of-sample evidence.
33. The usual range is player-specific and sample-size-adjusted. Crossing it is not proof a streak continues; "supported" is judged separately.
34. Baselines use only pre-window information, shrunk toward a position prior. A player's streak games are never his own baseline.
35. Lists are renamed to what they measure ("Potentially Unlucky" …). A luck signal alone is never a trust/fade call. A percentile is not confidence.
36. The trend-band history gets a bounded rebuild after the 60× fix (its own approved step).
37. Count projections stay unserved as open work: fix opponent-PK direction and scale, then evaluate on held-out games.
61. Two window views: current season (show the actual n), and an optional labelled last-N across seasons. Evaluated games are excluded from baselines.
68. The league reference is versioned and point-in-time from pre-window data, with a labelled population.

**Player forecasts, game predictions**
38. Native forecast path: evaluate and complete it, don't activate it as-is. Shrinkage is fitted, not assumed; team win ≠ goalie win.
39. The 2025-26 lockbox is consumed. Intervals are labelled uncalibrated until independent evidence exists; collect prospective frozen 2026-27 forecasts.
40. "Quality Start" = Vollman's definition: one shared implementation, credited starter only.
41. The ledger scores each forecast on its declared basis (unconditional over the full eligible universe; conditional only on players who played). Unresolved outcomes are excluded, never zeroed.
42. With no production game model, show an "unavailable" notice and optionally a labelled de-vigged market probability. The cron reports a skipped state.
43. Drop the 0.52 pick rule; the pick follows the displayed probability, and exactly 50% is a tie.
44. The game-page Poisson chart stays unserved until it is grounded in a qualified model; verify it is reachable first.
45. OT split is 50/50, labelled, until a fitted split beats it on held-out data.
46. Yahoo goalie W/L/OTL mapping is unresolved until verified. W, regulation L, OTL and no-decision reconcile to the start probability.
64. Game Grid win odds and their Week Score nudge are withheld now behind "model odds unavailable".
65. Mean forecasts use proper scores (squared error, deviance or log score); MAE is secondary.
66. Starter board: the issuer consumes the exact selected, versioned artifact and records its version and cutoff.

**RSO, fantasy scoring, category value**
2. RSO recent form may influence rank only when shrunk by sample and on the projection's basis; the current 50/50 raw blend is a defect.
3. / 47. Players without a FORGE line: find and fix the cause. Otherwise they are unknown (no-data), never auto-dropped, and totals are marked incomplete with the count.
48. Streaming rank uses qualified projections only until a form blend is validated. A missing projection is not 0.
49. "Most starts" plans with an unknown drop are "needs review", never auto-recommended.
50. Last-day drops are judged on the full tradeoff; an unknown cost is "needs review".
51. Category leagues show starts vs ratio as a tradeoff; never rank one more start above a materially worse GAA/SV%.
52. The reserve projections migration is a separately reviewed production step.
53. Off-night value is measured from schedules and rosters; 1.67× and 1.25× are not facts.
54. Default weights are labelled "FHFH default", never "Yahoo default" unless verified.
55. OTL direction follows each league's settings through one stat registry.
56. Idle teams: 0 in-window when the schedule is verified, excluded from boost normalisation, kept visible. Missing schedule = unknown.
57. A real category-aware optimizer against the league's categories, slots and ratio denominators. Label schedule-capacity results until qualified.
58. Power Terminal: a 100-centred rating on a diverging bar; a rating is never a percentile; sparklines come from real history.
62. Category value: a league-aware pool (or a labelled reference pool). SV%/GAA are valued by their effect on roster totals, not raw z. No second shrink; missing exposure ≠ zero.
67. Manual RSO comparisons with an unknown drop are allowed, labelled "incomplete", never ranked above complete ones.

**Process**
4. Auditors may run bounded reads under the read-hygiene rules (see the prompt).
