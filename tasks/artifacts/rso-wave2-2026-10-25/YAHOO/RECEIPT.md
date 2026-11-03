# RSO-YAHOO receipt: offline connected-Yahoo daily acceptance packet

- **Lane:** RSO-YAHOO (CLAUDE-LEASES.json). **Date:** 2026-10-25.
- **Base HEAD:** `3f127f485` (octoberBranch).
- **Status:** not committed. The orchestrator commits.
- **No product source edited.** `rosterScheduleData/planning` (`loadPlanningData`), the Yahoo provider client,
  game-context and settings parser are **mocked** in the test, not edited.

## Hash list

| File | sha256 |
|---|---|
| `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts` (new) | `f81cb3fcde13e043e94ca7bd7d37a8ad40fedfcc191d8b564c9a374a7747def7` |
| `tasks/artifacts/rso-wave2-2026-10-25/YAHOO/DEFECTS.md` | `7cb93118ec08bf672ccb60ee336a0f4b8abaa4719a5d087c309f6a9471301b1f` |
| `tasks/artifacts/rso-wave2-2026-10-25/YAHOO/REAL-ACCOUNT-PLAN.md` | `463c42d228ab42568626a5154cf00c20c0a4fe4c3a363f5c5b8271212eb9add4` |

Support files: `tsconfig.json` (scoped tsc), `tsc.log`, `eslint.log`, `vitest-run1..3.log` and
`rso-and-yahoo-suites.log`.

## Harness

- **Real code under test:**
  - `loadYahooPlanningSnapshot` (`lib/integrations/yahoo/rosterPlanning.ts`)
  - `loadYahooPlanningConfirmations` (`planningConfirmations.ts`), which calls `applyProviderGoalieStarts`
  - `supplementProviderRules`
  - `evaluatePlan` and `planRoster`
  - `reconcileIntent`
  - `currentProviderPeriod`, `retainProviderInputs` and `write/readWorkspace(History)`
  - `retentionCaution`
- **Mocks:** these reuse the existing private-read pattern from `rosterPlanning.test.ts` and
  `planningConfirmations.test.ts`.
  - A fake owned-account database (`external_teams`, `external_leagues`, `yahoo_nhl_player_map_read`).
  - The Yahoo provider client, which returns synthetic standard-JSON payloads with transport freshness.
  - The settings parser.
  - `loadPlanningData`: a synthetic catalog, schedule and week calendar.
  - `globalThis.fetch` is trapped and asserted uncalled after every test.
- **Synthetic league:** a 12-team daily points league in Toronto time, week 2 (Mon 2026-10-19 → Sun 10-25), with
  points scoring and a 3-start goalie minimum. Bridge goalie rows are labelled interim FORGE bridge fixtures.

## Scenarios: what each proves, and what it does not

**(a) Snapshot import** (7 tests, 1 `it.fails`)
- *Proves:*
  - The owned roster becomes legal planner inputs: positions; eligibility; `is_undroppable` becomes `canDrop`;
    IR eligibility comes from `eligible_positions`; an injury designation; reserve slots are restored.
  - The no-move lineup is legal.
  - Transaction timing and goalie-minimum semantics stay `unknown`, and `capabilities.rules === false`.
  - Planning on raw Yahoo rules discloses the timing gap and proposes no acquisitions.
  - An unmapped roster player stays explicit, and the roster is marked partial.
  - A non-editable player becomes a provider lock.
  - A stale read leaves eligibility, `canDrop`, IR eligibility and the goalie mark unverified.
  - A missing league time zone stays explicit, and the recommendation is withheld.
- *Exposes Y1:* nothing in the limitations names the unverified rules.
- *Does not prove:* real payload shapes, or the UI's rendering of capabilities.

**(b) Overrides** (2 tests)
- *Proves:*
  - Manager timing and goalie semantics fill Yahoo's unknowns.
  - Provider weights, roster slots and the goalie requirement win, and each conflict is disclosed.
  - `evidence.managerRules` is marked partial, the snapshot gets a new id, and the source is not mutated.
  - With timing supplied, an add is charged to `yahoo-week-2`.
  - A provider lock beats a conflicting manager lock, with disclosure.
- *Does not prove:* weekly lineup windows (beta is daily only).

**(c) Bounded discovery** (2 tests)
- *Proves:*
  - A short final page means complete discovery, and a player on another league roster is `rostered`.
  - A catalog player Yahoo never lists stays `unknown`, even after a complete read.
  - A failed later page is reported as partial, with its limitations and diagnostics. Its unseen players stay
    `unknown`, and the planner never proposes them; a forced add of one is illegal.
