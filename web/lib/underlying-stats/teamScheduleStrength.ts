import type { SupabaseClient } from "@supabase/supabase-js";
import supabaseServer from "../supabase/server";
import { computeTeamPowerScore } from "../dashboard/teamContext";
import { fetchTeamRatings, isValidIsoDate, type TeamRating } from "../teamRatingsService";

type ScheduleStrengthCacheEntry = {
  expiresAt: number;
  payload: Map<string, UnderlyingStatsTeamScheduleStrength>;
};

type SosOpponentRow = {
  date: string | null;
  opponent: string;
};

type SosStandingSnapshotRow = {
  game_date: string;
  team_abbrev: string | null;
  past_opponent_total_wins: number | null;
  past_opponent_total_losses: number | null;
  past_opponent_total_ot_losses: number | null;
  past_opponents: unknown;
};

export type UnderlyingStatsTeamScheduleStrength = {
  teamAbbr: string;
  date: string;
  sos: number;
  standingsComponentScore: number;
  predictiveComponentScore: number;
  standingsRaw: number | null;
  predictiveRaw: number | null;
  directOpponentPointPct: number | null;
  opponentScheduleContext: number | null;
  opponentGamesPlayed: number;
  uniqueOpponents: number;
};

const CACHE_TTL_MS = Number(process.env.TEAM_RATINGS_CACHE_TTL_MS ?? 60_000);
const SCORE_CENTER = 100;
const SCORE_SPREAD = 15;
const STANDINGS_DIRECT_WEIGHT = 0.75;
const STANDINGS_INDIRECT_WEIGHT = 0.25;
const FINAL_BLEND_WEIGHT = 0.5;
const scheduleStrengthCache = new Map<string, ScheduleStrengthCacheEntry>();

const buildCacheKey = (date: string): string => date;

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const parsePastOpponents = (value: unknown): SosOpponentRow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const opponent = isNonEmptyString(row.opponent)
        ? row.opponent.trim().toUpperCase()
        : null;
      const date = isNonEmptyString(row.date) ? row.date.trim() : null;

      if (!opponent) {
        return null;
      }

      return { opponent, date };
    })
    .filter((entry): entry is SosOpponentRow => Boolean(entry));
};

const buildOpponentCounts = (
  opponents: SosOpponentRow[]
): Map<string, number> => {
  const counts = new Map<string, number>();

  opponents.forEach((opponent) => {
    if (!opponent.opponent) {
      return;
    }
    counts.set(opponent.opponent, (counts.get(opponent.opponent) ?? 0) + 1);
  });

  return counts;
};

export const computePointPctFromRecord = (
  wins: number | null,
  losses: number | null,
  otLosses: number | null
): number | null => {
  const resolvedWins = wins ?? 0;
  const resolvedLosses = losses ?? 0;
  const resolvedOtLosses = otLosses ?? 0;
  const gamesPlayed = resolvedWins + resolvedLosses + resolvedOtLosses;

  if (gamesPlayed <= 0) {
    return null;
  }

  return (
    (2 * resolvedWins + resolvedOtLosses) / (2 * gamesPlayed)
  );
};

const normalizeRawStrengths = (
  rawByTeam: Map<string, number | null>
): Map<string, number> => {
  const validEntries = Array.from(rawByTeam.entries()).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number"
  );

  if (!validEntries.length) {
    return new Map(
      Array.from(rawByTeam.keys()).map((teamAbbr) => [teamAbbr, SCORE_CENTER])
    );
  }

  const rawValues = validEntries.map(([, value]) => value);
  const mean =
    rawValues.reduce((sum, value) => sum + value, 0) / rawValues.length;
  const stddev = Math.sqrt(
    rawValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      rawValues.length
  );

  return new Map(
    Array.from(rawByTeam.entries()).map(([teamAbbr, rawValue]) => {
      if (typeof rawValue !== "number") {
        return [teamAbbr, SCORE_CENTER];
      }

      if (stddev === 0) {
        return [teamAbbr, SCORE_CENTER];
      }

      return [
        teamAbbr,
        Number((SCORE_CENTER + SCORE_SPREAD * ((rawValue - mean) / stddev)).toFixed(2))
      ];
    })
  );
};

