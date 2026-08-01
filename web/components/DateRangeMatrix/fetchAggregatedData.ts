/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\fetchAggregatedData.ts

import supabase from "lib/supabase";
import type { Database } from "lib/supabase/database-generated.types";
import { teamsInfo } from "lib/teamsInfo";
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
  | "game_date"
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
  | "time_spent_with_mixed"
  | "game_length"
  | "line_combination"
  | "pairing_combination"
  | "season_id"
  | "player_type"
>;

type MatrixSeasonType = "regularSeason" | "playoffs";
type MatrixGameType = "2" | "3";
type MatrixPlayerType = "F" | "D" | "G";
type RelationshipKind = "same" | "mixed";

type NormalizedAggregateShiftRow = {
  rowId: number;
  gameId: number;
  gameType: MatrixGameType;
  gameDate: string;
  seasonId: number;
  playerId: number;
  gameToiSeconds: number;
  gameLengthSeconds: number;
  appearanceExceedsGameLength: boolean;
  homeOrAway: "home" | "away" | null;
  opponentTeamAbbreviation: string | null;
  opponentTeamId: number | null;
  firstName: string | null;
  lastName: string | null;
  primaryPosition: string | null;
  displayPosition: string | null;
  playerType: MatrixPlayerType | null;
  lineCombination: number | null;
  pairingCombination: number | null;
  sameRelationships: Map<number, number>;
  mixedRelationships: Map<number, number>;
};

type AggregatePairGameFact = {
  gameId: number;
  firstPlayerId: number;
  secondPlayerId: number;
  seconds: number;
};

type AggregatePlayerAccumulator = {
  playerId: number;
  firstName: string | null;
  lastName: string | null;
  primaryPosition: string | null;
  displayPosition: string | null;
  playerType: MatrixPlayerType | null;
  gamesPlayed: Set<number>;
  totalToiSeconds: number;
  totalGameLengthSeconds: number;
  gameIds: number[];
  homeOrAway: Array<"home" | "away" | null>;
  opponent: Array<string | null>;
  opponentId: Array<number | null>;
  timesOnLine: Record<string, number>;
  timesOnPair: Record<string, number>;
  timeSpentWith: Record<number, number>;
  timeSpentWithMixed: Record<number, number>;
  timesPlayedWith: Record<number, number>;
  mutualSharedToi: Record<number, number>;
};

export type AggregatedMatrixSeasonData = {
  totalTOI: number;
  gameLength: number;
  gamesPlayed: Set<number>;
  ATOI: string;
  gameIds: number[];
  homeOrAway: Array<"home" | "away" | null>;
  opponent: Array<string | null>;
  opponentId: Array<number | null>;
  timeSpentWith: Record<number, number>;
  timeSpentWithMixed: Record<number, number>;
  timesPlayedWith: Record<number, number>;
  mutualSharedToi: Record<number, number>;
  percentToiWith: Record<number, number>;
  percentToiWithMixed: Record<number, number>;
  percentOfSeason: Record<number, number>;
  timesOnLine: Record<string, number>;
  timesOnPair: Record<string, number>;
  GP: number;
};

export type AggregatedMatrixPlayer = {
  playerName: string;
  playerAbbrevName: string;
  lastName: string;
  playerId: number;
  teamId: number;
  teamAbbrev: string;
  franchiseId: number;
  displayPosition: string;
  primaryPosition: string;
  sweaterNumber: number | null;
  seasonId: number;
  playerType: MatrixPlayerType;
  comboPoints: number;
  regularSeasonData: AggregatedMatrixSeasonData;
  playoffData: AggregatedMatrixSeasonData;
};

export type AggregatedMatrixPlayers = Record<number, AggregatedMatrixPlayer>;

type AggregateReductionScope = {
  teamId: number;
  teamAbbreviation: string;
  franchiseId: number;
  seasonId: number;
  gameType: MatrixGameType;
  startDate: string;
  endDate: string;
  gameIds: ReadonlySet<number> | null;
  homeOrAway: "home" | "away" | null;
  opponentTeamAbbreviation: string | null;
};

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

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function readPositiveSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`Shift-chart data contains an invalid ${label}.`);
  }
  return Number(value);
}

