const path = "./../../.env.local";
require("dotenv").config({ path: path });

const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

// Simplified Fetch (cors-fetch) function for Node.js that isn't imported
async function Fetch(url) {
  const response = await fetch(url);
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
  UTA: { name: "Utah Hockey Club", franchiseId: 40, id: 59 },
};

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchCurrentSeason() {
  const response = await Fetch(
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
  );
  const currentSeason = response.data[0];
  const previousSeason = response.data[1];
  const now = new Date();
  const startDate = new Date(currentSeason.startDate);
  const endDate = new Date(currentSeason.regularSeasonEndDate);

  if (now < startDate || now > endDate) {
    return previousSeason.id;
  } else {
    return currentSeason.id;
  }
}

async function fetchTeamSchedule(teamAbbreviation, seasonId) {
  const scheduleUrl = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/${seasonId}`;
  return Fetch(scheduleUrl);
}

async function fetchShiftChartData(gameId) {
  const shiftChartUrl = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`;
  return Fetch(shiftChartUrl);
}

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

function sumDurations(durations) {
  let totalSeconds = 0;

  durations.forEach((duration) => {
    const [minutes, seconds] = duration.split(":").map(Number);
    totalSeconds += minutes * 60 + seconds;
  });

  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${totalMinutes}:${
    remainingSeconds < 10 ? "0" : ""
  }${remainingSeconds}`;
}

async function fetchGameLength(gameId) {
  try {
    const gameData = await Fetch(
      `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
    );
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

