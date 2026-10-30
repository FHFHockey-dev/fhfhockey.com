# PRD: FORGE v2 individual skater game forecasts

**Status:** Complete PRD for approval, incorporating the three requested clarifications. Product direction is approved; this document is the proposed specification. No files or application code have been changed.

**Intended file:** `/Users/tim/Code/fhfhockey.com/tasks/TASKS/prd-forge-v2-skater-game-forecasts.md`

## 1. Introduction and overview

FORGE v2 forecasts each individual skater’s performance in their NHL team’s **next ten scheduled regular-season games**. Each game receives its own projection, participation assessment, calibrated uncertainty, and immutable revision history.

H1–H10 identify team-scheduled-game ordinals. They do not mean calendar days, actual player appearances, cumulative totals, team projections, or final game scores. A target game retains its identity as its ordinal changes.

The public product lets users inspect current forecasts, understand revisions, apply their scoring settings, and compare the final eligible pregame forecast with the eventual result. Revision-history shading and statistical outcome uncertainty remain visually and semantically separate.

V2 develops alongside FORGE v1, private Player Forecasts, and RSO. Existing systems retain their behavior, ownership, and operating capacity.

### Approved product decisions

| Area | Decision |
|---|---|
| Audience | Public forecasts, revision history, and accountability after qualification and separately approved release |
| Players | Identified NHL-roster skaters, including affiliated injury/reserve players; call-ups enter when affiliation is verified |
| Games | Next ten scheduled regular-season games; fewer when the supported schedule ends |
| Categories | G, A, PPP, SOG, HIT, BLK, PIM |
| Headline forecast | Expected performance conditional on an official appearance |
| Participation | Separate official-appearance probability, conditional on the game occurring |
| Default scoring | G 3; A 2; PPP 1; SOG 0.2; HIT 0.2; BLK 0.25; PIM 0 |
| Custom scoring | Manually edited linear category weights, including positive, zero, and negative values |
| Prediction intervals | Central 50% and 90% intervals for supported categories and scoring profiles |
| Refresh | Daily by 8 a.m. America/New_York; material updates within 15 minutes of accepted evidence; pregame refresh attempt at T−30 minutes |
| Final cutoff | Accepted scheduled-start lock, with earlier-actual-start safeguards |
| Revision display | All comparable issued pregame revisions; 25% opacity per traversed numeric span |
| Layout | Ten-game overview with selected-game timeline, revision table, and separate uncertainty panel |
| Historical custom scoring | Explicitly labeled re-scoring of preserved forecasts; original records and grades remain unchanged |
| Public participation estimates | Qualified probabilities only; otherwise verified status and unavailable probability |
| Release quality | Credible improvement over matched last-five and season-rate baselines, alongside calibration and reliability |
| RSO integration | Disabled-by-default adapter; qualified availability-adjusted values only; RSO-owner acceptance and separate rollout approval |

### Two readiness states

**Qualified public subset:** A declared contiguous H1–Hk range supports qualified default fantasy points, every nonzero-weight contributing category, participation, and both interval levels. Other horizons and categories remain explicitly unavailable.

Fantasy-point uncertainty requires a coherent joint predictive distribution covering **every nonzero-weight category in the selected profile**. An unavailable zero-weight category does not block that profile.

**Full v2:** All seven categories and H1–H10 qualify, together with participation and default plus supported custom-scoring uncertainty.

A subset release does not complete the full-v2 requirements.

## 2. Goals

1. Produce ten distinct player/game projections wherever the verified schedule supports ten.
2. Preserve every issued vintage, its evidence, and the artifacts needed to reproduce its uncertainty throughout the offered history.
3. Distinguish performance conditional on appearing from participation risk.
4. Show current values, revision history, historical extrema, locked-final forecasts, and actual results without conflating their meanings.
5. Provide empirically qualified 50% and 90% outcome intervals.
6. Demonstrate improvement over matched baselines without hiding missing forecasts, unsupported cohorts, or failed experiments.
7. Support a qualified public subset while keeping full-v2 completion explicit.
8. Prepare a testable RSO adapter without changing live RSO behavior.

## 3. User stories and workflows

