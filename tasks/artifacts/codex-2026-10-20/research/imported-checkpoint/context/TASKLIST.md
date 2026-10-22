# FHFH working task list — 2026-10-20

Read-only audit, as of 2026-10-20 01:26 UTC; evidence correction at 01:33 UTC (native choice already recorded; corrected release-plan citation). Only this document is changed. Proposed fixes are not implemented or authorized for release by this audit.

## Evidence and boundaries

- Audited development: `392c02af21618dd4501ea7b0635d844c6cbe8a4c` (octoberBranch). Observed origin/master: `b630e0767d00d6c72506268282834151d78e7da1` (R6f). These supersede the supplied b401c5f53 / ccfe5e57b snapshot. Git contains R6f; deployment was NOT inspected.
- Master is an ancestor of development: `git rev-list --left-right --count origin/master...HEAD` returned `0 48`; 559 web files differ. Do not merge development wholesale.
- TJ's uncommitted laptop changes are unavailable. Especially reconcile hits/blocks, schedule-route and IFTTT work before assigning overlapping edits. Missing cloud work is not evidence of “not started.”
- Native files listed in `tasks/prd-forge-daily-pipeline.md:88–89` remain frozen until 2026-10-20 17:00 UTC (13:00 EDT). Review now; implementation only after freeze and ownership check.
- No production, Vercel, Supabase, provider, cron or route calls were made. No dependency versions, lockfiles, migrations or application files changed. No private league/account/plan data is included.
- Evidence below is relative to repository root at the audited commit. “Proven” means local reproduction or directly observed code; “risk” requires the proposed regression before claiming an incident.
- Verification commands below run from `web/`, using Node 22.11.0 and npm, with mocked/inert services and outbound networking disabled. Never set GIT_DIR. Commands are proposed unless listed under Tests run.
- Approval shorthand: **Local** = no additional TJ approval for a separately assigned local fix; **Release** = TJ approval before release/deployment; **Operational** = separate approval for cron/env changes, production writes or migrations. This document itself authorizes none of those operations.

## Tomorrow's top 10

1. **R1:** Add a failing post-puck-drop lock regression and repair the daily lock expiry; include drop, swap, reserve and midnight boundaries.
2. **R2:** Preserve injured provider-locked slot occupancy without inventing projected contribution; add the reproduced collision fixture.
3. **F4:** Add the reproduced two-invocation late-writer regression and settle the quiescent-only versus forced-fencing contract before changing continuation.
4. **F1:** Fence local-only projection runs from the goalie API's latest, fallback and explicit-run paths.
5. **D1:** Reconcile with the existing NST-CATCHUP-21S owner, then remove the zero-delay burst and test resumable 21-second pacing without real requests.
6. **D2:** Add a two-invocation partial WGO-goalie write fixture and make retry recover missing games rather than skipping the date.
7. **F2:** Isolate the already-committed null-win fix into a master-compatible candidate; do not port the unrelated native admission gate.
8. **D3:** Compare TJ's local schedule route with the cloud wrapper; add a late-resolving timeout regression and cancellation/pre-write guard.
9. **F3:** Trace each shrinkage target and add fixed-recent-window/variable-history fixtures before choosing an exposure repair; cumulative lifetime TOI is not a safe drop-in replacement.
10. **N1:** After 17:00 UTC, rebase the existing patch stack against current source-selection/bridge work (N2), then review the target-scope replay and writer-first gate. No live publish in this session.

Each entry is one bounded session; the full native rollout and model calibration are deliberately not top-10 “single tasks.” Feed and RSO work may proceed independently with exact file ownership. FORGE serving → RSO → Start Chart remains the critical path.

## P0 — release safety gates, not claimed live incidents

### G1 — Keep native reader admission behind a qualified writer
- Impact: shipping development's native admission contracts ahead of compatible issued forecasts can leave Start Chart with no admitted games.
- Evidence: `tasks/artifacts/release-r6-2026-10-19/PLAN.md:64–74`; `web/pages/api/v1/start-chart.ts:877–880`; development/master divergence above. User's report of native admission incompatibility is a release constraint, not a production observation from this audit.
- Scope: produce an exact writer/consumer contract and ordered cherry-pick manifest; retain the master-compatible interim bridge until the replacement proves readback. Test provenance and hash representation independently: a label alone does not repair legacy raw-timestamp hashes. Count unique admitted player-games separately from missing statistic cells, then verify scorability for the requested profile. Never port whole reader files solely to obtain a small fix.
- Verify: `npx vitest run lib/projections/apiHelpers.runAdmission.test.ts lib/rosterScheduleData/forgeDailyBridge.test.ts lib/player-forecasts/nativeDailyPipeline.test.ts`; `git diff origin/master -- web/pages/api/v1/start-chart.ts web/pages/api/v1/forge/goalies.ts`.
- Dependencies: N1, existing admission owner, immutable qualified issuance/readback evidence. Local tests alone do not qualify production.
- Approval: Local manifest; Release + Operational for hosted activation. Size M (manifest only).

## P1 — correctness and recovery

