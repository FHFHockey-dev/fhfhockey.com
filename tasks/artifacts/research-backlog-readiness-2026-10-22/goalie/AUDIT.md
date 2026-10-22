# Goalie workload, danger and stopping: current-source audit

2026-10-22. Existing tasks **S1 / F11 / F8**, with shared dated-input concerns for F10 and preview acceptance in SKO 4.2 / 7.4. Canonical `octoberBranch`; audit-start HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`. This packet changes research artifacts only. `GR-D1`–`GR-D5` below are local finding labels, **not new canonical task IDs**; test names use their shorter D1–D5 labels.

Five concrete boundary defects are reproduced: incoherent observed goalie counts are accepted by the fixture interpreter; the evidence reader zero-fills missing goals; observed relief dates become starts; unknown rest becomes the 4+ bucket; and a team-prior fallback can cross its as-of cutoff. Their exposure differs: the interpreter is a fixture preview, the current materialization writer protects the missing-count case, and no live record or incident was inspected. Overlapping windows and multiple team-xGA effects are demonstrated, but their predictive harm and a better replacement are **not established**.

The [15-check actual-source packet](audit.test.cjs) passes on Node 22.11.0, using fictional inputs and controlled query responses. Passing means the documented behavior was reproduced, including the defects; it does not mean these files are defect-free. [Verification](VERIFICATION.md), [exact outputs](OBSERVATIONS.json), and [source hashes](SOURCE-REFERENCES.json) bound the claims.

Parent-requested continuation: [P02 overlap supplement](P02-OVERLAP.md) adds **five separate passing checks** and four specific player-page/landing defects in QS support, SV paired support, GAA exposure and null ranking. It preserves the existing P02 owner and does not repeat the completed SOG package or broaden into the whole player-page audit.

## Existing contracts and formula families

The phase-0 [contract](../../../codex-sprint-2026-10-19/sko-vudu/PHASE0-CONTRACT.md) and current [master handoff](../../../handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md), S1/F11, govern this review. The historical `ML prediction × stability factor` in `tasks/TASKS/sko-charts/sko-modeling-notes.md` is explicitly quarantined; it is not the current VuDu formula or a model to restore. The phase-0 report's old sustainability-label findings are historical: the current handoff records those labels already withheld. This packet does not reopen them or claim to re-audit the whole sustainability engine.

| Quantity / owner boundary | Actual implementation, inputs and units | Health verdict within this audit |
| --- | --- | --- |
| Native gap / S1 | `web/lib/sko/gap.ts:71–96`: `100 × (expectedSaveProb − recentSaves / recentShotsOnNet)`. Expected SV and observed pooled SV are fractions; output is additional saves per 100 on-net shots. | Correct for qualified, comparable inputs; null exposure and invalid-count guards pass. Caller still owns target, strength, horizon, clock and population comparability. A positive gap is not a probability of improvement. |
| Observed ratio context / SKO adapter | `web/lib/skoElement/interpret.ts:143–162`: pooled saves/shots and 60×GA/minutes. Native goalie gap remains `pending_goalie_adapter`. | Missing/zero guards pass; joint-count validation fails (GR-D1). Fixture success cannot close live goalie acceptance. |
| On-net game evidence / FORGE producer | `derived/buildGoalieGameV2.ts:32–34,63–140`: only shot-on-goal and goal events with a valid defending goalie; saves = shots − GA. All observed goalies retained; TOI null, no starter marker. | Matched synthetic counts conserve shots. Correct as an event-count producer; insufficient to identify actual starts or all no-shot appearances (GR-D3 is the downstream interpretation). |
| Recent stopping outcomes / FORGE reader/model | `queries/goalie-queries.ts:251–354`: recent 20, current-season 120, baseline 200 rows before as-of; separate pooled shots/GA. `goalieModel.ts:123–169`: nested baseline/season/recent SV blending, then league shrinkage using summed window mass. | Missing count admission fails (GR-D2). Overlap is real; whether weighting should change is unresolved (H1). This is outcome SV evidence, not matched shot-danger-adjusted stopping skill. |
| Start/workload/rest context / F11 | `goalie-queries.ts:174–248`, `goalie-save-pct-context.ts:15–85`: unique appearance dates become start counts; counts and B2B set prior penalties; rest-bucket SV modifies prior. | Start semantics and unknown-rest admission fail (GR-D3/D4). The size of fatigue/rest coefficients is a separate calibration question. |
| Team environment / F8 | `team-context-adjustments.ts:30–213`, `goalie-stage.ts:273–350`: team xGA/game affects shot volume; NST xGA/60 affects shared context; context changes both shots and the SV prior. Team 5v5 SV/PDO changes context/prior too. | Actual multiple paths identified (H3/H4); no evidence-backed verdict that an adjustment should be deleted. Team-prior date fallback fails (GR-D5). |
| xG event population / xG owner + F11 adapter | `xg/baselineDataset.ts:283–300`, `shotFeaturePersistence.ts:752–768`, `aggregates.ts:744–777`, `rankings/xgDenominatorSemantics.ts:1,29–32,67–74`: shot-goal predictions use unblocked attempts; goalie aggregate `shots_against` counts those prediction events. | Explicit Fenwick/unblocked helper is consistent. This similarly named count is not the on-net producer count. No active mixing adapter found; deliberate misuse fixture illustrates the future adapter gate (H2). |

Abbreviated projection paths in the table are under `web/lib/projections/`. Units are what the inspected functions consume, not a fresh certification of provider data or publication vintage.

## Demonstrated defects and precise follow-up scope

### GR-D3 — relief appearances are treated as starts

**Source:** `web/lib/projections/derived/buildGoalieGameV2.ts:63–140`; `queries/goalie-queries.ts:174–212`; `calculators/goalie-save-pct-context.ts:15–27`; `stages/goalie-stage.ts:507–515,565–575`.

The producer emits a row for each goalie facing an on-net event. The workload query selects only `game_date`, deduplicates dates, and calls every date a start. Six synthetic games each containing a starter and a designated relief goalie yield six rows for the relief goalie. The actual reader reports six starts in both 7/14-day windows, one day since last start, and B2B. The actual penalty is 0.07 in SV-fraction units (0.04 very-heavy + 0.03 B2B). The stage clamps the adjusted prior to 0.86–0.92 before model shrinkage: **this is not proof of a seven-percentage-point final SV drop**.

Two goalies on the same team cannot both have started that game. Nothing in this row shape distinguishes them. Counting by date avoids same-date duplicates, but cannot supply start identity, duration or zero-shot appearances. The same `recentStarts` naming also exists in `fetchGoalieEvidence` row counts, though the tested model primarily uses shot masses.

**Bounded repair proposal for the FORGE owner:** choose and source-qualify an actual start/appearance/exposure contract; trace its provider/producer into the workload reader and consumer. Preserve missing start identity. Add true-start versus relief, short/zero-shot appearance, absent history, exact 7/14-day boundary and B2B fixtures. Do not rename observations into starts, infer an arbitrary minute threshold, retune fatigue coefficients, or alter the producer's legitimate all-goalie counting responsibility. Source availability is the prerequisite; this audit proves no real incidence rate.

### GR-D4 — unknown last start selects known long rest

**Source:** `web/lib/projections/calculators/goalie-save-pct-context.ts:30–38,41–84`; workload read at `queries/goalie-queries.ts:202–210`; stage consumer above.

`toGoalieRestSplitBucket(null)` returns `4_plus`. With ten games per bucket, SV .900 in buckets 0/1/2/3 and .940 in 4+, the actual function returns **+0.012** for both unknown rest and known four days. The distinction between no observed last start and a supported long-rest observation is lost. An empty or incomplete history does not itself certify long rest; no completeness evidence accompanies this value.

**Bounded repair proposal:** preserve unknown and withhold the bucket-specific adjustment unless rest is supported, or document and review an explicit fallback policy separately. Add null versus actual 4+ tests with a populated rest profile, plus missing profile. This is an input-state correction, not evidence that the rest coefficient is too large. The profile baseline is a **games-weighted mean of bucket SV rates** (`:59–78`), not pooled saves/shots; changing that estimand requires shot denominators and separate review.

### GR-D5 — team-xGA fallback can use future history

**Source:** `web/lib/projections/queries/team-context-queries.ts:339–381`; `stages/goalie-stage.ts:208–215`.

After in-house prior unavailability, the first `nhl_team_data` query includes `date <= asOfDate`. When it returns no rows, the latest-row fallback has no date bound. In the controlled client, as-of **2026-10-22** returns a **2026-10-23** prior with xGA/game 3.4. The actual selector preserves that future `sourceDate`, but the stage consumes the prior without rechecking it. The actual team adjustment is +0.0303341404 to the shot-volume fraction in the supplied fixture.

**Bounded repair proposal:** retain the cutoff on every fallback or return unavailable when no eligible prior exists; preserve source date and distinguish valid absence from failure. Add empty-history/future-only, prior-valid and in-house-unavailable cases in the existing team-query tests. A later revision/receipt clock remains necessary for past-as-known-then qualification. The in-house provider was stubbed unavailable here, not executed; no deployed forecast leakage is claimed. The separate NST season-only fallback (`:454–478`) also lacks day-vintage proof, but was not classified as a reproduced future-row defect in this packet.

### GR-D2 — missing goalie goals become observed zero

**Source:** `web/lib/projections/queries/goalie-queries.ts:303–334`; nullable input type `types/run-forge-projections.types.ts:79–87`; `goalieModel.ts:123–169`.

The reader independently sums shots and GA with `safeNumber(value, 0)` and does the same for residuals. For one row returned in all three nested windows, `{shots_against:30, goals_allowed:3, saves:27}` produces modeled SV .900000; replacing **only GA with null** produces .9067164179. The selected saves count is not used to validate or recover the missing paired goal count. In this fixture the recommendation changes SIT→START, though that is a synthetic threshold effect, not a measured recommendation failure. Read errors correctly throw in a control test.

**Mitigation / reachability:** the baseline table schema permits nullable counts (`supabase/migrations/20260716112908_production_schema_baseline.sql:8366–8379`). The inspected transactional writer rejects missing/inconsistent counts using nonnegative checks, `GA <= shots`, and `saves = shots − GA` (`20260720105524_add_projection_materialization_transactions.sql:3053–3073`). The actual event producer also conserves counts. Thus this is a demonstrated reader boundary defect for admitted legacy/partial rows, **not evidence the guarded current writer generates them or that live rows contain them**. SQL was inspected, not executed.

**Bounded repair proposal:** admit coherent paired counts at the reader boundary; retain real zeros, distinguish incomplete/invalid evidence, and expose coverage/abstention. Test null shots, null GA, inconsistent saves/GA, complete zero and query error. Do not silently fill/backfill unknown goals or change shrinkage weights. Any legacy data repair requires separately authorized evidence and scope.

### GR-D1 — fixture interpretation accepts impossible observed SV

**Source:** `web/lib/skoElement/interpret.ts:25–52,143–162`; display `web/components/skoElement/SkoElementPreview.tsx:123–127`.

Through the public `interpretPlayer` function, one appeared game with 31 saves, 30 shots, 3 GA and 60 minutes yields **103.33% SV**, GAA 3, and `invalidRows:0`; saves + GA = 34 while shots = 30. Primitive nonnegative checks do not validate the joint identity. Controls confirm negative primitives are rejected, missing saves remain unavailable, and zero denominators return unavailable ratios.

**Bounded repair proposal:** extend observed-goalie normalization to validate coherent paired counts and withhold inconsistent ratios with a reason; add this fixture to the existing `interpret.test.ts`. Do not invent a goalie projection adapter. Exposure is bounded: the route is a local fixture preview with production `notFound` (`web/pages/sko-element/preview.tsx:9–11`), and the native gap correctly remains `pending_goalie_adapter`. No browser or hosted route was run.

## Demonstrated mechanics that do not yet justify formula changes

**H1 — overlapping evidence mass.** Actual queries return one 30-shot synthetic game in recent, season and baseline; `totalEvidenceShots` is 90. `goalieModel.ts:149–169` first builds nested anchors, then the summed mass both increases the weight on the adjusted rate and reduces `priorShots`. Confidence also uses all three window masses (`:198–214`). This proves where overlap acts, not that intentional recency weighting is invalid. Do not describe the sum as unique shots or replace it with a unique-count formula without an accepted experiment. The older handoff's 14-group/0.98674-saves receipt was not recovered or rerun; this packet is a new pinned-source diagnostic.

**H2 — on-net and unblocked counts are incompatible VuDu inputs.** Identical synthetic play identities include one save (xG .1), one goal (.2), one miss (.4). Actual `buildXgAggregates` returns three unblocked `shots_against` and xGA .7; actual `prepareGoalieGameV2` returns two on-net shots, one save, one GA. With expected SV .9, correct VuDu is **40 saves/100**; deliberately substituting the unblocked count gives **56.6667**. Dividing all-event xGA .7 by two on-net shots gives .35 versus .15 from the two matched prediction events. Neither ratio establishes a calibrated conditional-on-net goal probability merely by arithmetic/filtering. The dedicated denominator helper correctly labels Fenwick/unblocked; no actual current consumer making this substitution was found in the inspected path.

**H3 — team xGA influences more than one effect.** `computeTeamStrengthContextAdjustment` changes base shot volume from team xGA/game and opponent xGF/game; `computeNstOpponentDangerAdjustment` uses defending xGA/60 plus opponent xGA/60 as a pace proxy, then the stage applies its context to both volume and prior SV. The actual-source stage slice gives:

| Synthetic path | Context fraction | Projected shots | SV prior |
| --- | ---: | ---: | ---: |
| Baseline | −.010 | 29.700 | .9004 |
| Team-xGA volume only | −.010 | 31.601 | .9004 |
| NST context only | .030 | 30.900 | .8988 |
| Both | .030 | 32.878 | .8988 |

Inputs: base shots 30; defending xGA/game 3.54 versus baseline 2.95, both aggregate xGA masses 140; NST defending xGA/60 3.125 versus baseline 2.5, 15 GP per team; other context neutral. The unchanged away-game term contributes −.01 even in the baseline. These are attribution probes, not a fitted ablation. xGA/game and xGA/60 each combine volume and quality; labeling one path “danger” does not isolate conditional shot difficulty. They could be correlated and reinforce effects, but this packet does **not** establish harmful double counting or which term should be removed. No new xGA multiplier is warranted by a purported missing feature.

**H4 — fixed individual history can change under team SV/PDO.** Holding goalie evidence fixed and varying defending-team 5v5 SV .922→.942 changes context/prior and then modeled goalie SV. `team-context-adjustments.ts:103–168` explains the path; exact outputs are retained. Team SV contains goaltending outcomes, so this modeled value cannot be presented as context-neutral individual stopping skill. Whether that dependence improves expected game outcomes requires a paired experiment. This is not proof of an erroneous formula merely because it includes team context.

**H5 — nonfinite input hardening remains a boundary question.** The model rejects NaN projected goals-for but `projectedShotsAgainst:NaN` passes `Math.max` and produces NaN saves/GA (`goalieModel.ts:116–119`). This malformed-input behavior is reproduced. No current upstream path delivering it was established, so treat it as optional boundary hardening pending caller audit, not a demonstrated served defect. Extend the existing model tests if the owner takes that slice; no broader refactor is needed.

## No-finding results and verification limits

- Native VuDu arithmetic returns 1 extra save/100 for expected .91 versus observed 90/100; zero/missing exposure stays null, saves above shots and negative counts reject. There is no sign or scaling defect on qualified inputs in these probes.
- Valid goalie outputs conserve `saves + GA = shots`. Doubling projected shot volume doubles counts while holding modeled SV fixed. Changing start probability 1→.2 leaves conditional counts unchanged and scales win/shutout probabilities by .2. The stage separately calls a full-start model and passes probability 1 for conditional starter scenarios (`goalie-stage.ts:517–529,577–599`), with a declared `zero_relief_minutes` nonstart assumption. No double application of starting probability was demonstrated in this path; full serving/planner mixture behavior was not executed.
- NST `xGA × 60 / TOI` returns 2.5 for xGA 25 over TOI 600, with null/zero exposure unavailable (`team-context-queries.ts:422–450`). This validates the consumer's **minutes** convention, not original provider units or historical availability.
- No live/private data, real client, credentials, network, dependency installation, model fitting, deployment, full application test suite, or browser execution occurred. No pending, denied or uncertain external action exists. Operational incidence, empirical accuracy and an accepted on-net danger/goalie adapter remain unverified.

## Next bounded work for the parent and ledger owner

1. Route GR-D3/D4/D5 to the existing FORGE owner for boundary repairs before changing goalie coefficients; route GR-D2 as reader hardening with its writer mitigation explicitly retained. GR-D1 belongs to the existing SKO interpreter/fixture lane. Coordinate exact file ownership before editing; this packet grants no implementation or release authority.
2. Under F11/S1 and SKO 4.2, define an adapter evidence packet with stable game/event/goalie identities, event universe, strength, empty-net/shootout policy, observation/issuance clocks, complete paired numerator/denominator and actual start/exposure support. Specify what is withheld when any part is unknown. Decide future-outcome gap versus context-neutral stopping skill before displaying VuDu. Current modeled SV cannot silently serve both meanings.
3. Under F8/S1, select **one** qualified chronological head with common-origin eligibility and original model/input versions, then freeze the baseline and at most two challengers under the existing budget. Choose overlap weighting or environment attribution as the experiment; do not run every hypothesis. Report count/ratio error, calibration where claimed, missingness and decision utility separately. This requires admitted historical inputs and fitting/evaluation authority not present here.
4. Keep the other research lanes in [the readiness map](../REPORT.md): F9/F10 history/consumer admission before category trials; R7 ownership provenance and saved-state aging; A1/U2 SOG identity/finality/coverage integration after its synthetic packet; BLSH 5.2 common-date roster legality/usable contributions; monetization user-value/cost evidence. Their prerequisites have not been closed by this goalie audit.

Potential feature application after these gates: separate **starts/workload**, **expected saves and GA**, **observed pooled ratios**, and **environment** in goalie comparisons. Keep the pending adapter label until support exists; never label a context-driven SV change as demonstrated deterioration in stopping skill or a historical/gap number as predictive probability.
