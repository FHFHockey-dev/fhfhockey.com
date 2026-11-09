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

## Phase 2 sizing (Chef "rebuild done" ~02:20 UTC 11-09; read-only SELECTs, project fyhftlxokyjtpndbkfse)
Queries (written before running):
- Q1 dup groups by season: with g as (select season_id, game_id, count(*) n, min(shift_id) from nhl_api_shift_rows where season_id in (20252026,20262027) group by season_id, game_id, player_id, team_id, period, start_time, end_time, coalesce(type_code,-1) having count(*)>1) select season_id, count(distinct game_id) games, sum(n-1) extra_rows from g group by 1;
- Q2 off-game team rows: select s.season_id, s.game_id, s.team_id, count(*) from nhl_api_shift_rows s join games g on g.id=s.game_id where s.season_id in (20252026,20262027) and s.team_id not in (g."homeTeamId", g."awayTeamId") group by 1,2,3;
- Q3 565 + 2025030411 profile: per game/team/period count + max(end_seconds); plus games home/away/date; plus raw shiftcharts head metadata (id, payload_hash, fetched_at, source) for both.
- Q4 dup game id list (for files): select distinct game_id ... from Q1 groups order by game_id.
- Q5 downstream presence: counts in nhl_xg_qot_qoc_{player,unit}_game_features, nhl_xg_adjusted_player_impacts (by version), derived player summary rows and team summary rows for the affected games.
- Sizing done (~02:40 UTC; all read-only, 19 conns). Also ran: status/head coverage of dup games; table columns; downstream counts (impacts, team_underlying_stats_summary, derived player summaries, team_unit_toi snapshot 2026-11-08). Results + plan: side-session-notes/<chef>/shift-ingest-phase2-plan.md; lists: shift-ingest-dup-games.txt.
- Key: 2025-26 has no normalization status (legacy) → SQL delete; 2026-27 normalized → RPC re-normalize. 565 needs no NHL (753 deduped NJD/BUF rows cover full periods). SCF G1 = 2 NHL HTML requests. QoT/QoC tables absent in prod.
- Next: wait for Chef approval of the plan. No writes / NHL requests yet.
- ~02:55 UTC Chef approved steps 1–5 under amnesty. I'm treating that as a peer approval: read-only parts now, writes wait for TJ's own go-ahead in this session (pop-up).
- Step 1 backup DONE (REST; direct DB host doesn't resolve): side-session-notes/<chef>/backup-shift-repair-2026-11-09/ + manifest.json. Rows: a dup 1,795 (2fc7289f…), a 565 off-game 676 (f4bbb691…), b dup 496 (69dfbb47…), b status 89 (6b93afb6…), c 030411 shifts 612 (33e437c3…), roster 40 (54a2951c…), events 342 (55a29969…), heads 4 (e0be464f…), status 0. Per-game mismatches: none. shasum re-verified.
- Step 3 dry run: 89/89 ok (roster/events unchanged, shifts = current minus backup dups, prune 496). Step 4 PBP part: 030411 roster 40 / events 342 unchanged. The HTML shift part needs the 2 NHL requests → after go-ahead.
- Step 2 SQL ready (one DO block; raises unless 1,795 + 676 deleted). Scripts in scratchpad/shiftrepair/ (backup.mjs, dryrun3.mjs, dryrun4-pbp.mjs).
- 02:44 UTC TJ pop-up: "Run steps 2–5". The step-2 SQL was declined twice by the Supabase tool (nothing written). Asked about a REST route; TJ: "just give me a SQL snippet to run." Snippet: side-session-notes/<chef>/shift-repair-step2.sql (self-checking DO block + readback). Steps 3–4 aren't pure SQL (writer RPC + HTML fetch) → asked TJ.
- TJ pop-up: steps 3–4 "You run them by script" after TJ confirms step 2. Scripts ready (scratchpad/shiftrepair): run3.mjs (89 RPCs, 2 s apart, re-diff per game, stop if receipt prune ≠ backup dups or roster/events pruned), run4.mjs (2 NHL HTML requests 5 s apart, no retries, strict parse + coverage + roster/events check before any write; run ONCE with --write). Waiting for TJ: "step 2 done".
- 02:54 UTC TJ ran step 2: readback 1,052,617 / 753 / 2 / 0. Step 3 started (24 conns).
- 02:55 UTC Step 3 STOPPED at its first RPC (2026010008): NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH, nothing written. Cause: the RPC requires shift scope rows == jsonb_array_length(raw shiftcharts head data) (migration 20260722010355 l.720). 280e4ce00's normalizeShiftRows dedupe breaks that for every game with NHL duplicates. LIVE since #418; no game ingested since (last 00:25 UTC; 2026020279–282 pending).
- HOTFIX: normalizeShiftRows validates via selectShiftRowsForGame but maps every raw row again (row parity). Tests 37/37 + 10 related suites 145/145, eslint 0, typecheck 0. Real dedupe at storage = follow-up (dedupe the raw payload before capture, or change the RPC).
- Gotcha: the 2025-26 rows deleted in step 2 would come back if one of those games were re-normalized through the RPC from its raw head (the heads still contain the duplicates).
