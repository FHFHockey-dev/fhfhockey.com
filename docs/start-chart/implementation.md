# Starter Board implementation record

**Current execution status:** [Launch and validation](launch-validation.md) records
the active expanded goal, real-data artifacts, Yahoo work, three migrations,
rollout controls and remaining completion gates. The original foundation record
below describes the earlier shared-board release.

## Accepted scope

The shared board ships in stages: reproducible inputs/publication; current-day
evidence within five minutes; participation-aware scoring and a decision-first
page; measured distributions/model improvements. Existing sources only. Yahoo
personalization follows using existing account settings and Draft Pro access.
No automatic lineup submission, production migration, remote backfill or model
promotion is authorized by this record.

Research input: `deep-research.md` is the verbatim supplied report. Its claims
about the repository were based on earlier static tracing, not live inspection.
Existing Player Forecasts evidence/artifact/evaluation infrastructure, goalie
performance calculations, Yahoo synchronization and Draft Pro must be reused
where compatible. Private shadow model gates and locked research contracts stay
intact. Statistical superiority and live latency require observed evidence.

## Dependency map

IFTTT events → parsed line source snapshots → immutable Player Forecasts
observations/assignments → cutoff-safe game overlay → FORGE skater/goalie stages
→ captured input transcript + complete game revision → Starter Board contract
→ scoring profile → positional/category ranking → public board.

Historical completed-game inputs remain separate from pregame evidence.
Evaluation consumes captured inputs and settled outcomes, not current rosters or
backfilled news pretending to have been available historically.

## Execution status

| Work | Local implementation | Remaining evidence or work |
| --- | --- | --- |
| Input capture and replay | Async-scoped query transcripts, immutable snapshots, input/output hashes, code/model/config identity, replay CLI with live reads/writes suppressed | Replay a representative real FORGE snapshot; current deterministic replay test uses a small calculation fixture |
| Safe game publication | Append-only service-only revisions, atomic publication, pregame cutoff, affected-game replacement, previous revisions, supersession guard | Apply migrations and activate deliberately; operator selection and immutable freeze are now implemented; see the launch record |
| Same-day news | Partial EV/defense/PP/availability/goalie assertions, separate roles, cutoff-aware corrections and reviews, whole-game queue | Activate worker dispatch; observe ingestion coverage and five-minute latency under real load |
| Participation and scoring | Explicit conditional/unknown skaters, explicit-out zero rows, per-candidate goalie production weighted once, zero relief assumption, ten supported scoring categories, category sorting | Probability fitting helpers exist; trustworthy training labels and calibration remain pending |
| Decision-first board | Rankings before team context, local scoring, probability/conditioning labels, evidence/conflicts, comparable revision deltas, 30-second refresh | User review and prospective freshness monitoring |
| Daily evaluation | Separate research-only contract and offline evaluator for five supplied comparators, chronological/cutoff checks, paired game/slate reports, segments, ablations, calibration and joint-draw scoring | Audited export and four real-data baseline comparisons now exist; current FORGE replay, context ablations and prospective evaluation remain |
| Distributions and model improvements | Means-only public fallback; supplied joint samples can be evaluated without adding category quantiles | Seeded hockey scenario generation, interval validation, challenger fitting and evidence-backed component promotion |
| Yahoo / Draft Pro | Private endpoint, owned-team selection, refreshed roster/settings/availability, eligible-slot optimizer and board panel | Provider acquisition timing, live acceptance and streaming gains remain incomplete |

The full improvement plan is not complete. Local publication, evidence, scoring
and page infrastructure is implemented; empirical model work and personalization
remain separate bounded releases. No trained participation model, calibrated
interval or predictive improvement is claimed.

## Files and contracts

- `web/lib/projections/inputCapture.ts`, `gameRevisions.ts` and
  `run-forge-projections.ts`: captured reads and publication lifecycle.
- `dailyBoardEvidence.ts`, `starterBoardQueue.ts`, existing
  `lib/player-forecasts/sourceObservations.ts`: cutoff overlays and news updates.
- `starterBoardScoring.ts`, `startChartContract.ts`,
  `web/pages/api/v1/start-chart.ts`: public version 2 forecasts with independently
  versioned ranking contract. GET remains compatible. POST accepts
  `{ profile: { skater: { GOALS: 3 }, goalie: { SAVES_GOALIE: 0.2 } },
  mode: "points", goalieSort: "fantasy" }`; category mode additionally requires
  `category`. Supplied population maps replace that population's weights.
  Unsupported keys return validation errors; missing modeled values remain null.
  POST scoring is private/no-store and does not modify the shared forecast cache.
