# BLSH retrospective display: field handoff for the Codex-owned preview

**Version:** `blsh-display-handoff-v2`, 2026-10-29. v2 applies the mapping corrections in `astra-audit-2026-10-29/ASTRA-DEADLINE-DISPLAY-REREVIEW-CLAUDE-122-124.md` (§9 lists them).
- **From:** Claude, the BLSH research owner (score, explanation, current windows).
- **To:** the Codex owner of the preview: `web/components/buyLowSellHigh/BuyLowSellHighPreview.tsx`, `BlshPlayerDetail.tsx`, `web/lib/buyLowSellHigh/researchSnapshot.ts` and `.server.ts`, `web/pages/buy-low-sell-high/preview.tsx`, and their tests.

**Status:**
- This is a proposal only. Claude edits none of those files.
- It is local research only, with no deployment, database write or trusted list.
- It follows Astra's re-review (`astra-audit-2026-10-29/ASTRA-FIX-ALL-REREVIEW-CLAUDE-121.md`, "Shortest path to a usable retrospective tool").

## 1. What the display is for (TJ's goal)

- **What it compares:** recent production relative to a historical personal/cohort reference, adjusted for current underlying support. The reference supplies most of the comparison; the support adjustment changes it. Both are shown separately. Positive means buy-low evidence; negative means sell-high evidence.
- **Lists:** buy-low and sell-high are separate lists.
- **What it is not:** a trade value, a probability or a forecast.
- **Confidence and missingness are separate:** they appear in two different panels and are never merged into one "confidence" number.
- **Low and zero shots are data:** a player never disappears for low or zero shots. Missing values say *why* they are missing.
- **Predictive research stays separate:** no per-player forecast numbers appear. One static note links the development finding (§6).

## 2. Contract shape (proposal)

Keep the v1 historical contract (`fhfh.blsh.historical-snapshot.v1`) and its 2024-04-18 file unchanged. Add a **successor contract** for current-season research snapshots, so the same components can render either:

- `schemaVersion`: `"fhfh.blsh.current-research-snapshot.v2"`.
- Score and versions: `scoreVersion` `"support-conditioned-production-gap-v1"`, `explanationVersion` `"support-gap-explanation-v3.2"`, `assemblerVersion` `"blsh-current-windows-dry-run-v4"`.
- **`referencePolicy`**, required and shown in the banner:
  - `arm`: `"A_development_reference"` or `"B_development_plus_2026_prefix"`.
  - `inputs`: `"verified_inputs_only"` or `"official_receipt_overlay"`.
  - `label`: plain text. For A with the overlay: "Reference: 2022-24 development history (stale; each player's reference age is shown, 894–1,451 days in this snapshot). Current games: NHL WGO with the official-receipt research overlay for on-ice goals." Do not state an upper bound in a fixed label; show each profile's own age.
  - `stale`: true for A.
  - `selectedBy` and `selectedAtUTC`: who chose the arm and when.
  - **Decided:** TJ selected **arm A (2022-24 development reference) with the official-receipt overlay**, labelled provisional and stale, at 2026-10-29T13:15:25Z. Use `selectedBy: "TJ"`. Source file: `dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`.
- Fixed flags: `exploratory: true`, `trusted: false`, `productionAdopted: false`, `confidenceProbability: null`, `issuedAtUTC: null`.
- Timing: `eventThroughDate` and `asOfUTC` (from the current request), plus `packagedAtUTC`.
- `historyGate: "simplified currentInput-style gate; not the sealed v1 transport"`, shown under limitations.
- `sourcePins`: the dry-run-v4 pins plus the SHA-256 of the profile file. `limits: string[]`.
- `profiles`: **every** captured player for the chosen arm (725 in the v4 run). No profile is dropped.

The source for every field is one line of `dry-run-v4/PROFILES-<arm>__<inputs>.jsonl` (the type is `Profile` in `currentWindows.ts`). A pure mapper turns it into the display profile below. §8 covers who writes the mapper.

