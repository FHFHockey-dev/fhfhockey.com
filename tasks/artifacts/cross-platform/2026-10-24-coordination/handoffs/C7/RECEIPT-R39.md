# C7 ticket 39: review of `9eb4f0d36` (PROV-GUARD), `97315cff3` (discovery), `3795abb43` (Yahoo diet)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commits** (`git archive` snapshots at `/private/tmp/c7-r39`), not the working tree.
- Tests ran under the outbound network-deny preload with `TZ=UTC`.
- **Help used:** one read-only research subagent traced `3795abb43` (it ran nothing and edited nothing). I re-checked its key claims myself: the lease loop, the cache keys and the migration grants.
- Evidence is in `r39-evidence/`.

| Commit | Verdict |
| --- | --- |
| `9eb4f0d36` PROV-GUARD (audit F1/F2) | **Accept with limits.** The audited paths are guarded correctly. **G1 (medium):** team and goalie FORGE readers, and game predictions, remain unguarded. G2 (low): substitution of an older run isn't labelled. |
| `97315cff3` discovery (audit F3) | **Accept** (D-a info) |
| `3795abb43` Yahoo diet (`RSO_YAHOO_DIET`, flag off) | **Accept for flag-off.** **Y1 (medium, flag-on only):** tabs that don't hold the lease busy-loop. Fix it before turning the flag on. |

## Tests

| Run | Result |
| --- | --- |
| **Commit `3795abb43`**: all 14 suites of the three commits | **709/710.** The remaining case is skipped ("offline supplied packet…", start-chart, an `it.skip` already in the file). |
| **PROV-GUARD parent mirror** (`5356dc616` source, with `9eb4f0d36` tests and fixture) | **353/390.** The new and changed provenance tests fail in all 8 suites: apiHelpers 4, bridge 5, planning 1, start-chart 9, ledger 2, forge/players 4, explicitRunAdmission 8, projections/players 3. `externalInputProof.test.ts` can't load (no module). |
| **Discovery parent mirror** | **7/9.** The structural no-reference test and "builds a snapshot without touching projection tables…" fail. |
| **Yahoo-diet parent mirror** | **243/245**, plus 2 suites that can't load (`planningCache` is missing). The failures: "lets a manager override replace an inferred timing…" and "with the Yahoo diet flag, leaves timed upkeep to the tab holding the lease…". |
| **Flag-off regression** (commit, `RSO_YAHOO_DIET` unset): the 16 existing Yahoo suites plus `dailyAcceptance.yahoo` | **247/253** in run 1, then **13/13** for `writerPermissions` once `supabase/` was in my snapshot. Run 1's 6 failures were mine: that test reads migration files, which my `web`-only archive didn't include. |

## 9eb4f0d36 PROV-GUARD

**Is the proof bound to the captured snapshot that admission trusts?** Yes.
- `externalInputProof.ts` reads only `player_forecast_source_observations` rows with `provider = forge` and `dataset_key = forge-run-inputs-v1`. These are written only by `saveForgeInputSnapshot` on the live path (`run-forge-projections.ts:584`); reconstructions are never saved.
- It requires:
  - `payload.runId === entity_key`;
  - `version forge-inputs-v1`;
  - `inputProvenance.external_fantasy_input_contract === FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT`;
  - a valid `forge-captured-reads-v1` receipt no later than `available_at`.
- **Every** snapshot of the run must prove the exclusion.
- `publish_forge_game_revisions` copies `snapshot->'inputProvenance'` verbatim into revisions, so this is the same claim and receipt that `consumerRevisionAdmission.ts:88` checks.
- `forge_runs.metrics` is never consulted, so a label in run metrics or a serialized label can't pass.
- A failed proof read **throws**, and every caller turns that into unavailable (tested: "fails closed when the proof cannot be read" in the bridge, start-chart and the ledger).

**Do the audited consumers refuse unproven runs, never as 0?** Yes.

