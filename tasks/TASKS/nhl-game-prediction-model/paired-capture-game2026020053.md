# PIT at WSH paired capture: preparation and go/no-go

Prepared October 6, 2026. **Not scheduled; no capture runner is running. Current
status: NO-GO for a qualifying paired goals forecast.** Read-only preflight can
be scheduled now. This document does not authorize production mutations.

## Ownership and fixed scope

- Original goal owner: `01a10f2a-4eb4-7480-add7-eda1a963beb1`, **Turn attached file into a goal plan**; listed idle at inspection. Its history was not bypassed or read through another mechanism.
- Preparation owner: `01a10f57-a37c-77e6-b854-70064d5e40f4`, **⠕ Prepare paired forecast capture**. Parent/scheduling owner: `01a10d0c-2480-73ea-aa65-3be0547bd0d5`, **Scout**.
- Leave `chef/forecast-checkpoint-1` and its uncommitted implementation untouched. Original plan: `/Users/tim/.codex/worktrees/forecast-checkpoint-1/fhfhockey.com/tasks/TASKS/nhl-game-prediction-model/tasks-forecast-checkpoint-1.md`.
- Game `2026020053`; away PIT `5`, home WSH `15`; season `20262027`, phase `2`, horizon `1` game.
- Puck drop `2026-10-07T23:30:00Z` / October 7, 7:30 p.m. EDT. Shared cutoff **C = `2026-10-07T22:30:00Z` / 6:30 p.m. EDT**. Rescheduling invalidates this manifest; never silently move C.

## Verified readiness and blockers

Evidence is private in `/tmp/paired-capture-preparation/`; the prior 25-file
manifest in `/tmp/fhfh-forecast-checkpoint-1-evidence/` verified in full.

| Prerequisite | Observed result |
| --- | --- |
| Official NHL schedule | Fresh HTTPS response matches fixed scope; raw body SHA-256 `40ec98a6d930c9ea2a89993d4018ff3beea947e0a9aa0f505cff78c51713cb82`, identical to prior receipt. Current retrieval completion recorded at `2026-10-06T03:55:09.280185Z` using file write completion. |
| Canonical DB and retained pair | SELECT at `2026-10-06T03:56:40.227391Z`: exact game match; 0 FORGE revisions, 0 team histories, 0 team feature snapshots. |
| Some inputs available | 51 current roster rows; PIT/WSH team-power rows through October 5. This proves presence, not completeness, frozen identity, or normalization coverage. |
| Pregame scenarios missing now | 0 goalie-start projections, 0 `lines_ccc` observations, 0 FORGE team projections for this game. Recheck before collection; roster membership alone is not appearance evidence. |
| Independent goals scorer missing | `predictGameWithBaselineModel` returns win probabilities, without home/away goal means. All 277 retained team histories have no complete pair of expected-goal means. FORGE-derived `game_prediction_outputs` goals are not an independent team-model forecast. |
| Artifact identity unresolved | Two registry rows named `nhl_game_baseline_logistic` / `v6_roster_ctpi_sos_threshold_52` use feature sets v4 and v5; parameter/calibration/metadata objects are empty. Checkpoint uses `game_features_v6_verified_team_game_sos100`. A version name or registry row cannot freeze executable parameters. |
| Real corrected exposure unsupported | PIT and WSH each have 155 NST cumulative rows for 2025–26, through June 30; no 2026–27 rows in the checked scope. Live `games` has no completion field; NST counts has no canonical game ID, phase, original availability, or observation-kind fields. Checkpoint queries also omit those proofs. Capture time can prove availability of captured bytes, but cannot invent game grain or completion. |
| FORGE complete goals unsupported | Retained audit reports no issued GOALS target and missing PK totals. ES+PP, win probabilities, or nullable goal fields cannot certify regulation+OT goals including empty net and excluding shootout markers. |
| Local runtime | Node `v22.11.0` and shared `web/node_modules` exist. Credential access on the eventual execution host, precise runner, source/model archive and replay are not validated. No credentials were copied or created. |

