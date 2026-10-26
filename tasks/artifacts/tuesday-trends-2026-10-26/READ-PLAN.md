# Tuesday Trends — production read plan (lane TT, NOT YET EXECUTED)

**Status:** No production read has been made. Everything below comes from the code: `web/lib/socialShare/trendSources.ts`, `TREND_LIMITS`, and the `*_COLUMNS` lists in `trends.ts`. Each statement is also exercised against fixture rows by `trendSources.test.ts`, whose recording fake client asserts:
- explicit columns;
- exact counts;
- pages under 1,000 rows;
- no projection tables;
- ≤ 16 statements per edition.

## Gate before any statement

1. **API.** `GET /api/v1/social-share/tuesday-trends` checks the method, the query-key allowlist and string types.
2. **Auth.** `requireSocialShareAccess` (unchanged) requires a bearer for a `social_editor`/`admin`; otherwise 401, with no read.
3. **Validation.** `loadScheduleShareSnapshot` validates `weekStart` (calendar date, supported season) and `selectedDates` (unique, in the week); otherwise 400, with no read.
4. **Schedule.** `getSchedule(weekStart)` runs the existing NHL `/schedule/{date}` call, the same one Monday makes. Trend sources are read **only** when the schedule edition is `ready`.
5. **Client and response.** All Supabase reads use the anon `public-client` (RLS, read-only grants). The response is `private, no-store, max-age=0`.

Below, `S` = edition season (e.g. 20262027) and `T` = New York date of `generatedAt`. `since` = T − 7.

## Round 1 (two independent streams in parallel)

| # | Table / filters / order | Columns | Row cap and paging | Expected rows |
|---|---|---|---|---|
| R1 | `rolling_player_game_metrics`<br>`season = S`, `strength_state = 'all'`, `game_date >= since`<br>order `game_date desc, player_id asc` (unique within the filter: PK is player_id+game_date+strength) | `player_id, team_id, season, game_id, game_date, strength_state, updated_at, season_games_played, points_avg_season, points_total_last5, points_total_last10, toi_seconds_avg_last5, toi_seconds_avg_season, toi_seconds_total_last5, pp_toi_seconds_total_last5, pp_toi_seconds_avg_season, sog_per_60_last5, sog_per_60_season, shot_attempts_per_60_last5, shot_attempts_per_60_season, ixg_per_60_last5, ixg_per_60_season, line_combo_slot, line_combo_group, pp_unit` (25; `points_total_last10` added in TT-3 for Recent Form, same statement) | 5,000 cap; exact count; pages of 1,000 (sequential); a count change between pages fails | ~32 teams × ~20 skaters × 3–4 games ≈ **2,000–2,800** (2–3 pages). Index `idx_rolling_player_game_metrics_contextual_lookup (season, strength_state, game_date DESC, …)` |
| O1 | `yahoo_player_ownership_history`<br>order `ownership_date desc` limit 1 | `ownership_date` | 1 row | 1 (latest date **D**; index `idx_yahoo_player_ownership_history_date`) |
| O2 | same, `ownership_date <= D − 5`<br>order `ownership_date desc` limit 1 | `ownership_date` | 1 row | 1 (comparison date **P**) |
| O3 | same, `ownership_date in (P, D)`<br>order `ownership_date asc, player_key asc` (PK) | `player_key, player_id, ownership_date, ownership_pct` | 6,000 cap; exact count; pages of 1,000 | 2 × players per Yahoo snapshot. **Unknown**: estimated 2 × 1,500–2,500 = 3,000–5,000 (3–5 pages) |

O1 → O2 → O3 run in sequence. The rolling stream runs alongside them.

## Round 2 (after round 1; PP chunks two at a time, then the map)

| # | Table / filters / order | Columns | Row cap and chunking | Expected |
|---|---|---|---|---|
| P1..Pn | `powerPlayCombinations`<br>`gameId in (≤ 25 ids)`<br>order `gameId asc, playerId asc` (PK) | `gameId, playerId, unit` | per chunk: 25 games × 40 = 1,000 cap, exact count; ids ascending; **2 chunks at a time** | game ids = latest + previous contiguous game of every current skater ≈ 50–65 games → **2–3 chunks**, ≈ 16–20 rows per game |
| M1 | `yahoo_nhl_player_map_read`<br>`yahoo_player_id in (≤ 150 values)`<br>order `yahoo_player_id asc, nhl_player_id asc` | `yahoo_player_id, nhl_player_id` | 2 × values cap, exact count | values = top 30 risers + top 30 fallers, each as player_key and bare Yahoo id: ≤ 120 → **1 statement**, ≤ 240 rows (≈ 60–120) |

