# Yahoo goalie starting status → RSO (Claude, 2026-10-22)

## Scope
Can the RSO read Yahoo's daily goalie "Starting / Not Starting" designation and use it for start probability?
Parse → planning types → start probability for that date only → badge in the slot grid. Synthetic fixtures only.

## Where
`/Users/tim/Code/fhfhockey.com`, `octoberBranch`, start HEAD `45839f872`. Not pushed.
Other lanes in this checkout: RSO lane (uncommitted lineupGaps.ts/.test.ts, RosterPlayerRow.tsx, RosterScheduleOptimizer.tsx — not mine),
IR/IR+ alert session. Off limits: web/lib/projections/**, lib/routeRunner, served-forecast ledger/scoreboard.

## Checkpoint 1: where Yahoo exposes it
- Our RSO roster read is `team/{key}/roster;date={today}` (providerClient.fetchYahooBoardResource "roster", standard JSON).
- Yahoo's roster player element carries a sibling `{"starting_status":[{"coverage_type":"date","date":…},{"is_starting":0|1}]}`
  beside `selected_position` (evidence: yahoo-fantasy npm nock fixture `tests/nock-data/rosterPlayers.js`, and its
  `helpers/playerHelper.mjs` parser). No `out=` needed.
- starterBoard.yahooBoardPlayers → yahooFields flattens it to `row.starting_status`; rosterPlanning.ts never reads it → dropped.

## Next
Confirm NHL goalie coverage (docs/web), trace goalie start probability in the planner.

## Checkpoint 2: live evidence (TJ-approved pop-up: 2 read-only roster reads, team key supplied by TJ)
- roster;date=2026-10-22 (read 21:30 UTC): starting_status on the 3 goalies only (none on 16 skaters);
  Oettinger is_starting 1, Hart 0, Schmid 0 — matches TJ's green check / two red X.
- roster;date=2026-10-23: starting_status absent for all three → "unconfirmed" = absent, so 0 means Not Starting.
- Reads: external_teams row by key + token RPC (no refresh, no write). Auto mode blocked an auth email lookup (PII); used TJ's key instead.
- Script in scratchpad only; nothing saved to the repo.

## Checkpoint 3: design + implementation (uncommitted)
- Bridge rows are fingerprinted by the P07 current read (currentPlanningRead), so the override runs inside
  withCurrentPlanningRead before the scope is built, from the Yahoo snapshot's player fact.
- Files: planningTypes (ProviderStartingStatus, PlanningPlayer.startingStatus), in-season/workspaceSchema (strict player),
  yahoo/rosterPlanning (yahooStartingStatus + set on fresh goalies), new rosterScheduleOptimizer/providerGoalieStarts(.test),
  currentPlanningRead (one call), SlotWeekGrid(.tsx/.module.scss/.test) badge, forgeDailyBridge.test current-read case,
  rosterPlanning.test parser cases.
- Rule: Starting → p 1 + confirmed, teammates 0; Not Starting → 0, rest rescaled to 1; that date's game only; stats =
  per-start line × p; if-starts unchanged. Skip on contradiction with a confirmed row, two starters, a started game, a
  missing per-start line. Native rows untouched.
- Tests so far: rosterPlanning starting-status 3/3, providerGoalieStarts 4/4, forgeDailyBridge 31/31, SlotWeekGrid 8/8.

## Checkpoint 4: verified + committed
- Lane vitest 131 files / 3155 pass; tsc --noEmit pass (8 GB heap, heavy lock); eslint clean; SlotWeekGrid pure check OK.
- Playwright (isolated :3100, mocked routes): marked starter takes the G slot over FORGE's likelier prior; ✓/✗ badges render.
  Bench label has no effect text (grid only holds the chosen lineup's forecast rows).
- Commit 9a9c914f5 (12 files, explicit pathspecs). Not pushed. Hand-over: side-session-notes/.../yahoo-goalie-starting-status-2026-10-22.md
- Open: P07 owner review of the currentPlanningRead call. Diary kept until that review.
- Codex P07 review note committed: tasks/artifacts/cross-platform/2026-10-22-claude-to-codex-yahoo-goalie-starting-status.md (86ddf9f58).
