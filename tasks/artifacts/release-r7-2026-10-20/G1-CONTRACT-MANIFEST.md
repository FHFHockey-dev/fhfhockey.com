# G1 — FORGE writer/consumer contract manifest and candidate guard

- Ticket: G1 (handoff `tasks/handoff-2026-10-20/HANDOFF-2026-10-20.md` Part 3 G1; Part 1 §2 "Contract trap"). Chef: `local_60e96358`.
- Revisions analysed:
  - released master `origin/master` = `b630e0767` (R6f);
  - octoberBranch `HEAD` = `9695a2fe6`, 49 commits ahead (`git log origin/master..HEAD`).
- Line references are `rev:path:line` from `git show`/`git grep` on those revs. They do not cover other sessions' uncommitted working-tree edits (for example `run-forge-projections.ts` and `stages/skater-stage.ts` are modified in the tree right now).
- Read-only analysis. No application edits, production, Vercel or Supabase calls.

---

## 1. Writer/consumer contract

### 1a. What master writers stamp today

| Field | Master writer (b630e0767) | octoberBranch writer (HEAD) |
|---|---|---|
| `metrics.input_provenance` / snapshot `inputProvenance` | `buildForgeInputProvenance()` returns `{ rolling_player_history_contract: "full_selected_scope_through_end_date_v1" }` only (`calibrationEligibility.ts:17–21`). Called at `run-forge-projections.ts:498, 566, 622`. | `buildForgeInputProvenance({ externalFantasyInputsExcluded: true })` adds `external_fantasy_input_contract: "excluded_from_native_inputs_v1"` (`calibrationEligibility.ts:3, 22–29`). Called at `run-forge-projections.ts:500, 568, 624`. |
| External fantasy inputs actually used | **Yes.** `loadSeasonBootstrap(..., allowCurrentFantasy = true)` at `stages/skater-stage.ts:1456, 1588` and `stages/goalie-stage.ts:164–166`. | **No.** The same calls pass `false` (`skater-stage.ts:1461, 1599`; `goalie-stage.ts:166`), enforced by `lib/projections/nativeInputEligibility.test.ts` (that file is absent on master). |
| `forge_runs.git_sha` | `VERCEL_GIT_COMMIT_SHA ?? GIT_SHA ?? null` (`queries/run-lifecycle-queries.ts:226`). Local runners write `local:<sha256>` (`scripts/run-forge-local.ts:98`). | Unchanged. |
| Schedule-revision hash (`issuedContexts[].schedule[].revision`) | `forgeScheduleRevision` hashes the **raw** `start_time` string (`issuedContext.ts:15–20`). Written via `scheduleRevisionForRow` (`issuedContext.ts:29`) and `player-forecasts/scopeReads.ts:151, 168`. | Hashes `new Date(Date.parse(start_time)).toISOString()` (`issuedContext.ts:15–21`). Same writers (`issuedContext.ts:30, 139, 167`; `scopeReads.ts:164, 181`). |

