# Native FORGE serving plan: one source for RSO, Start Chart and the dashboard (A-11, A-09, A-08)

**Plan only.** No code, env, database, Vercel or production state was changed or read for this plan. It covers findings A-11, A-09 and A-08 in `tasks/artifacts/sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md` (lines 145-167 and 196-203).

- **Read at:** `octoberBranch` HEAD `b47c512fb` (working tree), and production `origin/master` = `ad93e2887` (R4), read with `git show origin/master:<path>`. No fetch was run, so `origin/master` is the local ref.
- **Line numbers** are for those two trees. "Branch" means the HEAD/working tree; "master" means `ad93e2887`.
- **Evidence labels:** **code** (read in source for this plan), **reported** (an artifact records it; not re-checked), **unverified** (needs a check before anyone relies on it).

## Top decisions for TJ (detail in §6)

1. **D-1, A-09 label policy:** serve-and-flag unlabelled legacy runs in every legacy reader (recommended), or refuse them everywhere.
2. **D-2, fallback when no valid native head exists:** `empty` (recommended) or `legacy_flagged`.
3. **D-3, activation:** yes, gated on R6 being live and inert, a B2 refresh cron, and two clean consecutive daily issuances on one head.
4. **D-4, head-ID process:** one fixed head ID set once in Vercel, advanced daily by CAS. The env does **not** need to change daily (§1.4).
5. **D-5, B2:** ship the schedule-witness writers and approve a ≤24 h bounded refresh cron, or native totals read `incomplete_refresh`.
6. **D-6, expiry window:** today a catalog expires at the league's first puck drop, so every surface loses native forecasts each evening until the next issuance (§2.4).

## Corrections to the premises (each one changes the plan)

| # | Premise | What the code says | Evidence |
|---|---|---|---|
| C-1 | "The head env changes with each daily issuance" | The env holds a **head row ID**. Each issuance advances the same row by compare-and-swap (`advanceNativeCatalogHead`, `nativeCatalogHead.ts:110-139`; called at `nativeBaselineCadence.ts:291-292`). `forge-daily.ts review` takes `--head-id`, `--expected-revision` and `--expected-hash` (`scripts/forge-daily.ts:164-172`). Only the first publish needs a new UUID with revision 0 (`LIVE-RUNBOOK-20261020.md:31`) | code |
| C-2 | "`/data` shows `forecastedOpportunities > 0` with the head set" | `forecastManifest.forecastedOpportunities` is `forecasts.length`, the count of **admitted legacy game revisions** (`rosterScheduleData/planning.ts:167`). Those are read only when `STARTER_BOARD_SERVING_ENABLED` is true (`:110`, `:146-147`), and admission drops unlabelled revisions (`consumerRevisionAdmission.ts:88-89`). Native forecasts are built later, from baselines plus participation, with `revisionId: "unresolved"` (`planningContributions.ts:134-237`). With native-only serving the `/data` field stays 0. The acceptance checks in §5 use resolved counts instead | code |
| C-3 | "Shipping the branch Start Chart page is safe while native is inactive" | The branch page always sends `forecast_source=game_expectations` (`pages/start-chart.tsx:442`). The API then takes the native path unconditionally (`pages/api/v1/start-chart.ts:1151`, `:1179-1189`). With no head and no production pins (PROD-READS E-6), that path has no baselines or participation, so the page shows **no projections**, where production today serves the flagged legacy board. The source must be chosen on the server before the page ships | code; the empty result is inferred from the code, not run |
| C-4 | "After `expiresAt` the readers go empty" (as a one-off acceptance check) | It happens **every day**. `dailyExpiresAt` = min(issue + 12 h, the first future league puck drop − 1 ms) (`nativeDailyPipeline.ts:212-217`). The selection takes the earliest release expiry (`nativeCatalogHead.ts:103-104`). Once it expires, the head is rejected (`:28`) and every pin is cleared (`:91`). The 10-19 run expired at 22:59:59.999Z (LEDGER §13) | code + reported |
| C-5 | "RSO has a legacy fallback" | Master RSO reads baselines only from `PLAYER_FORECAST_BASELINE_RELEASE_IDS` (master `contributionStore.ts:271`, via master `planning.ts:47`), and that env is absent in production (PROD-READS:874). Revisions are off because `STARTER_BOARD_SERVING_ENABLED=false` (BLOCKERS "Pre-release check", confirmed by TJ on 10-18). **Production RSO serves no forecasts today**, and its only possible source is native. "Legacy with a flag" exists only for Start Chart and the dashboard | code + reported |

