/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\fetchAggregatedData.ts

import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import { getDateRangeForGames } from "./utilities"; // Import the helper function

// Function to fetch all data for a team within a date range
async function fetchAllDataForTeam(
  teamId: number,
  startDate: string,
  endDate: string
) {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let allData: { game_id: string; game_type: string; player_id: number }[] = [];
  let fetchMore = true;

  const fieldsToSelect =
    "game_id,game_type,player_id,player_first_name,player_last_name,team_id,team_abbreviation,game_toi,home_or_away,opponent_team_abbreviation,opponent_team_id,display_position,primary_position,time_spent_with,percent_toi_with,time_spent_with_mixed,percent_toi_with_mixed,game_length,line_combination,pairing_combination,season_id,player_type";

  while (fetchMore) {
    const { data, error } = await supabase
      .from("shift_charts")
      .select(fieldsToSelect)
      .eq("team_id", teamId)
      .gte("game_date", startDate)
      .lte("game_date", endDate)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`Error fetching data from Supabase:`, error);
      fetchMore = false;
    }

    if (!data || data.length === 0) {
      fetchMore = false;
    } else {
      // @ts-expect-error
      allData = allData.concat(data);
      offset += PAGE_SIZE;
    }
  }

  return allData;
}

// Function to fetch data for a specific player within a date range and season type
async function fetchDataForPlayer(
  teamId: number,
  playerId: number,
  gameType: string,
  startDate: string,
  endDate: string
) {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let allData: any[] = [];
  let fetchMore = true;

  const fieldsToSelect = [
    "game_id",
    "player_id",
    "player_first_name",
    "player_last_name",
    "team_id",
    "team_abbreviation",
    "game_toi",
    "home_or_away",
    "opponent_team_abbreviation",
    "opponent_team_id",
    "display_position",
    "primary_position",
    "time_spent_with",
    "percent_toi_with",
    "time_spent_with_mixed",
    "percent_toi_with_mixed",
    "game_length",
    "line_combination",
    "pairing_combination",
    "season_id",
    "player_type",
  ];

  while (fetchMore) {
    const { data, error } = await supabase
      .from("shift_charts")
      .select(fieldsToSelect.join(","))
      .eq("team_id", teamId)
      .eq("player_id", playerId)
      .eq("game_type", gameType)
      .gte("game_date", startDate)
      .lte("game_date", endDate)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(
        `Error fetching ${gameType} data for player ${playerId} from Supabase:`,
        error
      );
      fetchMore = false;
    }

    if (!data || data.length === 0) {
      fetchMore = false;
    } else {
      allData = allData.concat(data);
      offset += PAGE_SIZE;
    }
  }

  return allData;
}

// Function to fetch aggregated data for a team, filtered by time frame
export async function fetchAggregatedData(
  teamAbbreviation: string,
  startDate: string,
  endDate: string,
  seasonType: "regularSeason" | "playoffs",
  timeFrame: "L7" | "L14" | "L30" | "Totals",
  homeOrAway: string,
  opponentTeamAbbreviation: string
) {
  const teamInfo = teamsInfo[teamAbbreviation as keyof typeof teamsInfo];
  const teamId = teamInfo.id;
  const franchiseId = teamInfo.franchiseId;

  // Fetch the correct date range for the last 7, 14, or 30 games
  let calculatedDateRange = { startDate, endDate };

  if (timeFrame !== "Totals") {
    const dateRange = await getDateRangeForGames(
      franchiseId,
      parseInt(timeFrame.slice(1))
    );
    if (dateRange) {
      calculatedDateRange = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };
    }
  }

  // Fetch all data for the team within the calculated date range
  const allTeamData = await fetchAllDataForTeam(
    teamId,
    calculatedDateRange.startDate,
    calculatedDateRange.endDate
  );

  // Get unique player IDs from the data

  // Fetch data for each player based on season type
  const regularSeasonData = allTeamData.filter(
    (item) => item.game_type === "2"
  );
  const playoffData = allTeamData.filter((item) => item.game_type === "3");

  console.log({ regularSeasonData });
  // Process the fetched data to structure it by player
  const regularSeasonPlayersData = processData(
    regularSeasonData,
    "regularSeason"
  );
  const playoffPlayersData = processData(playoffData, "playoffs");

  return { regularSeasonPlayersData, playoffPlayersData };
}

// Function to process the aggregated data and calculate metrics
function processData(data: any[], seasonType: "regularSeason" | "playoffs") {
  const playersData: any = {};

  data.forEach((row) => {
    const playerId = row.player_id;
    if (!playersData[playerId]) {
      playersData[playerId] = {
        playerName: `${row.player_first_name} ${row.player_last_name}`,
        playerAbbrevName: `${row.player_first_name.charAt(0)}. ${
          row.player_last_name
        }`,
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

    Object.entries(row.time_spent_with as Record<string, string>).forEach(
      ([key, value]) => {
        if (!seasonData.timeSpentWith[key]) {
          seasonData.timeSpentWith[key] = parseTime(value);
          seasonData.timesPlayedWith[key] = 1;
        } else {
          seasonData.timeSpentWith[key] += parseTime(value);
          seasonData.timesPlayedWith[key] += 1;
        }
      }
    );

    Object.entries(
      (row.time_spent_with_mixed as Record<string, string>) || {}
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

function parseTime(time: string) {
  const [minutes, seconds] = time.split(":").map(Number);
  return minutes * 60 + seconds;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}