Consequence: **no run written by master carries `external_fantasy_input_contract`.** Master runs also do use external fantasy inputs, so stamping the label on master alone would be a false claim (see the guard's check 2).

### 1b. What octoberBranch readers require (HEAD line numbers)

| Reader | Requirement | Failure mode for an unlabelled run |
|---|---|---|
| `lib/projections/consumerRevisionAdmission.ts:88–90` (`publicPlanningForecasts`, used by `admitConsumerGameRevisions` :210) | `inputProvenance.external_fantasy_input_contract === FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT` | Whole game excluded as `use_not_approved` (one count per game). |
| same, `:71–87` | Stored `schedule[].revision` equals `forgeScheduleRevision(...)` recomputed with the **new ISO** hash | Whole game excluded as `identity_conflict`. This check runs *before* the label check, so for legacy revisions it hides `use_not_approved`. |
| same, `:104–107` (`emit`) | `schedule.revision === currentGame.scheduleRevision` (the current schedule, hashed by the new code) | Player-game excluded as `identity_conflict`. |
| `lib/projections/calibrationEligibility.ts:31–57` (`evaluateForgeCalibrationEligibility`) | Both the rolling-history and exclusion contracts | `reason: "missing_or_legacy_external_fantasy_exclusion_contract"`. Start Chart flags rows `unverified_projection_provenance` (`start-chart.ts:1477–1478, 1583–1584`), and calibration excludes the run. |
| `lib/projections/apiHelpers.ts:42, 58–63` (`requireLatestSucceededRunId`) | Label on the latest succeeded run | **HTTP 422.** Affects `/api/v1/forge/goalies`, `/api/v1/forge/players`, `/api/v1/projections/{goalies,players,teams}` and `/api/v1/db/run-projection-accuracy`. |
| `pages/api/v1/forge/goalies.ts:8, 477, 487–492` | Selected run summary is the resolved run, succeeded and labelled | HTTP 422. |
| `pages/api/v1/forge/players.ts:7, 180, 194` | The fallback run must be labelled | Unlabelled fallback runs are skipped. |
| `pages/api/v1/projections/{goalies,players}.ts:71–72`, `teams.ts:62–63` | Label | 422/withheld. |
| `lib/projections/gameRevisions.ts:94` | Type only: `external_fantasy_input_contract?: string` | None. This is writer-compatible. |
| `lib/projections/startChartContract.ts` (+272 lines: `startChartFromGameExpectations`, `scoreStartChartPayload`) and `start-chart.ts:1150–1212` | Native serving source (`selectForecastServingSource`, `loadGameExpectations`) | With no head env set it selects legacy. It depends on octoberBranch-only modules (`player-forecasts/forecastServingSource.ts`, `gameExpectationReader.ts`). |
| `lib/projections/nativeGoalAccounting.ts:133–138, 177, 194–195, 240–258` | `proj_goals_es/pp` may be null; sums become null when any component is unknown | Frozen native contract change. It types differently from master callers. |

### 1c. Why shipping those readers first makes Start Chart admit no games

In `start-chart.ts` `fetchSlate`, with `STARTER_BOARD_SERVING_ENABLED` resolving to true (`starterBoardFlags.ts:3–8`; legacy alias `START_CHART_GAME_REVISIONS`):

1. Every stored `forge_game_revisions` payload was written by a master writer, so none has the label. Each game is excluded, first by the ISO-hash mismatch (`identity_conflict`) and otherwise by `use_not_approved` (`consumerRevisionAdmission.ts:71–90`).
2. `admitted.forecasts` is empty, so `revisions = []` (`start-chart.ts:981`).
3. The serving branch then sets `projections = []` and `goalies = []` (`start-chart.ts:1011–1013`), and `runId`/`forgeRun` become null (`:1029–1031`). The legacy run is deliberately not used as a fallback.
4. Result: **zero admitted games.** Separately, and regardless of the flag, the API routes above return 422 for every current run.

I did not read whether the production flag is on: that needs a production env read, which this ticket does not allow. With the flag off, Start Chart's legacy path still serves unlabelled runs and only flags them (`:905–907`). The FORGE API routes would still 422.

### 1d. Two independent problems

- **(P) Provenance label.** This is a data-contract field the writer must stamp, and it is honest only together with the `allowCurrentFantasy=false` stage flips. Fix it by shipping the writer and stages, then producing labelled runs.
- **(H) Legacy raw-timestamp hash.** Stored issued revisions carry `sha(raw start_time)`, while readers recompute `sha(ISO start_time)`. Supabase returns `…+00:00` and the ISO form is `….000Z`, so the hashes differ. **A label does not repair this.**
  - Revisions written before the ISO writer ships never pass the HEAD reader.
  - Only revisions issued by an ISO-hashing writer are admissible.
  - Test them separately:
    - a labelled revision with a raw-hash schedule must still be `identity_conflict`;
    - an ISO-hash revision without the label must be `use_not_approved`.

---

## 2. NEVER-TO-MASTER list (until §4 step 4)

### 2a. Commits carrying native admission (`origin/master..HEAD`)

Never cherry-pick any of these whole. Each mixes admission with other work.

| Commit | What it carries |
|---|---|
| `7f094c8e6` big commit | `consumerRevisionAdmission` `use_not_approved` gate, ISO hash in `issuedContext`, `gameRevisions` type, `apiHelpers` 422, `projections/{goalies,players,teams}` gates, `forge/goalies` + `forge/players` admission, stage flips to `false`, `nativeInputEligibility.test.ts` |
| `0de97e77d` 10/17 1930 | `calibrationEligibility` dual contract, `startChartContract`, `start-chart`, writer `externalFantasyInputsExcluded` |
| `317f8f57e` 10/18 sprint | `startChartContract`, `start-chart`, `forge/goalies` (**also F2 null-win**), writer label |
| `cc3be5c09` 10-19 record | `forge/goalies`, `forge/players` admission edits + tests |
| `b47c512fb` six audit findings | `start-chart`, `forge/players`, label tests |
| `5ae65fc13` reconciliation | `start-chart` `selectForecastServingSource` / native source |
| `6e14053ff` aligned counts | `nativeGoalAccounting` null-head contract |

### 2b. Hunks (HEAD vs b630e0767) that must not reach master

- `web/lib/projections/consumerRevisionAdmission.ts`: `:8` import and `:88–90` `use_not_approved` gate.
- `web/lib/projections/calibrationEligibility.ts`: `:9–12, 39–55`, the eligibility reason that requires the label.
  - Its `:3` constant and `:21–29` builder option belong to step 2 only, together with the stage flips.
- `web/lib/projections/issuedContext.ts`: `:17–18`, the ISO hash.
- `web/lib/projections/apiHelpers.ts`: `:5, 42, 58–63`.
- `web/pages/api/v1/forge/goalies.ts`: `:8, 477, 487–492`.
- `web/pages/api/v1/forge/players.ts`: `:7, 180, 194`.
- `web/pages/api/v1/projections/{goalies,players,teams}.ts`: the label gates.
- `web/lib/projections/startChartContract.ts`: all +272 lines.
- `web/pages/api/v1/start-chart.ts`:
  - `:6–7, 27–28`;
  - `:1076–1089`, the cache expiry;
  - `:1130–1140`;
  - `:1150–1212`, the native source;
  - `:1586, 1683`.
- `web/lib/projections/nativeGoalAccounting.ts`: the whole diff (frozen native file).

### 2c. Reader files never copied wholesale (blob-checked by the guard)

- `web/pages/api/v1/forge/players.ts`, `forge/goalies.ts`, `start-chart.ts`
- `web/pages/api/v1/db/cron-report.ts` (+76; depends on the retained-outcome format)
- `web/lib/cron/withCronJobAudit.ts` (+67: `responseOutcome`, `responsePreviewKeys`)
- the rolling writer `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - +57: `aligned_count_support`, `rollingPlayerCountSupport`, `rollingPlayerOperationalPolicy`;
  - the last two are octoberBranch modules.
- `web/pages/api/v1/projections/{goalies,players,teams}.ts`
- `web/lib/projections/{consumerRevisionAdmission,calibrationEligibility,issuedContext,startChartContract,nativeGoalAccounting,apiHelpers}.ts`

---

## 3. Candidate guard

Paste the script into a file outside the repo (for example `$SCRATCH/g1-guard.sh`), then run it from inside the checkout: `bash g1-guard.sh <candidate-rev>`.

- It never sets `GIT_DIR` and unsets `GIT_DIR`/`GIT_WORK_TREE`/`GIT_INDEX_FILE`.
- It only reads objects (`git grep <rev>`, `git rev-parse <rev>:<path>`), so it works on temp-index `commit-tree` candidates before any ref moves.
- Exit codes: 0 = pass, 1 = fail, 2 = bad rev.

```bash
#!/usr/bin/env bash
# G1 candidate guard: exit 1 if <rev> carries octoberBranch native admission
# (reader contracts) or a wholesale octoberBranch reader file.
# Usage, from anywhere inside /Users/tim/Code/fhfhockey.com:  bash g1-guard.sh <rev>
set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
REV="${1:?usage: g1-guard.sh <candidate-rev>}"
BASE="${G1_BASE:-b630e0767d00d6c72506268282834151d78e7da1}"   # released master R6f
REFS="${G1_REFS:-9695a2fe65e4393640dc312dd3b0b83485e5c97e octoberBranch}"  # analysed tip + live branch
git rev-parse -q --verify "${REV}^{tree}" >/dev/null || { echo "G1 GUARD ERROR: cannot resolve ${REV}"; exit 2; }
fail=0
hit() { echo "FAIL  $*"; fail=1; }
SRC=(-- web ':(exclude)*.test.ts' ':(exclude)*.test.tsx' ':(exclude)web/__tests__' ':(exclude)web/e2e')

# 1. Never-to-master reader symbols: label|fixed string|pathspec ("SRC" = all non-test web source).
while IFS='|' read -r label pat where; do
  [ -z "$label" ] && continue
  if [ "$where" = SRC ]; then spec=("${SRC[@]}"); else spec=(-- "$where"); fi
  matches=$(git grep -l -F -e "$pat" "$REV" "${spec[@]}" 2>/dev/null | sed "s#^${REV}:##" | tr '\n' ' ')
  [ -n "$matches" ] && hit "$label: '$pat' in $matches"
done <<'EOF'
reader rejects runs lacking external_fantasy_input_contract|!== FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT|SRC
calibration eligibility requires the exclusion label|missing_or_legacy_external_fantasy_exclusion_contract|SRC
ISO-normalised schedule-revision hash|new Date(instant).toISOString() : row.start_time|web/lib/projections/issuedContext.ts
native serving-source selection in Start Chart|selectForecastServingSource|web/pages/api/v1/start-chart.ts
native game-expectation Start Chart board|startChartFromGameExpectations|web/lib/projections/startChartContract.ts
native goal accounting null-head contract|sumAvailableReportedMeans|web/lib/projections/nativeGoalAccounting.ts
EOF

# 2. Writer honesty: the label may only ship with external fantasy inputs disabled in both stages.
if git grep -q -F -e "externalFantasyInputsExcluded: true" "$REV" -- web/lib/projections/run-forge-projections.ts; then
  git grep -q -E -e '"(skater|goalie)", true\)' "$REV" -- web/lib/projections/stages/skater-stage.ts web/lib/projections/stages/goalie-stage.ts \
    && hit "writer stamps excluded_from_native_inputs_v1 while a stage still calls loadSeasonBootstrap(..., true)"
fi

# 3. Wholesale octoberBranch file versions (blob differs from BASE and equals a REF blob).
for p in web/pages/api/v1/forge/players.ts web/pages/api/v1/forge/goalies.ts web/pages/api/v1/start-chart.ts \
         web/pages/api/v1/db/cron-report.ts web/lib/cron/withCronJobAudit.ts \
         web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts \
         web/pages/api/v1/projections/goalies.ts web/pages/api/v1/projections/players.ts web/pages/api/v1/projections/teams.ts \
         web/lib/projections/consumerRevisionAdmission.ts web/lib/projections/calibrationEligibility.ts \
         web/lib/projections/issuedContext.ts web/lib/projections/startChartContract.ts \
         web/lib/projections/nativeGoalAccounting.ts web/lib/projections/apiHelpers.ts; do
  cand=$(git rev-parse -q --verify "${REV}:${p}" 2>/dev/null) || continue
  base=$(git rev-parse -q --verify "${BASE}:${p}" 2>/dev/null || echo none)
  for ref in $REFS; do
    refblob=$(git rev-parse -q --verify "${ref}:${p}" 2>/dev/null) || continue
    if [ "$refblob" != "$base" ] && [ "$cand" = "$refblob" ]; then hit "wholesale octoberBranch file ${p} (= ${ref} blob ${refblob:0:10})"; break; fi
  done
done

# 4. Generated/cache paths must never ship in a candidate (R8 shipped a stray
#    node_modules/.vite/vitest results.json via a worker-made patch).
junk=$(git diff --name-only "$BASE" "$REV" | grep -E '(^|/)(node_modules|\.next[^/]*|\.vite)/' || true)
[ -n "$junk" ] && hit "generated/cache paths in candidate: $(echo $junk | tr '\n' ' ')"

if [ "$fail" -eq 0 ]; then echo "G1 GUARD PASS  $(git rev-parse --short "$REV")"; else echo "G1 GUARD FAIL  $(git rev-parse --short "$REV")"; fi
exit "$fail"
```

### Verified runs (2026-10-20)

`bash g1-guard.sh origin/master` exits 0:

```text
G1 GUARD PASS  b630e0767
```

`bash g1-guard.sh HEAD` (9695a2fe6) exits 1:

```text
FAIL  reader rejects runs lacking external_fantasy_input_contract: '!== FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT' in web/lib/projections/apiHelpers.ts web/lib/projections/calibrationEligibility.ts web/lib/projections/consumerRevisionAdmission.ts web/pages/api/v1/forge/goalies.ts web/pages/api/v1/forge/players.ts web/pages/api/v1/projections/goalies.ts web/pages/api/v1/projections/players.ts web/pages/api/v1/projections/teams.ts
FAIL  calibration eligibility requires the exclusion label: 'missing_or_legacy_external_fantasy_exclusion_contract' in web/lib/projections/calibrationEligibility.ts
FAIL  ISO-normalised schedule-revision hash: 'new Date(instant).toISOString() : row.start_time' in web/lib/projections/issuedContext.ts
FAIL  native serving-source selection in Start Chart: 'selectForecastServingSource' in web/pages/api/v1/start-chart.ts
FAIL  native game-expectation Start Chart board: 'startChartFromGameExpectations' in web/lib/projections/startChartContract.ts
FAIL  native goal accounting null-head contract: 'sumAvailableReportedMeans' in web/lib/projections/nativeGoalAccounting.ts
FAIL  wholesale octoberBranch file web/pages/api/v1/forge/players.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 8171df07bf)
FAIL  wholesale octoberBranch file web/pages/api/v1/forge/goalies.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob afc9364c10)
FAIL  wholesale octoberBranch file web/pages/api/v1/start-chart.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 1089af68e0)
FAIL  wholesale octoberBranch file web/pages/api/v1/db/cron-report.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 6456e1d12d)
FAIL  wholesale octoberBranch file web/lib/cron/withCronJobAudit.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob d02076e914)
FAIL  wholesale octoberBranch file web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 0611411773)
FAIL  wholesale octoberBranch file web/pages/api/v1/projections/goalies.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 11da8c24a2)
FAIL  wholesale octoberBranch file web/pages/api/v1/projections/players.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 9bb408476e)
FAIL  wholesale octoberBranch file web/pages/api/v1/projections/teams.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 793fc272c8)
FAIL  wholesale octoberBranch file web/lib/projections/consumerRevisionAdmission.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 1bd59c4888)
FAIL  wholesale octoberBranch file web/lib/projections/calibrationEligibility.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 188021e5f0)
FAIL  wholesale octoberBranch file web/lib/projections/issuedContext.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 23030433e9)
FAIL  wholesale octoberBranch file web/lib/projections/startChartContract.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob 7a2618ecda)
FAIL  wholesale octoberBranch file web/lib/projections/nativeGoalAccounting.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob d84e7eaedd)
FAIL  wholesale octoberBranch file web/lib/projections/apiHelpers.ts (= 9695a2fe65e4393640dc312dd3b0b83485e5c97e blob f246f3dbd5)
G1 GUARD FAIL  9695a2fe6
```

### Guard limits

- Not run: a positive control on a synthetic `master + F2` candidate tree. That would write objects. Its three F2 hunks touch none of the guard's strings, and the result blob differs from HEAD's (section 5).
- Not run: a negative control for check 2. No rev today has a label without stage flips.
- The symbol list is a tripwire for known admission code, not proof of compatibility. Keep the candidate `tsc` + full-Vitest gate.
- When native admission is intentionally activated (§4 step 4), retire or re-baseline the guard (`G1_BASE`, `G1_REFS`) in the same release record.

---

## 4. Ordered activation sequence

Each step needs its own Release/Operational approval from TJ in the acting session. Local tests never qualify production.

1. **N1: native target scope.**
   - Integrate the reviewed patch (`tasks/artifacts/forge-target-scope-fix-2026-10-19/`) after the 17:00Z freeze and the N2 rebase.
   - Tests: `lib/player-forecasts/nativeDailyPipeline.test.ts`, `nativeDailyMeansCapture.test.ts`, `rollingWindowParticipation.test.ts`, `rollingParticipationFrame.test.ts`, `scripts/forge-daily-universe.test.ts`.
   - Exit: offline replay reports zero untargeted sources.
2. **Writer stamps.** Ship these together:
   - the `calibrationEligibility` constant and builder option;
   - the three `run-forge-projections` call sites;
   - both stage flips to `allowCurrentFantasy=false`;
   - the ISO `forgeScheduleRevision` writer;
   - the `gameRevisions` type field.

   The writer change ships without the reader gates. It changes projection values (external fantasy blending is removed), so it needs a native-owner review.
   - Tests: `lib/projections/nativeInputEligibility.test.ts`, `lib/projections/run-forge-projections.resume.test.ts`, `run-forge-projections.local-attempt.test.ts`, `__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`.
   - Exit: the guard's check 2 passes, and checks 1 and 3 still pass.

   Caveat: the ISO hash is a reader *and* writer function. In this step only the writer copy changes, because master's reader recomputes with the same function. Two options:
   - ship the ISO hash with step 4 instead;
   - ship it here, and accept that master's own admission then compares ISO against ISO (consistent).

   Either way, raw-hash legacy revisions stay inadmissible under the HEAD reader. Decide this with the native owner.
3. **Qualified issuance and readback.**
   - One approved, dated FORGE run on hosted code (not `local:` git_sha).
   - Read back `forge_runs.metrics.input_provenance.external_fantasy_input_contract = "excluded_from_native_inputs_v1"`, `git_sha` non-local, and published `forge_game_revisions` whose payload carries the label and ISO-hash schedule revisions.
   - Tests that model it: `lib/rosterScheduleData/forgeDailyBridge.test.ts` (local-run fencing), `lib/projections/apiHelpers.runAdmission.test.ts` (latest labelled run admitted, 7 unlabelled shapes → 422).
   - Exit: an immutable readback record, not a test result.
4. **Consumer admission.**
   - Ship the readers in §2b; the guard is retired or re-baselined in the same record.
   - Tests:
     - `apiHelpers.runAdmission.test.ts`, `apiHelpers.test.ts`;
     - `__tests__/pages/api/v1/forge/goalies.test.ts` and `forge/players.test.ts`;
     - `__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts`;
     - `__tests__/pages/api/v1/start-chart.test.ts`, `__tests__/pages/start-chart.test.tsx`;
     - `lib/rosterScheduleData/planning.test.ts`, `lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts` (schedule hash);
     - `lib/player-forecasts/forecastServingSource.test.ts`, `gameExpectations.test.ts`, `contributions.test.ts`;
     - `lib/projections/nativeGoalAccounting.test.ts`.
   - Add the two (H) cases from §1d.
   - Smoke-test Start Chart within the 5-request budget.
5. **Cron/env, last.** These are Operational changes:
   - `STARTER_BOARD_*` flags;
   - `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID`;
   - the schedule cron line (`52 8,14 * * *`).

   Tests: `combinedCronInventory.test.ts` and `forecastServingSource.test.ts` (pre-activation selects legacy).

### Counting rule for qualification evidence

Report these as separate numbers. Never present an `exclusionCounts` total as "players rejected".

- **Admitted player-games:** unique `${playerId}:${gameId}` keys in `admitConsumerGameRevisions(...).forecasts` / `admittedSources` (`consumerRevisionAdmission.ts:129–143`).
- **Missing stat cells:** `exclusionCounts.missing_target`, one count per (game, player, target) null (`:110`).
  - Emitted *before* the `no_usable_target` rejection (`:111`), so it also includes cells of player-games that were then rejected.
  - Subtract those, or count from `exclusions[]` rows filtered to admitted keys.
- **Rejected games versus player-games:** `use_not_approved` and the game-level `identity_conflict` count once per game (`:63, 87, 89`). `emit`-level `identity_conflict` counts once per player (`:95, 107`).
- Then verify **scorability for the requested profile.** An admitted goalie can still have no nonzero-weight scoring target (handoff research checkpoint).

---

## 5. Master-compatible fixes safe to port hunk-wise

| Fix | Hunks | Notes |
|---|---|---|
| **F2: goalie null-win** (`web/pages/api/v1/forge/goalies.ts`) | HEAD `:155` (`proj_win_prob: number \| null`), `:172–174` (skip normalisation when any matchup win is null), `:443` (`?? null` instead of `?? 0`). **Exclude** `:8`, `:477`, `:487–492` (admission). | See the patch below. |
| F2 test (`web/__tests__/pages/api/v1/forge/goalies.test.ts`) | Only the block `"keeps a null win probability unknown for $name …"` (HEAD `:400–427`). In its `forge_runs` mock, keep `metrics: { goalie_rows: 2 }`. | Drop the `input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT }` entry and the `:2–3` imports: master has no such export. Leave out `:89–154` and every other fixture edit that adds `input_provenance`. Master's `createQueryBuilder(resolver, onEq?)` already matches. |
| F1: local-run fencing in `apiHelpers`/`forge/goalies` | Not on HEAD either. Write it new on master (mirror `start-chart.ts:874` `.or("git_sha.is.null,git_sha.not.like.local:*")` before `.limit`). | Must not bring the `:58–63` 422 label hunk. The guard does not block it. |
| `gameRevisions.ts:94` optional type field | Single line | Harmless, but belongs to step 2. |

Not safe now:
- `nativeGoalAccounting` null-head propagation: frozen native file, in the trap list, and guarded.
- `START_CHART_RESPONSE_MAX_BYTES`: depends on octoberBranch `scoreStartChartPayload`, so a hunk port fails. It would need a hand-port onto `scoreStarterBoardPayload`.
- Anything in `cron-report`/`withCronJobAudit`/the rolling writer: depends on octoberBranch modules.

F2 patch, built in scratch from the master blob. It applies to `b630e0767`, and its +/- lines are an exact subset of `git diff origin/master HEAD -- web/pages/api/v1/forge/goalies.ts` once the admission lines are removed:

```diff
--- a/web/pages/api/v1/forge/goalies.ts
+++ b/web/pages/api/v1/forge/goalies.ts
@@ -151,7 +151,7 @@
     team_id: number;
     opponent_team_id: number;
     starter_probability: number;
