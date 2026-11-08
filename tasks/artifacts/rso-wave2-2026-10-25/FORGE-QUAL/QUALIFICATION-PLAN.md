# FORGE forecast qualification plan: RSO and Start Chart (2026-10-25)

This plan comes from a read-only audit. It changes no code and makes no production, DB or network reads, and it authorizes nothing. Paths are under `web/` unless noted, and citations were read in this checkout (`octoberBranch` at `0f8a09fff`). Companion files: [GAPS.md](GAPS.md), [DECISIONS-FOR-TJ.md](DECISIONS-FOR-TJ.md) and [tooling/](tooling/).

## 1. The path from writer to consumer

Detailed game forecasts take **one shared path** to both consumers. The native catalog head does not change where they come from; it only selects the baseline and participation loaders (`lib/rosterScheduleData/planning.ts:62`, `:73-96`).

| Step | What happens | Where |
|---|---|---|
| 1. Write | A FORGE run (heuristic, Release C) writes `forge_runs` (`git_sha`, `metrics.horizon_games`) and `forge_{player,goalie,team}_projections`, keyed on `run_id, game_id, player_id, horizon_games`. | `lib/projections/queries/run-lifecycle-queries.ts:249-286`; `lib/projections/stages/persistence-stage.ts:12-40` |
| 2. Capture inputs | It stores the run input snapshot `forge-run-inputs-v1` in `player_forecast_source_observations`, with `codeVersion`, `modelMode`, `modelEnvironment`, `inputCutoff`, `decisionAsOf`, `capturedReads`, `issuedContexts`, `horizonGames` and `outputHash`. | `lib/projections/run-forge-projections.ts:509-532`; `lib/projections/gameRevisions.ts:153-166` |
| 3. Issue | `publish_forge_game_revisions` writes one **immutable** `forge_game_revisions` row per game: `id, run_id, game_id, slate_date, input_snapshot_id, decision_as_of, published_at, payload`. It does this only when `horizonGames === 1` and the run is `captured_live`. | `lib/projections/run-forge-projections.ts:545-547`; `supabase/migrations/20260916012353_starter_board_game_revisions.sql:7-23` |
| 4. Freeze | At puck drop, `forge_final_pregame_revisions(game_id, revision_id, scheduled_start_at, frozen_at)` pins the final pregame revision. It is also immutable. | `supabase/migrations/20260916023000_starter_board_release_control.sql:13-18`, `:48-52` |
| 5. Select | The `read_forge_game_revisions(p_slate_date)` RPC returns one revision per game. Precedence: the frozen pregame row, then the latest `forge_game_selection_events` row, then the latest by `(decision_as_of, published_at, id)`. It also returns a display-only `previousRevision`. | `supabase/migrations/20261004181455_forge_public_revision_reader.sql:7-27`; called at `lib/projections/gameRevisions.ts:194-198` |
| 6. Admit | `admitConsumerGameRevisions` → `publicPlanningForecasts` runs the identity checks in §2. The skater value is recomputed from the frozen row by `completeBoardSkaterStatsFromProjection` + `boardSkaterForecast`, and the row is excluded as `missing_participation` if it is conditional-only. | `lib/projections/consumerRevisionAdmission.ts:22-243`, `:167-173` |
| 7a. Start Chart | It serves admitted stats as `proj_shots` and `forecast.expected`, plus `gameRevisions[]` (`revisionId, runId, decisionAsOf, publishedAt, inputCutoff, calculatedAt, modelMode, codeVersion`). There is no use gate: admission hard-codes `allowedUses` to true. | `pages/api/v1/start-chart.ts:929-943`, `:1643-1663`, `:2126-2131`; `lib/projections/consumerRevisionAdmission.ts:121` |
| 7b. RSO | It mints one `RsoTargetUseBinding` per target and runs `restrictRsoForecast`. With `reviews: []` and null hashes, **every native or detailed target is denied** (`use_not_approved`). Only the interim bridge bypasses this, via `currentBridgeIsAuthorized`. | `lib/rosterScheduleData/planning.ts:198-226`; `lib/player-forecasts/rsoUsePolicy.ts:41-79`, `:94-136` |
| 7c. Planner | Contributions resolve per target (`resolveContribution`). The planner then reads `forecast.contributions[key].allowedUses`, else `targetAllowedUses`, else `allowedUses`. | `lib/player-forecasts/planningContributions.ts:38-259`; `lib/player-forecasts/contributions.ts:267-368`; `lib/rosterScheduleOptimizer/planning.ts:99-102` |

