# BLSH reconciliation: stage 2

- Author: Claude session, 2026-10-28/29. Read-only; no source, database or lease changes.
- Stage 1 is `INDEPENDENT-ASSESSMENT.md` (sha256 `57948a41…7b2dc`, unchanged).
- Inputs read for this stage:
  - Synthesis: `FHFH-2026-10-28-conversation-synthesis.md`.
  - PBP ZIP: sha256 `e7066dc6…b9cf9`; all 10 inner checksums verified; unpacked to scratchpad, evidence only.
  - Recovered `web/scripts/top_scorers_relationship_analysis.py`.
  - Legacy detectors: `web/lib/trends/utils.ts`, `web/sql/functions/analytics.rpc_sko_player_series.sql`.
  - Codex BLSH research in `/Users/tim/Documents/Codex/2026-10-25/task-2/`: fresh-chat handoff, roadmap v5, `support-conditioned-ranking-v1/CONTRACT.md`, streak-trial decisions/handback, baseline-replay, distribution-bands and PQ memo summaries, `validation-evaluator-v2/VALIDATION-20242025-HANDBACK.md`.
  - BLSH P1 owner registration.

## 1. What changes in my recommendation, and why

| # | Stage-1 position | Change | Why |
|---|---|---|---|
| 1 | Build a new in-repo scorer from scratch (structural: ixG × finishing, on-ice xGF × on-ice finishing × involvement). | **Reuse first.** Port the frozen, reviewed `support-conditioned-production-gap-v1` (`candidate.py` + `test_candidate.py`) into the repo, with parity against the 2024-04-18 snapshot. My structural decomposition becomes an **explanation layer and a later v2 candidate**, not a replacement. | v1 already meets the core ethos: production gap given measured opportunity and process; goals/IPP/xG−G kept out of the predictors; low/zero-shot players stay scoreable; tiers, conflicts and unavailability preserved. It is frozen, tested and its outputs are pinned. Replacing it would discard reviewed work for an unvalidated alternative. |
| 2 | ES and PP components scored separately. | **Core score stays all-strength** (as in v1). ES/PP become explanation chips. | 2026-27 NST coverage: 9.1% of games have no ES row, and 431 games with PP time have no PP row. Splitting the score would turn record-level gaps into score loss. All-strength NST rows are more complete (6,658 vs 6,479 ES). |
| 3 | Predictive test: beat the "reference-only" baseline. | **Hard bar: the frozen prior mean.** | On 2024-25, the frozen prior-season mean had the lowest next-5 MAE and RMSE on every track. FP: 0.771 vs block5 0.947, EWMA 0.942, block10 0.826. Recent form adds error. Any forward claim (BLSH or streak) must beat that mean on common origins, or stay retrospective. This supports the "retrospective lens first" ethos. |
| 4 | The 1,463 Game Score nulls block only the GS track. | Unchanged, but **narrowed further**. | The ZIP reconstructs 1,459 rows as candidate six-zeros, with 5,158/5,160 controls matching. 4 null exceptions, 2 control mismatches and 116 newer rows remain open. It affects GS only. FP and G+A do not need it. |
| 5 | (not seen) | **New gap:** the ZIP's evidence can't enter the existing research overlay as is. | `currentInput.qualifyCurrentResearchInputs` admits a goal overlay only with official receipts (box score + goalsForAgainst report, plus HTML PBP for the census method). The ZIP method is stored-DB PBP + shift reconstruction. Using it needs an **owner decision**: add a third, labelled proof method, or keep those GS rows unavailable. This is a research-overlay question, separate from the production-write review. |
| 6 | 2025-26 reserved, so references are thin and stale. | **Unchanged; confirmed as the main open decision.** | Codex's current-reference proposal uses frozen 2022-24 references only (minimum age about 921 days, explicitly provisional). 2024-25 has been exposed retrospectively, and 2025-26 is the reserved test set (one disclosed game exposure: `2025020500`). |
| 7 | The relationship script could seed feature priorities. | **Weaker:** it can't inform BLSH weights at all, even after the synthesis's seven fixes. | It correlates **season totals across players** with a cross-sectional points percentile, so it measures between-player differences. BLSH is a within-player, over-time question. Totals also carry a games-played exposure confound. Keep it as a scaffold only (loading, F/D split, grouping, plots) and rebuild targets at player-game / episode level. |
| 8 | Streak research: test all ten survey metrics. | Add a **permutation null** per player. | With per-game points of 0/1/2 and a mean below 1, a "two consecutive games above the mean" rule fires often by chance. Shuffling each player's own game order gives the chance rate of episodes, so a detector must beat its own null before episodes are called streaks. This is in addition to the synthesis's leakage, zero-fill and gap-bridging fixes. |
| 9 | The streak library precedes the score (agreed order 2→6). | **Run them in parallel; don't reorder the agreed plan.** | The v1 score doesn't consume streak output (the snapshot has streak evidence for only 4 profiles). The two share inputs, not results. If TJ prefers strict order, keep it; nothing here forces a change. |

