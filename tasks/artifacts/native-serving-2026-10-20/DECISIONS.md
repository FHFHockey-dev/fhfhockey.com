# Native serving: open decisions and the S-1 release plan (2026-10-20)

**Memo only.** No code, env, database, Vercel or production state was changed or read. It updates `tasks/artifacts/forge-native-serving-plan-2026-10-19/PLAN.md` (written at R4) for what shipped in R5–R8 and for the v2 producer now committed on `octoberBranch`.

**Trees read:**
- `origin/master` = `c2ed28384` (R8, the local ref; no fetch).
- `octoberBranch` HEAD = `e24b43712`.

## 1. What changed since the plan

| Plan said (at R4) | Now | Effect on the decisions |
|---|---|---|
| S-0 (A-08 `modeledHeadTotals.ts`) pending | **Shipped in R5.** Master's copy equals HEAD's | Drop S-0 from the release plan |
| C-5: "production RSO serves no forecasts" | **Stale.** R6c–R6f ship the interim FORGE daily bridge to RSO (`forgeDailyBridge.ts`, same on master and HEAD) | RSO now has something to lose. On HEAD the bridge is served **only while the source is not native, and never under `empty`** (`planning.test.ts`, "serves interim FORGE daily projections … never once native serving is selected"). This feeds D-6 |
| The producer is v1, with v2 later | v2 01–07 is committed on `octoberBranch` (`0e3261558`) with the target-only scope, the 06 gates and the 07 skater/goalie split. The offline replay passes (`forge-v2-prerollout-gates-2026-10-19/REPLAY-RUNBOOK-2026-10-20.md`) | TJ chose **v2 to first issuance**, targeting the first rolling issuance around 10-27. The v1 standing approval covers cutoffs only until **2026-10-27 04:00Z** |
| S-1 still to write | **Built and committed on `octoberBranch`, not released.** `forecastServingSource.ts` is absent on master | §3 below |
| G1 not yet defined | `release-r7-2026-10-20/G1-CONTRACT-MANIFEST.md`. Its guard blocks `selectForecastServingSource` in `start-chart.ts` and `startChartFromGameExpectations` in `startChartContract.ts` | Start Chart native serving waits for the writer stamps (§3) |
| F1 (reject fenced local runs) open | **Shipped in R8** (off-release run fence) | None for serving |

**Already decided:**
- **D-1:** serve-and-flag unlabelled legacy runs.
- **D-2:** an unusable head gives `empty`.

## 2. Open decisions, as plain questions

### D-3, activation: should native serving be switched on, and when?

- **Recommended: yes, but only after all four of these hold:**
  1. S-1 is live on master and inert (head env unset).
  2. B2 schedule witnesses are fresh (D-5).
  3. Two consecutive clean v2 issuances on the same head ID (revision n, then n+1). Each is read back locally within the ≤5-request budget.
  4. It is not the day the producer changes.
- **What it costs:** set two production env vars (`PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID`, and `FORGE_NATIVE_SERVING_FALLBACK` left unset or `empty`), plus one authorised redeploy.
- **Timing:** if the first rolling v2 issuance lands on 10-27 and 10-28 is clean, the earliest activation is **about 10-29** (an estimate).
- **Alternative: activate on v1 issuances before 10-27.** Not recommended. v1 stops accepting cutoffs at 10-27 04:00Z, so the producer would change under a live head within days.

### D-4, head ID: use one fixed head ID, set once?

- **Recommended: yes.**
  - The first live v2 publish creates the head with a new UUID at revision 0. Record that ID with the run's receipts.
  - Every later run passes the same `--head-id`, with `--expected-revision` and `--expected-hash` set to the current head (`forge-daily.ts review`). The compare-and-swap advances it.
  - The env is set once, at activation. There is no daily env edit and no daily redeploy.
- **With the 07 split:**
  - Each day has two materializations (skater and goalie) but still **one** plan, one slot journal and one CAS on that head.
  - The publish command now needs `--proof` and `--goalie-proof`.
- **Alternative: a new head per day.** Rejected: it means a production redeploy every day.

### D-5, B2: approve the bounded schedule refresh cron, and ship its writers with S-1?