## 1. Inventory: files and env vars

### 1.1 Already on master (`ad93e2887`), but different from the branch

| Path | Role | Master behaviour |
|---|---|---|
| `web/lib/rosterScheduleData/planning.ts` | RSO and game-expectation loader | No head resolution. Legacy baseline bundle via `loadApprovedContributionBundle` (master `:47`) and revisions behind `starterBoardFlags().serving` (master `:65`, `:82`) |
| `web/lib/player-forecasts/contributionStore.ts` | Baseline bundle loader | Reads `PLAYER_FORECAST_BASELINE_RELEASE_IDS` (master `:271`) |
| `web/pages/api/v1/start-chart.ts` | Start Chart API | Legacy slate only. Provenance flag from the rolling-history contract only (master `:1426-1427`) |
| `web/pages/start-chart.tsx` | Start Chart page | Calls `/api/v1/start-chart?date=` (master `:413`) |
| `web/lib/projections/calibrationEligibility.ts` | Provenance | No exclusion label at all: `buildForgeInputProvenance()` stamps only the rolling-history contract (master `:17-21`) |
| `web/lib/projections/consumerRevisionAdmission.ts`, `gameRevisions.ts`, `startChartContract.ts`, `issuedContext.ts` | Revision admission and contract | Differ from the branch (slice files) |
| `web/lib/player-forecasts/planningContributions.ts`, `resolvedPlanningForecast.ts` | Contribution resolution | Differ from the branch (slice files) |
| `web/lib/projections/starterBoardFlags.ts` | `STARTER_BOARD_*` and `START_CHART_GAME_REVISIONS` switches (`:3-8`) | Same role on both |
| Dashboard callers (identical on master and branch): `pages/FORGE.tsx:230`, `components/forge-dashboard/SlateStripCard.tsx:161`, `TeamPowerCard.tsx:129`, `pages/forge/team/[teamId].tsx:130`, `lib/dashboard/dataFetchers.ts:440`, `lib/dashboard/commandCenterData.ts:272` | All call `/api/v1/start-chart?date=` with **no** `forecast_source` | Legacy path |
| Hosted DB only: table `native_forecast_catalog_heads` and RPC `cas_native_forecast_catalog_head` | Head storage | Applied to hosted on 10-17 (LEDGER §11). 0 rows on 10-19 (LEDGER §13 step 1). The migration file is branch-only (next section) | reported |

### 1.2 Branch-only (absent from master; checked with `git cat-file -e`)

| Path | Role |
|---|---|
| `web/lib/player-forecasts/nativeCatalogHead.ts` | Head resolution (`:73-92`), selection validation (`:26-43`), CAS (`:110-139`) |
| `web/lib/player-forecasts/nativeContributionAdmission.ts` | Native baseline admission. Refuses unlabelled sources (`:83`, `:98`) |
| `web/lib/player-forecasts/modeledSkaterParticipationStore.ts`, `modeledGoalieParticipationStore.ts` | Participation pins (`:50-53`, `:58-63`) |
| `web/lib/player-forecasts/gameExpectations.ts`, `gameExpectationReader.ts` (`:28-31`), `gameExpectationView.ts` | Shared game-expectation view |
| `web/pages/api/v1/forge/forecasts.ts` | FORGE next-N API (`:32`) |
| `web/lib/rosterScheduleData/planningDataTransport.ts` | RSO `/data` transport; must ship together with the RSO page tree (SLICE.md "HTTP contract edges") |
| `web/lib/projections/modeledHeadTotals.ts` | A-08 shared rule (`:7-12`, `:34-58`), added in `b47c512fb` |
| `supabase/migrations/20261017183611_native_forecast_catalog_heads.sql` | Records the applied DDL; recording it on master is the separate decision U3 (RELEASE-PLAN §1.5) |
| The rest of the 70-file runtime slice | `SLICE.md` and `slice.json` `runtimeSlice` |

**Slice drift since it was pinned (code):**
- 124 paths are pinned in `slice.json`, and 2 differ from the working tree: `pages/api/v1/start-chart.ts` and its test, both changed by A-08 (`b47c512fb`).
- That change makes `start-chart.ts` import `lib/projections/modeledHeadTotals.ts` (`:22`), which is **not** in the slice, so it must join.
- Releases R2-R4 changed 66 `web/` paths. Only `utils/adminOnlyMiddleware.ts` overlaps the paths that SLICE.md names.
- The slice base was `457435eb`; it must be re-based on the current master (R4, or R5 once released).

