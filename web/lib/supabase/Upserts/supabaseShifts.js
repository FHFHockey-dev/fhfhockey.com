// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\lib\supabase\Upserts\supabaseShifts.js
// TODO : integrate home_or_away, opponent_team_id and opponent_team_abbreviation

const path = "../../../.env.local";
require("dotenv").config({ path: path });

const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || "";
// CHANGED SUPABASE THING
const supabase = createClient(supabaseUrl, supabaseKey);
console.log("supabaseUrl", supabaseUrl);
console.log("supabaseKey", supabaseKey);

// Simplified Fetch (cors-fetch) function for Node.js that isn't imported
async function Fetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const data = await response.json();
  console.log(`Fetched data from ${url}`);
  return data;
}

const teamsInfo = {
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
  UTA: { name: "Utah Hockey Club", franchiseId: 40, id: 59 }
};

// Helper Functions

/**
 * Determines if a game has finished based on its `gameState`.
 * @param {Object} game - Game object from the schedule.
 * @returns {boolean} - True if the game is finished, else false.
 */
function isGameFinished(game) {
  const finishedStates = ["FINAL", "OFF"]; // Add other finished states if necessary
  return finishedStates.includes(game.gameState);
}

function parseTime(timeStr) {
  const [minutes, seconds] = timeStr.split(":").map(Number);
  return minutes * 60 + seconds;
}

/**
 * Sums an array of duration strings in "MM:SS" format and returns the total duration as "MM:SS".
 * @param {Array} durations - Array of duration strings.
 * @returns {string} - Total duration as "MM:SS".
 */
