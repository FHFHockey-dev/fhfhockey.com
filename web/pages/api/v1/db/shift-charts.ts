/**
 * API Endpoint: /api/v1/db/shift-charts
 * HTTP Method: POST
 *
 * Description:
 * This endpoint is responsible for fetching, processing, and storing detailed shift chart data from the NHL's public APIs
 * into the Supabase `shift_charts` table. It is designed to be run incrementally without any parameters. It automatically
 * detects the most recently processed game and fetches data for all subsequent finished games, ensuring that the database
 * stays up-to-date.
 *
 * ---
 *
 * URL Query Parameters:
 *
 * `gameId` is optional. When omitted, the route runs its incremental scheduled
 * scope. A positive `gameId` selects one final game for a bounded canary or
 * correction repair and bypasses the incremental date watermark.
 *
 * ---
 *
 * Usage Examples:
 *
 * To trigger the incremental update, send a POST request to the endpoint. This can be done via a cron job, a manual
 * trigger from a frontend, or a command-line tool like cURL.
 *
 * - Example using cURL:
 *   `curl -X POST http://localhost:3000/api/v1/db/shift-charts`
 *
 *   When executed, this command will:
 *   1. Check the `shift_charts` table for the latest game date it has processed.
 *   2. Fetch the NHL schedule for the current season.
 *   3. Identify all games that have a `gameState` of "FINAL" or "OFF" and a `gameDate` after the latest one in the database.
 *   4. For each new, finished game, it fetches the detailed shift data, processes it, and upserts it into the database.
 *
 * ---
 *
 * Notes:
 *
 * - This endpoint is protected by `adminOnly` middleware and requires proper authentication.
 * - It is idempotent; running it multiple times will not create duplicate data. It will only add data for new games.
 * - This is a critical data ingestion step required for calculating player time on ice (TOI) and line combinations.
 */
// C:\Users\timbr\Desktop\FHFH\fhfhockey.com\web\pages\api\v1\db\shift-charts.ts
import { NextApiRequest, NextApiResponse } from "next";
import type { Json } from "lib/supabase/database-generated.types";
import supabase from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";
import { parseQueryPositiveInt } from "lib/api/queryParams";
import { getCurrentSeason } from "lib/NHL/server";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { buildShiftChartRelationshipUpsert } from "lib/projections/shiftChartRelationshipPayload";
import {
  buildShiftRelationshipStrengthSegments,
  fetchAllNhleShiftChartsForGame,
  type NhleShiftRow,
} from "lib/projections/ingest/shifts";
import {
  buildProjectionPbpSourceHash,
  buildProjectionShiftSourceHash,
} from "lib/projections/ingest/projectionInputPersistence";
import {
  fetchPbpGame,
  isCompleteFinalPbpPayload,
  type PbpResponse,
} from "lib/projections/ingest/pbp";
import {
  persistShiftChartRelationships,
  selectPendingRelationshipGameIds,
  type RelationshipQueueStatus,
} from "lib/projections/relationshipMaterialization";
import {
  formatCompletedPbpGameLength,
  normalizeNhlGameType,
} from "lib/projections/gameLength";

// TODO : integrate home_or_away, opponent_team_id and opponent_team_abbreviation

// Define Interfaces

interface TeamInfo {
  name: string;
  franchiseId: number;
  id: number;
}

interface GameInfo {
  gameType: string | number;
  gameDate: string;
  homeTeam: TeamDetail;
  awayTeam: TeamDetail;
  game_id: number;
  season_id: number;
}

interface TeamDetail {
  id: number;
  abbrev: string;
  // other relevant fields if necessary
}

interface Shift {
  shiftNumber: number;
  period: number;
  startTime: string;
  endTime: string;
  duration?: string;
  playerId: number;
  firstName: string;
  lastName: string;
  teamId: number;
  teamAbbrev: string;
}

interface PlayerPosition {
  full_name: string;
  display_position: string | null;
  primary_position: string | null;
}

interface ShiftChartData {
  data: NhleShiftRow[];
  sourceShiftHash: string;
}

interface ConsolidatedPlayerData {
  game_id: number;
  game_type: string;
  game_date: string;
  season_id: number;
  player_id: number;
  player_first_name: string;
  player_last_name: string;
  team_id: number;
  team_abbreviation: string;
  home_or_away: "home" | "away";
  opponent_team_id: number;
  opponent_team_abbreviation: string;
  shifts: ShiftDetail[];
  pp_shifts: PPShift[];
  es_shifts: ESShift[];
  time_spent_with: Record<string, string>;
  percent_toi_with: Record<string, string>;
  time_spent_with_mixed: Record<string, string>;
  percent_toi_with_mixed: Record<string, string>;
  game_length: string;
  game_toi: string;
  total_pp_toi: string;
  total_es_toi: string;
  display_position: string | null;
  primary_position: string | null;
  player_type: "G" | "F" | "D" | null;
  line_combination: number | null;
  pairing_combination: number | null;
}

