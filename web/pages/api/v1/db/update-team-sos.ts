import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { teamsInfo } from "lib/teamsInfo";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for SOS updater.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
const SOS_TABLE = "sos_standings";

type NhlScheduleGame = {
  gameDate: string;
  gameType: number;
  homeTeam: { abbrev: string; id: number };
  awayTeam: { abbrev: string; id: number };
};

type StandingRow = {
  teamAbbrev: { default: string };
  teamId: number;
  wins: number;
  losses: number;
  otLosses: number;
  points?: number;
  gamesPlayed?: number;
};

async function fetchJson<T>(
  url: string,
  retries = 4,
  backoffMs = 500
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      return (await res.json()) as T;
    }

    // NHL API sometimes rate limits by returning 429; back off and retry.
    if (res.status === 429 && attempt < retries) {
      const wait = backoffMs * 2 ** attempt;
      console.warn(
        `[SOS] 429 for ${url} (attempt ${attempt + 1}/${
          retries + 1
        }) – retrying in ${wait}ms`
      );
      await sleep(wait);
      continue;
    }

    let body = "";
    try {
      body = await res.text();
    } catch (_) {}
    throw new Error(
      `Fetch failed ${res.status} ${res.statusText} for ${url}${
        body ? ` – ${body.slice(0, 200)}` : ""
      }`
    );
  }

  // Should never get here
  throw new Error(`Fetch exhausted for ${url}`);
}

async function fetchStandingsByDate(date: string): Promise<
  Map<
    string,
    {
      wins: number;
      losses: number;
      otLosses: number;
      teamId: number;
      points: number;
      gamesPlayed: number;
    }
  >
> {
  const url = `https://api-web.nhle.com/v1/standings/${date}`;
  const data = (await fetchJson<{ standings: StandingRow[] }>(url)).standings;
  const map = new Map<
    string,
    {
      wins: number;
      losses: number;
      otLosses: number;
      teamId: number;
      points: number;
      gamesPlayed: number;
    }
  >();
  data.forEach((row) => {
    const abbrev = row.teamAbbrev.default;
    map.set(abbrev, {
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      otLosses: row.otLosses ?? 0,
      teamId: row.teamId,
      points: row.points ?? 0,
      gamesPlayed: row.gamesPlayed ?? 0
    });
  });
  return map;
}

async function fetchTeamSchedule(
  abbrev: string,
  seasonId: number
): Promise<NhlScheduleGame[]> {
  const url = `https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/${seasonId}`;
  const data = await fetchJson<{ games: NhlScheduleGame[] }>(url);
  return data.games ?? [];
}

type SosRowInsert = {
  season_id: number;
  game_date: string;
  team_id: number;
  team_name: string | null;
  team_abbrev: string | null;
  team_wins: number | null;
  team_losses: number | null;
  team_ot_losses: number | null;
  team_points: number | null;
  team_point_pct: number | null;
  team_win_pct: number | null;
  team_games_played: number | null;
  past_opponents: any;
  future_opponents: any;
  past_opponent_total_wins: number;
  past_opponent_total_losses: number;
  past_opponent_total_ot_losses: number;
  future_opponent_total_wins: number;
  future_opponent_total_losses: number;
  future_opponent_total_ot_losses: number;
};

