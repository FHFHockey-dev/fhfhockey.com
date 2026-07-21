import { useEffect, useState } from "react";
import supabase from "lib/supabase";
import type { Database } from "lib/supabase/database-generated.types";
import {
  DEFAULT_SUPABASE_FILTER_CHUNK_SIZE,
  DEFAULT_SUPABASE_PAGE_SIZE,
  fetchAllSupabaseFilterChunks,
  fetchAllSupabasePages,
} from "lib/supabase/pagination";
import { teamsInfo } from "lib/teamsInfo";
import type { Team, TOIData } from "./index";
import type { PlayerData } from "./utilities";

export const RAW_SHIFT_CHART_PAGE_SIZE = DEFAULT_SUPABASE_PAGE_SIZE;
export const RAW_PLAYER_FALLBACK_CHUNK_SIZE =
  DEFAULT_SUPABASE_FILTER_CHUNK_SIZE;

type RawSeasonType = "regularSeason" | "playoffs";
type ShiftChartTableRow = Database["public"]["Tables"]["shift_charts"]["Row"];
type RawShiftChartRow = Pick<
  ShiftChartTableRow,
  | "id"
  | "game_id"
  | "game_type"
  | "game_date"
  | "season_id"
  | "player_id"
  | "player_first_name"
  | "player_last_name"
  | "team_id"
  | "team_abbreviation"
  | "game_toi"
  | "game_length"
  | "home_or_away"
  | "display_position"
  | "primary_position"
  | "player_type"
  | "time_spent_with"
  | "time_spent_with_mixed"
  | "line_combination"
  | "pairing_combination"
  | "total_es_toi"
  | "total_pp_toi"
  | "total_pk_toi"
>;
type PlayerFallbackRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "fullName" | "position"
>;

export type RawTOIDataCoverage = {
  inputRows: number;
  rosterRows: number;
  skippedRows: number;
};

export type RawTOIDataResult = {
  toiData: TOIData[];
  roster: PlayerData[];
  team: Team;
  homeAwayInfo: { gameId: number; homeOrAway: string }[];
  playerATOI: Record<number, string>;
  coverage: RawTOIDataCoverage;
};

type RelationshipKind = "same" | "mixed";
type NormalizedShiftRow = {
  rowId: number;
  gameId: number;
  gameType: "2" | "3" | null;
  gameDate: string;
  seasonId: number | null;
  playerId: number;
  gameToi: number | null;
  gameLength: number | null;
  appearanceExceedsGameLength: boolean;
  homeOrAway: "home" | "away" | null;
  firstName: string | null;
  lastName: string | null;
  primaryPosition: string | null;
  displayPosition: string | null;
  playerType: "F" | "D" | "G" | null;
  lineCombination: number | null;
  pairingCombination: number | null;
  sameRelationships: Map<number, number> | null;
  mixedRelationships: Map<number, number> | null;
};

type PairGameFact = {
  gameId: number;
  firstPlayerId: number;
  secondPlayerId: number;
  seconds: number;
};

type PlayerAccumulator = {
  playerId: number;
  firstName: string | null;
  lastName: string | null;
  primaryPosition: string | null;
  displayPosition: string | null;
  playerType: "F" | "D" | "G" | null;
  gamesPlayed: Set<number>;
  totalToi: number;
  totalGameLength: number;
  timesOnLine: Record<string, number>;
  timesOnPair: Record<string, number>;
  timeSpentWith: Record<number, number>;
  timeSpentWithMixed: Record<number, number>;
  timesPlayedWith: Record<number, number>;
  mutualSharedToi: Record<number, number>;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RAW_SHIFT_CHART_FIELDS =
  "id,game_id,game_type,game_date,season_id,player_id,player_first_name,player_last_name,team_id,team_abbreviation,game_toi,game_length,home_or_away,display_position,primary_position,player_type,time_spent_with,time_spent_with_mixed,line_combination,pairing_combination,total_es_toi,total_pp_toi,total_pk_toi";

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
  const totalSeconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Number.isSafeInteger(totalSeconds) ? totalSeconds : null;
}

