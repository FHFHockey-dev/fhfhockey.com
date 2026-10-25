# FORGE Testing Grounds Product Requirements Document

Status: PRD APPROVED BY TJ on October 24, 2026 at 13:17:58 UTC. Task generation is authorized; implementation is not yet authorized.
Document date: October 24, 2026. Product owner and reviewer: TJ.
Destination: `/tasks/TASKS/prd-forge-testing-grounds.md` in the FHFH repository when approved for installation.
This is a cloud draft copy, not a file installed in TJ's Mac repository.
Next steps: review this PRD together, resolve decisions, approve the PRD, generate tasks, then create the Astra goal thread. Do not skip these gates.
The current approval authorizes this PRD and generation of its task list only. It does not authorize implementation, Astra goal dispatch, production access, data capture, paid calls, purchases, or deployment.

## Introduction/Overview

FORGE Testing Grounds is a private, owner-only workspace at `/forge/testing-grounds` for running and reviewing reproducible FORGE experiments.
TJ should be able to configure a supported model candidate, launch a remote experiment, see tangible work progress, and review results after the planned reveal.
The experiment must continue when TJ closes the browser or laptop. TJ must be able to reopen it or check work progress from a phone.
The first release is this complete configure-to-review workflow, not a read-only results viewer. A viewer may be an internal development milestone, but it is not the finished release.

The product separates two different questions:
- Expected-stat quality: how well FORGE predicts next-game stat counts and supported goalie outputs.
- Event-probability quality: how well supported probabilities predict specific player-game events.
An expected count is not a probability. A projection of 0.35 goals is a valid mean, not automatically a 35% chance of scoring.
Shot-level expected goals (xG) is a separate model problem and is not implied by either track or included in this first release.

Known stack context is FHFH with Next.js Pages Router, Vercel, and Supabase. The current repository has not been inspected for this PRD.
Implementation must verify existing code, schemas, authentication, model contracts, and infrastructure before choosing exact files or integrations.
No requirement below claims that a particular field, parameter, API, runner, or saved model already exists.

## Goals

- Let TJ complete one supported experiment end to end without editing code or keeping a local computer awake.
- Make long-running work understandable through honest completion counts, phase status, elapsed time, and reconnectable history.
- Surface data problems in the first release, with enough detail for TJ to investigate and repair the source deliberately.
- Compare a baseline and candidate fairly, on the same eligible observations, with visible coverage and uncertainty.
- Prevent future information, repeated test-set tuning, and reconstructed history from being presented as authentic out-of-time evidence.
- Preserve the exact settings, code identity, data version, chronology, and evaluation definition needed to explain or reproduce a result.
- Support guided changes to verified parameters now; leave formula development and optional AI proposals outside the first release.

## User Stories

- As TJ, I want a guided setup form so I can try supported settings without guessing what a parameter means or breaking the model.
- As TJ, I want to clone a candidate and see its changes so I know exactly what I am comparing with the baseline.
- As TJ, I want a preflight data report so missing, malformed, or mismatched inputs are not hidden inside a final score.
- As TJ, I want to start a remote run, close my laptop, and later check its work progress from my phone.
- As TJ, I want progress to mean completed work, not a changing prediction-quality score or a made-up percentage.
- As TJ, I want readable charts and sample sizes so I can understand expected-stat accuracy separately from event probabilities.
- As TJ, I want to inspect a prediction's input cutoff and provenance without accidentally exposing a sealed test result.
- As TJ, I want failed, skipped, and cancelled work explained so I can distinguish a model issue from a data or runner issue.
- As TJ, I want experiment history to stay unchanged so a later setting change cannot rewrite what an earlier experiment meant.

## Functional Requirements

### 1. Private access and navigation

1.1. Provide the owner-only `/forge/testing-grounds` page using the existing FHFH authentication approach after verifying it.
1.2. Enforce owner authorization on the server for every page request, API, background-job action, artifact, log, and export. Hiding a navigation link is not authorization.
1.3. Show a clear empty state with the steps: choose candidate, check data, configure experiment, launch, monitor, review.
1.4. Do not expose private league data in the repository, public assets, client bundles, URLs, or unrestricted logs.

### 2. Guided candidates and immutable versions