## 3. Display profile fields

**Notation:** `P` is the `Profile` line, `E` is `P.explanation` and `R` is `P.result`. "Null → text" is the text shown when the value is missing.

### 3a. Identity and list state

| Display field | Source | Label / null → text |
|---|---|---|
| `playerId`, `name`, `team`, `position` | `P.playerId`, `P.name`, `P.team`, `P.position` | Name null → "Player {id} (name unavailable)" |
| `value` | `R.value` (the −100..100 research index) | "Support-adjusted research index". Null → "Unavailable: {score reason text}" |
| `normalizedGap`, `baselineNormalizedGap` | `E.normalizedGap`, `E.baselineNormalizedGap` | "Gap after support" and "gap before support" (normalized units) |
| `gapSign` | `E.gapSign` | "Buy-low evidence", "Sell-high evidence" or "Balanced" |
| `status` | `R.status` | `concordant_research_candidate` → "Production and support agree in direction"; `conflicting_baseline_and_support` → "Production and support disagree; withheld from lists"; `unavailable` → "Unavailable" |
| `list` | `R.researchList` | "Buy-low research candidate", "Sell-high research candidate" or "Withheld; inspect evidence" |
| `rank` | position in `rankTwoLists(...)` (supportGap.ts) | Order: measured tier first, then larger \|value\|. A rank is an order, not a cutoff (§5) |
| `scoreReason` | `R.reason` when `R.value` is null | See §4 |

### 3b. What happened: per-track breakdown

One row per `E.tracks[t]`, in the order FP, G+A, FHFH WiGO Game Score.

| Column | Source | Label |
|---|---|---|
| Observed | `actual` | "Recorded in the current window" |
| Reference at current TOI | `expectedBaseline` | "Reference production at the window's ice time" |
| Support-conditioned | `expectedSupport` | "Expected given current support" |
| Gap | `gap` | "Expected minus recorded" (positive = produced less than support suggests) |
| Components | `components[]`: `id`, `kind`, `value`, `note`, `processDelta`, `referenceKind` | Kind labels: `reference_gap` "Reference vs recorded"; `model_sensitivity` "Process change × frozen sensitivity"; `imputed_estimate` "Estimated: current process missing"; `floor_adjustment` "Raised to zero (counts can't be negative)" |
| Track multiplier | `normalizedWeight` | "Normalization multiplier": this track's frozen equal-weight multiplier. It is not a percentage or a share |
| Contribution | `normalizedContribution` | "Contribution to the normalized gap" (= multiplier × gap). The three contributions sum to `normalizedGap`, which is unbounded. The displayed −100..100 index is a separate bounded transform, `100·g / (1 + \|g\|)`; for example, Brent Burns has normalized gap 1.315 and index 56.8. Never present a contribution as a share of the index |

The components add up to the gap (residual ≤ 1e-9). Show that sum, so the breakdown is visibly additive. The note under the table must say: "A retrospective comparison of the same games, not a forecast. These tracks share scoring ingredients."

### 3c. Evidence quantity (the "confidence" panel)

These fields describe **how much evidence** there is. None of them is a probability.