The native daily stack is a separate path: `scripts/forge-daily.ts` / `forge-daily-v2.ts` → `nativeDailyPipeline*.ts` → `scripts/native-baseline-cadence.ts` publish → `native_forecast_catalog_heads`.
- It issues **seasonal rate bundles and participation**, not detailed game revisions.
- Each stage is dry-run unless explicitly executed, and publish additionally needs `--approved-package-hash`: `scripts/native-baseline-cadence.ts:231-233`, `:256-283`; `lib/player-forecasts/nativeBaselinePublication.ts:119-120`; `lib/player-forecasts/nativeCatalogHead.ts:128`.
- Its rows carry their own owner-approved policy and review (`lib/player-forecasts/contributionStore.ts:190-226`), and RSO lets them keep that admission (`lib/player-forecasts/rsoUsePolicy.ts:114-131`).

## 2. Identity fields that must match

For each identity category, what the writer records, what admission checks, and what each consumer exposes. "—" means absent.

**Target**
- Writer / issued: `proj_shots_es/pp/pk` (and other heads) in `payload.players[]`.
- Admission: `stats` key `SHOTS_ON_GOAL` via `completeBoardSkaterStatsFromProjection`, `consumerRevisionAdmission.ts:167`.
- RSO: `forecasts[].stats.SHOTS_ON_GOAL`; `rsoTargetBindings[k].targetKey` (`planning.ts:208-216`).
- Start Chart: `proj_shots`, `forecast.expected.SHOTS_ON_GOAL` (`start-chart.ts:1647-1663`).

**Method**
- Writer / issued: `payload.modelMode` (`run-forge-projections.ts:515`).
- Admission: passed through; the external-fantasy input contract must match (`:88-90`).
- RSO: binding `modelMode` (`planning.ts:210`).
- Start Chart: `gameRevisions[].modelMode`.

**Code**
- Writer / issued: `payload.codeVersion` = `FORGE_CODE_VERSION ?? VERCEL_GIT_COMMIT_SHA ?? GIT_SHA` (`run-forge-projections.ts:436`).
- Admission: `modelVersion = payload.codeVersion` (`:126`).
- RSO: `forecasts[].modelVersion`; binding `codeVersion`.
- Start Chart: `gameRevisions[].codeVersion`.

**Configuration / artifact**
- Writer: `modelEnvironment` (8 env flags) exists only in the input snapshot (`run-forge-projections.ts:399-403`).
- Issued payload, admission and Start Chart: —.
- RSO: binding `configurationHash: null, artifactHash: null` (`planning.ts:213`), which **denies** the use (G1, G2).

**Cutoff**
- Writer / issued: `payload.inputCutoff`, `decision_as_of`, `published_at`.
- Admission: `cutoffAt = inputCutoff ?? decision_as_of` ≤ `published_at`; expiry = min(+36 h, start) (`:46-55`).
- RSO: `forecasts[].cutoffAt/issuedAt/expiresAt`.
- Start Chart: `gameRevisions[].inputCutoff/decisionAsOf/publishedAt`.

**Participation**
- Writer / issued: participation evidence in `payload.evidence` / `uncertainty`.
- Admission: `appearanceProbability`; a conditional-only row is excluded as `missing_participation` (`:167-173`).
- RSO: `startProbability`, `appearanceProbability`; binding `participationLineage = <revisionId>:participation` (`planning.ts:215`).
- Start Chart: `forecast.participationProbability`, `probabilityStatus`.

**Game / schedule**
- Writer / issued: `game_id`, `slate_date`, `issuedContexts[].schedule[].revision`, `game.startTime`.
- Admission: the issued context must equal the current schedule, roster revision and start (`:65-107`).
- RSO: `forecasts[].gameId`, `issuedContext`; manifest `scheduleRevision`, `rosterRevision`.
- Start Chart: `game_id`.

**Horizon**
- Writer / issued: `horizon_games` (row), `horizonGames` (snapshot).
- Admission: `horizon_games === 1`, and lead day < calendar policy (`:49-52`, `:150`).
- RSO: binding `horizonGames: 1`.
- Start Chart: implicit (h1 only).

**Lineage**
- Writer / issued: `input_snapshot_id` → snapshot; `capturedReads.hash`; `run_id`.
- Admission: `capturedReads` version, hash and count, with times ≤ `published_at`; `sourceWatermark = forge-captured-reads-v1:<hash>` (`:56-64`, `:119`). There is **no parent check** (G9).
- RSO: `revisionId`, `sourceWatermark`, manifest `issuedRevisionIds`.
- Start Chart: `gameRevisions[].revisionId/runId`; rows join on `game_id` (G7).

