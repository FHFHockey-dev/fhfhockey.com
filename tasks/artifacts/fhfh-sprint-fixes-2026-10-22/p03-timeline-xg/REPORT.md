# P03 / S04 timeline xG handoff

Local implementation and focused offline verification complete. Independent review pending. S08 is not included.

## Behavior and provenance

- Removed the empty-approved-result fallback that queried xG without an approval filter. The only xG query now requires `source_model_approved=true` and `source_prediction_type=shot_goal` and selects both flags plus game identity. The adapter checks those flags again and requires a positive integer game ID and a source date.
- The writer contract is visible in `web/lib/xg/aggregates.ts:635–647`: only approved `shot_goal` predictions enter the aggregate; team-game output carries `source_prediction_type=shot_goal` and `source_model_approved=true` (around lines 429–451). The schema comment at `supabase/migrations/20260716112908_production_schema_baseline.sql:14890` describes this table as approved shot-goal team-game aggregates. These files were read only.
- WGO extraction is date-bounded in `web/lib/supabase/Upserts/fetchWGOdata.js` (around lines 227 and 383–395) and stores `games_played`. The old timeline fixture itself contains a 30-game sample. Timeline output retains this count and calls rows dated observations; xG columns explicitly identify per-game totals. No ingestion source was edited or invoked.
- Independent query failures produce source warnings and preserve values from the successful source. Dates are the union of available sources, with no forward fill. Missing/non-finite/negative xG is null independently per category; genuine zero survives. Multiple different games sharing a daily slot suppress that ambiguous xG slot; preferred version ordering for one game is unchanged.
- The chart receives null-bearing dated rows and does not connect across unknown values. Sample size is displayed for WGO, and deltas describe five available observations rather than five games.

## Before / after evidence

The immutable before copies and `BEFORE.json` match the H04 audited hashes. The final mounted regression file was copied into the baseline snapshot without changing baseline runtime files. `final-red.log`: 7 failed / 1 passed. The unapproved-only fixture displayed xGF 9.00; an xG error hid valid WGO, a WGO error hid approved xG, missing xGF erased valid xGA, null dates disappeared from chart data, and a multi-game sample was labeled as games. The existing both-sources-fail behavior remained a passing control.

`final-tests.log`: 27 passed (8 mounted consumer tests and 19 helper tests). The mocked query builder applies real equality filters and column projection. Helper fixtures cover false/null/missing/coerced approval, unsupported prediction type, missing identity/date, partial categories, invalid numeric values, zero, source-only dates, duplicate revisions and ambiguous same-date games. Recharts is stubbed to inspect data/line props; no browser rendering claim is made.

## Exact application file inventory

- `web/components/MetricsTimeline/MetricsTimeline.tsx` (modify), SHA-256 `07bb3c3919ae684504551ab05afddada6dfe9fb71b8af282ccd11ea562779ebe`.
- `web/components/MetricsTimeline/metricsTimelineData.ts` (modify), SHA-256 `59ad16886a71aa2c8d0e0d555f1b426439b6b6242dcc887d187dee85eb9bd441`.
- `web/components/MetricsTimeline/metricsTimelineData.test.ts` (modify), SHA-256 `fabc0c29b1e1e772fb6e8f9461f881584ebff7cb58ecab2b2588608ce5c13622`.
- `web/components/MetricsTimeline/MetricsTimeline.test.tsx` (add), SHA-256 `83766270718f896c4d810509d1c4a6b67036c8dac65534aadc26be23720465b4`.

Only these four application files changed for this packet. All 13 accepted A7–A9 candidate hashes match. No goalie formulas, canonical registers, manifests, dependencies or locks were edited.

## Checks and commands

Commands ran against environment-free snapshots with synthetic credentials, Node 22.11.0/npm 10.9.0, fetch/socket/HTTP network guards and canonical node_modules reused without installation. `runtime.txt` confirms the runtime. The durable wrappers and `stage-offline.py` use the existing queue VERIFY isolation recipe; no canonical application command was run.

```sh
sh tasks/artifacts/fhfh-sprint-fixes-2026-10-22/p03-timeline-xg/run-tests.sh /tmp/fhfh-queue-check-_5una0sx/isolation/snapshot/web components/MetricsTimeline/MetricsTimeline.test.tsx
```
Result: exit 1; expected red: 7 failed, 1 passed. Evidence: `final-red.log`.

