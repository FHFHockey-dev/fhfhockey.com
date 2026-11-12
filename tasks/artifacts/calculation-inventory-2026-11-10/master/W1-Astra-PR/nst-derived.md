# Independent peer review: W1-2 NST-derived stats

Reviewed 2026-11-11 on Tim's Mac, canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `f6cdee012b8c16d330362cb88f81435d17f975ff`. This is an additive review of `../audits/nst-derived-stats.md`, not an implementation or replacement of that audit. Original audit and owner decisions were preserved. References below are repository-relative and were relocated in the current checkout.

## Decision

**Accept the principal defect diagnoses; require the corrections and evidence qualifications below before turning the audit into an implementation checklist.** The bucket xG, penalty categories, GSAA label, missing running-score propagation, radar filter, and zone-percentage denominator problems survive independent inspection. Local synthetic inputs reproduced several directly. The audit's 11 sound / 9 mis-specified / 14 wrong tally is its own classification, not an independently re-established accuracy result.

**Most important corrections:**

1. D10's 78-request conclusion and D6's all-situations recommendation are superseded by later owner decisions. The burst work is a shared cooldown/state problem, not simply changing 78 to 39. The radar is to move to **5v5**, not acquire an all-situations label.
2. The production freshness adapter can escalate a nominally healthy or not-due helper result using durable checkpoint state. M-NST-019's claim that a permanent gap becomes healthy is conditional and was not established end to end.
3. D5 is not yet an executable specification for NST parity. Its glossary was recalled from memory, its polygons were not established, its proposed acceptance threshold is arbitrary, and its “any event” rush wording must explicitly exclude faceoffs under owner decision 8.
4. The six-game measurements cannot be independently reproduced from the delivered audit: its script and results exist only in session scratch. Retain them as the original auditor's reported sample, not as population error estimates or this review's measured results.
5. Preserve fail-closed catch-up accounting. D15 must not become an unconditional refund of reservations after uncertain execution or settlement.

## Independently reproduced evidence

No database, provider, application endpoint or browser request was made. The following cases used the actual exported parser, shot-feature builder and parity functions, imported through the installed `ts-node/register/transpile-only`; no implementation file was edited.

| Synthetic input | Observed current output | Meaning |
|---|---|---|
| 30-second home skater shift; faceoff then shot; no score fields; `allScores` | TOI 30, shots 1 | Control case |
| Same inputs; `tied` | No row for the skater | Confirms D1 without relying on production samples |
| Penalty `MIN`, duration 4 | minor 0, major 0, misconduct 1, total 1 | Confirms D3 |
| Penalty `MIS`, duration 10 | minor 0, major 1, misconduct 0, total 1 | Confirms D3 |
| Penalty `PS`, duration 0, `ps-hooking-on-breakaway` | misconduct 1, total 1 | Violates owner decision 13; drawn-penalty increment also needs the explicit policy applied |
| Isolated 9-foot, 0-degree saved shot / goal / blocked shot | ixG 0.18 / 0.25 / 0.18 | Outcome dependence and blocked-shot inclusion are real, not just model disagreement |
| Shot with situation `1010`, regular period, no penalty-shot reason | Included in parity and features; `isPenaltyShotEvent=false`, `isEmptyNetEvent=true` | Confirms this input is not recognized; does not prove all real penalty-shot encodings |
| Four faceoffs: O, O, D, N | OZFO%=50 | Owner/NST contract O/(O+D) gives 66.6667; 16.6667-point fixture error |
| Radar rate 12 with TOI 600 seconds | Player value 12, comparison-cohort value null | Asymmetric sample gate confirmed |

The fixture used game 2025020418, home 10, away 20, player 91 on the home team, opponent 21 and goalie 31; shifts were period 1, 0–30 seconds. Plays had normal regulation clocks and `1551` except the stated penalty-shot case; shot coordinates were (80,0), home defending left. Each penalty and each shot-outcome comparison was run separately so preceding events could not introduce rebound/rush bonuses. These are constructed inputs, not fetched game facts.

**Existing tests: 15 files, 152 tests passed**, in two focused runs. This is compatibility/coverage evidence, not proof of NST correctness: the synthetic cases expose defects despite those passes.