-    proj_win_prob: number;
+    proj_win_prob: number | null;
   },
 >(rows: T[]): { rows: T[]; adjustedMatchups: number } {
   const normalizedRows = rows.map((row) => ({ ...row }));
@@ -168,6 +168,9 @@
   let adjustedMatchups = 0;
   for (const indices of matchupIndexMap.values()) {
     if (indices.length < 2) continue;
+    // A null win probability is unknown (missing team goals); never invent one
+    // from starter weights or rescale a known opponent against it.
+    if (indices.some((idx) => normalizedRows[idx].proj_win_prob == null)) continue;
     const positiveMass = indices.reduce(
       (sum, idx) =>
         sum + Math.max(0, Number(normalizedRows[idx].proj_win_prob ?? 0)),
@@ -436,7 +439,7 @@
         proj_shots_against: row.proj_shots_against ?? 0,
         proj_saves: row.proj_saves ?? 0,
         proj_goals_allowed: row.proj_goals_allowed ?? 0,
-        proj_win_prob: row.proj_win_prob ?? 0,
+        proj_win_prob: row.proj_win_prob ?? null,
         proj_shutout_prob: row.proj_shutout_prob ?? 0,
         modeled_save_pct: model.save_pct ?? null,
         volatility_index: model.volatility_index ?? null,
```

Consumers already accept null:
- `lib/dashboard/normalizers.ts:315, 389`: `number | null` via `toFiniteNumber`;
- `lib/dashboard/invariants.ts:102`;
- `formatPercent` in `GoalieRiskCard`/`GoalieContextPanel`.

The candidate `tsc` and full-Vitest gate is still required. Run `npx vitest run __tests__/pages/api/v1/forge/goalies.test.ts` on the candidate export.

---

## Checks run (2026-10-20, Node 22.11.0, no GIT_DIR)

- `cd web && npx vitest run lib/projections/apiHelpers.runAdmission.test.ts lib/rosterScheduleData/forgeDailyBridge.test.ts lib/player-forecasts/nativeDailyPipeline.test.ts`: **PASS**, 3 files, 39 tests (16 + 16 + 7). This ran on the working tree, which includes other sessions' uncommitted edits.
- Guard: **PASS** on `origin/master` b630e0767 (exit 0); **FAIL** on `HEAD` 9695a2fe6 (exit 1, 21 findings), as intended.
- F2 isolation: 3-hunk patch built against the master blob in scratch. Its lines are a subset of the HEAD diff. It was not applied to any tree, and no test was run with it.
- `git diff --no-index --check /dev/null` on this file: **PASS** (no whitespace errors; the file is untracked, so plain `git diff --check` has nothing to inspect).
- Not run: tsc, full suite, Playwright, any production/Vercel/Supabase read (including the production `STARTER_BOARD_SERVING_ENABLED` value).
