import type { SlateGame } from "./slateQueue";

type ReadClient = { from(table: string): any };
/**
 * Read-only schedule for exactly these games: `games` (start, date, season) and `roster_optimizer_team_games` (status,
 * current start). Anything incomplete throws, so the queue keeps its last schedule instead of closing a game.
 */
export function scheduleReader(client: ReadClient, gameIds: number[], slateDate: string, signal?: AbortSignal): () => Promise<SlateGame[]> {
  return async () => {
    const gameQuery = client.from("games").select("id,date,seasonId,startTime").in("id", gameIds).order("id");
    const games = await (signal ? gameQuery.abortSignal(signal) : gameQuery);
    if (games.error) throw new Error(`schedule_games:${games.error.message ?? games.error}`);
    const gameRows = (games.data ?? []) as Array<{ id: number; date: string; seasonId: number; startTime: string }>;
    if (gameRows.length !== gameIds.length || gameRows.some((row) => !gameIds.includes(row.id) || Number.isNaN(Date.parse(row.startTime)))) {
      throw new Error("schedule_games_incomplete");
    }
    const seasons = [...new Set(gameRows.map((row) => row.seasonId))];
    if (seasons.length !== 1) throw new Error("schedule_mixed_seasons");
    const teamQuery = client.from("roster_optimizer_team_games").select("source_game_id,team_id,start_time,game_status,schedule_status")
      .eq("source_season_id", seasons[0]).in("source_game_id", gameIds).order("source_game_id").order("team_id");
    const teams = await (signal ? teamQuery.abortSignal(signal) : teamQuery);
    if (teams.error) throw new Error(`schedule_team_games:${teams.error.message ?? teams.error}`);
    const teamRows = (teams.data ?? []) as Array<{ source_game_id: number; team_id: number; start_time: string; game_status: string; schedule_status: string }>;
    return gameIds.map((gameId) => {
      const game = gameRows.find((row) => row.id === gameId)!;
      const rows = teamRows.filter((row) => Number(row.source_game_id) === gameId);
      if (new Set(rows.map((row) => row.team_id)).size < 2 || rows.some((row) => Number.isNaN(Date.parse(row.start_time)))) throw new Error(`schedule_team_rows_incomplete:${gameId}`);
      const gameStatuses = [...new Set(rows.map((row) => String(row.game_status ?? "").trim().toUpperCase()))];
      const scheduleStatuses = [...new Set(rows.map((row) => String(row.schedule_status ?? "").trim().toUpperCase()))];
      const status = game.date !== slateDate ? `MOVED:${game.date}`
        : scheduleStatuses.some((value) => value !== "OK") ? `SCHEDULE:${scheduleStatuses.join("|")}`
          : gameStatuses.length === 1 ? gameStatuses[0] : `MIXED:${gameStatuses.join("|")}`;
      const earliest = rows.map((row) => row.start_time).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
      return { gameId, slateDate: game.date, scheduledStart: game.startTime, currentScheduledStart: earliest, status };
    });
  };
}
