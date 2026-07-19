/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\fetchAggregatedData.ts

import supabase from "lib/supabase";
import type { Database } from "lib/supabase/database-generated.types";
import {
  DEFAULT_SUPABASE_FILTER_CHUNK_SIZE,
  DEFAULT_SUPABASE_PAGE_SIZE,
  fetchAllSupabaseFilterChunks,
  fetchAllSupabasePages,
} from "lib/supabase/pagination";

export const SHIFT_CHART_PAGE_SIZE = DEFAULT_SUPABASE_PAGE_SIZE;
export const PLAYER_FALLBACK_CHUNK_SIZE = DEFAULT_SUPABASE_FILTER_CHUNK_SIZE;
export const CARD_STATS_FILTER_CHUNK_SIZE = DEFAULT_SUPABASE_FILTER_CHUNK_SIZE;

type ShiftChartTableRow = Database["public"]["Tables"]["shift_charts"]["Row"];
type ShiftChartRow = Pick<
  ShiftChartTableRow,
  | "id"
  | "game_id"
  | "game_type"
  | "player_id"
  | "player_first_name"
  | "player_last_name"
  | "team_id"
  | "team_abbreviation"
  | "game_toi"
  | "home_or_away"
  | "opponent_team_abbreviation"
  | "opponent_team_id"
  | "display_position"
  | "primary_position"
  | "time_spent_with"
  | "percent_toi_with"
  | "time_spent_with_mixed"
  | "percent_toi_with_mixed"
  | "game_length"
  | "line_combination"
  | "pairing_combination"
  | "season_id"
  | "player_type"
>;

type PlayerPositionFallback = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "fullName" | "position" | "sweater_number"
>;

type SkaterGameStatsRow = Pick<
  Database["public"]["Tables"]["skatersGameStats"]["Row"],
  | "created_at"
  | "gameId"
  | "playerId"
  | "goals"
  | "assists"
  | "points"
  | "powerPlayPoints"
  | "shots"
  | "hits"
  | "blockedShots"
  | "plusMinus"
>;

type GoalieGameStatsRow = Pick<
  Database["public"]["Tables"]["goaliesGameStats"]["Row"],
  | "created_at"
  | "gameId"
  | "playerId"
  | "goalsAgainst"
  | "saveShotsAgainst"
  | "toi"
>;

export type ScopedSkaterCardStats = {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  powerPlayPoints: number;
  shots: number;
  hits: number;
  blockedShots: number;
  plusMinus: number;
};

export type ScopedGoalieCardStats = {
  gamesPlayed: number;
  saves: number;
  savePercentage: number | null;
  goalsAgainstAverage: number;
};

export type ScopedCardStats = {
  scopeGameIds: number[];
  skatersByPlayerId: Record<number, ScopedSkaterCardStats>;
  goaliesByPlayerId: Record<number, ScopedGoalieCardStats>;
};

export const EMPTY_SCOPED_CARD_STATS: ScopedCardStats = {
  scopeGameIds: [],
  skatersByPlayerId: {},
  goaliesByPlayerId: {},
};

export type FetchAggregatedDataRequest = {
  teamId: number;
  seasonId: number;
  startDate: string;
  endDate: string;
  seasonType: "regularSeason" | "playoffs";
  gameIds?: number[];
  homeOrAway?: "home" | "away" | "";
  opponentTeamAbbreviation?: string;
};

function getPlayerTypeFromPosition(position: string | null | undefined) {
  const normalized = (position ?? "").toUpperCase();
  if (["LW", "RW", "C", "L", "R"].includes(normalized)) return "F";
  if (normalized === "D") return "D";
  if (normalized === "G") return "G";
  return null;
}

async function fetchPlayerPositionFallbacks(playerIds: number[]) {
  const uniqueIds = Array.from(new Set(playerIds.filter(Number.isFinite)));
  if (uniqueIds.length === 0) return new Map<number, PlayerPositionFallback>();

  const fallbackRows = await fetchAllSupabaseFilterChunks<
    PlayerPositionFallback,
    number
  >(uniqueIds, (idChunk, { from, to }) =>
    supabase
      .from("players")
      .select("id,fullName,position,sweater_number")
      .in("id", idChunk)
      .order("id", { ascending: true })
      .range(from, to),
  );

  return new Map(fallbackRows.map((player) => [player.id, player]));
}

