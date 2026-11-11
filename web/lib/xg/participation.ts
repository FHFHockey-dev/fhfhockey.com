import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database-generated.types";
import type { XgAggregateGameRow, XgParticipationRow } from "./aggregates";

const PAGE_SIZE = 1000;

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

type GameScheduleRow = {
  id: number;
  seasonId: number | null;
  date: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  type: number | null;
};

function toAggregateGame(row: GameScheduleRow): XgAggregateGameRow {
  return {
    id: Number(row.id),
    seasonId: typeof row.seasonId === "number" ? row.seasonId : null,
    date: row.date ?? null,
    homeTeamId: typeof row.homeTeamId === "number" ? row.homeTeamId : null,
    awayTeamId: typeof row.awayTeamId === "number" ? row.awayTeamId : null,
  };
}

/**
 * The predicted games plus every game of the same seasons and game types
 * played up to the last predicted date. Team rolling windows count these
 * games; one without complete predictions leaves its windows unknown.
 */
export async function fetchXgSeasonGames(
  supabase: SupabaseClient<Database>,
  gameIds: number[]
): Promise<XgAggregateGameRow[]> {
  if (gameIds.length === 0) return [];
  const byId = new Map<number, GameScheduleRow>();

  for (const chunk of chunkRows(Array.from(new Set(gameIds)), 200)) {
    const { data, error } = await supabase
      .from("games")
      .select("id,seasonId,date,homeTeamId,awayTeamId,type")
      .in("id", chunk);

    if (error) {
      throw new Error(`Failed to fetch games for xG aggregates: ${error.message}`);
    }
    for (const row of (data ?? []) as GameScheduleRow[]) byId.set(Number(row.id), row);
  }

  const predicted = Array.from(byId.values());
  const seasonIds = Array.from(new Set(predicted.map((row) => row.seasonId).filter((id): id is number => typeof id === "number")));
  const gameTypes = Array.from(new Set(predicted.map((row) => row.type).filter((type): type is number => typeof type === "number")));
  const maxDate = predicted.map((row) => row.date ?? "").sort().at(-1);
  if (seasonIds.length > 0 && gameTypes.length > 0 && maxDate) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("games")
        .select("id,seasonId,date,homeTeamId,awayTeamId,type")
        .in("seasonId", seasonIds)
        .in("type", gameTypes)
        .lte("date", maxDate)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        throw new Error(`Failed to fetch the season schedule for xG aggregates: ${error.message}`);
      }
      if (!data?.length) break;
      for (const row of data as GameScheduleRow[]) byId.set(Number(row.id), row);
      if (data.length < PAGE_SIZE) break;
    }
  }

  return Array.from(byId.values()).map(toAggregateGame);
}

/** Skaters on a game's boxscore (dressed) and goalies with time in net. */
export async function fetchXgParticipation(
  supabase: SupabaseClient<Database>,
  games: XgAggregateGameRow[]
): Promise<{
  players: XgParticipationRow[];
  goalies: XgParticipationRow[];
}> {
  const gameById = new Map(games.map((game) => [game.id, game]));
  const players: XgParticipationRow[] = [];
  const goalies: XgParticipationRow[] = [];
  for (const chunk of chunkRows(games.map((game) => game.id), 100)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("forge_player_game_strength")
        .select("player_id,game_id,game_date,team_id")
        .in("game_id", chunk)
        .order("game_id", { ascending: true })
        .order("player_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to fetch skater participation: ${error.message}`);
      if (!data?.length) break;
      for (const row of data) {
        const game = gameById.get(Number(row.game_id));
        players.push({
          entity_id: Number(row.player_id),
          game_id: Number(row.game_id),
          game_date: game?.date ?? row.game_date ?? null,
          season_id: game?.seasonId ?? null,
          team_id: row.team_id ?? null,
        });
      }
      if (data.length < PAGE_SIZE) break;
    }
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("forge_goalie_game")
        .select("goalie_id,game_id,game_date,team_id,toi_seconds")
        .in("game_id", chunk)
        .gt("toi_seconds", 0)
        .order("game_id", { ascending: true })
        .order("goalie_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to fetch goalie participation: ${error.message}`);
      if (!data?.length) break;
      for (const row of data) {
        const game = gameById.get(Number(row.game_id));
        goalies.push({
          entity_id: Number(row.goalie_id),
          game_id: Number(row.game_id),
          game_date: game?.date ?? row.game_date ?? null,
          season_id: game?.seasonId ?? null,
          team_id: row.team_id ?? null,
        });
      }
      if (data.length < PAGE_SIZE) break;
    }
  }
  return { players, goalies };
}