2.1. Supply guided controls from an implementation-verified registry of supported model parameters, allowed values, bounds, defaults, and short explanations.
2.2. Windows, decay, shrinkage, and feature groups are possible control categories, not promises that those settings exist today. Unsupported controls must not appear as working features.
2.3. Validate settings on the server as well as in the form. Reject unknown keys, invalid combinations, and values outside verified bounds.
2.4. Let TJ clone a candidate, name it, add notes, and see a human-readable difference from its parent and the selected baseline.
2.5. Treat a changed parameter or formula as a new candidate version. A scheduled refit using unchanged settings is a new fitted artifact, not a newly designed candidate.
2.6. Store candidate identity, parent identity, settings, code/version identity, and notes. A new formula remains separate code work, not a free-form dashboard command.
2.7. Freeze the launched run's settings, input manifest, evaluation rules, and candidate versions. Editing the form afterward creates a new draft or run, never changes an active run.

### 3. Experiment setup and chronology

3.1. Require explicit training start/end, evaluation dates, training-window policy, refit cadence, prediction cadence, and baseline/candidate selection.
3.2. Support a fixed-cutoff/frozen mode and a walk-forward mode. Show their feature-update policies before launch and save those policies with the run.
3.3. Fixed-cutoff/frozen mode must state whether both fitted parameters and features are frozen, or whether permitted features update using information known before each prediction. Do not infer the policy from the mode name.
For example, a model trained through December 31 can replay daily predictions with later as-of inputs and fixed fitted parameters, or make a true 10-day forecast from December 31 knowledge. Label these differently; an origin forecast cannot use later actual games, lineups, or outcomes as inputs.
3.4. Walk-forward mode may use only data available and settled before each prediction cutoff. Later games, revisions, and source knowledge must not enter earlier predictions.
3.5. Weekly refitting with daily predictions is a proposed default to review, not an established optimal schedule. TJ can select supported alternatives within approved resource limits.
3.6. Apply the same cutoff discipline to feature engineering, imputation, normalization, calibration, upstream models, lineup assumptions, and all other learned or derived inputs.
3.7. If parameters, model settings, or calibration methods are selected from data, use earlier, chronologically ordered inner training/validation periods. This does not require an automatic search feature in v1. Reserve a separate blind evaluation block with a predeclared reveal rule.
3.8. Never retune using a revealed test block and call another run on that same block an independent test. Label reuse clearly as development or retrospective analysis.
3.9. Preserve the Release C October 23-30 evaluation block and its existing rules as immutable. Do not use it for development tuning or alter its protected reveal process.
3.10. Show the training, refit, prediction, and evaluation timeline before launch, including gaps, excluded periods, and the latest permitted input time for each prediction batch.

### 4. Honest historical evidence

4.1. Record source observation time, source availability time when known, capture time, revision identity, and the prediction cutoff separately where supported.
4.2. Historical files collected after a prediction cutoff do not prove what was available at that cutoff. If original snapshots or reliable availability evidence are absent, label the run “reconstructed-history diagnostic.”
4.3. Never backdate knowledge, silently substitute a later snapshot, or describe reconstructed history as prospectively authentic.
4.4. Explain unavailable provenance and its affected dates/cohorts in setup and the final report. Reject claims that depend on authenticity the data cannot support.
4.5. Do not initiate new captures or scrape production sources under this PRD. New capture plans require TJ's approval, including scope, cost, and source constraints.

### 5. Data health in the first release

5.1. Run a preflight check before launch and repeat relevant checks during execution. Save both reports with the run.
5.2. Check missing/null values, malformed fields, duplicates, stale inputs, identity joins, units, strength-state mismatches, provenance, and source/table/field consistency.
5.3. Distinguish a valid observed zero from missing, unknown, not yet available, and unknown historical availability. Do not fill every missing value with zero.
5.4. For each issue, show severity, safe record identifiers, source/table/field, dates, expected versus observed values or shape, a sanitized sample, and the affected cohort/count.
5.5. Define blocking checks before launch. A blocker must stop the affected launch or phase with an explanation, not disappear through silent row exclusion.
5.6. Count and explain every approved exclusion. Show eligible, included, excluded, failed, and not-yet-observable observations separately so coverage remains auditable.
5.7. Provide manual repair guidance, copyable safe IDs, and, where an existing verified route supports it, a read-only navigation link to `/db/runner`. Never run a repair through a GET link or automatically edit source data.
5.8. After TJ repairs data, a recheck must create a new input/report version. Preserve the original failure report; a rerun receives a distinct immutable identity.
5.9. Research and checks must avoid unnecessary production load. Honor the existing NST minimum 21-second request spacing if that source is used; verify other source limits before access.

### 6. Remote launch and durable execution

