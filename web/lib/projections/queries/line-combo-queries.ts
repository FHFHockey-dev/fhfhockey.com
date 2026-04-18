import supabase from "lib/supabase/server";
import type { LineCombinationWithGameDateRow } from "../types/run-forge-projections.types";

type TeamGameDateRow = {
  id: number | null;
  date: string | null;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export function sortLineCombinationsByGameDate(
  rows: LineCombinationWithGameDateRow[]
): LineCombinationWithGameDateRow[] {
  return [...rows].sort((a, b) => {
    const aDate = typeof a.games?.date === "string" ? a.games.date : "";
    const bDate = typeof b.games?.date === "string" ? b.games.date : "";
    if (aDate !== bDate) {
      return bDate.localeCompare(aDate);
    }
    return Number(b.gameId ?? 0) - Number(a.gameId ?? 0);
  });
}

export async function fetchRecentTeamLineCombinations(args: {
  teamId: number;
  asOfDate: string;
  limit: number;
  lookbackGames?: number;
}): Promise<LineCombinationWithGameDateRow[]> {
  assertSupabase();
  const limit = Math.max(1, Math.floor(args.limit));
  const lookbackGames = Math.max(limit, Math.floor(args.lookbackGames ?? limit * 12));

  const { data: recentGames, error: recentGamesError } = await supabase
    .from("games")
    .select("id,date")
    .or(`homeTeamId.eq.${args.teamId},awayTeamId.eq.${args.teamId}`)
    .lt("date", args.asOfDate)
    .order("date", { ascending: false })
    .limit(lookbackGames);
  if (recentGamesError) throw recentGamesError;

  const gameDateById = new Map<number, string>();
  for (const row of (recentGames ?? []) as TeamGameDateRow[]) {
    const gameId = Number(row.id);
    if (!Number.isFinite(gameId) || typeof row.date !== "string") continue;
    gameDateById.set(gameId, row.date);
  }
  const candidateGameIds = Array.from(gameDateById.keys());
  if (candidateGameIds.length === 0) return [];

  const { data: lineCombinationRows, error: lineCombinationError } = await supabase
    .from("lineCombinations")
    .select("gameId,teamId,forwards,defensemen,goalies")
    .eq("teamId", args.teamId)
    .in("gameId", candidateGameIds);
  if (lineCombinationError) throw lineCombinationError;

  const rows = ((lineCombinationRows ?? []) as LineCombinationWithGameDateRow[])
    .map((row) => {
      const gameId = Number(row.gameId);
      const gameDate = Number.isFinite(gameId) ? gameDateById.get(gameId) ?? null : null;
      return {
        ...row,
        games: {
          date: gameDate
        }
      };
    })
    .filter((row) => typeof row.games?.date === "string");

  return sortLineCombinationsByGameDate(rows).slice(0, limit);
}
