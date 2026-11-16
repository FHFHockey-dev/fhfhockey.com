# L9b fix lane diary (FORGE goalie path, starters, Start Chart) — 2026-11-11

## Scope
Brief: tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L9b.md. P0 #16, #17 (conditional), #20; credited-start label; D24/N6 horizon; GSAA .900 readers; N1 null-rest guard; PR5 label; issuance; accuracy-job proposal (Codex-blocked).

## Where
Branch octoberBranch, sole checkout. HEAD at start ddf9c1669. Owned files all clean at start.

## Log
- Start: read _COMMON, brief, rules digest, decisions 10/25/28/40/60/63/66/112, BA W1-5, BC W1-6/W1-7, W2-8, W3-4.
- Codex mailbox: no claim on L9b files since 11-10 (Goalie Grid lane leaves L9b producers read-only). Claim CLAUDE-FIX-L9B-CLAIM-20261111 appended (commit with first commit).

- #17 serving branch (source + recorded TJ-approved flag read 10-26, CLAUDE-TO-CODEX:1232): no PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID -> legacy; STARTER_BOARD_SERVING_ENABLED='false'. Served start probability = goalie_start_projections.start_probability (Codex v2 writer: raw L10 share, logs <= game.date, .900 GSAA) through buildGoalieStarterMixtureRows in start-chart.ts:1539 with no B2B inputs.
- Design for #20: forge_goalie_projections PK (run_id, game_id, goalie_id, horizon) and ~12 readers in other lanes assume one stored row per team. Keep stored cardinality; write versioned per-candidate contract in uncertainty and serve per-candidate rows from /forge/goalies + GoalieRiskCard. Stored-row promotion = later cross-lane migration.
- Checkpoint 1 (credited start label from wgo_goalie_stats.games_started keyed by game id; lt cutoffs for rest split and QS; league SV% residual; closed 3-candidate vector via boundedSimplex; null rest -> no bucket). Tests failed on old code: pulled starter (reliever credited), unknown labels, rest-split lte, sum 1.00998, null->4_plus. Typecheck exit 2 only from other lanes (LineCombinations L8, draft-pro/draftDashboard/fantasy-projections). ESLint 0.
- Ticket to Chef: runProjectionV2.test.ts:2105 (L9a) pins null->4_plus.

- 266794115 checkpoint 1 (above). Mailbox commit also swept in L13/L22 claim lines appended after mine (append-only; told Chef).
- 4eab7347d checkpoint 2: goalie/goalieCandidates.ts contract forge_goalie_candidates_v1 written by the stage (all candidates, not only compute flag); stored row labelled team_goalie_slot_mixture; win/shutout no horizon scalar (old horizon-2 win 1.0808); /forge/goalies one row per candidate, slot rescale removed, legacy rows win withheld; GoalieRiskCard "Win if starts"; reserve value_basis; Start Chart goalieStartBasis l10_start_share + page labels; mixture rounding envelope n x 0.00005 (old zeroed .3334/.3334/.3333).
- Checks: 465 tests across 16 files, only failure runProjectionV2.test.ts:2105 (L9a, ticketed). ESLint 0. Typecheck exit 2, only L13 (DraftDashboard, draft-pro, useVORP) and L22 (game-predictions) WIP files.
- Codex proposals committed (accuracy job; v2 writer). Notes: side-session-notes L9b-goalie-candidates-contract.md, L9b-starter-refit-plan.md.

- b0a8bd244: Chef-granted runProjectionV2.test.ts:2105 now expects null (suite green).
- d2f9b2941: Chef-granted reader files (normalizers, GoalieContextPanel, FocusedSlateContext, SlateStripCard, FORGE.tsx goalie block): L10 start share labels, Win if starts + team win. New tests failed 5/5 on old readers. ESLint 0 errors (5 pre-existing img warnings). Typecheck exit 2 only L13 WIP.
- Status: closed pending Chef ack; production steps (a)-(d) queued for TJ by Chef.

## Next
None for L9b. Previously open: Open: frozen-start receipt (issuance), metadata builder horizon scaling (L9a ticket), start_probability label in non-owned readers (SlateStripCard, FocusedSlateContext, FORGE.tsx, GoalieContextPanel).

## Blockers / approvals
None yet.

## Insights

- Chef closed L9b (d2f9b2941 verified). Per TJ, L9b files handed to Codex goalie-grid lane (CLAUDE-FIX-L9B-HANDOFF-TO-CODEX-20261111). No further edits to those files. Diary kept until debrief.
