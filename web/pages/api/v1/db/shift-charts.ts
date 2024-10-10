// File: C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\shiftCharts.ts

import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import adminOnly from "utils/adminOnlyMiddleware";

// Define Interfaces

interface TeamInfo {
  name: string;
  franchiseId: number;
  id: number;
}

interface GameInfo {
  gameType: string;
  gameDate: string;
  homeTeam: TeamDetail;
  awayTeam: TeamDetail;
  game_id: number;
  season_id: number;
}

interface TeamDetail {
  id: number;
  abbrev: string;
  // Add other relevant fields if necessary
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
  data: Shift[];
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
  line_combination: string | null;
  pairing_combination: string | null;
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

interface BatchData extends ConsolidatedPlayerData {}

// PlayerInfo Interface for Team Logs
interface PlayerInfo {
  name: string;
  id: number;
  toi: string;
  shared_toi: Record<string, string>;
  line_combination: string | null;
  pairing_combination: string | null;
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
 * Merges overlapping intervals.
 * @param intervals - Array of interval objects with 'start' and 'end' in seconds.
 * @returns Array of merged interval objects.
 */
function mergeIntervals(
  intervals: { start: number; end: number }[]
): { start: number; end: number }[] {
  if (!intervals.length) return [];

  // Sort intervals by start time
  intervals.sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const current = intervals[i];

    if (current.start <= last.end) {
      // Overlapping intervals, merge them
      last.end = Math.max(last.end, current.end);
    } else {
      // Non-overlapping interval, add to merged
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Inverts intervals within a given range.
 * @param intervals - Array of merged overlapping intervals.
 * @param start - Start of the overall range in seconds.
 * @param end - End of the overall range in seconds.
 * @returns Array of non-overlapping intervals.
 */
function invertIntervals(
  intervals: { start: number; end: number }[],
  start: number,
  end: number
): { start: number; end: number }[] {
  const inverted: { start: number; end: number }[] = [];
  let current = start;

  for (const interval of intervals) {
    if (current < interval.start) {
      inverted.push({ start: current, end: interval.start });
    }
    current = Math.max(current, interval.end);
  }

  if (current < end) {
    inverted.push({ start: current, end: end });
  }

  return inverted;
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
 * Formats seconds back to "MM:SS" string.
 * @param seconds - Total seconds.
 * @returns "MM:SS"
 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Determines the player type based on position.
 * @param primaryPosition - Primary position code.
 * @param displayPosition - Display position code.
 * @returns "G", "F", "D", or null.
 */
function getPlayerType(
  primaryPosition: string | null,
  displayPosition: string | null
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
  pairwiseTOI: Record<string, { toi: number }>
): Record<string, TeamLogs> {
  const teams: Record<string, TeamLogs> = {};

  // Group players by team abbreviation
  const playersByTeam = groupBy(
    Object.values(consolidatedData),
    (player) => player.team_abbreviation
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
      (a: PlayerInfo, b: PlayerInfo) => parseTime(b.toi) - parseTime(a.toi)
    );
    teams[teamAbbrev].defensemen.sort(
      (a: PlayerInfo, b: PlayerInfo) => parseTime(b.toi) - parseTime(a.toi)
    );

    const { forwards, defensemen } = teams[teamAbbrev];

    const usedForwards = new Set<number>();
    const usedDefensemen = new Set<number>();

    // Assign lines
    for (let line = 1; line <= 4; line++) {
      const pivotPlayer = forwards.find(
        (player) => !usedForwards.has(player.id)
      );
      if (!pivotPlayer) break;

      const linemates = forwards
        .filter(
          (player: PlayerInfo) =>
            !usedForwards.has(player.id) && player.id !== pivotPlayer.id
        )
        .sort(
          (a: PlayerInfo, b: PlayerInfo) =>
            parseTime(
              consolidatedData[`${a.id}`].time_spent_with[`${b.id}`] || "0:00"
            ) -
            parseTime(
              consolidatedData[`${a.id}`].time_spent_with[`${b.id}`] || "0:00"
            )
        )
        .slice(0, 2);

      if (linemates.length < 2) {
        console.warn(
          `Not enough linemates for Line ${line} in Team ${teamAbbrev}.`
        );
      }

      const linePlayers = [pivotPlayer, ...linemates];
      linePlayers.forEach((player) => usedForwards.add(player.id));
      teams[teamAbbrev].lines[line] = linePlayers;

      console.log(
        `Assigned Line ${line} for Team ${teamAbbrev}: ${linePlayers
          .map((p: PlayerInfo) => p.name)
          .join(", ")}`
      );
    }

    // Assign pairs
    for (let pair = 1; pair <= 3; pair++) {
      const pivotPlayer = defensemen.find(
        (player) => !usedDefensemen.has(player.id)
      );
      if (!pivotPlayer) break;

      const pairPlayer = defensemen
        .filter(
          (player: PlayerInfo) =>
            !usedDefensemen.has(player.id) && player.id !== pivotPlayer.id
        )
        .sort(
          (a: PlayerInfo, b: PlayerInfo) =>
            parseTime(
              consolidatedData[`${pivotPlayer.id}`].time_spent_with[
                `${b.id}`
              ] || "0:00"
            ) -
            parseTime(
              consolidatedData[`${pivotPlayer.id}`].time_spent_with[
                `${a.id}`
              ] || "0:00"
            )
        )
        .slice(0, 1);

      if (pairPlayer.length < 1) {
        console.warn(
          `Not enough pair players for Pair ${pair} in Team ${teamAbbrev}.`
        );
      }

      const pairPlayers = [pivotPlayer, ...pairPlayer];
      pairPlayers.forEach((player) => usedDefensemen.add(player.id));
      teams[teamAbbrev].pairs[pair] = pairPlayers;

      console.log(
        `Assigned Pair ${pair} for Team ${teamAbbrev}: ${pairPlayers
          .map((p: PlayerInfo) => p.name)
          .join(", ")}`
      );
    }
  }

  return teams;
}

// Main Functions

/**
 * Fetches the current season ID based on the current date.
 * @returns Current or previous season ID.
 */
async function fetchCurrentSeason(): Promise<number> {
  const response = await fetch(
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
  );
  const data = await response.json();
  const currentSeason = data.data[0];
  const previousSeason = data.data[1];
  const now = new Date();
  const startDate = new Date(currentSeason.startDate);
  const endDate = new Date(currentSeason.regularSeasonEndDate);
  console.log(`Current season ID: ${currentSeason.id}`);
  console.log(`Previous season ID: ${previousSeason.id}`);

  if (now < startDate || now > endDate) {
    return previousSeason.id;
  } else {
    return currentSeason.id;
  }
}

/**
 * Fetches the team schedule for a given team and season.
 * @param teamAbbreviation - Team abbreviation (e.g., "NJD").
 * @param seasonId - Season ID.
 * @returns Team schedule data.
 */
async function fetchTeamSchedule(
  teamAbbreviation: string,
  seasonId: number
): Promise<any> {
  console.log(
    `Fetching schedule for ${teamAbbreviation} in season ${seasonId}`
  );
  const scheduleUrl = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/${seasonId}`;
  const response = await fetch(scheduleUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch schedule for ${teamAbbreviation}: ${response.statusText}`
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
  const shiftChartUrl = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`;
  const response = await fetch(shiftChartUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch shift chart data for game ID ${gameId}: ${response.statusText}`
    );
  }
  const data = await response.json();
  return data;
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
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("Error fetching player positions:", error);
      fetchMore = false;
    } else {
      allPositions = allPositions.concat(data as PlayerPosition[]);
      offset += pageSize;
      fetchMore = data.length === pageSize;
    }
  }
  console.log(
    `Fetched ${allPositions.length} player positions from yahoo_positions`
  );
  return allPositions;
}

