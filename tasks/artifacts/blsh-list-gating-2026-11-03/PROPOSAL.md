# BLSH list-gating proposal (read-only)

Date: 2026-11-03. Author: Claude (side session of local_61ea7da8). Status: **proposal; no code changed.**
Snapshot analysed (not modified): `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`, events through 2026-10-28, 729 profiles, 551 numeric, 448 listed (264 BL / 184 SH).
Scripts: scratchpad `gate.py`, `null2.py`, `more.py`, `fin.py`, `null3.py`, `ex2.py` (`python3 -I`, read-only).

## TJ decision

Asked 2026-11-03 by pop-up. TJ chose **none of the three as offered**. Their answer, in substance:

- **Adopt eligibility only** (full 5-game window + personal history) as the underlying list rule for now.
- **Keep the 0.20 screen available as a provisional narrowing view, and 0.10 as a stricter research view.** Neither is the default.
- **Rank eligible players by the BLSH evidence** (the existing order), rather than showing 340 names without useful ordering.
- Why: 0.20 gives a manageable 151 but nobody knows yet whether it finds better opportunities; it can screen out players whose fantasy value or role changed without an extreme five-game G+A total; 0.10 is stricter without demonstrated superiority. The 49 zero-point BL entries under 0.20 are not automatically wrong but need scrutiny (five scoreless games can be ordinary for a lower-scoring player), and a mid-p value is not the chance of a rebound or of the flag being wrong.
- Before presenting either filter: clarify whether 0.20 is per directional tail or combined, **show actual versus expected production**, and **test the assumptions and historical usefulness**. A screen can be promoted to default once it has earned that role.

Consequence: the recommended rule in the section below is now a **provisional view**, not list membership. The binding spec is "Implementation spec (as decided)". The clarifications TJ asked for are in "Clarifications requested by TJ".

## Corrections to the brief

- Listed profiles with a window under 5 games: **40** (6 one-game, 15 two-game, 8 three-game, 11 four-game). The 36 in `counts.personalReference1to4` counts profiles with 1-4 *reference* games (20 of them listed). 84 listed profiles have 0 reference games (51 BL, 33 SH): the cohort-only set.
- Smallest listed |value|: 0.52 (an SH entry) and 1.09 (a BL entry). The smallest |normalizedGap| is 0.005. Median is 0.70, and a quarter of the list is under 0.36.
- 60 concordant profiles have no list because their window is stale (`window.fresh` false), not because of a missing rule.
- The 333:218 sign split is across all 551 numeric profiles; the listed split is 264:184 (1.43).

## What the numbers are

- `normalizedGap` g is already a standardised gap: `(expected - actual)` scaled by the reference-rate covariance plus a per-second game-noise term (`productionReference.productionGap`), and `value = 100·g/(1+|g|)`. So rules on |value| and |g| are the same rule; I report |g|. The covariance is flagged `uncertainty_not_calibrated`.
- A Poisson test on G+A uses the profile's `tracks[1].referenceAtCurrentTOI` as the mean and `observed` as the count.
- **Skew is real and mostly explains the sign split.** If each listed player's window G+A were a Poisson draw at his own reference mean, 249 would land below the mean and 199 above (1.26). The listed split is 1.43. The reference is stale (894-1451 days) and the TOI-scaled expectation has no role information, which accounts for the remainder.
- **A zero count is not evidence when the expectation is small.** The 92 zero-G+A BL players have a median reference expectation of 1.26 G+A; for 56 of them P(0 G+A | reference) is at least 25%.

## Option tables

"Tier mix" is measured/provisional across both lists. Zero-G+A is BL entries only (SH has at most 1 in any row). Rows after the first are single rules applied to the current 448; "ELIG" means 5-game window and personalGames > 0.

