# Explanation layer: independent review and how each finding was handled

- **Reviewer:** a fresh read-only Claude subagent, 2026-10-29. It was given the code and the product intent, not my conclusions. It is not a Codex or human review.
- **Subject:** `explainSupportGap` in `web/lib/buyLowSellHigh/supportGap.ts` (the score code above it was out of scope).
- **Verdict as reviewed (v1):**
  - The score decomposition was sound: the parts add back exactly, floor sign and imputed tags correct, no luck claim.
  - The context panel was not ready. It could describe a different window from the one scored. It labelled provider-xG differences as measured, put a window-total spread beside per-game numbers, mixed strength scopes, and dropped reference-side coverage gaps.

The fixes are in explanation v2 (`support-gap-explanation-v2`). The score code, the ported tests and the parity suite are byte-unchanged.

| # | Finding (severity) | Disposition in v2 |
|---|---|---|
| 1 | Context and score windows never cross-checked (should-fix, near blocker) | Context is withheld, with coverage reason `context_window_mismatch_with_scored_window`, unless its seconds (and appearance count, when the score has one) match the scored window. `scoreWindow` exposed. |
| 2 | √ixG spread in window-total units beside per-game numbers | Spread is now in goals/60, same as the comparison, with a `units` field. Omitted when the comparison is unavailable. Labelled as an upper bound that is conditional on the provider model and ignores reference uncertainty. |
| 3 | Provider-xG differences tagged `measured` | New kind `provider_model_relative`. |
| 4 | No scope or coverage alignment across sources | `WindowEvidence` now declares a scope per field (`goals`, `assists`, `ixG`, `onIceGoals`, `onIceXG`). Comparisons are unavailable (`operands_scope_mismatch_or_unknown`) unless both operands share a known scope. The contract says a field must be null unless every appearance has it. |
| 5 | Assists per on-ice goal ill-defined | Replaced by assists ÷ (on-ice GF − own goals). Data conflicts (`assists_exceed_teammate_on_ice_goals_data_conflict`) and zero denominators (`no_teammate_on_ice_goals_ratio_undefined`) are reported, never zero. |
| 6 | Per-game finishing gaps mix in opportunity | Finishing and on-ice gaps are per 60. |
| 7 | Missing reference values left no coverage | `reference:<metric>` coverage notes added, with a `referenceReason` on each comparison. |
| 8 | Unavailable reasons pointed at the wrong cause | Exact reasons: `window_not_supplied`, `appearances_missing`, `no_appearances`, `TOI_missing`, `no_ice_time`, and field-specific missing. |
| 9 | Tracks not tied back to the score | Each track reports `normalizedWeight`, `normalizedContribution` and `baselineNormalizedContribution`. The top level reports `normalizedGap`, `baselineNormalizedGap` and `normalizedReconciliationResidual`. |
| 10 | Missing or wrong model hidden | A missing model gives coverage `explanation_model_missing`. A wrong model throws, because each track's process components must equal the score's `supportAdjustment` within 1e-9. |
| 11 | Kind merges personal and cohort references (nit) | `referenceKind` (`personal`, `cohort`, `estimated`, `imputed_current`) on every process component. |
| 12 | Baseline note claims a blend (nit) | The note depends on `personal_n` and `personal_weight`; it says "position cohort" when there is no history. |
| 13 | `direction` meant list membership (nit) | Split into `gapSign` and `researchList`. |
| 14 | Duplicate coverage notes (nit) | Deduplicated. |
| 15 | Slightly leading hypotheses (nit) | Each list now starts with a source/scope-mismatch reading. Finishing adds empty-net and goaltending; on-ice adds the player's own finishing. |
| T | Test gaps | Added tests for: a non-symmetric beta with exact values, window mismatch, `appearances` 0 and null, zero ice time, null reference fields, scale units and absence, a missing or wrong model, cohort and estimated kinds, negative GS not floored, the SH case and a stale concordant case. The residual tolerance is now relative. |

## Verification

- 41 unit tests passed.
- Opt-in replays:
  - Score parity unchanged: 0 mismatches, max value difference 1.7e-13.
  - Every component and every track contribution reconciles within 1e-9 on all 2,414 numeric v1 origins.
- Whole-project tsc exit 0; eslint clean. Each run held the heavy lock and released it.

**Still open:**
- v2 has had no second independent read.
- No caller supplies real windows yet. That is step 3, still waiting for Codex clearance.
- Until both are done, treat the explanation as **research-only, not trusted**.

---

# Explanation v3: Codex review CODEX-BLSH-EXPLANATION-V2-REVIEW-20261029 (reproduced by Astra)

v3 replaces v2 in the same leased files. The score code is still the byte-identical 317-line prefix (`bc9d31c9…`).

