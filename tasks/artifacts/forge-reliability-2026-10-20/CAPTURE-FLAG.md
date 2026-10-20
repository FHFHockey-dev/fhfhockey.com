# STARTER_BOARD_CAPTURE_ENABLED in production — investigation (2026-10-20)

This is a code-reading investigation only. I made no env change and no production call. The production values came from TJ: `STARTER_BOARD_CAPTURE_ENABLED=true` and `STARTER_BOARD_COMPUTE_ENABLED=false`. Line numbers are octoberBranch working-tree lines, after the FORGE-reliability edits.

## 1. Does capture alone break per-game resume? Yes.

`web/lib/projections/run-forge-projections.ts:467` only claims a resumable run when capture is off:

```ts
const resumeClaim = !reservation && !captureEnabled && !opts?.decisionAsOf ? await claimResumableRun(...) : null;
```

Compute plays no part. With capture on, every `run-projection-v2` call takes the captured single-call path (`:479` onward):

- **Run creation.** The run comes from `createRun`, which has no lease and no `metrics.resume`.
- **Timeout outcome.** On timeout, `runProjectionCalculations` finalizes the run `failed` (`:1166`). The runner then returns `timedOut` with no `resume` field. The route answers 200 `success:false` "Timed out" with `resume_required`, not the 207 `partial` continuation. Cron audit records a failure.
- **Next call.** The next call starts a new run and recomputes every game.
- **Concurrent call.** A second call while a captured run is active gets `ACTIVE_RUN_EXISTS`. `resumeInProgress` is false because a captured run has no resume state (`run-lifecycle-queries.ts:240`). The route therefore returns a 409 `blocked`, not a 207.

So everything from R6a onward that depends on the per-game lease is inactive in production while capture is on: per-game resume, 207 continuation, and the F4 takeover rules.

Two side notes:
- The F4 same-run late-writer race needs a resumable claim, so it cannot happen in production today.
- The new per-write lease guard only applies to claimed runs, so it does not protect captured runs. A captured run can still overlap a newer run through `createRun`'s stale cleanup after 10 minutes of no activity (`RUN_ACTIVE_WINDOW_MS`), and the date/game-scoped analytics sidecars are shared across runs.

## 2. What capture still feeds (compute off)

| Consumer | Code | What capture does |
|---|---|---|
| FORGE input snapshot | `run-forge-projections.ts` capture path → `saveForgeInputSnapshot` (`gameRevisions.ts:153`) | After the run finalizes `succeeded`, one insert stores every captured read as `forge-run-inputs-v1` in `player_forecast_source_observations`. This is replay/audit evidence (`scripts/replay-forge-snapshot.ts`, `scripts/forge-local-failure-evidence.ts`). It is also the post-run step behind item 3's HTML error (see the report). |
| Start Chart game revisions | `run-forge-projections.ts:541` (`publishForgeGameRevisions`) | Only runs when `compute` is on. With compute off, nothing is published from the snapshot, so FORGE gives Start Chart's revision serving (`start-chart.ts:928–1032`, `serving` flag) nothing new. |
| Issued context | `captureIssuedContext` / `captureForgeIssuedContexts` | Only runs with compute plus a scoped single-game, horizon-1 run. Inactive. |
| News intake: goalie starts | `lib/player-forecasts/sourceObservations.ts:405` | With capture on, observations go through the `capture_starter_board_goalies` RPC (inserts plus conflict detection in one call). With capture off and no tweet interpretation, they fall back to direct per-row inserts into `player_forecast_goalie_start_observations`. |
| News intake: lineups | `sourceObservations.ts:455` | Same pattern: the `capture_starter_board_lineup` RPC, or else direct `player_forecast_lineup_snapshots` / assignment inserts. |
| IFTTT line-source receiver | `lib/sources/lineSourceIftttReceiver.ts:284` | Capture sets the default for "process immediately" when the request has no `process` query parameter. Off means events are only queued. |
| Starter Board scheduler | `pages/api/internal/starter-board.ts` | Retries pending line-source events only when capture is on, and only matters if `STARTER_BOARD_SCHEDULER_ENABLED` is on (default off). |
| Queue / replay / reconstruction | `starterBoardQueue.ts:14,59,68`; `run-forge-projections.ts` `replayForgeSnapshot`, `captureForgeReconstruction` | All refuse to run without capture. Only the replay script and the compute-gated queue are relevant with compute off. |

FORGE projection outputs are identical either way. Capture changes how inputs are recorded, not the calculation. `seasonBootstrap` and the native/daily-board paths depend on `compute`, not `capture`.

## 3. What breaks if capture is turned off

- **News intake changes path.** Goalie and lineup observations stop using the atomic capture RPCs, including their conflict rows, and use the legacy direct inserts. IFTTT events stop processing on arrival unless the sender passes `process=true`. This is the main risk: it changes the news feed that Start Chart and the bridge read. I did not check whether the legacy path produces the same conflict rows.
- **FORGE input snapshots stop.** There is no `forge-run-inputs-v1` evidence for production runs, and `scripts/replay-forge-snapshot.ts` refuses to run. Nothing published depends on them while compute is off.
- **FORGE regains per-game resume.** You get 207 continuation, the lease, and the F4 quiescent takeover. The large post-run snapshot insert also stops.
- **Legacy flag.** `START_CHART_GAME_REVISIONS` is the legacy fallback for all three flags. If it is set, turning capture off needs an explicit `STARTER_BOARD_CAPTURE_ENABLED=false`.

## Recommendation

**Do not turn the env flag off to get FORGE resume back.** The same flag drives news intake (both RPC paths and IFTTT immediate processing), so turning it off changes a production feed for a FORGE-only problem.

Instead, decouple in code. This is a small change in owned files that needs Chef/TJ approval and a release:

- Gate FORGE input capture on the run actually needing it: `captureEnabled && compute` (compute-scoped issued runs, local attempts, replay).
- Full-slate runs with compute off then take the resumable uncaptured path and keep per-game resume, 207 continuation and F4.
- This also stops the one large `saveForgeInputSnapshot` insert after every run.
- If TJ wants replay evidence for capture-only production runs, use a separate opt-in, for example `FORGE_INPUT_CAPTURE_ENABLED`, and accept single-call runs only while it is on.

Until that ships, the item 3 change keeps a succeeded run `succeeded` when the post-run snapshot save fails, and reports that failure as non-blocking.

## Not verified

- The production values of `STARTER_BOARD_SERVING_ENABLED`, `STARTER_BOARD_SCHEDULER_ENABLED` and `START_CHART_GAME_REVISIONS`.
- The size of a production `forge-run-inputs-v1` payload.
- Whether the legacy direct-insert news path matches the RPC path's conflict detection.

All of these need a TJ-approved read.
