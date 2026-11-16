# Diary: fix lane L9a (FORGE skater path, context, uncertainty, markets) — 2026-11-11

## Scope
Brief `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L9a.md`. P0s: W1 #18 (PK bucket), #19 (hits/blocks PK twice), #21 (opponent goalie). Plus P1/P2 items in the brief. Chef = local_78a99adf.

## Where
octoberBranch, sole checkout. Claim appended to CLAUDE-TO-CODEX.md (CLAUDE-FIX-L9a-CLAIM-20261111). Codex mailbox tail checked: no Codex claim on L9a paths (Codex goalie-grid holds GameGrid UI + L9b goalie paths only).

## State
- Read brief, _COMMON, RULES-DIGEST, decisions 10,16,24-31,59,65,99,119, BC W1-6/W1-7, W2-1, W2-6, W3-4, side notes (L9b contract, L1 helpers/tickets).

- Split: dormant market items (D4b, D17, D18, W1-7 D6, W3-4 N2) to sub-session fix-l9a-markets (local_eeafec3d), files devig.ts, market-output-builders.ts, market-queries.ts, run-forge-projections.ts market block. Chef told.
- #18 + #19 done (uncommitted): new `calculators/skater-strength-buckets.ts`; stage fetches "pk" rolling rows, splits budget ES/PP/PK (PK share from forge_team_game_strength last10, shots_pk target), allocates PK by recent PK seconds (no row = unknown, 0 weight, labelled), PK conversion shrinks own PK record to his ES rates (labelled hypothesis, rule 12); physical rates applied once to bucket seconds (multiplier dropped on lineup path; reserve path is Codex's). Bootstrap, uncertainty (player+team), native accounting (pkMean, reportedAllStrengthMean), team goals all-situation, market inputs include PK. PK unknown -> pk cols null, ES = all non-PP time (labelled). EN: named bucket, mean null (in strength buckets, not estimated).
- Tests: `stages/skater-stage.strengthBuckets.test.ts` 4 stage tests fail on HEAD (pk null; hits .539 vs .451), pass now. 4 pinned tests updated (PK no longer unsupported; strength avg shape). lib/projections + readers: 104 files, 2218 pass.

- 9cf384ff4: #18, #19, #21 (opponentGoalieQuality.ts). Red on HEAD / green. typecheck 0, eslint 0.
- Second commit: A2 (matched seconds), D6 (NST xGA/60 x3600), D8 (WGO TOI seconds). Red on HEAD / green. lib/projections 1540 pass.
- STOPPED at usage limit (2026-11-11).

## 2026-11-12 resume (Chef order)
Commits: e5b0b11fb (L14 selector, goalie metadata per game, leagueSavePctCache), fe0b3d110 (xG registry audited), 6f94723d4 (exact nst_season, no future rows, C8 reader guard), 5f62c2f47 (A1/N1 bootstrap final line), 74b83d87e (M-FRG-017), 4e9c4371d (N2), 22242bcd8 (N3), 52d37ae12 (N4), 2c6b96176 (decision 26 inert), 8bc43a855 (W2-6 §1 classifier), 2b2c58a76 (D7).
Sent Chef: C8 successor-migration SQL need (L4a); D2 bounded forge_roster_events query (awaiting TJ approval/result).
D16: already fixed by L13b 902a28ac9; no change.
Checks: lib/projections 1557 pass; eslint 0 on changed files; typecheck exit 2, only other lanes' files (underlying-stats).
Gotcha: importing lib/xg/modelRegistry pulls new sources into FORGE's external-input audit test; run all of lib/projections before committing.

## Next (open)
- D2 roster events (decision 31): after the count read; scratch scoped to game id, injuries end on RETURN, "if he plays" line + 0 expected.
- D5 evidence weight: unit fix needs a joint refit of scale/thresholds/second shrink (model change; needs held-out evaluation) -> backlog unless Chef wants the fit run.
- D5 typical range (decision 29): exact mixture quantiles + coverage + PIT/interval score; sizable, needs stored issued distributions for evaluation.
- Backlog: decision 27, W3-4 N3-N5, EN estimator, held-out validation of #21 pass-through and PK priors.

## 2026-11-12 close
D2 done (0b7c8b04e; reach dormant: approved count = 0 rows/365 d). Codex proposal a357d348f (scratched reserve label). Ticket to Chef: tweet-pattern-review route must pass scratchGameId. Migration 137 (C8 guard) applied by Chef. Final report sent with all SHAs and the decision-26 release note. Backlog accepted by Chef: D5 refit, decision 29, decision 27, W3-4 N3-N5, EN estimator, held-out checks. Lane closed; diary can be retired once Chef records the debrief.