- Run 1, 6 files / 74 tests: `nhlNstParityMetrics`, `nhlEventInclusion`, `nhlScoreState`, `radarSeasonStats`, `percentUnits`, `nhlXgValidation`.
- Run 2, 9 files / 78 tests: `goalieFreshness`, `goalieFreshness.server`, `goalieCatchup`, `goalieCatchup.server`, `nhlRebounds`, `nhlRush`, `nhlShiftStints`, `nhlOnIceAttribution`, `nhlStrengthState`.
- Commands were `npm test -- --run <the corresponding .test.ts paths>` from `web/`. Test setup uses inert Supabase defaults; freshness/catch-up server tests use fixture clients. No full suite, lint, typecheck or build was run because application code was unchanged.

## Corrections and implementation-plan context

### R1. D1 is valid, but scope the symptom and fix all serving paths

`web/lib/supabase/Upserts/nhlNstParityMetrics.ts:646-647,782-815,840-855` uses nullable per-event scores, and makes up-one/down-one disjoint from leading/trailing. TOI filtering at `:945-963` rejects null-score segments. The landing server filters zero-TOI rows at `web/lib/underlying-stats/playerStatsLandingServer.ts:2461-2462,2868-2869`; goalie contexts also do so at `:2938-2939`.

The audit's empty-skater result is credible for its sample and reproduced by the null-score fixture, but it is not an unconditional theorem for every feed: a goal followed by an event at a later clock could produce a nonzero scored segment. Phrase it as missing/incorrect score-state exposure, often empty rows, rather than guaranteeing every live result is empty. The individual PBP-only fallback is a separate path (`playerStatsLandingServer.ts:3045-3060`) and must be tested independently, rather than assuming the parity fix covers it.

Use pre-event scores to classify events and post-event scores for intervals beginning at that event. `buildScoreStateContexts` already maintains pre-event scores (`nhlScoreState.ts:138-190`). Add score-state conservation tests, goal-at-boundary tests, one-goal subset tests, missing-score tests, and tests for both skaters and goalies. Goal/break events with identical clocks need explicit ordering.

### R2. D2/D4 are real; separate xG methodology from GSAA methodology

The four heuristic implementations are present at the locations the audit names: parity `nhlNstParityMetrics.ts:407-419`; fallback `playerStatsLandingServer.ts:2344-2358`; goalie buckets `:3443-3452`; team `teamStatsSummaryRefresh.ts:481-515,657`. Production parity receives freshly constructed features without a model-scored `xgValue` (`playerStatsLandingServer.ts:1073-1092`).

The goal floor is an outcome leak. **For non-null geometric fallback values**, every goal is 0.25, up to floating-point rounding: the largest pre-floor sum is 0.18+0.03+0.02+0.02=0.25. Missing-coordinate goals can instead have null xG, so qualify “every goal.” Agreement between the non-goal average constant and a sample scoring rate does not validate calibration, ranking or individual shot probabilities.

`gsaa=xGA-GA` is confirmed in parity (`:1780-1781`) and the served payload (`playerStatsLandingServer.ts:5085-5088`). Including misses in xGA is normal for **GSAx** on an unblocked-attempt model; it is not independently a GSAx defect. The defects here are the GSAA label/contract, heuristic values and inconsistent event populations.

Use owner decision 10's same-season/strength/date-range aggregate league SV% for GSAA. For HD/MD/LD GSAA, specify the corresponding bucket-specific league baseline rather than silently applying an all-shot baseline to each bucket. Do not compare a multi-date aggregate with a sum of separately rebased daily NST GSAA values as if both were the same estimand.

D2's hiding requirement stands (decision 12), while decision 6 permits explicitly labelled NST headline xG elsewhere. This does not authorize model demotion or registry changes; decision 5 leaves the current trained champion serving pending a separate approved step. Empty-net exclusions and separate reporting (decision 7) belong in the eventual event-universe contract.

**Cross-packet dependency:** TRIAGE C36 is still visible: MD/LD goals are added from parity at `playerStatsLandingServer.ts:3548,3551` and again from shot features at `:3458,3461,3564`. Coordinate with M-UST-048/049. Replacing the GSAA formula alone will not repair these danger-split goal totals. This is a reverified triage finding, not a new discovery.

### R3. D5 needs a precise verified reference and a stricter acceptance design

The current wedge/threshold method is indisputably different from the intended zone-value method (`nhlNstParityMetrics.ts:399-425`). The 10-second default and faceoff source are independently visible in `nhlRush.ts:5,91-120,212-242`. Those differences support the defect even without replicating the six-game magnitude.

