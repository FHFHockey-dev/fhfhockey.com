# 2026-11-08 Claude — shift-ingest lane

## Scope
Phase 1 (code only, NO prod queries while team_unit_toi rebuild runs): fix the `nhl_api_shift_rows` writer so exact-content duplicates, off-game rows and truncated feeds can't be stored. Phase 2 (after Chef says rebuild done): size the repair with read-only SELECTs; pop-up TJ before any write/NHL request.

## Where
- octoberBranch, canonical checkout. Writer: `web/lib/supabase/Upserts/nhlRawGamecenter.mjs` (`fetchShiftCharts`, `fetchNhlApiRawGamePayloads`, `normalizeShiftRows`) → RPC `persist_nhl_api_gamecenter_normalized_v1` (game-scoped replace, key game_id+shift_id, prunes rows not in the scope).
- `web/pages/api/v1/db/shift-charts.ts` (brief's starting point) writes `shift_charts`, not `nhl_api_shift_rows`; it reads via `lib/projections/ingest/shifts.ts`, which already dedupes + validates gameId.
- Callers of `normalizeShiftRows`: `ingestNhlApiRawGame` (update-nhl-shift-charts / play-by-play routes), `persistCapturedGameNormalization` from `sweep-gamecenter-normalization.ts` (re-normalizes stored raw heads) and `ingest-projection-inputs.ts`.

## Root cause (code reading)
- `normalizeShiftRows` maps every payload row to `game.id` with no check of `shift.gameId` / `shift.teamId`, and no content dedupe. NHL publishes the same interval twice under distinct ids → stored twice. 565's raw payload labels all 2,179 rows 565 incl. VGK/SJS → only a team check catches it.
- `fetchShiftCharts` pagination trusts `total` and advances by pageSize with no consistency check (projection twin validates). Truncated/odd payloads are stored as-is; no coverage check vs PBP for final games.
- Upsert key is (game_id, shift_id) with prune → idempotent per payload, but duplicates have distinct shift_ids, so the key can't dedupe.

## Decisions
- Don't bump PARSER_VERSION / fingerprint: that would make the backfill selector + sweep re-normalize every game on the next cron (unapproved mass prod write). Existing bad rows are Phase 2.
- Off-game team / wrong gameId / truncated final feed → throw (before raw capture in the ingest path; in normalization for sweep/projection paths). Exact duplicates → drop, keep lowest shift_id.

## State / checks
- Done: `selectShiftRowsForGame` (gameId + home/away team check → throw; content dedupe player/team/period/start/end/typeCode keeping lowest id; final-game coverage: each team's last 517 shift per period within 10s of the period's last PBP event → else throw). Used by `normalizeShiftRows` and by `fetchNhlApiRawGamePayloads` before any raw capture. `fetchShiftCharts` pagination now refuses total drift / overshoot / short pages. d.ts export added.
- Tests: nhlRawGamecenter.test.ts 36/36 (new: 2026020019 dedupe, 565 mixed refusal, wrong gameId, 2025030411 truncation, no raw capture on mixed feed, pagination). 18 related suites 320/320. eslint clean.
- Reader list: side-session-notes/.../shift-ingest-readers.md (3 paged readers lack shift_id tiebreak: adjusted-impact, qot-qoc, playerStatsLanding Supabase path).

## Gotchas
- Effect on sweep: games whose stored raw head is corrupt (565, SCF G1) now fail normalization in sweep-gamecenter-normalization (reported as failures, no write) until Phase 2 replaces their heads.
- A persistently truncated NHL JSON feed for a final game now fails that game's ingest each run (visible failure) instead of storing it; no automatic HTML fallback for non-empty feeds.

- Phase 1 commit: 280e4ce00 (Chef verified).

## Phase 1b (TJ: "Yes, code-only now")
- Added `.order("shift_id")` tiebreak to the nhl_api_shift_rows paged reads in update-nhl-xg-adjusted-impact, update-nhl-xg-qot-qoc (fetchShiftRows now exported for tests) and playerStatsLandingServer (Supabase path). Sweep of every `.range(` over nhl_api_shift_rows / shift_charts: all others already end on shift_id or id.
- Tests: new __tests__/pages/api/v1/db/update-nhl-xg-shift-paging.test.ts (no route test existed) + a case in playerStatsLandingServer.test.ts; fake client flips tie order per page request. 1,500 tied rows → 1,500 unique with the fix, 1,000 unique without (verified by temporarily removing the tiebreak).
- Not changed (noted): qot-qoc limitGames game-id query orders by game_date only and limits shift ROWS, not games (picks few, arbitrary games); playerStatsLanding raw-payload reads order (game_id, fetched_at desc) without id.

## Next
typecheck → commit → report to Chef. Phase 2 waits for Chef "rebuild done"; it must also list the stored outputs of the three readers that a re-run would change.
