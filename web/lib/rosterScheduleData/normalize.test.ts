import { describe, expect, it } from "vitest";

import { ROSTER_SCHEDULE_UPSERT_CONFLICT } from "./constants";
import {
  mapGameDateToYahooWeek,
  normalizeNhlGameToTeamRows,
} from "./normalize";
import type { NhlScheduleGame, YahooMatchupWeekRow } from "./types";

const weeks: YahooMatchupWeekRow[] = [
  {
    id: 10,
    game_key: "477",
    season: "2026",
    week: 1,
    start_date: "2026-10-05",
    end_date: "2026-10-11",
  },
  {
    id: 11,
    game_key: "477",
    season: "2026",
    week: 2,
    start_date: "2026-10-12",
    end_date: "2026-10-18",
  },
];

function game(overrides: Partial<NhlScheduleGame> = {}): NhlScheduleGame {
  return {
    id: 2026020001,
    season: 20262027,
    gameType: 2,
    gameDate: "2026-10-05",
    startTimeUTC: "2026-10-06T00:30:00Z",
    gameState: "FUT",
    gameScheduleState: "OK",
    awayTeam: { id: 4, abbrev: "PHI" },
    homeTeam: { id: 3, abbrev: "NYR" },
    ...overrides,
  };
}

describe("roster schedule normalization", () => {
  it("maps both inclusive Yahoo matchup-week boundaries", () => {
    expect(mapGameDateToYahooWeek("2026-10-05", weeks)).toMatchObject({
      status: "mapped",
      week: { id: 10 },
    });
    expect(mapGameDateToYahooWeek("2026-10-11", weeks)).toMatchObject({
      status: "mapped",
      week: { id: 10 },
    });
    expect(mapGameDateToYahooWeek("2026-10-19", weeks)).toEqual({
      status: "unmapped",
      reason: "No inclusive Yahoo matchup week contains 2026-10-19.",
    });
  });

  it("rejects overlapping matchup weeks instead of choosing one silently", () => {
    expect(() =>
      mapGameDateToYahooWeek("2026-10-11", [
        ...weeks,
        { ...weeks[1], id: 12, week: 3, start_date: "2026-10-11" },
      ]),
    ).toThrow("Yahoo matchup weeks overlap");
  });

  it("normalizes one NHL game into deterministic away and home rows", () => {
    const rows = normalizeNhlGameToTeamRows({
      fetchedAt: "2026-08-29T12:00:00Z",
      game: game(),
      gameKey: "477",
      mapping: mapGameDateToYahooWeek("2026-10-05", weeks),
      sourceUrl: "https://api-web.nhle.com/v1/schedule/2026-10-05",
      yahooSeason: "2026",
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      team_id: 4,
      team_abbreviation: "PHI",
      opponent_team_id: 3,
      opponent_abbreviation: "NYR",
      home_away: "away",
      game_date: "2026-10-05",
      yahoo_matchup_week_id: 10,
      week: 1,
      is_countable: true,
    });
    expect(rows[1]).toMatchObject({
      team_id: 3,
      opponent_team_id: 4,
      home_away: "home",
    });
  });

  it("keeps stable conflict identity while a reschedule updates date and mapping", () => {
    const original = normalizeNhlGameToTeamRows({
      fetchedAt: "2026-08-29T12:00:00Z",
      game: game(),
      gameKey: "477",
      mapping: mapGameDateToYahooWeek("2026-10-05", weeks),
      sourceUrl: "source",
      yahooSeason: "2026",
    })[0];
    const rescheduledGame = game({
      gameDate: "2026-10-12",
      startTimeUTC: "2026-10-12T23:00:00Z",
    });
    const rescheduled = normalizeNhlGameToTeamRows({
      fetchedAt: "2026-09-01T12:00:00Z",
      game: rescheduledGame,
      gameKey: "477",
      mapping: mapGameDateToYahooWeek(rescheduledGame.gameDate, weeks),
      sourceUrl: "source",
      yahooSeason: "2026",
    })[0];

    expect(ROSTER_SCHEDULE_UPSERT_CONFLICT).toBe(
      "game_key,source_game_id,team_id",
    );
    expect([
      original.game_key,
      original.source_game_id,
      original.team_id,
    ]).toEqual([
      rescheduled.game_key,
      rescheduled.source_game_id,
      rescheduled.team_id,
    ]);
    expect(rescheduled).toMatchObject({
      game_date: "2026-10-12",
      yahoo_matchup_week_id: 11,
      week: 2,
    });
  });

  it("retains postponed and unmapped games but excludes them from calculations", () => {
    const postponed = game({ gameScheduleState: "PPD" });
    const postponedRow = normalizeNhlGameToTeamRows({
      fetchedAt: "2026-08-29T12:00:00Z",
      game: postponed,
      gameKey: "477",
      mapping: mapGameDateToYahooWeek(postponed.gameDate, weeks),
      sourceUrl: "source",
      yahooSeason: "2026",
    })[0];
    const outside = game({ gameDate: "2026-10-19" });
    const outsideRow = normalizeNhlGameToTeamRows({
      fetchedAt: "2026-08-29T12:00:00Z",
      game: outside,
      gameKey: "477",
      mapping: mapGameDateToYahooWeek(outside.gameDate, weeks),
      sourceUrl: "source",
      yahooSeason: "2026",
    })[0];

    expect(postponedRow).toMatchObject({
      schedule_status: "PPD",
      is_countable: false,
      mapping_status: "mapped",
    });
    expect(outsideRow).toMatchObject({
      yahoo_matchup_week_id: null,
      week: null,
      mapping_status: "unmapped",
      is_countable: false,
    });
  });
});

