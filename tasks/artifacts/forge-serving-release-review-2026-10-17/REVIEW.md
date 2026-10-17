# FORGE serving slice: per-file review

The bytes reviewed are the ones hashed in `SLICE.md` (2026-10-17T21:50:17Z; 0 drift at 21:54:12Z). Every verdict refers to those exact blobs. If a blob changes, its verdict lapses.

## Verdict legend and review depth

- **accept**: correct for serving at these bytes.
- **accept with note**: correct for serving; the note is a limit, risk or follow-up that does not block release.
- **needs change**: the exact reason and a suggested fix are given. B-items block release or activation; N-items should be fixed before activation.
- **out of slice**: the file stays at production bytes.

The **depth** column says how far each file was reviewed:

| Depth | Meaning |
|---|---|
| **full** | Whole file read |
| **diff** | The full diff against production read |
| **use** | Reviewed for how the serving path uses it: admission and verification call sites, plus a scan of its changed lines. Its internal math was not re-derived |
| **receipt** | An independent acceptance (ledger E1) pins these exact bytes; reused, plus a skim |

## Checks actually run

| Check | Where | Result |
|---|---|---|
| Full `tsc --noEmit` (8 GiB heap), 1 run | Candidate: production `457435eb` + an earlier 75-file slice | 2 errors, both in production `lib/projections/calculators/goalie-starter.ts` (`proj_win_prob` possibly null). Cause: the slice's `run-forge-projections.types.ts`. That file was removed from the slice (not needed by any slice file) |
| Scoped `tsc` (roots: 70 slice files + 32 affected production entry points + 43 slice tests, with their full transitive graph) | Final 70-file candidate | **exit 0, 0 errors** |
| ESLint, 70 slice files | Canonical checkout, current bytes | **0 errors**, 6 `react-hooks/exhaustive-deps` warnings (RSO component) |
| Vitest, slice tests at current bytes (48 files) | Canonical octoberBranch | **1,889 passed, 0 failed** |
| Vitest, every test in the candidate that reaches a slice file (114 files, 2,940 tests) | Final candidate, no `.env` | **2,883 passed, 49 failed** (8 files) |
| The same 7 failing files on clean production | Export of `457435eb` | 12 failed: the baseline/environment identities below |

### Candidate failures: baseline versus new

| File | Candidate | Clean prod | Classification |
|---|---|---|---|
| `scripts/qualify-native-players-offline.test.ts` | 9 | 9 | **Baseline.** The 8 identities from the 10-16 receipt, plus "writes a new reproducible receipt…" (environment: export path) |
| `lib/projections/nativeGoalLedgerAudit.test.ts` | 1 | 1 | Baseline (environment: offline CLI in export) |
| `lib/projections/nativeIntervalReconciliation.test.ts` | 1 | 1 | Baseline (same) |
| `lib/projections/researchGoalBaseline.test.ts` | 1 | 1 | Baseline (same) |
| `lib/rosterScheduleData/planning.test.ts` (production version) | **33** | 0 | **New.** The production test asserts superseded behaviour: no schedule-coverage witness → `completeness: 'complete'`; raw data shape. The current version cannot run on master (B3) |
| `lib/projections/apiHelpers.test.ts` (production version) | **1** | 0 | **New.** The eligibility result gained the external-fantasy fields (`calibrationEligibility.ts`). Tied to B1 |
| `lib/projections/runProjectionV2.test.ts` (production version) | **1** | 0 | **New.** The production pipeline's issued schedule fingerprint changes under the slice's `forgeScheduleRevision` ISO normalization (`issuedContext.ts`) |
| `lib/projections/nativeInputEligibility.test.ts` (current) | **2** | n/a | **New; evidence for B1.** Production `skater-stage.ts`/`goalie-stage.ts` still call `loadSeasonBootstrap(…, true)` |

Production versions of CategoryGains, RosterScheduleOptimizer and planningReproducibility are replaced by their current versions, which pass. So those 8 baseline identities do not appear.

---

## Blocking: needs change

### B1. False external-fantasy provenance on production FORGE runs (`web/lib/projections/calibrationEligibility.ts`)