| Display field | Source | Label |
|---|---|---|
| Window games and span | `P.window.appearances`, `P.window.spanDays`, `P.window.dates` | "{n} games over {span} days ({first}–{last})" |
| Window ice time | `P.window.seconds` | "{minutes} minutes" |
| Freshness | `P.window.lastDateAgeDays`, `P.window.fresh` | "Last game {n} days before the recorded-through date ({eventThroughDate})". The age is anchored to `eventThroughDate` (2026-10-26), **not** the capture time `asOfUTC` (2026-10-28T03:51:05Z). If not fresh: "Stale window; withheld from lists". In this snapshot every non-fresh window is more than 7 days old. Score-unavailable reasons stay separate |
| Personal reference games | `P.reference.personalN` | "{n} personal reference games". **Show the count even when the tier says "measured"**; 1–4 games is visibly thin (36 profiles in A-overlay) |
| Estimator weight | `E.confidence.personalWeight` | "Personal estimator weight {0.80}". **Show it as a decimal labelled 'estimator weight', not as a % and not as confidence.** The cohort weight is 1 − w |
| Reference age and seasons | `P.reference.ageDays`, `P.reference.seasons`, `P.reference.staleDevelopmentReference` | "Reference ends {n} days before the window ({seasons}); stale development history". Show each profile's own age. In this snapshot there are 574 available ages, 894–1,451 days (median 912), and 535 exceed 900. When `ageDays` is null (no personal reference): "No personal reference window" |
| Cohort donors | `E.confidence.donorPlayers` | "{n} donor players fit the process sensitivity" |
| Tier | `E.confidence.evidenceTier` | Three explicit states:<br>• `measured_process_personal_reference` → "Measured process, personal reference"<br>• `provisional_estimated_or_extrapolated` → "Provisional: estimated or extrapolated"<br>• **`null` → "Unavailable: no score"**, with the score reason (52 profiles here)<br>Never map null to provisional. Note beside a tier: "a coverage tier, not calibrated confidence" |
| Extrapolation | `E.confidence.outsidePriorSpan`, `outsidePriorComponentRange` | "Process change outside the fitted range" when true |
| Calibrated probability | `E.confidence.calibratedProbability` (always null) | "Unavailable (no calibrated probability exists)" |

### 3d. Missing, estimated and restricted data (the "coverage" panel)

This panel is separate from 3c. It lists every note, so nothing missing is hidden.

- **Explanation notes** (`E.coverage[]`: `component`, `state`, `reason`): group them by `state` ("unavailable", "estimated", "partial").
- **Slot notes** (`P.coverage[]`: `component`, `reason`, `count`): the count's unit depends on the component.
  - `current_window_slot` and `reference_slot`: `count` is games. Show "{count} games: {reason text}".
  - `personal_reference`, `current_window`, `production_prior` and `support_model`: one profile-level note, where `count` is always 1 and means nothing. Show "{reason text}" without a count. In this snapshot that is 151 personal-reference and 112 short-window notes.
- **Estimated processes:** `E.confidence.imputedProcesses` → "Estimated from the other processes: {names}".
- **Floors:** `E.confidence.physicalFloors` → "Expected {track} raised to zero".
- **Context verification:** `E.scoreWindow.currentContextVerified` and `referenceContextVerified`. When false, render the recorded reason from `E.coverage` (component `current_window_context` or `reference_window_context`). Don't infer a reason from the flag.
  - `reference_window_not_supplied` (all 151 false reference flags here, for example Garrett Wilson with no personal history): "No personal reference window supplied; context comparison unavailable".
  - Only identity or mismatch reasons (`context_identity_differs_*`, `context_window_mismatch_*`, `context_outcomes_disagree_*`, `*_window_invalid`, `scored_identity_not_recorded`, `window_identity_missing`) use mismatch wording: "Context withheld: it could not be matched to the scored games". None occur in this snapshot.

The reason texts are in §4.

### 3e. Context: hypotheses, not score inputs

- **Opportunity:** `E.opportunity[]` (total, ES and PP TOI per game). Show current, reference and change (`delta`). Each is `status`/`reason`-aware.
- **Context:** `E.context[]`: goals − individual xG per 60, on-ice goals − xGF per 60, assists per teammate on-ice goal, shots per 60. Show `current`, `reference`, `delta`, `units` and `scale` (finishing spread, with its assumption text).
  - `hypotheses[]` is a list headed "Possible explanations (not identified)".
  - `scoreInput` is false and `interpretation` is "hypothesis": label the section "Context, not part of the score".
  - When `delta` is null, show the `deltaReason` text. When `revisionVerified` is false: "Source revision unverified".