**Policy**
- Writer, issued payload and admission: —.
- RSO: `forecastManifest.rsoUsePolicy.{version, revision}` must equal `rso-review-before-use-2026-10-22-v1` (`rsoUsePolicy.ts:43`, `:97`).
- Start Chart: —.

## 3. Recommended first target

**Skater `SHOTS_ON_GOAL`, unconditional expected value, h1, from released `captured_live` FORGE game revisions, read through the shared revision path.** The claim is a Start Chart display claim plus RSO `totals` and `comparison`. RSO `assignment` and `conditionalTieBreak` stay denied until a second review.

Why this target:
- **One issued row feeds both consumers through the same RPC and the same admission** (§1 steps 5–6). One evidence capture qualifies both readbacks, and nothing new needs plumbing.
- **The issued record already exists and is immutable** (`forge_game_revisions` plus the frozen pregame pin). Original issuance is a database fact, not a reconstruction.
- **SOG is the best-behaved head.** It has the highest volume (about 2–3 per skater-game), so a 14-slate milestone settles thousands of player-games. It settles directly from `forge_player_game_strength.shots_es/pp/pk`. Release C credited the SOG slope moving from 0.78 to 0.99, which is retrospective and not a claim here. The PK head is the only unmodeled part and is small (G14). Goals and points have low counts and the PK gap; hits and blocks carry known bias; PPP is overpredicted.
- **The native path isn't the first target.** It issues rates and participation, not game lines; it has no code identity (G10); and its frozen participation method stops on Oct 27 (G11). It needs its own qualification.
- **Excluding `assignment`** keeps the first claim to aggregate totals and comparison. A wrong start/sit is costlier and needs calibration of the per-game ranking, not just mean accuracy.

Before evidence can even be checked, these must close (code, not this lane):
1. **G2.** The producer carries a declared `configurationHash` and `artifactHash` into the revision payload (DECISIONS D3).
2. **G1.** `planning.ts` binds those hashes instead of null.
3. **G3.** The review type gains `prospectiveEvidenceRef` and `ownerApprovalRef`, matching the native contribution store (DECISIONS D5).

Until (1) and (2) land, the checker reports `issued_incomplete: artifactHash` for every row. That is the honest result.

## 4. Evidence specification

Every slate in the evaluation needs three immutable pieces, captured in this order.

**E1. The originally issued row.**
- `forge_game_revisions` rows for slate date D, and the `forge_final_pregame_revisions` pin per game.
- Normalize each skater row to the checker's issued schema ([tooling/README.md](tooling/README.md)).
- `value.unconditionalMean` is the repo's own admission output on the frozen payload at the issuing `codeVersion` (G8). An offline `tsx` extractor runs it from `web/` on the saved JSON, with no network.
- Keep the raw JSON with its sha256.

**E2. Current positive readbacks in both consumers.**
- Capture them once per slate at T−60 min before the slate's first puck drop. Two captures:
  - Start Chart `GET /api/v1/start-chart?date=D&page_size=200`, all pages;
  - RSO `GET /api/v1/roster-schedule-optimizer/data?seasonId=S&startDate=D&endDate=D`.
- For each, record `observedAt`, the response sha256, `forecastSource`, `publishedForecastsEnabled` and the manifest/policy revision.
- A readback is **positive** when:
  - the consumer served the row;
  - every identity field it exposes equals E1;
  - the value is equal within 1e-4.
- For RSO, the readback also records `targetAllowedUses.SHOTS_ON_GOAL`. Before a review it must show denied; after one, exactly the reviewed uses. A use the review didn't grant fails.

**E3. Chronological settlement.**
- Read `forge_player_game_strength` for the slate's game ids at D+1 12:00 ET. Actual = `shots_es + shots_pp + shots_pk`, recorded with its `updated_at`, and the snapshot is kept.
- A row settles only when the actual was recorded after puck drop and after issue.
- A later repair creates settlement version 2. It never overwrites version 1.
- A player who didn't dress counts with actual = 0 in an unconditional claim, so the participation component is scored too. "Did not dress" is defined from the issued schedule, not inferred later.

**Chronology rules** (the checker enforces the first two):
- `cutoffAt ≤ issuedAt < scheduledAt`, and readback `observedAt ≥ issuedAt`.
- The checker only checks the slates and `scope.json` it is given. The rest is procedure: the evaluation scope (target, method, code, config/artifact hashes, population, metric, thresholds, looks) is frozen in `scope.json` and hashed **before the first slate's E1 capture**. Slates are scored only after all of their games settle, in date order.

