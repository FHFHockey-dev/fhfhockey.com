# FORGE pass 3 — source reconciliation and local evaluation contracts

Local work on `octoberBranch`, base `152ee53b766d656d21154aacfe53ff2491a1bccf`. This follows the pass-1 integrity slice and pass-2 eight-date development diagnostic. It does not establish validated as-issued forecasts, unconditional accuracy, model superiority or deployment readiness. No historical records were corrected or overwritten.

## Reconciliation findings

### Six label rows: source conflict, not a demonstrated FORGE copy error

The six rows are three forecast-source copies of each of two appearances. `web/pages/api/v1/db/forge-served-forecast-settle.ts:49` reads `wgo_goalie_stats`; `web/lib/player-forecasts/servedForecastLedger.ts:304` copies its individual goalie fields. `web/pages/api/v1/db/update-wgo-goalies.ts:681` maps the NHL summary fields directly. The per-day acquisition at line 794 requests individual regular-season/playoff game rows, not cumulative season totals. No subtraction, team-goal substitution or ratio conversion occurs in this copy path.

| Goalie / game | Ledger, WGO, retained and current NHL boxscore: saves / GA / SA | Retained NHL event tally | Disposition |
|---|---|---|---|
| 8477465 / 2026020176 | 25 / 6 / 30 | 25 shot-on-goal saves + 6 goals naming this goalie; another goal has no goalie | Unresolved authoritative-field conflict |
| 8478872 / 2026020177 | 29 / 4 / 32 | 29 shot-on-goal saves + 4 goals naming this goalie | Unresolved authoritative-field conflict |