### R1 — Preserve daily transaction locks after puck drop [proven]
- Impact: a player locked in an active slot can become droppable/reservable later that same day, producing an illegal plan.
- Evidence: `web/lib/rosterScheduleOptimizer/planningTimeline.ts:66–75` compares effective time to game start; `planning.ts:543–545` and `planning.test.ts:1722` describe rest-of-day locks. Synthetic public evaluatePlan result admitted the post-start drop/add.
- Scope: expire daily provider locks at the correct next league-local midnight, not puck drop; cover drop/add, reserve and DST boundaries without changing weekly-lock policy.
- Verify: `npx vitest run lib/rosterScheduleOptimizer/planning.test.ts` (add failing post-start cases first).
- Dependencies: authoritative provider slot/timezone evidence; coordinate R2 in the same file. Approval: Local; Release. Size S.

### R2 — Keep an injured locked player occupying the provider slot [proven]
- Impact: injury filtering can free a locked starting slot and assign another player there; reported legality and displayed assignment diverge from provider reality.
- Evidence: `web/lib/rosterScheduleOptimizer/planning.ts:556,582,670–673`; assignment handling near `:288`. Synthetic fixture removed locked injured player A and placed B in its C slot; baseline then reported an unverifiable lock.
- Scope: separate locked occupancy from projected contribution/remaining playable games. Retain occupancy even when O/IR excludes contribution; do not count fictitious starts.
- Verify: `npx vitest run lib/rosterScheduleOptimizer/planning.test.ts` with authoritative injured-lock and no-double-occupancy regressions.
- Dependencies: R1 boundary semantics. Approval: Local; Release. Size M.

### F4 — Prevent late-writer corruption during continuation [actual-runner reproduction]
- Impact: an old invocation can overwrite player/team output after its replacement reports succeeded/completed, while metadata ownership rejection appears to work. Immutable identity is also missing, but does not by itself stop these late writes.
- Evidence: `web/lib/projections/queries/run-lifecycle-queries.ts:163–168,269–275` scope/claim; `web/lib/projections/run-forge-projections.ts:408,457–469,760–778` derives invocation cutoff/config and restores progress, not the full original issuance identity.
- Additional evidence: outside-repo harness invokes the actual runner twice with real lifecycle/cleanup/persistence and fake computational stages/client. After B succeeds at0.9, delayed A leaves mixed0.1/0.9 player/team rows; A returns RUN_LEASE_LOST. Root independently reproduced it. SQL engine, real models and production were not exercised.
- Scope: bind original as-of/config/code/manifest, but do not call that an input snapshot. Add late-write/takeover fixtures for projection rows, cleanup and shared sidecars. A metadata CAS or client precheck is insufficient. Choose explicit quiescent-release-only continuation versus separately approved server-side serialized mutation fencing; preserve compatible cooperative resume without claiming crash recovery is safe.
- Verify: `npx vitest run lib/projections/run-forge-projections.resume.test.ts __tests__/pages/api/v1/db/run-projection-v2.test.ts __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`; add changed-cutoff/config fixtures.
- Dependencies: choose quiescent-only versus forced-recovery guarantee; existing continuation owner. New run IDs alone do not isolate date/game/model analytics sidecars. Approval: Local; Release; Operational if schema changes prove necessary. Size M.

### F1 — Reject fenced local runs in goalie readers [code-confirmed risk]
- Impact: locally generated/unqualified forecasts can become the apparent latest successful goalie forecast.
- Evidence: `web/lib/projections/apiHelpers.ts:40–47` selects latest successful runs without git_sha admission; `web/pages/api/v1/forge/goalies.ts:263–269,298–304,487–488` lacks equivalent local fencing. Start Chart already filters local runs before limiting at `:877–880`.
- Scope: apply the same local-run exclusion before latest/fallback limits; reject an explicit local run. Preserve master-compatible contracts and avoid unrelated native admission rollout.
- Verify: `npx vitest run lib/projections/apiHelpers.runAdmission.test.ts __tests__/pages/api/v1/forge/goalies.test.ts`; add latest-local/older-qualified and explicit-local fixtures.
- Dependencies: G1; establish intended non-local qualification contract. Approval: Local; Release. Size S.

### D1 — Enforce the NST 21-second minimum [code-confirmed]
- Impact: the small-range catchup path bypasses required provider pacing; existing tests bless the wrong behavior.
- Evidence: `web/lib/cron/nstBurstPlans.ts:165–177` sets zero delay for up to two dates/39 URLs; `web/pages/api/v1/db/update-nst-gamelog.ts:2640–2646` applies it; `web/lib/nst/requestBudget.ts:103–104` honors zero. `nstBurstPlans.test.ts:23–39` expects the burst.
- Scope: enforce at least 21 seconds between NST requests across the relevant owner, with bounded chunks, resume and truthful deferred receipts. Do not substitute parallel keys/processes. Reuse the existing C0077 owner rather than opening a competing repair.
- Verify: `npx vitest run lib/cron/nstBurstPlans.test.ts lib/nst/requestBudget.test.ts __tests__/pages/api/v1/db/update-nst-gamelog.test.ts` with fake timers only.
- Dependencies: super-goal C0077/NST-CATCHUP-21S at `tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md:1731` supersedes the burst. Approval: Local; Release/Operational for scheduling changes. Size M.

