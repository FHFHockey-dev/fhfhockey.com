// shiftChart.js
// /workspaces/fhfhockey.com/web/pages/shiftChart.js

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSnackbar } from "notistack";
import { teamsInfo } from "lib/NHL/teamsInfo";
import styles from "styles/ShiftChart.module.scss";
import Fetch from "lib/cors-fetch";
import { GoalIndicators } from "hooks/useGoals";
import PowerPlayAreaIndicators from "components/ShiftChart/PowerPlayAreaIndicators";
import LinemateMatrix, {
  OPTIONS as LINEMATE_MATRIX_MODES
} from "components/LinemateMatrix/index";
import { queryTypes, useQueryState } from "next-usequerystate";
import supabase from "lib/supabase";
import { motion } from "framer-motion"; // *** 1. Import motion ***

// TODO

// modularize the project

// create components that log play by play data for power play start times, goals, penalties, etc.
// Get play by play api info
// loop through events to get penalties and duration
// log a goal, or end of penalty by way of duration
// highlight every player row during that time span to create a massive highlight
// log goals

// create components that log line combos for each team, ES/PP/PK
// Still need timestamp numbers in the timestamp bar
// 6) Create dynamic time animations. Use the game clock to animate the shift blocks to show who is on/off the ice
// 7) Add a play-by-play timeline to the bottom of the chart
// 8) Add a legend to the chart
// 11) Create more todo list items

// Initializes the timestamps state with keys for each period and an empty array for each
const initialTimestamps = {
  period1: [],
  period2: [],
  period3: [],
  overtime: []
};