/**
 * Fetches the total game length based on game data.
 * @param gameId - Game ID.
 * @returns Total game length in "MM:SS" format.
 */
async function fetchGameLength(gameId: number): Promise<string> {
  try {
    const gameDataResponse = await fetch(
      `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
    );
    if (!gameDataResponse.ok) {
      throw new Error(
        `Failed to fetch game length: ${gameDataResponse.statusText}`
      );
    }
    const gameData = await gameDataResponse.json();
    if (
      !gameData ||
      !gameData.periodDescriptor ||
      !gameData.clock ||
      !gameData.gameOutcome
    ) {
      throw new Error("Invalid game data structure");
    }

    const { periodDescriptor, clock, gameOutcome } = gameData;
    let totalGameTime = 0;

    if (periodDescriptor.number === 5 && gameOutcome.lastPeriodType === "SO") {
      totalGameTime = 3 * 20 * 60 + 5 * 60; // 3 regulation periods + overtime
    } else if (
      periodDescriptor.number > 3 &&
      gameOutcome.lastPeriodType === "OT"
    ) {
      const timeRemainingParts = clock.timeRemaining.split(":").map(Number);
      const timeRemainingSeconds =
        timeRemainingParts[0] * 60 + timeRemainingParts[1];
      const overtimeSeconds = 5 * 60 - timeRemainingSeconds;
      totalGameTime = 3 * 20 * 60 + overtimeSeconds; // 3 regulation periods + overtime
    } else if (
      periodDescriptor.number === 3 &&
      gameOutcome.lastPeriodType === "REG"
    ) {
      totalGameTime = 3 * 20 * 60; // 3 regulation periods
    } else {
      throw new Error("Unexpected game outcome or period descriptor");
    }

    return `${Math.floor(totalGameTime / 60)}:${
      totalGameTime % 60 < 10 ? "0" : ""
    }${totalGameTime % 60}`;
  } catch (error) {
    console.error(`Error fetching game length for game ID ${gameId}:`, error);
    return "60:00"; // Default to 60 minutes if there's an error
  }
}

/**
 * Upserts shift chart data into the Supabase `shift_charts` table.
 * @param shiftChartData - Shift chart data.
 * @param gameInfo - Information about the game.
 * @param playerPositions - Array of player position objects.
 * @returns Array of unmatched player names.
 */
async function upsertShiftChartData(
  shiftChartData: ShiftChartData,
  gameInfo: GameInfo,
  playerPositions: PlayerPosition[]
): Promise<string[]> {
  const unmatchedNamesSet = new Set<string>();
  const consolidatedData: Record<string, ConsolidatedPlayerData> = {};

  const gameLength = await fetchGameLength(gameInfo.game_id);

  // Fetch Power Play Timeframes for the Current Game
  const { data: ppData, error: ppError } = await supabase
    .from("pp_timeframes")
    .select("pp_timeframes")
    .eq("game_id", gameInfo.game_id);

  if (ppError) {
    console.error(
      `Error fetching power play timeframes for game ID ${gameInfo.game_id}:`,
      ppError
    );
    // Proceed without power play data
  }

  const powerPlays = ppData && ppData.length > 0 ? ppData[0].pp_timeframes : [];

  // Use groupBy to group shifts by playerId
  const shiftsByPlayer = groupBy(
    shiftChartData.data,
    (shift) => shift.playerId
  );

  // Process each player's shifts
  for (const [playerId, shifts] of shiftsByPlayer.entries()) {
    const playerKey = `${playerId}`;
    const firstShift = shifts[0]; // Assuming all shifts have consistent player info

    const playerName = `${firstShift.firstName} ${firstShift.lastName}`;
    const matchedPosition = playerPositions.find(
      (pos) => pos.full_name === playerName
    );
    if (!matchedPosition) {
      unmatchedNamesSet.add(playerName);
    }

    // Initialize player data in consolidatedData
    consolidatedData[playerKey] = {
      game_id: gameInfo.game_id,
      game_type: gameInfo.gameType,
      game_date: gameInfo.gameDate,
      season_id: gameInfo.season_id,
      player_id: playerId,
      player_first_name: firstShift.firstName,
      player_last_name: firstShift.lastName,
      team_id: firstShift.teamId,
      team_abbreviation: firstShift.teamAbbrev,
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
            matchedPosition.display_position
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

      // Split shift into pp_shifts and es_shifts based on power plays

      const shiftPeriod = shift.period;
      const shiftStartSeconds = parseTime(shift.startTime);
      const shiftEndSeconds = parseTime(shift.endTime);
      const shiftDurationSeconds = parseTime(shift.duration || "00:00"); // Total duration in seconds

      // Identify player's team ID
      const playerTeamId = consolidatedData[playerKey].team_id;

      // Filter power plays where the player's team is on the power play
      const overlappingPPs = powerPlays
        .filter(
          (pp: any) =>
            pp.powerPlayPeriod === shiftPeriod &&
            pp.teamOnPowerPlay === playerTeamId
        )
        .map((pp: any) => ({
          start: parseTime(pp.powerPlayStartTime),
          end: parseTime(pp.powerPlayEndTime),
        }));

      // Calculate overlapping intervals with shift
      const overlappingIntervals = overlappingPPs
        .map((pp: any) => ({
          start: Math.max(shiftStartSeconds, pp.start),
          end: Math.min(shiftEndSeconds, pp.end),
        }))
        .filter(
          (interval: { start: number; end: number }) =>
            interval.start < interval.end
        ); // Keep valid overlaps

      // Merge overlapping intervals to get unique overlapping time
      const mergedOverlaps = mergeIntervals(overlappingIntervals);

      // Assign pp_shift(s)
      mergedOverlaps.forEach((interval) => {
        consolidatedData[playerKey].pp_shifts.push({
          period: shift.period,
          duration: formatDuration(interval.end - interval.start),
          start_time: formatTime(interval.start),
          end_time: formatTime(interval.end),
          shift_number: shift.shiftNumber,
        });
      });

      // Calculate esOverlapSeconds
      const totalPPOverlapSeconds = mergedOverlaps.reduce(
        (sum, interval) => sum + (interval.end - interval.start),
        0
      );
      const totalESOverlapSeconds =
        shiftDurationSeconds - totalPPOverlapSeconds;

      // Assign es_shift(s) based on inverted intervals
      if (totalESOverlapSeconds > 0) {
        const esIntervals = invertIntervals(
          mergedOverlaps,
          shiftStartSeconds,
          shiftEndSeconds
        );

        esIntervals.forEach((interval) => {
          const esDurationSeconds = interval.end - interval.start;
          if (esDurationSeconds > 0) {
            consolidatedData[playerKey].es_shifts.push({
              period: shift.period,
              duration: formatDuration(esDurationSeconds),
              start_time: formatTime(interval.start),
              end_time: formatTime(interval.end),
              shift_number: shift.shiftNumber,
            });
          }
        });
      }
    });

    // Calculate total_pp_toi and total_es_toi for each player
    consolidatedData[playerKey].total_pp_toi = sumDurations(
      consolidatedData[playerKey].pp_shifts.map((shift) => shift.duration)
    );
    consolidatedData[playerKey].total_es_toi = sumDurations(
      consolidatedData[playerKey].es_shifts.map((shift) => shift.duration)
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
              otherShiftStartSeconds
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
          otherPlayerData.player_id
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
          consolidatedData[`${player.id}`].line_combination = line.toString();
        }
      });
    }

    for (const pair in pairs) {
      pairs[pair].forEach((player: PlayerInfo) => {
        if (consolidatedData[`${player.id}`]) {
          consolidatedData[`${player.id}`].pairing_combination =
            pair.toString();
        }
      });
    }
  }

  // Prepare Batch Data for Upsert
  const batchData: BatchData[] = Object.values(consolidatedData).map((data) => {
    const {
      shifts,
      pp_shifts,
      es_shifts,
      time_spent_with,
      percent_toi_with,
      time_spent_with_mixed,
      percent_toi_with_mixed,
      ...dataWithoutShifts
    } = data;
    return {
      ...dataWithoutShifts,
      game_toi: data.game_toi, // Already summed during processing
      shifts: data.shifts, // Include the `shifts` JSONB column
      pp_shifts: data.pp_shifts, // Include the `pp_shifts` JSONB column
      es_shifts: data.es_shifts, // Include the `es_shifts` JSONB column
      total_pp_toi: data.total_pp_toi, // Include `total_pp_toi`
      total_es_toi: data.total_es_toi, // Include `total_es_toi`
      time_spent_with: data.time_spent_with, // Include `time_spent_with`
      percent_toi_with: data.percent_toi_with, // Include `percent_toi_with`
      time_spent_with_mixed: data.time_spent_with_mixed, // Include `time_spent_with_mixed`
      percent_toi_with_mixed: data.percent_toi_with_mixed, // Include `percent_toi_with_mixed`
      line_combination: data.line_combination, // Include `line_combination`
      pairing_combination: data.pairing_combination, // Include `pairing_combination`
    };
  });

  if (batchData.length > 0) {
    const { data: upsertedData, error } = await supabase
      .from("shift_charts")
      .upsert(batchData, {
        onConflict: "game_id,player_id",
      });

    if (error) {
      console.error("Error upserting shift chart data:", error);
    } else {
      console.log("Successfully upserted shift chart records.");
    }
  }

  return Array.from(unmatchedNamesSet);
}

/**
 * Main function to fetch and store shift charts.
 */
async function fetchAndStoreShiftCharts(): Promise<{
  success: boolean;
  message: string;
  unmatchedNames: string[];
}> {
  try {
    const seasonId = await fetchCurrentSeason();
    console.log(`Current season ID: ${seasonId}`);
    const gameIdSet = new Set<number>();
    const gameInfoMap = new Map<number, GameInfo>();

    const playerPositions = await fetchAllPlayerPositions();
    const unmatchedNames: string[] = [];

    for (const teamAbbreviation of Object.keys(teamsInfo)) {
      const teamSchedule = await fetchTeamSchedule(teamAbbreviation, seasonId);

      if (!teamSchedule || !teamSchedule.games) {
        console.error(`No schedule data found for team: ${teamAbbreviation}`);
        continue;
      }

      for (const game of teamSchedule.games) {
        // Integrate isGameFinished Check Here
        if (isGameFinished(game)) {
          gameIdSet.add(game.id);
          gameInfoMap.set(game.id, {
            gameType: game.gameType,
            gameDate: game.gameDate,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            game_id: game.id,
            season_id: seasonId,
          });
        } else {
          console.log(
            `Skipping game ID: ${game.id} as it is not finished (gameState: ${game.gameState})`
          );
        }
      }
    }

    for (const gameId of gameIdSet) {
      try {
        const shiftChartData = await fetchShiftChartData(gameId);

        if (!shiftChartData || !shiftChartData.data) {
          console.error(`No shift chart data found for game ID: ${gameId}`);
          continue;
        }

        const gameInfo = gameInfoMap.get(gameId);
        if (!gameInfo) {
          console.error(`No game info found for game ID: ${gameId}`);
          continue;
        }

        const unmatched = await upsertShiftChartData(
          shiftChartData,
          gameInfo,
          playerPositions
        );
        unmatchedNames.push(...unmatched);

        // Optional: Delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing game ID ${gameId}:`, error);
      }
    }

    console.log("Unmatched Names:", Array.from(new Set(unmatchedNames)));

    // Fetch and Compare Names
    const { data: shiftChartNames, error: shiftChartError } = await supabase
      .from("shift_charts")
      .select("player_first_name, player_last_name");

    if (shiftChartError) {
      console.error("Error fetching shift chart names:", shiftChartError);
    } else {
      const uniqueShiftChartNames = new Set(
        (shiftChartNames as any[]).map(
          (name) => `${name.player_first_name} ${name.player_last_name}`
        )
      );

      const { data: yahooNames, error: yahooError } = await supabase
        .from("yahoo_positions")
        .select("full_name");

      console.log("Unique Shift Chart Names:", uniqueShiftChartNames.size);
      console.log("Unique Yahoo Names:", yahooNames?.length || 0);

      if (yahooError) {
        console.error("Error fetching yahoo names:", yahooError);
      } else {
        const uniqueYahooNames = new Set(
          (yahooNames as any[]).map((name) => name.full_name)
        );

        const unmatchedShiftChartNames = [...uniqueShiftChartNames].filter(
          (name) => !uniqueYahooNames.has(name)
        );
        const unmatchedYahooNames = [...uniqueYahooNames].filter(
          (name) => !uniqueShiftChartNames.has(name)
        );

        console.log(
          "Unmatched Shift Chart Names:",
          unmatchedShiftChartNames.length > 0
            ? unmatchedShiftChartNames
            : "None"
        );
        console.log(
          "Unmatched Yahoo Names:",
          unmatchedYahooNames.length > 0 ? unmatchedYahooNames : "None"
        );
      }
    }

    return {
      success: true,
      message: "Successfully processed all shift charts.",
      unmatchedNames: Array.from(new Set(unmatchedNames)),
    };
  } catch (error: any) {
    console.error("An error occurred in fetchAndStoreShiftCharts:", error);
    return {
      success: false,
      message: error.message || "An unexpected error occurred.",
      unmatchedNames: [],
    };
  }
}

// API Handler

export default adminOnly(async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // You can add request method checks here if needed
    if (req.method !== "POST") {
      return res.status(405).json({
        message: "Method not allowed. Use POST.",
        success: false,
      });
    }

    const result = await fetchAndStoreShiftCharts();

    if (result.success) {
      res.status(200).json({
        message: result.message,
        success: true,
        unmatchedNames: result.unmatchedNames,
      });
    } else {
      res.status(500).json({
        message: result.message,
        success: false,
        unmatchedNames: result.unmatchedNames,
      });
    }
  } catch (error: any) {
    console.error("API Handler Error:", error);
    res.status(500).json({
      message: error.message || "An unexpected error occurred.",
      success: false,
    });
  }
});