interface ShiftDetail {
  shift_number: number;
  period: number;
  start_time: string;
  end_time: string;
  duration: string;
  playerId: number;
}

interface PPShift {
  period: number;
  duration: string;
  start_time: string;
  end_time: string;
  shift_number: number;
}

interface ESShift {
  period: number;
  duration: string;
  start_time: string;
  end_time: string;
  shift_number: number;
}

function projectShiftSegmentsToJson(
  segments: ReadonlyArray<PPShift | ESShift>,
): Json {
  return segments.map((segment) => ({
    period: segment.period,
    duration: segment.duration,
    start_time: segment.start_time,
    end_time: segment.end_time,
    shift_number: segment.shift_number,
  }));
}

interface BatchData extends ConsolidatedPlayerData {}

// PlayerInfo Interface for Team Logs
interface PlayerInfo {
  name: string;
  id: number;
  toi: string;
  shared_toi: Record<string, string>;
  line_combination: number | null;
  pairing_combination: number | null;
}

interface TeamLogs {
  forwards: PlayerInfo[];
  defensemen: PlayerInfo[];
  lines: Record<number, PlayerInfo[]>;
  pairs: Record<number, PlayerInfo[]>;
}

// Teams Info
const teamsInfo: Record<string, TeamInfo> = {
  NJD: { name: "New Jersey Devils", franchiseId: 23, id: 1 },
  NYI: { name: "New York Islanders", franchiseId: 22, id: 2 },
  NYR: { name: "New York Rangers", franchiseId: 10, id: 3 },
  PHI: { name: "Philadelphia Flyers", franchiseId: 16, id: 4 },
  PIT: { name: "Pittsburgh Penguins", franchiseId: 17, id: 5 },
  BOS: { name: "Boston Bruins", franchiseId: 6, id: 6 },
  BUF: { name: "Buffalo Sabres", franchiseId: 19, id: 7 },
  MTL: { name: "Montréal Canadiens", franchiseId: 1, id: 8 },
  OTT: { name: "Ottawa Senators", franchiseId: 30, id: 9 },
  TOR: { name: "Toronto Maple Leafs", franchiseId: 5, id: 10 },
  CAR: { name: "Carolina Hurricanes", franchiseId: 26, id: 12 },
  FLA: { name: "Florida Panthers", franchiseId: 33, id: 13 },
  TBL: { name: "Tampa Bay Lightning", franchiseId: 31, id: 14 },
  WSH: { name: "Washington Capitals", franchiseId: 24, id: 15 },
  CHI: { name: "Chicago Blackhawks", franchiseId: 11, id: 16 },
  DET: { name: "Detroit Red Wings", franchiseId: 12, id: 17 },
  NSH: { name: "Nashville Predators", franchiseId: 34, id: 18 },
  STL: { name: "St. Louis Blues", franchiseId: 18, id: 19 },
  CGY: { name: "Calgary Flames", franchiseId: 21, id: 20 },
  COL: { name: "Colorado Avalanche", franchiseId: 27, id: 21 },
  EDM: { name: "Edmonton Oilers", franchiseId: 25, id: 22 },
  VAN: { name: "Vancouver Canucks", franchiseId: 20, id: 23 },
  ANA: { name: "Anaheim Ducks", franchiseId: 32, id: 24 },
  DAL: { name: "Dallas Stars", franchiseId: 15, id: 25 },
  LAK: { name: "Los Angeles Kings", franchiseId: 14, id: 26 },
  SJS: { name: "San Jose Sharks", franchiseId: 29, id: 28 },
  CBJ: { name: "Columbus Blue Jackets", franchiseId: 36, id: 29 },
  MIN: { name: "Minnesota Wild", franchiseId: 37, id: 30 },
  WPG: { name: "Winnipeg Jets", franchiseId: 35, id: 52 },
  ARI: { name: "Arizona Coyotes", franchiseId: 28, id: 53 },
  VGK: { name: "Vegas Golden Knights", franchiseId: 38, id: 54 },
  SEA: { name: "Seattle Kraken", franchiseId: 39, id: 55 },
  UTA: { name: "Utah Hockey Club", franchiseId: 40, id: 59 },
};

// Helper Functions

/**
 * Determines if a game has finished based on its `gameState`.
 * @param game - Game object from the schedule.
 * @returns True if the game is finished, else false.
 */
function isGameFinished(game: any): boolean {
  const finishedStates = ["FINAL", "OFF"]; // Add other finished states if necessary
  return finishedStates.includes(game.gameState);
}

function parseTime(timeStr: string): number {
  const [minutes, seconds] = timeStr.split(":").map(Number);
  return minutes * 60 + seconds;
}

/**
 * Retrieves the latest processed game_date from the shift_charts table.
 * @returns The latest game_date as a string, or null if no data exists.
 */
async function getLatestProcessedGameDate(): Promise<string | null> {
  const { data, error } = await supabase
    .from("shift_charts")
    .select("game_date")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows found
      console.warn("No existing records found in shift_charts.");
      return null;
    }
    throw new Error(`Error fetching latest shift-chart date: ${error.message}`);
  }

  return data.game_date || null;
}