M1 runs after the last PP chunk, so no more than 2 statements are ever in flight. P is skipped if R1 failed; M1 is skipped if O failed. The section then says why.

## Round 3

| # | Table / filters / order | Columns | Cap | Expected |
|---|---|---|---|---|
| N1 | `players`<br>`id in (≤ 100 ids)`<br>order `id asc` | `id, fullName, position` | rows = ids, exact count | shortlisted ids only. Each list is cut to its length + 5 slack: hot 10, cold 10, rates 3 × 8, deployment 2 × 9, movers 2 × 10 → ≤ **92** ids → **1 statement** |

## Round 4

| # | Table / filters / order | Columns | Cap | Expected |
|---|---|---|---|---|
| E1 | `rolling_player_game_metrics`<br>`season = S`, `strength_state = 'ev'`, `player_id in (≤ 8 ids)`, `game_date >= since`<br>order `player_id asc, game_date desc` (`idx_rpgm_player_date`) | `player_id, season, game_date, strength_state, toi_seconds_avg_last5, toi_seconds_avg_season` | 8 ids × 8 rows = 64, exact count | the shown deployment players only: ≤ 8 ids, ≈ 8–32 rows, **1 statement** |

## Totals per edition load

- **Statements:**
  - About 10 in the typical case: R1 ×3, O ×3–5, P ×2–3, M1, N1, E1.
  - At most about 18 if every cap page is used.
  - Nothing is retried; a failure fails that source closed.
- **Concurrency:** at most 2 statements in flight, in every round (`TREND_LIMITS.concurrency`). The fake client asserts the maximum.
- **Rows:** about 5,000–8,500 read in total. ≤ 37 players leave the server.
- **Writes:** none. Tables never touched: projection tables, BLSH, `goalie_start_projections`, NST.

## Against TJ's approved ceiling (READ-APPROVAL.md, 2026-10-26T15:23:10Z)

| Ceiling | This plan |
|---|---|
| ≤ 40 statements per run | ≤ ~18 (typical ~10) ✓ |
| ≤ 1,000 rows per statement | every page ≤ 1,000 ✓ |
| Concurrency 2 | 2 ✓ (asserted in `trendSources.test.ts`) |
| Approved tables: `rolling_player_game_metrics`, `powerPlayCombinations`, `yahoo_player_ownership_history` / `yahoo_players` timeline, `yahoo_nhl_player_map_read` | R1, E1, P, O1–O3, M1 ✓. **N1 reads `players` (id, fullName, position) — NOT in the approved list.** |
| Excluded: NHL/other upstreams | The capture script calls `loadTrendLayer` directly with `{ season, generatedAt }`, so it does not need the NHL schedule call |

**Open decision for N1 (names and positions):**
- (a) Approve `players` (`id, fullName, position`), with ≤ 100 ids in 1 statement. This is the recommended choice.
- (b) Read `nhl_player_name, mapped_position` from `yahoo_nhl_player_map_read` by `nhl_player_id`. That stays inside the ceiling, but any skater missing from the Yahoo map would drop out of hot/cold, rates and deployment.

Until this is decided, the capture must not run.

## Facts the genuine capture must confirm (offline assumptions today)

1. **Rolling row count** for the 8-day window (cap 5,000), whether goalies appear in `rolling_player_game_metrics`, and the time of the exact count (the anon statement timeout hit SS1-24 at 186 ids).
2. **Yahoo rows per ownership date** (cap 6,000 for two dates), and that **D** is today or yesterday (the staleness gate).
3. **`*_last5` = the player's last 5 games played**, and `points_avg_season × season_games_played` = season points. Cross-check with `goals_total_all + assists_total_all` on a few rows.
4. **PP coverage:** the share of window games with `powerPlayCombinations` rows. This sets how many deployment rows show "PP ?".
5. Whether `yahoo_nhl_player_map_read` resolves most top movers to a single NHL id.

## Proposed capture ticket (needs TJ approval via the chef)

- **Run:** one call of `loadTrendLayer` with a recording client, on a local, isolated, non-:3000 process, using the anon key.
  - Same bounds as above.
  - Concurrency ≤ 2.
  - Stop after one edition.
- **Save:**
  - (a) The `ShareTrendLayer` JSON: shown players only, already public names and teams.
  - (b) A statement log: table, filters, row count, duration and error code. No row contents beyond (a).
- **Then:** render the four cards offline from (a). No retries. No writes. No other routes.

## v2 — TT-4 sparkline reads (APPROVED by TJ 2026-10-26T19:08:43Z for editor page loads, READ-APPROVAL addendum 2; on by default; `SOCIAL_SHARE_TUESDAY_SPARKLINES=0` is the kill switch; not executed by Claude)