| Rule | BL | SH | BL:SH | BL F/D | SH F/D | Tier (meas/prov) | Zero-G+A BL |
|---|---|---|---|---|---|---|---|
| Current (no gate) | 264 | 184 | 1.43 | 166/98 | 130/54 | 336/112 | 92 |
| (a) games ≥ 5 | 234 | 174 | 1.34 | 145/89 | 124/50 | 317/91 | 67 |
| (a) games ≥ 4 | 241 | 178 | 1.35 | 149/92 | 126/52 | 325/94 | 71 |
| (b) minutes ≥ 30 | 245 | 179 | 1.37 | 151/94 | 126/53 | 327/97 | 74 |
| (b) minutes ≥ 45 | 236 | 175 | 1.35 | 144/92 | 124/51 | 321/90 | 70 |
| (b) minutes ≥ 60 | 204 | 165 | 1.24 | 116/88 | 116/49 | 296/73 | 50 |
| (c) \|g\| ≥ 0.25 | 236 | 149 | 1.58 | 143/93 | 106/43 | 294/91 | 92 |
| (c) \|g\| ≥ 0.50 | 175 | 113 | 1.55 | 108/67 | 78/35 | 225/63 | 86 |
| (d) Poisson G+A tail ≤ 0.25 (one-sided, strict) | 56 | 85 | 0.66 | 40/16 | 56/29 | 113/28 | 36 |
| (d) Poisson G+A tail ≤ 0.15 (strict) | 23 | 55 | 0.42 | 21/2 | 35/20 | 67/11 | 13 |
| (d) NB(r=3) G+A tail ≤ 0.25 (strict) | 23 | 81 | 0.28 | 19/4 | 53/28 | 84/20 | 16 |
| (e) personalGames > 0 | 213 | 151 | 1.41 | 129/84 | 106/45 | 336/28 | 69 |
| ELIG = (a5)+(e) | 199 | 141 | 1.41 | 123/76 | 100/41 | 317/23 | 56 |
| ELIG + \|g\| ≥ 0.75 | 95 | 68 | 1.40 | 57/38 | 48/20 | 152/11 | 43 |
| ELIG + minutes ≥ 45 | 198 | 139 | 1.42 | 122/76 | 98/41 | 315/22 | 55 |
| **ELIG + mid-p ≤ 0.20 (recommended)** | **75** | **76** | **0.99** | 49/26 | 52/24 | 143/8 | 49 |
| ELIG + mid-p ≤ 0.15 | 55 | 59 | 0.93 | 39/16 | 40/19 | 108/6 | 37 |
| ELIG + mid-p ≤ 0.10 | 28 | 42 | 0.67 | 20/8 | 25/17 | 67/3 | 17 |

Mid-p, one-sided, X ~ Poisson(reference G+A at current TOI): BL = P(X < obs) + ½P(X = obs); SH = P(X > obs) + ½P(X = obs).

### Findings per axis

- **(a) Window games.** 5 vs 4 differs by only 7 BL / 4 SH. A 5-game window is the product's definition; 1-4-game windows are new call-ups and early-season gaps. Go with 5. This is the cheapest way to remove all 40 short windows (including the 8.7-minute window, Jani Nyman, 1 game).
- **(b) Window TOI.** Adds almost nothing once games ≥ 5: the smallest 5-game window is 37.8 minutes, and ELIG + minutes ≥ 45 removes 3 more entries (e.g. Taylor Raddysh, 38 min, SH g -0.51). Low TOI is already priced in by the reference expectation (low minutes means low expectation). Not recommended as a separate rule.
- **(c) Magnitude.** Does cut the list, but it **worsens the BL:SH ratio** (1.43 to 1.58 at 0.25) and **removes no zero-G+A BL entry** (92 stay at 0.25): the zeros are the large gaps. It does drop the near-zero entries (Kaprizov SH, g -0.08, 8 G+A vs 6.79 expected; Brayden Point SH, g -0.13). Within the chance rule below, |g| ≥ 0.5 removes only 3 more SH entries, so it is redundant there.
- **(d) Skew-aware.** The one-sided strict Poisson tail is the most selective but structurally cannot certify low-expectation buy-lows (P(0) = 37% at a mean of 1.0) and flips the ratio to 0.4-0.7. **Mid-p** removes the discreteness penalty and gives a near-balanced list at the same look-and-feel selectivity. It also uses the one count the user sees (G+A) rather than a model score.
- **(e) personalGames = 0.** Matches the parallel fix; it already landed as `NO_PERSONAL_HISTORY_LIST_WITHHELD`. It removes 51 BL + 33 SH, including strong-looking rookies (Danila Yurov BL g +1.63; Easton Cowan SH, 7 G+A vs 2.48). Raising it to ≥ 5 personal games would remove only 20 more entries (13 BL, 7 SH); not worth a rule.