- `web/pages/start-chart.tsx`: public comparison board; scoring changes operate
  on published statistics without recomputing hockey forecasts.
- `modeling/player_forecasts/daily_board.py` and `daily-board-contract-v1.json`:
  evaluation-only additions; existing research contracts and holdout stay intact.

Source publication, application receipt and acceptance are distinct. Queue rows
record acceptance, dispatch and completion. Snapshots record the evidence cutoff,
last read completion and calculation completion; revisions record publication.
The public revision contract includes these cutoff/calculation/publication times.
Browser polling is tested; private visible-revision receipts and a probe now exist.
Production latency measurements remain pending.

Historical prior-game line-combination queries retain their strict date boundary.
Current-day evidence is a separate overlay. Explicit historical cutoffs are
classified as reconstruction and cannot publish as live pregame revisions.

## Activation (not executed)

The current three-migration order, independent flags, minute scheduler,
16-game dispatcher, lease fencing, rollback endpoint, browser probe, capacity
estimate and unfinished activation gates are in
[the launch execution record](launch-validation.md#production-package-preparation--not-ready-for-approval).
Production activation is not yet ready for approval. No remote environment,
migration, deployment or schedule was changed.

## Reproduction and evaluation

From `web/`, replay an exported **private** input-observation JSON containing
`payload` and `payload_hash`, using its captured source code and model settings:

```sh
START_CHART_GAME_REVISIONS=true NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/replay-forge-snapshot.ts /path/to/private-observation.json
```

The replay refuses uncaptured reads, unused reads, changed model configuration,
checksum mismatch and changed projection output. Do not publish private input
transcripts as browser assets.

From the repository root, evaluate an audited daily dataset:

```sh
python3 -m modeling.player_forecasts.daily_board --input /path/daily-board.jsonl --output /path/daily-board-report.json --training-end 2025-09-30 --validation-start 2025-10-01 --validation-end 2025-12-31
```

Each JSONL row supplies `contractVersion`, `game_id`, `player_id`, `game_date`,
`target_key`, `conditioning`, `evidence_classification`, `snapshot_hash`,
`historical_team_membership_verified`, `maximum_feature_available_at`, `cutoff_at`,
`scheduled_start_at`, `trained_through`, `settlement_status`, `outcome`, and
`estimates` for all five named comparators. Conditional observations additionally
need `played` or `started`. Optional `segments`, comparator `samples` and ablation
estimates support the additional reports. Select one declared decision checkpoint
per player/game/target; duplicate checkpoints are rejected. Supplied comparator
training/provenance must be audited separately; this evaluator does not fit them.
Never fill historical news-arrival timestamps with guesses. Existing protected
2026-01-03 through 2026-04-16 research dates are rejected.

## Foundation verification / rollout

The following is the earlier foundation check record; see the launch record for
the subsequent checks and complete-schema rehearsal. Passed locally:

- Focused Vitest: source observations (20), Lines CCC ingestion (33), FORGE helpers
  (81), Starter Board pipeline (15), Start Chart API (29), page tests (14).
- Isolated PostgreSQL test applying the two actual migrations: complete/partial
  and failed publication, puck-drop freeze, snapshot binding/future cutoff,
  unaffected games, append-only/private access, fixed coalescing, duplicate
  claims, corrections, supersession and overlapping run scopes. Uses minimal
  prerequisite tables, not a full production schema migration rehearsal.
- Python evaluator: five focused tests, including chronological/holdout checks,
  paired/segment/calibration reports and joint category accounting.
- Start Chart Playwright: six cases across 1440/1024/390/320 widths, scoring,
  category and goalie sorts, conditional labels, refresh, filters/fallback and
  overflow. Executed in targeted runs; no production deployment.
- TypeScript with `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
  --incremental false`. The default-memory attempt exhausted its heap; the
  increased-memory check passed.

Commands for focused reruns (from `web/` unless noted):

```sh
npm test -- lib/projections/startChartPipeline.test.ts __tests__/pages/api/v1/start-chart.test.ts
node scripts/verify-start-chart-publication.mjs <local-postgres-container>
npx playwright test e2e/start-chart.spec.ts --project=chromium --workers=1
```

From root: `python3 -m pytest modeling/player_forecasts/tests/test_harness.py -k daily_board -q`.
No production build, deployment, production SQL, large backfill, live Yahoo call
or empirical model promotion was performed. The later real-data baseline training
and updated checks are recorded in [the launch record](launch-validation.md).
