import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentSeason } from "lib/NHL/server";
import serviceRoleClient from "lib/supabase/server";

import { fetchSeasonTeamSummaryGameIdSet } from "./teamStatsSummaryRefresh";

const SUPABASE_PAGE_SIZE = 1000;

type GameRow = {
  id: number | string | null;
  date: string | null;
  startTime?: string | null;
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
  const rows: TRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const pageRows = (data ?? []) as TRow[];

    if (!pageRows.length) {
      break;
    }

    rows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
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
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const finishedCutoff = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  const rows = await fetchAllRows<GameRow>((from, to) =>
    args.supabase
      .from("games")
      .select("id,date,startTime,seasonId,type")
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
    if (typeof date !== "string" || date >= today) return [];
    if (typeof startTime === "string" && new Date(startTime) > finishedCutoff) {
      return [];
    }

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