### Is the surviving list beyond chance? Mostly no, and the proposal says so

Among the 340 ELIG players, mid-p ≤ 0.20 flags **75 BL / 77 SH**. Pure Poisson noise at each player's own reference mean would flag **66 / 65**. With an overdispersed count model (NB, r = 3) noise alone flags **70 / 67**, more than observed (54 / 63). Strict tails behave the same way (BL ≤ 0.15: 23 observed vs 22 expected from noise). So the *group* of G+A extremes is about what chance produces; a modest SH excess (+10 to +12 over Poisson) is the only visible signal. A gate cannot create evidence. It can only make the list shorter, balanced, and honest about which entries are the most extreme.

## Recommended rule set

**ELIG + G+A chance-extremity gate:**

1. Window must have 5 games (`appearances === 5`).
2. `personalGames > 0` (already in place; no change).
3. The listed side's one-sided mid-p for window G+A against Poisson(reference G+A at current TOI) must be ≤ 0.20.

No separate TOI or magnitude rule. Result on this snapshot: **151 listed (75 BL / 76 SH)**, down from 448. F/D 101/50 (BL 49/26, SH 52/24). Tier 143 measured / 8 provisional. Zero-G+A BL: 49 of 75, all with a reference expectation of at least 1.02 G+A (median 1.49); this is inherent to a count test (the largest shortfalls are zeros), and the stricter option leaves 17 of 28.

Examples kept: Mikael Granlund (F, ANA) BL, 0 G+A vs 4.30 expected, g +2.44; Zach Hyman (EDM) BL, 1 vs 3.88; Cam Fowler (D, STL) BL, 0 vs 2.00; Jack Roslovic (TOR) SH, 9 vs 2.68; Seth Jones (D, FLA) SH, 6 vs 2.15.
Examples dropped:
- window: Logan O'Connor (COL) BL, 3 games, g +1.28; Juuso Valimaki (D, CAR) SH, 4 games, g -1.41.
- chance: Vince Dunn (D, SEA) BL, 2 vs 3.60 expected, mid-p 0.21; Dougie Hamilton (D, NJD) BL, 2 vs 3.18, mid-p 0.28; Simon Benoit (D, PHI) BL, 0 vs 0.59; Luke Schenn (D, VAN) BL, 0 vs 0.72; Carter Verhaeghe (FLA) SH, 6 vs 4.43. Only 13 of the 189 chance-dropped have |g| ≥ 1.

Trade-offs:
- Dropping near-threshold stars such as Dunn and Hamilton is the price of a single hard cut-off at 0.20; the cut is a display choice, not a significance boundary.
- Players whose gap comes from the FP or Game Score tracks but whose G+A is unremarkable (e.g. a defenceman with a bad shot-based gap) are withheld. They stay inspectable with a reason.
- The BL:SH ≈ 1 balance is a property of mid-p, not a finding about the league.
- The gate uses only the G+A track and a Poisson assumption; counts are over-dispersed in reality, and the reference is stale and shrunk. Treat 0.20 as a screening threshold.

### What the rule can claim

"In the last 5 games this player's goals plus assists sit among the outer ~20% of what a count at his own (stale, shrunk) reference rate would produce, in the direction shown, and the support-conditioned gap agrees." It is a retrospective research filter.