However, the original audit expressly did not fetch the glossary or reconstruct the War-On-Ice polygons (`audits/nst-derived-stats.md:190`). Do not turn remembered wording into a validated external specification. Obtain an archived/approved reference and pin coordinates, zone boundaries, exact timestamp inclusion, allowed event sources, ownership and blocked-shot coordinates. **Exclude faceoffs** per owner decision 8; D5's “any event” is too broad.

The proposed “90% player-games exact” is an example, not an owner-approved tolerance and not sufficient by itself: shared wrong events generate many correlated per-player matches. Test event-level classifications, goalie shot-on-goal versus skater attempt populations, strength and score splits, and directional aggregate bias, then compare held-out games. Fix underlying definitions; do not tune arbitrary polygons solely to fit six games.

D9's teammate-block suppression is supported by the unconditional block increment at `nhlNstParityMetrics.ts:1391-1395`. The source feed's reason/ownership assertions remain original sample claims until the retained scalar fixture is provided.

### R4. D6 must follow the newer 5v5 decision

The UI sends `LW`/`RW` and normalizes L→LW/R→RW (`PlayerRadarChart.tsx:214-225,362-366`), while `fetchNstRadarSeason` forwards the filter directly to WGO (`radarSeasonStats.ts:154-159`). A source using L/R is therefore mishandled exactly as claimed. The actual season population counts are original-audit observations, not re-read here.

Current NST radar views are all-strength at `radarSeasonStats.ts:5-9,11,38,45`; owner decision 15 supersedes D6's “say all situations” and the open owner question. Moving to 5v5 must change **both the player's value and the comparison cohort**, with the same exposure minimum and season. Individual `ihdcf_per_60` still sits behind `hdcf_per_60` (`:63-64`), so label/source reconciliation remains necessary. Player/cohort minimum asymmetry is reproduced above; ranking is `betterCount+1` against `values.length` (`PlayerRadarChart.tsx:428`), so a player excluded from the eligible cohort can rank N+1 of N.

Unpaginated reads are a resilience risk (`radarSeasonStats.ts:149,154-159`), not a verified production truncation: the hosted row cap was not read by either review.

### R5. Replace D10 with owner decision 14, and preserve SQL uncertainty

`canUseNstSemiBurst` allows plans through 78 (`nstRateLimitPolicy.ts:120-124`), as do the TS gate (`sharedAdmission.ts:78-80`) and Python gate (`functions/lib/nst_admission.py:183-185`). But two admitted waves under a global limiter are not an instantaneous 78-request burst. The audit itself states that no observed admitted sequence broke a rolling window.

The later owner decision identifies the unresolved requirement: every caller must respect the post-burst pause, and a second burst must be followed by a full 300-second pause, including resumed jobs. Preserve that corrected scope across SQL, TS, Python and resumable callers. Do not restore the old audit's claim as the release rationale. The decision text also asks for 40-or-more plan pacing, while describing 78 as mostly compliant; implementation should distinguish complete-plan eligibility from two separately permitted waves and record that interpretation explicitly.

A full replacement budget-function body **is** present in `supabase/migrations/20261109015836_nst_admission_post_burst_gap.sql:22-75`. Therefore “the function is in none [of the migrations] today” is too broad. This migration depends on a prior shared-admission installation and is labelled **DRAFT, NOT APPLIED** at line 1. Its presence is not proof of current deployed SQL. It shows a 60-second cooldown (`:50-52`) and the four caps (`:56-63`), not a persistent 300-second post-double-burst condition. No catalog read or SQL execution was performed here.

### R6. Qualify M-NST-019 with its real production adapter

The pure helper has the reported 14-day window and 13:00 UTC gate (`goalieFreshness.ts:46-61,101-108`). But production calls `readGoalieFreshness`, which merges durable checkpoint state: critical overrides the helper, warning can override healthy/not-due, and unavailable progress turns healthy/not-due into unknown (`goalieFreshness.server.ts:63-73`). `readGoalieCheckpointProgress` explicitly escalates review-required/two-window-stalled work (`:24-36`). The existing test at `goalieFreshness.server.test.ts:95-103` proves escalation even with complete all-counts coverage; it passed in this review.