async function upsertShiftChartData(shiftChartData, gameInfo, playerPositions) {
  const unmatchedNamesSet = new Set();
  const consolidatedData = {};

  const gameLength = await fetchGameLength(gameInfo.game_id);

  for (const shift of shiftChartData.data) {
    const playerKey = `${shift.playerId}`;
    const homeOrAway =
      shift.teamAbbrev === gameInfo.homeTeam.abbrev ? "home" : "away";
    const opponentInfo =
      shift.teamAbbrev === gameInfo.homeTeam.abbrev
        ? gameInfo.awayTeam
        : gameInfo.homeTeam;
    const duration = shift.duration || "00:00";

    const playerName = `${shift.firstName} ${shift.lastName}`;
    const matchedPosition = playerPositions.find(
      (pos) => pos.full_name === playerName
    );

    if (!matchedPosition) {
      unmatchedNamesSet.add(playerName);
    }

    if (!consolidatedData[playerKey]) {
      consolidatedData[playerKey] = {
        game_id: shift.gameId,
        game_type: gameInfo.gameType,
        game_date: gameInfo.gameDate,
        season_id: gameInfo.season_id,
        player_id: shift.playerId,
        player_first_name: shift.firstName,
        player_last_name: shift.lastName,
        team_id: shift.teamId,
        team_abbreviation: shift.teamAbbrev,
        shift_numbers: [],
        periods: [],
        start_times: [],
        end_times: [],
        durations: [],
        home_or_away: homeOrAway,
        opponent_team_abbreviation: opponentInfo.abbrev,
        opponent_team_id: opponentInfo.id,
        display_position: matchedPosition
          ? matchedPosition.display_position
          : null,
        primary_position: matchedPosition
          ? matchedPosition.primary_position
          : null,
        time_spent_with: {},
        percent_toi_with: {},
        time_spent_with_mixed: {}, // New field
        percent_toi_with_mixed: {}, // New field
        game_length: gameLength,
        shifts: [],
        game_toi: duration,
        player_type: matchedPosition
          ? getPlayerType(
              matchedPosition.primary_position,
              matchedPosition.display_position
            )
          : null,
      };
    } else {
      consolidatedData[playerKey].game_toi = sumDurations([
        consolidatedData[playerKey].game_toi,
        duration,
      ]);
    }

    consolidatedData[playerKey].shift_numbers.push(shift.shiftNumber);
    consolidatedData[playerKey].periods.push(shift.period);
    consolidatedData[playerKey].start_times.push(shift.startTime);
    consolidatedData[playerKey].end_times.push(shift.endTime);
    consolidatedData[playerKey].durations.push(duration);

    consolidatedData[playerKey].shifts.push({
      startTime: shift.startTime,
      endTime: shift.endTime,
      duration: shift.duration,
      period: shift.period,
      playerId: shift.playerId,
    });
  }

  for (const playerKey in consolidatedData) {
    const playerData = consolidatedData[playerKey];
    const shifts = playerData.start_times.map((startTime, index) => ({
      startTime,
      endTime: playerData.end_times[index],
      duration: playerData.durations[index],
      period: playerData.periods[index],
    }));

    for (const otherPlayerKey in consolidatedData) {
      if (playerKey !== otherPlayerKey) {
        const otherPlayer = consolidatedData[otherPlayerKey];
        const isSameTeam = playerData.team_id === otherPlayer.team_id;
        const isSamePositionType =
          isForward(playerData.primary_position) ===
          isForward(otherPlayer.primary_position);

        let totalTimeSpent = 0;
        const otherShifts = otherPlayer.start_times.map((startTime, index) => ({
          startTime,
          endTime: otherPlayer.end_times[index],
          duration: otherPlayer.durations[index],
          period: otherPlayer.periods[index],
        }));

        shifts.forEach((shift) => {
          otherShifts.forEach((otherShift) => {
            if (shift.period === otherShift.period) {
              const overlapStart = Math.max(
                parseTime(shift.startTime),
                parseTime(otherShift.startTime)
              );
              const overlapEnd = Math.min(
                parseTime(shift.endTime),
                parseTime(otherShift.endTime)
              );
              if (overlapStart < overlapEnd) {
                totalTimeSpent += overlapEnd - overlapStart;
              }
            }
          });
        });

        const totalMinutes = Math.floor(totalTimeSpent / 60);
        const remainingSeconds = totalTimeSpent % 60;
        const formattedTimeSpent = `${totalMinutes}:${
          remainingSeconds < 10 ? "0" : ""
        }${remainingSeconds}`;
        const percentTOI =
          totalTimeSpent /
          (parseInt(gameLength.split(":")[0]) * 60 +
            parseInt(gameLength.split(":")[1]));

        if (isSameTeam) {
          if (isSamePositionType) {
            playerData.time_spent_with[otherPlayerKey] = formattedTimeSpent;
            playerData.percent_toi_with[otherPlayerKey] = percentTOI.toFixed(2);
          } else {
            playerData.time_spent_with_mixed[otherPlayerKey] =
              formattedTimeSpent;
            playerData.percent_toi_with_mixed[otherPlayerKey] =
              percentTOI.toFixed(2);
          }
        }
      }
    }
  }

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
        ),
      };
    });
  });

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

  const batchData = Object.values(consolidatedData).map((data) => {
    const { shifts, ...dataWithoutShifts } = data;
    return {
      ...dataWithoutShifts,
      game_toi: sumDurations(data.durations),
    };
  });

  if (batchData.length > 0) {
    const { data, error } = await supabase
      .from("shift_charts")
      .upsert(batchData, {
        onConflict: ["game_id", "player_id"],
      });

    if (error) {
      console.error("Error upserting shift chart data:", error);
    } else {
      console.log("Successfully upserted shift chart records.");
    }
  }

  return Array.from(unmatchedNamesSet);
}

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

function parseTime(timeStr) {
  const [minutes, seconds] = timeStr.split(":").map(Number);
  return minutes * 60 + seconds;
}

function convertToTimeArray(data, size = 1200) {
  const timeArray = new Array(size).fill(false);

  data.forEach((item) => {
    const start = parseTime(item.startTime);
    const duration = parseTime(item.duration || "00:00");
    for (let i = 0; i < duration; i++) {
      timeArray[start + i] = true;
    }
  });

  return timeArray;
}

