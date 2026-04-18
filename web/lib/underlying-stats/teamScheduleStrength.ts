import type { SupabaseClient } from "@supabase/supabase-js";

import supabaseServer from "../supabase/server";
import { isValidIsoDate } from "../teamRatingsService";
import { teamsInfo } from "../teamsInfo";

type ScheduleStrengthCacheEntry = {
  expiresAt: number;
  payload: Map<string, UnderlyingStatsTeamScheduleStrength>;
};

type SosOpponentRow = {
  date: string | null;
  opponent: string;
};

type SosStandingSnapshotRow = {
  future_opponent_total_losses: number | null;
  future_opponent_total_ot_losses: number | null;
  future_opponent_total_wins: number | null;
  future_opponents: unknown;
  game_date: string;
  past_opponent_total_losses: number | null;
  past_opponent_total_ot_losses: number | null;
  past_opponent_total_wins: number | null;
  past_opponents: unknown;
  team_abbrev: string | null;
};

type ScheduleGameRow = {
  awayTeamId: number | null;
  date: string;
  homeTeamId: number | null;
};

export type UnderlyingStatsScheduleBucket = {
  directOpponentPointPct: number | null;
  indirectOpponentPointPct: number | null;
  opponentGamesPlayed: number;
  rank: number | null;
  sos: number | null;
  uniqueOpponents: number;
};

export type UnderlyingStatsScheduleTexture = {
  backToBacksNext14: number;
  gamesNext14: number;
  gamesNext7: number;
  homeGamesNext14: number;
  restAdvantageGamesNext14: number;
  restDisadvantageGamesNext14: number;
  roadGamesNext14: number;
  threeInFourNext14: number;
};

export type UnderlyingStatsTeamScheduleStrength = {
  date: string;
  future: UnderlyingStatsScheduleBucket;
  past: UnderlyingStatsScheduleBucket;
  sos: number | null;
  texture: UnderlyingStatsScheduleTexture | null;
  teamAbbr: string;
};

const CACHE_TTL_MS = Number(process.env.TEAM_RATINGS_CACHE_TTL_MS ?? 60_000);
const scheduleStrengthCache = new Map<string, ScheduleStrengthCacheEntry>();
const TEAM_ID_TO_ABBR = new Map(
  Object.values(teamsInfo).map((team) => [team.id, team.abbrev])
);

