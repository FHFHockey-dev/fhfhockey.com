import type { SupabaseClient } from "@supabase/supabase-js";

import supabaseServer from "../supabase/server";
import { teamsInfo } from "../teamsInfo";
import { isValidIsoDate } from "../teamRatingsService";

type WgoSpecialTeamsRow = {
  date: string;
  franchise_name: string | null;
  penalty_kill_pct: number | null;
  power_play_pct: number | null;
  team_id: number | null;
};

export type UnderlyingStatsTeamSpecialTeamsContext = {
  pkPct: number | null;
  pkRank: number | null;
  ppPct: number | null;
  ppRank: number | null;
  teamAbbr: string;
};

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildRankMap = (valuesByTeam: Map<string, number | null>): Map<string, number | null> => {
  const ordered = Array.from(valuesByTeam.entries())
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((a, b) => b[1] - a[1]);

  const rankMap = new Map<string, number | null>();
  ordered.forEach(([teamAbbr], index) => {
    rankMap.set(teamAbbr, index + 1);
  });

  valuesByTeam.forEach((_, teamAbbr) => {
    if (!rankMap.has(teamAbbr)) {
      rankMap.set(teamAbbr, null);
    }
  });

  return rankMap;
};

export const fetchUnderlyingStatsTeamSpecialTeamsContext = async (
  date: string,
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, UnderlyingStatsTeamSpecialTeamsContext>> => {
  if (!isValidIsoDate(date)) {
    return new Map();
  }

  const [{ data: rows, error: rowsError }, { data: teams, error: teamsError }] =
    await Promise.all([
      supabase
        .from("wgo_team_stats")
        .select("team_id, franchise_name, date, power_play_pct, penalty_kill_pct")
        .lte("date", date)
        .order("date", { ascending: false }),
      supabase.from("teams").select("id, abbreviation, name")
    ]);

  if (rowsError) {
    throw rowsError;
  }

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

  const ppByTeam = new Map<string, number | null>();
  const pkByTeam = new Map<string, number | null>();
  const seenTeams = new Set<string>();

  (rows as WgoSpecialTeamsRow[] | null)?.forEach((row) => {
    const teamAbbr =
      (typeof row.team_id === "number" ? idMap.get(row.team_id) : null) ??
      (typeof row.franchise_name === "string" ? nameMap.get(row.franchise_name) : null);

    if (!teamAbbr || seenTeams.has(teamAbbr)) {
      return;
    }

    seenTeams.add(teamAbbr);
    ppByTeam.set(teamAbbr, toFiniteNumber(row.power_play_pct));
    pkByTeam.set(teamAbbr, toFiniteNumber(row.penalty_kill_pct));
  });

  const ppRankMap = buildRankMap(ppByTeam);
  const pkRankMap = buildRankMap(pkByTeam);
  const payload = new Map<string, UnderlyingStatsTeamSpecialTeamsContext>();
  const allTeams = new Set([...ppByTeam.keys(), ...pkByTeam.keys()]);

  allTeams.forEach((teamAbbr) => {
    payload.set(teamAbbr, {
      pkPct: pkByTeam.get(teamAbbr) ?? null,
      pkRank: pkRankMap.get(teamAbbr) ?? null,
      ppPct: ppByTeam.get(teamAbbr) ?? null,
      ppRank: ppRankMap.get(teamAbbr) ?? null,
      teamAbbr
    });
  });

  return payload;
};
