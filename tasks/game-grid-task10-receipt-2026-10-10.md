# Game Grid task 10: local presentation receipt

Status: completed locally on canonical `octoberBranch`; production category availability remains dependent on a qualified reader payload. This receipt covers the fresh task-10 requirements supplied by the coordinating parent, supplementing the earlier task-10 disclosure scaffold in `tasks-game-grid-execution-2026-10-07.md`. It does not close live producer qualification or production acceptance.

Baseline: clean `octoberBranch` at `a9a6964b05638f4744e5cacb3df012ffaa1bcf01`, with supplied release `ca81578afdae9b85643aee2c4d87d3ded3099c75` in local history. No deployed source readback occurred. No branch/worktree creation, switches, resets, push, build/deployment, provider access, credentials, database writes or native forecast execution occurred.

## Exclusive owned paths

- `web/components/GameGrid/TeamDetails.tsx`
- `web/components/GameGrid/TeamDetails.module.scss`
- `web/components/GameGrid/TeamDetails.test.tsx`
- `web/e2e/game-grid-previews.spec.ts`
- `web/e2e/game-grid-previews.config.ts`
- `web/e2e/fixtures/game-grid-previews/App.tsx`
- `web/e2e/fixtures/game-grid-previews/data.ts`
- `web/e2e/fixtures/game-grid-previews/index.html`
- `web/e2e/fixtures/game-grid-previews/server.mjs`
- This receipt.

The forecast worker's `web/scripts/qualify-native-players-offline*` and `web/scripts/fixtures/` files are separate work and were not edited or staged by this lane. Shared execution checklists were not changed.

## Result

The shared detail component now consumes optional existing `TeamForecastRecord[]` and `TeamForecastContext` inputs. Independent aggregate injection was removed: weekly categories derive from the same admitted per-game records shown in each game card. G/A/SOG/HIT/BLK/PPP and the existing optional PIM remain independent; goals never supply another category. Numeric zero, a covered bye, unavailable data and known partial subtotals remain distinct.

Game cards show full-game pregame category means, per-category coverage and available model/cutoff/issuance/source-watermark/source-availability metadata. The existing contract's admission checks apply without changing the producer contract. Presentation also checks displayed season, team, actual date, start identity, selected horizon, schedule coverage and pregame state. Duplicate/stale/conditional/mismatched records are withheld. Started games are not displayed as live remaining-game forecasts.

Remaining-week totals end on Sunday. Next-week and excluded-date cards can retain qualified full-game context, but their values do not enter these totals. Started, completed, inactive and unknown-eligibility games are excluded. An inferred date cannot create a confident empty week. Totals explicitly sum the displayed game means rounded to one decimal; regression inputs of 1.24 + 1.24 display 1.2 + 1.2 = 2.4. Incomplete schedules label numeric amounts as known subtotals.

Existing disclosures stay native buttons with names, expanded state and associated panels; Team HQ stays a separate link. Enter/Space open and close them. Close controls restore focus. Multiple open team IDs survive sorting, same-week refresh, forecast span and orientation changes. Corrected schedule behavior withholds rows while coverage is incomplete, then restores open panels when complete data returns. Selecting a different week resets the open set. This refers to data refresh in the mounted view; full document reload persistence is not added.

The existing BPA styling, header/date controls, date windows, Week Score and scoring/crowding/SoS/O-U policy were preserved.

## Verification

Node actually used: 22.11.0. All commands ran from `web/`.

- **Passed:** `npm test -- --run components/GameGrid/TeamDetails.test.tsx components/GameGrid/utils/teamForecasts.test.ts components/GameGrid/SortableHeaders.test.tsx components/GameGrid/utils/calcWeekScore.test.js` — 105 tests / 4 files (28 component, 48 contract, 10 sorting, 19 score).
- **Passed:** scoped `npx eslint` on the owned TSX/TS/MJS component, tests, config and fixtures; no lint diagnostics.
- **Passed:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; no TypeScript diagnostics.
- **Passed:** `npx playwright test -c e2e/game-grid-previews.config.ts` — 5 actual Chromium scenarios with 24 teams, desktop keyboard sorting, 390/320px keyboard sorting/reflow, Enter/Space activation, focus indicators/return, sorting/refresh/span/orientation persistence, new-week reset, partial-to-ready refresh and covered empty schedules. Qualified/partial/missing/stale/zero/unknown fixtures verify displayed totals and source metadata.
- **Passed:** axe audit of the rendered qualified detail fixture at 320px, zero violations. Audit scope is the isolated detail fixture; it does not establish whole-site accessibility or actual assistive-technology behavior.
- **Passed:** visual inspection of expanded desktop and 320px screenshots; `git diff --check` and owned-path diff review.
- **Not run:** production/provider/data reads, real forecast reconciliation, live acceptance, VoiceOver and native browser 200% zoom, application production build, push/deployment.

