import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAllSupabasePages } from "../supabase/pagination";
import supabaseServer from "../supabase/server";
import { teamsInfo } from "../teamsInfo";
import { isValidIsoDate } from "../teamRatingsService";

/** One `wgo_team_stats` game row with the counts needed to pool special teams. */
export type WgoSpecialTeamsGameRow = {
  date: string;
  franchise_name: string | null;
  game_id: number | null;
  season_id: number | null;
  team_id: number | null;
  power_play_goals_for: number | null;
  pp_opportunities: number | null;
  pp_goals_against: number | null;
  times_shorthanded: number | null;
  /** Per-game percentages (fractions); kept for reference, never pooled. */
  power_play_pct: number | null;
  penalty_kill_pct: number | null;
};

const WGO_SPECIAL_TEAMS_SELECT =
  "team_id, franchise_name, date, game_id, season_id, power_play_goals_for, pp_opportunities, pp_goals_against, times_shorthanded, power_play_pct, penalty_kill_pct";

/** Regular-season games only (decision 69): NHL game ids carry the type in digits 5-6. */
const REGULAR_SEASON_GAME_TYPE = 2;

export type UnderlyingStatsTeamSpecialTeamsContext = {
  /** Pooled season-to-date PK%, in percentage points (0-100). */
  pkPct: number | null;
  pkRank: number | null;
  /** Pooled season-to-date PP%, in percentage points (0-100). */
  ppPct: number | null;
  ppRank: number | null;
  teamAbbr: string;
};