6.1. Start runs through an authenticated, authorized POST with appropriate request validation and CSRF protections. Return a job ID promptly after durable acceptance.
6.2. Execute work in a durable background runner, not an open browser tab, a laptop process, or one long web request processing every job.
6.3. Persist run state, phase transitions, work counters, checkpoints, heartbeat, errors, and artifact references so refresh and reconnect recover the same run.
6.4. Make launch clicks and retries idempotent: the same accepted launch request must not create duplicate logical runs, work, or counted outputs.
6.5. Bound concurrency, resource use, runtime, retries, and storage according to an explicitly approved operating plan. Show a meaningful queued state when capacity is unavailable.
6.6. Recover interrupted work from safe checkpoints. Retries must not double-count units, silently change inputs, or overwrite newer state with a delayed old write.
6.7. Offer cancellation with a visible “cancellation requested” state, then stop safely at a supported checkpoint. Report already-completed work and any phase that cannot stop immediately.
6.8. A cancelled or superseded worker must not resume unnoticed or publish late artifacts as current results. Use a verified ownership/version mechanism to prevent stale writes.
6.9. Distinguish draft, preflight blocked, queued, running, cancellation requested, cancelled, failed, completed awaiting reveal, and completed revealed states.

### 7. Work progress without live performance

7.1. Progress means work completion only. Do not show live accuracy, scores, outcomes, result previews, or changing model-quality metrics while a run is in progress.
7.2. Show phase, completed units, total units when known, elapsed time, last heartbeat, and the most recent sanitized operational event.
7.3. For chronological historical processing, use games completed out of the declared eligible games in that stage. Explain the eligibility cutoff and any counted exclusions.
7.4. For prediction generation, use player-games completed out of eligible player-games. For evaluation, show completed evaluation tasks out of the declared task total.
7.5. Model fitting may be a batch operation with no meaningful internal percentage. In that case show “fitting,” elapsed time, and heartbeat, not an invented percentage.
7.6. Show successful, skipped, failed, and pending units separately. A processed unit is not automatically a successful prediction; future outcomes are pending, not failures.
7.7. Prefer stage-specific bars. Show an overall percentage only when its unit/denominator or stage weights are defined and visible; label any estimate and its limitations.
7.8. Persist counters server-side and restore them on desktop/mobile reconnect. A stalled heartbeat must be distinguishable from a failed or still-working phase.

### 8. Sealed outcomes and planned reveal

8.1. Save the evaluation cohort, permitted outcome availability rules, and explicit preregistered reveal condition before launch. All modes show work progress only until completion; a blind holdout stays sealed afterward until its approved reveal condition is met.
8.2. Enforce sealing in APIs, artifacts, logs, downloads, source inspection, and exports, not merely by hiding chart components.
8.3. Before reveal, show operational progress and data-health facts that do not leak outcomes. Redact or withhold outcome-bearing samples and diagnostics.
8.4. After all required work and outcome availability conditions are met, allow the authorized planned reveal and record when and under which rule it occurred.
8.5. If games have not settled or outcomes are unavailable, show pending evaluation with the reason. Do not assign fabricated outcomes, zero scores, or failure labels.

### 9. Expected-stat evaluation track

9.1. Support FORGE next-game skater targets: goals (G), assists (A), power-play points (PPP), shots on goal (SOG), hits (HIT), blocked shots (BLK), and penalty minutes (PIM).
9.2. Support applicable goalie targets: saves (SV), goals against (GA), wins (W), shutouts (SO), save percentage (SV%), and goals-against average (GAA), only where verified outputs exist.
9.3. Keep goalie start probability, participation probability, and playing-time/shot exposure separate from conditional performance. Label whether each prediction is unconditional, conditional on starting/playing, or exposure-based.
9.4. Define every rate's numerator, denominator, eligible exposure, and zero-denominator behavior. For example, aggregate SV% from saves/shots against and GAA from goals against/minutes with the proper time scale, not an average of unrelated game ratios.
9.5. Preserve fractional expected counts. Never round a mean into an event probability or present a count error as binary classification quality.
9.6. Report RMSE, mean signed error/bias, and a suitable mean score such as Poisson deviance for nonnegative targets and strictly positive predicted means. Using Poisson deviance to score a mean does not establish a Poisson outcome distribution. Define zero/invalid-mean handling explicitly rather than silently clipping away defects. Use MAE as an additional diagnostic, not the sole quality claim.
9.7. Use target-appropriate evaluation for rates, bounded quantities, and goalie outputs rather than forcing one count metric onto every output. Mark unsupported metrics with a reason.
9.8. Provide actual-versus-predicted scatter and bucketed mean-prediction versus mean-observation plots, with target units, sample size, reference line, and cohort labels.

### 10. Binary-event evaluation track

