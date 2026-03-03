import supabase from "lib/supabase/server";
import type {
  ForgeTeamGameStrengthRow,
  GoalieGameHistoryRow,
  TeamDefensiveEnvironment,
  TeamFiveOnFiveProfile,
  TeamNstExpectedGoalsProfile,
  TeamOffenseEnvironment,
  TeamStrengthPrior
} from "../types/run-forge-projections.types";
import { daysBetweenDates } from "../utils/date-utils";
import { safeNumber } from "../utils/number-utils";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function meanOrNull(nums: Array<number | null | undefined>): number | null {
  const vals = nums.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n)
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export type TeamStrengthAverages = {
  toiEsSecondsAvg: number | null;
  toiPpSecondsAvg: number | null;
  shotsEsAvg: number | null;
  shotsPpAvg: number | null;
};

export async function fetchTeamStrengthAverages(
  teamId: number,
  cutoffDate: string
): Promise<TeamStrengthAverages> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_team_game_strength")
    .select("game_date,toi_es_seconds,toi_pp_seconds,shots_es,shots_pp")
    .eq("team_id", teamId)
    .lt("game_date", cutoffDate)
    .order("game_date", { ascending: false })
    .limit(10);
  if (error) throw error;

  const rows = (data ?? []) as ForgeTeamGameStrengthRow[];
  return {
    toiEsSecondsAvg: meanOrNull(
      rows.map((r) =>
        r?.toi_es_seconds == null ? null : Number(r.toi_es_seconds)
      )
    ),
    toiPpSecondsAvg: meanOrNull(
      rows.map((r) =>
        r?.toi_pp_seconds == null ? null : Number(r.toi_pp_seconds)
      )
    ),
    shotsEsAvg: meanOrNull(
      rows.map((r) => (r?.shots_es == null ? null : Number(r.shots_es)))
    ),
    shotsPpAvg: meanOrNull(
      rows.map((r) => (r?.shots_pp == null ? null : Number(r.shots_pp)))
    )
  };
}

