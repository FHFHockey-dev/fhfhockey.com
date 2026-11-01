# Lane D receipt: Off-Night Edge (SS 6.0)

Post id `off-night-edge`, at `/social-share/posts?post=off-night-edge`.

## Subtasks

| Subtask | State | Evidence |
| --- | --- | --- |
| 6.1 [fixture] GP by day, top 16 by Week Score, weekly and rest of week | Done | `offNightEdge.test.ts` "6.1": parity with the Game Grid edition's own scores, recomputed score, order and day columns, candidates from each selection's teams, shared ranks and named cut teams, no order from an unready schedule |
| 6.2 [fixture] One F and one D under the ceiling, reasons, no filler | Done | "6.2": one F and no D with reason, boundary at the ceiling, no fill, availability, identity, sample, traded-team binding, non-regular games, partial coverage |
| 6.3 [fixture] Ownership states | Done | "6.3": stated 0% eligible, unknown excluded unless the setting includes it, some stale blocks export, most stale shows no card, no rows is missing |
| 6.4 [fixture] `OffNightEdgeCard.tsx` | Done | "6.4" renders the card to markup: GP by day, picks, 0%, `—`, gap reason, empty state, alt text. `git status` shows `targets.ts`, `mondayGrid.ts` and `score.ts` unchanged. Monday `schedule.test.ts` and `targets.test.ts` pass |
| 6.5 [real] Bounded read, current schedule edition rules | Done, with the limit below | Reads 1 to 3 |

## Checks

- `npx vitest run` on `offNightEdge`, `contract`, `server`, `schedule` and `targets` tests: passed, 77 tests (22 in `offNightEdge.test.ts`).
- eslint on all my files: clean.
- CSS-module pure check on `OffNightEdgeCard.module.scss` (sass, then `postcss-modules-local-by-default` in pure mode): passed.
- `npx tsc --noEmit`: no errors in my files.
- `npx playwright test e2e/social-share-schedule.spec.ts --list`: 2 tests discovered. **Not run in a browser**; that is the lead's at 13.0.

## Real reads

Project `fyhftlxokyjtpndbkfse`, Supabase MCP `execute_sql`, 2026-10-31. Every statement was a single `SELECT`. Nothing was written. No NST, Yahoo, NHL API or Vercel call was made.

| # | Statement | Tables read | Rows returned | Result |
| --- | --- | --- | --- | --- |
| 1 | Coverage aggregates: ownership null, zero and age; map ambiguity; loader row counts | `yahoo_players`, `yahoo_player_ownership_history`, `yahoo_nhl_player_map_read`, `wgo_skater_stats`, `games` | 1 (aggregate) | Passed |
| 2 | Regular-season games, 2026-10-26 to 11-01 | `games` | 47 sample rows | Passed |
| 3 | Pickup funnel by team and position for the 16 rest-of-week teams, 2026-10-10 to 10-30 | `wgo_skater_stats`, `yahoo_players`, `yahoo_nhl_player_map_read` | 43 (aggregates, no player rows) | Passed |

**Read 1.** 1,608 Yahoo rows, 757 null, 0 stated zero, minimum 1. All rows updated 2026-10-31 08:40, so none is stale. 0 null-ownership players have a history row, so `yahoo_players` alone loses nothing; the loader does not read `yahoo_player_ownership_history`. 0 Yahoo ids map to two NHL ids. Loader sizes: 5,435 skater rows and 151 games over 22 days, 1,608 Yahoo, 2,373 map rows.

**Read 2.** The 47 games ran through `buildScheduleSnapshot` and `offNightSchedule` in a temporary harness, since deleted, pinned to 2026-10-31T16:00Z. The edition was `ready` in both modes, and the results differ:

| | Rest of week | Weekly |
| --- | --- | --- |
| Counted games | 15 | 47 |
| Teams with games | 28 | 32 |
| Top of the order | EDM and OTT tied at 10.41 | CGY 18.49, EDM 18.48, WPG 14.41 |
| Teams cut by the top 16 while tied | 12 (rank 11) | 0 |

**Read 3.** Fewer candidates is real, not only a fixture case. Under the 50% default with the setting off, ANA and MIN have 0 eligible defensemen, from unavailable, unknown, over-ceiling and short-sample players. Every other team and position in the read has at least 1 eligible. No current skater has two Yahoo rows. A few per team have no Yahoo identity.

**Limit of 6.5.** Read 2 used `games`, not the NHL schedule API the loader calls, and derived status from the pinned time. Read 3 mirrors the loader's rules in SQL rather than running its code. **A full loader run needs about 10,000 rows and the NHL schedule call, beyond this lane's bound, so it is the lead's at the render step.** No real card has been rendered.

