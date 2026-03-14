import supabase from "lib/supabase";
import type { Database } from "lib/supabase/database-generated.types";

type RosterRow = Database["public"]["Tables"]["rosters"]["Row"];
type GameRow = Database["public"]["Tables"]["games"]["Row"];

export type UpcomingGame = {
  gameId: number;
  gameDate: string;
  teamId: number;
  opponentTeamId: number;
  isHome: boolean;
};

export type OpponentStrengthRow = {
  teamAbbreviation: string;
  source: "nst_team_all" | "nst_team_stats";
  sourceDate: string | null;
  gamesPlayed: number;
  xgaPer60: number | null;
  caPer60: number | null;
  scaPer60: number | null;
  hdcaPer60: number | null;
  svPct: number | null;
  pkTier: number | null;
};

export type UpcomingOpponent = UpcomingGame & {
  opponentTeamAbbreviation: string | null;
  opponentStrength: OpponentStrengthRow | null;
};

export function mapUpcomingGamesForTeam(
  teamId: number,
  games: Pick<GameRow, "id" | "date" | "homeTeamId" | "awayTeamId">[]
): UpcomingGame[] {
  return games
    .filter((game) => game.homeTeamId === teamId || game.awayTeamId === teamId)
    .map((game) => {
      const isHome = game.homeTeamId === teamId;
      return {
        gameId: Number(game.id),
        gameDate: String(game.date).slice(0, 10),
        teamId,
        opponentTeamId: Number(isHome ? game.awayTeamId : game.homeTeamId),
        isHome
      };
    })
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate));
}