| # | Finding | Disposition in v3 | Regression tests (`supportGap.test.ts`) |
|---|---|---|---|
| 1 | Matching seconds and appearance counts admitted different players or games; the reference identity was unchecked | Context requires `scored` identity (player, current IDs, reference IDs). The current window must match the scored IDs, the production axis's `current_source_ids`, the appearance count and the seconds. Its all-situations goals + assists must equal the scored G+A. The reference is checked separately. Each failure has its own reason, and missing identity withholds context. | "review finding 1": different player, different games with equal totals, missing window or scored identity, totals disagreeing (17 vs 2), axis IDs differing, reference IDs differing, seconds/appearance mismatch |
| 2 | ES/PP rates and the spread divided by total seconds | Each scope uses its own exposure (all situations → total, ES → ES, PP → PP), including the spread. Missing, zero or unknown denominators are withheld with reasons. | "review finding 2": PP goals 2, ixG 1, PP 600 s gives **6**/PP60 and spread 6; ES shots; missing, zero and unknown denominators |
| 3 | Cross-window scope mismatch gave an available delta; no source or revision metadata | `WindowEvidence.provenance` records provider, field and revision per total. A delta needs the same scope, provider and field. A known revision mismatch withholds it; an unknown revision gives `revisionVerified: false` and a partial coverage note. Missing provenance makes the value unavailable. | "review finding 3": PP vs all-situations scope, provider mismatch, revision mismatch, unknown revision flagged, null provenance |
| 4 | Checking only the summed correction allowed cancelling betas or reordered names | New `scoreAndAttribute` calls the frozen `score` and records the scoring model's per-feature contributions, deep-frozen and keyed to that exact result object. `explainSupportGap(result, context)` no longer accepts a model. It recomputes and checks each per-feature contribution and the fingerprint. A result scored without attribution gives `explanation_attribution_missing`. | "review finding 4": plain `score()` result refused; cancelling betas (delta [1,1,0]) give [0.5,0,0] vs [1,−0.5,0], each true to its own scoring model; the scoring model's own names and order; frozen record; NaN beta rejected |
| 5 | NaN/Infinity or negative inputs failed open | Every window count and exposure must be finite and non-negative (appearances an integer). Invalid seconds or appearances withhold the window; other invalid fields become unavailable with `invalid_<field>`. Invalid coefficients are rejected by the frozen `score`. | "review finding 5": NaN, Infinity and −1 seconds; 2.5 appearances; Infinity goals; −1 assists; no "NaN" in output |

**Real-window regression** (the historical replay passes null context, as the reviewer noted):
- `currentWindows.test.ts` checks the bound identity, the absence of withheld context and the revision flag on assembled windows.
- Dry run v2 (`dry-run-v2/SUMMARY.json` → `realWindowIntegrity`), across 2,900 real profiles:
  - no identity, mismatch, disagreement or invalid withholdings;
  - worst track residual 2.4e-15;
  - no non-finite numbers;
  - scores byte-identical to the first run.

**Checks run** (2026-10-29T04:16:36Z, each under the heavy lock, released):
- 180 BLSH tests passed.
- Opt-in parity, unchanged: 0 mismatches, max value difference 1.7e-13; snapshot 924/924.
- Production-reference parity: 2,772 axes.
- Explanation reconciliation: 2,414/2,414.
- Whole-project tsc exit 0; eslint clean.

**Hashes for re-review:**
- `web/lib/buyLowSellHigh/supportGap.ts` f3dd3400e3034c52264e13bac35e06668767a891148aa860f48de5b06031c940
- `web/lib/buyLowSellHigh/supportGap.test.ts` 35e6e0577d06335ce35dc278c50729637c19aeb7e59953f7d52ba391a7f93994
- `web/lib/buyLowSellHigh/currentWindows.ts` 370037fd4d75245e6b47f21d39f45b938174380a8859a33af3fc16f4c6200741
- `web/lib/buyLowSellHigh/currentWindows.test.ts` ff6ba3b1068743ae2bcf9282d513bb2a39aec1345cada41ebe9b38178278202a
- `web/scripts/blsh/currentDryRun.test.ts` f2e1efd03d2502b8009e0cbaaef3e9ca8e8b52b89e3ea619e17aa57bd60e43c1
- `web/scripts/blsh/export_dev_history.py` b6a4a580acc7af04a6d469429fbfefa19411aea4cf52a92d5847b3acd4deefe6
- `web/lib/buyLowSellHigh/productionReference.ts` 9a56af85486c850aebc2df4d3ad218b43ca2bbeb3a7073453a0c38189a4be85e (unchanged this round)
- `web/lib/buyLowSellHigh/productionReference.test.ts` c5527e9cc4461702eee97993a40ad1bd49b3dc3cf80e36cc8690ff8c2474344d (unchanged this round)