function getPairwiseTOI(shifts, p1, p2) {
  const p1Data = shifts.filter((item) => item.playerId === p1);
  const p2Data = shifts.filter((item) => item.playerId === p2);

  const p1Groups = groupBy(p1Data, ({ period }) => period.toString());
  const p2Groups = groupBy(p2Data, ({ period }) => period.toString());

  const getTogetherDuration = (a, b) => {
    const p1TimeArray = convertToTimeArray(a);
    const p2TimeArray = convertToTimeArray(b);
    let togetherDuration = 0;
    for (let i = 0; i < p1TimeArray.length; i++) {
      if (p1TimeArray[i] && p1TimeArray[i] === p2TimeArray[i]) {
        togetherDuration++;
      }
    }
    return togetherDuration;
  };

  let totalDuration = 0;
  const periods = Object.keys(p1Groups);

  periods.forEach((period) => {
    totalDuration += getTogetherDuration(
      p1Groups[period] || [],
      p2Groups[period] || []
    );
  });
  return totalDuration;
}

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

function generateTeamLogs(consolidatedData, pairwiseTOI) {
  const teams = {};

  for (const key in consolidatedData) {
    const player = consolidatedData[key];
    const team = teams[player.team_abbreviation] || {
      forwards: [],
      defensemen: [],
      lines: {},
      pairs: {},
    };

    const playerInfo = {
      name: `${player.player_first_name} ${player.player_last_name}`,
      id: player.player_id,
      toi: player.game_toi,
      shared_toi: player.percent_toi_with,
      line_combination: player.line_combination,
      pairing_combination: player.pairing_combination,
    };

    if (isForward(player.primary_position)) {
      team.forwards.push(playerInfo);
    } else if (isDefense(player.primary_position)) {
      team.defensemen.push(playerInfo);
    }

    teams[player.team_abbreviation] = team;
  }

  for (const team in teams) {
    teams[team].forwards.sort((a, b) => parseTime(b.toi) - parseTime(a.toi));
    teams[team].defensemen.sort((a, b) => parseTime(b.toi) - parseTime(a.toi));

    const { forwards, defensemen } = teams[team];

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

      const linePlayers = [pivotPlayer, ...linemates];
      linePlayers.forEach((player) => usedForwards.add(player.id));
      teams[team].lines[line] = linePlayers;
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

      const pairPlayers = [pivotPlayer, ...pairPlayer];
      pairPlayers.forEach((player) => usedDefensemen.add(player.id));
      teams[team].pairs[pair] = pairPlayers;
    }
  }

  return teams;
}

async function fetchAndStoreShiftCharts() {
  const seasonId = await fetchCurrentSeason();
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
      gameIdSet.add(game.id);
      gameInfoMap.set(game.id, {
        gameType: game.gameType,
        gameDate: game.gameDate,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        game_id: game.id,
        season_id: seasonId, // Include season_id
      });
    }
  }

  for (const gameId of gameIdSet) {
    const shiftChartData = await fetchShiftChartData(gameId);

    if (!shiftChartData || !shiftChartData.data) {
      console.error(`No shift chart data found for game ID: ${gameId}`);
      continue;
    }

    const gameInfo = gameInfoMap.get(gameId);
    console.log(`Processing game ID: ${gameId}, game info:`, gameInfo);
    const unmatched = await upsertShiftChartData(
      shiftChartData,
      gameInfo,
      playerPositions
    );
    unmatchedNames.push(...unmatched);

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("Unmatched Names:", Array.from(new Set(unmatchedNames)));

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

      console.log("Unmatched Shift Chart Names:", unmatchedShiftChartNames);
      console.log("Unmatched Yahoo Names:", unmatchedYahooNames);
    }
  }
}

fetchAndStoreShiftCharts();

function isForward(position) {
  return ["LW", "RW", "C"].includes(position);
}

function isDefense(position) {
  return ["D"].includes(position);
}
