/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\fetchAggregatedData.ts

import supabase from "lib/supabase";

const PAGE_SIZE = 1000;

async function fetchAllDataForTeam(
  teamAbbreviation: string,
  startDate: string,
  endDate: string
) {
  let offset = 0;
  let allData: any[] = [];
  let fetchMore = true;

  while (fetchMore) {
    const { data, error } = await supabase
      .from("shift_charts")
      .select("*")
      .eq("team_abbreviation", teamAbbreviation)
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
      allData = allData.concat(data);
      offset += PAGE_SIZE;
    }
  }

  return allData;
}

async function fetchDataForPlayer(
  teamAbbreviation: string,
  playerId: number,
  gameType: string,
  startDate: string,
  endDate: string
) {
  let offset = 0;
  let allData: any[] = [];
  let fetchMore = true;

  while (fetchMore) {
    const { data, error } = await supabase
      .from("shift_charts")
      .select("*")
      .eq("team_abbreviation", teamAbbreviation)
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

export async function fetchAggregatedData(
  teamAbbreviation: string,
  startDate: string,
  endDate: string,
  seasonType: "regularSeason" | "playoffs"
) {
  const allTeamData = await fetchAllDataForTeam(
    teamAbbreviation,
    startDate,
    endDate
  );

  const teamRoster = Array.from(
    new Set(allTeamData.map((row) => row.player_id))
  );

  const regularSeasonData: any[] = [];
  const playoffData: any[] = [];

  const playerDataFetches = teamRoster.map(async (playerId) => {
    if (seasonType === "regularSeason") {
      const regularSeasonPlayerData = await fetchDataForPlayer(
        teamAbbreviation,
        playerId,
        "2", // Fetch only regular season data
        startDate,
        endDate
      );
      regularSeasonData.push(...regularSeasonPlayerData);
    } else if (seasonType === "playoffs") {
      const playoffPlayerData = await fetchDataForPlayer(
        teamAbbreviation,
        playerId,
        "3", // Fetch only playoff data
        startDate,
        endDate
      );
      playoffData.push(...playoffPlayerData);
    }
  });

  await Promise.all(playerDataFetches);

  console.log(`Regular season rows: ${regularSeasonData.length}`);
  console.log(`Playoff rows: ${playoffData.length}`);

  const processData = (
    data: any[],
    seasonType: "regularSeason" | "playoffs"
  ) => {
    const playersData: any = {};

    data.forEach((row) => {
      const playerId = row.player_id;
      if (!playersData[playerId]) {
        playersData[playerId] = {
          playerName: `${row.player_first_name} ${row.player_last_name}`,
          playerAbbrevName: `${row.player_first_name.charAt(0)}. ${
            row.player_last_name
          }`, // Abbreviated name
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

      // Determine the correct season type (regular season or playoffs)
      const seasonData =
        seasonType === "regularSeason"
          ? playersData[playerId].regularSeasonData
          : playersData[playerId].playoffData;

      // Aggregate data
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
  };

  const regularSeasonPlayersData = processData(
    regularSeasonData,
    "regularSeason"
  );
  const playoffPlayersData = processData(playoffData, "playoffs");

  console.log("Regular Season Players Data:", regularSeasonPlayersData);
  console.log("Playoff Players Data:", playoffPlayersData);

  return { regularSeasonPlayersData, playoffPlayersData };
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