/**
 * Get games that played the same date as input game or the date
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
  const [totalGameWidth, setTotalGameWidth] = useState(1000); // State for the dynamic width of the game canvas
  const [isOvertime, setIsOvertime] = useState(false);
  const [timestamps, setTimestamps] = useState(initialTimestamps);
  const [homeTeamAbbrev, setHomeTeamAbbrev] = useState("");
  const [awayTeamAbbrev, setAwayTeamAbbrev] = useState("");
  const [gameScores, setGameScores] = useState({ homeScore: 0, awayScore: 0 });
  const [selectedTime, setSelectedTime] = useState(null);
  const [seasonStartDate, setSeasonStartDate] = useState(""); // New state for season start date
  const [isLoading, setIsLoading] = useState(false);

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
      const shiftStyle = {
        backgroundColor: lightenHexColor(teamPrimaryColor, 10),
        width: `${widthPercent}%`,
        left: `${leftPercent}%`,
        border: `1px solid #FFFFFF90`,
        // border: `1px solid ${lightenHexColor(teamPrimaryColor, 35)}`,
        position: "absolute",
        borderRadius: "0px"
      };

      const tooltipText = `Start: ${shift.startTime}, \nDuration: ${shift.duration}`;

      // Render the shift block
      return (
        <div
          key={`shift-${index}`}
          className={styles.shiftBlock}
          style={shiftStyle}
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

  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////

  // console.log("Rendering player data:", playerData);

  return (
    <div className={styles.shiftChartPageContainer}>
      <div className={styles.controlsContainer}>
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
      {/* Shift Chart Table Section */}
      <div className={styles.shiftChartTableContainer}>
        {" "}
        {/* Wrapper for table section */}
        <div className={styles.tableScrollWrapper}>
          {" "}
          {/* Wrapper for horizontal scrolling */}
          <table className={styles.shiftChartTable}>
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
                {isOvertime && <th className={styles.timestampOvertime}>OT</th>}
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
                >
                  {Object.keys(timestamps).map((periodKey) =>
                    timestamps[periodKey].map((timestamp, index) => (
                      <div
                        key={index}
                        className={styles.timestampLabel}
                        style={{ left: `${timestamp.positionPercent}%` }}
                      >
                        {timestamp.label}
                      </div>
                    ))
                  )}
                  <div
                    className={styles.yellowLine}
                    style={{
                      left: `${
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
                        (playerData.home.length + playerData.away.length) * 100
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
                  "--team-header-bg-color":
                    teamsInfo[homeTeamAbbrev]?.primaryColor || "#000000",
                  "--team-header-text-color":
                    teamsInfo[homeTeamAbbrev]?.secondaryColor || "#FFFFFF",
                  "--team-header-border-color":
                    teamsInfo[homeTeamAbbrev]?.jersey || "#FFFFFF"
                }}
              >
                <td
                  className={styles.teamHeaderCellHome}
                  colSpan={isOvertime ? "6" : "5"}
                  style={{
                    borderRight: "1px solid #FFFFFF",
                    backgroundColor:
                      lightenHexColor(
                        teamsInfo[homeTeamAbbrev]?.primaryColor,
                        15
                      ) || "#000000"
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
                  return selectedTime >= shiftStart && selectedTime < shiftEnd;
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
                    layout // Animate layout changes (position)
                    initial={{ opacity: 0 }} // Optional: fade in initially
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }} // Optional: fade out on removal
                    transition={{ duration: 0.4, ease: "easeInOut" }} // Customize animation
                    className={`${styles.playerRow} ${
                      player.playerClass || ""
                    }`}
                    key={player.id} // IMPORTANT: Key must be stable
                  >
                    <td
                      className={styles.playerNameCell}
                      style={{
                        color: lightenHexColor(textColor, 10),
                        backgroundColor: playerNameBackgroundColor,
                        fontWeight: player.isActive ? "900" : "200",
                        fontStretch: player.isActive ? "expanded" : "normal",
                        letterSpacing: player.isActive ? "0.1em" : "normal"
                      }}
                    >
                      <span
                        className={`${styles.playerNameText} ${
                          !player.isActive ? styles.inactivePlayerText : ""
                        }`}
                      >
                        {player.name}
                      </span>
                    </td>
                    <td
                      className={styles.playerPositionCell}
                      style={{ backgroundColor: playerPositionBackgroundColor }}
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
                            backgroundColor: darkenHexColor(
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
                            backgroundColor: darkenHexColor(
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
                            backgroundColor: darkenHexColor(
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
                              backgroundColor: shiftBlockBackgroundColor
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
                  "--team-header-bg-color":
                    teamsInfo[awayTeamAbbrev]?.primaryColor || "#000000",
                  "--team-header-text-color":
                    teamsInfo[awayTeamAbbrev]?.secondaryColor || "#FFFFFF",
                  "--team-header-border-color":
                    teamsInfo[awayTeamAbbrev]?.jersey || "#FFFFFF"
                }}
              >
                <td
                  className={styles.teamHeaderCellAway}
                  colSpan={isOvertime ? "6" : "5"}
                  style={{
                    borderRight: "1px solid #FFFFFF",
                    backgroundColor:
                      lightenHexColor(
                        teamsInfo[awayTeamAbbrev]?.primaryColor,
                        15
                      ) || "#000000"
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
                  return selectedTime >= shiftStart && selectedTime < shiftEnd;
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
                    layout // Animate layout changes (position)
                    initial={{ opacity: 0 }} // Optional: fade in initially
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }} // Optional: fade out on removal
                    transition={{ duration: 0.4, ease: "easeInOut" }} // Customize animation
                    className={`${styles.playerRow} ${
                      player.playerClass || ""
                    }`}
                    key={player.id} // IMPORTANT: Key must be stable
                  >
                    <td
                      className={styles.playerNameCell}
                      style={{
                        color: lightenHexColor(textColor, 30),
                        backgroundColor: playerNameBackgroundColor,
                        fontWeight: player.isActive ? "900" : "200",
                        fontStretch: player.isActive ? "expanded" : "normal",
                        letterSpacing: player.isActive ? "0.1em" : "normal"
                      }}
                    >
                      <span
                        className={`${styles.playerNameText} ${
                          !player.isActive ? styles.inactivePlayerText : ""
                        }`}
                      >
                        {player.name}
                      </span>
                    </td>
                    <td
                      className={styles.playerPositionCell}
                      style={{ backgroundColor: playerPositionBackgroundColor }}
                    >
                      {player.position}
                    </td>
                    {/* Render shifts only if the player is not a backup goalie with no shifts */}
                    {!isBackupGoalie && (
                      <>
                        <td
                          className={styles.shiftBlocksCell}
                          style={{ backgroundColor: shiftBlockBackgroundColor }}
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
                          style={{ backgroundColor: shiftBlockBackgroundColor }}
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
                          style={{ backgroundColor: shiftBlockBackgroundColor }}
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
                              backgroundColor: shiftBlockBackgroundColor
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
      <div className={styles.linemateMatrixContainer} id="linemate-matrix">
        <LinemateMatrix
          id={gameId}
          mode={linemateMatrixMode}
          onModeChanged={(newMode) => {
            setLinemateMatrixMode(newMode, { scroll: false });
          }}
        />
      </div>
    </div>
  );
}

export default ShiftChart;