- **Inspect upcoming games:** A fantasy manager finds a skater and views ten individually contextualized game forecasts, participation, freshness, and qualification status.
- **Understand a revision:** The manager selects a game and sees when forecasts changed, the recorded triggers, historical high/low, and overlapping revision shading.
- **Interpret uncertainty:** The manager sees separately labeled 50% and 90% outcome intervals for a specifically identified vintage.
- **Apply league scoring:** The manager edits category weights and sees consistently re-scored forecasts, outcomes, and baselines. Unsupported uncertainty remains unavailable.
- **Review a completed game:** The manager compares the labeled locked-final forecast with the official actual result and sees any subsequent result corrections.
- **Inspect accountability:** A user reviews baseline comparisons, calibration, participation performance, coverage, and missingness by horizon and period.
- **Investigate unavailable data:** The user can distinguish an unsupported model, missing input, stale source, unresolved affiliation, postponed game, ambiguous appearance, and missing artifact.
- **Prepare integration:** The RSO owner evaluates a disabled adapter and its evidence package while v1 continues serving.

## 4. Functional requirements

### Population, identity, and schedule

**FR-01 — Independent opportunity population**

Capture eligible players and target-game opportunities independently of forecast success. Include identified injury/reserve players with verified NHL affiliation.

Keep known player/game records when performance, participation, or uncertainty is unavailable. Do not replace unavailable values with zero.

Unresolved player identities or affiliations appear in coverage reporting. Do not invent canonical IDs or games to fill the queue.

**FR-02 — Stable identity**

Use canonical NHL player, team, season, and game IDs, with versioned mappings to repository identities.

Names, dates, abbreviations, affiliations, and horizon ordinals are attributes. A forecast series is anchored to player/game identity and a comparable target definition, conditioning, and scoring context.

Record team and opponent as known at issuance.

**FR-03 — Ten distinct game scopes**

Retrieve enough schedule evidence to reach the tenth eligible game, including long breaks. A fixed calendar window is insufficient.

Store the ordinal at issuance and calculate the current ordinal separately. Do not multiply one forecast by a horizon scalar and present the result as ten individual forecasts.

Show fewer than ten games when the verified schedule supports fewer, with the reason disclosed.

**FR-04 — Schedule lifecycle**

- Retain same-ID history through postponements and start-time changes.
- Remove cancelled games from the active queue and retain their history as void.
- Show postponed games without a trustworthy new start separately from the active queue.
- Permit ordinal movement in either direction without changing game identity.
- Once play begins, suspension or resumption does not reopen pregame forecasting.
- If the authoritative source replaces a game ID, preserve the original history and a verified replacement link. Do not move old forecast records into the new game.

**FR-05 — Affiliation changes**

Version affiliations using both effective time and the time the system learned the change.

A verified trade ends new issuance for former-team opportunities and opens the new team’s next-ten scope. Preserve former-team forecasts and their original participation assessments.

A trade must not erase accountability or turn nonappearance into a zero-performance appearance. If the player changes sides within the same game ID, retain one player/game history with an explicit team-change marker.

### Forecasts, participation, and scoring

**FR-06 — Conditional category means**

Forecast G, A, PPP, SOG, HIT, BLK, and PIM individually, conditional on an official appearance in a game that occurs.

Use qualified target-game context, including opponent, home/away, rest, and available role information. Record unknown components and their reasons.

A structurally complete record may contain explicitly unavailable components.

**FR-07 — Official appearance**

Distinguish:

1. Verified official appearance, including legitimate credited zero-minute or penalty-only appearances.
2. Dressed but unused.
3. Verified nonappearance.
4. Ambiguous or incomplete appearance evidence.
5. Game not played.

Validate the chosen official source against these states. Positive ice time alone does not establish the full appearance definition. Ambiguous cases remain unavailable for affected grading.

**FR-08 — Participation and expected contribution**

Estimate appearance probability separately and assess it against the independently recorded opportunity population.

Public probabilities require qualification for the relevant event definition, horizon, and cohort. Otherwise show verified availability facts and “probability unavailable.”

An availability-adjusted mean is:

`qualified appearance probability × qualified if-playing mean`

The inputs must match player, game, conditioning, cutoff, and compatible evidence. Unknown participation is neither zero nor one.

