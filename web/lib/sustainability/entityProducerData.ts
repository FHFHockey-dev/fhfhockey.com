// web/lib/sustainability/entityProducerData.ts
//
// Read-only loaders for the team/goalie sustainability producer. They read
// existing database inputs only (no NST requests) and never write; the only
// write path is entityProducerWrite.ts, which dry runs do not import.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { teamsInfo } from "lib/teamsInfo";
import { resolveGameFinality } from "lib/games/gameFinality";
import {
  buildGoalieReadings,
  buildTeamReadings,
  isoDateRange,
  resolveReadyThrough,
  type GoalieGameInput,
  type ProducerResult,
  type ScheduledTeamGame,
  type TeamGameInput
} from "./entityProducer";

type AnyClient = SupabaseClient<any, any, any>;

export const TEAM_IDS: number[] = Object.values(teamsInfo)
  .map((team) => team.id)
  .sort((a, b) => a - b);

const TEAM_ID_BY_ABBREV = new Map(
  Object.entries(teamsInfo).map(([abbrev, team]) => [abbrev, team.id])
);

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadSeason(client: AnyClient, seasonId: number) {
  const { data, error } = await client
    .from("seasons")
    .select("id, startDate, endDate")
    .eq("id", seasonId)
    .single();
  if (error) throw new Error(`Failed to load season ${seasonId}: ${error.message}`);
  return {
    seasonId: Number((data as any).id),
    startDate: String((data as any).startDate),
    endDate: String((data as any).endDate)
  };
}

/**
 * Team-games from schedule rows. Finality follows the shared game-finality
 * contract; a postponed, suspended or cancelled game was not played and is
 * left out, so it cannot hold back every later date.
 */
export function toScheduledTeamGames(rows: any[], now: Date): ScheduledTeamGame[] {
  return rows.flatMap((row) => {
    const finality = resolveGameFinality(row, now);
    if (finality.reason === "not_played_schedule_state") return [];
    const date = String(row.date);
    return [
      { teamId: Number(row.homeTeamId), date, completed: finality.isFinal },
      { teamId: Number(row.awayTeamId), date, completed: finality.isFinal }
    ];
  });
}

/** Today's date on the NHL schedule clock (US Eastern). */
export function nhlToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export async function loadScheduledTeamGames(
  client: AnyClient,
  seasonId: number,
  startDate: string,
  endDate: string,
  now: Date
): Promise<ScheduledTeamGame[]> {
  const rows = await fetchAllSupabasePages<any>(({ from, to }) =>
    client
      .from("games")
      .select(
        "id, date, type, startTime, game_state, game_schedule_state, game_state_observed_at, homeTeamId, awayTeamId"
      )
      .eq("seasonId", seasonId)
      .in("type", [2, 3])
      .gte("date", startDate)
      .lte("date", endDate)
      .order("id", { ascending: true })
      .range(from, to)
  );
  return toScheduledTeamGames(rows, now);
}

export async function loadTeamGames(
  client: AnyClient,
  seasonId: number,
  startDate: string,
  endDate: string
): Promise<{ games: TeamGameInput[]; unmappedAbbrevs: string[] }> {
  const rows = await fetchAllSupabasePages<any>(({ from, to }) =>
    client
      .from("nst_team_gamelogs_as_counts")
      .select(
        "id, team_abbreviation, date, situation, gp, xgf, xga, scf, sca, hdcf, hdca, gf, ga, sf, sa"
      )
      .eq("season_id", seasonId)
      .eq("situation", "all")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("id", { ascending: true })
      .range(from, to)
  );
  const unmapped = new Set<string>();
  const games: TeamGameInput[] = [];
  for (const row of rows) {
    const abbrev = String(row.team_abbreviation);
    const teamId = TEAM_ID_BY_ABBREV.get(abbrev);
    if (teamId === undefined) {
      unmapped.add(abbrev);
      continue;
    }
    // This table holds per-game rows (gp = 1) for the current season;
    // anything else is not a game and is left out.
    if (num(row.gp) !== 1) continue;
    games.push({
      teamId,
      teamAbbrev: abbrev,
      date: String(row.date),
      xgf: num(row.xgf),
      xga: num(row.xga),
      scf: num(row.scf),
      sca: num(row.sca),
      hdcf: num(row.hdcf),
      hdca: num(row.hdca),
      gf: num(row.gf),
      ga: num(row.ga),
      sf: num(row.sf),
      sa: num(row.sa)
    });
  }
  return { games, unmappedAbbrevs: [...unmapped] };
}

