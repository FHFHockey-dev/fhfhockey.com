# `powerPlayCombinations` writer fix (2026-11-01)

## Root cause

The penalty-length hypothesis is confirmed as one cause of five. All five sit in `getPowerPlayBlocks`, which treated each penalty as a power play instead of tracking manpower.

| # | Cause | Evidence, slate of 2026-10-31 |
|---|---|---|
| 1 | Goals never ended a penalty: it reads `play.period`, and the play-by-play has no such field. ShiftChart adds the field before calling it; the writer did not. | 0 of 331 plays in OTT-SJS carry `period`. |
| 2 | Misconducts counted as power plays, and were netted against other penalties. | OTT-SJS P2 11:38: an OTT bench minor against an SJS misconduct gave OTT an 8:00 power play. EDM's total was 1,380s, true 591s. |
| 3 | Any two penalties at one stoppage were treated as coinciding, even from the same team, and only the first two were read. | SJS's two minors at P3 03:46 were a real 5-on-3 and gave OTT no time. |
| 4 | Blocks overlapped, so 5-on-3 was summed twice in the team total, and 4-on-4 was counted for both teams. | Team totals, `pp_share_of_team`. |
| 5 | Nothing stopped at game end: a late penalty's block ran past it. | Team totals. |

Separately, the table's key is game and player, and the writer only upserted. A player who loses all PP time keeps the old row, so the fix also has to delete.

## Match rate against NHL.com PP TOI

Within 2 seconds of `wgo_skater_stats.pp_toi`, per skater. Four games, 144 skaters. The old code replayed offline reproduces the stored `PPTOI` exactly on 117 of 117 rows with time.

| Team | Old | New | Old team total | New team total | NHL.com high |
|---|---|---|---|---|---|
| OTT | 1/18 | 18/18 | 600 | 240 | 174 |
| SJS | 3/18 | 18/18 | 240 | 360 | 199 |
| EDM | 1/18 | 18/18 | 1,380 | 591 | 466 |
| NYI | 8/18 | 18/18 | 600 | 480 | 334 |
| CHI | 8/18 | 18/18 | 360 | 251 | 242 |
| BOS | 18/18 | 18/18 | 360 | 360 | 273 |
| NSH | 8/18 | 18/18 | 360 | 262 | 191 |
| TBL | 18/18 | 18/18 | 360 | 360 | 307 |
| **All** | **65/144 (45%)** | **144/144 (100%)** | | | |

Games: 2026020222 OTT-SJS, 2026020220 EDM-NYI, 2026020217 CHI-BOS (overtime), 2026020219 TBL-NSH (shootout). NHL requests: 13 (1 schedule, 3 per game). Read-only. The other 6 games of the slate were not compared, and neither was any other date, including playoffs.

## Units

No change to the definition. `sortByPPTOI` does not rank by time: it takes the top player as pivot and fills the unit with those who shared the most PP time with that pivot. With correct time that matches real deployment, checked against the most-used exact five on the ice:

- Unit 1 held the team's most-used five in 8 of 8 teams.
- Unit 2 held the next five in 5 of 8 teams, and 4 of 5 players in the other 3.

Time alone cannot express every real unit. Giroux played on both Ottawa units, and Halliday's 54s came with PP1 in place of him. Halliday is unit 3 and Pinto, with 3s alongside PP2, fills unit 2. That is the one visibly odd slot in the 8 teams, and it is left as is: a floor would be a new rule resting on one case.

## Consumers

Every reader found with `rg` was read for how it uses the rows. None needs a code change. Tests passed for those marked with a test.

| Reader | Uses | Result |
|---|---|---|
| Role Watch, Last Nights Standouts, What Changed (`socialShare/trends.ts`, tested) | `unit` | A missing row reads as off the PP when the game has rows, and unknown when it has none. A team with no PP in a game whose opponent had one reads off the PP, which is true. |
| Lane B "PP —" contradiction rule (tested) | `unit` against NHL.com | Unchanged, and should fire less after the backfill. |
| `PowerPlayCombos` (tested) | `unit`, `PPTOI` | Reads rows as they are. |
| Rolling metrics and PP share contract (tested) | `PPTOI`, `pp_share_of_team`, usage fields | Share becomes truthful. Rolling rows hold old values until rebuilt. |
| `team_unit_toi` builder (tested) | `unit`, `PPTOI` | Sums rows. Holds old values until rebuilt. |
| `rosterScheduleData/planning.ts` (tested) | `unit` | Reads rows as they are. |
| `player_lineup_deployment_tallies`, `vw_pp_unit_share_recent` | `unit`, `PPTOI`, `percentageOfPP` | SQL reads rows as they are. Tallies hold old values until refreshed. Not run. |
| `trendsDebug`, validation scripts, `featureDictionary`, `cron-report`, forge pipeline | labels and freshness | No value logic. |

Other users of `getPowerPlayBlocks`:

- `LinemateMatrix` PP view and ShiftChart shading now show true manpower. ShiftChart and LinemateMatrix tests passed; neither page was opened.
- `pp_timeframes` keeps its old behaviour exactly, through the renamed `getPenaltyPowerPlayBlocks`, because it needs one entry per penalty. That table therefore still carries causes 2 to 5. It is a follow-up, not fixed here.

## Backfill plan (TJ runs it; nothing has been run)

Stored rows stay wrong until this runs. Needs the fix on the host that runs the route, so run it from local dev or after release.

**Bounds.** `GET /api/v1/db/update-power-play-combinations?startDate=…&endDate=…`, one calendar day per call, one call at a time. The route runs all games in its range at once, so do not give it a wide range. Each game costs 3 NHL requests (shifts, boxscore, play-by-play), plus the shift-report fallback when JSON shifts are empty. No NST or Yahoo calls. Each game writes one upsert and one delete, and row counts will drop where stale rows go.

| Phase | Scope | Games | Rows today | NHL requests |
|---|---|---|---|---|
| 1 | 2026-27, game IDs from 2026020000 | 226 | 6,366 | about 678 |
| 2, optional | 2025-26 | 1,447 | 40,498 for phases 2 and 3 together | about 4,341 |
| 3, optional | Before 2025-26 | 97 | | about 291 |

Phase 1 alone corrects this season's cards. Whether to run 2 and 3 depends on how far back rolling baselines and Role Watch reach. Stop on a failed day and inspect it before going on.

**Check after the first day.** Compare with the query below for 2026-10-31. Expect close to 100% against today's 112 of 268.

```sql
select count(*) filter (where abs(c."PPTOI" - w.pp_toi) <= 2) as matched, count(*) as total
from "powerPlayCombinations" c
join games g on g.id = c."gameId"
join wgo_skater_stats w on w.player_id = c."playerId" and w.date = g.date
where g.date = '2026-10-31';
```

**Then rebuild what is derived, for the same dates:** `update-rolling-player-averages`, `update-team-unit-toi` and `update-lineup-deployment-tallies`. Check each route's own bounds first: this plan has not sized them.
