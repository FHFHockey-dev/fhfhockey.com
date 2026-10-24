# FORGE model release inventory: `origin/master..octoberBranch` (2026-10-21)

Read-only inventory for TJ's release decisions on S-F and S-B. No code, git state or production was touched; no tests were run (git analysis only).

**Basis.** `origin/master` = `56fb03fef` (R18, production). `octoberBranch` = `e316db4c0`. Two commits landed on `octoberBranch` during this pass and are included: `a7e9627f0` (audit harness and PP verdict, offline only) and `e316db4c0` (**HOLD**: PP targets from official WGO). The range has 135 commits. 44 of them touch the scoped FORGE files; 51 do when the rolling writer, RSO planning and harness files are counted.

**Method.** For each differing file, the octoberBranch side of `git diff origin/master octoberBranch` was attributed with `git blame` on the added lines. Commits that touched a file in the range but own no remaining diff lines are listed as "content already on master or superseded". Release candidates cherry-picked by hunk under new SHAs, so this compares content, not ancestry. Appendix A lists every file.

**Scope.** `web/lib/projections/**`; `run-projection-v2.ts`; `update-goalie-projections-v2.ts`; `run-projection-accuracy.ts`; `run-rolling-forge-pipeline.ts`; `forgeDailyBridge.ts`; `start-chart.ts`; `/api/v1/forge/*`; `/api/v1/projections/*`; the served-forecast routes; `web/lib/player-forecasts/**`; `web/lib/rollingPlayer*`; and the rolling writer files they import (`fetchRollingPlayerAverages.ts`, `rollingPlayerSupportPayload.ts`, `rollingPlayerValidationPayload.ts`). It also includes the RSO planning and native-serving files those import.
- These files are identical on both branches, because their unreleased work already shipped: `run-projection-v2.ts`, `update-goalie-projections-v2.ts`, `run-rolling-forge-pipeline.ts`, `forgeDailyBridge.ts` and `seasonBootstrap.ts`.

---

## 0. Answer first

### Feature list