| Consumer | Unproven | Clean, proven |
| --- | --- | --- |
| RSO bridge | The run is withheld before any row read. Its players get **no forecast**; with no proven run, planning is schedule-only and says why. | Served |
| Served-forecast ledger | Re-checked at the write boundary; no row is written; a limitation is added. | Written |
| Start Chart (legacy branch) | Nothing is scored; "Unavailable: provenance unproven…". The proof, not run metrics, feeds eligibility. | Served as verified |
| `apiHelpers.requireLatestExternalInputProvenRunId` | 404 with `reason: external_input_provenance_unproven` | The latest proven run |
| `/forge/players` latest and fallbacks | Skipped; 404 when none is proven | Served |
| `/projections/players` default and explicit | 404 (default) / **422** (explicit) | Served |

| # | Severity | Finding |
| --- | --- | --- |
| **G1** | **Medium** (scope gap beyond F1/F2) | **Some FORGE consumers still serve runs without the proof.**<ul><li>`/api/v1/projections/teams` and `/api/v1/projections/goalies`: default latest via `requireLatestSucceededRunId`. Their explicit-run check still reads `forge_runs.metrics`, which never carries the claim, so explicit runs always get 422.</li><li>`/api/v1/forge/goalies`: latest plus fallback queries. This feeds the command-center goalie card and `dashboard/dataFetchers`.</li><li>`lib/game-predictions/featureBuilder.ts:2912`, which reads `forge_team_projections` as model features.</li></ul>**Team** rows are accumulated from the skater lines **after** the season-prior blend (`skater-stage.ts` `teamTotals` follow `seasonLine`), so pre-`7007a0527` team projections carry the same pundit-prior influence as the skater rows. Goalie rows are lower risk (the goalie stage always called `loadSeasonBootstrap(..., false)`), but they aren't proven either. **`/trends`:** I found no direct FORGE table read; its FORGE player data comes through `/forge/players` (guarded). Recommend the same `loadExternalInputProof` gate for teams and goalies (latest, fallback and explicit) and for the game-prediction feature read, or a written TJ decision that they're out of scope. |
| **G2** | Low | **Substituting an older proven run isn't labelled.** On a date where the newest succeeded run is unproven and an older one is proven, `/forge/players`, `/projections/players` and the Start Chart legacy branch silently serve the **older** run. Start Chart computes `withheldUnprovenRuns` but only surfaces it when nothing is served. The bridge's limitation gives a generic withheld count. The served `run_id` shows which run it was, so it's not wrong, but it's undisclosed. In practice this is rare after `7007a0527`: a newer run is unproven only if it read an unaudited source. |
| **G3** | Info | The candidate window is the newest 20 succeeded runs per date (apiHelpers and Start Chart). If 20 or more newer runs are unproven, an older proven run isn't found (fail closed). |

## 97315cff3 discovery (audit F3)

- **No `PROJECTIONS_*` reads remain.** `loadProjectionHealth` (the 9 `exactCount` reads), the `PROJECTION_SOURCES_CONFIG` import and `sourceSeasonFromProjectionTable` are removed. A structural test covers all of `lib/draft-ranker`, and `git grep` finds no config or table reference there.
- **Readers of the dropped health rows don't break.** `discoveryReadServer.emptyMessage` and `DraftDiscovery.sourceLabel` only test `some(...startsWith("projection:"))` or label a key, so their absence is tolerated. Older persisted snapshots keep their rows. `source_summary` gains `projectionSources: "not_used"`; it's jsonb, and tsc is clean per the orchestrator.
- **D-a (info):** new snapshots no longer trigger the empty-state copy "New 2026–27 projection sources have not landed yet…". Users with no signals now see the generic "No player currently clears the explainable discovery thresholds", which no longer says projection signals are intentionally off.

## 3795abb43 Yahoo diet