### 1.3 Still to write

| New or changed path | Purpose | §  |
|---|---|---|
| **New** `web/lib/player-forecasts/forecastServingSource.ts` (+ `.test.ts`) | The single server-side source selection | 2 |
| `nativeCatalogHead.ts:90` | Also return the validated selection's `issuedAt`/`expiresAt` (today it returns only the head row), so callers can report and cache by expiry without a second read | 2 |
| `rosterScheduleData/planning.ts:41-47` | Accept a pre-resolved source in `options`, so one request resolves the head once (today `loadGameExpectations` → `loadPlanningData` resolves it internally) | 2 |
| `pages/api/v1/start-chart.ts:1147-1162` | Choose the source with the selector, not `req.query.forecast_source`. Keep the parameter accepted but ignored, for cached pages. Add the source kind and head revision to the cache key | 2 |
| `pages/api/v1/roster-schedule-optimizer/data.ts`, `planningDataTransport.ts` (strict zod schema, `:38`), `pages/api/v1/forge/forecasts.ts` | Return `forecastSource { kind, headRevision, expiresAt, reason }` | 2 |
| `pages/start-chart.tsx:442` | Stop forcing `forecast_source`; read `forecastSource` for its banner | 2 |
| One provenance-policy helper, used by `start-chart.ts` (legacy path, `:1453-1461` / `:1559-1561`), `forge/players.ts:194` and `:253-255`, `forge/goalies.ts:488-490`, `projections/{players,goalies}.ts:71-74`, `projections/teams.ts:62-65`, `lib/projections/apiHelpers.ts:58-62`, `db/run-projection-accuracy.ts:1683-1691` | One A-09 policy (D-1) | 4 |
| Tests: RSO `/data` route (no route test exists under `__tests__/pages/api/v1/roster-schedule-optimizer/`); dashboard parity; label matrix | §5 checks | 4-5 |

### 1.4 Env vars

| Name | Production now | Needed for native serving | Who reads it |
|---|---|---|---|
| `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` | absent (PROD-READS:875) | **Yes.** Set once to the fixed head row ID (D-4) | `nativeCatalogHead.ts:75` |
| `FORGE_NATIVE_SERVING_FALLBACK` (**new**) | — | **Yes.** `empty` or `legacy_flagged` (D-2). A missing or invalid value means `empty` (fails closed) | new selector |
| `PLAYER_FORECAST_BASELINE_RELEASE_IDS` and the 3 `…ROSTER_OBSERVATION_…` pin keys | absent (PROD-READS:874; the other three were not listed in E-6, **unverified**) | **No; leave unset.** A valid head overrides them (`nativeCatalogHead.ts:90`), and an invalid head blanks them (`:12-14`) | `nativeCatalogHead.ts:8-9` |
| 5 legacy participation pin keys (`nativeCatalogHead.ts:10-11`) | not listed in E-6 (**unverified**) | **No; leave unset** | blanked whenever the head is set |
| `STARTER_BOARD_SERVING_ENABLED` | `false` (TJ, 10-18; BLOCKERS) | **Keep `false`.** It gates only legacy game revisions (`planning.ts:110`), and those are unlabelled, so they would be dropped anyway | `starterBoardFlags.ts:8` |
| `START_CHART_GAME_REVISIONS` | not in E-6 (**unverified**) | Leave unset or `false`. It is the fallback value for every `STARTER_BOARD_*` flag (`starterBoardFlags.ts:3-4`) | same |
| `STARTER_BOARD_CANARY_GAME_IDS`, `STARTER_BOARD_CALENDAR_HORIZON_DAYS` | **unverified** | Unchanged | `planning.ts:48`, `:106` |

**A Vercel env change takes effect only on a new deployment** (Vercel behaviour; not verified here). A head ID that changed every day would therefore mean a production redeploy every day. AGENTS.md treats each deployment as a costly action that needs explicit approval, which makes D-4's fixed ID a requirement, not just a preference.

## 2. One server-side source selection

### 2.1 Contract