Two more read-only statements, issued after N1 (names), for the **listed** players only. They are sequenced so no more than 2 statements are ever in flight (`TREND_LIMITS.concurrency`).

| # | Table / filters / order | Columns | Cap and chunking | Expected |
|---|---|---|---|---|
| S1 | `rolling_player_game_metrics`<br>`season = S`, `strength_state = 'all'`, `player_id in (≤ 20 ids)`, `game_date >= T − 35`<br>order `player_id asc, game_date desc` (`idx_rpgm_player_date`) | `player_id, season, game_date, strength_state, season_games_played, points_avg_season, toi_seconds_avg_season, sog_per_60_shots_season, sog_per_60_toi_seconds_season, shot_attempts_per_60_shot_attempts_season, shot_attempts_per_60_toi_seconds_season, ixg_per_60_ixg_season, ixg_per_60_toi_seconds_season` (13) | per chunk: ids × 36 (one row per player per date over 36 dates) ≤ **720**, exact count, pages ≤ 1,000; 20 ids per chunk, 2 chunks at a time | listed skaters: Recent Form ≤ 10, deployment ≤ 8, rates ≤ 9 → ≤ 27 ids → **1–2 statements**, ≈ 27 × 12–16 games ≈ 330–430 rows |
| M2 | `yahoo_player_ownership_history`<br>`player_key in (≤ 10 keys)`, `ownership_date between P and D`<br>order `player_key asc, ownership_date asc` (PK) | `player_key, player_id, ownership_date, ownership_pct` | keys × 15 ≤ **150**, exact count | the 10 listed movers × 6 daily dates (P..D) ≈ **60 rows, 1 statement**. Skipped when D − P > 14 days |

**New totals per edition:**
- **Statements:** typical ≈ 14 (11 + S1 ×2 + M2), worst case ≈ 21, under the 40 ceiling.
- **Rows per page:** ≤ 1,000.
- **Concurrency:** 2.
- **Tables:** no new table; both are already approved. **Columns:** S1 adds 9 rolling columns not read before (season-to-date averages and per-60 components). None is in `ROLLING_DROPPED_COLUMNS`, and each is checked by `satisfies` against `database-generated.types.ts`.

**How sparklines are derived:**
- **Per-game values:** each game's value is the difference between contiguous rows' season-to-date values, or the row itself on game 1. Points are `points_avg_season × GP` (whole), TOI is `toi_seconds_avg_season × GP`, and rates are the season numerator and TOI component differences.
- **Gaps:** a missing row or value is a gap marker, never interpolated.
- **Consistency checks:** a series that disagrees with the row's own L5/L10 window (points sum, TOI average within 2 s, rate within 2%) is dropped.
- **Failure:** a failed S1/M2 read drops sparklines only. It never blocks a section ("Sparklines unavailable: …" is added to that section's reasons).

## v3: TT-10 rostered % on every tile (M3; PENDING TJ approval via the chef; no RC is built before it; not executed by Claude)

One more read-only statement, issued after N1 (names) and E1, before S1/M2, so no more than 2 statements are ever in flight.

| # | Table / filters / order | Columns | Cap and chunking | Expected |
|---|---|---|---|---|
| M3 | `yahoo_nhl_player_map_read`<br>`nhl_player_id in (≤ 27 ids)`<br>order `nhl_player_id asc, yahoo_player_id asc` | `yahoo_player_id, nhl_player_id` | ids × 4 ≤ **108**, exact count; 100 ids per chunk (`TREND_LIMITS.rosterChunk`) | the shown non-mover skaters (Hot/Cold ≤ 10, deployment ≤ 8, rates ≤ 9; ≤ 27 distinct ids) → **1 statement**, ≈ 27–54 rows |

- **No new ownership read.** O3 already holds every Yahoo ownership row at the latest date D, so the rostered % is looked up there through the M3 map. Movers use their own D value.
- **Chips need no read.** The line comes from the latest rolling row (R1). The PP unit comes from the `powerPlayCombinations` rows already read for that game (P).
- **Skips:** M3 is skipped when the ownership read failed. The tiles then show "—". A failed M3 read also shows "—" on every non-mover tile, and it never blocks a section.
- **Missing is never 0%.** A player with no single observation at D (no mapping, no row, a null value, or mapped ids that disagree) shows "—". When D is older than the ownership freshness limit, no tile shows a %, and the footer date is omitted.
- **New totals per edition:**
  - **Statements:** about 15 typical (v2's 14 plus M3) and about 22 worst case, under the 40 ceiling.
  - **Rows per page:** ≤ 1,000.
  - **Concurrency:** 2.
- **Tables and columns:** no new table and no new column. `yahoo_nhl_player_map_read` (`yahoo_player_id, nhl_player_id`) is already approved and read by M1.