What stays from stage 1:
- Positive = BL, negative = SH.
- Two lists, with confidence and coverage separate.
- No shot floor: eligibility is by exposure and coverage.
- Missing ≠ zero.
- Opportunity changes move *expected*, not the gap.
- Retrospective and predictive evaluated separately.

## 2. Reuse, correct, or blocked

**Reuse as is:**
- `support-conditioned-production-gap-v1` contract and code.
- `currentInput.ts` qualifier (35 tests per owner).
- Snapshot reader and validator.
- Preview UI tabs: BL / SH / withheld.
- FHFH Standard `3G+2A+PPP+.2SOG+.2HIT+.25BLK`.
- WGO as authority for actual stats.
- 2,772-origin development case set.
- The 2024-25 validation result as the forecasting bar.
- ZIP SELECT-only reconstruction SQL as a reviewed method.

**Reuse with correction:**
- **Relationship script:** fix nulls→0, the `is_top5` self-correlation, labels, pooled ranks and the sign-split shares. Rebuild targets within-player.
- **Trends Sandbox:** use its timeline/segment UI. Fix the full-season baseline leakage, zero-fill and gap bridging.
- **sKO SQL:** keep the robust median/MAD + EWMA + persistence concepts. Fix the cold-run middle check, cumulative IDs, fixed seasons and missing-z → 0. Don't inherit the 1.8/1.6 thresholds.
- **Player Trends:** keep configurable windows. Replace the ±8% sign-run with explicit episode semantics.
- **v1 list rule:** 68% of profiles listed with a 7-day proxy. List membership needs an owner-set evidence threshold. Don't tune it to a list size.

**Data-quality issues affecting some records (not reasons to stop):**
- NST ES absent (648 rows), NST PP absent with PP time (431), PP definition mismatch (38).
- GS goal fields: 4 + 2 exceptions, 116 newer rows.
- WGO 2022-23 has no `game_id` (join on player + date).
- NST strength/date/unit semantics are formally `unknown` in `currentInput`.

**Genuine blockers (owner decisions, not engineering):**
1. Reference policy for 2026-27 scores (2022-24 frozen refs + in-season games, or release 2025-26 after its one-time test).
2. Whether stored-PBP reconstruction is admissible research-overlay evidence for GS.
3. List-membership evidence threshold.
4. BLSH source ownership. The Codex lease `CODEX-BLSH-CURRENT-SEASON-20261027-SUCCESSOR` is still active; the synthesis says Codex pauses BLSH edits until ownership is transferred explicitly.

**Not blocked by any of these:** porting v1, parity tests, the explanation layer, development-season validation, streak/relationship research on 2022-24.

## 3. Coverage by reason (2026-27, through 2026-10-27, WGO GP = 1: 7,127 rows)

| Reason | Rows | Effect |
|---|---:|---|
| complete WGO FP / G+A inputs | 7,127 | FP and G+A tracks fully available |
| zero-shot game (valid data) | 1,941 | scored; not excluded |
| NST ES row absent | 648 | ES context unavailable for that game |
| NST PP absent, PP TOI > 0 | 431 | PP context unavailable |
| PP TOI = 0, no NST PP row | 2,440 | genuine zero PP |
| PP TOI = 0, NST PP row present | 38 | flag; ignore PP fields |
| GS goal fields null (through 10-26) | 1,463 | GS unavailable unless overlay admitted (1,459 candidate zeros; 4 exceptions) |
| GS goal fields null, 10-27 inventory | 116 | GS unavailable; unreconstructed |
| GS control mismatch | 2 | keep WGO value; disclose |

All-strength NST rows (6,658) must be re-joined to these 7,127 rows on player + date for the exact core-score coverage. Codex's capture through 10-26 reports 6,262 individual and 6,082 on-ice matches of 6,731. In-house PBP xG: none for 2026-27.

## 4. Smallest ordered steps

| # | Step | Owner gate | Acceptance check |
|---|---|---|---|
| 0 | Ownership notice in the mailbox (new paths only). Wait for the Codex/TJ answer. | coordination | Each path has exactly one writer. Codex-leased files untouched. |
| 1 | Port v1 `candidate.py` → `web/lib/buyLowSellHigh/supportGap.ts` (pure) + tests ported from `test_candidate.py`. | ownership only | All ported tests pass. Recomputing the 924 snapshot profiles from the frozen inputs matches saved `value`, `actual`, `baseline`, `support` and `adjustment` within 1e-9. Same list and rank. |
| 2 | Explanation layer: per-process attribution of `T·ΔX·B` (ixG, xGF, xGA); finishing (`ixG−G`), on-ice finishing and involvement; opportunity chips (total/ES/PP TOI); confidence and coverage fields. | — | Components sum to E_support − actual within 1e-9. A zero-shot fixture is scored. A missing-row fixture is unavailable with a reason. An opportunity-only fixture has ΔX-terms of 0 and a deployment chip. |
| 3 | Current-season dry run on the frozen 2026-10-26 capture, using the reference chosen in decision 1. Local only. | decision 1 | BL/SH/withheld lists, coverage-by-reason table, every withheld row has ≥ 1 reason, no 2025-26 rows read. |
| 4 | Retrospective case audit (roadmap stage 5) on the 2,772 development origins. | — | Traceable explanations for fixed archetypes; failures disclosed. |
| 5 | Predictive test, separate from step 4: does E_support beat the frozen prior mean for next-5 production on common development origins? (2024-25 is a disclosed secondary.) | — | Report MAE/RMSE with player-clustered intervals. If it doesn't beat the prior mean, the score stays retrospective only. |
| 6 | Streak library (R1) and associations (R2): FP, raw points, GS + documented composite; hot and cold separately; entry/during/exit; all ten survey metrics; permutation null; simultaneous, lagged and forward kept apart. | none for 2022-24 | Episode counts vs null rate per detector. All ten metrics reported, including weak ones. No survey-rank weights. |
| 7 | Preview wiring for current lists. | Codex-file ownership transfer | Existing snapshot tests still pass; production stays 404 / `trusted: false`. |
| 8 | One-time 2025-26 holdout. | explicit owner release | Pre-registered question, frozen code hash, single run. |