Recoverable initial checks exposed outdated weekly-only assertions, a fixture type error, fixture startup/module issues and selectors that did not account for desktop labels, repeated headers or the controls menu. These were corrected; the final commands above passed. Chromium executed successfully; this was not test discovery alone.

## Evidence and remaining dependency

Reproducible fixtures are committed with the UI. The Vite fixture replaces production reader/hooks, rejects production Supabase/NHL reader imports, uses temporary caches without environment files, and browser requests are limited to the loopback fixture server. No hosted input or real-data category mean is claimed.

Screenshots and logs are saved outside the checkout at `/Users/tim/Documents/Codex/2026-10-09/task-4/game-grid-task10/`: `desktop-24-team-expanded.png`, `narrow-390-expanded.png`, `narrow-320-expanded.png`, `qualified-payload-desktop.png`, `qualified-payload-320.png`, `accessibility-audit.json`, four check logs and `evidence-sha256.json`.

Production `GameGrid` currently supplies schedule data without an admitted category record payload; its expanded categories truthfully remain unavailable. Real category totals and team/player reconciliation require the producer owner to qualify and supply compatible per-game records/context. No serving flag or provider fetching contract was changed, and no production lineage was inferred from schedule data. This dependency does not block the completed presentation feature.

## Independent review correction: aggregate forecast vintage

The independent review of `4dacc46721735aa7549a6b035069f29a3e0c4731` blocked acceptance on P2: individually admitted game records with different cutoffs/models/runs were summed as a complete weekly total. The fix below addresses that finding locally; independent re-review remains the coordinating owner's decision. Correction baseline was canonical `octoberBranch` at `ec950e7604ae471ae6fa8037d8dc51a86496b0a5`. Concurrent optimizer work and the shared goal-objective task list were preserved.

**Aggregate policy:** for each category, all known eligible game records must share the same decision cutoff instant, model version, qualified shared run/input manifest (`comparisonLineageId`), immutable source snapshot (`sourceWatermark`), full-game scope, conditioning, units and event-credit definition. Individual admission already requires the same supplied season/schedule/roster context and safe source/issuance/availability/expiry timestamps. Timestamp equivalence is compared as an instant, so ISO strings with different timezone offsets can match.

Game IDs, start times, per-game output `revisionId`s, issuance/reader-availability times and expiries need not be identical; each must still pass its own existing admission checks. The shared run manifest is generation evidence for this stricter total policy, not a claim of permission to serve or reconcile team/player forecasts. No producer contract, API, allowed-use flag or scoring formula changed.

Matching source watermarks is deliberately conservative: the current contract supplies no rule for proving different input snapshots compatible. If any known records lack a common aggregate basis, the weekly mean stays null/unavailable and the card says “Mixed forecast vintages — weekly total unavailable.” Its count is labeled “Per-game coverage,” and the individual values and source provenance remain visible. No compatible subset is selected to conceal a conflicting known record. A missing record still yields an honest known subtotal over the compatible records that are present. Zero values are subject to the same compatibility check; mixed zeroes do not become a confident total.

Correction edit ownership is limited to `TeamDetails.tsx`, `TeamDetails.test.tsx`, the preview `App.tsx`, the existing payload browser spec, and this receipt. No layout/disclosure/eligibility or source-reader rewrites were made.

Correction verification, from `web/` with Node 22.11.0:

