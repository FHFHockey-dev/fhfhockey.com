> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# Diary: r6-s1-serving-source (local_65d983ec-bce3-49b5-b87c-bf02f61bfd93)
Session title: "R6 S-1: one server-side forecast source". Status when read: idle, last turn done.

## 1. Scope
- Task: build release slice S-1 of `tasks/artifacts/forge-native-serving-plan-2026-10-19/PLAN.md` locally: one server-side forecast-source decision shared by Start Chart (page, API, dashboard), RSO `/data`, and `forge/forecasts`.
- Why: production RSO serves no forecasts (its only source is native FORGE, which nothing in production reads), and Start Chart's page and the dashboard read different sources. TJ's priority chain: FORGE projections, then RSO, then Start Chart.
- TJ's decisions (quoted by the brief): D-1 serve-and-flag for unlabelled legacy runs; D-2 empty fallback when native is unavailable. Also correction C-3: the `forecast_source` query parameter must not force native while the kind is `legacy`.
- Activation stays off until TJ sets `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID`. S-1 is local code for a later release (R6b/R6 native rollout).

## 2. Where
- Branch octoberBranch. Files: new `web/lib/player-forecasts/forecastServingSource.ts` (+ `.test.ts`) and `web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts`; changed `pages/api/v1/start-chart.ts`, `pages/start-chart.tsx`, `lib/rosterScheduleData/planning.ts`, `pages/api/v1/roster-schedule-optimizer/data.ts`, `pages/api/v1/forge/forecasts.ts`, and (not on the original list) `lib/player-forecasts/gameExpectationReader.ts`. `planningDataTransport.ts` unchanged. Tests updated: `start-chart.test.ts` (5 new cases), page test URLs, one `forge/forecasts` assertion.
- Frozen files `nativeCatalogHead.ts` and `contributionStore.ts` were NOT edited; no post-freeze patch needed.
- Notes: `tasks/artifacts/r6-s1-serving-source-2026-10-19/README.md`; short pointer `r6-s1-serving-source-2026-10-19.md` in the shared notes folder.

## 3. State
- Done locally. Git check: the S-1 files are committed on octoberBranch in 5ae65fc13 ("octoberBranch reconciliation", 2026-10-19). `forecastServingSource` is absent from origin/master (b630e0767), so S-1 is NOT released. It was excluded from R5 on purpose.
- Four kinds. `legacy`: head env unset, today's board, `forecast_source=game_expectations` also gets legacy, unlabelled skater runs keep `unverified_projection_provenance`. `native`: head resolves and not expired, head pins only, shared cache capped at expiry. `legacy_flagged`: head unusable and `FORGE_NATIVE_SERVING_FALLBACK` is exactly `legacy_flagged`, legacy board with rows flagged `native_unavailable_legacy_fallback`; RSO gets blank pins. `empty`: head unusable and fallback is any other value (including unset), games with no players and the reason in `serving.reason`. A head is unusable on resolution failure, missing/malformed head, wrong season, expired catalog, or an 8 s deadline miss.
- All three surfaces return `forecastSource { kind, headRevision, expiresAt, reason }`, placed next to `data` (not inside the strict schema) so old browser bundles still read `/data`. Start Chart cache key includes kind and headRevision; no entry outlives `expiresAt`.
- Checks reported: all 52 S-1 test files pass (1,914 tests; 1 pre-existing env-gated skip), ESLint clean on touched files, full `tsc` exit 0 under the heavy lock.

## 4. Next
- None stated beyond release assembly.

## 5. Blocked / needs TJ
- Setting the head env (activation) is TJ's call. Release timing is after the 2026-10-20 17:00Z FORGE freeze and, per Chef's R6 plan, after the writer stamps `external_fantasy_input_contract` on a dated run (otherwise octoberBranch `consumerRevisionAdmission` would make Start Chart admit nothing).

## 6. Insights
- Left for release assembly: re-pin `slice.json` and add the new files; B2 schedule writers (`source.ts`, `update-roster-optimizer-schedule.ts`, decision D-5 undecided); S-2's wider provenance policy; D-6 expiry window; S-3's per-component dashboard check (the parity test only proves the page and six dashboard callers send the same date-only request, get one cached board and parse it the same way; it does not render `SlateStripCard`, `TeamPowerCard` or the team page).
- The head resolver does not return issue/expiry times, so the new module reads them from the catalog row (one extra DB read; two reads on head failure to tell expired from unavailable). A post-freeze resolver change could drop those reads (optional).
- Cost once native is on: every Start Chart request, cache hits included, does a season lookup plus about 4 head reads. None before activation.
- Overlap warning from Chef: S-1 also edits `planning.ts` and `data.ts`, which the RSO bridge (`forgeDailyBridge`, env `RSO_FORGE_DAILY_BRIDGE=off`) touched; the overlay must be rebased on the bridge hunk, and native activation turns the bridge off.
- Existing native Start Chart tests now select native via a mocked selector, since the query parameter no longer does. `nativeCatalogHead.test.ts` "keeps head selection default-off without a lookup" still passes.
