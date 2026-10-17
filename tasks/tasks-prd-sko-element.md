# Tasks for The Sko Element

Source PRD: `tasks/TASKS/prd-sko-element.md`  
Prepared: October 15, 2026. All execution tasks are proposed and unchecked. No application implementation, empirical analysis or release was performed while writing this list.

## Relevant Files

Existing paths were verified only in the October 13 commit-pinned snapshot. Reconcile the current checkout before editing; existing references are candidates to inspect, not blanket edit scopes.

- `tasks/TASKS/prd-sko-element.md` and `tasks/tasks-prd-sko-element.md` — this specification and execution list.
- `tasks/TASKS/sko-charts/sko-ownership-contract.md` — existing legacy/quarantine ownership and lineage.
- `web/pages/skoCharts.tsx` — existing quarantined route; preserve during fixture development and reconcile at integration.
- `web/pages/trends/index.tsx` — existing visual hierarchy and interaction reference; do not copy the whole page.
- `web/lib/sustainability/features.ts` and `web/lib/sustainability/features.test.ts` — existing pure arithmetic, missingness and test patterns to inspect selectively.
- `web/lib/sustainability/trendsIdentity.ts` and `web/lib/sustainability/runtimeContract.ts` — existing identity and deterministic configuration patterns, not required runtime imports.
- `web/lib/projections/goalieModel.ts` and `web/lib/projections/queries/goalie-queries.ts` — existing goalie semantics/evidence reference; current FORGE owner retains ownership.
- `web/components/sustainability/SustainabilitySparkline.tsx` and `web/components/forge-dashboard/SustainabilityCard.tsx` — existing small visual patterns to assess for safe extraction.
- `web/lib/skoElement/` (new proposed directory) — shared contracts, validation, fixture adapter, descriptive interpretation and Sko view model; finalize exact filenames after checking current conventions.
- `web/components/skoElement/` (new proposed directory) — fixture-fed F/D/VuDu presentation under existing app conventions; final preview/page entry is a later current-tree decision.
- Tests alongside new pure modules and the nearest supported component/page test location — new contract, scenario and interaction coverage, using the existing runner.

### Notes

- This is the complete single-pass task list. IDs are references, not a mandatory serial sequence. No checkbox records completed execution.
- Continue RSO and FORGE work in parallel, prioritize active core-release work and protect its files. Independent Sko fixture work may proceed when authorized and non-conflicting. Compatible released readers and owner agreement gate live integration; a public deployment is not an invented prerequisite for every fixture task.
- Lead owns shared contracts/adapters and integration boundaries. Sko owns its view model/components. Buy Low/Sell High owns its market/watchlist/trade domain and page, consumes this core and must not duplicate it. Assign one editor per shared file.
- Follow current AGENTS.md, checkout/dirty-state evidence and existing app/test conventions. Do not create a separate application, package, router, dependency set or build infrastructure. Verify actual Vitest/page-test commands from the current manifest before execution.
- Keep the pure core deterministic and free of network/database/page dependencies. Fixture development adds new modules/components only; active forecasts/readers, legacy routes, global config/styles, package/lockfiles, schemas, cron and ingestion remain outside its edit scope.
- Preserve optional metadata as explicit absent/not-applicable states. Missing calibration, reference or scenario fields gate their dependent claims, not a valid same-unit expected-minus-recent view.
- Do not run application tests merely to save these Markdown files. Later checks should be focused after coherent changes, with complete relevant integration checks at milestones.
- For a blocker, record missing input/evidence, owner, affected claim and next step. Continue independent authorized work. This list supplies no live access, model fitting, reserved evaluation-data access, production writes or deployment authority.

## Tasks

- [ ] **1.0 Reconcile ownership and freeze the implementation boundary**  
  **Owner:** Lead. **Prerequisite:** later implementation authorization. **Requirements:** FR-01, FR-02, FR-24.
  - [ ] **1.1** Verify canonical checkout, branch/HEAD, dirty changes and active FORGE/RSO/Start Chart owners. Reconcile newer work against snapshot `a8f58de6178e282acd3a71851c66f4a56b119f14`; record protected paths and non-conflicting add-only scope.
  - [ ] **1.2** Review small identity/arithmetic/provenance/chart candidates and legacy quarantine lineage. Record keep/extract/defer decisions; reject old weight/sign/probability assumptions and whole-page copying.
  - [ ] **1.3** Agree one shared-core owner, page owners, exact new module/component/test paths, local fixture entry and requirement-to-evidence ledger. Keep final production route/navigation decisions separate.

