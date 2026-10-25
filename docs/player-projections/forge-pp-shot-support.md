# ⠕ FORGE PP shot-rate support: engineering cycle

Decision: retain the baseline. No production module, serving flag, database schema,
RSO behavior or Starter Board behavior changes. The offline harness is engineering
evidence only; it cannot qualify historical forecasts, select a parameter, score
predictive performance or approve a release.

Base: `76d507ea84634a91a69f61648d0a58e85e76571b`. The original engineering cycle
was on the isolated `chef/forge-pp-shot-support` branch. The harness was later reconciled into
`octoberBranch` with current compatible dependency pins; the base SHA above remains
the original experiment identity. Ingestion repair and production canaries remain
with their existing owner. No historical branches are merged.

## Existing capabilities and remaining evidence gaps

| Capability | Repository evidence | Gap / prerequisite | Impact and next step |
| --- | --- | --- | --- |
| Multi-season recency pooling and target-specific exposure shrinkage | `modeling/player_forecasts/season.py`: `_weighted_exposure_summary`, `SKATER_SCORING_EXPOSURES` | Isolated predictive benefit is unverified; retained evaluation inputs are required | Preserve existing model; do not duplicate shrinkage |
| Daily PP shot rates and support | `web/lib/projections/stages/skater-stage.ts`: `sampleShrinkage`, `sogPer60PpPreBound`; `queries/skater-queries.ts`: `ROLLING_ROW_SELECT_CLAUSE` | Shared EV/PP support consumes average TOI; cumulative window fields exist but are not selected | Test the single PP support hypothesis below |
| Participation, TOI and goalie starts | `season.py`, `web/lib/projections/starterBoardScoring.ts` | Cutoff-known populations, workload and participation receipts are missing | Required for unconditional counts; preserve existing conditioning |
| Age, rookies, context, injuries, trades and schedule | `season.py`: `_future_age_multiplier`, `rookie_projection_profile`, `_official_state`; `web/lib/projections/rosterEvents.ts` | Historical feature availability and subgroup accuracy remain unverified | Preserve mechanisms; defer modeling changes |
| Cutoffs, lineage, revisions and uncertainty | `web/lib/projections/gameRevisions.ts`, `starterBoardDataset.ts`, `uncertainty.ts` | Reproducible historical snapshots and settlements are missing; daily distributions are unvalidated | Qualify evidence; issue no new intervals |
| Backtests and comparators | `modeling/player_forecasts/daily_board_training.py`, `daily_board_strength.py` | Legacy FORGE values are ineligible for formal comparisons; existing MAE selection is not this protocol | Keep historical diagnostics separate; use MSE when evidence qualifies |
| RSO and Starter Board consumption | `web/lib/player-forecasts/planningContributions.ts`, `offlineFullGameBaselineQualification.ts` | Synthetic contract tests do not certify forecasting accuracy | Preserve primitive statistics and league-scoring boundaries |

Priority: (1) recover the authentic evidence packet, (2) run this one PP support
ablation if qualification succeeds, (3) address separately scoped availability and
coverage gaps. Operational ingestion defects are outside this cycle. The separate
NHL game-win model is not a prerequisite discovered in the inspected skater path.

## Forecast contract and the single hypothesis

PP support should come from the PP exposure supporting the selected PP rate,
rather than EV evidence or average minutes. The harness reproduces the existing
PP rate expression before role bounds: contextual raw rate times the baseline
weight, plus rate 8 times the remaining weight, clamped to [2, 28]. The baseline
weight and context multiplier are inputs; this is not a replay of the whole model.
Five source files are checksum-pinned to prevent unnoticed baseline drift.

Raw rate selection retains canonical-first compatibility, last5 before all, and
observed zero. The candidate uses `E / (E + kappa)`, where E is cumulative PP
seconds from that same window divided by 60. The fixed grid is 5, 15, 30, 60 and
120 prior minutes. Missing/unverified exposure and contradictory positive rates
with zero exposure preserve the original rate and disclose a fallback. Complete
zero exposure differs from zero shots observed during positive exposure. Source
qualification must still establish that the rate and denominator share the same
window, coverage and weighting semantics.

Rate units: shots per 60 PP minutes. Future forecast target: PP shots per eligible
player-game, horizon one authoritative scheduled regular-season game, common
recorded cutoff. Conditional production uses existing workload/scenario evidence;
unconditional counts additionally require compatible participation evidence.
Preserve existing dependence; do not multiply unrelated marginal means. This
harness produces neither count forecasts nor uncertainty intervals.

Keep raw rates, TOI, participation, age, context, conversions, role bounds and
reconciliation unchanged. A supported future integration would add the two
cumulative input fields and a dedicated default-off gate recorded in replay
configuration. Neither runtime change is justified by the current evidence.

## Evidence and acceptance gate