### What it cannot claim

- Not a forecast, a probability, a trade value, a luck finding, or a market judgement; `claims` stays all false.
- Not individual-level evidence beyond chance: among 340 eligible profiles, noise alone yields about as many flags as observed.
- Not a calibrated test: no multiplicity control, Poisson ignores over-dispersion and reference uncertainty, and the reference is 894-1451 days old.
- FP and Game Score tracks are not tested; they still influence rank and sign through `normalizedGap`.

## Alternatives for TJ

1. **(Recommended) ELIG + mid-p ≤ 0.20** — 151 entries, 75 BL / 76 SH, as above.
2. **ELIG + mid-p ≤ 0.10** — 70 entries, 28 BL / 42 SH, BL thin and 17 zero-G+A of 28; fewest chance flags, but a very short buy-low list.
3. **ELIG only** (5 games + personal history) — 340 entries, 199 BL / 141 SH; fixes data-quality only, leaves skew and 56 zero-G+A BL entries, and relies on the UI for selectivity.

Not offered: magnitude-only (|g| thresholds), because it increases the BL:SH skew and does not touch zero-count entries; and minutes-only gates, because the reference expectation already scales with TOI.

## Clarifications requested by TJ

**What "0.20" means.** It is the mid-p of *one* directional tail, on the side the profile is listed: BL uses the lower tail of the Poisson count (P(X < obs) + ½P(X = obs)); SH uses the upper tail. It is **not** a two-sided or combined 20%. A combined/two-sided 20% would be 0.10 per tail, which is exactly the stricter "0.10" view (70 entries). So the two views are "20% per tail" and "10% per tail (= two-sided 20%)". Mid-p is a screening statistic on one count: it is not the probability of a rebound and not the probability that the flag is wrong.

**Actual versus expected.** Every screened profile should show observed and reference-expected for all three tracks. Top five by saved rank under the 0.20 screen (G+A, FP and Game Score observed vs reference at current TOI):

| Player | List | G+A | FP | Game Score | g | mid-p |
|---|---|---|---|---|---|---|
| Mikael Granlund (F, ANA) | BL | 0 vs 4.30 | 2.1 vs 15.0 | -0.5 vs 2.7 | +2.44 | 0.007 |
| Zach Hyman (F, EDM) | BL | 1 vs 3.88 | 6.4 vs 16.1 | 2.4 vs 5.8 | +1.89 | 0.060 |
| Cam Fowler (D, STL) | BL | 0 vs 2.00 | 1.6 vs 8.4 | -1.2 vs 1.1 | +1.83 | 0.068 |
| Quinton Byfield (F, LAK) | BL | 0 vs 2.86 | 2.4 vs 10.9 | 1.8 vs 3.3 | +1.81 | 0.029 |
| Conor Garland (F, CBJ) | BL | 0 vs 2.89 | 3.2 vs 11.0 | -0.5 vs 3.5 | +1.79 | 0.028 |
| Jack Roslovic (F, TOR) | SH | 9 vs 2.68 | 24.6 vs 9.7 | 7.4 vs 2.6 | -3.29 | 0.001 |
| Seth Jones (D, FLA) | SH | 6 vs 2.15 | 22.2 vs 11.3 | 6.7 vs 2.2 | -2.79 | 0.015 |
| Jordan Kyrou (F, WSH) | SH | 8 vs 3.45 | 25.8 vs 13.1 | 7.9 vs 3.7 | -2.71 | 0.017 |
| Trevor Zegras (F, PHI) | SH | 9 vs 3.09 | 29.8 vs 11.6 | 8.0 vs 2.5 | -2.66 | 0.003 |
| A.J. Greer (F, ANA) | SH | 5 vs 1.66 | 18.7 vs 8.5 | 5.9 vs 1.4 | -2.48 | 0.017 |

(The saved snapshot already carries these values in `tracks[*].observed`/`referenceAtCurrentTOI`; the display must surface them next to the screen, not only in the detail view.)