const buildCacheKey = (date: string): string => date;
const SCHEDULE_LOOKBACK_DAYS = 14;
const SCHEDULE_LOOKAHEAD_DAYS = 14;

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const addDays = (isoDate: string, days: number): string => {
  const nextDate = new Date(`${isoDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString().slice(0, 10);
};

const diffDays = (laterDate: string, earlierDate: string): number =>
  Math.round(
    (Date.parse(`${laterDate}T00:00:00.000Z`) -
      Date.parse(`${earlierDate}T00:00:00.000Z`)) /
      86_400_000
  );

const parseOpponents = (value: unknown): SosOpponentRow[] => {
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

  return (2 * resolvedWins + resolvedOtLosses) / (2 * gamesPlayed);
};

const resolveBucketRecord = (
  row: SosStandingSnapshotRow | undefined,
  bucket: "past" | "future"
): number | null =>
  computePointPctFromRecord(
    toFiniteNumber(
      bucket === "past"
        ? row?.past_opponent_total_wins
        : row?.future_opponent_total_wins
    ),
    toFiniteNumber(
      bucket === "past"
        ? row?.past_opponent_total_losses
        : row?.future_opponent_total_losses
    ),
    toFiniteNumber(
      bucket === "past"
        ? row?.past_opponent_total_ot_losses
        : row?.future_opponent_total_ot_losses
    )
  );

const resolveBucketOpponents = (
  row: SosStandingSnapshotRow | undefined,
  bucket: "past" | "future"
): SosOpponentRow[] =>
  parseOpponents(
    bucket === "past" ? row?.past_opponents : row?.future_opponents
  );

const buildRankMap = (
  valuesByTeam: Map<string, number | null>
): Map<string, number | null> => {
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

const computeScheduleBucket = ({
  bucket,
  rowsByTeam,
  teamAbbr
}: {
  bucket: "future" | "past";
  rowsByTeam: Map<string, SosStandingSnapshotRow>;
  teamAbbr: string;
}): Omit<UnderlyingStatsScheduleBucket, "rank"> => {
  const row = rowsByTeam.get(teamAbbr);
  const directOpponentPointPct = resolveBucketRecord(row, bucket);
  const opponents = resolveBucketOpponents(row, bucket);
  const opponentCounts = buildOpponentCounts(opponents);
  let indirectWeightedSum = 0;
  let indirectWeight = 0;

  opponentCounts.forEach((gamesPlayed, opponentAbbr) => {
    const opponentDirect = resolveBucketRecord(
      rowsByTeam.get(opponentAbbr),
      bucket
    );
    if (typeof opponentDirect !== "number") {
      return;
    }

    indirectWeightedSum += opponentDirect * gamesPlayed;
    indirectWeight += gamesPlayed;
  });

  const indirectOpponentPointPct =
    indirectWeight > 0 ? indirectWeightedSum / indirectWeight : null;
  const sos =
    typeof directOpponentPointPct === "number" &&
    typeof indirectOpponentPointPct === "number"
      ? (2 * directOpponentPointPct + indirectOpponentPointPct) / 3
      : (directOpponentPointPct ?? indirectOpponentPointPct);

  return {
    directOpponentPointPct,
    indirectOpponentPointPct,
    opponentGamesPlayed: opponents.length,
    sos,
    uniqueOpponents: opponentCounts.size
  };
};

export const computeUnderlyingStatsTeamScheduleStrength = ({
  date,
  scheduleRows
}: {
  date: string;
  scheduleRows: SosStandingSnapshotRow[];
}): Map<string, UnderlyingStatsTeamScheduleStrength> => {
  const rowsByTeam = new Map<string, SosStandingSnapshotRow>();

  scheduleRows.forEach((row) => {
    if (!isNonEmptyString(row.team_abbrev)) {
      return;
    }

    rowsByTeam.set(row.team_abbrev.trim().toUpperCase(), row);
  });

  const allTeams = Array.from(rowsByTeam.keys()).sort((a, b) =>
    a.localeCompare(b)
  );
  const pastByTeam = new Map<
    string,
    Omit<UnderlyingStatsScheduleBucket, "rank">
  >();
  const futureByTeam = new Map<
    string,
    Omit<UnderlyingStatsScheduleBucket, "rank">
  >();
  const pastStrengthByTeam = new Map<string, number | null>();
  const futureStrengthByTeam = new Map<string, number | null>();

  allTeams.forEach((teamAbbr) => {
    const past = computeScheduleBucket({
      bucket: "past",
      rowsByTeam,
      teamAbbr
    });
    const future = computeScheduleBucket({
      bucket: "future",
      rowsByTeam,
      teamAbbr
    });

    pastByTeam.set(teamAbbr, past);
    futureByTeam.set(teamAbbr, future);
    pastStrengthByTeam.set(teamAbbr, past.sos);
    futureStrengthByTeam.set(teamAbbr, future.sos);
  });

  const pastRankMap = buildRankMap(pastStrengthByTeam);
  const futureRankMap = buildRankMap(futureStrengthByTeam);
  const payload = new Map<string, UnderlyingStatsTeamScheduleStrength>();

  allTeams.forEach((teamAbbr) => {
    const past = pastByTeam.get(teamAbbr);
    const future = futureByTeam.get(teamAbbr);

    if (!past || !future) {
      return;
    }

    payload.set(teamAbbr, {
      date,
      future: {
        ...future,
        rank: futureRankMap.get(teamAbbr) ?? null
      },
      past: {
        ...past,
        rank: pastRankMap.get(teamAbbr) ?? null
      },
      sos:
        typeof past.sos === "number" && typeof future.sos === "number"
          ? (past.sos + future.sos) / 2
          : (past.sos ?? future.sos ?? null),
      texture: null,
      teamAbbr
    });
  });

  return payload;
};

type ScheduleEvent = {
  date: string;
  isHome: boolean;
  opponentAbbr: string;
};

const emptyTexture = (): UnderlyingStatsScheduleTexture => ({
  backToBacksNext14: 0,
  gamesNext14: 0,
  gamesNext7: 0,
  homeGamesNext14: 0,
  restAdvantageGamesNext14: 0,
  restDisadvantageGamesNext14: 0,
  roadGamesNext14: 0,
  threeInFourNext14: 0
});

const resolveScheduleEvent = (
  game: ScheduleGameRow,
  teamId: number
): ScheduleEvent | null => {
  if (game.homeTeamId === teamId) {
    const opponentAbbr =
      typeof game.awayTeamId === "number"
        ? TEAM_ID_TO_ABBR.get(game.awayTeamId)
        : null;

    if (!opponentAbbr) {
      return null;
    }

    return {
      date: game.date,
      isHome: true,
      opponentAbbr
    };
  }

  if (game.awayTeamId === teamId) {
    const opponentAbbr =
      typeof game.homeTeamId === "number"
        ? TEAM_ID_TO_ABBR.get(game.homeTeamId)
        : null;

    if (!opponentAbbr) {
      return null;
    }

    return {
      date: game.date,
      isHome: false,
      opponentAbbr
    };
  }

  return null;
};

const buildPreviousGameMap = (
  events: ScheduleEvent[]
): Map<string, string | null> => {
  const previousByDate = new Map<string, string | null>();
  let previousDate: string | null = null;

  events.forEach((event) => {
    previousByDate.set(event.date, previousDate);
    previousDate = event.date;
  });

  return previousByDate;
};

export const computeUnderlyingStatsScheduleTexture = ({
  date,
  games
}: {
  date: string;
  games: ScheduleGameRow[];
}): Map<string, UnderlyingStatsScheduleTexture> => {
  const scheduleByTeam = new Map<string, ScheduleEvent[]>();

  TEAM_ID_TO_ABBR.forEach((teamAbbr, teamId) => {
    const events = games
      .map((game) => resolveScheduleEvent(game, teamId))
      .filter((event): event is ScheduleEvent => Boolean(event))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (events.length) {
      scheduleByTeam.set(teamAbbr, events);
    }
  });

  const payload = new Map<string, UnderlyingStatsScheduleTexture>();

  scheduleByTeam.forEach((events, teamAbbr) => {
    const next7EndDate = addDays(date, 7);
    const next14EndDate = addDays(date, 14);
    const previousByDate = buildPreviousGameMap(events);
    const upcoming = events.filter((event) => event.date > date);
    const next7 = upcoming.filter((event) => event.date <= next7EndDate);
    const next14 = upcoming.filter((event) => event.date <= next14EndDate);
    const texture = emptyTexture();

    texture.gamesNext7 = next7.length;
    texture.gamesNext14 = next14.length;
    texture.homeGamesNext14 = next14.filter((event) => event.isHome).length;
    texture.roadGamesNext14 = next14.filter((event) => !event.isHome).length;

    next14.forEach((event, index) => {
      const nextEvent = next14[index + 1];
      const thirdEvent = next14[index + 2];

      if (nextEvent && diffDays(nextEvent.date, event.date) === 1) {
        texture.backToBacksNext14 += 1;
      }

      if (thirdEvent && diffDays(thirdEvent.date, event.date) <= 3) {
        texture.threeInFourNext14 += 1;
      }

      const opponentEvents = scheduleByTeam.get(event.opponentAbbr) ?? [];
      const opponentPreviousByDate = buildPreviousGameMap(opponentEvents);
      const previousTeamGame = previousByDate.get(event.date) ?? null;
      const previousOpponentGame =
        opponentPreviousByDate.get(event.date) ?? null;

      if (!previousTeamGame || !previousOpponentGame) {
        return;
      }

      const teamRestDays = diffDays(event.date, previousTeamGame) - 1;
      const opponentRestDays = diffDays(event.date, previousOpponentGame) - 1;

      if (teamRestDays > opponentRestDays) {
        texture.restAdvantageGamesNext14 += 1;
      } else if (teamRestDays < opponentRestDays) {
        texture.restDisadvantageGamesNext14 += 1;
      }
    });

    payload.set(teamAbbr, texture);
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

  const payload = await fetchUnderlyingStatsTeamScheduleStrengthForRatings(
    date,
    [],
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
  ratings: Array<{ teamAbbr?: string }> = [],
  supabase: SupabaseClient = supabaseServer
): Promise<Map<string, UnderlyingStatsTeamScheduleStrength>> => {
  if (!isValidIsoDate(date)) {
    return new Map();
  }

  const [scheduleResponse, gamesResponse] = await Promise.all([
    supabase
      .from("sos_standings")
      .select(
        [
          "game_date",
          "team_abbrev",
          "past_opponent_total_wins",
          "past_opponent_total_losses",
          "past_opponent_total_ot_losses",
          "past_opponents",
          "future_opponent_total_wins",
          "future_opponent_total_losses",
          "future_opponent_total_ot_losses",
          "future_opponents"
        ].join(",")
      )
      .eq("game_date", date),
    supabase
      .from("games")
      .select('date,"homeTeamId","awayTeamId"')
      .gte("date", addDays(date, -SCHEDULE_LOOKBACK_DAYS))
      .lte("date", addDays(date, SCHEDULE_LOOKAHEAD_DAYS))
      .eq("type", 2)
  ]);

  if (scheduleResponse.error) {
    throw scheduleResponse.error;
  }

  if (gamesResponse.error) {
    throw gamesResponse.error;
  }

  const baseMap = computeUnderlyingStatsTeamScheduleStrength({
    date,
    scheduleRows: Array.isArray(scheduleResponse.data)
      ? (scheduleResponse.data as unknown as SosStandingSnapshotRow[])
      : []
  });
  const textureByTeam = computeUnderlyingStatsScheduleTexture({
    date,
    games: Array.isArray(gamesResponse.data)
      ? (gamesResponse.data as unknown as ScheduleGameRow[])
      : []
  });
  const payload = new Map<string, UnderlyingStatsTeamScheduleStrength>();
  const allTeams = new Set<string>([
    ...Array.from(baseMap.keys()),
    ...Array.from(textureByTeam.keys()),
    ...ratings
      .map((rating) => rating.teamAbbr?.trim().toUpperCase())
      .filter((teamAbbr): teamAbbr is string => Boolean(teamAbbr))
  ]);

  allTeams.forEach((teamAbbr) => {
    const strength = baseMap.get(teamAbbr);
    const texture = textureByTeam.get(teamAbbr) ?? null;

    if (strength) {
      payload.set(teamAbbr, {
        ...strength,
        texture
      });
      return;
    }

    payload.set(teamAbbr, {
      date,
      future: {
        directOpponentPointPct: null,
        indirectOpponentPointPct: null,
        opponentGamesPlayed: 0,
        rank: null,
        sos: null,
        uniqueOpponents: 0
      },
      past: {
        directOpponentPointPct: null,
        indirectOpponentPointPct: null,
        opponentGamesPlayed: 0,
        rank: null,
        sos: null,
        uniqueOpponents: 0
      },
      sos: null,
      teamAbbr,
      texture
    });
  });

  return payload;
};

export const clearUnderlyingStatsTeamScheduleStrengthCache = (): void => {
  scheduleStrengthCache.clear();
};