| Question | Evidence | Result |
| --- | --- | --- |
| **Is flag-off behaviour identical to the parent?** | The flag is server env only, exactly `"1"`, read on each call (`yahooIdentity.ts:8`). The client learns it only from `body.yahooDiet === true` (`RosterScheduleOptimizer.tsx:508`). With the flag off: cache reads return null and writes are gated (`reuse = diet && refresh !== "manual"`, `rosterPlanning.ts:303`); the legacy identity map runs through `legacyYahooIdentities`; `acquisitionTiming` stays `"unknown"`; the inferred-timing note, diagnostics and `yahooDiet` field are all flag-only; the limitations order is unchanged. Non-gated but inert: the request body always carries `refresh: "auto"\|"manual"` (ignored server-side when off), lease releases are no-ops without a claim, and the upkeep effect also re-runs on `leagueId` (`refresh(true)` respects `nextAutoAt`). `providerRules` only acts on an inferred-timing evidence entry that only a flag-on server emits. **Measured:** the existing Yahoo suites and the Yahoo acceptance packet pass at the commit with the flag unset. | Holds (functionally; the request body has one extra field) |
| **Can the identity resolver mis-map?** | It matches on ids only. A pair is kept only when the key maps to one id and that id to one key (`yahooIdentity.ts:22-33`), mirroring the legacy two-way check. It's scoped by provider, game/season context key, `season_id` and `verified`; a read error or more than 1000 rows gives null, and callers throw. starterBoard also drops merged or unverified identities and non-unique NHL ids. There's no legacy fallback when the flag is on. | Holds. Rollout risk: sparse verified identities would mean **unresolved** players, not mis-mapped ones; compare with `compareYahooIdentityMaps` before turning the flag on. |
| **Can the caches serve another principal's or league's data?** | They are module-level Maps per instance. **Every key starts with the authenticated `userId`** (I checked every `cacheKey(` call site), then the league or team key and the date or resource. Manual Refresh bypasses the reads. | No cross-principal reads. **Y2 (low):** keys omit `connectedAccountId`, so after reconnecting a **different** Yahoo account, settings (6 h) and facts (30 min) can come from the old account; rosters are re-validated against `is_owned_by_current_login`. The bound is 500 entries per store, not by bytes, and scan entries can be large. Start Chart shares the roster cache and has no manual bypass. |
| **Is the cross-tab lease safe?** | localStorage key `fhfh:rso:upkeep:v1:<userId>:<leagueId>`, 6-minute TTL, renewed per timed refresh, released on hide, offline or unmount. Explicit Refresh is never gated. **Y1 (medium, flag-on only, confirmed by code):** in a **visible tab that isn't the holder**, `refresh()` passes the `nextAutoAt` check, fails the claim and calls `scheduleNext()` (`RosterScheduleOptimizer.tsx:584`). The delay is `max(0, nextAutoAt − now)`, which is **0**, so the tab re-enters `refresh` on a ~4 ms timer **for as long as the holder renews**: a CPU and localStorage spin, though no network. The test's fake timers hide it. Its own view never auto-refreshes; the lease is per league, so a second tab on another team or horizon stays stale until a manual Refresh. **Fix:** on a failed claim, set `nextAutoAt = now + interval` (or the lease's remaining time) before `scheduleNext()`. Also: the read-write-read claim isn't atomic, so two tabs can both win (low; at worst both upkeep), and an error response without `yahooDiet` turns off gating until the next success (low). | **Finding (Y1)** |
| **Is D6's inferred timing overridable?** | It's gated on `diet && fresh` (`rosterPlanning.ts:488`). It's labelled three ways: a limitation, an evidence source "Inferred from Yahoo weekly deadline", and the unreported-rules wording. `capabilities.rules` stays false. A manager override wins (`providerRules.ts:43-45` passes `null` as the provider value). **Y4 (low):** an override with the **same** value drops the inferred label without adding a manager label, leaving the timing unlabelled. | Holds |
| **Migration (not applied)** | `20261026200000_rso_yahoo_past_lineups.sql`: RLS enabled, no policies; `revoke all` from public, anon, authenticated and service_role, then select, insert, update and delete to **service_role only**; the purge function is `security invoker`, `search_path = public`, execute for service_role only. Code reads and writes it only with the flag on, via the service-role client; a missing table falls back to Yahoo. **Y5 (process):** the file sits in the active `supabase/migrations` tree, so any routine `db push` applies it despite "NOT applied". | Holds (Y5 note) |

**Other (info, from the research pass; not separately verified):**
- `yahooReads` counts only calls made through `counted`. It excludes the client's internal 401 retry, token refreshes, confirmations and Start Chart reads, so treat the D7 count as approximate.
- The confirmations roster is cached before its validity checks; consumers re-validate.
- D5's goalie skip can rely on a roster read up to 15 minutes old. The marks stay unknown, not wrong.
