# L18 → Codex goalie-grid: Crease Shift source contract (2026-11-11)

Hand-over scope: `web/lib/socialShare/modules/creaseShift.ts`, `creaseShift.sources.ts`, `creaseShift.test.ts` (and `components/SocialShare/modules/CreaseShiftCard.tsx` if Codex names it). Readers that import these and stay L18/Chef-owned: `goaliePeriod.ts` / `.sources.ts`, `goalieGsax.ts` / `.sources.ts` (they call `readScheduledGames`, `reconcileSchedule`, `scheduleNights`, `notFinalReason`). Keep those exports and their meaning when editing.

## Functions
- `readScheduledGames(client, { season, from, through, limit })` → `ScheduledGame[]`, oldest first (date, id). Reads `games` (`seasonId`, `type = 2` regular season, date range), then `readFinalGameIds`. Bounded exact-count reads; over `limit` rows fails closed (throws).
- `readFinalGameIds(client, gameIds)` → `Set<number>`. Final-state predicate (rule 19): a game is final when stored `pbp_plays` holds **exactly one** `typedesckey = 'game-end'` row for its `gameid`. Same evidence as L5's team unit-TOI planner (`lib/rankings/teamUnitToiNightly.ts`). Chunks of 200 ids; more than 2 game-end rows per id on average fails closed.
- `reconcileSchedule(scheduled, reported)` → `ScheduleReconciliation` (pure).
- `scheduleNights(scheduled, reported)` → `NightCoverage[]` for `completeThrough` (pure): a night's observed team games are those final and reported.
- `notFinalReason(schedule, scope?)` → `string[]` reader reason when games lack a final state.
- `readCompletedTeamGames` / `readGoalieAppearances` (shared `goalieLedger.sources.ts`) are unchanged: one `wgo_team_stats` row per team game; one `wgo_goalie_stats` row per goalie appearance with `started` from `games_started` (official starter label; null = unknown).

## Fields
- `ScheduledGame = { id, date, homeTeamId, awayTeamId, final: boolean }`. `date` is the NHL schedule date in `games`. `final: false` = not proven final (not played, postponed, in progress or late PBP feed). It never means "did not happen" and is never a zero.
- `ScheduleGap = { team, gameId, date, reason: "unreported" | "not_final" }`. `unreported`: game is final but that team's WGO result is missing.
- `ScheduleReconciliation`:
  - `scheduledGames`, `finalGames` — counts of games.
  - `expected` = scheduledGames × 2 team games; `observed` = team games final **and** reported; `unreported`, `notFinal` (team games); `missing` = unreported + notFinal = expected − observed.
  - `complete` = no missing team game in the range.
  - `games` = reported team games whose game is scheduled **and** final: **the completed-team-game denominator**. A WGO row for a game without final evidence is not in it.

## Semantics for a consumer
- Completed games = `reconcileSchedule(...).games`. Use it, not raw `wgo_team_stats` rows or dates.
- Schedule completeness = `complete` plus the counts; show `missing` with its split, never fill it.
- Late newest nights: `completeThrough(scheduleNights(...), through)` trims trailing nights that are not fully final+reported (page note); an older gap leaves the post `partial` with reasons (`unreported` text and `notFinalReason`).
- Official starts: a game is resolved only with exactly one `started === true` appearance for that team (`teamStartShare`); relief never counts as a start.
- No production read has measured `pbp_plays` game-end coverage for this season yet. If PBP lags WGO, games show as not final (partial/trimmed), by design.