```ts
// web/lib/player-forecasts/forecastServingSource.ts (new)
type ForecastServingSource =
  | { kind: "legacy"; reason: "native_not_activated" }                      // head env unset: today's behaviour
  | { kind: "native"; headId: string; headRevision: number; issuedAt: string; expiresAt: string;
      environment: Readonly<Record<string, string | undefined>> }           // pins from the head only
  | { kind: "legacy_flagged"; reason: NativeUnavailableReason }             // head set but unusable, fallback = legacy_flagged
  | { kind: "empty"; reason: NativeUnavailableReason };                     // head set but unusable, fallback = empty (default)
type NativeUnavailableReason = "native_catalog_head_unavailable_or_invalid" | "native_catalog_expired";
export async function selectForecastServingSource(db, seasonId, now, env = process.env, signal?): Promise<ForecastServingSource>;
```

**Rules:**
1. Head env unset → `legacy`. Readers behave exactly as they do in production today: inert before activation.
2. Head set, and `resolveNativeCatalogEnvironment` (`nativeCatalogHead.ts:73-92`) returns a selection with `now < expiresAt` → `native`.
3. Head set, but the resolution fails, the head is missing or the selection has expired → `FORGE_NATIVE_SERVING_FALLBACK`.
   - Any value other than `legacy_flagged` gives `empty`.
   - Never silently keep the process env pins. The existing behaviour already guarantees this (`nativeCatalogHead.ts:71-72`, `:91`).
4. One resolution per request, with an 8 s deadline (the same budget as `planning.ts:44`). A deadline miss counts as `head_unavailable`.

### 2.2 Callers (every product goes through §2.1)