- *Does not prove:* the 8 s time budget, or repeated-identity pages (both already covered in `rosterPlanning.test.ts`).

**(d) Weekly allowance** (8 tests)
- *Proves:*
  - Remaining = `max_weekly_adds` − the fresh, owned, current-week `roster_adds` counter (4 − 1 = 3). It becomes a
    provider period with cost 1. `number_of_moves` (40) is ignored, and `currentProviderPeriod` matches.
  - The allowance is withheld in each of these cases: not owned; stale; a season-coverage counter; a previous-week
    counter; the counter absent (season moves only); no positive weekly limit; a horizon past the week.
  - When withheld, there are no periods, cost is null, `acquisitions: false`, the verify limitation is shown, and adds
    are illegal.
- *Does not prove:* combined two-week matchups.

**(e) Goalie Starting / Not Starting** (12 tests)
- *Proves:*
  - A fresh, owned, scoped `is_starting` 1 or 0 sets bridge start chances to 1/0 (or 0/1). Stats become the per-start
    line × chance, `conditionalStats` is preserved, an unknown stat stays null, the interim label is kept and a Yahoo
    note is added. `expiresAt` = observed + 2 min. The input is not mutated.
  - Evidence is withheld when it is stale or expired (rejected), from the wrong principal (rejected before provider
    traffic), for the wrong game, for a game already started, an unknown mark, contradictory starters, or a
    contradicted confirmed starter. Withheld rows stay unchanged.
  - A saved `startingStatus` label alone mints nothing.
  - The snapshot import sets the mark only from a fresh roster read.
- *Does not prove:* planner use of confirmed bridge rows. That needs the fetch-based bridge authority
  (`withCurrentPlanningRead`), which is not exercised offline.

**(f) Global rostered %** (1 test)
- *Proves:*
  - 88% owned but unlisted: unknown, not addable.
  - 2% owned but on another roster: not addable.
  - 1% owned free agent: addable.
  - 3% owned but undroppable: the drop is illegal.
  - 97% owned and droppable: the drop is legal, with a high-demand caution only.
  - The planner never proposes the unaddable players.

**(g) Snapshot → plan → refresh** (2 tests)
- *Proves:*
  - A selected add/drop is legal and reconciles cleanly.
  - On refresh, the selected player is claimed elsewhere and the counter moves. Reconciliation then proposes a repair
    (allowance changed; player no longer available; `suggestedSteps: []`). The selected moves stay in the intent, and
    `planRoster` evaluates them as selected (now illegal).
  - Accepting the repair is a new revision, and Undo restores the moves.
  - An unchanged refresh keeps the moves with no issues.
- *Does not prove:* the component's refresh flow (RSO-E2E lane).

## Runs (offline, from `web/`)

| Check | Command | Result |
|---|---|---|
| Vitest ×3 | `env -u GIT_DIR npx vitest run lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts` | **passed** 3/3: 34 tests each (33, plus 1 known defect as `it.fails`), about 0.75 s |
| Defect pin check | the same run with `it.fails` → `it`, then the file restored (hash re-verified) | failed only at the Y1 assertion (line 189) |
| Neighbour suites | `env -u GIT_DIR npx vitest run lib/rosterScheduleOptimizer lib/integrations/yahoo/rosterPlanning.test.ts lib/integrations/yahoo/planningConfirmations.test.ts` | **passed**, 23 files and 700 tests |
| ESLint | `npx eslint lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts` | **passed**, exit 0 |
| Scoped tsc | `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p ../tasks/artifacts/rso-wave2-2026-10-25/YAHOO/tsconfig.json` | **passed**, exit 0 |
| Whole-project tsc | n/a | **not run** (not required; the heavy lock was not taken) |

No network, Yahoo, database, production, server, git mutation, `GIT_DIR` or real league data was used.

## Defects

| ID | Severity | Where | Summary |
|---|---|---|---|
| Y1 | low–medium | `rosterPlanning.ts:435`, `:437`, `:468-470`, `:576`; UI consumers `RosterScheduleOptimizer.tsx:498`, `:868` | With every read verified, `capabilities.rules` is false but `capabilities.limitations` and `rules.unsupported` are empty. Timing and goalie semantics are unknown, so the UI's limitation-driven health list can present the league as complete. |

## Real-account plan

`REAL-ACCOUNT-PLAN.md` describes 3 snapshot loads plus 2 confirmations reads, at most 80 Yahoo reads with a ceiling
of 100. It covers scenarios R1–R4, the preconditions, the evidence policy and the stop rules. It is a plan only; no
calls were made.