**Status:** research-only. A second independent read of v3 has been requested.

---

# Explanation v3.1: independent re-review of v3 (2026-10-29)

**Reviewer:** a fresh read-only Claude subagent, briefed with the code, the earlier findings and the product intent, but not my conclusions. Codex has not yet posted its own re-review; that request (CLAUDE-20261029-117) is still open.

**Verdict as reviewed:**
- **Fixed:** no blockers. Arithmetic and report numbers verified. (b) per-scope exposure and (e) invalid numbers are fixed; (d) is fixed for the reported cases.
- **Partly fixed:** (a) identity and (c) provenance.
- **Report:** four lines overclaimed.

| # | Re-review finding | Disposition in v3.1 |
|---|---|---|
| 1 | Identity checks only compare caller-supplied lists | The scored identity is now read from the production axis the score consumed (`player_id`, `current_source_ids`, `reference_source_ids`); the context argument no longer carries one. Missing axis identity → `scored_identity_not_recorded`. A negative test through `assembleProfiles` explains a real profile with another player's window and with shifted games; both are withheld. **Recorded limitation:** the axis is still built by the same caller (`currentWindows`), so this is binding to the scoring input, not independent proof of source identity. |
| 2 | The overlay revision tag changed nothing; 298 on-ice deltas mixed sources | On-ice goals now carry a **known** per-game revision: `wgo_raw`, `official_evidence_corrected` (development research view), `official_receipt_overlay` (current) or `unresolved:*`. A window with different labels becomes `mixed:<labels>`. Different known labels give `current_reference_revision_mismatch`, which withholds the delta. Dry run v3 withholds 851 on-ice-goal and 1,303 assist-rate deltas. NST and other WGO fields still have unknown revisions and stay flagged `provider_revision_unverified`. |
| 3 | "No personal history" false for 134 profiles; missing `personal_n` read as 0 | A missing `personal_n` now says "not recorded". When it is 0, the note uses the axis's `personal_reason` ("exists but was not usable (missing_measurement_or_exposure)"). In B verified that covers 134 profiles; 10 genuinely have none. |
| 4 | The history hash was checked against the receipt beside it; INPUTS.json and the exporter were unpinned | The runner pins `dev-history.jsonl` (`da32a473…`), `INPUTS.json` (`343e7960…`) and `export_dev_history.py` (`b6a4a580…`) in code. It verifies the file, the receipt fields and the exporter itself when they are read. |
| 5 | The goals + assists check could be bypassed | The axis records `current_goals` and `current_assists`. Each all-situations context field must equal its scored part, neither may exceed the scored G+A, and both together must sum to it. Both of the reviewer's reproductions are regression tests. |
| 6 | Report: "genuine performance change" overclaims (4 near-zero flips) | Renamed "reference composition changed, same evidence modes" (`dry-run-v3/DRY-RUN-REPORT.md`). |
| 7 | Report: "bound" overclaims | Reworded: consistency with the scored axis, not an independent check. |
| N | Nits | **Fixed:** the result is deep-frozen by `scoreAndAttribute` (relabelling throws); the attribution snapshots the full scoring model, so `cohortX` and `Cxx` are in the fingerprint; an integrity failure gives a coverage note (`attribution_integrity_failed:*`) instead of throwing; `scoreWindow` reports `currentContextVerified` and `referenceContextVerified`; ES + PP above the total withholds the window; an undefined spread at zero xG gives a partial note. **Report wording fixed:** case values are now shown as current/reference/change; span figures are labelled by arm; list-change denominators are made explicit. **Open:** the files are still untracked in Git. Commits happen only when TJ asks. |

**Checks run, each under the heavy lock (released):**
- 188 BLSH tests passed.
- Opt-in parity: 0 mismatches, max value difference 1.7e-13, snapshot 924/924.
- Production-reference parity: 2,772.
- Explanation reconciliation: 2,414.
- Dry run v3:
  - all 2,900 results have identical score fields against the first run; only the four declared axis additions are ignored in the comparison;
  - real-window integrity is clean: no identity, mismatch or invalid withholdings; worst residual 2.4e-15; no non-finite numbers.
- tsc exit 0; eslint clean.
- A first v3 run failed its score-unchanged check because it compared the whole result JSON, which now includes the axis additions. Its partial output is kept at `dry-run-v3-failed-unchanged-check/`.

