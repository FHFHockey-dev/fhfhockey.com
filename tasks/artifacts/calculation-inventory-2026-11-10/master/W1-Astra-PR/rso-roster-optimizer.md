# W1-11 RSO / roster optimizer: independent peer review

2026-11-11. Review of Fable's audit commit `bc60b18a64`, on the canonical `octoberBranch` checkout. Source first inspected at `5ae1037cc4155acf586564187cddc4390bf99f90`; while this review ran, the documentation-only W1-7 and W1-12 audits landed, reaching `fbceea028f71737b2d55745b9556f96ebe1d26aa`. The RSO optimizer, data and component directories had **no diff from bc60b18a6** when checked. Paths below are relative to `web/`, unless explicitly prefixed otherwise.

This is an addendum to [Fable's audit](../audits/rso-roster-optimizer.md), not an edit of it. Read with the [owner decisions](../OWNER-DECISIONS.md), [Batch A consolidation](../BATCH-A-CONSOLIDATED.md), W1-11 brief/packet, W1-5 and W1-8 Astra reviews, and W1-6/7 FORGE audits. Only this review file was written in the repository. No application changes, DB queries, provider calls, application/production requests, deployment, push, dependency installation or browser session occurred.

## Assessment

**Keep C13, C14, C15 and the chain/bench defects. Add the missing conservation, sorting, incomplete-goalie-group and reserve-selection defects. Narrow several claims before using the audit as an implementation plan.**

The highest-impact original findings reproduce in actual current code on isolated fixtures:

- Raw recent form makes the chain choose **+2 projected FPts instead of +4**.
- An unprojected roster player is automatically included as a proposed drop. This is a **proposal**, not an executed Yahoo transaction.
- Three allowed adds can produce **+8.5**, versus **+10** with one add.
- A started, locked skater plus a later benched skater makes the returned bench explanation revoke comparison eligibility. The plan still has `objective="outcome"` and its numeric total; it is not recomputed as an AGP plan.

Additional or materially strengthened findings:

1. **Goalie re-aiming breaks `SA = SV + GA`** by scaling saves with shots and GA with a different factor (PR1).
2. **The provider override can scale known goalie mass past an absent goalie**, despite M-RSO-021's sound verdict (PR2).
3. **Streaming near-tie ordering is non-transitive** and changes the selected streamer when identical candidate records are permuted (PR3).
4. **Healthy-reserve selection can pick the wrong joint activation**, not just show non-additive individual gains (PR4).
5. **The positional tilt does not conserve totals after independent clamps**, and W1-6's source-tilt division concern was omitted here (PR5).
6. **Midnight conversion can return the previous local date** in accepted IANA zones (PR6).

These are source/fixture-confirmed mechanisms in live-capable paths, not measurements of current production incidence. No new live P0 magnitude is established. Fable's 36/16/7/1 counts should not be repeated as independently certified counts: at least 009, 021, 022 and 055 need substantive revision, while several “mis-specified” entries are deliberate policy choices or labeling/validation questions rather than demonstrated arithmetic defects.

### Evidence boundaries and coordination

- Executed: actual source functions bundled or AST-extracted using installed repository tools; fictional inputs only. Planner fixtures reuse the repository's synthetic single-target review contract, injected in memory. This tests mechanics, **not production forecast admission**. Network transports were blocked in the bundled harness.
- Executed: 500 independently generated single-day matching instances, seed 20261111, 1–7 skaters, five slot profiles and signed additive scores −2…5. DUST and planner AGP matched exhaustive cardinality-then-value search; points mode matched exhaustive value maximization. **Zero mismatches**. This does not certify weekly/category/goalie-minimum optimization or every possible numeric input.
- Reported only: Fable's 2026-11-11 DB samples, 101/673 missing-line count, 568-start W/L/OTL sample, model calibration statistics, 4,000/60,000 original assignment trials, 20,000 DUST trials, and 305,140 timezone checks. No production extracts were reread. The scratch TS fixture scripts still existed locally and were inspected; the new executions described here are separately identified.
- Known release coordination was supplied by the parent: the RSO points/readiness release at `3c03df7dc` has public checks, but private Yahoo acceptance remains open. This review did not reverify that deployment and does not turn public release checks or these synthetic passes into private-beta acceptance.
- Existing unrelated working-tree changes and concurrent audit work were preserved. No RSO implementation was changed or requested as a side effect of the review.

## Additional defects and strengthened findings

### PR1 · Re-aimed goalie components no longer reconcile

**M-RSO-017; P1, user-visible arithmetic when re-aiming is active.**

`lib/rosterScheduleData/forgeDailyBridge.ts:200-206` computes separate shots and GA multipliers, then multiplies **both saves and shots against** by the shots multiplier. Consequently:

`SV' + GA' − SA' = GA × (GA_multiplier − SA_multiplier)`

for an initially coherent line. The error survives multiplication by start probability (`:635-636`). The caller uses this helper when source and destination context exist (`:618-622`), so this is conditional on re-aiming, not on every exact-game forecast.

**Executed actual helper:** initial SA=30, SV=27, GA=3; source adjustments all zero; destination shots adjustment +0.10, GA adjustment +0.20; no venue change. Output SA=33, SV=29.7, GA=3.6, hence **SV+GA=33.3**. Correct reconciliation of those same SA/GA targets gives SV=29.4. These are synthetic sensitivity inputs, not a claim that those exact adjustment extremes are produced on a live game. Any unequal nonzero multipliers cause the same defect. A second execution used the actual context helper with own/opponent xGA totals 140 each, xGA/G=2.95 for both, own xGF/G=2.95, source opponent xGF/G=2.95 and destination opponent xGF/G=3.54. It produces shots adjustment 0.072 and GA adjustment 0.056, both within current clamps; the retargeted line is SA=32.16, SV=28.944, GA=3.168, with **SV+GA−SA=−0.048**. Thus the mechanism is reachable through the present adjustment formula, not only through out-of-range sensitivity inputs.

**Remedy:** choose coherent nonnegative SA and GA (or SA and save rate), derive SV=SA−GA, then apply participation and round consistently. Validate GA≤SA rather than silently issuing impossible lines. Cover the conditional and unconditional bridge, provider override, ratio categories and ledger readers. Test the identity within declared rounding tolerance after opponent/rest/venue re-aiming, participation multiplication and transport round-trip.

Fable's separate shutout observation is real: dividing a zero-count probability by the GA multiplier is an approximation, not the Poisson transformation. `p^r` is correct **only when p=exp(−λ), r scales that same λ, and no extra shutout/participation factor is folded into p**. A goalie mixture generally needs each component re-aimed and remixed; do not apply `p^r` to a mixture and call it exact.

### PR2 · Provider override loses an absent goalie's unknown mass

**M-RSO-021; change Sound to Wrong for incomplete groups. P1.**

`lib/rosterScheduleOptimizer/providerGoalieStarts.ts:40-62` checks that **existing forecast rows** have probabilities and conditional stats. It never establishes that every goalie in the team catalog has a forecast in that group. The “not starting” branch divides surviving rows by their known total and can turn a partial forecast group into certainty.

**Executed actual function:** team catalog has A, B and Unknown. Only A and B have bridge rows, with probabilities 0.6 and 0.2 and per-start saves 30. Yahoo marks B not starting; Unknown has no forecast row. Output A=**1.0, 30 saves**, B=0, while Unknown remains absent. A's previous expected saves were 18. This demonstrates manufactured certainty, not a measured 67% production forecasting error. A missing row is distinct from an existing row with `startProbability=null`, which the current guard does reject.

Possible incomplete groups must be traced through withholding/trimming/missing source coverage; this review does not claim a currently served example. The bridge itself explicitly preserves unknown mass (`forgeDailyBridge.ts:573-584`), so the later provider step must retain that contract too.

**Remedy/test:** establish a complete team-game candidate universe before normalization, or carry an explicit unknown bucket and update it consistently. A confirmed named starter may resolve mass; a “not starting” mark alone does not prove which unobserved teammate starts. Test missing row, null row, withheld reserve row, complete two-goalie roster, confirmed starter and contradictory marks. Do not merely test `rows.every(...)`.

### PR3 · Streaming near-tie comparator cycles

**M-RSO-007/060; independent of the fixed 50/50 blend. P1.**

`lib/rosterScheduleOptimizer/streamingChain.ts:73-81` orders materially different scores by score but near ties by recent form, games and waiver state. Pairwise closeness is not an equivalence relation.

**Executed actual comparator:** equal games, all free agents; `(score, recent FPts/G)` for A=(1.000,3), B=(1.075,2), C=(1.150,1). With `NEAR_TIE=0.1`, A precedes B, B precedes C, but C precedes A. Sorting inputs ABC/BCA/CAB yields ABC/BCA/CAB, respectively. Actual chain executions with positive projections 17/18.15/19.3 and forms 3/2/1 likewise choose A/B/C after permuting those same candidate records. This fixture's idle-only baseline has unknown net points; its selected blended totals are 10/10.075/10.15. The ordering mechanism does not depend on that baseline gap.

**Remedy:** use a transitive total order. If near-tie preferences are retained, create deterministic groups/buckets once from a fixed sorted reference, then apply secondary rules within each group, or retain exact score ordering and show “close” only as display context. Test comparator transitivity/antisymmetry and result invariance under candidate permutation, including waiver and missing-form cases. Merely removing form from the arithmetic does **not** repair a near-tie comparator that still switches ordering rules pairwise.

### PR4 · Healthy-reserve selector optimizes the sum of isolated gains, not the joint lineup

**M-RSO-022; strengthen Mis-specified to Wrong for the “best” activation claim. P1.**

`lib/rosterScheduleOptimizer/healthyReserves.ts:60-86` removes all flagged reserves, then prices each activation alone. The selection search adds those isolated gains (`:92-112`), even when players compete for the same active slot. `components/RosterScheduleOptimizer/HealthyReserveAlert.tsx:21-30` calls the chosen feasible subset “best”.

**Executed actual helper and evaluator:** three healthy IR players, single game each, values C-A=6, C-B=5, D=4; slots C=1, D=1, IR=3; two non-reserve roster places free. The selector picks A+B, reporting isolated gains +6 and +5, and excludes D. Evaluating both activations jointly gives **6 points and one start**. A+D gives **10 points and two starts**. Both combinations are legal and activate two players, so this is not explained by its first-priority activation count.

**Remedy/test:** evaluate complete activation combinations with the real lineup evaluator, or explicitly downgrade the subset-selection claim to a heuristic and label each number “if activated alone”. With only a few reserve slots, a bounded joint search is practical. Keep swap-partner/bench-capacity uniqueness, weekly locks and unknowns explicit. Test the 6/5/4 fixture, two simultaneous swaps and non-additivity when gains share a slot. Individual figures must not be summed into a portfolio gain.

### PR5 · Positional tilt: two distinct problems

**M-RSO-009/013; P1 re-aiming contract review and P2 conservation defect.**

**A. Missing W1-6 handoff, with the W1-6 peer-review qualification.** `forgeDailyBridge.ts:351-354,509-513` divides destination positional tilt by source positional tilt. W1-6 M-FRG-001/D19 reports that FORGE did not explicitly apply that source positional factor. The ratio and its 0.8545/1.15=0.743 arithmetic are confirmed, but calling 0.8545 the uniquely correct replacement requires a neutral-versus-source-conditioned contract. An opponent-specific base line can intentionally be transported using an approximate relative model even without the identical upstream coefficient. This is an omitted modeling/lineage question, not an independently established universal formula defect.

Use destination-only multiplication only after establishing that the input is neutral on this dimension; otherwise define and validate the relative source-to-destination approximation. Carry provenance for source adjustments so later upstream fixes cannot apply/remove them twice. Exact-game, re-aimed, reserve and no-line conditional paths need lineage, same-opponent and round-trip tests; identity A→A alone does not validate the model. This agrees with the completed W1-6 Astra review's D19 qualification.

**B. “Mirror keeps team total at 1” is false after clamping.** `forgeDailyBridge.ts:146-153` clamps forward and defense factors independently. Without clamps, conservation holds at the reference F:D share when the shrinkage weights match; after one side clips it fails. It also does not automatically hold at an actual team's different projected position mix.

**Executed actual `opponentTilts`:** two synthetic opponents with defense shares 0.4 and 0.0, 30 games each, giving reference D share 0.2. For the first opponent, D factor=1.15, F factor=0.875. Weighted total is **0.2×1.15 + 0.8×0.875 = 0.93**, not 1. Both points and shots reproduce it.

**Remedy/test:** if the contract is redistribution only, jointly constrain the factors using the declared exposure/mix and preserve the weighted total while respecting the bounds. If the intended contract allows total changes, correct the comment/label and validate the resulting effect rather than claiming conservation. Test clamp-triggering cases, zero/degenerate reference shares and both reference and actual projected mixtures.

### PR6 · Midnight solver can cross the date boundary

**M-RSO-055; change universal Sound verdict to a supported-domain qualification / Wrong outside it. P2.**

`lib/rosterScheduleOptimizer/planningDates.ts:15-26` makes three offset-correction passes without round-trip validation. With a midnight clock gap it can oscillate and return a time on the preceding date. It feeds acquisition timing, weekly-period lookup and latest-equivalent action timing. `periodBoundaries.ts:14-36` has explicit gap/fold rejection, but callers of `zonedMidnight` do not use it.

**Executed actual function:**

- `2026-04-24`, `Africa/Cairo` → `2026-04-23T21:00:00.000Z`, which formats locally as **April 23, 23:00**.
- `2026-03-29`, `Asia/Beirut` → `2026-03-28T21:00:00.000Z`, locally **March 28, 23:00**.
- `2026-03-08`, `America/Havana` → March 8 at **01:00**, not midnight. That can be a reasonable first-valid-instant convention, but it is not a documented general disambiguation policy.

These are edge-zone fixtures, not an observed North American user incident. Define start-of-local-day behavior or reject nonexistent/ambiguous boundaries; validate round-trip/date membership. Cover ordinary US DST, midnight gaps/folds and skipped dates. A sample showing no failures for a subset of zones does not establish universal IANA correctness.

## Original principal findings: retain, but correct remedies and scope

### D1 / C13: raw recent form

Confirmed at `streamingChain.ts:187-190,328-336,361-368`, `recentForm.ts:25-41,49-65`, and the contradictory evidence text `lib/rosterScheduleData/planning.ts:384`. The form sample counts appearances, not team opportunities; it can contain goalie relief appearances, so it is not automatically a per-start mean. Fable's 2.2× relative-goalie example is conditional arithmetic with equal per-start form S, not measured forecast error.

**Executed fixture:** same two free-agent dates, one idle roster drop, one protected core; steady projects 2 with 10-game form 2; hot projects 1 with one-game form 4. Form on: hot, net projection +2, blended +5. Form absent: steady, net projection +4. The current UI does show both projected and blended totals (`StreamingItinerary.tsx:113`), so it is not simply hiding the ranking number; the methodological defect remains.

Corrections to the proposed fix/tests:

- A projection-only stopgap is consistent with the owner contract and avoids introducing an unfitted adjustment. If form remains a tie-break, fix PR3 too.
- First choose the estimand. An appearance-conditioned mean needs the matching appearance probability; a per-start mean needs start probability and a separate relief treatment if relief scoring is in scope. A form rate already unconditional per team opportunity must **not** be multiplied by participation a second time. Known nonappearances can be zeros; missing logs cannot.
- Sample shrinkage such as n/(n+k) is a candidate, not a validated optimal blend. Count the exposure relevant to that estimand and avoid double-counting recent evidence already in FORGE.
- **Delete the universal “one game cannot beat a 20% higher projection” test.** Any positive form weight can reverse such a gap for a sufficiently extreme observation. Test the selected formula and that smaller matched samples receive less weight; set any rank-movement cap only through an explicit product policy.
- The goalie rank-ratio invariant needs equal conditional projections, equal conditional form and equal reliability/weights, with no floors or other utilities. It is not universal across different sample sizes.
- W1-8's reported season-mean RMSE comparison is not a test of this L10 signal's **incremental** value given FORGE. Do not infer “adds almost nothing” causally from those standalone, differently conditioned proxies. Validate paired issued forecasts/residual additions on held-out dates.

### D2 / C15: no-line zeros and unknown drops

Confirmed: `forgeDailyBridge.ts:444-448,651-685` creates synthetic zero contributions; `:405-407` and `bridgeForecastWire.ts:63,78-89` allow assignment/totals/comparison; `planning.ts:1314-1318,1371-1374` supplies a finite active-games fallback to `retention.ts:77-88`.

**Executed fixture:** with core=3, low=0.2, zero=0 and an unprojected player, the order is unknown, low, zero, core. Streaming proposes add FA / drop unknown, with `netPoints=null`. Thus the proposal bypasses the owner's no-unknown-drop rule, but the emitted plan does not pretend its missing points are known. Existing tests deliberately allow hypothetical schedule swaps (`planning.test.ts:83-101`); that old behavior must be reconciled with the later owner decision rather than silently retained as proof of compliance.

Important qualifications:

- Not **every** missing line becomes zero: unknown heads/PP inputs, withheld newer runs, absent team anchors and expiry can leave no row (`forgeDailyBridge.ts:399-400,642-665`).
- The missing reserve table and 101/673 count are Fable's dated report, not a fresh verified cause for every current user's roster. The audit itself says the join does not resolve Yahoo mapping/trades/served rows. No population percentage or current coverage guarantee follows.
- A machine-readable reserve code already exists in the wire (`bridgeForecastWire.ts:32-47,78-89`); the internal forecast recovers it from limitation text. Honor/strengthen that provenance, rather than assuming no marker exists. Distinguish confirmed-out **real zero** from unknown participation/no-line placeholders.
- Applying a migration or rerunning FORGE alone is not a complete remedy: `emitReserve` still zeroes an unconfirmed reserve. Respect the existing persistence hold and reconcile prior writes before any separately authorized run.
- Merely making the second drop tier null whenever `playerAssignedPoints` is null is conservative but can exclude **all** players when one competing forecast makes the global comparison ineligible (`planning.ts:164-184`). Prefer a tested per-player evidence/unknown gate before proposal generation, shared by planner, Best Fit, streaming and DROP chip.
- Owner decision 3 plus Batch A already requires no-data, not a deceptively complete total. Show a supported subtotal if useful, but explicitly incomplete, with no unsupported quality ranking. The remaining UI choice does not authorize silently treating an unknown as zero.

### D3 / C14: goalie losses

Confirmed structural error at `forgeDailyBridge.ts:624-626`: W=team win×0.984, L=1−W. This assigns the no-decision mass to L even if a league counted overtime losses there, and it cannot satisfy the brief's W+L+OTL=decision-share contract. `recentForm.ts:11` reads `losses`, so different provider definitions would also create a blend mismatch.

The reported **0.377 versus 0.508, +35%** is a 568-start dated sample/comparator, conditional on regulation-loss semantics. The reviewed sources do not establish the current user's Yahoo definition, current deployed values, or a paired forecast-error estimate. Keep the question about provider L/OTL mapping, without asking it as though it could erase the conservation error. Recent form/settlement must use official outcomes and the corrected actual-start labels from W1-5.

Split W/L/OTL/no-decision under a coherent outcome model and map to the league's actual categories. The proposed factorization assumes particular conditional decision-share and OT-loss relationships; document and validate them. Do not present the observed 22% OT-loss fraction as a fitted universal constant. **Replace the fixed ±0.02 sample-mean test**: at p≈0.377 and n=568 the binomial standard error alone is about 0.0203. Use algebraic mass identities plus held-out calibration/reliability and uncertainty, not a one-standard-error pass/fail rule.

Keep the team-slot mixture warning. It is not double-discounting simply because its weights sum to one, but the mixture is not that named goalie's own conditional line. W1-6/7 own that upstream identity issue; every bridge/API/ledger reader needs the same basis.

### D4: live-game bench explanations

Confirmed at `planning.ts:1038-1072`, `benchDecisions.ts:97-102,148-154`. Started rows have no remaining-play value but are included among removed rows in the forced skater delta.

**Executed fixture:** C+UTIL, three rostered skaters valued 2/3/1, each scheduled on two dates. Before the first starts: comparison true, mode quality, value 10. With the first skater's game at 13:00 before the 14:00 read, locked C#1: comparison false, mode schedule_capacity, value **8**, bench reason decision_unresolved. `planRoster` still returns `objective="outcome"`.

The trigger needs a relevant held/started skater and a bench placement in the affected scope; a live game elsewhere, a goalie-only live row, no benched skater or an AGP-only evaluation is not sufficient. The search/streaming evaluators use `includeBenchEvidence=false` and are built before returned-plan explanations (`planning.ts:1349-1358,1443,1526-1572`). Do not describe the defect as universally changing the optimizer objective or erasing all numeric totals.

Preserve held rows/occupied slots and subtract only changeable rows. Test both explicit and inferred locks, held-out injuries, weekly windows, no bench competitor and a live game unrelated to the roster. Check both comparison eligibility and unchanged locked assignments.

### D5: chain DP / horizon-end behavior

Confirmed at `streamingChain.ts:253-294`. Window values assume each window's top player; deduplication substitutes a different player after window choice. Certification correctly recalculates the resulting chain, but the better feasible chain was not offered to certification.

**Executed fixture:** protected core, idle drop; A plays Mon/Fri for 5 each, B Tue/Wed/Thu for 1 each, D Fri for 0.5. Budget 1 selects A, +10. Budget 3 selects A→B→D, +8.5. These are exact synthetic results, not population loss rates.

Include player identity/reacquisition constraints in search state or retain/evaluate feasible alternatives before pruning. “Rerun until deduplication is stable” has no stated convergence or optimality guarantee. A certified best-single-streamer floor fixes this example, but **does not guarantee all k→k+1 monotonicity** if larger bounded searches discard better k-add incumbents. Preserve previous-budget candidates under a fixed ranking objective if making that guarantee. Compare the declared objective, including goalie coverage, not only net points across policy changes.

The last-day drop example is a terminal-horizon preference question, not a mathematical error in the selected-week objective. Crucially, the gated later-impact scenario is explicitly **informational only, never used for ranking/pruning** (`futureImpact.ts:224-227`). Enabling it would not automatically price future retention in chain optimization, and silently doing so would violate its contract. Any longer-horizon retention policy is a separate decision.

### D6: goalie start chances

Retain the unvalidated raw-share and non-starter-conditioned B2B concerns (`forgeDailyBridge.ts:340,565-607`). Narrow the headline: the 0.55 B2B adjustment applies only when **no exact FORGE row** exists, there is a second-night context and more than one known candidate (`:588`); accepted news can override it afterward. It does not affect every B2B forecast.

The 90%-bin/60% and 8.7% rates are W1-5 reported samples with the actual-start/outcome and timing limitations already identified by Astra. They cannot be used as repaired truth or hardcoded replacement probabilities. Conditional-on-yesterday's-starter behavior is a valid modeling need; fit it after official starts, complete opportunity populations and as-of cutoffs are corrected. Keep unknown mass, and include the provider reader in PR2 in the same fix plan.

### Coordinated W1-12 source defects affecting RSO historical inputs

The fantasy-scoring reviewer independently executed `lib/integrations/yahoo/rosterPlanning.ts` functions with an in-memory query stub and owns the detailed reproductions in `W1-Astra-PR/fantasy-scoring.md`, R2. This is **worker-reproduced, not rerun here**: historical points use the current team at `:52,74`; a traded player's old-team two-goal game can become zero instead of six fantasy points. Historical goalie appearances use current team at `:118-119`; an old-team appearance can be skipped. Separately, an unrelated row in the same final game is treated as sufficient completeness evidence for missing-player zero points (`:78-81`) or zero appearances (`:130-134`). These are conditional-input defects, not measured live incidence. They qualify the otherwise-sound RSO aggregation in M004 and credited-goalie-minimum inputs in M019/020: arithmetic cannot repair false historical zeros. Keep the reader fixes together without duplicating ownership or assuming a missing outcome is a nonappearance.

## Entry-by-entry disposition

“Retain” means no additional contradiction found in the bounded source review, **not** a blanket production/model-validation certificate. “Qualify” identifies a scope, evidence or intended-contract limit. This ledger covers all 60 entries; references point to current source and the detailed sections above.

| M-RSO | Review disposition and evidence |
|---|---|
| 001 | Wrong, reproduced; D4 narrows the trigger and consequences. `planning.ts:1038-1072`; `benchDecisions.ts:148-154`. |
| 002 | Retain ledger arithmetic/explicit states. It is readback, not an independent optimizer; unknown/zero behavior is inherited. `contributionLedger.ts:46-99`. |
| 003 | Qualify. `optimizer.ts:249-263,284-293,346-362` counts a multi-position player in each eligibility bucket and divides utilization by supplied schedule dates. Those are overlapping congestion buckets and schedule-date utilization, not automatically wrong numbers. Label denominators/non-additivity; no evidence that fields promise a partition or “only roster game days”. Fable's 9-versus-6 sample not rerun. |
| 004 | Retain aggregation/cancellation of common realized totals. `planning.ts:892-945`. Full-lineup unknown gates remain essential. |
| 005 | Retain transitive candidate-plan comparator/grouped ownership tie-break. `candidatePlanMetrics.ts:39-68`. Do not conflate it with the separate cyclic streaming comparator, PR3. |
| 006 | Confirm different baselines, qualify “overstatement”. `candidatePlanMetrics.ts:96-100,170,198` really measures change from the chosen points no-move lineup. Capacity-minus-capacity isolates acquisition effect; capacity-minus-points includes lineup-management effect. Choose/label the estimand rather than assume any numerical difference is false. Negative-valued starts can legitimately be omitted; zero ties need not always be omitted. Fable's 770/4,000 count is reported only. |
| 007 | Wrong; D1 and PR3. |
| 008 | Qualify. Override at `planning.ts:1097` applies **only to two AGP plans**, not category-outcome plans. More starts outranking a worse ratio can be the explicitly selected “most starts” objective. `categoryRelation(:66-78)` itself is a genuine partial order. Do not remove AGP priority without deciding its contract; if the frontier claims category dominance, expose the ratio sacrifice and avoid calling it Pareto-dominant. |
| 009 | Revise Sound; clamped “mirror” fails conservation, PR5. |
| 010 | Retain algebra as a truncated/clamped heuristic baseline, not empirical validation. It is live-capable in `pages/api/v1/db/forge-served-forecast-snapshot.ts:92-93`. The **current docstring already says this** (`forgeDailyBridge.ts:185-187`); fix stale packet language, not an already-correct docstring. |
| 011 | Retain declared pseudo-game/goal arithmetic, not validation of constants. `forgeDailyBridge.ts:219-249`; zero FO prior means no shrinkage. |
| 012 | Retain explicit no-PP-role modeled-zero policy. `forgeDailyBridge.ts:257-262`. This supported zero is not the same as C15's no-line unknown. |
| 013 | Retain re-aiming/modeling concern, add source-factor provenance question PR5. `forgeDailyBridge.ts:171-184,351-354,509-513`. Using a goals term for shots is a heuristic needing validation, not proof that a particular alternative term is correct. |
| 014 | Wrong against current owner intent, D2; conditional source/withholding exceptions retained. |
| 015 | Retain coherent pseudo-count dimensions, qualify source comparability. `forgeDailyBridge.ts:91-120`. Mixed NST/current-source inputs require matched definitions; arithmetic is not empirical calibration. |
| 016 | Dormant contract/data gap retained. `futureImpact.ts:236-242,332`; `laterImpactInputs.ts:75-76,139`; lineup read columns at `forgeDailyBridge.ts:50-52` omit conditioning. Read actual stored semantics before adding a column/tag. Informational scenario must not silently become terminal ranking utility. |
| 017 | Wrong, D3 plus PR1. W/L/OTL mapping, mixture basis and component conservation are separate fixes. |
| 018 | Mis-specified/unvalidated model, D6; exact-game/news branches and unknown-mass preservation qualify impact. |
| 019 | Retain local-date weekday/coverage logic under its **date-only** goalie-period contract. `planning.ts:54-58,484-501`; schema `lib/in-season/workspaceSchema.ts:129-137` requires dates. Do not manufacture a UTC-instant bug using a period representation that transport rejects. |
| 020 | Retain expected-count-versus-certainty labeling issue. `planning.ts:953-971`; `StreamingItinerary.tsx:33-34` says “meets”. Two independent 0.5 chances give 0.75, but only under independence. See probability recommendation below. |
| 021 | Revise Sound: incomplete-group normalization defect, PR2. |
| 022 | Strengthen to Wrong for joint “best” activation, PR4; standalone numbers are individually valid counterfactuals. |
| 023 | Retain declared eligibility normalization/slot compatibility. `eligibility.ts:61-106`; tested indirectly in 500 assignments. Provider eligibility accuracy not reverified. |
| 024 | Retain gap/drop readback conditional on inputs. `lineupGaps.ts:45-118` cannot rescue a placeholder falsely marked as known zero. Fix C15 upstream and here. |
| 025 | Retain max-cardinality then max-value matcher for tested finite additive domain. `matching.ts:142-190`; 500 independent fixtures passed. No universal proof from finite fuzz counts. |
| 026 | Retain exact additive assignment with empty choices, and bounded refinement qualifications. `planning.ts:400-482`; `lib/projections/weightedAssignment.ts:2-41`. Same-objective comparison with DUST only. |
| 027 | Retain validated slot expansion. `slots.ts:28-80`. |
| 028 | Retain capacity matching, `streamingChain.ts:83-94,162-169`; it estimates capacity, not projected-value displacement or global chain optimality. |
| 029 | Retain effective-time timeline and acquisition-time costs. `planningTimeline.ts:13-65,134-158`. Unknown cost remains unverified; no claim of actual transaction execution. |
| 030 | Wrong against no-unknown-drop policy; D2. Category/schedule-only ranking needs an explicit exception if one is desired, not inferred permission. |
| 031 | Retain marginal bench-growth DUST arithmetic, `optimizer.ts:365-481`; Fable's 20,000 runs not rerun. Candidate DUST is not necessarily that candidate's own benched games. |
| 032 | Retain scale/translation-invariance concern for relative losses on zero-centered category sums. `recommendations.ts:62-86`. Need a defined value scale/absolute tolerance, not an arbitrary percentage near zero. |
| 033 | Retain documented count-and-rate gates, `risk.ts:20-41`; labels are heuristic, not probabilities. |
| 034 | Retain matching and separate per-position necessary-condition checks, `lib/rosterAutopsy/manual.ts:186-214`; “covered” position checks alone do not prove all joint slots fill. |
| 035 | Keep policy question for otherwise-supported schedule comparisons, `planning.ts:1146-1173`. Unknown/no-line **automatic drop proposals** already have owner decision 3; do not defer that settled restriction as if entirely undecided. |
| 036 | Retain bounded work quotas, `planning.ts:1176-1188`. Runtime controls are not math-optimality claims. |
| 037 | Retain representative/truncation caveat, `planning.ts:1195-1220`. Team+position grouping does not include injury/availability evidence; lowest-id representative need not have all others' usable opportunities. Alphabetical truncation is a disclosed search-coverage issue. |
| 038 | Retain “best found” beam semantics, `planning.ts:1356-1485,1503-1505`; no proof of global optimality. Separate from the repairable chain regression in 039. |
| 039 | Wrong DP/pick mismatch, D5. End-of-window retention is separate policy. |
| 040 | Retain label issue, `BenchDays.tsx:19-37`. The component initially filters to active/bench roster entries; reserve/off-roster states can still occur on their planned days. Not every original reserve is displayed. |
| 041 | Retain empirical cutoffs/tie behavior, `SlotWeekGrid.tsx:229-245`; ties do not require equal-sized groups. |
| 042 | Retain gross/net label distinction. `StreamingItinerary.tsx:11-20,94-113` explicitly marks override-adjusted totals as estimates pending replanning. Do not call those estimates certified additive lineup recalculations. |
| 043 | Confirm main planner shortlist has no value sorting, `planning.ts:1226-1240`, but this is a heuristic-quality limitation under a disclosed 40-player bound. Best Fit separately already sorts supported horizon value (`candidatePlanMetrics.ts:125-145`); do not conflate the two. |
| 044 | Retain symmetric max-absolute-total 5% **display** heuristic, `CategoryGains.tsx:29-43`; not statistical equivalence. |
| 045 | Retain guarded source selection, `lib/rosterScheduleData/planning.ts:213-231`; no fallback through a permission denial. Source selection does not validate the numerical bridge itself. |
| 046 | Retain bounded-transport/trimming limitation, `forgeDailyBridge.ts:686-698`; reserve rows are first withheld as a group before chronological truncation. Missing late rows must remain unknown; changing prioritization is a product improvement, not arithmetic proof of a bug. |
| 047 | Retain duplicate/conflict/target coverage handling, `planning.ts:29-48,329-398`, subject to input provenance and synthetic-zero fix. |
| 048 | Retain unknown-component contamination and guarded conditional tie-break, `planning.ts:427-467`; this is deliberate fail-closed quality behavior, not a defect because UTIL connects players. |
| 049 | Retain bounded local-search description, `planning.ts:505-623`; categories/coverage are not globally optimized by the additive matching proof. |
| 050 | Retain started-game occupancy/exclusion logic, `planning.ts:690-727`; missing provider locks are provisional/invalidated, not silently verified. D4 is a later bench-counterfactual error. |
| 051 | Retain source-read weekly aggregation, `planning.ts:761-834`; not independently brute-forced. No universal weekly optimality or provider-contract certificate. |
| 052 | Retain date/status dedupe and inclusive Yahoo-week mapping, `optimizer.ts:51-146`; `weeks.ts:17-45`. League season/game-key coverage remains an input issue. |
| 053 | Retain latest boundary minus one minute policy, `planning.ts:1246-1256`, conditional on correct local-day conversion; PR6 applies. |
| 054 | Retain witness-age admission, `planning.ts:625-636`; missing timestamps deliberately retain completeness-only legacy behavior. Matching constants alone are not a freshness guarantee. |
| 055 | Revise universal Sound; PR6 actual timezone counterexamples. |
| 056 | Retain descriptive hot/cold and staleness-label concern, `lib/rosterScheduleData/planning.ts:378-408`. Line-from-array-order is an input contract to verify, not proven wrong solely because it uses indices. |
| 057 | Retain refresh checks, re-spending and timeline validation, `reconciliation.ts:59-131`; suggested repairs require explicit acceptance. |
| 058 | **Do not call the present 72-hour rule an off-by-one defect.** `lib/rosterScheduleData/planning.ts:295-317` dates the daily observation at UTC midnight. At Nov 11 14:00, Nov 8 00:00 is 86 hours old and correctly fails ≤72h; Nov 9 is 62h old and passes. A desired three-calendar-day policy is a different contract. Clarify observation-time semantics rather than blindly extending the cutoff. |
| 059 | Retain consumer-only scope, `TeamScheduleContext.tsx:18-65,80`; its displayed Game Grid score/off-night conventions are not the roster optimizer objective. |
| 060 | Wrong raw-blend rank against current owner decision; D1/PR3. Certification proves offered-chain legality/totals, not that ranking/search found the best chain. |

### Other recommendations that need qualification

- **Minimum-success probability (020):** sum probabilities for mutually exclusive owned goalies within a team-game first. A Poisson-binomial model then assumes independent **team-game** starts, not independent goalies on the same team-game. Cross-game B2B rotation and shared availability can be dependent. Report independence as an approximation, or use a validated joint scenario model. “Expected starts ≥ minimum” is neither actual minimum satisfaction nor guaranteed success; `minimumSatisfied` already separately tracks credited completion.
- **Category priority (008):** the user's “most starts” objective is distinct from Pareto category dominance. Preserve the selected priority while reporting ratio sacrifices; do not implement an unqualified rule that one more start may never outrank a worse ratio.
- **Healthy-reserve labels (022):** merely adding “alone” does not fix the current claim that the selected subset is best. PR4 requires joint evaluation or an explicitly weaker recommendation claim.
- **Assigner done-criterion:** distinguish exact single-day additive matching from bounded category/minimum refinement, weekly aggregation and heuristic acquisition search. Agreement on 500, 4,000 or 60,000 generated cases is evidence, not a mathematical proof of every surrounding engine path.

## Reproduction manifest and limits

All new scratch work is isolated at `/tmp/w1-astra-rso-20261111/` on the selected Mac. It is not part of a release candidate. No existing Fable script was modified. Installed `esbuild`/TypeScript were used, with no package downloads. Warning output from the environment's experimental proxy agent was not a network request; no transport was allowed by the execution harness.

- `fixture.ts`: copied only the synthetic fixture builder/contract from `lib/rosterScheduleOptimizer/streamingChain.test.ts` before its test cases. Imports point to current source; policy substitution is in the bundle's memory only. Default week Oct 26–Nov 1, 2026; America/New_York; same-day acquisition; scoring GOALS×1 as an artificial additive points axis.
- `build.cjs`: bundles a named scratch fixture using `web/tsconfig.json`; blocks fetch/http/https/net/tls transports before requiring it. No application loader or DB/provider routine is invoked.
- `run.ts`: D1, D2, D4 and D5 reproductions, with the input values stated above. One exploratory zero-valued candidate fixture returned equal AGP/outcome baseline counts; this is why this review does **not** claim zero always means unstarted in M006.
- `extract.cjs`: uses the TypeScript AST to extract the actual `opponentTilts`, `retargetGoalieLine`, `rankOptions` and `computeTeamStrengthContextAdjustment` declarations into isolated VM contexts with their literal constants/helpers. Runs PR1, PR3 comparator and PR5B cases. No imports or external effects.
- `extra.ts`: actual provider override, timezone and end-to-end chain permutation cases, as specified above.
- `reserves.ts`: actual 6/5/4 healthy-reserve subset fixture, with `realized={GOALS:0}`, healthy Yahoo fixture evidence, C/D/IR slots and legal joint re-evaluation.
- `assignment.ts`: 500 seeded exhaustive checks. Uses independently enumerated slot/player assignments; compares cardinality/value objectives separately, never demands identical tie assignments or equal cardinality from points mode.

Re-run commands from the same checkout, if retained scratch files are available:

```sh
node /tmp/w1-astra-rso-20261111/build.cjs /tmp/w1-astra-rso-20261111/run.ts
node /tmp/w1-astra-rso-20261111/extract.cjs
node /tmp/w1-astra-rso-20261111/build.cjs /tmp/w1-astra-rso-20261111/extra.ts
node /tmp/w1-astra-rso-20261111/build.cjs /tmp/w1-astra-rso-20261111/reserves.ts
node /tmp/w1-astra-rso-20261111/build.cjs /tmp/w1-astra-rso-20261111/assignment.ts
```

Source hashes captured by the extraction harness:

- `forgeDailyBridge.ts`: `de79f08c77e21b0b548894e63885cc1b481510a281f27eaa97f526101cbd3f55`
- `streamingChain.ts`: `df3f3475a881f49d805f6656dfffa7634d24c69c0bfe6278bedab186c8d71ec1`

The fixtures/manifests above, not ephemeral scratch paths alone, specify the counterexamples. Before implementation depends on Fable's real-data magnitudes, preserve its actual input IDs/cutoffs/queries/output hashes in an approved reproducible evidence package. Do not perform new live reads merely to rubber-stamp an old number.

**Passed:** offline reproductions and 500 enumerated matching checks; source-parity inspection. **Not run:** full Vitest, TypeScript/lint/build, Playwright, weekly exhaustive search, production/provider/DB verification. Application checks are not represented as passed merely because the deliverable is documentation. No unresolved tool/access blocker prevented this review.

## Decisions genuinely remaining

1. Confirm the league/provider's L versus OTL mapping before setting numerical goalie-loss expectations; conserve the chosen outcome mass regardless.
2. Choose any future beyond-window retention objective separately from the currently informational later-impact scenario.
3. Clarify AGP priority versus category-frontier presentation and whether explicitly requested manual schedule comparisons may include an unknown drop. Automatic no-line/unknown proposals remain excluded under the present owner decision.
4. Choose a projection-only streaming stopgap or a properly validated same-basis shrinkage model. No fitted constants are established by this audit.

Reserve migration, pipeline retry, production rollout and native activation are separate approved actions, not implied by accepting these findings.