function applyPlayerPositionFallbacks(
  playersData: Record<string, any>,
  fallbackByPlayerId: Map<number, PlayerPositionFallback>,
) {
  Object.values(playersData).forEach((player: any) => {
    const fallback = fallbackByPlayerId.get(Number(player.playerId));
    if (!fallback) return;

    if (!player.primaryPosition && fallback.position) {
      player.primaryPosition = fallback.position;
    }
    if (!player.displayPosition && fallback.position) {
      player.displayPosition = fallback.position;
    }
    if (!player.playerType) {
      player.playerType = getPlayerTypeFromPosition(
        player.primaryPosition ?? fallback.position,
      );
    }
    if (!player.playerName?.trim() && fallback.fullName) {
      player.playerName = fallback.fullName;
    }
    if (!player.playerAbbrevName?.trim() && fallback.fullName) {
      const parts = fallback.fullName.split(" ");
      player.playerAbbrevName =
        parts.length > 1
          ? `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}`
          : fallback.fullName;
    }
    if (!player.lastName && fallback.fullName) {
      player.lastName =
        fallback.fullName.split(" ").slice(1).join(" ") || fallback.fullName;
    }
    if (player.sweaterNumber == null && fallback.sweater_number != null) {
      player.sweaterNumber = fallback.sweater_number;
    }
  });
}

function chunkPositiveIntegers(values: Iterable<number>) {
  const uniqueValues = Array.from(
    new Set(
      Array.from(values).filter(
        (value) => Number.isSafeInteger(value) && value > 0,
      ),
    ),
  );
  const chunks: number[][] = [];
  for (
    let index = 0;
    index < uniqueValues.length;
    index += CARD_STATS_FILTER_CHUNK_SIZE
  ) {
    chunks.push(
      uniqueValues.slice(index, index + CARD_STATS_FILTER_CHUNK_SIZE),
    );
  }
  return chunks;
}

async function fetchScopedSkaterRows(gameIds: number[], playerIds: number[]) {
  if (gameIds.length === 0 || playerIds.length === 0) {
    return [] as SkaterGameStatsRow[];
  }

  const rows: SkaterGameStatsRow[] = [];
  for (const gameIdChunk of chunkPositiveIntegers(gameIds)) {
    const chunkRows = await fetchAllSupabaseFilterChunks<
      SkaterGameStatsRow,
      number
    >(
      playerIds,
      (playerIdChunk, { from, to }) =>
        supabase
          .from("skatersGameStats")
          .select(
            "created_at,gameId,playerId,goals,assists,points,powerPlayPoints,shots,hits,blockedShots,plusMinus",
          )
          .in("gameId", gameIdChunk)
          .in("playerId", playerIdChunk)
          .order("gameId", { ascending: true })
          .order("playerId", { ascending: true })
          .order("created_at", { ascending: true })
          .range(from, to),
      { chunkSize: CARD_STATS_FILTER_CHUNK_SIZE },
    );
    rows.push(...chunkRows);
  }
  return rows;
}

async function fetchScopedGoalieRows(gameIds: number[], playerIds: number[]) {
  if (gameIds.length === 0 || playerIds.length === 0) {
    return [] as GoalieGameStatsRow[];
  }

  const rows: GoalieGameStatsRow[] = [];
  for (const gameIdChunk of chunkPositiveIntegers(gameIds)) {
    const chunkRows = await fetchAllSupabaseFilterChunks<
      GoalieGameStatsRow,
      number
    >(
      playerIds,
      (playerIdChunk, { from, to }) =>
        supabase
          .from("goaliesGameStats")
          .select(
            "created_at,gameId,playerId,goalsAgainst,saveShotsAgainst,toi",
          )
          .in("gameId", gameIdChunk)
          .in("playerId", playerIdChunk)
          .order("gameId", { ascending: true })
          .order("playerId", { ascending: true })
          .order("created_at", { ascending: true })
          .range(from, to),
      { chunkSize: CARD_STATS_FILTER_CHUNK_SIZE },
    );
    rows.push(...chunkRows);
  }
  return rows;
}

function expectedGameIdsForPlayer(
  player: any,
  seasonType: "regularSeason" | "playoffs",
): number[] {
  const seasonData =
    seasonType === "regularSeason"
      ? player.regularSeasonData
      : player.playoffData;
  return Array.from(
    new Set<number>(
      (Array.isArray(seasonData?.gameIds) ? seasonData.gameIds : [])
        .map(Number)
        .filter((gameId: number) => Number.isInteger(gameId) && gameId > 0),
    ),
  );
}