### D2 — Recover partial WGO-goalie dates on retry [code-confirmed]
- Impact: a partially persisted date can be skipped by the next ingestion, leaving missing goalie games indefinitely.
- Evidence: `web/__tests__/pages/api/v1/db/update-wgo-goalies.test.ts:556–623` permits one of two rows persisted; route `:1225–1243` advances from max date + 1, `:1315–1324` skips existing dates without overwrite; all-mode `:1064–1087` has related date selection.
- Scope: use a complete-date checkpoint or bounded overlapping idempotent retry. First add a two-invocation fixture proving the second missing game is recovered without duplicate rows.
- Verify: `npx vitest run __tests__/pages/api/v1/db/update-wgo-goalies.test.ts lib/cron/wgoGoaliePersistence.test.ts __tests__/lib/cron/wgoIngestion.test.ts`.
- Dependencies: choose checkpoint versus overlap; schema change is not assumed necessary. Approval: Local; Release; Operational for any historical repair/migration. Size M.

### D3 — Stop schedule work after the wrapper's timeout [code-confirmed risk]
- Impact: a 504 can precede a successful late write, inviting overlapping retries and misleading freshness receipts.
- Evidence: `web/pages/api/v1/db/cron/update-roster-optimizer-schedule-daily.ts:35–44,75–81` uses an in-process Promise.race without cancellation; writer `web/pages/api/v1/db/update-roster-optimizer-schedule.ts:453–459,486–491` can continue to upsert; source `web/lib/rosterScheduleData/source.ts:105–128` supports a signal. Existing daily test `:197–210` only uses a never-resolving invocation.
- Scope: reconcile TJ's local route first, propagate deadline/abort, check before writes, and handle uncertain database acknowledgments honestly rather than claiming cancellation undoes a write.
- Verify: `npx vitest run __tests__/pages/api/v1/db/update-roster-optimizer-schedule-daily.test.ts __tests__/pages/api/v1/db/update-roster-optimizer-schedule.test.ts lib/rosterScheduleData/source.test.ts`; add late-resolution fixture.
- Dependencies: unseen local schedule work; no daily cron entry is approved. Approval: Local; Release + Operational for cron activation. Size M.

### N1 — Resolve native target scope using the existing patch [held]
- Impact: native publication remains blocked; no downstream qualification can be inferred from a successful offline calculation.
- Evidence: `tasks/sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md:140–151` records native_target_scope_mismatch, nine means-only players, no publish/CAS/head/readback, and the existing patch at `tasks/artifacts/forge-target-scope-fix-2026-10-19/`. Its offline replay reports zero untargeted sources after narrowing scope.
- Scope: review that package and its later README, which records TJ choosing target-only sources and narrowed issuance; integrate only after freeze/owner reconciliation. Do not reopen the recorded choice or treat this audit as operational authorization. First session ends at reviewed patch + offline result, not live publication.
- Verify: `npx vitest run lib/player-forecasts/nativeDailyPipeline.test.ts lib/player-forecasts/nativeDailyMeansCapture.test.ts lib/player-forecasts/rollingWindowParticipation.test.ts lib/player-forecasts/rollingParticipationFrame.test.ts scripts/forge-daily-universe.test.ts`; inspect the package's recorded replay inputs before reproducing any command.
- Dependencies: 17:00 UTC freeze, N2 current-base rebase, latest patch stack/ownership, G1. Approval: Local post-freeze; Release/Operational for publish, CAS, cron or env changes. Size M (review/integration slice).

### N2 — Rebase native patch 02 without losing current serving work [verified blocker]
- Impact: the historical clean-apply receipt no longer describes the cloud checkout; blindly restoring old files can erase source selection, the interim bridge, injury fields or objective persistence.
- Evidence: `tasks/artifacts/forge-v2-integration-2026-10-18/base-blobs.txt` matches 22/25 expected states (including three correctly absent new files). Changed: `web/lib/in-season/workspaceSchema.ts`, `web/lib/rosterScheduleData/planning.ts`, and `planning.test.ts`. All seven patch SHA-256 values match the latest target-scope README manifest. Targeted read-only patch-02 check FAILS on both planning files; patch 01 does not touch these paths, so its prerequisite does not explain this drift.
- Scope: after freeze, rebase only the conflicting integration hunks against current source selection/bridge, preserve injury and objective schema additions, reconcile unseen laptop work, and regenerate exact base/patch receipts. Do not apply either old entire file or the whole development branch to master.
- Verify from repo root: `git apply --check --include=web/lib/in-season/workspaceSchema.ts --include=web/lib/rosterScheduleData/planning.ts --include=web/lib/rosterScheduleData/planning.test.ts tasks/artifacts/forge-v2-integration-2026-10-18/02-integration-rebased.patch`; after an authorized rebase, from web: `npx vitest run lib/rosterScheduleData/planning.test.ts lib/in-season/workspaceSchema.test.ts lib/player-forecasts/forecastServingSource.test.ts`; full ordered-stack verification remains required, not claimed here.
- Dependencies: freeze, exact current owner/base, N1/G1. Approval: Local after freeze; Release/Operational separately. Size M.

## P2 — model quality, completeness and truthful UX

### R3 — Remove injured players from automatic DROP suggestions [proven]
- Impact: the UI suggests a move the planner intentionally refuses.
- Evidence: `web/lib/rosterScheduleOptimizer/lineupGaps.ts:48–53` lacks injury protection; `web/components/RosterScheduleOptimizer/RosterPlayerRow.ts:21` renders the badge; planner `planning.ts:1065–1070` protects out/injured players. Synthetic badge fixture selected an injured player.
- Scope: share or align the no-auto-drop predicate without prohibiting explicitly confirmed manual choices beyond product rules.
- Verify: `npx vitest run lib/rosterScheduleOptimizer/lineupGaps.test.ts lib/rosterScheduleOptimizer/planning.test.ts`.
- Dependencies: existing injury policy; coordinate R1/R2. Approval: Local; Release. Size S.