**Release C block.** Oct 23–30 is **sealed** by default (`--sealed 2026-10-23..2026-10-30`).
- The checker fails with `sealed_outcome_present` if an outcome from that window is supplied.
- It counts sealed issued rows but never scores them.
- No E1, E2 or E3 read for those dates is in the read list below.
- Held variants (Task9, prior refit, DU/DUK) stay held. The scope binds the exact released `codeVersion` and configuration, so a held variant can't be scored as the claim.

## 5. Bounded read-only production reads (for TJ to approve later; NOT run)

Per slate D, after the Release C block, with sequential concurrency 1 and a stop on the first error:

| # | When | Read | Filters / columns | Rows | Requests |
|---|---|---|---|---|---|
| R1 | T−60 min | RPC `read_forge_game_revisions` | `p_slate_date = D` | 1 per game; at most the canary size (1–16, `lib/projections/starterBoardFlags.ts:22`) | 1 |
| R2 | T−60 min | `forge_final_pregame_revisions` | `game_id in (R1 ids)`; `game_id, revision_id, scheduled_start_at, frozen_at` | ≤16 (filled only at puck drop; re-read in R6) | 1 |
| R3 | T−60 min | `player_forecast_source_observations` | `id in (R1 input_snapshot_id)`; `id, dataset_key, available_at, payload_hash`, plus `payload->codeVersion, modelMode, modelEnvironment, inputCutoff` | ≤16 | 1 |
| R4 | T−60 min | Start Chart API GET | `date=D&page_size=200`, pages 1..n | n = ⌈skaters/200⌉ ≤ 3 | ≤3 |
| R5 | T−60 min | RSO data API GET | `seasonId=20262027&startDate=D&endDate=D`, no nonce | 1 response (server fan-out: about 4 input reads, 1 RPC, news ≤5000, baseline/participation ≤12, ownership/form) | 1 |
| R6 | D+1 12:00 ET | `forge_player_game_strength` | `game_id in (R1 ids)`; `game_id, player_id, team_id, shots_es, shots_pp, shots_pk, updated_at` | ≤ about 40 per game (≤640) | 1 |
| R6b | D+1 12:00 ET | `forge_final_pregame_revisions` | as in R2 | ≤16 | 1 |

- **Per slate:** at most 9 requests: 5 DB reads and up to 4 application GETs.
- **Pilot:** 1 slate, at most 9 requests, stopping once E1 + E2 + E3 are captured or any read fails.
- **P3 milestone:** 14 slates (≤126 requests, ≤56 of them app GETs). That exceeds the default 5-request smoke budget, so it needs its own approval.
- **Cost notes:**
  - R4 and R5 run Vercel functions; R5 is the heavier of the two.
  - There is no cron, ETL or recompute trigger, and no `forge-served-forecast-snapshot` call (that route writes).
  - R1–R3 and R6 are plain selects or a `stable security invoker` RPC.
  - None of this touches NST.
  - No secrets go in artifacts: responses are saved as JSON with any auth headers stripped.

## 6. Tooling

[tooling/check-readbacks.mjs](tooling/check-readbacks.mjs) is a plain Node ES module with no dependencies.
- It takes normalized issued rows, readbacks per consumer, optional settlement and the frozen scope.
- It reports coverage plus coded findings: `readback_missing`, `identity_mismatch`, `value_mismatch`, `readback_unissued`, `cutoff_after_issue`, `issued_after_puck_drop`, `sealed_outcome_present`, `settlement_before_game`, and others.
- Exit codes: 0 pass, 1 findings, 2 bad input.
- Self-tests: `node --test tooling/check-readbacks.test.mjs` passes 11/11 on synthetic fixtures. Nothing reads the network or a DB.

Not built yet (next step, in `web/`, after D3):
- the E1 extractor that runs the repo's admission functions on saved RPC JSON;
- the E2 normalizers from raw API JSON (field paths are in [tooling/README.md](tooling/README.md)).

## 7. Order of work

1. TJ decides D1–D6 ([DECISIONS-FOR-TJ.md](DECISIONS-FOR-TJ.md)).
2. Code lane: G2 producer hashes, G1 binding and G3 review fields, each with focused tests. Then release them with normal release authority, because the issuing `codeVersion` changes.
3. Freeze `scope.json` (code version, hashes, population, metric, thresholds, looks) and hash it. That hash goes into the eventual review's `prospectiveEvidenceRef`.
4. Pilot one slate (R1–R6), run the checker, and correct the extractor and normalizers only on identity or format grounds, never on outcomes.
5. Run the 14-slate milestone, scoring only in the predeclared looks.
6. If it passes, add one RSO review (`SHOTS_ON_GOAL`, totals + comparison, bound to the exact scope, with an `expiresAt`) and re-capture one positive RSO readback showing exactly those uses.
