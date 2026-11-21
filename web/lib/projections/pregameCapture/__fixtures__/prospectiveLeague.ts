import { forecastCalendarDate } from "lib/player-forecasts/contributions";
import { buildLeague, TARGET } from "./world/league";

/** Keep every source date relative to the synthetic slate, while SQL supplies the real publication time. */
export function prospectiveLeague(codeVersion: string, gameId = TARGET.gameId, startMs = Date.now() + 80 * 60_000) {
  const scheduledStart = new Date(startMs).toISOString();
  const slateDate = forecastCalendarDate(scheduledStart)!;
  const dateShift = Date.parse(slateDate) - Date.parse(TARGET.slateDate);
  const instantShift = startMs - Date.parse(TARGET.startTime);
  const world = buildLeague();
  for (const rows of Object.values(world.tables)) for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (value === TARGET.gameId && ["id", "game_id", "gameId", "source_game_id"].includes(key)) row[key] = gameId;
      if (key === "game_key" && typeof value === "string") row[key] = value.replace(String(TARGET.gameId), String(gameId));
      if (typeof value !== "string") continue;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) row[key] = new Date(Date.parse(value) + dateShift).toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value)) row[key] = new Date(Date.parse(value) + instantShift).toISOString();
    }
  }
  for (const [index, row] of world.tables.roster_optimizer_team_games.entries()) {
    Object.assign(row, { id: index + 1, game_date: slateDate, game_type: 2, is_countable: false,
      source_metadata: { scheduleCoverage: { version: "nhl-source-days-v1", date: slateDate, gameIds: [gameId],
        emptyDates: [-1, 1].map(day => new Date(Date.parse(slateDate) + day * 86400000).toISOString().slice(0, 10)) } },
      home_away: row.team_id === TARGET.homeTeamId ? "home" : "away" });
  }
  const players = new Map(world.tables.players.map(row => [row.id, row]));
  for (const identity of world.tables.fhfh_player_identities) {
    const player = players.get(identity.nhl_player_id)!;
    Object.assign(identity, { canonical_name: player.fullName, canonical_position: player.position });
  }
  return { world, request: { gameId, slateDate, scheduledStart, codeVersion } };
}