export async function fetchTeamAbbreviationMap(
  teamIds: number[]
): Promise<Map<number, string>> {
  assertSupabase();
  if (teamIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("teams")
    .select("id,abbreviation")
    .in("id", teamIds);
  if (error) throw error;
  return new Map(
    (data ?? [])
      .map((row: any) => {
        const id = Number(row?.id);
        const abbreviation =
          typeof row?.abbreviation === "string" ? row.abbreviation : null;
        if (!Number.isFinite(id) || !abbreviation) return null;
        return [id, abbreviation] as const;
      })
      .filter((entry): entry is readonly [number, string] => entry != null)
  );
}

export async function fetchTeamStrengthPrior(
  teamAbbrev: string,
  asOfDate: string
): Promise<TeamStrengthPrior | null> {
  assertSupabase();
  const normalizedAbbrev = teamAbbrev.trim().toUpperCase();
  if (!normalizedAbbrev) return null;

  const historical = await supabase
    .from("nhl_team_data")
    .select("date,xga,xga_per_game,xgf_per_game")
    .eq("team_abbrev", normalizedAbbrev)
    .lte("date", asOfDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (historical.error) throw historical.error;

  let row = (historical.data as any) ?? null;
  if (!row) {
    const latest = await supabase
      .from("nhl_team_data")
      .select("date,xga,xga_per_game,xgf_per_game")
      .eq("team_abbrev", normalizedAbbrev)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) throw latest.error;
    row = (latest.data as any) ?? null;
  }
  if (!row) return null;

  const toFiniteOrNull = (value: any): number | null =>
    typeof value === "number" && Number.isFinite(value) ? Number(value) : null;

  return {
    sourceDate: typeof row.date === "string" ? row.date : null,
    xga: toFiniteOrNull(row.xga),
    xgaPerGame: toFiniteOrNull(row.xga_per_game),
    xgfPerGame: toFiniteOrNull(row.xgf_per_game)
  };
}

export async function fetchTeamFiveOnFiveProfile(
  teamId: number,
  asOfDate: string
): Promise<TeamFiveOnFiveProfile | null> {
  assertSupabase();
  const { data, error } = await supabase
    .from("wgo_team_stats")
    .select("date,games_played,save_pct_5v5,shooting_plus_save_pct_5v5")
    .eq("team_id", teamId)
    .lte("date", asOfDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return {
    sourceDate: typeof row.date === "string" ? row.date : null,
    gamesPlayed: Number.isFinite(row.games_played) ? Number(row.games_played) : 0,
    savePct5v5:
      typeof row.save_pct_5v5 === "number" && Number.isFinite(row.save_pct_5v5)
        ? Number(row.save_pct_5v5)
        : null,
    shootingPlusSavePct5v5:
      typeof row.shooting_plus_save_pct_5v5 === "number" &&
      Number.isFinite(row.shooting_plus_save_pct_5v5)
        ? Number(row.shooting_plus_save_pct_5v5)
        : null
  };
}

export async function fetchTeamNstExpectedGoalsProfile(
  teamAbbrev: string,
  asOfDate: string
): Promise<TeamNstExpectedGoalsProfile | null> {
  assertSupabase();
  const normalizedAbbrev = teamAbbrev.trim().toUpperCase();
  if (!normalizedAbbrev) return null;
  const calcPer60 = (xga: number | null, toi: number | null): number | null => {
    if (!Number.isFinite(xga) || !Number.isFinite(toi) || (toi as number) <= 0) {
      return null;
    }
    return Number((Number(xga) * 60 / Number(toi)).toFixed(4));
  };
  const toFiniteOrNull = (value: any): number | null =>
    typeof value === "number" && Number.isFinite(value) ? Number(value) : null;

  const allRes = await supabase
    .from("nst_team_all")
    .select("date,gp,toi,xga")
    .eq("team_abbreviation", normalizedAbbrev)
    .eq("situation", "all")
    .lte("date", asOfDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (allRes.error) throw allRes.error;
  if (allRes.data) {
    const row = allRes.data as any;
    const xga = toFiniteOrNull(row.xga);
    const toi = toFiniteOrNull(row.toi);
    return {
      source: "nst_team_all",
      sourceDate: typeof row.date === "string" ? row.date : null,
      gamesPlayed: Number.isFinite(row.gp) ? Number(row.gp) : 0,
      xga,
      xgaPer60: calcPer60(xga, toi)
    };
  }

  const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth() + 1;
  const season = month >= 7 ? year : year - 1;
  const statsRes = await supabase
    .from("nst_team_stats")
    .select("season,gp,toi,xga")
    .eq("team_abbreviation", normalizedAbbrev)
    .eq("situation", "all")
    .lte("season", season)
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (statsRes.error) throw statsRes.error;
  if (!statsRes.data) return null;
  const row = statsRes.data as any;
  const xga = toFiniteOrNull(row.xga);
  const toi = toFiniteOrNull(row.toi);
  return {
    source: "nst_team_stats",
    sourceDate: Number.isFinite(row.season) ? String(row.season) : null,
    gamesPlayed: Number.isFinite(row.gp) ? Number(row.gp) : 0,
    xga,
    xgaPer60: calcPer60(xga, toi)
  };
}

export async function fetchTeamDefensiveEnvironment(
  teamId: number,
  asOfDate: string
): Promise<TeamDefensiveEnvironment> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_goalie_game")
    .select("game_id,game_date,shots_against")
    .eq("team_id", teamId)
    .lt("game_date", asOfDate)
    .order("game_date", { ascending: false })
    .limit(30);
  if (error) throw error;

  const byGameId = new Map<number, { gameDate: string; shotsAgainst: number }>();
  for (const row of (data ?? []) as GoalieGameHistoryRow[]) {
    const gameId = row.game_id;
    const gameDate = row.game_date;
    if (!Number.isFinite(gameId) || !gameDate) continue;
    const shotsAgainst = safeNumber(row.shots_against, 0);
    const existing = byGameId.get(gameId as number);
    if (!existing) {
      byGameId.set(gameId as number, { gameDate, shotsAgainst });
      continue;
    }
    byGameId.set(gameId as number, {
      gameDate,
      shotsAgainst: existing.shotsAgainst + shotsAgainst
    });
  }

  const recentGames = Array.from(byGameId.values())
    .sort((a, b) => b.gameDate.localeCompare(a.gameDate))
    .slice(0, 10);
  const avg10 = meanOrNull(recentGames.map((g) => g.shotsAgainst));
  const avg5 = meanOrNull(recentGames.slice(0, 5).map((g) => g.shotsAgainst));
  return {
    avgShotsAgainstLast10: avg10,
    avgShotsAgainstLast5: avg5
  };
}

export async function fetchTeamOffenseEnvironment(
  teamId: number,
  asOfDate: string
): Promise<TeamOffenseEnvironment> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_team_game_strength")
    .select("game_date,shots_es,shots_pp,goals_es,goals_pp")
    .eq("team_id", teamId)
    .lt("game_date", asOfDate)
    .order("game_date", { ascending: false })
    .limit(10);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    game_date: string;
    shots_es: number | null;
    shots_pp: number | null;
    goals_es: number | null;
    goals_pp: number | null;
  }>;
  const shotsByGame = rows.map(
    (r) => safeNumber(r.shots_es, 0) + safeNumber(r.shots_pp, 0)
  );
  const goalsByGame = rows.map(
    (r) => safeNumber(r.goals_es, 0) + safeNumber(r.goals_pp, 0)
  );

  return {
    avgShotsForLast10: meanOrNull(shotsByGame),
    avgShotsForLast5: meanOrNull(shotsByGame.slice(0, 5)),
    avgGoalsForLast10: meanOrNull(goalsByGame),
    avgGoalsForLast5: meanOrNull(goalsByGame.slice(0, 5))
  };
}

export async function fetchTeamRestDays(
  teamId: number,
  asOfDate: string
): Promise<number | null> {
  assertSupabase();
  const { data, error } = await supabase
    .from("games")
    .select("date")
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
    .lt("date", asOfDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const previousDate = (data as any)?.date as string | null;
  if (!previousDate) return null;
  return Math.max(0, daysBetweenDates(asOfDate, previousDate));
}