**Reason.** The slice's `buildForgeInputProvenance()` now always stamps `external_fantasy_input_contract: "excluded_from_native_inputs_v1"`.
- Production `lib/projections/run-forge-projections.ts` stays at production bytes, and calls `buildForgeInputProvenance()` at lines 480, 548 and 598.
- Production `stages/skater-stage.ts` and `stages/goalie-stage.ts` still call `loadSeasonBootstrap(…, true)`. That blends the AG/Cullen/DtZ consensus into the season prior; see `forge-native-input-separation-2026-10-13/README.md`.

**Effect.** After release, every new production FORGE run (`run-projection-v2`, `run-rolling-forge-pipeline`, `drain-starter-board`, `internal/starter-board`) would carry a false "excluded" label.
- The slice's new gates would then admit those runs: `consumerRevisionAdmission.ts:88`, `start-chart.ts:910`, and the eligibility check.
- That is externally influenced values entering served RSO and Start Chart forecasts, labelled native.
- The candidate reproduces it: `nativeInputEligibility.test.ts` fails 2/2 against the production stage files.

**Suggested fix** (FORGE owner, about 10 lines, in the slice's own file):
- Stop stamping the marker in the shared default. Use `buildForgeInputProvenance()` → `{ rolling_player_history_contract }` only.
- Stamp it through an explicit opt-in, for example `buildForgeInputProvenance({ externalFantasyExcluded: true })` or a separate `buildNativeOnlyForgeInputProvenance()`. Only the exclusion-enforcing pipeline (octoberBranch `run-forge-projections.ts`/stages) calls it.
- With production pipeline bytes, new runs then lack the marker, and every slice reader rejects them (`use_not_approved`). Legacy FORGE revisions fail closed; only the native catalog is served.
- Update `apiHelpers.test.ts` expectations accordingly.

Alternative, not recommended: ship `stages/skater-stage.ts` (`f44feb8d…`) and `stages/goalie-stage.ts` (`7eb6abfc…`), which still match the 10-13 separation receipt. They carry 89 and 25 changed lines respectively, mostly unrelated pipeline changes, and they pull the projection writer into this release.

### B2. Schedule-coverage witnesses are never written in production (`web/lib/rosterScheduleData/planningInputs.ts` dependency)

**Reason.** `hasScheduleCoverage` requires every date in `[startDate−1, endDate+1]` to carry a `source_metadata.scheduleCoverage` (`nhl-source-days-v1`) witness, with rows fetched ≤36 h ago.
- Only octoberBranch `lib/rosterScheduleData/source.ts` (+12/−1) and `pages/api/v1/db/update-roster-optimizer-schedule.ts` (+1) write it. Both are outside the slice.
- `cron-schedule.md` and `vercel.json` record no scheduled run. `cronInventory.ts` has a job alias, so a hosted pg_cron job may exist; that was not verified, because no production reads were made. Either way, production route bytes never write the witness.
- The 2026-10-17 local readback against the hosted DB already showed `incomplete_refresh` on every game.

**Effect.** Every request marks schedule evidence `partial`.
- FORGE: `horizonComplete: false` and all totals null.
- RSO: `opportunitiesComplete` false, so `projectedValue` is null (AGP only). This is the 7f094c8e6 behaviour.
- Start Chart: every game counted under "Source coverage could not be verified". Per-game values still render.

It fails closed, so no wrong value is served, but FORGE horizons and RSO points cannot be served from the head.

**Suggested fix:**
1. Add the 2 writer files to the release. They are import-closed with the slice.
2. Separately approve a schedule run: the existing route or the v2 `refresh-roster-optimizer-schedule`, at ≤24 h cadence, covering the served window.
   - The bounded mode maximum is 45 days. FORGE next-20 allows 60, so use full-season mode or cap FORGE `endDate`.

**Monday heads-up:** expect `incomplete_refresh` in the 2026-10-20 local readback unless hosted `roster_optimizer_team_games` is refreshed by the octoberBranch writer first.

### B3. The release cannot carry a consistent test set (`planning.test.ts`, `gameExpectations.test.ts`, `nativeBaselinePublication.test.ts`)

**Reason.** The three tests that cover the slice's hubs import out-of-slice modules:
- `planning.test.ts` → `nativeGoalAccounting.buildNativeSkaterParticipationFields`
- `gameExpectations.test.ts` → `scripts/preview-native-baseline.ts` and `seasonGameContributions.ts`
- `nativeBaselinePublication.test.ts` → six publisher modules

So they cannot run on a master candidate. Their production versions fail against slice code: 33 failures in `planning.test.ts`. Also failing are production `apiHelpers.test.ts` (1) and `runProjectionV2.test.ts` (1). The ledger's gate ("candidate failures ⊆ baseline") therefore cannot pass.

**Suggested fix** (FORGE + RSO owners):
- Move the fixture builders the tests use into test-support files that ship with the slice.
- Or add only inert, route-free modules to the candidate as test support: `scripts/preview-native-baseline.ts`, `seasonGameContributions.ts`. Confirm first that no `pages/` file imports them.
- Then re-express the 2 production-pipeline assertions (`apiHelpers` eligibility shape, `runProjectionV2` schedule fingerprint) against the new shared behaviour. Use the current branch versions where their imports allow.
- The catalog-head exact-boundary test lives in `nativeBaselinePublication.test.ts`. Keep an equivalent that can run on master.

## Should fix before activation: needs change, non-blocking for release

### N1. Start Chart has no payload bound, and ships participation evidence hashes (`web/lib/projections/startChartContract.ts`, `web/pages/api/v1/start-chart.ts`)

`normalizeParticipationModel` keeps `inputHash` and up to 131–196 `evidenceHashes` on every target's participation model. A skater row repeats them across 9 targets, about 6–9 KB each.
- There is no envelope check. By contrast, the FORGE view strips these and enforces 4,000,000 B, and the RSO transport interns them and enforces 4,000,000 B.
- Estimate at v1 scale: 45–60 covered players on a 9–11-game slate gives about 2–3 MB. Universe expansion (now in progress) will exceed Vercel's 4.5 MB response limit and turn the route into a 500.
- **Fix:** drop `inputHash`/`evidenceHashes` in `normalizeParticipationModel`; the page renders only version, event, sample size and limitations. Add a 4,000,000-byte check that returns a typed 503 (`start_chart_too_large`), like `forecast_view_too_large`.
- Measure the body size in Monday's readback.

### N2. FORGE view catalog cap is close to v1 size (`web/lib/player-forecasts/gameExpectationView.ts`)

`catalogEntries: 10000` applies to the interned `targets` catalog, which grows as covered player-games × targets. Each game carries its own participation revision.
- v1 estimate: about 1,050 covered player-games × 9 skater / 6 goalie targets ≈ 7,300–9,500 entries.
- Exceeding the cap returns 503 for the whole next-20 request.
- **Fix:** raise the per-catalog cap (for example to `playerGames`, 50,000) in both `buildGameExpectationView` and `viewSchema`. Keep the 4,000,000-byte guard as the real bound.
- Monday's readback will show whether v1 already trips it.

### N3. Unbounded per-request cost on public routes (`web/pages/api/v1/forge/forecasts.ts`, the participation stores)

`/api/v1/forge/forecasts` is public with `Cache-Control: no-store`. Each request:
- re-reads every pinned bundle; the store's own sizing comment puts skater participation at up to about 14 MB
- re-reads the baseline input payloads
- rebuilds and rehashes every receipt and rate

Start Chart (s-maxage ≤15 s) and RSO data (s-maxage 300 s, but date-keyed URLs) are partly mitigated.
- **Fix:** `public, s-maxage=min(60, seconds-to-earliest-expiry), stale-while-revalidate=0` on FORGE, the same pattern as `start-chart.ts:1133-1135`.
- Optionally, memoize verified bundles per instance, keyed by pin ID:hash.

---

## Per-file verdicts: runtime slice (70)

### Shared admission and serving core (30)

| File | Verdict | Depth | Notes |
|---|---|---|---|
| `lib/player-forecasts/nativeCatalogHead.ts` | **accept** | full | Opt-in only when `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` is set.<br>Hash chain checked: head row → selection row (`payload_hash` = head hash = rehash) → pins/releases (dataset and `id:hash` per group) → release metadata.<br>Clock checks: `selection.expiresAt <= now` rejects (exact boundary; the 1 ms test is in `nativeBaselinePublication.test.ts`); `issuedAt > now`, `selected_at > now` and `available_at > issuedAt` reject.<br>Any failure empties **all** pins, legacy included; it never falls back.<br>Note: serving checks release *metadata* only, and the loaders rehash full payloads (verified in both stores and `contributionStore`). The served head id/revision is not echoed in responses; consider adding it to `forecastManifest` |
| `lib/rosterScheduleData/planning.ts` | **accept** | full | Head resolution runs under an 8 s deadline, and a failure becomes the unavailable environment. Every loader gets the selected environment. The limitation is recorded on both the baseline and participation evidence. Unknowns stay null ("unknown, not zero" limitation) |
| `lib/rosterScheduleData/planningInputs.ts` | accept with note | diff | The witness check is strict and correct. It also normalizes the schedule revision to ISO. **Dependency B2** |
| `lib/rosterScheduleData/normalize.ts` | accept | diff | Optional `scheduleCoverage` pass-through |
| `lib/rosterScheduleData/types.ts` | accept | diff | Type only |
| `lib/rosterScheduleOptimizer/planningTypes.ts` | accept | diff | Optional fields (`powerPlayRole`, `startParticipation`, `participationSources`, manifest participation IDs) |
| `lib/player-forecasts/contributions.ts` | **accept** | diff | Model-participation admission: event/version pairing, `numerator/denominator` equality, the target game excluded from its own evidence, ≤1 day cutoff→issue and issue→expiry, scheduled-at equality.<br>Basis separation: `per_start` baselines never take an appearance model, and start models carry metadata only.<br>`catalogExpiresAt` ≤ read → `stale_source`.<br>The SOG canary is never blended and never takes participation |
| `lib/player-forecasts/contributionStore.ts` | accept with note | diff | Microsecond clocks. `catalogExpiresAt` = manifest expiry. One invalid or expired pinned bundle empties the whole catalog (fail closed). The SOG policy is limited to `conditionalTieBreak` |
| `lib/player-forecasts/nativeContributionAdmission.ts` | accept with note | full | Re-derives each admitted mean from the retained capture; `projections` must be empty, so no external prior. Note: the recompute runs per request (N3), and `.in("payload_hash", ≤1020)` puts up to about 66 KB in the URL as the universe grows (fails closed) |
| `lib/player-forecasts/modeledSkaterParticipationStore.ts` | accept with note | full | Exact `id:hash` pins, payload rehash, receipt rebuild-and-compare, conflicting player-game → empty. Caps: 8 releases, 1,500 entries, 24 MiB (fails closed). Per-request cost (N3) |
| `lib/player-forecasts/modeledGoalieParticipationStore.ts` | accept with note | use | Mirrors the skater store. The aggregate cap is **500 entries / 8 MiB**: v1 has about 140 goalie entries, but 26+ goalies × 20 games exceeds it and fails closed |
| `lib/player-forecasts/modeledSkaterParticipation.ts` | accept with note | use | Receipt builders re-run by the store. Limitation strings are code-authored and public-safe |
| `lib/player-forecasts/modeledGoalieParticipation.ts` | accept with note | use | Same |
| `lib/player-forecasts/targetRosterObservation.ts` | accept with note | use | Used by the receipt builders |
| `lib/player-forecasts/baselineGeneration.ts` | accept with note | use | Producer math reused to re-derive skater snapshots. Means validation is a separate gate: the FORGE native validation review (FORGE LEDGER §6 step 4). Producer write helpers are bundled, but serving never calls them |
| `lib/player-forecasts/baselineRates.ts` | accept with note | use | Same |
| `lib/player-forecasts/goalieBaselineRates.ts` | accept with note | use | Same. It imports `persistContributionBundle`/`persistCapturedGoalieBaselineInputs`, which are not called on any serving path |
| `lib/player-forecasts/goalieBaselineInputCapture.ts` | accept with note | use | Producer capture/persist, including provider reads. Only types and helpers are reached from serving |
| `lib/player-forecasts/nativeGoalieOutcomes.ts` | accept with note | use | Producer math |
| `lib/player-forecasts/nativePowerPlayPoints.ts` | accept with note | use | Producer math. PPP does not imply a PP unit (`powerPlayRole` stays explicit unknown) |
| `lib/player-forecasts/currentSeasonSogBaseline.ts` | accept with note | use | Canary; conditional tie-break only |
| `lib/player-forecasts/currentSeasonSogContribution.ts` | accept with note | diff (uncommitted) | The uncommitted fix strips `catalogExpiresAt` before the hash comparison; the resolver still enforces catalog expiry. Bytes are not committed (consumer-test-fixes session) |
| `lib/player-forecasts/gameExpectations.ts` | accept with note | full | Totals only when the horizon is complete **and** every game is finite. `coveredSum` is labelled partial. Ratios are labelled `ratio_of_expected_totals`. Probabilities are null unless use-approved.<br>Notes: calendar mode silently drops already-started games (`requiredGames` counts only the remaining ones). Start-participation `sampleSize` is shown only for admitted (totals-approved) metadata |
| `lib/player-forecasts/planningContributions.ts` | accept | diff | Raw rows lose an unchecked `startParticipation`. Catalog participation is used only for appearance models that the manifest lists |
| `lib/player-forecasts/resolvedPlanningForecast.ts` | accept | diff | Modeled start metadata never reweights means. A team-game start mass > 1 withholds the metadata. `powerPlayRole` is an explicit unknown |
| `lib/player-forecasts/sourceSnapshot.ts` | accept with note | diff | Additive: planned observation IDs and verification. Production writers call without `observationId`, so their behaviour is unchanged |
| `lib/projections/calibrationEligibility.ts` | **needs change (B1)** | full | See B1 |
| `lib/projections/consumerRevisionAdmission.ts` | accept with note | diff | Rejects revisions without the exclusion contract. That is only correct once B1 is fixed |
| `lib/projections/issuedContext.ts` | accept with note | diff | ISO normalization of `start_time` changes schedule fingerprints. Revisions issued before the release with non-canonical strings fail identity (fail closed). The production `runProjectionV2.test.ts` asserts the old value (B3) |
| `lib/projections/gameRevisions.ts` | accept | diff | Type only |

### FORGE API (3)

| File | Verdict | Depth | Notes |
|---|---|---|---|
| `pages/api/v1/forge/forecasts.ts` | accept with note | full | Public GET, read-only. Scope is validated (1–20 games, a 21/60-day bound, ≤50 player IDs). Errors are generic 503s. `no-store` (N3) |
| `lib/player-forecasts/gameExpectationReader.ts` | accept | full | Skips ownership and recent form. No writes |
| `lib/player-forecasts/gameExpectationView.ts` | **needs change (N2)** | full | Strips participation `inputHash`/`evidenceHashes`. The 4,000,000-byte envelope is enforced on encode and decode. The 10,000-entry catalog cap is the risk (N2) |

### Start Chart API and page (3)

| File | Verdict | Depth | Notes |
|---|---|---|---|
| `pages/api/v1/start-chart.ts` | **needs change (N1)** | diff | Native path only with `forecast_source=game_expectations`, using `calendar`, 1 game, America/New_York. The cache TTL and `s-maxage` are bounded by the source expiry. The default (legacy) path now also rejects runs without the exclusion contract (B1). No byte bound (N1) |
| `lib/projections/startChartContract.ts` | **needs change (N1)** | diff | One basis per board (`expected` requires totals+comparison; conditional requires `conditionalTieBreak` and the same basis). A missing expected head never borrows a conditional value. The expiry includes first puck drop. Evidence hashes are kept (N1) |
| `pages/start-chart.tsx` | accept | diff | Withholds values and ranks at `expiresAt` (timer). Has a basis selector, exclusion labels, and model-estimate labels |

### RSO routes and transport (4)

| File | Verdict | Depth | Notes |
|---|---|---|---|
| `pages/api/v1/roster-schedule-optimizer/data.ts` | accept with note | full | **Must ship with the RSO page tree** (transport contract). Typed 503 over 4,000,000 B |
| `lib/rosterScheduleData/planningDataTransport.ts` | accept | full | Lossless interning of model metadata and hashes. Strict zod shapes, a prototype-key guard, and a 4,000,000-byte bound on encode and decode. Legacy raw responses still decode |
| `pages/api/v1/roster-schedule-optimizer/eligibility.ts` | accept with note | full | Public, GET, `no-store`, ≤60 IDs, ≤5 indexed reads. Returns cached Yahoo **default** positions plus Yahoo player keys only, never league or account data. Note: the owner should confirm Yahoo display terms for this unauthenticated republish |
| `pages/api/v1/roster-schedule-optimizer/workspace.ts` | accept with note | diff | Auth: `requireApiUser`. The new `?preservation=` mode additionally requires `isDraftProOwner` (via `auth.admin.getUserById`), team/league ownership and binding, and optimistic versions. Note: receipts are a process-local `Map`, so on multi-instance Vercel serverless they will often be lost between requests and fail closed (`preservation_lost`). Consider an env gate before production |

### RSO page tree (30)

| File | Verdict | Depth | Notes |
|---|---|---|---|
| `components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | accept with note | targeted diff | Reviewed: transport decode, every fetch and auth header, preservation gating (`owner_testing` grant plus server owner check), local/session storage of the user's own plan, the evidence download (client-side only). The full 607-line UX diff was **not** re-reviewed. Behaviour evidence: the RSO acceptance matrix (2026-10-17) and passing tests. No receipt (E6) |
| `components/RosterScheduleOptimizer/CandidateBrowser.tsx` | accept with note | diff (uncommitted) | "Compare this player" is scoped to the snapshot ID. The 10-17 delta is not committed. The `rso-candidate-pool` receipt covers the earlier bytes only |
| `components/RosterScheduleOptimizer/CandidateCard.tsx` | accept with note | diff (uncommitted) | Same |
| `hooks/useCandidateMetrics.ts` | accept with note | diff (uncommitted) | Same |
| `hooks/candidateMetrics.worker.ts` | accept with note | diff (uncommitted) | Same |
| `lib/rosterScheduleOptimizer/candidatePlanMetrics.ts` | accept with note | diff (uncommitted) | Requested IDs lead the bounded set; caps are unchanged. Unknown → null (matrix rows 1–3) |
| `lib/in-season/workspaceSchema.ts` | accept with note | diff (uncommitted) | Adds `powerPlayRole` and `startParticipation`, and widens the model versions (fixes the 2 `planning.test.ts` failures). Note: `event` is not cross-checked against `version` here; the resolver re-admits anyway. The `rso-intraday-periods` receipt covers the earlier bytes only |
| `lib/rosterScheduleOptimizer/planning.ts` | accept | diff | `projectedValue` is null when opportunities are incomplete or unresolved, so there is no zero-filled gain. A drop-based AGP plan is labelled schedule-capacity only. `playerAssignedPoints` is null on any unknown |
| `lib/rosterScheduleOptimizer/contributionLedger.ts` | accept with note | use | Tests pass. RSO matrix |
| `lib/rosterScheduleOptimizer/yahooEligibility.ts` | accept with note | use | Cycle clocks for cached eligibility |
| `lib/rosterScheduleOptimizer/yahooEligibilityCache.ts` | accept | full | Forward and reverse identity agreement, verified identities only, stale or future rows rejected, error → empty receipt |
| `components/RosterScheduleOptimizer/canonicalSchedule.ts` | accept with note | use | Same witness rules as `planningInputs` (B2 applies) |
| `components/RosterScheduleOptimizer/TeamScheduleContext.tsx` | accept with note | use | UI. No receipt (E6) |
| `components/RosterScheduleOptimizer/CategoryGains.tsx` | accept | diff | 5/2 display change |
| `components/RosterScheduleOptimizer/InfoTooltip.tsx` | accept | full | UI |
| `components/RosterScheduleOptimizer/InfoTooltip.module.scss` | accept | full | Style |
| `components/RosterScheduleOptimizer/AcquisitionPeriodTimes.tsx` | accept | receipt | `rso-intraday-periods` ACCEPT |
| `components/RosterScheduleOptimizer/CandidateCard.module.scss` | accept | receipt | `rso-mockup-match` ACCEPT |
| `components/RosterScheduleOptimizer/CompactSchedule.tsx` | accept | receipt | `rso-mockup-match`, `rso-partial-discovery` ACCEPT |
| `components/RosterScheduleOptimizer/RosterContribution.tsx` | accept | receipt | Same |
| `components/RosterScheduleOptimizer/RosterPlayerRow.tsx` | accept | receipt | `rso-mockup-match` ACCEPT |
| `components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss` | accept | receipt | Same |
| `components/RosterScheduleOptimizer/TeamScheduleContext.module.scss` | accept | receipt | Same |
| `hooks/useYahooEligibility.ts` | accept | receipt | `rso-candidate-admission` ACCEPT |
| `lib/rosterScheduleOptimizer/periodBoundaries.ts` | accept | receipt | `rso-intraday-periods` ACCEPT |
| `lib/rosterScheduleOptimizer/planningTimeline.ts` | accept | receipt | `rso-functional-checkpoint`, `rso-mockup-match` |
| `lib/rosterScheduleOptimizer/providerRules.ts` | accept | receipt | `rso-weekly-rule-supplement v3` ACCEPT |
| `lib/rosterScheduleOptimizer/reconciliation.ts` | accept | receipt | `rso-functional-checkpoint`, `rso-mockup-match` |
| `lib/rosterScheduleOptimizer/refreshForecastInputs.ts` | accept | receipt | `rso-participation-transport` ACCEPT |
| `lib/rosterScheduleOptimizer/workspace.ts` | accept | receipt | `rso-participation-transport` ACCEPT. It also hosts the preservation helpers |

## Files outside the 70

| File | Verdict | Notes |
|---|---|---|
| `lib/rosterScheduleData/source.ts` | **needs to ship (B2)**; accept | diff: stamps per-day witnesses and throws on conflicting source-day coverage |
| `pages/api/v1/db/update-roster-optimizer-schedule.ts` | **needs to ship (B2)**; accept | +1 line pass-through. Auth via `withOperationalRouteAuth` (unchanged) |
| `pages/forge/forecasts.tsx`, `styles/ForgeForecasts.module.scss` | out of slice (optional) | Decodes the view with its own zod schema. Its current test passes on the branch. Not reviewed in depth |
| `lib/cron/withCronJobAudit.ts` | out of slice | R1 unit. Production bytes are consistent |
| `utils/adminOnlyMiddleware.ts` | out of slice | Security session owns it (uncommitted). Production bytes are consistent |
| `components/GameGrid/utils/calcWinOdds.ts` | out of slice | Uncommitted; owner unknown. Production bytes are consistent |
| `pages/_app.tsx`, `lib/seo.js` | out of slice | Audit Patch 01 (still changing) and social-share noindex |
| `lib/player-forecasts/scopeReads.ts`, `lib/projections/types/run-forge-projections.types.ts`, `lib/rollingPlayerCountSupport.ts` | out of slice | Not imported by any slice file. Including the types file breaks the production `goalie-starter.ts` typecheck |
| `pages/api/v1/roster-schedule-optimizer/provider.ts`, `lib/integrations/yahoo/rosterPlanning.ts` | out of slice (optional RSO companion) | The reserve-slot mapping fix (E1) matters for RSO legality, but not for catalog serving |
| `lib/projections/stages/skater-stage.ts`, `stages/goalie-stage.ts` | out of slice | See B1 |

## Criteria summary

| Criterion | Finding |
|---|---|
| Admission, expiry, nulls | The head, bundle, participation and source clocks are exact and microsecond-based, and fail closed. The consumer UIs withhold values at expiry. **B2** turns every horizon partial in production |
| No zero-filling of unknowns | Holds across the resolver, totals, ratios, RSO evaluation and Start Chart. The scan of slice additions found only counters and sort tie-breaks |
| Basis separation | Holds: unconditional vs per-appearance vs per-start, start metadata never weights means, and one basis per Start Chart board |
| Provenance labels | **B1** (false exclusion label via the production pipeline). Otherwise model estimates are labelled `uncalibrated_model`/`calibration unavailable`, and PPP is not a PP role |
| Payload bounds (4 MB) | FORGE view and RSO transport: bounded. Start Chart: **unbounded (N1)**. FORGE catalog cap **N2** |
| Auth on non-public routes | `workspace` is authenticated, and preservation is owner-only. The other slice routes are deliberately public and read-only |
| Private data / research | No account or league data, no private paths, no research payloads in code-authored strings. Payload-authored `limitations` should be scanned in the readback |
| Baseline vs new failures | See the table above. New: 33 + 1 + 1 (production tests vs slice behaviour) and 2 (B1) |