Withhold the adjusted value and RSO use when either input is unqualified.

**FR-09 — Versioned scoring**

A scoring profile contains the seven category weights, scoring-rule version, and deterministic content identity.

Validate finite weights and computed results. Equivalent weight maps receive the same identity.

A fantasy-point mean requires qualified means for every nonzero-weight category. Fantasy-point uncertainty additionally requires a qualified coherent joint predictive distribution over all those categories and applicable profile-specific validation.

An unavailable zero-weight category does not block the profile. For example, unavailable PIM does not block the default profile, but blocks a custom profile that assigns PIM a nonzero weight.

Do not treat calibrated marginal category intervals as proof of calibrated fantasy-point uncertainty.

**FR-10 — Historical re-scoring**

Apply selected weights consistently to preserved category forecasts, outcomes, and baselines. Label resulting values **“re-scored under selected profile.”**

Preserve original issued bytes, clocks, scoring identity, and grades. Selecting weights after a game does not create an earlier fantasy-point issuance.

Re-scored uncertainty must use the preserved distribution and applicable calibration evidence associated with that vintage. A later model or calibrator cannot be substituted and described as as-issued uncertainty.

### Immutable records, clocks, and artifacts

**FR-11 — Immutable forecast vintages**

Every successful issuance has a unique immutable identity and includes:

- canonical player/game identity;
- as-issued team, opponent, schedule revision, and affiliation revision;
- horizon ordinal and schedule episode;
- category means and availability states;
- participation definition, probability/status, and evidence;
- predictive-distribution and calibration artifact references;
- default scoring identity;
- model, feature, code, and target-definition versions;
- source manifest and content hashes;
- trigger, predecessor references, and evidence class;
- publication evidence.

Retries of one logical issuance return the existing result. New daily or material issuances create new vintages, including when numeric values remain unchanged.

**FR-12 — Separate clocks**

Preserve source observation, source publication where known, first receipt, input cutoff/as-of, generation, publication confirmation, target scheduled start, and authoritative actual start.

Store instants in UTC. Use America/New_York for daily scheduling, including daylight-saving behavior. Preserve the source game date separately.

Evidence must have been available to the system by the input cutoff. A historical event date or provider timestamp alone does not prove historical availability.

**FR-13 — Publication proof**

Use an idempotent publication barrier for complete, hash-bound output records.

Retain trustworthy evidence that the exact committed output was available before the applicable deadline. Run-finished metadata, timestamps generated inside an uncommitted transaction, and current mutable-row contents are insufficient alone.

Test delayed commits, failed acknowledgements, duplicate requests, concurrency, and publication crossing the lock.

**FR-14 — Failures and corrections**

Keep failed attempts, unavailable-state events, retractions, and corrections separate from immutable issued values.

A poor forecast remains accountable. Withdrawal must not silently remove an inconvenient result.

Technical-invalidity corrections require explicit evidence and append-only evaluation changes. Preserve original and corrected dispositions.

**FR-25 — Reproducible distribution and calibration artifacts**

Pin every predictive-distribution and calibration artifact by:

- immutable artifact ID and version;
- cryptographic content hash;
- representation/schema version;
- applicable target set, conditioning, horizon/cohort, and scoring support;
- required calculation/decoder versions and deterministic parameters.

Retain the representation needed to reproduce stored as-issued intervals and supported re-scored intervals. Depending on the qualified representation, this includes the necessary joint outcomes or distribution parameters, dependence representation, calibration parameters, deterministic seeds, numerical conventions, and calculation versions.

A model name, moving storage URL, or seed without its required algorithm and inputs is insufficient.

**History promise:** Preserve the complete captured v2 issuance history without automatic expiry under this PRD. Retain its required artifacts for the same period. Archiving is permitted; silent deletion or replacement is not.

Archived artifacts must remain discoverable by immutable identity and retrievable with hash verification. Show retrieval/restoration status when necessary.

If an artifact is missing, altered, undecodable, or inaccessible:

- preserve the forecast record and known historical values;
- mark affected uncertainty reproduction unavailable;
- withhold newly derived intervals and affected qualification claims;
- record an integrity incident;
- never substitute a current model or calibrator.