- **Failed before the fix as intended:** six focused new regression cases reproduced mixed run/cutoff/model/source totals and mixed-zero totals.
- **Passed after the fix:** `npm test -- --run components/GameGrid/TeamDetails.test.tsx components/GameGrid/utils/teamForecasts.test.ts` — 82 tests / 2 files (34 details, 48 unchanged contract). Distinct output revisions and equivalent cutoff timestamps qualify; existing partial, actual-zero, elapsed-game and missing-data regressions remain passing.
- **Passed:** `npx playwright test -c e2e/game-grid-previews.config.ts --grep qualifying` — the affected actual Chromium payload journey, including compatible totals, retained mixed per-game values/provenance, category-specific warning, unaffected compatible zeroes and 320px warning reflow. This targeted rerun does not re-claim the unrelated keyboard/sorting/layout checks; their unchanged prior owner and independent-review evidence remains available.
- **Passed:** scoped ESLint for the four changed source/test/fixture files; repository `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; owned diff/whitespace inspection.
- **Passed:** axe on the mixed-vintage fixture at 320px, zero violations, 30 passed rules and no incomplete rules.

Correction logs, the pre-fix failing receipt, mixed-vintage desktop/320px screenshots and audit are saved at `/Users/tim/Documents/Codex/2026-10-09/task-4/game-grid-task10-vintage-fix/`. Synthetic presentation evidence does not qualify a live producer. Production category payloads remain unavailable, and no live validation, deployment or data write occurred.


## Reader wiring correction — 2026-10-10

**Status:** local presentation and actual reader-consumer wiring verified; production category totals remain blocked on a qualifying producer/publication contract. This receipt does not declare production forecasts available.

The selected GameGrid now uses a bounded GET of the existing public `/api/v1/projections/teams?date=<current Eastern date>&horizon=1` reader. It passes records, independent schedule/roster context, read status and check time into TeamDetails. One batch serves all selected teams; sorting and opening disclosures do not fetch. Schedule identity/receipt changes and an explicit retry invalidate earlier results. An obsolete completion cannot overwrite a newer request; errors and a 15-second timeout leave schedule cards available. A timer rechecks at puck drop or record expiry, with a maximum five-minute interval, so full-game pregame means cannot persist as live remaining-game values.

The transport decoder accepts only explicit fields of the existing TeamForecastRecord presentation contract, a matching shared reader run, and independently supplied TeamForecastContext. It never synthesizes context/revisions/admission from forecast records or converts component goals, player aggregates, research artifacts or shots into category totals. Missing reader context leaves all means unavailable. Admission, expiry, credit/unit/scope/conditioning and schedule identity checks still run in TeamDetails; compatible-vintage totals retain the prior correction.

The existing NHL schedule response now preserves upstream `startTimeUTC` and `venue`, and records `retrievedAt` when the schedule reader receives its response. Selected 7/10-day hooks carry separate receipt times by covered date; preview cards label those as retrieval times. No upstream source observation/publication timestamp was established, so provider source freshness remains unavailable. No calendar, Week Score, SoS, crowding, O/U, four-week, OMT, logo/info, RSO, provider request, API producer, model or serving-flag behavior changed. Expanded native headings now follow h2/h3/h4 under the Game Grid h1, retaining their existing sizes and spacing.

### Real response and producer limits

Parent-supplied cloud evidence applies to deployed build `IlVhzsL9pRi_zqJo2FN_0`, before this local fix: schedule `/api/v1/schedule/2026-10-05` had 47 games but omitted start/venue/observation freshness; `/api/v1/forge/players?date=2026-10-10&horizon=1` had 41 baseline-v1 rows resolved September 29, all degraded/hard-stale, without a qualifying team-game contract; `/api/v1/game-predictions/latest` had count 0. Those three responses were not re-fetched on the Mac and do not verify the new code in production. Subsequent unauthenticated, read-only Mac GETs of the existing `/api/v1/projections/teams?date=2026-10-10&horizon=1` and `date=2026-10-09` (current Eastern date) each returned HTTP 404 JSON: `No succeeded projection run found for date=<requested date>`. Exact responses and headers are retained as `public-teams-2026-10-{09,10}.{json,headers}` in the evidence directory. No credential or generation endpoint was used. This adds a concrete current-run publication gate before category-contract qualification.

Code/schema evidence: `/api/v1/projections/teams` currently returns legacy `forge_team_projections` rows (run/date/game/team and ES/PP/PK goals/shots/TOI), without the independent context or full TeamForecastRecord fields. The new qualified HTTP fixtures are compatible presentation-contract examples, **not** evidence that this API currently publishes that shape. No endpoint, database schema, writer or serving permission was changed to produce it.

`web/lib/projections/nativeGoalAccounting.ts` explicitly declares `fullGameEligible=false`, `fullOfficialPlayMean=null`, `unconditionalMean=null`, `informationCutoffAt=null`, unknown game-occurrence probability and these gaps: missing native PK estimator, unproved regulation strength partition, overtime, empty-net accounting, shootout exclusion and information cutoff. Its roster coverage declares unknown residual means. A true public producer must supply explicit G/A/SOG/HIT/BLK/PPP (PIM if supported) category means, credits, unconditional full-game scope, verified game/season/start, independent roster and schedule revisions, allowed uses, shared run/model/cutoff/source snapshot, distinct output revisions, source availability/issuance/publication/expiry and honest coverage/unknown residuals. Current ES/PP means cannot satisfy those requirements. `gameContract.ts` is research_only and has no public team publisher; player-forecast latest/dashboard readers are admin-only. Enabling those flags, inventing missing categories or running a refresh would not resolve these gates safely.

### Verification and evidence

- Passed: `npm test -- components/GameGrid/utils/useTeamForecasts.test.tsx components/GameGrid/utils/useSchedule.test.tsx components/GameGrid/TeamDetails.test.tsx components/GameGrid/utils/teamForecasts.test.ts lib/NHL/server/index.test.ts components/GameGrid/utils/calcWeekScore.test.js components/GameGrid/SortableHeaders.test.tsx` — 170 tests, 7 files. Includes actual HTTP-reader consumption, legacy rejection, independent context/run checks, explicit zero, malformed/oversized payloads, race/error/timeout recovery, same-day elapsed games, receipt/start/venue propagation, category admission and retained score guarantees.
- Passed: scoped ESLint on changed GameGrid/TeamDetails/hook/types/server/tests; `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; focused diff whitespace check.
- Passed: `npx playwright test -c e2e/game-grid-previews.config.ts` — 6 actual Chromium scenarios, isolated HTTP fixtures and blocked external traffic. Covers 24 teams, keyboard Enter/Space, sorting without another read, same-week refresh, new-week reset, 7/10-day controls, orientation, empty/partial schedules, qualified/partial/stale/mixed/zero/legacy/error/retry payloads and 1920/1180/390/320px.
- Axe: direct category panel has 0 violations, 30 passed rules, no incomplete rules; full grid with wired HTTP consumer has 0 violations, 48 passed rules, 2 incomplete review items (`aria-valid-attr-value`, `color-contrast`). No claim of manual screen-reader or complete WCAG verification.
- Evidence: `/Users/tim/Documents/Codex/2026-10-09/task-4/game-grid-task10-reader-fix/` contains final unit/lint/TypeScript/browser logs, the prior heading-order failure log, reader screenshots at 1180/320px, 24-team desktop and narrow screenshots, accessibility JSON, patch and handoff.