export type PooledTeamSpecialTeams = {
  games: number;
  ppGoals: number | null;
  ppOpportunities: number | null;
  /** Σ PPG ÷ Σ PPO as a fraction (0-1); null when unknown or no opportunities. */
  ppPct: number | null;
  ppGoalsAgainst: number | null;
  timesShorthanded: number | null;
  /** 1 − Σ PPGA ÷ Σ times shorthanded as a fraction (0-1); null when unknown. */
  pkPct: number | null;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const gameKey = (row: WgoSpecialTeamsGameRow): string =>
  row.game_id != null ? `game:${row.game_id}` : `date:${row.date}`;

/** Full-sample sum: one unknown game makes the season total unknown (rules 5, 13). */
const sumKnown = (
  rows: readonly WgoSpecialTeamsGameRow[],
  read: (row: WgoSpecialTeamsGameRow) => number | null
): number | null => {
  if (rows.length === 0) return null;
  let total = 0;
  for (const row of rows) {
    const value = read(row);
    if (!isFiniteNumber(value)) return null;
    total += value;
  }
  return total;
};

/**
 * Pooled special teams for one team's games (W2-P0-6, decision 20): PP% =
 * Σ PP goals ÷ Σ PP opportunities, PK% = 1 − Σ PP goals against ÷ Σ times
 * shorthanded. Never a mean of per-game percentages. A repeated game counts once.
 * The caller bounds the rows to one season and team. Exported for L12.
 */
export const poolTeamSpecialTeams = (
  rows: readonly WgoSpecialTeamsGameRow[]
): PooledTeamSpecialTeams => {
  const byGame = new Map<string, WgoSpecialTeamsGameRow>();
  rows.forEach((row) => {
    const key = gameKey(row);
    if (!byGame.has(key)) byGame.set(key, row);
  });
  const games = [...byGame.values()];
  const ppGoals = sumKnown(games, (row) => row.power_play_goals_for);
  const ppOpportunities = sumKnown(games, (row) => row.pp_opportunities);
  const ppGoalsAgainst = sumKnown(games, (row) => row.pp_goals_against);
  const timesShorthanded = sumKnown(games, (row) => row.times_shorthanded);

  return {
    games: games.length,
    ppGoals,
    ppOpportunities,
    ppPct:
      ppGoals != null && ppOpportunities != null && ppOpportunities > 0
        ? ppGoals / ppOpportunities
        : null,
    ppGoalsAgainst,
    timesShorthanded,
    pkPct:
      ppGoalsAgainst != null && timesShorthanded != null && timesShorthanded > 0
        ? 1 - ppGoalsAgainst / timesShorthanded
        : null,
  };
};

/**
 * Competition ranks (1, 2, 2, 4) by value, higher is better; ties share a
 * rank and the result does not depend on input order (PR-U5, rule 20).
 * Unknown values stay unranked (null).
 */
export const rankSpecialTeamsCompetition = (
  valuesByTeam: Map<string, number | null>
): Map<string, number | null> => {
  const known = [...valuesByTeam.values()].filter(isFiniteNumber);
  const rankMap = new Map<string, number | null>();
  valuesByTeam.forEach((value, teamAbbr) => {
    rankMap.set(
      teamAbbr,
      isFiniteNumber(value) ? 1 + known.filter((other) => other > value).length : null
    );
  });
  return rankMap;
};

const isRegularSeasonGame = (gameId: number | null): boolean =>
  gameId == null || Math.floor(gameId / 10_000) % 100 === REGULAR_SEASON_GAME_TYPE;

type SeasonBoundRow = { id: number; startDate: string; regularSeasonEndDate: string };

/** The season whose window contains `date` (the latest season started on or before it). */
const fetchSeasonForDate = async (
  date: string,
  supabase: SupabaseClient
): Promise<SeasonBoundRow | null> => {
  const { data, error } = await supabase
    .from("seasons")
    .select("id, startDate, regularSeasonEndDate")
    .lte("startDate", date)
    .order("startDate", { ascending: false })
    .limit(1);
  if (error) throw error;
  const season = (data as SeasonBoundRow[] | null)?.[0];
  return season && isFiniteNumber(season.id) ? season : null;
};

const toPercentagePoints = (fraction: number | null): number | null =>
  fraction == null ? null : fraction * 100;

export const fetchUnderlyingStatsTeamSpecialTeamsContext = async (
  date: string,
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, UnderlyingStatsTeamSpecialTeamsContext>> => {
  if (!isValidIsoDate(date)) {
    return new Map();
  }

  const season = await fetchSeasonForDate(date, supabase);
  if (season == null) {
    return new Map();
  }
  const throughDate =
    season.regularSeasonEndDate && season.regularSeasonEndDate < date
      ? season.regularSeasonEndDate
      : date;

  const [rows, { data: teams, error: teamsError }] = await Promise.all([
    fetchAllSupabasePages<WgoSpecialTeamsGameRow>(({ from, to }) =>
      supabase
        .from("wgo_team_stats")
        .select(WGO_SPECIAL_TEAMS_SELECT)
        .eq("season_id", season.id)
        .gte("date", season.startDate)
        .lte("date", throughDate)
        .order("date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to) as any
    ),
    supabase.from("teams").select("id, abbreviation, name")
  ]);

  if (teamsError) {
    throw teamsError;
  }

  const idMap = new Map<number, string>();
  const nameMap = new Map<string, string>();

  (teams ?? []).forEach((team) => {
    if (typeof team.id === "number" && typeof team.abbreviation === "string") {
      idMap.set(team.id, team.abbreviation);
    }
    if (typeof team.name === "string" && typeof team.abbreviation === "string") {
      nameMap.set(team.name, team.abbreviation);
    }
  });

  Object.values(teamsInfo).forEach((team) => {
    idMap.set(team.id, team.abbrev);
    nameMap.set(team.name, team.abbrev);
    if (team.location && team.name.startsWith(`${team.location} `)) {
      nameMap.set(team.name.replace(`${team.location} `, ""), team.abbrev);
    }
  });

  const rowsByTeam = new Map<string, WgoSpecialTeamsGameRow[]>();

  rows.forEach((row) => {
    if (!isRegularSeasonGame(row.game_id)) {
      return;
    }
    const teamAbbr =
      (typeof row.team_id === "number" ? idMap.get(row.team_id) : null) ??
      (typeof row.franchise_name === "string" ? nameMap.get(row.franchise_name) : null);

    if (!teamAbbr) {
      return;
    }

    const bucket = rowsByTeam.get(teamAbbr) ?? [];
    bucket.push(row);
    rowsByTeam.set(teamAbbr, bucket);
  });

  const ppByTeam = new Map<string, number | null>();
  const pkByTeam = new Map<string, number | null>();

  rowsByTeam.forEach((teamRows, teamAbbr) => {
    const pooled = poolTeamSpecialTeams(teamRows);
    ppByTeam.set(teamAbbr, pooled.ppPct);
    pkByTeam.set(teamAbbr, pooled.pkPct);
  });

  const ppRankMap = rankSpecialTeamsCompetition(ppByTeam);
  const pkRankMap = rankSpecialTeamsCompetition(pkByTeam);
  const payload = new Map<string, UnderlyingStatsTeamSpecialTeamsContext>();

  rowsByTeam.forEach((_, teamAbbr) => {
    payload.set(teamAbbr, {
      pkPct: toPercentagePoints(pkByTeam.get(teamAbbr) ?? null),
      pkRank: pkRankMap.get(teamAbbr) ?? null,
      ppPct: toPercentagePoints(ppByTeam.get(teamAbbr) ?? null),
      ppRank: ppRankMap.get(teamAbbr) ?? null,
      teamAbbr
    });
  });

  return payload;
};
