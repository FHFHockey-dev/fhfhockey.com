# FORGE v2 skater forecast tasks

Implementation has not started. This list accompanies the [v2 plan](prd-forge-v2-skater-forecasts.md); checked-off historical task examples do not apply here.

## Relevant Files

- `web/lib/player-forecasts/schedule.ts` — read-only candidate for next-ten team-game scoping; prove complete schedule retrieval.
- `web/lib/player-forecasts/accountability.ts` and `web/pages/player-forecasts.tsx` — read-only candle/visualization primitives to assess for reuse.
- `web/lib/player-forecasts/dashboard.ts` — existing history query and current-start limitations to address in a v2-owned reader.
- `supabase/migrations/20260802163747_add_player_forecast_foundation.sql` — existing immutable-output and revision concepts to review; do not assume permission to reuse shared tables.
- `web/lib/player-forecasts/evaluation.ts` and `web/lib/player-forecasts/modeledSkaterParticipation.ts` — candidate evaluation and participation primitives; verify target and population fit.
- `web/lib/projections/stages/skater-stage.ts` and `web/lib/projections/gameRevisions.ts` — read-only FORGE reference, currently subject to owner coordination; do not modify v1 for this work.
- `web/pages/api/v1/db/forge-served-forecast-snapshot.ts` and `tasks/prd-forge-accountability-table.md` — read-only RSO snapshot/approved-grade reference.
- New v2-owned model, storage, UI and tests: exact paths and owners to be agreed after a fresh lease check; prefer new files over touching shared v1/RSO code.

### Notes

- Numbered tasks identify work; only actual prerequisites are sequential. M4 fixture UI can proceed independently once M0 freezes its contracts. Owners named in the plan are unassigned roles, not file leases.
- Use Vitest and existing focused web test conventions for TypeScript; use relevant local model/fixture checks and an accessible browser fixture for the affected UI. Do not run production, live acquisition, remote builds or deployment as verification.
- Keep issue history, simulated historical vintages, prospective shadow forecasts, RSO snapshot/display evidence and any future serving evidence distinct.

## Tasks

- [ ] 1.0 Freeze the v2 contract and evidence boundaries. **Owner: v2 lead; prerequisite for all implementation.**
  - [ ] 1.1 Define the eligible skater universe, roster/team resolution, complete next-ten schedule retrieval, season-end and missing-data states, and the versioned default fantasy scoring profile.
  - [ ] 1.2 Freeze game identity, as-issued schedule evidence, source/cutoff/commit clocks, final pregame eligibility, participation conditioning and correction/no-show semantics.
  - [ ] 1.3 Inventory available original-as-of inputs, protected/previously exposed data and chronological fit/calibration/holdout periods; record gaps without relabeling reconstructed data as live.
  - [ ] 1.4 Trace the approved RSO game-day grade and last-five baseline to snapshot and actual display evidence; document any mismatch or unsupported exposure claim without changing v1.
  - [ ] 1.5 Freeze material-change rules, latency/freshness expectations and bounded CPU, storage and request budgets; choose interval calibration levels, minimum support and pass tolerances before final evaluation.
- [ ] 2.0 Implement v2 schedule, refresh and immutable issuance. **Owner: v2 data; depends on 1.0.**
  - [ ] 2.1 Generate ten distinct future player/game scopes when schedule evidence supports ten; retain unavailable states and schedule revisions through breaks, postponements, trades and cancellations.
  - [ ] 2.2 Design isolated storage and provenance after reviewing private forecast reuse and permissions; persist all actually issued versions with stable identity, clock, trigger and model/scoring lineage.
  - [ ] 2.3 Implement bounded affected-scope scheduling for appearances, team-game start/completion, material source changes and approved model/scoring updates; coalesce only unissued work, preserve follow-ups and expose stale/failure states.
  - [ ] 2.4 Make retries idempotent, history reads complete and ordered, and final pregame selection robust to concurrent, late, post-start and corrected timing evidence.
  - [ ] 2.5 Add fixture-backed tests for H10→H9 continuity, changed/unchanged reissues, idempotency, complete retrieval, rollover, missing data and schedule/team changes.
- [ ] 3.0 Build individual skater forecasts and participation evidence. **Owner: v2 modeling; depends on 1.0 and consumes 2.0's contract.**
  - [ ] 3.1 Reuse appropriate native FORGE components without changing v1; produce an independently contextualized conditional FP point forecast for each eligible player/game from evidence available at the origin.
  - [ ] 3.2 Produce or explicitly withhold per-game dressing probability; label conditional vs unconditional values and preserve model, fallback and source provenance.
  - [ ] 3.3 Build a matched last-five baseline with the same player/game, cutoff, conditioning and scoring; disclose unavailable baselines and compare coverage.
  - [ ] 3.4 Verify individual outputs and population coverage using deterministic fixtures, including no-shows, uncertain status, injuries, new players and changed teams.
- [ ] 4.0 Calibrate and validate statistical uncertainty. **Owner: v2 modeling/evaluation; depends on 1.0 and 3.0. Core readiness gate.**
  - [ ] 4.1 Build a joint FP predictive distribution or a versioned direct residual-calibration model; expose nominal 80% p10–p90 intervals conditional on dressing, separately from overlap.
  - [ ] 4.2 Fit and calibrate only on predeclared chronological data; evaluate untouched later periods and preserve independent prospective evidence as it accrues.
  - [ ] 4.3 Report coverage with time/slate dependence, interval width and a proper score, H1–H10 support, forecast/abstention counts, and paired baseline results; separately assess dressing-probability calibration.
  - [ ] 4.4 Block readiness and show an explicit unavailable state for insufficient evidence or failed calibration; do not replace this work with an unvalidated visual range.
- [ ] 5.0 Build forecast overlap and accountability views. **Owner: v2 presentation/accountability; depends on 1.0; fixture work can run alongside 2.0–4.0.**
  - [ ] 5.1 Render all comparable eligible pregame revisions by stable game, high/low and path-overlap opacity; separately label ineligible versions, support accessible values and mark model-version changes and cadence dependence.
  - [ ] 5.2 Render the statistical prediction interval separately, with conditioning, nominal level, calibration/support and stale or unavailable states.
  - [ ] 5.3 Implement separate RSO-served and v2 final-pregame accountability series, matched baseline, dressed-only FP metrics, no-show count, participation calibration and corrected outcome revisions.
  - [ ] 5.4 Test Larkin's `10 → 5 → 8 → 6.5` example, interval distinction, pagination/completeness, missing/empty/stale states, keyboard access and readable text alternatives.
- [ ] 6.0 Prove the complete local flow and prepare the future integration gate. **Owner: v2 lead; depends on 2.0–5.0.**
  - [ ] 6.1 Exercise fixture refresh → issued versions → eligible pregame selection → outcome and correction → v2 and separately sourced RSO metrics end to end; verify v1/RSO fixture behavior is unchanged.
  - [ ] 6.2 Record measured local fan-out, latency, queue and storage estimates against frozen limits; independently review statistical, provenance, privacy and failure behavior.
  - [ ] 6.3 After separate authorization, gather bounded prospective shadow issuance/settlement and verify predeclared calibration, coverage, freshness and cost gates; do not claim readiness on fixtures alone.
  - [ ] 6.4 Once ready, coordinate a reversible adapter and side-by-side/rollback plan with existing v1/RSO owners; obtain any required current-task authorization before production publication or deployment.