Prove that archived and online copies reproduce the same as-issued and supported re-scored uncertainty. Record the numerical equality/tolerance convention with the immutable calculation version.

### Refresh and freshness

**FR-15 — Daily and pregame issuance**

Target daily publication by 8 a.m. Eastern for eligible scopes. Attempt a refresh 30 minutes before each accepted scheduled start.

Record missed deadlines and attempts honestly. Do not backdate issuance.

If required inputs are late, preserve the previous valid vintage as stale/history and expose the current limitation.

**FR-16 — Material updates**

Accepted material changes include:

- schedule, start, status, or opponent;
- affiliation, recall, assignment, injury, availability, or scratch;
- relevant lineup or role;
- completed-game inputs and accepted corrections;
- explicitly promoted model or calibration versions.

Deduplicate semantically identical events. Coalesce unissued work for up to five minutes where deadlines permit. Preserve events received during processing for a follow-up refresh.

Target publication within 15 minutes of accepted evidence receipt. This does not promise acquisition of news before existing ingestion observes it.

**FR-17 — Bounded isolated operation**

Reuse shared ingested inputs; do not introduce per-player external fetches.

Use affected-scope queues, idempotent work, bounded batches, resumable processing, and separate admission controls. Do not consume capacity reserved for v1/RSO.

Capacity shortfalls produce visible delays or blocked activation. They do not authorize new spend, provider traffic, schedules, or infrastructure.

### History and visualization

**FR-18 — Complete comparable history**

Provide stable cursor pagination through all revisions without a silent row cap. Order using publication confirmation and stable issuance sequence.

Mark comparable model changes within the same series. Separate incompatible target definitions, units, or conditioning.

For re-scored history, apply one selected profile consistently across the displayed series.

**FR-19 — Overlapping revision opacity**

Paint the span between each successive pair of eligible numeric pregame revisions at 25% opacity. For `n` traversals:

`opacity = 1 − 0.75ⁿ`

Rules:

- The first numeric revision is a marker.
- Equal adjacent values add no painted range.
- Explicit unavailable states and declared missing-refresh gaps break the path.
- Do not paint across an unknown gap.
- Daily and material revisions both count.
- Post-lock or otherwise ineligible records remain in the audit history but outside the default pregame overlap.
- High/low are extrema of numeric revisions in the displayed comparable series, including isolated values around gaps.
- Show revision count, timing, filters, and model/team changes.
- Do not time-weight, normalize by revision count, or interpret shading as probability.

**Worked example:** The same game moves H10→H9→H8→H7 while its forecast changes `10 → 5 → 8 → 6.5`.

| Range | Traversals | Resulting opacity |
|---|---:|---:|
| 8–10 | 1 | 25% |
| 5–6.5 | 2 | 43.75% |
| 6.5–8 | 3 | 57.8125% |

Current value is 6.5; historical low is 5; historical high is 10. Endpoints have no area. An additional unchanged 6.5 increases the revision count without adding shading.

**FR-20 — Distinct forecast and outcome marks**

The visualization must separately identify:

| Element | Meaning |
|---|---|
| Latest revision marker | Latest revision within the stated history filter |
| Historical high/low | Extrema of that comparable revision history |
| Overlap shading | Ranges traversed by successive forecast revisions |
| **Locked-final line or marker** | Specifically selected final eligible pregame forecast |
| **Actual-result marker** | Matched official outcome in postgame detail |
| 50% and 90% intervals | Outcome uncertainty from an explicitly identified vintage |

Before the lock, label the final forecast as pending. After selection, bind its mark to the selected vintage ID and lock timestamp; show provisional timing status when applicable.

When latest and locked-final values coincide, retain both labels. Do not imply they are always identical.

Postgame detail shows the actual result and its provisional/final/corrected status. Nonappearance, ambiguity, and cancellation use their explicit states rather than an ordinary zero-result marker.

Keep prediction intervals in a separate labeled panel. Default to the latest eligible vintage before lock and the locked-final vintage after lock. Selecting another revision must clearly change the interval’s vintage label.

### Accountability and RSO

**FR-21 — Final eligible pregame selection**

Select the latest eligible, proven publication strictly before the accepted scheduled-start lock, with deterministic tie-breaking.

An authoritative reschedule received before the existing lock can change that lock. Delayed puck drop alone cannot extend it.