- **Zero values are values:** `current = 0` displays as 0, for example shots/60 = 0. 19 A-overlay profiles have zero shots in the window: 15 have a numeric score and 7 are list candidates.

### 3f. Fixed claims

`E.claims` (`luckIdentified`, `marketValue`, `forecast`, `trusted`) are all false. Render them once, as a footer line: "Not a luck finding, a market value, a forecast or a trusted recommendation."

## 4. Reason texts (every reason present in dry run v4)

| Reason | Text |
|---|---|
| `no_measured_current_production_or_exposure` | Score unavailable: a current-window game is missing a production track or ice time (often the six on-ice goal fields Game Score needs) |
| `no_observed_current_process` | Score unavailable: none of the three process rates is observed for the current window |
| `fewer_than_five_recorded_slots` | Fewer than five current games recorded |
| `wigoGameScore:missing_or_invalid_<field>` | Game Score unavailable for this game: on-ice {field} missing |
| `individual:no_matching_process_record` / `onIce:…` | No matching NST individual / on-ice record for this game |
| `individual:process_WGO_exposure_mismatch` / `onIce:…` | NST ice time differs from WGO ice time for this game; process value not used |
| `history_nst_individual_absent` / `_onice_absent` | Reference game has no NST individual / on-ice record |
| `history_nst_individual_gate_failed` / `_onice_gate_failed` | Reference game's NST record failed the GP/ice-time match |
| `missing_measurement_or_exposure` | Personal history exists but a game lacks a track or ice time; the cohort reference is used |
| `no_personal_history_cohort` | No personal history; the position-cohort reference is used |
| `no_personal_reference_cohort_mean_used` | Process reference is the cohort mean, not the player's own |
| `current_process_missing_linear_estimate` | Current process value missing; estimated from the observed ones |
| `dry_run_simplified_gate_not_sealed_transport` | History process gate is a disclosed simplification, not the sealed v1 transport |
| `reference_window_not_supplied` | No personal reference window supplied; context comparison unavailable |
| `goals_or_individual_xG_missing` / `on_ice_goals_or_xGF_missing` / `assists_goals_or_on_ice_goals_missing` | Unavailable: an input total is missing for the window |
| `no_teammate_on_ice_goals_ratio_undefined` | Undefined: no teammate goals while on ice |
| `assists_exceed_teammate_on_ice_goals_data_conflict` | Data conflict: more assists than teammate on-ice goals |
| `spread_undefined_zero_xG` | Finishing spread undefined at zero xG (the zero is still shown) |
| `current_reference_revision_mismatch` | Change withheld: current and reference use different known source revisions |
| `current_reference_mixed_revision_composition` | Change withheld: a window mixes source revisions game by game |
| `provider_revision_unverified` | Source revision unverified |
| `invalid_<field>` (per game) | Invalid recorded value for this game; treated as unavailable |
| `exposure_components_exceed_total` | ES or PP ice time exceeds total; window context withheld |

Unknown reasons fall back to the raw code, prefixed "Unavailable:". The page never shows a blank for them.

## 5. Lists and access rules

- **Buy-low and sell-high:** every profile with `R.researchList` set, ordered by `rankTwoLists`. **No count or value cutoff.** Paginate, as the preview already does with 25 per page.
  - The A-overlay arm lists 360 BL and 223 SH from 673 numeric profiles.
  - That breadth is expected under the concordant-direction rule. It is not a defect to trim.