10.1. Support explicitly declared player-game events such as at least one goal, at least one assist, selected shots thresholds, a goalie win, and a goalie start.
10.2. Define the event, population, opportunity/participation rule, threshold, outcome source, and denominator before evaluation. Freeze shots thresholds before the blind block is used.
10.3. Display probabilities only from a validated count distribution or an explicit binary prediction head. Record the mapping/version and its validation; mark unsupported events instead of fabricating probabilities.
10.4. Report ROC-AUC, precision-recall curve/AUC with the exact summary convention, Brier score, log loss, and reliability plots where mathematically available.
10.5. Show event prevalence, positive/negative counts, sample size, and the prevalence reference for precision-recall interpretation. Declare any numerical clipping used for log loss.
10.6. When a cohort has only one outcome class, show ROC-AUC as unavailable with a reason, not zero or a misleading success. Mark other degenerate metrics according to their definitions.
10.7. Explain that AUC measures ranking, not percent correct, and does not require a 50% classification cutoff. Keep event calibration plots distinct from expected-count calibration plots. A good count mean does not prove good binary probabilities or a good shot-level xG model.

### 11. Fair comparison and result inspection

11.1. Compare baseline and candidate on the same paired eligible player-games and settled outcomes using identical metric/event definitions.
11.2. Show each model's total coverage and the paired-cohort coverage; explain missing predictions and exclusions so a smaller easy subset cannot masquerade as improvement.
11.3. Provide aggregate and useful supported slices by time, position, cold-start status, and other predeclared cohorts. Define “cold start” in the run specification.
11.4. Show uncertainty or interval estimates appropriate to the data dependence, with the method and limitations stated. Do not pretend repeated player-games are independent without justification.
11.5. Show baseline/candidate values and their paired differences. Do not invent an arbitrary quality floor or require an AUC improvement to accept the dashboard itself.
11.6. After permitted reveal, let TJ inspect a prediction's candidate/refit version, feature/input cutoff, source provenance, expected output, eligible outcome, and inclusion/exclusion reason.
11.7. Retain immutable experiment history with filters, notes, clone action, and compatible-run comparisons. Warn or block misleading comparisons of different cohorts, definitions, or history-authenticity classes.

### 12. Operational evidence and export

12.1. Provide a sanitized structured log drawer with timestamps, phase, event type, counters, and safe error details. It is not a shell, SQL executor, or arbitrary command interface.
12.2. Allow authorized JSON exports of permitted run configuration, data-health reports, operational evidence, and revealed results. Exports must obey the same owner and sealing rules.
12.3. Record audit events for launch, cancellation, retries, input/version changes, reveal, export, and relevant access. Redact secrets, tokens, private league data, and outcome-bearing sealed content.
12.4. Apply an approved bounded retention policy for logs, inputs, checkpoints, artifacts, and audit records. Do not promise indefinite storage or silently delete reproducibility evidence.

### 13. First-release acceptance checks

13.1. Unauthorized users and unauthenticated requests cannot read or change runs, artifacts, logs, or exports, including through direct URLs/API calls.
13.2. A bounded run continues after browser/laptop closure; desktop and phone reconnect show the same persisted state and eventually its terminal result.
13.3. Repeated launch clicks, retry requests, and interrupted workers produce one logical run and no duplicate accepted outputs or work counts. A retry may repeat computation; its results must be accepted only once. A checkpoint-resumed fixture matches uninterrupted logical results.
13.4. Good, bad, missing, duplicate, and valid-zero fixtures produce the expected health states, safe record details, and counted exclusions; owner repair creates a new version without erasing the original issue.
13.5. Chronology tests prove that future outcomes, later revisions, transforms, calibration, upstream fits, and protected Release C data cannot cross their allowed boundaries. Sealed content is absent from API/log/export responses.
13.6. Candidate cloning shows the exact settings difference; launched inputs/settings cannot be changed. Reconstructed-history runs remain visibly distinct from authentic snapshots.
13.7. Progress tests cover unknown-total fitting, successful/skipped/failed/pending units, stale heartbeat, cancellation, delayed writes, and future outcomes without fabricated percentages or results.
13.8. Hand-calculated examples verify count bias/RMSE, supported deviance, ratio aggregation, binary events, Brier/log loss, and probability mapping. One-class and no-outcome cases show correct unavailable/pending states.
13.9. Chart labels, baselines, units, sample sizes, cohort coverage, reliability plots, timelines, log drawer, and mobile layouts remain readable; reopening a completed run preserves its evidence.
13.10. Clearly marked synthetic fixtures may prove the workflow without real integration. Before claiming end-to-end real FORGE integration, complete a bounded actual pilot with separately approved data access and runtime/cost limits.