- [ ] **2.0 Define and test the shared interpretation contract**  
  **Owner:** Shared-core lead. **Prerequisite:** 1.1–1.3. **Requirements:** FR-03–FR-11, FR-13–FR-19, FR-24.
  - [ ] **2.1** Define immutable evidence/forecast/interpretation identities, F/D/G model class versus eligibility, target units/exposures, exact cutoffs and explicit missingness. Require only fields needed by each claim; represent richer optional metadata without blocking a simpler eligible gap.
  - [ ] **2.2** Define independent observation windows and 5/10/20 scheduled-team-game horizons, exact game IDs/dates, schedule version, team-change and incomplete-season handling. Document comparator eligibility and confirmed nonappearance versus missing-row treatment.
  - [ ] **2.3** Define field-level conditional/already-marginalized/not-modeled semantics, included appearance/start/role factors and pass-through guarantees. Define supplied scenario/reference/uncertainty fields and distinct observed variability, predictive spread and mean uncertainty.
  - [ ] **2.4** Define a page-neutral output for Buy Low/Sell High, including native-unit gap/sign, outlook change, explanation evidence and status. Freeze an initial version with the market owner; exclude quote/watchlist/trade state from it.
  - [ ] **2.5** Add focused contract tests for unit/basis/class mismatch, absent optional metadata, invalid dates/denominators, unknown conditioning and already-adjusted goalie values. Verify dependent-claim gating and unchanged canonical outputs.

- [ ] **3.0 Build deterministic evidence and interpretation mechanics**  
  **Owner:** Shared-core owner. **Prerequisite:** 2.1–2.4. **Requirements:** FR-07–FR-17, FR-19, FR-22, FR-24.
  - [ ] **3.1** Implement fixture normalization with stable identity/deduplication, exact effective/available cutoffs, preserved zero/unknown and inherited warning severity. Test reordered input, duplicates, contradictions, future facts, revised/backfilled sources and season/strength boundaries.
  - [ ] **3.2** Consume supplied own-player and separate F/D/strength reference estimates with fallback provenance. Validate matched IPP numerators/denominators and units; compute descriptive deltas without fitting references or a new posterior.
  - [ ] **3.3** Implement comparable native-unit expected-minus-recent gaps, lower-is-better orientation and separate outlook change. Cover intentional PPP scoring bonuses and incomplete category coverage; leave normalized scores absent unless separately accepted.
  - [ ] **3.4** Interpret supplied opportunity trajectories and conditional/marginal outputs without changing means, fitting probabilities or double-applying participation. Preserve dependence/attribution limitations and separate volatility fields; unknown intervals/probabilities remain unknown.
  - [ ] **3.5** Define explanation records and measured flag history from fixed versioned rules, with actual first-available detection time. Test no hindsight backdating or invented time-to-recovery; defer empirical thresholds until a development protocol is approved.

- [ ] **4.0 Prove scenarios and shared-page parity with fixtures**  
  **Owner:** Shared-core lead with page owners. **Prerequisite:** contract from 2.0; incremental mechanics from 3.0. **Requirements:** FR-10–FR-19, FR-24, FR-25.
  - [ ] **4.1** Supply unmistakably synthetic canonical bundles for durable promotion, temporary promotion/reversal, demotion/recovery, role switching, stable-role finishing heater, stable low output, matched F/D IPP and sparse/stale/conflicting evidence. Include exact fictional schedules for 5/10/20 team games.
  - [ ] **4.2** Include goalie contract cases for starts/relief/workload, on-net versus unblocked event universes, ratio primitives and already-start-adjusted probabilities. Keep the page's pending-adapter state honest; fixtures do not establish live VuDu support.
  - [ ] **4.3** Verify promotion can raise sustainable output, temporary opportunity can alter the supplied marginal forecast, greater uncertainty need not lower the mean, and stable low output is not high quality. Explain coexistence of cooling and upgraded outlook.
  - [ ] **4.4** Have both page view models consume identical frozen records. Test that quote/trade/reference changes leave canonical values, scientific identity and Sko output unchanged; a market failure must not break Sko.

- [ ] **5.0 Compose the fixture-fed sustainability page**  
  **Owner:** Sko UI owner. **Prerequisite:** 2.0 contract and 4.1 fixture shape; no live reader dependency. **Requirements:** FR-02, FR-20–FR-25.
  - [ ] **5.1** Build F/D/VuDu navigation and scan-to-detail flow using existing app/design conventions. Include expected production, comparable recent rate/gap, outlook/opportunity change, volatility and evidence status; document stable sorting and unknown placement.
  - [ ] **5.2** Build process/conversion/opportunity details, conditional versus marginal presentation, upside/downside and evidence/source/cutoff disclosure. Show unavailable attribution and VuDu pending-adapter status rather than fabricated estimates.
  - [ ] **5.3** Add independent observation-window and 5/10/20 horizon controls, search/filters, shareable selection state and back/forward behavior. Choose recent-window defaults explicitly; never silently switch denominator or selected player.
  - [ ] **5.4** Verify keyboard/touch use, accessible chart/status labels, narrow layouts and loading/empty/error/stale/partial/unsupported states. Capture actual desktop/narrow fixture screenshots and obtain the product/design checkpoint.

