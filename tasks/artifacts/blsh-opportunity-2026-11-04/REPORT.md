# BLSH opportunity comparisons (decision 3): method, validation and integration spec

Claude, 2026-11-04 (work dated 2026-11-03 local). Lane: opportunity. Module `web/lib/buyLowSellHigh/opportunity.ts`, version `blsh-opportunity-split-v1`. It is research only: retrospective, not a forecast, not trusted, no calibrated probability.

TJ's decision 3 (verbatim in `tasks/artifacts/blsh-brief-decisions-2026-11-03/DECISIONS.md`) asks for:
- two comparisons side by side;
- the TOI and PP changes, with their possible impact;
- conflicts shown rather than forced;
- an adjusted comparison shown as unavailable, never as zero, when it can't be supported;
- separate validation of the adjustment.

## 1. Summary

- **What the module returns.** For each track (FP, G+A, Game Score) it returns two comparisons:
  - (a) production against the player's established per-game baseline;
  - (b) production against the player's established power-play and non-power-play rates at the window's actual TOI split.

  It also returns the TOI and PP changes with their estimated effect, and an assessment that names any conflict.
- **What the validation shows.** On 7,587 development windows in 2023-24, splitting rates by strength removes most of the bias that total-TOI scaling leaves when PP time changes.
  - For PP increases of more than 60 s/game, the FP bias falls from +1.39 (total-TOI scaling) to +0.44 (split), against +2.30 for no adjustment.
  - For PP decreases of more than 60 s/game it falls from −0.77 to −0.19.

  Window role changes mostly fade: a median 35% of a 60 s+ PP increase carries into the next 10 games, and about 50% of a TOI change.
- **What changes on the 2026-10-28 snapshot.** On the FP headline, 7 of the saved sell-high players and 11 of the saved buy-low players have their per-game gap explained by a role change. They become balanced. Another 9 SH and 11 BL become balanced because per-game output is at baseline while the rates shifted. One SH player is withheld for an opposite-direction conflict.

  The new directional sets are 95 sell-high (8 of them qualified) and 152 buy-low (17 qualified). That count is before ranking, the top-25 cut and the lists lane's other gates.

## 2. Method

### State-split rates

These are computed from the player's own baseline games, optionally weighted (`summarizeOpportunityHistory`). Weights are normalised to effective games n_eff = (Σw)²/Σw², so uniform weights change nothing and pseudo-exposures keep their meaning.

| Track | PP part of a game | Non-PP part | Status |
|---|---|---|---|
| G+A | PP points (WGO `pp_points`) | the other points | exact split |
| FP (FHFH Standard) | each PP point valued at **3 + g**, where g is the player's goal share of points | the rest of FP | approximate. A PP point is worth 2 (an assist) or 3 (a goal), plus the 1-point PPP bonus. PP goals are not recorded, so g stands in. PP shots, hits and blocks stay in the non-PP rate. |
| Game Score | none | none | **(b) unavailable**, reason `no_strength_split_for_track` |

The rates follow from those parts:
- non-PP rate = (track total − PP part) / non-PP seconds;
- PP rate = (PP part + k·cohort PP rate) / (PP seconds + k), with k = `ppPseudoSeconds` = **3600 s**.

The cohort is a position-pooled prior-only rate, from `pooledCohort` or supplied by the caller. If no cohort is supplied and personal PP exposure is below `minPersonalPpSeconds` (1800 s), (b) is unavailable (`pp_rate_unsupported_without_cohort`). The exception is a window with no PP time, where the PP rate doesn't enter.

### The two comparisons

- **(a) Per-game baseline.**
  - Expected = n × weighted per-game mean.
  - Scale = per-game SD × √n.
  - No TOI scaling. This is the comparison that decision 3 calls "production versus the player's established per-game baseline".
- **(b) Opportunity-adjusted.**
  - Expected = non-PP rate × window non-PP seconds + PP rate × window PP seconds.
  - Scale = √(n × residual SD² + PP-rate variance). The residual SD is the SD of the split model's per-game residual in the baseline games. The PP-rate variance is W_pp² × c × r_pp / (PP seconds + k), a Poisson-style term with c = value per PP point.