export async function loadGoalieGames(
  client: AnyClient,
  seasonId: number,
  startDate: string,
  endDate: string
): Promise<{ games: GoalieGameInput[]; unmappedAbbrevs: string[] }> {
  const [wgo, nst] = await Promise.all([
    fetchAllSupabasePages<any>(({ from, to }) =>
      client
        .from("wgo_goalie_stats")
        .select(
          "goalie_id, date, team_abbreviation, games_played, games_started, saves, shots_against, goals_against, time_on_ice, quality_start, shutouts"
        )
        .eq("season_id", seasonId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("goalie_id", { ascending: true })
        .order("date", { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabasePages<any>(({ from, to }) =>
      client
        .from("nst_gamelog_goalie_all_counts")
        .select("player_id, date_scraped, xg_against")
        .gte("date_scraped", startDate)
        .lte("date_scraped", endDate)
        .order("player_id", { ascending: true })
        .order("date_scraped", { ascending: true })
        .range(from, to)
    )
  ]);
  const xgByKey = new Map<string, number | null>();
  for (const row of nst) {
    xgByKey.set(`${row.player_id}|${row.date_scraped}`, numOrNull(row.xg_against));
  }
  const unmapped = new Set<string>();
  const games: GoalieGameInput[] = [];
  for (const row of wgo) {
    if (num(row.games_played) < 1) continue;
    const abbrev = String(row.team_abbreviation);
    const teamId = TEAM_ID_BY_ABBREV.get(abbrev);
    if (teamId === undefined) {
      unmapped.add(abbrev);
      continue;
    }
    const key = `${row.goalie_id}|${row.date}`;
    games.push({
      goalieId: Number(row.goalie_id),
      teamId,
      teamAbbrev: abbrev,
      date: String(row.date),
      started: num(row.games_started) > 0,
      saves: num(row.saves),
      shotsAgainst: num(row.shots_against),
      goalsAgainst: num(row.goals_against),
      toiSeconds: num(row.time_on_ice),
      qualityStart: num(row.quality_start) > 0,
      shutout: num(row.shutouts) > 0,
      xgAgainst: xgByKey.has(key) ? xgByKey.get(key)! : null
    });
  }
  return { games, unmappedAbbrevs: [...unmapped] };
}

export type EntityProducerRun = ProducerResult & {
  seasonId: number;
  seasonStart: string;
  requestedStart: string;
  requestedEnd: string;
  readyThrough: string | null;
  dates: string[];
  entityTypes: Array<"team" | "goalie">;
  unmappedAbbrevs: string[];
};

/** Reads inputs and computes rows. Never writes. */
export async function computeEntitySustainability(args: {
  client: AnyClient;
  seasonId: number;
  startDate?: string | null;
  endDate: string;
  entityTypes?: Array<"team" | "goalie">;
  now?: Date;
}): Promise<EntityProducerRun> {
  const entityTypes = args.entityTypes ?? ["team", "goalie"];
  const now = args.now ?? new Date();
  const season = await loadSeason(args.client, args.seasonId);
  const requestedStart =
    args.startDate && args.startDate > season.startDate ? args.startDate : season.startDate;
  // Never past the season or today: a future off day is not a reading yet.
  const requestedEnd = [args.endDate, season.endDate, nhlToday(now)].sort()[0];

  // Inputs from season start: windows and baselines need the whole season to date.
  const [scheduled, team] = await Promise.all([
    loadScheduledTeamGames(args.client, season.seasonId, season.startDate, requestedEnd, now),
    loadTeamGames(args.client, season.seasonId, season.startDate, requestedEnd)
  ]);
  const teamInputKeys = new Set(team.games.map((g) => `${g.teamId}|${g.date}`));
  const readyThrough = resolveReadyThrough({
    seasonStart: season.startDate,
    requestedEnd,
    scheduled,
    hasTeamInput: (teamId, date) => teamInputKeys.has(`${teamId}|${date}`)
  });
  const dates =
    readyThrough && readyThrough >= requestedStart
      ? isoDateRange(requestedStart, readyThrough)
      : [];
  const lastDate = dates[dates.length - 1];
  const completedGames = scheduled
    .filter((g) => g.completed && (!lastDate || g.date <= lastDate))
    .map(({ teamId, date }) => ({ teamId, date }));

  const result: ProducerResult = { scores: [], bands: [], skips: [] };
  const unmapped = new Set(team.unmappedAbbrevs);
  if (dates.length && entityTypes.includes("team")) {
    const teams = buildTeamReadings({
      seasonId: season.seasonId,
      dates,
      games: team.games.filter((g) => g.date <= lastDate),
      completedGames,
      teamIds: TEAM_IDS
    });
    result.scores.push(...teams.scores);
    result.bands.push(...teams.bands);
    result.skips.push(...teams.skips);
  }
  if (dates.length && entityTypes.includes("goalie")) {
    const goalie = await loadGoalieGames(
      args.client,
      season.seasonId,
      season.startDate,
      lastDate
    );
    goalie.unmappedAbbrevs.forEach((a) => unmapped.add(a));
    const goalies = buildGoalieReadings({
      seasonId: season.seasonId,
      dates,
      games: goalie.games,
      completedGames
    });
    result.scores.push(...goalies.scores);
    result.bands.push(...goalies.bands);
    result.skips.push(...goalies.skips);
  }

  return {
    ...result,
    seasonId: season.seasonId,
    seasonStart: season.startDate,
    requestedStart,
    requestedEnd,
    readyThrough,
    dates,
    entityTypes,
    unmappedAbbrevs: [...unmapped]
  };
}