| ID | Feature | Commits (unreleased content) | Kind | HOLD |
|---|---|---|---|---|
| F1 | Conversion rates from aligned NST count pairs; withhold G/A/PPP heads (and goalie W) without a pair | `6e14053ff` (+ tests in `0de97e77d`) | **model-changing** | Not labelled HOLD; blocked on TJ's head policy (audit S-J) and on F1w plus a backfill |
| F1w | Rolling writer stores `alignedCountSupport` in the sidecar | `6e14053ff` (writer half), `b47c512fb` (3 lines) | plumbing (nothing on master reads it) | no |
| F2 | Hydrate pruned rolling fields (`_all`, `_avg_`, `_3ya`) from the sidecar | `6767073ea` | **model-changing vs master** (see R1) | no |
| F3 | Hits/blocks from the all-strength row, shrunk to 3-season and position priors, plus PK TOI share | `b8fe1072e` (FORGE hunks only) | **model-changing** (HIT, BLK) | no |
| F4 | Rescale prior-season hits/blocks to this season's league rate; retuned constants | `34a5588db` | **model-changing** (HIT, BLK) | no; migration 88 pending |
| F5 | Season bootstrap stops blending external fantasy projections; runs stamped `excluded_from_native_inputs_v1`; readers refuse unstamped runs | `7f094c8e6` (bootstrap flag, fence), `0de97e77d` (stamp) | **model-changing if season bootstrap is on in production**; the fence is plumbing with a cutover risk | no |
| F6 | **S-F**: latest rolling row per player through `forge_latest_rolling_rows` | `0ff219d25` | plumbing | no |
| F7 | **S-B**: served-forecast ledger, naive controls, settle, public scoreboard | `8cfaba0fc` | plumbing (no serving change) | no; migration needed |
| H1 | Q7: one conversion shrink (supported Bayes rate used directly) | `65fc4b9ee` | **model-changing** | **HOLD** |
| H2 | Q8: B2B = 1 is the heavy rest tier | `65fc4b9ee` | **model-changing** | **HOLD** |
| H3 | `assistDenominator` option, per-strength clamps, `legacy_per_two_goals` ledger fields | `07c7f71af`, `f0ab2b9fd` | **HOLD**; the default reproduces R18's numbers, so the net effect vs master is plumbing | **HOLD** |
| H4 | PP team targets from official WGO; PP TOI split by official last-10 PP TOI | `e316db4c0` | **model-changing** | **HOLD** |
| F8 | Native serving: Start Chart native branch, `/api/v1/forge/forecasts`, `/forge/forecasts` page, `gameExpectations*` | `7f094c8e6`, `0de97e77d`, `317f8f57e`, `f9b571f43`, `5ae65fc13` | plumbing, dark until `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` is set; some Start Chart changes apply unconditionally | no |
| F9 | Native catalog production stack: daily pipeline v1/v2, cadence, publication, materialization, means capture, participation frames, Yahoo universe, SOG contributions | `7f094c8e6`, `0de97e77d`, `ceceb407a`, `4ce7e1f5f`, `a23728de2`, `f9b571f43`, `0e3261558` | plumbing for FORGE (a separate native model; script-driven) | no |
| F10 | Starter Board cadence coordinator | `7f094c8e6` | plumbing, opt-in, no caller | no; its RPC has no migration |
| F11 | Schedule-revision hash uses ISO-normalised `start_time` | `7f094c8e6` | plumbing with a hash cutover | no |
| F12 | `privateParticipationScenario` | `1ddef915d`, `971a43e78` | dead code (no non-test importer) | no |
| F13 | Rolling writer: full refresh defaults to `overwrite_only` and refuses table clears on scoped or dry runs; stable `games` paging; validation and debug diagnostics | `317f8f57e` | plumbing (safety fix) | no |
| F14 | Offline counterfactual backtest harness and fixtures | `8cfaba0fc`, `97663ca6e`, `a1e8303cf`, `5422a1ee3`, `a7e9627f0` | offline tooling; imports H1/H2 exports | n/a |
| F15 | Start Chart UI selection for partial categories (consumer of F1's null heads) | `0e8040da9`, part of `7f094c8e6` | plumbing (UI) | no |

**Content already on master** (no remaining diff lines; release mapping inferred from release subjects):
- `198883639`: whole-second TOI, R7 `986144844`. Only 4 test-fixture lines in `nativeGoalAccounting.test.ts` still differ.
- `a5b65d319`: F1 run fence, R8.
- `3ba83338d` and `2c69193e4`: R9.
- `0c09a4680`: R10.
- `a88fcef52`: R11.
- `afa8cac9b`: R12.
- `bb1c80e8e` and `21bce4cdb`: R15.
- `ebdcfe6be`: R16.
- `b59070d92`, `1bc536e8b` and `1a36165bc`: R17.
- `b22c8b55f` and the ES assist patch: R18.
- RSO bridge commits `67e50ee4e`, `ed949622d`, `79d3b792f`, `0654fafc4`, `b401c5f53` and `dee4aa5a4`: R6c–R9.

Residual test-only hunks from `a5b65d319`, `bb1c80e8e` and `b21242f1c` remain in `releasedRunFence.test.ts`, `apiHelpers.runAdmission.test.ts` and `run-forge-projections.resume.test.ts`. They only add F5's provenance label to the fixtures.

**Correction to the brief.** S-F's `skater-queries.ts` builds on `6767073ea`, `6e14053ff`, `b8fe1072e` and `34a5588db` only.
- `7f094c8e6` does not touch `skater-queries.ts`. It owns one line in `run-forge-projections.local-attempt.test.ts`.
- `198883639` is already on master (R7).

### Minimal set for S-F

**S-F-lite: plumbing only, no model change.** Port `0ff219d25`'s RPC read onto master's `fetchRollingRows`:
- Pass master's `ROLLING_ROW_SELECT_CLAUSE` as `p_columns`.
- Strengths stay `"ev" | "pp"`.
- Keep `rolling_row` only and ignore `support_row`.
- Master's current window scan becomes the fallback for `PGRST202`, for read-only reconstruction and for "Unrecorded projection input".

It also needs:
- `queryCaptureHook.ts` (+12)
- `inputCapture.ts` (+2/−1)
- `web/scripts/run-forge-local.ts` (+3/−1)
- the 11-line RPC fixture in `run-forge-projections.local-attempt.test.ts`
- the RPC `describe` block of `skater-queries.test.ts`, rewritten without the sidecar expectations

Master's stage keeps only the latest row per player (`pickLatestByPlayer` at `skater-stage.ts:1470-1471` and `1599-1600`), and `evRows`/`ppRows` have no other use. Projected numbers are therefore unchanged.

**Drags in no model-changing feature.** The RPC is already applied in production (ledger order 95).

`0ff219d25` as written drags in:
- **F2** (model-changing on master)
- the aligned hunk of **F1**: inert on master, since master's stage never reads `aligned_count_support`, but it needs the new `rollingPlayerCountSupport.ts`
- the `"all"` strength and extra columns of **F3**/**F4**: inert on master, since master's stage never requests them

Exact split: §4.1.

### Minimal set for S-B

From `8cfaba0fc`, take:
- `servedForecastLedger.ts` and its test
- `forge-served-forecast-snapshot.ts` and `forge-served-forecast-settle.ts`, with their tests
- `forge/scoreboard.ts` and `web/tests/api/forge-scoreboard.test.ts`

Add:
- `web/lib/player-forecasts/gameExpectations.ts`: a type-only import from F8. Every `GameForecast` field it reads exists on master's type. Alternatively, replace the import with a local structural type, because the snapshot route never passes `nativeExpectations`.
- Migration 97 (`forge_served_forecast_ledger`, design §7)
- A scheduling decision

Exclude F14: `forge-counterfactual-backtest.ts` imports H1's `resolveSkaterConversionRates` and H2's `buckets: "legacy"`.

**Drags in no model-changing feature.**

### Recommended candidate order (detail in §7)

1. **R19**: S-B (F7) + S-F-lite (F6 without hydration), optionally with F13. All plumbing, one build. Migration 97 must be applied before the deploy.
2. **R20** (conditional on TJ wanting F1 eventually): F1w writer only, then a bounded rolling backfill.
3. **R21**: F2 hydration plus the full S-F reader. Model-changing; needs a paired backtest.
4. **R22**: F3 + F4 hits/blocks, with migration 88. Model-changing; needs a backtest. Can merge with R21 if both clear.
5. **R23**: F5 in two steps: stamping and bootstrap exclusion first, the reader fence one release later.
6. **Later or HOLD**: F1 reader and head policy; H1–H4; native F8–F10. F11 goes with F8.

---

## 1. What master is actually running (context for every "model-changing" call)

- **Master's FORGE reads pruned rolling fields as NULL.** The rolling writer moves every non-kept `_all`, `_last3`, `_3ya`, `_career` and `_avg_` field into `rolling_player_metric_support_payloads.support_payload.historicalCompatibility` and writes NULL in the wide row.
  - Writer: `fetchRollingPlayerAverages.ts:397-422` on master; pruning since `a8e1f5495`, 2026-06-11.
  - Classification: `rolling-column-inventory.json`, class `pruned_runtime`, "always NULL in wide row".
- Master's `fetchRollingRows` (`skater-queries.ts:166-241`) reads only the wide table. The fields that are therefore NULL on master: `goals_total_all`, `shots_total_all`, `assists_total_all`, `sog_per_60_all`, `sog_per_60_avg_all`, `sog_per_60_avg_last5`, `hits_per_60_all`, `hits_per_60_avg_*` and `blocks_per_60_all`/`avg_*`. Effects in master's `skater-stage.ts`:
  - `:2009-2010`: `evShotsAll`/`ppShotsAll` are null, so the small-sample shot evidence weight is 0 and `sampleWeight` is at most `0.58 × toiWeight`. That pulls TOI (`:2023-2029`) and goal rates toward priors for every skater.
  - `:2156-2164`: season-long conversion totals are 0, so conversion uses last-5 plus the prior only.
  - `:2053-2074`, `:2125-2146`: the `_all` fallbacks never apply.
  - This is inferred from code and not verified on rows. One read-only SELECT would confirm it: for ~10 players' latest ev rows, `goals_total_all IS NULL` and the sidecar has the `goals_total_all` key.
- **Master has R18's ES assist refit**: ES assists fitted per goal and used as fitted. PP assists and goal rates are unchanged, and goal rates still get the second `sampleWeight` shrink.
- **Master's season bootstrap allows external fantasy projections**: `loadSeasonBootstrap(..., true)` at `skater-stage.ts:1456,1588` and `goalie-stage.ts:166`, with `fantasyShare 0.6` (`seasonBootstrap.ts:6-7`). It runs only when Starter Board compute is on and `STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED=true` (`run-forge-projections.ts:431-433`); production env values are not visible from code.
- **Evidence base caveat.** Every audit backtest scored only `octoberBranch` local runs from 10-13 to 10-19 (`q7-q8-backtest-verdict.md`: "the stamped stratum is empty"). That includes the R18 ES-assist clearance (`assists-es-refit-verdict.md`, same cohort). Those runs used F1 masking and aligned pairs, F2 hydration, and possibly F5. No backtest has measured master-mode inputs (NULL `_all` fields, scalar windows), so how the cleared changes behave on master's inputs is unmeasured. S-B (F7) fixes this going forward.

---

## 2. Features in detail

### F1: Aligned conversion counts and head withholding

- **Commits:** `6e14053ff` (2026-10-11).
  - Tests added later in `0de97e77d`: 69 lines of `runProjectionV2.alignedConversion.test.ts`.
  - UI consumer: `0e8040da9` (F15).
- **Files (reader/model):**
  - `calculators/skater-adjustments.ts`: `computeSupportedStrengthSplitConversionRates`, `applySupportedSkaterConversionHeads`, oct `:721-805`
  - `stages/skater-stage.ts`: oct `:2281-2306`, `:3255`, `:3309-3311`, `:3355-3357`, `:3499-3500`
  - `stages/goalie-stage.ts`: `:289`, `:352`, `:388-398`, `:598-635`, `:755`
  - `goalieModel.ts`, `calculators/goalie-starter.ts`, `nativeGoalAccounting.ts`, `utils/projection-metadata-builders.ts`
  - `types/run-forge-projections.types.ts` (`aligned_count_support`)
  - `queries/skater-queries.ts`: the aligned hunk inside `hydrateRollingSupport`, oct `:216-222`
  - `rollingPlayerCountSupport.ts` (new)
- **Behaviour:**
  - G/A conversion is fitted from paired NST observations (goals/shots, assists/goals) stored on the latest rolling row's sidecar, instead of the scalar `goals_total_*`/`shots_total_*` windows.
  - If a pair is missing, that head is **withheld (null)**, along with its bands, scenarios, PPP and the matching prop markets.
  - Team GF becomes null when any contributor's goal head is null. The goalie win probability is then null.
- **Kind:** model-changing.
- **Depends on:** F1w having written `alignedCountSupport` to the latest ev/pp sidecar of every active skater; the sidecar read (F2's `hydrateRollingSupport` or F6's RPC `support_row`); and consumers tolerating null heads (F15, RSO, the bridge; `/api/v1/forge/goalies` is already null-safe from R7).
- **HOLD:** not labelled. The audit (`REPORT.md` §10, S-J) requires TJ's head-policy decision before any release that carries it.
- **Tests:**
  - `runProjectionV2.test.ts` ("aligned conversion integration")
  - `runProjectionV2.alignedConversion.test.ts`
  - `goalieModel.test.ts`, `goaliePipeline.test.ts`, `nativeGoalAccounting.test.ts`
  - `skater-queries.test.ts` ("hydrates only exact-anchor aligned support…")
  - `rollingPlayerCountSupport.test.ts`

### F1w: Aligned-count writer

- **Commits:** `6e14053ff` (writer half), `b47c512fb` (relocated push and comment, 3 lines).
- **Files:**
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`: import, `compact…`/`split…` handling, `NstCountsRow.id/player_id`, `fetchCounts(db)` selecting `id, player_id`, the `canonicalGames` parameter, the `createAlignedCountSupportBuilder` push per game
  - `rollingPlayerSupportPayload.ts` (type)
  - `rollingPlayerCountSupport.ts`
  - `fetchRollingPlayerAverages.test.ts` (6e14053ff part)
- **Behaviour:**
  - Adds `support_payload.alignedCountSupport` (two pairs, with five recent frames each) to every ev/pp sidecar row.
  - No projection change on master, because no master reader exists.
  - New throw paths in the writer: an out-of-order observation and a duplicate event (`rollingPlayerCountSupport.ts`).
- **Kind:** plumbing.
- **Depends on:** none.
- **Tests:** `rollingPlayerCountSupport.test.ts`, `fetchRollingPlayerAverages.test.ts`.

### F2: Sidecar hydration

- **Commit:** `6767073ea`.
- **File:** `skater-queries.ts`.
  - `db` parameter
  - `hydrateRollingSupport`, oct `:206-235` minus the F1 lines
  - Legacy-scan sidecar join, oct `:403-435`
- **Behaviour:** fills the wide row's NULL pruned fields from the matching sidecar row, matched on (player, game, date, strength). Absent stays unknown. Conflicting or invalid values reject the read.
- **Kind:** model-changing on master. It fills TOI and shot sample evidence, conversion totals and `_all` fallbacks (§1).
- **Risk:** in the legacy scan, any sidecar row in the 365-day window without a matching wide row aborts the team-game. The RPC path only checks the latest row.
- **Tests:** `skater-queries.test.ts`, "counted rolling skater history (legacy window scan)".

### F3: All-situation hits/blocks

- **Commit:** `b8fe1072e`, FORGE hunks only. The commit, titled "sfgsdfgsdfgsdf", is a mixed checkpoint (cron, sustainability, rankings…); port by hunk.
- **Files:**
  - `skater-adjustments.ts` (`computeSkaterPhysicalEventRates` v1)
  - `projection-weights.ts` (`SKATER_PHYSICAL_*`)
  - `skater-stage.ts` (`allLatest` "all" read, oct `:1571`; `physicalRates`, oct `:2269`; `physicalToiMinutes`, oct `:2845`)
  - `skater-queries.ts` (`"all"` strength; five extra columns)
  - types
- **Behaviour:**
  - HIT and BLK come from the all-strength row.
  - The last-5 rate is blended toward a 3-season baseline that is shrunk to a position prior.
  - ES+PP TOI is scaled by the recent all-situation share, capped at 1.3.
  - On master, HIT/BLK use ev last-5 with fallbacks of 1 and 0.5.
- **Kind:** model-changing (HIT, BLK).
- **Depends on:** F2 for the `_3ya` fields; without it the baseline is the prior.
- **Tests:** `runProjectionV2.test.ts` ("skater physical event rates"), `skater-queries.test.ts` ("reads the all-strength scope…").

### F4: League-rate rescale

- **Commit:** `34a5588db`.
- **Files:**
  - `skater-adjustments.ts` (`leagueReference`, season weighting)
  - `projection-weights.ts` (hits recent shrink 120 → 240; prior-season weight 0.5; league shrink and bounds)
  - `skater-queries.ts` (`fetchLeaguePhysicalTotals`, oct `:438-483`; `_season` columns)
  - `run-forge-projections.ts` (cache, `physical_league_totals_unavailable`)
  - `skater-stage.ts` (`:1577-1587`)
  - types
  - `supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql` (order 88, **pending**)
- **Behaviour:** the two prior seasons are weighted 0.5 and their events rescaled by this season's league rate to date. If the RPC is absent, it uses the constant priors without rescaling, but the constants still differ from F3's.
- **Evidence in the commit message:** hits −240 and blocks −69 Poisson deviance; established-D calibration 1.13 → 1.04–1.05. No standalone report artifact was found.
- **Kind:** model-changing (HIT, BLK).
- **Depends on:** F3, F2, and migration 88 for the full effect.
- **Tests:** `runProjectionV2.test.ts`, `skater-queries.test.ts` ("league physical totals").

### F5: External-fantasy exclusion and provenance fence

- **Commits:** `7f094c8e6` ("big commit", mixed) and `0de97e77d` (mixed checkpoint).
- **Files:**
  - Model: `skater-stage.ts` oct `:1556,1706` and `goalie-stage.ts:166` (`loadSeasonBootstrap(..., false)`).
  - Stamp: `run-forge-projections.ts` (`buildForgeInputProvenance({ externalFantasyInputsExcluded: true })`, 3 call sites), `calibrationEligibility.ts`, `gameRevisions.ts` (type).
  - Fence:
    - `apiHelpers.ts:60` (`requireLatestSucceededRunId` → 422)
    - `forge/goalies.ts:495-500` (422)
    - `forge/players.ts:194` (fallback skips unstamped runs)
    - `projections/{players,goalies,teams}.ts` (explicit `runId` → 422)
    - `consumerRevisionAdmission.ts:88` (RSO `use_not_approved`)
    - `run-projection-accuracy.ts` (422 message; eligibility now needs the label)
- **Behaviour:** the early-season bootstrap prior uses previous-season history only (master gives external fantasy 60% of the prior weight). Readers refuse runs without the label.
- **Kind:** model-changing only where season bootstrap runs (env-gated). By about game 20 the bootstrap weight reaches 0, so for regulars the model effect fades by mid-November. The fence is plumbing.
- **Cutover:** every run created before the deploy lacks the label. Until the first stamped run of the day exists:
  - `/api/v1/projections/*` and `/api/v1/forge/goalies` return 422.
  - `/api/v1/forge/players`'s fallback finds nothing.
  - RSO forecasts are excluded.
  - The accuracy job 422s for unlabelled runs.
  - Historical `runId` queries 422 permanently.
- **Tests:**
  - `nativeInputEligibility.test.ts` (stages pass `false`)
  - `apiHelpers.test.ts`, `apiHelpers.runAdmission.test.ts`, `explicitRunAdmission.test.ts`
  - `forge/goalies.test.ts` (+snapshot), `forge/players.test.ts`
  - `releasedRunFence.test.ts`, `run-forge-projections.resume.test.ts`, `run-projection-accuracy.test.ts`

### F6: S-F latest rolling row RPC

- **Commit:** `0ff219d25`.
- **Files:**
  - `skater-queries.ts`: RPC path oct `:179-336`; legacy scan renamed, oct `:343-436`
  - `queryCaptureHook.ts`, `inputCapture.ts` (read-only probe)
  - `web/scripts/run-forge-local.ts` (local transport allows only `forge_latest_rolling_rows` GET)
  - `run-forge-projections.local-attempt.test.ts` (+11)
  - `skater-queries.test.ts` ("latest rolling row per player")
- **Behaviour:** one GET per strength returns each requested player's latest row before the cutoff plus the trimmed sidecar (`historicalCompatibility` limited to `p_columns`, plus `alignedCountSupport`). Coverage is proved by exactly one entry per id, in ascending order.
  - Falls back to the legacy scan on `PGRST202`, during read-only reconstruction, and when replaying pre-RPC captures. Other provider errors throw.
  - Rollback needs no build: `DROP FUNCTION` gives `PGRST202`, which gives the legacy scan.
- **Kind:** plumbing. The same latest row is returned to `pickLatestByPlayer`.
- **Depends on (as written):** F2, the F1 aligned hunk, and F3/F4 columns and types (§4.1).
- **Note:** the comment at oct `skater-queries.ts:179` cites the draft name `20261021180242_forge_latest_rolling_rows.sql`. The ledger file is `20261021182129_forge_latest_rolling_rows.sql`.
- **Tests:** `skater-queries.test.ts`, `run-forge-projections.local-attempt.test.ts`, `run-forge-local.test.ts`.

### F7: S-B served-forecast ledger

- **Commit:** `8cfaba0fc`.
- **Files:**
  - `web/lib/player-forecasts/servedForecastLedger.ts` (+test)
  - `web/pages/api/v1/db/forge-served-forecast-snapshot.ts` (+`web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts`)
  - `web/pages/api/v1/db/forge-served-forecast-settle.ts` (+test)
  - `web/pages/api/v1/forge/scoreboard.ts` (+`web/tests/api/forge-scoreboard.test.ts`)
- **Behaviour:**
  - The snapshot (admin, cron-audited, off-season gated) writes one row per player-game-source, for bridge exact/re-aimed plus `naive_last5`/`naive_season`. It refuses started games.
  - Settle writes actuals from `wgo_skater_stats`/`wgo_goalie_stats` for yesterday and the two days before.
  - The public scoreboard reads settled rows and returns 200 with `empty: true` if there are none. It returns 500 if the table is missing.
  - Serving is unchanged.
- **Kind:** plumbing.
- **Depends on:** the `gameExpectations.ts` type; migration 97; scheduling.
- **Import closure on master:** `fantasyPoints`, `fantasyPointsConfig`, `forgeDailyBridge` (`loadForgeDailyBridgeForecasts`, `teamStrengthPriors`, `teamWinProbability`), `planningInputs` (`loadPlanningInputs`, `pages`), `contributions.forecastCalendarPolicy`, `apiHelpers.getQueryStringParam` and `withCronJobAudit` (optional opts) all exist on master.
- **Tests:** `servedForecastLedger.test.ts` (9), the snapshot test (3), the settle test (3) and `forge-scoreboard.test.ts` (3).

### H1 and H2: Q7 and Q8 (`65fc4b9ee`, HOLD)

- **Files:** `skater-adjustments.ts` (`resolveSkaterConversionRates`, oct `:698-718`; rest `buckets`, oct `:353`, `:375-381`), `skater-stage.ts` (oct `:1934-1947`, `:2306`), tests.
- **Q7:** a supported goal rate is used directly, without the second `sampleWeight` shrink. Not cleared: top-decile G calibration flips from 1.050 to 0.952.
- **Q8:** rest tiers shifted so that a B2B (rest = 1) is the heavy tier. A wash (|Δ| ≤ 0.0012); TJ's call.
- **Trap:** the commit message says that to ship Q8 without Q7, the resolver should "return `conversionShrink.*.legacy`" (one line). That would also re-shrink **assists**, which R18 uses as fitted. To keep master's behaviour, return `legacy` for `goalRateEs`/`goalRatePp` only and keep `clamp(bayes)` for assists.
- To keep master's rest behaviour, pass `buckets: "legacy"` in the live call at oct `skater-stage.ts:1940-1941`. Then the ledger-only legacy call at `:1943-1946` becomes redundant.

### H3: Assist denominator option (`07c7f71af`, `f0ab2b9fd`, HOLD)

- **Files:**
  - `skater-adjustments.ts` (`SKATER_ASSIST_SCALE`, `resolveAssistDenominators`, `skaterConversionPriorsAndBounds`, oct `:541-695`)
  - `skater-stage.ts` (`SKATER_ASSIST_RATE_CLAMPS`/`clampSkaterAssistRate`/`buildSkaterNaivePriorBaseline`, oct `:1056-1099`; `legacyAssistRates`, oct `:2308-2322`; ledger fields)
  - tests
- **Default** `{ es: per_goal, pp: per_two_goals }`: its constants and clamps equal R18's, so projected numbers equal master's. The difference is the option and the persisted `assist_rate_scale.legacy_per_two_goals` fields.
- **Entanglement:** H3 uses H1's resolver.

### H4: PP targets from official WGO (`e316db4c0`, HOLD; landed during this pass)

- **Files:** `queries/team-context-queries.ts` (`fetchTeamOfficialPpUsage`, `toiPkSecondsAvg`), `skater-stage.ts` (+107 lines: `computeTeamPpShare`, `allocatePpToiByTeamOpportunity` weights, `hasPpUnit` minimum), and tests.
- **Verdict** (`pp-usage-verdict.md`): clears PP usage bias/RMSE, but top-decile PPP calibration regresses (1.047 → 1.140).
- The commit notes that pre-change input captures cannot be replayed.

### F8–F15 (not needed for S-F or S-B)

- **F8: native serving.**
  - Files: `startChartContract.ts` (+272), `start-chart.ts` (+65), `gameExpectations.ts`, `gameExpectationView.ts`, `gameExpectationReader.ts`, `/api/v1/forge/forecasts.ts`, `pages/forge/forecasts.tsx`, `planningTypes.ts`, `rosterScheduleData/planning.ts`, `planningDataTransport.ts`.
  - Dark until `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` is set.
  - **Unconditional Start Chart changes:** a 4 MB response cap (503 `start_chart_too_large`); `forecast_source` values other than `game_expectations` now return 400; cache max-age is bounded by receipt expiry; the cache key includes the source and head.
  - Master carries a release-specific variant of `planning.ts` (R10 "native S-1 dark"), which needs reconciliation.
  - Tests: `start-chart.test.ts`, `startChartPipeline.test.ts`, `gameExpectations.test.ts`, `forge/forecasts.test.ts`, `pages/forge/forecasts.test.tsx`, `pages/start-chart.test.tsx`, `planning.test.ts`.
- **F9: native stack.** About 20 new `player-forecasts/native*` and related files. They are imported only by `web/scripts/forge-daily*.ts`, `native-*.ts` and `capture-current-season-sog-baseline.ts`; no route imports them. Uses migration 83 (applied).
- **F10: cadence.** `enqueueStarterBoardCadence` calls `rpc("enqueue_forge_cadence_slot")`, which has **no migration on either branch**. `dispatchStarterBoardJobs` is called without `cadenceInput` (`pages/api/internal/starter-board.ts:34`), so the path is inert.
- **F11: schedule revision.** `issuedContext.ts` and `planningInputs.ts` now hash ISO-normalised `start_time`. Revisions issued before the deploy may stop matching readers after it (identity-conflict exclusions until the next issuance), unless stored `start_time` is already canonical ISO.
- **F12:** no importer outside tests.
- **F13:** `rollingPlayerOperationalPolicy.ts`, `update-rolling-player-averages.ts` (+40), `fetchRollingPlayerAverages.ts` (full-refresh plan; `games` `order("id")`), `rollingPlayerValidationPayload.ts`, `rollingPlayerSupportPayload.mergeRollingSupportPayloadFields`, `debug/rolling-player-metrics.ts`.
  - **Master hazard it fixes:** `fullRefresh=true` defaults to `rpc_truncate`, a whole-table truncate, even with `playerId` (`fetchRollingPlayerAverages.ts:4317` on master).
  - Tests: `update-rolling-player-averages.test.ts`, `fetchRollingPlayerAverages.test.ts`, `rollingPlayerValidationPayload.test.ts`.
- **F14:** offline harness; imports H1/H2 exports.
- **F15:** `pages/start-chart.tsx` partial-category selection. Required before F1.

---

## 3. Dependency graph (unreleased features)

```
F6 S-F (RPC) ── as written ──> F2 hydration ──> (master stage consumes it: model change)
     │                   ├──> F1 aligned hunk + rollingPlayerCountSupport.ts (inert on master)
     │                   └──> F3/F4 columns, "all" strength, LeaguePhysicalTotals type (inert on master)
F1 reader ──> F1w writer + backfill ──> NST ES/PP coverage; ──> F15/consumer null-safety; ──> TJ head policy (S-J)
F3 ──> F2 (3ya fields)        F4 ──> F3, migration 88
F5 stamp ──(one release later)──> F5 fence
F7 S-B ──> gameExpectations.ts (type only, from F8) ; migration 97
H3 ──> H1 resolver (entangled in skater-stage/skater-adjustments)
F14 harness ──> H1/H2 exports
```

---

## 4. Minimal release sets, exactly

### 4.1 S-F

Line numbers are for `octoberBranch` `web/lib/projections/queries/skater-queries.ts`, which `e316db4c0` left unchanged since `0ff219d25`.

| Hunk | Lines (oct) | Owner | On a master candidate |
|---|---|---|---|
| imports `readAlignedCountSupport`; `ROLLING_PLAYER_SUPPORT_PAYLOAD_*`; `LeaguePhysicalTotals` | 2, 5, 11 | 6e14053ff, 6767073ea, 34a5588db | **drop** |
| import `isReadOnlyProjectionReconstruction` | 3 | 0ff219d25 | keep |
| `ROLLING_ROW_SELECT_CLAUSE` extra 9 columns | 127-137 | b8fe1072e, 34a5588db | **drop** (master clause) |
| `"invalid_support_row"` reason | 171 | 6767073ea | drop or keep (harmless) |
| RPC constants, `isIsoDate`, `rollingRowKey`, `hasOwn`, `isRollingRowInScope` | 179-204 | 0ff219d25 | keep; `RollingStrength` = `"ev" \| "pp"`; fix the migration filename in the `:179` comment |
| `hydrateRollingSupport` (with doc comment) | 202-235 | 6767073ea (F2) + 6e14053ff `:216-222` (F1) | **drop** for S-F-lite; keep for R21 |
| `fetchRollingRows` RPC path | 242-336 | 0ff219d25 | keep, but delete `:325-329` (support hydration; keep the `rolling_row === null` / `support_row` consistency check at `:309-313`) |
| legacy scan | 343-402 | 0ff219d25 (refactor of master) | keep (= master's scan) |
| legacy sidecar join | 403-435 | 6767073ea | **drop** for S-F-lite |
| `LeaguePhysicalTotalsReadError`, `fetchLeaguePhysicalTotals` | 438-483 | 34a5588db | **drop** |

Plus:
- `queryCaptureHook.ts` (+12) and `inputCapture.ts` (+2/−1)
- `run-forge-local.ts` (+3/−1)
- the `rpc/forge_latest_rolling_rows` fixture in `run-forge-projections.local-attempt.test.ts` (`0ff219d25`, +11)
- `skater-queries.test.ts`: the "latest rolling row per player" block, adapted so that `support_row` is ignored and no hydration is asserted. Drop the legacy-scan sidecar block and the league-totals block.

**Result:** zero model change; uses production migration 95. The same S-F reader with hydration restored is R21 (F2).

### 4.2 S-B

- All of `8cfaba0fc`, except `web/scripts/forge-counterfactual-backtest.ts`, its test and `fixtures/forge-counterfactual-backtest/*`.
- Plus `web/lib/player-forecasts/gameExpectations.ts` (`7f094c8e6`, 236 lines, no DB access).
  - Its imports (`contributions`, `planningContributions`, `planningTypes`) are identical on master or already have the needed exports.
  - Not compiled against master here; run `npx tsc --noEmit`.
  - If it fails, replace the import with a local `{ gameId; targets; appearanceProbability; startProbability }` type.
- Plus the migration and scheduling (§5).

---

## 5. Migrations and production prerequisites

| Item | State | Needed by | Notes |
|---|---|---|---|
| **S-B ledger** `forge_served_forecast_ledger` (+ optional view `forge_served_forecast_scoreboard_daily`) | **no file**; SQL in `s-b-served-forecast-ledger-design.md` §7 | F7 | Next authority order is **97**. The design doc and `8cfaba0fc` still say "93". An untracked `supabase/migrations/20261021210000_in_season_sandbox_billing.sql` from another session may also claim 97; coordinate. The file name proposed in §7 (`20261021190000_…`) must be renamed to the ledger version at apply time, as was done for 92 and 95. Practice so far: migration file and authority record live on `octoberBranch` and are applied by TJ; master does not carry them (master's authority has 72 rows). **Apply before the deploy**, or the snapshot and settle return 500 and the public scoreboard returns 500 with the raw error message. The §7 SQL already follows the D4 explicit-grant pattern (89/90 pending; Supabase stops auto-grants 2026-10-30). |
| `forge_latest_rolling_rows` (order 95) | **applied** 2026-10-21 | F6 | Rollback: `DROP FUNCTION` (reader falls back). |
| `forge_league_skater_physical_totals` (order 88) | **pending** | F4 | Read-only; code falls back. The local transport refuses it (POST RPC not allowlisted), so local and reconstruction runs never exercise the rescale. |
| `forge_projection_results_source_run_fence` (92) | applied | already-shipped R15 | — |
| `native_forecast_catalog_heads` (83) | applied | F8/F9 | — |
| `forge_local_execution_fence` (77) | pending on both branches | local runner only | Not a release difference. |
| `enqueue_forge_cadence_slot` RPC | **no migration anywhere** | F10 | Inert until a caller passes `cadenceInput`. |
| `alignedCountSupport` in production sidecars | **unknown** (writer on master never writes it, and each master recompute replaces `support_payload` without it) | F1 | Before any F1 reader: ship F1w, run a bounded recompute that rewrites each active skater's latest ev/pp row (bounds per `web/README.md`), then measure coverage read-only. NST ES/PP rows were NULL 10-07..10-18 (REPORT §1), so missing pairs remain. |
| `STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED`, Starter Board compute flags | unknown (env) | F5 model effect | Check read-only in Vercel env. |
| First stamped FORGE run after the F5 fence deploy | process | F5 | See §6 R5. |

No unapplied migration is needed by F6 or F7 other than the new ledger table. `migration-authority.json` `pending` records relevant to FORGE: **88** (F4) and **77** (local only). **89** and **90** (D4 grants) are FORGE-neutral.

---

## 6. Risks

- **R1 Hydration is a model change.** The audit treated `6767073ea` as S-F plumbing, but on master it changes TOI, SOG, G, A, PPP and the HIT/BLK fallbacks (§1). Ship S-F without it first, or ship it with a backtest.
- **R2 Reader without writer.** F1 consumes `support_payload.alignedCountSupport`, a key the production writer does not write and erases on every upsert (`splitRollingUpsertRowForDurableStorage`, master `:460-532`). Shipping F1's reader alone would null G/A/PPP for most skaters and null goalie W through team GF (S-J).
- **R3 Dropped columns.** All 34 columns FORGE selects on `octoberBranch` and all 491 names in `rollingDroppedColumns.ts` were cross-checked: no in-scope non-test file references a dropped column. Every FORGE-read pruned field (`*_total_all`, `sog/hits/blocks_per_60_all|avg_*`, `*_3ya`) is still written to `historicalCompatibility` by the R17 writer (only dropped keys are skipped; nulls are omitted, which readers treat as unknown). The inventory that chose the drop was generated at `octoberBranch` `ebdcfe6be`, so it accounted for `octoberBranch`-only readers. **Fail-closed note:** if a column FORGE selects is ever dropped, the RPC path rejects the whole read (`invalid_row`) and the legacy select errors, so every team-game fails.
- **R4 `support_payload` keys.** `historicalCompatibility` is written. `deprecatedCompatibility` (`gp_pct_*`) is still written; its readers are the trends page and the validation payload, not FORGE. **`alignedCountSupport` is not written** (R2).
- **R5 F5 cutover.** The reader fence refuses every unlabelled run. Ship the stamp first and the fence after at least one stamped run per date and horizon that readers select; or deploy the fence just before the scheduled run and trigger an approved run. Historical `runId` lookups 422 permanently; decide if that is acceptable.
- **R6 F11 hash change.** Schedule revisions issued before the deploy may stop matching until the next issuance.
- **R7 Mixed commits.** `7f094c8e6`, `0de97e77d`, `317f8f57e` and `b8fe1072e` span many unrelated lanes. Never cherry-pick them whole; port by hunk.
- **R8 HOLD entanglement.** Every model feature (F1, F3, F4, H1–H4) edits the same regions of `skater-stage.ts` and `skater-adjustments.ts`. A master candidate carrying F3/F4 must be hand-merged against R18's form, without H1–H4. See the Q7 trap in §2 (H1/H2).
- **R9 Evidence gap.** No backtest exists for master-mode inputs (§1). The R18 ES-assist clearance came from `octoberBranch`-input runs.
- **R10 Native and Start Chart unconditional changes (F8).** The `forecast_source` 400 and the 4 MB 503 change behaviour for every Start Chart caller, even with native dark.
- **R11 Missing RPC (F10)** if anyone enables the cadence coordinator.
- **R12 S-B runtime.** The snapshot runs the full RSO bridge load (`loadForgeDailyBridgeForecasts`, 45 s deadline) once per scheduled day. The scoreboard is public and reads with the service role (bounded by `days` ≤ 60 and `MAX_ROWS` = 120,000).
- **R13 Branch drift during this pass.** `a7e9627f0` and `e316db4c0` landed while the inventory ran. Re-run `git log 'e316db4c0..octoberBranch' -- web/lib/projections web/lib/player-forecasts web/lib/rollingPlayer* web/lib/supabase/Upserts` before cutting a candidate.

---

## 7. Recommended release candidates

Every candidate is master-based, built locally, with no remote build until TJ approves the push and deploy (AGENTS.md, Vercel controls).

### R19: S-B + S-F-lite (+ F13 optional). Plumbing; one build.

- **Contents:** §4.2 and §4.1. Optionally F13: `rollingPlayerOperationalPolicy.ts`, its route and writer hunks, and their tests.
- **Before TJ approves:**
  - Migration 97 is written on `octoberBranch`, registered in the authority file, replayed in a disposable PG harness (the authority practice), then applied with TJ's approval **before** the deploy.
  - A scheduling decision for the snapshot (`30 12 * * *`) and settle (`0 11 * * *`):
    - `web/vercel.json` cron entries, which are a deploy-time config change; or
    - pg_cron; or
    - manual runs through the `/db` runner.
  - For S-F-lite, no model evidence is needed. Optional parity check (TJ-run, read-only, 1 query): for 20 skaters × ev/pp at one cutoff, the RPC `rolling_row` equals the newest table row's selected columns.
- **Checks:**
  - S-B tests: `npm test -- lib/player-forecasts/servedForecastLedger.test.ts __tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts __tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts tests/api/forge-scoreboard.test.ts` (run from `web/`)
  - Plus `gameExpectations.test.ts` if that file is taken.
  - S-F tests: `skater-queries.test.ts`, `run-forge-projections.local-attempt.test.ts`, `scripts/run-forge-local.test.ts`, `runProjectionV2.test.ts`, `nativeGoalAccounting.test.ts`.
  - `cron-auth-boundaries.test.ts`, `operational-route-auth.test.ts`, and the cron-inventory tests if crons are added.
  - `npx tsc --noEmit`, `npm run lint`.
- **Post-deploy smoke** (≤5 sequential requests):
  - one approved snapshot for the next slate
  - next day, one settle and one `GET /api/v1/forge/scoreboard?days=1`
  - the next scheduled FORGE run's logs show no `PGRST202` warning and a normal `data_quality`
- **Rollback for S-F:** drop the function (no build).

### R20: F1w writer (only if TJ intends to ship F1 eventually). Plumbing.

- **Contents:** §2 F1w.
- **Evidence:**
  - A local `dryRunUpsert` for about 5 players produces sidecars that `readAlignedCountSupport` accepts.
  - The payload byte delta per row.
  - After the deploy, a TJ-approved bounded recompute covering each active skater's latest ev/pp row.
  - Then a read-only coverage count of latest rows with a valid `alignedCountSupport`, both pairs present.
- **Checks:** `rollingPlayerCountSupport.test.ts`, `fetchRollingPlayerAverages.test.ts`, `update-rolling-player-averages.test.ts`, tsc, lint.

### R21: F2 hydration (S-F full reader). Model-changing.

- **Contents:** restore `hydrateRollingSupport` without the F1 lines, the RPC `support_row` hydration and the legacy-scan sidecar join.
- **Evidence:** a paired backtest of master mode vs hydrated mode on identical player-games. Two options:
  - `web/scripts/capture-forge-reconstruction.ts` read-only reconstruction runs for about 10 past slates on each code version. Reconstruction refuses RPCs, so both sides use the legacy scan (fine for this question). Score against WGO actuals with the harness gate.
  - From R19 on, compare the S-B ledger's `bridge_exact` before vs after over ≥7 slates. This is weaker, because it is unpaired.
  - **Gate:** no regression on G/A/PPP/SOG MAE, bias or RMSE; decile-10 calibration; B2B slices; FP MAE under TJ's weights.
  - Also confirm 0 `invalid_support_row` failures in reconstruction.
- **Checks:** `skater-queries.test.ts` (both describe blocks), `runProjectionV2.test.ts`, `nativeGoalAccounting.test.ts`, tsc, lint.

### R22: F3 + F4 hits/blocks (+ migration 88). Model-changing.

- **Contents:** §2 F3 and F4 hunks, hand-merged onto R21's stage (no H1–H4).
- **Evidence:**
  - A report artifact for the backtest stated in `34a5588db` (Poisson deviance on games 2-30 of 2024-25 and 2025-26; established-D calibration).
  - Plus a ledger or reconstruction check that HIT/BLK bias on `bridge_exact` improves.
  - Migration 88 is applied by TJ after the code ships, because the code falls back.
- **Can merge with R21 into one build** if both evidence sets clear; heads attribute cleanly (R21 affects TOI/SOG/G/A/PPP, R22 affects HIT/BLK).
- **Checks:** `runProjectionV2.test.ts`, `skater-queries.test.ts`, `nativeGoalAccounting.test.ts`, `startChartPipeline.test.ts`, tsc, lint.

### R23: F5 in two steps

- **R23a:** stamping plus bootstrap exclusion. Evidence:
  - the production env check (bootstrap on or off)
  - if on, a reconstruction comparison on early-season slates (low-GP players), or accept it as a policy decision
- **R23b, one release later:** the reader fence (`apiHelpers.ts`, `forge/*`, `projections/*`, `consumerRevisionAdmission.ts`, calibration eligibility). Evidence: the read-only query `select count(*) from forge_runs where status = 'succeeded' and metrics->'input_provenance'->>'external_fantasy_input_contract' = 'excluded_from_native_inputs_v1'` shows stamped runs for every date and horizon that readers may select.
- **Checks:** the F5 tests listed in §2, `start-chart.test.ts`, `forge/players.test.ts`, `forge/goalies.test.ts`, tsc, lint.

### Later or HOLD

- **F1 reader:** after R20 coverage plus TJ's head policy (withhold / `prior_only` / keep master). Needs F15 and a consumer audit (bridge, RSO, Start Chart) and the same paired backtest, including the null-head rate.
- **H1** (not cleared), **H2** (TJ's call; ship via `buckets: "legacy"` default flip only if wanted), **H3** (net zero; ship only if TJ wants its ledger fields), **H4** (top-decile PPP regression): do not ship as they are.
- **F8–F11:** a native activation plan of their own. F8's unconditional Start Chart changes need their own review.

---

## 8. Not verified here

- Production row facts: NULL pruned fields on latest wide rows; the share of sidecars carrying `alignedCountSupport`; env flags.
- `gameExpectations.ts` compiling against master (field names match; not type-checked).
- Any test run. The inventory is git analysis only; commit messages claim their own test passes.
- The release mapping of already-shipped commits is inferred from release subjects plus the absence of remaining diff lines, not from SHA citations (only R16–R18 cite sources).

---

## Appendix A: per-file attribution (`origin/master` 56fb03fef vs `octoberBranch` e316db4c0)

"+lines" counts the remaining added lines on `octoberBranch` that blame to that commit. The last column lists commits in the range that touched the file but own none of the remaining diff, meaning their content is on master under a release SHA or was superseded.

| File | St | +/- | Unreleased content by commit (+lines) | Touched in range, content already on master or superseded |
|---|---|---|---|---|
| `web/__tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts` | A | +96/-0 | 8cfaba0fc (96) | - |
| `web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts` | A | +101/-0 | 8cfaba0fc (101) | - |
| `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts` | M | +3/-1 | bb1c80e8e (3) | b47c512fb |
| `web/__tests__/pages/api/v1/db/update-rolling-player-averages.test.ts` | M | +68/-0 | 317f8f57e (68) | afa8cac9b, b47c512fb |
| `web/__tests__/pages/api/v1/forge/forecasts.test.ts` | A | +66/-0 | 7f094c8e6 (51), 0de97e77d (12), 5ae65fc13 (3) | - |
| `web/__tests__/pages/api/v1/forge/goalies.test.ts` | M | +79/-9 | 7f094c8e6 (67), a5b65d319 (9), 317f8f57e (2), cc3be5c09 (1) | - |
| `web/__tests__/pages/api/v1/forge/players.test.ts` | M | +19/-4 | 7f094c8e6 (18), cc3be5c09 (1) | a5b65d319, b47c512fb |
| `web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts` | A | +110/-0 | 7f094c8e6 (108), 0de97e77d (2) | - |
| `web/__tests__/pages/api/v1/start-chart.test.ts` | M | +765/-12 | 7f094c8e6 (431), 5ae65fc13 (149), 317f8f57e (128), 0e8040da9 (32), 0de97e77d (15), a5b65d319 (3), bb1c80e8e (2), b47c512fb (1) | - |
| `web/__tests__/pages/forge/forecasts.test.tsx` | A | +157/-0 | 7f094c8e6 (157) | - |
| `web/__tests__/pages/start-chart.test.tsx` | M | +590/-1 | 7f094c8e6 (444), 317f8f57e (101), 0e8040da9 (38), 0de97e77d (4), 5ae65fc13 (3) | - |
| `web/lib/fantasy-projections/seasonJobs.ts` | M | +69/-0 | 7f094c8e6 (69) | - |
| `web/lib/player-forecasts/contributionStore.test.ts` | M | +171/-1 | 7f094c8e6 (171) | - |
| `web/lib/player-forecasts/contributionStore.ts` | M | +55/-26 | 7f094c8e6 (55) | - |
| `web/lib/player-forecasts/currentRosterInjuryEvidence.ts` | A | +48/-0 | 7f094c8e6 (48) | - |
| `web/lib/player-forecasts/currentRosterNativeInputs.ts` | A | +155/-0 | 7f094c8e6 (155) | - |
| `web/lib/player-forecasts/currentSeasonSogContribution.test.ts` | A | +245/-0 | 7f094c8e6 (245) | - |
| `web/lib/player-forecasts/gameExpectationReader.ts` | A | +33/-0 | 7f094c8e6 (29), 5ae65fc13 (4) | - |
| `web/lib/player-forecasts/gameExpectationView.ts` | A | +178/-0 | 7f094c8e6 (175), 0de97e77d (3) | - |
| `web/lib/player-forecasts/gameExpectations.test.ts` | A | +447/-0 | 7f094c8e6 (435), 0de97e77d (11), f9b571f43 (1) | - |
| `web/lib/player-forecasts/gameExpectations.ts` | A | +236/-0 | 7f094c8e6 (236) | - |
| `web/lib/player-forecasts/goalieBaseline.test.ts` | M | +338/-2 | 7f094c8e6 (338) | - |
| `web/lib/player-forecasts/goalieBaselineInputCapture.ts` | M | +32/-2 | 7f094c8e6 (32) | - |
| `web/lib/player-forecasts/nativeBaselineCadence.ts` | A | +336/-0 | 7f094c8e6 (268), 0e3261558 (56), a23728de2 (12) | - |
| `web/lib/player-forecasts/nativeBaselinePublication.test.ts` | A | +896/-0 | 7f094c8e6 (678), 4ce7e1f5f (92), f9b571f43 (83), a23728de2 (29), ceceb407a (14) | - |
| `web/lib/player-forecasts/nativeBaselinePublication.ts` | A | +191/-0 | 7f094c8e6 (184), f9b571f43 (7) | - |
| `web/lib/player-forecasts/nativeCadenceOutputPreparation.ts` | A | +279/-0 | 4ce7e1f5f (96), f9b571f43 (89), ceceb407a (51), 0e3261558 (43) | - |
| `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts` | A | +217/-0 | 0de97e77d (217) | - |
| `web/lib/player-forecasts/nativeDailyMeansCapture.ts` | A | +587/-0 | 0de97e77d (587) | - |
| `web/lib/player-forecasts/nativeDailyPipeline.test.ts` | A | +174/-0 | ceceb407a (156), f9b571f43 (18) | - |
| `web/lib/player-forecasts/nativeDailyPipeline.ts` | A | +263/-0 | ceceb407a (247), f9b571f43 (16) | - |
| `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts` | A | +291/-0 | 0e3261558 (208), f9b571f43 (83) | - |
| `web/lib/player-forecasts/nativeDailyPipelineV2.ts` | A | +314/-0 | f9b571f43 (193), 0e3261558 (121) | - |
| `web/lib/player-forecasts/nativeInputMaterialization.ts` | A | +401/-0 | 7f094c8e6 (379), f9b571f43 (12), a23728de2 (7), 0e3261558 (3) | - |
| `web/lib/player-forecasts/nativeParticipationFrame.test.ts` | A | +236/-0 | 7f094c8e6 (236) | - |
| `web/lib/player-forecasts/nativeParticipationFrame.ts` | A | +260/-0 | 7f094c8e6 (260) | - |
| `web/lib/player-forecasts/playerForecasts.test.ts` | M | +92/-4 | 7f094c8e6 (92) | - |
| `web/lib/player-forecasts/rollingParticipationFrame.test.ts` | A | +204/-0 | 0de97e77d (204) | - |
| `web/lib/player-forecasts/rollingParticipationFrame.ts` | A | +167/-0 | 0de97e77d (167) | - |
| `web/lib/player-forecasts/scopeReads.ts` | M | +22/-6 | 7f094c8e6 (22) | - |
| `web/lib/player-forecasts/seasonGameContributions.ts` | A | +82/-0 | 7f094c8e6 (82) | - |
| `web/lib/player-forecasts/servedForecastLedger.test.ts` | A | +116/-0 | 8cfaba0fc (116) | - |
| `web/lib/player-forecasts/servedForecastLedger.ts` | A | +230/-0 | 8cfaba0fc (230) | - |
| `web/lib/player-forecasts/sourceObservations.ts` | M | +1/-1 | 7f094c8e6 (1) | - |
| `web/lib/player-forecasts/yahooUniverse.fixtures.ts` | A | +52/-0 | 0de97e77d (52) | - |
| `web/lib/player-forecasts/yahooUniverse.test.ts` | A | +193/-0 | 0de97e77d (193) | - |
| `web/lib/player-forecasts/yahooUniverse.ts` | A | +286/-0 | 0de97e77d (286) | - |
| `web/lib/player-forecasts/yahooUniverseCapture.test.ts` | A | +77/-0 | 0de97e77d (77) | - |
| `web/lib/player-forecasts/yahooUniverseCapture.ts` | A | +76/-0 | 0de97e77d (76) | - |
| `web/lib/projections/apiHelpers.runAdmission.test.ts` | A | +71/-0 | 0de97e77d (66), bb1c80e8e (4), a5b65d319 (1) | - |
| `web/lib/projections/apiHelpers.test.ts` | M | +34/-2 | 0de97e77d (19), 7f094c8e6 (15) | - |
| `web/lib/projections/apiHelpers.ts` | M | +8/-1 | 7f094c8e6 (8) | bb1c80e8e, a5b65d319 |
| `web/lib/projections/calculators/goalie-starter.ts` | M | +10/-7 | 6e14053ff (10) | - |
| `web/lib/projections/calculators/skater-adjustments.ts` | M | +287/-45 | 6e14053ff (84), 34a5588db (51), b8fe1072e (43), 07c7f71af (43), 65fc4b9ee (36), f0ab2b9fd (28) | - |
| `web/lib/projections/calibrationEligibility.ts` | M | +23/-7 | 7f094c8e6 (18), 0de97e77d (5) | - |
| `web/lib/projections/constants/projection-weights.ts` | M | +23/-0 | 34a5588db (13), b8fe1072e (10) | - |
| `web/lib/projections/consumerRevisionAdmission.ts` | M | +4/-0 | 7f094c8e6 (4) | - |
| `web/lib/projections/gameRevisions.ts` | M | +1/-1 | 7f094c8e6 (1) | - |
| `web/lib/projections/goalieModel.test.ts` | M | +18/-0 | 6e14053ff (18) | - |
| `web/lib/projections/goalieModel.ts` | M | +8/-6 | 6e14053ff (8) | - |
| `web/lib/projections/goaliePipeline.test.ts` | M | +23/-2 | 6e14053ff (23) | - |
| `web/lib/projections/inputCapture.ts` | M | +2/-1 | 0ff219d25 (2) | - |
| `web/lib/projections/issuedContext.ts` | M | +2/-1 | 7f094c8e6 (2) | - |
| `web/lib/projections/nativeGoalAccounting.test.ts` | M | +90/-19 | 6e14053ff (61), b8fe1072e (10), 34a5588db (9), e316db4c0 (4), 198883639 (4) | - |
| `web/lib/projections/nativeGoalAccounting.ts` | M | +15/-6 | 6e14053ff (15) | - |
| `web/lib/projections/nativeInputEligibility.test.ts` | A | +98/-0 | 7f094c8e6 (98) | - |
| `web/lib/projections/privateParticipationScenario.test.ts` | A | +192/-0 | 1ddef915d (175), 971a43e78 (17) | - |
| `web/lib/projections/privateParticipationScenario.ts` | A | +180/-0 | 1ddef915d (179), 971a43e78 (1) | - |
| `web/lib/projections/queries/skater-queries.test.ts` | M | +302/-6 | 0ff219d25 (178), 6767073ea (55), 34a5588db (39), 6e14053ff (17), b8fe1072e (13) | - |
| `web/lib/projections/queries/skater-queries.ts` | M | +257/-15 | 0ff219d25 (162), 34a5588db (51), 6767073ea (35), b8fe1072e (5), 6e14053ff (1) | - |
| `web/lib/projections/queries/team-context-queries.test.ts` | M | +92/-2 | e316db4c0 (92) | - |
| `web/lib/projections/queries/team-context-queries.ts` | M | +105/-2 | e316db4c0 (105) | - |
| `web/lib/projections/queryCaptureHook.ts` | M | +12/-0 | 0ff219d25 (12) | - |
| `web/lib/projections/releasedRunFence.test.ts` | M | +3/-4 | a5b65d319 (3) | bb1c80e8e |
| `web/lib/projections/run-forge-projections.local-attempt.test.ts` | M | +43/-0 | 0de97e77d (31), 0ff219d25 (11), 7f094c8e6 (1) | a5b65d319 |
| `web/lib/projections/run-forge-projections.resume.test.ts` | M | +4/-4 | b21242f1c (3), a5b65d319 (1) | 21bce4cdb, 0c09a4680, 2c69193e4, 3ba83338d |
| `web/lib/projections/run-forge-projections.ts` | M | +9/-3 | 0de97e77d (5), 34a5588db (4) | 0c09a4680, 2c69193e4 |
| `web/lib/projections/runProjectionV2.alignedConversion.test.ts` | A | +116/-0 | 0de97e77d (69), 07c7f71af (26), f0ab2b9fd (11), 65fc4b9ee (10) | - |
| `web/lib/projections/runProjectionV2.test.ts` | M | +241/-56 | b8fe1072e (73), 34a5588db (57), e316db4c0 (46), 65fc4b9ee (27), 07c7f71af (19), f0ab2b9fd (15), 0de97e77d (1) | 6e14053ff |
| `web/lib/projections/stages/goalie-stage.ts` | M | +13/-12 | 6e14053ff (12), 7f094c8e6 (1) | - |
| `web/lib/projections/stages/skater-stage.ts` | M | +349/-146 | 07c7f71af (110), e316db4c0 (107), 65fc4b9ee (41), 6e14053ff (31), b8fe1072e (25), 34a5588db (18), f0ab2b9fd (15), 7f094c8e6 (2) | 198883639 |
| `web/lib/projections/startChartContract.ts` | M | +272/-2 | 7f094c8e6 (240), 317f8f57e (15), 0de97e77d (13), f9b571f43 (4) | - |
| `web/lib/projections/startChartPipeline.test.ts` | M | +25/-1 | 7f094c8e6 (19), e316db4c0 (6) | - |
| `web/lib/projections/starterBoardQueue.test.ts` | A | +122/-0 | 7f094c8e6 (122) | - |
| `web/lib/projections/starterBoardQueue.ts` | M | +54/-2 | 7f094c8e6 (54) | - |
| `web/lib/projections/types/run-forge-projections.types.ts` | M | +21/-2 | 34a5588db (10), b8fe1072e (5), 6e14053ff (4) | - |
| `web/lib/projections/utils/projection-metadata-builders.ts` | M | +12/-12 | 6e14053ff (12) | - |
| `web/lib/rollingPlayerCountSupport.test.ts` | A | +66/-0 | 6e14053ff (66) | - |
| `web/lib/rollingPlayerCountSupport.ts` | A | +148/-0 | 6e14053ff (148) | - |
| `web/lib/rollingPlayerOperationalPolicy.ts` | M | +50/-0 | 317f8f57e (50) | - |
| `web/lib/rosterScheduleData/forgeDailyBridge.test.ts` | M | +1/-0 | a5b65d319 (1) | 1bc536e8b, bb1c80e8e, afa8cac9b, dee4aa5a4, b401c5f53, 0654fafc4, 79d3b792f, ed949622d, 67e50ee4e |
| `web/lib/rosterScheduleData/planning.ts` | M | +81/-53 | 7f094c8e6 (47), f9b571f43 (26), 67e50ee4e (4), 5ae65fc13 (3) | dad7c619f |
| `web/lib/rosterScheduleData/planningDataTransport.ts` | A | +116/-0 | 7f094c8e6 (114), f9b571f43 (2) | - |
| `web/lib/rosterScheduleData/planningInputs.ts` | M | +2/-1 | 7f094c8e6 (2) | b8fe1072e |
| `web/lib/rosterScheduleOptimizer/planningTypes.ts` | M | +2/-1 | 7f094c8e6 (2) | 6b5e4ea2d, afa8cac9b, dad7c619f, 317375364, 67e50ee4e, 317f8f57e, 0de97e77d |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` | M | +157/-2 | 317f8f57e (111), 6e14053ff (35), ebdcfe6be (10), b47c512fb (1) | 1a36165bc, afa8cac9b, 5c3be7a0f |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` | M | +49/-8 | 6e14053ff (34), 317f8f57e (11), b47c512fb (4) | 1a36165bc, ebdcfe6be, afa8cac9b, 5c3be7a0f |
| `web/lib/supabase/Upserts/rollingPlayerSupportPayload.ts` | M | +29/-0 | 317f8f57e (26), 6e14053ff (3) | - |
| `web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts` | M | +123/-1 | 317f8f57e (123) | 1a36165bc |
| `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts` | M | +44/-3 | 317f8f57e (44) | 1a36165bc |
| `web/lib/supabase/supportedBaselineMigration.test.ts` | M | +78/-5 | 317f8f57e (71), 1e35af7d0 (3), cfeca5024 (2), 5ae65fc13 (1), c04a3626b (1) | 05ee907ca, 1c3759ab9, 45ccf902f, afa8cac9b, bf7af967d, 34a5588db, b8fe1072e, a23728de2, 7f094c8e6 |
| `web/pages/api/v1/db/forge-served-forecast-settle.ts` | A | +68/-0 | 8cfaba0fc (68) | - |
| `web/pages/api/v1/db/forge-served-forecast-snapshot.ts` | A | +93/-0 | 8cfaba0fc (93) | - |
| `web/pages/api/v1/db/run-projection-accuracy.ts` | M | +1/-1 | 7f094c8e6 (1) | bb1c80e8e, b47c512fb, 79492e495 |
| `web/pages/api/v1/db/update-rolling-games.ts` | M | +1/-1 | b8fe1072e (1) | - |
| `web/pages/api/v1/db/update-rolling-player-averages.ts` | M | +40/-6 | 317f8f57e (40) | afa8cac9b, b47c512fb, 79492e495 |
| `web/pages/api/v1/debug/rolling-player-metrics.ts` | M | +16/-4 | 317f8f57e (16) | - |
| `web/pages/api/v1/forge/forecasts.ts` | A | +46/-0 | 0de97e77d (20), 7f094c8e6 (18), 5ae65fc13 (8) | - |
| `web/pages/api/v1/forge/goalies.ts` | M | +8/-1 | 7f094c8e6 (8) | a5b65d319, cc3be5c09, 317f8f57e |
| `web/pages/api/v1/forge/players.ts` | M | +3/-1 | 7f094c8e6 (2), cc3be5c09 (1) | a5b65d319, b47c512fb |
| `web/pages/api/v1/forge/scoreboard.ts` | A | +62/-0 | 8cfaba0fc (62) | - |
| `web/pages/api/v1/game-predictions/forecast.ts` | M | +12/-4 | 317f8f57e (10), b8fe1072e (2) | 79492e495 |
| `web/pages/api/v1/projections/goalies.ts` | M | +17/-0 | 7f094c8e6 (17) | - |
| `web/pages/api/v1/projections/players.ts` | M | +17/-0 | 7f094c8e6 (17) | - |
| `web/pages/api/v1/projections/teams.ts` | M | +17/-0 | 7f094c8e6 (17) | - |
| `web/pages/api/v1/start-chart.ts` | M | +65/-4 | 5ae65fc13 (39), 7f094c8e6 (15), 0de97e77d (9), 317f8f57e (2) | bb1c80e8e, a5b65d319, b47c512fb |
| `web/pages/forge/forecasts.tsx` | A | +180/-0 | 7f094c8e6 (180) | - |
| `web/pages/start-chart.tsx` | M | +158/-27 | 7f094c8e6 (142), 0e8040da9 (15), 5ae65fc13 (1) | - |
| `web/scripts/forge-counterfactual-backtest.test.ts` | A | +261/-0 | 8cfaba0fc (78), a1e8303cf (77), a7e9627f0 (52), 97663ca6e (39), 5422a1ee3 (15) | - |
| `web/scripts/forge-counterfactual-backtest.ts` | A | +611/-0 | 8cfaba0fc (291), a7e9627f0 (223), 97663ca6e (40), a1e8303cf (33), 5422a1ee3 (24) | - |
| `web/scripts/run-forge-local.test.ts` | M | +1/-1 | 0de97e77d (1) | - |
| `web/scripts/run-forge-local.ts` | M | +3/-1 | 0ff219d25 (3) | - |
| `web/tests/api/forge-scoreboard.test.ts` | A | +83/-0 | 8cfaba0fc (83) | - |