export async function getPlayerCurrentTeamId(
  playerId: number
): Promise<number | null> {
  const { data, error } = await supabase
    .from("rosters")
    .select("teamId, seasonId")
    .eq("playerId", playerId)
    .order("seasonId", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.teamId != null ? Number(data.teamId) : null;
}

export async function getUpcomingScheduleForPlayer(
  playerId: number,
  options: {
    snapshotDate?: string;
    limit?: number;
  } = {}
): Promise<UpcomingGame[]> {
  const snapshotDate =
    typeof options.snapshotDate === "string" && options.snapshotDate.trim()
      ? options.snapshotDate.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const limit = Math.max(1, Math.min(25, options.limit ?? 10));

  const teamId = await getPlayerCurrentTeamId(playerId);
  if (!teamId) return [];

  const { data, error } = await supabase
    .from("games")
    .select("id, date, homeTeamId, awayTeamId")
    .gte("date", snapshotDate)
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
    .order("date", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return mapUpcomingGamesForTeam(
    teamId,
    ((data as GameRow[] | null) ?? []).slice(0, limit)
  );
}

function per60(total: number | null | undefined, toi: number | null | undefined) {
  if (!Number.isFinite(total) || !Number.isFinite(toi) || Number(toi) <= 0) {
    return null;
  }
  return Number(((Number(total) * 60) / Number(toi)).toFixed(4));
}

export function mapOpponentStrengthRecord(
  row: {
    team_abbreviation: string;
    date?: string | null;
    season?: number | null;
    gp?: number | null;
    toi?: number | null;
    xga?: number | null;
    ca?: number | null;
    sca?: number | null;
    hdca?: number | null;
    sv_pct?: number | null;
  },
  source: "nst_team_all" | "nst_team_stats",
  pkTier: number | null = null
): OpponentStrengthRow {
  return {
    teamAbbreviation: row.team_abbreviation,
    source,
    sourceDate:
      source === "nst_team_all"
        ? row.date ?? null
        : row.season != null
          ? String(row.season)
          : null,
    gamesPlayed: Number.isFinite(row.gp) ? Number(row.gp) : 0,
    xgaPer60: per60(row.xga ?? null, row.toi ?? null),
    caPer60: per60(row.ca ?? null, row.toi ?? null),
    scaPer60: per60(row.sca ?? null, row.toi ?? null),
    hdcaPer60: per60(row.hdca ?? null, row.toi ?? null),
    svPct:
      typeof row.sv_pct === "number" && Number.isFinite(row.sv_pct)
        ? Number(row.sv_pct)
        : null,
    pkTier
  };
}

export async function getOpponentStrengths(
  teamAbbreviations: string[],
  asOfDate: string
): Promise<Record<string, OpponentStrengthRow>> {
  const normalized = Array.from(
    new Set(
      teamAbbreviations
        .map((team) => team.trim().toUpperCase())
        .filter(Boolean)
    )
  );
  if (!normalized.length) return {};

  const ratingRows = await supabase
    .from("team_power_ratings_daily")
    .select("team_abbreviation, pk_tier")
    .in("team_abbreviation", normalized)
    .lte("date", asOfDate)
    .order("date", { ascending: false });
  if (ratingRows.error) throw ratingRows.error;
  const pkTierByTeam = new Map<string, number | null>();
  for (const row of ratingRows.data ?? []) {
    const team = String(row.team_abbreviation ?? "").toUpperCase();
    if (!team || pkTierByTeam.has(team)) continue;
    pkTierByTeam.set(
      team,
      typeof row.pk_tier === "number" && Number.isFinite(row.pk_tier)
        ? Number(row.pk_tier)
        : null
    );
  }

  const dailyRes = await supabase
    .from("nst_team_all")
    .select("team_abbreviation, date, gp, toi, xga, ca, sca, hdca, sv_pct")
    .in("team_abbreviation", normalized)
    .eq("situation", "all")
    .lte("date", asOfDate)
    .order("date", { ascending: false });
  if (dailyRes.error) throw dailyRes.error;

  const out: Record<string, OpponentStrengthRow> = {};
  for (const row of dailyRes.data ?? []) {
    const team = String(row.team_abbreviation ?? "").toUpperCase();
    if (!team || out[team]) continue;
    out[team] = mapOpponentStrengthRecord(
      row,
      "nst_team_all",
      pkTierByTeam.get(team) ?? null
    );
  }

  const missing = normalized.filter((team) => !out[team]);
  if (!missing.length) return out;

  const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
  const season = asOf.getUTCMonth() + 1 >= 7 ? asOf.getUTCFullYear() : asOf.getUTCFullYear() - 1;
  const seasonRes = await supabase
    .from("nst_team_stats")
    .select("team_abbreviation, season, gp, toi, xga, ca, sca, hdca, sv_pct")
    .in("team_abbreviation", missing)
    .eq("situation", "all")
    .lte("season", season)
    .order("season", { ascending: false });
  if (seasonRes.error) throw seasonRes.error;

  for (const row of seasonRes.data ?? []) {
    const team = String(row.team_abbreviation ?? "").toUpperCase();
    if (!team || out[team]) continue;
    out[team] = mapOpponentStrengthRecord(
      row,
      "nst_team_stats",
      pkTierByTeam.get(team) ?? null
    );
  }

  return out;
}

export function mergeUpcomingOpponents(
  games: UpcomingGame[],
  teamAbbreviationById: Record<number, string | null>,
  opponentStrengths: Record<string, OpponentStrengthRow>
): UpcomingOpponent[] {
  return games.map((game) => {
    const opponentTeamAbbreviation =
      teamAbbreviationById[game.opponentTeamId] ?? null;
    const strength =
      opponentTeamAbbreviation != null
        ? opponentStrengths[opponentTeamAbbreviation.toUpperCase()] ?? null
        : null;
    return {
      ...game,
      opponentTeamAbbreviation,
      opponentStrength: strength
    };
  });
}

export async function getUpcomingOpponents(
  playerId: number,
  nGames = 10,
  snapshotDate?: string
): Promise<UpcomingOpponent[]> {
  const games = await getUpcomingScheduleForPlayer(playerId, {
    limit: nGames,
    snapshotDate
  });
  if (!games.length) return [];

  const opponentTeamIds = Array.from(
    new Set(games.map((game) => game.opponentTeamId))
  );
  const { data: teamRows, error: teamError } = await supabase
    .from("teams")
    .select("id, abbreviation")
    .in("id", opponentTeamIds);
  if (teamError) throw teamError;

  const teamAbbreviationById: Record<number, string | null> = {};
  for (const row of teamRows ?? []) {
    teamAbbreviationById[Number(row.id)] =
      row.abbreviation != null ? String(row.abbreviation).toUpperCase() : null;
  }

  const opponentAbbreviations = Object.values(teamAbbreviationById).filter(
    (abbr): abbr is string => Boolean(abbr)
  );
  const opponentStrengths = await getOpponentStrengths(
    opponentAbbreviations,
    snapshotDate ?? new Date().toISOString().slice(0, 10)
  );

  return mergeUpcomingOpponents(
    games.slice(0, Math.max(1, Math.min(25, nGames))),
    teamAbbreviationById,
    opponentStrengths
  );
}