const buildDateRange = (start: string, end: string) => {
  const dates: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    dates.push(new Date(d).toISOString().slice(0, 10));
  }
  return dates;
};

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function resolveStartDate(
  seasonId: number,
  seasonStart: string,
  override?: string
): Promise<string> {
  if (override) return override.slice(0, 10);
  const { data, error } = await supabase
    .from(SOS_TABLE)
    .select("game_date")
    .eq("season_id", seasonId)
    .order("game_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  const lastDate = data?.[0]?.game_date as string | undefined;
  if (!lastDate) return seasonStart.slice(0, 10);
  // overwrite the most recent row when rerunning
  return lastDate.slice(0, 10);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
  const season = await fetchCurrentSeason();
  const startParam =
    typeof req.query.start === "string" ? req.query.start : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const seasonEnd =
    season.endDate || season.regularSeasonEndDate || today;
  const endDate = seasonEnd > today ? today : seasonEnd;
  const startCandidate = await resolveStartDate(
    season.id,
    season.startDate,
    startParam
  );
  const startDate =
    startCandidate > endDate
      ? endDate
      : startCandidate < season.startDate.slice(0, 10)
        ? season.startDate.slice(0, 10)
        : startCandidate;

  if (startDate > endDate) {
    return res.status(200).json({
      message: "No dates to process (start is after today/season end).",
      startDate,
      endDate,
      rows: 0
    });
  }

  const dates = buildDateRange(startDate, endDate);

    // Fetch schedules once per team
    const scheduleMap = new Map<string, NhlScheduleGame[]>();
    await Promise.all(
      Object.keys(teamsInfo).map(async (abbrev) => {
        const schedule = await fetchTeamSchedule(abbrev, season.id);
        scheduleMap.set(
          abbrev,
          schedule.filter((g) => g.gameType === 2)
        );
      })
    );

    const allRows: SosRowInsert[] = [];

  for (const currentDate of dates) {
      const standingsMap = await fetchStandingsByDate(currentDate);
      await sleep(250);

      Object.keys(teamsInfo).forEach((abbrev) => {
        const regular = scheduleMap.get(abbrev) ?? [];
        const teamStanding = standingsMap.get(abbrev);
        const teamGamesPlayed = teamStanding?.gamesPlayed ?? regular.length;
        const teamPoints =
          teamStanding?.points ??
          (teamStanding ? teamStanding.wins * 2 + teamStanding.otLosses : 0);
        const teamPointPct =
          teamGamesPlayed > 0 ? teamPoints / (teamGamesPlayed * 2) : null;
        const teamWinPct =
          teamGamesPlayed > 0
            ? (teamStanding?.wins ?? 0) / teamGamesPlayed
            : null;

        let pastWins = 0;
        let pastLosses = 0;
        let pastOt = 0;
        let futureWins = 0;
        let futureLosses = 0;
        let futureOt = 0;

        const pastOpponents: Array<{ opponent: string; date: string }> = [];
        const futureOpponents: Array<{ opponent: string; date: string }> = [];

        regular.forEach((g) => {
          const gameDate = g.gameDate.slice(0, 10);
          const opponent =
            g.homeTeam.abbrev === abbrev
              ? g.awayTeam.abbrev
              : g.homeTeam.abbrev;
          const oppStanding = standingsMap.get(opponent);
          if (!oppStanding) return;
          if (gameDate < currentDate) {
            pastWins += oppStanding.wins;
            pastLosses += oppStanding.losses;
            pastOt += oppStanding.otLosses;
            pastOpponents.push({ opponent, date: gameDate });
          } else {
            futureWins += oppStanding.wins;
            futureLosses += oppStanding.losses;
            futureOt += oppStanding.otLosses;
            futureOpponents.push({ opponent, date: gameDate });
          }
        });

        const info = teamsInfo[abbrev as keyof typeof teamsInfo];
        allRows.push({
          season_id: season.id,
          game_date: currentDate,
          team_id: info?.id ?? 0,
          team_name: info?.name ?? null,
          team_abbrev: abbrev,
          team_wins: teamStanding?.wins ?? null,
          team_losses: teamStanding?.losses ?? null,
          team_ot_losses: teamStanding?.otLosses ?? null,
          team_points: teamPoints ?? null,
          team_point_pct: teamPointPct,
          team_win_pct: teamWinPct,
          team_games_played: teamGamesPlayed ?? null,
          past_opponents: pastOpponents,
          future_opponents: futureOpponents,
          past_opponent_total_wins: pastWins,
          past_opponent_total_losses: pastLosses,
          past_opponent_total_ot_losses: pastOt,
          future_opponent_total_wins: futureWins,
          future_opponent_total_losses: futureLosses,
          future_opponent_total_ot_losses: futureOt
        });
      });
    }

    const chunkSize = 500;
    for (let i = 0; i < allRows.length; i += chunkSize) {
      const slice = allRows.slice(i, i + chunkSize);
      const { error: upsertError } = await supabase
        .from(SOS_TABLE)
        .upsert(slice, { onConflict: "season_id,game_date,team_id" });
      if (upsertError) throw upsertError;
    }

    return res.status(200).json({
      message: "SOS updated",
      startDate,
      endDate,
      rows: allRows.length
    });
  } catch (error: any) {
    console.error("update-team-sos error", error);
    return res.status(500).json({
      message: "Failed to compute SOS.",
      error: error?.message ?? "Unknown error"
    });
  }
}