**Hashes:** supportGap.ts c45d48cc9845a65c86fb937609bcffc4f9c4e1ece28fa2a8886bbc17ad352dd0; supportGap.test.ts e82de92c617b9bc09eebdce130a69b086e51105f472f0747da66688531924a21; currentWindows.ts 894c2ece26693f611b77eb272ef6fe1c736d72817b37f0b00bab3e73f2561df4; currentWindows.test.ts d0f630554e00edca5ef9897e2f76122e2ddabc9616504643061a49d6cd330cca; currentDryRun.test.ts 730628085db65af8f145d1d8f490e75a87bf4319b7a3ca8b410e5d9e9546af09.

**Status:** research-only, exploratory, descriptive context.

# Explanation v3.2: Codex re-review of v3.1 (CODEX-BLSH-EXPLANATION-V31-REVIEW-20261029)

| # | Codex finding (P2) | Disposition in v3.2 |
|---|---|---|
| 1 | Mixed revisions lose per-game composition. Opposite overlay/raw compositions shared one `mixed:` label and still produced an on-ice delta. | `windowEvidence` now keeps each game's on-ice revision, in window order, as `provenance.onIceGoals.gameRevisions`. `compatible()` withholds any delta where either side is mixed (a `mixed:` label, or more than one distinct game revision) with `current_reference_mixed_revision_composition`. Different known labels still give `current_reference_revision_mismatch`. **Regressions:** opposite compositions with identical labels (supportGap.test); per-game revisions alone mark a window as mixed (supportGap.test); flipped compositions keep distinct per-game lists under one label (currentWindows.test). **Real data:** dry run v4 withholds 41 such deltas (35 assist rate, 6 on-ice finishing), all in arm B with the overlay. |
| 2 | Exposure consistency needed both ES and PP. PP 7200 s against a 3600 s total with ES missing was accepted. | `cleanWindow` checks each known ES or PP part against the total on its own, then their sum when both exist. The same one-second-per-game rounding allowance applies. A failure withholds the window with `exposure_components_exceed_total`. **Regressions:** PP above the total with ES missing, and ES above the total with PP missing, each for the current and the reference window. They check the coverage notes, the verified flags and that every opportunity and context value for that side is unavailable. A known part within the total is still accepted. |
| 3 | Negative per-game values cancelled before validation (goals −1 and +1 summed to a valid-looking 0). | `devSlot` and `currentSlot` now validate every count and exposure per game. A present but negative or non-finite value becomes unavailable for that game, with `invalid_<field>` in the slot's reasons, so a window total over it is unavailable rather than cancelled. On-ice goals for were already validated per game; an invalid component now also records a reason. **Regressions:** cancelling goals and ES exposure in development rows; cancelling goals and negative PP exposure in current rows; an assembled profile whose current and reference windows both contain cancelling values. That profile reports `invalid_goals` per window, a null scored goal count, and finishing and assist context unavailable with reasons. **Real data:** a scan of all 94,429 history rows found no such values, and no slot in any dry-run v4 window or reference reports one. Production tracks are not changed by this (they are score inputs owned by the frozen estimator and the input checker). |

**Also fixed (runner status, raised for the evaluator but true here too):**
- Every earlier dry run exited 1 with an unhandled Vitest `onTaskUpdate` error. The reports had called that a heartbeat warning; they now carry corrections.
- `assembleProfiles` is now async and yields between players. Dry run v4 ran with exit 0 and no unhandled error.

**Recorded limitations, unchanged:**
- Identity is consistency with the production axis that the same assembler builds. It is not independent proof of the upstream mapping.
- The WeakMap attribution survives only on the original in-memory result. Serialized or cloned results fail closed.
- Numerical parity does not establish input qualification or equivalence with the sealed transport.

**Checks (heavy lock, released after each):**
- 197 BLSH tests passed and 5 opt-in suites were skipped.
- tsc exit 0; eslint clean on all changed files.
- The scorer's 317-line prefix is still `bc9d31c9…`, and `productionReference.ts` is unchanged (`9a56af85…`).
- Dry run v4: all 2,900 scores are identical to v3, and integrity is clean (`dry-run-v4/DRY-RUN-REPORT.md`).
- The real history has no negative or non-finite per-game counts or exposures.

**Hashes:**
- supportGap.ts `d8b8d42a3ed7a6a66b7d7402ac62ea433c6a77702f086309fd21568ee27a5618`
- supportGap.test.ts `1b192a4928972097f349210cbeb1aeaf2e6bb47d30a9d48e45da7acdc456b96f`
- currentWindows.ts `e3d4c5f7878df7ccb26a348fa1824b9c9c1f65fea307161ceca6ec38f2214959`
- currentWindows.test.ts `a365d831a3aa9947a39135768ca8c1ae0d1b1b961f581e687df36f339ba5ddc4`
- currentDryRun.test.ts `f1b759d5554e980376f9e96793a5dccb3a6a74632a893b334c0977d8d379f781`

**Status:** research-only, exploratory, descriptive context. Re-review requested.