```sh
sh tasks/artifacts/fhfh-sprint-fixes-2026-10-22/p03-timeline-xg/run-tests.sh /tmp/fhfh-queue-check-fuikckkx/isolation/snapshot/web components/MetricsTimeline/MetricsTimeline.test.tsx components/MetricsTimeline/metricsTimelineData.test.ts
```
Result: exit 0; 27 passed in 2 files. Evidence: `final-tests.log`.

```sh
sh tasks/artifacts/fhfh-sprint-fixes-2026-10-22/p03-timeline-xg/run-check.sh /tmp/fhfh-queue-check-fuikckkx/isolation/snapshot/web npm exec --offline -- tsc --noEmit --project tsconfig.p03.json
```
Result: exit 0; passed, no diagnostics. Evidence: `final-typecheck.log`.

```sh
sh tasks/artifacts/fhfh-sprint-fixes-2026-10-22/p03-timeline-xg/run-check.sh /tmp/fhfh-queue-check-fuikckkx/isolation/snapshot/web npm exec --offline -- eslint --report-unused-disable-directives-severity warn components/MetricsTimeline/MetricsTimeline.tsx components/MetricsTimeline/metricsTimelineData.ts components/MetricsTimeline/MetricsTimeline.test.tsx components/MetricsTimeline/metricsTimelineData.test.ts
```
Result: exit 0; passed, no diagnostics. Evidence: `final-lint.log`.

```sh
git diff --check -- web/components/MetricsTimeline
```
Result: exit 0; passed.

To recreate a snapshot, run `python3 tasks/artifacts/fhfh-sprint-fixes-2026-10-22/p03-timeline-xg/stage-offline.py tasks/artifacts/claude-audit-fix-queue-2026-10-22`, then copy this packet's `tsconfig.p03.json` into the returned web directory and substitute that path in the passing commands above. The snapshot operation aborts on source drift.

## Fixed review candidate and boundaries

- Candidate: `CANDIDATE.json`, SHA-256 `480166b2afec0e96ab1decaa8e6e728b5d3eae65db77784e28fa7bae34690b3f`. `SHA256SUMS` pins all four application files; `packet.patch` is against the preserved before files.
- Initial HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`; handoff HEAD `716896be8325a64f5cbd3ece9a1fdab48c50733f`. Other agents advanced HEAD with `/db/runner` and AdminPageGate commits during the work; neither commit changed this packet's paths. No commit or branch operation was performed here. Tested source hashes, not HEAD alone, identify this dirty-tree candidate.
- Final snapshot: `/tmp/fhfh-queue-check-fuikckkx/isolation/snapshot/web`. Baseline snapshot: `/tmp/fhfh-queue-check-_5una0sx/isolation/snapshot/web`.
- Source approval is enforced as stored by the aggregate writer. This does not requalify models, audit historical flag accuracy/revocations, or introduce current-champion selection. The separate homepage consumer has registry selection; this bounded patch preserves the timeline's existing approved feature-version/update preference.
- No claim of upstream date-universe completeness, pagination completeness, browser visual verification, production correctness or broad S04 acceptance. Empty/partial source sets are explicit, but no missing upstream games are invented.
- No network requests, production services, NST requests, credential access, ingestion/runner modifications, TJ process access, commits/pushes/migrations/deployments or dependency changes. No approval or blocker pending; independent review is the next step.

## Task-only files

- Diary: `tasks/diaries/2026-10-22-codex-p03-timeline-xg.md` (working context, excluded from acceptance evidence).
- Artifact inventory in this directory:

- `ARTIFACT-SHA256SUMS`
- `BEFORE.json`
- `CANDIDATE.json`
- `REPORT.md`
- `SHA256SUMS`
- `after-tests.log`
- `before-tests.log`
- `before/web/components/MetricsTimeline/MetricsTimeline.tsx`
- `before/web/components/MetricsTimeline/metricsTimelineData.test.ts`
- `before/web/components/MetricsTimeline/metricsTimelineData.ts`
- `final-lint.log`
- `final-red.log`
- `final-source-fingerprints.json`
- `final-tests.log`
- `final-typecheck.log`
- `lint.log`
- `packet.patch`
- `run-check.sh`
- `run-tests.sh`
- `runtime.txt`
- `stage-offline.py`
- `tsconfig.p03.json`
- `typecheck.log`