The read-only hosted check on 2026-10-03 found two FORGE input captures, zero frozen
final-pregame revisions, no season releases and no player outcome revisions.
Earlier inspection found 27,772 legacy one-game player rows, with 9,143 written
before puck drop; timestamps alone do not establish cutoff-safe features or
population coverage. The named local season freezes are absent. The season scoring
audit states that 2025–26 was already consumed for development. These facts block
an honest predictive comparison; they do not authorize pipeline repair.

The exported `missing-evidence.json` lists the smallest packet: original eligible
population including eventual nonparticipants; frozen inputs/code/config/schedule
and team-stint identities; same-window PP rates/exposures; workload/participation
receipts; complete outcomes and certified zeros; and previous-use records. Source
availability timestamps must be original. Later corrections can be outcome truth
but cannot become historical features. Inventories and fictional fixtures never
qualify as this packet. Difficult fantasy categories remain in the existing model.

After qualification, freeze exact dates before tuning using whole-slate 60/20/20
chronological splits (floor the training and validation sizes; remaining slates
are test). Protect 2026-01-03 through 2026-04-16. Require at least 20 test slates
and 1,000 eligible test player-games. Reused windows are disclosed retrospective
diagnostics, not an untouched prospective test.

Compare unchanged FORGE, carry-forward and pooled rates on the same frozen
population, cutoff and horizon. Select kappa using validation MSE only; ties choose
the larger prior. Retain all trials, including negative results; test once after
selection. Acceptance: at least 2% lower test MSE, positive lower bound of a 95%
paired slate-bootstrap interval (2,000 resamples, seed 20261003), subgroup MSE
regressions at most 5% for groups of 100+ observations, and runtime increase at most
10%. Report MAE, ranking, bias, coverage, sample sizes, F/D, thin PP, rookie, trade
and availability errors. Limit execution to five settings and 30 minutes.

Stop if evidence, sample, accuracy, runtime, compatibility or independent-review
gates fail. Do not broaden to another experiment. Here the evidence gate fails
before tuning: no selected kappa, holdout result, predictive loss or accuracy gain
is reported. Synthetic rate values are mechanics, not forecasting results.

## Reproduction and verification

The prospective recorder consumes the exact private export contract in
[the evidence-packet specification](forge-pp-shot-evidence-packet.md). It maps
existing snapshots, frozen revisions, replay and settlement interfaces to the
additional population, PP-window and PP-label receipts that are missing today.
`pp_evidence_capture.py` implements explicit `record` and `seal` entry points for
original acquisition receipts, with immutable feature/forecast retention and
append-only freeze/outcome revisions. It does not collect live sources, run FORGE,
train, qualify forecasts or enable a candidate. The existing acquisition owner
supplies the original exports; serving remains unchanged.

From the worktree root, using the existing Python environment (no installs):

```sh
/Users/tim/Code/fhfhockey.com/.venv/bin/python -m pytest modeling/player_forecasts/tests/test_harness.py -k pp_support -q
/Users/tim/Code/fhfhockey.com/.venv/bin/python -m modeling.player_forecasts.pp_shot_support --output /private/tmp/forge-pp-shot-support-engineering
git diff --check
```

Use a fresh output directory; the exporter refuses overwrite, repository output
and baseline dependency drift. Optional `--inventory /absolute/path.json` retains
the discovery record and its hash without granting evidence eligibility. Outputs:
protocol, fictional fixtures, all five-setting mechanics, missing-evidence manifest
and a report with source/artifact hashes and explicit null predictive results.

Focused tests cover matching windows, canonical zero, average versus cumulative
exposure, absent and invalid exposure, zero support, inconsistent observations,
bounds, parameter rejection, deterministic export, dependency drift and overwrite
refusal. They do not prove forecast accuracy. No new downstream means, schedules,
goalie allocations or scoring schemas are introduced. Verification, independent
review and exact patch identity are recorded in the separate local cycle receipt;
passing engineering checks never enables serving.

## Canonical reconciliation and durable receipts

The original source checkpoint is `2e90a968214c10f83741baed9f56846c4ae600fc`;
the reconciled canonical base is `cfaac232e4c901cd305f76a9f3e50838b505d92a` on
`octoberBranch`. Only compatible PP-expression dependencies were re-pinned after
inspection; the original experiment identity/protocol is preserved. The recovered
original patch has SHA-256
`a42a4f647ae4fe1d2d11d5b8a7849bb5cac77a401ef3d5d6a7d04b26b5100a38`.
Durable private artifacts live at
`/Users/tim/.codex/artifacts/forge-pp-shot-support/`, including the recovered patch,
clearly labeled recovered cycle/review records, fresh canonical engineering
export and reconciliation receipt. Recovered summaries do not claim byte identity
with the lost temporary receipts. Capture review/check/source hashes are retained
alongside them. Git staging/commits remain with the concurrent integration owner.

Recorder tests use fictional receipts and verify mechanics: timing, original
population retention, PP selection/window consistency, missing observations,
nonparticipant certificates, per-field zero proofs, label corrections, retained
exclusions, private output and immutable ancestry. They establish no live capture,
forecast accuracy or production readiness. Exact executable replay, availability,
weighted rates and provider labels remain pending independent qualification.
