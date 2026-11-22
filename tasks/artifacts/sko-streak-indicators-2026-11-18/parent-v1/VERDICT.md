# Sko Element · Hot and Cold Streak Indicators

**Use the descriptive chart locally. Keep all six predictive alerts pending.** The best research lead is sustained high production over the next five appearances. The frozen process model beat a short-window scoring baseline, but a longer personal scoring history recovered nearly all of the ranking gain and had better precision-recall and probability accuracy. Cold onset, continuation and exit lack evidence for an incremental process alert. [Open the player chart](http://127.0.0.1:3167/sko-element/streaks) · [Hot and Cold Indicator profiles](INDICATOR-PROFILES.md) · [Paired six-decision tables](RESULTS.md)

## What the manager can read today

Select any of 920 skaters. Each bar is one played game. The solid line shows the most recent five appearances, and the dashed line shows the preceding 20. Two consecutive closes at least 0.40 NHL points/GP above or below that personal reference confirm a hot or cold episode. The chart marks the first breach, confirmation and first outside game. Choose **As known then** or open a cutoff link to see the evidence through that close. Choose historical explanation to inspect what followed. These are reconstructions from retained final statistics; the archive does not establish when a provider first published or revised a value. [Chart and restart instructions](CHART.md) · [Screenshot](chart-debrincat.png)

The 2024–25 ledger contains 47,224 played appearances in 1,312 official games. It identifies 890 hot and 711 cold episodes, 113 unobserved exits, two unknown cold starts and 19 continuity breaks where short team sheets left an appearance uncertain. There are 19,066 insufficient-history appearances. All 549 apparent pilot ordinal resets occurred between consecutive verified appearances. Preserving the original resets for A and correcting them for the chart and B avoids treating file behavior as a change in the player. [Versioned ledger](games.csv.gz) · [Episode identities](episodes.csv) · [Relative-game memberships](phases.csv.gz) · [Data audit and source limits](DATA.md)

## What the models earned

| Question | Frozen development result | Product verdict |
|---|---|---|
| Hot onset | For the pilot's exact label, scoring .901 AUC and process .899. For a wholly forward five-game scoring block, scoring .550 and process .642. Against the longer scoring comparator, the frozen process gain was +.003 [−.029, +.036]. | Research candidate only. |
| Hot continuation | Next-close AUC fell .935 → .895. Next-five AUC rose .501 → .557 with a zero-crossing gain interval and worse Brier. | Withhold. |
| Hot exit | On the next-close exit, scoring alone ranked better. Five-game exit precision was 86% at a 79% base rate, with worse probability accuracy. | Withhold. |
| Cold onset | Next-close-breach/confirm AUC fell .981 → .932. Forward AUC fell .834 → .810. On reachable forward cases alone the comparison was .608 → .601. | Withhold. |
| Cold continuation | Next-close AUC fell .823 → .774. Next-five AUC was .601 for both, with worse Brier for process. | Withhold. |
| Cold exit | Next-close AUC fell .823 → .774. Five-game exit precision was 80% at a 71% base rate, with worse Brier. | Withhold. |

The upper rows of the pilot chart can be predictable because upcoming rolling averages reuse games already observed. The outgoing score matters. The forward target uses only appearances t+1 through t+5 against a reference fixed at t. The corrected same-season March–April validation is development evidence. No genuinely untouched later block was available under this assignment. [Frozen protocol](FREEZE.md) · [Baseline ladder, sample sizes, uncertainty, alert lead and calibration](RESULTS.md)

Two checks changed the interpretation of forward hot onset.

- **Uneven feature availability.** Pilot enrichment was absent on every player's final appearance. Excluding all pilot-only fields and their missingness indicators preserved a gain of .089 AUC [.046, .126] against short-window scoring. That reduces concern about this particular artifact. First-published values and revision timestamps are still missing. [Lineage sensitivity](evaluation/forward/lineage-sensitivity-gains.csv)
- **Established scoring ability.** On the same 6,778 issues, a post-hoc scoring-only comparator added season-to-date scoring and eligible earlier player-season rates. It achieved .639 AUC, .249 AP and .1055 Brier. The frozen challenger had .642 AUC, .206 AP and .1078 Brier. Adding process to the longer comparator itself yielded .659 AUC, .234 AP and .1062 Brier. Neither comparison cleared the minimum useful gain, uncertainty and proper-score criteria together. The historical component was available on 6,587 issues and primarily reflected 2023–24. Only 33 appearances in 2022–23 passed the complete player-season identity rule. These comparisons use development outcomes already seen. [Paired comparison against the frozen model](longer-reference-frozen-pairs.csv) · [All six longer-history comparisons](longer-reference-results.csv) · [Historical coverage](longer-reference-history-coverage.csv)

## Two explicit alert cutoffs

The examples use the frozen forward hot-block alert and its training threshold. These scores are internal retrospective model outputs. The chart displays the observations. Each example's input row contains the scoring components and the level, change and direction for every candidate measure. The subsequent outcomes are in a separate file. DeBrincat had a false alert but no true hot-block alert in this validation period. The first chronological league hit supplies the positive example under the example-selection rule. [Issue-time inputs](example-issue-evidence.csv) · [Observed follow-up by official game](example-followup.csv)

| Known through the issue close | Anže Kopitar · Mar 1, 2025 vs STL | Alex DeBrincat · Mar 12, 2025 vs BUF |
|---|---:|---:|
| Game points; recent five / personal 20 (PTS/GP) | 1; 0.40 / 0.40, neutral | 4; 0.80 / 1.00, neutral |
| Contribution about to leave the five-game window | 1 point | 0 points |
| Recent total / PP ice time vs personal reference | −67.1 / +78.4 seconds per GP | −17.3 / +37.7 seconds per GP |
| Shots / attempts / high-danger chances vs reference | −0.70 / 0.00 / −0.20 per GP | +0.65 / +0.95 / +0.65 per GP |
| Individual xG change per GP / change per 60 | +0.010 / +0.062 | +0.178 / +0.617 |
| Goals minus ixG change; regressed shooting change | −0.160 per GP; −1.67 percentage points | −0.578 per GP; −8.59 percentage points |
| Primary / secondary assist change per GP | +0.05 / +0.10 | +0.30 / −0.10 |
| Recent mean off-days between appearances; club change | 3.2; none in five | 1.2; none in five |
| Scoring-only score (threshold .152) | .132, quiet | .150, quiet |
| Full process score (threshold .238) | .241, alert | .301, alert |

**Kopitar after the cutoff.** He scored 1, 0, 1, 2 and 1. His next five averaged 1.00 versus the frozen 0.40 reference. He first breached on March 9 and confirmed hot on March 11. The alert preceded confirmation by five appearances in this case. [Open Kopitar at the March 1 close](http://127.0.0.1:3167/sko-element/streaks?player=8471685/20242025&through=2024020957)

**DeBrincat after the cutoff.** He scored 1, 0, 0, 1 and 2. His next five averaged 0.80 versus the frozen 1.00 reference, well below the required 1.40. Even the March 22 chart breach failed to confirm. His four-point issue game and elevated shots, ixG and PP usage preceded a false alert. [Open DeBrincat at the March 12 close](http://127.0.0.1:3167/sko-element/streaks?player=8479337/20242025&through=2024021036)

## Secondary outcomes and goalie coverage

Under **FHFH Standard** skater league scoring, the prior 20 forecast the next five with lower mean squared error than the trailing five (0.921 versus 1.470, 8,784 complete issues). For **FHFH Game Score (all-situation goals)** the corresponding values were 0.201 and 0.266, with only 331 complete windows from 37 players. Required on-ice goal inputs were missing in 10,600 appearances. Both are separate continuous-outcome checks. Neither validates an NHL-points, fantasy-points or Game Score alert. [Contract, formulas and custody](SECONDARY-CONTRACT.md) · [Secondary results and uncertainty](secondary-results.csv)

VuDu needs a separate goalie history with official participation and start/relief, minutes, shots faced, saves/GA, matched shot danger, workload, reference exposure and dated availability. The skater ledger provides none of that goalie denominator, and the existing synthetic fixture cannot fill it. [Goalie design and precise evidence gap](SECONDARY-CONTRACT.md#vudu)

## Reproduce locally

From the canonical repository root, these commands rebuild the new study using the retained development files and the existing Python environment. Node 22.23.4 runs the repository’s pure secondary-outcome scorer. The scripts use fixed source paths and hashes on this checkout. The original pilot and its saved outputs are inputs to the literal replay.

```sh
source .venv/bin/activate
cd tasks/artifacts/sko-streak-indicators-2026-11-18/parent-v1
python data.py
python evaluate.py both
python lineage_sensitivity.py
python longer_reference.py
python relationships.py
python secondary.py
python tables.py
python -m unittest test_data test_evaluation
```

The local chart and its isolated browser check have separate [run instructions](CHART.md). Source coverage and dependency versions are recorded in the [data dictionary](DATA.md) and [evaluation notes](EVALUATION.md).

## Verification and next owner

The nine identity and phase exports reproduced byte-for-byte. Four data tests and four evaluation tests passed, including cutoff-prefix invariance, label boundaries, purge rules, clustered ranking ties and all 36 original pooled indicator contrasts across the requested decisions. The portable primary and scoring models reproduced all 6,778 validation scores to within 7 × 10⁻¹⁶ and every alert. Chromium exercised the mounted chart, both official-game cutoff links, a one-appearance cold run, unknown history/start, an unfinished hot run, keyboard/pointer selection and the 390-pixel layout. Scoped TypeScript and ESLint passed. [Data tests](test_data.py) · [Evaluation tests](test_evaluation.py) · [Frozen model replay](evaluation/forward/frozen-hot-onset-replay.csv) · [Browser receipt](chart-browser-receipt.json)

**TJ and the evaluation custodian own the next decision.** Before any independent qualification, authorize and seal a later cohort, its eligible population, receipt policy, enabled candidate and comparator, and a single scoring pass. One concrete prospective option is 2026–27 regular-season skater issues from December 1, 2026 through February 28, 2027, with each player's next five played-game outcomes or an explicitly censored end of follow-up by March 31. Record pre-issue player/game IDs, UTC result-ready and capture times, revision hashes, role/strength/exposure, and earlier personal scoring history, including at least the rolling 25 GP or an abstention. Keep the blinded outcome ledger with the custodian. Predeclare the longer scoring comparator and thresholds before opening outcomes. The Sko lead owns the replay and per-target verdict once those permissions and data exist. Product release remains a separate owner decision. No collection, sealed evaluation, deployment or public probability publication occurred in this study.
