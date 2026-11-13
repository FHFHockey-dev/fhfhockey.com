import type { SupabaseClient } from "@supabase/supabase-js";

import supabaseServer from "../supabase/server";
import {
  DESCRIPTIVE_SOS_VERSION,
  recordPercentage
} from "../trends/strengthOfScheduleContract";
import { TEAM_SOS_TABLE } from "../trends/teamSosSnapshot";
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

/**
 * One descriptive-sos-v2 row of `team_sos_daily` (lane F2). Means are over
 * fixtures of opponents' records excluding games against the team; past counts
 * final games only, started or postponed fixtures are pending, and both
 * indirect terms use opponents' past records (W2 D7). v1 `sos_standings` rows
 * are frozen history and are not served here (rule 21).
 */
export type TeamSosLandingRow = {
  future_direct_points_pct: number | null;
  future_fixtures: number | null;
  future_indirect_points_pct: number | null;
  future_opponents: unknown;
  past_direct_points_pct: number | null;
  past_fixtures: number | null;
  past_indirect_points_pct: number | null;
  past_opponents: unknown;
  pending_fixtures: number | null;
  season_id: number;
  snapshot_date: string;
  sos_version: string;
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
  /** Past bucket only: started or postponed fixtures without a final result. */
  pendingFixtures?: number;
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
  /** snapshot_date of the v2 row served; null when no v2 snapshot is in range. */
  snapshotDate: string | null;
  sos: number | null;
  sosVersion: typeof DESCRIPTIVE_SOS_VERSION | null;
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
/** A v2 snapshot older than this is not served (season gaps, a stalled writer). */
const SOS_SNAPSHOT_MAX_AGE_DAYS = 7;
const TEAM_SOS_LANDING_COLUMNS = [
  "season_id",
  "snapshot_date",
  "team_abbrev",
  "sos_version",
  "past_fixtures",
  "pending_fixtures",
  "future_fixtures",
  "past_direct_points_pct",
  "past_indirect_points_pct",
  "future_direct_points_pct",
  "future_indirect_points_pct",
  "past_opponents",
  "future_opponents"
].join(",");

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
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

export const computePointPctFromRecord = (
  wins: number | null,
  losses: number | null,
  otLosses: number | null
): number | null => {
  return recordPercentage(wins, losses, otLosses, "points-pct");
};

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

const computeScheduleBucket = (
  row: TeamSosLandingRow,
  bucket: "future" | "past"
): Omit<UnderlyingStatsScheduleBucket, "rank"> => {
  const directOpponentPointPct = toFiniteNumber(
    bucket === "past" ? row.past_direct_points_pct : row.future_direct_points_pct
  );
  const indirectOpponentPointPct = toFiniteNumber(
    bucket === "past"
      ? row.past_indirect_points_pct
      : row.future_indirect_points_pct
  );
  const opponents = parseOpponents(
    bucket === "past" ? row.past_opponents : row.future_opponents
  );
  const fixtures = toFiniteNumber(
    bucket === "past" ? row.past_fixtures : row.future_fixtures
  );
  // Decision 93: the landing keeps its 2:1 direct:indirect record-only sos.
  const sos =
    typeof directOpponentPointPct === "number" &&
    typeof indirectOpponentPointPct === "number"
      ? (2 * directOpponentPointPct + indirectOpponentPointPct) / 3
      : (directOpponentPointPct ?? indirectOpponentPointPct);

  return {
    directOpponentPointPct,
    indirectOpponentPointPct,
    opponentGamesPlayed: fixtures ?? opponents.length,
    ...(bucket === "past"
      ? { pendingFixtures: toFiniteNumber(row.pending_fixtures) ?? 0 }
      : {}),
    sos,
    uniqueOpponents: new Set(opponents.map((entry) => entry.opponent)).size
  };
};

export const computeUnderlyingStatsTeamScheduleStrength = ({
  date,
  scheduleRows
}: {
  date: string;
  scheduleRows: TeamSosLandingRow[];
}): Map<string, UnderlyingStatsTeamScheduleStrength> => {
  const rowsByTeam = new Map<string, TeamSosLandingRow>();

  scheduleRows.forEach((row) => {
    if (
      row.sos_version !== DESCRIPTIVE_SOS_VERSION ||
      !isNonEmptyString(row.team_abbrev)
    ) {
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
    const row = rowsByTeam.get(teamAbbr)!;
    const past = computeScheduleBucket(row, "past");
    const future = computeScheduleBucket(row, "future");

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
      snapshotDate: rowsByTeam.get(teamAbbr)?.snapshot_date ?? null,
      sos:
        typeof past.sos === "number" && typeof future.sos === "number"
          ? (past.sos + future.sos) / 2
          : (past.sos ?? future.sos ?? null),
      sosVersion: DESCRIPTIVE_SOS_VERSION,
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

  const fetchLatestV2Rows = async () => {
    const latestResponse = await supabase
      .from(TEAM_SOS_TABLE)
      .select("snapshot_date")
      .eq("sos_version", DESCRIPTIVE_SOS_VERSION)
      .lte("snapshot_date", date)
      .gte("snapshot_date", addDays(date, -SOS_SNAPSHOT_MAX_AGE_DAYS))
      .order("snapshot_date", { ascending: false })
      .limit(1);

    if (latestResponse.error) {
      return latestResponse;
    }

    const snapshotDate = (
      latestResponse.data as Array<{ snapshot_date?: string }> | null
    )?.[0]?.snapshot_date;
    if (!snapshotDate) {
      return { data: [], error: null };
    }

    return supabase
      .from(TEAM_SOS_TABLE)
      .select(TEAM_SOS_LANDING_COLUMNS)
      .eq("sos_version", DESCRIPTIVE_SOS_VERSION)
      .eq("snapshot_date", snapshotDate);
  };

  const [scheduleResponse, gamesResponse] = await Promise.all([
    fetchLatestV2Rows(),
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
      ? (scheduleResponse.data as unknown as TeamSosLandingRow[])
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
      snapshotDate: null,
      sos: null,
      sosVersion: null,
      teamAbbr,
      texture
    });
  });

  return payload;
};

export const clearUnderlyingStatsTeamScheduleStrengthCache = (): void => {
  scheduleStrengthCache.clear();
};