- **Direction rule.** z = (observed − expected) / scale. If |z| < `band` (0.5) the result is `balanced`; otherwise it is `sell_high_evidence` when production is above and `buy_low_evidence` when below. The same sign convention is used as `productionReference`. The scales are descriptive, not calibrated.
- **Opportunity effect.** This is (b)'s expected minus (a)'s expected. It splits exactly into:
  - a TOI effect: all-situations rate × ΔTOI;
  - a PP effect: the remainder.

  When (b) is unavailable, the TOI-only effect is used to judge whether the role change could explain (a). Its shift is `increase` or `decrease` when |effect| ≥ band × (a)'s scale, and `stable` otherwise.

### Assessment rules (`assess`, per track; the headline is FP by default, per decision 5)

| (a) | (b) | Opportunity | Result | Reason |
|---|---|---|---|---|
| unavailable | any | any | unavailable | `per_game_unavailable` |
| same direction | same direction | any | that direction | `comparisons_agree` |
| balanced | balanced | any | balanced | `both_balanced` |
| sell (buy) | balanced | increase (decrease) | **balanced**: the role change explains the gap; a promotion is never sell-high by itself | `opportunity_explains_per_game_gap` |
| directional | balanced | otherwise | qualified direction of (a) | `adjusted_within_balanced_band` |
| directional | opposite | any | **withheld**: the reading depends on whether the role persists | `opposite_directions_role_persistence_unknown` |
| balanced | directional | any | balanced (a buy-low here would assume the new role persists) | `per_game_at_baseline_rates_shifted` |
| balanced | unavailable | any | balanced | `adjusted_unavailable_balanced` |
| directional | unavailable | TOI change could explain it | withheld | `adjusted_unavailable_opportunity_may_explain` |
| directional | unavailable | TOI unknown | withheld | `adjusted_unavailable_opportunity_unknown` |
| directional | unavailable | otherwise | qualified direction of (a) | `adjusted_unavailable_per_game_only` |

History below `minGames` (20 effective games; provisional, from decision 1) gives `insufficient_personal_history`. That is distinct from `no_personal_history` (confirmed zero games). Missing inputs never become zeros.

## 3. Validation (offline, saved history only)

**Input.** `dev-history.jsonl`, sha256 `da32a473…020106`. That is the same pin as the snapshot's `sourcePins.developmentHistory`. It was read with `python3 -I validate.py`; there was no network or database access.

**Origins.**
- Non-overlapping 5-game windows in 2023-24.
- Each window has the previous 50 games as its reference (unweighted) and the next 10 games for the persistence check.
- The cohort PP rate is pooled from 2022-23 only.
- 7,587 origins, 667 players.

The tables below compare three expectations: per-game (a); total-TOI scaling (the current production reference); and the split (b, k = 3600).

### Bias (observed − expected) by window PP change, s/game vs reference

| ΔPP | n | FP per-game | FP total-TOI | FP split | G+A per-game | G+A total-TOI | G+A split |
|---|---:|---:|---:|---:|---:|---:|---:|
| < −60 | 604 | −1.73 | −0.77 | **−0.19** | −0.45 | −0.20 | **+0.01** |
| −60..−20 | 1,479 | −0.61 | −0.29 | **−0.05** | −0.16 | −0.09 | **+0.00** |
| −20..20 | 3,926 | −0.11 | −0.08 | −0.13 | −0.05 | −0.05 | −0.06 |
| 20..60 | 1,002 | +0.48 | +0.07 | −0.31 | +0.06 | −0.05 | −0.18 |
| > 60 | 576 | +2.30 | +1.39 | **+0.44** | +0.58 | +0.36 | **+0.03** |

By total TOI change, total-TOI scaling and the split are both close to unbiased: FP within ±0.17 in every bucket. Per-game is not: −1.36 below −60 s and +1.29 above +60 s.

Overall MAE:

| Track | Per-game | Total-TOI | Split |
|---|---:|---:|---:|
| FP | 3.626 | 3.492 | **3.462** |
| G+A | 1.280 | 1.259 | **1.254** |