| Surface | Entry point | `native` | `legacy` (pre-activation) | `legacy_flagged` | `empty` |
|---|---|---|---|---|---|
| Start Chart page | `start-chart.tsx` → `/api/v1/start-chart` | `loadGameExpectations` → `startChartFromGameExpectations` (today's `:1179-1189`) | `fetchSlate` path (`:1190` on), unchanged | `fetchSlate` path, plus flag `native_unavailable_legacy_fallback` on every row and the D-1 provenance flag | Games with empty `players`, and `serving.reason` = the native reason |
| Start Chart API (all callers) | same handler | same | same | same | same |
| Dashboard: `FORGE.tsx:230`, `SlateStripCard.tsx:161`, `TeamPowerCard.tsx:129`, `forge/team/[teamId].tsx:130`, `dataFetchers.ts:440`, `commandCenterData.ts:272` | same API, no parameter | Same payload as the page, so **no client change**. Their parsers must accept the native board (parity test, §5 A-4) | same | same | same |
| RSO `/data`, planning | `data.ts` → `loadPlanningData(..., { source })` | Pins from `source.environment` | `process.env` pins (production: none) | Blank pins (as `unavailableNativeCatalogEnvironment`). **RSO has no legacy forecasts** (C-5), so this shows `forecastSource.kind=legacy_flagged` and no projections | Blank pins |
| FORGE next-N | `forge/forecasts.ts` → `loadGameExpectations` | as RSO | as RSO | as RSO | as RSO |
| Top Adds `forge/players`, Goalie Risk `forge/goalies`, `projections/*` (GameGrid `useTeamForecasts.ts:79`), `FORGE.tsx:238`, `forge/player/[playerId].tsx:157` | legacy-only routes | **Not covered by §2.1 unless D-7 says so.** Recommended: they keep reading legacy under the D-1 policy and show `forecastSource: legacy` | | | |

**Why on the server:**
- The dashboard callers already omit the parameter, so a server decision gives every Start Chart consumer one source with no client edits.
- A query-string switch (`start-chart.ts:1147-1151`) is exactly what lets the page and the cards disagree today (A-11).

### 2.3 Cache

- `start-chart.ts` keeps a per-instance `responseCache` keyed on the date and on `source:` (`:1154-1162`).
- The key must include `kind` and `headRevision`, and the entry must never outlive `expiresAt`. Otherwise a native payload survives a head change or an expiry.
- The 15 s `s-maxage` (`:1167`) already stops before puck drop on the native path (BLOCKERS N3, reported). Re-check this on the merged handler.

### 2.4 Daily expiry (input to D-6)

- Under C-4, from the league's first puck drop until the next morning's CAS, every surface falls back each day: about 23:00Z to ~12:00Z (the 10-19 run was issued at 12:00:33Z, LEDGER §13).
- With `empty`, late games and RSO lose forecasts every evening.
- With `legacy_flagged`, Start Chart and the dashboard switch to the legacy board every evening, while RSO goes blank. The surfaces then disagree for half of every day.
- Neither is a code bug. It follows from the issuance method (`nativeDailyPipeline.ts:212-217`) and needs D-6.

## 3. Order of steps

| # | When | Step | Depends on | Approval |
|---|---|---|---|---|
| 0 | Now (freeze until 2026-10-20 17:00Z, CHEF-REGISTER:5) | TJ decides D-1 to D-7. Serving code (§1.3) may be written locally only in files that are not frozen. **Which serving files are on the 19-file frozen list is unverified**, so check before editing | — | TJ decisions |
| 1 | After 10-20 17:00Z | Apply the FORGE patch set in the recorded order: v2 01-04, then 01b, then 03b, then 02 (CHEF-REGISTER:137). Run the focused Vitest list, tsc and offline replays, including the publish dry run from patch 02 | freeze lifted | standing (TJ 13:15Z, CHEF-REGISTER:135) |
| 2 | Before 10-27 04:00Z (v1 method window, LEDGER §13) | **Native v1 re-run.** First publish with a new head UUID at revision 0, then the local readback (runbook step 7: 5 GETs with the head env, on the branch). This is the first evidence that native serving works against hosted data | 1 | the dated run needs its own decision (CHEF-REGISTER:137) |
| 3 | In parallel with 1-2 | **A-01:** diagnose and fix the legacy pipeline (no successful `forge_runs` since 09-29; audit:58, E-1 "confirmed"). Required before D-2 = `legacy_flagged` means anything. Not required for D-2 = `empty` | — | separate |
| 4 | In parallel with 1-2 | **R5** (A-07 follow-up, CHEF-REGISTER:208). Recommended to carry `modeledHeadTotals.ts` (A-08), because the serving slice now imports it. R5's exact scope is the Chef's and **unverified here**. Master's `start-chart.ts` differs widely from the branch's (`git diff` says "differs"), so A-08 on master needs a curated port, not the branch file | — | release go |
| 5 | After 2 and 4 | Build R6 locally: slices S-1 to S-3 (§4), re-based on master after R5 | 2 (to confirm the readers against real data), 4 | none (local) |
| 6 | After 5 | **R6 release, inert:** the head env stays unset, so `kind=legacy` everywhere and Start Chart serves today's board (C-3 is fixed by S-1) | 5, D-1 | release go + 1 production build |
| 7 | After 6, before 8 | **B2:** run the bounded schedule refresh at ≤24 h cadence (B2 proposal), with the R6 writer bytes. The witnesses must be fresh (≤36 h) on every served day | 6, D-5 | schedule approval |
| 8 | v2 cut-over (rolling first issuance planned for Oct 27; audit A-14/A-15) | v2 replaces v1 as the daily producer. Native means stay frozen at Oct 16 until v2's fresh means arrive (LEDGER §12). A-13 to A-18 gate the first live v2 runs (audit:187-192) | 1 | per the v2 approvals |
| 9 | After 7 and 8 | **Activation:** after **two consecutive clean daily issuances on the same head ID** (revision n, then n+1), each read back locally: set `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` and `FORGE_NATIVE_SERVING_FALLBACK` in Vercel production, then one authorised redeploy. **Not on the v1→v2 cut-over day.** Earliest is about 10-29 if v2 is clean from 10-27 (estimate) | 6, 7, 8, D-3 | env change + 1 deployment |
| 10 | Daily after 9 | Each issuance advances the head by CAS (no env change). Bounded readback (≤5 read-only GETs). Add an alert when the head revision has not advanced by the next morning (the A-19 missing-run pattern) | 9 | standing cadence approval |

**Why not activate on v1 before 10-27:** the v1 method stops accepting cutoffs at 10-27 04:00Z (LEDGER §13). A v1-only activation would have at most a few days before the producer changes under it, during the riskiest week (A-14 to A-17).

## 4. Release slices

Every slice is built the way earlier releases were: a curated overlay on master with exact blobs, never a merge of octoberBranch (RELEASE-PLAN §1). S-1 to S-3 must land **together** in R6, because the slice's stricter `calibrationEligibility.ts` makes the production accuracy job return 422 every day unless S-2 ships with it (BLOCKERS "B1 side effect (1)").

### S-0 (R5): A-08 shared missing-head rule

| Paths | Tests |
|---|---|
| `web/lib/projections/modeledHeadTotals.ts` (new); A-08 hunks of `pages/api/v1/forge/players.ts` (`:372`), `pages/api/v1/db/run-projection-accuracy.ts` (`:1758`); a curated port into master's `pages/api/v1/start-chart.ts` (`sumProjectionParts`, audit:49) | `web/lib/projections/modeledHeadTotals.test.ts`; `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`; `web/__tests__/pages/api/v1/forge/players.test.ts`; `web/__tests__/pages/api/v1/start-chart.test.ts` |

### S-1 (R6): serving core and source selection

**Paths:**
- `slice.json` `runtimeSlice` (70 paths), re-pinned to current bytes. `start-chart.ts` needs a re-pin anyway.
- `web/lib/projections/modeledHeadTotals.ts`, if it is not already shipped in S-0.
- B2 writers (`slice.json` `scheduleWriters`): `web/lib/rosterScheduleData/source.ts` and `web/pages/api/v1/db/update-roster-optimizer-schedule.ts`.
- New `web/lib/player-forecasts/forecastServingSource.ts`, plus the §1.3 edits to:
  - `nativeCatalogHead.ts`
  - `rosterScheduleData/planning.ts`
  - `pages/api/v1/start-chart.ts`
  - `pages/start-chart.tsx`
  - `pages/api/v1/roster-schedule-optimizer/data.ts`
  - `rosterScheduleData/planningDataTransport.ts`
  - `pages/api/v1/forge/forecasts.ts`
- Optional: `pages/forge/forecasts.tsx` and `styles/ForgeForecasts.module.scss` (RELEASE-PLAN §1.4).

**Tests:**
- `slice.json` `candidateTests` (49), including the B3-repaired `rosterScheduleData/planning.test.ts`, `player-forecasts/gameExpectations.test.ts` and `nativeBaselinePublication.test.ts`.
- `web/lib/player-forecasts/nativeCatalogHead.test.ts`. Its `keeps head selection default-off without a lookup` (`:74`) stays the pre-activation contract.
- `nativeContributionAdmission.test.ts`.
- `web/__tests__/pages/api/v1/start-chart.test.ts` and `web/__tests__/pages/start-chart.test.tsx`.
- `web/__tests__/pages/api/v1/forge/forecasts.test.ts`.
- `web/lib/rosterScheduleData/source.test.ts` and `web/__tests__/pages/api/v1/db/update-roster-optimizer-schedule.test.ts`.
- `web/lib/rosterScheduleOptimizer/planning.test.ts` and `web/lib/in-season/workspaceSchema.test.ts`.
- **New:**
  - `forecastServingSource.test.ts`: the 4 kinds × fallback values, plus an invalid fallback value giving `empty`;
  - a `start-chart` test proving the parameter cannot force native while `kind=legacy` (C-3);
  - a cache-key test (A-8);
  - an RSO `/data` route test.

### S-2 (R6): one A-09 provenance policy

**Paths:**
- `web/lib/projections/calibrationEligibility.ts`, plus the new policy helper (there or alongside).
- The readers: `pages/api/v1/start-chart.ts` (legacy path), `pages/api/v1/forge/players.ts`, `pages/api/v1/forge/goalies.ts`, `pages/api/v1/projections/players.ts`, `goalies.ts` and `teams.ts`, `lib/projections/apiHelpers.ts`, `pages/api/v1/db/run-projection-accuracy.ts`.
- If D-1 = serve-and-flag: the accuracy change from the BLOCKERS proposal. Score unlabelled runs with `externalFantasyInputs: "unverified"`, and keep the 422 only for a missing rolling-history contract.

**Writer:** `run-forge-projections.ts` opts in to the label at `:482`, `:550` and `:600`. It stays `branchOnlyRuntime` (slice.json:2187) **unless** the production stages actually exclude external fantasy inputs. Shipping the opt-in on production stages would label blended runs falsely (BLOCKERS B1). Native admission keeps refusing unlabelled sources in either case (`consumerRevisionAdmission.ts:88-89`; `nativeContributionAdmission.ts:83`, `:98`).

**Tests:**
- New: a 5-reader × {labelled, unlabelled} matrix (audit A-09 "accept when"), covering Start Chart legacy, `forge/players` (both the exact-date path `:253-255` and the fallback scan `:194`), `forge/goalies`, `projections/players`, and accuracy.
- Existing: `web/lib/projections/apiHelpers.test.ts`, `web/__tests__/pages/api/v1/forge/goalies.test.ts`, `web/__tests__/pages/api/v1/projections/{players,goalies}.test.ts`, and the 4 accuracy cases (a)-(d) from the BLOCKERS proposal.

### S-3 (R6): dashboard parity (tests only, expected)

**Paths:** none expected (§2.2). If the parity test fails, the affected parser joins this slice: `SlateStripCard.tsx`, `TeamPowerCard.tsx`, `pages/forge/team/[teamId].tsx`, `pages/FORGE.tsx`, `lib/dashboard/dataFetchers.ts`, `lib/dashboard/commandCenterData.ts`.

**Tests:**
- New: a parity test that feeds one native fixture board into all six consumers and into the page (A-4).
- Existing: `web/__tests__/pages/forge/team/[teamId].test.tsx`, `web/lib/dashboard/commandCenterData.test.ts`.
- No test exists for SlateStripCard or TeamPowerCard (code), so the new parity test covers them.

### Activation (no code)

Two Vercel production env vars and one redeploy (§3 step 9). Before it, inventory the linked Vercel projects (AGENTS.md "Vercel Usage", memory "Push octoberBranch together").

## 5. Acceptance checks

Verdicts must say passed, failed, not run or blocked. A-1 to A-8 are local, with fixtures and injected clocks. A-9 and A-10 use bounded read-only production requests that need approval.

| ID | Check | Pass when |
|---|---|---|
| A-1 | **Inert before activation** (head env unset) | `forecastSource.kind = legacy` on all three products. The Start Chart API (no parameter, and with `forecast_source=game_expectations`) returns today's legacy board for the same fixture as master. RSO returns the same `PlanningData` as master, apart from the transport and the new field |
| A-2 | **Native with the head set** (fixture head plus releases, clock inside `[issuedAt, expiresAt)`) | Every check below passes:<br>- `forge/forecasts` (calendar, issued date) has >0 targets with non-null expected values.<br>- RSO optimizer `forecastedOpportunities` > 0 (`rosterScheduleOptimizer/planning.ts:536-547`).<br>- `/data` has `baselineSources` > 0, and `evidence.baselines.limitations` lacks `native_catalog_head_unavailable_or_invalid` (`planning.ts:168`).<br>- The Start Chart API has `kind = native` and >0 players with projected fantasy points.<br>- **Not** `forecastManifest.forecastedOpportunities`, which stays 0 (C-2). Add a resolved-count field to the manifest if TJ wants one number on `/data` |
| A-3 | **Expiry** (same fixture, clock = `expiresAt` and `expiresAt` + 1 ms) | All three report `kind` = the D-2 fallback with reason `native_catalog_expired`. There are 0 native targets, and the page's own client-side expiry blanking (`start-chart.tsx:447-457`) agrees |
| A-4 | **Parity** (one slate, one head) | The Start Chart page, the Start Chart API, `SlateStripCard`, `TeamPowerCard`, the team page, `FORGE.tsx` slate parse, `dataFetchers` and `commandCenterData` agree. They show the same game IDs, the same player IDs per game, and the same projected points to 1e-9. This extends the Q-01 receipt (`start-chart-parity-receipt.json`: 16 keys, 0 mismatches, reported) to the dashboard |
| A-5 | **A-08 missing head** | A same-row fixture with ES 0.2 and PP null gives unknown in Start Chart legacy, `forge/players` and accuracy, and is excluded from accuracy (audit A-08). On the native board, a null target gives null points and no rank. **Unverified:** whether `scoreStartChartPayload` nulls points when one target is null. `startChartContract.ts:455-459` keeps per-target nulls, but the scoring step was not read |
| A-6 | **A-09 matrix** | 5 readers × labelled/unlabelled behave exactly as D-1 says, including the `forge/players` exact-date path. Native admission still rejects unlabelled sources |
| A-7 | **B2** | A ≤36 h witness → no `incomplete_refresh`. A 37 h witness → `incomplete_refresh` (`planning.ts:156`) and null totals |
| A-8 | **Cache** | A native payload and a fallback payload never share a `responseCache` entry, and no entry outlives `expiresAt` |
| A-9 | **Post-R6 production smoke** (≤5 sequential GETs, approved) | `/api/v1/start-chart?date=D` returns `kind: legacy` and a non-empty board on a game day (given legacy data exists; see A-01). `/start-chart` returns 200 |
| A-10 | **Post-activation production readback** (≤5 GETs per day for the first 3 days, approved) | Before the first puck drop: A-2 holds against production. After it: A-3 holds. The next morning, after the CAS: `headRevision` has gone up by 1 with no deployment |

## 6. Decisions TJ must make

| ID | Decision | Facts | Recommendation |
|---|---|---|---|
| **D-1** | A-09 label policy for **legacy** readers: refuse or serve-and-flag | Facts below the table | **Serve-and-flag everywhere legacy is read.** Use one flag name (`unverified_projection_provenance`), keep `forge/players` on the fallback rather than a 422, and score accuracy as `unverified` (BLOCKERS proposal). Native admission keeps refusing |
| **D-2** | Fallback when the head is set but unusable | RSO has no legacy forecasts (C-5). The legacy pipeline has had no successful run since 09-29 (A-01). The fallback recurs every evening (C-4) | **`empty`**, with an honest banner (`forecastSource.reason`). It is the only choice that keeps the three products on one source. Revisit `legacy_flagged` after A-01 is fixed, and only for Start Chart and the dashboard |
| **D-3** | Activate, and when | Needs R6 live and inert, B2 fresh, and two clean CAS revisions on one head. Avoid the v1→v2 cut-over day | **Yes, gated by §3 step 9.** Earliest is about 10-29 (estimate) |
| **D-4** | Head-env process per daily issuance | The env holds a row ID, and the CAS advances it (C-1). An env change needs a redeploy (§1.4) | **One fixed head ID.** The first publish uses a new UUID at revision 0 and records it in the LEDGER; every later run passes the same ID with expected revision/hash = the current head (`forge-daily.ts:164-172`). The env is set once at activation, so there is no daily env edit or deployment |
| **D-5** | B2 | Without fresh witnesses, every horizon reads `incomplete_refresh`: FORGE totals and RSO `projectedValue` are null (BLOCKERS B2) | **Ship the 2 writers in R6 and approve a daily bounded refresh** (2 POSTs and 14 NHL GETs per window, ≤1,000 sides; B2 proposal). Check for any witness-stripping full-mode job first (B2 proposal "Checks before approving"; **unverified**) |
| **D-6** | Expiry window | The catalog expires at the league's first puck drop (C-4) | Short term: accept, with the banner. Ask FORGE for per-target expiry at each game's puck drop. That is a method change in `nativeDailyPipeline.ts:212-217` and the selection (`nativeCatalogHead.ts:103-104`), and it needs its own review |
| **D-7** | Scope of "dashboard" | Top Adds (`forge/players`), Goalie Risk (`forge/goalies`) and GameGrid team forecasts (`projections/teams`) have no native route of the same shape | **Leave them on legacy for activation**, under the D-1 flag. Move them to `forge/forecasts` later as a separate slice |

**D-1 facts:**
- 0 of 382 succeeded legacy runs carry the label (PROD-READS:364, :770).
- The writer opt-in is branch-only, and its production stages still blend external inputs (BLOCKERS B1).
- So production runs cannot honestly carry the label until the branch pipeline ships.
- "Refuse" would empty or 422 every legacy surface: Start Chart legacy, Top Adds, Goalie Risk, `projections/*` and the daily accuracy run.
- On 10-18 TJ approved serve-and-flag for Start Chart (BLOCKERS B1 side effect (2)).

## Unverified points (check before relying on them)

1. Whether any serving file in §1.3 is on the 19-file frozen list (CHEF-REGISTER:10). The list was not located for this plan.
2. The production values of `START_CHART_GAME_REVISIONS`, the `ROSTER_OBSERVATION_*` and legacy participation pins, and the canary and horizon envs. E-6 listed only 4 names.
3. Whether a hosted pg_cron job calls `update-roster-optimizer-schedule` in full mode, which would strip the witnesses (B2 proposal).
4. Whether the dashboard parsers accept the native-shaped board (A-4 decides), and whether native scoring nulls points on a null target (A-5).
5. R5's final scope, and whether A-01's fix ships the branch `run-forge-projections.ts` (which would bring the label writer). `a01-forge-pipeline-resum` (`local_54d52afa`) is still working.
6. That a Vercel env change needs a redeploy before it takes effect (general Vercel behaviour; confirm against the project).
7. The claim in C-3 that the forced native path is empty in production follows from the code and E-6. It was not executed.