/**
 * Sums an array of duration strings in "MM:SS" format and returns the total duration as "MM:SS".
 * @param durations - Array of duration strings.
 * @returns Total duration as "MM:SS".
 */
function sumDurations(durations: string[]): string {
  let totalSeconds = 0;

  durations.forEach((duration) => {
    const [minutes, seconds] = duration.split(":").map(Number);
    if (!isNaN(minutes) && !isNaN(seconds)) {
      totalSeconds += minutes * 60 + seconds;
    } else {
      console.warn(`Invalid duration format: ${duration}`);
    }
  });

  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${totalMinutes}:${
    remainingSeconds < 10 ? "0" : ""
  }${remainingSeconds}`;
}

/**
 * Formats duration from seconds to "MM:SS" format.
 * @param seconds - Total seconds.
 * @returns Formatted duration string.
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}

/**
 * Determines the player type based on position.
 * @param primaryPosition - Primary position code.
 * @param displayPosition - Display position code.
 * @returns "G", "F", "D", or null.
 */
function getPlayerType(
  primaryPosition: string | null,
  displayPosition: string | null,
): "G" | "F" | "D" | null {
  if (primaryPosition === "G" || displayPosition === "G") {
    return "G";
  } else if (isForward(primaryPosition)) {
    return "F";
  } else if (isDefense(primaryPosition)) {
    return "D";
  }
  return null;
}

/**
 * Determines if a position is forward
 * @param position - Position code (e.g., "LW", "RW", "C")
 * @returns True if forward, else false.
 */
function isForward(position: string | null): boolean {
  return position !== null && ["LW", "RW", "C"].includes(position);
}

/**
 * Determines if a position is defense
 * @param position - Position code (e.g., "D")
 * @returns True if defense, else false.
 */
function isDefense(position: string | null): boolean {
  return position !== null && ["D"].includes(position);
}

/**
 * Group array items by a key.
 * @param array - Array of items.
 * @param keyGetter - Function to get the key from an item.
 * @returns Map with keys and grouped items.
 */
function groupBy<T, K>(array: T[], keyGetter: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  array.forEach((item) => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}

/**
 * Calculates pairwise Time On Ice (TOI) between two players.
 * @param shifts - Array of shift objects for player 1.
 * @param p1 - Player 1 ID.
 * @param p2 - Player 2 ID.
 * @returns Total TOI in seconds.
 */
function getPairwiseTOI(shifts: ShiftDetail[], p1: number, p2: number): number {
  const p1Shifts = shifts.filter((shift) => shift.playerId === p1);
  const p2Shifts = shifts.filter((shift) => shift.playerId === p2);

  let totalOverlap = 0;

  p1Shifts.forEach((shift1) => {
    p2Shifts.forEach((shift2) => {
      if (shift1.period !== shift2.period) return;

      const shift1Start = parseTime(shift1.start_time);
      const shift1End = parseTime(shift1.end_time);
      const shift2Start = parseTime(shift2.start_time);
      const shift2End = parseTime(shift2.end_time);

      const overlapStart = Math.max(shift1Start, shift2Start);
      const overlapEnd = Math.min(shift1End, shift2End);

      if (overlapStart < overlapEnd) {
        totalOverlap += overlapEnd - overlapStart;
      }
    });
  });

  return totalOverlap;
}

/**
 * Generates team logs for lines and pairs.
 * @param consolidatedData - Consolidated player data.
 * @param pairwiseTOI - Pairwise TOI data.
 * @returns Teams object with lines and pairs.
 */
function generateTeamLogs(
  consolidatedData: Record<string, ConsolidatedPlayerData>,
  pairwiseTOI: Record<string, { toi: number }>,
): Record<string, TeamLogs> {
  const teams: Record<string, TeamLogs> = {};

  // Group players by team abbreviation
  const playersByTeam = groupBy(
    Object.values(consolidatedData),
    (player) => player.team_abbreviation,
  );

  for (const [teamAbbrev, players] of playersByTeam.entries()) {
    teams[teamAbbrev] = {
      forwards: [],
      defensemen: [],
      lines: {},
      pairs: {},
    };

    players.forEach((player) => {
      const playerInfo: PlayerInfo = {
        name: `${player.player_first_name} ${player.player_last_name}`,
        id: player.player_id,
        toi: player.game_toi,
        shared_toi: player.percent_toi_with,
        line_combination: player.line_combination,
        pairing_combination: player.pairing_combination,
      };

      if (isForward(player.primary_position)) {
        teams[teamAbbrev].forwards.push(playerInfo);
      } else if (isDefense(player.primary_position)) {
        teams[teamAbbrev].defensemen.push(playerInfo);
      }
    });

    // Sort players by TOI
    teams[teamAbbrev].forwards.sort(
      (a: PlayerInfo, b: PlayerInfo) => parseTime(b.toi) - parseTime(a.toi),
    );
    teams[teamAbbrev].defensemen.sort(
      (a: PlayerInfo, b: PlayerInfo) => parseTime(b.toi) - parseTime(a.toi),
    );

    const { forwards, defensemen } = teams[teamAbbrev];

    const usedForwards = new Set<number>();
    const usedDefensemen = new Set<number>();

    // Assign lines
    for (let line = 1; line <= 4; line++) {
      const pivotPlayer = forwards.find(
        (player) => !usedForwards.has(player.id),
      );
      if (!pivotPlayer) break;

      const linemates = forwards
        .filter(
          (player: PlayerInfo) =>
            !usedForwards.has(player.id) && player.id !== pivotPlayer.id,
        )
        .sort(
          (a: PlayerInfo, b: PlayerInfo) =>
            parseTime(
              consolidatedData[`${pivotPlayer.id}`].time_spent_with[
                `${b.id}`
              ] || "0:00",
            ) -
            parseTime(
              consolidatedData[`${pivotPlayer.id}`].time_spent_with[
                `${a.id}`
              ] || "0:00",
            ),
        )
        .slice(0, 2);

      if (linemates.length < 2) {
        console.warn(
          `Not enough linemates for Line ${line} in Team ${teamAbbrev}.`,
        );
      }

      const linePlayers = [pivotPlayer, ...linemates];
      linePlayers.forEach((player) => usedForwards.add(player.id));
      teams[teamAbbrev].lines[line] = linePlayers;

      console.log(
        `Assigned Line ${line} for Team ${teamAbbrev}: ${linePlayers
          .map((p: PlayerInfo) => p.name)
          .join(", ")}`,
      );
    }

    // Assign pairs
    for (let pair = 1; pair <= 3; pair++) {
      const pivotPlayer = defensemen.find(
        (player) => !usedDefensemen.has(player.id),
      );
      if (!pivotPlayer) break;

      const pairPlayer = defensemen
        .filter(
          (player: PlayerInfo) =>
            !usedDefensemen.has(player.id) && player.id !== pivotPlayer.id,
        )
        .sort(
          (a: PlayerInfo, b: PlayerInfo) =>
            parseTime(
              consolidatedData[`${pivotPlayer.id}`].time_spent_with[
                `${b.id}`
              ] || "0:00",
            ) -
            parseTime(
              consolidatedData[`${pivotPlayer.id}`].time_spent_with[
                `${a.id}`
              ] || "0:00",
            ),
        )
        .slice(0, 1);

      if (pairPlayer.length < 1) {
        console.warn(
          `Not enough pair players for Pair ${pair} in Team ${teamAbbrev}.`,
        );
      }

      const pairPlayers = [pivotPlayer, ...pairPlayer];
      pairPlayers.forEach((player) => usedDefensemen.add(player.id));
      teams[teamAbbrev].pairs[pair] = pairPlayers;

      console.log(
        `Assigned Pair ${pair} for Team ${teamAbbrev}: ${pairPlayers
          .map((p: PlayerInfo) => p.name)
          .join(", ")}`,
      );
    }
  }

  return teams;
}

// Main Functions

async function listPendingRelationshipGameIds(
  seasonId: number,
  maxGames: number,
): Promise<number[]> {
  const games = await fetchAllSupabasePages<{ id: number; date: string }>(
    ({ from, to }) =>
      supabase
        .from("games")
        .select("id,date")
        .eq("seasonId", seasonId)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
  );
  const statuses = await fetchAllSupabasePages<RelationshipQueueStatus>(
    ({ from, to }) =>
      (supabase as any)
        .from("projection_game_materialization_status")
        .select(
          "game_id,input_status,input_fingerprint,relationship_status,relationship_input_fingerprint,relationship_algorithm_version",
        )
        .eq("input_status", "complete")
        .order("game_id", { ascending: true })
        .range(from, to),
  );
  return selectPendingRelationshipGameIds({ games, statuses, maxGames });
}

/**
 * Fetches the team schedule for a given team and season.
 * @param teamAbbreviation - Team abbreviation (e.g., "NJD").
 * @param seasonId - Season ID.
 * @returns Team schedule data.
 */
async function fetchTeamSchedule(
  teamAbbreviation: string,
  seasonId: number,
): Promise<any> {
  console.log(
    `Fetching schedule for ${teamAbbreviation} in season ${seasonId}`,
  );
  const scheduleUrl = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/${seasonId}`;
  const response = await fetch(scheduleUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch schedule for ${teamAbbreviation}: ${response.statusText}`,
    );
  }
  const data = await response.json();
  return data;
}

/**
 * Fetches shift chart data for a given game ID.
 * @param gameId - Game ID.
 * @returns Shift chart data.
 */
async function fetchShiftChartData(gameId: number): Promise<ShiftChartData> {
  const allRows = await fetchAllNhleShiftChartsForGame(gameId);
  if (allRows.length === 0) {
    throw new Error(`No shift chart data found for game ID: ${gameId}`);
  }
  const intervalRows = allRows.filter((row) => row.typeCode === 517);
  if (intervalRows.length === 0) {
    throw new Error(`No shift intervals found for game ID: ${gameId}`);
  }
  return {
    data: intervalRows,
    sourceShiftHash: buildProjectionShiftSourceHash(allRows),
  };
}

/**
 * Fetches all player positions from the Supabase `yahoo_positions` table.
 * @returns Array of player position objects.
 */
async function fetchAllPlayerPositions(): Promise<PlayerPosition[]> {
  const pageSize = 1000;
  let offset = 0;
  let allPositions: PlayerPosition[] = [];
  let fetchMore = true;
  while (fetchMore) {
    const { data, error } = await supabase
      .from("yahoo_positions")
      .select("*")
      .order("player_key", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`Error fetching player positions: ${error.message}`);
    } else {
      allPositions = allPositions.concat(data as PlayerPosition[]);
      offset += pageSize;
      fetchMore = data.length === pageSize;
    }
  }
  console.log(
    `Fetched ${allPositions.length} player positions from yahoo_positions`,
  );
  return allPositions;
}

/**
 * Upserts shift chart data into the Supabase `shift_charts` table.
 * @param shiftChartData - Shift chart data.
 * @param gameInfo - Information about the game.
 * @param playerPositions - Array of player position objects.
 * @returns Array of unmatched player names and upsert count.
 */
async function upsertShiftChartData(
  shiftChartData: ShiftChartData,
  gameInfo: GameInfo,
  playerPositions: PlayerPosition[],
  pbp: PbpResponse,
): Promise<{
  unmatchedNames: string[];
  upsertCount: number;
  verifiedCount: number;
  prunedCount: number;
  idempotent: boolean;
}> {
  const unmatchedNamesSet = new Set<string>();
  const consolidatedData: Record<string, ConsolidatedPlayerData> = {};

  const gameLength = formatCompletedPbpGameLength(pbp);
  const strengthSegmentsByPlayer = groupBy(
    buildShiftRelationshipStrengthSegments(
      gameInfo.game_id,
      pbp,
      shiftChartData.data,
    ),
    (segment) => segment.playerId,
  );

  // Use groupBy to group shifts by playerId
  const shiftsByPlayer = groupBy(
    shiftChartData.data,
    (shift) => shift.playerId,
  );

  // Process each player's shifts
  for (const [playerId, shifts] of shiftsByPlayer.entries()) {
    const playerKey = `${playerId}`;
    const firstShift = shifts[0]; // Assuming all shifts have consistent player info

    const playerName = `${firstShift.firstName} ${firstShift.lastName}`;
    const matchedPosition = playerPositions.find(
      (pos) => pos.full_name === playerName,
    );
    if (!matchedPosition) {
      unmatchedNamesSet.add(playerName);
    }
    const isHomeTeam = firstShift.teamId === gameInfo.homeTeam.id;
    const isAwayTeam = firstShift.teamId === gameInfo.awayTeam.id;
    if (!isHomeTeam && !isAwayTeam) {
      throw new Error(
        `Shift team ${firstShift.teamId} is not scheduled for game ${gameInfo.game_id}`,
      );
    }
    const opponentTeam = isHomeTeam ? gameInfo.awayTeam : gameInfo.homeTeam;

    // Initialize player data in consolidatedData
    consolidatedData[playerKey] = {
      game_id: gameInfo.game_id,
      game_type: normalizeNhlGameType(gameInfo.gameType),
      game_date: gameInfo.gameDate,
      season_id: gameInfo.season_id,
      player_id: playerId,
      player_first_name: firstShift.firstName,
      player_last_name: firstShift.lastName,
      team_id: firstShift.teamId,
      team_abbreviation: firstShift.teamAbbrev,
      home_or_away: isHomeTeam ? "home" : "away",
      opponent_team_id: opponentTeam.id,
      opponent_team_abbreviation: opponentTeam.abbrev,
      shifts: [],
      pp_shifts: [],
      es_shifts: [],
      time_spent_with: {},
      percent_toi_with: {},
      time_spent_with_mixed: {},
      percent_toi_with_mixed: {},
      game_length: gameLength,
      game_toi: "0:00",
      total_pp_toi: "0:00",
      total_es_toi: "0:00",
      display_position: matchedPosition
        ? matchedPosition.display_position
        : null,
      primary_position: matchedPosition
        ? matchedPosition.primary_position
        : null,
      player_type: matchedPosition
        ? getPlayerType(
            matchedPosition.primary_position,
            matchedPosition.display_position,
          )
        : null,
      line_combination: null,
      pairing_combination: null,
    };

    // Process each shift for the player
    shifts.forEach((shift) => {
      const duration = shift.duration || "00:00";

      // Update game_toi
      consolidatedData[playerKey].game_toi = sumDurations([
        consolidatedData[playerKey].game_toi,
        duration,
      ]);

      // Add shift details
      consolidatedData[playerKey].shifts.push({
        shift_number: shift.shiftNumber,
        period: shift.period,
        start_time: shift.startTime,
        end_time: shift.endTime,
        duration: duration,
        playerId: shift.playerId,
      });
    });

    const playerStrengthSegments = strengthSegmentsByPlayer.get(playerId);
    if (!playerStrengthSegments || playerStrengthSegments.length === 0) {
      throw new Error(
        `Missing PBP-bound strength segments for player ${playerId} in game ${gameInfo.game_id}`,
      );
    }
    for (const segment of playerStrengthSegments) {
      const target =
        segment.strength === "pp"
          ? consolidatedData[playerKey].pp_shifts
          : consolidatedData[playerKey].es_shifts;
      // The legacy relationship contract calls every non-power-play interval
      // `es_shifts`; penalty-kill time therefore remains in this collection.
      target.push({
        period: segment.period,
        duration: segment.duration,
        start_time: segment.startTime,
        end_time: segment.endTime,
        shift_number: segment.shiftNumber,
      });
    }

    // Calculate total_pp_toi and total_es_toi for each player
    consolidatedData[playerKey].total_pp_toi = sumDurations(
      consolidatedData[playerKey].pp_shifts.map((shift) => shift.duration),
    );
    consolidatedData[playerKey].total_es_toi = sumDurations(
      consolidatedData[playerKey].es_shifts.map((shift) => shift.duration),
    );
  }

  // Calculate Time Spent With Other Players
  for (const playerKey in consolidatedData) {
    const playerData = consolidatedData[playerKey];
    const shifts = playerData.shifts.map((shift) => ({
      startTime: shift.start_time,
      endTime: shift.end_time,
      duration: shift.duration,
      period: shift.period,
      playerId: shift.playerId,
    }));

    for (const otherPlayerKey in consolidatedData) {
      if (playerKey === otherPlayerKey) continue;

      const otherPlayer = consolidatedData[otherPlayerKey];
      const isSameTeam = playerData.team_id === otherPlayer.team_id;
      const isSamePositionType =
        isForward(playerData.primary_position) ===
        isForward(otherPlayer.primary_position);

      if (!isSameTeam) continue;

      // Calculate total overlapping time
      const otherShifts = otherPlayer.shifts.map((shift) => ({
        startTime: shift.start_time,
        endTime: shift.end_time,
        duration: shift.duration,
        period: shift.period,
      }));

      let totalTimeSpent = 0;

      shifts.forEach((shift) => {
        otherShifts.forEach((otherShift) => {
          if (shift.period === otherShift.period) {
            const shiftStartSeconds = parseTime(shift.startTime);
            const shiftEndSeconds = parseTime(shift.endTime);
            const otherShiftStartSeconds = parseTime(otherShift.startTime);
            const otherShiftEndSeconds = parseTime(otherShift.endTime);

            const overlapStart = Math.max(
              shiftStartSeconds,
              otherShiftStartSeconds,
            );
            const overlapEnd = Math.min(shiftEndSeconds, otherShiftEndSeconds);

            if (overlapStart < overlapEnd) {
              totalTimeSpent += overlapEnd - overlapStart;
            }
          }
        });
      });

      const formattedTimeSpent = formatDuration(totalTimeSpent);
      const gameLengthSeconds =
        parseInt(playerData.game_length.split(":")[0]) * 60 +
        parseInt(playerData.game_length.split(":")[1]);
      const percentTOI = (totalTimeSpent / gameLengthSeconds) * 100;

      if (isSamePositionType) {
        playerData.time_spent_with[otherPlayerKey] = formattedTimeSpent;
        playerData.percent_toi_with[otherPlayerKey] = percentTOI.toFixed(2);
      } else {
        playerData.time_spent_with_mixed[otherPlayerKey] = formattedTimeSpent;
        playerData.percent_toi_with_mixed[otherPlayerKey] =
          percentTOI.toFixed(2);
      }
    }
  }

  // Calculate Pairwise TOI
  const playerDataArray = Object.values(consolidatedData);
  const pairwiseTOI: Record<string, { toi: number }> = {};
  playerDataArray.forEach((playerData) => {
    playerDataArray.forEach((otherPlayerData) => {
      const key = `${playerData.player_id}-${otherPlayerData.player_id}`;
      pairwiseTOI[key] = {
        toi: getPairwiseTOI(
          playerData.shifts,
          playerData.player_id,
          otherPlayerData.player_id,
        ),
      };
    });
  });

  // Generate Team Logs (Lines and Pairs)
  const teams = generateTeamLogs(consolidatedData, pairwiseTOI);

  for (const team in teams) {
    const { lines, pairs } = teams[team];

    for (const line in lines) {
      lines[line].forEach((player: PlayerInfo) => {
        if (consolidatedData[`${player.id}`]) {
          consolidatedData[`${player.id}`].line_combination = Number(line);
        }
      });
    }

    for (const pair in pairs) {
      pairs[pair].forEach((player: PlayerInfo) => {
        if (consolidatedData[`${player.id}`]) {
          consolidatedData[`${player.id}`].pairing_combination = Number(pair);
        }
      });
    }
  }

  // Prepare Batch Data for Upsert
  const batchData = Object.values(consolidatedData).map((data) =>
    buildShiftChartRelationshipUpsert({
      ...data,
      pp_shifts: projectShiftSegmentsToJson(data.pp_shifts),
      es_shifts: projectShiftSegmentsToJson(data.es_shifts),
    }),
  );

  const receipt = await persistShiftChartRelationships({
    gameId: gameInfo.game_id,
    sourcePbpHash: buildProjectionPbpSourceHash(pbp),
    sourceShiftHash: shiftChartData.sourceShiftHash,
    rows: batchData,
  });
  const verifiedCount = receipt.relationshipRows;
  const upsertCount = receipt.idempotent ? 0 : verifiedCount;
  console.log(
    `Persisted exact shift-chart relationship scope for game ${gameInfo.game_id}.`,
  );

  return {
    unmatchedNames: Array.from(unmatchedNamesSet),
    upsertCount,
    verifiedCount,
    prunedCount: receipt.prunedRows,
    idempotent: receipt.idempotent,
  };
}

/**
 * Main function to fetch and store shift charts.
 */
/**
 * Main function to fetch and store shift charts.
 */
async function fetchAndStoreShiftCharts(
  targetGameId?: number,
  maxGames = 16,
): Promise<{
  success: boolean;
  message: string;
  unmatchedNames: string[];
  totalRowsUpserted: number;
  totalRowsVerified: number;
  totalRowsPruned: number;
  idempotentGames: number;
  error?: any;
}> {
  let totalRowsUpserted = 0;
  let totalRowsVerified = 0;
  let totalRowsPruned = 0;
  let idempotentGames = 0;
  let error: any = null;
  try {
    const gameIdSet = new Set<number>();
    const gameInfoMap = new Map<number, GameInfo>();
    const gamePbpMap = new Map<number, PbpResponse>();

    // Fetch all player positions once for the selected scope.
    const playerPositions = await fetchAllPlayerPositions();
    const unmatchedNames: string[] = [];

    if (targetGameId != null) {
      const pbp = await fetchPbpGame(targetGameId);
      if (pbp.id !== targetGameId || !isCompleteFinalPbpPayload(pbp)) {
        throw new Error(
          `PBP is not final and complete for target game ${targetGameId}`,
        );
      }
      const targetSeasonId = Number(pbp.season);
      if (!Number.isSafeInteger(targetSeasonId) || targetSeasonId <= 0) {
        throw new Error(
          `Invalid season identity for target game ${targetGameId}`,
        );
      }
      gameIdSet.add(targetGameId);
      gamePbpMap.set(targetGameId, pbp);
      gameInfoMap.set(targetGameId, {
        gameType: pbp.gameType,
        gameDate: pbp.gameDate,
        homeTeam: { id: pbp.homeTeam.id, abbrev: pbp.homeTeam.abbrev },
        awayTeam: { id: pbp.awayTeam.id, abbrev: pbp.awayTeam.abbrev },
        game_id: targetGameId,
        season_id: targetSeasonId,
      });
    } else {
      const seasonId = (await getCurrentSeason()).seasonId;
      const pendingGameIds = await listPendingRelationshipGameIds(
        seasonId,
        maxGames,
      );
      for (const gameId of pendingGameIds) {
        const pbp = await fetchPbpGame(gameId);
        if (pbp.id !== gameId || !isCompleteFinalPbpPayload(pbp)) {
          throw new Error(`PBP is not final and complete for game ${gameId}`);
        }
        const gameSeasonId = Number(pbp.season);
        if (gameSeasonId !== seasonId) {
          throw new Error(`Season identity mismatch for game ${gameId}`);
        }
        gameIdSet.add(gameId);
        gamePbpMap.set(gameId, pbp);
        gameInfoMap.set(gameId, {
          gameType: pbp.gameType,
          gameDate: pbp.gameDate,
          homeTeam: { id: pbp.homeTeam.id, abbrev: pbp.homeTeam.abbrev },
          awayTeam: { id: pbp.awayTeam.id, abbrev: pbp.awayTeam.abbrev },
          game_id: gameId,
          season_id: gameSeasonId,
        });
      }
    }

    // Proceed with processing the collected game IDs
    for (const gameId of gameIdSet) {
      try {
        const shiftChartData = await fetchShiftChartData(gameId);

        if (!shiftChartData || !shiftChartData.data) {
          throw new Error(`No shift chart data found for game ID: ${gameId}`);
        }

        const gameInfo = gameInfoMap.get(gameId);
        if (!gameInfo) {
          throw new Error(`No game info found for game ID: ${gameId}`);
        }
        const pbp = gamePbpMap.get(gameId);
        if (!pbp) {
          throw new Error(`No PBP source found for game ID: ${gameId}`);
        }

        const {
          unmatchedNames: unmatched,
          upsertCount,
          verifiedCount,
          prunedCount,
          idempotent,
        } = await upsertShiftChartData(
          shiftChartData,
          gameInfo,
          playerPositions,
          pbp,
        );
        unmatchedNames.push(...unmatched);
        totalRowsUpserted += upsertCount;
        totalRowsVerified += verifiedCount;
        totalRowsPruned += prunedCount;
        if (idempotent) idempotentGames += 1;

        // Optional: Delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error processing game ID ${gameId}:`, err);
        throw err;
      }
    }

    console.log("Unmatched Names:", Array.from(new Set(unmatchedNames)));

    return {
      success: !error,
      message: error
        ? error.message || "An error occurred."
        : "Successfully processed all shift charts.",
      unmatchedNames: Array.from(new Set(unmatchedNames)),
      totalRowsUpserted,
      totalRowsVerified,
      totalRowsPruned,
      idempotentGames,
      error,
    };
  } catch (err: any) {
    console.error("An error occurred in fetchAndStoreShiftCharts:", err);
    return {
      success: false,
      message: err.message || "An unexpected error occurred.",
      unmatchedNames: [],
      totalRowsUpserted,
      totalRowsVerified,
      totalRowsPruned,
      idempotentGames,
      error: err,
    };
  }
}