- [ ] **6.0 Close the fixture milestone with an engineering receipt**  
  **Owner:** Lead plus independent reviewer. **Prerequisite:** 3.0–5.0 and market fixture view model. **Requirements:** FR-24, FR-25, FR-28.
  - [ ] **6.1** Run focused unit/contract/type/component checks and relevant existing-app integration checks. Run a build only when a build-specific behavior requires it under current AGENTS.md guidance. Verify all required invariants, supplied-value pass-through, both-page independence and optional-metadata degradation.
  - [ ] **6.2** Check the exact diff/protected hashes, fixture-only request behavior and absence of new dependencies, active-reader imports, secrets, schema/cron/nav changes or external requests. Record what ran, failed, was blocked or was not run.
  - [ ] **6.3** Deliver screenshots, contract/version, diff and acceptance receipt. Stop fixture work at reviewed mechanics; do not automatically proceed into live access, fitting, migrations or deployment.

- [ ] **7.0 Integrate compatible live FORGE records after feasibility approval**  
  **Owner:** Shared adapter lead with FORGE/source owners. **Prerequisite:** 6.3 review, scoped integration authorization and supported reader contracts. **Requirements:** FR-03–FR-14, FR-18, FR-19, FR-26.
  - [ ] **7.1** Verify current read-only source/reader contracts, allowed uses, category/class coverage, history availability, rights, cutoff fidelity and 5/10/20 schedule semantics. Record missing class references, role/scenario/uncertainty fields and canonical upstream owners; do not create a rival engine to fill them.
  - [ ] **7.2** Add one approved batched read-only adapter outside the pure core. Preserve identities, conditioning, source freshness and optional-field status; gate affected claims without hiding otherwise usable forecasts.
  - [ ] **7.3** Review immutable result/history/publication selection and any storage proposal before persistence work. Verify no mixed-model latest fallback, partial publication or silent legacy-row rewrite; define rollback.
  - [ ] **7.4** Trace one genuinely supported F, D and G case through source, adapter, interpretation and both pages for the declared metric/horizon scope. Report missing goalie or category coverage as incomplete acceptance; fixture success cannot close it.

- [ ] **8.0 Qualify scientific interpretation without consuming reserved data**  
  **Owner:** Evaluation owner; upstream model changes remain with FORGE. **Prerequisite:** authorized protocol preparation; empirical access only after applicable source/experiment clearance. **Requirements:** FR-16, FR-22, FR-27, FR-28.
  - [ ] **8.1** Review the FORGE exposure register and predeclare origin eligibility, targets, paired baselines, folds/purging, material effects, false-alert/coverage criteria and separate F/D/G analyses. Identify authorized data; no reserved block is opened by this list.
  - [ ] **8.2** Evaluate applicable interpretation/alert claims and reused-forecast calibration/coverage on identical eligible origins with temporal uncertainty and honest retrospective labels. Test selection/null effects; report negative and subgroup results. Keep feature/window/scale/threshold selection inside development.
  - [ ] **8.3** If a bounded display score is still useful, evaluate and freeze its sign/scale/config under the approved development protocol. No score-as-probability or universal threshold. Leave unsupported labels descriptive/unavailable; scope forecasting, continuation or duration changes separately upstream.

- [ ] **9.0 Verify the supported product scope and propose release**  
  **Owner:** Lead and product owner. **Prerequisite:** applicable live/evidence gates; market-page integration coordinated separately. **Requirements:** FR-02, FR-20–FR-23, FR-26–FR-28.
  - [ ] **9.1** Freeze released class/metric/horizon scope and remaining gaps. Complete independent semantic review, real traces, identity/parity checks, mobile/accessibility/error-state checks and task-based usability review against predefined criteria.
  - [ ] **9.2** Measure serving behavior and define scope-appropriate latency/error/coverage monitoring and rollback. Resolve exact route/navigation/legacy-alias treatment only after replacement acceptance and current ownership review.
  - [ ] **9.3** Deliver exact diff, test/evidence ledger, scientific limitations, unsupported scope and release proposal. Execute deployment or consequential persistence/navigation changes only within their separate authorization; verify post-change behavior if approved.

Parallel work: after 2.4, Sko UI, market UI/view models and independent shared-core mechanics can proceed in distinct files using the frozen fixtures. Protocol preparation in 8.1 can run independently; it grants no data access. Live adapters wait for 7.1 feasibility, while unsupported upstream features remain explicit dependencies. Task 9 closes only the declared accepted scope, not every optional future enhancement.
