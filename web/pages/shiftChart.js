// shiftChart.js
// /workspaces/fhfhockey.com/web/pages/shiftChart.js

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSnackbar } from "notistack";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/ShiftChart.module.scss";
import Fetch from "lib/cors-fetch";
import { GoalIndicators } from "hooks/useGoals";
import PowerPlayAreaIndicators from "components/ShiftChart/PowerPlayAreaIndicators";
import LinemateMatrix, {
  OPTIONS as LINEMATE_MATRIX_MODES
} from "components/LinemateMatrix/index";
import { queryTypes, useQueryState } from "next-usequerystate";
import supabase from "lib/supabase";
import { motion } from "framer-motion";
import useGoals from "hooks/useGoals";

// The following features are planned for future development:
// - Refactor to TypeScript
// - Add dynamic time animations using the game clock
// - Add a play-by-play timeline to the bottom of the chart
// - Add a legend to the chart

// Initializes the timestamps state with keys for each period and an empty array for each
const initialTimestamps = {
  period1: [],
  period2: [],
  period3: [],
  overtime: []
};

/**
 * Retrieves games played on the same date as the input game or the specified date.
 */
async function getGames({ gameId, date }) {
  let finalDate = date;
  if (!date) {
    const { data } = await supabase
      .from("games")
      .select("date")
      .eq("id", gameId)
      .single()
      .throwOnError();
    finalDate = data.date;
  }

  const { data: games } = await supabase
    .from("games")
    .select("id, homeTeamId, awayTeamId")
    .eq("date", finalDate)
    .throwOnError();
  const teamIds = [
    ...new Set(games.map((game) => [game.awayTeamId, game.homeTeamId]).flat())
  ];
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, abbreviation")
    .in("id", teamIds)
    .throwOnError();

  return {
    date: finalDate,
    games: games.map((game) => ({
      id: game.id,
      homeTeam: teams.find((team) => team.id === game.homeTeamId),
      awayTeam: teams.find((team) => team.id === game.awayTeamId)
    }))
  };
}