### F2 — Port the existing null-win goalie correction, not its whole reader
- Impact: missing win probability must remain unknown, not an invented numeric probability.
- Evidence: development `web/pages/api/v1/forge/goalies.ts:172–174,443` preserves null and skips normalization if any input is unknown; test `:400–427` covers it. Master lacks these hunks. The file also contains separate unreleased admission changes.
- Scope: isolate null-preservation and regression hunks onto master-compatible contracts; no new implementation from scratch. NEW 10.0 is locally fixed, not released by current master evidence.
- Verify: `npx vitest run __tests__/pages/api/v1/forge/goalies.test.ts`; `git diff origin/master -- web/pages/api/v1/forge/goalies.ts __tests__/pages/api/v1/forge/goalies.test.ts`.
- Dependencies: G1; compatible candidate checkout when separately authorized. Approval: Local; Release. Size S.

### F3 — Separate shrinkage evidence by target and history support
- Impact: one heuristic mixes average TOI and cumulative shots, then controls recent shooting rates and deployment; changing its units blindly can overtrust a fixed last-five sample.
- Evidence: `web/lib/projections/stages/skater-stage.ts:2024–2028` supplies average TOI with cumulative shots; `calculators/skater-adjustments.ts:406–429` uses TOI/(TOI+900), weighted 58% TOI/42% shots; `queries/skater-queries.ts:81–105` supplies the fields. Average 1,000 seconds has the same TOI evidence weight for one and 80 games.
- Scope: trace upstream support and every downstream use; test identical last-five inputs with differing old history. Separate evidence for long-run rate, recent rate and projected minutes before proposing a minimal change. Do not substitute lifetime cumulative TOI or tune coefficients from anecdotal rankings. The first research packet’s cumulative-input-only recommendation is superseded by the deeper counterexample.
- Verify: `npx vitest run lib/projections/runProjectionV2.test.ts lib/projections/queries/skater-queries.test.ts`; add the unit-consistency fixture before tuning.
- Dependencies: F7 matched support transport, historical exposure quality, F5. This research prerequisite does not automatically block an independently qualified native baseline. Wood/Larkin values and their cause were not independently verified. Approval: Local; Release. Size M (target/support contract and regressions; calibration is a later bounded session).

### F5 — Separate committed hits/blocks work from unresolved data repair
- Impact: hits/blocks quality depends on valid all-strength exposure and season labels, not just replacing zero NST rates.
- Evidence: development commit `b8fe1072`; `web/lib/projections/calculators/skater-adjustments.ts:446–487` implements all-strength three-year counts/exposure and position priors; stage `:2139–2143,2644–2647` wires it. Master does not contain this helper. R6d's forward writer guard does not prove old WGO identities repaired.
- Scope: compare committed code with TJ's unseen version, isolate a master-compatible physical-events patch, and prepare a non-mutating identity repair plan. Keep unknown identities separate from valid season repairs; no broad destructive recompute.
- Verify: `npx vitest run lib/projections/runProjectionV2.test.ts`; `git diff origin/master -- web/lib/projections/calculators/skater-adjustments.ts web/lib/projections/stages/skater-stage.ts`; add all-strength, sparse and mislabeled-season fixtures.
- Dependencies: rolling evidence, native/aligned-head isolation. The 214-player recompute, 253,257 missing game/team rows and 105 bad dates are user-reported, not requeried here.
- Approval: Local; Release; Operational for data repair/migration. Size M (port/repair plan, not repair execution).

### F6 — Explain missing PP/ES bridge coverage with exact run provenance
- Impact: incomplete forecast lines can remove otherwise useful players; replacing unknown PP with zero would falsely claim certainty.
- Evidence: `web/lib/projections/calculators/skater-adjustments.ts:638–646` preserves unsupported heads as null; `web/lib/rosterScheduleData/forgeDailyBridge.ts:225–230,236` only supplies structural PP zero for negligible/no PP time and requires complete scoring heads.
- Scope: offline classify omissions by exact run SHA, source, PP exposure and missing head; distinguish expected rejection from incorrect modeling. Do not weaken null gates or claim replacement runs self-healed without issued-row/readback evidence.
- Verify: `npx vitest run lib/rosterScheduleData/forgeDailyBridge.test.ts lib/projections/modeledHeadTotals.test.ts`; add fixtures for positive-PP/null-head versus structural-zero and missing ES.
- Dependencies: G1, F1, qualified issuance. The 151/115 omissions and production self-healing prediction are supplied reports, not verified counts/outcomes.
- Approval: Local fixtures; Operational for any live evidence collection/repair later. Size S.