export const computeUnderlyingStatsTeamScheduleStrength = ({
  date,
  ratings,
  scheduleRows
}: {
  date: string;
  ratings: TeamRating[];
  scheduleRows: SosStandingSnapshotRow[];
}): Map<string, UnderlyingStatsTeamScheduleStrength> => {
  const rowsByTeam = new Map<string, SosStandingSnapshotRow>();
  scheduleRows.forEach((row) => {
    if (!isNonEmptyString(row.team_abbrev)) {
      return;
    }
    rowsByTeam.set(row.team_abbrev.trim().toUpperCase(), row);
  });

  const ratingsByTeam = new Map(
    ratings.map((rating) => [
      rating.teamAbbr,
      {
        powerScore: computeTeamPowerScore(rating)
      }
    ])
  );

  const allTeams = Array.from(
    new Set([...rowsByTeam.keys(), ...ratings.map((rating) => rating.teamAbbr)])
  ).sort((a, b) => a.localeCompare(b));

  const directByTeam = new Map<string, number | null>();
  const indirectByTeam = new Map<string, number | null>();
  const standingsRawByTeam = new Map<string, number | null>();
  const predictiveRawByTeam = new Map<string, number | null>();
  const metadataByTeam = new Map<
    string,
    { opponentGamesPlayed: number; uniqueOpponents: number }
  >();

  const directPointPctByTeam = new Map<string, number | null>();

  allTeams.forEach((teamAbbr) => {
    const row = rowsByTeam.get(teamAbbr);
    const direct = row
      ? computePointPctFromRecord(
          toFiniteNumber(row.past_opponent_total_wins),
          toFiniteNumber(row.past_opponent_total_losses),
          toFiniteNumber(row.past_opponent_total_ot_losses)
        )
      : null;

    directPointPctByTeam.set(teamAbbr, direct);
  });

  allTeams.forEach((teamAbbr) => {
    const row = rowsByTeam.get(teamAbbr);
    const opponents = parsePastOpponents(row?.past_opponents);
    const opponentCounts = buildOpponentCounts(opponents);
    let indirectWeightedSum = 0;
    let indirectWeight = 0;
    let predictiveWeightedSum = 0;
    let predictiveWeight = 0;

    opponentCounts.forEach((gamesPlayed, opponentAbbr) => {
      const opponentDirect = directPointPctByTeam.get(opponentAbbr) ?? null;
      if (typeof opponentDirect === "number") {
        indirectWeightedSum += opponentDirect * gamesPlayed;
        indirectWeight += gamesPlayed;
      }

      const opponentRating = ratingsByTeam.get(opponentAbbr);
      if (opponentRating) {
        predictiveWeightedSum += opponentRating.powerScore * gamesPlayed;
        predictiveWeight += gamesPlayed;
      }
    });

    const indirect =
      indirectWeight > 0 ? indirectWeightedSum / indirectWeight : null;
    const predictiveRaw =
      predictiveWeight > 0 ? predictiveWeightedSum / predictiveWeight : null;
    const direct = directPointPctByTeam.get(teamAbbr) ?? null;
    const standingsRaw =
      typeof direct === "number" && typeof indirect === "number"
        ? STANDINGS_DIRECT_WEIGHT * direct +
          STANDINGS_INDIRECT_WEIGHT * indirect
        : typeof direct === "number"
          ? direct
          : null;

    directByTeam.set(teamAbbr, direct);
    indirectByTeam.set(teamAbbr, indirect);
    standingsRawByTeam.set(teamAbbr, standingsRaw);
    predictiveRawByTeam.set(teamAbbr, predictiveRaw);
    metadataByTeam.set(teamAbbr, {
      opponentGamesPlayed: opponents.length,
      uniqueOpponents: opponentCounts.size
    });
  });

  const standingsScores = normalizeRawStrengths(standingsRawByTeam);
  const predictiveScores = normalizeRawStrengths(predictiveRawByTeam);
  const payload = new Map<string, UnderlyingStatsTeamScheduleStrength>();

  allTeams.forEach((teamAbbr) => {
    const standingsComponentScore =
      standingsScores.get(teamAbbr) ?? SCORE_CENTER;
    const predictiveComponentScore =
      predictiveScores.get(teamAbbr) ?? SCORE_CENTER;
    const metadata = metadataByTeam.get(teamAbbr) ?? {
      opponentGamesPlayed: 0,
      uniqueOpponents: 0
    };

    payload.set(teamAbbr, {
      teamAbbr,
      date,
      sos: Number(
        (
          FINAL_BLEND_WEIGHT * standingsComponentScore +
          FINAL_BLEND_WEIGHT * predictiveComponentScore
        ).toFixed(2)
      ),
      standingsComponentScore,
      predictiveComponentScore,
      standingsRaw: standingsRawByTeam.get(teamAbbr) ?? null,
      predictiveRaw: predictiveRawByTeam.get(teamAbbr) ?? null,
      directOpponentPointPct: directByTeam.get(teamAbbr) ?? null,
      opponentScheduleContext: indirectByTeam.get(teamAbbr) ?? null,
      opponentGamesPlayed: metadata.opponentGamesPlayed,
      uniqueOpponents: metadata.uniqueOpponents
    });
  });

  return payload;
};

export const fetchUnderlyingStatsTeamScheduleStrength = async (
  date: string,
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, UnderlyingStatsTeamScheduleStrength>> => {
  if (!isValidIsoDate(date)) {
    return new Map();
  }

  const cacheKey = buildCacheKey(date);
  const cached = scheduleStrengthCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const ratings = await fetchTeamRatings(date);
  const payload = await fetchUnderlyingStatsTeamScheduleStrengthForRatings(
    date,
    ratings,
    supabase
  );

  scheduleStrengthCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + CACHE_TTL_MS
  });

  return payload;
};

export const fetchUnderlyingStatsTeamScheduleStrengthForRatings = async (
  date: string,
  ratings: TeamRating[],
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, UnderlyingStatsTeamScheduleStrength>> => {
  if (!isValidIsoDate(date)) {
    return new Map();
  }

  const { data: scheduleRows, error: scheduleError } = await supabase
    .from("sos_standings")
    .select(
      "game_date, team_abbrev, past_opponent_total_wins, past_opponent_total_losses, past_opponent_total_ot_losses, past_opponents"
    )
    .eq("game_date", date);

  if (scheduleError) {
    throw scheduleError;
  }

  const payload = computeUnderlyingStatsTeamScheduleStrength({
    date,
    ratings,
    scheduleRows: Array.isArray(scheduleRows)
      ? (scheduleRows as SosStandingSnapshotRow[])
      : []
  });

  return payload;
};

export const clearUnderlyingStatsTeamScheduleStrengthCache = (): void => {
  scheduleStrengthCache.clear();
};