function ShiftChart() {
  const [gameId, setGameId] = useQueryState("gameId", queryTypes.integer);
  const [linemateMatrixMode, setLinemateMatrixMode] = useQueryState(
    "linemate-matrix-mode",
    queryTypes.string.withDefault(LINEMATE_MATRIX_MODES[0].value)
  );

  // State hooks to manage component data
  const { enqueueSnackbar } = useSnackbar();
  const [selectedDate, setSelectedDate] = useState("");
  const [games, setGames] = useState([]);
  const [playerData, setPlayerData] = useState({ home: [], away: [] });
  const [totalGameTime, setTotalGameTime] = useState(0);
  const [totalGameTimeInSeconds, setTotalGameTimeInSeconds] = useState(0);
  const [totalGameWidth, setTotalGameWidth] = useState(1000); // Dynamic width of the game canvas
  const [isOvertime, setIsOvertime] = useState(false);
  const [timestamps, setTimestamps] = useState(initialTimestamps);
  const [homeTeamAbbrev, setHomeTeamAbbrev] = useState("");
  const [awayTeamAbbrev, setAwayTeamAbbrev] = useState("");
  const [gameScores, setGameScores] = useState({ homeScore: 0, awayScore: 0 });
  const [selectedTime, setSelectedTime] = useState(null);
  const [seasonStartDate, setSeasonStartDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playIntervalRef = useRef(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x by default
  const BASE_SPEED = 4; // Old 4x speed is now the new 1x
  const speedOptions = [1, 2, 4, 8]; // UI: 1x, 2x, 4x, 8x
  const goals = useGoals(gameId);
  // --- Play-by-play based goals array ---
  const [pbpGoals, setPbpGoals] = useState([]);

  // Ref hook for direct DOM access to the game canvas for width calculations
  const gameCanvasRef = useRef(null);

  // Constants for period lengths in seconds
  const REGULAR_PERIOD_LENGTH_SECONDS = 20 * 60; // 20 minutes
  const OVERTIME_LENGTH_SECONDS = 5 * 60; // 5 minutes

  const fetchShiftChartData = useCallback(
    async (gameId) => {
      try {
        // Fetch shift chart data
        // console.log(`Fetching shift chart data for game ID: ${gameId}...`);
        const shiftDataResponse = await Fetch(
          `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`
        ).then((res) => res.json());

        // Fetch game details
        // console.log(`Fetching game details for game ID: ${gameId}...`);
        const gameDetailsResponse = await Fetch(
          `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
        ).then((res) => res.json());

        // Log the game details for the selected game
        // console.log("Game details:", gameDetailsResponse);

        // Set the game scores
        setGameScores({
          homeScore: gameDetailsResponse.homeTeam.score,
          awayScore: gameDetailsResponse.awayTeam.score
        });

        // Set the isOvertime state based on whether there was an overtime period
        setIsOvertime(
          gameDetailsResponse.periodDescriptor.periodType === "OT" ||
            gameDetailsResponse.periodDescriptor.periodType === "SO" ||
            gameDetailsResponse.periodDescriptor.number === 5
        );

        // Calculate total game time in minutes and seconds
        const totalGameTimeInMinutes =
          calculateTotalGameTime(gameDetailsResponse);
        // console.log(`Total Game Time in Minutes: ${totalGameTimeInMinutes}`);
        setTotalGameTime(totalGameTimeInMinutes);

        // Calculate total game time in seconds
        const totalSeconds =
          calculateTotalGameTimeInSeconds(gameDetailsResponse);
        // console.log(`Setting total game time in seconds: ${totalSeconds}`);
        setTotalGameTimeInSeconds(totalSeconds);

        // Fetch player data
        // console.log(`Fetching player data for game ID: ${gameId}...`);
        const fetchedPlayerData = await fetchPlayerData(gameId);

        // Organize shift chart data
        const organizedShiftData = organizeShiftData(shiftDataResponse.data);
        // console.log("Organized shift chart data:", organizedShiftData);

        // Set the home and away team abbreviations
        setHomeTeamAbbrev(gameDetailsResponse.homeTeam.abbrev);
        setAwayTeamAbbrev(gameDetailsResponse.awayTeam.abbrev);
        // console.log("homeTeamAbbrev:", homeTeamAbbrev);
        // console.log("awayTeamAbbrev:", awayTeamAbbrev);

        console.log("Organized Shift Data:", organizedShiftData);

        // Identify all players who started at 00:00 in period1
        const startingPlayers = Object.values(organizedShiftData).filter(
          (player) => {
            // Check if player has any shift in period1 that starts at "00:00"
            return player.shifts.period1.some(
              (shift) => shift.startTime === "00:00"
            );
          }
        );

        console.log(
          "Players starting at 00:00 (before merge):",
          startingPlayers
        );
        console.log("Fetched Player Data:", fetchedPlayerData);

        // Now merge them as you were before
        const updatedPlayerData = mergePlayerData(
          organizedShiftData,
          fetchedPlayerData
        );

        // Log the merged player data right after merging
        console.log("Updated Player Data:", updatedPlayerData);

        // Right after console.log("Updated Player Data:", updatedPlayerData);

        // 1. Identify the starting players from updatedPlayerData
        //    We already have the `startingPlayers` array from organizedShiftData.
        const startingPlayerIds = startingPlayers.map((p) => p.id);

        // Helper function to sort players by position rank
        function sortByPosition(a, b) {
          return getPositionRank(a.position) - getPositionRank(b.position);
        }

        // 2. Separate starting players from the rest for each team
        const homeStartingPlayers = updatedPlayerData.home.filter((player) =>
          startingPlayerIds.includes(player.id)
        );
        const homeNonStartingPlayers = updatedPlayerData.home.filter(
          (player) => !startingPlayerIds.includes(player.id)
        );

        const awayStartingPlayers = updatedPlayerData.away.filter((player) =>
          startingPlayerIds.includes(player.id)
        );
        const awayNonStartingPlayers = updatedPlayerData.away.filter(
          (player) => !startingPlayerIds.includes(player.id)
        );

        // 3. Sort each subset by position so forwards are above defense, and goalies remain at the bottom.
        //    This will ensure that even within the starting group, players are ordered by position priority.
        homeStartingPlayers.sort(sortByPosition);
        homeNonStartingPlayers.sort(sortByPosition);

        awayStartingPlayers.sort(sortByPosition);
        awayNonStartingPlayers.sort(sortByPosition);

        // After sorting homeStartingPlayers, homeNonStartingPlayers, awayStartingPlayers, awayNonStartingPlayers by position:
        // Separate goalies from the other players for the home team
        const homeGoaliesFromStart = homeStartingPlayers.filter(
          (p) => p.position === "G"
        );
        const homeGoaliesFromNonStart = homeNonStartingPlayers.filter(
          (p) => p.position === "G"
        );
        const homeGoalies = [
          ...homeGoaliesFromStart,
          ...homeGoaliesFromNonStart
        ];

        // Filter out goalies from the starting and non-starting arrays
        const homeStartingPlayersWithoutGoalies = homeStartingPlayers.filter(
          (p) => p.position !== "G"
        );
        const homeNonStartingPlayersWithoutGoalies =
          homeNonStartingPlayers.filter((p) => p.position !== "G");

        // Do the same for the away team
        const awayGoaliesFromStart = awayStartingPlayers.filter(
          (p) => p.position === "G"
        );
        const awayGoaliesFromNonStart = awayNonStartingPlayers.filter(
          (p) => p.position === "G"
        );
        const awayGoalies = [
          ...awayGoaliesFromStart,
          ...awayGoaliesFromNonStart
        ];

        const awayStartingPlayersWithoutGoalies = awayStartingPlayers.filter(
          (p) => p.position !== "G"
        );
        const awayNonStartingPlayersWithoutGoalies =
          awayNonStartingPlayers.filter((p) => p.position !== "G");

        // Helper function to find the earliest shift start time in PERIOD1 ONLY
        function getEarliestShiftStartTimeInPeriod1(player) {
          const period1Shifts = player.shifts.period1 || [];
          if (period1Shifts.length === 0) {
            // No period1 shifts, so place them at the bottom
            return Number.MAX_SAFE_INTEGER;
          }

          let earliestStart = Infinity;
          for (const shift of period1Shifts) {
            const shiftStart = convertTimeToSeconds(shift.startTime);
            if (shiftStart < earliestStart) {
              earliestStart = shiftStart;
            }
          }

          return earliestStart === Infinity
            ? Number.MAX_SAFE_INTEGER
            : earliestStart;
        }

        // After you separate goalies and have arrays like homeStartingPlayersWithoutGoalies and homeNonStartingPlayersWithoutGoalies:

        // Sort non-starting skaters by their earliest start time in period1 in ASCENDING order
        homeNonStartingPlayersWithoutGoalies.sort((a, b) => {
          return (
            getEarliestShiftStartTimeInPeriod1(a) -
            getEarliestShiftStartTimeInPeriod1(b)
          );
        });

        awayNonStartingPlayersWithoutGoalies.sort((a, b) => {
          return (
            getEarliestShiftStartTimeInPeriod1(a) -
            getEarliestShiftStartTimeInPeriod1(b)
          );
        });

        // Now rebuild the team arrays with the new sorting
        const reorderedHome = [
          ...homeStartingPlayersWithoutGoalies, // Starting players remain in the order set by position
          ...homeNonStartingPlayersWithoutGoalies, // Non-starting players now sorted in descending order by earliest start time
          ...homeGoalies // Goalies at the bottom
        ];

        const reorderedAway = [
          ...awayStartingPlayersWithoutGoalies,
          ...awayNonStartingPlayersWithoutGoalies,
          ...awayGoalies
        ];

        // Update playerData with the reordered arrays
        setPlayerData({ home: reorderedHome, away: reorderedAway });

        // Continue
        // setPlayerData(updatedPlayerData);
      } catch (error) {
        console.error("Error fetching data:", error);
        enqueueSnackbar(
          `Shift chart data for game ${gameId} is not available`,
          { variant: "error" }
        );
      }
    },
    [enqueueSnackbar]
  ); // Empty dependency array to prevent infinite loop

  // Fetches and processes player data for a given game ID
  const fetchPlayerData = async (gameId) => {
    try {
      const response = await Fetch(
        `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
      ).then((res) => res.json());
      const processedPlayerData = processPlayerData(response);
      setPlayerData(processedPlayerData);
      return processedPlayerData;
    } catch (error) {
      console.error("Error fetching player data:", error);
      return { home: [], away: [] };
    }
  };

  // Processes the raw game data into structured format for player display
  const processPlayerData = (gameData) => {
    // *** ADD Initial Check for gameData and essential team info ***
    if (!gameData || !gameData.homeTeam || !gameData.awayTeam) {
      console.error(
        "processPlayerData received invalid or incomplete gameData:",
        gameData
      );
      return { home: [], away: [] }; // Return empty structure
    }

    const homeTeamId = gameData.homeTeam.id;
    const awayTeamId = gameData.awayTeam.id;

    let homePlayers = [];
    let awayPlayers = [];

    const addPlayer = (playerData, teamId) => {
      const teamAbbrev =
        teamId === homeTeamId
          ? gameData.homeTeam.abbrev
          : gameData.awayTeam.abbrev;

      const teamColors = teamsInfo[teamAbbrev] || {};

      const player = {
        id: playerData.playerId,
        name: playerData.name.default,
        position: playerData.position,
        teamColors: teamColors, // Include team colors here
        shifts: {
          period1: [],
          period2: [],
          period3: [],
          overtime: []
        }
      };

      if (teamId === homeTeamId) {
        homePlayers.push(player);
      } else if (teamId === awayTeamId) {
        awayPlayers.push(player);
      }
    };

    // Roles to match the API structure
    const teams = ["homeTeam", "awayTeam"];
    const roles = ["forwards", "defense", "goalies"]; // Updated to 'defense'

    teams.forEach((team) => {
      roles.forEach((role) => {
        if (
          gameData.playerByGameStats[team] &&
          gameData.playerByGameStats[team][role]
        ) {
          gameData.playerByGameStats[team][role].forEach((player) => {
            addPlayer(player, team === "homeTeam" ? homeTeamId : awayTeamId);
          });
        }
      });
    });

    return {
      home: homePlayers,
      away: awayPlayers
    };
  };

  // Fetches the start date of the most recent season from the 'seasons' table
  const fetchSeasonStartDate = async () => {
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("startDate")
        .order("startDate", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        throw error;
      }

      const seasonStartDate = data.startDate;
      setSeasonStartDate(seasonStartDate);
    } catch (error) {
      console.error("Error fetching season start date:", error);
      enqueueSnackbar("Failed to fetch season start date", {
        variant: "error"
      });
    }
  };

  // Fetches games for the selected date using the NHL API schedule endpoint
  const getGamesByDate = async (date) => {
    try {
      setIsLoading(true);
      const response = await Fetch(
        `https://api-web.nhle.com/v1/schedule/${date}`
      ).then((res) => res.json());

      const gameWeeks = response.gameWeek;

      let games = [];

      // Iterate over the gameWeek array to find the selected date
      gameWeeks.forEach((week) => {
        if (week.date === date) {
          games = week.games.map((game) => ({
            id: game.id,
            homeTeam: {
              id: game.homeTeam.id,
              abbreviation: game.homeTeam.abbrev,
              name: game.homeTeam.placeName.default
            },
            awayTeam: {
              id: game.awayTeam.id,
              abbreviation: game.awayTeam.abbrev,
              name: game.awayTeam.placeName.default
            }
          }));
        }
      });

      if (games.length === 0) {
        setGames([]);
        enqueueSnackbar("No games found for the selected date", {
          variant: "warning"
        });
        return;
      }

      setGames(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      enqueueSnackbar("Failed to fetch games", { variant: "error" });
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically load the most recent finished game on first mount
  const fetchMostRecentGame = useCallback(async () => {
    try {
      const today = new Date();
      let daysBack = 0;
      let found = false;
      let mostRecentGame = null;
      let mostRecentDate = null;
      while (!found && daysBack < 14) {
        // Look back up to 2 weeks
        const date = new Date(today);
        date.setDate(today.getDate() - daysBack);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const response = await Fetch(
          `https://api-web.nhle.com/v1/schedule/${dateStr}`
        ).then((res) => res.json());
        const gameWeeks = response.gameWeek || [];
        for (const week of gameWeeks) {
          for (const game of week.games) {
            // Only consider finished games
            if (game.gameState === "OFF" || game.gameState === "FINAL") {
              if (!mostRecentGame || week.date > mostRecentDate) {
                mostRecentGame = game;
                mostRecentDate = week.date;
                found = true;
              }
            }
          }
        }
        daysBack++;
      }
      if (mostRecentGame && mostRecentDate) {
        setSelectedDate(mostRecentDate);
        setGameId(mostRecentGame.id);
      }
    } catch (e) {
      console.error("Failed to fetch most recent game", e);
    }
  }, [setSelectedDate, setGameId]);

  useEffect(() => {
    if (!selectedDate && !gameId) {
      fetchMostRecentGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the season start date when the component mounts
  useEffect(() => {
    fetchSeasonStartDate();
  }, []);

  // Fetch games whenever the selected date changes
  useEffect(() => {
    if (selectedDate) {
      getGamesByDate(selectedDate);
    }
  }, [selectedDate]);

  // Calculates the total game time in minutes and seconds, excluding shootout
  const calculateTotalGameTime = (gameDetails) => {
    const regularPeriodLength = 20; // 20 minutes for a regular period
    let totalMinutes = regularPeriodLength * 3; // Regular NHL game has 3 periods

    // Check if the game had an overtime
    if (gameDetails.periodDescriptor.periodType === "OT") {
      const overtimeSeconds = gameDetails.clock.secondsRemaining;
      const overtimeMinutesPlayed = (5 * 60 - overtimeSeconds) / 60;
      totalMinutes += overtimeMinutesPlayed;
    }

    // Format the time to avoid rounding errors
    const totalSeconds = Math.floor(totalMinutes * 60);
    const formattedMinutes = Math.floor(totalSeconds / 60);
    const formattedSeconds = totalSeconds % 60;

    return `${formattedMinutes}:${formattedSeconds
      .toString()
      .padStart(2, "0")} minutes`;
  };

  // Function to convert game time into total seconds for further calculations, excluding shootout
  const calculateTotalGameTimeInSeconds = (gameDetails) => {
    const regularPeriodLengthInSeconds = 20 * 60; // 20 minutes for a regular period in seconds
    let totalSeconds = regularPeriodLengthInSeconds * 3; // Regular NHL game has 3 periods

    if (gameDetails.periodDescriptor.periodType === "OT") {
      const overtimeSeconds = gameDetails.clock.secondsRemaining;
      const overtimeDurationInSeconds = 5 * 60 - overtimeSeconds;
      totalSeconds += overtimeDurationInSeconds;
    }

    return totalSeconds;
  };

  // Function to merge player data with shift data
  const mergePlayerData = (shiftData, playerData) => {
    const addShiftDataToPlayer = (teamPlayers) => {
      return teamPlayers.map((player) => {
        const playerShiftData = shiftData[player.id] || {};
        return {
          ...player,
          hexValue: playerShiftData.hexValue || "#000000", // Default color if not found
          shifts: playerShiftData.shifts || [], // Ensure 'shifts' is an array
          team: playerShiftData.team || "" // Ensure 'team' is a string
        };
      });
    };

    return {
      home: addShiftDataToPlayer(playerData.home),
      away: addShiftDataToPlayer(playerData.away)
    };
  };

  const handleGameChange = (event) => {
    // Remove hash section if exists
    const url = new URL(window.location.href);
    url.hash = ""; // Set the hash (fragment) to empty string
    history.replaceState(null, "", url);

    const gameId = event.target.value;
    setGameId(Number(gameId), { shallow: true });
    setSelectedTime(null); // Reset the selected time
    if (gameId) {
      fetchShiftChartData(gameId);
      fetchPlayerData(gameId); // Fetch player data
    }
  };

  // Helper function to convert MM:SS time string to seconds
  const convertTimeToSeconds = (timeString) => {
    if (!timeString) {
      return 0;
    }
    const [minutes, seconds] = timeString.split(":").map(Number);
    return minutes * 60 + seconds;
  };

  // Function to generate timestamps for every period of the game, excluding shootout
  const generateTimestamps = (totalGameTimeInSeconds, isOvertime) => {
    const regularGameLengthInSeconds = REGULAR_PERIOD_LENGTH_SECONDS * 3;
    const overtimegameLengthInSeconds =
      regularGameLengthInSeconds + OVERTIME_LENGTH_SECONDS;

    let timestamps = {
      period1: [],
      period2: [],
      period3: [],
      overtime: []
    };

    const calculatePositionPercent = (timeInSeconds) => {
      if (isOvertime) {
        // Regular periods occupy 12/13 of the width in an overtime game
        const adjustedBaseLength = regularGameLengthInSeconds * (13 / 12);
        return (timeInSeconds / adjustedBaseLength) * 100;
      } else {
        // Regular game length for non-overtime games
        return (timeInSeconds / regularGameLengthInSeconds) * 100;
      }
    };

    // Add timestamps for each regular period
    for (let period = 1; period <= 3; period++) {
      for (
        let time = 0;
        time <= REGULAR_PERIOD_LENGTH_SECONDS;
        time += 5 * 60
      ) {
        const periodStart = (period - 1) * REGULAR_PERIOD_LENGTH_SECONDS;
        const timestampTime = periodStart + time;
        const label =
          period === 3 && time === REGULAR_PERIOD_LENGTH_SECONDS
            ? "60"
            : `${periodStart / 60 + time / 60}`;

        timestamps[`period${period}`].push({
          label: label,
          seconds: timestampTime,
          positionPercent: calculatePositionPercent(timestampTime)
        });
      }
    }

    // Adjusted calculatePositionPercent for overtime
    const calculateOvertimePositionPercent = (timeInSeconds) => {
      // Overtime occupies 1/13 of the width, starting after 12/13
      const adjustedTime = timeInSeconds - regularGameLengthInSeconds;
      return 92.3077 + (adjustedTime / OVERTIME_LENGTH_SECONDS) * 7.6923; // 92.3077% is 12/13 of the width
    };

    // Add overtime timestamps
    if (isOvertime) {
      const overtimeStart = REGULAR_PERIOD_LENGTH_SECONDS * 3;
      const overtimeEnd = overtimeStart + OVERTIME_LENGTH_SECONDS;

      // Calculate the actual end of the game during overtime
      const gameEndInSeconds = totalGameTimeInSeconds;
      if (
        gameEndInSeconds < overtimeEnd &&
        gameEndInSeconds !== overtimegameLengthInSeconds
      ) {
        // Add the gameEndInSeconds label if the game ended before 65 and not exactly at the end of overtime
        console.log("Adding game end timestamp:", gameEndInSeconds);
        console.log("Overtime end:", overtimeEnd);
        timestamps.overtime.push({
          label: formatOvertimeLabel(gameEndInSeconds - overtimeStart),
          seconds: gameEndInSeconds,
          positionPercent: calculateOvertimePositionPercent(gameEndInSeconds)
        });
      }

      // Always add the "65" timestamp at the theoretical end of overtime
      timestamps.overtime.push({
        label: "65",
        seconds: overtimeEnd,
        positionPercent: 100 // 100% for the end of the overtime column
      });
    }

    return timestamps;
  };

  // Helper function to format overtime label
  const formatOvertimeLabel = (overtimeDurationInSeconds) => {
    const minutes = Math.floor(overtimeDurationInSeconds / 60);
    const seconds = overtimeDurationInSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Organizes shift data into structured format for rendering the chart
  const organizeShiftData = (shiftData) => {
    const playerShifts = {};

    shiftData.forEach((shift) => {
      // Check if the shift belongs to a regular period or overtime
      if ([1, 2, 3, 4].includes(shift.period)) {
        const playerName = `${shift.firstName} ${shift.lastName}`;
        if (!playerShifts[playerName]) {
          playerShifts[playerName] = {
            name: playerName,
            id: shift.playerId,
            team: shift.teamAbbrev,
            hexValue: shift.hexValue,
            shifts: {
              period1: [],
              period2: [],
              period3: [],
              overtime: [] // Assuming period 4 is overtime
            }
          };
        }

        const periodKey =
          shift.period === 4 ? "overtime" : `period${shift.period}`;
        playerShifts[playerName].shifts[periodKey].push(shift);
      }
    });

    // Sort the shifts for each player by start time within each period
    Object.values(playerShifts).forEach((player) => {
      Object.keys(player.shifts).forEach((periodKey) => {
        player.shifts[periodKey].sort((a, b) => {
          const startTimeA = convertTimeToSeconds(a.startTime);
          const startTimeB = convertTimeToSeconds(b.startTime);
          return startTimeA - startTimeB;
        });
      });
    });

    return Object.values(playerShifts).reduce((acc, player) => {
      acc[player.id] = player; // Use player ID as key for easy lookup
      return acc;
    }, {});
  };

  const renderShiftBlocks = (
    shifts,
    periodKey,
    periodLengthInSeconds,
    team
  ) => {
    if (!shifts || !Array.isArray(shifts)) {
      return null;
    }

    // console.log(`Rendering shift blocks for period ${periodKey}:`, shifts);

    return shifts.map((shift, index) => {
      // Convert shift start time and duration from MM:SS to seconds
      const startSeconds = convertTimeToSeconds(shift.startTime);
      const durationSeconds = convertTimeToSeconds(shift.duration);

      // Determine the width of the shift block as a percentage of the period length
      const periodLengthForCalc =
        periodKey === "overtime"
          ? OVERTIME_LENGTH_SECONDS
          : REGULAR_PERIOD_LENGTH_SECONDS;
      const widthPercent = (durationSeconds / periodLengthForCalc) * 100;

      // Calculate the left offset of the shift block as a percentage of the period length
      const leftPercent = (startSeconds / periodLengthForCalc) * 100;

      const teamColors = teamsInfo[shift.teamAbbrev] || {};

      const teamPrimaryColor = teamColors.primaryColor || "#000000";
      const teamSecondaryColor = teamColors.secondaryColor || "#000000";
      const teamJerseyColor = teamColors.jersey || "#000000";
      const teamAccentColor = teamColors.accent || "#000000";
      const brandColor = "#07aae2"; // Default brand color "#07aae2
      const shiftColor = team === "home" ? "#FDE74C" : "#5BC0EB";

      // Define the inline style for the shift block
      const shiftStyleVars = {
        "--shift-bg": lightenHexColor(teamPrimaryColor, 10),
        "--shift-width": `${widthPercent}%`,
        "--shift-left": `${leftPercent}%`,
        "--shift-border": `1px solid ${lightenHexColor(teamPrimaryColor, 35)}`
      };

      const tooltipText = `Start: ${shift.startTime}, \nDuration: ${shift.duration}`;

      // Render the shift block
      return (
        <div
          key={`shift-${index}`}
          className={styles.shiftBlock}
          style={shiftStyleVars}
          title={tooltipText}
        ></div>
      );
    });
  };

  const lightenHexColor = (hex, percent) => {
    if (!hex) return "#000000"; // Return a default color or handle as needed

    // Ensure the hash is removed from the hex color
    hex = hex.replace("#", "");

    // Parse the hex color
    const num = parseInt(hex, 16);

    // Break down the color into r, g, and b components
    let r = (num >> 16) + Math.floor((255 - (num >> 16)) * (percent / 100));
    let g =
      ((num >> 8) & 0x00ff) +
      Math.floor((255 - ((num >> 8) & 0x00ff)) * (percent / 100));
    let b =
      (num & 0x0000ff) + Math.floor((255 - (num & 0x0000ff)) * (percent / 100));

    // Clamp each component to 255 and convert them back to hex representation
    r = Math.min(255, r).toString(16).padStart(2, "0");
    g = Math.min(255, g).toString(16).padStart(2, "0");
    b = Math.min(255, b).toString(16).padStart(2, "0");

    // Recombine components and return the lightened hex color
    return `#${r}${g}${b}`;
  };

  const darkenHexColor = (hex, percent) => {
    if (!hex) return "#000000"; // Return a default color if hex is invalid

    // Ensure the hash is removed from the hex color
    hex = hex.replace("#", "");

    // Parse the hex color
    const num = parseInt(hex, 16);

    // Break down the color into r, g, and b components
    let r = (num >> 16) - Math.floor((num >> 16) * (percent / 100));
    let g =
      ((num >> 8) & 0x00ff) -
      Math.floor(((num >> 8) & 0x00ff) * (percent / 100));
    let b = (num & 0x0000ff) - Math.floor((num & 0x0000ff) * (percent / 100));

    // Clamp each component to a minimum of 0 to avoid negative values
    r = Math.max(0, r).toString(16).padStart(2, "0");
    g = Math.max(0, g).toString(16).padStart(2, "0");
    b = Math.max(0, b).toString(16).padStart(2, "0");

    // Recombine components and return the darkened hex color
    return `#${r}${g}${b}`;
  };

  // Function to handle clicking on the timestamps bar
  const onTimestampClick = (event) => {
    const bar = event.currentTarget;
    const clickPosition =
      (event.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth;

    const totalWidthTime = isOvertime
      ? REGULAR_PERIOD_LENGTH_SECONDS * 3 + OVERTIME_LENGTH_SECONDS
      : REGULAR_PERIOD_LENGTH_SECONDS * 3;
    const time = clickPosition * totalWidthTime;

    setSelectedTime(time);
    sortPlayersByTimeAndPosition(time);

    // Update the width of the brighter background based on the click position
    const brightWidthPercentage = clickPosition * 100;
    bar.style.setProperty("--bright-width", `${brightWidthPercentage}%`);
  };

  const adjustShiftTimeForPeriod = (shift) => {
    // console.log("Adjusting shift time for period. Shift data:", shift);
    if (!shift || typeof shift.period === "undefined") {
      console.error("Invalid shift object or period undefined", shift);
      return { shiftStartAdjusted: 0, shiftEndAdjusted: 0 };
    }

    let timeAdjustment = 0;

    switch (shift.period) {
      case 2:
        timeAdjustment = REGULAR_PERIOD_LENGTH_SECONDS;
        break;
      case 3:
        timeAdjustment = REGULAR_PERIOD_LENGTH_SECONDS * 2;
        break;
      case 4: // Assuming 4 represents overtime
        timeAdjustment = REGULAR_PERIOD_LENGTH_SECONDS * 3;
        break;
      default:
        timeAdjustment = 0;
    }
    const shiftStartAdjusted =
      convertTimeToSeconds(shift.startTime) + timeAdjustment;
    const shiftEndAdjusted =
      shiftStartAdjusted + convertTimeToSeconds(shift.duration);
    return { shiftStartAdjusted, shiftEndAdjusted };
  };

  // Position ranking - lower number means higher priority
  const positionRanking = {
    C: 1, // Center
    L: 1, // Left Wing
    R: 1, // Right Wing
    D: 2, // Defense
    G: 3 // Goalie
  };

  const getPositionRank = (position) => {
    return positionRanking[position] || 4; // Default rank for unknown positions
  };

  const sortPlayersByTimeAndPosition = (time) => {
    const allPlayers = [...playerData.home, ...playerData.away];

    allPlayers.forEach((player) => {
      const isGoalie = player.position === "G";
      const isPlayerActive =
        isGoalie ||
        Object.values(player.shifts).some((periodShifts) =>
          periodShifts.some((shift) => {
            const { shiftStartAdjusted, shiftEndAdjusted } =
              adjustShiftTimeForPeriod(shift);
            return time >= shiftStartAdjusted && time <= shiftEndAdjusted;
          })
        );

      player.isActive = isPlayerActive || isGoalie; // Ensure goalies are always included

      player.playerClass = player.isActive
        ? styles.activePlayer
        : styles.inactivePlayer;
    });

    const sortedPlayers = allPlayers.sort((a, b) => {
      if (a.team === homeTeamAbbrev && b.team !== homeTeamAbbrev) {
        return -1;
      } else if (a.team !== homeTeamAbbrev && b.team === homeTeamAbbrev) {
        return 1;
      } else if (a.isActive && !b.isActive) {
        return -1;
      } else if (!a.isActive && b.isActive) {
        return 1;
      } else {
        return getPositionRank(a.position) - getPositionRank(b.position);
      }
    });

    const homePlayers = sortedPlayers.filter(
      (player) => player.team === homeTeamAbbrev
    );
    const awayPlayers = sortedPlayers.filter(
      (player) => player.team === awayTeamAbbrev
    );

    setPlayerData({ home: homePlayers, away: awayPlayers });
  };

  // Fetch play-by-play data when gameId changes
  useEffect(() => {
    if (!gameId) {
      setPbpGoals([]);
      return;
    }
    Fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`)
      .then((res) => res.json())
      .then((data) => {
        if (!data || !Array.isArray(data.plays)) {
          setPbpGoals([]);
          return;
        }
        // Filter for all goal events (including shootout-goal)
        const goals = data.plays
          .filter(
            (play) =>
              play.typeDescKey === "goal" ||
              play.typeDescKey === "shootout-goal"
          )
          .map((play) => {
            // Parse timeInPeriod (MM:SS) to seconds
            const [min, sec] = play.timeInPeriod.split(":").map(Number);
            return {
              period: { number: play.period },
              timeInPeriod: min * 60 + sec,
              scoreTeamAbbreviation: play.teamAbbrev
            };
          });
        // Sort by absolute time in game
        goals.sort((a, b) => {
          const aTime = (a.period.number - 1) * 20 * 60 + a.timeInPeriod;
          const bTime = (b.period.number - 1) * 20 * 60 + b.timeInPeriod;
          return aTime - bTime;
        });
        setPbpGoals(goals);
      })
      .catch(() => setPbpGoals([]));
  }, [gameId]);

  function getScoreAtSelectedTime(goals, selectedTime, homeAbbrev, awayAbbrev) {
    let home = 0,
      away = 0;
    if (!Array.isArray(goals) || !homeAbbrev || !awayAbbrev)
      return { home, away };
    for (const goal of goals) {
      // Calculate absolute time in game for this goal (matches GoalIndicators)
      const goalTime = (goal.period.number - 1) * 20 * 60 + goal.timeInPeriod;
      if (goalTime > (selectedTime ?? 0)) break;
      if (goal.scoreTeamAbbreviation === homeAbbrev) home++;
      if (goal.scoreTeamAbbreviation === awayAbbrev) away++;
    }
    return { home, away };
  }

  const scoreAtSelectedTime = getScoreAtSelectedTime(
    goals,
    selectedTime,
    homeTeamAbbrev,
    awayTeamAbbrev
  );

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // useEffect to fetch games whenever the selected date changes
  useEffect(() => {
    (async () => {
      if (selectedDate) {
        try {
          // Fetches games for a selected date
          const { games } = await getGames({ date: selectedDate });
          setGames(games);
        } catch (e) {
          enqueueSnackbar("Failed to fetch games", { variant: "error" });
          console.error(e);
          setGames([]);
        }
      }
    })();
  }, [selectedDate, enqueueSnackbar]);

  // Use useEffect to set the width of the game canvas after the component mounts
  useEffect(() => {
    // Only attempt to set the width if the ref is current and the game has been selected
    if (gameCanvasRef.current && gameId) {
      const updateDimensions = () => {
        setTotalGameWidth(gameCanvasRef.current.offsetWidth);
      };

      // Set the initial dimensions and add event listener for any resize events
      updateDimensions();
      window.addEventListener("resize", updateDimensions);

      // Clean up event listener when the component is unmounted or the selected game changes
      return () => window.removeEventListener("resize", updateDimensions);
    }
  }, [gameId]);

  useEffect(() => {
    if (gameId) {
      fetchShiftChartData(gameId);
      // console.log("Selected Game:", selectedGame);
      // Set the game scores
    }
  }, [fetchShiftChartData, gameId]); // Add dependency on fetchShiftChartData

  // useEffect to recalculate the timestamps when the total game time changes
  useEffect(() => {
    const newTimestamps = generateTimestamps(
      totalGameTimeInSeconds,
      isOvertime
    );
    setTimestamps(newTimestamps);
  }, [totalGameTimeInSeconds, isOvertime]);

  // fetch date and games on initial load
  useEffect(() => {
    if (games.length !== 0 || selectedDate || !gameId) return;
    (async () => {
      try {
        const { date, games } = await getGames({ gameId: gameId });
        if (selectedDate) return;
        setSelectedDate(date);
        setGames(games);
      } catch (e) {
        console.error(e.message);
        enqueueSnackbar("Failed to fetch games", { variant: "error" });
      }
    })();
  }, [gameId, games, selectedDate, enqueueSnackbar]);

  // Update the playback interval logic:
  useEffect(() => {
    if (playing) {
      const intervalMs = 100;
      playIntervalRef.current = setInterval(() => {
        setSelectedTime((prev) => {
          const next =
            (prev == null ? 0 : prev) + BASE_SPEED * playbackSpeed * 0.1;
          if (next >= totalGameTimeInSeconds) {
            setPlaying(false);
            return totalGameTimeInSeconds;
          }
          // Round to 2 decimals for smoothness
          return Math.round(next * 100) / 100;
        });
      }, intervalMs);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    return () => clearInterval(playIntervalRef.current);
  }, [playing, totalGameTimeInSeconds, playbackSpeed]);

  // Reset playback on game change
  useEffect(() => {
    setPlaying(false);
    setSelectedTime(null);
  }, [gameId]);

  // Add a useEffect to always call sortPlayersByTimeAndPosition when selectedTime changes
  useEffect(() => {
    if (selectedTime != null) {
      sortPlayersByTimeAndPosition(selectedTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTime]);

  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////

  // console.log("Rendering player data:", playerData);

  // Helper to get starting players
  const getStartingPlayers = (players) =>
    players.filter(
      (player) =>
        player.shifts &&
        player.shifts.period1 &&
        player.shifts.period1.some((shift) => shift.startTime === "00:00")
    );

  // Helper to group active players by position
  const groupActivePlayersByPosition = (players) => {
    const fwd = [];
    const d = [];
    const g = [];
    players.forEach((p) => {
      if (p.position === "G") g.push(p);
      else if (p.position === "D") d.push(p);
      else fwd.push(p);
    });
    return { fwd, d, g };
  };

  return (
    <div className={styles.shiftChartPageOuterGrid}>
      {/* Left: Shift Chart Table & Controls (66%) */}
      <div className={styles.shiftChartMainColumn}>
        <div className={styles.controlsContainerModernCard}>
          <div className={styles.controlsRow}>
            {/* Dropdowns */}
            <div className={styles.dropdownGroup}>
              <div className={styles.shiftChartDropdown}>
                <label htmlFor="date-selector">Select Date: </label>
                <input
                  type="date"
                  id="date-selector"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div className={styles.shiftChartDropdown}>
                <label htmlFor="game-selector">Select Game: </label>
                <select
                  id="game-selector"
                  value={gameId ?? ""}
                  onChange={handleGameChange}
                >
                  <option value="">Select a game</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {`${game.homeTeam.abbreviation} vs ${game.awayTeam.abbreviation}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Center column: Score above playback controls */}
            <div className={styles.centerControlsColumn}>
              <div className={styles.scoreAtTimeAboveControls}>
                {homeTeamAbbrev} {scoreAtSelectedTime.home} -{" "}
                {scoreAtSelectedTime.away} {awayTeamAbbrev}
              </div>
              <div className={styles.playbackControls}>
                {/* ...existing playback controls code... */}
                <button
                  className={styles.skipButton}
                  aria-label="Skip back 30 seconds"
                  onClick={() =>
                    setSelectedTime((t) => Math.max(0, (t ?? 0) - 30))
                  }
                >
                  {/* Skip Back SVG */}
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <polygon points="22,6 10,16 22,26" fill="#07aae2" />
                    <rect
                      x="6"
                      y="6"
                      width="3"
                      height="20"
                      rx="1.5"
                      fill="#07aae2"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className={styles.playPauseButton}
                  aria-label={playing ? "Pause" : "Play"}
                  style={{
                    margin: "0 8px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0
                  }}
                >
                  {playing ? (
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 32 32"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect
                        x="7"
                        y="6"
                        width="6"
                        height="20"
                        rx="2"
                        fill="#e67e22"
                      />
                      <rect
                        x="19"
                        y="6"
                        width="6"
                        height="20"
                        rx="2"
                        fill="#e67e22"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 32 32"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <polygon points="8,6 26,16 8,26" fill="#07aae2" />
                    </svg>
                  )}
                </button>
                <button
                  className={styles.skipButton}
                  aria-label="Skip forward 30 seconds"
                  onClick={() =>
                    setSelectedTime((t) =>
                      Math.min(totalGameTimeInSeconds, (t ?? 0) + 30)
                    )
                  }
                >
                  {/* Skip Forward SVG */}
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <polygon points="10,6 22,16 10,26" fill="#07aae2" />
                    <rect
                      x="23"
                      y="6"
                      width="3"
                      height="20"
                      rx="1.5"
                      fill="#07aae2"
                    />
                  </svg>
                </button>
                <label
                  className={styles.speedLabel}
                  htmlFor="playback-speed"
                  style={{
                    marginLeft: 16,
                    marginRight: 4,
                    color: "#aaa",
                    fontWeight: 600,
                    fontSize: 14
                  }}
                >
                  Speed:
                </label>
                <select
                  id="playback-speed"
                  className={styles.speedSelect}
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    borderRadius: 4,
                    padding: "2px 8px",
                    border: "1px solid #07aae2",
                    background: "#181818",
                    color: "#07aae2"
                  }}
                >
                  {speedOptions.map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}x
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Active player list */}
            <div className={styles.activePlayersListCard}>
              <h4>Active Players On Ice</h4>
              <div className={styles.activePlayersListGrid}>
                {[
                  {
                    team: homeTeamAbbrev,
                    players:
                      selectedTime == null
                        ? getStartingPlayers(playerData.home)
                        : playerData.home.filter((player) => player.isActive)
                  },
                  {
                    team: awayTeamAbbrev,
                    players:
                      selectedTime == null
                        ? getStartingPlayers(playerData.away)
                        : playerData.away.filter((player) => player.isActive)
                  }
                ]
                  .filter(
                    ({ team, players }) => team && players && players.length > 0
                  )
                  .map(({ team, players }) => {
                    const { fwd, d, g } = groupActivePlayersByPosition(players);
                    // FWD rows: if 4, split 2+2; if 3, one row; if 2, one row; if >4, chunk by 3
                    let fwdRows = [];
                    if (fwd.length === 4) {
                      fwdRows = [fwd.slice(0, 2), fwd.slice(2, 4)];
                    } else if (fwd.length > 4) {
                      for (let i = 0; i < fwd.length; i += 3) {
                        fwdRows.push(fwd.slice(i, i + 3));
                      }
                    } else if (fwd.length > 0) {
                      fwdRows = [fwd];
                    }
                    // D row: all defensemen in one row
                    // G row: all goalies in one row
                    return (
                      <div
                        key={team}
                        className={styles.activePlayersTeamSection}
                      >
                        <fieldset className={styles.activePlayersTeamFieldset}>
                          <legend className={styles.activePlayersTeamLegend}>
                            {team}
                          </legend>
                          <div className={styles.activePlayersFormation}>
                            {fwdRows.map((row, i) => (
                              <div
                                key={`fwd-row-${i}`}
                                className={
                                  styles.formationRow + " " + styles.fwdRow
                                }
                              >
                                {row.map((player) => (
                                  <span
                                    key={player.id}
                                    className={styles.highlight}
                                  >
                                    {player.name}
                                    {player.sweaterNumber
                                      ? ` #${player.sweaterNumber}`
                                      : ""}
                                  </span>
                                ))}
                              </div>
                            ))}
                            {d.length > 0 && (
                              <div
                                className={
                                  styles.formationRow + " " + styles.dRow
                                }
                              >
                                {d.map((player) => (
                                  <span
                                    key={player.id}
                                    className={styles.highlight}
                                  >
                                    {player.name}
                                    {player.sweaterNumber
                                      ? ` #${player.sweaterNumber}`
                                      : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                            {g.length > 0 && (
                              <div
                                className={
                                  styles.formationRow + " " + styles.gRow
                                }
                              >
                                {g.map((player) => (
                                  <span
                                    key={player.id}
                                    className={styles.highlight}
                                  >
                                    {player.name}
                                    {player.sweaterNumber
                                      ? ` #${player.sweaterNumber}`
                                      : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </fieldset>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
        {/* Shift Chart Table Section */}
        <div className={styles.shiftChartTableContainer}>
          {" "}
          {/* Wrapper for table section */}
          <div className={styles.tableScrollWrapper}>
            {" "}
            {/* Wrapper for horizontal scrolling */}
            <table className={styles.shiftChartTable}>
              <colgroup>
                <col className={styles.colPlayerName} />
                <col className={styles.colPlayerPosition} />
                <col className={styles.colPeriod1} />
                <col className={styles.colPeriod2} />
                <col className={styles.colPeriod3} />
                {isOvertime && <col className={styles.colOvertime} />}
              </colgroup>
              <thead>
                <tr>
                  <th className={styles.gameInfoHeader} colSpan="2">
                    {/* {homeTeamAbbrev && awayTeamAbbrev
                      ? `${homeTeamAbbrev} vs ${awayTeamAbbrev}`
                      : "Player / Pos"} */}
                  </th>
                  <th className={styles.timestampPeriod}>Period 1</th>
                  <th className={styles.timestampPeriod}>Period 2</th>
                  <th className={styles.timestampPeriod}>Period 3</th>
                  {isOvertime && (
                    <th className={styles.timestampOvertime}>OT</th>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className={styles.timeStampRow}>
                  <td className={styles.gameScoreCell} colSpan="2">
                    {homeTeamAbbrev && awayTeamAbbrev
                      ? `${homeTeamAbbrev} vs ${awayTeamAbbrev}`
                      : "Player / Pos"}{" "}
                    {`${gameScores.homeScore} - ${gameScores.awayScore}`}
                  </td>
                  <td
                    className={styles.timestampsBar}
                    colSpan={isOvertime ? "4" : "3"}
                    onClick={onTimestampClick}
                    style={{ position: "relative" }}
                  >
                    {Object.keys(timestamps).map((periodKey) =>
                      timestamps[periodKey].map((timestamp, index) => (
                        <div
                          key={index}
                          className={styles.timestampLabel}
                          style={{ "--left": `${timestamp.positionPercent}%` }}
                        >
                          {timestamp.label}
                        </div>
                      ))
                    )}
                    <div
                      className={styles.yellowLine}
                      style={{
                        "--left": `${
                          (selectedTime /
                            (isOvertime
                              ? OVERTIME_LENGTH_SECONDS
                              : REGULAR_PERIOD_LENGTH_SECONDS * 3)) *
                          100
                        }%`
                      }}
                    ></div>
                    <GoalIndicators
                      id={gameId}
                      totalGameTimeInSeconds={totalGameTimeInSeconds}
                      isOvertime={isOvertime}
                      totalPlayerRows={
                        playerData.home.length + playerData.away.length
                      }
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "100%",
                        width: "100%",
                        height: `${
                          (playerData.home.length + playerData.away.length) *
                          100
                        }%`,
                        zIndex: 1
                      }}
                    >
                      <PowerPlayAreaIndicators
                        id={gameId}
                        // 65 minutes = OT games total time
                        // 60 minutes = REG games total time
                        totalGameTimeInSeconds={isOvertime ? 65 * 60 : 60 * 60}
                      />
                    </div>
                  </td>
                </tr>

                {/* Team Header for Home Team */}
                <tr
                  className={styles.teamHeaderRowHome}
                  style={{
                    "--team-header-bg":
                      teamsInfo[homeTeamAbbrev]?.primaryColor || "#000000",
                    "--team-header-text":
                      teamsInfo[homeTeamAbbrev]?.secondaryColor || "#FFFFFF",
                    "--team-header-border":
                      teamsInfo[homeTeamAbbrev]?.jersey || "#FFFFFF"
                  }}
                >
                  <td
                    className={styles.teamHeaderCellHome}
                    colSpan={isOvertime ? "6" : "5"}
                    style={{
                      "--team-header-cell-bg":
                        lightenHexColor(
                          teamsInfo[homeTeamAbbrev]?.primaryColor,
                          15
                        ) || "#000000",
                      "--team-header-cell-border": "1px solid #FFFFFF"
                    }}
                  >
                    {homeTeamAbbrev}
                  </td>
                </tr>

                {playerData.home.map((player, index) => {
                  // Check if the player is a backup goalie with no shifts
                  const isBackupGoalie =
                    player.position === "G" &&
                    (!Array.isArray(player.shifts.period1) ||
                      player.shifts.period1.length === 0) &&
                    (!Array.isArray(player.shifts.period2) ||
                      player.shifts.period2.length === 0) &&
                    (!Array.isArray(player.shifts.period3) ||
                      player.shifts.period3.length === 0) &&
                    (!isOvertime ||
                      !Array.isArray(player.shifts.overtime) ||
                      player.shifts.overtime.length === 0);

                  // Flatten all period shifts into a single array
                  const allShifts = [].concat(
                    player.shifts.period1,
                    player.shifts.period2,
                    player.shifts.period3,
                    player.shifts.overtime
                  );

                  // console.log(allShifts);

                  // Determine if the player is currently active based on the selectedTime
                  const isActive = allShifts.some((shift) => {
                    // Check if shift is undefined or null
                    if (!shift || typeof shift.startTime === "undefined") {
                      console.error(
                        "Shift is undefined or does not have a startTime property:",
                        shift,
                        player
                      );
                      return false; // or handle this case as appropriate for your application
                    }

                    const shiftStart = convertTimeToSeconds(shift.startTime);
                    const shiftEnd =
                      shiftStart + convertTimeToSeconds(shift.duration);
                    return (
                      selectedTime >= shiftStart && selectedTime < shiftEnd
                    );
                  });

                  const teamColors = player.teamColors; // Access team colors from player object

                  const shiftBlockBackgroundColor =
                    index % 2 === 0 ? "#404040" : "#202020";

                  const indexedColors = [
                    "#202020",
                    "#404040",
                    "#808080",
                    "#606060"
                  ];

                  // const playerNameBackgroundColor = player.team
                  //   ? player.team === homeTeamAbbrev
                  //     ? index % 2 === 0
                  //       ? indexedColors[0]
                  //       : indexedColors[1]
                  //     : index % 2 === 0
                  //     ? indexedColors[2]
                  //     : indexedColors[3]
                  //   : "#000000"; // Default color if secondaryColor is undefined

                  const playerNameBackgroundColor = teamColors.primaryColor
                    ? index % 2 === 0
                      ? lightenHexColor(teamColors.primaryColor, 20)
                      : lightenHexColor(teamColors.primaryColor, 15)
                    : "#000000"; // Default color if secondaryColor is undefined

                  const playerPositionBackgroundColor = teamColors.primaryColor
                    ? index % 2 === 0
                      ? lightenHexColor(teamColors.primaryColor, 15)
                      : lightenHexColor(teamColors.primaryColor, 3)
                    : "#000000"; // Default color if secondaryColor is undefined

                  // const textColor = player.team
                  //   ? player.team === homeTeamAbbrev
                  //     ? index % 2 === 0
                  //       ? lightenHexColor(indexedColors[0], 70)
                  //       : lightenHexColor(indexedColors[1], 70)
                  //     : index % 2 === 0
                  //     ? darkenHexColor(indexedColors[2], 70)
                  //     : darkenHexColor(indexedColors[3], 70)
                  //   : "#FFFFFF"; // Default color if secondaryColor is undefined

                  const textColor = teamColors.secondaryColor
                    ? lightenHexColor(teamColors.secondaryColor, 50)
                      ? index % 2 === 0
                        ? lightenHexColor(teamColors.secondaryColor, 50)
                        : lightenHexColor(teamColors.secondaryColor, 50)
                      : index % 2 === 0
                        ? darkenHexColor(teamColors.secondaryColor, 70)
                        : darkenHexColor(teamColors.secondaryColor, 70)
                    : "#FFFFFF"; // Default color if secondaryColor is undefined

                  return (
                    <motion.tr
                      layout="position"
                      initial={{ opacity: 0 }} // Optional: fade in initially
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }} // Optional: fade out on removal
                      transition={{ duration: 0.4, ease: "easeInOut" }} // Customize animation
                      className={`${styles.playerRow} ${
                        player.playerClass || ""
                      }`}
                      key={player.id} // IMPORTANT: Key must be stable
                      style={{
                        "--player-color": lightenHexColor(textColor, 10),
                        "--player-bg": playerNameBackgroundColor,
                        "--player-weight": player.isActive ? "900" : "200",
                        "--player-stretch": player.isActive
                          ? "expanded"
                          : "normal",
                        "--player-spacing": player.isActive ? "0.1em" : "normal"
                      }}
                    >
                      <td
                        className={styles.playerNameCell}
                        // No inline style
                      >
                        <span
                          className={`${styles.playerNameText} ${!player.isActive ? styles.inactivePlayerText : ""}`}
                        >
                          {player.name}
                        </span>
                      </td>
                      <td
                        className={styles.playerPositionCell}
                        style={{
                          "--player-position-bg": playerPositionBackgroundColor
                        }}
                      >
                        {player.position}
                      </td>
                      {/* Render shifts only if the player is not a backup goalie with no shifts */}
                      {!isBackupGoalie && (
                        <>
                          {/* Period 1 */}
                          <td
                            className={styles.shiftBlocksCell}
                            style={{
                              "--shift-block-bg": darkenHexColor(
                                shiftBlockBackgroundColor,
                                20
                              )
                            }}
                          >
                            {renderShiftBlocks(
                              player.shifts.period1,
                              "period1",
                              REGULAR_PERIOD_LENGTH_SECONDS,
                              player.team === homeTeamAbbrev ? "home" : "away"
                            )}
                          </td>
                          {/* Period 2 */}
                          <td
                            className={styles.shiftBlocksCell}
                            style={{
                              "--shift-block-bg": darkenHexColor(
                                shiftBlockBackgroundColor,
                                50
                              )
                            }}
                          >
                            {renderShiftBlocks(
                              player.shifts.period2,
                              "period2",
                              REGULAR_PERIOD_LENGTH_SECONDS,
                              player.team === homeTeamAbbrev ? "home" : "away"
                            )}
                          </td>
                          {/* Period 3 */}
                          <td
                            className={styles.shiftBlocksCell}
                            style={{
                              "--shift-block-bg": darkenHexColor(
                                shiftBlockBackgroundColor,
                                20
                              )
                            }}
                          >
                            {renderShiftBlocks(
                              player.shifts.period3,
                              "period3",
                              REGULAR_PERIOD_LENGTH_SECONDS,
                              player.team === homeTeamAbbrev ? "home" : "away"
                            )}
                          </td>
                          {isOvertime && (
                            <td
                              className={`${styles.shiftBlocksCell} ${styles.overtimeCell}`}
                              style={{
                                "--shift-block-bg": shiftBlockBackgroundColor
                              }}
                            >
                              {renderShiftBlocks(
                                player.shifts.overtime,
                                "overtime",
                                OVERTIME_LENGTH_SECONDS,
                                player.team === homeTeamAbbrev ? "home" : "away"
                              )}
                            </td>
                          )}
                        </>
                      )}
                      {/* Show empty cells for backup goalies with no shifts */}
                      {isBackupGoalie && (
                        <>
                          <td className={styles.shiftBlocksCell}></td>
                          <td className={styles.shiftBlocksCell}></td>
                          <td className={styles.shiftBlocksCell}></td>
                          {isOvertime && (
                            <td
                              className={`${styles.shiftBlocksCell} ${styles.overtimeCell}`}
                            ></td>
                          )}
                        </>
                      )}
                    </motion.tr>
                  );
                })}

                {/* Team Header for Away Team */}
                <tr
                  className={styles.teamHeaderRowAway}
                  style={{
                    "--team-header-bg":
                      teamsInfo[awayTeamAbbrev]?.primaryColor || "#000000",
                    "--team-header-text":
                      teamsInfo[awayTeamAbbrev]?.secondaryColor || "#FFFFFF",
                    "--team-header-border":
                      teamsInfo[awayTeamAbbrev]?.jersey || "#FFFFFF"
                  }}
                >
                  <td
                    className={styles.teamHeaderCellAway}
                    colSpan={isOvertime ? "6" : "5"}
                    style={{
                      "--team-header-cell-bg":
                        lightenHexColor(
                          teamsInfo[awayTeamAbbrev]?.primaryColor,
                          15
                        ) || "#000000",
                      "--team-header-cell-border": "1px solid #FFFFFF"
                    }}
                  >
                    <span className={styles.teamHeaderText}>
                      {awayTeamAbbrev}
                    </span>
                  </td>
                </tr>

                {playerData.away.map((player, index) => {
                  // Check if the player is a backup goalie with no shifts
                  const isBackupGoalie =
                    player.position === "G" &&
                    (!Array.isArray(player.shifts.period1) ||
                      player.shifts.period1.length === 0) &&
                    (!Array.isArray(player.shifts.period2) ||
                      player.shifts.period2.length === 0) &&
                    (!Array.isArray(player.shifts.period3) ||
                      player.shifts.period3.length === 0) &&
                    (!isOvertime ||
                      !Array.isArray(player.shifts.overtime) ||
                      player.shifts.overtime.length === 0);

                  // Flatten all period shifts into a single array
                  const allShifts = [].concat(
                    player.shifts.period1,
                    player.shifts.period2,
                    player.shifts.period3,
                    player.shifts.overtime
                  );

                  // Determine if the player is currently active based on the selectedTime
                  const isActive = allShifts.some((shift) => {
                    // Check if shift is undefined or null
                    if (!shift || typeof shift.startTime === "undefined") {
                      console.error(
                        "Shift is undefined or does not have a startTime property:",
                        shift,
                        player
                      );
                      return false; // or handle this case as appropriate for your application
                    }

                    const shiftStart = convertTimeToSeconds(shift.startTime);
                    const shiftEnd =
                      shiftStart + convertTimeToSeconds(shift.duration);
                    return (
                      selectedTime >= shiftStart && selectedTime < shiftEnd
                    );
                  });

                  const teamColors = player.teamColors; // Access team colors from player object

                  const shiftBlockBackgroundColor =
                    index % 2 === 0 ? "#404040" : "#202020";

                  const indexedColors = [
                    "#202020",
                    "#404040",
                    "#808080",
                    "#606060"
                  ];

                  // const playerNameBackgroundColor = player.team
                  //   ? player.team === homeTeamAbbrev
                  //     ? index % 2 === 0
                  //       ? indexedColors[0]
                  //       : indexedColors[1]
                  //     : index % 2 === 0
                  //     ? indexedColors[2]
                  //     : indexedColors[3]
                  //   : "#000000"; // Default color if secondaryColor is undefined

                  const playerNameBackgroundColor = teamColors.primaryColor
                    ? player.team === awayTeamAbbrev
                      ? index % 2 === 0
                        ? lightenHexColor(teamColors.primaryColor, 20)
                        : lightenHexColor(teamColors.primaryColor, 15)
                      : index % 2 === 0
                        ? lightenHexColor(teamColors.primaryColor, 15)
                        : lightenHexColor(teamColors.primaryColor, 30)
                    : "#000000"; // Default color if secondaryColor is undefined

                  const playerPositionBackgroundColor = teamColors.primaryColor
                    ? index % 2 === 0
                      ? lightenHexColor(teamColors.primaryColor, 15)
                      : lightenHexColor(teamColors.primaryColor, 3)
                    : "#000000"; // Default color if secondaryColor is undefined

                  // const textColor = player.team
                  //   ? player.team === homeTeamAbbrev
                  //     ? index % 2 === 0
                  //       ? lightenHexColor(indexedColors[0], 70)
                  //       : lightenHexColor(indexedColors[1], 70)
                  //     : index % 2 === 0
                  //     ? darkenHexColor(indexedColors[2], 70)
                  //     : darkenHexColor(indexedColors[3], 70)
                  //   : "#FFFFFF"; // Default color if secondaryColor is undefined

                  const textColor = player.team
                    ? player.team === awayTeamAbbrev
                      ? index % 2 === 0
                        ? lightenHexColor(teamColors.secondaryColor, 10)
                        : lightenHexColor(teamColors.secondaryColor, 10)
                      : index % 2 === 0
                        ? darkenHexColor(teamColors.secondaryColor, 10)
                        : darkenHexColor(teamColors.secondaryColor, 10)
                    : "#FFFFFF"; // Default color if secondaryColor is undefined

                  return (
                    <motion.tr
                      layout="position"
                      initial={{ opacity: 0 }} // Optional: fade in initially
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }} // Optional: fade out on removal
                      transition={{ duration: 0.4, ease: "easeInOut" }} // Customize animation
                      className={`${styles.playerRow} ${
                        player.playerClass || ""
                      }`}
                      key={player.id} // IMPORTANT: Key must be stable
                      style={{
                        "--player-color": lightenHexColor(textColor, 30),
                        "--player-bg": playerNameBackgroundColor,
                        "--player-weight": player.isActive ? "900" : "200",
                        "--player-stretch": player.isActive
                          ? "expanded"
                          : "normal",
                        "--player-spacing": player.isActive ? "0.1em" : "normal"
                      }}
                    >
                      <td
                        className={styles.playerNameCell}
                        // No inline style
                      >
                        <span
                          className={`${styles.playerNameText} ${!player.isActive ? styles.inactivePlayerText : ""}`}
                        >
                          {player.name}
                        </span>
                      </td>
                      <td
                        className={styles.playerPositionCell}
                        style={{
                          "--player-position-bg": playerPositionBackgroundColor
                        }}
                      >
                        {player.position}
                      </td>
                      {/* Render shifts only if the player is not a backup goalie with no shifts */}
                      {!isBackupGoalie && (
                        <>
                          <td
                            className={styles.shiftBlocksCell}
                            style={{
                              "--shift-block-bg": darkenHexColor(
                                shiftBlockBackgroundColor,
                                20
                              )
                            }}
                          >
                            {renderShiftBlocks(
                              player.shifts.period1,
                              "period1",
                              REGULAR_PERIOD_LENGTH_SECONDS,
                              player.team === homeTeamAbbrev ? "home" : "away"
                            )}
                          </td>
                          <td
                            className={styles.shiftBlocksCell}
                            style={{
                              "--shift-block-bg": darkenHexColor(
                                shiftBlockBackgroundColor,
                                50
                              )
                            }}
                          >
                            {renderShiftBlocks(
                              player.shifts.period2,
                              "period2",
                              REGULAR_PERIOD_LENGTH_SECONDS,
                              player.team === homeTeamAbbrev ? "home" : "away"
                            )}
                          </td>
                          <td
                            className={styles.shiftBlocksCell}
                            style={{
                              "--shift-block-bg": darkenHexColor(
                                shiftBlockBackgroundColor,
                                20
                              )
                            }}
                          >
                            {renderShiftBlocks(
                              player.shifts.period3,
                              "period3",
                              REGULAR_PERIOD_LENGTH_SECONDS,
                              player.team === homeTeamAbbrev ? "home" : "away"
                            )}
                          </td>
                          {isOvertime && (
                            <td
                              className={`${styles.shiftBlocksCell} ${styles.overtimeCell}`}
                              style={{
                                "--shift-block-bg": shiftBlockBackgroundColor
                              }}
                            >
                              {renderShiftBlocks(
                                player.shifts.overtime,
                                "overtime",
                                OVERTIME_LENGTH_SECONDS,
                                player.team === homeTeamAbbrev ? "home" : "away"
                              )}
                            </td>
                          )}
                        </>
                      )}
                      {/* Show empty cells for backup goalies with no shifts */}
                      {isBackupGoalie && (
                        <>
                          <td className={styles.shiftBlocksCell}></td>
                          <td className={styles.shiftBlocksCell}></td>
                          <td className={styles.shiftBlocksCell}></td>
                          {isOvertime && (
                            <td
                              className={`${styles.shiftBlocksCell} ${styles.overtimeCell}`}
                            ></td>
                          )}
                        </>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Right: Linemate Matrix (33%) */}
      <div className={styles.linemateMatrixSidebarColumn}>
        <div className={styles.linemateMatrixSidebarCard}>
          <div className={styles.linemateMatrixStacked}>
            <LinemateMatrix
              id={gameId}
              mode={linemateMatrixMode}
              onModeChanged={(newMode) => {
                setLinemateMatrixMode(newMode, { scroll: false });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShiftChart;
