# L3 consequential-hunk review and release-slice proposal

Read-only review, November 4. Observed HEAD: `5f6b4e7a3a893000fe31cc6928cd8736b56e5d39`. **Proposal only:** no additional Chef acceptance, staging, commit or final composition. Exact full-file lists and current SHA256 pins are in `REVIEW-SLICES.json`. All 33 proposed/deferred paths match the original L3 pins; that comparison supports byte identity, while the source review below supports the conclusions.

## Recommended independently releasable core

**RSO-CORRECTNESS — 17 files.** Six runtime/UI files and eleven test/spec files form one coherent rules correction. Keep the reserve warning, add-blocking semantics and UI explanation together. No new FORGE research module or model activation is needed.

Inspected the actual runtime hunks and nearest regressions:

- `planning.ts`: game-start equality closes remaining opportunities; started-game inferred positions remain visible but set `invalidLocks`; unsupported rules deny legal certification; future schedule evidence withholds comparison. The changed tests assert exact equality, provisional display, denied recommendations and future-evidence abstention.
- `planningTimeline.ts`: ineligible reserve occupancy becomes a warning for existing lineups and blocks additions; capacity checks remain. Direct reserve adds and reacquisition from stale original availability are rejected. Waiver submission/effective-time reset checks precede acquisition-budget and roster assignment. Dropped-player tracking updates only after accepted capacity checks. Regressions verify rejected paths preserve the last roster and acquisition counts, and corrective drop/add and same-period waiver paths remain usable.
- `lineupGaps.ts`, `healthyReserves.ts`, `HealthyReserveAlert.tsx`: reports/UI explain add blockage without calling the active lineup illegal. The unit/spec text and reserve fixtures were changed consistently. Historical-lock fixtures now supply actual active/bench witnesses instead of relying on inferred positions.
- Yahoo `rosterPlanning.ts`: rejects season-long `point`/`roto` through the existing unsupported-rule channel; `head`/`headone`/`headpoint` retain admission. This is RSO-only; it does not narrow the shared draft parser.
- The contribution regression checks conditional versus already-unconditional value once; candidate-metrics tests now expect no legal swaps for unsupported rules. The cross-reset manual acceptance test retains its successful path only after explicitly supplying one acquisition period spanning both clocks.

No newly introduced blocking defect identified in these inspected core hunks. Reuse the RSO receipt's **61 RSO files / 1,517 tests**, targeted lint and five earlier synthetic Chromium cases. The two Yahoo scheduler assertions have separately been closed by Chef's accepted test-only correction; do not add that unrelated file to this RSO list implicitly. These results do not establish live-provider parity, and concurrent styles are outside the recorded browser acceptance.

**FORGE-OBSERVED-COUNTS — four files:**

- `web/lib/forge-v2/contracts.ts`
- `web/lib/forge-v2/evaluation.ts`
- `web/lib/forge-v2/model.ts`
- `web/lib/forge-v2/evaluation.test.ts`

The shared validator first applies existing component validation, then safe-integer support to available observed counts, then PPP ≤ G+A when all three are observed. It does not impose integer support on forecast means or fill unavailable categories. Ingestion, direct settlement and training examples use the same validation. Direct ingestion/settlement regressions reject fractional PIM and impossible PPP. Existing invalid retained labels fail reprocessing; this is intentionally a validation change, not a historical repair.

No new offline modules are needed for these four full files. **Exclude the current `model.test.ts` and `data.test.ts` changes from this minimal core slice**: their new imports/tests concern the offline baseline/capture helpers. Existing committed model tests remain available at HEAD. Reuse the existing provenance aggregate (320 tests / 17 files), TypeScript and targeted lint evidence, with the limit that L3 did not execute this selected four-file subset in isolation.

## Keep these optional FORGE slices distinct

| Proposed slice | Exact size | Dependency / disposition |
|---|---:|---|
| FORGE-HORIZON-OFFLINE | 4 files | Evaluator, test, fixtures and CLI runner together. The test imports the runner and the runner imports fixtures. Ready for separate local research-code acceptance; no empirical qualification. |
| FORGE-LEDGER-OFFLINE | 2 files | CLI adapter plus `servedForecastLedger.test.ts`; include both because the test imports the adapter. Diagnostic-only, separate from serving ledger runtime. |
| FORGE-JOINT-SAMPLER | 2 files | `uncertainty.ts` and its test; separate disabled experiment. No producer option activation. |
| FORGE-CAPTURE-BASELINES | 4 files | Capture/baseline helpers and new data/model test additions; requires `horizonEvaluation.ts`. **Defer for the narrow clock-contract decision below.** |