- **Recommended: yes, both.**
  - Without fresh witnesses (≤36 h), native totals read `incomplete_refresh` and RSO `projectedValue` is null.
  - The writers are `web/lib/rosterScheduleData/source.ts` (+12 −1 vs master) and `web/pages/api/v1/db/update-roster-optimizer-schedule.ts` (+41 −4). The branch also has a new `pages/api/v1/db/cron/update-roster-optimizer-schedule-daily.ts`, which is absent on master.
  - The branch `vercel.json` schedules it at `52 8,14 * * *`.
  - This is an Operational change (G1 §4 step 5). Approve the schedule separately from the code release.
- **Before approving:**
  - Check that no full-mode job strips the witnesses. This is unverified, carried from the plan.
  - Confirm that the two daily runs are inside the approved request bound (the plan's B2 proposal: 2 POSTs and 14 NHL GETs per window).
- **Alternative: no cron.** Then manual refreshes are needed before every served day.

### D-6, expiry window: accept a nightly blank, or change when forecasts expire?

**Fact:** a daily catalog expires at the league's first puck drop minus 1 ms (`dailyExpiresAt`), capped at 12 h. From then until the next morning's CAS, the head is expired. Under D-2, every surface is `empty`:
- late games lose their native forecasts;
- RSO loses native forecasts, and, new since R6c, the interim bridge projections it shows today.

| Option | What it means |
|---|---|
| **(a) Accept, with the banner** | No code change. Evenings are blank on every surface |
| **(b) Per-game expiry** (each target expires at its own puck drop) | A method change in `nativeDailyPipeline.ts` (`dailyExpiresAt`) and in the catalog selection (earliest release expiry), with its own review. It fixes the root cause |
| **(c) RSO keeps the interim bridge while native is `empty` because it expired** | A small serving change in `planning.ts`, limited to the `native_catalog_expired` reason. It breaks "one source" for half a day, and the bridge is honestly labelled as interim |

- **Recommended:** **(a) at activation and (b) as the next method change.**
- Choose **(c)** only if a nightly blank RSO is unacceptable before (b) lands. That is TJ's call, because it partly reopens D-2.

### D-7, dashboard scope: which surfaces switch to native at activation?

- **Recommended:**
  - **RSO** (`/data`, planning) and **FORGE next-N** (`forge/forecasts`) switch at activation.
  - **Start Chart page, API and the six dashboard callers** switch only once G1 allows (§3, wave 2).
  - **Top Adds** (`forge/players`), **Goalie Risk** (`forge/goalies`), **GameGrid team forecasts** (`projections/teams`) and the **player page** stay on legacy, under the D-1 flag. They have no native route of the same shape.
  - Moving them is a later slice.
- **Why Start Chart waits:** its native board (`startChartFromGameExpectations`, the `selectForecastServingSource` hunk in `start-chart.ts`) is on G1's never-to-master list.
- **Alternative: switch everything together.** That would hold RSO back until the writer stamps and a qualified issuance (G1 §4 steps 2–4).

## 3. S-1 release plan: ship dark, activate only through the head env

**Principle:**
- S-1 ships with `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` unset. `selectForecastServingSource` then returns `legacy` with **no lookups**, and every reader behaves exactly as today (`forecastServingSource.test.ts`; `nativeCatalogHead.test.ts` "keeps head selection default-off without a lookup").
- **Activation is only the env change plus one redeploy (D-3).** There is no flag in code.

**How each release is built:** as every release since R2, a curated hunk-wise port onto `origin/master` (temp `GIT_INDEX_FILE` + `commit-tree`, gated in a `git archive` export), with the G1 guard run on the candidate. Never a merge or a whole octoberBranch reader file.

### Wave 1: master-safe under G1 (no FORGE writer-stamp dependency)

None of these imports `consumerRevisionAdmission`, `calibrationEligibility`, `issuedContext`, `startChartContract`, `nativeGoalAccounting` or `apiHelpers` (checked by import grep on HEAD).

| File | Master today | Port |
|---|---|---|
| `web/lib/player-forecasts/forecastServingSource.ts` (+ test) | absent | New file. Needs only `nativeCatalogHead`, `sourceSnapshot`, `planningInputs.withinDeadline` (on master) and `evidenceTime` (same) |
| `web/lib/player-forecasts/nativeCatalogHead.ts` (+ test) | absent | New file |
| `web/lib/player-forecasts/sourceSnapshot.ts` | differs | **Hunks only.** Master lacks `SOURCE_OBSERVATION_COLUMNS`, `validPlannedObservationId`, `verifyPlannedObservation` and the `PlannedSourceObservation` type, which the head code needs |
| `nativeContributionAdmission.ts`, `modeledSkaterParticipationStore.ts`, `modeledGoalieParticipationStore.ts`, `gameExpectations.ts`, `gameExpectationView.ts`, `gameExpectationReader.ts` | absent | New files: the native catalog readers. They read native bundles, which the native pipeline labels itself, not FORGE runs |
| `web/lib/rosterScheduleData/planning.ts` | differs | **Hunks only:**<br>• the `{ source }` option;<br>• the native loaders reading `source.environment`;<br>• the fallback limitation;<br>• the 02 rolling-catalog hunks.<br>**Keep master's revision admission.** HEAD's planning imports HEAD's `consumerRevisionAdmission`, whose label gate (`:88–90`) is never-to-master. Keep the bridge rule as decided in D-6 |
| `web/pages/api/v1/roster-schedule-optimizer/data.ts` | differs | Hunks: one selection per request, and `forecastSource` beside `data` (`planningDataTransport.ts` unchanged, so old clients still decode) |
| `web/pages/api/v1/forge/forecasts.ts` (+ test) | absent | New route. Optional in wave 1 (D-7) |
| `supabase/migrations/20261017183611_native_forecast_catalog_heads.sql` | not on master | Records DDL already applied on hosted (decision U3). Ship it with wave 1 or decide separately; it changes nothing on hosted |
| B2 writers and the daily cron route | differ / absent | With wave 1 if D-5 = yes. The `vercel.json` cron line is the separate Operational step |

**Tests for wave 1:**
- `forecastServingSource.test.ts` and `nativeCatalogHead.test.ts`;
- `rosterScheduleData/planning.test.ts`, `forgeDailyBridge.test.ts`, the RSO `/data` route test (`__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts`) and `gameExpectations.test.ts`;
- the A-1 "inert before activation" check against master's fixtures.

### Wave 2: must wait for the writer stamps (G1 §4 step 4)

These are on G1's never-to-master list (§2b/§2c). Start Chart native serving ships with them, after:
- the writer stamps (step 2);
- a qualified hosted issuance with immutable readback (step 3).

The wave:
- `web/pages/api/v1/start-chart.ts`:
  - the `selectForecastServingSource` native-source hunk;
  - the cache-expiry hunk;
  - the related lines.
- `web/lib/projections/startChartContract.ts`: the +272 lines (`startChartFromGameExpectations`, `scoreStartChartPayload`).
- `web/pages/start-chart.tsx`: the `date`-only request. Master's page already sends no `forecast_source`, so C-3 does not arise on master until wave 2.
- The A-09 label gates in `consumerRevisionAdmission.ts`, `calibrationEligibility.ts`, `issuedContext.ts` (ISO hash), `apiHelpers.ts`, `forge/{goalies,players}.ts` and `projections/{goalies,players,teams}.ts`, plus `nativeGoalAccounting.ts`.

### Order

| # | Step | Approval |
|---|---|---|
| 1 | Wave 1 to master, inert (head env unset) | Release go + one production build |
| 2 | B2 cron line | Operational |
| 3 | First live v2 issuances (10-27 on), each with bounded local readback | Per run / standing |
| 4 | Activation for RSO (+ FORGE next-N): two env vars and one redeploy, after two clean issuances on one head | D-3 + env change + deploy |
| 5 | G1 steps 2–3: writer stamps, then a qualified hosted issuance and readback | Native-owner review; release |
| 6 | Wave 2 to master: Start Chart and dashboard go native, the guard is retired or re-baselined | Release |

## 4. Unverified (check before relying on them)

1. Whether a hosted full-mode schedule job strips B2 witnesses.
2. The production values of `START_CHART_GAME_REVISIONS`, the `ROSTER_OBSERVATION_*` and legacy participation pins, and the canary and horizon envs.
3. That a Vercel env change needs a redeploy to take effect (general behaviour; confirm against the project).
4. How large the wave 1 `planning.ts` hunk port is against master's R6c contracts. It was not attempted here.
5. Whether `STARTER_BOARD_COMPUTE_ENABLED` is on in production (handoff §3B). It interacts with resume, not with native serving.