function sumdurations(durations) {
  let totalSeconds = 0;

  durations.forEach((duration) => {
    // Renamed from 'durations' to 'duration'
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
 * @param {Array} intervals - Array of interval objects with 'start' and 'end' in seconds.
 * @returns {Array} - Array of merged interval objects.
 */
function mergeIntervals(intervals) {
  if (!intervals.length) return [];

  // Sort intervals by start time
  intervals.sort((a, b) => a.start - b.start);

  const merged = [intervals[0]];

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
 * @param {Array} intervals - Array of merged overlapping intervals.
 * @param {number} start - Start of the overall range in seconds.
 * @param {number} end - End of the overall range in seconds.
 * @returns {Array} - Array of non-overlapping intervals.
 */
function invertIntervals(intervals, start, end) {
  const inverted = [];
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
 * Formats durations from seconds to "MM:SS" format.
 * @param {number} seconds - Total seconds.
 * @returns {string} - Formatted durations string.
 */
function formatdurations(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}

/**
 * Formats seconds back to "MM:SS" string.
 * @param {number} seconds - Total seconds.
 * @returns {string} - "MM:SS"
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Determines the player type based on position.
 * @param {string} primaryPosition - Primary position code.
 * @param {string} displayPosition - Display position code.
 * @returns {string} - "G", "F", "D", or null.
 */
function getPlayerType(primaryPosition, displayPosition) {
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
 * @param {string} position - Position code (e.g., "LW", "RW", "C")
 * @returns {boolean} - True if forward, else false.
 */
function isForward(position) {
  return ["LW", "RW", "C"].includes(position);
}

/**
 * Determines if a position is defense
 * @param {string} position - Position code (e.g., "D")
 * @returns {boolean} - True if defense, else false.
 */
function isDefense(position) {
  return ["D"].includes(position);
}

/**
 * Group array items by a key.
 * @param {Array} array - Array of items.
 * @param {Function} keyGetter - Function to get the key from an item.
 * @returns {Map} - Map with keys and grouped items.
 */
function groupBy(array, keyGetter) {
  const map = new Map();
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
 * @param {Array} shifts - Array of shift objects for player 1.
 * @param {number} p1 - Player 1 ID.
 * @param {number} p2 - Player 2 ID.
 * @returns {number} - Total TOI in seconds.
 */
function getPairwiseTOI(shifts, p1, p2) {
  const p1Shifts = shifts.filter((shift) => shift.playerId === p1);
  const p2Shifts = shifts.filter((shift) => shift.playerId === p2);

  let totalOverlap = 0;

  p1Shifts.forEach((shift1) => {
    p2Shifts.forEach((shift2) => {
      if (shift1.periods !== shift2.periods) return;

      const shift1Start = parseTime(shift1.start_times);
      const shift1End = parseTime(shift1.end_times);
      const shift2Start = parseTime(shift2.start_times);
      const shift2End = parseTime(shift2.end_times);

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
 * @param {Object} consolidatedData - Consolidated player data.
 * @param {Object} pairwiseTOI - Pairwise TOI data.
 * @returns {Object} - Teams object with lines and pairs.
 */
function generateTeamLogs(consolidatedData, pairwiseTOI) {
  const teams = {};

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
      pairs: {}
    };

    players.forEach((player) => {
      const playerInfo = {
        name: `${player.player_first_name} ${player.player_last_name}`,
        id: player.player_id,
        toi: player.game_toi,
        shared_toi: player.percent_toi_with,
        line_combination: player.line_combination,
        pairing_combination: player.pairing_combination
      };

      if (isForward(player.primary_position)) {
        teams[teamAbbrev].forwards.push(playerInfo);
        console.log(`Player ${playerInfo.name} classified as Forward.`);
      } else if (isDefense(player.primary_position)) {
        teams[teamAbbrev].defensemen.push(playerInfo);
        console.log(`Player ${playerInfo.name} classified as Defenseman.`);
      }
    });

    // Sort players by TOI
    teams[teamAbbrev].forwards.sort(
      (a, b) => parseTime(b.toi) - parseTime(a.toi)
    );
    teams[teamAbbrev].defensemen.sort(
      (a, b) => parseTime(b.toi) - parseTime(a.toi)
    );

    const { forwards, defensemen } = teams[teamAbbrev];

    const usedForwards = new Set();
    const usedDefensemen = new Set();

    // Assign lines
    for (let line = 1; line <= 4; line++) {
      const pivotPlayer = forwards.find(
        (player) => !usedForwards.has(player.id)
      );
      if (!pivotPlayer) break;

      const linemates = forwards
        .filter(
          (player) =>
            !usedForwards.has(player.id) && player.id !== pivotPlayer.id
        )
        .sort(
          (a, b) =>
            parseTime(
              consolidatedData[pivotPlayer.id].time_spent_with[b.id] || "0:00"
            ) -
            parseTime(
              consolidatedData[pivotPlayer.id].time_spent_with[a.id] || "0:00"
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
          .map((p) => p.name)
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
          (player) =>
            !usedDefensemen.has(player.id) && player.id !== pivotPlayer.id
        )
        .sort(
          (a, b) =>
            parseTime(
              consolidatedData[pivotPlayer.id].time_spent_with[b.id] || "0:00"
            ) -
            parseTime(
              consolidatedData[pivotPlayer.id].time_spent_with[a.id] || "0:00"
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
          .map((p) => p.name)
          .join(", ")}`
      );
    }
  }

  return teams;
}

// Main Functions

/**
 * Fetches the current season ID based on the current date.
 * @returns {Promise<number>} - Current or previous season ID.
 */
async function fetchCurrentSeason() {
  const response = await Fetch(
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
  );
  const currentSeason = response.data[0];
  const previousSeason = response.data[1];
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
 * @param {string} teamAbbreviation - Team abbreviation (e.g., "NJD").
 * @param {number} seasonId - Season ID.
 * @returns {Promise<Object>} - Team schedule data.
 */
async function fetchTeamSchedule(teamAbbreviation, seasonId) {
  console.log(
    `Fetching schedule for ${teamAbbreviation} in season ${seasonId}`
  );
  const scheduleUrl = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/${seasonId}`;
  return Fetch(scheduleUrl);
}

/**
 * Fetches shift chart data for a given game ID.
 * @param {number} gameId - Game ID.
 * @returns {Promise<Object>} - Shift chart data.
 */
async function fetchShiftChartData(gameId) {
  const shiftChartUrl = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`;
  return Fetch(shiftChartUrl);
}

/**
 * Fetches all player positions from the Supabase `yahoo_positions` table.
 * @returns {Promise<Array>} - Array of player position objects.
 */
async function fetchAllPlayerPositions() {
  const pageSize = 1000;
  let offset = 0;
  let allPositions = [];
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
      allPositions = allPositions.concat(data);
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
 * @param {number} gameId - Game ID.
 * @returns {Promise<string>} - Total game length in "MM:SS" format.
 */
async function fetchGameLength(gameId) {
  try {
    const gameData = await Fetch(
      `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
    );

    // Verify required properties
    if (
      !gameData ||
      !gameData.periodDescriptor ||
      !gameData.clock ||
      !gameData.gameOutcome ||
      typeof gameData.periodDescriptor.number === "undefined" ||
      typeof gameData.gameOutcome.lastPeriodType === "undefined"
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
      if (!clock.timeRemaining) {
        throw new Error("Clock time remaining is missing");
      }
      const timeRemainingParts = clock.timeRemaining.split(":");
      const timeRemainingSeconds =
        parseInt(timeRemainingParts[0]) * 60 + parseInt(timeRemainingParts[1]);
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
 * @param {Object} shiftChartData - Shift chart data.
 * @param {Object} gameInfo - Information about the game.
 * @param {Array} playerPositions - Array of player position objects.
 * @returns {Promise<Array>} - Array of unmatched player names.
 */
async function upsertShiftChartData(shiftChartData, gameInfo, playerPositions) {
  const unmatchedNamesSet = new Set();
  const consolidatedData = {};

  const gameLength = await fetchGameLength(gameInfo.game_id);

  // **Fetch Power Play Timeframes for the Current Game**
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

  // **Use groupBy to group shifts by playerId**
  const shiftsByPlayer = groupBy(
    shiftChartData.data,
    (shift) => shift.playerId
  );

  // **Process each player's shifts**
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
      game_id: firstShift.gameId,
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
      pairing_combination: null
    };

    // **Process each shift for the player**
    shifts.forEach((shift) => {
      const duration = shift.duration || "00:00";

      // Update game_toi
      consolidatedData[playerKey].game_toi = sumdurations([
        consolidatedData[playerKey].game_toi,
        duration
      ]);

      // Add shift details
      consolidatedData[playerKey].shifts.push({
        shift_numbers: shift.shiftNumber,
        periods: shift.period,
        start_times: shift.startTime,
        end_times: shift.endTime,
        durations: shift.duration || "00:00",
        playerId: shift.playerId // Ensure playerId is present for pairwise TOI
      });

      // **Split shift into pp_shifts and es_shifts based on power plays**

      const shiftperiods = shift.period;
      const shiftStartSeconds = parseTime(shift.startTime);
      const shiftEndSeconds = parseTime(shift.endTime);
      const shiftdurationseconds = parseTime(shift.duration || "00:00"); // Total durations in seconds

      // Identify player's team ID
      const playerTeamId = consolidatedData[playerKey].team_id;

      // **Filter power plays where the player's team is on the power play**
      const overlappingPPs = powerPlays
        .filter(
          (pp) =>
            pp.powerPlayperiods === shiftperiods &&
            pp.teamOnPowerPlay === playerTeamId
        )
        .map((pp) => ({
          start: parseTime(pp.powerPlayStartTime),
          end: parseTime(pp.powerPlayEndTime)
        }));

      // Calculate overlapping intervals with shift
      const overlappingIntervals = overlappingPPs
        .map((pp) => ({
          start: Math.max(shiftStartSeconds, pp.start),
          end: Math.min(shiftEndSeconds, pp.end)
        }))
        .filter((interval) => interval.start < interval.end); // Keep valid overlaps

      // Merge overlapping intervals to get unique overlapping time
      const mergedOverlaps = mergeIntervals(overlappingIntervals);

      // Calculate total overlapping seconds
      const totalPPOverlapSeconds = mergedOverlaps.reduce(
        (sum, interval) => sum + (interval.end - interval.start),
        0
      );

      // Assign pp_shift(s)
      mergedOverlaps.forEach((interval) => {
        consolidatedData[playerKey].pp_shifts.push({
          periods: shift.period,
          durations: formatdurations(interval.end - interval.start),
          start_times: formatTime(interval.start),
          end_times: formatTime(interval.end),
          shift_numbers: shift.shiftNumber
        });

        // Optional: Log pp_shifts
      });

      // Calculate esOverlapSeconds
      const totalESOverlapSeconds =
        shiftdurationseconds - totalPPOverlapSeconds;

      // Assign es_shift(s) based on inverted intervals
      if (totalESOverlapSeconds > 0) {
        const esIntervals = invertIntervals(
          mergedOverlaps,
          shiftStartSeconds,
          shiftEndSeconds
        );

        esIntervals.forEach((interval) => {
          const esdurationseconds = interval.end - interval.start;
          if (esdurationseconds > 0) {
            consolidatedData[playerKey].es_shifts.push({
              periods: shift.period,
              durations: formatdurations(esdurationseconds),
              start_times: formatTime(interval.start),
              end_times: formatTime(interval.end),
              shift_numbers: shift.shiftNumber
            });

            // Optional: Log es_shifts
          }
        });
      }
    });

    // **Calculate total_pp_toi and total_es_toi for each player**
    consolidatedData[playerKey].total_pp_toi = sumdurations(
      consolidatedData[playerKey].pp_shifts.map((shift) => shift.durations)
    );
    consolidatedData[playerKey].total_es_toi = sumdurations(
      consolidatedData[playerKey].es_shifts.map((shift) => shift.durations)
    );
  }

  // **Calculate Time Spent With Other Players**
  for (const playerKey in consolidatedData) {
    const playerData = consolidatedData[playerKey];
    const shifts = playerData.shifts.map((shift) => ({
      startTime: shift.start_times,
      endTime: shift.end_times,
      durations: shift.durations,
      periods: shift.periods,
      playerId: playerData.player_id
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
        startTime: shift.start_times,
        endTime: shift.end_times,
        durations: shift.durations,
        periods: shift.periods
      }));

      let totalTimeSpent = 0;

      shifts.forEach((shift) => {
        otherShifts.forEach((otherShift) => {
          if (shift.periods === otherShift.periods) {
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

      const formattedTimeSpent = formatdurations(totalTimeSpent);
      const percentTOI =
        (totalTimeSpent /
          (parseInt(playerData.game_length.split(":")[0]) * 60 +
            parseInt(playerData.game_length.split(":")[1]))) *
        100;

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

  // **Calculate Pairwise TOI**
  const playerDataArray = Object.values(consolidatedData);
  const pairwiseTOI = {};
  playerDataArray.forEach((playerData) => {
    playerDataArray.forEach((otherPlayerData) => {
      const key = `${playerData.player_id}-${otherPlayerData.player_id}`;
      pairwiseTOI[key] = {
        toi: getPairwiseTOI(
          playerData.shifts,
          playerData.player_id,
          otherPlayerData.player_id
        )
      };
    });
  });

  // **Generate Team Logs (Lines and Pairs)**
  const teams = generateTeamLogs(consolidatedData, pairwiseTOI);

  for (const team in teams) {
    const { lines, pairs } = teams[team];

    for (const line in lines) {
      lines[line].forEach((player) => {
        if (consolidatedData[player.id]) {
          consolidatedData[player.id].line_combination = line;
        }
      });
    }

    for (const pair in pairs) {
      pairs[pair].forEach((player) => {
        if (consolidatedData[player.id]) {
          consolidatedData[player.id].pairing_combination = pair;
        }
      });
    }
  }

  // **Prepare Batch Data for Upsert**
  const batchData = Object.values(consolidatedData).map((data) => {
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
      shifts: data.shifts, // JSONB
      pp_shifts: data.pp_shifts, // JSONB
      es_shifts: data.es_shifts, // JSONB
      shift_numbers: data.shifts.map((shift) => shift.shift_numbers),
      periods: data.shifts.map((shift) => shift.periods),
      start_times: data.shifts.map((shift) => shift.start_times),
      end_times: data.shifts.map((shift) => shift.end_times),
      durations: data.shifts.map((shift) => shift.durations),
      total_pp_toi: data.total_pp_toi, // Include `total_pp_toi`
      total_es_toi: data.total_es_toi, // Include `total_es_toi`
      time_spent_with: data.time_spent_with, // Include `time_spent_with`
      percent_toi_with: data.percent_toi_with, // Include `percent_toi_with`
      time_spent_with_mixed: data.time_spent_with_mixed, // Include `time_spent_with_mixed`
      percent_toi_with_mixed: data.percent_toi_with_mixed, // Include `percent_toi_with_mixed`
      line_combination: data.line_combination, // Include `line_combination`
      pairing_combination: data.pairing_combination // Include `pairing_combination`
    };
  });

  if (batchData.length > 0) {
    const { data: upsertedData, error } = await supabase
      .from("shift_charts")
      .upsert(batchData, {
        onConflict: ["game_id", "player_id"]
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
async function fetchAndStoreShiftCharts() {
  try {
    const seasonId = await fetchCurrentSeason();
    console.log(`Current season ID: ${seasonId}`);
    const gameIdSet = new Set();
    const gameInfoMap = new Map();

    const playerPositions = await fetchAllPlayerPositions();
    const unmatchedNames = [];

    for (const teamAbbreviation of Object.keys(teamsInfo)) {
      const teamSchedule = await fetchTeamSchedule(teamAbbreviation, seasonId);

      if (!teamSchedule || !teamSchedule.games) {
        console.error(`No schedule data found for team: ${teamAbbreviation}`);
        continue;
      }

      for (const game of teamSchedule.games) {
        // **Integrate isGameFinished Check Here**
        if (isGameFinished(game)) {
          gameIdSet.add(game.id);
          gameInfoMap.set(game.id, {
            gameType: game.gameType,
            gameDate: game.gameDate,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            game_id: game.id,
            season_id: seasonId // Include season_id
          });
        } else {
          // console.log(
          //   `Skipping game ID: ${game.id} as it is not finished (gameState: ${game.gameState})`
          // );
        }
      }
    }

    for (const gameId of gameIdSet) {
      const shiftChartData = await fetchShiftChartData(gameId);

      if (!shiftChartData || !shiftChartData.data) {
        console.error(`No shift chart data found for game ID: ${gameId}`);
        continue;
      }

      const gameInfo = gameInfoMap.get(gameId);
      //      console.log(`Processing game ID: ${gameId}`);
      const unmatched = await upsertShiftChartData(
        shiftChartData,
        gameInfo,
        playerPositions
      );
      unmatchedNames.push(...unmatched);

      // **Optional:** Delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("Unmatched Names:", Array.from(new Set(unmatchedNames)));

    // **Fetch and Compare Names**
    const { data: shiftChartNames, error: shiftChartError } = await supabase
      .from("shift_charts")
      .select("player_first_name, player_last_name");

    if (shiftChartError) {
      console.error("Error fetching shift chart names:", shiftChartError);
    } else {
      const uniqueShiftChartNames = new Set(
        shiftChartNames.map(
          (name) => `${name.player_first_name} ${name.player_last_name}`
        )
      );

      const { data: yahooNames, error: yahooError } = await supabase
        .from("yahoo_positions")
        .select("full_name");

      console.log("Unique Shift Chart Names:", uniqueShiftChartNames.size);
      console.log("Unique Yahoo Names:", yahooNames.length);

      if (yahooError) {
        console.error("Error fetching yahoo names:", yahooError);
      } else {
        const uniqueYahooNames = new Set(
          yahooNames.map((name) => name.full_name)
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
  } catch (error) {
    console.error("An error occurred in fetchAndStoreShiftCharts:", error);
  }
}

fetchAndStoreShiftCharts();