What this supports:
- **The PP split works where it matters most.** On large PP changes it removes about 70% (FP) and over 90% (G+A) of the bias that total-TOI scaling leaves.
- **Residual FP bias for PP increases of more than 60 s (+0.44).** This is consistent with PP shots staying in the non-PP rate, and with top-unit PP being more productive than the player's average PP minute.
- **Small PP increases (20–60 s) are over-adjusted (FP −0.31, G+A −0.18).** Extra second-unit time is worth less than the player's average PP minute. This is the method's main known weakness. For this reason (b) keeps a balanced band rather than treating any sign as a direction.

### Pseudo-exposure k (PP increase > 60 s/game)

| k (s) | FP bias, all such windows (n=575) | FP bias, thin PP history < 30 s/game (n=65) | FP MAE, thin | MAE, all origins |
|---|---:|---:|---:|---:|
| 0 | +0.63 | +1.56 | 3.49 | 3.483 |
| 600 | +0.53 | +0.93 | 3.24 | 3.474 |
| 1800 | +0.46 | +0.67 | 3.21 | 3.467 |
| **3600** | +0.43 | +0.55 | 3.21 | 3.462 |
| 7200 | +0.42 | +0.47 | 3.20 | 3.460 |

Improvement is small beyond 3600 s, and a larger k leans more on the cohort, so 3600 is the default (provisional).

### Scale sanity

| Track | SD of z, (a) | SD of z, (b) | Share inside \|z\| < 0.5, (a) | Share inside \|z\| < 0.5, (b) |
|---|---:|---:|---:|---:|
| FP | 1.11 | 1.06 | 35% | 37% |
| G+A | 1.10 | 1.06 | 35% | 36% |

The scales are roughly unit but slightly narrow. They are not calibrated.

### Persistence (next 10 games)

| Window change | n | Median share retained | Share retaining ≥ half |
|---|---:|---:|---:|
| PP +60 s/game or more | 491 | 0.35 | 37% |
| PP −60 s/game or more | 491 | 0.57 | 56% |
| TOI +60 s/game or more | 1,630 | 0.50 | 50% |
| TOI −60 s/game or more | 1,759 | 0.51 | 51% |

This supports the rule that a promotion is not proof of a lasting role. PP increases are the least persistent change.

**Secondary (descriptive, not a forward claim).** Next-10 per-game FP minus the per-game baseline was grouped by the window's (a)|(b) directions:
- sell|sell +0.15 and sell|balanced +0.17;
- buy|buy −0.13 and buy|balanced −0.19.

Above-baseline windows were followed by somewhat above-baseline production whether or not the role explained them. This retrospective view makes no forward claim. Decision 4 keeps forecasts in the trade view.

## 4. Coverage on the 2026-10-28 snapshot

**Input.** `research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json` (sha256 `2f380c25…`, mapper v1 lists: BL 264, SH 184).

**How it was applied.** Each profile's saved reference games (`evidence.reference.sourceIds`, the same up-to-50 development games, unweighted) were rebuilt from dev-history. All rows were found. The window comes from `evidence.window` and `context.opportunity`, and the cohort is pooled per position from dev-history. Every number below comes from the committed TS module (`apply-snapshot.ts`, bundled with esbuild, read-only).

| Of 729 profiles | FP | G+A | Game Score |
|---|---:|---:|---:|
| (a) available | 388 (53%) | 388 | 388 |
| (b) available | 388 (53%) | 388 | 0, `no_strength_split_for_track` |
| unavailable: window production missing | 124 | 124 | 124 for (a); for (b) these count under `no_strength_split_for_track` |
| unavailable: no personal history (confirmed 0) | 152 | 152 | 152 |
| unavailable: 1–19 reference games | 65 | 65 | 65 |

Wherever (a) exists for FP or G+A, (b) exists too: every reference row has PP inputs, and a cohort was supplied.

**FP headline assessment (729):**
- unavailable 341;
- buy-low 152: 135 agree, 17 qualified;
- sell-high 95: 87 agree, 8 qualified;
- balanced 139: 83 both balanced, 31 opportunity explains the gap, 25 per-game at baseline with shifted rates;
- withheld 2: opposite directions.

