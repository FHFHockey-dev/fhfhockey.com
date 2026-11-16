# F12 — Astra AF-01 (P0): RSO FORGE goalie bridge adopts the per-candidate contract

## Scope
- `web/lib/rosterScheduleData/forgeDailyBridge.ts` goalie path + its tests (forgeDailyBridge.test.ts, forgeReservePayload fixture).
- Consume `forge_goalie_projections.uncertainty.goalie_candidates` (`forge_goalie_candidates_v1`, `readGoalieCandidatesContract`, L9b 4eab7347d).
- No team-line borrowing, no L10/season share start vector, no W = team prob × decision share, no silent renormalisation. Keep W1 #28 (L/OTL null).
- Don't touch: modeledHeadTotals.ts (F7), goalie-stage/update-goalie-projections-v2/run-projection-accuracy/start-chart (Codex), opponentGoalieQuality/skater-stage (F13), goalieOutcomes/market-queries (F14).

## Where
- Branch octoberBranch, canonical checkout. Base HEAD 4046bbe92. Commit 738191ecf (bridge, test, payload fixture; not pushed). Commit a275d0ec7: F7's AF-05 label patch applied at Chef's request, plus es_definition marker select (version-aware PK admission).
- Hand-over: side-session-notes/<parent>/F12-report.md. Chef = parent session local_78a99adf (brief's local_016832c1 not found).

## Decisions / assumptions
- Contract games: each candidate's own if_starts line, start_probability and unconditional values; W = credited_win_prob (if starts / unconditional incl. relief).
- Absent candidate on a contract game: start unknown (labelled); his own reserve line if any is the conditional line; never a teammate's.
- Partial mass: listed candidates keep their P; unresolved mass stays unassigned and is counted in limitations.
- Games with no contract (not projected yet, or legacy rows): start chance unknown, own latest candidate line re-aimed as conditional only, W unknown. Assumption (safest, rules 5/13); flag to Chef.
- IFTTT news kept: confirmed → 1 / others 0; ruled out → 0 with freed mass left unresolved; likely/projected floors scale others down only.
- teamWin prefers the contract's team_win_probability.

## State
- 15:10 UTC: design done, implementing.
- ~15:20 UTC: implemented. Tests: rosterScheduleData/ 8 files 288/288 pass; 6 new AF-01 tests fail on HEAD bridge (temp copy, fed old L10 shares) and pass now. `npm run typecheck` exit 0; ESLint clean on 3 files.
- Production FORGE_PROJECTION_DAYS_AHEAD=6 (reported 10-26, codex horizon diary), so contracts cover today..+6; the no-contract path is the edge.
- a275d0ec7: rosterScheduleData/ 289 pass (bridge file 92/92); typecheck exit 0; ESLint clean.
- Payload fixture now carries a two-candidate contract per team-game; typical week expanded 5.75 MB (< 6 MB budget).

## Follow-ups
- DONE 6873c28ce (Chef/TJ approved, F12 owns laterImpactInputs.ts): VORP S3 goalie basis = each candidate's own if-starts line (conditional); absent/slot-only/partial labelled. rosterScheduleData/ 293 pass; 4 new tests fail on old code; typecheck 0; ESLint clean.