A late postponement notice cannot retroactively legitimize late forecasts. Reopening requires affirmative authoritative evidence that play never began and a new scheduled start. Append a new schedule/lock epoch prospectively.

Exclude forecasts issued after an earlier actual start. Unknown timing remains provisional. Timing corrections append selection and evaluation revisions without altering issued forecasts.

**FR-22 — Outcomes and grading**

Match by canonical player and game IDs, using the same target definitions and scoring profile.

Grade conditional performance only for verified official appearances with sufficiently complete outcomes. Keep dressed-unused, nonappearance, ambiguity, cancellation, and unsettled outcomes separate.

Evaluate participation independently. Cancellation is not a participation failure.

Append provisional, final, and corrected outcome/evaluation records. Retain original grades and disclose corrections.

**FR-23 — Public accountability**

Report:

- requested opportunities, forecast coverage, outcome coverage, and abstentions;
- MAE, RMSE, signed bias, and paired baseline comparisons;
- 50%/90% coverage, interval width, and proper interval scores;
- participation reliability and probability scores;
- horizon, model, period, and supported-cohort results;
- missing horizons, unresolved outcomes, integrity failures, and corrections.

Keep retrospective reconstruction, prospective shadow, and public-serving evidence separate.

**FR-24 — Separate RSO display accountability**

V2’s stored final-pregame forecast grade is distinct from the grade of what RSO displayed.

A bridge snapshot is not proof of actual exposure. Display accountability requires a receipt binding displayed/served values to forecast identities, scoring, consumer version, and exposure time.

Build a disabled adapter that accepts qualified availability-adjusted inputs and propagates explicit unavailable states. Preserve RSO ownership and require separate acceptance and rollout approval.

**FR-26 — H1–H10 evaluation-vintage selection**

Use the following primary rule, fixed before evaluating results:

1. Track each player/game’s horizon from contemporaneously accepted schedule and affiliation observations. A **horizon episode** is a continuous observed period in which that target has ordinal H.
2. For each player/game/H, use the **first eligible successfully published vintage in its first observed episode at that horizon**, whether triggered by the daily schedule or a material event.
3. Select the vintage independently of prediction values, eventual outcomes, or category completeness. Use its same ID across category and scoring evaluations. An unavailable component stays missing at that checkpoint; do not substitute a later revision for that component.
4. Deduplicate retries. Resolve timestamp ties using the stable issuance sequence and vintage ID.
5. If no eligible vintage was published during that first episode, record that horizon as missing. Do not fill it from an adjacent horizon, a later episode, a calendar-day proxy, or a reconstruction.
6. If a game leaves and later re-enters a previously observed horizon after a reschedule, preserve the original primary selection or missing disposition. Later episodes remain available for separately labeled diagnostics.
7. Keep the as-issued ordinal and schedule revision. Do not relabel old vintages using the final schedule.
8. If an original selection is later shown to be technically ineligible, append the correction and report the exclusion; do not silently choose a more favorable replacement.
9. Evaluate baselines at the same selected cutoff and on matched targets, scoring, conditioning, and outcomes.
10. Count at most one primary observation per player/game/H/target/profile within an evidence class. Model-version filtering stratifies selected observations; it does not trigger reselection.

Report elapsed time to the target start alongside ordinal, plus reschedule and missing-horizon flags. A game may contribute to several horizons, so dependence-aware evaluation must keep its observations together.

The locked-final pregame benchmark is a **separate series**. It is not synonymous with the primary H1 checkpoint.

## 5. Non-goals

- Goalies, team totals, final game scores, preseason, or playoffs.
- Ten calendar days or ten actual player appearances.
- Rest-of-season forecasts or correlated ten-game aggregate totals.
- +/−, FOW, GWG, SHP, or other unqualified categories.
- Automatic league imports, bonuses, or nonlinear scoring.
- Replacement of v1 or changes to current RSO scoring.
- Broad rewrites of private Player Forecasts or existing ingestion.
- Opening protected research data without its owner’s authorization.
- Application implementation, production migrations, jobs, deployment, commits, or pushes under this planning assignment.

## 6. Design considerations