function exactRowsForPlayer<TRow extends { gameId: number; playerId: number }>(
  rows: TRow[],
  playerId: number,
  expectedGameIds: number[],
) {
  if (expectedGameIds.length === 0) return null;
  const expected = new Set(expectedGameIds);
  const playerRows = rows.filter((row) => row.playerId === playerId);
  const seen = new Set<number>();

  for (const row of playerRows) {
    if (!expected.has(row.gameId) || seen.has(row.gameId)) return null;
    seen.add(row.gameId);
  }

  return seen.size === expected.size && playerRows.length === expected.size
    ? playerRows
    : null;
}

function finiteNonNegative(value: unknown) {
  if (
    value == null ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

function parseDurationSeconds(value: string | null | undefined) {
  if (!value) return null;
  const parts = value.split(":").map(Number);
  if (
    (parts.length !== 2 && parts.length !== 3) ||
    parts.some(
      (part) => !Number.isFinite(part) || !Number.isInteger(part) || part < 0,
    ) ||
    parts[parts.length - 1] >= 60 ||
    (parts.length === 3 && parts[1] >= 60)
  ) {
    return null;
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function parseSaveShotsAgainst(value: string) {
  const match = /^\s*(\d+)\s*[/\-]\s*(\d+)\s*$/.exec(value);
  if (!match) return null;
  const saves = Number(match[1]);
  const shotsAgainst = Number(match[2]);
  if (saves > shotsAgainst) return null;
  return { saves, shotsAgainst };
}

async function fetchScopedCardStats(
  matchedGameIds: number[],
  selectedPlayersData: Record<string, any>,
  seasonType: "regularSeason" | "playoffs",
): Promise<ScopedCardStats> {
  const scopeGameIds = Array.from(new Set(matchedGameIds)).sort(
    (left, right) => left - right,
  );
  if (scopeGameIds.length === 0) return EMPTY_SCOPED_CARD_STATS;

  const players = Object.values(selectedPlayersData);
  const skaterIds = players
    .filter(
      (player: any) =>
        player.playerType !== "G" && player.primaryPosition !== "G",
    )
    .map((player: any) => Number(player.playerId));
  const goalieIds = players
    .filter(
      (player: any) =>
        player.playerType === "G" || player.primaryPosition === "G",
    )
    .map((player: any) => Number(player.playerId));

  const [skaterRows, goalieRows] = await Promise.all([
    fetchScopedSkaterRows(scopeGameIds, skaterIds),
    fetchScopedGoalieRows(scopeGameIds, goalieIds),
  ]);

  const skatersByPlayerId: Record<number, ScopedSkaterCardStats> = {};
  const goaliesByPlayerId: Record<number, ScopedGoalieCardStats> = {};

  for (const player of players as any[]) {
    const playerId = Number(player.playerId);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) continue;
    const expectedGameIds = expectedGameIdsForPlayer(player, seasonType);
    const isGoalie =
      player.playerType === "G" || player.primaryPosition === "G";

    if (!isGoalie) {
      const exactRows = exactRowsForPlayer(
        skaterRows,
        playerId,
        expectedGameIds,
      );
      if (!exactRows) continue;
      const numericRows = exactRows.map((row) => ({
        goals: finiteNonNegative(row.goals),
        assists: finiteNonNegative(row.assists),
        points: finiteNonNegative(row.points),
        powerPlayPoints: finiteNonNegative(row.powerPlayPoints),
        shots: finiteNonNegative(row.shots),
        hits: finiteNonNegative(row.hits),
        blockedShots: finiteNonNegative(row.blockedShots),
        plusMinus:
          typeof row.plusMinus === "number" && Number.isFinite(row.plusMinus)
            ? row.plusMinus
            : null,
      }));
      if (numericRows.some((row) => Object.values(row).includes(null))) {
        continue;
      }
      if (
        numericRows.some(
          (row) =>
            row.points !== (row.goals ?? 0) + (row.assists ?? 0) ||
            (row.powerPlayPoints ?? 0) > (row.points ?? 0),
        )
      ) {
        continue;
      }
      skatersByPlayerId[playerId] = numericRows.reduce<ScopedSkaterCardStats>(
        (totals, row) => ({
          gamesPlayed: totals.gamesPlayed,
          goals: totals.goals + (row.goals ?? 0),
          assists: totals.assists + (row.assists ?? 0),
          points: totals.points + (row.points ?? 0),
          powerPlayPoints: totals.powerPlayPoints + (row.powerPlayPoints ?? 0),
          shots: totals.shots + (row.shots ?? 0),
          hits: totals.hits + (row.hits ?? 0),
          blockedShots: totals.blockedShots + (row.blockedShots ?? 0),
          plusMinus: totals.plusMinus + (row.plusMinus ?? 0),
        }),
        {
          gamesPlayed: expectedGameIds.length,
          goals: 0,
          assists: 0,
          points: 0,
          powerPlayPoints: 0,
          shots: 0,
          hits: 0,
          blockedShots: 0,
          plusMinus: 0,
        },
      );
      continue;
    }

    const exactRows = exactRowsForPlayer(goalieRows, playerId, expectedGameIds);
    if (!exactRows) continue;

    let totalSaves = 0;
    let totalShotsAgainst = 0;
    let totalGoalsAgainst = 0;
    let totalToiSeconds = 0;
    let valid = true;
    for (const row of exactRows) {
      const saveShots = parseSaveShotsAgainst(row.saveShotsAgainst);
      const goalsAgainst = finiteNonNegative(row.goalsAgainst);
      const toiSeconds = parseDurationSeconds(row.toi);
      if (
        !saveShots ||
        goalsAgainst == null ||
        !toiSeconds ||
        saveShots.shotsAgainst - saveShots.saves !== goalsAgainst
      ) {
        valid = false;
        break;
      }
      totalSaves += saveShots.saves;
      totalShotsAgainst += saveShots.shotsAgainst;
      totalGoalsAgainst += goalsAgainst;
      totalToiSeconds += toiSeconds;
    }
    if (!valid || totalToiSeconds <= 0) continue;

    goaliesByPlayerId[playerId] = {
      gamesPlayed: expectedGameIds.length,
      saves: totalSaves,
      savePercentage:
        totalShotsAgainst > 0 ? totalSaves / totalShotsAgainst : null,
      goalsAgainstAverage: (totalGoalsAgainst * 3600) / totalToiSeconds,
    };
  }

  return { scopeGameIds, skatersByPlayerId, goaliesByPlayerId };
}

// Function to fetch all data for a team within a date range
async function fetchAllDataForTeam(
  teamId: number,
  seasonId: number,
  gameType: "2" | "3",
  startDate: string,
  endDate: string,
  filters?: {
    gameIds?: number[];
    homeOrAway?: string;
    opponentTeamAbbreviation?: string;
  },
) {
  const fieldsToSelect =
    "id,game_id,game_type,player_id,player_first_name,player_last_name,team_id,team_abbreviation,game_toi,home_or_away,opponent_team_abbreviation,opponent_team_id,display_position,primary_position,time_spent_with,percent_toi_with,time_spent_with_mixed,percent_toi_with_mixed,game_length,line_combination,pairing_combination,season_id,player_type";

  return fetchAllSupabasePages<ShiftChartRow>(({ from, to }) => {
    let query = supabase
      .from("shift_charts")
      .select(fieldsToSelect)
      .eq("team_id", teamId)
      .eq("season_id", seasonId)
      .eq("game_type", gameType)
      .gte("game_date", startDate)
      .lte("game_date", endDate);

    if (filters?.gameIds) {
      query = query.in("game_id", filters.gameIds);
    }
    if (filters?.homeOrAway) {
      query = query.eq("home_or_away", filters.homeOrAway);
    }
    if (filters?.opponentTeamAbbreviation) {
      query = query.eq(
        "opponent_team_abbreviation",
        filters.opponentTeamAbbreviation,
      );
    }

    return query.order("id", { ascending: true }).range(from, to);
  });
}

// Fetch aggregated data for an explicit team, season, and page-owned date range.
export async function fetchAggregatedData(request: FetchAggregatedDataRequest) {
  const {
    teamId,
    seasonId,
    startDate,
    endDate,
    seasonType,
    gameIds,
    homeOrAway = "",
    opponentTeamAbbreviation = "",
  } = request;

  if (!Number.isSafeInteger(teamId) || teamId <= 0) {
    throw new Error("A valid team ID is required to fetch matrix data.");
  }
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0) {
    throw new Error("A valid season ID is required to fetch matrix data.");
  }
  if (!startDate || !endDate || startDate > endDate) {
    throw new Error("A valid matrix date range is required.");
  }

  const scopedGameIds =
    gameIds == null ? undefined : Array.from(new Set(gameIds));
  if (
    scopedGameIds &&
    (scopedGameIds.length === 0 ||
      scopedGameIds.length > 30 ||
      scopedGameIds.some(
        (gameId) => !Number.isSafeInteger(gameId) || gameId <= 0,
      ))
  ) {
    throw new Error("A valid fixed game-ID scope is required.");
  }

  // The page owns team/date selection; this reader applies that exact scope.
  const allTeamData = await fetchAllDataForTeam(
    teamId,
    seasonId,
    seasonType === "regularSeason" ? "2" : "3",
    startDate,
    endDate,
    {
      gameIds: scopedGameIds,
      homeOrAway: homeOrAway || undefined,
      opponentTeamAbbreviation: opponentTeamAbbreviation || undefined,
    },
  );

  if (
    allTeamData.some(
      (row) =>
        !Number.isSafeInteger(row.player_id) || Number(row.player_id) <= 0,
    )
  ) {
    throw new Error(
      "Shift-chart data is missing a player identity or has an invalid one.",
    );
  }
  if (
    allTeamData.some(
      (row) => !Number.isSafeInteger(row.game_id) || row.game_id <= 0,
    )
  ) {
    throw new Error("Shift-chart data is missing a valid game identity.");
  }

  const matchedGameIds = Array.from(
    new Set(allTeamData.map((row) => row.game_id)),
  );

  // Get unique player IDs from the data

  // Fetch data for each player based on season type
  const regularSeasonData = allTeamData.filter(
    (item) => item.game_type === "2",
  );
  const playoffData = allTeamData.filter((item) => item.game_type === "3");

  // Process the fetched data to structure it by player
  const regularSeasonPlayersData = processData(
    regularSeasonData,
    "regularSeason",
  );
  const playoffPlayersData = processData(playoffData, "playoffs");
  const fallbackByPlayerId = await fetchPlayerPositionFallbacks(
    allTeamData
      .map((row) => row.player_id)
      .filter((playerId): playerId is number => playerId != null),
  );
  applyPlayerPositionFallbacks(regularSeasonPlayersData, fallbackByPlayerId);
  applyPlayerPositionFallbacks(playoffPlayersData, fallbackByPlayerId);

  const selectedPlayersData =
    seasonType === "regularSeason"
      ? regularSeasonPlayersData
      : playoffPlayersData;
  const cardStats = await fetchScopedCardStats(
    matchedGameIds,
    selectedPlayersData,
    seasonType,
  );

  return {
    regularSeasonPlayersData,
    playoffPlayersData,
    matchedGameIds,
    cardStats,
  };
}

// Function to process the aggregated data and calculate metrics
function processData(data: any[], seasonType: "regularSeason" | "playoffs") {
  const playersData: any = {};

  data.forEach((row) => {
    const playerId = row.player_id;
    if (playerId == null) return;

    const playerName = [row.player_first_name, row.player_last_name]
      .filter(Boolean)
      .join(" ");
    const playerAbbrevName =
      row.player_first_name && row.player_last_name
        ? `${row.player_first_name.charAt(0)}. ${row.player_last_name}`
        : playerName;

    if (!playersData[playerId]) {
      playersData[playerId] = {
        playerName,
        playerAbbrevName,
        lastName: row.player_last_name,
        playerId: row.player_id,
        teamId: row.team_id,
        teamAbbrev: row.team_abbreviation,
        displayPosition: row.display_position,
        primaryPosition: row.primary_position,
        seasonId: row.season_id,
        playerType: row.player_type,
        regularSeasonData: {
          totalTOI: 0,
          gameLength: 0,
          gamesPlayed: new Set<number>(),
          ATOI: "00:00",
          gameIds: [],
          homeOrAway: [],
          opponent: [],
          opponentId: [],
          timeSpentWith: {} as Record<string, number>,
          timeSpentWithMixed: {} as Record<string, number>,
          timesPlayedWith: {} as Record<string, number>,
          percentToiWith: {} as Record<string, number>,
          percentToiWithMixed: {} as Record<string, number>,
          percentOfSeason: {} as Record<string, number>,
          timesOnLine: { 1: 0, 2: 0, 3: 0, 4: 0 },
          timesOnPair: { 1: 0, 2: 0, 3: 0 },
        },
        playoffData: {
          totalTOI: 0,
          gameLength: 0,
          gamesPlayed: new Set<number>(),
          ATOI: "00:00",
          gameIds: [],
          homeOrAway: [],
          opponent: [],
          opponentId: [],
          timeSpentWith: {} as Record<string, number>,
          timeSpentWithMixed: {} as Record<string, number>,
          timesPlayedWith: {} as Record<string, number>,
          percentToiWith: {} as Record<string, number>,
          percentToiWithMixed: {} as Record<string, number>,
          percentOfSeason: {} as Record<string, number>,
          timesOnLine: { 1: 0, 2: 0, 3: 0, 4: 0 },
          timesOnPair: { 1: 0, 2: 0, 3: 0 },
        },
      };
    }

    const player = playersData[playerId];
    if (!player.playerName?.trim() && playerName) {
      player.playerName = playerName;
    }
    if (!player.playerAbbrevName?.trim() && playerAbbrevName) {
      player.playerAbbrevName = playerAbbrevName;
    }
    if (!player.lastName && row.player_last_name)
      player.lastName = row.player_last_name;
    if (!player.displayPosition && row.display_position) {
      player.displayPosition = row.display_position;
    }
    if (!player.primaryPosition && row.primary_position) {
      player.primaryPosition = row.primary_position;
    }
    if (!player.playerType && row.player_type) {
      player.playerType = row.player_type;
    }
    if (!player.teamAbbrev && row.team_abbreviation) {
      player.teamAbbrev = row.team_abbreviation;
    }
    if (!player.teamId && row.team_id) player.teamId = row.team_id;
    if (!player.seasonId && row.season_id) player.seasonId = row.season_id;

    const seasonData =
      seasonType === "regularSeason"
        ? playersData[playerId].regularSeasonData
        : playersData[playerId].playoffData;

    seasonData.totalTOI += parseTime(row.game_toi);
    seasonData.gameLength += parseTime(row.game_length);
    seasonData.gamesPlayed.add(row.game_id);
    seasonData.homeOrAway.push(row.home_or_away);
    seasonData.opponent.push(row.opponent_team_abbreviation);
    seasonData.opponentId.push(row.opponent_team_id);

    Object.entries(
      (row.time_spent_with ?? {}) as Record<string, string>,
    ).forEach(([key, value]) => {
      if (!seasonData.timeSpentWith[key]) {
        seasonData.timeSpentWith[key] = parseTime(value);
        seasonData.timesPlayedWith[key] = 1;
      } else {
        seasonData.timeSpentWith[key] += parseTime(value);
        seasonData.timesPlayedWith[key] += 1;
      }
    });

    Object.entries(
      (row.time_spent_with_mixed as Record<string, string>) || {},
    ).forEach(([key, value]) => {
      if (!seasonData.timeSpentWithMixed[key]) {
        seasonData.timeSpentWithMixed[key] = parseTime(value);
      } else {
        seasonData.timeSpentWithMixed[key] += parseTime(value);
      }
    });

    if (row.player_type === "F" && row.line_combination) {
      seasonData.timesOnLine[row.line_combination] += 1;
    } else if (row.player_type === "D" && row.pairing_combination) {
      seasonData.timesOnPair[row.pairing_combination] += 1;
    }
  });

  Object.values(playersData).forEach((player: any) => {
    const seasonData =
      seasonType === "regularSeason"
        ? player.regularSeasonData
        : player.playoffData;

    seasonData.GP = seasonData.gamesPlayed.size;
    seasonData.gameIds = Array.from(seasonData.gamesPlayed);
    if (seasonData.GP > 0) {
      seasonData.ATOI = formatTime(seasonData.totalTOI / seasonData.GP);
    } else {
      seasonData.ATOI = "00:00";
    }

    Object.keys(seasonData.timeSpentWith).forEach((key) => {
      seasonData.percentToiWith[key] =
        (seasonData.timeSpentWith[key] / seasonData.totalTOI) * 100;
      seasonData.percentOfSeason[key] =
        (seasonData.timeSpentWith[key] / seasonData.gameLength) * 100;
    });

    Object.keys(seasonData.timeSpentWithMixed).forEach((key) => {
      seasonData.percentToiWithMixed[key] =
        (seasonData.timeSpentWithMixed[key] / seasonData.totalTOI) * 100;
    });

    seasonData.totalTOI = formatTime(seasonData.totalTOI);
    seasonData.gameLength = formatTime(seasonData.gameLength);
  });

  return playersData;
}

function parseTime(time: string | null | undefined) {
  if (!time) return 0;
  const [minutes, seconds] = time.split(":").map(Number);
  return (
    (Number.isFinite(minutes) ? minutes : 0) * 60 +
    (Number.isFinite(seconds) ? seconds : 0)
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}