## Decisions for the lead to check

1. **Weekly counts the whole Monday to Sunday slate, played games included.** `selectScheduleDates` counts only future games, so a seven-day selection mid-week equals rest of week, which SS-R07 rules out. Weekly uses `calcWeekScore` with the same inputs, and tests prove it matches the edition's scores when no game has been played. The card's legend says "Full week, played games included".
2. **Pick rule:** best L5 fantasy points per game × TOI opportunity through `score.ts`, computed from `wgo_skater_stats` because rolling lacks week 1 (SOURCES). Line and PP unit are not read, so that part of the multiplier stays zero; the evidence sample says "× ice time".
3. **Sample rule:** the existing `MIN_SKATER_GAMES` (5 appearances, here within 21 days) and `RECENT_MAX_AGE_DAYS` (14), plus Yahoo status empty or DTD. These are fixed because CONTRACT lists no field for them. The active rule prints in the evidence sample.
4. **Top 16 ties:** exactly 16 rows are shown, and teams tied at the last rank are named in `evidence.cohort` and the alt text, not on the card. Late in a week this can be many (12 in read 2).
5. **An unready schedule gives no card at all,** including `partial`, because an untrusted edition publishes no order. Partial ownership or team-game coverage still previews, and cannot export.

## Blockers and notes

- None for this lane.
- **Fill pass (TJ, 2026-10-31):** the card now uses its own grid instead of `PostTable`, so rows share the body's height in equal `1fr` tracks and cannot leave a dead band. Off-night tint runs the full column. League games per day moved into the day headers. On-card text is one legend line (dates, shading, ceiling) plus the per-team gap reasons. Ownership counts and the pick rule moved to `evidence.sample`; tied teams moved to `evidence.cohort`; the alt text carries the cohort and games by day.
- By arithmetic only, not measured: about 50px per row at 16 rows, from the lead's 860px body, and about 250px per pick column on the weekly card. At 10 rows or fewer (a late-week rest-of-week post) type and logos enlarge. Layout at 1080 × 1080 has not been seen; the lead measures on real data.
- A postponed game stays in `games` with no status, so it would hold the post at `partial` until it leaves the 21-day window. The reason prints; Team Games has the same limit.

## Period control (Chef's ticket, seam at `884b4839d`)

Off-Night Edge is any-week and Team Games is past-only. Both use `shared/periodWindow.ts`.

- **Off-Night Edge options:** This week (the default, keeping the `dates` choice), Matchup week and Custom range. `dates=weekly` and `dates=rest-of-week` load as before, with no matchup read. Anything other than this week counts every game on its dates, played or not, as one horizon through `calcWeekScore`, using one NHL schedule call per Monday week touched.
- **Past dates:** the legend prints "Past dates: picks and ownership are current, not as of then". L5 form and Yahoo ownership are always today's. The alt text says the same.
- **Team Games options:** Recent days (the default), Matchup week and Custom range. `days=N` works as before, with no matchup read. A week under way counts through the last completed games and is labelled "so far". The read limits rose to 2,700 and 1,400 rows, because a custom range can cover the season.
- **Fit:** 14 day columns use a compact table. Custom ranges on Off-Night Edge stop at 14 days, because wider ones do not fit beside the picks. The longest week on the 2026 calendar is 14 days (read 4).

**Read 4.** 2026-11-01, Supabase MCP `execute_sql`, one `SELECT` on `yahoo_matchup_weeks`, 5 rows. Week 19 runs Feb 1 to Feb 14, 14 days; the other four rows are 7 days, all starting on a Monday.

**Checks.** Vitest on `offNightEdge` (29), `teamGames` (7), `PostStudio` (16), `server`, `contract`, `periodWindow` and `landingCatalog`: passed. `postedWeek.test.ts` has one failure on another lane's `stars-total` wording; its Off-Night Edge and Team Games rules pass. eslint on my files is clean. The pure check passed on both cards. `tsc`: no errors in my files, and `retainedBlsh.test.ts:134` as expected; other lanes' uncommitted files showed errors in the same run. Browser, `next dev` on port 3123 with a separate dist dir: `social-share-schedule.spec.ts` 5 passed and the `social-share.spec.ts` post library test 1 passed, all on fictional editions.

**Measured on a fictional 14-day card with 16 long rows:** no cell or table overflow, 0px dead band, minimum row 48px, legend 36px (two lines with the past label).

**Not run:** the real loader for a chosen matchup, which calls the NHL schedule API once per week touched. No real matchup card has been rendered.