## 5. How the 2026-10-28 lists would change (FP headline)

| Saved list | FP: still that direction | Becomes balanced | Opposite direction | Withheld | Unavailable |
|---|---:|---:|---:|---:|---:|
| SH (184) | 87 | 46 | 4 | 1 | 46 |
| BL (264) | 131 | 55 | 1 | 0 | 77 |

**Saved SH profiles that become balanced (46).**
- 30 are balanced on both comparisons.
- 7 have their per-game gain explained by a bigger role. Examples: Evan Bouchard (+266 s TOI, +53 s PP), Adam Fantilli (+330, +99), Logan Cooley (+178, +127).
- 9 are at their per-game baseline while their rates shifted.

**Saved BL profiles that become balanced (55).** 33 are balanced on both comparisons, 11 have the drop explained by a smaller role (e.g. Rasmus Andersson −238 s TOI, −104 s PP; Mike Matheson −147, −156), and 11 have shifted rates.

**Opposite direction.** These 5 come from the track change (decision 5's FP headline instead of the frozen equal-weight composite), not from the opportunity logic.

**Unavailable.** Of the 123 unavailable profiles, 84 have no personal history; mapper v2's cohort-only gate already withholds exactly those 84. The other 39 have only 1–19 reference games, which decision 1's ~20-game threshold would also withhold.

**Promotions and demotions.**
- Of 89 saved SH players promoted by more than 60 s TOI or 30 s PP: 60 stay sell-high, 20 become balanced and 9 are unavailable.
- Of 121 saved BL players demoted by the same margins: 81 stay buy-low, 28 become balanced, 11 are unavailable and 1 is sell-high.

**TOI shifts.** Median TOI change is −48 s on the saved BL list and +62 s on the saved SH list. On the new directional sets it is −73 s (buy-low) and +98 s (sell-high).

**Read with caution.** The saved reference is the stale 2022-24 history, 894–1,451 days old. Many "role changes" here are multi-season development, as with Fantilli and Cooley, and their per-minute rates have grown too, so (b) still reads them as sell-high. The skew in the new sets shows that the adjusted comparison does not remove role growth that the stale baseline cannot see. The real fix is the baseline lane's recency-weighted baseline (decision 1); these list numbers should be re-run on it before release.

**Not applied here.** Ranking, the top-25 per position cut and the 0.20/0.10 screens belong to the lists lane.

## 6. Integration spec (for the lists lane and baseline lane; relayed by the orchestrator)

### Inputs

**History: one `OpportunityGame` per established-baseline game** (strictly before the window), in the baseline lane's game set:

```ts
{ seconds: Slot.seconds, ppSeconds: Slot.ppSeconds, tracks: Slot.tracks /* [FP, G+A, GS] */,
  goals: Slot.goals, assists: Slot.assists, ppPoints: <new>, weight?: <baseline lane's recency/exposure weight> }
```

- **Needed change.** `Slot` (in `currentWindows.ts`, baseline lane) has no PP points. Add `ppPoints: measured(r.pp_points, "pp_points", reasons)` in `devSlot`, and `measured(rec.counts.pp_points, …)` in `currentSlot`. `pp_points` is already a `PRODUCTION_INPUTS.fantasyPoints` field, so it is present in both sources.
- **Weights.** Pass the same weights the baseline lane uses for the per-game baseline, so (a) and (b) rest on the same games and weighting.

**Cohort.** Call `pooledCohort(donorGames)` per position, using prior-only donor games (the same donor set as `fitProductionPrior`). Alternatively pass `{ ppRate: [fp, ga], goalShare }`. Without a cohort, (b) is unavailable for players with thin PP history.

**Window: `OpportunityWindow`.**

```ts
{ games: Profile.window.appearances, seconds: Profile.window.seconds,
  ppSeconds: windowEvidence(w).ppSeconds /* WindowEvidence.ppSeconds, already summed */,
  observed: production.raw_observed /* [FP, G+A, GS] totals */ }
```

**Calls.**
- `summarizeOpportunityHistory(games, { cohort })` returns an `OpportunityHistory`.
- `compareOpportunity(history, window, { headlineTrack: 0 })` returns an `OpportunityResult`.
- Suggested place: `assembleProfiles`, attached as `Profile.opportunity: OpportunityResult`.
- Both functions are pure, so the display mapper only maps; it never recomputes.

### Output fields to map (in `DisplayProfile`)

| Display field | Source |
|---|---|
| `opportunity.version` | `version` (`blsh-opportunity-split-v1`) |
| per-track `perGame` | `tracks[t].perGame`: `label`, `available`, `reason`, `observed`, `expected`, `gap`, `z`, `direction` |
| per-track `adjusted` (separately labelled) | `tracks[t].adjusted`: same fields. `label` is "Opportunity-adjusted: …". Show `reason` text when unavailable, never 0 |
| per-track `assessment` | `tracks[t].assessment`: `direction` (`buy_low_evidence` / `sell_high_evidence` / `balanced` / `withheld` / `unavailable`), `qualified`, `conflict`, `reason`, `text`, `opportunityEffect`, `opportunityShift` |
| headline | `headline` (= the FP track's assessment by default) |
| TOI change | `changes.toi`: `baseline`, `current`, `delta`, `deltaPct`, `impact[t]`, `text` |
| PP change | `changes.pp`: same fields; `impact[t]` is null with `impactReason` where (b) is unavailable |
| persistence caveat | `persistenceNote` |
| claims | `retrospective: true`, `forecast: false`, `trusted: false`, `calibratedProbability: null` |

**List eligibility (suggested; the lists lane decides):**
- list only when `headline.direction` is `buy_low_evidence` or `sell_high_evidence`;
- show the "Qualified" marker and `headline.text` when `qualified` is true;
- `balanced` and `withheld` stay inspectable outside the lists, with `headline.text` as the reason (decision 2).

**Reason codes needing display text:**
- (a) and (b): `no_personal_history`, `insufficient_personal_history`, `track_unavailable_in_history`, `observed_production_unavailable`, `window_games_unavailable`, `unestimated_scale`;
- (b) only: `no_strength_split_for_track`, `window_toi_unavailable`, `window_pp_toi_unavailable`, `history_toi_unavailable`, `pp_split_inputs_unavailable`, `no_non_pp_exposure`, `pp_rate_unsupported_without_cohort`, `split_rates_unavailable`;
- assessment: the 11 reasons in §2.

## 7. Limitations and open items

- All parameters are provisional and need re-validation on the recency-weighted baseline once the baseline lane lands: band 0.5, k 3600 s, minimum 1800 PP seconds without a cohort, and minGames 20.
- **FP approximation.** PP goals are inferred from overall goal share, and PP shots, hits and blocks sit in the non-PP rate. The result is a residual under-adjustment of large PP increases (+0.44 FP over 5 games) and an over-adjustment of small ones (−0.31).
- Game Score has no adjusted comparison.
- Short-handed time is folded into non-PP.
- The scales are descriptive (SD of z ≈ 1.06–1.11), not calibrated probabilities.
- The validation uses 2023-24 windows with 50-game unweighted references. It does not cover the 2026-27 season or the current-season blend from decision 1.

## Reproduction

These commands are run from `web/`. Scratch outputs go outside the repository.

```bash
python3 -I ../tasks/artifacts/blsh-opportunity-2026-11-04/validate.py <dev-history.jsonl> <out>/validation.json
npx esbuild ../tasks/artifacts/blsh-opportunity-2026-11-04/apply-snapshot.ts --bundle --platform=node --format=esm --outfile=<out>/apply.mjs
node <out>/apply.mjs lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json <dev-history.jsonl> <out>/applied.json
python3 -I ../tasks/artifacts/blsh-opportunity-2026-11-04/summarize.py <out>/applied.json
```

**Committed outputs:**
- `validation.json`;
- `SNAPSHOT-2026-10-28-APPLIED.json`: slim per-profile FP results. `summarize.py` needs the full `applied.json`, which `apply-snapshot.ts` regenerates.