- **Withheld / conflicting / unavailable:** a third tab that shows **every** other profile with its reason (the preview's existing pattern).
- **Selector:** every profile stays reachable, including zero-shot and unavailable players.
- **Membership method:** any later evidence-based membership method is a separate, documented method with case checks. It is not part of this handoff.

## 6. Predictive research: separate

- No forecast numbers per player, and no "expected next 5" column.
- One static note in "Versions, provenance and limitations": "Separately, development tests on 2023-24 found the support adjustment added almost nothing to next-five-game forecasts beyond the production reference. This display is retrospective." It links to `forecast-dev-v2/FORECAST-DEV-V2-REPORT.md`.

## 7. Suggested component changes (for the Codex owner to judge)

1. **Parser:** `parseResearchSnapshot` dispatches on `schemaVersion`. v1 parsing is unchanged. v2 keeps the same fail-closed checks: unique ids, windows strictly before the as-of date, the reference before the window, null meaning unavailable, signed lists, contiguous ranks and finite numbers. It adds: `referencePolicy` present; `claims` all false; `calibratedProbability` null; components summing to each track gap within 1e-9.
2. **`stateLabel`:** add a stale-reference qualifier for arm A. Keep "coverage tier ≠ confidence".
3. **`BlshPlayerDetail`:**
   - Replace `percent(personalWeight)` with the decimal "estimator weight".
   - Add the per-component breakdown (3b), the separate evidence (3c) and coverage (3d) panels, and the context hypotheses (3e).
   - v2 has no `families`. Opportunity and context replace them.
   - The streak panel's existing "unavailable" text applies, since no current-season streak is saved.
4. **Banner:** the reference-policy label (§2) and "Current-season research snapshot through {eventThroughDate}; exploratory; not trade advice".
5. **Tests:** zero-shot and unavailable profiles are reachable; no cutoff; estimator weight is not shown as %; every §4 reason has a text; v1 snapshot rendering is unchanged.

## 8. Ownership and next steps

- **Codex owns** the parser, components, page and their tests.
- **Claude owns the mapper.** Codex cleared it in `CODEX-BLSH-DISPLAY-MAPPER-SNAPSHOT-20261029`:
  - the pure mapper `web/lib/buyLowSellHigh/displayProfile.ts` and its test `displayProfile.test.ts`;
  - the candidate snapshot `tasks/artifacts/blsh-independent-review-2026-10-28/display-snapshot-v2/2026-10-26.arm-a-official-overlay.v2.json`, with its receipt.
- **Codex owns the canonical target** `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json` and the loader pin. Claude installs neither.
- **The snapshot needs:** the reference arm (decided: A with the overlay, §2); nothing from 2025-26 reserved data, the database or a deployment.
- **Open items that don't block display:**
  - 2024-25 qualification of a recent operational reference (its own bounded task);
  - stored-PBP qualification;
  - evidence-based list membership.

## 9. Corrections applied in handoff v2 (Astra review of CLAUDE-122/124)

1. **Tier:** there are three explicit states, and null means unavailable, never provisional (52 null tiers).
2. **Context absence:** context absence has its own wording, and mismatch wording is reserved for real mismatches (151 absent reference windows, no mismatches).
3. **Coverage counts:** coverage-count units depend on the component; profile-level notes are not "games".
4. **Reference age:** the fixed "~900 days" bound is removed. The actual range is 894–1,451 days, and each profile's own age is shown.
5. **Freshness:** freshness is anchored to the recorded-through date, not the capture time.
6. **Normalization:** the normalization multiplier and the contribution to the normalized gap are labelled separately from the bounded index.
7. **Introduction:** the introduction names the historical personal/cohort reference first, then the support adjustment.

**Dry-run evidence limitation, preserved:** `dry-run-v4/RUN.log` records a passed test with no error section, but not the process exit status (`dry-run-v4/RUN-EVIDENCE.md`).


**Reason texts:** the mapper's table (`REASON_TEXT` and patterns in `web/lib/buyLowSellHigh/displayProfile.ts`) is the authoritative superset of §4. It adds the comparison-level codes, such as `window_not_supplied` (a side with no window), the TOI, scope and provenance codes, and attribution failures. Every reason present in the candidate resolves to a written text; the build checks this across all 725 profiles.
