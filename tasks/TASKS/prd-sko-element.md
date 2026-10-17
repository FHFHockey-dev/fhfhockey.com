# The Sko Element product requirements

**Owner:** TJ  
**Prepared:** October 15, 2026  
**Status:** Planning draft for review. No implementation, live data collection, model fitting or deployment performed.  
**Companion:** `tasks/tasks-prd-sko-element.md`  
**Related product:** `tasks/TASKS/prd-buy-low-sell-high.md`

## 1. Introduction/Overview

The Sko Element is a sustainability dashboard that helps a fantasy hockey manager understand what recent production says about the player's forward outlook. Its separate Forwards, Defense and VuDu goalie views show recent results, canonical FORGE expected production, the comparable sustainability gap, changes in opportunity, volatility and evidence quality. A player can be expected to cool from a hot run while still having a better outlook than before a promotion. A player can also be consistently poor. The product must preserve these distinctions.

The Sko Element and Buy Low/Sell High are two separate pages. They share a clean, versioned interpretation core over the same FORGE forecasts. The Sko Element owns production sustainability; Buy Low/Sell High adds league valuation, watchlists and manager-entered trade comparisons. The market page cannot change a scientific forecast to create an attractive recommendation. The Sko Element works without a market reference.

Changing opportunity is part of sustainability. A promotion can create a higher sustainable production baseline; whether that promotion persists, reverses or becomes volatile affects the forward distribution. The page must show both the production support and the fragility of the opportunity. Volatility is a first-class output, separate from expected quality and uncertainty about the estimated mean.

### Confirmed decisions and release boundary

- The default forward horizon is the next **10 scheduled team games**, with **5 and 20** selectable. A scheduled team game is not a guaranteed player appearance or goalie start.
- Forwards and defensemen have separate references, baselines, interpretation parameters and evaluation cohorts, especially for IPP. VuDu uses a distinct goalie contract within this page.
- Use a new sustainability/interpretation core with selective reuse of verified plumbing and small visual components. FORGE remains the forecast engine.
- RSO and FORGE work continue in parallel, with current core forecast/Start Chart work retaining priority and separate file ownership. The first later Sko implementation is add-only and fixture-fed within existing web conventions. Authorized, non-conflicting Sko work does not wait for a public release; live integration requires a compatible accepted reader contract and owner agreement.
- Buy Low/Sell High includes watchlists and manager-entered trades. An actionable market gap requires an actual, explicit reference; ownership, popularity and a hot/cold signal are insufficient.