function readNullableDuration(value: unknown, label: string): number | null {
  if (value == null) return null;
  const seconds = parseDurationSeconds(value);
  if (seconds == null) {
    throw new Error(`Shift-chart data contains invalid ${label}.`);
  }
  return seconds;
}

function readAppearanceToi(row: RawShiftChartRow): number | null {
  const direct = readNullableDuration(row.game_toi, "game TOI");
  if (direct != null) return direct;

  const strengthValues = [row.total_es_toi, row.total_pp_toi, row.total_pk_toi];
  if (strengthValues.some((value) => value == null)) return null;
  return strengthValues.reduce((total, value) => {
    const seconds = readNullableDuration(value, "strength TOI");
    return total + (seconds ?? 0);
  }, 0);
}

function readRelationshipMap(
  value: unknown,
  playerId: number,
  label: string,
): Map<number, number> | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
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

function readPlayerType(
  value: unknown,
  label = "player type",
): "F" | "D" | "G" | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`Shift-chart data contains an invalid ${label}.`);
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "F" || normalized === "D" || normalized === "G") {
    return normalized;
  }
  throw new Error(`Shift-chart data contains an invalid ${label}.`);
}

function playerTypeFromPosition(value: string | null): "F" | "D" | "G" | null {
  const position = value?.toUpperCase() ?? "";
  if (["C", "LW", "RW", "L", "R"].includes(position)) return "F";
  if (position === "D") return "D";
  if (position === "G") return "G";
  return null;
}

function resolveCanonicalPlayerPosition(
  player: PlayerAccumulator,
  fallback: PlayerFallbackRow | undefined,
): {
  primaryPosition: string;
  displayPosition: string;
  playerType: "F" | "D" | "G";
} {
  const fallbackPosition =
    readOptionalText(
      fallback?.position,
      "fallback player position",
    )?.toUpperCase() ?? null;
  const primaryPosition =
    player.primaryPosition?.toUpperCase() ||
    fallbackPosition ||
    player.displayPosition?.toUpperCase() ||
    null;
  const displayPosition =
    player.displayPosition?.toUpperCase() || primaryPosition;
  const derivedPlayerType = playerTypeFromPosition(primaryPosition);
  const playerType = player.playerType ?? derivedPlayerType;
  if (
    !primaryPosition ||
    !displayPosition ||
    !playerType ||
    (derivedPlayerType && playerType !== derivedPlayerType)
  ) {
    throw new Error(
      "Shift-chart data cannot resolve canonical player metadata.",
    );
  }
  return { primaryPosition, displayPosition, playerType };
}