**Assumption tests run on this snapshot** (all read-only, G+A only):
- *Poisson dispersion.* Pearson dispersion of window G+A about the reference mean is 1.19 over the 340 eligible listed profiles (selected for extremes, so biased up) and **1.11 over all 391 eligible numeric profiles**; by expectation bin 1.15 (<1.5), 1.09 (1.5-3), 1.10 (≥3). So counts are about 10% over-dispersed. Poisson is roughly right; the NB(r = 3) sensitivity I ran (variance about 1.7× the mean at a mean of 2) is too heavy. Poisson stays the default; the effect of 10% over-dispersion is that real tail probabilities are somewhat larger than stated.
- *Reference bias.* Mean (observed − reference) G+A is +0.06 overall, but −0.13 in the lowest-expectation bin (<1.5): low-scoring players come in under their stale reference, which feeds the zero-count BL entries. This is the main reason the zero-G+A entries need scrutiny rather than a rule.
- *Group-level chance.* Among 340 eligible profiles, mid-p ≤ 0.20 flags 75 BL / 77 SH; pure Poisson noise flags 66 / 65. See the earlier section: the group is only modestly above noise, and only on the SH side is there a visible excess.
- *Not tested, and not testable from this snapshot:* **historical usefulness** (do screened players outperform unscreened eligible ones in their *next* window?). That needs reference-through-date windows with a following window, which the 2026-10-28 snapshot does not contain. The development forecast report (`tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/FORECAST-DEV-V2-REPORT.md`) already found the support adjustment added almost nothing to next-five-game forecasts; expect a modest result. Until that test exists, neither screen should become the default.

**Promotion criterion (proposed, for TJ to accept or change).** A screen may become the default list only after a historical test on 2023-24 (or earlier) windows shows screened-flagged players have a better next-5-game outcome than eligible-but-unflagged players in the same direction, on G+A and FP, with an interval that excludes zero, and the zero-G+A BL subset is reported separately.

## Implementation spec (as decided; for whoever implements later, after the cohort-listing fix)

### Layer 1: list membership (binding, per TJ)

Hook: `listWithheldReason(p: Profile)` in `web/lib/buyLowSellHigh/displayProfile.ts`; evaluated only when `p.result.researchList !== null`, first failing condition wins:

| # | Condition | Reason code (new in bold) |
|---|---|---|
| 1 | `p.reference.personalN === 0` | `no_personal_history_list_withheld` (existing, landed) |
| 2 | `p.window.appearances < 5` | **`short_window_list_withheld`** |

Add the `REASON_TEXT` entry ("Withheld from lists: fewer than 5 games in the window"), constant `BLSH_LIST_WINDOW_GAMES = 5`, count `withheldShortWindow`, and update the `limits` sentence. Ranking: `rankTwoLists` is unchanged (measured tier first, then |value| descending), so the eligible 340 (199 BL / 141 SH) keep the evidence order already used. The 40 short-window entries leave; target on the 2026-10-28 snapshot is BL 199, SH 141 (448 − 84 cohort-only − 24 further short windows among the personal-history players).

### Layer 2: provisional screen views (not membership; per TJ)

Do not change membership or rank. Add to each listed `DisplayProfile.score` a field `gaMidP: number | null` (side-aware one-sided Poisson mid-p of window G+A at `p.result.expectedBaseline[1]`, using `round(p.result.rawActual[1])`; null when not listed) and export constants `BLSH_SCREEN_PROVISIONAL = 0.20` and `BLSH_SCREEN_STRICT = 0.10`. The UI offers a view switch: **All eligible** (default) / **Chance screen 0.20 (provisional)** / **Chance screen 0.10 (strict, research)**. A view hides rows; it never re-ranks or re-numbers (each row keeps its saved rank). Label each view with its count, state "20% / 10% per directional tail; not a rebound probability; not yet shown to be useful", and show observed vs expected for G+A, FP and Game Score on each row. Hidden rows stay one click away. Use `check(...)` for non-finite or negative inputs, as the existing gate does; a mean of exactly 0 is valid.