// API Handler

export default adminOnly(async (req: NextApiRequest, res: NextApiResponse) => {
  const jobName = "update-shift-charts";
  const startTime = Date.now();
  let status: "success" | "error" = "success";
  let rowsAffected = 0;
  let details: any = {};
  let responseBody: any = null;
  try {
    if (req.method !== "POST") {
      responseBody = {
        message: "Method not allowed. Use POST.",
        success: false,
      };
      return res.status(405).json(responseBody);
    }
    const rawTargetGameId = Array.isArray(req.query.gameId)
      ? req.query.gameId[0]
      : req.query.gameId;
    const targetGameId =
      rawTargetGameId === "all" ? null : parseQueryPositiveInt(rawTargetGameId);
    if (
      rawTargetGameId != null &&
      rawTargetGameId !== "all" &&
      targetGameId == null
    ) {
      responseBody = { message: "Invalid gameId.", success: false };
      return res.status(400).json(responseBody);
    }
    const rawMaxGames = req.query.maxGames;
    const parsedMaxGames = parseQueryPositiveInt(rawMaxGames);
    if (rawMaxGames != null && parsedMaxGames == null) {
      responseBody = { message: "Invalid maxGames.", success: false };
      return res.status(400).json(responseBody);
    }
    const maxGames = Math.min(parsedMaxGames ?? 16, 50);
    const result = await fetchAndStoreShiftCharts(
      targetGameId ?? undefined,
      maxGames,
    );
    rowsAffected = result.totalRowsUpserted;
    details = {
      unmatchedNames: result.unmatchedNames,
      durationMs: Date.now() - startTime,
      rowsVerified: result.totalRowsVerified,
      rowsPruned: result.totalRowsPruned,
      idempotentGames: result.idempotentGames,
    };
    if (result.success) {
      responseBody = {
        message: result.message,
        success: true,
        unmatchedNames: result.unmatchedNames,
        rowsAffected,
        rowsVerified: result.totalRowsVerified,
        rowsPruned: result.totalRowsPruned,
        idempotentGames: result.idempotentGames,
        targetGameId: targetGameId ?? null,
      };
      res.status(200).json(responseBody);
    } else {
      status = "error";
      details.error = result.error?.message || result.message;
      responseBody = {
        message: result.message,
        success: false,
        unmatchedNames: result.unmatchedNames,
        rowsAffected,
        rowsVerified: result.totalRowsVerified,
        rowsPruned: result.totalRowsPruned,
        idempotentGames: result.idempotentGames,
        targetGameId: targetGameId ?? null,
      };
      res.status(500).json(responseBody);
    }
  } catch (error: any) {
    status = "error";
    details = { ...details, error: error.message };
    responseBody = {
      message: error.message || "An unexpected error occurred.",
      success: false,
    };
    res.status(500).json(responseBody);
  } finally {
    if (res.statusCode >= 400) {
      status = "error";
      details = {
        ...details,
        error:
          details?.error ??
          responseBody?.error ??
          responseBody?.message ??
          `Request failed with HTTP ${res.statusCode}`,
      };
    }
    try {
      await supabase.from("cron_job_audit").insert([
        {
          job_name: jobName,
          status,
          rows_affected: rowsAffected,
          details: {
            method: req.method ?? null,
            url: req.url ?? null,
            statusCode: res.statusCode,
            durationMs: Date.now() - startTime,
            error:
              status === "error" ? (details?.error ?? "Unknown error") : null,
            response: responseBody,
            context: details,
          },
        },
      ]);
    } catch (auditErr) {
      console.error("Failed to write audit row:", auditErr);
    }
  }
});
