import type { SupabaseClient } from "@supabase/supabase-js";

import { type GameFinalityInput, resolveGameFinality } from "lib/games/gameFinality";
import { getCurrentSeason } from "lib/NHL/server";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import serviceRoleClient from "lib/supabase/server";

import { fetchSeasonTeamSummaryGameIdSet } from "./teamStatsSummaryRefresh";

type GameRow = GameFinalityInput & {
  id: number | string | null;
  date: string | null;
  type?: number | string | null;
};

type FinishedSeasonGame = {
  id: number;
  date: string;
  startTime?: string | null;
};

async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>
): Promise<TRow[]> {
  return fetchAllSupabasePages<TRow>(({ from, to }) => fetchPage(from, to) as any);
}

async function resolveSeasonId(seasonId?: number | null): Promise<number> {
  if (seasonId != null && Number.isFinite(seasonId)) {
    return seasonId;
  }

  const currentSeason = await getCurrentSeason();
  return currentSeason.seasonId;
}

async function fetchFinishedSeasonGames(args: {
  supabase: SupabaseClient;
  seasonId: number;
  requestedGameType: number;
}): Promise<FinishedSeasonGame[]> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const rows = await fetchAllRows<GameRow>((from, to) =>
    args.supabase
      .from("games")
      .select(
        "id,date,startTime,seasonId,type,game_state,game_schedule_state,game_state_observed_at"
      )
      .eq("seasonId", args.seasonId)
      .eq("type", args.requestedGameType)
      .lte("date", today)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
  );

  return rows.flatMap<FinishedSeasonGame>((row) => {
    const id = Number(row.id);
    const date = row.date;
    const startTime = row.startTime;

    if (!Number.isFinite(id)) return [];
    if (typeof date !== "string") return [];
    // Rule 19: the stored game state decides (contract nhl-game-state-v1);
    // start + 8 h is only the labelled fallback while the state is unknown.
    if (!resolveGameFinality(row, now).isFinal) return [];

    return [{ id, date, startTime }];
  });
}

export type TeamStatsIncrementalSelection = {
  mode: "incremental";
  seasonId: number;
  requestedGameType: number;
  startDate: string | null;
  endDate: string | null;
  latestCoveredDate: string | null;
  gameIds: number[];
};

export async function resolveTeamStatsIncrementalSelection(args?: {
  seasonId?: number | null;
  requestedGameType?: number | null;
  supabase?: SupabaseClient;
}): Promise<TeamStatsIncrementalSelection> {
  const supabase = args?.supabase ?? serviceRoleClient;
  const seasonId = await resolveSeasonId(args?.seasonId);
  const requestedGameType = args?.requestedGameType ?? 2;
  const finishedGames = await fetchFinishedSeasonGames({
    supabase,
    seasonId,
    requestedGameType,
  });

  if (finishedGames.length === 0) {
    return {
      mode: "incremental",
      seasonId,
      requestedGameType,
      startDate: null,
      endDate: null,
      latestCoveredDate: null,
      gameIds: [],
    };
  }

  const summaryGameIds = await fetchSeasonTeamSummaryGameIdSet({
    supabase,
    seasonId,
    requestedGameType
  });

  let latestCoveredDate: string | null = null;

  for (const game of finishedGames) {
    if (summaryGameIds.has(game.id)) {
      latestCoveredDate = game.date;
      break;
    }
  }

  const startDate = latestCoveredDate ?? finishedGames[finishedGames.length - 1]?.date ?? null;
  const endDate = finishedGames[0]?.date ?? null;

  const selectedGames = finishedGames
    .filter((game) => startDate != null && game.date >= startDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  return {
    mode: "incremental",
    seasonId,
    requestedGameType,
    startDate,
    endDate,
    latestCoveredDate,
    gameIds: selectedGames.map((game) => game.id),
  };
}