Steps 1, 2, 4, 5 and 6 can start once step 0 is settled.

All ten survey metrics have source columns:

| Metric | Source columns |
|---|---|
| TOI | WGO TOI |
| SH% | goals/shots |
| PP% / PP TOI | WGO `pp_toi_pct_per_game` |
| SOG/60 | WGO / NST shots |
| IPP | NST `ipp` |
| iSCF | NST `iscfs` |
| oiSH% | NST on-ice `on_ice_sh_pct` |
| iHDCF | NST `hdcf` |
| A1/A2 ratio | `total_primary_assists` / `total_secondary_assists`, or NST `first_assists` / `second_assists` |
| OZS% | NST on-ice `off_zone_start_pct` |

## 5. Local evidence vs production behavior

- **Local and verified here:**
  - Code reads.
  - 3 count-only DB reads (no 2025-26 values).
  - ZIP checksums.
  - Spot checks: the synthesis's legacy-code claims match the source for the trends detector and sKO SQL.
- **Owner-reported, not re-run by me:**
  - Codex's 35 currentInput tests and 27 snapshot tests.
  - v1 outputs.
  - 2024-25 validation numbers.
  - ZIP control matches.
- **Production:** nothing verified. The preview is 404 in production builds. No BLSH output is served, trusted or adopted. No writes, migrations or deployments occurred.

## 6. Owner decisions (TJ, 2026-10-29, in this session)

**Decision 1, reference policy: one holdout run, then release 2025-26.**
- Before opening 2025-26:
  - Freeze and record the score definition, features, baseline construction, eligibility, evaluation criteria and selection decisions.
  - Run chronological development checks on earlier seasons first.
- At every evaluation date, baselines and features use only information available before that date. Retrospective validation and future-prediction validation stay separate.
- Record holdout results with coverage, missing data and player-group limits. One good result is not proof for every use. If the run fails, revise from the evidence, mark 2025-26 as consumed, and confirm on a later untouched or prospective period.
- After the evaluation, 2025-26 may enter the operational baseline. Keep the original frozen model and results separate from the refit. Label early scores provisional, and don't force scores where evidence is insufficient.
- Check whether 2024-25 is available and qualified for development and baselines; don't omit it silently or assume it is complete. No production changes or deployment.

**Decision 2, GS overlay: research only, separately labelled.**
- Admit the 1,459 reconstructed rows into a separately labelled research overlay, with source, method and version recorded. Original nulls are preserved.
- The 4 unresolved nulls, 2 control discrepancies and 116 newer rows stay separate and unavailable under this method until each is qualified.
- Reconstructed values stay distinct from official receipts.
- Run every GS analysis twice, with the overlay and on verified inputs only, and report coverage and material differences.
- Future missing rows are never assumed zero. No database write, repair or deployment.

**Effect on §4:**
- Step 3 uses 2022-24 (+ 2024-25 if qualified) + in-season games, labelled provisional.
- Step 8 becomes: freeze → one-time 2025-26 run → record → then release it for baselines (refit kept separate from the frozen model).
- GS work in steps 3–6 runs as two arms.
- The overlay needs a new labelled proof method alongside `currentInput`'s official-receipt methods. That touches Codex-leased code, so it waits on the ownership answer.

**2024-25 availability check: NOT COMPLETED.**
- Two count-only reads (WGO/NST row and null counts for 20242025) timed out on 2026-10-29, including a simplified version. I stopped instead of retrying against a possibly loaded production database.
- Prior owner-reported evidence (not re-verified): Codex's 2024-25 validation used a "repaired 2024-25 skater view", with 47,224 appearances, 920 players and 47,200 complete GS inputs.
- Status: available in some form; qualification for baselines is unverified. Rerun the same counts at a quiet time, one table per query.

## 7. Correction from the step-3 dry run (2026-10-29)

§1 row 4 and §3 said the Game Score goal-field nulls affect "GS only", and that "FP and G+A are unaffected". That holds for the individual tracks, but **not for the v1 joint score**. v1 needs all three tracks in every window game and never reweights. Without an admitted overlay, 458 of 725 current players get no score at all. With Codex's official-receipt overlay, 673 are scored. See `dry-run/DRY-RUN-REPORT.md`.