function readOptionalPositiveSafeInteger(
  value: unknown,
  label: string,
): number | null {
  return value == null ? null : readPositiveSafeInteger(value, label);
}

function readOptionalText(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error(`Shift-chart data contains invalid ${label}.`);
  }
  return value.trim() || null;
}

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "") return null;

  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) {
    const seconds = Number(normalized);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }

  if (!/^\d+:[0-5]\d(?::[0-5]\d)?$/.test(normalized)) {
    return null;
  }
  const parts = normalized.split(":").map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    return null;
  }
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

function readRequiredDuration(value: unknown, label: string): number {
  const seconds = parseDurationSeconds(value);
  if (seconds == null) {
    throw new Error(`Shift-chart data contains invalid ${label}.`);
  }
  return seconds;
}

function readRelationshipMap(
  value: unknown,
  playerId: number,
  label: string,
): Map<number, number> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Shift-chart data contains invalid ${label}.`);
  }

  const relationships = new Map<number, number>();
  for (const [rawPartnerId, rawDuration] of Object.entries(value)) {
    if (!/^[1-9]\d*$/.test(rawPartnerId)) {
      throw new Error(`Shift-chart data contains an invalid ${label} partner.`);
    }
    const partnerId = Number(rawPartnerId);
    if (
      !Number.isSafeInteger(partnerId) ||
      partnerId <= 0 ||
      partnerId === playerId
    ) {
      throw new Error(`Shift-chart data contains an invalid ${label} partner.`);
    }
    const seconds = parseDurationSeconds(rawDuration);
    if (seconds == null) {
      throw new Error(
        `Shift-chart data contains an invalid ${label} duration.`,
      );
    }
    relationships.set(partnerId, seconds);
  }
  return relationships;
}

function readPlayerType(value: unknown): MatrixPlayerType | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Shift-chart data contains an invalid player type.");
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "F" || normalized === "D" || normalized === "G") {
    return normalized;
  }
  throw new Error("Shift-chart data contains an invalid player type.");
}

function getPlayerTypeFromPosition(
  position: string | null | undefined,
): MatrixPlayerType | null {
  const normalized = (position ?? "").trim().toUpperCase();
  if (["LW", "RW", "C", "L", "R"].includes(normalized)) return "F";
  if (normalized === "D") return "D";
  if (normalized === "G") return "G";
  return null;
}

function readCombination(
  value: unknown,
  maximum: number,
  label: string,
): number | null {
  if (value == null) return null;
  if (
    !Number.isInteger(value) ||
    Number(value) < 1 ||
    Number(value) > maximum
  ) {
    throw new Error(`Shift-chart data contains an invalid ${label}.`);
  }
  return Number(value);
}

function canonicalRelationshipKind(
  firstPlayerType: MatrixPlayerType,
  secondPlayerType: MatrixPlayerType,
): RelationshipKind {
  return (firstPlayerType === "F") === (secondPlayerType === "F")
    ? "same"
    : "mixed";
}

function relationshipObservation(
  row: NormalizedAggregateShiftRow,
  partnerId: number,
): { kind: RelationshipKind; seconds: number } | null {
  const hasSame = row.sameRelationships.has(partnerId);
  const hasMixed = row.mixedRelationships.has(partnerId);
  if (hasSame && hasMixed) {
    throw new Error(
      "Shift-chart data contains contradictory relationship categories.",
    );
  }
  if (hasSame) {
    return { kind: "same", seconds: row.sameRelationships.get(partnerId)! };
  }
  if (hasMixed) {
    return { kind: "mixed", seconds: row.mixedRelationships.get(partnerId)! };
  }
  return null;
}

function incrementNumericRecord(
  record: Record<number, number>,
  key: number,
  amount: number,
) {
  record[key] = (record[key] ?? 0) + amount;
}

function incrementStringRecord(
  record: Record<string, number>,
  key: number,
  amount: number,
) {
  const normalizedKey = String(key);
  record[normalizedKey] = (record[normalizedKey] ?? 0) + amount;
}

function formatClock(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
}

function abbreviatedName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}`
    : fullName;
}

function lastNameFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : fullName;
}

async function fetchPlayerPositionFallbacks(playerIds: number[]) {
  const uniqueIds = Array.from(
    new Set(
      playerIds.filter(
        (playerId) => Number.isSafeInteger(playerId) && playerId > 0,
      ),
    ),
  );
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

  const requested = new Set(uniqueIds);
  const fallbackByPlayerId = new Map<number, PlayerPositionFallback>();
  for (const fallback of fallbackRows) {
    const playerId = readPositiveSafeInteger(fallback.id, "fallback player ID");
    if (!requested.has(playerId) || fallbackByPlayerId.has(playerId)) {
      throw new Error("Player fallback data contains an unexpected identity.");
    }
    fallbackByPlayerId.set(playerId, fallback);
  }
  return fallbackByPlayerId;
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
  player: AggregatedMatrixPlayer,
  seasonType: MatrixSeasonType,
): number[] {
  const seasonData =
    seasonType === "regularSeason"
      ? player.regularSeasonData
      : player.playoffData;
  return Array.from(new Set(seasonData.gameIds));
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
  selectedPlayersData: AggregatedMatrixPlayers,
  seasonType: MatrixSeasonType,
): Promise<ScopedCardStats> {
  const scopeGameIds = Array.from(new Set(matchedGameIds)).sort(
    (left, right) => left - right,
  );
  if (scopeGameIds.length === 0) return EMPTY_SCOPED_CARD_STATS;

  const players = Object.values(selectedPlayersData);
  const skaterIds = players
    .filter((player) => player.playerType !== "G")
    .map((player) => player.playerId);
  const goalieIds = players
    .filter((player) => player.playerType === "G")
    .map((player) => player.playerId);

  const [skaterRows, goalieRows] = await Promise.all([
    fetchScopedSkaterRows(scopeGameIds, skaterIds),
    fetchScopedGoalieRows(scopeGameIds, goalieIds),
  ]);

  const skatersByPlayerId: Record<number, ScopedSkaterCardStats> = {};
  const goaliesByPlayerId: Record<number, ScopedGoalieCardStats> = {};

  for (const player of players) {
    const playerId = player.playerId;
    const expectedGameIds = expectedGameIdsForPlayer(player, seasonType);
    const isGoalie = player.playerType === "G";

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

function normalizeAggregateRows(
  rows: ShiftChartRow[],
  scope: AggregateReductionScope,
): {
  rows: NormalizedAggregateShiftRow[];
  pairGameFacts: AggregatePairGameFact[];
  skippedRows: number;
} {
  const seenRowIds = new Set<number>();
  const seenPlayerGames = new Set<string>();
  const rowsByGame = new Map<number, NormalizedAggregateShiftRow[]>();

  for (const row of rows) {
    const rowId = readPositiveSafeInteger(row.id, "row ID");
    const gameId = readPositiveSafeInteger(row.game_id, "game ID");
    const playerId = readPositiveSafeInteger(row.player_id, "player ID");
    const teamId = readPositiveSafeInteger(row.team_id, "team ID");
    const seasonId = readPositiveSafeInteger(row.season_id, "season ID");

    if (seenRowIds.has(rowId)) {
      throw new Error("Shift-chart data contains a duplicate row ID.");
    }
    seenRowIds.add(rowId);

    const playerGameKey = `${gameId}:${playerId}`;
    if (seenPlayerGames.has(playerGameKey)) {
      throw new Error("Shift-chart data contains a duplicate player-game row.");
    }
    seenPlayerGames.add(playerGameKey);

    if (teamId !== scope.teamId || seasonId !== scope.seasonId) {
      throw new Error("Shift-chart data conflicts with the selected scope.");
    }
    if (scope.gameIds && !scope.gameIds.has(gameId)) {
      throw new Error(
        "Shift-chart data conflicts with the fixed game-ID scope.",
      );
    }
    if (row.game_type !== scope.gameType) {
      throw new Error(
        "Shift-chart data conflicts with the selected season type.",
      );
    }
    if (
      !isValidIsoDate(row.game_date) ||
      row.game_date < scope.startDate ||
      row.game_date > scope.endDate
    ) {
      throw new Error("Shift-chart data contains an invalid scoped game date.");
    }

    const teamAbbreviation = readOptionalText(
      row.team_abbreviation,
      "team abbreviation",
    )?.toUpperCase();
    if (teamAbbreviation !== scope.teamAbbreviation) {
      throw new Error("Shift-chart data conflicts with the canonical team.");
    }

    let homeOrAway: "home" | "away" | null = null;
    const homeOrAwayText = readOptionalText(
      row.home_or_away,
      "home/away metadata",
    );
    if (homeOrAwayText) {
      const normalized = homeOrAwayText.toLowerCase();
      if (normalized !== "home" && normalized !== "away") {
        throw new Error(
          "Shift-chart data contains invalid home/away metadata.",
        );
      }
      homeOrAway = normalized;
    }
    if (scope.homeOrAway && homeOrAway !== scope.homeOrAway) {
      throw new Error(
        "Shift-chart data conflicts with the active home/away filter.",
      );
    }

    const opponentTeamAbbreviation =
      readOptionalText(
        row.opponent_team_abbreviation,
        "opponent team abbreviation",
      )?.toUpperCase() ?? null;
    if (
      scope.opponentTeamAbbreviation &&
      opponentTeamAbbreviation !== scope.opponentTeamAbbreviation
    ) {
      throw new Error(
        "Shift-chart data conflicts with the active opponent filter.",
      );
    }
    const opponentTeamId = readOptionalPositiveSafeInteger(
      row.opponent_team_id,
      "opponent team ID",
    );
    const gameToiSeconds = readRequiredDuration(row.game_toi, "game TOI");
    const gameLengthSeconds = readRequiredDuration(
      row.game_length,
      "game length",
    );
    if (gameLengthSeconds === 0) {
      throw new Error("Shift-chart data contains an invalid game length.");
    }

    const normalizedRow: NormalizedAggregateShiftRow = {
      rowId,
      gameId,
      gameType: row.game_type,
      gameDate: row.game_date,
      seasonId,
      playerId,
      gameToiSeconds,
      gameLengthSeconds,
      appearanceExceedsGameLength: gameToiSeconds > gameLengthSeconds,
      homeOrAway,
      opponentTeamAbbreviation,
      opponentTeamId,
      firstName: readOptionalText(row.player_first_name, "player first name"),
      lastName: readOptionalText(row.player_last_name, "player last name"),
      primaryPosition: readOptionalText(
        row.primary_position,
        "player primary position",
      ),
      displayPosition: readOptionalText(
        row.display_position,
        "player display position",
      ),
      playerType: readPlayerType(row.player_type),
      lineCombination: readCombination(
        row.line_combination,
        4,
        "line combination",
      ),
      pairingCombination: readCombination(
        row.pairing_combination,
        3,
        "pairing combination",
      ),
      sameRelationships: readRelationshipMap(
        row.time_spent_with,
        playerId,
        "same-position relationship",
      ),
      mixedRelationships: readRelationshipMap(
        row.time_spent_with_mixed,
        playerId,
        "mixed-position relationship",
      ),
    };
    const gameRows = rowsByGame.get(gameId) ?? [];
    gameRows.push(normalizedRow);
    rowsByGame.set(gameId, gameRows);
  }

  const normalizedRows: NormalizedAggregateShiftRow[] = [];
  const pairGameFacts: AggregatePairGameFact[] = [];
  let skippedRows = 0;
  const orderedGames = [...rowsByGame.entries()].sort(
    ([leftGameId, leftRows], [rightGameId, rightRows]) =>
      leftRows[0].gameDate.localeCompare(rightRows[0].gameDate) ||
      leftGameId - rightGameId,
  );

  for (const [gameId, gameRows] of orderedGames) {
    if (gameRows.some((row) => row.appearanceExceedsGameLength)) {
      skippedRows += gameRows.length;
      continue;
    }

    const playerIds = new Set(gameRows.map((row) => row.playerId));
    for (const row of gameRows) {
      for (const relationships of [
        row.sameRelationships,
        row.mixedRelationships,
      ]) {
        relationships.forEach((_seconds, partnerId) => {
          if (!playerIds.has(partnerId)) {
            throw new Error(
              "Shift-chart data contains a relationship to an unknown player.",
            );
          }
        });
      }
    }

    const gameDates = new Set(gameRows.map((row) => row.gameDate));
    const gameLengths = new Set(gameRows.map((row) => row.gameLengthSeconds));
    const homeAwayValues = new Set(gameRows.map((row) => row.homeOrAway));
    const opponentAbbreviations = new Set(
      gameRows.map((row) => row.opponentTeamAbbreviation),
    );
    const opponentIds = new Set(gameRows.map((row) => row.opponentTeamId));
    if (
      gameDates.size !== 1 ||
      gameLengths.size !== 1 ||
      homeAwayValues.size !== 1 ||
      opponentAbbreviations.size !== 1 ||
      opponentIds.size !== 1
    ) {
      throw new Error("Shift-chart player rows disagree on game metadata.");
    }

    const orderedRows = [...gameRows].sort(
      (left, right) => left.playerId - right.playerId,
    );
    const gameFacts: AggregatePairGameFact[] = [];
    let relationshipExceedsAppearance = false;
    for (let firstIndex = 0; firstIndex < orderedRows.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < orderedRows.length;
        secondIndex += 1
      ) {
        const first = orderedRows[firstIndex];
        const second = orderedRows[secondIndex];
        const firstObservation = relationshipObservation(
          first,
          second.playerId,
        );
        const secondObservation = relationshipObservation(
          second,
          first.playerId,
        );
        if (!firstObservation || !secondObservation) {
          throw new Error(
            "Shift-chart data is missing mirrored relationship coverage.",
          );
        }
        if (
          firstObservation.kind !== secondObservation.kind ||
          firstObservation.seconds !== secondObservation.seconds
        ) {
          throw new Error(
            "Shift-chart data contains contradictory mirrored relationships.",
          );
        }
        if (
          firstObservation.seconds > first.gameToiSeconds ||
          firstObservation.seconds > second.gameToiSeconds
        ) {
          relationshipExceedsAppearance = true;
          break;
        }
        gameFacts.push({
          gameId,
          firstPlayerId: first.playerId,
          secondPlayerId: second.playerId,
          seconds: firstObservation.seconds,
        });
      }
      if (relationshipExceedsAppearance) break;
    }
    if (relationshipExceedsAppearance) {
      skippedRows += gameRows.length;
      continue;
    }
    normalizedRows.push(...gameRows);
    pairGameFacts.push(...gameFacts);
  }

  normalizedRows.sort(
    (left, right) =>
      left.gameDate.localeCompare(right.gameDate) ||
      left.gameId - right.gameId ||
      left.rowId - right.rowId,
  );
  return { rows: normalizedRows, pairGameFacts, skippedRows };
}

function resolveCanonicalPlayerMetadata(
  player: AggregatePlayerAccumulator,
  fallback: PlayerPositionFallback | undefined,
): {
  name: string;
  lastName: string;
  primaryPosition: string;
  displayPosition: string;
  playerType: MatrixPlayerType;
  sweaterNumber: number | null;
} {
  const fallbackName = readOptionalText(
    fallback?.fullName,
    "fallback player name",
  );
  const rowName =
    player.firstName && player.lastName
      ? `${player.firstName} ${player.lastName}`
      : null;
  const name = rowName || fallbackName;
  const fallbackPosition = readOptionalText(
    fallback?.position,
    "fallback player position",
  )?.toUpperCase();
  const primaryPosition =
    player.primaryPosition?.toUpperCase() ||
    fallbackPosition ||
    player.displayPosition?.toUpperCase() ||
    null;
  const displayPosition =
    player.displayPosition?.toUpperCase() || primaryPosition;
  const derivedPlayerType = getPlayerTypeFromPosition(primaryPosition);
  const playerType = player.playerType ?? derivedPlayerType;
  const lastName =
    player.lastName ||
    (fallbackName ? lastNameFromFullName(fallbackName) : null);

  if (
    !name ||
    !lastName ||
    !primaryPosition ||
    !displayPosition ||
    !playerType ||
    (derivedPlayerType && derivedPlayerType !== playerType)
  ) {
    throw new Error(
      "Shift-chart data cannot resolve canonical player metadata.",
    );
  }
  if (
    (Object.keys(player.timesOnLine).length > 0 && playerType !== "F") ||
    (Object.keys(player.timesOnPair).length > 0 && playerType !== "D")
  ) {
    throw new Error(
      "Shift-chart line or pair assignments conflict with player type.",
    );
  }

  let sweaterNumber: number | null = null;
  if (fallback?.sweater_number != null) {
    if (
      !Number.isSafeInteger(fallback.sweater_number) ||
      fallback.sweater_number < 0
    ) {
      throw new Error(
        "Player fallback data contains an invalid sweater number.",
      );
    }
    sweaterNumber = fallback.sweater_number;
  }

  return {
    name,
    lastName,
    primaryPosition,
    displayPosition,
    playerType,
    sweaterNumber,
  };
}

function emptyAggregatedSeasonData(): AggregatedMatrixSeasonData {
  return {
    totalTOI: 0,
    gameLength: 0,
    gamesPlayed: new Set<number>(),
    ATOI: "00:00",
    gameIds: [],
    homeOrAway: [],
    opponent: [],
    opponentId: [],
    timeSpentWith: {},
    timeSpentWithMixed: {},
    timesPlayedWith: {},
    mutualSharedToi: {},
    percentToiWith: {},
    percentToiWithMixed: {},
    percentOfSeason: {},
    timesOnLine: {},
    timesOnPair: {},
    GP: 0,
  };
}

function buildAggregatedPlayers(
  normalizedRows: NormalizedAggregateShiftRow[],
  pairGameFacts: AggregatePairGameFact[],
  fallbackByPlayerId: Map<number, PlayerPositionFallback>,
  seasonType: MatrixSeasonType,
  scope: AggregateReductionScope,
): AggregatedMatrixPlayers {
  const accumulators = new Map<number, AggregatePlayerAccumulator>();
  for (const row of normalizedRows) {
    const accumulator = accumulators.get(row.playerId) ?? {
      playerId: row.playerId,
      firstName: null,
      lastName: null,
      primaryPosition: null,
      displayPosition: null,
      playerType: null,
      gamesPlayed: new Set<number>(),
      totalToiSeconds: 0,
      totalGameLengthSeconds: 0,
      gameIds: [],
      homeOrAway: [],
      opponent: [],
      opponentId: [],
      timesOnLine: {},
      timesOnPair: {},
      timeSpentWith: {},
      timeSpentWithMixed: {},
      timesPlayedWith: {},
      mutualSharedToi: {},
    };
    if (row.firstName) accumulator.firstName = row.firstName;
    if (row.lastName) accumulator.lastName = row.lastName;
    if (row.primaryPosition) accumulator.primaryPosition = row.primaryPosition;
    if (row.displayPosition) accumulator.displayPosition = row.displayPosition;
    if (
      row.playerType &&
      accumulator.playerType &&
      row.playerType !== accumulator.playerType
    ) {
      throw new Error("Shift-chart data contains conflicting player types.");
    }
    if (row.playerType) accumulator.playerType = row.playerType;
    accumulator.gamesPlayed.add(row.gameId);
    accumulator.gameIds.push(row.gameId);
    accumulator.totalToiSeconds += row.gameToiSeconds;
    accumulator.totalGameLengthSeconds += row.gameLengthSeconds;
    accumulator.homeOrAway.push(row.homeOrAway);
    accumulator.opponent.push(row.opponentTeamAbbreviation);
    accumulator.opponentId.push(row.opponentTeamId);
    if (row.lineCombination != null) {
      incrementStringRecord(accumulator.timesOnLine, row.lineCombination, 1);
    }
    if (row.pairingCombination != null) {
      incrementStringRecord(accumulator.timesOnPair, row.pairingCombination, 1);
    }
    accumulators.set(row.playerId, accumulator);
  }

  const canonicalMetadata = new Map(
    [...accumulators.values()].map((player) => [
      player.playerId,
      resolveCanonicalPlayerMetadata(
        player,
        fallbackByPlayerId.get(player.playerId),
      ),
    ]),
  );

  for (const fact of pairGameFacts) {
    const first = accumulators.get(fact.firstPlayerId)!;
    const second = accumulators.get(fact.secondPlayerId)!;
    const kind = canonicalRelationshipKind(
      canonicalMetadata.get(fact.firstPlayerId)!.playerType,
      canonicalMetadata.get(fact.secondPlayerId)!.playerType,
    );
    const firstTarget =
      kind === "same" ? first.timeSpentWith : first.timeSpentWithMixed;
    const secondTarget =
      kind === "same" ? second.timeSpentWith : second.timeSpentWithMixed;
    incrementNumericRecord(firstTarget, second.playerId, fact.seconds);
    incrementNumericRecord(secondTarget, first.playerId, fact.seconds);
    incrementNumericRecord(first.timesPlayedWith, second.playerId, 1);
    incrementNumericRecord(second.timesPlayedWith, first.playerId, 1);
    incrementNumericRecord(
      first.mutualSharedToi,
      second.playerId,
      fact.seconds,
    );
    incrementNumericRecord(
      second.mutualSharedToi,
      first.playerId,
      fact.seconds,
    );
  }

  const playersData: AggregatedMatrixPlayers = {};
  for (const player of [...accumulators.values()].sort(
    (left, right) => left.playerId - right.playerId,
  )) {
    const metadata = canonicalMetadata.get(player.playerId)!;
    const percentToiWith = Object.fromEntries(
      Object.entries(player.timeSpentWith).map(([partnerId, seconds]) => [
        Number(partnerId),
        player.totalToiSeconds > 0
          ? (seconds / player.totalToiSeconds) * 100
          : 0,
      ]),
    );
    const percentToiWithMixed = Object.fromEntries(
      Object.entries(player.timeSpentWithMixed).map(([partnerId, seconds]) => [
        Number(partnerId),
        player.totalToiSeconds > 0
          ? (seconds / player.totalToiSeconds) * 100
          : 0,
      ]),
    );
    const percentOfSeason = Object.fromEntries(
      Object.entries(player.timeSpentWith).map(([partnerId, seconds]) => [
        Number(partnerId),
        player.totalGameLengthSeconds > 0
          ? (seconds / player.totalGameLengthSeconds) * 100
          : 0,
      ]),
    );
    const activeSeasonData: AggregatedMatrixSeasonData = {
      totalTOI: player.totalToiSeconds,
      gameLength: player.totalGameLengthSeconds,
      gamesPlayed: new Set(player.gamesPlayed),
      ATOI:
        player.gamesPlayed.size > 0
          ? formatClock(player.totalToiSeconds / player.gamesPlayed.size)
          : "00:00",
      gameIds: [...player.gameIds],
      homeOrAway: [...player.homeOrAway],
      opponent: [...player.opponent],
      opponentId: [...player.opponentId],
      timeSpentWith: { ...player.timeSpentWith },
      timeSpentWithMixed: { ...player.timeSpentWithMixed },
      timesPlayedWith: { ...player.timesPlayedWith },
      mutualSharedToi: { ...player.mutualSharedToi },
      percentToiWith,
      percentToiWithMixed,
      percentOfSeason,
      timesOnLine: { ...player.timesOnLine },
      timesOnPair: { ...player.timesOnPair },
      GP: player.gamesPlayed.size,
    };
    playersData[player.playerId] = {
      playerName: metadata.name,
      playerAbbrevName: abbreviatedName(metadata.name),
      lastName: metadata.lastName,
      playerId: player.playerId,
      teamId: scope.teamId,
      teamAbbrev: scope.teamAbbreviation,
      franchiseId: scope.franchiseId,
      displayPosition: metadata.displayPosition,
      primaryPosition: metadata.primaryPosition,
      sweaterNumber: metadata.sweaterNumber,
      seasonId: scope.seasonId,
      playerType: metadata.playerType,
      comboPoints: 0,
      regularSeasonData:
        seasonType === "regularSeason"
          ? activeSeasonData
          : emptyAggregatedSeasonData(),
      playoffData:
        seasonType === "playoffs"
          ? activeSeasonData
          : emptyAggregatedSeasonData(),
    };
  }
  return playersData;
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
    "id,game_id,game_type,game_date,player_id,player_first_name,player_last_name,team_id,team_abbreviation,game_toi,home_or_away,opponent_team_abbreviation,opponent_team_id,display_position,primary_position,time_spent_with,time_spent_with_mixed,game_length,line_combination,pairing_combination,season_id,player_type";

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
  if (
    !isValidIsoDate(startDate) ||
    !isValidIsoDate(endDate) ||
    startDate > endDate
  ) {
    throw new Error("A valid matrix date range is required.");
  }
  if (seasonType !== "regularSeason" && seasonType !== "playoffs") {
    throw new Error("A valid matrix season type is required.");
  }
  if (homeOrAway !== "" && homeOrAway !== "home" && homeOrAway !== "away") {
    throw new Error("A valid home/away filter is required.");
  }

  const canonicalTeamEntry = Object.entries(teamsInfo).find(
    ([, team]) => team.id === teamId,
  );
  if (!canonicalTeamEntry) {
    throw new Error("A canonical team is required to fetch matrix data.");
  }
  const [teamAbbreviation, canonicalTeam] = canonicalTeamEntry;
  const gameType: MatrixGameType = seasonType === "regularSeason" ? "2" : "3";
  const scopedHomeOrAway = homeOrAway || null;
  if (typeof opponentTeamAbbreviation !== "string") {
    throw new Error("A valid opponent-team filter is required.");
  }
  const scopedOpponentTeamAbbreviation =
    opponentTeamAbbreviation.trim().toUpperCase() || null;

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
    gameType,
    startDate,
    endDate,
    {
      gameIds: scopedGameIds,
      homeOrAway: scopedHomeOrAway || undefined,
      opponentTeamAbbreviation: scopedOpponentTeamAbbreviation || undefined,
    },
  );

  const scope: AggregateReductionScope = {
    teamId,
    teamAbbreviation,
    franchiseId: canonicalTeam.franchiseId,
    seasonId,
    gameType,
    startDate,
    endDate,
    gameIds: scopedGameIds ? new Set(scopedGameIds) : null,
    homeOrAway: scopedHomeOrAway,
    opponentTeamAbbreviation: scopedOpponentTeamAbbreviation,
  };
  const normalized = normalizeAggregateRows(allTeamData, scope);
  const fallbackByPlayerId = await fetchPlayerPositionFallbacks(
    normalized.rows.map((row) => row.playerId),
  );
  const selectedPlayersData = buildAggregatedPlayers(
    normalized.rows,
    normalized.pairGameFacts,
    fallbackByPlayerId,
    seasonType,
    scope,
  );
  const regularSeasonPlayersData: AggregatedMatrixPlayers =
    seasonType === "regularSeason" ? selectedPlayersData : {};
  const playoffPlayersData: AggregatedMatrixPlayers =
    seasonType === "playoffs" ? selectedPlayersData : {};
  const matchedGameIds = Array.from(
    new Set(normalized.rows.map((row) => row.gameId)),
  ).sort((left, right) => left - right);
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
    coverage: {
      inputRows: allTeamData.length,
      rosterRows: Object.keys(selectedPlayersData).length,
      skippedRows: normalized.skippedRows,
    },
  };
}