### F7 — Preserve paired SOG exposure before compaction [producer + reader gap]
- Impact: recent-rate reliability cannot be inferred from generic raw-count/TOI totals. Adding cumulative TOI or a reader field alone would misstate observed versus reconstructed evidence.
- Evidence: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2797–2836` obtains ratio components but emits scalar rates; `:2032–2082,2331–2337,2404–2448` SOG support uses independent historical totals rather than matched all/last-N components. `rollingPlayerMetricMath.ts:3–34` loses observed/reconstructed distinction; query allowlist `web/lib/projections/queries/skater-queries.ts:81–131` omits paired SOG support. Actual injected reader passes eight grouped checks but does not restore hypothetical unselected paired fields.
- Scope: first specify EV/PP recent-five frame identities, missing slots, paired numerator/TOI seconds, observed/reconstructed status and availability watermark. Preserve these before aggregation erases provenance; explicitly emit, compact and read a versioned typed support payload. Keep legacy support unknown; do not infer it from rounded rates. Existing JSON sidecar may accommodate an optional separately versioned object, but storage/parser compatibility must be verified; no migration assumption.
- Verify: `npx vitest run lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts lib/projections/queries/skater-queries.test.ts`; add actual producer→compactor→injected-reader fixture, zero/missing/reconstructed and identity substitutions. Six grouped checks now execute actual deriveOutputs→compactor→injected reader under inert dotenv/client replacements: paired1/1200 vs5/6000 support becomes identical controlled emitted/compacted output. Full source-extraction loop, private simple accumulator update, real persistence and forecast qualification remain unexecuted. Import-safe extraction is recommended engineering, not a remaining blocker for this tested slice.
- Dependencies: F3 target/window contract, current rolling owner, original source-qualified observations for any later backfill. Independent native rollout is not gated merely by this experiment. Approval: Local; Release; Operational for schema/data repair if needed. Size M (bounded support slice; defer historical recomputation).

### R4 — Preserve postponed-game coverage evidence before playability filtering
- Impact: a complete schedule can fail its coverage witness when postponed/cancelled rows disappear too early.
- Evidence: `web/lib/rosterScheduleData/query.ts:119–120` filters is_countable before consumption; `web/components/RosterScheduleOptimizer/canonicalSchedule.ts:61–74` expects both sides of witnessed games; `source.ts:132` witnesses regular-season games; `normalize.test.ts:140–168` marks non-countable games.
- Scope: validate full witnessed coverage separately from playable/countable rows. Do not broadly change legacy queries without checking consumers.
- Verify: `npx vitest run lib/rosterScheduleData/query.test.ts components/RosterScheduleOptimizer/canonicalSchedule.test.ts`; add postponed witnessed-pair fixture.
- Dependencies: schedule contracts and D3 owner. Approval: Local; Release. Size M.

### R5 — Recheck schedule freshness inside planner admission [risk]
- Impact: refreshing forecasts may leave an older schedule usable even after its freshness witness expires.
- Evidence: `web/lib/rosterScheduleOptimizer/planning.ts:524` checks completeness; `refreshForecastInputs.ts:18–21` changes the forecast clock while retaining schedule evidence. This is a static admission gap, not a reproduced production stale-plan incident.
- Scope: add an expired-witness/forecast-refresh regression; then require independently fresh schedule evidence at planning time, preserving distinct clocks and explicit repair messaging.
- Verify: `npx vitest run lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts lib/rosterScheduleOptimizer/planning.test.ts lib/rosterScheduleData/planning.test.ts`.
- Dependencies: R4, freshness contract; daily cron activation is a separate decision. Approval: Local; Release/Operational for cron. Size M.

### I1 — Turn IFTTT comparison observations into typed regressions
- Impact: more extracted claims do not mean more correct lineup/goalie facts; incorrect qualifiers or replacement semantics can poison FORGE inputs.
- Evidence: `tasks/ifttt-integration-2026-10-16/comparison-content-continuation-v1-2026-10-19/ASSISTANT-ANALYSIS.md:3–20` records 12 posts/10 groups/31 calls, Misa qualifier issue, untyped replacements, omissions, lineup slots and prose-only correction targets. Claim counts are not accuracy scores.
- Scope: reconcile local notes; add bounded fixtures for replacement identity, PP role, correction/retraction authority and source/timing provenance. Preserve TJ's confirmed-vs-projected labels, but never fabricate missing game/time context. No paid calls or auto-publishing in this audit.
- Verify: `npx vitest run lib/sources/lineSourceIftttReceiver.test.ts lib/sources/iftttIntakePolicy.test.ts`; grade the same held-out examples against the human labels before selecting a model path.
- Dependencies: original posts/context, human rubric and unseen local IFTTT notes. Approval: Local; separate paid-test approval/cap and Operational for activation. Size M (fixture slice).

### F8 — Attribute and evaluate contextual player adjustments before adding boosts
- Impact: opponent, goalie, home/rest and form effects already coexist in contextual FORGE; stacking more can double-count opportunity/conversion or be canceled by team reconciliation. The separate native baseline intentionally has no such adjustments.
- Evidence: `web/lib/projections/calculators/skater-adjustments.ts:221–403,554–599`; `stages/skater-stage.ts:2024–2162,2338–2365,2585–2613`; `web/lib/player-forecasts/baselinePolicy.ts:56–70` and `baselineRates.ts:184–198`. Rest query `queries/team-context-queries.ts:456–472` returns date gap1 for yesterday; skater strongest fatigue branch is <=0, while goalie stage identifies1 as B2B. This convention needs characterization, not an assumed coefficient fix.
- Scope: identify actual consumer estimator first; document one owner per effect across minutes, shot/chance generation and conversion. Test neither/own-only/opponent-only/both-B2B states. Freeze chronological ablations for opponent/starter, home/rest, underlying role/form; player-v-team residuals and individualized home splits are later strongly shrunk candidates, not automatic boosts. Preserve observed/reconstructed support and native method versioning.
- Verify: `npx vitest run lib/projections/runProjectionV2.test.ts`; add explicit date-gap and neutral-context/one-effect-owner fixtures before any tuning. Compare before/after reconciliation/bootstrap, then perform only separately scoped authorized historical evaluation. Current existence is not accuracy validation.
- Dependencies: F3/F7 support contract for changed weights, exact source selection G1, input availability/coverage. Approval: Local research/tests; Release; changed native methods require owner review. Size M (attribution + frozen experiment design, not all feature implementation).

### F9 — Reconcile SOS definitions and benchmark opponent-adjusted strength
- Impact: “SOS” currently means different things across surfaces. Team strength, past schedule difficulty, future per-game ease, game volume and roster-usable starts must not be conflated.
- Evidence: `web/lib/underlying-stats/teamScheduleStrength.ts:134–149,202–245,309–322` already has two-thirds opponent points% plus one-third same-bucket indirect points%; `web/lib/trends/strengthOfSchedule.ts:53–110` instead uses direct win%, with zero for no games. Snapshot producer `web/pages/api/v1/db/update-team-sos.ts:226–310` pools repeated opponents' as-of records without focal-team exclusions. Future indirect terms use opponents' remaining schedules, not historical opposition quality.
- Scope, staged: (A) one versioned descriptive contract for win% vs points%, fixture weights, focal exclusions, past-as-known-then vs retrospective-now vs future, and unknown coverage; (B) offline RPI-style/OWP-only benchmark versus regularized Bradley–Terry and a bounded Colley comparator; (C) one well-supported opponent-adjusted offense/defense category trial; (D) promotion only after held-out gain/calibration. A displayed overall score may summarize context, but never substitutes for category-specific forecast inputs or repeats already modeled effects. Derive actual game counts from schedule, not a hardcoded82.
- Verify: `npx vitest run lib/underlying-stats/teamScheduleStrength.test.ts lib/trends/strengthOfSchedule.test.ts`; add repeated/opponent-history-denominator, own-result feedback, empty/disconnected graph and strict-cutoff fixtures. Empirical win/count/decision evaluation requires qualified chronological data; no NHL backtest has run here.
- Dependencies: current source/metric inventory, F10 before reusing affected prediction features, versioned provider inputs and frozen evaluation protocol. Must not block an independently qualified simpler FORGE path. Approval: Local research/tests; Release/Operational separately. Size L (four bounded stages, not a single-session promise).

### F10 — Characterize opponent-form rating units and snapshot coverage
- Impact: a neutral opponent is not neutral in existing per-team adjusted features; clipping and missing historical ratings can change comparisons. This does not establish biased live probabilities.
- Evidence: `web/lib/power-ratings.ts:652–683` centers ratings at100; `web/pages/api/v1/db/update-team-power-ratings.ts:221–222,316–323,359–363` persists them untransformed. `web/lib/game-predictions/featureBuilder.ts:2730–2737,2894,670–673,1082–1088,1160–1208` reads those fields and subtracts50. Isolated actual-source helpers reproduce neutral100→GD+1/xGFshare+.05; home-away constants cancel in interior cases but .98/.95 both clip to1. Loader's global100-row power-history cap can omit older opponent snapshots; last-five is formed after missing snapshots are discarded.
- Scope: pin producer version/units and time availability; define neutral feature transform, characterize clipping and missingness, and bound/page historical coverage by requested identities/cutoffs rather than accepting a short convenient subset. Do not change50→100 in isolation and claim a forecast improvement; feature/model compatibility and retraining must be considered.
- Verify: `npx vitest run lib/game-predictions/featureBuilder.test.ts`; add neutral-unit, home-away cancellation, clipping, missing-old-snapshot and complete-history fixtures. Compare exact model-version outputs offline before any release. `SOS-SCALE-FIXTURE.json` is source-helper arithmetic, not model inference.
- Dependencies: F9 metric contract if reused for SOS; current prediction model owner and provenance. Approval: Local; Release/Operational for model/data changes. Size M.

## P3 — bounded performance and maintenance

### R6 — Measure full serialized transport and storage budgets
- Impact: row-only size checks may understate a full response/save payload; no actual oversized production response was observed.
- Evidence: `web/lib/rosterScheduleData/forgeDailyBridge.ts:21,24,423–426` sets 2.5 MB compact/4 MB expanded budgets and sums serialized row lengths; `bridgeForecastWire.ts:92–94` omits runs/limitations/envelope from that tally. UTF-8 byte size can exceed string length. R6f compact-wire/save-size work is already on master.
- Scope: measure exact UTF-8 route and workspace envelopes including bridge siblings and preservation data; add boundary fixtures and explicit graceful truncation/rejection. Do not redo R6f or assume row constants prove platform compliance.
- Verify: `npx vitest run lib/rosterScheduleData/forgeDailyBridge.test.ts lib/in-season/workspaceRoutes.test.ts`; extend fixtures with metadata/non-ASCII and near-limit full payloads.
- Dependencies: actual request/response shapes, browser storage failure behavior; avoid private saved-plan exports. Approval: Local; Release. Size M.

## Needs TJ's decision

1. **Native scope is already decided:** the later `tasks/artifacts/forge-target-scope-fix-2026-10-19/README.md:9–13` records option (a), target-only sources, and narrowed issuance approval. The earlier register question is superseded. Only a materially changed method/scope needs a new decision; current work is post-freeze integration review.
2. **Release order:** approve a later narrowly scoped null-win/RSO correctness candidate, or hold until native integration. Recommended: keep independent master-compatible fixes moving; do not bundle native admission prematurely. No release is authorized here.
3. **Schedule freshness cron:** retain explicit/manual freshness blocking, or approve the proposed daily refresh after D3 and witness tests. `web/vercel.json` has no schedule-daily entry; adding one needs explicit operational approval.
4. **Recovery strategy:** WGO bounded overlap/idempotent retry versus a persisted completeness checkpoint. Prefer the smallest approach that proves hole recovery without requiring a migration.
5. **Continuation safety:** quiescent-release-only recovery is the smaller fail-closed option; automatic forced takeover needs write-time serialization covering shared sidecars and an isolated-DB concurrency test. Choosing the stronger path may require database deployment approval.
6. **Fresh acceptance window:** replace the expired October 12–18 owner-test window with a new dated window after local fixes; keep public beta gated. Do not put account/league identifiers in the task artifact.

## Release readiness

- **Already in remote master:** R6f `b630e0767` compact bridge wire/save-size port; R6e is superseded. Do not queue R6f again. Remote Git evidence does not verify deployed behavior.
- **Next candidate to prepare:** F2 null-win-only hunks and tests, preserving master's reader contracts. Its development tests pass; candidate port/typecheck and TJ release approval still required.
- **Then:** R1/R2/R3 after new regressions pass; F1 only with explicit local-run admission tests. Batch compatible fixes to avoid needless remote builds.
- **Independent feed candidates:** D1 and D2 after owner reconciliation/retry fixtures; D3 before any schedule cron activation. Release and historical repair are different approvals.
- **Not yet ready:** F5 H/B port until reviewed against local work, valid rolling inputs and unrelated native/null-head changes; F3 model changes until exposure fixtures and offline sensitivity checks.
- **Held native path:** N1 after freeze → writer stamps compatible immutable contract → qualified dated issuance and readback → consumer admission → separately approved cron/env activation. Local replay alone cannot unlock production gates.
- `web/vercel.json:9–117` has 27 cron entries across 18 normalized routes, including minute-level starter refresh and repeated rolling pipeline calls. This is checked-in configuration, not proof of active schedules or cost; no blanket cron disable/change is proposed.
- No PR/push was attempted: GitHub CLI is unauthenticated, and this audit cannot inspect Vercel to verify the required no-build behavior of all linked projects. A draft PR is not assumed deployment-free. Local branch/document are available; full file is the delivery fallback.

## Task-list reconciliation

- **REGISTER rows 5/14/26/38** (`tasks/master-reconciliation-2026-10-17/REGISTER.md:48,57,74,101`): credit recorded implementation/local evidence; do not promote to production-complete without readback.
- **REGISTER row 12** (`:55`): “blocked” H/B implementation wording is stale; development now contains b8fe1072's physical-event model. Release/data-evidence work remains F5.
- **REGISTER rows 20/21/22** (`:68–70`): fresh forecast acceptance still blocked; engine progress is not real-user acceptance. Add focused R1/R2 lock regressions rather than marking provider/rules work wholly complete.
- **REGISTER row 24** (`:72`): October 12–18 acceptance window expired; replace the window, not its unmet gate.
- **REGISTER rows 28/29/31** (`:81–84`): common revision, goalie starts and real release gates remain open. Row 30 naming remains a decision: `web/pages/start-chart.tsx:728` still says “Starter Board | FHFH”.
- **REGISTER row 38** (`:101`): bounded IFTTT RPC deadline exists (`web/lib/sources/iftttRpcDeadline.ts:14–24`; `iftttReceiptRetention.ts:15–47`, six-second write/two-second read-only reconciliation). Hosted activation is not verified.
- **REGISTER row 44** (`:107`): preserve completed historical NST repairs; do not repeat old October 9–13 backfills as new tasks.
- **October 15 checklist:** `tasks/artifacts/forge-rso-completion-2026-10-15/checklist.md:29,38–43,48` checked 1.2, 2.1–2.3, 2.5–2.6 and 3.1 retain local credit. Parent gates and 2.7 publish/readback/2.8 release at `:27,37,44–47` remain open. Pending credited-SO note at `:67` is superseded by completed read at `:69`.
- **Daily pipeline task list:** `tasks/tasks-prd-forge-daily-pipeline.md:14–28` unchecked rows do not mean no code exists. Frozen-window/reserved exclusions at `:16,21` are superseded by the rolling/all-games approved PRD direction at `tasks/prd-forge-daily-pipeline.md:70–84`.
- **Daily PRD:** “nothing before materialize checked in” at `:5` is stale: `web/scripts/forge-daily.ts:98–177`, `forge-daily-universe.ts:30–76`, `web/lib/player-forecasts/nativeDailyMeansCapture.ts:1–4,173` and `rollingWindowParticipation.ts:15–18,50–67` exist. Retained v1 driver stages are deliberate; integration/publish is still held. Preserve freeze `:88–89`.
- **Super-goal NST:** C0077 at `tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md:1731` supersedes burst guidance. C0048's 40-request text at `:1783` is stale (code says 39; either burst conflicts with 21-second policy).
- **Super-goal rolling:** C0052 at `:3954` needs split status: forward history/window correction exists in `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2987–2990,3617–3618,3860–3919` with test near `:2254`; stored-data repair/proof remains distinct.
- **Super-goal October pipeline:** `:5981` directs ownership to the register. Link N1/G1 there; do not create a duplicate rollout program.
- **Start Chart NEW 19.0:** implementation finding is stale on BOTH branches. `sumProjectionParts` is gone; development API `web/pages/api/v1/start-chart.ts:1560,1567–1573` uses complete modeled-head gating; master has it near `:1503,1509`. `web/lib/projections/modeledHeadTotals.ts:7–12` propagates null; three tests passed. This does not establish live coverage.
- **Goalie NEW 10.0:** fixed and tested in development, absent from master; preserve as F2 release-port task, not a request to reinvent the fix.

## Research checkpoint — 2026-10-20 02:34 UTC

- F3 scalar cumulative-TOI recommendation superseded: fixed last-five data plus old history changes the proposed weight; workload assumptions can reverse which variant wins. Ten deterministic algebraic checks passed, not empirical forecast validation.
- F3 actual pure exports: 12 synthetic checks pass for paired missing-slot support, cross-strength weights, category-renormalized bootstrap and H/B blend. Injected reader now passes eight grouped checks, but paired SOG support is not emitted by the inspected producer nor selected by this reader; new F7 tracks the missing end-to-end contract. Actual emission→compactor→injected-reader slice now verifies the loss (six grouped checks); full source-extraction loop and real persistence remain unverified.
- F4 now separates identity, quiescence and mutation authority. Finite interleaving model reproduces late writes/deletes after replacement success; model fencing safety is conditional, not a SQL proof or incident probability.
- F4 actual persistence/lifecycle exports reproduce two late-write cases with injected client timing: same-run projection overwritten after replacement success despite old-owner CAS rejection; distinct-run sidecar deleted after success. Actual two-invocation runner now also reproduces mixed player/team content after success; computational stages/client are fake. Real DB serialization remains untested.
- G1 actual imported reader/scorer: 16 assertions passed (12 hash/label cases, changed-start control, three scoring cases). One admitted goalie can still lack nonzero-weight scoring targets; exclusion-event counts are not rejected-player counts.
- N2 records fresh base drift and failed targeted read-only apply check. No frozen patch was applied, even in scratch.
- SOS synthetic specification: 15 exact-arithmetic prototype tests pass for outcome/fixture weighting, focal-result exclusion, observed-zero vs unknown, all-prior/no-fixture states, and disconnected graphs. Actual current SOS exports also reproduce opposite rankings under win% versus points% definitions and0vsnull for no data. These are contract checks, not NHL validation.
- User-requested contextual projection/SOS research is captured in F8–F10. Existing code is mapped separately from proposed methods; no fitted gains, current deployments or newly approved algorithms are inferred.
- Reproduction kit: `FHFH-DEEP-RESEARCH-CHECKPOINT-2026-10-20` attachment contains scripts/results and assumptions; maintained outside the repo. Current research adds no application code. Future application regression and actual DB concurrency coverage remain explicit gaps.

## Tests run

Later research clarification (01:57 UTC): F3 now requires target-specific support analysis, not a presupposed cumulative-TOI fix. All audit test outcomes below remain unchanged.

- Setup: initial npm cache write failed (ENOENT); retry `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/fhfh-scan-npm-cache` installed 1,485 packages. Setup used system Node 24/npm 11 after a temporary Node path disappeared; no manifest/lockfile changes. Acceptance commands below explicitly used persistent Node 22.11.0. An interrupted preliminary Node 24 test run is excluded.
- Actual test runner: `/workspace/shared/fhfh-audit-runtime/node-v22.11.0-linux-x64/bin/node --require=/tmp/fhfh-scan-no-network.cjs node_modules/vitest/vitest.mjs run` followed by the paths below and `--maxWorkers=2 --minWorkers=1`. The preload blocks socket/TLS/global fetch; tests use mocked services.
- **PASS: 12 files, 334 tests, 28.73 seconds**, at audited development HEAD:
  - `lib/rosterScheduleOptimizer/planning.test.ts` — 132
  - `lib/rosterScheduleOptimizer/lineupGaps.test.ts` — 2
  - `lib/rosterScheduleData/forgeDailyBridge.test.ts` — 16
  - `lib/in-season/workspaceRoutes.test.ts` — 15
  - `lib/projections/modeledHeadTotals.test.ts` — 3
  - `lib/projections/runProjectionV2.test.ts` — 98
  - `lib/projections/run-forge-projections.resume.test.ts` — 5
  - `__tests__/pages/api/v1/forge/goalies.test.ts` — 10
  - `lib/cron/nstBurstPlans.test.ts` — 11
  - `lib/nst/requestBudget.test.ts` — 7
  - `__tests__/pages/api/v1/db/update-wgo-goalies.test.ts` — 25
  - `__tests__/pages/api/v1/db/update-roster-optimizer-schedule-daily.test.ts` — 10
- Pure synthetic reproduction outside the repository: `NODE_PATH=$PWD NODE22 --require=/tmp/fhfh-scan-no-network.cjs node_modules/ts-node/dist/bin.js --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' /tmp/rso-audit-repro.ts`, where NODE22 is the absolute Node binary above. Reproduced R1, R2 and R3; no real league data or network. Reproduction is evidence, not a checked-in regression fix.
- Typecheck: **PASS**, exit 0, no diagnostics; command `NODE22 --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p . --incremental false`.
- Not run: full unit suite, lint, build, browser/E2E, live readback, provider calls, paid model comparison, production migration/repair. Passing existing tests does not cover the new regressions; NST tests currently encode the unsafe burst.
- Document checks: **PASS** `git diff --check`; Line count remains below 400; only this task file is changed. No application edits.