## Non-Goals

- No production model promotion, live lineup changes, production deployment, or automatic source-data repair from this dashboard.
- No shot-level xG model, arbitrary formula editor, unrestricted SQL/shell console, or promise that every possible stat/event is immediately supported.
- No live model-performance feed while work is running, and no early reveal of sealed outcomes.
- No automatic agent/model calls, self-directed parameter search, or automatic paid experiments in the first release.
- Optional AI proposals may be considered later only as a bounded cost/benefit trial with a separately approved budget, inputs, permissions, and stopping rule.
- No new source captures, infrastructure purchases, or assumption that existing hosting can run durable jobs without inspection and approval.

## Design Considerations

Use the established FHFH dark/cyan visual language after checking current components. Favor a tangible desktop experiment console with responsive phone monitoring.
Keep setup, timeline, data health, work progress, and revealed results visually distinct. Use plain labels and short explanations rather than unexplained statistical abbreviations.
The primary run view should show identity/settings summary, stage bars, completed/total counts, elapsed time, heartbeat, and a clear next action or blocker.
Revealed results should use separate expected-stat and binary-event chart tabs, with baseline overlays, axis units, sample sizes, and visible cohort filters.
Include the refit timeline, cutoff inspection, data-health panel, history/version comparison, and collapsible structured log drawer without crowding the mobile progress view.
Color cannot be the only status cue. Support keyboard navigation, readable contrast, explicit empty/error states, and touch-sized mobile controls.

## Technical Considerations

Repository discovery must precede implementation design. Verify Pages Router conventions, owner identity checks, Supabase access controls, existing FORGE contracts, data sources, and Release C protections.
Use a documented durable-job architecture compatible with the verified stack. Hosting/runner provider, queue, worker lease, checkpoint store, and cost are open prerequisites, not decisions made by this PRD.
Separate web request handling from execution. Persist enough versioned state for idempotency, safe cancellation, recovery, and stale-worker protection across processes or deployments.
Define validated contracts for candidates, experiment specifications, input manifests, work units, checkpoints, health issues, predictions, metric results, and sealed artifacts before coding their integrations.
Keep secrets server-side and out of URLs, logs, exports, and browser payloads. Check authorization and sealing at every data boundary, including stored-object access and background workers.
Use approved snapshots or bounded reads rather than repeatedly burdening production. Record reproducibility limitations rather than silently fetching later data to fill historical gaps.
The implementation plan must estimate run time, concurrency, storage, network/source use, and costs for the actual pilot and normal use; obtain approval for material new spend or access.

## Success Metrics

- TJ can configure, preflight, launch, leave, reconnect from a phone, and review one supported bounded experiment without terminal use.
- All acceptance checks in Section 13 pass with evidence, including browser-independent execution, recovery, correct metrics, sealing, and data health.
- Every displayed percentage has a known denominator or is an explicitly labeled estimate; every unsupported metric or probability has a visible reason.
- Every comparison identifies its paired cohort, coverage, model/input versions, cutoff policy, and history-authenticity class.
- The bounded actual pilot demonstrates real integration before that claim is made; synthetic-only success is labeled honestly.
- Model improvement is an experimental outcome, not a release gate. An unchanged or worse candidate can still be a valid and useful dashboard result.

## Open Questions

1. Which existing model outputs, distribution/binary heads, guided parameters, bounds, and baseline version can repository inspection verify for the initial supported set?
2. Which source snapshots and availability timestamps exist, and which historical periods must be labeled reconstructed-history diagnostics?
3. What exact Release C October 23-30 boundaries, existing reveal rules, protected artifacts, and access constraints must the implementation preserve?
4. Which durable runner/hosting arrangement is viable, and what explicit budget, concurrency, runtime, retry, storage, and retention limits will TJ approve?
5. What are the approved first-pilot dates, data sources, resource limits, outcome-settlement rules, and predeclared blind reveal condition?
6. Which goalie start/participation/exposure definitions, ratio denominators, eligible populations, and shots thresholds should be supported first?
7. Which default training window, refit/prediction schedule, feature-update policy, cold-start definition, uncertainty method, and comparison slices should be selected for the pilot?
8. Which verified owner-auth and existing read-only investigation routes should Testing Grounds reuse, and which data-health issues are launch blockers versus explicit exclusions?

Approval gate: TJ approved this PRD and authorized task generation on October 24, 2026. Review the generated task list together before creating any Astra goal thread. Resolve implementation prerequisites during planning, then obtain the required authorization before real data access, paid runtime, or deployment.