Use a ten-game overview with readable current values, extrema, and revision shading. A selected game opens its complete timeline, revision table, trigger explanations, artifact/qualification status, locked-final mark, actual result, and separate uncertainty panel.

On mobile, allow horizontal scrolling or a compact game selector. Do not compress ten columns into unreadable text.

Provide keyboard access, visible focus, non-color distinctions, accessible table equivalents, explicit units, and clear conditional-versus-adjusted labels. Important values must not depend on hovering.

Archived history must remain navigable. If uncertainty artifacts require retrieval, show that state without replacing history with newly generated values.

## 7. Technical considerations, research, and ownership

### Repository findings and reuse boundaries

Read-only inspection identified:

- A next-ten schedule builder in `web/lib/player-forecasts/schedule.ts`.
- Immutable-output concepts in the private forecast foundation migration.
- Revision/extrema logic in `web/lib/player-forecasts/accountability.ts`.
- A dashboard reader with a 3,000-output cap and current-start joins that are unsuitable for complete as-issued history.
- A research-only `gameContract.ts` distinguishing dressing, positive minutes, and statistical credit, including PIM.
- A participation baseline explicitly labeled uncalibrated and based on positive minutes.
- A FORGE multi-game path that scales an aggregate rather than producing ten independently contextualized target-game forecasts.
- An upsert-based served ledger that cannot serve as v2’s immutable history.

These are code findings, not proof of deployment, production correctness, calibrated distributions, or complete live coverage. Relevant tests exist, but application tests were not run for this planning work.

The latest read-only checkout check found `octoberBranch` at `bee3ad1a5adf3f40c4dab7728feb99eff9079d9d`. Other agents are active. A later implementer must recheck current leases, handoffs, and diffs.

### Implementation boundaries

- Isolate new logic under `web/lib/forge-v2/`, presentation under `web/components/ForgeV2/`, pages under `/forge/v2`, and read APIs under `/api/v2/forge`.
- Use separate `forge_v2_*` storage and private artifact storage. Do not reuse shared writable tables without an explicit isolation and ownership review.
- Keep model fitting, feature computation, calibration, and statistical aggregation outside Supabase.
- Public interfaces cover next-ten forecasts, player/game history, scoring-profile evaluation, accountability, and qualification/methodology metadata.
- Public requests read prepared forecasts and bounded derived results; they do not launch inference, acquisition, training, or production jobs.
- Public responses expose approved forecast data and provenance summaries, not credentials, private research artifacts, raw restricted sources, or account information.
- Reuse compatible stable pure helpers. Shared-file changes require exact file ownership and owner coordination.
- Preserve FORGE, RSO, ingestion, research, migration, and resource reservations. Idle status does not transfer ownership.

### Research and validation requirements

**RV-01 — Source and historical-evidence audit**

Inventory original source captures, receipt/publication clocks, schedule and affiliation histories, appearance labels, PIM completeness, outcomes, rights for intended use, and prior evaluation exposure.

Do not assume historical as-of data exists. Reconstructed forecasts retain real reconstruction timestamps and a distinct evidence class.

**RV-02 — Frozen experiment protocol**

Before final evaluation, register and independently review:

- exact admissible datasets and temporal allocations;
- training, development, calibration, and untouched final periods;
- candidate recipes, tuning budget, selection objective, and stopping rule;
- baseline definitions and matched cohorts;
- minimum support and numerical calibration/coverage tolerances;
- per-stat/horizon regression limits;
- dependence-aware uncertainty methods;
- release scope and missingness limits;
- FR-26 selection and reschedule handling.

Numerical research thresholds must be justified from discovery/development evidence and frozen before final results. Their specification is an evidence-gated research deliverable, not a request for the owner to declare calibration.

**RV-03 — Baselines and mean accuracy**

Use last-five verified official appearances and an expanding season-rate baseline, each restricted to eligible pre-cutoff information.

Preserve baseline missingness for sparse players. Report both paired comparison coverage and the requested population.

Select expected means using squared-error objectives rather than MAE alone. Public release requires credible default-FP MSE improvement over both baselines with predeclared regression safeguards.

**RV-04 — Joint distributions and calibration**

For a qualified subset or scoring profile, the coherent joint predictive distribution must cover every nonzero-weight contributing category. Full v2 requires all seven categories.