No direct database queries/writes, migrations, native forecast execution, provider refresh, credentials, push/deploy, new branch/worktree, branch switch/reset or desktop cursor use. The user/other-worker dirty RSO, next-env and task files are preserved and excluded from the path-specific local commit. Parent must review the optional qualifying transport seam and own the unresolved producer/publication work before any claim of production totals.


## Bounded producer follow-up — 2026-10-10

Read-only Supabase queries against the connected `fhfhockey.com` project establish **one deployed endpoint attempt on October 9 EDT, no successful publication**. The `run-projection-v2` audit at `2026-10-09 10:12:06.223982Z` (6:12 a.m. EDT), horizon 5, failed HTTP 500: `Incomplete NHL API shift player manifest for game 2026010048`. The October 8 attempt likewise failed for `2026010037`. Neither game has stored `nhl_api_shift_rows`. No `forge_runs` rows were created on October 9 EDT or exist for as-of October 9/10. The latest populated success is as-of September 29, horizon 1, run `ab10333f-3f32-4466-8d0e-7a3b71e8f52d`, with two team rows. Older September 24/25 horizon-5 successes exist but have zero team outputs. Absence of a served result therefore does not mean no deployed job ran; the deployed job failed during preflight before `createRun`.

Exact path: `pages/api/v1/projections/teams.ts` → `requireLatestSucceededRunId(q.date)` in `lib/projections/apiHelpers.ts` → newest `forge_runs` row for exact date and succeeded status → `forge_team_projections` filtered by run/date/requested horizon. The initial run selector does not consider horizon; that is a separate reader limitation, but cannot explain October 9/10 where **all** horizons have no run. Producer: `pages/api/v1/db/run-projection-v2.ts` calls `runProjectionPreflightChecks` before `runProjectionV2ForDate` / `queries/run-lifecycle-queries.ts:createRun`; the preflight calls `shiftChartCompletenessServer.ts:classifyStoredShiftChartStrengthGamesAgainstRawSource`.

