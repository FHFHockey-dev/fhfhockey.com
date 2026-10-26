import type { Page } from "@playwright/test";

// Fictional cached-schedule fixture for the "Top five team schedules" strip: real NHL abbreviations and ids (so
// lib/teamsInfo colours and local logos resolve), both sides of every game, and one coverage witness per date.
const TEAMS: Array<[string, number]> = [["NJD", 1], ["NYI", 2], ["NYR", 3], ["PHI", 4], ["PIT", 5], ["BOS", 6], ["BUF", 7], ["MTL", 8], ["OTT", 9],
  ["TOR", 10], ["CAR", 12], ["FLA", 13], ["TBL", 14], ["WSH", 15], ["CHI", 16], ["DET", 17], ["NSH", 18], ["STL", 19]];
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** Rows for every date from `first` to `last` inclusive. `busy` dates get 9 games (not an off-night); others 3. */
export function teamScheduleRows(first: string, last: string, fetchedAt: string, busy: string[] = [], seasonId = 20262027, gameKey = "fixture-2026") {
  const rows: Record<string, unknown>[] = [];
  let gameId = 9000;
  for (let date = first, day = 0; date <= last; date = shift(date, 1), day++) {
    const count = busy.includes(date) ? 9 : 3;
    // Rotate pairings so the top five differ by day and every team sees varied opponents.
    const order = TEAMS.map((_, index) => TEAMS[(index + day * 3) % TEAMS.length]);
    const pairs = Array.from({ length: count }, (_, index) => [order[index * 2], order[index * 2 + 1]] as const);
    const ids = pairs.map(() => ++gameId);
    const witness = { version: "nhl-source-days-v1", date, gameIds: ids, emptyDates: [] as string[] };
    pairs.forEach(([home, away], index) => {
      for (const [team, opponent, side] of [[home, away, "home"], [away, home, "away"]] as const) rows.push({
        game_date: date, source_season_id: seasonId, game_key: gameKey, game_type: 2, source_game_id: ids[index],
        team_id: team[1], opponent_team_id: opponent[1], team_abbreviation: team[0], opponent_abbreviation: opponent[0],
        home_away: side, is_countable: true, start_time: `${date}T23:00:00Z`, fetched_at: fetchedAt,
        game_status: "FUT", schedule_status: "OK", source_metadata: { scheduleCoverage: witness } });
    });
  }
  return rows;
}

export async function routeTeamSchedule(page: Page, first: string, last: string, fetchedAt: string, busy: string[] = []) {
  await page.route("**/api/v1/roster-schedule-optimizer/schedule?**", route => route.fulfill({ json: { success: true,
    data: { version: "roster-team-games.v1", games: teamScheduleRows(first, last, fetchedAt, busy) } } }));
}
