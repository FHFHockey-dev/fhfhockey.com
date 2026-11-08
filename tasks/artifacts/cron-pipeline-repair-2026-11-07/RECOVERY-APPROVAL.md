# Read-only recovery preflight

Exact deployed candidate: `b4033ad65ffba6835ba0754dd665e5d694301f64`. Evidence checked November 7, 2026, 21:15–21:21 UTC. No recovery has run. Recheck all bounds immediately before an approved action; do not carry this scope across UTC midnight.

## Findings

- Nov 7–13 has 47 games and 32 teams. Stored seasonal goalie logs reconstruct 224 raw candidates, 216 current-team candidates, no duplicate eligible game/player keys, no empty game side, and no ambiguous current memberships.
- Exactly four currently stored priors are stale: Martin/NYR for games 2026020267 and 2026020283; Daws/NJD for 2026020270 and 2026020279. The complete eight rejected predicates and all 47 game IDs are in RECOVERY-PREFLIGHT.json.
- Nov 10–13 still has no goalie priors or FORGE player projections. Nov 7–9 priors are five/six days old; latest successful FORGE runs were this morning.
- No active pipeline lease or running FORGE row was found in the requested date range. The Nov 7 orchestrator is failed at projection_execution with cursor 7. Do not reset/replay the orchestrator.
- All 32 teams have 18 distinct latest line-role players and recent derived inputs. Morning gates failed only for missing goalie priors on Nov 10–13. Full PBP/shift parity was not rerun; ordinary execution gates must remain enabled.

## Separately approvable goalie operation

One invocation:
`POST /api/v1/db/update-goalie-projections-v2?endDate=2026-11-13&limit=7`

Current bounds: seven dates, 47 games, 32 teams; one NHL season read plus 32 team-log reads, team concurrency five and log limit 200/team; no retries. Platform limit 240 seconds. The endpoint currently derives its start date as Nov 7 from latest stored prior date capped to today; verify this again before invocation.

Writes: goalie_start_projections and the ordinary audit receipt. Expected 216 upserts followed by eight exact rejected game/team/player deletion predicates, only four of which currently match stored rows. Pruning occurs only after all upserts succeed and retains the old-team predicate, protecting a valid new-team row at the same game/player key.

These counts are estimates, not endpoint-enforced caps: fresh NHL/roster data determine the actual candidates. The endpoint does not accept a static delete manifest. Approval must cover eligible priors and rejected old-team candidates within the selected game scope, not promise “exactly four rows and no others.” If the user requires that literal cap, do not use this endpoint as if it enforced one.

Suggested short approval wording: “May I run one goalie refresh for Nov 7–13, updating eligible priors for the 47 games and then removing stale team/game/player entries only after the replacement writes succeed? The current data predicts 216 updated rows and four stale rows removed. I’ll stop and inspect on any failure or uncertain result.”

## FORGE is not yet approval-ready

Smallest configuration question:
“Is Production STARTER_BOARD_COMPUTE_ENABLED explicitly false? If it is unset, what is START_CHART_GAME_REVISIONS?”

Effective compute=false establishes the narrow path. When compute=true, capture must also be enabled; canary and season-bootstrap settings can add snapshot capture, game-run reservation, revision publication and bootstrap behavior. Full-date calls do not inherently switch these off. Do not retry the denied environment listing or change flags to make the scope fit.

Once the narrow path is established and approved, proposed recovery is six sequential single-date invocations for the full Nov 8–13 slates: 35 games. Each uses date=DATE, horizonGames=1 and maxDurationMs=210000, with no gameIds parameter, no automatic continuation, and no range request. One invocation/date maximum. Each route answers by 225 seconds while the platform limit is 240 seconds; a forced response does not prove its in-flight work has stopped.

The normal writes include a new forge_runs row, player/team/goalie/reserve projection rows and ordinary audit receipts. Analytics sidecars replace existing rows for the same snapshot date, game, model=forge and version=market-context-v1 in player_prediction_outputs, game_prediction_outputs and model_market_flags_daily. The first two additionally constrain prediction_scope=pregame. This is more than simply inserting missing projections.

Do not re-run Nov 7 forecasts under this scope: two games had already passed scheduled puck drop. A partial remaining-game run can alter latest-run selection and is not a safe silent substitute. Preserve today's forecast history until separately scoped.

## Execution and verification stops

- Fresh read-only slate, roster, stale-key, newest-row and lease checks before invoking anything.
- If goalie succeeds, verify actual counts, zero invalid current-team rows/duplicate keys and coverage of every selected game side before FORGE.
- Preserve all preflight gates. Stop at the first failure, partial/207, occupied lease, unexpected write scope or uncertain outcome. Inspect receipts and database state; do not blindly retry or resume.
- After each successful FORGE date, verify succeeded status, exact date/game coverage, released lease and single-invocation admitted producer identity, plus matching audit. Do not continue if any is absent.
- No manual calibration, historical WiGO repair, Yahoo action, pipeline reset, old-run cleanup, flag change or redeployment is included.