Thus a gap aging beyond the rolling window is not enough to prove the production report becomes healthy. Establish whether that gap remains represented in a durable cohort and whether progress configuration is enabled/known. Conversely, a finite-window freshness measure is not an all-history completeness guarantee. Label that distinction. Zero expected appearances with complete evidence of no due games is not itself an error; missing source coverage is separately rejected. Off-season production is explicitly not-due (`goalieFreshness.server.ts:56`).

### R7. D15 is an efficiency tradeoff, not permission to weaken accounting

The planner reserves up to three attempts per unit, six units per paced step or twenty per burst, under a daily 60-attempt reservation cap (`goalieCatchup.ts:11-14,236-240`). Full successful paced steps can consume reservations 18+18+18+6 and process 24 units; a 20-unit burst can reserve all 60. This supports the nominal inefficiency calculation, not a guaranteed production completion time.

The executor deliberately requires `attemptsCharged===attemptsReserved` and `unusedReleased===0` (`goalieCatchup.server.ts:227-230`), and preserves uncertain claims (`:185-186`). Do not “refund on finish” generically. Refund only provably unused attempts after acknowledged settlement under an explicitly reviewed durable-accounting contract. Retain tests for uncertain source outcomes, claim acknowledgement, timeout and settlement. Network/shared-ledger waits and retries mean “six days” is a no-failure planning estimate, not an SLA.

### R8. Evidence standards for the fix plan

- Keep the original sample sizes attached to every quoted magnitude: six games, 216 skater-games, 13 goalie-games. Those observations are highly correlated within games. They do not establish league-wide percentages or confidence intervals.
- Request the original sample runner, scalar inputs or a bounded reproducible extraction specification, exact revisions, normalization rules and per-comparison outputs. Do not re-fetch production indiscriminately to reconstruct undocumented scratch work.
- D8's penalty-expiry diagnosis is plausible from event-to-event segments (`nhlNstParityMetrics.ts:588-652`), but “PP seconds equal penalty time served” needs a carefully specified fixture: coincidental penalties, misconducts, early goal termination, double-minor halves, overlapping penalties, delayed calls and overtime manpower transitions make raw penalty durations an invalid universal oracle.
- D11's nonblocking on-ice/TOI exceptions are confirmed (`nhlXgValidation.ts:580-598`); current validation script selections omit xG/danger/percentages (`run-nhl-xg-release-validation.ts:47-91`). Proposed ±1 count and ±2 seconds are candidate tolerances, not validated policy. Prefer narrow versioned exceptions over globally whitelisting a family, and verify the correct event universe and unit adapters first.
- PDO may be represented consistently as 1.000 or 100. A 100× difference across storage contracts is a unit-adapter risk, not a different mathematical statistic. Avoid changing public scaling without tracing actual consumers; the landing server recomputes its own percentages.

## Per-entry disposition

“Retain” means the audit's central claim is supported at the inspected code boundary; it does not independently verify the audit's real-data magnitude or all consumers. “Conditional” identifies an unproven exact-parity/live-behavior claim. This table covers all 34 inventory IDs without presenting a partial re-audit as a new certification.