The smallest local correction is confined to `shiftChartCompletenessServer.ts` and its existing tests: batch preflight classification returns partial with `missing:raw_shift_player_manifest` and unknown expected player count when stored raw evidence is incomplete. Strict build/fetch manifest APIs continue to throw; invalid persisted rows stay invalid; contradictory raw identity and database failures still throw. Independently complete games keep their verified coverage. The unchanged producer preflight gate requires every actual PBP game to have complete shift coverage, so partial coverage remains FAIL and the ordinary blocked/422 path applies when the other dependencies are available. This fix reports a genuine data blocker correctly; it does not ingest data or make forecasts available. The deployed route was not rerun, and the expected 422 is locally inferred from the tested classifier and retained gate, not observed in production.

Native owner `01a12328-45e9-7320-9928-c215ddcdc0d7` confirmed no producer ownership or active edits, no known approved run-publication correction, and no overlap with this classifier work. Shared fetching/participation and prior repairs remain unchanged.

Existing versus missing modeling: `stages/skater-stage.ts` already calculates player ES/PP G, A and SOG, HIT/BLK estimates and PPP from actual PP goal-plus-assist heads. `teamTotals` already accumulates ES/PP assists but the team publisher only serializes ES/PP/PK goal/shot/TOI columns; PK is null, and A/HIT/BLK/PPP are not published as qualifying team categories. PIM is absent. Publishing existing partial component heads would be serialization work, **not** proof of unconditional full-game category means. Full official-play/OT/PK/empty-net/shootout scope, game-occurrence probability, verified participation/roster residual coverage, source-available cutoff and independent revisions/admission/expiry remain unresolved. `nativeGoalAccounting.ts` explicitly leaves full-game/unconditional means null and eligibility false. A fresh run alone cannot supply these missing proofs or qualify the expanded totals.

Checks: 22 focused tests passed (stored shift server 7, pure strength completeness 4, producer preflight 11); scoped ESLint and the final full web TypeScript check passed. The first TypeScript attempt lost its execution session; a subsequent check found an owned axe artifact field error, repaired in the separate UI correction below, before the final confirmed exit 0. Read-only queries and audit extracts are saved in the existing reader-fix evidence directory under `producer-followup`. No new handoff document, credentials, writes, source refresh/capture, model weight/qualification change, serving flag, run or deployment.


## Independent review keyboard recovery correction

Commit `5b7bbe35b4b6c6216e220329075480bd08f9ec50` resolves the P2 from `/Users/tim/Documents/Codex/2026-10-09/task-7/game-grid-task10-reader-review/REVIEW.md`: the forecast refresh control stays mounted through loading/success/failure, keeps focus and exposes a busy/aria-disabled state while suppressing duplicate activation. It uses the same existing focus and 44px styles. Native Enter and Shift+Tab now retain the current preview and return to its close/disclosure control without unrelated navigation. The axe artifact serializer also drops an invalid NodeResult field; target evidence is unchanged.

Passed: 48 focused detail/reader unit tests, 7 actual isolated Chromium scenarios (including delayed keyboard loading/success/repeated failure at 320px), scoped ESLint and full web TypeScript. Source/admission/timing rules remain unchanged. Producer and UI changes are separate commits; no runtime/provider/DB writing or deployment was performed.

Cloud-parent evidence, reused explicitly: zero `player_forecast_runs` created October 9 EDT; latest native October 3 run is `research_blocked`, shadow, canonical_daily, with no issued time. Native cron 397 requests `/api/v1/player-forecasts/jobs/drain?dryRun=true`; all 72 retained queue responses report zero claims/success/failure. This is dispatch without inference/publication, not proof of a successful forecast run. No more database queries were made after parent took dispatch ownership.

Practical private-inference prerequisite in existing code: `orchestration.ts` needs an authorized non-dry worker, configured inference service and explicitly enabled statistical inference; `serving.ts:loadLatestPlayerForecastServingArtifact` requires a registered private-shadow artifact whose stored bytes/checksum/registry ID and contract verify. `loadPlayerForecastInferenceInputs` then requires matching per-player game/team/horizon/feature-schema snapshots at or before the claimed source watermark, plus a known target-game start for the validation contract. That validation path may materialize feature snapshots, so it was not executed under this lane's no-write/no-capture scope. Queue eligibility, artifact/feature readiness and actual supported target/scope/provenance must be established by the native owner before an authorized genuine private test. Merely removing dryRun or flipping serving/inference flags cannot supply those prerequisites and does not qualify public team totals.