Horizon review covered the independent integer/joint-accounting validator, explicit null versus zero, frozen nested windows, provenance/model/training clocks, label maturation, paired identities, ratio exposure accounting, CRPS/interval scores and bounded calendar-block diagnostic. The CLI reads a bounded local file or fixture and uses exclusive output creation; it does not fetch or promote a model. The tests assert future-data, immature outcomes, unpaired horizons and changed cache identities. No new empirical results were computed.

Ledger review covered pregame receipt ordering, maturity masking without modifying input records, invalid observed-count and forecast-mean quarantine, unknown/DNP accounting, explicit H10/H20 unavailability and exclusive bounded-file output. Its test import is the concrete reason the adapter and test travel together. The current serving ledger module is unchanged.

Sampler review covered the conditional GA-given-SA draw, derived saves, coherent input checks, and the option guard that leaves the incumbent branch/output shape intact when disabled. The bit-enumeration test independently verifies binomial moments and final draw accounting. The inspected goalie-stage producer contains no `jointGoalieCounts` enablement; this bounded observation plus the prior receipt supports keeping the experiment disabled. No fresh global activation audit or claim of predictive improvement was made.

## Narrow remaining code concern: capture anchor clock

`researchCapture.ts:40` selects schedule games strictly after **retainedAt**; the validator repeats that choice around lines 78–80. Its clock guard around lines 61–62 accepts any `cutoffAt ≤ issuedAt ≤ retainedAt`. Consequently a capture issued before game A, retained after A starts, and supplied with a forecast for later game B can validate with B as H1. An empty forecast list can also retain the shifted universe. This follows directly from the inspected filters and guard; **L3 did not execute a counterexample**.

That behavior needs an explicit owner decision before accepting this helper as an issuance-origin capture contract. The provenance receipt describes frozen origin windows and a pregame prospective cohort; the implementation currently anchors at retention. A bounded follow-up should establish whether issuance or retention is the registered origin. If issuance is intended, preserve that anchor and reject a late retained capture rather than silently advancing its first game; add the specific delayed-retention regression. If retention is intentionally the origin, record that contract and its non-backdating rule explicitly. No fix, data admission or new capture is authorized by this review.

This concern affects the optional capture/baseline package. It does **not** block the 17-file RSO correction, four-file observed-count correction, standalone horizon evaluator, ledger adapter or disabled sampler. No durable storage, trade-aware cumulative settlement assembler, source-use admission or qualified performance is established by those helpers.

## Exclusions and decision needed from Git custodian

The one-line `RosterScheduleOptimizer.tsx` diff makes `aria-controls` conditional while its target is absent. It is a separate accessibility/UI hunk, not established by the RSO audit's correctness receipt; exclude it from this exact RSO proposal unless Chef accepts separate provenance. Exclude the RSO stylesheet and all global/concurrent styling, generated files, L4/L5 new feature slices and Luna's read-only IFTTT assessment. Do not infer inclusion from dirty-directory membership.

Chef must accept named slices and the Git custodian must confirm an exact stable base plus the permitted **selective commit** while preserving every excluded dirty path. The full current `model.test.ts`/`data.test.ts` cannot be included while deferring their helper dependencies; leaving their changes out of the core slice avoids needing a hunk split. No full-tree stage/commit is proposed. The untracked new files for any optional accepted package must be included explicitly.

No application rerun is requested for unchanged accepted evidence. If the custodian changes/splits these reviewed bytes or includes shared styles, Chef should allocate only the checks affected by that integration. Final candidate identity and any release action remain unperformed.

## Verification actually performed by L3

Read consequential runtime hunks, corresponding regression changes and the new offline module/runner boundaries. Compared 33 exact file hashes to the prior L3 manifest; all match. Checked JSON/file-list invariants and scoped artifact whitespace. No test, lint, typecheck, browser, build, protected-data read, provider call, Git/index/ref mutation or final composition was performed. Existing source-reported checks remain reused evidence, not L3 executions.
