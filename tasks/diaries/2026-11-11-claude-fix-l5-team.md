# 2026-11-11 · Claude · fix L5b (team matrix and team unit TOI)

## Scope
Sub-session of L5 (lead: local_22efa1bd). Findings: W2-P0-10 / W1 P0 #2 (team xG source), W2-4 A1 (partial xG coverage), W2-6 §3 (team unit TOI overlap/completion), decisions 98/102 team side, decision 90 tied-team tests.
Owned: `web/lib/rankings/{teamMatrix,teamStyleMethodology,xgDenominatorSemantics,teamUnitToiBuilder,teamUnitToiNightly,teamUnitToiWriter}.ts` + tests, `web/components/Rankings/TeamMatrixTable.tsx`.

## Where
Branch octoberBranch, sole checkout. The existing committed `CLAUDE-FIX-L5-CLAIM-20261111` covers `web/lib/rankings/**`. Paused at the usage limit, then resumed on the lead's request.

## State / checks (resumed run)
- Implemented: NST-only team style and a ledger with matched coverage; `min_gp` floor (default 5; `meta.sampleFloor`); the style badge returns "Insufficient data" on missing inputs; unit-TOI interval union, one-goalie 5v5 rule (a goalie gap marks rows partial), unit-semantics metadata; shared completion predicate (loader now needs a top forward line and a top defense pair for both teams); final state from PBP `game-end` (exactly one).
- Failing-before proof (HEAD copy of each module, temp files deleted): teamMatrix 9 tests fail on HEAD; builder 3; nightly 4. All pass now.
- Vitest: 9 files, 76 tests pass (owned + comparison + GoalieTeamMatrixTable + update-team-unit-toi route test).
- eslint on 8 changed files: exit 0.
- `npm run typecheck`: exit 2. The only errors are 2 in `__tests__/pages/rankings.test.tsx` (GoalieMatrixRequest `strength`, `fhfh_5v5_bad_start_rate`), from the goalie sub-session's uncommitted goalieMatrix.ts. New team fields are optional so other fixtures still compile.
- `__tests__/pages/rankings.test.tsx` "wires matrix sorting…" fails on the skater percentile explainer text (lead's decision 90 area, not team code).

## Next
Commit, then report to the lead.

## Blockers / approvals
Production steps: a `team_unit_toi` season rebuild (TJ approval) so stored rows get the union and goalie fixes. Nightly behaviour change: games without a stored PBP game-end stay pending (`awaitingFinalState`).

## Insights
- No final-state column on `games`; `pbp_plays` `game-end` is the finality evidence.
- `xgDenominatorSemantics.ts` has no runtime importers; left unchanged.
