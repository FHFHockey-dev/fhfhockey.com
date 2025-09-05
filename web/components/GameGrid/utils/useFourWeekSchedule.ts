// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\utils\useFourWeekSchedule.ts

import { useEffect, useState } from "react";
import { useTeams } from "../contexts/GameGridContext";
import { getSchedule } from "lib/NHL/client";
import { format, nextMonday, parseISO } from "date-fns";
import {
  WeekData,
  EXTENDED_DAY_ABBREVIATION,
  ExtendedWeekData
} from "lib/NHL/types";
import supabase from "lib/supabase";
import {
  calcTotalOffNights,
  calcWeightedOffNights,
  getTotalGamePlayed,
  createExtendedWeekData // Ensure this is imported
} from "./helper";
import { calcTotalGP } from "../TotalGamesPerDayRow";
import calcWeekScore from "./calcWeekScore";
import { convertTeamRowToWinOddsList } from "./calcWinOdds";

export type ScheduleArray = ExtendedWeekData[];

/**
 * Custom hook to fetch and manage schedule data for four weeks.
 *
 * @param start - The start date in 'yyyy-MM-dd' format.
 * @param extended - Whether to include extended data (e.g., next week).
 * @returns A tuple containing the schedule array, number of games per day, and loading state.
 */
export default function useFourWeekSchedule(
  start: string,
  extended: boolean = false
): [ScheduleArray, number[], boolean] {
  const [loading, setLoading] = useState(false);
  const [scheduleArray, setScheduleArray] = useState<ScheduleArray>([]);
  const [numGamesPerDay, setNumGamesPerDay] = useState<number[]>([]);
  const allTeams = useTeams();

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      try {
        let currentStart = start;
        const weeksToFetch = 4; // Total of four weeks
        const aggregatedSchedule: ScheduleArray = [];
        let aggregatedNumGamesPerDay: number[] = [];

        for (let week = 1; week <= weeksToFetch; week++) {
          const schedule = await getSchedule(currentStart);

          // If extended is true and it's the first week, append the next week's games
          if (extended && week === 1) {
            const nextMon = format(
              nextMonday(parseISO(currentStart)),
              "yyyy-MM-dd"
            );
            const nextWeekSchedule = await getSchedule(nextMon);

            schedule.numGamesPerDay = [
              ...schedule.numGamesPerDay,
              ...nextWeekSchedule.numGamesPerDay.slice(0, 3)
            ];

            Object.entries(nextWeekSchedule.data).forEach(([id, weekData]) => {
              const playedLastWeek = schedule.data[Number(id)] !== undefined;
              if (!playedLastWeek) {
                schedule.data[Number(id)] = {};
              }
              schedule.data[Number(id)].nMON = weekData.MON;
              schedule.data[Number(id)].nTUE = weekData.TUE;
              schedule.data[Number(id)].nWED = weekData.WED;
            });
          }

          // Ensure all teams are included, even if they have no games
          const paddedTeams: Record<number, WeekData> = { ...schedule.data };
          Object.keys(allTeams).forEach((id) => {
            const teamId = Number(id);
            if (!paddedTeams[teamId]) {
              paddedTeams[teamId] = {};
            }
          });

          // Collect all game IDs for fetching win odds
          const gameIds: number[] = [];
          for (const teamData of Object.values(paddedTeams) as WeekData[]) {
            for (const day of Object.keys(
              teamData
            ) as EXTENDED_DAY_ABBREVIATION[]) {
              const game = teamData[day];
              if (game && game.id) {
                gameIds.push(game.id);
              }
            }
          }

          // Fetch win odds from Supabase
          const { data: oddsData, error } = await supabase
            .from("expected_goals")
            .select(
              "game_id, home_win_odds, away_win_odds, home_api_win_odds, away_api_win_odds"
            )
            .in("game_id", gameIds);

          if (error) {
            console.error("Error fetching win odds data:", error);
          }

          // Map win odds by game_id for easy access
          const oddsByGameId = (oddsData || []).reduce((acc, item) => {
            acc[item.game_id] = item;
            return acc;
          }, {} as Record<number, any>);

          // Assign win odds to each game in the schedule
          for (const teamData of Object.values(paddedTeams) as WeekData[]) {
            for (const day of Object.keys(
              teamData
            ) as EXTENDED_DAY_ABBREVIATION[]) {
              const game = teamData[day];
              if (game && game.id) {
                const odds = oddsByGameId[game.id];
                if (odds) {
                  game.homeTeam.winOdds = odds.home_win_odds;
                  game.awayTeam.winOdds = odds.away_win_odds;
                  game.homeTeam.apiWinOdds = odds.home_api_win_odds;
                  game.awayTeam.apiWinOdds = odds.away_api_win_odds;
                } else {
                  // Set default values if odds are missing
                  game.homeTeam.winOdds = null;
                  game.awayTeam.winOdds = null;
                  game.homeTeam.apiWinOdds = null;
                  game.awayTeam.apiWinOdds = null;
                }
              }
            }
          }

          // Aggregate the schedule data
          const result = Object.entries(paddedTeams).map(
            ([teamId, weekData]) => {
              // Calculate totalGamesPlayed, totalOffNights, and weekScore for each team
              const totalGamesPlayed = getTotalGamePlayed(weekData, []);
              const totalOffNights = calcTotalOffNights(
                weekData,
                schedule.numGamesPerDay,
                []
              );
              const weightedOffNights = calcWeightedOffNights(
                weekData,
                schedule.numGamesPerDay,
                []
              );
              const winOddsList = convertTeamRowToWinOddsList({
                ...weekData,
                teamId: Number(teamId),
                weekNumber: week
              });
              const weekScore = calcWeekScore(
                winOddsList,
                weightedOffNights, // use weighted off‑nights for scoring
                calcTotalGP(schedule.numGamesPerDay, []),
                totalGamesPlayed
              );

              // **Use Helper Function to Create ExtendedWeekData**
              const extendedWeekData = createExtendedWeekData(
                Number(teamId),
                week,
                weekData,
                totalGamesPlayed,
                totalOffNights,
                weekScore
              );

              return extendedWeekData;
            }
          );

          aggregatedSchedule.push(...result);
          aggregatedNumGamesPerDay = [
            ...aggregatedNumGamesPerDay,
            ...schedule.numGamesPerDay
          ];

          // Prepare for next week
          currentStart = format(
            nextMonday(parseISO(currentStart)),
            "yyyy-MM-dd"
          );
        }

        if (!ignore) {
          setScheduleArray(aggregatedSchedule);
          setNumGamesPerDay(aggregatedNumGamesPerDay);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching schedules:", error);
        if (!ignore) {
          setLoading(false);
        }
      }
    })();

    return () => {
      ignore = true;
      setLoading(false);
    };
  }, [start, extended, allTeams]);

  return [scheduleArray, numGamesPerDay, loading];
}