Jarry’s official summary separately records GA/SA 6/30 and empty-net 1/1. [NHL individual-goalie summary](https://www.nhl.com/scores/htmlreports/20262027/GS020176.HTM). Vejmelka’s summary records GA/SA 4/32. [NHL individual-goalie summary](https://www.nhl.com/scores/htmlreports/20262027/GS020177.HTM).

Both latest official JSON reads still reproduce the triples, so they remain quarantined under FORGE’s joint-count contract. Neither game ended in a shootout. The Jarry empty-net goal is already separate. One credited goal in each play-by-play lacks `shotType`; that is a source-detail anomaly, **not proof of an accounting exception or permission to delete a goal**. A bounded official-source review did not establish an exception that reconciles these fields.

The evidence does not determine whether a save count, shot count or event classification should change. For example, holding GA/SA fixed implies 24/28 saves, while holding saves/GA fixed implies 31/33 SA. Neither alternative was substituted. Provider clarification or an independently adjudicated official correction is the blocker; any later resolution must append a new label revision linked to the old bytes.

Retained boxscore IDs/hashes: 88786 / `8644968e74c51ab83fef638a4c338fd38d9c901c10bf0ba8d42e3084c0230d66` and 88790 / `c86127164726cdfa8e9694d0e5df39837eafd1a4a0ee9608cc2f7d3b9d0ebb44`. Both were fetched October 25. Play-by-play IDs 88785 and 88789, complete selected event details and fresh-response hashes are in the local evidence listed below. Current reads are not backdated first-available evidence.

### Fourteen naive forecasts: exactly reproduced source propagation and denominator mismatch

All **14/14** invalid naive forecasts reproduce to all four stored decimals from the full current-season WGO histories and schedule rows. Full history begins September 29; an October 1 truncation was insufficient and was discarded. No season-opening date was hardcoded into the final reconstruction.

- Six forecast rows reuse goalie 8480947’s game 2026020015: saves 13, GA 8, SA 20. Retained official boxscore 79266, fetched October 2, repeats the inconsistency; hash `d5fefb6ddba95169119ab8b1a6f7a66cf77b5aa66dbb828fd7774bec1fd3bbfe`.
- Six reuse 8477465/game 2026020176; two reuse 8478872/game 2026020177.
- `servedForecastLedger.ts:149–160` averages each count over starter appearances, then multiplies by start share. `naive_last5` actually uses **ten goalie starts** and the last ten team schedule games. `naive_season` uses current-season starter appearances and all preceding team schedule games.
- The snapshot route queries `games` by season without game-type filtering (`forge-served-forecast-snapshot.ts:74`). **Every one of the seven season-baseline denominator sets contains four preseason games**, while its WGO numerator contains regular-season/playoff starts. This dilutes start probability. The last-ten denominator sets in these seven cases contain no preseason games.

Each affected row’s history game IDs, bad history IDs, exact denominator game IDs, captured/recomputed start share and reproduced three-count means are in `reconciliation-final.json`. This is a retrospective reconstruction from retained/current records, not proof of the exact source versions read at issuance. No production baseline or historical output was changed.

### Forty-eight reaimed forecasts: coherent source, incoherent retargeting

All **48** rows map through their captured run watermark/team to a unique retained H1 goalie projection candidate across **ten run IDs**. Each candidate has zero SA−saves−GA residual. Eighteen are another goalie’s team line, consistent with the existing fallback path; the distinction between selection and individual save talent must remain explicit.

`web/lib/rosterScheduleData/forgeDailyBridge.ts:200–205` scales SA and saves by the shot-context factor, but GA by a different goal-context factor. Its caller at lines 618–639 then applies start probability. For coherent source counts, the unrounded residual is:

`p(start) × source_GA × (shot_factor − goal_factor)`.

An isolated call to the real producer reproduces the defect: a coherent 25 saves / 2.5 GA / 27.5 SA fixture becomes **28.8589 saves / 2.7946 GA / 31.7448 SA**, residual **0.0913**. This is synthetic correctness evidence, not a forecast improvement. All 48 exact source candidates and residuals are retained. Seven residuals are ≤.001, so severity is not uniform; none are attributed to incoherent original counts.

Historical team priors, roster mapping and news inputs were not fully captured, so exact per-row retarget multipliers cannot be authenticated as issued. `bridge-factor-diagnostics.json` reports algebraically inferred factors, explicitly not a recovered historical feature snapshot. A possible future fix would reconcile saves after choosing joint SA/GA expectations; it requires model-contract review and shadow evaluation. No bridge runtime formula was changed or activated in this pass.

## Implemented local contracts

`web/lib/forge-v2/researchCapture.ts` reuses `SourceReference`, `SourcePolicy` approval fields, canonical content hashes and the existing independent calendar-count validator. It adds:

- Pinned canonical input payloads with source ID/revision/hash, observed/published/first-received clocks and explicit intended-use evidence. Claims of approval still require an authentic external receipt; test fixtures are not provider rights.
- Independent complete roster and schedule snapshots. Roster, injury reserve, reserve/backup and no-history players do not disappear because no forecast exists. Assigned players are marked ineligible, unresolved membership remains explicit, and effective dates cannot exceed cutoff.
- Category/mapping/schedule/model/feature/code/calibration identities, cutoff/issue/retention/model-availability clocks and exact supplied forecast game IDs. H1/H10/H20 windows are derived from the frozen origin-team schedule; short windows remain incomplete. **Deriving a schedule does not create a forecast.** Missing H10/H20 forecasts stay null.
- Append-only capture validation: retrying identical bytes is idempotent; changed capture IDs require new versions, and corrections link predecessors. Reusing a source ID/revision with changed payload or clocks is rejected. Existing capture membership and schedule bytes survive a later trade/postponement revision.
- Separately pinned game settlement. Absent players are unknown until a final, complete team/class receipt proves absence. Unused backup, official appearance, nonappearance and game-not-played are distinct. Known DNP may be represented as `knownZero: true` with no invented source counts; unknown remains `knownZero: false`. Finality, actual start, identity and label accounting are checked; relief wins are legal.

This is a **pure local contract/append-validation implementation**, not a durable storage service. It does not prove database crash durability or authenticity of caller-supplied timestamps. The existing v2 canonical hash/immutable history architecture is the intended persistence integration, with server-clock receipts and committed readback. No private v2 tables were found in the inspected project, and no schema/route/job was created or activated.

## B0/B1/B2: implemented, not empirically qualified

`web/lib/forge-v2/researchBaselines.ts` constructs point forecasts from explicitly admitted mature regular-season prior observations. All transformations/pooling occur within the caller’s cutoff. It rejects future receipts, target-game overlap, unadmitted seasons, inconsistent counts, contradictory strength totals and incorrect strength attribution of PPP. Its exposure input is independently pinned and identical across the three rate comparisons.

| Baseline | Conditional rate | Exposure |
|---|---|---|
| B0 | Prior-season per-appearance count, shrunk toward other-player pooled rate: `(own_count + k × pool_rate)/(own_GP + k)` | Independently predicted GP |
| B1 | Same estimator across admitted seasons, with predeclared exponential age weights | Same predicted GP |
| B2 | Recency-weighted strength count/minute rates, shrunk with predeclared pseudo-minutes | Already-unconditional predicted ES/PP/SH minutes; goalie ALL minutes |

Goalie W/SO remain appearance-event rates in B2, not count/minute rates. Rookies can use real pooled support; absence of pooled support returns null. Missing categories do not become zeros. G/A/PPP and saves/GA/SA share observation support so rate estimates preserve their accounting. B2 does not multiply unconditional predicted minutes by participation a second time. No joint trajectories, expected realized ratios, participation model or goalie-selection model is invented.

These functions are not connected to a serving path or the eight-date legacy ledger. The new baseline checks are analytic/synthetic correctness tests. **No real B0/B1/B2 performance gain is claimed.** Existing unshrunk last-five/current-season controls remain separate.

## Prior-only inventory and admission gap

Before the earliest evaluated October origin (`2026-10-22T10:10:50Z`), retained raw NHL boxscore metadata contains:

| Season / type | Distinct games | Versions |
|---|---:|---:|
| 2025–26 regular | 1,312 | 1,463 |
| 2025–26 playoff | 82 | 163 |
| 2026–27 regular | 153 | 196 |
| 2026–27 preseason | 36 | 36 |

These are measured counts, not assumed season lengths. The prior-season versions were fetched March 30–June 15, before the October origins. They can support **prior-only candidate inputs** for later forecasts; they cannot reconstruct their own earlier pregame availability. This improves on pass 2’s current-head-only inventory. The protected prior-season numerical labels were not opened in this pass: only raw-version metadata was counted.

Before fitting real baselines, select and hash the latest version actually received by each origin, normalize regular-season individual records, quarantine conflicts, record explicit source-use admission and resolve the existing protected-fold allocation. Historical per-strength HIT/BLK/PIM/exposure availability is not established by these boxscore counts. B2 must retain missing heads rather than backfill invented splits. The inspected April news/lineup snapshots do not establish October historical enriched features; collect those prospectively, separately from prior-only replay.

## Prospective cohort plan and approval gate

1. Register the cohort/protocol hash **before the first new capture**: regular season, all independently sourced NHL roster/IR/reserve members including backups and fringe players; fixed daily origin at 12:00 UTC before puck drop. Retain schedule/team-membership versions and shortfall/unknown rows. The eight October/November dates remain development diagnostics and are excluded from qualification claims.
2. First capture pilot: seven consecutive calendar dates, complete daily eligible population, H1 producer output plus all source/model/input/exposure references. H10/H20 forecast slots remain missing until actual common-origin forecasts exist; retain their schedule anchors without manufacturing output. Stop on incomplete population, missing clock/use receipt, or mutable-byte conflict. No production cron is started by this plan.
3. Freeze B0/B1/B2 hyperparameters and source allocation before scoring. Begin with prior-only boxes; use the same captured predicted exposure for rate comparisons. Any oracle GP/TOI diagnosis must be separately labeled unattainable. Missing unconditional goalie appearance/relief exposure blocks those metrics, even when starter probability exists.
4. Settle only after authoritative game finality and independently evidenced complete class/team coverage. Preserve all revisions and contradictions. For calendar-window totals, collect traded-team appearances through the frozen boundary; do not cap player GP at H or silently move the boundary after postponements. The new settlement helper handles per-game receipts; a complete trade-aware cumulative label assembler remains a separate unmet requirement.
5. Freeze a later untouched calendar holdout only after the development capture pilot passes integrity review. Purge actual overlapping label windows. Do not choose a fixed calendar duration by assuming 20 games mature within it. Rate comparison, exposure comparison, coverage/missingness, proper distribution scores (when real distributions exist), paired calendar-block uncertainty and ranking utility remain separate.

**Approval-gated production integration, not performed:** an explicitly scoped private immutable capture/settlement store, using the existing v2 history design with new dedicated record kinds rather than overloading public serving records; server-clock committed readback; source-use/retention policy; authenticated capture entry point; bounded seven-day execution budget. Schema publication, any scheduled collector, production writes, legacy repair, model activation and release each remain unauthorized. No automatic promotion criterion is met by this pass.

The smallest next step is **local admission of a bounded prior-boxscore manifest and the frozen prospective cohort protocol**, resolving protected-data allocation and intended-use receipts. After that, review a concrete durable-capture integration before requesting production authorization. It is premature to repair all historical rows or start a new accuracy sweep.

## Reproduction, evidence and verification

Evidence is local under `/Users/tim/.fhfh/forge-evaluation/2026-11-04/pass3/`. Exact per-row histories, run IDs and candidate sources are in `reconciliation-final.json`, SHA256 `499a99fa856f47a2e80860d642e6894c318569c2546ea4085a15ccc526380cc4`. Official source reconciliation is in `authoritative-reconciliation.json`, SHA256 `e393acefe7b4bb54587b512abd188a74a99a82ef0be2eacd9350cbde18e04a0c`. Fresh official JSON hashes/timestamps are in `live-source-receipts.json`. No source payload was silently replaced with a reconciled value.

This pass made 16 successful bounded read-only SQL queries, plus official-site reads. Two current official JSON downloads succeeded. Earlier web-tool URL access and Python TLS attempts failed; system curl succeeded with normal certificate verification. No production application endpoint, cron, ingest, migration or mutation was invoked.

From `web/`:

```sh
npm test -- --run lib/forge-v2/data.test.ts lib/forge-v2/model.test.ts
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' /Users/tim/.fhfh/forge-evaluation/2026-11-04/pass3/reproduce-retarget.ts
npm run typecheck -- --incremental false
npx eslint lib/forge-v2/researchCapture.ts lib/forge-v2/researchBaselines.ts lib/forge-v2/data.test.ts lib/forge-v2/model.test.ts
```

Final tree verification: **320 tests passed across 17 files**, including the 37 focused capture/baseline tests, ledger regressions, horizon evaluation, existing FORGE pipeline/API/integration, goalie accounting/selection, RSO bridge and Trade Analyzer checks. Full repository TypeScript check and targeted ESLint passed. Final owned diff was reviewed; whitespace/conflict checks passed. No build was warranted or run. Reproduce the aggregate from `web/`:

```sh
npm test -- --run lib/forge-v2/evaluation.test.ts lib/forge-v2/model.test.ts lib/forge-v2/data.test.ts lib/forge-v2/contracts.test.ts lib/forge-v2/preparation.test.ts lib/forge-v2/integration.test.ts lib/forge-v2/api.test.ts lib/forge-v2/pipeline.test.ts lib/forge-v2/uncertainty.test.ts lib/forge-v2/horizonEvaluation.test.ts lib/projections/uncertainty.test.ts lib/projections/goalieStarterMixtures.test.ts lib/projections/goalie/goalieOutcomes.test.ts lib/rosterScheduleData/forgeDailyBridge.test.ts lib/buyLowSellHigh/trade.test.ts components/blshTrade/BlshTradeComparison.test.tsx lib/player-forecasts/servedForecastLedger.test.ts
```

Unrelated changes remain untouched; production contracts and the goalie sampler are unchanged in this pass. The earlier opt-in sampler remains disabled. No production writes, migrations, pushes or deployments occurred.