**Do not launch** `capture-forge-reconstruction.ts`: it rejects a future cutoff,
uses a fixed diagnostic run ID, reads after its nominal cutoff and labels the
result historical reconstruction. Do not launch production FORGE or the usual
team workflow to manufacture the missing pair: those paths can reserve runs,
persist histories/latest projections and publish revisions. Team `dryRun`
omits full output; it is not a goals capture command.

## What to schedule now

One supported, one-time **read-only preflight at October 7, 3:00 p.m. EDT /
19:00 UTC**, targeting the local preparation task and this document. Prompt:

> Reverify the fixed PIT–WSH game2026020053 scope and paired-capture prerequisites in paired-capture-game2026020053.md. Retain actual read receipts, check both complete goal endpoints and exact executable artifacts, and report GO/NO-GO before the collection window. Do not run production forecasts, write the DB, create credentials, ingest new sources, deploy, train or activate a model. Keep the real-game gate open unless all prerequisites and offline reproduction are proved.

Parent must retain the scheduling tool's confirmed ID, one-time date/time,
timezone and target host/thread. A reminder or heartbeat is not proof that an
executable capture is installed. Do not promise precision from an agent wake-up.
No capture should be scheduled as executable while the runner/artifact gates
remain missing. A later deadline-status notification may say NO-GO; it must not
claim collection succeeded.

For local execution the laptop must stay online, awake, with Codex available,
network access and existing authorized read access. Keep it available for the
preflight and, if admitted, **17:45–19:00 EDT / 21:45–23:00 UTC**. No verified
always-on remote execution host exists for this packet. Runtime is unmeasured:
the existing diagnostic helper's 150-second limit is a budget, not a benchmark.
Require a timed preflight of the admitted runner; reserve at most 10 minutes for
acquisition and stop before 22:20 UTC. Do not use a late catch-up as pregame data.

## Exact bounded collection contract, after GO

This is the required runner contract, **not an existing executable command**.
Do not invent an invocation or mark the missing runner ready. If implementation
becomes viable, make only the prospective capture adapter in an isolated
`chef/<name>` worktree, with the original owner's checkpoint as the explicit
source. No deployment is needed for local inference.

1. **Preflight by 19:00 UTC.** Reverify official and canonical schedule; select the existing independent full-goals artifact and exact FORGE mode; prove complete compatible goals, roster/scenario/participation/workload and real team-game exposure. Resolve unsupported endpoints before coding a collector. Retain code commit, necessary patch and loaded executable source; dependency lock/runtime versions; complete weight/parameter/calibrator bytes and hashes (explicit `none` only if actually absent); feature order/definition, rating scale/whole-league normalization population, nonsecret flags/config and seed. No fitting or changing flags in production.
2. **One acquisition at 22:00 UTC / 18:00 EDT.** Refuse starts outside `[22:00,22:10)` UTC. Aim to finish by 22:10; absolute source deadline 22:20 UTC, with every required request/response receipt strictly before C. Archive official identity, both complete query/result/page/count sets, roster/starter scenarios, appearance probabilities, rates, strength-specific workload, rating population and canonical team-game facts/completion evidence. Scope-limited pagination must prove completeness. Upstream event/observed/available timestamps stay distinct from local receipt times; unknown upstream times remain unknown. A contemporaneous local receipt can support availability of those exact bytes. Do not read protected research holdout data or broad player populations unrelated to this game.
3. **Freeze before C; issue from frozen inputs at C.** Seal the inputs and identities atomically, then exit acquisition. A separate exact one-shot local execution at `22:30:00Z` consumes only those frozen inputs and emits both original full forecasts before puck drop; no live reads. Record actual issuance times, never assign C as a receipt or issuance time. The checkpoint comparison contract requires `issuedAt >= C` and `< puckDrop`, while input availability is `< C`. Earlier acquisition/probe outputs are drafts. Do not relabel them as a later original execution. If no precise local execution mechanism is validated, this phase is not schedulable as a guarantee.
4. **Retain and replay.** Use an exclusive private packet directory outside Git, mode 0700, files 0600. Persist one pair ID and separate UUIDs for both run IDs and both snapshot IDs before dispatch; these are local IDs, not reserved DB runs. Preserve any real upstream run/revision IDs separately; absent IDs are null. Store full outputs, hashes, accounting definitions, raw unrounded means/difference, coverage/exclusions and participation semantics. Include PK/residual/empty-net accounting without double counting. Bundle-level manifest hashes every file; read/request/result and output canonical hashes use `projectionInputHash`. Keep input lineage separate from output issuance lineage. Preserve the packet through replay/review with no automatic deletion; `/tmp` is staging, not durable retention. Before GO select an approved private durable destination with enough space; do not upload to cloud storage or copy credentials.
5. **Independent offline verification.** Deny all network calls, suppress/reject all mutations/RPC, restore exact archived code/model/config, consume every captured input and reproduce both original outputs exactly. Predeclare exact equality; any tolerance needs declaration before capture. FORGE can reuse `replayForgeSnapshot` with an authentic prospective snapshot; the pure team scorer must replay its frozen payload/parameters directly. Verify matching JSON/Markdown exports from the comparison contract. Hash checks alone do not satisfy replay. Preserve failure evidence and keep gate open on any failure.