Tests (`displayProfile.test.ts`, beside the cohort tests): reason order; `gaMidP` side symmetry (mean 1.0, observed 0 → 0.184 passes 0.20; mean 0.59, observed 0 → 0.277 does not); mean 0; view counts on the 2026-10-28 snapshot (0.20: 75 BL / 76 SH; 0.10: 28 BL / 42 SH) within the 340-player eligible list; `counts` expectation near line 190 regenerated.

The saved JSON snapshot does not change until Codex repackages it; `researchSnapshot.ts` validators accept the smaller list. Keep the player-card and score-version pins: this changes list membership and an added display field only. `supportGap.score()` and `rankTwoLists` stay frozen.

### Superseded: original single-layer spec (kept for reference)

Had the 0.20 gate been adopted as membership it would be a third reason `within_chance_list_withheld` in `listWithheldReason`. It is not adopted now.

Original hook note: `listWithheldReason(p: Profile)` in `web/lib/buyLowSellHigh/displayProfile.ts` (currently returns `NO_PERSONAL_HISTORY_LIST_WITHHELD` when `p.result.researchList !== null && p.reference.personalN === 0`). It is called from `toDisplayProfile` (to null `list` and set `score.reason`) and `buildDisplaySnapshot` (to filter before `rankTwoLists`). Both already honour it, so `rankTwoLists`/`supportGap.score()` (frozen, parity-tested) stay untouched and the score value, status and version are unchanged.

Evaluate only when `p.result.researchList !== null`; first failing gate wins, in this order:

| # | Condition | Reason code (new in bold) |
|---|---|---|
| 1 | `p.reference.personalN === 0` | `no_personal_history_list_withheld` (existing) |
| 2 | `p.window.appearances < 5` | **`short_window_list_withheld`** |
| 3 | `midP(side, round(p.result.rawActual[1]), p.result.expectedBaseline[1]) > 0.20`, where `side = p.result.researchList` | **`within_chance_list_withheld`** |

Details:
- Export constants `BLSH_LIST_WINDOW_GAMES = 5` and `BLSH_LIST_MIDP_MAX = 0.20`. Put the Poisson mid-p in a small pure helper next to the gate (it needs only pmf by recurrence); no external dependency.
- `expectedBaseline[1]` is the reference G+A at current TOI (`tracks[1].referenceAtCurrentTOI`); `rawActual[1]` is observed G+A. Use `check(...)` (the file's existing throw-on-invalid helper) for non-finite or negative inputs, as `listWithheldReason` does for `personalN`. A mean of exactly 0 is valid: P(0) = 1.
- Add reason text entries in `REASON_TEXT` (beside line 47): short window ("Withheld from lists: fewer than 5 games in the window") and chance ("Withheld from lists: window goals+assists are within the range a typical count at the reference rate produces").
- Add counts `withheldShortWindow` and `withheldWithinChance` next to `withheldNoPersonalHistory`; update the `limits` sentence "no count or value cutoff, except ..." to describe the three gates and the α and window constants.
- Tests (`displayProfile.test.ts`, near the cohort-gate tests): the three reason codes and their order; mid-p BL/SH symmetric examples (mean 1.0, obs 0 → 0.184 passes at 0.20; mean 0.59, obs 0 → 0.28 withheld); mean 0; snapshot counts `toEqual` at line ~190 must be regenerated.
- The saved JSON snapshot does not change until Codex repackages it; `researchSnapshot.ts` validators accept the smaller list (list membership only requires concordance and freshness). Target numbers on the 2026-10-28 snapshot: BL 75, SH 76 (of 448 frozen-rule entries; 84 already leave under the cohort gate, 40 short windows and the chance gate account for the rest).
- Keep the player-card and score-version pins unchanged: this is list membership only.