The source audit covers a selective remote snapshot of `FHFHockey-dev/fhfhockey.com`, `octoberBranch`, commit [`a8f58de6178e282acd3a71851c66f4a56b119f14`](https://github.com/FHFHockey-dev/fhfhockey.com/commit/a8f58de6178e282acd3a71851c66f4a56b119f14). It does not verify newer local work, deployed behavior, database coverage or model accuracy. At that snapshot, `/skoCharts` is quarantined, the legacy sustainability score has conflicting interpretations, and no literal VuDu implementation was found. These are reasons to preserve lineage and review reuse, not claims that no later implementation exists.

This PRD incorporates the October 15 directional plan, repository inventory and clean-core comparison. The approved 10-team-game default supersedes the earlier illustrative five-appearance prototype horizon. Suggested formulas, display scales and thresholds remain proposals to evaluate; none is presented as validated.

## 2. Goals

1. Explain whether recent production is above or below a comparable player-specific expectation, while separately showing absolute expected production and outlook change.
2. Include opportunity level, persistence, reversal and switching risk in sustainability, with conditional and scenario-weighted canonical forecasts where supported.
3. Make F/D differences and goalie workload/stopping-quality differences meaningful in the calculation and explanation, not just in navigation.
4. Show observed variability, future outcome spread and mean-estimation uncertainty separately, without a blanket volatility haircut.
5. Let managers trace every conclusion to the exact evidence, FORGE forecast, cutoff, horizon and interpretation configuration used.
6. Supply a single read-only interpretation contract to both product pages, with honest missing, stale, conditional and unsupported states.
7. Demonstrate product mechanics safely, then qualify live interpretation and any predictive claims with leakage-safe evidence before release.

## 3. User Stories

- As a manager, I can distinguish a finishing heater from production supported by better shot process or a lasting PP promotion.
- As a manager, I can see how a temporary injury-replacement role changes the outlook if the teammate returns, without assuming the promotion is worthless.
- As a manager, I can distinguish a cold player with improving opportunity from a cold player who lost role or workload.
- As a manager comparing forwards and defensemen, I see IPP interpreted against the appropriate class and strength state.
- As a manager reviewing goalies, I can distinguish stopping quality, likely starts, workload, team support and downside risk.
- As a manager, I can inspect upside/downside and uncertainty beside the expected result, including when the same mean hides different risk profiles.
- As a manager, I can select 5, 10 or 20 scheduled team games and see exactly which games, assumptions and units the view covers.
- As TJ, I can verify that Sko and Buy Low/Sell High show the same frozen forecast and interpretation, while only the market page changes when a trade reference changes.
- As a developer, I can build the first prototype without changing active FORGE readers, ingestion, legacy routes or another owner's work.

## 4. Functional Requirements

### Product and shared contracts

**FR-01 — Priority and collision safety.** Continue RSO and FORGE work in parallel, prioritize active core-release work, and verify current checkout, dirty state and file ownership before implementation. Scope the first prototype to new, add-only modules and fixture-fed UI under existing web conventions, without taking over active release files. Independent non-conflicting fixture work may proceed when authorized; compatible live contracts and owner agreement gate integration. Planning completion does not authorize code changes, live access, fitting, migrations or deployment. Preserve newer and uncommitted work.

**FR-02 — Separate page ownership.** Compose The Sko Element as its own sustainability page with F, D and VuDu views. Keep Buy Low/Sell High as an independent page that consumes the shared output. Each owns layout, filters, sort, selected player and URL state. Missing market data or a market-page error must not prevent Sko from opening. Proposed final route `/sko-element` and legacy routing changes require later current-tree review.

**FR-03 — Scheduled-team-game horizons.** Default to next 10 scheduled team games and support 5/20. The contract must carry requested N, information cutoff, schedule snapshot/version, exact included game IDs, effective team association, timezone and actual start/end dates. Explicitly handle postponed/canceled games, season-end short horizons and a player's team change through canonical schedule identity/revision rules. Do not silently turn an unavailable N-game forecast into N appearances, N starts or a calendar week. If FORGE cannot supply the requested semantics, show the supported scope and block only the incompatible total or comparison.

**FR-04 — Immutable evidence envelope.** Represent `schemaVersion`, `evidenceSnapshotId`, content fingerprint, player ID, model class F/D/G, separately recorded fantasy eligibility, effective team/role history, season/game/strength scope, requested as-of time, observed source cutoffs and availability times. Counts must retain numerator, denominator, unit, exposure, eligibility and source lineage. Deduplicate on stable player/game/strength/source identity; report contradictory records rather than double-counting them.

**FR-05 — Canonical forecast identity.** Identify the FORGE run/model/configuration, issuance and information cutoff, target metrics, units, horizon, exposure and coverage needed for the displayed claim. Carry feature/calibration versions and richer scenario/reference metadata when supplied; otherwise retain an explicit absent, not-applicable or uncalibrated status. A missing optional field must not block a simple expected-minus-recent view whose required identity, units, scope and conditioning are established. Gate only dependent claims. The interpretation configuration has its own version/hash; it must not reuse the legacy sustainability identity. Both pages must expose the same forecast/evidence/horizon identifiers for the same comparison.

**FR-06 — Conditioning and single application.** Declare field-level conditioning and `opportunityTreatment = already_marginalized | conditional_only | not_modeled`, with included appearance/start/role factors and their owner. Already-marginalized means and probabilities pass through unchanged. Never multiply them again by appearance probability, start probability, role persistence, confidence or a volatility penalty. Conditional-only values stay labeled conditional. Unknown semantics block the dependent unconditional claim; this core requests a compatible upstream result rather than inventing one.

**FR-07 — Independent observation windows.** Describe recent form separately from the future horizon, including exact games/dates, strength state, appearances, team games, minutes or shots and selection rule. Keep recent-window controls independent from future N. A sustainability gap is eligible only when observed and expected quantities share target, unit, denominator and relevant scope. Appearance form may remain visible when a team-game gap is unavailable. A completed-team-game comparator includes confirmed nonappearances correctly; an absent data row is not proof of a zero-output nonappearance. Choose and document the initial recent-window defaults during product configuration.

### Evidence and class-specific interpretation

**FR-08 — Missingness, freshness and conflicts.** Preserve observed zero, unknown, insufficient exposure, unavailable, stale, conflicting and retrospectively reconstructed states. Reject invalid dates and nonpositive denominators. Do not use `Number(value) || 0`, silently substitute today, or infer freshness from a new fetch timestamp. Input-specific freshness and eligibility rules must be explicit, versioned and established for the intended claim. Show partial evidence and suppress only dependent results.

**FR-09 — Point-in-time fidelity.** Apply exact event and availability cutoffs. Later-published corrections, current-season final totals, future lineups/injuries, realized future shots or later-known roles cannot affect an earlier result. Effective time, publication/first-seen time, ingestion time and revision time are distinct. Where authentic historical availability is unknown, mark the reconstruction retrospective and exclude it from claims requiring authentic origin-time evidence.

**FR-10 — Separate F and D references.** Keep F/D prior/reference versions, exposures, parameters, calibration and evaluation cohorts separate. Consume approved upstream own-player expectations with class/role fallbacks and shrinkage provenance when history is sparse. Shared code may reuse mechanics without pooling scientific parameters. A rookie, role change or unsupported class reference retains uncertainty and fallback status. If needed references are missing, gate that comparison; do not train a second model here.

**FR-11 — IPP by class and strength state.** IPP numerator points and denominator on-ice team goals must cover identical games and strength states. Use an appropriate F/D and deployment reference, with PP and even-strength distinctions explicit. The same observed IPP must be able to produce different deviations for a forward and a defenseman. Missing, mismatched or zero denominators produce an unavailable diagnostic, not zero ability or an extreme regression claim.

**FR-12 — Process, conversion and context.** Separate observed production, chance/shot process, conversion/result residuals and opportunity in evidence and explanation. Candidate evidence includes SH%, on-ice SH%, IPP, PP conversion, attempts/chances/ixG rates, ES/PP time/share, deployment and availability. Preserve definitions and overlap; do not add correlated points, SH%, on-ice SH% and IPP residuals as independent votes. A residual is relative to a model and may include omitted context or bias. Do not label it proven luck or give a causal explanation unsupported by the evidence.

**FR-13 — Opportunity is inside sustainability.** Show current versus baseline opportunity, when a change began, attributable evidence and supplied continuation, reversal/recovery or switching trajectories. Present both the canonical forecast conditional on a stated retained role/workload and the canonical marginalized forecast when supplied. If a promotion depends on an absent teammate, expose the return/demotion scenario and the assumption behind it. Probabilities require a defined event, horizon, source and calibration/status; unknown probabilities stay unknown. Scenario labels may summarize mutually exclusive full trajectories only when definitions justify that treatment. No scenario weights or production distributions are fitted in this interpretation core.

**FR-14 — Volatility and uncertainty.** Distinguish (a) observed game-to-game variability over a stated sample, (b) the predictive spread of future outcomes, and (c) uncertainty about the estimated mean. Separate or attribute future opportunity uncertainty where the upstream contract supports it; do not claim components add independently when they are correlated. Show downside/upside quantiles, intervals or supplied scenarios with their level and meaning. Missing intervals are unavailable, not zero-width. Higher opportunity uncertainty may widen spread without lowering the mean. Stable low output, high quality and sustainability remain separate dimensions.

### Metrics and goalie semantics

**FR-15 — Directional sustainability gap.** Where comparable, compute native-unit `D = expected rate − recent observed rate`. Positive raw D means more of the statistic is expected; for lower-is-better metrics expose a separately named favorable-direction orientation. User-facing positive rebound/favorable and negative cooling/unfavorable signs must be consistent across table, chart, tooltip and export. Show recent value, expected value, gap and units together. Keep outlook change versus the player's prior expectation separate: expected cooling can coexist with an upgraded outlook. Zero gap does not establish low volatility or high certainty.

**FR-16 — Optional display score.** A bounded score may be evaluated after the native-unit view is usable. The research proposal `100 × tanh(D / s)` is an unvalidated display candidate; `s > 0` must be selected and frozen on development data for the target, horizon, class and comparison basis. A score is not a probability, quality rank or trade value. Do not inherit old sigmoid weights, squared-z stability multipliers, heuristic confidence penalties or fixed legacy thresholds. Omit a headline normalized score until its definition and evaluation are accepted; the natural-unit gap remains the primary supported output.

**FR-17 — Category and league views.** Consume supported FORGE categories rather than derive a new outcome model. Skater scope includes G, A, PPP, SOG, HIT, BLK and PIM when supported. A points view applies explicit league weights to compatible category means, including intentional PPP bonuses. Do not average arbitrary category sustainability scores or treat incomplete coverage as a full forecast. Category leagues retain a per-category view unless a declared utility has been separately specified. Aggregate intervals require appropriate supplied dependence information; do not sum quantiles or assume independence. Opportunity/ratio denominators remain inspectable.

**FR-18 — VuDu goalie view.** Provide a goalie-specific view within The Sko Element, using released canonical FORGE goalie outputs for stopping quality, starts/relief/no appearance, expected workload and team support, with conditional versus marginal semantics. Show supported SV, GA, W, SO, SV% and GAA plus supplied downside risk. Separate next-start quality from total N-team-game opportunity. No skater IPP or skater reference mapping applies. In the first fixture prototype, G types and a truthful unavailable/pending-adapter view are acceptable; live VuDu completeness requires an accepted goalie adapter and evidence and cannot be claimed from that placeholder.

**FR-19 — Goalie accounting and event universe.** Retain saves, on-net shots, guarded-net goals against and minutes as ratio primitives; handle empty-net/team events separately. Aggregate SV% and GAA from correct totals, and label a ratio-of-expected-totals summary separately from a distribution of realized ratios. Unblocked-attempt xG cannot be divided by official shots against as expected SV%. GSAx is model-relative, not pure skill or luck. Never sum overlapping recent/season/baseline shot counts as independent evidence. Preserve field-level start conditioning, including win/blowup probabilities that may already include start probability. Unsupported context standardization remains unavailable.

### Page behavior and explanations

**FR-20 — Sustainability scan.** Use a Trends-inspired hierarchy with separate F/D/VuDu views, search, recent-window and future-horizon controls, category/league selection where supported, and evidence/sample filters. The scan must show recent production, expected production, signed gap, outlook/role change, opportunity sustainability, volatility and evidence status without implying a market recommendation. Default ordering and tie/missing-value handling must be explicit and stable. A lower-quality row must not appear certain through color alone.

**FR-21 — Player detail.** Expand or navigate from a row to a detail view with process, conversion and opportunity panels; current versus baseline context; conditional versus marginalized expected output; upside/downside; source/cutoff/sample information; and explanation records linked to actual inputs or supplied computed changes. Identify unsupported attribution. Show how promotion persistence, return/demotion and role-switching cases differ. Stable poor play must not be styled as high quality. Use “Expected Production,” “Sustainability Gap,” “Rebound watch” and “Cooling watch”; avoid “True Production,” certain recovery claims and trade instructions without a reference.

**FR-22 — History and observed flag duration.** Chart dated observed and forecast series as distinct data types, with model/config transitions and unavailable segments visible. Show how long a condition has met a fixed, versioned trailing flag rule using actual eligible appearances/team games and dates. First detection must respect when the evidence was available. Do not backdate detection to a hindsight peak. A time-to-recovery or streak-duration forecast requires a separately scoped validated upstream model and is not an initial feature.

**FR-23 — Navigation, accessibility and resilience.** Preserve selected view/player/window/horizon in shareable URL state, with working deep links and back/forward behavior. Provide keyboard controls, accessible labels, visible focus, non-color status cues and narrow-screen layouts. Cover loading, empty, invalid selection, stale, partial, unsupported and failed-read states. A selected player must not silently change under filters or data refresh. Revisions update atomically or clearly remain on the prior complete snapshot.

### Delivery and qualification

**FR-24 — Clean-core reuse and market boundary.** The pure shared domain validates/normalizes immutable evidence, validates canonical forecasts and derives descriptive gaps, explanation records and page-neutral interpretation. It has no Supabase, HTTP, page component or legacy `s_100` dependency. Review existing identity, arithmetic, provenance, chart geometry and testing leaves for selective reuse; do not copy entire Trends/Sandbox pages or revive a quarantined pipeline. The market module consumes the frozen contract plus separate valuation/reference inputs. Watchlists, trade-entry state, prices and market observations cannot alter the shared scientific result.

**FR-25 — Fixture prototype.** Prove mechanics locally with deterministic synthetic bundles for all three N options, exact fictional schedules and unmistakable fixture labels. Cover durable promotion; temporary promotion/reversal; demotion/recovery; role switching; finishing heater with stable role; stable low production; matched F/D IPP; sparse/stale/conflicting evidence; and single-application goalie semantics. The goalie semantic fixtures may validate the contract while the page remains pending the released adapter. Controls switch supplied bundles; they do not fit probabilities or regenerate forecasts. No live reader, secret, account, database, external request, production navigation change or existing build/config change is allowed in this first slice. Use the existing app, UI dependencies and test runner rather than introducing a separate application/package/router.

**FR-26 — Live adapter and durable read contract.** After prototype review and separate authorization, verify actual source coverage, current ownership and the released reader contract, then add a read-only adapter to compatible FORGE/evidence inputs. Pin evidence, forecast, interpretation configuration, horizon and source availability as one immutable result. Any durable storage/publication design requires its own reviewed schema/identity, atomic selection, history and rollback plan; do not silently relabel or overwrite legacy sustainability rows. Reader gaps requiring new forecasting or opportunity modeling go to the canonical FORGE owner as separate work.

**FR-27 — Scientific qualification.** Before promoting predictive sustainability claims or calibrated labels, predeclare targets, origin eligibility, comparison rules, thresholds and acceptance criteria. Evaluate paired eligible origins chronologically, separate F/D/G, purge cross-fold labels and keep model/window/scale selection inside development. Review the FORGE exposure register and use only evaluation data explicitly cleared for this purpose; never reopen reserved FORGE data through this project. Compare against simple player/opportunity and shrinkage baselines, test false alerts and null selection effects, report coverage and subgroup uncertainty, and distinguish authentic as-of from retrospective evidence. Evaluate any lead/lag, onset/continuation or decision benefit separately; null findings may leave a feature descriptive. This task does not fit an alternate forecast engine.

**FR-28 — Verification and release receipt.** Maintain requirement-to-test/evidence traceability. Contract/unit tests, fixture/browser tests, live readback, empirical qualification and deployment are separate evidence classes. Before a later release, verify one real end-to-end trace for each supported class and metric scope, model/cutoff/horizon consistency across both pages, accessibility, responsive behavior, source health, error monitoring and a rollback path. Record passed, blocked and unrun checks truthfully. Route/navigation migration and legacy retirement occur only after replacement acceptance and an explicit release decision. Engineering completion alone does not establish forecast accuracy or VuDu readiness.

## 5. Non-Goals

- Rebuilding NHL/NST ingestion, creating a second forecasting engine, fitting role-persistence probabilities in the interpretation layer or changing current FORGE scientific outputs.
- Implementing either product, querying production, creating schemas, repairing historical rows, changing cron, deploying, or replacing legacy routes during this documentation task.
- Treating the first local fixture prototype as live NHL advice, empirical calibration or completion of the final goalie product.
- A universal luck index, guaranteed rebound, fixed streak expiry, universal metric stabilization count or causal proof from observational changes.
- Buy/sell/trade execution, league-account synchronization, betting or financial-return claims.
- Fabricated market prices, ownership-as-price, fake OHLC, or converting sustainability directly into market edge.
- Reopening reserved FORGE evaluation data, importing legacy heuristic weights as validated, or silently training around a missing upstream contract.

## 6. Design Considerations

Use Trends as visual inspiration for hierarchy, class/window controls and scan-to-detail flow. Recompose small presentational leaves under the new contract. Keep absolute expectation, directional gap, opportunity sustainability, volatility and evidence status visually distinct. A single composite badge must not hide these dimensions.

The first screen should answer: What has happened? What is expected next? What changed in role or process? How fragile is that outlook? Let managers drill into dates, denominators and reasons without requiring those details for the initial scan. Tooltips should define denominators and distinguish a prediction interval from mean uncertainty. All percentage deltas must say percentage points, percent change or fraction explicitly.

Show current-role and scenario-weighted forecasts side by side when compatible; label assumed and unsupported scenarios clearly. Use plain language for a promotion contingent on a teammate's absence. Interval charts can show risk without portraying wider intervals as automatically worse. Do not imply that a stable low forecast is a strong player.

Use separate observed, forecast and reference series. Gaps, missing intervals and model changes must remain visible. Fixture status stays visible on every prototype screen and screenshot. The final route name and navigation placement are integration decisions after current-tree reconciliation; neither the quarantined `/skoCharts` nor the retained `/buyLowSellHigh` is changed by the prototype.

## 7. Technical Considerations

### Shared interpretation contract owned by this PRD

The core's read-only output is conceptually `evidence + canonical FORGE forecast + interpretation config → interpretation record`. The record contains:

- Evidence and forecast identity from FR-04/05, exact horizon/game membership, model class and metric/exposure definitions.
- Observed recent form and eligible comparator; supplied own-player/class/strength reference with fallback provenance.
- Unmodified conditional/marginal canonical means and supplied quantiles/samples, with field-level conditioning and included opportunity factors.
- Descriptive process/conversion/opportunity deltas, signed native-unit gap when comparable, and outlook change kept separate.
- Dated opportunity state/trajectory summaries and supplied probability/status/attribution, without invented persistence estimates.
- Observed variability, predictive spread and mean uncertainty as distinct fields, each with method/sample/status or explicit unknown.
- Coverage/freshness/conflict diagnostics; explanation records tied to their source facts; measured flag history with rule identity.

Buy Low/Sell High consumes this contract and owns its additional scoring/replacement/market-reference/trade contract. Quote or trade edits must leave the shared record and its scientific identity unchanged. Both pages use one fixture adapter and, later, one approved read-only live adapter rather than independently joining source tables.

### Phased architecture and ownership

The proposed shared module namespace is `web/lib/skoElement/`, with fixture-fed components in a new Sko-specific component boundary using the existing app conventions. These paths are proposals, not existing files; finalize exact filenames and the local preview entry after inspecting the current tree. No separate application, package, router, dependency or build infrastructure is needed. Shared domain and fixtures are owned once; Sko and market composition owners work independently after the contract freezes. The lead alone edits shared contracts and any agreed integration boundary. Active `web/lib/projections/**`, `web/lib/sustainability/**`, current readers, global styles, package/lockfiles and migrations remain protected during fixture development; do not change production navigation or legacy routes.

The pinned snapshot supports inspecting identity/rate/provenance/geometry patterns, not importing server-connected modules into the pure core or fixture-only path. Nearby TypeScript tests use Vitest; actual runner/config commands must be verified in the current environment. Rate helpers and calendar validation need focused tests before extraction. The legacy usage delta mixes 0–100 percent vocabulary with other 0–1 definitions; the new contract must select one explicit unit per field.

Later integration may require durable append-only interpretation snapshots or immutable references to upstream snapshots. Decide storage, retention, exact publication key, authentication/visibility and rollback after source/reader feasibility. No database choice or estimated operational scale is asserted by this document. Live history must not select a convenient latest row across incompatible runs, cutoffs or configurations.

Any missing role forecasts, calibrated probabilities, category distributions, class references or N-team-game horizons are upstream dependencies. Track them as explicit owner-scoped gaps. Continue descriptive/fixture work where independent, while keeping unsupported live totals and claims unavailable.

## 8. Success Metrics

### Prototype acceptance

- Every deterministic contract/invariant test in the accepted matrix passes, including graceful absence of optional metadata: same-unit gating, F/D/strength IPP separation, zero versus unknown, exact as-of availability, duplicate/conflict handling and single application of opportunity/start probability.
- All supplied canonical values remain unchanged through normalization/view-model composition; changing only a market reference produces no change to the shared scientific record or Sko output.
- Required scenarios visibly explain the difference between durable promotion, temporary promotion, demotion/recovery, finishing regression and role switching. Higher spread alone does not reduce a canonical mean.
- Both pages open independently for 5/10/20 scheduled-team-game fixture horizons, maintain URL/navigation state and pass the agreed desktop/narrow-screen and keyboard/accessibility checks.
- Existing protected source hashes are unchanged and the prototype makes no live/external requests. The receipt clearly identifies the VuDu pending-adapter state and any unrun checks.

### Live interpretation and release acceptance

- Every released class/metric/horizon combination has an eligible real trace, reproducible identity and explicit unsupported coverage; no unknown values become zero or probabilities by presentation.
- Audit samples find no forecast identity/conditioning mismatch between the two pages, and no incompatible “latest” fallback. Measure coverage, missingness, freshness and failed-read rates by class and target rather than hiding them in one overall rate.
- Before predictive promotion, a frozen protocol specifies the minimum useful incremental effect and acceptable harm/false-alert/coverage criteria for the intended claim. Paired chronological evaluation reports uncertainty and subgroup results, including null/negative results. Numeric scientific cutoffs are not invented in this PRD.
- If probabilities/intervals are displayed as calibrated, independent evaluation supports their stated calibration/coverage for that target, class and horizon. Otherwise retain explicit uncalibrated/illustrative status.
- Before product release, task-based review confirms managers can correctly distinguish gap, expected quality, opportunity fragility and volatility in the required scenarios. Set the test population and pass criteria before that review; a polished chart or passing unit suite does not substitute for it.
- Define measured latency/error budgets and operational monitoring against actual served scope before release. No unsupported performance target or traffic estimate is claimed here.

## 9. Open Questions

These are later configuration, feasibility or evidence decisions. They do not reopen the approved two-page direction, F/D separation, opportunity/volatility scope, clean core or 10-team-game default.

1. Which current accepted FORGE reader versions support exact 5/10/20 scheduled-team-game forecasts, field-level conditioning, class references and opportunity scenarios? Who owns each missing input?
2. Which recent-window defaults and metrics should lead the first scan, and which same-basis comparator is genuinely supportable for each? Choose stable default sort and missing-value placement with them.
3. Which goalie metrics and start/relief/workload semantics are qualified for the first live VuDu slice? Which evidence gaps keep a field descriptive or unavailable?
4. Is a normalized display score useful after native-unit gaps are tested? If so, what development-only scale, target/class/horizon separation and acceptance protocol will govern it?
5. What explicit flag rules and material-difference thresholds should define measured duration? No learned setting may be selected using reserved evaluation data.
6. Which live source histories and rights support authentic point-in-time references, and which are only retrospective reconstructions?
7. What immutable read/history/storage contract, retention, publication/rollback mechanism and visibility are appropriate after feasibility review?
8. Which final route/navigation and legacy-alias migration fit the reconciled current tree? The product name is The Sko Element; an expansion of SKO is optional and must not delay the contract.
9. What frozen empirical qualification, usability and operational acceptance criteria are appropriate for each released scope? Decisions to expand forecasting belong to the canonical owner, with separate authorization and evidence.