function canonicalRelationshipKind(
  firstPlayerType: "F" | "D" | "G",
  secondPlayerType: "F" | "D" | "G",
): RelationshipKind {
  return (firstPlayerType === "F") === (secondPlayerType === "F")
    ? "same"
    : "mixed";
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

function formatClock(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
}

function pairKey(firstPlayerId: number, secondPlayerId: number): string {
  return firstPlayerId < secondPlayerId
    ? `${firstPlayerId}-${secondPlayerId}`
    : `${secondPlayerId}-${firstPlayerId}`;
}

function relationshipObservation(
  row: NormalizedShiftRow,
  partnerId: number,
): { kind: RelationshipKind; seconds: number } | null {
  const hasSame = row.sameRelationships?.has(partnerId) ?? false;
  const hasMixed = row.mixedRelationships?.has(partnerId) ?? false;
  if (hasSame && hasMixed) {
    throw new Error(
      "Shift-chart data contains contradictory relationship categories.",
    );
  }
  if (hasSame) {
    return { kind: "same", seconds: row.sameRelationships!.get(partnerId)! };
  }
  if (hasMixed) {
    return {
      kind: "mixed",
      seconds: row.mixedRelationships!.get(partnerId)!,
    };
  }
  return null;
}

async function fetchPlayerFallbacks(
  playerIds: number[],
): Promise<Map<number, PlayerFallbackRow>> {
  if (playerIds.length === 0) return new Map();
  const requested = new Set(playerIds);
  const rows = await fetchAllSupabaseFilterChunks<PlayerFallbackRow, number>(
    playerIds,
    (chunk, { from, to }) =>
      supabase
        .from("players")
        .select("id,fullName,position")
        .in("id", chunk)
        .order("id", { ascending: true })
        .range(from, to),
    { chunkSize: RAW_PLAYER_FALLBACK_CHUNK_SIZE },
  );

  const fallbacks = new Map<number, PlayerFallbackRow>();
  for (const row of rows) {
    const playerId = readPositiveSafeInteger(row.id, "fallback player ID");
    if (!requested.has(playerId) || fallbacks.has(playerId)) {
      throw new Error("Player fallback data contains an unexpected identity.");
    }
    fallbacks.set(playerId, row);
  }
  return fallbacks;
}

function incrementRecord(
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

async function buildRawResult(
  rows: RawShiftChartRow[],
  canonicalTeamAbbreviation: string,
  startDate: string,
  endDate: string,
  expectedGameType: "2" | "3",
): Promise<RawTOIDataResult> {
  const teamInfo = teamsInfo[canonicalTeamAbbreviation];
  const seenRowIds = new Set<number>();
  const seenPlayerGames = new Set<string>();
  const rowsByGame = new Map<number, NormalizedShiftRow[]>();

  for (const row of rows) {
    const rowId = readPositiveSafeInteger(row.id, "row ID");
    const gameId = readPositiveSafeInteger(row.game_id, "game ID");
    const playerId = readPositiveSafeInteger(row.player_id, "player ID");
    if (seenRowIds.has(rowId)) {
      throw new Error("Shift-chart data contains a duplicate row ID.");
    }
    seenRowIds.add(rowId);

    const playerGameKey = `${gameId}:${playerId}`;
    if (seenPlayerGames.has(playerGameKey)) {
      throw new Error("Shift-chart data contains a duplicate player-game row.");
    }
    seenPlayerGames.add(playerGameKey);

    if (
      row.team_id !== teamInfo.id ||
      row.team_abbreviation !== canonicalTeamAbbreviation
    ) {
      throw new Error("Shift-chart data conflicts with the canonical team.");
    }
    if (row.game_type != null && row.game_type !== expectedGameType) {
      throw new Error(
        "Shift-chart data conflicts with the selected season type.",
      );
    }
    if (
      !isValidIsoDate(row.game_date) ||
      row.game_date < startDate ||
      row.game_date > endDate
    ) {
      throw new Error("Shift-chart data contains an invalid scoped game date.");
    }

    let seasonId: number | null = null;
    if (row.season_id != null) {
      seasonId = readPositiveSafeInteger(row.season_id, "season ID");
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

    const gameToi = readAppearanceToi(row);
    const gameLength = readNullableDuration(row.game_length, "game length");
    if (gameLength === 0) {
      throw new Error("Shift-chart data contains an invalid game length.");
    }

    const normalized: NormalizedShiftRow = {
      rowId,
      gameId,
      gameType:
        row.game_type === "2" || row.game_type === "3" ? row.game_type : null,
      gameDate: row.game_date,
      seasonId,
      playerId,
      gameToi,
      gameLength,
      appearanceExceedsGameLength:
        gameToi != null && gameLength != null && gameToi > gameLength,
      homeOrAway,
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
    gameRows.push(normalized);
    rowsByGame.set(gameId, gameRows);
  }

  const includedRows: NormalizedShiftRow[] = [];
  const pairGameFacts: PairGameFact[] = [];
  const includedGames: Array<{
    gameId: number;
    gameDate: string;
    homeOrAway: "home" | "away";
  }> = [];
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
        relationships?.forEach((_seconds, partnerId) => {
          if (!playerIds.has(partnerId)) {
            throw new Error(
              "Shift-chart data contains a relationship to an unknown player.",
            );
          }
        });
      }
    }

    const gameDates = new Set(gameRows.map((row) => row.gameDate));
    const seasonIds = new Set(
      gameRows
        .map((row) => row.seasonId)
        .filter((value): value is number => value != null),
    );
    const homeAwayValues = new Set(
      gameRows
        .map((row) => row.homeOrAway)
        .filter((value): value is "home" | "away" => value != null),
    );
    const gameLengths = new Set(
      gameRows
        .map((row) => row.gameLength)
        .filter((value): value is number => value != null),
    );
    if (
      gameDates.size !== 1 ||
      seasonIds.size > 1 ||
      homeAwayValues.size > 1 ||
      gameLengths.size > 1
    ) {
      throw new Error("Shift-chart player rows disagree on game metadata.");
    }

    let incomplete = gameRows.some(
      (row) =>
        row.gameType == null ||
        row.seasonId == null ||
        row.gameToi == null ||
        row.gameLength == null ||
        row.sameRelationships == null ||
        row.mixedRelationships == null,
    );
    const gameFacts: PairGameFact[] = [];

    if (!incomplete) {
      const orderedRows = [...gameRows].sort(
        (left, right) => left.playerId - right.playerId,
      );
      for (
        let firstIndex = 0;
        firstIndex < orderedRows.length;
        firstIndex += 1
      ) {
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
            incomplete = true;
            break;
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
            firstObservation.seconds > (first.gameToi ?? 0) ||
            firstObservation.seconds > (second.gameToi ?? 0)
          ) {
            incomplete = true;
            break;
          }
          gameFacts.push({
            gameId,
            firstPlayerId: first.playerId,
            secondPlayerId: second.playerId,
            seconds: firstObservation.seconds,
          });
        }
        if (incomplete) break;
      }
    }

    if (incomplete) {
      skippedRows += gameRows.length;
      continue;
    }
    includedRows.push(...gameRows);
    pairGameFacts.push(...gameFacts);
    const homeOrAway = [...homeAwayValues][0];
    if (homeOrAway) {
      includedGames.push({
        gameId,
        gameDate: gameRows[0].gameDate,
        homeOrAway,
      });
    }
  }

  if (new Set(includedRows.map((row) => row.seasonId)).size > 1) {
    throw new Error("Shift-chart data spans conflicting season identities.");
  }

  const accumulators = new Map<number, PlayerAccumulator>();
  for (const row of includedRows.sort(
    (left, right) =>
      left.gameDate.localeCompare(right.gameDate) ||
      left.gameId - right.gameId ||
      left.rowId - right.rowId,
  )) {
    const accumulator = accumulators.get(row.playerId) ?? {
      playerId: row.playerId,
      firstName: null,
      lastName: null,
      primaryPosition: null,
      displayPosition: null,
      playerType: null,
      gamesPlayed: new Set<number>(),
      totalToi: 0,
      totalGameLength: 0,
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
    accumulator.totalToi += row.gameToi!;
    accumulator.totalGameLength += row.gameLength!;
    if (row.lineCombination != null) {
      incrementStringRecord(accumulator.timesOnLine, row.lineCombination, 1);
    }
    if (row.pairingCombination != null) {
      incrementStringRecord(accumulator.timesOnPair, row.pairingCombination, 1);
    }
    accumulators.set(row.playerId, accumulator);
  }

  const fallbackIds = [...accumulators.values()]
    .filter(
      (player) =>
        !player.firstName ||
        !player.lastName ||
        (!player.primaryPosition && !player.displayPosition) ||
        !player.playerType,
    )
    .map((player) => player.playerId);
  const fallbackByPlayerId = await fetchPlayerFallbacks(fallbackIds);

  const canonicalPlayerTypes = new Map(
    [...accumulators.values()].map((player) => [
      player.playerId,
      resolveCanonicalPlayerPosition(
        player,
        fallbackByPlayerId.get(player.playerId),
      ).playerType,
    ]),
  );

  for (const fact of pairGameFacts) {
    const first = accumulators.get(fact.firstPlayerId)!;
    const second = accumulators.get(fact.secondPlayerId)!;
    const canonicalKind = canonicalRelationshipKind(
      canonicalPlayerTypes.get(fact.firstPlayerId)!,
      canonicalPlayerTypes.get(fact.secondPlayerId)!,
    );
    const firstTarget =
      canonicalKind === "same" ? first.timeSpentWith : first.timeSpentWithMixed;
    const secondTarget =
      canonicalKind === "same"
        ? second.timeSpentWith
        : second.timeSpentWithMixed;
    incrementRecord(firstTarget, second.playerId, fact.seconds);
    incrementRecord(secondTarget, first.playerId, fact.seconds);
    incrementRecord(first.timesPlayedWith, second.playerId, 1);
    incrementRecord(second.timesPlayedWith, first.playerId, 1);
    incrementRecord(first.mutualSharedToi, second.playerId, fact.seconds);
    incrementRecord(second.mutualSharedToi, first.playerId, fact.seconds);
  }

  const roster = [...accumulators.values()]
    .sort((left, right) => left.playerId - right.playerId)
    .map((player): PlayerData => {
      const fallback = fallbackByPlayerId.get(player.playerId);
      const fallbackName = readOptionalText(
        fallback?.fullName,
        "fallback player name",
      );
      const rowName =
        player.firstName && player.lastName
          ? `${player.firstName} ${player.lastName}`
          : null;
      const name = rowName || fallbackName;
      const { primaryPosition, displayPosition, playerType } =
        resolveCanonicalPlayerPosition(player, fallback);
      if (!name) {
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

      const percentToiWith = Object.fromEntries(
        Object.entries(player.timeSpentWith).map(([partnerId, seconds]) => [
          Number(partnerId),
          player.totalToi > 0 ? (seconds / player.totalToi) * 100 : 0,
        ]),
      );
      const percentToiWithMixed = Object.fromEntries(
        Object.entries(player.timeSpentWithMixed).map(
          ([partnerId, seconds]) => [
            Number(partnerId),
            player.totalToi > 0 ? (seconds / player.totalToi) * 100 : 0,
          ],
        ),
      );
      const percentOfSeason = Object.fromEntries(
        Object.entries(player.timeSpentWith).map(([partnerId, seconds]) => [
          Number(partnerId),
          player.totalGameLength > 0
            ? (seconds / player.totalGameLength) * 100
            : 0,
        ]),
      );
      const lastName =
        player.lastName ||
        (fallbackName ? lastNameFromFullName(fallbackName) : "");
      if (!lastName) {
        throw new Error(
          "Shift-chart data cannot resolve canonical player metadata.",
        );
      }

      return {
        id: player.playerId,
        teamId: teamInfo.id,
        franchiseId: teamInfo.franchiseId,
        position: primaryPosition,
        name,
        playerAbbrevName: abbreviatedName(name),
        lastName,
        totalTOI: player.totalToi,
        timesOnLine: player.timesOnLine,
        timesOnPair: player.timesOnPair,
        percentToiWith,
        percentToiWithMixed,
        timeSpentWith: player.timeSpentWith,
        timeSpentWithMixed: player.timeSpentWithMixed,
        GP: player.gamesPlayed.size,
        timesPlayedWith: player.timesPlayedWith,
        ATOI:
          player.gamesPlayed.size > 0
            ? formatClock(player.totalToi / player.gamesPlayed.size)
            : "00:00",
        percentOfSeason,
        displayPosition,
        comboPoints: 0,
        mutualSharedToi: player.mutualSharedToi,
        playerType,
      };
    });

  const rosterByPlayerId = new Map(roster.map((player) => [player.id, player]));
  const pairTotals = new Map<
    string,
    { firstPlayerId: number; secondPlayerId: number; seconds: number }
  >();
  for (const fact of pairGameFacts) {
    const key = pairKey(fact.firstPlayerId, fact.secondPlayerId);
    const total = pairTotals.get(key) ?? {
      firstPlayerId: Math.min(fact.firstPlayerId, fact.secondPlayerId),
      secondPlayerId: Math.max(fact.firstPlayerId, fact.secondPlayerId),
      seconds: 0,
    };
    total.seconds += fact.seconds;
    pairTotals.set(key, total);
  }

  const toiData = [...pairTotals.values()]
    .sort(
      (left, right) =>
        left.firstPlayerId - right.firstPlayerId ||
        left.secondPlayerId - right.secondPlayerId,
    )
    .map((pair): TOIData => ({
      toi: pair.seconds,
      p1: rosterByPlayerId.get(pair.firstPlayerId)!,
      p2: rosterByPlayerId.get(pair.secondPlayerId)!,
    }));
  const playerATOI = Object.fromEntries(
    roster.map((player) => [player.id, player.ATOI]),
  );

  return {
    toiData,
    roster,
    team: { id: teamInfo.id, name: teamInfo.name },
    homeAwayInfo: includedGames.map((game) => ({
      gameId: game.gameId,
      homeOrAway: game.homeOrAway,
    })),
    playerATOI,
    coverage: {
      inputRows: rows.length,
      rosterRows: roster.length,
      skippedRows,
    },
  };
}

export async function getTOIDataForGames(
  teamAbbreviation: string,
  startDate: string,
  endDate: string,
  seasonType: RawSeasonType = "regularSeason",
): Promise<RawTOIDataResult> {
  const canonicalTeamAbbreviation = teamAbbreviation.trim().toUpperCase();
  const teamInfo = teamsInfo[canonicalTeamAbbreviation];
  if (!teamInfo) {
    throw new Error("A canonical team abbreviation is required.");
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
  const gameType = seasonType === "playoffs" ? "3" : "2";

  const rows = await fetchAllSupabasePages<RawShiftChartRow>(
    ({ from, to }) =>
      supabase
        .from("shift_charts")
        .select(RAW_SHIFT_CHART_FIELDS)
        .eq("team_abbreviation", canonicalTeamAbbreviation)
        .eq("team_id", teamInfo.id)
        .or(`game_type.eq.${gameType},game_type.is.null`)
        .gte("game_date", startDate)
        .lte("game_date", endDate)
        .order("id", { ascending: true })
        .range(from, to),
    { pageSize: RAW_SHIFT_CHART_PAGE_SIZE },
  );

  return buildRawResult(
    rows,
    canonicalTeamAbbreviation,
    startDate,
    endDate,
    gameType,
  );
}

export function useTOI(
  teamAbbreviation: string,
  startDate: string,
  endDate: string,
  seasonType: RawSeasonType = "regularSeason",
) {
  const [toi, setTOI] = useState<TOIData[]>([]);
  const [rosters, setRosters] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [homeAwayInfo, setHomeAwayInfo] = useState<
    { gameId: number; homeOrAway: string }[]
  >([]);
  const [playerATOI, setPlayerATOI] = useState<Record<number, string>>({});

  useEffect(() => {
    let mounted = true;
    if (!teamAbbreviation || !startDate || !endDate) {
      setTOI([]);
      setRosters([]);
      setTeam(null);
      setHomeAwayInfo([]);
      setPlayerATOI({});
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
    setLoading(true);

    (async () => {
      try {
        const { toiData, roster, team, homeAwayInfo, playerATOI } =
          await getTOIDataForGames(
            teamAbbreviation,
            startDate,
            endDate,
            seasonType,
          );
        if (mounted) {
          setTOI(toiData);
          setRosters(roster);
          setTeam(team);
          setHomeAwayInfo(homeAwayInfo);
          setPlayerATOI(playerATOI);
        }
      } catch (error) {
        if (mounted) {
          setTOI([]);
          setRosters([]);
          setTeam(null);
          setHomeAwayInfo([]);
          setPlayerATOI({});
        }
        console.error("Unable to load raw DRM data.", error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [teamAbbreviation, startDate, endDate, seasonType]);

  return [toi, rosters, team, loading, homeAwayInfo, playerATOI] as const;
}