| M-NST ID | Peer-review disposition | Decisive evidence / qualification |
|---|---|---|
| 001 | Retain with unit qualification | `nhlNstParityMetrics.ts:427-435,1621-1674`; ratio formulas valid, PDO scale needs adapter contract |
| 002 | Retain | `:1391-1395`; any blocked-shot gets player block credit; reported teammate-block prevalence not remeasured |
| 003 | Confirmed defect | `:1357-1367`; MIN4, MIS10 and PS0 fixtures reproduce wrong categories |
| 004 | Confirmed definition mismatch | `:399-425`; exact NST geometry and effect size remain unverified |
| 005 | Confirmed defect | `:407-419,1337-1347`; actual fixture proves outcome floor and blocked-shot xG |
| 006 | Retain; update remedy | `radarSeasonStats.ts:11,63-64,94-98,149-159,185-190`; 5v5 owner decision and sample-gate correction apply |
| 007 | Retain arithmetic only | `nhlNstParityMetrics.ts:432-435,1678-1749`; correct events×3600/seconds cannot cure bad numerator/exposure |
| 008 | Retain mechanism | `nhlScoreState.ts:138-190`; running pre-event score correct in inspected flow; use for D1 |
| 009 | Retain proxy-label concern | `nhlContextualFeatures.ts:277-300`; side crossing is not observed pass tracking |
| 010 | Retain look-ahead concern | `nhlFlurries.ts:211-240`; completed sequence marks first shot; harmless as retrospective annotation, unsuitable as a prospective xG feature |
| 011 | Retain proxy/zone concern | `nhlPossessionChains.ts:123-129,197-220`; event ownership is not continuous puck possession; feed zone facts conditional |
| 012 | Retain arithmetic; conditional inputs | `nhlPriorEventContext.ts:21-38,93-106`; raw-distance formula sound, precomputed event timing remains a dependency |
| 013 | Conditional exact NST parity | `nhlRebounds.ts:194-207`; immediate previous same-team eligible attempt within 3 s; any intervening event breaks it; exact NST source contract not independently established |
| 014 | Confirmed owner-contract defect | `nhlRush.ts:5,91-120`; 10 s and faceoff sources conflict with 4 s/no-faceoff decision |
| 015 | Retain normalization only | `nhlCoordinates.ts:37-88`; angle/behind-net limitations belong with xG overlap, not an unconditional geometry clearance |
| 016 | Retain boundary concern | `nhlNstParityMetrics.ts:588-652,926-984`; no penalty-expiry boundary unless represented by next event |
| 017 | Retain latent defect | `usePlayerStats.ts:295-299,330-350`; truthiness loses genuine zero; no source importers found in bounded source search |
| 018 | Retain efficiency concern, qualify fix | `goalieCatchup.ts:236-240`; fail-closed reservations must survive uncertain execution; R7 |
| 019 | Revise end-to-end conclusion | Helper limits real, production checkpoint escalation omitted by audit; R6 |
| 020 | Confirmed GSAA contract defect | `nhlNstParityMetrics.ts:1780-1781`; served payload same formula; R2 |
| 021 | Retain | `nhlNstParityMetrics.ts:1406-1466`; basic event increments direct, chance families inherit wedge; sample parity not independently certified |
| 022 | Confirmed denominator defect | `:1665-1672`; 2O/1D/1N fixture gives 50 instead of 66.6667 |
| 023 | Retain arithmetic only | `:1605`; points/on-ice GF; attribution and own-goal denominators remain dependencies |
| 024 | Retain single-game mechanism | `nhlOnIceAttribution.ts:48-88`; boundary choice inherited from stints; exact NST agreement conditional |
| 025 | Confirmed detection gap | `nhlEventInclusion.ts:33,54-99`; 1010 synthetic shot missed; real encoding coverage needs fixtures |
| 026 | Retain parser mechanism, not stored path | `nhlPlayByPlayParser.ts:188-266`; stored reconstruction is separate, as original audit notes |
| 027 | Superseded rationale | Current local TS/Python 78-plan eligibility confirmed; use later owner cooldown decisions and distinguish deployed SQL uncertainty; R5 |
| 028 | Confirmed defect | Nullable score / disjoint one-goal logic, reproduced; R1 |
| 029 | Retain normal single-game mechanism | `nhlShiftStints.ts:84-152,195-286`; tests pass; does not prove real chart precision or every cross-game use |
| 030 | Retain classification concern | `nhlMissReasons.ts:36-48`; `short`→short-side and above-crossbar→crossbar mechanically confirmed; exact reason meanings need source dictionary |
| 031 | Retain integration concern | `playerStatsLandingServer.ts:1073-1092`, `nhlShotFeatureBuilder.ts:410-490`; builder feeds heuristic parity without trained score |
| 032 | Retain explicit split convention | `nhlStrengthState.ts`, parity split conditions; focused tests pass; EN convention must stay visible |
| 033 | Retain arithmetic | `percentUnits.ts:107-140`; ratio of sums, exposure and missing-value checks sound in inspected helper; callers' date/playoff behavior not reaudited |
| 034 | Confirmed gate limitation | `nhlXgValidation.ts:580-598`, script `:47-91`; broad exceptions cannot prove NST parity |

## Limits and next handoff

No external glossary, NHL rulebook, hosted database, current deployment, environment value, or live UI was read. No original six-game audit output was available in the named deliverable directory. No code, database, provider configuration, or deployment was changed. Existing unrelated working-tree changes were preserved. The SQL file's draft marker and the later owner report of deployed behavior are recorded as different evidence sources, not silently reconciled.

Next step is to incorporate these corrections into the consolidated fix plan, attach reproducible evidence for the original measurements, and coordinate xG and underlying-summary overlaps. This review does not authorize implementation, provider traffic, SQL apply, backfills or deployment.
