# C7 ticket 35: review of `7007a0527` (FORGE: no draft-dashboard fantasy tables) and `e168c841c` (RSO test clock pins)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commits** (`git archive` snapshots at `/private/tmp/c7-r35`), not the working tree, because RSO-PRIVACY-2 is editing it.
- Tests ran under the outbound network-deny preload.
- Evidence is in `r35-evidence/`.

| Commit | Verdict |
| --- | --- |
| `7007a0527` FORGE stops reading the fantasy projection tables | **Accept**, with one decision for TJ (D-1) and notes F1–F3 |
| `e168c841c` RSO test clock pins and race fixes | **Accept.** No assertion was weakened; one became a retry-until-settled check (T1). |

## Tests

| Run | Result |
| --- | --- |
| **Commit `7007a0527`** (TZ=UTC): `nativeInputEligibility`, `run-forge-projections.external-inputs`, `.local-attempt`, `startChartPipeline`, `nativeGoalAccounting`, `runProjectionV2` | **290/290** |
| **Parent mirror** (`e168c841c` source, with the commit's tests) | **270/290.** 20 fail: all 13 claim and allowlist tests, the 4 structural and no-fantasy prior tests, the local-attempt claim test, and the 2 start-chart prior tests ("never blending a fantasy projection", "history-only performance prior"). |
| **My controls** (`r35Forge.test.ts`) | **9/9.** Run 1 was 7/9 because of my own exact-equality expectations on floating-point values (a reviewer error, kept as `c7-run1.*`). |
| **Import-closure probe** (`r35-closure.cjs`) | 67 files reachable from the runner. No path aliases the committed scanner doesn't follow, and no `import()` or `require()`. |
| **`e168c841c`**: `RosterScheduleOptimizer.test.tsx` at TZ=America/New_York | **209/209.** The original Monday-local-time failure isn't reproduced here; the test pins the clock now, so it doesn't depend on today's date. |

## 7007a0527

### (1) Is there any remaining path to PROJECTIONS_* or PROJECTION_SOURCES_CONFIG?

**No.** I found no remaining path from the FORGE runner, `lib/projections`, or the FORGE routes.
- **Removed:** `loadSeasonBootstrap` lost both imports (`PROJECTION_SOURCES_CONFIG`, `FANTASY_PROJECTION_SEASON_ID`), the `allowCurrentFantasy` parameter and the `db.from(source.tableName)` read. `fantasySourcePerGame` is gone and had no callers outside `lib/projections`.
- **Text search** of `lib/projections` (non-test) and `pages/api/v1/db`:
  - no `PROJECTION_SOURCES_CONFIG` or `projectionSourcesConfig` (the only users are `draftDashboard/*`, `draft-ranker/discoveryServer`, `pages/projections`, and `player-forecasts/baselinePolicy`; see F3);
  - no `PROJECTIONS_` table literal;
  - the remaining `projectionsConfig` imports are `fantasyPointsConfig` (scoring weights, no tables).
- **Dynamic table names:** the committed scanner follows value imports from `run-forge-projections.ts` and lists every `.from` and `.rpc` site that isn't a plain string. They must equal exactly 5 audited sites, which I checked by hand:
  - `dailyBoardEvidence` (`read("<literal>")`, also checked);
  - `run-lifecycle-queries` (the 3 `forge_*_projections` write tables);
  - `skater-queries` (2 constants);
  - `seasonBootstrap` (`skatersGameStats` or `goaliesGameStats`).
- **Scanner blind spots:** my closure probe shows the scanner's import rule (only `lib/…` and relative paths) misses nothing here: no `utils/`, `components/` or other alias imports, and no `import()` or `require()` in the 67 files.
- **The other structural test** covers all of `lib/projections` for the config identifiers, the table names, and `draftDashboard/` and `fantasy-projections/contracts` imports.
- `starterBoardQueue` imports `fantasy-projections/seasonJobs`, but that's not reachable from the runner, as the scanner's exact dynamic-site list shows.

### (2) Is the claim derivation sound, and can it ever claim falsely?

**It's sound, and it fails closed.**
- `readsExcludeExternalFantasy` returns true only when:
  - there is at least one read;
  - **every** captured read's first operation is `from` or `rpc`;
  - its name isn't `/^projections_/i`;
  - its name is in the 46-entry `FORGE_AUDITED_INPUT_SOURCES`.
- A read that was attempted but failed still counts against the claim.
- **My edge controls all withhold the claim:**
  - a `schema()`-qualified read;
  - `public.PROJECTIONS_…` (blocked by the allowlist, even though the regex doesn't match it);
  - a lower-case fantasy name;
  - an empty request;
  - a non-string name.
- **Only the live snapshot claims** (`run-forge-projections.ts:565`). The reconstruction (`:607`) and run-start metrics (`:663`) call `buildForgeInputProvenance()` with no claim, which the AST test pins (1 claiming call, 2 empty).
- **Residual:** the runtime check sees only reads through the captured client. A read through another client (the closure includes `lib/supabase/public-client.ts`) wouldn't show up in `capture.reads`. Today that's covered **statically**, because the closure scanner fails on any fantasy literal or unaudited dynamic site regardless of client. If a non-captured client ever read an unaudited source, only the static test would catch it.

| # | Severity | Note |
| --- | --- | --- |
| **D-1** | **Decision for TJ** (not a defect) | **This is the first release in which live FORGE revisions carry the exclusion claim.** At the parent, the live snapshot called `buildForgeInputProvenance()` with no argument, so **no** revision had `external_fantasy_input_contract`, and `admitConsumerGameRevisions` (`consumerRevisionAdmission.ts:88`) excluded every one as `use_not_approved`. From this commit on, revisions published by audited runs pass that gate. They then become admissible wherever the other gates pass:<ul><li>**Start Chart** (`pages/api/v1/start-chart.ts:942-980`), behind `starterBoardFlags().serving` and the canary, with `allowedUses` of assignment, totals and comparison all true;</li><li>**RSO** (`rosterScheduleData/planning.ts`), where uses are still denied by the empty `RSO_USE_POLICY` reviews.</li></ul>That is presumably the intended result of removing the fantasy prior. Since it turns on consumer use of FORGE forecasts in production when released, the release note should say so and confirm the serving and canary flags are set as intended. |

### (3) Early-season skater heads without the prior

- **No silent zero.** With no fantasy share, `blendSeasonBootstrap` weights organic by `progress` and history by `(1 − progress) × 0.4`.
  - At **0 current-season games**, organic has weight 0, so a skater **with** previous-season history gets 100% of his history line (control: GOALS, ASSISTS and SOG equal history).
  - By 10 games organic dominates (0.5 against 0.2).
  - Where a key has no usable part, `stats[key] = organic[key] ?? null`.
- **A skater with no previous-season NHL history** (a rookie or call-up at 0 GP):
  - He is **no longer bootstrap-eligible** (`skater-stage.ts:1561` now requires `historyGames > 0`; before, a fantasy row also qualified).
  - With no EV or PP rolling metrics and no emergency inclusion, he is **skipped** (`:2094-2097`, `noMetricsPlayersSkipped`). He gets **no FORGE row**, which consumers treat as unknown or missing, **not 0**.
  - If he is included through the existing emergency path, he is modelled from the default TOI and organic rates, and `bootstrapSkaterLine` with an empty prior returns the organic heads unchanged and finite (control).
  - From his first game, rolling metrics exist and the organic path applies.
- **Effect:** this is a coverage reduction for rookies at season open (before, a fantasy row made them eligible), not a correctness defect. The commit notes the early-season SOG retrospective is still owed.
- **F1 (info):** `seasonBootstrap.ts` comment says the dropped share is "not reassigned", but at 0 GP the history prior carries **100%** of the line, because the 0.4 is renormalised over the only available part. Under the old policy history carried 40% when a fantasy row existed, or 100% when none did. The behaviour is fine; the wording could mislead.

### (4) Is the draft dashboard's own use untouched?

**Yes.** The commit touches only `lib/projections/*`. `projectionSourcesConfig.ts`, `draftDashboard/*`, `draft-ranker/discoveryServer.ts` and `pages/projections/index.tsx` are unchanged.

| # | Severity | Note |
| --- | --- | --- |
| **F2** | Info | `SeasonBootstrapDisclosure` keeps `sourceIds: []` and `fantasyWeight: 0` for readers of older revisions. `inputProvenance.modelIdentity` is now declared on the type (closing my R33 F3). |
| **F3** | Info (scope) | **`lib/player-forecasts/baselinePolicy.ts` still uses `PROJECTION_SOURCES_CONFIG`.** That is the native or RSO baseline-rate path, not FORGE, so TJ's FORGE-only policy doesn't cover it. Flagging it so it's an explicit choice whether the same policy applies there. |

## e168c841c: RSO test clock pins and race fixes

| Change | Weakened? |
| --- | --- |
| **Component test:** `pinMidweek()` (fakes only `Date`, set to Wednesday 2026-10-14 16:00Z) in the 3 "separates planned adds…" cases and "keeps refreshed provider authority…". The global `afterEach` calls `vi.useRealTimers()`, so the fake clock doesn't leak. | No. The fixtures are the same and the assertions are unchanged. |
| **E2E:** the session mirror init script was added to 2 tests (the same pattern other tests already use). | No (setup only). |
| **E2E sequential streams:** `issuedAt` is pinned before the planning time; planning time moves from 00:00Z to 16:00Z on the same Monday; it waits for the candidate catalog before pasting names. | No (it removes the dependency on real time and a load race). |
| **E2E candidate feedback:** 2 `expect.poll` waits on the persisted availability and step before reading storage. | No (sync); the same assertions follow. |
| **E2E day slider:** the single measurement becomes `expect.poll(measure) ≤ 1` followed by `expect(delta) ≤ 1`. | **T1 (info):** the 1 px threshold is unchanged, but a transient misalignment that settles within the poll window now passes. It asserts the settled state, which is what the comment says is intended. |