## Dispatch and unknown outcomes

Use stable scope key `paired:2026020053:2026-10-07T22:30:00Z:h1:v1`.
Atomically create an exclusive reservation directory and fsync a dispatch ledger
before the first request. Allocate IDs once and write phase/status plus actual
timestamps. Terminal states are `inputs_frozen`, `issued`, `replay_verified`,
or `failed`; only the final verified state qualifies, with all endpoint/exposure
checks also passed. Never overwrite a receipt or seal a partial bundle as complete.

Duplicate schedule delivery must inspect the same reservation/ledger. A sealed
terminal packet is returned without dispatch. For an unknown tool/process
outcome, first inspect PID/process, ledger, partial files, manifest hashes and
any recorded source/output receipts. Never restart while the old process may be
active or launch another generation speculatively. If inactive and incomplete,
mark failed and preserve it; do not automatically retry. Any separately approved
new pre-C attempt gets linked immutable attempt IDs and genuine new receipts.
After C no live input fetch can repair eligibility. Since this workflow is local
and transport-fenced, DB readback must not be used to invent a write acknowledgment.

## Failure and approval boundary

NO-GO: changed game/time; missing independent goal artifact, weights/calibrator
or code; incompatible goals/rosters/strength/participation; unproved exposure;
missing or truncated input; unvalidated credentials/host; unknown dispatch;
late start/receipt/issuance; live replay access; any write/RPC/redirect attempt;
failed scorer, timeout or replay mismatch. Preserve truthful artifacts as
nonqualifying and leave Checkpoint 1 task 5.2 open.

Ordinary read-only preflight, local preparation and archival are within the
delegated scope. There is **no concrete production action to approve now**.
Qualifying inference needs the missing artifact/source proofs and a tested local
adapter, not blanket production permission. If remediation requires new source
ingestion, a credential, DB/schema writes, forecast publication or deployment,
prepare its exact target/payload/cost first and obtain separate explicit approval.
No such remediation was executed or made executable in this preparation.

Read-only rechecks: official HTTPS GET
`https://api-web.nhle.com/v1/schedule/2026-10-07`; Supabase project
`fyhftlxokyjtpndbkfse`, table SELECTs scoped to game ID and PIT/WSH. The complete
current SQL response is retained in
`/tmp/paired-capture-preparation/database-preflight.json`. Existing source reuse:
`inputCapture.ts`, `replayForgeSnapshot`, `fetchGamePredictionFeatureInputs`,
`buildGamePredictionFeatureSnapshotPayload`, and the comparison/export contract.

No application code, checkpoint implementation, credentials, DB, deployments,
model artifacts or schedules were changed. Only this runbook and private
preparation receipts were created.