Preserve dependencies and logical constraints, including PPP being part of G+A. Derive fantasy-point distributions by applying weights to joint outcomes, not by summing marginal quantiles.

Validate both interval levels by supported target, horizon, cohort, and scoring profile. Handle discrete outcomes explicitly. Assess coverage, width, and proper interval scores so excessively wide bands cannot pass on coverage alone. [Interval-score methodology](https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1008618).

**RV-05 — Chronology, repeated vintages, and dependence**

Keep revisions of the same target game together across temporal partitions and uncertainty calculations. Account for shared player, game, slate, and time dependence.

Do not assume independent-sample or exchangeability guarantees automatically apply to these forecasts. [Time-series predictive-inference research](https://proceedings.mlr.press/v313/barber26a.html).

**RV-06 — Qualification and fallback**

Maintain an immutable, versioned qualification manifest identifying target set, horizons, cohorts, conditioning, scoring support, artifacts, and evidence class.

Public participation percentages and adjusted values require qualification. Unsupported custom profiles may show labeled re-scored means when their components qualify, but no claimed calibrated intervals.

Declare the proposed release subset before final qualification assessment. Preserve failed evaluations and unsupported scope. Do not select flattering slices after viewing final results.

**RV-07 — Artifact reproducibility**

Before promotion, reproduce as-issued and supported re-scored intervals from the pinned artifact representations alone, including after archive retrieval.

Verify hashes, decoder/calculation versions, category support, calibration applicability, and deterministic numerical behavior. A missing or mismatched required artifact blocks the affected qualification.

## 8. Success metrics, acceptance, and rollout

### Acceptance checks

| ID | Required evidence |
|---|---|
| **AC-01** | Ten distinct target games; long-break retrieval; explicit season-end shortfall; stable identities through ordinal changes |
| **AC-02** | Independent population coverage; injury/reserve and call-up cases; unresolved identity and affiliation states |
| **AC-03** | Trades, same-game team changes, postponements, cancellation, earlier starts, late notices, and suspended games |
| **AC-04** | Immutable-record enforcement, concurrent publication, idempotent retries, complete schemas, append-only corrections |
| **AC-05** | Delayed commits, post-lock publication, missing timestamp proof, timing corrections, deterministic final selection |
| **AC-06** | Official appearance, penalty-only zero-minute credit, dressed-unused, nonappearance, ambiguous labels, unavailable probability |
| **AC-07** | Default and signed custom scoring; unavailable zero-weight category allowed; unavailable nonzero-weight category blocks FP |
| **AC-08** | Coherent joint uncertainty for every contributing category; no marginal-quantile addition; profile qualification enforced |
| **AC-09** | Worked-example opacity, first/repeated values, gap breaks, extrema, model/team markers, accessible desktop/mobile views |
| **AC-10** | Distinct latest, locked-final, actual, extrema, and interval marks, including coincident values and corrected actuals |
| **AC-11** | More than 3,000 revisions; complete stable pagination; bounded reads; no private artifact exposure |
| **AC-12** | Daily/DST timing, event deduplication, changes during processing, stale inputs, missed deadlines, pregame attempt |
| **AC-13** | Final forecast/outcome matching, corrected grades, paired baselines, no-show separation, re-scoring labels, RSO lineage separation |
| **AC-14** | Frozen chronological evaluation, baseline gains, category/FP intervals, participation calibration, coverage and sparse-data reporting |
| **AC-15** | Missing, altered, undecodable, inaccessible, and archived artifacts; verified archive recovery reproduces original and supported re-scored uncertainty |
| **AC-16** | H1–H10 first-vintage selection; equal-time tie; unavailable component; missing episode; skipped horizon; reschedule re-entry; no adjacent-horizon substitution |
| **AC-17** | Disabled RSO adapter, unavailable propagation, no double participation adjustment, unchanged v1/RSO fixture behavior |
| **AC-18** | Full game lifecycle from H10 through final pregame selection, actual result, correction, artifact retrieval, and accountability |

### Required end-to-end scenario

Follow one player and scheduled game from H10 to H1:

1. Capture its opportunity, schedule, and affiliation evidence.
2. Issue daily and same-day material revisions.
3. Preserve unchanged values, failed attempts, and an explicit unavailable gap.
4. Apply a postponement that changes ordinals and revisits a prior horizon.
5. Verify the primary horizon selections remain fixed and missing horizons remain missing.
6. Change scoring and reproduce supported historical uncertainty from pinned artifacts.
7. Archive and retrieve a required artifact; separately inject missing and altered-artifact failures.
8. Publish the final eligible pregame vintage and cross the lock with a deliberately late attempt.
9. Render the labeled locked-final forecast and eventual actual.
10. Append an official outcome correction and recompute versioned grades.
11. Confirm the disabled RSO adapter leaves v1 behavior unchanged.

Include separate appearance branches for official zero-minute penalty credit, dressed-unused, verified nonappearance, and ambiguous evidence.

### Reliability and operating gates

Benchmark full-universe daily issuance and worst-case material fan-out. Before activation, produce a measured capacity manifest with explicit concurrency, batching, runtime, memory, storage growth, archival retrieval, retention, request, retry, and stopping limits.

Track:

- due versus published scopes and publication delay;
- source age and unavailable components;
- queue depth, retries, and duplicate suppression;
- artifact integrity and archive retrieval failures;
- storage growth and history completeness;
- outcome lag and corrections;
- calibration drift and qualification status.

Record measured API and UI latency budgets on representative full-scale fixtures. Activation remains blocked if capacity is unknown or conflicts with v1/RSO operation.

### Release and rollback

1. Local contracts, fixtures, isolated implementation, and evidence discovery.
2. Local end-to-end, artifact-reproduction, security, performance, and independent scientific review.
3. Separately authorized prospective shadow issuance and settlement.
4. Separately authorized public release of a declared qualified subset.
5. Expansion to full v2 as remaining gates pass.
6. RSO-owner acceptance and separately approved adapter rollout.

Rollback disables affected serving or restores a previously qualified version. Preserve all issued records, artifacts, and evaluations. Do not weaken qualification or disrupt v1/RSO.

## 9. Open questions, evidence gates, and approval boundary

No unresolved product preference is being delegated to Claude. The following factual and scientific gates remain:

- Availability and completeness of original as-of inputs and untouched evaluation data.
- Reliable official appearance classification, including rare zero-minute cases.
- Qualified PIM modeling and joint distributions for the required contributing categories.
- Calibration across declared horizons, cohorts, and supported scoring profiles.
- Credible baseline improvement with sufficient coverage.
- Publication and start-time evidence adequate for final selection.
- Artifact reproducibility, archive retrieval, and sustainable retention capacity.
- Current hosted state and actual RSO display lineage.

Discovery, contracts, fixtures, isolated storage, and UI work can proceed independently where their prerequisites permit. Final evaluation, qualification, and activation remain blocked by their corresponding evidence gates.

### Document sequence and source of truth

This PRD follows the actual [create-prd.mdc](/Users/tim/Code/fhfhockey.com/tasks/TASKS/rules/create-prd.mdc) structure. Clarifying questions have been answered; the current PRD is now presented for approval.

After approval, use [generate-tasks.mdc](/Users/tim/Code/fhfhockey.com/tasks/TASKS/rules/generate-tasks.mdc) to produce the comprehensive parent-task and subtask list, including:

- stable IDs and real dependencies;
- concrete deliverables and likely paths;
- file ownership and parallel-work boundaries;
- acceptance checks and required verification evidence;
- immediate work versus decision, evidence, and production-approval gates;
- explicit FR-26 horizon-selection and reschedule tests;
- complete FR/RV/AC-to-task/test traceability;
- a copy-ready Claude handoff prompt.

The intended source-of-truth files are:

- `/Users/tim/Code/fhfhockey.com/tasks/TASKS/prd-forge-v2-skater-game-forecasts.md`
- `/Users/tim/Code/fhfhockey.com/tasks/tasks-prd-forge-v2-skater-game-forecasts.md`

Both remain absent. Preserve the older proposal artifacts unchanged and recheck ownership before writing.

**Next checkpoint: approval of this complete PRD.** The task list follows that approval. Switch out of Plan Mode when ready to save the agreed planning documents; that switch does not authorize application implementation, production actions, commits, or pushes.
