/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\useTOIData.tsx
import { useEffect, useState } from "react";
import { generateKey, TOIData, Team } from "./index";
import { parseTime, PlayerData } from "./utilities";
import supabase from "lib/supabase";

// Function to calculate ATOI
function calculateATOI(totalTOI: number, GP: number): string {
  if (GP === 0) return "00:00";
  const averageTimeInSeconds = totalTOI / GP;
  const avgMinutes = Math.floor(averageTimeInSeconds / 60);
  const avgSeconds = Math.round(averageTimeInSeconds % 60);
  return `${String(avgMinutes).padStart(2, "0")}:${String(avgSeconds).padStart(
    2,
    "0"
  )}`;
}

export async function getTOIDataForGames(
  teamAbbreviation: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from("shift_charts")
    .select("*")
    .eq("team_abbreviation", teamAbbreviation)
    .gte("game_date", startDate)
    .lte("game_date", endDate);

  if (error) {
    console.error("Error fetching data from Supabase:", error);
    return {
      toiData: [],
      roster: [],
      team: null,
      homeAwayInfo: [],
      playerATOI: {},
    };
  }

  const allTOIData: TOIData[] = [];
  const allRosters: PlayerData[] = [];
  const allTeams: Set<Team> = new Set();
  const allHomeAwayInfo: { gameId: number; homeOrAway: string }[] = [];
  const playerATOI: Record<number, string> = {};

  data.forEach((row) => {
    const playerId = row.player_id;
    const totalTOIInSeconds = parseTime(row.totalTOI);

    const playerData: PlayerData = {
      id: playerId,
      teamId: row.team_id,
      franchiseId: row.franchise_id,
      position: row.primary_position,
      name: `${row.player_first_name} ${row.player_last_name}`,
      playerAbbrevName: `${row.player_first_name.charAt(0)}. ${
        row.player_last_name
      }`, // Abbreviated name
      lastName: row.player_last_name,
      timesOnLine: row.times_on_line || {},
      timesOnPair: row.times_on_pair || {},
      percentToiWith: row.percent_toi_with || {},
      percentToiWithMixed: row.percent_toi_with_mixed || {},
      timeSpentWith: row.time_spent_with || {},
      timeSpentWithMixed: row.time_spent_with_mixed || {},
      GP: row.GP,
      timesPlayedWith: row.times_played_with || {},
      ATOI: calculateATOI(totalTOIInSeconds, row.GP),
      percentOfSeason: row.percent_of_season || {},
      displayPosition: row.display_position || "",
      totalTOI: totalTOIInSeconds, // Store TOI as seconds
      comboPoints: row.comboPoints || 0, // Ensure comboPoints is defined
    };

    allRosters.push(playerData);

    // Calculate TOI for each player pair
    Object.entries(row.time_spent_with).forEach(([key, value]) => {
      const toi = parseTime(value as string);
      allTOIData.push({
        toi,
        p1: playerData,
        p2: {
          id: parseInt(key),
          teamId: row.team_id,
          franchiseId: row.franchise_id,
          position: "",
          name: "",
          playerAbbrevName: "",
          lastName: "",
          timesOnLine: {},
          timesOnPair: {},
          percentToiWith: {},
          percentToiWithMixed: {}, // Initialize new field
          timeSpentWith: {},
          timeSpentWithMixed: {}, // Initialize new field
          GP: 0,
          timesPlayedWith: {},
          ATOI: "",
          percentOfSeason: {},
          displayPosition: "",
          totalTOI: 0, // Ensure totalTOI is always a number
          comboPoints: 0, // Initialize new field
        },
      });
    });

    // Collect home/away info
    allHomeAwayInfo.push({
      gameId: row.game_id,
      homeOrAway: row.home_or_away,
    });

    // Add team to the set
    allTeams.add({ id: row.team_id, name: row.team_abbreviation });

    // Store calculated ATOI
    playerATOI[playerId] = playerData.ATOI;
  });

  const avgToi = new Map<string, TOIData>();
  allTOIData.forEach((item) => {
    const key = generateKey(item.p1.id, item.p2.id);
    if (!avgToi.has(key)) {
      avgToi.set(key, { toi: 0, p1: item.p1, p2: item.p2 });
    }
    avgToi.get(key)!.toi += item.toi;
  });

  avgToi.forEach((item) => {
    const gamesCount = playerATOI[item.p1.id] && playerATOI[item.p2.id] ? 1 : 0;
    if (gamesCount > 0) {
      item.toi /= gamesCount;
    }
  });

  return {
    toiData: [...avgToi.values()],
    roster: allRosters,
    team:
      [...allTeams].find((team) => team.id === parseInt(teamAbbreviation)) ??
      undefined,
    homeAwayInfo: allHomeAwayInfo,
    playerATOI,
  };
}

export function useTOI(
  teamAbbreviation: string,
  startDate: string,
  endDate: string
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
    if (!teamAbbreviation) return;
    setLoading(true);

    (async () => {
      try {
        const { toiData, roster, team, homeAwayInfo, playerATOI } =
          await getTOIDataForGames(teamAbbreviation, startDate, endDate);
        if (mounted) {
          setTOI(toiData);
          setRosters(roster);
          setTeam(team ?? null);
          setHomeAwayInfo(homeAwayInfo);
          setPlayerATOI(playerATOI);
        }
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [teamAbbreviation, startDate, endDate]);

  return [toi, rosters, team, loading, homeAwayInfo, playerATOI] as const;
}
