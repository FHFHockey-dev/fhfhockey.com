# BLSH retrospective case review, and a proposed development forecast comparison

**Status: proposal and review only. No forecast was run, no list threshold was set, and 2025-26 was not opened.** Retrospective claims (sections 1–2) and predictive claims (section 3) are kept apart.

## 1. Frozen development cases (Astra audit, not redone here)

Astra checked all **29** frozen v1 development cases in `support-conditioned-ranking-v1/run-guarded-v1/CASE-REVIEW.json` (28 numeric, 1 unavailable). Checks that passed:
- reference/window separation and chronology;
- support-model cutoff and target exclusion;
- training-membership hashes;
- process adjustments, floors and normalized scores (maximum arithmetic error 1.78e-15).

The distinctions behave as intended:

| Case | Behaviour |
|---|---|
| Zero-shot (Gadjovich) | scoreable |
| Conflicting (O'Brien) | withheld from lists |
| Absent window (Timmins) | unavailable, not zero |

Limitation: a "fresh" window can span 26 days (Gadjovich) or 66 days (Patrick Brown). My port reproduces these cases exactly (parity, 0 mismatches), so I did not repeat that audit.

## 2. Current-season cases (dry run v2, A overlay)

These were chosen to cover weak as well as strong evidence, not to flatter the lists.

| Case | What the profile shows | Review |
|---|---|---|
| **Kovacevic, BL +66.9** | 5 games, 9 days; 50-game reference; process correction +2.43 | Strongest support-adjusted buy-low; process data agrees with the direction. |
| **Hyman, BL +65.4** | process −0.345; shots/60 6.2 vs 11.0 | Reference gap drives it; the observed shot drop argues against "buy". Show both. |
| **McDavid, SH −75.9** | G+A 16 vs 8.98; TOI up | A clear hot start; PP and linemate effects are not modelled. |
| **Coronato, SH −70.4** | 35-game reference; TOI 12.7 → 17.4 | A role change is plausible, and total TOI is already in the expected value. Not enough to call this regression. |
| **Doughty, conflicting −19.3** | reference and support gaps disagree in sign | Correctly withheld from lists. |
| **Landeskog, SH −30.2** | no 2022-24 history; cohort reference | Listed as provisional; the tier label must be shown. |
| **Justin Dowling, BL +19.3** | zero shots in 4 games; **2-game** personal reference, yet tier "measured personal reference" | Zero shots stays scoreable (correct). **The tier label overstates the evidence**: `personal_n > 0` is the only personal condition in v1. |
| **Adam Gaudette, BL +26.9** | **1 game**; 2-game reference | Listed on one appearance. |
| **Ilya Lyubushkin, BL +42.6** | **1 game**: FP 0.45 vs 1.23 expected | The value reflects normalization, not quantity of evidence. |
| **Andrew Mangiapane, SH −39.5** | 2 games, 26 days apart; TOI 7.1 vs 16.1 | Sparse, stale-window and role-change evidence in one listing. |
| **Ryan Shea, BL +27.8** | TOI 24.9 vs 12.6 minutes | Expected production scales with the new TOI; PP share and role are not modelled. |
| **John Tavares, unavailable** | 4 of 5 games qualified | Complete-window rule (unchanged). |

**Findings for policy (retrospective only):**
- Display personal games, window games and window span next to every score. Tiers alone overstate thin evidence (Dowling, Gaudette).
- One- and two-game windows reach lists with large values (Lyubushkin +42.6). This is a reason to define list membership by evidence quantity through a **documented, tested method**. It is not a reason to pick a cutoff that yields a desired list size.
- Most arm-B differences come from evidence availability, not performance (dry run v2). Compare baseline policies on matched-evidence cases first.
- Nothing above changes the frozen score or the complete-window rule.

## 3. Proposed chronological development forecast comparison (not run)

**Question:** using only information available at each origin, does the support-conditioned expectation predict a player's next five appearances better than the frozen prior-season mean, on identical origins? It is separate from the retrospective score. If it fails, BLSH stays a retrospective lens.

**Data:**
- **Primary:** origins in **2023-24**, with 2022-23 supplying the prior-season mean, the references and the support-model blocks.
- **Supplementary:** 2022-23 origins can compare only the arms that do not need a prior season, reported separately.
- **2024-25:** already exposed. At most a disclosed secondary check, after qualification.
- **2025-26:** reserved (section 4).

**Origins:**
- For each player, every 5th recorded appearance, so target windows never overlap within a player.
- Window W is the 5 appearances ending at the origin.
- Reference H, donors and support blocks are rebuilt at every origin from games strictly before W. `fitProductionPrior`'s later-donor guard stays in force. The current-season donor pool is not reused.

**Target:**
- Primary: the mean per appearance of each track (FP, G+A, WiGO GS) over the next 5 recorded appearances in the same season. This matches the 2024-25 validation units.
- Origins with fewer than 5 future appearances before season end are excluded and counted. Nothing crosses a season boundary.
- Secondary: per-60 rates, which remove the opportunity component.

**Arms**, with every prediction declared before any outcome is seen:

| Arm | Prediction per appearance |
|---|---|
| P0 frozen prior-season mean | player's previous-season mean per appearance (2024-25 validation definition) |
| P1 production reference | unchanged `position-exposure-reference-gap-v1` reference rate (per second) × declared TOI = mean TOI per appearance in W |
| P2 support-conditioned | P1 + (ΔX·B ÷ 3600) × declared TOI. This is `E_support` turned into a forward rate explicitly. |
| P3 recent form (control) | mean per appearance over W |

Realized future TOI is never an input. Per-appearance predictions are compared only with per-appearance targets.

**Eligibility:** the same origin set for every arm. That means a numeric production axis, an estimable support model, an available prior-season mean and 5 future appearances. Exclusions are reported by reason and by evidence tier.

**Metrics and inference:**
- MAE and RMSE per track, paired per origin. Contrasts: P2 − P0, P2 − P1 and P1 − P0.
- 95% intervals from a player-clustered bootstrap. Shared-game dependence is disclosed.
- Results are reported by evidence tier, position and window span.
- **One primary contrast is declared in advance: FP, P2 versus P0.** The other 8 track × contrast cells are secondary and labelled for multiplicity.

**Decision rule, set in advance:**
- A forward claim is allowed only if P2 beats P0 on FP with an interval excluding zero, **and** beats P1, so the process correction adds something on its own.
- Otherwise there is no predictive claim.
- No list threshold or score cutoff is chosen from these results, and the normalized score is never read as a probability or a z-score.

**Bounds and implementation:**
- Local only, with no database reads, run under the heavy lock.
- New code would need its own cleared paths: probably a pure evaluator plus tests and one opt-in runner. Nothing has been written yet.
- Estimated scale: about 900 players × about 15 origins in 2023-24, refitting at each origin. Origin-wise refits are the main cost; I'd estimate tens of minutes. A cost check comes first.

## 4. Reserved 2025-26 season: what must be frozen first

- **Prior exposure:** another worker has seen official full-game summaries for game **2025020500**. The season is not wholly unseen. Treatment frozen now: exclude every evaluation origin whose window W or target window contains game 2025020500, for every player who dressed in it.
  - Those players are identified only from that already-exposed summary, at freeze time, without reading any other 2025-26 data.
  - References that merely include that game remain allowed but disclosed.
- **Overlapping windows:**
  - Early 2025-26 origins have references built from 2024-25 (exposed) and 2023-24 games. That is permitted as features, never as targets.
  - Within a player, targets do not overlap (every 5th appearance). Across players, games are shared, which is disclosed dependence.
  - No 2025-26 data may enter donors, support blocks or the prior mean used for 2025-26 origins beyond what the protocol allows at each origin.
- **Freeze before opening:**
  - score definition and version;
  - features;
  - reference construction;
  - eligibility, including the complete-window rule;
  - forecast mapping (P1/P2);
  - metrics, primary contrast and decision rule;
  - origin schedule;
  - code and input hashes.
- **One run.** The complete result is recorded, including failure.
- **Afterwards:** 2025-26 may enter operational baselines. Any refit is kept separate from the frozen evaluation. If revised after seeing the result, 2025-26 is marked consumed, and confirmation moves to a later untouched or prospective period.
